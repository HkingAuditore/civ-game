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
    cost: { food: 500, wood: 300, stone: 100, silver: 50 },
    bonuses: { 
      desc: "掌握青铜冶炼与畜力生产，采集效率提升。",
      gatherBonus: 0.15,
      militaryBonus: 0.1
    }
  },
  { 
    id: 2, 
    name: "古典时代", 
    color: "text-amber-300", 
    bg: "bg-amber-900", 
    tileColor: "bg-amber-700", 
    req: { science: 1500, population: 80, culture: 200 },
    cost: { food: 800, wood: 400, brick: 150, silver: 200, tools: 50 },
    bonuses: { 
      desc: "城邦理性与文化盛开，基础设施大幅改善。",
      gatherBonus: 0.2,
      cultureBonus: 0.15,
      scienceBonus: 0.1
    }
  },
  { 
    id: 3, 
    name: "封建时代", 
    color: "text-blue-400", 
    bg: "bg-blue-950", 
    tileColor: "bg-blue-800", 
    req: { science: 4000, population: 150, culture: 500 },
    cost: { food: 1500, wood: 800, brick: 400, iron: 200, papyrus: 80, silver: 250 },
    bonuses: { 
      desc: "骑士与庄园秩序成熟，行政和文化发展加速。",
      gatherBonus: 0.25,
      cultureBonus: 0.2,
      adminBonus: 5
    }
  },
  { 
    id: 4, 
    name: "探索时代", 
    color: "text-cyan-300", 
    bg: "bg-cyan-900", 
    tileColor: "bg-cyan-700", 
    req: { science: 7000, population: 280, culture: 1200 },
    cost: { food: 2200, plank: 600, brick: 500, iron: 300, silver: 350 },
    bonuses: { 
      desc: "远洋航行拓展视野，贸易与军事齐头并进。",
      gatherBonus: 0.3,
      scienceBonus: 0.2,
      militaryBonus: 0.1
    }
  },
  { 
    id: 5, 
    name: "启蒙时代", 
    color: "text-purple-400", 
    bg: "bg-purple-950", 
    tileColor: "bg-purple-800", 
    req: { science: 12000, population: 450, culture: 2500 },
    cost: { food: 3500, plank: 800, papyrus: 300, spice: 200, silver: 500 },
    bonuses: { 
      desc: "理性与出版自由蔓延，文化科研全面提升。",
      cultureBonus: 0.3,
      scienceBonus: 0.3,
      adminBonus: 8
    }
  },
  { 
    id: 6, 
    name: "工业时代", 
    color: "text-gray-200", 
    bg: "bg-gray-800", 
    tileColor: "bg-gray-600", 
    req: { science: 20000, population: 650, culture: 4000 },
    cost: { food: 5000, brick: 1200, iron: 800, tools: 500, spice: 200, silver: 800 },
    bonuses: { 
      desc: "蒸汽与煤铁带来巨量产能。",
      gatherBonus: 0.4,
      industryBonus: 0.5,
      scienceBonus: 0.3
    }
  },
];
