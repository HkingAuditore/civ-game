import { RESOURCES, TREATY_CONFIGS } from '../../config';

const BASE_CHANCE_BY_TYPE = {
    peace_treaty: 0.45,
    non_aggression: 0.35,
    trade_agreement: 0.32,
    free_trade: 0.26,
    investment_pact: 0.22,
    open_market: 0.30,
    academic_exchange: 0.25,
    defensive_pact: 0.18,
};

const getResourceGiftValue = (resourceKey, amount) => {
    if (!resourceKey || !Number.isFinite(amount) || amount <= 0) return 0;
    const basePrice = RESOURCES[resourceKey]?.basePrice || 0;
    return Math.max(0, basePrice * amount);
};

/**
 * 计算谈判接受率（不包含随机）
 */
export const calculateNegotiationAcceptChance = ({
    proposal = {},
    nation = {},
    epoch = 0,
    stance = 'normal',
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
    const giftBonus = Math.min(0.18, giftValue / 80000);

    const stanceBonus = stance === 'friendly'
        ? 0.03
        : (stance === 'threat' && relation < 40 ? 0.06 : 0);

    let acceptChance = base + relationBoost - aggressionPenalty - maintenancePenalty + durationBonus + giftBonus + stanceBonus;

    if (type === 'open_market' && relation < 55) acceptChance *= 0.4;
    if (type === 'trade_agreement' && relation < 50) acceptChance *= 0.5;
    if (type === 'free_trade' && relation < 65) acceptChance *= 0.3;
    if (type === 'investment_pact' && relation < 60) acceptChance *= 0.4;
    if (type === 'academic_exchange' && relation < 65) acceptChance *= 0.2;
    if (type === 'defensive_pact' && relation < 70) acceptChance *= 0.2;

    const minRelation = Number.isFinite(treatyConfig.minRelation) ? treatyConfig.minRelation : null;
    const relationGate = minRelation != null && relation < minRelation;
    if (relationGate) {
        acceptChance = Math.min(0.08, acceptChance * 0.4);
    }

    return {
        acceptChance: Math.max(0.02, Math.min(0.95, acceptChance)),
        relationGate,
        minRelation,
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

    next.durationDays = Math.ceil(durationBase * (1.15 + Math.random() * 0.2));
    if (maintenanceBase > 0) {
        next.maintenancePerDay = Math.ceil(maintenanceBase * (1.2 + Math.random() * 0.3));
    }

    const giftFloor = Math.round(120 + (1 - relation / 100) * 600);
    next.signingGift = Math.ceil(Math.max(giftBase * (1.2 + Math.random() * 0.2), giftFloor));

    if (proposal.resourceKey && proposal.resourceAmount) {
        next.resourceAmount = Math.ceil(Math.max(1, proposal.resourceAmount * (1.1 + Math.random() * 0.2)));
    }

    return next;
};
