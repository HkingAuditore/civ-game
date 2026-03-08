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
            verySmall: { threshold: 50, minGrowth: 1 },
            small: { threshold: 100, minGrowth: 1 },
            medium: { threshold: 500, minGrowth: 0 },
            large: { threshold: 1000, minGrowth: 0 },
            veryLarge: { threshold: 5000, minGrowth: 0 },
            huge: { threshold: 10000, minGrowth: 0 },
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
            0: 120,    // Stone Age
            1: 180,    // Bronze Age
            2: 280,    // Classical Age
            3: 420,    // Medieval Age
            4: 640,    // Renaissance Age
            5: 960,    // Industrial Age
            6: 1440,   // Modern Age
        },
        
        // Target per capita wealth (reasonable baseline by epoch)
        targetPerCapita: {
            0: 12,     // Stone Age
            1: 18,     // Bronze Age
            2: 28,     // Classical Age
            3: 42,     // Medieval Age
            4: 64,     // Renaissance Age
            5: 96,     // Industrial Age
            6: 144,    // Modern Age
        },
        
        // Wealth growth rate
        baseGrowthRate: 0.002,  // 0.2% base wealth growth
        developmentBonus: 0.004, // Development should be a mild structural bonus
        maxGrowthRate: 0.012,   // 1.2% max growth rate per update
        
        // Resource abundance bonus
        resourceAbundanceBonus: {
            enabled: true,
            maxBonus: 0.05,       // Resources can slightly help, but should not print money
            optimalRatio: 1.0,    // Optimal inventory/target ratio
        },
        
        // Budget ratio
        budgetRatio: 0.22,
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
