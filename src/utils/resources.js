// 资源相关的工具函数

import { RESOURCES } from '../config';

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
