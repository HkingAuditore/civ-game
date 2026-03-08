/**
 * AI Economy Service
 * Unified AI economy update service
 */

import { AIEconomyState } from '../models/AIEconomyState.js';
import { GrowthCalculator } from '../calculators/GrowthCalculator.js';
import { ResourceManager } from '../calculators/ResourceManager.js';
import { getConfig, getPerCapitaWealthCap, getTargetPerCapitaWealth } from '../config/aiEconomyConfig.js';
import { calculateAINationCapacity } from '../../population/logisticGrowth.js';
import { calculateAITreasuryTargetRatio } from '../economyUtils.js';
import { debugLog } from '../../../utils/debugFlags.js';

export class AIEconomyService {
    /**
     * Update AI nation economy (main entry point)
     */
    static update({
        nation,
        tick,
        epoch,
        difficulty,
        playerPopulation,
        gameSpeed = 1.0,
    }) {
        // Convert to new data model
        const state = AIEconomyState.fromLegacyFormat(nation);
        
        // Validate data
        const validation = state.validate();
        if (!validation.isValid) {
            console.error(`[AI Economy] Invalid state for ${nation.name}:`, validation.errors);
            return nation;
        }

        const capacityInfo = this._normalizeLegacyOutliers(state, nation, {
            epoch,
            difficulty,
            playerPopulation,
        });
        
        // [DEBUG] Log state before growth
        const beforePop = state.population;
        const beforeWealth = state.wealth;
        const lastGrowthTick = state.lastGrowthTick;
        
        // Update growth
        const shouldGrow = this._shouldUpdateGrowth(state, tick);
        if (shouldGrow) {
            this._updateGrowth(state, {
                tick,
                epoch,
                difficulty,
                playerPopulation,
            });
            
            // [DEBUG] Log growth results
            if (nation.vassalOf === 'player') {
                debugLog('trade', `[AIEconomy Growth] ${nation.name}: pop ${beforePop}→${state.population}, wealth ${beforeWealth}→${state.wealth}, ticks since last: ${tick - lastGrowthTick}, had traits: ${!!nation.economyTraits}`);
            }
        } else if (nation.vassalOf === 'player' && tick % 100 === 0) {
            // [DEBUG] Log why growth didn't happen
            debugLog('trade', `[AIEconomy No Growth] ${nation.name}: shouldGrow=false, ticks since last: ${tick - lastGrowthTick}, interval: ${getConfig('growth.updateInterval', 10)}`);
        }
        
        // Update resources
        this._updateResources(state, {
            tick,
            gameSpeed,
            aggression: nation.aggression,
        });
        
        const treasuryTargetRatio = calculateAITreasuryTargetRatio({
            wealth: state.wealth,
            population: state.population,
            epoch,
            isAtWar: state.isAtWar,
            aggression: nation.aggression,
            capacityUsage: capacityInfo.carryingCapacity > 0 ? state.population / capacityInfo.carryingCapacity : 0.6,
            developmentRate: state.developmentRate,
        });

        // Update budget
        state.budget = ResourceManager.updateBudget({
            currentBudget: state.budget,
            wealth: state.wealth,
            gameSpeed,
            targetRatio: treasuryTargetRatio,
        });

        const economyMetrics = this._buildEconomyMetrics(state, nation, {
            epoch,
            difficulty,
            playerPopulation,
            capacityInfo,
        });
        
        // Convert back to legacy format
        return {
            ...nation,
            ...state.toLegacyFormat(),
            gdp: economyMetrics.annualOutput,
            aiEconomyMetrics: economyMetrics,
        };
    }
    
    /**
     * Check if growth should be updated
     */
    static _shouldUpdateGrowth(state, tick) {
        const updateInterval = getConfig('growth.updateInterval', 10);
        const ticksSinceLastGrowth = tick - state.lastGrowthTick;
        return ticksSinceLastGrowth >= updateInterval;
    }
    
    /**
     * Update growth
     */
    static _updateGrowth(state, { tick, epoch, difficulty, playerPopulation }) {
        const ticksSinceLastUpdate = tick - state.lastGrowthTick;
        
        // Calculate population growth
        const popResult = GrowthCalculator.calculatePopulationGrowth({
            currentPopulation: state.population,
            basePopulation: state.basePopulation,
            epoch,
            difficulty,
            playerPopulation,
            ticksSinceLastUpdate,
            isAtWar: state.isAtWar,
        });
        
        // Calculate wealth growth
        const wealthResult = GrowthCalculator.calculateWealthGrowth({
            currentWealth: state.wealth,
            currentPopulation: state.population,
            newPopulation: popResult.newPopulation,
            epoch,
            developmentRate: state.developmentRate,
            ticksSinceLastUpdate,
            inventory: state.inventory,
            resourceBias: state.resourceBias,
        });
        
        // Update state
        state.population = popResult.newPopulation;
        state.wealth = wealthResult.newWealth;
        state.basePopulation = Math.max(20, Math.round(state.basePopulation * 0.96 + popResult.newPopulation * 0.04));
        state.baseWealth = Math.max(120, Math.round(state.baseWealth * 0.94 + wealthResult.newWealth * 0.06));
        state.lastGrowthTick = tick;
        state.lastUpdateTick = tick;
    }
    
    /**
     * Update resources
     */
    static _updateResources(state, { tick, gameSpeed, aggression }) {
        state.inventory = ResourceManager.updateInventory({
            inventory: state.inventory,
            resourceBias: state.resourceBias,
            epoch: state.epoch,
            wealth: state.wealth,
            isAtWar: state.isAtWar,
            tick,
            gameSpeed,
            aggression,
        });
    }

    static _normalizeLegacyOutliers(state, nation, { epoch, difficulty, playerPopulation }) {
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
            difficulty,
            playerPopulation,
        });

        const hardPopulationCap = Math.max(60, Math.round(capacityInfo.carryingCapacity * 1.15));
        if (state.population > hardPopulationCap) {
            state.population = hardPopulationCap;
        }

        state.basePopulation = Math.min(
            Math.max(20, state.basePopulation || state.population),
            Math.max(state.population, hardPopulationCap)
        );

        const perCapitaCap = getPerCapitaWealthCap(epoch);
        const hardWealthCap = Math.max(200, Math.round(state.population * perCapitaCap));
        if (state.wealth > hardWealthCap) {
            state.wealth = hardWealthCap;
        }

        const targetPerCapita = getTargetPerCapitaWealth(epoch);
        const softBaseWealthCap = Math.max(
            state.wealth,
            Math.round(state.population * targetPerCapita * 1.5)
        );
        state.baseWealth = Math.min(
            Math.max(120, state.baseWealth || state.wealth),
            softBaseWealthCap
        );

        const treasuryTargetRatio = calculateAITreasuryTargetRatio({
            wealth: state.wealth,
            population: state.population,
            epoch,
            isAtWar: state.isAtWar,
            aggression: nation.aggression,
            capacityUsage: capacityInfo.carryingCapacity > 0 ? state.population / capacityInfo.carryingCapacity : 0.6,
            developmentRate: state.developmentRate,
        });
        const maxBudget = Math.max(50, Math.round(state.wealth * Math.min(0.5, treasuryTargetRatio + 0.08)));
        state.budget = Math.min(
            Math.max(0, Number.isFinite(state.budget) ? state.budget : Math.round(state.wealth * treasuryTargetRatio)),
            maxBudget
        );

        return capacityInfo;
    }

    static _buildEconomyMetrics(state, nation, { epoch, difficulty, playerPopulation, capacityInfo = null }) {
        const resolvedCapacity = capacityInfo || calculateAINationCapacity({
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
            difficulty,
            playerPopulation,
        });

        const carryingCapacity = Math.max(1, resolvedCapacity.carryingCapacity || state.population);
        const capacityUsage = state.population / carryingCapacity;
        const targetPerCapita = getTargetPerCapitaWealth(epoch);
        const positiveResources = Object.values(state.inventory || {}).filter(v => Number(v) > 0).length;
        const employmentRatio = Math.min(0.65, 0.32 + epoch * 0.035 + Math.max(-0.08, (state.developmentRate - 1) * 0.08));
        const productivityFactor = Math.min(1.6, Math.max(0.65, 0.75 + (state.developmentRate - 1) * 0.2 + positiveResources * 0.01));
        const annualOutput = Math.max(
            1,
            Math.round(state.population * targetPerCapita * employmentRatio * productivityFactor * 0.9)
        );
        const treasury = Math.max(0, Math.round(state.budget || 0));
        const householdWealth = Math.max(0, Math.round(state.wealth - treasury));
        const treasuryRatio = treasury / Math.max(1, state.wealth);

        return {
            carryingCapacity,
            capacityUsage,
            annualOutput,
            treasury,
            treasuryRatio,
            householdWealth,
            wealthStock: Math.round(state.wealth),
            wealthPerCapita: state.wealth / Math.max(1, state.population),
            outputPerCapita: annualOutput / Math.max(1, state.population),
        };
    }
}
