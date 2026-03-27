// 资源等其他游戏配置
// 包含游戏速度、资源类型等配置

/**
 * 游戏速度选项
 * 1x = 正常速度（1000ms/tick）
 * 2x = 2倍速（500ms/tick）
 * 5x = 5倍速（200ms/tick）
 */
export const GAME_SPEEDS = [0.5, 1, 2, 3, 5];

/**
 * 财富衰减率 (生活损耗/Lifestyle Inflation)
 * 每日按比例衰减财富，防止无限积累
 * 0.005 = 0.5% per day
 */
export const WEALTH_DECAY_RATE = 0.005;

/**
 * 日志与历史记录存储上限
 * Reduced to minimize save file size and prevent localStorage quota issues
 */
export const LOG_STORAGE_LIMIT = 64;
export const HISTORY_STORAGE_LIMIT = 15;

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
        maxPrice: 150,  // Essential: 150x cap for social stability
        defaultOwner: 'peasant',
        unlockEpoch: 0,
        tags: ['essential', 'raw_material'],
        // 粮食的差异化市场配置：作为基础必需品，价格波动更小，库存目标更高
        marketConfig: {
            supplyDemandWeight: 0.4,        // 供需对价格影响较小（必需品价格相对稳定）
            inventoryTargetDays: 146.0,       // 目标库存天数（战略储备）
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
        maxPrice: 300,  // Raw material: 150x cap
        defaultOwner: 'lumberjack',
        unlockEpoch: 0,
        tags: ['raw_material'],
        // Tier 1 基础原材料：极高稳定度配置
        marketConfig: {
            supplyDemandWeight: 0.7,        // 供需影响较小（基础资源价格稳定）
            inventoryTargetDays: 110.0,       // 较高库存目标（建筑材料需要储备）
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
        maxPrice: 450,  // Raw material: 150x cap
        defaultOwner: 'miner',
        unlockEpoch: 0,
        tags: ['raw_material'],
        // Tier 1 基础原材料：极高稳定度配置
        marketConfig: {
            supplyDemandWeight: 0.7,        // 供需影响较小
            inventoryTargetDays: 110.0,       // 较高库存目标
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
        maxPrice: 325,  // Essential: 217x cap for social stability
        defaultOwner: 'worker',
        unlockEpoch: 0,
        tags: ['essential', 'raw_material', 'manufactured'],
        // 必需品制成品：中等稳定度
        marketConfig: {
            supplyDemandWeight: 0.8,        // 供需影响中等（必需品但有替代性）
            inventoryTargetDays: 120.0,       // 必需品较高库存目标
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
        maxPrice: 1500,  // Industrial: 250x cap
        defaultOwner: 'artisan',
        unlockEpoch: 0,
        unlockTech: 'pottery',
        tags: ['industrial'],
        // Tier 2 工业资源：标准平衡配置
        marketConfig: {
            supplyDemandWeight: 1.0,        // 标准供需影响
            inventoryTargetDays: 54.0,       // 工业品标准库存目标
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
        maxPrice: 4000,  // Industrial: 250x cap
        defaultOwner: 'artisan',
        unlockEpoch: 0,
        unlockTech: 'tool_making',
        tags: ['industrial'],
        // 工业品：较高波动性（生产工具，需求相对稳定但价格敏感）
        marketConfig: {
            supplyDemandWeight: 1.2,        // 供需影响较大
            inventoryTargetDays: 60.0,       // 工业品较高库存目标（耐用品）
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
        maxPrice: 1250,  // Industrial: 250x cap
        defaultOwner: 'worker',
        unlockEpoch: 1,
        unlockTech: 'tools',
        tags: ['industrial'],
        // 加工木材：标准工业品配置
        marketConfig: {
            supplyDemandWeight: 1.0,        // 标准供需影响
            inventoryTargetDays: 48.0,       // 工业品标准库存目标
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
        maxPrice: 825,  // Raw material: 150x cap
        defaultOwner: 'miner',
        unlockEpoch: 1,
        unlockTech: 'copper_mining',
        tags: ['raw_material'],
        // 金属原材料：中等稳定度
        marketConfig: {
            supplyDemandWeight: 0.9,        // 供需影响较小（原材料）
            inventoryTargetDays: 60.0,       // 工业品较高库存目标（战略资源）
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
        maxPrice: 750,  // Raw material: 150x cap
        defaultOwner: 'artisan',
        unlockEpoch: 1,
        tags: ['industrial', 'raw_material'],
        // 工业原料：标准配置
        marketConfig: {
            supplyDemandWeight: 1.1,        // 供需影响略高（非必需品）
            inventoryTargetDays: 40.0,       // 工业品较低库存目标
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
        maxPrice: 1625,  // Industrial: 250x cap
        defaultOwner: 'scribe',
        unlockEpoch: 2,
        unlockTech: 'papyrus_cultivation',
        tags: ['raw_material', 'manufactured'],
        // 文化产品：中等波动性
        marketConfig: {
            supplyDemandWeight: 1.1,        // 供需影响略高
            inventoryTargetDays: 48.0,       // 工业品标准库存目标
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
        maxPrice: 12000,  // Luxury: 500x cap
        defaultOwner: 'artisan',
        unlockEpoch: 2,
        unlockTech: 'culinary_arts',
        tags: ['luxury', 'manufactured'],
        // 奢侈品：高波动性
        marketConfig: {
            supplyDemandWeight: 1.5,        // 供需影响很大（奢侈品）
            inventoryTargetDays: 18.0,        // 奢侈品低库存目标（易腐品）
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
        maxPrice: 14000,  // Luxury: 500x cap
        defaultOwner: 'artisan',
        unlockEpoch: 2,
        unlockTech: 'carpentry',
        tags: ['luxury', 'manufactured'],
        // 家具的差异化市场配置：作为奢侈品，价格波动更大，库存目标较低
        marketConfig: {
            supplyDemandWeight: 1.5,        // 供需对价格影响更大（奢侈品价格弹性高）
            inventoryTargetDays: 24.0,      // 奢侈品目标库存天数较低
            inventoryPriceImpact: 0.4,      // 库存对价格影响更大
            demandElasticity: 1.2,          // 需求弹性高（奢侈品，价格变化对需求影响大）
            outputVariation: 0.2,           // 产出浮动±20%
        }
    },
    ale: {
        name: "美酒", icon: 'Wine', color: "text-purple-400", basePrice: 18, minPrice: 0.18, maxPrice: 1800,  // Luxury: 100x cap
        defaultOwner: 'artisan', unlockEpoch: 2, unlockTech: 'brewing', tags: ['luxury', 'manufactured'],
        // Tier 3 奢侈品资源：高波动性、高敏感度配置
        marketConfig: { supplyDemandWeight: 1.6, inventoryTargetDays: 150.0, inventoryPriceImpact: 0.5, demandElasticity: 1.5, outputVariation: 0.2 }
    },

    fine_clothes: {
        name: "华服",
        icon: 'Shirt',
        color: "text-purple-400",
        basePrice: 32,
        minPrice: 0.32,
        maxPrice: 3200,  // Luxury: 100x cap
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
        maxPrice: 240,  // Raw material: 30x cap
        defaultOwner: 'miner',
        unlockEpoch: 2,
        unlockTech: 'ironworking',
        tags: ['raw_material'],
        // 战略金属：高稳定度
        marketConfig: {
            supplyDemandWeight: 0.8,        // 供需影响较小（战略资源）
            inventoryTargetDays: 200.0,       // 降低以避免正常库存下 inventoryRatio 长期偏低导致通胀
            inventoryPriceImpact: 0.2,      // 库存影响较小
            demandElasticity: 0.3,          // 低需求弹性（军事必需）
            outputVariation: 0.2            // 产出浮动±20%
        }
    },

    // Military resources - Classical Era (Epoch 2)
    swords: {
        name: "刀剑",
        icon: 'Swords',
        color: "text-slate-300",
        basePrice: 20.0,
        minPrice: 0.2,
        maxPrice: 600,  // Military manufactured: 30x cap
        defaultOwner: 'artisan',
        unlockEpoch: 2,
        unlockTech: 'swordsmithing',
        tags: ['military', 'manufactured'],
        // Military equipment: moderate stability, strategic demand
        marketConfig: {
            supplyDemandWeight: 1.0,
            inventoryTargetDays: 300.0,
            inventoryPriceImpact: 0.3,
            demandElasticity: 0.4,
            outputVariation: 0.2
        }
    },

    // Military resources - Feudal Era (Epoch 3)
    plate_armor: {
        name: "铠甲",
        icon: 'Shield',
        color: "text-zinc-300",
        basePrice: 35.0,
        minPrice: 0.35,
        maxPrice: 1050,  // Military manufactured: 30x cap
        defaultOwner: 'artisan',
        unlockEpoch: 3,
        unlockTech: 'armor_forging',
        tags: ['military', 'manufactured'],
        // Heavy armor: high value, moderate stability
        marketConfig: {
            supplyDemandWeight: 1.0,
            inventoryTargetDays: 270.0,
            inventoryPriceImpact: 0.3,
            demandElasticity: 0.4,
            outputVariation: 0.2
        }
    },

    // 探索时代
    spice: {
        name: "香料",
        icon: 'Leaf',
        color: "text-amber-400",
        basePrice: 26,
        minPrice: 0.26,
        maxPrice: 2600,  // Luxury trade good: 100x cap
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

    // Military resources - Exploration Era (Epoch 4)
    gunpowder: {
        name: "火药",
        icon: 'Flame',
        color: "text-orange-500",
        basePrice: 18.0,
        minPrice: 0.18,
        maxPrice: 540,  // Military consumable: 30x cap
        defaultOwner: 'artisan',
        unlockEpoch: 4,
        unlockTech: 'gunpowder_formula',
        tags: ['military', 'manufactured'],
        // Consumable military resource: moderate-high demand during war
        marketConfig: {
            supplyDemandWeight: 1.1,
            inventoryTargetDays: 240.0,
            inventoryPriceImpact: 0.3,
            demandElasticity: 0.4,
            outputVariation: 0.2
        }
    },
    muskets: {
        name: "火枪",
        icon: 'Crosshair',
        color: "text-amber-600",
        basePrice: 30.0,
        minPrice: 0.3,
        maxPrice: 900,  // Military manufactured: 30x cap
        defaultOwner: 'artisan',
        unlockEpoch: 4,
        unlockTech: 'musket_manufacturing',
        tags: ['military', 'manufactured'],
        // Early firearms: high value, moderate stability
        marketConfig: {
            supplyDemandWeight: 1.0,
            inventoryTargetDays: 270.0,
            inventoryPriceImpact: 0.3,
            demandElasticity: 0.4,
            outputVariation: 0.2
        }
    },

    // 启蒙时代
    coffee: {
        name: "咖啡",
        icon: 'Coffee',
        color: "text-amber-700",
        basePrice: 24,
        minPrice: 0.24,
        maxPrice: 2400,  // Luxury consumable: 100x cap
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

    // Military resources - Enlightenment Era (Epoch 5)
    rifles: {
        name: "步枪",
        icon: 'Target',
        color: "text-gray-400",
        basePrice: 45.0,
        minPrice: 0.45,
        maxPrice: 1350,  // Military manufactured: 30x cap
        defaultOwner: 'artisan',
        unlockEpoch: 5,
        unlockTech: 'rifle_engineering',
        tags: ['military', 'manufactured'],
        // Precision firearms: high value, strategic importance
        marketConfig: {
            supplyDemandWeight: 1.0,
            inventoryTargetDays: 270.0,
            inventoryPriceImpact: 0.3,
            demandElasticity: 0.4,
            outputVariation: 0.2
        }
    },
    ammunition: {
        name: "弹药",
        icon: 'Bomb',
        color: "text-red-500",
        basePrice: 15.0,
        minPrice: 0.15,
        maxPrice: 450,  // Military consumable: 30x cap
        defaultOwner: 'artisan',
        unlockEpoch: 5,
        unlockTech: 'rifle_engineering',
        tags: ['military', 'manufactured'],
        // Standardized ammo: high consumption, moderate stability
        marketConfig: {
            supplyDemandWeight: 1.1,
            inventoryTargetDays: 240.0,
            inventoryPriceImpact: 0.3,
            demandElasticity: 0.4,
            outputVariation: 0.2
        }
    },

    // 工业时代
    coal: {
        name: "煤炭",
        icon: 'Flame',
        color: "text-slate-300",
        basePrice: 7.5,
        minPrice: 0.075,
        maxPrice: 225,  // Raw material: 30x cap
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
        maxPrice: 2000,  // Industrial: 50x cap
        defaultOwner: 'engineer',
        unlockEpoch: 6,
        unlockTech: 'steel_alloys',
        tags: ['industrial'],
        // 高级工业品：标准配置
        marketConfig: {
            supplyDemandWeight: 1.0,        // 标准供需影响
            inventoryTargetDays: 150.0,       // 降低以缓解工业时代通胀
            inventoryPriceImpact: 0.3,      // 标准库存影响
            demandElasticity: 0.5,          // 标准需求弹性
            outputVariation: 0.2            // 产出浮动±20%
        }
    },

    // Military resources - Industrial Era (Epoch 6)
    ordnance: {
        name: "制式军火",
        icon: 'Bomb',
        color: "text-red-600",
        basePrice: 60.0,
        minPrice: 0.6,
        maxPrice: 9000,  // Military manufactured: 150x cap
        defaultOwner: 'engineer',
        unlockEpoch: 6,
        unlockTech: 'military_industrialization',
        tags: ['military', 'manufactured'],
        // Industrial-era weapons: highest tier military resource
        marketConfig: {
            supplyDemandWeight: 1.0,
            inventoryTargetDays: 300.0,
            inventoryPriceImpact: 0.3,
            demandElasticity: 0.4,
            outputVariation: 0.2
        }
    },

    // ============ 探索时代 (Epoch 4) 新增资源 ============
    cotton: {
        name: "棉花",
        icon: 'Flower2',
        color: "text-amber-100",
        basePrice: 4.0,
        minPrice: 0.04,
        maxPrice: 200,
        defaultOwner: 'merchant',
        unlockEpoch: 4,
        unlockTech: 'cotton_cultivation',
        tags: ['raw_material'],
        marketConfig: {
            supplyDemandWeight: 1.0,
            inventoryTargetDays: 100.0,
            inventoryPriceImpact: 0.25,
            demandElasticity: 0.4,
            outputVariation: 0.2
        }
    },

    // ============ 电气时代 (Epoch 7) 新增资源 ============
    oil: {
        name: "石油",
        icon: 'Droplet',
        color: "text-amber-900",
        basePrice: 8.0,
        minPrice: 0.08,
        maxPrice: 400,
        defaultOwner: 'capitalist',
        unlockEpoch: 7,
        unlockTech: 'oil_drilling',
        tags: ['raw_material', 'energy'],
        marketConfig: {
            supplyDemandWeight: 0.9,
            inventoryTargetDays: 150.0,
            inventoryPriceImpact: 0.25,
            demandElasticity: 0.35,
            outputVariation: 0.2
        }
    },
    rubber: {
        name: "橡胶",
        icon: 'Circle',
        color: "text-gray-600",
        basePrice: 6.0,
        minPrice: 0.06,
        maxPrice: 300,
        defaultOwner: 'merchant',
        unlockEpoch: 7,
        unlockTech: 'rubber_vulcanization',
        tags: ['raw_material', 'industrial'],
        marketConfig: {
            supplyDemandWeight: 1.0,
            inventoryTargetDays: 100.0,
            inventoryPriceImpact: 0.3,
            demandElasticity: 0.45,
            outputVariation: 0.2
        }
    },
    chemicals: {
        name: "化学品",
        icon: 'Beaker',
        color: "text-green-400",
        basePrice: 18.0,
        minPrice: 0.18,
        maxPrice: 1800,
        defaultOwner: 'engineer',
        unlockEpoch: 7,
        unlockTech: 'organic_chemistry',
        tags: ['intermediate', 'industrial'],
        marketConfig: {
            supplyDemandWeight: 1.1,
            inventoryTargetDays: 90.0,
            inventoryPriceImpact: 0.3,
            demandElasticity: 0.5,
            outputVariation: 0.2
        }
    },
    wiring: {
        name: "电缆",
        icon: 'Zap',
        color: "text-yellow-500",
        basePrice: 14.0,
        minPrice: 0.14,
        maxPrice: 1400,
        defaultOwner: 'engineer',
        unlockEpoch: 7,
        unlockTech: 'electrical_wiring',
        tags: ['intermediate', 'industrial'],
        marketConfig: {
            supplyDemandWeight: 1.0,
            inventoryTargetDays: 80.0,
            inventoryPriceImpact: 0.3,
            demandElasticity: 0.5,
            outputVariation: 0.2
        }
    },
    electricity: {
        name: "电力",
        icon: 'Zap',
        color: "text-yellow-300",
        basePrice: 10.0,
        minPrice: 0.1,
        maxPrice: 500,
        defaultOwner: 'engineer',
        unlockEpoch: 7,
        unlockTech: 'power_generation',
        tags: ['industrial', 'energy'],
        storageMode: 'volatile',
        maxInventoryDays: 0.75,
        minOperationalBuffer: 1,
        allowForeignTrade: false,
        // 电力仍走国内市场，但更接近即时供能资源
        marketConfig: {
            supplyDemandWeight: 0.8,
            inventoryTargetDays: 0.35,
            inventoryPriceImpact: 0.2,
            demandElasticity: 0.3,
            outputVariation: 0.15
        }
    },
    machinery: {
        name: "机械",
        icon: 'Cog',
        color: "text-zinc-400",
        basePrice: 25.0,
        minPrice: 0.25,
        maxPrice: 2500,
        defaultOwner: 'engineer',
        unlockEpoch: 7,
        unlockTech: 'mechanical_engineering',
        tags: ['intermediate', 'industrial'],
        marketConfig: {
            supplyDemandWeight: 1.0,
            inventoryTargetDays: 80.0,
            inventoryPriceImpact: 0.3,
            demandElasticity: 0.5,
            outputVariation: 0.2
        }
    },
    synthetic_fiber: {
        name: "化纤",
        icon: 'Layers',
        color: "text-purple-400",
        basePrice: 18.0,
        minPrice: 0.18,
        maxPrice: 1800,
        defaultOwner: 'capitalist',
        unlockEpoch: 7,
        unlockTech: 'synthetic_chemistry',
        tags: ['industrial', 'manufactured'],
        marketConfig: {
            supplyDemandWeight: 1.0,
            inventoryTargetDays: 80.0,
            inventoryPriceImpact: 0.3,
            demandElasticity: 0.5,
            outputVariation: 0.2
        }
    },
    fertilizer: {
        name: "化肥",
        icon: 'Sprout',
        color: "text-green-400",
        basePrice: 15.0,
        minPrice: 0.15,
        maxPrice: 2250,
        defaultOwner: 'engineer',
        unlockEpoch: 7,
        unlockTech: 'synthetic_fertilizer',
        tags: ['industrial', 'agricultural'],
        marketConfig: {
            supplyDemandWeight: 1.0,
            inventoryTargetDays: 90.0,
            inventoryPriceImpact: 0.3,
            demandElasticity: 0.5,
            outputVariation: 0.2
        }
    },
    automobile: {
        name: "汽车",
        icon: 'Car',
        color: "text-blue-400",
        basePrice: 150.0,
        minPrice: 1.5,
        maxPrice: 15000,
        defaultOwner: 'capitalist',
        unlockEpoch: 7,
        unlockTech: 'automobile_manufacturing',
        tags: ['luxury', 'manufactured', 'transportation'],
        marketConfig: {
            supplyDemandWeight: 1.4,
            inventoryTargetDays: 30.0,
            inventoryPriceImpact: 0.4,
            demandElasticity: 1.2,
            outputVariation: 0.2
        }
    },

    // ============ 原子时代 (Epoch 8) 新增资源 ============
    plastics: {
        name: "塑料",
        icon: 'Package',
        color: "text-blue-300",
        basePrice: 15.0,
        minPrice: 0.15,
        maxPrice: 1500,
        defaultOwner: 'engineer',
        unlockEpoch: 8,
        unlockTech: 'polymer_chemistry',
        tags: ['intermediate', 'industrial'],
        marketConfig: {
            supplyDemandWeight: 1.0,
            inventoryTargetDays: 90.0,
            inventoryPriceImpact: 0.3,
            demandElasticity: 0.5,
            outputVariation: 0.2
        }
    },
    electronics: {
        name: "电子元件",
        icon: 'Cpu',
        color: "text-emerald-300",
        basePrice: 40.0,
        minPrice: 0.4,
        maxPrice: 4000,
        defaultOwner: 'engineer',
        unlockEpoch: 8,
        unlockTech: 'integrated_circuits',
        tags: ['intermediate', 'manufactured'],
        marketConfig: {
            supplyDemandWeight: 1.2,
            inventoryTargetDays: 60.0,
            inventoryPriceImpact: 0.35,
            demandElasticity: 0.6,
            outputVariation: 0.2
        }
    },
    uranium: {
        name: "铀矿",
        icon: 'Atom',
        color: "text-lime-400",
        basePrice: 12.0,
        minPrice: 0.12,
        maxPrice: 1200,
        defaultOwner: 'official',
        unlockEpoch: 8,
        unlockTech: 'nuclear_physics',
        tags: ['raw_material', 'strategic'],
        marketConfig: {
            supplyDemandWeight: 0.8,
            inventoryTargetDays: 180.0,
            inventoryPriceImpact: 0.2,
            demandElasticity: 0.3,
            outputVariation: 0.15
        }
    },
    aluminum: {
        name: "铝材",
        icon: 'Layers',
        color: "text-slate-300",
        basePrice: 22.0,
        minPrice: 0.22,
        maxPrice: 2200,
        defaultOwner: 'engineer',
        unlockEpoch: 8,
        unlockTech: 'aluminum_smelting',
        tags: ['intermediate', 'industrial'],
        marketConfig: {
            supplyDemandWeight: 1.0,
            inventoryTargetDays: 80.0,
            inventoryPriceImpact: 0.3,
            demandElasticity: 0.5,
            outputVariation: 0.2
        }
    },
    medicine: {
        name: "医药",
        icon: 'Syringe',
        color: "text-red-300",
        basePrice: 35.0,
        minPrice: 0.35,
        maxPrice: 3500,
        defaultOwner: 'engineer',
        unlockEpoch: 8,
        unlockTech: 'pharmaceutical_industry',
        tags: ['manufactured', 'consumer'],
        marketConfig: {
            supplyDemandWeight: 1.1,
            inventoryTargetDays: 60.0,
            inventoryPriceImpact: 0.35,
            demandElasticity: 0.7,
            outputVariation: 0.2
        }
    },

    // ============ 信息时代 (Epoch 9) 新增资源 ============
    semiconductors: {
        name: "半导体",
        icon: 'Cpu',
        color: "text-teal-300",
        basePrice: 80.0,
        minPrice: 0.8,
        maxPrice: 8000,
        defaultOwner: 'engineer',
        unlockEpoch: 9,
        unlockTech: 'semiconductor_manufacturing',
        tags: ['manufactured', 'high_tech'],
        marketConfig: {
            supplyDemandWeight: 1.3,
            inventoryTargetDays: 40.0,
            inventoryPriceImpact: 0.4,
            demandElasticity: 0.7,
            outputVariation: 0.2
        }
    },
    software: {
        name: "软件",
        icon: 'Code',
        color: "text-blue-400",
        basePrice: 50.0,
        minPrice: 0.5,
        maxPrice: 5000,
        defaultOwner: 'capitalist',
        unlockEpoch: 9,
        unlockTech: 'software_engineering',
        tags: ['manufactured', 'high_tech'],
        marketConfig: {
            supplyDemandWeight: 1.2,
            inventoryTargetDays: 50.0,
            inventoryPriceImpact: 0.35,
            demandElasticity: 0.8,
            outputVariation: 0.15
        }
    },
    composites: {
        name: "复合材料",
        icon: 'Layers',
        color: "text-indigo-300",
        basePrice: 45.0,
        minPrice: 0.45,
        maxPrice: 4500,
        defaultOwner: 'engineer',
        unlockEpoch: 9,
        unlockTech: 'composite_materials',
        tags: ['manufactured', 'high_tech'],
        marketConfig: {
            supplyDemandWeight: 1.1,
            inventoryTargetDays: 50.0,
            inventoryPriceImpact: 0.35,
            demandElasticity: 0.6,
            outputVariation: 0.2
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
        name: "学识",
        icon: 'Cpu',
        color: "text-cyan-400",
        basePrice: 5,
        minPrice: 0.05,
        maxPrice: 100,  // Special: 20x cap (government controlled)
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
        maxPrice: 40,  // Special: 20x cap
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
/**
 * 战争经济联动常量
 * 控制战争对经济的影响程度
 */
export const WAR_ECONOMY = {
    // 建筑破坏
    BUILDING_DESTROY_BASE_PROBABILITY: 0.35,    // 基础35%每次checkpoint crossing
    MAX_BUILDINGS_DESTROYED_PER_CHECKPOINT: 4,  // 单次最多破坏4座建筑

    // AI侧经济损伤（替代建筑破坏）
    AI_WEALTH_LOSS_ECONOMIC: 0.04,   // 经济区每次checkpoint扣减wealth×4%
    AI_WEALTH_LOSS_CAPITAL: 0.08,    // 核心区每次checkpoint扣减wealth×8%
    AI_MILSTR_LOSS_CAPITAL: 0.08,    // 核心区每次扣减militaryStrength 0.08

    // 人口流失（每次checkpoint crossing）
    POP_LOSS_FRONTIER: 0.02,     // 前沿：2%
    POP_LOSS_ECONOMIC: 0.04,     // 经济区：4%
    POP_LOSS_CAPITAL: 0.06,      // 核心区：6%

    // 财富掠夺（每tick）
    PLUNDER_RATE_ECONOMIC: 0.05,    // 经济区：wealth×5%/tick
    PLUNDER_RATE_CAPITAL: 0.10,     // 核心区：wealth×10%/tick
    PLUNDER_GAIN_RATIO: 0.6,       // 入侵方获得掠夺的60%

    // 贸易中断
    TRADE_DISRUPTION_PER_WAR: 0.15, // 每场战争减少15%贸易量
    TRADE_DISRUPTION_MAX: 0.45,     // 最高45%

    // 军工繁荣
    MILITARY_INDUSTRY_BOOST: 0.20,  // 战时军事类建筑产出+20%
    MINING_INDUSTRY_BOOST: 0.10,    // 战时采矿类建筑产出+10%

    // 腹地沦陷惩罚（linePos<=8 或 >=92）
    HINTERLAND_EXTRA_PRODUCTION_PENALTY: 0.20,   // 额外+20%产出惩罚
    HINTERLAND_EXTRA_INCOME_PENALTY_RATIO: 0.30, // 额外+30%银币收入惩罚
    MAX_PRODUCTION_PENALTY: 0.55,                 // 总产出惩罚上限从0.35提到0.55

    // 军费预算制
    WAR_BUDGET_RATIO: 0.25,     // 战时军费预算占wealth比例
    PEACE_BUDGET_RATIO: 0.15,   // 和平时军费预算占wealth比例
    MIN_ARMY_FLOOR: 10,         // 极端情况保底兵力

    // AI战后恢复
    AI_POST_WAR_WEALTH_RECOVERY: 0.001,  // 战后每tick恢复wealth×0.1%

    // 反向掠夺 & 多场景掠夺
    REVERSE_PLUNDER_EFFICIENCY: 0.6,           // AI掠夺玩家的效率系数（玩家掠夺的60%）
    AI_AI_PLUNDER_EFFICIENCY: 0.5,             // AI-AI间持续掠夺的效率系数
    RESOURCE_PLUNDER_RATE_ECONOMIC: 0.02,      // 经济区实物资源掠夺率/tick
    RESOURCE_PLUNDER_RATE_CAPITAL: 0.04,       // 核心区实物资源掠夺率/tick
    MAX_RESOURCE_TYPES_PLUNDERED: 3,           // 每次摩擦最多掠夺的资源种类数
    PLUNDER_SILVER_FLOOR_RATIO: 0.2,           // 玩家被掠夺后保留的最低银币比例
};

/**
 * AI 时代演进常量
 * 控制 AI 国家科技/文化累积速度与时代升级门槛
 */
export const AI_EPOCH_PROGRESSION = {
    // 分时代科技需求缩放系数（AI 需要的科技点 = 玩家需求 × 此系数）
    // 提高系数以减慢AI升时代速度，防止50年内到达信息时代
    SCIENCE_SCALE_BY_EPOCH: {
        1: 1.20,  // 青铜时代
        2: 1.10,  // 古典时代
        3: 1.00,  // 封建时代
        4: 0.90,  // 探索时代
        5: 0.80,  // 启蒙时代
        6: 0.70,  // 工业时代
        7: 0.60,  // 电气时代
        8: 0.55,  // 原子时代
        9: 0.50,  // 信息时代
    },
    // 文化需求缩放系数（文化增长较慢，系数略高于科技）
    CULTURE_SCALE_BY_EPOCH: {
        1: 0.00,  // 青铜时代无文化需求
        2: 1.20,  // 古典时代
        3: 1.10,  // 封建时代
        4: 1.00,  // 探索时代
        5: 0.90,  // 启蒙时代
        6: 0.80,  // 工业时代
        7: 0.70,  // 电气时代
        8: 0.65,  // 原子时代
        9: 0.60,  // 信息时代
    },
    // 时代升级冷却（tick 数）：从200提高到600（约1.6年），防止连续快速升级
    EPOCH_COOLDOWN: 600,
    // 科技/文化累积的 tick 缩放因子（每个 heavy update 周期约 10 tick）
    // 从1.0降低到0.4，减慢科技累积速率
    ACCUM_TICK_SCALE: 0.4,
    // 战时科技累积惩罚（战争中科技积累速率 = 1 - 此值）
    WAR_SCIENCE_PENALTY: 0.4,
    // 战时文化累积惩罚
    WAR_CULTURE_PENALTY: 0.3,
};

/**
 * AI 战争决策常量
 * 控制 AI 战争目标、备战期和战争疲劳
 */
export const AI_WAR_DECISION = {
    // 战争目标类型及其最低军力优势比
    WAR_GOALS: {
        tribute:      { id: 'tribute',      minPowerRatio: 1.3, fatigueThreshold: 0.4 },
        vassal:       { id: 'vassal',       minPowerRatio: 1.8, fatigueThreshold: 0.65 },
        annex_border: { id: 'annex_border', minPowerRatio: 1.5, fatigueThreshold: 0.6 },
        preemptive:   { id: 'preemptive',   minPowerRatio: 1.0, fatigueThreshold: 0.5 },
        revenge:      { id: 'revenge',      minPowerRatio: 0.8, fatigueThreshold: 0.8 },
        defense:      { id: 'defense',      minPowerRatio: 0,   fatigueThreshold: 0.7 },
    },
    // 备战期基础长度（tick）
    PREPARATION_BASE_TICKS: 80,
    // 备战期侵略性缩放（低侵略性 → 更长备战期）
    PREPARATION_AGGRESSION_SCALE: 120,
    // 备战期军事建筑配比加成
    PREPARATION_MILITARY_BOOST: 0.4,
    // 备战期食物库存目标加成
    PREPARATION_FOOD_STOCKPILE_BOOST: 0.5,
    // 战争疲劳累积速率 - 军力损失维度
    FATIGUE_MILITARY_LOSS_RATE: 0.1,
    // 战争疲劳累积速率 - 财富损失维度
    FATIGUE_WEALTH_LOSS_RATE: 0.05,
    // 备战取消条件：军力比低于目标的此比例时取消备战
    PREPARATION_CANCEL_RATIO: 0.7,
};

export const TAX_LIMITS = {
    MAX_HEAD_TAX: 1000000,      // 人头税系数上限
    MAX_RESOURCE_TAX: 5.0,    // 交易税率上限 (500%)
    MAX_BUSINESS_TAX: 10000,   // 营业税系数上限，防止极端负税率导致补贴爆炸
};
