import { useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { CapacitorUpdater } from '@capgo/capacitor-updater';
import { trackErrorWarning, trackErrorCritical } from '../analytics/gaTracker';
import { initOtaInfo, getOtaInfoSync } from '../utils/otaInfo';
import { getOtaErrorStreak } from '../utils/crashReporter';

const UPDATE_URL = 'https://civ-game-ota-1258335979.cos-website.ap-guangzhou.myqcloud.com/ota/production/updates.json';
const TOAST_MS = 4000;
const TOAST_LONG_MS = 10000;
const DELETE_RETRY_COUNT = 3;
const DELETE_RETRY_DELAY_MS = 1000;
// Delay OTA check to avoid memory overlap with game initialization
const OTA_CHECK_DELAY_MS = 10000;
// Memory usage threshold — skip OTA download if heap usage exceeds this ratio
const OTA_MEMORY_THRESHOLD = 0.6;
// Auto-rollback: max errors allowed within the monitoring window before triggering rollback
const ROLLBACK_ERROR_THRESHOLD = 3;
// Auto-rollback: monitoring window duration (ms) after app startup
const ROLLBACK_WINDOW_MS = 30000;
// localStorage key to prevent infinite rollback loops
const ROLLBACK_DONE_KEY = 'civ_ota_rollback_done';

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

        // Skip bundles that are downloading, pending, or already set for next launch
        const SKIP_STATUSES = new Set(['downloading', 'pending', 'set']);
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

// ── OTA startup diagnostic persistence ──
const OTA_DIAG_LOG_KEY = 'civ_crash_log';
const OTA_DIAG_HISTORY_KEY = 'civ_crash_history';
const MAX_DIAG_HISTORY = 20;

function _safeGet(key) { try { return localStorage.getItem(key); } catch { return null; } }
function _safeSet(key, v) { try { localStorage.setItem(key, v); } catch { /* ignore */ } }

/**
 * Persist an OTA diagnostic event to civ_crash_log + history.
 * Records bundle info, URLs, and memory snapshot for post-mortem analysis.
 */
function persistOtaDiagnostic(eventType, extra = {}) {
    const otaInfo = getOtaInfoSync();
    const mem = performance?.memory;
    const record = {
        type: eventType,
        message: extra.error || eventType,
        timestamp: Date.now(),
        appVersion: typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'unknown',
        isOTA: otaInfo.isOTA,
        bundleVersion: otaInfo.bundleVersion,
        bundleId: otaInfo.bundleId,
        baseURI: typeof document !== 'undefined' ? document.baseURI : '',
        locationHref: typeof location !== 'undefined' ? location.href : '',
        importMetaUrl: import.meta.url,
        memoryMB: mem ? Math.round(mem.usedJSHeapSize / 1048576) : null,
        heapLimitMB: mem ? Math.round(mem.jsHeapSizeLimit / 1048576) : null,
        ...extra,
    };
    // Write latest diagnostic
    _safeSet(OTA_DIAG_LOG_KEY, JSON.stringify(record));
    // Append to history ring buffer
    try {
        const raw = _safeGet(OTA_DIAG_HISTORY_KEY);
        const history = raw ? JSON.parse(raw) : [];
        history.push(record);
        while (history.length > MAX_DIAG_HISTORY) history.shift();
        _safeSet(OTA_DIAG_HISTORY_KEY, JSON.stringify(history));
    } catch { /* ignore */ }
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
                persistOtaDiagnostic('ota_notify_fail', { error: e?.message || String(e) });
            }

            if (cancelled) return;

            // 1.1 Initialize shared OTA info cache & write startup diagnostic
            await initOtaInfo();
            persistOtaDiagnostic('ota_startup');

            // 1.2 Check for consecutive OTA errors — warn user if pattern detected
            const otaStreak = getOtaErrorStreak();
            if (otaStreak >= 3) {
                showOtaToast('OTA 更新可能存在问题，建议重新安装 APP', 'error', TOAST_LONG_MS);
                trackErrorWarning(`OTA_ConsecutiveErrors: ${otaStreak} consecutive OTA errors detected`);
            }

            // 1.5. Delay OTA check to let game finish initialization and stabilize memory
            console.log(`[OTA] Delaying update check by ${OTA_CHECK_DELAY_MS / 1000}s to avoid memory overlap with game init...`);
            await new Promise((resolve) => {
                const timer = setTimeout(resolve, OTA_CHECK_DELAY_MS);
                // If user switches to background during delay, wait for foreground resume
                const checkVisibility = () => {
                    if (document.visibilityState === 'hidden') {
                        clearTimeout(timer);
                        const onVisible = () => {
                            if (document.visibilityState === 'visible') {
                                document.removeEventListener('visibilitychange', onVisible);
                                // Restart the delay timer after returning to foreground
                                setTimeout(resolve, OTA_CHECK_DELAY_MS);
                            }
                        };
                        document.removeEventListener('visibilitychange', checkVisibility);
                        document.addEventListener('visibilitychange', onVisible);
                    }
                };
                document.addEventListener('visibilitychange', checkVisibility);
                // Cleanup listener when timer fires normally
                const origResolve = resolve;
                resolve = () => {
                    document.removeEventListener('visibilitychange', checkVisibility);
                    origResolve();
                };
            });
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
                return;
            }

            // 6. Memory guard: skip download if heap usage is too high
            if (performance?.memory) {
                const { usedJSHeapSize, jsHeapSizeLimit } = performance.memory;
                const memRatio = usedJSHeapSize / jsHeapSizeLimit;
                console.log(`[OTA] Memory check: ${(memRatio * 100).toFixed(1)}% used (${(usedJSHeapSize / 1048576).toFixed(1)}MB / ${(jsHeapSizeLimit / 1048576).toFixed(1)}MB)`);
                if (memRatio > OTA_MEMORY_THRESHOLD) {
                    console.warn(`[OTA] Memory usage ${(memRatio * 100).toFixed(1)}% exceeds ${OTA_MEMORY_THRESHOLD * 100}% threshold, skipping download`);
                    showOtaToast('内存不足，更新将在下次启动时进行', 'warn', TOAST_LONG_MS);
                    trackErrorWarning(`OTA_SkippedHighMemory: ${(memRatio * 100).toFixed(1)}% used, threshold ${OTA_MEMORY_THRESHOLD * 100}%`);
                    return;
                }
            }

            // 7. 下载新 bundle
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

                // 8. 下载成功后立即清理：保护新 bundle + 当前正在运行的 bundle
                if (bundle?.id) {
                    // BUG FIX: 必须同时保护当前 bundle 和新 bundle，
                    // 否则当前正在运行的 bundle 会被误删，导致资源缺失闪退
                    const { protectedIds: currentIds } = await getCurrentBundleInfo();
                    const postDownloadProtected = new Set([bundle.id, ...currentIds]);
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

        // ── OTA Auto-Rollback Protection ──
        // Monitor uncaught errors within ROLLBACK_WINDOW_MS after startup.
        // If error count >= ROLLBACK_ERROR_THRESHOLD and running from OTA bundle,
        // auto-rollback to builtin bundle to recover from a broken OTA update.
        let rollbackErrorCount = 0;
        let rollbackTimer = null;
        let rollbackErrorHandler = null;
        let rollbackRejectionHandler = null;

        function cleanupRollbackMonitor() {
            if (rollbackTimer) { clearTimeout(rollbackTimer); rollbackTimer = null; }
            if (rollbackErrorHandler) { window.removeEventListener('error', rollbackErrorHandler); rollbackErrorHandler = null; }
            if (rollbackRejectionHandler) { window.removeEventListener('unhandledrejection', rollbackRejectionHandler); rollbackRejectionHandler = null; }
        }

        async function triggerAutoRollback() {
            cleanupRollbackMonitor();
            const otaInfo = getOtaInfoSync();
            // Only rollback if running from OTA bundle (not builtin)
            if (!otaInfo.isOTA) return;
            // Prevent infinite rollback loop: if we already rolled back once, don't do it again
            try {
                if (localStorage.getItem(ROLLBACK_DONE_KEY) === 'true') {
                    console.warn('[OTA Rollback] Already rolled back once, skipping to avoid infinite loop');
                    return;
                }
            } catch { /* ignore */ }

            console.error(`[OTA Rollback] ${rollbackErrorCount} errors in ${ROLLBACK_WINDOW_MS / 1000}s, rolling back to builtin bundle`);
            showOtaToast('检测到异常，正在回滚到稳定版本', 'error', TOAST_LONG_MS);
            trackErrorCritical(`OTA_AutoRollback: ${rollbackErrorCount} errors within ${ROLLBACK_WINDOW_MS / 1000}s, bundle=${otaInfo.bundleVersion}`);
            persistOtaDiagnostic('ota_auto_rollback', {
                errorCount: rollbackErrorCount,
                windowMs: ROLLBACK_WINDOW_MS,
            });

            try {
                // Mark rollback as done to prevent loop
                localStorage.setItem(ROLLBACK_DONE_KEY, 'true');
            } catch { /* ignore */ }

            try {
                await CapacitorUpdater.reset();
                // reset() triggers app restart to builtin bundle
            } catch (e) {
                console.error('[OTA Rollback] CapacitorUpdater.reset() failed:', e);
            }
        }

        function onRollbackError() {
            rollbackErrorCount++;
            if (rollbackErrorCount >= ROLLBACK_ERROR_THRESHOLD) {
                triggerAutoRollback();
            }
        }

        // Install rollback monitors
        rollbackErrorHandler = onRollbackError;
        rollbackRejectionHandler = onRollbackError;
        window.addEventListener('error', rollbackErrorHandler);
        window.addEventListener('unhandledrejection', rollbackRejectionHandler);

        // Clear rollback-done flag on successful startup (no errors within window)
        rollbackTimer = setTimeout(() => {
            cleanupRollbackMonitor();
            // Startup was stable — clear the rollback-done flag so future OTA updates can rollback if needed
            try { localStorage.removeItem(ROLLBACK_DONE_KEY); } catch { /* ignore */ }
            console.log(`[OTA Rollback] Monitoring window passed (${ROLLBACK_WINDOW_MS / 1000}s), ${rollbackErrorCount} errors — no rollback needed`);
        }, ROLLBACK_WINDOW_MS);

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
            cleanupRollbackMonitor();
        };
    }, []);
}
