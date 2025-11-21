import { BUILDINGS, STRATA, EPOCHS, RESOURCES } from '../config/gameData';

const ROLE_PRIORITY = [
  'official',
  'cleric',
  'capitalist',
  'landowner',
  'knight',
  'soldier',
  'worker',
  'miner',
  'lumberjack',
  'serf',
  'peasant',
];


const isTradableResource = (key) => {
  if (key === 'silver') return false;
  const def = RESOURCES[key];
  if (!def) return false;
  return !def.type || def.type !== 'virtual';
};

const cloneOwnership = (source = {}) => {
  const result = {};
  Object.keys(source).forEach((resource) => {
    result[resource] = { ...source[resource] };
  });
  return result;
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

const DEFAULT_FOREIGN_PARTNER = { relation: 0, economyTraits: { resourceBias: {} } };

const clampRelation = (value) => Math.max(-100, Math.min(100, value ?? 0));

export const calculateForeignPrice = (resource, nation = DEFAULT_FOREIGN_PARTNER, type = 'import') => {
  const base = getBasePrice(resource);
  const bias = nation?.economyTraits?.resourceBias?.[resource] ?? 1;
  const relation = clampRelation(nation?.relation ?? DEFAULT_FOREIGN_PARTNER.relation);
  const relationFactor = type === 'import'
    ? 1 - (relation / 200)
    : 1 + (relation / 200);
  const volatility = 1 + (Math.random() - 0.5) * 0.1;
  return Math.max(0.1, base * bias * relationFactor * volatility);
};

export const simulateTick = ({
  resources,
  buildings,
  population,
  decrees,
  gameSpeed,
  epoch,
  market,
  classWealth,
  activeBuffs: productionBuffs = [],
  activeDebuffs: productionDebuffs = [],
  taxPolicies,
  nations = [],
  tradeRoutes = [],
}) => {
  const res = { ...resources };
  const priceMap = { ...(market?.prices || {}) };
  const ownership = cloneOwnership(market?.ownership || {});
  const previousWages = market?.wages || {};
  const demand = {};
  const supply = {};
  const externalTrade = {
    imports: {},
    exports: {},
    importCost: 0,
    exportRevenue: 0,
    routes: [],
  };
  const nationMap = {};
  nations.forEach(n => {
    if (n?.id) nationMap[n.id] = n;
  });
  const wealth = initializeWealth(classWealth);
  const policies = taxPolicies || {};
  const headTaxRates = policies.headTaxRates || {};
  const resourceTaxRates = policies.resourceTaxRates || {};
  const getHeadTaxRate = (key) => {
    const rate = headTaxRates[key];
    return typeof rate === 'number' ? rate : 1;
  };
  const getResourceTaxRate = (resource) => {
    const rate = resourceTaxRates[resource];
    if (typeof rate === 'number') return Math.max(0, rate);
    return 0;
  };
  const taxBreakdown = {
    headTax: 0,
    industryTax: 0,
  };

  const getPrice = (resource) => {
    if (!priceMap[resource]) {
      priceMap[resource] = getBasePrice(resource);
    }
    return priceMap[resource];
  };

  const ensureBucket = (resource) => {
    if (!ownership[resource]) ownership[resource] = {};
  };

  const creditProduction = (resource, amount, ownerKey) => {
    if (amount <= 0) return;
    if (!isTradableResource(resource)) {
      res[resource] = (res[resource] || 0) + amount;
      return;
    }
    res[resource] = (res[resource] || 0) + amount;
    supply[resource] = (supply[resource] || 0) + amount;
    ensureBucket(resource);
    ownership[resource][ownerKey] = (ownership[resource][ownerKey] || 0) + amount;
  };

  const getExternalPrice = (resource, type) => calculateForeignPrice(resource, DEFAULT_FOREIGN_PARTNER, type);

  const settleMarketPurchase = (resource, desiredAmount, options = {}) => {
    const { allowImport = false } = options;
    if (!isTradableResource(resource) || desiredAmount <= 0) {
      return { amount: 0, spent: 0, localAmount: 0, imported: 0 };
    }
    const price = getPrice(resource);
    const available = res[resource] || 0;
    const localAmount = Math.min(desiredAmount, available);
    if (localAmount <= 0 && !allowImport) {
      return { amount: 0, spent: 0, localAmount: 0, imported: 0 };
    }

    res[resource] = available - localAmount;
    demand[resource] = (demand[resource] || 0) + localAmount;
    ensureBucket(resource);

    let remaining = localAmount;
    const bucket = ownership[resource];
    for (const ownerKey of Object.keys(bucket)) {
      if (remaining <= 0) break;
      const owned = bucket[ownerKey] || 0;
      if (owned <= 0) continue;
      const sold = Math.min(owned, remaining);
      bucket[ownerKey] = owned - sold;
      wealth[ownerKey] = (wealth[ownerKey] || 0) + sold * price;
      remaining -= sold;
    }

    const baseCost = localAmount * price;
    const resourceTaxRate = Math.max(0, getResourceTaxRate(resource));
    const taxPaid = baseCost * resourceTaxRate;
    if (taxPaid > 0) {
      taxBreakdown.industryTax += taxPaid;
    }
    let imported = 0;
    let importCost = 0;
    if (allowImport && localAmount < desiredAmount) {
      imported = desiredAmount - localAmount;
      const importPrice = getExternalPrice(resource, 'import');
      importCost = imported * importPrice;
      externalTrade.imports[resource] = (externalTrade.imports[resource] || 0) + imported;
      externalTrade.importCost += importCost;
      demand[resource] = (demand[resource] || 0) + imported;
    }

    return { amount: localAmount + imported, spent: baseCost + taxPaid + importCost, localAmount, imported };
  };

  const rates = {};
  const builds = buildings;
  const jobsAvailable = {};
  const roleWageStats = {};
  const roleWagePayout = {};
  let totalMaxPop = 5;
  let adminCapacity = 20;

  ROLE_PRIORITY.forEach(role => jobsAvailable[role] = 0);
  ROLE_PRIORITY.forEach(role => {
    roleWageStats[role] = { totalSlots: 0, weightedWage: 0 };
    roleWagePayout[role] = 0;
  });

  BUILDINGS.forEach(b => {
    const count = builds[b.id] || 0;
    if (count > 0) {
      if (b.output?.maxPop) totalMaxPop += (b.output.maxPop * count);
      if (b.output?.admin) adminCapacity += (b.output.admin * count);
      if (b.jobs) {
        for (let role in b.jobs) jobsAvailable[role] += (b.jobs[role] * count);
      }
    }
  });

  let remainingPop = population;
  const popStructure = {};

  ROLE_PRIORITY.forEach(role => {
    if (role === 'peasant') {
      popStructure[role] = Math.max(0, remainingPop);
      remainingPop = 0;
    } else {
      const filled = Math.min(remainingPop, jobsAvailable[role] || 0);
      popStructure[role] = filled;
      remainingPop -= filled;
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
  const effectiveTaxModifier = Math.max(0, taxModifier);

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
    if (due > 0) {
      const available = wealth[key] || 0;
      const paid = Math.min(available, due);
      wealth[key] = available - paid;
      taxBreakdown.headTax += paid;
    }
    classApproval[key] = 50;
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

    if (b.input) {
      for (const [resKey, perUnit] of Object.entries(b.input)) {
        const perMultiplierAmount = perUnit * count;
        const requiredAtBase = perMultiplierAmount * baseMultiplier;
        if (requiredAtBase <= 0) continue;
        if (isTradableResource(resKey)) {
          const available = res[resKey] || 0;
          if (available <= 0) {
            resourceLimit = 0;
          } else {
            resourceLimit = Math.min(resourceLimit, available / requiredAtBase);
          }
          const price = getPrice(resKey);
          inputValuePerMultiplier += perMultiplierAmount * price;
          const taxRate = Math.max(0, getResourceTaxRate(resKey));
          inputCostPerMultiplier += perMultiplierAmount * price * (1 + taxRate);
        }
      }
    }

    const targetMultiplier = baseMultiplier * Math.max(0, Math.min(1, resourceLimit));

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

    const plannedWagePerSlot = paidSlotsTotal > 0 ? (profitPerMultiplier * actualMultiplier) / paidSlotsTotal : 0;
    const plannedWageBill = plannedWagePerSlot * paidSlotsFilled;

    if (b.input) {
      for (const [resKey, perUnit] of Object.entries(b.input)) {
        const amountNeeded = perUnit * count * actualMultiplier;
        if (!amountNeeded || amountNeeded <= 0) continue;
        const { spent, localAmount } = settleMarketPurchase(resKey, amountNeeded, { allowImport: true });
        if (spent > 0) {
          wealth[ownerKey] = Math.max(0, (wealth[ownerKey] || 0) - spent);
          if (localAmount > 0) {
            rates[resKey] = (rates[resKey] || 0) - localAmount;
          }
        }
      }
    }

    let actualWagePerSlot = plannedWagePerSlot;
    if (paidSlotsTotal > 0 && plannedWageBill > 0) {
      const available = wealth[ownerKey] || 0;
      const paid = Math.min(available, plannedWageBill);
      wealth[ownerKey] = available - paid;
      const wageRatio = plannedWageBill > 0 ? paid / plannedWageBill : 0;
      actualWagePerSlot = plannedWagePerSlot * wageRatio;
    } else {
      actualWagePerSlot = 0;
    }

    if (b.output) {
      for (const [resKey, perUnit] of Object.entries(b.output)) {
        if (resKey === 'maxPop' || resKey === 'admin') {
          res[resKey] = (res[resKey] || 0) + (perUnit * count * actualMultiplier);
          continue;
        }
        const amount = perUnit * count * actualMultiplier;
        creditProduction(resKey, amount, ownerKey);
        rates[resKey] = (rates[resKey] || 0) + amount;
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
    const shortages = [];

    for (const [resKey, perCapita] of Object.entries(def.needs)) {
      const resourceInfo = RESOURCES[resKey];
      if (resourceInfo && typeof resourceInfo.unlockEpoch === 'number' && resourceInfo.unlockEpoch > epoch) {
        continue;
      }
      let requirement = perCapita * count * gameSpeed;
      if (requirement <= 0) continue;
      const originalRequirement = requirement;
      let satisfied = 0;

      const ownedBucket = ownership[resKey]?.[key] || 0;
      if (ownedBucket > 0) {
        const consumeOwn = Math.min(requirement, ownedBucket);
        ownership[resKey][key] = ownedBucket - consumeOwn;
        if (ownership[resKey][key] <= 0) {
          delete ownership[resKey][key];
        }
        res[resKey] = Math.max(0, (res[resKey] || 0) - consumeOwn);
        rates[resKey] = (rates[resKey] || 0) - consumeOwn;
        requirement -= consumeOwn;
        satisfied += consumeOwn;
      }

      if (requirement > 0) {
      const price = getPrice(resKey);
      const maxAffordable = price > 0 ? Math.min(requirement, (wealth[key] || 0) / price) : requirement;
      const { amount, spent, localAmount } = settleMarketPurchase(resKey, maxAffordable, { allowImport: true });
      if (spent > 0) {
        wealth[key] = Math.max(0, (wealth[key] || 0) - spent);
        if (localAmount > 0) {
          rates[resKey] = (rates[resKey] || 0) - localAmount;
        }
      }
      satisfied += amount;
      }

      const ratio = originalRequirement > 0 ? satisfied / originalRequirement : 1;
      satisfactionSum += ratio;
      tracked += 1;
      if (ratio < 0.99) {
        shortages.push(resKey);
      }
    }

    needsReport[key] = tracked > 0 ? satisfactionSum / tracked : 1;
    classShortages[key] = shortages;
  });

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
        }
      }
    }
  });

  Object.keys(STRATA).forEach(key => {
    const count = popStructure[key] || 0;
    if (count === 0) return;
    const satisfaction = needsReport[key] ?? 1;
    let approval = classApproval[key] || 50;
    if (satisfaction < 0.5) {
      approval -= 20;
    } else if (satisfaction < 1) {
      approval -= 10;
    } else if (satisfaction > 1.5) {
      approval += 10;
    }
    classApproval[key] = Math.max(0, Math.min(100, approval));
  });


  let epochAdminBonus = 0;
  if (epoch > 0 && EPOCHS[epoch].bonuses.adminBonus) {
    epochAdminBonus = EPOCHS[epoch].bonuses.adminBonus;
  }

  adminCapacity += epochAdminBonus;
  res.admin = adminCapacity - currentAdminStrain;
  let efficiency = res.admin < 0 ? 0.5 : 1.0;

  res.admin = Math.max(0, res.admin);

  const collectedHeadTax = taxBreakdown.headTax * efficiency;
  const collectedIndustryTax = taxBreakdown.industryTax * efficiency;
  const totalCollectedTax = collectedHeadTax + collectedIndustryTax;

  res.silver = (res.silver || 0) + totalCollectedTax;
  rates.silver = (rates.silver || 0) + totalCollectedTax;

  let nextPopulation = population;
  if ((res.food || 0) > population * 2 && population < totalMaxPop) {
    if (Math.random() > 0.8) nextPopulation = population + 1;
  }
  if ((res.food || 0) <= 0) {
    res.food = 0;
    if (Math.random() > 0.9 && population > 2) {
      nextPopulation = population - 1;
      logs.push("饥荒导致人口减少！");
    }
  }

  Object.keys(res).forEach(k => {
    if (res[k] < 0) res[k] = 0;
  });

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

  const newActiveBuffs = [];
  const newActiveDebuffs = [];

  Object.keys(STRATA).forEach(key => {
    const def = STRATA[key];
    if (!def.buffs || (popStructure[key] || 0) === 0) return;
    const approval = classApproval[key] || 50;
    const satisfied = (needsReport[key] ?? 1) >= 0.95;
    if (approval >= 70 && satisfied) {
      newActiveBuffs.push({
        class: key,
        ...def.buffs.satisfied,
      });
    } else if (approval < 40) {
      newActiveDebuffs.push({
        class: key,
        ...def.buffs.dissatisfied,
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

  const totalInfluence = Object.values(classInfluence).reduce((sum, val) => sum + val, 0);

  const updatedPrices = { ...priceMap };
  const updatedWages = {};
  const wageSmoothing = 0.35;
  Object.entries(roleWageStats).forEach(([role, data]) => {
    const avgWage = data.totalSlots > 0 ? data.weightedWage / data.totalSlots : 0;
    const prev = previousWages[role] || 0;
    const smoothed = prev + (avgWage - prev) * wageSmoothing;
    updatedWages[role] = Math.max(0, Number(smoothed.toFixed(2)));
  });

  const EXPORT_RATIO = 0.5;
  Object.keys(RESOURCES).forEach(resource => {
    if (!isTradableResource(resource)) return;
    const base = getBasePrice(resource);
    const sup = supply[resource] || 0;
    const dem = demand[resource] || 0;
    const ratio = dem / Math.max(sup, 1);
    const targetPrice = base * Math.max(0.25, Math.min(4, ratio));
    const prevPrice = priceMap[resource] || base;
    const smoothed = prevPrice + (targetPrice - prevPrice) * 0.3;
    updatedPrices[resource] = parseFloat(smoothed.toFixed(2));

    const surplus = Math.max(0, (supply[resource] || 0) - (demand[resource] || 0));
    const available = res[resource] || 0;
    if (surplus > 0 && available > 0) {
      const exportTarget = Math.min(available * 0.4, surplus * EXPORT_RATIO);
      if (exportTarget > 0.0001) {
        let remaining = exportTarget;
        ensureBucket(resource);
        const bucket = ownership[resource];
        const exportPrice = getExternalPrice(resource, 'export');
        let soldTotal = 0;
        for (const ownerKey of Object.keys(bucket)) {
          if (remaining <= 0) break;
          const owned = bucket[ownerKey] || 0;
          if (owned <= 0) continue;
          const sold = Math.min(owned, remaining);
          bucket[ownerKey] = owned - sold;
          wealth[ownerKey] = (wealth[ownerKey] || 0) + sold * exportPrice;
          remaining -= sold;
          soldTotal += sold;
        }
        if (soldTotal > 0) {
          res[resource] = Math.max(0, available - soldTotal);
          externalTrade.exports[resource] = (externalTrade.exports[resource] || 0) + soldTotal;
          externalTrade.exportRevenue += soldTotal * exportPrice;
        }
      }
    }
  });

  const tradeRouteReports = [];
  const tradeVolumeMultiplier = Math.max(0.1, gameSpeed);
  tradeRoutes.forEach(route => {
    if (!route || !isTradableResource(route.resource)) return;
    const nation = nationMap[route.targetNationId] || DEFAULT_FOREIGN_PARTNER;
    const desiredVolume = Math.max(0, route.volume || 0) * tradeVolumeMultiplier;
    if (desiredVolume <= 0) return;

    if (route.type === 'export') {
      const estimatedCost = getPrice(route.resource) * desiredVolume * (1 + Math.max(0, getResourceTaxRate(route.resource)));
      if ((res.silver || 0) < estimatedCost) {
        tradeRouteReports.push({ id: route.id, type: 'export', resource: route.resource, amount: 0, note: 'lack_silver' });
        return;
      }
      const { amount, spent } = settleMarketPurchase(route.resource, desiredVolume, { allowImport: false });
      if (amount <= 0 || spent <= 0) {
        tradeRouteReports.push({ id: route.id, type: 'export', resource: route.resource, amount: 0, note: 'no_supply' });
        return;
      }
      res.silver = Math.max(0, (res.silver || 0) - spent);
      const foreignPrice = calculateForeignPrice(route.resource, nation, 'export');
      const revenue = amount * foreignPrice;
      res.silver = (res.silver || 0) + revenue;
      externalTrade.exports[route.resource] = (externalTrade.exports[route.resource] || 0) + amount;
      externalTrade.exportRevenue += revenue;
      tradeRouteReports.push({
        id: route.id,
        type: 'export',
        nation: nation?.id || 'unknown',
        resource: route.resource,
        amount,
        cost: spent,
        revenue,
      });
    } else {
      const importPrice = calculateForeignPrice(route.resource, nation, 'import');
      const totalCost = importPrice * desiredVolume;
      if ((res.silver || 0) < totalCost) {
        tradeRouteReports.push({ id: route.id, type: 'import', resource: route.resource, amount: 0, note: 'lack_silver' });
        return;
      }
      res.silver = Math.max(0, (res.silver || 0) - totalCost);
      creditProduction(route.resource, desiredVolume, 'state');
      externalTrade.imports[route.resource] = (externalTrade.imports[route.resource] || 0) + desiredVolume;
      externalTrade.importCost += totalCost;
      tradeRouteReports.push({
        id: route.id,
        type: 'import',
        nation: nation?.id || 'unknown',
        resource: route.resource,
        amount: desiredVolume,
        cost: totalCost,
      });
    }
  });
  if (tradeRouteReports.length > 0) {
    externalTrade.routes = tradeRouteReports;
  }

  const roleVacancies = {};
  ROLE_PRIORITY.forEach(role => {
    roleVacancies[role] = Math.max(0, (jobsAvailable[role] || 0) - (popStructure[role] || 0));
  });

  const sourceRole = ROLE_PRIORITY
    .filter(role => (popStructure[role] || 0) > 0)
    .reduce((lowest, role) => {
      if (lowest === null) return role;
      const wage = updatedWages[role] || 0;
      const lowestWage = updatedWages[lowest] || 0;
      if (wage < lowestWage) return role;
      if (wage === lowestWage && (popStructure[role] || 0) > (popStructure[lowest] || 0)) return role;
      return lowest;
    }, null);

  const targetRole = ROLE_PRIORITY
    .filter(role => roleVacancies[role] > 0)
    .reduce((highest, role) => {
      if (highest === null) return role;
      const wage = updatedWages[role] || 0;
      const highestWage = updatedWages[highest] || 0;
      if (wage > highestWage) return role;
      if (wage === highestWage && roleVacancies[role] > roleVacancies[highest]) return role;
      return highest;
    }, null);

  if (sourceRole && targetRole && (updatedWages[targetRole] || 0) > (updatedWages[sourceRole] || 0)) {
    const sourcePop = popStructure[sourceRole] || 0;
    let migrants = Math.floor(sourcePop * 0.05);
    if (migrants <= 0 && sourcePop > 0) migrants = 1;
    migrants = Math.min(migrants, roleVacancies[targetRole]);
    if (migrants > 0) {
      popStructure[sourceRole] = sourcePop - migrants;
      popStructure[targetRole] = (popStructure[targetRole] || 0) + migrants;
      logs.push(`${migrants} 名 ${STRATA[sourceRole]?.name || sourceRole} 转职为 ${STRATA[targetRole]?.name || targetRole}`);
    }
  }

  const taxes = {
    total: totalCollectedTax,
    efficiency,
    breakdown: {
      headTax: collectedHeadTax,
      industryTax: collectedIndustryTax,
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
    stability: Math.max(0, Math.min(100, 50 + stabilityModifier * 100)),
    logs,
    market: {
      prices: updatedPrices,
      demand,
      supply,
      ownership,
      wages: updatedWages,
      externalTrade,
    },
    jobFill: buildingJobFill,
    taxes,
    needsShortages: classShortages,
  };
};
