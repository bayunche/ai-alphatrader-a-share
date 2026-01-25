
// Market Data Types
export interface MarketData {
  symbol: string;
  name: string;
  price: number;
  change: number;
  volume: number;
  timestamp: string;
  trend: number[];
}

// Trading Core Types
export enum TradeAction {
  BUY = 'BUY',
  SELL = 'SELL',
  HOLD = 'HOLD'
}

export interface TradeExecution {
  id: string;
  agentId: string;
  agentName: string;
  timestamp: string;
  symbol: string;
  action: TradeAction;
  price: number;
  quantity: number;
  totalAmount: number;
  status: 'FILLED' | 'REJECTED' | 'PENDING';
  strategyId: string;
  reason: string;
  confidence: number;
}

export interface PortfolioPosition {
  symbol: string;
  quantity: number;
  averageCost: number;
  currentPrice: number;
  marketValue: number;
  pnl: number;
  pnlPercentage: number;
}

export interface PortfolioState {
  cash: number;
  frozenCash: number;
  totalEquity: number;
  positions: PortfolioPosition[];
  equityHistory: { timestamp: string; equity: number }[];
}

// AI & System Configuration Types
export type AIProvider = 'GEMINI' | 'OPENAI' | 'OLLAMA';

export interface AIConfig {
  provider: AIProvider;
  modelName: string;
  apiEndpoint: string;
  apiKey?: string;
}

export interface StockPool {
  id: string;
  name: string;
  symbols: string[]; // List of ticker symbols (e.g., "600519")
}

export interface TradingAgent {
  id: string;
  name: string;
  color: string;
  isRunning: boolean;
  assignedPoolId?: string; // If set, agent only trades stocks in this pool
  config: AIConfig;
  portfolio: PortfolioState;
  availabilityTag?: string; // 智能体可用性标记（不可用时显示原因或提示）
}

export interface BrokerConfig {
  mode: 'sandbox' | 'real';
  brokerName: string;
  endpoint: string;
}

export type AgentHealthMap = Record<string, { ok: boolean; reason?: string }>;

export interface NotificationConfig {
  enabled: boolean;
  telegramBotToken?: string;
  telegramChatId?: string;
  webhookUrl?: string;
}

export interface AIResponse {
  action: TradeAction;
  symbol: string;
  confidence: number;
  reasoning: string;
  strategyName: string;
  suggestedQuantity?: number;
}

export interface LogEntry {
  id: string;
  timestamp: string;
  agentId?: string;
  type: 'INFO' | 'TRADE' | 'ERROR' | 'AI_THOUGHT' | 'BROKER' | 'SYSTEM' | 'POOL' | 'NOTIFY';
  message: string;
  details?: any;
}

// Auth Types
export interface User {
  id: string;
  username: string;
}

export interface AuthContextType {
  user: User | null;
  login: (username: string) => Promise<void>;
  register: (username: string) => Promise<void>;
  logout: () => void;
  error: string | null;
}

// Persistence / API Types
export interface Workspace {
  agents: TradingAgent[];
  tradeHistory: TradeExecution[];
  logs: LogEntry[];
  stockPools: StockPool[];
  notificationConfig?: NotificationConfig;
  lastUpdated: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface AIDecisionRecord {
  id: string;
  agentId: string;
  agentName: string;
  symbol: string;
  timestamp: string;
  action: TradeAction;
  reasoning: string;
  confidence: number;
  strategyName: string;
  priceAtTime: number;
}

export interface Workspace {
  agents: TradingAgent[];
  tradeHistory: TradeExecution[];
  logs: LogEntry[];
  stockPools: StockPool[];
  notificationConfig?: NotificationConfig;
  lastUpdated: string;
  decisionHistory?: AIDecisionRecord[];
}
