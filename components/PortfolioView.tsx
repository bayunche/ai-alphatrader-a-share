import React, { useMemo, useState } from 'react';
import { TradingAgent, PortfolioPosition as Position } from '../types';
import { useTranslation } from '../contexts/LanguageContext';
import { PieChart, List, TrendingUp, TrendingDown, AlertTriangle, ShieldCheck, ChevronLeft, UserCircle } from 'lucide-react';

interface PortfolioViewProps {
    agents: TradingAgent[];
    marketTotalEquity: number;
}

export const PortfolioView: React.FC<PortfolioViewProps> = ({ agents }) => {
    const { t } = useTranslation();
    const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);

    // Derived State
    const selectedAgent = useMemo(() =>
        agents.find(a => a.id === selectedAgentId),
        [agents, selectedAgentId]);

    // View: Agent Fleet Overview (Card List)
    if (!selectedAgent) {
        return (
            <div className="space-y-8 animate-fade-in p-4 lg:p-0">
                {/* Header */}
                <div className="flex flex-col gap-2">
                    <h2 className="text-3xl font-bold text-white flex items-center gap-3 tracking-tight">
                        <div className="p-3 bg-emerald-500/10 rounded-2xl border border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.3)]">
                            <PieChart className="w-8 h-8 text-emerald-400" />
                        </div>
                        <span className="bg-clip-text text-transparent bg-gradient-to-r from-white to-neutral-400">
                            {t('portfolioManager')}
                        </span>
                    </h2>
                    <p className="text-neutral-400 text-sm ml-14 max-w-xl leading-relaxed">{t('manageFleet')}</p>
                </div>

                {/* Agent Cards Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {agents.map(agent => {
                        const totalEquity = agent.portfolio.totalEquity;
                        const posCount = agent.portfolio.positions.length;
                        const dayPnL = agent.portfolio.positions.reduce((acc, p) => acc + p.pnl, 0); // Approx
                        const isProfit = dayPnL >= 0;

                        return (
                            <div
                                key={agent.id}
                                onClick={() => setSelectedAgentId(agent.id)}
                                className="group relative bg-[#0a0a0a] border border-white/5 rounded-[2rem] p-6 overflow-hidden transition-all duration-300 hover:border-white/20 hover:shadow-[0_0_30px_-5px_rgba(0,0,0,0.5)] cursor-pointer"
                            >
                                {/* Hover Gradient Effect */}
                                <div
                                    className="absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                                />
                                <div
                                    className="absolute -top-20 -right-20 w-40 h-40 rounded-full blur-[60px] opacity-20 transition-all duration-500 group-hover:opacity-30"
                                    style={{ backgroundColor: agent.color }}
                                />

                                <div className="relative z-10">
                                    <div className="flex items-center gap-5 mb-8">
                                        <div className="relative">
                                            <div className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg border border-white/5 bg-[#1a1a1a] group-hover:scale-110 transition-transform duration-300">
                                                <div className="w-5 h-5 rounded-full shadow-[0_0_12px_currentColor]" style={{ backgroundColor: agent.color }} />
                                            </div>
                                            {/* Status Dot */}
                                            <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-[3px] border-[#0a0a0a] ${agent.isRunning ? 'bg-emerald-500' : 'bg-neutral-500'}`} />
                                        </div>

                                        <div>
                                            <h3 className="font-bold text-white text-xl tracking-tight group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-white group-hover:to-neutral-400 transition-all">
                                                {agent.name}
                                            </h3>
                                            <div className="flex items-center gap-2 mt-1.5">
                                                <span className="text-[10px] uppercase font-bold tracking-wider text-neutral-500 bg-white/5 px-2 py-0.5 rounded-full border border-white/5">
                                                    {agent.config.modelName}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-5">
                                        <div>
                                            <span className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-1 block">{t('totalEquity')}</span>
                                            <div className="flex items-baseline gap-1">
                                                <span className="text-3xl font-bold text-white font-mono tracking-tighter">
                                                    ¥{Math.floor(totalEquity).toLocaleString()}
                                                </span>
                                                <span className="text-sm font-medium text-neutral-600">
                                                    .{(totalEquity % 1).toFixed(2).substring(2)}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="pt-5 border-t border-dashed border-white/10 flex justify-between items-end">
                                            <div className="flex flex-col">
                                                <span className="text-xs font-medium text-neutral-500 mb-1">{t('unrealizedPnL')}</span>
                                                <div className={`flex items-center gap-1.5 text-base font-bold font-mono ${isProfit ? 'text-green-400' : 'text-red-400'}`}>
                                                    {isProfit ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                                                    {isProfit ? '+' : ''}{dayPnL.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <span className="text-xs font-medium text-neutral-500 block mb-1">{t('positions')}</span>
                                                <div className="flex items-center gap-1 justify-end">
                                                    <List className="w-3 h-3 text-neutral-500" />
                                                    <span className="text-white font-mono font-medium">{posCount}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    }

    // View: Single Agent Detail
    const state = selectedAgent.portfolio;
    const totalMarketValue = state.positions.reduce((acc, p) => acc + p.marketValue, 0);
    const exposurePct = state.totalEquity > 0 ? (totalMarketValue / state.totalEquity) * 100 : 0;
    const totalPnL = state.positions.reduce((acc, p) => acc + p.pnl, 0);

    // Group by Symbol for pie chart
    const exposureDistribution = (() => {
        const dist = new Map<string, number>();
        state.positions.forEach(p => {
            dist.set(p.symbol, p.marketValue);
        });
        const sorted = Array.from(dist.entries()).sort((a, b) => b[1] - a[1]);
        const top5 = sorted.slice(0, 5);
        if (sorted.length > 5) {
            const other = sorted.slice(5).reduce((acc, c) => acc + c[1], 0);
            if (other > 0) top5.push(['Others', other]);
        }
        return top5;
    })();

    return (
        <div className="space-y-8 animate-slide-in-right pb-20">
            {/* Navigation / Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex items-center gap-5">
                    <button
                        onClick={() => setSelectedAgentId(null)}
                        className="group flex items-center justify-center w-12 h-12 bg-white/5 hover:bg-white/10 rounded-2xl border border-white/5 hover:border-white/20 transition-all duration-300"
                        title="Back to Fleet"
                    >
                        <ChevronLeft className="w-6 h-6 text-neutral-400 group-hover:text-white transition-colors" />
                    </button>
                    <div>
                        <div className="flex items-center gap-3">
                            <h2 className="text-3xl font-bold text-white tracking-tight">{selectedAgent.name}</h2>
                            <div className="h-2 w-2 rounded-full animate-pulse" style={{ backgroundColor: selectedAgent.color }} />
                        </div>
                        <p className="text-neutral-500 text-sm mt-1 font-mono flex items-center gap-2">
                            <span>ID: {selectedAgent.id.substring(0, 8)}</span>
                            <span className="w-1 h-1 rounded-full bg-neutral-700" />
                            <span>{selectedAgent.config.provider}</span>
                        </p>
                    </div>
                </div>

                {/* Quick Stats Pill */}
                <div className="flex items-center gap-1 bg-black/40 backdrop-blur-md px-2 py-2 rounded-2xl border border-white/5">
                    <div className="px-4 py-1 border-r border-white/5">
                        <span className="text-[10px] text-neutral-500 uppercase tracking-wider block">{t('totalEquity')}</span>
                        <span className="text-sm font-bold text-white font-mono">¥{state.totalEquity.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                    </div>
                    <div className="px-4 py-1">
                        <span className="text-[10px] text-neutral-500 uppercase tracking-wider block">{t('available')}</span>
                        <span className="text-sm font-bold text-emerald-400 font-mono">¥{state.cash.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                    </div>
                </div>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                    { label: t('totalEquity'), value: state.totalEquity, prefix: '¥', color: 'text-white' },
                    { label: t('cash'), value: state.cash, prefix: '¥', color: 'text-neutral-300' },
                    { label: t('unrealizedPnL'), value: totalPnL, prefix: totalPnL >= 0 ? '+' : '', color: totalPnL >= 0 ? 'text-green-400' : 'text-red-400' },
                    { label: t('exposure'), value: exposurePct, suffix: '%', color: exposurePct > 80 ? 'text-amber-400' : 'text-blue-400' }
                ].map((stat, i) => (
                    <div key={i} className="bg-gradient-to-br from-white/5 to-white/[0.02] p-5 rounded-2xl border border-white/5 flex flex-col justify-between group hover:border-white/10 transition-colors">
                        <span className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-2">{stat.label}</span>
                        <span className={`text-2xl font-bold font-mono tracking-tight ${stat.color}`}>
                            {stat.prefix}{typeof stat.value === 'number' ? stat.value.toLocaleString(undefined, { maximumFractionDigits: 1 }) : stat.value}{stat.suffix}
                        </span>
                    </div>
                ))}
            </div>

            {/* Detailed Content */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                {/* Left: Risk & Allocation */}
                <div className="space-y-6">
                    <div className="bg-[#0a0a0a] border border-white/10 rounded-3xl p-6 shadow-xl relative overflow-hidden">
                        <div className="absolute -top-10 -right-10 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

                        <h3 className="text-lg font-bold text-white mb-8 flex items-center gap-2 relative z-10">
                            <ShieldCheck className="w-5 h-5 text-blue-400" />
                            {t('riskExposure')}
                        </h3>

                        <div className="space-y-8 relative z-10">
                            {/* Gauge / Bar */}
                            <div>
                                <div className="flex justify-between items-end mb-3">
                                    <span className="text-sm text-neutral-400 font-medium">{t('exposure')}</span>
                                    <span className={`text-2xl font-bold font-mono ${exposurePct > 80 ? 'text-amber-400' : 'text-white'}`}>
                                        {exposurePct.toFixed(1)}<span className="text-sm text-neutral-500 ml-0.5">%</span>
                                    </span>
                                </div>
                                <div className="h-4 w-full bg-white/5 rounded-full overflow-hidden p-1 border border-white/5">
                                    <div
                                        className={`h-full rounded-full transition-all duration-1000 shadow-[0_0_10px_rgba(0,0,0,0.5)] ${exposurePct > 80 ? 'bg-gradient-to-r from-orange-600 to-amber-500' : (exposurePct > 50 ? 'bg-gradient-to-r from-emerald-600 to-green-500' : 'bg-gradient-to-r from-blue-600 to-cyan-500')}`}
                                        style={{ width: `${Math.max(2, exposurePct)}%` }}
                                    />
                                </div>
                            </div>

                            <div className="pt-6 border-t border-dashed border-white/10">
                                <h4 className="text-sm font-medium text-neutral-400 mb-4">{t('assetAllocation')}</h4>
                                <div className="space-y-3">
                                    {exposureDistribution.map(([name, val], idx) => {
                                        const pct = (val / totalMarketValue) * 100;
                                        return (
                                            <div key={name} className="group">
                                                <div className="flex justify-between text-xs mb-1.5 px-0.5">
                                                    <span className="text-neutral-300 font-medium">{name}</span>
                                                    <span className="text-neutral-500 font-mono">{pct.toFixed(1)}%</span>
                                                </div>
                                                <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full rounded-full bg-blue-500/50 group-hover:bg-blue-400 transition-colors"
                                                        style={{ width: `${pct}%`, opacity: 1 - idx * 0.1 }}
                                                    />
                                                </div>
                                            </div>
                                        )
                                    })}
                                    {exposureDistribution.length === 0 && (
                                        <div className="text-center py-4 text-xs text-neutral-600">
                                            {t('noPositions')}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right: Table */}
                <div className="lg:col-span-2">
                    <div className="bg-[#0a0a0a] border border-white/10 rounded-3xl overflow-hidden shadow-2xl min-h-[500px] flex flex-col">
                        <div className="p-6 border-b border-white/5 flex justify-between items-center bg-white/[0.02]">
                            <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                <List className="w-5 h-5 text-purple-400" />
                                {t('holdingsDetail')}
                            </h3>
                            <span className="bg-white/10 text-xs font-mono font-medium px-2.5 py-1 rounded-lg text-neutral-300 border border-white/5">
                                {state.positions.length} Positions
                            </span>
                        </div>

                        <div className="flex-1 overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-black/20 text-xs uppercase text-neutral-500 font-semibold tracking-wider">
                                    <tr>
                                        <th className="p-5 pl-8">{t('symbol')}</th>
                                        <th className="p-5 text-right">{t('quantity')}</th>
                                        <th className="p-5 text-right">{t('avgCost')}</th>
                                        <th className="p-5 text-right">{t('currentPrice')}</th>
                                        <th className="p-5 text-right">{t('marketValue')}</th>
                                        <th className="p-5 text-right pr-8">{t('unrealizedPnL')}</th>
                                    </tr>
                                </thead>
                                <tbody className="text-sm divide-y divide-white/5">
                                    {state.positions.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="p-20 text-center text-neutral-600 flex flex-col items-center justify-center">
                                                <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mb-4">
                                                    <List className="w-6 h-6 text-neutral-700" />
                                                </div>
                                                <span className="text-base font-medium">{t('noPositions')}</span>
                                            </td>
                                        </tr>
                                    ) : state.positions.map((pos, idx) => {
                                        const isProfit = pos.pnl >= 0;
                                        return (
                                            <tr key={`${pos.symbol}-${idx}`} className="group hover:bg-white/[0.03] transition-colors">
                                                <td className="p-5 pl-8">
                                                    <div className="flex items-center gap-3">
                                                        <div className={`w-1 h-8 rounded-full ${isProfit ? 'bg-emerald-500' : 'bg-red-500'} opacity-0 group-hover:opacity-100 transition-opacity`} />
                                                        <span className="font-mono font-bold text-white text-base">{pos.symbol}</span>
                                                    </div>
                                                </td>
                                                <td className="p-5 text-right font-mono text-neutral-300">
                                                    {pos.quantity}
                                                </td>
                                                <td className="p-5 text-right font-mono text-neutral-400">
                                                    ¥{pos.averageCost.toFixed(2)}
                                                </td>
                                                <td className="p-5 text-right font-mono text-white font-medium">
                                                    ¥{pos.currentPrice.toFixed(2)}
                                                </td>
                                                <td className="p-5 text-right font-mono text-white">
                                                    ¥{pos.marketValue.toLocaleString()}
                                                </td>
                                                <td className="p-5 text-right pr-8 font-mono">
                                                    <div className={`flex flex-col items-end ${isProfit ? 'text-emerald-400' : 'text-red-400'}`}>
                                                        <span className="font-bold flex items-center gap-1.5 text-base">
                                                            {isProfit ? '+' : ''}{pos.pnl.toLocaleString()}
                                                        </span>
                                                        <span className="text-xs opacity-70 bg-white/5 px-1.5 py-0.5 rounded">
                                                            {isProfit ? '+' : ''}{pos.pnlPercentage.toFixed(2)}%
                                                        </span>
                                                    </div>
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
