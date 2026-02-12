import React, { memo, useState } from 'react';
import { Icon } from '../../common/UIComponents';
import { STRATA, RESOURCES, BUILDINGS } from '../../../config';
import { POLITICAL_STANCES, POLITICAL_ISSUES } from '../../../config/politicalStances';
import { formatNumberShortCN } from '../../../utils/numberFormat';
import { calculatePrestige, getPrestigeLevel, DISPOSAL_TYPES } from '../../../logic/officials/manager';
// 效果类型的显示名称映射
const EFFECT_TYPE_NAMES = {
    buildings: '建筑产出',
    categories: '类别产出',
    stratumDemandMod: '阶层需求',
    resourceDemandMod: '资源需求',
    resourceSupplyMod: '资源供给',
    passive: '被动产出',
    passivePercent: '被动收益',
    needsReduction: '需求减少',
    maxPop: '人口上限',
    incomePercent: '财政收入加成',
    stability: '稳定度',
    militaryBonus: '军事力量',
    approval: '满意度',
};

const FINANCIAL_STATUS_LABELS = {
    uncomfortable: '生活拮据',
    struggling: '入不敷出',
    desperate: '濒临破产',
};

const FINANCIAL_STATUS_STYLES = {
    uncomfortable: 'text-amber-300 bg-amber-900/40 border-amber-600/50',
    struggling: 'text-orange-300 bg-orange-900/40 border-orange-600/50',
    desperate: 'text-red-300 bg-red-900/40 border-red-600/50',
};

// 获取目标的显示名称
const getTargetName = (target, type) => {
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


// 格式化效果显示
const formatEffectValue = (type, value, target) => {
    const targetName = target ? getTargetName(target) : null;
    const sign = value > 0 ? '+' : '';

    switch (type) {
        case 'stability':
        case 'legitimacyBonus':
        case 'militaryBonus':
        case 'tradeBonus':
        case 'taxEfficiency':
        case 'industryBonus':
        case 'gatherBonus':
        case 'incomePercentBonus':
        case 'researchSpeed':
        case 'populationGrowth':
        case 'needsReduction':
        case 'buildingCostMod':
        case 'cultureBonus':
        case 'organizationDecay':
            return `${type.replace(/([A-Z])/g, ' $1').trim()} ${sign}${(value * 100).toFixed(0)}%`;
        case 'approval':
            if (targetName) return `${targetName}满意度 ${sign}${value}`;
            return `满意度 ${sign}${value}`;
        case 'diplomaticBonus':
            return `外交关系 ${sign}${value}/日`;
        default:
            return `${type} ${sign}${value}`;
    }
};

// 效果名称映射（政治立场效果专用）
const EFFECT_NAMES = {
    stability: '稳定度',
    legitimacyBonus: '合法性',
    militaryBonus: '军队战力',
    tradeBonus: '贸易利润',
    taxEfficiency: '税收效率',
    industryBonus: '工业产出',
    gatherBonus: '采集产出',
    incomePercentBonus: '财政收入加成',
    researchSpeed: '科研产出',
    populationGrowth: '人口增长',
    needsReduction: '全民消耗', // 正值表示减少消耗
    buildingCostMod: '建筑成本',
    cultureBonus: '文化产出',
    organizationDecay: '组织度增速',
    approval: '满意度',
    diplomaticBonus: '外交关系',
    productionInputCost: '原料消耗', // 新增：生产成本修正
};

/**
 * 单个官员卡片组件 - 左右两栏布局
 */
const OfficialCardInner = ({
    official,
    isCandidate = false,
    onAction,
    onDispose,
    canAfford = true,
    actionDisabled = false,
    currentDay = 0,
    isStanceSatisfied = null, // 新增：政治主张是否满足 (null=不检查, true=满足, false=不满足)
    onViewDetail,
    compact = false,
    generals = [], // Generals list for checking if official is leading a corps
}) => {
    const [showDisposalMenu, setShowDisposalMenu] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);

    if (!official) return null;

    // Check if this official is serving as a general
    const linkedGeneral = generals.find(g => g.officialId === official.id);
    const isLeadingCorps = !!linkedGeneral?.assignedCorpsId;

    const stratumKey = official.sourceStratum || official.stratum;
    const stratumDef = STRATA[stratumKey];
    const stratumColor = stratumDef?.color || 'text-gray-400';
    const stratumIcon = stratumDef?.icon || 'User';
    const salary = official.salary || 0;

    // 政治立场（兼容字符串或对象）
    const stanceId = typeof official.politicalStance === 'string'
        ? official.politicalStance
        : official.politicalStance?.stanceId;
    const stance = stanceId ? POLITICAL_STANCES[stanceId] : null;
    const stanceSpectrum = stance?.spectrum || 'center';
    const stanceConditionText = official.stanceConditionText || stance?.condition?.description || '无';
    const stanceActiveEffects = (official.stanceActiveEffects && Object.keys(official.stanceActiveEffects).length > 0)
        ? official.stanceActiveEffects
        : stance?.activeEffects;
    const stanceUnsatisfiedPenalty = (official.stanceUnsatisfiedPenalty && Object.keys(official.stanceUnsatisfiedPenalty).length > 0)
        ? official.stanceUnsatisfiedPenalty
        : stance?.failureEffects;

    // 政治光谱完整配置（颜色、图标、边框、标签）
    const spectrumConfig = {
        left: {
            bg: 'bg-red-900/30',
            border: 'border-red-500/60',
            text: 'text-red-300',
            icon: 'Users',
            label: '左派',
            gradient: 'from-red-600/30 to-red-900/10',
            glow: 'shadow-red-500/20',
        },
        center: {
            bg: 'bg-blue-900/30',
            border: 'border-blue-500/60',
            text: 'text-blue-300',
            icon: 'Scale',
            label: '建制派',
            gradient: 'from-blue-600/30 to-blue-900/10',
            glow: 'shadow-blue-500/20',
        },
        right: {
            bg: 'bg-amber-900/30',
            border: 'border-amber-500/60',
            text: 'text-amber-300',
            icon: 'TrendingUp',
            label: '右派',
            gradient: 'from-amber-600/30 to-amber-900/10',
            glow: 'shadow-amber-500/20',
        },
    };
    const stanceColors = spectrumConfig[stanceSpectrum] || spectrumConfig.center;

    // 威望计算
    const prestige = !isCandidate ? calculatePrestige(official, currentDay) : 0;
    const prestigeInfo = !isCandidate ? getPrestigeLevel(prestige) : null;
    const financialStatus = official.financialSatisfaction;
    const financialLabel = financialStatus ? FINANCIAL_STATUS_LABELS[financialStatus] : null;
    const financialStyle = financialStatus ? FINANCIAL_STATUS_STYLES[financialStatus] : null;

    // 忠诚度相关
    const loyalty = official.loyalty ?? 75; // 默认兼容旧存档
    const lowLoyaltyDays = official.lowLoyaltyDays ?? 0;
    const loyaltyColor = loyalty >= 75 ? 'bg-green-500'
        : loyalty >= 50 ? 'bg-yellow-500'
            : loyalty >= 25 ? 'bg-orange-500'
                : 'bg-red-500';
    const loyaltyBorderColor = loyalty >= 75 ? 'border-green-600/50'
        : loyalty >= 50 ? 'border-yellow-600/50'
            : loyalty >= 25 ? 'border-orange-600/50'
                : 'border-red-600/50';
    const loyaltyTextColor = loyalty >= 75 ? 'text-green-400'
        : loyalty >= 50 ? 'text-yellow-400'
            : loyalty >= 25 ? 'text-orange-400'
                : 'text-red-400';

    const ownedProperties = Array.isArray(official.ownedProperties) ? official.ownedProperties : [];
    const propertyCount = ownedProperties.length;
    const propertyIncome = typeof official.lastDayPropertyIncome === 'number' ? official.lastDayPropertyIncome : 0;
    const propertyBreakdown = ownedProperties.reduce((acc, prop) => {
        if (!prop?.buildingId) return acc;
        acc[prop.buildingId] = (acc[prop.buildingId] || 0) + 1;
        return acc;
    }, {});
    const propertyEntries = Object.entries(propertyBreakdown)
        .map(([buildingId, count]) => {
            const buildingName = BUILDINGS.find(b => b.id === buildingId)?.name || buildingId;
            return { buildingId, buildingName, count };
        })
        .sort((a, b) => b.count - a.count);

    // 处置按钮
    const handleDispose = (type) => {
        setShowDisposalMenu(false);
        if (onDispose) onDispose(official.id, type);
    };

    // 格式化单个效果的描述（完整汉化）
    const formatEffect = (type, target, value) => {
        const targetName = target ? getTargetName(target, type) : null;
        const isPositive = value > 0;
        const absValue = Math.abs(value);
        let isGood = isPositive;
        let description = '';
        const formatScalar = (v) => {
            if (!Number.isFinite(v)) return v;
            const abs = Math.abs(v);
            if (abs >= 10) return v.toFixed(0);
            if (abs >= 1) return v.toFixed(1);
            return v.toFixed(2);
        };
        const pct = (v) => `${v > 0 ? '+' : ''}${(v * 100).toFixed(0)}%`;
        const num = (v) => `${v > 0 ? '+' : ''}${formatScalar(v)}`;

        switch (type) {
            // 建筑/类别产出
            case 'buildings': description = `${targetName}产出 ${pct(value)}`; break;
            case 'categories': description = `${targetName}类产出 ${pct(value)}`; break;

            // 贸易/税收
            case 'tradeBonus': description = `贸易利润 ${pct(value)}`; break;
            case 'taxEfficiency': description = `税收效率 ${pct(value)}`; break;
            case 'incomePercent': description = `财政收入加成 ${pct(value)}`; break;

            // 建筑成本
            case 'buildingCostMod': isGood = value < 0; description = `建筑成本 ${pct(value)}`; break;

            // 被动产出
            case 'passive': description = `每日${targetName || '产出'} ${num(value)}`; break;
            case 'passivePercent':
                if (target === 'silver') {
                    description = `银币收入 ${pct(value)}`;
                } else {
                    description = `${targetName || '资源'}产出 ${pct(value)}`;
                }
                break;

            // 需求/消耗
            case 'stratumDemandMod': isGood = value < 0; description = `${targetName}消耗 ${pct(value)}`; break;
            case 'resourceDemandMod': isGood = value < 0; description = `${targetName}需求 ${pct(value)}`; break;
            case 'resourceSupplyMod': description = `${targetName}供给 ${pct(value)}`; break;
            case 'needsReduction': isGood = value > 0; description = `全民消耗 ${value > 0 ? '-' : '+'}${(absValue * 100).toFixed(0)}%`; break;

            // 人口
            case 'maxPop': description = `人口上限 ${pct(value)}`; break;
            case 'populationGrowth': description = `人口增长 ${pct(value)}`; break;

            // 科研/文化
            case 'researchSpeed': description = `科研产出 ${pct(value)}`; break;
            case 'cultureBonus': description = `文化产出 ${pct(value)}`; break;

            // 满意度/稳定度
            case 'approval': description = `${targetName || '全体'}满意度 ${isPositive ? '+' : ''}${formatScalar(value)}`; break;
            case 'coalitionApproval': description = `联盟满意度 ${isPositive ? '+' : ''}${formatScalar(value)}`; break;
            case 'legitimacyBonus': description = `合法性 ${pct(value)}`; break;
            case 'stability': description = `稳定度 ${pct(value)}`; break;

            // 军事
            case 'militaryBonus': description = `军队战力 ${pct(value)}`; break;
            case 'militaryUpkeep': isGood = value < 0; description = `军事维护 ${pct(value)}`; break;
            case 'wartimeProduction': description = `战时生产 ${pct(value)}`; break;

            // 组织度
            case 'organizationDecay': isGood = value < 0; description = `组织度增速 ${pct(value)}`; break;

            // 外交
            case 'diplomaticBonus': description = `外交关系 ${isPositive ? '+' : ''}${formatScalar(value)}/日`; break;

            // 资源浪费
            case 'resourceWaste': isGood = value < 0; description = `${targetName || '资源'}浪费 ${pct(value)}`; break;

            // 派系冲突
            case 'factionConflict': isGood = value < 0; description = `派系冲突 ${value > 0 ? '-' : '+'}${(Math.abs(value) * 100).toFixed(0)}%稳定`; break;

            // 腐败
            case 'corruption': isGood = value < 0; description = `腐败 ${value > 0 ? '-' : '+'}${(Math.abs(value) * 100).toFixed(0)}%税收`; break;

            // 外交事件
            case 'diplomaticIncident': isGood = value < 0; description = `外交关系衰减 +${value.toFixed(1)}/日`; break;

            // 外交冷却
            case 'diplomaticCooldown': isGood = value < 0; description = `外交冷却 ${pct(value)}`; break;

            // 生产成本修正（新增）
            case 'productionInputCost':
                isGood = value < 0;
                description = `${targetName || '建筑'}原料消耗 ${pct(value)}`;
                break;

            // 其他
            case 'influenceBonus': description = `影响力 ${pct(value)}`; break;
            case 'wageModifier': isGood = value < 0; description = `薪俸成本 ${pct(value)}`; break;
            case 'corruptionMod': isGood = value < 0; description = `腐败程度 ${pct(value)}`; break;

            default:
                // 尝试智能汉化未知类型
                const typeNames = {
                    'production': '生产', 'bonus': '加成', 'penalty': '惩罚',
                    'mod': '调整', 'rate': '速率', 'cost': '成本',
                };
                let cnType = type;
                Object.entries(typeNames).forEach(([en, cn]) => {
                    cnType = cnType.replace(new RegExp(en, 'gi'), cn);
                });
                description = `${cnType}${targetName ? ` (${targetName})` : ''}: ${typeof value === 'number' && Math.abs(value) < 10 ? value.toFixed(2) : value}`;
        }
        return { description, isGood };
    };

    // 渲染效果列表
    const effectData = (() => {
        if (official.effects && Object.keys(official.effects).length > 0) return official.effects;
        if (Array.isArray(official.rawEffects) && official.rawEffects.length > 0) {
            return official.rawEffects.reduce((acc, raw) => {
                if (!raw?.type) return acc;
                if (raw.target) {
                    if (!acc[raw.type]) acc[raw.type] = {};
                    acc[raw.type][raw.target] = raw.value;
                } else {
                    acc[raw.type] = raw.value;
                }
                return acc;
            }, {});
        }
        return {};
    })();

    const renderEffects = () => {
        const items = [];
        Object.entries(effectData).forEach(([type, valueOrObj]) => {
            if (typeof valueOrObj === 'object' && valueOrObj !== null) {
                Object.entries(valueOrObj).forEach(([target, value]) => {
                    const { description, isGood } = formatEffect(type, target, value);
                    items.push(
                        <div key={`eff-${type}-${target}`} className={`flex items-center gap-1 text-[10px] ${isGood ? 'text-green-300' : 'text-red-300'}`}>
                            <Icon name={isGood ? "Plus" : "Minus"} size={10} className={isGood ? "text-green-500" : "text-red-500"} />
                            <span>{description}</span>
                        </div>
                    );
                });
            } else {
                const { description, isGood } = formatEffect(type, null, valueOrObj);
                items.push(
                    <div key={`eff-${type}`} className={`flex items-center gap-1 text-[10px] ${isGood ? 'text-green-300' : 'text-red-300'}`}>
                        <Icon name={isGood ? "Plus" : "Minus"} size={10} className={isGood ? "text-green-500" : "text-red-500"} />
                        <span>{description}</span>
                    </div>
                );
            }
        });
        return items;
    };

    const formatStanceValue = (type, value) => {
        const isPercent = typeof value === 'number' && Math.abs(value) < 2;
        if (isPercent) {
            if (type === 'needsReduction') {
                return value > 0 ? `-${(value * 100).toFixed(0)}%` : `+${(Math.abs(value) * 100).toFixed(0)}%`;
            }
            return `${value > 0 ? '+' : ''}${(value * 100).toFixed(0)}%`;
        }
        return `${value > 0 ? '+' : ''}${typeof value === 'number' ? value.toFixed(1) : value}`;
    };

    const buildStanceEffectLines = (effects) => {
        if (!effects || Object.keys(effects).length === 0) return [];
        const lines = [];
        Object.entries(effects).forEach(([type, valueOrObj]) => {
            if (typeof valueOrObj === 'object' && valueOrObj !== null) {
                Object.entries(valueOrObj).forEach(([target, value]) => {
                    const targetName = getTargetName(target);
                    lines.push(`${EFFECT_NAMES[type] || type}: ${targetName} ${formatStanceValue(type, value)}`);
                });
                return;
            }
            lines.push(`${EFFECT_NAMES[type] || type}: ${formatStanceValue(type, valueOrObj)}`);
        });
        return lines;
    };

    // 渲染立场效果（汉化版）
    const renderStanceEffects = (effects, isActive) => {
        if (!effects || Object.keys(effects).length === 0) return null;

        return Object.entries(effects).map(([type, valueOrObj]) => {
            if (typeof valueOrObj === 'object' && valueOrObj !== null) {
                return Object.entries(valueOrObj).map(([target, value]) => {
                    const targetName = getTargetName(target);
                    const displayValue = formatStanceValue(type, value);
                    return (
                        <div key={`stance-${type}-${target}`} className={`text-[9px] ${isActive ? 'text-green-300' : 'text-red-300'}`}>
                            {EFFECT_NAMES[type] || type}: {targetName} {displayValue}
                        </div>
                    );
                });
            }
            const displayValue = formatStanceValue(type, valueOrObj);
            return (
                <div key={`stance-${type}`} className={`text-[9px] ${isActive ? 'text-green-300' : 'text-red-300'}`}>
                    {EFFECT_NAMES[type] || type}: {displayValue}
                </div>
            );
        });
    };

    const effectItems = renderEffects();

    if (compact) {
        const adminValue = official.stats?.administrative ?? official.administrative ?? 50;
        const militaryValue = official.stats?.military ?? official.military ?? 30;
        const diplomacyValue = official.stats?.diplomacy ?? official.diplomacy ?? 30;
        const prestigeValue = official.stats?.prestige ?? official.prestige ?? 50;
        const level = official.level || 1;

        const effectPreview = isExpanded ? effectItems : effectItems.slice(0, 4);
        const effectOverflow = effectItems.length - effectPreview.length;
        const activeEffectLines = buildStanceEffectLines(stanceActiveEffects);
        const penaltyEffectLines = buildStanceEffectLines(stanceUnsatisfiedPenalty);

        return (
            <div
                className={`relative bg-gray-800/60 border ${stanceColors.border} rounded-lg p-3 transition-all overflow-hidden shadow ${stanceColors.glow} ${onViewDetail ? 'cursor-pointer hover:border-opacity-100 hover:shadow-emerald-500/10 hover:-translate-y-0.5 hover:ring-1 hover:ring-emerald-400/30' : ''}`}
                onClick={() => {
                    if (onViewDetail) onViewDetail(official);
                }}
            >
                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        <div className="flex items-center gap-2">
                            {level > 1 && (
                                <span className="px-1 py-0.5 bg-purple-900/50 text-purple-300 rounded text-[9px]">
                                    Lv.{level}
                                </span>
                            )}
                            <span className="text-sm font-bold text-gray-100 truncate">{official.name}</span>
                            {linkedGeneral && (
                                <span className="px-1 py-0.5 bg-amber-900/50 text-amber-300 rounded text-[9px] flex-shrink-0">
                                    🎖️ {isLeadingCorps ? '领军中' : '将领'}
                                </span>
                            )}
                            {official.ambition > 50 && (
                                <span className="px-1 py-0.5 bg-orange-900/50 text-orange-300 rounded text-[9px]">
                                    <Icon name="Flame" size={8} className="inline" /> {official.ambition}
                                </span>
                            )}
                        </div>
                        <div className={`text-[10px] ${stratumColor} opacity-80 flex items-center flex-wrap gap-1 mt-0.5`}>
                            {stance && (
                                <>
                                    <span className={`inline-flex items-center gap-0.5 px-1 py-px rounded text-[8px] font-medium ${stanceColors.bg} ${stanceColors.text} border ${stanceColors.border} flex-shrink-0`}>
                                        <Icon name={stanceColors.icon} size={8} />
                                        {stanceColors.label}
                                    </span>
                                    {stance?.name && (
                                        <span className="text-[9px] text-gray-300 font-bold ml-1 truncate max-w-[80px] inline-flex items-center gap-0.5" title={stance.description}>
                                            {stance.name}
                                            {isStanceSatisfied !== null && !isCandidate && (
                                                <Icon
                                                    name={isStanceSatisfied ? 'Check' : 'X'}
                                                    size={8}
                                                    className={isStanceSatisfied ? 'text-green-400' : 'text-red-400'}
                                                    title={isStanceSatisfied ? '政治主张已满足' : '政治主张未满足'}
                                                />
                                            )}
                                        </span>
                                    )}
                                </>
                            )}
                            <span className="truncate">{stratumDef?.name || stratumKey} 出身</span>
                            {prestigeInfo && <span className={`flex-shrink-0 ${prestigeInfo.color}`}>· {prestigeInfo.name}</span>}
                        </div>
                    </div>
                    <div className="text-right flex-shrink-0 flex flex-col items-end gap-1">
                        <div className="flex items-center gap-1 text-xs font-mono text-yellow-400">
                            <Icon name="Coins" size={12} className="text-yellow-500/70" />
                            {salary}
                        </div>
                        {!isCandidate && (
                            <div className="mt-1 w-full flex flex-col items-end">
                                <div className="flex items-center gap-1 mb-0.5">
                                    <span className={`text-[9px] font-mono ${loyaltyTextColor}`}>{Math.round(loyalty)}</span>
                                    <Icon name="Heart" size={10} className={loyaltyTextColor} />
                                </div>
                                <div className={`h-1 w-16 bg-gray-700 rounded-full overflow-hidden border ${loyaltyBorderColor}`}>
                                    <div
                                        className={`h-full ${loyaltyColor} transition-all duration-300`}
                                        style={{ width: `${loyalty}%` }}
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="mt-2 flex items-center flex-wrap gap-1">
                    <div className="flex items-center gap-1 px-1.5 py-0.5 bg-gray-900/40 rounded border border-blue-800/30">
                        <Icon name="Briefcase" size={12} className="text-blue-400" />
                        <span className="text-[10px] font-bold text-blue-300">{adminValue}</span>
                    </div>
                    <div className="flex items-center gap-1 px-1.5 py-0.5 bg-gray-900/40 rounded border border-red-800/30">
                        <Icon name="Sword" size={12} className="text-red-400" />
                        <span className="text-[10px] font-bold text-red-300">{militaryValue}</span>
                    </div>
                    <div className="flex items-center gap-1 px-1.5 py-0.5 bg-gray-900/40 rounded border border-green-800/30">
                        <Icon name="Globe" size={12} className="text-green-400" />
                        <span className="text-[10px] font-bold text-green-300">{diplomacyValue}</span>
                    </div>
                    <div className="flex items-center gap-1 px-1.5 py-0.5 bg-gray-900/40 rounded border border-purple-800/30">
                        <Icon name="Award" size={12} className="text-purple-400" />
                        <span className="text-[10px] font-bold text-purple-300">{prestigeValue}</span>
                    </div>
                    {level > 1 && (
                        <span className="px-1.5 py-0.5 bg-purple-900/50 text-purple-300 rounded text-[9px]">
                            Lv.{level}
                        </span>
                    )}
                </div>

                <div className="mt-2">
                    <div className="text-[9px] text-gray-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                        <Icon name="Zap" size={10} />
                        官员效果
                        {effectOverflow > 0 && !isExpanded && (
                            <span className="ml-auto text-[8px] text-gray-500">+{effectOverflow}</span>
                        )}
                    </div>
                    <div className={`grid ${isExpanded ? 'grid-cols-1' : 'grid-cols-2'} gap-0.5`}>
                        {effectPreview.length > 0 ? effectPreview : (
                            <div className="text-[10px] text-gray-500 italic">暂无效果</div>
                        )}
                    </div>
                </div>

                <div className="mt-2 pt-2 border-t border-gray-700/30">
                    <div className="text-[9px] text-gray-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                        <Icon name="Flag" size={10} />
                        政治主张
                        {isStanceSatisfied !== null && !isCandidate && (
                            <Icon
                                name={isStanceSatisfied ? 'Check' : 'X'}
                                size={10}
                                className={isStanceSatisfied ? 'text-green-400' : 'text-red-400'}
                                title={isStanceSatisfied ? '政治主张已满足' : '政治主张未满足'}
                            />
                        )}
                    </div>
                    {stance ? (
                        <>
                            <div className="text-[10px] text-gray-300 font-semibold">{stance.name}</div>
                            <div className="text-[9px] text-gray-500 mt-0.5 truncate" title={stanceConditionText}>
                                触发: {stanceConditionText}
                            </div>
                            {isExpanded && (
                                <div className="mt-1 max-h-28 overflow-y-auto pr-1 space-y-1">
                                    {stanceConditionText && (
                                        <div className="text-[9px] text-gray-500">触发条件: {stanceConditionText}</div>
                                    )}
                                    {stanceActiveEffects && Object.keys(stanceActiveEffects).length > 0 && (
                                        <div>
                                            <div className="text-[8px] text-green-500 uppercase">满足时</div>
                                            <div className="space-y-0.5">{renderStanceEffects(stanceActiveEffects, true)}</div>
                                        </div>
                                    )}
                                    {stanceUnsatisfiedPenalty && Object.keys(stanceUnsatisfiedPenalty).length > 0 && (
                                        <div>
                                            <div className="text-[8px] text-red-500 uppercase">未满足</div>
                                            <div className="space-y-0.5">{renderStanceEffects(stanceUnsatisfiedPenalty, false)}</div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="text-[10px] text-gray-500 italic">无政治立场</div>
                    )}
                </div>

                <div className="mt-2 flex items-center justify-between">
                    <div className="flex items-center gap-1">
                        {financialLabel && (
                            <div className={`px-1.5 py-0.5 rounded border text-[9px] font-semibold ${financialStyle}`}>
                                {financialLabel}
                            </div>
                        )}
                        {!isCandidate && loyalty < 50 && (
                            <div className="px-1.5 py-0.5 rounded border text-[9px] font-semibold text-red-300 bg-red-900/40 border-red-700/50">
                                忠诚偏低
                            </div>
                        )}
                    </div>
                </div>

                {(effectItems.length > 2 || activeEffectLines.length > 0 || penaltyEffectLines.length > 0) && (
                    <div className="mt-1 flex justify-end">
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setIsExpanded(!isExpanded);
                            }}
                            className="text-[9px] text-gray-400 hover:text-gray-200"
                        >
                            {isExpanded ? '收起' : '展开'}
                        </button>
                    </div>
                )}

                <div className="mt-2 pt-2 border-t border-gray-700/30">
                    {isCandidate ? (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onAction(official.id);
                            }}
                            disabled={actionDisabled || !canAfford}
                            className={`w-full py-1 px-2 rounded text-xs font-bold flex items-center justify-center gap-1 transition-colors
                                ${canAfford && !actionDisabled
                                    ? 'bg-green-700 hover:bg-green-600 text-white'
                                    : 'bg-gray-700 text-gray-400 cursor-not-allowed'}`}
                        >
                            <Icon name="UserPlus" size={12} />
                            雇佣
                        </button>
                    ) : (
                        <div className="relative flex gap-1">
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (isLeadingCorps) {
                                            alert('该官员正在领军中，请先在军团面板卸任将领后再解雇。');
                                            return;
                                        }
                                        onAction(official.id);
                                    }}
                                    disabled={actionDisabled}
                                    className="flex-1 py-1 px-2 rounded text-xs font-bold flex items-center justify-center gap-1 transition-colors bg-gray-700/50 hover:bg-gray-600/50 text-gray-300 border border-gray-600/50"
                                >
                                    <Icon name="UserMinus" size={12} />
                                    解雇
                                </button>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setShowDisposalMenu(!showDisposalMenu);
                                    }}
                                    className="py-1 px-2 rounded text-xs font-bold flex items-center justify-center transition-colors bg-red-900/30 hover:bg-red-800/50 text-red-400 border border-red-900/50"
                                    title="更多处置选项"
                                >
                                    <Icon name="ChevronDown" size={12} />
                                </button>

                            {showDisposalMenu && (
                                <div className="absolute bottom-full left-0 right-0 mb-1 bg-gray-900 border border-gray-700 rounded-lg shadow-lg overflow-hidden z-10">
                                    {Object.values(DISPOSAL_TYPES).filter(t => t.id !== 'fire').map(type => (
                                        <button
                                            key={type.id}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleDispose(type.id);
                                            }}
                                            className={`w-full py-2 px-3 text-xs flex items-center gap-2 hover:bg-gray-800 transition-colors ${type.color}`}
                                        >
                                            <Icon name={type.icon} size={14} />
                                            <span className="font-medium">{type.name}</span>
                                            {type.wealthSeized > 0 && (
                                                <span className="opacity-70 ml-auto">没收{(type.wealthSeized * 100).toFixed(0)}%财产</span>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // ========== Full Card ==========
    return (
        <div
            className={`relative bg-gray-800/60 border ${stanceColors.border} rounded-lg p-3 transition-all overflow-hidden shadow-lg ${stanceColors.glow} ${onViewDetail ? 'cursor-pointer hover:border-opacity-100 hover:shadow-emerald-500/10 hover:-translate-y-0.5 hover:ring-1 hover:ring-emerald-400/30' : ''}`}
            onClick={() => {
                if (!isCandidate && onViewDetail) onViewDetail(official);
            }}
        >
            {/* 顶部政治光谱渐变条 */}
            <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${stanceColors.gradient}`} />

            {/* 头部: 姓名, 阶层, 薪俸 + 政治光谱标签 */}
            <div className="flex justify-between items-start mb-2 pt-1 gap-2">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                    <div className={`p-1.5 rounded bg-gray-900/50 ${stratumColor} flex-shrink-0`}>
                        <Icon name={stratumIcon} size={14} />
                    </div>
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1">
                            <div className="font-bold text-gray-200 text-sm leading-tight truncate pr-1">
                                {official.name}
                            </div>
                            {linkedGeneral && (
                                <span className="px-1 py-0.5 bg-amber-900/50 text-amber-300 rounded text-[9px] flex-shrink-0">
                                    🎖️ {isLeadingCorps ? '领军中' : '将领'}
                                </span>
                            )}
                        </div>
                        <div className={`text-[10px] ${stratumColor} opacity-80 flex items-center flex-wrap gap-1.5 mt-0.5`}>
                            {/* 政治光谱小标签 (移至第二行以防重叠) */}
                            <span className={`inline-flex items-center gap-0.5 px-1 py-px rounded text-[8px] font-medium ${stanceColors.bg} ${stanceColors.text} border ${stanceColors.border} flex-shrink-0`}>
                                <Icon name={stanceColors.icon} size={8} />
                                {stanceColors.label}
                            </span>
                            {stance?.name && (
                                <span className="text-[9px] text-gray-300 font-bold ml-1 truncate max-w-[80px] inline-flex items-center gap-0.5" title={stance.description}>
                                    {stance.name}
                                    {isStanceSatisfied !== null && !isCandidate && (
                                        <Icon 
                                            name={isStanceSatisfied ? 'Check' : 'X'} 
                                            size={8} 
                                            className={isStanceSatisfied ? 'text-green-400' : 'text-red-400'}
                                            title={isStanceSatisfied ? '政治主张已满足' : '政治主张未满足'}
                                        />
                                    )}
                                </span>
                            )}
                            <span className="truncate">{stratumDef?.name || stratumKey} 出身</span>
                            {prestigeInfo && <span className={`flex-shrink-0 ${prestigeInfo.color}`}>· {prestigeInfo.name}</span>}
                        </div>
                    </div>
                    <div className="text-right flex-shrink-0 flex flex-col items-end gap-1">
                        {/* 财务信息整合区 */}
                        <div className="bg-gray-900/40 px-2 py-1 rounded border border-gray-700/50">
                            <div className="flex items-center justify-end gap-2 text-xs font-mono">
                                {/* 存款 */}
                                {typeof official.wealth === 'number' && (
                                    <div className="flex items-center gap-1" title="个人存款">
                                        <span className="text-emerald-400 font-bold">{formatNumberShortCN(official.wealth, { decimals: 1 })}</span>
                                        <Icon name="Wallet" size={12} className="text-emerald-500/70" />
                                    </div>
                                )}
                                <span className="text-gray-600">|</span>
                                {/* 薪俸 */}
                                <div className="flex items-center gap-1" title="每日薪俸">
                                    <span className="text-yellow-500">{salary}</span>
                                    <Icon name="Coins" size={12} className="text-yellow-500/70" />
                                </div>
                            </div>
                        </div>

                        {/* 财务状态标签 */}
                        {financialLabel && (
                            <div className={`px-1.5 py-0.5 rounded border text-[9px] font-semibold ${financialStyle}`}>
                                {financialLabel}
                            </div>
                        )}

                        {/* 忠诚度显示 - 仅在任官员显示 */}
                        {!isCandidate && (
                            <div className="mt-1 w-full flex flex-col items-end">
                                <div className="flex items-center gap-1 mb-0.5">
                                    <span className={`text-[9px] font-mono ${loyaltyTextColor}`}>{Math.round(loyalty)}</span>
                                    <Icon name="Heart" size={10} className={loyaltyTextColor} />
                                </div>
                                <div className={`h-1 w-16 bg-gray-700 rounded-full overflow-hidden border ${loyaltyBorderColor}`}>
                                    <div
                                        className={`h-full ${loyaltyColor} transition-all duration-300`}
                                        style={{ width: `${loyalty}%` }}
                                    />
                                </div>
                                {lowLoyaltyDays > 0 && loyalty < 25 && (
                                    <div className="text-[8px] text-red-400 mt-0.5">
                                        ⚠️ 不忠 {lowLoyaltyDays}天
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>


            {/* 分隔线 */}
            <div className="h-px bg-gray-700/50 w-full mb-2" />

            {/* 核心属性显示 */}
            <div className="mb-2">
                <div className="text-[9px] text-gray-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                    <Icon name="BarChart2" size={10} />
                    核心属性
                    {(official.level || 1) > 1 && (
                        <span className="ml-1 px-1 py-0.5 bg-purple-900/50 text-purple-300 rounded text-[8px]">
                            Lv.{official.level || 1}
                        </span>
                    )}
                    {official.ambition > 50 && (
                        <span className="ml-1 px-1 py-0.5 bg-orange-900/50 text-orange-300 rounded text-[8px]" title={`野心: ${official.ambition}`}>
                            <Icon name="Flame" size={8} className="inline" /> {official.ambition}
                        </span>
                    )}
                </div>
                <div className="grid grid-cols-4 gap-1">
                    {/* 行政 */}
                    <div className="flex flex-col items-center p-1 bg-gray-900/40 rounded border border-blue-800/30">
                        <Icon name="Briefcase" size={12} className="text-blue-400 mb-0.5" />
                        <span className="text-[8px] text-gray-500">行政</span>
                        <span className="text-[10px] font-bold text-blue-300">{official.stats?.administrative ?? official.administrative ?? 50}</span>
                    </div>
                    {/* 军事 */}
                    <div className="flex flex-col items-center p-1 bg-gray-900/40 rounded border border-red-800/30">
                        <Icon name="Sword" size={12} className="text-red-400 mb-0.5" />
                        <span className="text-[8px] text-gray-500">军事</span>
                        <span className="text-[10px] font-bold text-red-300">{official.stats?.military ?? official.military ?? 30}</span>
                    </div>
                    {/* 外交 */}
                    <div className="flex flex-col items-center p-1 bg-gray-900/40 rounded border border-green-800/30">
                        <Icon name="Globe" size={12} className="text-green-400 mb-0.5" />
                        <span className="text-[8px] text-gray-500">外交</span>
                        <span className="text-[10px] font-bold text-green-300">{official.stats?.diplomacy ?? official.diplomacy ?? 30}</span>
                    </div>
                    {/* 威望 */}
                    <div className="flex flex-col items-center p-1 bg-gray-900/40 rounded border border-purple-800/30">
                        <Icon name="Award" size={12} className="text-purple-400 mb-0.5" />
                        <span className="text-[8px] text-gray-500">威望</span>
                        <span className="text-[10px] font-bold text-purple-300">{official.stats?.prestige ?? official.prestige ?? 50}</span>
                    </div>
                </div>
            </div>

            {/* 左右两栏布局 */}
            <div className="grid grid-cols-2 gap-2 min-h-[80px]">
                {/* 左栏: 官员效果 */}
                <div className="border-r border-gray-700/30 pr-2">
                    <div className="text-[9px] text-gray-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                        <Icon name="Zap" size={10} />
                        官员能力
                    </div>
                    <div className="space-y-0.5">
                        {official.stratumInfluenceBonus > 0 && (
                            <div className="flex items-center gap-1 text-[10px] text-purple-300">
                                <Icon name="Users" size={10} className="text-purple-400" />
                                <span>{stratumDef?.name}影响力 +{(official.stratumInfluenceBonus * 100).toFixed(0)}%</span>
                            </div>
                        )}
                        {effectItems.length > 0 ? effectItems : (
                            !official.stratumInfluenceBonus && <div className="text-[10px] text-gray-500 italic">无显著效果</div>
                        )}
                    </div>
                </div>

                {/* 右栏: 政治立场 */}
                <div className="pl-1">
                    {stance ? (
                        <>
                            <div className="text-[9px] text-gray-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                                <Icon name="Flag" size={10} />
                                政治立场
                            </div>
                            {/* 立场名称 */}
                            <div className={`flex items-center gap-1 mb-0.5 ${stanceColors.text}`}>
                                <Icon name={stance.icon || 'Flag'} size={12} />
                                <span className="text-[11px] font-semibold">{stance.name}</span>
                            </div>
                            {/* 政治议题 */}
                            {stance.issues && stance.issues.length > 0 && (
                                <div className="text-[9px] text-gray-500 mb-1 flex flex-wrap gap-1">
                                    {stance.issues.slice(0, 3).map(issueId => {
                                        const issue = POLITICAL_ISSUES[issueId];
                                        return issue ? (
                                            <span key={issueId} className="px-1 py-0.5 bg-gray-700/50 rounded text-gray-400">
                                                {issue.name}
                                            </span>
                                        ) : null;
                                    })}
                                </div>
                            )}
                            {/* 触发条件 - 简化显示 */}
                            <div className="mb-1">
                                <span className="text-[9px] text-gray-500">政治主张:</span>
                                <div className="text-[10px] text-gray-300 bg-gray-800/30 p-1.5 rounded border border-gray-700/30 leading-snug break-words mt-0.5">
                                    {official.stanceConditionText || '无'}
                                </div>
                            </div>
                            {/* 满足效果 - 使用官员独特的随机化效果 */}
                            {official.stanceActiveEffects && Object.keys(official.stanceActiveEffects).length > 0 && (
                                <div className="mb-0.5">
                                    <span className="text-[8px] text-green-500 uppercase">满足时:</span>
                                    {renderStanceEffects(official.stanceActiveEffects, true)}
                                </div>
                            )}
                            {/* 不满足惩罚 - 使用官员独特的随机化惩罚 */}
                            {official.stanceUnsatisfiedPenalty && Object.keys(official.stanceUnsatisfiedPenalty).length > 0 && (
                                <div>
                                    <span className="text-[8px] text-red-500 uppercase">未满足:</span>
                                    {renderStanceEffects(official.stanceUnsatisfiedPenalty, false)}
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="text-[10px] text-gray-500 italic">无政治立场</div>
                    )}
                </div>
            </div>

            {propertyCount > 0 && (
                <div className="mt-2 pt-2 border-t border-gray-700/30">
                    <div className="flex items-center gap-1 text-[9px] text-gray-500 uppercase tracking-wider mb-1">
                        <Icon name="Building" size={10} />
                        产业持有
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-gray-300">
                        <span>持有数量: {propertyCount}</span>
                        <span className={`font-mono ${propertyIncome >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
                            日收益 {propertyIncome >= 0 ? '+' : ''}{propertyIncome.toFixed(1)}
                        </span>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                        {propertyEntries.slice(0, 4).map(entry => (
                            <span
                                key={`property-${entry.buildingId}`}
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-gray-800/60 border border-gray-700/60 text-[9px] text-gray-300"
                            >
                                {entry.buildingName} × {entry.count}
                            </span>
                        ))}
                        {propertyEntries.length > 4 && (
                            <span className="text-[9px] text-gray-500">等 {propertyEntries.length} 类</span>
                        )}
                    </div>
                </div>
            )}

            {!isCandidate && onViewDetail && (
                <div className="mt-2 text-[9px] text-gray-500 flex items-center gap-1">
                    <Icon name="Hand" size={10} />
                    点击卡片查看资产与开销
                </div>
            )}

            {/* 操作按钮 */}
            <div className="mt-2 pt-2 border-t border-gray-700/30">
                {isCandidate ? (
                    <button
                        onClick={() => onAction(official.id)}
                        disabled={actionDisabled || !canAfford}
                        className={`w-full py-1 px-2 rounded text-xs font-bold flex items-center justify-center gap-1 transition-colors
                            ${canAfford && !actionDisabled
                                ? 'bg-green-700 hover:bg-green-600 text-white'
                                : 'bg-gray-700 text-gray-400 cursor-not-allowed'}`}
                    >
                        <Icon name="UserPlus" size={12} />
                        雇佣
                    </button>
                ) : (
                    <div className="relative">
                        <div className="flex gap-1">
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if (isLeadingCorps) {
                                        alert('该官员正在领军中，请先在军团面板卸任将领后再解雇。');
                                        return;
                                    }
                                    onAction(official.id);
                                }}
                                disabled={actionDisabled}
                                className="flex-1 py-1 px-2 rounded text-xs font-bold flex items-center justify-center gap-1 transition-colors bg-gray-700/50 hover:bg-gray-600/50 text-gray-300 border border-gray-600/50"
                            >
                                <Icon name="UserMinus" size={12} />
                                解雇
                            </button>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setShowDisposalMenu(!showDisposalMenu);
                                }}
                                className="py-1 px-2 rounded text-xs font-bold flex items-center justify-center transition-colors bg-red-900/30 hover:bg-red-800/50 text-red-400 border border-red-900/50"
                                title="更多处置选项"
                            >
                                <Icon name="ChevronDown" size={12} />
                            </button>
                        </div>

                        <div className="mt-1 text-[9px] text-gray-500 leading-snug">
                            注：解雇/流放会导致其名下产业全部倒闭；处死会将产业转交给原始业主阶层。
                        </div>

                        {showDisposalMenu && (
                            <div className="absolute bottom-full left-0 right-0 mb-1 bg-gray-900 border border-gray-700 rounded-lg shadow-lg overflow-hidden z-10">
                                {Object.values(DISPOSAL_TYPES).filter(t => t.id !== 'fire').map(type => (
                                    <button
                                        key={type.id}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleDispose(type.id);
                                        }}
                                        className={`w-full py-2 px-3 text-xs flex items-center gap-2 hover:bg-gray-800 transition-colors ${type.color}`}
                                    >
                                        <Icon name={type.icon} size={14} />
                                        <span className="font-medium">{type.name}</span>
                                        {type.wealthSeized > 0 && (
                                            <span className="opacity-70 ml-auto">没收{(type.wealthSeized * 100).toFixed(0)}%财产</span>
                                        )}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

// Custom comparison function to prevent unnecessary re-renders
const officialCardPropsAreEqual = (prevProps, nextProps) => {
    // Compare primitive props first (fast)
    if (
        prevProps.isCandidate !== nextProps.isCandidate ||
        prevProps.canAfford !== nextProps.canAfford ||
        prevProps.actionDisabled !== nextProps.actionDisabled ||
        prevProps.currentDay !== nextProps.currentDay ||
        prevProps.isStanceSatisfied !== nextProps.isStanceSatisfied ||
        prevProps.compact !== nextProps.compact ||
        prevProps.generals !== nextProps.generals
    ) {
        return false;
    }

    // Compare official object by key properties that affect rendering
    const prevOfficial = prevProps.official;
    const nextOfficial = nextProps.official;

    if (!prevOfficial && !nextOfficial) return true;
    if (!prevOfficial || !nextOfficial) return false;

    // Compare key official properties
    if (
        prevOfficial.id !== nextOfficial.id ||
        prevOfficial.name !== nextOfficial.name ||
        prevOfficial.salary !== nextOfficial.salary ||
        prevOfficial.loyalty !== nextOfficial.loyalty ||
        prevOfficial.wealth !== nextOfficial.wealth ||
        prevOfficial.level !== nextOfficial.level ||
        prevOfficial.ambition !== nextOfficial.ambition ||
        prevOfficial.stratum !== nextOfficial.stratum ||
        prevOfficial.sourceStratum !== nextOfficial.sourceStratum ||
        prevOfficial.financialSatisfaction !== nextOfficial.financialSatisfaction ||
        prevOfficial.lowLoyaltyDays !== nextOfficial.lowLoyaltyDays ||
        prevOfficial.politicalStance !== nextOfficial.politicalStance ||
        prevOfficial.lastDayPropertyIncome !== nextOfficial.lastDayPropertyIncome
    ) {
        return false;
    }

    // Compare stats object
    const prevStats = prevOfficial.stats;
    const nextStats = nextOfficial.stats;
    if (prevStats !== nextStats) {
        if (!prevStats || !nextStats) return false;
        if (
            prevStats.administrative !== nextStats.administrative ||
            prevStats.military !== nextStats.military ||
            prevStats.diplomacy !== nextStats.diplomacy ||
            prevStats.prestige !== nextStats.prestige
        ) {
            return false;
        }
    }

    // Compare ownedProperties array length (shallow check)
    const prevProps_count = Array.isArray(prevOfficial.ownedProperties) ? prevOfficial.ownedProperties.length : 0;
    const nextProps_count = Array.isArray(nextOfficial.ownedProperties) ? nextOfficial.ownedProperties.length : 0;
    if (prevProps_count !== nextProps_count) {
        return false;
    }

    return true;
};

// Export memoized component with custom comparison
export const OfficialCard = memo(OfficialCardInner, officialCardPropsAreEqual);

export default OfficialCard;
