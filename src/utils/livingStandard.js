import { RESOURCES } from '../config';
import { isResourceDemandActive } from './resources';

/**
 * 生活水平计算工具函数
 * 用于计算各阶层的生活水平数据
 * 
 * 新算法（v2）：收入-支出平衡模型 + 动态平滑
 * - 收入充裕度评分 (0-50分)：收入相对于基础支出的充裕程度
 * - 需求满足评分 (0-30分)：商品需求是否被满足
 * - 财务安全评分 (0-20分)：存款能覆盖多少天支出
 */


/**
 * 生活水平等级枚举
 */
export const LIVING_STANDARD_LEVELS = {
    DESTITUTE: { level: '赤贫', icon: 'Skull', color: 'text-gray-400', bgColor: 'bg-gray-900/30', borderColor: 'border-gray-500/30', approvalCap: 30 },
    POOR: { level: '贫困', icon: 'AlertTriangle', color: 'text-red-400', bgColor: 'bg-red-900/20', borderColor: 'border-red-500/30', approvalCap: 50 },
    SUBSISTENCE: { level: '温饱', icon: 'UtensilsCrossed', color: 'text-yellow-400', bgColor: 'bg-yellow-900/20', borderColor: 'border-yellow-500/30', approvalCap: 70 },
    COMFORTABLE: { level: '小康', icon: 'Home', color: 'text-green-400', bgColor: 'bg-green-900/20', borderColor: 'border-green-500/30', approvalCap: 85 },
    PROSPEROUS: { level: '富裕', icon: 'Gem', color: 'text-blue-400', bgColor: 'bg-blue-900/20', borderColor: 'border-blue-500/30', approvalCap: 95 },
    LUXURIOUS: { level: '奢华', icon: 'Crown', color: 'text-purple-400', bgColor: 'bg-purple-900/20', borderColor: 'border-purple-500/30', approvalCap: 100 },
};

export const LIVING_STANDARD_BASKET_UNLOCK_CAPS = {
    '贫困': 0,
    '温饱': 1.49,
    '小康': 4.5,
    '富裕': 12.0,
    '奢华': Number.POSITIVE_INFINITY,
};

export const LIVING_STANDARD_BASKET_AMOUNT_MULTIPLIERS = {
    '贫困': { base: 0.9, luxury: 0 },
    '温饱': { base: 1.0, luxury: 1.0 },
    '小康': { base: 1.15, luxury: 1.25 },
    '富裕': { base: 1.35, luxury: 1.7 },
    '奢华': { base: 1.6, luxury: 2.4 },
};

export const LIVING_STANDARD_BUFFER_DAYS = {
    '贫困': 45,
    '温饱': 90,
    '小康': 180,
    '富裕': 540,
    '奢华': 1440,
};




function getPriceFromSource(resourceKey, priceMap) {
    const fallbackPrice = RESOURCES[resourceKey]?.basePrice || 1;
    if (typeof priceMap === 'function') {
        return Math.max(0, priceMap(resourceKey) || fallbackPrice);
    }
    if (priceMap && typeof priceMap === 'object') {
        return Math.max(0, priceMap[resourceKey] || fallbackPrice);
    }
    return fallbackPrice;
}

/**
 * 计算指定生活水平对应的“每日消费篮子成本”
 * 参考 CPI 的篮子思路：按当前物价 × 对应档位的消费数量累加
 */
export function calculateLivingStandardBasketDailyCost({
    baseNeeds = {},
    luxuryNeeds = {},
    livingStandardLevel = '温饱',
    priceMap = {},
    epoch = 0,
    techsUnlocked = [],
    needsRequirementMultiplier = 1,
    availableResources = null,
    potentialResources = null,
}) {
    const unlockCap = LIVING_STANDARD_BASKET_UNLOCK_CAPS[livingStandardLevel] ?? 0;
    const basketMultipliers = LIVING_STANDARD_BASKET_AMOUNT_MULTIPLIERS[livingStandardLevel] || LIVING_STANDARD_BASKET_AMOUNT_MULTIPLIERS['温饱'];
    const basket = {};

    const addToBasket = (resourceKey, amount, category = 'base') => {
        if (!resourceKey || !Number.isFinite(amount) || amount <= 0) {
            return;
        }
        const activeResources = availableResources || potentialResources;
        if (!isResourceDemandActive(resourceKey, epoch, techsUnlocked, activeResources)) {
            return;
        }
        const categoryMultiplier = category === 'luxury'
            ? (basketMultipliers.luxury ?? 1)
            : (basketMultipliers.base ?? 1);
        basket[resourceKey] = (basket[resourceKey] || 0) + amount * needsRequirementMultiplier * categoryMultiplier;
    };

    Object.entries(baseNeeds || {}).forEach(([resourceKey, amount]) => {
        addToBasket(resourceKey, amount, 'base');
    });

    if (unlockCap > 0) {
        Object.keys(luxuryNeeds || {})
            .map(Number)
            .sort((a, b) => a - b)
            .forEach((threshold) => {
                if (threshold > unlockCap) {
                    return;
                }
                const tierNeeds = luxuryNeeds?.[threshold] || luxuryNeeds?.[String(threshold)] || {};
                Object.entries(tierNeeds).forEach(([resourceKey, amount]) => {
                    addToBasket(resourceKey, amount, 'luxury');
                });
            });
    }


    let totalCost = 0;
    Object.entries(basket).forEach(([resourceKey, amount]) => {
        totalCost += amount * getPriceFromSource(resourceKey, priceMap);
    });

    return {
        unlockCap,
        basket,
        totalCost,
    };
}

/**
 * 计算价格感知的生活水平阈值
 * 用固定缓冲天数 × 各档位消费篮子成本，替代固定银币阈值
 */
export function calculatePriceAwareLivingStandardThresholds({
    baseNeeds = {},
    luxuryNeeds = {},
    priceMap = {},
    epoch = 0,
    techsUnlocked = [],
    needsRequirementMultiplier = 1,
    availableResources = null,
    potentialResources = null,
    bufferDays = LIVING_STANDARD_BUFFER_DAYS,
    livingLevels = ['贫困', '温饱', '小康', '富裕', '奢华'],
}) {
    const dailyCosts = {};
    const thresholds = {};
    const baskets = {};
    const bufferDaysByLevel = {};

    livingLevels.forEach((level) => {
        const basketInfo = calculateLivingStandardBasketDailyCost({
            baseNeeds,
            luxuryNeeds,
            livingStandardLevel: level,
            priceMap,
            epoch,
            techsUnlocked,
            needsRequirementMultiplier,
            availableResources: availableResources || potentialResources,
        });
        const levelBufferDays = typeof bufferDays === 'number'
            ? bufferDays
            : (bufferDays?.[level] ?? LIVING_STANDARD_BUFFER_DAYS[level] ?? 30);
        baskets[level] = basketInfo.basket;
        dailyCosts[level] = basketInfo.totalCost;
        thresholds[level] = basketInfo.totalCost * levelBufferDays;
        bufferDaysByLevel[level] = levelBufferDays;
    });

    return {
        bufferDays: bufferDaysByLevel['温饱'] || 30,
        bufferDaysByLevel,
        baskets,
        dailyCosts,
        thresholds,
        referenceThreshold: thresholds['温饱'] || thresholds['贫困'] || 0,
    };
}


export function getPriceAwareLivingStandardLevel(wealthPerCapita, thresholds = {}, fallbackLevel = '贫困') {
    if (wealthPerCapita >= (thresholds['奢华'] || Number.POSITIVE_INFINITY)) {
        return '奢华';
    }
    if (wealthPerCapita >= (thresholds['富裕'] || Number.POSITIVE_INFINITY)) {
        return '富裕';
    }
    if (wealthPerCapita >= (thresholds['小康'] || Number.POSITIVE_INFINITY)) {
        return '小康';
    }
    if (wealthPerCapita >= (thresholds['温饱'] || Number.POSITIVE_INFINITY)) {
        return '温饱';
    }
    return fallbackLevel;
}

function normalizeWealthAgainstReference(wealthPerCapita, wealthReference = 100, baseline = 100) {
    if (!Number.isFinite(wealthPerCapita) || wealthPerCapita <= 0) {
        return 0;
    }
    const safeReference = wealthReference > 0 ? wealthReference : baseline;
    return (wealthPerCapita / safeReference) * baseline;
}



/**
 * 计算收入充裕度评分
 * 评估收入相对于基础生存开支的充裕程度
 * @param {number} income - 日收入
 * @param {number} essentialCost - 基础生存成本（最低需求）
 * @param {number} wealthPerCapita - 人均财富（用于回退计算）
 * @param {number} startingWealth - 基准财富（用于回退计算）
 * @returns {number} 评分 (0-50)
 */
export function calculateIncomeAdequacyScore(income, essentialCost, wealthPerCapita = 0, startingWealth = 100) {
    // 如果没有基础成本数据，使用财富比率作为回退
    if (essentialCost <= 0) {
        // 使用财富比率估算生活水平
        const wealthRatio = startingWealth > 0 ? wealthPerCapita / startingWealth : 0;
        // 财富比率 < 0.5 → 0-10分
        // 财富比率 0.5-1 → 10-25分
        // 财富比率 1-2 → 25-35分
        // 财富比率 2+ → 35-50分
        if (wealthRatio < 0.5) {
            return wealthRatio * 20; // 0-10分
        } else if (wealthRatio < 1) {
            return 10 + (wealthRatio - 0.5) * 30; // 10-25分
        } else if (wealthRatio < 2) {
            return 25 + (wealthRatio - 1) * 10; // 25-35分
        } else {
            return Math.min(50, 35 + (wealthRatio - 2) * 5); // 35-50分
        }
    }

    // 正常计算：基于收入与基础成本的比率
    // surplus = (income - essentialCost) / essentialCost
    // surplus = 0: 收支平衡 → 25分
    // surplus = 1: 收入是成本的2倍 → 50分
    // surplus < 0: 入不敷出 → 0-25分
    const surplus = (income - essentialCost) / essentialCost;

    if (surplus >= 1) {
        // 收入超出基础成本2倍以上，满分
        return 50;
    } else if (surplus >= 0) {
        // 收支平衡到2倍之间，25-50分
        return 25 + surplus * 25;
    } else if (surplus >= -1) {
        // 入不敷出但还有一些收入，0-25分
        return Math.max(0, 25 + surplus * 25);
    } else {
        // 完全没有收入或严重亏损
        return 0;
    }
}


/**
 * 计算财务安全度评分
 * 评估存款能覆盖多少天的支出
 * @param {number} savings - 当前存款（人均）
 * @param {number} dailyExpense - 日支出（人均）
 * @param {number} bufferDays - 安全缓冲天数（默认30天）
 * @param {number} startingWealth - 基准财富（用于回退计算）
 * @returns {number} 评分 (0-20)
 */
export function calculateFinancialSecurityScore(savings, dailyExpense, bufferDays = 30, startingWealth = 100) {
    if (dailyExpense <= 0) {
        // 没有支出数据，使用财富比率作为回退
        const wealthRatio = startingWealth > 0 ? savings / startingWealth : 0;
        // 财富比率决定安全度分数
        if (wealthRatio < 0.5) {
            return wealthRatio * 10; // 0-5分
        } else if (wealthRatio < 1) {
            return 5 + (wealthRatio - 0.5) * 10; // 5-10分
        } else {
            return Math.min(20, 10 + (wealthRatio - 1) * 5); // 10-20分
        }
    }

    const coverageDays = savings / dailyExpense;
    // 覆盖bufferDays天 = 满分20分
    // 线性增长
    return Math.min(20, (coverageDays / bufferDays) * 20);
}


/**
 * 根据评分确定生活水平等级
 * @param {number} score - 综合评分 (0-100)
 * @returns {object} 生活水平等级信息
 */
export function getLivingStandardByScore(score) {
    if (score < 20) {
        return LIVING_STANDARD_LEVELS.DESTITUTE;
    }
    if (score < 40) {
        return LIVING_STANDARD_LEVELS.POOR;
    }
    if (score < 55) {
        return LIVING_STANDARD_LEVELS.SUBSISTENCE;
    }
    if (score < 70) {
        return LIVING_STANDARD_LEVELS.COMFORTABLE;
    }
    if (score < 85) {
        return LIVING_STANDARD_LEVELS.PROSPEROUS;
    }
    return LIVING_STANDARD_LEVELS.LUXURIOUS;
}

export function getLivingStandardByLevel(level) {
    const matched = Object.values(LIVING_STANDARD_LEVELS).find((item) => item.level === level);
    return matched || LIVING_STANDARD_LEVELS.POOR;
}

function applyUpperLivingStandardWealthGate(level, wealthPerCapita, wealthThresholds = null) {
    if (!wealthThresholds || !Number.isFinite(wealthPerCapita)) {
        return level;
    }

    if (level === '奢华' && wealthPerCapita < (wealthThresholds['奢华'] || Number.POSITIVE_INFINITY)) {
        return wealthPerCapita >= (wealthThresholds['富裕'] || Number.POSITIVE_INFINITY) ? '富裕' : '小康';
    }

    if (level === '富裕' && wealthPerCapita < (wealthThresholds['富裕'] || Number.POSITIVE_INFINITY)) {
        return '小康';
    }

    return level;
}


/**
 * 计算财富乘数（消费能力）- 用于奢侈需求解锁
 * 新算法：同时考虑收入、财富和阶层弹性
 * - 收入决定"赚钱能力"（有多少钱进账）
 * - 财富决定"消费意愿"（敢不敢花钱）
 * - 弹性决定"消费增长速度"（收入增加时消费增长多快）
 * 
 * 2024-12更新：使用更平滑的曲线，防止补贴-消费爆炸死循环
 * @param {number} incomeRatio - 收入比率（人均收入 / 基础成本）
 * @param {number} wealthRatio - 财富比率（人均财富 / 基准财富）
 * @param {number} wealthElasticity - 财富弹性系数（0.3=底层, 1.0=基准, 1.8=顶层）
 * @param {number} maxMultiplier - 消费倍数上限（底层3, 中层6, 上层10）
 * @returns {number} 财富乘数
 */
export function calculateWealthMultiplier(incomeRatio, wealthRatio = 1, wealthElasticity = 1.0, maxMultiplier = 6.0, greedy = false) {
    // 2024-12更新：高财富比率可以补偿低收入
    // 解决自给自足型阶层（如自耕农）的问题：他们收入很低但财富积累很高

    // 有效收入比率：取收入比率和财富比率的加权平均
    // 如果财富很高，即使收入低也不会过度惩罚消费能力
    // 权重：收入占主导，财富30%（降低财富对消费量的直接拉动，避免补贴-消费死循环）
    const effectiveRatio = Math.max(incomeRatio, wealthRatio * 0.3); // 财富可以补偿30%的收入不足

    // 1. 基于有效比率的消费能力
    // 使用更平滑的曲线：对数增长而非平方根
    let baseMultiplier;
    if (effectiveRatio <= 0) {
        baseMultiplier = 0.3;
    } else if (effectiveRatio < 1) {
        // 低于基准时，线性增长到1.0
        baseMultiplier = 0.3 + effectiveRatio * 0.7;
    } else {
        // 新曲线：使用自然对数，增长更平缓
        // effectiveRatio=2 → ~1.35, =4 → ~1.69, =8 → ~2.04
        if (greedy) {
            // 贪婪模式：线性增长，无对数抑制
            // 财富越多，消费越接近线性增长
            baseMultiplier = 1 + (effectiveRatio - 1) * 0.8;
        } else {
            baseMultiplier = 1 + Math.log(effectiveRatio) * 0.5;
        }
    }

    // 2. 使用弹性系数调节增长速度（主要影响超过基准后的增长）
    let incomeMultiplier;
    if (baseMultiplier <= 1) {
        // 低于基准时，弹性系数减缓下降速度（低弹性阶层更保守）
        incomeMultiplier = baseMultiplier * (0.7 + 0.3 * Math.min(1.2, wealthElasticity));
    } else {
        // 超过基准时，弹性系数影响增长速度
        incomeMultiplier = 1 + (baseMultiplier - 1) * wealthElasticity;
    }

    // 3. 基于财富的消费意愿（约束因子）
    // 这个因子确保贫穷的人不会因为一时高收入就大肆消费
    let wealthFactor;
    if (wealthRatio < 0.3) {
        // 赤贫：只敢消费基础的 50%
        wealthFactor = 0.5;
    } else if (wealthRatio < 1) {
        // 贫困到温饱：逐渐增加消费意愿 (0.5 → 1.0)
        wealthFactor = 0.5 + (wealthRatio - 0.3) * (0.5 / 0.7);
    } else if (wealthRatio < 2) {
        // 小康：正常消费
        wealthFactor = 1.0;
    } else {
        // 富裕：略微增加消费意愿（最多+15%）
        if (greedy) {
            // 贪婪模式：无上限，且额外激进
            // e.g. 10倍财富 -> 50% extra factor
            const extraFactor = (wealthRatio - 2) * 0.05 * wealthElasticity;
            wealthFactor = 1.0 + extraFactor;
        } else {
            const extraFactor = Math.min(0.15, (wealthRatio - 2) * 0.025 * wealthElasticity);
            wealthFactor = 1.0 + extraFactor;
        }
    }

    // 4. 最终消费能力 = 收入能力 × 财富意愿
    let wealthMultiplier = incomeMultiplier * wealthFactor;

    // 存款较低时，限制消费能力上冲，避免赤贫/贫困也出现高消费倍率
    if (wealthRatio < 0.5) {
        wealthMultiplier = Math.min(wealthMultiplier, 0.8);
    } else if (wealthRatio < 1.0) {
        wealthMultiplier = Math.min(wealthMultiplier, 1.0);
    } else if (wealthRatio < 2.0) {
        wealthMultiplier = Math.min(wealthMultiplier, 1.2);
    }

    // 使用阶层配置的上限（底层3倍, 中层6倍, 上层10倍）
    return Math.max(0.3, Math.min(maxMultiplier, wealthMultiplier));
}

export function calculateLuxuryConsumptionMultiplier({
    consumptionMultiplier = 1,
    incomeRatio = null,
    wealthRatio = null,
    livingStandardLevel = null,
} = {}) {
    const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
    const safeConsumption = Number.isFinite(consumptionMultiplier)
        ? Math.max(0.3, consumptionMultiplier)
        : 1;

    const incomeFactor = Number.isFinite(incomeRatio)
        ? clamp(0.4 + 0.6 * Math.min(1.5, incomeRatio), 0.3, 1.2)
        : 1;
    const wealthFactor = Number.isFinite(wealthRatio)
        ? clamp(0.4 + 0.6 * Math.min(2, wealthRatio) / 2, 0.3, 1.2)
        : 1;
    const stabilityFactor = 0.6 + 0.4 * ((incomeFactor + wealthFactor) / 2);

    const levelFactorMap = {
        '赤贫': 0.05,
        '贫困': 0.15,
        '温饱': 0.4,
        '小康': 0.9,
        '富裕': 1.1,
        '奢华': 1.25,
    };
    const levelFactor = livingStandardLevel
        ? (levelFactorMap[livingStandardLevel] ?? 1)
        : 1;

    const rawMultiplier = safeConsumption * levelFactor * stabilityFactor;
    return clamp(rawMultiplier, 0.05, 1.6);
}

/**
 * 计算解锁乘数（用于奢侈需求解锁判断）
 * 与 calculateWealthMultiplier 区别：不受阶层消费上限限制，弹性系数影响更小
 * 这样即使底层阶级消费能力被限制，只要财富足够也能解锁奢侈需求
 * 
 * 2024-12更新：解锁能力主要取决于财富，弹性系数影响减半
 * @param {number} incomeRatio - 收入比率（人均收入 / 基础成本）
 * @param {number} wealthRatio - 财富比率（人均财富 / 基准财富）
 * @param {number} wealthElasticity - 财富弹性系数（0.3=底层, 1.0=基准, 1.8=顶层）
 * @returns {number} 解锁乘数（无阶级上限限制）
 */
export function calculateUnlockMultiplier(incomeRatio, wealthRatio = 1, wealthElasticity = 1.0, livingStandardLevel = null) {
    // 强制要求：仅当收入能满足基础生存需求(incomeRatio >= 1) 或拥有一定积蓄(wealthRatio >= 2)时，才允许解锁奢侈需求
    // 这样防止赤贫阶层(穷且没存款)乱花钱，但允许富裕阶层(如食利者)消耗存款维持生活
    if (incomeRatio < 1.0 && wealthRatio < 2.0) {
        return 0;
    }

    // 高财富比率可以补偿低收入（财富权重更高，因为解锁主要看积累）
    // 2024-12 Fix: 降低到0.5，避免存了一点钱就立刻解锁昂贵需求
    const effectiveRatio = Math.max(incomeRatio, wealthRatio * 0.5);

    // 1. 基于有效比率的解锁能力
    // 使用更激进的曲线，让高财富能解锁更多需求
    let baseMultiplier;
    if (effectiveRatio <= 0) {
        baseMultiplier = 0.3;
    } else if (effectiveRatio < 1) {
        baseMultiplier = 0.3 + effectiveRatio * 0.7;
    } else {
        // 使用自然对数，但系数更高（0.7而非0.5）
        baseMultiplier = 1 + Math.log(effectiveRatio) * 0.7;
    }

    // 2. 弹性系数对解锁的影响减半（解锁主要看财富，不看消费偏好）
    // 使用 (elasticity + 1) / 2 来减少弹性的影响
    const adjustedElasticity = (wealthElasticity + 1) / 2; // 0.5 → 0.75, 1.0 → 1.0, 1.5 → 1.25
    let incomeMultiplier;
    if (baseMultiplier <= 1) {
        incomeMultiplier = baseMultiplier * (0.8 + 0.2 * Math.min(1.2, adjustedElasticity));
    } else {
        incomeMultiplier = 1 + (baseMultiplier - 1) * adjustedElasticity;
    }

    // 3. 基于财富的解锁意愿（富人更愿意尝试奢侈品）
    let wealthFactor;
    if (wealthRatio < 0.3) {
        wealthFactor = 0.5;
    } else if (wealthRatio < 1) {
        wealthFactor = 0.5 + (wealthRatio - 0.3) * (0.5 / 0.7);
    } else if (wealthRatio < 2) {
        wealthFactor = 1.0;
    } else {
        // 富裕时解锁意愿更高（最多+25%，而非消费能力的+15%）
        const extraFactor = Math.min(0.25, (wealthRatio - 2) * 0.03);
        wealthFactor = 1.0 + extraFactor;
    }

    // 4. 解锁乘数 = 收入能力 × 财富意愿（使用固定上限10）
    const unlockMultiplier = incomeMultiplier * wealthFactor;
    let rawUnlock = Math.max(0.3, Math.min(10.0, unlockMultiplier));

    if (!livingStandardLevel) {
        return rawUnlock;
    }

    const levelCaps = {
        '赤贫': 0,
        '贫困': 0,
        '温饱': 1.49,
        '小康': 3.0,
        '富裕': 6.0,
        '奢华': 10.0,
    };
    const cap = levelCaps[livingStandardLevel];
    if (cap === undefined) {
        // Continue with wealth-based cap below if level is unknown
    }

    // 存款不足时禁止解锁奢侈需求（即使收入短期很高）
    if (wealthRatio < 1.0) {
        rawUnlock = Math.min(rawUnlock, 0.99);
    }

    return cap === undefined ? rawUnlock : Math.min(cap, rawUnlock);
}

/**
 * 【保留兼容】旧版本基于财富比率的生活水平等级判断
 * @deprecated 请使用 getLivingStandardByScore
 */
export function getLivingStandardLevel(wealthRatio, satisfactionRate = 1, luxuryUnlockRatio = 0) {
    if (wealthRatio < 0.5) {
        return LIVING_STANDARD_LEVELS.DESTITUTE;
    }
    if (wealthRatio < 1 || satisfactionRate < 0.5) {
        return LIVING_STANDARD_LEVELS.POOR;
    }
    if (wealthRatio < 2 || luxuryUnlockRatio === 0) {
        return LIVING_STANDARD_LEVELS.SUBSISTENCE;
    }
    if (wealthRatio < 4 || luxuryUnlockRatio < 0.3) {
        return LIVING_STANDARD_LEVELS.COMFORTABLE;
    }
    if (wealthRatio < 8 || luxuryUnlockRatio < 0.7) {
        return LIVING_STANDARD_LEVELS.PROSPEROUS;
    }
    return LIVING_STANDARD_LEVELS.LUXURIOUS;
}

/**
 * 【保留兼容】旧版本综合评分计算
 * @deprecated 请使用新版 calculateLivingStandardScore
 */
export function calculateLegacyScore(wealthRatio, satisfactionRate, luxuryUnlockRatio) {
    const wealthScore = Math.min(40, wealthRatio * 4);
    const satisfactionScore = satisfactionRate * 30;
    const luxuryScore = luxuryUnlockRatio * 30;
    return Math.min(100, wealthScore + satisfactionScore + luxuryScore);
}

/**
 * 新版综合评分计算
 * @param {number} incomeAdequacy - 收入充裕度评分 (0-50)
 * @param {number} satisfactionRate - 需求满足率 (0-1)
 * @param {number} financialSecurity - 财务安全度评分 (0-20)
 * @param {number} wealthRatio - 财富比率（人均财富 / 动态购买力基准）
 * @param {number} wealthPerCapita - 人均财富（绝对值）
 * @param {number} wealthReference - 动态购买力基准（默认100）
 * @returns {number} 综合评分 (0-100)
 */
export function calculateLivingStandardScore(incomeAdequacy, satisfactionRate, financialSecurity, wealthRatio = 1, wealthPerCapita = 100, wealthReference = 100) {
    // 收入充裕度 (0-50分) + 需求满足 (0-30分) + 财务安全 (0-20分)
    const satisfactionScore = satisfactionRate * 30;
    const rawScore = incomeAdequacy + satisfactionScore + financialSecurity;

    // ========== 混合评估模型 ==========
    // 结合动态购买力下的“绝对财富”和“相对财富”两个维度计算评分上限
    let absoluteScore = 0;
    const normalizedWealth = normalizeWealthAgainstReference(wealthPerCapita, wealthReference);
    if (normalizedWealth > 0) {
        absoluteScore = Math.min(60, 0.7 * Math.sqrt(normalizedWealth));
    }

    let relativeScore = 0;
    if (wealthRatio > 0) {
        relativeScore = Math.min(40, 40 * (1 - Math.exp(-wealthRatio * 0.5)));
    }

    const wealthScore = absoluteScore + relativeScore;
    return rawScore * 0.5 + wealthScore * 0.5;
}


/**
 * 计算阶层的完整生活水平数据（新算法）
 * 
 * 新算法核心思想：
 * 1. 生活水平主要由收入决定，而非存款
 * 2. 存款提供安全缓冲，而非直接决定生活等级
 * 3. 新职业可基于收入立即获得合理的生活水平
 * 
 * @param {object} params - 参数对象
 * @param {number} params.count - 阶层人口数量
 * @param {number} params.income - 阶层总收入（日）
 * @param {number} params.expense - 阶层总支出（日）
 * @param {number} params.wealthValue - 阶层总财富（存款）
 * @param {number} params.startingWealth - 旧版基准财富（每人，作为回退）
 * @param {number} params.wealthReference - 动态购买力基准（优先使用）
 * @param {object|null} params.wealthThresholds - 动态购买力分档门槛（用于限制富裕/奢华）
 * @param {number} params.essentialCost - 基础生存成本（总计，每日）

 * @param {number} params.shortagesCount - 短缺资源数量
 * @param {number} params.effectiveNeedsCount - 有效需求总数
 * @param {number} params.unlockedLuxuryTiers - 已解锁的奢侈需求档位数
 * @param {number} params.totalLuxuryTiers - 总奢侈需求档位数
 * @param {number} params.previousScore - 上一次的评分（用于平滑）
 * @param {boolean} params.isNewStratum - 是否是新创建的阶层
 * @param {number} params.maxConsumptionMultiplier - 阶层消费倍数上限（底层3, 中层6, 上层10）
 * @param {number} params.wealthElasticity - 财富弹性系数（0.3=底层, 1.0=基准, 1.8=顶层）
 * @returns {object} 完整的生活水平数据
 */
export function calculateLivingStandardData({
    count,
    income = 0,
    expense = 0,
    wealthValue = 0,
    startingWealth = 100,
    wealthReference = null,
    wealthThresholds = null,
    essentialCost = 0,

    shortagesCount = 0,
    effectiveNeedsCount = 0,
    unlockedLuxuryTiers = 0,
    totalLuxuryTiers = 0,
    previousScore = null,
    isNewStratum = false,
    maxConsumptionMultiplier = 6,
    wealthElasticity = 1.0,
    greedy = false,
}) {
    if (count <= 0) {
        return null;
    }

    // 计算人均数值
    const incomePerCapita = income / count;
    const expensePerCapita = expense / count;
    const wealthPerCapita = wealthValue / count;
    const essentialCostPerCapita = essentialCost / count;
    const effectiveWealthReference = wealthReference > 0 ? wealthReference : startingWealth;

    // 1. 收入充裕度评分 (0-50分)
    // 传入动态购买力基准用于回退计算
    const incomeAdequacyScore = calculateIncomeAdequacyScore(
        incomePerCapita,
        essentialCostPerCapita,
        wealthPerCapita,
        effectiveWealthReference
    );

    // 2. 需求满足率
    // 如果没有有效需求计数，使用更保守的默认值（基于动态购买力比率）
    let satisfactionRate;
    if (effectiveNeedsCount > 0) {
        satisfactionRate = Math.max(0, (effectiveNeedsCount - shortagesCount) / effectiveNeedsCount);
    } else {
        const wealthRatioFallback = effectiveWealthReference > 0 ? wealthPerCapita / effectiveWealthReference : 0;
        satisfactionRate = Math.min(1, wealthRatioFallback);
    }

    // 3. 财务安全度评分 (0-20分)
    const financialSecurityScore = calculateFinancialSecurityScore(
        wealthPerCapita,
        expensePerCapita,
        30,
        effectiveWealthReference
    );

    // 计算财富比率用于评分约束
    const realWealthRatio = effectiveWealthReference > 0 ? wealthPerCapita / effectiveWealthReference : 0;

    // 计算目标分数（传入动态购买力比率和人均财富作为评分约束）
    const targetScore = calculateLivingStandardScore(
        incomeAdequacyScore,
        satisfactionRate,
        financialSecurityScore,
        realWealthRatio,
        wealthPerCapita,
        effectiveWealthReference
    );

    // 4. 平滑过渡
    const ADAPT_RATE = isNewStratum ? 1.0 : 0.15;
    const smoothedScore = previousScore !== null
        ? previousScore * (1 - ADAPT_RATE) + targetScore * ADAPT_RATE
        : targetScore;

    // 根据分数确定等级，并对富裕/奢华施加动态财富门槛
    const scoreBasedLevel = getLivingStandardByScore(smoothedScore).level;
    const gatedLevel = applyUpperLivingStandardWealthGate(scoreBasedLevel, wealthPerCapita, wealthThresholds);
    const livingStandard = getLivingStandardByLevel(gatedLevel);


    // 计算消费能力乘数（同时考虑收入和财富，使用阶层配置的上限）
    const incomeRatio = essentialCostPerCapita > 0
        ? incomePerCapita / essentialCostPerCapita
        : (incomePerCapita > 0 ? 10 : 0);
    const wealthMultiplier = calculateWealthMultiplier(incomeRatio, realWealthRatio, wealthElasticity, maxConsumptionMultiplier, greedy);

    // 奢侈需求解锁比例
    const luxuryUnlockRatio = totalLuxuryTiers > 0 ? unlockedLuxuryTiers / totalLuxuryTiers : 0;

    // wealthRatio: 真正的财富比率（人均财富/动态购买力基准），用于UI显示
    const wealthRatio = realWealthRatio;

    return {
        // 核心数据
        score: smoothedScore,
        targetScore,

        // 评分分解
        incomeAdequacyScore,
        satisfactionRate,
        financialSecurityScore,

        // 人均数据
        incomePerCapita,
        expensePerCapita,
        wealthPerCapita,

        // 消费能力
        wealthMultiplier,
        wealthRatio,
        wealthReference: effectiveWealthReference,

        // 奢侈品相关
        luxuryUnlockRatio,
        unlockedLuxuryTiers,
        totalLuxuryTiers,

        // 等级信息
        level: livingStandard.level,
        icon: livingStandard.icon,
        color: livingStandard.color,
        bgColor: livingStandard.bgColor,
        borderColor: livingStandard.borderColor,
        approvalCap: livingStandard.approvalCap,
    };
}


/**
 * 简化版本：基于收入快速计算生活水平图标和颜色
 * 适用于列表视图等简单场景
 * @param {number} incomeRatio - 收入比率（收入/基础成本）
 * @returns {object} { icon, color, level, approvalCap }
 */
export function getSimpleLivingStandard(incomeRatio) {
    if (incomeRatio < 0.5) {
        return { icon: 'Skull', color: 'text-gray-400', level: '赤贫', approvalCap: 30 };
    } else if (incomeRatio < 1) {
        return { icon: 'AlertTriangle', color: 'text-red-400', level: '贫困', approvalCap: 50 };
    } else if (incomeRatio < 1.5) {
        return { icon: 'UtensilsCrossed', color: 'text-yellow-400', level: '温饱', approvalCap: 70 };
    } else if (incomeRatio < 2.5) {
        return { icon: 'Home', color: 'text-green-400', level: '小康', approvalCap: 85 };
    } else {
        return { icon: 'Crown', color: 'text-purple-400', level: '富裕', approvalCap: 100 };
    }
}
