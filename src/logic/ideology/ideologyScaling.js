import { EPOCHS } from '../../config/epochs.js';

const METRIC_HISTORY_LIMIT = 90;
const RECENT_AVERAGE_WINDOW = 30;

const POPULATION_BANDS = [
    { threshold: 250, multiplier: 1.00 },
    { threshold: 600, multiplier: 1.06 },
    { threshold: 1200, multiplier: 1.12 },
    { threshold: 2200, multiplier: 1.20 },
    { threshold: 4000, multiplier: 1.28 },
    { threshold: Infinity, multiplier: 1.36 },
];

const BUILDING_BANDS = [
    { threshold: 30, multiplier: 1.00 },
    { threshold: 80, multiplier: 1.05 },
    { threshold: 160, multiplier: 1.10 },
    { threshold: 280, multiplier: 1.16 },
    { threshold: 450, multiplier: 1.24 },
    { threshold: Infinity, multiplier: 1.32 },
];

const MILITARY_BANDS = [
    { threshold: 30, multiplier: 1.00 },
    { threshold: 100, multiplier: 1.04 },
    { threshold: 220, multiplier: 1.08 },
    { threshold: 420, multiplier: 1.14 },
    { threshold: 700, multiplier: 1.20 },
    { threshold: Infinity, multiplier: 1.26 },
];

const VASSAL_BANDS = [
    { threshold: 0, multiplier: 1.00 },
    { threshold: 2, multiplier: 1.03 },
    { threshold: 4, multiplier: 1.08 },
    { threshold: 7, multiplier: 1.14 },
    { threshold: Infinity, multiplier: 1.20 },
];

const EARLY_EPOCH_MAX = 2;

function safeNumber(value, fallback = 0) {
    return Number.isFinite(value) ? value : fallback;
}

function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

function appendHistory(series = [], value = 0) {
    const next = [...(Array.isArray(series) ? series : []), safeNumber(value, 0)];
    if (next.length > METRIC_HISTORY_LIMIT) {
        next.shift();
    }
    return next;
}

function averageRecent(series = [], size = RECENT_AVERAGE_WINDOW) {
    if (!Array.isArray(series) || series.length === 0) return 0;
    const recent = series.slice(-size);
    if (recent.length === 0) return 0;
    return recent.reduce((sum, value) => sum + safeNumber(value, 0), 0) / recent.length;
}

function resolveBandMultiplier(value, bands) {
    const normalized = Math.max(0, safeNumber(value, 0));
    for (const band of bands) {
        if (normalized <= band.threshold) {
            return band.multiplier;
        }
    }
    return 1;
}

function getEpochBaseline(epoch = 0) {
    const normalizedEpoch = clamp(Math.floor(safeNumber(epoch, 0)), 0, Math.max(0, EPOCHS.length - 1));
    const epochConfig = EPOCHS[normalizedEpoch] || {};
    const req = epochConfig.req || {};
    const cost = epochConfig.cost || {};

    const populationReq = Math.max(30, safeNumber(req.population, 40 + normalizedEpoch * 120));
    const scienceReq = Math.max(600, safeNumber(req.science, 600 + normalizedEpoch * 5000));
    const cultureReq = Math.max(250, safeNumber(req.culture, 250 + normalizedEpoch * 1200));
    const silverCost = Math.max(1000, safeNumber(cost.silver, scienceReq * 2));

    return {
        silverReward: Math.max(50, silverCost * 0.015, populationReq * 5),
        scienceReward: Math.max(15, scienceReq * 0.02, populationReq * 0.8),
        cultureReward: Math.max(20, cultureReq * 0.05, populationReq * 1.6),
        silverThreshold: Math.max(1500, silverCost * 0.25, populationReq * 45),
        scienceThreshold: Math.max(300, scienceReq * 0.65),
        cultureThreshold: Math.max(300, cultureReq * 0.90, populationReq * 6),
        flatPop: Math.max(12, populationReq * 0.10),
        treasuryMilestone: Math.max(5000, silverCost * 0.20, populationReq * 60),
        populationMilestone: Math.max(100, populationReq * 0.25),
    };
}

function getRewardRatio(amount = 0) {
    const normalized = Math.max(0, safeNumber(amount, 0));
    if (normalized <= 20) return 0.08;
    if (normalized <= 60) return 0.10;
    if (normalized <= 120) return 0.12;
    return 0.15;
}

function getDrainRatio(amount = 0) {
    const normalized = Math.max(0, safeNumber(amount, 0));
    if (normalized <= 3) return 0.03;
    if (normalized <= 6) return 0.04;
    if (normalized <= 10) return 0.06;
    return 0.08;
}

function getThresholdMultiplier(threshold = 0) {
    const normalized = Math.max(0, safeNumber(threshold, 0));
    if (normalized <= 300) return 4;
    if (normalized <= 1000) return 6;
    return 8;
}

function getResourceBaselineKey(resource, suffix) {
    switch (resource) {
        case 'science':
            return `science${suffix}`;
        case 'culture':
            return `culture${suffix}`;
        case 'silver':
        default:
            return `silver${suffix}`;
    }
}

function getRecentReference(resource, recentAverages = {}) {
    switch (resource) {
        case 'science':
            return Math.max(0, safeNumber(recentAverages.science, 0));
        case 'culture':
            return Math.max(0, safeNumber(recentAverages.culture, 0));
        case 'silver':
        default:
            return Math.max(
                0,
                safeNumber(recentAverages.tax, 0) + safeNumber(recentAverages.trade, 0)
            );
    }
}

export function createEmptyIdeologyMetrics() {
    return {
        history: {
            tax: [],
            trade: [],
            science: [],
            culture: [],
        },
        recent30dAvg: {
            tax: 0,
            trade: 0,
            science: 0,
            culture: 0,
        },
    };
}

export function updateIdeologyMetrics(previousMetrics = createEmptyIdeologyMetrics(), dailySnapshot = {}) {
    const prevHistory = previousMetrics?.history || {};
    const nextHistory = {
        tax: appendHistory(prevHistory.tax, dailySnapshot.tax),
        trade: appendHistory(prevHistory.trade, dailySnapshot.trade),
        science: appendHistory(prevHistory.science, dailySnapshot.science),
        culture: appendHistory(prevHistory.culture, dailySnapshot.culture),
    };

    return {
        history: nextHistory,
        recent30dAvg: {
            tax: averageRecent(nextHistory.tax),
            trade: averageRecent(nextHistory.trade),
            science: averageRecent(nextHistory.science),
            culture: averageRecent(nextHistory.culture),
        },
    };
}

export function buildIdeologyScalingContext({
    epoch = 0,
    ideologyMetrics = null,
    population = 0,
    totalBuildings = 0,
    militarySize = 0,
    vassalCount = 0,
} = {}) {
    const recentAverages = ideologyMetrics?.recent30dAvg || createEmptyIdeologyMetrics().recent30dAvg;
    const bands = {
        population: resolveBandMultiplier(population, POPULATION_BANDS),
        buildings: resolveBandMultiplier(totalBuildings, BUILDING_BANDS),
        military: resolveBandMultiplier(militarySize, MILITARY_BANDS),
        vassals: resolveBandMultiplier(vassalCount, VASSAL_BANDS),
    };

    const compositeScale = 1 + (
        ((bands.population - 1) * 0.35)
        + ((bands.buildings - 1) * 0.25)
        + ((bands.military - 1) * 0.20)
        + ((bands.vassals - 1) * 0.20)
    );

    return {
        epoch: safeNumber(epoch, 0),
        earlyGame: safeNumber(epoch, 0) <= EARLY_EPOCH_MAX,
        recentAverages,
        bands,
        compositeScale: clamp(compositeScale, 1, 1.40),
        epochBaseline: getEpochBaseline(epoch),
        population: Math.max(0, safeNumber(population, 0)),
        totalBuildings: Math.max(0, safeNumber(totalBuildings, 0)),
        militarySize: Math.max(0, safeNumber(militarySize, 0)),
        vassalCount: Math.max(0, safeNumber(vassalCount, 0)),
    };
}

export function scaleLegacyResourceAmount({
    amount = 0,
    resource = 'silver',
    context = null,
    mode = 'reward',
} = {}) {
    const normalizedAmount = safeNumber(amount, 0);
    if (!context || context.earlyGame || normalizedAmount <= 0) {
        return normalizedAmount;
    }

    const ratio = mode === 'drain' ? getDrainRatio(normalizedAmount) : getRewardRatio(normalizedAmount);
    const baselineKey = getResourceBaselineKey(resource, mode === 'drain' ? 'Reward' : 'Reward');
    const recentReference = getRecentReference(resource, context.recentAverages);
    const baselineReference = safeNumber(context.epochBaseline?.[baselineKey], normalizedAmount);
    const scaledReference = Math.max(recentReference, baselineReference);
    const scaledAmount = scaledReference * ratio * context.compositeScale;

    return Math.max(normalizedAmount, Math.round(scaledAmount));
}

export function scaleLegacyResourceThreshold({
    threshold = 0,
    resource = 'silver',
    context = null,
} = {}) {
    const normalizedThreshold = safeNumber(threshold, 0);
    if (!context || context.earlyGame || normalizedThreshold <= 0) {
        return normalizedThreshold;
    }

    const baselineKey = getResourceBaselineKey(resource, 'Threshold');
    const recentReference = getRecentReference(resource, context.recentAverages);
    const baselineReference = safeNumber(context.epochBaseline?.[baselineKey], normalizedThreshold);
    const scaledThreshold = Math.max(
        recentReference * getThresholdMultiplier(normalizedThreshold),
        baselineReference * context.compositeScale
    );

    return Math.max(normalizedThreshold, Math.round(scaledThreshold));
}

export function scaleLegacyFlatPopulation(amount = 0, context = null) {
    const normalizedAmount = safeNumber(amount, 0);
    if (!context || context.earlyGame || normalizedAmount <= 0) {
        return normalizedAmount;
    }

    const ratio = getRewardRatio(normalizedAmount);
    const reference = Math.max(
        safeNumber(context.population, 0),
        safeNumber(context.epochBaseline?.flatPop, normalizedAmount) * 8
    );

    return Math.max(normalizedAmount, Math.round(reference * ratio * context.bands.population));
}

export function scaleLegacyMilestoneThreshold({
    threshold = 0,
    type = 'treasury',
    context = null,
} = {}) {
    const normalizedThreshold = safeNumber(threshold, 0);
    if (!context || context.earlyGame || normalizedThreshold <= 0) {
        return normalizedThreshold;
    }

    if (type === 'population') {
        const scaledPopulationMilestone = Math.max(
            safeNumber(context.epochBaseline?.populationMilestone, normalizedThreshold) * context.bands.population,
            safeNumber(context.population, 0) * 0.08
        );
        return Math.max(normalizedThreshold, Math.round(scaledPopulationMilestone));
    }

    const recentSilverFlow = getRecentReference('silver', context.recentAverages);
    const scaledTreasuryMilestone = Math.max(
        recentSilverFlow * 10,
        safeNumber(context.epochBaseline?.treasuryMilestone, normalizedThreshold) * context.compositeScale
    );
    return Math.max(normalizedThreshold, Math.round(scaledTreasuryMilestone));
}

