// 资源等其他游戏配置
// 包含游戏速度、资源类型等配置

/**
 * 游戏速度选项
 * 1x = 正常速度（1000ms/tick）
 * 2x = 2倍速（500ms/tick）
 * 5x = 5倍速（200ms/tick）
 */
export const GAME_SPEEDS = [0.5, 1, 2, 5];

/**
 * 财富衰减率 (生活损耗/Lifestyle Inflation)
 * 每日按比例衰减财富，防止无限积累
 * 0.005 = 0.5% per day
 */
export const WEALTH_DECAY_RATE = 0.005;

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
        inventoryTargetDays: 365.0,
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
        basePrice: 1.0,
        minPrice: 0.1,
        maxPrice: 10,
        defaultOwner: 'peasant',
        unlockEpoch: 0,
        tags: ['essential', 'raw_material'],
        // 粮食的差异化市场配置：作为基础必需品，价格波动更小，库存目标更高
        marketConfig: {
            supplyDemandWeight: 0.4,        // 供需对价格影响较小（必需品价格相对稳定）
            inventoryTargetDays: 730.0,       // 目标库存天数更高（战略储备）
            inventoryPriceImpact: 0.15,     // 库存对价格影响较小
            demandElasticity: 0.2,          // 需求弹性低（必需品，价格变化对需求影响小）
            outputVariation: 0.2,           // 产出浮动±20%
        }
    },
    wood: {
        name: "木材",
        icon: 'Trees',
        color: "text-emerald-400",
        basePrice: 2.0,
        minPrice: 0.02,
        maxPrice: 20,
        defaultOwner: 'lumberjack',
        unlockEpoch: 0,
        tags: ['raw_material'],
        // Tier 1 基础原材料：极高稳定度配置
        marketConfig: {
            supplyDemandWeight: 0.7,        // 供需影响较小（基础资源价格稳定）
            inventoryTargetDays: 550.0,       // 较高库存目标（建筑材料需要储备）
            inventoryPriceImpact: 0.2,      // 库存影响较小
            demandElasticity: 0.3,          // 低需求弹性（建筑必需）
            outputVariation: 0.2            // 产出浮动±20%
        }
    },
    stone: {
        name: "石料",
        icon: 'Pickaxe',
        color: "text-stone-400",
        basePrice: 3.0,
        minPrice: 0.03,
        maxPrice: 30,
        defaultOwner: 'miner',
        unlockEpoch: 0,
        tags: ['raw_material'],
        // Tier 1 基础原材料：极高稳定度配置
        marketConfig: {
            supplyDemandWeight: 0.7,        // 供需影响较小
            inventoryTargetDays: 550.0,       // 较高库存目标
            inventoryPriceImpact: 0.2,      // 库存影响较小
            demandElasticity: 0.3,          // 低需求弹性
            outputVariation: 0.2            // 产出浮动±20%
        }
    },
    cloth: {
        name: "布料",
        icon: 'Shirt',
        color: "text-indigo-300",
        basePrice: 1.5,
        minPrice: 0.015,
        maxPrice: 15,
        defaultOwner: 'worker',
        unlockEpoch: 0,
        tags: ['essential', 'raw_material', 'manufactured'],
        // 必需品制成品：中等稳定度
        marketConfig: {
            supplyDemandWeight: 0.8,        // 供需影响中等（必需品但有替代性）
            inventoryTargetDays: 600.0,       // 必需品较高库存目标
            inventoryPriceImpact: 0.25,     // 库存影响中等
            demandElasticity: 0.4,          // 中低需求弹性（必需品）
            outputVariation: 0.2            // 产出浮动±20%
        }
    },
    brick: {
        name: "砖块",
        icon: 'Home',
        color: "text-red-400",
        basePrice: 6.0,
        minPrice: 0.06,
        maxPrice: 60,
        defaultOwner: 'artisan',
        unlockEpoch: 0,
        unlockTech: 'pottery',
        tags: ['industrial'],
        // Tier 2 工业资源：标准平衡配置
        marketConfig: {
            supplyDemandWeight: 1.0,        // 标准供需影响
            inventoryTargetDays: 270.0,       // 工业品标准库存目标
            inventoryPriceImpact: 0.3,      // 标准库存影响
            demandElasticity: 0.5,          // 标准需求弹性
            outputVariation: 0.2            // 产出浮动±20%
        }
    },
    tools: {
        name: "工具",
        icon: 'Anvil',
        color: "text-blue-300",
        basePrice: 16.0,
        minPrice: 0.16,
        maxPrice: 160,
        defaultOwner: 'artisan',
        unlockEpoch: 0,
        unlockTech: 'tool_making',
        tags: ['industrial'],
        // 工业品：较高波动性（生产工具，需求相对稳定但价格敏感）
        marketConfig: {
            supplyDemandWeight: 1.2,        // 供需影响较大
            inventoryTargetDays: 300.0,       // 工业品较高库存目标（耐用品）
            inventoryPriceImpact: 0.35,     // 库存影响较大
            demandElasticity: 0.6,          // 中等需求弹性
            outputVariation: 0.2            // 产出浮动±20%
        }
    },

    // 青铜时代资源
    plank: {
        name: "木板",
        icon: 'TreeDeciduous',
        color: "text-amber-600",
        basePrice: 5.0,
        minPrice: 0.05,
        maxPrice: 50,
        defaultOwner: 'worker',
        unlockEpoch: 1,
        unlockTech: 'tools',
        tags: ['industrial'],
        // 加工木材：标准工业品配置
        marketConfig: {
            supplyDemandWeight: 1.0,        // 标准供需影响
            inventoryTargetDays: 240.0,       // 工业品标准库存目标
            inventoryPriceImpact: 0.3,      // 标准库存影响
            demandElasticity: 0.5,          // 标准需求弹性
            outputVariation: 0.2            // 产出浮动±20%
        }
    },
    copper: {
        name: "铜矿",
        icon: 'Pickaxe',
        color: "text-orange-400",
        basePrice: 5.5,
        minPrice: 0.055,
        maxPrice: 55,
        defaultOwner: 'miner',
        unlockEpoch: 1,
        unlockTech: 'copper_mining',
        tags: ['raw_material'],
        // 金属原材料：中等稳定度
        marketConfig: {
            supplyDemandWeight: 0.9,        // 供需影响较小（原材料）
            inventoryTargetDays: 300.0,       // 工业品较高库存目标（战略资源）
            inventoryPriceImpact: 0.25,     // 库存影响中等
            demandElasticity: 0.4,          // 低需求弹性（工业必需）
            outputVariation: 0.2            // 产出浮动±20%
        }
    },
    dye: {
        name: "染料",
        icon: 'Droplets',
        color: "text-pink-500",
        basePrice: 5.0,
        minPrice: 0.05,
        maxPrice: 50,
        defaultOwner: 'artisan',
        unlockEpoch: 1,
        tags: ['industrial', 'raw_material'],
        // 工业原料：标准配置
        marketConfig: {
            supplyDemandWeight: 1.1,        // 供需影响略高（非必需品）
            inventoryTargetDays: 200.0,       // 工业品较低库存目标
            inventoryPriceImpact: 0.35,     // 库存影响较大
            demandElasticity: 0.6,          // 中等需求弹性
            outputVariation: 0.2            // 产出浮动±20%
        }
    },

    // 古典时代
    papyrus: {
        name: "纸张",
        icon: 'ScrollText',
        color: "text-lime-300",
        basePrice: 6.5,
        minPrice: 0.065,
        maxPrice: 65,
        defaultOwner: 'scribe',
        unlockEpoch: 2,
        unlockTech: 'papyrus_cultivation',
        tags: ['raw_material', 'manufactured'],
        // 文化产品：中等波动性
        marketConfig: {
            supplyDemandWeight: 1.1,        // 供需影响略高
            inventoryTargetDays: 240.0,       // 工业品标准库存目标
            inventoryPriceImpact: 0.3,      // 标准库存影响
            demandElasticity: 0.5,          // 标准需求弹性
            outputVariation: 0.2            // 产出浮动±20%
        }
    },
    delicacies: {
        name: "珍馐",
        icon: 'UtensilsCrossed',
        color: "text-rose-400",
        basePrice: 24,
        minPrice: 0.24,
        maxPrice: 240,
        defaultOwner: 'artisan',
        unlockEpoch: 2,
        unlockTech: 'culinary_arts',
        tags: ['luxury', 'manufactured'],
        // 奢侈品：高波动性
        marketConfig: {
            supplyDemandWeight: 1.5,        // 供需影响很大（奢侈品）
            inventoryTargetDays: 90.0,        // 奢侈品低库存目标（易腐品）
            inventoryPriceImpact: 0.45,     // 库存影响很大
            demandElasticity: 1.3,          // 高需求弹性（奢侈品）
            outputVariation: 0.2            // 产出浮动±20%
        }
    },
    furniture: {
        name: "家具",
        icon: 'Armchair',
        color: "text-amber-500",
        basePrice: 28,
        minPrice: 0.28,
        maxPrice: 280,
        defaultOwner: 'artisan',
        unlockEpoch: 2,
        unlockTech: 'carpentry',
        tags: ['luxury', 'manufactured'],
        // 家具的差异化市场配置：作为奢侈品，价格波动更大，库存目标较低
        marketConfig: {
            supplyDemandWeight: 1.5,        // 供需对价格影响更大（奢侈品价格弹性高）
            inventoryTargetDays: 120.0,      // 奢侈品目标库存天数较低
            inventoryPriceImpact: 0.4,      // 库存对价格影响更大
            demandElasticity: 1.2,          // 需求弹性高（奢侈品，价格变化对需求影响大）
            outputVariation: 0.2,           // 产出浮动±20%
        }
    },
    ale: {
        name: "美酒", icon: 'Wine', color: "text-purple-400", basePrice: 18, minPrice: 0.18, maxPrice: 180, defaultOwner: 'artisan', unlockEpoch: 2, unlockTech: 'brewing', tags: ['luxury', 'manufactured'],
        // Tier 3 奢侈品资源：高波动性、高敏感度配置
        marketConfig: { supplyDemandWeight: 1.6, inventoryTargetDays: 150.0, inventoryPriceImpact: 0.5, demandElasticity: 1.5, outputVariation: 0.2 }
    },

    fine_clothes: {
        name: "华服",
        icon: 'Shirt',
        color: "text-purple-400",
        basePrice: 32,
        minPrice: 0.32,
        maxPrice: 320,
        defaultOwner: 'artisan',
        unlockEpoch: 2,
        tags: ['luxury', 'manufactured'],
        // 高端奢侈品：极高波动性
        marketConfig: {
            supplyDemandWeight: 1.6,        // 供需影响极大
            inventoryTargetDays: 100.0,      // 奢侈品低库存目标
            inventoryPriceImpact: 0.5,      // 库存影响极大
            demandElasticity: 1.5,          // 极高需求弹性
            outputVariation: 0.2            // 产出浮动±20%
        }
    },

    // 封建时代
    iron: {
        name: "铁矿",
        icon: 'Pickaxe',
        color: "text-zinc-400",
        basePrice: 8.0,
        minPrice: 0.08,
        maxPrice: 80,
        defaultOwner: 'miner',
        unlockEpoch: 2,
        unlockTech: 'ironworking',
        tags: ['raw_material'],
        // 战略金属：高稳定度
        marketConfig: {
            supplyDemandWeight: 0.8,        // 供需影响较小（战略资源）
            inventoryTargetDays: 500.0,       // 战略资源高库存目标
            inventoryPriceImpact: 0.2,      // 库存影响较小
            demandElasticity: 0.3,          // 低需求弹性（军事必需）
            outputVariation: 0.2            // 产出浮动±20%
        }
    },

    // 探索时代
    spice: {
        name: "香料",
        icon: 'Leaf',
        color: "text-amber-400",
        basePrice: 26,
        minPrice: 0.26,
        maxPrice: 260,
        defaultOwner: 'merchant',
        unlockEpoch: 4,
        unlockTech: 'cartography',
        tags: ['essential', 'manufactured'],
        // 贸易商品：高波动性
        marketConfig: {
            supplyDemandWeight: 1.4,        // 供需影响大（贸易品）
            inventoryTargetDays: 180.0,       // 奢侈品中等库存目标
            inventoryPriceImpact: 0.4,      // 库存影响大
            demandElasticity: 0.9,          // 较高需求弹性
            outputVariation: 0.2            // 产出浮动±20%
        }
    },

    // 启蒙时代
    coffee: {
        name: "咖啡",
        icon: 'Coffee',
        color: "text-amber-700",
        basePrice: 24,
        minPrice: 0.24,
        maxPrice: 240,
        defaultOwner: 'merchant',
        unlockEpoch: 5,
        unlockTech: 'coffee_agronomy',
        tags: ['essential', 'manufactured'],
        // 消费品：中高波动性
        marketConfig: {
            supplyDemandWeight: 1.2,        // 供需影响较大
            inventoryTargetDays: 240.0,       // 消费品标准库存目标
            inventoryPriceImpact: 0.35,     // 库存影响较大
            demandElasticity: 0.8,          // 较高需求弹性
            outputVariation: 0.2            // 产出浮动±20%
        }
    },

    // 工业时代
    coal: {
        name: "煤炭",
        icon: 'Flame',
        color: "text-slate-300",
        basePrice: 7.5,
        minPrice: 0.075,
        maxPrice: 75,
        defaultOwner: 'miner',
        unlockEpoch: 6,
        unlockTech: 'coal_gasification',
        tags: ['raw_material'],
        // 工业燃料：中等稳定度
        marketConfig: {
            supplyDemandWeight: 0.9,        // 供需影响较小（工业必需）
            inventoryTargetDays: 365.0,       // 工业原料较高库存目标（能源储备）
            inventoryPriceImpact: 0.25,     // 库存影响中等
            demandElasticity: 0.4,          // 低需求弹性（工业必需）
            outputVariation: 0.2            // 产出浮动±20%
        }
    },
    steel: {
        name: "钢材",
        icon: 'Cog',
        color: "text-gray-300",
        basePrice: 40,
        minPrice: 0.4,
        maxPrice: 400,
        defaultOwner: 'engineer',
        unlockEpoch: 6,
        unlockTech: 'steel_alloys',
        tags: ['industrial'],
        // 高级工业品：标准配置
        marketConfig: {
            supplyDemandWeight: 1.0,        // 标准供需影响
            inventoryTargetDays: 300.0,       // 工业品较高库存目标
            inventoryPriceImpact: 0.3,      // 标准库存影响
            demandElasticity: 0.5,          // 标准需求弹性
            outputVariation: 0.2            // 产出浮动±20%
        }
    },

    // 特殊资源
    silver: {
        name: "银币",
        icon: 'Coins',
        color: "text-slate-200",
        type: 'currency',
        basePrice: 1,
        minPrice: 1,
        maxPrice: 1,
        unlockEpoch: 0,
        tags: ['currency']
        // 货币不需要marketConfig
    },
    science: {
        name: "科研",
        icon: 'Cpu',
        color: "text-cyan-400",
        basePrice: 5,
        minPrice: 0.05,
        maxPrice: 50,
        defaultOwner: 'official',
        unlockEpoch: 0,
        tags: ['special', 'manufactured'],
        // 特殊产出：低波动性（政府控制）
        marketConfig: {
            supplyDemandWeight: 0.5,        // 供需影响很小（政府主导）
            inventoryTargetDays: 730.0,       // 特殊资源高库存目标（长期积累）
            inventoryPriceImpact: 0.15,     // 库存影响很小
            demandElasticity: 0.2,          // 极低需求弹性（国家需求）
            outputVariation: 0.1            // 产出浮动±10%（稳定）
        }
    },
    culture: {
        name: "文化",
        icon: 'ScrollText',
        color: "text-pink-400",
        basePrice: 2.0,
        minPrice: 0.025,
        maxPrice: 10,
        defaultOwner: 'cleric',
        unlockEpoch: 1,
        unlockTech: 'amphitheater_design',
        tags: ['special', 'manufactured'],
        // 特殊产出：低波动性（文化积累）
        marketConfig: {
            supplyDemandWeight: 0.6,        // 供需影响较小
            inventoryTargetDays: 600.0,       // 特殊资源高库存目标（文化积累）
            inventoryPriceImpact: 0.2,      // 库存影响较小
            demandElasticity: 0.3,          // 低需求弹性
            outputVariation: 0.15           // 产出浮动±15%
        }
    },

    // 虚拟资源
    // 人口上限
    maxPop: { name: "人口上限", icon: 'Users', color: "text-blue-400", type: 'virtual', tags: ['special'] },

    // 军事容量
    militaryCapacity: { name: "军事容量", icon: 'Shield', color: "text-red-400", type: 'virtual', tags: ['special'] },
};

/**
 * 税收上限限制
 */
export const TAX_LIMITS = {
    MAX_HEAD_TAX: 10000,      // 人头税系数上限
    MAX_RESOURCE_TAX: 5.0,    // 交易税率上限 (500%)
    MAX_BUSINESS_TAX: 10000,  // 营业税系数上限
};
