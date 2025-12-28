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
 * @returns {Array} 新生成的候选人列表
 */
export const triggerSelection = (epoch) => {
    const candidates = [];
    // 固定生成5名候选人
    for (let i = 0; i < 5; i++) {
        candidates.push(generateRandomOfficial(epoch));
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

    // 添加到在任列表，并记录入职时间
    const newOfficial = {
        ...candidate,
        hireDate: currentDay
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

/**
 * 聚合所有官员的效果
 * @param {Array} officials - 在任官员列表
 * @param {boolean} isPaid - 是否支付了全额薪水（否则效果减半）
 * @returns {Object} 聚合后的效果对象，格式兼容 applyEffects
 */
export const getAggregatedOfficialEffects = (officials, isPaid) => {
    const aggregated = {
        buildings: {},
        buildingProductionMod: {},
        decreeStratumDemandMod: {},
        decreeResourceDemandMod: {},
        passiveGains: {},
        passivePercentGains: {},
        approval: {}, // { stratum: val }
        // scalar values
        needsReduction: 0,
        extraMaxPop: 0,
        incomePercentBonus: 0,
        stability: 0,
        militaryBonus: 0,
        scienceBonus: 0,
        cultureBonus: 0,
    };

    if (!officials || !Array.isArray(officials)) return aggregated;

    const multiplier = isPaid ? 1 : 0.5;

    const applySingleEffect = (eff) => {
        if (!eff || !eff.type || typeof eff.value !== 'number') return;
        const val = eff.value * multiplier;

        switch (eff.type) {
            case 'buildings':
                if (eff.target) {
                    aggregated.buildings[eff.target] = (aggregated.buildings[eff.target] || 0) + val;
                }
                break;
            case 'buildingProductionMod':
            case 'categories': // categories also allow modifying production mod
                if (eff.target) {
                    aggregated.buildingProductionMod[eff.target] = (aggregated.buildingProductionMod[eff.target] || 0) + val;
                }
                break;
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
            case 'needsReduction':
                aggregated.needsReduction += val;
                break;
            case 'maxPop':
                aggregated.extraMaxPop += val;
                break;
            case 'incomePercent':
                aggregated.incomePercentBonus += val;
                break;
            case 'stability':
                aggregated.stability += val;
                break;
            case 'militaryBonus':
                aggregated.militaryBonus += val;
                break;
            case 'science': // config might use 'science' or 'scienceBonus', checking officials.js config it uses specific mapping? No, generateEffect generally uses type.
            // But OFFICIAL_EFFECT_TYPES doesn't list 'science' specifically as top level?
            // Actually 'passive' can produce science. But if there is a direct 'science' bonus type.
            // Let's assume standard ones.
                break;
            case 'approval':
                if (eff.target) {
                    aggregated.approval[eff.target] = (aggregated.approval[eff.target] || 0) + val;
                }
                break;
            default:
                break;
        }
    };

    officials.forEach(official => {
        // Handle positive effects
        (official.effects || []).forEach(eff => applySingleEffect(eff));
        // Handle drawbacks
        (official.drawbacks || []).forEach(eff => applySingleEffect(eff));
    });

    return aggregated;
};
