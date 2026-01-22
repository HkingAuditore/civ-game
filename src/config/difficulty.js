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
        description: '轻松模式，专注于建设，战争威胁较低',
        icon: '🕊️',
        // Organization/Rebellion modifiers
        organizationGrowthMultiplier: 0.4,     // 40% organization growth rate (was 0.2)
        organizationDecayMultiplier: 1.5,      // 150% decay rate (was 2.0)
        satisfactionThreshold: 30,             // Slightly higher threshold (was 25)
        buildingCostGrowthFactor: 1.08,        // Slightly higher scaling (was 1.05)
        // AI War modifiers
        aiWarDeclarationChance: 0.25,          // 25% of normal war declaration chance (was 0.1)
        aiMilitaryActionChance: 0.35,          // 35% of normal military action chance (was 0.2)
        aiMilitaryCooldownBonus: 20,           // Reduced cooldown bonus (was 30)
        aiMinWarEpoch: 3,                      // AI can declare war from Medieval era (was 4)
        // Raid modifiers
        raidDamageMultiplier: 0.5,             // 50% raid damage (was 0.3)
        raidPopulationLossMultiplier: 0.4,     // 40% population loss from raids (was 0.2)
        // Peace/Stability bonuses
        stabilityDampeningBonus: 0.18,         // Reduced stability dampening (was 0.25)
        newGameGracePeriod: 100,               // Shorter grace period (was 150)
        // Economic modifiers
        inventoryTargetDaysMultiplier: 0.7,    // 70% inventory target (was 0.5)
        aiDevelopmentMultiplier: 0.8,          // 80% AI development speed (was 0.6)
        // [NEW] Configurable Parameters
        taxToleranceMultiplier: 1.6,           // 160% tax tolerance (was 2.0)
        resourceConsumptionMultiplier: 1.0,    // 100% consumption (was 0.9)
        buildingCostBaseMultiplier: 1.0,       // No base cost increase
        techCostMultiplier: 1.1,               // 110% tech cost (was 1.0)
        populationGrowthMultiplier: 1.3,       // 130% growth rate (was 1.5)
        buildingUpgradeCostMultiplier: 1.1,    // 110% upgrade cost (was 1.0)
        armyMaintenanceMultiplier: 0.65,       // 65% army maintenance (was 0.5)
        maxConsumptionMultiplierBonus: 2,      // +2 to max consumption (was 1)

        // Diplomacy/Relations modifiers
        goodRelationChangeMultiplier: 1.15,    // (was 1.25)
        badRelationChangeMultiplier: 0.85,     // (was 0.75)
        // Base daily drift back to 50
        relationDailyDriftRate: 0.018,         // (was 0.015)
        // Base monthly drift back to 50 (ally/non-ally)
        relationMonthlyDriftRateAlly: 0.05,    // (was 0.04)
        relationMonthlyDriftRateNonAlly: 0.15, // (was 0.12)
        // Ally cold event settings (when ally relation < 70)
        allyColdEventCooldown: 100,            // 100 days cooldown (was 120)
        allyColdEventChance: 0.003,            // 0.3% daily chance (was 0.002)
        // Vassal independence modifiers
        vassalIndependenceMultiplier: 0.5,     // 50% independence growth (was 0.3)
        vassalIndependenceWarChance: 0.4,      // 40% independence war trigger chance (was 0.2)
        // [NEW] Initial Buildings
        initialBuildings: {
            farm: 2,
            lumber_camp: 2,
            quarry: 1,
            loom_house: 1,
            market: 1
        },
    },
    [DIFFICULTY_LEVELS.EASY]: {
        id: DIFFICULTY_LEVELS.EASY,
        name: '简单',
        description: '适合新手，叛乱增长较慢，敌人攻击概率降低',
        icon: '🌱',
        // Organization/Rebellion modifiers
        organizationGrowthMultiplier: 0.7,     // 70% organization growth rate (was 0.5)
        organizationDecayMultiplier: 1.2,      // 120% decay rate (was 1.5)
        satisfactionThreshold: 40,             // Higher threshold (was 35)
        buildingCostGrowthFactor: 1.12,        // Slightly higher scaling (was 1.10)
        // AI War modifiers
        aiWarDeclarationChance: 0.7,           // 70% of normal war declaration chance (was 0.5)
        aiMilitaryActionChance: 0.7,           // 70% of normal military action chance (was 0.5)
        aiMilitaryCooldownBonus: 10,           // Reduced cooldown bonus (was 15)
        aiMinWarEpoch: 2,                      // AI can declare war from Iron Age (was 3)
        // Raid modifiers
        raidDamageMultiplier: 0.8,             // 80% raid damage (was 0.6)
        raidPopulationLossMultiplier: 0.7,     // 70% population loss (was 0.5)
        // Peace/Stability bonuses
        stabilityDampeningBonus: 0.10,         // Reduced stability dampening (was 0.15)
        newGameGracePeriod: 60,                // Shorter grace period (was 100)
        // Economic modifiers
        inventoryTargetDaysMultiplier: 0.85,   // 85% inventory target (was 0.7)
        aiDevelopmentMultiplier: 1.0,          // 100% AI development speed (was 0.8)
        // [NEW] Configurable Parameters
        taxToleranceMultiplier: 1.3,           // 130% tax tolerance (was 1.5)
        resourceConsumptionMultiplier: 1.1,    // 110% consumption (was 1.0)
        buildingCostBaseMultiplier: 1.0,       // No base cost increase
        techCostMultiplier: 1.4,               // 140% tech cost (was 1.2)
        populationGrowthMultiplier: 1.1,       // 110% growth rate (was 1.2)
        buildingUpgradeCostMultiplier: 1.4,    // 140% upgrade cost (was 1.2)
        armyMaintenanceMultiplier: 0.85,       // 85% army maintenance (was 0.75)
        maxConsumptionMultiplierBonus: 4,      // +4 to max consumption (was 3)

        // Diplomacy/Relations modifiers
        goodRelationChangeMultiplier: 1.05,    // (was 1.1)
        badRelationChangeMultiplier: 0.95,     // (was 0.9)
        relationDailyDriftRate: 0.02,          // (was 0.018)
        relationMonthlyDriftRateAlly: 0.05,    // (was 0.045)
        relationMonthlyDriftRateNonAlly: 0.18, // (was 0.16)
        // Ally cold event settings
        allyColdEventCooldown: 75,             // 75 days cooldown (was 90)
        allyColdEventChance: 0.004,            // 0.4% daily chance (was 0.003)
        // Vassal independence modifiers
        vassalIndependenceMultiplier: 0.8,     // 80% independence growth (was 0.6)
        vassalIndependenceWarChance: 0.7,      // 70% independence war trigger chance (was 0.5)
        // [NEW] Initial Buildings
        initialBuildings: {
            farm: 2,
            lumber_camp: 2,
            loom_house: 1
        },
    },
[DIFFICULTY_LEVELS.NORMAL]: {
        id: DIFFICULTY_LEVELS.NORMAL,
        name: '普通',
        description: '标准游戏体验，有一定挑战性',
        icon: '⚖️',
        // Organization/Rebellion modifiers
        organizationGrowthMultiplier: 1.2,     // 120% organization growth rate (was 1.0)
        organizationDecayMultiplier: 0.9,      // 90% decay rate (was 1.0)
        satisfactionThreshold: 50,             // Higher threshold (was 45)
        buildingCostGrowthFactor: 1.18,        // Higher scaling (was 1.15)
        // AI War modifiers
        aiWarDeclarationChance: 1.3,           // 130% normal war declaration chance (was 1.0)
        aiMilitaryActionChance: 1.2,           // 120% normal military action chance (was 1.0)
        aiMilitaryCooldownBonus: -3,           // Slight cooldown reduction (was 0)
        aiMinWarEpoch: 1,                      // AI can declare war from Bronze Age (was 2)
        // Raid modifiers
        raidDamageMultiplier: 1.2,             // 120% raid damage (was 1.0)
        raidPopulationLossMultiplier: 1.2,     // 120% population loss (was 1.0)
        // Peace/Stability bonuses
        stabilityDampeningBonus: -0.05,        // Slight negative effect (was 0)
        newGameGracePeriod: 0,                 // No grace period
        // Economic modifiers
        inventoryTargetDaysMultiplier: 1.5,    // 150% inventory target (was 1.0)
        aiDevelopmentMultiplier: 1.5,          // 150% AI development speed (was 1.0)
        // [NEW] Configurable Parameters
        taxToleranceMultiplier: 0.9,           // 90% tax tolerance (was 1.0)
        resourceConsumptionMultiplier: 1.5,    // 150% consumption (was 1.2)
        buildingCostBaseMultiplier: 1.0,       // No base cost increase
        techCostMultiplier: 2.0,               // 200% tech cost (was 1.5)
        populationGrowthMultiplier: 0.9,       // 90% growth rate (was 1.0)
        buildingUpgradeCostMultiplier: 2.0,    // 200% upgrade cost (was 1.5)
        armyMaintenanceMultiplier: 1.2,        // 120% army maintenance (was 1.0)
        maxConsumptionMultiplierBonus: 7,      // +7 to max consumption (was 6)

        // Diplomacy/Relations modifiers
        goodRelationChangeMultiplier: 0.9,     // (was 1.0)
        badRelationChangeMultiplier: 1.1,      // (was 1.0)
        relationDailyDriftRate: 0.025,         // (was 0.02)
        relationMonthlyDriftRateAlly: 0.06,    // (was 0.05)
        relationMonthlyDriftRateNonAlly: 0.25, // (was 0.2)
        // Ally cold event settings
        allyColdEventCooldown: 50,             // 50 days cooldown (was 60)
        allyColdEventChance: 0.005,            // 0.5% daily chance (was 0.004)
        // Vassal independence modifiers
        vassalIndependenceMultiplier: 1.3,     // 130% independence growth (was 1.0)
        vassalIndependenceWarChance: 1.3,      // 130% independence war trigger chance (was 1.0)
        // [NEW] Initial Buildings
        initialBuildings: {
            farm: 1,
            lumber_camp: 1
        },
    },
[DIFFICULTY_LEVELS.HARD]: {
        id: DIFFICULTY_LEVELS.HARD,
        name: '困难',
        description: '高难度挑战，内忧外患不断，需要精心策划',
        icon: '🔥',
        // Organization/Rebellion modifiers
        organizationGrowthMultiplier: 2.0,     // 200% organization growth rate (was 1.5)
        organizationDecayMultiplier: 0.4,      // 40% decay rate (was 0.5)
        satisfactionThreshold: 65,             // Higher threshold (was 60)
        buildingCostGrowthFactor: 1.30,        // Steeper scaling (was 1.25)
        // AI War modifiers
        aiWarDeclarationChance: 2.5,           // 250% war declaration chance (was 2.0)
        aiMilitaryActionChance: 2.0,           // 200% military action chance (was 1.5)
        aiMilitaryCooldownBonus: -8,           // More reduced cooldown (was -5)
        aiMinWarEpoch: 0,                      // AI can declare war from start (was 1)
        // Raid modifiers
        raidDamageMultiplier: 2.0,             // 200% raid damage (was 1.5)
        raidPopulationLossMultiplier: 2.0,     // 200% population loss (was 1.5)
        // Peace/Stability bonuses
        stabilityDampeningBonus: -0.15,        // More negative effect (was -0.1)
        newGameGracePeriod: 0,                 // No grace period
        // Economic modifiers
        inventoryTargetDaysMultiplier: 5.0,    // 500% inventory target (was 3.0)
        aiDevelopmentMultiplier: 4.0,          // 400% AI development speed (was 3.0)
        // [NEW] Configurable Parameters
        taxToleranceMultiplier: 0.6,           // 60% tax tolerance (was 0.7)
        resourceConsumptionMultiplier: 4.5,    // 450% consumption (was 3.5)
        buildingCostBaseMultiplier: 1.0,       // No base cost increase
        techCostMultiplier: 4.0,               // 400% tech cost (was 3.0)
        startingSilverMultiplier: 5.0,         // Increased starting silver (was 4.0)
        populationGrowthMultiplier: 0.7,       // 70% growth rate (was 0.8)
        buildingUpgradeCostMultiplier: 4.0,    // 400% upgrade cost (was 3.0)
        armyMaintenanceMultiplier: 1.8,        // 180% army maintenance (was 1.5)
        maxConsumptionMultiplierBonus: 9,      // +9 to max consumption (was 8)

        // Diplomacy/Relations modifiers
        goodRelationChangeMultiplier: 0.65,    // (was 0.75)
        badRelationChangeMultiplier: 1.4,      // (was 1.25)
        relationDailyDriftRate: 0.035,         // (was 0.03)
        relationMonthlyDriftRateAlly: 0.1,     // (was 0.08)
        relationMonthlyDriftRateNonAlly: 0.45, // (was 0.35)
        // Ally cold event settings
        allyColdEventCooldown: 40,             // 40 days cooldown (was 45)
        allyColdEventChance: 0.006,            // 0.6% daily chance (was 0.005)
        // Vassal independence modifiers
        vassalIndependenceMultiplier: 2.0,     // 200% independence growth (was 1.5)
        vassalIndependenceWarChance: 2.0,      // 200% independence war trigger chance (was 1.5)
        // [NEW] Initial Buildings
        initialBuildings: {
            farm: 1
        },
    },
[DIFFICULTY_LEVELS.VERY_HARD]: {
        id: DIFFICULTY_LEVELS.VERY_HARD,
        name: '灾厄',
        description: '极高难度，四面楚歌，只有最精妙的策略才能存活',
        icon: '☠️',
        // Organization/Rebellion modifiers
        organizationGrowthMultiplier: 2.5,     // 250% organization growth rate (was 2.0)
        organizationDecayMultiplier: 0.15,     // 15% decay rate (was 0.2)
        satisfactionThreshold: 80,             // Very high threshold (was 75)
        buildingCostGrowthFactor: 1.35,        // Very steep scaling (was 1.30)
        // AI War modifiers
        aiWarDeclarationChance: 4.5,           // 450% war declaration chance (was 3.5)
        aiMilitaryActionChance: 3.5,           // 350% military action chance (was 2.5)
        aiMilitaryCooldownBonus: -15,          // More reduced cooldown (was -10)
        aiMinWarEpoch: 0,                      // AI can declare war from start
        // Raid modifiers
        raidDamageMultiplier: 3.5,             // 350% raid damage (was 2.5)
        raidPopulationLossMultiplier: 3.5,     // 350% population loss (was 2.5)
        // Peace/Stability bonuses
        stabilityDampeningBonus: -0.3,         // More negative stability effect (was -0.2)
        newGameGracePeriod: 0,                 // No grace period
        // Economic modifiers
        inventoryTargetDaysMultiplier: 12.0,   // 1200% inventory target (was 8.0)
        aiDevelopmentMultiplier: 6.0,          // 600% AI development speed (was 5.0)
        // [NEW] Configurable Parameters
        taxToleranceMultiplier: 0.3,           // 30% tax tolerance (was 0.4)
        resourceConsumptionMultiplier: 7.5,    // 750% consumption (was 6.0)
        buildingCostBaseMultiplier: 1.0,       // No base cost increase
        techCostMultiplier: 8.0,               // 800% tech cost (was 6.0)
        startingSilverMultiplier: 8.0,         // Increased starting silver (was 6.0)
        populationGrowthMultiplier: 0.4,       // 40% growth rate (was 0.5)
        buildingUpgradeCostMultiplier: 6.5,    // 650% upgrade cost (was 5.0)
        armyMaintenanceMultiplier: 2.5,        // 250% army maintenance (was 2.0)
        maxConsumptionMultiplierBonus: 11,     // +11 to max consumption (was 10)

        // Diplomacy/Relations modifiers
        goodRelationChangeMultiplier: 0.5,     // (was 0.6)
        badRelationChangeMultiplier: 1.8,      // (was 1.6)
        relationDailyDriftRate: 0.05,          // (was 0.04)
        relationMonthlyDriftRateAlly: 0.12,    // (was 0.1)
        relationMonthlyDriftRateNonAlly: 0.6,  // (was 0.5)
        // Ally cold event settings
        allyColdEventCooldown: 50,             // 50 days cooldown (was 60)
        allyColdEventChance: 0.005,            // 0.5% daily chance (was 0.004)
        // Vassal independence modifiers
        vassalIndependenceMultiplier: 2.8,     // 280% independence growth (was 2.0)
        vassalIndependenceWarChance: 2.8,      // 280% independence war trigger chance (was 2.0)
        // [NEW] Initial Buildings
        initialBuildings: {},                  // No starting buildings (was farm: 1)
    },
[DIFFICULTY_LEVELS.EXTREME]: {
        id: DIFFICULTY_LEVELS.EXTREME,
        name: '地狱',
        description: '绝望的深渊，每一步都是生死抉择，几乎无法通关',
        icon: '👿',
        // Organization/Rebellion modifiers
        organizationGrowthMultiplier: 4.0,     // 400% organization growth rate (was 3.0)
        organizationDecayMultiplier: 0.03,     // 3% decay rate (was 0.05)
        satisfactionThreshold: 85,             // Extreme threshold (was 80)
        buildingCostGrowthFactor: 1.50,        // Extreme scaling (was 1.40)
        // AI War modifiers
        aiWarDeclarationChance: 7.0,           // 700% war declaration chance (was 5.0)
        aiMilitaryActionChance: 7.0,           // 700% military action chance (was 5.0)
        aiMilitaryCooldownBonus: -25,          // Very fast cooldown (was -20)
        aiMinWarEpoch: 0,                      // AI can declare war from start
        // Raid modifiers
        raidDamageMultiplier: 6.0,             // 600% raid damage (was 5.0)
        raidPopulationLossMultiplier: 6.0,     // 600% population loss (was 5.0)
        // Peace/Stability bonuses
        stabilityDampeningBonus: -0.6,         // Severe negative stability effect (was -0.5)
        newGameGracePeriod: 0,                 // No grace period
        // Economic modifiers
        inventoryTargetDaysMultiplier: 25.0,   // 2500% inventory target (was 20.0)
        aiDevelopmentMultiplier: 10.0,         // 1000% AI development speed (was 8.0)
        // [NEW] Configurable Parameters
        taxToleranceMultiplier: 0.15,          // 15% tax tolerance (was 0.2)
        resourceConsumptionMultiplier: 10.0,   // 1000% consumption (was 8.0)
        buildingCostBaseMultiplier: 1.0,       // No base cost increase
        techCostMultiplier: 12.0,              // 1200% tech cost (was 10.0)
        startingSilverMultiplier: 12.0,        // Increased starting silver (was 10.0)
        populationGrowthMultiplier: 0.15,      // 15% growth rate (was 0.2)
        buildingUpgradeCostMultiplier: 12.0,   // 1200% upgrade cost (was 10.0)
        armyMaintenanceMultiplier: 4.0,        // 400% army maintenance (was 3.0)
        maxConsumptionMultiplierBonus: 15,     // +15 to max consumption (was 12)

        // Diplomacy/Relations modifiers
        goodRelationChangeMultiplier: 0.35,    // (was 0.45)
        badRelationChangeMultiplier: 2.5,      // (was 2.0)
        relationDailyDriftRate: 0.06,          // (was 0.05)
        relationMonthlyDriftRateAlly: 0.15,    // (was 0.12)
        relationMonthlyDriftRateNonAlly: 0.8,  // (was 0.7)
        // Ally cold event settings (longer cooldown to prevent spam in extreme)
        allyColdEventCooldown: 80,             // 80 days cooldown (was 90)
        allyColdEventChance: 0.004,            // 0.4% daily chance (was 0.003)
        // Vassal independence modifiers
        vassalIndependenceMultiplier: 4.0,     // 400% independence growth (was 3.0)
        vassalIndependenceWarChance: 4.0,      // 400% independence war trigger chance (was 3.0)
        // [NEW] Initial Buildings
        initialBuildings: {},                  // No starting buildings (was loom_house: 1)
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

/**
 * Get relation change multipliers based on difficulty
 * @param {string} difficultyLevel
 * @returns {{good: number, bad: number}}
 */
export function getRelationChangeMultipliers(difficultyLevel) {
    const config = getDifficultyConfig(difficultyLevel);
    return {
        good: config.goodRelationChangeMultiplier ?? 1.0,
        bad: config.badRelationChangeMultiplier ?? 1.0,
    };
}

/**
 * Get base daily drift rate of relations toward 50
 * @param {string} difficultyLevel
 * @returns {number}
 */
export function getRelationDailyDriftRate(difficultyLevel) {
    const config = getDifficultyConfig(difficultyLevel);
    return config.relationDailyDriftRate ?? 0.02;
}

/**
 * Get base monthly drift rate of relations toward 50
 * @param {string} difficultyLevel
 * @param {boolean} isAlly
 * @returns {number}
 */
export function getRelationMonthlyDriftRate(difficultyLevel, isAlly) {
    const config = getDifficultyConfig(difficultyLevel);
    if (isAlly) return config.relationMonthlyDriftRateAlly ?? 0.05;
    return config.relationMonthlyDriftRateNonAlly ?? 0.2;
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
    isInGracePeriod,
    getBuildingCostGrowthFactor,
    getInventoryTargetDaysMultiplier,
    getRelationChangeMultipliers,
    getRelationDailyDriftRate,
    getRelationMonthlyDriftRate,
    getInitialBuildings,
    // [NEW] Helper functions
    getTaxToleranceMultiplier,
    getResourceConsumptionMultiplier,
    getBuildingCostBaseMultiplier,
    getTechCostMultiplier,
    getPopulationGrowthMultiplier,
    getBuildingUpgradeCostMultiplier,
    getArmyMaintenanceMultiplier,
    getMaxConsumptionMultiplierBonus,
    getStartingSilverMultiplier,
    // Ally cold event settings
    getAllyColdEventCooldown,
    getAllyColdEventChance,
    // Vassal independence settings
    getVassalIndependenceMultiplier,
    getVassalIndependenceWarChance,
};

/**
 * Get ally cold event cooldown (days) based on difficulty
 * Higher values = longer cooldown = less frequent events
 * @param {string} difficultyLevel
 * @returns {number} Cooldown in days (default 60)
 */
export function getAllyColdEventCooldown(difficultyLevel) {
    const config = getDifficultyConfig(difficultyLevel);
    return config.allyColdEventCooldown ?? 60;
}

/**
 * Get ally cold event daily trigger chance based on difficulty
 * Lower values = less frequent events
 * @param {string} difficultyLevel
 * @returns {number} Daily chance (default 0.004)
 */
export function getAllyColdEventChance(difficultyLevel) {
    const config = getDifficultyConfig(difficultyLevel);
    return config.allyColdEventChance ?? 0.004;
}

/**
 * Get initial buildings for the difficulty level
 * @param {string} difficultyLevel - Current difficulty level
 * @returns {Object} Initial buildings object
 */
export function getInitialBuildings(difficultyLevel) {
    const config = getDifficultyConfig(difficultyLevel);
    return config.initialBuildings || {};
}


/**
 * Get starting silver multiplier
 * Higher values = more starting silver (used to keep early game playable on hard)
 * @param {string} difficultyLevel
 * @returns {number} Multiplier (default 1.0)
 */
export function getStartingSilverMultiplier(difficultyLevel) {
    const config = getDifficultyConfig(difficultyLevel);
    return config.startingSilverMultiplier || 1.0;
}

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
 * Get AI development multiplier
 * Higher values = faster AI growth (hard)
 * @param {string} difficultyLevel
 * @returns {number} Multiplier (default 1.0)
 */
export function getAIDevelopmentMultiplier(difficultyLevel) {
    const config = getDifficultyConfig(difficultyLevel);
    return config.aiDevelopmentMultiplier || 1.0;
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

/**
 * Get max consumption multiplier bonus
 * Positive values = higher consumption cap (hard difficulties increase resource sink)
 * Negative values = lower consumption cap (easy difficulties reduce resource sink)
 * @param {string} difficultyLevel
 * @returns {number} Bonus value to add to base maxConsumptionMultiplier (default 0)
 */
export function getMaxConsumptionMultiplierBonus(difficultyLevel) {
    const config = getDifficultyConfig(difficultyLevel);
    return config.maxConsumptionMultiplierBonus || 0;
}

/**
 * Get vassal independence growth multiplier
 * Higher values = faster independence growth (harder difficulties make vassals more rebellious)
 * Lower values = slower independence growth (easier difficulties make vassals more loyal)
 * @param {string} difficultyLevel
 * @returns {number} Multiplier (default 1.0)
 */
export function getVassalIndependenceMultiplier(difficultyLevel) {
    const config = getDifficultyConfig(difficultyLevel);
    return config.vassalIndependenceMultiplier || 1.0;
}

/**
 * Get vassal independence war trigger chance multiplier
 * Higher values = more likely to trigger independence wars (harder)
 * Lower values = less likely to trigger independence wars (easier)
 * @param {string} difficultyLevel
 * @returns {number} Multiplier (default 1.0)
 */
export function getVassalIndependenceWarChance(difficultyLevel) {
    const config = getDifficultyConfig(difficultyLevel);
    return config.vassalIndependenceWarChance || 1.0;
}
