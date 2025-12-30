/**
 * 计划经济面板 - 左派主导时显示
 * 允许玩家设置各阶层的目标人口比例
 */

import React, { useState, useMemo } from 'react';
import { Icon } from '../../common/UIComponents';
import { STRATA } from '../../../config/strata';

// 可调整的阶层（排除骑士和官员）
const ADJUSTABLE_STRATA = [
    'peasant', 'worker', 'artisan', 'merchant', 'landowner',
    'cleric', 'scribe', 'miner', 'engineer', 'capitalist', 'serf'
];

/**
 * 单个阶层配额滑块
 */
const QuotaSlider = ({ stratum, currentPercent, targetPercent, onChange, disabled }) => {
    const strataDef = STRATA[stratum];
    if (!strataDef) return null;

    const diff = targetPercent - currentPercent;
    const diffText = diff > 0 ? `+${diff.toFixed(1)}%` : diff < 0 ? `${diff.toFixed(1)}%` : '—';
    const diffColor = diff > 0 ? 'text-green-400' : diff < 0 ? 'text-red-400' : 'text-gray-500';

    return (
        <div className="flex items-center gap-2 py-1">
            <div className="w-20 flex items-center gap-1">
                <Icon name={strataDef.icon || 'User'} size={14} className="text-gray-400" />
                <span className="text-xs text-gray-300 truncate">{strataDef.name}</span>
            </div>

            <div className="flex-1 flex items-center gap-2">
                {/* 当前比例 */}
                <span className="text-xs text-gray-500 w-12 text-right">{currentPercent.toFixed(1)}%</span>

                {/* 滑块 */}
                <input
                    type="range"
                    min="0"
                    max="50"
                    step="1"
                    value={targetPercent}
                    onChange={(e) => onChange(stratum, parseFloat(e.target.value))}
                    disabled={disabled}
                    className="flex-1 h-1 accent-red-500 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                />

                {/* 目标比例 */}
                <span className="text-xs text-gray-200 w-12">{targetPercent.toFixed(0)}%</span>

                {/* 差值 */}
                <span className={`text-xs w-12 text-right ${diffColor}`}>{diffText}</span>
            </div>
        </div>
    );
};

/**
 * 计划经济面板
 */
export const PlannedEconomyPanel = ({
    popStructure = {},
    quotaTargets = {},
    onUpdateQuotas,
    adminCost = 0,
    approvalPenalties = {},
    disabled = false,
}) => {
    const [localTargets, setLocalTargets] = useState(quotaTargets);
    const [hasChanges, setHasChanges] = useState(false);

    // 计算当前人口分布
    const totalPop = useMemo(() =>
        Object.values(popStructure).reduce((a, b) => a + b, 0),
        [popStructure]
    );

    const currentDistribution = useMemo(() => {
        const dist = {};
        ADJUSTABLE_STRATA.forEach(s => {
            dist[s] = totalPop > 0 ? ((popStructure[s] || 0) / totalPop) * 100 : 0;
        });
        return dist;
    }, [popStructure, totalPop]);

    // 处理滑块变化
    const handleChange = (stratum, value) => {
        const newTargets = { ...localTargets, [stratum]: value };
        setLocalTargets(newTargets);
        setHasChanges(true);
    };

    // 应用配额
    const handleApply = () => {
        onUpdateQuotas(localTargets);
        setHasChanges(false);
    };

    // 重置
    const handleReset = () => {
        setLocalTargets({});
        setHasChanges(true);
    };

    // 计算总目标比例
    const totalTarget = Object.values(localTargets).reduce((a, b) => a + b, 0);
    const isValid = totalTarget <= 100;

    return (
        <div className="bg-gray-800/50 rounded-lg p-4 border border-red-900/30">
            {/* 标题 */}
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <Icon name="BarChart3" size={18} className="text-red-400" />
                    <span className="text-sm font-bold text-red-300">计划经济 - 阶层配额</span>
                </div>
                {adminCost > 0 && (
                    <span className="text-xs text-amber-400">
                        每日行政成本: {adminCost}银
                    </span>
                )}
            </div>

            {/* 说明 */}
            <p className="text-xs text-gray-500 mb-3">
                设置目标人口比例，社会流动将加速向目标调整。被压缩的阶层满意度会下降。
            </p>

            {/* 配额列表 */}
            <div className="space-y-1 mb-3 max-h-60 overflow-y-auto">
                {ADJUSTABLE_STRATA.filter(s => currentDistribution[s] > 0 || localTargets[s]).map(stratum => (
                    <QuotaSlider
                        key={stratum}
                        stratum={stratum}
                        currentPercent={currentDistribution[stratum]}
                        targetPercent={localTargets[stratum] ?? currentDistribution[stratum]}
                        onChange={handleChange}
                        disabled={disabled}
                    />
                ))}
            </div>

            {/* 总计和警告 */}
            <div className="flex items-center justify-between border-t border-gray-700/50 pt-2">
                <div className="text-xs">
                    <span className="text-gray-500">目标总计: </span>
                    <span className={totalTarget > 100 ? 'text-red-400' : 'text-gray-300'}>
                        {totalTarget.toFixed(0)}%
                    </span>
                    {!isValid && <span className="text-red-400 ml-2">超出100%！</span>}
                </div>

                {/* 满意度惩罚预览 */}
                {Object.keys(approvalPenalties).length > 0 && (
                    <div className="text-xs text-red-400">
                        {Object.entries(approvalPenalties).map(([s, val]) => (
                            <span key={s} className="mr-2">
                                {STRATA[s]?.name}: {val}
                            </span>
                        ))}
                    </div>
                )}
            </div>

            {/* 按钮 */}
            <div className="flex gap-2 mt-3">
                <button
                    onClick={handleApply}
                    disabled={disabled || !hasChanges || !isValid}
                    className={`
                        flex-1 py-1.5 rounded text-xs font-bold flex items-center justify-center gap-1
                        ${!disabled && hasChanges && isValid
                            ? 'bg-red-600 hover:bg-red-500 text-white'
                            : 'bg-gray-700 text-gray-500 cursor-not-allowed'}
                    `}
                >
                    <Icon name="Check" size={12} />
                    应用配额
                </button>
                <button
                    onClick={handleReset}
                    disabled={disabled}
                    className="px-3 py-1.5 rounded text-xs bg-gray-700 hover:bg-gray-600 text-gray-300"
                >
                    重置
                </button>
            </div>
        </div>
    );
};

export default PlannedEconomyPanel;
