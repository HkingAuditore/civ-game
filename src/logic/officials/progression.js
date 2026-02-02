/**
 * Official Progression System
 * 官员成长系统：处理经验值获取、升级和属性成长
 */

import { recalculateEffectsFromStats } from '../../config/officials';

/**
 * 经验值等级表
 * 每级所需经验随等级增加而提高
 */
export const OFFICIAL_XP_TABLE = [
    0,      // Level 1 (start)
    100,    // Level 2
    250,    // Level 3
    500,    // Level 4
    850,    // Level 5
    1300,   // Level 6
    1900,   // Level 7
    2700,   // Level 8
    3800,   // Level 9
    5200,   // Level 10 (max)
];

/**
 * 成长配置
 */
export const PROGRESSION_CONFIG = {
    // 每日基础经验值
    dailyBaseXp: 2,
    // 在职加成经验
    activeServiceXpBonus: 1,
    // 升级时属性增长范围
    statGrowthPerLevel: {
        min: 2,
        max: 5,
    },
    // 野心增长率 (每升一级)
    ambitionGrowthPerLevel: 1.5,
    // 薪资需求增长率 (每升一级)
    salaryGrowthPerLevel: 0.08, // +8% per level
};

/**
 * 获取指定等级所需的总经验值
 * @param {number} level - 目标等级 (1-10)
 * @returns {number} 所需总经验值
 */
export const getXpRequiredForLevel = (level) => {
    if (level <= 1) return 0;
    if (level > 10) return OFFICIAL_XP_TABLE[9]; // Max level
    return OFFICIAL_XP_TABLE[level - 1];
};

/**
 * 检查官员是否可以升级
 * @param {Object} official - 官员对象
 * @returns {boolean}
 */
export const canLevelUp = (official) => {
    if (!official) return false;
    const currentLevel = official.level || 1;
    if (currentLevel >= 10) return false; // Max level
    const currentXp = official.xp || 0;
    const requiredXp = getXpRequiredForLevel(currentLevel + 1);
    return currentXp >= requiredXp;
};

/**
 * 处理官员升级
 * @param {Object} official - 官员对象
 * @returns {Object} 更新后的官员对象及升级信息
 */
export const processLevelUp = (official) => {
    if (!canLevelUp(official)) {
        return { official, leveledUp: false };
    }

    const config = PROGRESSION_CONFIG;
    const currentLevel = official.level || 1;
    const newLevel = currentLevel + 1;

    // 随机选择一个属性进行主要成长
    const stats = official.stats || {
        prestige: official.prestige || 50,
        administrative: official.administrative || 50,
        military: official.military || 30,
        diplomacy: official.diplomacy || 30,
    };

    const statKeys = ['prestige', 'administrative', 'military', 'diplomacy'];
    
    // 按当前值加权，高属性有更大概率继续成长 (专精倾向)
    const weights = statKeys.map(key => Math.pow(stats[key] || 30, 1.5));
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    
    const newStats = { ...stats };
    const statChanges = {};
    
    // 2个属性获得成长
    for (let i = 0; i < 2; i++) {
        let random = Math.random() * totalWeight;
        let selectedStat = statKeys[0];
        
        for (let j = 0; j < statKeys.length; j++) {
            random -= weights[j];
            if (random <= 0) {
                selectedStat = statKeys[j];
                break;
            }
        }
        
        const growth = config.statGrowthPerLevel.min + 
            Math.floor(Math.random() * (config.statGrowthPerLevel.max - config.statGrowthPerLevel.min + 1));
        
        newStats[selectedStat] = Math.min(100, (newStats[selectedStat] || 30) + growth);
        statChanges[selectedStat] = (statChanges[selectedStat] || 0) + growth;
    }

    // ========== 重新计算效果值（属性提升 → 效果提升）==========
    let newEffects = official.effects || {};
    let newRawEffects = official.rawEffects || [];
    
    if (Array.isArray(official.rawEffects) && official.rawEffects.length > 0) {
        const recalcResult = recalculateEffectsFromStats(official.rawEffects, newStats);
        newEffects = recalcResult.effects;
        newRawEffects = recalcResult.rawEffects;
    }

    // 野心增长
    const newAmbition = Math.min(100, (official.ambition || 30) + config.ambitionGrowthPerLevel);

    // 薪资需求增长 - 只更新 baseSalary 作为参考值
    // [FIX] 不再覆盖用户手动设置的 salary，保留用户设置的工资
    const oldBaseSalary = official.baseSalary || official.salary || 50;
    const newBaseSalary = Math.round(oldBaseSalary * (1 + newLevel * config.salaryGrowthPerLevel));

    // 更新升级所需经验
    const newXpToNextLevel = getXpRequiredForLevel(newLevel + 1);

    const updatedOfficial = {
        ...official,
        level: newLevel,
        xpToNextLevel: newXpToNextLevel,
        stats: newStats,
        effects: newEffects,
        rawEffects: newRawEffects,
        // 向后兼容
        prestige: newStats.prestige,
        administrative: newStats.administrative,
        military: newStats.military,
        diplomacy: newStats.diplomacy,
        ambition: newAmbition,
        // [FIX] 保留用户设置的 salary，不再覆盖
        // salary 字段不在这里修改，使用 official 原有的值 (通过 ...official 继承)
        baseSalary: newBaseSalary, // 只更新参考值，用于显示建议薪资
    };

    return {
        official: updatedOfficial,
        leveledUp: true,
        newLevel,
        statChanges,
        ambitionChange: config.ambitionGrowthPerLevel,
    };
};

/**
 * 每日更新官员状态
 * @param {Object} official - 官员对象
 * @param {Object} context - 游戏上下文
 * @returns {Object} 更新后的官员对象及变化日志
 */
export const updateOfficialDaily = (official, context = {}) => {
    if (!official) return { official: null, changes: [] };

    const config = PROGRESSION_CONFIG;
    const changes = [];

    // 复制官员对象
    let updated = { ...official };

    // 1. 获取每日经验值
    let dailyXp = config.dailyBaseXp;
    
    // 在职加成 (已被雇佣的官员)
    if (official.hireDate) {
        dailyXp += config.activeServiceXpBonus;
    }

    // 累加经验值
    const newXp = (updated.xp || 0) + dailyXp;
    updated.xp = newXp;

    // 2. 检查升级
    if (canLevelUp(updated)) {
        const levelUpResult = processLevelUp(updated);
        if (levelUpResult.leveledUp) {
            updated = levelUpResult.official;
            changes.push({
                type: 'level_up',
                officialId: official.id,
                officialName: official.name,
                newLevel: levelUpResult.newLevel,
                statChanges: levelUpResult.statChanges,
            });
        }
    }

    return { official: updated, changes };
};

/**
 * 批量更新所有官员的每日状态
 * @param {Array} officials - 官员数组
 * @param {Object} context - 游戏上下文
 * @returns {Object} { updatedOfficials, allChanges }
 */
export const updateAllOfficialsDaily = (officials, context = {}) => {
    if (!Array.isArray(officials)) {
        return { updatedOfficials: [], allChanges: [] };
    }

    const updatedOfficials = [];
    const allChanges = [];

    for (const official of officials) {
        const result = updateOfficialDaily(official, context);
        if (result.official) {
            updatedOfficials.push(result.official);
            allChanges.push(...result.changes);
        }
    }

    return { updatedOfficials, allChanges };
};
