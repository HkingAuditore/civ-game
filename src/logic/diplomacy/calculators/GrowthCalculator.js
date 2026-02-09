/**
 * Growth Calculator
 * Responsible for calculating population and wealth growth
 */

import { calculateAILogisticGrowth } from '../../population/logisticGrowth.js';
import { getConfig, getMinimumGrowth, getPerCapitaWealthCap, getTargetPerCapitaWealth } from '../config/aiEconomyConfig.js';

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
     * Comprehensive model considering population, epoch, resources, and development
     */
    static calculateWealthGrowth({
        currentWealth,
        currentPopulation,
        newPopulation,
        epoch,
        developmentRate,
        ticksSinceLastUpdate,
        inventory = null,  // Resource inventory (optional)
        resourceBias = null,  // Resource bias (optional)
    }) {
        // === STEP 1: Calculate Target Wealth (Based on Population & Epoch) ===
        const targetPerCapita = getTargetPerCapitaWealth(epoch);
        const targetWealth = newPopulation * targetPerCapita;
        const currentPerCapita = currentWealth / Math.max(1, newPopulation);
        
        // === STEP 2: Calculate Resource Abundance Factor ===
        let resourceAbundanceFactor = 1.0;
        if (inventory && resourceBias && getConfig('wealth.resourceAbundanceBonus.enabled', true)) {
            // Calculate average inventory ratio across all resources
            const baseTarget = getConfig('resources.baseInventoryTarget', 500);
            const epochMultiplier = 1 + epoch * getConfig('epoch.growthFactor', 0.08);
            const wealthFactor = Math.sqrt(currentWealth / 1000);
            
            let totalRatio = 0;
            let resourceCount = 0;
            
            for (const [resource, amount] of Object.entries(inventory)) {
                if (amount > 0) {
                    const bias = resourceBias[resource] || 1.0;
                    const targetInventory = baseTarget * Math.pow(bias, 1.2) * epochMultiplier * wealthFactor;
                    const ratio = amount / Math.max(1, targetInventory);
                    totalRatio += ratio;
                    resourceCount++;
                }
            }
            
            if (resourceCount > 0) {
                const avgRatio = totalRatio / resourceCount;
                const optimalRatio = getConfig('wealth.resourceAbundanceBonus.optimalRatio', 1.0);
                const maxBonus = getConfig('wealth.resourceAbundanceBonus.maxBonus', 0.5);
                
                // Bonus peaks at optimal ratio, decreases if too low or too high
                if (avgRatio < optimalRatio) {
                    // Below optimal: linear bonus from 0 to maxBonus
                    resourceAbundanceFactor = 1.0 + (avgRatio / optimalRatio) * maxBonus;
                } else {
                    // Above optimal: diminishing returns
                    const excess = avgRatio - optimalRatio;
                    resourceAbundanceFactor = 1.0 + maxBonus * Math.exp(-excess * 0.5);
                }
            }
        }
        
        // === STEP 3: Calculate Base Growth Components ===
        // 3.1 Population growth contribution
        const popGrowthRate = (newPopulation - currentPopulation) / Math.max(1, currentPopulation);
        
        // 3.2 Independent wealth growth (economy can grow beyond population)
        const baseWealthGrowthRate = getConfig('wealth.baseGrowthRate', 0.01);
        
        // 3.3 Development bonus
        const developmentBonus = (developmentRate - 1) * getConfig('wealth.developmentBonus', 0.01);
        
        // 3.4 Epoch technology bonus
        const epochBonus = epoch * getConfig('epoch.growthFactor', 0.08);
        
        // === STEP 4: Calculate Catch-Up Mechanism ===
        // Nations below target wealth should grow faster to catch up
        let catchUpFactor = 1.0;
        if (currentWealth < targetWealth) {
            const wealthGap = targetWealth - currentWealth;
            const gapRatio = wealthGap / Math.max(1, targetWealth);
            // Moderate catch-up for larger gaps (up to 2x for very poor nations) [Reduced from 5x]
            catchUpFactor = 1.0 + Math.min(1.0, gapRatio * 2.0);
        } else if (currentPerCapita > targetPerCapita * 2) {
            // Slow down if wealth is way above target
            catchUpFactor = 0.5;
        }
        
        // === STEP 5: Combine All Factors ===
        const baseGrowthRate = (
            popGrowthRate + 
            baseWealthGrowthRate + 
            developmentBonus + 
            epochBonus
        ) * resourceAbundanceFactor * catchUpFactor;
        
        // === STEP 6: Apply Time Scaling ===
        const tickScale = Math.min(ticksSinceLastUpdate / 10, 2.0);
        let rawGrowthRate = baseGrowthRate * tickScale;
        
        // === STEP 7: Apply Growth Rate Limits ===
        const maxGrowthRate = getConfig('wealth.maxGrowthRate', 0.05);
        // Allow slightly higher growth for nations catching up [Reduced from 3x to 1.5x]
        const effectiveMaxGrowth = catchUpFactor > 1.5 ? maxGrowthRate * 1.5 : maxGrowthRate;
        const cappedGrowthRate = Math.max(-0.02, Math.min(effectiveMaxGrowth, rawGrowthRate));
        
        // === STEP 8: Apply Per Capita Wealth Cap ===
        const perCapitaCap = getPerCapitaWealthCap(epoch);
        let finalGrowthRate = cappedGrowthRate;
        
        if (currentPerCapita >= perCapitaCap) {
            // At cap, only allow minimal growth
            finalGrowthRate = Math.min(0.005, cappedGrowthRate);
        }
        
        // === STEP 9: Calculate New Wealth ===
        let newWealth = Math.round(currentWealth * (1 + finalGrowthRate));
        
        // === STEP 10: Apply Minimum Growth Guarantee ===
        const wealthGrowth = newWealth - currentWealth;
        if (wealthGrowth >= 0 && wealthGrowth < 5) {
            // Minimum +5 wealth growth to ensure visibility
            newWealth = currentWealth + 5;
        }
        
        // === STEP 11: Hard Cap at Per Capita Limit ===
        const maxAllowedWealth = newPopulation * perCapitaCap;
        const finalWealth = Math.min(newWealth, maxAllowedWealth);
        
        // === DEBUG LOGGING ===
        const shouldLog = (
            currentWealth < 10000 || 
            currentPerCapita < targetPerCapita * 0.5 ||
            catchUpFactor > 2.0
        );
        
        if (shouldLog) {
            console.log(`[Wealth Growth] pop=${newPopulation.toFixed(0)}, wealth ${currentWealth}→${finalWealth}, ` +
                `perCapita=${currentPerCapita.toFixed(2)} (target=${targetPerCapita.toFixed(2)}), ` +
                `epoch=${epoch}, catchUp=${catchUpFactor.toFixed(2)}x, ` +
                `resource=${resourceAbundanceFactor.toFixed(2)}x, ` +
                `rate=${(finalGrowthRate*100).toFixed(1)}%`);
        }
        
        return {
            newWealth: Math.max(100, finalWealth),
            growth: finalWealth - currentWealth,
            growthRate: finalGrowthRate,
        };
    }
}
