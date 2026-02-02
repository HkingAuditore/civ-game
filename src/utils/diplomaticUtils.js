/**
 * 外交成本计算工具函数
 * 统一管理送礼、求和赔款和分期付款的计算逻辑
 */

// ==================== 配置常量 ====================

/** 分期付款配置 */
export const INSTALLMENT_CONFIG = {
    TOTAL_MULTIPLIER: 3.5,  // 分期总额是单次赔款的3.5倍
    DURATION_DAYS: 1095,    // 分期持续天数（3年）
};

/** 赔款计算系数 - [NERFED] 削弱50%以防止银币溢出 */
const PEACE_PAYMENT_COEFFICIENTS = {
    demanding: { high: 120, standard: 80, low: 50 },    // 玩家索赔（己方优势）
    offering: { high: 60, standard: 40, low: 25 },      // 玩家求和（己方劣势）
};

/** 赔款硬上限 */
const PEACE_PAYMENT_HARD_CAP = 200000000;

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
 * @param {number} playerTotalWarExpense - 玩家战争期间总军费支出（可选）
 * @returns {Object} { high, standard, low } 三档赔款金额
 */
export function calculatePeacePayment(warScore, enemyLosses, warDuration, targetWealth, mode = 'demanding', playerTotalWarExpense = 0) {
    const absScore = Math.abs(warScore || 0);
    const losses = enemyLosses || 0;
    const duration = warDuration || 0;
    const wealth = targetWealth || 0;
    const warExpense = playerTotalWarExpense || 0;

    const coef = PEACE_PAYMENT_COEFFICIENTS[mode] || PEACE_PAYMENT_COEFFICIENTS.demanding;

    // === 方案B：军费作为赔款计算要素 ===
    // 基础赔款组成：
    // 1. 战争分数贡献
    // 2. 敌方损失贡献（每人约50-80银币）
    // 3. 战争持续时间贡献
    // 4. 玩家军费投入贡献（新增！占比30%）

    const scoreComponent = absScore * coef.high;
    const lossComponent = losses * 80;
    const durationComponent = duration * 25;
    // 军费贡献：战争期间总军费的30%可以作为赔款索取
    const expenseComponent = warExpense * 0.3;

    const rawHigh = Math.ceil(scoreComponent + lossComponent + durationComponent + expenseComponent);
    const rawStandard = Math.ceil(
        absScore * coef.standard + losses * 50 + duration * 18 + warExpense * 0.2
    );
    const rawLow = Math.ceil(
        absScore * coef.low + losses * 35 + duration * 12 + warExpense * 0.1
    );

    // 添加基于敌方财富的保底赔款 - [NERFED] 降低比例以防止银币溢出
    const wealthFloorHigh = Math.floor(wealth * 0.18);      // 高档至少18%财富
    const wealthFloorStandard = Math.floor(wealth * 0.12);  // 标准档至少12%财富
    const wealthFloorLow = Math.floor(wealth * 0.06);       // 低档至少6%财富

    // 应用上限 - 严格限制赔款不超过敌国财富的50%
    // 修正：防止从2M财富敌国榨出10M赔款的超模情况
    const strictWealthCap = wealth * 0.5;  // 单次赔款上限为敌国财富50%
    const wealthHeadroom = Math.max(50000, strictWealthCap);

    // 军费上限：最多索取战争期间总军费的 (1 + warScore/100)
    // 例如：warScore=100 → 最多索取2倍军费
    let armyExpenseCap = PEACE_PAYMENT_HARD_CAP;
    if (warExpense > 0 && mode === 'demanding') {
        const warScoreMultiplier = 1 + absScore / 100;
        armyExpenseCap = warExpense * warScoreMultiplier;
        // 保底：至少能索取50%的战争军费
        armyExpenseCap = Math.max(warExpense * 0.5, armyExpenseCap);
    }

    const effectiveCap = Math.min(PEACE_PAYMENT_HARD_CAP, wealthHeadroom, armyExpenseCap);

    // Ensure wealthFloor values are also capped by effectiveCap to prevent overflow
    const cappedWealthFloorHigh = Math.min(effectiveCap, wealthFloorHigh);
    const cappedWealthFloorStandard = Math.min(effectiveCap, wealthFloorStandard);
    const cappedWealthFloorLow = Math.min(effectiveCap, wealthFloorLow);

    return {
        high: Math.max(600, cappedWealthFloorHigh, Math.min(effectiveCap, rawHigh)),
        standard: Math.max(400, cappedWealthFloorStandard, Math.min(effectiveCap, rawStandard)),
        low: Math.max(200, cappedWealthFloorLow, Math.min(effectiveCap, rawLow)),
        // 返回详细信息用于调试/显示
        breakdown: {
            scoreComponent,
            lossComponent,
            durationComponent,
            expenseComponent,
            rawHigh,
            rawStandard,
            rawLow
        },
        caps: {
            hardCap: PEACE_PAYMENT_HARD_CAP,
            wealthCap: wealthHeadroom,
            armyExpenseCap,
            effectiveCap
        }
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
