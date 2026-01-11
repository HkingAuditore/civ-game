/**
 * Vassal System Module
 * 附庸系统：处理保护国、朝贡国、傀儡国、殖民地的逻辑
 */

import {
    VASSAL_TYPE_CONFIGS,
    calculateIndependenceDesire,
    isDiplomacyUnlocked,
    INDEPENDENCE_WAR_CONDITIONS,
    TRIBUTE_CONFIG,
    INDEPENDENCE_CONFIG,
    calculateAverageSatisfaction,
} from '../../config/diplomacy';

/**
 * 处理所有附庸国的每日更新
 * @param {Object} params - 更新参数
 * @returns {Object} 更新后的状态
 */
export const processVassalUpdates = ({
    nations,
    daysElapsed,
    epoch,
    playerMilitary = 1.0,
    playerStability = 50,
    playerAtWar = false,
    playerWealth = 10000,  // 新增：玩家财富参数
    logs = [],
}) => {
    let tributeIncome = 0;
    let resourceTribute = {};  // 新增：资源朝贡汇总
    const vassalEvents = [];

    const updatedNations = (nations || []).map(nation => {
        // 跳过非附庸国
        if (nation.vassalOf !== 'player') {
            return nation;
        }

        const updated = { ...nation };
        const vassalConfig = VASSAL_TYPE_CONFIGS[updated.vassalType];
        if (!vassalConfig) return updated;

        // 1. 每30天结算朝贡（使用新的计算方式）
        if (daysElapsed > 0 && daysElapsed % 30 === 0) {
            const tribute = calculateEnhancedTribute(updated, playerWealth);
            
            if (tribute.silver > 0) {
                tributeIncome += tribute.silver;
                updated.wealth = Math.max(0, (updated.wealth || 0) - tribute.silver);
                logs.push(`📜 ${updated.name}（${vassalConfig.name}）缴纳朝贡 ${tribute.silver} 银币`);
            }
            
            // 处理资源朝贡
            if (Object.keys(tribute.resources).length > 0) {
                Object.entries(tribute.resources).forEach(([resourceKey, amount]) => {
                    // 从附庸库存扣除
                    if (updated.nationInventories && updated.nationInventories[resourceKey]) {
                        updated.nationInventories[resourceKey] = Math.max(
                            0, 
                            updated.nationInventories[resourceKey] - amount
                        );
                    }
                    // 汇总资源朝贡
                    resourceTribute[resourceKey] = (resourceTribute[resourceKey] || 0) + amount;
                });
                
                const resourceList = Object.entries(tribute.resources)
                    .map(([k, v]) => `${k}:${v}`)
                    .join(', ');
                logs.push(`📦 ${updated.name} 朝贡资源: ${resourceList}`);
            }
        }

        // 2. 更新独立倾向（使用新的计算方式）
        const independenceGrowth = getEnhancedIndependenceGrowthRate(
            updated.vassalType, 
            epoch,
            updated.socialStructure
        );
        
        // 应用控制手段的减免（如果有）
        let effectiveGrowth = independenceGrowth;
        if (updated.vassalPolicy?.controlMeasures) {
            const measures = updated.vassalPolicy.controlMeasures;
            if (measures.governor) effectiveGrowth -= INDEPENDENCE_CONFIG.controlMeasures.governor.independenceReduction;
            if (measures.garrison) effectiveGrowth -= INDEPENDENCE_CONFIG.controlMeasures.garrison.independenceReduction;
        }
        
        updated.independencePressure = Math.min(100, Math.max(0,
            (updated.independencePressure || 0) + Math.max(0, effectiveGrowth)
        ));

        // 3. 检查独立战争触发
        const independenceDesire = calculateIndependenceDesire(updated, playerMilitary);
        if (independenceDesire >= INDEPENDENCE_WAR_CONDITIONS.minIndependenceDesire) {
            const warTriggered = checkIndependenceWarTrigger({
                vassalNation: updated,
                playerAtWar,
                playerStability,
                nations,
            });

            if (warTriggered) {
                updated.isAtWar = true;
                updated.warTarget = 'player';
                updated.independenceWar = true;
                updated.vassalOf = null;
                updated.vassalType = null;
                
                vassalEvents.push({
                    type: 'independence_war',
                    nationId: updated.id,
                    nationName: updated.name,
                });
                
                logs.push(`⚠️ ${updated.name} 发动独立战争！`);
            }
        }

        // 4. 自主度缓慢恢复（除非是殖民地）
        if (updated.vassalType !== 'colony' && updated.autonomy < vassalConfig.autonomy) {
            updated.autonomy = Math.min(vassalConfig.autonomy, (updated.autonomy || 0) + 0.1);
        }

        return updated;
    });

    return {
        nations: updatedNations,
        tributeIncome,
        resourceTribute,  // 新增：返回资源朝贡
        vassalEvents,
    };
};

/**
 * 计算朝贡金额（重构版）
 * 基于玩家财富和附庸规模计算有意义的朝贡金额
 * @param {Object} vassalNation - 附庸国对象
 * @param {number} playerWealth - 玩家财富（可选）
 * @returns {Object} { silver: 金钱朝贡, resources: 资源朝贡 }
 */
export const calculateEnhancedTribute = (vassalNation, playerWealth = 10000) => {
    if (!vassalNation || vassalNation.vassalOf === null) {
        return { silver: 0, resources: {} };
    }
    
    const config = TRIBUTE_CONFIG;
    const tributeRate = vassalNation.tributeRate || 0;
    const autonomy = vassalNation.autonomy || 100;
    const vassalWealth = vassalNation.wealth || 500;
    
    // 计算基础朝贡金额
    // 公式: max(固定基数, 玩家财富×比例) × 附庸财富占比 × 朝贡率
    const playerBasedTribute = playerWealth * config.playerWealthRate;
    const vassalBasedTribute = vassalWealth * config.vassalWealthRate;
    
    let baseTribute = Math.max(
        config.baseAmount,
        playerBasedTribute * 0.5 + vassalBasedTribute * 0.5
    );
    
    // 应用朝贡率
    baseTribute *= tributeRate;
    
    // 附庸规模系数
    let sizeMultiplier = config.sizeMultipliers.small;
    if (vassalWealth > 3000) {
        sizeMultiplier = config.sizeMultipliers.large;
    } else if (vassalWealth > 1000) {
        sizeMultiplier = config.sizeMultipliers.medium;
    }
    baseTribute *= sizeMultiplier;
    
    // 自主度降低实际朝贡
    const autonomyFactor = 1 - (autonomy / 200);
    baseTribute *= autonomyFactor;
    
    // 独立倾向降低实际朝贡
    const independenceDesire = vassalNation.independencePressure || 0;
    const resistanceFactor = Math.max(0.3, 1 - (independenceDesire / 150));
    baseTribute *= resistanceFactor;
    
    // 计算资源朝贡
    const resources = {};
    if (config.resourceTribute.enabled && vassalNation.nationInventories) {
        config.resourceTribute.resources.forEach(resourceKey => {
            const inventory = vassalNation.nationInventories[resourceKey] || 0;
            if (inventory > 10) {
                // 基于库存和朝贡率计算资源朝贡
                const resourceAmount = Math.floor(
                    Math.min(
                        inventory * 0.1,  // 最多朝贡10%库存
                        config.resourceTribute.baseAmount * tributeRate * sizeMultiplier
                    ) * autonomyFactor * resistanceFactor
                );
                if (resourceAmount > 0) {
                    resources[resourceKey] = resourceAmount;
                }
            }
        });
    }
    
    return {
        silver: Math.floor(baseTribute),
        resources,
    };
};

/**
 * 获取独立倾向增长率（每天）- 重构版
 * @param {string} vassalType - 附庸类型
 * @param {number} epoch - 当前时代
 * @param {Object} socialStructure - 阶层结构
 * @returns {number} 每日增长率
 */
const getEnhancedIndependenceGrowthRate = (vassalType, epoch, socialStructure = null) => {
    const config = INDEPENDENCE_CONFIG;
    
    // 基础增长率
    const baseRate = config.dailyGrowthRates[vassalType] || 0.15;
    
    // 时代系数（后期民族主义更强）
    const eraMultiplier = config.eraMultiplier.base + 
        Math.max(0, epoch - 3) * config.eraMultiplier.perEra;
    
    let rate = baseRate * eraMultiplier;
    
    // 阶层满意度影响
    if (socialStructure) {
        const avgSatisfaction = calculateAverageSatisfaction(socialStructure);
        
        if (avgSatisfaction < config.satisfactionThresholds.critical) {
            // 满意度极低：大幅增加独立倾向
            rate *= 2.0;
        } else if (avgSatisfaction < config.satisfactionThresholds.low) {
            // 满意度低：增加独立倾向
            rate *= 1.3;
        } else if (avgSatisfaction > config.satisfactionThresholds.high) {
            // 满意度高：降低独立倾向
            rate *= 0.7;
        }
    }
    
    return rate;
};

/**
 * 检查是否触发独立战争
 * @param {Object} params - 检查参数
 * @returns {boolean} 是否触发
 */
const checkIndependenceWarTrigger = ({
    vassalNation,
    playerAtWar,
    playerStability,
    nations,
}) => {
    const triggers = INDEPENDENCE_WAR_CONDITIONS.triggers;
    
    // 宗主处于战争状态
    if (playerAtWar && Math.random() < triggers.overlordAtWar.probability) {
        return true;
    }
    
    // 宗主稳定度低
    if (playerStability < triggers.overlordLowStability.threshold &&
        Math.random() < triggers.overlordLowStability.probability) {
        return true;
    }
    
    // 外国支持（检查是否有第三方国家关系良好）
    const foreignSupporter = (nations || []).find(n => 
        n.id !== vassalNation.id &&
        n.vassalOf !== 'player' &&
        (n.foreignRelations?.[vassalNation.id] || 50) >= triggers.foreignSupport.minRelation
    );
    if (foreignSupporter && Math.random() < triggers.foreignSupport.probability) {
        return true;
    }
    
    return false;
};

/**
 * 建立附庸关系
 * @param {Object} nation - 目标国家
 * @param {string} vassalType - 附庸类型
 * @param {number} epoch - 当前时代
 * @returns {Object} 更新后的国家对象
 */
export const establishVassalRelation = (nation, vassalType, epoch) => {
    const config = VASSAL_TYPE_CONFIGS[vassalType];
    if (!config) {
        throw new Error(`无效的附庸类型: ${vassalType}`);
    }
    
    // 检查时代解锁
    if (!isDiplomacyUnlocked('sovereignty', vassalType, epoch)) {
        throw new Error(`${config.name}尚未解锁（需要时代 ${config.minEra}）`);
    }
    
    return {
        ...nation,
        vassalOf: 'player',
        vassalType,
        autonomy: config.autonomy,
        tributeRate: config.tributeRate,
        independencePressure: 0,
        // 结束战争状态
        isAtWar: false,
        warTarget: null,
        warScore: 0,
    };
};

/**
 * 解除附庸关系
 * @param {Object} nation - 附庸国
 * @param {string} reason - 解除原因
 * @returns {Object} 更新后的国家对象
 */
export const releaseVassal = (nation, reason = 'released') => {
    const relationChange = reason === 'released' ? 20 : -30;
    
    return {
        ...nation,
        vassalOf: null,
        vassalType: null,
        autonomy: 100,
        tributeRate: 0,
        independencePressure: 0,
        relation: Math.min(100, Math.max(0, (nation.relation || 50) + relationChange)),
    };
};

/**
 * 调整附庸政策
 * @param {Object} nation - 附庸国
 * @param {Object} policyChanges - 政策变更
 * @returns {Object} 更新后的国家对象
 */
export const adjustVassalPolicy = (nation, policyChanges) => {
    if (nation.vassalOf !== 'player') {
        throw new Error('只能调整玩家的附庸国');
    }
    
    const updated = { ...nation };
    const config = VASSAL_TYPE_CONFIGS[updated.vassalType];
    
    // 初始化附庸政策对象（如果不存在）
    if (!updated.vassalPolicy) {
        updated.vassalPolicy = {
            diplomaticControl: 'guided',
            tradePolicy: 'preferential',
        };
    }
    
    // 调整外交控制政策
    if (policyChanges.diplomaticControl) {
        const validOptions = ['autonomous', 'guided', 'puppet'];
        if (validOptions.includes(policyChanges.diplomaticControl)) {
            updated.vassalPolicy.diplomaticControl = policyChanges.diplomaticControl;
            
            // 外交控制对独立倾向的影响
            const independenceEffects = {
                autonomous: -2,  // 自主外交降低独立倾向
                guided: 0,       // 引导外交无影响
                puppet: 3,       // 傀儡外交增加独立倾向
            };
            updated.independencePressure = Math.min(100, Math.max(0,
                (updated.independencePressure || 0) + independenceEffects[policyChanges.diplomaticControl]
            ));
        }
    }
    
    // 调整贸易政策
    if (policyChanges.tradePolicy) {
        const validOptions = ['free', 'preferential', 'monopoly'];
        if (validOptions.includes(policyChanges.tradePolicy)) {
            updated.vassalPolicy.tradePolicy = policyChanges.tradePolicy;
            
            // 贸易政策对独立倾向的影响
            const independenceEffects = {
                free: -2,        // 自由贸易降低独立倾向
                preferential: 0, // 优惠准入无影响
                monopoly: 5,     // 垄断贸易大幅增加独立倾向
            };
            updated.independencePressure = Math.min(100, Math.max(0,
                (updated.independencePressure || 0) + independenceEffects[policyChanges.tradePolicy]
            ));
        }
    }
    
    // 调整朝贡率
    if (typeof policyChanges.tributeRate === 'number') {
        const baseTributeRate = config?.tributeRate || 0.1;
        // 允许在基础值的50%-150%范围内调整
        updated.tributeRate = Math.min(baseTributeRate * 1.5,
            Math.max(baseTributeRate * 0.5, policyChanges.tributeRate));
        
        // 提高朝贡率会增加独立倾向
        if (policyChanges.tributeRate > baseTributeRate) {
            const increase = Math.ceil((policyChanges.tributeRate - baseTributeRate) / baseTributeRate * 10);
            updated.independencePressure = Math.min(100,
                (updated.independencePressure || 0) + increase);
        }
    }
    
    // 调整自主度
    if (typeof policyChanges.autonomy === 'number') {
        const baseAutonomy = config?.autonomy || 50;
        // 允许在基础值的50%-120%范围内调整
        updated.autonomy = Math.min(Math.min(100, baseAutonomy * 1.2),
            Math.max(baseAutonomy * 0.5, policyChanges.autonomy));
        
        // 降低自主度会增加独立倾向
        if (policyChanges.autonomy < baseAutonomy) {
            const increase = Math.ceil((baseAutonomy - policyChanges.autonomy) / baseAutonomy * 10);
            updated.independencePressure = Math.min(100,
                (updated.independencePressure || 0) + increase);
        }
    }
    
    return updated;
};

/**
 * 获取玩家的所有附庸国
 * @param {Array} nations - 所有国家列表
 * @returns {Array} 附庸国列表
 */
export const getPlayerVassals = (nations) => {
    return (nations || []).filter(n => n.vassalOf === 'player');
};

/**
 * 计算附庸系统带来的总收益
 * @param {Array} nations - 所有国家列表
 * @param {number} playerWealth - 玩家财富（可选）
 * @returns {Object} 收益汇总
 */
export const calculateVassalBenefits = (nations, playerWealth = 10000) => {
    const vassals = getPlayerVassals(nations);
    
    let totalTribute = 0;
    let totalTradeBonus = 0;
    let totalResourceTribute = {};
    
    vassals.forEach(vassal => {
        const tribute = calculateEnhancedTribute(vassal, playerWealth);
        totalTribute += tribute.silver;
        
        // 汇总资源朝贡
        Object.entries(tribute.resources).forEach(([res, amount]) => {
            totalResourceTribute[res] = (totalResourceTribute[res] || 0) + amount;
        });
        
        const config = VASSAL_TYPE_CONFIGS[vassal.vassalType];
        if (config) {
            totalTradeBonus += config.tariffDiscount;
        }
    });
    
    return {
        vassalCount: vassals.length,
        monthlyTribute: totalTribute,
        monthlyResourceTribute: totalResourceTribute,
        tradeBonus: totalTradeBonus / Math.max(1, vassals.length),
    };
};

/**
 * 检查是否可以建立特定类型的附庸关系
 * @param {Object} nation - 目标国家
 * @param {string} vassalType - 附庸类型
 * @param {Object} params - 检查参数
 * @returns {Object} { canEstablish, reason }
 */
export const canEstablishVassal = (nation, vassalType, { epoch, playerMilitary, warScore }) => {
    const config = VASSAL_TYPE_CONFIGS[vassalType];
    if (!config) {
        return { canEstablish: false, reason: '无效的附庸类型' };
    }
    
    // 检查时代解锁
    if (!isDiplomacyUnlocked('sovereignty', vassalType, epoch)) {
        return { canEstablish: false, reason: `需要时代 ${config.minEra} 解锁` };
    }
    
    // 已经是附庸
    if (nation.vassalOf) {
        return { canEstablish: false, reason: '该国已是附庸国' };
    }
    
    // 检查关系要求（战争状态下通过战争分数判断）
    if (nation.isAtWar) {
        const requirements = {
            protectorate: 30,
            tributary: 50,
            puppet: 80,
            colony: 100,
        };
        if ((warScore || 0) < (requirements[vassalType] || 50)) {
            return { canEstablish: false, reason: `战争分数不足（需要 ${requirements[vassalType]}）` };
        }
    } else {
        // 和平状态需要高关系
        if ((nation.relation || 50) < config.minRelation) {
            return { canEstablish: false, reason: `关系不足（需要 ${config.minRelation}）` };
        }
    }
    
    // 检查军事力量比
    const militaryRatio = (nation.militaryStrength || 0.5) / Math.max(0.1, playerMilitary);
    if (militaryRatio > 0.8 && !nation.isAtWar) {
        return { canEstablish: false, reason: '对方军事力量过强' };
    }
    
    return { canEstablish: true, reason: null };
};
