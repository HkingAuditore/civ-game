// 底部导航栏组件 - 移动端专用
// 固定在底部，方便单手操作

import React from 'react';
import { Icon } from '../common/UIComponents';
import { EPOCHS } from '../../config';

/**
 * 底部导航栏组件
 * 仅在移动端显示，提供快速切换标签页的功能
 */
export const BottomNav = ({ activeTab, onTabChange, epoch = 0 }) => {
  // 获取当前时代的主题色
  const epochColor = EPOCHS[epoch]?.color || 'text-blue-400';
  
  const tabs = [
    { id: 'build', label: '建设', icon: 'Hammer', color: 'from-amber-600 to-amber-800' },
    { id: 'military', label: '军事', icon: 'Swords', color: 'from-red-600 to-red-800' },
    { id: 'tech', label: '科技', icon: 'Cpu', color: 'from-cyan-600 to-cyan-800' },
    { id: 'politics', label: '政令', icon: 'Gavel', color: 'from-purple-600 to-purple-800' },
    { id: 'diplo', label: '外交', icon: 'Globe', color: 'from-blue-600 to-blue-800' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 lg:hidden bg-gray-900/90 backdrop-blur-md border-t border-white/10 shadow-glass pb-safe-bottom">
      <div className="flex items-center justify-around px-2 py-2">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`
                relative flex flex-col items-center justify-center gap-1 
                px-3 py-2 rounded-xl transition-all duration-300 min-w-[64px]
                ${isActive 
                  ? `bg-gradient-to-br ${tab.color} shadow-glow-md scale-105` 
                  : 'hover:bg-gray-800/50 active:scale-95'
                }
              `}
            >
              {/* 图标 */}
              <div className={`
                transition-transform duration-300
                ${isActive ? 'scale-110' : ''}
              `}>
                <Icon 
                  name={tab.icon} 
                  size={20} 
                  className={isActive ? 'text-white' : 'text-gray-400'}
                />
              </div>
              
              {/* 标签文字 */}
              <span className={`
                text-[10px] font-bold transition-colors
                ${isActive ? 'text-white' : 'text-gray-500'}
              `}>
                {tab.label}
              </span>
              
              {/* 激活指示器 */}
              {isActive && (
                <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-8 h-1 bg-white rounded-full shadow-glow-sm animate-pulse" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};