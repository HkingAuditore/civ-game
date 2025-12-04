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
triggerConditions: { minPopulation: 100, minEpoch: 1, maxEpoch: 5 },
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
triggerConditions: { minPopulation: 200, minEpoch: 2, maxEpoch: 4 },
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
triggerConditions: { minPopulation: 150, minEpoch: 2, maxEpoch: 5 },
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
triggerConditions: { minPopulation: 120, minEpoch: 1, maxEpoch: 5 },
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
triggerConditions: { minPopulation: 200, minEpoch: 2, maxEpoch: 5 },
    options: [
      {
        id: 'encourage_luxury',
        text: '顺应潮流，发展奢侈品产业',
        effects: {
          approval: { landowner: 15, merchant: 10, artisan: 10 },
          stratumDemandMod: { landowner: 0.3, landowner: 0.2 },
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
          stratumDemandMod: { landowner: -0.3, landowner: -0.2 },
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
triggerConditions: { minPopulation: 180, minEpoch: 3, maxEpoch: 6 },
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
triggerConditions: { minPopulation: 150, minEpoch: 2, maxEpoch: 5 },
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
triggerConditions: { minPopulation: 250, minEpoch: 3, maxEpoch: 5 },
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
triggerConditions: { minPopulation: 180, minEpoch: 2, maxEpoch: 4 },
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
triggerConditions: { minPopulation: 200, minEpoch: 2, maxEpoch: 5 },
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
triggerConditions: { minPopulation: 200, minEpoch: 2, maxEpoch: 5 },
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
        },
      },
      {
        id: 'smuggling',
        text: '默许走私活动',
        effects: {
          approval: { merchant: 10, official: -10 },
          resourceDemandMod: { spice: 0.1 },
          stability: -5,
        },
      },
      {
        id: 'negotiate',
        text: '外交斡旋，寻求解禁',
        effects: {
          resourcePercent: { silver: -0.03 },
          approval: { official: 5 },
        },
        randomEffects: [
          {
            chance: 0.4,
            effects: {
              resourceDemandMod: { spice: 0.2, cloth: 0.15 },
              stability: 5,
            },
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
triggerConditions: { minPopulation: 250, minEpoch: 3, maxEpoch: 6 },
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
triggerConditions: { minPopulation: 150, minEpoch: 2, maxEpoch: 5 },
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
];

export default economicEvents;
