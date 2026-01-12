/**
 * Price Calculation Module
 * Handles resource cost calculations, price updates, and market price dynamics
 */

import { BUILDINGS, STRATA, RESOURCES, ECONOMIC_INFLUENCE } from '../../config/index.js';
import { PRICE_FLOOR, BASE_WAGE_REFERENCE } from '../utils/constants.js';
import { getBasePrice, isTradableResource } from '../utils/helpers.js';
import { buildLivingCostMap } from './wages.js';
import { getBuildingEffectiveConfig } from '../../config/buildingUpgrades.js';
import { getOutputBuildingsForResource } from './resourceBuildingIndex.js';

/**
 * Calculate resource cost based on production chain
 * @param {string} resourceKey - Resource key to calculate cost for
 * @param {Array} buildingsConfig - Buildings configuration
 * @param {Object} currentPrices - Current market prices
 * @param {Object} currentWages - Current wages by role
 * @param {Object} priceLivingCosts - Living costs for price calculation
 * @param {Object} wageLivingCosts - Living costs for wage calculation
 * @returns {number} Calculated resource cost
 */
export const calculateResourceCost = (
    resourceKey,
    buildingsConfig = BUILDINGS,
    currentPrices = {},
    currentWages = {},
    priceLivingCosts = {},
    wageLivingCosts = {}
) => {
    const resolvePrice = (key) => {
        const current = currentPrices?.[key];
        if (Number.isFinite(current) && current > 0) {
            return Math.max(PRICE_FLOOR, current);
        }
        const base = RESOURCES[key]?.basePrice;
        if (Number.isFinite(base) && base > 0) {
            return Math.max(PRICE_FLOOR, base);
        }
        return PRICE_FLOOR;
    };

    const resolveWage = (role) => {
        const wage = currentWages?.[role];
        if (Number.isFinite(wage) && wage > 0) {
            return wage;
        }
        return BASE_WAGE_REFERENCE;
    };

    const basePrice = getBasePrice(resourceKey);

    // Find primary building that produces this resource
    let primaryBuilding = null;
    buildingsConfig.forEach(building => {
        const outputAmount = building.output?.[resourceKey];
        if (!outputAmount || outputAmount <= 0) return;
        if (!primaryBuilding) {
            primaryBuilding = building;
            return;
        }
        const bestOutput = primaryBuilding.output?.[resourceKey] || 0;
        if (outputAmount > bestOutput) {
            primaryBuilding = building;
        }
    });

    if (primaryBuilding) {
        const totalOutput = primaryBuilding.output?.[resourceKey] || 0;
        if (totalOutput > 0) {
            let inputCost = 0;
            if (primaryBuilding.input) {
                Object.entries(primaryBuilding.input).forEach(([inputKey, amount]) => {
                    if (!amount || amount <= 0) return;
                    inputCost += amount * resolvePrice(inputKey);
                });
            }

            let laborCost = 0;
            const isSelfOwned = primaryBuilding.owner && primaryBuilding.jobs && 
                              primaryBuilding.jobs[primaryBuilding.owner];

            if (primaryBuilding.jobs && !isSelfOwned) {
                Object.entries(primaryBuilding.jobs).forEach(([role, slots]) => {
                    if (!slots || slots <= 0) return;
                    laborCost += slots * resolveWage(role);
                });
            }

            const unitCost = (inputCost + laborCost) / totalOutput;
            if (Number.isFinite(unitCost) && unitCost > 0) {
                return Math.max(PRICE_FLOOR, Math.max(unitCost, basePrice));
            }
        }
    }

    // Fallback: use base price for raw materials
    return basePrice;
};

/**
 * Update market prices based on supply, demand, and inventory
 * @param {Object} params - Update parameters
 * @returns {Object} Updated prices
 */
export const updateMarketPrices = ({
    resources,
    supply,
    demand,
    priceMap,
    builds,
    popStructure,
    updatedWages,
    livingCostBreakdown,
    population,
    getResourceTaxRate,
    epoch,
    techsUnlocked,
    buildingUpgrades = {}
}) => {
    const updatedPrices = { ...priceMap };
    const demandPopulation = Math.max(0, population || 0);

    // Get default market parameters
    const defaultMarketInfluence = ECONOMIC_INFLUENCE?.market || {};
    const defaultSupplyDemandWeight = Math.max(0, defaultMarketInfluence.supplyDemandWeight ?? 1);
    const defaultVirtualDemandPerPop = Math.max(0, defaultMarketInfluence.virtualDemandPerPop || 0);
    const defaultInventoryTargetDays = Math.max(0.1, defaultMarketInfluence.inventoryTargetDays ?? 1.5);
    const defaultInventoryPriceImpact = Math.max(0, defaultMarketInfluence.inventoryPriceImpact ?? 0.25);

    Object.keys(RESOURCES).forEach(resource => {
        if (!isTradableResource(resource)) return;

        const resourceDef = RESOURCES[resource];
        const resourceMarketConfig = resourceDef?.marketConfig || {};

        // Get resource-specific economic parameters
        const virtualDemandPerPop = resourceMarketConfig.virtualDemandPerPop !== undefined
            ? Math.max(0, resourceMarketConfig.virtualDemandPerPop)
            : defaultVirtualDemandPerPop;
        const inventoryTargetDays = resourceMarketConfig.inventoryTargetDays !== undefined
            ? Math.max(0.1, resourceMarketConfig.inventoryTargetDays)
            : defaultInventoryTargetDays;
        const inventoryPriceImpact = resourceMarketConfig.inventoryPriceImpact !== undefined
            ? Math.max(0, resourceMarketConfig.inventoryPriceImpact)
            : defaultInventoryPriceImpact;

        const sup = supply[resource] || 0;
        const dem = demand[resource] || 0;
        const virtualDemandBaseline = virtualDemandPerPop * demandPopulation;
        const adjustedDemand = dem + virtualDemandBaseline;

        // Calculate inventory days
        const dailyDemand = adjustedDemand;
        const inventoryStock = resources[resource] || 0;
        const inventoryDays = dailyDemand > 0 ? inventoryStock / dailyDemand : inventoryTargetDays;

        // Collect building prices - using indexed lookup for O(1) access
        const buildingPrices = [];
        let totalOutput = 0;

        // [PERF] Use pre-built index instead of iterating all buildings
        const outputBuildings = getOutputBuildingsForResource(resource);
        outputBuildings.forEach(({ building, outputAmount }) => {

            const buildingCount = builds[building.id] || 0;
            if (buildingCount <= 0) return;

            // Calculate building cost
            const buildingMarketConfig = building.marketConfig || {};
            const buildingPriceWeights = buildingMarketConfig.price || ECONOMIC_INFLUENCE?.price || {};
            const buildingWageWeights = buildingMarketConfig.wage || ECONOMIC_INFLUENCE?.wage || {};

            const resourceSpecificPriceLivingCosts = buildLivingCostMap(
                livingCostBreakdown,
                buildingPriceWeights
            );
            const resourceSpecificWageLivingCosts = buildLivingCostMap(
                livingCostBreakdown,
                buildingWageWeights
            );

            // Calculate input costs
            let inputCost = 0;
            if (building.input) {
                Object.entries(building.input).forEach(([inputKey, amount]) => {
                    if (!amount || amount <= 0) return;
                    const inputPrice = priceMap[inputKey] || getBasePrice(inputKey);
                    const inputTaxRate = getResourceTaxRate(inputKey);
                    const baseCost = amount * inputPrice;
                    const taxCost = baseCost * inputTaxRate;
                    inputCost += baseCost + taxCost;
                });
            }

            // Calculate labor cost
            let laborCost = 0;
            const isSelfOwned = building.owner && building.jobs && building.jobs[building.owner];
            if (building.jobs && !isSelfOwned) {
                Object.entries(building.jobs).forEach(([role, slots]) => {
                    if (!slots || slots <= 0) return;
                    const wage = updatedWages[role] || 0;
                    laborCost += slots * wage;
                });
            }

            // Calculate cost price
            const costPrice = outputAmount > 0 ? (inputCost + laborCost) / outputAmount : 0;

            // Add to building prices
            const buildingOutput = outputAmount * buildingCount;
            buildingPrices.push({
                buildingId: building.id,
                costPrice,
                output: buildingOutput,
                laborCost,
                inputCost
            });
            totalOutput += buildingOutput;
        });

        // Calculate weighted average price
        if (buildingPrices.length > 0 && totalOutput > 0) {
            let weightedCost = 0;
            buildingPrices.forEach(bp => {
                weightedCost += bp.costPrice * (bp.output / totalOutput);
            });

            const basePrice = getBasePrice(resource);
            const inventoryRatio = inventoryDays / inventoryTargetDays;
            
            // Price adjustment based on inventory
            let priceMultiplier = 1.0;
            if (inventoryRatio < 0.5) {
                // Low inventory - price increases
                priceMultiplier = 1 + (0.5 - inventoryRatio) * inventoryPriceImpact * 2;
            } else if (inventoryRatio > 2.0) {
                // High inventory - price decreases
                priceMultiplier = 1 - Math.min(0.5, (inventoryRatio - 2.0) * inventoryPriceImpact * 0.5);
            }

            // Final price = max(cost * margin, base price) * inventory adjustment
            const minPrice = Math.max(weightedCost * 1.1, basePrice);
            const targetPrice = minPrice * priceMultiplier;

            // Smooth price transition
            const currentPrice = priceMap[resource] || basePrice;
            const smoothing = 0.1;
            updatedPrices[resource] = parseFloat(
                (currentPrice + (targetPrice - currentPrice) * smoothing).toFixed(2)
            );
        }
    });

    return updatedPrices;
};
