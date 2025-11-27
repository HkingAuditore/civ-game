// 资源等其他游戏配置
// 包含游戏速度、资源类型等配置

/**
 * 游戏速度选项
 * 1x = 正常速度（1000ms/tick）
 * 2x = 2倍速（500ms/tick）
 * 5x = 5倍速（200ms/tick）
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
export const ECONOMIC_INFLUENCE = {
  price: {
    livingCostWeight: 0.15,
    taxCostWeight: 0.1,
  },
  wage: {
    livingCostWeight: 0.1,
    taxCostWeight: 0.1,
  },
  market: {
    virtualDemandPerPop: 0.01,
    supplyDemandWeight: 1.0,
    inventoryTargetDays: 20.0,
    inventoryPriceImpact: 0.25,
    demandElasticity: 0.5,  // 默认需求弹性：价格变化1%，需求反向变化0.5%
    outputVariation: 0.2,    // 默认产出浮动：±20%
  },
};

export const RESOURCES = {
  // 基础资源
  food: { 
    name: "粮食", 
    icon: 'Wheat', 
    color: "text-yellow-400", 
    basePrice: 1.6, 
    minPrice: 0.16,
    maxPrice: 16,
    defaultOwner: 'peasant', 
    unlockEpoch: 0, 
    tags: ['essential','raw_material'],
    // 粮食的差异化市场配置：作为基础必需品，价格波动更小，库存目标更高
    marketConfig: {
      supplyDemandWeight: 0.6,        // 供需对价格影响较小（必需品价格相对稳定）
      inventoryTargetDays: 30.0,      // 目标库存天数更高（战略储备）
      inventoryPriceImpact: 0.15,     // 库存对价格影响较小
      demandElasticity: 0.2,          // 需求弹性低（必需品，价格变化对需求影响小）
      outputVariation: 0.2,           // 产出浮动±20%
    }
  },
  wood: { name: "木材", icon: 'Trees', color: "text-emerald-400", basePrice: 3.2, minPrice: 0.32, maxPrice: 32, defaultOwner: 'lumberjack', unlockEpoch: 0, tags: ['raw_material'],
    // Tier 1 基础资源：极高稳定性配置
    marketConfig: { supplyDemandWeight: 0.7, inventoryTargetDays: 25.0, inventoryPriceImpact: 0.2, demandElasticity: 0.3, outputVariation: 0.2 }
  },
  stone: { name: "石料", icon: 'Pickaxe', color: "text-stone-400", basePrice: 4.5, minPrice: 0.45, maxPrice: 45, defaultOwner: 'miner', unlockEpoch: 0, tags: ['raw_material'],
    // Tier 1 基础资源：极高稳定性配置
    marketConfig: { supplyDemandWeight: 0.7, inventoryTargetDays: 25.0, inventoryPriceImpact: 0.2, demandElasticity: 0.3, outputVariation: 0.2 }
  },
  cloth: { name: "布料", icon: 'Shirt', color: "text-indigo-300", basePrice: 2.5, minPrice: 0.25, maxPrice: 25, defaultOwner: 'artisan', unlockEpoch: 0, tags: ['essential','raw_material', 'manufactured'] },
  brick: { name: "砖块", icon: 'Home', color: "text-red-400", basePrice: 9.5, minPrice: 0.95, maxPrice: 95, defaultOwner: 'artisan', unlockEpoch: 0, unlockTech: 'pottery', tags: ['industrial'],
    // Tier 2 工业资源：标准平衡配置
    marketConfig: { supplyDemandWeight: 1.0, inventoryTargetDays: 15.0, inventoryPriceImpact: 0.3, demandElasticity: 0.5, outputVariation: 0.2 }
  },
  tools: { name: "工具", icon: 'Anvil', color: "text-blue-300", basePrice: 12.5, minPrice: 1.25, maxPrice: 125, defaultOwner: 'artisan', unlockEpoch: 0, unlockTech: 'tool_making', tags: ['industrial'],
    // Tier 3 奢侈品/高科技资源：高波动性配置
    marketConfig: { supplyDemandWeight: 1.3, inventoryTargetDays: 30.0, inventoryPriceImpact: 0.4, demandElasticity: 0.7, outputVariation: 0.2 }
  },
  
  // 青铜时代资源
  plank: { name: "木板", icon: 'Hammer', color: "text-amber-600", basePrice: 7.5, minPrice: 0.75, maxPrice: 75, defaultOwner: 'worker', unlockEpoch: 1, unlockTech: 'tools', tags: ['industrial'],
    // Tier 2 工业资源：标准平衡配置
    marketConfig: { supplyDemandWeight: 1.0, inventoryTargetDays: 15.0, inventoryPriceImpact: 0.3, demandElasticity: 0.5, outputVariation: 0.2 }
  },
  copper: { name: "铜矿", icon: 'Pickaxe', color: "text-orange-400", basePrice: 8.5, minPrice: 0.85, maxPrice: 85, defaultOwner: 'miner', unlockEpoch: 1, unlockTech: 'copper_mining', tags: ['raw_material'],
    // Tier 2 工业资源：标准平衡配置
    marketConfig: { supplyDemandWeight: 1.0, inventoryTargetDays: 15.0, inventoryPriceImpact: 0.3, demandElasticity: 0.4, outputVariation: 0.2 }
  },

    dye: { name: "染料", icon: 'Droplets', color: "text-pink-500", basePrice: 7.5, minPrice: 0.75, maxPrice: 75, defaultOwner: 'artisan', unlockEpoch: 1, tags: ['industrial', 'raw_material'] },
  
  // 古典时代
  papyrus: { name: "纸张", icon: 'ScrollText', color: "text-lime-300", basePrice: 10, minPrice: 1, maxPrice: 100, defaultOwner: 'scribe', unlockEpoch: 2, unlockTech: 'papyrus_cultivation', tags: ['raw_material', 'manufactured'] },
  delicacies: { name: "珍馐", icon: 'UtensilsCrossed', color: "text-rose-400", basePrice: 18, minPrice: 1.8, maxPrice: 180, defaultOwner: 'artisan', unlockEpoch: 2, unlockTech: 'culinary_arts', tags: ['luxury', 'manufactured'] },
  furniture: { 
    name: "精美家具", 
    icon: 'Armchair', 
    color: "text-amber-500", 
    basePrice: 20, 
    minPrice: 2,
    maxPrice: 200,
    defaultOwner: 'artisan', 
    unlockEpoch: 2, 
    unlockTech: 'carpentry', 
    tags: ['luxury', 'manufactured'],
    // 家具的差异化市场配置：作为奢侈品，价格波动更大，库存目标较低
    marketConfig: {
      supplyDemandWeight: 1.5,        // 供需对价格影响更大（奢侈品价格弹性高）
      inventoryTargetDays: 10.0,      // 目标库存天数较低（非必需品）
      inventoryPriceImpact: 0.4,      // 库存对价格影响更大
      demandElasticity: 1.2,          // 需求弹性高（奢侈品，价格变化对需求影响大）
      outputVariation: 0.2,           // 产出浮动±20%
    }
  },
  ale: { name: "美酒", icon: 'Wine', color: "text-purple-400", basePrice: 13, minPrice: 1.3, maxPrice: 130, defaultOwner: 'artisan', unlockEpoch: 2, unlockTech: 'brewing', tags: ['luxury', 'manufactured'],
    // Tier 3 奢侈品资源：高波动性、高敏感度配置
    marketConfig: { supplyDemandWeight: 1.6, inventoryTargetDays: 8.0, inventoryPriceImpact: 0.5, demandElasticity: 1.5, outputVariation: 0.2 }
  },
  
  fine_clothes: { name: "华服", icon: 'Shirt', color: "text-purple-400", basePrice: 24, minPrice: 2.4, maxPrice: 240, defaultOwner: 'artisan', unlockEpoch: 2, tags: ['luxury', 'manufactured'] },
  
  // 封建时代
  iron: { name: "铁矿", icon: 'Pickaxe', color: "text-zinc-400", basePrice: 11.5, minPrice: 1.15, maxPrice: 115, defaultOwner: 'miner', unlockEpoch: 2, unlockTech: 'ironworking', tags: ['raw_material'] },

  // 探索时代
  spice: { name: "香料", icon: 'Leaf', color: "text-amber-400", basePrice: 20, minPrice: 2, maxPrice: 200, defaultOwner: 'merchant', unlockEpoch: 4, unlockTech: 'cartography', tags: ['essential', 'manufactured'] },

  // 启蒙时代
  coffee: { name: "咖啡", icon: 'Coffee', color: "text-amber-700", basePrice: 18, minPrice: 1.8, maxPrice: 180, defaultOwner: 'merchant', unlockEpoch: 5, unlockTech: 'coffee_agronomy', tags: ['essential', 'manufactured'] },

  // 工业时代
  coal: { name: "煤炭", icon: 'Flame', color: "text-slate-300", basePrice: 11, minPrice: 1.1, maxPrice: 110, defaultOwner: 'miner', unlockEpoch: 6, unlockTech: 'coal_gasification', tags: ['raw_material'] },
  steel: { name: "钢材", icon: 'Cog', color: "text-gray-300", basePrice: 30, minPrice: 3, maxPrice: 300, defaultOwner: 'engineer', unlockEpoch: 6, unlockTech: 'steel_alloys', tags: ['industrial'] },
  
  // 特殊资源
  silver: { name: "银币", icon: 'Coins', color: "text-slate-200", type: 'currency', basePrice: 1, minPrice: 1, maxPrice: 1, unlockEpoch: 0, tags: ['currency'] },
  science: { name: "科研", icon: 'Cpu', color: "text-cyan-400", basePrice: 5, minPrice: 0.5, maxPrice: 50, defaultOwner: 'official', unlockEpoch: 0, tags: ['special', 'manufactured'] },
  culture: { name: "文化", icon: 'ScrollText', color: "text-pink-400", basePrice: 2.0, minPrice: 0.25, maxPrice: 10, defaultOwner: 'cleric', unlockEpoch: 1, unlockTech: 'amphitheater_design', tags: ['special', 'manufactured'] },
  
  // 虚拟资源
  admin: { name: "行政力", icon: 'Scale', color: "text-purple-300", type: 'virtual', tags: ['special'] },
  
  // 人口上限
  maxPop: { name: "人口上限", icon: 'Users', color: "text-blue-400", type: 'virtual', tags: ['special'] },
};
