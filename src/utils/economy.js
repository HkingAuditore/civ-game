import { RESOURCES } from '../config';
import { formatNumberShortCN } from './numberFormat';

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

/** 格式化银币成本（自动使用中文缩写：万/亿/兆） */
export const formatSilverCost = (value) => {
    const num = Math.ceil(value);
    return `${formatNumberShortCN(num, { decimals: 1 })} 银币`;
};

/**
 * 格式化银币成本为紧凑形式（用于按钮等窄空间）
 * 只显示数字部分（不含"银币"后缀），使用中文缩写
 */
export const formatSilverCostCompact = (value) => {
    const num = Math.ceil(value);
    return formatNumberShortCN(num, { decimals: 1 });
};
