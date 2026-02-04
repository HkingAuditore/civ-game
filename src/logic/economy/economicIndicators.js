/**
 * Economic Indicators Calculator
 * 经济指标计算器
 * 
 * 功能：
 * - 价格历史管理
 * - 长期均衡价格计算
 * - GDP计算（支出法）
 * - CPI计算（消费者物价指数）
 * - PPI计算（生产者物价指数）
 */

import { RESOURCES } from '../../config';

// ==================== 配置参数 ====================

export const ECONOMIC_INDICATOR_CONFIG = {
  // 价格历史
  priceHistory: {
    maxLength: 365,           // 最多保留365天
    updateInterval: 1,        // 每天更新
  },
  
  // 均衡价格
  equilibriumPrice: {
    window: 90,               // 90天滚动平均
    updateInterval: 10,       // 每10天重新计算
    minDataPoints: 30,        // 至少30天数据才使用均衡价格
  },
  
  // GDP
  gdp: {
    updateInterval: 1,        // 每天计算
  },
  
  // CPI/PPI
  inflation: {
    updateInterval: 1,        // 每天计算
    historyLength: 100,       // 保留100天历史
  },
  
  // 消费者篮子权重
  cpiBasket: {
    food: 0.40,
    cloth: 0.15,
    wood: 0.10,
    iron: 0.10,
    luxury: 0.15,
    wine: 0.05,
    books: 0.05,
  },
  
  // 生产者篮子权重
  ppiBasket: {
    food: 0.20,
    wood: 0.25,
    stone: 0.15,
    iron: 0.20,
    coal: 0.15,
    cloth: 0.05,
  },
};

// ==================== 工具函数 ====================

/**
 * 获取资源的基准价格
 * @param {string} resource - 资源key
 * @returns {number} 基准价格
 */
function getBasePrice(resource) {
  return RESOURCES[resource]?.basePrice || 1.0;
}

/**
 * 获取所有资源的基准价格
 * @returns {Object} 基准价格对象
 */
export function getBasePrices() {
  const basePrices = {};
  Object.keys(RESOURCES).forEach(resource => {
    basePrices[resource] = getBasePrice(resource);
  });
  return basePrices;
}

// ==================== 价格历史管理 ====================

/**
 * 更新价格历史
 * @param {Object} params
 * @param {Object} params.priceHistory - 当前价格历史 { resource: [prices...] }
 * @param {Object} params.currentPrices - 当前市场价格 { resource: price }
 * @param {number} params.maxLength - 最大保留天数（默认365）
 * @returns {Object} 更新后的价格历史
 */
export function updatePriceHistory({
  priceHistory,
  currentPrices,
  maxLength = ECONOMIC_INDICATOR_CONFIG.priceHistory.maxLength,
}) {
  if (!currentPrices || typeof currentPrices !== 'object') {
    return priceHistory || {};
  }
  
  const updated = { ...priceHistory };
  
  Object.entries(currentPrices).forEach(([resource, price]) => {
    // 验证价格有效性
    if (!Number.isFinite(price) || price < 0) {
      return;
    }
    
    // 初始化资源历史
    if (!updated[resource]) {
      updated[resource] = [];
    }
    
    // 添加当前价格
    updated[resource] = [...updated[resource], price];
    
    // 限制长度
    if (updated[resource].length > maxLength) {
      updated[resource] = updated[resource].slice(-maxLength);
    }
  });
  
  return updated;
}

// ==================== 均衡价格计算 ====================

/**
 * 计算长期均衡价格（滚动平均）
 * @param {Object} params
 * @param {Object} params.priceHistory - 价格历史数据 { resource: [prices...] }
 * @param {Object} params.basePrices - 基准价格（fallback）
 * @param {number} params.window - 滚动窗口天数（默认90）
 * @returns {Object} 均衡价格 { resource: price }
 */
export function calculateEquilibriumPrices({
  priceHistory,
  basePrices,
  window = ECONOMIC_INDICATOR_CONFIG.equilibriumPrice.window,
}) {
  const equilibriumPrices = {};
  const minDataPoints = ECONOMIC_INDICATOR_CONFIG.equilibriumPrice.minDataPoints;
  
  // 确保basePrices存在
  const fallbackPrices = basePrices || getBasePrices();
  
  Object.keys(fallbackPrices).forEach(resource => {
    const history = priceHistory?.[resource] || [];
    const basePrice = fallbackPrices[resource];
    
    if (history.length === 0) {
      // 游戏刚开始，使用 basePrice
      equilibriumPrices[resource] = basePrice;
    } else if (history.length < minDataPoints) {
      // 数据不足，使用现有数据的平均值
      const sum = history.reduce((a, b) => a + b, 0);
      equilibriumPrices[resource] = sum / history.length;
    } else {
      // 使用最近 window 天的滚动平均
      const recentPrices = history.slice(-window);
      const sum = recentPrices.reduce((a, b) => a + b, 0);
      equilibriumPrices[resource] = sum / recentPrices.length;
    }
  });
  
  return equilibriumPrices;
}

// ==================== GDP 计算 ====================

/**
 * 计算GDP（支出法）
 * GDP = 消费(C) + 投资(I) + 政府支出(G) + 净出口(NX)
 * 
 * @param {Object} params
 * @param {Object} params.classFinancialData - 阶层财务数据
 * @param {Object} params.buildingFinancialData - 建筑财务数据
 * @param {number} params.dailyMilitaryExpense - 每日军费
 * @param {Array} params.officials - 官员列表
 * @param {Object} params.taxBreakdown - 税收分解
 * @param {Object} params.demandBreakdown - 需求分解（包含进出口）
 * @param {Object} params.marketPrices - 市场价格
 * @param {number} params.previousGDP - 上期GDP（用于计算增长率）
 * @returns {Object} GDP数据
 */
export function calculateGDP({
  classFinancialData = {},
  buildingFinancialData = {},
  dailyMilitaryExpense = 0,
  officials = [],
  taxBreakdown = {},
  demandBreakdown = {},
  marketPrices = {},
  previousGDP = 0,
}) {
  // 1. 消费 (Consumption - C)
  // 所有阶层的基础需求和奢侈需求消费总额
  const consumption = Object.values(classFinancialData).reduce((sum, classData) => {
    // 基础需求消费（从expense.essentialNeeds获取）
    const essentialConsumption = Object.values(classData.expense?.essentialNeeds || {})
      .reduce((total, need) => {
        const cost = need.cost || need.totalCost || 0;
        return total + (Number.isFinite(cost) ? cost : 0);
      }, 0);
    
    // 奢侈需求消费（从expense.luxuryNeeds获取）
    const luxuryConsumption = Object.values(classData.expense?.luxuryNeeds || {})
      .reduce((total, need) => {
        const cost = need.cost || need.totalCost || 0;
        return total + (Number.isFinite(cost) ? cost : 0);
      }, 0);
    
    return sum + essentialConsumption + luxuryConsumption;
  }, 0);
  
  // 2. 投资 (Investment - I)
  // 新建建筑成本 + 建筑升级成本
  const investment = Object.values(buildingFinancialData).reduce((sum, building) => {
    const constructionCost = building.constructionCost || 0;
    const upgradeCost = building.upgradeCost || 0;
    return sum + 
      (Number.isFinite(constructionCost) ? constructionCost : 0) +
      (Number.isFinite(upgradeCost) ? upgradeCost : 0);
  }, 0);
  
  // 3. 政府支出 (Government Spending - G)
  // 军队维护费 + 官员薪水 + 政府补贴
  const militaryExpense = Number.isFinite(dailyMilitaryExpense) ? dailyMilitaryExpense : 0;
  const officialSalaries = officials.reduce((sum, official) => {
    const salary = official.salary || 0;
    return sum + (Number.isFinite(salary) ? salary : 0);
  }, 0);
  const subsidies = Math.abs(taxBreakdown.subsidy || 0); // 补贴为负数，取绝对值
  const government = militaryExpense + officialSalaries + subsidies;
  
  // 4. 净出口 (Net Exports - NX)
  // 出口额 - 进口额
  const exports = Object.entries(demandBreakdown.exports || {})
    .reduce((sum, [resource, quantity]) => {
      const price = marketPrices[resource] || 0;
      const value = quantity * price;
      return sum + (Number.isFinite(value) ? value : 0);
    }, 0);
  
  const imports = Object.entries(demandBreakdown.imports || {})
    .reduce((sum, [resource, quantity]) => {
      const price = marketPrices[resource] || 0;
      const value = quantity * price;
      return sum + (Number.isFinite(value) ? value : 0);
    }, 0);
  
  const netExports = exports - imports;
  
  // GDP总计
  const total = consumption + investment + government + netExports;
  
  // 增长率计算
  const change = previousGDP > 0 
    ? ((total - previousGDP) / previousGDP) * 100 
    : 0;
  
  return {
    total,
    consumption,
    investment,
    government,
    netExports,
    change,
    breakdown: {
      consumption,
      investment,
      government,
      netExports,
      exports,
      imports,
    },
  };
}

// ==================== CPI 计算 ====================

/**
 * 计算CPI（消费者物价指数）
 * 使用长期均衡价格作为基准
 * 
 * @param {Object} params
 * @param {Object} params.marketPrices - 当前市场价格
 * @param {Object} params.equilibriumPrices - 长期均衡价格（基准）
 * @param {number} params.previousCPI - 上期CPI（用于计算变化率）
 * @returns {Object} CPI数据
 */
export function calculateCPI({
  marketPrices = {},
  equilibriumPrices = {},
  previousCPI = 100,
}) {
  const basket = ECONOMIC_INDICATOR_CONFIG.cpiBasket;
  
  let currentBasketCost = 0;
  let baseBasketCost = 0;
  const breakdown = {};
  
  Object.entries(basket).forEach(([resource, weight]) => {
    const currentPrice = marketPrices[resource] || equilibriumPrices[resource] || getBasePrice(resource);
    const basePrice = equilibriumPrices[resource] || getBasePrice(resource);
    
    // 累加篮子成本
    currentBasketCost += currentPrice * weight;
    baseBasketCost += basePrice * weight;
    
    // 计算该资源对CPI的贡献
    const priceChange = basePrice > 0 ? ((currentPrice / basePrice) - 1) * 100 : 0;
    const contribution = priceChange * weight;
    
    breakdown[resource] = {
      weight,
      currentPrice,
      basePrice,
      priceChange,
      contribution,
    };
  });
  
  // CPI指数
  const index = baseBasketCost > 0 ? (currentBasketCost / baseBasketCost) * 100 : 100;
  
  // 变化率
  const change = previousCPI > 0 ? ((index - previousCPI) / previousCPI) * 100 : 0;
  
  return {
    index,
    change,
    breakdown,
  };
}

// ==================== PPI 计算 ====================

/**
 * 计算PPI（生产者物价指数）
 * 使用长期均衡价格作为基准
 * 
 * @param {Object} params
 * @param {Object} params.marketPrices - 当前市场价格
 * @param {Object} params.equilibriumPrices - 长期均衡价格（基准）
 * @param {number} params.previousPPI - 上期PPI（用于计算变化率）
 * @returns {Object} PPI数据
 */
export function calculatePPI({
  marketPrices = {},
  equilibriumPrices = {},
  previousPPI = 100,
}) {
  const basket = ECONOMIC_INDICATOR_CONFIG.ppiBasket;
  
  let currentBasketCost = 0;
  let baseBasketCost = 0;
  const breakdown = {};
  
  Object.entries(basket).forEach(([resource, weight]) => {
    const currentPrice = marketPrices[resource] || equilibriumPrices[resource] || getBasePrice(resource);
    const basePrice = equilibriumPrices[resource] || getBasePrice(resource);
    
    // 累加篮子成本
    currentBasketCost += currentPrice * weight;
    baseBasketCost += basePrice * weight;
    
    // 计算该资源对PPI的贡献
    const priceChange = basePrice > 0 ? ((currentPrice / basePrice) - 1) * 100 : 0;
    const contribution = priceChange * weight;
    
    breakdown[resource] = {
      weight,
      currentPrice,
      basePrice,
      priceChange,
      contribution,
    };
  });
  
  // PPI指数
  const index = baseBasketCost > 0 ? (currentBasketCost / baseBasketCost) * 100 : 100;
  
  // 变化率
  const change = previousPPI > 0 ? ((index - previousPPI) / previousPPI) * 100 : 0;
  
  return {
    index,
    change,
    breakdown,
  };
}

// ==================== 综合计算 ====================

/**
 * 计算所有经济指标
 * @param {Object} params - 包含所有必要数据的参数对象
 * @returns {Object} 所有经济指标
 */
export function calculateAllIndicators(params) {
  const {
    priceHistory,
    equilibriumPrices,
    previousIndicators = {},
  } = params;
  
  return {
    gdp: calculateGDP({
      ...params,
      previousGDP: previousIndicators.gdp?.total || 0,
    }),
    cpi: calculateCPI({
      marketPrices: params.marketPrices,
      equilibriumPrices,
      previousCPI: previousIndicators.cpi?.index || 100,
    }),
    ppi: calculatePPI({
      marketPrices: params.marketPrices,
      equilibriumPrices,
      previousPPI: previousIndicators.ppi?.index || 100,
    }),
  };
}
