import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // 使用根路径，确保在测试环境中正确加载资源
  base: '/',
  build: {
    // 确保生成正确的资源路径
    assetsDir: 'assets',
    // 生成 source map 以便调试
    sourcemap: false,
    // 优化构建
    rollupOptions: {
      output: {
        manualChunks: undefined,
      },
    },
  },
  // 开发服务器配置
  server: {
    port: 5173,
    strictPort: false,
  },
})