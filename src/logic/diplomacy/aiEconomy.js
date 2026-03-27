/**
 * AI Economy Module
 * Handles AI nation economy simulation and development
 * Extracted from simulation.js for better code organization
 */

import { RESOURCES, EPOCHS } from '../../config';
import { WAR_ECONOMY, AI_EPOCH_PROGRESSION } from '../../config/gameConstants';
import { clamp } from '../utils';
import { calculateTradeStatus } from '../../utils/foreignTrade';
import { canForeignTradeResource } from '../utils/helpers';
import { getAIDevelopmentMultiplier } from '../../config/difficulty.js';
import { calculateAILogisticGrowth } from '../population/logisticGrowth.js';
import { calculateBuildingIntegrityModifiers } from './warEconomy';
import { clampBootstrapPopulation } from '../../utils/populationClamp';

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

const getAIPlayerInfluenceFactor = (difficultyMultiplier = 1) => clamp(
    0.12 + Math.max(0, difficultyMultiplier - 1) * 0.06,
    0.10,
    0.20
);

const getAIPopulationSoftCapBoost = (difficultyMultiplier = 1) => clamp(
    1.15 + Math.max(0, difficultyMultiplier - 1) * 0.35,
    1.10,
    1.50
);

const getAIWarGrowthRetention = (difficultyMultiplier = 1) => clamp(
    0.55 + Math.max(0, difficultyMultiplier - 1) * 0.08,
    0.50,
    0.72
);

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
    const foreignResourceKeys = Object.keys(RESOURCES).filter(canForeignTradeResource);

    if (foreignResourceKeys.length > 0) {
        const isInAnyWar = next.isAtWar || (next.foreignWars && Object.values(next.foreignWars).some(w => w?.isAtWar));
        const warConsumptionMultiplier = isInAnyWar ? (1.3 + (next.aggression || 0.2) * 0.5) : 1.0;

        // 时代系数：让后期外国产出和库存显著增加
        // epoch 0=1x, 1=1.5x, 2=2x, 3=2.8x, 4=3.6x, 5=4.5x, 6=5.5x
        const epoch = next.epoch || 0;
        const epochMultiplier = 1 + epoch * 0.5 + Math.pow(epoch, 1.3) * 0.1;

        // 财富系数：让富裕国家有更高产出
        const wealthFactor = Math.max(0.8, Math.min(2.0, (next.wealth || 1000) / 1000));

        // 建筑完好度修正：战争中建筑被破坏后削弱对应资源产量
        const integrityModifiers = calculateBuildingIntegrityModifiers(next);

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
            // 建筑完好度修正：被破坏的建筑会降低对应资源产量
            const integrityFactor = integrityModifiers[resourceKey] ?? 1.0;
            const productionRate = baseProductionRate * Math.pow(bias, 1.2) * productionTrend * integrityFactor;
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
    const safeTick = Number.isFinite(tick) ? tick : 0;

    // [FIX v2] Comprehensive initialization for old saves compatibility
    // Old saves may have:
    // 1. No economyTraits at all
    // 2. economyTraits but missing ownBasePopulation
    // 3. economyTraits but missing lastGrowthTick
    // 4. Invalid/NaN values in critical fields
    
    if (!next.economyTraits) {
        next.economyTraits = {};
    }
    
    // Initialize ownBasePopulation if missing or invalid
    if (!next.economyTraits.ownBasePopulation || 
        !Number.isFinite(next.economyTraits.ownBasePopulation) ||
        next.economyTraits.ownBasePopulation < 1) {
        const templateWealth = next.wealthTemplate || 800;
        const templateFactor = templateWealth / 800;
        // Use current population if available, otherwise calculate from template
        const currentPop = next.population || 16;
        next.economyTraits.ownBasePopulation = Math.max(5, Math.round(
            currentPop > 10 ? currentPop : 16 * templateFactor * (0.8 + Math.random() * 0.4)
        ));
        console.log(`[Legacy Fix] Initialized ownBasePopulation for ${next.name || next.id}: ${next.economyTraits.ownBasePopulation}`);
    }
    
    // Initialize ownBaseWealth if missing or invalid
    if (!next.economyTraits.ownBaseWealth || 
        !Number.isFinite(next.economyTraits.ownBaseWealth) ||
        next.economyTraits.ownBaseWealth < 100) {
        const templateWealth = next.wealthTemplate || 800;
        const templateFactor = templateWealth / 800;
        const currentWealth = next.wealth || 1000;
        next.economyTraits.ownBaseWealth = Math.max(500, Math.round(
            currentWealth > 100 ? currentWealth : 1000 * templateFactor * (0.8 + Math.random() * 0.4)
        ));
    }
    
    // Initialize developmentRate if missing or invalid
    if (!next.economyTraits.developmentRate || 
        !Number.isFinite(next.economyTraits.developmentRate) ||
        next.economyTraits.developmentRate < 0.1) {
        next.economyTraits.developmentRate = 0.8 + (next.aggression || 0.3) * 0.3 + Math.random() * 0.4;
    }
    
    // [FIX v2] Initialize lastGrowthTick - critical for growth timing
    // Old saves may have undefined, null, NaN, or very old tick values
    if (next.economyTraits.lastGrowthTick === undefined || 
        next.economyTraits.lastGrowthTick === null ||
        !Number.isFinite(next.economyTraits.lastGrowthTick) ||
        next.economyTraits.lastGrowthTick < 0) {
        // Set to current tick minus a small amount to trigger immediate growth check
        next.economyTraits.lastGrowthTick = Math.max(0, safeTick - 15);
        console.log(`[Legacy Fix] Initialized missing lastGrowthTick for ${next.name || next.id}`);
    }
    if (Number.isFinite(next.economyTraits.lastGrowthTick) && next.economyTraits.lastGrowthTick > safeTick) {
        next.economyTraits.lastGrowthTick = Math.max(0, safeTick - 15);
        console.log(`[Legacy Fix] Clamped future lastGrowthTick for ${next.name || next.id}`);
    }

    if (next.economyTraits.lastDevelopmentTick === undefined ||
        next.economyTraits.lastDevelopmentTick === null ||
        !Number.isFinite(next.economyTraits.lastDevelopmentTick) ||
        next.economyTraits.lastDevelopmentTick < 0) {
        next.economyTraits.lastDevelopmentTick = Math.max(0, safeTick - 15);
    } else if (next.economyTraits.lastDevelopmentTick > safeTick) {
        next.economyTraits.lastDevelopmentTick = Math.max(0, safeTick - 15);
    }
    
    // [FIX v2] Sync population with ownBasePopulation if population is missing or too low
    // This fixes old saves where population might be 0 or undefined
    if (!next.population || !Number.isFinite(next.population) || next.population < 1) {
        next.population = next.economyTraits.ownBasePopulation;
        console.log(`[Legacy Fix] Synced population for ${next.name || next.id}: ${next.population}`);
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

    // [DEBUG] Log ownBasePopulation at start
    if (next.vassalOf === 'player') {
        console.log(`[Growth Start] ${next.name}: ownBasePopulation=${ownBasePopulation}, population=${next.population}`);
    }

    // [FIX v2] Handle invalid lastGrowthTick more robustly
    const lastGrowthTick = Number.isFinite(next.economyTraits.lastGrowthTick) 
        ? next.economyTraits.lastGrowthTick 
        : Math.max(0, tick - 20);
    const ticksSinceLastGrowth = tick - lastGrowthTick;
    
    // [NEW] Use logistic growth model instead of exponential growth
    // This creates a realistic S-curve that considers resource constraints
    if (ticksSinceLastGrowth >= 10) {
        // [FIX v2] Growth should happen even during war, just at reduced rate
        // Old behavior completely blocked growth during war, causing stagnation
        const warPenalty = next.isAtWar ? getAIWarGrowthRetention(multiplier) : 1.0;
        
        const currentPopulation = next.population || ownBasePopulation;
        
        // [FIX v2] Ensure playerPopulation is valid
        const safePlayerPopulation = Number.isFinite(playerPopulation) && playerPopulation > 0 
            ? playerPopulation 
            : 100;
        
        // Use logistic growth model for population
        const newPopulation = calculateAILogisticGrowth({
            nation: next,
            epoch: epoch,
            difficulty: difficulty,
            playerPopulation: safePlayerPopulation,
            ticksSinceLastUpdate: ticksSinceLastGrowth
        });
        
        // [FIX v3] Enhanced minimum growth guarantee for small populations
        // Problem: Populations < 10000 can get stuck due to rounding (especially war-damaged vassals)
        // Solution: Scale minimum growth based on current population
        let minGrowth = 0;
        if (currentPopulation < 50) {
            minGrowth = 2; // Very small: +2 minimum
        } else if (currentPopulation < 100) {
            minGrowth = 1; // Small: +1 minimum
        } else if (currentPopulation < 500) {
            minGrowth = Math.random() < 0.5 ? 1 : 0; // 50% chance of +1
        } else if (currentPopulation < 1000) {
            // Pop 500-1000: minimum +2
            minGrowth = 2;
        } else if (currentPopulation < 5000) {
            // Pop 1000-5000: minimum +5
            minGrowth = 5;
        } else if (currentPopulation < 10000) {
            // Pop 5000-10000: minimum +10
            minGrowth = 10;
        }
        
        // Apply war penalty to minimum growth too
        minGrowth = Math.floor(minGrowth * warPenalty);
        
        // Calculate actual population with war penalty and minimum growth
        const growthFromModel = newPopulation - currentPopulation;
        const warAdjustedGrowth = Math.trunc(growthFromModel * warPenalty);
        let adjustedGrowth = warAdjustedGrowth;

        if (adjustedGrowth >= 0) {
            adjustedGrowth = Math.max(minGrowth, adjustedGrowth);
        } else {
            // Allow decline when over capacity or in prolonged shortages, but cap the drop rate.
            const maxDecline = Math.max(1, Math.floor(currentPopulation * 0.02)); // Max -2% per update
            adjustedGrowth = Math.max(adjustedGrowth, -maxDecline);
        }

        // If model indicates decline but rounding erased it, apply a tiny decline chance
        if (adjustedGrowth === 0 && growthFromModel < 0 && currentPopulation > 100) {
            adjustedGrowth = Math.random() < Math.min(0.5, Math.abs(growthFromModel)) ? -1 : 0;
        }

        const actualNewPopulation = Math.max(1, currentPopulation + adjustedGrowth);
        
        // Calculate population growth ratio for wealth scaling
        const popGrowthRatio = actualNewPopulation / Math.max(1, currentPopulation);
        
        // [FIX v5] 财富增长机制重构：确保财富能跟上人口增长
        // 问题：之前的机制导致人口22亿但财富只有89，人均财富极低
        // 解决：财富增长应该基于人口规模和增长率，而不是仅仅跟随人口增长率
        
        const actualPopGrowth = actualNewPopulation - currentPopulation;
        const popGrowthRate = actualPopGrowth / Math.max(1, currentPopulation);
        
        const tickScale = Math.min(ticksSinceLastGrowth / 10, 2.0);
        const developmentBonus = (developmentRate - 1) * 0.01;  // [FIX] Increased from 0.005 to 0.01
        
        // 基础财富增长率 = 人口增长率 + 发展奖励
        const baseWealthGrowthRate = popGrowthRate + developmentBonus;
        
        // [FIX v5] 添加人均财富修正：如果人均财富过低，给予额外增长
        const currentPerCapitaWealth = (next.wealth || ownBaseWealth) / Math.max(1, actualNewPopulation);
        const targetPerCapitaWealth = 50;  // 目标人均财富基准
        
        // 如果人均财富低于目标，给予追赶增长（最多+5%）
        let catchUpBonus = 0;
        if (currentPerCapitaWealth < targetPerCapitaWealth) {
            const wealthGap = (targetPerCapitaWealth - currentPerCapitaWealth) / targetPerCapitaWealth;
            catchUpBonus = Math.min(0.05, wealthGap * 0.1);  // 差距越大，追赶越快
        }
        
        const rawWealthRate = (baseWealthGrowthRate + catchUpBonus) * tickScale;
        const cappedWealthRate = clamp(rawWealthRate, -0.02, 0.12);  // [BALANCE] Increased cap to let AI wealth grow faster
        const wealthGrowthRate = 1 + cappedWealthRate;
        
        // [FIX v5] 调整人均财富上限，防止过度限制
        // Per-capita cap: Stone=3k, Ancient=6k, Medieval=12k, Industrial=24k, Modern=48k
        const perCapitaWealthCap = Math.min(500000, 5000 * Math.pow(2.5, Math.min(epoch, 5)));
        
        // If already at or above per-capita cap, slow down growth
        let cappedWealthGrowthRate = 1.0;
        if (currentPerCapitaWealth >= perCapitaWealthCap) {
            // At cap: allow slight decline if population is shrinking, otherwise tiny growth
            const atCapRate = clamp(baseWealthGrowthRate * tickScale, -0.01, 0.005);
            cappedWealthGrowthRate = 1 + atCapRate;
        } else {
            // Below cap: normal growth but capped at 8% per update (increased from 3%)
            cappedWealthGrowthRate = Math.min(wealthGrowthRate, 1.08);
        }
        
        const newBaseWealth = Math.round(ownBaseWealth * cappedWealthGrowthRate);
        const newWealth = Math.max(100, Math.round((next.wealth || ownBaseWealth) * cappedWealthGrowthRate));
        
        // [FIX] Hard cap: ensure per-capita wealth doesn't exceed cap
        const maxAllowedWealth = actualNewPopulation * perCapitaWealthCap;
        const finalWealth = Math.min(newWealth, maxAllowedWealth);
        const finalBaseWealth = Math.min(newBaseWealth, maxAllowedWealth);
        
        // Update values
        next.economyTraits.ownBasePopulation = actualNewPopulation;
        next.economyTraits.ownBaseWealth = finalBaseWealth;
        next.population = actualNewPopulation;
        next.wealth = finalWealth;
        
        // [DEBUG] Log ownBasePopulation after update
        if (next.vassalOf === 'player') {
            console.log(`[Growth End] ${next.name}: ownBasePopulation=${next.economyTraits.ownBasePopulation}, population=${next.population}`);
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
        2.0  // [FIX v4] Reduced from 3.5 to 2.0 to prevent late-game wealth explosion
    );
    const eraMomentum = 1 + Math.max(0, epoch - (powerProfile.appearEpoch ?? 0)) * 0.03;

    // Era growth factor
    // [FIX v4] Reduced from 0.15 to 0.08 to slow late-game growth
    const eraGrowthFactor = 1 + Math.max(0, epoch) * 0.08;

    // Calculate AI own target values (Applied difficulty multiplier)
    const aiOwnTargetPopulation = (next.economyTraits?.ownBasePopulation || 16) * eraGrowthFactor * populationFactor * multiplier;
    const aiOwnTargetWealth = (next.economyTraits?.ownBaseWealth || 1000) * eraGrowthFactor * wealthFactor * multiplier;

    // Blend with player reference (Reduced to 5% for independence)
    const playerInfluenceFactor = getAIPlayerInfluenceFactor(multiplier);
    const playerTargetPopulation = playerPopulationBaseline * populationFactor * eraMomentum;
    const playerTargetWealth = playerWealthBaseline * wealthFactor * eraMomentum;

    const blendedTargetPopulation = aiOwnTargetPopulation * (1 - playerInfluenceFactor) + playerTargetPopulation * playerInfluenceFactor;
    const blendedTargetWealth = aiOwnTargetWealth * (1 - playerInfluenceFactor) + playerTargetWealth * playerInfluenceFactor;

    // Apply template boosts
    // [FIX v4] Reduced template boost multipliers to prevent late-game explosion
    const templatePopulationBoost = Math.max(
        1,
        (next.wealthTemplate || 800) / Math.max(800, playerWealthBaseline) * 0.5
    );
    const templateWealthBoost = Math.max(
        1,
        (next.wealthTemplate || 800) / Math.max(800, playerWealthBaseline) * 0.6
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
    const softCapBoost = getAIPopulationSoftCapBoost(multiplier);
    const populationSoftCap = Math.max(
        220 * softCapBoost,
        playerPopulationBaseline * (0.95 + Math.max(0, multiplier - 1) * 0.12),
        (next.economyTraits?.ownBasePopulation || 16) * (12 + softCapBoost * 8)
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
        const warCasualty = currentPopulation * (0.0032 / Math.max(1, 0.9 + Math.max(0, multiplier - 1) * 0.18)) * tickScaleFactor;
        next.population = Math.max(3, Math.round(currentPopulation - warCasualty));
    }
    
    // [FIX v5] 添加饥荒死亡机制：极度贫困导致人口崩溃
    // 当人均财富极低时（< 0.5），说明经济完全崩溃，应该触发大规模死亡
    const currentWealth = next.wealth ?? desiredWealth;
    const wealthPerCapita = currentWealth / Math.max(1, next.population);
    
    if (wealthPerCapita < 0.5) {
        // 极度贫困：每次更新损失5-15%人口（饥荒）
        const starvationSeverity = Math.max(0, (0.5 - wealthPerCapita) / 0.5);  // 0-1
        const starvationRate = 0.05 + starvationSeverity * 0.1;  // 5%-15%
        const deaths = Math.floor(next.population * starvationRate * tickScaleFactor);
        next.population = Math.max(3, next.population - deaths);
        
        console.warn(`[FAMINE] ${next.name}: 人均财富${wealthPerCapita.toFixed(4)}过低，触发饥荒，人口损失${deaths}（${(starvationRate*100).toFixed(1)}%）`);
    } else if (wealthPerCapita < 2) {
        // 严重贫困：每次更新损失1-3%人口
        const povertyRate = 0.01 + (2 - wealthPerCapita) / 1.5 * 0.02;  // 1%-3%
        const deaths = Math.floor(next.population * povertyRate * tickScaleFactor);
        next.population = Math.max(3, next.population - deaths);
    }
    
    // Food shortage affects military strength, not population directly
    if (foodStatus.isShortage) {
        const shortagePressure = clamp(foodStatus.shortageAmount / Math.max(1, foodStatus.target), 0, 1);
        const currentStrength = next.militaryStrength ?? 1.0;
        next.militaryStrength = Math.max(0.6, currentStrength - shortagePressure * 0.01);
    }

    // [FIX] Wealth should NOT drift independently - it's tied to population growth
    // Only apply minor adjustments here, main wealth growth is in processAIIndependentGrowth
    
    // War penalty on wealth (looting, destruction) — 使用 WAR_ECONOMY 常量保持与玩家侧一致
    let adjustedWealth = currentWealth;
    if (next.isAtWar) {
        // 基础战时财富损耗：介于经济区(2%)和核心区(4%)的中间值，按tick缩放
        const warWealthPenaltyRate = (WAR_ECONOMY.AI_WEALTH_LOSS_ECONOMIC + WAR_ECONOMY.AI_WEALTH_LOSS_CAPITAL) / 2;
        adjustedWealth -= currentWealth * warWealthPenaltyRate * 0.15 * tickScaleFactor;  // ×0.15缓和每tick的影响

        // 战时 militaryStrength 缓慢消耗（模拟装备损耗和后勤压力）
        const currentStrength = next.militaryStrength ?? 1.0;
        next.militaryStrength = Math.max(0.5, currentStrength - 0.002 * tickScaleFactor);
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

    // 财富只在首次初始化时设置默认值，之后允许战争损耗自由消耗
    // 仅保留极低的生存底线（10%基础财富），不再每tick强制夹回50%
    if (next.wealth == null) {
        next.wealth = baseWealth;
    } else {
        next.wealth = clamp(Math.round(next.wealth), Math.floor(baseWealth * 0.1), maxWealth);
    }
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
            // 战后 militaryStrength 恢复，使用与wealth恢复一致的数量级
            const recoveryRate = WAR_ECONOMY.AI_POST_WAR_WEALTH_RECOVERY * 5; // 0.005/tick
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
 * 改造后的时代升级机制：基于科技/文化累积 + 人口/财富门槛
 * @param {Object} nation - AI nation object (mutable)
 * @param {Array} logs - Log array (mutable)
 * @param {number} tick - Current game tick (optional, for cooldown)
 */
export const checkAIEpochProgression = (nation, logs, tick = 0) => {
    if (!nation || nation.isRebelNation) return;

    const currentEpochId = nation.epoch || 0;
    if (currentEpochId >= EPOCHS.length - 1) return; // 已达最高时代

    // 冷却检查：防止连续快速升级
    const EPOCH_COOLDOWN = AI_EPOCH_PROGRESSION.EPOCH_COOLDOWN;
    const lastEpochTick = nation._lastEpochUpgradeTick || 0;
    if (tick > 0 && (tick - lastEpochTick) < EPOCH_COOLDOWN) {
        return;
    }

    const nextEpochId = currentEpochId + 1;
    const nextEpochData = EPOCHS.find(e => e.id === nextEpochId);
    if (!nextEpochData) return;

    // === 存档兼容：初始化科技/文化累积值 ===
    if (nation._scienceAccum === undefined || nation._scienceAccum === null) {
        // 对已处于高时代的 AI，按当前时代反推累积值
        if (currentEpochId > 0) {
            const currentEpochData = EPOCHS.find(e => e.id === currentEpochId);
            const sciScale = AI_EPOCH_PROGRESSION.SCIENCE_SCALE_BY_EPOCH[currentEpochId] || 0.30;
            const culScale = AI_EPOCH_PROGRESSION.CULTURE_SCALE_BY_EPOCH[currentEpochId] || 0.30;
            nation._scienceAccum = (currentEpochData?.req?.science || 0) * sciScale * 1.1;
            nation._cultureAccum = (currentEpochData?.req?.culture || 0) * culScale * 1.1;
        } else {
            nation._scienceAccum = 0;
            nation._cultureAccum = 0;
        }
    }

    // === 计算各维度门槛与进度 ===
    const sciScale = AI_EPOCH_PROGRESSION.SCIENCE_SCALE_BY_EPOCH[nextEpochId] || 0.30;
    const culScale = AI_EPOCH_PROGRESSION.CULTURE_SCALE_BY_EPOCH[nextEpochId] || 0.30;

    const scienceReq = (nextEpochData.req?.science || 0) * sciScale;
    const cultureReq = (nextEpochData.req?.culture || 0) * culScale;
    const popReq = nextEpochData.req?.population || 0;
    // 财富门槛：使用 cost.silver × 2 作为基准（与旧逻辑一致，但不再乘以巨大的 epochMult）
    const wealthReq = (nextEpochData.cost?.silver || 1000) * 2;

    const scienceAccum = nation._scienceAccum || 0;
    const cultureAccum = nation._cultureAccum || 0;
    const population = nation.population || 0;
    const wealth = nation.wealth || 0;

    const scienceReady = scienceReq <= 0 || scienceAccum >= scienceReq;
    const cultureReady = cultureReq <= 0 || cultureAccum >= cultureReq;
    const popReady = population >= popReq;
    const wealthReady = wealth >= wealthReq;

    // === 计算准备度（用最小值加权，避免单一维度遮盖瓶颈）===
    const scienceProgress = scienceReq > 0 ? clamp(scienceAccum / scienceReq, 0, 1) : 1;
    const cultureProgress = cultureReq > 0 ? clamp(cultureAccum / cultureReq, 0, 1) : 1;
    const popProgress = popReq > 0 ? clamp(population / popReq, 0, 1) : 1;
    const wealthProgress = wealthReq > 0 ? clamp(wealth / wealthReq, 0, 1) : 1;

    const minProgress = Math.min(scienceProgress, cultureProgress, popProgress, wealthProgress);
    const avgProgress = (scienceProgress + cultureProgress + popProgress + wealthProgress) / 4;
    // 60% 看瓶颈维度，40% 看均值
    nation._epochReadiness = clamp(minProgress * 0.6 + avgProgress * 0.4, 0, 1);

    // === 升级判定 ===
    if (scienceReady && cultureReady && popReady && wealthReady) {
        // 消耗累积值
        nation._scienceAccum = Math.max(0, scienceAccum - scienceReq);
        nation._cultureAccum = Math.max(0, cultureAccum - cultureReq);
        // 消耗财富
        const cost = nextEpochData.cost?.silver || 0;
        nation.wealth = Math.max(0, wealth - cost);
        // 升级
        nation.epoch = nextEpochId;
        nation._lastEpochUpgradeTick = tick;
        // 触发建筑重规划
        nation._needsBuildingReplan = true;

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
        // Population scaling: new nations should be 30%-150% of player's population
        if (playerPopulation > 0) {
            populationScale = Math.max(0.3, Math.min(1.5, playerPopulation / 5000));
        }

        // Wealth scaling: new nations should be 20%-120% of player's wealth
        if (playerWealth > 0) {
            wealthScale = Math.max(0.2, Math.min(1.2, playerWealth / 50000));
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
    nation.population = clampBootstrapPopulation(scaledPopulation);

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
        nation.economyTraits.ownBasePopulation = Math.max(5, Math.floor(nation.population / 5));
        nation.economyTraits.ownBaseWealth = Math.max(500, Math.floor(nation.wealth));
    }

    // Update wealth template for future calculations
    nation.wealthTemplate = nation.wealth;
};
