/**
 * Growth Calculator
 * Responsible for calculating population and wealth growth
 */

import { calculateAILogisticGrowth } from '../../population/logisticGrowth.js';
import { getConfig, getMinimumGrowth, getPerCapitaWealthCap } from '../config/aiEconomyConfig.js';

export class GrowthCalculator {
    /**
     * Calculate population growth
     */
    static calculatePopulationGrowth({
        currentPopulation,
        basePopulation,
        epoch,
        difficulty,
        playerPopulation,
        ticksSinceLastUpdate,
        isAtWar = false,
    }) {
        // Use logistic growth model
        const modelPopulation = calculateAILogisticGrowth({
            nation: { 
                population: currentPopulation,
                economyTraits: { ownBasePopulation: basePopulation },
                epoch,
            },
            epoch,
            difficulty,
            playerPopulation,
            ticksSinceLastUpdate,
        });
        
        // Calculate growth amount
        let growth = modelPopulation - currentPopulation;
        
        // Apply war penalty
        if (isAtWar) {
            const warPenalty = getConfig('growth.warPenalty', 0.3);
            growth = Math.trunc(growth * warPenalty);
        }
        
        // Apply minimum growth guarantee
        if (growth >= 0) {
            const minGrowth = getMinimumGrowth(currentPopulation);
            growth = Math.max(minGrowth, growth);
        } else {
            // Limit decline rate (max -2% per update)
            const maxDecline = Math.max(1, Math.floor(currentPopulation * 0.02));
            growth = Math.max(growth, -maxDecline);
        }
        
        // Calculate new population
        const newPopulation = Math.max(1, currentPopulation + growth);
        
        return {
            newPopulation,
            growth,
            growthRate: growth / Math.max(1, currentPopulation),
        };
    }
    
    /**
     * Calculate wealth growth
     */
    static calculateWealthGrowth({
        currentWealth,
        currentPopulation,
        newPopulation,
        epoch,
        developmentRate,
        ticksSinceLastUpdate,
    }) {
        // Wealth growth tied to population growth
        const popGrowthRate = (newPopulation - currentPopulation) / Math.max(1, currentPopulation);
        
        // Development bonus
        const developmentBonus = (developmentRate - 1) * getConfig('wealth.developmentBonus', 0.005);
        
        // Base growth rate
        const baseGrowthRate = popGrowthRate + developmentBonus;
        
        // Time scaling
        const tickScale = Math.min(ticksSinceLastUpdate / 10, 2.0);
        const rawGrowthRate = baseGrowthRate * tickScale;
        
        // Limit growth rate range
        const maxGrowthRate = getConfig('wealth.maxGrowthRate', 0.03);
        const cappedGrowthRate = Math.max(-0.02, Math.min(maxGrowthRate, rawGrowthRate));
        
        // Apply per capita wealth cap
        const perCapitaCap = getPerCapitaWealthCap(epoch);
        const currentPerCapita = currentWealth / Math.max(1, newPopulation);
        
        let finalGrowthRate = cappedGrowthRate;
        if (currentPerCapita >= perCapitaCap) {
            // At cap, only allow minimal growth
            finalGrowthRate = Math.min(0.005, cappedGrowthRate);
        }
        
        // Calculate new wealth
        const newWealth = Math.round(currentWealth * (1 + finalGrowthRate));
        
        // Hard cap: ensure not exceeding per capita limit
        const maxAllowedWealth = newPopulation * perCapitaCap;
        const finalWealth = Math.min(newWealth, maxAllowedWealth);
        
        return {
            newWealth: Math.max(100, finalWealth),
            growth: finalWealth - currentWealth,
            growthRate: finalGrowthRate,
        };
    }
}
