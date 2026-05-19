/**
 * useAutoSave — 从 useGameLoop 中独立出来的自动存档调度器。
 *
 * PR-1 改造要点：
 * 1) 把原来的 setInterval(60000) 改成 setTimeout + requestIdleCallback 链，
 *    确保 saveGame 永远在帧间隙跑，不和渲染帧 / worker 消费帧抢主线程。
 * 2) 基线检查间隔收敛到"下一次距存档到期的最短时间"，避免过度轮询。
 * 3) 防重入：如果上一次 saveGame 还在进行（返回 Promise 未 resolve），
 *    本次 tick 跳过，并上报 Save:Skip:inflight，防止主线程队列积压。
 * 4) 页面隐藏时不强行在前台调用存档；页面重新可见且到期时立即补偿一次。
 *
 * @param {Object} params
 * @param {React.MutableRefObject} params.stateRef - 来自 useGameLoop 的共享 state ref
 * @param {React.MutableRefObject} params.saveGameRef - saveGame 函数的 ref（返回 Promise）
 * @param {boolean} params.isPaused - 游戏是否暂停（保留在依赖数组里以兼容原有生命周期）
 */
import { useEffect, useRef } from 'react';
import { trackSaveSkip } from '../analytics/gaTracker.js';

const BASE_POLL_MS = 60_000;           // 基准轮询窗口，保持"至少 60s 一次"的语义
const IDLE_TIMEOUT_MS = 2_000;         // requestIdleCallback 的 deadline 上限
const MIN_POLL_MS = 5_000;             // 动态窗口最小值，防止过于频繁

const scheduleIdle = (cb) => {
    if (typeof window === 'undefined') return cb();
    if (typeof window.requestIdleCallback === 'function') {
        return window.requestIdleCallback(cb, { timeout: IDLE_TIMEOUT_MS });
    }
    // 没有 rIC（Safari/部分 Android WebView）时回退到 setTimeout 让出一帧
    return window.setTimeout(cb, 0);
};

export function useAutoSave({ stateRef, saveGameRef, isPaused }) {
    const timerRef = useRef(null);
    const inflightRef = useRef(false);
    const stoppedRef = useRef(false);

    useEffect(() => {
        stoppedRef.current = false;

        const computeNextDelay = () => {
            const current = stateRef.current || {};
            const intervalSeconds = Math.max(60, current.autoSaveInterval || 60);
            const remaining = (intervalSeconds * 1000) - (Date.now() - (current.lastAutoSaveTime || 0));
            // 把下一次 tick 延到"最近一次的到期时间"，并 clamp 到合理范围
            return Math.max(MIN_POLL_MS, Math.min(BASE_POLL_MS, remaining || BASE_POLL_MS));
        };

        const runTick = () => {
            if (stoppedRef.current) return;
            const current = stateRef.current || {};
            const save = saveGameRef.current;

            if (!current.isAutoSaveEnabled || typeof save !== 'function') {
                schedule();
                return;
            }
            const intervalSeconds = Math.max(60, current.autoSaveInterval || 60);
            const elapsed = Date.now() - (current.lastAutoSaveTime || 0);
            if (elapsed < intervalSeconds * 1000) {
                schedule();
                return;
            }

            // 防重入：上一次 saveGame 还没 resolve 就直接跳过并上报
            if (inflightRef.current) {
                try { trackSaveSkip('auto', 'inflight'); } catch { /* noop */ }
                schedule();
                return;
            }

            // 页面隐藏时大多数浏览器会 throttle idle callback；这里主动跳过，
            // 下一次 visibility 事件会触发补偿。
            if (typeof document !== 'undefined' && document.hidden) {
                try { trackSaveSkip('auto', 'hidden'); } catch { /* noop */ }
                schedule();
                return;
            }

            inflightRef.current = true;
            // 先把 lastAutoSaveTime 推到"现在"，避免 saveGame 还没完成时下一次 tick 又触发
            stateRef.current.lastAutoSaveTime = Date.now();
            const done = () => {
                inflightRef.current = false;
                schedule();
            };
            try {
                const result = save({ source: 'auto' });
                if (result && typeof result.then === 'function') {
                    result.then(done, done);
                } else {
                    done();
                }
            } catch {
                done();
            }
        };

        const schedule = () => {
            if (stoppedRef.current) return;
            if (timerRef.current) {
                clearTimeout(timerRef.current);
                timerRef.current = null;
            }
            const delay = computeNextDelay();
            timerRef.current = setTimeout(() => {
                // 真正的工作都在 idle 回调里做，避开渲染关键路径
                scheduleIdle(runTick);
            }, delay);
        };

        // visibilitychange 时若刚好到期就立刻补偿一次
        const onVisibility = () => {
            if (typeof document === 'undefined' || document.hidden) return;
            scheduleIdle(runTick);
        };
        if (typeof document !== 'undefined') {
            document.addEventListener('visibilitychange', onVisibility);
        }

        schedule();

        return () => {
            stoppedRef.current = true;
            if (timerRef.current) {
                clearTimeout(timerRef.current);
                timerRef.current = null;
            }
            if (typeof document !== 'undefined') {
                document.removeEventListener('visibilitychange', onVisibility);
            }
        };
    }, [stateRef, saveGameRef, isPaused]);
}
