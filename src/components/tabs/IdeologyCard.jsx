/**
 * 理念卡牌组件
 * 展示单个理念的卡牌，支持装备/卸下/详情展开
 */

import React, { useState, memo } from 'react';
import { Icon } from '../common/UIComponents';
import { IDEOLOGY_CATEGORIES, IDEOLOGY_MAP } from '../../config/ideologies';
import { IDEOLOGY_SYNERGIES, ANTI_SYNERGIES } from '../../config/ideologySynergies';
import { STRATA } from '../../config/strata';
import { EVENT_DISPLAY_NAMES } from '../../logic/ideology/ideologyEventBus';

/**
 * 星级渲染
 */
const LevelStars = ({ level = 1, maxLevel = 3 }) => (
    <div className="flex items-center gap-0.5">
        {Array.from({ length: maxLevel }, (_, i) => (
            <Icon
                key={i}
                name="Star"
                size={10}
                className={i < level ? 'text-yellow-400 fill-yellow-400' : 'text-gray-600'}
            />
        ))}
    </div>
);

/**
 * 效果标签
 * stability / flatPop 是绝对值，其他是百分比
 */
const ABSOLUTE_VALUE_KEYS = new Set(['stability', 'flatPop']);

const EffectTag = ({ label, value, positive = true, effectKey }) => {
    const formatted = typeof value === 'number' ? formatEffectValue(effectKey, value) : value;
    return (
        <span className={`inline-flex items-center text-[10px] px-1.5 py-0.5 rounded ${
            positive ? 'bg-green-900/40 text-green-300' : 'bg-red-900/40 text-red-300'
        }`}>
            {label}: {formatted}
        </span>
    );
};

/**
 * 将效果对象转为可读的标签列表
 */
const EFFECT_LABELS = {
    stability: '稳定度',
    cultureBonus: '文化产出',
    scienceBonus: '科研产出',
    militaryBonus: '全军战力',
    taxIncome: '税收加成',
    maxPop: '人口上限',
    production: '采集/市政产出',
    needsReduction: '需求减免',
    organizationGrowthMod: '组织度增长',
    organizationDecay: '组织度增长',
    flatPop: '人口',
    culture: '文化',
    science: '科研',
    silver: '银币',
    food: '粮食',
    militaryPower: '全军战力',
};

const CATEGORY_LABELS = {
    gather: '采集类',
    civic: '市政类',
    industry: '工业类',
    military: '军事类',
};

const RESOURCE_LABELS = {
    culture: '文化',
    science: '科研',
    silver: '银币',
    food: '粮食',
    stability: '稳定度',
    militaryPower: '全军战力',
    wood: '木材',
    stone: '石材',
    iron: '铁',
    copper: '铜',
    coal: '煤',
    tools: '工具',
    cloth: '布匹',
    head_tax: '人头税',
    all: '全部',
};

/** Get Chinese name for a stratum key */
function getStratumName(key) {
    return STRATA[key]?.name || key;
}

/** 兵种类别翻译 */
const UNIT_CATEGORY_LABELS = {
    infantry: '步兵',
    cavalry: '骑兵',
    naval: '海军',
    artillery: '炮兵',
    archer: '弓兵',
    siege: '攻城器械',
    all: '全兵种',
};

/** 特定建筑ID翻译 */
const BUILDING_ID_LABELS = {
    temple: '寺庙',
    shrine: '神庙',
    ancestral_hall: '祠堂',
    harbor: '港口',
    farm: '农场',
    laboratory: '实验室',
    factory: '工厂',
    barracks: '兵营',
    market: '市场',
    library: '图书馆',
    mine: '矿山',
    workshop: '工坊',
    granary: '粮仓',
    fortress: '要塞',
    palace: '宫殿',
};

const RULE_MOD_LABELS = {
    building_cost_mod: '建筑费用',
    official_bonus: '官员体系效率',
    tax_modifier: '总体税率',
    cooldown_mod: '冷却时间',
    price_volatility_mod: '价格波动',
    tech_cost_mod: '科技费用',
    // V2: 11 new rule mod types
    stratum_output_mod: '阶层产出',
    building_input_mod: '建筑消耗',
    unit_attack_mod: '兵种攻击',
    unit_defense_mod: '兵种防御',
    recruit_cost_mod: '招募费用',
    maintenance_cost_mod: '维护费用',
    corruption_mod: '腐败',
    trade_route_mod: '贸易收益',
    resource_price_mod: '资源价格',
    wages_mod: '阶层工资',
    diplomatic_influence: '外交影响',
};

const CONVERTER_SOURCE_LABELS = {
    resource: '资源',
    buildingCount: '建筑数量',
    officialCount: '官员数量',
    population: '人口',
    stability: '稳定度',
    // V2: 12 new converter source types
    warCount: '战争数',
    friendlyCount: '友好国家',
    vassalCount: '附庸国',
    tradeVolume: '贸易额',
    unemployment: '失业人口',
    legitimacy: '合法性',
    avgApproval: '平均满意度',
    militarySize: '军队规模',
    wealthyPop: '富裕人口',
    poorPop: '贫困人口',
    specificBuilding: '建筑数量',
    unitCategory: '兵种数量',
};

/** 转化器中source字段的中文名称映射 */
const CONVERTER_SOURCE_NAME_LABELS = {
    military: '军事类建筑',
    gather: '采集类建筑',
    civic: '市政类建筑',
    industry: '工业类建筑',
    silver: '銀币',
    culture: '文化',
    science: '科研',
    food: '粮食',
    stability: '稳定度',
    population: '人口',
    official: '官员',
    officialCount: '官员',
    chain: '完整产业链',
    naval: '海军单位',
    infantry: '步兵单位',
    cavalry: '骑兵单位',
};
const MECHANIC_EFFECT_LABELS = {
    auto_build: '自动建造',
    resource_echo: '资源回声',
    crisis_immunity: '危机免疫',
    epoch_rush: '时代加速',
};

/**
 * 稀有度配置：中文名称、颜色、边框色、发光样式
 */
const RARITY_CONFIG = {
    common:    { label: '普通', color: 'text-gray-400',  borderColor: 'border-gray-600',   bgBadge: 'bg-gray-700/50',   glowClass: '' },
    uncommon:  { label: '稀有', color: 'text-green-400', borderColor: 'border-green-600',  bgBadge: 'bg-green-900/50',  glowClass: '' },
    rare:      { label: '史诗', color: 'text-blue-400',  borderColor: 'border-blue-500',   bgBadge: 'bg-blue-900/50',   glowClass: 'shadow-[0_0_8px_rgba(59,130,246,0.3)]' },
    legendary: { label: '传奇', color: 'text-amber-400', borderColor: 'border-amber-500',  bgBadge: 'bg-amber-900/50',  glowClass: 'shadow-[0_0_12px_rgba(245,158,11,0.4)]' },
};

/**
 * Render event-driven effects (onEvents)
 */
function renderOnEvents(onEvents) {
    if (!onEvents?.length) return null;
    return onEvents.map((oe, i) => {
        const eventName = EVENT_DISPLAY_NAMES[oe.event] || oe.event;
        const effectDesc = describeEventEffect(oe.effect);
        const cooldownInfo = oe.cooldownDays ? `；冷却${formatDuration(oe.cooldownDays)}` : '';
        const maxInfo = oe.maxTriggers ? `；最多触发${oe.maxTriggers}次` : '';
        return (
            <p key={i} className="text-[10px] text-amber-300 leading-tight">
                ⚡ 每次{eventName}：{effectDesc}{cooldownInfo}{maxInfo}
            </p>
        );
    });
}

/**
 * Render converter effects
 */
function renderConverters(converters) {
    if (!converters?.length) return null;
    return converters.map((c, i) => {
        return (
            <p key={i} className="text-[10px] text-blue-300 leading-tight">
                🔄 {describeConverter(c)}
            </p>
        );
    });
}

/**
 * Render rule modification effects
 */
function renderRuleMods(ruleMods) {
    if (!ruleMods?.length) return null;
    return ruleMods.map((rm, i) => {
        const label = RULE_MOD_LABELS[rm.type] || rm.type;
        const scopeName = rm.scope && rm.scope !== '_global'
            ? (CATEGORY_LABELS[rm.scope] || RESOURCE_LABELS[rm.scope] || UNIT_CATEGORY_LABELS[rm.scope] || rm.scope)
            : '';
        const scopeText = scopeName ? `(${scopeName})` : '';
        const valText = rm.value > 0 ? `+${(rm.value * 100).toFixed(0)}%` : `${(rm.value * 100).toFixed(0)}%`;
        return (
            <p key={i} className="text-[10px] text-cyan-300 leading-tight">
                ⚙️ {label}{scopeText}: {valText}
            </p>
        );
    });
}

/**
 * Render mechanicEffect for synergy cards
 */
function renderMechanicEffect(me) {
    if (!me) return null;
    const label = MECHANIC_EFFECT_LABELS[me.type] || me.type;
    let detail = '';
    if (me.type === 'auto_build') detail = `每${me.intervalDays}天自动建造 ${me.buildingId}`;
    else if (me.type === 'resource_echo') detail = `获得${me.sourceResource}时额外+${(me.ratio * 100).toFixed(1)}% ${me.echoResource}`;
    else if (me.type === 'crisis_immunity') detail = `免疫 ${EVENT_DISPLAY_NAMES[me.immuneTo] || me.immuneTo}`;
    else if (me.type === 'epoch_rush') detail = `时代升级费用 -${(me.costReduction * 100).toFixed(0)}%`;
    return (
        <p className="text-[10px] text-yellow-300 font-semibold leading-tight">
            🌟 {label}: {detail}
        </p>
    );
}

function effectsToTags(effects) {
    if (!effects) return [];
    const tags = [];
    for (const [key, value] of Object.entries(effects)) {
        if (key === 'perPopPassive') continue;
        // categories 拆解为单独标签
        if (key === 'categories' && typeof value === 'object') {
            for (const [cat, cv] of Object.entries(value)) {
                if (typeof cv === 'number' && cv !== 0) {
                    const catName = CATEGORY_LABELS[cat] || cat;
                    tags.push({ label: `${catName}产出`, value: cv, positive: cv > 0, effectKey: `cat_${cat}` });
                }
            }
            continue;
        }
        if (key === 'approval' && typeof value === 'object') {
            for (const [stratum, approvalValue] of Object.entries(value)) {
                if (typeof approvalValue === 'number' && approvalValue !== 0) {
                    tags.push({
                        label: `${getStratumName(stratum)}满意度`,
                        value: approvalValue,
                        positive: approvalValue > 0,
                        effectKey: `approval_${stratum}`,
                    });
                }
            }
            continue;
        }
        const label = EFFECT_LABELS[key];
        if (label && typeof value === 'number' && value !== 0) {
            tags.push({ label, value, positive: value > 0, effectKey: key });
        }
    }
    return tags;
}

const LEVEL_STAGE_LABELS = ['1级', '2级', '3级'];

function isAbsoluteEffectKey(effectKey) {
    return ABSOLUTE_VALUE_KEYS.has(effectKey) || effectKey?.startsWith('approval_');
}

function formatEffectValue(effectKey, value) {
    if (typeof value !== 'number') return value;
    if (isAbsoluteEffectKey(effectKey)) {
        return `${value > 0 ? '+' : ''}${Number(value.toFixed(2))}`;
    }
    return `${value > 0 ? '+' : ''}${(value * 100).toFixed(0)}%`;
}

function formatSignedPercent(value) {
    return `${value > 0 ? '+' : ''}${(value * 100).toFixed(1)}%`;
}

function formatSignedFlat(value) {
    return `${value > 0 ? '+' : ''}${Number(value.toFixed(2))}`;
}

function formatDuration(days) {
    if (!Number.isFinite(days) || days <= 0) return '';
    if (days >= 360 && days % 360 === 0) return `${days / 360}年`;
    return `${days}天`;
}

function describeEffectsInline(effects = {}) {
    const tags = effectsToTags(effects);
    if (tags.length === 0) return '';
    return tags.map((tag) => `${tag.label}${formatEffectValue(tag.effectKey, tag.value)}`).join('、');
}

function getConverterStepOptions(sourceType) {
    switch (sourceType) {
        case 'resource':
            // 资源储备后期可达上亿，步长从10000起
            return [10000, 50000, 100000, 500000, 1000000];
        case 'population':
        case 'wealthyPop':
        case 'poorPop':
            // 人口后期可达上亿，步长从10000起
            return [10000, 50000, 100000, 500000, 1000000];
        case 'unemployment':
        case 'militarySize':
            return [1000, 5000, 10000, 50000, 100000];
        case 'tradeVolume':
            return [1000, 5000, 10000, 50000, 100000];
        case 'buildingCount':
        case 'specificBuilding':
            // 建筑数量，步长从10起，避免"每1座"
            return [10, 20, 50, 100, 200];
        case 'officialCount':
            return [1, 5, 10, 20, 50];
        case 'stability':
        case 'avgApproval':
        case 'legitimacy':
            return [1, 5, 10, 20];
        default:
            return [5, 10, 20, 50];
    }
}

function getConverterDisplayStep(converter) {
    const ratio = Math.abs(converter?.ratio || 0);
    const steps = getConverterStepOptions(converter?.sourceType);
    if (ratio <= 0) return 1;
    return steps.find((step) => ratio * step >= 0.01) || steps[steps.length - 1];
}

function getConverterSourcePhrase(converter, step) {
    const sourceName = CONVERTER_SOURCE_NAME_LABELS[converter.source] || RESOURCE_LABELS[converter.source] || converter.source;
    switch (converter.sourceType) {
        case 'resource':
            return `每${step}单位${sourceName}储备`;
        case 'buildingCount':
            return `每${step}座${sourceName}`;
        case 'specificBuilding':
            return `每${step}座${sourceName}`;
        case 'officialCount':
            return `每${step}名官员`;
        case 'population':
            if (converter.source && converter.source !== 'population') {
                return `每${step}${getStratumName(converter.source)}人口`;
            }
            return `每${step}总人口`;
        case 'stability':
            return `每${step}点稳定度`;
        case 'warCount':
            return `每${step}场战争`;
        case 'friendlyCount':
            return `每${step}个友好国家`;
        case 'vassalCount':
            return `每${step}个附庸`;
        case 'tradeVolume':
            return `每${step}点贸易额`;
        case 'unemployment':
            return `每${step}失业人口`;
        case 'legitimacy':
            return `每${step}点合法性`;
        case 'avgApproval':
            return `每${step}点平均满意度`;
        case 'militarySize':
            return `每${step}军队规模`;
        case 'wealthyPop':
            return `每${step}富裕人口`;
        case 'poorPop':
            return `每${step}贫困人口`;
        case 'chainCount':
            return `每${step}条完整产业链`;
        case 'unitCategory':
            return `每${step}个${sourceName}`;
        default:
            return `每${step}${sourceName}`;
    }
}

function describeConverter(converter) {
    const step = getConverterDisplayStep(converter);
    const targetLabel = EFFECT_LABELS[converter.target] || RESOURCE_LABELS[converter.target] || converter.target;
    const deltaValue = (converter.ratio || 0) * step;
    const deltaText = isAbsoluteEffectKey(converter.target)
        ? formatSignedFlat(deltaValue)
        : formatSignedPercent(deltaValue);
    const capText = converter.cap != null
        ? `（上限${isAbsoluteEffectKey(converter.target) ? formatSignedFlat(converter.cap) : `${(converter.cap * 100).toFixed(0)}%`}）`
        : '';
    return `${getConverterSourcePhrase(converter, step)}: ${targetLabel}${deltaText}${capText}`;
}

function describeEventEffect(effect = {}) {
    if (!effect?.action) return '';
    if (effect.action === 'addResource') {
        const resourceName = RESOURCE_LABELS[effect.resource] || effect.resource;
        return `获得${resourceName}${formatSignedFlat(effect.amount || 0)}`;
    }
    if (effect.action === 'addStability') {
        return `稳定度${formatSignedFlat(effect.amount || 0)}`;
    }
    if (effect.action === 'addBuff') {
        const durationText = formatDuration(effect.duration || 0);
        const effectText = describeEffectsInline(effect.effects || {});
        return `获得「${effect.name || '理念效果'}」${durationText}${effectText ? `：${effectText}` : ''}`;
    }
    if (effect.action === 'addIdeologyScore') {
        return `理念分数${formatSignedFlat(effect.amount || 0)}`;
    }
    if (effect.action === 'modifyBonus') {
        const targetLabel = EFFECT_LABELS[effect.bonusKey] || RULE_MOD_LABELS[effect.bonusKey] || effect.bonusKey || '效果';
        return `${targetLabel}${formatSignedPercent(effect.amount || 0)}`;
    }
    return effect.action;
}

function getNewArrayItems(currentItems = [], previousItems = []) {
    const previousSet = new Set(previousItems.map(item => JSON.stringify(item)));
    return currentItems.filter(item => !previousSet.has(JSON.stringify(item)));
}

function getLevelIncrementalEffects(levels = [], index = 0) {
    const currentEffects = levels[index] || {};
    if (index === 0) return currentEffects;

    const previousEffects = levels[index - 1] || {};
    const delta = {};

    for (const [key, value] of Object.entries(currentEffects)) {
        if (key === 'categories' && typeof value === 'object') {
            const categoryDelta = {};
            const previousCategories = previousEffects.categories || {};
            for (const [category, amount] of Object.entries(value)) {
                const diff = amount - (previousCategories[category] || 0);
                if (diff !== 0) {
                    categoryDelta[category] = diff;
                }
            }
            if (Object.keys(categoryDelta).length > 0) {
                delta.categories = categoryDelta;
            }
            continue;
        }

        if (key === 'approval' && typeof value === 'object') {
            const approvalDelta = {};
            const previousApproval = previousEffects.approval || {};
            for (const [stratum, amount] of Object.entries(value)) {
                const diff = amount - (previousApproval[stratum] || 0);
                if (diff !== 0) {
                    approvalDelta[stratum] = diff;
                }
            }
            if (Object.keys(approvalDelta).length > 0) {
                delta.approval = approvalDelta;
            }
            continue;
        }

        if (key === 'onEvents' || key === 'converters' || key === 'ruleMods') {
            const newItems = getNewArrayItems(value || [], previousEffects[key] || []);
            if (newItems.length > 0) {
                delta[key] = newItems;
            }
            continue;
        }

        if (typeof value === 'number') {
            const diff = value - (previousEffects[key] || 0);
            if (diff !== 0) {
                delta[key] = diff;
            }
        }
    }

    return delta;
}

/**
 * 查找与当前理念相关的联动
 */
function findRelevantSynergies(ideologyId, equippedIds = []) {
    return IDEOLOGY_SYNERGIES.filter(s =>
        s.required.includes(ideologyId)
    ).map(s => ({
        ...s,
        isActive: s.required.every(id => equippedIds.includes(id)),
        missingCount: s.required.filter(id => !equippedIds.includes(id)).length,
    }));
}

/**
 * 理念卡牌组件
 */
const IdeologyCardComponent = ({
    ideology,          // 理念配置对象
    level = 1,         // 当前等级
    isEquipped = false, // 是否已装备
    isInCollection = true, // 是否在收藏中
    cooldownRemaining = 0, // 冷却剩余天数
    equippedIds = [],  // 所有已装备理念ID
    activeBuffs = [],  // 当前激活的限时buff列表
    onEquip,           // 装备回调
    onUnequip,         // 卸下回调
    compact = false,   // 紧凑模式（用于卡槽展示）
    isCandidate = false, // 是否是涌现候选（三选一模式）
    isSelected = false,  // 是否被选中（三选一模式）
    onSelect,          // 候选选择回调
    showProgressionPreview = false,
    onCardClick = null,
    showCollectionActions = true,
    customAction = null,
}) => {
    const [expanded, setExpanded] = useState(false);
    const [candidateExpanded, setCandidateExpanded] = useState(false);

    if (!ideology) return null;

    const category = IDEOLOGY_CATEGORIES[ideology.category] || {};
    const rarity = RARITY_CONFIG[ideology.rarity] || RARITY_CONFIG.common;
    // 候选模式下 level 可能为 0（新理念），此时展示 1 级效果
    const displayLevel = level > 0 ? level : 1;
    const currentEffects = ideology.effects?.levels?.[displayLevel - 1] || {};
    const tags = effectsToTags(currentEffects);
    const synergies = findRelevantSynergies(ideology.id, equippedIds);
    const hasCooldown = cooldownRemaining > 0;
    const showDetails = (expanded || showProgressionPreview) && !compact && !isCandidate;
    const showCandidateProgress = showProgressionPreview && isCandidate;

    // 查找该理念当前激活的限时buff
    const myActiveBuffs = activeBuffs.filter(b => b.ideologyId === ideology.id);

    // 候选模式下的点击
    const handleClick = () => {
        if (onCardClick) {
            onCardClick(ideology);
            return;
        }
        if (isCandidate && onSelect) {
            onSelect(ideology.id);
        } else if (!compact) {
            setExpanded(prev => !prev);
        }
    };

    return (
        <div
            onClick={handleClick}
            className={`relative rounded-xl border transition-all cursor-pointer overflow-hidden ${
                isCandidate
                    ? isSelected
                        ? 'border-yellow-400 shadow-[0_0_0_2px_rgba(250,204,21,0.5),0_0_24px_rgba(250,204,21,0.35)] ring-2 ring-yellow-400/40'
                        : `${rarity.borderColor} hover:border-gray-400 hover:shadow-lg ${rarity.glowClass}`
                    : isEquipped
                        ? 'border-green-500/60 shadow-glow-gold'
                        : hasCooldown
                            ? 'border-gray-700 opacity-60'
                            : `${rarity.borderColor} hover:border-gray-400 ${rarity.glowClass}`
            } ${compact ? 'p-1.5' : 'p-2.5'}`}
            style={{
                background: `linear-gradient(135deg, rgba(0,0,0,0.7), ${category.bgClass ? '' : 'rgba(30,30,50,0.8)'})`,
            }}
        >
            {/* 分类色条 */}
            <div className={`absolute top-0 left-0 right-0 h-0.5 ${category.bgClass || 'bg-gray-700'}`}
                 style={{ opacity: 0.8 }} />

            {/* 头部：图标 + 名称 + 星级 */}
            <div className="flex items-start gap-2 mb-1">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${category.bgClass || 'bg-gray-800'}`}>
                    <Icon name={ideology.icon || 'Circle'} size={14} className={category.color || 'text-gray-300'} />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                        <span className="text-sm font-bold text-white leading-tight break-words whitespace-normal line-clamp-2">
                            {ideology.name}
                        </span>
                        <div className="flex flex-col items-end gap-1 flex-shrink-0">
                            <div className="flex items-center gap-1">
                                <LevelStars level={level} />
                                <span className={`text-[9px] px-1 py-0 rounded ${rarity.bgBadge} ${rarity.color} border ${rarity.borderColor}/40 font-semibold`}>
                                    {rarity.label}
                                </span>
                            </div>
                            {isEquipped && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-900/50 text-green-300 border border-green-700/50">
                                    装备中
                                </span>
                            )}
                            {hasCooldown && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-orange-900/50 text-orange-300 border border-orange-700/50">
                                    冷却 {cooldownRemaining}天
                                </span>
                            )}
                        </div>
                    </div>
                    {!compact && (
                        <span className={`text-[10px] ${category.color || 'text-gray-400'}`}>
                            {category.name || ideology.category}
                        </span>
                    )}
                </div>
            </div>

            {/* 描述 */}
            {!compact && (
                <p className="text-xs text-gray-400 mb-1.5 line-clamp-2">{ideology.desc}</p>
            )}

            {/* 效果标签 */}
            {tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-1.5">
                    {tags.slice(0, compact ? 3 : 6).map((tag, i) => (
                        <EffectTag key={i} {...tag} />
                    ))}
                    {tags.length > (compact ? 3 : 6) && (
                        <span className="text-[10px] text-gray-500">+{tags.length - (compact ? 3 : 6)}</span>
                    )}
                </div>
            )}

            {/* 当前激活的限时buff标记 */}
            {!compact && myActiveBuffs.length > 0 && (
                <div className="mb-1.5 space-y-0.5">
                    {myActiveBuffs.map((buff, i) => (
                        <div key={buff.buffId || i} className="flex items-center gap-1.5 px-1.5 py-1 rounded bg-amber-900/30 border border-amber-500/40">
                            <Icon name="Sparkles" size={10} className="text-amber-400 flex-shrink-0" />
                            <span className="text-[10px] text-amber-200 font-semibold flex-1">{buff.name} 生效中</span>
                            <span className="text-[10px] text-amber-400">剩{buff.duration}天</span>
                        </div>
                    ))}
                </div>
            )}

            {/* 特殊效果摘要 — 始终显示（非紧凑模式） */}
            {!compact && (currentEffects.onEvents?.length > 0 || currentEffects.converters?.length > 0 || currentEffects.ruleMods?.length > 0) && (
                <div className="mb-1.5 space-y-0.5">
                    {renderOnEvents(currentEffects.onEvents)}
                    {renderConverters(currentEffects.converters)}
                    {renderRuleMods(currentEffects.ruleMods)}
                </div>
            )}

            {/* 条件触发效果摘要 — 始终显示 */}
            {ideology.effects?.triggerEffects?.length > 0 && (
                <div className="mb-1.5">
                    {ideology.effects.triggerEffects.slice(0, compact ? 1 : isCandidate ? 2 : 3).map((te, i) => (
                        <p key={i} className="text-[10px] text-purple-300 leading-tight">
                            <Icon name="Zap" size={9} className="inline text-purple-400 mr-0.5" />
                            {describeTriggerEffect(te)}
                        </p>
                    ))}
                    {ideology.effects.triggerEffects.length > (compact ? 1 : isCandidate ? 2 : 3) && (
                        <p className="text-[10px] text-gray-500 leading-tight">
                            +{ideology.effects.triggerEffects.length - (compact ? 1 : isCandidate ? 2 : 3)} 个特殊效果
                        </p>
                    )}
                </div>
            )}

            {/* 联动提示 */}
            {!compact && synergies.length > 0 && (
                <div className="mb-1.5">
                    {synergies.map(s => {
                        const partnerNames = (s.required || [])
                            .filter(id => id !== ideology.id)
                            .map(id => IDEOLOGY_MAP[id]?.name || id)
                            .join(' + ');
                        return (
                            <div key={s.id} className={`flex items-start gap-1 text-[10px] ${
                                s.isActive ? 'text-yellow-300' : 'text-gray-500'
                            } ${s.mechanicEffect ? 'border-l-2 border-yellow-500/60 pl-1' : ''}`}>
                                <Icon name={s.isActive ? 'Zap' : 'Link'} size={10} className="mt-0.5 flex-shrink-0" />
                                <div>
                                    <span>{s.name}</span>
                                    {!s.isActive && partnerNames && (
                                        <span className="text-gray-600 ml-1">({partnerNames})</span>
                                    )}
                                    {s.isActive && s.mechanicEffect && renderMechanicEffect(s.mechanicEffect)}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* 操作按钮 */}
            {!isCandidate && (isInCollection || customAction) && (showCollectionActions || customAction) && (
                <div className="flex gap-1.5 mt-1">
                    {showCollectionActions && (
                        isEquipped ? (
                            <button
                                onClick={(e) => { e.stopPropagation(); onUnequip?.(ideology.id); }}
                                disabled={hasCooldown}
                                className={`flex-1 px-2 py-1 rounded text-xs font-semibold transition-all ${
                                    hasCooldown
                                        ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                                        : 'bg-red-800/60 hover:bg-red-700/80 text-red-200 border border-red-600/40'
                                }`}
                            >
                                卸下
                            </button>
                        ) : (
                            <button
                                onClick={(e) => { e.stopPropagation(); onEquip?.(ideology.id); }}
                                disabled={hasCooldown}
                                className={`flex-1 px-2 py-1 rounded text-xs font-semibold transition-all ${
                                    hasCooldown
                                        ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                                        : 'bg-blue-800/60 hover:bg-blue-700/80 text-blue-200 border border-blue-600/40'
                                }`}
                            >
                                装备
                            </button>
                        )
                    )}
                    {customAction && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                if (!customAction.disabled) {
                                    customAction.onClick?.(ideology.id);
                                }
                            }}
                            disabled={customAction.disabled}
                            className={`flex-1 px-2 py-1 rounded text-xs font-semibold transition-all ${
                                customAction.disabled
                                    ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                                    : (customAction.className || 'bg-purple-800/60 hover:bg-purple-700/80 text-purple-100 border border-purple-600/40')
                            }`}
                        >
                            {customAction.label || '确认'}
                        </button>
                    )}
                </div>
            )}

            {/* 展开详情 */}
            {showDetails && (
                <div className="mt-2 pt-2 border-t border-gray-700/50 space-y-2 animate-fade-in">
                    {/* 史实背景 */}
                    {ideology.lore && (
                        <div className="bg-gray-900/60 rounded p-2">
                            {/* <p className="text-[10px] text-gray-400 mb-0.5">史实背景</p> */}
                            <p className="text-xs text-gray-300 italic">{ideology.lore}</p>
                        </div>
                    )}

                    {/* 各等级效果 */}
                    <div className="bg-gray-900/60 rounded p-2">
                        <p className="text-[10px] text-gray-400 mb-1">效果递进</p>
                        {ideology.effects?.levels?.map((lvlEffect, i) => {
                            const levelDiff = getLevelIncrementalEffects(ideology.effects.levels, i);
                            const lvlTags = effectsToTags(levelDiff);
                            return (
                                <div key={i} className={`mb-1.5 ${i + 1 === level ? 'opacity-100' : 'opacity-50'}`}>
                                    <div className="flex items-start gap-1.5">
                                        <div className="flex items-center gap-1.5 min-w-[74px]">
                                            <LevelStars level={i + 1} />
                                            <span className="text-[10px] text-gray-500">
                                                {LEVEL_STAGE_LABELS[i] || `${i + 1}级`}
                                            </span>
                                        </div>
                                        <div className="flex flex-wrap gap-1">
                                            {lvlTags.map((tag, j) => <EffectTag key={j} {...tag} />)}
                                            {lvlTags.length === 0 && !(levelDiff.onEvents?.length > 0 || levelDiff.converters?.length > 0 || levelDiff.ruleMods?.length > 0) && (
                                                <span className="text-[10px] text-gray-500">无新增数值</span>
                                            )}
                                        </div>
                                    </div>
                                    {/* New effect types for this level */}
                                    {(levelDiff.onEvents?.length > 0 || levelDiff.converters?.length > 0 || levelDiff.ruleMods?.length > 0) && (
                                        <div className="ml-6 mt-0.5 space-y-0.5">
                                            {renderOnEvents(levelDiff.onEvents)}
                                            {renderConverters(levelDiff.converters)}
                                            {renderRuleMods(levelDiff.ruleMods)}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {/* 条件触发效果 */}
                    {ideology.effects?.triggerEffects?.length > 0 && (
                        <div className="bg-purple-900/30 rounded p-2">
                            <p className="text-[10px] text-gray-400 mb-0.5">特殊效果</p>
                            {ideology.effects.triggerEffects.map((te, i) => (
                                <p key={i} className="text-xs text-purple-300">
                                    {describeTriggerEffect(te)}
                                </p>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {showCandidateProgress && (
                <div className="mt-2 pt-2 border-t border-gray-700/50">
                    <button
                        onClick={(e) => { e.stopPropagation(); setCandidateExpanded(prev => !prev); }}
                        className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-gray-200 transition-colors w-full"
                    >
                        <span>成长路线</span>
                        <Icon name={candidateExpanded ? 'ChevronUp' : 'ChevronDown'} size={12} className="text-gray-500" />
                    </button>
                    {candidateExpanded && (
                        <div className="mt-1.5 space-y-1.5">
                            {ideology.effects?.levels?.map((_, i) => {
                                const levelDiff = getLevelIncrementalEffects(ideology.effects.levels, i);
                                const lvlTags = effectsToTags(levelDiff);
                                return (
                                    <div key={i} className="rounded-lg bg-black/25 px-2 py-1.5">
                                        <div className="flex items-center gap-2 mb-1">
                                            <LevelStars level={i + 1} />
                                            <span className="text-[10px] text-gray-400">{LEVEL_STAGE_LABELS[i] || `${i + 1}级`}</span>
                                        </div>
                                        <div className="flex flex-wrap gap-1">
                                            {lvlTags.map((tag, j) => <EffectTag key={j} {...tag} />)}
                                        </div>
                                        {(levelDiff.onEvents?.length > 0 || levelDiff.converters?.length > 0 || levelDiff.ruleMods?.length > 0) && (
                                            <div className="mt-1 space-y-0.5">
                                                {renderOnEvents(levelDiff.onEvents)}
                                                {renderConverters(levelDiff.converters)}
                                                {renderRuleMods(levelDiff.ruleMods)}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* 候选升级预览 */}
            {isCandidate && ideology.isUpgrade && (
                <div className="mt-1 pt-1 border-t border-gray-700/30">
                    <span className="text-[10px] text-yellow-400">
                        ⬆ 升级至 {ideology.nextLevel} 级
                    </span>
                </div>
            )}
        </div>
    );
};

/**
 * 将触发效果转为可读描述
 */
function describeBonusDetail(bonusObj) {
    if (!bonusObj) return '';
    const parts = [];
    for (const [key, val] of Object.entries(bonusObj)) {
        if (key === 'categories' && typeof val === 'object') {
            for (const [cat, cv] of Object.entries(val)) {
                const catName = CATEGORY_LABELS[cat] || cat;
                parts.push(`${catName}建筑产出${cv > 0 ? '+' : ''}${(cv * 100).toFixed(1)}%`);
            }
        } else if (key === 'perPopPassive' && typeof val === 'object') {
            // 处理 perPopPassive 对象：每人口的被动产出
            for (const [resKey, amount] of Object.entries(val)) {
                const resName = RESOURCE_LABELS[resKey] || EFFECT_LABELS[resKey] || resKey;
                parts.push(`每人口+${amount} ${resName}`);
            }
        } else if (key === 'approval' && typeof val === 'object') {
            for (const [stratumKey, amount] of Object.entries(val)) {
                parts.push(`${getStratumName(stratumKey)}满意度${formatSignedFlat(amount)}`);
            }
        } else if (key === 'flatPop') {
            parts.push(`人口${val > 0 ? '+' : ''}${val}`);
        } else if (ABSOLUTE_VALUE_KEYS.has(key)) {
            const label = EFFECT_LABELS[key] || key;
            parts.push(`${label}${val > 0 ? '+' : ''}${val}`);
        } else {
            const label = EFFECT_LABELS[key] || key;
            const pct = typeof val === 'number' ? (val > 0 ? `+${(val * 100).toFixed(1)}%` : `${(val * 100).toFixed(1)}%`) : val;
            parts.push(`${label}${pct}`);
        }
    }
    return parts.join('、');
}

function describeTriggerEffect(te) {
    switch (te.type) {
        case 'stratum_bonus': {
            const stratumName = getStratumName(te.stratum);
            const bonusParts = [];
            if (te.bonus?.perPopPassive) {
                for (const [resKey, amount] of Object.entries(te.bonus.perPopPassive)) {
                    const resName = RESOURCE_LABELS[resKey] || EFFECT_LABELS[resKey] || resKey;
                    bonusParts.push(`每人口+${amount} ${resName}`);
                }
            }
            const detail = bonusParts.length > 0 ? `(${bonusParts.join('、')})` : '';
            return `${stratumName}阶层提供被动产出${detail}`;
        }
        case 'pop_ratio_bonus': {
            const stratumName = getStratumName(te.stratum);
            const targetName = EFFECT_LABELS[te.target] || RESOURCE_LABELS[te.target] || te.target;
            return `${stratumName}人口的${(te.ratio * 100).toFixed(1)}%转化为${targetName}`;
        }
        case 'chain_count_bonus': {
            const detail = describeBonusDetail(te.perCount);
            return `每条完整产业链: ${detail || '额外加成'}`;
        }
        case 'tech_count_bonus': {
            const detail = describeBonusDetail(te.perTech);
            return `每项已研发科技: ${detail || '额外加成'}`;
        }
        case 'resource_threshold': {
            const resName = RESOURCE_LABELS[te.resource] || te.resource;
            // Handle above/below dual-threshold format
            if (te.above || te.below) {
                const parts = [];
                if (te.above) {
                    const aboveDetail = describeBonusDetail(te.above.bonus);
                    parts.push(`${resName}≥${te.above.threshold}: ${aboveDetail}`);
                }
                if (te.below) {
                    const belowDetail = describeBonusDetail(te.below.bonus);
                    parts.push(`${resName}≤${te.below.threshold}: ${belowDetail}`);
                }
                return parts.join('；') || '资源阈值效果';
            }
            // Single threshold format
            const detail = describeBonusDetail(te.bonus);
            return `${resName}达到${te.threshold}时: ${detail || '触发额外效果'}`;
        }
        case 'building_count_bonus': {
            const detail = describeBonusDetail(te.bonus);
            const catName = CATEGORY_LABELS[te.category] || te.category;
            return `每${te.per}个${catName}建筑: ${detail || '额外加成'}`;
        }
        case 'epoch_scaling': {
            const detail = describeBonusDetail(te.perEpoch);
            return `每个时代: ${detail || '效果递增'}`;
        }
        case 'inverse_scaling': {
            const sourceName = EFFECT_LABELS[te.source] || RESOURCE_LABELS[te.source] || te.source;
            const aboveDetail = te.aboveBonus ? describeBonusDetail(te.aboveBonus) : '';
            const belowDetail = te.belowBonus ? describeBonusDetail(te.belowBonus) : '';
            const parts = [];
            if (aboveDetail) parts.push(`高于${te.threshold}时每点${aboveDetail}`);
            if (belowDetail) parts.push(`低于${te.threshold}时每点${belowDetail}`);
            return `${sourceName}${parts.join('；')}`;
        }
        case 'mutual_exclusion': {
            const conflictNames = (te.conflictsWith || []).map(id => {
                const ideo = IDEOLOGY_MAP[id];
                return ideo ? ideo.name : id;
            }).join('、');
            const penaltyDetail = te.penalty ? describeBonusDetail(te.penalty) : '';
            const pureDetail = te.bonusIfPure ? describeBonusDetail(te.bonusIfPure) : '';
            let desc = `与「${conflictNames}」互斥`;
            if (penaltyDetail) desc += `，冲突时: ${penaltyDetail}`;
            if (pureDetail) desc += `；无冲突时: ${pureDetail}`;
            return desc;
        }
        case 'diminishing_returns': {
            const catName = CATEGORY_LABELS[te.category] || te.category || '同类';
            const threshold = te.threshold || 1;
            const perExtraDetail = te.perExtra ? describeBonusDetail(te.perExtra) : '';
            return `装备超过${threshold}个${catName}理念时，每多1个: ${perExtraDetail || '效果递减'}`;
        }
        case 'conditional_flip': {
            const CONDITION_LABELS = {
                isAtWar: '处于战争状态',
                stability_below: `稳定度低于${te.threshold ?? 0}`,
                stability_above: `稳定度高于${te.threshold ?? 0}`,
                epoch_above: `时代超过${te.threshold ?? 0}`,
                population_above: `人口超过${te.threshold ?? 0}`,
                treasury_below: `国库低于${te.threshold ?? 0}`,
            };
            const condName = CONDITION_LABELS[te.condition] || te.condition;
            const normalDetail = te.normalBonus ? describeBonusDetail(te.normalBonus) : '';
            const flippedDetail = te.flippedBonus ? describeBonusDetail(te.flippedBonus) : '';
            const parts = [];
            if (normalDetail) parts.push(`正常时: ${normalDetail}`);
            if (flippedDetail) parts.push(`${condName}时: ${flippedDetail}`);
            return `条件翻转 — ${parts.join('；')}`;
        }
        // V2: 5 new trigger effect descriptions
        case 'approval_threshold_bonus': {
            const stratumName = getStratumName(te.stratum);
            const bonusDetail = describeBonusDetail(te.bonus);
            const dir = te.invert ? '<' : '≥';
            return `${stratumName}满意度${dir}${te.threshold}时: ${bonusDetail || '额外加成'}`;
        }
        case 'building_specific_bonus': {
            const bonusDetail = describeBonusDetail(te.bonus);
            const bName = BUILDING_ID_LABELS[te.buildingId] || te.buildingId || '建筑';
            return `每${te.per || 1}座${bName}: ${bonusDetail || '额外加成'}`;
        }
        case 'unit_count_bonus': {
            const bonusDetail = describeBonusDetail(te.bonus);
            const catName = UNIT_CATEGORY_LABELS[te.category] || te.category || '兵种';
            return `每${te.per || 1}个${catName}: ${bonusDetail || '额外加成'}`;
        }
        case 'coalition_diversity_bonus': {
            const bonusDetail = describeBonusDetail(te.perStratum);
            return `联盟每增加1个阶层: ${bonusDetail || '额外加成'}`;
        }
        case 'official_faction_bonus': {
            const bonusDetail = describeBonusDetail(te.bonus);
            const fName = te.faction || '派系';
            return `每${te.per || 1}个${fName}官员: ${bonusDetail || '额外加成'}`;
        }
        case 'resource_drain': {
            const resName = RESOURCE_LABELS[te.resource] || te.resource;
            const drain = te.drainPerTick || 0;
            const bonusDetail = te.bonus ? describeBonusDetail(te.bonus) : '';
            const penaltyDetail = te.penaltyIfDrained ? describeBonusDetail(te.penaltyIfDrained) : '';
            let desc = `每日消耗${drain}${resName}`;
            if (bonusDetail) desc += `，充足时: ${bonusDetail}`;
            if (penaltyDetail) desc += `；不足时: ${penaltyDetail}`;
            return desc;
        }
        default:
            return `特殊效果: ${te.type}`;
    }
}

export const IdeologyCard = memo(IdeologyCardComponent);
