
import React, { useState, useMemo } from 'react';
import { BrokerConfig, PortfolioState, TradingAgent } from '../types';
import { Wallet, ArrowUpRight, ArrowDownLeft, RefreshCw, Lock, Unlock, ChevronDown } from 'lucide-react';
import { useTranslation } from '../contexts/LanguageContext';

interface FundManagementProps {
  agents: TradingAgent[];
  updateAgentPortfolio: (agentId: string, newPortfolio: PortfolioState) => void;
  brokerConfig: BrokerConfig;
  setBrokerConfig: React.Dispatch<React.SetStateAction<BrokerConfig>>;
  onReset: () => void;
}

export const FundManagement: React.FC<FundManagementProps> = ({
  agents, updateAgentPortfolio, brokerConfig, setBrokerConfig, onReset
}) => {
  const { t } = useTranslation();
  const [amount, setAmount] = useState('');
  const [selectedAgentId, setSelectedAgentId] = useState<string>(agents[0]?.id || '');

  // ensure selectedAgentId is valid
  React.useEffect(() => {
      if (agents.length > 0 && !agents.find(a => a.id === selectedAgentId)) {
          setSelectedAgentId(agents[0].id);
      }
  }, [agents, selectedAgentId]);

  // Calculate System Aggregates
  const systemTotals = useMemo(() => {
      return agents.reduce((acc, agent) => ({
          totalEquity: acc.totalEquity + agent.portfolio.totalEquity,
          cash: acc.cash + agent.portfolio.cash,
          frozenCash: acc.frozenCash + agent.portfolio.frozenCash,
          dayStartEquity: acc.dayStartEquity + (agent.portfolio.equityHistory[0]?.equity || agent.portfolio.totalEquity)
      }), { totalEquity: 0, cash: 0, frozenCash: 0, dayStartEquity: 0 });
  }, [agents]);

  const handleInject = () => {
    const val = parseFloat(amount);
    if (isNaN(val) || val <= 0) return;
    
    const agent = agents.find(a => a.id === selectedAgentId);
    if (!agent) return;

    const newPortfolio = {
      ...agent.portfolio,
      cash: agent.portfolio.cash + val,
      totalEquity: agent.portfolio.totalEquity + val
    };
    updateAgentPortfolio(agent.id, newPortfolio);
    setAmount('');
  };

  const handleWithdraw = () => {
    const val = parseFloat(amount);
    if (isNaN(val) || val <= 0) return;
    
    const agent = agents.find(a => a.id === selectedAgentId);
    if (!agent) return;

    if (val > agent.portfolio.cash) return; // Insufficient funds

    const newPortfolio = {
      ...agent.portfolio,
      cash: agent.portfolio.cash - val,
      totalEquity: agent.portfolio.totalEquity - val
    };
    updateAgentPortfolio(agent.id, newPortfolio);
    setAmount('');
  };

  const toggleMode = () => {
    const newMode = brokerConfig.mode === 'sandbox' ? 'real' : 'sandbox';
    setBrokerConfig({ ...brokerConfig, mode: newMode });
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {/* Balance Card (System Aggregate) */}
        <div className="relative overflow-hidden bg-gradient-to-br from-neutral-800 to-black border border-glass-border rounded-3xl p-6 shadow-2xl shadow-black/50 col-span-1 md:col-span-2 lg:col-span-1">
            <div className="absolute top-0 right-0 -mt-4 -mr-4 w-32 h-32 bg-white/5 blur-3xl rounded-full pointer-events-none"></div>
            
            <div className="flex justify-between items-start z-10 relative">
                <div>
                    <p className="text-neutral-400 text-sm font-medium tracking-wide">{t('totalEquity')} (System)</p>
                    <h3 className="text-3xl font-semibold text-white mt-1 tracking-tight break-all">
                        ¥ {systemTotals.totalEquity.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
                    </h3>
                </div>
                <div className={`px-3 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase border ${
                    brokerConfig.mode === 'sandbox' 
                    ? 'bg-white/10 border-white/20 text-white' 
                    : 'bg-neutral-800 border-neutral-600 text-neutral-400'
                }`}>
                    {brokerConfig.mode === 'sandbox' ? 'SANDBOX' : 'REAL'}
                </div>
            </div>
            
            <div className="mt-8 flex gap-8 z-10 relative">
                <div>
                    <p className="text-xs text-neutral-500 uppercase tracking-wider">{t('available')}</p>
                    <p className="text-lg text-neutral-200 font-mono">¥{systemTotals.cash.toLocaleString()}</p>
                </div>
                <div>
                    <p className="text-xs text-neutral-500 uppercase tracking-wider">{t('frozen')}</p>
                    <p className="text-lg text-neutral-200 font-mono">¥{systemTotals.frozenCash.toLocaleString()}</p>
                </div>
            </div>
        </div>

        {/* Action Center (Targeted Funding) */}
        <div className="bg-white/5 backdrop-blur-xl border border-glass-border rounded-3xl p-6 flex flex-col justify-center gap-4 shadow-xl">
             <div className="flex gap-2">
                <div className="relative flex-1">
                    <select
                        value={selectedAgentId}
                        onChange={(e) => setSelectedAgentId(e.target.value)}
                        className="w-full appearance-none bg-black/20 border border-white/10 rounded-2xl pl-4 pr-10 py-3 text-white text-sm focus:outline-none focus:border-white/30 transition-all"
                    >
                        {agents.map(agent => (
                            <option key={agent.id} value={agent.id}>
                                {agent.name} (¥{(agent.portfolio.cash / 10000).toFixed(1)}w)
                            </option>
                        ))}
                    </select>
                    <ChevronDown className="w-4 h-4 text-neutral-500 absolute right-3 top-3.5 pointer-events-none" />
                </div>
             </div>

             <div className="relative group">
                 <input 
                     type="number" 
                     value={amount}
                     onChange={(e) => setAmount(e.target.value)}
                     placeholder={t('amountPlaceholder')}
                     className="w-full bg-black/20 border border-white/10 rounded-2xl px-4 py-3 text-white placeholder:text-neutral-600 focus:outline-none focus:bg-black/40 focus:border-white/30 transition-all text-sm font-mono"
                 />
             </div>
             
             <div className="grid grid-cols-2 gap-3">
                <button onClick={handleInject} className="flex items-center justify-center gap-2 bg-white text-black hover:bg-neutral-200 py-3 rounded-xl text-sm font-semibold transition-all active:scale-95">
                    <ArrowUpRight className="w-4 h-4" /> {t('deposit')}
                </button>
                <button onClick={handleWithdraw} className="flex items-center justify-center gap-2 bg-neutral-800 text-white hover:bg-neutral-700 py-3 rounded-xl text-sm font-semibold transition-all active:scale-95 border border-white/5">
                    <ArrowDownLeft className="w-4 h-4" /> {t('withdraw')}
                </button>
             </div>
        </div>

        {/* System Control */}
         <div className="bg-white/5 backdrop-blur-xl border border-glass-border rounded-3xl p-6 flex flex-col justify-between shadow-xl col-span-1 md:col-span-2 lg:col-span-1">
             <div>
                <p className="text-neutral-400 text-sm font-medium mb-2">{t('dailyPnL')} (Aggregated)</p>
                {(() => {
                     const pnl = systemTotals.totalEquity - systemTotals.dayStartEquity;
                     const pnlPercent = systemTotals.dayStartEquity > 0 ? (pnl / systemTotals.dayStartEquity) * 100 : 0;
                     const isPositive = pnl >= 0;
                     return (
                         <div className={`flex items-baseline gap-2 ${isPositive ? 'text-white' : 'text-neutral-500'}`}>
                             <span className="text-3xl font-light tracking-tighter">{isPositive ? '+' : ''}{pnl.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}</span>
                             <span className="text-sm font-medium bg-white/10 px-2 py-0.5 rounded-lg">{isPositive ? '+' : ''}{pnlPercent.toFixed(2)}%</span>
                         </div>
                     )
                 })()}
             </div>

             <div className="flex gap-3 mt-4">
                <button 
                    onClick={toggleMode}
                    className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-semibold border border-white/5 bg-black/20 text-neutral-400 hover:bg-black/40 hover:text-white transition-all"
                >
                    {brokerConfig.mode === 'real' ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                    {brokerConfig.mode === 'real' ? t('switchSandbox') : t('switchBroker')}
                </button>
                <button 
                    onClick={onReset}
                    className="px-4 bg-black/20 hover:bg-white hover:text-black text-neutral-400 rounded-xl border border-white/5 transition-all"
                >
                    <RefreshCw className="w-4 h-4" />
                </button>
             </div>
         </div>
    </div>
  );
};
