/**
 * 外交成本计算工具函数
 * 统一管理送礼、求和赔款和分期付款的计算逻辑
 */

// ==================== 配置常量 ====================

/** 分期付款配置 */
export const INSTALLMENT_CONFIG = {
    TOTAL_MULTIPLIER: 5,  // 分期总额是单次赔款的5倍（原3倍）
    DURATION_DAYS: 365,    // 分期持续天数（1年）
};

/** 赔款计算系数 - 大幅提高以匹配战争成本 */
const PEACE_PAYMENT_COEFFICIENTS = {
    demanding: { high: 250, standard: 180, low: 120 },   // 玩家索赔（己方优势）- 大幅提高
    offering: { high: 120, standard: 90, low: 60 },      // 玩家求和（己方劣势）- 适度提高
};

/** 赔款硬上限 */
const PEACE_PAYMENT_HARD_CAP = 2000000;

// ==================== 送礼计算 ====================

/**
 * 计算动态送礼成本
 * 成本 = min(双方财富) × 5%，限制在 100 ~ 500000 范围内
 * @param {number} playerWealth - 玩家财富
 * @param {number} targetNationWealth - 目标国家财富
 * @returns {number} 送礼成本
 */
export function calculateDynamicGiftCost(playerWealth, targetNationWealth) {
    const minWealth = Math.min(playerWealth || 0, targetNationWealth || 0);
    const baseCost = Math.floor(minWealth * 0.05);
    return Math.max(100, Math.min(500000, baseCost));
}

/**
 * 计算AI送礼金额（AI向玩家或AI向AI）
 * @param {number} senderWealth - 送礼方财富
 * @param {number} receiverWealth - 收礼方财富（可选）
 * @returns {number} 送礼金额
 */
export function calculateAIGiftAmount(senderWealth, receiverWealth = null) {
    const baseWealth = receiverWealth
        ? Math.min(senderWealth || 0, receiverWealth || 0)
        : (senderWealth || 0);
    const giftAmount = Math.floor(baseWealth * 0.02);
    return Math.max(30, Math.min(10000, giftAmount));
}

/**
 * 计算盟友维护送礼成本
 * @param {number} playerWealth - 玩家财富
 * @param {number} allyWealth - 盟友财富
 * @returns {number} 送礼成本
 */
export function calculateAllyMaintenanceCost(playerWealth, allyWealth) {
    const minWealth = Math.min(playerWealth || 0, allyWealth || 0);
    const baseCost = Math.floor(minWealth * 0.03);
    return Math.max(80, Math.min(300000, baseCost));
}

/**
 * 计算动态挑拨费用
 * 成本 = min(双方财富) × 3%，限制在 150 ~ 300000 范围内
 * @param {number} playerWealth - 玩家财富
 * @param {number} targetNationWealth - 目标国家财富
 * @returns {number} 挑拨成本
 */
export function calculateProvokeCost(playerWealth, targetNationWealth) {
    const minWealth = Math.min(playerWealth || 0, targetNationWealth || 0);
    const baseCost = Math.floor(minWealth * 0.03);
    return Math.max(150, Math.min(300000, baseCost));
}

// ==================== 求和赔款计算 ====================


/**
 * 统一的求和赔款计算函数
 * @param {number} warScore - 战争分数（正数=己方优势）
 * @param {number} enemyLosses - 敌方损失
 * @param {number} warDuration - 战争持续时间（天）
 * @param {number} targetWealth - 目标国家财富
 * @param {'demanding'|'offering'} mode - 索赔还是求和
 * @returns {Object} { high, standard, low } 三档赔款金额
 */
export function calculatePeacePayment(warScore, enemyLosses, warDuration, targetWealth, mode = 'demanding') {
    const absScore = Math.abs(warScore || 0);
    const losses = enemyLosses || 0;
    const duration = warDuration || 0;
    const wealth = targetWealth || 0;

    const coef = PEACE_PAYMENT_COEFFICIENTS[mode] || PEACE_PAYMENT_COEFFICIENTS.demanding;

    // 计算各档赔款 - 大幅提高敌方损失的权重（每个敌军损失约50-80银币赔偿）
    const rawHigh = Math.ceil(absScore * coef.high + losses * 80 + duration * 25);
    const rawStandard = Math.ceil(absScore * coef.standard + losses * 50 + duration * 18);
    const rawLow = Math.ceil(absScore * coef.low + losses * 35 + duration * 12);

    // 添加基于敌方财富的保底赔款（至少索要敌方财富的一定比例）
    const wealthFloorHigh = Math.floor(wealth * 0.35);      // 高档至少35%财富
    const wealthFloorStandard = Math.floor(wealth * 0.25);  // 标准档至少25%财富
    const wealthFloorLow = Math.floor(wealth * 0.15);       // 低档至少15%财富

    // 应用上限（硬上限和目标财富的较小值）
    const wealthHeadroom = Math.max(50000, wealth * 2 + 50000);
    const effectiveCap = Math.min(PEACE_PAYMENT_HARD_CAP, wealthHeadroom);

    return {
        high: Math.max(1500, wealthFloorHigh, Math.min(effectiveCap, rawHigh)),
        standard: Math.max(1000, wealthFloorStandard, Math.min(effectiveCap, rawStandard)),
        low: Math.max(500, wealthFloorLow, Math.min(effectiveCap, rawLow)),
    };
}

/**
 * 计算AI主动求和时的赔款金额
 * @param {number} warScore - 战争分数
 * @param {number} enemyLosses - AI损失
 * @param {number} warDuration - 战争持续时间
 * @param {number} aiWealth - AI财富
 * @returns {number} 赔款金额
 */
export function calculateAIPeaceTribute(warScore, enemyLosses, warDuration, aiWealth) {
    const payment = calculatePeacePayment(warScore, enemyLosses, warDuration, aiWealth, 'offering');
    return payment.standard;
}

/**
 * 计算AI要求玩家投降时的索赔金额
 * @param {number} aiWarScore - AI优势分数（正数）
 * @param {number} warDuration - 战争持续时间
 * @param {number} playerWealth - 玩家财富（用于计算合理赔款）
 * @returns {number} 索赔金额
 */
export function calculateAISurrenderDemand(aiWarScore, warDuration, playerWealth = 10000) {
    // 使用玩家财富作为基准，与玩家主动求和时的算法保持一致
    // 使用 'offering' 模式（与玩家主动投降时相同），这样赔款系数会更合理
    const payment = calculatePeacePayment(aiWarScore, 0, warDuration, playerWealth, 'offering');
    return payment.standard;
}

// ==================== 分期付款计算 ====================

/**
 * 统一的分期付款计算函数
 * @param {number} baseAmount - 基础赔款金额
 * @returns {Object} { totalAmount, dailyAmount, durationDays }
 */
export function calculateInstallmentPlan(baseAmount) {
    const totalAmount = Math.ceil((baseAmount || 0) * INSTALLMENT_CONFIG.TOTAL_MULTIPLIER);
    const dailyAmount = Math.ceil(totalAmount / INSTALLMENT_CONFIG.DURATION_DAYS);
    return {
        totalAmount,
        dailyAmount,
        durationDays: INSTALLMENT_CONFIG.DURATION_DAYS,
    };
}
