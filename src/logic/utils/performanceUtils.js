/**
 * Performance Utilities Module
 * 
 * Provides rate limiting, caching, and tick frequency control utilities
 * for optimizing expensive calculations in the game simulation.
 */

// ============================================================================
// RATE LIMITING UTILITIES
// ============================================================================

/**
 * Configuration for rate-limited calculations
 * These determine how often expensive operations are performed
 */
export const RATE_LIMIT_CONFIG = {
    // Price calculations: every N ticks
    priceUpdateFrequency: 3,
    
    // AI decision making: every N ticks
    aiDecisionFrequency: 5,
    
    // Trade calculations: every N ticks
    tradeUpdateFrequency: 3,
    
    // Diplomatic relation updates: every N ticks
    diplomacyUpdateFrequency: 5,
    
    // Building upgrade distribution cache validation: every N ticks
    buildingCacheValidation: 10,
};

/**
 * Check if a rate-limited operation should run this tick
 * @param {number} tick - Current tick number
 * @param {string} operationType - Type of operation (key in RATE_LIMIT_CONFIG)
 * @param {boolean} forceRun - Override to force execution
 * @returns {boolean} Whether the operation should run
 */
export function shouldRunThisTick(tick, operationType, forceRun = false) {
    if (forceRun) return true;
    
    const frequency = RATE_LIMIT_CONFIG[`${operationType}Frequency`] || 
                      RATE_LIMIT_CONFIG[operationType] || 1;
    
    return tick % frequency === 0;
}

// ============================================================================
// TICK-LEVEL CACHE UTILITIES
// ============================================================================

/**
 * Simple tick-scoped cache for expensive calculations
 * Cache is automatically invalidated each tick
 */
class TickCache {
    constructor() {
        this.cache = new Map();
        this.lastTick = -1;
    }
    
    /**
     * Get cached value or compute and cache it
     * @param {number} tick - Current tick
     * @param {string} key - Cache key
     * @param {Function} computeFn - Function to compute value if not cached
     * @returns {*} Cached or computed value
     */
    getOrCompute(tick, key, computeFn) {
        // Invalidate cache on new tick
        if (tick !== this.lastTick) {
            this.cache.clear();
            this.lastTick = tick;
        }
        
        if (this.cache.has(key)) {
            return this.cache.get(key);
        }
        
        const value = computeFn();
        this.cache.set(key, value);
        return value;
    }
    
    /**
     * Get cached value without computing
     * @param {number} tick - Current tick
     * @param {string} key - Cache key
     * @returns {*|undefined} Cached value or undefined
     */
    get(tick, key) {
        if (tick !== this.lastTick) {
            this.cache.clear();
            this.lastTick = tick;
            return undefined;
        }
        return this.cache.get(key);
    }
    
    /**
     * Set cached value
     * @param {number} tick - Current tick
     * @param {string} key - Cache key
     * @param {*} value - Value to cache
     */
    set(tick, key, value) {
        if (tick !== this.lastTick) {
            this.cache.clear();
            this.lastTick = tick;
        }
        this.cache.set(key, value);
    }
    
    /**
     * Clear all cached values
     */
    clear() {
        this.cache.clear();
        this.lastTick = -1;
    }
}

// Singleton instance for simulation-wide use
export const tickCache = new TickCache();

// ============================================================================
// BUILDING LEVEL DISTRIBUTION CACHE
// ============================================================================

/**
 * Cache for building upgrade level distributions
 * Avoids recalculating level counts multiple times per tick
 */
const buildingLevelCache = new Map();
let buildingCacheLastTick = -1;

/**
 * Get or compute building level distribution
 * @param {number} tick - Current tick
 * @param {string} buildingId - Building ID
 * @param {Object} buildingUpgrades - Building upgrades state
 * @param {number} buildingCount - Total building count
 * @returns {{ levelCounts: Object, fullLevelCounts: Object, upgradedCount: number }}
 */
export function getBuildingLevelDistribution(tick, buildingId, buildingUpgrades, buildingCount) {
    // Invalidate on new tick
    if (tick !== buildingCacheLastTick) {
        buildingLevelCache.clear();
        buildingCacheLastTick = tick;
    }
    
    const cacheKey = `${buildingId}:${buildingCount}`;
    
    if (buildingLevelCache.has(cacheKey)) {
        return buildingLevelCache.get(cacheKey);
    }
    
    // Compute level distribution
    const storedLevelCounts = buildingUpgrades[buildingId] || {};
    let upgradedCount = 0;
    
    Object.entries(storedLevelCounts).forEach(([lvlStr, lvlCount]) => {
        const lvl = parseInt(lvlStr);
        if (Number.isFinite(lvl) && lvl > 0 && lvlCount > 0) {
            upgradedCount += lvlCount;
        }
    });
    
    const level0Count = Math.max(0, buildingCount - upgradedCount);
    
    const fullLevelCounts = { 0: level0Count };
    Object.entries(storedLevelCounts).forEach(([lvlStr, lvlCount]) => {
        const lvl = parseInt(lvlStr);
        if (Number.isFinite(lvl) && lvl > 0 && lvlCount > 0) {
            fullLevelCounts[lvl] = lvlCount;
        }
    });
    
    const result = {
        levelCounts: storedLevelCounts,
        fullLevelCounts,
        upgradedCount,
        level0Count,
        hasUpgrades: upgradedCount > 0
    };
    
    buildingLevelCache.set(cacheKey, result);
    return result;
}

/**
 * Clear building level cache
 */
export function clearBuildingLevelCache() {
    buildingLevelCache.clear();
    buildingCacheLastTick = -1;
}

// ============================================================================
// DIRTY FLAG TRACKING
// ============================================================================

/**
 * Tracks which game state aspects have changed
 * Used to skip expensive recalculations when data hasn't changed
 */
const dirtyFlags = {
    buildings: true,
    population: true,
    resources: true,
    prices: true,
    wages: true,
};

/**
 * Mark a state aspect as dirty (changed)
 * @param {string} aspect - State aspect name
 */
export function markDirty(aspect) {
    if (aspect in dirtyFlags) {
        dirtyFlags[aspect] = true;
    }
}

/**
 * Check if a state aspect is dirty
 * @param {string} aspect - State aspect name
 * @returns {boolean}
 */
export function isDirty(aspect) {
    return dirtyFlags[aspect] === true;
}

/**
 * Clear dirty flag for a state aspect
 * @param {string} aspect - State aspect name
 */
export function clearDirty(aspect) {
    if (aspect in dirtyFlags) {
        dirtyFlags[aspect] = false;
    }
}

/**
 * Reset all dirty flags to true (for initialization)
 */
export function resetAllDirty() {
    Object.keys(dirtyFlags).forEach(key => {
        dirtyFlags[key] = true;
    });
}
