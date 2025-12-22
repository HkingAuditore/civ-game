/**
 * 执政联盟（Ruling Coalition）系统
 * 管理玩家与各阶层的联合执政关系
 * 
 * 核心机制：
 * - 玩家选择与哪些阶层联合执政
 * - 联盟阶层影响力≥40%时为合法政府
 * - 合法性影响税收效率
 * - 联盟阶层有更高的期望和更低的不满阈值
 */

import { STRATA } from '../config/strata';

// ============ 常量定义 ============

// 合法性阈值：联盟影响力占比需≥40%才为合法政府
export const LEGITIMACY_THRESHOLD = 0.40;

// 合法性等级
export const LEGITIMACY_LEVEL = {
    HIGH: 'high',           // ≥80%
    MEDIUM: 'medium',       // 60%-79%
    LOW: 'low',             // 40%-59%
    ILLEGITIMATE: 'illegitimate', // <40%
};

// 联盟阶层的 ApprovalCap 惩罚（按生活水平等级）
export const COALITION_APPROVAL_CAP_PENALTY = {
    '赤贫': 10,
    '贫困': 10,
    '温饱': 15,
    '小康': 15,
    '富裕': 10,
    '奢华': 0,
};

// 联盟阶层敏感度配置
// 联盟阶层对不满因素更敏感，组织度增长更快
export const COALITION_SENSITIVITY = {
    // 税收负担阈值：普通50%，联盟20%（更低容忍度）
    TAX_THRESHOLD_NORMAL: 0.50,
    TAX_THRESHOLD_COALITION: 0.20,  // 0.25 -> 0.20

    // 收入目标乘数：普通1.08，联盟1.60（更高预期）
    INCOME_MULTIPLIER_NORMAL: 1.08,
    INCOME_MULTIPLIER_COALITION: 1.60,  // 1.40 -> 1.60

    // 基础短缺压力系数：普通0.6，联盟1.2
    BASIC_SHORTAGE_PRESSURE_NORMAL: 0.6,
    BASIC_SHORTAGE_PRESSURE_COALITION: 1.2,  // 0.9 -> 1.2

    // 奢侈短缺压力系数：普通0.2，联盟0.5
    LUXURY_SHORTAGE_PRESSURE_NORMAL: 0.2,
    LUXURY_SHORTAGE_PRESSURE_COALITION: 0.5,  // 0.35 -> 0.5
};

// ============ 核心函数 ============

/**
 * 计算联盟阶层的总影响力占比
 * @param {string[]} coalitionMembers - 联盟成员阶层键数组
 * @param {Object} classInfluence - 各阶层影响力 { stratumKey: influenceValue }
 * @param {number} totalInfluence - 总影响力
 * @returns {number} 联盟影响力占比 (0-1)
 */
export function calculateCoalitionInfluenceShare(coalitionMembers, classInfluence, totalInfluence) {
    if (!Array.isArray(coalitionMembers) || coalitionMembers.length === 0) {
        return 0;
    }
    if (totalInfluence <= 0) {
        return 0;
    }

    let coalitionInfluence = 0;
    coalitionMembers.forEach(stratumKey => {
        coalitionInfluence += classInfluence[stratumKey] || 0;
    });

    return coalitionInfluence / totalInfluence;
}

/**
 * 根据影响力占比和联盟满意度计算合法性值
 * 合法性 = 影响力占比 × 100 × 满意度因子
 * 满意度因子：联盟成员平均满意度低于50时会降低合法性
 * @param {number} influenceShare - 联盟影响力占比 (0-1)
 * @param {Object} options - 可选参数
 * @param {Object} options.classApproval - 各阶层满意度
 * @param {string[]} options.coalitionMembers - 联盟成员列表
 * @param {Object} options.classInfluence - 各阶层影响力（用于加权平均）
 * @returns {number} 合法性值 (0-100)
 */
export function calculateLegitimacy(influenceShare, options = {}) {
    const { classApproval = {}, coalitionMembers = [], classInfluence = {} } = options;

    // 基础合法性 = 影响力占比 × 100
    let baseLegitimacy = influenceShare * 100;

    // 计算联盟成员的加权平均满意度
    if (coalitionMembers.length > 0 && Object.keys(classApproval).length > 0) {
        let totalWeight = 0;
        let weightedApproval = 0;

        coalitionMembers.forEach(key => {
            const approval = classApproval[key] ?? 50;
            const influence = classInfluence[key] || 1;
            weightedApproval += approval * influence;
            totalWeight += influence;
        });

        const avgApproval = totalWeight > 0 ? weightedApproval / totalWeight : 50;

        // 满意度因子：
        // - 满意度 >= 50：无惩罚（因子 = 1.0）
        // - 满意度 < 50：合法性按比例降低（最低降至50%）
        // 公式：factor = 0.5 + (avgApproval / 100)，范围 [0.5, 1.0]
        if (avgApproval < 50) {
            const approvalFactor = 0.5 + (avgApproval / 100);
            baseLegitimacy *= approvalFactor;
        }
    }

    return Math.min(100, Math.max(0, baseLegitimacy));
}

/**
 * 获取合法性等级
 * @param {number} legitimacy - 合法性值 (0-100)
 * @returns {string} 合法性等级
 */
export function getLegitimacyLevel(legitimacy) {
    if (legitimacy >= 80) return LEGITIMACY_LEVEL.HIGH;
    if (legitimacy >= 60) return LEGITIMACY_LEVEL.MEDIUM;
    if (legitimacy >= 40) return LEGITIMACY_LEVEL.LOW;
    return LEGITIMACY_LEVEL.ILLEGITIMATE;
}

/**
 * 获取合法性等级的显示信息
 * @param {string} level - 合法性等级
 * @returns {Object} { name, color, icon, description }
 */
export function getLegitimacyLevelInfo(level) {
    switch (level) {
        case LEGITIMACY_LEVEL.HIGH:
            return {
                name: '高合法性',
                color: 'text-green-400',
                bgColor: 'bg-green-900/20',
                borderColor: 'border-green-500/30',
                icon: 'Crown',
                description: '政府获得广泛支持',
            };
        case LEGITIMACY_LEVEL.MEDIUM:
            return {
                name: '中合法性',
                color: 'text-blue-400',
                bgColor: 'bg-blue-900/20',
                borderColor: 'border-blue-500/30',
                icon: 'Shield',
                description: '政府运转正常',
            };
        case LEGITIMACY_LEVEL.LOW:
            return {
                name: '低合法性',
                color: 'text-yellow-400',
                bgColor: 'bg-yellow-900/20',
                borderColor: 'border-yellow-500/30',
                icon: 'AlertTriangle',
                description: '政府勉强维持',
            };
        case LEGITIMACY_LEVEL.ILLEGITIMATE:
        default:
            return {
                name: '非法政府',
                color: 'text-red-400',
                bgColor: 'bg-red-900/20',
                borderColor: 'border-red-500/30',
                icon: 'AlertCircle',
                description: '政府缺乏支持，摇摇欲坠',
            };
    }
}

/**
 * 获取合法性对税收的修正系数（线性映射）
 * 合法性 0 → 0.3倍税收效率
 * 合法性 100 → 1.5倍税收效率
 * @param {number} legitimacy - 合法性值 (0-100)
 * @returns {number} 税收修正系数 (0.3 ~ 1.0)
 */
export function getLegitimacyTaxModifier(legitimacy) {
    // 线性映射：legitimacy [0, 100] → modifier [0.3, 1.5]
    // modifier = 0.3 + (legitimacy / 100) * (1.5 - 0.3)
    // modifier = 0.3 + legitimacy * 0.012
    const clampedLegitimacy = Math.min(100, Math.max(0, legitimacy));
    return 0.3 + (clampedLegitimacy / 100) * 0.7;
}

/**
 * 获取合法性对满意度的修正值（仅非法政府有惩罚）
 * @param {number} legitimacy - 合法性值 (0-100)
 * @returns {number} 满意度修正值（负数为惩罚）
 */
export function getLegitimacyApprovalModifier(legitimacy) {
    const level = getLegitimacyLevel(legitimacy);
    if (level === LEGITIMACY_LEVEL.ILLEGITIMATE) {
        return -15;  // 非法政府：全民满意度-15
    }
    return 0;
}

/**
 * 检查阶层是否为联盟成员
 * @param {string} stratumKey - 阶层键
 * @param {string[]} coalitionMembers - 联盟成员列表
 * @returns {boolean}
 */
export function isCoalitionMember(stratumKey, coalitionMembers) {
    return Array.isArray(coalitionMembers) && coalitionMembers.includes(stratumKey);
}

/**
 * 获取联盟阶层的 ApprovalCap 惩罚值
 * @param {string} livingStandardLevel - 生活水平等级名称
 * @param {boolean} isCoalition - 是否为联盟成员
 * @returns {number} 惩罚值（从原始approvalCap中减去）
 */
export function getCoalitionApprovalCapPenalty(livingStandardLevel, isCoalition) {
    if (!isCoalition) return 0;
    return COALITION_APPROVAL_CAP_PENALTY[livingStandardLevel] || 0;
}

/**
 * 获取联盟阶层的敏感度配置
 * @param {boolean} isCoalition - 是否为联盟成员
 * @returns {Object} 敏感度配置
 */
export function getCoalitionSensitivity(isCoalition) {
    if (isCoalition) {
        return {
            taxThreshold: COALITION_SENSITIVITY.TAX_THRESHOLD_COALITION,
            incomeMultiplier: COALITION_SENSITIVITY.INCOME_MULTIPLIER_COALITION,
            basicShortagePressure: COALITION_SENSITIVITY.BASIC_SHORTAGE_PRESSURE_COALITION,
            luxuryShortagePressure: COALITION_SENSITIVITY.LUXURY_SHORTAGE_PRESSURE_COALITION,
        };
    }
    return {
        taxThreshold: COALITION_SENSITIVITY.TAX_THRESHOLD_NORMAL,
        incomeMultiplier: COALITION_SENSITIVITY.INCOME_MULTIPLIER_NORMAL,
        basicShortagePressure: COALITION_SENSITIVITY.BASIC_SHORTAGE_PRESSURE_NORMAL,
        luxuryShortagePressure: COALITION_SENSITIVITY.LUXURY_SHORTAGE_PRESSURE_NORMAL,
    };
}

/**
 * 获取可选为联盟成员的阶层列表
 * （排除失业者、奴隶等不能参与政治的阶层）
 * @param {Object} popStructure - 人口结构
 * @returns {string[]} 可选阶层键数组
 */
export function getEligibleCoalitionStrata(popStructure = {}) {
    const ineligible = new Set(['unemployed', 'slave']);

    return Object.keys(STRATA).filter(key => {
        // 排除不能参与政治的阶层
        if (ineligible.has(key)) return false;
        // 排除没有人口的阶层
        if ((popStructure[key] || 0) <= 0) return false;
        return true;
    });
}

/**
 * 获取合法性对非联盟阶层组织度增长的修正系数
 * 高合法性 -> 非联盟阶层组织度增长缓慢
 * 低合法性/非法 -> 组织度增长更快
 * 联盟成员有额外增长加成
 * @param {number} legitimacy - 合法性值 (0-100)
 * @param {boolean} isCoalitionMember - 是否为联盟成员
 * @returns {number} 组织度增长速度乘数
 */
export function getLegitimacyOrganizationModifier(legitimacy, isCoalitionMember) {
    // 联盟成员有额外的组织度增长加成（他们的期望更高，更容易不满）
    if (isCoalitionMember) {
        return 1.5;  // 联盟成员：组织度增长速度 +50%
    }

    const level = getLegitimacyLevel(legitimacy);
    switch (level) {
        case LEGITIMACY_LEVEL.HIGH:
            return 0.3;  // 高合法性：非联盟阶层组织度增长速度降至30%
        case LEGITIMACY_LEVEL.MEDIUM:
            return 0.6;  // 中合法性：降至60%
        case LEGITIMACY_LEVEL.LOW:
            return 1.0;  // 低合法性：正常速度
        case LEGITIMACY_LEVEL.ILLEGITIMATE:
        default:
            return 1.5;  // 非法政府：增长速度提升50%
    }
}
