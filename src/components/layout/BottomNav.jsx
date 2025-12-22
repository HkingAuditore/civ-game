// 底部导航栏组件 - 史诗金属风格
// 固定在底部，使用时代主题色背景

import React from 'react';
import { Icon } from '../common/UIComponents';

// Tab配置，包含独特的颜色主题
const TAB_CONFIG = {
    build: {
        label: '建设',
        icon: 'Hammer',
        color: 'from-amber-500 to-yellow-600',
        glow: 'shadow-amber-500/40',
        text: 'text-amber-400',
        border: 'border-amber-500/50'
    },
    military: {
        label: '军事',
        icon: 'Swords',
        color: 'from-red-500 to-rose-600',
        glow: 'shadow-red-500/40',
        text: 'text-red-400',
        border: 'border-red-500/50'
    },
    tech: {
        label: '科技',
        icon: 'Cpu',
        color: 'from-cyan-500 to-blue-600',
        glow: 'shadow-cyan-500/40',
        text: 'text-cyan-400',
        border: 'border-cyan-500/50'
    },
    politics: {
        label: '行政',
        icon: 'Gavel',
        color: 'from-purple-500 to-violet-600',
        glow: 'shadow-purple-500/40',
        text: 'text-purple-400',
        border: 'border-purple-500/50'
    },
    diplo: {
        label: '外交',
        icon: 'Globe',
        color: 'from-emerald-500 to-green-600',
        glow: 'shadow-emerald-500/40',
        text: 'text-emerald-400',
        border: 'border-emerald-500/50'
    },
};

/**
 * 底部导航栏组件 - 史诗金属风格
 * 移动端专用，使用时代主题色背景
 */
export const BottomNav = ({ activeTab, onTabChange, epoch = 0 }) => {
    const tabs = Object.entries(TAB_CONFIG).map(([id, config]) => ({ id, ...config }));

    return (
        <nav
            className="fixed bottom-0 left-0 right-0 z-50 lg:hidden"
            role="tablist"
            aria-label="主标签切换"
        >
            {/* 时代主题色背景层 */}
            <div className="absolute inset-0">
                {/* 主背景 - 使用时代主题色 */}
                <div
                    className="absolute inset-0 backdrop-blur-lg"
                    style={{
                        background: `linear-gradient(to top, var(--theme-background, rgb(17, 24, 39)) 0%, color-mix(in srgb, var(--theme-surface, rgb(31, 41, 55)) 95%, transparent) 50%, color-mix(in srgb, var(--theme-surface-alt, rgb(55, 65, 81)) 90%, transparent) 100%)`
                    }}
                />
                {/* 顶部金属高光 - 使用时代主题色 */}
                <div
                    className="absolute top-0 left-0 right-0 h-px"
                    style={{
                        background: `linear-gradient(to right, transparent, var(--theme-accent, rgb(212, 175, 55)) 50%, transparent)`
                    }}
                />
                <div className="absolute top-[1px] left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                {/* 金属纹理 */}
                <div className="absolute inset-0 opacity-[0.03]" style={{
                    backgroundImage: `repeating-linear-gradient(90deg, transparent, transparent 1px, rgba(255,255,255,0.03) 1px, rgba(255,255,255,0.03) 2px)`
                }} />
            </div>

            {/* 导航内容 */}
            <div className="relative max-w-lg mx-auto px-1">
                <div className="flex items-stretch justify-around h-14 landscape-compact-nav">
                    {tabs.map((tab) => {
                        const isActive = activeTab === tab.id;

                        return (
                            <button
                                key={tab.id}
                                type="button"
                                role="tab"
                                aria-label={tab.label}
                                aria-selected={isActive}
                                onClick={() => onTabChange(tab.id)}
                                className={`
                  relative flex flex-col items-center justify-center flex-1
                  transition-all duration-200 ease-out
                  ${isActive ? 'scale-105' : 'active:scale-95'}
                `}
                            >
                                {/* 激活状态背景 */}
                                {isActive && (
                                    <>
                                        {/* 发光效果 */}
                                        <div className={`absolute inset-x-1 top-1 bottom-1 rounded-lg bg-gradient-to-b ${tab.color} opacity-15 blur-sm`} />
                                        {/* 背景容器 */}
                                        <div className={`absolute inset-x-1 top-1 bottom-1 rounded-lg bg-gradient-to-b ${tab.color} opacity-20 border ${tab.border}`} />
                                        {/* 顶部高亮条 */}
                                        <div className={`absolute top-0 left-1/4 right-1/4 h-0.5 rounded-full bg-gradient-to-r ${tab.color}`} />
                                    </>
                                )}

                                {/* 图标容器 */}
                                <div className={`
                  relative z-10 p-1 rounded-md transition-all duration-200
                  ${isActive ? '' : 'text-gray-500'}
                `}>
                                    <Icon
                                        name={tab.icon}
                                        size={isActive ? 20 : 18}
                                        className={`transition-all duration-200 ${isActive ? tab.text : ''}`}
                                    />
                                </div>

                                {/* 标签文字 */}
                                <span className={`
                  relative z-10 text-[9px] font-bold mt-0.5 transition-all duration-200 tab-title
                  ${isActive ? tab.text : 'text-gray-500'}
                `}>
                                    {tab.label}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* 底部安全区域填充 - 适配全面屏手势区域 */}
            <div
                className="relative w-full"
                style={{
                    height: 'env(safe-area-inset-bottom, 0px)',
                    background: 'var(--theme-background, rgb(17, 24, 39))'
                }}
            />
        </nav>
    );
};
