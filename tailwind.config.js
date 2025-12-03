/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      // Epic Font Families
      fontFamily: {
        'epic': ['Cinzel', 'Noto Serif SC', 'Georgia', 'serif'],
        'decorative': ['Cinzel Decorative', 'Noto Serif SC', 'serif'],
        'body': ['Noto Serif SC', 'Georgia', 'serif'],
      },
      // 动画扩展 - Epic Animations
      animation: {
        'float-up': 'float-up 0.8s ease-out forwards',
        'sheet-in': 'sheet-in 0.4s cubic-bezier(0.25, 1, 0.5, 1) forwards',
        'sheet-out': 'sheet-out 0.3s ease-out forwards',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'float-slow': 'float-slow 10s ease-in-out infinite',
        'float-slower': 'float-slow 15s ease-in-out infinite reverse',
        'glow': 'glow 2s ease-in-out infinite alternate',
        'slide-up': 'slide-up 0.3s ease-out',
        'fade-in': 'fade-in 0.2s ease-out',
        'ripple': 'ripple 0.6s linear forwards',
        'shimmer': 'shimmer 3s linear infinite',
        'pulse-gold': 'pulse-gold 2s ease-in-out infinite',
        'float': 'float 3s ease-in-out infinite',
        'fade-in-up': 'fade-in-up 0.6s ease-out',
        'slide-in-right': 'slide-in-right 0.5s ease-out',
        'scale-in': 'scale-in 0.4s ease-out',
        'epic-entrance': 'epic-entrance 1s ease-out',
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
        'sheet-in': {
          '0%': { transform: 'translateY(100%)' },
          '100%': { transform: 'translateY(0)' },
        },
        'sheet-out': {
          '0%': { transform: 'translateY(0)' },
          '100%': { transform: 'translateY(100%)' },
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
        'ripple': {
          'to': { transform: 'scale(4)', opacity: '0' },
        },
        'shimmer': {
          '0%': { backgroundPosition: '-1000px 0' },
          '100%': { backgroundPosition: '1000px 0' },
        },
        'pulse-gold': {
          '0%, 100%': { boxShadow: '0 0 10px rgba(212, 175, 55, 0.3)' },
          '50%': { boxShadow: '0 0 20px rgba(212, 175, 55, 0.6)' },
        },
        'float': {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        'fade-in-up': {
          'from': { opacity: '0', transform: 'translateY(20px)' },
          'to': { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-in-right': {
          'from': { opacity: '0', transform: 'translateX(50px)' },
          'to': { opacity: '1', transform: 'translateX(0)' },
        },
        'scale-in': {
          'from': { opacity: '0', transform: 'scale(0.9)' },
          'to': { opacity: '1', transform: 'scale(1)' },
        },
        'epic-entrance': {
          '0%': { opacity: '0', transform: 'scale(0.8) translateY(30px)' },
          '50%': { transform: 'scale(1.05) translateY(-5px)' },
          '100%': { opacity: '1', transform: 'scale(1) translateY(0)' },
        },
      },
      // 玻璃拟态效果
      backdropBlur: {
        xs: '2px',
      },
      // 自定义颜色（时代主题色 + 史诗主题）
      colors: {
        // Epic Ancient Colors
        ancient: {
          gold: '#d4af37',
          bronze: '#cd7f32',
          marble: '#f5f5dc',
          stone: '#8b7355',
          parchment: '#f4e8d0',
          ink: '#2c1810',
          'royal-purple': '#6a0dad',
          'empire-red': '#8b0000',
        },
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
        // 动态主题色
        'theme-bg': 'var(--theme-bg)',
        'theme-text': 'var(--theme-text)',
        'theme-primary': 'var(--theme-primary)',
        'theme-accent': 'var(--theme-accent)',
        'theme-border': 'var(--theme-border)',
        'theme-surface': 'var(--theme-surface)',
        'theme-surface-trans': 'var(--theme-surface-trans)',
      },
      // 自定义间距（移动端拇指热区）
      spacing: {
        'safe-bottom': 'env(safe-area-inset-bottom)',
        'thumb': '48px', // 最小可点击区域
      },
      // 自定义阴影 - Epic Shadows
      boxShadow: {
        'glass': '0 2px 12px 0 rgba(0, 0, 0, 0.3), inset 0 0 0 1px var(--theme-border)',
        'glow-sm': '0 0 10px rgba(59, 130, 246, 0.5)',
        'glow-md': '0 0 20px rgba(59, 130, 246, 0.6)',
        'glow-lg': '0 0 30px rgba(59, 130, 246, 0.7)',
        // Ancient Epic Shadows
        'ancient': '0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -1px rgba(139, 115, 85, 0.2)',
        'epic': '0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 10px 10px -5px rgba(212, 175, 55, 0.1)',
        'monument': '0 20px 50px -12px rgba(0, 0, 0, 0.7), 0 10px 20px -5px rgba(139, 0, 0, 0.2)',
        'glow-gold': '0 0 10px rgba(212, 175, 55, 0.3), 0 0 20px rgba(212, 175, 55, 0.2), 0 0 30px rgba(212, 175, 55, 0.1)',
        'glow-gold-intense': '0 0 15px rgba(212, 175, 55, 0.5), 0 0 30px rgba(212, 175, 55, 0.3), 0 0 45px rgba(212, 175, 55, 0.2)',
        'glow-bronze': '0 0 10px rgba(205, 127, 50, 0.3), 0 0 20px rgba(205, 127, 50, 0.2)',
        'glow-empire': '0 0 15px rgba(139, 0, 0, 0.4), 0 0 30px rgba(139, 0, 0, 0.2)',
      },
    },
  },
  plugins: [],
}
