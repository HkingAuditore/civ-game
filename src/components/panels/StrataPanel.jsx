// 社会阶层面板组件
// 显示各个社会阶层的人口、好感度和影响力

import React, { useMemo, useState, memo } from 'react';
import { Icon } from '../common/UIComponents';
import { STRATA, RESOURCES } from '../../config';
import { formatEffectDetails } from '../../utils/effectFormatter';
import { getSimpleLivingStandard } from '../../utils/livingStandard';
import {
    getOrganizationStage,
    getStageName,
    getStageIcon,
    predictDaysToUprising
} from '../../logic/organizationSystem';

// Helper function to get living standard level name from icon
const getLivingStandardLevelName = (iconName) => {
    switch (iconName) {
        case 'Skull': return '赤贫';
        case 'AlertTriangle': return '贫困';
        case 'UtensilsCrossed': return '温饱';
        case 'Home': return '小康';
        case 'Gem': return '富裕';
        case 'Crown': return '奢华';
        default: return '未知';
    }
};

/**
 * 社会阶层面板组件
 * 显示各个社会阶层的详细信息
 * @param {Object} popStructure - 人口结构对象
 * @param {Object} classApproval - 阶层好感度对象
 * @param {Object} classInfluence - 阶层影响力对象
 * @param {number} stability - 稳定度
 * @param {Object} classLivingStandard - 阶层生活水平数据（从simulation计算得出）
 * @param {Function} onDetailClick - 点击详情回调
 */
const StrataPanelComponent = ({
    popStructure,
    classApproval,
    classInfluence,
    stability,
    activeBuffs = [],
    activeDebuffs = [],
    classWealth = {},
    classWealthDelta = {},
    classShortages = {},
    classIncome = {},
    classExpense = {},
    classLivingStandard = {}, // 新增：从simulation传来的生活水平数据
    rebellionStates = {}, // 新增：组织度状态
    onDetailClick,
    dayScale = 1,
    hideTitle = false,  // 是否隐藏标题
    forceRowLayout = false, // 强制使用行式布局（用于总览视图）
}) => {
    const safeDayScale = Math.max(dayScale, 0.0001);
    // 移除viewMode状态，因为我们将根据屏幕尺寸自动切换
    const getApprovalColor = (value) => {
        if (value >= 70) return 'text-green-400';
        if (value >= 40) return 'text-yellow-400';
        return 'text-red-400';
    };

    // 计算总影响力用于计算占比
    const totalInfluence = useMemo(() => {
        return Object.values(classInfluence || {}).reduce((sum, val) => sum + (val || 0), 0);
    }, [classInfluence]);

    const strataData = useMemo(() => {
        return Object.entries(STRATA)
            .map(([key, info]) => {
                const count = popStructure[key] || 0;
                const approval = classApproval[key] || 50;
                const influence = classInfluence[key] || 0;
                const influenceShare = totalInfluence > 0 ? (influence / totalInfluence) * 100 : 0;
                const wealthValue = classWealth[key] ?? 0;
                const totalIncome = (classIncome[key] || 0) / safeDayScale;
                const totalExpense = (classExpense[key] || 0) / safeDayScale;
                const incomePerCapita = totalIncome / Math.max(count, 1);
                const expensePerCapita = totalExpense / Math.max(count, 1);
                // Net income should be income minus expense, not wealth delta
                // Wealth delta includes many other factors (market trades, events, etc.)
                const netIncomePerCapita = incomePerCapita - expensePerCapita;
                const shortages = classShortages[key] || [];

                // 使用从simulation传来的生活水平数据，如果没有则使用简化计算
                const livingStandardData = classLivingStandard[key];
                let livingStandardIcon, livingStandardColor, wealthRatio;

                if (livingStandardData) {
                    // 使用预计算的数据
                    livingStandardIcon = livingStandardData.icon;
                    livingStandardColor = livingStandardData.color;
                    wealthRatio = livingStandardData.wealthRatio;
                } else {
                    // 如果没有预计算数据，使用简化版本计算
                    const wealthPerCapita = count > 0 ? wealthValue / count : 0;
                    const startingWealth = info.startingWealth || 10;
                    wealthRatio = startingWealth > 0 ? wealthPerCapita / startingWealth : 0;
                    const simpleLiving = getSimpleLivingStandard(wealthRatio);
                    livingStandardIcon = simpleLiving.icon;
                    livingStandardColor = simpleLiving.color;
                }

                // 组织度相关数据
                const orgState = rebellionStates[key] || {};
                const organization = orgState.organization ?? 0;
                const growthRate = orgState.growthRate ?? 0;
                const orgStage = getOrganizationStage(organization);
                const orgStageName = getStageName(orgStage);
                const orgStageIcon = getStageIcon(orgStage);
                const daysToUprising = predictDaysToUprising(organization, growthRate);

                return {
                    key,
                    info,
                    count,
                    approval,
                    influence,
                    influenceShare,
                    wealthValue,
                    incomePerCapita,
                    expensePerCapita,
                    netIncomePerCapita,
                    shortages,
                    wealthRatio,
                    livingStandardIcon,
                    livingStandardColor,
                    livingStandardData,
                    // 新增：组织度字段
                    organization,
                    growthRate,
                    orgStage,
                    orgStageName,
                    orgStageIcon,
                    daysToUprising,
                };
            })
            .filter((entry) => entry.count > 0);
    }, [
        popStructure,
        classApproval,
        classInfluence,
        classWealth,
        classWealthDelta,
        classIncome,
        classExpense,
        classShortages,
        classLivingStandard,
        rebellionStates, // 新增依赖
        safeDayScale,
        totalInfluence, // 新增依赖
    ]);
    return (
        <div className="glass-epic p-1.5 rounded-xl border border-ancient-gold/20 shadow-epic min-h-[460px] flex flex-col relative overflow-hidden">
            {/* 背景装饰 */}
            <div className="absolute inset-0 bg-gradient-to-br from-ancient-ink/50 via-ancient-stone/20 to-ancient-ink/50 opacity-50" />
            <div className="absolute inset-0 opacity-[0.02]">
                <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
                    <pattern id="strata-pattern" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
                        <circle cx="20" cy="20" r="1" fill="currentColor" className="text-ancient-gold" />
                    </pattern>
                    <rect width="100%" height="100%" fill="url(#strata-pattern)" />
                </svg>
            </div>
            <div className="relative z-10 flex flex-col h-full">
                {/* 标题和稳定度 */}
                {!hideTitle && (
                    <div className="flex flex-wrap items-center justify-between mb-1 gap-1.5 flex-shrink-0">
                        <h3 className="text-xs font-bold text-ancient flex items-center gap-1.5 font-decorative">
                            <Icon name="Users" size={14} className="text-ancient-gold" />
                            社会阶层
                        </h3>

                        {/* 稳定度指示器 */}
                        <div className="flex items-center gap-0.5">
                            <Icon
                                name="TrendingUp"
                                size={12}
                                className={
                                    stability >= 70 ? 'text-green-400' :
                                        stability >= 40 ? 'text-yellow-400' :
                                            'text-red-400'
                                }
                            />
                            <span className={`text-[10px] font-bold ${stability >= 70 ? 'text-green-400' :
                                stability >= 40 ? 'text-yellow-400' :
                                    'text-red-400'
                                }`}>
                                {stability.toFixed(0)}%
                            </span>
                        </div>
                    </div>
                )}


                {/* 阶层列表 - 使用自定义滚动条样式 */}
                <div
                    className="flex-1 overflow-y-auto pr-0.5 scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800 hover:scrollbar-thumb-gray-500"
                    style={{ maxHeight: 'calc(var(--real-viewport-height, 100vh) - 520px)', minHeight: '200px' }}
                >
                    {/* 移动端和小窗口：网格布局 - 使用好感度作为背景填充 */}
                    <div className={`${forceRowLayout ? 'hidden' : 'md:hidden'} grid grid-cols-2 sm:grid-cols-3 gap-1.5 p-0.5`}>
                        {strataData.map((strata) => {
                            // 计算好感度对应的背景颜色 - 使用更稳定的渐变方式，包含基础背景色
                            const getApprovalBgStyle = (approval) => {
                                // 基础背景色：深色不透明，确保低性能模式下也能清晰显示
                                const baseBg = 'rgba(20, 20, 30, 0.95)';
                                // 根据好感度选择颜色 - 使用更鲜明的颜色
                                let color;
                                if (approval >= 70) {
                                    color = 'rgba(34, 197, 94, 0.35)';
                                } else if (approval >= 40) {
                                    color = 'rgba(234, 179, 8, 0.35)';
                                } else {
                                    color = 'rgba(239, 68, 68, 0.35)';
                                }
                                return {
                                    background: `linear-gradient(to right, ${color} 0%, ${color} ${approval}%, ${baseBg} ${approval}%, ${baseBg} 100%)`,
                                    // 使用 box-shadow 实现稳定的边框效果，避免 border 在移动端的渲染问题
                                    boxShadow: `inset 0 0 0 1px rgba(212, 175, 55, 0.5), 0 2px 8px rgba(0, 0, 0, 0.3)`,
                                };
                            };

                            const cardStyle = getApprovalBgStyle(strata.approval);

                            return (
                                <div
                                    key={`grid-${strata.key}`}
                                    className="strata-card relative rounded-lg overflow-hidden hover:scale-[1.02] transition-all cursor-pointer"
                                    style={cardStyle}
                                    onClick={() => onDetailClick && onDetailClick(strata.key)}
                                >
                                    {/* 卡片内容 */}
                                    <div className="relative z-10 p-1">
                                        {/* 头部：图标、阶层名称+人数、好感度 */}
                                        <div className="flex items-center gap-1 mb-0.5">
                                            <Icon name={strata.info.icon} size={12} className="text-ancient-gold flex-shrink-0" />
                                            <span className="text-[10px] font-bold text-ancient-parchment truncate leading-none">{strata.info.name}</span>
                                            <span className="text-[8px] text-ancient-stone font-mono">{strata.count}</span>
                                            <div className="flex-1" />
                                            <span className={`text-[9px] font-bold font-mono ${strata.approval >= 70 ? 'text-green-400' : strata.approval >= 40 ? 'text-yellow-400' : 'text-red-400'}`}>
                                                {strata.approval.toFixed(0)}%
                                            </span>
                                        </div>

                                        {/* 状态图标行 + 组织度 + 影响力 */}
                                        <div className="flex items-center gap-1 mb-0.5 text-[8px]">
                                            <Icon name={strata.livingStandardIcon} size={9} className={strata.livingStandardColor} title={`生活水平`} />
                                            {strata.shortages.length > 0 && (
                                                <Icon name="AlertTriangle" size={9} className="text-red-400 animate-pulse" />
                                            )}
                                            <div className="flex-1" />
                                            {strata.organization > 0 && (
                                                <span className={`font-mono flex items-center gap-0.5 ${strata.organization >= 70 ? 'text-red-400' : strata.organization >= 30 ? 'text-orange-400' : 'text-yellow-400'}`}>
                                                    <Icon name={strata.orgStageIcon} size={9} className={strata.organization >= 70 ? 'animate-pulse' : ''} />
                                                    {strata.organization.toFixed(0)}%
                                                </span>
                                            )}
                                            <span className="text-purple-400 font-mono flex items-center gap-0.5">
                                                <Icon name="Zap" size={8} />
                                                {strata.influenceShare.toFixed(1)}%
                                            </span>
                                        </div>

                                        {/* 财产和净收入 + 短缺资源 */}
                                        <div className="flex items-center justify-between text-[8px]">
                                            <div className="flex items-center gap-1">
                                                <span className="text-ancient-parchment font-mono flex items-center gap-0.5">
                                                    <Icon name="Coins" size={8} className="text-ancient-gold" />
                                                    {strata.wealthValue.toFixed(0)}
                                                </span>
                                                <span className={`font-mono font-bold ${strata.netIncomePerCapita >= 0 ? 'text-green-300' : 'text-red-300'}`}>
                                                    {strata.netIncomePerCapita > 0 ? '+' : ''}{strata.netIncomePerCapita.toFixed(1)}
                                                </span>
                                            </div>
                                            {/* 短缺资源图标 - 最多显示3个 */}
                                            {strata.shortages.length > 0 && (
                                                <div className="flex items-center gap-0.5">
                                                    {strata.shortages.slice(0, 3).map((shortage, idx) => {
                                                        const resKey = typeof shortage === 'string' ? shortage : shortage.resource;
                                                        const res = RESOURCES[resKey];
                                                        return (
                                                            <Icon
                                                                key={`${strata.key}-shortage-${idx}`}
                                                                name={res?.icon || 'HelpCircle'}
                                                                size={9}
                                                                className="text-red-400"
                                                                title={`${res?.name || resKey} 短缺`}
                                                            />
                                                        );
                                                    })}
                                                    {strata.shortages.length > 3 && (
                                                        <span className="text-red-400 text-[7px]">+{strata.shortages.length - 3}</span>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                        {strataData.length === 0 && (
                            <div className="col-span-full text-center text-ancient-stone opacity-70 text-[10px] py-4">
                                暂无可显示的阶层数据。
                            </div>
                        )}
                    </div>

                    {/* 桌面端大窗口：卡片布局 */}
                    <div className={`${forceRowLayout ? 'block' : 'hidden md:block'} space-y-1`}>
                        {strataData.map(
                            ({
                                key,
                                info,
                                count,
                                approval,
                                influence,
                                influenceShare,
                                wealthValue,
                                incomePerCapita,
                                expensePerCapita,
                                netIncomePerCapita,
                                shortages,
                                wealthRatio,
                                livingStandardIcon,
                                livingStandardColor,
                                // 组织度字段
                                organization,
                                growthRate,
                                orgStage,
                                orgStageName,
                                orgStageIcon,
                                daysToUprising,
                            }) => (
                                <div
                                    key={key}
                                    className="glass-ancient p-1.5 rounded-lg hover:bg-ancient-gold/10 transition-all cursor-pointer border border-ancient-gold/20 hover:border-ancient-gold/40 hover:shadow-glow-gold"
                                    onClick={() => onDetailClick && onDetailClick(key)}
                                >
                                    {/* 阶层名称、人口和好感度 - 合并为一行 */}
                                    <div className="flex items-center justify-between mb-0.5">
                                        <div className="flex items-center gap-1">
                                            <Icon name={info.icon} size={10} className="text-ancient-gold" />
                                            <span className="text-[11px] font-semibold text-ancient-parchment">{info.name}</span>
                                            <span className="text-[9px] text-ancient-stone">{count}人</span>
                                            <Icon
                                                name={livingStandardIcon}
                                                size={10}
                                                className={`${livingStandardColor} drop-shadow-[0_0_2px_rgba(255,255,255,0.3)]`}
                                                title={`生活水平: ${getLivingStandardLevelName(livingStandardIcon)} (财富比率 ${wealthRatio.toFixed(2)}x)`}
                                            />
                                            {/* 组织度状态图标 */}
                                            {organization > 0 && (
                                                <Icon
                                                    name={orgStageIcon}
                                                    size={10}
                                                    className={`${organization >= 70 ? 'text-red-500 animate-pulse' : organization >= 30 ? 'text-orange-400' : 'text-yellow-400'}`}
                                                    title={`组织度: ${organization.toFixed(0)}% (${orgStageName})`}
                                                />
                                            )}
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <span className={`text-[9px] font-semibold font-mono ${getApprovalColor(approval)}`}>
                                                {approval.toFixed(0)}%
                                            </span>
                                        </div>
                                    </div>

                                    {/* 收入、支出与净增（人均） - 更紧凑 */}
                                    <div className="grid grid-cols-3 gap-0.5 text-[8px] mb-0.5 bg-ancient-ink/30 px-1 py-0.5 rounded border border-ancient-gold/10">
                                        <div className="flex items-center gap-0.5" title="人均日收入">
                                            <span className="text-ancient-stone">收</span>
                                            <span className="text-green-300 font-mono">
                                                +{incomePerCapita.toFixed(1)}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-0.5 justify-center" title="人均日支出">
                                            <span className="text-ancient-stone">支</span>
                                            <span className="text-red-300 font-mono">
                                                -{expensePerCapita.toFixed(1)}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-0.5 justify-end" title="人均日净增">
                                            <span className="text-ancient-stone">净</span>
                                            <span
                                                className={`font-mono ${netIncomePerCapita >= 0 ? 'text-green-300' : 'text-red-300'
                                                    }`}
                                            >
                                                {netIncomePerCapita > 0 ? '+' : ''}
                                                {netIncomePerCapita.toFixed(1)}
                                            </span>
                                        </div>
                                    </div>

                                    {/* 好感度进度条 */}
                                    <div className="mb-0.5">
                                        <div className="w-full bg-ancient-ink/50 rounded-full h-0.5 border border-ancient-gold/10">
                                            <div
                                                className={`h-0.5 rounded-full transition-all ${approval >= 70 ? 'bg-green-500' : approval >= 40 ? 'bg-yellow-500' : 'bg-red-500'
                                                    }`}
                                                style={{ width: `${approval}%` }}
                                            />
                                        </div>
                                    </div>

                                    {/* 组织度进度条 - 新增 */}
                                    {organization > 5 && (
                                        <div className="mb-0.5">
                                            <div className="flex items-center gap-1 text-[7px] mb-0.5">
                                                <span className="text-ancient-stone">组织度</span>
                                                <span className={`font-mono ${organization >= 70 ? 'text-red-400' : organization >= 30 ? 'text-orange-400' : 'text-yellow-400'}`}>
                                                    {organization.toFixed(0)}%
                                                </span>
                                                {/* {growthRate !== 0 && (
                                                    <span className={`font-mono ${growthRate > 0 ? 'text-red-300' : 'text-green-300'}`}>
                                                        ({growthRate > 0 ? '+' : ''}{growthRate.toFixed(2)}/天)
                                                    </span>
                                                )} */}
                                                {daysToUprising !== null && daysToUprising < 100 && (
                                                    <span className="text-red-400 animate-pulse">
                                                        ~{daysToUprising}天起义
                                                    </span>
                                                )}
                                            </div>
                                            <div className="w-full bg-ancient-ink/50 rounded-full h-1 border border-ancient-gold/10 overflow-hidden">
                                                <div
                                                    className={`h-1 rounded-full transition-all ${organization >= 90 ? 'bg-red-500 animate-pulse' :
                                                        organization >= 70 ? 'bg-orange-500' :
                                                            organization >= 30 ? 'bg-yellow-500' :
                                                                'bg-gray-500'
                                                        }`}
                                                    style={{ width: `${organization}%` }}
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {/* 影响力和财富 - 更紧凑 */}
                                    <div className="flex items-center justify-between text-[8px]">
                                        <div className="flex items-center gap-1">
                                            <span className="text-ancient-stone">影响</span>
                                            <span className="text-purple-400 font-semibold font-mono">{influenceShare.toFixed(1)}%</span>
                                        </div>
                                        <div className="flex items-center gap-0.5" title="阶层总财富">
                                            <Icon name="Coins" size={8} className="text-ancient-gold" />
                                            <span className="text-ancient-parchment font-mono">{wealthValue.toFixed(0)}</span>
                                        </div>
                                    </div>

                                    {/* 短缺资源提示 - 更紧凑 */}
                                    {shortages.length > 0 && (() => {
                                        const hasOutOfStock = shortages.some((s) => {
                                            const reason = typeof s === 'string' ? 'outOfStock' : s.reason;
                                            return reason === 'outOfStock' || reason === 'both';
                                        });
                                        const hasUnaffordable = shortages.some((s) => {
                                            const reason = typeof s === 'string' ? 'outOfStock' : s.reason;
                                            return reason === 'unaffordable' || reason === 'both';
                                        });

                                        let labelText = '短缺';
                                        let labelIcon = 'AlertTriangle';
                                        let labelBg = 'bg-red-900/30';
                                        let labelBorder = 'border-red-500/40';

                                        if (hasOutOfStock && hasUnaffordable) {
                                            labelText = '缺货&买不起';
                                            labelIcon = 'XCircle';
                                            labelBg = 'bg-red-900/40';
                                            labelBorder = 'border-red-600/50';
                                        } else if (hasUnaffordable) {
                                            labelText = '买不起';
                                            labelIcon = 'DollarSign';
                                            labelBg = 'bg-orange-900/30';
                                            labelBorder = 'border-orange-500/40';
                                        } else if (hasOutOfStock) {
                                            labelText = '缺货';
                                            labelIcon = 'Package';
                                            labelBg = 'bg-red-900/30';
                                            labelBorder = 'border-red-500/40';
                                        }

                                        return (
                                            <div
                                                className={`flex items-center gap-0.5 text-[8px] text-red-300 flex-wrap ${labelBg} border ${labelBorder} rounded px-1 py-0.5 mt-0.5`}
                                            >
                                                <Icon name={labelIcon} size={10} className="text-red-400 animate-pulse" />
                                                <span className="text-red-200 font-semibold">{labelText}:</span>
                                                <div className="flex items-center gap-0.5 flex-wrap">
                                                    {shortages.map((shortage, idx) => {
                                                        const resKey = typeof shortage === 'string' ? shortage : shortage.resource;
                                                        const reason = typeof shortage === 'string' ? 'outOfStock' : shortage.reason;
                                                        const res = RESOURCES[resKey];

                                                        let reasonIcon = 'AlertTriangle';
                                                        let reasonText = '供应不足';
                                                        let bgColor = 'bg-red-800/60';
                                                        let borderColor = 'border-red-500/60';

                                                        if (reason === 'unaffordable') {
                                                            reasonIcon = 'DollarSign';
                                                            reasonText = '买不起';
                                                            bgColor = 'bg-orange-800/60';
                                                            borderColor = 'border-orange-500/60';
                                                        } else if (reason === 'outOfStock') {
                                                            reasonIcon = 'Package';
                                                            reasonText = '缺货';
                                                            bgColor = 'bg-red-800/60';
                                                            borderColor = 'border-red-500/60';
                                                        } else if (reason === 'both') {
                                                            reasonIcon = 'XCircle';
                                                            reasonText = '缺货且买不起';
                                                            bgColor = 'bg-red-900/80';
                                                            borderColor = 'border-red-600/80';
                                                        }

                                                        return (
                                                            <span
                                                                key={`${key}-${resKey}-${idx}`}
                                                                className={`px-0.5 py-0.5 ${bgColor} border ${borderColor} rounded flex items-center gap-0.5 animate-pulse`}
                                                                title={`${res?.name || resKey} ${reasonText}`}
                                                            >
                                                                <Icon name={reasonIcon} size={8} className="text-red-200" />
                                                                <Icon name={res?.icon || 'HelpCircle'} size={9} className="text-red-200" />
                                                                <span className="text-red-100 font-medium text-[8px]">{res?.name || resKey}</span>
                                                            </span>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        );
                                    })()}
                                </div>
                            )
                        )}
                    </div>
                </div>

                {/* 当前效果 - 更紧凑 */}
                <div className="mt-1 pt-1 border-t border-ancient-gold/20 flex-shrink-0">
                    <h4 className="text-[14px] font-bold text-ancient-stone mb-0.5 flex items-center gap-0.5 font-decorative">
                        <Icon name="Activity" size={10} className="text-ancient-gold " />
                        当前效果
                    </h4>
                    <div className="space-y-0.5 text-[12px] max-h-16 overflow-y-auto pr-0.5 scrollbar-thin scrollbar-thumb-ancient-gold/40 scrollbar-track-ancient-ink/30">
                        {activeBuffs.map((buff, index) => {
                            const details = formatEffectDetails(buff);
                            return (
                                <div key={`buff-${index}`} className="text-green-400 leading-tight">
                                    <div className="flex items-center gap-0.5">
                                        <Icon name="ArrowUp" size={8} />
                                        <span className="font-semibold">{buff.desc || '满意加成'}</span>
                                    </div>
                                    {details.length > 0 && (
                                        <div className="text-ancient-parchment opacity-80 ml-2 text-[10px]">{details.join('，')}</div>
                                    )}
                                </div>
                            );
                        })}
                        {activeDebuffs.map((debuff, index) => {
                            const details = formatEffectDetails(debuff);
                            return (
                                <div key={`debuff-${index}`} className="text-red-400 leading-tight">
                                    <div className="flex items-center gap-0.5">
                                        <Icon name="ArrowDown" size={8} />
                                        <span className="font-semibold">{debuff.desc || '不满惩罚'}</span>
                                    </div>
                                    {details.length > 0 && (
                                        <div className="text-ancient-parchment opacity-70 ml-2 text-[10px]">{details.join('，')}</div>
                                    )}
                                </div>
                            );
                        })}
                        {activeBuffs.length === 0 && activeDebuffs.length === 0 && (
                            <span className="text-ancient-stone opacity-60 text-[10px] italic">无有效效果</span>
                        )}
                    </div>
                </div>

                {/* 提示文字 - 替代无效的详情按钮 */}
                <div className="mt-1 px-1.5 py-1 bg-ancient-ink/30 rounded-lg border border-ancient-gold/10 flex-shrink-0">
                    <p className="text-[8px] text-ancient-stone text-center flex items-center justify-center gap-1">
                        <Icon name="Info" size={8} className="text-ancient-gold/60" />
                        点击任意阶层卡片查看详细信息
                    </p>
                </div>
            </div>
        </div>
    );
};

// Memoized for performance - prevents re-render when props unchanged
export const StrataPanel = memo(StrataPanelComponent);
