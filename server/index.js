
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

const isPkg = !!process.pkg;
const appRoot = isPkg ? path.dirname(process.execPath) : __dirname;
const dataDir = process.env.DATA_DIR || appRoot;
fs.mkdirSync(dataDir, { recursive: true });
const dbPath = path.join(dataDir, 'database.sqlite');

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

// --- Routes ---

// Login / Get User
app.post('/api/auth/login', (req, res) => {
  const { username } = req.body;
  db.get('SELECT * FROM users WHERE username = ?', [username], (err, row) => {
    if (err) return res.status(500).json({ success: false, error: err.message });
    if (!row) return res.status(404).json({ success: false, error: 'User not found' });
    res.json({ success: true, data: row });
  });
});

// Register
app.post('/api/auth/register', (req, res) => {
  const { username } = req.body;
  const id = Math.random().toString(36).substr(2, 9);
  
  db.run('INSERT INTO users (id, username) VALUES (?, ?)', [id, username], function(err) {
    if (err) {
      if (err.message.includes('UNIQUE')) return res.status(400).json({ success: false, error: 'Username exists' });
      return res.status(500).json({ success: false, error: err.message });
    }
    res.json({ success: true, data: { id, username } });
  });
});

// Load Workspace
app.get('/api/workspace/:userId', (req, res) => {
  const { userId } = req.params;
  db.get('SELECT data FROM workspaces WHERE user_id = ?', [userId], (err, row) => {
    if (err) return res.status(500).json({ success: false, error: err.message });
    
    if (!row) {
      return res.json({ success: true, data: null }); // No saved workspace yet
    }
    try {
      res.json({ success: true, data: JSON.parse(row.data) });
    } catch (e) {
      res.status(500).json({ success: false, error: 'Corrupt data' });
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
      if (err) return res.status(500).json({ success: false, error: err.message });
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

const marketCache = {
  data: [],
  lastUpdated: 0,
  total: 0
};

const fetchEastMoneyPage = async (page, pageSize) => {
  const fs = process.env.EM_FS || 'm:0+t:6,m:0+t:13,m:0+t:80,m:1+t:2,m:1+t:23';
  const fields = process.env.EM_FIELDS || 'f12,f13,f14,f2,f3,f4,f5,f6,f15,f16,f17,f18,f20,f21,f9,f23';
  const fid = process.env.EM_FID || 'f3';
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0 Safari/537.36',
    'Referer': 'https://quote.eastmoney.com/'
  };

  const baseUrls = [
    'https://push2.eastmoney.com',
    'http://80.push2.eastmoney.com',
    'http://64.push2.eastmoney.com',
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

const refreshMarketCache = async () => {
  const MAX_PAGES = parseInt(process.env.MARKET_MAX_PAGES || '200', 10); // 200*100 覆盖全市场
  const PAGE_SIZE = parseInt(process.env.MARKET_PAGE_SIZE || '100', 10);
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

app.get('/api/market', async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const pageSize = Math.min(500, parseInt(req.query.pageSize, 10) || 50);
  const keyword = (req.query.q || '').toString().trim().toLowerCase();

  const staleMs = parseInt(process.env.MARKET_CACHE_MS || '60000', 10);
  if (marketCache.data.length === 0 || Date.now() - marketCache.lastUpdated > staleMs) {
    try {
      await refreshMarketCache();
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  let list = marketCache.data;
  if (keyword) {
    list = list.filter(m => m.symbol.toLowerCase().includes(keyword) || m.name.toLowerCase().includes(keyword));
  }

  const total = keyword ? list.length : (marketCache.total || list.length);
  const start = (page - 1) * pageSize;
  const paged = list.slice(start, start + pageSize);

  res.json({ success: true, data: paged, total, lastUpdated: marketCache.lastUpdated });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
