/**
 * Population Needs Module
 * Handles resource consumption and needs satisfaction for all strata
 */

import { STRATA, RESOURCES } from '../../config';
import { isResourceUnlocked } from '../../utils/resources';
import { isTradableResource, getBasePrice } from '../utils/helpers';
import { calculateLivingStandardData, calculateWealthMultiplier, calculateLuxuryConsumptionMultiplier, getSimpleLivingStandard } from '../../utils/livingStandard';
import { applyBuyPriceControl } from '../officials/cabinetSynergy';

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
    classFinancialData = {}, // 新增：详细财务跟踪
    tick,
    logs,
    potentialResources = null,  // 已解锁建筑可产出资源集合（用于门控需求）
    priceControls = null        // 政府价格管制设置
}) => {
    const res = { ...resources };
    const updatedWealth = { ...wealth };
    const updatedDemand = { ...demand };
    const needsReport = {};
    const classShortages = {};

    const getResourceTaxRate = (resource) => resourceTaxRates[resource] || 0;


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

        // 计算消费能力（用于奢侈品解锁和消费量控制）
        const startingWealth = def.startingWealth || 100;
        const wealthPerCapita = count > 0 ? (wealth[key] || 0) / count : 0;
        const wealthRatio = startingWealth > 0 ? wealthPerCapita / startingWealth : 0;
        const income = classIncome[key] || 0;
        const incomePerCapita = income / count;
        let essentialCost = 0;
        const essentialResources = ['food', 'cloth'];
        essentialResources.forEach(resKey => {
            if (baseNeeds[resKey] && isResourceUnlocked(resKey, epoch, techsUnlocked)) {
                const price = priceMap[resKey] || getBasePrice(resKey);
                essentialCost += baseNeeds[resKey] * price;
            }
        });
        const incomeRatio = essentialCost > 0 ? incomePerCapita / essentialCost : (incomePerCapita > 0 ? 10 : 0);
        const maxConsumptionMultiplier = def.maxConsumptionMultiplier || 6;
        
        // 消费能力（受阶层上限限制）：用于计算实际购买量
        const consumptionMultiplier = calculateWealthMultiplier(incomeRatio, wealthRatio, def.wealthElasticity || 1.0, maxConsumptionMultiplier);
        
        // 解锁能力（不受阶层上限限制，统一上限10）：用于判断是否能解锁奢侈品需求
        // 这样即使底层阶级（上限3）只要足够富裕也能解锁高级奢侈品，只是购买量受限
        const unlockMultiplier = calculateWealthMultiplier(incomeRatio, wealthRatio, def.wealthElasticity || 1.0, 10);
        
        const livingStandardLevel = getSimpleLivingStandard(incomeRatio).level;
        const luxuryConsumptionMultiplier = calculateLuxuryConsumptionMultiplier({
            consumptionMultiplier,
            incomeRatio,
            wealthRatio,
            livingStandardLevel,
        });
        const effectiveNeeds = { ...baseNeeds };

        // Add luxury needs based on unlock multiplier (uncapped)
        // 使用不受阶层上限限制的解锁能力来决定奢侈品解锁
        const luxuryThresholds = Object.keys(luxuryNeeds).map(Number).sort((a, b) => a - b);
        luxuryThresholds.forEach(threshold => {
            if (unlockMultiplier >= threshold) {
                const tierNeeds = luxuryNeeds[threshold];
                Object.entries(tierNeeds).forEach(([resKey, amount]) => {
                    if (isResourceUnlocked(resKey, epoch, techsUnlocked)) {
                        effectiveNeeds[resKey] =
                            (effectiveNeeds[resKey] || 0) + (amount * luxuryConsumptionMultiplier);
                    }
                });
            }
        });


        // Process each need
        Object.entries(effectiveNeeds).forEach(([resKey, base]) => {
            // Skip if resource not unlocked
            if (!isResourceUnlocked(resKey, epoch, techsUnlocked)) return;

            // 检查是否有已解锁建筑能产出该资源（无已解锁建筑则无需求）
            if (potentialResources && !potentialResources.has(resKey)) return;

            const perCapita = base * needsRequirementMultiplier;
            const requirement = perCapita * count;
            const available = res[resKey] || 0;
            let satisfied = 0;

            if (isTradableResource(resKey)) {
                // Tradable resource - requires payment
                const marketPrice = priceMap[resKey] || getBasePrice(resKey);
                
                // 1. 先应用价格管制，获取有效价格
                let effectivePrice = marketPrice;
                if (priceControls?.enabled && priceControls.governmentSellPrices?.[resKey] !== undefined) {
                    effectivePrice = priceControls.governmentSellPrices[resKey];
                }
                
                const totalCost = requirement * effectivePrice;
                const affordable = updatedWealth[key] > 0
                    ? Math.min(requirement, (updatedWealth[key] / effectivePrice))
                    : 0;

                const amount = Math.min(requirement, available, affordable);

                if (amount > 0) {
                    res[resKey] = available - amount;

                    // 2. 基于有效价格计算交易税
                    const taxRate = getResourceTaxRate(resKey);
                    const baseCost = amount * effectivePrice;
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

                    // 3. 计算价格管制收支差额
                    if (priceControls?.enabled && priceControls.governmentSellPrices?.[resKey] !== undefined) {
                        const priceDiff = (effectivePrice - marketPrice) * amount;
                        if (priceDiff > 0) {
                            // 政府出售价 > 市场价：买家额外支付，政府收入
                            taxBreakdown.priceControlIncome = (taxBreakdown.priceControlIncome || 0) + priceDiff;
                        } else if (priceDiff < 0) {
                            // 政府出售价 < 市场价：政府补贴买家
                            const subsidyNeeded = Math.abs(priceDiff);
                            if ((res.silver || 0) >= subsidyNeeded) {
                                res.silver -= subsidyNeeded;
                                taxBreakdown.priceControlExpense = (taxBreakdown.priceControlExpense || 0) + subsidyNeeded;
                            }
                            // 如果国库不足，补贴失败但交易仍按有效价格进行
                        }
                    }

                    updatedWealth[key] = Math.max(0, (updatedWealth[key] || 0) - actualCost);
                    roleExpense[key] = (roleExpense[key] || 0) + actualCost;
                    satisfied = amount;

                    // 分类记录消费支出到详细财务数据
                    if (classFinancialData[key]) {
                        if (baseNeeds.hasOwnProperty(resKey)) {
                            // 必需品消费
                            classFinancialData[key].expense.essentialNeeds[resKey] =
                                (classFinancialData[key].expense.essentialNeeds[resKey] || 0) + actualCost;
                        } else {
                            // 奢侈品消费
                            classFinancialData[key].expense.luxuryNeeds[resKey] =
                                (classFinancialData[key].expense.luxuryNeeds[resKey] || 0) + actualCost;
                        }
                    }

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
                    // 标记是否为基础需求（在阶层的needs配置中定义的）
                    const isBasic = baseNeeds.hasOwnProperty(resKey);
                    shortages.push({ resource: resKey, reason, isBasic });
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
                    const isBasic = baseNeeds.hasOwnProperty(resKey);
                    shortages.push({ resource: resKey, reason: 'outOfStock', isBasic });
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
                const marketPrice = getPrice(resKey);
                const basePrice = getBasePrice(resKey);
                // 使用基础价格和市场价格的最大值，防止价格过低导致incomeRatio虚高
                const effectivePrice = Math.max(marketPrice, basePrice);
                essentialCost += amount * effectivePrice;
            }
        });


        // Calculate effective needs count and luxury tiers
        const luxuryNeeds = def.luxuryNeeds || {};
        const luxuryThresholds = Object.keys(luxuryNeeds).map(Number).sort((a, b) => a - b);

        // 计算消费能力（用于奢侈需求解锁判断）
        const wealthElasticity = def.wealthElasticity || 1.0;
        const incomePerCapita = count > 0 ? incomeValue / count : 0;
        const essentialCostPerCapita = count > 0 ? essentialCost / count : 0;
        // 当没有基础成本数据时，根据实际收入判断：有收入给予较高值，无收入则为0
        const incomeRatio = essentialCostPerCapita > 0
            ? incomePerCapita / essentialCostPerCapita
            : (incomePerCapita > 0 ? 10 : 0);
        const wealthPerCapita = count > 0 ? wealthValue / count : 0;
        const wealthRatio = startingWealth > 0 ? wealthPerCapita / startingWealth : 0;

        // 消费倍率（受阶层上限限制）：用于计算实际购买量
        const maxConsumptionMultiplier = def.maxConsumptionMultiplier || 6;
        const consumptionMultiplier = calculateWealthMultiplier(incomeRatio, wealthRatio, wealthElasticity, maxConsumptionMultiplier);
        
        // 解锁能力（不受阶层上限限制，统一上限10）：用于判断是否能解锁奢侈品需求
        // 与 processNeedsConsumption 保持一致
        const unlockMultiplier = calculateWealthMultiplier(incomeRatio, wealthRatio, wealthElasticity, 10);

        // Base needs count
        const baseNeedsCount = def.needs
            ? Object.keys(def.needs).filter(r => isResourceUnlocked(r, epoch, techsUnlocked)).length
            : 0;

        // Count unlocked luxury tiers (基于解锁能力，不受阶层消费上限限制)
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
            wealthElasticity,
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
