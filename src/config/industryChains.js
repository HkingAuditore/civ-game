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
        stage: 'processing',
        name: "酿造加工",
        buildings: ['brewery', 'monastery_cellar'],
        input: 'food',
        output: 'ale',
        ratio: 1.4,
        efficiency: 1.0,
        workers: ['worker', 'cleric'],
      },
      {
        stage: 'consumption',
        name: "民众消费",
        consumers: ['all_classes'],
        input: 'food',
      },
      {
        stage: 'consumption',
        name: "饮品消费",
        consumers: ['all_classes'],
        input: 'ale',
      },
      {
        stage: 'consumption',
        name: "上层享用",
        consumers: ['merchant', 'official', 'landowner', 'capitalist'],
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
        consumers: ['merchant', 'official', 'landowner', 'capitalist'],
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
    name: "纺织与华服产业链",
    desc: "织布、染料与华服生产构成的多层级衣物供应体系。",
    unlockEpoch: 0,
    stages: [
      {
        stage: 'extraction',
        name: "纺织生产",
        buildings: ['loom_house'],
        output: 'cloth',
        efficiency: 1.0,
        workers: ['peasant'],
      },
      {
        stage: 'extraction',
        name: "棉花种植",
        buildings: ['cotton_plantation'],
        output: 'cotton',
        efficiency: 1.0,
        workers: ['serf', 'merchant'],
      },
      {
        stage: 'processing',
        name: "棉纺织",
        buildings: ['cotton_weaving_house'],
        input: 'cotton',
        output: ['cloth', 'fine_clothes'],
        efficiency: 1.2,
        workers: ['worker', 'artisan'],
      },
      {
        stage: 'processing',
        name: "染料提取",
        buildings: ['dye_works'],
        input: 'food',
        output: 'dye',
        ratio: 0.4,
        efficiency: 1.0,
        workers: ['peasant', 'artisan'],
      },
      {
        stage: 'advanced',
        name: "高级制衣",
        buildings: ['tailor_workshop'],
        input: ['cloth', 'dye'],
        output: 'fine_clothes',
        ratio: 0.8,
        efficiency: 1.0,
        workers: ['artisan'],
        bonus: { culture: 0.1 },
      },
      {
        stage: 'advanced',
        name: "电气纺织",
        buildings: ['electric_textile_mill'],
        input: ['cotton', 'coal', 'dye'],
        output: ['cloth', 'fine_clothes'],
        efficiency: 1.5,
        workers: ['worker', 'engineer', 'capitalist'],
      },
      {
        stage: 'advanced',
        name: "化纤生产",
        buildings: ['synthetic_fiber_plant'],
        input: ['coal', 'steel'],
        output: 'synthetic_fiber',
        efficiency: 1.0,
        workers: ['worker', 'engineer', 'capitalist'],
      },
      {
        stage: 'advanced',
        name: "化纤纺织",
        buildings: ['synthetic_textile_mill'],
        input: ['synthetic_fiber', 'dye'],
        output: 'fine_clothes',
        efficiency: 1.8,
        workers: ['worker', 'engineer', 'capitalist'],
        epochRange: [8, 9],
      },
      {
        stage: 'consumption',
        name: "日常衣物消费",
        consumers: ['all_classes'],
        input: 'cloth',
        bonus: { approval: 0.05, stability: 0.02 },
      },
      {
        stage: 'consumption',
        name: "奢侈服饰消费",
        consumers: ['merchant', 'landowner', 'official', 'capitalist'],
        input: 'fine_clothes',
        bonus: { approval: 0.1, culture: 0.05 },
      }
    ],
    upgrades: [
      {
        id: 'loom_standardization',
        name: "织机规制",
        unlockEpoch: 1,
        cost: { wood: 80, stone: 30 },
        bonus: { cloth_output: 0.2, efficiency: 0.15 },
      },
      {
        id: 'dyeworks_expansion',
        name: "染坊扩建",
        unlockEpoch: 2,
        cost: { papyrus: 60, silver: 150 },
        bonus: { dye_output: 0.25, efficiency: 0.15 },
      },
      {
        id: 'cotton_gin',
        name: "轧棉机",
        unlockEpoch: 5,
        cost: { tools: 100, iron: 80 },
        bonus: { cotton_processing: 0.3, efficiency: 0.2 },
      },
      {
        id: 'synthetic_fabric_tech',
        name: "合成面料技术",
        unlockEpoch: 8,
        cost: { chemicals: 150, science: 800 },
        bonus: { efficiency: 0.35, fine_clothes_output: 0.3 },
      },
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
        buildings: ['bronze_foundry', 'iron_tool_workshop'],
        input: ['copper', 'iron', 'coal'],
        output: ['tools', 'steel'],
        efficiency: 1.0,
        workers: ['artisan', 'engineer'],
      },
      {
        stage: 'advanced',
        name: "精密制造",
        buildings: ['factory', 'steel_foundry', 'steel_works'],
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
      },
      {
        stage: 'advanced',
        name: "电缆制造",
        buildings: ['wiring_factory'],
        input: ['copper', 'rubber'],
        output: 'wiring',
        efficiency: 1.0,
        workers: ['worker', 'artisan', 'engineer'],
      },
      {
        stage: 'advanced',
        name: "铝冶炼",
        buildings: ['aluminum_smelter'],
        input: ['stone', 'coal', 'electricity'],
        output: 'aluminum',
        efficiency: 1.0,
        workers: ['worker', 'technician', 'engineer'],
        epochRange: [8, 9],
      },
      {
        stage: 'advanced',
        name: "自动化采矿",
        buildings: ['automated_mine'],
        input: ['electricity'],
        output: ['copper', 'iron', 'coal', 'stone'],
        efficiency: 2.0,
        workers: ['technician', 'engineer', 'scientist'],
        epochRange: [9, 9],
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
        buildings: ['library'],
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
        consumers: ['education', 'research'],
        input: ['culture', 'science'],
      },
      {
        stage: 'advanced',
        name: "大众传媒",
        buildings: ['broadcast_station'],
        input: ['electricity', 'papyrus'],
        output: ['science', 'culture'],
        efficiency: 1.5,
        workers: ['scribe', 'worker', 'engineer'],
      },
      {
        stage: 'advanced',
        name: "电视传播",
        buildings: ['television_station'],
        input: ['electricity', 'electronics'],
        output: ['culture', 'science'],
        efficiency: 1.8,
        workers: ['scribe', 'technician', 'engineer'],
        epochRange: [8, 9],
      },
      {
        stage: 'advanced',
        name: "互联网",
        buildings: ['internet_platform'],
        input: ['software', 'electricity'],
        output: ['silver', 'culture'],
        efficiency: 2.0,
        workers: ['technician', 'scientist', 'capitalist'],
        epochRange: [9, 9],
      },
      {
        stage: 'advanced',
        name: "前沿科研",
        buildings: ['research_institute'],
        input: ['semiconductors', 'electricity', 'papyrus'],
        output: ['science', 'culture'],
        efficiency: 2.5,
        workers: ['scientist', 'engineer'],
        epochRange: [9, 9],
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
        buildings: ['dockyard', 'coffee_plantation'],
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

  // ========== 军事产业链（按时代演进） ==========
  military_chain: {
    id: 'military_chain',
    name: "军事产业链",
    desc: "从原始武装到工业化军工的多阶段军事生产体系，随时代演进解锁更高级的军事装备",
    unlockEpoch: 0,
    stages: [
      // ---- 第一阶段：原始武装 (Epoch 0-1) ----
      {
        stage: 'extraction',
        name: "原料供应",
        desc: "采集基础矿石和木材，为军备生产提供原材料",
        buildings: ['mine', 'copper_mine', 'quarry', 'lumber_camp'],
        output: ['iron', 'copper', 'wood', 'stone'],
        efficiency: 1.0,
        workers: ['miner', 'lumberjack'],
        epochRange: [0, 9],
      },
      {
        stage: 'primitive',
        name: "原始武装",
        desc: "以基础资源直接武装民兵，无需专业军备生产",
        buildings: ['barracks'],
        input: ['food', 'wood', 'copper'],
        output: 'military_power',
        efficiency: 0.8,
        workers: ['peasant'],
        epochRange: [0, 1],
      },
      // ---- 第二阶段：冷兵器 (Epoch 2-3) ----
      {
        stage: 'processing',
        name: "刀剑锻造",
        desc: "铸剑坊将铁与铜冶炼锻造为制式刀剑",
        buildings: ['swordsmith'],
        input: ['iron', 'copper'],
        output: 'swords',
        ratio: 0.15,
        efficiency: 1.0,
        workers: ['artisan'],
        epochRange: [2, 9],
        unlockTech: 'swordsmithing',
      },
      {
        stage: 'processing',
        name: "铠甲锻造",
        desc: "甲胄工坊将铁与布料加工为重型铠甲",
        buildings: ['armorsmith'],
        input: ['iron', 'cloth'],
        output: 'plate_armor',
        ratio: 0.1,
        efficiency: 1.0,
        workers: ['artisan'],
        epochRange: [3, 9],
        unlockTech: 'armor_forging',
      },
      // ---- 第三阶段：火器时代 (Epoch 4) ----
      {
        stage: 'processing',
        name: "火药制造",
        desc: "火药工坊将�ite石与硫磺混合成黑火药",
        buildings: ['powder_mill'],
        input: ['coal', 'food'],
        output: 'gunpowder',
        ratio: 0.12,
        efficiency: 1.0,
        workers: ['artisan'],
        epochRange: [4, 9],
        unlockTech: 'gunpowder_formula',
      },
      {
        stage: 'advanced',
        name: "火器制造",
        desc: "枪炮作坊将铁与火药组装为早期火器",
        buildings: ['gun_workshop'],
        input: ['iron', 'gunpowder'],
        output: 'muskets',
        ratio: 0.08,
        efficiency: 1.0,
        workers: ['artisan', 'engineer'],
        epochRange: [4, 9],
        unlockTech: 'musket_manufacturing',
      },
      // ---- 第四阶段：步枪与弹药 (Epoch 5) ----
      {
        stage: 'advanced',
        name: "精密枪械",
        desc: "枪械工坊用钢铁和精密工具制造线膛步枪",
        buildings: ['rifle_works'],
        input: ['steel', 'tools'],
        output: 'rifles',
        ratio: 0.06,
        efficiency: 1.0,
        workers: ['engineer'],
        epochRange: [5, 9],
        unlockTech: 'rifle_engineering',
      },
      {
        stage: 'advanced',
        name: "弹药生产",
        desc: "弹药厂将钢铁与火药加工为标准化弹药",
        buildings: ['ammo_factory'],
        input: ['steel', 'gunpowder'],
        output: 'ammunition',
        ratio: 0.15,
        efficiency: 1.0,
        workers: ['worker', 'engineer'],
        epochRange: [5, 9],
        unlockTech: 'rifle_engineering',
      },
      // ---- 第五阶段：工业化军工 (Epoch 6) ----
      {
        stage: 'advanced',
        name: "军事工业化",
        desc: "兵工厂大规模标准化生产制式军火与弹药",
        buildings: ['arms_factory'],
        input: ['steel', 'coal'],
        output: ['ordnance', 'ammunition'],
        ratio: 0.05,
        efficiency: 1.2,
        workers: ['engineer', 'worker'],
        epochRange: [6, 9],
        unlockTech: 'military_industrialization',
      },
      // ---- 第六阶段：电子化军工 (Epoch 8) ----
      {
        stage: 'advanced',
        name: "军工综合体",
        desc: "融合电子、化工与钢铁的现代军工综合体，生产精密武器装备",
        buildings: ['military_industrial_complex'],
        input: ['electronics', 'steel', 'chemicals'],
        output: ['ordnance'],
        ratio: 0.04,
        efficiency: 1.5,
        workers: ['engineer', 'technician', 'worker'],
        epochRange: [8, 9],
        unlockTech: 'military_electronics',
      },
      // ---- 军事训练与部署 ----
      {
        stage: 'training',
        name: "军队训练",
        desc: "军事设施将装备和人员转化为战斗力",
        buildings: ['barracks', 'training_ground', 'fortress'],
        input: ['food', 'silver'],
        output: 'military_power',
        efficiency: 1.0,
        workers: ['soldier'],
        epochRange: [0, 9],
      },
      // ---- 最终消耗 ----
      {
        stage: 'consumption',
        name: "军事行动",
        desc: "战场消耗军备物资——火器部队尤其需要持续的弹药补给",
        consumers: ['defense', 'conquest', 'patrol'],
        input: ['military_power', 'food', 'silver', 'ammunition', 'gunpowder'],
        epochRange: [0, 9],
      }
    ],
    upgrades: [
      {
        id: 'bronze_standardization',
        name: "铜器标准化",
        unlockEpoch: 1,
        cost: { copper: 150, wood: 100 },
        bonus: { efficiency: 0.1, cost: -0.05 },
      },
      {
        id: 'forge_mastery',
        name: "锻造精通",
        unlockEpoch: 2,
        cost: { iron: 200, copper: 100 },
        bonus: { efficiency: 0.2, swords_output: 0.15 },
      },
      {
        id: 'gunpowder_refinement',
        name: "火药精炼",
        unlockEpoch: 4,
        cost: { iron: 300, coal: 200 },
        bonus: { efficiency: 0.25, gunpowder_output: 0.2 },
      },
      {
        id: 'military_logistics',
        name: "军事后勤",
        unlockEpoch: 5,
        cost: { silver: 600, plank: 300 },
        bonus: { supply: 0.3, mobility: 0.2, ammunition_output: 0.15 },
      },
      {
        id: 'industrial_arsenal',
        name: "工业兵工厂",
        unlockEpoch: 6,
        cost: { steel: 400, coal: 300 },
        bonus: { production: 0.5, quality: 0.3, ordnance_output: 0.25 },
      }
    ],
  },

  // ========== 电气时代新增产业链 ==========
  power_chain: {
    id: 'power_chain',
    name: "电力产业链",
    desc: "从煤炭采掘到电力发电和传输的能源体系",
    unlockEpoch: 7,
    stages: [
      {
        stage: 'extraction',
        name: "煤炭采掘",
        buildings: ['coal_mine'],
        output: 'coal',
        efficiency: 1.0,
        workers: ['miner'],
      },
      {
        stage: 'processing',
        name: "燃煤发电",
        buildings: ['coal_power_plant'],
        input: 'coal',
        output: 'electricity',
        efficiency: 1.0,
        workers: ['worker', 'engineer'],
      },
      {
        stage: 'advanced',
        name: "电力传输",
        buildings: ['wiring_factory'],
        input: ['copper', 'rubber'],
        output: 'wiring',
        efficiency: 1.0,
        workers: ['worker', 'artisan', 'engineer'],
      },
      {
        stage: 'consumption',
        name: "工业消费",
        consumers: ['industry', 'civic'],
        input: 'electricity',
      },
      {
        stage: 'processing',
        name: "核能发电",
        buildings: ['nuclear_power_plant'],
        input: ['uranium', 'steel', 'stone'],
        output: 'electricity',
        efficiency: 2.0,
        workers: ['engineer', 'technician', 'scientist'],
        epochRange: [8, 9],
      },
      {
        stage: 'processing',
        name: "太阳能发电",
        buildings: ['solar_power_plant'],
        input: ['stone', 'aluminum'],
        output: 'electricity',
        efficiency: 1.5,
        workers: ['technician', 'engineer', 'scientist'],
        epochRange: [9, 9],
      }
    ],
    upgrades: [
      {
        id: 'high_voltage_transmission',
        name: "高压输电",
        unlockEpoch: 7,
        cost: { wiring: 100, steel: 80, silver: 500 },
        bonus: { efficiency: 0.25, transmission: 0.3 },
      },
    ],
  },

  petrochemical_chain: {
    id: 'petrochemical_chain',
    name: "石油化工产业链",
    desc: "从石油开采到化学品深加工的完整石化体系",
    unlockEpoch: 7,
    stages: [
      {
        stage: 'extraction',
        name: "石油开采",
        buildings: ['oil_well'],
        output: 'oil',
        efficiency: 1.0,
        workers: ['worker', 'miner', 'capitalist'],
      },
      {
        stage: 'processing',
        name: "炼油化工",
        buildings: ['oil_refinery'],
        input: ['oil', 'coal', 'dye'],
        output: 'chemicals',
        efficiency: 1.0,
        workers: ['worker', 'engineer'],
      },
      {
        stage: 'advanced',
        name: "化工应用",
        buildings: ['fertilizer_plant'],
        input: ['chemicals', 'coal'],
        output: 'food',
        efficiency: 1.0,
        workers: ['worker', 'engineer'],
      },
      {
        stage: 'advanced',
        name: "塑料制造",
        buildings: ['plastics_factory'],
        input: ['chemicals', 'oil'],
        output: 'plastics',
        efficiency: 1.0,
        workers: ['worker', 'technician', 'engineer'],
        epochRange: [8, 9],
      },
      {
        stage: 'advanced',
        name: "复合材料",
        buildings: ['composites_factory'],
        input: ['plastics', 'aluminum', 'chemicals'],
        output: 'composites',
        efficiency: 1.0,
        workers: ['technician', 'engineer', 'scientist'],
        epochRange: [9, 9],
      },
      {
        stage: 'consumption',
        name: "农业消费",
        consumers: ['agriculture'],
        input: 'food',
      },
      {
        stage: 'consumption',
        name: "工业消费",
        consumers: ['industry', 'consumer'],
        input: ['plastics', 'composites'],
        epochRange: [8, 9],
      }
    ],
    upgrades: [
      {
        id: 'catalytic_cracking',
        name: "催化裂化",
        unlockEpoch: 7,
        cost: { steel: 120, chemicals: 50, silver: 400 },
        bonus: { efficiency: 0.3, output: 0.2 },
      },
      {
        id: 'polymer_engineering',
        name: "高分子工程",
        unlockEpoch: 8,
        cost: { chemicals: 200, science: 600 },
        bonus: { plastics_output: 0.3, efficiency: 0.2 },
      },
    ],
  },

  // ========== 原子时代新增产业链 ==========
  electronics_chain: {
    id: 'electronics_chain',
    name: "电子产业链",
    desc: "从铜矿开采到电子元件制造的现代电子工业体系",
    unlockEpoch: 8,
    stages: [
      {
        stage: 'extraction',
        name: "铜矿开采",
        buildings: ['copper_mine', 'advanced_copper_mine'],
        output: 'copper',
        efficiency: 1.0,
        workers: ['miner', 'worker'],
        epochRange: [1, 9],
      },
      {
        stage: 'processing',
        name: "电缆制造",
        buildings: ['wiring_factory'],
        input: ['copper', 'rubber'],
        output: 'wiring',
        efficiency: 1.0,
        workers: ['worker', 'artisan', 'engineer'],
        epochRange: [7, 9],
      },
      {
        stage: 'advanced',
        name: "电子元件",
        buildings: ['electronics_factory'],
        input: ['copper', 'wiring', 'chemicals', 'stone'],
        output: 'electronics',
        efficiency: 1.0,
        workers: ['worker', 'technician', 'engineer'],
        epochRange: [8, 9],
      },
      {
        stage: 'advanced',
        name: "家电制造",
        buildings: ['appliance_factory'],
        input: ['electronics', 'plastics', 'steel'],
        output: ['silver', 'culture'],
        efficiency: 1.2,
        workers: ['worker', 'technician', 'capitalist'],
        epochRange: [8, 9],
      },
      {
        stage: 'consumption',
        name: "消费电子",
        consumers: ['all_classes'],
        input: 'electronics',
        bonus: { approval: 0.08, culture: 0.05 },
        epochRange: [8, 9],
      }
    ],
    upgrades: [
      {
        id: 'transistor_miniaturization',
        name: "晶体管小型化",
        unlockEpoch: 8,
        cost: { electronics: 80, science: 500 },
        bonus: { efficiency: 0.3, output: 0.25 },
      },
      {
        id: 'integrated_circuits',
        name: "集成电路",
        unlockEpoch: 8,
        cost: { electronics: 150, science: 800 },
        bonus: { efficiency: 0.4, quality: 0.3 },
      },
    ],
  },

  // ========== 信息时代新增产业链 ==========
  semiconductor_chain: {
    id: 'semiconductor_chain',
    name: "半导体产业链",
    desc: "从铜矿到芯片再到软件的信息产业超长链，横跨青铜时代到信息时代",
    unlockEpoch: 9,
    stages: [
      {
        stage: 'extraction',
        name: "铜矿开采",
        buildings: ['copper_mine', 'advanced_copper_mine', 'automated_mine'],
        output: 'copper',
        efficiency: 1.0,
        workers: ['miner', 'technician'],
        epochRange: [1, 9],
      },
      {
        stage: 'processing',
        name: "电缆制造",
        buildings: ['wiring_factory'],
        input: ['copper', 'rubber'],
        output: 'wiring',
        efficiency: 1.0,
        workers: ['worker', 'artisan', 'engineer'],
        epochRange: [7, 9],
      },
      {
        stage: 'processing',
        name: "电子元件",
        buildings: ['electronics_factory'],
        input: ['copper', 'wiring', 'chemicals', 'stone'],
        output: 'electronics',
        efficiency: 1.0,
        workers: ['worker', 'technician', 'engineer'],
        epochRange: [8, 9],
      },
      {
        stage: 'advanced',
        name: "芯片制造",
        buildings: ['semiconductor_fab'],
        input: ['electronics', 'chemicals', 'copper', 'stone'],
        output: 'semiconductors',
        efficiency: 1.0,
        workers: ['technician', 'engineer', 'scientist'],
        epochRange: [9, 9],
      },
      {
        stage: 'advanced',
        name: "软件开发",
        buildings: ['software_company'],
        input: ['semiconductors', 'electricity'],
        output: ['software', 'science'],
        efficiency: 1.0,
        workers: ['scientist', 'engineer', 'technician'],
        epochRange: [9, 9],
      },
      {
        stage: 'advanced',
        name: "数据处理",
        buildings: ['data_center'],
        input: ['semiconductors', 'electricity', 'steel'],
        output: ['silver', 'science'],
        efficiency: 1.5,
        workers: ['technician', 'engineer', 'scientist'],
        epochRange: [9, 9],
      },
      {
        stage: 'advanced',
        name: "金融科技",
        buildings: ['financial_center'],
        input: ['software', 'electricity'],
        output: 'silver',
        efficiency: 2.0,
        workers: ['scientist', 'capitalist', 'merchant'],
        epochRange: [9, 9],
      },
      {
        stage: 'consumption',
        name: "数字消费",
        consumers: ['all_classes'],
        input: ['software', 'semiconductors'],
        bonus: { approval: 0.1, culture: 0.08, science: 0.05 },
        epochRange: [9, 9],
      }
    ],
    upgrades: [
      {
        id: 'euv_lithography',
        name: "极紫外光刻",
        unlockEpoch: 9,
        cost: { semiconductors: 100, science: 1200 },
        bonus: { efficiency: 0.4, semiconductors_output: 0.35 },
      },
      {
        id: 'ai_optimization',
        name: "AI优化",
        unlockEpoch: 9,
        cost: { software: 80, science: 1500 },
        bonus: { efficiency: 0.5, output: 0.3, science: 0.2 },
      },
    ],
  },

  // ========== 医药产业链 ==========
  pharmaceutical_chain: {
    id: 'pharmaceutical_chain',
    name: "医药产业链",
    desc: "从化学品到药物制造和生物科技的医疗产业体系",
    unlockEpoch: 8,
    stages: [
      {
        stage: 'extraction',
        name: "化学品供给",
        buildings: ['oil_refinery'],
        output: 'chemicals',
        efficiency: 1.0,
        workers: ['worker', 'engineer'],
        epochRange: [7, 9],
      },
      {
        stage: 'processing',
        name: "药物制造",
        buildings: ['pharmaceutical_plant'],
        input: ['chemicals', 'papyrus'],
        output: 'medicine',
        efficiency: 1.0,
        workers: ['technician', 'engineer', 'scientist'],
        epochRange: [8, 9],
      },
      {
        stage: 'advanced',
        name: "生物科技",
        buildings: ['biotech_center'],
        input: ['medicine', 'electronics', 'chemicals'],
        output: ['science', 'medicine'],
        efficiency: 1.5,
        workers: ['scientist', 'engineer'],
        epochRange: [9, 9],
      },
      {
        stage: 'consumption',
        name: "医疗消费",
        consumers: ['all_classes'],
        input: 'medicine',
        bonus: { approval: 0.1, population_growth: 0.05 },
        epochRange: [8, 9],
      }
    ],
    upgrades: [
      {
        id: 'mass_vaccination',
        name: "大规模疫苗接种",
        unlockEpoch: 8,
        cost: { medicine: 80, science: 600 },
        bonus: { population_growth: 0.15, approval: 0.1 },
      },
      {
        id: 'gene_therapy',
        name: "基因疗法",
        unlockEpoch: 9,
        cost: { medicine: 120, science: 1000 },
        bonus: { efficiency: 0.4, science: 0.3 },
      },
    ],
  },
};

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

  // ========== 跨产业链协同 ==========
  cross_chain_synergies: [
    {
      chain1: 'power_chain', chain2: 'mining_chain',
      bonus: 0.08, desc: '电力驱动采矿效率提升',
    },
    {
      chain1: 'power_chain', chain2: 'petrochemical_chain',
      bonus: 0.10, desc: '电力支撑化工生产',
    },
    {
      chain1: 'electronics_chain', chain2: 'military_chain',
      bonus: 0.12, desc: '电子化提升军事装备',
    },
    {
      chain1: 'electronics_chain', chain2: 'knowledge_chain',
      bonus: 0.10, desc: '电子媒体促进文化传播',
    },
    {
      chain1: 'petrochemical_chain', chain2: 'food_chain',
      bonus: 0.08, desc: '化肥提升农业产出',
    },
    {
      chain1: 'semiconductor_chain', chain2: 'knowledge_chain',
      bonus: 0.15, desc: '半导体驱动知识革命',
    },
    {
      chain1: 'power_chain', chain2: 'electronics_chain',
      bonus: 0.10, desc: '稳定电力是电子工业的基础',
    },
    {
      chain1: 'petrochemical_chain', chain2: 'textile_chain',
      bonus: 0.08, desc: '化纤推动纺织产业升级',
    },
    {
      chain1: 'semiconductor_chain', chain2: 'pharmaceutical_chain',
      bonus: 0.10, desc: '半导体推动生物医药计算分析',
    },
  ],
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
        requirements: { epoch: 6, buildings: { factory: 5, steel_works: 3 } },
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
        requirements: { epoch: 4, workers: { scribe: 15 } },
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

  military_chain: {
    paths: [
      {
        id: 'melee_mastery',
        name: "冷兵器精通",
        desc: "专注锻造工艺，冷兵器品质和产量大幅提升。",
        requirements: { epoch: 3, buildings: { swordsmith: 3, armorsmith: 2 } },
        effects: { swords_output: 0.35, plate_armor_output: 0.3, efficiency: 0.2 },
      },
      {
        id: 'gunpowder_dominance',
        name: "火药优势",
        desc: "集中发展火药军事力量，火器产量翻倍。",
        requirements: { epoch: 5, buildings: { powder_mill: 3, gun_workshop: 2 }, tech: ['musket_manufacturing'] },
        effects: { muskets_output: 0.4, gunpowder_output: 0.3, efficiency: 0.25 },
      },
      {
        id: 'total_war_industry',
        name: "全面战争工业",
        desc: "动员全部工业能力投入军备生产，但民用产业受损。",
        requirements: { epoch: 6, buildings: { arms_factory: 2, ammo_factory: 3 }, tech: ['military_industrialization'] },
        effects: { ordnance_output: 0.5, ammunition_output: 0.4, efficiency: 0.35 },
        penalties: { civilian_chains: { efficiency: -0.15 } },
      },
      {
        id: 'electronic_warfare',
        name: "电子战争",
        desc: "将电子工业纳入军工体系，军事装备电子化、精密化。",
        requirements: { epoch: 8, buildings: { military_industrial_complex: 1, electronics_factory: 2 }, tech: ['military_electronics'] },
        effects: { ordnance_output: 0.4, efficiency: 0.3, military_power: 0.25 },
      },
    ],
  },

  power_chain: {
    paths: [
      {
        id: 'fossil_dominance',
        name: "化石能源主导",
        desc: "大力发展火力发电，产量高但对煤炭需求巨大。",
        requirements: { epoch: 7, buildings: { coal_power_plant: 3 } },
        effects: { electricity_output: 0.4, efficiency: 0.2 },
      },
      {
        id: 'nuclear_program',
        name: "核能计划",
        desc: "发展核电，电力产出极高但需要铀矿支撑。",
        requirements: { epoch: 8, buildings: { nuclear_power_plant: 1, uranium_mine: 2 }, tech: ['nuclear_power'] },
        effects: { electricity_output: 0.6, efficiency: 0.3 },
      },
      {
        id: 'green_energy',
        name: "绿色能源",
        desc: "发展太阳能等可再生能源，可持续但前期投入大。",
        requirements: { epoch: 9, buildings: { solar_power_plant: 2 }, tech: ['solar_energy'] },
        effects: { electricity_output: 0.35, sustainability: 0.5, approval: 0.1 },
      },
    ],
  },

  electronics_chain: {
    paths: [
      {
        id: 'consumer_electronics',
        name: "消费电子",
        desc: "以家电和消费品为核心，追求大众市场。",
        requirements: { epoch: 8, buildings: { appliance_factory: 2, electronics_factory: 2 }, tech: ['consumer_electronics'] },
        effects: { silver_output: 0.3, culture: 0.2, approval: 0.1 },
      },
      {
        id: 'military_electronics',
        name: "军事电子",
        desc: "电子工业为军工服务，精密制导和雷达装备。",
        requirements: { epoch: 8, buildings: { electronics_factory: 2, military_industrial_complex: 1 }, tech: ['military_electronics'] },
        effects: { ordnance_quality: 0.4, military_power: 0.2 },
      },
    ],
  },

  semiconductor_chain: {
    paths: [
      {
        id: 'chip_sovereignty',
        name: "芯片主权",
        desc: "建立完整的自主半导体产业，减少对外依赖。",
        requirements: { epoch: 9, buildings: { semiconductor_fab: 2, software_company: 2 }, tech: ['semiconductor_manufacturing'] },
        effects: { semiconductors_output: 0.4, science: 0.3, efficiency: 0.25 },
      },
      {
        id: 'ai_revolution',
        name: "AI革命",
        desc: "以人工智能为核心驱动力，全面提升各行业效率。",
        requirements: { epoch: 9, buildings: { data_center: 2, research_institute: 1 }, tech: ['ai_research'] },
        effects: { all_chains_efficiency: 0.15, science: 0.5, silver: 0.2 },
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
      electronics_chain: { efficiency: 0.2, output: 0.15 },
      power_chain: { efficiency: 0.15 },
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
    affects: ['military_chain', 'electronics_chain'],
    bonus: { efficiency: 0.5, output: 0.4 },
    penalty: { other_chains: { efficiency: -0.2 } },
  },

  research_grants: {
    affects: ['knowledge_chain', 'semiconductor_chain', 'pharmaceutical_chain'],
    bonus: { efficiency: 0.2, science: 0.15 },
  },

  industrial_policy: {
    affects: ['electronics_chain', 'petrochemical_chain', 'power_chain'],
    bonus: { efficiency: 0.15, output: 0.1 },
  },
};
