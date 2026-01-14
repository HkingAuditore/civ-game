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
 * 总督施政纲领 (Governor Mandates)
 * 决定总督治理的侧重点，并修正属性收益
 */
export const GOVERNOR_MANDATES = {
    pacify: {
        name: '安抚',
        desc: '专注降低动荡和独立倾向，但会减少朝贡',
        statFocus: 'military', // 军事属性收益翻倍
        independenceMod: 2.0,  // 独立压制效果 +100%
        tributeMod: 0.8,       // 朝贡 -20%
    },
    exploit: {
        name: '压榨',
        desc: '最大化朝贡收入，但大幅增加动荡',
        statFocus: 'administrative', // 行政属性收益翻倍
        independenceMod: 0.5,  // 独立压制效果 -50%
        tributeMod: 1.5,       // 朝贡 +50%
        unrestIncrease: 0.1,   // 每日动荡 +0.1
    },
    develop: {
        name: '开发',
        desc: '促进附庸经济增长和自主度恢复',
        statFocus: 'administrative',
        tributeMod: 0.5,       // 朝贡减半（用于再投资）
        vassalGrowth: 1.5,     // 附庸经济增长 +50%
    },
    integrate: {
        name: '同化',
        desc: '降低独立倾向上限，提高忠诚度',
        statFocus: 'prestige', // 威望属性收益翻倍
        independenceCapReduction: 0.1, // 每日降低独立上限
    },
};

/**
 * 总督效果配置 (数值增强版)
 */
export const GOVERNOR_EFFECTS_CONFIG = {
    // 基础效果（无总督时）
    base: {
        independenceReduction: 0,
        tributeModifier: 1.0,
        stabilityBonus: 0,
        corruptionRate: 0.05,
    },

    // 威望加成
    prestige: {
        independencePerPoint: 0.02, // [Boosted] 每点威望 -2% 独立倾向增长 (was 0.5%)
        eliteSatisfactionPerPoint: 0.1, // [Boosted] 每点威望 +10% 精英满意度 (was 2%)
    },

    // 行政能力加成
    administrative: {
        tributePerPoint: 0.02,       // [Boosted] 每点行政 +2% 朝贡收入 (was 1%)
        corruptionReducePerPoint: 0.002,
        maxTributeBonus: 2.0,        // [Boosted] 最大朝贡加成 200% (was 50%)
    },

    // 军事能力加成
    military: {
        stabilityPerPoint: 0.05,     // [Boosted] 每点军事 +5% 稳定性
        unrestSuppressionPerPoint: 0.05, // [Boosted] 每点军事 -5% 动荡
    },

    // 忠诚度影响
    loyalty: {
        corruptionThreshold: 40,
        severeLoyaltyThreshold: 20,
        corruptionPerLoyaltyDeficit: 0.002,
        independenceRiskPerDeficit: 0.005, // [Boosted]
    },

    // 来源阶层加成
    stratumBonus: {
        nobles: { eliteSatisfaction: 1.3, commonerSatisfaction: 0.8 },
        capitalist: { tributeBonus: 1.3, eliteSatisfaction: 1.0 }, // Boosted
        commoner: { commonerSatisfaction: 1.5, eliteSatisfaction: 0.6 }, // Boosted
        clergy: { stability: 1.5, corruption: 0.8 }, // Boosted
    },

    // 每日成本基数
    dailyCost: {
        base: 30,
        perPrestige: 0.5,
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

    // 获取当前 Mandate
    const mandateId = vassalNation.vassalPolicy?.controlMeasures?.governor?.mandate || 'pacify';
    const mandate = GOVERNOR_MANDATES[mandateId] || GOVERNOR_MANDATES.pacify;

    const prestige = official.prestige ?? 50;
    const administrative = official.administrative ?? official.admin ?? 50;
    const military = official.military ?? official.mil ?? 30;
    const loyalty = official.loyalty ?? 50;
    const sourceStratum = official.sourceStratum || 'commoner';

    // 应用 Mandate 的属性聚焦 (Stat Focus)
    // 聚焦的属性按 1.5 倍计算
    const effPrestige = mandate.statFocus === 'prestige' ? prestige * 1.5 : prestige;
    const effAdmin = mandate.statFocus === 'administrative' ? administrative * 1.5 : administrative;
    const effMilitary = mandate.statFocus === 'military' ? military * 1.5 : military;

    // ========== 独立倾向压制 ==========
    let independenceReduction = effPrestige * config.prestige.independencePerPoint;
    independenceReduction *= (mandate.independenceMod || 1.0); // Apply Mandate mod

    // ========== 朝贡效率 ==========
    const adminTributeBonus = Math.min(
        config.administrative.maxTributeBonus,
        effAdmin * config.administrative.tributePerPoint
    );
    let tributeModifier = 1.0 + adminTributeBonus;
    tributeModifier *= (mandate.tributeMod || 1.0); // Apply Mandate mod

    // ========== 稳定性与动荡 ==========
    let stabilityBonus = effMilitary * config.military.stabilityPerPoint;
    let unrestSuppression = effMilitary * config.military.unrestSuppressionPerPoint;

    // Mandate side effects
    if (mandate.unrestIncrease) {
        unrestSuppression -= mandate.unrestIncrease; // Can become negative (increase unrest)
    }

    // ========== 腐败率 ==========
    let corruptionRate = config.base.corruptionRate;
    corruptionRate -= effAdmin * config.administrative.corruptionReducePerPoint;
    if (loyalty < config.loyalty.corruptionThreshold) {
        const deficit = config.loyalty.corruptionThreshold - loyalty;
        corruptionRate += deficit * config.loyalty.corruptionPerLoyaltyDeficit;
    }
    corruptionRate = Math.max(0, Math.min(0.5, corruptionRate)); // Cap at 50%

    // 腐败减少朝贡
    tributeModifier *= (1 - corruptionRate);

    // ========== 阶层满意度 ==========
    let eliteSatisfactionBonus = effPrestige * config.prestige.eliteSatisfactionPerPoint;
    let commonerSatisfactionBonus = 0;

    const stratumBonus = config.stratumBonus[sourceStratum] || {};
    eliteSatisfactionBonus *= stratumBonus.eliteSatisfaction || 1.0;
    commonerSatisfactionBonus = stratumBonus.commonerSatisfaction || 1.0;
    stabilityBonus *= stratumBonus.stability || 1.0;
    tributeModifier *= stratumBonus.tributeBonus || 1.0;

    // ========== 每日成本 ==========
    const dailyCost = config.dailyCost.base + prestige * config.dailyCost.perPrestige;

    // ========== 生成随机治理事件 (Governor Actions) ==========
    const governorEvent = generateGovernorEvent(official, mandate, vassalNation);

    return {
        hasGovernor: true,
        officialId: official.id,
        officialName: official.name,
        sourceStratum,
        mandateId,

        // 核心效果
        independenceReduction: Math.max(-0.5, independenceReduction), // Allow negative (growth)
        tributeModifier: Math.max(0.1, tributeModifier),
        stabilityBonus: Math.max(0, stabilityBonus),
        corruptionRate,

        // 特殊效果
        independenceCapReduction: mandate.independenceCapReduction || 0,

        // 满意度
        eliteSatisfactionBonus,
        commonerSatisfactionBonus,
        unrestSuppression,

        // 成本与事件
        dailyCost,
        governorEvent, // New event trigger
        warnings: [],
    };
};

/**
 * 生成随机治理事件
 * @private
 */
function generateGovernorEvent(official, mandate, nation) {
    // 每日 2% 概率触发事件
    if (Math.random() > 0.02) return null;

    const eventType = Math.random();

    // 基于 Mandate 和 属性 触发不同事件
    if (mandate.name === '压榨') {
        if (official.administrative > 60) {
            return {
                type: 'efficient_squeeze',
                desc: `${official.name}高效地搜刮了额外资源`,
                effect: { silver: 50 },
            };
        } else {
            return {
                type: 'brutal_squeeze',
                desc: `${official.name}的压榨导致民怨沸腾`,
                effect: { unrest: 5 },
            };
        }
    }

    if (mandate.name === '安抚') {
        if (official.military > 60) {
            return {
                type: 'military_parade',
                desc: `${official.name}阅兵展示军威，震慑了分离主义者`,
                effect: { independence: -5 },
            };
        }
    }

    return null;
}

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
