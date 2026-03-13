import { RESOURCES } from '../config';

/**
 * 判断资源是否为可在市场交易的物资
 */
export const isMarketResource = (resource) => {
  if (resource === 'silver') return false;
  const def = RESOURCES[resource];
  if (!def) return false;
  if (def.type === 'virtual' || def.type === 'currency') return false;
  return true;
};

/**
 * 获取资源的当前市场价格
 */
export const getResourcePrice = (resource, market) => {
  if (resource === 'silver') return 1;
  const basePrice = RESOURCES[resource]?.basePrice || 1;
  return market?.prices?.[resource] ?? basePrice;
};

/**
 * 根据输入资源需求计算需要支出的银币总额
 */
export const calculateSilverCost = (requirements = {}, market) => {
  return Object.entries(requirements).reduce((sum, [res, amount]) => {
    if (!amount) return sum;
    return sum + amount * getResourcePrice(res, market);
  }, 0);
};

export const formatSilverCost = (value) => `${Math.ceil(value)} 银币`;

/**
 * 格式化银币成本为紧凑形式（用于小屏幕）
 * 例如: 13804 -> "1.4万银币" 或 6500 -> "6500银币"
 */
export const formatSilverCostCompact = (value) => {
    const num = Math.ceil(value);
    if (num >= 10000) {
        return `${(num / 10000).toFixed(1).replace(/\.0$/, '')}万银币`;
    }
    return `${num}银币`;
};
