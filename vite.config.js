import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'fs'

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'));

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
    plugins: [react()],
    // 使用相对路径，使其兼容 GitHub Pages 子目录部署和自定义域名根目录部署
    base: './',
    server: {
        // HMR configuration: disable entirely via env var, or use optimized settings
        hmr: process.env.VITE_DISABLE_HMR === 'true'
            ? false
            : {
                // Increase timeout for large modules (useGameLoop.js is 570KB)
                timeout: 10000,
                // Show overlay for HMR errors to aid debugging
                overlay: true,
            },
    },
    define: {
        // 仅在生产环境禁用 DevTools Hook，避免与 Fast Refresh 冲突
        ...(mode === 'production'
            ? { '__REACT_DEVTOOLS_GLOBAL_HOOK__': JSON.stringify({ isDisabled: true }) }
            : {}),
        '__APP_VERSION__': JSON.stringify(pkg.version),
    },
    optimizeDeps: {
        include: ['gameanalytics'],
        exclude: [],
        entries: ['index.html'],
    },
    // Fix Worker output filename for OTA fallback path resolution.
    // 使用 [name] 保留每个 worker 的原始基名：simulation.worker.js / save.worker.js
    // 这样既保持 useSimulationWorker.js 对 "assets/simulation.worker.js" 的硬编码路径可用，
    // 又允许后续的 save.worker 各自输出独立 chunk（PR-4）
    worker: {
        format: 'es',
        rollupOptions: {
            output: {
                entryFileNames: 'assets/[name].js',
            },
        },
        plugins: () => [
            // Stub out analytics modules inside the Worker bundle.
            // The simulation Worker only needs pure computation (simulateTick);
            // gaTracker / gameanalytics / customBackend drag in browser-only
            // APIs (window, document) that cause "window is not defined" crashes
            // even with the workerGlobals shim, because ES module init order in
            // bundled output is not guaranteed to run the shim first.
            {
                name: 'stub-analytics-in-worker',
                enforce: 'pre',
                resolveId(source, importer) {
                    if (!importer) return null;
                    if (
                        source.includes('analytics/gaTracker') ||
                        source.includes('analytics/customBackend') ||
                        source.includes('analytics/gaInit') ||
                        source.includes('analytics/gaEvents') ||
                        source === 'gameanalytics'
                    ) {
                        return '\0worker-analytics-stub';
                    }
                    return null;
                },
                load(id) {
                    if (id === '\0worker-analytics-stub') {
                        return [
                            'export default {};',
                            'export const trackAIWar = () => {};',
                            'export const trackAIToAIWar = () => {};',
                            'export const trackAIToAIPeace = () => {};',
                            'export const trackAIPeace = () => {};',
                            'export const trackDesign = () => {};',
                            'export const trackErrorCritical = () => {};',
                            'export const trackErrorWarning = () => {};',
                            'export const trackErrorError = () => {};',
                            'export const trackErrorInfo = () => {};',
                            'export const trackError = () => {};',
                            'export const isGAInitialized = () => false;',
                            'export const bufferDesignEvent = () => {};',
                            'export const bufferResourceEvent = () => {};',
                            'export const bufferErrorEvent = () => {};',
                            'export const GA_EVENTS = {};',
                            'export const GA_PROGRESSION_PREFIX = "";',
                            'export const GameAnalytics = {};',
                            'export const EGAProgressionStatus = {};',
                            'export const EGAResourceFlowType = {};',
                            'export const EGAErrorSeverity = {};',
                        ].join('\n');
                    }
                    return null;
                },
            },
        ],
    },
    build: {
        // 目标 ES2018，兼容 Android 8.0+ (Chrome 62+) 的 WebView
        target: 'es2018',
        // 确保使用较低的 CSS 目标
        cssTarget: 'chrome62',
        // 启用 minify，确保生产版本不包含 development 代码
        minify: 'esbuild',
        // 生成 sourcemap 以便调试
        sourcemap: false,
        // 为旧设备优化
        rollupOptions: {
            output: {
                // 确保代码分割不会导致循环依赖问题
                manualChunks: {
                    vendor: ['react', 'react-dom'],
                    motion: ['framer-motion'],
                },
            },
        },
    },
    esbuild: {
        target: 'es2018',
        ...(mode === 'production' ? {
            drop: ['debugger'],
            // Keep console.error and console.warn for OTA crash diagnostics
            pure: ['console.log', 'console.debug', 'console.info'],
        } : {}),
    },
}))