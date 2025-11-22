import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // 本地开发时使用根路径，部署到 GitHub Pages 时改为 '/civ-game/'
  base: process.env.NODE_ENV === 'production' ? '/civ-game/' : '/',
})