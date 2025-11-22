
import React, { createContext, useContext, useState, ReactNode } from 'react';

type Language = 'en' | 'zh';

const translations = {
  en: {
    // Sidebar
    dashboard: 'Dashboard',
    market: 'Market',
    history: 'History',
    logs: 'Logs',
    settings: 'Settings',
    exportData: 'Export Data',
    subtitle: 'QUANTITATIVE AI SYSTEM',
    
    // Header
    commandCenter: 'Command Center',
    agentConfig: 'Agent Configuration',
    marketOverview: 'Market Overview',
    tradeJournal: 'Trade Journal',
    systemAudit: 'System Audit',
    scanning: 'Scanning',
    liveConnection: 'Live Connection Established',
    simulationEnv: 'Simulation Environment',
    stopAll: 'Stop All',
    startAll: 'Start All',

    // Fund Management
    totalEquity: 'TOTAL EQUITY',
    available: 'Available',
    frozen: 'Frozen',
    amountPlaceholder: 'Amount (¥)',
    deposit: 'Deposit',
    withdraw: 'Withdraw',
    dailyPnL: 'Daily PnL',
    switchSandbox: 'Switch Sandbox',
    switchBroker: 'Switch Broker',

    // Charts & Cards
    performanceCurve: 'Performance Curve',
    equity: 'Equity',
    positions: 'pos',
    recentActivity: 'Recent Activity',
    waitingForData: 'Waiting for market data...',
    chartView: 'Chart View',
    systemView: 'System Overview',
    poolView: 'Stock Pool:',

    // Tables
    time: 'Time',
    agent: 'Agent',
    action: 'Action',
    symbol: 'Symbol',
    strategy: 'Strategy',
    price: 'Price',
    change: 'Change',
    trend: 'Trend (30m)',
    signal: 'Signal',
    asset: 'Asset',
    reasoning: 'Reasoning',
    conf: 'Conf',
    type: 'Type',
    message: 'Message',
    systemOutput: 'System Output',

    // Settings
    agents: 'Agents',
    manageFleet: 'Manage your autonomous trading fleet.',
    newAgent: 'New Agent',
    createAgent: 'Create Agent',
    editAgent: 'Edit Agent',
    chartColor: 'Chart Color',
    name: 'Name',
    initialCapital: 'Initial Capital',
    provider: 'Provider',
    modelId: 'Model ID',
    apiEndpoint: 'API Endpoint',
    apiEndpointHint: '(Leave empty for defaults)',
    apiKey: 'API Key',
    saveChanges: 'Save Changes',
    cancel: 'Cancel',
    active: 'Active',
    idle: 'Idle',
    
    // Stock Pools
    stockPools: 'Stock Pools',
    managePools: 'Manage custom asset lists for focused trading.',
    createPool: 'Create Pool',
    poolName: 'Pool Name',
    addSymbol: 'Add Symbol',
    symbols: 'Symbols',
    assignedPool: 'Assigned Stock Pool',
    noPool: 'All Market (Default)',
    poolUpdate: 'Pool Refresh',

    // Notifications
    notifications: 'Notifications',
    notifyDesc: 'Configure real-time alerts for trade executions.',
    enableNotify: 'Enable Notifications',
    telegramConfig: 'Telegram Configuration',
    botToken: 'Bot Token',
    chatId: 'Chat ID',
    webhookConfig: 'Webhook Configuration',
    webhookUrl: 'Webhook URL',
    sendTest: 'Send Test Alert',
    testSent: 'Test sent!',

    // Auth
    login: 'Login',
    register: 'Register',
    username: 'Username',
    enterUsername: 'Enter your username',
    welcome: 'Welcome back',
    createAccount: 'Create Account',
    loginAction: 'Sign In',
    registerAction: 'Sign Up',
    logout: 'Logout',
    haveAccount: 'Already have an account?',
    noAccount: "Don't have an account?",
    authError: 'Authentication failed',
    userNotFound: 'User not found',
    userExists: 'User already exists',
    profile: 'Profile'
  },
  zh: {
    // Sidebar
    dashboard: '仪表盘',
    market: '市场行情',
    history: '交易历史',
    logs: '系统日志',
    settings: '设置配置',
    exportData: '导出数据',
    subtitle: '量化 AI 系统',

    // Header
    commandCenter: '控制中心',
    agentConfig: '智能体配置',
    marketOverview: '市场概览',
    tradeJournal: '交易日志',
    systemAudit: '系统审计',
    scanning: '扫描中',
    liveConnection: '实盘连接已建立',
    simulationEnv: '模拟沙盒环境',
    stopAll: '停止所有',
    startAll: '启动所有',

    // Fund Management
    totalEquity: '总净值',
    available: '可用资金',
    frozen: '冻结资金',
    amountPlaceholder: '金额 (¥)',
    deposit: '入金',
    withdraw: '出金',
    dailyPnL: '日盈亏',
    switchSandbox: '切换沙盒',
    switchBroker: '切换实盘',

    // Charts & Cards
    performanceCurve: '资金曲线',
    equity: '净值',
    positions: '持仓',
    recentActivity: '近期活动',
    waitingForData: '等待市场数据...',
    chartView: '图表视图',
    systemView: '系统总览',
    poolView: '股票池:',

    // Tables
    time: '时间',
    agent: '智能体',
    action: '操作',
    symbol: '标的',
    strategy: '策略',
    price: '价格',
    change: '涨跌幅',
    trend: '趋势 (30分)',
    signal: '信号',
    asset: '资产',
    reasoning: '决策逻辑',
    conf: '置信度',
    type: '类型',
    message: '消息',
    systemOutput: '系统输出',

    // Settings
    agents: '智能体管理',
    manageFleet: '管理您的自动交易智能体集群',
    newAgent: '新建智能体',
    createAgent: '创建智能体',
    editAgent: '编辑智能体',
    chartColor: '图表颜色',
    name: '名称',
    initialCapital: '初始资金',
    provider: '服务提供商',
    modelId: '模型 ID',
    apiEndpoint: 'API 地址',
    apiEndpointHint: '(留空使用默认)',
    apiKey: 'API 密钥',
    saveChanges: '保存更改',
    cancel: '取消',
    active: '运行中',
    idle: '空闲',
    
    // Stock Pools
    stockPools: '股票池管理',
    managePools: '管理自定义自选股列表以进行针对性交易。',
    createPool: '创建股票池',
    poolName: '股票池名称',
    addSymbol: '添加代码',
    symbols: '股票代码',
    assignedPool: '绑定股票池',
    noPool: '全市场 (默认)',
    poolUpdate: '自选刷新',

    // Notifications
    notifications: '消息推送',
    notifyDesc: '配置交易执行时的实时消息提醒。',
    enableNotify: '启用推送',
    telegramConfig: 'Telegram 配置',
    botToken: '机器人 Token',
    chatId: '聊天 ID',
    webhookConfig: 'Webhook 配置',
    webhookUrl: 'Webhook URL',
    sendTest: '发送测试提醒',
    testSent: '测试已发送!',

    // Auth
    login: '登录',
    register: '注册',
    username: '用户名',
    enterUsername: '输入您的用户名',
    welcome: '欢迎回来',
    createAccount: '创建账户',
    loginAction: '进入系统',
    registerAction: '立即注册',
    logout: '退出登录',
    haveAccount: '已有账户?',
    noAccount: '没有账户?',
    authError: '认证失败',
    userNotFound: '用户不存在',
    userExists: '用户已存在',
    profile: '个人资料'
  }
};

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: keyof typeof translations['en']) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [language, setLanguage] = useState<Language>('zh'); // Default to Chinese

  const t = (key: keyof typeof translations['en']) => {
    return translations[language][key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useTranslation = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useTranslation must be used within a LanguageProvider');
  }
  return context;
};
