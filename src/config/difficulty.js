/**
 * Game Difficulty Configuration
 * Defines difficulty levels and their associated modifiers
 */

// Difficulty level identifiers
export const DIFFICULTY_LEVELS = {
    VERY_EASY: 'very_easy',
    EASY: 'easy',
    NORMAL: 'normal',
    HARD: 'hard',
    VERY_HARD: 'very_hard',
    EXTREME: 'extreme',
};

// Default difficulty
export const DEFAULT_DIFFICULTY = DIFFICULTY_LEVELS.EASY;

// Difficulty settings configuration
export const DIFFICULTY_CONFIG = {
    [DIFFICULTY_LEVELS.VERY_EASY]: {
        id: DIFFICULTY_LEVELS.VERY_EASY,
        name: '和平',
        description: '极其轻松，专注于建设，几乎没有战争威胁',
        icon: '🕊️',
        // Organization/Rebellion modifiers
        organizationGrowthMultiplier: 0.2,     // 20% organization growth rate
        organizationDecayMultiplier: 2.0,      // 200% decay rate (very fast calming)
        satisfactionThreshold: 25,             // Very lower threshold
        buildingCostGrowthFactor: 1.05,        // Very cheap scaling (8%)
        // AI War modifiers
        aiWarDeclarationChance: 0.1,           // 10% of normal war declaration chance
        aiMilitaryActionChance: 0.2,           // 20% of normal military action chance
        aiMilitaryCooldownBonus: 30,           // Huge extra days added to AI cooldown
        aiMinWarEpoch: 4,                      // AI can only declare war from Renaissance (epoch 4)
        // Raid modifiers
        raidDamageMultiplier: 0.3,             // 30% raid damage
        raidPopulationLossMultiplier: 0.2,     // 20% population loss from raids
        // Peace/Stability bonuses
        stabilityDampeningBonus: 0.25,         // Massive stability dampening effect
        newGameGracePeriod: 150,               // Long grace period
        // Economic modifiers
        inventoryTargetDaysMultiplier: 0.5,    // 50% inventory target (easy to satisfy, stable economy)
        // [NEW] Configurable Parameters
        taxToleranceMultiplier: 2.0,           // 200% tax tolerance (citizens tolerate higher taxes)
        resourceConsumptionMultiplier: 0.9,    // 80% consumption
        buildingCostBaseMultiplier: 1.0,       // 80% building cost
        techCostMultiplier: 1.0,               // 80% tech cost
        populationGrowthMultiplier: 1.5,       // 150% growth rate
        buildingUpgradeCostMultiplier: 1.0,    // 80% upgrade cost
        armyMaintenanceMultiplier: 0.5,        // 50% army maintenance
    },
    [DIFFICULTY_LEVELS.EASY]: {
        id: DIFFICULTY_LEVELS.EASY,
        name: '简单',
        description: '适合新手，叛乱增长减半，敌人攻击概率降低',
        icon: '🌱',
        // Organization/Rebellion modifiers
        organizationGrowthMultiplier: 0.5,    // 50% organization growth rate
        organizationDecayMultiplier: 1.5,      // 150% decay rate (faster calming)
        satisfactionThreshold: 35,             // Lower threshold before unrest starts (was 45)
        buildingCostGrowthFactor: 1.10,        // Slightly cheaper scaling (12%)
        // AI War modifiers
        aiWarDeclarationChance: 0.5,           // 50% of normal war declaration chance
        aiMilitaryActionChance: 0.5,           // 50% of normal military action chance
        aiMilitaryCooldownBonus: 15,           // Extra days added to AI cooldown
        aiMinWarEpoch: 3,                      // AI can only declare war from Medieval era (epoch 3)
        // Raid modifiers
        raidDamageMultiplier: 0.6,             // 60% raid damage
        raidPopulationLossMultiplier: 0.5,     // 50% population loss from raids
        // Peace/Stability bonuses
        stabilityDampeningBonus: 0.15,         // Extra stability dampening effect
        newGameGracePeriod: 100,               // Days of reduced threats at game start
        // Economic modifiers
        inventoryTargetDaysMultiplier: 0.7,    // 70% inventory target (slightly forgiving)
        // [NEW] Configurable Parameters
        taxToleranceMultiplier: 1.5,           // 150% tax tolerance
        resourceConsumptionMultiplier: 1.0,    // 90% consumption
        buildingCostBaseMultiplier: 1.2,       // 90% building cost
        techCostMultiplier: 1.2,               // 90% tech cost
        populationGrowthMultiplier: 1.2,       // 120% growth rate
        buildingUpgradeCostMultiplier: 1.2,    // 90% upgrade cost
        armyMaintenanceMultiplier: 0.75,       // 75% army maintenance
    },
    [DIFFICULTY_LEVELS.NORMAL]: {
        id: DIFFICULTY_LEVELS.NORMAL,
        name: '普通',
        description: '标准游戏体验',
        icon: '⚖️',
        // Organization/Rebellion modifiers
        organizationGrowthMultiplier: 1.0,     // 100% organization growth rate
        organizationDecayMultiplier: 1.0,      // 100% decay rate
        satisfactionThreshold: 45,             // Standard threshold
        buildingCostGrowthFactor: 1.15,        // Standard scaling (15%)
        // AI War modifiers
        aiWarDeclarationChance: 1.0,           // 100% normal war declaration chance
        aiMilitaryActionChance: 1.0,           // 100% normal military action chance
        aiMilitaryCooldownBonus: 0,            // No bonus
        aiMinWarEpoch: 2,                      // AI can declare war from Iron Age (epoch 2)
        // Raid modifiers
        raidDamageMultiplier: 1.0,             // 100% raid damage
        raidPopulationLossMultiplier: 1.0,     // 100% population loss
        // Peace/Stability bonuses
        stabilityDampeningBonus: 0,            // No bonus
        newGameGracePeriod: 0,                 // No grace period
        // Economic modifiers
        inventoryTargetDaysMultiplier: 1.0,    // Standard inventory target
        // [NEW] Configurable Parameters
        taxToleranceMultiplier: 1.0,           // Standard tax tolerance
        resourceConsumptionMultiplier: 1.0,    // Standard consumption
        buildingCostBaseMultiplier: 1.5,       // Standard building cost
        techCostMultiplier: 1.5,               // Standard tech cost
        populationGrowthMultiplier: 1.0,       // Standard growth rate
        buildingUpgradeCostMultiplier: 1.5,    // Standard upgrade cost
        armyMaintenanceMultiplier: 1.0,        // Standard army maintenance
    },
    [DIFFICULTY_LEVELS.HARD]: {
        id: DIFFICULTY_LEVELS.HARD,
        name: '困难',
        description: '高难度挑战，叛乱更频繁，敌人更具侵略性',
        icon: '🔥',
        // Organization/Rebellion modifiers
        organizationGrowthMultiplier: 1.5,     // 150% organization growth rate
        organizationDecayMultiplier: 0.5,      // 50% decay rate (slower calming)
        satisfactionThreshold: 60,             // Higher threshold - unrest starts earlier
        buildingCostGrowthFactor: 1.25,        // Steeper scaling (25%)
        // AI War modifiers
        aiWarDeclarationChance: 2.0,           // 200% war declaration chance
        aiMilitaryActionChance: 1.5,           // 150% military action chance
        aiMilitaryCooldownBonus: -5,           // Reduced cooldown (more frequent attacks)
        aiMinWarEpoch: 1,                      // AI can declare war from Bronze Age (epoch 1)
        // Raid modifiers
        raidDamageMultiplier: 1.5,             // 150% raid damage
        raidPopulationLossMultiplier: 1.5,     // 150% population loss
        // Peace/Stability bonuses
        stabilityDampeningBonus: -0.1,         // Reduced stability effect
        newGameGracePeriod: 0,                 // No grace period
        // Economic modifiers
        inventoryTargetDaysMultiplier: 3.0,    // 300% inventory target (harder to maintain stable prices)
        // [NEW] Configurable Parameters
        taxToleranceMultiplier: 0.7,           // 70% tax tolerance (citizens hate taxes more)
        resourceConsumptionMultiplier: 3.0,    // 300% consumption
        buildingCostBaseMultiplier: 3.0,       // 300% building cost
        techCostMultiplier: 3.0,               // 300% tech cost
        populationGrowthMultiplier: 0.8,       // 80% growth rate
        buildingUpgradeCostMultiplier: 3.0,    // 300% upgrade cost
        armyMaintenanceMultiplier: 1.5,       // 150% army maintenance
    },
    [DIFFICULTY_LEVELS.VERY_HARD]: {
        id: DIFFICULTY_LEVELS.VERY_HARD,
        name: '灾厄',
        description: '极高难度，内忧外患接踵而至，生存即是胜利',
        icon: '☠️',
        // Organization/Rebellion modifiers
        organizationGrowthMultiplier: 2.0,     // 200% organization growth rate
        organizationDecayMultiplier: 0.2,      // 20% decay rate
        satisfactionThreshold: 75,             // Very high threshold
        buildingCostGrowthFactor: 1.30,        // Very steep scaling (30%)
        // AI War modifiers
        aiWarDeclarationChance: 3.5,           // 350% war declaration chance
        aiMilitaryActionChance: 2.5,           // 250% military action chance
        aiMilitaryCooldownBonus: -10,          // Very reduced cooldown
        aiMinWarEpoch: 0,                      // AI can declare war from start
        // Raid modifiers
        raidDamageMultiplier: 2.5,             // 250% raid damage
        raidPopulationLossMultiplier: 2.5,     // 250% population loss
        // Peace/Stability bonuses
        stabilityDampeningBonus: -0.2,         // Negative stability effect
        newGameGracePeriod: 0,                 // No grace period
        // Economic modifiers
        inventoryTargetDaysMultiplier: 8.0,    // 800% inventory target (requires heavy stockpiling)
        // [NEW] Configurable Parameters
        taxToleranceMultiplier: 0.4,           // 40% tax tolerance
        resourceConsumptionMultiplier: 5.0,   // 500% consumption
        buildingCostBaseMultiplier: 5.0,      // 500% building cost
        techCostMultiplier: 6.0,              // 600% tech cost
        populationGrowthMultiplier: 0.5,       // 50% growth rate
        buildingUpgradeCostMultiplier: 5.0,   // 500% upgrade cost
        armyMaintenanceMultiplier: 2.0,        // 200% army maintenance
    },
    [DIFFICULTY_LEVELS.EXTREME]: {
        id: DIFFICULTY_LEVELS.EXTREME,
        name: '地狱',
        description: '绝望的深渊，只有最完美的策略才能存活',
        icon: '👿',
        // Organization/Rebellion modifiers
        organizationGrowthMultiplier: 3.0,     // 300% organization growth rate
        organizationDecayMultiplier: 0.05,     // 5% decay rate
        satisfactionThreshold: 80,             // Extreme threshold
        buildingCostGrowthFactor: 1.40,        // Extreme scaling (40%)
        // AI War modifiers
        aiWarDeclarationChance: 5.0,           // 500% war declaration chance
        aiMilitaryActionChance: 5.0,           // 500% military action chance
        aiMilitaryCooldownBonus: -20,          // Very fast cooldown
        aiMinWarEpoch: 0,                      // AI can declare war from start
        // Raid modifiers
        raidDamageMultiplier: 5.0,             // 500% raid damage
        raidPopulationLossMultiplier: 5.0,     // 500% population loss
        // Peace/Stability bonuses
        stabilityDampeningBonus: -0.5,         // Severe negative stability effect
        newGameGracePeriod: 0,                 // No grace period
        // Economic modifiers
        inventoryTargetDaysMultiplier: 20.0,   // 2000% inventory target (extreme stockpiling required)
        // [NEW] Configurable Parameters
        taxToleranceMultiplier: 0.2,           // 20% tax tolerance
        resourceConsumptionMultiplier: 8.0,    // 800% consumption
        buildingCostBaseMultiplier: 10.0,      // 1000% building cost
        techCostMultiplier: 10.0,              // 1000% tech cost
        populationGrowthMultiplier: 0.2,       // 20% growth rate
        buildingUpgradeCostMultiplier: 10.0,   // 1000% upgrade cost
        armyMaintenanceMultiplier: 3.0,        // 300% army maintenance
    },
};

/**
 * Get difficulty configuration by level
 * @param {string} level - Difficulty level identifier
 * @returns {Object} Difficulty configuration object
 */
export function getDifficultyConfig(level) {
    return DIFFICULTY_CONFIG[level] || DIFFICULTY_CONFIG[DEFAULT_DIFFICULTY];
}

/**
 * Get all difficulty options for UI
 * @returns {Array} Array of difficulty options with id, name, description, icon
 */
export function getDifficultyOptions() {
    return Object.values(DIFFICULTY_CONFIG).map(config => ({
        id: config.id,
        name: config.name,
        description: config.description,
        icon: config.icon,
    }));
}

/**
 * Apply difficulty modifier to organization growth rate
 * @param {number} baseRate - Base organization growth rate
 * @param {string} difficultyLevel - Current difficulty level
 * @returns {number} Modified growth rate
 */
export function applyOrganizationGrowthModifier(baseRate, difficultyLevel) {
    const config = getDifficultyConfig(difficultyLevel);
    if (baseRate > 0) {
        return baseRate * config.organizationGrowthMultiplier;
    } else {
        // Decay rate - apply inverse modifier
        return baseRate * config.organizationDecayMultiplier;
    }
}

/**
 * Get satisfaction threshold for organization growth based on difficulty
 * @param {string} difficultyLevel - Current difficulty level
 * @returns {number} Satisfaction threshold
 */
export function getSatisfactionThreshold(difficultyLevel) {
    const config = getDifficultyConfig(difficultyLevel);
    return config.satisfactionThreshold;
}

/**
 * Apply difficulty modifier to AI war declaration chance
 * @param {number} baseChance - Base war declaration chance
 * @param {string} difficultyLevel - Current difficulty level
 * @returns {number} Modified war declaration chance
 */
export function applyWarDeclarationModifier(baseChance, difficultyLevel) {
    const config = getDifficultyConfig(difficultyLevel);
    return baseChance * config.aiWarDeclarationChance;
}

/**
 * Apply difficulty modifier to AI military action chance
 * @param {number} baseChance - Base military action chance
 * @param {string} difficultyLevel - Current difficulty level
 * @returns {number} Modified military action chance
 */
export function applyMilitaryActionModifier(baseChance, difficultyLevel) {
    const config = getDifficultyConfig(difficultyLevel);
    return baseChance * config.aiMilitaryActionChance;
}

/**
 * Get minimum epoch for AI war declaration based on difficulty
 * @param {string} difficultyLevel - Current difficulty level
 * @returns {number} Minimum epoch for war
 */
export function getMinWarEpoch(difficultyLevel) {
    const config = getDifficultyConfig(difficultyLevel);
    return config.aiMinWarEpoch;
}

/**
 * Get AI military cooldown bonus based on difficulty
 * @param {string} difficultyLevel - Current difficulty level
 * @returns {number} Cooldown bonus days
 */
export function getMilitaryCooldownBonus(difficultyLevel) {
    const config = getDifficultyConfig(difficultyLevel);
    return config.aiMilitaryCooldownBonus;
}

/**
 * Apply difficulty modifier to raid damage
 * @param {number} baseDamage - Base damage value
 * @param {string} difficultyLevel - Current difficulty level
 * @returns {number} Modified damage value
 */
export function applyRaidDamageModifier(baseDamage, difficultyLevel) {
    const config = getDifficultyConfig(difficultyLevel);
    return Math.floor(baseDamage * config.raidDamageMultiplier);
}

/**
 * Apply difficulty modifier to population loss
 * @param {number} baseLoss - Base population loss
 * @param {string} difficultyLevel - Current difficulty level
 * @returns {number} Modified population loss
 */
export function applyPopulationLossModifier(baseLoss, difficultyLevel) {
    const config = getDifficultyConfig(difficultyLevel);
    return Math.floor(baseLoss * config.raidPopulationLossMultiplier);
}

/**
 * Get stability dampening bonus based on difficulty
 * @param {string} difficultyLevel - Current difficulty level
 * @returns {number} Stability dampening bonus
 */
export function getStabilityDampeningBonus(difficultyLevel) {
    const config = getDifficultyConfig(difficultyLevel);
    return config.stabilityDampeningBonus;
}

/**
 * Check if we're in the grace period for new games
 * @param {number} currentDay - Current game day
 * @param {string} difficultyLevel - Current difficulty level
 * @returns {boolean} Whether we're in the grace period
 */
export function isInGracePeriod(currentDay, difficultyLevel) {
    const config = getDifficultyConfig(difficultyLevel);
    return currentDay < config.newGameGracePeriod;
}

/**
 * Get building cost growth factor based on difficulty
 * @param {string} difficultyLevel - Current difficulty level
 * @returns {number} Growth factor (e.g. 1.15)
 */
export function getBuildingCostGrowthFactor(difficultyLevel) {
    const config = getDifficultyConfig(difficultyLevel);
    // Fallback to 1.15 if not defined
    return config.buildingCostGrowthFactor || 1.15;
}

/**
 * Get inventory target days multiplier based on difficulty
 * Higher values = more stable economy (easier difficulties)
 * Lower values = more volatile economy (harder difficulties)
 * @param {string} difficultyLevel - Current difficulty level
 * @returns {number} Multiplier for inventory target days
 */
export function getInventoryTargetDaysMultiplier(difficultyLevel) {
    const config = getDifficultyConfig(difficultyLevel);
    // Fallback to 1.0 if not defined
    return config.inventoryTargetDaysMultiplier || 1.0;
}

export default {
    DIFFICULTY_LEVELS,
    DEFAULT_DIFFICULTY,
    DIFFICULTY_CONFIG,
    getDifficultyConfig,
    getDifficultyOptions,
    applyOrganizationGrowthModifier,
    getSatisfactionThreshold,
    applyWarDeclarationModifier,
    applyMilitaryActionModifier,
    getMinWarEpoch,
    getMilitaryCooldownBonus,
    applyRaidDamageModifier,
    applyPopulationLossModifier,
    getStabilityDampeningBonus,
    getStabilityDampeningBonus,
    isInGracePeriod,
    getBuildingCostGrowthFactor,
    getInventoryTargetDaysMultiplier,
    // [NEW] Helper functions
    getTaxToleranceMultiplier,
    getResourceConsumptionMultiplier,
    getBuildingCostBaseMultiplier,
    getTechCostMultiplier,
    getPopulationGrowthMultiplier,
    getBuildingUpgradeCostMultiplier,
    getArmyMaintenanceMultiplier,
};

/**
 * Get tax tolerance multiplier
 * Higher values = more tolerance (easy)
 * Lower values = less tolerance (hard)
 * @param {string} difficultyLevel
 * @returns {number} Multiplier (default 1.0)
 */
export function getTaxToleranceMultiplier(difficultyLevel) {
    const config = getDifficultyConfig(difficultyLevel);
    return config.taxToleranceMultiplier || 1.0;
}

/**
 * Get resource consumption multiplier
 * Higher values = more consumption (hard)
 * @param {string} difficultyLevel
 * @returns {number} Multiplier (default 1.0)
 */
export function getResourceConsumptionMultiplier(difficultyLevel) {
    const config = getDifficultyConfig(difficultyLevel);
    return config.resourceConsumptionMultiplier || 1.0;
}

/**
 * Get building cost base multiplier
 * Higher values = more expensive base cost (hard)
 * @param {string} difficultyLevel
 * @returns {number} Multiplier (default 1.0)
 */
export function getBuildingCostBaseMultiplier(difficultyLevel) {
    const config = getDifficultyConfig(difficultyLevel);
    return config.buildingCostBaseMultiplier || 1.0;
}

/**
 * Get tech cost multiplier
 * Higher values = more expensive tech (hard)
 * @param {string} difficultyLevel
 * @returns {number} Multiplier (default 1.0)
 */
export function getTechCostMultiplier(difficultyLevel) {
    const config = getDifficultyConfig(difficultyLevel);
    return config.techCostMultiplier || 1.0;
}

/**
 * Get population growth multiplier
 * Higher values = faster growth (easy)
 * @param {string} difficultyLevel
 * @returns {number} Multiplier (default 1.0)
 */
export function getPopulationGrowthMultiplier(difficultyLevel) {
    const config = getDifficultyConfig(difficultyLevel);
    return config.populationGrowthMultiplier || 1.0;
}

/**
 * Get building upgrade cost multiplier
 * Higher values = more expensive upgrades (hard)
 * @param {string} difficultyLevel
 * @returns {number} Multiplier (default 1.0)
 */
export function getBuildingUpgradeCostMultiplier(difficultyLevel) {
    const config = getDifficultyConfig(difficultyLevel);
    return config.buildingUpgradeCostMultiplier || 1.0;
}

/**
 * Get army maintenance multiplier
 * Higher values = more expensive armies (hard)
 * @param {string} difficultyLevel
 * @returns {number} Multiplier (default 1.0)
 */
export function getArmyMaintenanceMultiplier(difficultyLevel) {
    const config = getDifficultyConfig(difficultyLevel);
    return config.armyMaintenanceMultiplier || 1.0;
}
