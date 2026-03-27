import { useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { CapacitorUpdater } from '@capgo/capacitor-updater';

const UPDATE_URL = 'https://civ-game-ota-1258335979.cos-website.ap-guangzhou.myqcloud.com/ota/production/updates.json';
const TOAST_MS = 4000;
const TOAST_LONG_MS = 10000;

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

/**
 * OTA 热更新 Hook —— 手动 GET 模式。
 *
 * 由于 COS 静态托管不支持 POST，我们绕过 Capgo 的 autoUpdate，
 * 自行用 GET 拉取 updates.json，比较版本后调用插件 download/set API。
 */
export function useOtaUpdate() {
    const hasRun = useRef(false);

    useEffect(() => {
        if (!Capacitor.isNativePlatform()) return;
        if (hasRun.current) return;
        hasRun.current = true;

        let cancelled = false;

        async function checkAndUpdate() {
            // 1. 必须先调用 notifyAppReady，否则插件会在 10s 后自动回滚
            try {
                await CapacitorUpdater.notifyAppReady();
                console.log('[OTA] notifyAppReady OK');
            } catch (e) {
                console.warn('[OTA] notifyAppReady failed:', e);
            }

            if (cancelled) return;

            // 2. 获取当前 bundle 版本
            let currentVersion = 'builtin';
            try {
                const current = await CapacitorUpdater.current();
                currentVersion = current?.bundle?.version || 'builtin';
                console.log('[OTA] 当前 bundle:', JSON.stringify(current?.bundle));
            } catch (e) {
                console.warn('[OTA] current() failed:', e);
            }

            // 3. GET 拉取 updates.json
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

            // 4. 版本比较
            if (!serverData.version || serverData.version === currentVersion) {
                console.log('[OTA] 无需更新 (当前:', currentVersion, '服务器:', serverData.version, ')');
                showOtaToast('当前已是最新版本 ✓', 'success');
                return;
            }

            // 5. 下载新 bundle
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

                // 6. 设置为下次启动使用的 bundle
                await CapacitorUpdater.set(bundle);
                showOtaToast('更新已就绪，重启 APP 即可生效 🚀', 'success', TOAST_LONG_MS);
            } catch (e) {
                console.error('[OTA] 下载/安装失败:', e);
                showOtaToast(`更新失败: ${e.message}`, 'error', TOAST_LONG_MS);
            } finally {
                downloadListener?.remove();
            }
        }

        checkAndUpdate();

        return () => { cancelled = true; };
    }, []);
}
