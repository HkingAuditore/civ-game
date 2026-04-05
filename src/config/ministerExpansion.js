// 部长自动扩建参数（缺口驱动模式）
// 扩建决策逻辑：只要某建筑存在供应缺口（shortageScore > 0）且岗位已满、预算够，大臣即扩建。
// 不设 ROI 门槛，体现"计划投资解决短缺"而非"逐利投资"的语义。
export const MINISTER_EXPANSION_CONFIG = {
    // 全局与单部长冷却（天）
    globalCooldownDays: 5,
    ministerCooldownDays: 10,

    // 岗位填充率下限（低于此值不扩建，避免劳动力不足时盲目扩建）
    minStaffingRatio: 0.95,

    // 单次触发最多扩建座数（用于控制节奏与性能）
    maxBuildsPerTrigger: 3,

    // 单次触发预算限制
    // 实际预算 = min(国库银币 * budgetRatio, maxSilverPerTrigger)
    budgetRatio: 0.2,
    maxSilverPerTrigger: 5000,
};

