// 军事行动配置
// 定义可选择的固定军事目标

/**
 * 根据时代获取合适的兵种组合
 * @param {number} epoch - 时代等级
 * @param {string} actionType - 行动类型 (raid/assault/siege)
 * @returns {Array} 兵种配置数组
 */
export const getEnemyUnitsForEpoch = (epoch, actionType) => {
  // 根据时代定义兵种池
  const epochUnits = {
    0: { // 石器时代
      light: ['militia', 'slinger'],
      medium: ['militia', 'slinger'],
      heavy: ['militia', 'slinger'],
    },
    1: { // 青铜时代
      light: ['militia', 'slinger', 'spearman'],
      medium: ['spearman', 'archer', 'light_cavalry'],
      heavy: ['spearman', 'archer', 'light_cavalry', 'swordsman'],
    },
    2: { // 古典时代
      light: ['spearman', 'archer', 'light_cavalry'],
      medium: ['heavy_infantry', 'crossbowman', 'knight'],
      heavy: ['heavy_infantry', 'crossbowman', 'knight', 'swordsman'],
    },
    3: { // 封建时代
      light: ['heavy_infantry', 'crossbowman', 'knight'],
      medium: ['heavy_infantry', 'crossbowman', 'knight'],
      heavy: ['heavy_infantry', 'crossbowman', 'knight'],
    },
    4: { // 工业时代
      light: ['musketeer', 'dragoon'],
      medium: ['musketeer', 'dragoon', 'cannon'],
      heavy: ['musketeer', 'dragoon', 'cannon'],
    },
    5: { // 现代
      light: ['rifleman', 'modern_infantry'],
      medium: ['rifleman', 'modern_infantry', 'tank'],
      heavy: ['rifleman', 'modern_infantry', 'tank', 'artillery'],
    },
    6: { // 信息时代
      light: ['modern_infantry', 'tank'],
      medium: ['modern_infantry', 'tank', 'modern_artillery'],
      heavy: ['modern_infantry', 'tank', 'modern_artillery'],
    },
  };

  const units = epochUnits[Math.min(epoch, 6)] || epochUnits[0];
  return units[actionType] || units.medium;
};

/**
 * Calculate proportional loot based on player and enemy resources
 * @param {Object} playerResources - Player's current resources
 * @param {Object} enemyNation - Enemy nation object with wealth
 * @param {Object} lootConfig - Loot configuration with resource percentages
 * @returns {Object} Calculated loot amounts
 */
export const calculateProportionalLoot = (playerResources, enemyNation, lootConfig) => {
  const enemyWealth = enemyNation?.wealth || 500;
  const loot = {};
  
  Object.entries(lootConfig).forEach(([resource, config]) => {
    const playerAmount = playerResources?.[resource] || 0;
    
    // Base amount from enemy wealth
    const enemyBaseLoot = Math.floor(enemyWealth * config.enemyPercent);
    
    // Scale based on player's own resources (late game scaling)
    // The more resources you have, the more you can capture and transport
    const playerScaledLoot = Math.floor(playerAmount * config.playerPercent);
    
    // Final loot is the minimum of enemy-based and player-scaled, but at least the base amount
    const baseMin = config.baseMin || 10;
    const finalLoot = Math.max(baseMin, Math.min(enemyBaseLoot, Math.max(enemyBaseLoot * 0.5, playerScaledLoot)));
    
    if (finalLoot > 0) {
      loot[resource] = Math.floor(finalLoot);
    }
  });
  
  return loot;
};

export const MILITARY_ACTIONS = [
  {
    id: 'raid',
    name: '边境掠夺',
    desc: '小股兵力快速突袭敌方补给线，目标是劫掠资源。',
    difficulty: '易',
    difficultyLevel: 1,
    unitScale: 'light',
    baseUnitCount: { min: 6, max: 10 },
    enemyUnits: [],
    cooldownDays: 5,
    // Proportional loot config: enemyPercent = % of enemy wealth, playerPercent = % of player resources
    // 边境掠夺主要获取：基础资源、农产品、轻便货物
    lootConfig: {
      // 基础资源 - 容易掠夺
      food: { enemyPercent: 0.035, playerPercent: 0.025, baseMin: 50 },
      wood: { enemyPercent: 0.025, playerPercent: 0.020, baseMin: 30 },
      stone: { enemyPercent: 0.015, playerPercent: 0.012, baseMin: 15 },
      cloth: { enemyPercent: 0.020, playerPercent: 0.015, baseMin: 20 },
      // 货币和贵金属 - 掠夺者的主要目标
      silver: { enemyPercent: 0.045, playerPercent: 0.030, baseMin: 80 },
      copper: { enemyPercent: 0.015, playerPercent: 0.010, baseMin: 10 },
      // 加工品 - 少量
      plank: { enemyPercent: 0.010, playerPercent: 0.008, baseMin: 8 },
      dye: { enemyPercent: 0.012, playerPercent: 0.008, baseMin: 6 },
      // 食品和饮料
      ale: { enemyPercent: 0.018, playerPercent: 0.012, baseMin: 10 },
      delicacies: { enemyPercent: 0.010, playerPercent: 0.006, baseMin: 5 },
      // 贸易品 - 如果有的话
      spice: { enemyPercent: 0.012, playerPercent: 0.008, baseMin: 5 },
      coffee: { enemyPercent: 0.010, playerPercent: 0.006, baseMin: 4 },
    },
    // Legacy loot for backward compatibility (used as fallback)
    loot: {
      food: [40, 120],
      wood: [20, 60],
      silver: [60, 140],
    },
    influence: { win: 5, lose: -4 },
    winScore: 8,
    loseScore: 6,
    wealthDamage: 15,
  },
  {
    id: 'assault',
    name: '正面攻势',
    desc: '投入主力与敌军正面冲突，寻求瓦解其主力部队。',
    difficulty: '中',
    difficultyLevel: 2,
    unitScale: 'medium',
    baseUnitCount: { min: 12, max: 18 },
    enemyUnits: [],
    cooldownDays: 8,
    requiresTech: 'bronze_working', // 需要青铜冶炼 - 正规军队需要金属武器
    // 正面攻势主要获取：军事物资、金属、工业品
    lootConfig: {
      // 基础资源
      food: { enemyPercent: 0.045, playerPercent: 0.030, baseMin: 70 },
      wood: { enemyPercent: 0.030, playerPercent: 0.022, baseMin: 40 },
      stone: { enemyPercent: 0.025, playerPercent: 0.018, baseMin: 25 },
      cloth: { enemyPercent: 0.025, playerPercent: 0.018, baseMin: 25 },
      // 金属和军事物资 - 击败敌军后缴获
      iron: { enemyPercent: 0.035, playerPercent: 0.025, baseMin: 30 },
      copper: { enemyPercent: 0.028, playerPercent: 0.020, baseMin: 20 },
      tools: { enemyPercent: 0.025, playerPercent: 0.018, baseMin: 15 },
      steel: { enemyPercent: 0.020, playerPercent: 0.012, baseMin: 8 },
      coal: { enemyPercent: 0.022, playerPercent: 0.015, baseMin: 12 },
      // 货币
      silver: { enemyPercent: 0.065, playerPercent: 0.040, baseMin: 180 },
      // 加工品
      plank: { enemyPercent: 0.020, playerPercent: 0.015, baseMin: 15 },
      brick: { enemyPercent: 0.018, playerPercent: 0.012, baseMin: 12 },
      dye: { enemyPercent: 0.015, playerPercent: 0.010, baseMin: 8 },
      // 奢侈品 - 战场缴获
      fine_clothes: { enemyPercent: 0.012, playerPercent: 0.008, baseMin: 5 },
      ale: { enemyPercent: 0.020, playerPercent: 0.015, baseMin: 12 },
      delicacies: { enemyPercent: 0.015, playerPercent: 0.010, baseMin: 8 },
      furniture: { enemyPercent: 0.010, playerPercent: 0.006, baseMin: 4 },
      // 贸易品
      spice: { enemyPercent: 0.015, playerPercent: 0.010, baseMin: 6 },
      coffee: { enemyPercent: 0.012, playerPercent: 0.008, baseMin: 5 },
      // 文化品
      papyrus: { enemyPercent: 0.012, playerPercent: 0.008, baseMin: 6 },
    },
    loot: {
      food: [60, 160],
      iron: [20, 50],
      silver: [150, 240],
    },
    influence: { win: 10, lose: -6 },
    winScore: 25,
    loseScore: 20,
    wealthDamage: 30,
  },
  {
    id: 'siege',
    name: '围城压制',
    desc: '长期围困敌城，切断其物资来源并迫使投降。',
    difficulty: '难',
    difficultyLevel: 3,
    unitScale: 'heavy',
    baseUnitCount: { min: 15, max: 25 },
    enemyUnits: [],
    cooldownDays: 12,
    requiresTech: 'fortification', // 需要防御工事科技 - 知道如何建城才知道如何攻城
    // 围城压制 - 攻陷城市后获取所有类型资源的丰厚战利品
    lootConfig: {
      // 基础资源 - 城市储备
      food: { enemyPercent: 0.060, playerPercent: 0.040, baseMin: 100 },
      wood: { enemyPercent: 0.045, playerPercent: 0.030, baseMin: 60 },
      stone: { enemyPercent: 0.040, playerPercent: 0.028, baseMin: 50 },
      cloth: { enemyPercent: 0.038, playerPercent: 0.025, baseMin: 40 },
      // 金属资源 - 城市工业储备
      iron: { enemyPercent: 0.045, playerPercent: 0.032, baseMin: 45 },
      copper: { enemyPercent: 0.038, playerPercent: 0.028, baseMin: 35 },
      coal: { enemyPercent: 0.035, playerPercent: 0.025, baseMin: 30 },
      steel: { enemyPercent: 0.030, playerPercent: 0.020, baseMin: 20 },
      // 工业品 - 工坊缴获
      tools: { enemyPercent: 0.035, playerPercent: 0.025, baseMin: 25 },
      plank: { enemyPercent: 0.032, playerPercent: 0.022, baseMin: 25 },
      brick: { enemyPercent: 0.030, playerPercent: 0.020, baseMin: 25 },
      dye: { enemyPercent: 0.025, playerPercent: 0.018, baseMin: 15 },
      // 货币和贵金属 - 城市财库
      silver: { enemyPercent: 0.090, playerPercent: 0.055, baseMin: 300 },
      // 奢侈品 - 贵族府邸掠夺
      fine_clothes: { enemyPercent: 0.028, playerPercent: 0.018, baseMin: 15 },
      furniture: { enemyPercent: 0.025, playerPercent: 0.015, baseMin: 12 },
      ale: { enemyPercent: 0.030, playerPercent: 0.022, baseMin: 20 },
      delicacies: { enemyPercent: 0.028, playerPercent: 0.020, baseMin: 18 },
      // 贸易品 - 商人仓库
      spice: { enemyPercent: 0.025, playerPercent: 0.018, baseMin: 15 },
      coffee: { enemyPercent: 0.022, playerPercent: 0.015, baseMin: 12 },
      // 文化和知识 - 图书馆和档案
      papyrus: { enemyPercent: 0.025, playerPercent: 0.018, baseMin: 15 },
      science: { enemyPercent: 0.015, playerPercent: 0.008, baseMin: 10 },
      culture: { enemyPercent: 0.012, playerPercent: 0.006, baseMin: 8 },
    },
    loot: {
      food: [80, 180],
      wood: [40, 100],
      tools: [10, 25],
      silver: [200, 320],
    },
    influence: { win: 14, lose: -10 },
    winScore: 52,
    loseScore: 54,
    wealthDamage: 45,
  },
  {
    id: 'naval_raid',
    name: '海上劫掠',
    desc: '拦截敌方商船队，夺取海上贸易货物。',
    difficulty: '中',
    difficultyLevel: 2,
    unitScale: 'medium',
    baseUnitCount: { min: 8, max: 14 },
    enemyUnits: [],
    cooldownDays: 6,
    requiresTech: 'sailing', // 需要航海术
    // 海上劫掠 - 主要获取贸易品和进口货物
    lootConfig: {
      // 贸易货物 - 主要目标
      spice: { enemyPercent: 0.045, playerPercent: 0.035, baseMin: 30 },
      coffee: { enemyPercent: 0.040, playerPercent: 0.030, baseMin: 25 },
      dye: { enemyPercent: 0.035, playerPercent: 0.028, baseMin: 22 },
      // 奢侈品
      fine_clothes: { enemyPercent: 0.030, playerPercent: 0.022, baseMin: 18 },
      furniture: { enemyPercent: 0.025, playerPercent: 0.018, baseMin: 12 },
      ale: { enemyPercent: 0.028, playerPercent: 0.020, baseMin: 15 },
      delicacies: { enemyPercent: 0.032, playerPercent: 0.025, baseMin: 20 },
      // 工业原料
      cloth: { enemyPercent: 0.030, playerPercent: 0.022, baseMin: 25 },
      copper: { enemyPercent: 0.025, playerPercent: 0.018, baseMin: 18 },
      iron: { enemyPercent: 0.022, playerPercent: 0.015, baseMin: 15 },
      // 货币 - 商船财宝
      silver: { enemyPercent: 0.070, playerPercent: 0.045, baseMin: 200 },
      // 其他货物
      papyrus: { enemyPercent: 0.020, playerPercent: 0.015, baseMin: 12 },
      tools: { enemyPercent: 0.018, playerPercent: 0.012, baseMin: 10 },
    },
    loot: {
      silver: [150, 280],
      spice: [20, 50],
      cloth: [20, 45],
    },
    influence: { win: 8, lose: -5 },
    winScore: 32,
    loseScore: 38,
    wealthDamage: 25,
  },
  {
    id: 'scorched_earth',
    name: '焦土战术',
    desc: '深入敌境破坏其生产设施和农田，削弱敌方经济。',
    difficulty: '难',
    difficultyLevel: 3,
    unitScale: 'heavy',
    baseUnitCount: { min: 12, max: 20 },
    enemyUnits: [],
    cooldownDays: 10,
    requiresTech: 'military_training', // 需要军事训练 - 系统性破坏需要有组织的军队
    // 焦土战术 - 主要破坏敌方资源，自己获取较少但敌方损失大
    lootConfig: {
      // 抢先掠夺的物资
      food: { enemyPercent: 0.050, playerPercent: 0.035, baseMin: 80 },
      wood: { enemyPercent: 0.040, playerPercent: 0.028, baseMin: 50 },
      stone: { enemyPercent: 0.025, playerPercent: 0.018, baseMin: 30 },
      // 农产品
      cloth: { enemyPercent: 0.030, playerPercent: 0.020, baseMin: 25 },
      dye: { enemyPercent: 0.020, playerPercent: 0.012, baseMin: 12 },
      // 货币
      silver: { enemyPercent: 0.055, playerPercent: 0.035, baseMin: 150 },
      // 破坏后残余物资
      coal: { enemyPercent: 0.025, playerPercent: 0.018, baseMin: 18 },
      tools: { enemyPercent: 0.020, playerPercent: 0.012, baseMin: 10 },
      ale: { enemyPercent: 0.025, playerPercent: 0.018, baseMin: 15 },
    },
    loot: {
      food: [60, 140],
      wood: [40, 90],
      silver: [100, 200],
    },
    influence: { win: 12, lose: -8 },
    winScore: 48,
    loseScore: 42,
    wealthDamage: 60, // 对敌方经济伤害更大
  },
];
