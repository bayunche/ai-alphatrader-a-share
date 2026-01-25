import React, { useState, useMemo } from 'react';
import { AIDecisionRecord, TradeAction } from '../types';
import { Search, Brain, ExternalLink } from 'lucide-react';

interface DecisionLogViewProps {
    decisions: AIDecisionRecord[];
}

export function DecisionLogView({ decisions }: DecisionLogViewProps) {
    const [search, setSearch] = useState('');
    const [filterAction, setFilterAction] = useState<string>('ALL');

    const filtered = useMemo(() => {
        return decisions.filter(d => {
            const matchSearch = d.symbol.toLowerCase().includes(search.toLowerCase()) ||
                d.agentName.toLowerCase().includes(search.toLowerCase()) ||
                d.reasoning.toLowerCase().includes(search.toLowerCase());
            const matchFilter = filterAction === 'ALL' || d.action === filterAction;
            return matchSearch && matchFilter;
        });
    }, [decisions, search, filterAction]);

    const getActionColor = (action: TradeAction) => {
        switch (action) {
            case TradeAction.BUY: return 'text-red-400';
            case TradeAction.SELL: return 'text-green-400';
            case TradeAction.HOLD: return 'text-neutral-500';
            default: return 'text-neutral-400';
        }
    };

    return (
        <div className="flex flex-col h-full bg-neutral-900/50 rounded-xl border border-white/5 overflow-hidden">
            {/* Header / Filter Toolbar */}
            <div className="p-4 border-b border-white/5 flex flex-wrap gap-4 items-center justify-between">
                <div className="flex items-center gap-2">
                    <Brain className="w-5 h-5 text-purple-400" />
                    <h2 className="text-lg font-medium text-white">AI 思考日志 (Thoughts)</h2>
                    <span className="text-xs text-neutral-500 bg-neutral-800 px-2 py-0.5 rounded-full">
                        {decisions.length} 条记录
                    </span>
                </div>

                <div className="flex gap-2">
                    <div className="relative group">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500 group-focus-within:text-purple-400 transition-colors" />
                        <input
                            type="text"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="搜索股票/智能体/理由..."
                            className="bg-black/40 border border-white/10 rounded-lg pl-9 pr-3 py-1.5 text-sm text-neutral-300 focus:outline-none focus:border-purple-500/50 w-64 transition-all"
                        />
                    </div>

                    <select
                        value={filterAction}
                        onChange={e => setFilterAction(e.target.value)}
                        className="bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-neutral-300 focus:outline-none focus:border-purple-500/50"
                    >
                        <option value="ALL">全部动作</option>
                        <option value="BUY">BUY (买入)</option>
                        <option value="SELL">SELL (卖出)</option>
                        <option value="HOLD">HOLD (观望)</option>
                    </select>
                </div>
            </div>

            {/* List Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                {filtered.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-neutral-600">
                        暂无相关思考记录
                    </div>
                ) : (
                    filtered.map(record => (
                        <div key={record.id} className="bg-black/20 hover:bg-black/40 border border-white/5 hover:border-purple-500/20 rounded-lg p-3 transition-all flex flex-col gap-2">
                            <div className="flex items-center justify-between text-xs">
                                <div className="flex items-center gap-2 text-neutral-400">
                                    <span className="font-mono text-neutral-500">{record.timestamp.split('T')[1].split('.')[0]}</span>
                                    <span className="px-1.5 py-0.5 rounded bg-white/5 text-neutral-300">{record.agentName}</span>
                                    <span>#{record.symbol}</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className={`font-bold font-mono ${getActionColor(record.action)}`}>
                                        {record.action}
                                    </span>
                                    <span className="text-neutral-500">
                                        Conf: {(record.confidence * 100).toFixed(0)}%
                                    </span>
                                </div>
                            </div>

                            <div className="flex items-start gap-2">
                                <div className="flex-1 text-sm text-neutral-300 leading-relaxed font-light">
                                    <span className="text-purple-400/50 mr-1">[{record.strategyName}]</span>
                                    {record.reasoning}
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
