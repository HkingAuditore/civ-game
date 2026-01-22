/**
 * Diplomatic Reputation System Configuration
 * 外交声誉系统配置
 * 
 * 声誉值范围: 0-100
 * - 0-20: 臭名昭著 (notorious)
 * - 21-40: 名声不佳 (bad)
 * - 41-60: 普通 (neutral)
 * - 61-80: 受人尊敬 (good)
 * - 81-100: 德高望重 (excellent)
 */

// ========== 声誉等级定义 ==========
export const REPUTATION_TIERS = {
    notorious: { min: 0, max: 20, label: '臭名昭著', color: 'text-red-500' },
    bad: { min: 21, max: 40, label: '名声不佳', color: 'text-orange-500' },
    neutral: { min: 41, max: 60, label: '普通', color: 'text-gray-400' },
    good: { min: 61, max: 80, label: '受人尊敬', color: 'text-green-400' },
    excellent: { min: 81, max: 100, label: '德高望重', color: 'text-cyan-400' },
};

// ========== 声誉变化事件配置 ==========
export const REPUTATION_CHANGE_CONFIG = {
    // 负面事件（降低声誉）
    negative: {
        // 违反和平条约宣战
        breakPeaceTreaty: {
            base: -15,
            description: '撕毁和平条约',
        },
        // 主动宣战（非防御战争）
        declareWar: {
            base: -5,
            description: '主动宣战',
        },
        // 拒绝履行同盟防御义务
        refuseAllyDefense: {
            base: -20,
            description: '拒绝援助盟友',
        },
        // 强制吞并附庸国
        annexVassal: {
            base: -10,
            description: '吞并附庸国',
        },
        // 镇压附庸国独立运动（武力镇压）
        suppressIndependence: {
            base: -5,
            description: '镇压独立运动',
        },
        // 实施奴隶制政策
        slaveryPolicy: {
            base: -3,
            perTick: true,      // 每30天检查一次
            description: '实施奴隶制',
        },
        // 掠夺性贸易政策
        lootingPolicy: {
            base: -2,
            perTick: true,
            description: '掠夺性贸易',
        },
        // 违约其他条约
        breakTreaty: {
            base: -8,
            description: '违反条约',
        },
        // 屠杀战俘（未来功能）
        warCrimes: {
            base: -25,
            description: '战争罪行',
        },
    },
    
    // 正面事件（提升声誉）
    positive: {
        // 履行同盟防御义务
        defendAlly: {
            base: 10,
            description: '援助盟友',
        },
        // 和平解决争端
        peacefulResolution: {
            base: 5,
            description: '和平解决争端',
        },
        // 释放战俘
        releasePrisoners: {
            base: 3,
            description: '释放战俘',
        },
        // 公平贸易政策
        fairTradePolicy: {
            base: 1,
            perTick: true,
            description: '公平贸易',
        },
        // 给予附庸国自治权
        grantAutonomy: {
            base: 5,
            description: '给予自治权',
        },
        // 允许附庸国和平独立
        peacefulIndependence: {
            base: 15,
            description: '和平独立',
        },
        // 信守承诺（完成条约承诺）
        honorPromise: {
            base: 3,
            description: '信守承诺',
        },
        // 参与国际组织
        joinOrganization: {
            base: 2,
            description: '加入国际组织',
        },
    },
    
    // 自然恢复配置
    naturalRecovery: {
        rate: 0.05,             // 每天自然恢复 0.05 点
        targetNeutral: 50,      // 向50点自然回归
        maxPerMonth: 1.5,       // 每月最多自然恢复1.5点
    },
};

// ========== 声誉对游戏机制的影响 ==========
export const REPUTATION_EFFECTS = {
    // 对附庸国满意度上限的影响
    vassalSatisfactionCap: {
        notorious: -15,     // 臭名昭著: -15%
        bad: -10,           // 名声不佳: -10%
        neutral: 0,         // 普通: 无影响
        good: 5,            // 受人尊敬: +5%
        excellent: 10,      // 德高望重: +10%
    },
    
    // 对附庸国独立倾向的影响（每日变化修正）
    vassalIndependence: {
        notorious: 0.05,    // 臭名昭著: +0.05%/天
        bad: 0.02,          // 名声不佳: +0.02%/天
        neutral: 0,
        good: -0.01,        // 受人尊敬: -0.01%/天
        excellent: -0.02,   // 德高望重: -0.02%/天
    },
    
    // 对外交关系的影响（初始关系修正）
    relationModifier: {
        notorious: -20,     // 臭名昭著: 新建交国家关系-20
        bad: -10,
        neutral: 0,
        good: 5,
        excellent: 10,
    },
    
    // 对贸易条约达成难度的影响
    tradeDifficulty: {
        notorious: 1.5,     // 臭名昭著: 需求提高50%
        bad: 1.2,
        neutral: 1.0,
        good: 0.9,
        excellent: 0.8,
    },
    
    // 对战争赔款的影响
    warReparations: {
        notorious: 0.8,     // 臭名昭著: 赔款减少20%（没人敢要）
        bad: 0.9,
        neutral: 1.0,
        good: 1.1,
        excellent: 1.2,     // 德高望重: 赔款增加20%
    },
};

// ========== 工具函数 ==========

/**
 * Get reputation tier key from value
 * @param {number} reputation - 声誉值 (0-100)
 * @returns {string} tier key
 */
export function getReputationTier(reputation) {
    const value = Math.max(0, Math.min(100, reputation || 50));
    if (value <= 20) return 'notorious';
    if (value <= 40) return 'bad';
    if (value <= 60) return 'neutral';
    if (value <= 80) return 'good';
    return 'excellent';
}

/**
 * Get reputation tier info
 * @param {number} reputation - 声誉值 (0-100)
 * @returns {object} tier info with label, color, etc.
 */
export function getReputationTierInfo(reputation) {
    const tier = getReputationTier(reputation);
    return {
        tier,
        ...REPUTATION_TIERS[tier],
        value: Math.round(reputation || 50),
    };
}

/**
 * Convert reputation to vassal system reputation category
 * (for backward compatibility with existing vassal system)
 * @param {number} reputation - 声誉值 (0-100)
 * @returns {string} 'good' | 'neutral' | 'bad'
 */
export function getVassalReputationCategory(reputation) {
    const tier = getReputationTier(reputation);
    if (tier === 'notorious' || tier === 'bad') return 'bad';
    if (tier === 'good' || tier === 'excellent') return 'good';
    return 'neutral';
}

/**
 * Calculate reputation change with modifiers
 * @param {number} currentReputation - 当前声誉值
 * @param {string} eventType - 事件类型 (如 'breakPeaceTreaty')
 * @param {boolean} isPositive - 是否为正面事件
 * @param {object} modifiers - 额外修正因素
 * @returns {object} { newReputation, change, description }
 */
export function calculateReputationChange(currentReputation, eventType, isPositive, modifiers = {}) {
    const category = isPositive ? 'positive' : 'negative';
    const config = REPUTATION_CHANGE_CONFIG[category]?.[eventType];
    
    if (!config) {
        console.warn(`Unknown reputation event type: ${eventType}`);
        return { newReputation: currentReputation, change: 0, description: '未知事件' };
    }
    
    let change = config.base || 0;
    
    // Apply modifiers
    if (modifiers.multiplier) {
        change *= modifiers.multiplier;
    }
    
    // Clamp result
    const newReputation = Math.max(0, Math.min(100, currentReputation + change));
    
    return {
        newReputation,
        change,
        description: config.description || eventType,
    };
}

/**
 * Calculate natural reputation recovery
 * @param {number} currentReputation - 当前声誉值
 * @returns {number} 恢复后的声誉值
 */
export function calculateNaturalRecovery(currentReputation) {
    const config = REPUTATION_CHANGE_CONFIG.naturalRecovery;
    const target = config.targetNeutral;
    
    if (Math.abs(currentReputation - target) < 0.1) {
        return currentReputation;
    }
    
    // Move towards target
    const direction = currentReputation < target ? 1 : -1;
    const recovery = config.rate * direction;
    
    const newReputation = currentReputation + recovery;
    
    // Don't overshoot target
    if (direction > 0) {
        return Math.min(newReputation, target);
    } else {
        return Math.max(newReputation, target);
    }
}

/**
 * Get reputation effect value for a specific system
 * @param {number} reputation - 声誉值
 * @param {string} effectType - 效果类型
 * @returns {number} effect value
 */
export function getReputationEffect(reputation, effectType) {
    const tier = getReputationTier(reputation);
    const effects = REPUTATION_EFFECTS[effectType];
    
    if (!effects) {
        console.warn(`Unknown reputation effect type: ${effectType}`);
        return 0;
    }
    
    return effects[tier] ?? 0;
}

/**
 * Get all reputation effects for display
 * @param {number} reputation - 声誉值
 * @returns {object} all effect values
 */
export function getAllReputationEffects(reputation) {
    const tier = getReputationTier(reputation);
    const tierInfo = REPUTATION_TIERS[tier];
    
    return {
        tier,
        label: tierInfo.label,
        color: tierInfo.color,
        value: Math.round(reputation),
        effects: {
            vassalSatisfactionCap: REPUTATION_EFFECTS.vassalSatisfactionCap[tier],
            vassalIndependence: REPUTATION_EFFECTS.vassalIndependence[tier],
            relationModifier: REPUTATION_EFFECTS.relationModifier[tier],
            tradeDifficulty: REPUTATION_EFFECTS.tradeDifficulty[tier],
            warReparations: REPUTATION_EFFECTS.warReparations[tier],
        },
    };
}
