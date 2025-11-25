/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      // 动画扩展
      animation: {
        'float-up': 'float-up 0.8s ease-out forwards',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'float-slow': 'float-slow 10s ease-in-out infinite',
        'float-slower': 'float-slow 15s ease-in-out infinite reverse',
        'glow': 'glow 2s ease-in-out infinite alternate',
        'slide-up': 'slide-up 0.3s ease-out',
        'fade-in': 'fade-in 0.2s ease-out',
      },
      keyframes: {
        'float-up': {
          '0%': { opacity: '1', transform: 'translateY(0)' },
          '100%': { opacity: '0', transform: 'translateY(-30px)' },
        },
        'float-slow': {
          '0%, 100%': { transform: 'translate(0, 0)' },
          '50%': { transform: 'translate(20px, 10px)' },
        },
        'glow': {
          '0%': { boxShadow: '0 0 5px rgba(59, 130, 246, 0.5)' },
          '100%': { boxShadow: '0 0 20px rgba(59, 130, 246, 0.8)' },
        },
        'slide-up': {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
      // 玻璃拟态效果
      backdropBlur: {
        xs: '2px',
      },
      // 自定义颜色（时代主题色）
      colors: {
        epoch: {
          stone: '#d97706', // 琥珀色 - 石器时代
          bronze: '#ea580c', // 橙色 - 青铜时代
          classical: '#dc2626', // 红色 - 古典时代
          medieval: '#7c3aed', // 紫色 - 中世纪
          exploration: '#0891b2', // 青色 - 探索时代
          enlightenment: '#2563eb', // 蓝色 - 启蒙时代
          industrial: '#4f46e5', // 靛蓝 - 工业时代
          modern: '#8b5cf6', // 紫罗兰 - 现代
        },
      },
      // 自定义间距（移动端拇指热区）
      spacing: {
        'safe-bottom': 'env(safe-area-inset-bottom)',
        'thumb': '48px', // 最小可点击区域
      },
      // 自定义阴影
      boxShadow: {
        'glass': '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
        'glow-sm': '0 0 10px rgba(59, 130, 246, 0.5)',
        'glow-md': '0 0 20px rgba(59, 130, 246, 0.6)',
        'glow-lg': '0 0 30px rgba(59, 130, 246, 0.7)',
      },
    },
  },
  plugins: [],
}
