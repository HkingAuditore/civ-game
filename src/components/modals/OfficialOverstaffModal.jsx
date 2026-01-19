import React, { useState } from 'react';
import { Icon } from '../common/UIComponents';
import { RESOURCES, BUILDINGS } from '../../config';
import { STRATA } from '../../config/strata';
import { POLITICAL_STANCES } from '../../config/politicalStances';

const STANCE_SPECTRUM_LABELS = {
    left: '左派',
    center: '建制派',
    right: '右派',
};

const STANCE_SPECTRUM_STYLES = {
    left: 'bg-red-500/20 text-red-300 border-red-500/40',
    center: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
    right: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
};

const EFFECT_LABELS = {
    buildings: '建筑产出',
    categories: '类别产出',
    stratumDemandMod: '阶层消耗',
    resourceDemandMod: '资源需求',
    resourceSupplyMod: '资源供给',
    passive: '被动产出',
    passivePercent: '被动收益',
    needsReduction: '全民消耗',
    maxPop: '人口上限',
    incomePercent: '财政收入加成',
    stability: '稳定度',
    militaryBonus: '军队战力',
    approval: '满意度',
    coalitionApproval: '联盟满意度',
    tradeBonus: '贸易利润',
    taxEfficiency: '税收效率',
    industryBonus: '工业产出',
    gatherBonus: '采集产出',
    researchSpeed: '科研产出',
    cultureBonus: '文化产出',
    populationGrowth: '人口增长',
    buildingCostMod: '建筑成本',
    legitimacyBonus: '合法性',
    militaryUpkeep: '军事维护',
    wartimeProduction: '战时生产',
    diplomaticBonus: '外交关系',
    diplomaticCooldown: '外交冷却',
    organizationDecay: '组织度增速',
    productionInputCost: '原料消耗',
    corruption: '腐败',
    factionConflict: '派系冲突',
    resourceWaste: '资源浪费',
    diplomaticIncident: '外交关系衰减',
};

const PERCENT_EFFECTS = new Set([
    'buildings',
    'categories',
    'stratumDemandMod',
    'resourceDemandMod',
    'resourceSupplyMod',
    'passivePercent',
    'needsReduction',
    'maxPop',
    'incomePercent',
    'stability',
    'militaryBonus',
    'tradeBonus',
    'taxEfficiency',
    'industryBonus',
    'gatherBonus',
    'researchSpeed',
    'cultureBonus',
    'populationGrowth',
    'buildingCostMod',
    'legitimacyBonus',
    'militaryUpkeep',
    'wartimeProduction',
    'diplomaticCooldown',
    'organizationDecay',
    'productionInputCost',
    'corruption',
    'factionConflict',
    'resourceWaste',
]);

const getTargetName = (target) => {
    const buildingDef = BUILDINGS.find(b => b.id === target);
    if (buildingDef) return buildingDef.name;
    if (STRATA[target]) return STRATA[target].name;
    if (RESOURCES[target]) return RESOURCES[target].name;
    const categoryNames = { gather: '采集', industry: '工业', civic: '民用', military: '军事' };
    if (categoryNames[target]) return categoryNames[target];
    if (target === 'silver') return '银币';
    if (target === 'food') return '粮食';
    if (target === 'culture') return '文化';
    if (target === 'science') return '科技';
    return target;
};

const flattenEffects = (effects = {}) => {
    const entries = [];
    Object.entries(effects).forEach(([type, valueOrObj]) => {
        if (typeof valueOrObj === 'number') {
            entries.push({ type, target: null, value: valueOrObj });
            return;
        }
        if (!valueOrObj || typeof valueOrObj !== 'object') return;
        Object.entries(valueOrObj).forEach(([target, value]) => {
            if (typeof value !== 'number') return;
            entries.push({ type, target, value });
        });
    });
    return entries;
};

const formatEffect = ({ type, target, value }) => {
    const label = EFFECT_LABELS[type] || type;
    const targetName = target ? getTargetName(target) : '';
    const targetSuffix = targetName ? `(${targetName})` : '';
    const sign = value > 0 ? '+' : '';

    if (type === 'needsReduction') {
        const pct = `${(Math.abs(value) * 100).toFixed(0)}%`;
        const needsSign = value > 0 ? '-' : '+';
        return `${label}${targetSuffix} ${needsSign}${pct}`;
    }

    if (type === 'diplomaticBonus' || type === 'diplomaticIncident') {
        return `${label}${targetSuffix} ${sign}${value.toFixed(1)}/日`;
    }

    if (PERCENT_EFFECTS.has(type)) {
        return `${label}${targetSuffix} ${sign}${(value * 100).toFixed(0)}%`;
    }

    return `${label}${targetSuffix} ${sign}${value}`;
};

/**
 * 官员超编强制解雇弹窗
 * 当官员数量超过容量上限时强制用户解雇官员
 */
const OfficialOverstaffModal = ({
    officials = [],
    currentCount,
    maxCapacity,
    onFireOfficial,
    onClose, // 只有解雇足够官员后才能关闭
}) => {
    const [selectedIds, setSelectedIds] = useState(new Set());
    const excessCount = currentCount - maxCapacity;
    const needToFire = excessCount - selectedIds.size;
    const canClose = needToFire <= 0;

    const toggleSelection = (id) => {
        const next = new Set(selectedIds);
        if (next.has(id)) {
            next.delete(id);
        } else {
            next.add(id);
        }
        setSelectedIds(next);
    };

    const handleConfirm = () => {
        if (!canClose) return;
        // 解雇所有选中的官员
        selectedIds.forEach(id => {
            onFireOfficial(id);
        });
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[9999]">
            <div className="bg-gray-900 border-2 border-red-500/50 rounded-lg p-6 max-w-lg w-full mx-4 shadow-2xl">
                {/* 标题 */}
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-red-500/20 rounded-full flex items-center justify-center">
                        <Icon name="UserMinus" size={20} className="text-red-400" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-red-400">官员编制超额</h2>
                        <p className="text-sm text-gray-400">必须解雇部分官员以符合新的编制限制</p>
                    </div>
                </div>

                {/* 说明 */}
                <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4 mb-4">
                    <p className="text-sm text-gray-300">
                        由于政体变更或其他原因，官员编制从 <span className="text-white font-bold">{currentCount}</span> 人
                        降低至 <span className="text-white font-bold">{maxCapacity}</span> 人。
                    </p>
                    <p className="text-sm text-red-400 mt-2">
                        您需要解雇 <span className="font-bold">{excessCount}</span> 名官员。
                        {needToFire > 0 ? (
                            <span className="ml-1">还需选择 <span className="font-bold">{needToFire}</span> 人</span>
                        ) : (
                            <span className="ml-1 text-green-400">已选择足够官员</span>
                        )}
                    </p>
                </div>

                {/* 官员列表 */}
                <div className="space-y-2 max-h-64 overflow-y-auto mb-4">
                    {officials.map(official => {
                        const isSelected = selectedIds.has(official.id);
                        const stratumInfo = STRATA[official.sourceStratum];
                        const stanceInfo = official.politicalStance ? POLITICAL_STANCES[official.politicalStance] : null;
                        const spectrum = stanceInfo?.spectrum || 'center';
                        const spectrumLabel = STANCE_SPECTRUM_LABELS[spectrum] || '建制派';
                        const spectrumStyle = STANCE_SPECTRUM_STYLES[spectrum] || STANCE_SPECTRUM_STYLES.center;
                        const effectEntries = flattenEffects(official.effects);
                        const shownEffects = effectEntries.slice(0, 3);
                        const hiddenEffectCount = Math.max(0, effectEntries.length - shownEffects.length);

                        return (
                            <div
                                key={official.id}
                                className={`
                                    flex items-center justify-between p-3 rounded-lg cursor-pointer
                                    transition-all duration-200
                                    ${isSelected
                                        ? 'bg-red-900/40 border-2 border-red-500'
                                        : 'bg-gray-800 border border-gray-700 hover:border-gray-500'
                                    }
                                `}
                                onClick={() => toggleSelection(official.id)}
                            >
                                <div className="flex items-start gap-3">
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isSelected ? 'bg-red-500' : 'bg-gray-700'
                                        }`}>
                                        {isSelected ? (
                                            <Icon name="Check" size={16} className="text-white" />
                                        ) : (
                                            <Icon name={stratumInfo?.icon || 'User'} size={16} className="text-gray-400" />
                                        )}
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium text-white">{official.name}</p>
                                        <p className="text-xs text-gray-400">
                                            {stratumInfo?.name || official.sourceStratum} · 俸禄 {official.salary}/日
                                        </p>
                                        <div className="mt-2 flex flex-wrap gap-2">
                                            <span className={`px-2 py-0.5 text-[11px] border rounded-full ${spectrumStyle}`}>
                                                {spectrumLabel}
                                            </span>
                                            <span className="px-2 py-0.5 text-[11px] border rounded-full border-gray-700 text-gray-300">
                                                {stanceInfo?.name || '未知立场'}
                                            </span>
                                            {shownEffects.length > 0 ? (
                                                shownEffects.map(effect => (
                                                    <span
                                                        key={`${official.id}-${effect.type}-${effect.target || 'base'}`}
                                                        className={`px-2 py-0.5 text-[11px] border rounded-full ${effect.value >= 0
                                                            ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                                                            : 'bg-red-500/15 text-red-300 border-red-500/30'
                                                            }`}
                                                    >
                                                        {formatEffect(effect)}
                                                    </span>
                                                ))
                                            ) : (
                                                <span className="px-2 py-0.5 text-[11px] border rounded-full border-gray-700 text-gray-400">
                                                    无明显加成
                                                </span>
                                            )}
                                            {hiddenEffectCount > 0 && (
                                                <span className="px-2 py-0.5 text-[11px] border rounded-full border-gray-700 text-gray-400">
                                                    另有 {hiddenEffectCount} 项
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className={`text-xs ${isSelected ? 'text-red-400' : 'text-gray-500'}`}>
                                        {isSelected ? '将被解雇' : '点击选择'}
                                    </p>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* 确认按钮 */}
                <button
                    onClick={handleConfirm}
                    disabled={!canClose}
                    className={`
                        w-full py-3 rounded-lg font-medium transition-all
                        ${canClose
                            ? 'bg-red-600 hover:bg-red-500 text-white cursor-pointer'
                            : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                        }
                    `}
                >
                    {canClose ? (
                        <span className="flex items-center justify-center gap-2">
                            <Icon name="UserMinus" size={16} />
                            确认解雇 {selectedIds.size} 名官员
                        </span>
                    ) : (
                        <span>请选择要解雇的官员</span>
                    )}
                </button>
            </div>
        </div>
    );
};

export default OfficialOverstaffModal;
