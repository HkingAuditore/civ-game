/**
 * Military Corps & General System
 *
 * Corps: organized groups of military units that can be assigned to fronts.
 * General: commanders that boost corps combat effectiveness.
 *
 * Data models:
 * - Corps: { id, name, units: {unitId: count}, generalId, assignedFrontId, status, morale }
 * - General: { id, name, level, experience, traits, assignedCorpsId }
 */

// ========== Constants ==========

const GENERAL_TRAITS = [
    { id: 'aggressive', name: '猛攻', attackBonus: 0.12, defenseBonus: -0.05, desc: '攻击+12%, 防御-5%' },
    { id: 'defensive', name: '铁壁', attackBonus: -0.05, defenseBonus: 0.12, desc: '防御+12%, 攻击-5%' },
    { id: 'swift', name: '疾行', speedBonus: 0.15, moraleBonus: 0.05, desc: '速度+15%, 士气+5%' },
    { id: 'inspiring', name: '鼓舞', moraleBonus: 0.15, attackBonus: 0.03, desc: '士气+15%, 攻击+3%' },
    { id: 'cunning', name: '诡诈', attackBonus: 0.08, defenseBonus: 0.08, desc: '攻击+8%, 防御+8%' },
    { id: 'veteran', name: '百战', attackBonus: 0.05, defenseBonus: 0.05, moraleBonus: 0.1, desc: '全属性+5%, 士气+10%' },
    { id: 'logistics', name: '辎重', supplyBonus: 0.2, desc: '补给消耗-20%' },
    { id: 'siege_master', name: '攻城', siegeBonus: 0.2, desc: '攻城效率+20%' },
];

// Name pool for random general generation
const GENERAL_NAMES = [
    '张远', '李威', '赵刚', '王猛', '刘勇', '陈策', '孙武', '吴信',
    '周瑜', '韩勇', '杨毅', '马超', '徐达', '常遇', '邓艾', '霍去',
    '卫青', '岳飞', '戚继', '袁崇', '曾国', '左宗', '冯子', '聂士',
];

const NO_GENERAL_PENALTY = 0.85; // -15% combat power without general
const MAX_CORPS_PER_PLAYER = 8;
const LEVEL_UP_XP = [100, 250, 500, 1000, 2000, 4000]; // XP needed for level 1->2, 2->3, etc.

let corpsIdCounter = 0;
let generalIdCounter = 0;

// ========== ID Generation ==========

export const generateCorpsId = () => {
    corpsIdCounter += 1;
    return `corps_${Date.now()}_${corpsIdCounter}`;
};

export const generateGeneralId = () => {
    generalIdCounter += 1;
    return `gen_${Date.now()}_${generalIdCounter}`;
};

// ========== General Functions ==========

/**
 * Generate a random general with random traits
 * @param {number} epoch - Current epoch affects trait quality
 * @returns {Object} New general object
 */
export const generateGeneral = (epoch = 0) => {
    const name = GENERAL_NAMES[Math.floor(Math.random() * GENERAL_NAMES.length)];
    // Pick 1-2 random traits
    const traitCount = Math.random() < 0.3 ? 2 : 1;
    const shuffled = [...GENERAL_TRAITS].sort(() => Math.random() - 0.5);
    const traits = shuffled.slice(0, traitCount).map(t => t.id);

    // Base level scales slightly with epoch
    const baseLevel = 1 + Math.floor(epoch * 0.3);

    return {
        id: generateGeneralId(),
        name,
        level: Math.min(baseLevel, 6),
        experience: 0,
        traits,
        assignedCorpsId: null,
    };
};

/**
 * Create a general from an existing official (bridge to official system)
 * @param {Object} official - Official object with name, sourceStratum, effects, stats
 * @param {number} epoch - Current epoch
 * @returns {Object} New general object linked to the official
 */
export const createGeneralFromOfficial = (official, epoch = 0) => {
    if (!official) return null;

    const militaryBonus = official.effects?.militaryBonus || 0;
    const militaryUpkeep = official.effects?.militaryUpkeep || 0;
    const militaryStat = official.stats?.military || official.military || 30;
    const stratum = official.sourceStratum || '';

    // Derive level from military stat and militaryBonus
    let level = 1 + Math.floor(epoch * 0.3);
    if (militaryStat >= 85) level = Math.max(level, 4);
    else if (militaryStat >= 70) level = Math.max(level, 3);
    else if (militaryStat >= 50) level = Math.max(level, 2);
    if (militaryBonus >= 0.2) level += 1;
    level = Math.min(level, 6);

    // Derive traits from stratum and effects
    const traits = [];
    // Soldier stratum → higher chance of aggressive/veteran
    if (stratum === 'soldier') {
        traits.push(Math.random() < 0.6 ? 'aggressive' : 'veteran');
    }
    // militaryUpkeep effect → logistics trait
    if (militaryUpkeep && Math.abs(militaryUpkeep) > 0) {
        traits.push('logistics');
    }
    // militaryBonus ≥ 0.15 → inspiring trait
    if (militaryBonus >= 0.15 && !traits.includes('inspiring')) {
        traits.push('inspiring');
    }
    // Ensure at least 1 trait
    if (traits.length === 0) {
        const fallback = ['defensive', 'cunning', 'swift'];
        traits.push(fallback[Math.floor(Math.random() * fallback.length)]);
    }
    // Cap at 2 traits
    const finalTraits = traits.slice(0, 2);

    return {
        id: generateGeneralId(),
        name: official.name,
        level,
        experience: 0,
        traits: finalTraits,
        assignedCorpsId: null,
        officialId: official.id, // Link back to the official
    };
};

/**
 * Get aggregated bonuses from a general's traits and level
 * @param {Object} general
 * @returns {Object} { attackBonus, defenseBonus, speedBonus, moraleBonus, supplyBonus, siegeBonus }
 */
export const getGeneralBonuses = (general) => {
    if (!general) return { attackBonus: 0, defenseBonus: 0, speedBonus: 0, moraleBonus: 0, supplyBonus: 0, siegeBonus: 0 };

    const bonuses = { attackBonus: 0, defenseBonus: 0, speedBonus: 0, moraleBonus: 0, supplyBonus: 0, siegeBonus: 0 };

    // Trait bonuses
    for (const traitId of (general.traits || [])) {
        const trait = GENERAL_TRAITS.find(t => t.id === traitId);
        if (!trait) continue;
        for (const key of Object.keys(bonuses)) {
            if (trait[key]) bonuses[key] += trait[key];
        }
    }

    // Level bonus: +2% per level to attack and defense
    const levelBonus = (general.level - 1) * 0.02;
    bonuses.attackBonus += levelBonus;
    bonuses.defenseBonus += levelBonus;
    // Level also grants small morale bonus
    bonuses.moraleBonus += (general.level - 1) * 0.01;

    return bonuses;
};

/**
 * Award XP to a general and handle level-ups
 * @param {Object} general - The general to award XP to
 * @param {number} xp - Amount of XP to award
 * @returns {Object} Updated general (new object)
 */
export const awardGeneralXP = (general, xp) => {
    if (!general) return general;

    const updated = { ...general, experience: general.experience + xp };
    const maxLevel = LEVEL_UP_XP.length + 1; // Max level = 7

    while (updated.level < maxLevel) {
        const needed = LEVEL_UP_XP[updated.level - 1];
        if (!needed || updated.experience < needed) break;
        updated.experience -= needed;
        updated.level += 1;
    }

    return updated;
};

/**
 * Get a general's trait details
 * @param {Array<string>} traitIds
 * @returns {Array<Object>}
 */
export const getTraitDetails = (traitIds) => {
    return (traitIds || []).map(id => GENERAL_TRAITS.find(t => t.id === id)).filter(Boolean);
};

// ========== Corps Functions ==========

/**
 * Create a new empty corps
 * @param {string} name - Corps name
 * @returns {Object} New corps object
 */
export const createCorps = (name = '新军团') => {
    return {
        id: generateCorpsId(),
        name,
        units: {}, // { unitId: count }
        generalId: null,
        assignedFrontId: null,
        status: 'idle', // idle | deployed | in_combat | retreating
        morale: 100,
    };
};

/**
 * Assign units from the global army pool to a corps
 * @param {Object} corps - Target corps
 * @param {Object} army - Global army pool { unitId: count }
 * @param {Object} unitsToAssign - { unitId: count } to assign
 * @returns {{ corps: Object, army: Object }} Updated corps and army
 */
export const assignUnitsToCorps = (corps, army, unitsToAssign) => {
    const newCorps = { ...corps, units: { ...corps.units } };
    const newArmy = { ...army };

    for (const [unitId, count] of Object.entries(unitsToAssign)) {
        const available = newArmy[unitId] || 0;
        const actual = Math.min(count, available);
        if (actual <= 0) continue;

        newArmy[unitId] = available - actual;
        if (newArmy[unitId] <= 0) delete newArmy[unitId];

        newCorps.units[unitId] = (newCorps.units[unitId] || 0) + actual;
    }

    return { corps: newCorps, army: newArmy };
};

/**
 * Remove units from a corps back to the global army pool
 * @param {Object} corps - Source corps
 * @param {Object} army - Global army pool
 * @param {Object} unitsToRemove - { unitId: count } to remove
 * @returns {{ corps: Object, army: Object }} Updated corps and army
 */
export const removeUnitsFromCorps = (corps, army, unitsToRemove) => {
    const newCorps = { ...corps, units: { ...corps.units } };
    const newArmy = { ...army };

    for (const [unitId, count] of Object.entries(unitsToRemove)) {
        const inCorps = newCorps.units[unitId] || 0;
        const actual = Math.min(count, inCorps);
        if (actual <= 0) continue;

        newCorps.units[unitId] = inCorps - actual;
        if (newCorps.units[unitId] <= 0) delete newCorps.units[unitId];

        newArmy[unitId] = (newArmy[unitId] || 0) + actual;
    }

    return { corps: newCorps, army: newArmy };
};

/**
 * Disband a corps, returning all units to the global army pool
 * @param {Object} corps
 * @param {Object} army
 * @returns {Object} Updated army
 */
export const disbandCorps = (corps, army) => {
    const newArmy = { ...army };
    for (const [unitId, count] of Object.entries(corps.units || {})) {
        newArmy[unitId] = (newArmy[unitId] || 0) + count;
    }
    return newArmy;
};

/**
 * Assign a general to a corps
 * @param {Array<Object>} generals - All generals
 * @param {string} generalId - General to assign
 * @param {string} corpsId - Target corps ID
 * @returns {Array<Object>} Updated generals list
 */
export const assignGeneralToCorps = (generals, generalId, corpsId) => {
    return generals.map(g => {
        if (g.id === generalId) {
            return { ...g, assignedCorpsId: corpsId };
        }
        // Unassign if another general was previously assigned to this corps
        if (g.assignedCorpsId === corpsId && g.id !== generalId) {
            return { ...g, assignedCorpsId: null };
        }
        return g;
    });
};

/**
 * Remove a general from their assigned corps
 * @param {Array<Object>} generals
 * @param {string} generalId
 * @returns {Array<Object>} Updated generals list
 */
export const removeGeneralFromCorps = (generals, generalId) => {
    return generals.map(g =>
        g.id === generalId ? { ...g, assignedCorpsId: null } : g
    );
};

/**
 * Calculate total unit count in a corps
 * @param {Object} corps
 * @returns {number}
 */
export const getCorpsTotalUnits = (corps) => {
    if (!corps?.units) return 0;
    return Object.values(corps.units).reduce((sum, c) => sum + c, 0);
};

/**
 * Calculate combat power of a corps (considering general bonus)
 * @param {Object} corps
 * @param {Object|null} general - Assigned general (or null)
 * @param {number} epoch
 * @returns {number} Estimated combat power
 */
export const calculateCorpsCombatPower = (corps, general, epoch) => {
    // Import dynamically to avoid circular dependencies
    const { UNIT_TYPES } = require('../../config/militaryUnits');

    let totalPower = 0;
    for (const [unitId, count] of Object.entries(corps.units || {})) {
        const unit = UNIT_TYPES[unitId];
        if (!unit) continue;
        const unitPower = (unit.attack + unit.defense) * count;
        totalPower += unitPower;
    }

    // Apply general bonus or no-general penalty
    if (general) {
        const bonuses = getGeneralBonuses(general);
        totalPower *= (1 + bonuses.attackBonus * 0.5 + bonuses.defenseBonus * 0.5);
    } else {
        totalPower *= NO_GENERAL_PENALTY;
    }

    // Morale modifier: morale 100=full, 0=half power
    const moraleMod = 0.5 + (corps.morale / 100) * 0.5;
    totalPower *= moraleMod;

    return Math.floor(totalPower);
};

/**
 * Find the general assigned to a corps
 * @param {Array<Object>} generals
 * @param {string} corpsId
 * @returns {Object|null}
 */
export const getCorpsGeneral = (generals, corpsId) => {
    return (generals || []).find(g => g.assignedCorpsId === corpsId) || null;
};

// ========== Exports ==========

export { GENERAL_TRAITS, NO_GENERAL_PENALTY, MAX_CORPS_PER_PLAYER, LEVEL_UP_XP };
