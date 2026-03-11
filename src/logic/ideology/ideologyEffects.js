/**
 * 理念效果引擎
 * 处理装备理念的基础数值效果、条件触发效果和联动效果
 * 复用现有 applyEffects 管道，不创建并行效果系统
 */

import { applyEffects } from '../buildings/effects.js';

// ============ 基础数值效果 ============

/**
 * 将所有装备理念的基础数值效果应用到 bonuses
 * @param {Array} equippedIdeologies - 已装备理念对象列表 [{ id, level, ...ideologyConfig }]
 * @param {Object} bonuses - 现有效果管道的 bonuses 对象
 */
export function applyIdeologyEffects(equippedIdeologies, bonuses) {
    if (!Array.isArray(equippedIdeologies) || equippedIdeologies.length === 0) return;

    for (const ideology of equippedIdeologies) {
        if (!ideology || !ideology.effects || !ideology.effects.levels) continue;
        const level = ideology.level || 1;
        const levelIndex = Math.min(level, ideology.effects.levels.length) - 1;
        const levelEffects = ideology.effects.levels[levelIndex];
        if (!levelEffects) continue;

        // 复用现有 applyEffects 处理基础数值字段
        applyEffects(levelEffects, bonuses);
    }
}

// ============ 条件触发效果 ============

/**
 * 评估所有条件触发效果，返回额外 bonuses 修正
 * 支持7种触发类型：
 *  - stratum_bonus: 阶层关联型
 *  - pop_ratio_bonus: 人口比例型
 *  - chain_count_bonus: 产业链关联型
 *  - tech_count_bonus: 知识计数型
 *  - resource_threshold: 资源阈值型
 *  - building_count_bonus: 建筑计数型
 *  - epoch_scaling: 时代关联型
 * 
 * @param {Array} equippedIdeologies - 已装备理念对象列表
 * @param {Object} gameState - 游戏状态快照
 * @param {Object} bonuses - 效果管道 bonuses（用于直接修改）
 * @returns {Object} 额外的触发效果（如 flatPop 等一次性效果）
 */
export function evaluateTriggerEffects(equippedIdeologies, gameState, bonuses) {
    if (!Array.isArray(equippedIdeologies) || equippedIdeologies.length === 0) return {};

    const oneTimeEffects = {}; // 一次性效果（如 flatPop）

    for (const ideology of equippedIdeologies) {
        if (!ideology || !ideology.effects || !ideology.effects.triggerEffects) continue;
        const level = ideology.level || 1;

        for (const trigger of ideology.effects.triggerEffects) {
            if (!trigger || !trigger.type) continue;

            // 等级缩放系数：1级=1.0, 2级=1.5, 3级=2.0
            const levelScale = level === 1 ? 1.0 : level === 2 ? 1.5 : 2.0;

            switch (trigger.type) {
                case 'stratum_bonus':
                    _applyStratumBonus(trigger, gameState, bonuses, levelScale);
                    break;
                case 'pop_ratio_bonus':
                    _applyPopRatioBonus(trigger, gameState, bonuses, levelScale);
                    break;
                case 'chain_count_bonus':
                    _applyChainCountBonus(trigger, gameState, bonuses, levelScale);
                    break;
                case 'tech_count_bonus':
                    _applyTechCountBonus(trigger, gameState, bonuses, oneTimeEffects, levelScale);
                    break;
                case 'resource_threshold':
                    _applyResourceThreshold(trigger, gameState, bonuses, levelScale);
                    break;
                case 'building_count_bonus':
                    _applyBuildingCountBonus(trigger, gameState, bonuses, levelScale);
                    break;
                case 'epoch_scaling':
                    _applyEpochScaling(trigger, gameState, bonuses, levelScale);
                    break;
                default:
                    break;
            }
        }
    }

    return oneTimeEffects;
}

/**
 * 阶层关联型：为指定阶层的人口添加额外被动效果
 * 例: { type: 'stratum_bonus', stratum: 'worker', bonus: { perPopPassive: { science: 0.02 } } }
 */
function _applyStratumBonus(trigger, gameState, bonuses, levelScale) {
    if (!trigger.stratum || !trigger.bonus) return;
    const { popStructure } = gameState;
    if (!popStructure) return;

    const stratumPop = popStructure[trigger.stratum] || 0;
    if (stratumPop <= 0) return;

    // perPopPassive 类型：乘以阶层人口数 × 等级缩放
    if (trigger.bonus.perPopPassive) {
        for (const [resKey, amountPerPop] of Object.entries(trigger.bonus.perPopPassive)) {
            const scaled = amountPerPop * levelScale;
            bonuses.perPopPassiveGains[resKey] = (bonuses.perPopPassiveGains[resKey] || 0) + scaled;
        }
    }
    // 其他加成类型直接应用
    const otherBonus = { ...trigger.bonus };
    delete otherBonus.perPopPassive;
    if (Object.keys(otherBonus).length > 0) {
        _applyScaledEffects(otherBonus, bonuses, levelScale);
    }
}

/**
 * 人口比例型：将指定阶层人口 × 比例系数加到目标属性
 * 例: { type: 'pop_ratio_bonus', stratum: 'peasant', ratio: 0.01, target: 'militaryPower' }
 */
function _applyPopRatioBonus(trigger, gameState, bonuses, levelScale) {
    if (!trigger.stratum || !trigger.ratio || !trigger.target) return;
    const { popStructure } = gameState;
    if (!popStructure) return;

    const stratumPop = popStructure[trigger.stratum] || 0;
    const bonus = stratumPop * trigger.ratio * levelScale;

    // 映射 target 到 bonuses 字段
    switch (trigger.target) {
        case 'militaryPower':
        case 'militaryBonus':
            bonuses.militaryBonus = (bonuses.militaryBonus || 0) + bonus;
            break;
        case 'production':
            bonuses.productionBonus = (bonuses.productionBonus || 0) + bonus;
            break;
        case 'scienceBonus':
            bonuses.scienceBonus = (bonuses.scienceBonus || 0) + bonus;
            break;
        case 'cultureBonus':
            bonuses.cultureBonus = (bonuses.cultureBonus || 0) + bonus;
            break;
        default:
            break;
    }
}

/**
 * 产业链关联型：根据完整产业链数量提供加成
 * 例: { type: 'chain_count_bonus', countType: 'complete', perCount: { militaryBonus: 0.10 } }
 */
function _applyChainCountBonus(trigger, gameState, bonuses, levelScale) {
    if (!trigger.perCount) return;
    // 完整产业链数量由 gameState.completedChains 提供
    const chainCount = gameState.completedChains || 0;
    if (chainCount <= 0) return;

    // 上限：最多10条产业链计入
    const cappedCount = Math.min(chainCount, 10);
    for (const [key, value] of Object.entries(trigger.perCount)) {
        const total = value * cappedCount * levelScale;
        _addToBonusField(bonuses, key, total);
    }
}

/**
 * 知识计数型：根据已研发知识数量提供加成
 * 例: { type: 'tech_count_bonus', perTech: { flatPop: 10 } }
 */
function _applyTechCountBonus(trigger, gameState, bonuses, oneTimeEffects, levelScale) {
    if (!trigger.perTech) return;
    const techCount = gameState.techsUnlocked ? gameState.techsUnlocked.length : 0;
    if (techCount <= 0) return;

    for (const [key, value] of Object.entries(trigger.perTech)) {
        const total = value * techCount * levelScale;
        if (key === 'flatPop') {
            // flatPop 是持续计算效果，存入 oneTimeEffects 供外部使用
            oneTimeEffects.flatPop = (oneTimeEffects.flatPop || 0) + total;
        } else {
            _addToBonusField(bonuses, key, total);
        }
    }
}

/**
 * 资源阈值型：当资源超过阈值时激活效果
 * 例: { type: 'resource_threshold', resource: 'silver', threshold: 10000, bonus: { production: 0.05 } }
 */
function _applyResourceThreshold(trigger, gameState, bonuses, levelScale) {
    if (!trigger.resource || !trigger.threshold || !trigger.bonus) return;
    const { resources } = gameState;
    if (!resources) return;

    const currentAmount = resources[trigger.resource] || 0;
    if (currentAmount < trigger.threshold) return; // 阈值未达到

    _applyScaledEffects(trigger.bonus, bonuses, levelScale);
}

/**
 * 建筑计数型：根据指定类别建筑数量提供加成
 * 例: { type: 'building_count_bonus', category: 'military', per: 10, bonus: { categories: { gather: 0.05 } } }
 */
function _applyBuildingCountBonus(trigger, gameState, bonuses, levelScale) {
    if (!trigger.category || !trigger.per || !trigger.bonus) return;
    const { buildingCategoryCounts } = gameState;
    if (!buildingCategoryCounts) return;

    const count = buildingCategoryCounts[trigger.category] || 0;
    const sets = Math.floor(count / trigger.per);
    if (sets <= 0) return;

    // 上限：最多20组计入
    const cappedSets = Math.min(sets, 20);
    for (let i = 0; i < cappedSets; i++) {
        _applyScaledEffects(trigger.bonus, bonuses, levelScale);
    }
}

/**
 * 时代关联型：按当前时代编号提供累积加成
 * 例: { type: 'epoch_scaling', perEpoch: { production: 0.02 } }
 */
function _applyEpochScaling(trigger, gameState, bonuses, levelScale) {
    if (!trigger.perEpoch) return;
    const epoch = gameState.epoch || 0;
    if (epoch <= 0) return;

    for (const [key, value] of Object.entries(trigger.perEpoch)) {
        const total = value * epoch * levelScale;
        _addToBonusField(bonuses, key, total);
    }
}

// ============ 联动效果 ============

/**
 * 检查已装备理念是否触发联动效果组合
 * @param {Array<string>} equippedIdeologyIds - 已装备理念ID列表
 * @param {Array} synergyConfig - IDEOLOGY_SYNERGIES 联动配置数组
 * @param {Object} bonuses - 效果管道 bonuses
 * @returns {Array} 已激活的联动列表 [{ id, name, effects }]
 */
export function evaluateSynergyEffects(equippedIdeologyIds, synergyConfig, bonuses) {
    if (!Array.isArray(equippedIdeologyIds) || !Array.isArray(synergyConfig)) return [];

    const equippedSet = new Set(equippedIdeologyIds);
    const activeSynergies = [];

    for (const synergy of synergyConfig) {
        if (!synergy || !synergy.required || !synergy.effects) continue;

        // 检查所有所需理念是否都已装备
        const allPresent = synergy.required.every(id => equippedSet.has(id));
        if (!allPresent) continue;

        // 应用联动效果
        applyEffects(synergy.effects, bonuses);
        activeSynergies.push({
            id: synergy.id,
            name: synergy.name,
            effects: synergy.effects,
        });
    }

    return activeSynergies;
}

// ============ 效果缓存 ============

// 缓存键由装备理念ID排序拼接 + 相关状态哈希构成
let _cachedIdeologyKey = null;
let _cachedTriggerResult = null;
let _cachedSynergyResult = null;

/**
 * 生成缓存键
 */
function _buildCacheKey(equippedIds, epoch, techCount) {
    return equippedIds.sort().join(',') + '|' + epoch + '|' + techCount;
}

/**
 * 带缓存的触发效果评估
 * 仅在卡槽变化/相关状态变化时重新计算
 */
export function evaluateTriggerEffectsCached(equippedIdeologies, gameState, bonuses) {
    const ids = equippedIdeologies.map(i => i.id);
    const key = _buildCacheKey(ids, gameState.epoch, gameState.techsUnlocked?.length || 0);

    if (key !== _cachedIdeologyKey) {
        _cachedIdeologyKey = key;
        _cachedTriggerResult = evaluateTriggerEffects(equippedIdeologies, gameState, bonuses);
    } else if (_cachedTriggerResult) {
        // 缓存命中但仍需重新应用到bonuses（因为bonuses每tick重新初始化）
        evaluateTriggerEffects(equippedIdeologies, gameState, bonuses);
    }
    return _cachedTriggerResult;
}

/**
 * 清除缓存（在卡槽变化时调用）
 */
export function invalidateIdeologyCache() {
    _cachedIdeologyKey = null;
    _cachedTriggerResult = null;
    _cachedSynergyResult = null;
}

// ============ 内部工具函数 ============

/**
 * 将缩放后的效果应用到 bonuses
 */
function _applyScaledEffects(effectObj, bonuses, scale) {
    if (scale === 1.0) {
        applyEffects(effectObj, bonuses);
        return;
    }
    // 创建缩放副本
    const scaled = {};
    for (const [key, value] of Object.entries(effectObj)) {
        if (typeof value === 'number') {
            scaled[key] = value * scale;
        } else if (typeof value === 'object' && value !== null) {
            scaled[key] = {};
            for (const [subKey, subVal] of Object.entries(value)) {
                scaled[key][subKey] = typeof subVal === 'number' ? subVal * scale : subVal;
            }
        } else {
            scaled[key] = value;
        }
    }
    applyEffects(scaled, bonuses);
}

/**
 * 将值添加到 bonuses 的指定字段
 */
function _addToBonusField(bonuses, key, value) {
    switch (key) {
        case 'militaryBonus':
            bonuses.militaryBonus = (bonuses.militaryBonus || 0) + value;
            break;
        case 'scienceBonus':
            bonuses.scienceBonus = (bonuses.scienceBonus || 0) + value;
            break;
        case 'cultureBonus':
            bonuses.cultureBonus = (bonuses.cultureBonus || 0) + value;
            break;
        case 'production':
            bonuses.productionBonus = (bonuses.productionBonus || 0) + value;
            break;
        case 'stability':
            bonuses.stabilityBonus = (bonuses.stabilityBonus || 0) + value;
            break;
        case 'incomePercent':
            bonuses.incomePercentBonus = (bonuses.incomePercentBonus || 0) + value;
            break;
        case 'maxPop':
            bonuses.maxPopPercent = (bonuses.maxPopPercent || 0) + value;
            break;
        case 'taxIncome':
            bonuses.taxBonus = (bonuses.taxBonus || 0) + value;
            break;
        default:
            // 对于未知字段，尝试直接累加
            if (typeof bonuses[key] === 'number') {
                bonuses[key] += value;
            }
            break;
    }
}
