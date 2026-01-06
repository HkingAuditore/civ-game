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
    desc: "讲求理性与艺术的古典城邦联盟，纸张与戏剧出口旺盛。",
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
    expireEpoch: 9,
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
    expireEpoch: 9,
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
    expireEpoch: 9,
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
      { type: 'culture_influence', value: 0.3, desc: "文化影响力 +30%" }
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
    expireEpoch: 9,
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
    expireEpoch: 9,
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
  // ========== 历史致敬国家 ==========
  {
    id: 'eternal_city',
    name: "永恒之城",
    type: "元老院共和",
    color: "text-red-500",
    desc: "七丘之上的城邦，元老院与公民共治，以法律和军团闻名于世。条条大路通向此城。",
    appearEpoch: 2,
    expireEpoch: 4,
    marketVolatility: 0.27,
    aggression: 0.65,
    wealth: 1600,
    culturalTraits: {
      legalTradition: true,
      militaryDiscipline: 0.3,
      infrastructureFocus: true,
    },
    economyTraits: {
      resourceBias: {
        stone: 1.5,
        iron: 1.4,
        culture: 1.3,
        silver: 1.2,
      },
    },
    specialAbilities: [
      { type: 'military_trade', desc: "石材与铁矿贸易优势" },
      { type: 'high_aggression', desc: "较高的军事扩张倾向" }
    ],
  },
  {
    id: 'golden_crescent',
    name: "新月沃土",
    type: "神庙王权",
    color: "text-yellow-400",
    desc: "两河流域的古老文明，发明了文字和轮子，建造通天塔以接近神明。",
    appearEpoch: 1,
    expireEpoch: 3,
    marketVolatility: 0.30,
    aggression: 0.45,
    wealth: 1100,
    culturalTraits: {
      cradle: true,
      writingInventor: true,
      astronomyAdvanced: true,
    },
    economyTraits: {
      resourceBias: {
        food: 1.6,
        brick: 1.5,
        papyrus: 1.4,
        culture: 1.3,
      },
    },
    specialAbilities: [
      { type: 'agricultural_trade', desc: "粮食与砖块贸易优势" },
      { type: 'cultural_focus', desc: "纸草和文化出口大国" }
    ],
  },
  {
    id: 'pyramid_kingdom',
    name: "金字塔王朝",
    type: "法老神权",
    color: "text-amber-300",
    desc: "尼罗河畔的不朽帝国，法老即神明化身，以宏伟建筑挑战永恒。",
    appearEpoch: 1,
    expireEpoch: 3,
    marketVolatility: 0.25,
    aggression: 0.35,
    wealth: 1300,
    culturalTraits: {
      monumentBuilding: true,
      divineKingship: true,
      riverCivilization: true,
    },
    economyTraits: {
      resourceBias: {
        stone: 1.8,
        food: 1.5,
        papyrus: 1.4,
        culture: 1.6,
      },
    },
    specialAbilities: [
      { type: 'stone_trade', desc: "石材贸易大国" },
      { type: 'cultural_export', desc: "文化和纸草出口优势" }
    ],
  },
  {
    id: 'agora_polis',
    name: "雅典娜城邦",
    type: "民主议会",
    color: "text-sky-400",
    desc: "橄榄树下的智慧之城，公民在广场辩论，哲学与戏剧在此诞生。",
    appearEpoch: 2,
    expireEpoch: 4,
    marketVolatility: 0.29,
    aggression: 0.30,
    wealth: 1200,
    culturalTraits: {
      democracyBirthplace: true,
      philosophyCenter: true,
      navalTradition: true,
    },
    economyTraits: {
      resourceBias: {
        culture: 2.0,
        science: 1.8,
        silver: 1.3,
        papyrus: 1.2,
      },
    },
    specialAbilities: [
      { type: 'knowledge_trade', desc: "文化与科研贸易大国" },
      { type: 'peaceful_focus', desc: "低侵略性，偏好外交" }
    ],
  },
  {
    id: 'sparta_militaris',
    name: "铁血城邦",
    type: "军事寡头",
    color: "text-red-600",
    desc: "'带着盾牌回来，或躺在盾牌上回来。'全民皆兵的战士国度。",
    appearEpoch: 2,
    expireEpoch: 4,
    marketVolatility: 0.35,
    aggression: 0.85,
    wealth: 900,
    culturalTraits: {
      militarySociety: true,
      austereLiving: true,
      helotSystem: true,
    },
    economyTraits: {
      resourceBias: {
        iron: 1.6,
        food: 1.3,
        tools: 1.2,
        culture: 0.5,
      },
    },
    specialAbilities: [
      { type: 'iron_trade', desc: "铁矿贸易优势" },
      { type: 'warlike', desc: "极高侵略性，频繁军事冲突" }
    ],
  },
  {
    id: 'carthago_nova',
    name: "迦太基商会",
    type: "商业寡头",
    color: "text-purple-400",
    desc: "地中海的贸易女王，以商船和雇佣军控制西方世界的财富流动。",
    appearEpoch: 2,
    expireEpoch: 4,
    marketVolatility: 0.26,
    aggression: 0.5,
    wealth: 1800,
    culturalTraits: {
      mercantileTradition: true,
      mercenaryArmy: true,
      navalCommerce: true,
    },
    economyTraits: {
      resourceBias: {
        silver: 1.7,
        spice: 1.5,
        plank: 1.4,
        tools: 1.2,
      },
    },
    specialAbilities: [
      { type: 'silver_trade', desc: "银币和香料贸易大国" },
      { type: 'naval_commerce', desc: "木板和工具出口优势" }
    ],
  },
  {
    id: 'viking_raiders',
    name: "北海劫掠者",
    type: "海盗联盟",
    color: "text-blue-400",
    desc: "从峡湾出发的龙船勇士，既是可怕的劫掠者，也是勇敢的探险家。",
    appearEpoch: 3,
    expireEpoch: 4,
    marketVolatility: 0.45,
    aggression: 0.8,
    wealth: 1100,
    culturalTraits: {
      seafaringMastery: true,
      raidingCulture: true,
      explorerSpirit: true,
    },
    economyTraits: {
      resourceBias: {
        plank: 1.6,
        iron: 1.4,
        food: 1.2,
        silver: 1.1,
      },
    },
    specialAbilities: [
      { type: 'timber_trade', desc: "木板与铁矿贸易优势" },
      { type: 'raider', desc: "高侵略性，频繁劫掠" }
    ],
  },
  {
    id: 'mongol_horde',
    name: "天命大汗国",
    type: "游牧帝国",
    color: "text-amber-500",
    desc: "长生天之下最伟大的征服者，铁骑席卷欧亚大陆，建立了人类历史上最大的帝国。",
    appearEpoch: 3,
    expireEpoch: 5,
    marketVolatility: 0.50,
    aggression: 0.9,
    wealth: 1600,
    culturalTraits: {
      horseLordSupremacy: true,
      rapidConquest: true,
      tradeProtection: true,
    },
    economyTraits: {
      resourceBias: {
        food: 1.4,
        iron: 1.5,
        silver: 1.3,
        spice: 1.2,
      },
    },
    specialAbilities: [
      { type: 'conquest_trade', desc: "战利品丰富（铁、银、香料）" },
      { type: 'extreme_aggression', desc: "极高侵略性，大规模征服" }
    ],
  },
  {
    id: 'shogunate',
    name: "幕府将军领",
    type: "武家政权",
    color: "text-rose-400",
    desc: "樱花与刀剑并存的岛国，武士阶层以荣誉和忠诚治国。",
    appearEpoch: 3,
    expireEpoch: 9,
    marketVolatility: 0.28,
    aggression: 0.55,
    wealth: 1400,
    culturalTraits: {
      bushidoCode: true,
      isolationism: true,
      craftExcellence: true,
    },
    economyTraits: {
      resourceBias: {
        iron: 1.5,
        culture: 1.4,
        food: 1.3,
        tools: 1.2,
      },
    },
    specialAbilities: [
      { type: 'craft_trade', desc: "铁矿与工具贸易优势" },
      { type: 'cultural_isolation', desc: "中等侵略性，倾向自给自足" }
    ],
  },  {
    id: 'ming_celestial',
    name: "天朝上国",
    type: "科举帝制",
    color: "text-yellow-500",
    desc: "自称世界中心的东方大帝国，瓷器、丝绸与火药改变了世界。",
    appearEpoch: 3,
    expireEpoch: 9,
    marketVolatility: 0.22,
    aggression: 0.35,
    wealth: 2500,
    culturalTraits: {
      celestialMandate: true,
      examSystem: true,
      tributeSystem: true,
    },
    economyTraits: {
      resourceBias: {
        culture: 1.8,
        science: 1.5,
        silver: 1.4,
        papyrus: 1.3,
      },
    },
    specialAbilities: [
      { type: 'luxury_trade', desc: "文化与科研贸易大国" },
      { type: 'wealthy_empire', desc: "巨额财富，低市场波动" }
    ],
  },
  {
    id: 'ottoman_sublime',
    name: "崇高门廷",
    type: "苏丹集权",
    color: "text-emerald-400",
    desc: "三洲帝国的统治者，以火炮和新军征服了千年古都，成为东西方的桥梁。",
    appearEpoch: 4,
    expireEpoch: 9,
    marketVolatility: 0.30,
    aggression: 0.6,
    wealth: 2000,
    culturalTraits: {
      gunpowderEmpire: true,
      janissarySystem: true,
      multiculturalRule: true,
    },
    economyTraits: {
      resourceBias: {
        spice: 1.5,
        iron: 1.4,
        culture: 1.3,
        silver: 1.3,
      },
    },
    specialAbilities: [
      { type: 'spice_trade', desc: "香料与铁矿贸易优势" },
      { type: 'expansionist', desc: "较高侵略性，军事扩张" }
    ],
  },
  {
    id: 'spanish_conquistador',
    name: "征服者王冠",
    type: "殖民帝国",
    color: "text-orange-500",
    desc: "日不落帝国的先驱，以十字架和火枪征服新大陆，金银财宝源源不断流入。",
    appearEpoch: 4,
    expireEpoch: 9,
    marketVolatility: 0.35,
    aggression: 0.7,
    wealth: 2200,
    culturalTraits: {
      conquistadorSpirit: true,
      religiousMission: true,
      colonialEmpire: true,
    },
    economyTraits: {
      resourceBias: {
        silver: 2.0,
        spice: 1.5,
        culture: 1.2,
        iron: 1.2,
      },
    },
    specialAbilities: [
      { type: 'silver_monopoly', desc: "银币贸易垄断" },
      { type: 'aggressive_colonial', desc: "高侵略性，殖民扩张" }
    ],
  },
  {
    id: 'british_empire',
    name: "海上霸权",
    type: "君主立宪",
    color: "text-blue-500",
    desc: "统治波涛的岛国，以皇家海军和东印度公司建立了真正的日不落帝国。",
    appearEpoch: 5,
    expireEpoch: 9,
    marketVolatility: 0.23,
    aggression: 0.55,
    wealth: 2800,
    culturalTraits: {
      navalSupremacy: true,
      parliamentarySystem: true,
      industrialPioneer: true,
    },
    economyTraits: {
      resourceBias: {
        coal: 1.6,
        steel: 1.5,
        silver: 1.4,
        culture: 1.3,
      },
    },
    specialAbilities: [
      { type: 'industrial_trade', desc: "煤炭与钢铁贸易大国" },
      { type: 'naval_dominance', desc: "低市场波动，稳定贸易" }
    ],
  },
  {
    id: 'prussian_eagle',
    name: "铁十字王国",
    type: "军事君主",
    color: "text-slate-400",
    desc: "纪律铸就强权。以精锐军队和高效官僚著称的北方军事强国。",
    appearEpoch: 5,
    expireEpoch: 9,
    marketVolatility: 0.25,
    aggression: 0.7,
    wealth: 2100,
    culturalTraits: {
      militaryPrecision: true,
      bureaucraticState: true,
      junkertradition: true,
    },
    economyTraits: {
      resourceBias: {
        iron: 1.6,
        coal: 1.4,
        tools: 1.3,
        science: 1.2,
      },
    },
    specialAbilities: [
      { type: 'military_industry', desc: "铁矿与煤炭贸易优势" },
      { type: 'disciplined_trade', desc: "高侵略性但低市场波动" }
    ],
  },
  {
    id: 'american_frontier',
    name: "新大陆合众国",
    type: "联邦共和",
    color: "text-blue-300",
    desc: "自由与机遇之地，拓荒者精神与民主理想在广袤大陆上生根发芽。",
    appearEpoch: 5,
    expireEpoch: 9,
    marketVolatility: 0.32,
    aggression: 0.45,
    wealth: 2300,
    culturalTraits: {
      manifestDestiny: true,
      frontierSpirit: true,
      democraticIdeals: true,
    },
    economyTraits: {
      resourceBias: {
        food: 1.5,
        coal: 1.4,
        steel: 1.3,
        silver: 1.2,
      },
    },
    specialAbilities: [
      { type: 'resource_trade', desc: "粮食与原材料贸易优势" },
      { type: 'moderate_expansion', desc: "中等侵略性，稳定发展" }
    ],
  },
  {
    id: 'tsarist_empire',
    name: "沙皇帝国",
    type: "专制帝国",
    color: "text-indigo-400",
    desc: "横跨欧亚的庞大帝国，以无尽的冬天和无尽的人力著称。",
    appearEpoch: 4,
    expireEpoch: 9,
    marketVolatility: 0.35,
    aggression: 0.6,
    wealth: 1900,
    culturalTraits: {
      vastTerritory: true,
      autocraticRule: true,
      orthodoxFaith: true,
    },
    economyTraits: {
      resourceBias: {
        food: 1.4,
        iron: 1.3,
        wood: 1.5,
        coal: 1.2,
      },
    },
    specialAbilities: [
      { type: 'timber_export', desc: "木材与铁矿出口大国" },
      { type: 'vast_resources', desc: "较高侵略性，资源丰富" }
    ],
  },
  {
    id: 'dutch_voc',
    name: "联合东印度",
    type: "商业联省",
    color: "text-orange-300",
    desc: "风车与郁金香之国，以股份公司和金融创新主宰全球贸易。",
    appearEpoch: 4,
    expireEpoch: 9,
    marketVolatility: 0.18,
    aggression: 0.3,
    wealth: 2600,
    culturalTraits: {
      financialInnovation: true,
      tradingCompany: true,
      religiousTolerance: true,
    },
    economyTraits: {
      resourceBias: {
        silver: 1.8,
        spice: 1.7,
        culture: 1.3,
        science: 1.2,
      },
    },
    specialAbilities: [
      { type: 'financial_center', desc: "银币与香料贸易垄断" },
      { type: 'stable_market', desc: "极低市场波动，和平贸易" }
    ],
  },
  {
    id: 'inca_empire',
    name: "太阳之子",
    type: "神圣帝国",
    color: "text-yellow-600",
    desc: "安第斯山脉的天选之民，以结绳记事，道路网络连接广袤帝国。",
    appearEpoch: 3,
    expireEpoch: 5,
    marketVolatility: 0.30,
    aggression: 0.4,
    wealth: 1500,
    culturalTraits: {
      sunWorship: true,
      roadNetwork: true,
      laborTax: true,
    },
    economyTraits: {
      resourceBias: {
        stone: 1.7,
        food: 1.5,
        silver: 1.4,
        culture: 1.3,
      },
    },
    specialAbilities: [
      { type: 'mountain_trade', desc: "石材与银币贸易优势" },
      { type: 'agricultural_base', desc: "粮食出口大国" }
    ],
  },
  {
    id: 'aztec_empire',
    name: "血祭帝国",
    type: "祭司王权",
    color: "text-teal-500",
    desc: "湖心城市的战士文明，以俘虏献祭太阳神，花之战争永不停息。",
    appearEpoch: 3,
    expireEpoch: 5,
    marketVolatility: 0.38,
    aggression: 0.75,
    wealth: 1300,
    culturalTraits: {
      sacrificialCulture: true,
      flowerWars: true,
      floatingGardens: true,
    },
    economyTraits: {
      resourceBias: {
        food: 1.6,
        culture: 1.5,
        stone: 1.3,
        silver: 1.2,
      },
    },
    specialAbilities: [
      { type: 'food_culture', desc: "粮食与文化贸易优势" },
      { type: 'warrior_society', desc: "高侵略性，好战文化" }
    ],
  },
  {
    id: 'byzantine_remnant',
    name: "紫衣帝都",
    type: "神圣帝国",
    color: "text-violet-400",
    desc: "千年帝国的继承者，以城墙和希腊火守护文明最后的荣光。",
    appearEpoch: 3,
    expireEpoch: 5,
    marketVolatility: 0.28,
    aggression: 0.45,
    wealth: 1700,
    culturalTraits: {
      imperialLegacy: true,
      orthodoxCenter: true,
      diplomaticMastery: true,
    },
    economyTraits: {
      resourceBias: {
        culture: 1.7,
        silver: 1.4,
        science: 1.3,
        stone: 1.2,
      },
    },
    specialAbilities: [
      { type: 'trade_focus', desc: "文化与银币贸易优势" },
      { type: 'diplomatic_focus', desc: "低侵略性，偏好和平贸易" }
    ],
  },
  {
    id: 'mali_mansa',
    name: "黄金曼萨",
    type: "商贸王国",
    color: "text-yellow-400",
    desc: "撒哈拉以南最富有的王国，曼萨朝觐麦加时，沿途金价暴跌。",
    appearEpoch: 3,
    expireEpoch: 5,
    marketVolatility: 0.25,
    aggression: 0.3,
    wealth: 2400,
    culturalTraits: {
      goldTrade: true,
      islamicLearning: true,
      transaharaTrade: true,
    },
    economyTraits: {
      resourceBias: {
        silver: 2.0,
        culture: 1.5,
        spice: 1.3,
        food: 1.2,
      },
    },
    specialAbilities: [
      { type: 'gold_trade', desc: "银币贸易垄断（极高财富）" },
      { type: 'peaceful_merchant', desc: "低侵略性，和平贸易" }
    ],
  },
  {
    id: 'mughal_splendor',
    name: "莫卧儿辉煌",
    type: "帝国王朝",
    color: "text-emerald-300",
    desc: "统治印度次大陆的伊斯兰王朝，以泰姬陵为代表的艺术成就令人叹为观止。",
    appearEpoch: 4,
    expireEpoch: 9,
    marketVolatility: 0.27,
    aggression: 0.5,
    wealth: 2300,
    culturalTraits: {
      artisticPatronage: true,
      religiousSyncretism: true,
      imperialGrandeur: true,
    },
    economyTraits: {
      resourceBias: {
        culture: 1.8,
        spice: 1.6,
        silver: 1.4,
        stone: 1.3,
      },
    },
    specialAbilities: [
      { type: 'luxury_export', desc: "文化与香料出口大国" },
      { type: 'wealthy_stable', desc: "巨额财富，中等侵略性" }
    ],
  },
  {
    id: 'zulu_impi',
    name: "战牛部落",
    type: "军事联盟",
    color: "text-green-500",
    desc: "以短矛和牛角阵法震惊殖民者的非洲战士民族，纪律严明，作战凶猛。",
    appearEpoch: 5,
    expireEpoch: 9,
    marketVolatility: 0.40,
    aggression: 0.8,
    wealth: 1000,
    culturalTraits: {
      militaryInnovation: true,
      ageRegiments: true,
      cattleWealth: true,
    },
    economyTraits: {
      resourceBias: {
        food: 1.5,
        iron: 1.3,
        tools: 1.1,
        culture: 0.8,
      },
    },
    specialAbilities: [
      { type: 'basic_resources', desc: "粮食与铁矿贸易" },
      { type: 'warrior_nation', desc: "极高侵略性，战斗民族" }
    ],
  },
  {
    id: 'polish_winged',
    name: "翼骑兵联邦",
    type: "贵族共和",
    color: "text-red-200",
    desc: "东欧平原的骑士国度，翼骑兵的冲锋是战场上最壮观的景象。",
    appearEpoch: 4,
    expireEpoch: 9,
    marketVolatility: 0.32,
    aggression: 0.55,
    wealth: 1600,
    culturalTraits: {
      nobleRepublic: true,
      cavalryTradition: true,
      religiousTolerance: true,
    },
    economyTraits: {
      resourceBias: {
        food: 1.4,
        iron: 1.3,
        culture: 1.2,
        wood: 1.2,
      },
    },
    specialAbilities: [
      { type: 'cavalry_focus', desc: "铁矿与粮食贸易优势" },
      { type: 'balanced_aggression', desc: "适度的军事倾向" }
    ],
  },
];
