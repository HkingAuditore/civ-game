/**
 * Static Diplomatic Events - Events that affect relations with foreign nations
 * These events can modify:
 * - nationRelation: { nationId: change } or { all: change, exclude: [] }
 * - nationAggression: { nationId: change } or { all: change }
 * - nationWealth: { nationId: change }
 * - nationMarketVolatility: { nationId: change }
 * - triggerWar: nationId (immediately start war with that nation)
 * - triggerPeace: nationId (immediately end war with that nation)
 * 
 * Special selectors for nationId:
 * - 'random': affects a random visible nation
 * - 'all': affects all visible nations
 * - 'hostile': affects nations with relation < 30
 * - 'friendly': affects nations with relation >= 60
 * - 'strongest': affects the nation with highest wealth
 * - 'weakest': affects the nation with lowest wealth
 */

export const STATIC_DIPLOMATIC_EVENTS = [
  // ========== 外交危机事件 ==========
  {
    id: 'border_dispute',
    name: '边境争端',
    icon: 'MapPin',
    description: '边境地区发生了领土纠纷，一个邻国声称对边境村庄拥有主权。紧张局势正在升级。',
    triggerConditions: { minPopulation: 100, minEpoch: 1, maxEpoch: 5 },
    options: [
      {
        id: 'negotiate',
        text: '通过外交谈判解决',
        effects: {
          resourcePercent: { silver: -0.03 },
          approval: { official: 10 },
          nationRelation: { random: 10 },
          stability: 3,
        },
      },
      {
        id: 'military_posturing',
        text: '陈兵边境，展示武力',
        effects: {
          approval: { soldier: 15, peasant: -5 },
          nationRelation: { random: -15 },
          nationAggression: { random: 0.1 },
          stability: -5,
        },
      },
      {
        id: 'concede_territory',
        text: '做出让步，换取和平',
        effects: {
          populationPercent: -0.02,
          approval: { soldier: -20, peasant: 5 },
          nationRelation: { random: 20 },
          nationAggression: { random: -0.1 },
          stability: -3,
        },
      },
    ],
  },

  {
    id: 'diplomatic_incident',
    name: '外交风波',
    icon: 'AlertTriangle',
    description: '我方外交使节在邻国遭受侮辱，对方拒绝道歉。国内舆论激愤，要求采取行动。',
    triggerConditions: { minPopulation: 150, minEpoch: 2, maxEpoch: 5 },
    options: [
      {
        id: 'demand_apology',
        text: '正式要求道歉',
        effects: {
          approval: { official: 5 },
          nationRelation: { random: -10 },
        },
        randomEffects: [
          {
            chance: 0.4,
            effects: {
              nationRelation: { random: 15 },
              stability: 5,
            },
            description: '对方迫于压力道歉了。',
          },
          {
            chance: 0.3,
            effects: {
              nationRelation: { random: -20 },
              nationAggression: { random: 0.15 },
            },
            description: '对方拒绝道歉，关系恶化。',
          },
        ],
      },
      {
        id: 'expel_diplomats',
        text: '驱逐对方外交官',
        effects: {
          approval: { soldier: 10, official: -5 },
          nationRelation: { random: -25 },
          nationAggression: { random: 0.1 },
          stability: -3,
        },
      },
      {
        id: 'ignore_incident',
        text: '低调处理，息事宁人',
        effects: {
          approval: { soldier: -10, official: -5, peasant: 5 },
          nationRelation: { random: 5 },
          stability: -5,
        },
      },
    ],
  },

  {
    id: 'spy_discovered',
    name: '间谍案',
    icon: 'Eye',
    description: '我方发现了一名外国间谍，此人正在收集军事和经济情报。如何处置？',
    triggerConditions: { minPopulation: 200, minEpoch: 2, maxEpoch: 6 },
    options: [
      {
        id: 'public_trial',
        text: '公开审判，杀一儆百',
        effects: {
          approval: { soldier: 15, official: 10 },
          nationRelation: { random: -30 },
          nationAggression: { random: 0.15 },
          stability: 5,
        },
      },
      {
        id: 'exchange_prisoners',
        text: '秘密交换囚犯',
        effects: {
          approval: { official: 5 },
          nationRelation: { random: -5 },
        },
      },
      {
        id: 'turn_double_agent',
        text: '策反为双面间谍',
        effects: {
          resourcePercent: { silver: -0.02 },
          approval: { official: 15 },
          nationWealth: { random: -200 },
        },
        randomEffects: [
          {
            chance: 0.3,
            effects: {
              nationRelation: { random: -40 },
              triggerWar: 'random',
            },
            description: '计划暴露，对方愤而宣战！',
          },
        ],
      },
    ],
  },

  // ========== 贸易外交事件 ==========
  {
    id: 'trade_delegation',
    name: '贸易使团来访',
    icon: 'Handshake',
    description: '一个富裕的邻国派来贸易使团，希望建立更紧密的商业联系。',
    triggerConditions: { minPopulation: 150, minEpoch: 2, maxEpoch: 6 },
    options: [
      {
        id: 'welcome_trade',
        text: '热情接待，签订贸易协定',
        effects: {
          resourcePercent: { silver: 0.05 },
          approval: { merchant: 20, capitalist: 15 },
          nationRelation: { random: 25 },
          nationAggression: { random: -0.1 },
          stability: 3,
        },
      },
      {
        id: 'negotiate_terms',
        text: '讨价还价，争取更好条件',
        effects: {
          approval: { merchant: 10, official: 5 },
          nationRelation: { random: 10 },
        },
        randomEffects: [
          {
            chance: 0.5,
            effects: {
              resourcePercent: { silver: 0.08 },
              nationRelation: { random: 5 },
            },
            description: '谈判成功，获得优惠条款。',
          },
          {
            chance: 0.3,
            effects: {
              nationRelation: { random: -10 },
            },
            description: '对方认为我方不够诚意。',
          },
        ],
      },
      {
        id: 'reject_delegation',
        text: '以国家安全为由拒绝',
        effects: {
          approval: { merchant: -15, soldier: 10 },
          nationRelation: { random: -20 },
          nationAggression: { random: 0.05 },
        },
      },
    ],
  },

  {
    id: 'trade_war',
    name: '贸易战',
    icon: 'Scale',
    description: '邻国突然提高关税，对我国商品设置贸易壁垒。我方商人损失惨重。',
    triggerConditions: { minPopulation: 200, minEpoch: 3, maxEpoch: 6 },
    options: [
      {
        id: 'retaliate',
        text: '以牙还牙，提高关税',
        effects: {
          approval: { merchant: 5, official: 10 },
          nationRelation: { random: -20 },
          nationWealth: { random: -300 },
          resourceDemandMod: { spice: -0.2, cloth: -0.15 },
          stability: -3,
        },
      },
      {
        id: 'seek_new_markets',
        text: '开拓新市场',
        effects: {
          resourcePercent: { silver: -0.03 },
          approval: { merchant: 10, navigator: 15 },
          nationRelation: { all: 5, exclude: ['hostile'] },
        },
      },
      {
        id: 'negotiate_end',
        text: '派使节谈判解决',
        effects: {
          resourcePercent: { silver: -0.02 },
          approval: { official: 5 },
        },
        randomEffects: [
          {
            chance: 0.5,
            effects: {
              nationRelation: { random: 15 },
              resourceDemandMod: { spice: 0.1 },
            },
            description: '谈判成功，贸易恢复正常。',
          },
        ],
      },
    ],
  },

  {
    id: 'resource_competition',
    name: '资源争夺',
    icon: 'Pickaxe',
    description: '在边境发现了丰富的矿藏，但邻国也声称对该地区拥有开采权。',
    triggerConditions: { minPopulation: 180, minEpoch: 2, maxEpoch: 5 },
    options: [
      {
        id: 'claim_territory',
        text: '强行占领，独占资源',
        effects: {
          buildingProductionMod: { mine: 0.2 },
          approval: { soldier: 15, miner: 10 },
          nationRelation: { random: -35 },
          nationAggression: { random: 0.2 },
        },
        randomEffects: [
          {
            chance: 0.3,
            effects: {
              triggerWar: 'random',
            },
            description: '对方被激怒，向我方宣战！',
          },
        ],
      },
      {
        id: 'joint_development',
        text: '提议共同开发',
        effects: {
          buildingProductionMod: { mine: 0.1 },
          approval: { official: 10 },
          nationRelation: { random: 15 },
          nationWealth: { random: 200 },
          stability: 5,
        },
      },
      {
        id: 'abandon_claim',
        text: '放弃开采权',
        effects: {
          approval: { miner: -15, soldier: -10, peasant: 5 },
          nationRelation: { random: 25 },
          nationAggression: { random: -0.15 },
        },
      },
    ],
  },

  // ========== 军事外交事件 ==========
  {
    id: 'military_alliance_offer',
    name: '同盟邀请',
    icon: 'Shield',
    description: '一个强大的邻国提议结成军事同盟，共同对抗潜在威胁。',
    triggerConditions: { minPopulation: 200, minEpoch: 2, maxEpoch: 5 },
    options: [
      {
        id: 'accept_alliance',
        text: '接受同盟',
        effects: {
          approval: { soldier: 20, official: 10 },
          nationRelation: { random: 40 },
          nationAggression: { random: -0.2 },
          stability: 5,
        },
      },
      {
        id: 'conditional_alliance',
        text: '附加条件后接受',
        effects: {
          resourcePercent: { silver: 0.03 },
          approval: { official: 15 },
          nationRelation: { random: 20 },
        },
      },
      {
        id: 'decline_politely',
        text: '婉言谢绝',
        effects: {
          approval: { merchant: 5 },
          nationRelation: { random: -10 },
        },
      },
    ],
  },

  {
    id: 'arms_race',
    name: '军备竞赛',
    icon: 'Swords',
    description: '邻国大规模扩军，边境驻军数量倍增。是跟进扩军还是寻求外交解决？',
    triggerConditions: { minPopulation: 200, minEpoch: 2, maxEpoch: 6 },
    options: [
      {
        id: 'expand_military',
        text: '加强军备，以战止战',
        effects: {
          resourcePercent: { silver: -0.08 },
          approval: { soldier: 25, worker: 10 },
          nationAggression: { random: 0.1 },
          stability: -3,
        },
      },
      {
        id: 'diplomatic_solution',
        text: '主动外交，缓解紧张',
        effects: {
          resourcePercent: { silver: -0.03 },
          approval: { official: 10, merchant: 10 },
          nationRelation: { random: 15 },
          nationAggression: { random: -0.1 },
        },
      },
      {
        id: 'seek_allies',
        text: '寻求第三方支援',
        effects: {
          resourcePercent: { silver: -0.02 },
          nationRelation: { all: 5 },
        },
        randomEffects: [
          {
            chance: 0.4,
            effects: {
              nationAggression: { random: -0.15 },
              stability: 5,
            },
            description: '获得盟友支持，对方有所收敛。',
          },
        ],
      },
    ],
  },

  {
    id: 'war_threat',
    name: '战争威胁',
    icon: 'Flame',
    description: '一个好战的邻国发出最后通牒，要求我方割让领土或支付贡金，否则将发动战争。',
    triggerConditions: { minPopulation: 150, minEpoch: 2, maxEpoch: 5 },
    options: [
      {
        id: 'refuse_and_prepare',
        text: '断然拒绝，准备迎战',
        effects: {
          approval: { soldier: 30, peasant: 10 },
          nationRelation: { hostile: -20 },
          stability: -5,
        },
        randomEffects: [
          {
            chance: 0.6,
            effects: {
              triggerWar: 'hostile',
            },
            description: '对方如期发动战争！',
          },
          {
            chance: 0.4,
            effects: {
              nationAggression: { hostile: -0.1 },
              stability: 10,
            },
            description: '对方见我方态度坚决，暂时退缩。',
          },
        ],
      },
      {
        id: 'pay_tribute',
        text: '支付贡金，避免战争',
        effects: {
          resourcePercent: { silver: -0.1 },
          approval: { soldier: -25, peasant: -10 },
          nationRelation: { hostile: 10 },
          nationAggression: { hostile: 0.1 },
          stability: -10,
        },
      },
      {
        id: 'stall_for_time',
        text: '拖延谈判，争取时间',
        effects: {
          approval: { official: 10 },
        },
        randomEffects: [
          {
            chance: 0.5,
            effects: {
              triggerWar: 'hostile',
            },
            description: '对方失去耐心，发动战争！',
          },
          {
            chance: 0.3,
            effects: {
              nationRelation: { hostile: 5 },
            },
            description: '成功拖延，局势暂时缓和。',
          },
        ],
      },
    ],
  },

  // ========== 文化外交事件 ==========
  {
    id: 'cultural_exchange',
    name: '文化交流',
    icon: 'BookOpen',
    description: '邻国学者和艺术家希望来我国访问交流，这是增进了解的好机会。',
    triggerConditions: { minPopulation: 150, minEpoch: 2, maxEpoch: 6 },
    options: [
      {
        id: 'welcome_exchange',
        text: '热情欢迎，互派使者',
        effects: {
          resourcePercent: { silver: -0.02, culture: 0.08 },
          approval: { scribe: 20, cleric: 10 },
          nationRelation: { random: 20 },
          stability: 5,
        },
      },
      {
        id: 'limited_exchange',
        text: '有限度开放',
        effects: {
          resourcePercent: { culture: 0.03 },
          approval: { scribe: 10 },
          nationRelation: { random: 10 },
        },
      },
      {
        id: 'reject_exchange',
        text: '以保护传统为由拒绝',
        effects: {
          approval: { cleric: 15, scribe: -10 },
          nationRelation: { random: -10 },
        },
      },
    ],
  },

  {
    id: 'religious_mission',
    name: '宗教传教',
    icon: 'Church',
    description: '邻国的传教士希望在我国传播他们的信仰，这引起了本地宗教人士的不满。',
    triggerConditions: { minPopulation: 150, minEpoch: 2, maxEpoch: 5 },
    options: [
      {
        id: 'allow_mission',
        text: '允许传教，宗教自由',
        effects: {
          approval: { cleric: -20, peasant: -5 },
          nationRelation: { random: 25 },
          nationAggression: { random: -0.1 },
          stability: -5,
        },
      },
      {
        id: 'restrict_mission',
        text: '限制传教活动',
        effects: {
          approval: { cleric: 10 },
          nationRelation: { random: -5 },
        },
      },
      {
        id: 'expel_missionaries',
        text: '驱逐传教士',
        effects: {
          approval: { cleric: 20, peasant: 5 },
          nationRelation: { random: -25 },
          nationAggression: { random: 0.1 },
        },
      },
    ],
  },

  // ========== 灾难外交事件 ==========
  {
    id: 'refugee_crisis',
    name: '难民潮',
    icon: 'Users',
    description: '邻国发生战乱或饥荒，大批难民涌入我国边境。',
    triggerConditions: { minPopulation: 150, minEpoch: 1, maxEpoch: 6 },
    options: [
      {
        id: 'accept_refugees',
        text: '接纳难民，提供庇护',
        effects: {
          populationPercent: 0.05,
          resourcePercent: { food: -0.05 },
          approval: { cleric: 15, peasant: -10 },
          nationRelation: { random: 20 },
          nationWealth: { random: -200 },
          stability: -5,
        },
      },
      {
        id: 'selective_admission',
        text: '有选择地接收工匠和学者',
        effects: {
          populationPercent: 0.02,
          approval: { artisan: 10, scribe: 10, peasant: -5 },
          nationRelation: { random: 5 },
        },
      },
      {
        id: 'close_borders',
        text: '关闭边境，拒绝入境',
        effects: {
          approval: { peasant: 10, soldier: 5, cleric: -10 },
          nationRelation: { random: -15 },
        },
      },
    ],
  },

  {
    id: 'plague_spread',
    name: '瘟疫蔓延',
    icon: 'Skull',
    description: '邻国爆发了可怕的瘟疫，已有迹象表明疫病可能传入我国。',
    triggerConditions: { minPopulation: 150, minEpoch: 1, maxEpoch: 5 },
    options: [
      {
        id: 'quarantine_border',
        text: '封锁边境，严防疫情',
        effects: {
          resourcePercent: { silver: -0.03 },
          approval: { merchant: -15, peasant: 10 },
          nationRelation: { all: -10 },
          resourceDemandMod: { spice: -0.3, cloth: -0.2 },
          stability: 3,
        },
      },
      {
        id: 'send_aid',
        text: '派遣医者，援助邻国',
        effects: {
          resourcePercent: { silver: -0.05 },
          approval: { cleric: 15 },
          nationRelation: { random: 30 },
          nationAggression: { random: -0.15 },
        },
        randomEffects: [
          {
            chance: 0.3,
            effects: {
              populationPercent: -0.03,
              stability: -5,
            },
            description: '部分医者染病，带回了疫情。',
          },
        ],
      },
      {
        id: 'do_nothing',
        text: '静观其变',
        effects: {},
        randomEffects: [
          {
            chance: 0.4,
            effects: {
              populationPercent: -0.05,
              stability: -10,
            },
            description: '疫病传入国内，造成重大损失。',
          },
        ],
      },
    ],
  },

  {
    id: 'natural_disaster_aid',
    name: '邻国受灾',
    icon: 'CloudLightning',
    description: '邻国遭遇严重的自然灾害，派使者前来请求援助。',
    triggerConditions: { minPopulation: 150, minEpoch: 1, maxEpoch: 6 },
    options: [
      {
        id: 'generous_aid',
        text: '慷慨援助',
        effects: {
          resourcePercent: { food: -0.05, silver: -0.03 },
          approval: { cleric: 15, official: 10 },
          nationRelation: { random: 35 },
          nationAggression: { random: -0.2 },
          nationWealth: { random: 300 },
        },
      },
      {
        id: 'modest_aid',
        text: '量力而行，适度援助',
        effects: {
          resourcePercent: { food: -0.02 },
          approval: { cleric: 5 },
          nationRelation: { random: 15 },
          nationWealth: { random: 100 },
        },
      },
      {
        id: 'exploit_weakness',
        text: '趁火打劫，扩大影响',
        effects: {
          approval: { soldier: 10, cleric: -15 },
          nationRelation: { random: -25 },
          nationAggression: { random: 0.2 },
          nationWealth: { random: -400 },
        },
        randomEffects: [
          {
            chance: 0.2,
            effects: {
              triggerWar: 'random',
            },
            description: '对方恼羞成怒，宣布开战！',
          },
        ],
      },
    ],
  },

  // ========== 王朝外交事件 ==========
  {
    id: 'royal_marriage',
    name: '联姻提议',
    icon: 'Heart',
    description: '邻国王室提议通过联姻来加强两国关系。',
    triggerConditions: { minPopulation: 200, minEpoch: 2, maxEpoch: 5 },
    options: [
      {
        id: 'accept_marriage',
        text: '接受联姻',
        effects: {
          resourcePercent: { silver: -0.05 },
          approval: { landowner: 15, official: 10 },
          nationRelation: { random: 40 },
          nationAggression: { random: -0.25 },
          stability: 5,
        },
      },
      {
        id: 'negotiate_dowry',
        text: '要求丰厚嫁妆',
        effects: {
          approval: { official: 5 },
        },
        randomEffects: [
          {
            chance: 0.5,
            effects: {
              resourcePercent: { silver: 0.08 },
              nationRelation: { random: 25 },
            },
            description: '对方同意了嫁妆要求。',
          },
          {
            chance: 0.3,
            effects: {
              nationRelation: { random: -15 },
            },
            description: '对方认为我方贪婪，取消联姻。',
          },
        ],
      },
      {
        id: 'decline_marriage',
        text: '婉言谢绝',
        effects: {
          nationRelation: { random: -10 },
        },
      },
    ],
  },

  {
    id: 'succession_crisis',
    name: '邻国内乱',
    icon: 'Crown',
    description: '邻国发生了继承权危机，多个派系争夺王位。我们要介入吗？',
    triggerConditions: { minPopulation: 200, minEpoch: 2, maxEpoch: 5 },
    options: [
      {
        id: 'support_pretender',
        text: '支持某位继承人',
        effects: {
          resourcePercent: { silver: -0.05 },
          approval: { soldier: 10, official: 10 },
        },
        randomEffects: [
          {
            chance: 0.5,
            effects: {
              nationRelation: { random: 40 },
              nationAggression: { random: -0.2 },
            },
            description: '我方支持的继承人胜出，感激我方。',
          },
          {
            chance: 0.3,
            effects: {
              nationRelation: { random: -30 },
              nationAggression: { random: 0.2 },
            },
            description: '我方支持的一方失败，新政权敌视我国。',
          },
        ],
      },
      {
        id: 'stay_neutral',
        text: '保持中立',
        effects: {
          approval: { merchant: 5 },
          nationWealth: { random: -300 },
        },
      },
      {
        id: 'seize_opportunity',
        text: '趁乱攻占边境领土',
        effects: {
          populationPercent: 0.03,
          approval: { soldier: 20 },
          nationRelation: { random: -40 },
          nationAggression: { random: 0.3 },
          stability: -5,
        },
        randomEffects: [
          {
            chance: 0.4,
            effects: {
              triggerWar: 'random',
            },
            description: '新政权统一后立即向我方宣战！',
          },
        ],
      },
    ],
  },

  // ========== 间谍与情报事件 ==========
  {
    id: 'intelligence_opportunity',
    name: '情报机会',
    icon: 'Search',
    description: '我方探子报告，邻国内部有人愿意出卖机密情报。',
    triggerConditions: { minPopulation: 200, minEpoch: 3, maxEpoch: 6 },
    options: [
      {
        id: 'buy_intelligence',
        text: '重金购买情报',
        effects: {
          resourcePercent: { silver: -0.04 },
          nationWealth: { random: -150 },
          nationMarketVolatility: { random: 0.1 },
        },
        randomEffects: [
          {
            chance: 0.3,
            effects: {
              nationRelation: { random: -30 },
            },
            description: '情报交易被发现，关系恶化。',
          },
        ],
      },
      {
        id: 'plant_agent',
        text: '安插长期内线',
        effects: {
          resourcePercent: { silver: -0.06 },
          approval: { official: 10 },
        },
        randomEffects: [
          {
            chance: 0.4,
            effects: {
              nationAggression: { random: -0.1 },
            },
            description: '内线成功潜伏，持续提供情报。',
          },
          {
            chance: 0.2,
            effects: {
              nationRelation: { random: -40 },
              triggerWar: 'random',
            },
            description: '内线被捕，对方震怒宣战！',
          },
        ],
      },
      {
        id: 'ignore_opportunity',
        text: '不参与此类事务',
        effects: {
          approval: { cleric: 5 },
          stability: 2,
        },
      },
    ],
  },

  {
    id: 'sabotage_discovered',
    name: '破坏行动',
    icon: 'Bomb',
    description: '我方发现邻国在我国境内实施破坏活动，造成了一定损失。',
    triggerConditions: { minPopulation: 200, minEpoch: 3, maxEpoch: 6 },
    options: [
      {
        id: 'retaliate_sabotage',
        text: '以其人之道还治其人之身',
        effects: {
          resourcePercent: { silver: -0.03 },
          nationWealth: { random: -500 },
          nationRelation: { random: -20 },
        },
        randomEffects: [
          {
            chance: 0.4,
            effects: {
              triggerWar: 'random',
            },
            description: '冲突升级为全面战争！',
          },
        ],
      },
      {
        id: 'demand_compensation',
        text: '要求赔偿',
        effects: {
          approval: { official: 10 },
          nationRelation: { random: -15 },
        },
        randomEffects: [
          {
            chance: 0.4,
            effects: {
              resourcePercent: { silver: 0.05 },
              nationRelation: { random: 10 },
            },
            description: '对方同意赔偿。',
          },
        ],
      },
      {
        id: 'strengthen_security',
        text: '加强国内安保',
        effects: {
          resourcePercent: { silver: -0.04 },
          approval: { soldier: 10, official: 10 },
          stability: 5,
        },
      },
    ],
  },

  // ========== 朝贡体系事件 ==========
  {
    id: 'tribute_demand',
    name: '朝贡要求',
    icon: 'Crown',
    description: '一个强大的邻国要求我方承认其宗主地位并定期进贡。',
    triggerConditions: { minPopulation: 150, minEpoch: 2, maxEpoch: 5 },
    options: [
      {
        id: 'accept_vassalage',
        text: '接受附庸地位',
        effects: {
          resourcePercent: { silver: -0.05 },
          approval: { soldier: -25, landowner: -15, peasant: 5 },
          nationRelation: { strongest: 50 },
          nationAggression: { strongest: -0.3 },
          stability: -10,
        },
      },
      {
        id: 'refuse_proudly',
        text: '断然拒绝',
        effects: {
          approval: { soldier: 20, peasant: 10 },
          nationRelation: { strongest: -30 },
          nationAggression: { strongest: 0.2 },
        },
        randomEffects: [
          {
            chance: 0.5,
            effects: {
              triggerWar: 'strongest',
            },
            description: '对方发动惩罚性战争！',
          },
        ],
      },
      {
        id: 'negotiate_terms',
        text: '讨价还价',
        effects: {
          resourcePercent: { silver: -0.02 },
          approval: { official: 10 },
          nationRelation: { strongest: 10 },
        },
      },
    ],
  },

  {
    id: 'vassal_rebellion',
    name: '属国叛变',
    icon: 'Flag',
    description: '一个曾经臣服的小国宣布独立，拒绝继续进贡。',
    triggerConditions: { minPopulation: 250, minEpoch: 3, maxEpoch: 6 },
    options: [
      {
        id: 'punitive_expedition',
        text: '发动惩罚性远征',
        effects: {
          resourcePercent: { silver: -0.08 },
          approval: { soldier: 20 },
          nationRelation: { weakest: -40 },
        },
        randomEffects: [
          {
            chance: 0.6,
            effects: {
              nationRelation: { weakest: 30 },
              nationAggression: { weakest: -0.2 },
              resourcePercent: { silver: 0.05 },
            },
            description: '远征成功，对方重新臣服。',
          },
          {
            chance: 0.3,
            effects: {
              resourcePercent: { silver: -0.05 },
              stability: -5,
            },
            description: '远征失败，损失惨重。',
          },
        ],
      },
      {
        id: 'recognize_independence',
        text: '承认其独立',
        effects: {
          approval: { soldier: -10, official: -10 },
          nationRelation: { weakest: 30 },
          stability: -5,
        },
      },
      {
        id: 'economic_pressure',
        text: '经济制裁',
        effects: {
          nationRelation: { weakest: -20 },
          nationWealth: { weakest: -400 },
        },
        randomEffects: [
          {
            chance: 0.4,
            effects: {
              nationRelation: { weakest: 20 },
            },
            description: '对方屈服于经济压力。',
          },
        ],
      },
    ],
  },

  // ========== Historical Neta: Congress of Vienna Style ==========
  {
    id: 'great_congress',
    name: '列强会议',
    icon: 'Users',
    description: '一场大战结束后，各国代表齐聚一堂，商讨重新划分势力范围。我国的利益能否得到保障？',
    triggerConditions: { minPopulation: 250, minEpoch: 5, maxEpoch: 6 },
    options: [
      {
        id: 'active_participation',
        text: '积极参与，争取利益',
        effects: {
          resourcePercent: { silver: -0.04 },
          approval: { official: 15, soldier: 10 },
          nationRelation: { all: 10 },
          stability: 5,
        },
      },
      {
        id: 'defensive_stance',
        text: '维护现状，防止损失',
        effects: {
          approval: { official: 5 },
          nationRelation: { strongest: 5 },
        },
      },
      {
        id: 'boycott_congress',
        text: '抵制会议',
        effects: {
          approval: { soldier: 10, official: -10 },
          nationRelation: { all: -15 },
          nationAggression: { all: 0.05 },
        },
      },
    ],
  },

  // ========== Historical Neta: Triple Alliance/Entente Style ==========
  {
    id: 'secret_alliance',
    name: '秘密同盟',
    icon: 'FileText',
    description: '情报显示，几个邻国正在秘密结盟。我国可能成为下一个目标。是加入还是寻求反制？',
    triggerConditions: { minPopulation: 200, minEpoch: 4, maxEpoch: 6 },
    options: [
      {
        id: 'seek_membership',
        text: '寻求加入同盟',
        effects: {
          resourcePercent: { silver: -0.03 },
          approval: { official: 10, soldier: 15 },
          nationRelation: { strongest: 30 },
          nationAggression: { weakest: 0.1 },
        },
      },
      {
        id: 'form_counter_alliance',
        text: '组建反同盟',
        effects: {
          resourcePercent: { silver: -0.05 },
          approval: { soldier: 20, official: 10 },
          nationRelation: { strongest: -20, weakest: 25 },
          nationAggression: { strongest: 0.15 },
        },
      },
      {
        id: 'remain_neutral',
        text: '武装中立',
        effects: {
          resourcePercent: { silver: -0.04 },
          approval: { merchant: 15 },
          nationRelation: { all: -5 },
        },
      },
    ],
  },

  // ========== Historical Neta: Zimmermann Telegram Style ==========
  {
    id: 'intercepted_telegram',
    name: '截获密电',
    icon: 'Mail',
    description: '我方截获了一封邻国发给第三国的密电，内容涉及共同对付我国的阴谋。是否公开这份情报？',
    triggerConditions: { minPopulation: 250, minEpoch: 5, maxEpoch: 6 },
    options: [
      {
        id: 'publish_telegram',
        text: '公开发表，揭露阴谋',
        effects: {
          approval: { official: 15, peasant: 10 },
          nationRelation: { hostile: -40 },
          nationAggression: { hostile: 0.2 },
        },
        randomEffects: [
          {
            chance: 0.4,
            effects: {
              nationRelation: { friendly: 20 },
            },
            description: '国际舆论同情我国。',
          },
        ],
      },
      {
        id: 'secret_diplomacy',
        text: '秘密交涉，要求解释',
        effects: {
          approval: { official: 10 },
          nationRelation: { hostile: -15 },
        },
        randomEffects: [
          {
            chance: 0.5,
            effects: {
              nationRelation: { hostile: 20 },
              nationAggression: { hostile: -0.1 },
            },
            description: '对方被迫取消计划。',
          },
        ],
      },
      {
        id: 'keep_secret',
        text: '秘而不宣，暗中防备',
        effects: {
          approval: { soldier: 10 },
          nationAggression: { hostile: -0.05 },
        },
      },
    ],
  },

  // ========== Historical Neta: Fashoda Incident Style ==========
  {
    id: 'colonial_standoff',
    name: '殖民地对峙',
    icon: 'Flag',
    description: '在遥远的殖民地，我国军队与邻国军队在同一地点相遇，双方都声称拥有主权。剑拔弩张，战争一触即发。',
    triggerConditions: { minPopulation: 250, minEpoch: 5, maxEpoch: 6 },
    options: [
      {
        id: 'stand_firm',
        text: '寸步不让',
        effects: {
          approval: { soldier: 25, official: 10 },
          nationRelation: { random: -35 },
          nationAggression: { random: 0.25 },
        },
        randomEffects: [
          {
            chance: 0.4,
            effects: {
              triggerWar: 'random',
            },
            description: '冲突升级为全面战争！',
          },
          {
            chance: 0.3,
            effects: {
              nationRelation: { random: 15 },
              nationAggression: { random: -0.1 },
            },
            description: '对方退让，我方获得领地。',
          },
        ],
      },
      {
        id: 'negotiate_partition',
        text: '谈判分割',
        effects: {
          approval: { official: 10, soldier: -10 },
          nationRelation: { random: 10 },
          stability: 5,
        },
      },
      {
        id: 'strategic_retreat',
        text: '战略撤退',
        effects: {
          approval: { soldier: -20, peasant: -10, merchant: 10 },
          nationRelation: { random: 20 },
          nationAggression: { random: -0.15 },
        },
      },
    ],
  },

  // ========== Historical Neta: Ems Dispatch Style ==========
  {
    id: 'diplomatic_insult',
    name: '外交羞辱',
    icon: 'MessageCircle',
    description: '邻国公开发表了一份侮辱性的外交公报，暗示我国君主懦弱无能。国内舆论沸腾，民众要求报复。',
    triggerConditions: { minPopulation: 200, minEpoch: 4, maxEpoch: 6 },
    options: [
      {
        id: 'declare_war',
        text: '"这是对整个民族的侮辱！开战！"',
        effects: {
          approval: { soldier: 30, peasant: 15, official: 10 },
          nationRelation: { random: -50 },
          triggerWar: 'random',
        },
      },
      {
        id: 'demand_retraction',
        text: '要求正式道歉',
        effects: {
          approval: { official: 10 },
          nationRelation: { random: -20 },
        },
        randomEffects: [
          {
            chance: 0.3,
            effects: {
              nationRelation: { random: 25 },
              stability: 5,
            },
            description: '对方道歉，危机化解。',
          },
          {
            chance: 0.4,
            effects: {
              nationRelation: { random: -15 },
              nationAggression: { random: 0.1 },
            },
            description: '对方拒绝道歉，局势恶化。',
          },
        ],
      },
      {
        id: 'ignore_insult',
        text: '冷处理，不予理会',
        effects: {
          approval: { soldier: -15, peasant: -10, merchant: 10 },
          nationRelation: { random: 5 },
          stability: -5,
        },
      },
    ],
  },

  // ========== Historical Neta: Assassination of Archduke Style ==========
  {
    id: 'assassination_abroad',
    name: '海外暗杀',
    icon: 'Target',
    description: '我国一位重要外交官在邻国被刺杀。凶手据称与邻国秘密组织有关。这是战争的借口还是不幸的意外？',
    triggerConditions: { minPopulation: 250, minEpoch: 5, maxEpoch: 6 },
    options: [
      {
        id: 'ultimatum',
        text: '发出最后通牒',
        effects: {
          approval: { soldier: 20, official: 15 },
          nationRelation: { random: -40 },
          nationAggression: { random: 0.2 },
        },
        randomEffects: [
          {
            chance: 0.5,
            effects: {
              triggerWar: 'random',
            },
            description: '对方拒绝接受通牒，战争爆发！',
          },
          {
            chance: 0.3,
            effects: {
              nationRelation: { random: 10 },
              resourcePercent: { silver: 0.05 },
            },
            description: '对方屈服，接受全部条件。',
          },
        ],
      },
      {
        id: 'joint_investigation',
        text: '要求联合调查',
        effects: {
          approval: { official: 10 },
          nationRelation: { random: -10 },
        },
        randomEffects: [
          {
            chance: 0.4,
            effects: {
              nationRelation: { random: 15 },
              stability: 5,
            },
            description: '调查证明是孤立事件，危机化解。',
          },
        ],
      },
      {
        id: 'measured_response',
        text: '克制回应',
        effects: {
          approval: { soldier: -10, merchant: 15 },
          nationRelation: { random: 5 },
          stability: 3,
        },
      },
    ],
  },

  // ========== Historical Neta: Opium War Style ==========
  {
    id: 'forced_trade',
    name: '强制通商',
    icon: 'Ship',
    description: '一支强大的外国舰队出现在港口，要求我国开放市场，接受不平等的贸易条款。他们的大炮令人胆寒。',
    triggerConditions: { minPopulation: 250, minEpoch: 5, maxEpoch: 6 },
    options: [
      {
        id: 'resist_invasion',
        text: '坚决抵抗！',
        effects: {
          approval: { soldier: 30, peasant: 20, merchant: -20 },
          nationRelation: { strongest: -50 },
        },
        randomEffects: [
          {
            chance: 0.7,
            effects: {
              populationPercent: -0.02,
              stability: -30,
              resourcePercent: { silver: -0.08 },
              triggerWar: 'strongest',
            },
            description: '敌军炮火猛烈，我军损失惨重！',
          },
          {
            chance: 0.2,
            effects: {
              nationRelation: { strongest: 20 },
              nationAggression: { strongest: -0.2 },
            },
            description: '出乎意料，我军取得胜利！',
          },
        ],
      },
      {
        id: 'sign_treaty',
        text: '签订条约',
        effects: {
          resourcePercent: { silver: 0.03 },
          stability: -20,
          approval: { merchant: 15, soldier: -30, peasant: -15 },
          nationRelation: { strongest: 30 },
          nationAggression: { strongest: -0.2 },
        },
      },
      {
        id: 'delay_tactics',
        text: '拖延周旋',
        effects: {
          approval: { official: 5 },
          nationRelation: { strongest: -15 },
        },
        randomEffects: [
          {
            chance: 0.5,
            effects: {
              nationAggression: { strongest: 0.15 },
              triggerWar: 'strongest',
            },
            description: '对方失去耐心，发动进攻！',
          },
        ],
      },
    ],
  },

  // ========== Historical Neta: Munich Agreement Style ==========
  {
    id: 'appeasement_demand',
    name: '绥靖要求',
    icon: 'FileText',
    description: '一个野心勃勃的邻国要求我方默认其吞并某小国，以换取"和平"。屈服还是抵抗？',
    triggerConditions: { minPopulation: 250, minEpoch: 5, maxEpoch: 6 },
    options: [
      {
        id: 'appease',
        text: '"这是我们时代的和平"',
        effects: {
          stability: 5,
          approval: { merchant: 15, soldier: -25, official: -10 },
          nationRelation: { hostile: 20 },
          nationAggression: { hostile: 0.2 },
          nationWealth: { hostile: 500 },
        },
      },
      {
        id: 'stand_against',
        text: '"坚决反对扩张"',
        effects: {
          resourcePercent: { silver: -0.02 },
          approval: { soldier: 10, official: 5 },
          nationRelation: { hostile: -15, weakest: 10 },
          nationAggression: { hostile: 0.05 },
        },
        randomEffects: [
          {
            chance: 0.1,
            effects: {
              triggerWar: 'hostile',
            },
            description: '对方不满你的态度，决定先发制人！',
          },
        ],
      },
      {
        id: 'guarantee_independence',
        text: '武装保证小国独立',
        effects: {
          resourcePercent: { silver: -0.08 },
          approval: { soldier: 25, official: 15 },
          nationRelation: { hostile: -35, weakest: 40 },
          nationAggression: { hostile: -0.1 },
        },
        randomEffects: [
          {
            chance: 0.4,
            effects: {
              triggerWar: 'hostile',
            },
            description: '你的强硬态度被视为宣战，战争爆发！',
          },
        ],
      },
    ],
  },

  // ========== Historical Neta: Suez Crisis Style ==========
  {
    id: 'strategic_canal',
    name: '运河危机',
    icon: 'Anchor',
    description: '一条重要的国际水道被邻国收归国有。依赖这条水道的列强纷纷表示抗议，战争阴云笼罩。',
    triggerConditions: { minPopulation: 250, minEpoch: 5, maxEpoch: 6 },
    options: [
      {
        id: 'support_nationalization',
        text: '支持国有化',
        effects: {
          approval: { peasant: 15, official: 10 },
          nationRelation: { random: 25, strongest: -20 },
          nationAggression: { strongest: 0.1 },
        },
      },
      {
        id: 'join_intervention',
        text: '参与军事干预',
        effects: {
          resourcePercent: { silver: -0.05 },
          approval: { soldier: 15, merchant: 10 },
          nationRelation: { random: -30, strongest: 15 },
        },
        randomEffects: [
          {
            chance: 0.4,
            effects: {
              triggerWar: 'random',
            },
            description: '干预演变为战争！',
          },
        ],
      },
      {
        id: 'call_for_negotiation',
        text: '呼吁和平解决',
        effects: {
          approval: { official: 10 },
          nationRelation: { all: 5 },
          stability: 3,
        },
      },
    ],
  },

  // ========== Historical Neta: Cuban Missile Crisis Style ==========
  {
    id: 'weapons_deployment',
    name: '边境部署',
    icon: 'Target',
    description: '情报显示邻国正在边境部署新型攻城武器/远程炮台。这是否构成直接威胁？',
    triggerConditions: { minPopulation: 200, minEpoch: 4, maxEpoch: 6 },
    options: [
      {
        id: 'demand_removal',
        text: '要求立即撤除',
        effects: {
          approval: { soldier: 20, official: 10 },
          nationRelation: { random: -25 },
        },
        randomEffects: [
          {
            chance: 0.4,
            effects: {
              nationRelation: { random: 20 },
              nationAggression: { random: -0.15 },
            },
            description: '对方同意撤除武器。',
          },
          {
            chance: 0.3,
            effects: {
              nationAggression: { random: 0.2 },
              triggerWar: 'random',
            },
            description: '谈判破裂，战争爆发！',
          },
        ],
      },
      {
        id: 'counter_deployment',
        text: '部署对等武器',
        effects: {
          resourcePercent: { silver: -0.06 },
          approval: { soldier: 20 },
          nationRelation: { random: -20 },
          nationAggression: { random: 0.1 },
          stability: -5,
        },
      },
      {
        id: 'secret_deal',
        text: '秘密交易',
        effects: {
          approval: { official: 5, soldier: -10 },
          nationRelation: { random: 15 },
          nationAggression: { random: -0.1 },
        },
      },
    ],
  },

  // ========== Historical Neta: Scramble for Africa Style ==========
  {
    id: 'colonial_conference',
    name: '瓜分会议',
    icon: 'Map',
    description: '列强召开会议，讨论如何瓜分某片"无主"土地。我国是否参与这场饕餮盛宴？',
    triggerConditions: { minPopulation: 250, minEpoch: 5, maxEpoch: 6 },
    options: [
      {
        id: 'claim_territory',
        text: '积极争取领地',
        effects: {
          resourcePercent: { silver: -0.05 },
          populationPercent: 0.02,
          approval: { soldier: 15, merchant: 20, official: 10 },
          nationRelation: { all: -10 },
        },
        randomEffects: [
          {
            chance: 0.3,
            effects: {
              nationRelation: { random: -25 },
            },
            description: '与某国的领土要求发生冲突。',
          },
        ],
      },
      {
        id: 'trade_rights_only',
        text: '只争取贸易权',
        effects: {
          resourcePercent: { silver: 0.04 },
          approval: { merchant: 15 },
          nationRelation: { all: 5 },
        },
      },
      {
        id: 'denounce_conference',
        text: '谴责殖民主义',
        effects: {
          approval: { cleric: 15, merchant: -10 },
          nationRelation: { all: -15 },
          stability: 3,
        },
      },
    ],
  },

  // ========== Historical Neta: Dreadnought Race Style ==========
  {
    id: 'naval_arms_race',
    name: '海军军备竞赛',
    icon: 'Anchor',
    description: '邻国开始建造新式巨型战舰，火力和装甲远超现有舰只。我国海军将领紧急请求追加预算。',
    triggerConditions: { minPopulation: 250, minEpoch: 5, maxEpoch: 6 },
    options: [
      {
        id: 'build_fleet',
        text: '大规模造舰',
        effects: {
          resourcePercent: { silver: -0.1 },
          buildingProductionMod: { dockyard: 0.3 },
          approval: { soldier: 25, worker: 15, merchant: -10 },
          nationRelation: { random: -15 },
          nationAggression: { random: 0.1 },
        },
      },
      {
        id: 'seek_alliance',
        text: '寻求海军强国结盟',
        effects: {
          resourcePercent: { silver: -0.03 },
          approval: { official: 10 },
          nationRelation: { strongest: 20 },
          nationAggression: { random: -0.05 },
        },
      },
      {
        id: 'develop_submarines',
        text: '发展不对称战力',
        effects: {
          resourcePercent: { silver: -0.05, science: 0.05 },
          approval: { engineer: 20, soldier: 10 },
        },
      },
    ],
  },
];

export default STATIC_DIPLOMATIC_EVENTS;
