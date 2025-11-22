// 资源等其他游戏配置
// 包含游戏速度、资源类型等配置

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
  
  // 青铜时代资源
  plank: { name: "木板", icon: 'Hammer', color: "text-amber-600", basePrice: 4, defaultOwner: 'worker', unlockEpoch: 1 },
  brick: { name: "砖块", icon: 'Home', color: "text-red-400", basePrice: 5, defaultOwner: 'artisan', unlockEpoch: 1 },
  copper: { name: "铜矿", icon: 'Pickaxe', color: "text-orange-400", basePrice: 6, defaultOwner: 'miner', unlockEpoch: 1 },
  tools: { name: "工具", icon: 'Anvil', color: "text-blue-300", basePrice: 9, defaultOwner: 'artisan', unlockEpoch: 1 },
  
  // 古典时代
  papyrus: { name: "莎草纸", icon: 'ScrollText', color: "text-lime-300", basePrice: 7, defaultOwner: 'scribe', unlockEpoch: 2 },
  
  // 封建时代
  iron: { name: "铁矿", icon: 'Pickaxe', color: "text-zinc-400", basePrice: 8, defaultOwner: 'miner', unlockEpoch: 3 },

  // 探索时代
  spice: { name: "香料", icon: 'Leaf', color: "text-amber-400", basePrice: 12, defaultOwner: 'merchant', unlockEpoch: 4 },

  // 启蒙时代
  coffee: { name: "咖啡", icon: 'Coffee', color: "text-amber-700", basePrice: 10, defaultOwner: 'merchant', unlockEpoch: 5 },

  // 工业时代
  coal: { name: "煤炭", icon: 'Flame', color: "text-slate-300", basePrice: 7, defaultOwner: 'miner', unlockEpoch: 6 },
  steel: { name: "钢材", icon: 'Cog', color: "text-gray-300", basePrice: 14, defaultOwner: 'engineer', unlockEpoch: 6 },
  
  // 特殊资源
  silver: { name: "银币", icon: 'Coins', color: "text-slate-200", type: 'currency', basePrice: 1, unlockEpoch: 0 },
  science: { name: "科研", icon: 'Cpu', color: "text-cyan-400", basePrice: 10, defaultOwner: 'official', unlockEpoch: 0 },
  culture: { name: "文化", icon: 'ScrollText', color: "text-pink-400", basePrice: 6, defaultOwner: 'cleric', unlockEpoch: 1 },
  
  // 虚拟资源
  admin: { name: "行政力", icon: 'Scale', color: "text-purple-300", type: 'virtual' },
  
  // 人口上限
  maxPop: { name: "人口上限", icon: 'Users', color: "text-blue-400", type: 'virtual' },
};
