
import { MarketData } from "../types";

const API_BASE = import.meta.env.VITE_API_BASE || "http://127.0.0.1:38211/api";
const YW_API = import.meta.env.VITE_YW_API || "";
const IS_TAURI = typeof window !== 'undefined' && !!(window as any).__TAURI_IPC__;
// 默认强制走后端，只有显式设置 VITE_FORCE_BACKEND=false 才允许直接走前端/东财
const FORCE_BACKEND = import.meta.env.VITE_FORCE_BACKEND !== 'false' || IS_TAURI;

// --- Fallback / Simulation Configuration ---

const MOCK_STOCKS = [
    { symbol: "600519", name: "贵州茅台", price: 1650.00, volatility: 0.012 },
    { symbol: "300750", name: "宁德时代", price: 180.50, volatility: 0.022 },
    { symbol: "000001", name: "平安银行", price: 10.30, volatility: 0.008 },
    { symbol: "601127", name: "赛力斯", price: 92.00, volatility: 0.035 },
    { symbol: "601318", name: "中国平安", price: 42.50, volatility: 0.011 },
    { symbol: "002594", name: "比亚迪", price: 210.20, volatility: 0.018 },
    { symbol: "600036", name: "招商银行", price: 31.80, volatility: 0.009 },
    { symbol: "600900", name: "长江电力", price: 24.50, volatility: 0.005 },
    { symbol: "000858", name: "五粮液", price: 145.30, volatility: 0.015 },
    { symbol: "603259", name: "药明康德", price: 52.40, volatility: 0.025 },
    { symbol: "300059", name: "东方财富", price: 13.20, volatility: 0.028 },
    { symbol: "601888", name: "中国中免", price: 78.60, volatility: 0.019 },
    { symbol: "600276", name: "恒瑞医药", price: 45.10, volatility: 0.014 },
    { symbol: "000333", name: "美的集团", price: 63.50, volatility: 0.012 },
    { symbol: "601012", name: "隆基绿能", price: 18.90, volatility: 0.032 },
];

let mockState: Map<string, MarketData> = new Map();

// Initialize Mock State
MOCK_STOCKS.forEach(stock => {
    mockState.set(stock.symbol, {
        symbol: stock.symbol,
        name: stock.name,
        price: stock.price,
        change: 0,
        volume: Math.floor(Math.random() * 1000000),
        timestamp: new Date().toISOString(),
        trend: Array(20).fill(stock.price),
    });
});

// --- Real Data Logic (East Money / Oriental Fortune) ---

const trendCache: Map<string, number[]> = new Map();

const parseDoubleSafe = (val: any): number => {
    if (val === '-' || val === null || val === undefined || val === '') return 0;
    const num = parseFloat(val);
    return isNaN(num) ? 0 : num;
};

const stripHtml = (val: string) => val.replace(/<[^>]*>/g, '');

type MarketResponse = {
    success: boolean;
    data: MarketData[];
    total?: number;
};

const mapQuoteToMarketData = (item: any): MarketData => ({
    symbol: item.symbol,
    name: item.name || '',
    price: parseDoubleSafe(item.price),
    change: parseDoubleSafe(item.change ?? item.chg_pct ?? ((item.price && item.prevClose) ? ((item.price - item.prevClose) / item.prevClose) * 100 : 0)),
    volume: parseDoubleSafe(item.volume),
    timestamp: item.timestamp || new Date().toISOString(),
    trend: item.trend || []
});

export const triggerBackendRefresh = async (): Promise<{ success: boolean; total?: number; lastUpdated?: number }> => {
    const url = `${API_BASE}/market/refresh`;
    console.info("[market] trigger backend refresh", { url });
    const res = await fetch(url, { method: 'POST' });
    if (!res.ok) throw new Error('后端刷新失败');
    return res.json();
};

export const fetchBatchQuotes = async (symbols: string[]): Promise<MarketData[]> => {
    if (!symbols || symbols.length === 0) return [];
    const url = `${API_BASE}/quotes`;
    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ symbols })
        });
        if (!res.ok) throw new Error('backend quotes not ok');
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
            return json.data.map(mapQuoteToMarketData);
        }
    } catch (e) {
        console.warn('Backend quotes failed', e);
        throw e;
    }
    return [];
};

import { MarketData, KLineData } from "../types";

// ... existing code ...

export const fetchStockHistory = async (symbol: string, days: number = 20): Promise<KLineData[]> => {
    if (!symbol) return [];
    // Only backend has history for now
    const url = `${API_BASE}/history?symbol=${symbol}&days=${days}`;
    try {
        const res = await fetch(url);
        if (!res.ok) throw new Error('Backend history fetch failed');
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
            return json.data as KLineData[];
        }
    } catch (e) {
        console.warn('History fetch failed', e);
    }
    return [];
};

const fetchBackendMarketData = async (page: number, pageSize: number, keyword: string): Promise<MarketResponse | null> => {
    try {
        const url = new URL(`${API_BASE}/market`);
        url.searchParams.set('page', String(page));
        url.searchParams.set('pageSize', String(pageSize));
        if (keyword) url.searchParams.set('q', keyword);

        console.info("[market] 请求后端市场数据", { url: url.toString(), page, pageSize, keyword });
        const res = await fetch(url.toString(), { cache: "no-store" });
        if (!res.ok) throw new Error('backend market response not ok');
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
            return json as MarketResponse;
        }
    } catch (e) {
        console.warn('Backend market fetch failed, fallback to direct source', e);
        if (FORCE_BACKEND) {
            // 强制依赖后端时直接抛出，交由上层提示问题
            throw e;
        }
    }
    return null;
};

const fetchEastMoneyData = async (page: number, pageSize: number, keyword: string): Promise<MarketResponse> => {
    const fs = import.meta.env.VITE_EM_FS || 'm:0+t:6,m:0+t:13,m:0+t:80,m:1+t:2,m:1+t:23';
    const fields = import.meta.env.VITE_EM_FIELDS || 'f12,f13,f14,f2,f3,f4,f5,f6,f15,f16,f17,f18,f20,f21,f9,f23';
    const fid = import.meta.env.VITE_EM_FID || 'f3';
    const bases = [
        'https://push2.eastmoney.com',
        'http://80.push2.eastmoney.com',
        'http://64.push2.eastmoney.com',
        'http://82.push2.eastmoney.com',
    ];

    let lastErr: any = null;
    for (const base of bases) {
        const targetUrl = `${base}/api/qt/clist/get?pn=${page}&pz=${pageSize}&po=1&np=1&ut=bd1d9ddb04089700cf9c27f6f7426281&fltt=2&invt=2&fid=${fid}&fs=${encodeURIComponent(fs)}&fields=${encodeURIComponent(fields)}`;
        try {
            const res = await fetch(targetUrl);
            if (!res.ok) {
                lastErr = new Error(`EastMoney ${res.status}`);
                continue;
            }
            const data = await res.json();
            if (!data?.data?.diff) throw new Error("Invalid API Response Structure");

            const list = Array.isArray(data.data.diff) ? data.data.diff : Object.values(data.data.diff);

            let mapped = list.map((item: any) => {
                const symbol = item.f12;
                const price = parseDoubleSafe(item.f2);

                let trend = trendCache.get(symbol) || [];
                if (price > 0) {
                    trend = [...trend, price];
                    if (trend.length > 30) trend = trend.slice(-30);
                } else {
                    const last = trend.length > 0 ? trend[trend.length - 1] : 0;
                    trend = [...trend, last];
                }
                trendCache.set(symbol, trend);

                const mkData = {
                    symbol: item.f12,
                    name: item.f14,
                    price: price,
                    change: parseDoubleSafe(item.f3),
                    volume: parseDoubleSafe(item.f5),
                    timestamp: new Date().toISOString(),
                    trend: trend
                };

                mockState.set(symbol, mkData);
                return mkData;
            });

            if (keyword) {
                const key = keyword.toLowerCase();
                mapped = mapped.filter((m: MarketData) => m.symbol.toLowerCase().includes(key) || m.name.toLowerCase().includes(key));
            }

            const total = data?.data?.total ? parseInt(data.data.total, 10) : mapped.length;
            return { success: true, data: mapped, total };
        } catch (e: any) {
            lastErr = e;
            continue;
        }
    }
    throw lastErr || new Error("EastMoney Network Error");
};

const fetchYingweiData = async (page: number, pageSize: number, keyword: string): Promise<MarketResponse> => {
    if (!YW_API) throw new Error("YW_API not configured");
    const url = new URL(YW_API);
    url.searchParams.set('page', String(page));
    url.searchParams.set('pageSize', String(pageSize));
    if (keyword) url.searchParams.set('q', keyword);

    const res = await fetch(url.toString());
    if (!res.ok) throw new Error("Yingwei Network Error");
    const json = await res.json();
    const list = Array.isArray(json?.data) ? json.data : (Array.isArray(json) ? json : []);
    const mapped = list.map((item: any) => ({
        symbol: item.symbol || item.code || item.ticker || '',
        name: item.name || item.cn_name || item.displayName || '',
        price: parseDoubleSafe(item.price ?? item.last ?? item.close),
        change: parseDoubleSafe(item.change ?? item.chg ?? item.pct_chg),
        volume: parseDoubleSafe(item.volume ?? item.vol),
        timestamp: new Date().toISOString(),
        trend: []
    })).filter((m: MarketData) => m.symbol && m.name);

    if (keyword) {
        const key = keyword.toLowerCase();
        return {
            success: true,
            data: mapped.filter((m: MarketData) => m.symbol.toLowerCase().includes(key) || m.name.toLowerCase().includes(key)),
            total: mapped.length
        };
    }
    return { success: true, data: mapped, total: mapped.length };
};

const normalizeExchangeFallback = (symbol: string, name: string): MarketData => ({
    symbol,
    name,
    price: 0,
    change: 0,
    volume: 0,
    timestamp: new Date().toISOString(),
    trend: []
});

const fetchSseList = async (): Promise<MarketData[]> => {
    const pageSize = Number(import.meta.env.VITE_SSE_PAGE_SIZE || '4000');
    const maxPages = Number(import.meta.env.VITE_SSE_MAX_PAGES || '10');
    const headers = {
        'User-Agent': 'Mozilla/5.0',
        'Referer': 'http://www.sse.com.cn/',
        'Accept': 'application/json',
    };
    const combined: MarketData[] = [];
    for (let page = 1; page <= maxPages; page++) {
        const url = `http://query.sse.com.cn/security/stock/getStockListData2.do?isPagination=true&stockCode=&csrcCode=&areaName=&stockType=1&pageHelp.cacheSize=1&pageHelp.beginPage=1&pageHelp.pageSize=${pageSize}&pageHelp.pageNo=${page}&pageHelp.endPage=${page}&_=${Date.now()}`;
        const res = await fetch(url, { headers });
        if (!res.ok) throw new Error(`SSE ${res.status}`);
        const json = await res.json();
        const rows = Array.isArray((json as any)?.pageHelp?.data) ? (json as any).pageHelp.data : [];
        rows.forEach((row: any) => {
            const symbol = row.SECURITY_CODE_A;
            const name = row.SECURITY_ABBR_A || row.COMPANY_ABBR;
            if (symbol && name) combined.push(normalizeExchangeFallback(symbol, name));
        });
        if (rows.length < pageSize) break;
    }
    return combined;
};

const fetchSzseList = async (): Promise<MarketData[]> => {
    const pageSize = Number(import.meta.env.VITE_SZSE_PAGE_SIZE || '4000');
    const maxPages = Number(import.meta.env.VITE_SZSE_MAX_PAGES || '10');
    const headers = {
        'User-Agent': 'Mozilla/5.0',
        'Referer': 'https://www.szse.cn/market/stock/list/index.html',
        'Accept': 'application/json,text/javascript,*/*;q=0.01',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
    };
    const combined: MarketData[] = [];
    for (let page = 1; page <= maxPages; page++) {
        const url = `https://www.szse.cn/api/report/ShowReport/data?SHOWTYPE=JSON&CATALOGID=1110&TABKEY=tab1&PAGENO=${page}&PAGESIZE=${pageSize}`;
        const res = await fetch(url, { headers });
        if (!res.ok) throw new Error(`SZSE ${res.status}`);
        const json = await res.json();
        const rows = Array.isArray(json) && Array.isArray((json as any)[0]?.data) ? (json as any)[0].data : [];
        rows.forEach((row: any) => {
            const symbol = row.agdm;
            const rawName = row.agjc || row.agjc2 || '';
            const name = stripHtml(rawName);
            if (symbol && name) combined.push(normalizeExchangeFallback(symbol, name));
        });
        if (rows.length < pageSize) break;
    }
    return combined;
};

const fetchSseSzFallback = async (page: number, pageSize: number, keyword: string): Promise<MarketResponse> => {
    const [sse, szse] = await Promise.all([
        fetchSseList().catch(() => []),
        fetchSzseList().catch(() => [])
    ]);
    let combined: MarketData[] = [...sse, ...szse];
    if (keyword) {
        const key = keyword.toLowerCase();
        combined = combined.filter((m) => m.symbol.toLowerCase().includes(key) || m.name.toLowerCase().includes(key));
    }
    const start = (page - 1) * pageSize;
    return { success: true, data: combined.slice(start, start + pageSize), total: combined.length };
};

const fetchMockUpdate = async (): Promise<MarketData[]> => {
    await new Promise(resolve => setTimeout(resolve, 100));

    const newData: MarketData[] = [];

    mockState.forEach((data, symbol) => {
        const base = MOCK_STOCKS.find(s => s.symbol === symbol);
        const vol = base ? base.volatility : 0.02;

        // Random Walk
        const move = (Math.random() - 0.5) * 2 * vol;
        let newPrice = data.price * (1 + move);
        newPrice = Math.max(0.01, newPrice);

        let newTrend = [...data.trend, newPrice];
        if (newTrend.length > 30) newTrend = newTrend.slice(-30);

        const updated: MarketData = {
            ...data,
            price: newPrice,
            change: base ? ((newPrice - base.price) / base.price) * 100 : 0,
            timestamp: new Date().toISOString(),
            trend: newTrend
        };

        mockState.set(symbol, updated);
        newData.push(updated);
    });
    return newData;
};

// High frequency update for specific pool stocks
export const updateSpecificStocks = async (symbols: string[]): Promise<MarketData[]> => {
    if (!symbols.length) return [];
    const chunks: string[][] = [];
    const size = 50;
    for (let i = 0; i < symbols.length; i += size) {
        chunks.push(symbols.slice(i, i + size));
    }

    const all: MarketData[] = [];
    for (const chunk of chunks) {
        try {
            const part = await fetchBatchQuotes(chunk);
            all.push(...part);
        } catch (e) {
            console.warn('Chunk quote failed', e);
        }
    }
    return all;
};

export const fetchMarketData = async (page = 1, pageSize = 4000, keyword = ''): Promise<MarketResponse> => {
    console.info("[market] fetchMarketData start", { page, pageSize, keyword, API_BASE, FORCE_BACKEND });
    const backendData = await fetchBackendMarketData(page, pageSize, keyword);
    if (backendData) return backendData;

    try {
        return await fetchEastMoneyData(page, pageSize, keyword);
    } catch (e) {
        // First fallback: Yingwei (require VITE_YW_API)
        try {
            return await fetchYingweiData(page, pageSize, keyword);
        } catch (_) {
            // continue
        }

        // Second fallback: SSE/SZ exchange master list (no price; code/name only)
        try {
            const sseSz = await fetchSseSzFallback(page, pageSize, keyword);
            if (sseSz.data.length > 0) return sseSz;
        } catch (_) {
            // continue
        }

        // Third fallback: multi-page EastMoney scrape to cover gaps
        const maxPages = 10;
        const combined: MarketData[] = [];
        for (let i = 1; i <= maxPages; i++) {
            try {
                const pageResp = await fetchEastMoneyData(i, pageSize, keyword);
                combined.push(...pageResp.data);
                if (pageResp.data.length < pageSize) break;
            } catch (_) {
                break;
            }
        }
        if (combined.length === 0) {
            throw e;
        }
        const start = (page - 1) * pageSize;
        return { success: true, data: combined.slice(start, start + pageSize), total: combined.length };
    }
};

export const resetMarketService = () => {
    MOCK_STOCKS.forEach(stock => {
        mockState.set(stock.symbol, {
            symbol: stock.symbol,
            name: stock.name,
            price: stock.price,
            change: 0,
            volume: 0,
            timestamp: new Date().toISOString(),
            trend: Array(20).fill(stock.price),
        });
    });
    trendCache.clear();
};
