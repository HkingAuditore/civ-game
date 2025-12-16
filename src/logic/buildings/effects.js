/**
 * Building Effects Module
 * Handles decree effects, tech effects, and production modifiers
 */

import { TECHS } from '../../config';

// Pre-build tech map for quick lookup
const TECH_MAP = TECHS.reduce((acc, tech) => {
    acc[tech.id] = tech;
    return acc;
}, {});

/**
 * Initialize production bonuses and modifiers
 * @returns {Object} Initialized bonus structures
 */
export const initializeBonuses = () => ({
    buildingBonuses: {},
    categoryBonuses: { gather: 1, industry: 1, civic: 1, military: 1 },
    passiveGains: {},
    decreeResourceDemandMod: {},
    decreeStratumDemandMod: {},
    decreeResourceSupplyMod: {},
    decreeSilverIncome: 0,
    decreeSilverExpense: 0,
    extraMaxPop: 0,
    maxPopPercent: 0,
    productionBonus: 0,
    industryBonus: 0,
    taxBonus: 0,
    needsReduction: 0
});

/**
 * Apply effects from a single source (tech, decree, festival)
 * @param {Object} effects - Effects to apply
 * @param {Object} bonuses - Bonus structures to modify
 */
export const applyEffects = (effects, bonuses) => {
    if (!effects) return;

    const {
        buildingBonuses,
        categoryBonuses,
        passiveGains,
        decreeResourceDemandMod,
        decreeStratumDemandMod,
        decreeResourceSupplyMod
    } = bonuses;

    // Building-specific bonuses
    if (effects.buildings) {
        Object.entries(effects.buildings).forEach(([id, percent]) => {
            if (!id || typeof percent !== 'number') return;
            const factor = 1 + percent;
            if (!Number.isFinite(factor) || factor <= 0) return;
            buildingBonuses[id] = (buildingBonuses[id] || 1) * factor;
        });
    }

    // Category bonuses
    if (effects.categories) {
        Object.entries(effects.categories).forEach(([cat, percent]) => {
            if (!cat || typeof percent !== 'number') return;
            const factor = 1 + percent;
            if (!Number.isFinite(factor) || factor <= 0) return;
            categoryBonuses[cat] = (categoryBonuses[cat] || 1) * factor;
        });
    }

    // Passive gains
    if (effects.passive) {
        Object.entries(effects.passive).forEach(([resKey, amount]) => {
            if (!resKey || typeof amount !== 'number') return;
            passiveGains[resKey] = (passiveGains[resKey] || 0) + amount;
        });
    }

    // Max population
    if (effects.maxPop) {
        const value = effects.maxPop;
        if (value > -1 && value < 1 && value !== 0) {
            bonuses.maxPopPercent += value;
        } else {
            bonuses.extraMaxPop += value;
        }
    }

    // Production and industry bonuses
    if (effects.production) {
        bonuses.productionBonus += effects.production;
    }
    if (effects.industry) {
        bonuses.industryBonus += effects.industry;
    }
    if (effects.taxIncome) {
        bonuses.taxBonus += effects.taxIncome;
    }
    if (effects.needsReduction) {
        bonuses.needsReduction += effects.needsReduction;
    }

    // Demand modifiers
    if (effects.resourceDemandMod) {
        Object.entries(effects.resourceDemandMod).forEach(([resKey, percent]) => {
            if (typeof percent === 'number') {
                decreeResourceDemandMod[resKey] = (decreeResourceDemandMod[resKey] || 0) + percent;
            }
        });
    }

    if (effects.stratumDemandMod) {
        Object.entries(effects.stratumDemandMod).forEach(([stratumKey, percent]) => {
            if (typeof percent === 'number') {
                decreeStratumDemandMod[stratumKey] = (decreeStratumDemandMod[stratumKey] || 0) + percent;
            }
        });
    }

    // Supply modifiers
    if (effects.resourceSupplyMod) {
        Object.entries(effects.resourceSupplyMod).forEach(([resKey, percent]) => {
            if (typeof percent === 'number') {
                decreeResourceSupplyMod[resKey] = (decreeResourceSupplyMod[resKey] || 0) + percent;
            }
        });
    }
};

/**
 * Apply all tech effects
 * @param {Array} techsUnlocked - List of unlocked tech IDs
 * @param {Object} bonuses - Bonus structures to modify
 */
export const applyTechEffects = (techsUnlocked, bonuses) => {
    techsUnlocked.forEach(id => {
        const tech = TECH_MAP[id];
        if (!tech || !tech.effects) return;
        applyEffects(tech.effects, bonuses);
    });
};

/**
 * Apply all decree effects
 * @param {Array} decrees - List of decrees
 * @param {Object} bonuses - Bonus structures to modify
 */
export const applyDecreeEffects = (decrees, bonuses) => {
    decrees.forEach(decree => {
        if (!decree || !decree.active || !decree.modifiers) return;

        const passiveSilver = decree.modifiers?.passive?.silver || 0;
        if (passiveSilver > 0) {
            bonuses.decreeSilverIncome += passiveSilver;
        } else if (passiveSilver < 0) {
            bonuses.decreeSilverExpense += Math.abs(passiveSilver);
        }

        applyEffects(decree.modifiers, bonuses);
    });
};

/**
 * Apply festival effects
 * @param {Array} activeFestivalEffects - List of active festival effects
 * @param {Object} bonuses - Bonus structures to modify
 */
export const applyFestivalEffects = (activeFestivalEffects, bonuses) => {
    activeFestivalEffects.forEach(festivalEffect => {
        if (!festivalEffect || !festivalEffect.effects) return;
        applyEffects(festivalEffect.effects, bonuses);
    });
};

/**
 * Calculate total max population
 * @param {number} baseMaxPop - Base max population from buildings
 * @param {Object} bonuses - Bonus structures
 * @param {number} maxPopBonus - Additional max pop bonus
 * @returns {number} Total max population
 */
export const calculateTotalMaxPop = (baseMaxPop, bonuses, maxPopBonus = 0) => {
    let totalMaxPop = baseMaxPop + bonuses.extraMaxPop + maxPopBonus;

    if (bonuses.maxPopPercent !== 0) {
        const multiplier = Math.max(0, 1 + bonuses.maxPopPercent);
        totalMaxPop = Math.max(0, totalMaxPop * multiplier);
    }

    return Math.floor(totalMaxPop);
};
