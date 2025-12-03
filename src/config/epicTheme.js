// Epic Theme Configuration - Historical Era Themes
// 史诗主题配置 - 历史时代主题系统

/**
 * 时代主题配置
 * 每个时代都有独特的视觉风格，包括颜色、背景、装饰等
 */
export const EPOCH_THEMES = {
  // 石器时代 - Stone Age
  0: {
    name: '石器时代',
    primaryColor: '#d97706', // Amber
    secondaryColor: '#92400e',
    accentColor: '#fbbf24',
    bgGradient: 'linear-gradient(135deg, #1a1410 0%, #2c1810 50%, #1a1410 100%)',
    bgPattern: 'stone',
    textColor: '#fef3c7',
    borderColor: 'rgba(217, 119, 6, 0.3)',
    glowColor: 'rgba(217, 119, 6, 0.4)',
    atmosphere: 'primitive',
    icon: '🪨',
  },
  // 青铜时代 - Bronze Age
  1: {
    name: '青铜时代',
    primaryColor: '#ea580c', // Orange
    secondaryColor: '#9a3412',
    accentColor: '#fb923c',
    bgGradient: 'linear-gradient(135deg, #1c1410 0%, #2d1c10 50%, #1c1410 100%)',
    bgPattern: 'bronze',
    textColor: '#fed7aa',
    borderColor: 'rgba(234, 88, 12, 0.3)',
    glowColor: 'rgba(234, 88, 12, 0.4)',
    atmosphere: 'ancient',
    icon: '⚱️',
  },
  // 古典时代 - Classical Age
  2: {
    name: '古典时代',
    primaryColor: '#dc2626', // Red
    secondaryColor: '#991b1b',
    accentColor: '#f87171',
    bgGradient: 'linear-gradient(135deg, #1a1010 0%, #2c1010 50%, #1a1010 100%)',
    bgPattern: 'marble',
    textColor: '#fecaca',
    borderColor: 'rgba(220, 38, 38, 0.3)',
    glowColor: 'rgba(220, 38, 38, 0.4)',
    atmosphere: 'classical',
    icon: '🏛️',
  },
  // 中世纪 - Medieval Age
  3: {
    name: '中世纪',
    primaryColor: '#7c3aed', // Purple
    secondaryColor: '#5b21b6',
    accentColor: '#a78bfa',
    bgGradient: 'linear-gradient(135deg, #14101a 0%, #1c102c 50%, #14101a 100%)',
    bgPattern: 'castle',
    textColor: '#e9d5ff',
    borderColor: 'rgba(124, 58, 237, 0.3)',
    glowColor: 'rgba(124, 58, 237, 0.4)',
    atmosphere: 'medieval',
    icon: '🏰',
  },
  // 探索时代 - Age of Exploration
  4: {
    name: '探索时代',
    primaryColor: '#0891b2', // Cyan
    secondaryColor: '#155e75',
    accentColor: '#22d3ee',
    bgGradient: 'linear-gradient(135deg, #10141a 0%, #102c2c 50%, #10141a 100%)',
    bgPattern: 'compass',
    textColor: '#cffafe',
    borderColor: 'rgba(8, 145, 178, 0.3)',
    glowColor: 'rgba(8, 145, 178, 0.4)',
    atmosphere: 'exploration',
    icon: '🧭',
  },
  // 启蒙时代 - Age of Enlightenment
  5: {
    name: '启蒙时代',
    primaryColor: '#2563eb', // Blue
    secondaryColor: '#1e40af',
    accentColor: '#60a5fa',
    bgGradient: 'linear-gradient(135deg, #10141a 0%, #101c2c 50%, #10141a 100%)',
    bgPattern: 'book',
    textColor: '#dbeafe',
    borderColor: 'rgba(37, 99, 235, 0.3)',
    glowColor: 'rgba(37, 99, 235, 0.4)',
    atmosphere: 'enlightenment',
    icon: '📚',
  },
  // 工业时代 - Industrial Age
  6: {
    name: '工业时代',
    primaryColor: '#4f46e5', // Indigo
    secondaryColor: '#3730a3',
    accentColor: '#818cf8',
    bgGradient: 'linear-gradient(135deg, #12141a 0%, #1c1c2c 50%, #12141a 100%)',
    bgPattern: 'gear',
    textColor: '#e0e7ff',
    borderColor: 'rgba(79, 70, 229, 0.3)',
    glowColor: 'rgba(79, 70, 229, 0.4)',
    atmosphere: 'industrial',
    icon: '⚙️',
  },
  // 现代 - Modern Age
  7: {
    name: '现代',
    primaryColor: '#8b5cf6', // Violet
    secondaryColor: '#6d28d9',
    accentColor: '#a78bfa',
    bgGradient: 'linear-gradient(135deg, #14101a 0%, #1c142c 50%, #14101a 100%)',
    bgPattern: 'circuit',
    textColor: '#ede9fe',
    borderColor: 'rgba(139, 92, 246, 0.3)',
    glowColor: 'rgba(139, 92, 246, 0.4)',
    atmosphere: 'modern',
    icon: '🏙️',
  },
};

/**
 * 获取当前时代的主题
 */
export const getEpochTheme = (epochId) => {
  return EPOCH_THEMES[epochId] || EPOCH_THEMES[0];
};

/**
 * 应用时代主题到CSS变量
 */
export const applyEpochTheme = (epochId) => {
  const theme = getEpochTheme(epochId);
  const root = document.documentElement;
  
  root.style.setProperty('--theme-primary', theme.primaryColor);
  root.style.setProperty('--theme-secondary', theme.secondaryColor);
  root.style.setProperty('--theme-accent', theme.accentColor);
  root.style.setProperty('--theme-text', theme.textColor);
  root.style.setProperty('--theme-border', theme.borderColor);
  root.style.setProperty('--theme-glow', theme.glowColor);
  root.style.setProperty('--theme-bg-gradient', theme.bgGradient);
};

/**
 * 背景图案SVG定义
 */
export const BACKGROUND_PATTERNS = {
  stone: `
    <svg width="100" height="100" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id="stone-pattern" x="0" y="0" width="50" height="50" patternUnits="userSpaceOnUse">
          <circle cx="10" cy="10" r="2" fill="rgba(217, 119, 6, 0.1)" />
          <circle cx="30" cy="25" r="3" fill="rgba(217, 119, 6, 0.08)" />
          <circle cx="45" cy="15" r="2.5" fill="rgba(217, 119, 6, 0.09)" />
          <path d="M0 0 L10 10 M40 40 L50 50" stroke="rgba(217, 119, 6, 0.05)" stroke-width="1" />
        </pattern>
      </defs>
      <rect width="100" height="100" fill="url(#stone-pattern)" />
    </svg>
  `,
  bronze: `
    <svg width="100" height="100" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id="bronze-pattern" x="0" y="0" width="60" height="60" patternUnits="userSpaceOnUse">
          <path d="M10 10 L20 10 L20 0 M40 0 L40 10 L50 10" stroke="rgba(234, 88, 12, 0.1)" stroke-width="1.5" fill="none" />
          <circle cx="30" cy="30" r="1.5" fill="rgba(234, 88, 12, 0.12)" />
        </pattern>
      </defs>
      <rect width="100" height="100" fill="url(#bronze-pattern)" />
    </svg>
  `,
  marble: `
    <svg width="100" height="100" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id="marble-pattern" x="0" y="0" width="80" height="80" patternUnits="userSpaceOnUse">
          <path d="M0 20 L80 20 M0 40 L80 40 M0 60 L80 60" stroke="rgba(220, 38, 38, 0.05)" stroke-width="1" />
          <path d="M20 0 L20 80 M40 0 L40 80 M60 0 L60 80" stroke="rgba(220, 38, 38, 0.05)" stroke-width="1" />
          <circle cx="40" cy="40" r="15" stroke="rgba(220, 38, 38, 0.08)" stroke-width="1" fill="none" />
        </pattern>
      </defs>
      <rect width="100" height="100" fill="url(#marble-pattern)" />
    </svg>
  `,
  castle: `
    <svg width="100" height="100" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id="castle-pattern" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
          <rect x="0" y="30" width="10" height="10" fill="rgba(124, 58, 237, 0.08)" />
          <rect x="15" y="30" width="10" height="10" fill="rgba(124, 58, 237, 0.08)" />
          <rect x="30" y="30" width="10" height="10" fill="rgba(124, 58, 237, 0.08)" />
          <path d="M5 30 L5 20 M20 30 L20 20 M35 30 L35 20" stroke="rgba(124, 58, 237, 0.1)" stroke-width="1" />
        </pattern>
      </defs>
      <rect width="100" height="100" fill="url(#castle-pattern)" />
    </svg>
  `,
  compass: `
    <svg width="100" height="100" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id="compass-pattern" x="0" y="0" width="60" height="60" patternUnits="userSpaceOnUse">
          <circle cx="30" cy="30" r="20" stroke="rgba(8, 145, 178, 0.08)" stroke-width="1" fill="none" />
          <path d="M30 10 L30 50 M10 30 L50 30" stroke="rgba(8, 145, 178, 0.1)" stroke-width="1" />
          <path d="M30 30 L35 20 L30 25 L25 20 Z" fill="rgba(8, 145, 178, 0.12)" />
        </pattern>
      </defs>
      <rect width="100" height="100" fill="url(#compass-pattern)" />
    </svg>
  `,
  book: `
    <svg width="100" height="100" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id="book-pattern" x="0" y="0" width="50" height="50" patternUnits="userSpaceOnUse">
          <rect x="10" y="10" width="20" height="30" stroke="rgba(37, 99, 235, 0.1)" stroke-width="1" fill="none" />
          <path d="M15 15 L25 15 M15 20 L25 20 M15 25 L25 25" stroke="rgba(37, 99, 235, 0.08)" stroke-width="0.5" />
        </pattern>
      </defs>
      <rect width="100" height="100" fill="url(#book-pattern)" />
    </svg>
  `,
  gear: `
    <svg width="100" height="100" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id="gear-pattern" x="0" y="0" width="60" height="60" patternUnits="userSpaceOnUse">
          <circle cx="30" cy="30" r="12" stroke="rgba(79, 70, 229, 0.1)" stroke-width="2" fill="none" />
          <circle cx="30" cy="30" r="6" fill="rgba(79, 70, 229, 0.08)" />
          <rect x="28" y="18" width="4" height="6" fill="rgba(79, 70, 229, 0.1)" />
          <rect x="28" y="36" width="4" height="6" fill="rgba(79, 70, 229, 0.1)" />
          <rect x="18" y="28" width="6" height="4" fill="rgba(79, 70, 229, 0.1)" />
          <rect x="36" y="28" width="6" height="4" fill="rgba(79, 70, 229, 0.1)" />
        </pattern>
      </defs>
      <rect width="100" height="100" fill="url(#gear-pattern)" />
    </svg>
  `,
  circuit: `
    <svg width="100" height="100" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id="circuit-pattern" x="0" y="0" width="50" height="50" patternUnits="userSpaceOnUse">
          <path d="M0 25 L15 25 M35 25 L50 25 M25 0 L25 15 M25 35 L25 50" stroke="rgba(139, 92, 246, 0.1)" stroke-width="1" />
          <circle cx="25" cy="25" r="3" fill="rgba(139, 92, 246, 0.12)" />
          <rect x="13" y="23" width="4" height="4" fill="rgba(139, 92, 246, 0.1)" />
          <rect x="33" y="23" width="4" height="4" fill="rgba(139, 92, 246, 0.1)" />
        </pattern>
      </defs>
      <rect width="100" height="100" fill="url(#circuit-pattern)" />
    </svg>
  `,
};

/**
 * 获取背景图案的Data URL
 */
export const getBackgroundPattern = (patternName) => {
  const svg = BACKGROUND_PATTERNS[patternName] || BACKGROUND_PATTERNS.stone;
  const encoded = encodeURIComponent(svg.trim());
  return `data:image/svg+xml,${encoded}`;
};

/**
 * 响应式断点配置
 */
export const BREAKPOINTS = {
  mobile: 640,
  tablet: 768,
  desktop: 1024,
  wide: 1280,
  ultrawide: 1536,
};

/**
 * 检测当前设备类型
 */
export const getDeviceType = () => {
  const width = window.innerWidth;
  if (width < BREAKPOINTS.mobile) return 'mobile';
  if (width < BREAKPOINTS.tablet) return 'tablet';
  if (width < BREAKPOINTS.desktop) return 'desktop';
  if (width < BREAKPOINTS.wide) return 'wide';
  return 'ultrawide';
};

/**
 * 触摸设备检测
 */
export const isTouchDevice = () => {
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
};

/**
 * 性能优化配置
 */
export const PERFORMANCE_CONFIG = {
  // 根据设备性能调整动画
  reduceMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  // 根据设备类型调整效果
  enableParticles: !isTouchDevice() || getDeviceType() === 'desktop',
  enableBlur: true,
  enableShadows: true,
};

export default {
  EPOCH_THEMES,
  getEpochTheme,
  applyEpochTheme,
  BACKGROUND_PATTERNS,
  getBackgroundPattern,
  BREAKPOINTS,
  getDeviceType,
  isTouchDevice,
  PERFORMANCE_CONFIG,
};
