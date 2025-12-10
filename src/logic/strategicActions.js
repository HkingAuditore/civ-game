// 策略行动系统 (Strategic Actions)
// 玩家应对叛乱威胁的策略选项
// 基于《叛乱与阶层机制改进方案V3》第3节

import { STRATA } from '../config/strata';
import { getRivalStratum } from './organizationSystem';

// =========== 策略行动配置 ===========

export const STRATEGIC_ACTIONS = {
    /**
     * 镇压 (Crackdown)
     * 消耗资源强行压制叛乱，但会引发更大不满
     */
    crackdown: {
        id: 'crackdown',
        name: '镇压',
        icon: 'Shield',
        description: '动用武力镇压叛乱组织',
        // 详细描述：用于UI展示完整说明
        detailedDescription: '派遣军队强行镇压该阶层的叛乱组织。短期内可有效降低组织度，但会激化矛盾——军人和骑士阶层会因执行镇压任务而心生不满，持续的镇压还会导致军队陷入疲惫状态。',
        // 效果预览：用于UI展示预期效果
        effectPreview: {
            organization: { value: -30, unit: '%', label: '组织度', type: 'immediate' },
            approval: { value: -20, unit: '点', label: '满意度', type: 'immediate' },
            stability: { value: -5, unit: '%', label: '稳定度', type: 'immediate' },
        },
        // 副作用列表：用于UI展示负面影响警告
        sideEffects: [
            { text: '军人、骑士满意度 -15', severity: 'warning', icon: 'Users' },
            { text: '获得「镇压疲惫」：军事力量 -20%，持续30天', severity: 'danger', icon: 'AlertTriangle' },
        ],
        // 使用建议
        usageHint: '当组织度接近爆发(90%+)时的紧急措施，用时间换空间。不宜频繁使用。',
        // 适用阶段的中文名称
        applicableStagesNames: ['不满', '动员中', '激进化', '起义'],
        // 原有配置
        cost: {
            silver: 300,
        },
        militaryCost: {
            approvalPenalty: { soldier: -15, knight: -15 },
        },
        effects: {
            organization: -30,
            approval: -20,
            stability: -5,
        },
        debuffs: [{
            id: 'suppression_fatigue',
            name: '镇压疲惫',
            description: '军事力量 -20%',
            duration: 30,
            effects: { militaryPower: -0.20 },
        }],
        cooldown: 30,
        requirements: {
            minMilitaryPower: 0.3,
        },
        applicableStages: ['grumbling', 'mobilizing', 'radicalizing', 'uprising'],
    },

    /**
     * 分化 (Divide)
     * 利用阶层矛盾瓦解联盟，但会激怒对立阶层
     */
    divide: {
        id: 'divide',
        name: '分化',
        icon: 'GitBranch',
        description: '挑起阶层矛盾，瓦解叛乱联盟',
        detailedDescription: '通过挑起阶层间的矛盾来瓦解叛乱联盟。这一策略会严重打击目标阶层的组织度，但作为代价，其对立阶层（如工人↔资本家、农民↔地主）会被激怒，组织度反而上升。适合在多个阶层同时不满时使用。',
        effectPreview: {
            targetOrganization: { value: -40, unit: '%', label: '目标阶层组织度', type: 'immediate' },
            rivalOrganization: { value: +20, unit: '%', label: '对立阶层组织度', type: 'immediate' },
            rivalApproval: { value: -10, unit: '点', label: '对立阶层满意度', type: 'immediate' },
        },
        sideEffects: [
            { text: '对立阶层组织度会上升', severity: 'warning', icon: 'TrendingUp' },
            { text: '对立阶层满意度降低', severity: 'warning', icon: 'ThumbsDown' },
        ],
        usageHint: '当多个阶层同时不满时，用于瓦解联盟、各个击破。需要有对立阶层存在。',
        applicableStagesNames: ['不满', '动员中', '激进化'],
        // 对立阶层说明（用于UI提示）
        rivalPairsHint: {
            peasant: '地主', serf: '地主', worker: '资本家', miner: '资本家',
            lumberjack: '地主', merchant: '官员', artisan: '商人', soldier: '官员',
            knight: '官员', landowner: '农民', capitalist: '工人',
        },
        cost: {
            culture: 200,
            silver: 500,
        },
        effects: {
            targetOrganization: -40,
            rivalOrganization: +20,
            rivalApproval: -10,
        },
        cooldown: 60,
        requirements: {
            hasRival: true,
        },
        applicableStages: ['grumbling', 'mobilizing', 'radicalizing'], // 从30%就可用
    },

    /**
     * 收买 (Bribe)
     * 用金钱换取暂时和平
     */
    bribe: {
        id: 'bribe',
        name: '收买',
        icon: 'Coins',
        description: '发放好处费安抚民心',
        detailedDescription: '向该阶层发放"好处费"来临时安抚民心。费用按人口计算（每人10银币）。效果立竿见影但不持久，且每次使用后成本会增加50%。适合作为短期救急方案。',
        effectPreview: {
            approval: { value: +15, unit: '点', label: '满意度', duration: '持续30天' },
            organizationPause: { value: 10, unit: '天', label: '组织度增长暂停', type: 'immediate' },
        },
        sideEffects: [
            { text: '每次使用后成本增加50%', severity: 'info', icon: 'TrendingUp' },
            { text: '效果仅持续30天', severity: 'info', icon: 'Clock' },
        ],
        usageHint: '短期救急方案，适合在等待长期措施生效期间使用。注意成本会逐次递增。',
        applicableStagesNames: ['不满', '动员中', '激进化'],
        // 成本计算说明
        costCalculationHint: '人口 × 10 银币（每次使用后成本 +50%）',
        cost: {
            silverPerPop: 10,
        },
        effects: {
            approval: +15,
            approvalDuration: 30,
            organizationPause: 10,
        },
        cooldown: 15,
        costMultiplier: 1.5,
        applicableStages: ['grumbling', 'mobilizing', 'radicalizing'],
    },

    /**
     * 承诺 (Promise)
     * 无消耗但有失败风险
     */
    promise: {
        id: 'promise',
        name: '承诺',
        icon: 'FileText',
        description: '做出改革承诺换取暂时和平',
        detailedDescription: '向该阶层做出改善处境的承诺，立即降低组织度20%。你需要在60天内将其满意度提升约10点，否则组织度将增加50%。',
        effectPreview: {
            organization: { value: -20, unit: '%', label: '组织度', type: 'immediate' },
            task: { label: '生成承诺任务', duration: '60天内完成', type: 'special' },
        },
        sideEffects: [
            { text: '需在60天内提升满意度约10点', severity: 'warning', icon: 'Target' },
            { text: '失败惩罚：组织度 +50%', severity: 'danger', icon: 'AlertOctagon' },
        ],
        usageHint: '无需资源的应急手段，但需要在60天内改善该阶层处境。可通过减税、增加供给等方式提升满意度。',
        applicableStagesNames: ['不满', '动员中', '激进化'],
        cost: null,
        effects: {
            organization: -20,
            generateTask: true,
        },
        failurePenalty: {
            organization: +50, // 组织度直接增加50%
            // forcedUprising 已移除，不再强制设为100%
        },
        cooldown: 90,
        applicableStages: ['grumbling', 'mobilizing', 'radicalizing'], // 从30%就可用
    },
};


// =========== 核心函数 ===========

/**
 * 检查策略行动是否可用
 * @param {string} actionId - 行动ID
 * @param {string} stratumKey - 目标阶层
 * @param {Object} gameState - 游戏状态
 * @returns {Object} { available: boolean, reason?: string }
 */
export function checkActionAvailability(actionId, stratumKey, gameState) {
    const action = STRATEGIC_ACTIONS[actionId];
    if (!action) {
        return { available: false, reason: '无效的行动' };
    }

    const {
        resources,
        organizationStates,
        actionCooldowns = {},
        population,
        popStructure,
        militaryPower,
    } = gameState;

    const orgState = organizationStates?.[stratumKey];
    if (!orgState) {
        return { available: false, reason: '无效的阶层' };
    }

    // 检查阶段是否适用
    if (action.applicableStages && !action.applicableStages.includes(orgState.stage)) {
        return { available: false, reason: `当前阶段不适用（需要：${action.applicableStages.join('/')}）` };
    }

    // 检查冷却时间
    const cooldownKey = `${actionId}_${stratumKey}`;
    const cooldownRemaining = actionCooldowns[cooldownKey] || 0;
    if (cooldownRemaining > 0) {
        return { available: false, reason: `冷却中（剩余${cooldownRemaining}天）` };
    }

    // 检查资源消耗
    if (action.cost) {
        if (action.cost.silver && (resources?.silver || 0) < action.cost.silver) {
            return { available: false, reason: `银币不足（需要${action.cost.silver}）` };
        }
        if (action.cost.culture && (resources?.culture || 0) < action.cost.culture) {
            return { available: false, reason: `文化点不足（需要${action.cost.culture}）` };
        }
        if (action.cost.silverPerPop) {
            const stratumPop = popStructure?.[stratumKey] || 0;
            const required = action.cost.silverPerPop * stratumPop;
            if ((resources?.silver || 0) < required) {
                return { available: false, reason: `银币不足（需要${required}）` };
            }
        }
    }

    // 检查特殊需求
    if (action.requirements) {
        if (action.requirements.minMilitaryPower &&
            (militaryPower || 0) < action.requirements.minMilitaryPower) {
            return { available: false, reason: '军事力量不足' };
        }
        if (action.requirements.hasRival) {
            const rival = getRivalStratum(stratumKey);
            if (!rival || !popStructure?.[rival]) {
                return { available: false, reason: '无对立阶层' };
            }
        }
    }

    return { available: true };
}

/**
 * 计算行动的实际消耗
 * @param {string} actionId - 行动ID
 * @param {string} stratumKey - 目标阶层
 * @param {Object} gameState - 游戏状态
 * @returns {Object} 消耗详情
 */
export function calculateActionCost(actionId, stratumKey, gameState) {
    const action = STRATEGIC_ACTIONS[actionId];
    if (!action || !action.cost) return {};

    const result = { ...action.cost };

    // 计算按人口的消耗
    if (action.cost.silverPerPop) {
        const stratumPop = gameState.popStructure?.[stratumKey] || 0;
        result.silver = action.cost.silverPerPop * stratumPop;
        delete result.silverPerPop;
    }

    // 应用成本增加（如果有使用次数记录）
    if (action.costMultiplier) {
        const usageCount = gameState.actionUsage?.[`${actionId}_${stratumKey}`] || 0;
        const multiplier = Math.pow(action.costMultiplier, usageCount);
        if (result.silver) result.silver = Math.ceil(result.silver * multiplier);
        if (result.culture) result.culture = Math.ceil(result.culture * multiplier);
    }

    return result;
}

/**
 * 执行策略行动
 * @param {string} actionId - 行动ID
 * @param {string} stratumKey - 目标阶层
 * @param {Object} gameState - 游戏状态
 * @returns {Object} 执行结果 { success, effects, message }
 */
export function executeStrategicAction(actionId, stratumKey, gameState) {
    const action = STRATEGIC_ACTIONS[actionId];
    if (!action) {
        return { success: false, message: '无效的行动' };
    }

    const availability = checkActionAvailability(actionId, stratumKey, gameState);
    if (!availability.available) {
        return { success: false, message: availability.reason };
    }

    const cost = calculateActionCost(actionId, stratumKey, gameState);
    const stratumName = STRATA[stratumKey]?.name || stratumKey;

    // 构建效果结果
    const result = {
        success: true,
        actionId,
        stratumKey,
        cost,
        effects: {
            resourceCost: cost,
            organizationChanges: {},
            approvalChanges: {},
            stabilityChange: 0,
            debuffs: action.debuffs || [],
            cooldown: action.cooldown,
            specialEffects: [],
        },
        message: '',
    };

    // 应用基本效果
    if (action.effects.organization) {
        result.effects.organizationChanges[stratumKey] = action.effects.organization;
    }

    if (action.effects.approval) {
        result.effects.approvalChanges[stratumKey] = {
            value: action.effects.approval,
            duration: action.effects.approvalDuration || 0,
        };
    }

    if (action.effects.stability) {
        result.effects.stabilityChange = action.effects.stability;
    }

    if (action.effects.organizationPause) {
        result.effects.specialEffects.push({
            type: 'organizationPause',
            stratum: stratumKey,
            duration: action.effects.organizationPause,
        });
    }

    // 分化行动的特殊处理
    if (actionId === 'divide') {
        const rivalStratum = getRivalStratum(stratumKey);
        if (rivalStratum) {
            result.effects.organizationChanges[rivalStratum] = action.effects.rivalOrganization;
            result.effects.approvalChanges[rivalStratum] = {
                value: action.effects.rivalApproval,
                duration: 0,
            };
            result.effects.specialEffects.push({
                type: 'divideEffect',
                target: stratumKey,
                rival: rivalStratum,
            });
        }
    }

    // 承诺行动的特殊处理
    if (actionId === 'promise' && action.effects.generateTask) {
        result.effects.specialEffects.push({
            type: 'promiseTask',
            stratum: stratumKey,
            deadline: 60, // 60天内完成，与promiseTasks.js保持一致
            failurePenalty: action.failurePenalty,
        });
    }

    // 军心惩罚
    if (action.militaryCost?.approvalPenalty) {
        Object.entries(action.militaryCost.approvalPenalty).forEach(([key, penalty]) => {
            if (!result.effects.approvalChanges[key]) {
                result.effects.approvalChanges[key] = { value: 0, duration: 0 };
            }
            result.effects.approvalChanges[key].value += penalty;
        });
    }

    result.message = `对${stratumName}执行了「${action.name}」`;

    return result;
}

/**
 * 获取策略行动的UI描述
 * @param {string} actionId - 行动ID
 * @param {string} stratumKey - 目标阶层
 * @param {Object} gameState - 游戏状态
 * @returns {Object} UI描述信息
 */
export function getActionDescription(actionId, stratumKey, gameState) {
    const action = STRATEGIC_ACTIONS[actionId];
    if (!action) return null;

    const availability = checkActionAvailability(actionId, stratumKey, gameState);
    const cost = calculateActionCost(actionId, stratumKey, gameState);

    return {
        id: action.id,
        name: action.name,
        icon: action.icon,
        description: action.description,
        // 新增：详细信息字段
        detailedDescription: action.detailedDescription,
        effectPreview: action.effectPreview,
        sideEffects: action.sideEffects,
        usageHint: action.usageHint,
        applicableStagesNames: action.applicableStagesNames,
        costCalculationHint: action.costCalculationHint,
        rivalPairsHint: action.rivalPairsHint,
        failurePenalty: action.failurePenalty,
        // 原有字段
        cost,
        effects: action.effects,
        cooldown: action.cooldown,
        available: availability.available,
        unavailableReason: availability.reason,
        debuffs: action.debuffs,
        applicableStages: action.applicableStages,
    };
}

/**
 * 获取所有可用策略行动
 * @param {string} stratumKey - 目标阶层
 * @param {Object} gameState - 游戏状态
 * @returns {Array} 行动列表
 */
export function getAvailableActions(stratumKey, gameState) {
    return Object.keys(STRATEGIC_ACTIONS).map(actionId =>
        getActionDescription(actionId, stratumKey, gameState)
    );
}

export default {
    STRATEGIC_ACTIONS,
    checkActionAvailability,
    calculateActionCost,
    executeStrategicAction,
    getActionDescription,
    getAvailableActions,
};
