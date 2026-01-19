// 承诺任务系统
// 用于生成和评估"承诺(Promise)"策略产生的限时任务
// 支持8种承诺类型和两阶段机制（达成期限 + 保持期限）

import { STRATA } from '../config/strata';
import { RESOURCES } from '../config';
import { isResourceUnlocked } from '../utils/resources';

// 获取资源的中文名称
function getResourceName(resourceKey) {
    return RESOURCES[resourceKey]?.name || resourceKey;
}

// =========== 承诺类型定义 ===========
export const PROMISE_TASK_TYPES = {
    DECLARE_WAR: 'declare_war',           // 对指定国家宣战
    ESTABLISH_TRADE: 'establish_trade',   // 建立资源贸易路线
    TAX_RELIEF: 'tax_relief',             // 降低税负
    LOWER_PRICE: 'lower_price',           // 降低物价
    RAISE_PRICE: 'raise_price',           // 提高物价
    WEALTH_BOOST: 'wealth_boost',         // 提升阶层财富
    LIVING_STANDARD: 'living_standard',   // 提升生活水平/满足率
    APPROVAL: 'approval',                 // 提升满意度
};

// 承诺类型配置
export const PROMISE_CONFIG = {
    [PROMISE_TASK_TYPES.DECLARE_WAR]: {
        name: '宣战承诺',
        icon: 'Swords',
        achieveDeadline: 180, // 半年内宣战
        maintainDuration: 0, // 一次性任务
        description: (task) => `对 ${task.targetNationName || '指定国家'} 宣战`,
    },
    [PROMISE_TASK_TYPES.ESTABLISH_TRADE]: {
        name: '贸易路线承诺',
        icon: 'Ship',
        achieveDeadline: 180, // 半年内建立
        maintainDuration: 0,
        description: (task) => `建立 ${getResourceName(task.targetResource)} 的贸易路线`,
    },
    [PROMISE_TASK_TYPES.TAX_RELIEF]: {
        name: '减税承诺',
        icon: 'Percent',
        achieveDeadline: 180, // 半年内降税
        maintainDuration: 360, // 保持1年
        description: (task) => `将税负降至原来的 ${Math.round((task.targetTaxRatio || 0.5) * 100)}%，并保持1年`,
    },
    [PROMISE_TASK_TYPES.LOWER_PRICE]: {
        name: '物价承诺',
        icon: 'TrendingDown',
        achieveDeadline: 180, // 半年内降价
        maintainDuration: 180,
        description: (task) => `将 ${getResourceName(task.targetResource)} 价格降至 ${task.targetPrice?.toFixed(2) || '目标值'}`,
    },
    [PROMISE_TASK_TYPES.RAISE_PRICE]: {
        name: '涨价承诺',
        icon: 'TrendingUp',
        achieveDeadline: 180, // 半年内涨价
        maintainDuration: 180,
        description: (task) => `将 ${getResourceName(task.targetResource)} 价格提升至 ${task.targetPrice?.toFixed(2) || '目标值'}`,
    },
    [PROMISE_TASK_TYPES.WEALTH_BOOST]: {
        name: '财富承诺',
        icon: 'Coins',
        achieveDeadline: 360, // 1年内提升财富（更长因为难度较大）
        maintainDuration: 0,
        description: (task) => `将阶层财富提升 ${Math.round((task.targetWealthIncrease || 0.2) * 100)}%`,
    },
    [PROMISE_TASK_TYPES.LIVING_STANDARD]: {
        name: '生活水平承诺',
        icon: 'Heart',
        achieveDeadline: 180, // 半年内提升
        maintainDuration: 180,
        description: (task) => `将满足率提升至 ${Math.round((task.targetSatisfaction || 0.7) * 100)}%`,
    },
    [PROMISE_TASK_TYPES.APPROVAL]: {
        name: '满意度承诺',
        icon: 'ThumbsUp',
        achieveDeadline: 180, // 半年内提升
        maintainDuration: 180,
        description: (task) => `将满意度提升至 ${task.targetApproval || 60}%`,
    },
};

// 任务阶段
export const TASK_PHASE = {
    ACHIEVING: 'achieving',   // 达成阶段
    MAINTAINING: 'maintaining', // 保持阶段
    COMPLETED: 'completed',   // 已完成
    FAILED: 'failed',         // 已失败
};

// =========== 智能选择逻辑 ===========

/**
 * 根据阶层和游戏状态智能选择承诺类型
 */
export function selectPromiseType(stratumKey, context) {
    const candidates = [];
    const { nations, taxPolicies, market, classWealth, needsReport, tradeRoutes } = context || {};

    // 1. 军事阶层：检查战争需求
    if (['soldier'].includes(stratumKey)) {
        const rivals = (nations || []).filter(n => (n.relation || 50) < 30 && !n.isAtWar);
        if (rivals.length > 0) {
            candidates.push({
                type: PROMISE_TASK_TYPES.DECLARE_WAR,
                weight: 3,
                params: { targetNation: rivals[0], targetNationName: rivals[0].name }
            });
        }
    }

    // 2. 商业阶层：检查贸易需求
    if (['merchant', 'navigator'].includes(stratumKey)) {
        const shortage = findShortageResource(stratumKey, context);
        if (shortage) {
            candidates.push({
                type: PROMISE_TASK_TYPES.ESTABLISH_TRADE,
                weight: 3,
                params: { targetResource: shortage }
            });
        }
    }

    // 3. 所有阶层：税负过高（税收占收入>30%）
    const taxBurden = calculateTaxBurden(stratumKey, context);
    if (taxBurden > 0.3) {
        const targetRatio = 0.2 + Math.random() * 0.4; // 20%~60%
        candidates.push({
            type: PROMISE_TASK_TYPES.TAX_RELIEF,
            weight: 4,
            params: {
                currentTaxBurden: taxBurden,
                targetTaxRatio: targetRatio
            }
        });
    }

    // 4. 所有阶层：消费物价太高
    const expensiveNeed = findExpensiveNeed(stratumKey, context);
    if (expensiveNeed) {
        const currentPrice = market?.prices?.[expensiveNeed.resource] || 1;
        const targetPrice = currentPrice * (0.5 + Math.random() * 0.3); // 降到50%~80%
        candidates.push({
            type: PROMISE_TASK_TYPES.LOWER_PRICE,
            weight: 3,
            params: {
                targetResource: expensiveNeed.resource,
                targetPrice,
                currentPrice
            }
        });
    }

    // 5. 生产者阶层：产品价格太低
    const product = getStratumProduct(stratumKey);
    if (product) {
        const currentPrice = market?.prices?.[product] || 1;
        const basePrice = market?.basePrices?.[product] || 1;
        if (currentPrice < basePrice * 0.8) {
            const targetPrice = basePrice * (1.0 + Math.random() * 0.3); // 提到100%~130%基准价
            candidates.push({
                type: PROMISE_TASK_TYPES.RAISE_PRICE,
                weight: 2,
                params: {
                    targetResource: product,
                    targetPrice,
                    currentPrice
                }
            });
        }
    }

    // 6. 财富低于平均
    const avgWealth = calculateAvgWealth(context);
    const stratumWealth = classWealth?.[stratumKey] || 0;
    if (stratumWealth < avgWealth * 0.5) {
        candidates.push({
            type: PROMISE_TASK_TYPES.WEALTH_BOOST,
            weight: 2,
            params: {
                currentWealth: stratumWealth,
                targetWealthIncrease: 0.2 + Math.random() * 0.3 // 提升20%~50%
            }
        });
    }

    // 7. 满足率低
    const satisfactionRatio = needsReport?.[stratumKey]?.satisfactionRatio || 1;
    if (satisfactionRatio < 0.6) {
        candidates.push({
            type: PROMISE_TASK_TYPES.LIVING_STANDARD,
            weight: 3,
            params: {
                currentSatisfaction: satisfactionRatio,
                targetSatisfaction: Math.min(0.9, satisfactionRatio + 0.2)
            }
        });
    }

    // 8. 默认：满意度承诺
    const currentApproval = context.classApproval?.[stratumKey] || 50;
    candidates.push({
        type: PROMISE_TASK_TYPES.APPROVAL,
        weight: 1,
        params: {
            currentApproval,
            targetApproval: Math.min(80, Math.max(50, Math.round(currentApproval + 10)))
        }
    });

    // 加权随机选择
    return pickWeighted(candidates);
}

// =========== 辅助函数 ===========

function findShortageResource(stratumKey, context) {
    const { epoch = 0, techsUnlocked = [] } = context || {};

    // 优先从 classShortages 中获取实际短缺资源
    const shortages = context?.classShortages?.[stratumKey] || [];

    // 优先返回买不起的且已解锁的资源
    const unaffordable = shortages.find(s =>
        s.reason === 'unaffordable' && isResourceUnlocked(s.resource, epoch, techsUnlocked)
    );
    if (unaffordable) {
        return unaffordable.resource;
    }

    // 其次返回缺货的且已解锁的资源
    const outOfStock = shortages.find(s =>
        s.reason === 'outOfStock' && isResourceUnlocked(s.resource, epoch, techsUnlocked)
    );
    if (outOfStock) {
        return outOfStock.resource;
    }

    // 兼容旧的 needsReport 格式
    const { needsReport } = context || {};
    const needs = needsReport?.[stratumKey]?.details || [];
    for (const need of needs) {
        if (need.shortage && need.shortage > 0 && isResourceUnlocked(need.resource, epoch, techsUnlocked)) {
            return need.resource;
        }
    }
    return null;
}

function calculateTaxBurden(stratumKey, context) {
    const { classIncome, taxPolicies } = context || {};
    const income = classIncome?.[stratumKey] || 1;
    const stratum = STRATA[stratumKey];

    // 1. 计算人头税
    const headTaxBase = stratum?.headTaxBase ?? 0;
    const headTaxRate = taxPolicies?.headTaxRates?.[stratumKey] ?? 1;
    const headTaxPerCapita = headTaxBase * headTaxRate;

    // 2. 估算交易税（基于阶层消费的资源类型）
    let tradeTaxEstimate = 0;
    const resourceTaxRates = taxPolicies?.resourceTaxRates || {};
    const needs = stratum?.needs || {};
    for (const [resource, perCapita] of Object.entries(needs)) {
        if (perCapita > 0) {
            const taxRate = resourceTaxRates[resource] || 0;
            // 假设基础价格为1，粗略估算交易税
            tradeTaxEstimate += perCapita * taxRate;
        }
    }

    // 3. 总税负 = 人头税 + 交易税
    const totalTaxPerCapita = headTaxPerCapita + tradeTaxEstimate;

    // 4. 计算税负占收入的比例（使用人均收入）
    const count = context?.popStructure?.[stratumKey] || 1;
    const incomePerCapita = income / Math.max(count, 1);

    if (incomePerCapita <= 0) {
        return totalTaxPerCapita > 0 ? 1 : 0;
    }

    return Math.min(1, totalTaxPerCapita / incomePerCapita);
}

function findExpensiveNeed(stratumKey, context) {
    const { market, classShortages, epoch = 0, techsUnlocked = [] } = context || {};
    const prices = market?.prices || {};
    const basePrices = market?.basePrices || {};

    const getPriceInfo = (resource) => {
        const price = prices[resource] || 1;
        const basePrice = basePrices[resource] || 1;
        const ratio = price / basePrice;
        return { resource, price, basePrice, ratio };
    };

    // 1. 优先查找 classShortages 中买不起的且已解锁的资源，并按价格涨幅排序
    const shortages = classShortages?.[stratumKey] || [];
    const unaffordableList = shortages
        .filter(s => s.reason === 'unaffordable' && isResourceUnlocked(s.resource, epoch, techsUnlocked))
        .map(s => getPriceInfo(s.resource))
        .sort((a, b) => b.ratio - a.ratio); // 降序排列，取涨幅最大的

    if (unaffordableList.length > 0) {
        return unaffordableList[0];
    }

    // 2. 其次检查价格偏高的需求资源（包括基础需求和奢侈需求）
    const stratum = STRATA[stratumKey];
    if (!stratum?.needs) return null;

    const candidates = [];
    const resultCache = new Set(); // 避免重复添加

    // 检查基础需求（只检查已解锁的资源）
    Object.keys(stratum.needs).forEach(resource => {
        if (resultCache.has(resource)) return;
        if (!isResourceUnlocked(resource, epoch, techsUnlocked)) return;

        const info = getPriceInfo(resource);
        if (info.price > info.basePrice * 1.3) {
            candidates.push(info);
            resultCache.add(resource);
        }
    });

    // 检查奢侈需求（只检查已解锁的资源）
    if (stratum.luxuryNeeds) {
        Object.values(stratum.luxuryNeeds).forEach(needGroup => {
            if (!needGroup) return;
            Object.keys(needGroup).forEach(resource => {
                if (resultCache.has(resource)) return;
                if (!isResourceUnlocked(resource, epoch, techsUnlocked)) return;

                const info = getPriceInfo(resource);
                if (info.price > info.basePrice * 1.3) {
                    candidates.push(info);
                    resultCache.add(resource);
                }
            });
        });
    }

    if (candidates.length > 0) {
        // 按价格涨幅降序排序
        candidates.sort((a, b) => b.ratio - a.ratio);
        return candidates[0];
    }

    return null;
}

function getStratumProduct(stratumKey) {
    // 阶层主要生产的产品
    const productMap = {
        peasant: 'food',
        serf: 'food',
        lumberjack: 'lumber',
        miner: 'ore',
        worker: 'stock',
        artisan: 'tools',
    };
    return productMap[stratumKey] || null;
}

function calculateAvgWealth(context) {
    const { classWealth, popStructure } = context || {};
    if (!classWealth || !popStructure) return 100;

    let totalWealth = 0;
    let totalPop = 0;
    for (const [key, pop] of Object.entries(popStructure)) {
        if (pop > 0) {
            totalWealth += (classWealth[key] || 0);
            totalPop += pop;
        }
    }
    return totalPop > 0 ? totalWealth / Object.keys(popStructure).length : 100;
}

function pickWeighted(candidates) {
    if (candidates.length === 0) return null;

    const totalWeight = candidates.reduce((sum, c) => sum + (c.weight || 1), 0);
    let random = Math.random() * totalWeight;

    for (const candidate of candidates) {
        random -= (candidate.weight || 1);
        if (random <= 0) {
            return candidate;
        }
    }
    return candidates[candidates.length - 1];
}

// =========== 任务创建函数 ===========

/**
 * 创建承诺任务
 */
export function createPromiseTask({
    stratumKey,
    stratumName,
    currentDay = 0,
    failurePenalty = { organization: 50 },
    context = {},
}) {
    // 智能选择承诺类型
    const selection = selectPromiseType(stratumKey, context);
    if (!selection) return null;

    const { type, params } = selection;
    const config = PROMISE_CONFIG[type];

    const task = {
        id: `promise_${stratumKey}_${Date.now()}`,
        type,
        stratumKey,
        stratumName,
        phase: TASK_PHASE.ACHIEVING,
        createdDay: currentDay,
        achieveDeadline: currentDay + config.achieveDeadline,
        maintainDuration: config.maintainDuration,
        maintainEndDay: null, // 达成后设置
        failurePenalty,
        ...params,
    };

    task.description = config.description(task);

    return task;
}

/**
 * 创建满意度提升承诺任务（保持向后兼容）
 */
export function createApprovalPromiseTask({
    stratumKey,
    stratumName,
    currentApproval = 0,
    duration = 30,
    currentDay = 0,
    failurePenalty = { organization: 50 },
}) {
    const targetApproval = Math.min(80, Math.max(50, Math.round(currentApproval + 10)));
    const config = PROMISE_CONFIG[PROMISE_TASK_TYPES.APPROVAL];

    return {
        id: `promise_${stratumKey}_${Date.now()}`,
        type: PROMISE_TASK_TYPES.APPROVAL,
        stratumKey,
        stratumName,
        phase: TASK_PHASE.ACHIEVING,
        targetApproval,
        currentApproval,
        createdDay: currentDay,
        achieveDeadline: currentDay + duration,
        maintainDuration: config.maintainDuration,
        maintainEndDay: null,
        failurePenalty,
        description: `将满意度提升至 ${targetApproval}%，并保持 ${config.maintainDuration} 天`,
    };
}

// =========== 任务评估函数 ===========

/**
 * 检查任务是否达成目标
 */
function isTargetAchieved(task, context) {
    const { classApproval = {}, market = {}, nations = [], taxPolicies = {},
        classWealth = {}, needsReport = {}, tradeRoutes = {} } = context;

    switch (task.type) {
        case PROMISE_TASK_TYPES.DECLARE_WAR: {
            const targetNation = Array.isArray(nations) && nations.find(n => n.id === task.targetNation?.id || n.name === task.targetNationName);
            return targetNation?.isAtWar === true;
        }

        case PROMISE_TASK_TYPES.ESTABLISH_TRADE: {
            const routes = tradeRoutes?.routes || [];
            return routes.some(r => r.resource === task.targetResource && r.active);
        }

        case PROMISE_TASK_TYPES.TAX_RELIEF: {
            const currentBurden = calculateTaxBurden(task.stratumKey, context);
            const originalBurden = task.currentTaxBurden || 0.5;
            return currentBurden <= originalBurden * (task.targetTaxRatio || 0.5);
        }

        case PROMISE_TASK_TYPES.LOWER_PRICE: {
            const currentPrice = market.prices?.[task.targetResource] || Infinity;
            return currentPrice <= (task.targetPrice || Infinity);
        }

        case PROMISE_TASK_TYPES.RAISE_PRICE: {
            const currentPrice = market.prices?.[task.targetResource] || 0;
            return currentPrice >= (task.targetPrice || 0);
        }

        case PROMISE_TASK_TYPES.WEALTH_BOOST: {
            const currentWealth = classWealth[task.stratumKey] || 0;
            const originalWealth = task.currentWealth || 1;
            const targetIncrease = task.targetWealthIncrease || 0.2;
            return currentWealth >= originalWealth * (1 + targetIncrease);
        }

        case PROMISE_TASK_TYPES.LIVING_STANDARD: {
            const satisfaction = needsReport[task.stratumKey]?.satisfactionRatio || 0;
            return satisfaction >= (task.targetSatisfaction || 0.7);
        }

        case PROMISE_TASK_TYPES.APPROVAL: {
            const approval = classApproval[task.stratumKey] || 0;
            return approval >= (task.targetApproval || 60);
        }

        default:
            return false;
    }
}

/**
 * 计算承诺任务剩余天数
 */
export function getPromiseTaskRemainingDays(task, currentDay) {
    if (!task) return 0;

    if (task.phase === TASK_PHASE.ACHIEVING) {
        return Math.max(0, (task.achieveDeadline || 0) - currentDay);
    } else if (task.phase === TASK_PHASE.MAINTAINING) {
        return Math.max(0, (task.maintainEndDay || 0) - currentDay);
    }
    return 0;
}

/**
 * 获取任务阶段描述
 */
export function getTaskPhaseDescription(task) {
    switch (task.phase) {
        case TASK_PHASE.ACHIEVING:
            return '达成中';
        case TASK_PHASE.MAINTAINING:
            return '保持中';
        case TASK_PHASE.COMPLETED:
            return '已完成';
        case TASK_PHASE.FAILED:
            return '已失败';
        default:
            return '未知';
    }
}

/**
 * 评估承诺任务状态
 */
export function evaluatePromiseTasks(tasks = [], context = {}) {
    const { currentDay = 0 } = context;
    const completed = [];
    const failed = [];
    const remaining = [];
    const updated = [];

    tasks.forEach(task => {
        if (!task) return;

        const achieved = isTargetAchieved(task, context);

        // 达成阶段
        if (task.phase === TASK_PHASE.ACHIEVING) {
            if (achieved) {
                // 检查是否有保持阶段
                if (task.maintainDuration > 0) {
                    // 进入保持阶段
                    const updatedTask = {
                        ...task,
                        phase: TASK_PHASE.MAINTAINING,
                        maintainEndDay: currentDay + task.maintainDuration,
                        achievedDay: currentDay,
                    };
                    updated.push(updatedTask);
                    remaining.push(updatedTask);
                } else {
                    // 无保持阶段，直接完成
                    completed.push({ ...task, phase: TASK_PHASE.COMPLETED });
                }
            } else if (currentDay >= (task.achieveDeadline || 0)) {
                // 达成期限已过，失败
                failed.push({ ...task, phase: TASK_PHASE.FAILED });
            } else {
                remaining.push(task);
            }
        }
        // 保持阶段
        else if (task.phase === TASK_PHASE.MAINTAINING) {
            if (!achieved) {
                // 未保持住，失败
                failed.push({ ...task, phase: TASK_PHASE.FAILED, failReason: 'maintain_broken' });
            } else if (currentDay >= (task.maintainEndDay || 0)) {
                // 保持期限结束，完成
                completed.push({ ...task, phase: TASK_PHASE.COMPLETED });
            } else {
                remaining.push(task);
            }
        }
    });

    return { completed, failed, remaining, updated };
}

export default {
    PROMISE_TASK_TYPES,
    PROMISE_CONFIG,
    TASK_PHASE,
    selectPromiseType,
    createPromiseTask,
    createApprovalPromiseTask,
    evaluatePromiseTasks,
    getPromiseTaskRemainingDays,
    getTaskPhaseDescription,
};
