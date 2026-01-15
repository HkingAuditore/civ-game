import { RESOURCES, TREATY_CONFIGS, TREATY_VALUES } from '../../config';
import { calculateTradeStatus } from '../../utils/foreignTrade';

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

const getResourceGiftValue = (resourceKey, amount) => {
    if (!resourceKey || !Number.isFinite(amount) || amount <= 0) return 0;
    const basePrice = RESOURCES[resourceKey]?.basePrice || 0;
    return Math.max(0, basePrice * amount);
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

export const calculateDealScore = ({
    proposal = {},
    nation = {},
    stance = 'normal',
    daysElapsed = 0,
    playerPower = 0,
    targetPower = 0,
    playerWealth = 0,
    targetWealth = 0,
}) => {
    const type = proposal.type;
    const relation = nation.relation || 0;
    const signingGift = Math.max(0, Math.floor(Number(proposal.signingGift) || 0));
    const resourceKey = proposal.resourceKey || '';
    const resourceAmount = Math.max(0, Math.floor(Number(proposal.resourceAmount) || 0));
    const demandSilver = Math.max(0, Math.floor(Number(proposal.demandSilver) || 0));
    const demandResourceKey = proposal.demandResourceKey || '';
    const demandResourceAmount = Math.max(0, Math.floor(Number(proposal.demandResourceAmount) || 0));
    const maintenancePerDay = Math.max(0, Math.floor(Number(proposal.maintenancePerDay) || 0));
    const durationDays = Math.max(1, Math.floor(Number(proposal.durationDays) || 365));

    // --- Dynamic Treaty Value Scaling ---
    const treatyBase = TREATY_VALUES[type] ?? 500;
    const combinedWealth = Math.max(1000, (playerWealth || 0) + (targetWealth || 0));
    // Logarithmic scale: 1.0 at 1k wealth, ~3.0 at 1M wealth. Ensures costs grow but don't explode linearly.
    // Adjusted: scale = log10(wealth) - 2.  (1000 -> 1, 10000 -> 2, 100000 -> 3)
    const wealthScale = Math.max(1.0, Math.log10(combinedWealth) - 2);
    const treatyValue = Math.floor(treatyBase * wealthScale);

    // --- Offer & Demand Value ---
    const offerResourceValue = getResourceDealValue(resourceKey, resourceAmount, nation, daysElapsed);
    const demandResourceValue = getResourceDealValue(demandResourceKey, demandResourceAmount, nation, daysElapsed);

    // Maintenance value (NPV approximation)
    const maintenanceValue = maintenancePerDay * Math.min(365, durationDays);

    const offerValue = signingGift + offerResourceValue + maintenanceValue;
    const demandValue = demandSilver + demandResourceValue;

    // --- Stance & Strategic Calculation ---
    let stanceScore = 0;
    let politicalCost = 0; // Represents risk/relation penalty if failed
    let strategicValue = 0;

    // Relation Impact
    const relationScore = (relation - 50) * (wealthScale * 10); // Scale relation impact with era/wealth

    if (stance === 'friendly') {
        // Friendly: Reduces threshold by boosting score based on relation
        // Effective only if relations are positive
        if (relation > 20) {
            stanceScore = (relation - 20) * (wealthScale * 5);
        }
        strategicValue += 50; // Good for reputation
    } else if (stance === 'aggressive') {
        // Aggressive: Leverages Power & Wealth Gap
        const powerRatio = targetPower > 0 ? playerPower / targetPower : 2.0;
        const wealthRatio = targetWealth > 0 ? playerWealth / targetWealth : 2.0;

        if (powerRatio > 1.0) stanceScore += (powerRatio - 1.0) * (treatyValue * 0.5); // Up to 50% of treaty value
        if (wealthRatio > 1.0) stanceScore += (wealthRatio - 1.0) * (treatyValue * 0.3); // Up to 30% of treaty value

        politicalCost = 20; // Relation penalty if failed
    } else if (stance === 'threat') {
        // Threat: Extreme Aggressive
        const powerRatio = targetPower > 0 ? playerPower / targetPower : 2.0;
        if (powerRatio > 1.2) {
             stanceScore += (powerRatio - 1.0) * (treatyValue * 1.0); // Up to 100% of treaty value
        } else {
            stanceScore -= treatyValue * 0.5; // Penalty if bluffing without power
        }
        politicalCost = 50; // Severe relation penalty
    }

    // --- Final Score ---
    // Score = (Offer + Relation + Stance) - (Demand + TreatyCost)
    const score = (offerValue + relationScore + stanceScore) - (demandValue + treatyValue);

    return {
        score,
        breakdown: {
            offerValue,
            demandValue,
            treatyValue,
            relationScore,
            stanceScore,
            maintenanceValue,
            strategicValue, // For UI display
            politicalCost,  // For UI display (Risk)
            wealthScale,    // For debug/UI
        },
    };
};

/**
 * 计算谈判接受率（不包含随机）
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
}) => {
    const type = proposal.type;
    const relation = nation.relation || 0;
    const aggression = nation.aggression ?? 0.3;
    const maintenancePerDay = Math.max(0, Math.floor(Number(proposal.maintenancePerDay) || 0));
    const durationDays = Math.max(1, Math.floor(Number(proposal.durationDays) || 365));
    const signingGift = Math.max(0, Math.floor(Number(proposal.signingGift) || 0));
    const resourceKey = proposal.resourceKey || '';
    const resourceAmount = Math.max(0, Math.floor(Number(proposal.resourceAmount) || 0));

    const treatyConfig = TREATY_CONFIGS[type] || {};
    const base = BASE_CHANCE_BY_TYPE[type] ?? 0.25;

    const relationBoost = Math.max(0, (relation - 40) / 100);
    const aggressionPenalty = aggression * 0.25;
    const maintenancePenalty = Math.min(0.25, maintenancePerDay / 500000);

    const baseDuration = treatyConfig.baseDuration || 365;
    const durationBonus = durationDays > baseDuration
        ? Math.min(0.08, ((durationDays - baseDuration) / baseDuration) * 0.06)
        : 0;

    const giftValue = signingGift + getResourceGiftValue(resourceKey, resourceAmount);
    // Adjusted gift bonus scaling
    const giftBonus = Math.min(0.25, giftValue / Math.max(1000, targetWealth * 0.1));

    const deal = calculateDealScore({
        proposal,
        nation,
        stance,
        daysElapsed,
        playerPower,
        targetPower,
        playerWealth,
        targetWealth,
    });

    // Accept Chance Calculation
    // Base + Bonuses + (Score / ReferenceValue)
    // Reference value scales with treaty value to keep chance normalized
    const referenceValue = Math.max(1000, deal.breakdown.treatyValue);
    let acceptChance = 0.5 + (deal.score / referenceValue);

    acceptChance += base - 0.25;
    acceptChance += relationBoost - aggressionPenalty - maintenancePenalty + durationBonus + giftBonus;

    // Type-specific modifiers
    if (type === 'open_market' && relation < 55) acceptChance *= 0.4;
    if (type === 'trade_agreement' && relation < 50) acceptChance *= 0.5;
    if (type === 'free_trade' && relation < 65) acceptChance *= 0.3;
    if (type === 'investment_pact' && relation < 60) acceptChance *= 0.4;
    if (type === 'academic_exchange' && relation < 65) acceptChance *= 0.2;
    if (type === 'defensive_pact' && relation < 70) acceptChance *= 0.2;
    if (type === 'military_alliance' && relation < 75) acceptChance *= 0.1; // Very hard if low relation
    if (type === 'economic_bloc' && relation < 70) acceptChance *= 0.2;

    const minRelation = Number.isFinite(treatyConfig.minRelation) ? treatyConfig.minRelation : null;
    const relationGate = minRelation != null && relation < minRelation;
    if (relationGate) {
        // If below min relation, chance is severely penalized but theoretically possible with immense gifts/power
        acceptChance = Math.min(0.05, acceptChance * 0.1);
    }

    return {
        acceptChance: Math.max(0.0, Math.min(1.0, acceptChance)), // Clamp between 0 and 1
        relationGate,
        minRelation,
        dealScore: deal.score,
        dealBreakdown: deal.breakdown,
    };
};

/**
 * 生成AI反提案
 */
export const generateCounterProposal = ({ proposal = {}, nation = {}, round = 1 }) => {
    const relation = nation.relation || 0;
    const aggression = nation.aggression ?? 0.3;
    const counterChance = Math.min(0.65, 0.25 + (relation / 200) - (aggression * 0.1) + (round * 0.08));
    if (Math.random() > counterChance) return null;

    const next = { ...proposal };
    const durationBase = Math.max(1, Math.floor(Number(proposal.durationDays) || 365));
    const maintenanceBase = Math.max(0, Math.floor(Number(proposal.maintenancePerDay) || 0));
    const giftBase = Math.max(0, Math.floor(Number(proposal.signingGift) || 0));

    // AI demands longer duration for favorable treaties, shorter for unfavorable?
    // Simplified: AI just varies it slightly
    next.durationDays = Math.ceil(durationBase * (1.15 + Math.random() * 0.2));

    if (maintenanceBase > 0) {
        next.maintenancePerDay = Math.ceil(maintenanceBase * (1.2 + Math.random() * 0.3));
    }

    const giftFloor = Math.round(120 + (1 - relation / 100) * 600);
    // AI asks for more money/gifts
    next.signingGift = Math.ceil(Math.max(giftBase * (1.2 + Math.random() * 0.2), giftFloor));

    if (proposal.resourceKey && proposal.resourceAmount) {
        // AI asks for more resources if offered
        next.resourceAmount = Math.ceil(Math.max(1, proposal.resourceAmount * (1.1 + Math.random() * 0.2)));
    }

    // AI logic could be improved to demand silver if not offered, but this suffices for "Counter Proposal" structure
    if (!next.demandSilver && Math.random() < 0.3) {
        next.demandSilver = 100; // Small demand added
    }

    return next;
};
