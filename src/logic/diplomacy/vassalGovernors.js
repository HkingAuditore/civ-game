/**
 * Vassal Governor System
 * 总督系统：将官员能力与附庸国治理深度整合
 * 
 * 官员属性影响：
 * - Prestige (威望): 独立倾向压制、精英阶层满意度
 * - Administrative (行政): 朝贡效率、腐败减少
 * - Military (军事): 稳定性、叛乱压制
 * - Loyalty (忠诚): 廉政、独立倾向影响
 */

/**
 * 总督效果配置
 */
export const GOVERNOR_EFFECTS_CONFIG = {
    // 基础效果（无总督时）
    base: {
        independenceReduction: 0,
        tributeModifier: 1.0,
        stabilityBonus: 0,
        corruptionRate: 0.05, // 5% baseline corruption
    },

    // 威望加成
    prestige: {
        independencePerPoint: -0.005, // 每点威望 -0.5% 独立倾向增长
        eliteSatisfactionPerPoint: 0.02, // 每点威望 +2% 精英满意度
    },

    // 行政能力加成
    administrative: {
        tributePerPoint: 0.01,       // 每点行政 +1% 朝贡收入
        corruptionReducePerPoint: 0.001, // 每点行政 -0.1% 腐败率
        maxTributeBonus: 0.5,        // 最大朝贡加成 50%
    },

    // 军事能力加成
    military: {
        stabilityPerPoint: 0.01,     // 每点军事 +1% 稳定性
        unrestSuppressionPerPoint: 0.005, // 每点军事 -0.5% 动荡
    },

    // 忠诚度影响
    loyalty: {
        corruptionThreshold: 40,     // 低于此值开始腐败
        severeLoyaltyThreshold: 20,  // 严重低忠诚
        corruptionPerLoyaltyDeficit: 0.002, // 每点忠诚不足 +0.2% 腐败
        independenceRiskPerDeficit: 0.001,  // 每点忠诚不足 +0.1% 独立风险
    },

    // 来源阶层加成
    stratumBonus: {
        nobles: { eliteSatisfaction: 1.3, commonerSatisfaction: 0.8 },
        capitalist: { tributeBonus: 1.2, eliteSatisfaction: 1.0 },
        commoner: { commonerSatisfaction: 1.3, eliteSatisfaction: 0.7 },
        clergy: { stability: 1.2, corruption: 0.8 },
    },

    // 每日成本基数
    dailyCost: {
        base: 30,
        perPrestige: 0.5, // 高威望官员更贵
    },
};

/**
 * 计算总督的完整效果
 * @param {Object} official - 分配的官员对象
 * @param {Object} vassalNation - 附庸国家对象
 * @returns {Object} 效果汇总
 */
export const calculateGovernorFullEffects = (official, vassalNation = {}) => {
    const config = GOVERNOR_EFFECTS_CONFIG;

    if (!official) {
        return {
            hasGovernor: false,
            ...config.base,
            totalCost: 0,
            warnings: ['no_governor_assigned'],
        };
    }

    const prestige = official.prestige ?? 50;
    const administrative = official.administrative ?? official.admin ?? 50;
    const military = official.military ?? official.mil ?? 30;
    const loyalty = official.loyalty ?? 50;
    const sourceStratum = official.sourceStratum || 'commoner';

    // ========== 独立倾向压制 ==========
    const prestigeIndependenceEffect = prestige * config.prestige.independencePerPoint;
    let independenceReduction = -prestigeIndependenceEffect; // 正数表示压制

    // ========== 朝贡效率 ==========
    const adminTributeBonus = Math.min(
        config.administrative.maxTributeBonus,
        administrative * config.administrative.tributePerPoint
    );
    let tributeModifier = 1.0 + adminTributeBonus;

    // ========== 稳定性 ==========
    let stabilityBonus = military * config.military.stabilityPerPoint;

    // ========== 腐败率 ==========
    let corruptionRate = config.base.corruptionRate;
    // 行政能力降低腐败
    corruptionRate -= administrative * config.administrative.corruptionReducePerPoint;
    // 低忠诚增加腐败
    if (loyalty < config.loyalty.corruptionThreshold) {
        const deficit = config.loyalty.corruptionThreshold - loyalty;
        corruptionRate += deficit * config.loyalty.corruptionPerLoyaltyDeficit;
    }
    corruptionRate = Math.max(0, Math.min(0.3, corruptionRate)); // 0-30% 范围

    // 腐败减少朝贡收入
    tributeModifier *= (1 - corruptionRate);

    // ========== 阶层满意度加成 ==========
    let eliteSatisfactionBonus = prestige * config.prestige.eliteSatisfactionPerPoint;
    let commonerSatisfactionBonus = 0;
    const stratumBonus = config.stratumBonus[sourceStratum] || {};
    eliteSatisfactionBonus *= stratumBonus.eliteSatisfaction || 1.0;
    commonerSatisfactionBonus = stratumBonus.commonerSatisfaction || 1.0;
    stabilityBonus *= stratumBonus.stability || 1.0;
    corruptionRate *= stratumBonus.corruption || 1.0;
    tributeModifier *= stratumBonus.tributeBonus || 1.0;

    // ========== 动荡压制 ==========
    const unrestSuppression = military * config.military.unrestSuppressionPerPoint;

    // ========== 低忠诚风险 ==========
    const warnings = [];
    let independenceRiskFromLoyalty = 0;
    if (loyalty < config.loyalty.corruptionThreshold) {
        warnings.push('low_loyalty_corruption_risk');
        independenceRiskFromLoyalty = (config.loyalty.corruptionThreshold - loyalty) *
            config.loyalty.independenceRiskPerDeficit;
    }
    if (loyalty < config.loyalty.severeLoyaltyThreshold) {
        warnings.push('severe_loyalty_danger');
    }

    // ========== 每日成本 ==========
    const dailyCost = config.dailyCost.base + prestige * config.dailyCost.perPrestige;

    // ========== 汇总 ==========
    return {
        hasGovernor: true,
        officialId: official.id,
        officialName: official.name,
        sourceStratum,

        // 核心效果
        independenceReduction: Math.max(0, independenceReduction - independenceRiskFromLoyalty),
        tributeModifier: Math.max(0.5, tributeModifier), // 最低50%
        stabilityBonus: Math.max(0, stabilityBonus),
        corruptionRate,

        // 满意度
        eliteSatisfactionBonus,
        commonerSatisfactionBonus,
        unrestSuppression,

        // 成本与风险
        dailyCost,
        warnings,

        // 原始属性（用于UI显示）
        stats: {
            prestige,
            administrative,
            military,
            loyalty,
        },
    };
};

/**
 * 计算总督的腐败损失
 * @param {number} tributeAmount - 原始朝贡金额
 * @param {number} corruptionRate - 腐败率
 * @returns {Object} { actualTribute, siphoned }
 */
export const calculateCorruptionLoss = (tributeAmount, corruptionRate) => {
    const siphoned = Math.floor(tributeAmount * corruptionRate);
    return {
        actualTribute: tributeAmount - siphoned,
        siphoned,
    };
};

/**
 * 应用总督效果到附庸国
 * @param {Object} nation - 附庸国家对象
 * @param {Object} governorEffects - calculateGovernorFullEffects 的返回值
 * @returns {Object} 更新后的国家对象
 */
export const applyGovernorEffectsToVassal = (nation, governorEffects) => {
    if (!governorEffects?.hasGovernor) {
        return nation;
    }

    const updated = { ...nation };

    // 应用满意度加成（每日增量）
    if (updated.socialStructure) {
        if (updated.socialStructure.elites && governorEffects.eliteSatisfactionBonus > 0) {
            updated.socialStructure = {
                ...updated.socialStructure,
                elites: {
                    ...updated.socialStructure.elites,
                    satisfaction: Math.min(100,
                        (updated.socialStructure.elites.satisfaction || 50) +
                        governorEffects.eliteSatisfactionBonus * 0.05 // 每日微量增加
                    ),
                },
            };
        }
    }

    // 动荡压制
    if (governorEffects.unrestSuppression > 0 && updated.unrest !== undefined) {
        updated.unrest = Math.max(0, (updated.unrest || 0) - governorEffects.unrestSuppression);
    }

    return updated;
};

/**
 * 检查官员是否可以被分配为总督
 * @param {Object} official - 官员对象
 * @param {Array} allVassals - 所有附庸国家列表
 * @returns {Object} { canAssign, reason }
 */
export const canAssignAsGovernor = (official, allVassals = []) => {
    if (!official) {
        return { canAssign: false, reason: 'no_official' };
    }

    // 检查是否已经是某个附庸的总督
    const existingAssignment = allVassals.find(v =>
        v.vassalPolicy?.controlMeasures?.governor?.officialId === official.id
    );

    if (existingAssignment) {
        return {
            canAssign: false,
            reason: 'already_governor',
            currentVassal: existingAssignment.name,
        };
    }

    return { canAssign: true };
};

/**
 * 获取指定附庸的总督官员对象
 * @param {Object} nation - 附庸国家对象
 * @param {Array} officials - 所有官员列表
 * @returns {Object|null} 总督官员对象或null
 */
export const getGovernorOfficial = (nation, officials = []) => {
    const officialId = nation?.vassalPolicy?.controlMeasures?.governor?.officialId;
    if (!officialId) return null;
    return officials.find(o => o.id === officialId) || null;
};
