import { BUILDINGS, STRATA, EPOCHS, RESOURCES, TECHS, ECONOMIC_INFLUENCE } from '../config';
import { calculateArmyPopulation, calculateArmyFoodNeed, calculateArmyCapacityNeed } from '../config';
import { isResourceUnlocked } from '../utils/resources';
import { calculateForeignPrice } from '../utils/foreignTrade';
import { simulateBattle, UNIT_TYPES } from '../config/militaryUnits';
import { getEnemyUnitsForEpoch } from '../config/militaryActions';

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

const JOB_MIGRATION_RATIO = 0.1;

const clamp = (value, min, max) => {
  if (!Number.isFinite(value)) return min;
  if (value < min) return min;
  if (value > max) return max;
  return value;
};


const SPECIAL_TRADE_RESOURCES = new Set(['science', 'culture']);
const isTradableResource = (key) => {
  if (key === 'silver') return false;
  const def = RESOURCES[key];
  if (!def) return false;
  if (SPECIAL_TRADE_RESOURCES.has(key)) return true;
  return !def.type || def.type !== 'virtual';
};

// 冷却：敌国主动求和间隔（天），约等于 1 个月
const PEACE_REQUEST_COOLDOWN_DAYS = 30;
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
  currentWages = {},
  priceLivingCosts = {},
  wageLivingCosts = {}  // 新增参数：用于工资计算的生活成本权重
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

  const resolveWage = (role) => {
    const wage = currentWages?.[role];
    if (Number.isFinite(wage) && wage > 0) {
      return wage;
    }
    // Use static BASE_WAGE_REFERENCE (1) instead of global avgWage fallback
    return BASE_WAGE_REFERENCE;
  };

  const basePrice = getBasePrice(resourceKey);

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
      const isSelfOwned = primaryBuilding.owner && primaryBuilding.jobs && primaryBuilding.jobs[primaryBuilding.owner];

      if (primaryBuilding.jobs && !isSelfOwned) {
        Object.entries(primaryBuilding.jobs).forEach(([role, slots]) => {
          if (!slots || slots <= 0) return;
          laborCost += slots * resolveWage(role);
        });
      }

      const unitCost = (inputCost + laborCost) / totalOutput;
      if (Number.isFinite(unitCost) && unitCost > 0) {
        return Math.max(PRICE_FLOOR, Math.max(unitCost, basePrice));
      }
    }
  }

  // New Fallback: Use base price as the cost anchor for raw materials,
  // avoiding all wage-driven inflation for resources without primary buildings
  return basePrice;
};

const computeLivingCosts = (
  priceMap = {},
  headTaxRates = {},
  resourceTaxRates = {}
) => {
  const breakdown = {};
  Object.entries(STRATA).forEach(([key, def]) => {
    let needsCost = 0;
    let taxCost = 0;
    const needs = def.needs || {};
    Object.entries(needs).forEach(([resKey, perCapita]) => {
      if (!perCapita || perCapita <= 0) return;
      const price =
        priceMap?.[resKey] ??
        RESOURCES[resKey]?.basePrice ??
        getBasePrice(resKey);
      if (!Number.isFinite(price) || price <= 0) return;
      const taxRate = Math.max(0, resourceTaxRates?.[resKey] || 0);
      needsCost += perCapita * price;
      taxCost += perCapita * price * taxRate;
    });
    const headBase = Math.max(0, def.headTaxBase ?? 0);
    const headRate = Math.max(0, headTaxRates?.[key] ?? 1);
    taxCost += headBase * headRate;
    breakdown[key] = {
      needsCost: Number.isFinite(needsCost) ? needsCost : 0,
      taxCost: Number.isFinite(taxCost) ? taxCost : 0,
    };
  });
  return breakdown;
};

const buildLivingCostMap = (breakdown = {}, weights = {}) => {
  const livingWeight = Number.isFinite(weights.livingCostWeight)
    ? weights.livingCostWeight
    : 1;
  const taxWeight = Number.isFinite(weights.taxCostWeight)
    ? weights.taxCostWeight
    : 1;
  const map = {};
  Object.entries(breakdown).forEach(([key, value]) => {
    const needs = value?.needsCost || 0;
    const tax = value?.taxCost || 0;
    map[key] = Math.max(0, needs * livingWeight + tax * taxWeight);
  });
  return map;
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
  gameSpeed = 1,
  logs,
}) => {
  const merchantCount = popStructure?.merchant || 0;
  if (merchantCount <= 0) {
    return { pendingTrades, lastTradeTime };
  }

  const resourceTaxRates = taxPolicies?.resourceTaxRates || {};
  const getResourceTaxRate = (resource) => resourceTaxRates[resource] || 0; // 允许负税率

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
      console.log(`[商人调试] ⏳ 交易冷却中，还需等待 ${(tradeConfig.tradeCooldown - ticksSinceLastTrade).toFixed(1)} 天`);
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
    
    const isExportable = foreignPrice > localPrice && 
                         profitMargin >= tradeConfig.minProfitMargin &&
                         availableStock > 0;
    
    const isImportable = foreignPrice < localPrice && 
                         profitMargin >= tradeConfig.minProfitMargin;
    
    if (isExportable) exportableResources.push(key);
    if (isImportable) importableResources.push(key);
  });

  const simCount = merchantCount > 100 ? 100 : merchantCount;
  const batchMultiplier = merchantCount > 100 ? merchantCount / 100 : 1;

  // 限制每tick的新交易数量，防止性能问题
  const maxNewTrades = Math.min(simCount, 50);

  for (let i = 0; i < maxNewTrades; i++) {
      const currentTotalWealth = wealth.merchant || 0;
      if (currentTotalWealth <= tradeConfig.minWealthForTrade) break;

      const decision = Math.random();
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
          
          if (amount <= 0.1) continue;

          const cost = localPrice * amount;
          const tax = cost * taxRate;
          const revenue = foreignPrice * amount;

          let outlay = cost;
          let appliedTax = 0;

          if (tax < 0) { // Subsidy logic
            const subsidyAmount = Math.abs(tax);
            if ((res.silver || 0) >= subsidyAmount * batchMultiplier) {
              outlay -= subsidyAmount;
              appliedTax = -subsidyAmount;
            } else {
              logs.push(`国库空虚，无法支付出口 ${RESOURCES[resourceKey]?.name || resourceKey} 的交易补贴！`);
            }
          } else {
            outlay += tax;
            appliedTax = tax;
          }

          const profit = revenue - outlay;
          const profitMargin = outlay > 0 ? profit / outlay : (profit > 0 ? Infinity : -Infinity);

          if (profitMargin >= tradeConfig.minProfitMargin) {
              const totalAmount = amount * batchMultiplier;
              const totalOutlay = outlay * batchMultiplier;
              const totalAppliedTax = appliedTax * batchMultiplier;
              
              if ((wealth.merchant || 0) >= totalOutlay && (res[resourceKey] || 0) >= totalAmount) {
                  if (tradeConfig.enableDebugLog && resourceKey === 'cloth') {
                    console.log(`[商人调试] 📦 购买布料准备出口:`, {
                      amount: totalAmount,
                      cost: totalOutlay,
                      expectedRevenue: revenue * batchMultiplier,
                      expectedProfit: profit * batchMultiplier,
                      profitMargin: (profitMargin * 100).toFixed(2) + '%',
                      daysUntilSale: tradeConfig.tradeDuration
                    });
                  }
                  
                  wealth.merchant -= totalOutlay;
                  roleExpense.merchant = (roleExpense.merchant || 0) + totalOutlay;
                  
                  if (totalAppliedTax < 0) {
                    const subsidy = Math.abs(totalAppliedTax);
                    res.silver -= subsidy;
                    taxBreakdown.subsidy += subsidy;
                  } else {
                    taxBreakdown.industryTax += totalAppliedTax;
                  }
                  
                  res[resourceKey] = Math.max(0, (res[resourceKey] || 0) - totalAmount);
                  supply[resourceKey] = Math.max(0, (supply[resourceKey] || 0) - totalAmount);
                  
                  updatedPendingTrades.push({
                    type: 'export',
                    resource: resourceKey,
                    amount: totalAmount,
                    revenue: revenue * batchMultiplier,
                    profit: profit * batchMultiplier,
                    daysRemaining: 3 
                  });
                  
                  lastTradeTime = tick;
              }
          }
      } else if (importableResources.length > 0) { // Import
          const resourceKey = importableResources[Math.floor(Math.random() * importableResources.length)];
          const localPrice = getLocalPrice(resourceKey);
          const foreignPrice = getForeignPrice(resourceKey);

          if (foreignPrice === null || localPrice === null || foreignPrice >= localPrice) continue;
          
          const taxRate = getResourceTaxRate(resourceKey);
          
          const totalPerUnitCost = foreignPrice;
          const affordableAmount = totalPerUnitCost > 0 ? wealthForThisBatch / totalPerUnitCost : 3;
          const amount = Math.min(tradeConfig.maxPurchaseAmount, affordableAmount);
          if (amount <= 0.1) continue;

          const cost = foreignPrice * amount;
          const grossRevenue = localPrice * amount;
          const tax = grossRevenue * taxRate;
          
          let netRevenue = grossRevenue;
          let appliedTax = 0;
          
          if (tax < 0) { // Subsidy
            const subsidyAmount = Math.abs(tax);
            if ((res.silver || 0) >= subsidyAmount * batchMultiplier) {
              netRevenue += subsidyAmount;
              appliedTax = -subsidyAmount;
            } else {
               logs.push(`国库空虚，无法支付进口 ${RESOURCES[resourceKey]?.name || resourceKey} 的交易补贴！`);
            }
          } else { // Tax
            netRevenue -= tax;
            appliedTax = tax;
          }
          
          const profit = netRevenue - cost;
          const profitMargin = cost > 0 ? profit / cost : (profit > 0 ? Infinity : -Infinity);

          if (profitMargin >= tradeConfig.minProfitMargin) {
              const totalAmount = amount * batchMultiplier;
              const totalCost = cost * batchMultiplier;
              const totalNetRevenue = netRevenue * batchMultiplier;
              const totalAppliedTax = appliedTax * batchMultiplier;
              
              if ((wealth.merchant || 0) >= totalCost) {
                  if (tradeConfig.enableDebugLog && resourceKey === 'cloth') {
                    console.log(`[商人调试] 📦 购买布料准备进口:`, {
                      amount: totalAmount,
                      cost: totalCost,
                      expectedNetRevenue: totalNetRevenue,
                      expectedProfit: totalNetRevenue - totalCost,
                      profitMargin: (profitMargin * 100).toFixed(2) + '%',
                      daysUntilSale: tradeConfig.tradeDuration
                    });
                  }
                  
                  wealth.merchant -= totalCost;
                  roleExpense.merchant = (roleExpense.merchant || 0) + totalCost;
                  
                  if (totalAppliedTax < 0) {
                    const subsidy = Math.abs(totalAppliedTax);
                    res.silver -= subsidy;
                    taxBreakdown.subsidy += subsidy;
                  } else {
                    taxBreakdown.industryTax += totalAppliedTax;
                  }

                  updatedPendingTrades.push({
                    type: 'import',
                    resource: resourceKey,
                    amount: totalAmount,
                    revenue: totalNetRevenue,
                    profit: totalNetRevenue - totalCost,
                    daysRemaining: 3
                  });
                  
                  lastTradeTime = tick;
              }
          }
      }
  }
  
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
  militaryQueue = [],
  nations = [],
  tick = 0,
  techsUnlocked = [],
  activeFestivalEffects = [],
  classWealthHistory,
  classNeedsHistory,
  merchantState = { pendingTrades: [], lastTradeTime: 0 },
  maxPopBonus = 0,
  eventApprovalModifiers = {},
  eventStabilityModifier = 0,
  // Economic modifiers from events
  eventResourceDemandModifiers = {},   // { resourceKey: percentModifier }
  eventStratumDemandModifiers = {},    // { stratumKey: percentModifier }
  eventBuildingProductionModifiers = {}, // { buildingIdOrCat: percentModifier }
}) => {
  console.log('[TICK START]', tick);
  const res = { ...resources };
  const priceMap = { ...(market?.prices || {}) };
  const policies = taxPolicies || {};
  const headTaxRates = policies.headTaxRates || {};
  const resourceTaxRates = policies.resourceTaxRates || {};
  const businessTaxRates = policies.businessTaxRates || {};
  const livingCostBreakdown = computeLivingCosts(priceMap, headTaxRates, resourceTaxRates);
  const priceLivingCosts = buildLivingCostMap(
    livingCostBreakdown,
    ECONOMIC_INFLUENCE?.price || {}
  );
  const wageLivingCosts = buildLivingCostMap(
    livingCostBreakdown,
    ECONOMIC_INFLUENCE?.wage || {}
  );
  // 注意：不再在此处全局解构 market 参数，而是在价格计算循环中动态获取
  // 这样可以支持每个资源使用不同的经济参数配置
  const previousWages = market?.wages || {};
  const getLivingCostFloor = (role) => {
    const base = wageLivingCosts?.[role];
    if (!Number.isFinite(base) || base <= 0) {
      return BASE_WAGE_REFERENCE * 0.8;
    }
    return Math.max(BASE_WAGE_REFERENCE * 0.8, base * 1.1);
  };
  const getExpectedWage = (role) => {
    const prev = previousWages?.[role];
    if (Number.isFinite(prev) && prev > 0) {
      return Math.max(PRICE_FLOOR, prev);
    }
    const starting = STRATA[role]?.startingWealth;
    if (Number.isFinite(starting) && starting > 0) {
      return Math.max(BASE_WAGE_REFERENCE * 0.5, starting / 40, getLivingCostFloor(role));
    }
    return Math.max(defaultWageEstimate, getLivingCostFloor(role));
  };
  const demand = {};
  const supply = {};
  const wealth = initializeWealth(classWealth);
  const getHeadTaxRate = (key) => {
    const rate = headTaxRates[key];
    if (typeof rate === 'number') {
      return rate;
    }
    return 1;
  };
  const getResourceTaxRate = (resource) => {
    const rate = resourceTaxRates[resource];
    if (typeof rate === 'number') return rate; // 允许负税率
    return 0;
  };
  const getBusinessTaxRate = (buildingId) => {
    const rate = businessTaxRates[buildingId];
    if (typeof rate === 'number') return rate; // 允许负税率（补贴）
    return 0;
  };
  const taxBreakdown = {
    headTax: 0,
    industryTax: 0,
    businessTax: 0,
    subsidy: 0,
    policyIncome: 0,
    policyExpense: 0,
  };

  const buildingBonuses = {};
  const categoryBonuses = { gather: 1, industry: 1, civic: 1, military: 1 };
  const passiveGains = {};
  let decreeSilverIncome = 0;
  let decreeSilverExpense = 0;
  let extraMaxPop = 0;
  let maxPopPercent = 0;
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
    const passiveSilver = decree.modifiers?.passive?.silver || 0;
    if (passiveSilver > 0) {
      decreeSilverIncome += passiveSilver;
    } else if (passiveSilver < 0) {
      decreeSilverExpense += Math.abs(passiveSilver);
    }
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
    let pressure = Math.tanh(Math.log(safeRatio) * smoothness);
    pressure *= supplyDemandWeight;
    pressure = Math.max(-1, Math.min(1, pressure));
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
      const grossIncome = price * amount;
      const taxRate = getResourceTaxRate(resource);
      const taxAmount = grossIncome * taxRate;
      let netIncome = grossIncome;
      
      if (taxAmount > 0) {
        // 这是一个消费税，不由生产者承担。
        // netIncome = grossIncome - taxAmount;
        // taxBreakdown.industryTax += taxAmount;
      } else if (taxAmount < 0) {
        // 负税率（补贴）：从国库支付补贴
        const subsidyAmount = Math.abs(taxAmount);
        if ((res.silver || 0) >= subsidyAmount) {
          res.silver -= subsidyAmount;
          netIncome = grossIncome + subsidyAmount;
          taxBreakdown.subsidy += subsidyAmount;
        } else {
          // 国库不足，无法支付补贴
          if (tick % 30 === 0) {
            logs.push(`⚠️ 国库空虚，无法为 ${RESOURCES[resource]?.name || resource} 销售支付补贴！`);
          }
        }
      }
      
      // 记录owner的净销售收入（在tick结束时统一结算到wealth）
      roleWagePayout[ownerKey] = (roleWagePayout[ownerKey] || 0) + netIncome;
    }
  };

  const rates = {};
  const builds = buildings;
  const producedResources = new Set();
  const jobsAvailable = {};
  const roleWageStats = {};
  const roleWagePayout = {};
  const directIncomeApplied = {};
  const roleVacancyTargets = {};
  let totalMaxPop = 5;
  let militaryCapacity = 0; // 新增：军事容量
  totalMaxPop += extraMaxPop;
  totalMaxPop += maxPopBonus;
  const armyPopulationDemand = calculateArmyPopulation(army);
  const armyFoodNeed = calculateArmyFoodNeed(army);
  
  // 计算当前军队数量（只包括已完成训练的）
  const currentArmyCount = Object.values(army).reduce((sum, count) => sum + count, 0);
  // 训练队列数量将在后面单独处理
  const totalArmyCount = currentArmyCount;

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
  
  // Track head tax paid separately (not part of living expenses)
  const roleHeadTaxPaid = {};
  Object.keys(STRATA).forEach(key => {
    roleHeadTaxPaid[key] = 0;
  });
  
  // Track business tax paid separately (not part of living expenses)
  const roleBusinessTaxPaid = {};
  Object.keys(STRATA).forEach(key => {
    roleBusinessTaxPaid[key] = 0;
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

  console.log('[TICK] Processing buildings...');
  BUILDINGS.forEach(b => {
    const count = builds[b.id] || 0;
    if (count > 0) {
      if (b.output?.maxPop) totalMaxPop += (b.output.maxPop * count);
      if (b.output?.militaryCapacity) militaryCapacity += (b.output.militaryCapacity * count); // 新增：从建筑获取军事容量
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
  console.log('[TICK] Buildings processed. militaryCapacity:', militaryCapacity);

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
  totalMaxPop = Math.floor(totalMaxPop);

  // 军人岗位包括：已有军队 + 等待人员的岗位 + 训练中的岗位
  const waitingCount = (militaryQueue || []).filter(item => item.status === 'waiting').length;
  const trainingCount = (militaryQueue || []).filter(item => item.status === 'training').length;
  // 总岗位需求 = 现有军队 + 等待招募的 + 正在训练的
  const soldierJobsNeeded = currentArmyCount + waitingCount + trainingCount;
  console.log('[TICK] Adding soldier jobs. currentArmy:', currentArmyCount, 'waiting:', waitingCount, 'training:', trainingCount, 'total:', soldierJobsNeeded);
  if (soldierJobsNeeded > 0) {
    jobsAvailable.soldier = (jobsAvailable.soldier || 0) + soldierJobsNeeded;
  }
  console.log('[TICK] Soldier jobs added. jobsAvailable.soldier:', jobsAvailable.soldier);

  // 职业持久化：基于上一帧状态进行增减，而非每帧重置
  console.log('[TICK] Starting population allocation...');
  const hasPreviousPopStructure = previousPopStructure && Object.keys(previousPopStructure).length > 0;
  const popStructure = {};
  
  let diff = 0;

  if (!hasPreviousPopStructure) {
    // 首次运行：按优先级初始填充（已注释，防止强制重新分配）

    let remainingPop = population;
    ROLE_PRIORITY.forEach(role => {
      const slots = Math.max(0, jobsAvailable[role] || 0);
      const filled = Math.min(remainingPop, slots);
      popStructure[role] = filled;
      remainingPop -= filled;
    });
    popStructure.unemployed = Math.max(0, remainingPop);
    
    
    // 改为直接设置默认人口结构
    ROLE_PRIORITY.forEach(role => {
      popStructure[role] = 0;
    });
    popStructure.unemployed = population;
  } else {
    // 继承上一帧状态
    ROLE_PRIORITY.forEach(role => {
      const prevCount = (previousPopStructure[role] || 0);
      popStructure[role] = Math.max(0, prevCount);
    });
    popStructure.unemployed = Math.max(0, (previousPopStructure.unemployed || 0));
    
    // 处理人口变化（增长或减少）
    const assignedPop = ROLE_PRIORITY.reduce((sum, role) => sum + (popStructure[role] || 0), 0) + (popStructure.unemployed || 0);
    diff = population - assignedPop;
    
    if (diff > 0) {
      // 人口增长：新人加入失业者
      popStructure.unemployed = (popStructure.unemployed || 0) + diff;
    } else if (diff < 0) {
      // 人口减少：仅从失业者中扣除，不自动从各职业扣除（防止人口被吸走）
      let reductionNeeded = -diff;
      const unemployedReduction = Math.min(popStructure.unemployed || 0, reductionNeeded);
      if (unemployedReduction > 0) {
        popStructure.unemployed -= unemployedReduction;
        reductionNeeded -= unemployedReduction;
      }
      
      // 注释掉自动从各职业扣除人口的逻辑
      // 如果还需要减少人口，保持现状（不自动重新分配）
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

  // 计算加权平均工资（基于人口权重，而非算术平均）
  let totalWeightedWage = 0;
  let totalPopulation = 0;
  
  Object.keys(popStructure).forEach(role => {
    const popCount = popStructure[role] || 0;
    const wageValue = previousWages[role] || 0;
    
    if (popCount > 0 && wageValue > 0) {
      totalWeightedWage += wageValue * popCount;
      totalPopulation += popCount;
    }
  });
  
  // 使用加权平均工资替换原来的算术平均工资
  const defaultWageEstimate = totalPopulation > 0 
    ? totalWeightedWage / totalPopulation 
    : BASE_WAGE_REFERENCE;

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

  let taxModifier = 1.0;

  const effectiveTaxModifier = Math.max(0, taxModifier);

  // 自动填补（招工）：失业者优先进入净收入更高的岗位
  const estimateRoleNetIncome = (role) => {
    const wage = getExpectedWage(role);
    const headBase = STRATA[role]?.headTaxBase ?? 0.01;
    const taxCost = headBase * getHeadTaxRate(role) * effectiveTaxModifier;
    return wage - Math.max(0, taxCost);
  };

    console.log('[vacancy debug] diff =', diff, ', unemployed =', popStructure.unemployed || 0);
  const vacancyRanking = ROLE_PRIORITY.map((role, index) => {
    const slots = Math.max(0, jobsAvailable[role] || 0);
    const current = popStructure[role] || 0;
    const vacancy = Math.max(0, slots - current);
    if (role === 'soldier') {
      console.log('[SOLDIER VACANCY] slots:', slots, 'current:', current, 'vacancy:', vacancy);
    }
    if (vacancy <= 0) return null;
    return {
      role,
      vacancy,
      netIncome: estimateRoleNetIncome(role),
      priorityIndex: index,
    };
  })
    .filter(Boolean)
    .sort((a, b) => {
      if (b.netIncome !== a.netIncome) return b.netIncome - a.netIncome;
      return a.priorityIndex - b.priorityIndex;
    });
  
  console.log('[VACANCY RANKING]', vacancyRanking.map(v => `${v.role}:${v.vacancy}`).join(', '));

  vacancyRanking.forEach(entry => {
    const availableUnemployed = popStructure.unemployed || 0;
    if (availableUnemployed <= 0) return;

    const hiring = Math.min(entry.vacancy, availableUnemployed);
    if (hiring <= 0) return;

    // 招工：失业者填补岗位，并携带财富
    const unemployedWealth = wealth.unemployed || 0;
    const perCapWealth = availableUnemployed > 0 ? unemployedWealth / availableUnemployed : 0;

    popStructure[entry.role] = (popStructure[entry.role] || 0) + hiring;
    popStructure.unemployed = Math.max(0, availableUnemployed - hiring);

    if (entry.role === 'soldier') {
      console.log('[SOLDIER HIRING] hired:', hiring, 'new soldier count:', popStructure[entry.role]);
    }

    if (perCapWealth > 0) {
      const transfer = perCapWealth * hiring;
      wealth.unemployed = Math.max(0, unemployedWealth - transfer);
      wealth[entry.role] = (wealth[entry.role] || 0) + transfer;
    }
  });

  const classApproval = {};
  const classInfluence = {};
  const classWealthResult = {};
  const logs = [];
  const buildingJobFill = {};

  Object.entries(passiveGains).forEach(([resKey, amountPerDay]) => {
    if (!amountPerDay) return;
    const gain = amountPerDay;
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
    if (wealth[key] === undefined) {
      wealth[key] = def.startingWealth || 0;
    }
    const headRate = getHeadTaxRate(key);
    const headBase = STRATA[key]?.headTaxBase ?? 0.01;
    const due = count * headBase * headRate * effectiveTaxModifier;
    if (due !== 0) {
      const available = wealth[key] || 0;
      if (due > 0) {
        const paid = Math.min(available, due);
        wealth[key] = available - paid;
        taxBreakdown.headTax += paid;
        // 记录人头税支出
        roleHeadTaxPaid[key] = (roleHeadTaxPaid[key] || 0) + paid;
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

  console.log('[TICK] Starting production loop...');
  BUILDINGS.forEach(b => {
    const count = builds[b.id] || 0;
    if (count === 0) return;

    const ownerKey = b.owner || 'state';
    if (wealth[ownerKey] === undefined) {
      wealth[ownerKey] = STRATA[ownerKey]?.startingWealth || 0;
    }

    let multiplier = 1.0;
    const currentEpoch = EPOCHS[epoch];

    if (currentEpoch && currentEpoch.bonuses) {
      if (b.cat === 'gather' && currentEpoch.bonuses.gatherBonus) {
        multiplier *= (1 + currentEpoch.bonuses.gatherBonus);
      }
      if (b.cat === 'industry' && currentEpoch.bonuses.industryBonus) {
        multiplier *= (1 + currentEpoch.bonuses.industryBonus);
      }
    }
    
    // Apply global production/industry modifiers
    let productionModifier = 1.0;
    let industryModifier = 1.0;
    productionBuffs.forEach(buff => {
        if (buff.production) productionModifier += buff.production;
        if (buff.industryBonus) industryModifier += buff.industryBonus;
    });
    productionDebuffs.forEach(debuff => {
        if (debuff.production) productionModifier += debuff.production;
        if (debuff.industryBonus) industryModifier += debuff.industryBonus;
    });
    productionModifier *= (1 + productionBonus);
    industryModifier *= (1 + industryBonus);

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
    
    // Apply event building production modifiers
    // Check for specific building modifier first, then category modifier
    const buildingSpecificMod = eventBuildingProductionModifiers[b.id] || 0;
    const buildingCategoryMod = eventBuildingProductionModifiers[b.cat] || 0;
    // Also check for 'all' modifier that affects all buildings
    const buildingAllMod = eventBuildingProductionModifiers['all'] || 0;
    const totalEventMod = buildingSpecificMod + buildingCategoryMod + buildingAllMod;
    if (totalEventMod !== 0) {
      multiplier *= (1 + totalEventMod);
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
    const wagePlans = [];
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
        const vacancySlots = Math.max(0, roleRequired - roleFilled);
        if (vacancySlots > 1e-3) {
          const availableSlots = vacancySlots >= 1 ? Math.floor(vacancySlots) : 1;
          const vacancyList = roleVacancyTargets[role] || (roleVacancyTargets[role] = []);
          vacancyList.push({
            buildingId: b.id,
            buildingName: b.name || b.id,
            availableSlots,
          });
        }
        if (role !== ownerKey && roleFilled > 0) {
          const cached = roleExpectedWages[role] ?? getExpectedWage(role);
          const livingFloor = getLivingCostFloor(role);
          const adjustedWage = Math.max(cached, livingFloor);
          roleExpectedWages[role] = adjustedWage;
          expectedWageBillBase += roleFilled * adjustedWage;
          wagePlans.push({
            role,
            roleSlots: roleRequired,
            filled: roleFilled,
            baseWage: adjustedWage,
          });
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
          const taxRate = getResourceTaxRate(resKey); // Allow negative
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
        if (resKey === 'maxPop') continue;
        if (!isTradableResource(resKey)) continue;
        producesTradableOutput = true;
        const perMultiplierAmount = perUnit * count;
        const grossValue = perMultiplierAmount * getPrice(resKey);
        const taxRate = getResourceTaxRate(resKey);
        // 计算税后净收入：正税率减少收入，负税率（补贴）增加收入
        const netValue = grossValue * (1 - taxRate);
        outputValuePerMultiplier += netValue;
      }
    }

    const baseWageCostPerMultiplier = baseMultiplier > 0 ? expectedWageBillBase / baseMultiplier : expectedWageBillBase;
    const estimatedRevenue = outputValuePerMultiplier * targetMultiplier;
    const estimatedInputCost = inputCostPerMultiplier * targetMultiplier;
    const baseWageCost = baseWageCostPerMultiplier * targetMultiplier;
    const valueAvailableForLabor = Math.max(0, estimatedRevenue - estimatedInputCost);
    const wageCoverage = baseWageCost > 0 ? valueAvailableForLabor / baseWageCost : 1;
    const wagePressure = (() => {
      if (!Number.isFinite(wageCoverage)) return 1;
      if (wageCoverage >= 1) {
        return Math.min(1.4, 1 + (wageCoverage - 1) * 0.35);
      }
      return Math.max(0.65, 1 - (1 - wageCoverage) * 0.5);
    })();
    const wageCostPerMultiplier = baseWageCostPerMultiplier * wagePressure;
    const estimatedWageCost = wageCostPerMultiplier * targetMultiplier;
    
    // 预估营业税成本
    const businessTaxPerBuilding = getBusinessTaxRate(b.id);
    const estimatedBusinessTax = businessTaxPerBuilding * count * targetMultiplier;
    
    const totalOperatingCostPerMultiplier = inputCostPerMultiplier + wageCostPerMultiplier;
    let actualMultiplier = targetMultiplier;
    if (producesTradableOutput) {
      // 将营业税计入总成本（只考虑正税，补贴不计入成本）
      const estimatedCost = estimatedInputCost + estimatedWageCost + Math.max(0, estimatedBusinessTax);
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
          // 先不统计需求，等实际消费后再统计
          const price = getPrice(resKey);
          const taxRate = getResourceTaxRate(resKey);
          const baseCost = consumed * price;
          const taxPaid = baseCost * taxRate;
          let totalCost = baseCost;

          if (taxPaid < 0) {
            const subsidyAmount = Math.abs(taxPaid);
            if ((res.silver || 0) >= subsidyAmount) {
              res.silver -= subsidyAmount;
              taxBreakdown.subsidy += subsidyAmount;
              totalCost -= subsidyAmount;
            } else {
              if (tick % 20 === 0) {
                 logs.push(`国库空虚，无法为 ${b.name} 支付 ${RESOURCES[resKey]?.name || resKey} 交易补贴！`);
              }
            }
          } else if (taxPaid > 0) {
            taxBreakdown.industryTax += taxPaid;
            totalCost += taxPaid;
          }
          
          wealth[ownerKey] = Math.max(0, (wealth[ownerKey] || 0) - totalCost);
          roleExpense[ownerKey] = (roleExpense[ownerKey] || 0) + totalCost;
          
          // 统计实际消费的需求量，而不是原始需求量
          demand[resKey] = (demand[resKey] || 0) + consumed;
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
      });
    }

    const preparedWagePlans = wagePlans.map(plan => {
      const expectedSlotWage = plan.baseWage * utilization * wagePressure;
      const due = expectedSlotWage * plan.filled;
      plannedWageBill += due;
      return {
        ...plan,
        expectedSlotWage,
      };
    });

    let wageRatio = 0;
    if (plannedWageBill > 0) {
      const available = wealth[ownerKey] || 0;
      const paid = Math.min(available, plannedWageBill);
      wealth[ownerKey] = available - paid;
      // 记录owner支付工资的支出
      roleExpense[ownerKey] = (roleExpense[ownerKey] || 0) + paid;
      wageRatio = paid / plannedWageBill;
    }

    preparedWagePlans.forEach(plan => {
      const actualSlotWage = plan.expectedSlotWage * wageRatio;
      roleWageStats[plan.role].weightedWage += actualSlotWage * plan.roleSlots;
      if (plan.filled > 0 && actualSlotWage > 0) {
        const payout = actualSlotWage * plan.filled;
        roleWagePayout[plan.role] = (roleWagePayout[plan.role] || 0) + payout;
      }
    });

    if (b.output) {
      for (const [resKey, perUnit] of Object.entries(b.output)) {
        let amount = perUnit * count * actualMultiplier;
        if (!amount || amount <= 0) continue;
        
        // 为可交易资源添加产出浮动（80%-120%）
        if (isTradableResource(resKey) && resKey !== 'silver') {
          const resourceDef = RESOURCES[resKey];
          const resourceMarketConfig = resourceDef?.marketConfig || {};
          const defaultMarketInfluence = ECONOMIC_INFLUENCE?.market || {};
          const outputVariation = resourceMarketConfig.outputVariation !== undefined
            ? resourceMarketConfig.outputVariation
            : (defaultMarketInfluence.outputVariation || 0.2);
          
          // 产出浮动：(1 - variation) 到 (1 + variation)
          const variationFactor = 1 + (Math.random() * 2 - 1) * outputVariation;
          amount *= variationFactor;
        }
        
        if (resKey === 'maxPop') {
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

    // 营业税收取：每次建筑产出时收取固定银币值
    // businessTaxPerBuilding 已在上面声明，直接使用
    if (businessTaxPerBuilding !== 0 && count > 0) {
      const totalBusinessTax = businessTaxPerBuilding * count * actualMultiplier;
      
      if (totalBusinessTax > 0) {
        // 正值：收税
        const ownerWealth = wealth[ownerKey] || 0;
        if (ownerWealth >= totalBusinessTax) {
          // 业主有足够财产支付营业税
          wealth[ownerKey] = ownerWealth - totalBusinessTax;
          // 营业税单独统计，不计入生活支出
          roleBusinessTaxPaid[ownerKey] = (roleBusinessTaxPaid[ownerKey] || 0) + totalBusinessTax;
          taxBreakdown.businessTax += totalBusinessTax;
        } else {
          // 业主财产不足，放弃收税
          if (tick % 30 === 0 && ownerWealth < totalBusinessTax * 0.5) {
            logs.push(`⚠️ ${STRATA[ownerKey]?.name || ownerKey} 无力支付 ${b.name} 的营业税，政府放弃征收。`);
          }
        }
      } else if (totalBusinessTax < 0) {
        // 负值：补贴
        const subsidyAmount = Math.abs(totalBusinessTax);
        const treasury = res.silver || 0;
        if (treasury >= subsidyAmount) {
          res.silver = treasury - subsidyAmount;
          wealth[ownerKey] = (wealth[ownerKey] || 0) + subsidyAmount;
          roleWagePayout[ownerKey] = (roleWagePayout[ownerKey] || 0) + subsidyAmount;
          taxBreakdown.subsidy += subsidyAmount;
        } else {
          if (tick % 30 === 0) {
            logs.push(`⚠️ 国库空虚，无法为 ${b.name} 支付营业补贴！`);
          }
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
          const actualWagePerSlot = 0; // This seems to be a bug in original code, should be defined.
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
    const wageDue = baseArmyWage;
    const available = res.silver || 0;
    if (available >= wageDue) {
      res.silver = available - wageDue;
      rates.silver = (rates.silver || 0) - wageDue;
      roleWagePayout.soldier = (roleWagePayout.soldier || 0) + wageDue;
    } else if (wageDue > 0) {
      logs.push('银币不足，军饷被拖欠，军心不稳。');
    }
  }

  console.log('[TICK] Production loop completed.');
  
  // Add all tracked income (civilian + military) to the wealth of each class
  applyRoleIncomeToWealth();

  console.log('[TICK] Starting needs calculation...');
  const needsReport = {};
  const classShortages = {};
  Object.keys(STRATA).forEach(key => {
    const def = STRATA[key];
    const count = popStructure[key] || 0;
    if (count === 0 || !def.needs) {
      needsReport[key] = { satisfactionRatio: 1, totalTrackedNeeds: 0 };
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
      
      // 基础需求量
      let requirement = perCapita * count * needsRequirementMultiplier;
      if (requirement <= 0) continue;
      
      // Apply event economic modifiers
      // 1. Resource-specific demand modifier (e.g., cloth demand +20%)
      const resourceDemandMod = eventResourceDemandModifiers[resKey] || 0;
      if (resourceDemandMod !== 0) {
        requirement *= (1 + resourceDemandMod);
      }
      // 2. Stratum-specific demand modifier (e.g., noble consumption +15%)
      const stratumDemandMod = eventStratumDemandModifiers[key] || 0;
      if (stratumDemandMod !== 0) {
        requirement *= (1 + stratumDemandMod);
      }
      
      // 应用需求弹性调整
      if (isTradableResource(resKey)) {
        const resourceMarketConfig = resourceInfo?.marketConfig || {};
        const defaultMarketInfluence = ECONOMIC_INFLUENCE?.market || {};
        const demandElasticity = resourceMarketConfig.demandElasticity !== undefined
          ? resourceMarketConfig.demandElasticity
          : (defaultMarketInfluence.demandElasticity || 0.5);
        
        // 1. 财富影响：阶层财富相对于起始财富的变化
        const startingWealth = def.startingWealth || 1;
        const currentWealth = (wealth[key] || 0) / Math.max(1, count);
        const wealthRatio = currentWealth / startingWealth;
        // 财富每增加100%，需求增加50%（可调整）
        const wealthMultiplier = 1 + (wealthRatio - 1) * 0.5;
        
        // 2. 价格影响：当前价格相对于基础价格的变化
        const currentPrice = getPrice(resKey);
        const basePrice = resourceInfo.basePrice || 1;
        const priceRatio = currentPrice / basePrice;
        // 价格变化对需求的影响：价格上涨→需求下降，价格下跌→需求上涨
        // 使用需求弹性：价格变化1%，需求反向变化elasticity%
        const priceMultiplier = Math.pow(priceRatio, -demandElasticity);
        
        // 3. 每日随机浮动（80%-120%）
        const dailyVariation = 0.8 + Math.random() * 0.4;
        
        // 综合调整需求
        requirement *= wealthMultiplier * priceMultiplier * dailyVariation;
        
        // 确保需求不会变成负数或过大
        requirement = Math.max(0, requirement);
        requirement = Math.min(requirement, perCapita * count * needsRequirementMultiplier * 3); // 最多3倍
      }
      const available = res[resKey] || 0;
      let satisfied = 0;

      if (isTradableResource(resKey)) {
        const price = getPrice(resKey);
        const priceWithTax = price * (1 + getResourceTaxRate(resKey));
        const affordable = priceWithTax > 0 ? Math.min(requirement, (wealth[key] || 0) / priceWithTax) : requirement;
        const amount = Math.min(requirement, available, affordable);
        // 先不统计需求，等实际消费后再统计
        if (amount > 0) {
          res[resKey] = available - amount;
          rates[resKey] = (rates[resKey] || 0) - amount;
          const taxRate = getResourceTaxRate(resKey);
          const baseCost = amount * price;
          const taxPaid = baseCost * taxRate;
          let totalCost = baseCost;

          if (taxPaid < 0) {
            const subsidyAmount = Math.abs(taxPaid);
            if ((res.silver || 0) >= subsidyAmount) {
              res.silver -= subsidyAmount;
              taxBreakdown.subsidy += subsidyAmount;
              totalCost -= subsidyAmount;
            } else {
              if (tick % 20 === 0) {
                 logs.push(`国库空虚，无法为 ${STRATA[key]?.name || key} 支付 ${RESOURCES[resKey]?.name || resKey} 消费补贴！`);
              }
            }
          } else if (taxPaid > 0) {
            taxBreakdown.industryTax += taxPaid;
            totalCost += taxPaid;
          }
  
          wealth[key] = Math.max(0, (wealth[key] || 0) - totalCost);
          roleExpense[key] = (roleExpense[key] || 0) + totalCost;
          satisfied = amount;
          
          // 统计实际消费的需求量，而不是原始需求量
          demand[resKey] = (demand[resKey] || 0) + amount;
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
    const needLevel = needsReport[key]?.satisfactionRatio ?? 1;
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
      if (d.id === 'forced_labor') {
        if (popStructure.serf > 0) classApproval.serf = Math.max(0, (classApproval.serf || 50) - 20);
        if (popStructure.miner > 0) classApproval.miner = Math.max(0, (classApproval.miner || 50) - 15);
        if (popStructure.landowner > 0) classApproval.landowner = Math.min(100, (classApproval.landowner || 50) + 10);
      }
      if (d.id === 'tithe') {
        if (popStructure.cleric > 0) classApproval.cleric = Math.max(0, (classApproval.cleric || 50) - 10);
        const titheDue = (popStructure.cleric || 0) * 2 * effectiveTaxModifier;
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
    const taxPerCapita = Math.max(0, headBase * headRate * effectiveTaxModifier);
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
    const eventBonus = eventApprovalModifiers?.[key] || 0;
    if (eventBonus) {
      targetApproval += eventBonus;
    }
    const currentApproval = classApproval[key] || 50;
    const adjustmentSpeed = 0.08; // How slowly approval changes per tick
    let newApproval = currentApproval + (targetApproval - currentApproval) * adjustmentSpeed;
    
    classApproval[key] = Math.max(0, Math.min(100, newApproval));
  });

  if ((popStructure.unemployed || 0) === 0 && previousApproval.unemployed !== undefined) {
    classApproval.unemployed = Math.min(100, previousApproval.unemployed + 5);
  }


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
    const satisfiedNeeds = (needsReport[key]?.satisfactionRatio ?? 1) >= 0.9;
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

  // Calculate weighted average of class approval based on influence share
  let weightedApprovalSum = 0;
  let totalWeight = 0;
  
  Object.keys(STRATA).forEach(key => {
    const count = popStructure[key] || 0;
    if (count === 0) return;
    const approval = classApproval[key] || 50;
    const influence = classInfluence[key] || 0;
    const influenceShare = totalInfluence > 0 ? influence / totalInfluence : 0;
    
    weightedApprovalSum += approval * influenceShare;
    totalWeight += influenceShare;
  });
  
  // Base stability from weighted average of class approval
  let baseStability = totalWeight > 0 ? weightedApprovalSum : 50;
  if (eventStabilityModifier) {
    baseStability += eventStabilityModifier;
  }
  
  // Add buff/debuff modifiers
  let stabilityModifier = 0;
  newActiveBuffs.forEach(buff => {
    if (buff.stability) stabilityModifier += buff.stability;
  });
  newActiveDebuffs.forEach(debuff => {
    if (debuff.stability) stabilityModifier += debuff.stability;
  });
  stabilityModifier -= extraStabilityPenalty;

  // Final stability value: base + modifiers, clamped to 0-100
  const stabilityValue = Math.max(0, Math.min(100, baseStability + stabilityModifier));
  const stabilityFactor = Math.min(1.5, Math.max(0.5, 1 + (stabilityValue - 50) / 100));
  const efficiency = stabilityFactor;

  const visibleEpoch = epoch;
  // 记录本回合来自战争赔款（含分期）的财政收入
  let warIndemnityIncome = 0;
  const playerPopulationBaseline = Math.max(5, population || 5);
  const playerWealthBaseline = Math.max(100, (res.silver ?? resources?.silver ?? 0));

  let updatedNations = (nations || []).map(nation => {
    const next = { ...nation };
    const visible = visibleEpoch >= (nation.appearEpoch ?? 0) && (nation.expireEpoch == null || visibleEpoch <= nation.expireEpoch);
    if (!visible) {
      // 当国家因时代变化而不可见时，清除战争状态和相关数据
      if (next.isAtWar) {
        next.isAtWar = false;
        next.warDuration = 0;
        next.warScore = 0;
        next.warStartDay = undefined;
        logs.push(`🕊️ 随着时代变迁，与 ${next.name} 的战争已成为历史。`);
      }
      return next;
    }

    next.foreignPower = { ...(next.foreignPower || {}) };
    const foreignPowerProfile = next.foreignPower;
    const templateWealth = next.wealthTemplate || next.wealth || 800;
    if (foreignPowerProfile.baseRating == null) {
      foreignPowerProfile.baseRating = Math.max(0.4, templateWealth / 800);
    }
    const resolvedVolatility = Math.min(
      0.9,
      Math.max(0.1, foreignPowerProfile.volatility ?? next.marketVolatility ?? 0.3)
    );
    foreignPowerProfile.volatility = resolvedVolatility;
    if (foreignPowerProfile.appearEpoch == null) {
      foreignPowerProfile.appearEpoch = next.appearEpoch ?? 0;
    }
    if (foreignPowerProfile.populationFactor == null) {
      const agricultureBoost = next.culturalTraits?.agriculturalFocus ? 1.15 : 1;
      foreignPowerProfile.populationFactor = clamp(
        foreignPowerProfile.baseRating * agricultureBoost,
        0.6,
        2.5
      );
    }
    if (foreignPowerProfile.wealthFactor == null) {
      const eraBoost = 1 + Math.max(0, foreignPowerProfile.appearEpoch) * 0.05;
      foreignPowerProfile.wealthFactor = clamp(
        foreignPowerProfile.baseRating * eraBoost,
        0.5,
        3.5
      );
    }

    if (!foreignPowerProfile.initializedAtTick) {
      const eraGap = Math.max(0, visibleEpoch - (foreignPowerProfile.appearEpoch ?? 0));
      const eraBonus = 1 + eraGap * 0.08;
      const randomVariance = 0.9 + Math.random() * 0.25;
      const popFactor = clamp(
        foreignPowerProfile.populationFactor * eraBonus * randomVariance,
        0.6,
        2.5
      );
      const wealthFactor = clamp(
        foreignPowerProfile.wealthFactor * eraBonus * randomVariance,
        0.5,
        3.5
      );
      const basePopInit = Math.max(3, Math.round(playerPopulationBaseline * popFactor));
      const baseWealthInit = Math.max(100, Math.round(playerWealthBaseline * wealthFactor));
      next.population = basePopInit;
      next.wealth = baseWealthInit;
      next.budget = Math.max(50, baseWealthInit * 0.5);
      next.economyTraits = {
        ...(next.economyTraits || {}),
        basePopulation: basePopInit,
        baseWealth: baseWealthInit,
      };
      foreignPowerProfile.populationFactor = popFactor;
      foreignPowerProfile.wealthFactor = wealthFactor;
      foreignPowerProfile.initializedAtTick = tick;
      foreignPowerProfile.playerSnapshot = {
        population: playerPopulationBaseline,
        wealth: playerWealthBaseline,
      };
      if (!next.wealthTemplate) {
        next.wealthTemplate = baseWealthInit;
      }
    }
    
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
    const resourceBiasMap = next.economyTraits?.resourceBias || {};
    const foreignResourceKeys = Object.keys(RESOURCES).filter(isTradableResource);
    if (foreignResourceKeys.length > 0) {
    // 计算该国是否处于战争状态（与玩家或与其他AI国家）
    const isInAnyWar = next.isAtWar || (next.foreignWars && Object.values(next.foreignWars).some(w => w?.isAtWar));
    // 战争消耗系数：战争中的国家资源消耗增加30%-50%
    const warConsumptionMultiplier = isInAnyWar ? (1.3 + (next.aggression || 0.2) * 0.5) : 1.0;
    
    foreignResourceKeys.forEach((resourceKey) => {
        const bias = resourceBiasMap[resourceKey] ?? 1;
        const currentStock = next.inventory[resourceKey] || 0;
        // 使用固定的目标库存（避免目标不断变化造成"假稳定"）
        const targetInventory = 500;
        const baseProductionRate = 3.0 * gameSpeed; // 基础生产速率
        // 基础消耗速率（战争时增加消耗）
        const baseConsumptionRate = 3.0 * gameSpeed * warConsumptionMultiplier;        const productionRate = baseProductionRate * bias;
        const consumptionRate = baseConsumptionRate / Math.max(bias, 0.25);
        const stockRatio = currentStock / targetInventory;
        let productionAdjustment = 1.0;
        let consumptionAdjustment = 1.0;
        if (stockRatio > 1.5) {
          // 库存极高：削减生产、提升消耗，加快回落
          productionAdjustment *= 0.5;
          consumptionAdjustment *= 1.15;
        } else if (stockRatio > 1.1) {
          productionAdjustment *= 0.8;
          consumptionAdjustment *= 1.05;
        } else if (stockRatio < 0.5) {
          // 库存极低：提升生产、压缩消耗，加快补货
          productionAdjustment *= 1.5;
          consumptionAdjustment *= 0.85;
        } else if (stockRatio < 0.9) {
          productionAdjustment *= 1.2;
          consumptionAdjustment *= 0.95;
        }
        const correction = (targetInventory - currentStock) * 0.01 * gameSpeed;
        const randomShock = (Math.random() - 0.5) * targetInventory * 0.3 * gameSpeed;
        const finalProduction = productionRate * productionAdjustment;
        const finalConsumption = consumptionRate * consumptionAdjustment;
        const netChange = (finalProduction - finalConsumption) + correction + randomShock;
        const minInventory = targetInventory * 0.2;
        const maxInventory = targetInventory * 3.0;
        const nextStock = currentStock + netChange;
        next.inventory[resourceKey] = Math.max(minInventory, Math.min(maxInventory, nextStock));
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
          // 生成敌方突袭军队
          const enemyEpoch = Math.max(next.appearEpoch || 0, Math.min(epoch, next.expireEpoch ?? epoch));
          const militaryStrength = next.militaryStrength ?? 1.0; // 军事实力
          const wealthFactor = Math.max(0.3, Math.min(1.5, (next.wealth || 500) / 800)); // 财富影响
          const aggressionFactor = 1 + (next.aggression || 0.2);
          const warScoreFactor = 1 + Math.max(-0.5, (next.warScore || 0) / 120);
          const raidStrength = 0.05 + (next.aggression || 0.2) * 0.05 + disadvantage / 1200;
          
          // 综合实力系数
          const overallStrength = militaryStrength * wealthFactor * aggressionFactor * warScoreFactor;
          
          // 根据时代和实力生成突袭部队
          const attackerArmy = {};
          const raidUnits = getEnemyUnitsForEpoch(enemyEpoch, 'light'); // 突袭使用轻型兵种
          
          // 生成突袭部队（规模较小，基础2-6个单位）
          const baseUnitCount = 2 + Math.random() * 4;
          const totalUnits = Math.floor(baseUnitCount * overallStrength);
          
          raidUnits.forEach(unitId => {
            if (UNIT_TYPES[unitId]) {
              const ratio = 0.5 + Math.random() * 0.8;
              const count = Math.floor((totalUnits / raidUnits.length) * ratio);
              if (count > 0) {
                attackerArmy[unitId] = count;
              }
            }
          });
          
          // 玩家的防御军队（使用玩家当前的军队）
          const defenderArmy = { ...army };
          
          // 如果玩家没有军队，突袭自动成功
          const totalDefenders = Object.values(defenderArmy).reduce((sum, count) => sum + count, 0);
          
          if (totalDefenders === 0) {
            // 没有防御军队，突袭成功
            const foodLoss = Math.floor((res.food || 0) * raidStrength);
            const silverLoss = Math.floor((res.silver || 0) * (raidStrength / 2));
            if (foodLoss > 0) res.food = Math.max(0, (res.food || 0) - foodLoss);
            if (silverLoss > 0) res.silver = Math.max(0, (res.silver || 0) - silverLoss);
            const popLoss = Math.min(3, Math.max(1, Math.floor(raidStrength * 20)));
            raidPopulationLoss += popLoss;
            
            // 生成战斗日志（JSON格式，方便解析）
            const raidData = {
              nationName: next.name,
              victory: false, // 玩家失败
              attackerArmy,
              defenderArmy: {},
              attackerLosses: {},
              defenderLosses: {},
              foodLoss,
              silverLoss,
              popLoss,
              ourPower: 0,
              enemyPower: 0,
            };
            const raidLog = `❗RAID_EVENT❗${JSON.stringify(raidData)}`;
            console.log('[SIMULATION] Pushing raid log (no army):', raidLog);
            logs.push(raidLog);
            // 敌方突袭成功：玩家处于劣势，降低玩家对该国的战争分数
            next.warScore = (next.warScore || 0) - 8;
          } else {
            // 有防御军队，进行战斗模拟
            const attackerData = {
              army: attackerArmy,
              epoch: enemyEpoch,
              militaryBuffs: 0.1, // 突袭方有小幅加成
            };
            
            const defenderData = {
              army: defenderArmy,
              epoch: epoch,
              militaryBuffs: 0, // 防御方没有加成（被突袭）
              wealth: (res.food || 0) + (res.silver || 0) + (res.wood || 0),
            };
            
            const battleResult = simulateBattle(attackerData, defenderData);
            
            // 应用战斗结果
            let foodLoss = 0;
            let silverLoss = 0;
            let popLoss = 0;
            
            if (battleResult.victory) {
              // 玩家失败，敌方掠夺资源
              foodLoss = Math.floor((res.food || 0) * raidStrength);
              silverLoss = Math.floor((res.silver || 0) * (raidStrength / 2));
              if (foodLoss > 0) res.food = Math.max(0, (res.food || 0) - foodLoss);
              if (silverLoss > 0) res.silver = Math.max(0, (res.silver || 0) - silverLoss);
              popLoss = Math.min(3, Math.max(1, Math.floor(raidStrength * 20)));
              raidPopulationLoss += popLoss;
            }
            
            // 应用军队损失
            Object.entries(battleResult.defenderLosses || {}).forEach(([unitId, count]) => {
              if (army[unitId]) {
                army[unitId] = Math.max(0, army[unitId] - count);
              }
            });

            // 根据突袭结果调整战争分数和敌军损失统计
            const enemyLossCount = Object.values(battleResult.attackerLosses || {}).reduce(
              (sum, val) => sum + (val || 0),
              0
            );
            if (enemyLossCount > 0) {
              next.enemyLosses = (next.enemyLosses || 0) + enemyLossCount;
            }

            // 敌方胜利：玩家处于劣势；敌方失败：玩家取得优势
            const raidScoreDelta = battleResult.victory ? -8 : 6;
            next.warScore = (next.warScore || 0) + raidScoreDelta;

            // 生成突袭战斗事件日志，供前端 BattleResultModal 使用
            const raidData = {
              nationName: next.name,
              victory: !battleResult.victory, // 玩家是否胜利（simulateBattle 的 victory 表示进攻方胜利，这里取反）
              attackerArmy,
              defenderArmy,
              attackerLosses: battleResult.attackerLosses || {},
              defenderLosses: battleResult.defenderLosses || {},
              foodLoss,
              silverLoss,
              popLoss,
              ourPower: battleResult.defenderPower,
              enemyPower: battleResult.attackerPower,
              battleReport: battleResult.battleReport || [],
            };
            
            // // 生成战斗日志（JSON格式，方便解析）
            // const raidData = {
            //   nationName: next.name,
            //   victory: battleResult.victory, // 玩家是否胜利
            //   attackerArmy,
            //   defenderArmy,
            //   attackerLosses: battleResult.attackerLosses || {},
            //   defenderLosses: battleResult.defenderLosses || {},
            //   foodLoss,
            //   silverLoss,
            //   popLoss,
            //   ourPower: battleResult.defenderPower,
            //   enemyPower: battleResult.attackerPower,
            //   battleReport: battleResult.battleReport || [],
            // };
            // const raidLog = `❗RAID_EVENT❗${JSON.stringify(raidData)}`;
            // console.log('[SIMULATION] Pushing raid log (with army):', raidLog);
            // logs.push(raidLog);
            const raidEventLog = `RAID_EVENT${JSON.stringify(raidData)}`;
            console.log('[SIMULATION] Pushing raid log (with army):', raidEventLog);
            logs.push(raidEventLog);
          }
        }
      }
      const lastPeaceRequestDay = Number.isFinite(next.lastPeaceRequestDay)
        ? next.lastPeaceRequestDay
        : -Infinity;
      const canRequestPeace =
        (tick - lastPeaceRequestDay) >= PEACE_REQUEST_COOLDOWN_DAYS;
      if ((next.warScore || 0) > 12 && canRequestPeace) {
        const willingness = Math.min(0.5, 0.03 + (next.warScore || 0) / 120 + (next.warDuration || 0) / 400) + Math.min(0.15, (next.enemyLosses || 0) / 500);
        if (Math.random() < willingness) {
          // 计算赔款金额，使用绝对值而不是财富百分比，避免晚期赔款溢出
          const warScore = next.warScore || 0;
          const enemyLosses = next.enemyLosses || 0;
          const warDuration = next.warDuration || 0;
          const baseTribute = Math.ceil(warScore * 35 + enemyLosses * 2.2 + warDuration * 4);
          const minTribute = 200;
          const hardCap = 8000 + Math.floor(warDuration * 8); // 根据战争时长略微提高上限
          const availableWealth = Math.max(0, next.wealth || 0);
          const tribute = Math.min(Math.min(hardCap, availableWealth), Math.max(minTribute, baseTribute));
          // 只记录日志，不直接处理和平，让事件系统处理
          logs.push(`🤝 ${next.name} 请求和平，愿意支付 ${tribute} 银币作为赔款。`);
          // 标记该国家正在请求和平，避免重复触发
          next.isPeaceRequesting = true;
          // 保存tribute值到nation对象，供事件系统使用
           next.peaceTribute = tribute;
           next.lastPeaceRequestDay = tick;
        }
      }
    } else if (next.warDuration) {
      next.warDuration = 0;
    }
    const relation = next.relation ?? 50;
    const aggression = next.aggression ?? 0.2;
    const hostility = Math.max(0, (50 - relation) / 70);
    const unrest = stabilityValue < 35 ? 0.02 : 0;
    
    // 侵略性强的国家更主动开战：aggression影响权重从0.04提升到0.08，并额外乘以侵略性系数
    const aggressionBonus = aggression > 0.5 ? aggression * 0.06 : 0; // 高侵略性国家额外概率
    const declarationChance = visibleEpoch >= 1 ? Math.min(0.15, (aggression * 0.08) + (hostility * 0.05) + unrest + aggressionBonus) : 0;
    
    // 检查和平协议是否仍然有效
    const hasPeaceTreaty = next.peaceTreatyUntil && tick < next.peaceTreatyUntil;
    
    if (!next.isAtWar && !hasPeaceTreaty && relation < 35 && Math.random() < declarationChance) {
      next.isAtWar = true;
      next.warStartDay = tick;
      next.warDuration = 0;
      next.warDeclarationPending = true; // 标记需要触发宣战事件
      logs.push(`⚠️ ${next.name} 对你发动了战争！`);
      logs.push(`WAR_DECLARATION_EVENT:${JSON.stringify({ nationId: next.id, nationName: next.name })}`);
    }
    
    // 处理分期支付赔款
    if (next.installmentPayment && next.installmentPayment.remainingDays > 0) {
      const payment = next.installmentPayment.amount;
      res.silver = (res.silver || 0) + payment;
      warIndemnityIncome += payment;
      next.installmentPayment.paidAmount += payment;
      next.installmentPayment.remainingDays -= 1;
      
      if (next.installmentPayment.remainingDays === 0) {
        logs.push(`💰 ${next.name} 完成了所有分期赔款支付（共${next.installmentPayment.totalAmount}银币）。`);
        delete next.installmentPayment;
      }
    }
    
    // ========== 战后恢复机制 ==========
    // 和平状态下，国家逐渐恢复军事实力
    if (!next.isAtWar) {
      const currentStrength = next.militaryStrength ?? 1.0;
      if (currentStrength < 1.0) {
        const recoveryRate = 0.005; // 每tick恢复0.5%
        next.militaryStrength = Math.min(1.0, currentStrength + recoveryRate);
      }
    }

    // ========== 人口与财富波动模型 ==========
    const powerProfile = next.foreignPower || {};
    const volatility = clamp(powerProfile.volatility ?? next.marketVolatility ?? 0.3, 0.1, 0.9);
    const populationFactor = clamp(
      powerProfile.populationFactor ?? powerProfile.baseRating ?? 1,
      0.6,
      2.5
    );
    const wealthFactor = clamp(
      powerProfile.wealthFactor ?? (powerProfile.baseRating ? powerProfile.baseRating * 1.1 : 1.1),
      0.5,
      3.5
    );
    const eraMomentum = 1 + Math.max(0, epoch - (powerProfile.appearEpoch ?? 0)) * 0.03;
    const templatePopulationBoost = Math.max(
      1,
      (next.wealthTemplate || 800) / Math.max(800, playerWealthBaseline) * 0.8
    );
    const templateWealthBoost = Math.max(
      1,
      (next.wealthTemplate || 800) / Math.max(800, playerWealthBaseline) * 1.1
    );
    const desiredPopulation = Math.max(
      3,
      playerPopulationBaseline * populationFactor * eraMomentum * templatePopulationBoost
    );
    const desiredWealth = Math.max(
      100,
      playerWealthBaseline * wealthFactor * eraMomentum * templateWealthBoost
    );
    
    next.economyTraits = {
      ...(next.economyTraits || {}),
      basePopulation: desiredPopulation,
      baseWealth: desiredWealth,
    };

    const currentPopulation = next.population ?? desiredPopulation;
    const driftMultiplier = clamp(1 + volatility * 0.6 + eraMomentum * 0.08, 1, 1.8);
    const populationDriftRate = (next.isAtWar ? 0.032 : 0.12) * driftMultiplier;
    const populationNoise = (Math.random() - 0.5) * volatility * desiredPopulation * 0.04;
    let adjustedPopulation = currentPopulation + (desiredPopulation - currentPopulation) * populationDriftRate + populationNoise;
    if (next.isAtWar) {
      adjustedPopulation -= currentPopulation * 0.012;
    }
    next.population = Math.max(3, Math.round(adjustedPopulation));

    const currentWealth = next.wealth ?? desiredWealth;
    const wealthDriftRate = (next.isAtWar ? 0.03 : 0.11) * driftMultiplier;
    const wealthNoise = (Math.random() - 0.5) * volatility * desiredWealth * 0.05;
    let adjustedWealth = currentWealth + (desiredWealth - currentWealth) * wealthDriftRate + wealthNoise;
    if (next.isAtWar) {
      adjustedWealth -= currentWealth * 0.015;
    }
    next.wealth = Math.max(100, Math.round(adjustedWealth));

    const dynamicBudgetTarget = next.wealth * 0.45;
    const workingBudget = Number.isFinite(next.budget) ? next.budget : dynamicBudgetTarget;
    next.budget = Math.max(0, workingBudget + (dynamicBudgetTarget - workingBudget) * 0.35);
    
    return next;
  });

  // ========== 国家间关系系统 ==========
  // 初始化和更新国家之间的好感度
  updatedNations = updatedNations.map(nation => {
    // 初始化国家间关系对象
    if (!nation.foreignRelations) {
      nation.foreignRelations = {};
    }
    
    // 与其他AI国家的关系自然波动
    updatedNations.forEach(otherNation => {
      if (otherNation.id === nation.id) return;
      
      // 初始化关系（基于两国的侵略性）
      if (nation.foreignRelations[otherNation.id] === undefined) {
        const avgAggression = ((nation.aggression || 0.3) + (otherNation.aggression || 0.3)) / 2;
        nation.foreignRelations[otherNation.id] = Math.floor(50 - avgAggression * 30 + (Math.random() - 0.5) * 20);
      }
      
      // 关系自然波动（每天有小概率变化）
      if (Math.random() < 0.05) {
        const change = (Math.random() - 0.5) * 6;
        nation.foreignRelations[otherNation.id] = clamp(
          (nation.foreignRelations[otherNation.id] || 50) + change,
          0,
          100
        );
      }
    });
    
    return nation;
  });

  // ========== AI国家互相开战系统 ==========
  // 检查是否有两个AI国家应该开战
  const visibleNations = updatedNations.filter(n => 
    epoch >= (n.appearEpoch ?? 0) && (n.expireEpoch == null || epoch <= n.expireEpoch)
  );
  
  visibleNations.forEach(nation => {
    // 检查是否已经在与其他AI国家交战
    if (!nation.foreignWars) {
      nation.foreignWars = {};
    }
    
    visibleNations.forEach(otherNation => {
      if (otherNation.id === nation.id) return;
      if (nation.foreignWars[otherNation.id]?.isAtWar) return; // 已经在打了
      
      // 检查和平协议
      const peaceUntil = nation.foreignWars[otherNation.id]?.peaceTreatyUntil || 0;
      if (tick < peaceUntil) return;
      
      // 计算开战概率（基于关系和侵略性）
      const relation = nation.foreignRelations?.[otherNation.id] ?? 50;
      const aggression = nation.aggression ?? 0.3;
      
      // 只有低关系且高侵略性的国家才会主动开战
      if (relation < 30 && aggression > 0.4) {
        const warChance = Math.min(0.008, (aggression * 0.005) + ((30 - relation) / 1000));
        
        if (Math.random() < warChance) {
          // 开战！
          nation.foreignWars[otherNation.id] = {
            isAtWar: true,
            warStartDay: tick,
            warScore: 0,
          };
          // 对方也标记为开战
          if (!otherNation.foreignWars) {
            otherNation.foreignWars = {};
          }
          otherNation.foreignWars[nation.id] = {
            isAtWar: true,
            warStartDay: tick,
            warScore: 0,
          };
          logs.push(`📢 国际新闻：${nation.name} 向 ${otherNation.name} 宣战了！`);
        }
      }
    });
    
    // 处理正在进行的AI vs AI战争
    Object.keys(nation.foreignWars || {}).forEach(enemyId => {
      const war = nation.foreignWars[enemyId];
      if (!war?.isAtWar) return;
      
      const enemy = updatedNations.find(n => n.id === enemyId);
      if (!enemy) return;
      
      // 战争消耗：双方财富和人口减少
      nation.wealth = Math.max(100, (nation.wealth || 500) * 0.998);
      nation.population = Math.max(10, (nation.population || 100) * 0.999);
      enemy.wealth = Math.max(100, (enemy.wealth || 500) * 0.998);
      enemy.population = Math.max(10, (enemy.population || 100) * 0.999);
      
      // 战斗结算（每20天一次）
      if ((tick - war.warStartDay) % 20 === 0 && tick > war.warStartDay) {
        const nationStrength = (nation.militaryStrength ?? 1.0) * (nation.population || 100) * (1 + (nation.aggression || 0.3));
        const enemyStrength = (enemy.militaryStrength ?? 1.0) * (enemy.population || 100) * (1 + (enemy.aggression || 0.3));
        
        const totalStrength = nationStrength + enemyStrength;
        const nationWinChance = nationStrength / totalStrength;
        
        if (Math.random() < nationWinChance) {
          // nation胜利这轮
          war.warScore = (war.warScore || 0) + 5;
          enemy.foreignWars[nation.id].warScore = (enemy.foreignWars[nation.id].warScore || 0) - 5;
          
          // 获取战利品
          const loot = Math.floor((enemy.wealth || 500) * 0.05);
          nation.wealth = (nation.wealth || 500) + loot;
          enemy.wealth = Math.max(100, (enemy.wealth || 500) - loot);
        } else {
          // enemy胜利这轮
          war.warScore = (war.warScore || 0) - 5;
          enemy.foreignWars[nation.id].warScore = (enemy.foreignWars[nation.id].warScore || 0) + 5;
          
          // enemy获取战利品
          const loot = Math.floor((nation.wealth || 500) * 0.05);
          enemy.wealth = (enemy.wealth || 500) + loot;
          nation.wealth = Math.max(100, (nation.wealth || 500) - loot);
        }
        
        // 检查是否应该结束战争
        const absoluteWarScore = Math.abs(war.warScore || 0);
        if (absoluteWarScore > 30 || Math.random() < 0.03) {
          // 结束战争
          const winner = (war.warScore || 0) > 0 ? nation : enemy;
          const loser = winner.id === nation.id ? enemy : nation;
          
          // 胜者获取败者的人口和财富
          const populationTransfer = Math.floor((loser.population || 100) * 0.05);
          const wealthTransfer = Math.floor((loser.wealth || 500) * 0.1);
          
          winner.population = (winner.population || 100) + populationTransfer;
          winner.wealth = (winner.wealth || 500) + wealthTransfer;
          loser.population = Math.max(10, (loser.population || 100) - populationTransfer);
          loser.wealth = Math.max(100, (loser.wealth || 500) - wealthTransfer);
          
          // 结束战争状态
          nation.foreignWars[enemyId] = {
            isAtWar: false,
            peaceTreatyUntil: tick + 365,
          };
          enemy.foreignWars[nation.id] = {
            isAtWar: false,
            peaceTreatyUntil: tick + 365,
          };
          
          // 关系变化
          nation.foreignRelations[enemyId] = clamp((nation.foreignRelations[enemyId] || 50) - 20, 0, 100);
          enemy.foreignRelations[nation.id] = clamp((enemy.foreignRelations[nation.id] || 50) - 20, 0, 100);
          
          logs.push(`📢 国际新闻：${winner.name} 在与 ${loser.name} 的战争中获胜！`);
        }
      }
    });
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
  nextPopulation = Math.max(0, Math.floor(nextPopulation));

  Object.keys(res).forEach(k => {
    if (res[k] < 0) res[k] = 0;
  });

  const collectedHeadTax = taxBreakdown.headTax * efficiency;
  const collectedIndustryTax = taxBreakdown.industryTax * efficiency;
  const collectedBusinessTax = taxBreakdown.businessTax * efficiency;
  const totalCollectedTax = collectedHeadTax + collectedIndustryTax + collectedBusinessTax;

  // 将税收与战争赔款一并视为财政收入
  const totalFiscalIncome = totalCollectedTax + warIndemnityIncome;

  res.silver = (res.silver || 0) + totalFiscalIncome;
  rates.silver = (rates.silver || 0) + totalFiscalIncome;

  console.log('[TICK] Starting price and wage updates...');
  const updatedPrices = { ...priceMap };
  const updatedWages = {};
  const wageSmoothing = 0.35;

  Object.entries(roleWageStats).forEach(([role, data]) => {

    let currentSignal = 0;

    const pop = popStructure[role] || 0;



    if (pop > 0) {

      const income = roleWagePayout[role] || 0;

      const expense = roleExpense[role] || 0;
      // 人头税不计入生活支出，工资调整只考虑生活消费
      // const headTaxPaid = roleHeadTaxPaid[role] || 0;

      currentSignal = (income - expense) / pop;

    } else {

      if (data.weightedWage > 0 && data.totalSlots > 0) {

        currentSignal = data.weightedWage / data.totalSlots;

      } else {

        currentSignal = previousWages[role] || 0;

      }

    }



    currentSignal = Math.max(0, currentSignal);



    const prev = previousWages[role] || 0;

    const smoothed = prev + (currentSignal - prev) * wageSmoothing;



    updatedWages[role] = parseFloat(smoothed.toFixed(2));

  });



  const demandPopulation = Math.max(0, nextPopulation ?? population ?? 0);
  
  // === 辅助函数：计算最低利润率 ===
  // 根据成本价、基础价格和库存情况，动态计算生产者应得的最低利润率
  const calculateMinProfitMargin = (costPrice, basePrice, inventoryRatio) => {
    // 1. 基础利润率：根据成本价与基础价格的比例
    // 如果成本价远低于基础价格（如粮食），说明资源有较高的市场价值，应该有更高的利润率
    const costToBasePriceRatio = costPrice / basePrice;
    
    if (costToBasePriceRatio < 0.3) {
      // 成本价很低（<30% basePrice），如粮食
      // 基础利润率：200%-500%（确保价格接近basePrice）
      // 例如：costPrice=0.1, basePrice=1.6, ratio=0.0625
      // 目标：让 costPrice * (1 + margin) ≈ basePrice
      // margin = (basePrice / costPrice) - 1 = 15 (1500%)
      // 但我们限制在合理范围内
      return Math.min(5.0, (basePrice / costPrice) - 1) * 0.8; // 80%的差价作为利润
    } else if (costToBasePriceRatio < 0.6) {
      // 成本价中等（30%-60% basePrice）
      // 基础利润率：50%-100%
      return 0.5 + (0.6 - costToBasePriceRatio) * 1.5;
    } else if (costToBasePriceRatio < 0.9) {
      // 成本价较高（60%-90% basePrice）
      // 基础利润率：20%-50%
      return 0.2 + (0.9 - costToBasePriceRatio) * 1.0;
    } else {
      // 成本价接近或超过基础价格（>90% basePrice）
      // 基础利润率：10%-20%（保证基本利润）
      return 0.1 + Math.max(0, 1.0 - costToBasePriceRatio) * 1.0;
    }
  };
  
  // 获取全局默认的市场参数（作为 fallback）
  const defaultMarketInfluence = ECONOMIC_INFLUENCE?.market || {};
  const defaultSupplyDemandWeight = Math.max(0, defaultMarketInfluence.supplyDemandWeight ?? 1);
  const defaultVirtualDemandPerPop = Math.max(0, defaultMarketInfluence.virtualDemandPerPop || 0);
  const defaultInventoryTargetDays = Math.max(0.1, defaultMarketInfluence.inventoryTargetDays ?? 1.5);
  const defaultInventoryPriceImpact = Math.max(0, defaultMarketInfluence.inventoryPriceImpact ?? 0.25);

  // 新的市场价格算法：每个建筑有自己的出售价格，市场价是加权平均
  Object.keys(RESOURCES).forEach(resource => {
    if (!isTradableResource(resource)) return;
    
    const resourceDef = RESOURCES[resource];
    const resourceMarketConfig = resourceDef?.marketConfig || {};
    
    // 获取资源的经济参数
    const supplyDemandWeight = resourceMarketConfig.supplyDemandWeight !== undefined 
      ? Math.max(0, resourceMarketConfig.supplyDemandWeight)
      : defaultSupplyDemandWeight;
    const virtualDemandPerPop = resourceMarketConfig.virtualDemandPerPop !== undefined
      ? Math.max(0, resourceMarketConfig.virtualDemandPerPop)
      : defaultVirtualDemandPerPop;
    const inventoryTargetDays = resourceMarketConfig.inventoryTargetDays !== undefined
      ? Math.max(0.1, resourceMarketConfig.inventoryTargetDays)
      : defaultInventoryTargetDays;
    const inventoryPriceImpact = resourceMarketConfig.inventoryPriceImpact !== undefined
      ? Math.max(0, resourceMarketConfig.inventoryPriceImpact)
      : defaultInventoryPriceImpact;
    
    const sup = supply[resource] || 0;
    const dem = demand[resource] || 0;
    const virtualDemandBaseline = virtualDemandPerPop * demandPopulation;
    const adjustedDemand = dem + virtualDemandBaseline;
    
    // 计算当前库存可以支撑多少天
    const dailyDemand = adjustedDemand / gameSpeed;
    const inventoryStock = res[resource] || 0;
    const inventoryDays = dailyDemand > 0 ? inventoryStock / dailyDemand : inventoryTargetDays;
    
    // 收集所有生产该资源的建筑及其出售价格
    const buildingPrices = [];
    let totalOutput = 0;
    
    BUILDINGS.forEach(building => {
      const outputAmount = building.output?.[resource];
      if (!outputAmount || outputAmount <= 0) return;
      
      const buildingCount = builds[building.id] || 0;
      if (buildingCount <= 0) return;
      
      // 计算该建筑的成本价
      const buildingMarketConfig = building.marketConfig || {};
      const buildingPriceWeights = buildingMarketConfig.price || ECONOMIC_INFLUENCE?.price || {};
      const buildingWageWeights = buildingMarketConfig.wage || ECONOMIC_INFLUENCE?.wage || {};
      
      const resourceSpecificPriceLivingCosts = buildLivingCostMap(
        livingCostBreakdown,
        buildingPriceWeights
      );
      const resourceSpecificWageLivingCosts = buildLivingCostMap(
        livingCostBreakdown,
        buildingWageWeights
      );
      
      // 计算原材料成本（含税）
      let inputCost = 0;
      if (building.input) {
        Object.entries(building.input).forEach(([inputKey, amount]) => {
          if (!amount || amount <= 0) return;
          const inputPrice = priceMap[inputKey] || getBasePrice(inputKey);
          const inputTaxRate = getResourceTaxRate(inputKey);
          
          // 原材料成本 = 价格 × 数量 × (1 + 税率)
          // 如果税率为负（补贴），则成本降低
          const baseCost = amount * inputPrice;
          const taxCost = baseCost * inputTaxRate;
          inputCost += baseCost + taxCost;
        });
      }
      
      // 计算工资成本
      let laborCost = 0;
      const isSelfOwned = building.owner && building.jobs && building.jobs[building.owner];
      if (building.jobs && !isSelfOwned) {
        Object.entries(building.jobs).forEach(([role, slots]) => {
          if (!slots || slots <= 0) return;
          const wage = updatedWages[role] || getExpectedWage(role);
          laborCost += slots * wage;
        });
      }
      
      // 计算营业税成本
      const businessTaxMultiplier = taxPolicies?.businessTaxRates?.[building.id] ?? 1;
      const businessTaxBase = building.businessTaxBase ?? 0.1;
      const businessTaxCost = businessTaxBase * businessTaxMultiplier;
      
      // 计算业主生活需求成本
      let ownerLivingCost = 0;
      if (building.owner) {
        const ownerLivingCostBase = resourceSpecificWageLivingCosts[building.owner] || 0;
        ownerLivingCost = ownerLivingCostBase * (building.jobs[building.owner] || 0);
      }
      
      // 成本价 = (原材料成本含税 + 工资成本 + 营业税成本 + 业主生活需求成本) / 产出数量
      const totalCost = inputCost + laborCost + businessTaxCost + ownerLivingCost;
      const costPrice = totalCost / outputAmount;
      
      // === 三层价格模型 ===
      // 1. 计算供需调整系数（基于库存天数）
      const inventoryRatio = inventoryDays / inventoryTargetDays;
      let priceMultiplier = 1.0;
      
      if (inventoryRatio < 0.5) {
        // 库存紧张，大幅涨价
        priceMultiplier = 1.0 + (1.0 - inventoryRatio * 2) * 5.0; // 最高6倍
      } else if (inventoryRatio < 1.0) {
        // 库存偏低，适度涨价
        priceMultiplier = 1.0 + (1.0 - inventoryRatio) * 1.0; // 1.0-2.0倍
      } else if (inventoryRatio > 2.0) {
        // 库存积压，大幅降价
        priceMultiplier = 1.0 - (inventoryRatio - 2.0) * 0.3; // 最低0.1倍
        priceMultiplier = Math.max(0.1, priceMultiplier);
      } else if (inventoryRatio > 1.0) {
        // 库存充足，适度降价
        priceMultiplier = 1.0 - (inventoryRatio - 1.0) * 0.3; // 0.7-1.0倍
      }
      
      // 2. 获取基础价格（市场认可的合理价格）
      const basePrice = getBasePrice(resource);
      
      // 3. 计算市场价格（基于basePrice和供需关系）
      let marketBasedPrice = basePrice * priceMultiplier;
      
      // 4. 最终价格 = 市场价格（允许低于成本价）
      // 当供过于求时，价格可能低于成本，生产者会亏损
      // 这会促使生产者减产或转行，实现市场自我调节
      let sellingPrice = marketBasedPrice;
      
      // 不超过物价限额
      const minPrice = resourceDef.minPrice ?? PRICE_FLOOR;
      const maxPrice = resourceDef.maxPrice;
      sellingPrice = Math.max(sellingPrice, minPrice);
      if (maxPrice !== undefined) {
        sellingPrice = Math.min(sellingPrice, maxPrice);
      }
      
      // 记录该建筑的出售价格和产量
      const buildingOutput = outputAmount * buildingCount;
      totalOutput += buildingOutput;
      buildingPrices.push({
        price: sellingPrice,
        output: buildingOutput
      });
    });
    
    // 计算市场价：所有建筑的加权平均价格
    let marketPrice = 0;
    if (totalOutput > 0 && buildingPrices.length > 0) {
      let weightedSum = 0;
      buildingPrices.forEach(bp => {
        weightedSum += bp.price * bp.output;
      });
      marketPrice = weightedSum / totalOutput;
    } else {
      // 如果没有建筑生产，根据库存情况调整基础价格
      const basePrice = getBasePrice(resource);
      const inventoryRatio = inventoryDays / inventoryTargetDays;
      let priceMultiplier = 1.0;
      
      if (inventoryRatio < 0.5) {
        // 库存紧张，大幅涨价
        priceMultiplier = 1.0 + (1.0 - inventoryRatio * 2) * 5.0; // 最高6倍
      } else if (inventoryRatio < 1.0) {
        // 库存偏低，适度涨价
        priceMultiplier = 1.0 + (1.0 - inventoryRatio) * 1.0; // 1.0-2.0倍
      } else if (inventoryRatio > 2.0) {
        // 库存积压，大幅降价
        priceMultiplier = 1.0 - (inventoryRatio - 2.0) * 0.3; // 最低0.1倍
        priceMultiplier = Math.max(0.1, priceMultiplier);
      } else if (inventoryRatio > 1.0) {
        // 库存充足，适度降价
        priceMultiplier = 1.0 - (inventoryRatio - 1.0) * 0.3; // 0.7-1.0倍
      }
      
      marketPrice = basePrice * priceMultiplier;
      
      // 限制价格范围
      const minPrice = resourceDef.minPrice ?? PRICE_FLOOR;
      const maxPrice = resourceDef.maxPrice;
      marketPrice = Math.max(marketPrice, minPrice);
      if (maxPrice !== undefined) {
        marketPrice = Math.min(marketPrice, maxPrice);
      }
    }
    
    // 平滑处理
    const prevPrice = priceMap[resource] || marketPrice;
    const smoothed = prevPrice + (marketPrice - prevPrice) * 0.1;
    
    // 战争物价上涨：计算当前正在进行的战争数量对物价的影响
    const warCount = updatedNations.filter(n => n.isAtWar).length;
    // AI国家之间的战争也会影响物价（国际局势紧张）
    let foreignWarCount = 0;
    updatedNations.forEach(n => {
      if (n.foreignWars) {
        Object.values(n.foreignWars).forEach(war => {
          if (war?.isAtWar) foreignWarCount++;
        });
      }
    });
    foreignWarCount = Math.floor(foreignWarCount / 2); // 每场战争被计算两次，需要除以2
    
    // 战争物价系数：每场与玩家的战争增加5%物价，每场AI间战争增加1%物价
    const warPriceMultiplier = 1 + (warCount * 0.05) + (foreignWarCount * 0.01);
    const warAdjustedPrice = smoothed * warPriceMultiplier;
    
    // 应用价格限制
    const minPrice = resourceDef.minPrice ?? PRICE_FLOOR;
    const maxPrice = resourceDef.maxPrice;
    let finalPrice = warAdjustedPrice;
    finalPrice = Math.max(finalPrice, minPrice);
    if (maxPrice !== undefined) {
      finalPrice = Math.min(finalPrice, maxPrice);
    }
    
    updatedPrices[resource] = parseFloat(finalPrice.toFixed(2));
  });

  const getLastTickNetIncomePerCapita = (role) => {
    const history = (classWealthHistory || {})[role];
    if (!history || history.length < 2) return null;
    const lastWealth = history[history.length - 1];
    const prevWealth = history[history.length - 2];
    const prevPop = Math.max(1, (previousPopStructure?.[role] || 0));
    return (lastWealth - prevWealth) / prevPop;
  };

  const hasBuildingVacancyForRole = (role) => {
    const list = roleVacancyTargets[role];
    if (!list || list.length === 0) return false;
    return list.some(entry => entry && entry.availableSlots > 0);
  };

  const reserveBuildingVacancyForRole = (role, desiredCount) => {
    const list = roleVacancyTargets[role];
    if (!list || list.length === 0 || desiredCount <= 0) return null;
    let bestIndex = -1;
    let bestSlots = 0;
    for (let i = 0; i < list.length; i++) {
      const entry = list[i];
      if (!entry) continue;
      const slots = entry.availableSlots >= 1 ? Math.floor(entry.availableSlots) : (entry.availableSlots > 0 ? 1 : 0);
      if (slots > bestSlots) {
        bestSlots = slots;
        bestIndex = i;
      }
    }
    if (bestIndex === -1 || bestSlots <= 0) return null;
    const chosen = list[bestIndex];
    const assigned = Math.min(desiredCount, bestSlots);
    const result = {
      buildingId: chosen.buildingId,
      buildingName: chosen.buildingName,
      count: assigned,
    };
    chosen.availableSlots -= assigned;
    if (chosen.availableSlots <= 0) {
      list.splice(bestIndex, 1);
    }
    return result;
  };

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
    const roleWage = updatedWages[role] || getExpectedWage(role);
    const headTaxBase = STRATA[role]?.headTaxBase ?? 0.01;
    const taxCostPerCapita = headTaxBase * getHeadTaxRate(role) * effectiveTaxModifier;
    const disposableWage = roleWage - taxCostPerCapita;
    const lastTickIncome = getLastTickNetIncomePerCapita(role);
    const historicalIncomePerCapita = lastTickIncome !== null ? lastTickIncome : perCapDelta;
    const fallbackIncome = netIncomePerCapita !== 0 ? netIncomePerCapita : disposableWage;
    const incomeSignal = historicalIncomePerCapita !== 0 ? historicalIncomePerCapita : fallbackIncome;
    const stabilityBonus = perCap > 0 ? perCap * 0.002 : 0;

    // 以上一tick的人均净收入为主导，辅以小幅稳定性奖励，避免理论工资误导
    const potentialIncome = incomeSignal + stabilityBonus;

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

  // 寻找收入低于平均水平的源职业（排除军人，军人不能转职到其他岗位）
  const sourceCandidate = activeRoleMetrics
    .filter(r => r.pop > 0 && r.role !== 'soldier' && (r.potentialIncome < averagePotentialIncome * 0.7 || r.perCapDelta < -0.5))
    .reduce((lowest, current) => {
      if (!lowest) return current;
      if (current.potentialIncome < lowest.potentialIncome) return current;
      if (current.potentialIncome === lowest.potentialIncome && current.perCapDelta < lowest.perCapDelta) return current;
      return lowest;
    }, null);

  // 寻找收入显著更高的目标职业（必须有空缺，且必须是不同职业）
  let targetCandidate = null;
  if (sourceCandidate) {
    targetCandidate = activeRoleMetrics
      .filter(r =>
        r.role !== sourceCandidate.role &&
        r.vacancy > 0 &&
        hasBuildingVacancyForRole(r.role) &&
        r.potentialIncome > sourceCandidate.potentialIncome * 1.3
      )
      .reduce((best, current) => {
        if (!best) return current;
        if (current.potentialIncome > best.potentialIncome) return current;
        if (current.potentialIncome === best.potentialIncome && current.perCapDelta > best.perCapDelta) return best;
        return best;
      }, null);
  }

  // 执行转职并转移财富
  if (sourceCandidate && targetCandidate) {
    // 如果迁移比例为0，直接返回，不执行任何迁移
    if (JOB_MIGRATION_RATIO <= 0) {
        // do nothing
    } else {
        let placementInfo = null;
        let migrants = Math.floor(sourceCandidate.pop * JOB_MIGRATION_RATIO);
        // 只有当迁移比例大于0时才允许强制迁移
        if (migrants <= 0 && sourceCandidate.pop > 0 && JOB_MIGRATION_RATIO > 0) migrants = 1;
        migrants = Math.min(migrants, targetCandidate.vacancy);
        
        if (migrants > 0) {
          const placement = reserveBuildingVacancyForRole(targetCandidate.role, migrants);
          if (!placement || placement.count <= 0) {
            migrants = 0;
          } else {
            migrants = placement.count;
            placementInfo = placement;
          }
        }

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
          
          const sourceName = STRATA[sourceCandidate.role]?.name || sourceCandidate.role;      const targetName = STRATA[targetCandidate.role]?.name || targetCandidate.role;
          const incomeGain = ((targetCandidate.potentialIncome - sourceCandidate.potentialIncome) / Math.max(0.01, sourceCandidate.potentialIncome) * 100).toFixed(0);
          const placementNote = placementInfo?.buildingName ? `（目标建筑：${placementInfo.buildingName}）` : '';
          logs.push(`💼 ${migrants} 名 ${sourceName} 转职为 ${targetName}${placementNote}（预期收益提升 ${incomeGain}%）`);
        }
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
    gameSpeed,
    logs,
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

  taxBreakdown.policyIncome = decreeSilverIncome;
  taxBreakdown.policyExpense = decreeSilverExpense;

  const netTax = totalCollectedTax
    - taxBreakdown.subsidy
    + warIndemnityIncome
    + decreeSilverIncome
    - decreeSilverExpense;
  const taxes = {
    total: netTax,
    efficiency,
    breakdown: {
      headTax: collectedHeadTax,
      industryTax: collectedIndustryTax,
      businessTax: collectedBusinessTax,
      subsidy: taxBreakdown.subsidy,
      warIndemnity: warIndemnityIncome,
      policyIncome: decreeSilverIncome,
      policyExpense: decreeSilverExpense,
    },
  };

  console.log('[TICK END]', tick, 'militaryCapacity:', militaryCapacity);
  return {
    resources: res,
    rates,
    popStructure,
    maxPop: totalMaxPop,
    militaryCapacity, // 新增：军事容量
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
    jobsAvailable,
    taxes,
    needsShortages: classShortages,
    needsReport,
    nations: updatedNations,
    merchantState: updatedMerchantState,
  };
};
