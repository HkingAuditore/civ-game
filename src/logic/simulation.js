import { BUILDINGS, STRATA, EPOCHS, RESOURCES, TECHS } from '../config';
import { calculateArmyPopulation, calculateArmyFoodNeed } from '../config';
import { isResourceUnlocked } from '../utils/resources';
import { calculateForeignPrice } from '../utils/foreignTrade';

const ROLE_PRIORITY = [
  'official',
  'cleric',
  'capitalist',
  'landowner',
  'knight',
  'engineer',
  'navigator',
  'merchant',
  'soldier',
  'scribe',
  'worker',
  'artisan',
  'miner',
  'lumberjack',
  'serf',
  'peasant',
];

const JOB_MIGRATION_RATIO = 0.04;


const SPECIAL_TRADE_RESOURCES = new Set(['science', 'culture']);
const isTradableResource = (key) => {
  if (key === 'silver') return false;
  const def = RESOURCES[key];
  if (!def) return false;
  if (SPECIAL_TRADE_RESOURCES.has(key)) return true;
  return !def.type || def.type !== 'virtual';
};

const initializeWealth = (currentWealth = {}) => {
  const wealth = { ...currentWealth };
  Object.keys(STRATA).forEach((key) => {
    if (wealth[key] === undefined) {
      wealth[key] = STRATA[key]?.startingWealth || 0;
    }
  });
  return wealth;
};

const getBasePrice = (resource) => {
  if (resource === 'silver') return 1;
  const def = RESOURCES[resource];
  return def?.basePrice || 1;
};

const PRICE_FLOOR = 0.5;
const BASE_WAGE_REFERENCE = 1;

const calculateResourceCost = (
  resourceKey,
  buildingsConfig = BUILDINGS,
  currentPrices = {},
  currentWages = {}
) => {
  const resolvePrice = (key) => {
    const current = currentPrices?.[key];
    if (Number.isFinite(current) && current > 0) {
      return Math.max(PRICE_FLOOR, current);
    }
    const base = RESOURCES[key]?.basePrice;
    if (Number.isFinite(base) && base > 0) {
      return Math.max(PRICE_FLOOR, base);
    }
    return PRICE_FLOOR;
  };

  const wageValues = Object.values(currentWages || {}).filter(value => Number.isFinite(value) && value > 0);
  const avgWage = wageValues.length > 0
    ? wageValues.reduce((sum, value) => sum + value, 0) / wageValues.length
    : BASE_WAGE_REFERENCE;

  const resolveWage = (role) => {
    const wage = currentWages?.[role];
    if (Number.isFinite(wage) && wage > 0) {
      return wage;
    }
    return avgWage;
  };

  let primaryBuilding = null;
  buildingsConfig.forEach(building => {
    const outputAmount = building.output?.[resourceKey];
    if (!outputAmount || outputAmount <= 0) return;
    if (!primaryBuilding) {
      primaryBuilding = building;
      return;
    }
    const bestOutput = primaryBuilding.output?.[resourceKey] || 0;
    if (outputAmount > bestOutput) {
      primaryBuilding = building;
    }
  });

  if (primaryBuilding) {
    const totalOutput = primaryBuilding.output?.[resourceKey] || 0;
    if (totalOutput > 0) {
      let inputCost = 0;
      if (primaryBuilding.input) {
        Object.entries(primaryBuilding.input).forEach(([inputKey, amount]) => {
          if (!amount || amount <= 0) return;
          inputCost += amount * resolvePrice(inputKey);
        });
      }

      let laborCost = 0;
      if (primaryBuilding.jobs) {
        Object.entries(primaryBuilding.jobs).forEach(([role, slots]) => {
          if (!slots || slots <= 0) return;
          laborCost += slots * resolveWage(role);
        });
      }

      const unitCost = (inputCost + laborCost) / totalOutput;
      if (Number.isFinite(unitCost) && unitCost > 0) {
        return unitCost;
      }
    }
  }

  const basePrice = getBasePrice(resourceKey);
  const wageInflationFactor = Math.max(0.5, avgWage / BASE_WAGE_REFERENCE);
  return Math.max(PRICE_FLOOR, basePrice * wageInflationFactor);
};

const TECH_MAP = TECHS.reduce((acc, tech) => {
  acc[tech.id] = tech;
  return acc;
}, {});

const scaleEffectValues = (effect = {}, multiplier = 1) => {
  if (!effect || typeof effect !== 'object') return {};
  const scaled = {};
  Object.entries(effect).forEach(([key, value]) => {
    if (typeof value === 'number') {
      scaled[key] = value * multiplier;
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      scaled[key] = scaleEffectValues(value, multiplier);
    } else {
      scaled[key] = value;
    }
  });
  return scaled;
};

const MERCHANT_SAFE_STOCK = 200;
const MERCHANT_CAPACITY_PER_POP = 5;
const MERCHANT_CAPACITY_WEALTH_DIVISOR = 100;
const MERCHANT_LOG_VOLUME_RATIO = 0.05;
const MERCHANT_LOG_PROFIT_THRESHOLD = 50;

const simulateMerchantTrade = ({
  res,
  wealth,
  popStructure,
  supply,
  demand,
  nations,
  tick,
  taxPolicies,
  taxBreakdown,
  getLocalPrice,
  roleExpense,
  roleWagePayout,
  pendingTrades = [],
  lastTradeTime = 0,
}) => {
  const merchantCount = popStructure?.merchant || 0;
  if (merchantCount <= 0) {
    return;
  }

  const resourceTaxRates = taxPolicies?.resourceTaxRates || {};
  const getResourceTaxRate = (resource) => Math.max(0, resourceTaxRates[resource] || 0);

  const foreignPartners = Array.isArray(nations) ? nations.filter(n => n && (n.inventory || n.economyTraits)) : [];
  const foreignPriceCache = {};

  const getForeignPrice = (resourceKey) => {
      if (foreignPriceCache[resourceKey] !== undefined) {
          return foreignPriceCache[resourceKey];
      }
      if (foreignPartners.length === 0) {
          foreignPriceCache[resourceKey] = null;
          return null;
      }
      let total = 0;
      let count = 0;
      foreignPartners.forEach(nation => {
          const price = calculateForeignPrice(resourceKey, nation, tick);
          if (Number.isFinite(price) && price > 0) {
              total += price;
              count += 1;
          }
      });
      const averaged = count > 0 ? total / count : null;
      foreignPriceCache[resourceKey] = averaged;
      return averaged;
  };

  // 获取商人交易配置
  const tradeConfig = STRATA.merchant?.tradeConfig || {
    minProfitMargin: 0.10,
    maxPurchaseAmount: 20,
    exportProbability: 0.5,
    maxInventoryRatio: 0.3,
    minWealthForTrade: 10,
    tradeDuration: 3,
    tradeCooldown: 0,
    enableDebugLog: false
  };

  // 处理待完成的交易（到期的交易）
  const updatedPendingTrades = [];
  pendingTrades.forEach(trade => {
    trade.daysRemaining -= 1;
    
    if (trade.daysRemaining <= 0) {
      // 交易完成，获得收入
      roleWagePayout.merchant = (roleWagePayout.merchant || 0) + trade.revenue;
      
      if (trade.type === 'import') {
        // 进口商品到货
        res[trade.resource] = (res[trade.resource] || 0) + trade.amount;
        supply[trade.resource] = (supply[trade.resource] || 0) + trade.amount;
      }
      
      if (tradeConfig.enableDebugLog) {
        console.log(`[商人调试] ✅ 交易完成:`, {
          type: trade.type === 'export' ? '出口' : '进口',
          resource: trade.resource,
          amount: trade.amount,
          revenue: trade.revenue,
          profit: trade.profit
        });
      }
    } else {
      // 交易尚未完成，继续等待
      updatedPendingTrades.push(trade);
    }
  });

  // 调试：查看输入的交易状态
  if (tradeConfig.enableDebugLog) {
    console.log(`[商人调试] 📥 输入状态:`, {
      tick,
      lastTradeTime,
      pendingTradesCount: pendingTrades.length,
      updatedPendingTradesCount: updatedPendingTrades.length,
      merchantCount: popStructure.merchant || 0
    });
  }
  
  // 检查交易冷却时间
  const ticksSinceLastTrade = tick - lastTradeTime;
  const canTradeNow = ticksSinceLastTrade >= tradeConfig.tradeCooldown;
  
  if (!canTradeNow) {
    if (tradeConfig.enableDebugLog) {
      console.log(`[商人调试] ⏳ 交易冷却中，还需等待 ${tradeConfig.tradeCooldown - ticksSinceLastTrade} ticks`);
    }
    return { pendingTrades: updatedPendingTrades, lastTradeTime };
  }

  const tradableKeys = Object.keys(RESOURCES).filter(key => isTradableResource(key));
  
  // 基于价格差异识别可交易资源
  const exportableResources = []; // 外部价格 > 内部价格
  const importableResources = []; // 外部价格 < 内部价格
  
  tradableKeys.forEach(key => {
    const localPrice = getLocalPrice(key);
    const foreignPrice = getForeignPrice(key);
    const availableStock = res[key] || 0;
    
    if (foreignPrice === null || localPrice === null) return;
    
    const priceDiff = foreignPrice - localPrice;
    const profitMargin = Math.abs(priceDiff) / localPrice;
    
    // 判断是否可出口（外部价格高于内部）
    const isExportable = foreignPrice > localPrice && 
                         profitMargin >= tradeConfig.minProfitMargin &&
                         availableStock > 0;
    
    // 判断是否可进口（外部价格低于内部）
    const isImportable = foreignPrice < localPrice && 
                         profitMargin >= tradeConfig.minProfitMargin;
    
    // if (tradeConfig.enableDebugLog && key === 'cloth') {
    //   console.log(`[商人调试] 布料信息:`, {
    //     supply: supply[key] || 0,
    //     demand: demand[key] || 0,
    //     availableStock,
    //     localPrice,
    //     foreignPrice,
    //     priceDiff,
    //     profitMargin: (profitMargin * 100).toFixed(2) + '%',
    //     isExportable,
    //     isImportable
    //   });
    // }
    
    if (isExportable) exportableResources.push(key);
    if (isImportable) importableResources.push(key);
  });

  const simCount = merchantCount > 100 ? 100 : merchantCount;
  const batchMultiplier = merchantCount > 100 ? merchantCount / 100 : 1;

  for (let i = 0; i < simCount; i++) {
      const currentTotalWealth = wealth.merchant || 0;
      if (currentTotalWealth <= tradeConfig.minWealthForTrade) break;

      const decision = Math.random();

      // Approximate the wealth of the merchant(s) in the current simulated batch
      const wealthForThisBatch = currentTotalWealth / (simCount - i);

      if (decision < tradeConfig.exportProbability && exportableResources.length > 0) { // Export
          const resourceKey = exportableResources[Math.floor(Math.random() * exportableResources.length)];
          const localPrice = getLocalPrice(resourceKey);
          const foreignPrice = getForeignPrice(resourceKey);

          if (foreignPrice === null || localPrice === null || foreignPrice <= localPrice) continue;

          const taxRate = getResourceTaxRate(resourceKey);
          const costWithTaxPerUnit = localPrice * (1 + taxRate);
          
          const affordableAmount = costWithTaxPerUnit > 0 ? wealthForThisBatch / costWithTaxPerUnit : 3;
          const availableStock = (res[resourceKey] || 0) / batchMultiplier;
          const maxInventory = availableStock * tradeConfig.maxInventoryRatio;
          
          const amount = Math.min(
            tradeConfig.maxPurchaseAmount, 
            affordableAmount, 
            maxInventory
          );
          
          if (amount <= 0) continue;

          const cost = localPrice * amount;
          const tax = cost * taxRate;
          const revenue = foreignPrice * amount;
          const profit = revenue - cost - tax;
          const profitMargin = profit / (cost + tax);

          if (profitMargin >= tradeConfig.minProfitMargin) {
              const totalAmount = amount * batchMultiplier;
              const totalCost = cost * batchMultiplier;
              const totalTax = tax * batchMultiplier;
              const totalRevenue = revenue * batchMultiplier;
              
              const totalOutlay = totalCost + totalTax;
              
              if ((wealth.merchant || 0) >= totalOutlay && (res[resourceKey] || 0) >= totalAmount) {
                  if (tradeConfig.enableDebugLog && resourceKey === 'cloth') {
                    console.log(`[商人调试] 📦 购买布料准备出口:`, {
                      amount: totalAmount,
                      cost: totalCost,
                      tax: totalTax,
                      expectedRevenue: totalRevenue,
                      expectedProfit: totalRevenue - totalOutlay,
                      profitMargin: (profitMargin * 100).toFixed(2) + '%',
                      daysUntilSale: tradeConfig.tradeDuration
                    });
                  }
                  
                  // 立即支付成本和税费
                  wealth.merchant -= totalOutlay;
                  roleExpense.merchant = (roleExpense.merchant || 0) + totalOutlay;
                  taxBreakdown.industryTax += totalTax;
                  
                  // 出口商品：立即扣除库存
                  res[resourceKey] = Math.max(0, (res[resourceKey] || 0) - totalAmount);
                  supply[resourceKey] = Math.max(0, (supply[resourceKey] || 0) - totalAmount);
                  
                  // 添加到待完成交易列表
                  updatedPendingTrades.push({
                    type: 'export',
                    resource: resourceKey,
                    amount: totalAmount,
                    revenue: totalRevenue,
                    profit: totalRevenue - totalOutlay,
                    daysRemaining: tradeConfig.tradeDuration
                  });
                  
                  // 更新最后交易时间
                  lastTradeTime = tick;
              }
          }
      } else if (importableResources.length > 0) { // Import
          const resourceKey = importableResources[Math.floor(Math.random() * importableResources.length)];
          const localPrice = getLocalPrice(resourceKey);
          const foreignPrice = getForeignPrice(resourceKey);

          if (foreignPrice === null || localPrice === null || foreignPrice >= localPrice) continue;
          
          const taxRate = getResourceTaxRate(resourceKey);
          const totalPerUnitCost = foreignPrice + (localPrice * taxRate);
          const affordableAmount = totalPerUnitCost > 0 ? wealthForThisBatch / totalPerUnitCost : 3;
          const amount = Math.min(tradeConfig.maxPurchaseAmount, affordableAmount);
          if (amount <= 0) continue;

          const cost = foreignPrice * amount;
          const revenue = localPrice * amount;
          const tax = revenue * taxRate;
          const profit = revenue - cost - tax;
          const profitMargin = profit / (cost + tax);

          if (profitMargin >= tradeConfig.minProfitMargin) {
              const totalAmount = amount * batchMultiplier;
              const totalCost = cost * batchMultiplier;
              const totalTax = tax * batchMultiplier;
              const totalRevenue = revenue * batchMultiplier;
              const totalOutlay = totalCost + totalTax;
              
              if ((wealth.merchant || 0) >= totalOutlay) {
                  if (tradeConfig.enableDebugLog && resourceKey === 'cloth') {
                    console.log(`[商人调试] 📦 购买布料准备进口:`, {
                      amount: totalAmount,
                      cost: totalCost,
                      tax: totalTax,
                      expectedRevenue: totalRevenue,
                      expectedProfit: totalRevenue - totalOutlay,
                      profitMargin: (profitMargin * 100).toFixed(2) + '%',
                      daysUntilSale: tradeConfig.tradeDuration
                    });
                  }
                  
                  // 立即支付成本和税费
                  wealth.merchant -= totalOutlay;
                  roleExpense.merchant = (roleExpense.merchant || 0) + totalOutlay;
                  taxBreakdown.industryTax += totalTax;
                  
                  // 添加到待完成交易列表（进口商品等待到货后才能卖出）
                  updatedPendingTrades.push({
                    type: 'import',
                    resource: resourceKey,
                    amount: totalAmount,
                    revenue: totalRevenue,
                    profit: totalRevenue - totalOutlay,
                    daysRemaining: tradeConfig.tradeDuration
                  });
                  
                  // 更新最后交易时间
                  lastTradeTime = tick;
              }
          }
      }
  }
  
  
  
  // 调试：查看输出的交易状态
  if (tradeConfig.enableDebugLog) {
    console.log(`[商人调试] 📤 输出状态:`, {
      pendingTradesCount: updatedPendingTrades.length,
      lastTradeTime: lastTradeTime,
      pendingTrades: updatedPendingTrades.map(t => ({
        type: t.type,
        resource: t.resource,
        amount: t.amount,
        daysRemaining: t.daysRemaining
      }))
    });
  }
  
  return {
    pendingTrades: updatedPendingTrades,
    lastTradeTime: lastTradeTime
  };
};

export const simulateTick = ({
  resources,
  buildings,
  population,
  popStructure: previousPopStructure = {},
  decrees,
  gameSpeed,
  epoch,
  market,
  classWealth,
  classApproval: previousApproval = {},
  activeBuffs: productionBuffs = [],
  activeDebuffs: productionDebuffs = [],
  taxPolicies,
  army = {},
  militaryWageRatio = 1,
  nations = [],
  tick = 0,
  techsUnlocked = [],
  activeFestivalEffects = [],
  classWealthHistory,
  classNeedsHistory,
  merchantState = { pendingTrades: [], lastTradeTime: 0 },
}) => {
  const res = { ...resources };
  const priceMap = { ...(market?.prices || {}) };
  const previousWages = market?.wages || {};
  const previousWageValues = Object.values(previousWages).filter(value => Number.isFinite(value) && value > 0);
  const defaultWageEstimate = previousWageValues.length > 0
    ? previousWageValues.reduce((sum, value) => sum + value, 0) / previousWageValues.length
    : BASE_WAGE_REFERENCE;
  const getExpectedWage = (role) => {
    const prev = previousWages?.[role];
    if (Number.isFinite(prev) && prev > 0) {
      return Math.max(PRICE_FLOOR, prev);
    }
    const starting = STRATA[role]?.startingWealth;
    if (Number.isFinite(starting) && starting > 0) {
      return Math.max(BASE_WAGE_REFERENCE * 0.5, starting / 40);
    }
    return defaultWageEstimate;
  };
  const demand = {};
  const supply = {};
  const wealth = initializeWealth(classWealth);
  const policies = taxPolicies || {};
  const headTaxRates = policies.headTaxRates || {};
  const resourceTaxRates = policies.resourceTaxRates || {};
  const getHeadTaxRate = (key) => {
    const rate = headTaxRates[key];
    if (typeof rate === 'number') {
      return rate;
    }
    return 1;
  };
  const getResourceTaxRate = (resource) => {
    const rate = resourceTaxRates[resource];
    if (typeof rate === 'number') return Math.max(0, rate);
    return 0;
  };
  const taxBreakdown = {
    headTax: 0,
    industryTax: 0,
    subsidy: 0,
  };

  const buildingBonuses = {};
  const categoryBonuses = { gather: 1, industry: 1, civic: 1, military: 1 };
  const passiveGains = {};
  let extraMaxPop = 0;
  let maxPopPercent = 0;
  let extraAdminCapacity = 0;
  let productionBonus = 0;
  let industryBonus = 0;
  let taxBonus = 0;
  let needsReduction = 0;

  const boostBuilding = (id, percent) => {
    if (!id || typeof percent !== 'number') return;
    const factor = 1 + percent;
    if (!Number.isFinite(factor) || factor <= 0) return;
    buildingBonuses[id] = (buildingBonuses[id] || 1) * factor;
  };

  const boostCategory = (category, percent) => {
    if (!category || typeof percent !== 'number') return;
    const factor = 1 + percent;
    if (!Number.isFinite(factor) || factor <= 0) return;
    categoryBonuses[category] = (categoryBonuses[category] || 1) * factor;
  };

  const addPassiveGain = (resource, amount) => {
    if (!resource || typeof amount !== 'number') return;
    passiveGains[resource] = (passiveGains[resource] || 0) + amount;
  };

  const applyEffects = (effects = {}) => {
    if (!effects) return;
    if (effects.buildings) {
      Object.entries(effects.buildings).forEach(([id, percent]) => boostBuilding(id, percent));
    }
    if (effects.categories) {
      Object.entries(effects.categories).forEach(([cat, percent]) => boostCategory(cat, percent));
    }
    if (effects.passive) {
      Object.entries(effects.passive).forEach(([resKey, amount]) => addPassiveGain(resKey, amount));
    }
    if (effects.maxPop) {
      const value = effects.maxPop;
      if (value > -1 && value < 1 && value !== 0) {
        maxPopPercent += value;
      } else {
        extraMaxPop += value;
      }
    }
    if (effects.admin) {
      extraAdminCapacity += effects.admin;
    }
    if (effects.production) {
      productionBonus += effects.production;
    }
    if (effects.industry) {
      industryBonus += effects.industry;
    }
    if (effects.taxIncome) {
      taxBonus += effects.taxIncome;
    }
    if (effects.needsReduction) {
      needsReduction += effects.needsReduction;
    }
  };

  techsUnlocked.forEach(id => {
    const tech = TECH_MAP[id];
    if (!tech || !tech.effects) return;
    applyEffects(tech.effects);
  });

  decrees.forEach(decree => {
    if (!decree || !decree.active || !decree.modifiers) return;
    applyEffects(decree.modifiers);
  });

  // 应用庆典效果
  activeFestivalEffects.forEach(festivalEffect => {
    if (!festivalEffect || !festivalEffect.effects) return;
    applyEffects(festivalEffect.effects);
  });

  // Smooth price pressure with a bounded sigmoid curve to avoid runaway inflation/deflation
  const computePriceMultiplier = (ratio) => {
    if (!Number.isFinite(ratio) || ratio <= 0) {
      return 0.7;
    }
    const minMultiplier = 0.7;
    const maxMultiplier = 3.5;
    const safeRatio = Math.max(ratio, 0.01);
    const smoothness = 0.9;
    const pressure = Math.tanh(Math.log(safeRatio) * smoothness);
    if (pressure >= 0) {
      return 1 + pressure * (maxMultiplier - 1);
    }
    return 1 + pressure * (1 - minMultiplier);
  };

  const getPrice = (resource) => {
    if (!priceMap[resource]) {
      priceMap[resource] = getBasePrice(resource);
    }
    priceMap[resource] = Math.max(PRICE_FLOOR, priceMap[resource]);
    return priceMap[resource];
  };

  const sellProduction = (resource, amount, ownerKey) => {
    if (amount <= 0) return;
    res[resource] = (res[resource] || 0) + amount;
    if (isTradableResource(resource)) {
      supply[resource] = (supply[resource] || 0) + amount;
      const price = getPrice(resource);
      const income = price * amount;
      // 记录owner的销售收入（在tick结束时统一结算到wealth）
      roleWagePayout[ownerKey] = (roleWagePayout[ownerKey] || 0) + income;
    }
  };

  const rates = {};
  const builds = buildings;
  const producedResources = new Set();
  const jobsAvailable = {};
  const roleWageStats = {};
  const roleWagePayout = {};
  const directIncomeApplied = {};
  let totalMaxPop = 5;
  let adminCapacity = 20;
  totalMaxPop += extraMaxPop;
  adminCapacity += extraAdminCapacity;
  const armyPopulationDemand = calculateArmyPopulation(army);
  const armyFoodNeed = calculateArmyFoodNeed(army);

  ROLE_PRIORITY.forEach(role => jobsAvailable[role] = 0);
  ROLE_PRIORITY.forEach(role => {
    roleWageStats[role] = { totalSlots: 0, weightedWage: 0 };
    roleWagePayout[role] = 0;
  });
  
  // Track class expenses (spending on resources)
  const roleExpense = {};
  Object.keys(STRATA).forEach(key => {
    roleExpense[key] = 0;
  });

  const applyRoleIncomeToWealth = () => {
    Object.entries(roleWagePayout).forEach(([role, payout]) => {
      if (payout <= 0) {
        directIncomeApplied[role] = payout;
        return;
      }
      const alreadyApplied = directIncomeApplied[role] || 0;
      const netPayout = payout - alreadyApplied;
      if (netPayout > 0) {
        wealth[role] = (wealth[role] || 0) + netPayout;
      }
      directIncomeApplied[role] = payout;
    });
  };

  BUILDINGS.forEach(b => {
    const count = builds[b.id] || 0;
    if (count > 0) {
      if (b.output?.maxPop) totalMaxPop += (b.output.maxPop * count);
      if (b.output?.admin) adminCapacity += (b.output.admin * count);
      if (b.jobs) {
        for (let role in b.jobs) jobsAvailable[role] += (b.jobs[role] * count);
      }
      if (b.output) {
        Object.entries(b.output).forEach(([resKey, amount]) => {
          if (!RESOURCES[resKey]) return;
          if ((amount || 0) > 0) {
            producedResources.add(resKey);
          }
        });
      }
    }
  });

  // Calculate potential resources: resources from buildings that are unlocked (can be built)
  const potentialResources = new Set();
  BUILDINGS.forEach(b => {
    // Check if building is unlocked: epoch requirement met AND tech requirement met (if any)
    const epochUnlocked = (b.epoch ?? 0) <= epoch;
    const techUnlocked = !b.requiresTech || techsUnlocked.includes(b.requiresTech);
    
    if (epochUnlocked && techUnlocked && b.output) {
      Object.entries(b.output).forEach(([resKey, amount]) => {
        if (!RESOURCES[resKey]) return;
        if ((amount || 0) > 0) {
          potentialResources.add(resKey);
        }
      });
    }
  });

  if (maxPopPercent !== 0) {
    const multiplier = Math.max(0, 1 + maxPopPercent);
    totalMaxPop = Math.max(0, totalMaxPop * multiplier);
  }

  if (armyPopulationDemand > 0) {
    jobsAvailable.soldier = (jobsAvailable.soldier || 0) + armyPopulationDemand;
  }

  // 职业持久化：基于上一帧状态进行增减，而非每帧重置
  const hasPreviousPopStructure = previousPopStructure && Object.keys(previousPopStructure).length > 0;
  const popStructure = {};
  
  if (!hasPreviousPopStructure) {
    // 首次运行：按优先级初始填充
    let remainingPop = population;
    ROLE_PRIORITY.forEach(role => {
      const slots = Math.max(0, jobsAvailable[role] || 0);
      const filled = Math.min(remainingPop, slots);
      popStructure[role] = filled;
      remainingPop -= filled;
    });
    popStructure.unemployed = Math.max(0, remainingPop);
  } else {
    // 继承上一帧状态
    ROLE_PRIORITY.forEach(role => {
      const prevCount = Math.floor(previousPopStructure[role] || 0);
      popStructure[role] = Math.max(0, prevCount);
    });
    popStructure.unemployed = Math.max(0, Math.floor(previousPopStructure.unemployed || 0));
    
    // 处理人口变化（增长或减少）
    const assignedPop = ROLE_PRIORITY.reduce((sum, role) => sum + (popStructure[role] || 0), 0) + (popStructure.unemployed || 0);
    let diff = population - assignedPop;
    
    if (diff > 0) {
      // 人口增长：新人加入失业者
      popStructure.unemployed = (popStructure.unemployed || 0) + diff;
    } else if (diff < 0) {
      // 人口减少：优先扣除失业者，不够则按比例扣除各职业
      let reductionNeeded = -diff;
      const unemployedReduction = Math.min(popStructure.unemployed || 0, reductionNeeded);
      if (unemployedReduction > 0) {
        popStructure.unemployed -= unemployedReduction;
        reductionNeeded -= unemployedReduction;
      }
      
      // 如果还需要减少人口，按比例从各职业扣除（财富留给幸存者均摊）
      if (reductionNeeded > 0) {
        const initialTotal = ROLE_PRIORITY.reduce((sum, role) => sum + (popStructure[role] || 0), 0);
        if (initialTotal > 0) {
          const baseReduction = reductionNeeded;
          ROLE_PRIORITY.forEach((role, index) => {
            if (reductionNeeded <= 0) return;
            const current = popStructure[role] || 0;
            if (current <= 0) return;
            const proportion = current / initialTotal;
            let remove = Math.floor(proportion * baseReduction);
            if (remove <= 0 && reductionNeeded > 0) remove = 1;
            if (index === ROLE_PRIORITY.length - 1) {
              remove = Math.min(current, reductionNeeded);
            } else {
              remove = Math.min(current, Math.min(remove, reductionNeeded));
            }
            if (remove <= 0) return;
            popStructure[role] = current - remove;
            reductionNeeded -= remove;
            // 注意：财富不扣除，留给幸存者均摊（变相增加人均财富）
          });
          if (reductionNeeded > 0) {
            ROLE_PRIORITY.forEach(role => {
              if (reductionNeeded <= 0) return;
              const current = popStructure[role] || 0;
              if (current <= 0) return;
              const remove = Math.min(current, reductionNeeded);
              popStructure[role] = current - remove;
              reductionNeeded -= remove;
            });
          }
        }
      }
    }
  }
  popStructure.unemployed = Math.max(0, popStructure.unemployed || 0);

  // 处理岗位上限（裁员）：如果职业人数超过岗位数，将多出的人转为失业
  ROLE_PRIORITY.forEach(role => {
    const current = popStructure[role] || 0;
    const slots = Math.max(0, jobsAvailable[role] || 0);
    if (current > slots) {
      const layoffs = current - slots;
      const roleWealth = wealth[role] || 0;
      const perCapWealth = current > 0 ? roleWealth / current : 0;
      
      // 裁员：人口移至失业，并携带财富
      popStructure[role] = slots;
      popStructure.unemployed = (popStructure.unemployed || 0) + layoffs;
      
      if (perCapWealth > 0) {
        const transfer = perCapWealth * layoffs;
        wealth[role] = Math.max(0, roleWealth - transfer);
        wealth.unemployed = (wealth.unemployed || 0) + transfer;
      }
    }
  });

  // 自动填补（招工）：失业者按优先级填补有空缺的岗位
  ROLE_PRIORITY.forEach(role => {
    const availableUnemployed = popStructure.unemployed || 0;
    if (availableUnemployed <= 0) return;
    
    const slots = Math.max(0, jobsAvailable[role] || 0);
    const current = popStructure[role] || 0;
    const vacancy = Math.max(0, slots - current);
    if (vacancy <= 0) return;
    
    const hiring = Math.min(vacancy, availableUnemployed);
    if (hiring <= 0) return;
    
    // 招工：失业者填补岗位，并携带财富
    const unemployedWealth = wealth.unemployed || 0;
    const perCapWealth = availableUnemployed > 0 ? unemployedWealth / availableUnemployed : 0;
    
    popStructure[role] = current + hiring;
    popStructure.unemployed = Math.max(0, availableUnemployed - hiring);
    
    if (perCapWealth > 0) {
      const transfer = perCapWealth * hiring;
      wealth.unemployed = Math.max(0, unemployedWealth - transfer);
      wealth[role] = (wealth[role] || 0) + transfer;
    }
  });

  let currentAdminStrain = 0;
  const classApproval = {};
  const classInfluence = {};
  const classWealthResult = {};
  const logs = [];
  const buildingJobFill = {};

  let productionModifier = 1.0;
  let industryModifier = 1.0;
  let taxModifier = 1.0;

  productionBuffs.forEach(buff => {
    if (buff.production) productionModifier += buff.production;
    if (buff.industryBonus) industryModifier += buff.industryBonus;
    if (buff.taxIncome) taxModifier += buff.taxIncome;
  });
  productionDebuffs.forEach(debuff => {
    if (debuff.production) productionModifier += debuff.production;
    if (debuff.industryBonus) industryModifier += debuff.industryBonus;
    if (debuff.taxIncome) taxModifier += debuff.taxIncome;
  });

  productionModifier *= (1 + productionBonus);
  industryModifier *= (1 + industryBonus);
  taxModifier *= (1 + taxBonus);

  const effectiveTaxModifier = Math.max(0, taxModifier);

  Object.entries(passiveGains).forEach(([resKey, amountPerDay]) => {
    if (!amountPerDay) return;
    const gain = amountPerDay * gameSpeed;
    const current = res[resKey] || 0;
    if (gain >= 0) {
      res[resKey] = current + gain;
      rates[resKey] = (rates[resKey] || 0) + gain;
    } else {
      const needed = Math.abs(gain);
      const spent = Math.min(current, needed);
      if (spent > 0) {
        res[resKey] = current - spent;
        rates[resKey] = (rates[resKey] || 0) - spent;
      }
    }
  });

  const zeroApprovalClasses = {};
  const effectiveNeedsReduction = Math.max(0, Math.min(0.95, needsReduction || 0));
  const needsRequirementMultiplier = 1 - effectiveNeedsReduction;

  Object.keys(STRATA).forEach(key => {
    const count = popStructure[key] || 0;
    if (count === 0) return;
    const def = STRATA[key];
    if (def.admin > 0) currentAdminStrain += count * def.admin;
    if (wealth[key] === undefined) {
      wealth[key] = def.startingWealth || 0;
    }
    const headRate = getHeadTaxRate(key);
    const headBase = STRATA[key]?.headTaxBase ?? 0.01;
    const due = count * headBase * gameSpeed * headRate * effectiveTaxModifier;
    if (due !== 0) {
      const available = wealth[key] || 0;
      if (due > 0) {
        const paid = Math.min(available, due);
        wealth[key] = available - paid;
        taxBreakdown.headTax += paid;
        // 记录人头税支出
        roleExpense[key] = (roleExpense[key] || 0) + paid;
      } else {
        const subsidyNeeded = -due;
        const treasury = res.silver || 0;
        if (treasury >= subsidyNeeded) {
          res.silver = treasury - subsidyNeeded;
          wealth[key] = available + subsidyNeeded;
          taxBreakdown.subsidy += subsidyNeeded;
          // 记录政府补助收入
          roleWagePayout[key] = (roleWagePayout[key] || 0) + subsidyNeeded;
        }
      }
    }
    classApproval[key] = previousApproval[key] ?? 50;
    if ((classApproval[key] || 0) <= 0) {
      zeroApprovalClasses[key] = true;
    }
  });

  const forcedLabor = decrees.some(d => d.id === 'forced_labor' && d.active);

  BUILDINGS.forEach(b => {
    const count = builds[b.id] || 0;
    if (count === 0) return;

    const ownerKey = b.owner || 'state';
    if (wealth[ownerKey] === undefined) {
      wealth[ownerKey] = STRATA[ownerKey]?.startingWealth || 0;
    }

    let multiplier = 1.0 * gameSpeed;
    const currentEpoch = EPOCHS[epoch];

    if (currentEpoch && currentEpoch.bonuses) {
      if (b.cat === 'gather' && currentEpoch.bonuses.gatherBonus) {
        multiplier *= (1 + currentEpoch.bonuses.gatherBonus);
      }
      if (b.cat === 'industry' && currentEpoch.bonuses.industryBonus) {
        multiplier *= (1 + currentEpoch.bonuses.industryBonus);
      }
    }

    if (b.cat === 'gather' || b.cat === 'civic') {
      multiplier *= productionModifier;
    }
    if (b.cat === 'industry') {
      multiplier *= industryModifier;
    }

    if (techsUnlocked.includes('wheel') && b.cat === 'gather') {
      multiplier *= 1.2;
    }
    if (techsUnlocked.includes('pottery') && b.id === 'farm') {
      multiplier *= 1.1;
    }
    if (techsUnlocked.includes('basic_irrigation') && b.id === 'farm') {
      multiplier *= 1.15;
    }
    const categoryBonus = categoryBonuses[b.cat];
    if (categoryBonus && categoryBonus !== 1) {
      multiplier *= categoryBonus;
    }
    const buildingBonus = buildingBonuses[b.id];
    if (buildingBonus && buildingBonus !== 1) {
      multiplier *= buildingBonus;
    }

    let staffingRatio = 1.0;
    let totalSlots = 0;
    let filledSlots = 0;
    const roleExpectedWages = {};
    let expectedWageBillBase = 0;
    if (b.jobs) {
      buildingJobFill[b.id] = buildingJobFill[b.id] || {};
      for (let role in b.jobs) {
        const roleRequired = b.jobs[role] * count;
        if (!roleWageStats[role]) {
          roleWageStats[role] = { totalSlots: 0, weightedWage: 0 };
        }
        totalSlots += roleRequired;
        const totalRoleJobs = jobsAvailable[role];
        const totalRolePop = popStructure[role];
        const fillRate = totalRoleJobs > 0 ? Math.min(1, totalRolePop / totalRoleJobs) : 0;
        const roleFilled = roleRequired * fillRate;
        filledSlots += roleFilled;
        buildingJobFill[b.id][role] = roleFilled;
        if (role !== ownerKey && roleFilled > 0) {
          const expected = roleExpectedWages[role] ?? getExpectedWage(role);
          roleExpectedWages[role] = expected;
          expectedWageBillBase += roleFilled * expected;
        }
      }
      if (totalSlots > 0) staffingRatio = filledSlots / totalSlots;
      if (totalSlots > 0 && filledSlots <= 0) {
        return;
      }
    }

    multiplier *= staffingRatio;

    if (forcedLabor && (b.jobs?.serf || b.jobs?.miner)) {
      multiplier *= 1.2;
    }

    const baseMultiplier = multiplier;
    let resourceLimit = 1;
    let inputCostPerMultiplier = 0;
    let isInLowEfficiencyMode = false;

    if (b.input) {
      for (const [resKey, perUnit] of Object.entries(b.input)) {
        // Skip input requirement if resource is not unlocked yet (prevents early game deadlock)
        if (!isResourceUnlocked(resKey, epoch, techsUnlocked)) {
          continue;
        }
        
        const perMultiplierAmount = perUnit * count;
        const requiredAtBase = perMultiplierAmount * baseMultiplier;
        if (requiredAtBase <= 0) continue;
        const available = res[resKey] || 0;
        if (available <= 0) {
          resourceLimit = 0;
        } else {
          resourceLimit = Math.min(resourceLimit, available / requiredAtBase);
        }
        if (isTradableResource(resKey)) {
          const price = getPrice(resKey);
          const taxRate = Math.max(0, getResourceTaxRate(resKey));
          inputCostPerMultiplier += perMultiplierAmount * price * (1 + taxRate);
        }
      }
    }

    // 防死锁机制：采集类建筑在缺少输入原料时进入低效模式
    let targetMultiplier = baseMultiplier * Math.max(0, Math.min(1, resourceLimit));
    if (b.cat === 'gather' && resourceLimit === 0 && b.input) {
      // 进入低效模式：20%效率，不消耗原料
      targetMultiplier = baseMultiplier * 0.2;
      isInLowEfficiencyMode = true;
      inputCostPerMultiplier = 0; // 低效模式下不消耗原料，因此成本为0
      
      // 添加日志提示（每个建筑类型只提示一次，避免刷屏）
      const inputNames = Object.keys(b.input).map(k => RESOURCES[k]?.name || k).join('、');
      if (tick % 30 === 0) { // 每30个tick提示一次
        logs.push(`⚠️ ${b.name} 缺少 ${inputNames}，工人正在徒手作业（效率20%）`);
      }
    }

    let outputValuePerMultiplier = 0;
    let producesTradableOutput = false;
    if (b.output) {
      for (const [resKey, perUnit] of Object.entries(b.output)) {
        if (resKey === 'maxPop' || resKey === 'admin') continue;
        if (!isTradableResource(resKey)) continue;
        producesTradableOutput = true;
        const perMultiplierAmount = perUnit * count;
        outputValuePerMultiplier += perMultiplierAmount * getPrice(resKey);
      }
    }

    const wageCostPerMultiplier = baseMultiplier > 0 ? expectedWageBillBase / baseMultiplier : expectedWageBillBase;
    const totalOperatingCostPerMultiplier = inputCostPerMultiplier + wageCostPerMultiplier;

    const estimatedRevenue = outputValuePerMultiplier * targetMultiplier;
    const estimatedInputCost = inputCostPerMultiplier * targetMultiplier;
    const estimatedWageCost = wageCostPerMultiplier * targetMultiplier;
    let actualMultiplier = targetMultiplier;
    if (producesTradableOutput) {
      const estimatedCost = estimatedInputCost + estimatedWageCost;
      if (estimatedCost > 0 && estimatedRevenue <= 0) {
        actualMultiplier = 0;
      } else if (estimatedCost > 0 && estimatedRevenue < estimatedCost * 0.98) {
        const marginRatio = Math.max(0, Math.min(1, estimatedRevenue / estimatedCost));
        actualMultiplier = targetMultiplier * marginRatio;
      }
    }
    if (totalOperatingCostPerMultiplier > 0) {
      const ownerCash = wealth[ownerKey] || 0;
      const affordableMultiplier = ownerCash / totalOperatingCostPerMultiplier;
      actualMultiplier = Math.min(actualMultiplier, Math.max(0, affordableMultiplier));
    }

    if (!Number.isFinite(actualMultiplier) || actualMultiplier < 0) {
      actualMultiplier = 0;
    }

    const zeroApprovalFactor = 0.3;
    let approvalMultiplier = 1;
    if (zeroApprovalClasses[ownerKey]) {
      approvalMultiplier = Math.min(approvalMultiplier, zeroApprovalFactor);
    }
    if (b.jobs) {
      Object.keys(b.jobs).forEach(role => {
        if (zeroApprovalClasses[role]) {
          approvalMultiplier = Math.min(approvalMultiplier, zeroApprovalFactor);
        }
      });
    }
    actualMultiplier *= approvalMultiplier;

    const utilization = baseMultiplier > 0 ? Math.min(1, actualMultiplier / baseMultiplier) : 0;
    let plannedWageBill = 0;
    const wagePlans = [];

    // 低效模式下不消耗输入原料（徒手采集）
    if (b.input && !isInLowEfficiencyMode) {
      for (const [resKey, perUnit] of Object.entries(b.input)) {
        // Skip input requirement if resource is not unlocked yet
        if (!isResourceUnlocked(resKey, epoch, techsUnlocked)) {
          continue;
        }
        
        const amountNeeded = perUnit * count * actualMultiplier;
        if (!amountNeeded || amountNeeded <= 0) continue;
        const available = res[resKey] || 0;
        const consumed = Math.min(amountNeeded, available);
        if (isTradableResource(resKey)) {
          demand[resKey] = (demand[resKey] || 0) + amountNeeded;
          const price = getPrice(resKey);
          const taxRate = Math.max(0, getResourceTaxRate(resKey));
          const baseCost = consumed * price;
          const taxPaid = baseCost * taxRate;
          if (taxPaid > 0) {
            taxBreakdown.industryTax += taxPaid;
          }
          const totalCost = baseCost + taxPaid;
          wealth[ownerKey] = Math.max(0, (wealth[ownerKey] || 0) - totalCost);
          // 记录owner支付输入资源的支出
          roleExpense[ownerKey] = (roleExpense[ownerKey] || 0) + totalCost;
        }
        if (consumed <= 0) continue;
        res[resKey] = available - consumed;
        rates[resKey] = (rates[resKey] || 0) - consumed;
      }
    }

    if (b.jobs) {
      Object.entries(b.jobs).forEach(([role, perBuilding]) => {
        const roleSlots = perBuilding * count;
        if (roleSlots <= 0) return;
        if (!roleWageStats[role]) {
          roleWageStats[role] = { totalSlots: 0, weightedWage: 0 };
        }
        roleWageStats[role].totalSlots += roleSlots;
        if (role === ownerKey) return;
        const filled = buildingJobFill[b.id]?.[role] || 0;
        const expectedBaseWage = roleExpectedWages[role] ?? getExpectedWage(role);
        roleExpectedWages[role] = expectedBaseWage;
        const expectedSlotWage = expectedBaseWage * utilization;
        const due = expectedSlotWage * filled;
        plannedWageBill += due;
        wagePlans.push({
          role,
          roleSlots,
          filled,
          expectedSlotWage,
          due,
        });
      });
    }

    let wageRatio = 0;
    if (plannedWageBill > 0) {
      const available = wealth[ownerKey] || 0;
      const paid = Math.min(available, plannedWageBill);
      wealth[ownerKey] = available - paid;
      // 记录owner支付工资的支出
      roleExpense[ownerKey] = (roleExpense[ownerKey] || 0) + paid;
      wageRatio = paid / plannedWageBill;
    }

    wagePlans.forEach(plan => {
      const actualSlotWage = plan.expectedSlotWage * wageRatio;
      roleWageStats[plan.role].weightedWage += actualSlotWage * plan.roleSlots;
      if (plan.filled > 0 && actualSlotWage > 0) {
        const payout = actualSlotWage * plan.filled;
        roleWagePayout[plan.role] = (roleWagePayout[plan.role] || 0) + payout;
      }
    });

    if (b.output) {
      for (const [resKey, perUnit] of Object.entries(b.output)) {
        const amount = perUnit * count * actualMultiplier;
        if (!amount || amount <= 0) continue;
        if (resKey === 'maxPop' || resKey === 'admin') {
          res[resKey] = (res[resKey] || 0) + amount;
          continue;
        }
        if (isTradableResource(resKey)) {
          sellProduction(resKey, amount, ownerKey);
          rates[resKey] = (rates[resKey] || 0) + amount;
        } else {
          res[resKey] = (res[resKey] || 0) + amount;
        }
      }
    }

    if (b.id === 'market') {
      const marketOwnerKey = b.owner || 'merchant';
      const hasMerchants = (popStructure[marketOwnerKey] || 0) > 0;
      const canTradeThisTick = tick % 5 === 0;
      if (hasMerchants && canTradeThisTick) {
        const merchantWealth = wealth[marketOwnerKey] || 0;
        let availableMerchantWealth = merchantWealth;
        if (availableMerchantWealth <= 0) {
          // 没有可用于贸易的资金
        } else {
          const surpluses = [];
          Object.entries(res).forEach(([resKey, amount]) => {
            if (!isTradableResource(resKey) || resKey === 'silver') return;
            if ((amount || 0) <= 300) return;
            if ((rates[resKey] || 0) < 0) return;

            const localPrice = getPrice(resKey);
            surpluses.push({ resource: resKey, stock: amount, localPrice });
          });

          if (surpluses.length > 0) {
            const shortageTargets = [];
            Object.keys(RESOURCES).forEach(resourceKey => {
              if (!isTradableResource(resourceKey) || resourceKey === 'silver') return;
              const stock = res[resourceKey] || 0;
              const netRate = rates[resourceKey] || 0;
              const demandGap = Math.max(0, (demand[resourceKey] || 0) - (supply[resourceKey] || 0));
              const stockGap = Math.max(0, 200 - stock);
              const netDeficit = netRate < 0 ? Math.abs(netRate) : 0;
              const shortageAmount = Math.max(demandGap, stockGap, netDeficit);
              if (shortageAmount <= 0) return;
              const importPrice = Math.max(PRICE_FLOOR, getPrice(resourceKey) * 1.15);
              const requiredValue = shortageAmount * importPrice;
              if (requiredValue <= 0) return;
              shortageTargets.push({ resource: resourceKey, shortageAmount, importPrice, requiredValue });
            });

            if (shortageTargets.length > 0) {
              shortageTargets.sort((a, b) => b.requiredValue - a.requiredValue);
              const logThreshold = 10;

              shortageTargets.forEach(target => {
                if (availableMerchantWealth <= 0) return;
                let remainingAmount = target.shortageAmount;
                let remainingValue = target.requiredValue;

                for (const surplus of surpluses) {
                  if (availableMerchantWealth <= 0) break;
                  if (remainingAmount <= 0 || remainingValue <= 0) break;

                  const sourceResource = surplus.resource;
                  const sourcePrice = surplus.localPrice;
                  if (sourcePrice <= 0) continue;
                  const currentStock = res[sourceResource] || 0;
                  if (currentStock <= 0) continue;

                  const demandLimit = remainingValue / sourcePrice;
                  const inventoryLimit = currentStock * 0.05;
                  const wealthLimit = availableMerchantWealth / sourcePrice;
                  const exportAmount = Math.min(demandLimit, inventoryLimit, wealthLimit);
                  if (!Number.isFinite(exportAmount) || exportAmount <= 0) continue;

                  const exportValue = exportAmount * sourcePrice;
                  availableMerchantWealth -= exportValue;
                  wealth[marketOwnerKey] = availableMerchantWealth;
                  roleExpense[marketOwnerKey] = (roleExpense[marketOwnerKey] || 0) + exportValue;

                  res[sourceResource] = Math.max(0, currentStock - exportAmount);
                  supply[sourceResource] = (supply[sourceResource] || 0) + exportAmount;
                  rates[sourceResource] = (rates[sourceResource] || 0) - exportAmount;
                  surplus.stock = Math.max(0, surplus.stock - exportAmount);
                  remainingValue = Math.max(0, remainingValue - exportValue);

                  if (target.importPrice <= 0) continue;
                  let importAmount = exportValue / target.importPrice;
                  if (!Number.isFinite(importAmount) || importAmount <= 0) continue;
                  importAmount = Math.min(importAmount, remainingAmount);
                  if (importAmount <= 0) continue;

                  const importCost = importAmount * target.importPrice;
                  wealth[marketOwnerKey] += importCost;
                  availableMerchantWealth += importCost;

                  res[target.resource] = (res[target.resource] || 0) + importAmount;
                  supply[target.resource] = (supply[target.resource] || 0) + importAmount;
                  rates[target.resource] = (rates[target.resource] || 0) + importAmount;
                  remainingAmount = Math.max(0, remainingAmount - importAmount);

                  const profit = importCost - exportValue;
                  if (profit > 0) {
                    directIncomeApplied[marketOwnerKey] = (directIncomeApplied[marketOwnerKey] || 0) + profit;
                    roleWagePayout[marketOwnerKey] = (roleWagePayout[marketOwnerKey] || 0) + profit;
                  }

                  if (importCost > logThreshold) {
                    const fromName = RESOURCES[sourceResource]?.name || sourceResource;
                    const toName = RESOURCES[target.resource]?.name || target.resource;
                    logs.push(`🚢 市场：商人动用自有资金 ${exportValue.toFixed(1)} 银币购入 ${exportAmount.toFixed(1)} ${fromName}，换回 ${importAmount.toFixed(1)} ${toName}。`);
                  }
                }
              });
            }
          }
        }
      }
    }

    if (b.jobs) {
      Object.entries(b.jobs).forEach(([role, perBuilding]) => {
        const roleSlots = perBuilding * count;
        if (roleSlots <= 0) return;
        roleWageStats[role].totalSlots += roleSlots;
        if (role !== ownerKey) {
          roleWageStats[role].weightedWage += actualWagePerSlot * roleSlots;
          const filled = buildingJobFill[b.id]?.[role] || 0;
          if (filled > 0 && actualWagePerSlot > 0) {
            const payout = actualWagePerSlot * filled;
            roleWagePayout[role] += payout;
          }
        }
      });
    }
  });

  const wageMultiplier = Math.max(0, militaryWageRatio ?? 0);
  const foodPrice = getPrice('food');
  const baseArmyWage = armyFoodNeed * foodPrice * wageMultiplier;

  if (baseArmyWage > 0) {
    const wageDue = baseArmyWage * gameSpeed;
    const available = res.silver || 0;
    if (available >= wageDue) {
      res.silver = available - wageDue;
      rates.silver = (rates.silver || 0) - wageDue;
      roleWagePayout.soldier = (roleWagePayout.soldier || 0) + wageDue;
    } else if (wageDue > 0) {
      logs.push('银币不足，军饷被拖欠，军心不稳。');
    }
  }

  // Add all tracked income (civilian + military) to the wealth of each class
  applyRoleIncomeToWealth();

  const needsReport = {};
  const classShortages = {};
  Object.keys(STRATA).forEach(key => {
    const def = STRATA[key];
    const count = popStructure[key] || 0;
    if (count === 0 || !def.needs) {
      needsReport[key] = 1;
      classShortages[key] = [];
      return;
    }

    let satisfactionSum = 0;
    let tracked = 0;
    const shortages = []; // 改为对象数组，记录短缺原因

    for (const [resKey, perCapita] of Object.entries(def.needs)) {
      if (def.defaultResource && def.defaultResource === resKey) {
        continue;
      }
      const resourceInfo = RESOURCES[resKey];
      // Check if resource requires a technology to unlock
      if (resourceInfo && resourceInfo.unlockTech) {
        // Skip this resource if the required tech is not unlocked
        if (!techsUnlocked.includes(resourceInfo.unlockTech)) {
          continue;
        }
      } else if (resourceInfo && typeof resourceInfo.unlockEpoch === 'number' && resourceInfo.unlockEpoch > epoch) {
        // Fallback to epoch check for resources without tech requirement
        continue;
      }
      if (!potentialResources.has(resKey)) {
        continue;
      }
      const requirement = perCapita * count * gameSpeed * needsRequirementMultiplier;
      if (requirement <= 0) continue;
      const available = res[resKey] || 0;
      let satisfied = 0;

      if (isTradableResource(resKey)) {
        const price = getPrice(resKey);
        const affordable = price > 0 ? Math.min(requirement, (wealth[key] || 0) / price) : requirement;
        const amount = Math.min(requirement, available, affordable);
        demand[resKey] = (demand[resKey] || 0) + requirement;
        if (amount > 0) {
          res[resKey] = available - amount;
          rates[resKey] = (rates[resKey] || 0) - amount;
          const taxRate = Math.max(0, getResourceTaxRate(resKey));
          const baseCost = amount * price;
          const taxPaid = baseCost * taxRate;
          if (taxPaid > 0) {
            taxBreakdown.industryTax += taxPaid;
          }
          const totalCost = baseCost + taxPaid;
          wealth[key] = Math.max(0, (wealth[key] || 0) - totalCost);
          roleExpense[key] = (roleExpense[key] || 0) + totalCost;
          satisfied = amount;
        }
        
        // 记录短缺原因
        const ratio = requirement > 0 ? satisfied / requirement : 1;
        satisfactionSum += ratio;
        tracked += 1;
        if (ratio < 0.99) {
          // 判断短缺原因：买不起 vs 缺货
          const canAfford = affordable >= requirement * 0.99;
          const inStock = available >= requirement * 0.99;
          let reason = 'both'; // 既缺货又买不起
          if (canAfford && !inStock) {
            reason = 'outOfStock'; // 有钱但缺货
          } else if (!canAfford && inStock) {
            reason = 'unaffordable'; // 有货但买不起
          }
          shortages.push({ resource: resKey, reason });
        }
      } else {
        const amount = Math.min(requirement, available);
        if (amount > 0) {
          res[resKey] = available - amount;
          satisfied = amount;
        }
        
        const ratio = requirement > 0 ? satisfied / requirement : 1;
        satisfactionSum += ratio;
        tracked += 1;
        if (ratio < 0.99) {
          // 非交易资源只可能是缺货
          shortages.push({ resource: resKey, reason: 'outOfStock' });
        }
      }
    }

  needsReport[key] = {
    satisfactionRatio: tracked > 0 ? satisfactionSum / tracked : 1,
    totalTrackedNeeds: tracked,
  };
  classShortages[key] = shortages;
});

  let workforceNeedWeighted = 0;
  let workforceTotal = 0;
  Object.keys(STRATA).forEach(key => {
    const count = popStructure[key] || 0;
    if (count <= 0) return;
    workforceTotal += count;
    const needLevel = Math.min(1, needsReport[key] ?? 1);
    workforceNeedWeighted += needLevel * count;
  });
  const laborNeedAverage = workforceTotal > 0 ? workforceNeedWeighted / workforceTotal : 1;
  const laborEfficiencyFactor = 0.3 + 0.7 * laborNeedAverage;
  if (laborEfficiencyFactor < 0.999) {
    Object.entries(rates).forEach(([resKey, value]) => {
      const resInfo = RESOURCES[resKey];
      if (!resInfo || resKey === 'silver' || (resInfo.type && resInfo.type === 'virtual')) return;
      if (value > 0) {
        const reduction = value * (1 - laborEfficiencyFactor);
        rates[resKey] = value - reduction;
        res[resKey] = Math.max(0, (res[resKey] || 0) - reduction);
      }
    });
    logs.push('劳动力因需求未满足而效率下降。');
  }

  decrees.forEach(d => {
    if (d.active) {
      currentAdminStrain += d.cost.admin;
      if (d.id === 'forced_labor') {
        if (popStructure.serf > 0) classApproval.serf = Math.max(0, (classApproval.serf || 50) - 20);
        if (popStructure.miner > 0) classApproval.miner = Math.max(0, (classApproval.miner || 50) - 15);
        if (popStructure.landowner > 0) classApproval.landowner = Math.min(100, (classApproval.landowner || 50) + 10);
      }
      if (d.id === 'tithe') {
        if (popStructure.cleric > 0) classApproval.cleric = Math.max(0, (classApproval.cleric || 50) - 10);
        const titheDue = (popStructure.cleric || 0) * 2 * gameSpeed * effectiveTaxModifier;
        if (titheDue > 0) {
          const available = wealth.cleric || 0;
          const paid = Math.min(available, titheDue);
          wealth.cleric = Math.max(0, available - paid);
          taxBreakdown.headTax += paid;
          // 记录什一税支出
          roleExpense.cleric = (roleExpense.cleric || 0) + paid;
        }
      }
    }
  });

  Object.keys(STRATA).forEach(key => {
    const count = popStructure[key] || 0;
    if (count === 0) return;
    const satisfactionInfo = needsReport[key];
    const satisfaction = satisfactionInfo?.satisfactionRatio ?? 1;
    let targetApproval = 70; // Base approval

    // Tax Burden Logic
    const headRate = getHeadTaxRate(key);
    const headBase = STRATA[key]?.headTaxBase ?? 0.01;
    const taxPerCapita = Math.max(0, headBase * gameSpeed * headRate * effectiveTaxModifier);
    const incomePerCapita = (roleWagePayout[key] || 0) / Math.max(1, count);
    if (incomePerCapita > 0.001 && taxPerCapita > incomePerCapita * 0.5) {
      targetApproval = Math.min(targetApproval, 40); // Tax burden cap
    } else if (headRate < 0.6) {
      targetApproval += 5; // Tax relief bonus
    }

    // Resource Shortage Logic
    const totalNeeds = satisfactionInfo?.totalTrackedNeeds ?? 0;
    const unmetNeeds = (classShortages[key] || []).length;
    if (unmetNeeds > 0 && totalNeeds > 0) {
      if (unmetNeeds >= totalNeeds) {
        targetApproval = Math.min(targetApproval, 0); // All needs unmet, drops to 0
      } else {
        targetApproval = Math.min(targetApproval, 30); // Partial shortage, capped at 30
      }
    }

    // Sustained needs satisfaction bonus (reward consecutive ticks of high fulfillment)
    const needsHistory = (classNeedsHistory || {})[key];
    if (needsHistory && needsHistory.length > 0) {
      const threshold = 0.95;
      const maxWindow = 20;
      let consecutiveSatisfied = 0;
      for (let i = needsHistory.length - 1; i >= 0 && consecutiveSatisfied < maxWindow; i--) {
        if (needsHistory[i] >= threshold) {
          consecutiveSatisfied += 1;
        } else {
          break;
        }
      }
      if (consecutiveSatisfied >= 3) {
        const sustainedBonus = Math.min(15, consecutiveSatisfied * 0.6);
        targetApproval = Math.min(100, targetApproval + sustainedBonus);
      }
    }

    // Wealth Trend Logic
    const history = (classWealthHistory || {})[key];
    if (history && history.length >= 20) { // Check for 20 ticks of history
      const recentWealth = history.slice(-10).reduce((a, b) => a + b, 0) / 10;
      const pastWealth = history.slice(-20, -10).reduce((a, b) => a + b, 0) / 10;

      if (pastWealth > 1) { // Avoid division by zero or tiny numbers
        const trend = (recentWealth - pastWealth) / pastWealth;
        const trendBonus = Math.min(15, Math.abs(trend) * 50); // Scale bonus with trend, cap at 15

        if (trend > 0.05) { // Modest but sustained growth
          targetApproval += trendBonus;
        } else if (trend < -0.05) { // Modest but sustained decline
          targetApproval -= trendBonus;
        }
      }
    }

    // Positive satisfaction bonus
    if (satisfaction > 1.5) {
      targetApproval = Math.min(100, targetApproval + 10);
    }
    
    // Unemployed penalty
    if (key === 'unemployed') {
      const ratio = count / Math.max(1, population);
      const penalty = 2 + ratio * 30;
      targetApproval -= penalty;
    }
    
    // Gradual adjustment
    const currentApproval = classApproval[key] || 50;
    const adjustmentSpeed = 0.08; // How slowly approval changes per tick
    let newApproval = currentApproval + (targetApproval - currentApproval) * adjustmentSpeed;
    
    classApproval[key] = Math.max(0, Math.min(100, newApproval));
  });

  if ((popStructure.unemployed || 0) === 0 && previousApproval.unemployed !== undefined) {
    classApproval.unemployed = Math.min(100, previousApproval.unemployed + 5);
  }


  let epochAdminBonus = 0;
  if (epoch > 0 && EPOCHS[epoch].bonuses.adminBonus) {
    epochAdminBonus = EPOCHS[epoch].bonuses.adminBonus;
  }

  adminCapacity += epochAdminBonus;
  res.admin = adminCapacity - currentAdminStrain;
  const adminEfficiency = res.admin < 0 ? 0.5 : 1.0;

  res.admin = Math.max(0, res.admin);

  let nextPopulation = population;
  let raidPopulationLoss = 0;

  Object.keys(STRATA).forEach(key => {
    classWealthResult[key] = Math.max(0, wealth[key] || 0);
  });

  let totalWealth = Object.values(classWealthResult).reduce((sum, val) => sum + val, 0);

  Object.keys(STRATA).forEach(key => {
    const count = popStructure[key] || 0;
    if (count === 0) return;
    const def = STRATA[key];
    const wealthShare = classWealthResult[key] || 0;
    const wealthFactor = totalWealth > 0 ? wealthShare / totalWealth : 0;
    classInfluence[key] = (def.influenceBase * count) + (wealthFactor * 10);
  });

  let totalInfluence = Object.values(classInfluence).reduce((sum, val) => sum + val, 0);
  let exodusPopulationLoss = 0;
  let extraStabilityPenalty = 0;
  // 修正人口外流（Exodus）：愤怒人口离开时带走财富（资本外逃）
  Object.keys(STRATA).forEach(key => {
    const count = popStructure[key] || 0;
    if (count === 0) return;
    const approval = classApproval[key] || 50;
    if (approval >= 25) return;
    const influenceShare = totalInfluence > 0 ? (classInfluence[key] || 0) / totalInfluence : 0;
    const className = STRATA[key]?.name || key;
    if (approval < 20 && influenceShare < 0.07) {
      const leavingRate = Math.max(0.03, (20 - approval) / 200);
      const leaving = Math.min(count, Math.max(1, Math.floor(count * leavingRate)));
      if (leaving > 0) {
        const currentWealth = wealth[key] || 0;
        const perCapWealth = count > 0 ? currentWealth / count : 0;
        const fleeingCapital = perCapWealth * leaving;
        
        // 关键修改：扣除离开人口带走的财富（资本外逃）
        if (fleeingCapital > 0) {
          wealth[key] = Math.max(0, currentWealth - fleeingCapital);
        }
      }
      exodusPopulationLoss += leaving;
      
      // 生成详细的短缺原因日志
      const shortageDetails = (classShortages[key] || []).map(shortage => {
        const resKey = typeof shortage === 'string' ? shortage : shortage.resource;
        const reason = typeof shortage === 'string' ? 'outOfStock' : shortage.reason;
        const resName = RESOURCES[resKey]?.name || resKey;
        
        if (reason === 'unaffordable') {
          return `${resName}(买不起)`;
        } else if (reason === 'outOfStock') {
          return `${resName}(缺货)`;
        } else if (reason === 'both') {
          return `${resName}(缺货且买不起)`;
        }
        return resName;
      }).join('、');
      
      const shortageMsg = shortageDetails ? `，短缺资源：${shortageDetails}` : '';
      logs.push(`${className} 阶层对政局失望，${leaving} 人离开了国家，带走了 ${(leaving * (wealth[key] || 0) / Math.max(1, count)).toFixed(1)} 银币${shortageMsg}。`);
    } else if (influenceShare >= 0.12) {
      const penalty = Math.min(0.2, 0.05 + influenceShare * 0.15);
      extraStabilityPenalty += penalty;
      
      // 为稳定性惩罚也添加短缺详情
      const shortageDetails = (classShortages[key] || []).map(shortage => {
        const resKey = typeof shortage === 'string' ? shortage : shortage.resource;
        const reason = typeof shortage === 'string' ? 'outOfStock' : shortage.reason;
        const resName = RESOURCES[resKey]?.name || resKey;
        
        if (reason === 'unaffordable') {
          return `${resName}(买不起)`;
        } else if (reason === 'outOfStock') {
          return `${resName}(缺货)`;
        } else if (reason === 'both') {
          return `${resName}(缺货且买不起)`;
        }
        return resName;
      }).join('、');
      
      const shortageMsg = shortageDetails ? `（短缺：${shortageDetails}）` : '';
      logs.push(`${className} 阶层的愤怒正在削弱社会稳定${shortageMsg}。`);
    }
  });

  const newActiveBuffs = [];
  const newActiveDebuffs = [];

  Object.keys(STRATA).forEach(key => {
    const def = STRATA[key];
    if (!def.buffs || (popStructure[key] || 0) === 0) return;
    const approval = classApproval[key] || 50;
    const satisfiedNeeds = (needsReport[key] ?? 1) >= 0.9;
    const influenceShare = totalInfluence > 0 ? (classInfluence[key] || 0) / totalInfluence : 0;
    const buffMultiplier = influenceShare > 0.8 ? 2 : influenceShare > 0.5 ? 1.5 : 1;
    const hasInfluenceBuffPrivilege = approval >= 85 && influenceShare >= 0.3;
    const meetsStandardBuffCondition = approval >= 85 && satisfiedNeeds;

    if ((hasInfluenceBuffPrivilege || meetsStandardBuffCondition) && def.buffs.satisfied) {
      const scaledBuff = scaleEffectValues(def.buffs.satisfied, buffMultiplier);
      newActiveBuffs.push({
        class: key,
        ...scaledBuff,
      });
    } else if (approval < 40 && def.buffs.dissatisfied && influenceShare >= 0.3) {
      const scaledDebuff = scaleEffectValues(def.buffs.dissatisfied, buffMultiplier);
      newActiveDebuffs.push({
        class: key,
        ...scaledDebuff,
      });
    }
  });

  let stabilityModifier = 0;
  newActiveBuffs.forEach(buff => {
    if (buff.stability) stabilityModifier += buff.stability;
  });
  newActiveDebuffs.forEach(debuff => {
    if (debuff.stability) stabilityModifier += debuff.stability;
  });
  stabilityModifier -= extraStabilityPenalty;

  const stabilityValue = Math.max(0, Math.min(100, 50 + stabilityModifier * 100));
  const stabilityFactor = Math.min(1.5, Math.max(0.5, 1 + (stabilityValue - 50) / 100));
  const efficiency = adminEfficiency * stabilityFactor;

  const visibleEpoch = epoch;
  const updatedNations = (nations || []).map(nation => {
    const next = { ...nation };
    const visible = visibleEpoch >= (nation.appearEpoch ?? 0) && (nation.expireEpoch == null || visibleEpoch <= nation.expireEpoch);
    if (!visible) return next;
    
    // ========== 外国经济模拟 ==========
    // 初始化库存和预算（如果不存在）
    // 重要：深拷贝inventory对象，避免修改原对象导致React状态更新失败
    if (!next.inventory) {
      next.inventory = {};
    } else {
      next.inventory = { ...next.inventory };
    }
    if (typeof next.budget !== 'number') next.budget = (next.wealth || 800) * 0.5;
    
    // 遍历该国的资源偏差，模拟生产和消耗
    // 新机制：所有资源都有生产和消耗，但速率受bias影响，并自动向目标库存调节
    if (next.economyTraits?.resourceBias) {
      Object.entries(next.economyTraits.resourceBias).forEach(([resourceKey, bias]) => {
        const currentStock = next.inventory[resourceKey] || 0;
        
        // 使用固定的目标库存（不使用动态目标，避免目标变化导致库存看起来不变）
        const targetInventory = 500;
        
        // 计算生产和消耗速率（所有资源都有生产和消耗）
        // bias > 1: 特产资源，生产快消耗慢
        // bias < 1: 稀缺资源，生产慢消耗快
        // bias = 1: 中性资源，生产消耗平衡
        
        const baseProductionRate = 3.0 * gameSpeed; // 基础生产速率
        const baseConsumptionRate = 3.0 * gameSpeed; // 基础消耗速率
        
        // 生产速率受bias正向影响：bias越高生产越快
        const productionRate = baseProductionRate * bias;
        
        // 消耗速率受bias反向影响：bias越低消耗越快
        const consumptionRate = baseConsumptionRate / bias;
        
        // 自动调节机制：当库存偏离目标时，调整生产/消耗速率
        const stockRatio = currentStock / targetInventory;
        let adjustmentFactor = 1.0;
        
        if (stockRatio > 1.5) {
          // 库存过高：减少生产，增加消耗
          adjustmentFactor = 0.5;
        } else if (stockRatio < 0.5) {
          // 库存过低：增加生产，减少消耗
          adjustmentFactor = 1.5;
        }
        
        // 应用调节因子
        const finalProduction = productionRate * (stockRatio > 1.5 ? adjustmentFactor : 1.0);
        const finalConsumption = consumptionRate * (stockRatio < 0.5 ? adjustmentFactor : 1.0);
        
        // 计算净变化
        const netChange = finalProduction - finalConsumption;
        
        // 更新库存，确保不低于最小值
        const minInventory = targetInventory * 0.3; // 最小库存为目标的30%
        const maxInventory = targetInventory * 2.0; // 最大库存为目标的2倍
        next.inventory[resourceKey] = Math.max(minInventory, Math.min(maxInventory, currentStock + netChange));
      });
    }
    
    // 资金恢复：预算缓慢向财富基准值回归（模拟税收和内部贸易）
    const targetBudget = (next.wealth || 800) * 0.5;
    const budgetRecoveryRate = 0.02; // 每tick恢复2%的差距
    const budgetDiff = targetBudget - next.budget;
    next.budget = next.budget + (budgetDiff * budgetRecoveryRate * gameSpeed);
    next.budget = Math.max(0, next.budget); // 确保预算不为负
    // ========== 外国经济模拟结束 ==========
    if (next.isAtWar) {
      next.warDuration = (next.warDuration || 0) + 1;
      if (visibleEpoch >= 1) {
        const disadvantage = Math.max(0, -(next.warScore || 0));
        const raidChance = Math.min(0.18, 0.02 + (next.aggression || 0.2) * 0.04 + disadvantage / 400);
        if (Math.random() < raidChance) {
          const raidStrength = 0.05 + (next.aggression || 0.2) * 0.05 + disadvantage / 1200;
          const foodLoss = Math.floor((res.food || 0) * raidStrength);
          const silverLoss = Math.floor((res.silver || 0) * (raidStrength / 2));
          if (foodLoss > 0) res.food = Math.max(0, (res.food || 0) - foodLoss);
          if (silverLoss > 0) res.silver = Math.max(0, (res.silver || 0) - silverLoss);
          const popLoss = Math.min(3, Math.max(1, Math.floor(raidStrength * 20)));
          raidPopulationLoss += popLoss;
          logs.push(`❗ ${next.name} 的突袭夺走了粮食 ${foodLoss}、银币 ${silverLoss}，人口损失 ${popLoss}。`);
        }
      }
      if ((next.warScore || 0) > 12) {
        const willingness = Math.min(0.5, 0.03 + (next.warScore || 0) / 120 + (next.warDuration || 0) / 400) + Math.min(0.15, (next.enemyLosses || 0) / 500);
        if (Math.random() < willingness) {
          const tribute = Math.min(next.wealth || 0, Math.max(50, Math.ceil((next.warScore || 0) * 30 + (next.enemyLosses || 0) * 2)));
          if (tribute > 0) {
            res.silver = (res.silver || 0) + tribute;
            rates.silver = (rates.silver || 0) + tribute;
            next.wealth = Math.max(0, (next.wealth || 0) - tribute);
          }
          logs.push(`🤝 ${next.name} 请求和平，并支付了 ${tribute} 银币。`);
          next.isAtWar = false;
          next.warScore = 0;
          next.warDuration = 0;
          next.enemyLosses = 0;
          next.relation = Math.max(35, next.relation || 0);
        }
      }
    } else if (next.warDuration) {
      next.warDuration = 0;
    }
    const relation = next.relation ?? 50;
    const aggression = next.aggression ?? 0.2;
    const hostility = Math.max(0, (50 - relation) / 70);
    const unrest = stabilityValue < 35 ? 0.02 : 0;
    const declarationChance = visibleEpoch >= 1 ? Math.min(0.08, (aggression * 0.04) + (hostility * 0.04) + unrest) : 0;
    if (!next.isAtWar && relation < 35 && Math.random() < declarationChance) {
      next.isAtWar = true;
      next.warStartDay = tick;
      next.warDuration = 0;
      logs.push(`⚠️ ${next.name} 对你发动了战争！`);
    }
    return next;
  });

  if ((res.food || 0) > population * 1.5 && population < totalMaxPop) {
    const growthBonus = Math.max(0, (stabilityValue - 50) / 150);
    const threshold = Math.max(0.15, 0.5 - Math.min(0.35, growthBonus));
    if (Math.random() > threshold) {
      const growthAmount = Math.min(3, Math.max(1, Math.floor(population * 0.02)));
      nextPopulation = Math.min(totalMaxPop, nextPopulation + growthAmount);
    }
  }
  if ((res.food || 0) <= 0) {
    res.food = 0;
    if (Math.random() > 0.9 && nextPopulation > 2) {
      nextPopulation = nextPopulation - 1;
      logs.push("饥荒导致人口减少！");
    }
  }
  const totalForcedLoss = raidPopulationLoss + exodusPopulationLoss;
  if (totalForcedLoss > 0) {
    nextPopulation = Math.max(0, nextPopulation - totalForcedLoss);
  }

  Object.keys(res).forEach(k => {
    if (res[k] < 0) res[k] = 0;
  });

  const collectedHeadTax = taxBreakdown.headTax * efficiency;
  const collectedIndustryTax = taxBreakdown.industryTax * efficiency;
  const totalCollectedTax = collectedHeadTax + collectedIndustryTax;

  res.silver = (res.silver || 0) + totalCollectedTax;
  rates.silver = (rates.silver || 0) + totalCollectedTax;

  const updatedPrices = { ...priceMap };
  const updatedWages = {};
  const wageSmoothing = 0.35;
  Object.entries(roleWageStats).forEach(([role, data]) => {
    const avgWage = data.totalSlots > 0 ? data.weightedWage / data.totalSlots : 0;
    const prev = previousWages[role] || 0;
    const smoothed = prev + (avgWage - prev) * wageSmoothing;
    updatedWages[role] = Math.max(0, Number(smoothed.toFixed(2)));
  });

  Object.keys(RESOURCES).forEach(resource => {
    if (!isTradableResource(resource)) return;
    const anchorPrice = calculateResourceCost(resource, BUILDINGS, priceMap, updatedWages);
    const sup = supply[resource] || 0;
    const dem = demand[resource] || 0;
    const ratio = dem / Math.max(sup, 1);
    const priceMultiplier = computePriceMultiplier(ratio);
    let targetPrice = anchorPrice * priceMultiplier;
    const costFloor = anchorPrice * 0.6;
    targetPrice = Math.max(targetPrice, costFloor);
    targetPrice = Math.max(targetPrice, PRICE_FLOOR);
    const prevPrice = priceMap[resource] || anchorPrice;
    const smoothed = prevPrice + (targetPrice - prevPrice) * 0.1;
    updatedPrices[resource] = parseFloat(Math.max(PRICE_FLOOR, smoothed).toFixed(2));
  });

  // 增强转职（Migration）逻辑：基于市场价格和潜在收益的职业流动
  const roleVacancies = {};
  ROLE_PRIORITY.forEach(role => {
    roleVacancies[role] = Math.max(0, (jobsAvailable[role] || 0) - (popStructure[role] || 0));
  });

  const activeRoleMetrics = ROLE_PRIORITY.map(role => {
    const pop = popStructure[role] || 0;
    const wealthNow = classWealthResult[role] || 0;
    const prevWealth = classWealth?.[role] || 0;
    const delta = wealthNow - prevWealth;
    const perCap = pop > 0 ? wealthNow / pop : 0;
    const perCapDelta = pop > 0 ? delta / pop : 0;

    const totalIncome = roleWagePayout[role] || 0;
    const totalExpense = roleExpense[role] || 0;
    const netIncome = totalIncome - totalExpense;
    const netIncomePerCapita = netIncome / Math.max(1, pop);
    const roleWage = updatedWages[role] || 0;

    // Net income drives migration; wealth/wage add minor stability for edge cases (e.g., empty roles)
    const potentialIncome = (netIncomePerCapita * 0.75) + (perCap * 0.15) + (roleWage * 0.1);

    return {
      role,
      pop,
      perCap,
      perCapDelta,
      potentialIncome,
      vacancy: roleVacancies[role] || 0,
    };
  });

  const totalMigratablePop = activeRoleMetrics.reduce((sum, r) => r.pop > 0 ? sum + r.pop : sum, 0);
  const averagePotentialIncome = totalMigratablePop > 0
    ? activeRoleMetrics.reduce((sum, r) => sum + (r.potentialIncome * r.pop), 0) / totalMigratablePop
    : 0;

  // 寻找收入低于平均水平的源职业
  const sourceCandidate = activeRoleMetrics
    .filter(r => r.pop > 0 && (r.potentialIncome < averagePotentialIncome * 0.7 || r.perCapDelta < -0.5))
    .reduce((lowest, current) => {
      if (!lowest) return current;
      if (current.potentialIncome < lowest.potentialIncome) return current;
      if (current.potentialIncome === lowest.potentialIncome && current.perCapDelta < lowest.perCapDelta) return current;
      return lowest;
    }, null);

  // 寻找收入显著更高的目标职业（必须有空缺）
  let targetCandidate = null;
  if (sourceCandidate) {
    targetCandidate = activeRoleMetrics
      .filter(r => r.vacancy > 0 && r.potentialIncome > sourceCandidate.potentialIncome * 1.3)
      .reduce((best, current) => {
        if (!best) return current;
        if (current.potentialIncome > best.potentialIncome) return current;
        if (current.potentialIncome === best.potentialIncome && current.perCapDelta > best.perCapDelta) return current;
        return best;
      }, null);
  }

  // 执行转职并转移财富
  if (sourceCandidate && targetCandidate) {
    let migrants = Math.floor(sourceCandidate.pop * JOB_MIGRATION_RATIO);
    if (migrants <= 0 && sourceCandidate.pop > 0) migrants = 1;
    migrants = Math.min(migrants, targetCandidate.vacancy);
    
    if (migrants > 0) {
      // 关键：执行财富转移
      const sourceWealth = wealth[sourceCandidate.role] || 0;
      const perCapWealth = sourceCandidate.pop > 0 ? sourceWealth / sourceCandidate.pop : 0;
      const migratingWealth = perCapWealth * migrants;
      
      if (migratingWealth > 0) {
        wealth[sourceCandidate.role] = Math.max(0, sourceWealth - migratingWealth);
        wealth[targetCandidate.role] = (wealth[targetCandidate.role] || 0) + migratingWealth;
      }
      
      // 执行人口转移
      popStructure[sourceCandidate.role] = Math.max(0, sourceCandidate.pop - migrants);
      popStructure[targetCandidate.role] = (popStructure[targetCandidate.role] || 0) + migrants;
      
      const sourceName = STRATA[sourceCandidate.role]?.name || sourceCandidate.role;
      const targetName = STRATA[targetCandidate.role]?.name || targetCandidate.role;
      const incomeGain = ((targetCandidate.potentialIncome - sourceCandidate.potentialIncome) / Math.max(0.01, sourceCandidate.potentialIncome) * 100).toFixed(0);
      logs.push(`💼 ${migrants} 名 ${sourceName} 转职为 ${targetName}（预期收益提升 ${incomeGain}%）`);
    }
  }

  const previousMerchantWealth = classWealthResult.merchant || 0;
  const updatedMerchantState = simulateMerchantTrade({
    res,
    wealth,
    popStructure,
    supply,
    demand,
    nations: updatedNations,
    tick,
    taxPolicies: policies,
    taxBreakdown,
    getLocalPrice: getPrice,
    roleExpense,
    roleWagePayout,
    pendingTrades: merchantState.pendingTrades || [],
    lastTradeTime: merchantState.lastTradeTime || 0,
  });

  applyRoleIncomeToWealth();

  const updatedMerchantWealth = Math.max(0, wealth.merchant || 0);
  const merchantWealthDelta = updatedMerchantWealth - previousMerchantWealth;
  if (merchantWealthDelta !== 0) {
    classWealthResult.merchant = updatedMerchantWealth;
    totalWealth += merchantWealthDelta;
    const merchantDef = STRATA.merchant;
    if (merchantDef) {
      const merchantCount = popStructure.merchant || 0;
      const newInfluence = (merchantDef.influenceBase * merchantCount) + (totalWealth > 0 ? (updatedMerchantWealth / totalWealth) * 10 : 0);
      const influenceDelta = newInfluence - (classInfluence.merchant || 0);
      classInfluence.merchant = newInfluence;
      totalInfluence += influenceDelta;
    }
  }

  const netTax = totalCollectedTax - taxBreakdown.subsidy;
  const taxes = {
    total: netTax,
    efficiency,
    breakdown: {
      headTax: collectedHeadTax,
      industryTax: collectedIndustryTax,
      subsidy: taxBreakdown.subsidy,
    },
  };

  return {
    resources: res,
    rates,
    popStructure,
    maxPop: totalMaxPop,
    adminCap: adminCapacity,
    adminStrain: currentAdminStrain,
    population: nextPopulation,
    classApproval,
    classInfluence,
    classWealth: classWealthResult,
    totalInfluence,
    totalWealth,
    activeBuffs: newActiveBuffs,
    activeDebuffs: newActiveDebuffs,
    stability: stabilityValue,
    logs,
    market: {
      prices: updatedPrices,
      demand,
      supply,
      wages: updatedWages,
      needsShortages: classShortages,
    },
    classIncome: roleWagePayout,
    classExpense: roleExpense,
    jobFill: buildingJobFill,
    taxes,
    needsShortages: classShortages,
    needsReport,
    nations: updatedNations,
    merchantState: updatedMerchantState,
  };
};
