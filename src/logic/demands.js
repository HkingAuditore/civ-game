/**
 * 动态诉求系统
 * 分析阶层不满来源，生成具体诉求，玩家需在限期内满足诉求否则受惩罚
 */

import { STRATA } from '../config/strata';

// 诉求类型枚举
export const DEMAND_TYPE = {
    TAX_RELIEF: 'tax_relief',       // 减税诉求
    SUBSIDY: 'subsidy',             // 补贴诉求
    RESOURCE: 'resource',           // 物资诉求
    POLITICAL: 'political',         // 政治诉求
};

// 诉求配置
export const DEMAND_CONFIG = {
    [DEMAND_TYPE.TAX_RELIEF]: {
        name: '减税请愿',
        icon: 'Percent',
        color: 'text-yellow-400',
        bgColor: 'bg-yellow-900/20',
        borderColor: 'border-yellow-500/30',
        description: '民众请求降低税负',
        requirement: '将税率系数降至100%以下，并保持10天',
        failurePenalty: {
            organization: 15,
            effect: '该阶层开始抗税',
            description: '组织度 +15%，税收效率降低',
        },
        duration: 30, // 默认持续30天
    },
    [DEMAND_TYPE.SUBSIDY]: {
        name: '生存补贴请求',
        icon: 'Heart',
        color: 'text-pink-400',
        bgColor: 'bg-pink-900/20',
        borderColor: 'border-pink-500/30',
        description: '民众无力维持基本生存',
        requirement: '发放生存补贴（每人5银币）',
        failurePenalty: {
            organization: 10,
            effect: '民众陷入绝望',
            description: '组织度 +10%',
        },
        duration: 20,
    },
    [DEMAND_TYPE.RESOURCE]: {
        name: '物资诉求',
        icon: 'Package',
        color: 'text-orange-400',
        bgColor: 'bg-orange-900/20',
        borderColor: 'border-orange-500/30',
        description: '市场缺货导致生活困难',
        requirement: '确保市场库存满足该阶层30天消耗',
        failurePenalty: {
            organization: 20,
            effect: '触发抢劫仓库事件',
            description: '组织度 +20%，可能损失物资',
        },
        duration: 30,
    },
    [DEMAND_TYPE.POLITICAL]: {
        name: '政治诉求',
        icon: 'Flag',
        color: 'text-purple-400',
        bgColor: 'bg-purple-900/20',
        borderColor: 'border-purple-500/30',
        description: '阶层要求更多话语权',
        requirement: '颁布有利于该阶层的政令',
        failurePenalty: {
            organization: 25,
            effect: '政治动荡',
            description: '组织度 +25%，稳定度下降',
        },
        duration: 45,
    },
};

/**
 * 分析阶层不满来源
 * @param {string} stratumKey - 阶层键
 * @param {Object} context - 游戏上下文
 * @returns {Object} 不满来源分析结果
 */
export function analyzeDissatisfactionSources(stratumKey, context) {
    const sources = [];
    const shortages = context.classShortages?.[stratumKey] || [];
    const approval = context.classApproval?.[stratumKey] ?? 50;
    const taxMultiplier = context.taxPolicies?.[stratumKey]?.multiplier ?? 1;
    const livingStandard = context.classLivingStandard?.[stratumKey] ?? 1;
    const influence = context.classInfluence?.[stratumKey] || 0;
    const totalInfluence = context.totalInfluence || 1;
    const influenceShare = influence / totalInfluence;

    // 分析短缺原因
    const unaffordableItems = shortages.filter(s => s.reason === 'unaffordable');
    const outOfStockItems = shortages.filter(s => s.reason === 'outOfStock');

    // 税负过重
    if (taxMultiplier > 1.2) {
        const contribution = Math.min(2, (taxMultiplier - 1) * 3);
        sources.push({
            type: 'tax',
            icon: 'Percent',
            label: '税负过重',
            detail: `税率 ${Math.round(taxMultiplier * 100)}%`,
            contribution,
            severity: taxMultiplier > 1.5 ? 'danger' : 'warning',
        });
    }

    // 买不起物资
    if (unaffordableItems.length > 0) {
        const contribution = Math.min(1.5, unaffordableItems.length * 0.3);
        sources.push({
            type: 'unaffordable',
            icon: 'DollarSign',
            label: '财力不足',
            detail: `${unaffordableItems.length}种物资买不起`,
            contribution,
            severity: unaffordableItems.length >= 3 ? 'danger' : 'warning',
            resources: unaffordableItems.map(s => s.resource),
        });
    }

    // 市场缺货
    if (outOfStockItems.length > 0) {
        const contribution = Math.min(2, outOfStockItems.length * 0.5);
        sources.push({
            type: 'outOfStock',
            icon: 'Package',
            label: '市场缺货',
            detail: `${outOfStockItems.length}种物资短缺`,
            contribution,
            severity: outOfStockItems.length >= 2 ? 'danger' : 'warning',
            resources: outOfStockItems.map(s => s.resource),
        });
    }

    // 生活水平下降
    if (livingStandard < 0.7) {
        const contribution = Math.min(1, (1 - livingStandard) * 1.5);
        sources.push({
            type: 'livingStandard',
            icon: 'TrendingDown',
            label: '生活水平下降',
            detail: `当前 ${Math.round(livingStandard * 100)}%`,
            contribution,
            severity: livingStandard < 0.5 ? 'danger' : 'warning',
        });
    }

    // 高影响力但低满意度（政治诉求）
    if (influenceShare > 0.1 && approval < 40) {
        const contribution = Math.min(1, influenceShare * 2);
        sources.push({
            type: 'political',
            icon: 'Flag',
            label: '政治诉求',
            detail: `影响力 ${Math.round(influenceShare * 100)}%，满意度仅 ${Math.round(approval)}`,
            contribution,
            severity: 'warning',
        });
    }

    // 按贡献度排序
    sources.sort((a, b) => b.contribution - a.contribution);

    return {
        sources,
        totalContribution: sources.reduce((sum, s) => sum + s.contribution, 0),
        hasIssues: sources.length > 0,
    };
}

/**
 * 生成诉求
 * @param {string} stratumKey - 阶层键
 * @param {Object} context - 游戏上下文
 * @returns {Array} 诉求列表
 */
export function generateDemands(stratumKey, context) {
    const demands = [];
    const currentDay = context.daysElapsed || 0;
    const analysis = analyzeDissatisfactionSources(stratumKey, context);
    const shortages = context.classShortages?.[stratumKey] || [];
    const taxMultiplier = context.taxPolicies?.[stratumKey]?.multiplier ?? 1;
    const stratumName = STRATA[stratumKey]?.name || stratumKey;

    // 检查是否已有该类型的诉求
    const existingDemands = context.activeDemands?.[stratumKey] || [];
    const hasDemandType = (type) => existingDemands.some(d => d.type === type);

    // 税率过高导致买不起 -> 减税诉求
    const unaffordableCount = shortages.filter(s => s.reason === 'unaffordable').length;
    if (unaffordableCount > 0 && taxMultiplier > 1 && !hasDemandType(DEMAND_TYPE.TAX_RELIEF)) {
        const config = DEMAND_CONFIG[DEMAND_TYPE.TAX_RELIEF];
        demands.push({
            id: `demand_${stratumKey}_taxrelief_${currentDay}`,
            type: DEMAND_TYPE.TAX_RELIEF,
            stratumKey,
            stratumName,
            createdDay: currentDay,
            deadline: currentDay + config.duration,
            targetTaxMultiplier: 1.0,
            daysRequired: 10,
            daysMet: 0,
            ...config,
        });
    }

    // 市场缺货 -> 物资诉求
    const outOfStockItems = shortages.filter(s => s.reason === 'outOfStock');
    if (outOfStockItems.length > 0 && !hasDemandType(DEMAND_TYPE.RESOURCE)) {
        const config = DEMAND_CONFIG[DEMAND_TYPE.RESOURCE];
        demands.push({
            id: `demand_${stratumKey}_resource_${currentDay}`,
            type: DEMAND_TYPE.RESOURCE,
            stratumKey,
            stratumName,
            createdDay: currentDay,
            deadline: currentDay + config.duration,
            missingResources: outOfStockItems.map(s => s.resource),
            ...config,
        });
    }

    // 零税率仍买不起生存物资 -> 补贴诉求
    if (unaffordableCount > 0 && taxMultiplier <= 1 && !hasDemandType(DEMAND_TYPE.SUBSIDY)) {
        const config = DEMAND_CONFIG[DEMAND_TYPE.SUBSIDY];
        demands.push({
            id: `demand_${stratumKey}_subsidy_${currentDay}`,
            type: DEMAND_TYPE.SUBSIDY,
            stratumKey,
            stratumName,
            createdDay: currentDay,
            deadline: currentDay + config.duration,
            subsidyPerPop: 5,
            ...config,
        });
    }

    // 高影响力低满意度 -> 政治诉求
    const influence = context.classInfluence?.[stratumKey] || 0;
    const totalInfluence = context.totalInfluence || 1;
    const influenceShare = influence / totalInfluence;
    const approval = context.classApproval?.[stratumKey] ?? 50;

    if (influenceShare > 0.15 && approval < 35 && !hasDemandType(DEMAND_TYPE.POLITICAL)) {
        const config = DEMAND_CONFIG[DEMAND_TYPE.POLITICAL];
        demands.push({
            id: `demand_${stratumKey}_political_${currentDay}`,
            type: DEMAND_TYPE.POLITICAL,
            stratumKey,
            stratumName,
            createdDay: currentDay,
            deadline: currentDay + config.duration,
            ...config,
        });
    }

    return demands;
}

/**
 * 检查诉求是否已满足
 * @param {Object} demand - 诉求对象
 * @param {Object} context - 游戏上下文
 * @returns {Object} { fulfilled: boolean, progress: number }
 */
export function checkDemandFulfillment(demand, context) {
    const { type, stratumKey } = demand;

    switch (type) {
        case DEMAND_TYPE.TAX_RELIEF: {
            const taxMultiplier = context.taxPolicies?.[stratumKey]?.multiplier ?? 1;
            const isMet = taxMultiplier <= (demand.targetTaxMultiplier || 1);
            const daysMet = isMet ? (demand.daysMet || 0) + 1 : 0;
            const daysRequired = demand.daysRequired || 10;
            return {
                fulfilled: daysMet >= daysRequired,
                progress: Math.min(1, daysMet / daysRequired),
                currentValue: taxMultiplier,
                targetValue: demand.targetTaxMultiplier || 1,
                daysMet,
            };
        }

        case DEMAND_TYPE.RESOURCE: {
            const missingResources = demand.missingResources || [];
            const shortages = context.classShortages?.[stratumKey] || [];
            const stillMissing = missingResources.filter(r => 
                shortages.some(s => s.resource === r && s.reason === 'outOfStock')
            );
            return {
                fulfilled: stillMissing.length === 0,
                progress: 1 - (stillMissing.length / Math.max(1, missingResources.length)),
                stillMissing,
            };
        }

        case DEMAND_TYPE.SUBSIDY: {
            // 补贴诉求需要玩家主动执行补贴行动
            // 这里简化处理：如果该阶层满意度提升到50以上，视为满足
            const approval = context.classApproval?.[stratumKey] ?? 0;
            return {
                fulfilled: approval >= 50,
                progress: Math.min(1, approval / 50),
                currentApproval: approval,
            };
        }

        case DEMAND_TYPE.POLITICAL: {
            // 政治诉求需要特定政令或满意度达标
            const approval = context.classApproval?.[stratumKey] ?? 0;
            return {
                fulfilled: approval >= 55,
                progress: Math.min(1, approval / 55),
                currentApproval: approval,
            };
        }

        default:
            return { fulfilled: false, progress: 0 };
    }
}

/**
 * 评估所有诉求状态
 * @param {Object} activeDemands - 各阶层的活跃诉求 { [stratumKey]: [demands] }
 * @param {Object} context - 游戏上下文
 * @returns {Object} { completed, failed, remaining, updated }
 */
export function evaluateDemands(activeDemands, context) {
    const currentDay = context.daysElapsed || 0;
    const completed = [];
    const failed = [];
    const remaining = {};

    Object.entries(activeDemands || {}).forEach(([stratumKey, demands]) => {
        if (!Array.isArray(demands)) return;

        const stratumRemaining = [];

        demands.forEach(demand => {
            // 检查是否过期
            if (currentDay >= demand.deadline) {
                const result = checkDemandFulfillment(demand, context);
                if (result.fulfilled) {
                    completed.push({ ...demand, result });
                } else {
                    failed.push({ ...demand, result });
                }
                return;
            }

            // 检查是否提前完成
            const result = checkDemandFulfillment(demand, context);
            if (result.fulfilled) {
                completed.push({ ...demand, result });
                return;
            }

            // 更新进度后保留
            stratumRemaining.push({
                ...demand,
                currentProgress: result.progress,
                // 更新特定类型的状态
                ...(demand.type === DEMAND_TYPE.TAX_RELIEF ? { daysMet: result.daysMet } : {}),
            });
        });

        if (stratumRemaining.length > 0) {
            remaining[stratumKey] = stratumRemaining;
        }
    });

    return { completed, failed, remaining };
}

/**
 * 计算诉求剩余天数
 * @param {Object} demand - 诉求对象
 * @param {number} currentDay - 当前天数
 * @returns {number} 剩余天数
 */
export function getDemandRemainingDays(demand, currentDay) {
    if (!demand) return 0;
    return Math.max(0, (demand.deadline || 0) - currentDay);
}

export default {
    DEMAND_TYPE,
    DEMAND_CONFIG,
    analyzeDissatisfactionSources,
    generateDemands,
    checkDemandFulfillment,
    evaluateDemands,
    getDemandRemainingDays,
};
