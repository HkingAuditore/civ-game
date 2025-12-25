/**
 * AI Economy Module
 * Handles AI nation economy simulation and development
 * Extracted from simulation.js for better code organization
 */

import { RESOURCES } from '../../config';
import { clamp } from '../utils';
import { isTradableResource } from '../utils/helpers';

/**
 * Update AI nation economy (resources, budget, inventory)
 * @param {Object} params - Parameters
 * @param {Object} params.nation - AI nation object (mutable)
 * @param {number} params.tick - Current game tick
 * @param {number} params.gameSpeed - Game speed multiplier
 */
export const updateAINationInventory = ({
    nation,
    tick,
    gameSpeed,
}) => {
    const next = nation;

    // Initialize inventory if not exists
    if (!next.inventory) {
        next.inventory = {};
    } else {
        next.inventory = { ...next.inventory };
    }

    if (typeof next.budget !== 'number') {
        next.budget = (next.wealth || 800) * 0.5;
    }

    // Simulate resource production and consumption
    const resourceBiasMap = next.economyTraits?.resourceBias || {};
    const foreignResourceKeys = Object.keys(RESOURCES).filter(isTradableResource);

    if (foreignResourceKeys.length > 0) {
        const isInAnyWar = next.isAtWar || (next.foreignWars && Object.values(next.foreignWars).some(w => w?.isAtWar));
        const warConsumptionMultiplier = isInAnyWar ? (1.3 + (next.aggression || 0.2) * 0.5) : 1.0;

        // 时代系数：让后期外国产出和库存显著增加
        // epoch 0=1x, 1=1.5x, 2=2x, 3=2.8x, 4=3.6x, 5=4.5x, 6=5.5x
        const epoch = next.epoch || 0;
        const epochMultiplier = 1 + epoch * 0.5 + Math.pow(epoch, 1.3) * 0.1;

        // 财富系数：让富裕国家有更高产出
        const wealthFactor = Math.max(0.8, Math.min(2.0, (next.wealth || 1000) / 1000));

        foreignResourceKeys.forEach((resourceKey) => {
            const bias = resourceBiasMap[resourceKey] ?? 1;
            const currentStock = next.inventory[resourceKey] || 0;
            // 目标库存根据资源偏差、时代和财富调整
            // bias=1.5时基础目标1125，bias=0.5时目标250，bias=1时目标500
            // 后期（epoch 6）目标会是基础的5.5倍
            const baseTargetInventory = Math.round(500 * Math.pow(bias, 1.2));
            const targetInventory = Math.round(baseTargetInventory * epochMultiplier * wealthFactor);
            
            // 生产率和消费率也随时代增长
            const baseProductionRate = 3.0 * gameSpeed * epochMultiplier * wealthFactor;
            const baseConsumptionRate = 3.0 * gameSpeed * epochMultiplier * wealthFactor * warConsumptionMultiplier;
            // 特产资源：生产多，消费少 -> 容易盈余
            // 稀缺资源：生产少，消费多 -> 容易缺口
            // 普通资源：平衡
            // 使用更激进的指数让差异更明显
            const productionRate = baseProductionRate * Math.pow(bias, 1.0);  // bias=1.5时生产4.5，bias=0.5时生产1.5
            const consumptionRate = baseConsumptionRate * Math.pow(1 / bias, 0.6);  // bias=1.5时消费2.2，bias=0.5时消费4.1
            const stockRatio = currentStock / targetInventory;

            let productionAdjustment = 1.0;
            let consumptionAdjustment = 1.0;

            if (stockRatio > 1.5) {
                productionAdjustment *= 0.5;
                consumptionAdjustment *= 1.15;
            } else if (stockRatio > 1.1) {
                productionAdjustment *= 0.8;
                consumptionAdjustment *= 1.05;
            } else if (stockRatio < 0.5) {
                productionAdjustment *= 1.5;
                consumptionAdjustment *= 0.85;
            } else if (stockRatio < 0.9) {
                productionAdjustment *= 1.2;
                consumptionAdjustment *= 0.95;
            }

            const correction = (targetInventory - currentStock) * 0.01 * gameSpeed;
            const randomShock = (Math.random() - 0.5) * targetInventory * 0.1 * gameSpeed;
            const finalProduction = productionRate * productionAdjustment;
            const finalConsumption = consumptionRate * consumptionAdjustment;
            const netChange = (finalProduction - finalConsumption) + correction + randomShock;
            const minInventory = targetInventory * 0.2;
            const maxInventory = targetInventory * 3.0;
            const nextStock = currentStock + netChange;
            next.inventory[resourceKey] = Math.max(minInventory, Math.min(maxInventory, nextStock));
        });
    }

    // Budget recovery
    const targetBudget = (next.wealth || 800) * 0.5;
    const budgetRecoveryRate = 0.02;
    const budgetDiff = targetBudget - next.budget;
    next.budget = next.budget + (budgetDiff * budgetRecoveryRate * gameSpeed);
    next.budget = Math.max(0, next.budget);
};

/**
 * Initialize AI independent development baseline
 * @param {Object} params - Parameters
 * @param {Object} params.nation - AI nation object (mutable)
 * @param {number} params.tick - Current game tick
 */
export const initializeAIDevelopmentBaseline = ({
    nation,
    tick,
}) => {
    const next = nation;

    if (!next.economyTraits?.ownBasePopulation) {
        const templateWealth = next.wealthTemplate || 800;
        const templateFactor = templateWealth / 800;
        next.economyTraits = {
            ...(next.economyTraits || {}),
            ownBasePopulation: Math.max(5, Math.round(16 * templateFactor * (0.8 + Math.random() * 0.4))),
            ownBaseWealth: Math.max(500, Math.round(1000 * templateFactor * (0.8 + Math.random() * 0.4))),
            developmentRate: 0.8 + (next.aggression || 0.3) * 0.3 + Math.random() * 0.4,
            lastGrowthTick: tick,
        };
    }
};

/**
 * Process AI independent growth (every 100 ticks)
 * @param {Object} params - Parameters
 * @param {Object} params.nation - AI nation object (mutable)
 * @param {number} params.tick - Current game tick
 */
export const processAIIndependentGrowth = ({
    nation,
    tick,
}) => {
    const next = nation;

    if (!next.economyTraits) return;

    const ownBasePopulation = next.economyTraits.ownBasePopulation;
    const ownBaseWealth = next.economyTraits.ownBaseWealth;
    const developmentRate = next.economyTraits.developmentRate || 1.0;

    const ticksSinceLastGrowth = tick - (next.economyTraits.lastGrowthTick || 0);
    if (ticksSinceLastGrowth >= 100) {
        const growthChance = 0.3 * developmentRate;
        if (Math.random() < growthChance && !next.isAtWar) {
            next.economyTraits.ownBasePopulation = Math.round(ownBasePopulation * (1.03 + Math.random() * 0.05));
            next.economyTraits.ownBaseWealth = Math.round(ownBaseWealth * (1.04 + Math.random() * 0.08));
        }
        next.economyTraits.lastGrowthTick = tick;
    }
};

/**
 * Calculate and update AI population and wealth based on development model
 * @param {Object} params - Parameters
 * @param {Object} params.nation - AI nation object (mutable)
 * @param {number} params.epoch - Current epoch
 * @param {number} params.playerPopulationBaseline - Player population baseline
 * @param {number} params.playerWealthBaseline - Player wealth baseline
 */
export const updateAIDevelopment = ({
    nation,
    epoch,
    playerPopulationBaseline,
    playerWealthBaseline,
}) => {
    const next = nation;
    const powerProfile = next.foreignPower || {};

    const volatility = clamp(powerProfile.volatility ?? next.marketVolatility ?? 0.3, 0.1, 0.9);
    const populationFactor = clamp(
        powerProfile.populationFactor ?? powerProfile.baseRating ?? 1,
        0.6,
        2.5
    );
    const wealthFactor = clamp(
        powerProfile.wealthFactor ?? (powerProfile.baseRating ? powerProfile.baseRating * 1.1 : 1.1),
        0.5,
        3.5
    );
    const eraMomentum = 1 + Math.max(0, epoch - (powerProfile.appearEpoch ?? 0)) * 0.03;

    // Era growth factor
    const eraGrowthFactor = 1 + Math.max(0, epoch) * 0.15;

    // Calculate AI own target values
    const aiOwnTargetPopulation = (next.economyTraits?.ownBasePopulation || 16) * eraGrowthFactor * populationFactor;
    const aiOwnTargetWealth = (next.economyTraits?.ownBaseWealth || 1000) * eraGrowthFactor * wealthFactor;

    // Blend with player reference (30% player influence)
    const playerInfluenceFactor = 0.3;
    const playerTargetPopulation = playerPopulationBaseline * populationFactor * eraMomentum;
    const playerTargetWealth = playerWealthBaseline * wealthFactor * eraMomentum;

    const blendedTargetPopulation = aiOwnTargetPopulation * (1 - playerInfluenceFactor) + playerTargetPopulation * playerInfluenceFactor;
    const blendedTargetWealth = aiOwnTargetWealth * (1 - playerInfluenceFactor) + playerTargetWealth * playerInfluenceFactor;

    // Apply template boosts
    const templatePopulationBoost = Math.max(
        1,
        (next.wealthTemplate || 800) / Math.max(800, playerWealthBaseline) * 0.8
    );
    const templateWealthBoost = Math.max(
        1,
        (next.wealthTemplate || 800) / Math.max(800, playerWealthBaseline) * 1.1
    );

    // Final target values
    const desiredPopulation = Math.max(3, blendedTargetPopulation * templatePopulationBoost);
    const desiredWealth = Math.max(100, blendedTargetWealth * templateWealthBoost);

    next.economyTraits = {
        ...(next.economyTraits || {}),
        basePopulation: desiredPopulation,
        baseWealth: desiredWealth,
    };

    // Apply drift towards target
    const currentPopulation = next.population ?? desiredPopulation;
    const driftMultiplier = clamp(1 + volatility * 0.6 + eraMomentum * 0.08, 1, 1.8);
    const populationDriftRate = (next.isAtWar ? 0.032 : 0.12) * driftMultiplier;
    const populationNoise = (Math.random() - 0.5) * volatility * desiredPopulation * 0.04;
    let adjustedPopulation = currentPopulation + (desiredPopulation - currentPopulation) * populationDriftRate + populationNoise;
    if (next.isAtWar) {
        adjustedPopulation -= currentPopulation * 0.012;
    }
    next.population = Math.max(3, Math.round(adjustedPopulation));

    const currentWealth = next.wealth ?? desiredWealth;
    const wealthDriftRate = (next.isAtWar ? 0.03 : 0.11) * driftMultiplier;
    const wealthNoise = (Math.random() - 0.5) * volatility * desiredWealth * 0.05;
    let adjustedWealth = currentWealth + (desiredWealth - currentWealth) * wealthDriftRate + wealthNoise;
    if (next.isAtWar) {
        adjustedWealth -= currentWealth * 0.015;
    }
    next.wealth = Math.max(100, Math.round(adjustedWealth));

    // Update budget
    const dynamicBudgetTarget = next.wealth * 0.45;
    const workingBudget = Number.isFinite(next.budget) ? next.budget : dynamicBudgetTarget;
    next.budget = Math.max(0, workingBudget + (dynamicBudgetTarget - workingBudget) * 0.35);
};

/**
 * Initialize rebel nation economy traits
 * @param {Object} nation - Rebel nation object (mutable)
 */
export const initializeRebelEconomy = (nation) => {
    const next = nation;

    if (!next.economyTraits) {
        next.economyTraits = {};
    }

    const basePopulation = Math.max(5, next.economyTraits.basePopulation || next.population || 10);
    const baseWealth = Math.max(100, next.economyTraits.baseWealth || next.wealth || 200);

    next.economyTraits.basePopulation = basePopulation;
    next.economyTraits.baseWealth = baseWealth;

    const maxPopulation = Math.max(basePopulation, Math.floor(basePopulation * 1.1));
    const maxWealth = Math.max(baseWealth, Math.floor(baseWealth * 1.15));

    next.population = clamp(Math.round(next.population || basePopulation), 5, maxPopulation);
    next.wealth = clamp(Math.round(next.wealth || baseWealth), baseWealth * 0.5, maxWealth);
    next.budget = Math.min(next.wealth, Math.max(0, next.budget ?? Math.floor(next.wealth * 0.3)));
};

/**
 * Process war-related recovery for non-war nations
 * @param {Object} nation - AI nation object (mutable)
 */
export const processPostWarRecovery = (nation) => {
    if (!nation.isAtWar) {
        const currentStrength = nation.militaryStrength ?? 1.0;
        if (currentStrength < 1.0) {
            const recoveryRate = 0.005;
            nation.militaryStrength = Math.min(1.0, currentStrength + recoveryRate);
        }
    }
};

/**
 * Process installment payment for war indemnity
 * @param {Object} params - Parameters
 * @param {Object} params.nation - AI nation object (mutable)
 * @param {Object} params.resources - Player resources (mutable)
 * @param {Array} params.logs - Log array (mutable)
 * @returns {number} Amount of war indemnity income
 */
export const processInstallmentPayment = ({
    nation,
    resources,
    logs,
}) => {
    let warIndemnityIncome = 0;
    const next = nation;
    const res = resources;

    if (next.installmentPayment && next.installmentPayment.remainingDays > 0) {
        const payment = next.installmentPayment.amount;
        res.silver = (res.silver || 0) + payment;
        warIndemnityIncome += payment;
        next.installmentPayment.paidAmount += payment;
        next.installmentPayment.remainingDays -= 1;

        if (next.installmentPayment.remainingDays === 0) {
            logs.push(`💰 ${next.name} 完成了所有分期赔款支付（共${next.installmentPayment.totalAmount}银币）。`);
            delete next.installmentPayment;
        }
    }

    return warIndemnityIncome;
};
