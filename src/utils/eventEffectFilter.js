/**
 * 事件效果过滤工具
 * 根据当前时代过滤掉尚未解锁的阶层、资源、建筑相关效果
 */

import { RESOURCES, BUILDINGS } from '../config';
import { STRATA } from '../config/strata';

/**
 * 检查阶层是否可用（有已解锁的建筑提供该阶层的工作岗位）
 * @param {string} stratumKey - 阶层键值
 * @param {number} epoch - 当前时代
 * @param {Array} techsUnlocked - 已解锁的科技数组
 * @returns {boolean} 阶层是否可用
 */
export const isStratumAvailable = (stratumKey, epoch, techsUnlocked = []) => {
    // 特殊处理：unemployed（失业者）始终可用
    if (stratumKey === 'unemployed') return true;
    if (!STRATA[stratumKey]) return false;
    
    // 检查是否有任何已解锁的建筑提供该阶层的工作岗位
    return BUILDINGS.some(building => {
        // 检查建筑是否已解锁
        const epochUnlocked = building.epoch <= epoch;
        const techUnlocked = !building.requiresTech || techsUnlocked.includes(building.requiresTech);
        const isUnlocked = epochUnlocked && techUnlocked;
        
        // 检查建筑是否提供该阶层的工作岗位
        const providesJob = building.jobs && building.jobs[stratumKey] > 0;
        
        return isUnlocked && providesJob;
    });
};

/**
 * 检查资源是否已解锁
 * @param {string} resourceKey - 资源键值
 * @param {number} epoch - 当前时代
 * @param {Array} techsUnlocked - 已解锁的科技数组
 * @returns {boolean} 资源是否已解锁
 */
export const isResourceUnlocked = (resourceKey, epoch, techsUnlocked = []) => {
    const resource = RESOURCES[resourceKey];
    if (!resource) return false;
    
    // 检查时代要求
    if ((resource.unlockEpoch ?? 0) > epoch) return false;
    
    // 检查科技要求
    if (resource.unlockTech && !techsUnlocked.includes(resource.unlockTech)) return false;
    
    return true;
};

/**
 * 检查建筑是否已解锁
 * @param {string} buildingId - 建筑ID
 * @param {number} epoch - 当前时代
 * @param {Array} techsUnlocked - 已解锁的科技数组
 * @returns {boolean} 建筑是否已解锁
 */
export const isBuildingUnlocked = (buildingId, epoch, techsUnlocked = []) => {
    const building = BUILDINGS.find(b => b.id === buildingId);
    if (!building) return false;
    
    if (building.epoch > epoch) return false;
    if (building.requiresTech && !techsUnlocked.includes(building.requiresTech)) return false;
    
    return true;
};

/**
 * 过滤事件选项的效果对象，移除当前时代尚未解锁的内容
 * @param {Object} effects - 原始效果对象
 * @param {number} epoch - 当前时代
 * @param {Array} techsUnlocked - 已解锁的科技数组
 * @returns {Object} 过滤后的效果对象
 */
export const filterEventEffects = (effects, epoch, techsUnlocked = []) => {
    if (!effects) return effects;
    
    const filtered = { ...effects };
    
    // 过滤阶层满意度效果
    if (filtered.approval) {
        const filteredApproval = {};
        for (const [stratum, value] of Object.entries(filtered.approval)) {
            if (isStratumAvailable(stratum, epoch, techsUnlocked)) {
                filteredApproval[stratum] = value;
            }
        }
        if (Object.keys(filteredApproval).length > 0) {
            filtered.approval = filteredApproval;
        } else {
            delete filtered.approval;
        }
    }
    
    // 过滤阶层需求修正
    if (filtered.stratumDemandMod) {
        const filteredStratumDemand = {};
        for (const [stratum, value] of Object.entries(filtered.stratumDemandMod)) {
            if (isStratumAvailable(stratum, epoch, techsUnlocked)) {
                filteredStratumDemand[stratum] = value;
            }
        }
        if (Object.keys(filteredStratumDemand).length > 0) {
            filtered.stratumDemandMod = filteredStratumDemand;
        } else {
            delete filtered.stratumDemandMod;
        }
    }
    
    // 过滤资源效果（固定值）
    if (filtered.resources) {
        const filteredResources = {};
        for (const [resource, value] of Object.entries(filtered.resources)) {
            if (isResourceUnlocked(resource, epoch, techsUnlocked)) {
                filteredResources[resource] = value;
            }
        }
        if (Object.keys(filteredResources).length > 0) {
            filtered.resources = filteredResources;
        } else {
            delete filtered.resources;
        }
    }
    
    // 过滤资源效果（百分比）
    if (filtered.resourcePercent) {
        const filteredResourcePercent = {};
        for (const [resource, value] of Object.entries(filtered.resourcePercent)) {
            if (isResourceUnlocked(resource, epoch, techsUnlocked)) {
                filteredResourcePercent[resource] = value;
            }
        }
        if (Object.keys(filteredResourcePercent).length > 0) {
            filtered.resourcePercent = filteredResourcePercent;
        } else {
            delete filtered.resourcePercent;
        }
    }
    
    // 过滤资源需求修正
    if (filtered.resourceDemandMod) {
        const filteredResourceDemand = {};
        for (const [resource, value] of Object.entries(filtered.resourceDemandMod)) {
            if (isResourceUnlocked(resource, epoch, techsUnlocked)) {
                filteredResourceDemand[resource] = value;
            }
        }
        if (Object.keys(filteredResourceDemand).length > 0) {
            filtered.resourceDemandMod = filteredResourceDemand;
        } else {
            delete filtered.resourceDemandMod;
        }
    }
    
    // 过滤建筑产量修正（保留类别如 'gather', 'industry', 'all'）
    if (filtered.buildingProductionMod) {
        const categories = ['gather', 'industry', 'civic', 'military', 'all'];
        const filteredBuildingProduction = {};
        for (const [target, value] of Object.entries(filtered.buildingProductionMod)) {
            // 类别始终保留，具体建筑需要检查是否解锁
            if (categories.includes(target) || isBuildingUnlocked(target, epoch, techsUnlocked)) {
                filteredBuildingProduction[target] = value;
            }
        }
        if (Object.keys(filteredBuildingProduction).length > 0) {
            filtered.buildingProductionMod = filteredBuildingProduction;
        } else {
            delete filtered.buildingProductionMod;
        }
    }
    
    return filtered;
};

/**
 * 过滤事件选项数组中的所有效果
 * @param {Array} options - 事件选项数组
 * @param {number} epoch - 当前时代
 * @param {Array} techsUnlocked - 已解锁的科技数组
 * @returns {Array} 过滤后的选项数组
 */
export const filterEventOptions = (options, epoch, techsUnlocked = []) => {
    if (!options || !Array.isArray(options)) return options;
    
    return options.map(option => {
        const filteredOption = { ...option };
        
        // 过滤基础效果
        if (filteredOption.effects) {
            filteredOption.effects = filterEventEffects(filteredOption.effects, epoch, techsUnlocked);
        }
        
        // 过滤随机效果
        if (filteredOption.randomEffects && Array.isArray(filteredOption.randomEffects)) {
            filteredOption.randomEffects = filteredOption.randomEffects.map(randomEffect => ({
                ...randomEffect,
                effects: filterEventEffects(randomEffect.effects, epoch, techsUnlocked)
            }));
        }
        
        return filteredOption;
    });
};
