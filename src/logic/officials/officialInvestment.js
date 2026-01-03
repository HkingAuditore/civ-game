import { BUILDINGS } from '../../config/buildings';
import { POLITICAL_STANCES } from '../../config/politicalStances';
import { getBuildingEffectiveConfig, getMaxUpgradeLevel, getUpgradeCost } from '../../config/buildingUpgrades';
import { getBuildingCostGrowthFactor } from '../../config/difficulty';
import { calculateBuildingCost, getUpgradeCountAtOrAboveLevel } from '../../utils/buildingUpgradeUtils';
import { calculateBuildingProfit } from './cabinetSynergy';

export const INVESTMENT_COOLDOWN = 90;
export const UPGRADE_COOLDOWN = 60;
export const MIN_WEALTH_TO_INVEST = 500;
export const MAX_INVEST_RATIO = 0.4;

export const FINANCIAL_STATUS = {
    satisfied: {
        effectMult: 1.0,
        corruption: 0,
        description: null,
    },
    uncomfortable: {
        effectMult: 0.9,
        corruption: 0.01,
        description: '生活拮据',
    },
    struggling: {
        effectMult: 0.7,
        corruption: 0.03,
        description: '入不敷出',
    },
    desperate: {
        effectMult: 0.3,
        corruption: 0.1,
        description: '濒临破产',
    },
};

const STRATUM_INVESTMENT_PREFS = {
    landowner: { cats: ['gather'], risk: 0.4 },
    merchant: { cats: ['civic', 'industry'], risk: 0.7 },
    capitalist: { cats: ['industry', 'gather'], risk: 0.8 },
    scribe: { cats: ['civic'], risk: 0.3 },
    cleric: { cats: ['civic'], risk: 0.3 },
    peasant: { cats: ['gather'], risk: 0.4 },
    worker: { cats: ['industry'], risk: 0.5 },
    artisan: { cats: ['industry'], risk: 0.5 },
    engineer: { cats: ['industry'], risk: 0.6 },
    navigator: { cats: ['civic', 'gather'], risk: 0.6 },
};

const getMarketPrice = (market, resource) => {
    if (!resource || resource === 'silver') return 1;
    return market?.prices?.[resource] ?? 1;
};

export const generateInvestmentProfile = (sourceStratum, politicalStance, currentDay) => {
    const base = STRATUM_INVESTMENT_PREFS[sourceStratum] || { cats: ['gather'], risk: 0.5 };
    const stanceSpectrum = POLITICAL_STANCES[politicalStance]?.spectrum;

    let cats = [...base.cats];
    if (stanceSpectrum === 'left') {
        cats = cats.filter(c => c !== 'industry');
        if (!cats.includes('gather')) cats.push('gather');
    } else if (stanceSpectrum === 'right') {
        if (!cats.includes('industry')) cats.push('industry');
    }

    return {
        preferredCategories: cats,
        riskTolerance: base.risk * (0.8 + Math.random() * 0.4),
        investmentThreshold: 0.2 + Math.random() * 0.3,
        lastInvestmentDay: currentDay - Math.floor(INVESTMENT_COOLDOWN / 2),
        lastUpgradeDay: currentDay - Math.floor(UPGRADE_COOLDOWN / 2),
    };
};

export const calculateFinancialStatus = (official, dailyExpense, incomeOverride = null) => {
    const expense = Math.max(1, dailyExpense || 0);
    const thresholds = {
        desperate: expense * 10,
        struggling: expense * 30,
        uncomfortable: expense * 60,
    };
    const income = Number.isFinite(incomeOverride) ? incomeOverride : (official.salary || 0);
    const incomeRatio = income / expense;

    if ((official.wealth || 0) < thresholds.desperate) {
        return 'desperate';
    }
    if (incomeRatio < 0.8) {
        return 'struggling';
    }
    if ((official.wealth || 0) < thresholds.uncomfortable) {
        return 'uncomfortable';
    }
    return 'satisfied';
};

const calculateCostInSilver = (cost, market) => {
    return Object.entries(cost || {}).reduce((sum, [resource, amount]) => {
        if (resource === 'silver') return sum + amount;
        return sum + (getMarketPrice(market, resource) * amount);
    }, 0);
};

export const getBuildingWorkingRatio = (buildingId, jobFill = {}, buildingCounts = {}) => {
    const building = BUILDINGS.find(b => b.id === buildingId);
    if (!building?.jobs) return 1.0;

    let totalJobs = 0;
    let filledJobs = 0;
    const count = buildingCounts?.[buildingId] || 0;
    const effectiveCount = Math.max(1, count);

    Object.entries(building.jobs).forEach(([jobType, jobCount]) => {
        const totalForType = effectiveCount * jobCount;
        const fillRate = jobFill[jobType] || 0;
        totalJobs += totalForType;
        filledJobs += totalForType * Math.min(1, fillRate);
    });

    return totalJobs > 0 ? filledJobs / totalJobs : 1.0;
};

export const calculateOfficialPropertyProfit = (prop, market, taxPolicies, staffingRatios, buildingCounts, jobFill) => {
    const building = BUILDINGS.find(b => b.id === prop.buildingId);
    if (!building) return 0;

    const level = prop.level || 0;
    const effectiveConfig = getBuildingEffectiveConfig(building, level);
    const mergedConfig = {
        ...building,
        ...effectiveConfig,
        id: building.id,
        owner: effectiveConfig.owner || building.owner,
    };

    const theoreticalProfit = calculateBuildingProfit(mergedConfig, market, taxPolicies).profit;
    const ratioFromStaffing = staffingRatios?.[prop.buildingId];
    const workingRatio = Number.isFinite(ratioFromStaffing)
        ? ratioFromStaffing
        : getBuildingWorkingRatio(prop.buildingId, jobFill, buildingCounts);
    return theoreticalProfit * workingRatio;
};

const calculateUpgradeProfitGain = (building, fromLevel, toLevel, market, taxPolicies) => {
    const currentConfig = getBuildingEffectiveConfig(building, fromLevel);
    const nextConfig = getBuildingEffectiveConfig(building, toLevel);

    const currentProfit = calculateBuildingProfit({ ...building, ...currentConfig }, market, taxPolicies).profit;
    const nextProfit = calculateBuildingProfit({ ...building, ...nextConfig }, market, taxPolicies).profit;

    return nextProfit - currentProfit;
};

export const processOfficialInvestment = (
    official,
    currentDay,
    market,
    taxPolicies,
    cabinetStatus,
    buildingCounts,
    difficultyLevel,
    epoch = 0,
    techsUnlocked = []
) => {
    if (!official?.investmentProfile) return null;

    const profile = official.investmentProfile;
    if (currentDay - profile.lastInvestmentDay < INVESTMENT_COOLDOWN) return null;
    if (official.wealth < MIN_WEALTH_TO_INVEST) return null;

    const factionMod = cabinetStatus?.dominance?.faction === 'left' ? 0.5 : 1.0;
    const wealthRatio = Math.max(1, (official.wealth || 0) / 400);
    const wealthDrive = Math.min(2.2, 1 + Math.log10(wealthRatio) * 0.6);
    const investChance = profile.riskTolerance * factionMod * wealthDrive;
    if (Math.random() > investChance) return null;

    const budget = official.wealth * MAX_INVEST_RATIO * profile.riskTolerance * wealthDrive;
    if (budget <= 0) return null;

    const growthFactor = getBuildingCostGrowthFactor(difficultyLevel) || 1.15;

    const candidates = BUILDINGS
        .filter(b => {
            // 必须有所有者和基础成本
            if (!b.owner || !b.baseCost) return false;
            // 检查时代解锁
            const epochUnlocked = (b.epoch ?? 0) <= epoch;
            if (!epochUnlocked) return false;
            // 检查科技解锁
            const techUnlocked = !b.requiresTech || techsUnlocked.includes(b.requiresTech);
            if (!techUnlocked) return false;
            return true;
        })
        .map(b => {
            const currentCount = buildingCounts?.[b.id] || 0;
            const scaledCost = calculateBuildingCost(b.baseCost, currentCount, growthFactor);
            const cost = calculateCostInSilver(scaledCost, market);
            const profit = calculateBuildingProfit(b, market, taxPolicies).profit;
            const preferenceWeight = profile.preferredCategories.includes(b.cat) ? 2.0 : 1.0;
            return {
                building: b,
                cost,
                profit,
                weight: Math.max(0.01, profit * preferenceWeight),
            };
        })
        .filter(c => c.cost <= budget && c.profit > 0)
        .sort((a, b) => b.weight - a.weight);

    if (candidates.length === 0) return null;

    const totalWeight = candidates.reduce((sum, c) => sum + c.weight, 0);
    let pick = Math.random() * totalWeight;
    for (const c of candidates) {
        pick -= c.weight;
        if (pick <= 0) {
            return {
                buildingId: c.building.id,
                cost: c.cost,
                profit: c.profit,
            };
        }
    }

    return null;
};

export const processOfficialBuildingUpgrade = (
    official,
    currentDay,
    market,
    taxPolicies,
    cabinetStatus,
    buildingCounts,
    buildingUpgrades,
    difficultyLevel
) => {
    if (!official.ownedProperties?.length) return null;
    const lastUpgradeDay = official.investmentProfile?.lastUpgradeDay || 0;
    if (currentDay - lastUpgradeDay < UPGRADE_COOLDOWN) return null;
    if (official.wealth < 200) return null;

    const factionMod = cabinetStatus?.dominance?.faction === 'left' ? 0.7 : 1.0;
    if (Math.random() > (official.investmentProfile?.riskTolerance || 0.5) * factionMod) return null;

    const growthFactor = getBuildingCostGrowthFactor(difficultyLevel) || 1.15;
    const candidates = [];

    official.ownedProperties.forEach((prop, index) => {
        const building = BUILDINGS.find(b => b.id === prop.buildingId);
        if (!building) return;

        const maxLevel = getMaxUpgradeLevel(building.id);
        const currentLevel = prop.level || 0;
        const nextLevel = currentLevel + 1;
        if (nextLevel > maxLevel) return;

        const totalCount = buildingCounts?.[building.id] || 0;
        const levelCounts = buildingUpgrades?.[building.id] || {};
        const existingUpgradeCount = getUpgradeCountAtOrAboveLevel(nextLevel, totalCount, levelCounts);
        const upgradeCost = getUpgradeCost(building.id, nextLevel, existingUpgradeCount, growthFactor);
        if (!upgradeCost) return;

        const cost = calculateCostInSilver(upgradeCost, market);
        if (cost > official.wealth * 0.5) return;

        const profitGain = calculateUpgradeProfitGain(building, currentLevel, nextLevel, market, taxPolicies);
        if (profitGain <= 0) return;

        candidates.push({
            propertyIndex: index,
            buildingId: building.id,
            fromLevel: currentLevel,
            toLevel: nextLevel,
            cost,
            profitGain,
            roi: profitGain / cost,
        });
    });

    if (!candidates.length) return null;
    candidates.sort((a, b) => b.roi - a.roi);
    return candidates[0];
};
