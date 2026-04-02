/**
 * AI War Module
 * Handles AI military actions, rebel raids, and war-related logic
 * Extracted from simulation.js for better code organization
 */

import { simulateBattle, UNIT_TYPES, generateNationArmy, calculateBattlePower, calculateArmyMaintenance } from '../../config/militaryUnits';
import { getEnemyUnitsForEpoch } from '../../config/militaryActions';
import { getCorpsTotalUnits, getCorpsGeneral, calculateCorpsCombatPower } from './corpsSystem';
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
import { trackAIWar, trackAIToAIWar, trackAIToAIPeace } from '../../analytics/gaTracker';
import { VASSAL_TYPE_CONFIGS } from '../../config/diplomacy';
import { requiresVassalDiplomacyApproval, buildVassalDiplomacyRequest } from './vassalSystem';
import {
    getNationAnnualOutput,
    getNationEconomicScale,
    getNationTreasury,
} from './economyUtils';
import { getCheckpointsCrossed, CHECKPOINTS } from './frontSystem';
import { calculateWarBuildingDamage, calculateWarPopulationLoss, generateAIBuildingProfile, calculateWarPlunder } from './warEconomy';
import { WAR_ECONOMY, AI_WAR_DECISION } from '../../config/gameConstants';
import { BUILDINGS } from '../../config/buildings';
import { reducePopulationWithFloor } from '../../utils/populationClamp';

const AI_DOCTRINES = {
    line_breaker: {
        id: 'line_breaker',
        name: '突破学说',
        preferredPosture: 'offensive',
        preferredTasks: ['assault', 'assault', 'reserve', 'raid'],
        techTags: ['冷兵器训练', '参谋组织'],
    },
    siege_attrition: {
        id: 'siege_attrition',
        name: '消耗学说',
        preferredPosture: 'attrition',
        preferredTasks: ['guard', 'guard', 'reserve', 'raid'],
        techTags: ['工兵筑垒', '辎重体系'],
    },
    deep_raid: {
        id: 'deep_raid',
        name: '破袭学说',
        preferredPosture: 'raid',
        preferredTasks: ['raid', 'assault', 'reserve', 'guard'],
        techTags: ['机动侦察', '补给破坏'],
    },
    balanced_command: {
        id: 'balanced_command',
        name: '均衡学说',
        preferredPosture: 'balanced',
        preferredTasks: ['assault', 'guard', 'reserve', 'raid'],
        techTags: ['参谋组织'],
    },
};
const MAX_AI_TARGET_CORPS = 12;

const getMaterielResourceForEpoch = (epoch = 0) => {
    if (epoch >= 5) return 'ammunition';
    if (epoch >= 4) return 'gunpowder';
    return 'wood';
};

const pickDoctrine = (nation, epoch = 0) => {
    const aggression = nation?.aggression ?? 0.3;
    if (epoch >= 5 && aggression > 0.7) return AI_DOCTRINES.line_breaker;
    if (aggression < 0.25) return AI_DOCTRINES.siege_attrition;
    if (aggression > 0.6) return AI_DOCTRINES.deep_raid;
    return AI_DOCTRINES.balanced_command;
};

/**
 * Frontline-driven population casualties for AI-AI wars.
 * 仅在战线拉扯或被推进到本土时提高损失，避免“只要开战就持续暴跌”。
 */
const applyFrontlinePopulationCasualties = ({
    nation,
    enemy,
    linePosition = 50,
    warIntensity = 1,
}) => {
    const nationPop = Math.max(1, Number(nation?.population || 0));
    const enemyPop = Math.max(1, Number(enemy?.population || 0));

    // 前线越接近中线（50），代表接触战更密集；越深入本土，民用损失越高
    const contestFactor = 1 - Math.min(1, Math.abs(linePosition - 50) / 50);
    const nationHomelandPressure = Math.max(0, (50 - linePosition) / 45); // line<50: nation本土受压
    const enemyHomelandPressure = Math.max(0, (linePosition - 50) / 45); // line>50: enemy本土受压

    const nationCollapse = linePosition <= 12 ? 1 : 0;
    const enemyCollapse = linePosition >= 88 ? 1 : 0;

    // 基础损失很低，主要由前线状态驱动；单tick最高不超过 0.12%
    const baseRate = 0.00003 * warIntensity;
    const contestRate = 0.00012 * contestFactor * warIntensity;
    const nationPressureRate = 0.00045 * Math.pow(nationHomelandPressure, 1.35) * warIntensity;
    const enemyPressureRate = 0.00045 * Math.pow(enemyHomelandPressure, 1.35) * warIntensity;
    const collapseRate = 0.00035 * warIntensity;

    const nationRate = clamp(baseRate + contestRate + nationPressureRate + (nationCollapse ? collapseRate : 0), 0, 0.0012);
    const enemyRate = clamp(baseRate + contestRate + enemyPressureRate + (enemyCollapse ? collapseRate : 0), 0, 0.0012);

    const nationLoss = Math.max(0, Math.floor(nationPop * nationRate));
    const enemyLoss = Math.max(0, Math.floor(enemyPop * enemyRate));

    nation.population = reducePopulationWithFloor(nationPop, nationLoss);
    enemy.population = reducePopulationWithFloor(enemyPop, enemyLoss);
};

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

    // 强制投降：人口或财富跌破生存底线时，无视冷却时间立即投降
    const rebelPopulation = next.population || 0;
    const rebelWealth = next.wealth || 0;
    const REBEL_SURRENDER_MIN_POPULATION = 10;
    const REBEL_SURRENDER_MIN_WEALTH = 1000;

    if (!next.isPeaceRequesting) {
        if (rebelPopulation < REBEL_SURRENDER_MIN_POPULATION) {
            next.isPeaceRequesting = true;
            next.peaceTribute = 0;
            next.lastPeaceRequestDay = tick;
            logs.push(`🏳️ ${next.name} 人口已不足 ${REBEL_SURRENDER_MIN_POPULATION} 人，无力为继，被迫投降！`);
            return;
        }
        if (rebelWealth < REBEL_SURRENDER_MIN_WEALTH) {
            next.isPeaceRequesting = true;
            next.peaceTribute = 0;
            next.lastPeaceRequestDay = tick;
            logs.push(`🏳️ ${next.name} 财富已耗尽（剩余 ${Math.floor(rebelWealth)} 银币），无法维持战争，被迫投降！`);
            return;
        }
    }

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

    // [PERFORMANCE OPTIMIZATION] Destroyed nations cannot take military actions
    if (next.isAnnexed || (next.population || 0) <= 0) {
        return { raidPopulationLoss };
    }

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
        // [BALANCE] Increased cooldown: 15-45 days (was 7-31 days)
        next.militaryCooldownDays = Math.max(10, 15 + Math.floor(Math.random() * 30) + cooldownBonus);
    }
    const canTakeMilitaryAction = (tick - lastMilitaryActionDay) >= next.militaryCooldownDays;

    const disadvantage = Math.max(0, -(next.warScore || 0));
    // [BALANCE] Reduced action chance: base 1.5% (was 2%), max 12% (was 18%)
    let actionChance = Math.min(0.12, 0.015 + (next.aggression || 0.2) * 0.03 + disadvantage / 500);

    // Apply difficulty modifier to action chance
    actionChance = applyMilitaryActionModifier(actionChance, difficultyLevel);

    if (!canTakeMilitaryAction || Math.random() >= actionChance) {
        return { raidPopulationLoss };
    }

    // Record action time and reset cooldown (with difficulty bonus)
    next.lastMilitaryActionDay = tick;
    // [BALANCE] Increased cooldown: 15-45 days (was 7-31 days)
    next.militaryCooldownDays = Math.max(10, 15 + Math.floor(Math.random() * 30) + cooldownBonus);

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
const getNationFrontPeaceContext = (nationId, fronts = []) => {
    const relevantFronts = (fronts || []).filter((front) => front?.status === 'active' && (front.attackerId === nationId || front.defenderId === nationId));
    if (relevantFronts.length === 0) {
        return {
            frontCount: 0,
            isPressingPlayerCore: false,
            isAdvancing: false,
            favorableFrontCount: 0,
            pressureFrontCount: 0,
            averageRelativePosition: 50,
            strengthRatio: 1,
        };
    }

    let favorableFrontCount = 0;
    let pressureFrontCount = 0;
    let totalRelativePosition = 0;
    let ownUnits = 0;
    let enemyUnits = 0;

    relevantFronts.forEach((front) => {
        const side = front.attackerId === nationId ? 'attacker' : 'defender';
        const enemySide = side === 'attacker' ? 'defender' : 'attacker';
        const relativePosition = side === 'attacker'
            ? Number(front.linePosition || 50)
            : 100 - Number(front.linePosition || 50);
        totalRelativePosition += relativePosition;
        if (relativePosition >= 65) favorableFrontCount += 1;
        if (relativePosition <= 35) pressureFrontCount += 1;
        ownUnits += Number(front.sideState?.[side]?.deployedUnits || 0);
        enemyUnits += Number(front.sideState?.[enemySide]?.deployedUnits || 0);
    });

    return {
        frontCount: relevantFronts.length,
        isPressingPlayerCore: favorableFrontCount > 0 && relevantFronts.some((front) => {
            const side = front.attackerId === nationId ? 'attacker' : 'defender';
            const relativePosition = side === 'attacker'
                ? Number(front.linePosition || 50)
                : 100 - Number(front.linePosition || 50);
            return relativePosition >= 65;
        }),
        isAdvancing: favorableFrontCount > pressureFrontCount,
        favorableFrontCount,
        pressureFrontCount,
        averageRelativePosition: totalRelativePosition / Math.max(1, relevantFronts.length),
        strengthRatio: ownUnits / Math.max(1, enemyUnits),
    };
};

const getNationNegotiationContext = (nation, activeFronts = []) => {
    const frontContext = getNationFrontPeaceContext(nation?.id, activeFronts);
    // warScore 正值 = 攻击方（AI）优势，负值 = 防御方（玩家）优势
    // playerAdvantageScore 正值应表示玩家占优，所以需要取反
    const playerAdvantageScore = -Number(nation?.warScore || 0);
    const aiAdvantageScore = -playerAdvantageScore;
    const aiDominantOnFront = frontContext.frontCount > 0 && (
        frontContext.isPressingPlayerCore
        || frontContext.averageRelativePosition >= 58
        || (frontContext.averageRelativePosition >= 54 && frontContext.strengthRatio >= 1.15)
    );
    const aiUnderFrontPressure = frontContext.frontCount > 0 && (
        frontContext.averageRelativePosition <= 42
        || frontContext.pressureFrontCount > frontContext.favorableFrontCount
        || frontContext.strengthRatio <= 0.9
    );

    return {
        frontContext,
        playerAdvantageScore,
        aiAdvantageScore,
        aiDominantOnFront,
        aiUnderFrontPressure,
    };
};

export const checkAIPeaceRequest = ({
    nation,
    tick,
    lastGlobalPeaceRequest = -Infinity,
    logs,
    activeFronts = [],
}) => {
    const next = nation;

    if (next.isAnnexed || (next.population || 0) <= 0) {
        return false;
    }

    // === 战线极端压制：跳过冷却检查，直接强制求和 ===
    // 战线被推到 85%+（AI 视角 <= 15）时，不受任何冷却期限制
    {
        const emergencyFrontContext = getNationFrontPeaceContext(next.id, activeFronts);
        if (emergencyFrontContext.frontCount > 0 && emergencyFrontContext.averageRelativePosition <= 15) {
            const warScore = Math.abs(next.warScore || 0);
            const enemyLosses = next.enemyLosses || 0;
            const availableWealth = Math.max(0, next.wealth || 0);
            const baseTribute = calculateAIPeaceTribute(Math.max(warScore, 5), enemyLosses, next.warDuration || 0, availableWealth);
            const tribute = Math.floor(baseTribute);
            logs.push(`🤝 ${next.name} 请求和平，愿意支付 ${tribute.toLocaleString('fullwide', { useGrouping: false })} 银币作为赔款。首都已岌岌可危，被迫求和。`);
            next.isPeaceRequesting = true;
            next.peaceTribute = tribute;
            next.lastPeaceRequestDay = tick;
            return true;
        }
    }

    const lastPeaceRequestDay = Number.isFinite(next.lastPeaceRequestDay)
        ? next.lastPeaceRequestDay
        : -Infinity;

    const canRequestPeace = (tick - lastPeaceRequestDay) >= PEACE_REQUEST_COOLDOWN_DAYS;

    const globalCooldown = GLOBAL_PEACE_REQUEST_COOLDOWN_DAYS;
    const globalReady = (tick - lastGlobalPeaceRequest) >= globalCooldown;

    if (!canRequestPeace || !globalReady) {
        return false;
    }

    const negotiationContext = getNationNegotiationContext(next, activeFronts);
    const { frontContext, aiDominantOnFront, playerAdvantageScore } = negotiationContext;
    const warDuration = next.warDuration || 0;
    const aggression = next.aggression || 0.3;

    if (frontContext.isPressingPlayerCore && playerAdvantageScore < 400) {
        return false;
    }

    let willingness = 0;
    let tributeMultiplier = 1.0;

    if (playerAdvantageScore > 100) {
        // === 路径1：分数驱动（玩家明显占优，warScore可达±1000+） ===
        willingness = Math.min(0.5, 0.03 + playerAdvantageScore / 1200 + warDuration / 400)
            + Math.min(0.15, (next.enemyLosses || 0) / 500);
        tributeMultiplier = 1.0;
    } else if (warDuration >= 100) {
        // === 路径2：持久战/僵局（对应AI-AI战争的 warFatigue + exhaustionEndChance） ===
        willingness = Math.min(0.15, (warDuration - 100) / 800);

        const warExpense = next.warTotalExpense || 0;
        const currentWealth = Math.max(1, next.wealth || 500);
        willingness += Math.min(0.08, (warExpense / currentWealth) * 0.03);

        const isStalemate = frontContext.frontCount > 0
            && Math.abs(frontContext.averageRelativePosition - 50) < 15
            && Math.abs(playerAdvantageScore) < 250;
        if (isStalemate) {
            willingness += 0.04 + Math.min(0.08, (warDuration - 100) / 600);
        }

        willingness *= Math.max(0.15, 1.0 - aggression * 0.8);
        tributeMultiplier = 0.3;
    }

    // === 战线压制：战线被压到 65~85% 时大幅提升 willingness ===
    // （aiPos <= 15 的极端情况已在冷却检查前处理）
    if (frontContext.frontCount > 0) {
        const aiPos = frontContext.averageRelativePosition;
        if (aiPos <= 35) {
            const compressionBonus = Math.min(0.5, (35 - aiPos) / 20 * 0.5);
            willingness = Math.max(willingness, compressionBonus);
        }
    }

    if (willingness <= 0) {
        return false;
    }

    let frontDamageBonus = 0;
    if (activeFronts && activeFronts.length > 0) {
        for (const front of activeFronts) {
            if (front.attackerId !== next.id && front.defenderId !== next.id) continue;
            const ownInfra = (front.infrastructure || []).filter(i => i.owner === next.id);
            const destroyedCount = ownInfra.filter(i => i.destroyed).length;
            const ownNodes = (front.resourceNodes || []).filter(n => n.owner === next.id);
            const plunderedCount = ownNodes.filter(n => n.plundered).length;
            frontDamageBonus += destroyedCount * 0.04 + plunderedCount * 0.03;
        }
    }

    // currentFrontPenalty：仅在 AI 占优时扣减意愿（averageRelativePosition > 50 才有惩罚）
    const currentFrontPenalty = frontContext.frontCount > 0
        ? Math.max(0, (frontContext.averageRelativePosition - 50) / 18) + Math.max(0, (frontContext.strengthRatio - 1) * 0.12)
        : 0;

    // aiDominantOnFront 改为软惩罚：大幅降低意愿但不完全阻断
    if (aiDominantOnFront) {
        willingness *= (playerAdvantageScore > 400) ? 0.3 : 0.12;
    }

    const effectivePeaceChance = Math.max(0, willingness + frontDamageBonus - currentFrontPenalty);

    if (Math.random() < effectivePeaceChance) {
        const warScore = Math.abs(next.warScore || 0);
        const enemyLosses = next.enemyLosses || 0;
        const availableWealth = Math.max(0, next.wealth || 0);
        const baseTribute = calculateAIPeaceTribute(Math.max(warScore, 5), enemyLosses, warDuration, availableWealth);
        const tribute = Math.floor(baseTribute * tributeMultiplier);
        const tributeInt = Math.floor(tribute);
        logs.push(`🤝 ${next.name} 请求和平，愿意支付 ${tributeInt.toLocaleString('fullwide', { useGrouping: false })} 银币作为赔款。`);
        next.isPeaceRequesting = true;
        next.peaceTribute = tribute;
        next.lastPeaceRequestDay = tick;
        return true;
    }

    return false;
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
    activeFronts = [],
}) => {
    const next = nation;

    // [PERFORMANCE OPTIMIZATION] Destroyed nations cannot demand surrender
    if (next.isAnnexed || (next.population || 0) <= 0) {
        return;
    }

    const negotiationContext = getNationNegotiationContext(next, activeFronts);
    const aiWarScore = negotiationContext.aiAdvantageScore;

    if (aiWarScore > 200 && (next.warDuration || 0) > 30 && !negotiationContext.aiUnderFrontPressure) {
        const lastDemandDay = next.lastSurrenderDemandDay || 0;
        const surrenderChance = Math.min(0.15, 0.03 + (aiWarScore - 200) / 8000);
        if (tick - lastDemandDay >= 45 && Math.random() < surrenderChance) {
            next.lastSurrenderDemandDay = tick;

            let demandType = 'tribute';
            const warDuration = next.warDuration || 0;
            let demandAmount = calculateAISurrenderDemand(aiWarScore, warDuration, playerWealth);

            if (aiWarScore > 800) {
                demandType = 'territory';
                demandAmount = Math.min(50, Math.max(3, Math.floor(population * 0.05)));
            } else if (aiWarScore > 400 && Math.random() < 0.5) {
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
    activeFronts = [],
}) => {
    const next = nation;
    const negotiationContext = getNationNegotiationContext(next, activeFronts);
    const warScore = negotiationContext.playerAdvantageScore;

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

    if (negotiationContext.aiUnderFrontPressure) {
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
    let mercyChance = Math.min(0.5, Math.max(0.1, baseChance - aggressionPenalty));
    if (negotiationContext.aiDominantOnFront) {
        mercyChance += 0.08;
    }
    if (negotiationContext.aiAdvantageScore >= 600 && negotiationContext.frontContext.isPressingPlayerCore) {
        mercyChance = Math.max(0.05, mercyChance - 0.2);
    }

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

    // [FIX] Vassals cannot declare war on overlord (independence wars handled by vassalSystem)
    if (next.vassalOf === 'player') {
        return;
    }

    // [PERFORMANCE OPTIMIZATION] Destroyed nations cannot declare war
    // Skip annexed nations or nations with zero population
    if (next.isAnnexed || (next.population || 0) <= 0) {
        return;
    }

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

    // [NEW] Military industry chain deterrence
    // AI is less likely to attack nations with strong military industry
    if (res && epoch >= 2) {
        const militaryResources = ['swords', 'plate_armor', 'gunpowder', 'muskets', 'rifles', 'ammunition', 'ordnance'];
        const availableTypes = militaryResources.filter(r => (res[r] || 0) > 10);
        // Each type of military resource in stock reduces war chance
        const industryDeterrence = Math.min(0.6, availableTypes.length * 0.08);
        declarationChance *= (1 - industryDeterrence);
    }

    // Check conditions
    const hasPeaceTreaty = next.peaceTreatyUntil && tick < next.peaceTreatyUntil;
    // Fixed: Use formal alliance status instead of relation-based check
    const isPlayerAlly = areNationsAllied(next.id, 'player', diplomacyOrganizations?.organizations);

    // [NEW] 军团余量权衡：没有空闲军团时大幅降低宣战意愿
    const forcePool = next.military?.forcePool;
    const totalCorps = forcePool?.targetCorps || 1;
    const activeCorps = forcePool?.activeCorps || 0;
    const idleCorps = Math.max(0, totalCorps - activeCorps);
    if (idleCorps === 0 && totalCorps > 0) {
        // 所有军团已部署，几乎不会再开新战
        declarationChance *= 0.05;
    } else if (idleCorps <= 1) {
        // 仅剩1个空闲军团，谨慎开战
        declarationChance *= 0.3;
    }

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
        trackAIWar(next.id);
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

        // [NEW] Military Alliance Auto-Join: Player's alliance members automatically join war against attacker
        // But only if they are NOT allied with the attacker (allies cannot fight allies)
        if (nations && diplomacyOrganizations?.organizations) {
            const orgs = diplomacyOrganizations.organizations;
            const playerAllies = getAllianceMembers('player', orgs);

            playerAllies.forEach(allyId => {
                const ally = nations.find(n => n.id === allyId);
                if (!ally) return;

                // Skip if ally is already at war with attacker
                if (ally.foreignWars?.[next.id]?.isAtWar) return;

                // Skip if ally has peace treaty with attacker
                const peaceUntil = ally.foreignWars?.[next.id]?.peaceTreatyUntil || 0;
                if (tick < peaceUntil) return;

                // CRITICAL: Check if ally is also allied with the attacker
                // If so, they remain neutral (allies cannot fight allies)
                if (areNationsAllied(ally.id, next.id, orgs)) {
                    logs.push(`⚖️ ${ally.name} 同时是你和 ${next.name} 的盟友，选择保持中立。`);
                    return;
                }

                // CRITICAL: Vassals cannot be forced to fight their overlord through alliance obligations
                if (ally.vassalOf === 'player') {
                    logs.push(`⚖️ ${ally.name} 作为你的附庸国，不会因同盟义务对你作战。`);
                    return;
                }

                // Ally joins war against attacker
                if (!next.foreignWars) next.foreignWars = {};
                if (!ally.foreignWars) ally.foreignWars = {};

                next.foreignWars[ally.id] = { isAtWar: true, warStartDay: tick, warScore: 0 };
                ally.foreignWars[next.id] = {
                    isAtWar: true,
                    warStartDay: tick,
                    warScore: 0,
                    followingAlliance: true,  // Mark this war as following alliance obligation
                    allianceTarget: 'player'  // Track which ally they're defending
                };
                logs.push(`⚔️ ${ally.name} 响应军事同盟义务，对 ${next.name} 宣战！`);
            });
        }
    }

    // Wealth-based war check (also respects minWarEpoch from difficulty)
    const playerWealth = (res.food || 0) + (res.silver || 0) + (res.wood || 0);
    const aiEconomicScale = getNationEconomicScale(next, 500);
    const aiTreasury = getNationTreasury(next, 200);
    const aiMilitaryStrength = next.militaryStrength ?? 1.0;

    if (!next.isAtWar && !hasPeaceTreaty && !isPlayerAlly &&
        next.vassalOf !== 'player' && // [FIX] Vassals cannot declare regular wealth wars on overlord
        epoch >= minWarEpoch &&
        playerWealth > aiEconomicScale * 1.6 &&
        aiTreasury > 180 &&
        aiMilitaryStrength > 0.8 &&
        relation < 50 &&
        aggression > 0.4 &&
        currentWarsWithPlayer < MAX_CONCURRENT_WARS &&
        !recentWarDeclarations) {

        let wealthWarChance = 0.001 * aggression * (playerWealth / Math.max(1, aiEconomicScale) - 1);
        // Apply difficulty modifier
        wealthWarChance = applyWarDeclarationModifier(wealthWarChance, difficultyLevel);
        if (Math.random() < wealthWarChance) {
            next.isAtWar = true;
            next.warStartDay = tick;
            next.warDuration = 0;
            next.warDeclarationPending = true;
            trackAIWar(next.id);
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

            // [NEW] Military Alliance Auto-Join for Wealth War too
            if (nations && diplomacyOrganizations?.organizations) {
                const orgs = diplomacyOrganizations.organizations;
                const playerAllies = getAllianceMembers('player', orgs);

                playerAllies.forEach(allyId => {
                    const ally = nations.find(n => n.id === allyId);
                    if (!ally) return;

                    // Skip if ally is already at war with attacker
                    if (ally.foreignWars?.[next.id]?.isAtWar) return;

                    // Skip if ally has peace treaty with attacker
                    const peaceUntil = ally.foreignWars?.[next.id]?.peaceTreatyUntil || 0;
                    if (tick < peaceUntil) return;

                    // CRITICAL: Check if ally is also allied with the attacker
                    if (areNationsAllied(ally.id, next.id, orgs)) {
                        logs.push(`⚖️ ${ally.name} 同时是你和 ${next.name} 的盟友，选择保持中立。`);
                        return;
                    }

                    // CRITICAL: Vassals cannot be forced to fight their overlord through alliance obligations
                    if (ally.vassalOf === 'player') {
                        logs.push(`⚖️ ${ally.name} 作为你的附庸国，不会因同盟义务对你作战。`);
                        return;
                    }

                    // Ally joins war against attacker
                    if (!next.foreignWars) next.foreignWars = {};
                    if (!ally.foreignWars) ally.foreignWars = {};

                    next.foreignWars[ally.id] = { isAtWar: true, warStartDay: tick, warScore: 0 };
                    ally.foreignWars[next.id] = {
                        isAtWar: true,
                        warStartDay: tick,
                        warScore: 0,
                        followingAlliance: true,
                        allianceTarget: 'player'
                    };
                    logs.push(`⚔️ ${ally.name} 响应军事同盟义务，对 ${next.name} 宣战！`);
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
 * 评估战争目标：根据军力比、关系值和当前状态选择最合适的战争目标
 * @returns {Object|null} 战争目标对象（含 id），或 null 表示没有合适目标
 */
const evaluateWarGoal = (nation, target, strengthRatio, relation) => {
    const goals = AI_WAR_DECISION.WAR_GOALS;

    // 复仇：关系极差（<15），不论军力比
    if (relation < 15 && strengthRatio >= goals.revenge.minPowerRatio) {
        return goals.revenge;
    }
    // 附庸化：军力压倒性优势
    if (strengthRatio >= goals.vassal.minPowerRatio && (target.population || 50) < (nation.population || 100) * 0.6) {
        return goals.vassal;
    }
    // 割地：中高军力优势 + 有领土争端动机（关系差）
    if (strengthRatio >= goals.annex_border.minPowerRatio && relation < 40) {
        return goals.annex_border;
    }
    // 索贡：有一定优势，最温和的目标
    if (strengthRatio >= goals.tribute.minPowerRatio) {
        return goals.tribute;
    }
    // 先发制人：对方正在备战对我、或对方正在和别人打仗
    const targetPrep = target.warPreparation;
    const targetBusy = Object.values(target.foreignWars || {}).filter(w => w?.isAtWar).length > 0;
    if ((targetPrep?.targetId === nation.id || targetBusy) && strengthRatio >= goals.preemptive.minPowerRatio) {
        return goals.preemptive;
    }

    return null; // 没有合适的战争目标
};

/**
 * 处理所有 AI 国家的备战状态（每 tick 调用）
 * - 检查备战取消条件（军力下降）
 * - 备战期到期后交由 processAIAIWarDeclaration 执行实际宣战
 * @param {Array} visibleNations
 * @param {number} tick
 * @param {Array} logs
 */
export const processAIWarPreparations = (visibleNations, tick, logs) => {
    for (const nation of visibleNations) {
        if (!nation.warPreparation) continue;
        const prep = nation.warPreparation;

        // 找到目标国
        const target = visibleNations.find(n => n.id === prep.targetId);
        if (!target || target.isAnnexed) {
            // 目标不存在或已灭亡，取消备战
            delete nation.warPreparation;
            continue;
        }

        // 计算当前军力比
        const myPower = (nation.militaryStrength ?? 1.0) * (nation.population || 100);
        const targetPower = (target.militaryStrength ?? 1.0) * (target.population || 100);
        const currentRatio = myPower / Math.max(1, targetPower);

        // 获取战争目标要求的最低军力比
        const goalConfig = AI_WAR_DECISION.WAR_GOALS[prep.warGoal];
        const minRequired = (goalConfig?.minPowerRatio || 1.0) * AI_WAR_DECISION.PREPARATION_CANCEL_RATIO;

        // 军力比跌到目标的 70% 以下 → 取消备战
        if (currentRatio < minRequired && prep.warGoal !== 'revenge') {
            delete nation.warPreparation;
            logs.push(`📉 ${nation.name} 取消了军事动员（实力不足）`);
            continue;
        }

        // 备战期间效果：提升军事配比标记（在 AIEconomyService 中读取）
        nation._isPreparingWar = true;
    }
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
        // [FIX] Skip annexed nations
        if (nation.isAnnexed) return;

        if (!nation.foreignWars) nation.foreignWars = {};

        visibleNations.forEach(otherNation => {
            // [FIX] Skip annexed nations as targets
            if (otherNation.isAnnexed) return;

            if (otherNation.id === nation.id) return;
            if (nation.foreignWars[otherNation.id]?.isAtWar) return;

            const peaceUntil = nation.foreignWars[otherNation.id]?.peaceTreatyUntil || 0;
            if (tick < peaceUntil) return;

            const isAllied = areNationsAllied(nation.id, otherNation.id, diplomacyOrganizations?.organizations);
            if (isAllied) return;

            // [FIX] Check for Vassal/Suzerain relationship - standard wars not allowed
            // This includes both AI-AI vassal relationships AND player vassal relationships
            if (nation.vassalOf === otherNation.id || otherNation.vassalOf === nation.id) return;

            // CRITICAL: Vassals CANNOT attack their overlord (player) under ANY circumstances
            // This applies to all military policies including "autonomous"
            // Even if vassal has "autonomous" policy, they still cannot fight their overlord
            if (nation.vassalOf === 'player' && otherNation.id === 'player') {
                // Vassal trying to attack player - absolutely forbidden
                return;
            }

            const currentWarCount = Object.values(nation.foreignWars || {}).filter(w => w?.isAtWar).length;
            const maxWarsAllowed = nation.aggression > 0.7 ? 2 : 1;
            if (currentWarCount >= maxWarsAllowed) return;

            const myPopulation = nation.population || 100;
            const myEconomyScale = getNationEconomicScale(nation, 500);
            const myTreasury = getNationTreasury(nation, 200);
            if (myPopulation < 30 || myTreasury < 180 || myEconomyScale < 350) return;

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
            // If otherNation is Player's Vassal, AI should consider Player's strength
            let vassalProtectionPenalty = 1.0;
            if (otherNation.vassalOf === 'player' && !nation.isAtWar) {
                // Calculate player side strength (all player's vassals)
                let playerSideStrength = 0;
                visibleNations.forEach(n => {
                    if (n.vassalOf === 'player') {
                        playerSideStrength += calculateNationPower(n);
                    }
                });
                // Add estimated player strength (use average of visible nations as proxy)
                const avgNationPower = visibleNations.reduce((sum, n) => sum + calculateNationPower(n), 0) / Math.max(1, visibleNations.length);
                playerSideStrength += avgNationPower * 2; // Player is assumed to be stronger than average

                // If attacker is weaker than player side, heavily reduce war chance
                if (mySideStrength < playerSideStrength * 0.7) {
                    vassalProtectionPenalty *= 0.1; // 90% reduction
                } else if (mySideStrength < playerSideStrength) {
                    vassalProtectionPenalty *= 0.3; // 70% reduction
                }

                // If AI has good relations with player, almost never attack vassal
                const relationWithPlayer = nation.relation ?? 50;
                if (relationWithPlayer > 70) {
                    vassalProtectionPenalty *= 0.02; // 98% reduction - almost never
                } else if (relationWithPlayer > 50) {
                    vassalProtectionPenalty *= 0.1; // 90% reduction
                } else if (relationWithPlayer > 30) {
                    vassalProtectionPenalty *= 0.5; // 50% reduction
                }
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

                const targetEconomyScale = getNationEconomicScale(otherNation, 500);
                if (targetEconomyScale > myEconomyScale * 1.3 && strengthRatio > 0.8) {
                    const economicWarBonus = 0.002 * aggression * (targetEconomyScale / Math.max(1, myEconomyScale) - 1);
                    warChance += economicWarBonus;
                }

                warChance = Math.min(0.003, warChance);

                // [NEW] Apply vassal protection penalty if attacking player's vassal
                warChance *= vassalProtectionPenalty;

                if (Math.random() < warChance) {
                    // === 战争目标评估 ===
                    const warGoal = evaluateWarGoal(nation, otherNation, strengthRatio, relation);
                    if (!warGoal) return; // 没有合适的战争目标

                    // === 备战阶段：先进入备战，到期后才宣战 ===
                    if (!nation.warPreparation) {
                        // 进入备战阶段
                        const aggr = nation.aggression ?? 0.3;
                        const prepTicks = AI_WAR_DECISION.PREPARATION_BASE_TICKS
                            + Math.floor((1 - aggr) * AI_WAR_DECISION.PREPARATION_AGGRESSION_SCALE);
                        nation.warPreparation = {
                            targetId: otherNation.id,
                            warGoal: warGoal.id,
                            startTick: tick,
                            readyTick: tick + prepTicks,
                        };
                        logs.push(`🔔 情报：${nation.name} 似乎在进行军事动员...`);
                        return; // 不立即宣战，进入备战期
                    }

                    // 已在备战中：检查是否到期且目标一致
                    if (nation.warPreparation.targetId !== otherNation.id) return;
                    if (tick < nation.warPreparation.readyTick) return;

                    // 备战到期，清除备战状态，执行宣战
                    const declaredWarGoal = nation.warPreparation.warGoal;
                    delete nation.warPreparation;

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
                    nation.foreignWars[otherNation.id] = { isAtWar: true, warStartDay: tick, warScore: 0, warGoal: declaredWarGoal };
                    if (!otherNation.foreignWars) otherNation.foreignWars = {};
                    otherNation.foreignWars[nation.id] = { isAtWar: true, warStartDay: tick, warScore: 0 };
                    trackAIToAIWar(nation.id, otherNation.id);

                    const declarationNewsTemplates = [
                        `📢 国际新闻：${nation.name} 向 ${otherNation.name} 宣战了！`,
                        `📢 国际新闻：${nation.name} 正式对 ${otherNation.name} 宣战！`,
                        `📢 国际新闻：战争爆发！${nation.name} 对 ${otherNation.name} 发起了战争！`
                    ];
                    logs.push(declarationNewsTemplates[Math.floor(Math.random() * declarationNewsTemplates.length)]);

                    // [NEW] Suzerain Protection Logic
                    // [FIX] Only trigger if attacker is NOT also a vassal of the same overlord
                    if (otherNation.vassalOf === 'player' && nation.vassalOf !== 'player') {
                        if (!nation.isAtWar) {
                            nation.isAtWar = true;
                            nation.warStartDay = tick;
                            nation.warDuration = 0;
                            nation.warDeclarationPending = true;
                            trackAIWar(nation.id);

                            // [NEW] Add formal war declaration event so player sees a popup notification
                            logs.push(`WAR_DECLARATION_EVENT:${JSON.stringify({
                                nationId: nation.id,
                                nationName: nation.name,
                                reason: 'vassal_protection',
                                vassalId: otherNation.id,
                                vassalName: otherNation.name
                            })}`);

                            logs.push(`⚠️ ${nation.name} 攻击了您的附庸 ${otherNation.name}，自动对您宣战！`);
                        }
                    }



                    // ✅ Alliance aid request - check if player's military allies are involved
                    const allianceOrgs = diplomacyOrganizations?.organizations || [];
                    const isOtherNationPlayerAlly = areNationsAllied('player', otherNation.id, allianceOrgs);
                    const isNationPlayerAlly = areNationsAllied('player', nation.id, allianceOrgs);
                    // ✅ FIX: Check if both nations are player's allies OR if they are allies with each other
                    const areTheyAllies = areNationsAllied(nation.id, otherNation.id, allianceOrgs);
                    const playerAlliesInConflict = (isOtherNationPlayerAlly && isNationPlayerAlly) || areTheyAllies;
                    const currentPlayerWars = visibleNations.filter(n => n.isAtWar === true && !n.isRebelNation).length;

                    // Cooldown for ally aid requests (prevent spam) - tracked per ally
                    const ALLY_REQUEST_COOLDOWN = 30; // 30 days

                    if (playerAlliesInConflict) {
                        logs.push(`⚖️ 你的盟友 ${nation.name} 与 ${otherNation.name} 发生冲突，你选择保持中立。`);
                    } else {
                        // Case 1: Defender (otherNation) is player's ally -被攻击
                        if (isOtherNationPlayerAlly && !nation.isAtWar) {
                            const lastRequestDay = otherNation.lastAllyRequestDay || 0;
                            if (tick - lastRequestDay >= ALLY_REQUEST_COOLDOWN) {
                                otherNation.lastAllyRequestDay = tick;
                                logs.push(`ALLY_ATTACKED_EVENT:${JSON.stringify({
                                    allyId: otherNation.id,
                                    allyName: otherNation.name,
                                    attackerId: nation.id,
                                    attackerName: nation.name,
                                    currentPlayerWars
                                })}`);
                            }
                        }
                        // Case 2: Attacker (nation) is player's ally - 主动宣战
                        if (isNationPlayerAlly && !otherNation.isAtWar) {
                            const lastRequestDay = nation.lastAllyRequestDay || 0;
                            if (tick - lastRequestDay >= ALLY_REQUEST_COOLDOWN) {
                                nation.lastAllyRequestDay = tick;
                                // Only auto-join if player isn't in too many wars
                                if (currentPlayerWars >= MAX_CONCURRENT_WARS) {
                                    logs.push(`⚖️ 你的盟友 ${nation.name} 向 ${otherNation.name} 宣战！但你已陷入多场战争，选择不介入。`);
                                } else {
                                    logs.push(`ALLY_ATTACKED_EVENT:${JSON.stringify({
                                        allyId: nation.id,
                                        allyName: nation.name,
                                        attackerId: otherNation.id,
                                        attackerName: otherNation.name,
                                        isOffensiveWar: true, // 标记为进攻性战争
                                        currentPlayerWars
                                    })}`);
                                }
                            }
                        }
                    }


                    // AI alliance chain (organization-based)
                    // ✅ Reuse allianceOrgs from above
                    const attackerAllies = getAllianceMembers(nation.id, allianceOrgs);
                    const defenderAllies = getAllianceMembers(otherNation.id, allianceOrgs);
                    const sharedAllies = new Set(attackerAllies.filter(id => defenderAllies.includes(id)));

                    defenderAllies.forEach(allyId => {
                        if (sharedAllies.has(allyId)) return;
                        if (allyId === nation.id || allyId === otherNation.id) return;
                        const ally = visibleNations.find(n => n.id === allyId);
                        if (!ally) return;

                        // 【修复】检查防御方盟友是否与攻击者在同一个军事联盟中
                        // 同一军事联盟的成员绝对不能相互开战
                        if (areNationsAllied(ally.id, nation.id, allianceOrgs)) {
                            logs.push(`⚖️ ${ally.name} 与 ${nation.name} 同属一个军事联盟，拒绝参战。`);
                            return;
                        }

                        // CRITICAL: Vassals cannot be forced to fight their overlord through alliance obligations
                        // Check if defender is player and ally is player's vassal
                        if (otherNation.id === 'player' && ally.vassalOf === 'player') {
                            logs.push(`⚖️ ${ally.name} 作为玩家的附庸国，不会因同盟义务对宗主作战。`);
                            return;
                        }
                        // Check if attacker is player and ally is player's vassal
                        if (nation.id === 'player' && ally.vassalOf === 'player') {
                            logs.push(`⚖️ ${ally.name} 作为玩家的附庸国，不会因同盟义务对宗主作战。`);
                            return;
                        }

                        if (!ally.foreignWars) ally.foreignWars = {};
                        ally.foreignWars[nation.id] = { isAtWar: true, warStartDay: tick, warScore: 0 };
                        if (!nation.foreignWars) nation.foreignWars = {};
                        nation.foreignWars[ally.id] = { isAtWar: true, warStartDay: tick, warScore: 0 };
                        logs.push(`⚔️ ${ally.name} 响应 ${otherNation.name} 的军事同盟，对 ${nation.name} 宣战！`);
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
/**
 * 计算多线战争兵力折减系数
 * @param {Object} nation - AI国家对象
 * @param {Array} allNations - 所有国家列表（用于检查极端战线）
 * @returns {{ ratio: number, activeWarCount: number, hasExtremeAIFront: boolean }}
 */
export const getMultiWarStrengthRatio = (nation, allNations = []) => {
    const activeWars = Object.entries(nation.foreignWars || {}).filter(([, w]) => w?.isAtWar);
    const activeWarCount = activeWars.length;
    if (activeWarCount <= 1) return { ratio: 1.0, activeWarCount, hasExtremeAIFront: false };

    // 基础折减: 1 / sqrt(activeWarCount)
    const ratio = 1 / Math.sqrt(activeWarCount);

    // 检查是否有极端AI-AI战线（linePosition <=15 或 >=85，从对方视角看）
    let hasExtremeAIFront = false;
    for (const [enemyId, w] of activeWars) {
        if (enemyId === 'player') continue; // 玩家战线不算AI-AI
        const lp = w.linePosition;
        if (lp != null && (lp <= 15 || lp >= 85)) {
            hasExtremeAIFront = true;
            break;
        }
    }

    return { ratio, activeWarCount, hasExtremeAIFront };
};

export const processAIAIWarProgression = (visibleNations, updatedNations, tick, logs, vassalDiplomacyRequests = null, epoch = null, militaryCorps = [], generals = []) => {
    // Create a set of visible nation IDs for quick lookup
    const visibleNationIds = new Set(visibleNations.map(n => n.id));

    // === AI-AI 战争军团分配：每个国家的有限军团按战线优先级分配到各场战争 ===
    // Map<nationId, Map<enemyId, Set<corpsId>>>
    const aiWarCorpsAlloc = new Map();
    for (const nation of visibleNations) {
        if (!nation?.foreignWars) continue;
        const nationId = nation.id;
        const activeEnemyIds = Object.entries(nation.foreignWars)
            .filter(([eid, w]) => w?.isAtWar && eid !== nationId)
            .map(([eid]) => eid);
        if (activeEnemyIds.length === 0) continue;

        // 获取该国所有可用AI军团（按兵力降序）
        const availCorps = (militaryCorps || [])
            .filter(c => c?.isAI && c.nationId === nationId && getCorpsTotalUnits(c) > 0)
            .sort((a, b) => getCorpsTotalUnits(b) - getCorpsTotalUnits(a));
        if (availCorps.length === 0) continue;

        // 为每场战争评分（基于战线位置威胁程度）
        const scoredWars = activeEnemyIds.map(eid => {
            const war = nation.foreignWars[eid];
            const linePos = Number(war?.linePosition ?? 50);
            // linePos < 50 表示被敌人推进，越低越危险
            const threat = Math.max(0, (50 - linePos) / 50) * 3;
            // 基础优先级1.0 + 威胁分
            const priority = 1.0 + threat;
            return { enemyId: eid, priority };
        }).sort((a, b) => b.priority - a.priority);

        const allocMap = new Map();
        for (const sw of scoredWars) allocMap.set(sw.enemyId, new Set());

        // 第一轮：每场战争至少分1个军团
        let corpIdx = 0;
        for (const sw of scoredWars) {
            if (corpIdx >= availCorps.length) break;
            allocMap.get(sw.enemyId).add(availCorps[corpIdx].id);
            corpIdx++;
        }
        // 第二轮：剩余军团按优先级权重分配
        while (corpIdx < availCorps.length) {
            let bestEid = scoredWars[0]?.enemyId;
            let minWeighted = Infinity;
            for (const sw of scoredWars) {
                const count = allocMap.get(sw.enemyId).size;
                const weighted = count - sw.priority * 0.5;
                if (weighted < minWeighted) {
                    minWeighted = weighted;
                    bestEid = sw.enemyId;
                }
            }
            if (!bestEid) break;
            allocMap.get(bestEid).add(availCorps[corpIdx].id);
            corpIdx++;
        }

        aiWarCorpsAlloc.set(nationId, allocMap);
    }

    // [FIX] Deduplicate war pairs — each A↔B war should only be processed once per tick
    const processedPairs = new Set();

    visibleNations.forEach(nation => {
        Object.keys(nation.foreignWars || {}).forEach(enemyId => {
            // [FIX] Prevent nation from attacking itself
            if (enemyId === nation.id) {
                // Clean up invalid self-war state
                delete nation.foreignWars[enemyId];
                return;
            }

            // [FIX] Skip if this war pair was already processed from the other side
            const pairKey = [nation.id, enemyId].sort().join('|');
            if (processedPairs.has(pairKey)) return;
            processedPairs.add(pairKey);

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

            // 修复 warStartDay 缺失：旧存档可能没有设置，回退为当前tick而非0
            if (!war.warStartDay) {
                war.warStartDay = tick;
            }

            if (!enemy.foreignWars) enemy.foreignWars = {};
            if (!enemy.foreignWars[nation.id] || !enemy.foreignWars[nation.id].isAtWar) {
                // 旧存档容错：对方记录缺失或被错误清除，重新同步战争状态
                enemy.foreignWars[nation.id] = {
                    isAtWar: true,
                    warStartDay: war.warStartDay || tick,
                    warScore: -(war.warScore || 0),
                    linePosition: 50,
                    lastCheckpointDay: war.warStartDay || tick,
                    destroyedBuildings: {},
                };
            }

            // 旧存档容错：补充缺失的战线字段
            if (war.linePosition == null) {
                war.linePosition = 50;
                war.lastCheckpointDay = war.warStartDay || tick;
                war.destroyedBuildings = war.destroyedBuildings || {};
            }

            // 初始化分数明细和战事日志（兼容旧存档）
            if (!war.warScoreBreakdown) {
                war.warScoreBreakdown = { checkpoint: 0, bonus: 0, occupation: 0 };
            }
            if (!war.warEvents) {
                war.warEvents = [];
            }
            const enemyWar = enemy.foreignWars[nation.id];
            if (enemyWar && enemyWar.linePosition == null) {
                enemyWar.linePosition = 50;
                enemyWar.lastCheckpointDay = enemyWar.warStartDay || tick;
                enemyWar.destroyedBuildings = enemyWar.destroyedBuildings || {};
            }

            const warDuration = tick - (war.warStartDay || tick);
            const warIntensity = Math.min(2.0, 1.0 + warDuration / 500);

            // === 经济衰减（极端战线时翻倍） ===
            let nationWealthDecay = 0.997 - (warIntensity * 0.0015);
            let enemyWealthDecay = 0.997 - (warIntensity * 0.0015);
            // 极端战线衰减加速：linePosition <=8 表示 nation 被深入，>=92 表示 enemy 被深入
            const lp = war.linePosition;
            if (lp <= 8) nationWealthDecay *= 0.997; // 翻倍衰减
            if (lp >= 92) enemyWealthDecay *= 0.997;

            const nationWarCount = Object.values(nation.foreignWars || {}).filter(w => w?.isAtWar).length;
            const enemyWarCount = Object.values(enemy.foreignWars || {}).filter(w => w?.isAtWar).length;
            const nationMultiWarPenalty = Math.pow(0.998, nationWarCount - 1);
            const enemyMultiWarPenalty = Math.pow(0.998, enemyWarCount - 1);

            const nationWarExpense = Math.max(1, Math.round(getNationAnnualOutput(nation, 500) * 0.0009 * warIntensity));
            const enemyWarExpense = Math.max(1, Math.round(getNationAnnualOutput(enemy, 500) * 0.0009 * warIntensity));
            nation.wealth = Math.max(100, (nation.wealth || 500) * nationWealthDecay * nationMultiWarPenalty - nationWarExpense);
            enemy.wealth = Math.max(100, (enemy.wealth || 500) * enemyWealthDecay * enemyMultiWarPenalty - enemyWarExpense);
            applyFrontlinePopulationCasualties({
                nation,
                enemy,
                linePosition: lp,
                warIntensity,
            });

            // === linePosition 推进（每tick） ===
            // 基于分配到本战线的实际军团战力计算有效战力
            const nationAllocCorps = aiWarCorpsAlloc.get(nation.id)?.get(enemyId);
            const enemyAllocCorps = aiWarCorpsAlloc.get(enemy.id)?.get(nation.id);
            const nationCorpsOnFront = nationAllocCorps
                ? (militaryCorps || []).filter(c => nationAllocCorps.has(c.id))
                : [];
            const enemyCorpsOnFront = enemyAllocCorps
                ? (militaryCorps || []).filter(c => enemyAllocCorps.has(c.id))
                : [];
            const nationCorpsPower = nationCorpsOnFront.reduce((s, c) => s + calculateCorpsCombatPower(c, getCorpsGeneral(generals, c.id), epoch), 0);
            const enemyCorpsPower = enemyCorpsOnFront.reduce((s, c) => s + calculateCorpsCombatPower(c, getCorpsGeneral(generals, c.id), epoch), 0);
            // 使用本战线实际军团战力；无军团数据时回退到国家宏观公式
            const nationEffStr = nationCorpsPower > 0 ? nationCorpsPower : (nation.militaryStrength ?? 1.0) * Math.sqrt(nation.population || 100) * (1 + (nation.aggression || 0.3));
            const enemyEffStr = enemyCorpsPower > 0 ? enemyCorpsPower : (enemy.militaryStrength ?? 1.0) * Math.sqrt(enemy.population || 100) * (1 + (enemy.aggression || 0.3));

            // 存储分配到本战线的军团ID列表供UI显示
            war.assignedCorpsIds = nationAllocCorps ? [...nationAllocCorps] : [];
            war.assignedEnemyCorpsIds = enemyAllocCorps ? [...enemyAllocCorps] : [];
            if (enemy.foreignWars[nation.id]) {
                enemy.foreignWars[nation.id].assignedCorpsIds = war.assignedEnemyCorpsIds;
                enemy.foreignWars[nation.id].assignedEnemyCorpsIds = war.assignedCorpsIds;
            }
            const totalStr = nationEffStr + enemyEffStr;

            // === [NEW] AI-AI 持续掠夺（每tick） ===
            // nation 视角：linePos > 65 表示推入 enemy 经济区，> 85 核心区
            // enemy 视角：linePos < 35 表示推入 nation 经济区，< 15 核心区
            const nationPlunders = calculateWarPlunder({
                targetWealth: enemy.wealth || 0,
                linePosition: war.linePosition,
                side: 'defender', // nation is attacker, plundering defender's territory
                raidMod: 1.0,
                unitRatio: nationEffStr > 0 && enemyEffStr > 0 ? nationEffStr / enemyEffStr : 1.0,
                efficiencyOverride: WAR_ECONOMY.AI_AI_PLUNDER_EFFICIENCY,
            });
            const enemyPlunders = calculateWarPlunder({
                targetWealth: nation.wealth || 0,
                linePosition: war.linePosition,
                side: 'attacker', // enemy is defender, plundering attacker's territory
                raidMod: 1.0,
                unitRatio: enemyEffStr > 0 && nationEffStr > 0 ? enemyEffStr / nationEffStr : 1.0,
                efficiencyOverride: WAR_ECONOMY.AI_AI_PLUNDER_EFFICIENCY,
            });
            if (nationPlunders.wealthPlundered > 0) {
                enemy.wealth = Math.max(100, (enemy.wealth || 500) - nationPlunders.wealthPlundered);
                nation.wealth = (nation.wealth || 500) + nationPlunders.wealthGained;
                nation.economyDirtyFlags = { ...(nation.economyDirtyFlags || {}), resourcesDirty: true };
                enemy.economyDirtyFlags = { ...(enemy.economyDirtyFlags || {}), resourcesDirty: true };
            }
            if (enemyPlunders.wealthPlundered > 0) {
                nation.wealth = Math.max(100, (nation.wealth || 500) - enemyPlunders.wealthPlundered);
                enemy.wealth = (enemy.wealth || 500) + enemyPlunders.wealthGained;
                nation.economyDirtyFlags = { ...(nation.economyDirtyFlags || {}), resourcesDirty: true };
                enemy.economyDirtyFlags = { ...(enemy.economyDirtyFlags || {}), resourcesDirty: true };
            }

            if (totalStr > 0) {
                // advanceRate 基础值 0.3~0.6/tick，根据战争强度微调
                const advanceRate = 0.3 + warIntensity * 0.15;
                const delta = ((nationEffStr - enemyEffStr) / totalStr) * advanceRate;
                const oldLinePos = war.linePosition;
                // linePosition > 50 表示 nation 占优（推入 enemy 领土），< 50 表示 enemy 占优
                war.linePosition = clamp(war.linePosition + delta, 5, 95);
                // 同步对方镜像（enemy 视角的 linePosition = 100 - nation 视角）
                if (enemy.foreignWars[nation.id]) {
                    enemy.foreignWars[nation.id].linePosition = 100 - war.linePosition;
                }

                // === checkpoint crossing 事件 ===
                const crossings = getCheckpointsCrossed(oldLinePos, war.linePosition);
                for (const { checkpoint, direction } of crossings) {
                    // 确定被侵入的区域类型
                    let zoneCategory = 'frontier';
                    let victimNation = null;
                    let attackerNation = null;
                    let scoreChange = 5; // 边境区默认
                    if (direction === 'forward') {
                        // nation 推进 → 进入 enemy 的区域
                        victimNation = enemy;
                        attackerNation = nation;
                        if (checkpoint >= 85) { zoneCategory = 'capital'; scoreChange = 15; }
                        else if (checkpoint >= 65) { zoneCategory = 'economic'; scoreChange = 10; }
                    } else {
                        // enemy 反推 → 进入 nation 的区域
                        victimNation = nation;
                        attackerNation = enemy;
                        if (checkpoint <= 15) { zoneCategory = 'capital'; scoreChange = 15; }
                        else if (checkpoint <= 35) { zoneCategory = 'economic'; scoreChange = 10; }
                    }

                    // warScore 增量（nation 视角正值=nation 优势）
                    const scoreDir = direction === 'forward' ? 1 : -1;
                    war.warScore = (war.warScore || 0) + scoreChange * scoreDir;
                    war.warScoreBreakdown.checkpoint = (war.warScoreBreakdown.checkpoint || 0) + scoreChange * scoreDir;
                    if (enemy.foreignWars[nation.id]) {
                        enemy.foreignWars[nation.id].warScore = -(war.warScore);
                    }

                    // 额外 checkpoint crossing 奖分：根据双方实力差产生 1~3 额外分
                    const strDiff = Math.abs(nationEffStr - enemyEffStr) / Math.max(1, totalStr);
                    const bonusScore = Math.round(clamp(strDiff * 8, 1, 3));
                    war.warScore = (war.warScore || 0) + bonusScore * scoreDir;
                    war.warScoreBreakdown.bonus = (war.warScoreBreakdown.bonus || 0) + bonusScore * scoreDir;
                    if (enemy.foreignWars[nation.id]) {
                        enemy.foreignWars[nation.id].warScore = -(war.warScore);
                    }

                    // 记录战事日志
                    const zoneName = zoneCategory === 'capital' ? '核心区' : zoneCategory === 'economic' ? '经济区' : '边境';
                    const eventText = direction === 'forward'
                        ? `${nation.name}推进至${enemy.name}的${zoneName}（+${scoreChange + bonusScore}分）`
                        : `${enemy.name}反推至${nation.name}的${zoneName}（${-(scoreChange + bonusScore)}分）`;
                    war.warEvents = [...(war.warEvents || []), { day: tick, text: eventText, score: (scoreChange + bonusScore) * scoreDir }].slice(-15);

                    // 人口流失
                    const popLoss = calculateWarPopulationLoss({ population: victimNation.population || 100, zoneCategory });
                    victimNation.population = reducePopulationWithFloor((victimNation.population || 100), popLoss.populationLoss);

                    // 经济损伤：被侵入方 wealth 按区域类型损伤
                    const wealthDmgRate = zoneCategory === 'capital' ? 0.08 : zoneCategory === 'economic' ? 0.04 : 0.02;
                    const wealthDmg = Math.floor((victimNation.wealth || 500) * wealthDmgRate);
                    victimNation.wealth = Math.max(100, (victimNation.wealth || 500) - wealthDmg);
                    // 攻方获得部分掠夺
                    attackerNation.wealth = (attackerNation.wealth || 500) + Math.floor(wealthDmg * 0.4);

                    // 按需生成虚拟建筑画像（仅在首次需要时生成）
                    if (!victimNation.virtualBuildings || Object.keys(victimNation.virtualBuildings).length === 0) {
                        // 优先使用传入的 epoch，其次使用 nation 自身的 epoch，最后回退到人口估算
                        const buildingEpoch = epoch != null ? epoch : (victimNation.epoch ?? Math.min(6, Math.floor((victimNation.population || 100) / 80)));
                        generateAIBuildingProfile(victimNation, buildingEpoch);
                    }
                    if (victimNation.virtualBuildings && Object.keys(victimNation.virtualBuildings).length > 0) {
                        const attackerStr = attackerNation === nation ? nationEffStr : enemyEffStr;
                        const victimStr = victimNation === nation ? nationEffStr : enemyEffStr;
                        const unitRatio = victimStr > 0 ? attackerStr / victimStr : 2.0;
                        const bldgDmg = calculateWarBuildingDamage({
                            targetNationId: victimNation.id,
                            isPlayerNation: false,
                            buildings: victimNation.virtualBuildings,
                            zoneCategory,
                            raidMod: 1.0,
                            existingDestroyed: war.destroyedBuildings?.[victimNation.id] || {},
                            nationWealth: victimNation.wealth || 500,
                            nationMilitaryStrength: victimNation.militaryStrength ?? 1.0,
                            enemyUnits: Math.round(attackerStr * 100),
                            unitRatio,
                        });
                        // 从 virtualBuildings 中真实扣减
                        for (const [bId, cnt] of Object.entries(bldgDmg.destroyedBuildings)) {
                            victimNation.virtualBuildings[bId] = Math.max(0, (victimNation.virtualBuildings[bId] || 0) - cnt);
                        }
                        victimNation.economyDirtyFlags = {
                            ...(victimNation.economyDirtyFlags || {}),
                            buildingsDirty: true,
                            laborDirty: true,
                            resourcesDirty: true,
                            warDirty: true,
                        };
                        // 同步处理外资建筑破坏：被破坏的建筑可能命中外资部分
                        const foreignDamaged = {};
                        if (victimNation.virtualBuildingsForeign) {
                            for (const [bId, cnt] of Object.entries(bldgDmg.destroyedBuildings)) {
                                const foreignCount = victimNation.virtualBuildingsForeign[bId] || 0;
                                if (foreignCount > 0) {
                                    // 外资建筑和本地建筑被破坏概率相同，按比例分配
                                    const totalBefore = (victimNation.virtualBuildings[bId] || 0) + cnt; // 破坏前总量
                                    const foreignRatio = foreignCount / Math.max(1, totalBefore);
                                    const foreignDmg = Math.min(foreignCount, Math.round(cnt * foreignRatio));
                                    if (foreignDmg > 0) {
                                        victimNation.virtualBuildingsForeign[bId] = Math.max(0, foreignCount - foreignDmg);
                                        foreignDamaged[bId] = (foreignDamaged[bId] || 0) + foreignDmg;
                                    }
                                }
                            }
                        }
                        // 记录外资破坏到 war 日志（供战后结算用）
                        if (Object.keys(foreignDamaged).length > 0) {
                            if (!war.foreignBuildingsDamaged) war.foreignBuildingsDamaged = {};
                            if (!war.foreignBuildingsDamaged[victimNation.id]) war.foreignBuildingsDamaged[victimNation.id] = {};
                            for (const [bId, cnt] of Object.entries(foreignDamaged)) {
                                war.foreignBuildingsDamaged[victimNation.id][bId] = (war.foreignBuildingsDamaged[victimNation.id][bId] || 0) + cnt;
                            }
                        }
                        // 累计到 war.destroyedBuildings
                        if (!war.destroyedBuildings[victimNation.id]) war.destroyedBuildings[victimNation.id] = {};
                        for (const [bId, cnt] of Object.entries(bldgDmg.destroyedBuildings)) {
                            war.destroyedBuildings[victimNation.id][bId] = (war.destroyedBuildings[victimNation.id][bId] || 0) + cnt;
                        }
                        // 同步对方 war 的 destroyedBuildings
                        if (enemy.foreignWars[nation.id]) {
                            enemy.foreignWars[nation.id].destroyedBuildings = { ...war.destroyedBuildings };
                        }
                        // 建筑产出价值折算 wealth 损失
                        victimNation.wealth = Math.max(100, (victimNation.wealth || 500) - bldgDmg.wealthLoss);
                    }

                    // 日志（zoneName已在前面声明）
                    logs.push(`⚔️ ${attackerNation.name} 战线推进至 ${victimNation.name} 的${zoneName}（战线位置: ${Math.round(war.linePosition)}）`);
                    war.lastCheckpointDay = tick;
                }
            }

            // === 持续占领 warScore（每5天根据战线位置累积） ===
            if (warDuration > 0 && warDuration % 5 === 0) {
                const posOffset = war.linePosition - 50; // >0 nation优势, <0 enemy优势
                if (Math.abs(posOffset) > 5) {
                    // 偏离中线越远，每5天积累越多分数（1~4分）
                    const occupationScore = Math.round(clamp(Math.abs(posOffset) / 12, 1, 4));
                    const occupationDir = posOffset > 0 ? 1 : -1;
                    war.warScore = (war.warScore || 0) + occupationScore * occupationDir;
                    war.warScoreBreakdown.occupation = (war.warScoreBreakdown.occupation || 0) + occupationScore * occupationDir;
                    if (enemy.foreignWars[nation.id]) {
                        enemy.foreignWars[nation.id].warScore = -(war.warScore);
                    }
                }
            }

            // === 同步分数明细和战事日志到对方 ===
            if (enemy.foreignWars[nation.id]) {
                // 对方视角的分数明细取反
                enemy.foreignWars[nation.id].warScoreBreakdown = {
                    checkpoint: -(war.warScoreBreakdown?.checkpoint || 0),
                    bonus: -(war.warScoreBreakdown?.bonus || 0),
                    occupation: -(war.warScoreBreakdown?.occupation || 0),
                };
                enemy.foreignWars[nation.id].warEvents = war.warEvents || [];
            }

            // === 存储双方有效战力供UI显示 ===
            war.nationEffStr = Math.round(nationEffStr);
            war.enemyEffStr = Math.round(enemyEffStr);
            war.warIntensity = Math.round(warIntensity * 100) / 100;
            war.warDuration = warDuration;
            if (enemy.foreignWars[nation.id]) {
                enemy.foreignWars[nation.id].nationEffStr = Math.round(enemyEffStr);
                enemy.foreignWars[nation.id].enemyEffStr = Math.round(nationEffStr);
                enemy.foreignWars[nation.id].warIntensity = war.warIntensity;
                enemy.foreignWars[nation.id].warDuration = warDuration;
            }

            // === 战争疲劳累积（每 tick）===
            {
                const milLossRate = AI_WAR_DECISION.FATIGUE_MILITARY_LOSS_RATE;
                const wealthLossRate = AI_WAR_DECISION.FATIGUE_WEALTH_LOSS_RATE;
                // 用战争强度和 warScore 劣势来估算疲劳
                const nationMilRatio = clamp(1 - (nation.militaryStrength ?? 1) / Math.max(0.01, war.nationEffStr / 100), 0, 1);
                const nationWealthRatio = clamp(1 - getNationTreasury(nation, 100) / Math.max(1, getNationAnnualOutput(nation, 500) * 0.5), 0, 1);
                const scorePenalty = (war.warScore || 0) < -20 ? 0.002 : 0; // 劣势方额外疲劳
                const fatigueDelta = nationMilRatio * milLossRate + nationWealthRatio * wealthLossRate + scorePenalty;
                war.warFatigue = clamp((war.warFatigue || 0) + fatigueDelta, 0, 1);

                // 同步给敌方视角
                if (enemy.foreignWars[nation.id]) {
                    const enemyMilRatio = clamp(1 - (enemy.militaryStrength ?? 1) / Math.max(0.01, war.enemyEffStr / 100), 0, 1);
                    const enemyWealthRatio = clamp(1 - getNationTreasury(enemy, 100) / Math.max(1, getNationAnnualOutput(enemy, 500) * 0.5), 0, 1);
                    const enemyScorePenalty = (war.warScore || 0) > 20 ? 0.002 : 0;
                    const enemyFatigueDelta = enemyMilRatio * milLossRate + enemyWealthRatio * wealthLossRate + enemyScorePenalty;
                    enemy.foreignWars[nation.id].warFatigue = clamp((enemy.foreignWars[nation.id].warFatigue || 0) + enemyFatigueDelta, 0, 1);
                }
            }

            // === 战争结束判定（每10天检查一次） ===
            if ((tick - war.warStartDay) % 10 === 0 && tick > war.warStartDay) {
                if (!war.endScoreThreshold) {
                    war.endScoreThreshold = 25 + Math.floor(Math.random() * 56); // 25~80
                }

                const absoluteWarScore = Math.abs(war.warScore || 0);
                const nationExhausted = (nation.population || 100) < 30 || getNationTreasury(nation, 0) < Math.max(120, getNationAnnualOutput(nation, 500) * 0.01);
                const enemyExhausted = (enemy.population || 100) < 30 || getNationTreasury(enemy, 0) < Math.max(120, getNationAnnualOutput(enemy, 500) * 0.01);
                // 极端战线位置也可触发结束
                const extremePosition = war.linePosition <= 8 || war.linePosition >= 92;

                // 战争疲劳驱动的结束概率：结合 warGoal 的疲劳阈值
                const goalConfig = AI_WAR_DECISION.WAR_GOALS[war.warGoal] || AI_WAR_DECISION.WAR_GOALS.tribute;
                const fatigueThreshold = goalConfig.fatigueThreshold || 0.5;
                const nationFatigue = war.warFatigue || 0;
                const enemyFatigue = enemy.foreignWars?.[nation.id]?.warFatigue || 0;
                // 双方有任一方疲劳超过阈值，增加结束概率
                const fatigueOver = Math.max(nationFatigue - fatigueThreshold, enemyFatigue - fatigueThreshold, 0);
                const fatigueFactor = clamp(fatigueOver * 0.3 + (warDuration - 100) / 2000, 0, 0.20);
                const exhaustionEndChance = (nationExhausted || enemyExhausted) ? 0.03 + fatigueFactor : extremePosition ? 0.02 + fatigueFactor : 0.005 + fatigueFactor;

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

                    // linePosition 覆盖胜负等级：极端战线位置可提升胜利等级
                    const winnerLinePos = winner.id === nation.id ? war.linePosition : (100 - war.linePosition);
                    if (winnerLinePos >= 90 && victoryTier !== 'overwhelming') {
                        victoryTier = 'major';
                        populationTransferRate = Math.max(populationTransferRate, 0.15);
                        wealthTransferRate = Math.max(wealthTransferRate, 0.25);
                        peaceDuration = Math.max(peaceDuration, Math.floor(365 * 2.5));
                        tierName = '大胜';
                    } else if (winnerLinePos >= 80 && (victoryTier === 'draw' || victoryTier === 'pyrrhic')) {
                        victoryTier = 'minor';
                        populationTransferRate = Math.max(populationTransferRate, 0.08);
                        wealthTransferRate = Math.max(wealthTransferRate, 0.12);
                        peaceDuration = Math.max(peaceDuration, 365 * 2);
                        tierName = '小胜';
                    }

                    // 执行赔偿转移
                    const populationTransfer = Math.floor((loser.population || 100) * populationTransferRate);
                    const wealthTransfer = Math.floor((loser.wealth || 500) * wealthTransferRate);

                    winner.population = (winner.population || 100) + populationTransfer;
                    winner.wealth = (winner.wealth || 500) + wealthTransfer;
                    loser.population = reducePopulationWithFloor((loser.population || 100), populationTransfer);
                    loser.wealth = Math.max(100, (loser.wealth || 500) - wealthTransfer);

                    // 检查吞并条件：压倒性胜利 + 败方人口<30 + 财富<300
                    let isAnnexed = false;
                    if (victoryTier === 'overwhelming' &&
                        (loser.population || 100) < 30 &&
                        (loser.wealth || 500) < 300) {
                        // 执行吞并：获胜方获得败方全部资源
                        winner.population = (winner.population || 100) + (loser.population || 0);
                        winner.wealth = (winner.wealth || 500) + (loser.wealth || 0);
                        const loserBuildings = loser.virtualBuildings || {};
                        const loserForeignBuildings = loser.virtualBuildingsForeign || {};
                        const winnerBuildings = winner.virtualBuildings || {};
                        const winnerForeignBuildings = winner.virtualBuildingsForeign || {};
                        const winnerBaseline = winner.virtualBuildingsBaseline || winnerBuildings;

                        Object.entries(loserBuildings).forEach(([buildingId, count]) => {
                            const totalCount = Math.max(0, Number(count) || 0);
                            if (totalCount <= 0) return;
                            const foreignCount = Math.max(0, Number(loserForeignBuildings[buildingId]) || 0);
                            const localCount = Math.max(0, totalCount - foreignCount);
                            if (localCount > 0) {
                                winnerBuildings[buildingId] = (winnerBuildings[buildingId] || 0) + localCount;
                            }
                            if (foreignCount > 0) {
                                winnerForeignBuildings[buildingId] = (winnerForeignBuildings[buildingId] || 0) + foreignCount;
                            }
                        });

                        winner.virtualBuildings = { ...winnerBuildings };
                        winner.virtualBuildingsForeign = { ...winnerForeignBuildings };
                        winner.virtualBuildingsBaseline = Object.keys(winnerBaseline).length > 0
                            ? {
                                ...winnerBaseline,
                                ...Object.fromEntries(
                                    Object.entries(winner.virtualBuildings).map(([buildingId, count]) => [
                                        buildingId,
                                        Math.max(Number(winnerBaseline[buildingId]) || 0, Number(count) || 0),
                                    ])
                                ),
                            }
                            : { ...winner.virtualBuildings };
                        winner.economyDirtyFlags = {
                            ...(winner.economyDirtyFlags || {}),
                            buildingsDirty: true,
                            laborDirty: true,
                            resourcesDirty: true,
                            warDirty: true,
                            investmentDirty: Object.keys(winnerForeignBuildings).length > 0,
                        };
                        loser.isAnnexed = true;
                        loser.annexedBy = winner.id;
                        loser.annexedAt = tick;
                        loser.population = 0;
                        loser.wealth = 0;
                        // 清除虚拟建筑数据
                        delete loser.virtualBuildings;
                        delete loser.virtualBuildingsBaseline;
                        delete loser.virtualBuildingsForeign;
                        loser.economyDirtyFlags = {
                            ...(loser.economyDirtyFlags || {}),
                            buildingsDirty: true,
                            laborDirty: true,
                            resourcesDirty: true,
                            warDirty: true,
                        };
                        isAnnexed = true;
                    }

                    // 设置和平条约
                    nation.foreignWars[enemyId] = { isAtWar: false, peaceTreatyUntil: tick + peaceDuration };
                    enemy.foreignWars[nation.id] = { isAtWar: false, peaceTreatyUntil: tick + peaceDuration };
                    trackAIToAIPeace(nation.id, enemyId);

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

                    // 外资建筑被破坏通知（供 simulation.js 消费同步到 overseasInvestments）
                    const allForeignDamaged = war.foreignBuildingsDamaged || {};
                    for (const [victimId, damages] of Object.entries(allForeignDamaged)) {
                        const victimName = victimId === nation.id ? nation.name : enemy.name;
                        for (const [bId, cnt] of Object.entries(damages)) {
                            if (cnt > 0) {
                                const bDef = BUILDINGS.find(b => b.id === bId);
                                logs.push(`💼 你在 ${victimName} 的 ${bDef?.name || bId} ×${cnt} 在战争中被摧毁`);
                            }
                        }
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

// ========== AI Military Corps & Front Integration ==========

/**
 * Generate an AI corps from a nation's simulated military
 * AI nations don't have detailed army compositions; we generate one based on their stats
 * @param {Object} nation - AI nation object
 * @param {number} epoch - Current epoch
 * @returns {Object} A pseudo-corps object compatible with battleSystem
 */
export const generateAICorps = (nation, epoch) => {
    const targetCorps = clamp(
        Math.round(Number(nation?.military?.forcePool?.targetCorps || 1)),
        1,
        MAX_AI_TARGET_CORPS
    );
    const units = generateNationArmy(nation, epoch, 1 / targetCorps, 1.0);
    const militaryQuality = Math.max(0.7, Math.min(1.6, nation?.militaryQuality ?? nation?.militaryStrength ?? 1.0));

    return {
        id: `ai_corps_${nation.id}_${Date.now()}`,
        name: `${nation.name}远征军`,
        units,
        generalId: null,
        assignedFrontId: null,
        frontTask: 'assault',
        status: 'deployed',
        morale: 68 + Math.floor(militaryQuality * 20),
        isAI: true,
        nationId: nation.id,
    };
};

export const ensureAIMilitaryState = (nation, epoch = 0) => {
    if (!nation) return nation;
    const doctrine = pickDoctrine(nation, epoch);
    const organizationBase = 40 + epoch * 6 + Math.round((nation.militaryStrength || 0.8) * 18);
    const techLevel = Math.max(1, epoch + Math.round(getNationAnnualOutput(nation, 0) / 6000));
    const materielResource = getMaterielResourceForEpoch(epoch);
    const mergedForcePool = {
        targetCorps: Math.max(1, Math.min(5, Math.round((nation.population || 80) / 180) + (nation.isAtWar ? 1 : 0))),
        reserveRatio: nation.isAtWar ? 0.35 : 0.55,
        ...(nation.military?.forcePool || {}),
    };
    const sanitizedForcePool = {
        ...mergedForcePool,
        targetCorps: clamp(
            Math.round(Number(mergedForcePool.targetCorps || 1)),
            1,
            MAX_AI_TARGET_CORPS
        ),
        reserveRatio: clamp(Number(mergedForcePool.reserveRatio ?? 0.55), 0.1, 0.9),
    };

    const military = {
        organization: clamp(nation.military?.organization ?? organizationBase, 20, 100),
        doctrine: nation.military?.doctrine || doctrine.id,
        techLevel: nation.military?.techLevel || techLevel,
        techTags: Array.isArray(nation.military?.techTags) && nation.military.techTags.length > 0 ? nation.military.techTags : doctrine.techTags,
        forcePool: sanitizedForcePool,
        corpsTemplates: Array.isArray(nation.military?.corpsTemplates) ? nation.military.corpsTemplates : [],
        logistics: {
            throughput: clamp(nation.military?.logistics?.throughput ?? (0.8 + epoch * 0.08), 0.6, 2.5),
            flexibility: clamp(nation.military?.logistics?.flexibility ?? (0.9 + (nation.aggression || 0.3) * 0.4), 0.7, 1.6),
            supplyDiscipline: clamp(nation.military?.logistics?.supplyDiscipline ?? (0.8 + (organizationBase / 100) * 0.4), 0.7, 1.5),
            ...(nation.military?.logistics || {}),
        },
        frontPlans: nation.military?.frontPlans || {},
        budgetShare: clamp(nation.military?.budgetShare ?? (nation.isAtWar ? 0.22 : 0.14), 0.08, 0.35),
        stockpile: {
            food: Math.max(0, Math.round(nation.military?.stockpile?.food ?? ((nation.population || 100) * 0.9))),
            silver: Math.max(0, Math.round(nation.military?.stockpile?.silver ?? (getNationTreasury(nation, 300) * 0.75))),
            [materielResource]: Math.max(0, Math.round(nation.military?.stockpile?.[materielResource] ?? ((nation.population || 100) * 0.12 + epoch * 8))),
            // 军队维护所需的次要资源——根据时代自动补充合理储备
            wood: Math.max(0, Math.round(nation.military?.stockpile?.wood ?? ((nation.population || 100) * 0.2 + epoch * 5))),
            iron: Math.max(0, Math.round(nation.military?.stockpile?.iron ?? (epoch >= 2 ? (nation.population || 100) * 0.08 + epoch * 4 : 0))),
            copper: Math.max(0, Math.round(nation.military?.stockpile?.copper ?? (epoch >= 1 ? (nation.population || 100) * 0.06 + epoch * 3 : 0))),
            stone: Math.max(0, Math.round(nation.military?.stockpile?.stone ?? ((nation.population || 100) * 0.1 + epoch * 2))),
            cloth: Math.max(0, Math.round(nation.military?.stockpile?.cloth ?? (epoch >= 3 ? (nation.population || 100) * 0.04 + epoch * 2 : 0))),
            plank: Math.max(0, Math.round(nation.military?.stockpile?.plank ?? (epoch >= 3 ? (nation.population || 100) * 0.05 + epoch * 3 : 0))),
            gunpowder: Math.max(0, Math.round(nation.military?.stockpile?.gunpowder ?? (epoch >= 4 ? (nation.population || 100) * 0.03 + epoch * 4 : 0))),
            ammunition: Math.max(0, Math.round(nation.military?.stockpile?.ammunition ?? (epoch >= 5 ? (nation.population || 100) * 0.04 + epoch * 5 : 0))),
            steel: Math.max(0, Math.round(nation.military?.stockpile?.steel ?? (epoch >= 5 ? (nation.population || 100) * 0.03 + epoch * 3 : 0))),
            coal: Math.max(0, Math.round(nation.military?.stockpile?.coal ?? (epoch >= 5 ? (nation.population || 100) * 0.02 + epoch * 2 : 0))),
            ...(nation.military?.stockpile || {}),
        },
    };

    return {
        ...nation,
        military,
    };
};

export const syncAINationMilitary = ({
    nation,
    epoch = 0,
    currentDay = 0,
    militaryCorps = [],
    generals = [],
}) => {
    const nextNation = ensureAIMilitaryState(nation, epoch);
    const doctrine = AI_DOCTRINES[nextNation.military?.doctrine] || pickDoctrine(nextNation, epoch);
    const nationCorps = (militaryCorps || [])
        .filter((corps) => corps?.isAI && corps.nationId === nextNation.id)
        .filter((corps) => getCorpsTotalUnits(corps) > 0);
    const nationGenerals = (generals || []).filter((general) => nationCorps.some((corps) => corps.generalId === general.id));
    const targetCorps = clamp(
        Math.round(Number(nextNation.military?.forcePool?.targetCorps || 1)),
        1,
        MAX_AI_TARGET_CORPS
    );
    const baseIncomePulse = Math.max(
        1,
        Math.round(getNationAnnualOutput(nextNation, 0) * (nextNation.military?.budgetShare || 0.12) * 0.0025)
    );
    const baseFoodPulse = Math.max(1, Math.round((nextNation.population || 0) * 0.03));
    const materielKey = getMaterielResourceForEpoch(epoch);
    // 计算 AI 军队实际维护需求，按需补充各类资源
    const nationArmyUnits = nationCorps.reduce((army, corps) => {
        Object.entries(corps?.units || {}).forEach(([unitId, count]) => {
            if (count > 0) army[unitId] = (army[unitId] || 0) + count;
        });
        return army;
    }, {});
    const armyMaintenance = calculateArmyMaintenance(nationArmyUnits);
    // [FIX] 食物和银币的补充也需要覆盖军队维护需求，否则大军补给率会降为 0
    // 补充量 = max(基础人口/经济脉冲, 军队维护需求 × 1.2)，确保 AI 储备足以覆盖前线补给
    const foodPulse = Math.max(baseFoodPulse, Math.round((armyMaintenance.food || 0) * 1.2));
    const incomePulse = Math.max(baseIncomePulse, Math.round((armyMaintenance.silver || 0) * 1.2));
    // 所有资源统一用军队维护需求的 1.2 倍作为最低补充量
    const allResourcePulse = {};
    Object.entries(armyMaintenance).forEach(([resource, amount]) => {
        allResourcePulse[resource] = Math.max(1, Math.round(amount * 1.2));
    });
    const stockpileUpdate = {
        ...nextNation.military.stockpile,
        food: Math.max(0, Number(nextNation.military.stockpile?.food || 0) + foodPulse),
        silver: Math.max(0, Number(nextNation.military.stockpile?.silver || 0) + incomePulse),
        [materielKey]: Math.max(0, Number(nextNation.military.stockpile?.[materielKey] || 0) + Math.max(1, Math.round(incomePulse * 0.15))),
    };
    // 补充所有维护资源（含次要资源）
    Object.entries(allResourcePulse).forEach(([resource, pulse]) => {
        // food 和 silver 已在上面设置，此处补充其余（含 materielKey）
        if (resource !== 'food' && resource !== 'silver') {
            stockpileUpdate[resource] = Math.max(0, Number(stockpileUpdate[resource] || 0) + pulse);
        }
    });
    const updatedNation = {
        ...nextNation,
        military: {
            ...nextNation.military,
            stockpile: stockpileUpdate,
        },
    };

    const updatedCorps = nationCorps.map((corps, index) => {
        const baseMorale = Number.isFinite(Number(corps.morale)) ? Number(corps.morale) : 80;
        const standbyRecovery = !corps.assignedFrontId && baseMorale < 90 ? 1 : 0;
        return {
            ...corps,
            name: corps.name || `${nation.name}第${index + 1}军团`,
            frontTask: corps.frontTask || doctrine.preferredTasks[index % doctrine.preferredTasks.length] || 'assault',
            status: corps.assignedFrontId ? corps.status : 'idle',
            morale: clamp(Math.round(baseMorale + standbyRecovery), 20, 100),
            isAI: true,
            nationId: nation.id,
        };
    });


    const newCorps = [];
    const newGenerals = [];
    if (updatedCorps.length < targetCorps) {
        const missing = targetCorps - updatedCorps.length;
        for (let i = 0; i < missing; i += 1) {
            const corps = generateAICorps(updatedNation, epoch);
            corps.id = `ai_corps_${updatedNation.id}_${currentDay}_${i}_${Date.now()}`;
            corps.name = `${updatedNation.name}第${updatedCorps.length + i + 1}军团`;
            corps.frontTask = doctrine.preferredTasks[(updatedCorps.length + i) % doctrine.preferredTasks.length] || 'assault';
            corps.status = 'idle';
            corps.isAI = true;
            corps.nationId = updatedNation.id;

            const general = generateAIGeneral(updatedNation, epoch);
            if (general) {
                general.id = `ai_gen_${updatedNation.id}_${currentDay}_${i}_${Date.now()}`;
                general.assignedCorpsId = corps.id;
                corps.generalId = general.id;
                newGenerals.push(general);
            }

            newCorps.push(corps);
        }
    }

    const allNationCorps = [...updatedCorps, ...newCorps];
    const fieldedArmy = allNationCorps.reduce((army, corps) => {
        Object.entries(corps.units || {}).forEach(([unitId, count]) => {
            if (count > 0) {
                army[unitId] = (army[unitId] || 0) + count;
            }
        });
        return army;
    }, {});
    let totalUnits = allNationCorps.reduce((sum, corps) => sum + getCorpsTotalUnits(corps), 0);

    const sustainableTemplateArmy = generateNationArmy(updatedNation, epoch, 1.0, 1.0);
    const sustainableArmy = Math.max(
        10,
        Object.values(sustainableTemplateArmy).reduce((sum, count) => sum + (count || 0), 0)
    );

    // 低兵力回填：旧存档中已存在的 AI 军团也要向可持续兵力靠拢，避免长期停留在个位数。
    // [PERF] 批量分配代替逐个+1循环，O(corps) 替代 O(deficit)
    if (allNationCorps.length > 0 && totalUnits < sustainableArmy) {
        const deficit = sustainableArmy - totalUnits;
        const reinforcementUnitId = Object.entries(sustainableTemplateArmy)
            .sort((a, b) => (b[1] || 0) - (a[1] || 0))[0]?.[0] || 'militia';
        const receiverCorps = [...allNationCorps].sort((a, b) => getCorpsTotalUnits(b) - getCorpsTotalUnits(a));
        const perCorps = Math.floor(deficit / receiverCorps.length);
        const remainder = deficit % receiverCorps.length;
        for (let i = 0; i < receiverCorps.length; i++) {
            const add = perCorps + (i < remainder ? 1 : 0);
            if (add > 0) {
                const corps = receiverCorps[i];
                corps.units = { ...(corps.units || {}) };
                corps.units[reinforcementUnitId] = (corps.units[reinforcementUnitId] || 0) + add;
            }
        }
        totalUnits = allNationCorps.reduce((sum, corps) => sum + getCorpsTotalUnits(corps), 0);
    }

    // [FIX] Enforce population-based army cap: armies can't exceed what population can sustain
    // maxManpower >= 0 ensures the cap is enforced even when population is tiny (maxManpower=0)
    const population = updatedNation.population || 100;
    const wartimeMobilizationBonus = updatedNation.isAtWar ? 0.008 : 0;
    const manpowerRatio = Math.min(0.026, 0.008 + (epoch || 0) * 0.0015 + wartimeMobilizationBonus);
    const maxManpower = Math.floor(population * manpowerRatio * 1.1); // 1.1x slight buffer
    if (totalUnits > maxManpower && maxManpower >= 0) {
        const shrinkRatio = maxManpower / totalUnits;
        allNationCorps.forEach(corps => {
            if (corps.units) {
                Object.keys(corps.units).forEach(unitId => {
                    corps.units[unitId] = Math.max(1, Math.floor((corps.units[unitId] || 0) * shrinkRatio));
                });
            }
        });
    }

    const orgFactor = 0.7 + Number(updatedNation.military?.organization || 50) / 100 * 0.6;
    const techFactor = 0.8 + Number(updatedNation.military?.techLevel || 1) * 0.08;
    const supplyFactor = Math.min(1.3, 0.7 + Number(updatedNation.military?.logistics?.throughput || 1) * 0.35);
    const mobilizationFactor = totalUnits / sustainableArmy;
    updatedNation.militaryQuality = clamp(orgFactor * techFactor * supplyFactor, 0.7, 1.8);
    updatedNation.militaryStrength = clamp(mobilizationFactor * updatedNation.militaryQuality, 0.25, 2.4);

    // 多线战争信息记录（不再强制折减兵力，AI可自行决定兵力分配）
    const multiWar = getMultiWarStrengthRatio(updatedNation);
    if (multiWar.activeWarCount > 1) {
        // 仅保存信息供UI显示，不影响militaryStrength
        updatedNation._multiWarDeployment = { activeWarCount: multiWar.activeWarCount, hasExtremeAIFront: multiWar.hasExtremeAIFront };
    } else {
        updatedNation._multiWarDeployment = null;
    }

    updatedNation.military = {
        ...updatedNation.military,
        forcePool: {
            ...updatedNation.military.forcePool,
            readyUnits: totalUnits,
            activeCorps: allNationCorps.filter((corps) => corps.assignedFrontId).length,
        },
        fieldedPower: Math.max(0, Math.round(calculateBattlePower(fieldedArmy, epoch, (updatedNation.militaryQuality - 1) * 0.2))),
    };

    return {
        nation: updatedNation,
        corps: [...allNationCorps],
        generals: [...nationGenerals, ...newGenerals],
    };
};

export const evaluateAIFrontPlan = ({
    nation,
    front,
    ownCorps = [],
    enemyCorps = [],
}) => {
    const doctrine = AI_DOCTRINES[nation?.military?.doctrine] || pickDoctrine(nation, front?.epoch || 0);
    const ownUnits = ownCorps.reduce((sum, corps) => sum + getCorpsTotalUnits(corps), 0);
    const enemyUnits = enemyCorps.reduce((sum, corps) => sum + getCorpsTotalUnits(corps), 0);
    const side = nation?.id === front?.attackerId ? 'attacker' : 'defender';
    const sideState = front?.sideState?.[side] || {};
    const linePosition = Number(front?.linePosition || 50);
    const underCorePressure = side === 'attacker' ? linePosition < 15 : linePosition > 85;
    const supplyRatio = Number(sideState.supplyRatio ?? 1);
    const unitRatio = ownUnits / Math.max(1, enemyUnits || 1);

    let posture = doctrine.preferredPosture;
    if (underCorePressure || supplyRatio < 0.7) posture = 'attrition';
    else if (unitRatio > 1.25 && supplyRatio >= 0.9) posture = 'offensive';
    else if (unitRatio < 0.85 && supplyRatio >= 0.8) posture = 'raid';
    else posture = 'balanced';

    const desiredCorps = clamp(
        Math.round((nation?.military?.forcePool?.targetCorps || 1) * (underCorePressure ? 0.8 : posture === 'offensive' ? 0.75 : 0.6)),
        1,
        Math.max(1, nation?.military?.forcePool?.targetCorps || 1)
    );

    const sortedCorps = [...ownCorps].sort((a, b) => getCorpsTotalUnits(b) - getCorpsTotalUnits(a));
    const taskBlueprint = posture === 'offensive'
        ? ['assault', 'assault', 'reserve', 'raid']
        : posture === 'attrition'
            ? ['guard', 'guard', 'reserve', 'raid']
            : posture === 'raid'
                ? ['raid', 'assault', 'reserve', 'guard']
                : doctrine.preferredTasks;

    const taskAssignments = {};
    sortedCorps.forEach((corps, index) => {
        taskAssignments[corps.id] = taskBlueprint[index] || taskBlueprint[taskBlueprint.length - 1] || 'assault';
    });

    return {
        side,
        posture,
        desiredCorps,
        shouldAttack: supplyRatio >= 0.7 && ownUnits > 0 && enemyUnits > 0 && (unitRatio >= 0.95 || posture === 'raid'),
        taskAssignments,
        frontlineCorpsOrder: sortedCorps.map((corps) => corps.id),
        summary: {
            ownUnits,
            enemyUnits,
            supplyRatio,
            unitRatio: Number(unitRatio.toFixed(2)),
            underCorePressure,
        },
    };
};

/**
 * Generate an AI general for a nation
 * @param {Object} nation - AI nation object
 * @param {number} epoch - Current epoch
 * @returns {Object} A pseudo-general object compatible with corpsSystem
 */
export const generateAIGeneral = (nation, epoch) => {
    // Generals require the official system (unlocked at epoch >= 1 / Bronze Age)
    if ((epoch ?? 0) < 1) return null;
    const GENERAL_TRAIT_IDS = ['aggressive', 'defensive', 'swift', 'inspiring', 'cunning', 'veteran', 'logistics', 'siege_master'];
    const aggression = nation.aggression ?? 0.3;

    // Trait selection biased by nation personality
    const traits = [];
    if (aggression > 0.6) traits.push('aggressive');
    else if (aggression < 0.3) traits.push('defensive');
    else traits.push(GENERAL_TRAIT_IDS[Math.floor(Math.random() * GENERAL_TRAIT_IDS.length)]);

    // Maybe add a second trait
    if (Math.random() < 0.3) {
        const remaining = GENERAL_TRAIT_IDS.filter(t => !traits.includes(t));
        traits.push(remaining[Math.floor(Math.random() * remaining.length)]);
    }

    const baseLevel = 1 + Math.floor(epoch * 0.3) + Math.floor((nation.militaryStrength ?? 1.0) * 2);

    return {
        id: `ai_gen_${nation.id}_${Date.now()}`,
        name: `${nation.name}将军`,
        level: Math.min(baseLevel, 6),
        experience: 0,
        traits,
        assignedCorpsId: null,
    };
};

/**
 * 将领会战提议评估
 * 将军根据自身特质、军团状态、战线态势综合评估是否提议发起会战
 * @param {Object} params
 * @returns {{ shouldPropose: boolean, engagementType: string, confidence: number, reason: string, riskLevel: string }}
 */
export const evaluateGeneralBattleProposal = ({
    general,
    corps,
    front,
    allCorps = [],
    generals = [],
    epoch = 0,
    currentDay = 0,
}) => {
    const NO_PROPOSAL = { shouldPropose: false, engagementType: 'probe', confidence: 0, reason: '', riskLevel: 'low' };
    if (!general || !corps || !front) return NO_PROPOSAL;

    // 冷却检查：将军个人冷却（增大间隔避免频繁提议）
    const lastProposalDay = general.lastBattleProposalDay || 0;
    const extraCooldown = general.proposalCooldownDays || 0;
    const traitIds = general.traits || [];
    const isAggressive = traitIds.includes('aggressive');
    const isDefensive = traitIds.includes('defensive');
    const baseCooldown = isAggressive ? 54 : isDefensive ? 120 : 75;
    if (currentDay - lastProposalDay < baseCooldown + extraCooldown) return NO_PROPOSAL;

    // 战线全局冷却
    const lastBattleEndDay = front.lastBattleEndDay || 0;
    if (currentDay - lastBattleEndDay < 60) return NO_PROPOSAL;

    // 条件门槛
    const totalUnits = Object.values(corps.units || {}).reduce((s, c) => s + c, 0);
    if (totalUnits <= 0) return NO_PROPOSAL;
    const morale = corps.morale ?? 100;
    if (morale < 40) return NO_PROPOSAL;
    // 补给检查
    const playerSide = front.attackerId === 'player' ? 'attacker' : 'defender';
    const sideState = front.sideState?.[playerSide] || {};
    const supplyRatio = sideState.supplyRatio ?? 1;
    if (supplyRatio < 0.65) return NO_PROPOSAL;
    // 已有活跃会战
    if (front.activeBattleId) return NO_PROPOSAL;

    // 敌方兵力估算
    const enemySide = playerSide === 'attacker' ? 'defender' : 'attacker';
    const enemyUnits = front.sideState?.[enemySide]?.deployedUnits || 1;

    // 决策权重计算
    let weight = 0;
    // 将军特质加成
    if (isAggressive) weight += 0.3;
    if (traitIds.includes('cunning')) weight += 0.15;
    if (traitIds.includes('swift')) weight += 0.1;
    if (traitIds.includes('veteran')) weight += 0.05;
    if (isDefensive) weight -= 0.2;
    // 兵力比优势
    const forceRatio = totalUnits / Math.max(1, enemyUnits);
    weight += (forceRatio - 1) * 0.4;
    // 补给充裕度
    weight += (supplyRatio - 0.8) * 0.5;
    // 士气加成
    weight += (morale - 60) / 200;
    // 战线位置（深入敌境更激进）
    const linePosition = front.linePosition ?? 50;
    const penetration = playerSide === 'attacker'
        ? Math.max(0, linePosition - 50) / 50
        : Math.max(0, 50 - linePosition) / 50;
    weight += penetration * 0.15;

    // 提议阈值
    if (weight < 0.3) return NO_PROPOSAL;

    // 交战类型选择
    let engagementType = 'probe';
    if (traitIds.includes('siege_master') && penetration > 0.3) {
        engagementType = 'siege';
    } else if (isAggressive || forceRatio > 1.5) {
        engagementType = 'assault';
    } else if (weight > 0.6) {
        engagementType = 'assault';
    }

    // 风险评级
    let riskLevel = 'low';
    if (forceRatio < 0.8) riskLevel = 'extreme';
    else if (forceRatio < 1.0) riskLevel = 'high';
    else if (supplyRatio < 0.8 || morale < 60) riskLevel = 'medium';

    // 信心
    const confidence = Math.min(1, Math.max(0, weight));

    // 提议理由
    const reason = weight > 0.6
        ? `${general.name}将军强烈建议发起${engagementType === 'siege' ? '攻坚战' : engagementType === 'assault' ? '主力决战' : '试探进攻'}，兵力比${forceRatio.toFixed(1)}:1，补给率${Math.round(supplyRatio * 100)}%。`
        : `${general.name}将军认为可以尝试${engagementType === 'siege' ? '围城' : engagementType === 'assault' ? '进攻' : '试探'}，但局面仍有不确定性。`;

    return {
        shouldPropose: true,
        engagementType,
        confidence,
        reason,
        riskLevel,
        generalId: general.id,
        corpsId: corps.id,
        frontId: front.id,
        forceRatio: Number(forceRatio.toFixed(2)),
        supplyRatio: Number(supplyRatio.toFixed(2)),
    };
};

/**
 * Determine what tactic an AI should use based on battle state
 * @param {Object} battle - Current battle state
 * @param {'attacker'|'defender'} side - Which side the AI is
 * @param {Object} nation - AI nation object
 * @returns {string} Tactic ID
 */
export const determineAITactic = (battle, side, nation) => {
    const sideData = battle[side];
    const aggression = nation?.aggression ?? 0.3;

    // If morale is very low, consider retreating
    if (sideData.morale < 25) {
        return Math.random() < 0.6 ? 'retreat' : 'defensive';
    }

    // If momentum is heavily against us, go defensive
    const momentum = battle.momentum;
    const isAttacker = side === 'attacker';
    const favorableMomentum = isAttacker ? momentum > 55 : momentum < 45;
    const unfavorableMomentum = isAttacker ? momentum < 35 : momentum > 65;

    if (unfavorableMomentum) {
        if (aggression > 0.7) return 'focus_attack'; // Aggressive AI fights harder when losing
        return 'defensive';
    }

    if (favorableMomentum && aggression > 0.5) {
        return 'focus_attack'; // Press the advantage
    }

    // Default: normal combat
    return 'normal';
};

// ========== AI军团多战线调度器 ==========

/**
 * 将AI国家的有限军团按优先级分配到各活跃战线
 * 核心理念：多战线劣势不通过debuff实现，而是通过"有限军团在多条战线间分配"自然产生
 * 
 * @param {Object} params
 * @param {Object} params.nation - AI国家对象
 * @param {Array} params.allCorps - 全部军团数组（含AI和玩家）
 * @param {Array} params.activeFronts - 所有活跃战线数组
 * @param {number} params.epoch - 当前时代
 * @returns {Object} { allocations: { frontId: corpsIds[] }, unallocatedCorps: string[] }
 */
export const allocateAICorpsToFronts = ({
    nation,
    allCorps = [],
    activeFronts = [],
    epoch = 0,
}) => {
    if (!nation?.id) return { allocations: {}, unallocatedCorps: [] };

    const nationId = nation.id;
    const doctrine = AI_DOCTRINES[nation.military?.doctrine] || pickDoctrine(nation, epoch);

    // 1. 获取该AI国家所有可用军团（有兵力且属于该国）
    const availableCorps = allCorps
        .filter(c => c?.isAI && c.nationId === nationId && getCorpsTotalUnits(c) > 0)
        .sort((a, b) => getCorpsTotalUnits(b) - getCorpsTotalUnits(a)); // 按战力降序

    // 2. 获取该AI参与的所有活跃战线
    const relevantFronts = activeFronts.filter(f =>
        f?.status === 'active' &&
        (f.attackerId === nationId || f.defenderId === nationId)
    );

    if (relevantFronts.length === 0 || availableCorps.length === 0) {
        return {
            allocations: {},
            unallocatedCorps: availableCorps.map(c => c.id),
        };
    }

    // 3. 为每条战线评分（优先级）
    const scoredFronts = relevantFronts.map(front => {
        const side = front.attackerId === nationId ? 'attacker' : 'defender';
        const linePos = Number(front.linePosition ?? 50);

        // 核心区威胁权重 ×3
        let coreThreated = 0;
        if (side === 'attacker' && linePos < 15) coreThreated = 3;
        else if (side === 'defender' && linePos > 85) coreThreated = 3;

        // 经济区威胁权重 ×2
        let econThreated = 0;
        if (side === 'attacker' && linePos < 35 && linePos >= 15) econThreated = 2;
        else if (side === 'defender' && linePos > 65 && linePos <= 85) econThreated = 2;

        // 战线得分差权重 ×1（战线偏向敌方越多，我方越安全，优先级越低）
        const positionScore = side === 'attacker'
            ? (50 - linePos) / 50  // attacker: linePos越低越危险，得分越高
            : (linePos - 50) / 50; // defender: linePos越高越危险，得分越高

        // 学说偏好修正
        let doctrineMod = 0;
        if (doctrine.id === 'line_breaker' && positionScore < 0) doctrineMod = 0.3; // 突破学说：主动进攻偏好
        if (doctrine.id === 'siege_attrition' && coreThreated > 0) doctrineMod = 0.5; // 消耗学说：核心受威胁时更重视防守

        const priority = coreThreated + econThreated + Math.max(0, positionScore) + doctrineMod;

        return {
            frontId: front.id,
            side,
            priority,
            linePos,
        };
    });

    // 按优先级降序排列
    scoredFronts.sort((a, b) => b.priority - a.priority);

    // 4. 分配军团到战线
    const allocations = {};
    const assignedCorpsIds = new Set();

    // 第一轮：每条战线至少分1个军团（如果有足够军团）
    let corpIndex = 0;
    for (const sf of scoredFronts) {
        if (corpIndex >= availableCorps.length) break;
        allocations[sf.frontId] = [availableCorps[corpIndex].id];
        assignedCorpsIds.add(availableCorps[corpIndex].id);
        corpIndex++;
    }

    // 第二轮：剩余军团按优先级分配给高优先级战线
    while (corpIndex < availableCorps.length) {
        // 找到当前军团最少的高优先级战线
        let bestFrontId = scoredFronts[0]?.frontId;
        let minCorps = Infinity;
        for (const sf of scoredFronts) {
            const count = (allocations[sf.frontId] || []).length;
            // 优先级加权：高优先级战线更容易获得额外军团
            const weightedCount = count - sf.priority * 0.5;
            if (weightedCount < minCorps) {
                minCorps = weightedCount;
                bestFrontId = sf.frontId;
            }
        }
        if (!bestFrontId) break;
        if (!allocations[bestFrontId]) allocations[bestFrontId] = [];
        allocations[bestFrontId].push(availableCorps[corpIndex].id);
        assignedCorpsIds.add(availableCorps[corpIndex].id);
        corpIndex++;
    }

    // 未分配的军团（理论上不应该有，除非没有活跃战线）
    const unallocatedCorps = availableCorps
        .filter(c => !assignedCorpsIds.has(c.id))
        .map(c => c.id);

    return { allocations, unallocatedCorps };
};

/**
 * 执行AI军团调度结果：更新军团的 assignedFrontId 和 frontTask
 * @param {Object} params
 * @param {Object} params.allocations - allocateAICorpsToFronts 的返回结果
 * @param {Array} params.allCorps - 全部军团数组（将被修改）
 * @param {Object} params.nation - AI国家对象
 * @param {number} params.epoch - 当前时代
 * @returns {Array} 更新后的军团数组
 */
export const applyAICorpsAllocation = ({
    allocations = {},
    allCorps = [],
    nation,
    epoch = 0,
}) => {
    const nationId = nation?.id;
    if (!nationId) return allCorps;

    const doctrine = AI_DOCTRINES[nation.military?.doctrine] || pickDoctrine(nation, epoch);

    // 构建 corpsId -> frontId 的反向映射
    const corpsToFront = {};
    for (const [frontId, corpsIds] of Object.entries(allocations)) {
        (corpsIds || []).forEach((cId, idx) => {
            corpsToFront[cId] = { frontId, taskIndex: idx };
        });
    }

    return allCorps.map(corps => {
        if (!corps?.isAI || corps.nationId !== nationId) return corps;

        const assignment = corpsToFront[corps.id];
        if (assignment) {
            return {
                ...corps,
                assignedFrontId: assignment.frontId,
                frontTask: doctrine.preferredTasks[assignment.taskIndex % doctrine.preferredTasks.length] || 'assault',
                status: 'deployed',
            };
        } else {
            // 未被分配的军团设为idle
            return {
                ...corps,
                assignedFrontId: null,
                frontTask: 'reserve',
                status: 'idle',
            };
        }
    });
};


