/**
 * 生活水平计算工具函数
 * 用于计算各阶层的生活水平数据
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
 * 计算财富乘数（消费能力）
 * @param {number} wealthRatio - 财富比率（人均财富 / 基准财富）
 * @returns {number} 财富乘数
 */
export function calculateWealthMultiplier(wealthRatio) {
  let wealthMultiplier;
  if (wealthRatio <= 0) {
    wealthMultiplier = 0.3;
  } else if (wealthRatio < 1) {
    wealthMultiplier = 0.3 + wealthRatio * 0.7;
  } else {
    wealthMultiplier = Math.sqrt(wealthRatio) * (1 + Math.log(wealthRatio) * 0.25);
  }
  return Math.max(0.3, Math.min(6.0, wealthMultiplier));
}

/**
 * 根据财富比率和奢侈需求解锁情况确定生活水平等级
 * @param {number} wealthRatio - 财富比率
 * @param {number} satisfactionRate - 需求满足率（0-1）
 * @param {number} luxuryUnlockRatio - 奢侈需求解锁比例（0-1）
 * @returns {object} 生活水平等级信息
 */
export function getLivingStandardLevel(wealthRatio, satisfactionRate = 1, luxuryUnlockRatio = 0) {
  if (wealthRatio < 0.5) {
    return LIVING_STANDARD_LEVELS.DESTITUTE;
  }
  if (wealthRatio < 1 || satisfactionRate < 0.5) {
    return LIVING_STANDARD_LEVELS.POOR;
  }
  // 温饱：财富刚好够基础需求，但还没有富裕需求
  if (wealthRatio < 2 || luxuryUnlockRatio === 0) {
    return LIVING_STANDARD_LEVELS.SUBSISTENCE;
  }
  // 小康：开始解锁一些富裕需求，但不到30%
  if (wealthRatio < 4 || luxuryUnlockRatio < 0.3) {
    return LIVING_STANDARD_LEVELS.COMFORTABLE;
  }
  // 富裕：解锁了相当多的富裕需求，但不到70%
  if (wealthRatio < 8 || luxuryUnlockRatio < 0.7) {
    return LIVING_STANDARD_LEVELS.PROSPEROUS;
  }
  // 奢华：财富极高且解锁了绝大多数富裕需求
  return LIVING_STANDARD_LEVELS.LUXURIOUS;
}

/**
 * 计算生活水平综合评分
 * @param {number} wealthRatio - 财富比率
 * @param {number} satisfactionRate - 需求满足率（0-1）
 * @param {number} luxuryUnlockRatio - 奢侈需求解锁比例（0-1）
 * @returns {number} 综合评分（0-100）
 */
export function calculateLivingStandardScore(wealthRatio, satisfactionRate, luxuryUnlockRatio) {
  // Score composition: wealth ratio (capped at 10x), satisfaction, luxury unlock
  const wealthScore = Math.min(40, wealthRatio * 4); // Max 40 points at 10x wealth
  const satisfactionScore = satisfactionRate * 30; // Max 30 points at 100% satisfaction
  const luxuryScore = luxuryUnlockRatio * 30; // Max 30 points at 100% luxury unlocked
  return Math.min(100, wealthScore + satisfactionScore + luxuryScore);
}

/**
 * 计算阶层的完整生活水平数据
 * @param {object} params - 参数对象
 * @param {number} params.count - 阶层人口数量
 * @param {number} params.wealthValue - 阶层总财富
 * @param {number} params.startingWealth - 基准财富（每人）
 * @param {number} params.shortagesCount - 短缺资源数量
 * @param {number} params.effectiveNeedsCount - 有效需求总数
 * @param {number} params.unlockedLuxuryTiers - 已解锁的奢侈需求档位数
 * @param {number} params.totalLuxuryTiers - 总奢侈需求档位数
 * @returns {object} 完整的生活水平数据
 */
export function calculateLivingStandardData({
  count,
  wealthValue,
  startingWealth,
  shortagesCount = 0,
  effectiveNeedsCount = 0,
  unlockedLuxuryTiers = 0,
  totalLuxuryTiers = 0,
}) {
  // 计算人均财富和财富比率
  const wealthPerCapita = count > 0 ? wealthValue / count : 0;
  const wealthRatio = startingWealth > 0 ? wealthPerCapita / startingWealth : 0;
  
  // 计算消费能力乘数
  const wealthMultiplier = calculateWealthMultiplier(wealthRatio);
  
  // 计算需求满足率
  const satisfactionRate = effectiveNeedsCount > 0 
    ? Math.max(0, (effectiveNeedsCount - shortagesCount) / effectiveNeedsCount)
    : 1;
  
  // 计算奢侈需求解锁比例
  const luxuryUnlockRatio = totalLuxuryTiers > 0 ? unlockedLuxuryTiers / totalLuxuryTiers : 0;
  
  // 获取生活水平等级
  const livingStandard = getLivingStandardLevel(wealthRatio, satisfactionRate, luxuryUnlockRatio);
  
  // 计算综合评分
  const score = calculateLivingStandardScore(wealthRatio, satisfactionRate, luxuryUnlockRatio);
  
  return {
    wealthPerCapita,
    wealthRatio,
    wealthMultiplier,
    satisfactionRate,
    luxuryUnlockRatio,
    unlockedLuxuryTiers,
    totalLuxuryTiers,
    level: livingStandard.level,
    icon: livingStandard.icon,
    color: livingStandard.color,
    bgColor: livingStandard.bgColor,
    borderColor: livingStandard.borderColor,
    approvalCap: livingStandard.approvalCap, // 满意度上限
    score,
  };
}

/**
 * 简化版本：仅基于财富比率快速计算生活水平图标和颜色
 * 适用于列表视图等简单场景
 * @param {number} wealthRatio - 财富比率
 * @returns {object} { icon, color, level, approvalCap }
 */
export function getSimpleLivingStandard(wealthRatio) {
  if (wealthRatio < 0.5) {
    return { icon: 'Skull', color: 'text-gray-400', level: '赤贫', approvalCap: 30 };
  } else if (wealthRatio < 1) {
    return { icon: 'AlertTriangle', color: 'text-red-400', level: '贫困', approvalCap: 50 };
  } else if (wealthRatio < 2) {
    return { icon: 'UtensilsCrossed', color: 'text-yellow-400', level: '温饱', approvalCap: 70 };
  } else if (wealthRatio < 4) {
    return { icon: 'Home', color: 'text-green-400', level: '小康', approvalCap: 85 };
  } else if (wealthRatio < 8) {
    return { icon: 'Gem', color: 'text-blue-400', level: '富裕', approvalCap: 95 };
  } else {
    return { icon: 'Crown', color: 'text-purple-400', level: '奢华', approvalCap: 100 };
  }
}
