import { BUILDINGS, RESOURCES } from '../../config';

export const MINISTER_ROLES = [
    'agriculture',
    'industry',
    'commerce',
    'civic',
    'military',
    'diplomacy',
];

export const ECONOMIC_MINISTER_ROLES = [
    'agriculture',
    'industry',
    'commerce',
    'civic',
];

export const MINISTER_LABELS = {
    agriculture: '农业大臣',
    industry: '工业大臣',
    commerce: '商业大臣',
    civic: '市政大臣',
    military: '军事大臣',
    diplomacy: '外交大臣',
};

export const MINISTER_BONUS_CONFIG = {
    agriculture: { statKey: 'administrative', productionMax: 0.12 },
    industry: { statKey: 'administrative', productionMax: 0.12 },
    commerce: { statKey: 'diplomacy', productionMax: 0.10, tradeBonusMax: 0.06 },
    civic: { statKey: 'administrative', productionMax: 0.10 },
    military: { statKey: 'military', militaryBonusMax: 0.15, trainingSpeedMax: 0.15 },
    diplomacy: { statKey: 'diplomacy', diplomaticBonusMax: 2.0 },
};

const COMMERCE_BUILDING_IDS = new Set([
    'trading_post',
    'market',
    'trade_port',
    'stock_exchange',
    'rail_depot',
    'dockyard',
]);

const NON_ECONOMIC_OUTPUTS = new Set(['maxPop', 'militaryCapacity']);

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const getStatRatio = (value) => {
    if (!Number.isFinite(value)) return 0;
    return clamp(value / 100, 0, 1);
};

export const getMinisterStatValue = (official, role) => {
    const statKey = MINISTER_BONUS_CONFIG[role]?.statKey;
    if (!statKey) return 0;
    return official?.stats?.[statKey] ?? official?.[statKey] ?? 0;
};

export const getMinisterProductionBonus = (role, statValue) => {
    const ratio = getStatRatio(statValue);
    const max = MINISTER_BONUS_CONFIG[role]?.productionMax || 0;
    return ratio * max;
};

export const getMinisterTradeBonus = (statValue) => {
    const ratio = getStatRatio(statValue);
    return ratio * (MINISTER_BONUS_CONFIG.commerce.tradeBonusMax || 0);
};

export const getMinisterMilitaryBonus = (statValue) => {
    const ratio = getStatRatio(statValue);
    return ratio * (MINISTER_BONUS_CONFIG.military.militaryBonusMax || 0);
};

export const getMinisterTrainingSpeedBonus = (statValue) => {
    const ratio = getStatRatio(statValue);
    return ratio * (MINISTER_BONUS_CONFIG.military.trainingSpeedMax || 0);
};

export const getMinisterDiplomaticBonus = (statValue) => {
    const ratio = getStatRatio(statValue);
    return ratio * (MINISTER_BONUS_CONFIG.diplomacy.diplomaticBonusMax || 0);
};

export const isCommerceBuilding = (building) => COMMERCE_BUILDING_IDS.has(building?.id);

const isIndustryResource = (resourceKey) => {
    if (!resourceKey || resourceKey === 'food') return false;
    const def = RESOURCES[resourceKey];
    if (!def) return false;
    const tags = def.tags || [];
    return tags.includes('raw_material') || tags.includes('industrial') || tags.includes('manufactured');
};

export const getBuildingOutputResources = (building) => {
    if (!building?.output) return [];
    return Object.keys(building.output)
        .filter((key) => RESOURCES[key])
        .filter((key) => key !== 'silver')
        .filter((key) => !NON_ECONOMIC_OUTPUTS.has(key))
        .filter((key) => RESOURCES[key]?.type !== 'virtual' && RESOURCES[key]?.type !== 'currency');
};

export const isBuildingUnlockedForMinister = (building, epoch, techsUnlocked = []) => {
    if (!building) return false;
    if (Number.isFinite(building.epoch) && building.epoch > epoch) return false;
    if (building.requiresTech && !techsUnlocked.includes(building.requiresTech)) return false;
    return true;
};

export const isBuildingInMinisterScope = (building, role) => {
    if (!building) return false;
    if (role === 'commerce') return isCommerceBuilding(building);

    const outputs = getBuildingOutputResources(building);
    if (role === 'agriculture') {
        return outputs.includes('food') && !isCommerceBuilding(building);
    }
    if (role === 'industry') {
        return building.cat === 'industry' || outputs.some((res) => isIndustryResource(res));
    }
    if (role === 'civic') {
        return building.cat === 'civic' && !isCommerceBuilding(building);
    }
    return false;
};

export const scoreBuildingShortage = (building, supplyDemandRatio = {}) => {
    const outputs = getBuildingOutputResources(building);
    let score = 0;
    outputs.forEach((resourceKey) => {
        const ratio = supplyDemandRatio[resourceKey];
        if (!Number.isFinite(ratio)) return;
        const shortage = Math.max(0, 1 - ratio);
        if (shortage <= 0) return;
        const outputAmount = building.output?.[resourceKey] ?? 0;
        score += shortage * Math.max(0, outputAmount);
    });
    return score;
};

export const buildMinisterRoster = (officials = []) => {
    const roster = new Map();
    officials.forEach((official) => {
        if (!official?.id) return;
        roster.set(official.id, official);
    });
    return roster;
};

export const getMinisterCandidates = ({
    role,
    epoch = 0,
    techsUnlocked = [],
    staffingRatios = {},
}) => {
    const candidates = [];
    BUILDINGS.forEach((building) => {
        if (!isBuildingUnlockedForMinister(building, epoch, techsUnlocked)) return;
        if (!isBuildingInMinisterScope(building, role)) return;
        const staffingRatio = staffingRatios?.[building.id];
        const safeRatio = Number.isFinite(staffingRatio) ? staffingRatio : 1;
        candidates.push({
            building,
            staffingRatio: safeRatio,
        });
    });
    return candidates;
};
