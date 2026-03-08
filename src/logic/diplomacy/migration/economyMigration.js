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
    const epochPopulationCeiling = [80, 220, 600, 1800, 5200, 12000, 24000][Math.min(epoch, 6)];
    const populationCap = Math.max(
        epochPopulationCeiling,
        Math.round((state.basePopulation || state.population || 100) * 1.2)
    );

    state.population = Math.min(Math.max(1, Math.round(state.population || 1)), populationCap);
    state.basePopulation = Math.min(
        Math.max(20, Math.round(state.basePopulation || state.population)),
        populationCap
    );

    const perCapitaCap = getPerCapitaWealthCap(epoch);
    const targetPerCapita = getTargetPerCapitaWealth(epoch);
    const wealthCap = Math.max(200, Math.round(state.population * perCapitaCap));
    state.wealth = Math.min(Math.max(100, Math.round(state.wealth || 100)), wealthCap);
    state.baseWealth = Math.min(
        Math.max(120, Math.round(state.baseWealth || state.wealth)),
        Math.max(state.wealth, Math.round(state.population * targetPerCapita * 1.5))
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
    const state = sanitizeMigratedState(AIEconomyState.fromLegacyFormat(nation));
    
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
