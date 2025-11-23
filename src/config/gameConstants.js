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
  food: { name: "粮食", icon: 'Wheat', color: "text-yellow-400", basePrice: 1.2, defaultOwner: 'peasant', unlockEpoch: 0, tags: ['essential','raw_material'] },
  wood: { name: "木材", icon: 'Trees', color: "text-emerald-400", basePrice: 2.5, defaultOwner: 'lumberjack', unlockEpoch: 0, tags: ['raw_material'] },
  stone: { name: "石料", icon: 'Pickaxe', color: "text-stone-400", basePrice: 3.5, defaultOwner: 'miner', unlockEpoch: 0, tags: ['raw_material'] },
  cloth: { name: "布料", icon: 'Shirt', color: "text-indigo-300", basePrice: 4, defaultOwner: 'artisan', unlockEpoch: 0, tags: ['essential','raw_material', 'manufactured'] },

  
  // 青铜时代资源
  plank: { name: "木板", icon: 'Hammer', color: "text-amber-600", basePrice: 5, defaultOwner: 'worker', unlockEpoch: 1, unlockTech: 'tools', tags: ['industrial'] },
  brick: { name: "砖块", icon: 'Home', color: "text-red-400", basePrice: 7, defaultOwner: 'artisan', unlockEpoch: 1, unlockTech: 'pottery', tags: ['industrial'] },
  copper: { name: "铜矿", icon: 'Pickaxe', color: "text-orange-400", basePrice: 7, defaultOwner: 'miner', unlockEpoch: 1, unlockTech: 'copper_mining', tags: ['raw_material'] },
  tools: { name: "工具", icon: 'Anvil', color: "text-blue-300", basePrice: 10, defaultOwner: 'artisan', unlockEpoch: 1, unlockTech: 'bronze_working', tags: ['industrial'] },
    dye: { name: "染料", icon: 'Droplets', color: "text-pink-500", basePrice: 6, defaultOwner: 'artisan', unlockEpoch: 1, tags: ['industrial', 'raw_material'] },
  
  // 古典时代
  papyrus: { name: "纸张", icon: 'ScrollText', color: "text-lime-300", basePrice: 8, defaultOwner: 'scribe', unlockEpoch: 2, unlockTech: 'papyrus_cultivation', tags: ['raw_material', 'manufactured'] },
  delicacies: { name: "珍馐", icon: 'UtensilsCrossed', color: "text-rose-400", basePrice: 12, defaultOwner: 'artisan', unlockEpoch: 2, unlockTech: 'culinary_arts', tags: ['luxury', 'manufactured'] },
  furniture: { name: "精美家具", icon: 'Armchair', color: "text-amber-500", basePrice: 15, defaultOwner: 'artisan', unlockEpoch: 2, unlockTech: 'carpentry', tags: ['luxury', 'manufactured'] },
  ale: { name: "美酒", icon: 'Wine', color: "text-purple-400", basePrice: 10, defaultOwner: 'artisan', unlockEpoch: 2, unlockTech: 'brewing', tags: ['luxury', 'manufactured'] },
  
  fine_clothes: { name: "华服", icon: 'Shirt', color: "text-purple-400", basePrice: 18, defaultOwner: 'artisan', unlockEpoch: 2, tags: ['luxury', 'manufactured'] },
  
  // 封建时代
  iron: { name: "铁矿", icon: 'Pickaxe', color: "text-zinc-400", basePrice: 9, defaultOwner: 'miner', unlockEpoch: 2, unlockTech: 'ironworking', tags: ['raw_material'] },

  // 探索时代
  spice: { name: "香料", icon: 'Leaf', color: "text-amber-400", basePrice: 14, defaultOwner: 'merchant', unlockEpoch: 4, unlockTech: 'cartography', tags: ['essential', 'manufactured'] },

  // 启蒙时代
  coffee: { name: "咖啡", icon: 'Coffee', color: "text-amber-700", basePrice: 12, defaultOwner: 'merchant', unlockEpoch: 5, unlockTech: 'coffee_agronomy', tags: ['essential', 'manufactured'] },

  // 工业时代
  coal: { name: "煤炭", icon: 'Flame', color: "text-slate-300", basePrice: 8, defaultOwner: 'miner', unlockEpoch: 6, unlockTech: 'coal_gasification', tags: ['raw_material'] },
  steel: { name: "钢材", icon: 'Cog', color: "text-gray-300", basePrice: 22, defaultOwner: 'engineer', unlockEpoch: 6, unlockTech: 'steel_alloys', tags: ['industrial'] },
  
  // 特殊资源
  silver: { name: "银币", icon: 'Coins', color: "text-slate-200", type: 'currency', basePrice: 1, unlockEpoch: 0, tags: ['currency'] },
  science: { name: "科研", icon: 'Cpu', color: "text-cyan-400", basePrice: 10, defaultOwner: 'official', unlockEpoch: 0, tags: ['special', 'manufactured'] },
  culture: { name: "文化", icon: 'ScrollText', color: "text-pink-400", basePrice: 6, defaultOwner: 'cleric', unlockEpoch: 1, tags: ['special', 'manufactured'] },
  
  // 虚拟资源
  admin: { name: "行政力", icon: 'Scale', color: "text-purple-300", type: 'virtual', tags: ['special'] },
  
  // 人口上限
  maxPop: { name: "人口上限", icon: 'Users', color: "text-blue-400", type: 'virtual', tags: ['special'] },
};
