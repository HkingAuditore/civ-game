import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // GitHub Pages 部署路径配置
  base: process.env.NODE_ENV === 'production' ? '/civ-game/' : '/',
})