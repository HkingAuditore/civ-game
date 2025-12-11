// 组织度系统 (Organization System)
// 追踪各阶层的组织度，用于确定性叛乱触发机制
// 基于《叛乱与阶层机制改进方案V3》

import { STRATA } from '../config/strata';
import { RESOURCES } from '../config';
import { REBELLION_PHASE } from '../config/events/rebellionEvents';
import { PASSIVE_DEMAND_TYPES } from './demands';

// =========== 常量定义 ===========

// 组织度阶段
export const ORGANIZATION_STAGE = {
    PEACEFUL: 'peaceful',         // 0-29%: 平静
    GRUMBLING: 'grumbling',       // 30-49%: 不满
    MOBILIZING: 'mobilizing',     // 50-69%: 动员中
    RADICALIZING: 'radicalizing', // 70-89%: 激进化
    UPRISING: 'uprising',         // 90-100%: 起义
};

const STAGE_TO_PHASE = {
    [ORGANIZATION_STAGE.PEACEFUL]: REBELLION_PHASE.NONE,
    [ORGANIZATION_STAGE.GRUMBLING]: REBELLION_PHASE.BREWING,
    [ORGANIZATION_STAGE.MOBILIZING]: REBELLION_PHASE.PLOTTING,
    [ORGANIZATION_STAGE.RADICALIZING]: REBELLION_PHASE.PLOTTING,
    [ORGANIZATION_STAGE.UPRISING]: REBELLION_PHASE.ACTIVE,
};

export const getPhaseFromStage = (stage) => STAGE_TO_PHASE[stage] || REBELLION_PHASE.NONE;

// 阶段阈值
export const STAGE_THRESHOLDS = {
    GRUMBLING: 30,
    MOBILIZING: 50,
    RADICALIZING: 70,
    UPRISING: 90,
};

// 阶层影响力倍增器 - 权贵阶层组织能力更强
export const STRATUM_ORGANIZATION_MULTIPLIER = {
    landowner: 1.5,
    capitalist: 2.0,
    knight: 1.3,
    official: 1.2,
    merchant: 1.1,
    engineer: 1.0,
    navigator: 1.0,
    cleric: 0.9,
    scribe: 0.9,
    artisan: 0.8,
    worker: 1.0,
    miner: 0.9,
    lumberjack: 0.8,
    soldier: 1.2,
    peasant: 0.8,
    serf: 0.6,
    slave: 0.3,
    unemployed: 0.2,
};

// 阶层对立关系 - 用于"分化"行动
export const RIVAL_PAIRS = {
    peasant: 'landowner',
    serf: 'landowner',
    worker: 'capitalist',
    miner: 'capitalist',
    lumberjack: 'landowner',
    merchant: 'official',
    artisan: 'merchant',
    cleric: 'scribe',
    soldier: 'official',
    knight: 'official',
    engineer: 'capitalist',
    navigator: 'merchant',
    scribe: 'cleric',
    // 缺失对立面的阶层默认对立官员
    official: 'merchant',
    landowner: 'peasant',
    capitalist: 'worker',
};

// 诉求类型
export const DEMAND_TYPE = {
    TAX_RELIEF: 'tax_relief',    // 减税
    SUBSIDY: 'subsidy',          // 补贴
    RESOURCE: 'resource',        // 物资
    POLITICAL: 'political',      // 政治
};

// 策略行动类型
export const STRATEGIC_ACTION = {
    CRACKDOWN: 'crackdown',      // 镇压
    DIVIDE: 'divide',            // 分化
    BRIBE: 'bribe',              // 收买
    PROMISE: 'promise',          // 承诺
};

export const MIN_REBELLION_INFLUENCE = 0.2;

const DRIVER_WEIGHTS = {
    tax: 0.7,
    basicShortage: 1.0,
    luxuryShortage: 0.35,
    lowIncome: 0.8,
    livingStandard: 0.9,
};

const PASSIVE_DEMAND_DURATION = 60;
const ORGANIZATION_GROWTH_MULTIPLIER = 0.65;

const resolvePrice = (resourceKey, marketPrices = {}) => {
    const marketPrice = marketPrices?.[resourceKey];
    if (Number.isFinite(marketPrice) && marketPrice > 0) {
        return marketPrice;
    }
    return RESOURCES[resourceKey]?.basePrice || 1;
};

const getSatisfactionRate = (data) => {
    if (data && typeof data === 'object') {
        if (Number.isFinite(data.satisfactionRate)) return data.satisfactionRate;
        if (Number.isFinite(data.value)) return data.value;
    }
    return Number.isFinite(data) ? data : 1;
};

const formatResourceList = (items = [], maxItems = 3) => {
    if (!Array.isArray(items) || items.length === 0) return '';
    return items
        .slice(0, maxItems)
        .map(item => {
            const key = typeof item === 'string' ? item : item.resource;
            return RESOURCES[key]?.name || key;
        })
        .join('、');
};

const countShortageByReason = (collection = [], reason) => {
    return collection.filter(item => {
        if (!item) return false;
        if (item.reason === 'both') return true;
        return item.reason === reason;
    }).length;
};

const buildDriverContext = (stratumKey, {
    shortages = [],
    taxPolicies = {},
    classIncome = {},
    popStructure = {},
    market = {},
    classLivingStandard = {},
    livingStandardStreaks = {},
    currentDay = 0,
} = {}) => {
    const stratum = STRATA[stratumKey] || {};
    const basicNeeds = stratum.needs || {};
    const basicNeedsKeys = Object.keys(basicNeeds);
    const basicNeedsSet = new Set(basicNeedsKeys);
    const marketPrices = market?.prices || {};

    const basicShortages = [];
    const luxuryShortages = [];
    shortages.forEach(entry => {
        if (!entry || !entry.resource) return;
        if (basicNeedsSet.has(entry.resource)) {
            basicShortages.push(entry);
        } else {
            luxuryShortages.push(entry);
        }
    });

    const population = Math.max(0, popStructure[stratumKey] || 0);

    // 当该阶层没有人口时，直接返回空上下文，避免“幽灵阶层”积累组织度
    if (population <= 0) {
        return {
            driverScore: 0,
            hasBasicShortage: false,
            demands: [],
        };
    }

    const incomePerCapita = (classIncome[stratumKey] || 0) / population;
    const headTaxBase = stratum.headTaxBase ?? 0;
    const headTaxRate = taxPolicies?.headTaxRates?.[stratumKey] ?? 1;
    const headTaxPerCapita = headTaxBase * headTaxRate;
    const resourceTaxRates = taxPolicies?.resourceTaxRates || {};
    let tradeTaxPerCapita = 0;
    basicNeedsKeys.forEach(resource => {
        const amount = basicNeeds[resource];
        if (!amount) return;
        const taxRate = resourceTaxRates[resource] || 0;
        if (taxRate <= 0) return;
        const price = resolvePrice(resource, marketPrices);
        tradeTaxPerCapita += amount * price * taxRate;
    });
    const totalTaxPerCapita = headTaxPerCapita + tradeTaxPerCapita;
    const taxBurdenRatio = incomePerCapita > 0
        ? totalTaxPerCapita / incomePerCapita
        : (totalTaxPerCapita > 0 ? 1 : 0);
    const taxThreshold = 0.35;
    const taxPressureRaw = Math.max(0, (taxBurdenRatio - taxThreshold) / 0.4);
    const taxPressure = Math.min(1.8, taxPressureRaw);

    const basicOutOfStock = countShortageByReason(basicShortages, 'outOfStock');
    const basicUnaffordable = countShortageByReason(basicShortages, 'unaffordable');
    const basicShortagePressure = Math.min(2, basicOutOfStock * 0.6 + basicUnaffordable * 0.45);

    const luxuryOutOfStock = countShortageByReason(luxuryShortages, 'outOfStock');
    const luxuryUnaffordable = countShortageByReason(luxuryShortages, 'unaffordable');
    const luxuryShortagePressure = Math.min(1, luxuryOutOfStock * 0.2 + luxuryUnaffordable * 0.15);

    let basicNeedsCost = 0;
    basicNeedsKeys.forEach(resource => {
        const amount = basicNeeds[resource];
        if (!amount) return;
        basicNeedsCost += amount * resolvePrice(resource, marketPrices);
    });
    const livingStandard = getSatisfactionRate(classLivingStandard[stratumKey]);
    const livingStandardData = classLivingStandard[stratumKey];
    let targetIncome = basicNeedsCost * 1.15;
    if (livingStandard < 0.6) {
        targetIncome *= 1.1;
    }
    if (incomePerCapita >= basicNeedsCost) {
        const surplusRatio = Math.max(0, incomePerCapita - basicNeedsCost) / Math.max(1, basicNeedsCost);
        const comfortBoost = Math.min(0.35, surplusRatio * 0.25);
        targetIncome = Math.min(targetIncome, basicNeedsCost * (1.1 + comfortBoost));
    }
    if (targetIncome <= 0) {
        targetIncome = 0.01;
    }
    let lowIncomePressure = 0;
    if (incomePerCapita < targetIncome * 0.95) {
        const incomeGapRatio = Math.max(0, (targetIncome - incomePerCapita) / targetIncome);
        lowIncomePressure = Math.min(1.6, incomeGapRatio * 1.4);
    }

    const demands = [];
    if (taxPressure > 0.05) {
        const currentPercent = Math.round(taxBurdenRatio * 100);
        demands.push({
            id: `${stratumKey}_tax_${currentDay}`,
            type: PASSIVE_DEMAND_TYPES.TAX_PRESSURE,
            createdDay: currentDay,
            deadline: currentDay + PASSIVE_DEMAND_DURATION,
            requirement: `将综合税负降至 ${Math.round(taxThreshold * 100)}% 以下（当前 ${currentPercent}%）`,
            failurePenalty: { description: '若继续加税，该阶层会组织抗税并积累叛乱势力。' },
            currentProgress: Math.max(0, Math.min(1, 1 - Math.max(0, taxBurdenRatio - taxThreshold))),
        });
    }

    if (basicShortagePressure > 0) {
        const missingResources = Array.from(
            new Set(basicShortages.map(item => RESOURCES[item.resource]?.name || item.resource))
        );
        const resourceText = formatResourceList(basicShortages, 4);
        demands.push({
            id: `${stratumKey}_basic_${currentDay}`,
            type: PASSIVE_DEMAND_TYPES.BASIC_SHORTAGE,
            createdDay: currentDay,
            deadline: currentDay + PASSIVE_DEMAND_DURATION,
            requirement: resourceText
                ? `补足必需品：${resourceText}`
                : '补足全部基础物资',
            missingResources,
            failurePenalty: { description: '长时间无粮无衣会迫使他们走向叛乱。' },
            currentProgress: 0,
        });
    }

    if (luxuryShortagePressure > 0.05) {
        const missingResources = Array.from(
            new Set(luxuryShortages.map(item => RESOURCES[item.resource]?.name || item.resource))
        );
        const resourceText = formatResourceList(luxuryShortages, 4);
        demands.push({
            id: `${stratumKey}_luxury_${currentDay}`,
            type: PASSIVE_DEMAND_TYPES.LUXURY_SHORTAGE,
            createdDay: currentDay,
            deadline: currentDay + PASSIVE_DEMAND_DURATION,
            requirement: resourceText
                ? `满足生活品质诉求：${resourceText}`
                : '提供更多奢侈消费或文化活动',
            missingResources,
            failurePenalty: { description: '若长期忽视，他们会寻求更激进的方式争取生活品质。' },
            currentProgress: 0,
        });
    }

    if (lowIncomePressure > 0.05) {
        demands.push({
            id: `${stratumKey}_income_${currentDay}`,
            type: PASSIVE_DEMAND_TYPES.INCOME_CRISIS,
            createdDay: currentDay,
            deadline: currentDay + PASSIVE_DEMAND_DURATION,
            requirement: `提高人均收入至 ${targetIncome.toFixed(1)}（当前 ${incomePerCapita.toFixed(1)}）`,
            failurePenalty: { description: '若收入持续倒退，他们会把希望寄托在叛乱上。' },
            currentProgress: Math.min(1, incomePerCapita / targetIncome),
        });
    }

    const livingTracker = livingStandardStreaks?.[stratumKey] || {};
    const livingStandardLevel = livingTracker.level || livingStandardData?.level;
    const livingStreak = livingTracker.streak || 0;
    let livingStandardPressure = 0;
    if (livingStandardLevel === '赤贫' || livingStandardLevel === '贫困') {
        const score = livingStandardData?.score ?? 40;
        const streakFactor = Math.min(1.2, (livingStreak / 5) * 0.5);
        const scoreFactor = Math.max(0, (60 - score) / 80);
        livingStandardPressure = Math.min(1.3, streakFactor + scoreFactor);

        if (livingStreak >= 3) {
            const requirement = `将生活水平从${livingStandardLevel}提升到温饱以上（已持续${livingStreak}天）`;
            demands.push({
                id: `${stratumKey}_living_${currentDay}`,
                type: PASSIVE_DEMAND_TYPES.LIVING_STANDARD,
                createdDay: currentDay,
                deadline: currentDay + PASSIVE_DEMAND_DURATION,
                requirement,
                failurePenalty: { description: '若继续赤贫下去，该阶层会把希望寄托在彻底的反抗。' },
                currentProgress: Math.min(1, Math.max(0, (score - 30) / 40)),
            });
        }
    }

    const driverScore =
        (taxPressure * DRIVER_WEIGHTS.tax) +
        (basicShortagePressure * DRIVER_WEIGHTS.basicShortage) +
        (luxuryShortagePressure * DRIVER_WEIGHTS.luxuryShortage) +
        (lowIncomePressure * DRIVER_WEIGHTS.lowIncome) +
        (livingStandardPressure * DRIVER_WEIGHTS.livingStandard);

    return {
        driverScore,
        hasBasicShortage: basicShortages.length > 0,
        demands,
    };
};

// =========== 核心函数 ===========

/**
 * 获取组织度阶段
 * @param {number} organization - 组织度 (0-100)
 * @returns {string} 阶段标识
 */
export function getOrganizationStage(organization) {
    if (organization >= STAGE_THRESHOLDS.UPRISING) return ORGANIZATION_STAGE.UPRISING;
    if (organization >= STAGE_THRESHOLDS.RADICALIZING) return ORGANIZATION_STAGE.RADICALIZING;
    if (organization >= STAGE_THRESHOLDS.MOBILIZING) return ORGANIZATION_STAGE.MOBILIZING;
    if (organization >= STAGE_THRESHOLDS.GRUMBLING) return ORGANIZATION_STAGE.GRUMBLING;
    return ORGANIZATION_STAGE.PEACEFUL;
}

/**
 * 计算组织度每日增长/衰减率
 * 公式: 每日增量 = (基础怒气) × (阶层影响力) × (国家稳定性阻尼)
 * 
 * @param {number} approval - 满意度 (0-100)
 * @param {number} influenceShare - 影响力占比 (0-1)
 * @param {number} stability - 稳定性 (0-100)
 * @param {string} stratumKey - 阶层键
 * @returns {number} 每日增长率 (可为负数表示衰减)
 */
export function calculateOrganizationGrowthRate(approval, influenceShare, stability, stratumKey) {
    // 阶层倍增器
    const stratumMultiplier = STRATUM_ORGANIZATION_MULTIPLIER[stratumKey] || 1.0;

    // 稳定性阻尼: stability 100 -> 阻尼80%, stability 0 -> 无阻尼
    const stabilityDampening = 1 - (stability / 100) * 0.8;

    // 当满意度 < 45 时开始增长, 满意度越低增长越快
    if (approval < 45) {
        // 基础怒气: 满意度30 -> +0.25/天, 满意度0 -> +1.0/天 (降低了50%)
        const baseAnger = (45 - approval) / 45 * 1.0;

        // 影响力加成 (影响力越高，组织能力越强)
        const influenceBonus = 1 + influenceShare * 0.3; // 降低影响力加成

        return baseAnger * stratumMultiplier * influenceBonus * stabilityDampening;
    }

    // 当满意度 > 50 时开始衰减
    if (approval > 50) {
        // 基础衰减率
        let decayRate = -0.3; // 降低衰减速度以保持平衡

        // 满意度 > 80 时衰减速度翻倍
        if (approval > 80) {
            decayRate = -0.6;
        }

        return decayRate;
    }

    // 满意度在 45-50 之间: 不增不减
    return 0;
}

/**
 * 更新单个阶层的组织度状态
 * @param {Object} currentState - 当前组织度状态
 * @param {number} approval - 满意度
 * @param {number} influenceShare - 影响力占比
 * @param {number} stability - 稳定性
 * @param {string} stratumKey - 阶层键
 * @param {number} currentDay - 当前游戏天数
 * @returns {Object} 更新后的状态
 */
export function updateStratumOrganization(
    currentState,
    approval,
    influenceShare,
    stability,
    stratumKey,
    currentDay,
    options = {}
) {
    const {
        hasActivePromise = false,
        driverContext = {},
        hasBasicShortage = true,
    } = options || {};
    // 初始化默认状态
    const state = {
        organization: currentState?.organization ?? 0,
        stage: currentState?.stage ?? ORGANIZATION_STAGE.PEACEFUL,
        growthRate: currentState?.growthRate ?? 0,
        lastStageChange: currentState?.lastStageChange ?? 0,
        activeDemands: currentState?.activeDemands ?? [],
        actionCooldowns: currentState?.actionCooldowns ?? {},
        organizationPaused: currentState?.organizationPaused ?? 0, // 组织度暂停天数
        resistance: currentState?.resistance ?? 0, // 策略行动抵抗力
    };

    // 抵抗力衰减：每天衰减0.5，随时间慢慢恢复对策略的敏感度
    if (state.resistance > 0) {
        state.resistance = Math.max(0, state.resistance - 0.5);
    }

    // 检查组织度是否被暂停（收买效果）
    if (state.organizationPaused > 0) {
        state.organizationPaused = Math.max(0, state.organizationPaused - 1);
    }

    // 计算增长率
    let growthRate = calculateOrganizationGrowthRate(approval, influenceShare, stability, stratumKey);
    const driverScore = Number.isFinite(driverContext.driverScore) ? driverContext.driverScore : 0;

    if (driverScore !== 0) {
        growthRate += driverScore;
    }

    // 如果有活跃的承诺任务，组织度增长速度减半（民众在观望）
    if (hasActivePromise && growthRate > 0) {
        growthRate = growthRate * 0.5;
    }

    if (state.organizationPaused > 0 && growthRate > 0) {
        growthRate = 0;
    }

    if (growthRate > 0) {
        growthRate *= ORGANIZATION_GROWTH_MULTIPLIER;
    }

    state.activeDemands = driverContext.demands || [];
    state.growthRate = growthRate;

    // 更新组织度
    let newOrganization = Math.max(0, Math.min(100, state.organization + growthRate));

    if (!hasBasicShortage && approval < 45) {
        const maxOrganizationWithoutBasicShortage = 50;
        if (newOrganization > maxOrganizationWithoutBasicShortage) {
            newOrganization = maxOrganizationWithoutBasicShortage;
            if (state.growthRate > 0) {
                state.growthRate = 0;
            }
        }
    }

    if (influenceShare < MIN_REBELLION_INFLUENCE) {
        const cappedOrganization = 75;
        if (newOrganization > cappedOrganization) {
            newOrganization = cappedOrganization;
            if (state.growthRate > 0) {
                state.growthRate = 0;
            }
        }
    }

    const previousStage = state.stage;

    state.organization = newOrganization;
    state.stage = getOrganizationStage(newOrganization);
    state.phase = getPhaseFromStage(state.stage);

    // 记录阶段变化时间
    if (state.stage !== previousStage) {
        state.lastStageChange = currentDay;
    }

    return state;
}

/**
 * 批量更新所有阶层的组织度状态
 * @param {Object} organizationStates - 当前组织度状态 { [stratumKey]: OrganizationState }
 * @param {Object} classApproval - 阶层满意度
 * @param {Object} classInfluence - 阶层影响力
 * @param {number} totalInfluence - 总影响力
 * @param {number} stability - 国家稳定性
 * @param {number} currentDay - 当前游戏天数
 * @param {Array} promiseTasks - 当前活跃的承诺任务列表
 * @returns {Object} 更新后的组织度状态
 */
export function updateAllOrganizationStates(
    organizationStates,
    classApproval,
    classInfluence,
    totalInfluence,
    stability,
    currentDay,
    promiseTasks = [],
    classShortages = {},
    options = {}
) {
    const {
        classIncome = {},
        popStructure = {},
        taxPolicies = {},
        market = {},
        classLivingStandard = {},
        livingStandardStreaks = {},
        epoch = 0,
    } = options || {};
    const epochValue = Number.isFinite(epoch) ? epoch : 0;

    const newStates = {};

    Object.keys(STRATA).forEach(stratumKey => {
        // 跳过奴隶（失业者现在可以参与叛乱）
        if (stratumKey === 'slave') {
            return;
        }

        if (stratumKey === 'unemployed' && epochValue <= 0) {
            const prev = organizationStates[stratumKey];
            newStates[stratumKey] = {
                organization: 0,
                stage: ORGANIZATION_STAGE.PEACEFUL,
                phase: REBELLION_PHASE.NONE,
                growthRate: 0,
                lastStageChange: currentDay,
                activeDemands: [],
                actionCooldowns: prev?.actionCooldowns || {},
                organizationPaused: 0,
                resistance: 0,
            };
            return;
        }

        const approval = classApproval[stratumKey] ?? 50;
        const influence = classInfluence[stratumKey] || 0;
        const influenceShare = totalInfluence > 0 ? influence / totalInfluence : 0;

        const populationCount = popStructure[stratumKey] || 0;

        if (populationCount <= 0) {
            const prev = organizationStates[stratumKey] || {};
            newStates[stratumKey] = {
                organization: 0,
                stage: ORGANIZATION_STAGE.PEACEFUL,
                phase: REBELLION_PHASE.NONE,
                growthRate: 0,
                lastStageChange: currentDay,
                activeDemands: [],
                actionCooldowns: prev?.actionCooldowns || {},
                organizationPaused: Math.max(0, (prev?.organizationPaused || 0) - 1),
                resistance: Math.max(0, (prev?.resistance || 0) - 0.5),
            };
            return;
        }

        // 检查该阶层是否有活跃的承诺任务
        const hasActivePromise = promiseTasks.some(task =>
            task.stratumKey === stratumKey &&
            !task.completed &&
            !task.failed
        );

        // 检查该阶层是否有基础需求短缺
        const shortages = classShortages[stratumKey] || [];

        const driverContext = buildDriverContext(stratumKey, {
            shortages,
            taxPolicies,
            classIncome,
            popStructure,
            market,
            classLivingStandard,
            livingStandardStreaks,
            epoch: epochValue,
            currentDay,
        });

        const currentState = organizationStates[stratumKey];
        newStates[stratumKey] = updateStratumOrganization(
            currentState,
            approval,
            influenceShare,
            stability,
            stratumKey,
            currentDay,
            {
                hasActivePromise,
                driverContext,
                hasBasicShortage: !!driverContext.hasBasicShortage,
            }
        );
    });

    return newStates;
}

/**
 * 检查是否有阶层达到阶段阈值需要触发事件
 * @param {Object} previousStates - 上一tick的组织度状态
 * @param {Object} currentStates - 当前tick的组织度状态
 * @returns {Array} 需要触发的事件列表
 */
export function checkOrganizationEvents(previousStates, currentStates) {
    const events = [];

    Object.keys(currentStates).forEach(stratumKey => {
        const prev = previousStates[stratumKey];
        const curr = currentStates[stratumKey];

        if (!prev || !curr) return;

        const prevOrg = prev.organization || 0;
        const currOrg = curr.organization || 0;

        // 检查跨越30%阈值 (酝酿事件)
        if (prevOrg < STAGE_THRESHOLDS.GRUMBLING && currOrg >= STAGE_THRESHOLDS.GRUMBLING) {
            events.push({
                type: 'brewing',
                stratumKey,
                organization: currOrg,
                stage: curr.stage,
            });
        }

        // 检查跨越60%阈值 (密谋事件) - 使用70%作为radicalizing
        if (prevOrg < STAGE_THRESHOLDS.RADICALIZING && currOrg >= STAGE_THRESHOLDS.RADICALIZING) {
            events.push({
                type: 'plotting',
                stratumKey,
                organization: currOrg,
                stage: curr.stage,
            });
        }

        // 检查达到100%阈值 (起义事件)
        if (prevOrg < 100 && currOrg >= 100) {
            events.push({
                type: 'uprising',
                stratumKey,
                organization: currOrg,
                stage: curr.stage,
            });
        }
    });

    return events;
}

/**
 * 获取阶层的对立阶层
 * @param {string} stratumKey - 阶层键
 * @returns {string|null} 对立阶层键
 */
export function getRivalStratum(stratumKey) {
    return RIVAL_PAIRS[stratumKey] || 'official';
}

/**
 * 根据组织度阶段获取UI状态图标
 * @param {string} stage - 组织度阶段
 * @returns {string} 图标名称
 */
export function getStageIcon(stage) {
    switch (stage) {
        case ORGANIZATION_STAGE.PEACEFUL:
            return 'Coffee';
        case ORGANIZATION_STAGE.GRUMBLING:
            return 'AlertTriangle';
        case ORGANIZATION_STAGE.MOBILIZING:
            return 'Eye';
        case ORGANIZATION_STAGE.RADICALIZING:
            return 'AlertCircle';
        case ORGANIZATION_STAGE.UPRISING:
            return 'Flame';
        default:
            return 'Coffee';
    }
}

/**
 * 根据组织度获取进度条颜色类
 * @param {number} organization - 组织度
 * @returns {string} CSS颜色类
 */
export function getOrganizationBarColor(organization) {
    if (organization >= 90) return 'bg-red-500 animate-pulse';
    if (organization >= 70) return 'bg-orange-500';
    if (organization >= 50) return 'bg-yellow-500';
    if (organization >= 30) return 'bg-yellow-400';
    return 'bg-gray-400';
}

/**
 * 获取组织度阶段的中文名称
 * @param {string} stage - 组织度阶段
 * @returns {string} 中文名称
 */
export function getStageName(stage) {
    switch (stage) {
        case ORGANIZATION_STAGE.PEACEFUL:
            return '平静';
        case ORGANIZATION_STAGE.GRUMBLING:
            return '不满';
        case ORGANIZATION_STAGE.MOBILIZING:
            return '动员中';
        case ORGANIZATION_STAGE.RADICALIZING:
            return '激进化';
        case ORGANIZATION_STAGE.UPRISING:
            return '起义';
        default:
            return '未知';
    }
}

/**
 * 预测达到起义阈值的天数
 * @param {number} currentOrg - 当前组织度
 * @param {number} growthRate - 每日增长率
 * @returns {number|null} 预计天数，如果不增长返回null
 */
export function predictDaysToUprising(currentOrg, growthRate) {
    if (growthRate <= 0) return null;
    if (currentOrg >= 100) return 0;

    const remaining = 100 - currentOrg;
    return Math.ceil(remaining / growthRate);
}

export default {
    ORGANIZATION_STAGE,
    STAGE_THRESHOLDS,
    STRATUM_ORGANIZATION_MULTIPLIER,
    RIVAL_PAIRS,
    DEMAND_TYPE,
    STRATEGIC_ACTION,
    getOrganizationStage,
    calculateOrganizationGrowthRate,
    updateStratumOrganization,
    updateAllOrganizationStates,
    checkOrganizationEvents,
    getRivalStratum,
    getStageIcon,
    getOrganizationBarColor,
    getStageName,
    predictDaysToUprising,
    getPhaseFromStage,
};
