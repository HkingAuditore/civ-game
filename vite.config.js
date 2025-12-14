import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // 使用相对路径，使其兼容 GitHub Pages 子目录部署和自定义域名根目录部署
  base: './',
})