
import React, { useState } from 'react';
import { TradingAgent, AIProvider, StockPool, NotificationConfig, AgentHealthMap } from '../types';
import { Bot, Plus, Trash2, Save, ChevronRight, Layers, X, Bell, Send } from 'lucide-react';
import { useTranslation } from '../contexts/LanguageContext';
import { testNotification } from '../services/notificationService';

interface SettingsViewProps {
    agents: TradingAgent[];
    setAgents: React.Dispatch<React.SetStateAction<TradingAgent[]>>;
    stockPools: StockPool[];
    setStockPools: React.Dispatch<React.SetStateAction<StockPool[]>>;
    notificationConfig: NotificationConfig;
    setNotificationConfig: React.Dispatch<React.SetStateAction<NotificationConfig>>;
    agentHealth: AgentHealthMap;
    onRefreshAgentHealth: () => void;
}

const PROVIDERS: AIProvider[] = ['GEMINI', 'OPENAI', 'OLLAMA'];

// OpenAI 兼容服务商预设配置
interface ProviderPreset {
    name: string;
    endpoint: string;
    defaultModel: string;
    requiresKey: boolean;
}

const OPENAI_PRESETS: Record<string, ProviderPreset> = {
    'openai': { name: 'OpenAI 官方', endpoint: 'https://api.openai.com', defaultModel: 'gpt-4o', requiresKey: true },
    'deepseek': { name: 'DeepSeek', endpoint: 'https://api.deepseek.com', defaultModel: 'deepseek-chat', requiresKey: true },
    'siliconflow': { name: '硅基流动', endpoint: 'https://api.siliconflow.cn', defaultModel: 'Qwen/Qwen2.5-72B-Instruct', requiresKey: true },
    'azure': { name: 'Azure OpenAI', endpoint: 'https://{your-resource}.openai.azure.com', defaultModel: 'gpt-4o', requiresKey: true },
    'openrouter': { name: 'OpenRouter', endpoint: 'https://openrouter.ai/api', defaultModel: 'openai/gpt-4o', requiresKey: true },
    'groq': { name: 'Groq', endpoint: 'https://api.groq.com/openai', defaultModel: 'llama-3.3-70b-versatile', requiresKey: true },
    'together': { name: 'Together AI', endpoint: 'https://api.together.xyz', defaultModel: 'meta-llama/Llama-3.3-70B-Instruct-Turbo', requiresKey: true },
    'custom': { name: '自定义', endpoint: '', defaultModel: '', requiresKey: true },
};

const GEMINI_DEFAULTS = { endpoint: '', defaultModel: 'gemini-2.5-flash' };
const OLLAMA_DEFAULTS = { endpoint: 'http://localhost:11434', defaultModel: 'qwen2.5:7b' };

const AGENT_PALETTE = [
    '#ffffff', '#a3a3a3', '#525252', '#e5e5e5', '#737373'
];

export const SettingsView: React.FC<SettingsViewProps> = ({
    agents, setAgents, stockPools, setStockPools, notificationConfig, setNotificationConfig, agentHealth, onRefreshAgentHealth
}) => {
    const { t } = useTranslation();
    const [isEditing, setIsEditing] = useState<string | null>(null);
    const [activeSection, setActiveSection] = useState<'agents' | 'pools' | 'notify'>('agents');

    // Agent Form State
    const [formState, setFormState] = useState<Partial<TradingAgent>>({});
    const [initialCapital, setInitialCapital] = useState(1000000);

    // OpenAI 兼容服务商预设选择
    const [selectedPreset, setSelectedPreset] = useState<string>('openai');

    // Pool Form State
    const [newPoolName, setNewPoolName] = useState('');
    const [newSymbol, setNewSymbol] = useState('');
    const [editingPoolId, setEditingPoolId] = useState<string | null>(null);

    // Notify Form State (Sync with props on load, simplified here)
    const updateNotify = (field: string, value: any) => {
        setNotificationConfig(prev => ({ ...prev, [field]: value }));
    };

    const startNewAgent = () => {
        setIsEditing('NEW');
        const nextColor = AGENT_PALETTE[agents.length % AGENT_PALETTE.length];

        setFormState({
            name: `Agent ${agents.length + 1}`,
            color: nextColor,
            config: {
                provider: 'GEMINI',
                modelName: 'gemini-2.5-flash',
                apiEndpoint: '',
                apiKey: ''
            }
        });
        setInitialCapital(1000000);
    };

    const editAgent = (agent: TradingAgent) => {
        setIsEditing(agent.id);
        setFormState({ ...agent });
        setInitialCapital(agent.portfolio.cash);
    };

    const saveAgent = () => {
        if (!formState.name || !formState.config) return;

        if (isEditing === 'NEW') {
            const newAgent: TradingAgent = {
                id: Math.random().toString(36).substr(2, 9),
                name: formState.name,
                color: formState.color || '#ffffff',
                isRunning: false,
                assignedPoolId: formState.assignedPoolId,
                config: formState.config,
                portfolio: {
                    cash: initialCapital,
                    frozenCash: 0,
                    totalEquity: initialCapital,
                    positions: [],
                    equityHistory: [{ timestamp: new Date().toISOString(), equity: initialCapital }]
                }
            };
            setAgents([...agents, newAgent]);
        } else {
            setAgents(agents.map(a => a.id === isEditing ? { ...a, ...formState as TradingAgent } : a));
        }
        setIsEditing(null);
    };

    const deleteAgent = (id: string) => {
        setAgents(agents.filter(a => a.id !== id));
        if (isEditing === id) setIsEditing(null);
    };

    const updateConfig = (field: string, value: any) => {
        setFormState(prev => ({
            ...prev,
            config: { ...prev.config!, [field]: value }
        }));
    };

    // 切换 Provider 时更新默认配置
    const handleProviderChange = (provider: AIProvider) => {
        updateConfig('provider', provider);
        if (provider === 'GEMINI') {
            updateConfig('apiEndpoint', GEMINI_DEFAULTS.endpoint);
            updateConfig('modelName', GEMINI_DEFAULTS.defaultModel);
        } else if (provider === 'OLLAMA') {
            updateConfig('apiEndpoint', OLLAMA_DEFAULTS.endpoint);
            updateConfig('modelName', OLLAMA_DEFAULTS.defaultModel);
        } else {
            // OPENAI 兼容，使用当前预设
            const preset = OPENAI_PRESETS[selectedPreset] || OPENAI_PRESETS['openai'];
            updateConfig('apiEndpoint', preset.endpoint);
            updateConfig('modelName', preset.defaultModel);
        }
    };

    // 切换 OpenAI 预设时更新配置
    const handlePresetChange = (presetKey: string) => {
        setSelectedPreset(presetKey);
        const preset = OPENAI_PRESETS[presetKey];
        if (preset) {
            updateConfig('apiEndpoint', preset.endpoint);
            updateConfig('modelName', preset.defaultModel);
        }
    };

    // -- Stock Pool Logic --

    const createPool = () => {
        if (!newPoolName.trim()) return;
        const newPool: StockPool = {
            id: Math.random().toString(36).substr(2, 9),
            name: newPoolName,
            symbols: []
        };
        setStockPools([...stockPools, newPool]);
        setNewPoolName('');
    };

    const deletePool = (id: string) => {
        setStockPools(stockPools.filter(p => p.id !== id));
        setAgents(agents.map(a => a.assignedPoolId === id ? { ...a, assignedPoolId: undefined } : a));
    };

    const addSymbolToPool = (poolId: string) => {
        if (!newSymbol.trim()) return;
        setStockPools(prev => prev.map(p => {
            if (p.id === poolId && !p.symbols.includes(newSymbol)) {
                return { ...p, symbols: [...p.symbols, newSymbol] };
            }
            return p;
        }));
        setNewSymbol('');
    };

    const removeSymbolFromPool = (poolId: string, symbol: string) => {
        setStockPools(prev => prev.map(p => {
            if (p.id === poolId) {
                return { ...p, symbols: p.symbols.filter(s => s !== symbol) };
            }
            return p;
        }));
    };

    const handleTestNotify = async () => {
        await testNotification(notificationConfig);
        alert(t('testSent'));
    };

    return (
        <div className="max-w-6xl mx-auto pb-20">
            <div className="flex items-center justify-between mb-8">
                <div className="flex gap-6 border-b border-white/10 pb-2 overflow-x-auto no-scrollbar">
                    <button
                        onClick={() => setActiveSection('agents')}
                        className={`text-lg font-light tracking-tight transition-colors whitespace-nowrap ${activeSection === 'agents' ? 'text-white border-b-2 border-white pb-2' : 'text-neutral-500 hover:text-neutral-300'}`}
                    >
                        {t('agents')}
                    </button>
                    <button
                        onClick={() => setActiveSection('pools')}
                        className={`text-lg font-light tracking-tight transition-colors whitespace-nowrap ${activeSection === 'pools' ? 'text-white border-b-2 border-white pb-2' : 'text-neutral-500 hover:text-neutral-300'}`}
                    >
                        {t('stockPools')}
                    </button>
                    <button
                        onClick={() => setActiveSection('notify')}
                        className={`text-lg font-light tracking-tight transition-colors whitespace-nowrap ${activeSection === 'notify' ? 'text-white border-b-2 border-white pb-2' : 'text-neutral-500 hover:text-neutral-300'}`}
                    >
                        {t('notifications')}
                    </button>
                </div>
            </div>

            {activeSection === 'agents' && (
                <>
                    <div className="flex justify-between items-center mb-6 gap-3">
                        {!isEditing && (
                            <button onClick={startNewAgent} className="group flex items-center gap-2 bg-white text-black hover:bg-neutral-200 px-5 py-2.5 rounded-full font-medium transition-all shadow-lg shadow-white/10 active:scale-95">
                                <Plus className="w-4 h-4 transition-transform group-hover:rotate-90" /> {t('newAgent')}
                            </button>
                        )}
                        <button
                            onClick={onRefreshAgentHealth}
                            className="text-xs px-3 py-2 rounded-full border border-white/10 text-neutral-300 hover:text-white hover:border-white/40 transition"
                        >
                            检查智能体可用性
                        </button>
                    </div>

                    {isEditing ? (
                        <div className="bg-white/5 backdrop-blur-xl border border-glass-border p-6 md:p-8 rounded-3xl animate-in fade-in slide-in-from-bottom-4 shadow-2xl">
                            <div className="flex justify-between items-center mb-8">
                                <h3 className="text-xl font-medium text-white">{isEditing === 'NEW' ? t('createAgent') : t('editAgent')}</h3>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="color"
                                        value={formState.color}
                                        onChange={(e) => setFormState({ ...formState, color: e.target.value })}
                                        className="w-8 h-8 rounded-full bg-transparent border-none cursor-pointer"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-3">
                                    <label className="text-xs font-bold text-neutral-500 uppercase tracking-wider ml-1">{t('name')}</label>
                                    <input
                                        className="w-full bg-black/30 border border-white/10 rounded-2xl px-4 py-3 text-white focus:outline-none focus:border-white/30 transition-all"
                                        value={formState.name}
                                        onChange={e => setFormState({ ...formState, name: e.target.value })}
                                    />
                                </div>

                                <div className="space-y-3">
                                    <label className="text-xs font-bold text-neutral-500 uppercase tracking-wider ml-1">{t('assignedPool')}</label>
                                    <div className="relative">
                                        <select
                                            className="w-full bg-black/30 border border-white/10 rounded-2xl px-4 py-3 text-white appearance-none focus:outline-none focus:border-white/30 transition-all"
                                            value={formState.assignedPoolId || ''}
                                            onChange={e => setFormState({ ...formState, assignedPoolId: e.target.value || undefined })}
                                        >
                                            <option value="">{t('noPool')}</option>
                                            {stockPools.map(pool => (
                                                <option key={pool.id} value={pool.id}>{pool.name} ({pool.symbols.length} symbols)</option>
                                            ))}
                                        </select>
                                        <ChevronRight className="w-4 h-4 text-neutral-500 absolute right-4 top-3.5 rotate-90 pointer-events-none" />
                                    </div>
                                </div>

                                {isEditing === 'NEW' && (
                                    <div className="space-y-3">
                                        <label className="text-xs font-bold text-neutral-500 uppercase tracking-wider ml-1">{t('initialCapital')}</label>
                                        <input
                                            type="number"
                                            className="w-full bg-black/30 border border-white/10 rounded-2xl px-4 py-3 text-white focus:outline-none focus:border-white/30 transition-all"
                                            value={initialCapital}
                                            onChange={e => setInitialCapital(Number(e.target.value))}
                                        />
                                    </div>
                                )}
                                <div className="space-y-3">
                                    <label className="text-xs font-bold text-neutral-500 uppercase tracking-wider ml-1">{t('provider')}</label>
                                    <div className="relative">
                                        <select
                                            className="w-full bg-black/30 border border-white/10 rounded-2xl px-4 py-3 text-white appearance-none focus:outline-none focus:border-white/30 transition-all"
                                            value={formState.config?.provider}
                                            onChange={e => handleProviderChange(e.target.value as AIProvider)}
                                        >
                                            {PROVIDERS.map(p => <option key={p} value={p}>{p === 'OPENAI' ? 'OpenAI 兼容' : p}</option>)}
                                        </select>
                                        <ChevronRight className="w-4 h-4 text-neutral-500 absolute right-4 top-3.5 rotate-90 pointer-events-none" />
                                    </div>
                                </div>
                                {formState.config?.provider === 'OPENAI' && (
                                    <div className="space-y-3">
                                        <label className="text-xs font-bold text-neutral-500 uppercase tracking-wider ml-1">服务商预设</label>
                                        <div className="relative">
                                            <select
                                                className="w-full bg-black/30 border border-white/10 rounded-2xl px-4 py-3 text-white appearance-none focus:outline-none focus:border-white/30 transition-all"
                                                value={selectedPreset}
                                                onChange={e => handlePresetChange(e.target.value)}
                                            >
                                                {Object.entries(OPENAI_PRESETS).map(([key, preset]) => (
                                                    <option key={key} value={key}>{preset.name}</option>
                                                ))}
                                            </select>
                                            <ChevronRight className="w-4 h-4 text-neutral-500 absolute right-4 top-3.5 rotate-90 pointer-events-none" />
                                        </div>
                                    </div>
                                )}
                                <div className="space-y-3">
                                    <label className="text-xs font-bold text-neutral-500 uppercase tracking-wider ml-1">{t('modelId')}</label>
                                    <input
                                        className="w-full bg-black/30 border border-white/10 rounded-2xl px-4 py-3 text-white font-mono text-sm focus:outline-none focus:border-white/30 transition-all"
                                        value={formState.config?.modelName}
                                        onChange={e => updateConfig('modelName', e.target.value)}
                                    />
                                </div>
                                <div className="col-span-1 md:col-span-2 space-y-3">
                                    <label className="text-xs font-bold text-neutral-500 uppercase tracking-wider ml-1 flex flex-wrap items-center gap-2">
                                        {t('apiEndpoint')} <span className="text-[10px] font-normal text-neutral-600 normal-case">{t('apiEndpointHint')}</span>
                                    </label>
                                    <input
                                        className="w-full bg-black/30 border border-white/10 rounded-2xl px-4 py-3 text-white font-mono text-sm focus:outline-none focus:border-white/30 transition-all placeholder:text-neutral-700"
                                        placeholder={formState.config?.provider === 'OLLAMA' ? 'http://localhost:11434' : 'https://api...'}
                                        value={formState.config?.apiEndpoint}
                                        onChange={e => updateConfig('apiEndpoint', e.target.value)}
                                    />
                                </div>
                                <div className="col-span-1 md:col-span-2 space-y-3">
                                    <label className="text-xs font-bold text-neutral-500 uppercase tracking-wider ml-1 flex items-center gap-2">
                                        {t('apiKey')}
                                        {formState.config?.provider === 'OLLAMA' && (
                                            <span className="text-[10px] font-normal text-neutral-600 normal-case">(本地部署可留空)</span>
                                        )}
                                    </label>
                                    <input
                                        type="password"
                                        className="w-full bg-black/30 border border-white/10 rounded-2xl px-4 py-3 text-white font-mono text-sm focus:outline-none focus:border-white/30 transition-all"
                                        placeholder={formState.config?.provider === 'OLLAMA' ? '可选' : '必填'}
                                        value={formState.config?.apiKey || ''}
                                        onChange={e => updateConfig('apiKey', e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="flex flex-col md:flex-row gap-4 mt-10">
                                <button onClick={saveAgent} className="w-full md:w-auto flex items-center justify-center gap-2 bg-white text-black hover:bg-neutral-200 px-6 py-3 rounded-xl font-semibold transition-all active:scale-95">
                                    <Save className="w-4 h-4" /> {t('saveChanges')}
                                </button>
                                <button onClick={() => setIsEditing(null)} className="w-full md:w-auto text-neutral-400 hover:text-white px-6 py-3 font-medium transition-colors">
                                    {t('cancel')}
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {agents.map(agent => (
                                <div key={agent.id} className="group bg-white/5 backdrop-blur-sm border border-glass-border hover:bg-white/10 hover:border-white/20 p-6 rounded-3xl transition-all duration-300 cursor-pointer relative overflow-hidden" onClick={() => editAgent(agent)}>

                                    <div className="flex justify-between items-start mb-6">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-white bg-gradient-to-br from-neutral-800 to-black border border-white/10 relative overflow-hidden">
                                                <div className="absolute inset-0 opacity-20" style={{ backgroundColor: agent.color }}></div>
                                                <Bot className="w-6 h-6 relative z-10" />
                                            </div>
                                            <div>
                                                <h3 className="font-semibold text-lg text-white">{agent.name}</h3>
                                                <div className="flex gap-2 mt-1 items-center flex-wrap">
                                                    <span className="text-xs text-neutral-500 font-mono uppercase border border-white/10 px-1.5 rounded">{agent.config.provider}</span>
                                                    {agent.assignedPoolId && (
                                                        <span className="text-xs text-blue-400 font-mono uppercase border border-blue-500/30 px-1.5 rounded flex items-center gap-1">
                                                            <Layers className="w-3 h-3" /> Pool
                                                        </span>
                                                    )}
                                                    {agentHealth?.[agent.id] && !agentHealth[agent.id].ok && (
                                                        <span className="text-xs text-red-300 font-mono uppercase border border-red-400/40 px-1.5 rounded">
                                                            不可用
                                                        </span>
                                                    )}
                                                    {agentHealth?.[agent.id]?.ok && (
                                                        <span className="text-xs text-emerald-200 font-mono uppercase border border-emerald-300/30 px-1.5 rounded">
                                                            可用
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute top-6 right-6">
                                            <button onClick={(e) => { e.stopPropagation(); deleteAgent(agent.id); }} className="p-2 bg-neutral-800 rounded-full text-neutral-400 hover:bg-white hover:text-black transition-colors">
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>

                                    <div className="flex justify-between items-end border-t border-white/5 pt-4">
                                        <div>
                                            <div className="text-neutral-500 text-xs uppercase tracking-wider mb-1">{t('equity')}</div>
                                            <div className="text-white font-mono text-lg">¥{agent.portfolio.totalEquity.toLocaleString()}</div>
                                        </div>
                                        <div className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide border ${agent.isRunning
                                            ? 'bg-white text-black border-white'
                                            : 'bg-transparent text-neutral-600 border-neutral-700'
                                            }`}>
                                            {agent.isRunning ? t('active') : t('idle')}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </>
            )}

            {activeSection === 'pools' && (
                <div className="space-y-8 animate-in fade-in slide-in-from-right-4">
                    {/* Create Pool */}
                    <div className="bg-white/5 border border-glass-border rounded-3xl p-6 flex flex-col md:flex-row items-center gap-4">
                        <div className="flex-1 w-full">
                            <label className="text-xs font-bold text-neutral-500 uppercase tracking-wider ml-1 mb-1 block">{t('createPool')}</label>
                            <input
                                value={newPoolName}
                                onChange={(e) => setNewPoolName(e.target.value)}
                                placeholder={t('poolName')}
                                className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-white/30"
                            />
                        </div>
                        <button onClick={createPool} className="w-full md:w-11 mt-2 md:mt-5 h-11 flex items-center justify-center bg-white text-black rounded-xl hover:bg-neutral-200 transition-colors font-bold">
                            <Plus className="w-5 h-5" />
                        </button>
                    </div>

                    {/* List Pools */}
                    <div className="grid grid-cols-1 gap-6">
                        {stockPools.length === 0 && (
                            <div className="text-center text-neutral-600 py-10 italic">
                                No stock pools created yet.
                            </div>
                        )}
                        {stockPools.map(pool => (
                            <div key={pool.id} className="bg-white/5 border border-glass-border rounded-3xl p-6">
                                <div className="flex justify-between items-center mb-4 border-b border-white/5 pb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center text-blue-400">
                                            <Layers className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-medium text-white">{pool.name}</h3>
                                            <p className="text-xs text-neutral-500">{pool.symbols.length} {t('symbols')}</p>
                                        </div>
                                    </div>
                                    <button onClick={() => deletePool(pool.id)} className="text-neutral-600 hover:text-red-400 transition-colors">
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>

                                <div className="flex flex-wrap gap-2 mb-4">
                                    {pool.symbols.map(sym => (
                                        <span key={sym} className="px-3 py-1.5 rounded-lg bg-black/40 border border-white/10 text-sm text-neutral-300 flex items-center gap-2">
                                            {sym}
                                            <button onClick={() => removeSymbolFromPool(pool.id, sym)} className="text-neutral-600 hover:text-white">
                                                <X className="w-3 h-3" />
                                            </button>
                                        </span>
                                    ))}
                                    {pool.symbols.length === 0 && <span className="text-xs text-neutral-600 italic py-1.5">Empty pool</span>}
                                </div>

                                <div className="flex gap-3">
                                    <input
                                        placeholder={t('addSymbol')}
                                        className="flex-1 bg-black/20 border border-white/5 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-white/20"
                                        value={editingPoolId === pool.id ? newSymbol : ''}
                                        onFocus={() => setEditingPoolId(pool.id)}
                                        onChange={(e) => setNewSymbol(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') addSymbolToPool(pool.id);
                                        }}
                                    />
                                    <button onClick={() => addSymbolToPool(pool.id)} className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-sm transition-colors">
                                        {t('addSymbol')}
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {activeSection === 'notify' && (
                <div className="animate-in fade-in slide-in-from-right-4 max-w-2xl mx-auto">
                    <div className="bg-white/5 border border-glass-border rounded-3xl p-8">
                        <div className="flex items-center gap-4 mb-8">
                            <div className="w-12 h-12 rounded-2xl bg-purple-500/20 flex items-center justify-center text-purple-400">
                                <Bell className="w-6 h-6" />
                            </div>
                            <div>
                                <h3 className="text-xl font-medium text-white">{t('notifications')}</h3>
                                <p className="text-neutral-500 text-sm">{t('notifyDesc')}</p>
                            </div>
                            <div className="ml-auto">
                                <label className="flex items-center cursor-pointer">
                                    <div className="relative">
                                        <input
                                            type="checkbox"
                                            className="sr-only"
                                            checked={notificationConfig.enabled}
                                            onChange={e => updateNotify('enabled', e.target.checked)}
                                        />
                                        <div className={`block w-14 h-8 rounded-full transition-colors ${notificationConfig.enabled ? 'bg-white' : 'bg-neutral-800'}`}></div>
                                        <div className={`dot absolute left-1 top-1 bg-black w-6 h-6 rounded-full transition-transform ${notificationConfig.enabled ? 'translate-x-6' : ''}`}></div>
                                    </div>
                                </label>
                            </div>
                        </div>

                        <div className={`space-y-6 transition-opacity duration-300 ${notificationConfig.enabled ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
                            <div>
                                <h4 className="text-sm font-bold text-neutral-500 uppercase tracking-wider mb-4">{t('telegramConfig')}</h4>
                                <div className="space-y-4">
                                    <input
                                        type="password"
                                        placeholder={t('botToken')}
                                        value={notificationConfig.telegramBotToken || ''}
                                        onChange={e => updateNotify('telegramBotToken', e.target.value)}
                                        className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-white/30"
                                    />
                                    <input
                                        placeholder={t('chatId')}
                                        value={notificationConfig.telegramChatId || ''}
                                        onChange={e => updateNotify('telegramChatId', e.target.value)}
                                        className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-white/30"
                                    />
                                </div>
                            </div>

                            <div>
                                <h4 className="text-sm font-bold text-neutral-500 uppercase tracking-wider mb-4">{t('webhookConfig')}</h4>
                                <input
                                    placeholder={t('webhookUrl')}
                                    value={notificationConfig.webhookUrl || ''}
                                    onChange={e => updateNotify('webhookUrl', e.target.value)}
                                    className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-white/30"
                                />
                            </div>

                            <div className="pt-4 border-t border-white/5">
                                <button
                                    onClick={handleTestNotify}
                                    className="flex items-center gap-2 text-sm font-medium text-neutral-400 hover:text-white transition-colors"
                                >
                                    <Send className="w-4 h-4" /> {t('sendTest')}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
