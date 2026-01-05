/**
 * AI Diplomacy Module
 * Handles AI diplomatic behavior: gifts, trade, alliances, relations
 * Extracted from simulation.js for better code organization
 */

import { RESOURCES } from '../../config';
import {
    calculateAIGiftAmount,
} from '../../utils/diplomaticUtils';
import { clamp } from '../utils';
import { isTradableResource } from '../utils/helpers';

/**
 * Initialize foreign relations between AI nations
 * @param {Array} nations - Array of nations
 * @returns {Array} Nations with initialized foreignRelations
 */
export const initializeForeignRelations = (nations) => {
    if (!Array.isArray(nations)) return [];
    return nations.map(nation => {
        if (!nation.foreignRelations) {
            nation.foreignRelations = {};
        }

        nations.forEach(otherNation => {
            if (otherNation.id === nation.id) return;

            if (nation.foreignRelations[otherNation.id] === undefined) {
                const avgAggression = ((nation.aggression || 0.3) + (otherNation.aggression || 0.3)) / 2;
                nation.foreignRelations[otherNation.id] = Math.floor(50 - avgAggression * 30 + (Math.random() - 0.5) * 20);
            }

            // Natural relation fluctuation
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
 * @param {Array} nations - Array of nations
 * @param {number} tick - Current game tick
 * @returns {Array} Nations with decayed relations
 */
export const processMonthlyRelationDecay = (nations, tick) => {
    const isMonthTick = tick % 30 === 0;
    if (!isMonthTick || !Array.isArray(nations)) return nations || [];

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

/**
 * Process ally cold events (when ally relation < 70)
 * @param {Array} nations - Array of visible nations
 * @param {number} tick - Current game tick
 * @param {Array} logs - Log array (mutable)
 */
export const processAllyColdEvents = (nations, tick, logs) => {
    if (!Array.isArray(nations)) return;
    nations.forEach(nation => {
        if (nation.isRebelNation) return;
        if (nation.alliedWithPlayer !== true) return;
        if ((nation.relation ?? 50) >= 70) return;

        const lastColdEventDay = nation.lastAllyColdEventDay || 0;
        if (tick - lastColdEventDay < 30) return;

        if (Math.random() < 0.005) {
            nation.lastAllyColdEventDay = tick;
            logs.push(`ALLY_COLD_EVENT:${JSON.stringify({
                nationId: nation.id,
                nationName: nation.name,
                relation: Math.round(nation.relation ?? 50)
            })}`);
        }
    });
};

/**
 * Process AI-AI gift diplomacy
 * @param {Array} visibleNations - Array of visible AI nations
 * @param {Array} logs - Log array (mutable)
 */
export const processAIGiftDiplomacy = (visibleNations, logs) => {
    visibleNations.forEach(nation => {
        if (Math.random() > 0.02) return; // 2% chance

        const aggression = nation.aggression ?? 0.3;
        const wealth = nation.wealth || 500;

        if (aggression > 0.6 || wealth < 300) return;

        const potentialTargets = visibleNations.filter(n => {
            if (n.id === nation.id) return false;
            if (nation.foreignWars?.[n.id]?.isAtWar) return false;
            const relation = nation.foreignRelations?.[n.id] ?? 50;
            return relation >= 40 && relation < 80;
        });

        if (potentialTargets.length === 0) return;

        const target = potentialTargets[Math.floor(Math.random() * potentialTargets.length)];

        const giftCost = calculateAIGiftAmount(wealth, target.wealth);
        if (wealth > giftCost * 3) {
            nation.wealth = Math.max(0, (nation.wealth || 0) - giftCost);
            target.wealth = (target.wealth || 0) + giftCost;

            const relationBoost = Math.floor(5 + Math.random() * 8);
            if (!nation.foreignRelations) nation.foreignRelations = {};
            if (!target.foreignRelations) target.foreignRelations = {};

            nation.foreignRelations[target.id] = clamp((nation.foreignRelations[target.id] || 50) + relationBoost, 0, 100);
            target.foreignRelations[nation.id] = clamp((target.foreignRelations[nation.id] || 50) + relationBoost, 0, 100);

            if (nation.foreignRelations[target.id] >= 80 && target.foreignRelations[nation.id] >= 80) {
                logs.push(`🤝 国际新闻：${nation.name} 与 ${target.name} 达成同盟协议！`);
            } else if (Math.random() < 0.3) {
                logs.push(`💝 国际新闻：${nation.name} 向 ${target.name} 赠送了外交礼物，两国关系升温。`);
            }
        }
    });
};

/**
 * Process AI-AI trade
 * @param {Array} visibleNations - Array of visible AI nations
 * @param {Array} logs - Log array (mutable)
 */
export const processAITrade = (visibleNations, logs) => {
    visibleNations.forEach(nation => {
        if (Math.random() > 0.02) return;
        if (nation.isAtWar) return;

        const wealth = nation.wealth || 500;
        if (wealth < 300) return;

        const tradeCandidates = visibleNations.filter(n => {
            if (n.id === nation.id) return false;
            if (n.isAtWar) return false;
            if (nation.foreignWars?.[n.id]?.isAtWar) return false;
            const relation = nation.foreignRelations?.[n.id] ?? 50;
            return relation >= 30;
        });

        if (tradeCandidates.length === 0) return;

        const partner = tradeCandidates[Math.floor(Math.random() * tradeCandidates.length)];
        const tradeValue = Math.floor(20 + Math.random() * 60);

        const taxRate = 0.08;
        const profitAfterTax = tradeValue * (1 - taxRate) - tradeValue * 0.5;
        if (profitAfterTax <= 0) return;

        nation.wealth = (nation.wealth || 0) + tradeValue * 0.05;
        partner.wealth = (partner.wealth || 0) + tradeValue * 0.05;

        if (!nation.foreignRelations) nation.foreignRelations = {};
        if (!partner.foreignRelations) partner.foreignRelations = {};
        nation.foreignRelations[partner.id] = Math.min(100, (nation.foreignRelations[partner.id] || 50) + 1);
        partner.foreignRelations[nation.id] = Math.min(100, (partner.foreignRelations[nation.id] || 50) + 1);
    });
};

/**
 * Process AI-Player trade
 * @param {Array} visibleNations - Array of visible nations
 * @param {number} tick - Current game tick
 * @param {Object} resources - Player resources (mutable)
 * @param {Object} market - Market data
 * @param {Array} logs - Log array (mutable)
 * @param {Object} taxPolicies - Player tax policies (optional)
 */
export const processAIPlayerTrade = (visibleNations, tick, resources, market, logs, taxPolicies = {}) => {
    const res = resources;

    visibleNations.forEach(nation => {
        if (Math.random() > 0.005) return;
        if (nation.isAtWar) return;
        if ((nation.relation ?? 50) < 40) return;

        const aiWealth = nation.wealth || 500;
        if (aiWealth < 400) return;

        const isOpenMarket = nation.openMarketUntil && tick < nation.openMarketUntil;

        const isBuying = Math.random() > 0.5;

        const tradeableResources = ['food', 'wood', 'stone', 'iron'];
        const resourceKey = tradeableResources[Math.floor(Math.random() * tradeableResources.length)];
        const resourcePrice = market?.prices?.[resourceKey] || (RESOURCES[resourceKey]?.basePrice || 1);

        // 使用玩家设置的税率和关税率计算有效税率
        // AI买入 = 玩家出口（使用出口关税），AI卖出 = 玩家进口（使用进口关税）
        // 关税率现在独立于交易税：总税率 = 交易税 + 关税（加法叠加）
        const baseTaxRate = taxPolicies?.resourceTaxRates?.[resourceKey] || 0;
        const tariffRate = isBuying
            ? (taxPolicies?.exportTariffMultipliers?.[resourceKey] ?? taxPolicies?.resourceTariffMultipliers?.[resourceKey] ?? 0)
            : (taxPolicies?.importTariffMultipliers?.[resourceKey] ?? taxPolicies?.resourceTariffMultipliers?.[resourceKey] ?? 0);
        const effectiveTariffRate = isOpenMarket ? 0 : baseTaxRate + tariffRate; // 改为加法

        const quantity = Math.floor(10 + Math.random() * 40);
        const baseValue = quantity * resourcePrice;
        const tariff = Math.floor(baseValue * effectiveTariffRate);

        if (isBuying) {
            const aiLocalPrice = resourcePrice * 1.5;
            const aiRevenue = quantity * aiLocalPrice;
            const aiCost = baseValue + tariff;
            if (aiRevenue <= aiCost) return;

            if ((res[resourceKey] || 0) >= quantity) {
                res[resourceKey] = (res[resourceKey] || 0) - quantity;
                res.silver = (res.silver || 0) + tariff;
                nation.wealth = Math.max(0, (nation.wealth || 0) - baseValue - tariff);
                if (!nation.inventory) {
                    nation.inventory = {};
                }
                nation.inventory[resourceKey] = (nation.inventory[resourceKey] || 0) + quantity;

                logs.push(`AI_TRADE_EVENT:${JSON.stringify({
                    nationId: nation.id,
                    nationName: nation.name,
                    tradeType: 'export',
                    resourceKey,
                    quantity,
                    baseValue,
                    tariff,
                    isOpenMarket
                })}`);
                nation.relation = Math.min(100, (nation.relation || 50) + 2);
            }
        } else {
            const aiCost = quantity * resourcePrice * 0.6;
            const aiRevenue = baseValue - tariff;
            if (aiRevenue <= aiCost) return;

            if (aiWealth >= baseValue * 0.6) {
                res[resourceKey] = (res[resourceKey] || 0) + quantity;
                res.silver = (res.silver || 0) + tariff;
                nation.wealth = (nation.wealth || 0) + baseValue - tariff;
                if (!nation.inventory) {
                    nation.inventory = {};
                }
                nation.inventory[resourceKey] = Math.max(0, (nation.inventory[resourceKey] || 0) - quantity);

                logs.push(`AI_TRADE_EVENT:${JSON.stringify({
                    nationId: nation.id,
                    nationName: nation.name,
                    tradeType: 'import',
                    resourceKey,
                    quantity,
                    baseValue,
                    tariff,
                    isOpenMarket
                })}`);
                nation.relation = Math.min(100, (nation.relation || 50) + 2);
            }
        }
    });
};

/**
 * Process AI-Player interaction (gifts, requests, alliance requests)
 * @param {Array} visibleNations - Array of visible nations
 * @param {number} tick - Current game tick
 * @param {number} epoch - Current epoch
 * @param {Array} logs - Log array (mutable)
 */
export const processAIPlayerInteraction = (visibleNations, tick, epoch, logs) => {
    visibleNations.forEach(nation => {
        const wealth = nation.wealth || 500;
        const aggression = nation.aggression ?? 0.3;
        const playerRelation = nation.relation || 0;
        const isAtWarWithPlayer = nation.isAtWar === true;

        if (isAtWarWithPlayer) return;

        // AI gift to player
        const lastGiftDay = nation.lastGiftToPlayerDay || 0;
        const giftCooldown = 1825; // Increased to 5 years (was 2 years)
        const canGift = (tick - lastGiftDay) >= giftCooldown;

        // Significantly reduced base chance and wealth influence
        const giftChance = 0.00002 + (playerRelation / 1000000) + (wealth / 100000000);
        if (canGift && wealth > 1000 && playerRelation >= 70 && aggression < 0.4 && Math.random() < giftChance) {
            const giftAmount = calculateAIGiftAmount(wealth);
            nation.wealth = Math.max(0, nation.wealth - giftAmount);
            nation.lastGiftToPlayerDay = tick;

            logs.push(`AI_GIFT_EVENT:${JSON.stringify({
                nationId: nation.id,
                nationName: nation.name,
                amount: Math.floor(giftAmount)
            })}`);
        }

        // AI request from player
        // AI request from player
        const demandChance = 0.00005 + Math.max(0, (400 - wealth) / 1000000);
        if (epoch >= 1 && wealth < 400 && Math.random() < demandChance) {
            const requestAmount = Math.floor(80 + Math.random() * 120);
            logs.push(`AI_REQUEST_EVENT:${JSON.stringify({
                nationId: nation.id,
                nationName: nation.name,
                resourceKey: 'silver',
                resourceName: '银币',
                amount: requestAmount
            })}`);
        }

        // AI alliance request
        const isAlreadyAllied = nation.alliedWithPlayer === true;
        const lastAllianceRequestDay = nation.lastAllianceRequestDay || 0;
        const allianceRequestCooldown = 1095; // Increased to 3 years (was 1 year)
        const canRequestAlliance = (tick - lastAllianceRequestDay) >= allianceRequestCooldown;
        const allianceChance = 0.00005 + (playerRelation - 70) / 100000;
        if (canRequestAlliance && !isAlreadyAllied && playerRelation >= 70 && aggression < 0.5 && Math.random() < allianceChance) {
            nation.lastAllianceRequestDay = tick;
            logs.push(`AI_ALLIANCE_REQUEST:${JSON.stringify({
                nationId: nation.id,
                nationName: nation.name
            })}`);
        }

        // Treaty 2.0 MVP: AI treaty proposal (open market / non-aggression / academic exchange) - DISABLED
        if (false) {
            const lastTreatyProposalDay = nation.lastTreatyProposalDay || 0;
            const treatyProposalCooldown = 730; // 2 years
            const canProposeTreaty = (tick - lastTreatyProposalDay) >= treatyProposalCooldown;

            // Simple evaluation: prefer treaties at higher relation, avoid for very aggressive nations
            if (canProposeTreaty && playerRelation >= 55 && aggression < 0.7) {
                // Pick treaty type
                const canOfferOpenMarket = playerRelation >= 60;
                const canOfferNonAggression = playerRelation >= 55;
                const canOfferAcademic = epoch >= 1 && playerRelation >= 65;

                const candidates = [];
                if (canOfferNonAggression) candidates.push('non_aggression');
                if (canOfferOpenMarket) candidates.push('open_market');
                if (canOfferAcademic) candidates.push('academic_exchange');

                if (candidates.length > 0) {
                    const type = candidates[Math.floor(Math.random() * candidates.length)];

                    const baseChance = 0.00006 + (playerRelation - 55) / 90000;
                    const wealthFactor = Math.min(0.00003, wealth / 120000000);
                    const treatyChance = baseChance + wealthFactor;

                    if (Math.random() < treatyChance) {
                        nation.lastTreatyProposalDay = tick;

                        // Duration scaling
                        const durationDays = type === 'open_market' ? 365 * 2 : 365;
                        const maintenancePerDay = type === 'open_market' ? 0 : 0;

                        logs.push(`AI_TREATY_PROPOSAL:${JSON.stringify({
                            nationId: nation.id,
                            nationName: nation.name,
                            treaty: {
                                type,
                                durationDays,
                                maintenancePerDay,
                            }
                        })}`);
                    }
                }
            }
        }
    });
};

/**
 * Process AI-AI alliance formation
 * @param {Array} visibleNations - Array of visible nations
 * @param {number} tick - Current game tick
 * @param {Array} logs - Log array (mutable)
 */
export const processAIAllianceFormation = (visibleNations, tick, logs) => {
    visibleNations.forEach(nation => {
        if (Math.random() > 0.002) return;

        const nationAggression = nation.aggression ?? 0.3;
        if (nationAggression > 0.6) return;

        if (!nation.allies) nation.allies = [];

        const potentialAllies = visibleNations.filter(other => {
            if (other.id === nation.id) return false;
            if (nation.allies.includes(other.id)) return false;
            if (nation.foreignWars?.[other.id]?.isAtWar) return false;
            const relation = nation.foreignRelations?.[other.id] ?? 50;
            const otherRelation = other.foreignRelations?.[nation.id] ?? 50;
            return relation >= 70 && otherRelation >= 70;
        });

        if (potentialAllies.length === 0) return;

        const ally = potentialAllies[Math.floor(Math.random() * potentialAllies.length)];

        const avgRelation = ((nation.foreignRelations?.[ally.id] ?? 50) + (ally.foreignRelations?.[nation.id] ?? 50)) / 2;
        const allianceChance = (avgRelation - 60) / 100;

        if (Math.random() < allianceChance) {
            if (!ally.allies) ally.allies = [];
            nation.allies.push(ally.id);
            ally.allies.push(nation.id);
            logs.push(`🤝 国际新闻：${nation.name} 与 ${ally.name} 正式缔结军事同盟！`);
        }
    });
};

/**
 * Check and process AI breaking alliance with player
 * @param {Object} nation - AI nation object (mutable)
 * @param {Array} logs - Log array (mutable)
 */
export const checkAIBreakAlliance = (nation, logs) => {
    if (!nation.alliedWithPlayer || nation.isAtWar) return;

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
};

/**
 * Process relation decay for a single nation (daily)
 * @param {Object} nation - AI nation object (mutable)
 */
export const processNationRelationDecay = (nation) => {
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
