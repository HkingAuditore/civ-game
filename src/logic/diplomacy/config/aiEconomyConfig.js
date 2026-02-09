/**
 * AI Economy Configuration
 * All AI economy related configuration parameters
 */

export const AI_ECONOMY_CONFIG = {
    // === Growth Parameters ===
    growth: {
        // Base growth rate (per 10 ticks)
        baseRate: 0.02,  // 2% growth rate (reasonable for all nations)
        
        // Minimum growth guarantee (used by AIEconomyService)
        minimumGrowth: {
            verySmall: { threshold: 50, minGrowth: 5 },
            small: { threshold: 100, minGrowth: 3 },
            medium: { threshold: 500, minGrowth: 2 },
            large: { threshold: 1000, minGrowth: 5 },
            veryLarge: { threshold: 5000, minGrowth: 10 },
            huge: { threshold: 10000, minGrowth: 20 },
        },
        
        // War penalty
        warPenalty: 0.3,  // Growth rate × 0.3 during war
        
        // Update frequency
        updateInterval: 10,  // Update every 10 ticks
    },
    
    // === Wealth Parameters ===
    wealth: {
        // Per capita wealth caps (by epoch)
        perCapitaCaps: {
            0: 2000,   // Stone Age
            1: 4000,   // Bronze Age
            2: 8000,   // Classical Age
            3: 16000,  // Medieval Age
            4: 32000,  // Renaissance Age
            5: 64000,  // Industrial Age
            6: 128000, // Modern Age
        },
        
        // Target per capita wealth (reasonable baseline by epoch)
        targetPerCapita: {
            0: 0.5,    // Stone Age: 0.5 wealth per capita
            1: 1.0,    // Bronze Age: 1.0 wealth per capita
            2: 2.0,    // Classical Age
            3: 4.0,    // Medieval Age
            4: 8.0,    // Renaissance Age
            5: 16.0,   // Industrial Age
            6: 32.0,   // Modern Age
        },
        
        // Wealth growth rate
        baseGrowthRate: 0.01,   // 1% base wealth growth
        developmentBonus: 0.01, // 1% development bonus
        maxGrowthRate: 0.05,    // 5% max growth rate
        
        // Resource abundance bonus
        resourceAbundanceBonus: {
            enabled: true,
            maxBonus: 0.5,        // Max +50% growth from resources
            optimalRatio: 1.0,    // Optimal inventory/target ratio
        },
        
        // Budget ratio
        budgetRatio: 0.5,
        budgetRecoveryRate: 0.02,
    },
    
    // === Epoch Advancement ===
    epoch: {
        // Epoch upgrade cooldown
        upgradeCooldown: 200,  // ticks
        
        // Epoch requirement multipliers
        requirementMultipliers: {
            1: 100,   // Bronze Age
            2: 150,   // Classical Age
            3: 200,   // Medieval Age
            4: 300,   // Renaissance Age
            5: 400,   // Industrial Age
            6: 600,   // Modern Age
            7: 800,   // Information Age
        },
        
        // Epoch growth factor
        growthFactor: 0.08,  // +8% per epoch
    },
    
    // === Resource System ===
    resources: {
        // Base inventory target
        baseInventoryTarget: 500,
        
        // Base production/consumption rates
        baseProductionRate: 5.0,
        baseConsumptionRate: 5.0,
        
        // War consumption multiplier
        warConsumptionMultiplier: 1.3,
        
        // Inventory range
        minInventoryRatio: 0.2,
        maxInventoryRatio: 3.0,
        
        // Cycle parameters
        cyclePeriodMin: 600,
        cyclePeriodMax: 800,
        trendAmplitude: 0.35,
    },
    
    // === Difficulty Adjustment ===
    difficulty: {
        veryEasy: 0.7,
        easy: 0.85,
        normal: 1.0,
        hard: 1.05,      // [Reduced from 1.15]
        veryHard: 1.1,   // [Reduced from 1.3]
        impossible: 1.2, // [Reduced from 1.5]
    },
    
    // === Soft Caps ===
    softCaps: {
        populationBase: 200,
        populationPlayerRatio: 0.8,
        populationOwnBaseRatio: 10,
        overageReduction: 0.15,
    },
};

/**
 * Get configuration value (supports path access)
 * @param {string} path - Config path, e.g. 'growth.baseRate'
 * @param {*} defaultValue - Default value
 */
export function getConfig(path, defaultValue = null) {
    const keys = path.split('.');
    let value = AI_ECONOMY_CONFIG;
    
    for (const key of keys) {
        if (value && typeof value === 'object' && key in value) {
            value = value[key];
        } else {
            return defaultValue;
        }
    }
    
    return value;
}

/**
 * Get per capita wealth cap
 */
export function getPerCapitaWealthCap(epoch) {
    return getConfig(`wealth.perCapitaCaps.${epoch}`, 50000);
}

/**
 * Get target per capita wealth (reasonable baseline)
 */
export function getTargetPerCapitaWealth(epoch) {
    return getConfig(`wealth.targetPerCapita.${epoch}`, 1.0);
}

/**
 * Get minimum growth value
 */
export function getMinimumGrowth(population) {
    const thresholds = getConfig('growth.minimumGrowth');
    
    // Sort by threshold ascending
    const sorted = Object.entries(thresholds).sort((a, b) => a[1].threshold - b[1].threshold);
    
    for (const [key, config] of sorted) {
        if (population < config.threshold) {
            return config.minGrowth;
        }
    }
    
    return 0;
}
