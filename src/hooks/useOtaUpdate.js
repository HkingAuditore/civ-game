import { useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { CapacitorUpdater } from '@capgo/capacitor-updater';

/**
 * OTA 热更新 Hook —— 仅在 Capacitor 原生平台激活。
 *
 * autoUpdate 模式下，插件会自动轮询 updateUrl、下载、在切后台时切换 bundle。
 * 本 Hook 负责：
 *   1. notifyAppReady() —— 防止插件自动回滚
 *   2. 监听关键事件并输出日志
 *   3. 根据 mandatory 标志决定是否立即重载
 */
export function useOtaUpdate() {
    const listenersRef = useRef([]);

    useEffect(() => {
        if (!Capacitor.isNativePlatform()) return;

        let cancelled = false;

        async function init() {
            try {
                await CapacitorUpdater.notifyAppReady();
            } catch (e) {
                console.warn('[OTA] notifyAppReady failed:', e);
            }

            if (cancelled) return;

            const handles = await Promise.all([
                CapacitorUpdater.addListener('updateAvailable', (event) => {
                    console.log('[OTA] 发现新版本:', event.bundle?.version);
                }),

                CapacitorUpdater.addListener('download', (event) => {
                    if (event.percent % 20 === 0 || event.percent === 100) {
                        console.log(`[OTA] 下载进度: ${event.percent}%`);
                    }
                }),

                CapacitorUpdater.addListener('downloadComplete', (event) => {
                    console.log('[OTA] 下载完成:', event.bundle?.version);
                }),

                CapacitorUpdater.addListener('downloadFailed', (event) => {
                    console.error('[OTA] 下载失败:', event.version);
                }),

                CapacitorUpdater.addListener('updateFailed', (event) => {
                    console.error('[OTA] 更新安装失败，已回滚:', event.bundle?.version);
                }),

                CapacitorUpdater.addListener('noNeedUpdate', () => {
                    console.log('[OTA] 当前已是最新版本');
                }),
            ]);

            if (!cancelled) {
                listenersRef.current = handles;
            } else {
                handles.forEach((h) => h.remove());
            }
        }

        init();

        return () => {
            cancelled = true;
            listenersRef.current.forEach((h) => h.remove());
            listenersRef.current = [];
        };
    }, []);
}
