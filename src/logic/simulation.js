import { BUILDINGS, STRATA, EPOCHS, RESOURCES, TECHS } from '../config';
import { calculateArmyPopulation, calculateArmyFoodNeed } from '../config';
import { isResourceUnlocked } from '../utils/resources';

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


const SPECIAL_TRADE_RESOURCES = new Set(['admin']);
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
}) => {
  const res = { ...resources };
  const priceMap = { ...(market?.prices || {}) };
  const previousWages = market?.wages || {};
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
  let extraAdminCapacity = 0;
  let productionBonus = 0;
  let industryBonus = 0;
  let taxBonus = 0;

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
      extraMaxPop += effects.maxPop;
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

  // Keep domestic vs. external price deviations modest unless supply/demand is extreme
  const computePriceMultiplier = (ratio) => {
    const clamped = Math.max(0.25, Math.min(4, ratio || 1));
    const softened = Math.pow(clamped, 0.35);
    if (ratio > 2.5) {
      const severity = Math.min(1.5, ratio - 2.5);
      return softened + severity * 0.2;
    }
    if (ratio < 0.6) {
      const severity = Math.min(0.6, 0.6 - ratio);
      return Math.max(0.4, softened - severity * 0.2);
    }
    return softened;
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
    let paidSlotsTotal = 0;
    let paidSlotsFilled = 0;
    if (b.jobs) {
      buildingJobFill[b.id] = buildingJobFill[b.id] || {};
      for (let role in b.jobs) {
        const roleRequired = b.jobs[role] * count;
        totalSlots += roleRequired;
        const totalRoleJobs = jobsAvailable[role];
        const totalRolePop = popStructure[role];
        const fillRate = totalRoleJobs > 0 ? Math.min(1, totalRolePop / totalRoleJobs) : 0;
        const roleFilled = roleRequired * fillRate;
        filledSlots += roleFilled;
        buildingJobFill[b.id][role] = roleFilled;
        if (role !== ownerKey) {
          paidSlotsTotal += roleRequired;
          paidSlotsFilled += roleFilled;
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
    let inputValuePerMultiplier = 0;
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
          inputValuePerMultiplier += perMultiplierAmount * price;
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
    if (b.output) {
      for (const [resKey, perUnit] of Object.entries(b.output)) {
        if (resKey === 'maxPop' || resKey === 'admin') continue;
        if (!isTradableResource(resKey)) continue;
        const perMultiplierAmount = perUnit * count;
        outputValuePerMultiplier += perMultiplierAmount * getPrice(resKey);
      }
    }

    const profitPerMultiplier = Math.max(0, outputValuePerMultiplier - inputValuePerMultiplier);
    const paidFillRatio = paidSlotsTotal > 0 ? Math.max(0, Math.min(1, paidSlotsFilled / paidSlotsTotal)) : 0;
    const wageCostPerMultiplier = paidSlotsTotal > 0 ? profitPerMultiplier * paidFillRatio : 0;
    const totalOperatingCostPerMultiplier = inputCostPerMultiplier + wageCostPerMultiplier;

    let actualMultiplier = targetMultiplier;
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

    const plannedWagePerSlot = paidSlotsTotal > 0 ? (profitPerMultiplier * actualMultiplier) / paidSlotsTotal : 0;
    const plannedWageBill = plannedWagePerSlot * paidSlotsFilled;

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
        if (consumed <= 0) continue;
        res[resKey] = available - consumed;
        if (isTradableResource(resKey)) {
          demand[resKey] = (demand[resKey] || 0) + consumed;
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
        rates[resKey] = (rates[resKey] || 0) - consumed;
      }
    }

    let actualWagePerSlot = plannedWagePerSlot;
    if (paidSlotsTotal > 0 && plannedWageBill > 0) {
      const available = wealth[ownerKey] || 0;
      const paid = Math.min(available, plannedWageBill);
      wealth[ownerKey] = available - paid;
      // 记录owner支付工资的支出
      roleExpense[ownerKey] = (roleExpense[ownerKey] || 0) + paid;
      const wageRatio = plannedWageBill > 0 ? paid / plannedWageBill : 0;
      actualWagePerSlot = plannedWagePerSlot * wageRatio;
    } else {
      actualWagePerSlot = 0;
    }

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
  Object.entries(roleWagePayout).forEach(([role, payout]) => {
    if (payout <= 0) return;
    wealth[role] = (wealth[role] || 0) + payout;
  });

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
      const requirement = perCapita * count * gameSpeed;
      if (requirement <= 0) continue;
      const available = res[resKey] || 0;
      let satisfied = 0;

      if (isTradableResource(resKey)) {
        const price = getPrice(resKey);
        const affordable = price > 0 ? Math.min(requirement, (wealth[key] || 0) / price) : requirement;
        const amount = Math.min(requirement, available, affordable);
        if (amount > 0) {
          res[resKey] = available - amount;
          demand[resKey] = (demand[resKey] || 0) + amount;
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

  const totalWealth = Object.values(classWealthResult).reduce((sum, val) => sum + val, 0);

  Object.keys(STRATA).forEach(key => {
    const count = popStructure[key] || 0;
    if (count === 0) return;
    const def = STRATA[key];
    const wealthShare = classWealthResult[key] || 0;
    const wealthFactor = totalWealth > 0 ? wealthShare / totalWealth : 0;
    classInfluence[key] = (def.influenceBase * count) + (wealthFactor * 10);
  });

  const totalInfluence = Object.values(classInfluence).reduce((sum, val) => sum + val, 0);
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
    if (!next.inventory) next.inventory = {};
    if (typeof next.budget !== 'number') next.budget = (next.wealth || 800) * 0.5;
    
    // 遍历该国的资源偏差，模拟生产和消耗
    if (next.economyTraits?.resourceBias) {
      Object.entries(next.economyTraits.resourceBias).forEach(([resourceKey, bias]) => {
        const currentStock = next.inventory[resourceKey] || 0;
        
        if (bias > 1) {
          // 特产资源：自然生产
          const productionRate = bias * 0.5 * gameSpeed;
          next.inventory[resourceKey] = currentStock + productionRate;
        } else if (bias <= 1) {
          // 非特产资源：自然消耗
          const consumptionRate = (1 / bias) * 0.2 * gameSpeed;
          next.inventory[resourceKey] = Math.max(0, currentStock - consumptionRate);
        }
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

  // FIX: 外部需求也应该随游戏速度缩放，否则加速时会导致供过于求（物价暴跌）
  const baseExternalDemand = (5 + population * 0.2) * gameSpeed;
  Object.keys(RESOURCES).forEach(resource => {
    if (!isTradableResource(resource)) return;
    demand[resource] = (demand[resource] || 0) + baseExternalDemand;
  });

  Object.keys(RESOURCES).forEach(resource => {
    if (!isTradableResource(resource)) return;
    const base = getBasePrice(resource);
    const sup = supply[resource] || 0;
    const dem = demand[resource] || 0;
    const ratio = dem / Math.max(sup, 1);
    const priceMultiplier = computePriceMultiplier(ratio);
    const targetPrice = Math.max(PRICE_FLOOR, base * priceMultiplier);
    const prevPrice = priceMap[resource] || base;
    const smoothed = prevPrice + (targetPrice - prevPrice) * 0.3;
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
    
    // 计算潜在收入：基于资源价格和工资
    let potentialIncome = 0;
    const roleDef = STRATA[role];
    const roleWage = updatedWages[role] || 0;
    
    if (roleDef && roleDef.defaultResource) {
      const resourcePrice = getPrice(roleDef.defaultResource);
      const basePrice = getBasePrice(roleDef.defaultResource);
      // 资源价格越高，职业越有吸引力
      const priceMultiplier = resourcePrice / basePrice;
      potentialIncome = (perCap * priceMultiplier * 0.6) + (roleWage * 0.4);
    } else {
      potentialIncome = (perCap * 0.6) + (roleWage * 0.4);
    }
    
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
    },
    classIncome: roleWagePayout,
    classExpense: roleExpense,
    jobFill: buildingJobFill,
    taxes,
    needsShortages: classShortages,
    needsReport,
    nations: updatedNations,
  };
};
