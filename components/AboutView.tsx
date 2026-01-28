import React, { useState } from 'react';
import { Github, ExternalLink, RefreshCw, CheckCircle, AlertCircle, Zap, Code, Database, Cpu, Download } from 'lucide-react';
import { useTranslation } from '../contexts/LanguageContext';
import {
    checkForUpdate,
    checkTauriUpdate,
    installTauriUpdate,
    getCurrentVersion,
    getGitHubRepoUrl,
    getReleasesUrl,
    isTauriEnv,
    ReleaseInfo
} from '../services/updateService';

type UpdateStatus = 'idle' | 'checking' | 'latest' | 'available' | 'downloading' | 'error';

export const AboutView: React.FC = () => {
    const { t } = useTranslation();
    const [updateStatus, setUpdateStatus] = useState<UpdateStatus>('idle');
    const [latestRelease, setLatestRelease] = useState<ReleaseInfo | null>(null);
    const [tauriManifest, setTauriManifest] = useState<any>(null);
    const [errorMsg, setErrorMsg] = useState<string>('');

    const currentVersion = getCurrentVersion();
    const isTauri = isTauriEnv();

    const handleCheckUpdate = async () => {
        setUpdateStatus('checking');
        setErrorMsg('');

        if (isTauri) {
            // 使用 Tauri 原生更新检查
            const result = await checkTauriUpdate();
            if (result.error) {
                setUpdateStatus('error');
                setErrorMsg(result.error);
            } else if (result.shouldUpdate && result.manifest) {
                setUpdateStatus('available');
                setTauriManifest(result.manifest);
            } else {
                setUpdateStatus('latest');
            }
        } else {
            // Web 环境使用 GitHub API
            const result = await checkForUpdate(currentVersion);
            if (result.error) {
                setUpdateStatus('error');
                setErrorMsg(result.error);
            } else if (result.hasUpdate && result.latestRelease) {
                setUpdateStatus('available');
                setLatestRelease(result.latestRelease);
            } else {
                setUpdateStatus('latest');
                setLatestRelease(result.latestRelease);
            }
        }
    };

    const handleInstallUpdate = async () => {
        if (isTauri) {
            // Tauri 原生自动更新
            setUpdateStatus('downloading');
            const result = await installTauriUpdate();
            if (!result.success) {
                setUpdateStatus('error');
                setErrorMsg(result.error || '安装失败');
            }
            // 如果成功，应用会自动重启
        } else {
            // Web 环境跳转到 GitHub 下载
            if (latestRelease?.htmlUrl) {
                window.open(latestRelease.htmlUrl, '_blank');
            } else {
                window.open(getReleasesUrl(), '_blank');
            }
        }
    };

    const getNewVersion = (): string => {
        if (tauriManifest?.version) return tauriManifest.version;
        if (latestRelease?.version) return latestRelease.version;
        return '';
    };

    const techStack = [
        { name: 'React 18', icon: Code, color: 'text-cyan-400' },
        { name: 'TypeScript', icon: Code, color: 'text-blue-400' },
        { name: 'Tauri', icon: Cpu, color: 'text-orange-400' },
        { name: 'SQLite', icon: Database, color: 'text-emerald-400' },
    ];

    return (
        <div className="max-w-3xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
            {/* Header Card */}
            <div className="bg-white/5 backdrop-blur-xl border border-glass-border rounded-3xl p-8 mb-6 text-center">
                <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-white flex items-center justify-center shadow-xl shadow-white/10">
                    <Zap className="w-10 h-10 text-black fill-black" />
                </div>
                <h1 className="text-3xl font-bold text-white mb-2">AI AlphaTrader</h1>
                <p className="text-neutral-400 mb-4">{t('subtitle')}</p>
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 rounded-full">
                    <span className="text-neutral-300 text-sm">{t('version')}</span>
                    <span className="text-white font-mono font-bold">{currentVersion}</span>
                    {isTauri && (
                        <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full">
                            Desktop
                        </span>
                    )}
                </div>
            </div>

            {/* Update Check Card */}
            <div className="bg-white/5 backdrop-blur-xl border border-glass-border rounded-3xl p-6 mb-6">
                <h2 className="text-lg font-medium text-white mb-4">{t('checkUpdate')}</h2>

                <div className="flex flex-col sm:flex-row items-center gap-4">
                    <button
                        onClick={handleCheckUpdate}
                        disabled={updateStatus === 'checking' || updateStatus === 'downloading'}
                        className="flex items-center gap-2 px-6 py-3 bg-white text-black rounded-xl font-medium hover:bg-neutral-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <RefreshCw className={`w-4 h-4 ${updateStatus === 'checking' ? 'animate-spin' : ''}`} />
                        {updateStatus === 'checking' ? t('checking') : t('checkUpdate')}
                    </button>

                    {/* Status Display */}
                    <div className="flex-1">
                        {updateStatus === 'latest' && (
                            <div className="flex items-center gap-2 text-emerald-400">
                                <CheckCircle className="w-5 h-5" />
                                <span>{t('latestVersion')}</span>
                            </div>
                        )}

                        {updateStatus === 'available' && (
                            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                                <div className="flex items-center gap-2 text-amber-400">
                                    <AlertCircle className="w-5 h-5" />
                                    <span>{t('updateAvailable')}</span>
                                    <span className="font-mono bg-amber-500/20 px-2 py-0.5 rounded text-sm">
                                        {getNewVersion()}
                                    </span>
                                </div>
                                <button
                                    onClick={handleInstallUpdate}
                                    className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-black rounded-lg font-medium hover:bg-amber-400 transition-all text-sm"
                                >
                                    {isTauri ? (
                                        <>
                                            <Download className="w-4 h-4" />
                                            自动更新
                                        </>
                                    ) : (
                                        <>
                                            <ExternalLink className="w-4 h-4" />
                                            {t('updateNow')}
                                        </>
                                    )}
                                </button>
                            </div>
                        )}

                        {updateStatus === 'downloading' && (
                            <div className="flex items-center gap-2 text-blue-400">
                                <RefreshCw className="w-5 h-5 animate-spin" />
                                <span>正在下载并安装更新...</span>
                            </div>
                        )}

                        {updateStatus === 'error' && (
                            <div className="flex items-center gap-2 text-red-400">
                                <AlertCircle className="w-5 h-5" />
                                <span>{errorMsg}</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Auto-update hint for Tauri */}
                {isTauri && updateStatus === 'idle' && (
                    <p className="text-neutral-500 text-xs mt-4">
                        💡 桌面版支持自动更新，检测到新版本后可一键安装
                    </p>
                )}
            </div>

            {/* Tech Stack Card */}
            <div className="bg-white/5 backdrop-blur-xl border border-glass-border rounded-3xl p-6 mb-6">
                <h2 className="text-lg font-medium text-white mb-4">{t('techStack')}</h2>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {techStack.map((tech) => (
                        <div
                            key={tech.name}
                            className="flex items-center gap-3 p-4 bg-white/5 rounded-xl border border-white/5 hover:bg-white/10 transition-all"
                        >
                            <tech.icon className={`w-5 h-5 ${tech.color}`} />
                            <span className="text-neutral-300 text-sm font-medium">{tech.name}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Open Source Card */}
            <div className="bg-white/5 backdrop-blur-xl border border-glass-border rounded-3xl p-6">
                <h2 className="text-lg font-medium text-white mb-4">{t('openSource')}</h2>
                <p className="text-neutral-400 text-sm mb-4">
                    本项目为开源项目，欢迎贡献代码和提出建议。
                </p>
                <a
                    href={getGitHubRepoUrl()}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-5 py-3 bg-neutral-800 hover:bg-neutral-700 text-white rounded-xl transition-all border border-white/10"
                >
                    <Github className="w-5 h-5" />
                    <span className="font-medium">GitHub</span>
                    <ExternalLink className="w-4 h-4 ml-1 text-neutral-400" />
                </a>
            </div>
        </div>
    );
};
