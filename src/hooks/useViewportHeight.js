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
 */

import { useEffect, useCallback, useState } from 'react';

// 存储当前视口高度，避免重复计算
let cachedVh = null;
let isInitialized = false;

/**
 * 计算并设置视口高度 CSS 变量
 */
function setViewportHeight() {
    // 获取真实的视口高度
    const vh = window.innerHeight * 0.01;

    // 设置 CSS 变量
    document.documentElement.style.setProperty('--vh', `${vh}px`);
    document.documentElement.style.setProperty('--real-viewport-height', `${window.innerHeight}px`);

    // 同时设置 safe area 相关变量（如果浏览器支持）
    const safeAreaTop = getComputedStyle(document.documentElement).getPropertyValue('--safe-area-top') || '0px';
    const safeAreaBottom = getComputedStyle(document.documentElement).getPropertyValue('--safe-area-bottom') || '0px';

    // 计算可用高度（减去安全区域）
    const safeHeight = window.innerHeight -
        (parseInt(safeAreaTop) || 0) -
        (parseInt(safeAreaBottom) || 0);
    document.documentElement.style.setProperty('--safe-viewport-height', `${safeHeight}px`);

    cachedVh = vh;
    return vh;
}

/**
 * 初始化视口高度监听（只调用一次）
 */
function initViewportHeight() {
    if (isInitialized) return;
    isInitialized = true;

    // 立即设置初始值
    setViewportHeight();

    // 防抖处理
    let timeoutId = null;
    const debouncedSetHeight = () => {
        if (timeoutId) clearTimeout(timeoutId);
        timeoutId = setTimeout(setViewportHeight, 100);
    };

    // 监听窗口大小变化
    window.addEventListener('resize', debouncedSetHeight, { passive: true });

    // 监听屏幕方向变化
    window.addEventListener('orientationchange', () => {
        // orientationchange 后需要延迟获取正确的高度
        setTimeout(setViewportHeight, 150);
    }, { passive: true });

    // 监听 visualViewport 变化（更精确，但仅部分浏览器支持）
    if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', debouncedSetHeight, { passive: true });
    }

    // 页面可见性变化时也更新（从后台切回前台时）
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            setViewportHeight();
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
            const newVh = setViewportHeight();
            setVh(newVh);
        };

        // 立即更新
        updateVh();

        // 监听变化
        const handleResize = () => {
            requestAnimationFrame(updateVh);
        };

        window.addEventListener('resize', handleResize, { passive: true });

        return () => {
            window.removeEventListener('resize', handleResize);
        };
    }, []);

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
