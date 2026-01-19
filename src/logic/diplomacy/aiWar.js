/**
 * AI War Module
 * Handles AI military actions, rebel raids, and war-related logic
 * Extracted from simulation.js for better code organization
 */

import { simulateBattle, UNIT_TYPES } from '../../config/militaryUnits';
import { getEnemyUnitsForEpoch } from '../../config/militaryActions';
import {
    calculateAIPeaceTribute,
    calculateAISurrenderDemand
} from '../../utils/diplomaticUtils';
import {
    clamp,
    PEACE_REQUEST_COOLDOWN_DAYS,
    GLOBAL_PEACE_REQUEST_COOLDOWN_DAYS,
    MAX_CONCURRENT_WARS,
    GLOBAL_WAR_COOLDOWN
} from '../utils';
import {
    DEFAULT_DIFFICULTY,
    applyWarDeclarationModifier,
    applyMilitaryActionModifier,
    getMinWarEpoch,
    getMilitaryCooldownBonus,
    applyRaidDamageModifier,
    applyPopulationLossModifier,
    isInGracePeriod,
} from '../../config/difficulty';
import { VASSAL_TYPE_CONFIGS } from '../../config/diplomacy';
import { requiresVassalDiplomacyApproval, buildVassalDiplomacyRequest } from './vassalSystem';

const applyTreasuryChange = (resources, delta, reason, onTreasuryChange) => {
    if (!resources || !Number.isFinite(delta) || delta === 0) return 0;
    const before = Number(resources.silver || 0);
    const after = Math.max(0, before + delta);
    const actual = after - before;
    resources.silver = after;
    if (typeof onTreasuryChange === 'function' && actual !== 0) {
        onTreasuryChange(actual, reason);
    }
    return actual;
};

/**
 * Helper: Apply resource change and optionally invoke callback for tracking
 * @param {Object} resources - Player resources object (mutable)
 * @param {string} resourceType - Resource type (e.g., 'food', 'wood', 'silver')
 * @param {number} delta - Amount to change (positive for gain, negative for loss)
 * @param {string} reason - Reason for the change (for tracking)
 * @param {Function} onResourceChange - Optional callback (delta, reason, resourceType)
 */
const applyResourceChange = (resources, resourceType, delta, reason, onResourceChange) => {
    if (!resources || !Number.isFinite(delta) || delta === 0) return 0;
    const before = Number(resources[resourceType] || 0);
    const after = Math.max(0, before + delta);
    const actual = after - before;
    resources[resourceType] = after;
    if (typeof onResourceChange === 'function' && actual !== 0) {
        onResourceChange(actual, reason, resourceType);
    }
    return actual;
};

const areNationsAllied = (id1, id2, organizations) => {
    if (!organizations) return false;
    return organizations.some(org =>
        org.type === 'military_alliance' &&
        org.members.includes(id1) &&
        org.members.includes(id2)
    );
};

const getAllianceMembers = (nationId, organizations) => {
    if (!Array.isArray(organizations)) return [];
    const members = new Set();
    organizations.forEach(org => {
        if (!org || org.type !== 'military_alliance') return;
        if (!Array.isArray(org.members) || !org.members.includes(nationId)) return;
        org.members.forEach(id => {
            if (id && id !== nationId) members.add(id);
        });
    });
    return Array.from(members);
};

/**
 * Process rebel nation war actions (raids and surrender demands)
 * @param {Object} params - Parameters
 * @param {Object} params.nation - The rebel nation object (mutable)
 * @param {number} params.tick - Current game tick
 * @param {number} params.epoch - Current epoch
 * @param {Object} params.resources - Player resources (mutable)
 * @param {Object} params.army - Player army (mutable)
 * @param {Array} params.logs - Log array to append messages (mutable)
 * @returns {Object} Result containing raidPopulationLoss
 */
export const processRebelWarActions = ({
    nation,
    tick,
    epoch,
    resources,
    population,
    army,
    logs,
    onTreasuryChange,
    onResourceChange,
}) => {
    let raidPopulationLoss = 0;
    const res = resources;
    const next = nation;

    if (!next.isAtWar) {
        return { raidPopulationLoss };
    }

    next.warDuration = (next.warDuration || 0) + 1;

    // Rebel raid logic - higher raid chance (25% base + aggression bonus)
    const rebelAggression = next.aggression ?? 0.7;
    const raidChance = Math.min(0.35, 0.25 + rebelAggression * 0.1);

    if (Math.random() < raidChance) {
        // console.log(`[REBEL RAID] ${next.name} 发动突袭！概率: ${(raidChance * 100).toFixed(1)}%`);

        const militaryStrength = next.militaryStrength ?? 1.0;
        const raidStrength = 0.08 + rebelAggression * 0.05;

        // Generate rebel raid army
        const attackerArmy = {};
        const raidUnits = getEnemyUnitsForEpoch(epoch, 'light');
        const baseUnitCount = 3 + Math.random() * 5;
        const totalUnits = Math.floor(baseUnitCount * militaryStrength);

        raidUnits.forEach(unitId => {
            if (UNIT_TYPES[unitId]) {
                const count = Math.floor((totalUnits / raidUnits.length) * (0.5 + Math.random() * 0.8));
                if (count > 0) attackerArmy[unitId] = count;
            }
        });

        const defenderArmy = { ...army };
        const totalDefenders = Object.values(defenderArmy).reduce((sum, c) => sum + c, 0);

        let foodLoss = 0, silverLoss = 0, popLoss = 0;
        let battleResult = { victory: true, attackerLosses: {}, defenderLosses: {} };

        if (totalDefenders === 0) {
            // No defense - raid succeeds
            foodLoss = Math.floor((res.food || 0) * raidStrength);
            silverLoss = Math.floor((res.silver || 0) * (raidStrength / 2));
            popLoss = Math.min(5, Math.max(1, Math.floor(raidStrength * 25)));
        } else {
            // Battle simulation
            battleResult = simulateBattle(
                { army: attackerArmy, epoch, militaryBuffs: 0.1 },
                { army: defenderArmy, epoch, militaryBuffs: 0 }
            );

            if (battleResult.victory) {
                foodLoss = Math.floor((res.food || 0) * raidStrength);
                silverLoss = Math.floor((res.silver || 0) * (raidStrength / 2));
                popLoss = Math.min(5, Math.max(1, Math.floor(raidStrength * 25)));
            }

            // Apply player army losses and record for auto-replenishment
            const playerLosses = battleResult.defenderLosses || {};
            const actualLosses = {};
            Object.entries(playerLosses).forEach(([unitId, count]) => {
                if (army[unitId]) {
                    const removed = Math.min(army[unitId], count);
                    army[unitId] = Math.max(0, army[unitId] - removed);
                    if (removed > 0) actualLosses[unitId] = removed;
                }
            });
            // Record losses in log for auto-replenishment processing
            if (Object.keys(actualLosses).length > 0) {
                logs.push(`AUTO_REPLENISH_LOSSES:${JSON.stringify(actualLosses)}`);
            }
        }

        // Apply resource losses
        if (foodLoss > 0) applyResourceChange(res, 'food', -foodLoss, 'rebel_raid_loss', onResourceChange);
        if (silverLoss > 0) applyTreasuryChange(res, -silverLoss, 'rebel_raid_loss', onTreasuryChange);
        if (popLoss > 0) raidPopulationLoss += popLoss;

        // Adjust war score
        next.warScore = (next.warScore || 0) + (battleResult.victory ? -8 : 6);

        // Generate raid event log
        const raidData = {
            nationName: next.name,
            victory: !battleResult.victory,
            attackerArmy,
            defenderArmy,
            attackerLosses: battleResult.attackerLosses || {},
            defenderLosses: battleResult.defenderLosses || {},
            foodLoss,
            silverLoss,
            popLoss,
            ourPower: battleResult.defenderPower || 0,
            enemyPower: battleResult.attackerPower || 0,
            battleReport: battleResult.battleReport || [],
            actionType: 'raid',
            actionName: '叛军突袭',
        };
        logs.push(`❗RAID_EVENT❗${JSON.stringify(raidData)}`);
    }

    // Rebel surrender demand - when rebels are winning
    const rebelWarAdvantage = -(next.warScore || 0);
    if (rebelWarAdvantage > 50 && (next.warDuration || 0) > 20) {
        const lastRebelDemandDay = next.lastSurrenderDemandDay || 0;
        if (tick - lastRebelDemandDay >= 30 && Math.random() < 0.05) {
            next.lastSurrenderDemandDay = tick;

            const currentSilver = res.silver || 0;

            // 始终计算所有三种要求类型，让玩家自行选择
            // 屠杀要求：基于人口比例或战争优势
            const massacrePopBase = Math.floor((population || 0) * 0.05);
            const massacreScoreBase = Math.floor(rebelWarAdvantage / 4);
            const maxPopCost = Math.max(0, (population || 100) - 10);
            const massacreAmount = Math.min(Math.max(massacrePopBase, massacreScoreBase, 10), maxPopCost);

            // 改革妥协：10% 现有银币，最低 100（一次性支付，转入阶层财富）
            const reformAmount = Math.max(100, Math.floor(currentSilver * 0.1));

            // 强制补贴：改革金额的3倍，分365天支付（每日支付）
            const subsidyTotalAmount = reformAmount * 3;
            const subsidyDailyAmount = Math.ceil(subsidyTotalAmount / 365);

            // 根据战争优势确定"推荐"的要求类型（用于描述严重程度）
            let primaryDemandType = 'reform';
            if (rebelWarAdvantage > 200) {
                primaryDemandType = 'massacre';
            } else if (rebelWarAdvantage > 100) {
                primaryDemandType = 'concession';
            }

            logs.push(`REBEL_DEMAND_SURRENDER:${JSON.stringify({
                nationId: next.id,
                nationName: next.name,
                rebellionStratum: next.rebellionStratum,
                coalitionStrata: next.coalitionStrata || [next.rebellionStratum], // 联盟叛乱的所有参与阶层
                warScore: next.warScore,
                warAdvantage: rebelWarAdvantage,
                primaryDemandType,
                // 传递所有三种选项的金额
                massacreAmount,
                reformAmount,
                subsidyTotalAmount,
                subsidyDailyAmount
            })}`);
        }
    }


    return { raidPopulationLoss };
};

/**
 * Check if rebel should request peace/surrender
 * @param {Object} params - Parameters
 * @param {Object} params.nation - The rebel nation object (mutable)
 * @param {number} params.tick - Current game tick
 * @param {Array} params.logs - Log array (mutable)
 */
export const checkRebelSurrender = ({
    nation,
    tick,
    logs,
}) => {
    const next = nation;
    const rebelWarScore = next.warScore || 0;
    const rebelWarDuration = next.warDuration || 0;
    const lastRebelPeaceRequest = Number.isFinite(next.lastPeaceRequestDay) ? next.lastPeaceRequestDay : -Infinity;
    const canRebelRequestPeace = (tick - lastRebelPeaceRequest) >= 30;

    if (canRebelRequestPeace && !next.isPeaceRequesting) {
        const desperationLevel = Math.max(0, rebelWarScore - 20) / 100 + Math.max(0, rebelWarDuration - 60) / 500;
        const surrenderChance = Math.min(0.4, desperationLevel * 0.5);

        if (rebelWarScore > 30 && Math.random() < surrenderChance) {
            next.isPeaceRequesting = true;
            next.peaceTribute = 0;
            next.lastPeaceRequestDay = tick;
            logs.push(`🏳️ ${next.name} 已陷入绝境，请求投降！`);
        } else if (rebelWarScore > 60 && rebelWarDuration > 90) {
            next.isPeaceRequesting = true;
            next.peaceTribute = 0;
            next.lastPeaceRequestDay = tick;
            logs.push(`🏳️ ${next.name} 已经崩溃，恳求投降！`);
        }
    }
};

/**
 * Process AI nation military action against player
 * @param {Object} params - Parameters
 * @param {Object} params.nation - AI nation object (mutable)
 * @param {number} params.tick - Current game tick
 * @param {number} params.epoch - Current epoch
 * @param {Object} params.resources - Player resources (mutable)
 * @param {Object} params.army - Player army (mutable)
 * @param {Array} params.logs - Log array (mutable)
 * @returns {Object} Result containing raidPopulationLoss
 */
export const processAIMilitaryAction = ({
    nation,
    tick,
    epoch,
    resources,
    army,
    logs,
    difficultyLevel = DEFAULT_DIFFICULTY,
    onTreasuryChange,
    onResourceChange,
}) => {
    let raidPopulationLoss = 0;
    const next = nation;
    const res = resources;

    // Only process in epoch 1+
    if (epoch < 1) return { raidPopulationLoss };

    // Skip military actions during grace period (easy mode)
    if (isInGracePeriod(tick, difficultyLevel)) {
        return { raidPopulationLoss };
    }

    // Military action cooldown check (with difficulty bonus)
    const lastMilitaryActionDay = next.lastMilitaryActionDay || 0;
    const cooldownBonus = getMilitaryCooldownBonus(difficultyLevel);
    if (!next.militaryCooldownDays) {
        next.militaryCooldownDays = Math.max(5, 7 + Math.floor(Math.random() * 24) + cooldownBonus);
    }
    const canTakeMilitaryAction = (tick - lastMilitaryActionDay) >= next.militaryCooldownDays;

    const disadvantage = Math.max(0, -(next.warScore || 0));
    let actionChance = Math.min(0.18, 0.02 + (next.aggression || 0.2) * 0.04 + disadvantage / 400);

    // Apply difficulty modifier to action chance
    actionChance = applyMilitaryActionModifier(actionChance, difficultyLevel);

    if (!canTakeMilitaryAction || Math.random() >= actionChance) {
        return { raidPopulationLoss };
    }

    // Record action time and reset cooldown (with difficulty bonus)
    next.lastMilitaryActionDay = tick;
    next.militaryCooldownDays = Math.max(5, 7 + Math.floor(Math.random() * 24) + cooldownBonus);

    // Generate enemy army
    const enemyEpoch = Math.max(next.appearEpoch || 0, Math.min(epoch, next.expireEpoch ?? epoch));
    const militaryStrength = next.militaryStrength ?? 1.0;
    const wealthFactor = Math.max(0.3, Math.min(1.5, (next.wealth || 500) / 800));
    const aggressionFactor = 1 + (next.aggression || 0.2);
    const warScoreFactor = 1 + Math.max(-0.5, (next.warScore || 0) / 120);

    // Select action type based on war situation
    const aggression = next.aggression || 0.2;
    const playerArmySize = Object.values(army).reduce((sum, c) => sum + c, 0);
    const aiAdvantage = -(next.warScore || 0);
    const isNavalNation = (next.traits || []).includes('maritime') || (next.name || '').includes('海') || (next.name || '').includes('威尼斯');

    let actionType = 'raid';
    let unitScale = 'light';
    let actionBaseCount = { min: 2, max: 6 };
    let actionName = '边境掠夺';
    let strengthMultiplier = 1.0;

    const actionRoll = Math.random();

    // Action selection logic based on AI advantage and military strength
    if (militaryStrength > 0.7 && aggression > 0.5 && aiAdvantage > 30 && enemyEpoch >= 2) {
        if (actionRoll < 0.25) {
            actionType = 'siege';
            unitScale = 'heavy';
            actionBaseCount = { min: 15, max: 25 };
            actionName = '围城压制';
            strengthMultiplier = 1.5;
        } else if (actionRoll < 0.6) {
            actionType = 'assault';
            unitScale = 'medium';
            actionBaseCount = { min: 12, max: 18 };
            actionName = '正面攻势';
            strengthMultiplier = 1.3;
        } else if (actionRoll < 0.75 && aggression > 0.6) {
            actionType = 'scorched_earth';
            unitScale = 'heavy';
            actionBaseCount = { min: 12, max: 20 };
            actionName = '焦土战术';
            strengthMultiplier = 1.4;
        }
    } else if (militaryStrength > 0.5 && aiAdvantage > 10 && enemyEpoch >= 1) {
        if (actionRoll < 0.35) {
            actionType = 'assault';
            unitScale = 'medium';
            actionBaseCount = { min: 10, max: 15 };
            actionName = '正面攻势';
            strengthMultiplier = 1.2;
        } else if (actionRoll < 0.5 && isNavalNation && enemyEpoch >= 2) {
            actionType = 'naval_raid';
            unitScale = 'medium';
            actionBaseCount = { min: 8, max: 14 };
            actionName = '海上劫掠';
            strengthMultiplier = 1.1;
        }
    } else if (aiAdvantage < -20 && aggression > 0.6 && actionRoll < 0.3) {
        actionType = 'scorched_earth';
        unitScale = 'medium';
        actionBaseCount = { min: 8, max: 15 };
        actionName = '焦土战术';
        strengthMultiplier = 1.1;
    }

    const actionStrength = (0.05 + aggression * 0.05 + disadvantage / 1200) * strengthMultiplier;
    const overallStrength = militaryStrength * wealthFactor * aggressionFactor * warScoreFactor;

    // Generate attack army
    const attackerArmy = {};
    const actionUnits = getEnemyUnitsForEpoch(enemyEpoch, unitScale);
    const baseUnitCount = actionBaseCount.min + Math.random() * (actionBaseCount.max - actionBaseCount.min);
    const totalUnits = Math.floor(baseUnitCount * overallStrength);

    actionUnits.forEach(unitId => {
        if (UNIT_TYPES[unitId]) {
            const ratio = 0.5 + Math.random() * 0.8;
            const count = Math.floor((totalUnits / actionUnits.length) * ratio);
            if (count > 0) {
                attackerArmy[unitId] = count;
            }
        }
    });

    const defenderArmy = { ...army };
    const totalDefenders = Object.values(defenderArmy).reduce((sum, count) => sum + count, 0);

    // Action type loss multipliers
    const actionLossMultiplier = {
        raid: 1.0,
        assault: 1.5,
        siege: 2.0,
        naval_raid: 1.2,
        scorched_earth: 1.8
    }[actionType] || 1.0;

    const actionScoreChange = {
        raid: { win: -8, lose: 6 },
        assault: { win: -15, lose: 12 },
        siege: { win: -25, lose: 20 },
        naval_raid: { win: -12, lose: 10 },
        scorched_earth: { win: -18, lose: 15 }
    }[actionType] || { win: -8, lose: 6 };

    if (totalDefenders === 0) {
        // No defenders - action succeeds
        let foodLoss = Math.floor((res.food || 0) * actionStrength * actionLossMultiplier);
        let silverLoss = Math.floor((res.silver || 0) * (actionStrength / 2) * actionLossMultiplier);
        let woodLoss = 0;

        // Apply difficulty modifier to damage
        foodLoss = applyRaidDamageModifier(foodLoss, difficultyLevel);
        silverLoss = applyRaidDamageModifier(silverLoss, difficultyLevel);

        if (actionType === 'scorched_earth') {
            woodLoss = Math.floor((res.wood || 0) * actionStrength * 0.8);
            woodLoss = applyRaidDamageModifier(woodLoss, difficultyLevel);
            if (woodLoss > 0) applyResourceChange(res, 'wood', -woodLoss, 'ai_scorched_earth', onResourceChange);
        }
        if (foodLoss > 0) applyResourceChange(res, 'food', -foodLoss, 'ai_war_action_loss', onResourceChange);
        if (silverLoss > 0) applyTreasuryChange(res, -silverLoss, 'ai_war_action_loss', onTreasuryChange);
        let popLoss = Math.min(Math.floor(3 * actionLossMultiplier), Math.max(1, Math.floor(actionStrength * 20 * actionLossMultiplier)));
        popLoss = applyPopulationLossModifier(popLoss, difficultyLevel);
        raidPopulationLoss += popLoss;

        const raidData = {
            nationName: next.name,
            victory: false,
            attackerArmy,
            defenderArmy: {},
            attackerLosses: {},
            defenderLosses: {},
            foodLoss,
            silverLoss,
            woodLoss,
            popLoss,
            ourPower: 0,
            enemyPower: 0,
            actionType,
            actionName,
        };
        logs.push(`❗RAID_EVENT❗${JSON.stringify(raidData)}`);
        next.warScore = (next.warScore || 0) + actionScoreChange.win;
        const lootValue = foodLoss + silverLoss + woodLoss;
        next.wealth = (next.wealth || 0) + Math.floor(lootValue * 0.08);
    } else {
        // Battle simulation
        const attackerBuff = {
            raid: 0.1,
            assault: 0.0,
            siege: -0.1,
            naval_raid: 0.15,
            scorched_earth: 0.05
        }[actionType] || 0.1;

        const attackerData = {
            army: attackerArmy,
            epoch: enemyEpoch,
            militaryBuffs: attackerBuff,
        };

        const defenderData = {
            army: defenderArmy,
            epoch: epoch,
            militaryBuffs: 0,
            wealth: (res.food || 0) + (res.silver || 0) + (res.wood || 0),
        };

        const battleResult = simulateBattle(attackerData, defenderData);

        let foodLoss = 0;
        let silverLoss = 0;
        let woodLoss = 0;
        let popLoss = 0;

        if (battleResult.victory) {
            let foodLoss = Math.floor((res.food || 0) * actionStrength * actionLossMultiplier);
            let silverLoss = Math.floor((res.silver || 0) * (actionStrength / 2) * actionLossMultiplier);

            // Apply difficulty modifier to damage
            foodLoss = applyRaidDamageModifier(foodLoss, difficultyLevel);
            silverLoss = applyRaidDamageModifier(silverLoss, difficultyLevel);

            if (actionType === 'scorched_earth') {
                woodLoss = Math.floor((res.wood || 0) * actionStrength * 0.8);
                woodLoss = applyRaidDamageModifier(woodLoss, difficultyLevel);
                if (woodLoss > 0) applyResourceChange(res, 'wood', -woodLoss, 'ai_scorched_earth', onResourceChange);
            }
            if (foodLoss > 0) applyResourceChange(res, 'food', -foodLoss, 'ai_war_action_loss', onResourceChange);
            if (silverLoss > 0) applyTreasuryChange(res, -silverLoss, 'ai_war_action_loss', onTreasuryChange);
            let popLoss = Math.min(Math.floor(3 * actionLossMultiplier), Math.max(1, Math.floor(actionStrength * 20 * actionLossMultiplier)));
            popLoss = applyPopulationLossModifier(popLoss, difficultyLevel);
            raidPopulationLoss += popLoss;
            const lootValue = foodLoss + silverLoss + woodLoss;
            next.wealth = (next.wealth || 0) + Math.floor(lootValue * 0.08);
        }

        // Apply army losses and record for auto-replenishment
        const playerLosses = battleResult.defenderLosses || {};
        const actualLosses = {};
        Object.entries(playerLosses).forEach(([unitId, count]) => {
            if (army[unitId]) {
                const removed = Math.min(army[unitId], count);
                army[unitId] = Math.max(0, army[unitId] - removed);
                if (removed > 0) actualLosses[unitId] = removed;
            }
        });
        // Record losses in log for auto-replenishment processing
        if (Object.keys(actualLosses).length > 0) {
            logs.push(`AUTO_REPLENISH_LOSSES:${JSON.stringify(actualLosses)}`);
        }

        const enemyLossCount = Object.values(battleResult.attackerLosses || {}).reduce(
            (sum, val) => sum + (val || 0),
            0
        );
        if (enemyLossCount > 0) {
            next.enemyLosses = (next.enemyLosses || 0) + enemyLossCount;
        }

        const scoreDelta = battleResult.victory ? actionScoreChange.win : actionScoreChange.lose;
        next.warScore = (next.warScore || 0) + scoreDelta;

        const raidData = {
            nationName: next.name,
            victory: !battleResult.victory,
            attackerArmy,
            defenderArmy,
            attackerLosses: battleResult.attackerLosses || {},
            defenderLosses: battleResult.defenderLosses || {},
            foodLoss,
            silverLoss,
            woodLoss,
            popLoss,
            ourPower: battleResult.defenderPower,
            enemyPower: battleResult.attackerPower,
            battleReport: battleResult.battleReport || [],
            actionType,
            actionName,
        };
        logs.push(`❗RAID_EVENT❗${JSON.stringify(raidData)}`);
    }

    return { raidPopulationLoss };
};

/**
 * Check if AI should request peace
 * @param {Object} params - Parameters
 * @param {Object} params.nation - AI nation object (mutable)
 * @param {number} params.tick - Current game tick
 * @param {number} params.lastGlobalPeaceRequest - Last tick when any AI requested peace (for global cooldown)
 * @param {Array} params.logs - Log array (mutable)
 * @returns {boolean} - Whether a peace request was made (for tracking global cooldown)
 */
export const checkAIPeaceRequest = ({
    nation,
    tick,
    lastGlobalPeaceRequest = -Infinity,
    logs,
}) => {
    const next = nation;
    const lastPeaceRequestDay = Number.isFinite(next.lastPeaceRequestDay)
        ? next.lastPeaceRequestDay
        : -Infinity;

    // Check per-nation cooldown
    const canRequestPeace = (tick - lastPeaceRequestDay) >= PEACE_REQUEST_COOLDOWN_DAYS;

    // Check global cooldown - prevents multiple nations from requesting peace simultaneously
    const globalCooldown = GLOBAL_PEACE_REQUEST_COOLDOWN_DAYS;
    const globalReady = (tick - lastGlobalPeaceRequest) >= globalCooldown;

    if ((next.warScore || 0) > 12 && canRequestPeace && globalReady) {
        const willingness = Math.min(0.5, 0.03 + (next.warScore || 0) / 120 + (next.warDuration || 0) / 400) + Math.min(0.15, (next.enemyLosses || 0) / 500);

        if (Math.random() < willingness) {
            const warScore = next.warScore || 0;
            const enemyLosses = next.enemyLosses || 0;
            const warDuration = next.warDuration || 0;
            const availableWealth = Math.max(0, next.wealth || 0);
            const tribute = calculateAIPeaceTribute(warScore, enemyLosses, warDuration, availableWealth);

            logs.push(`🤝 ${next.name} 请求和平，愿意支付 ${tribute} 银币作为赔款。`);
            next.isPeaceRequesting = true;
            next.peaceTribute = tribute;
            next.lastPeaceRequestDay = tick;
            return true; // Signal that a peace request was made
        }
    }
    return false; // No peace request made
};

/**
 * Check if AI should demand player surrender
 * @param {Object} params - Parameters
 * @param {Object} params.nation - AI nation object (mutable)
 * @param {number} params.tick - Current game tick
 * @param {number} params.population - Player population
 * @param {Array} params.logs - Log array (mutable)
 */
export const checkAISurrenderDemand = ({
    nation,
    tick,
    population,
    playerWealth,
    logs,
}) => {
    const next = nation;
    const aiWarScore = -(next.warScore || 0);

    if (aiWarScore > 25 && (next.warDuration || 0) > 30) {
        const lastDemandDay = next.lastSurrenderDemandDay || 0;
        if (tick - lastDemandDay >= 60 && Math.random() < 0.03) {
            next.lastSurrenderDemandDay = tick;

            let demandType = 'tribute';
            const warDuration = next.warDuration || 0;
            // 传入玩家财富，使赔款计算与玩家主动求和时一致
            let demandAmount = calculateAISurrenderDemand(aiWarScore, warDuration, playerWealth);

            if (aiWarScore > 100) {
                demandType = 'territory';
                demandAmount = Math.min(50, Math.max(3, Math.floor(population * 0.05)));
            } else if (aiWarScore > 50 && Math.random() < 0.5) {
                demandType = 'open_market';
                demandAmount = 365 * 2;
            }

            logs.push(`AI_DEMAND_SURRENDER:${JSON.stringify({
                nationId: next.id,
                nationName: next.name,
                warScore: next.warScore,
                demandType,
                demandAmount
            })}`);
        }
    }
};

/**
 * Check if AI should offer unconditional peace when player is in desperate situation
 * This prevents the frustrating scenario where player cannot surrender due to lack of resources
 * @param {Object} params - Parameters
 * @param {Object} params.nation - AI nation object (mutable)
 * @param {number} params.tick - Current game tick
 * @param {number} params.population - Player population
 * @param {number} params.playerWealth - Player total wealth (silver)
 * @param {Object} params.resources - Player resources
 * @param {Array} params.logs - Log array (mutable)
 */
export const checkMercyPeace = ({
    nation,
    tick,
    population,
    playerWealth,
    resources,
    logs,
}) => {
    const next = nation;
    const warScore = next.warScore || 0;

    // Only check if at war and not already requesting peace
    if (!next.isAtWar || next.isPeaceRequesting) {
        return;
    }
    // Only trigger when player is at a disadvantage (negative war score).
    if (warScore >= 0) {
        return;
    }

    // Check cooldown for mercy peace offers (shorter than normal peace request)
    const lastMercyOfferDay = next.lastMercyPeaceOfferDay || 0;
    const MERCY_PEACE_COOLDOWN = 30; // Can offer mercy peace every 30 days
    if (tick - lastMercyOfferDay < MERCY_PEACE_COOLDOWN) {
        return;
    }

    // Define "desperate situation" thresholds
    const silverAmount = resources?.silver || 0;
    const foodAmount = resources?.food || 0;
    const totalResources = silverAmount + foodAmount + (resources?.wood || 0);

    // Conditions for player being in desperate situation:
    // 1. Very low population (< 20) OR
    // 2. Very low wealth AND population under pressure
    // 3. War has lasted for a while (at least 30 days)
    const isDesperatePopulation = population < 20;
    const isDesperateWealth = playerWealth < 50 && silverAmount < 30;
    const isResourceDepleted = totalResources < 100 && population < 50;
    const warDuration = next.warDuration || 0;
    const warLastedLongEnough = warDuration >= 30;

    // Check if player is in a truly desperate situation
    const isDesperateSituation = warLastedLongEnough && (
        isDesperatePopulation ||
        (isDesperateWealth && population < 50) ||
        (isResourceDepleted && isDesperateWealth)
    );

    if (!isDesperateSituation) {
        return;
    }

    // AI's willingness to offer mercy peace depends on:
    // 1. How long the war has lasted (longer = more likely)
    // 2. AI's aggression (less aggressive = more likely)
    // 3. How desperate the player is (more desperate = more likely)
    const aggression = next.aggression || 0.3;
    const desperationFactor = Math.min(1, (
        (isDesperatePopulation ? 0.4 : 0) +
        (isDesperateWealth ? 0.3 : 0) +
        (isResourceDepleted ? 0.2 : 0) +
        (population < 10 ? 0.3 : 0) // Extra factor for very low population
    ));

    // Base chance increases with war duration and desperation, decreases with aggression
    const baseChance = 0.05 + (warDuration / 500) + (desperationFactor * 0.3);
    const aggressionPenalty = aggression * 0.15;
    const mercyChance = Math.min(0.5, Math.max(0.1, baseChance - aggressionPenalty));

    // Check if AI decides to offer mercy peace
    if (Math.random() < mercyChance) {
        next.lastMercyPeaceOfferDay = tick;
        next.isMercyPeaceOffering = true;
        next.mercyPeaceOfferDay = tick;

        // Log the mercy peace offer
        logs.push(`🕊️ ${next.name} 见你已无力继续战斗，愿意无条件议和。`);
        logs.push(`AI_MERCY_PEACE_OFFER:${JSON.stringify({
            nationId: next.id,
            nationName: next.name,
            warScore: next.warScore,
            warDuration: warDuration,
            playerPopulation: population,
            playerWealth: playerWealth
        })}`);
    }
};

/**
 * Check war declaration conditions for an AI nation
 * @param {Object} params - Parameters
 * @param {Object} params.nation - AI nation to check (mutable)
 * @param {Array} params.nations - All nations (for counting wars)
 * @param {number} params.tick - Current game tick
 * @param {number} params.epoch - Current epoch
 * @param {Object} params.resources - Player resources
 * @param {number} params.stabilityValue - Player stability
 * @param {Array} params.logs - Log array (mutable)
 */
export const checkWarDeclaration = ({
    nation,
    nations,
    tick,
    epoch,
    resources,
    stabilityValue,
    logs,
    difficultyLevel = DEFAULT_DIFFICULTY,
    diplomacyOrganizations, // [NEW]
}) => {
    const next = nation;
    const res = resources;
    const relation = next.relation ?? 50;
    const aggression = next.aggression ?? 0.2;

    // Get minimum epoch for war declaration based on difficulty
    const minWarEpoch = getMinWarEpoch(difficultyLevel);

    // Skip war declarations during grace period (easy mode)
    if (isInGracePeriod(tick, difficultyLevel)) {
        return;
    }

    // Count current wars with player
    const currentWarsWithPlayer = (nations || []).filter(n =>
        n.isAtWar === true && n.id !== next.id && !n.isRebelNation
    ).length;

    // Check global cooldown
    const recentWarDeclarations = (nations || []).some(n =>
        n.isAtWar && n.warStartDay && (tick - n.warStartDay) < GLOBAL_WAR_COOLDOWN && n.id !== next.id
    );

    // War count penalty
    const warCountPenalty = currentWarsWithPlayer > 0
        ? Math.pow(0.3, currentWarsWithPlayer)
        : 1.0;

    // Calculate declaration chance (only allowed from minWarEpoch based on difficulty)
    const hostility = Math.max(0, (50 - relation) / 70);
    const unrest = stabilityValue < 35 ? 0.02 : 0;
    const aggressionBonus = aggression > 0.5 ? aggression * 0.03 : 0;

    let declarationChance = epoch >= minWarEpoch
        ? Math.min(0.08, (aggression * 0.04) + (hostility * 0.025) + unrest + aggressionBonus)
        : 0;

    // Apply difficulty modifier to declaration chance
    declarationChance = applyWarDeclarationModifier(declarationChance, difficultyLevel);

    declarationChance *= warCountPenalty;

    // Check conditions
    const hasPeaceTreaty = next.peaceTreatyUntil && tick < next.peaceTreatyUntil;
    // Fixed: Use formal alliance status instead of relation-based check
    const isPlayerAlly = areNationsAllied(next.id, 'player', diplomacyOrganizations?.organizations);

    const canDeclareWar = !next.isAtWar &&
        !hasPeaceTreaty &&
        !isPlayerAlly &&
        next.vassalOf !== 'player' && // [FIX] Vassals cannot declare normal hostility wars on overlord
        relation < 25 &&
        currentWarsWithPlayer < MAX_CONCURRENT_WARS &&
        !recentWarDeclarations;

    if (canDeclareWar && Math.random() < declarationChance) {
        next.isAtWar = true;
        next.warStartDay = tick;
        next.warDuration = 0;
        next.warDeclarationPending = true;
        logs.push(`⚠️ ${next.name} 对你发动了战争！`);
        logs.push(`WAR_DECLARATION_EVENT:${JSON.stringify({ nationId: next.id, nationName: next.name })}`);

        // [NEW] Trigger Auto-Join Vassals
        // When AI declares on Player, Player's player's vassals with "auto_join" military policy automatically enter war with AI
        if (nations) {
            nations.forEach(vassal => {
                if (vassal.vassalOf === 'player') {
                    const militaryPolicy = vassal.vassalPolicy?.military || 'autonomous';
                    // Check if the vassal has auto_join military policy
                    if (militaryPolicy === 'auto_join') {
                        // Establish AI-AI war
                        if (!next.foreignWars) next.foreignWars = {};
                        if (!vassal.foreignWars) vassal.foreignWars = {};

                        if (!next.foreignWars[vassal.id]?.isAtWar) {
                            next.foreignWars[vassal.id] = { isAtWar: true, warStartDay: tick, warScore: 0 };
                            vassal.foreignWars[next.id] = {
                                isAtWar: true,
                                warStartDay: tick,
                                warScore: 0,
                                followingSuzerain: true,  // Mark this war as following suzerain
                                suzerainTarget: 'player'  // Track which suzerain they're following
                            };
                            logs.push(`⚔️ ${vassal.name} 根据军事政策自动对 ${next.name} 宣战！`);
                        }
                    }
                }
            });
        }
    }

    // Wealth-based war check (also respects minWarEpoch from difficulty)
    const playerWealth = (res.food || 0) + (res.silver || 0) + (res.wood || 0);
    const aiWealth = next.wealth || 500;
    const aiMilitaryStrength = next.militaryStrength ?? 1.0;

    if (!next.isAtWar && !hasPeaceTreaty && !isPlayerAlly &&
        next.vassalOf !== 'player' && // [FIX] Vassals cannot declare regular wealth wars on overlord
        epoch >= minWarEpoch &&
        playerWealth > aiWealth * 2 &&
        aiMilitaryStrength > 0.8 &&
        relation < 50 &&
        aggression > 0.4 &&
        currentWarsWithPlayer < MAX_CONCURRENT_WARS &&
        !recentWarDeclarations) {

        let wealthWarChance = 0.001 * aggression * (playerWealth / aiWealth - 1);
        // Apply difficulty modifier
        wealthWarChance = applyWarDeclarationModifier(wealthWarChance, difficultyLevel);
        if (Math.random() < wealthWarChance) {
            next.isAtWar = true;
            next.warStartDay = tick;
            next.warDuration = 0;
            next.warDeclarationPending = true;
            logs.push(`⚠️ ${next.name} 觊觎你的财富，发动了战争！`);
            logs.push(`WAR_DECLARATION_EVENT:${JSON.stringify({ nationId: next.id, nationName: next.name, reason: 'wealth' })}`);

            // [NEW] Trigger Auto-Join Vassals for Wealth War too
            if (nations) {
                nations.forEach(vassal => {
                    if (vassal.vassalOf === 'player') {
                        const militaryPolicy = vassal.vassalPolicy?.military || 'autonomous';
                        if (militaryPolicy === 'auto_join') {
                            if (!next.foreignWars) next.foreignWars = {};
                            if (!vassal.foreignWars) vassal.foreignWars = {};

                            if (!next.foreignWars[vassal.id]?.isAtWar) {
                                next.foreignWars[vassal.id] = { isAtWar: true, warStartDay: tick, warScore: 0 };
                                vassal.foreignWars[next.id] = {
                                    isAtWar: true,
                                    warStartDay: tick,
                                    warScore: 0,
                                    followingSuzerain: true,
                                    suzerainTarget: 'player'
                                };
                                logs.push(`⚔️ ${vassal.name} 根据军事政策自动对 ${next.name} 宣战！`);
                            }
                        }
                    }
                });
            }
        }
    }
};

/**
 * Process collective attack against warmonger nations
 * When a nation has 3+ active wars, other nations may form a coalition against it
 * @param {Array} visibleNations - Array of visible nations
 * @param {number} tick - Current game tick
 * @param {Array} logs - Log array (mutable)
 * @param {Object} diplomacyOrganizations - Org state
 */
export const processCollectiveAttackWarmonger = (visibleNations, tick, logs, diplomacyOrganizations) => {
    visibleNations.forEach(warmonger => {
        const activeWars = Object.values(warmonger.foreignWars || {}).filter(w => w?.isAtWar).length;
        if (activeWars < 3) return;

        const alreadyOpposing = visibleNations.filter(n =>
            n.foreignWars?.[warmonger.id]?.isAtWar &&
            n.id !== warmonger.id
        ).length;
        if (alreadyOpposing >= 2) return;

        const potentialOpponents = visibleNations.filter(n => {
            if (n.id === warmonger.id) return false;
            if (n.foreignWars?.[warmonger.id]?.isAtWar) return false;
            if (areNationsAllied(n.id, warmonger.id, diplomacyOrganizations?.organizations)) return false;
            // [FIX] Vassals cannot join coalition against overlord
            if (n.vassalOf === warmonger.id || warmonger.vassalOf === n.id) return false;
            const relation = n.foreignRelations?.[warmonger.id] ?? 50;
            return relation < 40;
        });

        if (potentialOpponents.length >= 2 && Math.random() < 0.005) {
            const opponent = potentialOpponents[Math.floor(Math.random() * potentialOpponents.length)];
            if (!opponent.foreignWars) opponent.foreignWars = {};
            if (!warmonger.foreignWars) warmonger.foreignWars = {};

            opponent.foreignWars[warmonger.id] = { isAtWar: true, warStartDay: tick, warScore: 0 };
            warmonger.foreignWars[opponent.id] = { isAtWar: true, warStartDay: tick, warScore: 0 };

            logs.push(`⚔️ 国际新闻：${opponent.name} 认为 ${warmonger.name} 的好战行为威胁地区稳定，对其宣战！`);
        }
    });
};

/**
 * Process AI-AI war declarations
 * @param {Array} visibleNations - Array of visible nations
 * @param {Array} updatedNations - Full nations array
 * @param {number} tick - Current game tick
 * @param {Array} logs - Log array (mutable)
 * @param {Object} diplomacyOrganizations - Org state
 */
export const processAIAIWarDeclaration = (visibleNations, updatedNations, tick, logs, diplomacyOrganizations, vassalDiplomacyRequests = null) => {
    visibleNations.forEach(nation => {
        if (!nation.foreignWars) nation.foreignWars = {};

        visibleNations.forEach(otherNation => {
            if (otherNation.id === nation.id) return;
            if (nation.foreignWars[otherNation.id]?.isAtWar) return;

            const peaceUntil = nation.foreignWars[otherNation.id]?.peaceTreatyUntil || 0;
            if (tick < peaceUntil) return;

            const isAllied = areNationsAllied(nation.id, otherNation.id, diplomacyOrganizations?.organizations);
            if (isAllied) return;

            // [FIX] Check for Vassal/Suzerain relationship - standard wars not allowed
            if (nation.vassalOf === otherNation.id || otherNation.vassalOf === nation.id) return;

            const currentWarCount = Object.values(nation.foreignWars || {}).filter(w => w?.isAtWar).length;
            const maxWarsAllowed = nation.aggression > 0.7 ? 2 : 1;
            if (currentWarCount >= maxWarsAllowed) return;

            const myPopulation = nation.population || 100;
            const myWealth = nation.wealth || 500;
            if (myPopulation < 30 || myWealth < 300) return;

            const calculateNationPower = (n) => (n.militaryStrength ?? 1.0) * (n.population || 100) * (1 + (n.aggression || 0.3));

            let mySideStrength = calculateNationPower(nation);
            let enemySideStrength = calculateNationPower(otherNation);

            visibleNations.forEach(n => {
                if (n.id === nation.id || n.id === otherNation.id) return;
                const isMyAlly = areNationsAllied(nation.id, n.id, diplomacyOrganizations?.organizations);
                if (isMyAlly) mySideStrength += calculateNationPower(n);
                const isEnemyAlly = areNationsAllied(otherNation.id, n.id, diplomacyOrganizations?.organizations);
                if (isEnemyAlly) enemySideStrength += calculateNationPower(n);
            });

            const strengthRatio = mySideStrength / Math.max(1, enemySideStrength);
            const minStrengthRatio = nation.aggression > 0.7 ? 0.5 : 0.7;
            if (strengthRatio < minStrengthRatio) return;

            const enemyWarCount = Object.values(otherNation.foreignWars || {}).filter(w => w?.isAtWar).length;
            const opportunityBonus = enemyWarCount > 0 ? 0.002 : 0;

            const relation = nation.foreignRelations?.[otherNation.id] ?? 50;
            const aggression = nation.aggression ?? 0.3;

            const isRelationsBadEnough = relation < 50;
            const isAggressiveEnough = aggression > 0.25;
            const isHatedEnemy = relation < 15;

            // [NEW] Check Suzerain Protection (Attack on Vassal = Attack on Suzerain)
            // If otherNation is Player's Vassal, check if War on Player triggers
            if (otherNation.vassalOf === 'player' && !nation.isAtWar) {
                // AI considering attacking Player's Vassal
                // This effectively means declaring war on Player
                // So we should check player strength + vassal strength?
                // For now, simple logic: attacking vassal = war with player
                // We skip this check here to avoid AI suicide, or we let them do it?
                // Let's make AI smarter: consider Player Strength before attacking Vassal
                // ... skipping complexity for now, just trigger the war if they decide to attack
            }

            if ((isRelationsBadEnough && isAggressiveEnough) || isHatedEnemy) {
                let warChance = (aggression * 0.003) + ((50 - relation) / 5000);

                if (relation < 10) warChance += 0.01;
                else if (relation < 20) warChance += 0.003;

                if (strengthRatio > 2.0) warChance *= 2.0;
                else if (strengthRatio > 1.5) warChance *= 1.5;
                else if (strengthRatio > 1.2) warChance *= 1.2;
                else if (strengthRatio < 0.8) warChance *= 0.1;

                warChance += opportunityBonus * 0.5;

                const targetWealth = otherNation.wealth || 500;
                if (targetWealth > myWealth * 1.5 && strengthRatio > 0.8) {
                    const wealthWarBonus = 0.003 * aggression * (targetWealth / myWealth - 1);
                    warChance += wealthWarBonus;
                }

                warChance = Math.min(0.003, warChance);

                if (Math.random() < warChance) {
                    if (requiresVassalDiplomacyApproval(nation) && Array.isArray(vassalDiplomacyRequests)) {
                        // Check if vassal is allowed to declare war
                        const diplomaticControl = nation.vassalPolicy?.diplomaticControl || 'guided';
                        if (diplomaticControl === 'puppet') {
                            return; // Puppet vassals cannot initiate war independently
                        }
                        
                        vassalDiplomacyRequests.push(buildVassalDiplomacyRequest({
                            vassal: nation,
                            target: otherNation,
                            actionType: 'declare_war',
                            payload: { reason: 'ai_war_chance', warChance },
                            tick,
                        }));
                        return;
                    }
                    nation.foreignWars[otherNation.id] = { isAtWar: true, warStartDay: tick, warScore: 0 };
                    if (!otherNation.foreignWars) otherNation.foreignWars = {};
                    otherNation.foreignWars[nation.id] = { isAtWar: true, warStartDay: tick, warScore: 0 };

                    const declarationNewsTemplates = [
                        `📢 国际新闻：${nation.name} 向 ${otherNation.name} 宣战了！`,
                        `📢 国际新闻：${nation.name} 正式对 ${otherNation.name} 宣战！`,
                        `📢 国际新闻：战争爆发！${nation.name} 对 ${otherNation.name} 发起了战争！`
                    ];
                    logs.push(declarationNewsTemplates[Math.floor(Math.random() * declarationNewsTemplates.length)]);

                    // [NEW] Suzerain Protection Logic
                    if (otherNation.vassalOf === 'player') {
                        if (!nation.isAtWar) {
                            nation.isAtWar = true;
                            nation.warStartDay = tick;
                            nation.warDuration = 0;
                            nation.warDeclarationPending = true;
                            logs.push(`⚠️ ${nation.name} 攻击了您的附庸 ${otherNation.name}，自动对您宣战！`);
                        }
                    }

                    // Alliance chain reaction
                    const isOtherNationPlayerAlly = otherNation.alliedWithPlayer === true;
                    const isNationPlayerAlly = nation.alliedWithPlayer === true;
                    const playerAlliesInConflict = isOtherNationPlayerAlly && isNationPlayerAlly;
                    const currentPlayerWars = visibleNations.filter(n => n.isAtWar === true && !n.isRebelNation).length;

                    if (playerAlliesInConflict) {
                        logs.push(`⚖️ 你的盟友 ${nation.name} 与 ${otherNation.name} 发生冲突，你选择保持中立。`);
                    } else {
                        if (isOtherNationPlayerAlly && !nation.isAtWar) {
                            logs.push(`ALLY_ATTACKED_EVENT:${JSON.stringify({
                                allyId: otherNation.id,
                                allyName: otherNation.name,
                                attackerId: nation.id,
                                attackerName: nation.name,
                                currentPlayerWars
                            })}`);
                        }
                        if (isNationPlayerAlly && !otherNation.isAtWar) {
                            if (currentPlayerWars >= MAX_CONCURRENT_WARS) {
                                logs.push(`⚖️ 你的盟友 ${nation.name} 向 ${otherNation.name} 宣战！但你已陷入多场战争，选择不介入。`);
                            } else {
                                otherNation.isAtWar = true;
                                otherNation.warStartDay = tick;
                                otherNation.warDuration = 0;
                                otherNation.relation = Math.max(0, (otherNation.relation || 50) - 40);
                                logs.push(`⚔️ 你的盟友 ${nation.name} 向 ${otherNation.name} 宣战！作为同盟，你被迫与 ${otherNation.name} 进入战争状态！`);
                            }
                        }
                    }

                    // AI alliance chain (organization-based)
                    const allianceOrgs = diplomacyOrganizations?.organizations || [];
                    const attackerAllies = getAllianceMembers(nation.id, allianceOrgs);
                    const defenderAllies = getAllianceMembers(otherNation.id, allianceOrgs);
                    const sharedAllies = new Set(attackerAllies.filter(id => defenderAllies.includes(id)));

                    defenderAllies.forEach(allyId => {
                        if (sharedAllies.has(allyId)) return;
                        if (allyId === nation.id || allyId === otherNation.id) return;
                        const ally = visibleNations.find(n => n.id === allyId);
                        if (!ally) return;
                        if (!ally.foreignWars) ally.foreignWars = {};
                        ally.foreignWars[nation.id] = { isAtWar: true, warStartDay: tick, warScore: 0 };
                        if (!nation.foreignWars) nation.foreignWars = {};
                        nation.foreignWars[ally.id] = { isAtWar: true, warStartDay: tick, warScore: 0 };
                        logs.push(`?? ${ally.name} ?? ${otherNation.name} ????????? ${nation.name} ????`);
                    });

                    if (sharedAllies.size > 0) {
                        sharedAllies.forEach(allyId => {
                            const ally = visibleNations.find(n => n.id === allyId);
                            if (ally) {
                                logs.push(`?? ${ally.name} ???????????????`);
                            }
                        });
                    }
                }
            }
        });
    });
};

/**
 * Process ongoing AI-AI war progression
 * @param {Array} visibleNations - Array of visible nations
 * @param {Array} updatedNations - Full nations array
 * @param {number} tick - Current game tick
 * @param {Array} logs - Log array (mutable)
 */
export const processAIAIWarProgression = (visibleNations, updatedNations, tick, logs, vassalDiplomacyRequests = null) => {
    // Create a set of visible nation IDs for quick lookup
    const visibleNationIds = new Set(visibleNations.map(n => n.id));

    visibleNations.forEach(nation => {
        Object.keys(nation.foreignWars || {}).forEach(enemyId => {
            const war = nation.foreignWars[enemyId];
            if (!war?.isAtWar) return;

            const enemy = updatedNations.find(n => n.id === enemyId);

            // Clean up war state if enemy no longer exists or is no longer visible
            if (!enemy || !visibleNationIds.has(enemyId)) {
                // End war with destroyed/invisible nation
                nation.foreignWars[enemyId] = { isAtWar: false };
                if (enemy) {
                    logs.push(`⚔️ ${nation.name} 与 ${enemy.name} 的战争因对方势力消亡而结束。`);
                }
                return;
            }

            if (!enemy.foreignWars) enemy.foreignWars = {};
            if (!enemy.foreignWars[nation.id]) {
                enemy.foreignWars[nation.id] = {
                    isAtWar: true,
                    warStartDay: war.warStartDay || tick,
                    warScore: -(war.warScore || 0)
                };
            }

            const warDuration = tick - (war.warStartDay || tick);
            const warIntensity = Math.min(2.0, 1.0 + warDuration / 500);

            const wealthDecayRate = 0.995 - (warIntensity * 0.003);
            const populationDecayRate = 0.998 - (warIntensity * 0.002);

            const nationWarCount = Object.values(nation.foreignWars || {}).filter(w => w?.isAtWar).length;
            const enemyWarCount = Object.values(enemy.foreignWars || {}).filter(w => w?.isAtWar).length;
            const nationMultiWarPenalty = Math.pow(0.998, nationWarCount - 1);
            const enemyMultiWarPenalty = Math.pow(0.998, enemyWarCount - 1);

            nation.wealth = Math.max(100, (nation.wealth || 500) * wealthDecayRate * nationMultiWarPenalty);
            nation.population = Math.max(10, (nation.population || 100) * populationDecayRate * nationMultiWarPenalty);
            enemy.wealth = Math.max(100, (enemy.wealth || 500) * wealthDecayRate * enemyMultiWarPenalty);
            enemy.population = Math.max(10, (enemy.population || 100) * populationDecayRate * enemyMultiWarPenalty);

            if ((tick - war.warStartDay) % 10 === 0 && tick > war.warStartDay) {
                const nationStrength = (nation.militaryStrength ?? 1.0) * (nation.population || 100) * (1 + (nation.aggression || 0.3));
                const enemyStrength = (enemy.militaryStrength ?? 1.0) * (enemy.population || 100) * (1 + (enemy.aggression || 0.3));

                const totalStrength = nationStrength + enemyStrength;
                const nationWinChance = nationStrength / totalStrength;

                const battleCasualty = 0.02 + Math.random() * 0.03;
                nation.population = Math.max(10, (nation.population || 100) * (1 - battleCasualty * (1 - nationWinChance)));
                enemy.population = Math.max(10, (enemy.population || 100) * (1 - battleCasualty * nationWinChance));

                if (Math.random() < nationWinChance) {
                    war.warScore = (war.warScore || 0) + 5;
                    enemy.foreignWars[nation.id].warScore = (enemy.foreignWars[nation.id].warScore || 0) - 5;
                    const loot = Math.floor((enemy.wealth || 500) * 0.08);
                    nation.wealth = (nation.wealth || 500) + loot;
                    enemy.wealth = Math.max(100, (enemy.wealth || 500) - loot);
                } else {
                    war.warScore = (war.warScore || 0) - 5;
                    enemy.foreignWars[nation.id].warScore = (enemy.foreignWars[nation.id].warScore || 0) + 5;
                    const loot = Math.floor((nation.wealth || 500) * 0.08);
                    enemy.wealth = (enemy.wealth || 500) + loot;
                    nation.wealth = Math.max(100, (nation.wealth || 500) - loot);
                }

                // 获取或生成本场战争的结束分数阈值（存储在war对象中，避免每次重新随机）
                if (!war.endScoreThreshold) {
                    war.endScoreThreshold = 25 + Math.floor(Math.random() * 56); // 25~80
                }

                const absoluteWarScore = Math.abs(war.warScore || 0);
                const nationExhausted = (nation.population || 100) < 30 || (nation.wealth || 500) < 200;
                const enemyExhausted = (enemy.population || 100) < 30 || (enemy.wealth || 500) < 200;

                // 大幅降低随机结束概率
                const exhaustionEndChance = (nationExhausted || enemyExhausted) ? 0.03 : 0.005;

                // 战争结束条件：达到阈值 或 小概率随机结束
                if (absoluteWarScore >= war.endScoreThreshold || Math.random() < exhaustionEndChance) {
                    const needsApproval = requiresVassalDiplomacyApproval(nation) || requiresVassalDiplomacyApproval(enemy);
                    if (needsApproval && Array.isArray(vassalDiplomacyRequests)) {
                        const requester = requiresVassalDiplomacyApproval(nation) ? nation : enemy;
                        const target = requester.id === nation.id ? enemy : nation;
                        
                        // Check if requester is allowed to propose peace
                        const diplomaticControl = requester.vassalPolicy?.diplomaticControl || 'guided';
                        if (diplomaticControl === 'puppet') {
                            // Puppet vassals cannot propose peace independently
                            // Peace will be handled automatically or by player order
                            return;
                        }
                        
                        // Only generate peace request if not already pending
                        if (!war.pendingPeaceApproval) {
                            vassalDiplomacyRequests.push(buildVassalDiplomacyRequest({
                                vassal: requester,
                                target,
                                actionType: 'propose_peace',
                                payload: { warScore: war.warScore || 0 },
                                tick,
                            }));
                            war.pendingPeaceApproval = true;
                            if (enemy.foreignWars?.[nation.id]) {
                                enemy.foreignWars[nation.id].pendingPeaceApproval = true;
                            }
                        }
                        return;
                    }
                    const winner = (war.warScore || 0) > 0 ? nation : enemy;
                    const loser = winner.id === nation.id ? enemy : nation;
                    const finalScore = Math.abs(war.warScore || 0);

                    // 根据战争分数确定胜负等级和赔偿比例
                    let victoryTier = 'draw';
                    let populationTransferRate = 0;
                    let wealthTransferRate = 0;
                    let peaceDuration = 365; // 默认1年
                    let tierName = '僵持';

                    if (finalScore >= 200) {
                        victoryTier = 'overwhelming';
                        populationTransferRate = 0.25;
                        wealthTransferRate = 0.35;
                        peaceDuration = 365 * 3; // 3年
                        tierName = '压倒性胜利';
                    } else if (finalScore >= 100) {
                        victoryTier = 'major';
                        populationTransferRate = 0.15;
                        wealthTransferRate = 0.25;
                        peaceDuration = Math.floor(365 * 2.5); // 2.5年
                        tierName = '大胜';
                    } else if (finalScore >= 50) {
                        victoryTier = 'minor';
                        populationTransferRate = 0.08;
                        wealthTransferRate = 0.12;
                        peaceDuration = 365 * 2; // 2年
                        tierName = '小胜';
                    } else if (finalScore >= 25) {
                        victoryTier = 'pyrrhic';
                        populationTransferRate = 0.03;
                        wealthTransferRate = 0.05;
                        peaceDuration = Math.floor(365 * 1.5); // 1.5年
                        tierName = '惨胜';
                    }
                    // finalScore < 25 保持 draw，无赔偿

                    // 执行赔偿转移
                    const populationTransfer = Math.floor((loser.population || 100) * populationTransferRate);
                    const wealthTransfer = Math.floor((loser.wealth || 500) * wealthTransferRate);

                    winner.population = (winner.population || 100) + populationTransfer;
                    winner.wealth = (winner.wealth || 500) + wealthTransfer;
                    loser.population = Math.max(10, (loser.population || 100) - populationTransfer);
                    loser.wealth = Math.max(100, (loser.wealth || 500) - wealthTransfer);

                    // 检查吞并条件：压倒性胜利 + 败方人口<30 + 财富<300
                    let isAnnexed = false;
                    if (victoryTier === 'overwhelming' &&
                        (loser.population || 100) < 30 &&
                        (loser.wealth || 500) < 300) {
                        // 执行吞并：获胜方获得败方全部资源
                        winner.population = (winner.population || 100) + (loser.population || 0);
                        winner.wealth = (winner.wealth || 500) + (loser.wealth || 0);
                        loser.isAnnexed = true;
                        loser.annexedBy = winner.id;
                        loser.annexedAt = tick;
                        loser.population = 0;
                        loser.wealth = 0;
                        isAnnexed = true;
                    }

                    // 设置和平条约
                    nation.foreignWars[enemyId] = { isAtWar: false, peaceTreatyUntil: tick + peaceDuration };
                    enemy.foreignWars[nation.id] = { isAtWar: false, peaceTreatyUntil: tick + peaceDuration };

                    // 关系变化：失败程度越高，关系下降越多
                    const relationDrop = 10 + Math.floor(finalScore / 10);
                    if (!nation.foreignRelations) nation.foreignRelations = {};
                    if (!enemy.foreignRelations) enemy.foreignRelations = {};
                    nation.foreignRelations[enemyId] = clamp((nation.foreignRelations[enemyId] || 50) - relationDrop, 0, 100);
                    enemy.foreignRelations[nation.id] = clamp((enemy.foreignRelations[nation.id] || 50) - relationDrop, 0, 100);

                    // 生成日志
                    const warDurationDays = tick - (war.warStartDay || tick);
                    if (isAnnexed) {
                        logs.push(`📢 国际新闻：${winner.name} 在历时${warDurationDays}天的战争中彻底击败 ${loser.name}，将其吞并！`);
                    } else if (victoryTier === 'draw') {
                        logs.push(`📢 国际新闻：${nation.name} 与 ${enemy.name} 经过${warDurationDays}天的战争后握手言和。`);
                    } else {
                        logs.push(`📢 国际新闻：${winner.name} 在与 ${loser.name} 历时${warDurationDays}天的战争中取得${tierName}！`);
                    }
                }
            }
        });
    });
};

/**
 * 检查附庸是否可以单独与某国媾和
 * @param {Object} vassal - 附庸国对象
 * @param {string} enemyId - 敌国ID
 * @returns {boolean} - 是否可以媾和
 */
export const canVassalMakePeaceIndependently = (vassal, enemyId) => {
    if (vassal.vassalOf !== 'player') return true; // 非玩家附庸可以自由媾和

    const war = vassal.foreignWars?.[enemyId];
    if (!war || !war.isAtWar) return true; // 没有战争则无需限制

    // 如果是跟随宗主国参战，不能单独媾和
    if (war.followingSuzerain) return false;

    return true; // 其他情况允许媾和
};

/**
 * 当玩家与某国和平后，让跟随宗主国参战的附庸也自动和平
 * @param {string} enemyNationId - 敌国ID
 * @param {Array} nations - 所有国家
 * @param {Array} logs - 日志数组
 * @returns {Array} 已和平的附庸ID列表
 */
export const makeVassalsPeaceAfterSuzerain = (enemyNationId, nations, logs) => {
    const peacedVassals = [];

    nations.forEach(nation => {
        if (nation.vassalOf === 'player') {
            const war = nation.foreignWars?.[enemyNationId];
            if (war?.isAtWar && war?.followingSuzerain) {
                // 结束附庸与该敌国的战争
                nation.foreignWars[enemyNationId] = {
                    ...war,
                    isAtWar: false
                };

                // 同时结束敌国与附庸的战争状态
                const enemy = nations.find(n => n.id === enemyNationId);
                if (enemy && enemy.foreignWars?.[nation.id]) {
                    enemy.foreignWars[nation.id] = {
                        ...enemy.foreignWars[nation.id],
                        isAtWar: false
                    };
                }

                peacedVassals.push(nation.id);
                logs.push(`📜 ${nation.name} 跟随宗主国与 ${enemy?.name || '敌国'} 达成和平。`);
            }
        }
    });

    return peacedVassals;
};

