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
        detailedDescription: '派遣军队强行镇压该阶层的叛乱组织。短期内可有效降低组织度，但会激化矛盾——军人和骑士阶层会因执行镇压任务而心生不满，持续的镇压还会导致军队陷入疲惫状态。注意：不能用于镇压军人或骑士阶层。',
        // 效果预览：用于UI展示预期效果
        effectPreview: {
            organization: { value: -30, unit: '%', label: '组织度', type: 'immediate' },
            approval: { value: -20, unit: '点', label: '满意度', type: 'immediate' },
            stability: { value: -10, unit: '%', label: '稳定度', type: 'immediate' },
            population: { value: -5, unit: '%', label: '人口损失', type: 'immediate' },
        },
        // 副作用列表：用于UI展示负面影响警告
        sideEffects: [
            { text: '军人、骑士满意度 -15', severity: 'warning', icon: 'Users' },
            { text: '其他阶层满意度 -5', severity: 'warning', icon: 'Users' },
            { text: '获得「镇压疲惫」：军事力量 -20%，持续30天', severity: 'danger', icon: 'AlertTriangle' },
            { text: '获得「恐怖氛围」：生产效率 -15%，持续20天', severity: 'danger', icon: 'AlertOctagon' },
            { text: '该阶层人口损失约5%', severity: 'danger', icon: 'Skull' },
        ],
        // 使用建议
        usageHint: '当组织度接近爆发(90%+)时的紧急措施，用时间换空间。不能用于军人/骑士。不宜频繁使用。',
        // 适用阶段的中文名称
        applicableStagesNames: ['动员中', '激进化', '起义'],
        // 禁止镇压的阶层（军事阶层不能被镇压）
        forbiddenStrata: ['soldier', 'knight'],
        // 原有配置
        cost: {
            silver: 300,
        },
        militaryCost: {
            approvalPenalty: { soldier: -15, knight: -15 },
        },
        // 镇压还会导致其他阶层不满
        otherStrataApprovalPenalty: -5,
        effects: {
            organization: -30,
            approval: -20,
            stability: -10,
            populationLoss: 0.05, // 5%人口损失
        },
        debuffs: [
            {
                id: 'suppression_fatigue',
                name: '镇压疲惫',
                description: '军事力量 -20%',
                duration: 30,
                effects: { militaryPower: -0.20 },
            },
            {
                id: 'terror_atmosphere',
                name: '恐怖氛围',
                description: '全局生产效率 -15%',
                duration: 20,
                effects: { production: -0.15 },
            },
        ],
        cooldown: 30,
        requirements: {
            minMilitaryPower: 0.3,
        },
        applicableStages: ['mobilizing', 'radicalizing', 'uprising'],
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
            organizationPause: { value: 180, unit: '天', label: '组织度增长暂停', type: 'immediate' },
        },
        sideEffects: [
            { text: '每次使用后成本增加50%', severity: 'info', icon: 'TrendingUp' },
            { text: '满意度效果仅持续30天，但组织度暂停180天', severity: 'info', icon: 'Clock' },
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
            organizationPause: 180,
        },
        cooldown: 15,
        costMultiplier: 1.5,
        applicableStages: ['grumbling', 'mobilizing', 'radicalizing'],
    },

    /**
     * 承诺 (Promise)
     * 无消耗但有失败风险，支持8种类型
     */
    promise: {
        id: 'promise',
        name: '承诺',
        icon: 'FileText',
        description: '做出改革承诺换取暂时和平',
        detailedDescription: '向该阶层做出改善处境的承诺，立即降低组织度20%。系统会根据阶层需求智能选择承诺类型（如减税、降低物价、提高收入、宣战等）。你需要在规定期限内达成目标并保持一段时间，否则组织度将增加50%。',
        effectPreview: {
            organization: { value: -20, unit: '%', label: '组织度', type: 'immediate' },
            task: { label: '生成承诺任务', duration: '根据类型30-180天', type: 'special' },
        },
        sideEffects: [
            { text: '承诺类型根据阶层情况自动选择', severity: 'info', icon: 'Zap' },
            { text: '需在期限内达成目标并保持', severity: 'warning', icon: 'Target' },
            { text: '失败惩罚：组织度 +50%，可能触发起义', severity: 'danger', icon: 'AlertOctagon' },
        ],
        usageHint: '无需资源的应急手段。承诺类型包括：减税(360天保持)、降价、涨价、满意度、生活水平、宣战、贸易路线、财富提升。',
        applicableStagesNames: ['不满', '动员中', '激进化'],
        cost: null,
        effects: {
            organization: -20,
            generateTask: true,
        },
        failurePenalty: {
            organization: +50,
        },
        cooldown: 90,
        applicableStages: ['grumbling', 'mobilizing', 'radicalizing'],
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
        const stageNames = action.applicableStagesNames?.join('/') || action.applicableStages.join('/');
        return { available: false, reason: `当前阶段不适用（需要：${stageNames}）` };
    }

    if (actionId === 'crackdown') {
        const hasActiveRebel = (gameState.nations || []).some(
            nation => nation?.isRebelNation && nation.rebellionStratum === stratumKey && nation.isAtWar
        );
        if (hasActiveRebel) {
            return { available: false, reason: '叛乱政府已成立，只能通过战争解决' };
        }
    }

    // 检查是否为禁止使用该行动的阶层（如军事阶层不能被镇压）
    if (action.forbiddenStrata && action.forbiddenStrata.includes(stratumKey)) {
        return { available: false, reason: '该阶层不可使用此行动' };
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

    // 计算抵抗力影响
    const orgState = gameState.organizationStates?.[stratumKey] || {};
    const resistance = orgState.resistance || 0;
    // 抵抗力每1点降低1%的效果，最低保留20%效果
    const effectiveness = Math.max(0.2, 1 - (resistance / 100));

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
            resistanceChange: 15, // 每次行动增加15点抵抗力
        },
        message: '',
    };

    // 应用基本效果（受抵抗力影响）
    if (action.effects.organization) {
        // 只有降低组织度的效果受抵抗力削弱，增加的不受影响（如副作用）
        const val = action.effects.organization;
        const actualVal = val < 0 ? Math.ceil(val * effectiveness) : val;
        result.effects.organizationChanges[stratumKey] = actualVal;
    }

    if (action.effects.approval) {
        // 提升满意度的效果也受抵抗力削弱
        const val = action.effects.approval;
        const actualVal = val > 0 ? Math.floor(val * effectiveness) : val;

        result.effects.approvalChanges[stratumKey] = {
            value: actualVal,
            duration: action.effects.approvalDuration || 0,
        };
    }

    if (action.effects.stability) {
        result.effects.stabilityChange = action.effects.stability;
    }

    if (action.effects.organizationPause) {
        // 暂停时间也受抵抗力影响
        const actualDuration = Math.ceil(action.effects.organizationPause * effectiveness);
        result.effects.specialEffects.push({
            type: 'organizationPause',
            stratum: stratumKey,
            duration: actualDuration,
        });
    }

    // 分化行动的特殊处理
    if (actionId === 'divide') {
        const rivalStratum = getRivalStratum(stratumKey);
        if (rivalStratum) {
            // 对立阶层的效果不受目标阶层抵抗力影响（或许应该受对立阶层抵抗力影响？暂时忽略）
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
        // 承诺行动抵抗力增加较少
        result.effects.resistanceChange = 10;
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

    result.message = `对${stratumName}执行了「${action.name}」` +
        (resistance > 0 ? ` (抵抗力${resistance.toFixed(0)}%: 效果降低${((1 - effectiveness) * 100).toFixed(0)}%)` : '');

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
