/**
 * useMemoryMonitor - 内存监控与自动保护 Hook
 *
 * 定期检测内存使用情况，在内存压力过大时自动采取保护措施，
 * 防止移动端 WebView 因 OOM 而闪退。
 *
 * 策略：
 * - 每 30 秒检测一次内存使用（performance.memory 或启发式估算）
 * - 70% 阈值 → "警告"：翻倍 UI 数据传输间隔
 * - 85% 阈值 → "危险"：暂停游戏 + 提示保存
 * - 连续 3 次危险 → 强制降速至 1x + 禁用 Worker
 */

import { useEffect, useRef, useCallback } from 'react';

// Memory pressure levels
export const MEMORY_LEVEL = {
    NORMAL: 'normal',
    WARNING: 'warning',
    CRITICAL: 'critical',
};

// Thresholds
const WARNING_THRESHOLD = 0.70;
const CRITICAL_THRESHOLD = 0.85;
const CHECK_INTERVAL_MS = 30000; // 30 seconds
const CONSECUTIVE_CRITICAL_LIMIT = 3;

// Heuristic: track tick execution time trend as a proxy for memory pressure
// when performance.memory is unavailable
const TICK_TIME_WINDOW = 10;
const TICK_TIME_GROWTH_THRESHOLD = 1.5; // 50% growth → warning
const TICK_TIME_GROWTH_CRITICAL = 2.5;  // 150% growth → critical

/**
 * Check if performance.memory API is available (Chrome/WebView only)
 */
function hasMemoryAPI() {
    return typeof performance !== 'undefined'
        && performance.memory
        && typeof performance.memory.usedJSHeapSize === 'number'
        && typeof performance.memory.jsHeapSizeLimit === 'number';
}

/**
 * Get memory usage ratio from performance.memory
 * @returns {number|null} ratio (0-1) or null if unavailable
 */
function getMemoryRatio() {
    if (!hasMemoryAPI()) return null;
    const { usedJSHeapSize, jsHeapSizeLimit } = performance.memory;
    if (jsHeapSizeLimit <= 0) return null;
    return usedJSHeapSize / jsHeapSizeLimit;
}

/**
 * useMemoryMonitor Hook
 *
 * @param {Object} options
 * @param {Function} options.setIsPaused - Pause game setter
 * @param {Function} options.setGameSpeed - Game speed setter (optional)
 * @param {Function} options.addLog - Add log message function
 * @param {Function} options.setUiInterval - Callback to adjust Worker UI interval
 * @param {number}   options.baseUiInterval - Default BASE_UI_INTERVAL value (e.g. 10)
 * @param {boolean}  options.enabled - Whether monitoring is active (default true)
 * @returns {{ memoryLevel: string, memoryRatio: number|null }}
 */
export function useMemoryMonitor({
    setIsPaused,
    setGameSpeed,
    addLog,
    setUiInterval,
    baseUiInterval = 10,
    enabled = true,
} = {}) {
    const levelRef = useRef(MEMORY_LEVEL.NORMAL);
    const ratioRef = useRef(null);
    const consecutiveCriticalRef = useRef(0);
    const hasEscalatedRef = useRef(false);
    // Heuristic: tick execution time ring buffer
    const tickTimesRef = useRef([]);
    const originalIntervalRef = useRef(baseUiInterval);

    /**
     * Record a tick execution time (called externally from game loop)
     * Used as heuristic when performance.memory is unavailable
     */
    const recordTickTime = useCallback((ms) => {
        const buf = tickTimesRef.current;
        buf.push(ms);
        if (buf.length > TICK_TIME_WINDOW * 2) {
            // Keep last 2× window for trend comparison
            tickTimesRef.current = buf.slice(-TICK_TIME_WINDOW * 2);
        }
    }, []);

    /**
     * Estimate memory pressure from tick time trend
     * @returns {string} MEMORY_LEVEL
     */
    const estimateFromTickTimes = useCallback(() => {
        const buf = tickTimesRef.current;
        if (buf.length < TICK_TIME_WINDOW * 2) return MEMORY_LEVEL.NORMAL;

        const recentWindow = buf.slice(-TICK_TIME_WINDOW);
        const olderWindow = buf.slice(-TICK_TIME_WINDOW * 2, -TICK_TIME_WINDOW);

        const avgRecent = recentWindow.reduce((s, v) => s + v, 0) / recentWindow.length;
        const avgOlder = olderWindow.reduce((s, v) => s + v, 0) / olderWindow.length;

        if (avgOlder <= 0) return MEMORY_LEVEL.NORMAL;
        const growthRatio = avgRecent / avgOlder;

        if (growthRatio >= TICK_TIME_GROWTH_CRITICAL) return MEMORY_LEVEL.CRITICAL;
        if (growthRatio >= TICK_TIME_GROWTH_THRESHOLD) return MEMORY_LEVEL.WARNING;
        return MEMORY_LEVEL.NORMAL;
    }, []);

    /**
     * Core check: determine current memory level and take action
     */
    const checkMemory = useCallback(() => {
        if (!enabled) return;

        let level = MEMORY_LEVEL.NORMAL;
        const ratio = getMemoryRatio();
        ratioRef.current = ratio;

        if (ratio !== null) {
            // Use real memory API
            if (ratio >= CRITICAL_THRESHOLD) {
                level = MEMORY_LEVEL.CRITICAL;
            } else if (ratio >= WARNING_THRESHOLD) {
                level = MEMORY_LEVEL.WARNING;
            }
        } else {
            // Fallback: heuristic from tick times
            level = estimateFromTickTimes();
        }

        const prevLevel = levelRef.current;
        levelRef.current = level;

        // === Respond to level changes ===

        if (level === MEMORY_LEVEL.CRITICAL) {
            consecutiveCriticalRef.current++;

            // Pause game on first critical detection
            if (prevLevel !== MEMORY_LEVEL.CRITICAL) {
                if (typeof setIsPaused === 'function') {
                    setIsPaused(true);
                }
                if (typeof addLog === 'function') {
                    addLog('⚠️ [内存警告] 内存使用过高，游戏已自动暂停。建议立即保存游戏。');
                }
                console.warn('[MemoryMonitor] CRITICAL: memory usage at',
                    ratio !== null ? `${(ratio * 100).toFixed(1)}%` : 'high (heuristic)',
                    '— game paused');
            }

            // Consecutive critical: force degrade
            if (consecutiveCriticalRef.current >= CONSECUTIVE_CRITICAL_LIMIT && !hasEscalatedRef.current) {
                hasEscalatedRef.current = true;
                // Force game speed to 1x
                if (typeof setGameSpeed === 'function') {
                    setGameSpeed(1);
                }
                // Disable Worker (switch to main thread to avoid double memory)
                if (typeof window !== 'undefined') {
                    window.__SIM_DISABLE_WORKER = true;
                }
                if (typeof addLog === 'function') {
                    addLog('🔴 [内存危险] 连续检测到内存不足，已强制降速至1倍并切换到主线程模式。请尽快保存游戏。');
                }
                console.error('[MemoryMonitor] ESCALATED: forced speed=1, worker disabled');
            }
        } else if (level === MEMORY_LEVEL.WARNING) {
            consecutiveCriticalRef.current = 0;

            // Double UI interval to reduce postMessage overhead
            if (prevLevel === MEMORY_LEVEL.NORMAL && typeof setUiInterval === 'function') {
                setUiInterval(originalIntervalRef.current * 2);
                if (typeof addLog === 'function') {
                    addLog('⚠️ [内存提示] 检测到内存压力，已降低数据传输频率以优化性能。');
                }
                console.warn('[MemoryMonitor] WARNING: doubled UI interval');
            }
        } else {
            // NORMAL: recover
            if (prevLevel !== MEMORY_LEVEL.NORMAL) {
                consecutiveCriticalRef.current = 0;

                // Restore original UI interval
                if (typeof setUiInterval === 'function') {
                    setUiInterval(originalIntervalRef.current);
                }

                // Restore Worker if it was force-disabled
                if (hasEscalatedRef.current) {
                    hasEscalatedRef.current = false;
                    if (typeof window !== 'undefined') {
                        window.__SIM_DISABLE_WORKER = false;
                    }
                }

                console.log('[MemoryMonitor] NORMAL: memory pressure resolved');
            }
        }
    }, [enabled, setIsPaused, setGameSpeed, addLog, setUiInterval, estimateFromTickTimes]);

    // Periodic check
    useEffect(() => {
        if (!enabled) return;

        const timer = setInterval(checkMemory, CHECK_INTERVAL_MS);
        return () => clearInterval(timer);
    }, [enabled, checkMemory]);

    return {
        memoryLevel: levelRef.current,
        memoryRatio: ratioRef.current,
        recordTickTime,
        checkMemory,
    };
}

export default useMemoryMonitor;
