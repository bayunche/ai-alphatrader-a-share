
import React from 'react';
import { LayoutDashboard, Settings, History, Activity, FileText, Download, Zap, Languages, LogOut, UserCircle, X } from 'lucide-react';
import { useTranslation } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onExport: () => void;
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, onExport, isOpen, onClose }) => {
  const { t, language, setLanguage } = useTranslation();
  const { user, logout } = useAuth();

  const navItems = [
    { id: 'dashboard', icon: LayoutDashboard, label: t('dashboard') },
    { id: 'market', icon: Activity, label: t('market') },
    { id: 'history', icon: History, label: t('history') },
    { id: 'logs', icon: FileText, label: t('logs') },
    { id: 'settings', icon: Settings, label: t('settings') },
  ];

  const toggleLanguage = () => {
    setLanguage(language === 'zh' ? 'en' : 'zh');
  };

  const handleNav = (id: string) => {
      setActiveTab(id);
      onClose(); // Close drawer on mobile when item selected
  };

  const SidebarContent = () => (
      <>
        <div className="p-6 pb-4 flex justify-between items-start">
            <div>
                <h1 className="text-2xl font-medium text-white tracking-tight flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-black shadow-lg shadow-white/10">
                    <Zap className="w-4 h-4 fill-black" />
                </div>
                AlphaTrader
                </h1>
                <p className="text-xs text-neutral-500 mt-2 font-medium ml-1">{t('subtitle')}</p>
            </div>
            {/* Only show Close button on mobile drawer mode */}
            <button onClick={onClose} className="md:hidden text-neutral-400 hover:text-white">
                <X className="w-6 h-6" />
            </button>
        </div>

        <nav className="flex-1 px-4 space-y-1 mt-6 overflow-y-auto custom-scrollbar">
            {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
                <button
                key={item.id}
                onClick={() => handleNav(item.id)}
                className={`relative group w-full flex items-center gap-3 px-5 py-3.5 rounded-2xl transition-all duration-500 ease-out ${
                    isActive
                    ? 'bg-white text-black shadow-xl shadow-white/5 translate-x-2'
                    : 'text-neutral-400 hover:bg-white/5 hover:text-white hover:translate-x-1'
                }`}
                >
                <item.icon className={`w-5 h-5 transition-transform duration-500 ${isActive ? 'scale-110' : 'group-hover:scale-110'}`} />
                <span className="font-medium tracking-wide text-sm">{item.label}</span>
                </button>
            );
            })}
        </nav>

        <div className="p-6 border-t border-glass-border space-y-3 bg-black/20">
            {/* User Profile */}
            <div className="flex items-center gap-3 px-2 py-2 mb-2">
                <div className="w-8 h-8 rounded-full bg-neutral-800 flex items-center justify-center text-white border border-white/10">
                    <UserCircle className="w-5 h-5" />
                </div>
                <div className="overflow-hidden">
                    <p className="text-sm font-medium text-white truncate">{user?.username}</p>
                    <p className="text-[10px] text-neutral-500 uppercase tracking-wider">ID: {user?.id.substring(0, 4)}...</p>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
                <button 
                onClick={toggleLanguage}
                className="group flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-white py-3 rounded-xl transition-all duration-300 border border-white/5 backdrop-blur-md"
                >
                <Languages className="w-4 h-4" />
                <span className="text-xs font-medium">{language === 'zh' ? 'EN' : '中'}</span>
                </button>

                <button 
                onClick={onExport}
                className="group flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 text-neutral-300 py-3 rounded-xl transition-all duration-300 border border-white/5 backdrop-blur-md"
                >
                <Download className="w-4 h-4" />
                <span className="text-xs font-medium">{t('exportData').split(' ')[0]}</span>
                </button>
            </div>

            <button 
            onClick={logout}
            className="group w-full flex items-center justify-center gap-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 py-3 rounded-xl transition-all duration-300 border border-red-500/10 backdrop-blur-md mt-2"
            >
            <LogOut className="w-4 h-4" />
            <span className="text-sm font-medium">{t('logout')}</span>
            </button>
        </div>
      </>
  );

  return (
    <>
        {/* Mobile: Backdrop */}
        <div 
            className={`fixed inset-0 bg-black/80 backdrop-blur-sm z-30 transition-opacity duration-300 md:hidden ${isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
            onClick={onClose}
        />

        {/* Mobile: Drawer */}
        <div className={`
            fixed inset-y-0 left-0 z-40
            w-[280px] h-full flex flex-col 
            bg-black/90 backdrop-blur-xl 
            border-r border-glass-border
            transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]
            md:hidden
            ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        `}>
            <SidebarContent />
        </div>

        {/* Desktop: Floating Card */}
        <div className={`
            hidden md:flex
            w-[280px] h-full flex-col 
            bg-black/40 backdrop-blur-xl 
            border border-glass-border rounded-3xl
            shadow-2xl
        `}>
            <SidebarContent />
        </div>
    </>
  );
};
