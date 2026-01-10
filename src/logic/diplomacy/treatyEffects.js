/**
 * 条约效果计算模块
 * 根据与特定国家签署的条约计算实际效果
 */

/**
 * 条约效果配置
 * 与策划案 外交系统扩充.md 第438-541行 对应
 */
export const TREATY_EFFECT_CONFIGS = {
    trade_agreement: {
        name: '贸易协定',
        tariffMultiplier: 0.75,      // 关税减免25%
        extraMerchantSlots: 3,        // 额外3个商人槽位
        tradeEfficiencyBonus: 0.15,   // 贸易利润+15%
    },
    free_trade: {
        name: '自由贸易协定',
        tariffMultiplier: 0,          // 关税归零
        extraMerchantSlots: Infinity, // 无限商人槽位
        tradeEfficiencyBonus: 0.25,   // 贸易利润+25%
        priceConvergence: true,       // 市场价格联动
    },
    open_market: {
        name: '开放市场',
        tariffMultiplier: 0.80,       // 关税减免20%
        extraMerchantSlots: 2,        // 额外2个商人槽位
        tradeEfficiencyBonus: 0.10,
    },
    investment_pact: {
        name: '投资协议',
        tariffMultiplier: 0.90,       // 关税减免10%
        extraMerchantSlots: 1,
        overseasBuildingAccess: true, // 解锁海外建筑
        profitRepatriationRate: 1.0,  // 利润100%可汇回
    },
    non_aggression: {
        name: '互不侵犯条约',
        tariffMultiplier: 1.0,        // 无关税效果
        extraMerchantSlots: 0,
        relationDecayReduction: 0.5,  // 关系衰减速度-50%
    },
    peace_treaty: {
        name: '和平条约',
        tariffMultiplier: 1.0,
        extraMerchantSlots: 0,
    },
    academic_exchange: {
        name: '学术交流',
        tariffMultiplier: 1.0,
        extraMerchantSlots: 0,
        techBonus: 0.05,              // 科技速度+5%
    },
    defensive_pact: {
        name: '共同防御',
        tariffMultiplier: 0.90,       // 关税减免10%
        extraMerchantSlots: 1,
        mutualDefense: true,
    },
};

/**
 * 获取与某国家的活跃条约列表
 * @param {Object} nation - 国家对象
 * @param {number} daysElapsed - 当前游戏天数
 * @returns {Array} 活跃条约数组
 */
export const getActiveTreaties = (nation, daysElapsed) => {
    if (!nation?.treaties || !Array.isArray(nation.treaties)) return [];
    return nation.treaties.filter(t => 
        t && (!Number.isFinite(t.endDay) || daysElapsed < t.endDay)
    );
};

/**
 * 获取与某国家的综合条约效果
 * @param {Object} nation - 国家对象
 * @param {number} daysElapsed - 当前游戏天数
 * @returns {Object} 综合条约效果
 */
export const getTreatyEffects = (nation, daysElapsed) => {
    const activeTreaties = getActiveTreaties(nation, daysElapsed);
    
    // 默认效果（无条约）
    const effects = {
        tariffMultiplier: 1.0,          // 关税系数（1.0=无变化，0=免税）
        extraMerchantSlots: 0,           // 额外商人槽位
        tradeEfficiencyBonus: 0,         // 贸易效率加成
        hasOverseasAccess: false,        // 是否有海外建筑权限
        hasMutualDefense: false,         // 是否有共同防御
        relationDecayReduction: 0,       // 关系衰减减少
        techBonus: 0,                    // 科技加成
        activeTreatyTypes: [],           // 活跃条约类型列表
    };
    
    if (activeTreaties.length === 0) return effects;
    
    // 收集所有活跃条约类型
    effects.activeTreatyTypes = activeTreaties.map(t => t.type);
    
    // 取最优效果（叠加或取最佳值）
    for (const treaty of activeTreaties) {
        const config = TREATY_EFFECT_CONFIGS[treaty.type];
        if (!config) continue;
        
        // 关税取最低值（最大减免）
        if (config.tariffMultiplier !== undefined) {
            effects.tariffMultiplier = Math.min(effects.tariffMultiplier, config.tariffMultiplier);
        }
        
        // 商人槽位累加
        if (config.extraMerchantSlots !== undefined) {
            if (config.extraMerchantSlots === Infinity) {
                effects.extraMerchantSlots = Infinity;
            } else if (effects.extraMerchantSlots !== Infinity) {
                effects.extraMerchantSlots += config.extraMerchantSlots;
            }
        }
        
        // 贸易效率取最高
        if (config.tradeEfficiencyBonus !== undefined) {
            effects.tradeEfficiencyBonus = Math.max(effects.tradeEfficiencyBonus, config.tradeEfficiencyBonus);
        }
        
        // 布尔效果取或
        if (config.overseasBuildingAccess) effects.hasOverseasAccess = true;
        if (config.mutualDefense) effects.hasMutualDefense = true;
        
        // 关系衰减减少取最高
        if (config.relationDecayReduction !== undefined) {
            effects.relationDecayReduction = Math.max(effects.relationDecayReduction, config.relationDecayReduction);
        }
        
        // 科技加成累加
        if (config.techBonus !== undefined) {
            effects.techBonus += config.techBonus;
        }
    }
    
    return effects;
};

/**
 * 计算与某国家的有效关税率
 * @param {number} baseTariffRate - 基础关税率
 * @param {Object} nation - 国家对象
 * @param {number} daysElapsed - 当前游戏天数
 * @returns {number} 有效关税率
 */
export const getEffectiveTariffRate = (baseTariffRate, nation, daysElapsed) => {
    const effects = getTreatyEffects(nation, daysElapsed);
    return baseTariffRate * effects.tariffMultiplier;
};

/**
 * 计算与某国家的最大商人槽位数
 * @param {number} baseSlots - 基于关系的基础槽位
 * @param {Object} nation - 国家对象
 * @param {number} daysElapsed - 当前游戏天数
 * @returns {number} 最大商人槽位数
 */
export const getMaxMerchantSlots = (baseSlots, nation, daysElapsed) => {
    const effects = getTreatyEffects(nation, daysElapsed);
    if (effects.extraMerchantSlots === Infinity) return Infinity;
    return baseSlots + effects.extraMerchantSlots;
};

/**
 * 获取条约效果描述文本（用于UI展示）
 * @param {Object} nation - 国家对象
 * @param {number} daysElapsed - 当前游戏天数
 * @returns {Array<string>} 效果描述数组
 */
export const getTreatyEffectDescriptions = (nation, daysElapsed) => {
    const effects = getTreatyEffects(nation, daysElapsed);
    const descriptions = [];
    
    if (effects.tariffMultiplier < 1) {
        const discount = Math.round((1 - effects.tariffMultiplier) * 100);
        descriptions.push(`关税减免 ${discount}%`);
    }
    if (effects.tariffMultiplier === 0) {
        descriptions.push('关税免除');
    }
    if (effects.extraMerchantSlots === Infinity) {
        descriptions.push('商人槽位无限制');
    } else if (effects.extraMerchantSlots > 0) {
        descriptions.push(`商人槽位 +${effects.extraMerchantSlots}`);
    }
    if (effects.tradeEfficiencyBonus > 0) {
        descriptions.push(`贸易利润 +${Math.round(effects.tradeEfficiencyBonus * 100)}%`);
    }
    if (effects.hasOverseasAccess) {
        descriptions.push('可建海外设施');
    }
    if (effects.hasMutualDefense) {
        descriptions.push('共同防御');
    }
    if (effects.techBonus > 0) {
        descriptions.push(`科技速度 +${Math.round(effects.techBonus * 100)}%`);
    }
    
    return descriptions;
};
