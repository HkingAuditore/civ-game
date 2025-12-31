/**
 * 改良法令面板 - 中间派主导时显示
 * 允许玩家花钱颁布临时法令，获得较大加成，但有较长CD
 */

import React from 'react';
import { Icon } from '../../common/UIComponents';
import { REFORM_DECREES, isDecreeAvailable } from '../../../logic/officials/cabinetSynergy';
import { STRATA } from '../../../config/strata';

/**
 * 格式化效果显示
 */
const formatDecreeEffect = (key, value) => {
    const effectLabels = {
        taxIncome: '税收',
        production: '全局生产',
        industry: '工业产出',
        stability: '稳定度',
        militaryBonus: '军事力量',
        scienceBonus: '科研产出',
        cultureBonus: '文化产出',
        maxPop: '人口上限',
        gatherBonus: '采集产出',
        populationGrowth: '人口增长', // 新增
    };

    // 处理 categories 对象
    if (key === 'categories') {
        const catLabels = { gather: '采集', industry: '工业', civic: '民用', military: '军事' };
        return Object.entries(value).map(([cat, val]) => {
            const catName = catLabels[cat] || cat;
            return `${catName}产出 ${val > 0 ? '+' : ''}${Math.round(val * 100)}%`;
        }).join(', ');
    }

    const label = effectLabels[key] || key;
    if (typeof value === 'number') {
        // 人口上限等绝对值
        if (key === 'maxPop') {
            return `${label} ${value > 0 ? '+' : ''}${value}`;
        }
        // 百分比值
        if (Math.abs(value) < 1) {
            return `${label} ${value > 0 ? '+' : ''}${Math.round(value * 100)}%`;
        }
        return `${label} ${value > 0 ? '+' : ''}${value}`;
    }
    return `${label}: ${value}`;
};

/**
 * 单个法令卡片
 */
const DecreeCard = ({
    decree,
    isActive,
    remainingDays,
    cooldownRemaining,
    canEnact,
    reason,
    onEnact,
    disabled,
}) => {
    const isOnCooldown = cooldownRemaining > 0;

    return (
        <div className={`
            p-3 rounded-lg border transition-all
            ${isActive
                ? 'bg-blue-900/30 border-blue-700/50'
                : isOnCooldown
                    ? 'bg-gray-800/30 border-gray-700/30 opacity-60'
                    : 'bg-gray-800/50 border-gray-700/40 hover:border-gray-600'}
        `}>
            {/* 标题行 */}
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                    <Icon name={decree.icon} size={16} className={isActive ? 'text-blue-400' : 'text-gray-400'} />
                    <span className={`text-sm font-bold ${isActive ? 'text-blue-300' : 'text-gray-200'}`}>
                        {decree.name}
                    </span>
                </div>
                {isActive && (
                    <span className="text-xs text-blue-400 bg-blue-900/40 px-2 py-0.5 rounded">
                        生效中: {remainingDays}天
                    </span>
                )}
                {isOnCooldown && !isActive && (
                    <span className="text-xs text-gray-500">
                        冷却: {cooldownRemaining}天
                    </span>
                )}
            </div>

            {/* 描述 */}
            <p className="text-xs text-gray-500 mb-2">{decree.description}</p>

            {/* 效果列表 */}
            <div className="flex flex-wrap gap-1 mb-2">
                {Object.entries(decree.effects).map(([key, val]) => {
                    const isNegative = typeof val === 'number' && val < 0;
                    // dailyCost removed from data but kept logic just in case
                    const isBad = (isNegative && key !== 'consumptionReduction' && key !== 'buildingCostMod') || key === 'dailyCost' || key === 'decreeSilverExpense';

                    return (
                        <span
                            key={key}
                            className={`text-[10px] px-1.5 py-0.5 rounded ${isBad
                                ? 'bg-red-900/30 text-red-400'
                                : 'bg-green-900/30 text-green-400'
                                }`}
                        >
                            {formatDecreeEffect(key, val)}
                        </span>
                    );
                })}
            </div>

            {/* 持续时间和成本 */}
            <div className="flex items-center justify-between text-xs text-gray-500">
                <span>持续 {decree.duration} 天 / 冷却 {decree.cooldown} 天</span>
                <span className="flex items-center gap-1">
                    <Icon name="Coins" size={12} className="text-yellow-500" />
                    {decree.cost}
                </span>
            </div>

            {/* 颁布按钮 */}
            {!isActive && (
                <button
                    onClick={() => onEnact(decree.id)}
                    disabled={disabled || !canEnact}
                    className={`
                        w-full mt-2 py-1.5 rounded text-xs font-bold flex items-center justify-center gap-1
                        ${!disabled && canEnact
                            ? 'bg-blue-600 hover:bg-blue-500 text-white'
                            : 'bg-gray-700 text-gray-500 cursor-not-allowed'}
                    `}
                    title={reason || ''}
                >
                    <Icon name="Scroll" size={12} />
                    {canEnact ? '颁布法令' : reason}
                </button>
            )}
        </div>
    );
};

/**
 * 改良法令面板
 */
export const ReformDecreePanel = ({
    activeDecrees = {},
    decreeCooldowns = {},
    currentDay = 0,
    silver = 0,
    onEnactDecree,
    disabled = false,
}) => {
    const decrees = Object.values(REFORM_DECREES);

    // 计算每个法令的状态
    const getDecreeStatus = (decreeId) => {
        const decree = REFORM_DECREES[decreeId];
        const activeData = activeDecrees[decreeId];
        const isActive = !!activeData;
        // [DEBUG] 追踪法令剩余天数计算
        console.log(`[DECREE DEBUG] ${decreeId}:`, {
            activeData,
            currentDay,
            endDay: activeData?.endDay,
            remainingDays: activeData ? (activeData.endDay - currentDay) : 'N/A',
        });
        const remainingDays = isActive ? Math.max(0, activeData.endDay - currentDay) : 0;

        const cooldownEnd = decreeCooldowns[decreeId] || 0;
        const cooldownRemaining = Math.max(0, cooldownEnd - currentDay);

        const { available, reason } = isDecreeAvailable(
            decreeId, activeDecrees, decreeCooldowns, currentDay, silver
        );

        return {
            isActive,
            remainingDays,
            cooldownRemaining,
            canEnact: available,
            reason,
        };
    };

    // 当前生效的法令数量
    const activeCount = Object.keys(activeDecrees).length;

    return (
        <div className="bg-gray-800/50 rounded-lg p-4 border border-blue-900/30">
            {/* 标题 */}
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <Icon name="Scroll" size={18} className="text-blue-400" />
                    <span className="text-sm font-bold text-blue-300">改良法令 - 临时政策</span>
                </div>
                {activeCount > 0 && (
                    <span className="text-xs text-blue-400">
                        {activeCount} 项法令生效中
                    </span>
                )}
            </div>

            {/* 说明 */}
            <p className="text-xs text-gray-500 mb-3">
                颁布临时法令以获得显著加成。法令结束后需要较长时间冷却才能再次使用。
            </p>

            {/* 法令列表 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {decrees.map(decree => {
                    const status = getDecreeStatus(decree.id);
                    return (
                        <DecreeCard
                            key={decree.id}
                            decree={decree}
                            isActive={status.isActive}
                            remainingDays={status.remainingDays}
                            cooldownRemaining={status.cooldownRemaining}
                            canEnact={status.canEnact}
                            reason={status.reason}
                            onEnact={onEnactDecree}
                            disabled={disabled}
                        />
                    );
                })}
            </div>
        </div>
    );
};

export default ReformDecreePanel;
