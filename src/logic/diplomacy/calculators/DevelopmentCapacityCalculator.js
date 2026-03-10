import { BUILDINGS, RESOURCES } from '../../../config/index.js';

const CATEGORY_KEYS = ['gather', 'industry', 'civic', 'military'];
const SPECIAL_OUTPUTS = new Set(['maxPop', 'militaryCapacity']);

const safeNumber = (value, fallback = 0) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : fallback;
};

const cloneCategoryBuckets = () => Object.fromEntries(CATEGORY_KEYS.map(key => [key, 0]));

const BUILDING_CAPACITY_INDEX = Object.fromEntries(BUILDINGS.map(building => {
    const jobsByRole = { ...(building.jobs || {}) };
    const outputs = {};
    const inputs = {};

    Object.entries(building.output || {}).forEach(([resourceKey, amount]) => {
        if (SPECIAL_OUTPUTS.has(resourceKey)) return;
        outputs[resourceKey] = safeNumber(amount, 0);
    });

    Object.entries(building.input || {}).forEach(([resourceKey, amount]) => {
        inputs[resourceKey] = safeNumber(amount, 0);
    });

    const outputValue = Object.entries(outputs).reduce((sum, [resourceKey, amount]) => {
        const basePrice = safeNumber(RESOURCES[resourceKey]?.basePrice, 1);
        return sum + amount * basePrice;
    }, 0);
    const inputValue = Object.entries(inputs).reduce((sum, [resourceKey, amount]) => {
        const basePrice = safeNumber(RESOURCES[resourceKey]?.basePrice, 1);
        return sum + amount * basePrice;
    }, 0);
    const totalJobs = Object.values(jobsByRole).reduce((sum, amount) => sum + safeNumber(amount, 0), 0);

    let capacityWeight = Math.max(1, totalJobs * 0.9 + outputValue * 0.35);
    if (building.cat === 'gather') {
        capacityWeight += safeNumber(outputs.food, 0) * 1.8;
    } else if (building.cat === 'civic') {
        capacityWeight += totalJobs * 0.8 + safeNumber(building.output?.maxPop, 0) * 0.2;
    } else if (building.cat === 'military') {
        capacityWeight += safeNumber(building.output?.militaryCapacity, 0) * 0.2 + totalJobs;
    }

    return [building.id, {
        id: building.id,
        cat: CATEGORY_KEYS.includes(building.cat) ? building.cat : 'gather',
        jobsByRole,
        outputs,
        inputs,
        outputValue,
        inputValue,
        totalJobs,
        capacityWeight,
    }];
}));

export const BUILDING_JOB_ROLE_INDEX = Object.fromEntries(
    Object.entries(BUILDING_CAPACITY_INDEX).map(([id, profile]) => [id, profile.jobsByRole])
);

export const calculateDevelopmentCapacity = ({
    nation = {},
    virtualBuildings = nation.virtualBuildings || {},
    foreignBuildings = nation.virtualBuildingsForeign || {},
}) => {
    const jobsByRole = {};
    const jobsByCategory = cloneCategoryBuckets();
    const capacityByCategory = cloneCategoryBuckets();
    const resourceSupply = {};
    const resourceDemand = {};
    const localBuildingCounts = cloneCategoryBuckets();
    const foreignBuildingCounts = cloneCategoryBuckets();

    Object.entries(virtualBuildings || {}).forEach(([buildingId, count]) => {
        const numericCount = Math.max(0, safeNumber(count, 0));
        if (numericCount <= 0) return;

        const profile = BUILDING_CAPACITY_INDEX[buildingId];
        if (!profile) return;

        const foreignCount = Math.max(0, Math.min(numericCount, safeNumber(foreignBuildings[buildingId], 0)));
        const localCount = Math.max(0, numericCount - foreignCount);

        jobsByCategory[profile.cat] += profile.totalJobs * numericCount;
        capacityByCategory[profile.cat] += profile.capacityWeight * numericCount;
        localBuildingCounts[profile.cat] += localCount;
        foreignBuildingCounts[profile.cat] += foreignCount;

        Object.entries(profile.jobsByRole).forEach(([role, amount]) => {
            jobsByRole[role] = (jobsByRole[role] || 0) + safeNumber(amount, 0) * numericCount;
        });

        Object.entries(profile.outputs).forEach(([resourceKey, amount]) => {
            resourceSupply[resourceKey] = (resourceSupply[resourceKey] || 0) + amount * numericCount;
        });

        Object.entries(profile.inputs).forEach(([resourceKey, amount]) => {
            resourceDemand[resourceKey] = (resourceDemand[resourceKey] || 0) + amount * numericCount;
        });
    });

    const totalJobs = Object.values(jobsByRole).reduce((sum, amount) => sum + safeNumber(amount, 0), 0);
    const totalCapacity = Object.values(capacityByCategory).reduce((sum, amount) => sum + safeNumber(amount, 0), 0);
    const totalBuildings = Object.values(localBuildingCounts).reduce((sum, amount) => sum + amount, 0)
        + Object.values(foreignBuildingCounts).reduce((sum, amount) => sum + amount, 0);
    const foreignBuildingTotal = Object.values(foreignBuildingCounts).reduce((sum, amount) => sum + amount, 0);
    const urbanProxy = totalCapacity > 0
        ? Math.max(0, Math.min(1, (capacityByCategory.industry + capacityByCategory.civic) / totalCapacity))
        : 0.25;

    return {
        jobsByRole,
        jobsByCategory,
        capacityByCategory,
        resourceSupply,
        resourceDemand,
        totalJobs,
        totalCapacity,
        totalBuildings,
        foreignShare: totalBuildings > 0 ? foreignBuildingTotal / totalBuildings : 0,
        foodSupply: safeNumber(resourceSupply.food, 0),
        civicSupport: capacityByCategory.civic,
        militarySupport: capacityByCategory.military,
        urbanProxy: Number(urbanProxy.toFixed(3)),
        localBuildingCounts,
        foreignBuildingCounts,
    };
};
