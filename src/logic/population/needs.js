/**
 * Population Needs Module
 * Handles resource consumption and needs satisfaction for all strata
 */

import { STRATA, RESOURCES } from '../../config';
import { isResourceUnlocked } from '../../utils/resources';
import { isTradableResource, getBasePrice } from '../utils/helpers';
import { calculateLivingStandardData } from '../../utils/livingStandard';

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
    tick,
    logs
}) => {
    const res = { ...resources };
    const updatedWealth = { ...wealth };
    const updatedDemand = { ...demand };
    const needsReport = {};
    const classShortages = {};

    const getResourceTaxRate = (resource) => resourceTaxRates[resource] || 0;

    // Helper to get current stratum wealth multiplier (for luxury needs scaling)
    const getWealthMultiplier = (key) => {
        const def = STRATA[key];
        const startingWealth = def?.startingWealth || 10;
        const count = popStructure[key] || 0;
        const currentWealth = updatedWealth[key] || 0;
        const perCapWealth = count > 0 ? currentWealth / count : 0;
        return startingWealth > 0 ? perCapWealth / startingWealth : 1;
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
        const wealthMultiplier = getWealthMultiplier(key);
        const effectiveNeeds = { ...baseNeeds };

        // Add luxury needs based on wealth tier
        const luxuryThresholds = Object.keys(luxuryNeeds).map(Number).sort((a, b) => a - b);
        luxuryThresholds.forEach(threshold => {
            if (wealthMultiplier >= threshold) {
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
 * @param {Object} params - Living standard parameters
 * @returns {Object} Living standard results
 */
export const calculateLivingStandards = ({
    popStructure,
    wealth,
    classShortages,
    epoch,
    techsUnlocked,
    livingStandardStreaks = {}
}) => {
    const classLivingStandard = {};
    const updatedLivingStandardStreaks = {};

    Object.keys(STRATA).forEach(key => {
        const count = popStructure[key] || 0;
        if (count === 0) {
            classLivingStandard[key] = null;
            updatedLivingStandardStreaks[key] = { streak: 0, level: null };
            return;
        }

        const def = STRATA[key];
        const wealthValue = wealth[key] || 0;
        const startingWealth = def.startingWealth || 10;
        const shortagesCount = (classShortages[key] || []).length;

        // Calculate effective needs count
        const luxuryNeeds = def.luxuryNeeds || {};
        const luxuryThresholds = Object.keys(luxuryNeeds).map(Number).sort((a, b) => a - b);
        const wealthRatio = startingWealth > 0 
            ? (wealthValue / Math.max(count, 1)) / startingWealth 
            : 0;

        // Base needs count
        const baseNeedsCount = def.needs
            ? Object.keys(def.needs).filter(r => isResourceUnlocked(r, epoch, techsUnlocked)).length
            : 0;

        // Count unlocked luxury tiers
        let unlockedLuxuryTiers = 0;
        let effectiveNeedsCount = baseNeedsCount;
        for (const threshold of luxuryThresholds) {
            if (wealthRatio >= threshold) {
                unlockedLuxuryTiers++;
                const tierNeeds = luxuryNeeds[threshold];
                const unlockedResources = Object.keys(tierNeeds)
                    .filter(r => isResourceUnlocked(r, epoch, techsUnlocked));
                const newResources = unlockedResources.filter(r => !def.needs?.[r]);
                effectiveNeedsCount += newResources.length;
            }
        }

        // Calculate living standard
        classLivingStandard[key] = calculateLivingStandardData({
            count,
            wealthValue,
            startingWealth,
            shortagesCount,
            effectiveNeedsCount,
            unlockedLuxuryTiers,
            totalLuxuryTiers: luxuryThresholds.length,
        });

        // Update streak
        const prevTracker = livingStandardStreaks?.[key]?.streak || 0;
        const currentLevel = classLivingStandard[key]?.level || null;
        let nextStreak = prevTracker;

        if (currentLevel === '赤贫' || currentLevel === '贫困') {
            nextStreak = prevTracker + 1;
        } else {
            nextStreak = Math.max(0, prevTracker - 1);
        }

        updatedLivingStandardStreaks[key] = {
            streak: nextStreak,
            level: currentLevel,
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
