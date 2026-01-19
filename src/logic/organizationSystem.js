// 组织度系统 (Organization System)
// 追踪各阶层的组织度，用于确定性叛乱触发机制
// 基于《叛乱与阶层机制改进方案V3》

import { STRATA } from '../config/strata';
import { RESOURCES } from '../config';
import { REBELLION_PHASE } from '../config/events/rebellionEvents';
import { PASSIVE_DEMAND_TYPES } from './demands';
import { getCoalitionSensitivity, isCoalitionMember, getLegitimacyOrganizationModifier, calculateCoalitionInfluenceShare, calculateLegitimacy } from './rulingCoalition';
import {
    getDifficultyConfig,
    DEFAULT_DIFFICULTY,
    applyOrganizationGrowthModifier,
    getSatisfactionThreshold,
    getStabilityDampeningBonus,
    isInGracePeriod,
} from '../config/difficulty';

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
// 与 strata.js 中的阶层保持一致
export const STRATUM_ORGANIZATION_MULTIPLIER = {
    // 上层阶级
    capitalist: 2.4,    // 资本家 (原2.0)
    landowner: 1.8,     // 地主 (原1.5)
    official: 1.5,      // 官员 (原1.2)
    engineer: 1.4,      // 工程师 (原1.0)
    // 中层阶级
    merchant: 1.5,      // 商人 (原1.1)
    soldier: 1.5,       // 军人 (原1.2)
    navigator: 1.3,     // 水手 (原1.0)
    cleric: 1.2,        // 神职人员 (原0.9)
    scribe: 1.2,        // 学者 (原0.9)
    worker: 1.3,        // 工人 (原1.0)
    artisan: 1.2,       // 工匠 (原0.8)
    miner: 1.2,         // 矿工 (原0.9)
    // 底层阶级
    peasant: 1.1,       // 自耕农 (原0.8)
    lumberjack: 1.1,    // 樵夫 (原0.8)
    serf: 0.9,          // 佃农 (原0.6)
    unemployed: 0.4,    // 失业者 (原0.2)
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

export const MIN_REBELLION_INFLUENCE = 0.1;

// 联合叛乱配置
export const COALITION_REBELLION_CONFIG = {
    MIN_ORGANIZATION_TO_JOIN: 70,  // 其他阶层加入联合叛乱的最低组织度 (70%)
    COALITION_BONUS: 0.1,          // 联合叛军人口加成 (10%)
};

/**
 * 检测是否可以发动联合叛乱
 * 当一个阶层达到100%组织度时调用，检测其他高组织度阶层
 * @param {string} primaryStratumKey - 触发叛乱的主要阶层
 * @param {Object} organizationStates - 所有阶层的组织度状态
 * @param {Object} classInfluence - 阶层影响力
 * @param {number} totalInfluence - 总影响力
 * @param {Object} popStructure - 人口结构
 * @returns {Object} { isCoalition: boolean, coalitionStrata: string[], totalInfluenceShare: number }
 */
export function checkCoalitionRebellion(
    primaryStratumKey,
    organizationStates,
    classInfluence,
    totalInfluence,
    popStructure
) {
    const coalitionStrata = [primaryStratumKey];
    let coalitionInfluence = classInfluence[primaryStratumKey] || 0;

    // 检查其他阶层是否满足联合条件
    Object.keys(organizationStates).forEach(stratumKey => {
        if (stratumKey === primaryStratumKey) return;
        if (stratumKey === 'slave') return; // 奴隶不能参与叛乱

        const state = organizationStates[stratumKey];
        const organization = state?.organization || 0;
        const pop = popStructure[stratumKey] || 0;

        // 该阶层必须有人口且组织度 >= 70%
        if (pop > 0 && organization >= COALITION_REBELLION_CONFIG.MIN_ORGANIZATION_TO_JOIN) {
            coalitionStrata.push(stratumKey);
            coalitionInfluence += classInfluence[stratumKey] || 0;
            console.log(`[COALITION] ${stratumKey} qualifies for coalition (org: ${organization.toFixed(1)}%)`);
        }
    });

    const totalInfluenceShare = totalInfluence > 0 ? coalitionInfluence / totalInfluence : 0;
    const isCoalition = coalitionStrata.length > 1;

    if (isCoalition) {
        console.log(`[COALITION] Found ${coalitionStrata.length} strata eligible for coalition rebellion:`, coalitionStrata);
        console.log(`[COALITION] Total influence share: ${(totalInfluenceShare * 100).toFixed(1)}%`);
    }

    return {
        isCoalition,
        coalitionStrata,
        totalInfluenceShare,
    };
}

const DRIVER_WEIGHTS = {
    tax: 0.7,
    basicShortage: 1.0,
    luxuryShortage: 0.35,
    lowIncome: 0.8,
    livingStandard: 0.35,
};

const PASSIVE_DEMAND_DURATION = 60;
const ORGANIZATION_GROWTH_MULTIPLIER = 1.0; // 0.65 -> 1.0 加快组织度增长

// Base satisfaction threshold (can be modified by difficulty)
const BASE_SATISFACTION_THRESHOLD = 45;

const getStabilityGrowthModifier = (stability = 50, difficultyLevel = DEFAULT_DIFFICULTY) => {
    if (!Number.isFinite(stability)) return 1;
    const normalized = Math.max(-1, Math.min(1, (50 - stability) / 50));
    // Apply difficulty bonus to stability dampening
    const stabilityBonus = getStabilityDampeningBonus(difficultyLevel);
    const modifier = 1 + normalized * (0.6 - stabilityBonus);
    return Math.max(0.35, Math.min(1.75, modifier));
};

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
    classExpense = {},
    popStructure = {},
    market = {},
    classLivingStandard = {},
    livingStandardStreaks = {},
    currentDay = 0,
    rulingCoalition = [], // 新增：执政联盟成员
} = {}) => {
    const stratum = STRATA[stratumKey] || {};
    const basicNeeds = stratum.needs || {};
    const basicNeedsKeys = Object.keys(basicNeeds);
    const basicNeedsSet = new Set(basicNeedsKeys);
    const luxuryNeedsSet = new Set();
    if (stratum.luxuryNeeds) {
        Object.values(stratum.luxuryNeeds).forEach(needsGroup => {
            if (!needsGroup) return;
            Object.keys(needsGroup).forEach(resource => luxuryNeedsSet.add(resource));
        });
    }
    const marketPrices = market?.prices || {};

    const basicShortages = [];
    const luxuryShortages = [];
    shortages.forEach(entry => {
        if (!entry || !entry.resource) return;
        const resourceKey = entry.resource;
        if (luxuryNeedsSet.has(resourceKey)) {
            luxuryShortages.push(entry);
            return;
        }
        if (basicNeedsSet.has(resourceKey)) {
            basicShortages.push(entry);
            return;
        }
        luxuryShortages.push(entry);
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
    const expensePerCapitaRaw = classExpense[stratumKey] || 0;
    const expensePerCapita = expensePerCapitaRaw > 0 ? expensePerCapitaRaw / population : 0;
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

    // 执政联盟敏感度配置：联盟阶层使用更低的阈值
    const isCoalition = isCoalitionMember(stratumKey, rulingCoalition);
    const sensitivity = getCoalitionSensitivity(isCoalition);

    const taxThreshold = sensitivity.taxThreshold; // 联盟0.35, 普通0.50
    const taxPressureRaw = Math.max(0, (taxBurdenRatio - taxThreshold) / 0.4);
    const taxPressure = Math.min(1.8, taxPressureRaw);

    const basicOutOfStock = countShortageByReason(basicShortages, 'outOfStock');
    const basicUnaffordable = countShortageByReason(basicShortages, 'unaffordable');
    // 联盟阶层短缺压力更高
    const basicPressurePerItem = sensitivity.basicShortagePressure; // 联盟0.9, 普通0.6
    const basicShortagePressure = Math.min(2, basicOutOfStock * basicPressurePerItem + basicUnaffordable * (basicPressurePerItem * 0.75));

    const luxuryOutOfStock = countShortageByReason(luxuryShortages, 'outOfStock');
    const luxuryUnaffordable = countShortageByReason(luxuryShortages, 'unaffordable');
    // 联盟阶层奢侈短缺压力更高
    const luxuryPressurePerItem = sensitivity.luxuryShortagePressure; // 联盟0.35, 普通0.2
    const luxuryShortagePressure = Math.min(1, luxuryOutOfStock * luxuryPressurePerItem + luxuryUnaffordable * (luxuryPressurePerItem * 0.75));

    let basicNeedsCost = 0;
    basicNeedsKeys.forEach(resource => {
        const amount = basicNeeds[resource];
        if (!amount) return;
        basicNeedsCost += amount * resolvePrice(resource, marketPrices);
    });
    const livingStandard = getSatisfactionRate(classLivingStandard[stratumKey]);
    const livingStandardData = classLivingStandard[stratumKey];

    // 2024-12修复：使用基础需求成本作为目标收入基准，而非实际支出
    // 实际支出可能很高（比如大量购买奢侈品），不应该作为"收入危机"的判断标准
    // 联盟阶层收入目标更高
    const incomeMultiplier = sensitivity.incomeMultiplier; // 联盟1.25, 普通1.08
    let targetIncome = basicNeedsCost * (livingStandard < 0.6 ? 1.25 : incomeMultiplier);
    if (targetIncome <= 0) {
        targetIncome = 0.01;
    }

    // 计算财富比率：用于判断是否有足够储蓄
    const wealthValue = livingStandardData?.wealthPerCapita || 0;
    const startingWealth = stratum.startingWealth || 80;
    const wealthRatio = startingWealth > 0 ? wealthValue / startingWealth : 0;

    // 有效收入：考虑财富可以补偿低收入（自给自足型阶层）
    // 如果财富比率很高，即使收入低也不应该触发收入危机
    const effectiveIncome = Math.max(incomePerCapita, wealthRatio * basicNeedsCost * 0.3);

    let lowIncomePressure = 0;
    // 只有当有效收入低于目标收入的97%时，才触发收入危机
    // 高财富比率（>3x）的阶层完全免疫收入危机
    if (wealthRatio < 3 && effectiveIncome < targetIncome * 0.97) {
        const incomeGapRatio = Math.max(0, (targetIncome - effectiveIncome) / targetIncome);
        lowIncomePressure = Math.min(1.2, incomeGapRatio * 1.2);
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
        livingStandardPressure = Math.min(0.6, streakFactor * 0.6 + scoreFactor * 0.6);

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
 * 公式: 每日增量 = (基础怒气) × (阶层影响力) × (国家稳定度阻尼)
 * 
 * @param {number} approval - 满意度 (0-100)
 * @param {number} influenceShare - 影响力占比 (0-1)
 * @param {number} stability - 稳定度 (0-100)
 * @param {string} stratumKey - 阶层键
 * @param {string} difficultyLevel - 游戏难度
 * @returns {number} 每日增长率 (可为负数表示衰减)
 */
export function calculateOrganizationGrowthRate(approval, influenceShare, stability, stratumKey, difficultyLevel = DEFAULT_DIFFICULTY) {
    // 阶层倍增器
    const stratumMultiplier = STRATUM_ORGANIZATION_MULTIPLIER[stratumKey] || 1.0;

    // 稳定度阻尼: stability 100 -> 阻尼80%, stability 0 -> 无阻尼
    const stabilityDampening = 1 - (stability / 100) * 0.8;

    // Get satisfaction threshold from difficulty settings
    const satisfactionThreshold = getSatisfactionThreshold(difficultyLevel);
    const decayThreshold = satisfactionThreshold + 5; // Decay starts 5 points above growth threshold

    // 当满意度 < threshold 时开始增长, 满意度越低增长越快
    if (approval < satisfactionThreshold) {
        // 基础怒气: 满意度30 -> +0.33/天, 满意度0 -> +1.0/天
        const baseAnger = (satisfactionThreshold - approval) / satisfactionThreshold * 1.0;

        // 影响力加成 (影响力越高，组织能力越强)
        const influenceBonus = 1 + influenceShare * 0.3;

        return baseAnger * stratumMultiplier * influenceBonus * stabilityDampening;
    }

    // 当满意度 > decayThreshold 时开始衰减
    if (approval > decayThreshold) {
        // 基础衰减率
        let decayRate = -0.3; // 降低衰减速度以保持平衡

        // 满意度 > 80 时衰减速度翻倍
        if (approval > 80) {
            decayRate = -0.6;
        }

        return decayRate;
    }

    // 满意度在 threshold 到 decayThreshold 之间: 不增不减
    return 0;
}

/**
 * 更新单个阶层的组织度状态
 * @param {Object} currentState - 当前组织度状态
 * @param {number} approval - 满意度
 * @param {number} influenceShare - 影响力占比
 * @param {number} stability - 稳定度
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
        rulingCoalition = [], // 执政联盟成员
        classInfluence = {}, // 各阶层影响力
        totalInfluence = 0, // 总影响力
        difficultyLevel = DEFAULT_DIFFICULTY, // 游戏难度
        organizationGrowthMod = 0, // [NEW] 组织度增长修正 (from cabinet synergy)
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

    // 计算增长率 (with difficulty)
    let growthRate = calculateOrganizationGrowthRate(approval, influenceShare, stability, stratumKey, difficultyLevel);
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

    // 官员阶层完全禁用叛乱组织度系统
    if (stratumKey === 'official') {
        state.organization = 0;
        state.stage = ORGANIZATION_STAGE.PEACEFUL;
        state.phase = 'none';
        state.growthRate = 0;
        return state;
    }

    // 提前判断是否为联盟成员
    const isInCoalition = isCoalitionMember(stratumKey, rulingCoalition);

    if (growthRate > 0) {
        growthRate *= getStabilityGrowthModifier(stability, difficultyLevel);
        growthRate *= ORGANIZATION_GROWTH_MULTIPLIER;

        // Apply difficulty modifier to growth rate
        growthRate = applyOrganizationGrowthModifier(growthRate, difficultyLevel);

        // 应用合法性修正：高合法性时非联盟阶层组织度增长缓慢
        const coalitionInfluenceShare = calculateCoalitionInfluenceShare(rulingCoalition, classInfluence, totalInfluence);
        const currentLegitimacy = calculateLegitimacy(coalitionInfluenceShare);
        const legitimacyMod = getLegitimacyOrganizationModifier(currentLegitimacy, isInCoalition);
        growthRate *= legitimacyMod;

        // Apply global organization growth modifier (from cabinet synergy)
        if (organizationGrowthMod) {
            growthRate *= (1 + organizationGrowthMod);
        }
    } else if (growthRate < 0) {
        // Apply difficulty modifier to decay rate (inverse - higher multiplier = faster decay)
        growthRate = applyOrganizationGrowthModifier(growthRate, difficultyLevel);
    }

    state.activeDemands = driverContext.demands || [];
    state.growthRate = growthRate;

    // 更新组织度
    let newOrganization = Math.max(0, Math.min(100, state.organization + growthRate));

    // 只有在无基础短缺且满意度较高(>60)时，才限制组织度上限为50%
    // 这意味着生活条件良好的阶层难以发动叛乱
    // 注意：执政联盟成员也受此限制（如果他们很满意，就不该造反）
    if (!hasBasicShortage && approval > 60) {
        const maxOrganizationWithoutBasicShortage = 50;
        if (newOrganization > maxOrganizationWithoutBasicShortage) {
            newOrganization = maxOrganizationWithoutBasicShortage;
            if (state.growthRate > 0) {
                state.growthRate = 0;
            }
        }
    }

    // 影响力过低时的组织度上限
    // 【修改】执政联盟成员不受此限制
    if (!isInCoalition && influenceShare < MIN_REBELLION_INFLUENCE) {
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
 * @param {number} stability - 国家稳定度
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
        classExpense = {},
        popStructure = {},
        taxPolicies = {},
        market = {},
        classLivingStandard = {},
        livingStandardStreaks = {},
        epoch = 0,
        rulingCoalition = [], // 执政联盟成员
        difficultyLevel = DEFAULT_DIFFICULTY, // 游戏难度
        organizationGrowthMod = 0, // [NEW] 组织度增长修正
        // 注意：classInfluence 和 totalInfluence 已经是函数参数，不需要在这里解构
    } = options || {};
    const epochValue = Number.isFinite(epoch) ? epoch : 0;

    // Check if we're in the grace period (easy mode protection)
    const inGracePeriod = isInGracePeriod(currentDay, difficultyLevel);

    const newStates = {};

    Object.keys(STRATA).forEach(stratumKey => {
        // 跳过奴隶（失业者现在可以参与叛乱）
        if (stratumKey === 'slave') {
            return;
        }

        // 石器时代（epoch 0）禁止任何阶层积累组织度，防止早期叛乱
        // Also prevent organization during grace period (easy mode)
        if (epochValue <= 0 || inGracePeriod) {
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
            classExpense,
            popStructure,
            market,
            classLivingStandard,
            livingStandardStreaks,
            epoch: epochValue,
            currentDay,
            rulingCoalition, // 传递执政联盟成员
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
                rulingCoalition, // 传递执政联盟成员
                classInfluence, // 传递各阶层影响力
                totalInfluence, // 传递总影响力
                difficultyLevel, // 传递游戏难度
                organizationGrowthMod, // 传递组织度增长修正
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
        // 只要组织度达到或超过100%，就触发事件让后续逻辑处理
        // 后续逻辑会检查：
        // 1. 影响力是否足够（<10%会触发人口外流而非叛乱）
        // 2. 是否已存在该阶层的叛军政府（避免重复创建）
        // 注意：即使 stage 已经是 UPRISING（老存档），也需要触发事件来处理
        if (currOrg >= 100) {
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
