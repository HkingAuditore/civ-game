/**
 * Wage and Living Cost Calculations
 * Handles wage estimation, living cost computation, and related economic calculations
 */

import { STRATA, RESOURCES, ECONOMIC_INFLUENCE } from '../../config';
import { PRICE_FLOOR, BASE_WAGE_REFERENCE } from '../utils/constants';
import { getBasePrice } from '../utils/helpers';

/**
 * Compute living costs breakdown for all strata
 * @param {Object} priceMap - Current market prices
 * @param {Object} headTaxRates - Head tax rates per stratum
 * @param {Object} resourceTaxRates - Resource tax rates
 * @returns {Object} Living cost breakdown by stratum
 */
export const computeLivingCosts = (
    priceMap = {},
    headTaxRates = {},
    resourceTaxRates = {}
) => {
    const breakdown = {};
    Object.entries(STRATA).forEach(([key, def]) => {
        let needsCost = 0;
        let taxCost = 0;
        const needs = def.needs || {};
        Object.entries(needs).forEach(([resKey, perCapita]) => {
            if (!perCapita || perCapita <= 0) return;
            const price =
                priceMap?.[resKey] ??
                RESOURCES[resKey]?.basePrice ??
                getBasePrice(resKey);
            if (!Number.isFinite(price) || price <= 0) return;
            const taxRate = Math.max(0, resourceTaxRates?.[resKey] || 0);
            needsCost += perCapita * price;
            taxCost += perCapita * price * taxRate;
        });
        const headBase = Math.max(0, def.headTaxBase ?? 0);
        const headRate = Math.max(0, headTaxRates?.[key] ?? 1);
        taxCost += headBase * headRate;
        breakdown[key] = {
            needsCost: Number.isFinite(needsCost) ? needsCost : 0,
            taxCost: Number.isFinite(taxCost) ? taxCost : 0,
        };
    });
    return breakdown;
};

/**
 * Build living cost map with weights
 * @param {Object} breakdown - Living cost breakdown from computeLivingCosts
 * @param {Object} weights - Weight configuration {livingCostWeight, taxCostWeight}
 * @returns {Object} Living cost map by stratum
 */
export const buildLivingCostMap = (breakdown = {}, weights = {}) => {
    const livingWeight = Number.isFinite(weights.livingCostWeight)
        ? weights.livingCostWeight
        : 1;
    const taxWeight = Number.isFinite(weights.taxCostWeight)
        ? weights.taxCostWeight
        : 1;
    const map = {};
    Object.entries(breakdown).forEach(([key, value]) => {
        const needs = value?.needsCost || 0;
        const tax = value?.taxCost || 0;
        map[key] = Math.max(0, needs * livingWeight + tax * taxWeight);
    });
    return map;
};

/**
 * Get living cost floor for a role
 * @param {string} role - Role key
 * @param {Object} wageLivingCosts - Pre-computed wage living costs
 * @returns {number} Minimum living cost floor
 */
export const getLivingCostFloor = (role, wageLivingCosts = {}) => {
    const base = wageLivingCosts?.[role];
    if (!Number.isFinite(base) || base <= 0) {
        return BASE_WAGE_REFERENCE * 0.8;
    }
    return Math.max(BASE_WAGE_REFERENCE * 0.8, base * 1.1);
};

/**
 * Get expected wage for a role
 * @param {string} role - Role key
 * @param {Object} previousWages - Previous tick's wages
 * @param {number} defaultWageEstimate - Default wage estimate
 * @param {Object} wageLivingCosts - Pre-computed wage living costs
 * @returns {number} Expected wage for the role
 */
export const getExpectedWage = (role, previousWages = {}, defaultWageEstimate = 1, wageLivingCosts = {}) => {
    const prev = previousWages?.[role];
    if (Number.isFinite(prev) && prev > 0) {
        return Math.max(PRICE_FLOOR, prev);
    }
    const starting = STRATA[role]?.startingWealth;
    const livingCostFloor = getLivingCostFloor(role, wageLivingCosts);
    if (Number.isFinite(starting) && starting > 0) {
        return Math.max(BASE_WAGE_REFERENCE * 0.5, starting / 40, livingCostFloor);
    }
    return Math.max(defaultWageEstimate, livingCostFloor);
};

/**
 * Calculate weighted average wage based on population weights
 * @param {Object} popStructure - Population structure by role
 * @param {Object} previousWages - Previous tick's wages
 * @returns {number} Weighted average wage
 */
export const calculateWeightedAverageWage = (popStructure = {}, previousWages = {}) => {
    let totalWeightedWage = 0;
    let totalPopulation = 0;

    Object.keys(popStructure).forEach(role => {
        const popCount = popStructure[role] || 0;
        const wageValue = previousWages[role] || 0;

        if (popCount > 0 && wageValue > 0) {
            totalWeightedWage += wageValue * popCount;
            totalPopulation += popCount;
        }
    });

    return totalPopulation > 0
        ? totalWeightedWage / totalPopulation
        : BASE_WAGE_REFERENCE;
};

/**
 * Update wages based on income and expenses
 * @param {Object} roleWageStats - Wage statistics by role
 * @param {Object} popStructure - Population structure
 * @param {Object} roleWagePayout - Wage payouts by role
 * @param {Object} roleExpense - Expenses by role
 * @param {Object} previousWages - Previous tick's wages
 * @param {number} wageSmoothing - Smoothing factor (0-1)
 * @returns {Object} Updated wages by role
 */
export const updateWages = (
    roleWageStats = {},
    popStructure = {},
    roleWagePayout = {},
    roleExpense = {},
    previousWages = {},
    wageSmoothing = 0.35
) => {
    const updatedWages = {};

    Object.entries(roleWageStats).forEach(([role, data]) => {
        let currentSignal = 0;
        const pop = popStructure[role] || 0;

        if (pop > 0) {
            const income = roleWagePayout[role] || 0;
            const expense = roleExpense[role] || 0;
            currentSignal = (income - expense) / pop;
        } else {
            if (data.weightedWage > 0 && data.totalSlots > 0) {
                currentSignal = data.weightedWage / data.totalSlots;
            } else {
                currentSignal = previousWages[role] || 0;
            }
        }

        currentSignal = Math.max(0, currentSignal);

        const prev = previousWages[role] || 0;
        const smoothed = prev + (currentSignal - prev) * wageSmoothing;

        updatedWages[role] = parseFloat(smoothed.toFixed(2));
    });

    return updatedWages;
};
