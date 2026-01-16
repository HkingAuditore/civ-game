import { DIPLOMACY_ERA_UNLOCK, TREATY_TYPE_LABELS, getTreatyDuration as getDuration } from '../config/diplomacy';

export const getTreatyLabel = (type) => TREATY_TYPE_LABELS[type] || type;

export const getTreatyUnlockEraName = (type) => {
    // Check both treaties and organizations since military_alliance/economic_bloc are in organizations
    const config = DIPLOMACY_ERA_UNLOCK.treaties[type] || DIPLOMACY_ERA_UNLOCK.organizations[type];
    if (!config) return '未知时代';
    // Assuming era names or just returning "Era X"
    return `Era ${config.minEra}`;
};

export const getTreatyDuration = getDuration;

export const getRelationLabel = (value) => {
    if (value >= 80) return '亲密';
    if (value >= 50) return '友好';
    if (value >= 10) return '中立';
    if (value >= -10) return '冷淡';
    if (value >= -50) return '敌对';
    return '仇恨';
};
