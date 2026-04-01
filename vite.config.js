import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'fs'

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'));

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
    plugins: [react()],
    // 使用相对路径，使其兼容 GitHub Pages 子目录部署和自定义域名根目录部署
    base: './',
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
        ...(mode === 'production' ? { drop: ['console', 'debugger'] } : {}),
    },
}))