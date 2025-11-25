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
  
  // 目标库存基准值（基于国家财富和时代动态调整）
  const baseInventory = 500;
  
  // 财富系数：财富越高，市场容量越大，价格越稳定
  // wealth范围约为350-2600，系数范围约为0.35-2.6
  const wealthFactor = Math.max(1, (nation.wealth || 1000) / 1000);
  
  // 时代系数：随着时代演进，市场容量指数增长
  // epoch 0(石器)=1x, 1(青铜)=2x, 2(古典)=4x, 3(封建)=8x, 4(探索)=16x, 5(启蒙)=32x, 6(工业)=64x
  // 最终在工业时代+高财富时，目标库存可达数十万（如：500 × 2.6 × 64 = 83,200）
  const epoch = nation.epoch || 0;
  const epochFactor = Math.pow(2, epoch);
  
  const targetInventory = baseInventory * wealthFactor * epochFactor;
  
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
  // 基础目标库存（基于国家财富和时代动态调整）
  const baseInventory = 500;
  
  // 财富系数：财富越高，市场容量越大
  const wealthFactor = Math.max(1, (nation.wealth || 1000) / 1000);
  
  // 时代系数：随着时代演进，市场容量指数增长
  const epoch = nation.epoch || 0;
  const epochFactor = Math.pow(2, epoch);
  
  const baseTarget = baseInventory * wealthFactor * epochFactor;
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
