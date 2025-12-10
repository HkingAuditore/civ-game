// 组织度系统 (Organization System)
// 追踪各阶层的组织度，用于确定性叛乱触发机制
// 基于《叛乱与阶层机制改进方案V3》

import { STRATA } from '../config/strata';
import { REBELLION_PHASE } from '../config/events/rebellionEvents';

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
        // 基础怒气: 满意度30 -> +0.5/天, 满意度0 -> +2.0/天
        const baseAnger = (45 - approval) / 45 * 2.0;

        // 影响力加成 (影响力越高，组织能力越强)
        const influenceBonus = 1 + influenceShare * 0.5;

        return baseAnger * stratumMultiplier * influenceBonus * stabilityDampening;
    }

    // 当满意度 > 50 时开始衰减
    if (approval > 50) {
        // 基础衰减率
        let decayRate = -0.5;

        // 满意度 > 80 时衰减速度翻倍
        if (approval > 80) {
            decayRate = -1.0;
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
export function updateStratumOrganization(currentState, approval, influenceShare, stability, stratumKey, currentDay) {
    // 初始化默认状态
    const state = {
        organization: currentState?.organization ?? 0,
        stage: currentState?.stage ?? ORGANIZATION_STAGE.PEACEFUL,
        growthRate: currentState?.growthRate ?? 0,
        lastStageChange: currentState?.lastStageChange ?? 0,
        activeDemands: currentState?.activeDemands ?? [],
        actionCooldowns: currentState?.actionCooldowns ?? {},
        organizationPaused: currentState?.organizationPaused ?? 0, // 组织度暂停天数
    };

    // 检查组织度是否被暂停（收买效果）
    if (state.organizationPaused > 0) {
        state.organizationPaused -= 1;
        state.growthRate = 0;
        return state;
    }

    // 计算增长率
    const growthRate = calculateOrganizationGrowthRate(approval, influenceShare, stability, stratumKey);
    state.growthRate = growthRate;

    // 更新组织度
    const newOrganization = Math.max(0, Math.min(100, state.organization + growthRate));
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
 * @returns {Object} 更新后的组织度状态
 */
export function updateAllOrganizationStates(
    organizationStates,
    classApproval,
    classInfluence,
    totalInfluence,
    stability,
    currentDay
) {
    const newStates = {};

    Object.keys(STRATA).forEach(stratumKey => {
        // 跳过失业者和奴隶（不参与叛乱）
        if (stratumKey === 'unemployed' || stratumKey === 'slave') {
            return;
        }

        const approval = classApproval[stratumKey] ?? 50;
        const influence = classInfluence[stratumKey] || 0;
        const influenceShare = totalInfluence > 0 ? influence / totalInfluence : 0;

        const currentState = organizationStates[stratumKey];
        newStates[stratumKey] = updateStratumOrganization(
            currentState,
            approval,
            influenceShare,
            stability,
            stratumKey,
            currentDay
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
