/**
 * Vassal System Module
 * 附庸系统：处理保护国、朝贡国、傀儡国、殖民地的逻辑
 */

import {
    VASSAL_TYPE_CONFIGS,
    calculateIndependenceDesire,
    calculateTribute,
    isDiplomacyUnlocked,
    INDEPENDENCE_WAR_CONDITIONS,
} from '../../config/diplomacy';

/**
 * 处理所有附庸国的每日更新
 * @param {Object} params - 更新参数
 * @returns {Object} 更新后的状态
 */
export const processVassalUpdates = ({
    nations,
    daysElapsed,
    epoch,
    playerMilitary = 1.0,
    playerStability = 50,
    playerAtWar = false,
    logs = [],
}) => {
    let tributeIncome = 0;
    const vassalEvents = [];

    const updatedNations = (nations || []).map(nation => {
        // 跳过非附庸国
        if (nation.vassalOf !== 'player') {
            return nation;
        }

        const updated = { ...nation };
        const vassalConfig = VASSAL_TYPE_CONFIGS[updated.vassalType];
        if (!vassalConfig) return updated;

        // 1. 每30天结算朝贡
        if (daysElapsed > 0 && daysElapsed % 30 === 0) {
            const tribute = calculateTribute(updated);
            if (tribute > 0) {
                tributeIncome += tribute;
                updated.wealth = Math.max(0, (updated.wealth || 0) - tribute);
                logs.push(`📜 ${updated.name}（${vassalConfig.name}）缴纳朝贡 ${tribute} 银币`);
            }
        }

        // 2. 更新独立倾向
        const baseIndependenceGrowth = getIndependenceGrowthRate(updated.vassalType, epoch);
        updated.independencePressure = Math.min(100, Math.max(0,
            (updated.independencePressure || 0) + baseIndependenceGrowth
        ));

        // 3. 检查独立战争触发
        const independenceDesire = calculateIndependenceDesire(updated, playerMilitary);
        if (independenceDesire >= INDEPENDENCE_WAR_CONDITIONS.minIndependenceDesire) {
            const warTriggered = checkIndependenceWarTrigger({
                vassalNation: updated,
                playerAtWar,
                playerStability,
                nations,
            });

            if (warTriggered) {
                updated.isAtWar = true;
                updated.warTarget = 'player';
                updated.independenceWar = true;
                updated.vassalOf = null;
                updated.vassalType = null;
                
                vassalEvents.push({
                    type: 'independence_war',
                    nationId: updated.id,
                    nationName: updated.name,
                });
                
                logs.push(`⚠️ ${updated.name} 发动独立战争！`);
            }
        }

        // 4. 自主度缓慢恢复（除非是殖民地）
        if (updated.vassalType !== 'colony' && updated.autonomy < vassalConfig.autonomy) {
            updated.autonomy = Math.min(vassalConfig.autonomy, (updated.autonomy || 0) + 0.1);
        }

        return updated;
    });

    return {
        nations: updatedNations,
        tributeIncome,
        vassalEvents,
    };
};

/**
 * 获取独立倾向增长率（每天）
 * @param {string} vassalType - 附庸类型
 * @param {number} epoch - 当前时代
 * @returns {number} 每日增长率
 */
const getIndependenceGrowthRate = (vassalType, epoch) => {
    // 基础增长率（每天）
    const baseRates = {
        protectorate: 0.01,
        tributary: 0.02,
        puppet: 0.03,
        colony: 0.05,
    };
    
    const baseRate = baseRates[vassalType] || 0.02;
    
    // 时代越晚，民族主义越强，独立倾向增长越快
    const eraMultiplier = 1 + Math.max(0, epoch - 4) * 0.1;
    
    return baseRate * eraMultiplier;
};

/**
 * 检查是否触发独立战争
 * @param {Object} params - 检查参数
 * @returns {boolean} 是否触发
 */
const checkIndependenceWarTrigger = ({
    vassalNation,
    playerAtWar,
    playerStability,
    nations,
}) => {
    const triggers = INDEPENDENCE_WAR_CONDITIONS.triggers;
    
    // 宗主处于战争状态
    if (playerAtWar && Math.random() < triggers.overlordAtWar.probability) {
        return true;
    }
    
    // 宗主稳定度低
    if (playerStability < triggers.overlordLowStability.threshold &&
        Math.random() < triggers.overlordLowStability.probability) {
        return true;
    }
    
    // 外国支持（检查是否有第三方国家关系良好）
    const foreignSupporter = (nations || []).find(n => 
        n.id !== vassalNation.id &&
        n.vassalOf !== 'player' &&
        (n.foreignRelations?.[vassalNation.id] || 50) >= triggers.foreignSupport.minRelation
    );
    if (foreignSupporter && Math.random() < triggers.foreignSupport.probability) {
        return true;
    }
    
    return false;
};

/**
 * 建立附庸关系
 * @param {Object} nation - 目标国家
 * @param {string} vassalType - 附庸类型
 * @param {number} epoch - 当前时代
 * @returns {Object} 更新后的国家对象
 */
export const establishVassalRelation = (nation, vassalType, epoch) => {
    const config = VASSAL_TYPE_CONFIGS[vassalType];
    if (!config) {
        throw new Error(`无效的附庸类型: ${vassalType}`);
    }
    
    // 检查时代解锁
    if (!isDiplomacyUnlocked('sovereignty', vassalType, epoch)) {
        throw new Error(`${config.name}尚未解锁（需要时代 ${config.minEra}）`);
    }
    
    return {
        ...nation,
        vassalOf: 'player',
        vassalType,
        autonomy: config.autonomy,
        tributeRate: config.tributeRate,
        independencePressure: 0,
        // 结束战争状态
        isAtWar: false,
        warTarget: null,
        warScore: 0,
    };
};

/**
 * 解除附庸关系
 * @param {Object} nation - 附庸国
 * @param {string} reason - 解除原因
 * @returns {Object} 更新后的国家对象
 */
export const releaseVassal = (nation, reason = 'released') => {
    const relationChange = reason === 'released' ? 20 : -30;
    
    return {
        ...nation,
        vassalOf: null,
        vassalType: null,
        autonomy: 100,
        tributeRate: 0,
        independencePressure: 0,
        relation: Math.min(100, Math.max(0, (nation.relation || 50) + relationChange)),
    };
};

/**
 * 调整附庸政策
 * @param {Object} nation - 附庸国
 * @param {Object} policyChanges - 政策变更
 * @returns {Object} 更新后的国家对象
 */
export const adjustVassalPolicy = (nation, policyChanges) => {
    if (nation.vassalOf !== 'player') {
        throw new Error('只能调整玩家的附庸国');
    }
    
    const updated = { ...nation };
    const config = VASSAL_TYPE_CONFIGS[updated.vassalType];
    
    // 初始化附庸政策对象（如果不存在）
    if (!updated.vassalPolicy) {
        updated.vassalPolicy = {
            diplomaticControl: 'guided',
            tradePolicy: 'preferential',
        };
    }
    
    // 调整外交控制政策
    if (policyChanges.diplomaticControl) {
        const validOptions = ['autonomous', 'guided', 'puppet'];
        if (validOptions.includes(policyChanges.diplomaticControl)) {
            updated.vassalPolicy.diplomaticControl = policyChanges.diplomaticControl;
            
            // 外交控制对独立倾向的影响
            const independenceEffects = {
                autonomous: -2,  // 自主外交降低独立倾向
                guided: 0,       // 引导外交无影响
                puppet: 3,       // 傀儡外交增加独立倾向
            };
            updated.independencePressure = Math.min(100, Math.max(0,
                (updated.independencePressure || 0) + independenceEffects[policyChanges.diplomaticControl]
            ));
        }
    }
    
    // 调整贸易政策
    if (policyChanges.tradePolicy) {
        const validOptions = ['free', 'preferential', 'monopoly'];
        if (validOptions.includes(policyChanges.tradePolicy)) {
            updated.vassalPolicy.tradePolicy = policyChanges.tradePolicy;
            
            // 贸易政策对独立倾向的影响
            const independenceEffects = {
                free: -2,        // 自由贸易降低独立倾向
                preferential: 0, // 优惠准入无影响
                monopoly: 5,     // 垄断贸易大幅增加独立倾向
            };
            updated.independencePressure = Math.min(100, Math.max(0,
                (updated.independencePressure || 0) + independenceEffects[policyChanges.tradePolicy]
            ));
        }
    }
    
    // 调整朝贡率
    if (typeof policyChanges.tributeRate === 'number') {
        const baseTributeRate = config?.tributeRate || 0.1;
        // 允许在基础值的50%-150%范围内调整
        updated.tributeRate = Math.min(baseTributeRate * 1.5,
            Math.max(baseTributeRate * 0.5, policyChanges.tributeRate));
        
        // 提高朝贡率会增加独立倾向
        if (policyChanges.tributeRate > baseTributeRate) {
            const increase = Math.ceil((policyChanges.tributeRate - baseTributeRate) / baseTributeRate * 10);
            updated.independencePressure = Math.min(100,
                (updated.independencePressure || 0) + increase);
        }
    }
    
    // 调整自主度
    if (typeof policyChanges.autonomy === 'number') {
        const baseAutonomy = config?.autonomy || 50;
        // 允许在基础值的50%-120%范围内调整
        updated.autonomy = Math.min(Math.min(100, baseAutonomy * 1.2),
            Math.max(baseAutonomy * 0.5, policyChanges.autonomy));
        
        // 降低自主度会增加独立倾向
        if (policyChanges.autonomy < baseAutonomy) {
            const increase = Math.ceil((baseAutonomy - policyChanges.autonomy) / baseAutonomy * 10);
            updated.independencePressure = Math.min(100,
                (updated.independencePressure || 0) + increase);
        }
    }
    
    return updated;
};

/**
 * 获取玩家的所有附庸国
 * @param {Array} nations - 所有国家列表
 * @returns {Array} 附庸国列表
 */
export const getPlayerVassals = (nations) => {
    return (nations || []).filter(n => n.vassalOf === 'player');
};

/**
 * 计算附庸系统带来的总收益
 * @param {Array} nations - 所有国家列表
 * @returns {Object} 收益汇总
 */
export const calculateVassalBenefits = (nations) => {
    const vassals = getPlayerVassals(nations);
    
    let totalTribute = 0;
    let totalTradeBonus = 0;
    
    vassals.forEach(vassal => {
        totalTribute += calculateTribute(vassal);
        
        const config = VASSAL_TYPE_CONFIGS[vassal.vassalType];
        if (config) {
            totalTradeBonus += config.tariffDiscount;
        }
    });
    
    return {
        vassalCount: vassals.length,
        monthlyTribute: totalTribute,
        tradeBonus: totalTradeBonus / Math.max(1, vassals.length),
    };
};

/**
 * 检查是否可以建立特定类型的附庸关系
 * @param {Object} nation - 目标国家
 * @param {string} vassalType - 附庸类型
 * @param {Object} params - 检查参数
 * @returns {Object} { canEstablish, reason }
 */
export const canEstablishVassal = (nation, vassalType, { epoch, playerMilitary, warScore }) => {
    const config = VASSAL_TYPE_CONFIGS[vassalType];
    if (!config) {
        return { canEstablish: false, reason: '无效的附庸类型' };
    }
    
    // 检查时代解锁
    if (!isDiplomacyUnlocked('sovereignty', vassalType, epoch)) {
        return { canEstablish: false, reason: `需要时代 ${config.minEra} 解锁` };
    }
    
    // 已经是附庸
    if (nation.vassalOf) {
        return { canEstablish: false, reason: '该国已是附庸国' };
    }
    
    // 检查关系要求（战争状态下通过战争分数判断）
    if (nation.isAtWar) {
        const requirements = {
            protectorate: 30,
            tributary: 50,
            puppet: 80,
            colony: 100,
        };
        if ((warScore || 0) < (requirements[vassalType] || 50)) {
            return { canEstablish: false, reason: `战争分数不足（需要 ${requirements[vassalType]}）` };
        }
    } else {
        // 和平状态需要高关系
        if ((nation.relation || 50) < config.minRelation) {
            return { canEstablish: false, reason: `关系不足（需要 ${config.minRelation}）` };
        }
    }
    
    // 检查军事力量比
    const militaryRatio = (nation.militaryStrength || 0.5) / Math.max(0.1, playerMilitary);
    if (militaryRatio > 0.8 && !nation.isAtWar) {
        return { canEstablish: false, reason: '对方军事力量过强' };
    }
    
    return { canEstablish: true, reason: null };
};
