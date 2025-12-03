// Epic SVG Decorations - Historical & Monumental Design Elements
import React from 'react';

/**
 * Ancient Corner Ornament - 古代角落装饰
 * 用于卡片和面板的四角装饰
 */
export const CornerOrnament = ({ position = 'top-left', size = 24, className = '' }) => {
  const positions = {
    'top-left': 'top-0 left-0',
    'top-right': 'top-0 right-0 rotate-90',
    'bottom-left': 'bottom-0 left-0 -rotate-90',
    'bottom-right': 'bottom-0 right-0 rotate-180',
  };

  return (
    <svg
      className={`absolute ${positions[position]} ${className}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M2 2 L8 2 M2 2 L2 8 M2 2 L6 6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.6"
      />
      <path
        d="M1 1 L1 10 M1 1 L10 1"
        stroke="currentColor"
        strokeWidth="0.5"
        strokeLinecap="round"
        opacity="0.3"
      />
    </svg>
  );
};

/**
 * Divider with Diamond - 带钻石的分隔线
 * 用于分隔不同的内容区域
 */
export const DiamondDivider = ({ className = '' }) => {
  return (
    <div className={`relative h-px my-4 ${className}`}>
      <svg
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
        width="100%"
        height="2"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="divider-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0" />
            <stop offset="20%" stopColor="currentColor" stopOpacity="0.3" />
            <stop offset="50%" stopColor="currentColor" stopOpacity="0.6" />
            <stop offset="80%" stopColor="currentColor" stopOpacity="0.3" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
          </linearGradient>
        </defs>
        <line x1="0" y1="1" x2="100%" y2="1" stroke="url(#divider-gradient)" strokeWidth="2" />
      </svg>
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-gray-900 px-3">
        <svg width="12" height="12" viewBox="0 0 12 12" className="text-amber-500">
          <path d="M6 0 L12 6 L6 12 L0 6 Z" fill="currentColor" opacity="0.8" />
          <path d="M6 2 L10 6 L6 10 L2 6 Z" fill="currentColor" opacity="0.4" />
        </svg>
      </div>
    </div>
  );
};

/**
 * Ancient Pattern Background - 古代图案背景
 * SVG图案背景，可用于大型容器
 */
export const AncientPattern = ({ opacity = 0.03, className = '' }) => {
  return (
    <svg
      className={`absolute inset-0 w-full h-full pointer-events-none ${className}`}
      style={{ opacity }}
    >
      <defs>
        <pattern id="ancient-pattern" x="0" y="0" width="100" height="100" patternUnits="userSpaceOnUse">
          {/* Greek Key Pattern */}
          <path
            d="M0 20 L20 20 L20 0 M40 0 L40 20 L60 20 M60 40 L40 40 L40 60 M20 60 L20 40 L0 40"
            stroke="currentColor"
            strokeWidth="1"
            fill="none"
            opacity="0.5"
          />
          {/* Decorative Dots */}
          <circle cx="10" cy="10" r="1" fill="currentColor" opacity="0.3" />
          <circle cx="50" cy="50" r="1" fill="currentColor" opacity="0.3" />
          <circle cx="90" cy="90" r="1" fill="currentColor" opacity="0.3" />
          {/* Diagonal Lines */}
          <line x1="0" y1="0" x2="20" y2="20" stroke="currentColor" strokeWidth="0.5" opacity="0.2" />
          <line x1="80" y1="80" x2="100" y2="100" stroke="currentColor" strokeWidth="0.5" opacity="0.2" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#ancient-pattern)" className="text-amber-600" />
    </svg>
  );
};

/**
 * Laurel Wreath - 月桂花环
 * 用于重要标题或成就展示
 */
export const LaurelWreath = ({ size = 48, className = '' }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <g className="text-amber-500">
        {/* Left Branch */}
        <path
          d="M8 24 Q8 20 10 18 Q12 16 14 18 Q16 20 14 22 Q12 24 10 22"
          stroke="currentColor"
          strokeWidth="1.5"
          fill="currentColor"
          opacity="0.6"
        />
        <path
          d="M10 28 Q10 24 12 22 Q14 20 16 22 Q18 24 16 26 Q14 28 12 26"
          stroke="currentColor"
          strokeWidth="1.5"
          fill="currentColor"
          opacity="0.6"
        />
        <path
          d="M12 32 Q12 28 14 26 Q16 24 18 26 Q20 28 18 30 Q16 32 14 30"
          stroke="currentColor"
          strokeWidth="1.5"
          fill="currentColor"
          opacity="0.6"
        />
        
        {/* Right Branch */}
        <path
          d="M40 24 Q40 20 38 18 Q36 16 34 18 Q32 20 34 22 Q36 24 38 22"
          stroke="currentColor"
          strokeWidth="1.5"
          fill="currentColor"
          opacity="0.6"
        />
        <path
          d="M38 28 Q38 24 36 22 Q34 20 32 22 Q30 24 32 26 Q34 28 36 26"
          stroke="currentColor"
          strokeWidth="1.5"
          fill="currentColor"
          opacity="0.6"
        />
        <path
          d="M36 32 Q36 28 34 26 Q32 24 30 26 Q28 28 30 30 Q32 32 34 30"
          stroke="currentColor"
          strokeWidth="1.5"
          fill="currentColor"
          opacity="0.6"
        />
        
        {/* Center Ribbon */}
        <path
          d="M20 36 L24 40 L28 36"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
    </svg>
  );
};

/**
 * Column Capital - 柱头装饰
 * 古典建筑柱头，用于重要区域的顶部装饰
 */
export const ColumnCapital = ({ width = 120, height = 40, className = '' }) => {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 120 40"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <g className="text-amber-600">
        {/* Abacus (top) */}
        <rect x="0" y="0" width="120" height="8" fill="currentColor" opacity="0.4" />
        <rect x="2" y="2" width="116" height="4" fill="currentColor" opacity="0.2" />
        
        {/* Echinus (curved part) */}
        <path
          d="M10 8 Q10 20 0 28 L120 28 Q110 20 110 8 Z"
          fill="currentColor"
          opacity="0.3"
        />
        
        {/* Volutes (scrolls) */}
        <circle cx="20" cy="18" r="6" stroke="currentColor" strokeWidth="1.5" fill="none" opacity="0.5" />
        <circle cx="20" cy="18" r="3" fill="currentColor" opacity="0.3" />
        <circle cx="100" cy="18" r="6" stroke="currentColor" strokeWidth="1.5" fill="none" opacity="0.5" />
        <circle cx="100" cy="18" r="3" fill="currentColor" opacity="0.3" />
        
        {/* Decorative lines */}
        <line x1="30" y1="15" x2="90" y2="15" stroke="currentColor" strokeWidth="1" opacity="0.4" />
        <line x1="30" y1="21" x2="90" y2="21" stroke="currentColor" strokeWidth="1" opacity="0.4" />
        
        {/* Neck */}
        <rect x="15" y="28" width="90" height="8" fill="currentColor" opacity="0.2" />
        <line x1="15" y1="32" x2="105" y2="32" stroke="currentColor" strokeWidth="0.5" opacity="0.3" />
      </g>
    </svg>
  );
};

/**
 * Shield Emblem - 盾徽
 * 用于军事、防御相关的UI元素
 */
export const ShieldEmblem = ({ size = 64, className = '' }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="shield-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.8" />
          <stop offset="50%" stopColor="currentColor" stopOpacity="0.5" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0.3" />
        </linearGradient>
      </defs>
      
      {/* Shield Shape */}
      <path
        d="M32 4 L8 12 L8 28 Q8 44 32 60 Q56 44 56 28 L56 12 Z"
        fill="url(#shield-gradient)"
        stroke="currentColor"
        strokeWidth="2"
        className="text-amber-600"
      />
      
      {/* Inner Shield */}
      <path
        d="M32 10 L14 16 L14 28 Q14 40 32 52 Q50 40 50 28 L50 16 Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        opacity="0.4"
        className="text-amber-400"
      />
      
      {/* Center Emblem */}
      <circle cx="32" cy="28" r="8" fill="currentColor" opacity="0.3" className="text-amber-500" />
      <path
        d="M32 22 L35 28 L32 34 L29 28 Z"
        fill="currentColor"
        opacity="0.6"
        className="text-amber-300"
      />
    </svg>
  );
};

/**
 * Scroll Banner - 卷轴横幅
 * 用于重要公告或标题
 */
export const ScrollBanner = ({ children, className = '' }) => {
  return (
    <div className={`relative ${className}`}>
      <svg
        className="absolute inset-0 w-full h-full"
        viewBox="0 0 400 80"
        preserveAspectRatio="none"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="scroll-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#2c1810" stopOpacity="0.9" />
            <stop offset="50%" stopColor="#3d2415" stopOpacity="0.95" />
            <stop offset="100%" stopColor="#2c1810" stopOpacity="0.9" />
          </linearGradient>
        </defs>
        
        {/* Main Scroll */}
        <path
          d="M20 10 L380 10 Q390 10 390 20 L390 60 Q390 70 380 70 L20 70 Q10 70 10 60 L10 20 Q10 10 20 10 Z"
          fill="url(#scroll-gradient)"
          stroke="#d4af37"
          strokeWidth="1.5"
          opacity="0.9"
        />
        
        {/* Scroll Ends */}
        <ellipse cx="20" cy="40" rx="8" ry="30" fill="#2c1810" stroke="#d4af37" strokeWidth="1" />
        <ellipse cx="380" cy="40" rx="8" ry="30" fill="#2c1810" stroke="#d4af37" strokeWidth="1" />
        
        {/* Decorative Lines */}
        <line x1="30" y1="15" x2="370" y2="15" stroke="#d4af37" strokeWidth="0.5" opacity="0.3" />
        <line x1="30" y1="65" x2="370" y2="65" stroke="#d4af37" strokeWidth="0.5" opacity="0.3" />
      </svg>
      
      <div className="relative z-10 px-12 py-6 text-center">
        {children}
      </div>
    </div>
  );
};

/**
 * Epic Card Container - 史诗卡片容器
 * 带有完整装饰的卡片容器
 */
export const EpicCard = ({ children, className = '', variant = 'ancient' }) => {
  const variants = {
    ancient: 'glass-ancient',
    epic: 'glass-epic',
    monument: 'glass-monument',
  };

  return (
    <div className={`relative ${variants[variant]} rounded-xl p-6 ${className}`}>
      <CornerOrnament position="top-left" className="text-amber-500/60" />
      <CornerOrnament position="top-right" className="text-amber-500/60" />
      <CornerOrnament position="bottom-left" className="text-amber-500/60" />
      <CornerOrnament position="bottom-right" className="text-amber-500/60" />
      <AncientPattern opacity={0.02} />
      <div className="relative z-10">{children}</div>
    </div>
  );
};

/**
 * Animated Border - 动画边框
 * 流动的金色边框效果
 */
export const AnimatedBorder = ({ children, className = '' }) => {
  return (
    <div className={`relative ${className}`}>
      <div className="absolute inset-0 rounded-xl overflow-hidden">
        <div className="absolute inset-0 animate-shimmer">
          <div className="absolute inset-0 border-2 border-amber-500/30 rounded-xl" />
        </div>
      </div>
      <div className="relative">{children}</div>
    </div>
  );
};

/**
 * Resource Icon Frame - 资源图标框架
 * 为资源图标添加装饰性框架
 */
export const ResourceIconFrame = ({ children, rarity = 'common', className = '' }) => {
  const rarityColors = {
    common: 'text-gray-400',
    uncommon: 'text-green-400',
    rare: 'text-blue-400',
    epic: 'text-purple-400',
    legendary: 'text-amber-400',
  };

  return (
    <div className={`relative inline-block ${className}`}>
      <svg
        className={`absolute inset-0 w-full h-full ${rarityColors[rarity]}`}
        viewBox="0 0 64 64"
        fill="none"
      >
        <rect
          x="4"
          y="4"
          width="56"
          height="56"
          stroke="currentColor"
          strokeWidth="2"
          fill="none"
          opacity="0.4"
        />
        <rect
          x="8"
          y="8"
          width="48"
          height="48"
          stroke="currentColor"
          strokeWidth="1"
          fill="none"
          opacity="0.2"
        />
        {/* Corner Accents */}
        <path d="M4 4 L12 4 M4 4 L4 12" stroke="currentColor" strokeWidth="3" opacity="0.6" />
        <path d="M60 4 L52 4 M60 4 L60 12" stroke="currentColor" strokeWidth="3" opacity="0.6" />
        <path d="M4 60 L12 60 M4 60 L4 52" stroke="currentColor" strokeWidth="3" opacity="0.6" />
        <path d="M60 60 L52 60 M60 60 L60 52" stroke="currentColor" strokeWidth="3" opacity="0.6" />
      </svg>
      <div className="relative p-2">{children}</div>
    </div>
  );
};

export default {
  CornerOrnament,
  DiamondDivider,
  AncientPattern,
  LaurelWreath,
  ColumnCapital,
  ShieldEmblem,
  ScrollBanner,
  EpicCard,
  AnimatedBorder,
  ResourceIconFrame,
};
