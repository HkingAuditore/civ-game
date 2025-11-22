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
 * 计算外国资源价格
 * @param {string} resourceKey - 资源ID
 * @param {Object} nation - 国家对象
 * @param {number} tick - 当前tick/天数
 * @returns {number}
 */
export const calculateForeignPrice = (resourceKey, nation, tick = 0) => {
  if (!nation) return getResourceBasePrice(resourceKey);
  const base = getResourceBasePrice(resourceKey);
  const bias = nation?.economyTraits?.resourceBias?.[resourceKey] ?? 1;
  const volatility = Math.max(0.05, nation.marketVolatility ?? 0.2);
  const seed = (tick + 1) * 0.5 + (resourceKey.length * 7) + (nation.id?.length || 1) * 3;
  const swing = (pseudoNoise(seed) - 0.5) * 2 * volatility;
  const price = base * bias * (1 + swing);
  return Math.max(0.2, parseFloat(price.toFixed(2)));
};
