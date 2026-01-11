/**
 * 外国叛乱与政权更迭系统
 * 
 * 功能：
 * 1. AI国家稳定度计算
 * 2. 异见组织度累积
 * 3. 叛乱触发与内战处理
 * 4. 政权更迭
 * 5. 玩家干预选项
 */

// ============================================
// 配置常量
// ============================================

/**
 * 稳定度配置
 */
export const STABILITY_CONFIG = {
    // 基础稳定度
    BASE_STABILITY: 50,
    
    // 最大/最小稳定度
    MAX_STABILITY: 100,
    MIN_STABILITY: 0,
    
    // 稳定度阈值
    THRESHOLDS: {
        VERY_STABLE: 80,      // 非常稳定
        STABLE: 60,           // 稳定
        UNSTABLE: 40,         // 不稳定
        VERY_UNSTABLE: 20,    // 非常不稳定
        CRISIS: 10,           // 危机
    },
    
    // 稳定度每日自然恢复
    DAILY_RECOVERY: 0.1,
    
    // 稳定度影响因素权重
    FACTORS: {
        war: -15,                    // 战争中
        warLosing: -10,              // 战争失利
        economicDecline: -8,         // 经济衰退
        lowEliteSatisfaction: -5,    // 精英不满（满意度<40）
        lowCommonersSatisfaction: -8, // 平民不满（满意度<30）
        lowUnderclassSatisfaction: -3, // 下层不满（满意度<20）
        recentDefeat: -20,           // 近期战败
        foreignDestabilization: -15, // 外国颠覆
        foreignSupport: 10,          // 外国支持
        strongEconomy: 5,            // 经济繁荣
        peacetime: 3,                // 和平时期
        vassalStatus: -10,           // 附庸状态
    },
};

/**
 * 异见组织度配置
 */
export const DISSIDENT_CONFIG = {
    // 每日基础增长（稳定度低于50时）
    BASE_DAILY_GROWTH: 0.2,
    
    // 稳定度系数（每低于50一点，增长率+2%）
    STABILITY_COEFFICIENT: 0.02,
    
    // 触发叛乱的阈值
    REBELLION_THRESHOLD: 100,
    
    // 叛乱后的重置值
    RESET_VALUE: 20,
    
    // 每日自然衰减（稳定度高于60时）
    DAILY_DECAY: 0.3,
    
    // 玩家资助叛乱的效果
    PLAYER_SUPPORT_BONUS: 2.0,
};

/**
 * 内战配置
 */
export const CIVIL_WAR_CONFIG = {
    // 内战持续时间范围（天）
    MIN_DURATION: 60,
    MAX_DURATION: 365,
    
    // 叛军初始实力（相对于政府军）
    REBEL_INITIAL_STRENGTH: 0.4,
    
    // 每日战斗伤亡率
    DAILY_CASUALTY_RATE: 0.02,
    
    // 外援效果
    FOREIGN_AID_MULTIPLIER: 1.3,
    
    // 胜利条件：一方实力降至此比例以下
    VICTORY_THRESHOLD: 0.2,
    
    // 内战对经济的影响（每日财富损失比例）
    ECONOMIC_DAMAGE_RATE: 0.01,
};

/**
 * 政体类型配置（用于政权更迭）
 */
export const GOVERNMENT_TYPES = {
    monarchy: {
        name: '君主制',
        baseStability: 55,
        rebellionRisk: 0.8,
        possibleSuccessors: ['republic', 'constitutional_monarchy', 'military_junta'],
    },
    republic: {
        name: '共和制',
        baseStability: 50,
        rebellionRisk: 0.7,
        possibleSuccessors: ['monarchy', 'military_junta', 'theocracy'],
    },
    constitutional_monarchy: {
        name: '君主立宪制',
        baseStability: 60,
        rebellionRisk: 0.6,
        possibleSuccessors: ['republic', 'monarchy'],
    },
    military_junta: {
        name: '军政府',
        baseStability: 45,
        rebellionRisk: 1.0,
        possibleSuccessors: ['republic', 'monarchy', 'dictatorship'],
    },
    theocracy: {
        name: '神权政治',
        baseStability: 55,
        rebellionRisk: 0.9,
        possibleSuccessors: ['republic', 'monarchy'],
    },
    dictatorship: {
        name: '独裁政权',
        baseStability: 40,
        rebellionRisk: 1.2,
        possibleSuccessors: ['republic', 'military_junta'],
    },
};

// ============================================
// 稳定度计算
// ============================================

/**
 * 计算AI国家的稳定度
 * @param {Object} nation - AI国家对象
 * @param {Object} gameState - 游戏状态
 * @returns {Object} - 稳定度计算结果
 */
export function calculateStability(nation, gameState = {}) {
    const factors = [];
    let stability = nation.baseStability || STABILITY_CONFIG.BASE_STABILITY;
    
    // 战争影响
    if (nation.isAtWar) {
        factors.push({ name: '战争中', value: STABILITY_CONFIG.FACTORS.war });
        stability += STABILITY_CONFIG.FACTORS.war;
        
        // 战争失利
        if ((nation.warScore || 0) < -30) {
            factors.push({ name: '战争失利', value: STABILITY_CONFIG.FACTORS.warLosing });
            stability += STABILITY_CONFIG.FACTORS.warLosing;
        }
    } else {
        // 和平时期
        factors.push({ name: '和平时期', value: STABILITY_CONFIG.FACTORS.peacetime });
        stability += STABILITY_CONFIG.FACTORS.peacetime;
    }
    
    // 近期战败
    if (nation.recentDefeatDay && gameState.daysElapsed) {
        const daysSinceDefeat = gameState.daysElapsed - nation.recentDefeatDay;
        if (daysSinceDefeat < 180) {
            const penalty = STABILITY_CONFIG.FACTORS.recentDefeat * (1 - daysSinceDefeat / 180);
            factors.push({ name: '近期战败', value: Math.round(penalty) });
            stability += penalty;
        }
    }
    
    // 阶层满意度影响
    const socialStructure = nation.socialStructure || {};
    
    if (socialStructure.elites && socialStructure.elites.satisfaction < 40) {
        factors.push({ name: '精英不满', value: STABILITY_CONFIG.FACTORS.lowEliteSatisfaction });
        stability += STABILITY_CONFIG.FACTORS.lowEliteSatisfaction;
    }
    
    if (socialStructure.commoners && socialStructure.commoners.satisfaction < 30) {
        factors.push({ name: '平民不满', value: STABILITY_CONFIG.FACTORS.lowCommonersSatisfaction });
        stability += STABILITY_CONFIG.FACTORS.lowCommonersSatisfaction;
    }
    
    if (socialStructure.underclass && socialStructure.underclass.satisfaction < 20) {
        factors.push({ name: '下层不满', value: STABILITY_CONFIG.FACTORS.lowUnderclassSatisfaction });
        stability += STABILITY_CONFIG.FACTORS.lowUnderclassSatisfaction;
    }
    
    // 经济影响
    if (nation.economicGrowth !== undefined) {
        if (nation.economicGrowth < -5) {
            factors.push({ name: '经济衰退', value: STABILITY_CONFIG.FACTORS.economicDecline });
            stability += STABILITY_CONFIG.FACTORS.economicDecline;
        } else if (nation.economicGrowth > 5) {
            factors.push({ name: '经济繁荣', value: STABILITY_CONFIG.FACTORS.strongEconomy });
            stability += STABILITY_CONFIG.FACTORS.strongEconomy;
        }
    }
    
    // 附庸状态
    if (nation.isVassal || nation.overlordId) {
        factors.push({ name: '附庸状态', value: STABILITY_CONFIG.FACTORS.vassalStatus });
        stability += STABILITY_CONFIG.FACTORS.vassalStatus;
    }
    
    // 外部干预
    if (nation.foreignDestabilization > 0) {
        const destabPenalty = Math.min(nation.foreignDestabilization, 30);
        factors.push({ name: '外国颠覆', value: -destabPenalty });
        stability -= destabPenalty;
    }
    
    if (nation.foreignSupport > 0) {
        const supportBonus = Math.min(nation.foreignSupport, 20);
        factors.push({ name: '外国支持', value: supportBonus });
        stability += supportBonus;
    }
    
    // 限制范围
    stability = Math.max(STABILITY_CONFIG.MIN_STABILITY, 
                         Math.min(STABILITY_CONFIG.MAX_STABILITY, stability));
    
    // 确定稳定度等级
    let level = 'stable';
    if (stability >= STABILITY_CONFIG.THRESHOLDS.VERY_STABLE) {
        level = 'very_stable';
    } else if (stability >= STABILITY_CONFIG.THRESHOLDS.STABLE) {
        level = 'stable';
    } else if (stability >= STABILITY_CONFIG.THRESHOLDS.UNSTABLE) {
        level = 'unstable';
    } else if (stability >= STABILITY_CONFIG.THRESHOLDS.VERY_UNSTABLE) {
        level = 'very_unstable';
    } else {
        level = 'crisis';
    }
    
    return {
        value: Math.round(stability),
        level,
        factors,
    };
}

/**
 * 获取稳定度等级的显示信息
 * @param {string} level - 稳定度等级
 * @returns {Object} - 显示信息
 */
export function getStabilityLevelInfo(level) {
    const levelInfo = {
        very_stable: { label: '非常稳定', color: 'text-green-400', bgColor: 'bg-green-900/30' },
        stable: { label: '稳定', color: 'text-blue-400', bgColor: 'bg-blue-900/30' },
        unstable: { label: '不稳定', color: 'text-yellow-400', bgColor: 'bg-yellow-900/30' },
        very_unstable: { label: '非常不稳定', color: 'text-orange-400', bgColor: 'bg-orange-900/30' },
        crisis: { label: '危机', color: 'text-red-400', bgColor: 'bg-red-900/30' },
    };
    return levelInfo[level] || levelInfo.stable;
}

// ============================================
// 异见组织度计算
// ============================================

/**
 * 更新AI国家的异见组织度
 * @param {Object} nation - AI国家对象
 * @param {number} stability - 当前稳定度
 * @returns {Object} - 更新后的异见数据
 */
export function updateDissidentOrganization(nation, stability) {
    let dissidentOrg = nation.dissidentOrganization || 0;
    let growth = 0;
    
    if (stability < 50) {
        // 稳定度低于50时，异见组织度增长
        const stabilityDeficit = 50 - stability;
        growth = DISSIDENT_CONFIG.BASE_DAILY_GROWTH * 
                 (1 + stabilityDeficit * DISSIDENT_CONFIG.STABILITY_COEFFICIENT);
        
        // 玩家资助效果
        if (nation.playerSupportingRebels) {
            growth *= DISSIDENT_CONFIG.PLAYER_SUPPORT_BONUS;
        }
        
        dissidentOrg += growth;
    } else if (stability > 60) {
        // 稳定度高于60时，异见组织度衰减
        growth = -DISSIDENT_CONFIG.DAILY_DECAY;
        dissidentOrg = Math.max(0, dissidentOrg + growth);
    }
    
    return {
        value: Math.min(dissidentOrg, DISSIDENT_CONFIG.REBELLION_THRESHOLD * 1.5),
        dailyChange: growth,
        rebellionProgress: Math.min(100, (dissidentOrg / DISSIDENT_CONFIG.REBELLION_THRESHOLD) * 100),
    };
}

/**
 * 检查是否触发叛乱
 * @param {Object} nation - AI国家对象
 * @returns {boolean} - 是否触发叛乱
 */
export function checkRebellionTrigger(nation) {
    const dissidentOrg = nation.dissidentOrganization || 0;
    
    if (dissidentOrg >= DISSIDENT_CONFIG.REBELLION_THRESHOLD) {
        // 基础触发概率
        let triggerChance = 0.1;
        
        // 超过阈值越多，概率越高
        const excess = dissidentOrg - DISSIDENT_CONFIG.REBELLION_THRESHOLD;
        triggerChance += excess * 0.02;
        
        // 玩家资助增加触发概率
        if (nation.playerSupportingRebels) {
            triggerChance *= 1.5;
        }
        
        return Math.random() < triggerChance;
    }
    
    return false;
}

// ============================================
// 内战处理
// ============================================

/**
 * 触发内战
 * @param {Object} nation - AI国家对象
 * @param {number} daysElapsed - 当前游戏天数
 * @returns {Object} - 内战数据
 */
export function triggerCivilWar(nation, daysElapsed) {
    const governmentStrength = calculateGovernmentStrength(nation);
    const rebelStrength = governmentStrength * CIVIL_WAR_CONFIG.REBEL_INITIAL_STRENGTH;
    
    // 随机内战持续时间
    const estimatedDuration = CIVIL_WAR_CONFIG.MIN_DURATION + 
        Math.random() * (CIVIL_WAR_CONFIG.MAX_DURATION - CIVIL_WAR_CONFIG.MIN_DURATION);
    
    return {
        isInCivilWar: true,
        civilWarStartDay: daysElapsed,
        civilWarData: {
            governmentStrength,
            rebelStrength,
            governmentSupport: [], // 支持政府的国家ID
            rebelSupport: [],      // 支持叛军的国家ID
            casualties: {
                government: 0,
                rebels: 0,
                civilian: 0,
            },
            economicDamage: 0,
            estimatedDuration: Math.round(estimatedDuration),
        },
        // 重置异见组织度
        dissidentOrganization: DISSIDENT_CONFIG.RESET_VALUE,
    };
}

/**
 * 计算政府军事实力
 * @param {Object} nation - AI国家对象
 * @returns {number} - 军事实力值
 */
function calculateGovernmentStrength(nation) {
    // 基于国家财富和军事传统计算
    const wealth = nation.wealth || 1000;
    const militaryTradition = nation.militaryTradition || 50;
    
    return Math.round(wealth * 0.5 + militaryTradition * 10);
}

/**
 * 处理内战每日更新
 * @param {Object} nation - AI国家对象
 * @param {number} daysElapsed - 当前游戏天数
 * @returns {Object} - 更新后的内战数据和可能的结果
 */
export function processCivilWarDaily(nation, daysElapsed) {
    if (!nation.isInCivilWar || !nation.civilWarData) {
        return null;
    }
    
    const data = { ...nation.civilWarData };
    const warDuration = daysElapsed - nation.civilWarStartDay;
    
    // 计算双方实力变化
    let govStrengthMod = 1.0;
    let rebelStrengthMod = 1.0;
    
    // 外援效果
    if (data.governmentSupport.length > 0) {
        govStrengthMod *= CIVIL_WAR_CONFIG.FOREIGN_AID_MULTIPLIER;
    }
    if (data.rebelSupport.length > 0) {
        rebelStrengthMod *= CIVIL_WAR_CONFIG.FOREIGN_AID_MULTIPLIER;
    }
    
    // 每日战斗
    const govEffectiveStrength = data.governmentStrength * govStrengthMod;
    const rebelEffectiveStrength = data.rebelStrength * rebelStrengthMod;
    const totalStrength = govEffectiveStrength + rebelEffectiveStrength;
    
    // 伤亡计算
    const govCasualties = data.governmentStrength * CIVIL_WAR_CONFIG.DAILY_CASUALTY_RATE * 
                          (rebelEffectiveStrength / totalStrength);
    const rebelCasualties = data.rebelStrength * CIVIL_WAR_CONFIG.DAILY_CASUALTY_RATE * 
                            (govEffectiveStrength / totalStrength);
    
    data.governmentStrength = Math.max(0, data.governmentStrength - govCasualties);
    data.rebelStrength = Math.max(0, data.rebelStrength - rebelCasualties);
    
    data.casualties.government += govCasualties;
    data.casualties.rebels += rebelCasualties;
    data.casualties.civilian += (govCasualties + rebelCasualties) * 0.5;
    
    // 经济损失
    const dailyEconomicDamage = (nation.wealth || 1000) * CIVIL_WAR_CONFIG.ECONOMIC_DAMAGE_RATE;
    data.economicDamage += dailyEconomicDamage;
    
    // 检查胜利条件
    const initialGovStrength = calculateGovernmentStrength(nation);
    const initialRebelStrength = initialGovStrength * CIVIL_WAR_CONFIG.REBEL_INITIAL_STRENGTH;
    
    let result = null;
    
    if (data.governmentStrength < initialGovStrength * CIVIL_WAR_CONFIG.VICTORY_THRESHOLD) {
        // 叛军胜利
        result = {
            winner: 'rebels',
            warDuration,
            casualties: data.casualties,
            economicDamage: data.economicDamage,
        };
    } else if (data.rebelStrength < initialRebelStrength * CIVIL_WAR_CONFIG.VICTORY_THRESHOLD) {
        // 政府胜利
        result = {
            winner: 'government',
            warDuration,
            casualties: data.casualties,
            economicDamage: data.economicDamage,
        };
    }
    
    return {
        civilWarData: data,
        result,
        wealthLoss: dailyEconomicDamage,
    };
}

// ============================================
// 政权更迭
// ============================================

/**
 * 处理政权更迭
 * @param {Object} nation - AI国家对象
 * @param {string} winner - 胜利方 ('rebels' 或 'government')
 * @param {number} daysElapsed - 当前游戏天数
 * @returns {Object} - 更迭后的国家数据
 */
export function handleRegimeChange(nation, winner, daysElapsed) {
    const updates = {
        isInCivilWar: false,
        civilWarData: null,
        civilWarEndDay: daysElapsed,
    };
    
    if (winner === 'rebels') {
        // 叛军胜利，政权更迭
        const currentGov = nation.governmentType || 'monarchy';
        const govConfig = GOVERNMENT_TYPES[currentGov] || GOVERNMENT_TYPES.monarchy;
        
        // 随机选择新政体
        const possibleGovs = govConfig.possibleSuccessors || ['republic'];
        const newGov = possibleGovs[Math.floor(Math.random() * possibleGovs.length)];
        
        updates.governmentType = newGov;
        updates.previousGovernmentType = currentGov;
        updates.regimeChangeDay = daysElapsed;
        
        // 新政权的基础稳定度
        const newGovConfig = GOVERNMENT_TYPES[newGov] || GOVERNMENT_TYPES.republic;
        updates.baseStability = newGovConfig.baseStability;
        updates.stability = newGovConfig.baseStability - 10; // 刚经历内战，稳定度较低
        
        // 外交关系重置
        updates.relationResetPending = true;
        updates.treaties = []; // 清空所有条约
        
        // 如果是附庸，有机会独立
        if (nation.isVassal || nation.overlordId) {
            updates.isVassal = false;
            updates.overlordId = null;
            updates.vassalType = null;
            updates.independenceWar = false;
            updates.becameIndependentDay = daysElapsed;
        }
        
        // 财富损失
        updates.wealth = Math.max(100, (nation.wealth || 1000) * 0.5);
        
        // 重新生成阶层结构
        updates.socialStructure = generatePostWarSocialStructure(newGov);
    } else {
        // 政府胜利
        updates.stability = Math.min(60, (nation.stability || 40) + 10);
        updates.dissidentOrganization = 10;
        
        // 财富损失（但比叛军胜利少）
        updates.wealth = Math.max(100, (nation.wealth || 1000) * 0.7);
    }
    
    return updates;
}

/**
 * 生成内战后的阶层结构
 * @param {string} governmentType - 新政体类型
 * @returns {Object} - 阶层结构
 */
function generatePostWarSocialStructure(governmentType) {
    // 内战后满意度普遍较低
    const baseStructure = {
        elites: { ratio: 0.10, satisfaction: 40, influence: 0.40 },
        commoners: { ratio: 0.80, satisfaction: 35, influence: 0.40 },
        underclass: { ratio: 0.10, satisfaction: 30, influence: 0.20 },
    };
    
    // 根据新政体调整
    if (governmentType === 'republic') {
        baseStructure.commoners.satisfaction += 10;
        baseStructure.elites.satisfaction -= 5;
    } else if (governmentType === 'military_junta') {
        baseStructure.elites.satisfaction += 5;
        baseStructure.commoners.satisfaction -= 10;
    }
    
    return baseStructure;
}

// ============================================
// 玩家干预
// ============================================

/**
 * 干预选项配置
 */
export const INTERVENTION_OPTIONS = {
    support_government: {
        id: 'support_government',
        name: '支持政府',
        description: '为现政权提供资金和军事支持',
        cost: { silver: 1000 },
        effects: {
            foreignSupport: 15,
            relationChange: 20,
        },
        requiresWar: false,
    },
    support_rebels: {
        id: 'support_rebels',
        name: '支持叛军',
        description: '秘密资助反对派势力',
        cost: { silver: 500 },
        effects: {
            foreignDestabilization: 10,
            playerSupportingRebels: true,
            relationChange: -30,
        },
        requiresWar: false,
    },
    destabilize: {
        id: 'destabilize',
        name: '颠覆活动',
        description: '派遣间谍进行颠覆活动',
        cost: { silver: 300 },
        effects: {
            foreignDestabilization: 8,
            relationChange: -15,
        },
        requiresWar: false,
    },
    military_intervention: {
        id: 'military_intervention',
        name: '军事干预',
        description: '直接派兵干预内战',
        cost: { silver: 2000, military: 500 },
        effects: {
            directMilitarySupport: true,
        },
        requiresWar: true,
        requiresCivilWar: true,
    },
    humanitarian_aid: {
        id: 'humanitarian_aid',
        name: '人道主义援助',
        description: '向受难平民提供援助',
        cost: { silver: 200 },
        effects: {
            civilianSatisfactionBonus: 5,
            relationChange: 5,
        },
        requiresWar: false,
    },
};

/**
 * 执行玩家干预
 * @param {Object} nation - 目标AI国家
 * @param {string} interventionType - 干预类型
 * @param {Object} playerResources - 玩家资源
 * @returns {Object} - 干预结果
 */
export function executeIntervention(nation, interventionType, playerResources) {
    const option = INTERVENTION_OPTIONS[interventionType];
    if (!option) {
        return { success: false, reason: 'invalid_intervention' };
    }
    
    // 检查前置条件
    if (option.requiresCivilWar && !nation.isInCivilWar) {
        return { success: false, reason: 'no_civil_war' };
    }
    
    // 检查资源
    const cost = option.cost;
    if (cost.silver && (playerResources.silver || 0) < cost.silver) {
        return { success: false, reason: 'insufficient_silver' };
    }
    if (cost.military && (playerResources.military || 0) < cost.military) {
        return { success: false, reason: 'insufficient_military' };
    }
    
    // 计算效果
    const effects = { ...option.effects };
    const nationUpdates = {};
    
    if (effects.foreignSupport) {
        nationUpdates.foreignSupport = (nation.foreignSupport || 0) + effects.foreignSupport;
    }
    if (effects.foreignDestabilization) {
        nationUpdates.foreignDestabilization = (nation.foreignDestabilization || 0) + effects.foreignDestabilization;
    }
    if (effects.playerSupportingRebels) {
        nationUpdates.playerSupportingRebels = true;
    }
    if (effects.relationChange) {
        nationUpdates.relation = Math.max(0, Math.min(100, (nation.relation || 50) + effects.relationChange));
    }
    
    // 军事干预特殊处理
    if (effects.directMilitarySupport && nation.isInCivilWar && nation.civilWarData) {
        nationUpdates.civilWarData = {
            ...nation.civilWarData,
            governmentSupport: [...(nation.civilWarData.governmentSupport || []), 'player'],
        };
    }
    
    return {
        success: true,
        cost,
        nationUpdates,
        message: `成功对 ${nation.name} 执行${option.name}`,
    };
}

// ============================================
// 每日处理主函数
// ============================================

/**
 * 处理所有AI国家的叛乱系统每日更新
 * @param {Array} nations - AI国家列表
 * @param {Object} gameState - 游戏状态
 * @returns {Object} - 处理结果
 */
export function processRebellionSystemDaily(nations, gameState) {
    const { daysElapsed = 0 } = gameState;
    const updates = [];
    const events = [];
    
    for (const nation of nations) {
        if (!nation || nation.isPlayer) continue;
        
        const nationUpdate = { id: nation.id };
        
        // 1. 计算稳定度
        const stabilityResult = calculateStability(nation, gameState);
        nationUpdate.stability = stabilityResult.value;
        nationUpdate.stabilityLevel = stabilityResult.level;
        nationUpdate.stabilityFactors = stabilityResult.factors;
        
        // 2. 处理内战中的国家
        if (nation.isInCivilWar) {
            const civilWarResult = processCivilWarDaily(nation, daysElapsed);
            if (civilWarResult) {
                nationUpdate.civilWarData = civilWarResult.civilWarData;
                nationUpdate.wealth = Math.max(0, (nation.wealth || 0) - civilWarResult.wealthLoss);
                
                // 内战结束
                if (civilWarResult.result) {
                    const regimeChanges = handleRegimeChange(nation, civilWarResult.result.winner, daysElapsed);
                    Object.assign(nationUpdate, regimeChanges);
                    
                    events.push({
                        type: 'civil_war_ended',
                        nationId: nation.id,
                        nationName: nation.name,
                        winner: civilWarResult.result.winner,
                        newGovernment: regimeChanges.governmentType,
                        day: daysElapsed,
                    });
                }
            }
        } else {
            // 3. 更新异见组织度
            const dissidentResult = updateDissidentOrganization(nation, stabilityResult.value);
            nationUpdate.dissidentOrganization = dissidentResult.value;
            nationUpdate.dissidentDailyChange = dissidentResult.dailyChange;
            nationUpdate.rebellionProgress = dissidentResult.rebellionProgress;
            
            // 4. 检查叛乱触发
            if (checkRebellionTrigger({ ...nation, ...nationUpdate })) {
                const civilWarData = triggerCivilWar(nation, daysElapsed);
                Object.assign(nationUpdate, civilWarData);
                
                events.push({
                    type: 'civil_war_started',
                    nationId: nation.id,
                    nationName: nation.name,
                    day: daysElapsed,
                });
            }
        }
        
        // 5. 外部影响自然衰减
        if (nation.foreignSupport > 0) {
            nationUpdate.foreignSupport = Math.max(0, nation.foreignSupport - 0.5);
        }
        if (nation.foreignDestabilization > 0) {
            nationUpdate.foreignDestabilization = Math.max(0, nation.foreignDestabilization - 0.3);
        }
        
        updates.push(nationUpdate);
    }
    
    return { updates, events };
}

/**
 * 获取国家的叛乱风险评估
 * @param {Object} nation - AI国家对象
 * @returns {Object} - 风险评估
 */
export function getRebellionRiskAssessment(nation) {
    const stability = nation.stability || 50;
    const dissidentOrg = nation.dissidentOrganization || 0;
    const rebellionProgress = nation.rebellionProgress || 0;
    
    let riskLevel = 'low';
    let riskScore = 0;
    
    // 基于稳定度
    if (stability < 20) {
        riskScore += 40;
    } else if (stability < 40) {
        riskScore += 25;
    } else if (stability < 60) {
        riskScore += 10;
    }
    
    // 基于叛乱进度
    riskScore += rebellionProgress * 0.5;
    
    // 内战中
    if (nation.isInCivilWar) {
        riskLevel = 'active';
        riskScore = 100;
    } else if (riskScore >= 70) {
        riskLevel = 'critical';
    } else if (riskScore >= 50) {
        riskLevel = 'high';
    } else if (riskScore >= 30) {
        riskLevel = 'moderate';
    }
    
    return {
        riskLevel,
        riskScore: Math.min(100, Math.round(riskScore)),
        stability,
        rebellionProgress,
        isInCivilWar: nation.isInCivilWar || false,
    };
}

export default {
    // 配置
    STABILITY_CONFIG,
    DISSIDENT_CONFIG,
    CIVIL_WAR_CONFIG,
    GOVERNMENT_TYPES,
    INTERVENTION_OPTIONS,
    
    // 稳定度
    calculateStability,
    getStabilityLevelInfo,
    
    // 异见组织度
    updateDissidentOrganization,
    checkRebellionTrigger,
    
    // 内战
    triggerCivilWar,
    processCivilWarDaily,
    
    // 政权更迭
    handleRegimeChange,
    
    // 玩家干预
    executeIntervention,
    
    // 主处理函数
    processRebellionSystemDaily,
    getRebellionRiskAssessment,
};
