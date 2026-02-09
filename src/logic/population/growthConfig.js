/**
 * Population Growth Configuration
 * 
 * ⚠️ SINGLE SOURCE OF TRUTH FOR ALL GROWTH RATES ⚠️
 * 
 * This file is the ONLY place where growth rates should be defined.
 * DO NOT define intrinsicGrowthRate anywhere else in the codebase!
 * 
 * If you need to adjust growth rates, modify the values in this file.
 * All growth-related modules import from here to ensure consistency.
 * 
 * Usage:
 * - AI nations: Use getIntrinsicGrowthRate('ai', tickScale)
 * - Player nations: Use getIntrinsicGrowthRate('player', tickScale)
 * - Legacy/testing: Use GROWTH_RATES.LEGACY
 */

/**
 * Base intrinsic growth rates (per 10 ticks)
 */
export const GROWTH_RATES = {
  // Base growth rate for AI nations (2% per 10 ticks)
  AI_BASE: 0.02,
  
  // Base growth rate for player nations (can be different if needed)
  PLAYER_BASE: 0.02,
  
  // Legacy/comparison growth rate (for testing)
  LEGACY: 0.025,
  
  // Old logistic growth rate (deprecated, kept for reference)
  OLD_LOGISTIC: 0.03,
};

/**
 * Difficulty multipliers for AI growth
 */
export const DIFFICULTY_GROWTH_MULTIPLIERS = {
  'veryEasy': 0.7,
  'easy': 0.85,
  'normal': 1.0,
  'hard': 1.05,      // [Reduced from 1.15]
  'veryHard': 1.1,    // [Reduced from 1.3]
  'impossible': 1.2,  // [Reduced from 1.5]
};

/**
 * Growth penalties and bonuses
 */
export const GROWTH_MODIFIERS = {
  // War penalty (reduces growth during war)
  WAR_PENALTY: 0.3,
  
  // Starvation penalty (reduces growth when food is scarce)
  STARVATION_PENALTY: 0.5,
  
  // Golden age bonus (increases growth during prosperity)
  GOLDEN_AGE_BONUS: 1.5,
  
  // Trait bonuses
  TRAIT_BONUSES: {
    'Fertile': 0.2,
    'Expansionist': 0.15,
    'Agricultural': 0.1,
  },
};

/**
 * Resource requirements
 */
export const RESOURCE_REQUIREMENTS = {
  // Food per capita per tick
  FOOD_PER_CAPITA: 0.5,
  
  // Base population density (people per land unit)
  BASE_DENSITY: 10,
  
  // Density multiplier per epoch
  DENSITY_PER_EPOCH: 0.5,
};

/**
 * Get the intrinsic growth rate for a given context
 * @param {string} type - 'ai' or 'player'
 * @param {number} tickScale - Time scale factor (default 10)
 * @returns {number} Growth rate
 */
export function getIntrinsicGrowthRate(type = 'ai', tickScale = 10) {
  const baseRate = type === 'player' ? GROWTH_RATES.PLAYER_BASE : GROWTH_RATES.AI_BASE;
  return baseRate * tickScale;
}

/**
 * Get difficulty-adjusted growth rate
 * @param {string} difficulty - Difficulty level
 * @param {number} baseRate - Base growth rate
 * @returns {number} Adjusted growth rate
 */
export function getDifficultyAdjustedGrowthRate(difficulty = 'normal', baseRate) {
  const multiplier = DIFFICULTY_GROWTH_MULTIPLIERS[difficulty] || 1.0;
  return baseRate * multiplier;
}
