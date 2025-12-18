/**
 * Nations AI Module
 * Handles AI nation updates, war logic, diplomacy, and economy
 */

import { RESOURCES } from '../../config';
import { simulateBattle, UNIT_TYPES } from '../../config/militaryUnits';
import { getEnemyUnitsForEpoch } from '../../config/militaryActions';
import {
    calculateAIGiftAmount,
    calculateAIPeaceTribute,
    calculateAISurrenderDemand
} from '../../utils/diplomaticUtils';
import {
    clamp,
    PEACE_REQUEST_COOLDOWN_DAYS,
    MAX_CONCURRENT_WARS,
    GLOBAL_WAR_COOLDOWN
} from '../utils';

/**
 * Update all AI nations for one tick
 * @param {Object} params - Update parameters
 * @returns {Object} Updated nations and related data
 */
export const updateNations = ({
    nations,
    tick,
    epoch,
    resources,
    army,
    population,
    stabilityValue,
    logs
}) => {
    const res = { ...resources };
    let warIndemnityIncome = 0;
    let raidPopulationLoss = 0;

    // Calculate player baselines for AI scaling
    const playerPopulationBaseline = Math.max(10, population);
    const playerWealthBaseline = Math.max(500, (res.food || 0) + (res.silver || 0) + (res.wood || 0));

    let updatedNations = (nations || []).map(nationInput => {
        const nation = { ...nationInput };
        const next = nation;

        // Process war-related updates
        if (next.isAtWar) {
            next.warDuration = (next.warDuration || 0) + 1;

            // Process war actions and battles
            processWarActions({
                nation: next,
                tick,
                epoch,
                res,
                army,
                stabilityValue,
                logs
            });

            // Check for peace requests
            checkPeaceRequest({
                nation: next,
                tick,
                logs
            });

            // Check for AI surrender demands
            checkSurrenderDemand({
                nation: next,
                tick,
                population,
                playerWealth: playerWealthBaseline,
                logs
            });
        } else if (next.warDuration) {
            next.warDuration = 0;
        }

        // Relation decay
        processRelationDecay(next);

        // Check alliance status
        checkAllianceStatus({
            nation: next,
            tick,
            logs
        });

        // War declaration check
        checkWarDeclaration({
            nation: next,
            nations,
            tick,
            epoch,
            res,
            stabilityValue,
            logs
        });

        // Process installment payments
        if (next.installmentPayment && next.installmentPayment.remainingDays > 0) {
            const payment = next.installmentPayment.amount;
            res.silver = (res.silver || 0) + payment;
            warIndemnityIncome += payment;
            next.installmentPayment.paidAmount += payment;
            next.installmentPayment.remainingDays -= 1;

            if (next.installmentPayment.remainingDays === 0) {
                logs.push(`💰 ${next.name} completed all installment payments (total ${next.installmentPayment.totalAmount} silver).`);
                delete next.installmentPayment;
            }
        }

        // Post-war recovery
        if (!next.isAtWar) {
            const currentStrength = next.militaryStrength ?? 1.0;
            if (currentStrength < 1.0) {
                const recoveryRate = 0.005;
                next.militaryStrength = Math.min(1.0, currentStrength + recoveryRate);
            }
        }

        // Update economy
        updateNationEconomy({
            nation: next,
            tick,
            epoch,
            playerPopulationBaseline,
            playerWealthBaseline
        });

        return next;
    });

    // Process AI-AI relations and wars
    updatedNations = processAIRelations(updatedNations, tick, logs);

    // Monthly relation decay
    if (tick % 30 === 0) {
        updatedNations = processMonthlyRelationDecay(updatedNations);
    }

    return {
        nations: updatedNations,
        resources: res,
        warIndemnityIncome,
        raidPopulationLoss
    };
};

/**
 * Process war actions for a nation at war with player
 * @private
 */
const processWarActions = ({ nation, tick, epoch, res, army, stabilityValue, logs }) => {
    // Frequency of AI actions based on aggression
    const actionFrequency = Math.max(10, Math.floor(30 - (nation.aggression || 0.3) * 20));

    if (tick % actionFrequency !== 0) return;

    const actionRoll = Math.random();
    const aggression = nation.aggression || 0.3;

    // Determine action type based on AI personality
    let actionType = 'raid';
    if (actionRoll < 0.3 * aggression) {
        actionType = 'assault';
    } else if (actionRoll < 0.5) {
        actionType = 'raid';
    } else if (actionRoll < 0.7 && stabilityValue < 40) {
        actionType = 'scorched_earth';
    }

    // Generate enemy army
    const attackerArmy = getEnemyUnitsForEpoch(epoch, nation.militaryStrength || 1.0);
    const defenderArmy = { ...army };

    // Check if player has defending army
    const hasDefenders = Object.values(defenderArmy).some(count => count > 0);

    if (!hasDefenders) {
        // No defense - automatic loss
        const lossMultiplier = { raid: 0.15, assault: 0.25, scorched_earth: 0.2 }[actionType] || 0.15;
        const foodLoss = Math.floor((res.food || 0) * lossMultiplier);
        const silverLoss = Math.floor((res.silver || 0) * lossMultiplier * 0.5);

        if (foodLoss > 0) res.food = Math.max(0, (res.food || 0) - foodLoss);
        if (silverLoss > 0) res.silver = Math.max(0, (res.silver || 0) - silverLoss);

        nation.warScore = (nation.warScore || 0) + 8;
        nation.wealth = (nation.wealth || 0) + Math.floor((foodLoss + silverLoss) * 0.08);

        logs.push(`⚔️ ${nation.name} ${actionType === 'raid' ? 'raided' : 'attacked'} undefended! Lost ${foodLoss} food, ${silverLoss} silver.`);
    } else {
        // Battle simulation
        const battleResult = simulateBattle(
            { army: attackerArmy, epoch, militaryBuffs: 0.1 },
            { army: defenderArmy, epoch, militaryBuffs: 0 }
        );

        // Apply battle results
        Object.entries(battleResult.defenderLosses || {}).forEach(([unitId, count]) => {
            if (army[unitId]) {
                army[unitId] = Math.max(0, army[unitId] - count);
            }
        });

        if (battleResult.victory) {
            // AI won
            const foodLoss = Math.floor((res.food || 0) * 0.1);
            const silverLoss = Math.floor((res.silver || 0) * 0.05);
            if (foodLoss > 0) res.food = Math.max(0, (res.food || 0) - foodLoss);
            if (silverLoss > 0) res.silver = Math.max(0, (res.silver || 0) - silverLoss);
            nation.warScore = (nation.warScore || 0) + 5;
        } else {
            // Player won
            nation.warScore = (nation.warScore || 0) - 3;
            const enemyLosses = Object.values(battleResult.attackerLosses || {})
                .reduce((sum, val) => sum + (val || 0), 0);
            nation.enemyLosses = (nation.enemyLosses || 0) + enemyLosses;
        }

        // Generate battle event log
        const raidData = {
            nationName: nation.name,
            victory: !battleResult.victory,
            attackerArmy,
            defenderArmy,
            attackerLosses: battleResult.attackerLosses || {},
            defenderLosses: battleResult.defenderLosses || {},
            ourPower: battleResult.defenderPower,
            enemyPower: battleResult.attackerPower,
            actionType
        };
        logs.push(`❗RAID_EVENT❗${JSON.stringify(raidData)}`);
    }
};

/**
 * Check if nation should request peace
 * @private
 */
const checkPeaceRequest = ({ nation, tick, logs }) => {
    const lastPeaceRequestDay = Number.isFinite(nation.lastPeaceRequestDay)
        ? nation.lastPeaceRequestDay
        : -Infinity;
    const canRequestPeace = (tick - lastPeaceRequestDay) >= PEACE_REQUEST_COOLDOWN_DAYS;

    if ((nation.warScore || 0) > 12 && canRequestPeace) {
        const willingness = Math.min(0.5,
            0.03 + (nation.warScore || 0) / 120 +
            (nation.warDuration || 0) / 400 +
            Math.min(0.15, (nation.enemyLosses || 0) / 500)
        );

        if (Math.random() < willingness) {
            const tribute = calculateAIPeaceTribute(
                nation.warScore || 0,
                nation.enemyLosses || 0,
                nation.warDuration || 0,
                Math.max(0, nation.wealth || 0)
            );

            logs.push(`🤝 ${nation.name} requests peace, willing to pay ${tribute} silver.`);
            nation.isPeaceRequesting = true;
            nation.peaceTribute = tribute;
            nation.lastPeaceRequestDay = tick;
        }
    }
};

/**
 * Check if AI should demand player surrender
 * @private
 */
const checkSurrenderDemand = ({ nation, tick, population, playerWealth, logs }) => {
    const aiWarScore = -(nation.warScore || 0);

    if (aiWarScore > 25 && (nation.warDuration || 0) > 30) {
        const lastDemandDay = nation.lastSurrenderDemandDay || 0;
        if (tick - lastDemandDay >= 60 && Math.random() < 0.03) {
            nation.lastSurrenderDemandDay = tick;

            let demandType = 'tribute';
            const warDuration = nation.warDuration || 0;
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
                nationId: nation.id,
                nationName: nation.name,
                warScore: nation.warScore,
                demandType,
                demandAmount
            })}`);
        }
    }
};

/**
 * Process relation decay for a nation
 * @private
 */
const processRelationDecay = (nation) => {
    const relation = nation.relation ?? 50;
    let relationChange = 0;

    if (relation > 50) {
        relationChange = -0.02;
    } else if (relation < 50) {
        relationChange = 0.02;
    }

    nation.relation = Math.max(0, Math.min(100, relation + relationChange));

    // AI-AI relation decay
    if (nation.foreignRelations) {
        Object.keys(nation.foreignRelations).forEach(otherId => {
            let r = nation.foreignRelations[otherId] ?? 50;
            if (r > 50) r -= 0.02;
            else if (r < 50) r += 0.02;
            nation.foreignRelations[otherId] = Math.max(0, Math.min(100, r));
        });
    }
};

/**
 * Check alliance status and AI alliance breaking
 * @private
 */
const checkAllianceStatus = ({ nation, tick, logs }) => {
    if (nation.alliedWithPlayer && !nation.isAtWar) {
        const relation = nation.relation ?? 50;
        const shouldBreakAlliance = (
            relation < 40 ||
            (nation.allianceStrain || 0) >= 3
        );

        if (shouldBreakAlliance) {
            nation.alliedWithPlayer = false;
            nation.allianceStrain = 0;
            logs.push(`AI_BREAK_ALLIANCE:${JSON.stringify({
                nationId: nation.id,
                nationName: nation.name,
                reason: relation < 40 ? 'relation_low' : 'player_neglect'
            })}`);
        }
    }
};

/**
 * Check war declaration conditions
 * @private
 */
const checkWarDeclaration = ({ nation, nations, tick, epoch, res, stabilityValue, logs }) => {
    const relation = nation.relation ?? 50;
    const aggression = nation.aggression ?? 0.2;

    // Count current wars
    const currentWarsWithPlayer = (nations || []).filter(n =>
        n.isAtWar === true && n.id !== nation.id && !n.isRebelNation
    ).length;

    // Check global cooldown
    const recentWarDeclarations = (nations || []).some(n =>
        n.isAtWar && n.warStartDay &&
        (tick - n.warStartDay) < GLOBAL_WAR_COOLDOWN &&
        n.id !== nation.id
    );

    // War count penalty
    const warCountPenalty = currentWarsWithPlayer > 0
        ? Math.pow(0.3, currentWarsWithPlayer)
        : 1.0;

    // Calculate declaration chance
    const hostility = Math.max(0, (50 - relation) / 70);
    const unrest = stabilityValue < 35 ? 0.02 : 0;
    const aggressionBonus = aggression > 0.5 ? aggression * 0.03 : 0;

    let declarationChance = epoch >= 1
        ? Math.min(0.08, (aggression * 0.04) + (hostility * 0.025) + unrest + aggressionBonus)
        : 0;

    declarationChance *= warCountPenalty;

    // Check conditions
    const hasPeaceTreaty = nation.peaceTreatyUntil && tick < nation.peaceTreatyUntil;
    const isPlayerAlly = relation >= 80;

    const canDeclareWar = !nation.isAtWar &&
        !hasPeaceTreaty &&
        !isPlayerAlly &&
        relation < 25 &&
        currentWarsWithPlayer < MAX_CONCURRENT_WARS &&
        !recentWarDeclarations;

    if (canDeclareWar && Math.random() < declarationChance) {
        nation.isAtWar = true;
        nation.warStartDay = tick;
        nation.warDuration = 0;
        nation.warDeclarationPending = true;
        logs.push(`⚠️ ${nation.name} declared war!`);
        logs.push(`WAR_DECLARATION_EVENT:${JSON.stringify({ nationId: nation.id, nationName: nation.name })}`);
    }

    // Wealth-based war
    const playerWealth = (res.food || 0) + (res.silver || 0) + (res.wood || 0);
    const aiWealth = nation.wealth || 500;
    const aiMilitaryStrength = nation.militaryStrength ?? 1.0;

    if (!nation.isAtWar && !hasPeaceTreaty && !isPlayerAlly &&
        playerWealth > aiWealth * 2 &&
        aiMilitaryStrength > 0.8 &&
        relation < 50 &&
        aggression > 0.4 &&
        currentWarsWithPlayer < MAX_CONCURRENT_WARS &&
        !recentWarDeclarations) {

        const wealthWarChance = 0.001 * aggression * (playerWealth / aiWealth - 1);
        if (Math.random() < wealthWarChance) {
            nation.isAtWar = true;
            nation.warStartDay = tick;
            nation.warDuration = 0;
            nation.warDeclarationPending = true;
            logs.push(`⚠️ ${nation.name} covets your wealth, declared war!`);
            logs.push(`WAR_DECLARATION_EVENT:${JSON.stringify({ nationId: nation.id, nationName: nation.name, reason: 'wealth' })}`);
        }
    }
};

/**
 * Update nation's economy
 * @private
 */
const updateNationEconomy = ({ nation, tick, epoch, playerPopulationBaseline, playerWealthBaseline }) => {
    const powerProfile = nation.foreignPower || {};
    const volatility = clamp(powerProfile.volatility ?? nation.marketVolatility ?? 0.3, 0.1, 0.9);
    const populationFactor = clamp(powerProfile.populationFactor ?? powerProfile.baseRating ?? 1, 0.6, 2.5);
    const wealthFactor = clamp(powerProfile.wealthFactor ?? (powerProfile.baseRating ? powerProfile.baseRating * 1.1 : 1.1), 0.5, 3.5);
    const eraMomentum = 1 + Math.max(0, epoch - (powerProfile.appearEpoch ?? 0)) * 0.03;

    // Initialize AI development baseline
    if (!nation.economyTraits?.ownBasePopulation) {
        const templateWealth = nation.wealthTemplate || 800;
        const templateFactor = templateWealth / 800;
        nation.economyTraits = {
            ...(nation.economyTraits || {}),
            ownBasePopulation: Math.max(5, Math.round(16 * templateFactor * (0.8 + Math.random() * 0.4))),
            ownBaseWealth: Math.max(500, Math.round(1000 * templateFactor * (0.8 + Math.random() * 0.4))),
            developmentRate: 0.8 + (nation.aggression || 0.3) * 0.3 + Math.random() * 0.4,
            lastGrowthTick: tick,
        };
    }

    // Periodic independent growth
    const ticksSinceLastGrowth = tick - (nation.economyTraits.lastGrowthTick || 0);
    if (ticksSinceLastGrowth >= 100) {
        const growthChance = 0.3 * (nation.economyTraits.developmentRate || 1.0);
        if (Math.random() < growthChance && !nation.isAtWar) {
            nation.economyTraits.ownBasePopulation = Math.round(
                nation.economyTraits.ownBasePopulation * (1.03 + Math.random() * 0.05)
            );
            nation.economyTraits.ownBaseWealth = Math.round(
                nation.economyTraits.ownBaseWealth * (1.04 + Math.random() * 0.08)
            );
        }
        nation.economyTraits.lastGrowthTick = tick;
    }

    // Calculate target values
    const eraGrowthFactor = 1 + Math.max(0, epoch) * 0.15;
    const aiOwnTargetPopulation = nation.economyTraits.ownBasePopulation * eraGrowthFactor * populationFactor;
    const aiOwnTargetWealth = nation.economyTraits.ownBaseWealth * eraGrowthFactor * wealthFactor;

    // Blend with player reference
    const playerInfluenceFactor = 0.3;
    const playerTargetPopulation = playerPopulationBaseline * populationFactor * eraMomentum;
    const playerTargetWealth = playerWealthBaseline * wealthFactor * eraMomentum;

    const blendedTargetPopulation = aiOwnTargetPopulation * (1 - playerInfluenceFactor) +
        playerTargetPopulation * playerInfluenceFactor;
    const blendedTargetWealth = aiOwnTargetWealth * (1 - playerInfluenceFactor) +
        playerTargetWealth * playerInfluenceFactor;

    // Template boosts
    const templatePopulationBoost = Math.max(1, (nation.wealthTemplate || 800) / Math.max(800, playerWealthBaseline) * 0.8);
    const templateWealthBoost = Math.max(1, (nation.wealthTemplate || 800) / Math.max(800, playerWealthBaseline) * 1.1);

    const desiredPopulation = Math.max(3, blendedTargetPopulation * templatePopulationBoost);
    const desiredWealth = Math.max(100, blendedTargetWealth * templateWealthBoost);

    nation.economyTraits.basePopulation = desiredPopulation;
    nation.economyTraits.baseWealth = desiredWealth;

    // Apply drift
    const driftMultiplier = clamp(1 + volatility * 0.6 + eraMomentum * 0.08, 1, 1.8);
    const populationDriftRate = (nation.isAtWar ? 0.032 : 0.12) * driftMultiplier;
    const wealthDriftRate = (nation.isAtWar ? 0.03 : 0.11) * driftMultiplier;

    const currentPopulation = nation.population ?? desiredPopulation;
    const populationNoise = (Math.random() - 0.5) * volatility * desiredPopulation * 0.04;
    let adjustedPopulation = currentPopulation +
        (desiredPopulation - currentPopulation) * populationDriftRate + populationNoise;
    if (nation.isAtWar) {
        adjustedPopulation -= currentPopulation * 0.012;
    }
    nation.population = Math.max(3, Math.round(adjustedPopulation));

    const currentWealth = nation.wealth ?? desiredWealth;
    const wealthNoise = (Math.random() - 0.5) * volatility * desiredWealth * 0.05;
    let adjustedWealth = currentWealth +
        (desiredWealth - currentWealth) * wealthDriftRate + wealthNoise;
    if (nation.isAtWar) {
        adjustedWealth -= currentWealth * 0.015;
    }
    nation.wealth = Math.max(100, Math.round(adjustedWealth));

    // Update budget
    const dynamicBudgetTarget = nation.wealth * 0.45;
    const workingBudget = Number.isFinite(nation.budget) ? nation.budget : dynamicBudgetTarget;
    nation.budget = Math.max(0, workingBudget + (dynamicBudgetTarget - workingBudget) * 0.35);
};

/**
 * Process AI-AI relations and wars
 * @private
 */
const processAIRelations = (nations, tick, logs) => {
    return nations.map(nation => {
        // Initialize foreign relations
        if (!nation.foreignRelations) {
            nation.foreignRelations = {};
        }

        nations.forEach(otherNation => {
            if (otherNation.id === nation.id) return;

            if (nation.foreignRelations[otherNation.id] === undefined) {
                const avgAggression = ((nation.aggression || 0.3) + (otherNation.aggression || 0.3)) / 2;
                nation.foreignRelations[otherNation.id] = Math.floor(
                    50 - avgAggression * 30 + (Math.random() - 0.5) * 20
                );
            }

            // Natural fluctuation
            if (Math.random() < 0.05) {
                const change = (Math.random() - 0.5) * 6;
                nation.foreignRelations[otherNation.id] = clamp(
                    (nation.foreignRelations[otherNation.id] || 50) + change,
                    0,
                    100
                );
            }
        });

        return nation;
    });
};

/**
 * Process monthly relation decay for all nations
 * @private
 */
const processMonthlyRelationDecay = (nations) => {
    return nations.map(nation => {
        if (nation.isRebelNation) return nation;

        const currentRelation = nation.relation ?? 50;
        const isAlly = nation.alliedWithPlayer === true;
        const decayRate = isAlly ? 0.1 : 0.5;

        let newRelation = currentRelation;
        if (currentRelation > 50) {
            newRelation = Math.max(50, currentRelation - decayRate);
        } else if (currentRelation < 50) {
            newRelation = Math.min(50, currentRelation + decayRate);
        }

        return { ...nation, relation: newRelation };
    });
};
