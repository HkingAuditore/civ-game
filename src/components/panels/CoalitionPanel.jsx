/**
 * 执政联盟面板组件
 * 允许玩家选择与哪些阶层联合执政
 * 更换联盟需要花费银币（20%或最低5000）
 */

import React, { useState, useMemo, useCallback } from 'react';
import { Icon } from '../common/UIComponents';
import { STRATA } from '../../config';
import {
    getLegitimacyLevel,
    getLegitimacyLevelInfo,
    getEligibleCoalitionStrata,
    LEGITIMACY_THRESHOLD,
    calculateLegitimacy,
    getLegitimacyTaxModifier,
    getLegitimacyOrganizationModifier,
    getLegitimacyApprovalModifier,
    COALITION_SENSITIVITY,
    getGovernmentType,
} from '../../logic/rulingCoalition';
import { getPolityEffects, formatPolityEffects } from '../../config/polityEffects';
import { formatNumberShortCN } from '../../utils/numberFormat';

// 阶层分组，用于UI显示
const STRATA_GROUPS = {
    upper: {
        name: '上流阶级',
        keys: ['merchant', 'official', 'landowner', 'capitalist', 'engineer'],
    },
    middle: {
        name: '中产阶级',
        keys: ['artisan', 'soldier', 'cleric', 'scribe', 'navigator'],
    },
    lower: {
        name: '下层阶级',
        keys: ['peasant', 'serf', 'lumberjack', 'worker', 'miner'],
    },
};

// 计算更换联盟的费用
const COALITION_CHANGE_MIN_COST = 5000;
const COALITION_CHANGE_PERCENT = 0.20;

const calculateCoalitionChangeCost = (currentSilver) => {
    const percentCost = Math.floor(currentSilver * COALITION_CHANGE_PERCENT);
    return Math.max(COALITION_CHANGE_MIN_COST, percentCost);
};

/**
 * 执政联盟面板
 */
export const CoalitionPanel = ({
    rulingCoalition = [],
    onUpdateCoalition,
    classInfluence = {},
    totalInfluence = 0,
    legitimacy = 0,
    popStructure = {},
    classApproval = {},
    silver = 0,
    onSpendSilver,
}) => {
    // 编辑模式状态
    const [isEditMode, setIsEditMode] = useState(false);
    const [previewCoalition, setPreviewCoalition] = useState([]);

    const eligibleStrata = getEligibleCoalitionStrata(popStructure);
    const changeCost = useMemo(() => calculateCoalitionChangeCost(silver), [silver]);
    const canAffordChange = silver >= changeCost;
    const displayCoalition = isEditMode ? previewCoalition : rulingCoalition;

    const hasChanges = useMemo(() => {
        if (!isEditMode) return false;
        if (previewCoalition.length !== rulingCoalition.length) return true;
        const sortedPreview = [...previewCoalition].sort();
        const sortedOriginal = [...rulingCoalition].sort();
        return sortedPreview.some((k, i) => k !== sortedOriginal[i]);
    }, [isEditMode, previewCoalition, rulingCoalition]);

    const coalitionInfluenceShare = useMemo(() => {
        if (totalInfluence <= 0) return 0;
        let share = 0;
        displayCoalition.forEach(key => {
            share += classInfluence[key] || 0;
        });
        return share / totalInfluence;
    }, [displayCoalition, classInfluence, totalInfluence]);

    const governmentType = useMemo(() => {
        return getGovernmentType(displayCoalition, classInfluence, totalInfluence);
    }, [displayCoalition, classInfluence, totalInfluence]);

    const polityEffects = useMemo(() => {
        const effects = getPolityEffects(governmentType.name);
        return effects ? formatPolityEffects(effects) : [];
    }, [governmentType.name]);

    const realTimeLegitimacy = useMemo(() => {
        return calculateLegitimacy(coalitionInfluenceShare, {
            classApproval,
            coalitionMembers: displayCoalition,
            classInfluence,
        });
    }, [coalitionInfluenceShare, classApproval, displayCoalition, classInfluence]);

    const taxModifier = useMemo(() => getLegitimacyTaxModifier(realTimeLegitimacy), [realTimeLegitimacy]);
    const orgModifier = useMemo(() => getLegitimacyOrganizationModifier(realTimeLegitimacy, false), [realTimeLegitimacy]);
    const legitimacyLevel = getLegitimacyLevel(realTimeLegitimacy);
    const legitimacyInfo = getLegitimacyLevelInfo(legitimacyLevel);
    const approvalModifier = useMemo(() => getLegitimacyApprovalModifier(realTimeLegitimacy), [realTimeLegitimacy]);

    const { avgCoalitionApproval, approvalLegitimacyFactor } = useMemo(() => {
        if (displayCoalition.length === 0) {
            return { avgCoalitionApproval: 50, approvalLegitimacyFactor: 1.0 };
        }
        let totalWeight = 0;
        let weightedApproval = 0;
        displayCoalition.forEach(key => {
            const approval = classApproval[key] ?? 50;
            const influence = classInfluence[key] || 1;
            weightedApproval += approval * influence;
            totalWeight += influence;
        });
        const avg = totalWeight > 0 ? weightedApproval / totalWeight : 50;
        const factor = avg < 50 ? (0.5 + avg / 100) : 1.0;
        return { avgCoalitionApproval: avg, approvalLegitimacyFactor: factor };
    }, [displayCoalition, classApproval, classInfluence]);

    const enterEditMode = useCallback(() => {
        if (!canAffordChange) return;
        setPreviewCoalition([...rulingCoalition]);
        setIsEditMode(true);
    }, [canAffordChange, rulingCoalition]);

    const cancelEdit = useCallback(() => {
        setIsEditMode(false);
        setPreviewCoalition([]);
    }, []);

    const confirmChanges = useCallback(() => {
        if (!hasChanges || !onUpdateCoalition || !onSpendSilver) return;
        onSpendSilver(changeCost);
        onUpdateCoalition(previewCoalition);
        setIsEditMode(false);
        setPreviewCoalition([]);
    }, [hasChanges, onUpdateCoalition, onSpendSilver, changeCost, previewCoalition]);

    const toggleCoalitionMember = useCallback((stratumKey) => {
        if (!isEditMode) return;
        if (previewCoalition.includes(stratumKey)) {
            setPreviewCoalition(previewCoalition.filter(k => k !== stratumKey));
        } else {
            setPreviewCoalition([...previewCoalition, stratumKey]);
        }
    }, [isEditMode, previewCoalition]);

    const renderStratumCard = (stratumKey) => {
        const stratum = STRATA[stratumKey];
        if (!stratum) return null;

        const isSelected = displayCoalition.includes(stratumKey);
        const influence = classInfluence[stratumKey] || 0;
        const influenceShare = totalInfluence > 0 ? (influence / totalInfluence * 100).toFixed(1) : '0.0';
        const population = popStructure[stratumKey] || 0;
        const isDisabled = !isEditMode;

        return (
            <button
                key={stratumKey}
                onClick={() => toggleCoalitionMember(stratumKey)}
                disabled={isDisabled}
                className={`
                    relative p-2 rounded-lg border transition-all
                    ${isDisabled ? 'cursor-default opacity-80' : 'cursor-pointer hover:scale-[1.02]'}
                    ${isSelected
                        ? 'bg-amber-900/30 border-amber-500/50 ring-1 ring-amber-400/30'
                        : isDisabled
                            ? 'bg-gray-900/20 border-gray-700/30'
                            : 'bg-gray-900/30 border-gray-700/50 hover:border-gray-600'
                    }
                `}
            >
                {isSelected && (
                    <div className="absolute top-1 right-1">
                        <Icon name="Check" size={12} className="text-amber-400" />
                    </div>
                )}
                <div className="flex items-center gap-2 mb-1">
                    <Icon name={stratum.icon || 'User'} size={16} className={isSelected ? 'text-amber-400' : 'text-gray-400'} />
                    <span className={`text-xs font-semibold ${isSelected ? 'text-amber-300' : 'text-gray-300'}`}>
                        {stratum.name}
                    </span>
                </div>
                <div className="flex justify-between text-[10px] text-gray-500">
                    <span>影响力 {influenceShare}%</span>
                    <span>{formatNumberShortCN(population, { decimals: 1 })}人</span>
                </div>
            </button>
        );
    };

    const renderStrataGroup = (groupKey, group) => {
        const groupStrata = group.keys.filter(k => eligibleStrata.includes(k));
        if (groupStrata.length === 0) return null;

        return (
            <div key={groupKey} className="mb-3">
                <h5 className="text-[10px] font-semibold text-gray-500 mb-1.5 uppercase tracking-wider">
                    {group.name}
                </h5>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1.5">
                    {groupStrata.map(key => renderStratumCard(key))}
                </div>
            </div>
        );
    };

    return (
        <div className="glass-ancient p-4 rounded-xl border border-ancient-gold/30 mb-4">
            {/* 标题栏 */}
            <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold flex items-center gap-2 text-gray-300 font-decorative">
                    <Icon name="Users" size={16} className="text-amber-400" />
                    执政联盟
                    {isEditMode && (
                        <span className="text-xs text-amber-400 font-normal ml-2 px-2 py-0.5 bg-amber-900/30 rounded">
                            编辑中
                        </span>
                    )}
                </h3>
                <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg ${legitimacyInfo.bgColor} border ${legitimacyInfo.borderColor}`}>
                    <Icon name={legitimacyInfo.icon} size={14} className={legitimacyInfo.color} />
                    <span className={`text-xs font-semibold ${legitimacyInfo.color}`}>
                        {legitimacyInfo.name}
                    </span>
                </div>
            </div>

            {/* 编辑模式提示/按钮区 */}
            {!isEditMode ? (
                <div className="mb-3 p-2 bg-gray-800/50 rounded-lg border border-gray-700/50">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                        <div className="text-xs text-gray-400">
                            <Icon name="Info" size={12} className="inline mr-1" />
                            改组政府需要花费银币
                        </div>
                        <button
                            onClick={enterEditMode}
                            disabled={!canAffordChange}
                            className={`
                                px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 whitespace-nowrap flex-shrink-0
                                ${canAffordChange
                                    ? 'bg-amber-600 hover:bg-amber-500 text-white'
                                    : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                                }
                            `}
                        >
                            <Icon name="Edit" size={12} />
                            改组政府
                            <span className={`ml-1 ${canAffordChange ? 'text-amber-200' : 'text-gray-400'}`}>
                                ({formatNumberShortCN(changeCost, { decimals: 1 })} 银币)
                            </span>
                        </button>
                    </div>
                    {!canAffordChange && (
                        <div className="mt-1 text-[10px] text-red-400">
                            银币不足！需要至少 {formatNumberShortCN(changeCost, { decimals: 1 })} 银币
                        </div>
                    )}
                </div>
            ) : (
                <div className="mb-3 p-2 bg-amber-900/20 rounded-lg border border-amber-700/50">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                        <div className="text-xs text-amber-300">
                            <Icon name="AlertCircle" size={12} className="inline mr-1" />
                            选择联盟成员，确认后花费 <span className="font-bold">{formatNumberShortCN(changeCost, { decimals: 1 })}</span> 银币
                        </div>
                        <div className="flex gap-2 flex-shrink-0">
                            <button
                                onClick={cancelEdit}
                                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-gray-700 hover:bg-gray-600 text-gray-300 transition-all whitespace-nowrap"
                            >
                                取消
                            </button>
                            <button
                                onClick={confirmChanges}
                                disabled={!hasChanges}
                                className={`
                                    px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 whitespace-nowrap
                                    ${hasChanges
                                        ? 'bg-green-600 hover:bg-green-500 text-white'
                                        : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                                    }
                                `}
                            >
                                <Icon name="Check" size={12} />
                                确认更改
                            </button>
                        </div>
                    </div>
                    {!hasChanges && (
                        <div className="mt-1 text-[10px] text-gray-400">
                            点击下方阶层卡片来添加或移除联盟成员
                        </div>
                    )}
                </div>
            )}

            {/* 政体描述词徽章 */}
            <div className="mb-3 p-2 bg-gray-800/50 rounded-lg border border-gray-700/50">
                <div className="flex items-center gap-2">
                    <Icon name={governmentType.icon} size={18} className={governmentType.color} />
                    <div className="flex-1">
                        <div className={`text-sm font-bold ${governmentType.color}`}>
                            {governmentType.name}
                            {isEditMode && hasChanges && (
                                <span className="ml-2 text-xs text-amber-400 font-normal">(预览)</span>
                            )}
                        </div>
                        <div className="text-[10px] text-gray-500">
                            {governmentType.description}
                        </div>
                    </div>
                    {displayCoalition.length > 0 && (
                        <div className="text-[10px] text-gray-500 bg-gray-900/50 px-1.5 py-0.5 rounded">
                            {displayCoalition.length}个阶层
                        </div>
                    )}
                </div>
                {polityEffects.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-gray-700/50">
                        <div className="text-[9px] text-gray-500 mb-1">政体效果</div>
                        <div className="flex flex-wrap gap-1">
                            {polityEffects.map((effect, idx) => (
                                <div
                                    key={idx}
                                    className={`text-[10px] px-1.5 py-0.5 rounded ${effect.positive
                                        ? 'bg-green-900/30 text-green-400 border border-green-700/30'
                                        : 'bg-red-900/30 text-red-400 border border-red-700/30'
                                        }`}
                                >
                                    {effect.text}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* 合法性说明 */}
            <div className="mb-3 p-2 bg-gray-900/30 rounded-lg">
                <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-gray-400">联盟影响力</span>
                    <span className={`text-sm font-bold ${coalitionInfluenceShare >= LEGITIMACY_THRESHOLD ? 'text-green-400' : 'text-red-400'}`}>
                        {(coalitionInfluenceShare * 100).toFixed(1)}%
                        {isEditMode && hasChanges && <span className="ml-1 text-amber-400 text-xs font-normal">(预览)</span>}
                    </span>
                </div>
                <div className="relative h-2 bg-gray-800 rounded-full overflow-hidden">
                    <div
                        className={`h-full transition-all duration-300 ${coalitionInfluenceShare >= LEGITIMACY_THRESHOLD ? 'bg-gradient-to-r from-green-600 to-green-400' : 'bg-gradient-to-r from-red-600 to-red-400'}`}
                        style={{ width: `${Math.min(100, coalitionInfluenceShare * 100)}%` }}
                    />
                    <div
                        className="absolute top-0 bottom-0 w-0.5 bg-yellow-400"
                        style={{ left: `${LEGITIMACY_THRESHOLD * 100}%` }}
                    />
                </div>
                <p className="text-[10px] text-gray-500 mt-1">
                    {legitimacyInfo.description}
                </p>
                <div className="mt-2 pt-2 border-t border-gray-700/50">
                    <div className="flex items-center justify-between mb-2 pb-2 border-b border-gray-600/30">
                        <span className="text-sm font-bold text-gray-300">政府合法性</span>
                        <span className={`text-lg font-bold ${legitimacyInfo.color}`}>
                            {realTimeLegitimacy.toFixed(0)}
                            {isEditMode && hasChanges && <span className="ml-1 text-amber-400 text-xs font-normal">(预览)</span>}
                        </span>
                    </div>
                    {displayCoalition.length > 0 && (
                        <div className="mb-2">
                            <div className="text-[9px] text-gray-500 mb-1">数据</div>
                            <div className="flex items-center py-0.5">
                                <span className="text-[10px] text-gray-400 flex items-center gap-1 flex-shrink-0">
                                    <Icon name="Heart" size={10} className="text-pink-400" />联盟满意度
                                </span>
                                <span className="flex-1 mx-2 border-b border-dotted border-gray-600/50"></span>
                                <span className={`text-xs font-bold ${avgCoalitionApproval >= 50 ? 'text-green-400' : 'text-red-400'}`}>
                                    {avgCoalitionApproval.toFixed(0)}
                                </span>
                            </div>
                            {approvalLegitimacyFactor < 1 && (
                                <div className="flex items-center py-0.5">
                                    <span className="text-[10px] text-gray-400 flex items-center gap-1 flex-shrink-0">
                                        <Icon name="TrendingDown" size={10} className="text-red-400" />满意度对合法性的影响
                                    </span>
                                    <span className="flex-1 mx-2 border-b border-dotted border-gray-600/50"></span>
                                    <span className="text-xs font-bold text-red-400">
                                        ×{approvalLegitimacyFactor.toFixed(2)}
                                    </span>
                                </div>
                            )}
                        </div>
                    )}
                    <div>
                        <div className="text-[9px] text-gray-500 mb-1">效果</div>
                        <div className="flex items-center py-0.5">
                            <span className="text-[10px] text-gray-400 flex items-center gap-1 flex-shrink-0">
                                <Icon name="Coins" size={10} className="text-yellow-400" />税收效率
                            </span>
                            <span className="flex-1 mx-2 border-b border-dotted border-gray-600/50"></span>
                            <span className={`text-xs font-bold ${taxModifier >= 1 ? 'text-green-400' : 'text-red-400'}`}>
                                {(taxModifier * 100).toFixed(0)}%
                            </span>
                        </div>
                        <div className="flex items-center py-0.5">
                            <span className="text-[10px] text-gray-400 flex items-center gap-1 flex-shrink-0">
                                <Icon name="Users" size={10} className="text-orange-400" />在野阶层组织度增长倍率
                            </span>
                            <span className="flex-1 mx-2 border-b border-dotted border-gray-600/50"></span>
                            <span className={`text-xs font-bold ${orgModifier <= 1 ? 'text-green-400' : 'text-red-400'}`}>
                                {(orgModifier * 100).toFixed(0)}%
                            </span>
                        </div>
                        {approvalModifier !== 0 && (
                            <div className="flex items-center py-0.5">
                                <span className="text-[10px] text-gray-400 flex items-center gap-1 flex-shrink-0">
                                    <Icon name="Frown" size={10} className="text-red-400" />全民满意度
                                </span>
                                <span className="flex-1 mx-2 border-b border-dotted border-gray-600/50"></span>
                                <span className="text-xs font-bold text-red-400">
                                    {approvalModifier}
                                </span>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* 阶层选择网格 */}
            <div className="space-y-2">
                {Object.entries(STRATA_GROUPS).map(([key, group]) => renderStrataGroup(key, group))}
            </div>

            {/* 警告提示 */}
            {displayCoalition.length > 0 && (
                <div className="mt-3 p-2 bg-amber-900/20 rounded-lg border border-amber-700/30">
                    <div className="flex items-start gap-2">
                        <Icon name="AlertTriangle" size={14} className="text-amber-400 mt-0.5 flex-shrink-0" />
                        <div className="text-[10px] text-amber-300/80">
                            <p className="font-semibold mb-1">联盟代价：</p>
                            <ul className="list-disc list-inside space-y-0.5 text-amber-300/70">
                                <li>提高叛乱组织度增速：<span className="text-red-400">+50%</span></li>
                                <li>降低叛乱门槛：<span className="text-red-400">无视低影响力限制</span></li>
                                <li>税负不满阈值：{(COALITION_SENSITIVITY.TAX_THRESHOLD_NORMAL * 100).toFixed(0)}% → <span className="text-red-400">{(COALITION_SENSITIVITY.TAX_THRESHOLD_COALITION * 100).toFixed(0)}%</span></li>
                                <li>预期收入倍数：×{COALITION_SENSITIVITY.INCOME_MULTIPLIER_NORMAL.toFixed(2)} → <span className="text-red-400">×{COALITION_SENSITIVITY.INCOME_MULTIPLIER_COALITION.toFixed(2)}</span></li>
                                <li>基础物资短缺不满：{COALITION_SENSITIVITY.BASIC_SHORTAGE_PRESSURE_NORMAL}/项 → <span className="text-red-400">{COALITION_SENSITIVITY.BASIC_SHORTAGE_PRESSURE_COALITION}/项</span></li>
                                <li>奢侈品短缺不满：{COALITION_SENSITIVITY.LUXURY_SHORTAGE_PRESSURE_NORMAL}/项 → <span className="text-red-400">{COALITION_SENSITIVITY.LUXURY_SHORTAGE_PRESSURE_COALITION}/项</span></li>
                            </ul>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
