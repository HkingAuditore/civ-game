/**
 * 理念展示文案格式化纯函数集
 *
 * 从 IdeologyCard.jsx 抽离，供游戏内卡牌、Wiki 详情页、未来诊断面板共用，
 * 确保所有出现理念效果的位置文案保持一致。
 *
 * 设计原则：
 * - 不依赖 React / framer-motion 等运行时
 * - 不依赖 IdeologyCard 内部状态
 * - 仅依赖纯配置（STRATA / IDEOLOGY_MAP）
 */

import { STRATA } from '../config/strata';
import { IDEOLOGY_MAP } from '../config/ideologies';

// ============ 常量与字典 ============

/** 绝对值类效果键（不按百分比展示） */
export const ABSOLUTE_VALUE_KEYS = new Set(['stability', 'flatPop']);

/** 效果键 -> 中文显示名 */
export const EFFECT_LABELS = {
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

/** 建筑分类 -> 中文显示名 */
export const CATEGORY_LABELS = {
    gather: '采集类',
    civic: '市政类',
    industry: '工业类',
    military: '军事类',
};

/** 资源/效果键的展示别名 */
export const RESOURCE_LABELS = {
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

/** 兵种类别 -> 中文显示名 */
export const UNIT_CATEGORY_LABELS = {
    infantry: '步兵',
    cavalry: '骑兵',
    naval: '海军',
    artillery: '炮兵',
    archer: '弓兵',
    siege: '攻城器械',
    all: '全兵种',
};

/** 特定建筑ID -> 中文显示名 */
export const BUILDING_ID_LABELS = {
    temple: '寺庙',
    shrine: '神庙',
    church: '教堂',
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

/** 规则修改类型 -> 中文显示名 */
export const RULE_MOD_LABELS = {
    building_cost_mod: '建筑费用',
    official_bonus: '官员体系效率',
    tax_modifier: '总体税率',
    cooldown_mod: '冷却时间',
    price_volatility_mod: '价格波动',
    tech_cost_mod: '科技费用',
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

/** Converter 来源类型 -> 中文显示名 */
export const CONVERTER_SOURCE_LABELS = {
    resource: '资源',
    buildingCount: '建筑数量',
    officialCount: '官员数量',
    population: '人口',
    stability: '稳定度',
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

/** Converter source 字段的中文名称映射 */
export const CONVERTER_SOURCE_NAME_LABELS = {
    military: '军事类建筑',
    gather: '采集类建筑',
    civic: '市政类建筑',
    industry: '工业类建筑',
    silver: '银币',
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

/** 联动机制类型 -> 中文显示名 */
export const MECHANIC_EFFECT_LABELS = {
    auto_build: '自动建造',
    resource_echo: '资源回声',
    crisis_immunity: '危机免疫',
    epoch_rush: '时代加速',
};

/** 稀有度配置 */
export const RARITY_CONFIG = {
    common:    { label: '普通', color: 'text-gray-400',  borderColor: 'border-gray-600',   bgBadge: 'bg-gray-700/50',   glowClass: '' },
    uncommon:  { label: '稀有', color: 'text-green-400', borderColor: 'border-green-600',  bgBadge: 'bg-green-900/50',  glowClass: '' },
    rare:      { label: '史诗', color: 'text-blue-400',  borderColor: 'border-blue-500',   bgBadge: 'bg-blue-900/50',   glowClass: 'shadow-[0_0_8px_rgba(59,130,246,0.3)]' },
    legendary: { label: '传奇', color: 'text-amber-400', borderColor: 'border-amber-500',  bgBadge: 'bg-amber-900/50',  glowClass: 'shadow-[0_0_12px_rgba(245,158,11,0.4)]' },
};

/** 等级阶段中文标签 */
export const LEVEL_STAGE_LABELS = ['1级', '2级', '3级'];

// ============ 基础工具函数 ============

/** 阶层 key -> 中文名 */
export function getStratumName(key) {
    return STRATA[key]?.name || key;
}

/** 判断是否为绝对值类效果键 */
export function isAbsoluteEffectKey(effectKey) {
    return ABSOLUTE_VALUE_KEYS.has(effectKey) || effectKey?.startsWith('approval_');
}

/** 数值 -> 展示文本（自动判断百分比/绝对值） */
export function formatEffectValue(effectKey, value) {
    if (typeof value !== 'number') return value;
    if (isAbsoluteEffectKey(effectKey)) {
        return `${value > 0 ? '+' : ''}${Number(value.toFixed(2))}`;
    }
    return `${value > 0 ? '+' : ''}${(value * 100).toFixed(0)}%`;
}

/** 数值 -> 带符号百分比 */
export function formatSignedPercent(value) {
    return `${value > 0 ? '+' : ''}${(value * 100).toFixed(1)}%`;
}

/** 数值 -> 带符号绝对值 */
export function formatSignedFlat(value) {
    return `${value > 0 ? '+' : ''}${Number(value.toFixed(2))}`;
}

/** 天数 -> 中文时长（每 360 天归并为年） */
export function formatDuration(days) {
    if (!Number.isFinite(days) || days <= 0) return '';
    if (days >= 360 && days % 360 === 0) return `${days / 360}年`;
    return `${days}天`;
}

// ============ Effects 解析 ============

/**
 * effects 对象 -> 标签数组
 * @returns Array<{ label, value, positive, effectKey }>
 */
export function effectsToTags(effects) {
    if (!effects) return [];
    const tags = [];
    for (const [key, value] of Object.entries(effects)) {
        if (key === 'perPopPassive') continue;
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

/** effects 对象 -> 行内中文描述（逗号分隔） */
export function describeEffectsInline(effects = {}) {
    const tags = effectsToTags(effects);
    if (tags.length === 0) return '';
    return tags.map((tag) => `${tag.label}${formatEffectValue(tag.effectKey, tag.value)}`).join('、');
}

// ============ Converter / Event / TriggerEffect 描述 ============

function getConverterStepOptions(sourceType) {
    switch (sourceType) {
        case 'resource':
            return [10000, 50000, 100000, 500000, 1000000];
        case 'population':
        case 'wealthyPop':
        case 'poorPop':
            return [10000, 50000, 100000, 500000, 1000000];
        case 'unemployment':
        case 'militarySize':
            return [1000, 5000, 10000, 50000, 100000];
        case 'tradeVolume':
            return [1000, 5000, 10000, 50000, 100000];
        case 'buildingCount':
        case 'specificBuilding':
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

export function getConverterDisplayStep(converter) {
    const ratio = Math.abs(converter?.ratio || 0);
    const steps = getConverterStepOptions(converter?.sourceType);
    if (ratio <= 0) return 1;
    return steps.find((step) => ratio * step >= 0.01) || steps[steps.length - 1];
}

export function getConverterSourcePhrase(converter, step) {
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

export function describeConverter(converter) {
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

export function describeEventEffect(effect = {}) {
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

export function describeBonusDetail(bonusObj) {
    if (!bonusObj) return '';
    const parts = [];
    for (const [key, val] of Object.entries(bonusObj)) {
        if (key === 'categories' && typeof val === 'object') {
            for (const [cat, cv] of Object.entries(val)) {
                const catName = CATEGORY_LABELS[cat] || cat;
                parts.push(`${catName}建筑产出${cv > 0 ? '+' : ''}${(cv * 100).toFixed(1)}%`);
            }
        } else if (key === 'perPopPassive' && typeof val === 'object') {
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

export function describeTriggerEffect(te) {
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

// ============ 等级递进/聚合 ============

export function getNewArrayItems(currentItems = [], previousItems = []) {
    const previousSet = new Set(previousItems.map(item => JSON.stringify(item)));
    return currentItems.filter(item => !previousSet.has(JSON.stringify(item)));
}

/**
 * 计算某等级继承自上一级（未新增）的数组项
 */
export function getLevelInheritedItems(levels = [], index = 0, key = '') {
    if (index === 0) return [];
    const currentItems = levels[index]?.[key] || [];
    const previousItems = levels[index - 1]?.[key] || [];
    if (!currentItems.length || !previousItems.length) return [];
    const previousSet = new Set(previousItems.map(item => JSON.stringify(item)));
    return currentItems.filter(item => previousSet.has(JSON.stringify(item)));
}

/**
 * 聚合当前等级及以下所有等级的 triggerEffects
 * 同时合并顶层 ideology.effects.triggerEffects（向后兼容）
 */
export function getAggregatedTriggerEffects(ideology, level) {
    const levels = ideology.effects?.levels || [];
    const topLevel = ideology.effects?.triggerEffects || [];
    const seen = new Set(topLevel.map(te => JSON.stringify(te)));
    const result = [...topLevel];
    for (let i = 0; i < level && i < levels.length; i++) {
        const levelTriggers = levels[i]?.triggerEffects || [];
        for (const te of levelTriggers) {
            const key = JSON.stringify(te);
            if (!seen.has(key)) {
                seen.add(key);
                result.push(te);
            }
        }
    }
    return result;
}

/**
 * 计算某一级相对上一级的增量效果（数值差 + 新增数组项）
 */
export function getLevelIncrementalEffects(levels = [], index = 0) {
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

        if (key === 'onEvents' || key === 'converters' || key === 'ruleMods' || key === 'triggerEffects') {
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
