// Dynamic Background Effects - 动态背景特效组件
// 为游戏界面添加沉浸式的视觉效果

import React, { useEffect, useRef } from 'react';

/**
 * 浮动粒子背景
 * 创建缓慢漂浮的金色粒子效果
 */
export const FloatingParticles = ({ count = 20, className = '' }) => {
  const particles = Array.from({ length: count }, (_, i) => ({
    id: i,
    size: Math.random() * 3 + 1,
    left: Math.random() * 100,
    animationDuration: Math.random() * 20 + 15,
    animationDelay: Math.random() * 5,
    opacity: Math.random() * 0.3 + 0.1,
  }));

  return (
    <div className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`}>
      {particles.map((particle) => (
        <div
          key={particle.id}
          className="absolute rounded-full bg-ancient-gold animate-float"
          style={{
            width: `${particle.size}px`,
            height: `${particle.size}px`,
            left: `${particle.left}%`,
            top: '-10px',
            opacity: particle.opacity,
            animationDuration: `${particle.animationDuration}s`,
            animationDelay: `${particle.animationDelay}s`,
          }}
        />
      ))}
    </div>
  );
};

/**
 * 光线扫描效果
 * 创建从左到右的光线扫描动画
 */
export const LightSweep = ({ className = '', color = 'ancient-gold' }) => {
  return (
    <div className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`}>
      <div
        className={`absolute inset-y-0 w-32 bg-gradient-to-r from-transparent via-${color}/20 to-transparent animate-shimmer`}
        style={{
          left: '-128px',
          animationDuration: '8s',
        }}
      />
    </div>
  );
};

/**
 * 脉冲光环
 * 创建从中心向外扩散的光环效果
 */
export const PulseRing = ({ className = '' }) => {
  return (
    <div className={`absolute inset-0 flex items-center justify-center pointer-events-none ${className}`}>
      <div className="relative w-full h-full">
        <div className="absolute inset-0 rounded-full border-2 border-ancient-gold/20 animate-pulse-gold" />
        <div
          className="absolute inset-0 rounded-full border-2 border-ancient-gold/10 animate-pulse-gold"
          style={{ animationDelay: '1s' }}
        />
        <div
          className="absolute inset-0 rounded-full border-2 border-ancient-gold/5 animate-pulse-gold"
          style={{ animationDelay: '2s' }}
        />
      </div>
    </div>
  );
};

/**
 * 网格背景
 * 创建古代建筑风格的网格背景
 */
export const GridBackground = ({ className = '', opacity = 0.03 }) => {
  return (
    <div
      className={`absolute inset-0 pointer-events-none ${className}`}
      style={{ opacity }}
    >
      <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path
              d="M 40 0 L 0 0 0 40"
              fill="none"
              stroke="currentColor"
              strokeWidth="0.5"
              className="text-ancient-gold"
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
      </svg>
    </div>
  );
};

/**
 * 动态渐变背景
 * 创建缓慢变化的渐变背景
 */
export const DynamicGradient = ({ className = '' }) => {
  return (
    <div className={`absolute inset-0 pointer-events-none ${className}`}>
      <div className="absolute inset-0 bg-gradient-to-br from-ancient-ink/50 via-ancient-stone/20 to-ancient-ink/50 animate-pulse-slow" />
      <div
        className="absolute inset-0 bg-gradient-to-tl from-ancient-bronze/10 via-transparent to-ancient-gold/10 animate-pulse-slow"
        style={{ animationDelay: '2s' }}
      />
    </div>
  );
};

/**
 * 边框光晕效果
 * 为容器添加流动的边框光晕
 */
export const BorderGlow = ({ className = '', intensity = 'medium' }) => {
  const intensityClasses = {
    low: 'opacity-30',
    medium: 'opacity-50',
    high: 'opacity-70',
  };

  return (
    <div className={`absolute inset-0 rounded-inherit pointer-events-none ${className}`}>
      {/* 顶部光晕 */}
      <div
        className={`absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-ancient-gold to-transparent ${intensityClasses[intensity]} animate-shimmer`}
      />
      {/* 底部光晕 */}
      <div
        className={`absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-ancient-gold to-transparent ${intensityClasses[intensity]} animate-shimmer`}
        style={{ animationDelay: '1s' }}
      />
      {/* 左侧光晕 */}
      <div
        className={`absolute top-0 left-0 bottom-0 w-px bg-gradient-to-b from-transparent via-ancient-gold to-transparent ${intensityClasses[intensity]} animate-pulse-gold`}
      />
      {/* 右侧光晕 */}
      <div
        className={`absolute top-0 right-0 bottom-0 w-px bg-gradient-to-b from-transparent via-ancient-gold to-transparent ${intensityClasses[intensity]} animate-pulse-gold`}
        style={{ animationDelay: '0.5s' }}
      />
    </div>
  );
};

/**
 * 星空背景
 * 创建闪烁的星空效果
 */
export const StarField = ({ count = 50, className = '' }) => {
  const stars = Array.from({ length: count }, (_, i) => ({
    id: i,
    size: Math.random() * 2 + 0.5,
    left: Math.random() * 100,
    top: Math.random() * 100,
    animationDuration: Math.random() * 3 + 2,
    animationDelay: Math.random() * 3,
  }));

  return (
    <div className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`}>
      {stars.map((star) => (
        <div
          key={star.id}
          className="absolute rounded-full bg-ancient-gold animate-pulse"
          style={{
            width: `${star.size}px`,
            height: `${star.size}px`,
            left: `${star.left}%`,
            top: `${star.top}%`,
            animationDuration: `${star.animationDuration}s`,
            animationDelay: `${star.animationDelay}s`,
          }}
        />
      ))}
    </div>
  );
};

/**
 * 卡片悬浮效果容器
 * 为卡片添加3D悬浮和倾斜效果
 */
export const HoverCard = ({ children, className = '' }) => {
  const cardRef = useRef(null);

  useEffect(() => {
    const card = cardRef.current;
    if (!card) return;

    const handleMouseMove = (e) => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      const rotateX = (y - centerY) / 20;
      const rotateY = (centerX - x) / 20;

      card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateZ(10px)`;
    };

    const handleMouseLeave = () => {
      card.style.transform = 'perspective(1000px) rotateX(0) rotateY(0) translateZ(0)';
    };

    card.addEventListener('mousemove', handleMouseMove);
    card.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      card.removeEventListener('mousemove', handleMouseMove);
      card.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, []);

  return (
    <div
      ref={cardRef}
      className={`transition-transform duration-200 ease-out ${className}`}
      style={{ transformStyle: 'preserve-3d' }}
    >
      {children}
    </div>
  );
};

/**
 * 进度条光晕
 * 为进度条添加流动的光晕效果
 */
export const ProgressGlow = ({ progress = 0, className = '' }) => {
  return (
    <div className={`relative ${className}`}>
      <div className="absolute inset-0 overflow-hidden rounded-full">
        <div
          className="absolute inset-y-0 w-20 bg-gradient-to-r from-transparent via-ancient-gold/50 to-transparent animate-shimmer"
          style={{
            left: `${progress - 10}%`,
            transition: 'left 0.3s ease-out',
          }}
        />
      </div>
    </div>
  );
};

/**
 * 涟漪效果
 * 点击时产生涟漪扩散效果
 */
export const RippleEffect = ({ x, y, onComplete }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onComplete?.();
    }, 600);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div
      className="absolute rounded-full bg-ancient-gold/30 animate-ripple pointer-events-none"
      style={{
        left: x - 10,
        top: y - 10,
        width: 20,
        height: 20,
      }}
    />
  );
};

/**
 * 组合背景效果
 * 将多个背景效果组合在一起
 */
export const EpicBackground = ({ 
  showParticles = true, 
  showGrid = true, 
  showGradient = true,
  showStars = false,
  className = '' 
}) => {
  return (
    <div className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`}>
      {showGradient && <DynamicGradient />}
      {showGrid && <GridBackground opacity={0.02} />}
      {showParticles && <FloatingParticles count={15} />}
      {showStars && <StarField count={30} />}
      <LightSweep />
    </div>
  );
};

export default {
  FloatingParticles,
  LightSweep,
  PulseRing,
  GridBackground,
  DynamicGradient,
  BorderGlow,
  StarField,
  HoverCard,
  ProgressGlow,
  RippleEffect,
  EpicBackground,
};
