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
 * 新算法：同时考虑收入、财富和阶层弹性
 * - 收入决定"赚钱能力"（有多少钱进账）
 * - 财富决定"消费意愿"（敢不敢花钱）
 * - 弹性决定"消费增长速度"（收入增加时消费增长多快）
 * @param {number} incomeRatio - 收入比率（人均收入 / 基础成本）
 * @param {number} wealthRatio - 财富比率（人均财富 / 基准财富）
 * @param {number} wealthElasticity - 财富弹性系数（0.3=底层, 1.0=基准, 1.8=顶层）
 * @param {number} maxMultiplier - 消费倍数上限（底层3, 中层6, 上层10）
 * @returns {number} 财富乘数
 */
export function calculateWealthMultiplier(incomeRatio, wealthRatio = 1, wealthElasticity = 1.0, maxMultiplier = 6.0) {
    // 1. 基于收入的消费能力（理论上限）
    let incomeMultiplier;
    if (incomeRatio <= 0) {
        incomeMultiplier = 0.3;
    } else if (incomeRatio < 1) {
        // 弹性系数影响收入不足时的消费意愿
        // 低弹性阶层即使收入低也会尽量维持基本消费
        incomeMultiplier = 0.3 + incomeRatio * 0.7 * Math.min(1.2, wealthElasticity);
    } else {
        // 高弹性阶层：收入增加时消费能力增长更快
        const baseGrowth = Math.sqrt(incomeRatio) * (1 + Math.log(incomeRatio) * 0.25);
        // 使用弹性系数调节增长速度
        incomeMultiplier = 1 + (baseGrowth - 1) * wealthElasticity;
    }

    // 2. 基于财富的消费意愿（约束因子）
    // 穷人即使收入高也不敢消费太多
    let wealthFactor;
    if (wealthRatio < 0.3) {
        // 赤贫：只敢消费基础的 40%
        wealthFactor = 0.4;
    } else if (wealthRatio < 1) {
        // 贫困到温饱：逐渐增加消费意愿
        wealthFactor = 0.4 + (wealthRatio - 0.3) * 0.86; // 0.4 → 1.0
    } else if (wealthRatio < 2) {
        // 小康：正常消费
        wealthFactor = 1.0;
    } else {
        // 富裕：略微增加消费意愿（有钱任性）
        // 高弹性阶层更愿意挥霍
        wealthFactor = Math.min(1.3 + (wealthElasticity - 1) * 0.1, 1.0 + (wealthRatio - 2) * 0.05 * wealthElasticity);
    }

    // 3. 最终消费能力 = 收入能力 × 财富意愿
    const wealthMultiplier = incomeMultiplier * wealthFactor;

    // 使用阶层配置的上限（底层3倍, 中层6倍, 上层10倍）
    return Math.max(0.3, Math.min(maxMultiplier, wealthMultiplier));
}

/**
 * 计算解锁乘数（用于奢侈需求解锁判断）
 * 与 calculateWealthMultiplier 区别：不受阶层消费上限限制
 * 这样即使底层阶级消费能力被限制在3倍，也能解锁所有奢侈需求档位
 * @param {number} incomeRatio - 收入比率（人均收入 / 基础成本）
 * @param {number} wealthRatio - 财富比率（人均财富 / 基准财富）
 * @param {number} wealthElasticity - 财富弹性系数（0.3=底层, 1.0=基准, 1.8=顶层）
 * @returns {number} 解锁乘数（无阶级上限限制）
 */
export function calculateUnlockMultiplier(incomeRatio, wealthRatio = 1, wealthElasticity = 1.0) {
    // 1. 基于收入的消费能力（理论上限）
    let incomeMultiplier;
    if (incomeRatio <= 0) {
        incomeMultiplier = 0.3;
    } else if (incomeRatio < 1) {
        incomeMultiplier = 0.3 + incomeRatio * 0.7 * Math.min(1.2, wealthElasticity);
    } else {
        const baseGrowth = Math.sqrt(incomeRatio) * (1 + Math.log(incomeRatio) * 0.25);
        incomeMultiplier = 1 + (baseGrowth - 1) * wealthElasticity;
    }

    // 2. 基于财富的消费意愿
    let wealthFactor;
    if (wealthRatio < 0.3) {
        wealthFactor = 0.4;
    } else if (wealthRatio < 1) {
        wealthFactor = 0.4 + (wealthRatio - 0.3) * 0.86;
    } else if (wealthRatio < 2) {
        wealthFactor = 1.0;
    } else {
        wealthFactor = Math.min(1.3 + (wealthElasticity - 1) * 0.1, 1.0 + (wealthRatio - 2) * 0.05 * wealthElasticity);
    }

    // 3. 解锁乘数 = 收入能力 × 财富意愿（使用固定上限10，让所有阶级都能解锁全部奢侈需求）
    const unlockMultiplier = incomeMultiplier * wealthFactor;
    return Math.max(0.3, Math.min(10.0, unlockMultiplier));
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
 * @param {number} wealthRatio - 财富比率（人均财富 / 基准财富）
 * @param {number} wealthPerCapita - 人均财富（绝对值）
 * @returns {number} 综合评分 (0-100)
 */
export function calculateLivingStandardScore(incomeAdequacy, satisfactionRate, financialSecurity, wealthRatio = 1, wealthPerCapita = 100) {
    // 收入充裕度 (0-50分) + 需求满足 (0-30分) + 财务安全 (0-20分)
    const satisfactionScore = satisfactionRate * 30;
    let rawScore = incomeAdequacy + satisfactionScore + financialSecurity;

    // ========== 混合评估模型 ==========
    // 结合绝对财富和相对比率两个维度计算评分上限

    // 1. 绝对财富评分 (0-60分)
    // 基于人均财富的绝对值，使用平方根曲线拉开差距
    // 50银币 → ~5分, 100 → ~7分, 200 → ~10分, 500 → ~16分, 1000 → ~22分, 2000 → ~31分, 5000 → ~50分
    let absoluteScore = 0;
    if (wealthPerCapita > 0) {
        absoluteScore = Math.min(60, 0.7 * Math.sqrt(wealthPerCapita));
    }

    // 2. 相对财富评分 (0-50分)
    // 基于 wealthRatio，使用指数衰减曲线
    // ratio=0.5 → ~9分, =1 → ~16分, =2 → ~25分, =4 → ~35分, =10 → ~40分
    let relativeScore = 0;
    if (wealthRatio > 0) {
        relativeScore = Math.min(40, 40 * (1 - Math.exp(-wealthRatio * 0.5)));
    }

    // 3. 财富评分 (0-100分)
    // 绝对财富为主导，相对财富提供阶层期望修正
    const wealthScore = absoluteScore + relativeScore;

    // 4. 加权混合评分
    // rawScore（收入+满足率+财务安全）占主导，wealthScore 作为调整因子
    // 这样即使财富暂时较低，良好的收入和满足率仍能维持较高的生活水平评分
    return rawScore * 0.2 + wealthScore * 0.8;
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
 * @param {number} params.maxConsumptionMultiplier - 阶层消费倍数上限（底层3, 中层6, 上层10）
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
    maxConsumptionMultiplier = 6,
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

    // 计算目标分数（传入财富比率和人均财富作为评分上限约束）
    const targetScore = calculateLivingStandardScore(incomeAdequacyScore, satisfactionRate, financialSecurityScore, realWealthRatio, wealthPerCapita);



    // 4. 平滑过渡
    // 新阶层直接采用目标分数，否则渐进变化
    const ADAPT_RATE = isNewStratum ? 1.0 : 0.15;
    const smoothedScore = previousScore !== null
        ? previousScore * (1 - ADAPT_RATE) + targetScore * ADAPT_RATE
        : targetScore;

    // 根据分数确定等级
    const livingStandard = getLivingStandardByScore(smoothedScore);

    // 计算消费能力乘数（同时考虑收入和财富，使用阶层配置的上限）
    // 当没有基础成本数据时，根据实际收入判断：有收入给予较高值，无收入则为0
    const incomeRatio = essentialCostPerCapita > 0
        ? incomePerCapita / essentialCostPerCapita
        : (incomePerCapita > 0 ? 10 : 0);
    const wealthMultiplier = calculateWealthMultiplier(incomeRatio, realWealthRatio, 1.0, maxConsumptionMultiplier);

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
