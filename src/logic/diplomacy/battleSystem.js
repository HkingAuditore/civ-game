/**
 * Battle System - Duration-based Combat
 *
 * Replaces instant combat resolution with a multi-round battle process.
 * Battles progress one round per game tick, allowing player intervention,
 * economic impacts, and more nuanced tactical gameplay.
 *
 * Battle types:
 * - skirmish: 3-5 rounds, small engagements
 * - pitched_battle: 10-30 rounds, major field battles
 * - siege: 30-90 rounds, fortification assaults
 *
 * Each round:
 * 1. Calculate combat power with counter bonuses
 * 2. Apply general bonuses
 * 3. Resolve casualties
 * 4. Update momentum
 * 5. Check supply consumption
 * 6. Check battle end conditions
 */

import { UNIT_TYPES } from '../../config/militaryUnits';
import { getGeneralBonuses, NO_GENERAL_PENALTY } from './corpsSystem';

// ========== Constants ==========

const BATTLE_TYPES = {
    skirmish: { name: '遭遇战', minRounds: 3, maxRounds: 5, baseIntensity: 0.6 },
    pitched_battle: { name: '会战', minRounds: 10, maxRounds: 30, baseIntensity: 1.0 },
    siege: { name: '围城', minRounds: 30, maxRounds: 90, baseIntensity: 0.4 },
};

// Momentum thresholds
const MOMENTUM_ROUT_THRESHOLD = 80; // Momentum > 80 triggers rout
const MOMENTUM_NEUTRAL = 50;
const MORALE_COLLAPSE_THRESHOLD = 15; // Below this, side collapses

// Supply cost per unit per round
const BASE_SUPPLY_COST = {
    food: 0.5,   // Per unit per round
    silver: 0.3, // Per unit per round
};

// Tactic modifiers
const TACTICS = {
    normal: { name: '正常作战', attackMod: 1.0, defenseMod: 1.0, desc: '平衡进攻与防守' },
    focus_attack: { name: '集中攻击', attackMod: 1.25, defenseMod: 0.8, desc: '攻击+25%, 防御-20%' },
    defensive: { name: '防御姿态', attackMod: 0.8, defenseMod: 1.3, desc: '防御+30%, 攻击-20%' },
    retreat: { name: '有序撤退', attackMod: 0.4, defenseMod: 0.6, retreatRounds: 2, desc: '准备撤退，1-3回合后脱离战斗' },
};

let battleIdCounter = 0;

// ========== Battle Creation ==========

/**
 * Create a new battle between two corps on a front
 * @param {Object} params
 * @param {Object} params.attackerCorps - Attacking corps object
 * @param {Object} params.defenderCorps - Defending corps object
 * @param {Object|null} params.attackerGeneral - Attacker's general (or null)
 * @param {Object|null} params.defenderGeneral - Defender's general (or null)
 * @param {Object} params.front - The front where battle takes place
 * @param {string} params.battleType - 'skirmish' | 'pitched_battle' | 'siege'
 * @param {number} params.epoch - Current epoch
 * @param {number} params.currentDay - Current game day
 * @returns {Object} New battle object
 */
export const createBattle = ({
    attackerCorps,
    defenderCorps,
    attackerGeneral = null,
    defenderGeneral = null,
    front,
    battleType = 'pitched_battle',
    epoch = 0,
    currentDay = 0,
}) => {
    // [FIX] Validate both sides have units > 0
    const atkTotal = Object.values(attackerCorps?.units || {}).reduce((s, c) => s + (c || 0), 0);
    const defTotal = Object.values(defenderCorps?.units || {}).reduce((s, c) => s + (c || 0), 0);
    if (atkTotal <= 0 || defTotal <= 0) {
        console.warn(`[battleSystem] createBattle blocked: attacker=${atkTotal}, defender=${defTotal} units`);
        return null;
    }

    // [FIX] Auto-downgrade to skirmish when force ratio > 10:1
    const forceRatio = Math.max(atkTotal, defTotal) / Math.max(1, Math.min(atkTotal, defTotal));
    if (forceRatio > 10 && battleType === 'siege') {
        battleType = 'skirmish';
    }

    battleIdCounter++;
    const type = BATTLE_TYPES[battleType] || BATTLE_TYPES.pitched_battle;
    const maxRounds = type.minRounds + Math.floor(Math.random() * (type.maxRounds - type.minRounds));

    return {
        id: `battle_${Date.now()}_${battleIdCounter}`,
        frontId: front?.id || null,
        battleType,
        typeName: type.name,
        startDay: currentDay,
        currentRound: 0,
        maxRounds,
        status: 'active', // active | rout | retreat_attacker | retreat_defender | ended

        // Participants
        attacker: {
            corpsId: attackerCorps.id,
            corpsName: attackerCorps.name,
            initialUnits: { ...attackerCorps.units },
            currentUnits: { ...attackerCorps.units },
            generalId: attackerGeneral?.id || null,
            generalName: attackerGeneral?.name || null,
            tactic: 'normal',
            retreatCountdown: -1,
            morale: attackerCorps.morale || 100,
            totalCasualties: {},
        },
        defender: {
            corpsId: defenderCorps.id,
            corpsName: defenderCorps.name,
            initialUnits: { ...defenderCorps.units },
            currentUnits: { ...defenderCorps.units },
            generalId: defenderGeneral?.id || null,
            generalName: defenderGeneral?.name || null,
            tactic: 'normal',
            retreatCountdown: -1,
            morale: defenderCorps.morale || 100,
            totalCasualties: {},
        },

        // Battlefield state
        momentum: MOMENTUM_NEUTRAL, // 0=defender dominates, 100=attacker dominates
        intensity: type.baseIntensity,
        epoch,

        // Round-by-round log
        roundLog: [],

        // Supply tracking
        supplyConsumed: {
            attacker: {},
            defender: {},
        },

        // Result (filled when battle ends)
        result: null,
    };
};

// ========== Combat Round Processing ==========

/**
 * Process one combat round
 * @param {Object} battle - The battle object
 * @param {Object|null} attackerGeneral - Full general object
 * @param {Object|null} defenderGeneral - Full general object
 * @returns {Object} Updated battle object (new reference)
 */
export const processCombatRound = (battle, attackerGeneral = null, defenderGeneral = null) => {
    if (battle.status !== 'active') return battle;

    const b = JSON.parse(JSON.stringify(battle)); // Deep clone
    b.currentRound += 1;

    const roundEntry = { round: b.currentRound, events: [] };

    // 1. Calculate each side's combat power
    const atkPower = calculateSidePower(b.attacker, attackerGeneral, b.epoch, 'attacker');
    const defPower = calculateSidePower(b.defender, defenderGeneral, b.epoch, 'defender');

    // 2. Apply tactic modifiers
    const atkTactic = TACTICS[b.attacker.tactic] || TACTICS.normal;
    const defTactic = TACTICS[b.defender.tactic] || TACTICS.normal;

    const effectiveAtkAttack = atkPower.attack * atkTactic.attackMod;
    const effectiveAtkDefense = atkPower.defense * atkTactic.defenseMod;
    const effectiveDefAttack = defPower.attack * defTactic.attackMod;
    const effectiveDefDefense = defPower.defense * defTactic.defenseMod;

    // 3. Calculate exchange ratio (who deals more damage)
    const atkDamage = Math.max(1, effectiveAtkAttack - effectiveDefDefense * 0.3);
    const defDamage = Math.max(1, effectiveDefAttack - effectiveAtkDefense * 0.3);

    // 4. Random variance (±15%)
    const atkRoll = 0.85 + Math.random() * 0.3;
    const defRoll = 0.85 + Math.random() * 0.3;

    const actualAtkDamage = atkDamage * atkRoll * b.intensity;
    const actualDefDamage = defDamage * defRoll * b.intensity;

    // 5. Apply casualties
    const atkCasualties = applyCasualties(b.defender, actualAtkDamage, b.epoch);
    const defCasualties = applyCasualties(b.attacker, actualDefDamage, b.epoch);

    // Track total casualties
    for (const [uid] of Object.entries(atkCasualties)) {
        b.attacker.totalCasualties[uid] = (b.attacker.totalCasualties[uid] || 0);
    }
    for (const [uid] of Object.entries(defCasualties)) {
        b.defender.totalCasualties[uid] = (b.defender.totalCasualties[uid] || 0);
    }
    // The casualties arrays are losses inflicted ON the enemy
    for (const [uid, count] of Object.entries(atkCasualties)) {
        b.defender.totalCasualties[uid] = (b.defender.totalCasualties[uid] || 0) + count;
    }
    for (const [uid, count] of Object.entries(defCasualties)) {
        b.attacker.totalCasualties[uid] = (b.attacker.totalCasualties[uid] || 0) + count;
    }

    // 6. Update momentum (capped per round to prevent instant rout)
    const totalDamage = actualAtkDamage + actualDefDamage;
    if (totalDamage > 0) {
        const rawMomentumShift = ((actualAtkDamage / totalDamage) - 0.5) * 15;
        const clampedShift = Math.max(-8, Math.min(8, rawMomentumShift));
        b.momentum = Math.max(0, Math.min(100, b.momentum + clampedShift));
    }

    // 7. Update morale
    const atkUnitCount = getTotalUnits(b.attacker.currentUnits);
    const defUnitCount = getTotalUnits(b.defender.currentUnits);
    const atkInitialCount = getTotalUnits(b.attacker.initialUnits);
    const defInitialCount = getTotalUnits(b.defender.initialUnits);

    // Morale drops when losing units and when momentum is against you
    const atkCasualtyRatio = atkInitialCount > 0 ? 1 - (atkUnitCount / atkInitialCount) : 1;
    const defCasualtyRatio = defInitialCount > 0 ? 1 - (defUnitCount / defInitialCount) : 1;

    b.attacker.morale = Math.max(0, 100 - atkCasualtyRatio * 60 - Math.max(0, (100 - b.momentum) - 50) * 0.5);
    b.defender.morale = Math.max(0, 100 - defCasualtyRatio * 60 - Math.max(0, b.momentum - 50) * 0.5);

    // 8. Log round events
    const atkLossTotal = Object.values(defCasualties).reduce((s, c) => s + c, 0);
    const defLossTotal = Object.values(atkCasualties).reduce((s, c) => s + c, 0);
    roundEntry.events.push(`攻方损失 ${atkLossTotal} 单位, 守方损失 ${defLossTotal} 单位`);
    roundEntry.events.push(`态势: ${b.momentum.toFixed(0)}/100 (${b.momentum > 55 ? '攻方优势' : b.momentum < 45 ? '守方优势' : '胶着'})`);
    roundEntry.attackerLosses = defCasualties;
    roundEntry.defenderLosses = atkCasualties;
    roundEntry.momentum = b.momentum;
    roundEntry.attackerMorale = b.attacker.morale;
    roundEntry.defenderMorale = b.defender.morale;

    b.roundLog.push(roundEntry);

    // 9. Handle retreat countdowns
    if (b.attacker.retreatCountdown > 0) {
        b.attacker.retreatCountdown -= 1;
        if (b.attacker.retreatCountdown <= 0) {
            b.status = 'retreat_attacker';
        }
    }
    if (b.defender.retreatCountdown > 0) {
        b.defender.retreatCountdown -= 1;
        if (b.defender.retreatCountdown <= 0) {
            b.status = 'retreat_defender';
        }
    }

    // 10. Check end conditions
    if (b.status === 'active') {
        if (atkUnitCount <= 0) {
            b.status = 'ended';
            b.result = { winner: 'defender', reason: 'annihilation' };
        } else if (defUnitCount <= 0) {
            b.status = 'ended';
            b.result = { winner: 'attacker', reason: 'annihilation' };
        } else if (b.attacker.morale <= MORALE_COLLAPSE_THRESHOLD) {
            b.status = 'ended';
            b.result = { winner: 'defender', reason: 'morale_collapse' };
        } else if (b.defender.morale <= MORALE_COLLAPSE_THRESHOLD) {
            b.status = 'ended';
            b.result = { winner: 'attacker', reason: 'morale_collapse' };
        } else if (b.momentum >= MOMENTUM_ROUT_THRESHOLD && b.currentRound >= Math.max(5, Math.floor(b.maxRounds * 0.3))) {
            b.status = 'rout';
            b.result = { winner: 'attacker', reason: 'rout' };
        } else if (b.momentum <= (100 - MOMENTUM_ROUT_THRESHOLD) && b.currentRound >= Math.max(5, Math.floor(b.maxRounds * 0.3))) {
            b.status = 'rout';
            b.result = { winner: 'defender', reason: 'rout' };
        } else if (b.currentRound >= b.maxRounds) {
            // Time limit reached - side with momentum advantage wins
            b.status = 'ended';
            b.result = {
                winner: b.momentum >= 50 ? 'attacker' : 'defender',
                reason: 'timeout',
            };
        }
    }

    // 11. Finalize result if ended
    if (b.result && !b.result.finalized) {
        b.result.finalized = true;
        b.result.totalRounds = b.currentRound;
        b.result.finalMomentum = b.momentum;
        b.result.attackerSurvivors = { ...b.attacker.currentUnits };
        b.result.defenderSurvivors = { ...b.defender.currentUnits };
        b.result.attackerCasualties = { ...b.attacker.totalCasualties };
        b.result.defenderCasualties = { ...b.defender.totalCasualties };
    }

    return b;
};

// ========== Tactical Orders ==========

/**
 * Set a tactic for one side of a battle
 * @param {Object} battle
 * @param {'attacker'|'defender'} side
 * @param {string} tacticId - 'normal' | 'focus_attack' | 'defensive' | 'retreat'
 * @returns {Object} Updated battle
 */
export const setTacticOrder = (battle, side, tacticId) => {
    const b = { ...battle, [side]: { ...battle[side] } };
    b[side].tactic = tacticId;

    // If retreat, set countdown
    if (tacticId === 'retreat') {
        b[side].retreatCountdown = 1 + Math.floor(Math.random() * 3); // 1-3 rounds
    } else {
        b[side].retreatCountdown = -1;
    }

    return b;
};

/**
 * Process reinforcement arrival (add units to one side mid-battle)
 * @param {Object} battle
 * @param {'attacker'|'defender'} side
 * @param {Object} reinforcementUnits - { unitId: count }
 * @returns {Object} Updated battle
 */
export const processReinforcement = (battle, side, reinforcementUnits) => {
    const b = { ...battle, [side]: { ...battle[side], currentUnits: { ...battle[side].currentUnits } } };

    for (const [unitId, count] of Object.entries(reinforcementUnits)) {
        b[side].currentUnits[unitId] = (b[side].currentUnits[unitId] || 0) + count;
    }

    // Morale boost from reinforcements
    b[side].morale = Math.min(100, b[side].morale + 10);

    b.roundLog.push({
        round: b.currentRound,
        events: [`${side === 'attacker' ? '攻方' : '守方'} 援军抵达！`],
        isReinforcement: true,
    });

    return b;
};

// ========== Supply Calculation ==========

/**
 * Calculate supply cost for one round of battle
 * @param {Object} battle
 * @param {'attacker'|'defender'} side
 * @param {number} epoch
 * @returns {Object} { food, silver, [gunpowder], [ammunition] }
 */
export const calculateRoundSupplyCost = (battle, side, epoch) => {
    const units = battle[side].currentUnits;
    const totalUnits = getTotalUnits(units);
    const cost = {
        food: Math.ceil(totalUnits * BASE_SUPPLY_COST.food),
        silver: Math.ceil(totalUnits * BASE_SUPPLY_COST.silver),
    };

    // Higher epochs need ammunition/gunpowder
    if (epoch >= 4) {
        // Check for gunpowder units
        let gunpowderUnits = 0;
        for (const [unitId, count] of Object.entries(units)) {
            const unit = UNIT_TYPES[unitId];
            if (unit?.category === 'gunpowder') gunpowderUnits += count;
        }
        if (gunpowderUnits > 0) {
            cost.gunpowder = Math.ceil(gunpowderUnits * 0.3);
        }
    }
    if (epoch >= 5) {
        let firearmUnits = 0;
        for (const [unitId, count] of Object.entries(units)) {
            const unit = UNIT_TYPES[unitId];
            if (unit?.category === 'gunpowder') firearmUnits += count;
        }
        if (firearmUnits > 0) {
            cost.ammunition = Math.ceil(firearmUnits * 0.4);
        }
    }

    // Overtime: supply costs increase after expected duration
    const type = BATTLE_TYPES[battle.battleType];
    if (type && battle.currentRound > type.maxRounds * 0.7) {
        const overtime = 1 + (battle.currentRound - type.maxRounds * 0.7) * 0.1;
        for (const key of Object.keys(cost)) {
            cost[key] = Math.ceil(cost[key] * overtime);
        }
    }

    return cost;
};

/**
 * Apply supply penalty when resources are insufficient
 * Returns a debuff multiplier (0.7 = 30% penalty)
 * @param {boolean} hasEnoughSupply
 * @returns {number}
 */
export const getSupplyPenalty = (hasEnoughSupply) => {
    return hasEnoughSupply ? 1.0 : 0.7; // -30% attack, -20% defense
};

// ========== Internal Helpers ==========

/**
 * Calculate combat power for one side
 */
const calculateSidePower = (sideData, general, epoch, role) => {
    let totalAttack = 0;
    let totalDefense = 0;

    for (const [unitId, count] of Object.entries(sideData.currentUnits)) {
        if (count <= 0) continue;
        const unit = UNIT_TYPES[unitId];
        if (!unit) continue;
        totalAttack += unit.attack * count;
        totalDefense += unit.defense * count;
    }

    // Apply general bonuses
    if (general) {
        const bonuses = getGeneralBonuses(general);
        totalAttack *= (1 + bonuses.attackBonus);
        totalDefense *= (1 + bonuses.defenseBonus);
    } else {
        totalAttack *= NO_GENERAL_PENALTY;
        totalDefense *= NO_GENERAL_PENALTY;
    }

    // Defender gets a small innate defense bonus
    if (role === 'defender') {
        totalDefense *= 1.15;
    }

    // Morale modifier
    const moraleMod = 0.6 + (sideData.morale / 100) * 0.4;
    totalAttack *= moraleMod;
    totalDefense *= moraleMod;

    return { attack: totalAttack, defense: totalDefense };
};

/**
 * Apply casualties to a side based on incoming damage
 * Returns the casualties inflicted { unitId: count }
 */
const applyCasualties = (targetSide, damage, _Epoch) => {
    const casualties = {};
    const units = targetSide.currentUnits;
    const totalHP = getTotalHP(units);

    if (totalHP <= 0 || damage <= 0) return casualties;

    // Distribute damage proportionally across unit types
    const damageRatio = Math.min(0.4, damage / totalHP); // Max 40% casualties per round

    for (const [unitId, count] of Object.entries(units)) {
        if (count <= 0) continue;
        const unit = UNIT_TYPES[unitId];
        if (!unit) continue;

        const unitHP = (unit.attack + unit.defense) * count;
        const share = unitHP / totalHP;
        const unitDamage = damage * share;

        // Convert damage to killed units
        const unitDurability = unit.attack + unit.defense;
        let killed = Math.floor(unitDamage / Math.max(1, unitDurability) * damageRatio);
        killed = Math.min(killed, count);

        if (killed > 0) {
            casualties[unitId] = killed;
            targetSide.currentUnits[unitId] = count - killed;
            if (targetSide.currentUnits[unitId] <= 0) {
                delete targetSide.currentUnits[unitId];
            }
        }
    }

    return casualties;
};

/**
 * Get total unit count
 */
const getTotalUnits = (units) => {
    return Object.values(units || {}).reduce((sum, c) => sum + c, 0);
};

/**
 * Get total "HP" (sum of attack+defense * count for all units)
 */
const getTotalHP = (units) => {
    let total = 0;
    for (const [unitId, count] of Object.entries(units || {})) {
        const unit = UNIT_TYPES[unitId];
        if (unit) total += (unit.attack + unit.defense) * count;
    }
    return total;
};

/**
 * Check if a battle is still active
 * @param {Object} battle
 * @returns {boolean}
 */
export const isBattleActive = (battle) => {
    return battle && battle.status === 'active';
};

/**
 * Get a human-readable battle status
 * @param {Object} battle
 * @returns {string}
 */
export const getBattleStatusText = (battle) => {
    if (!battle) return '未知';
    switch (battle.status) {
        case 'active': return `进行中 (第${battle.currentRound}/${battle.maxRounds}回合)`;
        case 'rout': return '溃败';
        case 'retreat_attacker': return '攻方撤退';
        case 'retreat_defender': return '守方撤退';
        case 'ended': {
            const reason = battle.result?.reason;
            if (reason === 'annihilation') return '全歼';
            if (reason === 'morale_collapse') return '士气崩溃';
            if (reason === 'timeout') return '时间耗尽';
            return '已结束';
        }
        default: return battle.status;
    }
};

// ========== Exports ==========

export { BATTLE_TYPES, TACTICS, MOMENTUM_ROUT_THRESHOLD, MORALE_COLLAPSE_THRESHOLD };
