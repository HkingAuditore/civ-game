import { RESOURCES, TREATY_CONFIGS, TREATY_VALUES } from '../../config';
import { calculateTradeStatus } from '../../utils/foreignTrade';
import { ORGANIZATION_TYPE_CONFIGS } from './organizationDiplomacy';

const BASE_CHANCE_BY_TYPE = {
    peace_treaty: 0.35,        // 0.45 -> 0.35
    non_aggression: 0.25,      // 0.35 -> 0.25
    trade_agreement: 0.22,     // 0.32 -> 0.22
    free_trade: 0.15,          // 0.18 -> 0.15 (reduced)
    investment_pact: 0.12,     // 0.15 -> 0.12 (reduced)
    open_market: 0.10,         // 0.20 -> 0.10 (HEAVILY reduced - most exploitative treaty)
    academic_exchange: 0.18,   // 0.25 -> 0.18
    defensive_pact: 0.12,      // 0.18 -> 0.12
    military_alliance: 0.10,   // 0.15 -> 0.10
    economic_bloc: 0.08,       // 0.12 -> 0.08
};

const VALUE_SCALE_FACTOR = 100000;

const clampValue = (value, min, max) => Math.min(max, Math.max(min, value));

/**
 * Negotiation Stance System
 * Each stance has:
 * - upfrontCost: Resources required to use this stance
 * - guaranteedEffects: Effects that always happen
 * - acceptChanceModifier: How this stance affects acceptance chance
 * - counterProposalModifier: How this stance affects AI's counter-proposal demands
 */
export const NEGOTIATION_STANCES = {
    friendly: {
        id: 'friendly',
        name: '友善',
        description: '展现善意，需要良好关系才能提升成功率，但对方会提高要价',
        upfrontCost: {
            silver: 0, // No cost - pure diplomacy
        },
        guaranteedEffects: {
            relationChange: 2, // Always improves relation slightly
            reputationChange: 1, // Slight reputation boost
        },
        // Friendly stance: requires good relation to be effective
        // If relation >= 60: +15% acceptance chance
        // If relation 40-59: +5% acceptance chance
        // If relation < 40: no bonus
        acceptChanceBonus: (relation) => {
            if (relation >= 60) return 0.15;
            if (relation >= 40) return 0.05;
            return 0;
        },
        // Friendly stance makes AI more greedy - they ask for more
        counterProposalModifier: 1.3, // AI demands 30% more compensation
    },
    normal: {
        id: 'normal',
        name: '中立',
        description: '标准谈判，无额外效果',
        upfrontCost: {
            silver: 0,
        },
        guaranteedEffects: {},
        acceptChanceBonus: () => 0,
        counterProposalModifier: 1.0, // No change
    },
    aggressive: {
        id: 'aggressive',
        name: '施压',
        description: '利用实力或财力优势施压，提高成功率但降低关系和声誉',
        upfrontCost: {
            silver: 0, // No upfront cost
        },
        guaranteedEffects: {
            relationChange: -5, // Always damages relation
            reputationChange: -2, // Damages reputation
        },
        // Aggressive stance: requires power/wealth advantage to be effective
        // If playerPower > targetPower * 1.2 OR playerWealth > targetWealth * 1.5: +20% acceptance
        // If playerPower > targetPower * 1.0 OR playerWealth > targetWealth * 1.2: +10% acceptance
        // Otherwise: -10% acceptance (backfires)
        acceptChanceBonus: (relation, playerPower, targetPower, playerWealth, targetWealth) => {
            const powerRatio = targetPower > 0 ? playerPower / targetPower : 1;
            const wealthRatio = targetWealth > 0 ? playerWealth / targetWealth : 1;
            
            if (powerRatio > 1.2 || wealthRatio > 1.5) {
                return 0.20; // Strong advantage: +20%
            } else if (powerRatio > 1.0 || wealthRatio > 1.2) {
                return 0.10; // Moderate advantage: +10%
            } else {
                return -0.10; // No advantage: backfires -10%
            }
        },
        counterProposalModifier: 0.8, // AI demands 20% less (intimidated)
    },
};

/**
 * Check if player can afford stance upfront cost
 */
export const canAffordStance = (stance, playerResources) => {
    const stanceConfig = NEGOTIATION_STANCES[stance];
    if (!stanceConfig) return { canAfford: true, missing: {} };

    const missing = {};
    let canAfford = true;

    for (const [resource, cost] of Object.entries(stanceConfig.upfrontCost)) {
        if (cost > 0) {
            const available = playerResources[resource] || 0;
            if (available < cost) {
                canAfford = false;
                missing[resource] = cost - available;
            }
        }
    }

    return { canAfford, missing, cost: stanceConfig.upfrontCost };
};

const getResourceGiftValue = (resourceKey, amount) => {
    if (!resourceKey || !Number.isFinite(amount) || amount <= 0) return 0;
    const basePrice = RESOURCES[resourceKey]?.basePrice || 0;
    return Math.max(0, basePrice * amount);
};

// Calculate total value of multiple resources
const getMultiResourceGiftValue = (resources = [], resourceKey = '', resourceAmount = 0) => {
    let total = 0;
    // Support new array format
    if (Array.isArray(resources) && resources.length > 0) {
        for (const res of resources) {
            if (res.key && res.amount > 0) {
                total += getResourceGiftValue(res.key, res.amount);
            }
        }
    }
    // Also support old single resource format
    if (resourceKey && resourceAmount > 0) {
        total += getResourceGiftValue(resourceKey, resourceAmount);
    }
    return total;
};

const getResourceDealValue = (resourceKey, amount, nation, daysElapsed = 0) => {
    if (!resourceKey || !Number.isFinite(amount) || amount <= 0) return 0;
    const basePrice = RESOURCES[resourceKey]?.basePrice || 0;
    if (!nation) return Math.max(0, basePrice * amount);
    const tradeStatus = calculateTradeStatus(resourceKey, nation, daysElapsed);
    // Economic Utility: High value if they have shortage, Low value if surplus
    const multiplier = tradeStatus.isShortage ? 2.0 : (tradeStatus.isSurplus ? 0.5 : 1.0);
    return Math.max(0, basePrice * amount * multiplier);
};

/**
 * Calculate the actual economic benefit of a treaty type for a nation
 * Based on production capacity, economic strength, and trade situation
 */
const calculateTreatyBenefitForNation = ({
    type,
    nationWealth,
    nationPower,
    nationProduction = 0,
    otherWealth,
    otherPower,
    otherProduction = 0,
    relation = 50,
    organization = null,
    organizationMode = null,
    durationDays = 365,
}) => {
    let benefit = 0;
    let risk = 0;
    let strategicValue = 0;

    const wealthRatio = otherWealth > 0 ? nationWealth / otherWealth : 1;
    const powerRatio = otherPower > 0 ? nationPower / otherPower : 1;
    const productionRatio = otherProduction > 0 ? nationProduction / otherProduction : 1;
    const durationFactor = Math.min(3, durationDays / 365); // Scale benefits by duration

    switch (type) {
        case 'trade_agreement':
            // Trade agreement benefits both, but more for the one with higher production
            // If you produce more, you sell more
            if (productionRatio > 1) {
                benefit = 500 * productionRatio * durationFactor;
                strategicValue = 25 + Math.min(15, (productionRatio - 1) * 15);
                risk = 80 * durationFactor; // Increased from 0 - some risk even for stronger
            } else {
                benefit = 400 * durationFactor; // Reduced from 500 - less benefit for weaker
                strategicValue = 30; // Weaker party values the trade relationship more
                risk = 150 * durationFactor; // Risk of being outcompeted
            }
            // Risk: If partner is much wealthier, they may dominate trade
            if (wealthRatio < 0.5) {
                risk += 300 * (1 / wealthRatio) * durationFactor; // Increased from 200
            }
            break;

        case 'free_trade':
            // Free trade: Zero tariffs + 50% more merchant slots + relation decay reduction
            // Benefits both sides through tariff elimination
            // Stronger producer benefits more from tariff elimination
            if (productionRatio > 1.2) {
                benefit = 1000 * productionRatio * durationFactor;
                risk = 50; // Low risk - just tariff removal
            } else if (productionRatio < 0.8) {
                benefit = 500 * durationFactor; // Reduced from 600 - less benefit from cheaper imports
                risk = 450 * (1 / productionRatio) * durationFactor; // Increased from 300 - more risk from foreign competition
            } else {
                benefit = 700 * durationFactor;
                risk = 150 * durationFactor; // Increased from 100
            }
            // Additional risk if wealth imbalance exists
            if (wealthRatio < 0.7) {
                risk += 300 * (1 / wealthRatio) * durationFactor; // Risk of being economically dominated
            }
            // Less risk than before since no price convergence or unlimited slots
            strategicValue = 35;
            break;

        case 'investment_pact':
            // Investment benefits the one receiving investment (weaker economy)
            if (wealthRatio < 1) {
                benefit = 800 * (1 / wealthRatio) * durationFactor; // Weaker gets more benefit
                risk = 450 * durationFactor; // Increased from 300 - higher risk of foreign control
            } else {
                benefit = 400 * durationFactor; // Investor gets some return
                risk = 250 * durationFactor; // Increased from 200 - risk of investment loss
            }
            // Additional risk if much weaker - risk of economic colonization
            if (wealthRatio < 0.6) {
                risk += 400 * (1 / wealthRatio) * durationFactor;
            }
            strategicValue = 25;
            break;

        case 'open_market':
            // Open market is VERY one-sided - allows bypass relation limits, unlimited merchants, force trade
            // This is essentially economic colonization - the weaker party takes huge risk
            // Only the economically stronger party really benefits
            if (wealthRatio > 1.5) {
                // Strong economy forcing open market on weaker
                benefit = 1200 * wealthRatio * durationFactor;
                risk = 50; // Almost no risk for the strong
                strategicValue = 50; // High strategic value - economic dominance
            } else if (wealthRatio < 0.7) {
                // Weaker economy being forced to open market - VERY BAD DEAL
                benefit = 80 * durationFactor; // Minimal benefit (reduced from 100)
                risk = 2500 * (1 / wealthRatio) * durationFactor; // MASSIVE risk - economic flooding (increased from 1500)
                strategicValue = 5; // Very low strategic value - you're being exploited (reduced from 10)
            } else {
                // Roughly equal economies
                benefit = 350 * durationFactor; // Reduced from 400
                risk = 800 * durationFactor; // Increased from 600 - still risky even for equals
                strategicValue = 20; // Reduced from 25
            }
            // Additional risk based on production imbalance - if partner produces more, they flood your market
            if (productionRatio < 0.8) {
                risk += 1200 * (1 / productionRatio) * durationFactor; // Increased from 800
            }
            // CRITICAL: If other party is much stronger, add catastrophic risk
            if (wealthRatio < 0.5) {
                risk += 1500 * durationFactor; // Extreme exploitation risk
            }
            break;

        case 'academic_exchange':
            // Academic exchange is usually mutually beneficial with low risk
            benefit = 300 * durationFactor;
            risk = 50; // Minimal risk
            strategicValue = 40; // High strategic/soft power value
            break;

        case 'defensive_pact':
            // Defensive pact benefits the weaker party more
            if (powerRatio < 1) {
                benefit = 1000 * (1 / powerRatio) * durationFactor; // Weaker gets security
                strategicValue = 60;
            } else {
                benefit = 300 * durationFactor; // Stronger gets an ally
                risk = 200 * durationFactor; // Risk of being dragged into wars
                strategicValue = 30;
            }
            break;

        case 'military_alliance':
            // Military alliance - calculate based on organization strength
            if (organization && organizationMode) {
                const orgMembers = organization.members?.length || 1;
                const orgTotalPower = organization.totalMilitaryPower || nationPower;

                if (organizationMode === 'invite') {
                    // Inviting someone to your alliance
                    // Value depends on what the other party brings
                    benefit = 200 + (otherPower * 0.01); // Value of new member's military
                    strategicValue = 50 + Math.min(50, orgMembers * 10); // Larger alliance = more strategic
                } else if (organizationMode === 'join') {
                    // Joining someone's alliance
                    // Value depends on alliance strength
                    benefit = 500 + (orgTotalPower * 0.005);
                    strategicValue = 40 + Math.min(60, orgTotalPower / 1000);
                    risk = 300; // Risk of worsening terms
                }
            } else {
                // Standalone military alliance consideration
                if (powerRatio < 0.8) {
                    benefit = 1500 * (1 / powerRatio);
                    strategicValue = 80;
                } else {
                    benefit = 500;
                    strategicValue = 40;
                    risk = 300;
                }
            }
            break;

        case 'economic_bloc':
            // Economic bloc - major economic integration
            if (organization && organizationMode) {
                const orgMembers = organization.members?.length || 1;
                const orgTotalWealth = organization.totalEconomicPower || nationWealth;

                if (organizationMode === 'invite') {
                    // Inviting to your bloc - you gain market access
                    benefit = 300 + (otherWealth * 0.002);
                    strategicValue = 40 + Math.min(40, orgMembers * 8);
                    // If you're much stronger, target faces dumping risk
                    if (wealthRatio > 1.5 || productionRatio > 1.5) {
                        // You benefit more from weaker partner
                        benefit += 500;
                    }
                } else if (organizationMode === 'join') {
                    // Joining a bloc
                    benefit = 400 + (orgTotalWealth * 0.001);
                    strategicValue = 35 + Math.min(50, orgTotalWealth / 10000);
                    // Risk of being dominated if you're weaker
                    if (wealthRatio < 0.7) {
                        risk = 800; // Significant dumping/domination risk
                    } else {
                        risk = 200;
                    }
                }
            } else {
                // Standalone
                if (wealthRatio > 1.2) {
                    benefit = 1000 * wealthRatio;
                    strategicValue = 50;
                } else {
                    benefit = 500;
                    risk = 600 * (1 / wealthRatio);
                    strategicValue = 30;
                }
            }
            break;

        case 'peace_treaty':
            // Peace is always valuable, more so if you're weaker
            benefit = 500;
            if (powerRatio < 0.8) {
                benefit = 1000 * (1 / powerRatio);
            }
            strategicValue = 20;
            break;

        case 'non_aggression':
            // Non-aggression benefits weaker party more
            benefit = 300;
            if (powerRatio < 0.9) {
                benefit = 600 * (1 / powerRatio);
            }
            strategicValue = 15;
            break;

        default:
            benefit = 300;
            strategicValue = 10;
    }

    // Relation modifier: Better relations reduce perceived risk
    const relationModifier = Math.max(0.5, Math.min(1.5, relation / 50));
    risk = risk / relationModifier;

    return {
        benefit: Math.round(benefit),
        risk: Math.round(risk),
        strategicValue: Math.round(strategicValue),
    };
};

export const calculateDealScore = ({
    proposal = {},
    nation = {},
    stance = 'normal',
    daysElapsed = 0,
    playerPower = 0,
    targetPower = 0,
    playerWealth = 0,
    targetWealth = 0,
    playerProduction = 0,
    targetProduction = 0,
    organization = null,
    organizationMode = null,
}) => {
    const type = proposal.type;
    const relation = nation.relation || 0;
    const signingGift = Math.max(0, Math.floor(Number(proposal.signingGift) || 0));

    // Support both old single resource format and new multi-resource format
    const offerResources = Array.isArray(proposal.resources) ? proposal.resources : [];
    const resourceKey = proposal.resourceKey || '';
    const resourceAmount = Math.max(0, Math.floor(Number(proposal.resourceAmount) || 0));
    const demandResources = Array.isArray(proposal.demandResources) ? proposal.demandResources : [];
    const demandSilver = Math.max(0, Math.floor(Number(proposal.demandSilver) || 0));
    const demandResourceKey = proposal.demandResourceKey || '';
    const demandResourceAmount = Math.max(0, Math.floor(Number(proposal.demandResourceAmount) || 0));
    const maintenancePerDay = Math.max(0, Math.floor(Number(proposal.maintenancePerDay) || 0));
    const durationDays = Math.max(1, Math.floor(Number(proposal.durationDays) || 365));

    // --- Dynamic Treaty Value for Target Nation ---
    const targetBenefit = calculateTreatyBenefitForNation({
        type,
        nationWealth: targetWealth,
        nationPower: targetPower,
        nationProduction: targetProduction,
        otherWealth: playerWealth,
        otherPower: playerPower,
        otherProduction: playerProduction,
        relation,
        organization,
        organizationMode: organizationMode === 'invite' ? 'join' : (organizationMode === 'join' ? 'invite' : organizationMode),
        durationDays,
    });

    // --- Dynamic Treaty Value for Player (for UI display) ---
    const playerBenefit = calculateTreatyBenefitForNation({
        type,
        nationWealth: playerWealth,
        nationPower: playerPower,
        nationProduction: playerProduction,
        otherWealth: targetWealth,
        otherPower: targetPower,
        otherProduction: targetProduction,
        relation,
        organization,
        organizationMode,
        durationDays,
    });

    // --- Wealth Scaling ---
    const combinedWealth = Math.max(1000, (playerWealth || 0) + (targetWealth || 0));
    const wealthScale = Math.max(1.0, Math.log10(combinedWealth) - 2);

    // --- Offer & Demand Value (now supports multiple resources) ---
    let offerResourceValue = getResourceDealValue(resourceKey, resourceAmount, nation, daysElapsed);
    for (const res of offerResources) {
        if (res.key && res.amount > 0) {
            offerResourceValue += getResourceDealValue(res.key, res.amount, nation, daysElapsed);
        }
    }

    let demandResourceValue = getResourceDealValue(demandResourceKey, demandResourceAmount, nation, daysElapsed);
    for (const res of demandResources) {
        if (res.key && res.amount > 0) {
            demandResourceValue += getResourceDealValue(res.key, res.amount, nation, daysElapsed);
        }
    }

    // Maintenance value (NPV approximation)
    const maintenanceValue = maintenancePerDay * Math.min(365, durationDays);

    // Raw absolute values
    const offerValueRaw = signingGift + offerResourceValue + maintenanceValue;
    const demandValueRaw = demandSilver + demandResourceValue;

    // --- Scale offer/demand relative to target's wealth ---
    // A nation with 500 million wealth won't care about 10,000 silver
    // We normalize the value to a "perceived importance" score
    // Formula: perceived = (raw / targetWealth) * baseScale
    // baseScale chosen so that offering 1% of their wealth = ~1000 score points
    const targetWealthSafe = Math.max(10000, targetWealth || 10000);
    const valueScaleFactor = VALUE_SCALE_FACTOR; // Offering 1% of their wealth = 1000 score

    // Perceived value = how significant this amount is to the target
    // If AI has 500M wealth, 10000 silver = 10000/500000000 * 100000 = 2 points (negligible)
    // If AI has 100K wealth, 10000 silver = 10000/100000 * 100000 = 10000 points (significant!)
    const offerValue = Math.round((offerValueRaw / targetWealthSafe) * valueScaleFactor);
    const demandValue = Math.round((demandValueRaw / targetWealthSafe) * valueScaleFactor);

    // --- Stance Modifiers ---
    // Stance affects how AI perceives the negotiation
    let stanceScore = 0;

    if (stance === 'friendly') {
        // Friendly stance: No direct score bonus
        // The bonus comes from increased acceptance chance (handled in calculateNegotiationAcceptChance)
        stanceScore = 0;
    } else if (stance === 'normal') {
        // Normal stance: No modifiers, neutral negotiation
        stanceScore = 0;
    } else if (stance === 'aggressive') {
        // Aggressive stance: Leverage power/wealth advantage
        // Effective when you're stronger
        const powerRatio = targetPower > 0 ? playerPower / targetPower : 2.0;
        const wealthRatio = targetWealth > 0 ? playerWealth / targetWealth : 2.0;

        // Power advantage bonus
        if (powerRatio > 1.2) {
            stanceScore += (powerRatio - 1.0) * 600;
        } else if (powerRatio > 1.0) {
            stanceScore += (powerRatio - 1.0) * 400;
        }
        
        // Wealth advantage bonus
        if (wealthRatio > 1.5) {
            stanceScore += (wealthRatio - 1.0) * 400;
        } else if (wealthRatio > 1.2) {
            stanceScore += (wealthRatio - 1.0) * 250;
        }
        
        // If you're weaker, aggressive stance backfires
        if (powerRatio < 1.0 && wealthRatio < 1.2) {
            stanceScore -= 400; // Penalty for empty threats
        }
    }

    // --- Calculate what target thinks of the deal ---
    // Positive score = AI thinks it's gaining, Negative = AI thinks it's losing
    // Score = (What AI gets) - (What AI gives up)
    // What AI GETS: treaty benefit + silver/resources PLAYER OFFERS + stance bonus (from player's friendly stance)
    // What AI GIVES: treaty risk + silver/resources PLAYER DEMANDS + relation penalty (if bad relations)

    // offerValue = what player is GIVING (signingGift + resources) = what AI RECEIVES
    // demandValue = what player DEMANDS = what AI has to PAY

    // --- Political Risk (Dynamic based on treaty type and power dynamics) ---
    let politicalCost = 0;

    // Add treaty-specific political risk for the player
    if (type === 'free_trade' || type === 'economic_bloc') {
        const wealthRatio = targetWealth > 0 ? playerWealth / targetWealth : 1;
        if (wealthRatio < 0.7) {
            politicalCost += Math.round(50 * (1 / wealthRatio)); // Risk of economic domination
        }
    }
    if (type === 'military_alliance' || type === 'defensive_pact') {
        const powerRatio = targetPower > 0 ? playerPower / targetPower : 1;
        if (powerRatio < 0.8) {
            politicalCost += 20; // Risk of being subordinate
        }
    }

    // Relation impact: bad relations make AI more suspicious, good relations help
    // But don't let it dominate the calculation - cap it
    const relationImpact = clampValue((relation - 50) * 8, -450, 450);
    const treatyNet = targetBenefit.benefit - targetBenefit.risk;
    const strategicScore = targetBenefit.strategicValue * 20;

    const wealthRatio = targetWealth > 0 ? (playerWealth || 0) / targetWealth : 1;
    const powerRatio = targetPower > 0 ? (playerPower || 0) / targetPower : 1;
    let dominancePenalty = 0;
    if (['open_market', 'free_trade', 'investment_pact', 'economic_bloc'].includes(type)) {
        const wealthPressure = Math.max(0, wealthRatio - 1);
        const powerPressure = Math.max(0, powerRatio - 1);
        
        // Dramatically increased penalties for economic treaties with power imbalance
        const baseWeight = type === 'open_market' ? 2000 : (type === 'free_trade' ? 1200 : 800); // Increased from 900/650/450
        
        // Exponential scaling for extreme imbalances
        const wealthExponent = wealthPressure > 1 ? Math.pow(wealthPressure, 1.5) : wealthPressure;
        const powerExponent = powerPressure > 1 ? Math.pow(powerPressure, 1.3) : powerPressure;
        
        dominancePenalty = (wealthExponent * baseWeight * 2.0) + (powerExponent * baseWeight * 1.2); // Increased multipliers from 1.4/0.9
        
        // Additional penalty for open_market specifically - it's the most exploitative
        if (type === 'open_market' && wealthRatio > 2.0) {
            dominancePenalty += (wealthRatio - 2.0) * 1500; // Massive penalty for 2x+ wealth advantage
        }
    }
    dominancePenalty = Math.round(dominancePenalty);

    const score = treatyNet
        + strategicScore
        + offerValue
        - demandValue
        + stanceScore
        + relationImpact
        - dominancePenalty
        - politicalCost;

    // --- Strategic Value (Dynamic based on treaty and circumstances) ---
    const strategicValue = playerBenefit.strategicValue;

    // --- Economic Net Value (for display) ---
    // This shows the perceived value exchange after wealth scaling (for UI display)
    // Using scaled values ensures UI display matches AI's actual evaluation
    const economicNetValue = offerValue - demandValue;

    return {
        score,
        breakdown: {
            offerValue,       // Scaled perceived value
            demandValue,      // Scaled perceived value
            offerValueRaw,    // Absolute silver amount
            demandValueRaw,   // Absolute silver amount
            treatyValue: targetBenefit.benefit, // What target thinks treaty is worth
            treatyRisk: targetBenefit.risk, // What target thinks the risk is
            relationImpact,
            stanceScore,
            maintenanceValue,
            treatyNet,
            strategicScore,
            dominancePenalty,
            strategicValue,
            politicalCost,
            wealthScale,
            economicNetValue, // Absolute net value for UI
            targetWealthSafe, // For debugging
            // For detailed analysis
            playerBenefit: playerBenefit.benefit,
            playerRisk: playerBenefit.risk,
            targetBenefit: targetBenefit.benefit,
            targetRisk: targetBenefit.risk,
        },
    };
};

/**
 * Calculate negotiation acceptance chance
 * Now properly linked to AI's evaluation of the deal
 */
export const calculateNegotiationAcceptChance = ({
    proposal = {},
    nation = {},
    epoch = 0,
    stance = 'normal',
    daysElapsed = 0,
    playerPower = 0,
    targetPower = 0,
    playerWealth = 0,
    targetWealth = 0,
    playerProduction = 0,
    targetProduction = 0,
    organization = null,
    organizationMode = null,
}) => {
    const type = proposal.type;
    const relation = nation.relation || 0;
    const aggression = nation.aggression ?? 0.3;
    const maintenancePerDay = Math.max(0, Math.floor(Number(proposal.maintenancePerDay) || 0));
    const durationDays = Math.max(1, Math.floor(Number(proposal.durationDays) || 365));
    const treatyConfig = TREATY_CONFIGS[type] || {};

    const deal = calculateDealScore({
        proposal,
        nation,
        stance,
        daysElapsed,
        playerPower,
        targetPower,
        playerWealth,
        targetWealth,
        playerProduction,
        targetProduction,
        organization,
        organizationMode,
    });

    // --- Accept Chance directly tied to deal score ---
    // If AI thinks it's gaining (positive score), high chance
    // If AI thinks it's losing (negative score), low chance

    // Reference value for normalizing the score
    // Increased minimum to prevent small penalties from being diluted
    const referenceValue = Math.max(
        1500,  // 500 -> 1500 (3x increase to make penalties more impactful)
        (Math.abs(deal.breakdown.treatyValue) + Math.abs(deal.breakdown.treatyRisk)) / 2
    );
    const baseChance = BASE_CHANCE_BY_TYPE[type] || 0.25;
    const baseLogit = Math.log(baseChance / (1 - baseChance));
    const scoreNorm = deal.score / referenceValue;
    let acceptChance = 1 / (1 + Math.exp(-(scoreNorm + baseLogit)));

    // Relation modifier: good relations make deals easier (but reduced impact)
    const relationBoost = clampValue((relation - 50) / 300, -0.12, 0.12); // Reduced from /200 to /300

    // Aggression penalty: aggressive nations are harder to negotiate with (increased)
    // High aggression = more suspicious, less willing to cooperate
    const aggressionPenalty = aggression * 0.25; // Increased from 0.18 to 0.25
    
    // Additional aggression impact for economic treaties - aggressive nations don't trust economic deals
    let aggressionEconomicPenalty = 0;
    if (['open_market', 'free_trade', 'investment_pact', 'trade_agreement'].includes(type)) {
        aggressionEconomicPenalty = aggression * 0.15; // Aggressive nations are extra suspicious of economic deals
    }

    // Duration bonus: longer deals are slightly more attractive if beneficial
    const baseDuration = treatyConfig.baseDuration || 365;
    const durationBonus = deal.score > 0 && durationDays > baseDuration
        ? Math.min(0.05, ((durationDays - baseDuration) / baseDuration) * 0.03)
        : 0;

    acceptChance = acceptChance + relationBoost - aggressionPenalty - aggressionEconomicPenalty + durationBonus;

    // --- Apply Stance Bonus ---
    const stanceConfig = NEGOTIATION_STANCES[stance];
    let stanceBonus = 0;
    if (stanceConfig && stanceConfig.acceptChanceBonus) {
        stanceBonus = stanceConfig.acceptChanceBonus(
            relation,
            playerPower,
            targetPower,
            playerWealth,
            targetWealth
        );
        acceptChance += stanceBonus;
    }
    
    // Debug log
    console.log('🎯 Negotiation Calculation:', {
        stance,
        relation,
        playerPower,
        targetPower,
        playerWealth,
        targetWealth,
        stanceBonus,
        acceptChanceBefore: acceptChance - stanceBonus,
        acceptChanceAfter: acceptChance,
    });

    // Type-specific relation gates - stricter requirements for exploitative treaties
    const typeRelationRequirements = {
        'open_market': 70,         // 55 -> 70 (MUCH stricter - this is economic colonization)
        'trade_agreement': 50,
        'free_trade': 70,          // 65 -> 70 (stricter)
        'investment_pact': 65,     // 60 -> 65 (stricter)
        'academic_exchange': 65,
        'defensive_pact': 70,
        'military_alliance': 75,
        'economic_bloc': 70,
    };

    const requiredRelation = typeRelationRequirements[type];
    if (requiredRelation && relation < requiredRelation) {
        const relationDeficit = requiredRelation - relation;
        acceptChance *= Math.max(0.05, 1 - (relationDeficit / 40)); // Harsher penalty: 0.1->0.05, 50->40
    }

    // Hard relation gate from treaty config
    const minRelation = Number.isFinite(treatyConfig.minRelation) ? treatyConfig.minRelation : null;
    const relationGate = minRelation != null && relation < minRelation;
    if (relationGate) {
        acceptChance = Math.min(0.05, acceptChance * 0.1);
    }

    // Ensure deal score and chance are correlated
    // If AI thinks it's significantly losing, cap the chance (stricter caps)
    if (deal.score < -2000) {
        acceptChance = Math.min(acceptChance, 0.01); // Extremely bad deal - almost never accept (0.02 -> 0.01)
    } else if (deal.score < -1000) {
        acceptChance = Math.min(acceptChance, 0.03); // 0.05 -> 0.03 (stricter)
    } else if (deal.score < -500) {
        acceptChance = Math.min(acceptChance, 0.08); // 0.12 -> 0.08 (stricter)
    } else if (deal.score < 0) {
        acceptChance = Math.min(acceptChance, 0.15); // New: negative deals capped at 15%
    }
    
    // CRITICAL: For exploitative treaties, even positive scores shouldn't guarantee acceptance
    // AI should have \"pride\" and resist being bought out
    const exploitativeTreaties = ['open_market', 'free_trade', 'investment_pact'];
    if (exploitativeTreaties.includes(type)) {
        const wealthRatio = targetWealth > 0 ? playerWealth / targetWealth : 1;
        const powerRatio = targetPower > 0 ? playerPower / targetPower : 1;
        
        // If player is significantly stronger, AI becomes more resistant even to good deals
        if (wealthRatio > 2.0 || powerRatio > 1.5) {
            const pridePenalty = Math.min(0.4, (wealthRatio - 1) * 0.15 + (powerRatio - 1) * 0.1);
            acceptChance *= (1 - pridePenalty); // Reduce acceptance by up to 40%
            
            // For open_market specifically, even more resistant
            if (type === 'open_market' && wealthRatio > 2.5) {
                acceptChance *= 0.6; // Additional 40% reduction
            }
        }
        
        // Cap maximum acceptance for exploitative treaties when there's power imbalance
        if (wealthRatio > 1.8) {
            if (type === 'open_market') {
                acceptChance = Math.min(acceptChance, 0.35); // Max 35% for open_market
            } else {
                acceptChance = Math.min(acceptChance, 0.50); // Max 50% for others
            }
        }
        
        // RATIONAL ASSESSMENT: If the deal looks \"too good to be true\", AI becomes suspicious
        // This prevents players from just throwing money at AI to buy exploitative treaties
        if (deal.score > 3000 && wealthRatio > 1.5) {
            // AI thinks: \"Why is this rich nation giving me so much? There must be a catch...\"
            const suspicionPenalty = Math.min(0.3, (deal.score - 3000) / 10000);
            acceptChance *= (1 - suspicionPenalty);
        }
    }    
    // Good deals should still be attractive, but not guaranteed
    // Reduced all thresholds to encourage counter-proposals
    if (deal.score > 3000) {
        acceptChance = Math.max(acceptChance, 0.55); // Very good deals: 55% (was 75% at 2000)
    } else if (deal.score > 2000) {
        acceptChance = Math.max(acceptChance, 0.40); // Good deals: 40% (was 75%)
    } else if (deal.score > 1000) {
        acceptChance = Math.max(acceptChance, 0.30); // Decent deals: 30% (was 60%)
    } else if (deal.score > 500) {
        acceptChance = Math.max(acceptChance, 0.20); // Okay deals: 20% (was 45%)
    }

    return {
        acceptChance: Math.max(0.0, Math.min(1.0, acceptChance)),
        relationGate,
        minRelation,
        // Stable reason code for UI: if relationGate is true, UI can show a precise message.
        blockedReason: relationGate ? 'relation_gate' : null,
        dealScore: deal.score,
        dealBreakdown: deal.breakdown,
    };
};

/**
 * Generate AI counter-proposal
 */
export const generateCounterProposal = ({
    proposal = {},
    nation = {},
    round = 1,
    daysElapsed = 0,
    playerPower = 0,
    targetPower = 0,
    playerWealth = 0,
    targetWealth = 0,
    playerProduction = 0,
    targetProduction = 0,
    organization = null,
    organizationMode = null,
}) => {
    const relation = nation.relation || 0;
    const aggression = nation.aggression ?? 0.3;
    
    // MASSIVELY increased counter-proposal chance
    // Base 0.50 (was 0.25), relation bonus doubled, round bonus increased
    const counterChance = Math.min(0.90, 0.50 + (relation / 100) - (aggression * 0.05) + (round * 0.12));
    if (Math.random() > counterChance) return null;

    const deal = calculateDealScore({
        proposal,
        nation,
        stance: proposal.stance || 'normal',
        daysElapsed,
        playerPower,
        targetPower,
        playerWealth,
        targetWealth,
        playerProduction,
        targetProduction,
        organization,
        organizationMode,
    });

    const referenceValue = Math.max(
        500,
        (Math.abs(deal.breakdown.treatyValue) + Math.abs(deal.breakdown.treatyRisk)) / 2
    );
    const relationConcession = (relation - 50) * 5; // Reduced from 8 to 5 - less generous
    const roundConcession = round * 40; // Reduced from 60 to 40 - slower concessions
    
    // AI now aims for HIGHER target scores - more demanding
    const targetScore = Math.max(200, referenceValue * 0.25) - relationConcession - roundConcession; // 0.15 -> 0.25, 120 -> 200
    const shortfall = Math.max(0, targetScore - deal.score);
    
    // CRITICAL CHANGE: Even if deal is "good enough", AI may still counter-propose to get MORE
    // This creates real negotiation dynamics
    if (shortfall <= 0) {
        // Deal meets AI's minimum, but AI is greedy and wants more
        const greedChance = Math.max(0.3, 0.5 - (relation / 150) - (round * 0.15));
        if (Math.random() > greedChance) return null; // Sometimes accept good deals
        // Otherwise, try to squeeze more out of the deal
    }

    const targetWealthSafe = Math.max(10000, targetWealth || 10000);
    const playerWealthSafe = Math.max(10000, playerWealth || 10000);
    
    // Calculate rawNeeded with safety checks to prevent Infinity
    let rawNeeded = Math.ceil((shortfall / VALUE_SCALE_FACTOR) * targetWealthSafe);
    
    // Safety check: prevent Infinity or NaN
    if (!Number.isFinite(rawNeeded) || rawNeeded < 0) {
        rawNeeded = 0;
    }
    
    // Cap rawNeeded to prevent unreasonable demands
    const maxRawNeeded = Math.min(playerWealthSafe * 0.5, targetWealthSafe * 2.0);
    rawNeeded = Math.min(rawNeeded, maxRawNeeded);
    
    // AI demands MORE compensation for exploitative treaties
    if (proposal.type === 'open_market') {
        rawNeeded = Math.ceil(rawNeeded * 2.0); // Increased from 1.5 to 2.0
    } else if (proposal.type === 'free_trade') {
        rawNeeded = Math.ceil(rawNeeded * 1.6); // Increased from 1.25 to 1.6
    } else if (proposal.type === 'investment_pact') {
        rawNeeded = Math.ceil(rawNeeded * 1.4); // New: investment also needs more
    }
    
    // If player is much wealthier, AI demands even MORE
    const wealthRatio = targetWealth > 0 ? playerWealth / targetWealth : 1;
    if (wealthRatio > 2.0) {
        rawNeeded = Math.ceil(rawNeeded * (1 + (wealthRatio - 2.0) * 0.3)); // Extra 30% per wealth ratio
    }
    
    // Final safety check after all multipliers
    if (!Number.isFinite(rawNeeded) || rawNeeded < 0) {
        rawNeeded = 0;
    }
    rawNeeded = Math.min(rawNeeded, maxRawNeeded);

    // --- Apply Stance Modifier to Counter-Proposal ---
    // Friendly stance: AI becomes more greedy (demands more)
    // Aggressive stance: AI becomes more cautious (demands less)
    const stanceConfig = NEGOTIATION_STANCES[proposal.stance || 'normal'];
    const stanceModifier = stanceConfig?.counterProposalModifier || 1.0;
    rawNeeded = Math.ceil(rawNeeded * stanceModifier);

    const next = { ...proposal };
    const durationBase = Math.max(1, Math.floor(Number(proposal.durationDays) || 365));
    const giftBase = Math.max(0, Math.floor(Number(proposal.signingGift) || 0));

    // AI counter-proposal: AI demands payment from player, doesn't offer payment
    // Clear what AI offers (should be nothing or minimal)
    next.signingGift = 0; // AI doesn't pay player
    next.resources = []; // AI doesn't give resources

    const baseGiftFloor = clampValue(Math.round(targetWealthSafe * 0.02), 500, 8000); // 0.01 -> 0.02, 200 -> 500, 4000 -> 8000
    const openMarketFloor = proposal.type === 'open_market'
        ? clampValue(Math.round(targetWealthSafe * 0.05), 2000, 20000) // 0.02 -> 0.05, 500 -> 2000, 9000 -> 20000
        : baseGiftFloor;
    const freeTradeFloor = proposal.type === 'free_trade'
        ? clampValue(Math.round(targetWealthSafe * 0.03), 1000, 15000) // 0.015 -> 0.03, 400 -> 1000, 7000 -> 15000
        : baseGiftFloor;
    const giftFloor = Math.max(openMarketFloor, freeTradeFloor);
    const compensation = Math.ceil(rawNeeded * (1.0 + Math.random() * 0.3)); // 0.9-1.1 -> 1.0-1.3 (more demanding)
    
    // Safety check for compensation
    const safeCompensation = Number.isFinite(compensation) && compensation >= 0 ? compensation : 0;
    const calculatedDemand = Math.ceil(Math.max(giftBase + safeCompensation, giftFloor));
    
    // AI demands payment from player (put in demandSilver, not signingGift)
    next.demandSilver = Number.isFinite(calculatedDemand) && calculatedDemand >= 0 
        ? Math.min(calculatedDemand, playerWealthSafe * 0.8) // Cap at 80% of player wealth
        : giftFloor;

    // AI may also demand resources from player
    if (proposal.resources && Array.isArray(proposal.resources) && proposal.resources.length > 0) {
        // If player was offering resources, AI might demand MORE of those resources
        next.demandResources = proposal.resources.map(res => ({
            ...res,
            amount: Math.ceil(Math.max(1, (res.amount || 0) * (1.3 + Math.random() * 0.4))), // 1.3-1.7x more demanding
        }));
    } else {
        next.demandResources = [];
    }

    // AI adjusts treaty duration based on how bad the deal is
    if (shortfall > referenceValue * 0.4) {
        // Bad deal: AI wants SHORTER duration (less commitment)
        next.durationDays = Math.max(180, Math.floor(durationBase * 0.6)); // 0.8 -> 0.6 (shorter)
    } else if (shortfall > referenceValue * 0.2) {
        // Mediocre deal: slightly shorter
        next.durationDays = Math.max(270, Math.floor(durationBase * 0.8));
    } else {
        // Good deal: AI wants LONGER duration (lock in benefits)
        next.durationDays = Math.ceil(durationBase * (1.2 + Math.random() * 0.3)); // 1.05-1.15 -> 1.2-1.5 (longer)
    }

    return next;
};
