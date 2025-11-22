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
    id: 'stone_clan',
    name: "石斧部族",
    type: "部落联盟",
    color: "text-amber-400",
    desc: "散居山林的部族，依靠掠夺捕猎为生。",
    appearEpoch: 0,
    expireEpoch: 1,
    marketVolatility: 0.45,
    aggression: 0.65,
    wealth: 350,
    economyTraits: {
      resourceBias: {
        food: 1.3,
        wood: 1.1,
        stone: 0.8,
      },
    },
  },
  {
    id: 'dawn_tribe',
    name: "曙光部落",
    type: "原始公社",
    color: "text-emerald-400",
    desc: "愿意交换基础物资的和平部落。",
    appearEpoch: 0,
    expireEpoch: 2,
    marketVolatility: 0.25,
    aggression: 0.2,
    wealth: 420,
    economyTraits: {
      resourceBias: {
        food: 1.4,
        wood: 0.9,
        plank: 0.7,
        culture: 0.5,
      },
    },
  },
  {
    id: 'saffron_city',
    name: "藏红花城邦",
    type: "贸易寡头",
    color: "text-orange-300",
    desc: "掌控铜矿与香料通道的青铜时代富饶城邦。",
    appearEpoch: 1,
    expireEpoch: 3,
    marketVolatility: 0.33,
    aggression: 0.45,
    wealth: 900,
    economyTraits: {
      resourceBias: {
        copper: 1.5,
        brick: 1.2,
        spice: 1.2,
        wood: 0.8,
      },
    },
  },
  {
    id: 'marble_league',
    name: "大理石同盟",
    type: "古典议会",
    color: "text-blue-300",
    desc: "讲求理性与艺术的古典城邦联盟，纸草与戏剧出口旺盛。",
    appearEpoch: 2,
    expireEpoch: 4,
    marketVolatility: 0.28,
    aggression: 0.35,
    wealth: 1400,
    economyTraits: {
      resourceBias: {
        papyrus: 1.5,
        culture: 1.6,
        stone: 1.1,
        silver: 0.9,
      },
    },
  },
  {
    id: 'high_kingdom',
    name: "高庭王国",
    type: "封建王权",
    color: "text-red-400",
    desc: "拥有骑士庄园与铁矿的封建强权，对土地要求苛刻。",
    appearEpoch: 3,
    expireEpoch: 4,
    marketVolatility: 0.34,
    aggression: 0.6,
    wealth: 1600,
    economyTraits: {
      resourceBias: {
        food: 1.3,
        iron: 1.4,
        tools: 1.1,
        culture: 0.8,
      },
    },
  },
  {
    id: 'sunset_armada',
    name: "落日舰队",
    type: "探索海权",
    color: "text-amber-500",
    desc: "远航冒险家组成的舰队国，以香料与木材换取武器。",
    appearEpoch: 4,
    expireEpoch: 5,
    marketVolatility: 0.37,
    aggression: 0.55,
    wealth: 1900,
    economyTraits: {
      resourceBias: {
        spice: 1.7,
        plank: 1.3,
        tools: 1.2,
        silver: 1.1,
      },
    },
  },
  {
    id: 'lumiere_republic',
    name: "光耀共和国",
    type: "启蒙共和",
    color: "text-purple-300",
    desc: "咖啡馆、印刷术和学者构成的启蒙政体，热衷文化辩论。",
    appearEpoch: 5,
    expireEpoch: 6,
    marketVolatility: 0.26,
    aggression: 0.3,
    wealth: 2100,
    economyTraits: {
      resourceBias: {
        coffee: 1.5,
        culture: 1.7,
        papyrus: 1.3,
        science: 1.4,
      },
    },
  },
  {
    id: 'industrial_consortium',
    name: "蒸汽财团",
    type: "公司寡头",
    color: "text-orange-400",
    desc: "控制煤田与钢铁的工业寡头，建造铁路赚取巨额利润。",
    appearEpoch: 6,
    expireEpoch: 7,
    marketVolatility: 0.24,
    aggression: 0.45,
    wealth: 2600,
    economyTraits: {
      resourceBias: {
        coal: 1.6,
        steel: 1.5,
        tools: 1.4,
        silver: 1.2,
      },
    },
  },
  // ========== 新增国家 ==========
  {
    id: 'steppe_horde',
    name: "草原汗国",
    type: "游牧部落",
    color: "text-yellow-300",
    desc: "驰骋草原的骑射民族，以马匹和皮革贸易为生，军事实力强大。",
    appearEpoch: 2,
    expireEpoch: 4,
    marketVolatility: 0.42,
    aggression: 0.75,
    wealth: 1200,
    culturalTraits: {
      militaryFocus: true,
      tradingStyle: 'aggressive',
      diplomaticModifier: -0.1,
    },
    economyTraits: {
      resourceBias: {
        food: 1.5,
        iron: 1.2,
        tools: 0.9,
        culture: 0.6,
      },
    },
    specialAbilities: [
      { type: 'raid_bonus', value: 0.3, desc: "掠夺收益 +30%" },
      { type: 'cavalry_discount', value: 0.2, desc: "骑兵训练成本 -20%" }
    ],
  },
  {
    id: 'desert_caravan',
    name: "沙漠商队",
    type: "商业联盟",
    color: "text-amber-200",
    desc: "穿越沙漠的商队联盟，垄断香料与宝石贸易，擅长谈判。",
    appearEpoch: 2,
    expireEpoch: 5,
    marketVolatility: 0.22,
    aggression: 0.25,
    wealth: 1800,
    culturalTraits: {
      tradingStyle: 'merchant',
      diplomaticModifier: 0.15,
      marketExpertise: true,
    },
    economyTraits: {
      resourceBias: {
        spice: 2.0,
        silver: 1.4,
        culture: 1.2,
        food: 0.7,
      },
    },
    specialAbilities: [
      { type: 'trade_bonus', value: 0.25, desc: "贸易收益 +25%" },
      { type: 'market_stability', value: 0.15, desc: "市场波动 -15%" }
    ],
  },
  {
    id: 'jungle_empire',
    name: "雨林帝国",
    type: "神权王朝",
    color: "text-green-400",
    desc: "隐藏在密林深处的古老文明，精通天文历法，崇拜太阳神。",
    appearEpoch: 1,
    expireEpoch: 4,
    marketVolatility: 0.35,
    aggression: 0.4,
    wealth: 1100,
    culturalTraits: {
      religiousFocus: true,
      scientificAdvancement: 0.2,
      isolationist: true,
    },
    economyTraits: {
      resourceBias: {
        culture: 1.8,
        science: 1.5,
        papyrus: 1.3,
        stone: 1.2,
      },
    },
    specialAbilities: [
      { type: 'culture_bonus', value: 0.2, desc: "文化产出 +20%" },
      { type: 'science_bonus', value: 0.15, desc: "科研效率 +15%" }
    ],
  },
  {
    id: 'mountain_clans',
    name: "山地氏族",
    type: "部落联邦",
    color: "text-slate-300",
    desc: "居住在高山峡谷的坚韧民族，擅长采矿和防御工事。",
    appearEpoch: 1,
    expireEpoch: 3,
    marketVolatility: 0.38,
    aggression: 0.5,
    wealth: 800,
    culturalTraits: {
      defensiveFocus: true,
      miningExpertise: true,
      isolationist: true,
    },
    economyTraits: {
      resourceBias: {
        stone: 1.8,
        iron: 1.6,
        copper: 1.4,
        food: 0.8,
      },
    },
    specialAbilities: [
      { type: 'mining_bonus', value: 0.25, desc: "采矿产出 +25%" },
      { type: 'defense_bonus', value: 0.3, desc: "防御力 +30%" }
    ],
  },
  {
    id: 'river_confederation',
    name: "河谷邦联",
    type: "水利共和",
    color: "text-cyan-400",
    desc: "依托大河流域的农业文明，精通水利工程和粮食储备。",
    appearEpoch: 1,
    expireEpoch: 3,
    marketVolatility: 0.28,
    aggression: 0.3,
    wealth: 1000,
    culturalTraits: {
      agriculturalFocus: true,
      engineeringAdvanced: true,
      peacefulTrade: true,
    },
    economyTraits: {
      resourceBias: {
        food: 2.0,
        papyrus: 1.4,
        brick: 1.2,
        culture: 1.1,
      },
    },
    specialAbilities: [
      { type: 'food_production', value: 0.3, desc: "粮食产出 +30%" },
      { type: 'population_growth', value: 0.15, desc: "人口增长 +15%" }
    ],
  },
  {
    id: 'island_thalassocracy',
    name: "群岛海权",
    type: "海洋联盟",
    color: "text-teal-300",
    desc: "散布于群岛的航海民族，控制海上贸易路线，擅长造船。",
    appearEpoch: 3,
    expireEpoch: 5,
    marketVolatility: 0.32,
    aggression: 0.4,
    wealth: 1700,
    culturalTraits: {
      navalSupremacy: true,
      tradingStyle: 'maritime',
      explorationBonus: 0.25,
    },
    economyTraits: {
      resourceBias: {
        plank: 1.6,
        spice: 1.5,
        tools: 1.3,
        silver: 1.2,
      },
    },
    specialAbilities: [
      { type: 'naval_bonus', value: 0.35, desc: "海军战力 +35%" },
      { type: 'trade_route', value: 0.2, desc: "贸易路线收益 +20%" }
    ],
  },
  {
    id: 'northern_principality',
    name: "北境公国",
    type: "贵族议会",
    color: "text-blue-200",
    desc: "寒冷北方的封建国度，以毛皮和木材贸易为主，民风彪悍。",
    appearEpoch: 3,
    expireEpoch: 5,
    marketVolatility: 0.36,
    aggression: 0.55,
    wealth: 1400,
    culturalTraits: {
      militaryTradition: true,
      resourcefulSurvival: true,
      honorCode: true,
    },
    economyTraits: {
      resourceBias: {
        wood: 1.7,
        plank: 1.5,
        iron: 1.3,
        food: 0.9,
      },
    },
    specialAbilities: [
      { type: 'winter_warfare', value: 0.25, desc: "冬季作战加成 +25%" },
      { type: 'lumber_efficiency', value: 0.2, desc: "木材采集 +20%" }
    ],
  },
  {
    id: 'silk_empire',
    name: "丝绸帝国",
    type: "中央集权",
    color: "text-rose-300",
    desc: "东方的古老帝国，垄断丝绸和瓷器贸易，文化底蕴深厚。",
    appearEpoch: 2,
    expireEpoch: 6,
    marketVolatility: 0.25,
    aggression: 0.35,
    wealth: 2200,
    culturalTraits: {
      culturalHegemony: true,
      bureaucraticEfficiency: 0.2,
      tradingStyle: 'monopolistic',
    },
    economyTraits: {
      resourceBias: {
        culture: 2.0,
        papyrus: 1.6,
        silver: 1.4,
        science: 1.3,
      },
    },
    specialAbilities: [
      { type: 'culture_influence', value: 0.3, desc: "文化影响力 +30%" },
      { type: 'admin_efficiency', value: 0.2, desc: "行政效率 +20%" }
    ],
  },
  {
    id: 'nomad_confederation',
    name: "游牧联盟",
    type: "部落议会",
    color: "text-orange-200",
    desc: "多个游牧部落的松散联盟，机动性强，善于突袭和贸易。",
    appearEpoch: 1,
    expireEpoch: 3,
    marketVolatility: 0.48,
    aggression: 0.7,
    wealth: 700,
    culturalTraits: {
      mobilityFocus: true,
      raidingCulture: true,
      adaptability: 0.25,
    },
    economyTraits: {
      resourceBias: {
        food: 1.4,
        wood: 1.1,
        tools: 0.9,
        culture: 0.7,
      },
    },
    specialAbilities: [
      { type: 'mobility_bonus', value: 0.4, desc: "移动速度 +40%" },
      { type: 'raid_frequency', value: 0.3, desc: "掠夺频率 +30%" }
    ],
  },
  {
    id: 'theocratic_order',
    name: "圣教骑士团",
    type: "宗教军事",
    color: "text-yellow-100",
    desc: "信仰驱动的军事修会，以圣战和朝圣贸易为核心。",
    appearEpoch: 3,
    expireEpoch: 5,
    marketVolatility: 0.31,
    aggression: 0.65,
    wealth: 1500,
    culturalTraits: {
      religiousFervor: true,
      militaryDiscipline: 0.25,
      missionaryZeal: true,
    },
    economyTraits: {
      resourceBias: {
        culture: 1.6,
        iron: 1.4,
        tools: 1.3,
        silver: 1.2,
      },
    },
    specialAbilities: [
      { type: 'holy_war', value: 0.3, desc: "圣战加成 +30%" },
      { type: 'morale_bonus', value: 0.25, desc: "士气 +25%" }
    ],
  },
  {
    id: 'merchant_republic',
    name: "自由商会",
    type: "商业共和",
    color: "text-emerald-300",
    desc: "由富商组成的共和国，掌控银行和贸易网络。",
    appearEpoch: 4,
    expireEpoch: 6,
    marketVolatility: 0.20,
    aggression: 0.25,
    wealth: 2400,
    culturalTraits: {
      financialExpertise: true,
      tradingStyle: 'capitalist',
      diplomaticModifier: 0.2,
    },
    economyTraits: {
      resourceBias: {
        silver: 1.8,
        culture: 1.4,
        science: 1.3,
        spice: 1.2,
      },
    },
    specialAbilities: [
      { type: 'banking_system', value: 0.25, desc: "利息收入 +25%" },
      { type: 'trade_network', value: 0.3, desc: "贸易网络效率 +30%" }
    ],
  },
  {
    id: 'revolutionary_state',
    name: "革命共和国",
    type: "革命政府",
    color: "text-red-300",
    desc: "推翻旧制度的革命国家，提倡自由平等，军事动员力强。",
    appearEpoch: 5,
    expireEpoch: 7,
    marketVolatility: 0.40,
    aggression: 0.6,
    wealth: 1900,
    culturalTraits: {
      revolutionaryZeal: true,
      massConscription: 0.3,
      ideologicalExport: true,
    },
    economyTraits: {
      resourceBias: {
        culture: 1.5,
        science: 1.4,
        iron: 1.3,
        food: 1.2,
      },
    },
    specialAbilities: [
      { type: 'conscription', value: 0.35, desc: "征兵效率 +35%" },
      { type: 'revolutionary_fervor', value: 0.2, desc: "战斗力 +20%" }
    ],
  },
];
