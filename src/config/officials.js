/**
 * 官员系统配置
 * 定义官员效果、姓名库及生成逻辑
 */

import { STRATA } from './strata.js';
import { RESOURCES } from './gameConstants.js';
import { assignPoliticalStance, getStanceInfo } from './politicalStances.js';

// ========== 效果类型定义 ==========
// 设计原则：每种效果类型都应该能显著影响玩家的游戏风格和决策
// 扩展时只需在此处添加新类型，系统会自动识别并应用

export const OFFICIAL_EFFECT_TYPES = {
    // ============ 生产类效果 ============
    // 建筑产出加成
    building_boost: {
        type: 'buildings',
        category: 'production',
        targets: [
            'farm', 'large_estate', 'lumber_camp', 'quarry', 'mine', 'copper_mine',
            'coal_mine', 'sawmill', 'brickworks', 'factory', 'steel_foundry',
            'loom_house', 'furniture_workshop', 'tailor_workshop', 'brewery',
            'market', 'trade_port', 'trading_post', 'dockyard',
            'library', 'church', 'barracks', 'training_ground', 'fortress'
        ],
        valueRange: [0.08, 0.35], // +8% ~ +35% (大幅提升)
        weight: 25,
        costMultiplier: 1.0,
        description: (val, target) => `${target} 产出 +${(val * 100).toFixed(0)}%`,
    },

    // 类别产出加成
    category_boost: {
        type: 'categories',
        category: 'production',
        targets: ['gather', 'industry', 'civic', 'military'],
        valueRange: [0.06, 0.30], // 大幅提升
        weight: 20,
        costMultiplier: 1.2,
        description: (val, target) => `${target}类建筑产出 +${(val * 100).toFixed(0)}%`,
    },

    // 战时产出加成
    wartime_production: {
        type: 'wartimeProduction',
        category: 'production',
        valueRange: [0.12, 0.40], // 大幅提升
        weight: 12,
        costMultiplier: 1.3,
        description: (val) => `战时产出 +${(val * 100).toFixed(0)}%`,
    },

    // ============ 经济类效果 ============
    // 贸易利润加成
    trade_bonus: {
        type: 'tradeBonus',
        category: 'economy',
        valueRange: [0.12, 0.40], // 大幅提升
        weight: 15,
        costMultiplier: 1.4,
        description: (val) => `贸易利润 +${(val * 100).toFixed(0)}%`,
    },

    // 税收效率加成
    tax_efficiency: {
        type: 'taxEfficiency',
        category: 'economy',
        valueRange: [0.06, 0.25], // 大幅提升
        weight: 15,
        costMultiplier: 1.5,
        description: (val) => `税收效率 +${(val * 100).toFixed(0)}%`,
    },

    // 建筑成本降低
    building_cost_reduction: {
        type: 'buildingCostMod',
        category: 'economy',
        valueRange: [-0.35, -0.10], // 大幅提升
        weight: 12,
        costMultiplier: 1.2,
        description: (val) => `建筑成本 ${(val * 100).toFixed(0)}%`,
    },

    // 生产原料成本降低（只影响有input和output的建筑）
    production_input_cost: {
        type: 'productionInputCost',
        category: 'economy',
        targets: [
            'sawmill', 'brickworks', 'reed_works', 'brewery', 'furniture_workshop',
            'culinary_kitchen', 'loom_house', 'dye_works', 'tailor_workshop',
            'bronze_foundry', 'iron_tool_workshop', 'steel_foundry', 'wool_workshop',
            'factory', 'printing_house'
        ],
        valueRange: [-0.30, -0.08], // -8% ~ -30% 原料消耗 (大幅提升)
        weight: 18, // 提高权重，使效果更容易出现
        costMultiplier: 1.1,
        description: (val, target) => `${target}原料消耗 ${(val * 100).toFixed(0)}%`,
    },

    // 税收收入加成
    income_percent: {
        type: 'incomePercent',
        category: 'economy',
        valueRange: [0.06, 0.22], // 大幅提升
        weight: 12,
        costMultiplier: 1.5,
        description: (val) => `税收收入 +${(val * 100).toFixed(0)}%`,
    },

    // 固定被动产出
    passive_gain: {
        type: 'passive',
        category: 'economy',
        targets: ['food', 'silver', 'culture', 'science'],
        valueRange: [50, 2500], // 大幅提升，配合时代缩放
        weight: 10,
        costMultiplier: 1.5,
        description: (val, target) => `每日 ${target} +${val.toFixed(1)}`,
    },

    // 百分比被动加成
    passive_percent: {
        type: 'passivePercent',
        category: 'economy',
        targets: ['silver', 'food'],
        valueRange: [0.06, 0.28], // 大幅提升
        weight: 12,
        costMultiplier: 1.3,
        description: (val, target) => `${target} 产出 +${(val * 100).toFixed(0)}%`,
    },

    // ============ 需求/资源类效果 ============
    // 阶层需求修正 (负值 = 降低需求 = 好)
    stratum_demand: {
        type: 'stratumDemandMod',
        category: 'needs',
        targets: Object.keys(STRATA),
        valueRange: [-0.35, -0.10], // 大幅提升
        weight: 15,
        costMultiplier: 0.8,
        description: (val, target) => `${target} 需求 ${(val * 100).toFixed(0)}%`,
    },

    // 资源需求修正 (负值 = 降低需求 = 好)
    resource_demand: {
        type: 'resourceDemandMod',
        category: 'needs',
        targets: [
            'food', 'wood', 'stone', 'cloth', 'tools', 'iron', 'copper',
            'plank', 'brick', 'ale', 'spice', 'coffee', 'papyrus',
            'delicacies', 'fine_clothes', 'furniture', 'culture'
        ],
        valueRange: [-0.28, -0.06], // 大幅提升
        weight: 12,
        costMultiplier: 0.7,
        description: (val, target) => `${target} 需求 ${(val * 100).toFixed(0)}%`,
    },

    // 资源供给加成
    resource_supply: {
        type: 'resourceSupplyMod',
        category: 'needs',
        targets: [
            'food', 'wood', 'stone', 'cloth', 'tools', 'iron', 'copper',
            'plank', 'brick', 'ale', 'spice', 'coffee', 'papyrus',
            'delicacies', 'fine_clothes', 'furniture', 'steel'
        ],
        valueRange: [0.12, 0.40], // 大幅提升
        weight: 12,
        costMultiplier: 1.0,
        description: (val, target) => `${target} 供给 +${(val * 100).toFixed(0)}%`,
    },

    // 需求减少
    needs_reduction: {
        type: 'needsReduction',
        category: 'needs',
        valueRange: [0.08, 0.28], // 大幅提升
        weight: 8,
        costMultiplier: 1.2,
        description: (val) => `全民需求 -${(val * 100).toFixed(0)}%`,
    },

    // ============ 人口/发展类效果 ============
    // 人口上限
    max_pop: {
        type: 'maxPop',
        category: 'population',
        valueRange: [0.06, 0.25], // 大幅提升
        weight: 10,
        costMultiplier: 1.0,
        description: (val) => `人口上限 +${(val * 100).toFixed(0)}%`,
    },

    // 人口增长加成
    population_growth: {
        type: 'populationGrowth',
        category: 'population',
        valueRange: [0.12, 0.40], // 大幅提升
        weight: 10,
        costMultiplier: 1.1,
        description: (val) => `人口增长 +${(val * 100).toFixed(0)}%`,
    },

    // 科研产出加成
    research_speed: {
        type: 'researchSpeed',
        category: 'development',
        valueRange: [0.12, 0.40], // 大幅提升
        weight: 12,
        costMultiplier: 1.4,
        description: (val) => `科研产出 +${(val * 100).toFixed(0)}%`,
    },

    // ============ 政治类效果 ============
    // 阶层满意度
    approval_boost: {
        type: 'approval',
        category: 'politics',
        targets: Object.keys(STRATA),
        valueRange: [8, 25], // 大幅提升
        weight: 15,
        costMultiplier: 0.8,
        description: (val, target) => `${target} 满意度 +${val}`,
    },

    // 联盟阶层满意度
    coalition_approval: {
        type: 'coalitionApproval',
        category: 'politics',
        valueRange: [6, 18], // 大幅提升
        weight: 10,
        costMultiplier: 1.0,
        description: (val) => `联盟阶层满意度 +${val}`,
    },

    // 合法性加成
    legitimacy_bonus: {
        type: 'legitimacyBonus',
        category: 'politics',
        valueRange: [0.06, 0.22], // 大幅提升
        weight: 10,
        costMultiplier: 1.2,
        description: (val) => `合法性 +${(val * 100).toFixed(0)}%`,
    },

    // 组织度衰减 (负值=好)
    organization_decay: {
        type: 'organizationDecay',
        category: 'politics',
        valueRange: [-0.35, -0.10], // 大幅提升
        weight: 8,
        costMultiplier: 1.1,
        description: (val) => `组织度增长 ${(val * 100).toFixed(0)}%`,
    },

    // 稳定度
    stability_bonus: {
        type: 'stability',
        category: 'politics',
        valueRange: [0.04, 0.15], // 大幅提升
        weight: 8,
        costMultiplier: 1.2,
        description: (val) => `稳定度 +${(val * 100).toFixed(0)}%`,
    },

    // ============ 军事类效果 ============
    // 军事力量
    military_bonus: {
        type: 'militaryBonus',
        category: 'military',
        valueRange: [0.10, 0.35], // 大幅提升
        weight: 10,
        costMultiplier: 1.0,
        description: (val) => `军事力量 +${(val * 100).toFixed(0)}%`,
    },

    // 军事维护降低
    military_upkeep: {
        type: 'militaryUpkeep',
        category: 'military',
        valueRange: [-0.35, -0.10], // 大幅提升
        weight: 10,
        costMultiplier: 1.1,
        description: (val) => `军事维护 ${(val * 100).toFixed(0)}%`,
    },

    // ============ 外交类效果 ============
    // 外交关系加成
    diplomatic_bonus: {
        type: 'diplomaticBonus',
        category: 'diplomacy',
        valueRange: [1.0, 4.0], // 每日关系改善值 (大幅提升)
        weight: 8,
        costMultiplier: 1.0,
        description: (val) => `每日外交关系 +${val.toFixed(1)}`,
    },

    // 外交冷却缩短
    diplomatic_cooldown: {
        type: 'diplomaticCooldown',
        category: 'diplomacy',
        valueRange: [-0.35, -0.12], // 大幅提升
        weight: 6,
        costMultiplier: 0.9,
        description: (val) => `外交冷却 ${(val * 100).toFixed(0)}%`,
    },
};

// 官员模拟节流配置
export const OFFICIAL_SIM_CONFIG = {
    // 每 tick 处理的官员数量（建议 1~2）
    batchSize: 2,
};

// ========== 负面效果定义 ==========
export const OFFICIAL_DRAWBACK_TYPES = {
    // 产出惩罚
    category_penalty: {
        type: 'categories',
        category: 'production',
        targets: ['gather', 'industry', 'civic', 'military'],
        valueRange: [-0.06, -0.02],
        weight: 20,
        description: (val, target) => `${target}类产出 ${(val * 100).toFixed(0)}%`,
    },

    // 被动消耗
    passive_cost: {
        type: 'passivePercent',
        category: 'economy',
        targets: ['silver', 'food'],
        valueRange: [-0.04, -0.01],
        weight: 20,
        description: (val, target) => `每日 ${target} ${(val * 100).toFixed(0)}%`,
    },

    // 需求增加
    needs_increase: {
        type: 'needsReduction',
        category: 'needs',
        valueRange: [-0.06, -0.02],
        weight: 15,
        description: (val) => `全民需求 +${Math.abs(val * 100).toFixed(0)}%`,
    },

    // 阶层满意度惩罚
    approval_penalty: {
        type: 'approval',
        category: 'politics',
        targets: ['peasant', 'worker', 'merchant', 'artisan', 'landowner', 'serf', 'miner'],
        valueRange: [-8, -2],
        weight: 20,
        description: (val, target) => `${target} 满意度 ${val}`,
    },

    // 腐败 - 税收损失 (新增)
    corruption: {
        type: 'corruption',
        category: 'economy',
        valueRange: [0.02, 0.08],
        weight: 15,
        description: (val) => `腐败：税收损失 ${(val * 100).toFixed(0)}%`,
    },

    // 派系冲突 - 联盟内部稳定度降低 (新增)
    faction_conflict: {
        type: 'factionConflict',
        category: 'politics',
        valueRange: [0.01, 0.04],
        weight: 10,
        description: (val) => `派系冲突：稳定度 -${(val * 100).toFixed(0)}%`,
    },

    // 资源浪费 (新增)
    resource_waste: {
        type: 'resourceWaste',
        category: 'needs',
        targets: ['food', 'wood', 'stone', 'iron'],
        valueRange: [0.02, 0.06],
        weight: 12,
        description: (val, target) => `${target} 消耗 +${(val * 100).toFixed(0)}%`,
    },

    // 外交灾难 - 关系衰减加速 (新增)
    diplomatic_incident: {
        type: 'diplomaticIncident',
        category: 'diplomacy',
        valueRange: [0.1, 0.4], // 每日额外关系衰减
        weight: 8,
        description: (val) => `外交关系衰减 +${val.toFixed(1)}/日`,
    },

    // 建筑成本增加 (新增)
    building_cost_increase: {
        type: 'buildingCostMod',
        category: 'economy',
        valueRange: [0.04, 0.10],
        weight: 12,
        description: (val) => `建筑成本 +${(val * 100).toFixed(0)}%`,
    },

    // 军事维护增加 (新增)
    military_upkeep_increase: {
        type: 'militaryUpkeep',
        category: 'military',
        valueRange: [0.04, 0.10],
        weight: 10,
        description: (val) => `军事维护 +${(val * 100).toFixed(0)}%`,
    },

    // 科研减速 (新增)
    research_slowdown: {
        type: 'researchSpeed',
        category: 'development',
        valueRange: [-0.08, -0.02],
        weight: 8,
        description: (val) => `科研速度 ${(val * 100).toFixed(0)}%`,
    },

    // 生产原料成本增加（只影响有input和output的建筑）
    production_input_cost_increase: {
        type: 'productionInputCost',
        category: 'economy',
        targets: [
            'sawmill', 'brickworks', 'reed_works', 'brewery', 'furniture_workshop',
            'culinary_kitchen', 'loom_house', 'dye_works', 'tailor_workshop',
            'bronze_foundry', 'iron_tool_workshop', 'steel_foundry', 'wool_workshop',
            'factory', 'printing_house'
        ],
        valueRange: [0.05, 0.15], // +5% ~ +15% 原料消耗
        weight: 10,
        description: (val, target) => `${target}原料消耗 +${(val * 100).toFixed(0)}%`,
    },
};

// ========== 属性-效果映射 ==========
// 定义每个属性对应的效果池
export const STAT_EFFECT_MAPPING = {
    // 行政属性 -> 经济/政治效果
    administrative: {
        primaryEffects: [
            'tax_efficiency', 'income_percent', 'building_cost_reduction',
            'production_input_cost', 'trade_bonus'
        ],
        secondaryEffects: [
            'category_boost', 'passive_percent', 'needs_reduction'
        ],
        weight: 1.0,
    },
    // 军事属性 -> 军事/稳定效果
    military: {
        primaryEffects: [
            'military_bonus', 'military_upkeep', 'wartime_production',
            'stability_bonus'
        ],
        secondaryEffects: [
            'organization_decay', 'building_boost'
        ],
        weight: 1.0,
    },
    // 外交属性 -> 外交/贸易效果
    diplomacy: {
        primaryEffects: [
            'diplomatic_bonus', 'diplomatic_cooldown', 'trade_bonus'
        ],
        secondaryEffects: [
            'approval_boost', 'coalition_approval', 'passive_gain'
        ],
        weight: 1.0,
    },
    // 威望属性 -> 政治/人口效果
    prestige: {
        primaryEffects: [
            'approval_boost', 'coalition_approval', 'legitimacy_bonus',
            'stability_bonus'
        ],
        secondaryEffects: [
            'max_pop', 'population_growth', 'research_speed'
        ],
        weight: 1.0,
    },
};

/**
 * 根据属性值计算效果强度因子
 * @param {number} statValue - 属性值 (0-100)
 * @returns {number} 强度因子 (0.3 - 1.5)
 */
export const calculateEffectStrength = (statValue) => {
    // 属性值 -> 强度因子的映射
    // 0-30: 0.3-0.6 (弱)
    // 30-60: 0.6-1.0 (中)
    // 60-80: 1.0-1.2 (强)
    // 80-100: 1.2-1.5 (超强)
    if (statValue <= 30) {
        return 0.3 + (statValue / 30) * 0.3;
    } else if (statValue <= 60) {
        return 0.6 + ((statValue - 30) / 30) * 0.4;
    } else if (statValue <= 80) {
        return 1.0 + ((statValue - 60) / 20) * 0.2;
    } else {
        return 1.2 + ((statValue - 80) / 20) * 0.3;
    }
};

/**
 * 根据官员属性生成效果
 * @param {Object} stats - 官员属性 { administrative, military, diplomacy, prestige }
 * @param {number} epoch - 当前时代
 * @param {Object} options - 可选配置
 * @returns {Object} { effects, rawEffects, effectCount, totalCostScore }
 */
export const generateEffectsFromStats = (stats, epoch = 1, options = {}) => {
    const { maxEffects = 4, minEffects = 2 } = options;
    
    const effects = {};
    const rawEffects = [];
    let totalCostScore = 0;
    
    // 1. 找出最高的两个属性（决定主要效果来源）
    const sortedStats = Object.entries(stats)
        .filter(([key]) => STAT_EFFECT_MAPPING[key])
        .sort((a, b) => b[1] - a[1]);
    
    const primaryStat = sortedStats[0];
    const secondaryStat = sortedStats[1];
    
    // 2. 确定效果数量 (基于总属性值)
    const totalStats = Object.values(stats).reduce((sum, v) => sum + (v || 0), 0);
    const avgStat = totalStats / 4;
    let effectCount = Math.floor(avgStat / 25) + 1; // 0-24: 1, 25-49: 2, 50-74: 3, 75-100: 4
    effectCount = Math.max(minEffects, Math.min(maxEffects, effectCount));
    
    // 3. 从主属性池选择效果
    const usedEffects = new Set();
    
    const addEffectFromPool = (statKey, statValue, isPrimary) => {
        const mapping = STAT_EFFECT_MAPPING[statKey];
        if (!mapping) return false;
        
        const pool = isPrimary ? mapping.primaryEffects : mapping.secondaryEffects;
        const availableEffects = pool.filter(e => !usedEffects.has(e) && OFFICIAL_EFFECT_TYPES[e]);
        
        if (availableEffects.length === 0) return false;
        
        // 随机选择一个效果
        const effectKey = availableEffects[Math.floor(Math.random() * availableEffects.length)];
        const effectDef = OFFICIAL_EFFECT_TYPES[effectKey];
        usedEffects.add(effectKey);
        
        // 根据属性值计算效果强度
        const strengthFactor = calculateEffectStrength(statValue);
        const [minVal, maxVal] = effectDef.valueRange;
        const range = maxVal - minVal;
        
        // 基础随机值 + 属性加成
        let value = minVal + range * (0.3 + Math.random() * 0.4) * strengthFactor;
        
        // 时代缩放 (对fixed数值型效果)
        if (effectDef.type === 'passive') {
            value *= (0.5 + epoch * 0.25);
        }
        
        // 确保在范围内
        value = Math.max(minVal, Math.min(maxVal, value));
        
        // 处理带目标的效果
        if (effectDef.targets) {
            const target = effectDef.targets[Math.floor(Math.random() * effectDef.targets.length)];
            rawEffects.push({ 
                effectKey, 
                type: effectDef.type, 
                target, 
                value, 
                sourcestat: statKey,
                strengthFactor 
            });
            
            if (!effects[effectDef.type]) effects[effectDef.type] = {};
            effects[effectDef.type][target] = value;
        } else {
            rawEffects.push({ 
                effectKey, 
                type: effectDef.type, 
                value, 
                sourcestat: statKey,
                strengthFactor 
            });
            effects[effectDef.type] = value;
        }
        
        totalCostScore += (effectDef.costMultiplier || 1.0) * strengthFactor;
        return true;
    };
    
    // 4. 添加效果
    // 首先从主属性添加主要效果
    if (primaryStat) {
        addEffectFromPool(primaryStat[0], primaryStat[1], true);
    }
    if (secondaryStat && effectCount >= 2) {
        addEffectFromPool(secondaryStat[0], secondaryStat[1], true);
    }
    
    // 继续添加次要效果直到达到数量
    let attempts = 0;
    while (rawEffects.length < effectCount && attempts < 20) {
        attempts++;
        const randomStat = sortedStats[Math.floor(Math.random() * sortedStats.length)];
        if (randomStat) {
            const isPrimary = Math.random() < 0.3; // 30%概率从主池选
            addEffectFromPool(randomStat[0], randomStat[1], isPrimary);
        }
    }
    
    return { effects, rawEffects, effectCount: rawEffects.length, totalCostScore };
};

/**
 * 根据当前属性重新计算效果值（用于升级后）
 * @param {Array} rawEffects - 原始效果数组（含sourcestat）
 * @param {Object} newStats - 新的属性值
 * @returns {Object} { effects, rawEffects }
 */
export const recalculateEffectsFromStats = (rawEffects, newStats) => {
    if (!Array.isArray(rawEffects) || rawEffects.length === 0) {
        return { effects: {}, rawEffects: [] };
    }
    
    const effects = {};
    const updatedRawEffects = [];
    
    for (const rawEffect of rawEffects) {
        const { effectKey, type, target, sourcestat } = rawEffect;
        const effectDef = OFFICIAL_EFFECT_TYPES[effectKey];
        
        if (!effectDef) {
            updatedRawEffects.push(rawEffect);
            continue;
        }
        
        // 获取该效果对应属性的新值
        const newStatValue = newStats[sourcestat] || 50;
        const newStrengthFactor = calculateEffectStrength(newStatValue);
        
        // 重新计算效果值
        const [minVal, maxVal] = effectDef.valueRange;
        const range = maxVal - minVal;
        
        // 保持基础随机因子，只更新强度因子
        const baseRatio = rawEffect.baseRatio || (0.3 + Math.random() * 0.4);
        let newValue = minVal + range * baseRatio * newStrengthFactor;
        
        // 确保在范围内
        newValue = Math.max(minVal, Math.min(maxVal, newValue));
        
        const updatedEffect = {
            ...rawEffect,
            value: newValue,
            strengthFactor: newStrengthFactor,
            baseRatio,
        };
        updatedRawEffects.push(updatedEffect);
        
        // 更新effects对象
        if (target) {
            if (!effects[type]) effects[type] = {};
            effects[type][target] = newValue;
        } else {
            effects[type] = newValue;
        }
    }
    
    return { effects, rawEffects: updatedRawEffects };
};

// ========== 忠诚度系统配置 ==========
export const LOYALTY_CONFIG = {
    // 初始忠诚度范围
    INITIAL_MIN: 50,
    INITIAL_MAX: 100,
    MAX: 100,
    MIN: 0,

    // 政变触发条件
    COUP_THRESHOLD: 25,         // 忠诚度阈值
    COUP_DURATION_DAYS: 180,    // 需持续天数

    // 每日忠诚度变化率
    DAILY_CHANGES: {
        stanceSatisfied: 0.40,      // 政治诉求满足（大幅提升，约30天+12）
        stanceUnsatisfied: -0.30,   // 政治诉求不满足
        financialSatisfied: 0.30,   // 财务满意
        financialUncomfortable: -0.10, // 财务不适（降低惩罚）
        financialStruggling: -0.20, // 财务困难
        financialDesperate: -0.25,  // 财务绝望
        stabilityHigh: 0.20,        // 稳定度 > 70%
        stabilityLow: -0.10,        // 稳定度 < 30%
        salaryPaid: 0.15,           // 薪资按时发放
        salaryUnpaid: -0.30,        // 薪资未发放
    },

    // 处置时的惩罚
    DISPOSAL_PENALTY: {
        fire: { loyalty: -30, coupChance: 0.15 },
        exile: { loyalty: -50, coupChance: 0.35 },
        execute: { loyalty: -80, coupChance: 0.60 },
    },

    // 政变资格门槛（满足任一即可）
    COUP_WEALTH_THRESHOLD: 30000,     // 财富分数
    COUP_PROPERTY_THRESHOLD: 3,       // 产业数量
    COUP_INFLUENCE_THRESHOLD: 0.15,   // 出身阶层影响力占比
};

// ========== 阶层效果偏好映射 ==========
// 定义每个阶层出身的官员更倾向于生成哪些效果类型
// preferredEffects: 偏好的正面效果key列表 (权重翻倍)
// preferredDrawbacks: 偏好的负面效果key列表 (权重翻倍)
// preferredTargets: 偏好的目标 (建筑/资源/阶层) - 如果效果有targets，优先选择这些
export const STRATUM_EFFECT_PREFERENCES = {
    // 自耕农：农业、人口、稳定 (新增)
    peasant: {
        preferredEffects: ['building_boost', 'population_growth', 'stability_bonus', 'resource_supply'],
        preferredDrawbacks: ['research_slowdown', 'military_upkeep_increase'],
        preferredTargets: ['farm', 'food', 'peasant', 'gather'],
    },
    // 工人：工业、建设、效率 (新增)
    worker: {
        preferredEffects: ['building_boost', 'category_boost', 'building_cost_reduction', 'resource_supply', 'production_input_cost'],
        preferredDrawbacks: ['production_input_cost_increase', 'diplomatic_incident'],
        preferredTargets: ['sawmill', 'brickworks', 'plank', 'brick', 'worker', 'industry'],
    },
    // 文书：行政、科研、稳定
    scribe: {
        preferredEffects: ['research_speed', 'stability_bonus', 'tax_efficiency', 'income_percent', 'organization_decay'],
        preferredDrawbacks: ['corruption', 'approval_penalty'],
        preferredTargets: ['library', 'culture', 'science'],
    },
    // 商人：贸易、经济、财政
    merchant: {
        preferredEffects: ['trade_bonus', 'income_percent', 'passive_percent', 'building_cost_reduction'],
        preferredDrawbacks: ['corruption', 'needs_increase'],
        preferredTargets: ['market', 'trade_port', 'trading_post', 'silver', 'merchant'],
    },
    // 教士：稳定、政治、满意度
    cleric: {
        preferredEffects: ['stability_bonus', 'approval_boost', 'coalition_approval', 'legitimacy_bonus', 'organization_decay'],
        preferredDrawbacks: ['faction_conflict', 'needs_increase'],
        preferredTargets: ['church', 'cleric', 'culture'],
    },
    // 地主：农业、人口、土地
    landowner: {
        preferredEffects: ['building_boost', 'category_boost', 'population_growth', 'max_pop', 'resource_supply'],
        preferredDrawbacks: ['approval_penalty', 'needs_increase'],
        preferredTargets: ['farm', 'large_estate', 'food', 'peasant', 'gather'],
    },
    // 工程师：工业、建筑、科技
    engineer: {
        preferredEffects: ['building_boost', 'category_boost', 'building_cost_reduction', 'research_speed', 'production_input_cost'],
        preferredDrawbacks: ['resource_waste', 'production_input_cost_increase'],
        preferredTargets: ['factory', 'steel_foundry', 'sawmill', 'brickworks', 'industry'],
    },
    // 工匠：工业产出、资源
    artisan: {
        preferredEffects: ['building_boost', 'resource_supply', 'category_boost', 'stratum_demand', 'production_input_cost'],
        preferredDrawbacks: ['resource_waste', 'production_input_cost_increase'],
        preferredTargets: ['loom_house', 'furniture_workshop', 'tailor_workshop', 'brewery', 'tools', 'cloth'],
    },
    // 军人：军事、战时、外交
    soldier: {
        preferredEffects: ['military_bonus', 'military_upkeep', 'wartime_production', 'stability_bonus'],
        preferredDrawbacks: ['diplomatic_incident', 'faction_conflict'],
        preferredTargets: ['barracks', 'training_ground', 'fortress', 'military', 'soldier'],
    },
    // 航海家：贸易、外交、探索
    navigator: {
        preferredEffects: ['trade_bonus', 'diplomatic_bonus', 'diplomatic_cooldown', 'building_boost'],
        preferredDrawbacks: ['diplomatic_incident', 'corruption'],
        preferredTargets: ['dockyard', 'trade_port', 'navigator'],
    },
    // 资本家：经济、贸易、财政
    capitalist: {
        preferredEffects: ['income_percent', 'trade_bonus', 'tax_efficiency', 'building_cost_reduction', 'passive_percent'],
        preferredDrawbacks: ['corruption', 'approval_penalty', 'faction_conflict'],
        preferredTargets: ['factory', 'market', 'silver', 'capitalist', 'industry'],
    },
};

// ========== 名字生成库 ==========
// 各文化背景的姓名库
// ========== 名字生成库 (升级版) ==========
const NAME_STYLES = {
    // ========== 东亚 (更具官僚气息) ==========
    CHINESE: {
        last: [
            '李', '王', '张', '刘', '陈', '杨', '赵', '黄', '周', '吴', '徐', '孙', '胡', '朱', '高', '林',
            '诸葛', '欧阳', '司马', '上官', '闻人', '皇甫', '夏侯', '公孙', '宇文', '长孙', '慕容', '申屠',
            '裴', '崔', '卢', '郑', '谢', '柳', '韩', '韦', '颜', '苏', '包', '狄', '寇', '范', '曾', '左',
            '孔', '孟', '墨', '荀', '庄', '列', '商', '白', '杜', '辛', '岳', '于', '戚', '海', '钱', '邓',
            '蔡', '潘', '陶', '薛', '秦', '许', '吕', '沈', '蒋', '曹', '袁', '董', '屈', '项', '霍', '卫',
            '独孤', '拓跋', '尉迟', '令狐', '司徒', '司空', '钟', '冯', '汪', '毛',
            // 新增常见姓氏与复姓
            '邹', '熊', '柏', '水', '窦', '章', '云', '苏', '潘', '葛', '奚', '范', '彭', '郎',
            '鲁', '韦', '昌', '马', '苗', '凤', '花', '方', '俞', '任', '袁', '柳', '酆', '鲍', '史',
            '费', '廉', '岑', '薛', '雷', '贺', '倪', '汤', '滕', '殷', '罗', '毕', '郝', '邬', '安',
            '东郭', '南宫', '第五', '百里', '西门', '呼延', '左丘'
        ],
        // 文官常用字：偏儒家、治国、修身
        first_char_civil: [
            '安', '居', '廷', '守', '世', '克', '弘', '景', '伯', '仲', '叔', '季', '元', '孟', '德',
            '文', '光', '明', '学', '思', '仁', '义', '礼', '智', '信', '敬', '孝', '忠', '良', '善',
            '衡', '权', '备', '亮', '瑜', '肃', '嘉', '懿', '统', '维', '逊', '恪', '师', '昭', '炎',
            '丘', '轲', '翟', '况', '周', '御', '鞅', '甫', '弃', '飞', '谦', '继', '瑞', '学', '稼', '小',
            '政', '理', '策', '度', '诚', '慎', '廉', '直', '定', '韬', '略', '渊', '济', '辅', '彦', '徽',
            // 新增常用名首字
            '浩', '俊', '博', '瑞', '金', '秉', '承', '立', '志', '君', '卓', '建', '修', '启', '永',
            '子', '若', '如', '伊', '亦', '之', '公', '宗', '家', '以', '乃', '其', '斯', '尔', '少',
            '尚', '崇', '端', '靖', '恭', '宽', '敏', '惠', '宣', '章', '华', '茂', '盛', '繁', '荣',
            // 历史名臣名将首字 (汉唐宋明)
            '邦', '盈', '恒', '彻', '询', '秀', '庄', '信', '广', '去', '青', '迁', '汤', '贺', '安', '丕', '备', '权', '逊',
            '懿', '师', '昭', '炎', '导', '羲', '献', '渊', '世', '治', '隆', '红', '知', '玄', '如', '征', '仁', '白', '甫', '牧', '商',
            '匡', '轼', '辙', '伊', '天', '飞', '弃', '清', '元', '伯', '棣', '高', '瞻', '拱', '居', '海', '阳', '成', '继', '雪', '松', '兰', '守', '禹', '庭', '万', '香'
        ],
        // 名字第二字（用于组成双字名）：偏宏大、自然、愿景
        second_char: [
            '石', '正', '玉', '龄', '同', '赞', '之', '源', '洲', '海', '岳', '山', '川', '在', '甫',
            '弼', '文', '武', '举', '直', '道', '远', '心', '性', '命', '理', '气', '常', '伦', '纲',
            '基', '业', '功', '绩', '勋', '烈', '辉', '煌', '鼎', '盛', '昌', '隆', '泰', '平', '宁', '康',
            '松', '柏', '梅', '兰', '竹', '菊', '风', '云', '雷', '龙', '虎', '豹', '鹰', '鹏', '鲲',
            '泽', '清', '宏', '荣', '显', '范', '弘', '朗', '岳', '玄', '广', '明', '光', '民',
            // 新增常用名尾字
            '轩', '宇', '昂', '杰', '豪', '强', '刚', '毅', '坚', '峰', '磊', '洋', '波', '涛', '浩',
            '然', '涵', '韵', '逸', '致', '雅', '儒', '墨', '翰', '书', '画', '棋', '琴', '音', '律',
            '春', '夏', '秋', '冬', '松', '柏', '梅', '兰', '竹', '菊', '风', '花', '雪', '月', '云',
            // 历史人物名尾字 (双字名部分)
            '民', '基', '拂', '节', '龄', '晦', '贵', '隐', '胤', '义', '石', '川', '祥', '夫', '照', '璋', '温', '炽', '基', '正', '瑞', '明', '功', '光', '全', '芹', '龄', '那', '仁', '元', '锡', '坚', '里', '章', '山'
        ],
        format: 'chinese_composite' // 特殊逻辑：大概率生成双字名
    },

    // ========== 日本 (公卿与大名风味) ==========
    JAPANESE: {
        last: [
            '近卫', '九条', '二条', '一条', '鹰司', // 五摄家
            '德川', '织田', '丰臣', '武田', '上杉', '毛利', '岛津', '伊达', '北条', // 战国大名
            '源', '平', '藤原', '橘', '菅原', // 古代氏族
            '西园寺', '三条', '今川', '足利', '细川', '山名', '大内', '朝仓', '浅井', '真田', '井伊',
            '伊藤', '山县', '大久保', '木户', '板垣', '大隈', '福泽', '渋泽', '夏目', '芥川', '太宰', '三岛',
            '丰臣', '松平', '酒井', '本多', '黑田', '前田', '岛田', '上原', '宫本', '新选组',
            '高松', '千早', '要', '长崎', '椎名', // MyGO
            '三角', '丰川', '八幡', '祐天寺', '若叶' // Ave Mujica
        ],
        first: [
            '义经', '赖朝', '信长', '秀吉', '家康', '辉元', '政宗', '义弘', '信玄', '谦信',
            '道长', '赖通', '实资', '公季', '行成', '博雅', '晴明', '光秀', '利家', '元就',
            '义时', '泰时', '时宗', '尊氏', '义满', '秀赖', '忠胜', '幸村', '直政', '左近', '半兵卫',
            '博文', '有朋', '利通', '孝允', '退助', '重信', '谕吉', '荣一', '漱石', '龙之介', '治', '由纪夫',
            '光政', '义政', '义昭', '景胜', '光圀', '清正', '忠胜', '忠臣', '利休', '千利休',
            '灯', '爱音', '乐奈', '素世', '立希', // MyGO
            '初华', '祥子', '海铃', '喵梦', '睦' // Ave Mujica
        ],
        format: 'lastFirst'
    },

    // ========== 西欧 (分拆为法/德/英风格) ==========
    // 神圣罗马/德意志风格 (严谨、贵族)
    GERMANIC: {
        first: ['弗里德里希', '威廉', '奥托', '卡尔', '海因里希', '鲁道夫', '路德维希', '汉斯', '约瑟夫', '弗朗茨', '马克西米利安', '利奥波德',
            '康拉德', '西吉斯蒙德', '斐迪南', '阿道夫', '赫尔穆特', '阿尔布雷希特', '古斯塔夫', '瓦伦斯坦',
            '阿尔伯特', '马克斯', '维尔纳', '伊曼努尔', '格奥尔格', '约翰', '理查德', '西格蒙德',
            '特奥多尔', '赫尔曼', '克虏伯', '海德里希', '路德', '科尔', '施罗德', '格林', '霍夫曼', '诺伊曼'],
        last: ['霍亨索伦', '哈布斯堡', '维特尔斯巴赫', '哈耶克', '俾斯麦', '克劳塞维茨', '梅特涅', '瓦格纳', '施特劳斯', '海涅', '歌德', '席勒',
            '老毛奇', '罗恩', '兴登堡', '鲁登道夫', '施瓦本', '萨克森', '图恩', '塔克西斯', '李希滕斯坦',
            '爱因斯坦', '普朗克', '海森堡', '康德', '黑格尔', '尼采', '巴赫', '贝多芬', '弗洛伊德', '阿登纳', '默克尔',
            '施莱尔马赫', '洪堡', '莱布尼茨', '奥伊勒', '诺伊曼', '哈贝尔', '玻尔', '施密特', '马克思', '恩格斯', '布伦纳', '海德格尔', '阿伦特',
            '施蒂纳', '斯宾格勒', '哈贝马斯', '卢森堡', '考茨基', '伯恩施坦', '施佩尔', '邓尼茨', '赫尔茨', '施本格勒', '韦伯', '阿多诺', '霍克海默', '高斯', '薛定谔',
            '开普勒', '欧姆', '伦琴', '欧拉', '哈伯', '李比希', '李斯特', '门格尔', '丢勒', '荷尔拜因', '曼', '卡夫卡', '黑塞', '克里姆特', '席勒'],
        particles: ['冯', '冯·德'], // 贵族前缀
        particleChance: 0.4, // 40% 概率出现前缀
        format: 'particleLastFirst'
    },

    // 法兰西风格 (优雅、集权)
    FRENCH: {
        first: ['路易', '查理', '弗朗索瓦', '亨利', '菲利普', '拿破仑', '让', '皮埃尔', '克洛德', '雅克', '古斯塔夫',
            '乔治', '米歇尔', '阿方斯', '奥诺雷', '亚历山大', '马克西米利安', '丹东',
            '布莱兹', '居里', '维克多', '克劳德', '奥古斯特', '夏尔', '埃马纽埃尔',
            '玛丽', '罗贝尔', '阿尔贝', '让娜', '波拿巴', '拉瓦锡', '德布罗意', '德拉克鲁瓦'],
        last: ['波旁', '瓦卢瓦', '卡佩', '黎塞留', '马扎然', '拉法耶特', '塔列朗', '伏尔泰', '卢梭', '雨果', '巴尔扎克',
            '罗伯斯庇尔', '奈伊', '缪拉', '达武', '马尔蒙', '苏尔特', '富歇', '笛卡尔', '孟德斯鸠',
            '巴斯德', '莫奈', '罗丹', '戴高乐', '蓬皮杜', '密特朗', '希拉克', '马克龙', '萨特', '加缪',
            '蒙田', '拉封丹', '拉辛', '勒克莱尔', '雷诺阿', '德彪西', '圣西门', '吉拉尔丹', '福柯', '德里达', '拉康', '鲍德里亚',
            '阿尔都塞', '德勒兹', '加塔利', '德博', '巴塔耶', '索雷尔', '勒庞', '托克维尔', '蒲鲁东', '布朗基', '梯也尔', '贝当',
            '帕斯卡', '费马', '安培', '库仑', '拉普拉斯', '拉马克', '居维叶', '萨伊', '瓦尔拉斯', '巴斯夏', '魁奈',
            '莫里哀', '司汤达', '马奈', '德加', '塞尚', '左拉', '普鲁斯特'],
        particles: ['德', '杜'],
        particleChance: 0.3,
        format: 'particleLastFirst'
    },

    // 英格兰风格 (务实、议会)
    ENGLISH: {
        first: ['威廉', '亨利', '爱德华', '理查', '乔治', '查尔斯', '詹姆斯', '托马斯', '亚瑟', '奥利弗', '温斯顿',
            '霍雷肖', '本杰明', '弗朗西斯', '罗伯特', '大卫', '维多利亚', '伊丽莎白',
            '艾萨克', '迈克尔', '史蒂芬', '简', '约翰', '玛格丽特', '托尼', '鲍里斯',
            '玛丽', '乔安', '阿达', '艾米丽', '赫伯特', '劳伦斯', '哈罗德', '艾伦', '唐纳德', '埃隆', '伯尼', '乔'],
        last: ['丘吉尔', '克伦威尔', '惠灵顿', '纳尔逊', '莎士比亚', '牛顿', '达尔文', '狄更斯', '培根', '洛克', '霍布斯',
            '沃尔波尔', '佩勒姆', '庇特', '格莱斯顿', '迪斯雷利', '张伯伦', '艾德礼', '德雷克', '霍金斯',
            '法拉第', '麦克斯韦', '图灵', '霍金', '奥斯汀', '奥威尔', '撒切尔', '布莱尔', '约翰逊', '凯恩斯',
            '克鲁姆韦尔', '邓宁', '密尔', '斯图尔特', '华莱士', '吉布森', '柯南道尔', '哈代', '特朗普', '万斯', '马斯克', '桑德斯', '拜登',
            '里根', '尼克松', '肯尼迪', '罗斯福', '撒切尔', '弗里德曼', '罗斯巴德', '霍普', '乔姆斯基', '兰德', '基辛格', '亨廷顿', '福山', '凯南', '麦卡锡', '奥巴马', '布什', '克林顿',
            '波义耳', '道尔顿', '胡克', '焦耳', '开尔文', '哈维', '詹纳', '斯密', '李嘉图', '马尔萨斯', '马歇尔',
            '弥尔顿', '乔叟', '奥斯汀', '勃朗特', '特纳', '康斯太勃尔', '维特根斯坦', '罗素', '休谟', '边沁'],
        // 英式头衔逻辑稍微复杂，暂不加particle，直接 First Last
        format: 'firstLast'
    },

    // ========== 西班牙/拉美 (热情、革命) ==========
    HISPANIC: {
        first: ['西蒙', '何塞', '弗朗西斯科', '胡安', '卡洛斯', '费尔南多', '菲德尔', '切', '埃内斯托', '乌戈', '萨尔瓦多', '巴勃罗', '加夫列尔', '豪尔赫', '米格尔', '奥古斯托', '迭戈', '弗里达'],
        last: ['玻利瓦尔', '圣马丁', '卡斯特罗', '格瓦拉', '查韦斯', '佩隆', '阿连德', '皮诺切特', '佛朗哥', '毕加索', '达利', '马尔克斯', '博尔赫斯', '塞万提斯', '洛尔卡', '里维拉', '卡罗'],
        particles: ['德', '德·拉'],
        particleChance: 0.2,
        format: 'particleLastFirst'
    },

    // ========== 斯拉夫/东欧 (粗犷、巨变) ==========
    SLAVIC: {
        first: ['伊凡', '彼得', '亚历山大', '尼古拉', '弗拉基米尔', '鲍里斯', '米哈伊尔', '德米特里', '列夫', '安德烈',
            '康斯坦丁', '尤里', '谢尔盖', '维亚切斯拉夫', '约瑟夫', '尼基塔', '列昂尼德',
            '安东', '费奥多尔', '伊戈尔', '瓦伦蒂娜', '奥尔加', '阿纳斯塔西娅', '格里戈里', '帕维尔', '斯拉沃热'],
        last: ['罗曼诺夫', '留里克', '普希金', '托尔斯泰', '陀思妥耶夫斯基', '柴可夫斯基', '朱可夫', '加加林', '列宁', '斯大林',
            '布哈林', '季诺维也夫', '加米涅夫', '托洛茨基', '莫洛托夫', '赫鲁晓夫', '勃烈日涅夫', '安德罗波夫',
            '门捷列夫', '罗蒙诺索夫', '契诃夫', '果戈里', '戈尔巴乔夫', '叶利钦', '普京',
            '穆辛', '斯捷潘诺夫', '科罗廖夫', '卡拉什尼科夫', '门捷列夫', '索尔仁尼琴', '齐泽克', '杜金',
            '巴枯宁', '克鲁泡特金', '贝利亚', '普里戈任', '泽连斯基', '卢卡申科', '纳瓦霍', '日里诺夫斯基', '捷尔任斯基', '普列汉诺夫',
            '巴甫洛夫', '罗巴切夫斯基', '康定斯基', '马列维奇', '纳博科夫', '布尔加科夫', '列宾', '斯特拉文斯基'],
        suffixes: ['维奇', '耶夫', '斯基'], // 简单的后缀模拟
        format: 'firstLast' // 简化处理，实际可以通过拼接生成 Lastname
    },

    // ========== 罗马/拜占庭 (古典、辉煌) ==========
    ROMAN: {
        // 三名法简化：Praenomen (名) + Nomen (氏族) + Cognomen (家族/绰号)
        first: ['盖乌斯', '卢修斯', '马库斯', '普布利乌斯', '昆图斯', '提图斯', '提比略', '塞克斯图斯',
            '格奈乌斯', '奥卢斯', '德基乌斯', '马尼乌斯', '查士丁尼', '君士坦丁', '狄奥多西',
            '图拉真', '哈德良', '奥勒留', '尼禄', '维斯帕先'],
        last: ['尤利乌斯', '克劳狄乌斯', '科尔内利乌斯', '瓦莱里乌斯', '艾米利乌斯', '法比乌斯', '斯基皮奥', '西塞罗', '加图',
            '奥古斯都', '弗拉维乌斯', '安东尼乌斯', '多米提乌斯', '赛维鲁', '巴列奥略', '科穆宁',
            '尤利安努斯', '安尼乌斯', '马克西米乌斯', '塞维鲁斯', '拉丁尼乌斯'],
        cognomen: ['凯撒', '奥古斯都', '布鲁图斯', '西拉', '马略', '庞培', '安东尼', '尼禄', '图拉真', '哈德良',
            '克拉苏', '雷必达', '日耳曼尼库斯', '卡里古拉', '韦帕芗', '图密善', '奥勒留', '贝利萨留',
            '斯提里科', '纳尔西斯', '普洛布斯', '斯普里乌斯', '希帕提娅', '科穆宁娜', '普罗科匹厄斯', '波伊提乌'],
        format: 'roman_tria_nomina'
    },

    // ========== 中东/伊斯兰 (繁复、黄金时代) ==========
    ISLAMIC: {
        first: ['穆罕默德', '艾哈迈德', '阿里', '哈桑', '侯赛因', '奥马尔', '奥斯曼', '阿卜杜勒', '优素福', '易卜拉欣',
            '苏莱曼', '穆拉德', '穆斯塔法', '巴耶济德', '赛义德', '萨拉丁', '拜巴尔', '帖木儿',
            '花拉子米', '海瑟姆', '贾迈勒', '安瓦尔', '法鲁克', '哈立德', '哈鲁恩', '纳吉布', '拉希德'],
        last: ['拉希德', '阿巴斯', '倭马亚', '阿尤布', '塞尔柱', '伊本·西那', '伊本·鲁世德', '法拉比', '加扎利',
            '伊本·白图泰', '伊本·赫勒敦', '纳赛尔', '萨达特', '凯末尔', '霍梅尼', '巴列维',
            '阿拉法特', '卡扎菲', '侯赛因', '马蒙', '法蒂玛', '安萨里', '马利克', '哈基姆'],
        particles: ['伊本', '阿布'], // "之子", "之父"
        particleChance: 0.6,
        format: 'particleLastFirst' // 这里其实是 First + Particle + Last
    },

    // ========== 非洲 (尼罗河/萨赫勒/斯瓦希里/王朝并存) ==========
    AFRICAN: {
        first: [
            '门卡乌拉', '哈特谢普苏特', '阿肯那顿', '拉美西斯', '克娄巴特拉', '孟菲斯', '阿斯基亚', '曼萨', '穆萨',
            '松迪亚塔', '桑迪亚塔', '沙卡', '姆本巴', '姆班巴', '齐奥塞尔', '阿克苏姆', '图特摩斯', '塞提',
            '伊兹', '姆潘德', '桑海', '贝宁', '阿散蒂', '祖鲁', '阿杜瓦', '桑给巴尔', '海尔', '恩克鲁玛', '桑卡拉', '阿契贝', '索因卡'
        ],
        last: [
            '凯塔', '图雷', '法拉', '门菲斯', '底比斯', '阿蒙', '阿克苏姆', '马里', '加纳', '桑海', '贝宁',
            '基拉瓦', '津巴布韦', '阿散蒂', '祖鲁', '刚果', '姆文巴', '哈拉尔', '努比亚', '库施'
        ],
        format: 'firstLast'
    },

    // ========== 印度/南亚 (古典王朝与学术传统) ==========
    INDIAN: {
        first: [
            '阿育', '旃陀罗', '旃陀罗笈多', '阿克巴', '沙贾汗', '巴布尔', '罗摩', '克里希纳', '阿育王',
            '阿育陀', '阿尔塔沙斯特拉', '释迦', '阿吉塔', '阿马蒂亚', '泰戈尔', '尼赫鲁', '甘地', '阿南达',
            '拉马努金', '博斯', '考底利耶', '阿耶波多', '婆罗摩笈多', '安贝德卡尔', '萨瓦卡', '辛格'
        ],
        last: [
            '孔雀', '笈多', '摩揭陀', '德里', '莫卧儿', '马拉塔', '朱罗', '帕拉', '孔德',
            '辛格', '沙阿', '古普塔', '巴拉', '卡普尔', '达摩', '维什努', '毗湿奴', '湿婆'
        ],
        format: 'firstLast'
    },

    // ========== 美洲土著 (北美/平原/林地) ==========
    NATIVE_AMERICAN: {
        first: [
            '坐牛', '疯马', '红云', '特库姆塞', '杰罗尼莫', '塞阔雅', '黑鹰', '约瑟夫', '奥塞奥拉', '科奇斯',
            '庞蒂亚克', '卡霍基亚', '哈瓦塔', '阿纳托', '亚哈', '怀恩多特', '科曼奇', '切恩', '内兹珀斯'
        ],
        last: [
            '苏族', '切罗基', '纳瓦霍', '阿帕奇', '霍皮', '克里', '易洛魁', '肖尼', '奥赛奇', '黑脚',
            '科曼奇', '切恩', '克罗', '米克马克', '祖尼', '切特瓦', '波尼', '阿尔冈昆'
        ],
        format: 'firstLast'
    },

    // ========== 中南美/美洲古文明 (玛雅/阿兹特克/印加) ==========
    MESOAMERICAN: {
        first: [
            '蒙特祖马', '库奥特莫克', '内萨瓦尔科约特', '帕卡尔', '托帕', '图帕克', '阿塔瓦尔帕', '瓦伊纳',
            '马丘', '萨帕', '伊察纳', '乌纳克', '玛尼', '卡维尔', '奇琴', '蒂瓦纳库'
        ],
        last: [
            '特诺奇', '特拉斯卡拉', '米斯特克', '玛雅', '印加', '特奥蒂瓦坎', '库斯科', '基切',
            '托尔特克', '阿兹特克', '尤卡坦', '蒂卡尔', '乌斯马尔', '奇琴', '卡拉克穆尔'
        ],
        format: 'firstLast'
    },

    // ========== 奇幻/克苏鲁/神秘 (用于非常后期或特殊事件) ==========
    ELDRITCH: {
        first: ['奈亚', '克图', '哈斯', '阿撒', '尤格', '莎布', '伊塔', '达贡', '海德',
            '阿布霍', '格赫', '伊波', '扎特', '兰', '洛夫'],
        last: ['拉托提普', '鲁', '塔', '托斯', '索托斯', '尼古拉丝', '库亚', '拉', '拉',
            '罗斯', '古', '萨', '瓜', '克拉夫特', '钱伯斯'],
        format: 'firstLast' // 简单的拼接
    }
};

// 称号/绰号库 (增加风味)
const EPITHETS = {
    positive: ['智者', '公正者', '狮心', '光辉者', '复兴者', '虔诚者', '好人', '博学者', '建设者',
        '征服者', '立法者', '太阳王', '奥古斯都', '真理守护者', '解放者', '受天命者', '完美的', '革新者', '宽宏者', '雷霆'],
    neutral: ['沉默者', '黑衣', '长脚', '矮子', '红胡子', '秃头', '无地王', '漫游者', '观星者',
        '简单的', '大胆', '痛风者', '好争吵者', '流亡者', '意外者', '中间人', '八字胡', '好猎者', '受洗者'],
    negative: ['残酷者', '暴君', '血斧', '懒惰者', '无能者', '疯子', '不幸者', '篡位者',
        '该诅咒者', '血腥', '软剑', '荒淫者', '昏庸者', '背教者', '阴谋家', '短命者', '无情者']
};
// 文化风格列表（用于随机选择）
const CULTURE_STYLES = Object.keys(NAME_STYLES);

/**
 * 生成随机名字
 * @param {number} epoch - 当前时代 (影响风格偏好)
 * @returns {string} 全名
 */
/**
 * 生成带有历史风味的随机名字
 */
export const generateName = (epoch) => {
    let styleKey;
    const rand = Math.random();

    // 1. 时代偏好选择 (稍微调整了逻辑，让风格更聚焦)
    if (epoch <= 2) {
        // 古典时代：罗马、中华、伊斯兰
        const styles = ['ROMAN', 'CHINESE', 'CHINESE', 'ISLAMIC', 'ISLAMIC', 'SLAVIC', 'AFRICAN', 'MESOAMERICAN', 'NATIVE_AMERICAN'];
        styleKey = styles[Math.floor(rand * styles.length)];
    } else if (epoch <= 5) {
        // 封建/启蒙：欧陆风云模式
        const styles = ['CHINESE', 'JAPANESE', 'GERMANIC', 'FRENCH', 'ENGLISH', 'SLAVIC', 'ISLAMIC', 'AFRICAN', 'INDIAN', 'MESOAMERICAN', 'NATIVE_AMERICAN', 'HISPANIC'];
        styleKey = styles[Math.floor(rand * styles.length)];
    } else {
        // 工业/现代：全球化
        const keys = Object.keys(NAME_STYLES).filter(k => k !== 'ROMAN'); // 罗马此时不太合适了
        styleKey = keys[Math.floor(rand * keys.length)];
    }

    const style = NAME_STYLES[styleKey];
    let fullName = '';

    // 2. 根据格式生成名字
    if (style.format === 'chinese_composite') {
        // 中国逻辑：单字姓 + (50%单字名 / 50%双字名)
        const surname = style.last[Math.floor(Math.random() * style.last.length)];
        let givenName = '';

        // 第一字
        const char1 = style.first_char_civil[Math.floor(Math.random() * style.first_char_civil.length)];
        givenName += char1;

        // 70% 概率加第二字
        if (Math.random() < 0.7) {
            const char2 = style.second_char[Math.floor(Math.random() * style.second_char.length)];
            givenName += char2;
        }
        fullName = surname + givenName;

    } else if (style.format === 'roman_tria_nomina') {
        // 罗马三名法
        const praenomen = style.first[Math.floor(Math.random() * style.first.length)];
        const nomen = style.last[Math.floor(Math.random() * style.last.length)];
        const cognomen = style.cognomen[Math.floor(Math.random() * style.cognomen.length)];
        // 30% 概率只有两名，70% 概率三名
        fullName = (Math.random() < 0.3) ? `${praenomen}·${nomen}` : `${praenomen}·${nomen}·${cognomen}`;

    } else if (style.format === 'particleLastFirst') {
        // 带前缀的欧美/中东名字
        const first = style.first[Math.floor(Math.random() * style.first.length)];
        const last = style.last[Math.floor(Math.random() * style.last.length)];

        // 检查是否有前缀且触发概率
        let particle = '';
        if (style.particles && Math.random() < (style.particleChance || 0)) {
            particle = style.particles[Math.floor(Math.random() * style.particles.length)];

            if (styleKey === 'ISLAMIC') {
                // 伊斯兰：First + ibn + Last
                fullName = `${first}·${particle}·${last}`;
            } else {
                // 欧洲：First + von + Last
                fullName = `${first}·${particle}·${last}`;
            }
        } else {
            fullName = `${first}·${last}`;
        }

    } else {
        // 标准 First Last 或 Last First
        const first = style.first[Math.floor(Math.random() * style.first.length)];
        const last = style.last[Math.floor(Math.random() * style.last.length)];

        if (style.format === 'lastFirst') {
            fullName = `${last}${first}`;
        } else {
            fullName = `${first}·${last}`;
        }
    }

    // 3. 称号系统 (5% 概率获得称号，高Epoch概率增加)
    // 只有非中国/日本名字才加后缀称号（中文习惯通常不把绰号加在名字后面显示）
    if (styleKey !== 'CHINESE' && styleKey !== 'JAPANESE') {
        if (Math.random() < 0.05 + (epoch * 0.01)) {
            const epithetType = Math.random() < 0.7 ? 'positive' : (Math.random() < 0.9 ? 'neutral' : 'negative');
            const epithet = EPITHETS[epithetType][Math.floor(Math.random() * EPITHETS[epithetType].length)];
            fullName += ` “${epithet}”`;
        }
    }

    return fullName;
};

/**
 * 辅助函数：从加权对象中随机选择
 */
const pickWeightedRandom = (weights) => {
    let total = 0;
    for (let key in weights) total += weights[key];
    let random = Math.random() * total;
    for (let key in weights) {
        random -= weights[key];
        if (random <= 0) return key;
    }
    return Object.keys(weights)[0];
};

/**
 * 辅助函数：生成单个效果
 * @param {boolean} isDrawback - 是否生成负面效果
 * @param {string} sourceStratum - 官员出身阶层（用于偏好加权）
 * @param {number} epoch - 当前时代（用于缩放效果数值）
 */
const generateEffect = (isDrawback = false, sourceStratum = null, epoch = 1) => {
    const pool = isDrawback ? OFFICIAL_DRAWBACK_TYPES : OFFICIAL_EFFECT_TYPES;
    const preferences = sourceStratum ? STRATUM_EFFECT_PREFERENCES[sourceStratum] : null;
    const preferredList = preferences
        ? (isDrawback ? preferences.preferredDrawbacks : preferences.preferredEffects) || []
        : [];
    const preferredTargets = preferences?.preferredTargets || [];

    // 1. 根据阶层偏好调整权重
    const typeWeights = {};
    Object.keys(pool).forEach(key => {
        let weight = pool[key].weight;
        // 如果是偏好的效果类型，权重翻倍
        if (preferredList.includes(key)) {
            weight *= 2.5;
        }
        typeWeights[key] = weight;
    });

    const typeKey = pickWeightedRandom(typeWeights);
    const config = pool[typeKey];

    // 2. 确定具体目标 (如果有)
    let target = null;
    if (config.targets && config.targets.length > 0) {
        // 找出与偏好目标的交集
        const matchingTargets = config.targets.filter(t => preferredTargets.includes(t));

        if (matchingTargets.length > 0 && Math.random() < 0.7) {
            // 70% 概率从偏好目标中选择
            target = matchingTargets[Math.floor(Math.random() * matchingTargets.length)];
        } else {
            // 否则随机选择
            target = config.targets[Math.floor(Math.random() * config.targets.length)];
        }
    }

    // 3. 确定数值 - 根据时代缩放
    // 时代缩放因子：早期时代效果较弱，后期更强
    // epoch 1: 0.4x, epoch 2: 0.55x, epoch 3: 0.7x, epoch 4: 0.85x, epoch 5: 1.0x, epoch 6+: 1.0x
    const epochScaleFactor = Math.min(1.0, 0.25 + epoch * 0.15);

    const [min, max] = config.valueRange;
    // 应用时代缩放：早期时代只能获得数值范围的一部分
    const scaledMin = min * epochScaleFactor;
    const scaledMax = max * epochScaleFactor;
    const rawValue = scaledMin + Math.random() * (scaledMax - scaledMin);

    let value = rawValue;
    if (config.type === 'approval' || config.type === 'coalitionApproval') {
        value = Math.round(rawValue);
    } else {
        value = Math.round(rawValue * 1000) / 1000;
    }

    return {
        type: config.type,
        target,
        value,
        costMultiplier: config.costMultiplier || 1.0
    };
};

/**
 * 生成随机官员
 * @param {number} epoch - 当前时代
 * @param {Object} popStructure - 当前人口结构 { stratumKey: population }
 * @param {Object} classInfluence - 当前影响力占比 { stratumKey: influencePercent }
 * @param {Object} market - 当前市场数据（包含 prices 等信息）
 * @param {Object} rates - 当前资源速率（用于估算规模）
 * @returns {Object} 官员对象
 */
const PERCENT_EFFECT_TYPES = new Set([
    'buildings',
    'categories',
    'wartimeProduction',
    'tradeBonus',
    'taxEfficiency',
    'buildingCostMod',
    'productionInputCost',
    'incomePercent',
    'passivePercent',
    'stratumDemandMod',
    'resourceDemandMod',
    'resourceSupplyMod',
    'needsReduction',
    'maxPop',
    'populationGrowth',
    'researchSpeed',
    'organizationDecay',
    'stability',
    'militaryBonus',
    'militaryUpkeep',
    'diplomaticBonus',
    'diplomaticCooldown',
    'corruption',
    'factionConflict',
    'resourceWaste',
    'diplomaticIncident',
]);

const APPROVAL_SCORE_DIVISOR = 20;
const PASSIVE_SCORE_DIVISOR = 30;
const PERCENT_SCORE_MULTIPLIER = 20;
const MIN_OFFICIAL_SALARY = 15;
const MAX_OFFICIAL_SALARY = 2500;
const RESOURCE_WEIGHT_BASE_PRICE = 5;
const VALUE_SCALE_BASELINE = 180;
const GLOBAL_VALUE_SCALE_BASELINE = 320;

const GLOBAL_VALUE_SCALE_TYPES = new Set([
    'incomePercent',
    'taxEfficiency',
    'tradeBonus',
    'buildingCostMod',
    'productionInputCost',
    'categories',
    'buildings',
    'wartimeProduction',
    'passivePercent',
]);

// 效果类型权重：调整为更均衡的数值，避免某些效果估值过高
const EFFECT_TYPE_WEIGHTS = {
    // 经济类：高价值但不要太极端
    incomePercent: 1.4,      // 降低：税收收入
    taxEfficiency: 1.3,      // 降低：税收效率
    tradeBonus: 1.2,         // 降低：贸易利润

    // 生产类：提升权重，这些效果很实用
    buildingCostMod: 1.1,
    productionInputCost: 1.3, // 提升：原料消耗降低非常有用
    buildings: 1.2,           // 提升：单建筑加成
    categories: 1.4,          // 提升：类别加成影响多个建筑
    wartimeProduction: 1.0,   // 降低：战时生产有条件性

    // 被动类
    passive: 0.8,             // 降低：固定被动产出
    passivePercent: 1.1,

    // 需求/供给类
    resourceSupplyMod: 1.1,   // 提升
    resourceDemandMod: 1.0,   // 提升
    stratumDemandMod: 1.0,    // 提升
    needsReduction: 1.2,      // 提升：全民需求降低很强

    // 人口/发展类
    maxPop: 0.9,
    populationGrowth: 1.0,
    researchSpeed: 1.2,

    // 政治类
    approval: 0.8,            // 满意度
    coalitionApproval: 0.9,
    stability: 1.1,
    legitimacyBonus: 1.0,
    organizationDecay: 0.9,

    // 军事类
    militaryBonus: 1.0,
    militaryUpkeep: 1.0,

    // 外交类
    diplomaticBonus: 0.8,
    diplomaticIncident: 0.7,
    diplomaticCooldown: 0.8,

    // 负面效果类
    corruption: 1.0,
    factionConflict: 0.9,
    resourceWaste: 0.9,
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const getResourceUnitPrice = (resource, market) => {
    const def = RESOURCES[resource];
    if (!def) return 1;
    const basePrice = def.basePrice || 1;
    return typeof market?.prices?.[resource] === 'number' ? market.prices[resource] : basePrice;
};

const getResourceWeight = (resource, market) => {
    const def = RESOURCES[resource];
    if (!def) return 1;
    const marketPrice = getResourceUnitPrice(resource, market);
    const priceFactor = clamp(marketPrice / RESOURCE_WEIGHT_BASE_PRICE, 0.4, 2.5);
    let tagFactor = 1;
    if (def.tags?.includes('currency')) tagFactor *= 2.0;
    if (def.tags?.includes('essential')) tagFactor *= 0.7;
    if (def.tags?.includes('luxury')) tagFactor *= 1.3;
    if (def.tags?.includes('industrial')) tagFactor *= 1.15;
    if (def.tags?.includes('raw_material')) tagFactor *= 0.9;
    if (def.tags?.includes('special')) tagFactor *= 1.1;
    return clamp(priceFactor * tagFactor, 0.4, 3.0);
};

// 修复：大幅降低 valueScale 的影响范围，避免经济好的时候薪资飙升
const getValueScale = (value, baseline) => {
    if (!value || value <= 0) return 1;
    // 降低缩放幅度：从 0.6-2.2 改为 0.85-1.4
    const scaled = 0.9 + Math.log10(1 + value / baseline) * 0.5;
    return clamp(scaled, 0.85, 1.4);
};

const normalizeEffectScore = (effect, market, rates) => {
    let score = Math.abs(effect.value);
    let typeWeight = EFFECT_TYPE_WEIGHTS[effect.type] || 1.0;
    let resourceWeight = 1;
    let valueScale = 1;

    // 资源权重：降低影响幅度
    if (effect.target && RESOURCES[effect.target]) {
        // 限制资源权重范围，避免某些资源导致估值过高
        resourceWeight = Math.min(1.5, getResourceWeight(effect.target, market));
    }

    // 百分比效果：降低乘数
    if (PERCENT_EFFECT_TYPES.has(effect.type)) {
        score *= PERCENT_SCORE_MULTIPLIER * 0.6; // 降低40%
    }

    // 满意度：进一步降低权重
    if (effect.type === 'approval') {
        score = score / (APPROVAL_SCORE_DIVISOR * 1.5); // 10点满意度 ≈ 0.33 效果分
    } else if (effect.type === 'passive') {
        score = score / (PASSIVE_SCORE_DIVISOR * 1.5); // 进一步降低被动产出权重
    }

    // 针对单个建筑的效果：降低权重（因为只影响一种建筑）
    if (effect.type === 'buildings' || effect.type === 'productionInputCost') {
        typeWeight *= 0.7; // 单建筑效果打7折
    }

    // 条件性效果降低权重
    if (effect.type === 'wartimeProduction') {
        typeWeight *= 0.6; // 战时生产需要战争才生效
    }

    // valueScale：只对全局性效果应用，且影响更小
    if (rates) {
        // 只对真正的全局经济效果应用 valueScale
        if (effect.type === 'incomePercent' || effect.type === 'taxEfficiency' ||
            effect.type === 'tradeBonus' || effect.type === 'categories') {
            const silverRate = Math.abs(rates.silver || 0);
            valueScale = getValueScale(silverRate, GLOBAL_VALUE_SCALE_BASELINE);
        }
        // 其他效果不再应用 valueScale，避免估值波动过大
    }

    return score * typeWeight * resourceWeight * valueScale;
};

export const generateRandomOfficial = (epoch, popStructure = {}, classInfluence = {}, market = null, rates = null) => {
    // 1. 基本信息
    const name = generateName(epoch);

    // 可作为官员出身的阶层列表
    const eligibleStrata = [
        'peasant', 'worker', // 新增：底层阶级也能出官员
        'scribe', 'merchant', 'cleric', 'landowner',
        'engineer', 'artisan', 'soldier', 'navigator', 'capitalist'
    ];

    // 基于人口和影响力计算权重
    const dynamicWeights = {};
    let totalWeight = 0;

    for (const stratum of eligibleStrata) {
        const pop = popStructure[stratum] || 0;
        const influence = classInfluence[stratum] || 0;

        // 只有人口 >= 1 的阶层才能产生官员
        if (pop >= 1) {
            // 权重 = 人口占比 + 影响力占比 (各占50%)
            // 使用 sqrt 让人口差异不至于太极端
            const popWeight = Math.sqrt(pop);
            const influenceWeight = influence * 100; // 影响力占比转换为百分比权重
            const weight = popWeight + influenceWeight;

            dynamicWeights[stratum] = Math.max(1, weight); // 最低权重为1
            totalWeight += dynamicWeights[stratum];
        }
    }

    // 如果没有任何符合条件的阶层，使用默认阶层（兜底）
    if (Object.keys(dynamicWeights).length === 0) {
        dynamicWeights['scribe'] = 1; // 默认文书
    }

    const sourceStratum = pickWeightedRandom(dynamicWeights);

    // ========== 先生成核心属性（属性决定效果） ==========
    // 威望 (Prestige): 20-80基础，根据阶层调整
    let prestige = 30 + Math.floor(Math.random() * 40); // 30-70 基础
    const prestigeStrata = { nobles: 15, landowner: 10, cleric: 8, merchant: 5, capitalist: 5 };
    prestige += prestigeStrata[sourceStratum] || 0;
    prestige = Math.min(100, Math.max(10, prestige));

    // 行政能力 (Administrative): 20-80基础，根据阶层调整
    let administrative = 25 + Math.floor(Math.random() * 35); // 25-60 基础
    const adminStrata = { scribe: 20, merchant: 10, engineer: 15, capitalist: 8 };
    administrative += adminStrata[sourceStratum] || 0;
    administrative = Math.min(100, Math.max(10, administrative));

    // 军事能力 (Military): 20-60基础，根据阶层调整
    let military = 15 + Math.floor(Math.random() * 30); // 15-45 基础
    const militaryStrata = { soldier: 30, landowner: 10, navigator: 8 };
    military += militaryStrata[sourceStratum] || 0;
    military = Math.min(100, Math.max(5, military));

    // 外交能力 (Diplomacy): 20-55基础，根据阶层调整
    let diplomacy = 20 + Math.floor(Math.random() * 35); // 20-55 基础
    const diplomacyStrata = { merchant: 20, cleric: 15, navigator: 15, capitalist: 10, scribe: 5 };
    diplomacy += diplomacyStrata[sourceStratum] || 0;
    diplomacy = Math.min(100, Math.max(5, diplomacy));

    // 统一属性对象
    const stats = { prestige, administrative, military, diplomacy };

    // ========== 基于属性生成效果 ==========
    const effectResult = generateEffectsFromStats(stats, epoch, {
        minEffects: epoch >= 6 ? 3 : epoch >= 3 ? 2 : 1,
        maxEffects: epoch >= 6 ? 5 : epoch >= 3 ? 4 : 3,
    });

    let { effects, rawEffects, totalCostScore } = effectResult;
    const effectCount = rawEffects.length;

    // 3. 生成负面效果 (40% 概率，高时代概率略增)
    const drawbacks = [];
    let drawbackChance = 0.4 + (epoch * 0.03);

    // 如果正面效果特别多 (3个以上)，负面效果概率显著增加
    if (effectCount >= 3) drawbackChance += 0.3;

    // 尝试生成负面效果
    if (Math.random() < drawbackChance) {
        drawbacks.push(generateEffect(true, sourceStratum, epoch));
    }

    // 额外负面效果
    if (drawbacks.length > 0 && effectCount > 3) {
        const extraDrawbackChance = 0.65;
        let potentialExtras = effectCount - 3;
        for (let i = 0; i < potentialExtras; i++) {
            if (Math.random() < extraDrawbackChance) {
                drawbacks.push(generateEffect(true, sourceStratum, epoch));
            }
        }
    }

    // 计算负面效果对成本分的抵消
    drawbacks.forEach(drawback => {
        const score = normalizeEffectScore(drawback, market, rates);
        totalCostScore -= score * 0.5;
    });

    // 4. 将负面效果合并到effects对象
    const mergeIntoEffects = (eff) => {
        if (eff.target) {
            if (!effects[eff.type]) effects[eff.type] = {};
            effects[eff.type][eff.target] = (effects[eff.type][eff.target] || 0) + eff.value;
        } else {
            effects[eff.type] = (effects[eff.type] || 0) + eff.value;
        }
    };

    drawbacks.forEach(mergeIntoEffects);

    // 5. 计算俸禄
    // 目标范围: 15 ~ 4000 银/日
    // 设计目标：
    // - 青铜时代 (epoch 1): 20-150 银/日
    // - 铁器时代 (epoch 3): 50-400 银/日
    // - 工业时代 (epoch 6): 150-1500 银/日

    // 时代缩放因子：对评分和基础薪资都应用
    // epoch 1: 0.25x, epoch 2: 0.4x, epoch 3: 0.55x, epoch 4: 0.7x, epoch 5: 0.85x, epoch 6+: 1.0x
    const epochScoreMultiplier = Math.min(1.0, 0.1 + epoch * 0.15);

    // 对 totalCostScore 应用时代缩放并限制上限
    // 避免某些效果组合导致评分爆炸
    const clampedCostScore = Math.min(15, Math.max(0.5, totalCostScore)); // 限制在 0.5-15 之间
    const scaledCostScore = clampedCostScore * epochScoreMultiplier;

    // 基础薪资：使用更平缓的系数
    // scaledCostScore 范围约 0.125-15，对应基础薪资 20-320
    const baseSalary = 20 + scaledCostScore * 20;

    // 时代加成：让后期官员薪资有更大上限
    // epoch 1: 0.8x, epoch 3: 1.1x, epoch 6: 1.55x
    const epochMultiplier = 0.65 + epoch * 0.15;

    // 效果数量加成：多效果官员适当加价，但不要太极端
    // 1个效果: 1.0x, 3个效果: 1.2x, 5个效果: 1.4x
    const effectCountMultiplier = 1.0 + (effectCount - 1) * 0.1;

    let salary = Math.round(baseSalary * epochMultiplier * effectCountMultiplier);

    // 确保在 15 ~ 4000 范围内
    salary = Math.max(MIN_OFFICIAL_SALARY, Math.min(MAX_OFFICIAL_SALARY, salary));

    // 生成ID
    const id = `off_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 5)}`;

    // 6. 计算出身阶层影响力加成
    // 公式: 基础值(5-10%) + 薪水因子
    // 调整：降低薪水因子的权重，避免轻易达到上限
    // 假设薪水范围 50 - 2500+
    // 薪水 200 -> 0.008 (0.8%)
    // 薪水 1000 -> 0.04 (4%)
    // 薪水 2500 -> 0.10 (10%)
    const baseInfluenceBonus = 0.03 + Math.random() * 0.05; // 3-8% 基础
    const salaryInfluenceBonus = (salary / 1250) * 0.05; // 每 1250 薪水 +5%
    const stratumInfluenceBonus = Math.min(0.25, baseInfluenceBonus + salaryInfluenceBonus); // 最高25%

    // 7. 分配政治立场（优先分配，以便影响贪婪度）
    // 包含动态生成的条件，基于当前市场数据
    const stanceResult = assignPoliticalStance(sourceStratum, epoch, market);

    // 8. 计算贪婪度 (Greed)
    // 基础范围 0.8 - 1.2
    let greed = 0.8 + Math.random() * 0.4;

    // 阶层修正
    const highGreedStrata = ['merchant', 'capitalist', 'landowner'];
    const mediumGreedStrata = ['official', 'noble'];
    if (highGreedStrata.includes(sourceStratum)) {
        greed += 0.2 + Math.random() * 0.2; // +0.2~0.4
    } else if (mediumGreedStrata.includes(sourceStratum)) {
        greed += 0.1;
    }

    // 政治立场修正：左派更清廉
    // 越左越清廉 (spectrum: left -> 减少贪婪)
    const stanceInfo = getStanceInfo(stanceResult.stanceId);
    if (stanceInfo) {
        if (stanceInfo.spectrum === 'left') {
            greed -= 0.25; // 左派显著降低贪婪

            // 极左派系额外降低
            const radicalLeft = ['primitive_communism', 'marxism', 'anarchism', 'eco_socialism'];
            if (radicalLeft.includes(stanceInfo.id)) {
                greed -= 0.2; // 极左几乎都是清教徒式的
            }
        }
        // 右派稍微增加一点贪婪（更有利于资本/等级积累）
        else if (stanceInfo.spectrum === 'right') {
            greed += 0.1;
        }
    }

    // 效果修正 (腐败特性)
    if (effects && effects.corruption && effects.corruption > 0) {
        greed += 0.3 + (effects.corruption * 5); // 腐败值越高越贪婪
    }

    // 确保贪婪度在合理范围 (0.5 - 3.0)
    // 允许低贪婪达到更低值 (0.3) 以体现极左的无私
    greed = Math.max(0.3, Math.min(3.0, greed));
    greed = Math.round(greed * 100) / 100;

    // ========== 等级与经验值系统 ==========
    const level = 1;
    const xp = 0;
    const xpToNextLevel = 100; // 初始升级所需经验

    // ========== 野心值计算 ==========
    // 野心基于总属性值 + 贪婪 + 随机因素
    const totalStats = stats.prestige + stats.administrative + stats.military + stats.diplomacy;
    let ambition = Math.floor(totalStats / 8) + Math.floor(greed * 20) + Math.floor(Math.random() * 15);
    ambition = Math.min(100, Math.max(5, ambition));

    // ========== 基于野心调整薪资需求 ==========
    // 野心越高，薪资需求越高
    const ambitionSalaryMultiplier = 1 + (ambition - 30) * 0.01; // 30为基准，每超过1点+1%
    const finalSalary = Math.round(salary * Math.max(0.8, ambitionSalaryMultiplier));

    return {
        id,
        name,
        sourceStratum,
        effects,
        rawEffects,
        salary: finalSalary,
        baseSalary: salary, // 保留原始薪资用于参考
        hireDate: null,
        wealth: 0, // 官员个人财富，初始为0
        greed, // 个人贪婪度
        influence: 5 + (salary / 10),
        stratumInfluenceBonus,
        // 统一的核心属性对象
        stats,
        // 向后兼容：保留独立属性
        prestige: stats.prestige,
        administrative: stats.administrative,
        military: stats.military,
        diplomacy: stats.diplomacy,
        // 等级与成长系统
        level,
        xp,
        xpToNextLevel,
        ambition, // 野心值
        // 政治立场信息
        politicalStance: stanceResult.stanceId,
        stanceConditionParams: stanceResult.conditionParams,
        stanceConditionText: stanceResult.conditionText,
        stanceActiveEffects: stanceResult.activeEffects,
        stanceUnsatisfiedPenalty: stanceResult.unsatisfiedPenalty,
    };
};

/**
 * 重新计算官员俸禄 (用于存档兼容或调整)
 */
export const calculateOfficialSalary = (official, epoch) => {
    return official.salary; // 暂直接返回，如需动态重算可在此实现
};
