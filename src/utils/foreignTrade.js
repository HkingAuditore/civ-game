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

    // 目标库存根据资源偏差调整（与 aiEconomy.js 和 calculateTradeStatus 保持一致）
    // bias=1.5时目标1125，bias=0.5时目标250，bias=1时目标500
    const baseInventory = Math.round(500 * Math.pow(bias, 1.2));

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

    // 战争物价上涨系数：每场战争增加15%物价（最高+75%）
    const warCount = nation.foreignWars
        ? Object.values(nation.foreignWars).filter(w => w?.isAtWar).length
        : 0;
    const totalWarCount = (nation.isAtWar ? 1 : 0) + warCount;
    const warPriceFactor = totalWarCount > 0 ? (1 + Math.min(0.75, totalWarCount * 0.15)) : 1.0;

    let price = base * biasFactor * inventoryFactor * warPriceFactor;
    price = Math.max(base * 0.25, Math.min(base * 4.0, price)); // 战争时允许更高的价格上限（3.5->4.0）


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
    // 获取资源偏差（特产资源 > 1，稀缺资源 < 1）
    const bias = nation?.economyTraits?.resourceBias?.[resourceKey] ?? 1;

    // 基础目标库存根据资源偏差调整（与 aiEconomy.js 保持一致）
    // bias=1.5时目标1125，bias=0.5时目标250，bias=1时目标500
    const baseInventory = Math.round(500 * Math.pow(bias, 1.2));

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
    const factor = Math.sin(daysElapsed * 0.015 + offset);
    const dynamicTarget = baseTarget * (1 + factor * volatility);

    // 阈值逻辑根据资源偏差调整：
    // 特产资源 (bias > 1): 更容易有盈余（盈余阈值更低），更难有缺口（缺口阈值更低）
    // 稀缺资源 (bias < 1): 更容易有缺口（缺口阈值更高），更难有盈余（盈余阈值更高）
    // 这样可以形成明显的贸易差异化
    const shortageMultiplier = bias > 1 ? 0.5 : (bias < 1 ? 1.2 : 0.9);  // 特产资源难缺货
    const surplusMultiplier = bias > 1 ? 0.7 : (bias < 1 ? 1.5 : 1.1);   // 特产资源极易盈余

    const shortageThreshold = dynamicTarget * shortageMultiplier;
    const surplusThreshold = dynamicTarget * surplusMultiplier;

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
