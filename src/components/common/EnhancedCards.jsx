// Enhanced Card System - 增强卡片系统
// 提供多种风格和层次的卡片组件

import React, { useState } from 'react';
import { BorderGlow, HoverCard } from './DynamicEffects';
import { CornerOrnament, AncientPattern } from './EpicDecorations';

/**
 * 基础增强卡片
 * 带有动态效果和装饰的卡片容器
 */
export const EnhancedCard = ({
  children,
  variant = 'default',
  hover = true,
  glow = false,
  corners = false,
  pattern = false,
  className = '',
  onClick,
}) => {
  const [isHovered, setIsHovered] = useState(false);

  const variants = {
    default: 'glass-ancient border-ancient-gold/20',
    primary: 'glass-epic border-ancient-gold/30 shadow-glow-gold',
    success: 'glass-ancient border-green-500/30 shadow-glow',
    warning: 'glass-ancient border-amber-500/30',
    danger: 'glass-ancient border-red-500/30',
    info: 'glass-ancient border-blue-500/30',
  };

  const hoverClass = hover
    ? 'hover:shadow-glow-gold hover:-translate-y-1 hover:border-ancient-gold/50'
    : '';

  const CardContent = (
    <div
      className={`relative rounded-xl transition-all duration-300 ${variants[variant]} ${hoverClass} ${className}`}
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* 背景图案 */}
      {pattern && <AncientPattern opacity={0.02} />}

      {/* 边框光晕 */}
      {glow && isHovered && <BorderGlow intensity="medium" />}

      {/* 角落装饰 */}
      {corners && (
        <>
          <CornerOrnament position="top-left" size={20} className="text-ancient-gold/40" />
          <CornerOrnament position="top-right" size={20} className="text-ancient-gold/40" />
          <CornerOrnament position="bottom-left" size={20} className="text-ancient-gold/40" />
          <CornerOrnament position="bottom-right" size={20} className="text-ancient-gold/40" />
        </>
      )}

      {/* 内容 */}
      <div className="relative z-10">{children}</div>
    </div>
  );

  return hover ? <HoverCard>{CardContent}</HoverCard> : CardContent;
};

/**
 * 信息卡片
 * 用于显示统计信息或关键数据
 */
export const InfoCard = ({
  icon,
  title,
  value,
  subtitle,
  trend,
  color = 'ancient-gold',
  className = '',
}) => {
  const colorClasses = {
    'ancient-gold': 'text-ancient-gold border-ancient-gold/30',
    'ancient-bronze': 'text-ancient-bronze border-ancient-bronze/30',
    blue: 'text-blue-400 border-blue-400/30',
    green: 'text-green-400 border-green-400/30',
    red: 'text-red-400 border-red-400/30',
    purple: 'text-purple-400 border-purple-400/30',
  };

  return (
    <EnhancedCard
      variant="default"
      hover={true}
      glow={true}
      className={`p-4 ${className}`}
    >
      <div className="flex items-start gap-3">
        {/* 图标 */}
        {icon && (
          <div className={`relative p-2 rounded-lg border ${colorClasses[color]}`}>
            <div className={`absolute inset-0 bg-gradient-to-br from-${color}/20 to-transparent rounded-lg`} />
            <div className="relative">{icon}</div>
          </div>
        )}

        {/* 内容 */}
        <div className="flex-1 min-w-0">
          <div className="text-xs text-gray-400 mb-1">{title}</div>
          <div className="flex items-baseline gap-2">
            <div className={`text-2xl font-bold ${colorClasses[color].split(' ')[0]}`}>
              {value}
            </div>
            {trend && (
              <div
                className={`text-sm font-mono ${
                  trend > 0 ? 'text-green-400' : trend < 0 ? 'text-red-400' : 'text-gray-400'
                }`}
              >
                {trend > 0 ? '+' : ''}
                {trend}
              </div>
            )}
          </div>
          {subtitle && <div className="text-xs text-gray-500 mt-1">{subtitle}</div>}
        </div>
      </div>
    </EnhancedCard>
  );
};

/**
 * 列表卡片
 * 用于显示列表项
 */
export const ListCard = ({
  items = [],
  renderItem,
  emptyMessage = '暂无数据',
  className = '',
}) => {
  return (
    <EnhancedCard variant="default" pattern={true} className={`p-4 ${className}`}>
      {items.length === 0 ? (
        <div className="text-center text-gray-500 py-8">{emptyMessage}</div>
      ) : (
        <div className="space-y-2">
          {items.map((item, index) => (
            <div
              key={index}
              className="relative group p-3 rounded-lg hover:bg-ancient-gold/5 transition-colors"
            >
              <div className="absolute inset-0 border border-ancient-gold/0 group-hover:border-ancient-gold/20 rounded-lg transition-colors" />
              <div className="relative z-10">{renderItem(item, index)}</div>
            </div>
          ))}
        </div>
      )}
    </EnhancedCard>
  );
};

/**
 * 可折叠卡片
 * 带有展开/折叠功能的卡片
 */
export const CollapsibleCard = ({
  title,
  icon,
  children,
  defaultExpanded = true,
  badge,
  className = '',
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  return (
    <EnhancedCard variant="default" className={className}>
      {/* 标题栏 */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-4 flex items-center justify-between hover:bg-ancient-gold/5 transition-colors rounded-t-xl"
      >
        <div className="flex items-center gap-3">
          {icon && (
            <div className="p-2 rounded-lg bg-ancient-gold/10 border border-ancient-gold/20">
              {icon}
            </div>
          )}
          <h3 className="text-lg font-bold text-ancient">{title}</h3>
          {badge && (
            <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-ancient-gold/20 text-ancient-gold border border-ancient-gold/30">
              {badge}
            </span>
          )}
        </div>
        <div
          className={`transform transition-transform ${isExpanded ? 'rotate-180' : ''}`}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 20 20"
            fill="none"
            className="text-ancient-gold"
          >
            <path
              d="M5 7.5L10 12.5L15 7.5"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </button>

      {/* 内容区 */}
      <div
        className={`overflow-hidden transition-all duration-300 ${
          isExpanded ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="p-4 pt-0">{children}</div>
      </div>
    </EnhancedCard>
  );
};

/**
 * 操作卡片
 * 带有主要操作按钮的卡片
 */
export const ActionCard = ({
  title,
  description,
  icon,
  actionLabel,
  onAction,
  disabled = false,
  variant = 'primary',
  className = '',
}) => {
  return (
    <EnhancedCard
      variant="default"
      hover={!disabled}
      glow={!disabled}
      className={`p-4 ${className}`}
    >
      <div className="flex items-start gap-4">
        {/* 图标 */}
        {icon && (
          <div className="flex-shrink-0 p-3 rounded-xl bg-ancient-gold/10 border border-ancient-gold/20">
            {icon}
          </div>
        )}

        {/* 内容 */}
        <div className="flex-1 min-w-0">
          <h4 className="text-lg font-bold text-ancient mb-2">{title}</h4>
          {description && <p className="text-sm text-gray-400 mb-4">{description}</p>}

          {/* 操作按钮 */}
          <button
            onClick={onAction}
            disabled={disabled}
            className={`btn-${variant === 'primary' ? 'epic' : 'ancient'} px-4 py-2 rounded-lg ${
              disabled ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            {actionLabel}
          </button>
        </div>
      </div>
    </EnhancedCard>
  );
};

/**
 * 进度卡片
 * 显示进度信息的卡片
 */
export const ProgressCard = ({
  title,
  current,
  max,
  icon,
  color = 'ancient-gold',
  showPercentage = true,
  className = '',
}) => {
  const percentage = max > 0 ? (current / max) * 100 : 0;

  const colorClasses = {
    'ancient-gold': 'bg-ancient-gold',
    'ancient-bronze': 'bg-ancient-bronze',
    blue: 'bg-blue-500',
    green: 'bg-green-500',
    red: 'bg-red-500',
    purple: 'bg-purple-500',
  };

  return (
    <EnhancedCard variant="default" className={`p-4 ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {icon && <div className="text-ancient-gold">{icon}</div>}
          <span className="text-sm font-semibold text-ancient">{title}</span>
        </div>
        {showPercentage && (
          <span className="text-sm font-mono text-ancient-gold">{percentage.toFixed(0)}%</span>
        )}
      </div>

      {/* 进度条 */}
      <div className="relative h-2 bg-ancient-ink/50 rounded-full overflow-hidden border border-ancient-gold/20">
        <div
          className={`absolute inset-y-0 left-0 ${colorClasses[color]} transition-all duration-500 rounded-full`}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
        </div>
      </div>

      {/* 数值显示 */}
      <div className="flex justify-between mt-2 text-xs text-gray-400">
        <span>{current.toFixed(0)}</span>
        <span>{max.toFixed(0)}</span>
      </div>
    </EnhancedCard>
  );
};

/**
 * 网格卡片容器
 * 用于网格布局的卡片容器
 */
export const CardGrid = ({ children, cols = 3, gap = 4, className = '' }) => {
  const colsClass = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 md:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4',
  };

  const gapClass = `gap-${gap}`;

  return <div className={`grid ${colsClass[cols]} ${gapClass} ${className}`}>{children}</div>;
};

export default {
  EnhancedCard,
  InfoCard,
  ListCard,
  CollapsibleCard,
  ActionCard,
  ProgressCard,
  CardGrid,
};
