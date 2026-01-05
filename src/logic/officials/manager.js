/**
 * 官员系统核心逻辑
 * 处理选拔、雇佣、解雇及相关计算
 */
import { generateRandomOfficial, LOYALTY_CONFIG } from '../../config/officials';
import { BUILDINGS } from '../../config/buildings';
import { isStanceSatisfied } from '../../config/politicalStances';
import { FINANCIAL_STATUS, generateInvestmentProfile } from './officialInvestment';
import {
    calculateCabinetSynergy,
    getCabinetDominance,
    getCabinetEffects,
    getActiveDecreeEffects,
} from './cabinetSynergy';

// 选拔冷却时间 (半年 = 180天)
export const OFFICIAL_SELECTION_COOLDOWN = 180;


/**
 * 触发新一轮选拔
 * @param {number} epoch - 当前时代
 * @param {Object} popStructure - 当前人口结构 { stratumKey: population }
 * @param {Object} classInfluence - 当前影响力占比 { stratumKey: influencePercent }
 * @param {Object} market - 当前市场数据（包含 prices 等信息）
 * @param {Object} rates - 当前资源速率（用于估算规模）
 * @returns {Array} 新生成的候选人列表
 */
export const triggerSelection = (epoch, popStructure = {}, classInfluence = {}, market = null, rates = null) => {
    const candidates = [];
    // 固定生成5名候选人
    for (let i = 0; i < 5; i++) {
        candidates.push(generateRandomOfficial(epoch, popStructure, classInfluence, market, rates));
    }
    return candidates;
};

/**
 * 雇佣官员
 * @param {string} officialId - 候选人ID
 * @param {Array} currentCandidates - 当前候选人列表
 * @param {Array} currentOfficials - 当前在任官员列表
 * @param {number} capacity - 官员容量上限
 * @param {number} currentDay - 当前游戏天数
 * @returns {Object} { success: boolean, newOfficials: Array, newCandidates: Array, error: string }
 */
export const hireOfficial = (officialId, currentCandidates, currentOfficials, capacity, currentDay) => {
    if (currentOfficials.length >= capacity) {
        return { success: false, error: "官员名额已满" };
    }

    const candidateIndex = currentCandidates.findIndex(c => c.id === officialId);
    if (candidateIndex === -1) {
        return { success: false, error: "未找到该候选人" };
    }

    const candidate = currentCandidates[candidateIndex];

    // 从候选列表移除
    const newCandidates = [...currentCandidates];
    newCandidates.splice(candidateIndex, 1);

    // 添加到在任列表，并记录入职时间和初始财富
    const OFFICIAL_STARTING_WEALTH = 400;

    // 计算初始忠诚度：基础随机值 + 薪水加成 + 低影响力加成
    const baseLoyalty = LOYALTY_CONFIG.INITIAL_MIN +
        Math.random() * (LOYALTY_CONFIG.INITIAL_MAX - LOYALTY_CONFIG.INITIAL_MIN);
    // 薪水越高越忠诚（最多+10）
    const salaryBonus = Math.min(10, (candidate.salary || 0) / 5);
    // 注：阶层影响力加成需在实际游戏状态中计算，这里先用基础值
    const initialLoyalty = Math.min(LOYALTY_CONFIG.MAX, Math.round(baseLoyalty + salaryBonus));

    const newOfficial = {
        ...candidate,
        hireDate: currentDay,
        wealth: OFFICIAL_STARTING_WEALTH,  // 官员个人存款
        lastDayExpense: 0,                  // 上日支出（用于显示）
        financialSatisfaction: 'satisfied',
        baseSalary: candidate.salary,
        investmentProfile: generateInvestmentProfile(candidate.sourceStratum, candidate.politicalStance, currentDay),
        ownedProperties: [],
        lastDayPropertyIncome: 0,
        // 忠诚度系统
        loyalty: initialLoyalty,
        lowLoyaltyDays: 0,
    };
    const newOfficials = [...currentOfficials, newOfficial];

    return { success: true, newOfficials, newCandidates };
};

/**
 * 解雇官员
 * @param {string} officialId - 官员ID
 * @param {Array} currentOfficials - 当前在任官员列表
 * @returns {Array} 新的在任官员列表
 */
export const fireOfficial = (officialId, currentOfficials) => {
    return currentOfficials.filter(o => o.id !== officialId);
};

/**
 * 计算每日总俸禄
 * @param {Array} officials - 在任官员列表
 * @returns {number} 总日薪
 */
export const calculateTotalDailySalary = (officials) => {
    if (!officials || !Array.isArray(officials)) return 0;
    return officials.reduce((sum, off) => sum + (off.salary || 0), 0);
};

/**
 * 检查选拔是否冷却完毕
 * @param {number} lastDay - 上次选拔天数
 * @param {number} currentDay - 当前天数
 * @returns {boolean}
 */
export const isSelectionAvailable = (lastDay, currentDay) => {
    return (currentDay - lastDay) >= OFFICIAL_SELECTION_COOLDOWN;
};

// 时代对官员容量的加成
const EPOCH_OFFICIAL_BONUS = {
    0: 0,   // 石器时代：基础容量
    1: 3,   // 青铜时代：+3
    2: 6,   // 铁器时代：+6
    3: 9,   // 古典时代：+9
    4: 12,  // 中世纪：+12
    5: 15,  // 文艺复兴：+15
    6: 18,  // 工业时代：+18
    7: 21,  // 信息时代：+21
};

// 科技对官员容量的加成
const TECH_OFFICIAL_BONUS = {
    'early_administration': 2,  // 早期行政
    'bureaucracy': 3,           // 官僚制度
    'civil_service': 3,         // 文官制度
    'administrative_reform': 4, // 行政改革
    'centralization': 2,        // 中央集权
};

/**
 * 计算有效官员容量
 * @param {number} epoch - 当前时代
 * @param {Object} polityEffects - 当前政体效果
 * @param {Array} techsUnlocked - 已解锁科技列表
 * @returns {number} 有效官员容量
 */
export const calculateOfficialCapacity = (epoch = 0, polityEffects = {}, techsUnlocked = []) => {
    // 基础容量
    const baseCapacity = 2;

    // 时代加成
    const epochBonus = EPOCH_OFFICIAL_BONUS[epoch] || 0;

    // 政体加成
    const polityBonus = polityEffects.officialCapacity || 0;

    // 科技加成
    let techBonus = 0;
    techsUnlocked.forEach(techId => {
        if (TECH_OFFICIAL_BONUS[techId]) {
            techBonus += TECH_OFFICIAL_BONUS[techId];
        }
    });

    return Math.max(1, baseCapacity + epochBonus + polityBonus + techBonus);
};

/**
 * 聚合所有官员的效果
 * @param {Array} officials - 在任官员列表
 * @param {boolean} isPaid - 是否支付了全额薪水（否则效果减半）
 * @returns {Object} 聚合后的效果对象，格式兼容 applyEffects
 */
export const getAggregatedOfficialEffects = (officials, isPaid) => {
    const aggregated = {
        // 生产类
        buildings: {},
        buildingProductionMod: {},
        wartimeProduction: 0,

        // 经济类
        tradeBonus: 0,
        taxEfficiency: 0,
        buildingCostMod: 0,
        incomePercentBonus: 0,
        passiveGains: {},
        passivePercentGains: {},
        corruption: 0,

        // 需求/资源类
        decreeStratumDemandMod: {},
        decreeResourceDemandMod: {},
        resourceSupplyMod: {},
        resourceWaste: {},
        needsReduction: 0,

        // 生产成本修正（建筑原料消耗修正）
        productionInputCost: {}, // { buildingId: modifier } 正值=增加消耗, 负值=减少消耗

        // 人口/发展类
        extraMaxPop: 0,
        populationGrowth: 0,
        researchSpeed: 0,

        // 政治类
        approval: {},
        coalitionApproval: 0,
        legitimacyBonus: 0,
        organizationDecay: 0,
        factionConflict: 0,
        stability: 0,

        // 军事类
        militaryBonus: 0,
        militaryUpkeep: 0,

        // 外交类
        diplomaticBonus: 0,
        diplomaticCooldown: 0,
        diplomaticIncident: 0,
    };

    if (!officials || !Array.isArray(officials)) return aggregated;

    const multiplier = isPaid ? 1 : 0.5;

    const applySingleEffect = (eff, effectMultiplier = multiplier) => {
        if (!eff || !eff.type || typeof eff.value !== 'number') return;
        const val = eff.value * effectMultiplier;

        switch (eff.type) {
            // 生产类
            case 'buildings':
                if (eff.target) {
                    aggregated.buildings[eff.target] = (aggregated.buildings[eff.target] || 0) + val;
                }
                break;
            case 'buildingProductionMod':
            case 'categories':
                if (eff.target) {
                    aggregated.buildingProductionMod[eff.target] = (aggregated.buildingProductionMod[eff.target] || 0) + val;
                }
                break;
            case 'wartimeProduction':
                aggregated.wartimeProduction += val;
                break;

            // 经济类
            case 'tradeBonus':
                aggregated.tradeBonus += val;
                break;
            case 'taxEfficiency':
                aggregated.taxEfficiency += val;
                break;
            case 'buildingCostMod':
                aggregated.buildingCostMod += val;
                break;
            case 'incomePercent':
                aggregated.incomePercentBonus += val;
                break;
            case 'passive':
                if (eff.target) {
                    aggregated.passiveGains[eff.target] = (aggregated.passiveGains[eff.target] || 0) + val;
                }
                break;
            case 'passivePercent':
                if (eff.target) {
                    aggregated.passivePercentGains[eff.target] = (aggregated.passivePercentGains[eff.target] || 0) + val;
                }
                break;
            case 'corruption':
                aggregated.corruption += val;
                break;

            // 需求/资源类
            case 'stratumDemandMod':
                if (eff.target) {
                    aggregated.decreeStratumDemandMod[eff.target] = (aggregated.decreeStratumDemandMod[eff.target] || 0) + val;
                }
                break;
            case 'resourceDemandMod':
                if (eff.target) {
                    aggregated.decreeResourceDemandMod[eff.target] = (aggregated.decreeResourceDemandMod[eff.target] || 0) + val;
                }
                break;
            case 'resourceSupplyMod':
                if (eff.target) {
                    aggregated.resourceSupplyMod[eff.target] = (aggregated.resourceSupplyMod[eff.target] || 0) + val;
                }
                break;
            case 'resourceWaste':
                if (eff.target) {
                    aggregated.resourceWaste[eff.target] = (aggregated.resourceWaste[eff.target] || 0) + val;
                }
                break;
            case 'needsReduction':
                aggregated.needsReduction += val;
                break;

            // 人口/发展类
            case 'maxPop':
                aggregated.extraMaxPop += val;
                break;
            case 'populationGrowth':
                aggregated.populationGrowth += val;
                break;
            case 'researchSpeed':
                aggregated.researchSpeed += val;
                break;

            // 政治类
            case 'approval':
                if (eff.target) {
                    aggregated.approval[eff.target] = (aggregated.approval[eff.target] || 0) + val;
                }
                break;
            case 'coalitionApproval':
                aggregated.coalitionApproval += val;
                break;
            case 'legitimacyBonus':
                aggregated.legitimacyBonus += val;
                break;
            case 'organizationDecay':
                aggregated.organizationDecay += val;
                break;
            case 'factionConflict':
                aggregated.factionConflict += val;
                break;
            case 'stability':
                aggregated.stability += val;
                break;

            // 军事类
            case 'militaryBonus':
                aggregated.militaryBonus += val;
                break;
            case 'militaryUpkeep':
                aggregated.militaryUpkeep += val;
                break;

            // 外交类
            case 'diplomaticBonus':
                aggregated.diplomaticBonus += val;
                break;
            case 'diplomaticCooldown':
                aggregated.diplomaticCooldown += val;
                break;
            case 'diplomaticIncident':
                aggregated.diplomaticIncident += val;
                break;

            // 生产成本修正
            case 'productionInputCost':
                if (eff.target) {
                    aggregated.productionInputCost[eff.target] = (aggregated.productionInputCost[eff.target] || 0) + val;
                }
                break;

            default:
                break;
        }
    };



    officials.forEach(official => {
        // 跳过无效的 official 条目
        if (!official || typeof official !== 'object') return;
        const financialPenalty = FINANCIAL_STATUS[official.financialSatisfaction] || FINANCIAL_STATUS.satisfied;
        const effectiveMultiplier = multiplier * (financialPenalty.effectMult || 1);

        if (financialPenalty.corruption) {
            aggregated.corruption += financialPenalty.corruption * multiplier;
        }

        // Handle effects - effects 是对象格式 {type: value} 或 {type: {target: value}}
        if (official.effects && typeof official.effects === 'object') {
            Object.entries(official.effects).forEach(([type, valueOrObj]) => {
                if (typeof valueOrObj === 'object' && valueOrObj !== null) {
                    // 嵌套对象：例如 { buildings: { farm: 0.1 } }
                    Object.entries(valueOrObj).forEach(([target, value]) => {
                        applySingleEffect({ type, target, value }, effectiveMultiplier);
                    });
                } else {
                    // 简单数值
                    applySingleEffect({ type, value: valueOrObj }, effectiveMultiplier);
                }
            });
        }
        // Handle drawbacks - 同样的格式
        if (official.drawbacks && typeof official.drawbacks === 'object') {
            Object.entries(official.drawbacks).forEach(([type, valueOrObj]) => {
                if (typeof valueOrObj === 'object' && valueOrObj !== null) {
                    Object.entries(valueOrObj).forEach(([target, value]) => {
                        applySingleEffect({ type, target, value }, effectiveMultiplier);
                    });
                } else {
                    applySingleEffect({ type, value: valueOrObj }, effectiveMultiplier);
                }
            });
        }
    });

    return aggregated;
};

/**
 * 计算单个官员的“绝对影响力”（用于把官员数量少的问题，通过质量/资历放大）
 * 设计目标：
 * - 影响力主要由：出身阶层、个人财富、产业规模、在位时间 决定
 * - 输出是一个“绝对值”，后续会换算成对出身阶层的百分比加成
 */
export const calculateOfficialAbsoluteInfluence = (official, context = {}) => {
    if (!official) return 0;

    const currentDay = context.currentDay ?? 0;
    const polityEffects = context.polityEffects || {};

    const sourceStratum = official.sourceStratum;

    const wealth = Math.max(0, official.wealth || 0);
    const ownedProperties = Array.isArray(official.ownedProperties) ? official.ownedProperties : [];

    // 产业规模：数量与等级共同反映“势力网络”
    const propertyCount = ownedProperties.length;
    const propertyLevelSum = ownedProperties.reduce((sum, p) => sum + Math.max(0, p?.level || 0), 0);
    const propertyValue = ownedProperties.reduce((sum, prop) => sum + Math.max(0, prop?.purchaseCost || 0), 0);

    // 任期：采用对数增长（前期提升明显，后期边际递减），避免无限膨胀
    const daysInOffice = official.hireDate != null ? Math.max(0, currentDay - official.hireDate) : 0;
    const tenureYears = daysInOffice / 365;
    const tenureFactor = 1 + Math.min(2.5, Math.log2(tenureYears + 1) * 0.9); // 最多 ~3.5x

    // 出身阶层基座：
    // 1) 先给一个“阶层固有基座”（让贵族/资本出身天然更有盘根错节的影响力）
    // 2) 再与“该阶层当前影响力”挂钩：阶层越强，培养/供养出的官员天然更能撬动权力
    const stratumBase = {
        // 上层与新兴精英
        capitalist: 260,
        landowner: 240,
        knight: 220,
        official: 200,
        engineer: 180,
        merchant: 170,

        // 中层
        scribe: 140,
        cleric: 140,
        artisan: 120,
        navigator: 120,

        // 底层（仍然可能通过财富/产业/任期爬升）
        soldier: 110,
        worker: 90,
        miner: 85,
        lumberjack: 80,
        peasant: 75,
        serf: 65,
        unemployed: 60,
    };
    const staticBase = stratumBase[sourceStratum] ?? 100;

    // classInfluence 在 simulation 中的定义是“绝对影响力值”（不是占比），量级通常在几十~几百+
    // 用对数把它压到一个温和区间，避免阶层影响力巨大时把官员绝对值推爆
    const classInfluence = context.classInfluence || {};
    const currentStratumInfluence = Math.max(0, classInfluence[sourceStratum] || 0);
    const dynamicBase = Math.log10(currentStratumInfluence + 1) * 70; // 通常 0~(随影响力增长)

    const base = staticBase + dynamicBase;

    // 财富/产业采用对数，保证数量级增长但不至于爆炸
    const wealthScore = Math.log10(wealth + 1) * 60;               // 0~(随财富增长)
    const propertyCountScore = Math.sqrt(propertyCount) * 55;      // 产业数量带来的“关系网”
    const propertyLevelScore = Math.sqrt(propertyLevelSum) * 45;   // 升级越高越像大庄园/大工厂
    const propertyValueScore = Math.log10(propertyValue + 1) * 40; // 总资产规模

    // 政体官僚容量：容量越高，官僚体系越成熟，单官员可以撬动更大权力
    const officialCapacity = Math.max(0, polityEffects.officialCapacity || 0);
    const bureaucracyFactor = 1 + Math.min(1.2, officialCapacity * 0.05); // 最多2.2x

    // 官员个体天赋（旧字段兼容）：stratumInfluenceBonus 本来是百分比，这里当作“额外权威”折算
    const legacyBonus = Math.max(0, official.stratumInfluenceBonus || 0);
    const legacyScore = legacyBonus * 120; // 0~30(若0.25)，用于保持原有差异

    const absolute = (base + wealthScore + propertyCountScore + propertyLevelScore + propertyValueScore + legacyScore)
        * tenureFactor
        * bureaucracyFactor;

    return Math.max(0, absolute);
};

/**
 * 计算官员对出身阶层的影响力加成（方案A：绝对值加点）
 * @param {Array} officials - 在任官员列表
 * @param {boolean} isPaid - 是否支付了全额薪水（否则效果减半）
 * @returns {Object} 各阶层的影响力加点 { stratumKey: influencePoints }
 */
export const getOfficialInfluencePoints = (officials, isPaid = true, context = {}) => {
    const pointsMap = {};
    const classInfluence = context.classInfluence || {};
    const totalInfluence = context.totalInfluence || 0;

    if (!officials || !Array.isArray(officials)) return pointsMap;

    const payMultiplier = isPaid ? 1 : 0.5;

    // 设计目标：
    // - 官员数量少时也能在后期显著“抬升”其出身阶层影响力
    // - 直接返回“绝对影响力点数”，由 simulation 采用加法叠加
    // - 单官员加点上限，避免极端财富导致离谱
    const MAX_SINGLE_OFFICIAL_POINTS = 250000; // 单人最多 +25万（可按体验再调）

    officials.forEach(official => {
        if (!official || !official.sourceStratum) return;

        const stratum = official.sourceStratum;
        const absoluteInfluence = calculateOfficialAbsoluteInfluence(official, context);

        // 轻微“派系份额”修正：大派系官僚体系更容易把官员力量制度化
        const baseStratumInfluence = Math.max(0, classInfluence[stratum] || 0);
        const factionShare = totalInfluence > 0 ? (baseStratumInfluence / totalInfluence) : 0;
        const factionMultiplier = 1 + Math.min(0.35, factionShare * 0.7); // 上限+35%

        // 缩放：把 absoluteInfluence 映射到“可见的后期加点”区间
        // 说明：absoluteInfluence 本身仍然来自财富/产业/任期等维度（对数/平方根），
        //      这里再乘一个系数，让其在百万级阶层影响力背景下仍然有存在感。
        const SCALE = 900;
        let points = absoluteInfluence * SCALE * factionMultiplier;

        // 上限 + 付薪惩罚
        points = Math.min(MAX_SINGLE_OFFICIAL_POINTS, points) * payMultiplier;

        if (points <= 0) return;
        pointsMap[stratum] = (pointsMap[stratum] || 0) + points;
    });

    return pointsMap;
};

/**
 * 旧接口：返回“百分比加成”。
 * 为了兼容可能的UI/旧逻辑保留，但 simulation 已切换到方案A。
 */
export const getOfficialInfluenceBonus = (officials, isPaid = true, context = {}) => {
    const bonuses = {};
    const classInfluence = context.classInfluence || {};
    const totalInfluence = context.totalInfluence || 0;

    if (!officials || !Array.isArray(officials)) return bonuses;

    const payMultiplier = isPaid ? 1 : 0.5;

    const MAX_SINGLE_OFFICIAL_BONUS = 2.5; // 单人最多 +250%

    officials.forEach(official => {
        if (!official || !official.sourceStratum) return;

        const stratum = official.sourceStratum;
        const baseStratumInfluence = Math.max(1, classInfluence[stratum] || 0);

        const absoluteInfluence = calculateOfficialAbsoluteInfluence(official, context);

        const SCALE = 0.55;
        let bonus = (absoluteInfluence / baseStratumInfluence) * SCALE;

        const factionShare = totalInfluence > 0 ? (baseStratumInfluence / totalInfluence) : 0;
        const factionMultiplier = 1 + Math.min(0.6, factionShare * 1.2);
        bonus *= factionMultiplier;

        bonus = Math.min(MAX_SINGLE_OFFICIAL_BONUS, bonus) * payMultiplier;

        if (bonus <= 0) return;
        bonuses[stratum] = (bonuses[stratum] || 0) + bonus;
    });

    return bonuses;
};

// ========== 政治立场效果聚合 ==========

/**
 * 聚合所有官员的政治立场效果
 * @param {Array} officials - 在任官员列表
 * @param {Object} gameState - 当前游戏状态（用于检查条件）
 * @returns {Object} { aggregatedEffects, satisfiedCount, unsatisfiedCount }
 */
export const getAggregatedStanceEffects = (officials, gameState) => {
    const aggregated = {
        // 稳定度/合法性
        stability: 0,
        legitimacyBonus: 0,

        // 生产类
        gatherBonus: 0,
        industryBonus: 0,
        tradeBonus: 0,
        researchSpeed: 0,
        cultureBonus: 0,

        // 经济类
        taxEfficiency: 0,
        incomePercentBonus: 0,
        buildingCostMod: 0,
        needsReduction: 0,

        // 生产成本修正
        productionInputCost: {}, // { buildingId: modifier }

        // 人口
        populationGrowth: 0,

        // 军事
        militaryBonus: 0,

        // 组织度
        organizationDecay: 0,

        // 满意度
        approval: {}, // { stratum: value }

        // 外交
        diplomaticBonus: 0,
    };

    let satisfiedCount = 0;
    let unsatisfiedCount = 0;

    if (!officials || !Array.isArray(officials)) {
        return { aggregatedEffects: aggregated, satisfiedCount, unsatisfiedCount };
    }

    const applyEffects = (effects) => {
        if (!effects || typeof effects !== 'object') return;

        Object.entries(effects).forEach(([type, valueOrObj]) => {
            if (typeof valueOrObj === 'object' && valueOrObj !== null) {
                // 嵌套对象（如 approval: { peasant: 10 } 或 productionInputCost: { sawmill: -0.1 }）
                if (type === 'approval') {
                    Object.entries(valueOrObj).forEach(([stratum, value]) => {
                        if (typeof value === 'number') {
                            aggregated.approval[stratum] = (aggregated.approval[stratum] || 0) + value;
                        }
                    });
                } else if (type === 'productionInputCost') {
                    Object.entries(valueOrObj).forEach(([buildingId, value]) => {
                        if (typeof value === 'number') {
                            aggregated.productionInputCost[buildingId] = (aggregated.productionInputCost[buildingId] || 0) + value;
                        }
                    });
                }
            } else if (typeof valueOrObj === 'number') {
                // 简单数值
                if (aggregated.hasOwnProperty(type)) {
                    aggregated[type] += valueOrObj;
                }
            }
        });
    };

    officials.forEach(official => {
        if (!official) return;

        // 检查该官员的政治立场条件是否满足
        const conditionParams = official.stanceConditionParams;
        const satisfied = isStanceSatisfied(official.politicalStance, gameState, conditionParams);

        if (satisfied) {
            satisfiedCount++;
            // 应用该官员独特的满足效果
            applyEffects(official.stanceActiveEffects);
        } else {
            unsatisfiedCount++;
            // 应用该官员独特的不满足惩罚
            applyEffects(official.stanceUnsatisfiedPenalty);
        }
    });

    return { aggregatedEffects: aggregated, satisfiedCount, unsatisfiedCount };
};

// ========== 威望系统 ==========

/**
 * 效果权重映射 (用于威望计算)
 */
const EFFECT_WEIGHTS = {
    buildings: 15,
    militaryBonus: 12,
    tradeBonus: 10,
    taxEfficiency: 10,
    researchSpeed: 10,
    stability: 8,
    approval: 0.5,
    industryBonus: 10,
    gatherBonus: 8,
    incomePercentBonus: 10,
    legitimacyBonus: 8,
    default: 8,
};

/**
 * 计算官员威望值
 * 威望 = 能力分 + 财富分 + 任期分，受阶层出身修正
 * @param {Object} official - 官员对象
 * @param {number} currentDay - 当前游戏天数
 * @returns {number} 威望值 (0-100+)
 */
export const calculatePrestige = (official, currentDay = 0) => {
    if (!official) return 0;

    // 1. 能力分 = Σ|效果数值| × 权重，上限40
    let abilityScore = 0;
    if (official.effects) {
        Object.entries(official.effects).forEach(([type, valueOrObj]) => {
            const weight = EFFECT_WEIGHTS[type] || EFFECT_WEIGHTS.default;
            if (typeof valueOrObj === 'object' && valueOrObj !== null) {
                Object.values(valueOrObj).forEach(v => {
                    abilityScore += Math.abs(v) * weight;
                });
            } else if (typeof valueOrObj === 'number') {
                abilityScore += Math.abs(valueOrObj) * weight;
            }
        });
    }
    abilityScore = Math.min(40, abilityScore);

    // 2. 财富分 = log10(wealth + 1) × 5，上限30
    const wealthScore = Math.min(30, Math.log10((official.wealth || 0) + 1) * 5);

    // 3. 任期分 = min(任职年数, 10) × 2，上限20
    const daysInOffice = official.hireDate ? (currentDay - official.hireDate) : 0;
    const yearsInOffice = Math.max(0, daysInOffice / 365);
    const tenureScore = Math.min(20, yearsInOffice * 2);

    // 4. 阶层修正
    const stratumModifiers = {
        landowner: 1.10, knight: 1.10, official: 1.05,
        merchant: 1.0, capitalist: 1.0, navigator: 1.0,
        scribe: 1.0, cleric: 1.0, engineer: 1.0, artisan: 1.0,
        peasant: 0.95, worker: 0.95, serf: 0.90, miner: 0.95,
        soldier: 1.0,
    };
    const stratumMod = stratumModifiers[official.sourceStratum] || 1.0;

    // 最终威望
    const prestige = (abilityScore + wealthScore + tenureScore) * stratumMod;
    return Math.round(prestige * 10) / 10;
};

/**
 * 获取威望等级
 * @param {number} prestige - 威望值
 * @returns {Object} { level, name, color }
 */
export const getPrestigeLevel = (prestige) => {
    if (prestige >= 80) return { level: 'legendary', name: '一代权臣', color: 'text-yellow-400' };
    if (prestige >= 50) return { level: 'renowned', name: '德高望重', color: 'text-purple-400' };
    if (prestige >= 25) return { level: 'notable', name: '小有名气', color: 'text-blue-400' };
    return { level: 'obscure', name: '无名小卒', color: 'text-gray-400' };
};

// ========== 官员处置系统 ==========

/**
 * 处置类型定义
 */
export const DISPOSAL_TYPES = {
    fire: {
        id: 'fire',
        name: '解雇',
        icon: 'UserMinus',
        color: 'text-gray-400',
        wealthSeized: 0,
        approvalPenaltyMultiplier: 0,
        stabilityPenalty: 0,
        organizationBonus: 0,
        confirmText: '确定解雇此官员？无法获取其财产，其名下产业将全部倒闭。',
        logTemplate: '解雇了 {name}，其自行离去。',
    },
    exile: {
        id: 'exile',
        name: '流放',
        icon: 'LogOut',
        color: 'text-orange-400',
        wealthSeized: 0.5,
        approvalPenaltyMultiplier: 0.5,
        stabilityPenalty: 0.02,
        organizationBonus: 10,
        confirmText: '流放此官员？将没收其一半财产，其名下产业将全部倒闭，其出身阶层会产生不满。',
        logTemplate: '流放了 {name} ({prestigeLevel})，没收财产 {seized} 银。{stratum}阶层好感度 {penalty}。',
    },
    execute: {
        id: 'execute',
        name: '处死',
        icon: 'Skull',
        color: 'text-red-500',
        wealthSeized: 1.0,
        approvalPenaltyMultiplier: 1.0,
        stabilityPenalty: 0.05,
        organizationBonus: 25,
        confirmText: '处死此官员？将抄没全部家产，其名下产业将转交给原始业主阶层，但可能引发严重政治后果。',
        logTemplate: '处死了 {name} ({prestigeLevel})，抄家获得 {seized} 银。{stratum}阶层好感度 {penalty}，稳定度 {stabilityChange}。',
    },
};

/**
 * 计算处置后果
 * @param {Object} official - 官员对象
 * @param {string} disposalType - 处置类型 ('fire' | 'exile' | 'execute')
 * @param {number} currentDay - 当前游戏天数
 * @returns {Object} 处置后果详情
 */
export const getDisposalConsequences = (official, disposalType, currentDay) => {
    const type = DISPOSAL_TYPES[disposalType];
    if (!type || !official) return null;

    const prestige = calculatePrestige(official, currentDay);
    const { name: prestigeLevel } = getPrestigeLevel(prestige);
    const stratum = official.sourceStratum;

    // 没收财产
    const wealthSeized = Math.floor((official.wealth || 0) * type.wealthSeized);

    // 阶层好感惩罚 = 威望 × 乘数，上限 -50
    const approvalPenalty = Math.min(50, Math.round(prestige * type.approvalPenaltyMultiplier));

    // 组织度增加 = 基础值 × (威望/50)
    const orgBonus = Math.round(type.organizationBonus * (prestige / 50));

    // 格式化日志消息
    const logMessage = type.logTemplate
        .replace('{name}', official.name)
        .replace('{prestigeLevel}', prestigeLevel)
        .replace('{seized}', wealthSeized)
        .replace('{stratum}', stratum)
        .replace('{penalty}', approvalPenalty > 0 ? `-${approvalPenalty}` : '无变化')
        .replace('{stabilityChange}', type.stabilityPenalty > 0 ? `-${(type.stabilityPenalty * 100).toFixed(0)}%` : '无');

    return {
        prestige,
        prestigeLevel,
        stratum,
        wealthSeized,
        approvalPenalty,
        stabilityPenalty: type.stabilityPenalty,
        organizationBonus: orgBonus,
        logMessage,
    };
};

/**
 * 执行官员处置
 * @param {string} officialId - 官员ID
 * @param {string} disposalType - 处置类型
 * @param {Array} currentOfficials - 当前官员列表
 * @param {number} currentDay - 当前游戏天数
 * @returns {Object} { success, newOfficials, wealthGained, effects, logMessage }
 */
export const disposeOfficial = (officialId, disposalType, currentOfficials, currentDay) => {
    const official = currentOfficials.find(o => o.id === officialId);
    if (!official) {
        return { success: false, error: '未找到该官员' };
    }

    const consequences = getDisposalConsequences(official, disposalType, currentDay);
    if (!consequences) {
        return { success: false, error: '无效的处置类型' };
    }

    const newOfficials = currentOfficials.filter(o => o.id !== officialId);

    const ownedProperties = Array.isArray(official.ownedProperties) ? official.ownedProperties : [];

    // 处死：产业转交给原始业主阶层；解雇/流放：产业倒闭（消失）
    const propertyOutcome = disposalType === 'execute' ? 'transfer' : 'collapse';

    const propertyTransfers = propertyOutcome === 'transfer'
        ? ownedProperties.map(prop => {
            const building = BUILDINGS.find(b => b.id === prop.buildingId);
            return {
                buildingId: prop.buildingId,
                instanceId: prop.instanceId,
                level: prop.level || 0,
                targetStratum: building?.owner || official.sourceStratum,
                value: prop.purchaseCost || 0,
            };
        })
        : [];

    const propertyTransferTotal = propertyTransfers.reduce((sum, item) => sum + (item.value || 0), 0);

    // ========== 处置时政变判定 ==========
    const disposalPenalty = LOYALTY_CONFIG.DISPOSAL_PENALTY[disposalType];
    let coupTriggered = false;
    let finalLoyalty = official.loyalty ?? 75; // 默认兼容旧存档

    if (disposalPenalty) {
        // 应用忠诚度惩罚
        finalLoyalty = Math.max(0, finalLoyalty + disposalPenalty.loyalty);

        // 计算政变概率
        let coupChance = disposalPenalty.coupChance;

        // 忠诚度≤0时概率翻倍
        if (finalLoyalty <= 0) coupChance *= 2;

        // 检查是否有资本发动政变
        const propertyValue = ownedProperties
            .reduce((sum, p) => sum + (p.purchaseCost || 0), 0);
        const wealthScore = (official.wealth || 0) + propertyValue;
        const propertyCount = ownedProperties.length;

        // 必须有一定资本才能发动政变
        const hasCapital = wealthScore >= LOYALTY_CONFIG.COUP_WEALTH_THRESHOLD * 0.5 ||
            propertyCount >= LOYALTY_CONFIG.COUP_PROPERTY_THRESHOLD - 1;

        if (hasCapital && Math.random() < coupChance) {
            coupTriggered = true;
        }
    }

    return {
        success: true,
        newOfficials,
        wealthGained: consequences.wealthSeized,
        effects: {
            approvalChange: { [consequences.stratum]: -consequences.approvalPenalty },
            stabilityChange: -consequences.stabilityPenalty,
            organizationChange: { [consequences.stratum]: consequences.organizationBonus },
        },
        logMessage: consequences.logMessage,
        propertyOutcome,
        propertyCount: ownedProperties.length,
        propertyTransfer: propertyOutcome === 'transfer' ? {
            transfers: propertyTransfers,
            totalValue: propertyTransferTotal,
        } : null,
        consequences,
        // 政变相关
        coupTriggered,
        coupData: coupTriggered ? {
            official,
            finalLoyalty,
            wealthScore: (official.wealth || 0) + propertyTransferTotal,
        } : null,
    };
};

// ========== 内阁协同度 API ==========

/**
 * 获取内阁综合状态（协同度 + 主导派系 + 效果）
 * @param {Array} officials - 在任官员列表
 * @param {Object} activeDecrees - 当前生效的临时法令
 * @param {number} capacity - 官员编制容量
 * @param {number} epoch - 当前时代
 * @returns {Object} 内阁状态
 */
export const getCabinetStatus = (officials, activeDecrees = {}, capacity = 3, epoch = 0) => {
    // [DEBUG] 追踪传入参数
    console.log('[GET_CABINET_STATUS] Called with:', {
        officialCount: officials?.length || 0,
        capacity,
        epoch,
        minRequired: Math.ceil(capacity * 0.5),
        meetsCapacityRequirement: (officials?.length || 0) >= Math.ceil(capacity * 0.5),
    });

    const synergy = calculateCabinetSynergy(officials);
    const dominance = getCabinetDominance(officials, capacity, epoch);
    const effects = getCabinetEffects(officials, capacity, epoch);
    const decreeEffects = getActiveDecreeEffects(activeDecrees);

    // [DEBUG] 输出结果
    console.log('[GET_CABINET_STATUS] Result:', {
        dominance,
        synergy: synergy.synergy,
        level: synergy.level,
    });

    return {
        synergy: synergy.synergy,
        level: synergy.level,
        distribution: synergy.distribution,
        dominance,
        effects,
        decreeEffects,
    };
};

// 重新导出 cabinetSynergy 中的函数，方便其他模块使用
export {
    calculateCabinetSynergy,
    getCabinetDominance,
    getCabinetEffects,
    getActiveDecreeEffects,
} from './cabinetSynergy';
