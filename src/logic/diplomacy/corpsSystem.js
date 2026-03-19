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

import { UNIT_TYPES } from '../../config/militaryUnits';

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
    '周瑜', '韩勇', '杨毅', '马超', '徐达', '常遇春', '邓艾', '霍去病',
    '卫青', '岳飞', '戚继光', '袁崇焕', '曾国藩', '左宗棠', '冯子材', '聂士成',
];

const NO_GENERAL_PENALTY = 0.85; // -15% combat power without general
const MAX_CORPS_PER_PLAYER = 8;
const LEVEL_UP_XP = [100, 250, 500, 1000, 2000, 4000]; // XP needed for level 1->2, 2->3, etc.
export const CORPS_FRONT_TASKS = {
    assault: {
        id: 'assault',
        name: '主攻',
        shortName: '主攻',
        advanceWeight: 1.25,
        defenseWeight: 0.85,
        raidWeight: 0.75,
        reserveWeight: 0.2,
    },
    guard: {
        id: 'guard',
        name: '守备',
        shortName: '守备',
        advanceWeight: 0.75,
        defenseWeight: 1.3,
        raidWeight: 0.5,
        reserveWeight: 0.35,
    },
    raid: {
        id: 'raid',
        name: '骚扰',
        shortName: '骚扰',
        advanceWeight: 0.7,
        defenseWeight: 0.8,
        raidWeight: 1.45,
        reserveWeight: 0.15,
    },
    reserve: {
        id: 'reserve',
        name: '预备队',
        shortName: '预备',
        advanceWeight: 0.9,
        defenseWeight: 0.95,
        raidWeight: 0.35,
        reserveWeight: 1.2,
    },
};

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

// ========== Trait Derivation from Official ==========

/**
 * 出身阶层 → 基础军事特质映射
 * primary: 主特质, secondary: 备选特质, chance: 获得概率
 */
const STRATUM_TRAIT_MAP = {
    soldier:    { primary: 'aggressive', secondary: 'veteran', chance: 0.6 },
    landowner:  { primary: 'defensive', chance: 0.8 },
    merchant:   { primary: 'logistics', chance: 0.7 },
    navigator:  { primary: 'swift', chance: 0.75 },
    scribe:     { primary: 'cunning', chance: 0.65 },
    engineer:   { primary: 'siege_master', chance: 0.7 },
    cleric:     { primary: 'inspiring', chance: 0.75 },
    capitalist: { primary: 'logistics', chance: 0.6 },
    artisan:    { primary: 'siege_master', chance: 0.55 },
    peasant:    { primary: 'defensive', secondary: 'veteran', chance: 0.5 },
    worker:     { primary: 'veteran', chance: 0.6 },
};

/**
 * 基于官员属性的三层特质推导系统
 *
 * 第一层：出身底色 — sourceStratum → 基础军事倾向
 * 第二层：能力驱动 — 四维属性阈值触发对应特质
 * 第三层：性格映射 — ambition/greed 极端值塑造指挥风格
 *
 * @param {Object} official - 官员对象
 * @param {number} maxTraits - 特质数量上限（由将军等级决定）
 * @returns {string[]} 特质ID数组
 */
export const deriveTraitsFromOfficial = (official, maxTraits = 2) => {
    const traits = new Set();
    const sourceStratum = official.sourceStratum || '';
    const military = official.stats?.military || official.military || 30;
    const administrative = official.stats?.administrative || official.administrative || 30;
    const diplomacyStat = official.stats?.diplomacy || official.diplomacy || 30;
    const prestige = official.stats?.prestige || official.prestige || 30;
    const ambition = official.ambition ?? 50;
    const greed = official.greed ?? 1.0;

    // === 第一层：出身底色 ===
    const stratumEntry = STRATUM_TRAIT_MAP[sourceStratum];
    if (stratumEntry && Math.random() < stratumEntry.chance) {
        if (stratumEntry.secondary && Math.random() < 0.5) {
            traits.add(stratumEntry.secondary);
        } else {
            traits.add(stratumEntry.primary);
        }
    }

    // === 第二层：能力驱动 ===
    if (military >= 70) {
        if (traits.has('aggressive') || traits.has('veteran')) {
            traits.add('veteran');
        } else {
            traits.add('aggressive');
        }
    }
    if (administrative >= 65) traits.add('logistics');
    if (diplomacyStat >= 65) traits.add('cunning');
    if (prestige >= 70) traits.add('inspiring');

    // === 第三层：性格映射 ===
    if (ambition >= 80) traits.add('aggressive');
    else if (ambition <= 20) traits.add('defensive');
    if (greed >= 2.0) traits.add('logistics');
    else if (greed <= 0.5) traits.add('inspiring');

    // === 互斥处理：aggressive 和 defensive 不共存 ===
    if (traits.has('aggressive') && traits.has('defensive')) {
        traits.delete(ambition >= 50 ? 'defensive' : 'aggressive');
    }

    // 截取到上限，优先保留先添加的特质
    return [...traits].slice(0, maxTraits);
};

// ========== General Functions ==========

/**
 * Generate a random general with random traits (AI only)
 * 注意：此函数仅供 AI 敌国使用，玩家侧通过 createGeneralFromOfficial() 获取将军
 * @param {number} epoch - Current epoch affects trait quality
 * @returns {Object} New general object
 */
export const generateGeneral = (epoch = 0) => {
    // Generals require the official system (unlocked at epoch >= 1 / Bronze Age)
    if (epoch < 1) return null;
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
        lastBattleProposalDay: 0,
        proposalCooldownDays: 0,
    };
};

/**
 * Create a general from an existing official (bridge to official system)
 * 玩家获取将军的唯一路径：官员兼任将领，不消耗官员
 * 特质由官员的出身阶层+四维属性+个性三层推导
 *
 * @param {Object} official - Official object with name, sourceStratum, effects, stats, ambition, greed
 * @param {number} epoch - Current epoch
 * @returns {Object} New general object linked to the official
 */
export const createGeneralFromOfficial = (official, epoch = 0) => {
    if (!official) return null;

    const militaryBonus = official.effects?.militaryBonus || 0;
    const militaryStat = official.stats?.military || official.military || 30;

    // 等级推导：基于军事属性 + 时代 + 军事加成效果
    let level = 1 + Math.floor(epoch * 0.3);
    if (militaryStat >= 85) level = Math.max(level, 4);
    else if (militaryStat >= 70) level = Math.max(level, 3);
    else if (militaryStat >= 50) level = Math.max(level, 2);
    if (militaryBonus >= 0.2) level += 1;
    level = Math.min(level, 6);

    // 特质上限由等级决定
    let maxTraits;
    if (level >= 5) maxTraits = 3;
    else if (level >= 3) maxTraits = 2;
    else maxTraits = 1;

    // 三层特质推导
    const traits = deriveTraitsFromOfficial(official, maxTraits);

    return {
        id: generateGeneralId(),
        name: official.name,
        level,
        experience: 0,
        traits,
        assignedCorpsId: null,
        officialId: official.id, // 反向链接到官员（兼任关系）
        lastBattleProposalDay: 0,
        proposalCooldownDays: 0,
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
        frontTask: 'assault',
        status: 'idle', // idle | deployed | in_combat | retreating
        morale: 100,
        autoReplenish: true, // 军团级自动补兵开关，默认跟随全局设置
    };
};

export const getCorpsFrontTask = (corps) => {
    const taskId = corps?.frontTask || 'assault';
    return CORPS_FRONT_TASKS[taskId] || CORPS_FRONT_TASKS.assault;
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

export const selectPrimaryBattleCorps = (corpsList = [], generals = []) => {
    const weighted = corpsList
        .filter(corps => getCorpsTotalUnits(corps) > 0)
        .map((corps) => {
            const task = getCorpsFrontTask(corps);
            const general = getCorpsGeneral(generals, corps.id);
            const totalUnits = getCorpsTotalUnits(corps);
            const moraleFactor = 0.5 + ((corps?.morale ?? 100) / 100) * 0.5;
            const generalFactor = general ? 1 + ((general.level || 1) - 1) * 0.05 : NO_GENERAL_PENALTY;
            const taskWeight = (task.advanceWeight * 0.7) + (task.reserveWeight * 0.2) + (task.raidWeight * 0.1);
            const score = totalUnits * moraleFactor * generalFactor * taskWeight;

            return {
                corps,
                general,
                task,
                score,
                reason: `${task.name}优先，兵力${totalUnits}，士气${Math.round(corps?.morale ?? 100)}`,
            };
        })
        .sort((a, b) => b.score - a.score);

    return weighted[0] || null;
};

/**
 * Calculate replenish priority for a corps.
 * Higher score = higher priority for receiving replacement units.
 *
 * Factors:
 * - Deployed to active front: +100
 * - Deficit ratio (deficit / total capacity): up to +80
 * - Earlier created corps: small bonus
 *
 * @param {Object} corps - Corps object
 * @param {Object} corpsDeficits - { unitId: deficitCount } for this corps
 * @param {Array} activeFronts - List of active fronts
 * @returns {number} Priority score (higher = more urgent)
 */
export const getCorpsReplenishPriority = (corps, corpsDeficits, activeFronts = []) => {
    if (!corps || !corpsDeficits) return 0;
    let score = 0;

    // Deployed to active front bonus
    const isDeployed = corps.assignedFrontId &&
        activeFronts.some(f => f.id === corps.assignedFrontId && f.status === 'active');
    if (isDeployed) score += 100;

    // Deficit ratio: higher deficit = higher priority
    const totalDeficit = Object.values(corpsDeficits).reduce((s, c) => s + (c || 0), 0);
    const currentUnits = Object.values(corps.units || {}).reduce((s, c) => s + (c || 0), 0);
    const originalCapacity = currentUnits + totalDeficit;
    if (originalCapacity > 0) {
        const deficitRatio = totalDeficit / originalCapacity;
        score += deficitRatio * 80; // up to +80 for 100% deficit
    }

    // Earlier corps gets slight priority (use id as proxy for creation order)
    const idNum = parseInt((corps.id || '').replace(/\D/g, '').slice(-4) || '0');
    score += Math.max(0, 10 - (idNum % 100) * 0.1);

    return score;
};

/**
 * Find the best corps to receive a replenishment unit.
 *
 * @param {string} unitId - The unit type being replenished
 * @param {Object} corpsReplenishQueue - { corpsId: { unitId: deficitCount } }
 * @param {Array} allCorps - All player corps
 * @param {Array} activeFronts - Active fronts
 * @returns {{ corpsId: string, corps: Object } | null} Best target corps, or null
 */
export const findBestReplenishTarget = (unitId, corpsReplenishQueue, allCorps, activeFronts = []) => {
    const candidates = [];

    for (const [corpsId, deficits] of Object.entries(corpsReplenishQueue || {})) {
        const deficit = deficits[unitId] || 0;
        if (deficit <= 0) continue;

        const corps = allCorps.find(c => c.id === corpsId);
        if (!corps) continue;
        if (corps.isAI) continue;
        // Skip if corps auto-replenish is disabled
        if (corps.autoReplenish === false) continue;

        const priority = getCorpsReplenishPriority(corps, deficits, activeFronts);
        candidates.push({ corpsId, corps, deficit, priority });
    }

    if (candidates.length === 0) return null;

    // Sort by priority descending, then by deficit for this unit type descending
    candidates.sort((a, b) => {
        if (b.priority !== a.priority) return b.priority - a.priority;
        return b.deficit - a.deficit;
    });

    return candidates[0];
};

// ========== Exports ==========

export { GENERAL_TRAITS, NO_GENERAL_PENALTY, MAX_CORPS_PER_PLAYER, LEVEL_UP_XP };
