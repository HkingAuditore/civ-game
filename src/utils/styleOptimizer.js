// 样式优化工具 - 批量替换灰色系为古代金色系
// 使用方法：在需要优化的组件中导入并使用这些工具函数

/**
 * 优化类名 - 将灰色系类名替换为古代金色系
 * @param {string} className - 原始类名
 * @returns {string} - 优化后的类名
 */
export const optimizeClassName = (className) => {
  if (!className) return '';
  
  return className
    // 背景色优化
    .replace(/bg-gray-900/g, 'bg-ancient-ink/90')
    .replace(/bg-gray-800/g, 'glass-ancient')
    .replace(/bg-gray-700/g, 'glass-ancient')
    .replace(/bg-gray-600/g, 'bg-ancient-stone/50')
    
    // 文字颜色优化
    .replace(/text-white(?![a-z-])/g, 'text-ancient-parchment')
    .replace(/text-gray-200/g, 'text-ancient-parchment')
    .replace(/text-gray-300/g, 'text-ancient')
    .replace(/text-gray-400/g, 'text-ancient-stone')
    .replace(/text-gray-500/g, 'text-ancient-stone/70')
    
    // 边框优化
    .replace(/border-gray-700/g, 'border-ancient-gold/20')
    .replace(/border-gray-600/g, 'border-ancient-gold/30')
    .replace(/border-gray-500/g, 'border-ancient-gold/40')
    
    // 阴影优化
    .replace(/shadow-lg(?![a-z-])/g, 'shadow-ancient')
    .replace(/shadow-xl(?![a-z-])/g, 'shadow-epic')
    .replace(/shadow-2xl/g, 'shadow-monument')
    
    // 圆角优化
    .replace(/rounded-lg(?![a-z-])/g, 'rounded-xl')
    
    // 悬停效果优化
    .replace(/hover:bg-gray-700/g, 'hover:bg-ancient-gold/10')
    .replace(/hover:bg-gray-600/g, 'hover:bg-ancient-gold/20')
    .replace(/hover:border-gray-600/g, 'hover:border-ancient-gold/40')
    .replace(/hover:border-gray-500/g, 'hover:border-ancient-gold/50');
};

/**
 * 获取优化后的面板容器类名
 * @param {string} additionalClasses - 额外的类名
 * @returns {string} - 完整的类名
 */
export const getPanelContainerClass = (additionalClasses = '') => {
  return `glass-epic rounded-xl border border-ancient-gold/20 shadow-epic relative overflow-hidden ${additionalClasses}`;
};

/**
 * 获取优化后的卡片类名
 * @param {string} variant - 卡片变体 ('default' | 'hover' | 'active')
 * @param {string} additionalClasses - 额外的类名
 * @returns {string} - 完整的类名
 */
export const getCardClass = (variant = 'default', additionalClasses = '') => {
  const baseClass = 'glass-ancient rounded-lg border border-ancient-gold/30 transition-all';
  
  const variants = {
    default: baseClass,
    hover: `${baseClass} hover:bg-ancient-gold/10 hover:border-ancient-gold/50 hover:shadow-glow-gold cursor-pointer`,
    active: `${baseClass} bg-ancient-gold/20 border-ancient-gold/60 shadow-glow-gold`,
  };
  
  return `${variants[variant] || variants.default} ${additionalClasses}`;
};

/**
 * 获取优化后的按钮类名
 * @param {string} variant - 按钮变体 ('primary' | 'secondary' | 'success' | 'danger')
 * @param {string} size - 按钮尺寸 ('sm' | 'md' | 'lg')
 * @param {string} additionalClasses - 额外的类名
 * @returns {string} - 完整的类名
 */
export const getButtonClass = (variant = 'primary', size = 'md', additionalClasses = '') => {
  const baseClass = 'rounded-lg font-semibold transition-all flex items-center justify-center gap-2';
  
  const sizes = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base',
  };
  
  const variants = {
    primary: 'btn-epic',
    secondary: 'glass-ancient hover:bg-ancient-gold/20 border border-ancient-gold/30 hover:border-ancient-gold/50 text-ancient-parchment',
    success: 'btn-epic bg-green-600/80 hover:bg-green-500/90 border-green-500/50',
    danger: 'btn-epic bg-red-600/80 hover:bg-red-500/90 border-red-500/50',
  };
  
  return `${baseClass} ${sizes[size]} ${variants[variant]} ${additionalClasses}`;
};

/**
 * 获取优化后的列表项类名
 * @param {boolean} isHoverable - 是否可悬停
 * @param {string} additionalClasses - 额外的类名
 * @returns {string} - 完整的类名
 */
export const getListItemClass = (isHoverable = true, additionalClasses = '') => {
  const baseClass = 'glass-ancient p-1.5 rounded-lg border border-ancient-gold/20 transition-all';
  const hoverClass = isHoverable ? 'hover:bg-ancient-gold/10 hover:border-ancient-gold/40 cursor-pointer' : '';
  
  return `${baseClass} ${hoverClass} ${additionalClasses}`;
};

/**
 * 获取优化后的模态框类名
 * @param {string} size - 模态框尺寸 ('sm' | 'md' | 'lg' | 'xl')
 * @param {string} additionalClasses - 额外的类名
 * @returns {string} - 完整的类名
 */
export const getModalClass = (size = 'md', additionalClasses = '') => {
  const baseClass = 'glass-monument rounded-xl border-2 border-ancient-gold/40 shadow-monument relative overflow-hidden';
  
  const sizes = {
    sm: 'max-w-md',
    md: 'max-w-2xl',
    lg: 'max-w-4xl',
    xl: 'max-w-6xl',
  };
  
  return `${baseClass} ${sizes[size]} ${additionalClasses}`;
};

/**
 * 获取背景装饰JSX
 * @param {string} patternId - 图案ID（用于SVG pattern）
 * @returns {JSX.Element} - 背景装饰元素
 */
export const getBackgroundDecoration = (patternId = 'bg-pattern') => {
  return (
    <>
      {/* 渐变背景 */}
      <div className="absolute inset-0 bg-gradient-to-br from-ancient-ink/50 via-ancient-stone/20 to-ancient-ink/50 opacity-50" />
      
      {/* 图案背景 */}
      <div className="absolute inset-0 opacity-[0.02]">
        <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
          <pattern id={patternId} x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
            <circle cx="20" cy="20" r="1" fill="currentColor" className="text-ancient-gold" />
          </pattern>
          <rect width="100%" height="100%" fill={`url(#${patternId})`} />
        </svg>
      </div>
    </>
  );
};

/**
 * 获取顶部金色渐变条JSX
 * @returns {JSX.Element} - 顶部渐变条元素
 */
export const getTopGradientBar = () => {
  return (
    <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-ancient-gold to-transparent" />
  );
};

/**
 * 优化图标类名
 * @param {string} baseColor - 基础颜色类（如果为空则使用金色）
 * @returns {string} - 优化后的图标类名
 */
export const getIconClass = (baseColor = '') => {
  return baseColor || 'text-ancient-gold';
};

/**
 * 获取进度条类名
 * @param {string} color - 进度条颜色 ('gold' | 'green' | 'red' | 'blue')
 * @returns {object} - 包含容器和填充类名的对象
 */
export const getProgressBarClass = (color = 'gold') => {
  const colors = {
    gold: 'bg-ancient-gold',
    green: 'bg-green-500',
    red: 'bg-red-500',
    blue: 'bg-blue-500',
    purple: 'bg-purple-500',
  };
  
  return {
    container: 'w-full bg-ancient-ink/50 rounded-full border border-ancient-gold/10',
    fill: `h-full rounded-full ${colors[color] || colors.gold} transition-all`,
  };
};

/**
 * 获取徽章类名
 * @param {string} variant - 徽章变体 ('default' | 'success' | 'warning' | 'danger' | 'info')
 * @param {string} size - 徽章尺寸 ('sm' | 'md')
 * @returns {string} - 完整的类名
 */
export const getBadgeClass = (variant = 'default', size = 'sm') => {
  const baseClass = 'inline-flex items-center justify-center rounded-full font-semibold';
  
  const sizes = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-3 py-1 text-sm',
  };
  
  const variants = {
    default: 'bg-ancient-gold/20 text-ancient-gold border border-ancient-gold/40',
    success: 'bg-green-600/20 text-green-400 border border-green-500/40',
    warning: 'bg-yellow-600/20 text-yellow-400 border border-yellow-500/40',
    danger: 'bg-red-600/20 text-red-400 border border-red-500/40',
    info: 'bg-blue-600/20 text-blue-400 border border-blue-500/40',
  };
  
  return `${baseClass} ${sizes[size]} ${variants[variant]}`;
};

/**
 * 获取分隔线类名
 * @returns {string} - 分隔线类名
 */
export const getDividerClass = () => {
  return 'border-t border-ancient-gold/20';
};

/**
 * 获取滚动条类名
 * @returns {string} - 滚动条类名
 */
export const getScrollbarClass = () => {
  return 'scrollbar-thin scrollbar-thumb-ancient-gold/40 scrollbar-track-ancient-ink/30 hover:scrollbar-thumb-ancient-gold/60';
};

/**
 * 获取输入框类名
 * @param {boolean} hasError - 是否有错误
 * @param {string} additionalClasses - 额外的类名
 * @returns {string} - 完整的类名
 */
export const getInputClass = (hasError = false, additionalClasses = '') => {
  const baseClass = 'glass-ancient rounded-lg px-3 py-2 text-ancient-parchment placeholder-ancient-stone/50 transition-all';
  const borderClass = hasError 
    ? 'border border-red-500/50 focus:border-red-500' 
    : 'border border-ancient-gold/30 focus:border-ancient-gold/60';
  const focusClass = 'focus:outline-none focus:ring-2 focus:ring-ancient-gold/20';
  
  return `${baseClass} ${borderClass} ${focusClass} ${additionalClasses}`;
};

// 导出所有工具函数
export default {
  optimizeClassName,
  getPanelContainerClass,
  getCardClass,
  getButtonClass,
  getListItemClass,
  getModalClass,
  getBackgroundDecoration,
  getTopGradientBar,
  getIconClass,
  getProgressBarClass,
  getBadgeClass,
  getDividerClass,
  getScrollbarClass,
  getInputClass,
};
