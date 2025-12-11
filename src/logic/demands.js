/**
 * 动态诉求系统
 * 分析阶层不满来源，生成具体诉求，玩家需在限期内满足诉求否则受惩罚
 */

import { STRATA } from '../config/strata';
import { RESOURCES } from '../config';

// 获取资源的中文名称
function getResourceName(resourceKey) {
    return RESOURCES[resourceKey]?.name || resourceKey;
}

// 诉求类型枚举
export const DEMAND_TYPE = {
    TAX_RELIEF: 'tax_relief',       // 减税诉求
    SUBSIDY: 'subsidy',             // 补贴诉求
    RESOURCE: 'resource',           // 物资诉求
    POLITICAL: 'political',         // 政治诉求
};

// 被动诉求类型，用于展示叛乱驱动力
export const PASSIVE_DEMAND_TYPES = {
    TAX_PRESSURE: 'grievance_tax_pressure',
    BASIC_SHORTAGE: 'grievance_basic_shortage',
    LUXURY_SHORTAGE: 'grievance_luxury_shortage',
    INCOME_CRISIS: 'grievance_income_crisis',
    LIVING_STANDARD: 'grievance_living_standard',
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
    [PASSIVE_DEMAND_TYPES.TAX_PRESSURE]: {
        name: '税负抗议',
        icon: 'Percent',
        color: 'text-amber-300',
        bgColor: 'bg-amber-900/30',
        borderColor: 'border-amber-500/30',
        description: '阶层认为综合税负已不可承受',
        requirement: '将综合税负降至合理水平，否则组织度将持续攀升',
        failurePenalty: {
            description: '若持续无视，该阶层会组织抗税行动并提升组织度',
        },
        duration: 60,
    },
    [PASSIVE_DEMAND_TYPES.BASIC_SHORTAGE]: {
        name: '温饱危机',
        icon: 'Package',
        color: 'text-red-300',
        bgColor: 'bg-red-900/20',
        borderColor: 'border-red-500/30',
        description: '必需品缺货或买不起，民众要求政府干预',
        requirement: '补足必需品供应或降低其价格税负',
        failurePenalty: {
            description: '持续短缺会极大提升组织度，甚至触发叛乱',
        },
        duration: 45,
    },
    [PASSIVE_DEMAND_TYPES.LUXURY_SHORTAGE]: {
        name: '生活品质诉求',
        icon: 'Sparkles',
        color: 'text-blue-300',
        bgColor: 'bg-blue-900/20',
        borderColor: 'border-blue-500/30',
        description: '阶层要求改善奢侈品/品质消费供给',
        requirement: '提供至少几种奢侈品或文化消费渠道',
        failurePenalty: {
            description: '若一直无视，组织度将缓慢提升',
        },
        duration: 50,
    },
    [PASSIVE_DEMAND_TYPES.INCOME_CRISIS]: {
        name: '收入危机',
        icon: 'TrendingDown',
        color: 'text-rose-300',
        bgColor: 'bg-rose-900/30',
        borderColor: 'border-rose-500/30',
        description: '人均收入无法覆盖生活成本',
        requirement: '提高工资、补贴或削减支出以恢复民生',
        failurePenalty: {
            description: '长期收入不足将把组织度推向极端',
        },
        duration: 60,
    },
    [PASSIVE_DEMAND_TYPES.LIVING_STANDARD]: {
        name: '改善生活水平',
        icon: 'Activity',
        color: 'text-sky-300',
        bgColor: 'bg-sky-900/30',
        borderColor: 'border-sky-500/30',
        description: '该阶层厌倦了长久的赤贫/贫困生活，要求改善民生',
        requirement: '提高该阶层生活水平至温饱以上，或通过改革改善其收入与保障',
        failurePenalty: {
            description: '若持续无视，组织度会快速攀升并触发更激烈的抗议',
        },
        duration: 70,
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
    const stratum = STRATA[stratumKey];

    // classLivingStandard[key] 是一个对象，包含 satisfactionRate、wealthRatio 等属性
    const livingStandardData = context.classLivingStandard?.[stratumKey];
    // 提取满足率作为生活水平指标
    const livingStandard = typeof livingStandardData === 'object' && livingStandardData !== null
        ? (livingStandardData.satisfactionRate ?? 1)
        : (livingStandardData ?? 1);
    const influence = context.classInfluence?.[stratumKey] || 0;
    const totalInfluence = context.totalInfluence || 0;
    // 计算影响力占比，确保不会除以0
    const influenceShare = totalInfluence > 0 ? influence / totalInfluence : 0;

    // 获取收入和人口数据
    const income = context.classIncome?.[stratumKey] || 0;
    const count = context.popStructure?.[stratumKey] || 1;
    const incomePerCapita = income / Math.max(count, 1);

    // ========== 正确计算税负 ==========
    // 1. 人头税（数值）= 基础人头税 × 人头税倍率
    const headTaxBase = stratum?.headTaxBase ?? 0;
    const headTaxMultiplier = context.taxPolicies?.headTaxRates?.[stratumKey] ?? 1;
    const headTaxPerCapita = headTaxBase * headTaxMultiplier;

    // 2. 交易税（估算）= 消费资源 × 资源价格 × 交易税率
    let tradeTaxPerCapita = 0;
    const resourceTaxRates = context.taxPolicies?.resourceTaxRates || {};
    const market = context.market || {};
    const needs = stratum?.needs || {};
    for (const [resource, perCapita] of Object.entries(needs)) {
        if (perCapita > 0) {
            const taxRate = resourceTaxRates[resource] || 0;
            const price = market?.prices?.[resource] || RESOURCES[resource]?.basePrice || 1;
            tradeTaxPerCapita += perCapita * price * taxRate;
        }
    }

    // 3. 总税负 = 人头税 + 交易税
    const totalTaxPerCapita = headTaxPerCapita + tradeTaxPerCapita;

    // 4. 税负占收入的比例
    const taxBurdenRatio = incomePerCapita > 0 ? totalTaxPerCapita / incomePerCapita : 0;

    // 分析短缺原因
    const unaffordableItems = shortages.filter(s => s.reason === 'unaffordable');
    const outOfStockItems = shortages.filter(s => s.reason === 'outOfStock');

    // 税负过重判断：税负占收入超过30%
    const isTaxBurdenHigh = taxBurdenRatio > 0.3;

    if (isTaxBurdenHigh) {
        const contribution = Math.min(2, taxBurdenRatio * 3);
        const detailText = `税负占收入 ${Math.round(taxBurdenRatio * 100)}%（人头税: ${headTaxPerCapita.toFixed(1)}，交易税: ${tradeTaxPerCapita.toFixed(1)}）`;
        sources.push({
            type: 'tax',
            icon: 'Percent',
            label: '税负过重',
            detail: detailText,
            contribution,
            severity: taxBurdenRatio > 0.5 ? 'danger' : 'warning',
        });
    }
    // ========== 区分基础需求和奢侈需求短缺 ==========
    // 获取该阶层的基础需求列表
    const basicNeeds = stratum?.needs || {};
    const basicNeedsList = new Set(Object.keys(basicNeeds));

    // 将短缺分为基础需求短缺和奢侈需求短缺
    const basicUnaffordable = unaffordableItems.filter(s => basicNeedsList.has(s.resource));
    const luxuryUnaffordable = unaffordableItems.filter(s => !basicNeedsList.has(s.resource));
    const basicOutOfStock = outOfStockItems.filter(s => basicNeedsList.has(s.resource));
    const luxuryOutOfStock = outOfStockItems.filter(s => !basicNeedsList.has(s.resource));

    // 基础需求买不起 - 高权重
    if (basicUnaffordable.length > 0) {
        const contribution = Math.min(1.5, basicUnaffordable.length * 0.4);
        sources.push({
            type: 'unaffordable_basic',
            icon: 'DollarSign',
            label: '基本物资买不起',
            detail: `${basicUnaffordable.length}种必需品买不起`,
            contribution,
            severity: basicUnaffordable.length >= 2 ? 'danger' : 'warning',
            resources: basicUnaffordable.map(s => getResourceName(s.resource)),
        });
    }

    // 奢侈需求买不起 - 低权重（仅当有3种以上才算轻微不满）
    if (luxuryUnaffordable.length >= 3) {
        const contribution = Math.min(0.5, luxuryUnaffordable.length * 0.1);
        sources.push({
            type: 'unaffordable_luxury',
            icon: 'Sparkles',
            label: '奢侈品负担不起',
            detail: `${luxuryUnaffordable.length}种奢侈品买不起`,
            contribution,
            severity: 'info', // 信息级别，不是警告
            resources: luxuryUnaffordable.slice(0, 3).map(s => getResourceName(s.resource)),
        });
    }

    // 基础需求市场缺货 - 高权重
    if (basicOutOfStock.length > 0) {
        const contribution = Math.min(2, basicOutOfStock.length * 0.6);
        sources.push({
            type: 'outOfStock_basic',
            icon: 'Package',
            label: '必需品缺货',
            detail: `${basicOutOfStock.length}种必需品缺货`,
            contribution,
            severity: basicOutOfStock.length >= 2 ? 'danger' : 'warning',
            resources: basicOutOfStock.map(s => getResourceName(s.resource)),
        });
    }

    // 奢侈需求市场缺货 - 极低权重（仅当有4种以上才算轻微不满）
    if (luxuryOutOfStock.length >= 4) {
        const contribution = Math.min(0.3, luxuryOutOfStock.length * 0.05);
        sources.push({
            type: 'outOfStock_luxury',
            icon: 'ShoppingBag',
            label: '奢侈品缺货',
            detail: `${luxuryOutOfStock.length}种奢侈品缺货`,
            contribution,
            severity: 'info',
            resources: luxuryOutOfStock.slice(0, 3).map(s => getResourceName(s.resource)),
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
    // 调试：打印关键参数
    console.log(`[Demands] ${stratumKey}: influenceShare=${influenceShare.toFixed(3)}, approval=${approval}, totalInfluence=${totalInfluence}, influence=${influence}`);
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
