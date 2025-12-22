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
    // 使用累加模式：初始值为 0，表示 +0% 加成
    categoryBonuses: { gather: 0, industry: 0, civic: 0, military: 0 },
    passiveGains: {},
    passivePercentGains: {},     // NEW: Percentage-based passive resource modifiers
    perPopPassiveGains: {},      // NEW: { resource: amountPerPopulation }
    incomePercentBonus: 0,       // NEW: percentage bonus to silver income
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
    needsReduction: 0,
    // 新增：庆典/科技/政令的特殊加成
    stabilityBonus: 0,      // 稳定度加成
    scienceBonus: 0,        // 科研产出加成
    cultureBonus: 0,        // 文化产出加成
    militaryBonus: 0        // 军事力量加成
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

    // Building-specific bonuses - 使用累加模式
    if (effects.buildings) {
        Object.entries(effects.buildings).forEach(([id, percent]) => {
            if (!id || typeof percent !== 'number') return;
            if (!Number.isFinite(percent)) return;
            // 累加百分比：初始为 0，每次加上 percent
            buildingBonuses[id] = (buildingBonuses[id] || 0) + percent;
        });
    }

    // Category bonuses - 使用累加模式
    if (effects.categories) {
        Object.entries(effects.categories).forEach(([cat, percent]) => {
            if (!cat || typeof percent !== 'number') return;
            if (!Number.isFinite(percent)) return;
            // 累加百分比：初始为 0，每次加上 percent
            categoryBonuses[cat] = (categoryBonuses[cat] || 0) + percent;
        });
    }

    // Passive gains (absolute values - for small amounts like culture, science)
    if (effects.passive) {
        Object.entries(effects.passive).forEach(([resKey, amount]) => {
            if (!resKey || typeof amount !== 'number') return;
            passiveGains[resKey] = (passiveGains[resKey] || 0) + amount;
        });
    }

    // Passive percent gains (percentage-based modifiers for resources like silver, food)
    if (effects.passivePercent) {
        Object.entries(effects.passivePercent).forEach(([resKey, percent]) => {
            if (!resKey || typeof percent !== 'number') return;
            bonuses.passivePercentGains[resKey] = (bonuses.passivePercentGains[resKey] || 0) + percent;
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
    // 新增：处理庆典的特殊加成效果
    if (effects.stability) {
        bonuses.stabilityBonus += effects.stability;
    }
    if (effects.scienceBonus) {
        bonuses.scienceBonus += effects.scienceBonus;
    }
    if (effects.cultureBonus) {
        bonuses.cultureBonus += effects.cultureBonus;
    }
    if (effects.militaryBonus) {
        bonuses.militaryBonus += effects.militaryBonus;
    }

    // Support legacy keys from config files (epochs.js, strata.js)
    if (effects.gatherBonus) {
        categoryBonuses.gather = (categoryBonuses.gather || 0) + effects.gatherBonus;
    }
    if (effects.industryBonus) {
        bonuses.industryBonus += effects.industryBonus;
    }
    if (effects.knowledgeBonus) {
        // Map knowledgeBonus to scienceBonus if not handled otherwise, or use as is if needed. 
        // Based on usages, knowledge often correlates with science.
        bonuses.scienceBonus += effects.knowledgeBonus;
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

    // NEW: Per-population passive gains (scales with total population)
    if (effects.perPopPassive) {
        Object.entries(effects.perPopPassive).forEach(([resKey, amountPerPop]) => {
            if (!resKey || typeof amountPerPop !== 'number') return;
            bonuses.perPopPassiveGains[resKey] = (bonuses.perPopPassiveGains[resKey] || 0) + amountPerPop;
        });
    }

    // NEW: Income percentage bonus (percentage of total silver income)
    if (typeof effects.incomePercent === 'number') {
        bonuses.incomePercentBonus += effects.incomePercent;
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
