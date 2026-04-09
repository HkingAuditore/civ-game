import {
    getAIGrowthRateMultiplier,
    getAIPopulationCapMultiplier,
    getAIPopulationFloorMultiplier,
} from '../../../config/difficulty.js';

const safeNumber = (value, fallback = 0) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : fallback;
};

const clamp = (value, min = 0, max = Infinity) => Math.min(max, Math.max(min, value));

const getPlayerReferenceWeight = (difficultyMultiplier = 1) => clamp(
    0.25 + Math.max(0, difficultyMultiplier - 1) * 0.08,
    0.20,
    0.40
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
    hardCapacityLimit = 0,
    difficulty = 'normal',
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
    // [FIX] 对 ownBasePopulation 做合理性上限：防止旧存档/多路径写入的异常大值
    // 通过 capacityFloor 公式（× 12 + softCapBoost × 8 ≈ × 20）将 carryingCapacity 推至天文数字
    const epochPopCeiling = [2000, 6000, 20000, 60000, 150000, 400000, 800000][Math.min(7, Math.max(0, epoch))] || 800000;
    const epochBasePopDefault = [20, 40, 80, 160, 300, 500, 800][Math.min(7, Math.max(0, epoch))] || 20;
    const rawOwnBasePopulation = safeNumber(state.basePopulation ?? nation.economyTraits?.ownBasePopulation, epochBasePopDefault);
    const ownBasePopulation = Math.max(
        1,
        Math.min(rawOwnBasePopulation, Math.max(epochPopCeiling, population * 50, safeNumber(playerPopulation, 0) * 5))
    );
    const playerPopulationFloor = Math.max(0, safeNumber(playerPopulation, 0) * playerReferenceWeight);
    const capacityFloor = Math.max(
        220 * populationSoftCapBoost,
        ownBasePopulation * (12 + populationSoftCapBoost * 8),
        playerPopulationFloor * populationSoftCapBoost
    );
    // [FIX] Raise cap from 2.5x to 3.5x hardCapacityLimit to give growth model more headroom.
    // Without this, capacityRatio approaches 1.0 too early and crowdingFactor kills growth.
    const effectiveCapacityFloor = hardCapacityLimit > 0
        ? Math.min(capacityFloor, hardCapacityLimit * 3.5)
        : capacityFloor;
    const carryingCapacity = Math.max(
        epochFloor,
        Math.round(foodCapacity + civicCapacity + wealthCapacity),
        Math.round(effectiveCapacityFloor)
    );

    const foodNeed = Math.max(25, population * 0.18);
    const foodAvailable = foodStock + safeNumber(capacityState.foodSupply, 0) * 6;
    const rawFoodRatio = foodAvailable / Math.max(1, foodNeed);
    // [FIX] AI building count is capped by AI_BUILDING_EPOCH_CAPS, so foodSupply and totalJobs
    // from buildings can be far below what a large AI population needs. When population is well
    // below carryingCapacity (which already accounts for the nation's true potential), the low
    // building-derived foodSupply is a model limitation, not a real food shortage.
    // Provide a subsistence floor: if capacityRatio < 0.8, guarantee foodRatio >= 0.9
    // (representing informal/subsistence agriculture not captured by the building model).
    const capacityRatioForFood = population / Math.max(1, carryingCapacity);
    const subsistenceFoodFloor = capacityRatioForFood < 0.8
        ? clamp(0.9 + (0.8 - capacityRatioForFood) * 0.5, 0.9, 1.3)
        : capacityRatioForFood < 1.0
            ? clamp(0.7 + (1.0 - capacityRatioForFood) * 1.0, 0.7, 0.9)
            : 0;
    const foodRatio = Math.max(rawFoodRatio, subsistenceFoodFloor);
    const foodFactor = clamp(0.45 + foodRatio * 0.55, 0.2, 1.25);
    const wealthPerCapita = wealth / Math.max(1, population);
    const wealthFactor = clamp(0.65 + Math.min(2, wealthPerCapita / 60) * 0.24, 0.55, 1.15);
    const rawUnemploymentRate = laborPool > 0 ? unemployment / laborPool : 0;
    // [FIX] Same building-cap issue: totalJobs from buildings is artificially low for large
    // AI populations. When population is below carrying capacity, cap the effective unemployment
    // penalty to prevent building limitations from killing growth.
    const effectiveUnemploymentRate = capacityRatioForFood < 0.8
        ? Math.min(rawUnemploymentRate, 0.15)
        : capacityRatioForFood < 1.0
            ? Math.min(rawUnemploymentRate, 0.3)
            : rawUnemploymentRate;
    const employmentFactor = clamp(1.02 - effectiveUnemploymentRate * 0.45, 0.7, 1.05);
    // --- 战线入侵深度影响增长 ---
    // _warHomelandPressure 由 useGameLoop.js 和 simulation.js 写入，范围 0~1+
    const homelandPressure = safeNumber(nation._warHomelandPressure, 0);
    let warFactor;
    if (!nation.isAtWar) {
        warFactor = 1;
    } else if (homelandPressure > 0.93) {
        // 极端入侵（>93%战线）：增长完全停止，转为衰减
        warFactor = 0;
    } else if (homelandPressure > 0.78) {
        // 核心区被入侵：增长大幅削减
        warFactor = clamp(0.15 + Math.max(0, difficultyMultiplier - 1) * 0.03, 0.10, 0.20);
    } else if (homelandPressure > 0.33) {
        // 经济区被入侵：增长显著削减
        warFactor = clamp(0.45 + Math.max(0, difficultyMultiplier - 1) * 0.05, 0.40, 0.55);
    } else if (homelandPressure > 0) {
        // 边境区被入侵：轻微削减
        warFactor = clamp(0.70 + Math.max(0, difficultyMultiplier - 1) * 0.06, 0.65, 0.80);
    } else {
        // 战争中但无本土入侵（AI在进攻）
        warFactor = clamp(0.82 + Math.max(0, difficultyMultiplier - 1) * 0.08, 0.78, 0.92);
    }
    const capacityRatio = population / Math.max(1, carryingCapacity);
    // [FIX] Flatter crowding curve: old formula (1.08 - ratio*0.28) dropped to 0.856 at ratio=0.8,
    // choking growth too early. New formula keeps ~0.94 at ratio=0.8 (stable growth phase),
    // while still producing negative growth above ratio=1.0.
    const crowdingFactor = capacityRatio <= 1
        ? clamp(1.08 - capacityRatio * 0.18, 0.82, 1.1)
        : clamp(1 - (capacityRatio - 1) * 0.85, 0.2, 0.95);

    const tickScale = Math.min(2, Math.max(0.5, ticksSinceUpdate / 10));
    // 难度驱动的增长率调节：aiGrowthRateMultiplier 影响基础增长速率
    const growthRateMultiplier = getAIGrowthRateMultiplier(difficulty);
    const baseGrowthRate = (0.0042 + (developmentRate - 1) * 0.0015) * tickScale * growthRateMultiplier;

    // === 玩家相对人口下限：追赶加成 ===
    // 当 AI 人口低于 playerPopulation × floorMultiplier 时，提供额外增长加速（最高 3x）
    let catchUpBonus = 1.0;
    const safePlayerPop = Math.max(0, safeNumber(playerPopulation, 0));
    if (safePlayerPop > 0) {
        const popFloorMultiplier = getAIPopulationFloorMultiplier(difficulty);
        // 融入 foreignPower.populationFactor 保持国家间差异性
        const nationPopFactor = safeNumber(nation.foreignPower?.populationFactor, 1);
        const popFloorThreshold = safePlayerPop * popFloorMultiplier * nationPopFactor;
        if (population < popFloorThreshold && popFloorThreshold > 0) {
            // 追赶强度随差距增大而增强，最高 3x
            const deficit = (popFloorThreshold - population) / popFloorThreshold;
            catchUpBonus = 1.0 + clamp(deficit * 3.0, 0, 2.0); // max 3x total
        }
    }
    // 战时不享受追赶加成（需求 4.3）
    if (nation.isAtWar) catchUpBonus = 1.0;

    let netGrowthRate = baseGrowthRate * catchUpBonus * foodFactor * wealthFactor * employmentFactor * warFactor * crowdingFactor;

    if (foodRatio < 0.85) {
        netGrowthRate -= (0.85 - foodRatio) * 0.02;
    }
    if (capacityRatio > 1) {
        netGrowthRate -= Math.min(0.06, (capacityRatio - 1) * 0.08);
    }

    // === 玩家相对人口上限：软约束 ===
    // 当 AI 人口超过 playerPopulation × capMultiplier × 80% 时，递减惩罚增长率
    if (safePlayerPop > 0) {
        const popCapMultiplier = getAIPopulationCapMultiplier(difficulty);
        const nationPopFactor = safeNumber(nation.foreignPower?.populationFactor, 1);
        const popCapThreshold = safePlayerPop * popCapMultiplier * nationPopFactor;
        const softCapStart = popCapThreshold * 0.8;
        if (population > softCapStart && popCapThreshold > 0 && netGrowthRate > 0) {
            // 从 80% 到 100% 线性递减到 0
            const overageRatio = clamp((population - softCapStart) / (popCapThreshold - softCapStart), 0, 1);
            const capPenalty = 1.0 - overageRatio;
            netGrowthRate *= Math.max(0, capPenalty);
        }
    }

    // [FIX v5] 战时直接伤亡：补偿从 updateNationEconomy 移除的 warCasualty 逻辑，
    // 确保战争期间人口有明确的下降压力（约 0.4%/周期），而非仅靠增长率降低。
    if (nation.isAtWar) {
        // 基础战争伤亡
        let warCasualtyRate = 0.004 * tickScale;
        // 本土压力加成：被入侵越深，伤亡越大
        // pressure=0: +0%, pressure=0.5: +0.3%, pressure=1.0: +1.2%
        warCasualtyRate += Math.pow(homelandPressure, 1.5) * 0.012 * tickScale;
        // 极端入侵（>93%）：额外人口崩溃
        if (homelandPressure > 0.93) {
            warCasualtyRate += 0.008 * tickScale;
        }
        netGrowthRate -= warCasualtyRate;
    }

    netGrowthRate = clamp(netGrowthRate, -0.05, 0.03);    const rawPopulationDelta = population * netGrowthRate;
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
        // Debug fields for growth diagnostics
        capacityRatio: Number(capacityRatio.toFixed(4)),
        crowdingFactor: Number(crowdingFactor.toFixed(4)),
        netGrowthRate: Number(netGrowthRate.toFixed(6)),
    };
};
