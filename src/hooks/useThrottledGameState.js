/**
 * useThrottledGameState Hook
 * 
 * Provides throttled access to game state for UI components.
 * Reduces UI re-render frequency without affecting simulation accuracy.
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { isLowPerformance } from './useDevicePerformance';

/**
 * Default throttle interval in milliseconds
 */
const DEFAULT_THROTTLE_MS = 250;

/**
 * Hook that throttles game state updates to reduce UI re-renders
 * 
 * @param {Object} gameState - The full game state object
 * @param {number} throttleMs - Minimum milliseconds between updates (default: 250)
 * @returns {Object} Throttled game state that updates less frequently
 * 
 * @example
 * const throttledState = useThrottledGameState(gameState, 300);
 * // throttledState updates at most every 300ms
 */
export function useThrottledGameState(gameState, throttleMs = DEFAULT_THROTTLE_MS) {
    const [throttledState, setThrottledState] = useState(gameState);
    const lastUpdateRef = useRef(0);
    const pendingUpdateRef = useRef(null);
    const rafIdRef = useRef(null);
    
    const updateState = useCallback(() => {
        const now = performance.now();
        const timeSinceLastUpdate = now - lastUpdateRef.current;
        
        if (timeSinceLastUpdate >= throttleMs) {
            // Enough time has passed, update immediately
            setThrottledState(gameState);
            lastUpdateRef.current = now;
            pendingUpdateRef.current = null;
        } else if (!pendingUpdateRef.current) {
            // Schedule update for later
            const delay = throttleMs - timeSinceLastUpdate;
            pendingUpdateRef.current = setTimeout(() => {
                setThrottledState(gameState);
                lastUpdateRef.current = performance.now();
                pendingUpdateRef.current = null;
            }, delay);
        }
    }, [gameState, throttleMs]);
    
    // Use requestAnimationFrame for smooth updates
    useEffect(() => {
        rafIdRef.current = requestAnimationFrame(updateState);
        
        return () => {
            if (rafIdRef.current) {
                cancelAnimationFrame(rafIdRef.current);
            }
            if (pendingUpdateRef.current) {
                clearTimeout(pendingUpdateRef.current);
            }
        };
    }, [updateState]);
    
    return throttledState;
}

/**
 * Hook that selects and throttles specific parts of game state
 * More efficient than throttling the entire state object
 * 
 * @param {Object} gameState - The full game state object
 * @param {Function} selector - Function to select desired state slice
 * @param {number} throttleMs - Minimum milliseconds between updates
 * @returns {*} Selected and throttled state slice
 * 
 * @example
 * const resources = useThrottledSelector(gameState, state => state.resources, 200);
 */
/**
 * 浅比较两个值是否相等
 * 对于对象，比较第一层key/value；对于原始值直接===
 */
function shallowEqual(a, b) {
    if (a === b) return true;
    if (a == null || b == null) return false;
    if (typeof a !== 'object' || typeof b !== 'object') return false;

    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    if (keysA.length !== keysB.length) return false;

    for (let i = 0; i < keysA.length; i++) {
        const key = keysA[i];
        if (a[key] !== b[key]) return false;
    }
    return true;
}

export function useThrottledSelector(gameState, selector, throttleMs = DEFAULT_THROTTLE_MS) {
    const selectedValue = selector(gameState);
    const [throttledValue, setThrottledValue] = useState(selectedValue);
    const lastUpdateRef = useRef(0);
    const pendingUpdateRef = useRef(null);
    const lastSelectedRef = useRef(selectedValue);
    
    useEffect(() => {
        // [PERF] 浅比较：只有选中的状态切片实际发生变化时才触发重渲染
        if (shallowEqual(selectedValue, lastSelectedRef.current)) {
            return;
        }
        lastSelectedRef.current = selectedValue;

        const now = performance.now();
        const timeSinceLastUpdate = now - lastUpdateRef.current;
        
        if (timeSinceLastUpdate >= throttleMs) {
            setThrottledValue(selectedValue);
            lastUpdateRef.current = now;
        } else if (!pendingUpdateRef.current) {
            const delay = throttleMs - timeSinceLastUpdate;
            pendingUpdateRef.current = setTimeout(() => {
                setThrottledValue(selectedValue);
                lastUpdateRef.current = performance.now();
                pendingUpdateRef.current = null;
            }, delay);
        }
        
        return () => {
            if (pendingUpdateRef.current) {
                clearTimeout(pendingUpdateRef.current);
                pendingUpdateRef.current = null;
            }
        };
    }, [selectedValue, throttleMs]);
    
    return throttledValue;
}

/**
 * UI更新频率配置预设
 * [PERF] 低性能模式下所有时间间隔自动翻倍
 */
const _BASE_THROTTLE_PRESETS = {
    // 关键 UI 元素（资源、国库）
    fast: 150,
    // 标准面板（日志、建筑）
    normal: 250,
    // 低优先级面板（统计、图表）
    slow: 500,
    // 背景/装饰元素
    background: 1000,
};

// 导出代理对象，访问属性时动态计算（当用户切换性能模式时立即生效）
export const UI_THROTTLE_PRESETS = new Proxy(_BASE_THROTTLE_PRESETS, {
    get(target, prop) {
        if (prop in target) {
            const multiplier = isLowPerformance() ? 2 : 1;
            return target[prop] * multiplier;
        }
        return undefined;
    }
});

export default useThrottledGameState;
