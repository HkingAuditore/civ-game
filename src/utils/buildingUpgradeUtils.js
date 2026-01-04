// 建筑升级效果计算工具
// 用于 simulation.js 和其他需要考虑升级效果的地方
// 新数据格式: { buildingId: { level: count } } - 每个等级有多少座建筑

import { BUILDING_UPGRADES, getBuildingEffectiveConfig } from '../config/buildingUpgrades';

/**
 * 计算建筑造价
 * @param {Object} baseCost - 基础成本对象
 * @param {number} count - 当前建筑数量
 * @param {number} growthFactor - 成本增长系数 (默认 1.15)
 * @param {number} baseMultiplier - 基础成本修正系数 (默认 1.0)
 * @returns {Object} 计算后的成本对象
 */
export const calculateBuildingCost = (baseCost, count, growthFactor = 1.15, baseMultiplier = 1.0) => {
    const cost = {};
    
    // 成本计算模型：Base * BaseMultiplier * (1 + Rate * Count^k)
    // 保持与升级成本一致的“斜率递减”曲线
    // growthFactor 如 1.15，则 Rate = 0.15
    const slopeExponent = 0.9;
    const rate = Math.max(0, growthFactor - 1);
    
    const multiplier = 1 + rate * Math.pow(count, slopeExponent);

    for (const [key, val] of Object.entries(baseCost || {})) {
        // Apply baseMultiplier to the base cost before the growth multiplier
        // Using ceil to ensure integer costs
        cost[key] = Math.ceil(val * baseMultiplier * multiplier);
    }
    return cost;
};

/**
 * 应用建筑成本修正
 * @param {Object} cost - 原始成本对象（含数量惩罚后的总成本）
 * @param {number} modifier - 成本修正（负值为降低）
 * @param {Object|null} baseCost - 可选的基础成本对象。若提供，则修正只应用于超出基础成本的部分（数量惩罚）
 * @returns {Object} 调整后的成本对象
 */
export const applyBuildingCostModifier = (cost = {}, modifier = 0, baseCost = null) => {
    if (!modifier) return { ...cost };

    const adjusted = {};
    Object.entries(cost || {}).forEach(([key, totalAmount]) => {
        // 如果提供了基础成本，只减免超出基础成本的部分（数量惩罚）
        if (baseCost && typeof baseCost[key] === 'number') {
            const baseAmount = baseCost[key];
            const penalty = Math.max(0, totalAmount - baseAmount);
            // 对数量惩罚部分应用减免，确保不低于0
            const adjustedPenalty = Math.max(0, penalty * (1 + modifier));
            // 最终成本 = 基础成本 + 调整后的惩罚
            adjusted[key] = baseAmount + adjustedPenalty;
        } else {
            // 兼容旧逻辑：没有基础成本时，直接应用但最低保留20%
            const multiplier = Math.max(0.2, 1 + modifier);
            adjusted[key] = totalAmount * multiplier;
        }
    });
    return adjusted;
};

/**
 * 获取建筑在考虑升级后的总体效果
 * 对于有多个实例且各实例等级不同的建筑，计算加权总和
 * 
 * @param {Object} building - 基础建筑配置
 * @param {number} count - 建筑数量
 * @param {Object} levelCounts - 该建筑类型的等级分布 { level: count }
 * @returns {Object} { input, output, jobs } 总体效果
 */
export const calculateBuildingTotalEffects = (building, count, levelCounts = {}) => {
    if (!building || count <= 0) {
        return { input: {}, output: {}, jobs: {} };
    }

    // 初始化总计
    const totalInput = {};
    const totalOutput = {};
    const totalJobs = {};

    // 辅助函数：累加对象值
    const addToTotal = (target, source, multiplier = 1) => {
        Object.entries(source || {}).forEach(([key, value]) => {
            if (typeof value === 'number') {
                target[key] = (target[key] || 0) + value * multiplier;
            }
        });
    };

    // 计算显式记录的等级
    let accounted = 0;
    for (const [levelStr, levelCount] of Object.entries(levelCounts)) {
        const level = parseInt(levelStr);
        if (!Number.isFinite(level) || levelCount <= 0) continue;

        const config = getBuildingEffectiveConfig(building, level);
        addToTotal(totalInput, config.input, levelCount);
        addToTotal(totalOutput, config.output, levelCount);
        addToTotal(totalJobs, config.jobs, levelCount);
        accounted += levelCount;
    }

    // 剩余的建筑视为0级
    const remaining = count - accounted;
    if (remaining > 0) {
        const config = getBuildingEffectiveConfig(building, 0);
        addToTotal(totalInput, config.input, remaining);
        addToTotal(totalOutput, config.output, remaining);
        addToTotal(totalJobs, config.jobs, remaining);
    }

    return { input: totalInput, output: totalOutput, jobs: totalJobs };
};

/**
 * 获取建筑各等级的分布
 * 新格式下直接返回 levelCounts，补全0级的数量
 * 
 * @param {string} buildingId - 建筑ID
 * @param {number} count - 建筑总数
 * @param {Object} levelCounts - 等级分布 { level: count }
 * @returns {Object} { [level]: count } 各等级的数量（包含0级）
 */
export const getBuildingLevelDistribution = (buildingId, count, levelCounts = {}) => {
    const maxLevel = BUILDING_UPGRADES[buildingId]?.length || 0;
    const distribution = {};

    // 初始化所有等级为0
    for (let i = 0; i <= maxLevel; i++) {
        distribution[i] = 0;
    }

    // 填入已记录的等级数量
    let accounted = 0;
    for (const [levelStr, levelCount] of Object.entries(levelCounts)) {
        const level = parseInt(levelStr);
        if (!Number.isFinite(level) || levelCount <= 0) continue;
        distribution[level] = (distribution[level] || 0) + levelCount;
        accounted += levelCount;
    }

    // 剩余的建筑视为0级
    distribution[0] = Math.max(0, count - accounted + (distribution[0] || 0));

    return distribution;
};

/**
 * 检查建筑是否支持升级
 * 
 * @param {string} buildingId - 建筑ID
 * @returns {boolean}
 */
export const canBuildingUpgrade = (buildingId) => {
    return !!BUILDING_UPGRADES[buildingId] && BUILDING_UPGRADES[buildingId].length > 0;
};

/**
 * 计算已升级到某目标等级或更高的建筑数量
 * 用于升级成本递增计算
 * 
 * @param {number} targetLevel - 目标升级等级
 * @param {number} count - 建筑总数
 * @param {Object} levelCounts - 等级分布 { level: count }
 * @returns {number} 已升级到该等级或更高的数量
 */
export const getUpgradeCountAtOrAboveLevel = (targetLevel, count, levelCounts = {}) => {
    let upgradeCount = 0;
    for (const [levelStr, levelCount] of Object.entries(levelCounts)) {
        const level = parseInt(levelStr);
        if (Number.isFinite(level) && level >= targetLevel && levelCount > 0) {
            upgradeCount += levelCount;
        }
    }
    return upgradeCount;
};

/**
 * 迁移旧格式的 buildingUpgrades 到新格式
 * 旧格式: { buildingId: { instanceIndex: level } }
 * 新格式: { buildingId: { level: count } }
 * 
 * @param {Object} oldUpgrades - 旧格式的升级数据
 * @param {Object} buildings - 建筑数量 { buildingId: count }
 * @returns {Object} 新格式的升级数据
 */
export const migrateUpgradesToNewFormat = (oldUpgrades, buildings = {}) => {
    if (!oldUpgrades || typeof oldUpgrades !== 'object') {
        return {};
    }

    const newUpgrades = {};

    for (const [buildingId, instanceLevels] of Object.entries(oldUpgrades)) {
        if (!instanceLevels || typeof instanceLevels !== 'object') continue;

        // 检测是否是旧格式：key 是数字字符串且值也是数字（实例索引→等级）
        // 新格式下，key 代表等级，值代表数量，通常等级范围小(0-3)，数量可能较大
        // 旧格式下，key 代表实例索引(0, 1, 2, ...)，值代表等级(0-3)

        const keys = Object.keys(instanceLevels);
        const values = Object.values(instanceLevels);

        // 启发式判断：如果 key 的最大值大于可能的最大等级(比如5)，则可能是旧格式
        const maxKey = Math.max(...keys.map(k => parseInt(k)).filter(k => Number.isFinite(k)));
        const maxLevel = BUILDING_UPGRADES[buildingId]?.length || 0;

        const isOldFormat = maxKey > maxLevel;

        if (isOldFormat) {
            // 旧格式：统计每个等级有多少实例
            const levelCounts = {};
            for (const [, level] of Object.entries(instanceLevels)) {
                if (typeof level === 'number' && level > 0) {
                    levelCounts[level] = (levelCounts[level] || 0) + 1;
                }
            }
            if (Object.keys(levelCounts).length > 0) {
                newUpgrades[buildingId] = levelCounts;
            }
        } else {
            // 已经是新格式或无法判断，保持原样
            newUpgrades[buildingId] = { ...instanceLevels };
        }
    }

    return newUpgrades;
};

/**
 * 检测 buildingUpgrades 是否是旧格式
 * 
 * @param {Object} upgrades - buildingUpgrades 数据
 * @param {Object} buildings - 建筑数量
 * @returns {boolean}
 */
export const isOldUpgradeFormat = (upgrades, buildings = {}) => {
    if (!upgrades || typeof upgrades !== 'object') return false;

    for (const [buildingId, instanceLevels] of Object.entries(upgrades)) {
        if (!instanceLevels || typeof instanceLevels !== 'object') continue;

        const keys = Object.keys(instanceLevels);
        if (keys.length === 0) continue;

        const maxKey = Math.max(...keys.map(k => parseInt(k)).filter(k => Number.isFinite(k)));
        const maxLevel = BUILDING_UPGRADES[buildingId]?.length || 0;

        // 如果有任何 key 大于最大等级，说明是旧格式
        if (maxKey > maxLevel) {
            return true;
        }
    }

    return false;
};
