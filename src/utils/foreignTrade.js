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
  
  // 目标库存基准值 - 与 simulation.js 和 calculateTradeStatus 保持一致
  const baseInventory = 500;
  
  // 财富系数：轻微影响市场容量（限制范围避免过大波动）
  const wealthFactor = Math.max(0.8, Math.min(1.5, (nation.wealth || 1000) / 1000));
  
  // 时代系数：使用线性增长而非指数增长
  // epoch 0=1x, 1=1.2x, 2=1.4x, 3=1.6x, 4=1.8x, 5=2x, 6=2.2x
  const epoch = nation.epoch || 0;
  const epochFactor = 1 + epoch * 0.2;
  
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

  // 偏差系数调整
  const normalizedBias = Math.max(0.6, Math.min(1.6, bias));
  const biasFactor = 1 + (normalizedBias - 1) * 0.25;

  // 战争物价上涨系数：战争中的国家物价上涨10%-25%
  const isInAnyWar = nation.isAtWar || (nation.foreignWars && Object.values(nation.foreignWars).some(w => w?.isAtWar));
  const warPriceFactor = isInAnyWar ? (1.1 + (nation.aggression || 0.2) * 0.3) : 1.0;

  let price = base * biasFactor * inventoryFactor * warPriceFactor;
  price = Math.max(base * 0.25, Math.min(base * 3.5, price)); // 战争时允许更高的价格上限

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
  // 基础目标库存 - 与 simulation.js 保持一致使用固定值
  // simulation.js 中外国资源围绕 500 波动
  const baseInventory = 500;
  
  // 财富系数：轻微影响市场容量（限制范围避免过大）
  const wealthFactor = Math.max(0.8, Math.min(1.5, (nation.wealth || 1000) / 1000));
  
  // 时代系数：使用线性增长而非指数增长，避免产生巨大的目标库存
  // epoch 0=1x, 1=1.2x, 2=1.4x, 3=1.6x, 4=1.8x, 5=2x, 6=2.2x
  const epoch = nation.epoch || 0;
  const epochFactor = 1 + epoch * 0.2;
  
  const baseTarget = baseInventory * wealthFactor * epochFactor;
  const volatility =
    typeof nation.marketVolatility === 'number' ? nation.marketVolatility : 0.3;
  const inventory = nation?.inventory?.[resourceKey] || 0;
  const offset = getResourceKeyOffset(resourceKey);
  const factor = Math.sin(daysElapsed * 0.05 + offset);
  const dynamicTarget = baseTarget * (1 + factor * volatility);
  
  // 修改阈值逻辑：以目标库存为中心，低于目标为缺口，高于目标为盈余
  // 这样可以确保总有贸易机会
  const shortageThreshold = dynamicTarget * 0.9;  // 低于90%目标视为缺口
  const surplusThreshold = dynamicTarget * 1.1;   // 高于110%目标视为盈余
  
  // 计算缺口和盈余的具体数量
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
