// 建筑升级效果计算工具
// 用于 simulation.js 和其他需要考虑升级效果的地方

import { BUILDING_UPGRADES, getBuildingEffectiveConfig } from '../config/buildingUpgrades';

/**
 * 获取建筑在考虑升级后的总体效果
 * 对于有多个实例且各实例等级不同的建筑，计算加权总和
 * 
 * @param {Object} building - 基础建筑配置
 * @param {number} count - 建筑数量
 * @param {Object} upgradeLevels - 该建筑类型的升级等级 { instanceIndex: level }
 * @returns {Object} { input, output, jobs } 总体效果
 */
export const calculateBuildingTotalEffects = (building, count, upgradeLevels = {}) => {
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

    // 遍历每个建筑实例
    for (let i = 0; i < count; i++) {
        const level = upgradeLevels[i] || 0;
        const config = getBuildingEffectiveConfig(building, level);

        addToTotal(totalInput, config.input);
        addToTotal(totalOutput, config.output);
        addToTotal(totalJobs, config.jobs);
    }

    return { input: totalInput, output: totalOutput, jobs: totalJobs };
};

/**
 * 获取单个建筑实例的有效配置
 * 
 * @param {Object} building - 基础建筑配置
 * @param {number} instanceIndex - 实例索引
 * @param {Object} upgradeLevels - 该建筑类型的升级等级
 * @returns {Object} 有效配置
 */
export const getSingleBuildingConfig = (building, instanceIndex, upgradeLevels = {}) => {
    const level = upgradeLevels[instanceIndex] || 0;
    return getBuildingEffectiveConfig(building, level);
};

/**
 * 统计建筑各等级的分布
 * 
 * @param {string} buildingId - 建筑ID
 * @param {number} count - 建筑总数
 * @param {Object} upgradeLevels - 升级等级 { instanceIndex: level }
 * @returns {Object} { [level]: count } 各等级的数量
 */
export const getBuildingLevelDistribution = (buildingId, count, upgradeLevels = {}) => {
    const distribution = { 0: 0 }; // 基础等级

    // 获取最大升级等级
    const maxLevel = BUILDING_UPGRADES[buildingId]?.length || 0;
    for (let i = 1; i <= maxLevel; i++) {
        distribution[i] = 0;
    }

    // 统计每个实例的等级
    for (let i = 0; i < count; i++) {
        const level = upgradeLevels[i] || 0;
        distribution[level] = (distribution[level] || 0) + 1;
    }

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
 * @param {Object} upgradeLevels - 升级等级 { instanceIndex: level }
 * @returns {number} 已升级到该等级或更高的数量
 */
export const getUpgradeCountAtOrAboveLevel = (targetLevel, count, upgradeLevels = {}) => {
    let upgradeCount = 0;
    for (let i = 0; i < count; i++) {
        const level = upgradeLevels[i] || 0;
        if (level >= targetLevel) {
            upgradeCount++;
        }
    }
    return upgradeCount;
};
