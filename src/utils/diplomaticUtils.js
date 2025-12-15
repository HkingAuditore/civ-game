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

/** 赔款计算系数 */
const PEACE_PAYMENT_COEFFICIENTS = {
    demanding: { high: 90, standard: 60, low: 45 },   // 玩家索赔（己方优势）
    offering: { high: 52, standard: 45, low: 30 },    // 玩家求和（己方劣势）
};

/** 赔款硬上限 */
const PEACE_PAYMENT_HARD_CAP = 800000;

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

    const coef = PEACE_PAYMENT_COEFFICIENTS[mode] || PEACE_PAYMENT_COEFFICIENTS.demanding;

    // 计算各档赔款
    const rawHigh = Math.ceil(absScore * coef.high + losses * 5 + duration * 8);
    const rawStandard = Math.ceil(absScore * coef.standard + losses * 3 + duration * 6);
    const rawLow = Math.ceil(absScore * coef.low + losses * 2 + duration * 4);

    // 应用上限（硬上限和目标财富的较小值）
    const effectiveCap = Math.min(PEACE_PAYMENT_HARD_CAP, targetWealth || PEACE_PAYMENT_HARD_CAP);

    return {
        high: Math.max(250, Math.min(effectiveCap, rawHigh)),
        standard: Math.max(150, Math.min(effectiveCap, rawStandard)),
        low: Math.max(80, Math.min(effectiveCap, rawLow)),
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
 * @returns {number} 索赔金额
 */
export function calculateAISurrenderDemand(aiWarScore, warDuration) {
    const payment = calculatePeacePayment(aiWarScore, 0, warDuration, PEACE_PAYMENT_HARD_CAP, 'demanding');
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
