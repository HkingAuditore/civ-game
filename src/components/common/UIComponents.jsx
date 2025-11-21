// 通用UI组件
// 包含图标组件和浮动文本组件

import React, { useEffect } from 'react';
import { getIcon } from '../../config/iconMap';

/**
 * 图标组件
 * @param {string} name - 图标名称
 * @param {number} size - 图标大小（默认16）
 * @param {string} className - 额外的CSS类名
 */
export const Icon = ({ name, size = 16, className }) => {
  const Component = getIcon(name);
  if (!Component) return null;
  return <Component size={size} className={className} />;
};

/**
 * 浮动文本组件
 * 用于显示资源获取等动画效果
 * @param {number} x - X坐标
 * @param {number} y - Y坐标
 * @param {string} text - 显示文本
 * @param {string} color - 文本颜色
 * @param {function} onComplete - 动画完成回调
 */
export const FloatingText = ({ x, y, text, color, onComplete }) => {
  useEffect(() => {
    const timer = setTimeout(onComplete, 800);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div
      className={`fixed pointer-events-none font-bold text-lg z-50 animate-float-up ${color}`}
      style={{ left: x, top: y }}
    >
      {text}
    </div>
  );
};
