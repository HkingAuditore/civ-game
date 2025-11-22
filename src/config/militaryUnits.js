// 军事单位配置文件

// 兵种类型定义
export const UNIT_TYPES = {
  // 石器时代 (Epoch 0)
  militia: {
    id: 'militia',
    name: '民兵',
    desc: '由农民临时组成的武装力量，战斗力较弱但成本低廉。',
    epoch: 0,
    icon: 'Users',
    category: 'infantry',
    
    // 基础属性
    attack: 5,
    defense: 3,
    speed: 3,
    range: 1,
    
    // 成本
    recruitCost: { food: 20, wood: 10 },
    maintenanceCost: { food: 0.3, silver: 0.1 },
    trainingTime: 2, // 秒
    
    // 限制
    adminCost: 1,
    populationCost: 1,
    
    // 特殊能力
    abilities: ['快速征召'],
    
    // 克制关系 (对特定兵种的伤害加成)
    counters: {},
    weakAgainst: ['cavalry', 'archer']
  },
  
  slinger: {
    id: 'slinger',
    name: '投石兵',
    desc: '使用投石索的远程单位，对轻甲单位有效。',
    epoch: 0,
    icon: 'Target',
    category: 'archer',
    
    attack: 6,
    defense: 2,
    speed: 3,
    range: 3,
    
    recruitCost: { food: 30, wood: 15, stone: 5 },
    maintenanceCost: { food: 0.4, silver: 0.15 },
    trainingTime: 3,
    
    adminCost: 1.5,
    populationCost: 1,
    
    abilities: ['远程攻击'],
    
    counters: { infantry: 1.2 },
    weakAgainst: ['cavalry']
  },

  // 青铜时代 (Epoch 1)
  spearman: {
    id: 'spearman',
    name: '长矛兵',
    desc: '装备长矛的步兵，对骑兵有显著克制效果。',
    epoch: 1,
    icon: 'Swords',
    category: 'infantry',
    
    attack: 10,
    defense: 8,
    speed: 3,
    range: 1,
    
    recruitCost: { food: 50, wood: 30, iron: 10 },
    maintenanceCost: { food: 0.5, silver: 0.3 },
    trainingTime: 4,
    
    adminCost: 2,
    populationCost: 1,
    
    abilities: ['反骑兵'],
    
    counters: { cavalry: 1.8 },
    weakAgainst: ['archer']
  },

  archer: {
    id: 'archer',
    name: '弓箭手',
    desc: '装备弓箭的远程单位，克制步兵。',
    epoch: 1,
    icon: 'Target',
    category: 'archer',
    
    attack: 12,
    defense: 5,
    speed: 4,
    range: 4,
    
    recruitCost: { food: 60, wood: 40, silver: 20 },
    maintenanceCost: { food: 0.6, silver: 0.4 },
    trainingTime: 5,
    
    adminCost: 2.5,
    populationCost: 1,
    
    abilities: ['远程攻击', '高机动'],
    
    counters: { infantry: 1.5 },
    weakAgainst: ['cavalry']
  },

  light_cavalry: {
    id: 'light_cavalry',
    name: '轻骑兵',
    desc: '快速机动的骑兵单位，克制弓箭手。',
    epoch: 1,
    icon: 'Horse',
    category: 'cavalry',
    
    attack: 15,
    defense: 6,
    speed: 8,
    range: 1,
    
    recruitCost: { food: 100, silver: 50, iron: 20 },
    maintenanceCost: { food: 1.0, silver: 0.8 },
    trainingTime: 6,
    
    adminCost: 3,
    populationCost: 1,
    
    abilities: ['快速移动', '冲锋'],
    
    counters: { archer: 1.6 },
    weakAgainst: ['infantry']
  },

  // 封建时代 (Epoch 2)
  heavy_infantry: {
    id: 'heavy_infantry',
    name: '重装步兵',
    desc: '装备重甲的精锐步兵，防御力强。',
    epoch: 2,
    icon: 'Shield',
    category: 'infantry',
    
    attack: 18,
    defense: 15,
    speed: 2,
    range: 1,
    
    recruitCost: { food: 120, iron: 50, silver: 60 },
    maintenanceCost: { food: 0.8, silver: 0.6 },
    trainingTime: 8,
    
    adminCost: 3.5,
    populationCost: 1,
    
    abilities: ['重甲', '坚守'],
    
    counters: { cavalry: 1.4 },
    weakAgainst: ['archer']
  },

  crossbowman: {
    id: 'crossbowman',
    name: '弩兵',
    desc: '装备弩的远程单位，穿透力强。',
    epoch: 2,
    icon: 'Target',
    category: 'archer',
    
    attack: 20,
    defense: 8,
    speed: 3,
    range: 5,
    
    recruitCost: { food: 100, wood: 60, iron: 40, silver: 40 },
    maintenanceCost: { food: 0.7, silver: 0.5 },
    trainingTime: 7,
    
    adminCost: 3,
    populationCost: 1,
    
    abilities: ['远程攻击', '穿甲'],
    
    counters: { infantry: 1.6, cavalry: 1.2 },
    weakAgainst: []
  },

  knight: {
    id: 'knight',
    name: '骑士',
    desc: '装备重甲的精锐骑兵，战斗力强大。',
    epoch: 2,
    icon: 'Shield',
    category: 'cavalry',
    
    attack: 25,
    defense: 18,
    speed: 6,
    range: 1,
    
    recruitCost: { food: 200, iron: 80, silver: 120 },
    maintenanceCost: { food: 1.5, silver: 1.2 },
    trainingTime: 10,
    
    adminCost: 5,
    populationCost: 1,
    
    abilities: ['重甲', '冲锋', '贵族'],
    
    counters: { archer: 1.8, infantry: 1.3 },
    weakAgainst: ['infantry']
  },

  // 工业时代 (Epoch 3)
  musketeer: {
    id: 'musketeer',
    name: '火枪兵',
    desc: '装备火枪的步兵，对所有单位都有效。',
    epoch: 3,
    icon: 'Zap',
    category: 'infantry',
    
    attack: 30,
    defense: 12,
    speed: 3,
    range: 3,
    
    recruitCost: { food: 150, iron: 60, tools: 20, silver: 80 },
    maintenanceCost: { food: 1.0, silver: 0.8, tools: 0.1 },
    trainingTime: 9,
    
    adminCost: 4,
    populationCost: 1,
    
    abilities: ['火器', '齐射'],
    
    counters: { cavalry: 1.5, infantry: 1.3 },
    weakAgainst: []
  },

  cannon: {
    id: 'cannon',
    name: '火炮',
    desc: '强大的攻城武器，对建筑和密集部队有效。',
    epoch: 3,
    icon: 'Bomb',
    category: 'siege',
    
    attack: 50,
    defense: 10,
    speed: 1,
    range: 6,
    
    recruitCost: { food: 200, iron: 150, tools: 50, silver: 200 },
    maintenanceCost: { food: 1.5, silver: 1.5, tools: 0.3 },
    trainingTime: 15,
    
    adminCost: 8,
    populationCost: 3,
    
    abilities: ['攻城', '范围伤害'],
    
    counters: { infantry: 1.8, archer: 1.8 },
    weakAgainst: ['cavalry']
  },

  dragoon: {
    id: 'dragoon',
    name: '龙骑兵',
    desc: '装备火枪的骑兵，机动性和火力兼备。',
    epoch: 3,
    icon: 'Horse',
    category: 'cavalry',
    
    attack: 35,
    defense: 15,
    speed: 7,
    range: 2,
    
    recruitCost: { food: 250, iron: 80, tools: 30, silver: 150 },
    maintenanceCost: { food: 1.8, silver: 1.5, tools: 0.15 },
    trainingTime: 12,
    
    adminCost: 6,
    populationCost: 1,
    
    abilities: ['火器', '快速移动'],
    
    counters: { archer: 1.7, infantry: 1.4 },
    weakAgainst: []
  },

  // 信息时代 (Epoch 4)
  infantry_modern: {
    id: 'infantry_modern',
    name: '现代步兵',
    desc: '装备自动武器的现代步兵。',
    epoch: 4,
    icon: 'Zap',
    category: 'infantry',
    
    attack: 45,
    defense: 25,
    speed: 4,
    range: 4,
    
    recruitCost: { food: 300, iron: 100, tools: 50, silver: 200, science: 50 },
    maintenanceCost: { food: 1.5, silver: 1.2, tools: 0.2 },
    trainingTime: 10,
    
    adminCost: 5,
    populationCost: 1,
    
    abilities: ['现代武器', '战术训练'],
    
    counters: { infantry: 1.4, archer: 1.5 },
    weakAgainst: []
  },

  tank: {
    id: 'tank',
    name: '坦克',
    desc: '装甲战车，强大的攻击和防御。',
    epoch: 4,
    icon: 'Truck',
    category: 'cavalry',
    
    attack: 60,
    defense: 40,
    speed: 5,
    range: 3,
    
    recruitCost: { food: 500, iron: 300, tools: 150, silver: 400, science: 100 },
    maintenanceCost: { food: 2.0, silver: 2.5, tools: 0.5 },
    trainingTime: 20,
    
    adminCost: 10,
    populationCost: 3,
    
    abilities: ['重甲', '机动', '现代武器'],
    
    counters: { infantry: 2.0, cavalry: 1.5, archer: 1.8 },
    weakAgainst: []
  },

  artillery: {
    id: 'artillery',
    name: '现代火炮',
    desc: '远程火力支援单位。',
    epoch: 4,
    icon: 'Bomb',
    category: 'siege',
    
    attack: 80,
    defense: 15,
    speed: 2,
    range: 8,
    
    recruitCost: { food: 400, iron: 250, tools: 100, silver: 350, science: 80 },
    maintenanceCost: { food: 2.5, silver: 2.0, tools: 0.4 },
    trainingTime: 18,
    
    adminCost: 12,
    populationCost: 4,
    
    abilities: ['远程攻击', '范围伤害', '精确打击'],
    
    counters: { infantry: 2.2, archer: 2.0, siege: 1.5 },
    weakAgainst: ['cavalry']
  }
};

// 兵种类别定义
export const UNIT_CATEGORIES = {
  infantry: { name: '步兵', icon: 'Swords', color: 'text-red-400' },
  archer: { name: '弓箭手', icon: 'Target', color: 'text-green-400' },
  cavalry: { name: '骑兵', icon: 'Horse', color: 'text-blue-400' },
  siege: { name: '攻城', icon: 'Bomb', color: 'text-orange-400' }
};

export const calculateArmyFoodNeed = (army = {}) => {
  let total = 0;
  Object.entries(army).forEach(([unitId, count]) => {
    if (count <= 0) return;
    const unit = UNIT_TYPES[unitId];
    if (!unit) return;
    const foodNeed = unit.maintenanceCost?.food || 0;
    total += foodNeed * count;
  });
  return total;
};

// 战斗计算函数
export const calculateBattlePower = (army, epoch, militaryBuffs = 0) => {
  let totalPower = 0;
  
  Object.entries(army).forEach(([unitId, count]) => {
    if (count <= 0) return;
    
    const unit = UNIT_TYPES[unitId];
    if (!unit) return;
    
    // 基础战斗力 = (攻击力 + 防御力) * 数量
    let unitPower = (unit.attack + unit.defense) * count;
    
    // 时代加成：高时代对低时代有压制效果
    const epochDiff = epoch - unit.epoch;
    if (epochDiff > 0) {
      unitPower *= (1 + epochDiff * 0.1); // 每高一个时代+10%
    }
    
    totalPower += unitPower;
  });
  
  // 应用军事buff
  totalPower *= (1 + militaryBuffs);
  
  return totalPower;
};

// 计算兵种克制效果
export const calculateCounterBonus = (attackerArmy, defenderArmy) => {
  let bonusMultiplier = 1.0;
  let counterCount = 0;
  
  Object.entries(attackerArmy).forEach(([attackerId, attackerCount]) => {
    if (attackerCount <= 0) return;
    
    const attackerUnit = UNIT_TYPES[attackerId];
    if (!attackerUnit) return;
    
    Object.entries(defenderArmy).forEach(([defenderId, defenderCount]) => {
      if (defenderCount <= 0) return;
      
      const defenderUnit = UNIT_TYPES[defenderId];
      if (!defenderUnit) return;
      
      // 检查类别克制
      if (attackerUnit.counters[defenderUnit.category]) {
        const counterBonus = attackerUnit.counters[defenderUnit.category];
        const weight = (attackerCount * defenderCount) / 100; // 权重
        bonusMultiplier += (counterBonus - 1) * weight;
        counterCount++;
      }
    });
  });
  
  return { multiplier: bonusMultiplier, counterCount };
};

// 完整战斗模拟
export const simulateBattle = (attackerData, defenderData) => {
  const { army: attackerArmy, epoch: attackerEpoch, militaryBuffs: attackerBuffs = 0 } = attackerData;
  const { army: defenderArmy, epoch: defenderEpoch, militaryBuffs: defenderBuffs = 0, wealth: defenderWealth = 1000 } = defenderData;
  
  // 计算基础战斗力
  let attackerPower = calculateBattlePower(attackerArmy, attackerEpoch, attackerBuffs);
  let defenderPower = calculateBattlePower(defenderArmy, defenderEpoch, defenderBuffs);
  
  // 计算克制加成
  const attackerCounter = calculateCounterBonus(attackerArmy, defenderArmy);
  const defenderCounter = calculateCounterBonus(defenderArmy, attackerArmy);
  
  attackerPower *= attackerCounter.multiplier;
  defenderPower *= defenderCounter.multiplier;
  
  // 防御方有地形优势
  defenderPower *= 1.2;
  
  // 添加随机因素 (±15%)
  const attackerRandom = 0.85 + Math.random() * 0.3;
  const defenderRandom = 0.85 + Math.random() * 0.3;
  
  attackerPower *= attackerRandom;
  defenderPower *= defenderRandom;
  
  // 计算战斗结果
  const totalPower = attackerPower + defenderPower;
  const attackerAdvantage = attackerPower / totalPower;
  const defenderAdvantage = defenderPower / totalPower;
  
  const victory = attackerAdvantage > 0.5;
  const decisive = Math.abs(attackerAdvantage - 0.5) > 0.3; // 压倒性胜利
  
  // 计算损失
  const attackerLossRate = victory ? (0.1 + defenderAdvantage * 0.3) : (0.3 + defenderAdvantage * 0.5);
  const defenderLossRate = victory ? (0.4 + attackerAdvantage * 0.6) : (0.2 + attackerAdvantage * 0.3);
  
  const attackerLosses = {};
  const defenderLosses = {};
  
  Object.entries(attackerArmy).forEach(([unitId, count]) => {
    attackerLosses[unitId] = Math.floor(count * attackerLossRate);
  });
  
  Object.entries(defenderArmy).forEach(([unitId, count]) => {
    defenderLosses[unitId] = Math.floor(count * defenderLossRate);
  });
  
  // 计算掠夺资源
  let loot = {};
  if (victory) {
    const lootMultiplier = decisive ? 0.3 : 0.15;
    loot = {
      food: Math.floor(defenderWealth * lootMultiplier * 0.4),
      wood: Math.floor(defenderWealth * lootMultiplier * 0.2),
      silver: Math.floor(defenderWealth * lootMultiplier * 0.3),
      iron: Math.floor(defenderWealth * lootMultiplier * 0.1)
    };
  }
  
  return {
    victory,
    decisive,
    attackerPower: Math.floor(attackerPower),
    defenderPower: Math.floor(defenderPower),
    attackerAdvantage: (attackerAdvantage * 100).toFixed(1),
    defenderAdvantage: (defenderAdvantage * 100).toFixed(1),
    attackerLosses,
    defenderLosses,
    attackerCounter: attackerCounter.counterCount,
    defenderCounter: defenderCounter.counterCount,
    loot,
    battleReport: generateBattleReport({
      victory,
      decisive,
      attackerPower,
      defenderPower,
      attackerCounter: attackerCounter.counterCount,
      defenderCounter: defenderCounter.counterCount,
      attackerLosses,
      defenderLosses,
      loot
    })
  };
};

// 生成战斗报告
const generateBattleReport = (data) => {
  const { victory, decisive, attackerPower, defenderPower, attackerCounter, defenderCounter, attackerLosses, defenderLosses, loot } = data;
  
  let report = [];
  
  if (victory) {
    if (decisive) {
      report.push('🎉 压倒性胜利！敌军溃不成军！');
    } else {
      report.push('✓ 艰难的胜利，我军成功击退敌人。');
    }
  } else {
    if (decisive) {
      report.push('💀 惨败！我军遭受重创！');
    } else {
      report.push('✗ 战败，我军被迫撤退。');
    }
  }
  
  report.push(`战斗力对比：我方 ${Math.floor(attackerPower)} vs 敌方 ${Math.floor(defenderPower)}`);
  
  if (attackerCounter > 0) {
    report.push(`✓ 我方兵种克制生效 ${attackerCounter} 次`);
  }
  if (defenderCounter > 0) {
    report.push(`✗ 敌方兵种克制生效 ${defenderCounter} 次`);
  }
  
  const totalAttackerLoss = Object.values(attackerLosses).reduce((sum, val) => sum + val, 0);
  const totalDefenderLoss = Object.values(defenderLosses).reduce((sum, val) => sum + val, 0);
  
  report.push(`我方损失：${totalAttackerLoss} 人`);
  report.push(`敌方损失：${totalDefenderLoss} 人`);
  
  if (victory && loot) {
    const lootItems = Object.entries(loot).filter(([k, v]) => v > 0).map(([k, v]) => `${k} ${v}`).join(', ');
    if (lootItems) {
      report.push(`掠夺资源：${lootItems}`);
    }
  }
  
  return report;
};

// 计算军队维护成本
export const calculateArmyMaintenance = (army) => {
  const maintenance = {};
  
  Object.entries(army).forEach(([unitId, count]) => {
    if (count <= 0) return;
    
    const unit = UNIT_TYPES[unitId];
    if (!unit) return;
    
    Object.entries(unit.maintenanceCost).forEach(([resource, cost]) => {
      maintenance[resource] = (maintenance[resource] || 0) + (cost * count);
    });
  });
  
  return maintenance;
};

// 计算军队行政成本
export const calculateArmyAdminCost = (army) => {
  let totalAdminCost = 0;
  
  Object.entries(army).forEach(([unitId, count]) => {
    if (count <= 0) return;
    
    const unit = UNIT_TYPES[unitId];
    if (!unit) return;
    
    totalAdminCost += unit.adminCost * count;
  });
  
  return totalAdminCost;
};

// 计算军队人口占用
export const calculateArmyPopulation = (army) => {
  let totalPopulation = 0;
  
  Object.entries(army).forEach(([unitId, count]) => {
    if (count <= 0) return;
    
    const unit = UNIT_TYPES[unitId];
    if (!unit) return;
    
    totalPopulation += unit.populationCost * count;
  });
  
  return totalPopulation;
};
