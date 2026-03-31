/**
 * Simulation Helper Functions
 * Contains utility functions used across the simulation system
 */

import { RESOURCES, TECHS } from '../../config/index.js';
import { PRICE_FLOOR, ROLE_PRIORITY, SPECIAL_TRADE_RESOURCES } from './constants.js';

/**
 * Clamp a value between min and max
 * @param {number} value - Value to clamp
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @returns {number} Clamped value
 */
export const clamp = (value, min, max) => {
    if (!Number.isFinite(value)) return min;
    if (value < min) return min;
    if (value > max) return max;
    return value;
};

/**
 * Maximum safe wealth value — 仅过滤 NaN / Infinity，不限制正常数值增长。
 * Number.MAX_VALUE ≈ 1.8e308，是 JS 双精度浮点能表示的最大有限值。
 */
export const MAX_SAFE_WEALTH = Number.MAX_VALUE;

/**
 * 确保财富值在安全范围内（仅过滤 NaN / Infinity / 负数）
 * @param {number} value - Wealth value to sanitize
 * @param {number} defaultValue - Default value if invalid (default: 0)
 * @returns {number} Safe wealth value, >= 0
 */
export const safeWealth = (value, defaultValue = 0) => {
    if (!Number.isFinite(value)) return defaultValue;
    return Math.max(0, Math.min(value, MAX_SAFE_WEALTH));
};

/**
 * Check if a resource is tradable
 * @param {string} key - Resource key
 * @returns {boolean} Whether the resource is tradable
 */
export const isTradableResource = (key) => {
    if (key === 'silver') return false;
    const def = RESOURCES[key];
    if (!def) return false;
    if (SPECIAL_TRADE_RESOURCES.has(key)) return true;
    return !def.type || def.type !== 'virtual';
};

/**
 * Check if a resource can be traded with foreign/manual routes.
 * @param {string} key - Resource key
 * @returns {boolean} Whether foreign trade is allowed
 */
export const canForeignTradeResource = (key) => {
    if (!isTradableResource(key)) return false;
    const def = RESOURCES[key];
    return def?.allowForeignTrade !== false;
};

/**
 * Get base price for a resource
 * @param {string} resource - Resource key
 * @returns {number} Base price
 */
export const getBasePrice = (resource) => {
    if (resource === 'silver') return 1;
    const def = RESOURCES[resource];
    return def?.basePrice || 1;
};

/**
 * Scale effect values by a multiplier
 * Used for buff/debuff scaling based on influence
 * @param {Object} effect - Effect object to scale
 * @param {number} multiplier - Multiplier to apply
 * @returns {Object} Scaled effect object
 */
export const scaleEffectValues = (effect = {}, multiplier = 1) => {
    if (!effect || typeof effect !== 'object') return {};
    const scaled = {};
    Object.entries(effect).forEach(([key, value]) => {
        if (typeof value === 'number') {
            scaled[key] = value * multiplier;
        } else if (value && typeof value === 'object' && !Array.isArray(value)) {
            scaled[key] = scaleEffectValues(value, multiplier);
        } else {
            scaled[key] = value;
        }
    });
    return scaled;
};

/**
 * Smooth price pressure with bounded sigmoid curve
 * Avoids runaway inflation/deflation
 * @param {number} ratio - Supply/demand ratio
 * @param {number} supplyDemandWeight - Weight for supply/demand influence
 * @returns {number} Price multiplier
 */
export const computePriceMultiplier = (ratio, supplyDemandWeight = 1) => {
    if (!Number.isFinite(ratio) || ratio <= 0) {
        return 0.7;
    }
    const minMultiplier = 0.7;
    const maxMultiplier = 3.5;
    const safeRatio = Math.max(ratio, 0.01);
    const smoothness = 0.9;
    let pressure = Math.tanh(Math.log(safeRatio) * smoothness);
    pressure *= supplyDemandWeight;
    pressure = Math.max(-1, Math.min(1, pressure));
    if (pressure >= 0) {
        return 1 + pressure * (maxMultiplier - 1);
    }
    return 1 + pressure * (1 - minMultiplier);
};

/**
 * Calculate minimum profit margin based on cost and inventory
 * @param {number} costPrice - Cost price
 * @param {number} basePrice - Base market price
 * @returns {number} Minimum profit margin
 */
export const calculateMinProfitMargin = (costPrice, basePrice) => {
    const costToBasePriceRatio = costPrice / basePrice;

    if (costToBasePriceRatio < 0.3) {
        // Low cost resources (like food)
        return Math.min(5.0, (basePrice / costPrice) - 1) * 0.8;
    } else if (costToBasePriceRatio < 0.6) {
        // Medium cost resources
        return 0.5 + (0.6 - costToBasePriceRatio) * 1.5;
    } else if (costToBasePriceRatio < 0.9) {
        // Higher cost resources
        return 0.2 + (0.9 - costToBasePriceRatio) * 1.0;
    } else {
        // Cost near or above base price
        return 0.1 + Math.max(0, 1.0 - costToBasePriceRatio) * 1.0;
    }
};
