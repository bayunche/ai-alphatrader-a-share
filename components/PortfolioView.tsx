import React, { useMemo } from 'react';
import { TradingAgent, Position } from '../types';
import { useTranslation } from '../contexts/LanguageContext';
import { PieChart, List, TrendingUp, TrendingDown, AlertTriangle, ShieldCheck } from 'lucide-react';

interface PortfolioViewProps {
    agents: TradingAgent[];
    marketTotalEquity: number; // Sum of all agents' total equity
}

export const PortfolioView: React.FC<PortfolioViewProps> = ({ agents, marketTotalEquity }) => {
    const { t } = useTranslation();

    // Aggregates
    const agg = useMemo(() => {
        let totalCash = 0;
        let totalMarketValue = 0;
        let totalPnL = 0;
        let positionsCount = 0;

        const allPositions: (Position & { agentName: string, agentColor: string })[] = [];

        agents.forEach(a => {
            totalCash += a.portfolio.cash;
            a.portfolio.positions.forEach(p => {
                totalMarketValue += p.marketValue;
                totalPnL += p.pnl;
                allPositions.push({
                    ...p,
                    agentName: a.name,
                    agentColor: a.color
                });
            });
            positionsCount += a.portfolio.positions.length;
        });

        const totalAsset = totalCash + totalMarketValue;
        const exposurePct = totalAsset > 0 ? (totalMarketValue / totalAsset) * 100 : 0;

        return { totalCash, totalMarketValue, totalPnL, positionsCount, exposurePct, totalAsset, allPositions };
    }, [agents]);

    // Group by Symbol for pie chart (simplified top 5)
    const exposureDistribution = useMemo(() => {
        const dist = new Map<string, number>();
        agg.allPositions.forEach(p => {
            const val = dist.get(p.symbol) || 0;
            dist.set(p.symbol, val + p.marketValue);
        });
        const sorted = Array.from(dist.entries()).sort((a, b) => b[1] - a[1]);
        const top5 = sorted.slice(0, 5);
        const otherVal = sorted.slice(5).reduce((acc, curr) => acc + curr[1], 0);
        if (otherVal > 0) top5.push(['Others', otherVal]);
        return top5;
    }, [agg.allPositions]);


    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                        <PieChart className="w-6 h-6 text-emerald-400" />
                        {t('portfolioManager')}
                    </h2>
                    <p className="text-neutral-500 text-sm mt-1">{t('manageFleet')}</p>
                </div>
                <div className="flex gap-4">
                    <div className="bg-white/5 px-4 py-2 rounded-xl border border-white/5">
                        <span className="text-xs text-neutral-400 block mb-1">{t('totalEquity')}</span>
                        <span className="text-xl font-bold text-white font-mono">¥{agg.totalAsset.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="bg-white/5 px-4 py-2 rounded-xl border border-white/5">
                        <span className="text-xs text-neutral-400 block mb-1">{t('unrealizedPnL')}</span>
                        <span className={`text-xl font-bold font-mono ${agg.totalPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {agg.totalPnL >= 0 ? '+' : ''}{agg.totalPnL.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </span>
                    </div>
                </div>
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Left: Stats & Charts */}
                <div className="space-y-6">
                    {/* Risk Exposure Card */}
                    <div className="bg-black/40 backdrop-blur-xl border border-glass-border rounded-3xl p-6 shadow-xl relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-6 opacity-10">
                            <ShieldCheck className="w-24 h-24 text-white" />
                        </div>
                        <h3 className="text-lg font-medium text-white mb-6 flex items-center gap-2">
                            <AlertTriangle className="w-5 h-5 text-amber-400" />
                            {t('riskExposure')}
                        </h3>

                        <div className="space-y-4 relative z-10">
                            <div>
                                <div className="flex justify-between text-sm mb-2">
                                    <span className="text-neutral-400">{t('exposure')}</span>
                                    <span className="text-white font-mono font-bold">{agg.exposurePct.toFixed(1)}%</span>
                                </div>
                                <div className="h-3 w-full bg-white/10 rounded-full overflow-hidden">
                                    <div
                                        className={`h-full rounded-full transition-all duration-1000 ${agg.exposurePct > 80 ? 'bg-red-500' : (agg.exposurePct > 50 ? 'bg-amber-500' : 'bg-green-500')}`}
                                        style={{ width: `${agg.exposurePct}%` }}
                                    />
                                </div>
                            </div>

                            <div className="pt-4 border-t border-white/5">
                                <h4 className="text-sm text-neutral-400 mb-3">{t('assetAllocation')}</h4>
                                <div className="space-y-2">
                                    {exposureDistribution.map(([name, val], idx) => {
                                        const pct = (val / agg.totalMarketValue) * 100;
                                        return (
                                            <div key={name} className="flex items-center gap-2 text-xs">
                                                <div className="w-2 h-2 rounded-full bg-blue-400" style={{ opacity: 1 - idx * 0.15 }} />
                                                <span className="text-neutral-300 w-16 truncate">{name}</span>
                                                <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                                                    <div className="h-full bg-blue-400" style={{ width: `${pct}%`, opacity: 1 - idx * 0.15 }} />
                                                </div>
                                                <span className="text-neutral-500 font-mono w-10 text-right">{pct.toFixed(0)}%</span>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right: Detailed Table */}
                <div className="lg:col-span-2">
                    <div className="bg-black/40 backdrop-blur-xl border border-glass-border rounded-3xl overflow-hidden shadow-xl min-h-[500px]">
                        <div className="p-6 border-b border-white/5 flex justify-between items-center">
                            <h3 className="text-lg font-medium text-white flex items-center gap-2">
                                <List className="w-5 h-5 text-blue-400" />
                                {t('holdingsDetail')}
                            </h3>
                            <span className="bg-white/10 text-xs px-2 py-1 rounded-lg text-neutral-300">
                                {agg.allPositions.length} Pos
                            </span>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-white/5 text-xs uppercase text-neutral-500 font-medium whitespace-nowrap">
                                    <tr>
                                        <th className="p-4 pl-6">{t('symbol')}</th>
                                        <th className="p-4">{t('agent')}</th>
                                        <th className="p-4 text-right">{t('quantity')}</th>
                                        <th className="p-4 text-right">{t('avgCost')}</th>
                                        <th className="p-4 text-right">{t('currentPrice')}</th>
                                        <th className="p-4 text-right">{t('marketValue')}</th>
                                        <th className="p-4 text-right pr-6">{t('unrealizedPnL')}</th>
                                    </tr>
                                </thead>
                                <tbody className="text-sm divide-y divide-white/5">
                                    {agg.allPositions.length === 0 ? (
                                        <tr>
                                            <td colSpan={7} className="p-12 text-center text-neutral-500">
                                                {t('noPositions')}
                                            </td>
                                        </tr>
                                    ) : agg.allPositions.map((pos, idx) => {
                                        const isProfit = pos.pnl >= 0;
                                        return (
                                            <tr key={`${pos.agentName}-${pos.symbol}-${idx}`} className="hover:bg-white/5 transition-colors">
                                                <td className="p-4 pl-6 font-mono font-bold text-white">
                                                    {pos.symbol}
                                                </td>
                                                <td className="p-4">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: pos.agentColor }} />
                                                        <span className="text-neutral-300">{pos.agentName}</span>
                                                    </div>
                                                </td>
                                                <td className="p-4 text-right font-mono text-neutral-300">
                                                    {pos.quantity}
                                                </td>
                                                <td className="p-4 text-right font-mono text-neutral-400">
                                                    ¥{pos.averageCost.toFixed(2)}
                                                </td>
                                                <td className="p-4 text-right font-mono text-white">
                                                    ¥{pos.currentPrice.toFixed(2)}
                                                </td>
                                                <td className="p-4 text-right font-mono text-white">
                                                    ¥{pos.marketValue.toLocaleString()}
                                                </td>
                                                <td className="p-4 text-right pr-6 font-mono">
                                                    <div className={`flex flex-col items-end ${isProfit ? 'text-green-400' : 'text-red-400'}`}>
                                                        <span className="font-bold flex items-center gap-1">
                                                            {isProfit ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                                                            {isProfit ? '+' : ''}{pos.pnl.toLocaleString()}
                                                        </span>
                                                        <span className="text-xs opacity-70">{isProfit ? '+' : ''}{pos.pnlPercentage.toFixed(2)}%</span>
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
