import { RESOURCES, TREATY_CONFIGS, TREATY_VALUES } from '../../config';
import { calculateTradeStatus } from '../../utils/foreignTrade';
import { ORGANIZATION_TYPE_CONFIGS } from './organizationDiplomacy';

const BASE_CHANCE_BY_TYPE = {
    peace_treaty: 0.45,
    non_aggression: 0.35,
    trade_agreement: 0.32,
    free_trade: 0.26,
    investment_pact: 0.22,
    open_market: 0.30,
    academic_exchange: 0.25,
    defensive_pact: 0.18,
    military_alliance: 0.15,
    economic_bloc: 0.12,
};

const VALUE_SCALE_FACTOR = 100000;

const clampValue = (value, min, max) => Math.min(max, Math.max(min, value));

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
            } else {
                benefit = 500 * durationFactor; // Still beneficial but less
                strategicValue = 30; // Weaker party values the trade relationship more
            }
            // Risk: If partner is much wealthier, they may dominate trade
            if (wealthRatio < 0.5) {
                risk = 200 * durationFactor;
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
                benefit = 600 * durationFactor; // Benefit from cheaper imports
                risk = 300 * (1 / productionRatio) * durationFactor; // Some risk from foreign competition
            } else {
                benefit = 700 * durationFactor;
                risk = 100 * durationFactor;
            }
            // Less risk than before since no price convergence or unlimited slots
            strategicValue = 35;
            break;

        case 'investment_pact':
            // Investment benefits the one receiving investment (weaker economy)
            if (wealthRatio < 1) {
                benefit = 800 * (1 / wealthRatio) * durationFactor; // Weaker gets more benefit
                risk = 300 * durationFactor; // Risk of foreign control
            } else {
                benefit = 400 * durationFactor; // Investor gets some return
                risk = 200 * durationFactor; // Risk of investment loss
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
                benefit = 100 * durationFactor; // Minimal benefit
                risk = 1500 * (1 / wealthRatio) * durationFactor; // HUGE risk - economic flooding
                strategicValue = 10; // Low strategic value - you're being exploited
            } else {
                // Roughly equal economies
                benefit = 400 * durationFactor;
                risk = 600 * durationFactor; // Still risky even for equals
                strategicValue = 25;
            }
            // Additional risk based on production imbalance - if partner produces more, they flood your market
            if (productionRatio < 0.8) {
                risk += 800 * (1 / productionRatio) * durationFactor;
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
    let stanceScore = 0;
    let stancePoliticalCost = 0;

    if (stance === 'friendly') {
        if (relation > 20) {
            stanceScore = (relation - 20) * (wealthScale * 3);
        }
    } else if (stance === 'aggressive') {
        const powerRatio = targetPower > 0 ? playerPower / targetPower : 2.0;
        const wealthRatio = targetWealth > 0 ? playerWealth / targetWealth : 2.0;

        if (powerRatio > 1.0) stanceScore += (powerRatio - 1.0) * 300;
        if (wealthRatio > 1.0) stanceScore += (wealthRatio - 1.0) * 200;

        stancePoliticalCost = 20;
    } else if (stance === 'threat') {
        const powerRatio = targetPower > 0 ? playerPower / targetPower : 2.0;
        if (powerRatio > 1.2) {
            stanceScore += (powerRatio - 1.0) * 500;
        } else {
            stanceScore -= 500; // Penalty if bluffing without power
        }
        stancePoliticalCost = 50;
    }

    // --- Calculate what target thinks of the deal ---
    // Positive score = AI thinks it's gaining, Negative = AI thinks it's losing
    // Score = (What AI gets) - (What AI gives up)
    // What AI GETS: treaty benefit + silver/resources PLAYER OFFERS + stance bonus (from player's friendly stance)
    // What AI GIVES: treaty risk + silver/resources PLAYER DEMANDS + relation penalty (if bad relations)

    // offerValue = what player is GIVING (signingGift + resources) = what AI RECEIVES
    // demandValue = what player DEMANDS = what AI has to PAY

    // --- Political Risk (Dynamic based on treaty type and power dynamics) ---
    let politicalCost = stancePoliticalCost;

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
        const baseWeight = type === 'open_market' ? 900 : (type === 'free_trade' ? 650 : 450);
        dominancePenalty = (wealthPressure * baseWeight * 1.4) + (powerPressure * baseWeight * 0.9);
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
    const referenceValue = Math.max(
        500,
        (Math.abs(deal.breakdown.treatyValue) + Math.abs(deal.breakdown.treatyRisk)) / 2
    );
    const baseChance = BASE_CHANCE_BY_TYPE[type] || 0.25;
    const baseLogit = Math.log(baseChance / (1 - baseChance));
    const scoreNorm = deal.score / referenceValue;
    let acceptChance = 1 / (1 + Math.exp(-(scoreNorm + baseLogit)));

    // Relation modifier: good relations make deals easier
    const relationBoost = clampValue((relation - 50) / 200, -0.15, 0.15);

    // Aggression penalty: aggressive nations are harder to negotiate with
    const aggressionPenalty = aggression * 0.12;

    // Duration bonus: longer deals are slightly more attractive if beneficial
    const baseDuration = treatyConfig.baseDuration || 365;
    const durationBonus = deal.score > 0 && durationDays > baseDuration
        ? Math.min(0.05, ((durationDays - baseDuration) / baseDuration) * 0.03)
        : 0;

    acceptChance = acceptChance + relationBoost - aggressionPenalty + durationBonus;

    // Type-specific relation gates with softer penalties
    const typeRelationRequirements = {
        'open_market': 55,
        'trade_agreement': 50,
        'free_trade': 65,
        'investment_pact': 60,
        'academic_exchange': 65,
        'defensive_pact': 70,
        'military_alliance': 75,
        'economic_bloc': 70,
    };

    const requiredRelation = typeRelationRequirements[type];
    if (requiredRelation && relation < requiredRelation) {
        const relationDeficit = requiredRelation - relation;
        acceptChance *= Math.max(0.1, 1 - (relationDeficit / 50)); // Soft penalty based on deficit
    }

    // Hard relation gate from treaty config
    const minRelation = Number.isFinite(treatyConfig.minRelation) ? treatyConfig.minRelation : null;
    const relationGate = minRelation != null && relation < minRelation;
    if (relationGate) {
        acceptChance = Math.min(0.05, acceptChance * 0.1);
    }

    // Ensure deal score and chance are correlated
    // If AI thinks it's significantly losing, cap the chance
    if (deal.score < -1000) {
        acceptChance = Math.min(acceptChance, 0.12);
    } else if (deal.score < -500) {
        acceptChance = Math.min(acceptChance, 0.25);
    } else if (deal.score > 1000) {
        acceptChance = Math.max(acceptChance, 0.75);
    } else if (deal.score > 500) {
        acceptChance = Math.max(acceptChance, 0.55);
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
    const counterChance = Math.min(0.65, 0.25 + (relation / 200) - (aggression * 0.1) + (round * 0.08));
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
    const relationConcession = (relation - 50) * 8;
    const roundConcession = round * 60;
    const targetScore = Math.max(120, referenceValue * 0.15) - relationConcession - roundConcession;
    const shortfall = Math.max(0, targetScore - deal.score);
    if (shortfall <= 0) return null;

    const targetWealthSafe = Math.max(10000, targetWealth || 10000);
    let rawNeeded = Math.ceil((shortfall / VALUE_SCALE_FACTOR) * targetWealthSafe);
    if (proposal.type === 'open_market') {
        rawNeeded = Math.ceil(rawNeeded * 1.5);
    } else if (proposal.type === 'free_trade') {
        rawNeeded = Math.ceil(rawNeeded * 1.25);
    }

    const next = { ...proposal };
    const durationBase = Math.max(1, Math.floor(Number(proposal.durationDays) || 365));
    const giftBase = Math.max(0, Math.floor(Number(proposal.signingGift) || 0));

    // Reduce what player receives in a counter and ask for more from player
    next.demandSilver = 0;
    next.demandResources = [];

    const baseGiftFloor = clampValue(Math.round(targetWealthSafe * 0.01), 200, 4000);
    const openMarketFloor = proposal.type === 'open_market'
        ? clampValue(Math.round(targetWealthSafe * 0.02), 500, 9000)
        : baseGiftFloor;
    const freeTradeFloor = proposal.type === 'free_trade'
        ? clampValue(Math.round(targetWealthSafe * 0.015), 400, 7000)
        : baseGiftFloor;
    const giftFloor = Math.max(openMarketFloor, freeTradeFloor);
    const compensation = Math.ceil(rawNeeded * (0.9 + Math.random() * 0.2));
    next.signingGift = Math.ceil(Math.max(giftBase + compensation, giftFloor));

    if (proposal.resources && Array.isArray(proposal.resources) && proposal.resources.length > 0) {
        next.resources = proposal.resources.map(res => ({
            ...res,
            amount: Math.ceil(Math.max(1, (res.amount || 0) * (1.1 + Math.random() * 0.2))),
        }));
    }

    if (shortfall > referenceValue * 0.4) {
        next.durationDays = Math.max(180, Math.floor(durationBase * 0.8));
    } else {
        next.durationDays = Math.ceil(durationBase * (1.05 + Math.random() * 0.1));
    }

    return next;
};
