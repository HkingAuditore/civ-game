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

export const MILITARY_ACTIONS = [
  {
    id: 'raid',
    name: '边境掠夺',
    desc: '小股兵力快速突袭敌方补给线，目标是劫掠资源。',
    difficulty: '易',
    difficultyLevel: 1,
    unitScale: 'light', // 使用轻型兵种组
    baseUnitCount: { min: 6, max: 10 }, // 基础单位数量
    enemyUnits: [], // 保留兼容性，实际使用时动态生成
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
    unitScale: 'medium', // 使用中型兵种组
    baseUnitCount: { min: 12, max: 18 }, // 基础单位数量
    enemyUnits: [], // 保留兼容性，实际使用时动态生成
    loot: {
      food: [60, 160],
      iron: [20, 50],
      silver: [150, 240],
    },
    influence: { win: 10, lose: -6 },
    winScore: 15,
    loseScore: 10,
    wealthDamage: 30,
  },
  {
    id: 'siege',
    name: '围城压制',
    desc: '长期围困敌城，切断其物资来源并迫使投降。',
    difficulty: '难',
    difficultyLevel: 3,
    unitScale: 'heavy', // 使用重型兵种组
    baseUnitCount: { min: 15, max: 25 }, // 基础单位数量
    enemyUnits: [], // 保留兼容性，实际使用时动态生成
    loot: {
      food: [80, 180],
      wood: [40, 100],
      tools: [10, 25],
      silver: [200, 320],
    },
    influence: { win: 14, lose: -10 },
    winScore: 22,
    loseScore: 14,
    wealthDamage: 45,
  },
];
