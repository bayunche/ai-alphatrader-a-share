
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

// Akshare 服务地址，默认为本机 5001 端口，需先启动 akshare_service.py
const AKSHARE_BASE = process.env.AKSHARE_BASE || 'http://127.0.0.1:5001';

const app = express();
const PORT = process.env.PORT || 38211;

const isPkg = !!process.pkg;
const appRoot = isPkg ? path.dirname(process.execPath) : __dirname;
const dataDir = process.env.DATA_DIR || appRoot;
fs.mkdirSync(dataDir, { recursive: true });
const dbPath = path.join(dataDir, 'database.sqlite');
const masterFilePath = path.join(dataDir, 'a_stock_master.json');
const respondError = (res, err, status = 500, context = 'error') => {
  const message = err?.message || 'unknown error';
  console.error(`[${context}]`, err);
  return res.status(status).json({ success: false, error: message });
};

// 使用沪深时区计算当前时间，避免宿主机时区（如 UTC）导致交易时段误判
const getShanghaiNow = () => new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Shanghai' }));
const isTradingTimeShanghai = () => {
  const now = getShanghaiNow();
  const day = now.getDay();
  if (day === 0 || day === 6) return false;
  const minutes = now.getHours() * 60 + now.getMinutes();
  const morning = minutes >= (9 * 60 + 30) && minutes < (11 * 60 + 30);
  const afternoon = minutes >= (13 * 60) && minutes < (15 * 60);
  return morning || afternoon;
};

app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));

// Initialize DB
const db = new sqlite3.Database(dbPath);

// Initialize Schema
const builtinSchema = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS workspaces (
  user_id TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
`;
const schemaPath = path.join(__dirname, 'schema.sql');
let schema = builtinSchema;
try {
  if (fs.existsSync(schemaPath)) {
    const fileSql = fs.readFileSync(schemaPath, 'utf8');
    if (fileSql && fileSql.trim().length > 0) {
      schema = fileSql;
    }
  }
} catch (e) {
  console.warn('Schema file load failed, using builtin schema', e.message);
}
db.exec(schema, (err) => {
  if (err) console.error("DB Schema Error:", err);
  else console.log("Database initialized.");
});

// 建立 A 股主表表结构
db.exec(
  `
  CREATE TABLE IF NOT EXISTS a_stock_master (
    code TEXT PRIMARY KEY,
    market_id INTEGER,
    name TEXT,
    last REAL,
    chg_pct REAL,
    chg REAL,
    volume REAL,
    amount REAL,
    high REAL,
    low REAL,
    open REAL,
    pre_close REAL,
    total_mv REAL,
    float_mv REAL,
    pe_dynamic REAL,
    pb REAL,
    last_updated TEXT
  );
`,
  (err) => {
    if (err) console.error("Create a_stock_master failed", err);
  }
);

// --- Routes ---

// Login // History Data Proxy
app.get('/api/history', async (req, res) => {
  const { symbol, days } = req.query;
  if (!symbol) return res.status(400).json({ success: false, error: 'symbol required' });

  try {
    const targetUrl = `${AKSHARE_BASE}/history?symbol=${symbol}&days=${days || 20}`;
    const resp = await fetch(targetUrl);

    if (!resp.ok) {
      // If akshare fails, maybe fallback to eastmoney generic kline?
      // For now just return error or empty
      console.warn(`[History] fetch failed ${resp.status}`);
      return res.json({ success: true, data: [] });
    }
    const json = await resp.json();
    res.json(json);
  } catch (e) {
    console.error(`[History] proxy error:`, e.message);
    res.json({ success: true, data: [] }); // Soft fail
  }
});

// Create Agent
app.post('/api/agent', (req, res) => {
  const { username } = req.body;
  db.get('SELECT * FROM users WHERE username = ?', [username], (err, row) => {
    if (err) return respondError(res, err, 500, 'auth/login');
    if (!row) return respondError(res, new Error('User not found'), 404, 'auth/login');
    res.json({ success: true, data: row });
  });
});

// Register
app.post('/api/auth/register', (req, res) => {
  const { username } = req.body;
  const id = Math.random().toString(36).substr(2, 9);

  db.run('INSERT INTO users (id, username) VALUES (?, ?)', [id, username], function (err) {
    if (err) {
      if (err.message.includes('UNIQUE')) return respondError(res, new Error('Username exists'), 400, 'auth/register');
      return respondError(res, err, 500, 'auth/register');
    }
    res.json({ success: true, data: { id, username } });
  });
});

// Load Workspace
app.get('/api/workspace/:userId', (req, res) => {
  const { userId } = req.params;
  db.get('SELECT data FROM workspaces WHERE user_id = ?', [userId], (err, row) => {
    if (err) return respondError(res, err, 500, 'workspace/load');

    if (!row) {
      return res.json({ success: true, data: null }); // No saved workspace yet
    }
    try {
      res.json({ success: true, data: JSON.parse(row.data) });
    } catch (e) {
      respondError(res, new Error('Corrupt data'), 500, 'workspace/load');
    }
  });
});

// Save Workspace
app.post('/api/workspace', (req, res) => {
  const { userId, data } = req.body;
  const jsonStr = JSON.stringify(data);

  db.run(`INSERT INTO workspaces (user_id, data, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)
          ON CONFLICT(user_id) DO UPDATE SET data=excluded.data, updated_at=CURRENT_TIMESTAMP`,
    [userId, jsonStr], (err) => {
      if (err) return respondError(res, err, 500, 'workspace/save');
      res.json({ success: true });
    }
  );
});

// --- Market Proxy (paging + keyword + cache) ---
const parseDoubleSafe = (val) => {
  if (val === '-' || val === null || val === undefined || val === '') return 0;
  const num = parseFloat(val);
  return isNaN(num) ? 0 : num;
};

const stripHtml = (val = '') => val.replace(/<[^>]*>/g, '');

// 全局未捕获错误处理，保证错误返回明确
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection', reason);
});
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception', err);
});

console.log(`[akshare] base = ${AKSHARE_BASE}（请先启动 akshare_service.py，再启动后端，再启动前端）`);

const marketCache = {
  data: [],
  lastUpdated: 0,
  total: 0
};

const buildBrowserHeaders = (referer = 'https://quote.eastmoney.com/') => ({
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/javascript, */*; q=0.01',
  'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
  'Accept-Encoding': 'gzip, deflate, br',
  'Cache-Control': 'no-cache',
  'Pragma': 'no-cache',
  'Referer': referer,
  'Sec-Ch-Ua': '"Chromium";v="123", "Not:A-Brand";v="8"',
  'Sec-Ch-Ua-Mobile': '?0',
  'Sec-Ch-Ua-Platform': '"Windows"',
});

const fetchEastMoneyPage = async (page, pageSize) => {
  const fs = process.env.EM_FS || 'm:0+t:6,m:0+t:13,m:0+t:80,m:1+t:2,m:1+t:23';
  const fields = process.env.EM_FIELDS || 'f12,f13,f14,f2,f3,f4,f5,f6,f15,f16,f17,f18,f20,f21,f9,f23';
  const fid = process.env.EM_FID || 'f3';
  const headers = buildBrowserHeaders('https://quote.eastmoney.com/');

  const baseUrls = [
    'https://push2.eastmoney.com',
    'http://80.push2.eastmoney.com',
    'http://64.push2.eastmoney.com',
    'http://82.push2.eastmoney.com',
  ];

  let lastError = null;
  for (const base of baseUrls) {
    const targetUrl = `${base}/api/qt/clist/get?pn=${page}&pz=${pageSize}&po=1&np=1&ut=bd1d9ddb04089700cf9c27f6f7426281&fltt=2&invt=2&fid=${fid}&fs=${encodeURIComponent(fs)}&fields=${encodeURIComponent(fields)}`;
    try {
      const resp = await fetch(targetUrl, { headers });
      if (!resp.ok) {
        lastError = new Error(`eastmoney ${resp.status}`);
        continue;
      }
      const data = await resp.json();
      const list = Array.isArray(data?.data?.diff) ? data.data.diff : Object.values(data?.data?.diff || {});
      const total = data?.data?.total ? parseInt(data.data.total, 10) : list.length;
      const mapped = list.map((item) => ({
        symbol: item.f12,
        market: item.f13,
        name: item.f14,
        price: parseDoubleSafe(item.f2),
        change: parseDoubleSafe(item.f3),
        changeAmount: parseDoubleSafe(item.f4),
        volume: parseDoubleSafe(item.f5),
        amount: parseDoubleSafe(item.f6),
        high: parseDoubleSafe(item.f15),
        low: parseDoubleSafe(item.f16),
        open: parseDoubleSafe(item.f17),
        prevClose: parseDoubleSafe(item.f18),
        totalMarketCap: parseDoubleSafe(item.f20),
        floatMarketCap: parseDoubleSafe(item.f21),
        pe: parseDoubleSafe(item.f9),
        pb: parseDoubleSafe(item.f23),
        timestamp: new Date().toISOString(),
        trend: [],
      }));
      return { data: mapped, total };
    } catch (e) {
      lastError = e;
      continue;
    }
  }
  throw lastError || new Error('eastmoney fetch failed');
};

const fetchYingweiPage = async (page, pageSize, keyword) => {
  const base = process.env.YINGWEI_API;
  if (!base) return [];
  const url = new URL(base);
  url.searchParams.set('page', String(page));
  url.searchParams.set('pageSize', String(pageSize));
  if (keyword) url.searchParams.set('q', keyword);

  const resp = await fetch(url.toString());
  if (!resp.ok) throw new Error('yingwei network error');
  const json = await resp.json();
  const list = Array.isArray(json?.data) ? json.data : (Array.isArray(json) ? json : []);
  return list.map((item) => ({
    symbol: item.symbol || item.code || item.ticker || '',
    name: item.name || item.cn_name || item.displayName || '',
    price: parseDoubleSafe(item.price ?? item.last ?? item.close),
    change: parseDoubleSafe(item.change ?? item.chg ?? item.pct_chg),
    volume: parseDoubleSafe(item.volume ?? item.vol),
    timestamp: new Date().toISOString(),
    trend: [],
  })).filter((m) => m.symbol && m.name);
};

const fetchEastMoneyQuote = async (symbol) => {
  if (!symbol) return null;
  const secid = symbol.startsWith('6') ? `1.${symbol}` : `0.${symbol}`;
  const fields = 'f57,f58,f43,f60,f44,f45,f46,f47,f71,f168,f164';
  const url = `https://push2.eastmoney.com/api/qt/stock/get?secid=${secid}&fields=${fields}&fltt=2&invt=2&ut=7eea3edcaed734bea9cbfc24409ed989`;
  const resp = await fetch(url, { headers: buildBrowserHeaders('https://quote.eastmoney.com/') });
  if (!resp.ok) throw new Error(`eastmoney quote ${resp.status}`);
  const data = (await resp.json())?.data;
  if (!data) throw new Error('eastmoney quote empty');
  const safe = (k, scale = 1) => parseDoubleSafe(data[k]) / scale;
  return {
    symbol: data.f57 || symbol,
    name: data.f58 || '',
    price: safe('f43', 100),
    prevClose: safe('f60', 100),
    high: safe('f44', 100),
    low: safe('f45', 100),
    open: safe('f46', 100),
    volume: safe('f47'),
    amount: 0,
    timestamp: new Date().toISOString(),
  };
};

const fetchYingweiQuotes = async (symbols = []) => {
  if (!symbols.length) return [];
  const base = process.env.YINGWEI_API;
  if (!base) return [];
  const url = new URL(base);
  url.searchParams.set('page', '1');
  url.searchParams.set('pageSize', String(symbols.length));
  url.searchParams.set('q', symbols.join(','));
  const resp = await fetch(url.toString(), { headers: buildBrowserHeaders(base) });
  if (!resp.ok) throw new Error('yingwei quote error');
  const json = await resp.json();
  const list = Array.isArray(json?.data) ? json.data : (Array.isArray(json) ? json : []);
  return list.map((item) => ({
    symbol: item.symbol || item.code || item.ticker || '',
    name: item.name || item.cn_name || item.displayName || '',
    price: parseDoubleSafe(item.price ?? item.last ?? item.close),
    prevClose: parseDoubleSafe(item.prev_close ?? item.pre_close ?? 0),
    high: parseDoubleSafe(item.high),
    low: parseDoubleSafe(item.low),
    open: parseDoubleSafe(item.open),
    volume: parseDoubleSafe(item.volume ?? item.vol),
    amount: parseDoubleSafe(item.amount),
    timestamp: new Date().toISOString(),
  })).filter((m) => m.symbol);
};

const fetchAkshareQuotes = async (symbols = []) => {
  const base = AKSHARE_BASE;
  if (!base || !symbols.length) return [];
  const normalized = base.replace(/\/$/, '');
  const url = new URL(`${normalized}/quotes`);
  url.searchParams.set('symbols', symbols.join(','));
  const resp = await fetch(url.toString(), { headers: buildBrowserHeaders(base) });
  if (!resp.ok) throw new Error('akshare quote error');
  const json = await resp.json();
  const list = Array.isArray(json?.data) ? json.data : [];
  return list.map((item) => ({
    symbol: item.symbol,
    name: item.name || '',
    price: parseDoubleSafe(item.price ?? item.last),
    prevClose: parseDoubleSafe(item.prevClose ?? item.pre_close),
    high: parseDoubleSafe(item.high),
    low: parseDoubleSafe(item.low),
    open: parseDoubleSafe(item.open),
    volume: parseDoubleSafe(item.volume),
    amount: parseDoubleSafe(item.amount),
    timestamp: item.timestamp || new Date().toISOString(),
  })).filter((m) => m.symbol);
};

const fetchAkshareMaster = async () => {
  const base = AKSHARE_BASE;
  if (!base) return [];
  const normalized = base.replace(/\/$/, '');
  const url = `${normalized}/master`;
  const resp = await fetch(url, { headers: buildBrowserHeaders(base) });
  if (!resp.ok) throw new Error('akshare master error');
  const json = await resp.json();
  const list = Array.isArray(json?.data) ? json.data : [];
  const now = new Date().toISOString();
  return list.map((item) => ({
    symbol: item.symbol,
    name: item.name || '',
    price: parseDoubleSafe(item.price ?? 0),
    change: parseDoubleSafe(item.change ?? 0),
    volume: parseDoubleSafe(item.volume ?? 0),
    timestamp: now,
    trend: [],
    market: item.market_id ?? (item.symbol?.startsWith('6') ? 1 : 0),
    changeAmount: 0,
    amount: 0,
    high: 0,
    low: 0,
    open: 0,
    prevClose: 0,
    totalMarketCap: 0,
    floatMarketCap: 0,
    pe: 0,
    pb: 0,
  })).filter((m) => m.symbol);
};

const fetchSseMaster = async () => {
  const pageSize = parseInt(process.env.SSE_PAGE_SIZE || '4000', 10);
  const maxPages = parseInt(process.env.SSE_MAX_PAGES || '10', 10);
  const headers = buildBrowserHeaders('http://www.sse.com.cn/');
  const combined = [];
  for (let page = 1; page <= maxPages; page++) {
    const url = `http://query.sse.com.cn/security/stock/getStockListData2.do?isPagination=true&stockCode=&csrcCode=&areaName=&stockType=1&pageHelp.cacheSize=1&pageHelp.beginPage=1&pageHelp.pageSize=${pageSize}&pageHelp.pageNo=${page}&pageHelp.endPage=${page}&_=${Date.now()}`;
    const resp = await fetch(url, { headers });
    if (!resp.ok) throw new Error(`sse ${resp.status}`);
    const json = await resp.json();
    const rows = Array.isArray(json?.pageHelp?.data) ? json.pageHelp.data : [];
    rows.forEach((row) => {
      const symbol = row.SECURITY_CODE_A;
      const name = row.SECURITY_ABBR_A || row.COMPANY_ABBR;
      if (symbol && name) {
        combined.push({ symbol, name, market: 1 });
      }
    });
    if (rows.length < pageSize) break;
  }
  return combined;
};

const fetchSzseMaster = async () => {
  const pageSize = parseInt(process.env.SZSE_PAGE_SIZE || '4000', 10);
  const maxPages = parseInt(process.env.SZSE_MAX_PAGES || '10', 10);
  const headers = buildBrowserHeaders('https://www.szse.cn/market/stock/list/index.html');
  const combined = [];
  for (let page = 1; page <= maxPages; page++) {
    const url = `https://www.szse.cn/api/report/ShowReport/data?SHOWTYPE=JSON&CATALOGID=1110&TABKEY=tab1&PAGENO=${page}&PAGESIZE=${pageSize}`;
    const resp = await fetch(url, { headers });
    if (!resp.ok) throw new Error(`szse ${resp.status}`);
    const json = await resp.json();
    const rows = Array.isArray(json) && Array.isArray(json[0]?.data) ? json[0].data : [];
    rows.forEach((row) => {
      const symbol = row.agdm;
      const rawName = row.agjc || row.agjc2 || '';
      const name = stripHtml(rawName);
      if (symbol && name) {
        combined.push({ symbol, name, market: 0 });
      }
    });
    if (rows.length < pageSize) break;
  }
  return combined;
};

const fetchSseSzFallback = async () => {
  const now = new Date().toISOString();
  const [sse, szse] = await Promise.all([
    fetchSseMaster().catch(() => []),
    fetchSzseMaster().catch(() => []),
  ]);
  return [...sse, ...szse].map((row) => ({
    symbol: row.symbol,
    market: row.market,
    name: row.name,
    price: 0,
    change: 0,
    changeAmount: 0,
    volume: 0,
    amount: 0,
    high: 0,
    low: 0,
    open: 0,
    prevClose: 0,
    totalMarketCap: 0,
    floatMarketCap: 0,
    pe: 0,
    pb: 0,
    timestamp: now,
    trend: [],
  })).filter((item) => item.symbol && item.name);
};

const fetchQuotesBatch = async (symbols = []) => {
  const unique = Array.from(new Set(symbols.filter(Boolean)));
  if (!unique.length) return [];

  const results = new Map();

  // 1) Akshare 优先批量获取
  try {
    const akQuotes = await fetchAkshareQuotes(unique);
    akQuotes.forEach((q) => results.set(q.symbol, q));
  } catch (e) { }

  // 2) EastMoney 补齐缺失
  const missing1 = unique.filter((s) => !results.has(s));
  for (const sym of missing1) {
    try {
      const q = await fetchEastMoneyQuote(sym);
      if (q) results.set(sym, q);
    } catch (e) {
      continue;
    }
  }

  // 3) Yingwei 批量兜底
  const missing2 = unique.filter((s) => !results.has(s));
  if (missing2.length) {
    try {
      const qs = await fetchYingweiQuotes(missing2);
      qs.forEach((q) => results.set(q.symbol, q));
    } catch (e) { }
  }

  // 4) SSE/SZ 静态补齐（无价格，为0，仅确保存在）
  const missing3 = unique.filter((s) => !results.has(s));
  if (missing3.length) {
    const staticRows = (await fetchSseSzFallback()).filter((r) => missing3.includes(r.symbol));
    staticRows.forEach((r) => results.set(r.symbol, r));
  }

  return Array.from(results.values());
};

const refreshMarketCache = async () => {
  const MAX_PAGES = parseInt(process.env.MARKET_MAX_PAGES || '10', 10);
  const PAGE_SIZE = parseInt(process.env.MARKET_PAGE_SIZE || '4000', 10);
  const combined = [];
  let targetTotal = null;
  for (let i = 1; i <= MAX_PAGES; i++) {
    try {
      const { data, total } = await fetchEastMoneyPage(i, PAGE_SIZE);
      combined.push(...data);
      if (targetTotal === null) targetTotal = total;
      if (data.length < PAGE_SIZE || (targetTotal && combined.length >= targetTotal)) break;
    } catch (e) {
      console.warn('Market fetch page failed', i, e.message);
      break;
    }
  }
  if (combined.length === 0) {
    try {
      const ywData = await fetchYingweiPage(1, PAGE_SIZE, '');
      combined.push(...ywData);
    } catch (e) {
      console.warn('Yingwei fallback failed', e.message);
    }
  }
  marketCache.data = combined;
  marketCache.total = targetTotal || combined.length;
  marketCache.lastUpdated = Date.now();
};

const refreshPrices = async (symbols = []) => {
  if (!symbols.length) return [];
  try {
    const updates = await fetchYingweiPage(1, symbols.length, symbols.join(','));
    return updates;
  } catch (e) {
    console.warn('Price refresh fallback to cached/unchanged', e.message);
    return [];
  }
};

// --- 主表持久化：DB + 本地文件，12 小时过期 ---
const MASTER_TTL_MS = parseInt(process.env.MASTER_TTL_MS || `${12 * 60 * 60 * 1000}`, 10);

const isExpired = (ts) => {
  if (!ts) return true;
  const t = new Date(ts).getTime();
  if (Number.isNaN(t)) return true;
  // 非交易时段直接视为未过期，避免频繁向远程/akshare 刷新主表
  if (!isTradingTimeShanghai()) return false;
  return Date.now() - t > MASTER_TTL_MS;
};

const saveMasterToDb = (rows, lastUpdated) =>
  new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run('BEGIN');
      const stmt = db.prepare(
        `INSERT OR REPLACE INTO a_stock_master (
          code, market_id, name, last, chg_pct, chg, volume, amount, high, low,
          open, pre_close, total_mv, float_mv, pe_dynamic, pb, last_updated
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      );
      rows.forEach((row) => {
        stmt.run([
          row.symbol,
          row.market,
          row.name,
          row.price,
          row.change,
          row.changeAmount,
          row.volume,
          row.amount,
          row.high,
          row.low,
          row.open,
          row.prevClose,
          row.totalMarketCap,
          row.floatMarketCap,
          row.pe,
          row.pb,
          lastUpdated,
        ]);
      });
      stmt.finalize();
      db.run('COMMIT', (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  });

const loadMasterFromDb = (page, pageSize, keyword) =>
  new Promise((resolve, reject) => {
    db.get('SELECT MAX(last_updated) as ts FROM a_stock_master', (err, row) => {
      if (err) return reject(err);
      if (!row || !row.ts) {
        return resolve(null);
      }
      const expired = isExpired(row.ts);
      const offset = (page - 1) * pageSize;
      const like = `%${keyword}%`;
      const where = keyword ? 'WHERE code LIKE ? OR name LIKE ?' : '';
      const params = keyword ? [like, like] : [];
      db.all(
        `SELECT * FROM a_stock_master ${where} ORDER BY code LIMIT ? OFFSET ?`,
        [...params, pageSize, offset],
        (err2, rows) => {
          if (err2) return reject(err2);
          db.get(`SELECT COUNT(*) AS total FROM a_stock_master ${where}`, params, (err3, countRow) => {
            if (err3) return reject(err3);
            const data = rows.map((r) => ({
              symbol: r.code,
              name: r.name,
              price: r.last,
              change: r.chg_pct,
              volume: r.volume,
              timestamp: r.last_updated,
              trend: [],
            }));
            resolve({ data, total: countRow?.total || data.length, lastUpdated: row.ts, expired });
          });
        }
      );
    });
  });

const saveMasterToFile = (rows, lastUpdated) => {
  const payload = { last_updated: lastUpdated, data: rows };
  fs.writeFileSync(masterFilePath, JSON.stringify(payload, null, 2), 'utf8');
};

const loadMasterFromFile = (page, pageSize, keyword) => {
  if (!fs.existsSync(masterFilePath)) return null;
  try {
    const content = fs.readFileSync(masterFilePath, 'utf8');
    const parsed = JSON.parse(content);
    if (!parsed?.last_updated) {
      return null;
    }
    const expired = isExpired(parsed.last_updated);
    const rows = Array.isArray(parsed.data) ? parsed.data : [];
    const filtered = keyword
      ? rows.filter((r) => r.symbol.toLowerCase().includes(keyword) || r.name.toLowerCase().includes(keyword))
      : rows;
    const start = (page - 1) * pageSize;
    const data = filtered.slice(start, start + pageSize).map((r) => ({
      symbol: r.symbol,
      name: r.name,
      price: r.price,
      change: r.change,
      volume: r.volume,
      timestamp: parsed.last_updated,
      trend: [],
    }));
    return { data, total: filtered.length, lastUpdated: parsed.last_updated, raw: rows, expired };
  } catch (e) {
    console.warn('Load master file failed', e.message);
    try {
      fs.unlinkSync(masterFilePath);
    } catch (_) { }
    return null;
  }
};

const fetchAndPersistMaster = async () => {
  const MAX_PAGES = parseInt(process.env.MARKET_MAX_PAGES || '10', 10);
  const PAGE_SIZE = parseInt(process.env.MARKET_PAGE_SIZE || '4000', 10);
  const combined = [];
  let targetTotal = null;

  // 先尝试 Akshare 主表
  let akOk = false;
  try {
    const akData = await fetchAkshareMaster();
    if (akData.length > 0) {
      combined.push(...akData);
      targetTotal = akData.length;
      akOk = true;
    }
  } catch (e) {
    console.warn('fetch akshare master failed', e.message);
  }

  // Akshare 失败时尝试东财 clist
  if (!akOk) {
    try {
      for (let i = 1; i <= MAX_PAGES; i++) {
        const { data, total } = await fetchEastMoneyPage(i, PAGE_SIZE);
        combined.push(...data);
        if (targetTotal === null) targetTotal = total;
        if (data.length < PAGE_SIZE || (targetTotal && combined.length >= targetTotal)) break;
      }
    } catch (e) {
      console.warn('fetch eastmoney failed', e.message);
    }
  }

  // 东财也失败时再尝试英为
  if (combined.length === 0) {
    try {
      const ywData = await fetchYingweiPage(1, PAGE_SIZE, '');
      combined.push(...ywData);
      targetTotal = ywData.length;
    } catch (e) {
      console.warn('fetch yingwei failed', e.message);
    }
  }

  if (combined.length === 0) {
    try {
      const sseSzData = await fetchSseSzFallback();
      if (sseSzData.length > 0) {
        combined.push(...sseSzData);
        targetTotal = sseSzData.length;
      }
    } catch (e) {
      console.warn('fetch sse/sz failed', e.message);
    }
  }

  // 兜底：如果还没有数据，返回空并抛错
  if (combined.length === 0) {
    throw new Error('all remote sources failed');
  }

  const lastUpdated = new Date().toISOString();
  await saveMasterToDb(combined, lastUpdated);
  saveMasterToFile(combined, lastUpdated);
  return { data: combined, total: combined.length, lastUpdated };
};

const getMasterData = async (page, pageSize, keyword) => {
  // 1. DB
  const fromDb = await loadMasterFromDb(page, pageSize, keyword).catch(() => null);
  if (fromDb && fromDb.data.length > 0 && !fromDb.expired) return fromDb;

  // 2. File
  const fromFile = loadMasterFromFile(page, pageSize, keyword);
  if (fromFile && fromFile.data.length > 0 && !fromFile.expired) {
    await saveMasterToDb(fromFile.raw, fromFile.lastUpdated);
    return { data: fromFile.data, total: fromFile.total, lastUpdated: fromFile.lastUpdated };
  }

  // 3. Remote fetch
  try {
    const { data, total, lastUpdated } = await fetchAndPersistMaster();
    const filtered = keyword
      ? data.filter((r) => r.symbol.toLowerCase().includes(keyword) || r.name.toLowerCase().includes(keyword))
      : data;
    const start = (page - 1) * pageSize;
    return {
      data: filtered.slice(start, start + pageSize).map((r) => ({
        symbol: r.symbol,
        name: r.name,
        price: r.price,
        change: r.change,
        volume: r.volume,
        timestamp: lastUpdated,
        trend: [],
      })),
      total: filtered.length,
      lastUpdated,
    };
  } catch (err) {
    // 4. fallback: 过期但有旧数据则返回旧数据
    if (fromDb && fromDb.data.length > 0) {
      return { ...fromDb, expired: true, warning: 'use expired db cache', error: err?.message };
    }
    if (fromFile && fromFile.data.length > 0) {
      return { data: fromFile.data, total: fromFile.total, lastUpdated: fromFile.lastUpdated, expired: true, warning: 'use expired file cache', error: err?.message };
    }
    const message = err?.message || 'fetch failed';
    throw new Error(message);
  }
};

// 主表获取：优先 DB，再本地文件，最后远程拉取，12 小时过期自动重建
app.get('/api/market', async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const pageSize = Math.min(500, parseInt(req.query.pageSize, 10) || 50);
  const keyword = (req.query.q || '').toString().trim().toLowerCase();

  try {
    const result = await getMasterData(page, pageSize, keyword);
    res.json({ success: true, ...result });
  } catch (err) {
    respondError(res, err, 500, 'market/get');
  }
});

// 强制刷新东财主表缓存，便于前端手动触发抓取
app.post('/api/market/refresh', async (_req, res) => {
  try {
    const { data, total, lastUpdated } = await fetchAndPersistMaster();
    res.json({ success: true, total, lastUpdated, data });
  } catch (err) {
    respondError(res, err, 500, 'market/refresh');
  }
});

// 批量实时行情，建议每次 10 条以内
app.post('/api/quotes', async (req, res) => {
  const symbols = Array.isArray(req.body?.symbols) ? req.body.symbols : [];
  if (!symbols.length) return respondError(res, new Error('symbols required'), 400, 'quotes');
  try {
    const data = await fetchQuotesBatch(symbols.slice(0, 100)); // hard cap
    if (!data.length) throw new Error('quote empty');
    res.json({ success: true, data });
  } catch (err) {
    respondError(res, err, 500, 'quotes');
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

// Express 全局兜底错误处理
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  respondError(res, err, 500, 'global');
});
