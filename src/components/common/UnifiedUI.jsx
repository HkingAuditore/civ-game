/**
 * 统一UI组件库
 * 提供一致的按钮、卡片、弹窗等组件，确保全局样式统一
 */

import React from 'react';
import { Icon } from './UIComponents';
import {
  getButtonStyles,
  getCardStyles,
  getBadgeStyles,
  MODAL_STYLES,
  INPUT_STYLES,
  DIVIDER_STYLES,
  LIST_ITEM_STYLES,
  PROGRESS_STYLES,
  TAB_STYLES,
  cn,
} from '../../config/unifiedStyles';

// ==================== 按钮组件 ====================
export const Button = ({
  children,
  variant = 'primary',
  size = 'md',
  disabled = false,
  onClick,
  className = '',
  icon,
  iconPosition = 'left',
  ...props
}) => {
  return (
    <button
      className={cn(getButtonStyles(variant, size, disabled), className)}
      onClick={onClick}
      disabled={disabled}
      {...props}
    >
      {icon && iconPosition === 'left' && icon}
      {children}
      {icon && iconPosition === 'right' && icon}
    </button>
  );
};

// ==================== 卡片组件 ====================
export const Card = ({
  children,
  variant = 'default',
  padding = 'md',
  hover = false,
  className = '',
  onClick,
  ...props
}) => {
  return (
    <div
      className={cn(getCardStyles(variant, padding, hover), className)}
      onClick={onClick}
      {...props}
    >
      {children}
    </div>
  );
};

// ==================== 弹窗组件 ====================
export const Modal = ({
  isOpen,
  onClose,
  title,
  children,
  footer,
  size = 'md',
  showCloseButton = true,
  overlayClassName = '',
  containerClassName = '',
}) => {
  if (!isOpen) return null;

  return (
    <div className={cn(MODAL_STYLES.overlay, overlayClassName)} onClick={onClose}>
      <div
        className={cn(
          MODAL_STYLES.container.base,
          MODAL_STYLES.container[size],
          containerClassName
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 头部 */}
        <div className={MODAL_STYLES.header}>
<h3 className="text-lg font-bold text-ancient-gold font-decorative">{title}</h3>
          {showCloseButton && (
            <button className={MODAL_STYLES.closeButton} onClick={onClose}>
              <Icon name="X" size={20} />
            </button>
          )}
        </div>

        {/* 内容 */}
        <div className={MODAL_STYLES.body}>{children}</div>

        {/* 底部 */}
        {footer && <div className={MODAL_STYLES.footer}>{footer}</div>}
      </div>
    </div>
  );
};

// ==================== 输入框组件 ====================
export const Input = ({
  value,
  onChange,
  placeholder,
  type = 'text',
  size = 'md',
  disabled = false,
  className = '',
  ...props
}) => {
  return (
    <input
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      disabled={disabled}
      className={cn(INPUT_STYLES.base, INPUT_STYLES.sizes[size], disabled && INPUT_STYLES.disabled, className)}
      {...props}
    />
  );
};

// ==================== 徽章组件 ====================
export const Badge = ({
  children,
  variant = 'default',
  icon,
  className = '',
  ...props
}) => {
  return (
    <span className={cn(getBadgeStyles(variant), className)} {...props}>
      {icon && icon}
      {children}
    </span>
  );
};

// ==================== 分隔线组件 ====================
export const Divider = ({ orientation = 'horizontal', className = '' }) => {
  return (
    <div
      className={cn(
        orientation === 'horizontal' ? DIVIDER_STYLES.horizontal : DIVIDER_STYLES.vertical,
        className
      )}
    />
  );
};

// ==================== 列表项组件 ====================
export const ListItem = ({
  children,
  hover = true,
  active = false,
  border = true,
  onClick,
  className = '',
  ...props
}) => {
  return (
    <div
      className={cn(
        LIST_ITEM_STYLES.base,
        hover && LIST_ITEM_STYLES.hover,
        active && LIST_ITEM_STYLES.active,
        border && LIST_ITEM_STYLES.border,
        className
      )}
      onClick={onClick}
      {...props}
    >
      {children}
    </div>
  );
};

// ==================== 进度条组件 ====================
export const ProgressBar = ({
  current,
  max,
  variant = 'default',
  showLabel = false,
  className = '',
}) => {
  const percentage = Math.min(100, Math.max(0, (current / max) * 100));

  return (
    <div className="w-full">
      <div className={cn(PROGRESS_STYLES.container, className)}>
        <div
          className={cn(PROGRESS_STYLES.bar, PROGRESS_STYLES.variants[variant])}
          style={{ width: `${percentage}%` }}
        />
      </div>
      {showLabel && (
        <div className="flex justify-between mt-1 text-xs text-ancient-stone">
          <span>{current}</span>
          <span>{max}</span>
        </div>
      )}
    </div>
  );
};

// ==================== 标签页组件 ====================
export const Tabs = ({ tabs, activeTab, onChange, className = '' }) => {
  return (
    <div className={cn(TAB_STYLES.container, className)}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          className={cn(
            TAB_STYLES.tab.base,
            activeTab === tab.id ? TAB_STYLES.tab.active : TAB_STYLES.tab.inactive
          )}
          onClick={() => onChange(tab.id)}
        >
          {tab.icon && <Icon name={tab.icon} size={16} />}
          {tab.label}
          {tab.badge && <Badge variant="primary" className="ml-2">{tab.badge}</Badge>}
        </button>
      ))}
    </div>
  );
};

// ==================== 信息卡片组件 ====================
export const InfoCard = ({
  icon,
  title,
  value,
  subtitle,
  trend,
  variant = 'default',
  className = '',
}) => {
  return (
    <Card variant={variant} padding="md" hover className={cn('flex flex-col', className)}>
      <div className="flex items-center gap-3 mb-2">
        {icon && (
          <div className="p-2 rounded-lg bg-ancient-gold/10 text-ancient-gold">
            {icon}
          </div>
        )}
        <div className="flex-1">
          <div className="text-xs text-ancient-stone mb-1">{title}</div>
          <div className="text-2xl font-bold text-ancient-gold">{value}</div>
        </div>
      </div>
      {subtitle && <div className="text-xs text-ancient-stone/70 mt-1">{subtitle}</div>}
      {trend !== undefined && trend !== 0 && (
        <div className={cn('text-xs mt-2 flex items-center gap-1', trend > 0 ? 'text-green-400' : 'text-red-400')}>
          <Icon name={trend > 0 ? 'TrendingUp' : 'TrendingDown'} size={12} />
          <span>{trend > 0 ? '+' : ''}{trend}</span>
        </div>
      )}
    </Card>
  );
};

// ==================== 可折叠卡片组件 ====================
export const CollapsibleCard = ({
  title,
  icon,
  badge,
  children,
  defaultExpanded = true,
  variant = 'default',
  className = '',
}) => {
  const [isExpanded, setIsExpanded] = React.useState(defaultExpanded);

  return (
    <Card variant={variant} padding="none" className={className}>
      <button
        className="w-full flex items-center justify-between p-4 hover:bg-ancient-gold/5 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          {icon && <div className="text-ancient-gold">{icon}</div>}
<span className="font-semibold text-ancient-parchment font-decorative">{title}</span>
          {badge && <Badge variant="primary">{badge}</Badge>}
        </div>
        <Icon
          name="ChevronDown"
          size={20}
          className={cn(
            'text-ancient-stone transition-transform',
            isExpanded && 'transform rotate-180'
          )}
        />
      </button>
      {isExpanded && (
        <div className="p-4 border-t border-ancient-gold/20">
          {children}
        </div>
      )}
    </Card>
  );
};

// ==================== 操作卡片组件 ====================
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
    <Card variant="epic" padding="md" hover className={className}>
      <div className="flex items-start gap-4">
        {icon && (
          <div className="p-3 rounded-xl bg-ancient-gold/10 text-ancient-gold flex-shrink-0">
            {icon}
          </div>
        )}
        <div className="flex-1">
<h4 className="font-bold text-ancient-parchment mb-1 font-decorative">{title}</h4>
          {description && <p className="text-sm text-ancient-stone mb-3">{description}</p>}
          <Button
            variant={variant}
            size="sm"
            onClick={onAction}
            disabled={disabled}
          >
            {actionLabel}
          </Button>
        </div>
      </div>
    </Card>
  );
};

// ==================== 统计卡片网格 ====================
export const StatsGrid = ({ children, cols = 3, gap = 4, className = '' }) => {
  const gridCols = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
  };

  return (
    <div className={cn('grid', gridCols[cols], `gap-${gap}`, className)}>
      {children}
    </div>
  );
};

export default {
  Button,
  Card,
  Modal,
  Input,
  Badge,
  Divider,
  ListItem,
  ProgressBar,
  Tabs,
  InfoCard,
  CollapsibleCard,
  ActionCard,
  StatsGrid,
};
