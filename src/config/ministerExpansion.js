// 部长自动扩建参数（复用现有机制，仅将关键阈值配置化）
export const MINISTER_EXPANSION_CONFIG = {
    // 全局与单部长冷却（天）
    globalCooldownDays: 5,
    ministerCooldownDays: 10,

    // 可扩建筛选阈值
    minStaffingRatio: 0.95,
    maxSupplyDemandRatio: 0.8,
    minRoi: 0.3,

    // 单次触发最多扩建座数（用于控制节奏与性能）
    maxBuildsPerTrigger: 3,

    // 单次触发预算限制
    // 实际预算 = min(国库银币 * budgetRatio, maxSilverPerTrigger)
    budgetRatio: 0.2,
    maxSilverPerTrigger: 5000,
};

