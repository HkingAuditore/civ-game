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

/**
 * 计算财富乘数（消费能力）- 用于奢侈需求解锁
 * 新算法：基于收入充裕度而非存款
 * @param {number} incomeRatio - 收入比率（人均收入 / 基础成本）
 * @returns {number} 财富乘数
 */
export function calculateWealthMultiplier(incomeRatio) {
    let wealthMultiplier;
    if (incomeRatio <= 0) {
        wealthMultiplier = 0.3;
    } else if (incomeRatio < 1) {
        // 收入不足以覆盖基础成本
        wealthMultiplier = 0.3 + incomeRatio * 0.7;
    } else {
        // 收入超过基础成本，逐渐增加消费能力
        wealthMultiplier = Math.sqrt(incomeRatio) * (1 + Math.log(incomeRatio) * 0.25);
    }
    return Math.max(0.3, Math.min(6.0, wealthMultiplier));
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
 * @param {number} wealthRatio - 财富比率（人均财富 / 基准财富），用于约束评分上限
 * @returns {number} 综合评分 (0-100)
 */
export function calculateLivingStandardScore(incomeAdequacy, satisfactionRate, financialSecurity, wealthRatio = 1) {
    // 收入充裕度 (0-50分) + 需求满足 (0-30分) + 财务安全 (0-20分)
    const satisfactionScore = satisfactionRate * 30;
    let rawScore = incomeAdequacy + satisfactionScore + financialSecurity;

    // 财富积累约束：财富低于基准时，限制最高评分
    // 这确保即使收入很高，如果还没积累足够财富，也不会被评为"奢华"
    // wealthRatio < 0.5: 最高40分 (温饱)
    // wealthRatio < 1.0: 最高60分 (小康)
    // wealthRatio < 2.0: 最高80分 (富裕)
    // wealthRatio >= 2.0: 无限制
    let maxScore = 100;
    if (wealthRatio < 0.5) {
        maxScore = 40; // 最多"温饱"
    } else if (wealthRatio < 1.0) {
        maxScore = 40 + (wealthRatio - 0.5) * 40; // 40-60分
    } else if (wealthRatio < 2.0) {
        maxScore = 60 + (wealthRatio - 1.0) * 20; // 60-80分
    } else if (wealthRatio < 3.0) {
        maxScore = 80 + (wealthRatio - 2.0) * 20; // 80-100分
    }

    return Math.min(maxScore, rawScore);
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
 * @param {number} params.startingWealth - 基准财富（每人）
 * @param {number} params.essentialCost - 基础生存成本（总计，每日）
 * @param {number} params.shortagesCount - 短缺资源数量
 * @param {number} params.effectiveNeedsCount - 有效需求总数
 * @param {number} params.unlockedLuxuryTiers - 已解锁的奢侈需求档位数
 * @param {number} params.totalLuxuryTiers - 总奢侈需求档位数
 * @param {number} params.previousScore - 上一次的评分（用于平滑）
 * @param {boolean} params.isNewStratum - 是否是新创建的阶层
 * @returns {object} 完整的生活水平数据
 */
export function calculateLivingStandardData({
    count,
    income = 0,
    expense = 0,
    wealthValue = 0,
    startingWealth = 100,
    essentialCost = 0,
    shortagesCount = 0,
    effectiveNeedsCount = 0,
    unlockedLuxuryTiers = 0,
    totalLuxuryTiers = 0,
    previousScore = null,
    isNewStratum = false,
}) {
    if (count <= 0) {
        return null;
    }

    // 计算人均数值
    const incomePerCapita = income / count;
    const expensePerCapita = expense / count;
    const wealthPerCapita = wealthValue / count;
    const essentialCostPerCapita = essentialCost / count;

    // 1. 收入充裕度评分 (0-50分)
    // 传入财富数据用于回退计算
    const incomeAdequacyScore = calculateIncomeAdequacyScore(
        incomePerCapita,
        essentialCostPerCapita,
        wealthPerCapita,
        startingWealth
    );

    // 2. 需求满足率
    // 如果没有有效需求计数，使用更保守的默认值（基于财富比率）
    let satisfactionRate;
    if (effectiveNeedsCount > 0) {
        satisfactionRate = Math.max(0, (effectiveNeedsCount - shortagesCount) / effectiveNeedsCount);
    } else {
        // 没有需求数据时，使用财富比率估算
        const wealthRatio = startingWealth > 0 ? wealthPerCapita / startingWealth : 0;
        satisfactionRate = Math.min(1, wealthRatio);
    }

    // 3. 财务安全度评分 (0-20分)
    // 传入基准财富用于回退计算
    const financialSecurityScore = calculateFinancialSecurityScore(
        wealthPerCapita,
        expensePerCapita,
        30,
        startingWealth
    );

    // 计算财富比率用于评分约束
    const realWealthRatio = startingWealth > 0 ? wealthPerCapita / startingWealth : 0;

    // 计算目标分数（传入财富比率作为评分上限约束）
    const targetScore = calculateLivingStandardScore(incomeAdequacyScore, satisfactionRate, financialSecurityScore, realWealthRatio);



    // 4. 平滑过渡
    // 新阶层直接采用目标分数，否则渐进变化
    const ADAPT_RATE = isNewStratum ? 1.0 : 0.15;
    const smoothedScore = previousScore !== null
        ? previousScore * (1 - ADAPT_RATE) + targetScore * ADAPT_RATE
        : targetScore;

    // 根据分数确定等级
    const livingStandard = getLivingStandardByScore(smoothedScore);

    // 计算消费能力乘数（基于收入比率）
    const incomeRatio = essentialCostPerCapita > 0 ? incomePerCapita / essentialCostPerCapita : 1;
    const wealthMultiplier = calculateWealthMultiplier(incomeRatio);

    // 奢侈需求解锁比例
    const luxuryUnlockRatio = totalLuxuryTiers > 0 ? unlockedLuxuryTiers / totalLuxuryTiers : 0;

    // wealthRatio: 真正的财富比率（人均财富/基准财富），用于UI显示
    // 这与 realWealthRatio 相同，保持向后兼容
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
        wealthRatio, // 兼容旧代码

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
    } else if (incomeRatio < 4) {
        return { icon: 'Gem', color: 'text-blue-400', level: '富裕', approvalCap: 95 };
    } else {
        return { icon: 'Crown', color: 'text-purple-400', level: '奢华', approvalCap: 100 };
    }
}
