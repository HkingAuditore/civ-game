/**
 * 系统联动机制配置
 * 定义国家、政令、产业链、阶层之间的相互影响
 * 建立动态平衡和反馈机制
 */

/**
 * 国家特性与政令的联动
 * 不同国家对某些政令有特殊效果
 */
export const NATION_DECREE_SYNERGIES = {
  // 草原汗国
  steppe_horde: {
    enhanced_decrees: {
      conscription_law: {
        bonus: { recruitSpeed: 0.2, cost: -0.25 },
        desc: "游牧民族天生的骑射传统使征兵更加高效",
      },
      forced_labor: {
        penalty_reduction: { classApproval: 0.5 },
        desc: "游牧文化对强制劳动的抵触较小",
      },
    },
    restricted_decrees: {
      feudal_privileges: {
        penalty: { efficiency: -0.3 },
        desc: "游牧社会结构与封建制度冲突",
      },
    },
  },

  // 沙漠商队
  desert_caravan: {
    enhanced_decrees: {
      free_trade: {
        bonus: { tradeIncome: 0.15, marketStability: 0.1 },
        desc: "商队文化使自由贸易效果更佳",
      },
      market_regulation: {
        bonus: { efficiency: 0.2 },
        desc: "丰富的贸易经验提升市场监管效果",
      },
    },
    restricted_decrees: {
      state_monopoly: {
        penalty: { classApproval: { merchant: -20 }, efficiency: -0.25 },
        desc: "商业文化强烈反对国家垄断",
      },
    },
  },

  // 雨林帝国
  jungle_empire: {
    enhanced_decrees: {
      state_religion: {
        bonus: { cultureBonus: 0.15, stability: 5 },
        desc: "神权传统强化宗教政策效果",
      },
      cultural_patronage: {
        bonus: { cultureBonus: 0.2 },
        desc: "深厚的文化底蕴提升赞助效果",
      },
    },
    restricted_decrees: {
      secular_state: {
        penalty: { stability: -15, classApproval: { all: -10 } },
        desc: "神权社会难以接受世俗化",
      },
    },
  },

  // 丝绸帝国
  silk_empire: {
    enhanced_decrees: {
      aristocratic_rule: {
        bonus: { adminCapacity: 0.1, efficiency: 0.15 },
        desc: "中央集权传统提升贵族统治效率",
      },
      guild_charter: {
        bonus: { categories: { craft: 0.1 } },
        desc: "手工业传统强化行会制度",
      },
    },
  },

  // 革命共和国
  revolutionary_state: {
    enhanced_decrees: {
      equality_decree: {
        bonus: { production: 0.1, stability: 10 },
        desc: "革命理念减少平等法令的负面影响",
      },
      public_education: {
        bonus: { scienceBonus: 0.15, cultureBonus: 0.1 },
        desc: "革命政府重视教育",
      },
    },
    restricted_decrees: {
      feudal_privileges: {
        penalty: { stability: -25, classApproval: { all: -15 } },
        desc: "革命理念与封建特权完全对立",
      },
      aristocratic_rule: {
        penalty: { stability: -20 },
        desc: "革命政府反对贵族统治",
      },
    },
  },

  // 自由商会
  merchant_republic: {
    enhanced_decrees: {
      free_trade: {
        bonus: { tradeIncome: 0.2, passive: { silver: 2 } },
        desc: "商业共和国最大化自由贸易收益",
      },
      patent_law: {
        bonus: { scienceBonus: 0.15, categories: { industry: 0.1 } },
        desc: "商业文化促进创新保护",
      },
    },
  },
};

/**
 * 阶层与政令的动态反馈
 * 阶层好感度影响政令效果
 */
export const CLASS_DECREE_FEEDBACK = {
  // 高好感度加成
  high_approval: {
    threshold: 70,
    effects: {
      production: 0.1,
      efficiency: 0.15,
      loyalty: 0.2,
    },
    desc: "阶层满意时更积极配合政策",
  },

  // 低好感度惩罚
  low_approval: {
    threshold: 30,
    effects: {
      production: -0.15,
      efficiency: -0.2,
      resistance: 0.25,
    },
    desc: "阶层不满时消极抵抗政策",
  },

  // 特定阶层对特定政令的影响
  class_specific: {
    merchant: {
      affects_decrees: ['free_trade', 'market_regulation', 'colonial_charter'],
      high_approval_bonus: { tradeIncome: 0.15 },
      low_approval_penalty: { tradeIncome: -0.25 },
    },
    
    worker: {
      affects_decrees: ['workers_compact', 'war_economy', 'infrastructure_plan'],
      high_approval_bonus: { categories: { industry: 0.15 } },
      low_approval_penalty: { categories: { industry: -0.25 } },
    },
    
    peasant: {
      affects_decrees: ['grain_rationing', 'land_reform', 'clan_tribute'],
      high_approval_bonus: { categories: { gather: 0.1 } },
      low_approval_penalty: { categories: { gather: -0.2 } },
    },
    
    noble: {
      affects_decrees: ['feudal_privileges', 'aristocratic_rule', 'officer_corps'],
      high_approval_bonus: { stability: 10, adminCapacity: 0.1 },
      low_approval_penalty: { stability: -15, adminCapacity: -0.15 },
    },
    
    scholar: {
      affects_decrees: ['public_education', 'university_charter', 'research_grants'],
      high_approval_bonus: { scienceBonus: 0.2 },
      low_approval_penalty: { scienceBonus: -0.25 },
    },
  },
};

/**
 * 产业链与阶层的互动
 * 产业链发展影响阶层结构和好感度
 */
export const CHAIN_CLASS_INTERACTION = {
  food_chain: {
    primary_classes: ['peasant', 'serf'],
    development_effects: {
      level_1: { classApproval: { peasant: 5 }, population_growth: 0.05 },
      level_2: { classApproval: { peasant: 10 }, population_growth: 0.1 },
      level_3: { classApproval: { peasant: 15 }, population_growth: 0.15, stability: 5 },
    },
    decline_effects: {
      classApproval: { peasant: -15, serf: -10 },
      stability: -10,
      unrest_risk: 0.2,
    },
  },

  mining_chain: {
    primary_classes: ['miner', 'worker', 'engineer'],
    development_effects: {
      level_1: { classApproval: { miner: 5, worker: 5 } },
      level_2: { classApproval: { miner: 10, worker: 10, engineer: 5 }, wealth: { miner: 10 } },
      level_3: { classApproval: { miner: 15, worker: 15, engineer: 10 }, wealth: { miner: 20, worker: 15 } },
    },
    decline_effects: {
      classApproval: { miner: -20, worker: -15 },
      unemployment: 0.15,
    },
  },

  knowledge_chain: {
    primary_classes: ['scribe', 'scholar', 'cleric'],
    development_effects: {
      level_1: { classApproval: { scribe: 10, scholar: 5 }, culture: 0.1 },
      level_2: { classApproval: { scribe: 15, scholar: 10 }, culture: 0.2, science: 0.1 },
      level_3: { classApproval: { scribe: 20, scholar: 15 }, culture: 0.3, science: 0.2, influence: { scholar: 0.15 } },
    },
  },

  luxury_chain: {
    primary_classes: ['merchant', 'noble', 'artisan'],
    development_effects: {
      level_1: { classApproval: { merchant: 10, noble: 5 }, wealth: { merchant: 15 } },
      level_2: { classApproval: { merchant: 20, noble: 10 }, wealth: { merchant: 30, noble: 20 } },
      level_3: { classApproval: { merchant: 30, noble: 15 }, wealth: { merchant: 50, noble: 35 }, influence: { merchant: 0.2 } },
    },
  },

  military_chain: {
    primary_classes: ['soldier', 'noble', 'engineer'],
    development_effects: {
      level_1: { classApproval: { soldier: 5 }, militaryPower: 0.1 },
      level_2: { classApproval: { soldier: 10, noble: 5 }, militaryPower: 0.2 },
      level_3: { classApproval: { soldier: 15, noble: 10 }, militaryPower: 0.3, stability: 5 },
    },
  },
};

/**
 * 政令组合效果
 * 多个政令同时激活时的协同或冲突效果
 */
export const DECREE_COMBINATIONS = {
  // 协同组合
  synergies: [
    {
      decrees: ['free_trade', 'colonial_charter', 'market_regulation'],
      name: "贸易帝国",
      bonus: { tradeIncome: 0.3, passive: { silver: 5 }, diplomacy: 15 },
      desc: "完整的贸易政策体系带来巨大收益",
    },
    {
      decrees: ['public_education', 'university_charter', 'research_grants'],
      name: "学术繁荣",
      bonus: { scienceBonus: 0.5, cultureBonus: 0.3, classApproval: { scholar: 30 } },
      desc: "全面的教育和科研政策推动文明进步",
    },
    {
      decrees: ['conscription_law', 'military_academy', 'war_economy'],
      name: "军国主义",
      bonus: { militaryPower: 0.6, recruitSpeed: 0.5, armyCapacity: 0.4 },
      penalty: { production: -0.15, stability: -15 },
      desc: "全面军事化带来强大战力但损害经济",
    },
    {
      decrees: ['land_reform', 'equality_decree', 'welfare_system'],
      name: "社会革命",
      bonus: { classApproval: { peasant: 40, worker: 35 }, stability: 20, populationGrowth: 0.3 },
      penalty: { classApproval: { noble: -50, landowner: -50 }, passive: { silver: -8 } },
      desc: "彻底的社会改革重塑阶级结构",
    },
    {
      decrees: ['guild_charter', 'apprentice_system', 'patent_law'],
      name: "工匠传统",
      bonus: { categories: { craft: 0.35 }, classApproval: { artisan: 35 }, quality: 0.25 },
      desc: "完善的工匠培养体系提升制造业",
    },
    {
      decrees: ['infrastructure_plan', 'citizen_roadworks', 'market_regulation'],
      name: "基建强国",
      bonus: { production: 0.25, categories: { gather: 0.2 }, efficiency: 0.2 },
      desc: "完善的基础设施提升整体效率",
    },
  ],

  // 冲突组合
  conflicts: [
    {
      decrees: ['free_trade', 'state_monopoly'],
      name: "政策矛盾",
      penalty: { efficiency: -0.3, stability: -15 },
      desc: "自由贸易与国家垄断相互抵消",
    },
    {
      decrees: ['equality_decree', 'feudal_privileges'],
      name: "阶级冲突",
      penalty: { stability: -30, production: -0.2 },
      desc: "平等与特权政策引发严重冲突",
    },
    {
      decrees: ['state_religion', 'secular_state'],
      name: "信仰分裂",
      penalty: { stability: -25, cultureBonus: -0.2 },
      desc: "宗教与世俗政策相互对立",
    },
  ],
};

/**
 * 时代与系统联动
 * 不同时代对各系统有不同影响
 */
export const EPOCH_SYSTEM_EFFECTS = {
  0: { // 石器时代
    available_chains: ['food_chain', 'wood_chain'],
    class_structure: { peasant: 0.7, lumberjack: 0.3 },
    decree_efficiency: 0.7,
  },
  
  1: { // 青铜时代
    available_chains: ['food_chain', 'wood_chain', 'mining_chain'],
    class_structure: { peasant: 0.5, lumberjack: 0.2, miner: 0.2, artisan: 0.1 },
    decree_efficiency: 0.8,
    new_mechanics: ['trade', 'basic_diplomacy'],
  },
  
  2: { // 古典时代
    available_chains: ['food_chain', 'wood_chain', 'mining_chain', 'knowledge_chain'],
    class_structure: { peasant: 0.4, worker: 0.2, artisan: 0.15, scribe: 0.1, merchant: 0.15 },
    decree_efficiency: 0.9,
    new_mechanics: ['culture_influence', 'advanced_trade'],
  },
  
  3: { // 封建时代
    available_chains: ['food_chain', 'wood_chain', 'mining_chain', 'knowledge_chain', 'military_chain'],
    class_structure: { serf: 0.3, peasant: 0.2, artisan: 0.15, noble: 0.05, landowner: 0.1, soldier: 0.1, cleric: 0.1 },
    decree_efficiency: 1.0,
    new_mechanics: ['feudal_system', 'religious_influence'],
  },
  
  4: { // 探索时代
    available_chains: ['food_chain', 'wood_chain', 'mining_chain', 'knowledge_chain', 'military_chain', 'luxury_chain'],
    class_structure: { peasant: 0.25, worker: 0.2, merchant: 0.2, artisan: 0.15, navigator: 0.1, noble: 0.1 },
    decree_efficiency: 1.1,
    new_mechanics: ['colonial_trade', 'naval_power'],
  },
  
  5: { // 启蒙时代
    available_chains: ['all'],
    class_structure: { worker: 0.25, merchant: 0.2, scholar: 0.15, artisan: 0.15, peasant: 0.15, noble: 0.1 },
    decree_efficiency: 1.2,
    new_mechanics: ['enlightenment', 'scientific_revolution'],
  },
  
  6: { // 工业时代
    available_chains: ['all'],
    class_structure: { worker: 0.35, engineer: 0.15, capitalist: 0.1, merchant: 0.15, peasant: 0.15, scholar: 0.1 },
    decree_efficiency: 1.3,
    new_mechanics: ['industrialization', 'mass_production'],
  },
};

/**
 * 动态平衡机制
 * 系统自动调节以维持游戏平衡
 */
export const BALANCE_MECHANISMS = {
  // 阶层平衡
  class_balance: {
    // 当某阶层过于强大时的自动调节
    dominant_class_penalty: {
      threshold: 0.4, // 影响力超过40%
      effects: {
        influence_decay: 0.05,
        other_class_bonus: 0.1,
      },
    },
    
    // 当某阶层过于弱小时的保护
    weak_class_protection: {
      threshold: 0.05, // 影响力低于5%
      effects: {
        influence_boost: 0.1,
        approval_bonus: 10,
      },
    },
  },

  // 经济平衡
  economic_balance: {
    // 通货膨胀
    inflation: {
      trigger: { silver_growth: 0.5 }, // 银币增长过快
      effects: {
        prices: 0.2,
        real_income: -0.15,
      },
    },
    
    // 经济衰退
    recession: {
      trigger: { production_decline: -0.3 },
      effects: {
        unemployment: 0.2,
        class_approval: -15,
        stability: -10,
      },
    },
  },

  // 军事平衡
  military_balance: {
    // 过度军事化
    over_militarization: {
      threshold: { military_spending: 0.5 }, // 军费超过50%
      effects: {
        production: -0.2,
        class_approval: { peasant: -20, worker: -15 },
        stability: -15,
      },
    },
  },

  // 文化平衡
  cultural_balance: {
    // 文化霸权
    cultural_hegemony: {
      threshold: { culture_output: 2.0 }, // 文化产出是平均的2倍
      effects: {
        diplomacy: 20,
        influence: 0.25,
        foreign_approval: 0.15,
      },
    },
  },
};

/**
 * 随机事件与系统联动
 * 基于当前系统状态触发的随机事件
 */
export const SYSTEM_TRIGGERED_EVENTS = {
  // 产业链相关事件
  chain_events: {
    resource_discovery: {
      trigger: { chain_level: 3, exploration: 0.5 },
      probability: 0.15,
      effects: { resource_bonus: 0.3, duration: 20 },
      desc: "发现新的资源矿脉",
    },
    
    technological_breakthrough: {
      trigger: { knowledge_chain: 3, science: 1000 },
      probability: 0.1,
      effects: { tech_speed: 0.5, duration: 30 },
      desc: "重大技术突破",
    },
    
    supply_chain_disruption: {
      trigger: { chain_bottleneck: true },
      probability: 0.2,
      effects: { efficiency: -0.3, duration: 15 },
      desc: "供应链中断",
    },
  },

  // 阶层相关事件
  class_events: {
    class_uprising: {
      trigger: { class_approval: 20, class_influence: 0.3 },
      probability: 0.25,
      effects: { stability: -30, production: -0.4, duration: 20 },
      desc: "阶层起义",
    },
    
    golden_age: {
      trigger: { all_class_approval: 70, stability: 80 },
      probability: 0.05,
      effects: { production: 0.3, culture: 0.4, science: 0.3, duration: 50 },
      desc: "黄金时代",
    },
  },

  // 外交相关事件
  diplomatic_events: {
    trade_agreement: {
      trigger: { nation_relation: 70, merchant_approval: 60 },
      probability: 0.2,
      effects: { trade_income: 0.25, diplomacy: 10, duration: 40 },
      desc: "贸易协定",
    },
    
    diplomatic_crisis: {
      trigger: { nation_relation: 30, aggression: 0.6 },
      probability: 0.15,
      effects: { trade_income: -0.3, military_pressure: 0.3, duration: 30 },
      desc: "外交危机",
    },
  },
};

export default {
  NATION_DECREE_SYNERGIES,
  CLASS_DECREE_FEEDBACK,
  CHAIN_CLASS_INTERACTION,
  DECREE_COMBINATIONS,
  EPOCH_SYSTEM_EFFECTS,
  BALANCE_MECHANISMS,
  SYSTEM_TRIGGERED_EVENTS,
};
