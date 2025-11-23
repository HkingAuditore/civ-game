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
  
  // 库存驱动定价公式：
  // 实际价格 = 基础价格 * 偏差系数 * (目标库存 / max(1, 当前库存))
  // 当库存接近0时，价格趋于无穷大（买不起）
  // 当库存远超目标时，价格跌至地板价（卖不掉）
  const inventoryFactor = targetInventory / Math.max(1, currentInventory);
  
  // 限制价格波动范围，避免极端情况
  // 最低0.2倍基础价格，最高10倍基础价格
  const clampedFactor = Math.max(0.2, Math.min(10, inventoryFactor));
  
  const price = base * bias * clampedFactor;
  
  return Math.max(0.2, parseFloat(price.toFixed(2)));
};
