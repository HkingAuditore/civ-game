// 时代配置文件
// 定义游戏中的各个时代及其升级要求和加成效果

/**
 * 时代配置数组
 * 每个时代包含：
 * - id: 时代编号
 * - name: 时代名称
 * - color: 显示颜色（Tailwind类名）
 * - bg: 背景颜色
 * - tileColor: 地图瓦片颜色
 * - req: 升级要求（科研、人口、文化等）
 * - cost: 升级成本（消耗的资源）
 * - bonuses: 时代加成效果
 */
export const EPOCHS = [
  { 
    id: 0, 
    name: "石器时代", 
    color: "text-stone-400", 
    bg: "bg-stone-900", 
    tileColor: "bg-stone-700", 
    req: { science: 0 },
    cost: {},
    bonuses: { desc: "文明的起源，一切从这里开始。" }
  },
  { 
    id: 1, 
    name: "青铜时代", 
    color: "text-orange-400", 
    bg: "bg-orange-950", 
    tileColor: "bg-orange-800", 
    req: { science: 500, population: 20 },
    cost: { food: 500, wood: 300, stone: 100, gold: 50 },
    bonuses: { 
      desc: "掌握金属冶炼技术，生产效率提升。",
      gatherBonus: 0.15,      // 采集加成 +15%
      militaryBonus: 0.1       // 军事加成 +10%
    }
  },
  { 
    id: 2, 
    name: "封建时代", 
    color: "text-blue-400", 
    bg: "bg-blue-950", 
    tileColor: "bg-blue-800", 
    req: { science: 2000, population: 100, culture: 500 },
    cost: { food: 2000, wood: 1000, stone: 500, gold: 200, plank: 200 },
    bonuses: { 
      desc: "建立封建制度，行政和文化发展加速。",
      gatherBonus: 0.25,      // 采集加成 +25%
      cultureBonus: 0.2,      // 文化加成 +20%
      adminBonus: 5           // 行政容量 +5
    }
  },
  { 
    id: 3, 
    name: "工业时代", 
    color: "text-gray-200", 
    bg: "bg-gray-800", 
    tileColor: "bg-gray-600", 
    req: { science: 10000, population: 500, culture: 2000 },
    cost: { food: 5000, brick: 1000, iron: 500, gold: 500, plank: 500 },
    bonuses: { 
      desc: "工业革命带来生产力飞跃。",
      gatherBonus: 0.4,       // 采集加成 +40%
      industryBonus: 0.5,     // 工业加成 +50%
      scienceBonus: 0.3       // 科研加成 +30%
    }
  },
  { 
    id: 4, 
    name: "信息时代", 
    color: "text-purple-400", 
    bg: "bg-purple-950", 
    tileColor: "bg-purple-800", 
    req: { science: 50000, population: 2000, culture: 10000 },
    cost: { food: 10000, brick: 2000, iron: 1000, gold: 1000, tools: 500 },
    bonuses: { 
      desc: "信息技术革命，全面发展。",
      gatherBonus: 0.6,       // 采集加成 +60%
      industryBonus: 0.8,     // 工业加成 +80%
      scienceBonus: 0.5,      // 科研加成 +50%
      cultureBonus: 0.4       // 文化加成 +40%
    }
  },
];
