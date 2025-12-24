/**
 * useDevicePerformance - 设备性能检测 Hook
 * 
 * 自动检测低端设备并应用性能优化模式：
 * 1. 使用 navigator.deviceMemory 检测设备内存
 * 2. 使用 navigator.hardwareConcurrency 检测 CPU 核心数
 * 3. 支持用户手动覆盖（存储在 localStorage）
 * 4. 在 document.documentElement 上设置 'low-perf-mode' class
 */

import { useEffect, useState, useCallback } from 'react';

// localStorage key
const STORAGE_KEY = 'civ_performance_mode';

// 性能模式枚举
export const PERFORMANCE_MODES = {
    AUTO: 'auto',       // 自动检测
    HIGH: 'high',       // 强制高性能模式（禁用优化）
    LOW: 'low',         // 强制低性能模式（启用优化）
};

// 缓存检测结果，避免重复计算
let cachedIsLowEnd = null;
let isInitialized = false;

/**
 * 检测设备是否为低端设备
 * @returns {boolean} true 表示低端设备
 */
function detectLowEndDevice() {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') {
        return false;
    }

    // 1. 检测设备内存（仅 Chrome 支持）
    // deviceMemory 返回 GB 为单位的内存量
    const deviceMemory = navigator.deviceMemory;
    if (deviceMemory !== undefined && deviceMemory < 4) {
        console.log('[Performance] Low-end device detected: deviceMemory =', deviceMemory, 'GB');
        return true;
    }

    // 2. 检测 CPU 核心数
    const cpuCores = navigator.hardwareConcurrency;
    if (cpuCores !== undefined && cpuCores < 4) {
        console.log('[Performance] Low-end device detected: hardwareConcurrency =', cpuCores);
        return true;
    }

    // 3. 检测移动端 + 低端 GPU（通过 canvas 测试）
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    if (isMobile) {
        // 使用 canvas API 进行简单性能测试
        try {
            const canvas = document.createElement('canvas');
            const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
            if (gl) {
                const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
                if (debugInfo) {
                    const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
                    // 一些已知的低端 GPU
                    const lowEndGPUs = [
                        'Mali-4', 'Mali-T', 'Adreno 3', 'Adreno 4', 'Adreno 5',
                        'PowerVR SGX', 'VideoCore', 'GE8', 'IMG',
                    ];
                    const isLowEndGPU = lowEndGPUs.some(gpu => renderer.includes(gpu));
                    if (isLowEndGPU) {
                        console.log('[Performance] Low-end GPU detected:', renderer);
                        return true;
                    }
                }
            }
        } catch (e) {
            // WebGL 不可用，可能是低端设备
            console.log('[Performance] WebGL detection failed, assuming low-end device');
            return true;
        }

        // 4. 移动端额外检测：屏幕像素比过高可能导致渲染压力
        // 但这不一定意味着低端设备，所以只作为参考
        // 如果是移动端且没有检测到性能指标，默认保守处理
        if (deviceMemory === undefined && cpuCores === undefined) {
            // 无法检测硬件信息的旧设备，可能是低端
            const isOldAndroid = /Android [1-7]\./i.test(navigator.userAgent);
            if (isOldAndroid) {
                console.log('[Performance] Old Android version detected');
                return true;
            }
        }
    }

    // 5. 检测用户是否偏好减少动画
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        console.log('[Performance] User prefers reduced motion');
        return true;
    }

    return false;
}

/**
 * 应用性能模式到 DOM
 * @param {boolean} isLowPerf 是否启用低性能模式
 */
function applyPerformanceMode(isLowPerf) {
    const root = document.documentElement;
    if (isLowPerf) {
        root.classList.add('low-perf-mode');
        console.log('[Performance] Low-perf-mode enabled');
    } else {
        root.classList.remove('low-perf-mode');
        console.log('[Performance] Low-perf-mode disabled');
    }
}

/**
 * 读取用户保存的性能模式设置
 * @returns {string} PERFORMANCE_MODES 中的一个值
 */
function getSavedMode() {
    if (typeof localStorage === 'undefined') return PERFORMANCE_MODES.AUTO;
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && Object.values(PERFORMANCE_MODES).includes(saved)) {
        return saved;
    }
    return PERFORMANCE_MODES.AUTO;
}

/**
 * 保存性能模式设置
 * @param {string} mode PERFORMANCE_MODES 中的一个值
 */
function saveMode(mode) {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(STORAGE_KEY, mode);
}

/**
 * 初始化性能检测（只调用一次）
 */
function initPerformanceDetection() {
    if (isInitialized) return cachedIsLowEnd;
    isInitialized = true;

    const savedMode = getSavedMode();
    
    if (savedMode === PERFORMANCE_MODES.LOW) {
        cachedIsLowEnd = true;
    } else if (savedMode === PERFORMANCE_MODES.HIGH) {
        cachedIsLowEnd = false;
    } else {
        // AUTO 模式：自动检测
        cachedIsLowEnd = detectLowEndDevice();
    }

    applyPerformanceMode(cachedIsLowEnd);
    return cachedIsLowEnd;
}

/**
 * useDevicePerformance Hook
 * 
 * @returns {Object} { isLowPerformanceMode, performanceMode, setPerformanceMode }
 */
export function useDevicePerformance() {
    const [performanceMode, setPerformanceModeState] = useState(() => getSavedMode());
    const [isLowPerformanceMode, setIsLowPerformanceMode] = useState(() => {
        if (typeof window === 'undefined') return false;
        return cachedIsLowEnd ?? detectLowEndDevice();
    });

    // 设置性能模式
    const setPerformanceMode = useCallback((mode) => {
        if (!Object.values(PERFORMANCE_MODES).includes(mode)) {
            console.warn('[Performance] Invalid mode:', mode);
            return;
        }

        saveMode(mode);
        setPerformanceModeState(mode);

        let newIsLowPerf;
        if (mode === PERFORMANCE_MODES.LOW) {
            newIsLowPerf = true;
        } else if (mode === PERFORMANCE_MODES.HIGH) {
            newIsLowPerf = false;
        } else {
            // AUTO: 重新检测
            newIsLowPerf = detectLowEndDevice();
        }

        cachedIsLowEnd = newIsLowPerf;
        setIsLowPerformanceMode(newIsLowPerf);
        applyPerformanceMode(newIsLowPerf);
    }, []);

    // 初始化
    useEffect(() => {
        const result = initPerformanceDetection();
        setIsLowPerformanceMode(result);
    }, []);

    // 监听 prefers-reduced-motion 变化
    useEffect(() => {
        if (typeof window === 'undefined' || !window.matchMedia) return;

        const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
        const handleChange = () => {
            if (performanceMode === PERFORMANCE_MODES.AUTO) {
                const newIsLowPerf = detectLowEndDevice();
                cachedIsLowEnd = newIsLowPerf;
                setIsLowPerformanceMode(newIsLowPerf);
                applyPerformanceMode(newIsLowPerf);
            }
        };

        mediaQuery.addEventListener('change', handleChange);
        return () => mediaQuery.removeEventListener('change', handleChange);
    }, [performanceMode]);

    return {
        isLowPerformanceMode,
        performanceMode,
        setPerformanceMode,
        PERFORMANCE_MODES,
    };
}

/**
 * 获取当前是否为低性能模式（非响应式）
 * @returns {boolean}
 */
export function isLowPerformance() {
    if (cachedIsLowEnd !== null) return cachedIsLowEnd;
    return initPerformanceDetection();
}

export default useDevicePerformance;
