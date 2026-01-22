import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react()],
    // 使用相对路径，使其兼容 GitHub Pages 子目录部署和自定义域名根目录部署
    base: './',
    define: {
        // 禁用 React DevTools Profiler，避免大状态对象克隆导致内存溢出
        '__REACT_DEVTOOLS_GLOBAL_HOOK__': '({ isDisabled: true })',
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
    // esbuild 也需要设置目标
    esbuild: {
        target: 'es2018',
    },
})