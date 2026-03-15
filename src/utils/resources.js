// 资源相关的工具函数

import { BUILDINGS, RESOURCES } from '../config';

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
  
  // 检查科技要求
  if (resource.unlockTech) {
    if (!techsUnlocked.includes(resource.unlockTech)) {
      return false;
    }
  }
  
  // 检查时代要求
  if (typeof resource.unlockEpoch === 'number' && resource.unlockEpoch > epoch) {
    return false;
  }
  
  return true;
};

/**
 * 基于“已建成产出建筑”计算当前可稳定获得的资源集合
 * @param {Object} buildingCounts - 建筑数量映射
 * @returns {Set<string>} 可稳定获得的资源集合
 */
export const getAvailableResourceSet = (buildingCounts = {}) => {
  const availableResources = new Set();

  BUILDINGS.forEach((building) => {
    const count = Number(buildingCounts?.[building.id] || 0);
    if (count <= 0 || !building.output) {
      return;
    }

    Object.entries(building.output).forEach(([resourceKey, amount]) => {
      if (!RESOURCES[resourceKey] || !Number.isFinite(amount) || amount <= 0) {
        return;
      }
      availableResources.add(resourceKey);
    });
  });

  return availableResources;
};

/**
 * 资源是否进入需求/生活水平/满意度体系
 * 规则：已解锁 + 已具备稳定供给能力（已有产出建筑）
 * @param {string} resourceKey
 * @param {number} epoch
 * @param {Array} techsUnlocked
 * @param {Set<string>|null} availableResources
 * @returns {boolean}
 */
export const isResourceDemandActive = (
  resourceKey,
  epoch,
  techsUnlocked = [],
  availableResources = null
) => {
  if (!isResourceUnlocked(resourceKey, epoch, techsUnlocked)) {
    return false;
  }

  if (availableResources && !availableResources.has(resourceKey)) {
    return false;
  }

  return true;
};

/**
 * 过滤已解锁的资源对象
 * @param {Object} resourcesObj - 资源对象（如建筑的input/output）
 * @param {number} epoch - 当前时代
 * @param {Array} techsUnlocked - 已解锁的科技数组
 * @returns {Object} 过滤后的资源对象
 */
export const filterUnlockedResources = (resourcesObj, epoch, techsUnlocked = []) => {
  if (!resourcesObj) return {};
  
  const filtered = {};
  for (const [key, value] of Object.entries(resourcesObj)) {
    if (isResourceUnlocked(key, epoch, techsUnlocked)) {
      filtered[key] = value;
    }
  }
  return filtered;
};
