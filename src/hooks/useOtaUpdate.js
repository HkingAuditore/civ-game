import { useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { CapacitorUpdater } from '@capgo/capacitor-updater';
import { trackErrorWarning } from '../analytics/gaTracker';

const UPDATE_URL = 'https://civ-game-ota-1258335979.cos-website.ap-guangzhou.myqcloud.com/ota/production/updates.json';
const TOAST_MS = 4000;
const TOAST_LONG_MS = 10000;
const DELETE_RETRY_COUNT = 3;
const DELETE_RETRY_DELAY_MS = 1000;

let toastEl = null;
let hideTimer = null;

function showOtaToast(message, level = 'info', duration = TOAST_MS) {
    if (typeof document === 'undefined') return;

    if (!toastEl) {
        toastEl = document.createElement('div');
        toastEl.id = 'ota-toast';
        Object.assign(toastEl.style, {
            position: 'fixed',
            bottom: '80px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: '99999',
            padding: '10px 20px',
            borderRadius: '8px',
            fontSize: '13px',
            fontWeight: '600',
            color: '#fff',
            maxWidth: '90vw',
            textAlign: 'center',
            pointerEvents: 'none',
            opacity: '0',
            transition: 'opacity 0.3s ease',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
        });
        document.body.appendChild(toastEl);
    }

    const bgMap = {
        info: 'rgba(59,130,246,0.92)',
        success: 'rgba(34,197,94,0.92)',
        warn: 'rgba(234,179,8,0.92)',
        error: 'rgba(239,68,68,0.92)',
    };

    toastEl.textContent = message;
    toastEl.style.background = bgMap[level] || bgMap.info;
    toastEl.style.opacity = '1';

    clearTimeout(hideTimer);
    if (duration > 0) {
        hideTimer = setTimeout(() => {
            if (toastEl) toastEl.style.opacity = '0';
        }, duration);
    }
}

function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
}

/**
 * 带重试的 bundle 删除。
 * Capgo 插件在某些设备上首次 delete 会因文件锁等原因静默失败，
 * 重试 2-3 次通常能成功。
 */
async function deleteBundleWithRetry(bundleId, retries = DELETE_RETRY_COUNT) {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            await CapacitorUpdater.delete({ id: bundleId });
            return true;
        } catch (e) {
            if (attempt < retries) {
                await sleep(DELETE_RETRY_DELAY_MS * attempt);
            } else {
                throw e;
            }
        }
    }
    return false;
}

/**
 * 清理非当前使用的旧 OTA bundle，释放存储空间。
 * 每个 bundle 约 29MB，频繁更新后旧包堆积会导致缓存膨胀。
 *
 * @param {Set<string>} protectedIds - 不可删除的 bundle ID 集合（当前使用 + 刚下载的）
 */
async function cleanupOldBundles(protectedIds) {
    if (!protectedIds || protectedIds.size === 0) {
        console.warn('[OTA cleanup] 无法确定当前 bundle，跳过清理以防误删');
        return { cleaned: 0, failed: 0, total: 0 };
    }

    try {
        const { bundles } = await CapacitorUpdater.list();
        if (!bundles || bundles.length === 0) {
            return { cleaned: 0, failed: 0, total: 0 };
        }

        const SKIP_STATUSES = new Set(['downloading', 'pending']);
        const toDelete = bundles.filter(b =>
            !protectedIds.has(b.id) && !SKIP_STATUSES.has(b.status)
        );

        if (toDelete.length === 0) {
            return { cleaned: 0, failed: 0, total: bundles.length };
        }

        console.log(`[OTA cleanup] 发现 ${toDelete.length} 个旧 bundle 待清理（共 ${bundles.length} 个）`);

        let cleaned = 0;
        let failed = 0;
        const failedIds = [];

        for (const bundle of toDelete) {
            try {
                await deleteBundleWithRetry(bundle.id);
                cleaned++;
                console.log('[OTA cleanup] 已删除:', bundle.id, bundle.version);
            } catch (e) {
                failed++;
                failedIds.push(bundle.id);
                console.warn('[OTA cleanup] 删除失败（已重试）:', bundle.id, e?.message || e);
            }
        }

        if (failed > 0) {
            trackErrorWarning(`OTA_CleanupPartialFail: ${failed}/${toDelete.length} bundles failed to delete [${failedIds.join(',')}]`);
        }

        if (cleaned > 0) {
            console.log(`[OTA cleanup] 完成：删除 ${cleaned}，失败 ${failed}`);
        }

        return { cleaned, failed, total: bundles.length };
    } catch (e) {
        console.warn('[OTA cleanup] list() 或清理流程异常:', e);
        trackErrorWarning(`OTA_CleanupError: ${e?.message || e}`);
        return { cleaned: 0, failed: 0, total: -1 };
    }
}

/**
 * 获取当前 bundle 信息，返回 protectedIds 集合和版本号。
 */
async function getCurrentBundleInfo() {
    let currentVersion = 'builtin';
    const protectedIds = new Set();

    try {
        const current = await CapacitorUpdater.current();
        currentVersion = current?.bundle?.version || 'builtin';
        if (current?.bundle?.id) {
            protectedIds.add(current.bundle.id);
        }
        console.log('[OTA] 当前 bundle:', JSON.stringify(current?.bundle));
    } catch (e) {
        console.warn('[OTA] current() failed:', e);
    }

    return { currentVersion, protectedIds };
}

/**
 * OTA 热更新 Hook —— 手动 GET 模式。
 *
 * 由于 COS 静态托管不支持 POST，我们绕过 Capgo 的 autoUpdate，
 * 自行用 GET 拉取 updates.json，比较版本后调用插件 download/set API。
 *
 * 清理策略：
 * 1. 启动时清理旧 bundle（带重试 + 失败上报）
 * 2. 下载新版本成功后立即再清理一次（此时旧的当前 bundle 也可以删）
 * 3. APP 从后台恢复时再清理一次（覆盖用户长时间不重启 APP 的场景）
 */
export function useOtaUpdate() {
    const hasRun = useRef(false);
    const protectedIdsRef = useRef(new Set());

    useEffect(() => {
        if (!Capacitor.isNativePlatform()) return;
        if (hasRun.current) return;
        hasRun.current = true;

        let cancelled = false;

        async function checkAndUpdate() {
            // 1. notifyAppReady：必须首先调用，否则插件 10s 后自动回滚
            try {
                await CapacitorUpdater.notifyAppReady();
                console.log('[OTA] notifyAppReady OK');
            } catch (e) {
                console.warn('[OTA] notifyAppReady failed:', e);
            }

            if (cancelled) return;

            // 2. 获取当前 bundle 信息
            const { currentVersion, protectedIds } = await getCurrentBundleInfo();
            protectedIdsRef.current = protectedIds;

            // 3. 启动时清理旧 bundle
            const startupCleanup = await cleanupOldBundles(protectedIds);
            if (startupCleanup.failed > 0) {
                console.warn('[OTA] 启动清理有失败项，将在下次启动重试');
            }

            if (cancelled) return;

            // 4. GET 拉取 updates.json
            let serverData;
            try {
                showOtaToast('检查更新中...', 'info', TOAST_MS);
                const resp = await fetch(UPDATE_URL, {
                    method: 'GET',
                    cache: 'no-store',
                    headers: { 'Accept': 'application/json' },
                });
                if (!resp.ok) {
                    showOtaToast(`更新服务器异常 (${resp.status})`, 'error', TOAST_LONG_MS);
                    return;
                }
                const text = await resp.text();
                serverData = JSON.parse(text.replace(/^\uFEFF/, ''));
                console.log('[OTA] 服务器版本:', serverData.version);
            } catch (e) {
                console.error('[OTA] 检查更新失败:', e);
                showOtaToast(`检查更新失败: ${e.message}`, 'error', TOAST_LONG_MS);
                return;
            }

            if (cancelled) return;

            // 5. 版本比较
            if (!serverData.version || serverData.version === currentVersion) {
                console.log('[OTA] 无需更新 (当前:', currentVersion, '服务器:', serverData.version, ')');
                showOtaToast('当前已是最新版本 ✓', 'success');
                return;
            }

            // 6. 下载新 bundle
            console.log('[OTA] 发现新版本:', serverData.version, '→ 开始下载');
            showOtaToast(`发现新版本，正在下载...`, 'info', 0);

            let downloadListener = null;
            try {
                downloadListener = await CapacitorUpdater.addListener('download', (event) => {
                    const pct = event.percent || 0;
                    if (pct % 10 === 0 || pct >= 95) {
                        showOtaToast(`下载更新 ${pct}%`, 'info', 0);
                    }
                });

                const bundle = await CapacitorUpdater.download({
                    url: serverData.url,
                    version: serverData.version,
                });

                if (cancelled) return;
                console.log('[OTA] 下载完成, bundle id:', bundle?.id);

                // 7. 设置为下次启动使用的 bundle
                await CapacitorUpdater.set(bundle);
                showOtaToast('更新已就绪，重启 APP 即可生效 🚀', 'success', TOAST_LONG_MS);

                // 8. 下载成功后立即清理：新 bundle 加入保护列表，旧的当前 bundle 可以删除
                if (bundle?.id) {
                    const postDownloadProtected = new Set([bundle.id]);
                    protectedIdsRef.current = postDownloadProtected;
                    const postCleanup = await cleanupOldBundles(postDownloadProtected);
                    if (postCleanup.cleaned > 0) {
                        console.log(`[OTA] 下载后清理：释放 ${postCleanup.cleaned} 个旧 bundle`);
                    }
                }
            } catch (e) {
                console.error('[OTA] 下载/安装失败:', e);
                showOtaToast(`更新失败: ${e.message}`, 'error', TOAST_LONG_MS);
            } finally {
                downloadListener?.remove();
            }
        }

        checkAndUpdate();

        // APP 从后台恢复时再清理一次
        function handleResume() {
            if (protectedIdsRef.current.size > 0) {
                cleanupOldBundles(protectedIdsRef.current).then(result => {
                    if (result.cleaned > 0) {
                        console.log(`[OTA resume] 后台恢复清理：释放 ${result.cleaned} 个旧 bundle`);
                    }
                });
            }
        }

        let resumeListener = null;
        CapacitorUpdater.addListener('appStateChange', (state) => {
            if (state?.isActive) handleResume();
        }).then(l => { resumeListener = l; }).catch(() => {});

        return () => {
            cancelled = true;
            resumeListener?.remove();
        };
    }, []);
}
