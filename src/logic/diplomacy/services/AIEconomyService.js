/**
 * AI Economy Service
 * Unified AI economy update service
 */

import { AIEconomyState } from '../models/AIEconomyState.js';
import { GrowthCalculator } from '../calculators/GrowthCalculator.js';
import { ResourceManager } from '../calculators/ResourceManager.js';
import { getConfig } from '../config/aiEconomyConfig.js';

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
        
        // Update growth
        const shouldGrow = this._shouldUpdateGrowth(state, tick);
        if (shouldGrow) {
            this._updateGrowth(state, {
                tick,
                epoch,
                difficulty,
                playerPopulation,
            });
        }
        
        // Update resources
        this._updateResources(state, {
            tick,
            gameSpeed,
            aggression: nation.aggression,
        });
        
        // Update budget
        state.budget = ResourceManager.updateBudget({
            currentBudget: state.budget,
            wealth: state.wealth,
            gameSpeed,
        });
        
        // Convert back to legacy format
        return {
            ...nation,
            ...state.toLegacyFormat(),
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
        });
        
        // Update state
        state.population = popResult.newPopulation;
        state.basePopulation = popResult.newPopulation;
        state.wealth = wealthResult.newWealth;
        state.baseWealth = wealthResult.newWealth;
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
}
