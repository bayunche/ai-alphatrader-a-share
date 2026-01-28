/**
 * GitHub Release 更新检查服务
 * 用于检查 GitHub 仓库是否有新版本发布
 */

const GITHUB_REPO = 'bayunche/ai-alphatrader-a-share';
const GITHUB_API_BASE = 'https://api.github.com';

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

/**
 * 比较两个语义化版本号
 * @returns 1 if v1 > v2, -1 if v1 < v2, 0 if equal
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
 * 获取当前应用版本号
 */
export function getCurrentVersion(): string {
    return '1.0.0'; // 与 package.json 保持同步
}

/**
 * 检查 GitHub 是否有新版本
 * @param currentVersion 当前版本号
 */
export async function checkForUpdate(currentVersion?: string): Promise<UpdateCheckResult> {
    const version = currentVersion || getCurrentVersion();

    try {
        const response = await fetch(
            `${GITHUB_API_BASE}/repos/${GITHUB_REPO}/releases/latest`,
            {
                headers: {
                    Accept: 'application/vnd.github.v3+json',
                    // 注意：未认证请求限制为 60 次/小时
                },
            }
        );

        if (response.status === 404) {
            // 没有发布过 Release
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
            error: error?.message || 'Failed to check for updates',
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
