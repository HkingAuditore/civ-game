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
  
  // 阶层分类（用于分层CPI计算）
  strataTiers: {
    lower: ['peasant', 'lumberjack', 'serf', 'worker', 'unemployed', 'miner'],
    middle: ['artisan', 'merchant', 'scribe', 'navigator'],
    upper: ['landowner', 'capitalist', 'official', 'knight', 'engineer', 'cleric'],
  },
  
  // 消费者篮子权重（基于实际游戏资源）
  // 注意：这是后备篮子，优先使用动态计算的篮子
  cpiBasket: {
    food: 0.40,        // 粮食 - 基础必需品
    cloth: 0.20,       // 布料 - 基础必需品
    furniture: 0.15,   // 家具 - 奢侈品
    ale: 0.10,         // 美酒 - 奢侈品
    delicacies: 0.10,  // 珍馐 - 奢侈品
    spice: 0.05,       // 香料 - 奢侈品
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
 * @param {number} params.dailyInvestment - 当日投资额（从ledger统计）
 * @param {number} params.dailyOwnerRevenue - 当日建筑产出收入（从ledger统计，用于存货变动）
 * @param {number} params.dailyMilitaryExpense - 每日军费
 * @param {Array} params.officials - 官员列表
 * @param {Object} params.taxBreakdown - 税收分解
 * @param {Object} params.demandBreakdown - 需求分解（用于出口统计）
 * @param {Object} params.supplyBreakdown - 供给分解（用于进口统计）
 * @param {Object} params.marketPrices - 市场价格
 * @returns {Object} GDP数据
 */
export function calculateGDP({
  classFinancialData = {},
  dailyInvestment = 0,  // 新增：从ledger获取
  dailyOwnerRevenue = 0,  // 新增：建筑产出收入（用于存货变动）
  dailyMilitaryExpense = 0,
  officials = [],
  taxBreakdown = {},
  demandBreakdown = {},
  supplyBreakdown = {},  // 新增：用于进口统计
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
  // 投资 = 固定资产投资 + 存货变动
  // - 固定资产投资：建筑建造和升级成本（从ledger统计）
  // - 存货变动：建筑产出收入 - 居民消费
  //   （建筑生产的产品进入市场，如果没被消费，就是存货增加）
  const fixedInvestment = Number.isFinite(dailyInvestment) ? dailyInvestment : 0;
  const inventoryChange = (Number.isFinite(dailyOwnerRevenue) ? dailyOwnerRevenue : 0) - consumption;
  const investment = fixedInvestment + inventoryChange;  
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
  // 出口数据从demandBreakdown获取（需求侧：资源被出口消耗）
  // 进口数据从supplyBreakdown获取（供给侧：资源通过进口增加）
  
  // [DEBUG] 输出breakdown结构
  console.group('🌍 [NET EXPORTS DEBUG]');
  console.log('📦 demandBreakdown keys:', Object.keys(demandBreakdown || {}));
  console.log('📦 demandBreakdown sample:', Object.entries(demandBreakdown || {}).slice(0, 3).map(([k, v]) => ({
    resource: k,
    data: v,
  })));
  console.log('📦 supplyBreakdown keys:', Object.keys(supplyBreakdown || {}));
  console.log('📦 supplyBreakdown sample:', Object.entries(supplyBreakdown || {}).slice(0, 3).map(([k, v]) => ({
    resource: k,
    data: v,
  })));
  
  let exports = 0;
  let imports = 0;
  
  // 计算出口（从demandBreakdown）
  if (demandBreakdown && typeof demandBreakdown === 'object') {
    Object.entries(demandBreakdown).forEach(([resource, data]) => {
      if (data && typeof data === 'object' && Number.isFinite(data.exports)) {
        const price = marketPrices[resource] || 0;
        const value = data.exports * price;
        exports += Number.isFinite(value) ? value : 0;
      }
    });
  }
  
  // 计算进口（从supplyBreakdown）
  if (supplyBreakdown && typeof supplyBreakdown === 'object') {
    Object.entries(supplyBreakdown).forEach(([resource, data]) => {
      if (data && typeof data === 'object' && Number.isFinite(data.imports)) {
        const price = marketPrices[resource] || 0;
        const value = data.imports * price;
        imports += Number.isFinite(value) ? value : 0;
      }
    });
  }
  
  const netExports = exports - imports;
  
  console.log('✅ Net Exports Result:', { exports, imports, netExports });
  console.groupEnd();
  
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
      fixedInvestment,      // 固定资产投资
      inventoryChange,      // 存货变动
      government,
      netExports,
      exports,
      imports,
    },
  };
}

// ==================== 动态CPI篮子计算 ====================

/**
 * 从实际消费数据中提取CPI篮子权重
 * @param {Object} classFinancialData - 阶层财务数据
 * @param {Array<string>} strataList - 要包含的阶层列表
 * @returns {Object} 篮子权重 {resource: weight}
 */
function extractConsumptionBasket(classFinancialData, strataList) {
  const resourceConsumption = {}; // {resource: totalCost}
  let totalConsumption = 0;
  
  // 遍历指定的阶层
  strataList.forEach(strataKey => {
    const classData = classFinancialData[strataKey];
    if (!classData || !classData.expense) return;
    
    // 提取必需品消费
    const essentialNeeds = classData.expense.essentialNeeds || {};
    Object.entries(essentialNeeds).forEach(([resource, data]) => {
      const cost = data.cost || data.totalCost || 0;
      if (Number.isFinite(cost) && cost > 0) {
        resourceConsumption[resource] = (resourceConsumption[resource] || 0) + cost;
        totalConsumption += cost;
      }
    });
    
    // 提取奢侈品消费
    const luxuryNeeds = classData.expense.luxuryNeeds || {};
    Object.entries(luxuryNeeds).forEach(([resource, data]) => {
      const cost = data.cost || data.totalCost || 0;
      if (Number.isFinite(cost) && cost > 0) {
        resourceConsumption[resource] = (resourceConsumption[resource] || 0) + cost;
        totalConsumption += cost;
      }
    });
  });
  
  // 计算权重
  const basket = {};
  if (totalConsumption > 0) {
    Object.entries(resourceConsumption).forEach(([resource, cost]) => {
      basket[resource] = cost / totalConsumption;
    });
  }
  
  return basket;
}

/**
 * 计算分层CPI篮子
 * @param {Object} classFinancialData - 阶层财务数据
 * @returns {Object} 分层篮子 {lower: {}, middle: {}, upper: {}, overall: {}}
 */
export function calculateDynamicCPIBaskets(classFinancialData) {
  const { strataTiers } = ECONOMIC_INDICATOR_CONFIG;
  
  return {
    lower: extractConsumptionBasket(classFinancialData, strataTiers.lower),
    middle: extractConsumptionBasket(classFinancialData, strataTiers.middle),
    upper: extractConsumptionBasket(classFinancialData, strataTiers.upper),
    overall: extractConsumptionBasket(classFinancialData, [
      ...strataTiers.lower,
      ...strataTiers.middle,
      ...strataTiers.upper,
    ]),
  };
}

// ==================== 动态PPI篮子计算 ====================

/**
 * 从实际生产数据中提取PPI篮子权重（使用滚动平均）
 * @param {Array<Object>} supplyBreakdownHistory - 生产数据历史 [{resource: {buildings: {}, imports: 0}}, ...]
 * @param {Object} marketPrices - 市场价格
 * @param {Object} equilibriumPrices - 均衡价格
 * @param {number} window - 滚动窗口天数（默认30天）
 * @returns {Object} 篮子权重 {resource: weight}
 */
export function calculateDynamicPPIBasket({
  supplyBreakdownHistory = [],
  marketPrices = {},
  equilibriumPrices = {},
  window = 30,
}) {
  // 如果历史数据不足，返回空篮子（将使用默认篮子）
  if (!supplyBreakdownHistory || supplyBreakdownHistory.length === 0) {
    return {};
  }
  
  // 使用最近window天的数据
  const recentHistory = supplyBreakdownHistory.slice(-window);
  const avgProduction = {}; // {resource: avgQuantity}
  
  // 计算平均生产量
  recentHistory.forEach(dayData => {
    if (!dayData || typeof dayData !== 'object') return;
    
    Object.entries(dayData).forEach(([resource, data]) => {
      if (!data || typeof data !== 'object') return;
      
      // 统计建筑生产量
      const buildings = data.buildings || {};
      const totalProduction = Object.values(buildings).reduce((sum, amt) => {
        return sum + (Number.isFinite(amt) ? amt : 0);
      }, 0);
      
      if (totalProduction > 0) {
        avgProduction[resource] = (avgProduction[resource] || 0) + totalProduction / recentHistory.length;
      }
    });
  });
  
  // 计算每种资源的生产价值
  const productionValues = {}; // {resource: value}
  let totalValue = 0;
  
  Object.entries(avgProduction).forEach(([resource, quantity]) => {
    // 只统计有价格的生产性资源
    const price = marketPrices[resource] || equilibriumPrices[resource] || getBasePrice(resource);
    
    // 排除非资源项（如maxPop等）
    if (price > 0 && RESOURCES[resource]) {
      const value = quantity * price;
      productionValues[resource] = value;
      totalValue += value;
    }
  });
  
  // 计算权重
  const basket = {};
  if (totalValue > 0) {
    Object.entries(productionValues).forEach(([resource, value]) => {
      basket[resource] = value / totalValue;
    });
  }
  
  return basket;
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
 * @param {Object} params.basket - CPI篮子权重（可选，默认使用配置中的篮子）
 * @returns {Object} CPI数据
 */
export function calculateCPI({
  marketPrices = {},
  equilibriumPrices = {},
  previousCPI = 100,
  basket = null,
}) {
  // 使用传入的篮子，或使用配置中的默认篮子
  const cpiBasket = basket || ECONOMIC_INDICATOR_CONFIG.cpiBasket;
  
  let currentBasketCost = 0;
  let baseBasketCost = 0;
  const breakdown = {};
  
  Object.entries(cpiBasket).forEach(([resource, weight]) => {
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
 * @param {Object} params.basket - PPI篮子权重（可选，默认使用配置中的篮子）
 * @returns {Object} PPI数据
 */
export function calculatePPI({
  marketPrices = {},
  equilibriumPrices = {},
  previousPPI = 100,
  basket = null,
}) {
  // 使用传入的篮子，或使用配置中的默认篮子
  const ppiBasket = basket || ECONOMIC_INDICATOR_CONFIG.ppiBasket;
  
  let currentBasketCost = 0;
  let baseBasketCost = 0;
  const breakdown = {};
  
  Object.entries(ppiBasket).forEach(([resource, weight]) => {
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
    classFinancialData = {},
    supplyBreakdownHistory = [], // 新增：生产数据历史
  } = params;
  
  // 计算动态CPI篮子
  const dynamicBaskets = calculateDynamicCPIBaskets(classFinancialData);
  
  // 计算动态PPI篮子
  const dynamicPPIBasket = calculateDynamicPPIBasket({
    supplyBreakdownHistory,
    marketPrices: params.marketPrices,
    equilibriumPrices,
    window: 30, // 使用30天滚动平均
  });
  
  // 计算GDP
  const gdp = calculateGDP({
    ...params,
    previousGDP: previousIndicators.gdp?.total || 0,
  });
  
  // 计算综合CPI（使用动态篮子）
  const cpi = calculateCPI({
    marketPrices: params.marketPrices,
    equilibriumPrices,
    previousCPI: previousIndicators.cpi?.index || 100,
    basket: Object.keys(dynamicBaskets.overall).length > 0 ? dynamicBaskets.overall : null,
  });
  
  // 计算分层CPI
  const cpiByTier = {
    lower: calculateCPI({
      marketPrices: params.marketPrices,
      equilibriumPrices,
      previousCPI: previousIndicators.cpiByTier?.lower?.index || 100,
      basket: Object.keys(dynamicBaskets.lower).length > 0 ? dynamicBaskets.lower : null,
    }),
    middle: calculateCPI({
      marketPrices: params.marketPrices,
      equilibriumPrices,
      previousCPI: previousIndicators.cpiByTier?.middle?.index || 100,
      basket: Object.keys(dynamicBaskets.middle).length > 0 ? dynamicBaskets.middle : null,
    }),
    upper: calculateCPI({
      marketPrices: params.marketPrices,
      equilibriumPrices,
      previousCPI: previousIndicators.cpiByTier?.upper?.index || 100,
      basket: Object.keys(dynamicBaskets.upper).length > 0 ? dynamicBaskets.upper : null,
    }),
  };
  
  // 计算PPI（使用动态篮子）
  const ppi = calculatePPI({
    marketPrices: params.marketPrices,
    equilibriumPrices,
    previousPPI: previousIndicators.ppi?.index || 100,
    basket: Object.keys(dynamicPPIBasket).length > 0 ? dynamicPPIBasket : null,
  });
  
  // [DEBUG] 输出分层CPI数据
  console.group('📊 [CPI BY TIER DEBUG]');
  console.log('🔵 Lower CPI:', cpiByTier.lower);
  console.log('🟢 Middle CPI:', cpiByTier.middle);
  console.log('🟣 Upper CPI:', cpiByTier.upper);
  console.log('📦 Dynamic Baskets:', dynamicBaskets);
  console.groupEnd();
  
  // [DEBUG] 输出动态PPI篮子
  console.group('🏭 [DYNAMIC PPI BASKET DEBUG]');
  console.log('📦 Dynamic PPI Basket:', dynamicPPIBasket);
  console.log('📊 PPI Result:', ppi);
  console.groupEnd();
  
  return {
    gdp,
    cpi,
    cpiByTier,
    ppi,
    dynamicBaskets, // 返回动态篮子供调试使用
    dynamicPPIBasket, // 返回动态PPI篮子供调试使用
  };
}
