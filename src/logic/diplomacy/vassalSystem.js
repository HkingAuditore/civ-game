/**
 * Vassal System Module
 * 附庸系统：处理保护国、朝贡国、傀儡国、殖民地的逻辑
 */

import {
    VASSAL_TYPE_CONFIGS,
    calculateIndependenceDesire,
    isDiplomacyUnlocked,
    INDEPENDENCE_WAR_CONDITIONS,
    TRIBUTE_CONFIG,
    INDEPENDENCE_CONFIG,
    calculateAverageSatisfaction,
    LABOR_POLICY_DEFINITIONS,
    TRADE_POLICY_DEFINITIONS,
    GOVERNANCE_POLICY_DEFINITIONS,
    MILITARY_POLICY_DEFINITIONS,
    VASSAL_POLICY_PRESETS,
} from '../../config/diplomacy.js';
import { calculateGovernorFullEffects } from './vassalGovernors.js';
import { 
    getVassalReputationCategory, 
    getReputationEffect,
    REPUTATION_EFFECTS,
} from '../../config/reputationSystem.js';
import {
    getVassalIndependenceMultiplier,
    getVassalIndependenceWarChance,
} from '../../config/difficulty.js';

// ========== 独立倾向计算共享配置 ==========
// 所有涉及独立倾向每日变化的数值都在此处统一配置
export const INDEPENDENCE_CHANGE_CONFIG = {
    // 基础自然增长（民族意识觉醒）
    baseGrowthRate: 0.02,           // 基础增长率：0.02%/天
    eraMultiplierStep: 0.3,         // 每时代增加的倍率：+30%
    
    // 政策影响数值（每日变化，单位：%/天）
    policies: {
        // 劳工政策
        labor: {
            standard:     { effect: 0,      name: '正常雇佣' },
            exploitation: { effect: 0.05,   name: '压榨剥削' },
            slavery:      { effect: 0.1,    name: '强制劳动' },
        },
        // 贸易政策
        trade: {
            free:         { effect: -0.01,  name: '自由贸易' },
            preferential: { effect: 0,      name: '优惠准入' },
            exclusive:    { effect: 0.04,   name: '排他贸易' },
            dumping:      { effect: 0.08,   name: '倾销市场' },
            looting:      { effect: 0.1,    name: '资源掠夺' },
        },
        // 治理政策
        governance: {
            autonomous:   { effect: -0.03,  name: '自治' },
            puppet_govt:  { effect: 0,      name: '傀儡政府' },
            direct_rule:  { effect: 0.1,   name: '直接统治' },
        },
        // 军事政策
        military: {
            autonomous:   { effect: -0.01,  name: '自主参战' },
            call_to_arms: { effect: 0.05,      name: '战争征召' },
            auto_join:    { effect: 0.1,   name: '自动参战' },
        },
        // 投资政策
        investment: {
            autonomous:   { effect: 0,      name: '自主投资' },
            guided:       { effect: 0.04,   name: '引导投资' },
            forced:       { effect: 0.1,   name: '强制投资' },
        },
    },
    
    // 阶层满意度影响参数
    satisfaction: {
        baseLine: 50,               // 满意度基准线
        divisor: 1000,              // 除数（(50-sat)/1000）
    },
    
    // 经济繁荣度影响参数（基于财富比值）
    economy: {
        totalWealthFactor: 0.015,   // 总财富比值系数
        perCapitaFactor: 0.015,     // 人均财富比值系数
    },
    
    // 朝贡负担影响
    tribute: {
        multiplier: 0.5,            // 每1%朝贡率 → +0.005%/天（即tributeRate * 0.5）
    },
};

// ========== 阶层满意度上限共享配置 ==========
// 满意度上限受多种因素动态影响，不再写死
export const SATISFACTION_CAP_CONFIG = {
    // 基础满意度上限（理想状态下的最高值）
    baseCap: 95,
    
    // 统治政策对满意度上限的影响
    policies: {
        // 劳工政策
        labor: {
            standard:     { elites: 0,  commoners: 0,  underclass: 0 },
            exploitation: { elites: 2,  commoners: -8, underclass: -15 },
            slavery:      { elites: 5,  commoners: -15, underclass: -30 },
        },
        // 贸易政策
        trade: {
            free:         { elites: -3, commoners: 3,  underclass: 2 },
            preferential: { elites: 0,  commoners: 0,  underclass: 0 },
            exclusive:    { elites: 3,  commoners: -5, underclass: -3 },
            dumping:      { elites: 5,  commoners: -10, underclass: -8 },
            looting:      { elites: 8,  commoners: -15, underclass: -12 },
        },
        // 治理政策
        governance: {
            autonomous:   { elites: 5,  commoners: 3,  underclass: 2 },
            puppet_govt:  { elites: 0,  commoners: -3, underclass: -3 },
            direct_rule:  { elites: -10, commoners: -8, underclass: -5 },
        },
        // 军事政策
        military: {
            autonomous:   { elites: 2,  commoners: 2,  underclass: 2 },
            call_to_arms: { elites: 0,  commoners: -3, underclass: -5 },
            auto_join:    { elites: -3, commoners: -8, underclass: -10 },
        },
        // 投资政策
        investment: {
            autonomous:   { elites: 0,  commoners: 0,  underclass: 0 },
            guided:       { elites: 2,  commoners: -2, underclass: -3 },
            forced:       { elites: 5,  commoners: -8, underclass: -10 },
        },
    },
    
    // 经济实力对比对满意度上限的影响
    // 附庸国经济越强，人民越不满足于被统治
    economy: {
        // 人均财富比值的影响（附庸/宗主）
        perCapitaRatioEffect: {
            // 比值 > 1: 附庸国民众生活水平更高，不满被统治
            above1Penalty: -5,        // 每超出1倍，上限-5%
            // 比值 < 1: 附庸国民众生活水平更低，接受统治
            below1Bonus: 3,           // 每低于1倍，上限+3%
            maxPenalty: -20,          // 最大惩罚
            maxBonus: 10,             // 最大奖励
        },
        // 总财富比值的影响（附庸/宗主）
        wealthRatioEffect: {
            above1Penalty: -3,        // 附庸国更富：每超出1倍，上限-3%
            below1Bonus: 2,           // 宗主国更富：每低于1倍，上限+2%
            maxPenalty: -15,
            maxBonus: 8,
        },
    },
    
    // 国际局势对满意度上限的影响
    international: {
        // 宗主国处于战争状态
        atWar: -5,                    // 战争中民众不满加剧
        // 附庸国有盟友支持独立
        hasIndependenceSupport: -10,  // 有外部势力支持独立
        // 宗主国国际声誉
        reputationEffect: {
            good: 5,                  // 好名声 → +5%
            neutral: 0,
            bad: -10,                 // 坏名声 → -10%
        },
    },
    
    // 军事实力对比
    military: {
        // 宗主国军事优势
        strongSuzerain: 5,            // 宗主国军力远超附庸 → +5%
        weakSuzerain: -10,            // 宗主国军力弱于附庸 → -10%
    },
    
    // 朝贡负担对上限的影响
    tribute: {
        perPercentPenalty: -0.3,      // 每1%朝贡率 → 上限-0.3%
        maxPenalty: -15,              // 最大惩罚-15%
    },
    
    // 最终上限的硬性边界
    absoluteMin: 20,                  // 最低不能低于20%
    absoluteMax: 98,                  // 最高不能超过98%
};

/**
 * 计算附庸国各阶层的动态满意度上限
 * 满意度上限受统治政策、经济对比、国际局势、军事实力等多因素影响
 * 
 * @param {Object} nation - 附庸国对象
 * @param {Object} context - 上下文信息
 * @param {number} context.suzereainWealth - 宗主国财富
 * @param {number} context.suzereainPopulation - 宗主国人口
 * @param {number} context.suzereainMilitary - 宗主国军事力量
 * @param {boolean} context.suzereainAtWar - 宗主国是否处于战争状态
 * @param {string} context.suzereainReputation - 宗主国国际声誉 ('good'|'neutral'|'bad')
 * @param {boolean} context.hasIndependenceSupport - 是否有外部势力支持独立
 * @returns {Object} 各阶层的满意度上限 { elites, commoners, underclass, factors }
 */
export const calculateDynamicSatisfactionCap = (nation, context = {}) => {
    const cfg = SATISFACTION_CAP_CONFIG;
    const vassalPolicy = nation?.vassalPolicy || {};
    
    // 默认上下文值
    const {
        suzereainWealth = 10000,
        suzereainPopulation = 1000000,
        suzereainMilitary = 1.0,
        suzereainAtWar = false,
        suzereainReputation = 'neutral',
        hasIndependenceSupport = false,
    } = context;
    
    // 初始化各阶层的上限和影响因素记录
    const caps = {
        elites: cfg.baseCap,
        commoners: cfg.baseCap,
        underclass: cfg.baseCap,
    };
    const factors = {
        elites: [],
        commoners: [],
        underclass: [],
    };
    
    const strata = ['elites', 'commoners', 'underclass'];
    
    // ========== 1. 统治政策影响 ==========
    // 1.1 劳工政策
    const laborPolicy = vassalPolicy.labor || 'standard';
    const laborEffects = cfg.policies.labor[laborPolicy];
    if (laborEffects) {
        strata.forEach(s => {
            if (laborEffects[s] !== 0) {
                caps[s] += laborEffects[s];
                factors[s].push({ name: '劳工政策', value: laborEffects[s], desc: laborPolicy });
            }
        });
    }
    
    // 1.2 贸易政策
    const tradePolicy = vassalPolicy.tradePolicy || 'preferential';
    const tradeEffects = cfg.policies.trade[tradePolicy];
    if (tradeEffects) {
        strata.forEach(s => {
            if (tradeEffects[s] !== 0) {
                caps[s] += tradeEffects[s];
                factors[s].push({ name: '贸易政策', value: tradeEffects[s], desc: tradePolicy });
            }
        });
    }
    
    // 1.3 治理政策
    const governancePolicy = vassalPolicy.governance || 'autonomous';
    const governanceEffects = cfg.policies.governance[governancePolicy];
    if (governanceEffects) {
        strata.forEach(s => {
            if (governanceEffects[s] !== 0) {
                caps[s] += governanceEffects[s];
                factors[s].push({ name: '治理政策', value: governanceEffects[s], desc: governancePolicy });
            }
        });
    }
    
    // 1.4 军事政策
    const militaryPolicy = vassalPolicy.military || 'call_to_arms';
    const militaryEffects = cfg.policies.military[militaryPolicy];
    if (militaryEffects) {
        strata.forEach(s => {
            if (militaryEffects[s] !== 0) {
                caps[s] += militaryEffects[s];
                factors[s].push({ name: '军事政策', value: militaryEffects[s], desc: militaryPolicy });
            }
        });
    }
    
    // 1.5 投资政策
    const investmentPolicy = vassalPolicy.investmentPolicy || 'autonomous';
    const investmentEffects = cfg.policies.investment[investmentPolicy];
    if (investmentEffects) {
        strata.forEach(s => {
            if (investmentEffects[s] !== 0) {
                caps[s] += investmentEffects[s];
                factors[s].push({ name: '投资政策', value: investmentEffects[s], desc: investmentPolicy });
            }
        });
    }
    
    // ========== 2. 经济实力对比影响 ==========
    const vassalWealth = nation?.wealth || 500;
    const vassalPopulation = nation?.population || 10000;
    
    // 2.1 人均财富比值
    const vassalPerCapita = vassalWealth / Math.max(1, vassalPopulation);
    const suzereainPerCapita = suzereainWealth / Math.max(1, suzereainPopulation);
    const perCapitaRatio = vassalPerCapita / Math.max(0.0001, suzereainPerCapita);
    
    let perCapitaEffect = 0;
    if (perCapitaRatio > 1) {
        // 附庸国人均更富，不满被统治
        perCapitaEffect = Math.max(
            cfg.economy.perCapitaRatioEffect.maxPenalty,
            (perCapitaRatio - 1) * cfg.economy.perCapitaRatioEffect.above1Penalty
        );
    } else {
        // 宗主国人均更富，愿意接受统治
        perCapitaEffect = Math.min(
            cfg.economy.perCapitaRatioEffect.maxBonus,
            (1 - perCapitaRatio) * cfg.economy.perCapitaRatioEffect.below1Bonus
        );
    }
    
    if (perCapitaEffect !== 0) {
        strata.forEach(s => {
            caps[s] += perCapitaEffect;
            factors[s].push({ 
                name: '人均财富对比', 
                value: perCapitaEffect, 
                desc: `比值${perCapitaRatio.toFixed(2)}` 
            });
        });
    }
    
    // 2.2 总财富比值
    const wealthRatio = vassalWealth / Math.max(1, suzereainWealth);
    let wealthEffect = 0;
    if (wealthRatio > 1) {
        wealthEffect = Math.max(
            cfg.economy.wealthRatioEffect.maxPenalty,
            (wealthRatio - 1) * cfg.economy.wealthRatioEffect.above1Penalty
        );
    } else {
        wealthEffect = Math.min(
            cfg.economy.wealthRatioEffect.maxBonus,
            (1 - wealthRatio) * cfg.economy.wealthRatioEffect.below1Bonus
        );
    }
    
    if (wealthEffect !== 0) {
        strata.forEach(s => {
            caps[s] += wealthEffect;
            factors[s].push({ 
                name: '总财富对比', 
                value: wealthEffect, 
                desc: `比值${wealthRatio.toFixed(2)}` 
            });
        });
    }
    
    // ========== 3. 国际局势影响 ==========
    // 3.1 宗主国战争状态
    if (suzereainAtWar) {
        const warEffect = cfg.international.atWar;
        strata.forEach(s => {
            caps[s] += warEffect;
            factors[s].push({ name: '宗主国战争', value: warEffect, desc: '战时动荡' });
        });
    }
    
    // 3.2 外部独立支持
    if (hasIndependenceSupport) {
        const supportEffect = cfg.international.hasIndependenceSupport;
        strata.forEach(s => {
            caps[s] += supportEffect;
            factors[s].push({ name: '外部独立支持', value: supportEffect, desc: '有势力支持独立' });
        });
    }
    
    // 3.3 宗主国声誉
    // 支持传入数值声誉(0-100)或字符串('good'|'neutral'|'bad')
    let reputationCategory = suzereainReputation;
    if (typeof suzereainReputation === 'number') {
        reputationCategory = getVassalReputationCategory(suzereainReputation);
    }
    const reputationEffect = cfg.international.reputationEffect[reputationCategory] || 0;
    if (reputationEffect !== 0) {
        const reputationLabel = reputationCategory === 'good' ? '良好' 
            : reputationCategory === 'bad' ? '恶劣' : '普通';
        strata.forEach(s => {
            caps[s] += reputationEffect;
            factors[s].push({ name: '国际声誉', value: reputationEffect, desc: reputationLabel });
        });
    }
    
    // ========== 4. 军事实力对比 ==========
    const vassalMilitary = nation?.militaryStrength || 0.1;
    const militaryRatio = vassalMilitary / Math.max(0.01, suzereainMilitary);
    
    let milEffect = 0;
    if (militaryRatio < 0.3) {
        // 宗主国军力远超附庸
        milEffect = cfg.military.strongSuzerain;
    } else if (militaryRatio > 0.8) {
        // 附庸国军力接近或超过宗主国
        milEffect = cfg.military.weakSuzerain;
    }
    
    if (milEffect !== 0) {
        strata.forEach(s => {
            caps[s] += milEffect;
            factors[s].push({ 
                name: '军事力量对比', 
                value: milEffect, 
                desc: `军力比${militaryRatio.toFixed(2)}` 
            });
        });
    }
    
    // ========== 5. 朝贡负担影响 ==========
    const tributeRate = nation?.tributeRate || 0;
    if (tributeRate > 0) {
        const tributePenalty = Math.max(
            cfg.tribute.maxPenalty,
            tributeRate * 100 * cfg.tribute.perPercentPenalty
        );
        strata.forEach(s => {
            caps[s] += tributePenalty;
            factors[s].push({ 
                name: '朝贡负担', 
                value: tributePenalty, 
                desc: `${Math.round(tributeRate * 100)}%朝贡率` 
            });
        });
    }
    
    // ========== 6. 应用硬性边界 ==========
    strata.forEach(s => {
        caps[s] = Math.max(cfg.absoluteMin, Math.min(cfg.absoluteMax, caps[s]));
    });
    
    return {
        elites: caps.elites,
        commoners: caps.commoners,
        underclass: caps.underclass,
        factors: factors,
        baseCap: cfg.baseCap,
    };
};

/**
 * Calculate dynamic control cost based on vassal wealth
 * @param {string} measureType - Control measure type
 * @param {number} vassalWealth - Vassal nation wealth
 * @returns {number} Daily cost
 */
export const calculateControlMeasureCost = (measureType, vassalWealth = 1000) => {
    const measureConfig = INDEPENDENCE_CONFIG.controlMeasures[measureType];
    if (!measureConfig) return 0;

    const baseCost = measureConfig.baseCost || 50;
    const scalingFactor = measureConfig.wealthScalingFactor || 0;
    const scaledCost = Math.floor(vassalWealth * scalingFactor);

    return baseCost + scaledCost;
};

/**
 * Calculate governor effectiveness based on assigned official
 * @param {Object} official - Assigned official object
 * @param {Object} measureConfig - Governor measure config
 * @returns {Object} Effectiveness data
 */
export const calculateGovernorEffectiveness = (official, measureConfig) => {
    if (!official) {
        return {
            effectiveness: 0,
            independenceReduction: 0,
            satisfactionBonus: 0,
            warning: 'no_official',
        };
    }

    const baseEffectiveness = measureConfig.baseEffectiveness || 0.5;

    // Prestige affects effectiveness (0-100 scale)
    const prestigeFactor = (official.prestige || 50) / 100;

    // Loyalty affects reliability (low loyalty = reduced effectiveness + risk)
    const loyaltyFactor = (official.loyalty || 50) / 100;

    // Combined effectiveness (prestige for competence, loyalty for reliability)
    const effectiveness = baseEffectiveness * (0.5 + prestigeFactor * 0.5) * (0.5 + loyaltyFactor * 0.5);

    // Calculate actual independence reduction
    const baseReduction = measureConfig.independenceReduction || 0.2;
    const actualReduction = baseReduction * (1 + effectiveness);

    // Satisfaction bonus modified by official's origin stratum
    let satisfactionBonus = measureConfig.eliteSatisfactionBonus || 2;
    if (official.sourceStratum === 'elite' || official.sourceStratum === 'nobles') {
        satisfactionBonus *= 1.2; // Nobles are better at dealing with elites
    } else if (official.sourceStratum === 'commoner') {
        satisfactionBonus *= 0.8; // Commoners less respected by elites
    }

    // Low loyalty risk: might increase independence or siphon funds
    let loyaltyRisk = null;
    if ((official.loyalty || 50) < 40) {
        loyaltyRisk = {
            type: 'low_loyalty',
            corruptionChance: (40 - (official.loyalty || 50)) / 100,
            independenceIncrease: 0.05 * (40 - (official.loyalty || 50)) / 40,
        };
    }

    return {
        effectiveness,
        independenceReduction: actualReduction,
        satisfactionBonus: Math.floor(satisfactionBonus),
        loyaltyRisk,
        officialName: official.name || 'Unknown Official',
        officialPrestige: official.prestige || 50,
        officialLoyalty: official.loyalty || 50,
    };
};

/**
 * Check if garrison is effective based on military strength
 * @param {number} playerMilitary - Player's military strength
 * @param {number} vassalMilitary - Vassal's military strength
 * @returns {Object} Garrison effectiveness data
 */
export const checkGarrisonEffectiveness = (playerMilitary, vassalMilitary) => {
    const threshold = INDEPENDENCE_CONFIG.garrisonMilitaryThreshold || 0.5;
    const requiredStrength = vassalMilitary * threshold;
    const isEffective = playerMilitary >= requiredStrength;

    return {
        isEffective,
        playerMilitary,
        vassalMilitary,
        requiredStrength,
        ratio: vassalMilitary > 0 ? playerMilitary / vassalMilitary : 1,
        warning: !isEffective ? 'insufficient_military' : null,
    };
};

/**
 * 处理所有附庸国的每日更新
 * @param {Object} params - 更新参数
 * @returns {Object} 更新后的状态
 */
export const processVassalUpdates = ({
    nations,
    updateIds = null,
    daysElapsed,
    epoch,
    playerMilitary = 1.0,
    playerStability = 50,
    playerAtWar = false,
    playerWealth = 10000,
    playerPopulation = 1000000, // Player's total population for per capita calculations
    officials = [],       // NEW: Player's officials list
    difficultyLevel = 'normal', // Game difficulty level
    logs = [],
}) => {
    const updateSet = Array.isArray(updateIds) && updateIds.length > 0
        ? new Set(updateIds)
        : null;
    let tributeIncome = 0;
    let resourceTribute = {};
    let totalControlCost = 0;  // NEW: Track total control costs
    const vassalEvents = [];
    const controlWarnings = [];  // NEW: Track warnings about control measures

    const updatedNations = (nations || []).map(nation => {
        // 跳过非附庸国
        if (nation.vassalOf !== 'player') {
            return nation;
        }
        if (updateSet && !updateSet.has(nation.id)) {
            return nation;
        }

        const updated = { ...nation };
        const vassalConfig = VASSAL_TYPE_CONFIGS[updated.vassalType];
        if (!vassalConfig) return updated;

        const vassalWealth = updated.wealth || 500;
        const vassalMilitary = updated.militaryStrength || 0.5;

        // ========== 1. Process Control Measures Costs and Effects ==========
        let controlMeasureIndependenceReduction = 0;
        let vassalWealthChange = 0;

        if (updated.vassalPolicy?.controlMeasures) {
            const measures = updated.vassalPolicy.controlMeasures;

            // Process each active control measure
            Object.entries(measures).forEach(([measureId, measureData]) => {
                // Support both boolean (legacy) and object format
                const isActive = measureData === true || (measureData && measureData.active !== false);
                if (!isActive) return;

                const measureConfig = INDEPENDENCE_CONFIG.controlMeasures[measureId];
                if (!measureConfig) return;

                // Calculate dynamic cost
                const dailyCost = calculateControlMeasureCost(measureId, vassalWealth);
                totalControlCost += dailyCost;

                // Process specific measure effects
                switch (measureId) {
                    case 'governor': {
                        // Governor requires an assigned official
                        const officialId = measureData.officialId;
                        const official = officials.find(o => o.id === officialId);

                        if (measureConfig.requiresOfficial && !official) {
                            controlWarnings.push({
                                type: 'governor_no_official',
                                nationId: updated.id,
                                nationName: updated.name,
                                message: `${updated.name}的总督职位空缺，控制效果失效`,
                            });
                            // Still charge cost but no effect
                            break;
                        }

                        // ========== NEW: Use deep governor integration ==========
                        const govEffects = calculateGovernorFullEffects(official, updated);

                        // Apply independence reduction from governor
                        controlMeasureIndependenceReduction += govEffects.independenceReduction;
                        
                        // Apply elite satisfaction bonus
                        if (govEffects.eliteSatisfactionBonus > 0 && updated.socialStructure?.elites) {
                            updated.socialStructure = {
                                ...updated.socialStructure,
                                elites: {
                                    ...updated.socialStructure.elites,
                                    satisfaction: Math.min(100,
                                        (updated.socialStructure.elites.satisfaction || 50) +
                                        govEffects.eliteSatisfactionBonus * 0.05  // Daily accumulation
                                    ),
                                }
                            };
                        }

                        // Apply unrest suppression
                        if (govEffects.unrestSuppression > 0) {
                            updated.unrest = Math.max(0, (updated.unrest || 0) - govEffects.unrestSuppression);
                        }

                        // Store tribute modifier for later use in tribute calculation
                        updated._governorTributeModifier = govEffects.tributeModifier;
                        updated._governorCorruptionRate = govEffects.corruptionRate;

                        // Low loyalty risk effects
                        if (govEffects.warnings.includes('low_loyalty_corruption_risk') && Math.random() < 0.01) {
                            // Daily 1% chance to trigger corruption event
                            controlMeasureIndependenceReduction -= 0.05;
                            logs.push(`⚠️ ${updated.name}的总督${govEffects.officialName}行为不端，引发民众不满`);
                        }

                        // ========== NEW: 处理总督治理事件 (Governor Events) ==========
                        if (govEffects.governorEvent) {
                            const event = govEffects.governorEvent;
                            logs.push(`🏛️ ${updated.name}总督事件: ${event.desc}`);

                            // 效果应用
                            if (event.effect.silver) {
                                // 搜刮到的银币直接计入今日朝贡
                                tributeIncome += event.effect.silver;
                            }
                            if (event.effect.unrest) {
                                updated.unrest = (updated.unrest || 0) + event.effect.unrest;
                            }
                            if (event.effect.independence) {
                                // 直接调整当前的独立倾向数值 (负数 = 降低)
                                updated.independencePressure = Math.max(0, (updated.independencePressure || 0) + event.effect.independence);
                            }
                        }

                        // 应用独立上限降低 (同化政策)
                        if (govEffects.independenceCapReduction > 0) {
                            updated.independenceCap = Math.max(
                                10, // 最小上限
                                (updated.independenceCap || 100) - govEffects.independenceCapReduction
                            );
                        }

                        // Override cost with governor-calculated cost
                        totalControlCost += govEffects.dailyCost - dailyCost; // Adjust by difference

                        // [NEW] Governor Mandate Effects (Persistent State)
                        if (govEffects.mandateId === 'develop') {
                            // Develop: Increase Wealth
                            // Based on Admin skill (tributeModifier scales with Admin)
                            const growth = Math.floor((updated.wealth || 500) * 0.002 * (govEffects.tributeModifier || 1.0));
                            updated.wealth = (updated.wealth || 0) + growth;
                        }

                        break;
                    }

                    case 'garrison': {
                        // Check military strength requirement
                        const garrisonCheck = checkGarrisonEffectiveness(playerMilitary, vassalMilitary);

                        if (!garrisonCheck.isEffective) {
                            controlWarnings.push({
                                type: 'garrison_insufficient_military',
                                nationId: updated.id,
                                nationName: updated.name,
                                required: garrisonCheck.requiredStrength,
                                current: playerMilitary,
                                message: `驻军${updated.name}需要军力${garrisonCheck.requiredStrength.toFixed(1)}，当前${playerMilitary.toFixed(1)}`,
                            });
                            // Cost is still incurred but effect is reduced
                            controlMeasureIndependenceReduction += measureConfig.independenceReduction * 0.2; // 20% effectiveness without proper military
                        } else {
                            controlMeasureIndependenceReduction += measureConfig.independenceReduction;
                        }

                        // Apply commoner satisfaction penalty
                        if (measureConfig.commonerSatisfactionPenalty && updated.socialStructure?.commoners) {
                            updated.socialStructure = {
                                ...updated.socialStructure,
                                commoners: {
                                    ...updated.socialStructure.commoners,
                                    satisfaction: Math.max(0,
                                        (updated.socialStructure.commoners.satisfaction || 50) +
                                        measureConfig.commonerSatisfactionPenalty * 0.1  // Daily accumulation
                                    ),
                                }
                            };
                        }
                        break;
                    }

                    case 'assimilation': {
                        // [ENHANCED] 文化同化：同时降低独立上限和当前独立值
                        const currentCap = updated.independenceCap || 100;
                        const capReduction = measureConfig.independenceCapReduction || 0.05;
                        const newCap = Math.max(
                            measureConfig.minIndependenceCap || 30,
                            currentCap - capReduction
                        );
                        updated.independenceCap = newCap;

                        // [NEW] 同时主动降低当前独立值（每天-0.15%）
                        const directReduction = 0.15;
                        controlMeasureIndependenceReduction += directReduction;

                        // Small satisfaction penalty across all classes
                        if (measureConfig.satisfactionPenalty && updated.socialStructure) {
                            const penalty = measureConfig.satisfactionPenalty * 0.1;
                            if (updated.socialStructure.elites) {
                                updated.socialStructure.elites.satisfaction = Math.max(0,
                                    (updated.socialStructure.elites.satisfaction || 50) + penalty
                                );
                            }
                            if (updated.socialStructure.commoners) {
                                updated.socialStructure.commoners.satisfaction = Math.max(0,
                                    (updated.socialStructure.commoners.satisfaction || 50) + penalty
                                );
                            }
                        }
                        break;
                    }

                    case 'economicAid': {
                        // Economic aid improves satisfaction and transfers wealth
                        controlMeasureIndependenceReduction += measureConfig.independenceReduction || 0.1;

                        // Apply satisfaction bonuses
                        if (updated.socialStructure) {
                            if (measureConfig.commonerSatisfactionBonus && updated.socialStructure.commoners) {
                                updated.socialStructure = {
                                    ...updated.socialStructure,
                                    commoners: {
                                        ...updated.socialStructure.commoners,
                                        satisfaction: Math.min(100,
                                            (updated.socialStructure.commoners.satisfaction || 50) +
                                            measureConfig.commonerSatisfactionBonus * 0.1
                                        ),
                                    }
                                };
                            }
                            if (measureConfig.underclassSatisfactionBonus && updated.socialStructure.underclass) {
                                updated.socialStructure = {
                                    ...updated.socialStructure,
                                    underclass: {
                                        ...updated.socialStructure.underclass,
                                        satisfaction: Math.min(100,
                                            (updated.socialStructure.underclass.satisfaction || 50) +
                                            measureConfig.underclassSatisfactionBonus * 0.1
                                        ),
                                    }
                                };
                            }
                        }

                        // Transfer small amount of wealth to vassal
                        if (measureConfig.vassalWealthTransfer) {
                            const transfer = Math.floor(dailyCost * measureConfig.vassalWealthTransfer);
                            vassalWealthChange += transfer;
                        }
                        break;
                    }
                }
            });
        }

        // Apply wealth change from economic aid
        if (vassalWealthChange > 0) {
            updated.wealth = (updated.wealth || 0) + vassalWealthChange;
        }

        // ========== 2. 每日结算朝贡（按月值/30拆分） ==========
        const tribute = calculateEnhancedTribute(updated);
        const dailySilver = (tribute.silver || 0) / 30;
        if (dailySilver > 0) {
            tributeIncome += dailySilver;
            updated.wealth = Math.max(0, (updated.wealth || 0) - dailySilver);
        }

        // 资源朝贡仍按月结算，避免每日小额损耗
        if (daysElapsed > 0 && daysElapsed % 30 === 0) {
            if (Object.keys(tribute.resources).length > 0) {
                Object.entries(tribute.resources).forEach(([resourceKey, amount]) => {
                    if (updated.nationInventories && updated.nationInventories[resourceKey]) {
                        updated.nationInventories[resourceKey] = Math.max(
                            0,
                            updated.nationInventories[resourceKey] - amount
                        );
                    }
                    resourceTribute[resourceKey] = (resourceTribute[resourceKey] || 0) + amount;
                });

                const resourceList = Object.entries(tribute.resources)
                    .map(([k, v]) => `${k}:${v}`)
                    .join(', ');
                logs.push(`📦 ${updated.name} 朝贡资源: ${resourceList}`);
            }

            if (tribute.silver > 0) {
                logs.push(`📜 ${updated.name}（${vassalConfig.name}）本月朝贡 ${tribute.silver} 银币`);
            }
        }

        // ========== 3. 更新独立倾向（纯每日加减模型） ==========
        // 计算每日独立倾向变化量（基于政策和经济状况）
        const dailyChange = calculateDailyIndependenceChange(
            updated,
            epoch,
            controlMeasureIndependenceReduction,
            playerWealth,
            playerPopulation,
            difficultyLevel
        );
        
        // 应用独立倾向上限
        const independenceCap = updated.independenceCap || 100;
        const currentIndependence = updated.independencePressure || 0;
        
        // 纯粹的每日累加，不引入目标值机制
        // 独立倾向是一个百分比（0-100%），限制在 0 到 independenceCap 之间
        const newIndependence = Math.max(0, Math.min(independenceCap, currentIndependence + dailyChange));
        updated.independencePressure = newIndependence;
        
        // 存储每日变化量用于UI显示
        updated._lastIndependenceChange = dailyChange;

        // ========== 4. 检查独立战争触发 ==========
        // 只有当独立倾向达到上限时才触发独立战争
        // 移除了之前的概率触发机制（宗主战争、稳定度低、外国支持等）
        
        // 跳过已经在独立战争中的附庸，避免重复触发
        if (currentIndependence >= independenceCap && !updated.independenceWar) {
            updated.isAtWar = true;
            updated.warTarget = 'player';
            updated.independenceWar = true;
            // 立即解除附庸关系，进入独立战争状态
            updated.vassalOf = null;
            updated.vassalType = null;

            vassalEvents.push({
                type: 'independence_war',
                nationId: updated.id,
                nationName: updated.name,
            });

            logs.push(`⚠️ ${updated.name} 发动独立战争！`);
        }

        return updated;
    });

    // Log control warnings
    controlWarnings.forEach(warning => {
        logs.push(`⚠️ ${warning.message}`);
    });

    return {
        nations: updatedNations,
        tributeIncome,
        resourceTribute,
        totalControlCost,    // NEW: Return total control cost for deduction
        vassalEvents,
        controlWarnings,     // NEW: Return warnings for UI
    };
};

/**
 * 计算朝贡金额（重构版）
 * 基于附庸经济状况计算有意义的朝贡金额
 * @param {Object} vassalNation - 附庸国对象
 * @returns {Object} { silver: 金钱朝贡, resources: 资源朝贡 }
 */
export const calculateEnhancedTribute = (vassalNation) => {
    if (!vassalNation || vassalNation.vassalOf === null) {
        return { silver: 0, resources: {} };
    }

    const config = TRIBUTE_CONFIG;
    const tributeRate = vassalNation.tributeRate || 0;
    const vassalWealth = vassalNation.wealth || 500;

    // 计算基础朝贡金额
    // 公式: 基础值 + 附庸财富 * 比例
    // 完全移除玩家财富依赖，确保自洽性 (Updated per user request)
    const vassalBasedTribute = vassalWealth * config.vassalWealthRate;

    let baseTribute = config.baseAmount + vassalBasedTribute;

    // 应用朝贡率 (这是政策设定的比例，如10%)
    baseTribute *= tributeRate;

    // 附庸规模系数
    let sizeMultiplier = config.sizeMultipliers.small;
    if (vassalWealth > 3000) {
        sizeMultiplier = config.sizeMultipliers.large;
    } else if (vassalWealth > 1000) {
        sizeMultiplier = config.sizeMultipliers.medium;
    }
    baseTribute *= sizeMultiplier;

    // 独立倾向降低实际朝贡
    const independenceDesire = vassalNation.independencePressure || 0;
    const resistanceFactor = Math.max(0.3, 1 - (independenceDesire / 150));
    baseTribute *= resistanceFactor;

    // ========== NEW: 应用总督效率加成 ==========
    const governorTributeModifier = vassalNation._governorTributeModifier || 1.0;
    baseTribute *= governorTributeModifier;

    // 应用总督腐败损失
    const governorCorruptionRate = vassalNation._governorCorruptionRate || 0;
    const corruptionLoss = baseTribute * governorCorruptionRate;
    baseTribute -= corruptionLoss;

    // 计算资源朝贡
    const resources = {};
    if (config.resourceTribute.enabled && vassalNation.nationInventories) {
        config.resourceTribute.resources.forEach(resourceKey => {
            const inventory = vassalNation.nationInventories[resourceKey] || 0;
            if (inventory > 10) {
                // 基于库存和朝贡率计算资源朝贡
                const resourceAmount = Math.floor(
                    Math.min(
                        inventory * 0.1,  // 最多朝贡10%库存
                        config.resourceTribute.baseAmount * tributeRate * sizeMultiplier
                    ) * resistanceFactor
                );
                if (resourceAmount > 0) {
                    resources[resourceKey] = resourceAmount;
                }
            }
        });
    }

    return {
        silver: Math.floor(baseTribute),
        resources,
    };
};

/**
 * 计算每日独立倾向变化量（纯加减模型）
 * 
 * 设计理念：
 * - 独立倾向是一个百分比（0-100%），表示附庸国独立的意愿/可能性
 * - 所有政策调整只影响每日变化率，不会导致瞬间变化
 * - 变化来源分为两大类：
 *   1. 政策压力（控制政策带来的正/负压力）
 *   2. 经济民生（各阶层生活水平和满意度）
 * 
 * @param {Object} nation - 附庸国家对象
 * @param {number} epoch - 当前时代
 * @param {number} controlReduction - 控制措施带来的每日减少量
 * @param {number} suzereainWealth - 宗主国财富（用于计算经济比值影响）
 * @param {number} suzereainPopulation - 宗主国人口（用于计算人均财富比值影响）
 * @param {string} difficultyLevel - 游戏难度级别
 * @returns {number} 每日独立倾向变化量（百分点/天）
 */
const calculateDailyIndependenceChange = (nation, epoch, controlReduction = 0, suzereainWealth = 10000, suzereainPopulation = 1000000, difficultyLevel = 'normal') => {
    const cfg = INDEPENDENCE_CHANGE_CONFIG;
    const vassalPolicy = nation?.vassalPolicy || {};
    
    // 获取难度系数
    const difficultyMultiplier = getVassalIndependenceMultiplier(difficultyLevel);
    
    // ========== 1. 基础自然增长（模拟民族意识觉醒） ==========
    const eraMultiplier = 1 + Math.max(0, (epoch || 1) - 1) * cfg.eraMultiplierStep;
    let dailyChange = cfg.baseGrowthRate * eraMultiplier;
    
    // ========== 2. 控制政策影响（每日变化） ==========
    // 2.1 劳工政策
    const laborPolicy = vassalPolicy.labor || 'standard';
    dailyChange += cfg.policies.labor[laborPolicy]?.effect || 0;
    
    // 2.2 贸易政策
    const tradePolicy = vassalPolicy.tradePolicy || 'preferential';
    dailyChange += cfg.policies.trade[tradePolicy]?.effect || 0;
    
    // 2.3 治理政策
    const governancePolicy = vassalPolicy.governance || 'autonomous';
    dailyChange += cfg.policies.governance[governancePolicy]?.effect || 0;
    
    // 2.4 军事政策
    const militaryPolicy = vassalPolicy.military || 'call_to_arms';
    dailyChange += cfg.policies.military[militaryPolicy]?.effect || 0;
    
    // 2.5 投资政策
    const investmentPolicy = vassalPolicy.investmentPolicy || 'autonomous';
    dailyChange += cfg.policies.investment[investmentPolicy]?.effect || 0;
    
    // ========== 3. 经济状况和阶层满意度影响 ==========
    if (nation?.socialStructure) {
        const { elites, commoners, underclass } = nation.socialStructure;
        
        const eliteSat = elites?.satisfaction ?? cfg.satisfaction.baseLine;
        const commonerSat = commoners?.satisfaction ?? cfg.satisfaction.baseLine;
        const underclassSat = underclass?.satisfaction ?? cfg.satisfaction.baseLine;
        
        const eliteInfluence = elites?.influence ?? 0.4;
        const commonerInfluence = commoners?.influence ?? 0.35;
        const underclassInfluence = underclass?.influence ?? 0.25;
        const totalInfluence = eliteInfluence + commonerInfluence + underclassInfluence;
        
        if (totalInfluence > 0) {
            const eliteEffect = ((cfg.satisfaction.baseLine - eliteSat) / cfg.satisfaction.divisor) * (eliteInfluence / totalInfluence);
            const commonerEffect = ((cfg.satisfaction.baseLine - commonerSat) / cfg.satisfaction.divisor) * (commonerInfluence / totalInfluence);
            const underclassEffect = ((cfg.satisfaction.baseLine - underclassSat) / cfg.satisfaction.divisor) * (underclassInfluence / totalInfluence);
            
            dailyChange += (eliteEffect + commonerEffect + underclassEffect);
        }
    }
    
    // ========== 4. 经济繁荣度影响（基于财富比值和人均财富比值） ==========
    const vassalWealth = nation?.wealth || 500;
    const vassalPopulation = nation?.population || 10000;
    const effectiveSuzereainWealth = Math.max(1000, suzereainWealth || 10000);
    const effectiveSuzereainPopulation = Math.max(10000, suzereainPopulation || 1000000);
    
    // 4.1 总财富比值（国力对比）
    const wealthRatio = vassalWealth / effectiveSuzereainWealth;
    const totalWealthEffect = Math.log(Math.max(0.01, wealthRatio)) * cfg.economy.totalWealthFactor;
    
    // 4.2 人均财富比值（民众生活水平对比）
    const vassalPerCapita = vassalWealth / Math.max(1, vassalPopulation);
    const suzereainPerCapita = effectiveSuzereainWealth / Math.max(1, effectiveSuzereainPopulation);
    const perCapitaRatio = vassalPerCapita / Math.max(0.0001, suzereainPerCapita);
    const perCapitaEffect = Math.log(Math.max(0.01, perCapitaRatio)) * cfg.economy.perCapitaFactor;
    
    // 4.3 综合经济繁荣度影响
    dailyChange += totalWealthEffect + perCapitaEffect;
    
    // ========== 5. 朝贡负担影响 ==========
    const tributeRate = nation?.tributeRate || 0;
    dailyChange += tributeRate * cfg.tribute.multiplier;
    
    // ========== 6. 扣除控制措施效果 ==========
    dailyChange -= controlReduction;
    
    // ========== 7. 应用难度系数 ==========
    // 只对正向增长应用难度系数，负向（控制措施效果）不受难度影响
    // 这样在高难度下附庸更难控制，但控制手段的效果不会被削弱
    if (dailyChange > 0) {
        dailyChange *= difficultyMultiplier;
    }
    
    return dailyChange;
};

/**
 * 兼容旧接口：获取独立倾向增长率
 * @deprecated 请使用 calculateDailyIndependenceChange
 */
const getEnhancedIndependenceGrowthRate = (nation, epoch) => {
    return calculateDailyIndependenceChange(nation, epoch, 0);
};

/**
 * 获取独立度变化的详细分解（用于UI显示）
 * 纯每日加减模型，显示当前值和所有影响因素
 * @param {Object} nation - 附庸国对象
 * @param {number} epoch - 当前时代
 * @param {Array} officials - 官员列表（用于计算总督效果）
 * @param {number} suzereainWealth - 宗主国财富
 * @param {number} suzereainPopulation - 宗主国人口
 * @param {string} difficultyLevel - 游戏难度等级
 * @returns {Object} 独立度变化的详细分解
 */
export const getIndependenceChangeBreakdown = (nation, epoch = 1, officials = [], suzereainWealth = 10000, suzereainPopulation = 1000000, difficultyLevel = 'normal') => {
    const config = INDEPENDENCE_CONFIG;
    const cfg = INDEPENDENCE_CHANGE_CONFIG;
    const vassalPolicy = nation?.vassalPolicy || {};
    
    // 获取难度系数
    const difficultyMultiplier = getVassalIndependenceMultiplier(difficultyLevel);
    
    const increaseFactors = [];  // 增加独立倾向的因素
    const decreaseFactors = [];  // 降低独立倾向的因素
    
    // ========== 辅助函数：添加政策影响因素 ==========
    const addPolicyFactor = (policyType, policyKey, defaultPolicy, categoryName) => {
        const policy = vassalPolicy[policyKey] || defaultPolicy;
        const policyConfig = cfg.policies[policyType][policy];
        if (!policyConfig) return;
        
        const effect = policyConfig.effect;
        if (effect > 0) {
            increaseFactors.push({
                name: categoryName,
                value: effect,
                description: policyConfig.name,
                effect: 'increase',
            });
        } else if (effect < 0) {
            decreaseFactors.push({
                name: categoryName,
                value: Math.abs(effect),
                description: policyConfig.name,
                effect: 'decrease',
            });
        }
    };
    
    // ========== 1. 基础自然增长 ==========
    const eraMultiplier = 1 + Math.max(0, (epoch || 1) - 1) * cfg.eraMultiplierStep;
    const baseGrowth = cfg.baseGrowthRate * eraMultiplier;
    increaseFactors.push({
        name: '民族意识觉醒',
        value: baseGrowth,
        description: `基础+时代${epoch}加成`,
        effect: 'increase',
    });
    
    // ========== 2. 控制政策影响（使用共享配置） ==========
    addPolicyFactor('labor', 'labor', 'standard', '劳工政策');
    addPolicyFactor('trade', 'tradePolicy', 'preferential', '贸易政策');
    addPolicyFactor('governance', 'governance', 'autonomous', '治理政策');
    addPolicyFactor('military', 'military', 'call_to_arms', '军事政策');
    addPolicyFactor('investment', 'investmentPolicy', 'autonomous', '投资政策');
    
    // ========== 3. 阶层满意度影响 ==========
    let satisfactionEffect = 0;
    let avgSatisfaction = cfg.satisfaction.baseLine;
    if (nation?.socialStructure) {
        const { elites, commoners, underclass } = nation.socialStructure;
        const eliteSat = elites?.satisfaction ?? cfg.satisfaction.baseLine;
        const commonerSat = commoners?.satisfaction ?? cfg.satisfaction.baseLine;
        const underclassSat = underclass?.satisfaction ?? cfg.satisfaction.baseLine;
        
        avgSatisfaction = calculateAverageSatisfaction(nation.socialStructure);
        
        const eliteInfluence = elites?.influence ?? 0.4;
        const commonerInfluence = commoners?.influence ?? 0.35;
        const underclassInfluence = underclass?.influence ?? 0.25;
        const totalInfluence = eliteInfluence + commonerInfluence + underclassInfluence;
        
        if (totalInfluence > 0) {
            const eliteEffect = ((cfg.satisfaction.baseLine - eliteSat) / cfg.satisfaction.divisor) * (eliteInfluence / totalInfluence);
            const commonerEffect = ((cfg.satisfaction.baseLine - commonerSat) / cfg.satisfaction.divisor) * (commonerInfluence / totalInfluence);
            const underclassEffect = ((cfg.satisfaction.baseLine - underclassSat) / cfg.satisfaction.divisor) * (underclassInfluence / totalInfluence);
            satisfactionEffect = eliteEffect + commonerEffect + underclassEffect;
        }
    }
    
    if (satisfactionEffect > 0) {
        increaseFactors.push({
            name: '民众不满',
            value: satisfactionEffect,
            description: `平均满意度${Math.round(avgSatisfaction)}%`,
            effect: 'increase',
        });
    } else if (satisfactionEffect < 0) {
        decreaseFactors.push({
            name: '民众满意',
            value: Math.abs(satisfactionEffect),
            description: `平均满意度${Math.round(avgSatisfaction)}%`,
            effect: 'decrease',
        });
    }
    
    // ========== 4. 经济繁荣度影响（基于财富比值和人均财富比值） ==========
    const vassalWealth = nation?.wealth || 500;
    const vassalPopulation = nation?.population || 10000;
    const effectiveSuzereainWealth = Math.max(1000, suzereainWealth || 10000);
    const effectiveSuzereainPopulation = Math.max(10000, suzereainPopulation || 1000000);
    
    // 4.1 总财富比值（国力对比）
    const wealthRatio = vassalWealth / effectiveSuzereainWealth;
    const totalWealthEffect = Math.log(Math.max(0.01, wealthRatio)) * cfg.economy.totalWealthFactor;
    
    // 4.2 人均财富比值（民众生活水平对比）
    const vassalPerCapita = vassalWealth / Math.max(1, vassalPopulation);
    const suzereainPerCapita = effectiveSuzereainWealth / Math.max(1, effectiveSuzereainPopulation);
    const perCapitaRatio = vassalPerCapita / Math.max(0.0001, suzereainPerCapita);
    const perCapitaEffect = Math.log(Math.max(0.01, perCapitaRatio)) * cfg.economy.perCapitaFactor;
    
    // 综合经济繁荣度影响
    const economicProsperityEffect = totalWealthEffect + perCapitaEffect;
    if (economicProsperityEffect > 0) {
        increaseFactors.push({
            name: '经济繁荣',
            value: economicProsperityEffect,
            description: `财富比${wealthRatio.toFixed(2)}，人均比${perCapitaRatio.toFixed(2)}`,
            effect: 'increase',
        });
    } else if (economicProsperityEffect < 0) {
        decreaseFactors.push({
            name: '经济落后',
            value: Math.abs(economicProsperityEffect),
            description: `财富比${wealthRatio.toFixed(2)}，人均比${perCapitaRatio.toFixed(2)}`,
            effect: 'decrease',
        });
    }
    
    // ========== 5. 朝贡负担影响 ==========
    const tributeRate = nation?.tributeRate || 0;
    const tributeEffect = tributeRate * cfg.tribute.multiplier;
    if (tributeEffect > 0) {
        increaseFactors.push({
            name: '朝贡负担',
            value: tributeEffect,
            description: `朝贡率${Math.round(tributeRate * 100)}%`,
            effect: 'increase',
        });
    }
    
    // ========== 6. 控制措施减少 ==========
    const controlMeasures = vassalPolicy.controlMeasures || {};
    
    // 6.1 派遣总督
    const governorData = controlMeasures.governor;
    if (governorData && (governorData === true || governorData.active)) {
        const officialId = governorData.officialId;
        const official = officials.find(o => o.id === officialId);
        
        if (official) {
            const govEffects = calculateGovernorFullEffects(official, nation);
            const reduction = govEffects.independenceReduction || 0.02;
            decreaseFactors.push({
                name: '派遣总督',
                value: reduction,
                description: `${official.name}（威望${official.prestige || 50}）`,
                effect: 'decrease',
            });
        } else {
            const baseReduction = config.controlMeasures?.governor?.independenceReduction || 0.02;
            decreaseFactors.push({
                name: '派遣总督',
                value: baseReduction,
                description: '基础效果（需指派官员）',
                effect: 'decrease',
            });
        }
    }
    
    // 6.2 驻军占领
    const garrisonData = controlMeasures.garrison;
    if (garrisonData && (garrisonData === true || garrisonData.active)) {
        const garrisonReduction = config.controlMeasures?.garrison?.independenceReduction || 0.05;
        decreaseFactors.push({
            name: '驻军占领',
            value: garrisonReduction,
            description: '军事镇压',
            effect: 'decrease',
        });
    }
    
    // 6.3 经济扶持
    const economicAidData = controlMeasures.economicAid;
    if (economicAidData && (economicAidData === true || economicAidData.active)) {
        const aidReduction = config.controlMeasures?.economicAid?.independenceReduction || 0.01;
        if (aidReduction > 0) {
            decreaseFactors.push({
                name: '经济扶持',
                value: aidReduction,
                description: '改善民生',
                effect: 'decrease',
            });
        }
    }
    
    // 6.4 文化同化
    const assimilationData = controlMeasures.assimilation;
    if (assimilationData && (assimilationData === true || assimilationData.active)) {
        const directReduction = config.controlMeasures?.assimilation?.independenceReduction || 0.015;
        decreaseFactors.push({
            name: '文化同化',
            value: directReduction,
            description: '降低独立意识',
            effect: 'decrease',
        });
    }
    
    // ========== 计算最终每日变化 ==========
    const totalIncrease = increaseFactors.reduce((sum, f) => sum + f.value, 0);
    const totalDecrease = decreaseFactors.reduce((sum, f) => sum + f.value, 0);
    
    // 应用难度系数（只对增长因素应用，与实际游戏逻辑保持一致）
    // 在高难度下，独立倾向增长更快，但控制措施效果不变
    const adjustedIncrease = totalIncrease * difficultyMultiplier;
    const dailyChange = adjustedIncrease - totalDecrease;
    
    const currentIndependence = nation?.independencePressure || 0;
    const independenceCap = nation?.independenceCap || 100;
    
    return {
        // 当前状态（独立倾向是百分比）
        current: currentIndependence,
        cap: independenceCap,
        
        // 每日变化（百分点/天）- 已应用难度系数
        dailyChange: dailyChange,
        
        // 难度信息
        difficultyMultiplier: difficultyMultiplier,
        difficultyLevel: difficultyLevel,
        
        // 增减因素分解（原始值，未应用难度系数）
        totalIncrease: totalIncrease,
        totalDecrease: totalDecrease,
        // 调整后的增长（应用难度系数后）
        adjustedIncrease: adjustedIncrease,
        increaseFactors: increaseFactors,
        decreaseFactors: decreaseFactors,
        
        // 预测（按当前趋势）
        daysToMax: dailyChange > 0 ? Math.ceil((independenceCap - currentIndependence) / dailyChange) : null,
        daysToZero: dailyChange < 0 ? Math.ceil(currentIndependence / Math.abs(dailyChange)) : null,
        
        // 兼容旧UI
        growthFactors: increaseFactors,
        reductionFactors: decreaseFactors,
        netChange: dailyChange,
        growthRate: totalIncrease,
        totalReduction: totalDecrease,
        factors: increaseFactors,
        reductions: decreaseFactors,
    };
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
    const independenceCap = vassalNation.independenceCap || 100;

    // 独立倾向达到上限时必定触发
    if ((vassalNation.independencePressure || 0) >= independenceCap) {
        return true;
    }

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

    // 获取该类型的政策预设
    const preset = VASSAL_POLICY_PRESETS[vassalType];

    return {
        ...nation,
        vassalOf: 'player',
        vassalType,

        // 核心参数初始化
        tributeRate: config.tributeRate,
        independencePressure: 0,
        independenceCap: 100,

        // 初始化社会结构（如果不存在）
        socialStructure: nation.socialStructure || getSocialStructureTemplate(nation.governmentType || 'monarchy'),

        // 初始化详细政策 (基于预设)
        vassalPolicy: {
            labor: preset?.labor || 'standard',
            tradePolicy: preset?.trade || 'preferential',
            governance: preset?.governance || 'autonomous',
            investmentPolicy: 'autonomous', // [NEW] 默认自主投资
            controlMeasures: {},
        },

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
        tributeRate: 0,
        independencePressure: 0,
        independenceCap: 100,  // Reset independence cap
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
    // [FIX] 移除 vassalOf 检查，因为调用方（useGameActions）已经做了检查
    // 避免因状态更新时序问题导致的错误
    
    const updated = { ...nation };
    const config = VASSAL_TYPE_CONFIGS[updated.vassalType];

    // 初始化附庸政策对象（如果不存在）
    if (!updated.vassalPolicy) {
        updated.vassalPolicy = {
            diplomaticControl: 'guided',
            tradePolicy: 'preferential',
            controlMeasures: {},  // NEW: Object format for control measures
        };
    }

    // 调整外交控制政策
    if (policyChanges.diplomaticControl) {
        const validOptions = ['autonomous', 'guided', 'puppet'];
        if (validOptions.includes(policyChanges.diplomaticControl)) {
            updated.vassalPolicy.diplomaticControl = policyChanges.diplomaticControl;
            // 外交控制政策不再立即影响独立倾向，而是通过每日增长率影响
        }
    }

    // 调整贸易政策
    if (policyChanges.tradePolicy) {
        const validOptions = ['free', 'preferential', 'monopoly', 'exclusive', 'dumping', 'looting'];
        if (validOptions.includes(policyChanges.tradePolicy)) {
            updated.vassalPolicy.tradePolicy = policyChanges.tradePolicy;
            // 贸易政策不再立即影响独立倾向，而是通过每日增长率影响
        }
    }

    // ========== NEW: 调整劳工政策 ==========
    if (policyChanges.labor) {
        const validOptions = ['standard', 'exploitation', 'slavery'];
        if (validOptions.includes(policyChanges.labor)) {
            updated.vassalPolicy.labor = policyChanges.labor;
            // 劳工政策不再立即影响独立倾向，而是通过每日增长率影响
        }
    }

    // ========== NEW: 调整治理政策 ==========
    if (policyChanges.governance) {
        const validOptions = ['autonomous', 'puppet_govt', 'direct_rule'];
        if (validOptions.includes(policyChanges.governance)) {
            updated.vassalPolicy.governance = policyChanges.governance;
            // 治理政策不再立即影响独立倾向，而是通过每日增长率影响
        }
    }

    // ========== NEW: 调整军事政策 ==========
    if (policyChanges.military) {
        const validOptions = ['autonomous', 'call_to_arms', 'auto_join'];
        if (validOptions.includes(policyChanges.military)) {
            updated.vassalPolicy.military = policyChanges.military;
            // 军事政策不再立即影响独立倾向，而是通过每日增长率影响
        }
    }

    // ========== NEW: 调整投资政策 ==========
    if (policyChanges.investmentPolicy) {
        const validOptions = ['autonomous', 'guided', 'forced'];
        if (validOptions.includes(policyChanges.investmentPolicy)) {
            updated.vassalPolicy.investmentPolicy = policyChanges.investmentPolicy;
            // 投资政策不再立即影响独立倾向，而是通过每日增长率影响
        }
    }

    // 调整朝贡率
    if (typeof policyChanges.tributeRate === 'number') {
        const baseTributeRate = config?.tributeRate || 0.1;
        // 允许在基础值的50%-150%范围内调整
        updated.tributeRate = Math.min(baseTributeRate * 1.5,
            Math.max(baseTributeRate * 0.5, policyChanges.tributeRate));
        // 朝贡率不再立即影响独立倾向，而是通过阶层满意度间接影响
    }

    // NEW: Update control measures with new object format
    if (policyChanges.controlMeasures) {
        updated.vassalPolicy.controlMeasures = {
            ...updated.vassalPolicy.controlMeasures,
            ...policyChanges.controlMeasures,
        };
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
 * @param {number} playerWealth - 玩家财富（可选）
 * @returns {Object} 收益汇总
 */
export const calculateVassalBenefits = (nations, playerWealth = 10000) => {
    const vassals = getPlayerVassals(nations);

    let totalTribute = 0;
    let totalTradeBonus = 0;
    let totalResourceTribute = {};
    let totalControlCost = 0;  // NEW: Calculate total control costs

    vassals.forEach(vassal => {
        const tribute = calculateEnhancedTribute(vassal);
        totalTribute += tribute.silver;

        // 汇总资源朝贡
        Object.entries(tribute.resources).forEach(([res, amount]) => {
            totalResourceTribute[res] = (totalResourceTribute[res] || 0) + amount;
        });

        // 贸易加成基于贸易政策
        const tradePolicyId = vassal.vassalPolicy?.tradePolicy || 'preferential';
        const tradeConfig = TRADE_POLICY_DEFINITIONS[tradePolicyId];
        if (tradeConfig) {
            totalTradeBonus += (tradeConfig.tariffDiscount || 0);
        } else {
            // Fallback to type config if policy missing (legacy safety)
            const config = VASSAL_TYPE_CONFIGS[vassal.vassalType];
            if (config) totalTradeBonus += config.tariffDiscount;
        }

        // Calculate control measure costs
        if (vassal.vassalPolicy?.controlMeasures) {
            const vassalWealth = vassal.wealth || 500;
            Object.entries(vassal.vassalPolicy.controlMeasures).forEach(([measureId, measureData]) => {
                const isActive = measureData === true || (measureData && measureData.active !== false);
                if (isActive) {
                    totalControlCost += calculateControlMeasureCost(measureId, vassalWealth);
                }
            });
        }
    });

    return {
        vassalCount: vassals.length,
        monthlyTribute: totalTribute,
        monthlyResourceTribute: totalResourceTribute,
        tradeBonus: totalTradeBonus / Math.max(1, vassals.length),
        dailyControlCost: totalControlCost,  // NEW: Include daily control cost
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
        // 统一附庸化要求战争分数 50
        const requiredScore = 300;
        if ((warScore || 0) < requiredScore) {
            return { canEstablish: false, reason: `战争分数不足（需要 ${requiredScore}）` };
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

/**
 * Check if a vassal can perform diplomatic action based on restrictions
 * 基于政策（policy）而非类型（type）的判断
 * @param {Object} nation - Vassal nation
 * @param {string} actionType - Type of diplomatic action ('alliance', 'treaty', 'trade')
 * @returns {Object} { allowed, reason }
 */
export const canVassalPerformDiplomacy = (nation, actionType) => {
    if (nation.vassalOf !== 'player') {
        return { allowed: true, reason: null };
    }

    const diplomaticControl = nation.vassalPolicy?.diplomaticControl || 'guided';
    const tradePolicy = nation.vassalPolicy?.tradePolicy || 'preferential';

    switch (actionType) {
        case 'alliance':
            // 只有"自治"的外交政策允许结盟
            if (diplomaticControl !== 'autonomous') {
                return {
                    allowed: false,
                    reason: '当前外交政策禁止独立结盟'
                };
            }
            break;

        case 'treaty':
            // "自治"或"引导"允许签条约，"傀儡"禁止
            if (diplomaticControl === 'puppet') {
                return {
                    allowed: false,
                    reason: '傀儡外交政策禁止独立签署条约'
                };
            }
            break;

        case 'trade':
            // 垄断、排他、掠夺政策禁止独立贸易
            const restrictiveTradePolicies = ['monopoly', 'exclusive', 'looting'];
            if (restrictiveTradePolicies.includes(tradePolicy)) {
                return {
                    allowed: false,
                    reason: '当前贸易政策禁止独立贸易'
                };
            }
            break;
    }

    return { allowed: true, reason: null };
};

/**
 * 是否需要宗主审批附庸外交行动
 * @param {Object} nation - 附庸国对象
 * @returns {boolean}
 */
export const requiresVassalDiplomacyApproval = (nation) => {
    if (!nation || nation.vassalOf !== 'player') return false;
    // [FIX] Annexed vassals don't need approval - they shouldn't act at all
    if (nation.isAnnexed) return false;
    const control = nation.vassalPolicy?.diplomaticControl || 'guided';
    return control === 'guided' || control === 'puppet';
};

/**
 * 构造附庸外交请求对象（用于审批队列）
 * @param {Object} params
 * @returns {Object}
 */
export const buildVassalDiplomacyRequest = ({
    vassal,
    target,
    actionType,
    payload = {},
    tick = 0,
    source = 'ai',
}) => ({
    vassalId: vassal?.id || null,
    vassalName: vassal?.name || '附庸国',
    targetId: target?.id || null,
    targetName: target?.name || '未知国家',
    actionType,
    payload,
    requestedDay: tick,
    source,
});

/**
 * Validate and clean up governor assignments
 * @param {Array} nations - All nations
 * @param {Array} officials - Player officials
 * @returns {Object} { nations, removedGovernors }
 */
export const validateGovernorAssignments = (nations, officials) => {
    const officialIds = new Set(officials.map(o => o.id));
    const removedGovernors = [];

    const updatedNations = nations.map(nation => {
        if (nation.vassalOf !== 'player') return nation;

        const governorMeasure = nation.vassalPolicy?.controlMeasures?.governor;
        if (!governorMeasure) return nation;

        const officialId = governorMeasure.officialId;
        if (officialId && !officialIds.has(officialId)) {
            // Official no longer exists, remove governor assignment
            removedGovernors.push({
                nationId: nation.id,
                nationName: nation.name,
                officialId,
            });

            return {
                ...nation,
                vassalPolicy: {
                    ...nation.vassalPolicy,
                    controlMeasures: {
                        ...nation.vassalPolicy.controlMeasures,
                        governor: {
                            ...governorMeasure,
                            officialId: null,
                            active: false,
                        },
                    },
                },
            };
        }

        return nation;
    });

    return { nations: updatedNations, removedGovernors };
};

/**
 * 请求附庸国派遣远征军 (Expeditionary Force)
 * 仅适用于 tributary (朝贡国) 或更高义务
 * @param {Object} vassal - 附庸国
 * @returns {Object} - { success, units, message }
 */
export const requestExpeditionaryForce = (vassal) => {
    const config = VASSAL_TYPE_CONFIGS[vassal.vassalType];
    const obligation = config?.militaryObligation;

    if (obligation !== 'expeditionary' && obligation !== 'auto_join') {
        return { success: false, message: '该附庸国没有派遣远征军的义务' };
    }

    if ((vassal.manpower || 0) < 1000) {
        return { success: false, message: '附庸国人力不足' };
    }

    // Calculate force size (e.g., 10% of military strength equivalent)
    // Simply transfer raw manpower for now, or generate units
    // Let's transfer Manpower to Player as "Volunteers"
    const forceSize = Math.floor((vassal.manpower || 0) * 0.1);

    // Deduct from vassal
    vassal.manpower -= forceSize;

    return {
        success: true,
        manpower: forceSize,
        message: `${vassal.name} 派遣了 ${forceSize} 名志愿军支援前线。`
    };
};

/**
 * 请求附庸国参战 (Call to Arms)/**
 * Request vassal to participate in player's war
 * @param {Object} vassal - Vassal nation object
 * @param {Object} targetEnemy - Target enemy (optional, currently unused)
 * @param {number} playerWealth - 玩家当前资金
 * @returns {Object} - { success, cost, message }
 */
export const requestWarParticipation = (vassal, targetEnemy, playerWealth) => {
    // ✅ 从附庸政策中读取军事政策
    const militaryPolicyId = vassal.vassalPolicy?.military || 'call_to_arms';
    const militaryConfig = MILITARY_POLICY_DEFINITIONS[militaryPolicyId];

    // ✅ 检查是否允许征召
    if (!militaryConfig?.canCallToArms) {
        return {
            success: false,
            message: `当前军事政策(${militaryConfig?.name || militaryPolicyId})不允许战争征召`
        };
    }

    // ✅ 如果是自动参战，提醒玩家
    if (militaryConfig.autoJoinWar) {
        return {
            success: false,
            message: '该附庸国会自动参战，无需手动征召'
        };
    }

    // Calculate cost
    // Base cost 500 + 10% of Vassal Wealth
    const cost = 500 + Math.floor((vassal.wealth || 0) * 0.1);

    if (playerWealth < cost) {
        return { success: false, message: `资金不足，需要 ${cost} 银币` };
    }

    // Check willingness (Relations)
    if ((vassal.relation || 50) < 40) {
        return { success: false, message: '关系过低，拒绝参战' };
    }

    return {
        success: true,
        cost,
        message: `${vassal.name} 同意参战，花费 ${cost} 银币。`
    };
};
