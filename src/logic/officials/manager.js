/**
 * 官员系统核心逻辑
 * 处理选拔、雇佣、解雇及相关计算
 */
import { generateRandomOfficial } from '../../config/officials';

// 选拔冷却时间 (半年 = 180天)
export const OFFICIAL_SELECTION_COOLDOWN = 180;

/**
 * 触发新一轮选拔
 * @param {number} epoch - 当前时代
 * @param {Object} popStructure - 当前人口结构 { stratumKey: population }
 * @param {Object} classInfluence - 当前影响力占比 { stratumKey: influencePercent }
 * @returns {Array} 新生成的候选人列表
 */
export const triggerSelection = (epoch, popStructure = {}, classInfluence = {}) => {
    const candidates = [];
    // 固定生成5名候选人
    for (let i = 0; i < 5; i++) {
        candidates.push(generateRandomOfficial(epoch, popStructure, classInfluence));
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
    const newOfficial = {
        ...candidate,
        hireDate: currentDay,
        wealth: OFFICIAL_STARTING_WEALTH,  // 官员个人存款
        lastDayExpense: 0                   // 上日支出（用于显示）
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
};

// 科技对官员容量的加成
const TECH_OFFICIAL_BONUS = {
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

    const applySingleEffect = (eff) => {
        if (!eff || !eff.type || typeof eff.value !== 'number') return;
        const val = eff.value * multiplier;

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

            default:
                break;
        }
    };

    officials.forEach(official => {
        // 跳过无效的 official 条目
        if (!official || typeof official !== 'object') return;

        // Handle effects - effects 是对象格式 {type: value} 或 {type: {target: value}}
        if (official.effects && typeof official.effects === 'object') {
            Object.entries(official.effects).forEach(([type, valueOrObj]) => {
                if (typeof valueOrObj === 'object' && valueOrObj !== null) {
                    // 嵌套对象：例如 { buildings: { farm: 0.1 } }
                    Object.entries(valueOrObj).forEach(([target, value]) => {
                        applySingleEffect({ type, target, value });
                    });
                } else {
                    // 简单数值
                    applySingleEffect({ type, value: valueOrObj });
                }
            });
        }
        // Handle drawbacks - 同样的格式
        if (official.drawbacks && typeof official.drawbacks === 'object') {
            Object.entries(official.drawbacks).forEach(([type, valueOrObj]) => {
                if (typeof valueOrObj === 'object' && valueOrObj !== null) {
                    Object.entries(valueOrObj).forEach(([target, value]) => {
                        applySingleEffect({ type, target, value });
                    });
                } else {
                    applySingleEffect({ type, value: valueOrObj });
                }
            });
        }
    });

    return aggregated;
};

/**
 * 计算官员对出身阶层的影响力加成
 * @param {Array} officials - 在任官员列表
 * @param {boolean} isPaid - 是否支付了全额薪水（否则加成减半）
 * @returns {Object} 各阶层的影响力加成 { stratumKey: bonusPercent }
 */
export const getOfficialInfluenceBonus = (officials, isPaid = true) => {
    const bonuses = {};

    if (!officials || !Array.isArray(officials)) return bonuses;

    const multiplier = isPaid ? 1 : 0.5;

    officials.forEach(official => {
        if (!official || !official.sourceStratum) return;

        const stratum = official.sourceStratum;
        const bonus = (official.stratumInfluenceBonus || 0) * multiplier;

        bonuses[stratum] = (bonuses[stratum] || 0) + bonus;
    });

    return bonuses;
};
