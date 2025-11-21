import { BUILDINGS, STRATA, EPOCHS } from '../config/gameData';

const ROLE_PRIORITY = ['official', 'cleric', 'capitalist', 'landowner', 'knight', 'soldier', 'worker', 'serf', 'slave', 'peasant'];

export const simulateTick = ({ resources, buildings, population, decrees, gameSpeed, epoch }) => {
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
  const classInfluence = {};
  const classWealth = {};
  const activeBuffs = [];
  const activeDebuffs = [];

  // Calculate base approval, influence, and wealth for each class
  Object.keys(STRATA).forEach(key => {
    const count = popStructure[key] || 0;
    if (count === 0) return;
    const def = STRATA[key];
    
    if (def.admin > 0) currentAdminStrain += count * def.admin;
    taxIncome += count * def.tax * gameSpeed;
    
    // Base approval starts at 50
    let approval = 50;
    
    // Check resource needs satisfaction
    let needsSatisfied = true;
    if (def.needs) {
      for (let needRes in def.needs) {
        const required = def.needs[needRes] * count;
        const available = res[needRes] || 0;
        const satisfactionRate = available / Math.max(required, 1);
        
        if (satisfactionRate < 0.5) {
          approval -= 20;
          needsSatisfied = false;
        } else if (satisfactionRate < 1.0) {
          approval -= 10;
          needsSatisfied = false;
        } else if (satisfactionRate > 2.0) {
          approval += 10;
        }
      }
    }
    
    classApproval[key] = Math.max(0, Math.min(100, approval));
    
    // Calculate wealth (population * wealth weight)
    classWealth[key] = count * def.wealthWeight;
    
    // Calculate influence (base influence * population + wealth factor)
    const wealthFactor = classWealth[key] / Math.max(population, 1);
    classInfluence[key] = (def.influenceBase * count) + (wealthFactor * 2);
    
    // Apply buffs/debuffs based on approval
    if (def.buffs) {
      if (classApproval[key] >= 70 && needsSatisfied) {
        // Satisfied: apply positive buffs
        activeBuffs.push({
          class: key,
          ...def.buffs.satisfied
        });
      } else if (classApproval[key] < 40) {
        // Dissatisfied: apply negative debuffs
        activeDebuffs.push({
          class: key,
          ...def.buffs.dissatisfied
        });
      }
    }
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
  
  // Apply epoch bonuses to admin capacity
  let epochAdminBonus = 0;
  if (epoch > 0 && EPOCHS[epoch].bonuses.adminBonus) {
    epochAdminBonus = EPOCHS[epoch].bonuses.adminBonus;
  }
  
  // Apply class buffs/debuffs to admin capacity
  activeBuffs.forEach(buff => {
    if (buff.adminBonus) adminCapacity += buff.adminBonus;
  });
  activeDebuffs.forEach(debuff => {
    if (debuff.adminBonus) adminCapacity += debuff.adminBonus;
  });
  
  adminCapacity += epochAdminBonus;
  
  res.admin = Math.max(0, adminCapacity - adminStrain);
  let efficiency = res.admin < 0 ? 0.5 : 1.0;
  
  // Apply tax income modifiers from buffs/debuffs
  let taxModifier = 1.0;
  activeBuffs.forEach(buff => {
    if (buff.taxIncome) taxModifier += buff.taxIncome;
  });
  activeDebuffs.forEach(debuff => {
    if (debuff.taxIncome) taxModifier += debuff.taxIncome;
  });
  taxIncome *= taxModifier;

  const logs = [];
  const foodConsumption = population * 0.5 * gameSpeed;
  res.food -= foodConsumption;
  rates['food'] = (rates['food'] || 0) - foodConsumption;
  res.gold += taxIncome * efficiency;
  rates['gold'] = (rates['gold'] || 0) + (taxIncome * efficiency);

  // Calculate global production modifiers from class buffs/debuffs
  let productionModifier = 1.0;
  let industryModifier = 1.0;
  let stabilityModifier = 0;
  
  activeBuffs.forEach(buff => {
    if (buff.production) productionModifier += buff.production;
    if (buff.industryBonus) industryModifier += buff.industryBonus;
    if (buff.stability) stabilityModifier += buff.stability;
  });
  activeDebuffs.forEach(debuff => {
    if (debuff.production) productionModifier += debuff.production;
    if (debuff.industryBonus) industryModifier += debuff.industryBonus;
    if (debuff.stability) stabilityModifier += debuff.stability;
  });

  BUILDINGS.forEach(b => {
    const count = builds[b.id] || 0;
    if (count === 0) return;

    let multiplier = 1.0 * gameSpeed * efficiency;
    
    // Apply epoch bonuses
    const currentEpoch = EPOCHS[epoch];
    if (currentEpoch && currentEpoch.bonuses) {
      // Gathering bonus (farms, lumber camps, quarries, mines)
      if (b.cat === 'gather' && currentEpoch.bonuses.gatherBonus) {
        multiplier *= (1 + currentEpoch.bonuses.gatherBonus);
      }
      // Industry bonus (sawmill, brickworks, factory)
      if (b.cat === 'industry' && currentEpoch.bonuses.industryBonus) {
        multiplier *= (1 + currentEpoch.bonuses.industryBonus);
      }
    }
    
    // Apply class-based production modifiers
    if (b.cat === 'gather' || b.cat === 'civic') {
      multiplier *= productionModifier;
    }
    if (b.cat === 'industry') {
      multiplier *= industryModifier;
    }

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
        let amt = b.output[k] * count * multiplier;
        
        // Apply specific resource bonuses from epoch
        const currentEpoch = EPOCHS[epoch];
        if (currentEpoch && currentEpoch.bonuses) {
          if (k === 'science' && currentEpoch.bonuses.scienceBonus) {
            amt *= (1 + currentEpoch.bonuses.scienceBonus);
          }
          if (k === 'culture' && currentEpoch.bonuses.cultureBonus) {
            amt *= (1 + currentEpoch.bonuses.cultureBonus);
          }
        }
        
        // Apply class-based resource bonuses
        activeBuffs.forEach(buff => {
          if (k === 'science' && buff.scienceBonus) amt *= (1 + buff.scienceBonus);
          if (k === 'culture' && buff.cultureBonus) amt *= (1 + buff.cultureBonus);
        });
        activeDebuffs.forEach(debuff => {
          if (k === 'science' && debuff.scienceBonus) amt *= (1 + debuff.scienceBonus);
          if (k === 'culture' && debuff.cultureBonus) amt *= (1 + debuff.cultureBonus);
        });
        
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

  // Calculate total influence
  const totalInfluence = Object.values(classInfluence).reduce((sum, val) => sum + val, 0);
  const totalWealth = Object.values(classWealth).reduce((sum, val) => sum + val, 0);

  return {
    resources: res,
    rates,
    popStructure,
    maxPop: totalMaxPop,
    adminCap: adminCapacity,
    adminStrain,
    population: nextPopulation,
    classApproval,
    classInfluence,
    classWealth,
    totalInfluence,
    totalWealth,
    activeBuffs,
    activeDebuffs,
    stability: Math.max(0, Math.min(100, 50 + stabilityModifier * 100)),
    logs,
  };
};
