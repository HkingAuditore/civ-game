
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  root: '.', // Serve from verification folder? No, we need access to src.
  // Actually, if we serve from root, we can access verification.
  // The issue was the previous command failed due to missing vite? No, it ran but failed to load config.
  // Let's force a simpler config.
  server: {
    port: 5174
  },
  resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
  },
})
