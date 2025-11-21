// 资源、科技、政令、国家等其他游戏配置
// 包含游戏速度、资源类型、科技树、政令和外交国家等配置

/**
 * 游戏速度选项
 * 1x = 正常速度
 * 2x = 2倍速
 * 5x = 5倍速
 */
export const GAME_SPEEDS = [1, 2, 5];

/**
 * 资源类型配置
 * 每个资源包含：
 * - name: 资源名称
 * - icon: 显示图标
 * - color: 显示颜色
 * - type: 资源类型（virtual表示虚拟资源，不可存储）
 */
export const RESOURCES = {
  // 基础资源
  food: { name: "粮食", icon: 'Wheat', color: "text-yellow-400", basePrice: 1, defaultOwner: 'peasant', unlockEpoch: 0 },
  wood: { name: "木材", icon: 'Trees', color: "text-emerald-400", basePrice: 2, defaultOwner: 'lumberjack', unlockEpoch: 0 },
  stone: { name: "石料", icon: 'Pickaxe', color: "text-stone-400", basePrice: 3, defaultOwner: 'miner', unlockEpoch: 0 },
  
  // 加工资源
  plank: { name: "木板", icon: 'Hammer', color: "text-amber-600", basePrice: 4, defaultOwner: 'worker', unlockEpoch: 0 },
  brick: { name: "砖块", icon: 'Home', color: "text-red-400", basePrice: 5, defaultOwner: 'worker', unlockEpoch: 1 },
  iron: { name: "铁矿", icon: 'Pickaxe', color: "text-zinc-400", basePrice: 6, defaultOwner: 'miner', unlockEpoch: 1 },
  tools: { name: "工具", icon: 'Anvil', color: "text-blue-300", basePrice: 8, defaultOwner: 'capitalist', unlockEpoch: 3 },
  
  // 特殊资源
  silver: { name: "银币", icon: 'Coins', color: "text-slate-200", type: 'currency', basePrice: 1, unlockEpoch: 0 },
  science: { name: "科研", icon: 'Cpu', color: "text-cyan-400", basePrice: 10, defaultOwner: 'official', unlockEpoch: 0 },
  culture: { name: "文化", icon: 'ScrollText', color: "text-pink-400", basePrice: 6, defaultOwner: 'cleric', unlockEpoch: 1 },
  
  // 虚拟资源
  admin: { name: "行政力", icon: 'Scale', color: "text-purple-300", type: 'virtual' },
  
  // 人口上限
  maxPop: { name: "人口上限", icon: 'Users', color: "text-blue-400", type: 'virtual' },
};

/**
 * 科技树配置
 * 每个科技包含：
 * - id: 科技唯一标识
 * - name: 科技名称
 * - desc: 科技描述和效果
 * - cost: 研究成本
 * - epoch: 解锁时代
 */
export const TECHS = [
  // 石器时代科技
  { 
    id: 'tools', 
    name: "基础工具", 
    desc: "解锁锯木厂 (需木板加工)", 
    cost: { science: 50 }, 
    epoch: 0 
  },
  { 
    id: 'wheel', 
    name: "车轮", 
    desc: "采集效率提升 20%", 
    cost: { science: 150 }, 
    epoch: 0 
  },
  
  // 青铜时代科技
  { 
    id: 'feudalism', 
    name: "封建制度", 
    desc: "解锁庄园和地主阶层", 
    cost: { science: 300 }, 
    epoch: 1 
  },
  { 
    id: 'theology', 
    name: "神学", 
    desc: "解锁教堂和神职人员", 
    cost: { science: 500 }, 
    epoch: 1 
  },
  
  // 封建时代科技
  { 
    id: 'bureaucracy', 
    name: "官僚制度", 
    desc: "解锁市政厅，减少行政惩罚", 
    cost: { science: 1000 }, 
    epoch: 2 
  },
  
  // 工业时代科技
  { 
    id: 'industrialization', 
    name: "工业化", 
    desc: "解锁工厂和资本家", 
    cost: { science: 5000 }, 
    epoch: 3 
  },
];

/**
 * 政令配置
 * 每个政令包含：
 * - id: 政令唯一标识
 * - name: 政令名称
 * - desc: 政令描述和效果
 * - cost: 行政成本
 * - active: 是否激活（初始状态）
 */
export const DECREES = [
  { 
    id: 'forced_labor', 
    name: "强制劳动", 
    desc: "奴隶/佃农产出+20%，但好感大幅下降。", 
    cost: { admin: 10 }, 
    active: false 
  },
  { 
    id: 'tithe', 
    name: "什一税", 
    desc: "向神职人员征税，增加收入但降低其好感。", 
    cost: { admin: 5 }, 
    active: false 
  },
];

/**
 * 外交国家配置
 * 每个国家包含：
 * - id: 国家唯一标识
 * - name: 国家名称
 * - type: 政体类型
 * - color: 显示颜色
 * - desc: 国家描述
 */
export const COUNTRIES = [
  { 
    id: 'empire', 
    name: "大明帝国", 
    type: "军事专制", 
    color: "text-red-400", 
    desc: "好战的邻居，拥有强大的军队。",
    economyTraits: {
      resourceBias: {
        food: 0.8,
        wood: 1.1,
        iron: 1.4,
        tools: 1.3,
        culture: 0.9,
      },
    },
  },
  { 
    id: 'republic', 
    name: "威尼斯共和国", 
    type: "商业共和", 
    color: "text-blue-400", 
    desc: "富有的商人国家，贸易繁荣。",
    economyTraits: {
      resourceBias: {
        food: 1.2,
        wood: 0.9,
        plank: 0.85,
        tools: 0.7,
        culture: 1.4,
      },
    },
  },
  { 
    id: 'theocracy', 
    name: "教皇国", 
    type: "神权政治", 
    color: "text-purple-400", 
    desc: "宗教圣地，文化影响力巨大。",
    economyTraits: {
      resourceBias: {
        food: 1.1,
        stone: 0.9,
        brick: 0.8,
        culture: 1.8,
        wood: 1.2,
      },
    },
  }
];
