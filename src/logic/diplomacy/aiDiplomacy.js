/**
 * AI Diplomacy Module
 * Handles AI diplomatic behavior: gifts, trade, alliances, relations
 * Extracted from simulation.js for better code organization
 */

import { ORGANIZATION_EFFECTS, RESOURCES, PEACE_TREATY_TYPES, getTreatyBreachPenalty } from '../../config';
import {
    calculateAIGiftAmount,
} from '../../utils/diplomaticUtils';
import { clamp } from '../utils';
import {
    getRelationChangeMultipliers,
    getRelationDailyDriftRate,
    getAllyColdEventCooldown,
    getAllyColdEventChance,
} from '../../config/difficulty';
import { canVassalPerformDiplomacy } from './vassalSystem';

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
 * @param {string} difficultyLevel - Current difficulty level (default 'normal')
 */
export const processAllyColdEvents = (nations, tick, logs, difficultyLevel = 'normal') => {
    if (!Array.isArray(nations)) return;

    // Get difficulty-based cooldown and chance
    const cooldown = getAllyColdEventCooldown(difficultyLevel);
    const baseChance = getAllyColdEventChance(difficultyLevel);

    nations.forEach(nation => {
        if (nation.isRebelNation) return;
        if (nation.alliedWithPlayer !== true) return;
        if ((nation.relation ?? 50) >= 70) return;

        const lastColdEventDay = nation.lastAllyColdEventDay || 0;
        if (tick - lastColdEventDay < cooldown) return;

        if (Math.random() < baseChance) {
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
const getSharedOrganizationEffects = (organizationState, nationId, partnerId) => {
    const organizations = organizationState?.organizations;
    if (!Array.isArray(organizations)) {
        return { tariffDiscount: 0, relationBonus: 0 };
    }

    return organizations.reduce(
        (acc, org) => {
            if (!org || !Array.isArray(org.members)) return acc;
            if (!org.members.includes(nationId) || !org.members.includes(partnerId)) return acc;
            const effects = ORGANIZATION_EFFECTS[org.type] || {};
            return {
                tariffDiscount: Math.max(acc.tariffDiscount, effects.tariffDiscount || 0),
                relationBonus: Math.max(acc.relationBonus, effects.relationBonus || 0),
            };
        },
        { tariffDiscount: 0, relationBonus: 0 }
    );
};

export const processAITrade = (visibleNations, logs, diplomacyOrganizations = null) => {
    visibleNations.forEach(nation => {
        if (Math.random() > 0.02) return;
        if (nation.isAtWar) return;

        // Check vassal trade restrictions - puppets and colonies cannot trade independently
        const vassalTradeCheck = canVassalPerformDiplomacy(nation, 'trade');
        if (!vassalTradeCheck.allowed) {
            return; // Skip - this vassal cannot trade independently
        }

        const wealth = nation.wealth || 500;
        if (wealth < 300) return;

        const tradeCandidates = visibleNations.filter(n => {
            if (n.id === nation.id) return false;
            if (n.isAtWar) return false;
            if (nation.foreignWars?.[n.id]?.isAtWar) return false;

            // Check if trade partner is also restricted
            const otherTradeCheck = canVassalPerformDiplomacy(n, 'trade');
            if (!otherTradeCheck.allowed) return false;

            const relation = nation.foreignRelations?.[n.id] ?? 50;
            return relation >= 30;
        });

        if (tradeCandidates.length === 0) return;

        const partner = tradeCandidates[Math.floor(Math.random() * tradeCandidates.length)];
        const tradeValue = Math.floor(20 + Math.random() * 60);

        const taxRate = 0.08;
        const sharedEffects = getSharedOrganizationEffects(diplomacyOrganizations, nation.id, partner.id);
        const effectiveTaxRate = taxRate * (1 - sharedEffects.tariffDiscount);
        const profitAfterTax = tradeValue * (1 - effectiveTaxRate) - tradeValue * 0.5;
        if (profitAfterTax <= 0) return;

        nation.wealth = (nation.wealth || 0) + tradeValue * 0.05;
        partner.wealth = (partner.wealth || 0) + tradeValue * 0.05;

        if (!nation.foreignRelations) nation.foreignRelations = {};
        if (!partner.foreignRelations) partner.foreignRelations = {};
        const relationBoost = 1 + (sharedEffects.relationBonus || 0);
        nation.foreignRelations[partner.id] = Math.min(100, (nation.foreignRelations[partner.id] || 50) + relationBoost);
        partner.foreignRelations[nation.id] = Math.min(100, (partner.foreignRelations[nation.id] || 50) + relationBoost);
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
export const processAIPlayerTrade = (visibleNations, tick, resources, market, logs, taxPolicies = {}, diplomacyOrganizations = null, onTreasuryChange = null) => {
    const res = resources;
    const organizationList = diplomacyOrganizations?.organizations || [];
    const getTariffDiscount = (nationId) => {
        const org = organizationList.find(entry =>
            Array.isArray(entry?.members) && entry.members.includes('player') && entry.members.includes(nationId)
        );
        return org ? (ORGANIZATION_EFFECTS[org.type]?.tariffDiscount || 0) : 0;
    };

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
        // 关税存储为小数（0=无关税，0.5=50%关税，<0=补贴）
        // 最终税率 = 交易税 + 关税（加法叠加）
        const baseTaxRate = taxPolicies?.resourceTaxRates?.[resourceKey] || 0;
        const tariffRate = isBuying
            ? (taxPolicies?.exportTariffMultipliers?.[resourceKey] ?? taxPolicies?.resourceTariffMultipliers?.[resourceKey] ?? 0)
            : (taxPolicies?.importTariffMultipliers?.[resourceKey] ?? taxPolicies?.resourceTariffMultipliers?.[resourceKey] ?? 0);
        const tariffDiscount = getTariffDiscount(nation.id);
        const adjustedTariffRate = tariffRate * (1 - tariffDiscount);
        const effectiveTariffRate = isOpenMarket ? 0 : baseTaxRate + adjustedTariffRate;

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
                applyTreasuryChange(res, tariff, 'ai_trade_tariff', onTreasuryChange);
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
                applyTreasuryChange(res, tariff, 'ai_trade_tariff', onTreasuryChange);
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

        // Check vassal treaty restrictions for AI-player treaty proposals
        const vassalTreatyCheck = canVassalPerformDiplomacy(nation, 'treaty');
        // Note: canProposeTreaties used for treaty proposal gating (currently disabled section below)
        void vassalTreatyCheck; // Suppress unused variable warning until treaty proposals are re-enabled

        // AI breach peace treaty when relation collapses
        if (nation.peaceTreatyUntil && tick < nation.peaceTreatyUntil) {
            const breachPenalty = getTreatyBreachPenalty(epoch);
            const lastBreachDay = Number.isFinite(nation.lastTreatyBreachDay) ? nation.lastTreatyBreachDay : -Infinity;
            const canBreach = (tick - lastBreachDay) >= breachPenalty.cooldownDays;
            const breachPressure = playerRelation < 15 && aggression > 0.55;

            if (canBreach && breachPressure) {
                const breachChance = Math.min(0.05, 0.005 + (0.02 * (aggression - 0.55)) + Math.max(0, (15 - playerRelation) / 500));
                if (Math.random() < breachChance) {
                    nation.relation = Math.max(0, playerRelation - breachPenalty.relationPenalty);
                    nation.peaceTreatyUntil = undefined;
                    if (Array.isArray(nation.treaties)) {
                        nation.treaties = nation.treaties.filter(t => !PEACE_TREATY_TYPES.includes(t.type));
                    }
                    nation.lastTreatyBreachDay = tick;
                    logs.push(`AI_TREATY_BREACH:${JSON.stringify({
                        nationId: nation.id,
                        nationName: nation.name,
                        relationPenalty: breachPenalty.relationPenalty,
                    })}`);
                    logs.push(`⚠️ ${nation.name} 撕毁了与你的和平条约，关系恶化（-${breachPenalty.relationPenalty}）。`);
                }
            }
        }

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
        // Re-enable when treaty proposals are needed, and use vassalTreatyCheck.allowed to gate proposals
        /* DISABLED CODE BLOCK
        if (vassalTreatyCheck.allowed) {
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
        END DISABLED CODE BLOCK */
    });
};

/**
 * Process AI-AI alliance formation
 * @param {Array} visibleNations - Array of visible nations
 * @param {number} tick - Current game tick
 * @param {Array} logs - Log array (mutable)
 */
import { createOrganization } from './organizationDiplomacy';

/**
 * Process AI-AI alliance formation using International Organizations
 * @param {Array} visibleNations - Array of visible nations
 * @param {number} tick - Current game tick
 * @param {Array} logs - Log array (mutable)
 * @param {Object} diplomacyOrganizations - Current organization state
 * @param {number} epoch - Current epoch
 * @returns {Object} - Returns new organizations and member updates
 */
/**
 * Process AI Economic Bloc formation
 * Conditions: Era 5+, High Wealth, Good Relations
 */
const processAIEconomicBlocFormation = (visibleNations, tick, logs, diplomacyOrganizations, epoch) => {
    const existingOrgs = diplomacyOrganizations?.organizations || [];
    const result = { createdOrganizations: [], memberJoinRequests: [] };
    const shuffled = [...visibleNations].sort(() => Math.random() - 0.5);

    shuffled.forEach(nation => {
        if (Math.random() > 0.005) return; // Low daily chance

        // Wealth check
        if ((nation.wealth || 0) < 2000) return;

        // Check if already in an economic bloc
        const myBloc = existingOrgs.find(org => org.type === 'economic_bloc' && org.members.includes(nation.id));
        if (myBloc) return;

        const potentialPartners = visibleNations.filter(other => {
            if (other.id === nation.id) return false;
            // Wealth check for partner
            if ((other.wealth || 0) < 2000) return false;

            // Check restriction
            const otherDiplomacy = canVassalPerformDiplomacy(other, 'alliance'); // Re-use alliance restriction or similar
            if (!otherDiplomacy.allowed) return false;

            const relation = nation.foreignRelations?.[other.id] ?? 50;
            const otherRelation = other.foreignRelations?.[nation.id] ?? 50;
            return relation >= 60 && otherRelation >= 60; // Moderate+ relations
        });

        if (potentialPartners.length === 0) return;

        const partner = potentialPartners[Math.floor(Math.random() * potentialPartners.length)];

        // Check if partner is in a bloc
        const partnerBloc = existingOrgs.find(org => org.type === 'economic_bloc' && org.members.includes(partner.id));

        if (partnerBloc) {
            // Join existing bloc
            const members = partnerBloc.members.map(mid => visibleNations.find(n => n.id === mid)).filter(n => n);
            const approval = members.every(member => (member.foreignRelations?.[nation.id] ?? 50) >= 50);

            if (approval) {
                result.memberJoinRequests.push({ orgId: partnerBloc.id, nationId: nation.id, orgName: partnerBloc.name });
                logs.push(`💰 ${nation.name} 此刻申请加入 "${partnerBloc.name}" 以寻求经济合作。`);
            }
        } else {
            // Create new Economic Bloc
            const names = ['贸易同盟', '经济共同体', '自由市场协定', '关税同盟', '繁荣互助会', '商业联合会'];
            const name = names[Math.floor(Math.random() * names.length)] + (Math.random() > 0.5 ? '' : ` (${nation.name})`);

            const createResult = createOrganization({
                type: 'economic_bloc',
                founderId: nation.id,
                founderName: nation.name,
                name: name,
                epoch,
                daysElapsed: tick
            });

            if (createResult.success) {
                // Founder joins automatically in createOrganization logic? 
                // We also want the partner to join immediately if possible
                const newOrg = createResult.organization;
                newOrg.members.push(partner.id);

                result.createdOrganizations.push(newOrg);
                logs.push(`💰 国际新闻：${nation.name} 与 ${partner.name} 宣布共同建立 "${name}"！`);
            }
        }
    });

    return result;
};

export const processAIAllianceFormation = (visibleNations, tick, logs, diplomacyOrganizations, epoch) => {
    const existingOrgs = diplomacyOrganizations?.organizations || [];
    const result = {
        createdOrganizations: [],
        memberJoinRequests: [], // { orgId, nationId }
    };

    // Shuffle nations to avoid bias
    const shuffledNations = [...visibleNations].sort(() => Math.random() - 0.5);

    shuffledNations.forEach(nation => {
        if (Math.random() > 0.005) return; // Low daily chance

        // Check vassal diplomatic restrictions
        const vassalAllianceCheck = canVassalPerformDiplomacy(nation, 'alliance');
        if (!vassalAllianceCheck.allowed) {
            return;
        }

        const nationAggression = nation.aggression ?? 0.3;
        // Check if nation is already in a military alliance
        const myAlliance = existingOrgs.find(org =>
            org.type === 'military_alliance' && org.members.includes(nation.id)
        );

        // Limit: one military alliance per nation for simplicity
        if (myAlliance) return;

        const potentialAllies = visibleNations.filter(other => {
            if (other.id === nation.id) return false;

            // Check restriction
            const otherAllianceCheck = canVassalPerformDiplomacy(other, 'alliance');
            if (!otherAllianceCheck.allowed) return false;

            // Cannot be at war with each other
            if (nation.foreignWars?.[other.id]?.isAtWar) return false;
            if (other.foreignWars?.[nation.id]?.isAtWar) return false;

            const relation = nation.foreignRelations?.[other.id] ?? 50;
            const otherRelation = other.foreignRelations?.[nation.id] ?? 50;
            return relation >= 75 && otherRelation >= 75; // High relation required
        });

        if (potentialAllies.length === 0) return;

        const ally = potentialAllies[Math.floor(Math.random() * potentialAllies.length)];

        // Check if ally is in an alliance
        const allyAlliance = existingOrgs.find(org =>
            org.type === 'military_alliance' && org.members.includes(ally.id)
        );

        if (allyAlliance) {
            // Request to join ally's alliance
            // Check if existing members like me
            const members = allyAlliance.members.map(mid => visibleNations.find(n => n.id === mid)).filter(n => n);
            const approval = members.every(member => {
                const rel = member.foreignRelations?.[nation.id] ?? 50;
                return rel >= 60;
            });

            if (approval) {
                result.memberJoinRequests.push({ orgId: allyAlliance.id, nationId: nation.id, orgName: allyAlliance.name });
                logs.push(`🛡️ ${nation.name} 加入了由 ${ally.name} 所在的 "${allyAlliance.name}"！`);
            }
        } else {
            // Create new alliance
            // Generate name
            // Simple AI naming logic
            const prefixes = ['北方', '南方', '东方', '西方', '神圣', '大', '自由', '联合'];
            const suffixes = ['协约', '同盟', '公约组织', '防卫阵线', '联盟'];
            const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
            const suffix = suffixes[Math.floor(Math.random() * suffixes.length)];
            // Ensure unique name handling handled by create logic or chance
            const orgName = `${prefix}${suffix}`;

            const createResult = createOrganization({
                type: 'military_alliance',
                founderId: nation.id,
                founderName: nation.name,
                name: orgName,
                epoch,
                daysElapsed: tick
            });

            if (createResult.success) {
                const newOrg = createResult.organization;
                // Add the ally immediately (simplification)
                newOrg.members.push(ally.id);

                result.createdOrganizations.push(newOrg);
                logs.push(`🤝 国际新闻：${nation.name} 与 ${ally.name} 共同建立了新的军事同盟——"${orgName}"！`);
            }
        }
    });

    // Process Economic Blocs if Era >= 5
    if (epoch >= 5) {
        const economicResult = processAIEconomicBlocFormation(visibleNations, tick, logs, diplomacyOrganizations, epoch);
        result.createdOrganizations.push(...economicResult.createdOrganizations);
        result.memberJoinRequests.push(...economicResult.memberJoinRequests);
    }

    return result;
};

/**
 * Check and process AI breaking alliance with player
 * @param {Object} nation - AI nation object (mutable)
 * @param {Array} logs - Log array (mutable)
 * @param {Object} diplomacyOrganizations - Org state
 * @returns {Object|null} - Returns leave request if action taken
 */
export const checkAIBreakAlliance = (nation, logs, diplomacyOrganizations) => {
    // Find alliances with player
    if (!diplomacyOrganizations) return null;

    const alliancesWithPlayer = (diplomacyOrganizations.organizations || []).filter(org =>
        org.type === 'military_alliance' &&
        org.members.includes(nation.id) &&
        org.members.includes('player')
    );

    if (alliancesWithPlayer.length === 0) return null;

    const relation = nation.relation ?? 50;
    const shouldBreak = relation < 30 || (nation.allianceStrain || 0) >= 3;

    if (shouldBreak) {
        // Leave all alliances with player
        const leaveRequests = alliancesWithPlayer.map(org => ({
            orgId: org.id,
            nationId: nation.id,
            orgName: org.name
        }));

        nation.allianceStrain = 0;

        leaveRequests.forEach(req => {
            logs.push(`💔 ${nation.name} 由于与你的关系恶化，退出了 "${req.orgName}"。`);
        });

        return { memberLeaveRequests: leaveRequests };
    }
    return null;
};

/**
 * Process relation decay for a single nation (daily)
 * @param {Object} nation - AI nation object (mutable)
 * @param {string} difficultyLevel - Difficulty level
 * @returns {Object} - Nation object (modified in place mostly, but returned for consistency)
 */
export const processNationRelationDecay = (nation, difficultyLevel = 'normal') => {
    const relation = nation.relation ?? 50;
    let relationChange = 0;

    const multipliers = getRelationChangeMultipliers(difficultyLevel);
    const baseDrift = getRelationDailyDriftRate(difficultyLevel);

    if (relation > 50) {
        // relation worsening (toward 50)
        relationChange = -baseDrift * multipliers.bad;
    } else if (relation < 50) {
        // relation improving (toward 50)
        relationChange = baseDrift * multipliers.good;
    }

    nation.relation = Math.max(0, Math.min(100, relation + relationChange));

    // AI-AI relation decay
    if (nation.foreignRelations) {
        Object.keys(nation.foreignRelations).forEach(otherId => {
            let r = nation.foreignRelations[otherId] ?? 50;
            if (r > 50) r -= baseDrift * multipliers.bad;
            else if (r < 50) r += baseDrift * multipliers.good;
            nation.foreignRelations[otherId] = Math.max(0, Math.min(100, r));
        });
    }
};

/**
 * AI 海外投资决策逻辑
 * 当玩家拥有附庸国时，AI（作为玩家的顾问/自动化）会建议或自动执行投资决策
 * @param {Object} context - 决策上下文
 * @returns {Object|null} 投资建议或 null
 */
export const makeAIInvestmentDecision = ({
    nation,
    overseasInvestments = [],
    classWealth = {},
    epoch = 0,
    marketPrices = {},
}) => {
    // 只有附庸国可以接受投资
    if (nation.vassalOf !== 'player') return null;

    // 工业时代（epoch >= 3）才能进行海外投资
    if (epoch < 3) return null;

    // 获取该国已有的投资数量
    const existingInvestments = overseasInvestments.filter(inv => inv.targetNationId === nation.id);
    const vassalConfig = nation.vassalConfig || {};
    const autonomy = vassalConfig.autonomy || 50;

    // 高自主度的附庸不太愿意接受更多投资
    const maxInvestments = autonomy >= 70 ? 2 : autonomy >= 50 ? 3 : 5;
    if (existingInvestments.length >= maxInvestments) return null;

    // 评估投资价值的因素
    const investmentScore = {
        value: 0,
        stratum: null,
        buildingId: null,
        mode: 'local',
        reason: '',
    };

    // 根据各阶层财富评估投资能力
    const investableStrata = ['capitalist', 'merchant', 'landowner'];
    const stratumPriority = investableStrata
        .map(stratum => ({
            stratum,
            wealth: classWealth[stratum] || 0,
        }))
        .filter(s => s.wealth >= 500) // 最低投资门槛
        .sort((a, b) => b.wealth - a.wealth);

    if (stratumPriority.length === 0) return null;

    // 选择财富最多的阶层进行投资
    const bestStratum = stratumPriority[0];

    // 根据附庸国特点选择投资建筑
    const nationEconomy = nation.economy || 'balanced';
    let preferredBuildings = [];

    switch (nationEconomy) {
        case 'agricultural':
            preferredBuildings = ['plantation', 'granary', 'grain_mill'];
            break;
        case 'industrial':
            preferredBuildings = ['factory', 'steelmill', 'coal_mine'];
            break;
        case 'commercial':
            preferredBuildings = ['market', 'warehouse', 'trade_post'];
            break;
        default:
            preferredBuildings = ['factory', 'plantation', 'market'];
    }

    // 选择第一个可用的建筑
    const selectedBuilding = preferredBuildings[0];

    // 选择运营模式
    // - 当地运营：默认，平衡模式
    // - 倾销模式：当附庸市场价格较低时
    // - 回购模式：当本国市场价格较高时
    let operatingMode = 'local';
    if (marketPrices && Object.keys(marketPrices).length > 0) {
        const avgPrice = Object.values(marketPrices).reduce((sum, p) => sum + p, 0) / Object.keys(marketPrices).length;
        if (avgPrice > 1.2) {
            operatingMode = 'buyback'; // 本国价格高，回购有利
        } else if (avgPrice < 0.8) {
            operatingMode = 'dumping'; // 倾销到附庸市场
        }
    }

    // 计算投资评分
    investmentScore.value = bestStratum.wealth * 0.1 + (100 - autonomy) * 0.5;
    investmentScore.stratum = bestStratum.stratum;
    investmentScore.buildingId = selectedBuilding;
    investmentScore.mode = operatingMode;
    investmentScore.reason = `${bestStratum.stratum === 'capitalist' ? '资本家' : bestStratum.stratum === 'merchant' ? '商人' : '地主'}阶层财富充裕，建议投资${nation.name}的${selectedBuilding}`;

    // 只有评分足够高才建议投资
    if (investmentScore.value < 30) return null;

    return {
        type: 'overseas_investment_suggestion',
        targetNationId: nation.id,
        targetNationName: nation.name,
        ownerStratum: investmentScore.stratum,
        buildingId: investmentScore.buildingId,
        operatingMode: investmentScore.mode,
        score: investmentScore.value,
        reason: investmentScore.reason,
    };
};

/**
 * 批量处理AI投资建议
 * @param {Object} context - 上下文
 * @returns {Array} 投资建议列表
 */
export const processAIInvestmentSuggestions = ({
    nations = [],
    overseasInvestments = [],
    classWealth = {},
    epoch = 0,
    marketPrices = {},
}) => {
    const suggestions = [];

    // 遍历所有附庸国
    const vassalNations = nations.filter(n => n.vassalOf === 'player');

    for (const nation of vassalNations) {
        const suggestion = makeAIInvestmentDecision({
            nation,
            overseasInvestments,
            classWealth,
            epoch,
            marketPrices,
        });

        if (suggestion) {
            suggestions.push(suggestion);
        }
    }

    return suggestions;
};
