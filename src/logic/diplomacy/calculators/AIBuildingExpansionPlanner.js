import { BUILDINGS, RESOURCES } from '../../../config/index.js';

const CATEGORY_KEYS = ['gather', 'industry', 'civic', 'military'];

const safeNumber = (value, fallback = 0) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : fallback;
};

const clamp = (value, min = 0, max = Infinity) => Math.min(max, Math.max(min, value));

const getMainOutputResource = (building) => {
    let bestKey = null;
    let bestValue = 0;
    Object.entries(building.output || {}).forEach(([key, amount]) => {
        if (key === 'maxPop' || key === 'militaryCapacity') return;
        const numericAmount = safeNumber(amount, 0);
        if (numericAmount > bestValue) {
            bestKey = key;
            bestValue = numericAmount;
        }
    });
    return bestKey;
};

export const planAIBuildingProfile = ({
    nation = {},
    epoch = 0,
    totalBuildings = 0,
    availableBuildings = BUILDINGS,
    currentProfile = {},
    development = {},
}) => {
    const inventory = nation.inventory || {};
    const resourceBias = nation.economyTraits?.resourceBias || {};
    const capacityByCategory = development.capacityByCategory || {};
    const resourceBalance = development.resourceBalance || {};
    const isAtWar = !!nation.isAtWar;
    const aggression = safeNumber(nation.aggression, 0.2);
    const foodSecurity = safeNumber(development.foodSecurity, 1);
    const unemploymentRate = safeNumber(development.unemploymentRate, 0.2);

    const categoryNeed = {
        gather: 1.1 + Math.max(0, 1 - foodSecurity) * 1.6,
        industry: 1.0 + Math.max(0, unemploymentRate - 0.12) * 1.2,
        civic: 0.9 + Math.max(0, safeNumber(capacityByCategory.gather, 0) - safeNumber(capacityByCategory.civic, 0)) / 180,
        military: 0.45 + aggression * 0.55 + (isAtWar ? 0.8 : 0),
    };

    if (safeNumber(resourceBalance.rawMaterialPressure, 0) > 0.15) {
        categoryNeed.gather += 0.45;
    }
    if (safeNumber(resourceBalance.processingPressure, 0) > 0.15) {
        categoryNeed.industry += 0.45;
    }
    if (safeNumber(development.populationPressure, 0) > 0.95) {
        categoryNeed.civic += 0.35;
    }

    const normalizedCategoryNeed = CATEGORY_KEYS.reduce((sum, key) => sum + categoryNeed[key], 0) || 1;
    const categoryQuota = {};
    let allocated = 0;
    for (let i = 0; i < CATEGORY_KEYS.length; i++) {
        const category = CATEGORY_KEYS[i];
        if (i === CATEGORY_KEYS.length - 1) {
            categoryQuota[category] = Math.max(0, totalBuildings - allocated);
            break;
        }
        const quota = Math.max(0, Math.round(totalBuildings * categoryNeed[category] / normalizedCategoryNeed));
        categoryQuota[category] = quota;
        allocated += quota;
    }

    const profile = {};
    CATEGORY_KEYS.forEach(category => {
        const candidates = availableBuildings.filter(building => building.cat === category && (building.epoch || 0) <= epoch);
        const quota = categoryQuota[category] || 0;
        if (quota <= 0 || candidates.length === 0) return;

        const weighted = candidates.map(building => {
            const mainResource = getMainOutputResource(building);
            const mainPrice = mainResource ? safeNumber(RESOURCES[mainResource]?.basePrice, 1) : 1;
            const currentCount = safeNumber(currentProfile[building.id], 0);
            const outputWeight = Object.entries(building.output || {}).reduce((sum, [resourceKey, amount]) => {
                if (resourceKey === 'maxPop' || resourceKey === 'militaryCapacity') return sum;
                return sum + safeNumber(amount, 0) * safeNumber(RESOURCES[resourceKey]?.basePrice, 1);
            }, 0);
            const demandSignal = mainResource
                ? Math.max(
                    0.25,
                    1
                        + (safeNumber(resourceBalance.netByResource?.[mainResource], 0) < 0 ? 0.35 : 0)
                        + (safeNumber(resourceBias[mainResource], 1) - 1) * 0.55
                        - clamp(safeNumber(inventory[mainResource], 0) / 1200, 0, 0.4)
                )
                : 1;
            const duplicatePenalty = 1 / Math.max(1, currentCount * 0.18 + 1);
            const militaryBonus = category === 'military' ? 1 + aggression * 0.4 + (isAtWar ? 0.5 : 0) : 1;
            const civicBonus = category === 'civic'
                ? 1 + Math.max(0, safeNumber(development.populationPressure, 0) - 0.8) * 0.8
                : 1;

            return {
                id: building.id,
                weight: Math.max(0.1, (0.8 + outputWeight / Math.max(1, mainPrice * 2)) * demandSignal * duplicatePenalty * militaryBonus * civicBonus),
            };
        }).sort((a, b) => b.weight - a.weight);

        const totalWeight = weighted.reduce((sum, item) => sum + item.weight, 0) || 1;
        let remaining = quota;
        for (let i = 0; i < weighted.length && remaining > 0; i++) {
            const item = weighted[i];
            const share = i === weighted.length - 1
                ? remaining
                : Math.max(0, Math.round(quota * item.weight / totalWeight));
            const assign = Math.min(remaining, Math.max(1, share));
            profile[item.id] = (profile[item.id] || 0) + assign;
            remaining -= assign;
        }
    });

    return profile;
};
