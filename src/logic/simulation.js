import { BUILDINGS, STRATA, EPOCHS, RESOURCES, TECHS } from '../config';
import { calculateArmyPopulation, calculateArmyFoodNeed } from '../config';

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


const isTradableResource = (key) => {
  if (key === 'silver') return false;
  const def = RESOURCES[key];
  if (!def) return false;
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

export const simulateTick = ({
  resources,
  buildings,
  population,
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
      wealth[ownerKey] = (wealth[ownerKey] || 0) + price * amount;
    }
  };

  const rates = {};
  const builds = buildings;
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

  if (armyPopulationDemand > 0) {
    jobsAvailable.soldier = (jobsAvailable.soldier || 0) + armyPopulationDemand;
  }

  let remainingPop = population;
  const popStructure = {};

  ROLE_PRIORITY.forEach(role => {
    const slots = Math.max(0, jobsAvailable[role] || 0);
    const filled = Math.min(remainingPop, slots);
    popStructure[role] = filled;
    remainingPop -= filled;
  });

  popStructure.unemployed = Math.max(0, remainingPop);
  remainingPop = 0;

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
    classApproval[key] = previousApproval[key] ?? 50;
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

    if (b.input) {
      for (const [resKey, perUnit] of Object.entries(b.input)) {
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
          wealth[ownerKey] = Math.max(0, (wealth[ownerKey] || 0) - (baseCost + taxPaid));
        }
        rates[resKey] = (rates[resKey] || 0) - consumed;
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

  Object.entries(roleWagePayout).forEach(([role, payout]) => {
    if (payout <= 0) return;
    wealth[role] = (wealth[role] || 0) + payout;
  });

  const wageMultiplier = Math.max(0, militaryWageRatio ?? 0);
  const foodPrice = getPrice('food');
  const baseArmyWage = armyFoodNeed * foodPrice * wageMultiplier;

  if (baseArmyWage > 0) {
    const wageDue = baseArmyWage * gameSpeed;
    const available = res.silver || 0;
    const paid = Math.min(available, wageDue);
    if (paid > 0) {
      res.silver = available - paid;
      rates.silver = (rates.silver || 0) - paid;
      wealth.soldier = (wealth.soldier || 0) + paid;
    }
    if (paid < wageDue) {
      logs.push('银币不足，军饷被拖欠，军心不稳。');
    }
  }

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
          wealth[key] = Math.max(0, (wealth[key] || 0) - (baseCost + taxPaid));
          satisfied = amount;
        }
      } else {
        const amount = Math.min(requirement, available);
        if (amount > 0) {
          res[resKey] = available - amount;
          satisfied = amount;
        }
      }

      const ratio = requirement > 0 ? satisfied / requirement : 1;
      satisfactionSum += ratio;
      tracked += 1;
      if (ratio < 0.99) {
        shortages.push(resKey);
      }
    }

  needsReport[key] = tracked > 0 ? satisfactionSum / tracked : 1;
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

    if (key === 'unemployed') {
      const ratio = count / Math.max(1, population);
      const penalty = 2 + ratio * 30;
      approval -= penalty;
    }

    classApproval[key] = Math.max(0, Math.min(100, approval));
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
  Object.keys(STRATA).forEach(key => {
    const count = popStructure[key] || 0;
    if (count === 0) return;
    const approval = classApproval[key] || 50;
    if (approval >= 30) return;
    const influenceShare = totalInfluence > 0 ? (classInfluence[key] || 0) / totalInfluence : 0;
    const className = STRATA[key]?.name || key;
    if (approval < 25 && influenceShare < 0.07) {
      const leaving = Math.min(count, Math.max(1, Math.floor(count * 0.12)));
      exodusPopulationLoss += leaving;
      logs.push(`${className} 阶层对政局失望，${leaving} 人离开了国家。`);
    } else if (influenceShare >= 0.12) {
      const penalty = Math.min(0.2, 0.05 + influenceShare * 0.15);
      extraStabilityPenalty += penalty;
      logs.push(`${className} 阶层的愤怒正在削弱社会稳定。`);
    }
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
  stabilityModifier -= extraStabilityPenalty;

  const stabilityValue = Math.max(0, Math.min(100, 50 + stabilityModifier * 100));
  const stabilityFactor = Math.min(1.5, Math.max(0.5, 1 + (stabilityValue - 50) / 100));
  const efficiency = adminEfficiency * stabilityFactor;

  const visibleEpoch = epoch;
  const updatedNations = (nations || []).map(nation => {
    const next = { ...nation };
    const visible = visibleEpoch >= (nation.appearEpoch ?? 0) && (nation.expireEpoch == null || visibleEpoch <= nation.expireEpoch);
    if (!visible) return next;
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

  if ((res.food || 0) > population * 2 && population < totalMaxPop) {
    const growthBonus = Math.max(0, (stabilityValue - 50) / 200);
    const threshold = Math.max(0.3, 0.8 - Math.min(0.3, growthBonus));
    if (Math.random() > threshold) {
      nextPopulation = Math.min(totalMaxPop, nextPopulation + 1);
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
    const base = getBasePrice(resource);
    const sup = supply[resource] || 0;
    const dem = demand[resource] || 0;
    const ratio = dem / Math.max(sup, 1);
    const targetPrice = Math.max(PRICE_FLOOR, base * Math.max(0.25, Math.min(4, ratio)));
    const prevPrice = priceMap[resource] || base;
    const smoothed = prevPrice + (targetPrice - prevPrice) * 0.3;
    updatedPrices[resource] = parseFloat(Math.max(PRICE_FLOOR, smoothed).toFixed(2));
  });

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
    return {
      role,
      pop,
      perCap,
      perCapDelta,
      vacancy: roleVacancies[role] || 0,
    };
  });

  const totalMigratablePop = activeRoleMetrics.reduce((sum, r) => r.pop > 0 ? sum + r.pop : sum, 0);
  const averagePerCapWealth = totalMigratablePop > 0
    ? activeRoleMetrics.reduce((sum, r) => sum + (r.perCap * r.pop), 0) / totalMigratablePop
    : 0;

  const sourceCandidate = activeRoleMetrics
    .filter(r => r.pop > 0 && (r.perCap < averagePerCapWealth || r.perCapDelta < 0))
    .reduce((lowest, current) => {
      if (!lowest) return current;
      if (current.perCap < lowest.perCap) return current;
      if (current.perCap === lowest.perCap && current.perCapDelta < lowest.perCapDelta) return current;
      return lowest;
    }, null);

  let targetCandidate = null;
  if (sourceCandidate) {
    targetCandidate = activeRoleMetrics
      .filter(r => r.vacancy > 0 && r.perCap > sourceCandidate.perCap && r.perCapDelta > sourceCandidate.perCapDelta)
      .reduce((best, current) => {
        if (!best) return current;
        if (current.perCap > best.perCap) return current;
        if (current.perCap === best.perCap && current.perCapDelta > best.perCapDelta) return current;
        return best;
      }, null);
  }

  if (sourceCandidate && targetCandidate) {
    let migrants = Math.floor(sourceCandidate.pop * JOB_MIGRATION_RATIO);
    if (migrants <= 0 && sourceCandidate.pop > 0) migrants = 1;
    migrants = Math.min(migrants, targetCandidate.vacancy);
    if (migrants > 0) {
      popStructure[sourceCandidate.role] = Math.max(0, sourceCandidate.pop - migrants);
      popStructure[targetCandidate.role] = (popStructure[targetCandidate.role] || 0) + migrants;
      logs.push(`${migrants} 名 ${STRATA[sourceCandidate.role]?.name || sourceCandidate.role} 转向 ${STRATA[targetCandidate.role]?.name || targetCandidate.role} 寻求更高收益`);
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
    stability: stabilityValue,
    logs,
    market: {
      prices: updatedPrices,
      demand,
      supply,
      wages: updatedWages,
    },
    jobFill: buildingJobFill,
    taxes,
    needsShortages: classShortages,
    nations: updatedNations,
  };
};
