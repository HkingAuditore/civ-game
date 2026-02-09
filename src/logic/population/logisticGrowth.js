/**
 * Logistic Population Growth Model
 * 
 * Implements a scientifically accurate population growth model based on:
 * 1. Logistic growth curve (S-curve)
 * 2. Resource carrying capacity (food, land, housing)
 * 3. Diminishing returns as population approaches limits
 * 
 * Formula: dP/dt = r * P * (1 - P/K) * ResourceFactor
 * 
 * Where:
 * - P: Current population
 * - K: Carrying capacity (determined by resources)
 * - r: Intrinsic growth rate
 * - ResourceFactor: Multiplier based on resource availability
 */

import { 
    GROWTH_RATES, 
    DIFFICULTY_GROWTH_MULTIPLIERS,
    getIntrinsicGrowthRate 
} from './growthConfig.js';

/**
 * Calculate carrying capacity based on available resources
 * @param {Object} params - Resource parameters
 * @returns {number} Maximum sustainable population
 */
export const calculateCarryingCapacity = ({
    foodProduction = 0,
    foodStorage = 0,
    landArea = 100,
    housingCapacity = 100,
    epoch = 0,
    technology = {}
}) => {
    // 1. Food-based capacity (most critical)
    // Assume each person needs 0.5 food per tick on average
    const FOOD_PER_CAPITA = 0.5;
    const foodBasedCapacity = (foodProduction + foodStorage * 0.1) / FOOD_PER_CAPITA;
    
    // 2. Land-based capacity
    // Population density increases with technology and era
    const baseDensity = 10; // people per land unit in ancient times
    const densityMultiplier = 1 + epoch * 0.5 + (technology.urbanization || 0) * 2;
    const landBasedCapacity = landArea * baseDensity * densityMultiplier;
    
    // 3. Housing capacity (hard limit)
    const housingBasedCapacity = housingCapacity;
    
    // 4. Technology multipliers
    const agricultureBonus = 1 + (technology.agriculture || 0) * 0.5;
    const medicineBonus = 1 + (technology.medicine || 0) * 0.3;
    const infrastructureBonus = 1 + (technology.infrastructure || 0) * 0.2;
    
    const techMultiplier = agricultureBonus * medicineBonus * infrastructureBonus;
    
    // Final carrying capacity is the minimum of all constraints, with tech bonus
    const baseCapacity = Math.min(
        foodBasedCapacity * 1.2, // Allow 20% buffer for food
        landBasedCapacity,
        housingBasedCapacity * 1.5 // Allow some overcrowding
    );
    
    return Math.max(10, Math.floor(baseCapacity * techMultiplier));
};

/**
 * Calculate resource availability factor
 * @param {Object} params - Resource parameters
 * @returns {number} Factor between 0 and 2
 */
export const calculateResourceFactor = ({
    currentPopulation,
    foodAvailable = 0,
    foodNeeded = 0,
    wealthPerCapita = 0,
    approval = 50,
    isAtWar = false
}) => {
    // 1. Food factor (most important)
    const foodRatio = foodNeeded > 0 ? foodAvailable / foodNeeded : 1;
    let foodFactor;
    if (foodRatio >= 1.5) {
        // Abundant food: bonus growth
        foodFactor = 1.3;
    } else if (foodRatio >= 1.0) {
        // Sufficient food: normal growth
        foodFactor = 1.0 + (foodRatio - 1.0) * 0.6;
    } else if (foodRatio >= 0.7) {
        // Food shortage: reduced growth
        foodFactor = 0.5 + foodRatio * 0.5;
    } else {
        // Severe shortage: negative growth
        foodFactor = Math.max(0.2, foodRatio);
    }
    
    // 2. Wealth factor
    const WEALTH_BASELINE = 10; // baseline wealth per capita
    const wealthRatio = Math.min(3, wealthPerCapita / WEALTH_BASELINE);
    const wealthFactor = 0.7 + wealthRatio * 0.3; // 0.7 to 1.6
    
    // 3. Approval factor
    const approvalFactor = Math.max(0.5, Math.min(1.5, approval / 50));
    
    // 4. War penalty
    const warFactor = isAtWar ? 0.7 : 1.0;
    
    // Combined factor
    return foodFactor * wealthFactor * approvalFactor * warFactor;
};

/**
 * Calculate logistic population growth
 * @param {Object} params - Growth parameters
 * @returns {Object} Growth results
 */
export const calculateLogisticGrowth = ({
    currentPopulation,
    carryingCapacity,
    intrinsicGrowthRate = GROWTH_RATES.OLD_LOGISTIC, // Use config: 3% base growth rate (kept for backward compatibility)
    resourceFactor = 1.0,
    difficulty = 'normal',
    isAI = false
}) => {
    // Prevent division by zero
    if (carryingCapacity <= 0) {
        return {
            newPopulation: Math.max(1, Math.floor(currentPopulation * 0.95)),
            growthRate: -0.05,
            capacityRatio: 0,
            isOverCapacity: true
        };
    }
    
    // Calculate capacity ratio
    const capacityRatio = currentPopulation / carryingCapacity;
    
    // Logistic growth factor: (1 - P/K)
    // This creates the S-curve: fast growth when P << K, slow when P → K
    const logisticFactor = Math.max(0, 1 - capacityRatio);
    
    // Overcapacity penalty (if population exceeds carrying capacity)
    let overcapacityPenalty = 1.0;
    if (capacityRatio > 1.0) {
        // Exponential penalty for exceeding capacity
        // At 110% capacity: 0.9x growth
        // At 120% capacity: 0.7x growth
        // At 150% capacity: 0.3x growth
        overcapacityPenalty = Math.exp(-(capacityRatio - 1) * 2);
    }
    
    // Difficulty adjustment for AI
    let difficultyMultiplier = 1.0;
    if (isAI) {
        const difficultyMap = {
            'veryEasy': 0.8,
            'easy': 1.0,
            'normal': 1.2,
            'hard': 1.5,
            'veryHard': 1.8,
            'extreme': 2.0
        };
        difficultyMultiplier = difficultyMap[difficulty] || 1.0;
    }
    
    // Final growth rate
    const effectiveGrowthRate = intrinsicGrowthRate 
        * logisticFactor 
        * resourceFactor 
        * overcapacityPenalty
        * difficultyMultiplier;
    
    // Calculate population change
    const populationChange = currentPopulation * effectiveGrowthRate;
    
    // Apply change with some randomness
    const randomFactor = 0.9 + Math.random() * 0.2; // 0.9 to 1.1
    const newPopulation = Math.max(
        1, 
        Math.floor(currentPopulation + populationChange * randomFactor)
    );
    
    return {
        newPopulation,
        growthRate: effectiveGrowthRate,
        capacityRatio,
        isOverCapacity: capacityRatio > 1.0,
        logisticFactor,
        resourceFactor,
        overcapacityPenalty,
        populationChange: newPopulation - currentPopulation
    };
};

/**
 * Calculate AI nation population growth with logistic model
 * 
 * AI nations have resource inventory tracking (food, wood, stone, etc.)
 * We can use these to calculate carrying capacity and resource constraints
 * 
 * @param {Object} params - AI growth parameters
 * @returns {number} New population
 */
export const calculateAILogisticGrowth = ({
    nation,
    epoch,
    difficulty,
    playerPopulation = 100,
    ticksSinceLastUpdate = 10
}) => {
    const currentPopulation = nation.population || 16;
    const ownBasePopulation = nation.economyTraits?.ownBasePopulation || 16;
    const isAtWar = nation.isAtWar || false;
    const developmentRate = nation.economyTraits?.developmentRate || 1.0;
    const wealth = nation.wealth || 1000;
    const inventory = nation.inventory || {};
    
    // === CARRYING CAPACITY CALCULATION ===
    // 
    // KEY DESIGN: AI population limit is based on PLAYER population × 50
    // This ensures AI scales with player development, creating fair challenge
    //
    
    // 1. Primary cap: Player population × 50 (the main reference)
    // IMPORTANT: Set a reasonable minimum based on EPOCH to avoid early game stagnation
    // - Stone Age (0): minimum 500 (small tribes can still grow)
    // - Classical (1): minimum 2,000
    // - Medieval (2): minimum 10,000
    // - Industrial (3): minimum 50,000
    // - Modern (4+): minimum 200,000
    const epochMinimumCap = [500, 2000, 10000, 50000, 200000][Math.min(epoch, 4)];
    const playerBasedCap = Math.max(epochMinimumCap, playerPopulation * 50);
    
    // 2. Development modifier (0.5x - 1.5x based on AI's own development)
    // Stronger AI nations can get closer to the cap
    const developmentModifier = 0.5 + developmentRate * 0.5; // 0.5 at rate 0, 1.0 at rate 1, 1.5 at rate 2
    
    // 3. Epoch modifier (AI benefits from technological progress)
    // Each epoch allows slightly higher population density
    const epochModifier = 1 + epoch * 0.1; // +10% per epoch
    
    // 4. Resource availability modifier (based on food stock)
    const foodStock = inventory.food || 0;
    const foodBias = nation.economyTraits?.resourceBias?.food || 1.0;
    // Food modifier: 0.6x (starving) to 1.2x (abundant)
    const estimatedFoodNeeded = currentPopulation * 10; // rough estimate
    const foodRatio = Math.min(2, (foodStock + 100) / Math.max(1, estimatedFoodNeeded));
    const foodModifier = 0.6 + foodRatio * 0.3; // 0.6 to 1.2
    
    // 5. Nation power modifier (from foreignPower settings)
    const populationFactor = nation.foreignPower?.populationFactor || 1.0;
    
    // 6. Difficulty modifier for carrying capacity
    // Higher difficulty = AI can sustain larger populations
    const difficultyCapMap = {
        'veryEasy': 0.5,   // AI cap is 50% of player×50
        'easy': 0.7,       // AI cap is 70% of player×50
        'normal': 1.0,     // AI cap is 100% of player×50
        'hard': 1.3,       // AI cap is 130% of player×50
        'veryHard': 1.6,   // AI cap is 160% of player×50
        'extreme': 2.0     // AI cap is 200% of player×50
    };
    const difficultyCapMultiplier = difficultyCapMap[difficulty] || 1.0;
    
    // === FINAL CARRYING CAPACITY ===
    // Base = player pop × 50, then modified by all factors
    const carryingCapacity = Math.floor(
        playerBasedCap 
        * developmentModifier 
        * epochModifier 
        * foodModifier 
        * populationFactor
        * difficultyCapMultiplier
    );
    
    // Ensure minimum carrying capacity (based on epoch)
    // This prevents early game stagnation
    // [FIX v2] Increased minimums significantly for early eras to prevent stagnation
    // Old saves often have very small populations that get stuck because capacity was too low
    const epochMinimumFinal = [1000, 5000, 20000, 100000, 500000][Math.min(epoch, 4)];
    
    // [FIX v3] REMOVED populationBasedMinimum - it created infinite growth loop!
    // Old logic: capacity = max(epoch_min, current_pop * 10, calculated_cap)
    // Problem: As population grows, capacity grows with it (current_pop * 10)
    // Result: Population NEVER reaches capacity limit, grows infinitely!
    // Solution: Only use epoch minimum and calculated capacity
    const finalCarryingCapacity = Math.max(epochMinimumFinal, carryingCapacity);
    
    // === RESOURCE FACTOR CALCULATION ===
    // Simplified: since carrying capacity already considers resources,
    // this factor only applies minor adjustments
    
    let resourceFactor = 1.0;
    
    // 1. Wealth per capita bonus/penalty
    const wealthPerCapita = wealth / Math.max(1, currentPopulation);
    if (wealthPerCapita < 20) {
        resourceFactor *= 0.8; // Poor economy: -20%
    } else if (wealthPerCapita > 200) {
        resourceFactor *= 1.2; // Rich economy: +20%
    }
    
    // 2. Development factor
    resourceFactor *= (0.9 + developmentRate * 0.1); // 0.9x to 1.1x
    
    // 3. War penalty
    if (isAtWar) {
        resourceFactor *= 0.7; // -30% during war
    }
    
    // 4. Resource diversity bonus
    const resourceCount = Object.keys(inventory).filter(k => inventory[k] > 0).length;
    if (resourceCount > 10) {
        resourceFactor *= 1.1; // +10% for diverse economy
    }
    
    // === LOGISTIC GROWTH CALCULATION ===
    
    // Growth rate: aim for reaching ~50% of capacity in ~1 year (365 ticks)
    // Growth every 10 ticks = ~36 cycles per year
    // Use a moderate 2% per cycle base rate
    const tickScale = Math.min(ticksSinceLastUpdate / 10, 2.0);
    const intrinsicGrowthRate = getIntrinsicGrowthRate('ai', tickScale); // Use centralized config
    
    // Calculate capacity ratio using FINAL carrying capacity
    const capacityRatio = currentPopulation / Math.max(1, finalCarryingCapacity);
    
    // Logistic growth factor (S-curve)
    // Allow negative values when over capacity to enable population decline.
    const logisticFactor = 1 - capacityRatio;
    
    // Overcapacity penalty (exponential decay)
    let overcapacityPenalty = 1.0;
    if (capacityRatio > 1.0) {
        overcapacityPenalty = Math.exp(-(capacityRatio - 1) * 3);
    }
    
    // Difficulty multiplier for GROWTH RATE (not capacity, that's handled above)
    // Use centralized config
    const difficultyGrowthMultiplier = DIFFICULTY_GROWTH_MULTIPLIERS[difficulty] || 1.0;
    
    // [FIX v4] SMALL NATION GROWTH ACCELERATION
    // Problem: Small nations (< 10000 pop) grow too slowly because:
    // 1. They have very low absolute population (e.g., 75)
    // 2. Even with high growth rate (5%), absolute growth is tiny (75 × 0.05 = 3.75)
    // 3. Large nations benefit from compound growth, small nations don't
    // Solution: Apply a MASSIVE growth multiplier for small nations
    // This multiplier decreases as population grows, ensuring smooth transition
    let smallNationBonus = 1.0;
    if (currentPopulation < 100) {
        smallNationBonus = 5.0;   // 5x growth for tiny nations (< 100) [Reduced from 20x]
    } else if (currentPopulation < 500) {
        smallNationBonus = 3.0;   // 3x growth for very small nations (100-500) [Reduced from 10x]
    } else if (currentPopulation < 2000) {
        smallNationBonus = 2.0;   // 2x growth for small nations (500-2000) [Reduced from 5x]
    } else if (currentPopulation < 5000) {
        smallNationBonus = 1.5;   // 1.5x growth for medium-small nations (2000-5000) [Reduced from 3x]
    } else if (currentPopulation < 10000) {
        smallNationBonus = 1.2;   // 1.2x growth for medium nations (5000-10000) [Reduced from 2x]
    }
    // Nations >= 10000: no bonus (1.0x)
    
    // Final growth rate
    const effectiveGrowthRate = intrinsicGrowthRate 
        * logisticFactor 
        * resourceFactor 
        * overcapacityPenalty
        * difficultyGrowthMultiplier
        * smallNationBonus;  // NEW: Small nation acceleration
    
    // Calculate population change
    const populationChange = currentPopulation * effectiveGrowthRate;
    
    // Apply change with some randomness
    const randomFactor = 0.9 + Math.random() * 0.2; // 0.9 to 1.1
    let rawChange = populationChange * randomFactor;
    
    // [SIMPLIFIED] Minimum growth is now handled ONLY in processAIIndependentGrowth
    // and GrowthCalculator to avoid double-stacking.
    // Here we only do basic probabilistic rounding for fractional growth.
    const isUnderCapacity = currentPopulation < finalCarryingCapacity * 0.95;
    
    if (isUnderCapacity && rawChange < 1 && rawChange > 0) {
        // Probabilistic rounding: 0.3 has 30% chance to become 1
        rawChange = Math.random() < rawChange ? 1 : 0;
    }
    
    const newPopulation = Math.max(1, Math.floor(currentPopulation + rawChange));
    
    return newPopulation;
};

/**
 * Calculate player nation population growth with logistic model
 * @param {Object} params - Player growth parameters
 * @returns {Object} Detailed growth results
 */
export const calculatePlayerLogisticGrowth = ({
    currentPopulation,
    resources = {},
    buildings = {},
    epoch = 0,
    bonuses = {},
    approval = 50,
    isAtWar = false,
    difficulty = 'normal'
}) => {
    // Calculate actual food production from buildings
    const foodProduction = resources.food || 0;
    const foodStorage = resources.foodStorage || 0;
    
    // Calculate land area from buildings
    const landArea = Object.values(buildings).reduce((sum, building) => {
        return sum + (building.landArea || 1) * (building.count || 0);
    }, 100); // Base 100 land
    
    // Calculate housing capacity
    const housingCapacity = resources.maxPop || 100;
    
    // Extract technology bonuses
    const technology = {
        agriculture: bonuses.foodProductionBonus || 0,
        medicine: bonuses.healthBonus || 0,
        infrastructure: bonuses.infrastructureBonus || 0,
        urbanization: bonuses.urbanizationBonus || 0
    };
    
    // Calculate carrying capacity
    const carryingCapacity = calculateCarryingCapacity({
        foodProduction,
        foodStorage,
        landArea,
        housingCapacity,
        epoch,
        technology
    });
    
    // Calculate resource factor
    const foodNeeded = currentPopulation * 0.5;
    const wealthPerCapita = (resources.silver || 0) / Math.max(1, currentPopulation);
    const resourceFactor = calculateResourceFactor({
        currentPopulation,
        foodAvailable: foodProduction,
        foodNeeded,
        wealthPerCapita,
        approval,
        isAtWar
    });
    
    // Base growth rate with bonuses
    const baseGrowthRate = GROWTH_RATES.PLAYER_BASE / 10; // 0.002 per tick (0.2% per tick, 2% per 10 ticks)
    const growthBonus = bonuses.populationGrowthBonus || 0;
    const intrinsicGrowthRate = baseGrowthRate * (1 + growthBonus);
    
    // Calculate growth
    return calculateLogisticGrowth({
        currentPopulation,
        carryingCapacity,
        intrinsicGrowthRate,
        resourceFactor,
        difficulty,
        isAI: false
    });
};
