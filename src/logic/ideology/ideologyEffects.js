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
 * 支持10种触发类型：
 *  - stratum_bonus: 阶层关联型
 *  - pop_ratio_bonus: 人口比例型
 *  - chain_count_bonus: 产业链关联型
 *  - tech_count_bonus: 知识计数型
 *  - resource_threshold: 资源阈值型
 *  - building_count_bonus: 建筑计数型
 *  - epoch_scaling: 时代关联型
 *  - inverse_scaling: 逆向缩放型（某指标超/低于阈值产生不同效果）
 *  - mutual_exclusion: 互斥惩罚型（与冲突理念同时装备时惩罚）
 *  - diminishing_returns: 递减收益型（同类理念过多时惩罚）
 * 
 * @param {Array} equippedIdeologies - 已装备理念对象列表
 * @param {Object} gameState - 游戏状态快照
 * @param {Object} bonuses - 效果管道 bonuses（用于直接修改）
 * @returns {Object} 额外的触发效果（如 flatPop 等一次性效果）
 */
export function evaluateTriggerEffects(equippedIdeologies, gameState, bonuses) {
    if (!Array.isArray(equippedIdeologies) || equippedIdeologies.length === 0) return {};

    const oneTimeEffects = {}; // 一次性效果（如 flatPop）
    // 预计算：已装备理念ID集合 & 各分类计数（供互斥/递减使用）
    const equippedIds = new Set(equippedIdeologies.map(i => i.id));
    const categoryCounts = {};
    for (const ideo of equippedIdeologies) {
        if (ideo.category) {
            categoryCounts[ideo.category] = (categoryCounts[ideo.category] || 0) + 1;
        }
    }

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
                case 'inverse_scaling':
                    _applyInverseScaling(trigger, gameState, bonuses, levelScale);
                    break;
                case 'mutual_exclusion':
                    _applyMutualExclusion(trigger, equippedIds, bonuses, levelScale);
                    break;
                case 'diminishing_returns':
                    _applyDiminishingReturns(trigger, ideology, categoryCounts, bonuses, levelScale);
                    break;
                case 'conditional_flip':
                    _applyConditionalFlip(trigger, gameState, bonuses, levelScale);
                    break;
                case 'resource_drain':
                    _applyResourceDrain(trigger, gameState, bonuses, oneTimeEffects, levelScale);
                    break;
                // === V2: 5 new trigger types ===
                case 'approval_threshold_bonus':
                    _applyApprovalThresholdBonus(trigger, gameState, bonuses, levelScale);
                    break;
                case 'building_specific_bonus':
                    _applyBuildingSpecificBonus(trigger, gameState, bonuses, levelScale);
                    break;
                case 'unit_count_bonus':
                    _applyUnitCountBonus(trigger, gameState, bonuses, levelScale);
                    break;
                case 'coalition_diversity_bonus':
                    _applyCoalitionDiversityBonus(trigger, gameState, bonuses, levelScale);
                    break;
                case 'official_faction_bonus':
                    _applyOfficialFactionBonus(trigger, gameState, bonuses, levelScale);
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

/**
 * 逆向缩放型：某指标超/低于阈值时产生不同方向的效果
 * 核心博弈：玩家需在源指标高低之间权衡，不再是"越高越好"
 * 例: { type: 'inverse_scaling', source: 'stability', threshold: 50,
 *        aboveBonus: { production: -0.01 }, belowBonus: { production: 0.01 }, cap: 0.15 }
 */
function _applyInverseScaling(trigger, gameState, bonuses, levelScale) {
    if (!trigger.source || trigger.threshold == null) return;

    // 读取源指标值
    let sourceVal = 0;
    switch (trigger.source) {
        case 'stability':
            sourceVal = gameState.stability || 0;
            break;
        case 'population':
            sourceVal = gameState.population || 0;
            break;
        case 'epoch':
            sourceVal = gameState.epoch || 0;
            break;
        case 'treasury':
            sourceVal = gameState.treasury || 0;
            break;
        case 'militaryBonus':
            // 军事加成是累积的百分比值，从bonuses中读取当前累计值
            sourceVal = bonuses.militaryBonus || 0;
            break;
        default:
            // 尝试从resources中读取
            sourceVal = gameState.resources?.[trigger.source] || 0;
            break;
    }

    const diff = sourceVal - trigger.threshold;
    const cap = trigger.cap || 0.15;

    if (diff > 0 && trigger.aboveBonus) {
        // 高于阈值：每超1点应用aboveBonus（通常为负面）
        for (const [key, perUnit] of Object.entries(trigger.aboveBonus)) {
            const raw = perUnit * diff * levelScale;
            const capped = Math.sign(raw) * Math.min(Math.abs(raw), cap);
            _addToBonusField(bonuses, key, capped);
        }
    } else if (diff < 0 && trigger.belowBonus) {
        // 低于阈值：每低1点应用belowBonus（通常为正面）
        const absDiff = Math.abs(diff);
        for (const [key, perUnit] of Object.entries(trigger.belowBonus)) {
            const raw = perUnit * absDiff * levelScale;
            const capped = Math.sign(raw) * Math.min(Math.abs(raw), cap);
            _addToBonusField(bonuses, key, capped);
        }
    }
    // diff === 0 时无效果
}

/**
 * 互斥惩罚型：与冲突理念同时装备时产生负面效果，无冲突时有额外加成
 * 核心博弈：构筑时必须选择阵营路线，不能贪心全要
 * 例: { type: 'mutual_exclusion', conflictsWith: ['egalitarianism'],
 *        penalty: { stability: -8 }, bonusIfPure: { stability: 3 } }
 */
function _applyMutualExclusion(trigger, equippedIds, bonuses, levelScale) {
    if (!trigger.conflictsWith || !Array.isArray(trigger.conflictsWith)) return;

    const hasConflict = trigger.conflictsWith.some(id => equippedIds.has(id));

    if (hasConflict && trigger.penalty) {
        // 存在冲突理念：施加惩罚
        _applyScaledEffects(trigger.penalty, bonuses, levelScale);
    } else if (!hasConflict && trigger.bonusIfPure) {
        // 无冲突理念：给予额外加成
        _applyScaledEffects(trigger.bonusIfPure, bonuses, levelScale);
    }
}

/**
 * 递减收益型：同类别理念装备越多，边际收益递减甚至产生惩罚
 * 核心博弈：鼓励混搭不同类别，而非全押一个方向
 * 例: { type: 'diminishing_returns', category: 'military', threshold: 1,
 *        perExtra: { militaryBonus: -0.03 } }
 */
function _applyDiminishingReturns(trigger, ideology, categoryCounts, bonuses, levelScale) {
    // 使用理念自身的category或trigger指定的category
    const targetCategory = trigger.category || ideology.category;
    if (!targetCategory) return;

    const count = categoryCounts[targetCategory] || 0;
    const threshold = trigger.threshold || 1; // 从第N+1个开始触发

    if (count <= threshold) return; // 未超过阈值，不触发

    const extraCount = count - threshold;
    if (!trigger.perExtra) return;

    for (const [key, perExtraVal] of Object.entries(trigger.perExtra)) {
        const total = perExtraVal * extraCount * levelScale;
        _addToBonusField(bonuses, key, total);
    }
}

/**
 * 条件翻转型：某条件满足时效果从正面翻转为负面（或反之）
 * 核心博弈：同一理念在不同局势下利弊反转，玩家需要动态管理
 * 例: { type: 'conditional_flip', condition: 'isAtWar', threshold: null,
 *        normalBonus: { cultureBonus: 0.05 }, flippedBonus: { cultureBonus: -0.08 } }
 * 支持的条件：isAtWar / stability_below / stability_above / epoch_above / population_above / treasury_below
 */
function _applyConditionalFlip(trigger, gameState, bonuses, levelScale) {
    if (!trigger.condition) return;

    let conditionMet = false;
    const threshold = trigger.threshold ?? 0;

    switch (trigger.condition) {
        case 'isAtWar':
            conditionMet = !!gameState.isAtWar;
            break;
        case 'stability_below':
            conditionMet = (gameState.stability || 0) < threshold;
            break;
        case 'stability_above':
            conditionMet = (gameState.stability || 0) > threshold;
            break;
        case 'epoch_above':
            conditionMet = (gameState.epoch || 0) > threshold;
            break;
        case 'population_above':
            conditionMet = (gameState.population || 0) > threshold;
            break;
        case 'treasury_below':
            conditionMet = (gameState.treasury || 0) < threshold;
            break;
        default:
            break;
    }

    if (conditionMet && trigger.flippedBonus) {
        // 条件满足：应用翻转后的（通常为负面）效果
        _applyScaledEffects(trigger.flippedBonus, bonuses, levelScale);
    } else if (!conditionMet && trigger.normalBonus) {
        // 条件未满足：应用正常效果
        _applyScaledEffects(trigger.normalBonus, bonuses, levelScale);
    }
}

/**
 * 资源消耗型：理念每tick消耗指定资源，资源充足时给予加成，不足时施加惩罚
 * 核心博弈：强力效果需要持续的经济投入来维持，国库空虚时理念反成累赘
 * 例: { type: 'resource_drain', resource: 'silver', drainPerTick: 5,
 *        bonus: { scienceBonus: 0.08 }, penaltyIfDrained: { scienceBonus: -0.05, stability: -3 } }
 */
function _applyResourceDrain(trigger, gameState, bonuses, oneTimeEffects, levelScale) {
    if (!trigger.resource) return;

    const drain = (trigger.drainPerTick || 0) * levelScale;
    const available = gameState.resources?.[trigger.resource] || 0;

    if (available >= drain) {
        // 资源充足：给予加成，并记录消耗量供 simulation 扣减
        if (trigger.bonus) {
            _applyScaledEffects(trigger.bonus, bonuses, levelScale);
        }
        // 记录资源消耗到 oneTimeEffects，由 simulation.js 实际扣减
        if (drain > 0) {
            if (!oneTimeEffects.resourceDrains) {
                oneTimeEffects.resourceDrains = {};
            }
            oneTimeEffects.resourceDrains[trigger.resource] =
                (oneTimeEffects.resourceDrains[trigger.resource] || 0) + drain;
        }
    } else {
        // 资源不足：施加惩罚
        if (trigger.penaltyIfDrained) {
            _applyScaledEffects(trigger.penaltyIfDrained, bonuses, levelScale);
        }
    }
}

// ============ V2: New Trigger Type Implementations ============

/**
 * V2: Approval threshold bonus — activates when a stratum's approval crosses a threshold.
 * { type: 'approval_threshold_bonus', stratum: 'worker', threshold: 70, bonus: { industryBonus: 0.08 }, invert?: boolean }
 * invert=true: bonus when approval < threshold (used for serfdom-like mechanics)
 */
function _applyApprovalThresholdBonus(trigger, gameState, bonuses, levelScale) {
    if (!trigger.stratum || !trigger.bonus || trigger.threshold == null) return;
    const approval = gameState.classApproval?.[trigger.stratum] ?? 50;
    const met = trigger.invert ? (approval < trigger.threshold) : (approval >= trigger.threshold);
    if (met) {
        _applyScaledEffects(trigger.bonus, bonuses, levelScale);
    }
}

/**
 * V2: Building-specific bonus — bonus per N instances of a specific building (by ID, not category).
 * { type: 'building_specific_bonus', buildingId: 'large_estate', per: 1, bonus: { production: 0.02 }, cap: 0.10, target?: string }
 */
function _applyBuildingSpecificBonus(trigger, gameState, bonuses, levelScale) {
    if (!trigger.buildingId || !trigger.bonus) return;
    const count = gameState.buildingCounts?.[trigger.buildingId] || 0;
    const per = trigger.per || 1;
    const sets = Math.floor(count / per);
    if (sets <= 0) return;
    const cap = trigger.cap || 0.20;
    // Apply bonus per set, capped
    for (const [key, value] of Object.entries(trigger.bonus)) {
        const total = value * sets * levelScale;
        const capped = Math.sign(total) * Math.min(Math.abs(total), cap);
        _addToBonusField(bonuses, key, capped);
    }
}

/**
 * V2: Unit count bonus — bonus based on military unit category count.
 * { type: 'unit_count_bonus', category: 'cavalry', per: 5, bonus: { militaryBonus: 0.02 }, cap: 0.12 }
 */
function _applyUnitCountBonus(trigger, gameState, bonuses, levelScale) {
    if (!trigger.category || !trigger.bonus) return;
    const count = gameState.unitCategoryCounts?.[trigger.category] || 0;
    const per = trigger.per || 1;
    const sets = Math.floor(count / per);
    if (sets <= 0) return;
    const cap = trigger.cap || 0.20;
    for (const [key, value] of Object.entries(trigger.bonus)) {
        const total = value * sets * levelScale;
        const capped = Math.sign(total) * Math.min(Math.abs(total), cap);
        _addToBonusField(bonuses, key, capped);
    }
}

/**
 * V2: Coalition diversity bonus — bonus for each unique stratum in the ruling coalition.
 * { type: 'coalition_diversity_bonus', perStratum: { cultureBonus: 0.03 }, cap: 0.18 }
 */
function _applyCoalitionDiversityBonus(trigger, gameState, bonuses, levelScale) {
    if (!trigger.perStratum) return;
    const coalition = gameState.rulingCoalition;
    if (!Array.isArray(coalition)) return;
    // Count unique strata in the ruling coalition
    const uniqueStrata = new Set(coalition.map(c => typeof c === 'string' ? c : c?.stratum || c?.key).filter(Boolean));
    const count = uniqueStrata.size;
    if (count <= 0) return;
    const cap = trigger.cap || 0.20;
    for (const [key, value] of Object.entries(trigger.perStratum)) {
        const total = value * count * levelScale;
        const capped = Math.sign(total) * Math.min(Math.abs(total), cap);
        _addToBonusField(bonuses, key, capped);
    }
}

/**
 * V2: Official faction bonus — bonus per official of a specific faction.
 * { type: 'official_faction_bonus', faction: 'academic', per: 1, bonus: { scienceBonus: 0.02 }, cap: { scienceBonus: 0.10 } }
 */
function _applyOfficialFactionBonus(trigger, gameState, bonuses, levelScale) {
    if (!trigger.faction || !trigger.bonus) return;
    const officials = gameState.officials;
    if (!Array.isArray(officials)) return;
    const per = trigger.per || 1;
    // Count officials matching the faction and currently hired
    const matchCount = officials.filter(o =>
        o.hired && (o.faction === trigger.faction || o.stance === trigger.faction)
    ).length;
    const sets = Math.floor(matchCount / per);
    if (sets <= 0) return;
    const capObj = trigger.cap || {};
    const capVal = typeof capObj === 'number' ? capObj : null;
    for (const [key, value] of Object.entries(trigger.bonus)) {
        const total = value * sets * levelScale;
        const keyCap = capVal ?? (typeof capObj === 'object' ? capObj[key] : null) ?? 0.20;
        const capped = Math.sign(total) * Math.min(Math.abs(total), keyCap);
        _addToBonusField(bonuses, key, capped);
    }
}

// ============ 联动效果 ============

/**
 * 检查已装备理念是否触发联动效果组合
 * @param {Array<string>} equippedIdeologyIds - 已装备理念ID列表
 * @param {Array} synergyConfig - IDEOLOGY_SYNERGIES 联动配置数组
 * @param {Object} bonuses - 效果管道 bonuses
 * @returns {{ activeSynergies: Array, mechanicEffects: Object }} 
 *   activeSynergies: [{ id, name, effects, mechanicEffect? }]
 *   mechanicEffects: aggregated mechanic effects by type
 */
export function evaluateSynergyEffects(equippedIdeologyIds, synergyConfig, bonuses) {
    if (!Array.isArray(equippedIdeologyIds) || !Array.isArray(synergyConfig)) {
        return { activeSynergies: [], mechanicEffects: _emptyMechanicEffects() };
    }

    const equippedSet = new Set(equippedIdeologyIds);
    const activeSynergies = [];
    const mechanicEffects = _emptyMechanicEffects();

    for (const synergy of synergyConfig) {
        if (!synergy || !synergy.required) continue;

        // 检查所有所需理念是否都已装备
        const allPresent = synergy.required.every(id => equippedSet.has(id));
        if (!allPresent) continue;

        // 应用联动数值效果（向后兼容，effects可能为空）
        if (synergy.effects) {
            applyEffects(synergy.effects, bonuses);
        }

        // 处理mechanicEffect（新增）
        if (synergy.mechanicEffect) {
            _collectMechanicEffect(synergy.mechanicEffect, mechanicEffects);
        }

        activeSynergies.push({
            id: synergy.id,
            name: synergy.name,
            effects: synergy.effects,
            mechanicEffect: synergy.mechanicEffect || null,
        });
    }

    return { activeSynergies, mechanicEffects };
}

/**
 * 反协同效果：特定理念组合产生负面惩罚
 * 与正向联动相反，某些理念在一起会产生内在矛盾，互相削弱
 * @param {Array<string>} equippedIdeologyIds - 已装备理念ID列表
 * @param {Array} antiSynergyConfig - ANTI_SYNERGIES 反协同配置数组
 * @param {Object} bonuses - 效果管道 bonuses
 * @returns {{ activeAntiSynergies: Array }} 激活的反协同列表
 */
export function evaluateAntiSynergyEffects(equippedIdeologyIds, antiSynergyConfig, bonuses) {
    if (!Array.isArray(equippedIdeologyIds) || !Array.isArray(antiSynergyConfig)) {
        return { activeAntiSynergies: [] };
    }

    const equippedSet = new Set(equippedIdeologyIds);
    const activeAntiSynergies = [];

    for (const anti of antiSynergyConfig) {
        if (!anti || !anti.required) continue;

        // 只要 required 中的理念全部装备就触发惩罚
        const allPresent = anti.required.every(id => equippedSet.has(id));
        if (!allPresent) continue;

        // 应用反协同负面效果
        if (anti.effects) {
            applyEffects(anti.effects, bonuses);
        }

        activeAntiSynergies.push({
            id: anti.id,
            name: anti.name,
            effects: anti.effects,
        });
    }

    return { activeAntiSynergies };
}

/**
 * Empty mechanic effects structure for safe access.
 */
function _emptyMechanicEffects() {
    return {
        autoBuilds: [],        // { buildingId, intervalDays }
        resourceEchoes: [],    // { sourceResource, echoResource, ratio }
        crisisImmunities: [],  // { immuneTo }
        epochRush: 0,          // total cost reduction
    };
}

/**
 * Collect a single mechanicEffect into the aggregated structure.
 */
function _collectMechanicEffect(me, target) {
    if (!me || !me.type) return;
    switch (me.type) {
        case 'auto_build':
            target.autoBuilds.push({
                buildingId: me.buildingId,
                intervalDays: me.intervalDays || 60,
            });
            break;
        case 'resource_echo':
            target.resourceEchoes.push({
                sourceResource: me.sourceResource,
                echoResource: me.echoResource,
                ratio: me.ratio || 0.1,
            });
            break;
        case 'crisis_immunity':
            target.crisisImmunities.push({
                immuneTo: me.immuneTo,
            });
            break;
        case 'epoch_rush':
            target.epochRush += (me.costReduction || 0);
            break;
        default:
            break;
    }
}

// ============ 转化引擎 (Converters) ============

// Safety caps: single converter max 50%, total converters max 100%
const CONVERTER_SINGLE_CAP = 0.50;
const CONVERTER_TOTAL_CAP = 1.00;

/**
 * Source value reader — extracts the source value from triggerState based on sourceType.
 */
function _readSourceValue(converter, triggerState) {
    const { source, sourceType } = converter;
    switch (sourceType) {
        case 'resource':
            return triggerState.resources?.[source] || 0;
        case 'buildingCount':
            return triggerState.buildingCategoryCounts?.[source] || triggerState.totalBuildings || 0;
        case 'officialCount':
            return triggerState.officialCount || 0;
        case 'population':
            return triggerState.population || 0;
        case 'stability':
            return triggerState.stability || 0;
        // === V2: 12 new sourceTypes ===
        case 'warCount':
            return triggerState.warCount || 0;
        case 'friendlyCount':
            return triggerState.friendlyCount || 0;
        case 'vassalCount':
            return triggerState.vassalCount || 0;
        case 'tradeVolume':
            return triggerState.tradeVolume || 0;
        case 'unemployment':
            return triggerState.unemployment || 0;
        case 'legitimacy':
            return triggerState.legitimacy || 0;
        case 'avgApproval':
            return triggerState.avgApproval || 0;
        case 'militarySize':
            return triggerState.militarySize || 0;
        case 'wealthyPop':
            return _sumPopByLivingStandard(triggerState, 'wealthy');
        case 'poorPop':
            return _sumPopByLivingStandard(triggerState, 'poor');
        case 'specificBuilding':
            return triggerState.buildingCounts?.[source] || 0;
        case 'unitCategory':
            return triggerState.unitCategoryCounts?.[source] || 0;
        default:
            return 0;
    }
}

/**
 * V2: Sum population by living standard tier.
 * 'wealthy' = level >= 3 (小康以上), 'poor' = level <= 1 (贫困以下)
 */
function _sumPopByLivingStandard(triggerState, tier) {
    const cls = triggerState.classLivingStandard;
    if (!cls || typeof cls !== 'object') return 0;
    let sum = 0;
    for (const [stratum, data] of Object.entries(cls)) {
        const pop = triggerState.popStructure?.[stratum] || 0;
        if (pop <= 0) continue;
        // classLivingStandard entries may be objects with a level property or numeric
        const level = typeof data === 'number' ? data : (data?.level || 0);
        const numLevel = typeof level === 'string'
            ? ({ '赤贫': 0, '贫困': 1, '温饱': 2, '小康': 3, '富裕': 4, '奢华': 5 }[level] ?? 2)
            : level;
        if (tier === 'wealthy' && numLevel >= 3) sum += pop;
        if (tier === 'poor' && numLevel <= 1) sum += pop;
    }
    return sum;
}

/**
 * Apply all converter effects from equipped ideologies to bonuses.
 * Converters transform one game state value into a bonus using a ratio.
 * 
 * @param {Array} equippedIdeologies - equipped ideology objects
 * @param {Object} triggerState - game state snapshot (ideologyTriggerState)
 * @param {Object} bonuses - effect pipeline bonuses to modify
 */
export function applyConverters(equippedIdeologies, triggerState, bonuses) {
    if (!Array.isArray(equippedIdeologies) || equippedIdeologies.length === 0) return;

    // Track total converter contributions per bonus key for global cap
    const converterTotals = {};

    for (const ideology of equippedIdeologies) {
        if (!ideology?.effects?.levels) continue;
        const level = ideology.level || 1;
        const levelIndex = Math.min(level, ideology.effects.levels.length) - 1;
        const levelEffects = ideology.effects.levels[levelIndex];
        if (!levelEffects?.converters) continue;

        const levelScale = level === 1 ? 1.0 : level === 2 ? 1.5 : 2.0;

        for (const converter of levelEffects.converters) {
            if (!converter?.source || !converter?.sourceType || !converter?.target) continue;

            const sourceVal = _readSourceValue(converter, triggerState);
            if (sourceVal <= 0) continue;

            // Calculate raw converted value
            let converted = sourceVal * (converter.ratio || 0) * levelScale;

            // Apply per-converter cap
            if (converter.cap != null) {
                converted = Math.min(converted, converter.cap * levelScale);
            }

            // Apply single converter safety cap
            converted = Math.min(converted, CONVERTER_SINGLE_CAP);

            // Track for global cap
            const targetKey = converter.target;
            converterTotals[targetKey] = (converterTotals[targetKey] || 0) + converted;

            // Enforce global cap before applying
            if (converterTotals[targetKey] > CONVERTER_TOTAL_CAP) {
                const excess = converterTotals[targetKey] - CONVERTER_TOTAL_CAP;
                converted -= excess;
                converterTotals[targetKey] = CONVERTER_TOTAL_CAP;
            }

            if (converted <= 0) continue;

            // Apply to bonuses
            _addToBonusField(bonuses, targetKey, converted);
        }
    }
}

// ============ 规则修改 (Rule Mods) ============

/**
 * Collect all active rule modifications from equipped ideologies.
 * Returns an aggregated ruleMods object for other systems to consume.
 * 
 * @param {Array} equippedIdeologies - equipped ideology objects
 * @returns {Object} activeRuleMods - { building_cost_mod: { [scope]: value }, official_bonus: {...}, ... }
 */
export function applyRuleMods(equippedIdeologies) {
    const activeRuleMods = {
        building_cost_mod: {},
        official_bonus: {},
        tax_modifier: {},
        cooldown_mod: {},
        price_volatility_mod: {},
        tech_cost_mod: {},
        // === V2: 11 new ruleMod types ===
        stratum_output_mod: {},
        building_input_mod: {},
        unit_attack_mod: {},
        unit_defense_mod: {},
        recruit_cost_mod: {},
        maintenance_cost_mod: {},
        corruption_mod: {},
        wages_mod: {},
        trade_route_mod: {},
        resource_price_mod: {},
        diplomatic_influence: {},
    };

    if (!Array.isArray(equippedIdeologies) || equippedIdeologies.length === 0) return activeRuleMods;

    for (const ideology of equippedIdeologies) {
        if (!ideology?.effects?.levels) continue;
        const level = ideology.level || 1;
        const levelIndex = Math.min(level, ideology.effects.levels.length) - 1;
        const levelEffects = ideology.effects.levels[levelIndex];
        if (!levelEffects?.ruleMods) continue;

        const levelScale = level === 1 ? 1.0 : level === 2 ? 1.5 : 2.0;

        for (const mod of levelEffects.ruleMods) {
            if (!mod?.type || mod.value == null) continue;
            const scaledValue = mod.value * levelScale;
            const scope = mod.scope || '_global';
            const bucket = activeRuleMods[mod.type];
            if (bucket) {
                bucket[scope] = (bucket[scope] || 0) + scaledValue;
            }
        }
    }

    return activeRuleMods;
}

// ============ 缓存管理 ============

/**
 * 清除理念效果缓存（在卡槽变化时调用）
 * 保留接口供外部调用，实际效果计算每tick直接执行
 * 因为 bonuses 每tick重新初始化，触发效果必须每tick重新应用
 */
export function invalidateIdeologyCache() {
    // 保留接口兼容性，无需额外缓存逻辑
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
        // [FIX] incomePercent 已全部迁移为 taxIncome，由下方 case 'taxIncome' 处理
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
