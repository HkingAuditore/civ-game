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
  const tabs = [
    {
      id: 'build',
      label: '建设',
      icon: 'Hammer',
      indicator: 'from-amber-300 via-amber-200 to-amber-300',
    },
    {
      id: 'military',
      label: '军事',
      icon: 'Swords',
      indicator: 'from-red-300 via-red-200 to-red-300',
    },
    {
      id: 'tech',
      label: '科技',
      icon: 'Cpu',
      indicator: 'from-cyan-300 via-cyan-200 to-cyan-300',
    },
    {
      id: 'politics',
      label: '政令',
      icon: 'Gavel',
      indicator: 'from-purple-300 via-purple-200 to-purple-300',
    },
    {
      id: 'diplo',
      label: '外交',
      icon: 'Globe',
      indicator: 'from-blue-300 via-blue-200 to-blue-300',
    },
  ];

  return (
    <nav
      className={`fixed bottom-0 left-0 right-0 z-50 lg:hidden pb-safe-bottom border-t border-theme-border shadow-metal-md backdrop-blur-md bg-gradient-to-r from-ancient-ink/95 via-gray-950/90 to-ancient-ink/95`}
      role="tablist"
      aria-label="主标签切换"
    >
      <div className="relative max-w-2xl mx-auto px-3 py-2 flex items-stretch">
        {tabs.map((tab, index) => {
          const isActive = activeTab === tab.id;
          
          return (
            <React.Fragment key={tab.id}>
              <button
                type="button"
                role="tab"
                aria-label={tab.label}
                aria-selected={isActive}
                onClick={() => onTabChange(tab.id)}
                className={`
                  relative flex-1 min-w-[56px] h-full flex flex-col items-center justify-center gap-1
                  px-3 py-2 transition-colors duration-150 text-[10px] font-semibold tracking-wide
                  ${isActive 
                    ? 'bg-white/10 text-white shadow-inner border border-white/10'
                    : 'text-white/65 hover:text-white border border-transparent'
                  }
                `}
              >
                {/* 图标 */}
                <Icon 
                  name={tab.icon} 
                  size={20} 
                  className={isActive ? 'text-white drop-shadow' : 'text-white/70'}
                />
                
                {/* 标签文字 */}
                <span className="uppercase tracking-[0.2em] text-[9px]">
                  {tab.label}
                </span>
                
                {/* 激活指示器 */}
                {isActive && (
                  <div className={`absolute -bottom-0.5 left-0 right-0 h-0.5 bg-gradient-to-r ${tab.indicator}`} />
                )}
              </button>
              {index < tabs.length - 1 && (
                <span className="w-px bg-white/10 mx-1 my-1" aria-hidden="true" />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </nav>
  );
};
