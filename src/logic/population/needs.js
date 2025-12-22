/**
 * Population Needs Module
 * Handles resource consumption and needs satisfaction for all strata
 */

import { STRATA, RESOURCES } from '../../config';
import { isResourceUnlocked } from '../../utils/resources';
import { isTradableResource, getBasePrice } from '../utils/helpers';
import { calculateLivingStandardData, calculateWealthMultiplier, calculateUnlockMultiplier } from '../../utils/livingStandard';

/**
 * Process needs consumption for all strata
 * @param {Object} params - Consumption parameters
 * @returns {Object} Consumption results
 */
export const processNeedsConsumption = ({
    popStructure,
    wealth,
    resources,
    priceMap,
    demand,
    epoch,
    techsUnlocked,
    needsRequirementMultiplier,
    resourceTaxRates,
    taxBreakdown,
    roleExpense,
    roleWagePayout,
    classIncome = {}, // 新增：收入数据
    tick,
    logs
}) => {
    const res = { ...resources };
    const updatedWealth = { ...wealth };
    const updatedDemand = { ...demand };
    const needsReport = {};
    const classShortages = {};

    const getResourceTaxRate = (resource) => resourceTaxRates[resource] || 0;

    // Helper to get unlock multiplier (for luxury needs unlock - NOT capped by maxConsumptionMultiplier)
    // 用于决定奢侈需求解锁，不受阶层消费上限限制
    const getUnlockMultiplier = (key) => {
        const def = STRATA[key];
        const count = popStructure[key] || 0;
        if (count <= 0) return 1;

        // 获取阶层的财富弹性系数（默认1.0）
        const wealthElasticity = def.wealthElasticity || 1.0;

        // 计算人均收入
        const income = classIncome[key] || 0;
        const incomePerCapita = income / count;

        // 计算人均财富和财富比率
        const wealthValue = wealth[key] || 0;
        const wealthPerCapita = wealthValue / count;
        const startingWealth = def.startingWealth || 100;
        const wealthRatio = startingWealth > 0 ? wealthPerCapita / startingWealth : 0;

        // 计算基础生存成本
        const baseNeeds = def.needs || {};
        let essentialCost = 0;
        const essentialResources = ['food', 'cloth'];
        essentialResources.forEach(resKey => {
            if (baseNeeds[resKey] && isResourceUnlocked(resKey, epoch, techsUnlocked)) {
                const price = priceMap[resKey] || getBasePrice(resKey);
                essentialCost += baseNeeds[resKey] * price;
            }
        });

        // 计算收入比率
        const incomeRatio = essentialCost > 0 ? incomePerCapita / essentialCost : 1;

        // 使用解锁乘数公式（不受阶层消费上限限制，所有阶层都能解锁全部奢侈需求）
        return calculateUnlockMultiplier(incomeRatio, wealthRatio, wealthElasticity);
    };


    Object.keys(STRATA).forEach(key => {
        const count = popStructure[key] || 0;
        if (count === 0) {
            needsReport[key] = { satisfactionRatio: 1, totalTrackedNeeds: 0 };
            classShortages[key] = [];
            return;
        }

        const def = STRATA[key];
        const baseNeeds = def.needs || {};
        const luxuryNeeds = def.luxuryNeeds || {};
        const shortages = [];
        let satisfactionSum = 0;
        let tracked = 0;

        // Calculate effective needs (base + unlocked luxury tiers)
        // 使用解锁乘数（unlockMultiplier）决定奢侈需求解锁（不受阶层消费上限限制）
        const unlockMultiplier = getUnlockMultiplier(key);
        const effectiveNeeds = { ...baseNeeds };

        // Add luxury needs based on unlock multiplier
        const luxuryThresholds = Object.keys(luxuryNeeds).map(Number).sort((a, b) => a - b);
        luxuryThresholds.forEach(threshold => {
            if (unlockMultiplier >= threshold) {
                const tierNeeds = luxuryNeeds[threshold];
                Object.entries(tierNeeds).forEach(([resKey, amount]) => {
                    if (isResourceUnlocked(resKey, epoch, techsUnlocked)) {
                        effectiveNeeds[resKey] = (effectiveNeeds[resKey] || 0) + amount;
                    }
                });
            }
        });


        // Process each need
        Object.entries(effectiveNeeds).forEach(([resKey, base]) => {
            // Skip if resource not unlocked
            if (!isResourceUnlocked(resKey, epoch, techsUnlocked)) return;

            const perCapita = base * needsRequirementMultiplier;
            const requirement = perCapita * count;
            const available = res[resKey] || 0;
            let satisfied = 0;

            if (isTradableResource(resKey)) {
                // Tradable resource - requires payment
                const price = priceMap[resKey] || getBasePrice(resKey);
                const totalCost = requirement * price;
                const affordable = updatedWealth[key] > 0
                    ? Math.min(requirement, (updatedWealth[key] / price))
                    : 0;

                const amount = Math.min(requirement, available, affordable);

                if (amount > 0) {
                    res[resKey] = available - amount;

                    const taxRate = getResourceTaxRate(resKey);
                    const baseCost = amount * price;
                    const taxPaid = baseCost * taxRate;
                    let actualCost = baseCost;

                    // Handle subsidies (negative tax)
                    if (taxPaid < 0) {
                        const subsidyAmount = Math.abs(taxPaid);
                        if ((res.silver || 0) >= subsidyAmount) {
                            res.silver -= subsidyAmount;
                            taxBreakdown.subsidy += subsidyAmount;
                            actualCost -= subsidyAmount;
                            roleWagePayout[key] = (roleWagePayout[key] || 0) + subsidyAmount;
                        } else if (tick % 20 === 0) {
                            logs.push(
                                `Treasury empty, cannot pay ${STRATA[key]?.name || key} ` +
                                `consumption subsidy for ${RESOURCES[resKey]?.name || resKey}!`
                            );
                        }
                    } else if (taxPaid > 0) {
                        taxBreakdown.industryTax += taxPaid;
                        actualCost += taxPaid;
                    }

                    updatedWealth[key] = Math.max(0, (updatedWealth[key] || 0) - actualCost);
                    roleExpense[key] = (roleExpense[key] || 0) + actualCost;
                    satisfied = amount;

                    // Track actual demand
                    updatedDemand[resKey] = (updatedDemand[resKey] || 0) + amount;
                }

                // Record shortage reason
                const ratio = requirement > 0 ? satisfied / requirement : 1;
                satisfactionSum += ratio;
                tracked += 1;

                if (ratio < 0.99) {
                    const canAfford = affordable >= requirement * 0.99;
                    const inStock = available >= requirement * 0.99;
                    let reason = 'both';
                    if (canAfford && !inStock) {
                        reason = 'outOfStock';
                    } else if (!canAfford && inStock) {
                        reason = 'unaffordable';
                    }
                    shortages.push({ resource: resKey, reason });
                }
            } else {
                // Non-tradable resource - free consumption
                const amount = Math.min(requirement, available);
                if (amount > 0) {
                    res[resKey] = available - amount;
                    satisfied = amount;
                }

                const ratio = requirement > 0 ? satisfied / requirement : 1;
                satisfactionSum += ratio;
                tracked += 1;

                if (ratio < 0.99) {
                    shortages.push({ resource: resKey, reason: 'outOfStock' });
                }
            }
        });

        needsReport[key] = {
            satisfactionRatio: tracked > 0 ? satisfactionSum / tracked : 1,
            totalTrackedNeeds: tracked,
        };
        classShortages[key] = shortages;
    });

    return {
        resources: res,
        wealth: updatedWealth,
        demand: updatedDemand,
        needsReport,
        classShortages
    };
};

/**
 * Calculate living standard data for all strata
 * 
 * 新算法核心：
 * 1. 生活水平主要由收入决定，而非存款
 * 2. 存款提供安全缓冲，而非直接决定生活等级
 * 3. 新职业可基于收入立即获得合理的生活水平
 * 
 * @param {Object} params - Living standard parameters
 * @returns {Object} Living standard results
 */
export const calculateLivingStandards = ({
    popStructure,
    wealth,
    classIncome,
    classExpense,
    classShortages,
    epoch,
    techsUnlocked,
    priceMap = {},
    livingStandardStreaks = {}
}) => {
    const classLivingStandard = {};
    const updatedLivingStandardStreaks = {};

    Object.keys(STRATA).forEach(key => {
        const count = popStructure[key] || 0;
        if (count === 0) {
            classLivingStandard[key] = null;
            updatedLivingStandardStreaks[key] = { streak: 0, level: null, score: null };
            return;
        }

        const def = STRATA[key];
        const wealthValue = wealth[key] || 0;
        const incomeValue = classIncome?.[key] || 0;
        const expenseValue = classExpense?.[key] || 0;
        const startingWealth = def.startingWealth || 100;
        const shortagesCount = (classShortages[key] || []).length;

        // 计算基础生存成本（食物和衣物的最低需求）
        const baseNeeds = def.needs || {};
        let essentialCost = 0;
        const essentialResources = ['food', 'cloth']; // 基础生存必需品

        // 支持 priceMap 为函数或对象
        const getPrice = (resKey) => {
            if (typeof priceMap === 'function') {
                return priceMap(resKey) || getBasePrice(resKey);
            }
            return priceMap[resKey] || getBasePrice(resKey);
        };

        essentialResources.forEach(resKey => {
            if (baseNeeds[resKey] && isResourceUnlocked(resKey, epoch, techsUnlocked)) {
                const amount = baseNeeds[resKey] * count;
                const price = getPrice(resKey);
                essentialCost += amount * price;
            }
        });


        // Calculate effective needs count and luxury tiers
        const luxuryNeeds = def.luxuryNeeds || {};
        const luxuryThresholds = Object.keys(luxuryNeeds).map(Number).sort((a, b) => a - b);

        // 计算解锁乘数（不受阶层消费上限限制，用于奢侈需求解锁判断）
        const wealthElasticity = def.wealthElasticity || 1.0;
        const incomePerCapita = count > 0 ? incomeValue / count : 0;
        const essentialCostPerCapita = count > 0 ? essentialCost / count : 0;
        // 当没有基础成本数据时，根据实际收入判断：有收入给予较高值，无收入则为0
        const incomeRatio = essentialCostPerCapita > 0
            ? incomePerCapita / essentialCostPerCapita
            : (incomePerCapita > 0 ? 10 : 0);
        const wealthPerCapita = count > 0 ? wealthValue / count : 0;
        const wealthRatio = startingWealth > 0 ? wealthPerCapita / startingWealth : 0;

        // 解锁乘数：不受阶层上限限制，所有阶层都能解锁全部奢侈需求
        const unlockMultiplier = calculateUnlockMultiplier(incomeRatio, wealthRatio, wealthElasticity);
        // 消费倍率：受阶层上限限制（底层3, 中层6, 上层10）
        const maxConsumptionMultiplier = def.maxConsumptionMultiplier || 6;
        const consumptionMultiplier = calculateWealthMultiplier(incomeRatio, wealthRatio, wealthElasticity, maxConsumptionMultiplier);

        // Base needs count
        const baseNeedsCount = def.needs
            ? Object.keys(def.needs).filter(r => isResourceUnlocked(r, epoch, techsUnlocked)).length
            : 0;

        // Count unlocked luxury tiers (基于解锁乘数，不受阶层消费上限限制)
        let unlockedLuxuryTiers = 0;
        let effectiveNeedsCount = baseNeedsCount;
        for (const threshold of luxuryThresholds) {
            if (unlockMultiplier >= threshold) {
                unlockedLuxuryTiers++;
                const tierNeeds = luxuryNeeds[threshold];
                const unlockedResources = Object.keys(tierNeeds)
                    .filter(r => isResourceUnlocked(r, epoch, techsUnlocked));
                const newResources = unlockedResources.filter(r => !def.needs?.[r]);
                effectiveNeedsCount += newResources.length;
            }
        }

        // 获取上一次的分数用于平滑
        const prevTracker = livingStandardStreaks?.[key] || {};
        const previousScore = prevTracker.score ?? null;
        const isNewStratum = previousScore === null;

        // Calculate living standard using new algorithm
        classLivingStandard[key] = calculateLivingStandardData({
            count,
            income: incomeValue,
            expense: expenseValue,
            wealthValue,
            startingWealth,
            essentialCost,
            shortagesCount,
            effectiveNeedsCount,
            unlockedLuxuryTiers,
            totalLuxuryTiers: luxuryThresholds.length,
            previousScore,
            isNewStratum,
            maxConsumptionMultiplier,
        });

        // Update streak
        const prevStreak = prevTracker.streak || 0;
        const currentLevel = classLivingStandard[key]?.level || null;
        const currentScore = classLivingStandard[key]?.score ?? null;
        let nextStreak = prevStreak;

        if (currentLevel === '赤贫' || currentLevel === '贫困') {
            nextStreak = prevStreak + 1;
        } else {
            nextStreak = Math.max(0, prevStreak - 1);
        }

        updatedLivingStandardStreaks[key] = {
            streak: nextStreak,
            level: currentLevel,
            score: currentScore, // 保存分数用于下次平滑
        };
    });

    return {
        classLivingStandard,
        livingStandardStreaks: updatedLivingStandardStreaks
    };
};


/**
 * Calculate labor efficiency based on needs satisfaction
 * @param {Object} params - Efficiency parameters
 * @returns {Object} Efficiency results
 */
export const calculateLaborEfficiency = ({
    popStructure,
    needsReport,
    classShortages,
    logs
}) => {
    let workforceNeedWeighted = 0;
    let workforceTotal = 0;
    let basicNeedsDeficit = 0;

    Object.keys(STRATA).forEach(key => {
        const count = popStructure[key] || 0;
        if (count <= 0) return;

        workforceTotal += count;
        const needLevel = needsReport[key]?.satisfactionRatio ?? 1;
        workforceNeedWeighted += needLevel * count;

        // Check basic needs
        const def = STRATA[key];
        if (def && def.needs) {
            const shortages = classShortages[key] || [];
            const hasBasicShortage = shortages.some(s =>
                s.resource === 'food' || s.resource === 'cloth'
            );

            if (hasBasicShortage) {
                basicNeedsDeficit += count;
            }
        }
    });

    const laborNeedAverage = workforceTotal > 0
        ? workforceNeedWeighted / workforceTotal
        : 1;
    let laborEfficiencyFactor = 0.3 + 0.7 * laborNeedAverage;

    // Extra penalty for basic needs deficit
    if (basicNeedsDeficit > 0 && workforceTotal > 0) {
        const basicDeficitRatio = basicNeedsDeficit / workforceTotal;
        const basicPenalty = basicDeficitRatio * 0.4;
        laborEfficiencyFactor = Math.max(0.1, laborEfficiencyFactor - basicPenalty);

        if (basicDeficitRatio > 0.1) {
            logs.push(`Severe shortage of basic needs (food/cloth), labor efficiency greatly reduced!`);
        }
    }

    return { laborEfficiencyFactor };
};
