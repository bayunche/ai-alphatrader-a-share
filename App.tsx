import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Sidebar } from './components/Sidebar';
import {
    MarketData, TradeExecution, LogEntry,
    TradeAction, BrokerConfig, TradingAgent, StockPool, NotificationConfig, PortfolioState, AgentHealthMap, AIDecisionRecord
} from './types';
import { fetchMarketData, fetchBatchQuotes, updateSpecificStocks, fetchStockHistory, resetMarketService, triggerBackendRefresh } from './services/marketService';
import { analyzeMarket } from './services/geminiService';
import { dataApi } from './services/api';
import { sendNotification } from './services/notificationService';
import { EquityChart, StockTrendChart } from './components/Charts';
import { SettingsView } from './components/SettingsView';
import { FundManagement } from './components/FundManagement';
import { AuthView } from './components/AuthView';
import { DecisionLogView } from './components/DecisionLogView';
import { PositionsTable } from './components/PositionsTable';
import { PortfolioView } from './components/PortfolioView';
import { AboutView } from './components/AboutView';
import { useAuth } from './contexts/AuthContext';
import {
    Play, Pause, FileDown, Search, Zap, Menu, Eye
} from 'lucide-react';
// @ts-ignore
import { writeTextFile } from '@tauri-apps/api/fs';
// @ts-ignore
import { save } from '@tauri-apps/api/dialog';
import { useTranslation } from './contexts/LanguageContext';
import { checkModelAvailability, checkBrokerAvailability, HealthStatus } from './services/healthService';

const getShanghaiNow = () => {
    // 强制使用沪深时区，避免宿主机时区为 UTC 等导致交易时段误判
    return new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Shanghai' }));
};

const isTradingTimeNow = () => {
    const now = getShanghaiNow();
    const day = now.getDay();
    if (day === 0 || day === 6) return false; // 周末休市，直接返回 false
    const minutes = now.getHours() * 60 + now.getMinutes();
    const morning = minutes >= (9 * 60 + 30) && minutes < (11 * 60 + 30);
    const afternoon = minutes >= (13 * 60) && minutes < (15 * 60);
    return morning || afternoon;
};

function App() {
    const { user } = useAuth();
    const { t, language } = useTranslation();
    const [activeTab, setActiveTab] = useState('dashboard');
    const [globalRunning, setGlobalRunning] = useState(false);
    const [isDataLoaded, setIsDataLoaded] = useState(false);

    // Mobile Sidebar State
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    const [agents, setAgents] = useState<TradingAgent[]>([]);
    const [stockPools, setStockPools] = useState<StockPool[]>([]);
    const [notificationConfig, setNotificationConfig] = useState<NotificationConfig>({ enabled: false });

    // Chart View Filter: 'SYSTEM' or poolId
    const [chartView, setChartView] = useState<string>('SYSTEM');
    const [agentHealth, setAgentHealth] = useState<AgentHealthMap>({});
    const [marketHealthy, setMarketHealthy] = useState(true);
    const [marketError, setMarketError] = useState<string>('');
    const tradingSuspendedRef = useRef(false); // 行情异常时暂停 AI/交易
    const riskConfigRef = useRef({
        maxPositionPct: 60,      // 单标的最大持仓占总权益比例
        maxOrderPct: 20,         // 单次下单最大现金比例
        slippageBps: 10,         // 滑点（基点）
        limitTolerancePct: 1.0   // 超过该偏离则放弃成交
    });
    const [brokerHealth, setBrokerHealth] = useState<HealthStatus>({ ok: true });

    // Keep a ref of agents to access latest state inside async intervals without triggering re-renders
    const agentsRef = useRef(agents);
    useEffect(() => {
        agentsRef.current = agents;
    }, [agents]);
    const evaluateAgentsHealth = useCallback(async (list: TradingAgent[]) => {
        if (!list || list.length === 0) {
            setAgentHealth({});
            return;
        }
        const result: AgentHealthMap = {};
        for (const ag of list) {
            try {
                const status = await checkModelAvailability(ag.config);
                result[ag.id] = status;
            } catch (e: any) {
                result[ag.id] = { ok: false, reason: e?.message || '检测失败' };
            }
        }
        setAgentHealth(result);
    }, []);

    useEffect(() => {
        evaluateAgentsHealth(agents);
    }, [agents, evaluateAgentsHealth]);

    const globalRunningRef = useRef(globalRunning);
    useEffect(() => {
        globalRunningRef.current = globalRunning;
    }, [globalRunning]);

    const notifyRef = useRef(notificationConfig);
    useEffect(() => { notifyRef.current = notificationConfig; }, [notificationConfig]);


    const checkBrokerHealth = useCallback(async (config: BrokerConfig) => {
        if (config.mode !== 'real') {
            setBrokerHealth({ ok: true });
            return { ok: true };
        }
        const status = await checkBrokerAvailability(config);
        setBrokerHealth(status);
        return status;
    }, []);

    const [brokerConfig, setBrokerConfig] = useState<BrokerConfig>({
        mode: 'sandbox',
        brokerName: 'Mock Securities',
        endpoint: 'https://api.mock-broker.com/v1'
    });
    useEffect(() => { checkBrokerHealth(brokerConfig); }, [brokerConfig, checkBrokerHealth]);

    const [marketData, setMarketData] = useState<MarketData[]>([]);
    const [marketSearch, setMarketSearch] = useState('');
    const [marketPage, setMarketPage] = useState(1);
    const [marketRefreshLoading, setMarketRefreshLoading] = useState(false);
    const pageSize = 50;
    const [tradeHistory, setTradeHistory] = useState<TradeExecution[]>([]);
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [decisionHistory, setDecisionHistory] = useState<AIDecisionRecord[]>([]);
    const tradingWindowRef = useRef<boolean>(false);
    const nonTradingSnapshotRef = useRef(false); // 非交易时段是否已做过一次拉取
    const lastNonTradingKeywordRef = useRef<string>(''); // 非交易时段最后一次搜索关键字
    const unauthLoggedRef = useRef(false); // 未登录提示是否已记录

    const logsEndRef = useRef<HTMLDivElement>(null);

    // -- DATA PERSISTENCE & ISOLATION --
    useEffect(() => {
        if (!user) return;

        setIsDataLoaded(false);
        setGlobalRunning(false);

        const loadData = async () => {
            const workspace = await dataApi.loadWorkspace(user.id);

            if (workspace) {
                setAgents(workspace.agents);
                setTradeHistory(workspace.tradeHistory);
                setLogs(workspace.logs);
                setStockPools(workspace.stockPools);
                if (workspace.notificationConfig) {
                    setNotificationConfig(workspace.notificationConfig);
                }
                if (workspace.decisionHistory) {
                    setDecisionHistory(workspace.decisionHistory);
                }
            } else {
                setAgents([{
                    id: 'default_1',
                    name: 'Gemini Flash Alpha',
                    color: '#ffffff',
                    isRunning: false,
                    config: { provider: 'GEMINI', modelName: 'gemini-2.5-flash', apiEndpoint: '' },
                    portfolio: {
                        cash: 1000000, frozenCash: 0, totalEquity: 1000000, positions: [],
                        equityHistory: [{ timestamp: new Date().toISOString(), equity: 1000000 }]
                    }
                }]);
                setStockPools([]);
                setTradeHistory([]);
                setLogs([]);
                setDecisionHistory([]);
                setNotificationConfig({ enabled: false });
            }
            setIsDataLoaded(true);
        };

        loadData();

    }, [user]);

    // 全局错误捕获：包含未捕获异常与未处理的 Promise 拒绝（外部接口/后端等）
    useEffect(() => {
        const onError = (event: ErrorEvent) => {
            console.error('Global Error', event.error || event.message);
            alert(`发生错误：${event.message || '未知错误'} `);
        };
        const onRejection = (event: PromiseRejectionEvent) => {
            console.error('Unhandled Rejection', event.reason);
            alert(`请求失败：${event.reason?.message || event.reason || '未知原因'} `);
        };
        window.addEventListener('error', onError);
        window.addEventListener('unhandledrejection', onRejection);
        return () => {
            window.removeEventListener('error', onError);
            window.removeEventListener('unhandledrejection', onRejection);
        };
    }, []);

    useEffect(() => {
        if (!user || !isDataLoaded) return;

        const timeout = setTimeout(() => {
            dataApi.saveWorkspace(user.id, {
                agents,
                tradeHistory,
                logs,
                stockPools,
                notificationConfig,
                decisionHistory,
                lastUpdated: new Date().toISOString()
            });
        }, 2000);

        return () => clearTimeout(timeout);
    }, [agents, tradeHistory, logs, stockPools, notificationConfig, decisionHistory, user, isDataLoaded]);

    const addDecision = useCallback((record: AIDecisionRecord) => {
        setDecisionHistory(prev => {
            // Keep last 1000 decisions to prevent memory bloat
            const newState = [record, ...prev].slice(0, 1000);
            return newState;
        });
    }, []);


    const addLog = useCallback((type: LogEntry['type'], message: string, agentId?: string, details?: any) => {
        setLogs(prev => {
            const newLogs = [...prev, {
                id: Math.random().toString(36).substr(2, 9),
                agentId,
                timestamp: new Date().toISOString(),
                type,
                message,
                details
            }];
            return newLogs.slice(-300);
        });
    }, []);

    useEffect(() => {
        if (activeTab === 'dashboard' || activeTab === 'logs') {
            logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [logs, activeTab]);

    // -- Trading Execution Logic --
    const executeTradeForAgent = useCallback(async (
        agentId: string,
        symbol: string,
        action: TradeAction,
        quantityPct: number,
        reason: string,
        price: number,
        confidence: number,
        strategyName: string
    ) => {
        if (tradingSuspendedRef.current || !marketHealthy) {
            addLog('SYSTEM', '行情异常，已暂停交易', agentId);
            return;
        }
        if (action === TradeAction.HOLD || quantityPct <= 0 || price <= 0) return;
        const risk = riskConfigRef.current;

        const timestamp = new Date().toISOString();
        let actualQuantity = 0;
        let tradeAmount = 0;
        let status: TradeExecution['status'] = 'FILLED';

        if (brokerConfig.mode === 'real') {
            addLog('BROKER', `[${agentId}] Sending ${action} ${symbol}...`, agentId);
            await new Promise(resolve => setTimeout(resolve, 500));
            if (Math.random() < 0.05) {
                status = 'REJECTED';
                addLog('ERROR', `Broker Rejected Order for ${agentId}`, agentId);
            }
        }

        if (status === 'REJECTED') return;

        setAgents(prevAgents => prevAgents.map(agent => {
            if (agent.id !== agentId) return agent;

            let newCash = agent.portfolio.cash;
            let newPositions = [...agent.portfolio.positions];
            const agentName = agent.name;
            const totalEquityNow = agent.portfolio.totalEquity || (agent.portfolio.cash + agent.portfolio.positions.reduce((acc, p) => acc + p.marketValue, 0));
            const maxPositionValue = (totalEquityNow * risk.maxPositionPct) / 100;
            const maxOrderValue = (totalEquityNow * risk.maxOrderPct) / 100;
            const slippageFactor = action === TradeAction.BUY ? (1 + risk.slippageBps / 10000) : (1 - risk.slippageBps / 10000);
            const execPrice = price * slippageFactor;
            const driftPct = Math.abs(execPrice - price) / Math.max(price, 1e-6) * 100;
            if (driftPct > risk.limitTolerancePct) {
                addLog('TRADE', `滑点超限，放弃成交 ${symbol} `, agentId);
                return agent;
            }

            if (action === TradeAction.BUY) {
                const currentPosValue = newPositions.find(p => p.symbol === symbol)?.marketValue || 0;
                const allowedValue = Math.max(0, Math.min(maxOrderValue, maxPositionValue - currentPosValue, newCash));
                const targetValue = allowedValue * (quantityPct / 100);
                const amountToSpend = Math.min(allowedValue, targetValue);
                const rawQuantity = Math.floor(amountToSpend / execPrice / 100) * 100;

                if (rawQuantity < 100) return agent;

                actualQuantity = rawQuantity;
                tradeAmount = actualQuantity * execPrice;
                newCash -= tradeAmount;

                const existingPosIndex = newPositions.findIndex(p => p.symbol === symbol);
                if (existingPosIndex >= 0) {
                    const pos = newPositions[existingPosIndex];
                    const totalCost = (pos.averageCost * pos.quantity) + tradeAmount;
                    const totalQty = pos.quantity + actualQuantity;
                    newPositions[existingPosIndex] = {
                        ...pos,
                        quantity: totalQty,
                        averageCost: totalCost / totalQty,
                        currentPrice: execPrice,
                        marketValue: totalQty * execPrice,
                        pnl: (execPrice - (totalCost / totalQty)) * totalQty,
                        pnlPercentage: 0
                    };
                } else {
                    newPositions.push({
                        symbol, quantity: actualQuantity, averageCost: execPrice, currentPrice: execPrice,
                        marketValue: tradeAmount, pnl: 0, pnlPercentage: 0
                    });
                }
            } else if (action === TradeAction.SELL) {
                const existingPosIndex = newPositions.findIndex(p => p.symbol === symbol);
                if (existingPosIndex === -1) return agent;

                const pos = newPositions[existingPosIndex];
                let rawSellQty = Math.floor(pos.quantity * (quantityPct / 100));
                if (rawSellQty < 100 && pos.quantity >= 100) rawSellQty = 100;
                if (rawSellQty > pos.quantity) rawSellQty = pos.quantity;
                if (rawSellQty === 0) return agent;

                actualQuantity = rawSellQty;
                tradeAmount = actualQuantity * execPrice;
                newCash += tradeAmount;

                if (actualQuantity === pos.quantity) {
                    newPositions.splice(existingPosIndex, 1);
                } else {
                    newPositions[existingPosIndex] = {
                        ...pos,
                        quantity: pos.quantity - actualQuantity,
                        marketValue: (pos.quantity - actualQuantity) * price
                    };
                }
            }

            const totalEquity = newCash + newPositions.reduce((acc, p) => acc + (p.marketValue || p.quantity * execPrice), 0);

            const newTrade: TradeExecution = {
                id: Math.random().toString(36).substr(2, 9),
                agentId: agent.id, agentName,
                timestamp, symbol, action, price: execPrice,
                quantity: actualQuantity, totalAmount: tradeAmount,
                status, strategyId: strategyName, reason, confidence
            };

            setTradeHistory(prevHist => [newTrade, ...prevHist]);
            addLog('TRADE', `${agentName}: ${action} ${actualQuantity} ${symbol} `, agentId);

            // Notification Trigger
            if (notifyRef.current.enabled) {
                sendNotification(notifyRef.current, newTrade).then(() => {
                    addLog('NOTIFY', `Alert sent for ${symbol}`, agentId);
                });
            }

            return {
                ...agent,
                portfolio: {
                    ...agent.portfolio,
                    cash: newCash,
                    positions: newPositions,
                    totalEquity,
                    equityHistory: [...agent.portfolio.equityHistory, { timestamp, equity: totalEquity }]
                }
            };
        }));

    }, [brokerConfig, addLog]);


    // -- Run Analysis Helper --
    const runAIAnalysis = useCallback((stocks: MarketData[], targetAgents: TradingAgent[]) => {
        if (!globalRunningRef.current || tradingSuspendedRef.current || !marketHealthy) return;
        if (stocks.length === 0 || targetAgents.length === 0) return;

        stocks.forEach((stock, idx) => {
            // Sequential delay to prevent burst
            setTimeout(async () => {
                // Fetch History Context Concurrently (Optional but recommended)
                let history: any[] = [];
                try {
                    history = await fetchStockHistory(stock.symbol, 10);
                } catch (e) {
                    console.warn(`Failed to fetch history for ${stock.symbol}`, e);
                }

                targetAgents.forEach(agent => {
                    if (!agent.isRunning) return;
                    const health = agentHealth[agent.id];
                    if (health && !health.ok) {
                        addLog('ERROR', `${agent.name} 模型不可用：${health.reason || ''} `, agent.id);
                        return;
                    }

                    // Pass history to analyzeMarket
                    analyzeMarket(stock, agent.portfolio, agent.config, language, history).then(decision => {
                        // Record ALL decisions (BUY/SELL/HOLD)
                        const record: AIDecisionRecord = {
                            id: Math.random().toString(36).substr(2, 9),
                            agentId: agent.id,
                            agentName: agent.name,
                            symbol: stock.symbol,
                            timestamp: new Date().toISOString(),
                            action: decision.action,
                            reasoning: decision.reasoning,
                            confidence: decision.confidence,
                            strategyName: decision.strategyName,
                            priceAtTime: stock.price
                        };
                        addDecision(record);

                        if (decision.action !== TradeAction.HOLD) {
                            executeTradeForAgent(
                                agent.id,
                                stock.symbol,
                                decision.action,
                                decision.suggestedQuantity || 10,
                                decision.reasoning,
                                stock.price,
                                decision.confidence,
                                decision.strategyName
                            );
                        }
                    });
                });
            }, idx * 500); // 500ms delay per stock to allow history fetch
        });
    }, [language, executeTradeForAgent, marketHealthy, agentHealth, addDecision]);

    const [marketTotal, setMarketTotal] = useState(0);
    const totalPages = useMemo(() => Math.max(1, Math.ceil(marketTotal / pageSize)), [marketTotal]);
    const pagedMarketData = useMemo(() => marketData, [marketData]);
    const totalPagesRef = useRef<number>(1);
    useEffect(() => { totalPagesRef.current = totalPages; }, [totalPages]);

    // -- 当前页轻量刷新（约 15~30 秒，最多 10 只） --
    // Use Ref to avoid infinite loop in polling effect
    const marketDataRef = useRef(marketData);
    useEffect(() => { marketDataRef.current = marketData; }, [marketData]);

    // -- 当前页轻量刷新（约 15~30 秒，最多 10 只） --
    useEffect(() => {
        let timeoutId: ReturnType<typeof setTimeout>;
        let mounted = true;

        const run = async () => {
            if (!mounted) return;
            // Check conditions inside the loop using refs/functions
            if (!isTradingTimeNow() || !marketHealthy || marketDataRef.current.length === 0) {
                // Retry slower if conditions not met
                timeoutId = setTimeout(run, 10000);
                return;
            }

            const symbols = marketDataRef.current.slice(0, 10).map(m => m.symbol);
            if (symbols.length === 0) {
                timeoutId = setTimeout(run, 10000);
                return;
            }

            try {
                const quotes = await fetchBatchQuotes(symbols);
                if (mounted && quotes.length > 0) {
                    setMarketData(prev => {
                        const map = new Map(prev.map(i => [i.symbol, i]));
                        quotes.forEach(q => map.set(q.symbol, { ...map.get(q.symbol), ...q }));
                        return Array.from(map.values());
                    });
                }
            } catch (e) {
                console.warn('Light realtime refresh failed', e);
            }

            if (mounted) {
                const delay = Math.floor(Math.random() * 15000) + 15000; // 15~30s
                timeoutId = setTimeout(run, delay);
            }
        };

        run();
        return () => {
            mounted = false;
            clearTimeout(timeoutId);
        };
    }, [marketHealthy]);


    // -- Main Loop --
    useEffect(() => {
        const runTradingCycle = async () => {
            const isTrading = isTradingTimeNow();
            const keyword = marketSearch.trim();
            if (!user) {
                if (!unauthLoggedRef.current) {
                    addLog('SYSTEM', '未登录，先展示行情列表');
                    unauthLoggedRef.current = true;
                }
            } else if (unauthLoggedRef.current) {
                unauthLoggedRef.current = false;
            }
            if (!isDataLoaded) {
                addLog('SYSTEM', '数据未加载完成，先尝试拉取行情用于展示');
            }
            if (!isTrading && tradingWindowRef.current) {
                tradingWindowRef.current = false;
                addLog('SYSTEM', '当前非交易时段，暂停实时刷新，仅保留行情列表');
            } else if (isTrading && !tradingWindowRef.current) {
                tradingWindowRef.current = true;
                nonTradingSnapshotRef.current = false;
                lastNonTradingKeywordRef.current = '';
                addLog('SYSTEM', '进入交易时段，恢复实时刷新与分析');
            }

            if (!isTrading && nonTradingSnapshotRef.current && lastNonTradingKeywordRef.current === keyword) {
                return; // 非交易时段且已拉取过当前关键字，直接跳过
            }

            try {
                const resp = await fetchMarketData(marketPage, pageSize, keyword);
                let baseData = resp.data;

                // 搜索模式下不做持仓补齐，保持后端分页/搜索结果一致
                if (!keyword) {
                    const holdingSymbols = Array.from(new Set(
                        agentsRef.current.flatMap(a => a.portfolio.positions.map(p => p.symbol))
                    ));
                    const missingSymbols = holdingSymbols.filter(sym => !baseData.find(m => m.symbol === sym));
                    if (missingSymbols.length > 0) {
                        try {
                            const supplements = await updateSpecificStocks(missingSymbols);
                            baseData = [...baseData, ...supplements];
                        } catch (e) {
                            console.warn('Pool supplement quotes failed, using existing data', e);
                        }
                    }
                    setMarketTotal((resp.total || resp.data.length) + (baseData.length - resp.data.length));
                } else {
                    setMarketTotal(resp.total || resp.data.length);
                }
                totalPagesRef.current = Math.max(1, Math.ceil((resp.total || baseData.length) / pageSize));

                // 关键代码（持仓）强制补价，确保交易用到最新价格
                const criticalSymbols = new Set<string>(
                    agentsRef.current.flatMap(a => a.portfolio.positions.map(p => p.symbol))
                );
                if (isTrading && criticalSymbols.size > 0) {
                    try {
                        const quotes = await fetchBatchQuotes(Array.from(criticalSymbols).slice(0, 100));
                        if (quotes.length > 0) {
                            const map = new Map(baseData.map(i => [i.symbol, i]));
                            quotes.forEach(q => map.set(q.symbol, { ...map.get(q.symbol), ...q }));
                            baseData = Array.from(map.values());
                        }
                    } catch (e) {
                        console.warn('Critical quotes refresh failed', e);
                    }
                }

                setMarketData(baseData);
                tradingSuspendedRef.current = false;
                setMarketHealthy(true);
                setMarketError('');

                const nowStr = new Date().toISOString();

                if (!user || !isDataLoaded) {
                    return;
                }

                setAgents(prevAgents => prevAgents.map(agent => {
                    const newPositions = agent.portfolio.positions.map(pos => {
                        const latestPrice = resp.data.find(d => d.symbol === pos.symbol)?.price || pos.currentPrice;
                        return {
                            ...pos,
                            currentPrice: latestPrice,
                            marketValue: pos.quantity * latestPrice,
                            pnl: (latestPrice - pos.averageCost) * pos.quantity,
                            pnlPercentage: pos.averageCost ? ((latestPrice - pos.averageCost) / pos.averageCost) * 100 : 0
                        };
                    });
                    const totalEquity = agent.portfolio.cash + newPositions.reduce((acc, p) => acc + p.marketValue, 0);
                    const history = [...agent.portfolio.equityHistory, { timestamp: nowStr, equity: totalEquity }];
                    return {
                        ...agent,
                        portfolio: { ...agent.portfolio, positions: newPositions, totalEquity, equityHistory: history }
                    };
                }));

                const marketWideAgents = agentsRef.current.filter(a => !a.assignedPoolId);
                const tradeCandidates = baseData.filter(d => d.price > 0);
                if (isTrading && globalRunning && tradeCandidates.length > 0 && marketWideAgents.length > 0) {
                    addLog('INFO', `Starting global market scan for ${marketWideAgents.length} agents...`);
                    runAIAnalysis(tradeCandidates, marketWideAgents);
                }

                if (!isTrading) {
                    nonTradingSnapshotRef.current = true;
                    lastNonTradingKeywordRef.current = keyword;
                }

                // 模拟人工翻页：处理完当前页后再切到下一页，下一次轮询才会请求下一页
                const nextPage = marketPage >= totalPagesRef.current ? 1 : marketPage + 1;
                setMarketPage(nextPage);

            } catch (err: any) {
                console.error("Trading Cycle Error:", err);
                addLog('ERROR', `Failed to fetch market data, will retry soon: ${err?.message || ''} `);
                setMarketHealthy(false);
                setMarketError(err?.message || '行情获取失败');
                tradingSuspendedRef.current = true;
                setGlobalRunning(false);
                setTimeout(runTradingCycle, 5000);
                return;
            }
        };

        const initial = setTimeout(runTradingCycle, 2000);
        const interval = setInterval(runTradingCycle, 60000);
        return () => {
            clearTimeout(initial);
            clearInterval(interval);
        };
    }, [globalRunning, runAIAnalysis, user, isDataLoaded, addLog, marketPage, marketSearch]);


    // -- Fast Loop (Pools) --
    const poolsRef = useRef(stockPools);
    useEffect(() => { poolsRef.current = stockPools; }, [stockPools]);

    useEffect(() => {
        if (!user || !isDataLoaded) return;

        let timeoutId: ReturnType<typeof setTimeout>;

        const runPoolCycle = async () => {
            if (!isTradingTimeNow() || tradingSuspendedRef.current || !marketHealthy) {
                timeoutId = setTimeout(runPoolCycle, 1000 * 60);
                return;
            }
            if (globalRunningRef.current && poolsRef.current.length > 0) {
                // 池内标的与池内智能体持仓的当前价格补齐，确保刷新时参与分析
                const agentPositionsByPool: Record<string, Set<string>> = {};
                agentsRef.current.forEach(a => {
                    if (!a.assignedPoolId) return;
                    const set = agentPositionsByPool[a.assignedPoolId] || new Set<string>();
                    a.portfolio.positions.forEach(p => set.add(p.symbol));
                    agentPositionsByPool[a.assignedPoolId] = set;
                });

                const mergedSymbols = new Set<string>();
                poolsRef.current.forEach(p => {
                    p.symbols.forEach(s => mergedSymbols.add(s));
                    const pos = agentPositionsByPool[p.id];
                    if (pos) pos.forEach(s => mergedSymbols.add(s));
                });
                const allSymbols = Array.from(mergedSymbols);

                if (allSymbols.length > 0) {
                    let updates: MarketData[] = [];
                    try {
                        updates = await updateSpecificStocks(allSymbols);
                    } catch (e: any) {
                        console.error("Pool update error", e);
                        addLog('ERROR', `Pool quotes refresh failed, retry soon: ${e?.message || ''} `);
                        timeoutId = setTimeout(runPoolCycle, Math.floor(Math.random() * 15000) + 15000); // 15~30s
                        return;
                    }

                    setMarketData(prev => {
                        const map = new Map(prev.map(i => [i.symbol, i]));
                        updates.forEach(u => map.set(u.symbol, u));
                        return Array.from(map.values());
                    });

                    poolsRef.current.forEach(pool => {
                        const poolAgents = agentsRef.current.filter(a => a.assignedPoolId === pool.id);
                        const poolSymbols = new Set<string>([...pool.symbols, ...(agentPositionsByPool[pool.id] || new Set<string>())]);
                        const poolStocks = updates.filter(u => poolSymbols.has(u.symbol));

                        if (poolAgents.length > 0 && poolStocks.length > 0) {
                            addLog('POOL', `Fast Refresh: ${pool.name} (${poolStocks.length} stocks) -> ${poolAgents.length} Agents`);
                            runAIAnalysis(poolStocks, poolAgents);
                        }
                    });
                }
            }
            const nextDelay = Math.floor(Math.random() * 15000) + 15000; // 15~30s
            timeoutId = setTimeout(runPoolCycle, nextDelay);
        };

        runPoolCycle();
        return () => clearTimeout(timeoutId);
    }, [user, isDataLoaded, addLog, runAIAnalysis, marketHealthy]);


    // -- Chart Data Logic with Filtering --
    const prepareChartData = () => {
        if (agents.length === 0) return [];

        // 1. Filter Agents based on view mode
        let displayAgents = agents;
        if (chartView !== 'SYSTEM') {
            displayAgents = agents.filter(a => a.assignedPoolId === chartView);
        }

        if (displayAgents.length === 0) return [];

        // 2. Find agent with longest history to use as timeline base
        let baseAgent = displayAgents[0];
        displayAgents.forEach(a => {
            if (a.portfolio.equityHistory.length > baseAgent.portfolio.equityHistory.length) {
                baseAgent = a;
            }
        });

        // 3. Map data
        return baseAgent.portfolio.equityHistory.map((entry, idx) => {
            const point: any = { timestamp: entry.timestamp };
            displayAgents.forEach(a => {
                // Safe access if histories are slightly out of sync length-wise
                const val = a.portfolio.equityHistory[idx]?.equity || a.portfolio.totalEquity;
                point[a.id] = val;
            });
            return point;
        }).slice(-50);
    };

    // Helper for EquityChart to know which lines to draw
    const getDisplayedAgents = () => {
        if (chartView === 'SYSTEM') return agents;
        return agents.filter(a => a.assignedPoolId === chartView);
    };

    const handleReset = () => {
        setGlobalRunning(false);
        setTradeHistory([]);
        setLogs([]);
        setAgents(prev => prev.map(a => ({
            ...a,
            portfolio: {
                cash: 1000000, frozenCash: 0, totalEquity: 1000000, positions: [],
                equityHistory: [{ timestamp: new Date().toISOString(), equity: 1000000 }]
            }
        })));
        resetMarketService();
        addLog('SYSTEM', 'System reset for user.');
    };

    const toggleGlobalRun = () => {
        if (!globalRunning) {
            const unavailableAgents = agentsRef.current.filter(a => !agentHealth[a.id]?.ok);
            if (unavailableAgents.length > 0) {
                alert(`下列智能体不可用，请先修复：${unavailableAgents.map(a => a.name).join(', ')} `);
                return;
            }
            if (!marketHealthy) {
                alert(`行情异常：${marketError || '请先恢复行情数据'} `);
                return;
            }
            if (brokerConfig.mode === 'real' && !brokerHealth.ok) {
                alert(`券商接口不可用：${brokerHealth.reason || ''} `);
                return;
            }
        }
        setGlobalRunning(!globalRunning);
        setAgents(prev => prev.map(a => ({ ...a, isRunning: !globalRunning })));
    };

    // Export System Snapshot (JSON)
    const handleExportSnapshot = async () => {
        const dataStr = JSON.stringify({ agents, tradeHistory, logs, user, stockPools, notificationConfig }, null, 2);
        const suggested = `alpha_trader_${user?.username || 'snapshot'}.json`;
        const targetPath = await save({
            defaultPath: suggested,
            filters: [{ name: 'JSON', extensions: ['json'] }]
        });
        if (!targetPath) return;
        await writeTextFile(targetPath, dataStr);
    };

    // Export Trade History (CSV for Excel)
    const handleExportHistoryCSV = async () => {
        const headers = [
            t('time'), t('agent'), t('action'), t('symbol'),
            t('price'), 'Quantity', 'Total Value',
            t('strategy'), t('conf'), t('reasoning')
        ];

        const rows = tradeHistory.map(trade => {
            // CSV escaping for fields that might contain commas or quotes
            const cleanReason = trade.reason ? trade.reason.replace(/"/g, '""').replace(/\n/g, ' ') : '';
            return [
                trade.timestamp,
                trade.agentName,
                trade.action,
                trade.symbol,
                trade.price.toFixed(2),
                trade.quantity,
                trade.totalAmount.toFixed(2),
                `"${trade.strategyId}"`,
                (trade.confidence * 100).toFixed(0) + '%',
                `"${cleanReason}"`
            ].join(',');
        });

        const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\n');
        const dateStr = new Date().toISOString().split('T')[0];
        const suggested = `trade_history_${user?.username || 'user'}_${dateStr}.csv`;
        const targetPath = await save({
            defaultPath: suggested,
            filters: [{ name: 'CSV', extensions: ['csv'] }]
        });
        if (!targetPath) return;
        await writeTextFile(targetPath, csvContent);
    };

    const handleMarketRefresh = async () => {
        try {
            setMarketRefreshLoading(true);
            const resp = await triggerBackendRefresh();
            addLog('SYSTEM', `Forced backend refresh triggered, total = ${resp.total || 0} `);
        } catch (e: any) {
            console.error(e);
            addLog('ERROR', `Backend refresh failed: ${e?.message || ''} `);
        } finally {
            setMarketRefreshLoading(false);
        }
    };

    // Update specific agent portfolio from FundManagement
    const handleUpdateAgentPortfolio = (agentId: string, newPortfolio: PortfolioState) => {
        setAgents(prev => prev.map(a => {
            if (a.id === agentId) {
                return { ...a, portfolio: newPortfolio };
            }
            return a;
        }));
    };

    const getTitle = () => {
        switch (activeTab) {
            case 'dashboard': return t('commandCenter');
            case 'settings': return t('agentConfig');
            case 'market': return t('marketOverview');
            case 'history': return t('tradeJournal');
            case 'thoughts': return 'AI 思考日志';
            case 'logs': return t('systemAudit');
            case 'about': return t('aboutTitle');
            default: return '';
        }
    };

    if (!user) return <AuthView />;
    if (!isDataLoaded) return <div className="h-screen bg-black flex items-center justify-center text-neutral-500">Loading workspace...</div>;

    return (
        <div className="flex h-screen font-sans text-neutral-200 bg-black overflow-hidden md:p-4 md:gap-4 relative">
            <Sidebar
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                onExport={handleExportSnapshot}
                isOpen={isSidebarOpen}
                onClose={() => setIsSidebarOpen(false)}
            />

            <main className="flex-1 flex flex-col h-full w-full bg-black/40 md:rounded-3xl border-0 md:border border-glass-border backdrop-blur-xl relative overflow-hidden shadow-2xl">
                <div className="absolute top-0 left-0 w-full h-96 bg-white/5 blur-3xl pointer-events-none -z-10"></div>

                <header className="h-16 md:h-20 flex items-center justify-between px-4 md:px-8 shrink-0 border-b border-glass-border bg-black/60 md:bg-transparent backdrop-blur-md z-20">
                    <div className="flex items-center gap-3">
                        <button onClick={() => setIsSidebarOpen(true)} className="md:hidden text-neutral-400 hover:text-white transition-colors">
                            <Menu className="w-6 h-6" />
                        </button>
                        <div>
                            <div className="flex items-center gap-3">
                                <h2 className="text-lg md:text-2xl font-semibold text-white tracking-tight animate-in fade-in slide-in-from-top-2">
                                    {getTitle()}
                                </h2>
                                {globalRunning && (
                                    <div className="flex items-center gap-2 px-2 py-1 rounded-full bg-white/10 border border-white/10 animate-pulse">
                                        <Zap className="w-3 h-3 text-white fill-white" />
                                        <span className="hidden md:inline text-[10px] font-bold text-white uppercase tracking-wide">{t('scanning')}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <button
                            onClick={toggleGlobalRun}
                            className={`flex items - center gap - 2 px - 4 md: px - 6 py - 2 md: py - 2.5 rounded - full font - semibold transition - all duration - 300 shadow - lg text - xs md: text - sm ${globalRunning
                                ? 'bg-white text-black hover:bg-neutral-200 shadow-white/20'
                                : 'bg-neutral-800 text-white hover:bg-neutral-700 border border-white/10'
                                } `}
                        >
                            {globalRunning ? <Pause className="w-4 h-4 fill-black" /> : <Play className="w-4 h-4 fill-white" />}
                            {globalRunning ? t('stopAll') : t('startAll')}
                        </button>
                    </div>
                </header>

                <div className="flex-1 overflow-auto p-4 md:p-8 scroll-smooth z-10">
                    {activeTab === 'dashboard' && (
                        <div className="max-w-7xl mx-auto space-y-6 md:space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-500 pb-20">
                            <FundManagement
                                agents={agents}
                                updateAgentPortfolio={handleUpdateAgentPortfolio}
                                brokerConfig={brokerConfig}
                                setBrokerConfig={setBrokerConfig}
                                onReset={handleReset}
                            />

                            <PositionsTable agents={agents} />

                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                                <div className="lg:col-span-2 bg-white/5 backdrop-blur-xl border border-glass-border rounded-3xl p-4 md:p-6 shadow-xl">
                                    <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
                                        <h3 className="text-white font-medium flex items-center gap-2">
                                            {t('performanceCurve')}
                                        </h3>

                                        {/* Chart View Toggle */}
                                        <div className="flex items-center gap-2 bg-black/30 rounded-xl p-1 border border-white/5">
                                            <Eye className="w-4 h-4 text-neutral-500 ml-2" />
                                            <select
                                                className="bg-transparent text-xs text-white font-medium focus:outline-none py-1 pr-2"
                                                value={chartView}
                                                onChange={(e) => setChartView(e.target.value)}
                                            >
                                                <option value="SYSTEM">{t('systemView')}</option>
                                                {stockPools.map(p => (
                                                    <option key={p.id} value={p.id}>{t('poolView')} {p.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>

                                    <div className="flex gap-2 flex-wrap mb-4">
                                        {getDisplayedAgents().map((a, i) => (
                                            <div key={a.id} className="flex items-center gap-1.5 text-[10px] text-neutral-400 uppercase tracking-wider bg-black/20 px-2 py-1 rounded-md">
                                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: a.color || '#fff' }} />
                                                {a.name.substring(0, 10)}
                                            </div>
                                        ))}
                                        {getDisplayedAgents().length === 0 && (
                                            <span className="text-xs text-neutral-500 italic">No agents in this view</span>
                                        )}
                                    </div>

                                    <EquityChart data={prepareChartData()} agents={getDisplayedAgents()} />
                                </div>

                                <div className="space-y-4">
                                    {agents.map(agent => (
                                        <div key={agent.id} className="bg-white/5 backdrop-blur-md border border-glass-border rounded-3xl p-5 relative overflow-hidden group hover:bg-white/10 transition-all duration-300">
                                            <div className="flex justify-between items-start mb-4">
                                                <h4 className="font-semibold text-white">{agent.name}</h4>
                                                <div className={`w - 2 h - 2 rounded - full ${agent.isRunning ? 'bg-white animate-pulse' : 'bg-neutral-700'} `} />
                                            </div>
                                            <div className="space-y-1">
                                                <p className="text-xs text-neutral-500 uppercase tracking-wider">{t('equity')}</p>
                                                <p className="text-xl font-mono text-white">¥{agent.portfolio.totalEquity.toLocaleString()}</p>
                                            </div>
                                            <div className="mt-4 pt-4 border-t border-white/5 flex justify-between text-xs text-neutral-400">
                                                <span className="font-mono">{agent.config.modelName}</span>
                                                {agent.assignedPoolId && <span className="text-blue-400 font-bold">POOL</span>}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Recent Activity */}
                            <div className="bg-white/5 backdrop-blur-xl border border-glass-border rounded-3xl p-4 md:p-8 shadow-xl">
                                <h3 className="text-white font-medium mb-6">{t('recentActivity')}</h3>
                                <div className="hidden md:block overflow-x-auto">
                                    <table className="w-full text-left">
                                        <thead className="text-xs font-bold text-neutral-500 uppercase tracking-wider border-b border-white/10">
                                            <tr>
                                                <th className="pb-3 pl-4">{t('time')}</th>
                                                <th className="pb-3">{t('agent')}</th>
                                                <th className="pb-3">{t('action')}</th>
                                                <th className="pb-3">{t('symbol')}</th>
                                                <th className="pb-3">{t('strategy')}</th>
                                                <th className="pb-3 text-right pr-4">{t('price')}</th>
                                            </tr>
                                        </thead>
                                        <tbody className="text-sm divide-y divide-white/5">
                                            {tradeHistory.slice(0, 8).map(tradeItem => (
                                                <tr key={tradeItem.id} className="group hover:bg-white/5 transition-colors">
                                                    <td className="py-4 pl-4 text-neutral-400 font-mono text-xs">{tradeItem.timestamp.split('T')[1]?.split('.')[0]}</td>
                                                    <td className="py-4 text-white font-medium">{tradeItem.agentName}</td>
                                                    <td className="py-4">
                                                        <span className={`px - 2 py - 1 rounded text - [10px] font - bold uppercase tracking - wide border ${tradeItem.action === 'BUY'
                                                            ? 'bg-white text-black border-white'
                                                            : 'bg-transparent text-neutral-500 border-neutral-700 line-through decoration-neutral-500'
                                                            } `}>
                                                            {tradeItem.action}
                                                        </span>
                                                    </td>
                                                    <td className="py-4 text-neutral-300">{tradeItem.symbol}</td>
                                                    <td className="py-4">
                                                        <span className="text-xs text-neutral-400 border border-white/10 px-2 py-0.5 rounded-md bg-black/20">
                                                            {tradeItem.strategyId}
                                                        </span>
                                                    </td>
                                                    <td className="py-4 text-right pr-4 font-mono text-neutral-300">¥{tradeItem.price.toFixed(2)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                <div className="md:hidden space-y-3">
                                    {tradeHistory.slice(0, 8).map(tradeItem => (
                                        <div key={tradeItem.id} className="bg-white/5 rounded-xl p-4 border border-white/5">
                                            <div className="flex justify-between items-center mb-2">
                                                <span className="text-neutral-400 text-xs font-mono">{tradeItem.timestamp.split('T')[1].split('.')[0]}</span>
                                                <span className={`px - 2 py - 0.5 rounded text - [10px] font - bold uppercase tracking - wide border ${tradeItem.action === 'BUY' ? 'bg-white text-black border-white' : 'text-neutral-500 border-neutral-700'
                                                    } `}>{tradeItem.action}</span>
                                            </div>
                                            <div className="flex justify-between items-center">
                                                <span className="text-white font-medium">{tradeItem.symbol}</span>
                                                <span className="text-white font-mono">¥{tradeItem.price.toFixed(2)}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'portfolio' && (
                        <div className="max-w-7xl mx-auto space-y-6 md:space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-500 pb-20">
                            <PortfolioView
                                agents={agents}
                                marketTotalEquity={agents.reduce((acc, a) => acc + a.portfolio.totalEquity, 0)}
                            />
                        </div>
                    )}

                    {activeTab === 'settings' && (
                        <SettingsView
                            agents={agents}
                            setAgents={setAgents}
                            stockPools={stockPools}
                            setStockPools={setStockPools}
                            notificationConfig={notificationConfig}
                            setNotificationConfig={setNotificationConfig}
                            agentHealth={agentHealth}
                            onRefreshAgentHealth={() => evaluateAgentsHealth(agentsRef.current)}
                        />
                    )}

                    {activeTab === 'market' && (

                        <div className="h-full overflow-hidden flex flex-col gap-4">
                            <div className="flex-1 bg-black/20 rounded-xl border border-white/5 overflow-hidden flex flex-col">
                                <h3 className="p-4 border-b border-white/5 font-medium text-lg flex items-center gap-2">
                                    <Search className="w-5 h-5 text-purple-400" />
                                    {t('marketData')}
                                    <div className="flex-1" />
                                    <button
                                        onClick={handleMarketRefresh}
                                        disabled={marketRefreshLoading}
                                        className="px-3 py-1 bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 text-sm rounded-lg transition-colors disabled:opacity-50"
                                    >
                                        {marketRefreshLoading ? 'Syncing...' : 'Force Refresh'}
                                    </button>
                                </h3>

                                {/* Market Table */}
                                <div className="flex-1 overflow-y-auto custom-scrollbar">
                                    <table className="w-full text-left border-collapse">
                                        <thead className="sticky top-0 bg-neutral-900/95 backdrop-blur-sm z-10 text-xs uppercase text-neutral-500 font-medium">
                                            <tr>
                                                <th className="p-4 w-24">Symbol</th>
                                                <th className="p-4">Name</th>
                                                <th className="p-4 text-right">Price</th>
                                                <th className="p-4 text-right">Change</th>
                                                <th className="p-4 text-right">Volume</th>
                                            </tr>
                                        </thead>
                                        <tbody className="text-sm divide-y divide-white/5">
                                            {pagedMarketData.map(stock => (
                                                <tr key={stock.symbol} className="hover:bg-white/5 transition-colors group">
                                                    <td className="p-4 font-mono text-neutral-400 group-hover:text-purple-300 transition-colors">{stock.symbol}</td>
                                                    <td className="p-4 font-medium text-white">{stock.name}</td>
                                                    <td className="p-4 text-right font-mono text-white">¥{stock.price.toFixed(2)}</td>
                                                    <td className={`p - 4 text - right font - mono font - bold ${stock.change >= 0 ? 'text-green-400' : 'text-red-400'} `}>
                                                        {stock.change > 0 ? '+' : ''}{stock.change.toFixed(2)}%
                                                    </td>
                                                    <td className="p-4 text-right font-mono text-neutral-500">{(stock.volume / 10000).toFixed(1)}w</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>

                                    {/* Pagination */}
                                    <div className="p-4 border-t border-white/5 flex items-center justify-between bg-black/20">
                                        <span className="text-sm text-neutral-500">
                                            Page {marketPage} of {totalPagesRef.current} (Total {marketTotal})
                                        </span>
                                        <div className="flex gap-2">
                                            <button
                                                disabled={marketPage <= 1}
                                                onClick={() => setMarketPage(p => Math.max(1, p - 1))}
                                                className="px-3 py-1 bg-white/5 hover:bg-white/10 rounded-lg text-sm disabled:opacity-50"
                                            >
                                                Prev
                                            </button>
                                            <button
                                                disabled={marketPage >= totalPagesRef.current}
                                                onClick={() => setMarketPage(p => p + 1)}
                                                className="px-3 py-1 bg-white/5 hover:bg-white/10 rounded-lg text-sm disabled:opacity-50"
                                            >
                                                Next
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'thoughts' && (
                        <DecisionLogView decisions={decisionHistory} />
                    )}

                    {activeTab === 'history' && (
                        <div className="max-w-7xl mx-auto bg-white/5 backdrop-blur-xl border border-glass-border rounded-3xl p-4 md:p-8 animate-in fade-in slide-in-from-bottom-4 shadow-2xl pb-20">
                            <div className="flex justify-between items-center mb-8">
                                <h2 className="text-2xl font-light text-white">{t('tradeJournal')}</h2>
                                <button onClick={handleExportHistoryCSV} className="group flex items-center gap-2 bg-white text-black px-4 py-2 rounded-full text-sm font-medium hover:bg-neutral-200 transition-all">
                                    <FileDown className="w-4 h-4" /> {t('exportData')}
                                </button>
                            </div>
                            <div className="hidden md:block overflow-x-auto">
                                <table className="w-full text-left text-sm text-neutral-400">
                                    <thead className="text-xs font-bold text-neutral-500 uppercase tracking-wider border-b border-white/10">
                                        <tr>
                                            <th className="pb-4 pl-2">{t('time')}</th>
                                            <th className="pb-4">{t('agent')}</th>
                                            <th className="pb-4">{t('signal')}</th>
                                            <th className="pb-4">{t('asset')}</th>
                                            <th className="pb-4">{t('price')}</th>
                                            <th className="pb-4">{t('strategy')}</th>
                                            <th className="pb-4 w-1/3">{t('reasoning')}</th>
                                            <th className="pb-4 text-right pr-2">{t('conf')}</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {tradeHistory.map(tradeItem => (
                                            <tr key={tradeItem.id} className="group hover:bg-white/5 transition-colors">
                                                <td className="py-4 pl-2 font-mono text-xs">{tradeItem.timestamp.replace('T', ' ').split('.')[0]}</td>
                                                <td className="py-4 text-white font-medium">{tradeItem.agentName}</td>
                                                <td className="py-4">
                                                    <span className={`font - bold ${tradeItem.action === 'BUY' ? 'text-white' : 'text-neutral-500 line-through'} `}>
                                                        {tradeItem.action}
                                                    </span>
                                                </td>
                                                <td className="py-4 text-neutral-300">{tradeItem.symbol}</td>
                                                <td className="py-4 font-mono">¥{tradeItem.price.toFixed(2)}</td>
                                                <td className="py-4">
                                                    <span className="text-xs border border-white/10 px-2 py-1 rounded bg-black/20 whitespace-nowrap text-neutral-300">
                                                        {tradeItem.strategyId}
                                                    </span>
                                                </td>
                                                <td className="py-4 text-xs italic text-neutral-500 line-clamp-2 group-hover:line-clamp-none transition-all duration-300">{tradeItem.reason}</td>
                                                <td className="py-4 text-right pr-2 text-xs font-bold text-white">{(tradeItem.confidence * 100).toFixed(0)}%</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <div className="md:hidden space-y-4">
                                {tradeHistory.map(tradeItem => (
                                    <div key={tradeItem.id} className="bg-white/5 rounded-2xl p-5 border border-white/5">
                                        <div className="flex justify-between items-center mb-3">
                                            <span className="text-xs text-neutral-500">{tradeItem.timestamp.replace('T', ' ').split('.')[0]}</span>
                                            <span className="text-xs font-medium text-neutral-300">{tradeItem.agentName}</span>
                                        </div>
                                        <div className="flex justify-between items-end mb-4">
                                            <div>
                                                <div className={`text - lg font - bold ${tradeItem.action === 'BUY' ? 'text-white' : 'text-neutral-500 line-through'} `}>{tradeItem.action} {tradeItem.symbol}</div>
                                                <div className="text-sm text-neutral-400 font-mono">@ ¥{tradeItem.price.toFixed(2)}</div>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-xs uppercase tracking-wide text-neutral-500">{t('conf')}</div>
                                                <div className="text-white font-bold">{(tradeItem.confidence * 100).toFixed(0)}%</div>
                                            </div>
                                        </div>
                                        <div className="bg-black/20 rounded-xl p-3 text-xs italic text-neutral-400 border border-white/5">
                                            <span className="block font-bold not-italic text-neutral-300 mb-1">{tradeItem.strategyId}</span>
                                            {tradeItem.reason}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {activeTab === 'logs' && (
                        <div className="max-w-7xl mx-auto bg-black/40 backdrop-blur-xl border border-glass-border rounded-3xl p-4 md:p-6 h-[80vh] flex flex-col animate-in fade-in slide-in-from-bottom-4 shadow-2xl pb-20">
                            <h2 className="text-xl font-medium mb-4 text-white ml-2">{t('systemOutput')}</h2>
                            <div className="flex-1 overflow-auto bg-black/50 rounded-2xl p-4 md:p-6 font-mono text-xs space-y-1.5 shadow-inner border border-white/5">
                                {logs.map(log => (
                                    <div key={log.id} className="flex flex-col md:flex-row md:gap-4 border-b border-white/5 pb-1.5 hover:bg-white/5 px-2 rounded transition-colors">
                                        <div className="flex gap-2 md:w-48 shrink-0">
                                            <span className="text-neutral-600 select-none">{log.timestamp.split('T')[1]}</span>
                                            <span className={`font - bold ${log.type === 'ERROR' ? 'text-white bg-red-900/50 px-1 rounded' :
                                                log.type === 'TRADE' ? 'text-white' :
                                                    log.type === 'POOL' ? 'text-blue-400' :
                                                        log.type === 'NOTIFY' ? 'text-purple-400' : 'text-neutral-500'
                                                } `}>{log.type}</span>
                                        </div>
                                        <span className="text-neutral-300 break-all mt-1 md:mt-0">{log.message}</span>
                                    </div>
                                ))}
                                <div ref={logsEndRef} />
                            </div>
                        </div>
                    )}

                    {activeTab === 'about' && <AboutView />}
                </div>
            </main>
        </div>
    );
}

export default App;

