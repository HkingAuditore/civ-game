/**
 * AI Economy Module
 * Handles AI nation economy simulation and development
 * Extracted from simulation.js for better code organization
 */

import { RESOURCES, EPOCHS } from '../../config';
import { clamp } from '../utils';
import { calculateTradeStatus } from '../../utils/foreignTrade';
import { isTradableResource } from '../utils/helpers';
import { getAIDevelopmentMultiplier } from '../../config/difficulty.js';
import { calculateAILogisticGrowth } from '../population/logisticGrowth.js';

const applyTreasuryChange = (resources, delta, reason, onTreasuryChange) => {
    if (!resources || !Number.isFinite(delta) || delta === 0) return 0;
    const before = Number(resources.silver || 0);
    const after = Math.max(0, before + delta);
    const actual = after - before;
    resources.silver = after;
    if (typeof onTreasuryChange === 'function' && actual !== 0) {
        onTreasuryChange(actual, reason);
    }
    return actual;
};

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

            // 生产率和消费率也随时代增长（增大基础值让贸易更活跃）
            const baseProductionRate = 5.0 * gameSpeed * epochMultiplier * wealthFactor;
            const baseConsumptionRate = 5.0 * gameSpeed * epochMultiplier * wealthFactor * warConsumptionMultiplier;

            // 长周期趋势：每个资源有独立的周期偏移（600-800天）
            // 这样可以让盈余/缺口状态持续更长时间，形成稳定的贸易渠道
            const resourceOffset = resourceKey.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
            const cyclePeriod = 600 + (resourceOffset % 200); // 600-800天的周期
            const cyclePhase = Math.sin((tick * 2 * Math.PI) / cyclePeriod + resourceOffset * 0.1);

            // 根据bias放大趋势影响：特产资源容易产生大盈余，稀缺资源容易产生大缺口
            const trendAmplitude = 0.35 + Math.abs(bias - 1) * 0.45;
            // 特产资源(bias>1)：周期高点时生产暴增，低点时也有较高生产
            // 稀缺资源(bias<1)：周期高点时消费暴增，低点时也有较高消费
            const productionTrend = bias > 1
                ? 1 + Math.max(0, cyclePhase) * trendAmplitude + 0.2  // 特产资源永远有生产优势
                : 1 - Math.max(0, cyclePhase) * trendAmplitude * 0.4;
            const consumptionTrend = bias < 1
                ? 1 + Math.max(0, cyclePhase) * trendAmplitude + 0.15 // 稀缺资源永远有消费压力
                : 1 - Math.max(0, cyclePhase) * trendAmplitude * 0.25;

            // 特产资源：生产多，消费少 -> 容易盈余
            // 稀缺资源：生产少，消费多 -> 容易缺口
            // 使用更激进的指数让差异更明显
            const productionRate = baseProductionRate * Math.pow(bias, 1.2) * productionTrend;
            const consumptionRate = baseConsumptionRate * Math.pow(1 / bias, 0.8) * consumptionTrend;
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
    
    // [FIX] Legacy save compatibility: Initialize missing lastGrowthTick for old saves
    // Old saves may have economyTraits but missing lastGrowthTick field
    // Without this fix, ticksSinceLastGrowth calculation may fail or return invalid values
    if (next.economyTraits && (next.economyTraits.lastGrowthTick === undefined || next.economyTraits.lastGrowthTick === null)) {
        // Set to current tick minus a small amount to trigger immediate growth check
        next.economyTraits.lastGrowthTick = Math.max(0, tick - 15);
        console.log(`[Legacy Fix] Initialized missing lastGrowthTick for ${next.name || next.id}`);
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
    difficulty,
    epoch = 0,
    playerPopulation = 100,
}) => {
    const next = nation;

    if (!next.economyTraits) return;

    const multiplier = getAIDevelopmentMultiplier(difficulty);
    const ownBasePopulation = next.economyTraits.ownBasePopulation;
    const ownBaseWealth = next.economyTraits.ownBaseWealth;
    const developmentRate = (next.economyTraits.developmentRate || 1.0) * multiplier;

    const ticksSinceLastGrowth = tick - (next.economyTraits.lastGrowthTick || 0);
    
    // [NEW] Use logistic growth model instead of exponential growth
    // This creates a realistic S-curve that considers resource constraints
    if (ticksSinceLastGrowth >= 10) {
        // Only grow when not at war
        if (!next.isAtWar) {
            const currentPopulation = next.population || ownBasePopulation;
            
            // Use logistic growth model for population
            const newPopulation = calculateAILogisticGrowth({
                nation: next,
                epoch: epoch,
                difficulty: difficulty,
                playerPopulation: playerPopulation,
                ticksSinceLastUpdate: ticksSinceLastGrowth
            });
            
            // Ensure minimum growth of 1 for small populations (prevents stagnation)
            const minGrowth = currentPopulation < 20 ? 1 : 0;
            const actualNewPopulation = Math.max(currentPopulation + minGrowth, newPopulation);
            
            // Calculate population growth ratio for wealth scaling
            const popGrowthRatio = actualNewPopulation / Math.max(1, currentPopulation);
            
            // Wealth grows proportionally to population growth (NOT independently!)
            // This prevents wealth from growing while population is capped
            const actualPopGrowth = actualNewPopulation - currentPopulation;
            const popGrowthRate = actualPopGrowth / Math.max(1, currentPopulation);
            
            // Wealth growth rate should match population growth rate (with some bonus for development)
            // If population growth is 0, wealth growth should also be minimal
            const tickScale = Math.min(ticksSinceLastGrowth / 10, 2.0);
            const developmentBonus = (developmentRate - 1) * 0.01;  // Small bonus for high development
            
            // Key fix: wealth growth is tied to population growth rate
            // If pop growth rate is 0 (capped), wealth growth is only development bonus (very slow)
            const baseWealthGrowthRate = popGrowthRate + developmentBonus;
            const wealthGrowthRate = 1 + Math.max(0, baseWealthGrowthRate * tickScale);
            
            // Cap wealth growth rate to prevent runaway growth
            const cappedWealthGrowthRate = Math.min(wealthGrowthRate, 1.05);  // Max 5% per update
            
            const newBaseWealth = Math.round(ownBaseWealth * cappedWealthGrowthRate);
            
            // Update values
            next.economyTraits.ownBasePopulation = actualNewPopulation;
            next.economyTraits.ownBaseWealth = newBaseWealth;
            next.population = actualNewPopulation;
            next.wealth = Math.max(100, Math.round((next.wealth || ownBaseWealth) * cappedWealthGrowthRate));
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
    tick,
    difficulty,
}) => {
    const next = nation;
    const multiplier = getAIDevelopmentMultiplier(difficulty);
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

    // Calculate AI own target values (Applied difficulty multiplier)
    const aiOwnTargetPopulation = (next.economyTraits?.ownBasePopulation || 16) * eraGrowthFactor * populationFactor * multiplier;
    const aiOwnTargetWealth = (next.economyTraits?.ownBaseWealth || 1000) * eraGrowthFactor * wealthFactor * multiplier;

    // Blend with player reference (Reduced to 5% for independence)
    const playerInfluenceFactor = 0.05;
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
    const foodStatus = calculateTradeStatus('food', next, tick);
    const foodPressure = foodStatus.isShortage
        ? clamp(1 - (foodStatus.shortageAmount / Math.max(1, foodStatus.target)), 0.5, 1)
        : 1;
    const foodSurplusBoost = foodStatus.isSurplus
        ? clamp(1 + (foodStatus.surplusAmount / Math.max(1, foodStatus.target)) * 0.08, 1, 1.15)
        : 1;
    const foodFactor = clamp(foodPressure * foodSurplusBoost, 0.5, 1.15);
    const desiredPopulationRaw = Math.max(3, blendedTargetPopulation * templatePopulationBoost * foodFactor);
    // [FIX] Significantly reduce soft cap to prevent early game population explosion
    // Initial population ~16, so soft cap starts at ~160, grows slowly with actual population
    const populationSoftCap = Math.max(
        200,  // [FIX] Reduce base cap from 10000 to 200 for early game balance
        playerPopulationBaseline * 0.8,  // [FIX] Reduce from 1.2x to 0.8x player population
        (next.economyTraits?.ownBasePopulation || 16) * 10  // [FIX] Reduce from 300x to 10x base population
    );
    const populationOverage = Math.max(0, desiredPopulationRaw - populationSoftCap);
    const desiredPopulation = populationOverage > 0
        ? populationSoftCap + (populationOverage / (1 + (populationOverage / populationSoftCap) * 0.15))  // 大幅减轻超限惩罚：0.3->0.15
        : desiredPopulationRaw;
    const desiredWealth = Math.max(100, blendedTargetWealth * templateWealthBoost);

    next.economyTraits = {
        ...(next.economyTraits || {}),
        basePopulation: desiredPopulation,
        baseWealth: desiredWealth,
    };

    // [FIX] REMOVED POPULATION DRIFT - Population is now handled ONLY by processAIIndependentGrowth
    // This function should only update economy traits and wealth, NOT population
    // Having two functions modify population caused DOUBLE GROWTH BUG!
    
    // [FIX] Track time since last development update (for wealth only now)
    const lastDevTick = next.economyTraits?.lastDevelopmentTick || 0;
    const ticksSinceDev = Math.max(1, tick - lastDevTick);
    const tickScaleFactor = Math.min(ticksSinceDev / 10, 2);
    next.economyTraits.lastDevelopmentTick = tick;
    
    const currentPopulation = next.population ?? desiredPopulation;
    const driftMultiplier = clamp(1 + volatility * 0.6 + eraMomentum * 0.08, 1, 2.2);
    
    // [FIX] Only apply war casualty, don't drift population towards target
    // Population growth is handled by logistic model in processAIIndependentGrowth
    if (next.isAtWar) {
        const warCasualty = currentPopulation * 0.005 * tickScaleFactor;
        next.population = Math.max(3, Math.round(currentPopulation - warCasualty));
    }
    
    // Food shortage affects military strength, not population directly
    if (foodStatus.isShortage) {
        const shortagePressure = clamp(foodStatus.shortageAmount / Math.max(1, foodStatus.target), 0, 1);
        const currentStrength = next.militaryStrength ?? 1.0;
        next.militaryStrength = Math.max(0.6, currentStrength - shortagePressure * 0.01);
    }

    // [FIX] Wealth should NOT drift independently - it's tied to population growth
    // Only apply minor adjustments here, main wealth growth is in processAIIndependentGrowth
    const currentWealth = next.wealth ?? desiredWealth;
    
    // War penalty on wealth (looting, destruction)
    let adjustedWealth = currentWealth;
    if (next.isAtWar) {
        adjustedWealth -= currentWealth * 0.003 * tickScaleFactor;  // Small war penalty
    }
    
    // Small random fluctuation (±1%)
    const wealthNoise = (Math.random() - 0.5) * currentWealth * 0.02;
    adjustedWealth += wealthNoise;
    
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
    onTreasuryChange,
}) => {
    let warIndemnityIncome = 0;
    const next = nation;
    const res = resources;

    if (next.installmentPayment && next.installmentPayment.remainingDays > 0) {
        const payment = next.installmentPayment.amount;
        applyTreasuryChange(res, payment, 'installment_payment_income', onTreasuryChange);
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

/**
 * Check and process AI nation epoch progression
 * @param {Object} nation - AI nation object (mutable)
 * @param {Array} logs - Log array (mutable)
 * @param {number} tick - Current game tick (optional, for cooldown)
 */
export const checkAIEpochProgression = (nation, logs, tick = 0) => {
    if (!nation || nation.isRebelNation) return;

    // Safety check
    const currentEpochId = nation.epoch || 0;
    if (currentEpochId >= EPOCHS.length - 1) return; // Max epoch reached

    // [FIX] Add cooldown to prevent rapid epoch progression
    // AI can only advance one epoch every 200 ticks (about 2 seasons/50 days)
    const EPOCH_COOLDOWN = 200;
    const lastEpochTick = nation._lastEpochUpgradeTick || 0;
    if (tick > 0 && (tick - lastEpochTick) < EPOCH_COOLDOWN) {
        return; // Still on cooldown
    }

    const nextEpochId = currentEpochId + 1;
    const nextEpochData = EPOCHS.find(e => e.id === nextEpochId);

    if (!nextEpochData) return;

    // Requirements - progressive scaling: later epochs have exponentially higher requirements
    // Base multiplier starts at 100x for early eras, scaling up to 800x+ for later eras
    // This creates a more realistic and challenging progression curve for AI nations
    const epochMultipliers = {
        1: 100,   // Bronze Age: 100x
        2: 150,   // Classical Age: 150x
        3: 200,   // Feudal Age: 200x
        4: 300,   // Exploration Age: 300x
        5: 400,   // Enlightenment Age: 400x
        6: 600,   // Industrial Age: 600x
        7: 800,   // Information Age: 800x
    };
    const epochMult = epochMultipliers[nextEpochId] || 100;
    
    const reqPop = (nextEpochData.req?.population || 0) * epochMult;
    const reqWealth = (nextEpochData.cost?.silver || 1000) * epochMult;

    if ((nation.population || 0) >= reqPop && (nation.wealth || 0) >= reqWealth) {
        // Upgrade!
        nation.epoch = nextEpochId;
        // Deduct cost (abstracted simulation of upgrading infrastructure)
        // [FIX] Double the cost deduction to slow down wealth accumulation
        const cost = (nextEpochData.cost?.silver || 0) * 2;
        nation.wealth = Math.max(0, (nation.wealth || 0) - cost);
        // [FIX] Record cooldown timestamp
        nation._lastEpochUpgradeTick = tick;

        logs.push(`🚀 ${nation.name} 迈入了新的时代：${nextEpochData.name}！`);
    }
};

/**
 * Scale newly unlocked nations based on player's current development level
 * This ensures that nations appearing in later epochs have appropriate strength
 * @param {Object} params - Parameters
 * @param {Object} params.nation - AI nation object (mutable)
 * @param {number} params.playerPopulation - Player's current population
 * @param {number} params.playerWealth - Player's current wealth (silver)
 * @param {number} params.currentEpoch - Current game epoch
 * @param {boolean} params.isFirstInitialization - Whether this is the first time initializing this nation
 */
export const scaleNewlyUnlockedNation = ({
    nation,
    playerPopulation,
    playerWealth,
    currentEpoch,
    isFirstInitialization = false,
}) => {
    if (!nation) return;

    const appearEpoch = nation.appearEpoch ?? 0;
    
    // Only scale if:
    // 1. This is first initialization AND nation appears in current or past epoch
    // 2. OR nation has a flag indicating it needs scaling
    const shouldScale = (isFirstInitialization && appearEpoch <= currentEpoch) || nation._needsScaling;
    
    if (!shouldScale) return;

    // Remove scaling flag if it exists
    delete nation._needsScaling;

    // Calculate scaling factors based on player's development
    let populationScale = 1.0;
    let wealthScale = 1.0;

    if (appearEpoch > 0 && appearEpoch <= currentEpoch) {
        // Population scaling: new nations should be 30%-80% of player's population
        // Scale based on player population, with reasonable bounds
        if (playerPopulation > 0) {
            populationScale = Math.max(0.3, Math.min(0.8, playerPopulation / 5000));
        }

        // Wealth scaling: new nations should be 20%-60% of player's wealth
        // Scale based on player wealth, with reasonable bounds
        if (playerWealth > 0) {
            wealthScale = Math.max(0.2, Math.min(0.6, playerWealth / 50000));
        }

        // Epoch bonus: each epoch adds 20% to the scaling
        const epochBonus = 1 + (appearEpoch * 0.2);
        populationScale *= epochBonus;
        wealthScale *= epochBonus;

        // Apply minimum thresholds to ensure nations are not too weak
        populationScale = Math.max(1.0, populationScale);
        wealthScale = Math.max(1.0, wealthScale);
    }

    // Scale population
    const originalPopulation = nation.population || 1000;
    const scaledPopulation = Math.floor(originalPopulation * populationScale);
    nation.population = Math.max(100, scaledPopulation);

    // Scale wealth
    const originalWealth = nation.wealth || 800;
    const scaledWealth = Math.floor(originalWealth * wealthScale);
    nation.wealth = Math.max(500, scaledWealth);

    // Update budget proportionally
    nation.budget = Math.floor(nation.wealth * 0.5);

    // Update economy traits base values for future growth
    if (nation.economyTraits) {
        nation.economyTraits.basePopulation = nation.population;
        nation.economyTraits.baseWealth = nation.wealth;
        nation.economyTraits.ownBasePopulation = Math.max(5, Math.floor(nation.population / 10));
        nation.economyTraits.ownBaseWealth = Math.max(500, Math.floor(nation.wealth));
    }

    // Update wealth template for future calculations
    nation.wealthTemplate = nation.wealth;
};
