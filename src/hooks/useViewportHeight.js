/**
 * useViewportHeight - 动态视口高度 Hook
 * 
 * 解决移动端浏览器中 CSS vh 单位不可靠的问题。
 * 在不同手机上，地址栏、导航栏的高度不同，导致 100vh 的实际高度差异很大。
 * 
 * 这个 Hook 会：
 * 1. 计算真实的视口高度
 * 2. 设置 CSS 变量 --vh 供全局使用
 * 3. 监听 resize 和 orientationchange 事件来更新值
 * 
 * 性能优化：
 * - 使用更长的防抖时间（250ms）减少频繁更新
 * - 添加变化阈值检测，小幅度变化不触发更新
 * - 检测输入框聚焦状态，输入法弹出时暂停更新
 */

import { useEffect, useCallback, useState } from 'react';

// 存储当前视口高度，避免重复计算
let cachedVh = null;
let cachedHeight = null;
let isInitialized = false;

// 检测是否有输入框正在聚焦（输入法可能打开）
let isInputFocused = false;

// 高度变化阈值（像素），小于此值的变化不触发更新，避免输入法微调导致频繁重绘
const HEIGHT_CHANGE_THRESHOLD = 50;

/**
 * 计算并设置视口高度 CSS 变量
 * @param {boolean} force - 是否强制更新（忽略阈值检测）
 */
function setViewportHeight(force = false) {
    // 如果有输入框聚焦（可能是输入法弹出），跳过更新以避免卡顿
    if (isInputFocused && !force) {
        return cachedVh;
    }

    const newHeight = window.innerHeight;
    
    // 阈值检测：如果高度变化小于阈值，跳过更新
    if (!force && cachedHeight !== null && Math.abs(newHeight - cachedHeight) < HEIGHT_CHANGE_THRESHOLD) {
        return cachedVh;
    }

    // 获取真实的视口高度
    const vh = newHeight * 0.01;

    // 设置 CSS 变量
    document.documentElement.style.setProperty('--vh', `${vh}px`);
    document.documentElement.style.setProperty('--real-viewport-height', `${newHeight}px`);

    // 同时设置 safe area 相关变量（如果浏览器支持）
    const safeAreaTop = getComputedStyle(document.documentElement).getPropertyValue('--safe-area-top') || '0px';
    const safeAreaBottom = getComputedStyle(document.documentElement).getPropertyValue('--safe-area-bottom') || '0px';

    // 计算可用高度（减去安全区域）
    const safeHeight = newHeight -
        (parseInt(safeAreaTop) || 0) -
        (parseInt(safeAreaBottom) || 0);
    document.documentElement.style.setProperty('--safe-viewport-height', `${safeHeight}px`);

    cachedVh = vh;
    cachedHeight = newHeight;
    return vh;
}

/**
 * 初始化视口高度监听（只调用一次）
 */
function initViewportHeight() {
    if (isInitialized) return;
    isInitialized = true;

    // 立即设置初始值
    setViewportHeight(true);

    // 防抖处理 - 使用更长的延迟（250ms）减少频繁更新
    let timeoutId = null;
    const debouncedSetHeight = () => {
        if (timeoutId) clearTimeout(timeoutId);
        timeoutId = setTimeout(() => setViewportHeight(false), 250);
    };

    // 监听输入框聚焦状态，在输入时暂停viewport更新
    const handleFocusIn = (e) => {
        const target = e.target;
        if (target && (
            target.tagName === 'INPUT' || 
            target.tagName === 'TEXTAREA' || 
            target.isContentEditable
        )) {
            isInputFocused = true;
        }
    };

    const handleFocusOut = (e) => {
        const target = e.target;
        if (target && (
            target.tagName === 'INPUT' || 
            target.tagName === 'TEXTAREA' || 
            target.isContentEditable
        )) {
            isInputFocused = false;
            // 输入完成后，延迟更新一次viewport高度
            setTimeout(() => setViewportHeight(true), 300);
        }
    };

    document.addEventListener('focusin', handleFocusIn, { passive: true });
    document.addEventListener('focusout', handleFocusOut, { passive: true });

    // 监听窗口大小变化
    window.addEventListener('resize', debouncedSetHeight, { passive: true });

    // 监听屏幕方向变化
    window.addEventListener('orientationchange', () => {
        // orientationchange 后需要延迟获取正确的高度
        isInputFocused = false; // 方向变化时强制重置
        setTimeout(() => setViewportHeight(true), 300);
    }, { passive: true });

    // 监听 visualViewport 变化（更精确，但仅部分浏览器支持）
    // 注意：在输入法弹出时这个事件会频繁触发，所以我们使用更长的防抖
    if (window.visualViewport) {
        let visualTimeoutId = null;
        const debouncedVisualSetHeight = () => {
            if (visualTimeoutId) clearTimeout(visualTimeoutId);
            // 对 visualViewport 使用更长的防抖时间（400ms）
            visualTimeoutId = setTimeout(() => setViewportHeight(false), 400);
        };
        window.visualViewport.addEventListener('resize', debouncedVisualSetHeight, { passive: true });
    }

    // 页面可见性变化时也更新（从后台切回前台时）
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            isInputFocused = false;
            setViewportHeight(true);
        }
    }, { passive: true });
}

/**
 * useViewportHeight Hook
 * 
 * 使用方式：
 * 1. 在 App 组件中调用一次以初始化
 * 2. 在 CSS 中使用 calc(100 * var(--vh)) 替代 100vh
 * 
 * @returns {number} 当前的单位 vh 值（像素）
 */
export function useViewportHeight() {
    const [vh, setVh] = useState(() => cachedVh || (typeof window !== 'undefined' ? window.innerHeight * 0.01 : 8));

    useEffect(() => {
        // 初始化
        initViewportHeight();

        // 更新状态
        const updateVh = () => {
            const newVh = setViewportHeight(false);
            if (newVh !== vh) {
                setVh(newVh);
            }
        };

        // 立即更新
        updateVh();

        // 监听变化 - 使用节流而非每次resize都更新状态
        let rafId = null;
        let lastUpdate = 0;
        const THROTTLE_MS = 500; // 状态更新节流时间

        const handleResize = () => {
            const now = Date.now();
            if (now - lastUpdate < THROTTLE_MS) return;
            
            if (rafId) cancelAnimationFrame(rafId);
            rafId = requestAnimationFrame(() => {
                lastUpdate = now;
                updateVh();
            });
        };

        window.addEventListener('resize', handleResize, { passive: true });

        return () => {
            window.removeEventListener('resize', handleResize);
            if (rafId) cancelAnimationFrame(rafId);
        };
    }, [vh]);

    return vh;
}

/**
 * 获取当前的视口高度（非响应式，用于一次性计算）
 */
export function getViewportHeight() {
    if (typeof window === 'undefined') return 800;
    return window.innerHeight;
}

/**
 * CSS 辅助函数：生成使用 --vh 变量的高度值
 * @param {number} multiplier - vh 的倍数，例如 100 表示 100vh
 * @returns {string} CSS calc 表达式
 */
export function vh(multiplier) {
    return `calc(${multiplier} * var(--vh, 1vh))`;
}

export default useViewportHeight;
