import React, { useMemo, useState } from 'react';
import { TradingAgent, PortfolioPosition as Position } from '../types';
import { useTranslation } from '../contexts/LanguageContext';
import { Layers, ChevronDown, ChevronUp } from 'lucide-react';

interface PositionsTableProps {
    agents: TradingAgent[];
}

export const PositionsTable: React.FC<PositionsTableProps> = ({ agents }) => {
    const { t } = useTranslation();
    const [isExpanded, setIsExpanded] = useState(true);

    const allPositions = useMemo(() => {
        const list: (Position & { agentName: string, agentColor: string, agentId: string })[] = [];
        agents.forEach(agent => {
            agent.portfolio.positions.forEach(pos => {
                list.push({
                    ...pos,
                    agentName: agent.name,
                    agentColor: agent.color,
                    agentId: agent.id
                });
            });
        });
        return list.sort((a, b) => b.marketValue - a.marketValue);
    }, [agents]);

    // Grouping for summary (optional, skipping for now to keep it simple list)

    if (allPositions.length === 0) {
        return (
            <div className="bg-white/5 backdrop-blur-xl border border-glass-border rounded-3xl p-6 shadow-xl mb-8">
                <div className="flex items-center gap-2 mb-4">
                    <Layers className="w-5 h-5 text-blue-400" />
                    <h3 className="text-white font-medium">{t('currentHoldings')}</h3>
                </div>
                <div className="text-center py-8 text-neutral-500 text-sm">
                    {t('noPositions')}
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white/5 backdrop-blur-xl border border-glass-border rounded-3xl overflow-hidden shadow-xl mb-8 transition-all duration-300">
            <div
                className="p-6 border-b border-white/5 flex items-center justify-between cursor-pointer hover:bg-white/5 transition-colors"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <div className="flex items-center gap-2">
                    <Layers className="w-5 h-5 text-blue-400" />
                    <h3 className="text-white font-medium">{t('currentHoldings')}</h3>
                    <span className="bg-white/10 text-xs px-2 py-0.5 rounded-full text-neutral-300 ml-2">
                        {allPositions.length}
                    </span>
                </div>
                <button className="text-neutral-400 hover:text-white transition-colors">
                    {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                </button>
            </div>

            {isExpanded && (
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-black/20 text-xs uppercase text-neutral-500 font-medium whitespace-nowrap">
                            <tr>
                                <th className="p-4 pl-6">{t('agent')}</th>
                                <th className="p-4">{t('symbol')}</th>
                                <th className="p-4 text-right">{t('quantity')}</th>
                                <th className="p-4 text-right">Avg Cost</th>
                                <th className="p-4 text-right">{t('price')}</th>
                                <th className="p-4 text-right">Mkt Value</th>
                                <th className="p-4 text-right pr-6">PnL / %</th>
                            </tr>
                        </thead>
                        <tbody className="text-sm divide-y divide-white/5">
                            {allPositions.map((pos, idx) => {
                                const isProfit = pos.pnl >= 0;
                                return (
                                    <tr key={`${pos.agentId}-${pos.symbol}-${idx}`} className="hover:bg-white/5 transition-colors group">
                                        <td className="p-4 pl-6">
                                            <div className="flex items-center gap-2">
                                                <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: pos.agentColor || '#fff' }} />
                                                <span className="font-medium text-neutral-300">{pos.agentName}</span>
                                            </div>
                                        </td>
                                        <td className="p-4 font-mono font-bold text-white group-hover:text-blue-300 transition-colors">
                                            {pos.symbol}
                                        </td>
                                        <td className="p-4 text-right font-mono text-neutral-300">
                                            {pos.quantity.toLocaleString()}
                                        </td>
                                        <td className="p-4 text-right font-mono text-neutral-400">
                                            ¥{pos.averageCost.toFixed(2)}
                                        </td>
                                        <td className="p-4 text-right font-mono text-white">
                                            ¥{pos.currentPrice?.toFixed(2) || '-'}
                                        </td>
                                        <td className="p-4 text-right font-mono text-white">
                                            ¥{pos.marketValue?.toLocaleString() || '-'}
                                        </td>
                                        <td className="p-4 text-right pr-6 font-mono">
                                            <div className={`flex flex-col items-end ${isProfit ? 'text-green-400' : 'text-red-400'}`}>
                                                <span className="font-bold">{isProfit ? '+' : ''}{pos.pnl?.toLocaleString()}</span>
                                                <span className="text-xs opacity-70">{isProfit ? '+' : ''}{pos.pnlPercentage?.toFixed(2)}%</span>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};
