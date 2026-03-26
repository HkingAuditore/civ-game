const safeNumber = (value, fallback = 0) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : fallback;
};

const clamp = (value, min = 0, max = Infinity) => Math.min(max, Math.max(min, value));

const getPlayerReferenceWeight = (difficultyMultiplier = 1) => clamp(
    0.12 + Math.max(0, difficultyMultiplier - 1) * 0.06,
    0.10,
    0.20
);

const getPopulationSoftCapBoost = (difficultyMultiplier = 1) => clamp(
    1.15 + Math.max(0, difficultyMultiplier - 1) * 0.35,
    1.10,
    1.50
);

const getLaborParticipationRate = (nation = {}, epoch = 0) => {
    const developmentRate = safeNumber(nation.economyTraits?.developmentRate ?? nation.developmentRate, 1);
    const laborPolicy = nation?.vassalPolicy?.labor || 'standard';
    const governancePolicy = nation?.vassalPolicy?.governance || 'autonomous';
    let rate = 0.43 + Math.min(0.16, epoch * 0.02);
    rate += clamp((developmentRate - 1) * 0.08, -0.06, 0.08);
    if (nation.isAtWar) rate += 0.03;
    if (laborPolicy === 'exploitation') rate += 0.03;
    if (laborPolicy === 'slavery') rate += 0.05;
    if (governancePolicy === 'direct_rule') rate += 0.015;
    return clamp(rate, 0.3, 0.78);
};

export const calculateAIPopulationDynamics = ({
    nation = {},
    state = {},
    epoch = 0,
    ticksSinceUpdate = 10,
    capacityState = {},
    playerPopulation = 0,
    difficultyMultiplier = 1,
}) => {
    const population = Math.max(1, Math.round(safeNumber(state.population ?? nation.population, 1)));
    const wealth = Math.max(0, safeNumber(state.wealth ?? nation.wealth, 0));
    const inventory = state.inventory || nation.inventory || {};
    const developmentRate = safeNumber(state.developmentRate ?? nation.economyTraits?.developmentRate, 1);
    const foodStock = Math.max(0, safeNumber(inventory.food, 0));
    const laborRate = getLaborParticipationRate(nation, epoch);
    const laborPool = Math.max(1, Math.round(population * laborRate));
    const totalJobs = Math.max(0, safeNumber(capacityState.totalJobs, 0));
    const employment = Math.min(laborPool, Math.round(totalJobs));
    const unemployment = Math.max(0, laborPool - employment);
    const employmentRate = laborPool > 0 ? employment / laborPool : 0;

    const foodCapacity = safeNumber(capacityState.foodSupply, 0) * 7.5 + foodStock * 0.2;
    const civicCapacity = safeNumber(capacityState.civicSupport, 0) * 3.4;
    const wealthCapacity = Math.sqrt(Math.max(0, wealth)) * (7 + epoch * 0.7);
    const epochFloor = [40, 90, 180, 320, 520, 850, 1300, 1800][Math.min(7, Math.max(0, epoch))] || 1800;
    const playerReferenceWeight = getPlayerReferenceWeight(difficultyMultiplier);
    const populationSoftCapBoost = getPopulationSoftCapBoost(difficultyMultiplier);
    const ownBasePopulation = Math.max(
        1,
        safeNumber(state.basePopulation ?? nation.economyTraits?.ownBasePopulation, population)
    );
    const playerPopulationFloor = Math.max(0, safeNumber(playerPopulation, 0) * playerReferenceWeight);
    const capacityFloor = Math.max(
        220 * populationSoftCapBoost,
        ownBasePopulation * (12 + populationSoftCapBoost * 8),
        playerPopulationFloor * populationSoftCapBoost
    );
    const carryingCapacity = Math.max(
        epochFloor,
        Math.round(foodCapacity + civicCapacity + wealthCapacity),
        Math.round(capacityFloor)
    );

    const foodNeed = Math.max(25, population * 0.18);
    const foodAvailable = foodStock + safeNumber(capacityState.foodSupply, 0) * 6;
    const foodRatio = foodAvailable / Math.max(1, foodNeed);
    const foodFactor = clamp(0.45 + foodRatio * 0.55, 0.2, 1.25);
    const wealthPerCapita = wealth / Math.max(1, population);
    const wealthFactor = clamp(0.65 + Math.min(2, wealthPerCapita / 60) * 0.24, 0.55, 1.15);
    const unemploymentRate = laborPool > 0 ? unemployment / laborPool : 0;
    const employmentFactor = clamp(1.02 - unemploymentRate * 0.45, 0.7, 1.05);
    const warFactor = nation.isAtWar
        ? clamp(0.82 + Math.max(0, difficultyMultiplier - 1) * 0.08, 0.78, 0.92)
        : 1;
    const capacityRatio = population / Math.max(1, carryingCapacity);
    const crowdingFactor = capacityRatio <= 1
        ? clamp(1.08 - capacityRatio * 0.28, 0.72, 1.1)
        : clamp(1 - (capacityRatio - 1) * 0.85, 0.2, 0.95);

    const tickScale = Math.min(2, Math.max(0.5, ticksSinceUpdate / 10));
    // 温和提速：略微抬高基础增长与发展率收益，避免AI中后期“只维持不扩张”
    const baseGrowthRate = (0.0042 + (developmentRate - 1) * 0.0015) * tickScale;
    let netGrowthRate = baseGrowthRate * foodFactor * wealthFactor * employmentFactor * warFactor * crowdingFactor;

    if (foodRatio < 0.85) {
        netGrowthRate -= (0.85 - foodRatio) * 0.02;
    }
    if (capacityRatio > 1) {
        netGrowthRate -= Math.min(0.06, (capacityRatio - 1) * 0.08);
    }

    netGrowthRate = clamp(netGrowthRate, -0.05, 0.03);
    const rawPopulationDelta = population * netGrowthRate;
    let populationChange = Math.round(rawPopulationDelta);
    if (population <= 25) {
        populationChange = Math.max(populationChange, -1);
    }

    const nextPopulation = Math.max(1, population + populationChange);
    const warRecovery = clamp(
        (nation.isAtWar ? 0.45 : 0.85) * (foodFactor * 0.45 + employmentFactor * 0.35 + wealthFactor * 0.2),
        0.2,
        1
    );

    return {
        population: nextPopulation,
        populationChange,
        rawPopulationDelta,
        carryingCapacity,
        foodSecurity: Number(clamp(foodRatio, 0, 2.5).toFixed(3)),
        laborPool,
        employment,
        unemployment,
        employmentRate: Number(clamp(employmentRate, 0, 1).toFixed(3)),
        laborParticipationRate: Number(laborRate.toFixed(3)),
        urbanProxy: safeNumber(capacityState.urbanProxy, 0.25),
        warRecovery: Number(warRecovery.toFixed(3)),
    };
};
