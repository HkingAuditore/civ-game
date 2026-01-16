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
    LABOR_POLICY_DEFINITIONS,
    TRADE_POLICY_DEFINITIONS,
    GOVERNANCE_POLICY_DEFINITIONS,
    VASSAL_POLICY_PRESETS,
} from '../../config/diplomacy.js';
import { calculateGovernorFullEffects } from './vassalGovernors.js';

/**
 * Calculate dynamic control cost based on vassal wealth
 * @param {string} measureType - Control measure type
 * @param {number} vassalWealth - Vassal nation wealth
 * @returns {number} Daily cost
 */
export const calculateControlMeasureCost = (measureType, vassalWealth = 1000) => {
    const measureConfig = INDEPENDENCE_CONFIG.controlMeasures[measureType];
    if (!measureConfig) return 0;

    const baseCost = measureConfig.baseCost || 50;
    const scalingFactor = measureConfig.wealthScalingFactor || 0;
    const scaledCost = Math.floor(vassalWealth * scalingFactor);

    return baseCost + scaledCost;
};

/**
 * Calculate governor effectiveness based on assigned official
 * @param {Object} official - Assigned official object
 * @param {Object} measureConfig - Governor measure config
 * @returns {Object} Effectiveness data
 */
export const calculateGovernorEffectiveness = (official, measureConfig) => {
    if (!official) {
        return {
            effectiveness: 0,
            independenceReduction: 0,
            satisfactionBonus: 0,
            warning: 'no_official',
        };
    }

    const baseEffectiveness = measureConfig.baseEffectiveness || 0.5;

    // Prestige affects effectiveness (0-100 scale)
    const prestigeFactor = (official.prestige || 50) / 100;

    // Loyalty affects reliability (low loyalty = reduced effectiveness + risk)
    const loyaltyFactor = (official.loyalty || 50) / 100;

    // Combined effectiveness (prestige for competence, loyalty for reliability)
    const effectiveness = baseEffectiveness * (0.5 + prestigeFactor * 0.5) * (0.5 + loyaltyFactor * 0.5);

    // Calculate actual independence reduction
    const baseReduction = measureConfig.independenceReduction || 0.2;
    const actualReduction = baseReduction * (1 + effectiveness);

    // Satisfaction bonus modified by official's origin stratum
    let satisfactionBonus = measureConfig.eliteSatisfactionBonus || 2;
    if (official.sourceStratum === 'elite' || official.sourceStratum === 'nobles') {
        satisfactionBonus *= 1.2; // Nobles are better at dealing with elites
    } else if (official.sourceStratum === 'commoner') {
        satisfactionBonus *= 0.8; // Commoners less respected by elites
    }

    // Low loyalty risk: might increase independence or siphon funds
    let loyaltyRisk = null;
    if ((official.loyalty || 50) < 40) {
        loyaltyRisk = {
            type: 'low_loyalty',
            corruptionChance: (40 - (official.loyalty || 50)) / 100,
            independenceIncrease: 0.05 * (40 - (official.loyalty || 50)) / 40,
        };
    }

    return {
        effectiveness,
        independenceReduction: actualReduction,
        satisfactionBonus: Math.floor(satisfactionBonus),
        loyaltyRisk,
        officialName: official.name || 'Unknown Official',
        officialPrestige: official.prestige || 50,
        officialLoyalty: official.loyalty || 50,
    };
};

/**
 * Check if garrison is effective based on military strength
 * @param {number} playerMilitary - Player's military strength
 * @param {number} vassalMilitary - Vassal's military strength
 * @returns {Object} Garrison effectiveness data
 */
export const checkGarrisonEffectiveness = (playerMilitary, vassalMilitary) => {
    const threshold = INDEPENDENCE_CONFIG.garrisonMilitaryThreshold || 0.5;
    const requiredStrength = vassalMilitary * threshold;
    const isEffective = playerMilitary >= requiredStrength;

    return {
        isEffective,
        playerMilitary,
        vassalMilitary,
        requiredStrength,
        ratio: vassalMilitary > 0 ? playerMilitary / vassalMilitary : 1,
        warning: !isEffective ? 'insufficient_military' : null,
    };
};

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
    playerWealth = 10000,
    officials = [],       // NEW: Player's officials list
    logs = [],
}) => {
    let tributeIncome = 0;
    let resourceTribute = {};
    let totalControlCost = 0;  // NEW: Track total control costs
    const vassalEvents = [];
    const controlWarnings = [];  // NEW: Track warnings about control measures

    const updatedNations = (nations || []).map(nation => {
        // 跳过非附庸国
        if (nation.vassalOf !== 'player') {
            return nation;
        }

        const updated = { ...nation };
        const vassalConfig = VASSAL_TYPE_CONFIGS[updated.vassalType];
        if (!vassalConfig) return updated;

        const vassalWealth = updated.wealth || 500;
        const vassalMilitary = updated.militaryStrength || 0.5;

        // ========== 1. Process Control Measures Costs and Effects ==========
        let controlMeasureIndependenceReduction = 0;
        let vassalWealthChange = 0;

        if (updated.vassalPolicy?.controlMeasures) {
            const measures = updated.vassalPolicy.controlMeasures;

            // Process each active control measure
            Object.entries(measures).forEach(([measureId, measureData]) => {
                // Support both boolean (legacy) and object format
                const isActive = measureData === true || (measureData && measureData.active !== false);
                if (!isActive) return;

                const measureConfig = INDEPENDENCE_CONFIG.controlMeasures[measureId];
                if (!measureConfig) return;

                // Calculate dynamic cost
                const dailyCost = calculateControlMeasureCost(measureId, vassalWealth);
                totalControlCost += dailyCost;

                // Process specific measure effects
                switch (measureId) {
                    case 'governor': {
                        // Governor requires an assigned official
                        const officialId = measureData.officialId;
                        const official = officials.find(o => o.id === officialId);

                        if (measureConfig.requiresOfficial && !official) {
                            controlWarnings.push({
                                type: 'governor_no_official',
                                nationId: updated.id,
                                nationName: updated.name,
                                message: `${updated.name}的总督职位空缺，控制效果失效`,
                            });
                            // Still charge cost but no effect
                            break;
                        }

                        // ========== NEW: Use deep governor integration ==========
                        const govEffects = calculateGovernorFullEffects(official, updated);

                        // Apply independence reduction from governor
                        controlMeasureIndependenceReduction += govEffects.independenceReduction;

                        // Apply elite satisfaction bonus
                        if (govEffects.eliteSatisfactionBonus > 0 && updated.socialStructure?.elites) {
                            updated.socialStructure = {
                                ...updated.socialStructure,
                                elites: {
                                    ...updated.socialStructure.elites,
                                    satisfaction: Math.min(100,
                                        (updated.socialStructure.elites.satisfaction || 50) +
                                        govEffects.eliteSatisfactionBonus * 0.05  // Daily accumulation
                                    ),
                                }
                            };
                        }

                        // Apply unrest suppression
                        if (govEffects.unrestSuppression > 0) {
                            updated.unrest = Math.max(0, (updated.unrest || 0) - govEffects.unrestSuppression);
                        }

                        // Store tribute modifier for later use in tribute calculation
                        updated._governorTributeModifier = govEffects.tributeModifier;
                        updated._governorCorruptionRate = govEffects.corruptionRate;

                        // Low loyalty risk effects
                        if (govEffects.warnings.includes('low_loyalty_corruption_risk') && Math.random() < 0.01) {
                            // Daily 1% chance to trigger corruption event
                            controlMeasureIndependenceReduction -= 0.05;
                            logs.push(`⚠️ ${updated.name}的总督${govEffects.officialName}行为不端，引发民众不满`);
                        }

                        // ========== NEW: 处理总督治理事件 (Governor Events) ==========
                        if (govEffects.governorEvent) {
                            const event = govEffects.governorEvent;
                            logs.push(`🏛️ ${updated.name}总督事件: ${event.desc}`);

                            // 效果应用
                            if (event.effect.silver) {
                                // 搜刮到的银币直接计入今日朝贡
                                tributeIncome += event.effect.silver;
                            }
                            if (event.effect.unrest) {
                                updated.unrest = (updated.unrest || 0) + event.effect.unrest;
                            }
                            if (event.effect.independence) {
                                // 直接调整当前的独立倾向数值 (负数 = 降低)
                                updated.independencePressure = Math.max(0, (updated.independencePressure || 0) + event.effect.independence);
                            }
                        }

                        // 应用独立上限降低 (同化政策)
                        if (govEffects.independenceCapReduction > 0) {
                            updated.independenceCap = Math.max(
                                10, // 最小上限
                                (updated.independenceCap || 100) - govEffects.independenceCapReduction
                            );
                        }

                        // Override cost with governor-calculated cost
                        totalControlCost += govEffects.dailyCost - dailyCost; // Adjust by difference

                        // [NEW] Governor Mandate Effects (Persistent State)
                        if (govEffects.mandateId === 'develop') {
                            // Develop: Increase Wealth
                            // Based on Admin skill (tributeModifier scales with Admin)
                            const growth = Math.floor((updated.wealth || 500) * 0.002 * (govEffects.tributeModifier || 1.0));
                            updated.wealth = (updated.wealth || 0) + growth;
                        }

                        break;
                    }

                    case 'garrison': {
                        // Check military strength requirement
                        const garrisonCheck = checkGarrisonEffectiveness(playerMilitary, vassalMilitary);

                        if (!garrisonCheck.isEffective) {
                            controlWarnings.push({
                                type: 'garrison_insufficient_military',
                                nationId: updated.id,
                                nationName: updated.name,
                                required: garrisonCheck.requiredStrength,
                                current: playerMilitary,
                                message: `驻军${updated.name}需要军力${garrisonCheck.requiredStrength.toFixed(1)}，当前${playerMilitary.toFixed(1)}`,
                            });
                            // Cost is still incurred but effect is reduced
                            controlMeasureIndependenceReduction += measureConfig.independenceReduction * 0.2; // 20% effectiveness without proper military
                        } else {
                            controlMeasureIndependenceReduction += measureConfig.independenceReduction;
                        }

                        // Apply commoner satisfaction penalty
                        if (measureConfig.commonerSatisfactionPenalty && updated.socialStructure?.commoners) {
                            updated.socialStructure = {
                                ...updated.socialStructure,
                                commoners: {
                                    ...updated.socialStructure.commoners,
                                    satisfaction: Math.max(0,
                                        (updated.socialStructure.commoners.satisfaction || 50) +
                                        measureConfig.commonerSatisfactionPenalty * 0.1  // Daily accumulation
                                    ),
                                }
                            };
                        }
                        break;
                    }

                    case 'assimilation': {
                        // Cultural assimilation reduces independence cap over time
                        const currentCap = updated.independenceCap || 100;
                        const newCap = Math.max(
                            measureConfig.minIndependenceCap || 30,
                            currentCap - measureConfig.independenceCapReduction
                        );
                        updated.independenceCap = newCap;

                        // Small satisfaction penalty across all classes
                        if (measureConfig.satisfactionPenalty && updated.socialStructure) {
                            const penalty = measureConfig.satisfactionPenalty * 0.1;
                            if (updated.socialStructure.elites) {
                                updated.socialStructure.elites.satisfaction = Math.max(0,
                                    (updated.socialStructure.elites.satisfaction || 50) + penalty
                                );
                            }
                            if (updated.socialStructure.commoners) {
                                updated.socialStructure.commoners.satisfaction = Math.max(0,
                                    (updated.socialStructure.commoners.satisfaction || 50) + penalty
                                );
                            }
                        }
                        break;
                    }

                    case 'economicAid': {
                        // Economic aid improves satisfaction and transfers wealth
                        controlMeasureIndependenceReduction += measureConfig.independenceReduction || 0.1;

                        // Apply satisfaction bonuses
                        if (updated.socialStructure) {
                            if (measureConfig.commonerSatisfactionBonus && updated.socialStructure.commoners) {
                                updated.socialStructure = {
                                    ...updated.socialStructure,
                                    commoners: {
                                        ...updated.socialStructure.commoners,
                                        satisfaction: Math.min(100,
                                            (updated.socialStructure.commoners.satisfaction || 50) +
                                            measureConfig.commonerSatisfactionBonus * 0.1
                                        ),
                                    }
                                };
                            }
                            if (measureConfig.underclassSatisfactionBonus && updated.socialStructure.underclass) {
                                updated.socialStructure = {
                                    ...updated.socialStructure,
                                    underclass: {
                                        ...updated.socialStructure.underclass,
                                        satisfaction: Math.min(100,
                                            (updated.socialStructure.underclass.satisfaction || 50) +
                                            measureConfig.underclassSatisfactionBonus * 0.1
                                        ),
                                    }
                                };
                            }
                        }

                        // Transfer small amount of wealth to vassal
                        if (measureConfig.vassalWealthTransfer) {
                            const transfer = Math.floor(dailyCost * measureConfig.vassalWealthTransfer);
                            vassalWealthChange += transfer;
                        }
                        break;
                    }
                }
            });
        }

        // Apply wealth change from economic aid
        if (vassalWealthChange > 0) {
            updated.wealth = (updated.wealth || 0) + vassalWealthChange;
        }

        // ========== 2. 每30天结算朝贡（使用新的计算方式） ==========
        if (daysElapsed > 0 && daysElapsed % 30 === 0) {
            const tribute = calculateEnhancedTribute(updated);

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

        // ========== 3. 更新独立倾向（使用新的计算方式） ==========
        const independenceGrowth = getEnhancedIndependenceGrowthRate(
            updated,  // Now passing full nation object for policy access
            epoch
        );

        // Apply control measures reduction
        let effectiveGrowth = independenceGrowth - controlMeasureIndependenceReduction;

        // Apply independence cap if exists
        const independenceCap = updated.independenceCap || 100;
        const currentIndependence = updated.independencePressure || 0;

        if (currentIndependence >= independenceCap) {
            effectiveGrowth = 0; // Cap reached
        }

        updated.independencePressure = Math.min(independenceCap, Math.max(0,
            currentIndependence + Math.max(0, effectiveGrowth)
        ));

        // ========== 4. 检查独立战争触发 ==========
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

        // ========== 5. 自主度缓慢恢复 (基于治理政策) ==========
        // 不再基于vassalType硬编码，而是基于治理政策设定的最小自主度
        const governancePolicy = updated.vassalPolicy?.governance || 'autonomous';
        const governanceConfig = GOVERNANCE_POLICY_DEFINITIONS[governancePolicy];

        // 目标自主度：取配置的初始自主度与政策限制的较小值
        // 但通常我们希望自主度能恢复到"正常水平"
        const targetAutonomy = vassalConfig.autonomy;

        // 如果当前政策允许恢复（不是直接统治），且低于目标值，则缓慢恢复
        if (governancePolicy !== 'direct_rule' && (updated.autonomy || 0) < targetAutonomy) {
             let recoveryRate = 0.1;

             // [NEW] Governor 'develop' mandate boosts autonomy recovery
             const governor = updated.vassalPolicy?.controlMeasures?.governor;
             if (governor && governor.active !== false && governor.mandate === 'develop') {
                 recoveryRate += 0.1; // Double recovery speed
             }

             updated.autonomy = Math.min(targetAutonomy, (updated.autonomy || 0) + recoveryRate);
        }

        return updated;
    });

    // Log control warnings
    controlWarnings.forEach(warning => {
        logs.push(`⚠️ ${warning.message}`);
    });

    return {
        nations: updatedNations,
        tributeIncome,
        resourceTribute,
        totalControlCost,    // NEW: Return total control cost for deduction
        vassalEvents,
        controlWarnings,     // NEW: Return warnings for UI
    };
};

/**
 * 计算朝贡金额（重构版）
 * 基于附庸经济状况计算有意义的朝贡金额
 * @param {Object} vassalNation - 附庸国对象
 * @returns {Object} { silver: 金钱朝贡, resources: 资源朝贡 }
 */
export const calculateEnhancedTribute = (vassalNation) => {
    if (!vassalNation || vassalNation.vassalOf === null) {
        return { silver: 0, resources: {} };
    }

    const config = TRIBUTE_CONFIG;
    const tributeRate = vassalNation.tributeRate || 0;
    const autonomy = vassalNation.autonomy || 100;
    const vassalWealth = vassalNation.wealth || 500;

    // 计算基础朝贡金额
    // 公式: 基础值 + 附庸财富 * 比例
    // 完全移除玩家财富依赖，确保自洽性 (Updated per user request)
    const vassalBasedTribute = vassalWealth * config.vassalWealthRate;

    let baseTribute = config.baseAmount + vassalBasedTribute;

    // 应用朝贡率 (这是政策设定的比例，如10%)
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

    // ========== NEW: 应用总督效率加成 ==========
    const governorTributeModifier = vassalNation._governorTributeModifier || 1.0;
    baseTribute *= governorTributeModifier;

    // 应用总督腐败损失
    const governorCorruptionRate = vassalNation._governorCorruptionRate || 0;
    const corruptionLoss = baseTribute * governorCorruptionRate;
    baseTribute -= corruptionLoss;

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
 * 获取独立倾向增长率（每天）- 完全统一版
 * 不再依赖 vassalType，完全基于具体政策参数
 * @param {Object} nation - 附庸国家对象
 * @param {number} epoch - 当前时代
 * @returns {number} 每日增长率
 */
const getEnhancedIndependenceGrowthRate = (nation, epoch) => {
    const config = INDEPENDENCE_CONFIG;
    // 移除对 vassalType 的依赖，使用统一的基础增长率
    const UNIFIED_BASE_RATE = 0.10;

    // 时代系数（后期民族主义更强）
    const eraMultiplier = config.eraMultiplier.base +
        Math.max(0, epoch - 3) * config.eraMultiplier.perEra;

    let rate = UNIFIED_BASE_RATE * eraMultiplier;

    // 阶层满意度影响 (SoL Driven)
    // 如果有新的阶层数据，使用新的 satisfaction
    if (nation?.socialStructure) {
        const avgSatisfaction = calculateAverageSatisfaction(nation.socialStructure);

        // 满意度越低，增长越快。满意度50是基准。
        // 满意度 0 -> 2.5x 增长
        // 满意度 100 -> 0.5x 增长
        const satisfactionMod = 2.5 - (avgSatisfaction / 50);
        rate *= Math.max(0.5, satisfactionMod);
    }

    // ========== 政策影响 (Policy Driven) ==========
    const vassalPolicy = nation?.vassalPolicy || {};

    // 1. 劳工政策 (Labor)
    const laborPolicyId = vassalPolicy.labor || 'standard';
    const laborConfig = LABOR_POLICY_DEFINITIONS[laborPolicyId];
    if (laborConfig) {
        rate *= (laborConfig.independenceGrowthMod || 1.0);
    }

    // 2. 贸易政策 (Trade)
    // Note: stored as 'tradePolicy' in some places, check consistency
    const tradePolicyId = vassalPolicy.tradePolicy || 'preferential';
    const tradeConfig = TRADE_POLICY_DEFINITIONS[tradePolicyId];
    if (tradeConfig) {
        rate *= (tradeConfig.independenceGrowthMod || 1.0);
    }

    // 3. 治理政策 (Governance)
    const governancePolicyId = vassalPolicy.governance || 'autonomous';
    const governanceConfig = GOVERNANCE_POLICY_DEFINITIONS[governancePolicyId];
    if (governanceConfig) {
        rate *= (governanceConfig.independenceGrowthMod || 1.0);
    }

    // 4. [NEW] 投资政策 (Investment)
    const investmentPolicyId = vassalPolicy.investmentPolicy || 'autonomous';
    if (investmentPolicyId === 'guided') {
        rate *= 1.2; // 引导投资增加20%独立倾向增长
    } else if (investmentPolicyId === 'forced') {
        rate *= 1.5; // 强制投资增加50%独立倾向增长
    }

    // 5. 朝贡率影响
    const tributeRate = nation.tributeRate || 0;
    // 每 10% 朝贡增加 50% 独立倾向增长
    rate *= (1 + tributeRate * 5);

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

    // 获取该类型的政策预设
    const preset = VASSAL_POLICY_PRESETS[vassalType];

    return {
        ...nation,
        vassalOf: 'player',
        vassalType,

        // 核心参数初始化
        autonomy: config.autonomy,
        tributeRate: config.tributeRate,
        independencePressure: 0,
        independenceCap: 100,

        // 初始化详细政策 (基于预设)
        vassalPolicy: {
            labor: preset?.labor || 'standard',
            tradePolicy: preset?.trade || 'preferential',
            governance: preset?.governance || 'autonomous',
            investmentPolicy: 'autonomous', // [NEW] 默认自主投资
            controlMeasures: {},
        },

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
        independenceCap: 100,  // Reset independence cap
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
            controlMeasures: {},  // NEW: Object format for control measures
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
        const validOptions = ['free', 'preferential', 'monopoly', 'exclusive', 'dumping', 'looting'];
        if (validOptions.includes(policyChanges.tradePolicy)) {
            updated.vassalPolicy.tradePolicy = policyChanges.tradePolicy;

            // 贸易政策对独立倾向的一次性影响（切换时）
            const independenceEffects = {
                free: -2,        // 自由贸易降低独立倾向
                preferential: 0, // 优惠准入无影响
                exclusive: 3,    // 排他贸易增加
                monopoly: 5,     // 垄断贸易大幅增加独立倾向
                dumping: 4,      // 倾销增加
                looting: 6,      // 资源掠夺大幅增加
            };
            updated.independencePressure = Math.min(100, Math.max(0,
                (updated.independencePressure || 0) + (independenceEffects[policyChanges.tradePolicy] || 0)
            ));
        }
    }

    // ========== NEW: 调整劳工政策 ==========
    if (policyChanges.labor) {
        const validOptions = ['standard', 'exploitation', 'slavery'];
        if (validOptions.includes(policyChanges.labor)) {
            updated.vassalPolicy.labor = policyChanges.labor;

            // 劳工政策对独立倾向的一次性影响（切换时）
            const independenceEffects = {
                standard: 0,
                exploitation: 3,   // 压榨剥削增加独立倾向
                slavery: 8,        // 强制劳动大幅增加独立倾向
            };
            updated.independencePressure = Math.min(100, Math.max(0,
                (updated.independencePressure || 0) + (independenceEffects[policyChanges.labor] || 0)
            ));
        }
    }

    // ========== NEW: 调整投资政策 ==========
    if (policyChanges.investmentPolicy) {
        const validOptions = ['autonomous', 'guided', 'forced'];
        if (validOptions.includes(policyChanges.investmentPolicy)) {
            updated.vassalPolicy.investmentPolicy = policyChanges.investmentPolicy;

            // 投资政策对独立倾向的一次性影响（切换时）
            const independenceEffects = {
                autonomous: 0,
                guided: 2,     // 引导投资增加独立倾向
                forced: 5,     // 强制投资大幅增加独立倾向
            };
            updated.independencePressure = Math.min(100, Math.max(0,
                (updated.independencePressure || 0) + (independenceEffects[policyChanges.investmentPolicy] || 0)
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

    // NEW: Update control measures with new object format
    if (policyChanges.controlMeasures) {
        updated.vassalPolicy.controlMeasures = {
            ...updated.vassalPolicy.controlMeasures,
            ...policyChanges.controlMeasures,
        };
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
    let totalControlCost = 0;  // NEW: Calculate total control costs

    vassals.forEach(vassal => {
        const tribute = calculateEnhancedTribute(vassal);
        totalTribute += tribute.silver;

        // 汇总资源朝贡
        Object.entries(tribute.resources).forEach(([res, amount]) => {
            totalResourceTribute[res] = (totalResourceTribute[res] || 0) + amount;
        });

        // 贸易加成基于贸易政策
        const tradePolicyId = vassal.vassalPolicy?.tradePolicy || 'preferential';
        const tradeConfig = TRADE_POLICY_DEFINITIONS[tradePolicyId];
        if (tradeConfig) {
            totalTradeBonus += (tradeConfig.tariffDiscount || 0);
        } else {
            // Fallback to type config if policy missing (legacy safety)
            const config = VASSAL_TYPE_CONFIGS[vassal.vassalType];
            if (config) totalTradeBonus += config.tariffDiscount;
        }

        // Calculate control measure costs
        if (vassal.vassalPolicy?.controlMeasures) {
            const vassalWealth = vassal.wealth || 500;
            Object.entries(vassal.vassalPolicy.controlMeasures).forEach(([measureId, measureData]) => {
                const isActive = measureData === true || (measureData && measureData.active !== false);
                if (isActive) {
                    totalControlCost += calculateControlMeasureCost(measureId, vassalWealth);
                }
            });
        }
    });

    return {
        vassalCount: vassals.length,
        monthlyTribute: totalTribute,
        monthlyResourceTribute: totalResourceTribute,
        tradeBonus: totalTradeBonus / Math.max(1, vassals.length),
        dailyControlCost: totalControlCost,  // NEW: Include daily control cost
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
        // 统一附庸化要求战争分数 50
        const requiredScore = 50;
        if ((warScore || 0) < requiredScore) {
            return { canEstablish: false, reason: `战争分数不足（需要 ${requiredScore}）` };
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

/**
 * Check if a vassal can perform diplomatic action based on restrictions
 * 基于政策（policy）而非类型（type）的判断
 * @param {Object} nation - Vassal nation
 * @param {string} actionType - Type of diplomatic action ('alliance', 'treaty', 'trade')
 * @returns {Object} { allowed, reason }
 */
export const canVassalPerformDiplomacy = (nation, actionType) => {
    if (nation.vassalOf !== 'player') {
        return { allowed: true, reason: null };
    }

    const diplomaticControl = nation.vassalPolicy?.diplomaticControl || 'guided';
    const tradePolicy = nation.vassalPolicy?.tradePolicy || 'preferential';

    switch (actionType) {
        case 'alliance':
            // 只有"自治"的外交政策允许结盟
            if (diplomaticControl !== 'autonomous') {
                return {
                    allowed: false,
                    reason: '当前外交政策禁止独立结盟'
                };
            }
            break;

        case 'treaty':
            // "自治"或"引导"允许签条约，"傀儡"禁止
            if (diplomaticControl === 'puppet') {
                return {
                    allowed: false,
                    reason: '傀儡外交政策禁止独立签署条约'
                };
            }
            break;

        case 'trade':
            // 垄断、排他、掠夺政策禁止独立贸易
            const restrictiveTradePolicies = ['monopoly', 'exclusive', 'looting'];
            if (restrictiveTradePolicies.includes(tradePolicy)) {
                return {
                    allowed: false,
                    reason: '当前贸易政策禁止独立贸易'
                };
            }
            break;
    }

    return { allowed: true, reason: null };
};

/**
 * Validate and clean up governor assignments
 * @param {Array} nations - All nations
 * @param {Array} officials - Player officials
 * @returns {Object} { nations, removedGovernors }
 */
export const validateGovernorAssignments = (nations, officials) => {
    const officialIds = new Set(officials.map(o => o.id));
    const removedGovernors = [];

    const updatedNations = nations.map(nation => {
        if (nation.vassalOf !== 'player') return nation;

        const governorMeasure = nation.vassalPolicy?.controlMeasures?.governor;
        if (!governorMeasure) return nation;

        const officialId = governorMeasure.officialId;
        if (officialId && !officialIds.has(officialId)) {
            // Official no longer exists, remove governor assignment
            removedGovernors.push({
                nationId: nation.id,
                nationName: nation.name,
                officialId,
            });

            return {
                ...nation,
                vassalPolicy: {
                    ...nation.vassalPolicy,
                    controlMeasures: {
                        ...nation.vassalPolicy.controlMeasures,
                        governor: {
                            ...governorMeasure,
                            officialId: null,
                            active: false,
                        },
                    },
                },
            };
        }

        return nation;
    });

    return { nations: updatedNations, removedGovernors };
};

/**
 * 请求附庸国派遣远征军 (Expeditionary Force)
 * 仅适用于 tributary (朝贡国) 或更高义务
 * @param {Object} vassal - 附庸国
 * @returns {Object} - { success, units, message }
 */
export const requestExpeditionaryForce = (vassal) => {
    const config = VASSAL_TYPE_CONFIGS[vassal.vassalType];
    const obligation = config?.militaryObligation;

    if (obligation !== 'expeditionary' && obligation !== 'auto_join') {
        return { success: false, message: '该附庸国没有派遣远征军的义务' };
    }

    if ((vassal.manpower || 0) < 1000) {
        return { success: false, message: '附庸国人力不足' };
    }

    // Calculate force size (e.g., 10% of military strength equivalent)
    // Simply transfer raw manpower for now, or generate units
    // Let's transfer Manpower to Player as "Volunteers"
    const forceSize = Math.floor((vassal.manpower || 0) * 0.1);

    // Deduct from vassal
    vassal.manpower -= forceSize;

    return {
        success: true,
        manpower: forceSize,
        message: `${vassal.name} 派遣了 ${forceSize} 名志愿军支援前线。`
    };
};

/**
 * 请求附庸国参战 (Call to Arms)
 * 适用于 protectorate (保护国) - 需付费
 * @param {Object} vassal - 附庸国
 * @param {Object} targetEnemy - 目标敌国 (AI Nation)
 * @param {number} playerWealth - 玩家当前资金
 * @returns {Object} - { success, cost, message }
 */
export const requestWarParticipation = (vassal, targetEnemy, playerWealth) => {
    const config = VASSAL_TYPE_CONFIGS[vassal.vassalType];
    const obligation = config?.militaryObligation;

    if (obligation === 'auto_join') {
        return { success: false, message: '该附庸国会自动参战，无需请求' };
    }

    // Calculate cost
    // Base cost 500 + 10% of Vassal Wealth
    const cost = 500 + Math.floor((vassal.wealth || 0) * 0.1);

    if (playerWealth < cost) {
        return { success: false, message: `资金不足，需要 ${cost} 银币` };
    }

    // Check willingness (Relations)
    if ((vassal.relation || 50) < 40) {
        return { success: false, message: '关系过低，拒绝参战' };
    }

    return {
        success: true,
        cost,
        message: `${vassal.name} 同意参战，花费 ${cost} 银币。`
    };
};
