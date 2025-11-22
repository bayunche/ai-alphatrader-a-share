
import { MarketData } from "../types";

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

const fetchEastMoneyData = async (): Promise<MarketData[]> => {
    // East Money Main Board Interface：调大 pz 以覆盖更多证券做“主表”来源
    const pageSize = 200;
    const targetUrl = `https://push2.eastmoney.com/api/qt/clist/get?pn=1&pz=${pageSize}&po=1&np=1&ut=bd1d9ddb04089700cf9c27f6f7426281&fltt=2&invt=2&fid=f20&fs=m:0+t:6,m:0+t:80,m:1+t:2,m:1+t:23&fields=f12,f14,f2,f3,f5`;
    const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(targetUrl)}`;

    const res = await fetch(proxyUrl);
    if (!res.ok) throw new Error("Proxy Network Error");
    
    const json = await res.json();
    const data = JSON.parse(json.contents);
    
    if (!data?.data?.diff) throw new Error("Invalid API Response Structure");

    const list = Array.isArray(data.data.diff) ? data.data.diff : Object.values(data.data.diff);

    return list.map((item: any) => {
        const symbol = item.f12;
        const price = parseDoubleSafe(item.f2);
        
        let trend = trendCache.get(symbol) || [];
        if (price > 0) {
            trend = [...trend, price];
            if (trend.length > 30) trend = trend.slice(-30);
        } else {
            // Suspended or invalid data, extend previous value
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
        
        // Sync with mock state for retrieval by specific updaters
        mockState.set(symbol, mkData);
        
        return mkData;
    });
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
    const updates: MarketData[] = [];
    
    // For simulation, we apply a random volatility update to the cached state of these symbols.
    // In a real scenario with a paid API, we would batch request these symbols.
    
    for (const sym of symbols) {
        let data = mockState.get(sym);
        
        // If stock doesn't exist in cache, create a mock entry
        if (!data) {
            data = {
                symbol: sym,
                name: `Stock-${sym}`, // Placeholder name
                price: 10 + Math.random() * 50,
                change: 0,
                volume: 10000,
                timestamp: new Date().toISOString(),
                trend: Array(20).fill(10)
            };
            mockState.set(sym, data);
        }

        // Fast volatile update
        const vol = 0.005; // Lower volatility for high freq updates
        const move = (Math.random() - 0.5) * 2 * vol;
        const newPrice = data.price * (1 + move);
        
        let newTrend = [...data.trend, newPrice];
        if (newTrend.length > 30) newTrend = newTrend.slice(-30);

        const updated: MarketData = {
            ...data,
            price: newPrice,
            timestamp: new Date().toISOString(),
            trend: newTrend
        };
        
        mockState.set(sym, updated);
        updates.push(updated);
    }
    
    return updates;
};

export const fetchMarketData = async (): Promise<MarketData[]> => {
    try {
        return await fetchEastMoneyData();
    } catch (e) {
        // Silent fallback
        return await fetchMockUpdate();
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
