/**
 * Economy Migration Tool
 * Used to migrate old data to the new system
 */

import { AIEconomyState } from '../models/AIEconomyState.js';
import { getPerCapitaWealthCap, getTargetPerCapitaWealth } from '../config/aiEconomyConfig.js';
import { calculateAINationCapacity } from '../../population/logisticGrowth.js';
import { calculateAITreasuryTargetRatio } from '../economyUtils.js';

const sanitizeMigratedState = (state) => {
    const epoch = Math.max(0, Number(state.epoch || 0));
    const epochPopulationBaseline = [900, 1400, 2200, 3400, 5200, 7800, 11000][Math.min(epoch, 6)];
    const basePopulationReference = Math.max(
        Number(state.basePopulation || 0),
        Number(state.population || 0),
        epochPopulationBaseline
    );
    // 迁移只负责兜底与防止爆表，不应把正常 AI 压成“小村落”。
    const populationCap = Math.max(
        epochPopulationBaseline * 12,
        Math.round(basePopulationReference * 8)
    );

    state.population = Math.min(Math.max(1, Math.round(state.population || 1)), populationCap);
    // [FIX] Don't fall back to state.population for basePopulation - this causes ownBasePopulation
    // to inflate to current population, which then inflates capacityFloor in AIPopulationDynamics.
    // basePopulation should remain a small "seed" value that grows slowly via the 0.965/0.035 blend.
    const epochBasePopDefault = [20, 40, 80, 160, 300, 500, 800][Math.min(state.epoch || 0, 6)] || 20;
    state.basePopulation = Math.max(20, Math.round(state.basePopulation || epochBasePopDefault));

    const perCapitaCap = getPerCapitaWealthCap(epoch);
    const targetPerCapita = getTargetPerCapitaWealth(epoch);
    const baseWealthReference = Math.max(
        Number(state.baseWealth || 0),
        Number(state.wealth || 0),
        Math.round(basePopulationReference * targetPerCapita)
    );
    const wealthCap = Math.max(
        5000,
        Math.round(state.population * perCapitaCap * 6),
        Math.round(baseWealthReference * 6)
    );
    state.wealth = Math.min(Math.max(100, Math.round(state.wealth || 100)), wealthCap);
    state.baseWealth = Math.max(
        120,
        Math.round(state.baseWealth || state.wealth),
        Math.round(state.population * targetPerCapita)
    );
    const treasuryTargetRatio = calculateAITreasuryTargetRatio({
        wealth: state.wealth,
        population: state.population,
        epoch,
        isAtWar: false,
        aggression: 0.3,
        capacityUsage: 0.6,
        developmentRate: state.developmentRate,
    });
    state.budget = Math.min(
        Math.max(0, Math.round(state.budget || state.wealth * treasuryTargetRatio)),
        Math.round(state.wealth * Math.min(0.5, treasuryTargetRatio + 0.08))
    );

    return state;
};

const buildMigratedMetrics = (nation, state) => {
    const epoch = Math.max(0, Number(state.epoch || 0));
    const capacityInfo = calculateAINationCapacity({
        nation: {
            ...nation,
            population: state.population,
            wealth: state.wealth,
            budget: state.budget,
            inventory: state.inventory,
            economyTraits: {
                ...(nation.economyTraits || {}),
                ownBasePopulation: state.basePopulation,
                developmentRate: state.developmentRate,
            },
        },
        epoch,
        difficulty: 'normal',
        playerPopulation: 100,
    });
    const targetPerCapita = getTargetPerCapitaWealth(epoch);
    const annualOutput = Math.max(1, Math.round(state.population * targetPerCapita * 0.32));
    const treasury = Math.max(0, Math.round(state.budget || 0));

    return {
        carryingCapacity: capacityInfo.carryingCapacity,
        capacityUsage: state.population / Math.max(1, capacityInfo.carryingCapacity),
        annualOutput,
        treasury,
        treasuryRatio: treasury / Math.max(1, state.wealth),
        householdWealth: Math.max(0, Math.round(state.wealth - treasury)),
        wealthStock: Math.round(state.wealth),
        wealthPerCapita: state.wealth / Math.max(1, state.population),
        outputPerCapita: annualOutput / Math.max(1, state.population),
    };
};

export function migrateNationEconomy(nation) {
    // Create new state
    const rawState = AIEconomyState.fromLegacyFormat(nation);
    const state = sanitizeMigratedState(rawState);
    
    // Validate
    const validation = state.validate();
    if (!validation.isValid) {
        console.warn(`[Migration] Failed to migrate ${nation.name}:`, validation.errors);
        return nation;
    }
    
    const metrics = buildMigratedMetrics(nation, state);
    
    // Convert back to legacy format and mark as migrated
    return {
        ...nation,
        ...state.toLegacyFormat(),
        gdp: metrics.annualOutput,
        aiEconomyMetrics: metrics,
        _economyMigrated: true,
    };
}

export function migrateAllNations(nations) {
    return nations.map(migrateNationEconomy);
}
