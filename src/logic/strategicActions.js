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
        description: '动用武力镇压叛乱组织，有效但会激化矛盾',
        cost: {
            silver: 300,
        },
        militaryCost: {
            // 军心动摇：军人和骑士满意度降低
            approvalPenalty: { soldier: -15, knight: -15 },
        },
        effects: {
            organization: -30,  // 组织度强制降低30%
            approval: -20,      // 满意度降低20
            stability: -5,      // 稳定性降低5%
        },
        debuffs: [{
            id: 'suppression_fatigue',
            name: '镇压疲惫',
            description: '军事力量 -20%',
            duration: 30,
            effects: { militaryPower: -0.20 },
        }],
        cooldown: 30, // 30天冷却
        requirements: {
            minMilitaryPower: 0.3, // 需要至少30%军事力量
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
        cost: {
            culture: 200,
            silver: 500,
        },
        effects: {
            targetOrganization: -40,  // 目标阶层组织度-40%
            rivalOrganization: +20,   // 对立阶层组织度+20%
            rivalApproval: -10,       // 对立阶层满意度-10
        },
        cooldown: 60, // 60天冷却
        requirements: {
            hasRival: true, // 必须有对立阶层
        },
        applicableStages: ['mobilizing', 'radicalizing'],
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
        cost: {
            silverPerPop: 10, // 银币 = 人口 × 10
        },
        effects: {
            approval: +15,          // 满意度+15（持续30天）
            approvalDuration: 30,   // 效果持续时间
            organizationPause: 10,  // 组织度停止增长10天
        },
        cooldown: 15, // 15天冷却
        costMultiplier: 1.5, // 每次使用后成本增加50%
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
        description: '做出改革承诺换取暂时和平，但需兑现',
        cost: null, // 无直接消耗
        effects: {
            organization: -20, // 组织度立即-20%
            generateTask: true, // 生成限时任务
        },
        failurePenalty: {
            organization: +50, // 失败后组织度直接+50%
            forcedUprising: true, // 强制进入起义状态
        },
        cooldown: 90, // 90天冷却
        applicableStages: ['mobilizing', 'radicalizing'],
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
            deadline: 30, // 30天内完成
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
        cost,
        effects: action.effects,
        cooldown: action.cooldown,
        available: availability.available,
        unavailableReason: availability.reason,
        debuffs: action.debuffs,
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
