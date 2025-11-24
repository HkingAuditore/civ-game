// 外贸相关工具
// 负责计算不同国家的即时物价

import { RESOURCES } from '../config';

const getResourceBasePrice = (resourceKey) => {
  return RESOURCES[resourceKey]?.basePrice || 1;
};

const pseudoNoise = (seed) => {
  return (Math.sin(seed) + 1) / 2;
};

/**
 * 计算外国资源价格（库存驱动定价模型）
 * @param {string} resourceKey - 资源ID
 * @param {Object} nation - 国家对象
 * @param {number} tick - 当前tick/天数（保留参数以兼容旧代码，但不再使用）
 * @returns {number}
 */
export const calculateForeignPrice = (resourceKey, nation, tick = 0) => {
  if (!nation) return getResourceBasePrice(resourceKey);
  
  const base = getResourceBasePrice(resourceKey);
  const bias = nation?.economyTraits?.resourceBias?.[resourceKey] ?? 1;
  
  // 获取当前库存
  const currentInventory = nation.inventory?.[resourceKey] || 0;
  
  // 目标库存基准值
  const targetInventory = 500;
  
  // 库存驱动定价公式（优化版）：
  // 实际价格 = 基础价格 * 偏差系数 * 库存调节因子
  // 库存调节因子基于库存与目标的比率，使用平滑的曲线而非线性关系
  
  const stockRatio = targetInventory > 0 ? currentInventory / targetInventory : 1;
  const shortagePressure = Math.max(0, 1 - stockRatio);
  const surplusPressure = Math.max(0, stockRatio - 1);

  // ?????????????????
  const shortageMultiplier = 1 + Math.min(2.5, shortagePressure * 0.9);
  const surplusMultiplier = 1 - Math.min(0.95, surplusPressure * 0.6);
  const inventoryFactor = shortageMultiplier * surplusMultiplier;

  // ???????????????????????
  const normalizedBias = Math.max(0.6, Math.min(1.6, bias));
  const biasFactor = 1 + (normalizedBias - 1) * 0.25;

  let price = base * biasFactor * inventoryFactor;
  price = Math.max(base * 0.25, Math.min(base * 3, price));

  return Math.max(0.5, parseFloat(price.toFixed(2)));
};

const getResourceKeyOffset = (resourceKey = '') => {
  if (!resourceKey) return 0;
  return resourceKey.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
};

/**
 * 计算动态贸易状态（缺口/盈余）及目标库存
 * @param {string} resourceKey
 * @param {Object} nation
 * @param {number} daysElapsed
 * @returns {{isShortage: boolean, isSurplus: boolean, shortageAmount: number, surplusAmount: number, target: number}}
 */
export const calculateTradeStatus = (resourceKey, nation = {}, daysElapsed = 0) => {
  const baseTarget = 500;
  const volatility =
    typeof nation.marketVolatility === 'number' ? nation.marketVolatility : 0.3;
  const inventory = nation?.inventory?.[resourceKey] || 0;
  const offset = getResourceKeyOffset(resourceKey);
  const factor = Math.sin(daysElapsed * 0.05 + offset);
  const dynamicTarget = baseTarget * (1 + factor * volatility);
  const shortageThreshold = dynamicTarget * 0.5;
  const surplusThreshold = dynamicTarget * 1.5;
  const shortageAmount = Math.max(0, shortageThreshold - inventory);
  const surplusAmount = Math.max(0, inventory - surplusThreshold);

  return {
    isShortage: shortageAmount > 0,
    isSurplus: surplusAmount > 0,
    shortageAmount,
    surplusAmount,
    target: dynamicTarget,
  };
};
