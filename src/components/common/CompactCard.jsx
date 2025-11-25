// 紧凑卡片组件
// 用于显示建筑、兵种、科技等信息的紧凑卡片
// 支持PC端悬停显示详情，移动端点击显示详情

import React, { useState } from 'react';
import { Icon } from './UIComponents';

/**
 * 紧凑卡片组件
 * @param {Object} props
 * @param {string} props.title - 卡片标题
 * @param {string} props.subtitle - 卡片副标题
 * @param {string} props.icon - 图标名称
 * @param {string} props.iconColor - 图标颜色类名
 * @param {string} props.iconBg - 图标背景色类名
 * @param {React.ReactNode} props.badge - 徽章内容（如数量）
 * @param {React.ReactNode} props.status - 状态指示器
 * @param {React.ReactNode} props.actions - 操作按钮
 * @param {React.ReactNode} props.details - 详细信息（悬停/点击显示）
 * @param {boolean} props.disabled - 是否禁用
 * @param {boolean} props.active - 是否激活状态
 * @param {Function} props.onClick - 点击回调
 * @param {string} props.className - 额外的类名
 */
export const CompactCard = ({
  title,
  subtitle,
  icon,
  iconColor = 'text-gray-400',
  iconBg = 'bg-gray-700',
  badge,
  status,
  actions,
  details,
  disabled = false,
  active = false,
  onClick,
  className = '',
}) => {
  const [showDetails, setShowDetails] = useState(false);

  const handleClick = (e) => {
    if (disabled) return;
    if (onClick) {
      onClick(e);
    } else if (details) {
      // 移动端：点击显示详情
      setShowDetails(true);
    }
  };

  const cardClasses = `
    relative group
    bg-gray-800/50 backdrop-blur-sm
    border rounded-lg
    transition-all duration-200
    ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-gray-800/70'}
    ${active ? 'border-blue-500 ring-2 ring-blue-500/50' : 'border-gray-700 hover:border-gray-600'}
    ${className}
  `.trim().replace(/\s+/g, ' ');

  return (
    <>
      <div
        className={cardClasses}
        onClick={handleClick}
        onMouseEnter={() => !disabled && details && setShowDetails(true)}
        onMouseLeave={() => setShowDetails(false)}
      >
        {/* 卡片头部 */}
        <div className="p-2">
          <div className="flex items-start gap-2 mb-1">
            {/* 图标 */}
            {icon && (
              <div className={`${iconBg} ${iconColor} p-1 rounded flex-shrink-0`}>
                <Icon name={icon} size={16} />
              </div>
            )}
            
            {/* 标题和副标题 */}
            <div className="flex-1 min-w-0">
              <h4 className="text-xs font-semibold text-white truncate">{title}</h4>
              {subtitle && (
                <p className="text-[10px] text-gray-400 truncate">{subtitle}</p>
              )}
            </div>
            
            {/* 徽章 */}
            {badge && (
              <div className="flex-shrink-0">
                {badge}
              </div>
            )}
          </div>

          {/* 状态指示器 */}
          {status && (
            <div className="mb-1">
              {status}
            </div>
          )}

          {/* 操作按钮 */}
          {actions && (
            <div className="mt-2">
              {actions}
            </div>
          )}
        </div>

        {/* PC端悬停详情 - Tooltip */}
        {details && (
          <div className={`
            hidden lg:block
            absolute left-full top-0 ml-2 w-64 z-[70]
            bg-gray-900/95 backdrop-blur-md
            border border-gray-700
            rounded-lg shadow-2xl
            p-3
            transition-opacity duration-200
            ${showDetails ? 'opacity-100' : 'opacity-0 pointer-events-none'}
          `}>
            {details}
          </div>
        )}
      </div>

      {/* 移动端详情 - Modal */}
      {details && showDetails && (
        <div
          className="lg:hidden fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setShowDetails(false)}
        >
          {/* 遮罩 */}
          <div className="absolute inset-0 bg-black/70" />
          
          {/* 内容 */}
          <div
            className="relative w-full sm:max-w-lg bg-gray-900 sm:rounded-xl overflow-hidden animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 头部 */}
            <div className="flex items-center justify-between p-4 border-b border-gray-700">
              <div className="flex items-center gap-2">
                {icon && (
                  <div className={`${iconBg} ${iconColor} p-2 rounded`}>
                    <Icon name={icon} size={20} />
                  </div>
                )}
                <div>
                  <h3 className="text-sm font-bold text-white">{title}</h3>
                  {subtitle && (
                    <p className="text-xs text-gray-400">{subtitle}</p>
                  )}
                </div>
              </div>
              <button
                onClick={() => setShowDetails(false)}
                className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
              >
                <Icon name="X" size={20} className="text-gray-400" />
              </button>
            </div>
            
            {/* 详情内容 */}
            <div className="p-4 max-h-[70vh] overflow-y-auto">
              {details}
            </div>
            
            {/* 底部操作 */}
            {actions && (
              <div className="p-4 border-t border-gray-700 bg-gray-800/50">
                {actions}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};

/**
 * 紧凑卡片网格容器
 * @param {Object} props
 * @param {React.ReactNode} props.children - 子元素
 * @param {string} props.className - 额外的类名
 */
export const CompactCardGrid = ({ children, className = '' }) => {
  return (
    <div className={`
      grid gap-2
      grid-cols-2
      sm:grid-cols-3
      md:grid-cols-4
      lg:grid-cols-5
      xl:grid-cols-6
      ${className}
    `}>
      {children}
    </div>
  );
};
