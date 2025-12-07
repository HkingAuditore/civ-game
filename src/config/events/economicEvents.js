/**
 * Economic Events - Events that affect resource demand, stratum consumption, and building production
 * These events create timed modifiers that decay over time
 * 
 * Effect types:
 * - resourceDemandMod: { resourceKey: percentModifier } - affects resource consumption
 * - stratumDemandMod: { stratumKey: percentModifier } - affects stratum consumption
 * - buildingProductionMod: { buildingIdOrCat: percentModifier } - affects production output
 */

export const economicEvents = [
  // ========== 贸易与商业事件 ==========
  {
    id: 'trade_boom',
    name: '贸易繁荣',
    icon: 'Coins',
    description: '远方商队带来了大量货物和金银，市场一片繁荣。商人们摩拳擦掌，准备大展身手。',
triggerConditions: { minPopulation: 60, minEpoch: 1, maxEpoch: 5 },
    options: [
      {
        id: 'encourage_trade',
        text: '鼓励贸易，减免商税',
        effects: {
          approval: { merchant: 15, capitalist: 10 },
          resourceDemandMod: { cloth: 0.25, spice: 0.3 }, // Demand increases
          buildingProductionMod: { industry: 0.1 },
        },
      },
      {
        id: 'regulate_trade',
        text: '规范市场，征收关税',
        effects: {
          resourcePercent: { silver: 0.05 },
          approval: { merchant: -10, official: 5 },
          resourceDemandMod: { cloth: -0.1 },
        },
      },
      {
        id: 'monopolize',
        text: '国家专营，垄断贸易',
        effects: {
          resourcePercent: { silver: 0.08 },
          approval: { merchant: -20, capitalist: -15 },
          buildingProductionMod: { industry: -0.15 },
          stability: -5,
        },
      },
    ],
  },

  {
    id: 'silk_road_revival',
    name: '丝路复兴',
    icon: 'Compass',
    description: '通往西域的商路重新开通，丝绸、香料、珠宝源源不断地流入。这是千载难逢的商机！',
triggerConditions: { minPopulation: 120, minEpoch: 2, maxEpoch: 4 },
    options: [
      {
        id: 'embrace_trade',
        text: '大力发展丝路贸易',
        effects: {
          approval: { merchant: 20, capitalist: 15 },
          resourceDemandMod: { cloth: 0.4, spice: 0.5 },
          buildingProductionMod: { loom_house: 0.2, dye_works: 0.15 },
          stability: 3,
        },
      },
      {
        id: 'cautious_opening',
        text: '有限度开放，保护本地产业',
        effects: {
          approval: { artisan: 10, merchant: -5 },
          resourceDemandMod: { cloth: 0.15 },
          buildingProductionMod: { industry: 0.05 },
        },
      },
      {
        id: 'close_borders',
        text: '关闭商路，防止白银外流',
        effects: {
          approval: { merchant: -25, peasant: 5 },
          resourceDemandMod: { spice: -0.3, cloth: -0.2 },
          stability: -3,
        },
      },
    ],
  },

  // ========== 农业与粮食事件 ==========
  {
    id: 'harvest_festival',
    name: '丰收庆典',
    icon: 'Wheat',
    description: '今年风调雨顺，五谷丰登。农民们载歌载舞，庆祝这来之不易的丰收。',
    triggerConditions: { minPopulation: 50 },
    options: [
      {
        id: 'celebrate',
        text: '举办盛大庆典',
        effects: {
          resourcePercent: { silver: -0.02 },
          approval: { peasant: 15, serf: 10 },
          buildingProductionMod: { farm: 0.15, gather: 0.1 },
          stability: 5,
        },
      },
      {
        id: 'store_grain',
        text: '趁机囤积粮食',
        effects: {
          resourcePercent: { food: 0.08 },
          approval: { peasant: -5 },
          resourceDemandMod: { food: -0.1 },
        },
      },
      {
        id: 'sell_surplus',
        text: '出售余粮换取银两',
        effects: {
          resourcePercent: { food: -0.05, silver: 0.08 },
          approval: { merchant: 10 },
        },
      },
    ],
  },

  {
    id: 'locust_plague',
    name: '蝗灾来袭',
    icon: 'AlertTriangle',
    description: '遮天蔽日的蝗虫席卷而来，所过之处寸草不生。这是天降的灾祸！',
    triggerConditions: { minPopulation: 80 },
    options: [
      {
        id: 'organize_extermination',
        text: '组织民众捕杀蝗虫',
        effects: {
          resourcePercent: { silver: -0.03 },
          buildingProductionMod: { farm: -0.2, gather: -0.15 },
          approval: { peasant: 5 },
          stability: -3,
        },
      },
      {
        id: 'pray_to_gods',
        text: '祭祀祈祷，求神庇佑',
        effects: {
          resourcePercent: { silver: -0.02 },
          buildingProductionMod: { farm: -0.3 },
          approval: { cleric: 10, peasant: -5 },
          stability: -5,
        },
      },
      {
        id: 'import_grain',
        text: '紧急进口粮食',
        effects: {
          resourcePercent: { silver: -0.08 },
          resourceDemandMod: { food: 0.3 },
          approval: { peasant: 10 },
          buildingProductionMod: { farm: -0.25 },
        },
      },
    ],
  },

  // ========== 工业与生产事件 ==========
  {
    id: 'new_technology',
    name: '技术革新',
    icon: 'Lightbulb',
    description: '工匠们发明了新的生产工具，大大提高了效率。这项发明很快在各地传播开来。',
triggerConditions: { minPopulation: 80, minEpoch: 2, maxEpoch: 5 },
    options: [
      {
        id: 'promote_innovation',
        text: '推广新技术，奖励发明者',
        effects: {
          resourcePercent: { silver: -0.03, science: 0.08 },
          approval: { artisan: 15, engineer: 20 },
          buildingProductionMod: { industry: 0.2, all: 0.05 },
        },
      },
      {
        id: 'control_technology',
        text: '国家掌控技术，统一推广',
        effects: {
          resourcePercent: { science: 0.05 },
          approval: { official: 10, artisan: -10 },
          buildingProductionMod: { industry: 0.1 },
        },
      },
      {
        id: 'suppress_innovation',
        text: '禁止新技术，维护传统',
        effects: {
          approval: { artisan: -15, cleric: 10 },
          buildingProductionMod: { industry: -0.1 },
          stability: -5,
        },
      },
    ],
  },

  {
    id: 'mining_discovery',
    name: '矿脉发现',
    icon: 'Gem',
    description: '勘探者在边远地区发现了丰富的矿藏。消息传开后，大批人涌向矿区。',
triggerConditions: { minPopulation: 70, minEpoch: 1, maxEpoch: 5 },
    options: [
      {
        id: 'state_mining',
        text: '国家开采，收益归公',
        effects: {
          resourcePercent: { silver: 0.05 },
          buildingProductionMod: { mine: 0.25, quarry: 0.15 },
          approval: { miner: -10, official: 10 },
        },
      },
      {
        id: 'private_mining',
        text: '允许私人开采，征收矿税',
        effects: {
          buildingProductionMod: { mine: 0.35, quarry: 0.2 },
          approval: { miner: 15, capitalist: 10 },
          resourceDemandMod: { iron: 0.2, stone: 0.15 },
        },
      },
      {
        id: 'careful_extraction',
        text: '限制开采，保护环境',
        effects: {
          buildingProductionMod: { mine: 0.1 },
          approval: { peasant: 10, miner: -10 },
          stability: 3,
        },
      },
    ],
  },

  // ========== 消费与奢侈品事件 ==========
  {
    id: 'luxury_craze',
    name: '奢侈风潮',
    icon: 'Sparkles',
    description: '贵族们开始追捧来自远方的奢侈品，攀比之风愈演愈烈。',
triggerConditions: { minPopulation: 100, minEpoch: 2, maxEpoch: 5 },
    options: [
      {
        id: 'encourage_luxury',
        text: '顺应潮流，发展奢侈品产业',
        effects: {
          approval: { landowner: 15, merchant: 10, artisan: 10 },
          stratumDemandMod: { landowner: 0.3, merchant: 0.2 },
          resourceDemandMod: { cloth: 0.2, spice: 0.25 },
          buildingProductionMod: { loom_house: 0.15, dye_works: 0.1 },
        },
      },
      {
        id: 'tax_luxury',
        text: '对奢侈品征收重税',
        effects: {
          resourcePercent: { silver: 0.05 },
          approval: { landowner: -15, peasant: 5 },
          stratumDemandMod: { landowner: -0.15 },
        },
      },
      {
        id: 'ban_luxury',
        text: '禁止奢侈，提倡节俭',
        effects: {
          approval: { landowner: -25, cleric: 15 },
          stratumDemandMod: { landowner: -0.3, merchant: -0.2 },
          resourceDemandMod: { cloth: -0.15, spice: -0.2 },
          stability: -5,
        },
      },
    ],
  },

  {
    id: 'tea_coffee_introduction',
    name: '茶与咖啡',
    icon: 'Coffee',
    description: '一种神奇的饮品从东方/西方传入，据说能提神醒脑。很快这种饮品风靡全国。',
triggerConditions: { minPopulation: 100, minEpoch: 3, maxEpoch: 6 },
    options: [
      {
        id: 'promote_drink',
        text: '推广这种健康饮品',
        effects: {
          approval: { merchant: 15, landowner: 10 },
          resourceDemandMod: { coffee: 0.4 },
          stratumDemandMod: { landowner: 0.1, merchant: 0.15 },
          buildingProductionMod: { industry: 0.05 },
        },
      },
      {
        id: 'monopolize_trade',
        text: '国家专营，垄断利润',
        effects: {
          resourcePercent: { silver: 0.06 },
          approval: { merchant: -15 },
          resourceDemandMod: { coffee: 0.2 },
        },
      },
      {
        id: 'restrict_import',
        text: '限制进口，保护本地产业',
        effects: {
          approval: { peasant: 5, merchant: -10 },
          resourceDemandMod: { coffee: -0.1 },
        },
      },
    ],
  },

  // ========== 货币与金融事件 ==========
  {
    id: 'currency_crisis',
    name: '货币危机',
    icon: 'AlertTriangle',
    description: '市面上流通的钱币成色不足，物价飞涨，民怨沸腾。必须采取措施稳定币值。',
triggerConditions: { minPopulation: 80, minEpoch: 2, maxEpoch: 5 },
    options: [
      {
        id: 'mint_new_coins',
        text: '铸造新币，回收旧币',
        effects: {
          resourcePercent: { silver: -0.08 },
          approval: { merchant: 15, peasant: 10 },
          resourceDemandMod: { iron: 0.2, copper: 0.3 },
          stability: 5,
        },
      },
      {
        id: 'price_control',
        text: '颁布限价令',
        effects: {
          approval: { merchant: -20, peasant: 10 },
          buildingProductionMod: { industry: -0.1 },
          stability: -3,
        },
      },
      {
        id: 'do_nothing',
        text: '任其自然调节',
        effects: {
          approval: { merchant: 5, peasant: -15 },
          stratumDemandMod: { peasant: -0.2, serf: -0.2 },
          stability: -8,
        },
      },
    ],
  },

  {
    id: 'banking_emergence',
    name: '钱庄兴起',
    icon: 'Landmark',
    description: '精明的商人开始经营钱庄，提供存款和借贷服务。这种新式商业引发了不少争议。',
triggerConditions: { minPopulation: 150, minEpoch: 3, maxEpoch: 5 },
    options: [
      {
        id: 'support_banking',
        text: '支持钱庄发展',
        effects: {
          approval: { merchant: 20, capitalist: 25, cleric: -10 },
          buildingProductionMod: { industry: 0.15 },
          stratumDemandMod: { merchant: 0.1, capitalist: 0.15 },
          stability: 3,
        },
      },
      {
        id: 'regulate_banking',
        text: '严格监管金融业',
        effects: {
          approval: { merchant: -5, official: 10 },
          buildingProductionMod: { industry: 0.05 },
        },
      },
      {
        id: 'ban_usury',
        text: '禁止放贷取利',
        effects: {
          approval: { cleric: 15, merchant: -20, capitalist: -25 },
          buildingProductionMod: { industry: -0.1 },
          stability: -5,
        },
      },
    ],
  },

  // ========== 劳动力与人口事件 ==========
  {
    id: 'labor_shortage',
    name: '劳工短缺',
    icon: 'Users',
    description: '战争、瘟疫或迁徙导致劳动力严重不足，许多田地荒芜，工坊停工。',
    triggerConditions: { minPopulation: 100 },
    options: [
      {
        id: 'increase_wages',
        text: '提高工资吸引劳工',
        effects: {
          resourcePercent: { silver: -0.05 },
          approval: { peasant: 15, worker: 15, artisan: 10 },
          buildingProductionMod: { all: -0.1 },
          stratumDemandMod: { peasant: 0.1, worker: 0.1 },
        },
      },
      {
        id: 'forced_labor',
        text: '强制征召劳役',
        effects: {
          approval: { peasant: -20, serf: -25 },
          buildingProductionMod: { gather: 0.1, industry: 0.05 },
          stability: -10,
        },
      },
      {
        id: 'import_labor',
        text: '引进外来劳工',
        effects: {
          populationPercent: 0.05,
          approval: { peasant: -10 },
          buildingProductionMod: { all: 0.05 },
        },
      },
    ],
  },

  {
    id: 'guild_conflict',
    name: '行会纷争',
    icon: 'Handshake',
    description: '各行会为了争夺市场和利益，发生了激烈的冲突。街头巷尾充斥着争吵和斗殴。',
triggerConditions: { minPopulation: 100, minEpoch: 2, maxEpoch: 4 },
    options: [
      {
        id: 'mediate',
        text: '官府调解，划分市场',
        effects: {
          resourcePercent: { silver: -0.02 },
          approval: { artisan: 5, merchant: 5, official: 5 },
          buildingProductionMod: { industry: 0.05 },
          stability: 3,
        },
      },
      {
        id: 'support_guilds',
        text: '加强行会权力',
        effects: {
          approval: { artisan: 15, merchant: -10 },
          buildingProductionMod: { industry: 0.1 },
          resourceDemandMod: { tools: 0.15 },
        },
      },
      {
        id: 'abolish_guilds',
        text: '削弱行会，开放竞争',
        effects: {
          approval: { artisan: -20, merchant: 15, capitalist: 20 },
          buildingProductionMod: { industry: -0.05 },
          stability: -5,
        },
      },
    ],
  },

  // ========== 自然资源事件 ==========
  {
    id: 'forest_depletion',
    name: '森林枯竭',
    icon: 'Trees',
    description: '多年的砍伐使得森林面积锐减，木材价格飙升，连柴火都变得稀缺。',
triggerConditions: { minPopulation: 100, minEpoch: 2, maxEpoch: 5 },
    options: [
      {
        id: 'plant_trees',
        text: '植树造林，休养生息',
        effects: {
          resourcePercent: { silver: -0.03 },
          buildingProductionMod: { lumber_camp: -0.3 },
          resourceDemandMod: { wood: -0.2 },
          approval: { peasant: 5 },
          stability: 5,
        },
        randomEffects: [
          {
            chance: 0.5,
            effects: {
              buildingProductionMod: { lumber_camp: 0.2 }, // Forest recovers
            },
          },
        ],
      },
      {
        id: 'import_wood',
        text: '大量进口木材',
        effects: {
          resourcePercent: { silver: -0.05 },
          resourceDemandMod: { wood: 0.3 },
          approval: { merchant: 10 },
        },
      },
      {
        id: 'find_alternatives',
        text: '寻找替代材料',
        effects: {
          resourcePercent: { science: 0.05 },
          resourceDemandMod: { wood: -0.15, stone: 0.2, brick: 0.25 },
          buildingProductionMod: { quarry: 0.15, brickworks: 0.2 },
        },
      },
    ],
  },

  {
    id: 'salt_shortage',
    name: '盐荒',
    icon: 'Droplets',
    description: '盐业生产出了问题，这种生活必需品变得奇货可居。民间怨声载道。',
    triggerConditions: { minPopulation: 100 },
    options: [
      {
        id: 'government_distribution',
        text: '政府平价配给',
        effects: {
          resourcePercent: { silver: -0.04 },
          approval: { peasant: 15, serf: 10 },
          stratumDemandMod: { peasant: -0.1, serf: -0.1 },
          stability: 5,
        },
      },
      {
        id: 'increase_production',
        text: '扩大盐场生产',
        effects: {
          resourcePercent: { silver: -0.03 },
          buildingProductionMod: { gather: 0.1 },
          approval: { worker: 5 },
        },
      },
      {
        id: 'crack_down_hoarding',
        text: '打击囤积居奇',
        effects: {
          approval: { merchant: -15, peasant: 10 },
          stability: -3,
        },
      },
    ],
  },

  // ========== 国际贸易事件 ==========
  {
    id: 'foreign_embargo',
    name: '外国禁运',
    icon: 'Globe',
    description: '邻国宣布对我国实施贸易禁运，许多商品无法进口，价格大涨。',
triggerConditions: { minPopulation: 100, minEpoch: 2, maxEpoch: 5 },
    options: [
      {
        id: 'develop_domestic',
        text: '发展国内替代产业',
        effects: {
          resourcePercent: { silver: -0.05 },
          buildingProductionMod: { industry: 0.2 },
          resourceDemandMod: { spice: -0.3, cloth: -0.2 },
          approval: { artisan: 15, capitalist: 10 },
          stability: -3,
          nationRelation: { hostile: -10 },
        },
      },
      {
        id: 'smuggling',
        text: '默许走私活动',
        effects: {
          approval: { merchant: 10, official: -10 },
          resourceDemandMod: { spice: 0.1 },
          stability: -5,
          nationRelation: { hostile: -15 },
        },
      },
      {
        id: 'negotiate',
        text: '外交斡旋，寻求解禁',
        effects: {
          resourcePercent: { silver: -0.03 },
          approval: { official: 5 },
          nationRelation: { hostile: 5 },
        },
        randomEffects: [
          {
            chance: 0.4,
            effects: {
              resourceDemandMod: { spice: 0.2, cloth: 0.15 },
              stability: 5,
              nationRelation: { hostile: 20 },
            },
            description: '谈判成功，禁运解除！',
          },
        ],
      },
    ],
  },

  {
    id: 'trade_route_discovery',
    name: '新航路发现',
    icon: 'Ship',
    description: '探险家发现了通往富饶之地的新航路，这将彻底改变贸易格局。',
triggerConditions: { minPopulation: 250, minEpoch: 4, maxEpoch: 5 },
    options: [
      {
        id: 'fund_expedition',
        text: '资助远洋探险',
        effects: {
          resourcePercent: { silver: -0.08 },
          approval: { navigator: 25, merchant: 15 },
          resourceDemandMod: { spice: 0.5, cloth: 0.3 },
          buildingProductionMod: { dockyard: 0.3 },
        },
        randomEffects: [
          {
            chance: 0.3,
            effects: {
              resourcePercent: { silver: 0.08 },
              approval: { merchant: 10 },
            },
          },
        ],
      },
      {
        id: 'cautious_expansion',
        text: '谨慎扩张，稳步发展',
        effects: {
          resourcePercent: { silver: -0.03 },
          approval: { navigator: 10 },
          resourceDemandMod: { spice: 0.2 },
        },
      },
      {
        id: 'isolationism',
        text: '闭关锁国，专注内政',
        effects: {
          approval: { navigator: -20, merchant: -15, peasant: 10 },
          stability: 3,
        },
      },
    ],
  },

  // ========== 特殊经济事件 ==========
  {
    id: 'bubble_economy',
    name: '投机泡沫',
    icon: 'TrendingUp',
    description: '某种商品的价格被疯狂炒作，人人都想从中获利。这场狂热能持续多久？',
triggerConditions: { minPopulation: 130, minEpoch: 3, maxEpoch: 6 },
    options: [
      {
        id: 'join_speculation',
        text: '国库也参与投机',
        effects: {
          resourcePercent: { silver: -0.05 },
        },
        randomEffects: [
          {
            chance: 0.4,
            effects: {
              resourcePercent: { silver: 0.08 },
              approval: { merchant: 10 },
            },
          },
          {
            chance: 0.6,
            effects: {
              resourcePercent: { silver: -0.08 },
              stability: -10,
              approval: { merchant: -15, peasant: -10 },
            },
          },
        ],
      },
      {
        id: 'ban_speculation',
        text: '禁止投机，稳定市场',
        effects: {
          approval: { merchant: -20, capitalist: -15 },
          stability: 5,
        },
      },
      {
        id: 'warn_people',
        text: '发布警告，让民众自行判断',
        effects: {
          approval: { official: 5 },
        },
        randomEffects: [
          {
            chance: 0.5,
            effects: {
              stability: -5,
              approval: { peasant: -10 },
            },
          },
        ],
      },
    ],
  },

  {
    id: 'counterfeiting_ring',
    name: '伪币集团',
    icon: 'Shield',
    description: '官府查获了一个大规模的伪币制造集团，市面上的假币数量惊人。',
triggerConditions: { minPopulation: 80, minEpoch: 2, maxEpoch: 5 },
    options: [
      {
        id: 'harsh_punishment',
        text: '严惩伪币制造者',
        effects: {
          approval: { official: 10, merchant: 10 },
          stability: 5,
        },
      },
      {
        id: 'currency_reform',
        text: '进行货币改革',
        effects: {
          resourcePercent: { silver: -0.08 },
          approval: { merchant: 15 },
          resourceDemandMod: { copper: 0.3, iron: 0.2 },
          stability: 3,
        },
      },
      {
        id: 'cover_up',
        text: '隐瞒消息，避免恐慌',
        effects: {
          approval: { official: -10 },
          stability: -8,
        },
        randomEffects: [
          {
            chance: 0.5,
            effects: {
              approval: { peasant: -15, merchant: -15 },
              stability: -10,
            },
          },
        ],
      },
    ],
  },

  // ========== Historical Neta: Tulip Mania Style ==========
  {
    id: 'tulip_mania',
    name: '郁金香狂热',
    icon: 'Flower',
    description: '一种异域花卉突然在贵族间风靡，价格疯涨。一颗稀有品种的球茎竟然能换一栋房子！所有人都想从中牟利。',
triggerConditions: { minPopulation: 120, minEpoch: 4, maxEpoch: 5 },
    options: [
      {
        id: 'join_speculation',
        text: '国库也买入一些',
        effects: {
          resourcePercent: { silver: -0.06 },
        },
        randomEffects: [
          {
            chance: 0.3,
            effects: {
              resourcePercent: { silver: 0.12 },
              approval: { merchant: 15, landowner: 10 },
            },
            description: '价格继续上涨，大赚一笔！',
          },
          {
            chance: 0.5,
            effects: {
              resourcePercent: { silver: -0.1 },
              stability: -15,
              approval: { merchant: -20, peasant: -10 },
            },
            description: '泡沫破裂！国库损失惨重！',
          },
        ],
      },
      {
        id: 'ban_trading',
        text: '禁止投机性交易',
        effects: {
          approval: { merchant: -25, landowner: -15 },
          stability: 5,
        },
      },
      {
        id: 'tax_transactions',
        text: '对交易征收重税',
        effects: {
          resourcePercent: { silver: 0.04 },
          approval: { merchant: -15 },
        },
      },
    ],
  },

  // ========== Historical Neta: South Sea Bubble Style ==========
  {
    id: 'south_sea_bubble',
    name: '南海泡沫',
    icon: 'Ship',
    description: '一家声称垄断远洋贸易特权的公司股价飙升，连牛顿那样的天才都投入了毕生积蓄。"我能计算天体运行，却算不出人类的疯狂。"',
triggerConditions: { minPopulation: 150, minEpoch: 5, maxEpoch: 6 },
    options: [
      {
        id: 'invest_heavily',
        text: '大量购入股票',
        effects: {
          resourcePercent: { silver: -0.08 },
        },
        randomEffects: [
          {
            chance: 0.25,
            effects: {
              resourcePercent: { silver: 0.15 },
              approval: { capitalist: 20 },
            },
            description: '股价继续攀升！',
          },
          {
            chance: 0.6,
            effects: {
              resourcePercent: { silver: -0.12 },
              stability: -20,
              approval: { capitalist: -25, merchant: -15 },
            },
            description: '泡沫破裂，血本无归！',
          },
        ],
      },
      {
        id: 'regulate_market',
        text: '加强市场监管',
        effects: {
          resourcePercent: { silver: -0.02 },
          approval: { capitalist: -15, official: 10 },
          stability: 8,
        },
      },
      {
        id: 'let_it_crash',
        text: '静观其变',
        effects: {},
        randomEffects: [
          {
            chance: 0.7,
            effects: {
              stability: -15,
              approval: { merchant: -20, capitalist: -20 },
            },
            description: '泡沫破裂，经济动荡！',
          },
        ],
      },
    ],
  },

  // ========== Historical Neta: Hanseatic League Style ==========
  {
    id: 'merchant_league',
    name: '商人同盟',
    icon: 'Handshake',
    description: '几个主要港口城市的商人结成同盟，控制了大部分海上贸易。他们请求特权，作为回报将为国家提供贷款和舰船。',
triggerConditions: { minPopulation: 120, minEpoch: 3, maxEpoch: 5 },
    options: [
      {
        id: 'grant_privileges',
        text: '授予贸易特权',
        effects: {
          resourcePercent: { silver: 0.06 },
          approval: { merchant: 30, capitalist: 20, artisan: -15 },
          buildingProductionMod: { dockyard: 0.25 },
          nationRelation: { all: 10 },
        },
      },
      {
        id: 'partial_cooperation',
        text: '有限度合作',
        effects: {
          resourcePercent: { silver: 0.03 },
          approval: { merchant: 10, official: 5 },
        },
      },
      {
        id: 'reject_league',
        text: '拒绝，维护王权',
        effects: {
          approval: { merchant: -25, official: 15, soldier: 10 },
          stability: -5,
        },
      },
    ],
  },

  // ========== Historical Neta: East India Company Style ==========
  {
    id: 'trading_company',
    name: '特许贸易公司',
    icon: 'Building',
    description: '富商们请求成立一家特许贸易公司，垄断与东方/西方的贸易。他们承诺向王室缴纳丰厚的特许费。',
triggerConditions: { minPopulation: 150, minEpoch: 4, maxEpoch: 6 },
    options: [
      {
        id: 'charter_company',
        text: '批准成立',
        effects: {
          resourcePercent: { silver: 0.08 },
          approval: { merchant: 25, capitalist: 30, artisan: -10 },
          resourceDemandMod: { spice: 0.4, cloth: 0.3 },
          nationRelation: { random: 15 },
        },
      },
      {
        id: 'state_monopoly',
        text: '改为国营贸易',
        effects: {
          resourcePercent: { silver: 0.05 },
          approval: { merchant: -20, official: 15 },
          buildingProductionMod: { dockyard: 0.15 },
        },
      },
      {
        id: 'free_trade',
        text: '实行自由贸易',
        effects: {
          approval: { merchant: 15, capitalist: -10 },
          resourceDemandMod: { spice: 0.2 },
          nationRelation: { all: 5 },
        },
      },
    ],
  },

  // ========== Historical Neta: Great Famine Style ==========
  {
    id: 'great_famine',
    name: '大饥荒',
    icon: 'Skull',
    description: '连年歉收导致严重饥荒，饿殍遍野。更糟的是，粮商们趁机囤积居奇，哄抬物价。政府必须采取紧急措施。',
    triggerConditions: { minPopulation: 150, minEpoch: 2, maxEpoch: 5 },
    options: [
      {
        id: 'free_distribution',
        text: '开仓放粮，赈济灾民',
        effects: {
          resourcePercent: { food: -0.1, silver: -0.03 },
          populationPercent: -0.02,
          approval: { peasant: 25, serf: 20, merchant: -15 },
          stability: 10,
        },
      },
      {
        id: 'import_grain',
        text: '紧急进口粮食',
        effects: {
          resourcePercent: { silver: -0.08 },
          populationPercent: -0.015,
          approval: { merchant: 10, peasant: 10 },
          nationRelation: { friendly: 10 },
          nationWealth: { friendly: 200 },
        },
      },
      {
        id: 'let_market_handle',
        text: '让市场自行调节',
        effects: {
          populationPercent: -0.05,
          stability: -20,
          approval: { peasant: -30, serf: -25, merchant: 10 },
        },
      },
    ],
  },

  // ========== Historical Neta: Salt Tax Rebellion Style ==========
  {
    id: 'salt_tax_rebellion',
    name: '盐税暴动',
    icon: 'AlertTriangle',
    description: '为增加财政收入而提高的盐税引发了民间强烈不满。沿海地区出现大规模走私，内陆则爆发了抗税暴动。',
    triggerConditions: { minPopulation: 150, minEpoch: 2, maxEpoch: 5 },
    options: [
      {
        id: 'lower_tax',
        text: '降低盐税',
        effects: {
          resourcePercent: { silver: -0.04 },
          approval: { peasant: 20, merchant: 15 },
          stability: 10,
        },
      },
      {
        id: 'suppress_rebellion',
        text: '镇压暴动',
        effects: {
          resourcePercent: { silver: -0.02 },
          populationPercent: -0.01,
          approval: { peasant: -25, soldier: 10 },
          stability: -10,
        },
      },
      {
        id: 'reform_salt_system',
        text: '改革盐政',
        effects: {
          resourcePercent: { silver: -0.03 },
          approval: { official: 10, merchant: 5, peasant: 10 },
          stability: 5,
        },
      },
    ],
  },

  // ========== Historical Neta: Coinage Debasement ==========
  {
    id: 'coin_debasement',
    name: '铸币减重',
    icon: 'Coins',
    description: '财政紧张，大臣建议铸造成色不足的货币来应急。"反正百姓也分不出来。"但如果被发现，后果不堪设想。',
    triggerConditions: { minPopulation: 150, minEpoch: 2, maxEpoch: 5 },
    options: [
      {
        id: 'debase_secretly',
        text: '秘密进行',
        effects: {
          resourcePercent: { silver: 0.06 },
        },
        randomEffects: [
          {
            chance: 0.6,
            effects: {
              stability: -25,
              approval: { merchant: -30, peasant: -20 },
              resourceDemandMod: { iron: 0.3, copper: 0.2 },
            },
            description: '秘密败露！物价飞涨！',
          },
        ],
      },
      {
        id: 'open_devaluation',
        text: '公开宣布货币贬值',
        effects: {
          resourcePercent: { silver: 0.04 },
          stability: -10,
          approval: { merchant: -15, peasant: -10, official: 5 },
        },
      },
      {
        id: 'find_alternatives',
        text: '另寻财源',
        effects: {
          approval: { official: 10 },
        },
      },
    ],
  },

  // ========== Historical Neta: Enclosure Movement Style ==========
  {
    id: 'enclosure_movement',
    name: '圈地运动',
    icon: 'Fence',
    description: '地主们请求将公共牧场圈为私有，用于养羊生产羊毛。"羊吃人"的说法开始流传，失地农民何去何从？',
    triggerConditions: { minPopulation: 200, minEpoch: 4, maxEpoch: 6 },
    options: [
      {
        id: 'allow_enclosure',
        text: '批准圈地',
        effects: {
          resourceDemandMod: { cloth: 0.3 },
          buildingProductionMod: { loom_house: 0.2 },
          approval: { landowner: 25, capitalist: 15, peasant: -30, serf: -25 },
          stability: -10,
        },
      },
      {
        id: 'compensate_peasants',
        text: '圈地但补偿农民',
        effects: {
          resourcePercent: { silver: -0.05 },
          resourceDemandMod: { cloth: 0.2 },
          approval: { landowner: 10, peasant: -10 },
          stability: -3,
        },
      },
      {
        id: 'protect_commons',
        text: '保护公地',
        effects: {
          approval: { peasant: 20, serf: 15, landowner: -20, capitalist: -15 },
          stability: 5,
        },
      },
    ],
  },

  // ========== Historical Neta: Railroad Mania Style ==========
  {
    id: 'railroad_mania',
    name: '铁路狂热',
    icon: 'Train',
    description: '新发明的铁路引发投资狂潮，无数公司成立，股票价格疯涨。每个人都想修一条铁路，不管是否有实际需求。',
triggerConditions: { minPopulation: 180, minEpoch: 6, maxEpoch: 7 },
    options: [
      {
        id: 'encourage_investment',
        text: '鼓励投资',
        effects: {
          buildingProductionMod: { industry: 0.25 },
          approval: { capitalist: 25, engineer: 20, worker: 10 },
        },
        randomEffects: [
          {
            chance: 0.5,
            effects: {
              stability: -15,
              approval: { capitalist: -20 },
              resourcePercent: { silver: -0.05 },
            },
            description: '泡沫破裂，许多公司破产！',
          },
        ],
      },
      {
        id: 'state_railways',
        text: '国家统一规划',
        effects: {
          resourcePercent: { silver: -0.06 },
          buildingProductionMod: { industry: 0.15 },
          approval: { official: 15, capitalist: -10 },
          stability: 5,
        },
      },
      {
        id: 'cautious_approach',
        text: '谨慎观望',
        effects: {
          approval: { capitalist: -10, engineer: -5 },
        },
      },
    ],
  },

  // ========== Historical Neta: Bank Run Style ==========
  {
    id: 'bank_run',
    name: '银行挤兑',
    icon: 'Landmark',
    description: '谣言四起，说某家大钱庄资不抵债。恐慌的储户蜂拥而至要求提款，钱庄门前排起长龙。如果不干预，恐慌可能蔓延到整个金融体系。',
triggerConditions: { minPopulation: 150, minEpoch: 4, maxEpoch: 6 },
    options: [
      {
        id: 'bailout',
        text: '国库出资救助',
        effects: {
          resourcePercent: { silver: -0.08 },
          approval: { merchant: 15, capitalist: 20, peasant: -10 },
          stability: 10,
        },
      },
      {
        id: 'let_it_fail',
        text: '任其倒闭',
        effects: {
          approval: { merchant: -25, capitalist: -30, peasant: 5 },
          stability: -15,
          buildingProductionMod: { industry: -0.1 },
        },
      },
      {
        id: 'temporary_closure',
        text: '临时关闭所有钱庄',
        effects: {
          approval: { merchant: -15, official: 10 },
          stability: -5,
          buildingProductionMod: { industry: -0.05 },
        },
      },
    ],
  },

  // ========== 新增：供需波动事件 ==========
  
  // 季节性需求波动
  {
    id: 'winter_preparation',
    name: '寒冬将至',
    icon: 'Snowflake',
    description: '天气预示着一个严酷的冬天即将来临。人们开始囤积物资，市场上出现抢购潮。',
    triggerConditions: { minPopulation: 50 },
    options: [
      {
        id: 'encourage_stockpiling',
        text: '鼓励民众储备物资',
        effects: {
          resourceDemandMod: { food: 0.25, cloth: 0.3, wood: 0.2 },
          stratumDemandMod: { peasant: 0.15, worker: 0.12 },
          approval: { peasant: 10 },
          stability: 3,
        },
      },
      {
        id: 'price_control',
        text: '实施物价管控',
        effects: {
          resourceDemandMod: { food: 0.1, cloth: 0.15 },
          approval: { merchant: -15, peasant: 15 },
          stability: 5,
        },
      },
      {
        id: 'do_nothing',
        text: '任由市场调节',
        effects: {
          resourceDemandMod: { food: 0.35, cloth: 0.4 },
          stratumDemandMod: { landowner: 0.2, merchant: 0.15 },
          approval: { peasant: -10 },
          stability: -5,
        },
      },
    ],
  },

  // 节庆消费高峰
  {
    id: 'festival_season',
    name: '节庆旺季',
    icon: 'Gift',
    description: '一年一度的节庆即将到来，各地都在筹备庆典活动。奢侈品需求激增，商人们摩拳擦掌。',
    triggerConditions: { minPopulation: 80 },
    options: [
      {
        id: 'grand_celebration',
        text: '举办盛大庆典',
        effects: {
          resourcePercent: { silver: -0.03 },
          resourceDemandMod: { ale: 0.4, delicacies: 0.35, cloth: 0.25, spice: 0.3 },
          stratumDemandMod: { landowner: 0.25, merchant: 0.2, official: 0.15 },
          approval: { peasant: 15, merchant: 20 },
          stability: 8,
        },
      },
      {
        id: 'modest_celebration',
        text: '节俭庆祝',
        effects: {
          resourceDemandMod: { ale: 0.15, delicacies: 0.1 },
          stratumDemandMod: { peasant: 0.1 },
          approval: { peasant: 5 },
          stability: 3,
        },
      },
      {
        id: 'ban_festivities',
        text: '禁止铺张浪费',
        effects: {
          resourceDemandMod: { ale: -0.1, delicacies: -0.15, spice: -0.1 },
          stratumDemandMod: { landowner: -0.15, merchant: -0.1 },
          approval: { merchant: -20, landowner: -15, cleric: 10 },
          stability: -3,
        },
      },
    ],
  },

  // 时尚潮流
  {
    id: 'fashion_trend',
    name: '时尚风潮',
    icon: 'Shirt',
    description: '一种新的服饰风格在贵族间流行起来，很快蔓延到各个阶层。布料和染料的需求急剧上升。',
    triggerConditions: { minPopulation: 100, minEpoch: 1 },
    options: [
      {
        id: 'follow_trend',
        text: '顺应潮流',
        effects: {
          resourceDemandMod: { cloth: 0.35, fine_clothes: 0.4 },
          stratumDemandMod: { landowner: 0.3, official: 0.25, merchant: 0.2 },
          resourceSupplyMod: { cloth: 0.1 },
          approval: { landowner: 15, artisan: 10 },
          buildingProductionMod: { loom_house: 0.15, dye_works: 0.2 },
        },
      },
      {
        id: 'promote_local',
        text: '推广本地布料',
        effects: {
          resourceDemandMod: { cloth: 0.2 },
          resourceSupplyMod: { cloth: 0.2 },
          approval: { artisan: 15, merchant: -5 },
          buildingProductionMod: { loom_house: 0.25 },
        },
      },
      {
        id: 'sumptuary_laws',
        text: '颁布服饰法令限制',
        effects: {
          resourceDemandMod: { cloth: -0.1, fine_clothes: -0.2 },
          stratumDemandMod: { landowner: -0.2 },
          approval: { landowner: -20, cleric: 10, peasant: 5 },
          stability: -5,
        },
      },
    ],
  },

  // 建筑热潮
  {
    id: 'construction_boom',
    name: '建筑热潮',
    icon: 'Building2',
    description: '城市扩张和人口增长带来了一波建筑热潮。木材、石材和砖块的需求大幅上涨。',
    triggerConditions: { minPopulation: 120, minEpoch: 1 },
    options: [
      {
        id: 'support_construction',
        text: '鼓励建设',
        effects: {
          resourceDemandMod: { wood: 0.3, stone: 0.35, brick: 0.4, plank: 0.25 },
          stratumDemandMod: { worker: 0.2, artisan: 0.15 },
          resourceSupplyMod: { brick: 0.1 },
          approval: { worker: 15, capitalist: 10 },
          buildingProductionMod: { quarry: 0.2, lumber_camp: 0.15 },
        },
      },
      {
        id: 'regulate_construction',
        text: '规范建筑标准',
        effects: {
          resourceDemandMod: { stone: 0.2, brick: 0.25 },
          resourcePercent: { silver: -0.02 },
          approval: { official: 10 },
          stability: 5,
        },
      },
      {
        id: 'limit_expansion',
        text: '限制城市扩张',
        effects: {
          resourceDemandMod: { wood: -0.1, stone: -0.1 },
          approval: { capitalist: -15, worker: -10 },
          stability: 3,
        },
      },
    ],
  },

  // 军备竞赛
  {
    id: 'arms_race',
    name: '军备竞赛',
    icon: 'Sword',
    description: '邻国正在扩军备战，军事紧张局势加剧。是否应该增加军事投入？',
    triggerConditions: { minPopulation: 100, minEpoch: 1 },
    options: [
      {
        id: 'militarize',
        text: '大规模扩军',
        effects: {
          resourceDemandMod: { tools: 0.4, iron: 0.35, food: 0.2 },
          stratumDemandMod: { soldier: 0.35, knight: 0.25 },
          resourceSupplyMod: { tools: 0.15 },
          approval: { soldier: 25, knight: 20, peasant: -10 },
          stability: -5,
          buildingProductionMod: { military: 0.2 },
        },
      },
      {
        id: 'moderate_buildup',
        text: '适度增强军力',
        effects: {
          resourceDemandMod: { tools: 0.2, iron: 0.15 },
          stratumDemandMod: { soldier: 0.15 },
          approval: { soldier: 10, official: 5 },
          buildingProductionMod: { military: 0.1 },
        },
      },
      {
        id: 'diplomatic_solution',
        text: '寻求外交解决',
        effects: {
          resourcePercent: { silver: -0.02 },
          resourceDemandMod: { tools: -0.05 },
          approval: { soldier: -10, cleric: 10 },
          stability: 5,
        },
      },
    ],
  },

  // 学术繁荣
  {
    id: 'academic_boom',
    name: '学术繁荣',
    icon: 'BookOpen',
    description: '一场学术运动正在兴起，学者们热衷于著书立说，对纸张和文具的需求激增。',
    triggerConditions: { minPopulation: 80, minEpoch: 1 },
    options: [
      {
        id: 'patronize_scholars',
        text: '资助学术活动',
        effects: {
          resourcePercent: { silver: -0.03, science: 0.05 },
          resourceDemandMod: { papyrus: 0.4, culture: 0.25 },
          stratumDemandMod: { scribe: 0.3, cleric: 0.15 },
          approval: { scribe: 25, official: 10 },
          buildingProductionMod: { library: 0.2, university: 0.15 },
        },
      },
      {
        id: 'limited_support',
        text: '有限度支持',
        effects: {
          resourceDemandMod: { papyrus: 0.2 },
          stratumDemandMod: { scribe: 0.15 },
          resourcePercent: { science: 0.02 },
          approval: { scribe: 10 },
        },
      },
      {
        id: 'control_knowledge',
        text: '控制知识传播',
        effects: {
          resourceDemandMod: { papyrus: -0.1 },
          stratumDemandMod: { scribe: -0.15 },
          approval: { scribe: -20, official: 15 },
          stability: -3,
        },
      },
    ],
  },

  // 酿酒业繁荣
  {
    id: 'brewing_prosperity',
    name: '酿酒业繁荣',
    icon: 'Wine',
    description: '民间酿酒技术取得突破，酒类消费大幅增加。酒馆遍地开花，醉汉也越来越多。',
    triggerConditions: { minPopulation: 60, minEpoch: 1 },
    options: [
      {
        id: 'encourage_brewing',
        text: '鼓励酿酒业发展',
        effects: {
          resourceDemandMod: { ale: 0.35, food: 0.1 },
          stratumDemandMod: { worker: 0.15, soldier: 0.2, navigator: 0.18 },
          resourceSupplyMod: { ale: 0.2 },
          approval: { worker: 15, soldier: 10 },
          buildingProductionMod: { gather: 0.05 },
        },
      },
      {
        id: 'regulate_alcohol',
        text: '规范酒类销售',
        effects: {
          resourceDemandMod: { ale: 0.15 },
          resourcePercent: { silver: 0.02 },
          approval: { cleric: 10, worker: -5 },
          stability: 3,
        },
      },
      {
        id: 'prohibit_alcohol',
        text: '禁止过度饮酒',
        effects: {
          resourceDemandMod: { ale: -0.2 },
          stratumDemandMod: { worker: -0.1 },
          approval: { cleric: 20, worker: -20, soldier: -15 },
          stability: -8,
        },
      },
    ],
  },

  // 原材料短缺
  {
    id: 'raw_material_shortage',
    name: '原材料短缺',
    icon: 'Package',
    description: '由于各种原因，原材料供应出现短缺，价格上涨，工坊面临停工风险。',
    triggerConditions: { minPopulation: 80 },
    options: [
      {
        id: 'import_materials',
        text: '紧急进口原材料',
        effects: {
          resourcePercent: { silver: -0.04 },
          resourceSupplyMod: { wood: 0.15, iron: 0.15, copper: 0.12 },
          resourceDemandMod: { wood: 0.1, iron: 0.1 },
          approval: { artisan: 10, merchant: 5 },
        },
      },
      {
        id: 'ration_materials',
        text: '配给原材料',
        effects: {
          resourceDemandMod: { wood: -0.15, iron: -0.15, copper: -0.1 },
          buildingProductionMod: { industry: -0.1 },
          approval: { artisan: -15, official: 10 },
        },
      },
      {
        id: 'develop_alternatives',
        text: '开发替代材料',
        effects: {
          resourcePercent: { silver: -0.02, science: 0.03 },
          resourceDemandMod: { stone: 0.2, brick: 0.25 },
          resourceSupplyMod: { brick: 0.15 },
          approval: { engineer: 15 },
        },
      },
    ],
  },

  // 贵族奢靡
  {
    id: 'noble_extravagance',
    name: '贵族奢靡',
    icon: 'Crown',
    description: '贵族们的奢侈消费达到了新高度，攀比之风盛行。这带动了奢侈品产业，但也引发了平民的不满。',
    triggerConditions: { minPopulation: 120, minEpoch: 2 },
    options: [
      {
        id: 'let_them_spend',
        text: '任其挥霍',
        effects: {
          stratumDemandMod: { landowner: 0.4, official: 0.3, knight: 0.25 },
          resourceDemandMod: { delicacies: 0.35, spice: 0.3, fine_clothes: 0.4, furniture: 0.3, coffee: 0.25 },
          resourceSupplyMod: { delicacies: 0.1, fine_clothes: 0.1 },
          approval: { landowner: 20, artisan: 15, peasant: -15 },
          buildingProductionMod: { loom_house: 0.1, furniture_workshop: 0.15 },
        },
      },
      {
        id: 'tax_luxury',
        text: '对奢侈品征重税',
        effects: {
          resourcePercent: { silver: 0.04 },
          stratumDemandMod: { landowner: -0.15 },
          resourceDemandMod: { delicacies: -0.1, spice: -0.1 },
          approval: { landowner: -20, peasant: 10 },
        },
      },
      {
        id: 'moral_campaign',
        text: '发起道德运动',
        effects: {
          stratumDemandMod: { landowner: -0.25, official: -0.2 },
          resourceDemandMod: { delicacies: -0.2, spice: -0.15 },
          approval: { cleric: 20, landowner: -25, peasant: 15 },
          stability: -5,
        },
      },
    ],
  },

  // 工人涨薪
  {
    id: 'wage_demands',
    name: '涨薪诉求',
    icon: 'HandCoins',
    description: '工人们联合起来要求提高工资。如果不满足他们的要求，可能会引发罢工。',
    triggerConditions: { minPopulation: 100, minEpoch: 2 },
    options: [
      {
        id: 'raise_wages',
        text: '同意涨薪',
        effects: {
          stratumDemandMod: { worker: 0.25, artisan: 0.15, miner: 0.2 },
          resourceDemandMod: { cloth: 0.15, ale: 0.2, food: 0.12 },
          approval: { worker: 25, artisan: 15, capitalist: -20 },
          buildingProductionMod: { industry: 0.05 },
        },
      },
      {
        id: 'partial_raise',
        text: '部分涨薪',
        effects: {
          stratumDemandMod: { worker: 0.1 },
          resourceDemandMod: { cloth: 0.08 },
          approval: { worker: 5, capitalist: -10 },
        },
      },
      {
        id: 'refuse_demands',
        text: '拒绝涨薪',
        effects: {
          stratumDemandMod: { worker: -0.1 },
          approval: { worker: -25, artisan: -15, capitalist: 15 },
          stability: -10,
          buildingProductionMod: { industry: -0.15 },
        },
      },
    ],
  },

  // 咖啡热
  {
    id: 'coffee_craze',
    name: '咖啡热潮',
    icon: 'Coffee',
    description: '咖啡馆成为新的社交场所，知识分子和商人们聚集在此讨论时政。咖啡需求急剧上升。',
    triggerConditions: { minPopulation: 150, minEpoch: 4 },
    options: [
      {
        id: 'embrace_coffee',
        text: '拥抱咖啡文化',
        effects: {
          resourceDemandMod: { coffee: 0.5 },
          stratumDemandMod: { merchant: 0.2, scribe: 0.25, official: 0.15, capitalist: 0.2 },
          resourceSupplyMod: { coffee: 0.15 },
          approval: { merchant: 15, scribe: 20 },
          resourcePercent: { science: 0.02 },
        },
      },
      {
        id: 'regulate_coffeehouses',
        text: '监管咖啡馆',
        effects: {
          resourceDemandMod: { coffee: 0.2 },
          stratumDemandMod: { scribe: 0.1 },
          approval: { official: 10, merchant: -10 },
        },
      },
      {
        id: 'ban_coffeehouses',
        text: '禁止咖啡馆',
        effects: {
          resourceDemandMod: { coffee: -0.2 },
          stratumDemandMod: { merchant: -0.1, scribe: -0.15 },
          approval: { merchant: -20, scribe: -25, cleric: 10 },
          stability: -8,
        },
      },
    ],
  },

  // 家具热潮
  {
    id: 'furniture_fashion',
    name: '家具风尚',
    icon: 'Armchair',
    description: '新式家具设计风靡一时，富人们争相更换家中的陈设。木工坊日夜赶工。',
    triggerConditions: { minPopulation: 100, minEpoch: 2 },
    options: [
      {
        id: 'support_craftsmen',
        text: '支持家具产业',
        effects: {
          resourceDemandMod: { furniture: 0.4, wood: 0.25, plank: 0.3 },
          stratumDemandMod: { landowner: 0.2, official: 0.15, capitalist: 0.18 },
          resourceSupplyMod: { furniture: 0.2 },
          approval: { artisan: 20, merchant: 10 },
          buildingProductionMod: { furniture_workshop: 0.25 },
        },
      },
      {
        id: 'quality_standards',
        text: '制定质量标准',
        effects: {
          resourceDemandMod: { furniture: 0.2, wood: 0.15 },
          resourceSupplyMod: { furniture: 0.1 },
          approval: { artisan: 10, official: 10 },
        },
      },
      {
        id: 'discourage_waste',
        text: '劝导节俭',
        effects: {
          resourceDemandMod: { furniture: -0.1 },
          stratumDemandMod: { landowner: -0.1 },
          approval: { cleric: 15, landowner: -15 },
        },
      },
    ],
  },
];

export default economicEvents;
