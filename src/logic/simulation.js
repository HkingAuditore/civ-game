import { BUILDINGS, STRATA } from '../config/gameData';

const ROLE_PRIORITY = ['official', 'cleric', 'capitalist', 'landowner', 'knight', 'soldier', 'worker', 'serf', 'slave', 'peasant'];

export const simulateTick = ({ resources, buildings, population, decrees, gameSpeed }) => {
  const res = { ...resources };
  const builds = buildings;
  const rates = {};

  const jobsAvailable = {};
  let totalMaxPop = 5;
  let adminCapacity = 20;

  ROLE_PRIORITY.forEach(role => jobsAvailable[role] = 0);

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
      popStructure[role] = remainingPop;
    } else {
      const filled = Math.min(remainingPop, jobsAvailable[role] || 0);
      popStructure[role] = filled;
      remainingPop -= filled;
    }
  });

  let currentAdminStrain = 0;
  let taxIncome = 0;
  const classApproval = {};

  Object.keys(STRATA).forEach(key => {
    const count = popStructure[key] || 0;
    if (count === 0) return;
    const def = STRATA[key];
    if (def.admin > 0) currentAdminStrain += count * def.admin;
    taxIncome += count * def.tax * gameSpeed;
    classApproval[key] = 50;
  });

  decrees.forEach(d => {
    if (d.active) {
      currentAdminStrain += d.cost.admin;
      if (d.id === 'forced_labor') {
        if (popStructure.slave > 0) classApproval.slave -= 20;
        if (popStructure.serf > 0) classApproval.serf -= 20;
        if (popStructure.landowner > 0) classApproval.landowner += 10;
      }
      if (d.id === 'tithe') {
        if (popStructure.cleric > 0) classApproval.cleric -= 10;
        taxIncome += (popStructure.cleric || 0) * 2 * gameSpeed;
      }
    }
  });

  const adminStrain = currentAdminStrain;
  res.admin = Math.max(0, adminCapacity - adminStrain);
  const efficiency = res.admin < 0 ? 0.5 : 1.0;

  const logs = [];
  const foodConsumption = population * 0.5 * gameSpeed;
  res.food -= foodConsumption;
  rates['food'] = (rates['food'] || 0) - foodConsumption;
  res.gold += taxIncome * efficiency;
  rates['gold'] = (rates['gold'] || 0) + (taxIncome * efficiency);

  BUILDINGS.forEach(b => {
    const count = builds[b.id] || 0;
    if (count === 0) return;

    let multiplier = 1.0 * gameSpeed * efficiency;

    let staffingRatio = 1.0;
    if (b.jobs) {
      let required = 0;
      let filled = 0;
      for (let role in b.jobs) {
        required += b.jobs[role] * count;
        const totalRoleJobs = jobsAvailable[role];
        const totalRolePop = popStructure[role];
        const fillRate = totalRoleJobs > 0 ? Math.min(1, totalRolePop / totalRoleJobs) : 0;
        filled += (b.jobs[role] * count * fillRate);
      }
      if (required > 0) staffingRatio = filled / required;
    }
    multiplier *= staffingRatio;

    if (decrees.find(d => d.id === 'forced_labor' && d.active) && (b.jobs?.slave || b.jobs?.serf)) {
      multiplier *= 1.2;
    }

    let canProduce = true;
    if (b.input) {
      for (let k in b.input) {
        if (res[k] < b.input[k] * count * multiplier) { canProduce = false; break; }
      }
      if (canProduce) {
        for (let k in b.input) {
          const amt = b.input[k] * count * multiplier;
          res[k] -= amt;
          rates[k] = (rates[k] || 0) - amt;
        }
      }
    }

    if (canProduce && b.output) {
      for (let k in b.output) {
        if (k === 'maxPop' || k === 'admin') continue;
        const amt = b.output[k] * count * multiplier;
        res[k] += amt;
        rates[k] = (rates[k] || 0) + amt;
      }
    }
  });

  let nextPopulation = population;
  if (res.food > population * 2 && population < totalMaxPop) {
    if (Math.random() > 0.8) nextPopulation = population + 1;
  }
  if (res.food <= 0) {
    res.food = 0;
    if (Math.random() > 0.9 && population > 2) {
      nextPopulation = population - 1;
      logs.push("饥荒导致人口减少！");
    }
  }

  Object.keys(res).forEach(k => {
    if (res[k] < 0) res[k] = 0;
  });

  return {
    resources: res,
    rates,
    popStructure,
    maxPop: totalMaxPop,
    adminCap: adminCapacity,
    adminStrain,
    population: nextPopulation,
    classApproval,
    logs,
  };
};
