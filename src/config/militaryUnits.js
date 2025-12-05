// 军事单位配置文件

// 兵种类型定义
export const UNIT_TYPES = {
  // ============ 石器时代 (Epoch 0) ============
  militia: {
    id: 'militia',
    name: '民兵',
    desc: '由农民临时组成的武装力量，战斗力较弱但成本低廉。',
    epoch: 0,
    icon: 'Users',
    category: 'infantry',
    
    // 基础属性
    attack: 6,
    defense: 4,
    speed: 3,
    range: 1,
    
    // 成本
    recruitCost: { food: 25, wood: 12 },
    maintenanceCost: { food: 0.35, silver: 0.12 },
    trainingTime: 2, // 秒
    
    // 限制
    populationCost: 1,
    
    // 特殊能力
    abilities: ['快速征召'],
    
    // 克制关系 (对特定兵种的伤害加成)
    counters: { siege: 1.2 },  // 民兵可骚扰攻城器械
    weakAgainst: ['cavalry', 'archer'],
    
    // 时代淘汰设置：超过该时代差距后兵种效率大幅下降
    obsoleteAfterEpochs: 2  // 2个时代后过时
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
    
    populationCost: 1,
    
    abilities: ['远程攻击'],
    
    counters: { infantry: 1.3 },  // 对步兵有效
    weakAgainst: ['cavalry'],
    
    obsoleteAfterEpochs: 2
  },

  // ============ 青铜时代 (Epoch 1) ============
  spearman: {
    id: 'spearman',
    name: '长矛兵',
    desc: '装备青铜长矛的步兵，对骑兵有显著克制效果。',
    epoch: 1,
    icon: 'Swords',
    category: 'infantry',
    
    attack: 12,
    defense: 9,
    speed: 3,
    range: 1,
    
    recruitCost: { food: 55, wood: 35, copper: 12 },
    maintenanceCost: { food: 0.55, silver: 0.35 },
    trainingTime: 4,
    
    populationCost: 1,
    
    abilities: ['反骑兵'],
    
    counters: { cavalry: 1.8 },  // 强克骑兵
    weakAgainst: ['archer'],
    
    obsoleteAfterEpochs: 2
  },

  archer: {
    id: 'archer',
    name: '弓箭手',
    desc: '装备复合弓的远程单位，克制步兵。',
    epoch: 1,
    icon: 'Target',
    category: 'archer',
    
    attack: 14,
    defense: 6,
    speed: 4,
    range: 4,
    
    recruitCost: { food: 65, wood: 45, silver: 25 },
    maintenanceCost: { food: 0.65, silver: 0.45 },
    trainingTime: 5,
    
    populationCost: 1,
    
    abilities: ['远程攻击', '高机动'],
    
    counters: { infantry: 1.5, siege: 1.3 },  // 克制步兵和攻城器械
    weakAgainst: ['cavalry'],
    
    obsoleteAfterEpochs: 2
  },

  chariot: {
    id: 'chariot',
    name: '战车',
    desc: '青铜时代的机动战力，由马匹牵引的战车。',
    epoch: 1,
    icon: 'Truck',
    category: 'cavalry',
    
    attack: 15,
    defense: 8,
    speed: 6,
    range: 1,
    
    recruitCost: { food: 100, wood: 60, copper: 30, silver: 40 },
    maintenanceCost: { food: 1.0, silver: 0.7 },
    trainingTime: 6,
    
    populationCost: 1,
    
    abilities: ['冲锋', '机动'],
    
    counters: { archer: 1.5 },
    weakAgainst: ['infantry']
  },

  // ============ 古典时代 (Epoch 2) ============
  hoplite: {
    id: 'hoplite',
    name: '重装步兵',
    desc: '装备圆盾和长矛的古典精锐步兵，方阵作战威力强大。',
    epoch: 2,
    icon: 'Shield',
    category: 'infantry',
    
    attack: 16,
    defense: 14,
    speed: 2,
    range: 1,
    
    recruitCost: { food: 100, copper: 40, iron: 20, silver: 50 },
    maintenanceCost: { food: 0.75, silver: 0.55 },
    trainingTime: 6,
    
    populationCost: 1,
    
    abilities: ['方阵', '坚守'],
    
    counters: { cavalry: 1.6, infantry: 1.2 },
    weakAgainst: ['archer']
  },

  composite_archer: {
    id: 'composite_archer',
    name: '复合弓手',
    desc: '使用复合弓的精锐射手，穿透力更强。',
    epoch: 2,
    icon: 'Target',
    category: 'archer',
    
    attack: 18,
    defense: 7,
    speed: 4,
    range: 5,
    
    recruitCost: { food: 85, wood: 50, copper: 25, silver: 45 },
    maintenanceCost: { food: 0.7, silver: 0.5 },
    trainingTime: 6,
    
    populationCost: 1,
    
    abilities: ['远程攻击', '穿甲'],
    
    counters: { infantry: 1.6 },
    weakAgainst: ['cavalry']
  },

  light_cavalry: {
    id: 'light_cavalry',
    name: '轻骑兵',
    desc: '快速机动的骑兵单位，克制弓箭手。',
    epoch: 2,
    icon: 'Horse',
    category: 'cavalry',
    
    attack: 18,
    defense: 8,
    speed: 8,
    range: 1,
    
    recruitCost: { food: 120, silver: 60, iron: 25 },
    maintenanceCost: { food: 1.0, silver: 0.8 },
    trainingTime: 7,
    
    populationCost: 1,
    
    abilities: ['快速移动', '冲锋'],
    
    counters: { archer: 1.7 },
    weakAgainst: ['infantry']
  },

  battering_ram: {
    id: 'battering_ram',
    name: '攻城槌',
    desc: '古典时代的攻城器械，对建筑极为有效。',
    epoch: 2,
    icon: 'Bomb',
    category: 'siege',
    
    attack: 30,
    defense: 15,
    speed: 1,
    range: 1,
    
    recruitCost: { food: 150, wood: 200, iron: 50, silver: 80 },
    maintenanceCost: { food: 1.2, silver: 0.8 },
    trainingTime: 10,
    
    populationCost: 2,
    
    abilities: ['攻城'],
    
    counters: {},
    weakAgainst: ['cavalry', 'archer']
  },

  // ============ 封建时代 (Epoch 3) ============
  heavy_infantry: {
    id: 'heavy_infantry',
    name: '重甲步兵',
    desc: '装备锁子甲的精锐步兵，防御力强。',
    epoch: 3,
    icon: 'Shield',
    category: 'infantry',
    
    attack: 20,
    defense: 18,
    speed: 2,
    range: 1,
    
    recruitCost: { food: 140, iron: 60, silver: 80 },
    maintenanceCost: { food: 0.9, silver: 0.7 },
    trainingTime: 8,
    
    populationCost: 1,
    
    abilities: ['重甲', '坚守'],
    
    counters: { cavalry: 1.5 },
    weakAgainst: ['archer']
  },

  crossbowman: {
    id: 'crossbowman',
    name: '弩兵',
    desc: '装备十字弩的远程单位，穿透力强。',
    epoch: 3,
    icon: 'Target',
    category: 'archer',
    
    attack: 22,
    defense: 9,
    speed: 3,
    range: 5,
    
    recruitCost: { food: 110, wood: 70, iron: 45, silver: 55 },
    maintenanceCost: { food: 0.8, silver: 0.6 },
    trainingTime: 7,
    
    populationCost: 1,
    
    abilities: ['远程攻击', '穿甲'],
    
    counters: { infantry: 1.6, cavalry: 1.3 },
    weakAgainst: []
  },

  knight: {
    id: 'knight',
    name: '骑士',
    desc: '装备板甲的精锐骑兵，封建时代的主力。',
    epoch: 3,
    icon: 'Shield',
    category: 'cavalry',
    
    attack: 28,
    defense: 22,
    speed: 6,
    range: 1,
    
    recruitCost: { food: 250, iron: 100, silver: 160 },
    maintenanceCost: { food: 1.6, silver: 1.3 },
    trainingTime: 10,
    
    populationCost: 1,
    
    abilities: ['重甲', '冲锋', '贵族'],
    
    counters: { archer: 1.8, infantry: 1.3 },
    weakAgainst: ['infantry']
  },

  trebuchet: {
    id: 'trebuchet',
    name: '投石机',
    desc: '中世纪的重型攻城器械，可投掷巨石。',
    epoch: 3,
    icon: 'Bomb',
    category: 'siege',
    
    attack: 45,
    defense: 8,
    speed: 1,
    range: 6,
    
    recruitCost: { food: 200, wood: 250, iron: 80, silver: 150 },
    maintenanceCost: { food: 1.5, silver: 1.2 },
    trainingTime: 12,
    
    populationCost: 3,
    
    abilities: ['攻城', '范围伤害'],
    
    counters: { infantry: 1.5 },
    weakAgainst: ['cavalry']
  },

  // ============ 探索时代 (Epoch 4) ============
  pikeman: {
    id: 'pikeman',
    name: '长枪兵',
    desc: '装备长枪的步兵，方阵抵御骑兵冲锋。',
    epoch: 4,
    icon: 'Swords',
    category: 'infantry',
    
    attack: 22,
    defense: 20,
    speed: 2,
    range: 2,
    
    recruitCost: { food: 160, wood: 60, iron: 70, silver: 90 },
    maintenanceCost: { food: 1.0, silver: 0.8 },
    trainingTime: 8,
    
    populationCost: 1,
    
    abilities: ['反骑兵', '方阵'],
    
    counters: { cavalry: 2.0 },
    weakAgainst: ['archer']
  },

  arquebus: {
    id: 'arquebus',
    name: '火绳枪手',
    desc: '早期火器部队，虽然装填慢但威力巨大。',
    epoch: 4,
    icon: 'Zap',
    category: 'archer',
    
    attack: 28,
    defense: 8,
    speed: 2,
    range: 4,
    
    recruitCost: { food: 140, iron: 60, tools: 30, silver: 100 },
    maintenanceCost: { food: 0.9, silver: 0.8, tools: 0.1 },
    trainingTime: 9,
    
    populationCost: 1,
    
    abilities: ['火器', '穿甲'],
    
    counters: { infantry: 1.5, cavalry: 1.4 },
    weakAgainst: ['cavalry']
  },

  cuirassier: {
    id: 'cuirassier',
    name: '胸甲骑兵',
    desc: '装备胸甲的重装骑兵，探索时代的铁骑。',
    epoch: 4,
    icon: 'Horse',
    category: 'cavalry',
    
    attack: 32,
    defense: 24,
    speed: 6,
    range: 1,
    
    recruitCost: { food: 300, iron: 120, silver: 200 },
    maintenanceCost: { food: 1.8, silver: 1.5 },
    trainingTime: 11,
    
    populationCost: 1,
    
    abilities: ['重甲', '冲锋'],
    
    counters: { archer: 1.9, infantry: 1.4 },
    weakAgainst: ['infantry']
  },

  bombard: {
    id: 'bombard',
    name: '射石炮',
    desc: '早期火炮，可攻破城墙。',
    epoch: 4,
    icon: 'Bomb',
    category: 'siege',
    
    attack: 55,
    defense: 10,
    speed: 1,
    range: 6,
    
    recruitCost: { food: 250, iron: 150, tools: 60, silver: 200 },
    maintenanceCost: { food: 1.8, silver: 1.5, tools: 0.2 },
    trainingTime: 14,
    
    populationCost: 3,
    
    abilities: ['攻城', '范围伤害', '火器'],
    
    counters: { infantry: 1.7 },
    weakAgainst: ['cavalry']
  },

  // ============ 启蒙时代 (Epoch 5) ============
  musketeer: {
    id: 'musketeer',
    name: '火枪兵',
    desc: '装备滑膛枪的步兵，线列战术的核心。',
    epoch: 5,
    icon: 'Zap',
    category: 'infantry',
    
    attack: 30,
    defense: 14,
    speed: 3,
    range: 3,
    
    recruitCost: { food: 180, iron: 70, tools: 40, silver: 110 },
    maintenanceCost: { food: 1.1, silver: 1.0, tools: 0.15 },
    trainingTime: 9,
    
    populationCost: 1,
    
    abilities: ['火器', '齐射'],
    
    counters: { cavalry: 1.6, infantry: 1.3 },
    weakAgainst: []
  },

  rifleman: {
    id: 'rifleman',
    name: '线膛枪手',
    desc: '装备线膛枪的精确射手，射程更远。',
    epoch: 5,
    icon: 'Target',
    category: 'archer',
    
    attack: 35,
    defense: 10,
    speed: 3,
    range: 5,
    
    recruitCost: { food: 200, iron: 80, tools: 50, silver: 130 },
    maintenanceCost: { food: 1.2, silver: 1.1, tools: 0.2 },
    trainingTime: 10,
    
    populationCost: 1,
    
    abilities: ['火器', '精确射击', '穿甲'],
    
    counters: { infantry: 1.7, cavalry: 1.5 },
    weakAgainst: []
  },

  dragoon: {
    id: 'dragoon',
    name: '龙骑兵',
    desc: '骑马的火枪兵，机动性和火力兼备。',
    epoch: 5,
    icon: 'Horse',
    category: 'cavalry',
    
    attack: 35,
    defense: 18,
    speed: 7,
    range: 2,
    
    recruitCost: { food: 280, iron: 90, tools: 45, silver: 180 },
    maintenanceCost: { food: 1.8, silver: 1.5, tools: 0.18 },
    trainingTime: 12,
    
    populationCost: 1,
    
    abilities: ['火器', '快速移动'],
    
    counters: { archer: 1.8, infantry: 1.4 },
    weakAgainst: []
  },

  cannon: {
    id: 'cannon',
    name: '野战炮',
    desc: '启蒙时代的标准火炮，可用于攻城和野战。',
    epoch: 5,
    icon: 'Bomb',
    category: 'siege',
    
    attack: 60,
    defense: 12,
    speed: 2,
    range: 7,
    
    recruitCost: { food: 300, iron: 180, tools: 80, silver: 250 },
    maintenanceCost: { food: 2.0, silver: 1.8, tools: 0.3 },
    trainingTime: 15,
    
    populationCost: 3,
    
    abilities: ['攻城', '范围伤害', '火器'],
    
    counters: { infantry: 1.9, archer: 1.8 },
    weakAgainst: ['cavalry']
  },

  // ============ 工业时代 (Epoch 6) ============
  line_infantry: {
    id: 'line_infantry',
    name: '线列步兵',
    desc: '工业化训练的步兵，装备后装步枪。',
    epoch: 6,
    icon: 'Zap',
    category: 'infantry',
    
    attack: 40,
    defense: 20,
    speed: 3,
    range: 4,
    
    recruitCost: { food: 250, iron: 100, tools: 60, silver: 160 },
    maintenanceCost: { food: 1.4, silver: 1.3, tools: 0.25 },
    trainingTime: 10,
    
    populationCost: 1,
    
    abilities: ['火器', '齐射', '战术训练'],
    
    counters: { infantry: 1.5, cavalry: 1.6 },
    weakAgainst: []
  },

  gatling: {
    id: 'gatling',
    name: '加特林机枪组',
    desc: '早期机枪，火力密集，克制密集阵型。',
    epoch: 6,
    icon: 'Zap',
    category: 'archer',
    
    attack: 50,
    defense: 12,
    speed: 2,
    range: 5,
    
    recruitCost: { food: 300, iron: 150, tools: 100, silver: 250 },
    maintenanceCost: { food: 1.6, silver: 1.8, tools: 0.4 },
    trainingTime: 12,
    
    populationCost: 2,
    
    abilities: ['火器', '压制火力', '范围伤害'],
    
    counters: { infantry: 2.0, cavalry: 1.8 },
    weakAgainst: ['siege']
  },

  lancer: {
    id: 'lancer',
    name: '枪骑兵',
    desc: '工业时代的精锐骑兵，适合侦察和追击。',
    epoch: 6,
    icon: 'Horse',
    category: 'cavalry',
    
    attack: 38,
    defense: 20,
    speed: 8,
    range: 1,
    
    recruitCost: { food: 320, iron: 100, tools: 50, silver: 200 },
    maintenanceCost: { food: 2.0, silver: 1.6, tools: 0.2 },
    trainingTime: 11,
    
    populationCost: 1,
    
    abilities: ['冲锋', '快速移动', '侦察'],
    
    counters: { archer: 1.9 },
    weakAgainst: ['infantry']
  },

  artillery: {
    id: 'artillery',
    name: '重型火炮',
    desc: '工业化生产的重型火炮，威力巨大。',
    epoch: 6,
    icon: 'Bomb',
    category: 'siege',
    
    attack: 80,
    defense: 15,
    speed: 1,
    range: 8,
    
    recruitCost: { food: 400, iron: 250, tools: 120, silver: 350 },
    maintenanceCost: { food: 2.5, silver: 2.2, tools: 0.5 },
    trainingTime: 18,
    
    populationCost: 4,
    
    abilities: ['攻城', '范围伤害', '精确打击'],
    
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
  
  // 计算掠夺资源（按比例计算，考虑敌方财富）
  let loot = {};
  if (victory) {
    // Base loot multiplier depends on victory type
    const baseLootMultiplier = decisive ? 0.08 : 0.04; // 8% or 4% of enemy wealth
    const wealthBasedLoot = defenderWealth * baseLootMultiplier;
    
    // Diversified loot based on enemy wealth with proportional scaling
    // The formula ensures loot scales with game progress while remaining meaningful
    loot = {
      food: Math.floor(wealthBasedLoot * 0.25),    // 25% of loot value
      wood: Math.floor(wealthBasedLoot * 0.12),    // 12% of loot value
      stone: Math.floor(wealthBasedLoot * 0.08),   // 8% of loot value
      silver: Math.floor(wealthBasedLoot * 0.30),  // 30% of loot value
      iron: Math.floor(wealthBasedLoot * 0.10),    // 10% of loot value
      copper: Math.floor(wealthBasedLoot * 0.05),  // 5% of loot value
      cloth: Math.floor(wealthBasedLoot * 0.05),   // 5% of loot value
      tools: Math.floor(wealthBasedLoot * 0.05),   // 5% of loot value
    };
    
    // Remove zero or negative values
    Object.keys(loot).forEach(key => {
      if (loot[key] <= 0) delete loot[key];
    });
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

// 计算军队所需军事容量（每个单位占用1点容量）
export const calculateArmyCapacityNeed = (army) => {
  let totalCapacity = 0;
  
  Object.entries(army).forEach(([unitId, count]) => {
    if (count <= 0) return;
    
    const unit = UNIT_TYPES[unitId];
    if (!unit) return;
    
    // 每个单位占用1点军事容量
    totalCapacity += count;
  });
  
  return totalCapacity;
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
