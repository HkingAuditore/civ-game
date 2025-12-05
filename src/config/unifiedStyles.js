/**
 * 统一样式系统配置
 * 确保所有组件在桌面端和移动端保持一致的视觉风格
 */

// ==================== 颜色系统 ====================
export const COLORS = {
  // 主色调 - 古代金色系
  primary: {
    gold: '#d4af37',
    goldLight: '#f4e8d0',
    bronze: '#cd7f32',
    stone: '#8b7355',
    ink: '#2c1810',
    parchment: '#f4e8d0',
  },
  
  // 背景色
  background: {
    dark: 'bg-ancient-ink/90',
    medium: 'bg-ancient-stone/20',
    light: 'bg-ancient-parchment/10',
    glass: 'glass-ancient',
    glassEpic: 'glass-epic',
    glassMonument: 'glass-monument',
  },
  
  // 文字颜色
  text: {
    primary: 'text-ancient-parchment',
    secondary: 'text-ancient-stone',
    accent: 'text-ancient-gold',
    muted: 'text-ancient-stone/70',
  },
  
  // 边框颜色
  border: {
    default: 'border-ancient-gold/20',
    hover: 'border-ancient-gold/40',
    active: 'border-ancient-gold/60',
  },
};

// ==================== 按钮样式 ====================
export const BUTTON_STYLES = {
  // 基础样式（所有按钮共享）
  base: 'rounded-xl transition-all duration-300 font-semibold cursor-pointer flex items-center justify-center gap-2',
  
  // 尺寸变体（移动端和桌面端统一）
  sizes: {
    xs: 'px-2 py-1 text-xs min-h-[32px]',
    sm: 'px-3 py-2 text-sm min-h-[40px]',
    md: 'px-4 py-2.5 text-base min-h-[44px]',
    lg: 'px-6 py-3 text-lg min-h-[48px]',
  },
  
  // 颜色变体 - Enhanced Metal Texture
  variants: {
    primary: 'glass-epic border-2 border-ancient-gold/30 text-ancient-gold hover:border-ancient-gold/50 hover:shadow-gold-metal active:scale-95 shadow-metal-md',
    secondary: 'glass-ancient border border-ancient-stone/30 text-ancient-parchment hover:border-ancient-stone/50 hover:bg-ancient-stone/20 active:scale-95 shadow-metal-sm',
    success: 'glass-ancient border-2 border-green-500/30 text-green-300 hover:border-green-500/50 hover:bg-green-500/10 active:scale-95 shadow-depth-sm',
    warning: 'glass-ancient border-2 border-orange-500/30 text-orange-300 hover:border-orange-500/50 hover:bg-orange-500/10 active:scale-95 shadow-bronze-metal',
    danger: 'glass-ancient border-2 border-red-500/30 text-red-300 hover:border-red-500/50 hover:bg-red-500/10 active:scale-95 shadow-depth-sm',
    ghost: 'bg-transparent border border-ancient-gold/20 text-ancient-gold hover:bg-ancient-gold/10 hover:border-ancient-gold/40 active:scale-95 hover:shadow-glow-gold',
  },
  
  // 禁用状态
  disabled: 'opacity-50 cursor-not-allowed pointer-events-none',
};

// ==================== 卡片样式 ====================
export const CARD_STYLES = {
  // 基础样式
  base: 'rounded-xl transition-all duration-300',
  
  // 变体 - Enhanced Metal Texture
  variants: {
    default: 'glass-ancient border border-ancient-gold/20 shadow-metal-sm',
    epic: 'glass-epic border-2 border-ancient-gold/30 shadow-metal-md',
    monument: 'glass-monument border-2 border-ancient-gold/40 shadow-metal-lg',
    flat: 'bg-ancient-ink/50 border border-ancient-stone/20 shadow-depth-sm',
  },
  
  // 悬停效果 - Enhanced Glow
  hover: 'hover:border-ancient-gold/40 hover:shadow-gold-glow-intense hover:shadow-metal-md',
  
  // 内边距
  padding: {
    none: 'p-0',
    sm: 'p-3',
    md: 'p-4',
    lg: 'p-6',
  },
};

// ==================== 弹窗样式 ====================
export const MODAL_STYLES = {
  // 遮罩层
  overlay: 'fixed inset-0 bg-ancient-ink/80 backdrop-blur-sm z-50 flex items-center justify-center p-4',
  
  // 容器（移动端和桌面端统一）- Enhanced Metal Frame
  container: {
    base: 'relative w-full max-w-2xl glass-epic border-2 border-ancient-gold/30 rounded-2xl shadow-metal-xl shadow-depth-xl flex flex-col max-h-[90vh]',
    sm: 'max-w-md',
    md: 'max-w-2xl',
    lg: 'max-w-4xl',
    xl: 'max-w-6xl',
  },
  
  // 头部
  header: 'flex items-center justify-between p-4 border-b border-ancient-gold/20 flex-shrink-0',
  
  // 内容区
  body: 'flex-1 overflow-y-auto p-4',
  
  // 底部
  footer: 'flex items-center justify-end gap-3 p-4 border-t border-ancient-gold/20 flex-shrink-0',
  
  // 关闭按钮
  closeButton: 'p-2 rounded-lg hover:bg-ancient-gold/10 transition-colors text-ancient-stone hover:text-ancient-gold',
};

// ==================== 输入框样式 ====================
export const INPUT_STYLES = {
  base: 'w-full glass-ancient border border-ancient-gold/20 rounded-lg px-3 py-2 text-ancient-parchment placeholder-ancient-stone/50 focus:outline-none focus:border-ancient-gold/40 focus:ring-2 focus:ring-ancient-gold/20 transition-all',
  
  sizes: {
    sm: 'text-sm py-1.5',
    md: 'text-base py-2',
    lg: 'text-lg py-2.5',
  },
  
  disabled: 'opacity-50 cursor-not-allowed',
};

// ==================== 徽章样式 ====================
export const BADGE_STYLES = {
  base: 'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold shadow-emboss',
  
  variants: {
    default: 'bg-ancient-stone/20 text-ancient-parchment border border-ancient-stone/30 shadow-metal-sm',
    primary: 'bg-ancient-gold/20 text-ancient-gold border border-ancient-gold/30 shadow-gold-metal',
    success: 'bg-green-500/20 text-green-300 border border-green-500/30 shadow-depth-sm',
    warning: 'bg-orange-500/20 text-orange-300 border border-orange-500/30 shadow-bronze-metal',
    danger: 'bg-red-500/20 text-red-300 border border-red-500/30 shadow-depth-sm',
    info: 'bg-blue-500/20 text-blue-300 border border-blue-500/30 shadow-steel-metal',
  },
};

// ==================== 分隔线样式 ====================
export const DIVIDER_STYLES = {
  horizontal: 'w-full h-px bg-gradient-to-r from-transparent via-ancient-gold/30 to-transparent my-4',
  vertical: 'w-px h-full bg-gradient-to-b from-transparent via-ancient-gold/30 to-transparent mx-4',
};

// ==================== 列表项样式 ====================
export const LIST_ITEM_STYLES = {
  base: 'flex items-center gap-3 p-3 rounded-lg transition-all duration-200',
  hover: 'hover:bg-ancient-gold/10 hover:border-ancient-gold/30 cursor-pointer',
  active: 'bg-ancient-gold/20 border-ancient-gold/40',
  border: 'border border-ancient-gold/10',
};

// ==================== 工具提示样式 ====================
export const TOOLTIP_STYLES = {
  base: 'absolute z-50 glass-epic border border-ancient-gold/30 rounded-lg px-3 py-2 text-sm text-ancient-parchment shadow-monument pointer-events-none',
  arrow: 'absolute w-2 h-2 bg-ancient-ink/90 border-ancient-gold/30 transform rotate-45',
};

// ==================== 进度条样式 ====================
export const PROGRESS_STYLES = {
  container: 'w-full h-2 rounded-full bg-ancient-ink/50 overflow-hidden',
  bar: 'h-full rounded-full transition-all duration-300',
  
  variants: {
    default: 'bg-gradient-to-r from-ancient-bronze to-ancient-gold',
    success: 'bg-gradient-to-r from-green-600 to-green-400',
    warning: 'bg-gradient-to-r from-orange-600 to-orange-400',
    danger: 'bg-gradient-to-r from-red-600 to-red-400',
  },
};

// ==================== 标签页样式 ====================
export const TAB_STYLES = {
  container: 'flex gap-2 border-b border-ancient-gold/20',
  
  tab: {
    base: 'px-4 py-2 text-sm font-semibold transition-all duration-200 border-b-2 cursor-pointer',
    inactive: 'text-ancient-stone border-transparent hover:text-ancient-parchment hover:border-ancient-gold/20',
    active: 'text-ancient-gold border-ancient-gold',
  },
};

// ==================== 响应式断点 ====================
export const BREAKPOINTS = {
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  '2xl': '1536px',
};

// ==================== 动画配置 ====================
export const ANIMATIONS = {
  fadeIn: 'animate-fade-in',
  fadeInUp: 'animate-fade-in-up',
  slideUp: 'animate-slide-up',
  shimmer: 'animate-shimmer',
  pulseGold: 'animate-pulse-gold',
  float: 'animate-float',
};

// ==================== 阴影系统 ====================
export const SHADOWS = {
  ancient: 'shadow-ancient',
  epic: 'shadow-epic',
  monument: 'shadow-monument',
  glowGold: 'shadow-glow-gold',
};

// ==================== 辅助函数 ====================

/**
 * 组合样式类名
 * @param {...string} classes - 样式类名
 * @returns {string} 组合后的类名
 */
export const cn = (...classes) => {
  return classes.filter(Boolean).join(' ');
};

/**
 * 获取按钮完整样式
 * @param {string} variant - 变体
 * @param {string} size - 尺寸
 * @param {boolean} disabled - 是否禁用
 * @returns {string} 完整样式类名
 */
export const getButtonStyles = (variant = 'primary', size = 'md', disabled = false) => {
  return cn(
    BUTTON_STYLES.base,
    BUTTON_STYLES.sizes[size],
    BUTTON_STYLES.variants[variant],
    disabled && BUTTON_STYLES.disabled
  );
};

/**
 * 获取卡片完整样式
 * @param {string} variant - 变体
 * @param {string} padding - 内边距
 * @param {boolean} hover - 是否启用悬停效果
 * @returns {string} 完整样式类名
 */
export const getCardStyles = (variant = 'default', padding = 'md', hover = false) => {
  return cn(
    CARD_STYLES.base,
    CARD_STYLES.variants[variant],
    CARD_STYLES.padding[padding],
    hover && CARD_STYLES.hover
  );
};

/**
 * 获取徽章完整样式
 * @param {string} variant - 变体
 * @returns {string} 完整样式类名
 */
export const getBadgeStyles = (variant = 'default') => {
  return cn(
    BADGE_STYLES.base,
    BADGE_STYLES.variants[variant]
  );
};

export default {
  COLORS,
  BUTTON_STYLES,
  CARD_STYLES,
  MODAL_STYLES,
  INPUT_STYLES,
  BADGE_STYLES,
  DIVIDER_STYLES,
  LIST_ITEM_STYLES,
  TOOLTIP_STYLES,
  PROGRESS_STYLES,
  TAB_STYLES,
  BREAKPOINTS,
  ANIMATIONS,
  SHADOWS,
  cn,
  getButtonStyles,
  getCardStyles,
  getBadgeStyles,
};
