/**
 * 内阁协同度显示组件
 * 显示协同度进度条、派系分布和主导状态
 */

import React from 'react';
import { Icon } from '../../common/UIComponents';
import { SYNERGY_EFFECTS, DOMINANCE_EFFECTS } from '../../../logic/officials/cabinetSynergy';

/**
 * 协同度进度条
 */
const SynergyBar = ({ synergy, level }) => {
    const effectConfig = SYNERGY_EFFECTS[level] || SYNERGY_EFFECTS.diverse;

    // 颜色映射
    const getBarColor = () => {
        if (synergy <= 30) return 'bg-red-500';
        if (synergy <= 50) return 'bg-gray-500';
        if (synergy <= 70) return 'bg-blue-500';
        if (synergy <= 85) return 'bg-green-500';
        return 'bg-purple-500';
    };

    return (
        <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400 w-16">协同度</span>
            <div className="flex-1 h-2 bg-gray-700 rounded-full overflow-hidden">
                <div
                    className={`h-full ${getBarColor()} transition-all duration-300`}
                    style={{ width: `${synergy}%` }}
                />
            </div>
            <span className={`text-xs font-bold ${effectConfig.color}`}>
                {synergy}% ({effectConfig.label})
            </span>
        </div>
    );
};

/**
 * 派系分布饼图
 */
const FactionDistribution = ({ distribution, total }) => {
    if (total === 0) return null;

    const factions = [
        { id: 'left', name: '左派', color: 'bg-red-500', textColor: 'text-red-400' },
        { id: 'center', name: '中间', color: 'bg-blue-500', textColor: 'text-blue-400' },
        { id: 'right', name: '右派', color: 'bg-amber-500', textColor: 'text-amber-400' },
    ];

    return (
        <div className="flex items-center gap-3">
            {factions.map(faction => {
                const count = distribution[faction.id] || 0;
                const percent = Math.round((count / total) * 100);
                return (
                    <div key={faction.id} className="flex items-center gap-1">
                        <div className={`w-2 h-2 rounded-full ${faction.color}`} />
                        <span className={`text-xs ${faction.textColor}`}>
                            {faction.name}: {count} ({percent}%)
                        </span>
                    </div>
                );
            })}
        </div>
    );
};

/**
 * 主导派系标识
 */
const DominanceIndicator = ({ dominance }) => {
    if (!dominance) return null;

    const config = DOMINANCE_EFFECTS[dominance.faction];
    if (!config) return null;

    return (
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-800/60 border border-gray-700/50`}>
            <Icon name={config.icon} size={16} className={config.color} />
            <span className={`text-sm font-bold ${config.color}`}>{config.name}</span>
            <span className="text-xs text-gray-400">({dominance.percentage}%)</span>
            <span className="text-xs text-gray-500">- {config.description}</span>
        </div>
    );
};

/**
 * 协同度效果显示
 */
const SynergyEffects = ({ effects }) => {
    if (!effects) return null;

    const items = [];

    if (effects.adminEfficiency !== 0) {
        const isPositive = effects.adminEfficiency > 0;
        items.push({
            label: '行政效率',
            value: `${isPositive ? '+' : ''}${Math.round(effects.adminEfficiency * 100)}%`,
            positive: isPositive,
        });
    }

    if (effects.stabilityMod !== 0) {
        const isPositive = effects.stabilityMod > 0;
        items.push({
            label: '稳定度',
            value: `${isPositive ? '+' : ''}${Math.round(effects.stabilityMod * 100)}%`,
            positive: isPositive,
        });
    }

    if (effects.organizationGrowthMod !== 0) {
        items.push({
            label: '组织度增长',
            value: `+${Math.round(effects.organizationGrowthMod * 100)}%`,
            positive: false, // 组织度增长通常是负面的
        });
    }

    if (effects.tradeBonusMod) {
        items.push({
            label: '贸易收入',
            value: `+${Math.round(effects.tradeBonusMod * 100)}%`,
            positive: true,
        });
    }

    if (effects.socialMobilityMod) {
        items.push({
            label: '社会流动',
            value: `+${Math.round(effects.socialMobilityMod * 100)}%`,
            positive: true,
        });
    }

    if (items.length === 0) return null;

    return (
        <div className="flex flex-wrap gap-2 mt-1">
            {items.map((item, idx) => (
                <span
                    key={idx}
                    className={`text-xs px-2 py-0.5 rounded ${item.positive
                        ? 'bg-green-900/30 text-green-400'
                        : 'bg-red-900/30 text-red-400'
                        }`}
                >
                    {item.label} {item.value}
                </span>
            ))}
        </div>
    );
};

/**
 * 内阁协同度面板
 */
export const CabinetSynergyDisplay = ({
    officials = [],
    cabinetStatus,
}) => {
    if (!cabinetStatus) return null;

    const { synergy, level, distribution, dominance, effects } = cabinetStatus;
    const total = officials.length;

    return (
        <div className="bg-gray-800/40 rounded-lg p-3 border border-gray-700/40 space-y-2">
            {/* 标题 */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Icon name="Scale" size={16} className="text-purple-400" />
                    <span className="text-sm font-bold text-gray-200">内阁协同</span>
                </div>
                {effects.ideologicalDrift && (
                    <span className="text-xs text-amber-400 flex items-center gap-1">
                        <Icon name="AlertTriangle" size={12} />
                        意识形态漂移中
                    </span>
                )}
            </div>

            {/* 协同度条 */}
            <SynergyBar synergy={synergy} level={level} />

            {/* 派系分布 */}
            <FactionDistribution distribution={distribution} total={total} />

            {/* 主导派系 */}
            {dominance && <DominanceIndicator dominance={dominance} />}

            {/* 效果显示 */}
            <SynergyEffects effects={effects} />
        </div>
    );
};

export default CabinetSynergyDisplay;
