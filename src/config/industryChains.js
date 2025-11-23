/**
 * 产业链系统配置
 * 定义资源的生产、加工、消费关系
 * 建立完整的产业上下游网络
 */

/**
 * 产业链节点类型
 * - extraction: 原材料采集
 * - processing: 加工制造
 * - advanced: 高级制造
 * - consumption: 最终消费
 */

/**
 * 产业链配置
 * 每个产业链包含：
 * - id: 产业链唯一标识
 * - name: 产业链名称
 * - desc: 产业链描述
 * - stages: 产业链各阶段
 * - unlockEpoch: 解锁时代
 * - efficiency: 产业链效率加成
 */
export const INDUSTRY_CHAINS = {
  // ========== 基础产业链 ==========
  food_chain: {
    id: 'food_chain',
    name: "粮食产业链",
    desc: "从农田到餐桌的完整粮食生产体系",
    unlockEpoch: 0,
    stages: [
      {
        stage: 'extraction',
        name: "农业生产",
        buildings: ['farm', 'large_estate'],
        output: 'food',
        efficiency: 1.0,
        workers: ['peasant', 'serf'],
      },
      {
        stage: 'storage',
        name: "粮食储存",
        buildings: ['granary'],
        input: 'food',
        output: 'food',
        efficiency: 1.1,
        bonus: { preservation: 0.05 },
      },
      {
        stage: 'processing',
        name: "烹饪加工",
        buildings: ['culinary_kitchen'],
        input: 'food',
        output: 'delicacies',
        ratio: 1.6,
        efficiency: 1.0,
        workers: ['artisan', 'peasant'],
      },
      {
        stage: 'consumption',
        name: "民众消费",
        consumers: ['all_classes'],
        input: 'food',
      },
      {
        stage: 'consumption',
        name: "上层享用",
        consumers: ['merchant', 'official', 'landowner', 'capitalist', 'knight'],
        input: 'delicacies',
        bonus: { approval: 0.1, stability: 0.05 },
      }
    ],
    upgrades: [
      {
        id: 'irrigation',
        name: "灌溉系统",
        unlockEpoch: 1,
        cost: { stone: 200, wood: 150 },
        bonus: { efficiency: 0.15, output: 0.1 },
      },
      {
        id: 'crop_rotation',
        name: "轮作制度",
        unlockEpoch: 2,
        cost: { science: 500 },
        bonus: { efficiency: 0.2, sustainability: 0.15 },
      },
      {
        id: 'mechanized_farming',
        name: "机械化农业",
        unlockEpoch: 6,
        cost: { steel: 300, tools: 200 },
        bonus: { efficiency: 0.4, workers: -0.3 },
      }
    ],
  },

  wood_chain: {
    id: 'wood_chain',
    name: "木材产业链",
    desc: "从森林采伐到木制品加工的完整体系",
    unlockEpoch: 0,
    stages: [
      {
        stage: 'extraction',
        name: "森林采伐",
        buildings: ['lumber_camp'],
        output: 'wood',
        efficiency: 1.0,
        workers: ['lumberjack'],
      },
      {
        stage: 'processing',
        name: "木材加工",
        buildings: ['sawmill'],
        input: 'wood',
        output: 'plank',
        ratio: 2.5,
        efficiency: 1.0,
        workers: ['worker', 'artisan'],
      },
      {
        stage: 'advanced',
        name: "家具制作",
        buildings: ['furniture_workshop'],
        input: ['wood', 'stone'],
        output: 'furniture',
        ratio: 2.2,
        efficiency: 1.0,
        workers: ['artisan'],
      },
      {
        stage: 'consumption',
        name: "建筑与制造",
        consumers: ['buildings', 'ships', 'tools'],
        input: ['wood', 'plank'],
      },
      {
        stage: 'consumption',
        name: "上层居住",
        consumers: ['merchant', 'official', 'landowner', 'capitalist', 'knight'],
        input: 'furniture',
        bonus: { approval: 0.08, culture: 0.05 },
      }
    ],
    upgrades: [
      {
        id: 'forestry_management',
        name: "林业管理",
        unlockEpoch: 2,
        cost: { science: 400, silver: 200 },
        bonus: { efficiency: 0.15, sustainability: 0.2 },
      },
      {
        id: 'advanced_sawmill',
        name: "先进锯木厂",
        unlockEpoch: 4,
        cost: { iron: 150, tools: 100 },
        bonus: { processing: 0.25, waste: -0.15 },
      }
    ],
  },

  textile_chain: {
    id: 'textile_chain',
    name: "布料产业链",
    desc: "以布料为核心的生活必需产业，从纺织到成衣。",
    unlockEpoch: 0,
    stages: [
      {
        stage: 'extraction',
        name: "纤维采集",
        buildings: ['loom_house'],
        output: 'cloth',
        efficiency: 1.0,
        workers: ['peasant'],
      },
      {
        stage: 'processing',
        name: "成衣制作",
        buildings: ['tailor_workshop'],
        input: 'cloth',
        output: 'cloth',
        ratio: 1.4,
        efficiency: 1.0,
        workers: ['artisan'],
      },
      {
        stage: 'consumption',
        name: "全民衣物",
        consumers: ['all_classes'],
        input: 'cloth',
        bonus: { approval: 0.05, stability: 0.02 },
      }
    ],
    upgrades: [
      {
        id: 'loom_standardization',
        name: "织机规制",
        unlockEpoch: 1,
        cost: { wood: 80, stone: 30 },
        bonus: { efficiency: 0.2, quality: 0.15 },
      },
      {
        id: 'dyeworks_expansion',
        name: "染坊扩建",
        unlockEpoch: 2,
        cost: { papyrus: 60, silver: 150 },
        bonus: { culture: 0.15, value: 0.2 },
      }
    ],
  },

  mining_chain: {
    id: 'mining_chain',
    name: "采矿产业链",
    desc: "从矿石开采到金属冶炼的完整工业体系",
    unlockEpoch: 1,
    stages: [
      {
        stage: 'extraction',
        name: "矿石开采",
        buildings: ['quarry', 'copper_mine', 'mine', 'coal_mine'],
        output: ['stone', 'copper', 'iron', 'coal'],
        efficiency: 1.0,
        workers: ['miner'],
      },
      {
        stage: 'processing',
        name: "初级冶炼",
        buildings: ['smelter', 'forge'],
        input: ['copper', 'iron', 'coal'],
        output: ['tools', 'steel'],
        efficiency: 1.0,
        workers: ['artisan', 'engineer'],
      },
      {
        stage: 'advanced',
        name: "精密制造",
        buildings: ['factory', 'steel_mill'],
        input: ['iron', 'coal', 'tools'],
        output: 'steel',
        efficiency: 1.0,
        workers: ['engineer', 'worker'],
      },
      {
        stage: 'consumption',
        name: "工业应用",
        consumers: ['military', 'buildings', 'machinery'],
        input: ['tools', 'steel', 'iron'],
      }
    ],
    upgrades: [
      {
        id: 'deep_mining',
        name: "深井采矿",
        unlockEpoch: 3,
        cost: { iron: 200, tools: 150 },
        bonus: { extraction: 0.25, depth: 2 },
      },
      {
        id: 'blast_furnace',
        name: "高炉技术",
        unlockEpoch: 5,
        cost: { brick: 300, coal: 200 },
        bonus: { processing: 0.35, efficiency: 0.2 },
      },
      {
        id: 'industrial_complex',
        name: "工业综合体",
        unlockEpoch: 6,
        cost: { steel: 500, coal: 400 },
        bonus: { efficiency: 0.5, output: 0.3 },
      }
    ],
  },

  // ========== 文化产业链 ==========
  knowledge_chain: {
    id: 'knowledge_chain',
    name: "知识产业链",
    desc: "从纸张生产到知识传播的文化体系",
    unlockEpoch: 2,
    stages: [
      {
        stage: 'extraction',
        name: "纸张生产",
        buildings: ['reed_works'],
        output: 'papyrus',
        efficiency: 1.0,
        workers: ['peasant', 'scribe'],
      },
      {
        stage: 'processing',
        name: "知识记录",
        buildings: ['library', 'scriptorium'],
        input: 'papyrus',
        output: 'culture',
        efficiency: 1.0,
        workers: ['scribe', 'scholar'],
      },
      {
        stage: 'advanced',
        name: "知识传播",
        buildings: ['printing_house', 'university'],
        input: ['papyrus', 'culture'],
        output: ['culture', 'science'],
        efficiency: 1.2,
        workers: ['scholar', 'scribe'],
      },
      {
        stage: 'consumption',
        name: "社会应用",
        consumers: ['education', 'research', 'administration'],
        input: ['culture', 'science'],
      }
    ],
    upgrades: [
      {
        id: 'printing_press',
        name: "印刷机",
        unlockEpoch: 5,
        cost: { iron: 150, tools: 100 },
        bonus: { efficiency: 0.4, spread: 0.5 },
      },
      {
        id: 'public_library',
        name: "公共图书馆",
        unlockEpoch: 4,
        cost: { brick: 300, papyrus: 200 },
        bonus: { access: 0.3, culture: 0.2 },
      }
    ],
  },

  // ========== 奢侈品产业链 ==========
  luxury_chain: {
    id: 'luxury_chain',
    name: "奢侈品产业链",
    desc: "从香料种植到奢侈品贸易的高端产业",
    unlockEpoch: 4,
    stages: [
      {
        stage: 'extraction',
        name: "原料采集",
        buildings: ['spice_market', 'coffee_plantation'],
        output: ['spice', 'coffee'],
        efficiency: 1.0,
        workers: ['merchant', 'serf'],
      },
      {
        stage: 'processing',
        name: "精加工",
        buildings: ['coffee_house', 'trade_port'],
        input: ['spice', 'coffee'],
        output: 'culture',
        efficiency: 1.0,
        workers: ['merchant', 'artisan'],
      },
      {
        stage: 'consumption',
        name: "上层消费",
        consumers: ['noble', 'merchant', 'scholar'],
        input: ['spice', 'coffee'],
        bonus: { approval: 0.15 },
      }
    ],
    upgrades: [
      {
        id: 'trade_network',
        name: "贸易网络",
        unlockEpoch: 5,
        cost: { silver: 500, plank: 200 },
        bonus: { efficiency: 0.3, price: 0.2 },
      },
      {
        id: 'luxury_monopoly',
        name: "奢侈品垄断",
        unlockEpoch: 5,
        cost: { silver: 800 },
        bonus: { profit: 0.5, influence: 0.25 },
      }
    ],
  },

  // ========== 军事产业链 ==========
  military_chain: {
    id: 'military_chain',
    name: "军事产业链",
    desc: "从武器制造到军队维护的完整军事体系",
    unlockEpoch: 1,
    stages: [
      {
        stage: 'extraction',
        name: "原料供应",
        buildings: ['mine', 'copper_mine'],
        output: ['iron', 'copper'],
        efficiency: 1.0,
        workers: ['miner'],
      },
      {
        stage: 'processing',
        name: "武器制造",
        buildings: ['forge', 'armory'],
        input: ['iron', 'copper', 'coal'],
        output: 'weapons',
        efficiency: 1.0,
        workers: ['artisan', 'engineer'],
      },
      {
        stage: 'advanced',
        name: "军队训练",
        buildings: ['barracks', 'training_ground'],
        input: ['weapons', 'food'],
        output: 'military_power',
        efficiency: 1.0,
        workers: ['soldier'],
      },
      {
        stage: 'consumption',
        name: "军事行动",
        consumers: ['defense', 'conquest', 'patrol'],
        input: ['military_power', 'food', 'silver'],
      }
    ],
    upgrades: [
      {
        id: 'standardized_weapons',
        name: "标准化武器",
        unlockEpoch: 4,
        cost: { iron: 300, tools: 200 },
        bonus: { efficiency: 0.25, cost: -0.15 },
      },
      {
        id: 'military_logistics',
        name: "军事后勤",
        unlockEpoch: 5,
        cost: { silver: 600, plank: 300 },
        bonus: { supply: 0.3, mobility: 0.2 },
      },
      {
        id: 'arms_factory',
        name: "军工厂",
        unlockEpoch: 6,
        cost: { steel: 400, coal: 300 },
        bonus: { production: 0.5, quality: 0.3 },
      }
    ],
  },
};

/**
 * 产业链效率加成系统
 * 当产业链各环节协同工作时，提供额外加成
 */
export const CHAIN_SYNERGIES = {
  // 完整产业链加成
  complete_chain: {
    name: "完整产业链",
    desc: "产业链各环节齐全时获得效率加成",
    bonus: { efficiency: 0.2, output: 0.15 },
  },
  
  // 专业化加成
  specialization: {
    name: "产业专业化",
    desc: "专注发展某一产业链时获得额外加成",
    bonus: { efficiency: 0.25, quality: 0.2 },
  },
  
  // 规模经济
  economy_of_scale: {
    name: "规模经济",
    desc: "同类建筑数量达到一定规模时降低成本",
    thresholds: [
      { count: 5, bonus: { cost: -0.1 } },
      { count: 10, bonus: { cost: -0.2, efficiency: 0.1 } },
      { count: 20, bonus: { cost: -0.3, efficiency: 0.2 } },
    ],
  },
  
  // 技术外溢
  tech_spillover: {
    name: "技术外溢",
    desc: "高级产业带动相关产业发展",
    bonus: { related_efficiency: 0.15 },
  },
};

/**
 * 产业链瓶颈系统
 * 当某个环节产能不足时，整个产业链效率下降
 */
export const CHAIN_BOTTLENECKS = {
  resource_shortage: {
    name: "资源短缺",
    desc: "原材料供应不足",
    penalty: { efficiency: -0.3, output: -0.25 },
  },
  
  processing_limit: {
    name: "加工瓶颈",
    desc: "加工能力不足",
    penalty: { efficiency: -0.25, waste: 0.15 },
  },
  
  labor_shortage: {
    name: "劳动力短缺",
    desc: "工人数量不足",
    penalty: { efficiency: -0.4, output: -0.3 },
  },
  
  infrastructure_limit: {
    name: "基础设施限制",
    desc: "运输和储存能力不足",
    penalty: { efficiency: -0.2, cost: 0.15 },
  },
};

/**
 * 产业链发展路径
 * 定义产业链的升级和演化方向
 */
export const CHAIN_DEVELOPMENT_PATHS = {
  food_chain: {
    paths: [
      {
        id: 'intensive_farming',
        name: "集约化农业",
        desc: "提高单位面积产量",
        requirements: { epoch: 3, tech: ['crop_rotation', 'fertilizer'] },
        effects: { output: 0.4, efficiency: 0.25 },
      },
      {
        id: 'extensive_farming',
        name: "粗放式农业",
        desc: "扩大种植面积",
        requirements: { epoch: 2, land: 50 },
        effects: { output: 0.3, workers: 0.2 },
      },
    ],
  },
  
  mining_chain: {
    paths: [
      {
        id: 'heavy_industry',
        name: "重工业化",
        desc: "发展大规模工业生产",
        requirements: { epoch: 6, buildings: { factory: 5, steel_mill: 3 } },
        effects: { output: 0.5, efficiency: 0.3, pollution: 0.4 },
      },
      {
        id: 'precision_manufacturing',
        name: "精密制造",
        desc: "专注高质量产品",
        requirements: { epoch: 5, tech: ['precision_tools'], workers: { engineer: 10 } },
        effects: { quality: 0.5, efficiency: 0.2, cost: 0.15 },
      },
    ],
  },
  
  knowledge_chain: {
    paths: [
      {
        id: 'mass_education',
        name: "大众教育",
        desc: "普及教育，提升整体素质",
        requirements: { epoch: 5, buildings: { university: 2 } },
        effects: { culture: 0.4, science: 0.3, population_quality: 0.25 },
      },
      {
        id: 'elite_research',
        name: "精英研究",
        desc: "集中资源培养顶尖人才",
        requirements: { epoch: 4, workers: { scholar: 15 } },
        effects: { science: 0.6, tech_speed: 0.3, cost: 0.3 },
      },
    ],
  },

  textile_chain: {
    paths: [
      {
        id: 'guild_textiles',
        name: "织造行会",
        desc: "以行会形式统一布料标准，提升品质。",
        requirements: { epoch: 2, buildings: { tailor_workshop: 3 } },
        effects: { quality: 0.25, efficiency: 0.2, value: 0.2 },
      },
      {
        id: 'proto_industrial_looms',
        name: "家族工场",
        desc: "以家庭作坊串联成网络，形成原始工业体系。",
        requirements: { epoch: 3, workers: { artisan: 12, worker: 6 } },
        effects: { output: 0.35, stability: 0.05 },
      },
    ],
  },
};

/**
 * 产业链与国家特性的联动
 * 不同国家对产业链有不同的加成
 */
export const CHAIN_NATION_BONUSES = {
  steppe_horde: {
    chains: {
      food_chain: { efficiency: 0.15 },
      military_chain: { efficiency: 0.25, cost: -0.15 },
    },
  },
  
  desert_caravan: {
    chains: {
      luxury_chain: { efficiency: 0.3, profit: 0.25 },
    },
  },
  
  silk_empire: {
    chains: {
      knowledge_chain: { efficiency: 0.25 },
      luxury_chain: { efficiency: 0.2 },
      textile_chain: { efficiency: 0.3, quality: 0.25 },
    },
  },
  
  industrial_consortium: {
    chains: {
      mining_chain: { efficiency: 0.35, output: 0.25 },
    },
  },
};

/**
 * 产业链与政令的联动
 * 政令可以影响产业链效率
 */
export const CHAIN_DECREE_EFFECTS = {
  guild_charter: {
    affects: ['wood_chain', 'mining_chain', 'textile_chain'],
    bonus: { efficiency: 0.15, quality: 0.1 },
  },
  
  free_trade: {
    affects: ['luxury_chain'],
    bonus: { profit: 0.25, efficiency: 0.15 },
  },
  
  infrastructure_plan: {
    affects: ['all_chains'],
    bonus: { efficiency: 0.2, bottleneck_reduction: 0.25 },
  },
  
  war_economy: {
    affects: ['military_chain'],
    bonus: { efficiency: 0.5, output: 0.4 },
    penalty: { other_chains: { efficiency: -0.2 } },
  },
};
