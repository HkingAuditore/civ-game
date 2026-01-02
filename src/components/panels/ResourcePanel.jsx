// 资源面板组件
// 显示当前资源数量和生产速率 - 增强史诗风格

import React, { useState, useMemo } from 'react';
import { Icon } from '../common/UIComponents';
import { RESOURCES } from '../../config';

/**
 * 资源面板组件 - 史诗风格重构
 * 紧凑展示，减少滚动，增强视觉效果
 * @param {Object} resources - 资源对象
 * @param {Object} rates - 生产速率对象
 * @param {Object} market - 市场对象
 * @param {number} epoch - 当前时代
 * @param {Function} onDetailClick - 点击详情回调
 */
export const ResourcePanel = ({
    resources,
    rates,
    market,
    epoch = 0,
    onDetailClick,
    title = '国内市场',
    showDetailedMobile = false,
}) => {
    const [viewMode, setViewMode] = useState('list'); // 'grid' | 'list' - 默认列表视图更紧凑

    const formatCompactNumber = (value) => {
        const num = Math.floor(value);
        if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
        if (num >= 10000) return (num / 1000).toFixed(0) + 'k';
        if (num >= 1000) return (num / 1000).toFixed(1) + 'k';
        return num.toString();
    };

    const getPrice = (key) => {
        if (!market) return RESOURCES[key]?.basePrice || 1;
        const base = RESOURCES[key]?.basePrice || 1;
        return market.prices?.[key] ?? base;
    };

    // 过滤可见资源
    const visibleResources = useMemo(() => {
        return Object.entries(RESOURCES).filter(([key, info]) => {
            if (info.type === 'virtual' || info.type === 'currency') return false;
            if (typeof info.unlockEpoch === 'number' && info.unlockEpoch > epoch) return false;
            return true;
        });
    }, [epoch]);

    // 获取资源趋势箭头
    const getTrendIndicator = (rate) => {
        if (rate > 0) return { icon: 'TrendingUp', color: 'text-green-400' };
        if (rate < 0) return { icon: 'TrendingDown', color: 'text-red-400' };
        return { icon: 'Minus', color: 'text-ancient-stone/50' };
    };

    // 获取图标框架颜色类
    const getIconFrameClass = (key) => {
        const colorMap = {
            food: 'resource-icon-food',
            wood: 'resource-icon-wood',
            stone: 'resource-icon-stone',
            iron: 'resource-icon-iron',
            silver: 'resource-icon-gold',
        };
        return colorMap[key] || '';
    };

    return (
        <div className="space-y-2">
            {/* 表头 - PC端显示，移动端（showDetailedMobile为true时）隐藏 */}
            {!showDetailedMobile && (
                <div className="flex items-center justify-between pb-1.5 border-b border-ancient-gold/20">
                    <div className="flex items-center gap-1.5">
                        <div className="icon-epic-frame icon-frame-xs">
                            <Icon name="Package" size={12} className="text-ancient-gold" />
                        </div>
                        {title && (
                            <span className="text-[10px] font-bold text-ancient tracking-wide uppercase font-decorative">
                                {title}
                            </span>
                        )}
                    </div>

                    {/* 视图切换 - 小型按钮组 */}
                    <div className="btn-group-compact">
                        <button
                            onClick={() => setViewMode('grid')}
                            className={viewMode === 'grid' ? 'active text-ancient-gold' : 'text-ancient-stone'}
                            title="网格视图"
                        >
                            <Icon name="LayoutGrid" size={10} />
                        </button>
                        <button
                            onClick={() => setViewMode('list')}
                            className={viewMode === 'list' ? 'active text-ancient-gold' : 'text-ancient-stone'}
                            title="列表视图"
                        >
                            <Icon name="List" size={10} />
                        </button>
                    </div>
                </div>
            )}

            {/* 网格视图 - 更紧凑 */}
            {viewMode === 'grid' && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                    {visibleResources.map(([key, info]) => {
                        const amount = resources[key] || 0;
                        const rate = rates[key] || 0;
                        const price = getPrice(key);
                        const trend = getTrendIndicator(rate);

                        return (
                            <button
                                key={key}
                                onClick={() => onDetailClick && onDetailClick(key)}
                                className="relative group w-full min-w-0 p-2 rounded-lg transition-all touch-feedback card-epic-hover
                  bg-gradient-to-br from-ancient-ink/60 via-transparent to-ancient-ink/40
                  border border-ancient-gold/15 hover:border-ancient-gold/40
                  hover:shadow-glow-gold overflow-hidden"
                                title={`${info.name}: ${amount.toFixed(0)} | 价格: ${price.toFixed(2)} | 变化: ${rate > 0 ? '+' : ''}${rate.toFixed(1)}/日`}
                            >
                                {/* 背景装饰 */}
                                <div className="absolute inset-0 bg-gradient-to-r from-ancient-gold/0 via-ancient-gold/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

                                {/* 内容 */}
                                <div className="relative z-10">
                                    {/* 第一行：图标 + 名称 + 趋势 */}
                                    <div className="flex items-center justify-between mb-1">
                                        <div className="flex items-center gap-1.5 min-w-0">
                                            <div className={`icon-epic-frame icon-frame-xs ${getIconFrameClass(key)}`}>
                                                <Icon name={info.icon} size={12} className={info.color || 'text-ancient-parchment'} />
                                            </div>
                                            <span className="text-[10px] font-semibold text-ancient-parchment truncate max-w-[50px]">
                                                {info.name}
                                            </span>
                                        </div>
                                        <Icon name={trend.icon} size={10} className={trend.color} />
                                    </div>

                                    {/* 第二行：数量 */}
                                    <div className="text-sm font-bold font-mono text-ancient group-hover:text-ancient-gold transition-colors">
                                        {formatCompactNumber(amount)}
                                    </div>

                                    {/* 第三行：价格 + 变化 */}
                                    <div className="flex items-center justify-between gap-1 mt-1 font-bold text-[11px] min-w-0">
                                        <span className="text-ancient-stone flex items-center gap-0.5 min-w-0 truncate">
                                            <Icon name="Coins" size={8} className="text-ancient-gold/70" />
                                            {price.toFixed(1)}
                                        </span>
                                        <span className={`font-mono text-right ${rate > 0 ? 'text-green-400' : rate < 0 ? 'text-red-400' : 'text-ancient-stone/50'}`}>
                                            {rate !== 0 ? `${rate > 0 ? '+' : ''}${rate.toFixed(1)}` : '--'}
                                        </span>
                                    </div>
                                </div>
                            </button>
                        );
                    })}
                </div>
            )}

            {/* 列表视图 */}
            {viewMode === 'list' && (
                <div className="space-y-0.5 row-compact">
                    {showDetailedMobile ? (
                        <>
                            <div className="grid grid-cols-[20px_1fr_auto_auto_auto] items-center gap-x-2 text-[10px] text-ancient-stone px-1 pb-0.5 opacity-70">
                                <span></span>
                                <span>资源</span>
                                <span className="text-right w-12">库存</span>
                                <span className="text-right w-12">价格</span>
                                <span className="text-right w-12">变化</span>
                            </div>

                            {visibleResources.map(([key, info]) => {
                                const amount = resources[key] || 0;
                                const rate = rates[key] || 0;
                                const price = getPrice(key);
                                const rateDisplay = rate !== 0 ? `${rate > 0 ? '+' : ''}${rate.toFixed(1)}` : '--';
                                const rateColorClass =
                                    rate > 0
                                        ? 'text-green-400'
                                        : rate < 0
                                            ? 'text-red-400'
                                            : 'text-ancient-stone opacity-50';

                                return (
                                    <button
                                        key={key}
                                        onClick={() => onDetailClick && onDetailClick(key)}
                                        className="w-full group grid grid-cols-[20px_1fr_auto_auto_auto] items-center gap-x-2 py-0.5 px-1 appearance-none bg-transparent border-0 border-b border-ancient-gold/10 hover:bg-ancient-gold/5 touch-feedback"
                                    >
                                        <Icon name={info.icon} size={16} className={`flex-shrink-0 ${info.color || 'text-ancient-parchment'}`} />

                                        <span className="text-[12px] text-ancient-parchment font-medium truncate leading-none text-left">
                                            {info.name}
                                        </span>

                                        <span className="font-mono font-bold text-ancient-parchment text-right text-[11px] w-12">
                                            {formatCompactNumber(amount)}
                                        </span>

                                        <span className="font-mono text-ancient-stone font-bold text-[11px] text-right w-12">
                                            {price.toFixed(1)}
                                        </span>

                                        <span className={`font-mono text-right text-[11px] w-12 ${rateColorClass}`}>
                                            {rateDisplay}
                                        </span>
                                    </button>
                                );
                            })}
                        </>
                    ) : (
                        <>
                            <div className="grid grid-cols-[20px_1.3fr_1fr] xl:grid-cols-[20px_1.5fr_1fr_1fr_1fr] items-center gap-x-3 text-[12px] text-ancient-gold px-1.5 pb-1 opacity-70">
                                <span className="hidden xl:col-span-2 xl:inline pl-0.5 whitespace-nowrap overflow-hidden">资源</span>
                                <span className="xl:hidden w-5" />
                                <span className="text-right whitespace-nowrap">库存</span>
                                <span className="text-right whitespace-nowrap">价格</span>
                                <span className="hidden xl:block text-right whitespace-nowrap">变化</span>
                            </div>

                            {visibleResources.map(([key, info]) => {
                                const amount = resources[key] || 0;
                                const rate = rates[key] || 0;
                                const price = getPrice(key);
                                const rateDisplay = rate !== 0 ? `${rate > 0 ? '+' : ''}${rate.toFixed(1)}` : '--';
                                const rateColorClass =
                                    rate > 0
                                        ? 'text-green-400 group-hover:text-green-300'
                                        : rate < 0
                                            ? 'text-red-400 group-hover:text-red-300'
                                            : 'text-ancient-stone opacity-50';

                                return (
                                    <button
                                        key={key}
                                        onClick={() => onDetailClick && onDetailClick(key)}
                                        className="w-full relative group grid grid-cols-[20px_1.3fr_1fr] xl:grid-cols-[20px_1.5fr_1fr_1fr_1fr] items-center gap-x-3 text-xs p-1.5 rounded-lg transition-all cursor-pointer overflow-hidden appearance-none bg-transparent border border-ancient-gold/10 hover:border-ancient-gold/30 hover:bg-ancient-gold/5 hover:shadow-glow-gold touch-feedback"
                                    >
                                        <div className="absolute inset-0 bg-gradient-to-r from-ancient-gold/0 via-ancient-gold/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

                                        <div className={`icon-epic-frame icon-frame-xs flex-shrink-0 relative z-10 ${getIconFrameClass(key)}`}>
                                            <Icon name={info.icon} size={11} className={info.color || 'text-ancient-parchment'} />
                                        </div>

                                        <div className="hidden xl:flex flex-col gap-0.5 overflow-hidden relative z-10 min-w-0">
                                            <span className="text-[13px] text-ancient-parchment font-semibold truncate leading-tight group-hover:text-ancient text-left">
                                                {info.name}
                                            </span>
                                        </div>

                                        <span className="font-mono font-bold text-ancient-parchment text-right relative z-10 group-hover:text-ancient text-[11px] whitespace-nowrap truncate tracking-tight">
                                            {formatCompactNumber(amount)}
                                        </span>

                                        <div className="flex items-center justify-end gap-0.5 font-mono text-ancient-parchment text-[11px] relative z-10 group-hover:text-ancient-gold whitespace-nowrap overflow-hidden">
                                            <span>{price.toFixed(1)}</span>
                                            <Icon name="Coins" size={8} className="text-ancient-gold/70 flex-shrink-0" />
                                        </div>

                                        <span className={`hidden xl:block font-mono text-right relative z-10 transition-colors text-[10px] truncate ${rateColorClass}`}>
                                            {rateDisplay}
                                        </span>
                                    </button>
                                );
                            })}
                        </>
                    )}
                </div>
            )}
            {/* 底部汇总 */}
            <div className="epic-divider" />
            <div className="flex items-center justify-between text-[9px] text-ancient-stone px-1">
                <span className="flex items-center gap-1">
                    <Icon name="Info" size={10} className="text-ancient-gold/70" />
                    点击资源查看详情
                </span>
                {/* <span className="font-mono">{visibleResources.length} 种资源</span> */}
            </div>
        </div>
    );
};
