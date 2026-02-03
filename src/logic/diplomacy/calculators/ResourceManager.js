/**
 * Resource Manager
 * Responsible for managing AI nation resource inventory and prices
 */

import { RESOURCES } from '../../../config/index.js';
import { isTradableResource } from '../../utils/helpers.js';
import { getConfig } from '../config/aiEconomyConfig.js';

export class ResourceManager {
    /**
     * Update resource inventory
     */
    static updateInventory({
        inventory,
        resourceBias,
        epoch,
        wealth,
        isAtWar,
        tick,
        gameSpeed,
        aggression = 0.2,
    }) {
        const updatedInventory = { ...inventory };
        const foreignResourceKeys = Object.keys(RESOURCES).filter(isTradableResource);
        
        // Epoch multiplier
        const epochMultiplier = 1 + epoch * 0.5 + Math.pow(epoch, 1.3) * 0.1;
        
        // Wealth factor
        const wealthFactor = Math.max(0.8, Math.min(2.0, wealth / 1000));
        
        // War consumption multiplier
        const warMultiplier = isAtWar 
            ? (getConfig('resources.warConsumptionMultiplier', 1.3) + aggression * 0.5)
            : 1.0;
        
        foreignResourceKeys.forEach((resourceKey) => {
            const bias = resourceBias[resourceKey] ?? 1;
            const currentStock = updatedInventory[resourceKey] || 0;
            
            // Calculate target inventory
            const baseTarget = getConfig('resources.baseInventoryTarget', 500);
            const targetInventory = Math.round(
                baseTarget * Math.pow(bias, 1.2) * epochMultiplier * wealthFactor
            );
            
            // Calculate production and consumption
            const { production, consumption } = this._calculateProductionConsumption({
                resourceKey,
                bias,
                currentStock,
                targetInventory,
                epoch,
                wealthFactor,
                warMultiplier,
                tick,
                gameSpeed,
            });
            
            // Update inventory
            const netChange = production - consumption;
            const minInventory = targetInventory * getConfig('resources.minInventoryRatio', 0.2);
            const maxInventory = targetInventory * getConfig('resources.maxInventoryRatio', 3.0);
            const nextStock = currentStock + netChange;
            
            updatedInventory[resourceKey] = Math.max(minInventory, Math.min(maxInventory, nextStock));
        });
        
        return updatedInventory;
    }
    
    /**
     * Calculate production and consumption (private method)
     */
    static _calculateProductionConsumption({
        resourceKey,
        bias,
        currentStock,
        targetInventory,
        epoch,
        wealthFactor,
        warMultiplier,
        tick,
        gameSpeed,
    }) {
        const baseProduction = getConfig('resources.baseProductionRate', 5.0);
        const baseConsumption = getConfig('resources.baseConsumptionRate', 5.0);
        
        const epochMultiplier = 1 + epoch * 0.5 + Math.pow(epoch, 1.3) * 0.1;
        
        // Long cycle trend
        const resourceOffset = resourceKey.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
        const cyclePeriodMin = getConfig('resources.cyclePeriodMin', 600);
        const cyclePeriodMax = getConfig('resources.cyclePeriodMax', 800);
        const cyclePeriod = cyclePeriodMin + (resourceOffset % (cyclePeriodMax - cyclePeriodMin));
        const cyclePhase = Math.sin((tick * 2 * Math.PI) / cyclePeriod + resourceOffset * 0.1);
        
        const trendAmplitude = getConfig('resources.trendAmplitude', 0.35) + Math.abs(bias - 1) * 0.45;
        
        // Specialty resources: high production, low consumption
        // Scarce resources: low production, high consumption
        const productionTrend = bias > 1
            ? 1 + Math.max(0, cyclePhase) * trendAmplitude + 0.2
            : 1 - Math.max(0, cyclePhase) * trendAmplitude * 0.4;
        const consumptionTrend = bias < 1
            ? 1 + Math.max(0, cyclePhase) * trendAmplitude + 0.15
            : 1 - Math.max(0, cyclePhase) * trendAmplitude * 0.25;
        
        // Base rates
        const productionRate = baseProduction * epochMultiplier * wealthFactor * Math.pow(bias, 1.2) * productionTrend * gameSpeed;
        const consumptionRate = baseConsumption * epochMultiplier * wealthFactor * Math.pow(1 / bias, 0.8) * consumptionTrend * warMultiplier * gameSpeed;
        
        // Inventory adjustment
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
        
        // Correction and random shock
        const correction = (targetInventory - currentStock) * 0.01 * gameSpeed;
        const randomShock = (Math.random() - 0.5) * targetInventory * 0.1 * gameSpeed;
        
        const finalProduction = productionRate * productionAdjustment + correction + randomShock;
        const finalConsumption = consumptionRate * consumptionAdjustment;
        
        return {
            production: finalProduction,
            consumption: finalConsumption,
        };
    }
    
    /**
     * Update budget
     */
    static updateBudget({ currentBudget, wealth, gameSpeed = 1.0 }) {
        const targetBudget = wealth * getConfig('wealth.budgetRatio', 0.5);
        const recoveryRate = getConfig('wealth.budgetRecoveryRate', 0.02);
        const budgetDiff = targetBudget - currentBudget;
        
        return Math.max(0, currentBudget + budgetDiff * recoveryRate * gameSpeed);
    }
}
