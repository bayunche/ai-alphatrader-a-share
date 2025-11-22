
import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from '../contexts/LanguageContext';
import { Zap, ArrowRight, Loader2 } from 'lucide-react';

export const AuthView: React.FC = () => {
  const { login, register, error } = useAuth();
  const { t } = useTranslation();
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return;
    
    setIsLoading(true);
    try {
      if (isLogin) {
        await login(username);
      } else {
        await register(username);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute top-0 left-0 w-full h-full bg-black"></div>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-white/5 blur-[120px] rounded-full pointer-events-none"></div>
      
      <div className="relative z-10 w-full max-w-md p-8">
        <div className="text-center mb-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
           <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-6 shadow-[0_0_40px_rgba(255,255,255,0.3)]">
               <Zap className="w-8 h-8 fill-black text-black" />
           </div>
           <h1 className="text-4xl font-light text-white tracking-tight mb-2">AlphaTrader</h1>
           <p className="text-neutral-500">{t('subtitle')}</p>
        </div>

        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl animate-in fade-in zoom-in-95 duration-500">
            <div className="mb-8 text-center">
                <h2 className="text-xl font-medium text-white">{isLogin ? t('welcome') : t('createAccount')}</h2>
                {error && (
                    <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
                        {error}
                    </div>
                )}
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                    <label className="text-xs font-bold text-neutral-500 uppercase tracking-wider ml-1">{t('username')}</label>
                    <input 
                        type="text" 
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder={t('enterUsername')}
                        className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3.5 text-white placeholder:text-neutral-600 focus:outline-none focus:border-white/40 focus:bg-black/60 transition-all"
                        autoFocus
                    />
                </div>

                <button 
                    type="submit" 
                    disabled={isLoading}
                    className="w-full flex items-center justify-center gap-2 bg-white text-black hover:bg-neutral-200 disabled:bg-neutral-600 disabled:text-neutral-400 py-3.5 rounded-xl font-semibold transition-all active:scale-95 group"
                >
                    {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                        <>
                        {isLogin ? t('loginAction') : t('registerAction')}
                        <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                        </>
                    )}
                </button>
            </form>

            <div className="mt-8 text-center">
                <button 
                    onClick={() => { setIsLogin(!isLogin); setUsername(''); }}
                    className="text-sm text-neutral-400 hover:text-white transition-colors"
                >
                    {isLogin ? t('noAccount') : t('haveAccount')} <span className="underline underline-offset-4 decoration-neutral-700 hover:decoration-white">{isLogin ? t('registerAction') : t('loginAction')}</span>
                </button>
            </div>
        </div>
      </div>
      
      <div className="absolute bottom-8 text-neutral-700 text-xs font-mono">
          SECURE QUANTITATIVE ENVIRONMENT V2.5
      </div>
    </div>
  );
};
