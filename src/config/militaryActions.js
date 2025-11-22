// 军事行动配置
// 定义可选择的固定军事目标

export const MILITARY_ACTIONS = [
  {
    id: 'raid',
    name: '边境掠夺',
    desc: '小股兵力快速突袭敌方补给线，目标是劫掠资源。',
    difficulty: '易',
    enemyUnits: [
      { unit: 'militia', min: 6, max: 10 },
      { unit: 'slinger', min: 4, max: 8 },
    ],
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
    enemyUnits: [
      { unit: 'spearman', min: 10, max: 16 },
      { unit: 'archer', min: 6, max: 12 },
      { unit: 'light_cavalry', min: 4, max: 8 },
    ],
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
    enemyUnits: [
      { unit: 'heavy_infantry', min: 8, max: 12 },
      { unit: 'crossbowman', min: 6, max: 10 },
      { unit: 'knight', min: 3, max: 6 },
    ],
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
