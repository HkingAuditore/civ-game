/**
 * 条约效果计算模块
 * 根据与特定国家签署的条约计算实际效果
 */

/**
 * 条约效果配置
 * 
 * 设计原则：
 * - 贸易协定 (trade_agreement): 初级贸易协议，降低贸易门槛，适合关系一般的国家
 * - 开放市场 (open_market): 完全开放市场准入，与战争强制开放市场效果一致，侧重于市场准入权
 * - 自由贸易 (free_trade): 最高级经济一体化，关税归零+价格联动，适合长期盟友
 */
export const TREATY_EFFECT_CONFIGS = {
    trade_agreement: {
        name: '贸易协定',
        // 初级贸易协议：降低贸易门槛，但不涉及市场准入
        tariffMultiplier: 0.85,       // 关税减免15%
        extraMerchantSlotsPercent: 0.20,  // 商人槽位+20%
        tradeEfficiencyBonus: 0.08,   // 贸易利润+8%
        relationDecayReduction: 0.1,  // 关系衰减减少10%
    },
    open_market: {
        name: '开放市场',
        // 对齐战争求和的强制开放市场效果：完全开放市场准入
        tariffMultiplier: 0.90,        // 关税减免10%（主要不是关税优惠）
        extraMerchantSlots: Infinity,  // 无限商人槽位（核心效果！）
        tradeEfficiencyBonus: 0,       // 无贸易利润加成
        allowForceTrade: true,         // 允许强制贸易（倾销/抢购）
        bypassRelationCap: true,       // 绕过关系对商人数量的限制
    },
    free_trade: {
        name: '自由贸易协定',
        // 高级贸易协议：关税归零，深化经济合作
        tariffMultiplier: 0,           // 关税归零
        extraMerchantSlotsPercent: 0.50,  // 商人槽位+50%
        relationDecayReduction: 0.3,   // 关系衰减减少30%
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
    military_alliance: {
        name: '军事同盟',
        tariffMultiplier: 0.85,       // 关税减免15%
        extraMerchantSlots: 2,
        mutualDefense: true,
        relationDecayReduction: 0.8,  // 关系衰减速度-80%
    },
    economic_bloc: {
        name: '经济共同体',
        tariffMultiplier: 0.60,       // 关税减免40%
        extraMerchantSlots: 5,
        tradeEfficiencyBonus: 0.40,   // 贸易利润+40%
        overseasBuildingAccess: true,
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
    return nation.treaties.filter((t) => {
        if (!t) return false;
        const status = typeof t.status === 'string' ? t.status.toLowerCase() : null;
        if (status === 'expired' || status === 'terminated' || status === 'cancelled') return false;
        if (Number.isFinite(t.endDay) && daysElapsed >= t.endDay) return false;
        return true;
    });
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
        extraMerchantSlots: 0,           // 额外商人槽位（固定值）
        extraMerchantSlotsPercent: 0,    // 额外商人槽位（百分比）
        tradeEfficiencyBonus: 0,         // 贸易效率加成
        hasOverseasAccess: false,        // 是否有海外建筑权限
        hasMutualDefense: false,         // 是否有共同防御
        relationDecayReduction: 0,       // 关系衰减减少
        techBonus: 0,                    // 科技加成
        hasPriceConvergence: false,      // 是否启用价格收敛
        allowForceTrade: false,          // 是否允许强制贸易（倾销/抢购）
        bypassRelationCap: false,        // 是否绕过关系对商人数量的限制
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
        
        // 商人槽位累加（固定值）
        if (config.extraMerchantSlots !== undefined) {
            if (config.extraMerchantSlots === Infinity) {
                effects.extraMerchantSlots = Infinity;
            } else if (effects.extraMerchantSlots !== Infinity) {
                effects.extraMerchantSlots += config.extraMerchantSlots;
            }
        }
        
        // 商人槽位百分比累加
        if (config.extraMerchantSlotsPercent !== undefined) {
            effects.extraMerchantSlotsPercent += config.extraMerchantSlotsPercent;
        }
        
        // 贸易效率取最高
        if (config.tradeEfficiencyBonus !== undefined) {
            effects.tradeEfficiencyBonus = Math.max(effects.tradeEfficiencyBonus, config.tradeEfficiencyBonus);
        }
        
        // 布尔效果取或
        if (config.overseasBuildingAccess) effects.hasOverseasAccess = true;
        if (config.mutualDefense) effects.hasMutualDefense = true;
        if (config.priceConvergence) effects.hasPriceConvergence = true;
        if (config.allowForceTrade) effects.allowForceTrade = true;
        if (config.bypassRelationCap) effects.bypassRelationCap = true;
        
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

/**
 * 获取单个条约类型的效果描述文本（用于UI预览）
 * @param {string} treatyType
 * @returns {Array<string>} 效果描述数组
 */
export const getTreatyEffectDescriptionsByType = (treatyType) => {
    const config = TREATY_EFFECT_CONFIGS[treatyType];
    if (!config) return [];

    const descriptions = [];

    // 市场准入效果（优先显示）
    if (config.bypassRelationCap) {
        descriptions.push('绕过关系限制');
    }
    if (config.allowForceTrade) {
        descriptions.push('允许强制贸易');
    }
    
    // 商人槽位效果
    if (config.extraMerchantSlots === Infinity) {
        descriptions.push('商人槽位无限');
    } else if (typeof config.extraMerchantSlots === 'number' && config.extraMerchantSlots > 0) {
        descriptions.push(`商人槽位 +${config.extraMerchantSlots}`);
    } else if (typeof config.extraMerchantSlotsPercent === 'number' && config.extraMerchantSlotsPercent > 0) {
        descriptions.push(`商人槽位 +${Math.round(config.extraMerchantSlotsPercent * 100)}%`);
    }
    
    // 关税效果
    if (config.tariffMultiplier !== undefined) {
        if (config.tariffMultiplier === 0) {
            descriptions.push('关税免除');
        } else if (config.tariffMultiplier < 1) {
            const discount = Math.round((1 - config.tariffMultiplier) * 100);
            descriptions.push(`关税 -${discount}%`);
        }
    }
    
    // 贸易利润效果
    if (config.tradeEfficiencyBonus) {
        descriptions.push(`利润 +${Math.round(config.tradeEfficiencyBonus * 100)}%`);
    }
    
    // 其他效果
    if (config.priceConvergence) {
        descriptions.push('价格联动');
    }
    if (config.overseasBuildingAccess) {
        descriptions.push('可建海外设施');
    }
    if (config.mutualDefense) {
        descriptions.push('共同防御');
    }
    if (config.relationDecayReduction) {
        descriptions.push(`关系衰减 -${Math.round(config.relationDecayReduction * 100)}%`);
    }
    if (config.techBonus) {
        descriptions.push(`科技 +${Math.round(config.techBonus * 100)}%`);
    }

    return descriptions;
};

/**
 * 价格收敛配置
 */
export const PRICE_CONVERGENCE_CONFIG = {
    // 每日收敛率（价格差距缩小的比例）
    DAILY_CONVERGENCE_RATE: 0.05,  // 5%
    
    // 最小价格差距比例（收敛后的最小差距）
    MIN_PRICE_DIFF_RATIO: 0.10,    // 10%
    
    // 价格波动范围
    PRICE_FLUCTUATION: 0.02,       // 2%
};

/**
 * 计算价格收敛后的新价格
 * @param {number} playerPrice - 玩家市场价格
 * @param {number} nationPrice - AI国家市场价格
 * @param {number} convergenceRate - 收敛率（默认使用配置值）
 * @returns {Object} - 收敛后的价格
 */
export function calculatePriceConvergence(playerPrice, nationPrice, convergenceRate = PRICE_CONVERGENCE_CONFIG.DAILY_CONVERGENCE_RATE) {
    if (!playerPrice || !nationPrice) {
        return { playerPrice, nationPrice, changed: false };
    }
    
    const avgPrice = (playerPrice + nationPrice) / 2;
    const minDiff = avgPrice * PRICE_CONVERGENCE_CONFIG.MIN_PRICE_DIFF_RATIO;
    
    // 计算当前差距
    const currentDiff = Math.abs(playerPrice - nationPrice);
    
    // 如果差距已经很小，不再收敛
    if (currentDiff <= minDiff) {
        return { playerPrice, nationPrice, changed: false };
    }
    
    // 向平均价格靠近
    const newPlayerPrice = playerPrice + (avgPrice - playerPrice) * convergenceRate;
    const newNationPrice = nationPrice + (avgPrice - nationPrice) * convergenceRate;
    
    return {
        playerPrice: Math.round(newPlayerPrice * 100) / 100,
        nationPrice: Math.round(newNationPrice * 100) / 100,
        changed: true,
        convergenceAmount: Math.abs(newPlayerPrice - playerPrice),
    };
}

/**
 * 处理所有自由贸易协定国家的价格收敛
 * @param {Object} marketPrices - 玩家市场价格对象
 * @param {Array} nations - 所有国家数组
 * @param {number} daysElapsed - 当前游戏天数
 * @returns {Object} - 更新后的价格和国家数据
 */
export function processPriceConvergence(marketPrices, nations, daysElapsed) {
    const updatedMarketPrices = { ...marketPrices };
    const nationPriceUpdates = [];
    const logs = [];
    
    // 找出所有有自由贸易协定的国家
    const freeTradNations = nations.filter(nation => {
        if (!nation || nation.isPlayer) return false;
        const effects = getTreatyEffects(nation, daysElapsed);
        return effects.hasPriceConvergence;
    });
    
    if (freeTradNations.length === 0) {
        return { marketPrices: updatedMarketPrices, nationPriceUpdates, logs };
    }
    
    // 获取所有可交易资源
    const resources = Object.keys(marketPrices);
    
    for (const nation of freeTradNations) {
        const nationPrices = nation.nationPrices || {};
        const updatedNationPrices = { ...nationPrices };
        let hasChanges = false;
        
        for (const resource of resources) {
            const playerPrice = updatedMarketPrices[resource];
            const nationPrice = nationPrices[resource];
            
            if (!playerPrice || !nationPrice) continue;
            
            const result = calculatePriceConvergence(playerPrice, nationPrice);
            
            if (result.changed) {
                // 更新双方价格
                updatedMarketPrices[resource] = result.playerPrice;
                updatedNationPrices[resource] = result.nationPrice;
                hasChanges = true;
            }
        }
        
        if (hasChanges) {
            nationPriceUpdates.push({
                nationId: nation.id,
                nationPrices: updatedNationPrices,
            });
        }
    }
    
    // 如果有价格变化，添加日志（每10天报告一次）
    if (nationPriceUpdates.length > 0 && daysElapsed % 10 === 0) {
        const nationNames = freeTradNations.slice(0, 3).map(n => n.name).join('、');
        const suffix = freeTradNations.length > 3 ? `等${freeTradNations.length}国` : '';
        logs.push(`📊 自由贸易效应：与${nationNames}${suffix}的市场价格正在趋同。`);
    }
    
    return {
        marketPrices: updatedMarketPrices,
        nationPriceUpdates,
        logs,
    };
}
