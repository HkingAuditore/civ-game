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
 * 检测设备是否需要启用低性能模式
 * 新策略：默认返回 true（启用低性能模式），只有高端设备才返回 false
 * 高端设备标准：8核以上 CPU 且 (8GB 以上内存 或 高端 GPU)
 * @returns {boolean} true 表示需要低性能模式
 */
function detectLowEndDevice() {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') {
        return true; // 默认启用低性能模式
    }

    const deviceMemory = navigator.deviceMemory;
    const cpuCores = navigator.hardwareConcurrency;

    // 首先检查用户是否偏好减少动画 - 无论设备多强大都要尊重用户选择
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        console.log('[Performance] User prefers reduced motion');
        return true;
    }

    // 检查是否为高端设备：需要同时满足高内存和高核心数
    let isHighEnd = false;
    
    if (deviceMemory !== undefined && cpuCores !== undefined) {
        if (deviceMemory >= 8 && cpuCores >= 8) {
            isHighEnd = true;
            console.log('[Performance] High-end device detected:', cpuCores, 'cores,', deviceMemory, 'GB RAM');
        }
    }

    // 额外检测：如果 CPU 核心数足够多，检测是否有高端 GPU
    if (!isHighEnd && cpuCores >= 8) {
        try {
            const canvas = document.createElement('canvas');
            const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
            if (gl) {
                const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
                if (debugInfo) {
                    const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
                    const rendererLower = renderer.toLowerCase();
                    
                    // 高端 GPU 列表
                    const highEndGPUs = [
                        'rtx 30', 'rtx 40', 'rtx 50',          // NVIDIA RTX 30/40/50 系列
                        'rx 6', 'rx 7',                         // AMD RX 6000/7000 系列
                        'arc a7',                               // Intel Arc 高端
                        'apple m1', 'apple m2', 'apple m3', 'apple m4', // Apple Silicon
                        'adreno 7', 'adreno 8',                 // 高通高端
                        'mali-g7', 'mali-g9',                   // ARM 高端
                    ];
                    
                    const isHighEndGPU = highEndGPUs.some(gpu => rendererLower.includes(gpu.toLowerCase()));
                    if (isHighEndGPU) {
                        isHighEnd = true;
                        console.log('[Performance] High-end GPU detected:', renderer);
                    }
                }
            }
        } catch (e) {
            // WebGL 检测失败，保持默认
        }
    }

    // 如果是高端设备，返回 false（不需要低性能模式）
    if (isHighEnd) {
        console.log('[Performance] High-perf mode enabled for high-end device');
        return false;
    }

    // 默认返回 true（启用低性能模式）
    console.log('[Performance] Default low-perf mode enabled (not a high-end device)');
    return true;
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
