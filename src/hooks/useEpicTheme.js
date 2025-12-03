// Epic Theme Hook - 史诗主题钩子
// 用于在组件中应用和管理史诗主题

import { useEffect } from 'react';
import { applyEpochTheme, getEpochTheme, getBackgroundPattern } from '../config/epicTheme';

/**
 * 使用史诗主题的Hook
 * 根据当前时代自动应用主题
 */
export const useEpicTheme = (epochId) => {
  useEffect(() => {
    // 应用时代主题
    applyEpochTheme(epochId);
    
    // 获取主题配置
    const theme = getEpochTheme(epochId);
    
    // 应用背景图案
    const pattern = getBackgroundPattern(theme.bgPattern);
    document.body.style.backgroundImage = `${theme.bgGradient}, url("${pattern}")`;
    document.body.style.backgroundAttachment = 'fixed';
    document.body.style.backgroundSize = 'cover, 100px 100px';
    
    // 更新meta主题色（移动端）
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      metaThemeColor.setAttribute('content', theme.primaryColor);
    }
    
    // 清理函数
    return () => {
      // 组件卸载时可以选择重置主题
    };
  }, [epochId]);
  
  return getEpochTheme(epochId);
};

/**
 * 获取时代特定的CSS类名
 */
export const useEpochClasses = (epochId) => {
  const theme = getEpochTheme(epochId);
  
  return {
    // 文本颜色类
    text: `text-[${theme.primaryColor}]`,
    textAccent: `text-[${theme.accentColor}]`,
    
    // 背景类
    bg: `bg-[${theme.primaryColor}]`,
    bgSecondary: `bg-[${theme.secondaryColor}]`,
    
    // 边框类
    border: `border-[${theme.borderColor}]`,
    
    // 发光效果类
    glow: `shadow-[0_0_20px_${theme.glowColor}]`,
    
    // 渐变类
    gradient: `bg-gradient-to-r from-[${theme.secondaryColor}] to-[${theme.primaryColor}]`,
  };
};

/**
 * 动态生成时代主题样式
 */
export const getEpochStyles = (epochId) => {
  const theme = getEpochTheme(epochId);
  
  return {
    // 主要颜色
    color: theme.primaryColor,
    
    // 边框样式
    borderColor: theme.borderColor,
    
    // 阴影样式
    boxShadow: `0 0 20px ${theme.glowColor}`,
    
    // 背景渐变
    background: theme.bgGradient,
  };
};

export default useEpicTheme;
