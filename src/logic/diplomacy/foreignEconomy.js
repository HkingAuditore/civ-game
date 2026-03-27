import { BUILDINGS, RESOURCES } from '../../config/index.js';
import { BUILDING_JOB_ROLE_INDEX, calculateDevelopmentCapacity } from './calculators/DevelopmentCapacityCalculator.js';

const LABOR_CLASSES = ['agrarian', 'worker', 'elite', 'soldier'];
const CATEGORY_KEYS = ['gather', 'industry', 'civic', 'military'];
const SPECIAL_OUTPUTS = new Set(['maxPop', 'militaryCapacity']);

const STRATUM_CLASS_MAP = {
    serf: 'agrarian',
    peasant: 'agrarian',
    lumberjack: 'agrarian',
    miner: 'agrarian',
    worker: 'worker',
    artisan: 'worker',
    clerk: 'worker',
    merchant: 'elite',
    scholar: 'elite',
    aristocrat: 'elite',
    capitalist: 'elite',
    official: 'elite',
    soldier: 'soldier',
};

const clamp = (value, min = 0, max = Infinity) => Math.min(max, Math.max(min, value));
const safeNumber = (value, fallback = 0) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : fallback;
};

const cloneClassBuckets = () => Object.fromEntries(LABOR_CLASSES.map(key => [key, 0]));
const cloneCategoryBuckets = () => Object.fromEntries(CATEGORY_KEYS.map(key => [key, 0]));

const BUILDING_INDEX = Object.fromEntries(BUILDINGS.map(building => {
    const category = CATEGORY_KEYS.includes(building.cat) ? building.cat : 'gather';
    const jobsByClass = cloneClassBuckets();
    Object.entries(building.jobs || {}).forEach(([role, count]) => {
        const laborClass = STRATUM_CLASS_MAP[role];
        if (!laborClass) return;
        jobsByClass[laborClass] += safeNumber(count, 0);
    });

    const outputs = {};
    Object.entries(building.output || {}).forEach(([resourceKey, amount]) => {
        if (SPECIAL_OUTPUTS.has(resourceKey)) return;
        outputs[resourceKey] = safeNumber(amount, 0);
    });

    const inputs = {};
    Object.entries(building.input || {}).forEach(([resourceKey, amount]) => {
        inputs[resourceKey] = safeNumber(amount, 0);
    });

    return [building.id, {
        id: building.id,
        category,
        jobsByClass,
        outputs,
        inputs,
    }];
}));

export const BUILDING_JOB_CLASS_INDEX = Object.fromEntries(
    Object.entries(BUILDING_INDEX).map(([id, config]) => [id, config.jobsByClass])
);
export const BUILDING_OUTPUT_INDEX = Object.fromEntries(
    Object.entries(BUILDING_INDEX).map(([id, config]) => [id, config.outputs])
);
export const BUILDING_INPUT_INDEX = Object.fromEntries(
    Object.entries(BUILDING_INDEX).map(([id, config]) => [id, config.inputs])
);
export const BUILDING_CATEGORY_INDEX = Object.fromEntries(
    Object.entries(BUILDING_INDEX).map(([id, config]) => [id, config.category])
);
export const BUILDING_MAIN_RESOURCE_INDEX = Object.fromEntries(
    Object.entries(BUILDING_INDEX).map(([id, config]) => {
        const mainResource = Object.entries(config.outputs)
            .sort((a, b) => safeNumber(b[1], 0) - safeNumber(a[1], 0))[0]?.[0] || null;
        return [id, mainResource];
    })
);
export const BUILDING_BASE_COST_INDEX = Object.fromEntries(
    BUILDINGS.map(building => [building.id, building.baseCost || {}])
);

const getNationResourcePrice = (nation = {}, resourceKey) => {
    return safeNumber(
        nation.nationPrices?.[resourceKey] ?? nation.market?.prices?.[resourceKey],
        RESOURCES[resourceKey]?.basePrice || 1
    );
};

const estimateBuildingCapitalCost = (nation = {}, buildingId, count = 0) => {
    const numericCount = Math.max(0, safeNumber(count, 0));
    if (numericCount <= 0) return 0;

    const baseCost = BUILDING_BASE_COST_INDEX[buildingId] || {};
    const inputCount = Object.keys(BUILDING_INPUT_INDEX[buildingId] || {}).length;
    const outputCount = Object.keys(BUILDING_OUTPUT_INDEX[buildingId] || {}).length;
    const efficiencyWeight = clamp(0.72 + outputCount * 0.06 - inputCount * 0.04, 0.48, 1.05);

    const perBuildingValue = Object.entries(baseCost).reduce((sum, [resourceKey, amount]) => {
        return sum + safeNumber(amount, 0) * getNationResourcePrice(nation, resourceKey);
    }, 0);

    if (perBuildingValue <= 0) return numericCount * 18;
    return perBuildingValue * numericCount * efficiencyWeight;
};

export const ensureForeignEconomyState = (nation = {}) => {
    const currentDirty = nation.economyDirtyFlags || {};
    return {
        aiDevelopment: {
            population: safeNumber(nation.population, 0),
            laborPool: 0,
            employment: 0,
            unemployment: 0,
            unemploymentRate: 0,
            jobsByRole: {},
            jobsByCategory: cloneCategoryBuckets(),
            capacityByCategory: cloneCategoryBuckets(),
            resourceBalance: {
                supplyByResource: {},
                demandByResource: {},
                netByResource: {},
                foodBalance: 0,
                rawMaterialPressure: 0,
                processingPressure: 0,
            },
            wealthGeneration: {
                grossOutput: 0,
                localValueAdded: 0,
                maintenanceCost: 0,
                tradeIncome: 0,
                warLoss: 0,
                netWealthChange: 0,
            },
            investmentPressure: 0,
            urbanProxy: 0.25,
            warRecovery: 1,
            carryingCapacity: 0,
            foodSecurity: 1,
            populationPressure: 0,
            employmentRate: 0,
            lastUpdateTick: 0,
            ...(nation.aiDevelopment || {}),
        },
        virtualLabor: {
            laborForce: 0,
            employment: 0,
            unemployment: 0,
            employmentRate: 0,
            workforceByClass: cloneClassBuckets(),
            jobsByClass: cloneClassBuckets(),
            wagePressure: 1,
            lastLaborTick: 0,
            ...(nation.virtualLabor || {}),
        },
        virtualEconomy: {
            buildingDemandByResource: {},
            buildingSupplyByResource: {},
            outputByCategory: cloneCategoryBuckets(),
            staffingFactorByCategory: cloneCategoryBuckets(),
            inputFactorByCategory: cloneCategoryBuckets(),
            warFactorByCategory: cloneCategoryBuckets(),
            effectiveOutput: 0,
            localValueAdded: 0,
            profitOutflow: 0,
            treasuryIncome: 0,
            maintenanceCost: 0,
            lastEconomicTick: 0,
            revision: 0,
            ...(nation.virtualEconomy || {}),
        },
        economyDirtyFlags: {
            buildingsDirty: currentDirty.buildingsDirty !== false,
            laborDirty: currentDirty.laborDirty !== false,
            resourcesDirty: currentDirty.resourcesDirty !== false,
            warDirty: currentDirty.warDirty !== false,
            investmentDirty: currentDirty.investmentDirty !== false,
        },
    };
};

const getLaborParticipationRate = (nation = {}, epoch = 0) => {
    const developmentRate = safeNumber(nation.economyTraits?.developmentRate ?? nation.developmentRate, 1);
    const laborPolicy = nation?.vassalPolicy?.labor || 'standard';
    const governancePolicy = nation?.vassalPolicy?.governance || 'autonomous';
    let rate = 0.44 + Math.min(0.16, epoch * 0.022);
    rate += clamp((developmentRate - 1) * 0.08, -0.06, 0.08);
    if (nation.isAtWar) rate += 0.03;
    if (laborPolicy === 'exploitation') rate += 0.03;
    if (laborPolicy === 'slavery') rate += 0.06;
    if (governancePolicy === 'direct_rule') rate += 0.015;
    return clamp(rate, 0.32, 0.78);
};

const getWorkforceShares = (nation = {}, epoch = 0) => {
    const militarization = nation.isAtWar ? 0.04 : 0;
    const agrarian = clamp(0.48 - epoch * 0.03, 0.22, 0.5);
    const worker = clamp(0.24 + epoch * 0.025, 0.18, 0.46);
    const elite = clamp(0.12 + epoch * 0.006, 0.1, 0.2);
    const soldier = clamp(0.06 + militarization + Math.min(0.05, safeNumber(nation.aggression, 0.3) * 0.05), 0.05, 0.18);
    const total = agrarian + worker + elite + soldier;

    return {
        agrarian: agrarian / total,
        worker: worker / total,
        elite: elite / total,
        soldier: soldier / total,
    };
};

const assignEmployment = (workforceByClass, jobsByClass) => {
    const employmentByClass = cloneClassBuckets();
    const remainingWorkforce = { ...workforceByClass };

    const fillExact = (laborClass) => {
        const filled = Math.min(remainingWorkforce[laborClass] || 0, jobsByClass[laborClass] || 0);
        employmentByClass[laborClass] += filled;
        remainingWorkforce[laborClass] = Math.max(0, (remainingWorkforce[laborClass] || 0) - filled);
        return Math.max(0, (jobsByClass[laborClass] || 0) - filled);
    };

    const agrarianDeficit = fillExact('agrarian');
    if (agrarianDeficit > 0 && remainingWorkforce.worker > 0) {
        const borrowed = Math.min(remainingWorkforce.worker, agrarianDeficit * 0.45);
        employmentByClass.agrarian += borrowed;
        remainingWorkforce.worker -= borrowed;
    }

    const workerDeficit = fillExact('worker');
    if (workerDeficit > 0 && remainingWorkforce.agrarian > 0) {
        const borrowed = Math.min(remainingWorkforce.agrarian, workerDeficit * 0.55);
        employmentByClass.worker += borrowed;
        remainingWorkforce.agrarian -= borrowed;
    }

    const eliteDeficit = fillExact('elite');
    if (eliteDeficit > 0 && remainingWorkforce.worker > 0) {
        const borrowed = Math.min(remainingWorkforce.worker, eliteDeficit * 0.35);
        employmentByClass.elite += borrowed;
        remainingWorkforce.worker -= borrowed;
    }

    fillExact('soldier');

    return employmentByClass;
};

const calculateJobsByClass = (virtualBuildings = {}) => {
    const jobsByClass = cloneClassBuckets();
    Object.entries(virtualBuildings || {}).forEach(([buildingId, count]) => {
        const numericCount = Math.max(0, safeNumber(count, 0));
        if (numericCount <= 0) return;
        const profile = BUILDING_JOB_CLASS_INDEX[buildingId];
        if (!profile) return;
        LABOR_CLASSES.forEach(laborClass => {
            jobsByClass[laborClass] += safeNumber(profile[laborClass], 0) * numericCount;
        });
    });
    return jobsByClass;
};

export const calculateJobsByRole = (virtualBuildings = {}) => {
    const jobsByRole = {};
    Object.entries(virtualBuildings || {}).forEach(([buildingId, count]) => {
        const numericCount = Math.max(0, safeNumber(count, 0));
        if (numericCount <= 0) return;
        const roleProfile = BUILDING_JOB_ROLE_INDEX[buildingId];
        if (!roleProfile) return;
        Object.entries(roleProfile).forEach(([role, amount]) => {
            jobsByRole[role] = (jobsByRole[role] || 0) + safeNumber(amount, 0) * numericCount;
        });
    });
    return jobsByRole;
};

export const calculateAIVirtualLabor = (nation = {}, context = {}) => {
    const tick = safeNumber(context.tick, 0);
    const epoch = safeNumber(context.epoch ?? nation.epoch, 0);
    const population = Math.max(1, safeNumber(context.population ?? nation.population, 1));
    const virtualBuildings = context.virtualBuildings || nation.virtualBuildings || {};

    const laborParticipationRate = getLaborParticipationRate(nation, epoch);
    const laborForce = Math.max(1, Math.round(population * laborParticipationRate));
    const shares = getWorkforceShares(nation, epoch);
    const workforceByClass = {
        agrarian: Math.round(laborForce * shares.agrarian),
        worker: Math.round(laborForce * shares.worker),
        elite: Math.round(laborForce * shares.elite),
        soldier: 0,
    };
    workforceByClass.soldier = Math.max(
        0,
        laborForce - workforceByClass.agrarian - workforceByClass.worker - workforceByClass.elite
    );

    const jobsByClass = calculateJobsByClass(virtualBuildings);
    const jobsByRole = calculateJobsByRole(virtualBuildings);
    const employmentByClass = assignEmployment(workforceByClass, jobsByClass);
    const employment = LABOR_CLASSES.reduce((sum, laborClass) => sum + employmentByClass[laborClass], 0);
    const unemployment = Math.max(0, laborForce - employment);
    const employmentRate = laborForce > 0 ? clamp(employment / laborForce, 0, 1) : 0;
    const unemploymentRate = laborForce > 0 ? unemployment / laborForce : 0;
    const shortagePressure = Math.max(0, 1 - employmentRate);
    const wagePressure = clamp(1 + shortagePressure * 0.4 - unemploymentRate * 0.12, 0.75, 1.45);

    return {
        laborForce,
        employment,
        unemployment,
        employmentRate: Number(employmentRate.toFixed(3)),
        workforceByClass,
        jobsByClass,
        jobsByRole,
        employmentByClass,
        wagePressure: Number(wagePressure.toFixed(3)),
        lastLaborTick: tick,
    };
};

const aggregateCategoryJobs = (virtualBuildings = {}) => {
    const jobsByCategory = cloneCategoryBuckets();
    Object.entries(virtualBuildings || {}).forEach(([buildingId, count]) => {
        const numericCount = Math.max(0, safeNumber(count, 0));
        if (numericCount <= 0) return;
        const jobProfile = BUILDING_JOB_CLASS_INDEX[buildingId];
        const category = BUILDING_CATEGORY_INDEX[buildingId];
        if (!jobProfile || !category) return;
        const buildingJobs = LABOR_CLASSES.reduce((sum, laborClass) => sum + safeNumber(jobProfile[laborClass], 0), 0);
        jobsByCategory[category] += buildingJobs * numericCount;
    });
    return jobsByCategory;
};

const aggregateCategoryIntegrity = (virtualBuildings = {}, baselineBuildings = {}) => {
    const current = cloneCategoryBuckets();
    const baseline = cloneCategoryBuckets();
    Object.entries(baselineBuildings || {}).forEach(([buildingId, count]) => {
        const category = BUILDING_CATEGORY_INDEX[buildingId];
        if (!category) return;
        baseline[category] += Math.max(0, safeNumber(count, 0));
        current[category] += Math.max(0, safeNumber(virtualBuildings[buildingId], 0));
    });

    return Object.fromEntries(CATEGORY_KEYS.map(category => {
        const baseCount = baseline[category];
        if (baseCount <= 0) return [category, 1];
        const integrity = clamp(current[category] / baseCount, 0.35, 1);
        return [category, Number(integrity.toFixed(3))];
    }));
};

export const calculateAIVirtualEconomy = (nation = {}, context = {}) => {
    const tick = safeNumber(context.tick, 0);
    const virtualBuildings = context.virtualBuildings || nation.virtualBuildings || {};
    const foreignBuildings = context.foreignBuildings || nation.virtualBuildingsForeign || {};
    const baselineBuildings = context.baselineBuildings || nation.virtualBuildingsBaseline || virtualBuildings;
    const labor = context.virtualLabor || nation.virtualLabor || calculateAIVirtualLabor(nation, context);
    const inventory = nation.nationInventories || nation.inventory || {};

    const jobsByCategory = aggregateCategoryJobs(virtualBuildings);
    const totalJobs = Object.values(jobsByCategory).reduce((sum, amount) => sum + amount, 0);
    const employmentFactor = totalJobs > 0 ? clamp(safeNumber(labor.employment, 0) / totalJobs, 0.2, 1) : 1;
    const warFactorByCategory = aggregateCategoryIntegrity(virtualBuildings, baselineBuildings);

    const buildingDemandByResource = {};
    const buildingSupplyByResource = {};
    const outputByCategory = cloneCategoryBuckets();
    const staffingFactorByCategory = cloneCategoryBuckets();
    const inputFactorByCategory = cloneCategoryBuckets();

    CATEGORY_KEYS.forEach(category => {
        staffingFactorByCategory[category] = totalJobs > 0 && jobsByCategory[category] > 0
            ? Number(clamp(employmentFactor, 0.2, 1).toFixed(3))
            : 1;
        inputFactorByCategory[category] = 1;
    });

    Object.entries(virtualBuildings || {}).forEach(([buildingId, count]) => {
        const numericCount = Math.max(0, safeNumber(count, 0));
        if (numericCount <= 0) return;

        const outputs = BUILDING_OUTPUT_INDEX[buildingId];
        const inputs = BUILDING_INPUT_INDEX[buildingId];
        const category = BUILDING_CATEGORY_INDEX[buildingId];
        if (!category) return;

        Object.entries(inputs || {}).forEach(([resourceKey, amount]) => {
            const demand = amount * numericCount;
            buildingDemandByResource[resourceKey] = (buildingDemandByResource[resourceKey] || 0) + demand;
        });

        Object.entries(outputs || {}).forEach(([resourceKey, amount]) => {
            const price = safeNumber((nation.nationPrices || nation.market?.prices || {})[resourceKey], RESOURCES[resourceKey]?.basePrice || 1);
            outputByCategory[category] += amount * numericCount * price;
            buildingSupplyByResource[resourceKey] = (buildingSupplyByResource[resourceKey] || 0) + amount * numericCount;
        });
    });

    CATEGORY_KEYS.forEach(category => {
        const categoryInputs = Object.entries(virtualBuildings || {})
            .filter(([buildingId, count]) => safeNumber(count, 0) > 0 && BUILDING_CATEGORY_INDEX[buildingId] === category)
            .flatMap(([buildingId, count]) => Object.entries(BUILDING_INPUT_INDEX[buildingId] || {}).map(([resourceKey, amount]) => [resourceKey, amount * safeNumber(count, 0)]));

        if (categoryInputs.length === 0) {
            inputFactorByCategory[category] = 1;
            return;
        }

        let limitingFactor = 1;
        categoryInputs.forEach(([resourceKey, demand]) => {
            const available = Math.max(0, safeNumber(inventory[resourceKey], 0));
            if (demand > 0) {
                limitingFactor = Math.min(limitingFactor, clamp(available / demand, 0.25, 1));
            }
        });
        inputFactorByCategory[category] = Number(clamp(limitingFactor, 0.25, 1).toFixed(3));
    });

    const foreignBuildingTotal = Object.values(foreignBuildings || {}).reduce((sum, count) => sum + Math.max(0, safeNumber(count, 0)), 0);
    const totalBuildingCount = Object.values(virtualBuildings || {}).reduce((sum, count) => sum + Math.max(0, safeNumber(count, 0)), 0);
    const foreignShare = totalBuildingCount > 0 ? clamp(foreignBuildingTotal / totalBuildingCount, 0, 0.75) : 0;
    const capitalBaseValue = Object.entries(virtualBuildings || {}).reduce((sum, [buildingId, count]) => {
        return sum + estimateBuildingCapitalCost(nation, buildingId, count);
    }, 0);

    let effectiveOutput = 0;
    CATEGORY_KEYS.forEach(category => {
        const categoryOutput = outputByCategory[category] || 0;
        effectiveOutput += categoryOutput
            * safeNumber(staffingFactorByCategory[category], 1)
            * safeNumber(inputFactorByCategory[category], 1)
            * safeNumber(warFactorByCategory[category], 1);
    });

    const inputCost = Object.entries(buildingDemandByResource).reduce((sum, [resourceKey, demand]) => {
        const price = safeNumber((nation.nationPrices || nation.market?.prices || {})[resourceKey], RESOURCES[resourceKey]?.basePrice || 1);
        return sum + demand * price;
    }, 0);
    const maintenanceCost = totalBuildingCount * 0.08 + capitalBaseValue * 0.0009;
    const localValueAdded = Math.max(0, effectiveOutput - inputCost * 0.45 - maintenanceCost);
    // 温和下调利润外流，给本地经济留更多再投资空间
    const profitOutflow = Math.max(0, localValueAdded * foreignShare * 0.12);
    const treasuryIncome = Math.max(0, localValueAdded * (nation.vassalOf === 'player' ? 0.1 : 0.08));

    return {
        buildingDemandByResource,
        buildingSupplyByResource,
        outputByCategory,
        staffingFactorByCategory,
        inputFactorByCategory,
        warFactorByCategory,
        effectiveOutput: Number(effectiveOutput.toFixed(2)),
        localValueAdded: Number(localValueAdded.toFixed(2)),
        profitOutflow: Number(profitOutflow.toFixed(2)),
        treasuryIncome: Number(treasuryIncome.toFixed(2)),
        maintenanceCost: Number(maintenanceCost.toFixed(2)),
        capitalBaseValue: Number(capitalBaseValue.toFixed(2)),
        lastEconomicTick: tick,
        revision: tick,
    };
};

export const calculateAIDevelopmentSnapshot = (nation = {}, context = {}) => {
    const tick = safeNumber(context.tick, 0);
    const virtualBuildings = context.virtualBuildings || nation.virtualBuildings || {};
    const foreignBuildings = context.foreignBuildings || nation.virtualBuildingsForeign || {};
    const virtualLabor = context.virtualLabor || nation.virtualLabor || calculateAIVirtualLabor(nation, context);
    const virtualEconomy = context.virtualEconomy || nation.virtualEconomy || calculateAIVirtualEconomy(nation, {
        ...context,
        virtualLabor,
    });
    const capacityState = calculateDevelopmentCapacity({
        nation,
        virtualBuildings,
        foreignBuildings,
    });

    const supplyByResource = { ...(capacityState.resourceSupply || {}) };
    const demandByResource = { ...(capacityState.resourceDemand || {}) };
    const netByResource = {};
    Object.keys({ ...supplyByResource, ...demandByResource }).forEach(resourceKey => {
        netByResource[resourceKey] = safeNumber(supplyByResource[resourceKey], 0) - safeNumber(demandByResource[resourceKey], 0);
    });

    const foodBalance = safeNumber(netByResource.food, 0);
    const rawMaterialPressure = clamp(
        safeNumber(demandByResource.wood, 0)
            + safeNumber(demandByResource.stone, 0)
            + safeNumber(demandByResource.copper, 0)
            + safeNumber(demandByResource.iron, 0)
            - safeNumber(supplyByResource.wood, 0)
            - safeNumber(supplyByResource.stone, 0)
            - safeNumber(supplyByResource.copper, 0)
            - safeNumber(supplyByResource.iron, 0),
        0,
        999999
    ) / Math.max(1, capacityState.totalBuildings || 1);
    const processingPressure = clamp(
        safeNumber(supplyByResource.wood, 0)
            + safeNumber(supplyByResource.stone, 0)
            + safeNumber(supplyByResource.food, 0)
            - safeNumber(demandByResource.wood, 0)
            - safeNumber(demandByResource.stone, 0)
            - safeNumber(demandByResource.food, 0),
        0,
        999999
    ) / Math.max(1, capacityState.totalBuildings || 1);

    const carryingCapacity = Math.max(1, safeNumber(context.carryingCapacity, nation.population || 1));
    const employment = safeNumber(virtualLabor.employment, 0);
    const unemployment = safeNumber(virtualLabor.unemployment, 0);
    const laborPool = safeNumber(virtualLabor.laborForce, employment + unemployment);
    const population = safeNumber(context.population ?? nation.population, 0);
    const unemploymentRate = laborPool > 0 ? unemployment / laborPool : 0;
    const wealthGeneration = {
        grossOutput: safeNumber(virtualEconomy.effectiveOutput, 0),
        localValueAdded: safeNumber(virtualEconomy.localValueAdded, 0),
        maintenanceCost: safeNumber(virtualEconomy.maintenanceCost, 0),
        tradeIncome: safeNumber(context.tradeIncome, 0),
        warLoss: safeNumber(context.warLoss, 0),
        netWealthChange: safeNumber(context.netWealthChange, 0),
    };

    return {
        population,
        laborPool,
        employment,
        unemployment,
        unemploymentRate: Number(clamp(unemploymentRate, 0, 1).toFixed(3)),
        jobsByRole: capacityState.jobsByRole || {},
        jobsByCategory: capacityState.jobsByCategory || cloneCategoryBuckets(),
        capacityByCategory: capacityState.capacityByCategory || cloneCategoryBuckets(),
        resourceBalance: {
            supplyByResource,
            demandByResource,
            netByResource,
            foodBalance: Number(foodBalance.toFixed(3)),
            rawMaterialPressure: Number(rawMaterialPressure.toFixed(3)),
            processingPressure: Number(processingPressure.toFixed(3)),
        },
        wealthGeneration,
        investmentPressure: Number(clamp(safeNumber(virtualEconomy.profitOutflow, 0) / Math.max(1, safeNumber(virtualEconomy.localValueAdded, 0) || 1), 0, 1).toFixed(3)),
        urbanProxy: Number(safeNumber(capacityState.urbanProxy, 0.25).toFixed(3)),
        warRecovery: Number(safeNumber(context.warRecovery, 1).toFixed(3)),
        carryingCapacity,
        foodSecurity: Number(safeNumber(context.foodSecurity, 1).toFixed(3)),
        populationPressure: Number(clamp(population / Math.max(1, carryingCapacity), 0, 3).toFixed(3)),
        employmentRate: Number(clamp(safeNumber(virtualLabor.employmentRate, 0), 0, 1).toFixed(3)),
        lastUpdateTick: tick,
    };
};
