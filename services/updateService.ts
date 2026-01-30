/**
 * 更新服务 - 支持 Tauri 原生更新和 GitHub Release 检查
 */

const GITHUB_REPO = 'bayunche/ai-alphatrader-a-share';
const GITHUB_API_BASE = 'https://api.github.com';
const FALLBACK_VERSION = '1.0.0';

// 缓存版本号，避免重复异步调用
let cachedVersion: string | null = null;

/** Release 信息结构 */
export interface ReleaseInfo {
    version: string;
    name: string;
    publishedAt: string;
    htmlUrl: string;
    body: string;
}

/** 更新检查结果 */
export interface UpdateCheckResult {
    hasUpdate: boolean;
    latestRelease: ReleaseInfo | null;
    error?: string;
}

/** Tauri 更新状态 */
export interface TauriUpdateResult {
    shouldUpdate: boolean;
    manifest?: {
        version: string;
        date?: string;
        body?: string;
    };
    error?: string;
}

// 检测是否在 Tauri 环境中运行
export function isTauriEnv(): boolean {
    return typeof window !== 'undefined' && '__TAURI__' in window;
}

/**
 * 比较两个语义化版本号
 */
function compareVersions(v1: string, v2: string): number {
    const normalize = (v: string) => v.replace(/^v/, '').split('.').map(Number);
    const parts1 = normalize(v1);
    const parts2 = normalize(v2);

    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
        const p1 = parts1[i] || 0;
        const p2 = parts2[i] || 0;
        if (p1 > p2) return 1;
        if (p1 < p2) return -1;
    }
    return 0;
}

/**
 * 获取当前应用版本号（异步，优先从 Tauri API 获取）
 */
export async function getVersionAsync(): Promise<string> {
    if (cachedVersion) return cachedVersion;

    if (isTauriEnv()) {
        try {
            const { getVersion } = await import('@tauri-apps/api/app');
            cachedVersion = await getVersion();
            return cachedVersion;
        } catch (e) {
            console.warn('Failed to get version from Tauri API:', e);
        }
    }

    cachedVersion = FALLBACK_VERSION;
    return cachedVersion;
}

/**
 * 获取当前应用版本号（同步，返回缓存值或回退值）
 */
export function getCurrentVersion(): string {
    return cachedVersion || FALLBACK_VERSION;
}

/**
 * Tauri 原生更新检查
 */
export async function checkTauriUpdate(): Promise<TauriUpdateResult> {
    if (!isTauriEnv()) {
        return { shouldUpdate: false, error: '非 Tauri 环境' };
    }

    try {
        // 动态导入 Tauri API
        const { checkUpdate } = await import('@tauri-apps/api/updater');
        const result = await checkUpdate();
        return {
            shouldUpdate: result.shouldUpdate,
            manifest: result.manifest
        };
    } catch (error: any) {
        console.error('Tauri update check failed:', error);
        return { shouldUpdate: false, error: error?.message || '更新检查失败' };
    }
}

/**
 * Tauri 原生安装更新并重启
 */
export async function installTauriUpdate(
    onProgress?: (downloaded: number, total: number | null) => void
): Promise<{ success: boolean; error?: string }> {
    if (!isTauriEnv()) {
        return { success: false, error: '非 Tauri 环境' };
    }

    try {
        const { installUpdate } = await import('@tauri-apps/api/updater');
        const { relaunch } = await import('@tauri-apps/api/process');

        // 安装更新（会自动下载）
        await installUpdate();

        // 重启应用以完成更新
        await relaunch();

        return { success: true };
    } catch (error: any) {
        console.error('Tauri update install failed:', error);
        return { success: false, error: error?.message || '安装更新失败' };
    }
}

/**
 * 检查 GitHub 是否有新版本（Web 回退方案）
 */
export async function checkForUpdate(currentVersion?: string): Promise<UpdateCheckResult> {
    const version = currentVersion || await getVersionAsync();

    try {
        const response = await fetch(
            `${GITHUB_API_BASE}/repos/${GITHUB_REPO}/releases/latest`,
            {
                headers: {
                    Accept: 'application/vnd.github.v3+json',
                },
            }
        );

        if (response.status === 404) {
            return { hasUpdate: false, latestRelease: null };
        }

        if (!response.ok) {
            throw new Error(`GitHub API error: ${response.status}`);
        }

        const data = await response.json();

        const latestRelease: ReleaseInfo = {
            version: data.tag_name || data.name,
            name: data.name || data.tag_name,
            publishedAt: data.published_at,
            htmlUrl: data.html_url,
            body: data.body || '',
        };

        const hasUpdate = compareVersions(latestRelease.version, version) > 0;

        return { hasUpdate, latestRelease };
    } catch (error: any) {
        console.error('Failed to check for updates:', error);
        return {
            hasUpdate: false,
            latestRelease: null,
            error: error?.message || '无法检查更新',
        };
    }
}

/**
 * 获取 GitHub 仓库链接
 */
export function getGitHubRepoUrl(): string {
    return `https://github.com/${GITHUB_REPO}`;
}

/**
 * 获取 Releases 页面链接
 */
export function getReleasesUrl(): string {
    return `https://github.com/${GITHUB_REPO}/releases`;
}
