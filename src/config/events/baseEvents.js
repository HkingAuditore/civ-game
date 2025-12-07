// Base events - Original game events
// These are the core random events that can trigger during gameplay

export const BASE_EVENTS = [
  {
    id: 'plague_outbreak',
    name: '瘟疫爆发',
    icon: 'AlertTriangle',
    image: null, // 可以添加图片路径
    description: '一场可怕的瘟疫在城市中蔓延，人们惊恐不安。医者们束手无策，死亡人数不断攀升。你必须立即采取行动来控制疫情。',
    triggerConditions: {
      minPopulation: 80,
      minEpoch: 1,
    },
    options: [
      {
        id: 'quarantine',
        text: '实施严格隔离',
        description: '封锁疫区，限制人员流动',
        effects: {
          resourcePercent: {
            food: -0.03,
            silver: -0.012,
          },
          populationPercent: -0.015,
          stability: -5,
          approval: {
            peasant: -10,
            merchant: -15,
          },
          resourceDemandMod: {
            cloth: 0.2,  // 需要绷带和隔离用品
          },
          buildingProductionMod: {
            market: -0.2,     // 市场和贸易活动受阻
          },
        },
      },
      {
        id: 'pray',
        text: '组织祈祷仪式',
        description: '向神明祈求庇佑，安抚民心',
        effects: {
          resourcePercent: {
            silver: -0.012,
          },
          populationPercent: -0.03,
          stability: 5,
          approval: {
            peasant: 10,
            cleric: 15,
          },
          resourceDemandMod: {
            culture: 0.15,  // 宗教仪式需求增加
          },
        },
      },
      {
        id: 'ignore',
        text: '听天由命',
        description: '让瘟疫自然消退',
        effects: {
          populationPercent: -0.1,
          stability: -15,
          approval: {
            peasant: -20,
            merchant: -15,
          },
          resourceDemandMod: {
            food: 0.15,     // 病人需要更多食物
          },
          buildingProductionMod: {
            all: -0.25,     // 所有建筑生产大幅下降
          },
        },
      }    ],
  },
  {
    id: 'merchant_caravan',
    name: '商队来访',
    icon: 'Users',
    image: null,
    description: '一支来自远方的商队抵达你的城市，他们带来了珍稀的货物和遥远国度的消息。商队首领希望与你进行贸易。',
    triggerConditions: {
      minEpoch: 1,
    },
    options: [
      {
        id: 'trade',
        text: '进行贸易',
        description: '用黄金购买他们的货物',
        effects: {
          resourcePercent: {
            silver: -0.02,
            delicacies: 0.02,
            furniture: 0.02,
            fine_clothes: 0.02,
            tools: 0.012,
          },
          approval: {
            merchant: 15,
          },
          resourceDemandMod: {
            spice: 0.2,        // 香料需求增加
          },
          stratumDemandMod: {
            merchant: 0.15,    // 商人活动增加
          },
          buildingProductionMod: {
            market: 0.1,       // 市场活动增加
          },
        },
      },
      {
        id: 'tax',
        text: '征收关税',
        description: '允许他们交易，但要收取高额税金',
        effects: {
          resourcePercent: {
            silver: 0.012,
          },
          approval: {
            merchant: -10,
          },
          resourceDemandMod: {
            spice: 0.05,       // 贸易仍然进行但需求减少
          },
        },
      },
      {
        id: 'refuse',
        text: '拒绝入城',
        description: '不允许外来商队进入',
        effects: {
          stability: -3,
          approval: {
            merchant: -15,
            peasant: -5,
          },
          stratumDemandMod: {
            merchant: -0.1,    // 商人活动减少
          },
          buildingProductionMod: {
            market: -0.1,     // 市场活动减少
          },
        },
      }    ],
  },
  {
    id: 'good_harvest',
    name: '丰收之年',
    icon: 'Sun',
    image: null,
    description: '今年风调雨顺，农田获得了前所未有的大丰收。粮仓堆满了金黄的谷物，人们脸上洋溢着喜悦的笑容。',
    triggerConditions: {
      minEpoch: 0,
    },
    options: [
      {
        id: 'store',
        text: '储存粮食',
        description: '将多余的粮食储存起来以备不时之需',
        effects: {
          resourcePercent: {
            food: 0.03,
          },
          approval: {
            peasant: 10,
          },
          resourceDemandMod: {
            food: -0.15,      // 食物供应充足，需求减少
          },
          buildingProductionMod: {
            farm: 0.2,        // 农田生产增加
          },
        },
      },
      {
        id: 'sell',
        text: '出售粮食',
        description: '趁价格好的时候卖出粮食换取黄金',
        effects: {
          resourcePercent: {
            food: 0.035,
            silver: 0.03,
          },
          approval: {
            merchant: 15,
            peasant: -5,
          },
          stratumDemandMod: {
            merchant: 0.15,   // 商人活动增加
          },
          buildingProductionMod: {
            market: 0.15,     // 市场活动增加
          },
        },
      },
      {
        id: 'celebrate',
        text: '举办庆典',
        description: '举办盛大的丰收庆典，与民同乐',
        effects: {
          resourcePercent: {
            food: 0.02,
            silver: -0.012,
          },
          stability: 10,
          approval: {
            peasant: 20,
            merchant: 5,
          },
          resourceDemandMod: {
            ale: 0.25,        // 庆典需要美酒
          },
        },
      }    ],
  },

  {
    id: 'technological_breakthrough',
    name: '技术突破',
    icon: 'Lightbulb',
    image: null,
    description: '你的工匠们取得了重大的技术突破！这项新技术可以显著提升生产效率，但需要投入资源来推广应用。',
    triggerConditions: {
      minEpoch: 2,
      minScience: 100,
    },
    options: [
      {
        id: 'invest',
        text: '大力推广',
        description: '投入大量资源推广新技术',
        effects: {
          resourcePercent: {
            silver: -0.03,
            tools: -0.015,
          },
          science: 0.05,
          approval: {
            artisan: 20,
            merchant: 10,
          },
          resourceDemandMod: {
            tools: 0.25,       // 新技术需要更多工具
          },
          buildingProductionMod: {
            industry: 0.15,    // 工业生产效率提升
          },
        },
      },
      {
        id: 'gradual',
        text: '逐步应用',
        description: '小规模试点，逐步推广',
        effects: {
          resourcePercent: {
            silver: -0.012,
          },
          science: 0.02,
          approval: {
            artisan: 10,
          },
          buildingProductionMod: {
            industry: 0.08,     // 工业生产略微提升
          },
        },
      },
      {
        id: 'monopoly',
        text: '技术垄断',
        description: '将技术作为国家机密，限制传播',
        effects: {
          resourcePercent: {
            silver: 0.012,
          },
          science: 0.01,
          stability: -5,
          approval: {
            artisan: -15,
            merchant: -10,
          },
          resourceDemandMod: {
            science: -0.1,     // 科研需求减少
          },
          buildingProductionMod: {
            industry: -0.05,    // 工业生产下降
          },
        },
      }    ],
  },
  {
    id: 'natural_disaster',
    name: '自然灾害',
    icon: 'CloudRain',
    image: null,
    description: '一场突如其来的自然灾害袭击了你的领地。洪水冲毁了农田，暴风摧毁了建筑，许多人失去了家园。',
    triggerConditions: {
      minPopulation: 60,
    },
    options: [
      {
        id: 'relief',
        text: '紧急救援',
        description: '动用国库资源进行紧急救援',
        effects: {
          resourcePercent: {
            silver: -0.025,
            food: -0.03,
            wood: -0.02,
          },
          stability: 5,
          approval: {
            peasant: 20,
            merchant: 5,
          },
          resourceDemandMod: {
            food: 0.25,        // 灾民需要食物
            wood: 0.3,         // 需要木材重建
          },
          buildingProductionMod: {
            farm: -0.3,        // 农田受损严重
          },
        },
      },
      {
        id: 'rebuild',
        text: '重建家园',
        description: '组织人力重建被毁的建筑',
        effects: {
          resourcePercent: {
            silver: -0.02,
            wood: -0.025,
            stone: -0.02,
          },
          approval: {
            peasant: 15,
            artisan: 10,
          },
          resourceDemandMod: {
            wood: 0.4,         // 重建需要大量木材
          },
          buildingProductionMod: {
            farm: -0.2,        // 农田仍然受损
            quarry: 0.1,      // 采石场活动增加
            lumber_camp: 0.15, // 伐木场活动增加
          },
        },
      },
      {
        id: 'minimal',
        text: '最低限度援助',
        description: '只提供基本的救援物资',
        effects: {
          resourcePercent: {
            food: -0.02,
          },
          stability: -10,
          approval: {
            peasant: -15,
            merchant: -10,
          },
          resourceDemandMod: {
            food: 0.35,        // 食物需求激增（供应不足）
          },
          buildingProductionMod: {
            farm: -0.4,        // 农田生产严重下降
          },
        },
      }    ],
  },
  {
    id: 'stone_age_hungry_peasants',
    name: '饥饿的部落农民',
    icon: 'Wheat',
    image: null,
    description: '石器时代的农地收成不佳，大量自耕农手头拮据，正在聚集到营地边缘向你抱怨。',
    triggerConditions: {
      minEpoch: 0,
      maxEpoch: 0,
      classConditions: {
        peasant: {
          minPop: 15,
          maxWealth: 250,
          minApproval: 0,
          maxApproval: 55,
        },
      },
    },
    options: [
      {
        id: 'share_food',
        text: '从仓库中分粮',
        description: '动用库存粮食平抚农民情绪。',
        effects: {
          resourcePercent: {
            food: -0.015,
          },
          stability: 5,
          approval: {
            peasant: 18,
          },
        },
      },
      {
        id: 'organize_hunt',
        text: '组织集体狩猎',
        description: '鼓励农民进入荒野狩猎，以劳动换取补给。',
        effects: {
          resourcePercent: {
            food: 0.015,
          },
          stability: -3,
          approval: {
            peasant: 8,
          },
        },
      },
      {
        id: 'ignore_hunger',
        text: '告诉他们"咬牙挺过去"',
        description: '避免动用库存，但可能激起更深的不满。',
        effects: {
          stability: -8,
          approval: {
            peasant: -18,
          },
        },
      },    ],
  },
  {
    id: 'stone_age_elder_council',
    name: '长老之议',
    icon: 'ScrollText',
    image: null,
    description: '部落中的长老们召集了一次篝火议会，他们认为你在分配资源时有欠公允。',
    triggerConditions: {
      minEpoch: 0,
      classConditions: {
        peasant: {
          minPop: 10,
        },
        cleric: {
          maxPop: 2,
          maxApproval: 70,
        },
      },
    },
    options: [
      {
        id: 'ritual_apology',
        text: '举行象征性的道歉仪式',
        description: '在火堆前庄严宣誓要更公正地分配资源。',
        effects: {
          stability: 4,
          approval: {
            peasant: 10,
            cleric: 5,
          },
          resourceDemandMod: {
            culture: 0.1,    // 仪式增加文化需求
          },
          stratumDemandMod: {
            cleric: 0.08,    // 神职人员活动增加
          },
          buildingProductionMod: {
            lumber_camp: 0.05,    // 采集活动略微增加（准备仪式材料）
          },
        },
      },
      {
        id: 'gift_to_elder',
        text: '赠予长老礼物',
        description: '以私下馈赠换取支持。',
        effects: {
          resourcePercent: {
            silver: -0.028,
          },
          stability: 2,
          approval: {
            peasant: -5,
            cleric: 12,
          },
          resourceDemandMod: {
            silver: 0.05,    // 礼物消费增加白银需求
          },
          stratumDemandMod: {
            cleric: 0.1,     // 神职人员活动增加（接收礼物）
          },
          buildingProductionMod: {
            stone_tool_workshop: 0.05,  // 手工业生产略微增加（制造礼物）
          },
        },
      },
      {
        id: 'reject_council',
        text: '无视长老的质疑',
        description: '强调你的权威，拒绝重新讨论分配方案。',
        effects: {
          stability: -6,
          approval: {
            peasant: -8,
            cleric: -6,
          },
          resourceDemandMod: {
            culture: -0.08,   // 拒绝仪式减少文化需求
          },
          stratumDemandMod: {
            cleric: -0.1,     // 神职人员活动减少
          },
          buildingProductionMod: {
            lumber_camp: -0.03,    // 采集活动略微减少
          },
        },
      },
    ],
  },
  {
    id: 'bronze_age_miner_unrest',
    name: '矿工的怨声',
    icon: 'Pickaxe',
    image: null,
    description: '矿道里传来争吵声，矿工们抱怨危险的工作环境和微薄的回报。',
    triggerConditions: {
      minEpoch: 1,
      classConditions: {
        miner: {
          minPop: 12,
          maxApproval: 55,
        },
      },
    },
    options: [
      {
        id: 'improve_safety',
        text: '投资改善矿井安全',
        description: '加固支架、修缮通风，降低事故风险。',
        effects: {
          resourcePercent: {
            wood: -0.06,
            stone: -0.045,
          },
          stability: 6,
          approval: {
            miner: 18,
            worker: 5,
          },
          resourceDemandMod: {
            wood: 0.1,      // 改善安全需要更多木材
            stone: 0.08,    // 需要更多石料
            tools: 0.05,    // 需要工具进行改造
          },
          stratumDemandMod: {
            miner: 0.15,    // 矿工活动增加
            worker: 0.08,   // 工人活动增加
          },
          buildingProductionMod: {
            copper_mine: 0.1,      // 矿山生产效率提高
            quarry: 0.05,   // 采石场活动增加
          },
        },
      },
      {
        id: 'raise_wage',
        text: '提高矿工待遇',
        description: '用额外报酬换取安静。',
        effects: {
          resourcePercent: {
            silver: -0.022,
          },
          stability: 3,
          approval: {
            miner: 15,
          },
          resourceDemandMod: {
            silver: 0.08,    // 提高待遇增加白银流通
            food: 0.05,      // 矿工有更多钱购买食物
          },
          stratumDemandMod: {
            miner: 0.12,     // 矿工活动增加
          },
          buildingProductionMod: {
            copper_mine: 0.08,      // 矿山生产略微提高
          },
        },
      },
      {
        id: 'crackdown_miner',
        text: '严厉镇压闹事者',
        description: '以武力强行恢复秩序。',
        effects: {
          stability: -10,
          approval: {
            miner: -20,
            soldier: 8,
          },
          resourceDemandMod: {
            tools: 0.1,      // 镇压需要更多武器/工具
            food: 0.05,      // 士兵需要食物
          },
          stratumDemandMod: {
            miner: -0.2,     // 矿工活动大幅减少
            soldier: 0.15,   // 士兵活动增加
          },
          buildingProductionMod: {
            copper_mine: -0.15,     // 矿山生产减少
          },
        },
      },
    ],
  },
  {
    id: 'bronze_age_merchant_boom',
    name: '商路初兴',
    icon: 'Coins',
    image: null,
    description: '青铜器和奢侈品的远途贸易开始兴旺，商人阶层气焰陡涨。',
    triggerConditions: {
      minEpoch: 1,
      classConditions: {
        merchant: {
          minPop: 3,
          minInfluenceShare: 0.18,
          minWealthShare: 0.18,
        },
      },
    },
    options: [
      {
        id: 'support_merchant',
        text: '大开贸易之门',
        description: '给予商人更多自由和保护。',
        effects: {
          resourcePercent: {
            silver: 0.012,
          },
          stability: -3,
          approval: {
            merchant: 20,
            peasant: -6,
          },
          resourceDemandMod: {
            spice: 0.15,     // 贸易增加香料需求
            cloth: 0.1,      // 增加布料需求
            delicacies: 0.08, // 增加珍馐需求
          },
          stratumDemandMod: {
            merchant: 0.2,   // 商人活动大幅增加
            peasant: -0.05,  // 农民活动略微减少（转向贸易）
          },
          buildingProductionMod: {
            market: 0.15,    // 市场活动增加
            bronze_foundry: 0.05,  // 工业生产略微增加
          },
        },
      },
      {
        id: 'tax_merchant',
        text: '适度征收商路税',
        description: '从商贸繁荣中为国库抽取一份。',
        effects: {
          resourcePercent: {
            silver: 0.028,
          },
          stability: 1,
          approval: {
            merchant: -10,
            peasant: 4,
          },
          resourceDemandMod: {
            spice: 0.05,       // 贸易仍然进行但需求略微增加
            cloth: 0.05,
            delicacies: 0.03,  // 奢侈品需求略微增加
          },
          stratumDemandMod: {
            merchant: -0.08,   // 商人活动减少（因税收）
            peasant: 0.05,     // 农民活动略微增加
          },
          buildingProductionMod: {
            market: 0.05,      // 市场活动略微增加（税收不阻碍贸易）
          },
        },
      },
      {
        id: 'protect_peasant',
        text: '限制商人囤积粮食',
        description: '防止商人借机抬价，维护农民生计。',
        effects: {
          stability: 4,
          approval: {
            merchant: -12,
            peasant: 10,
          },
          resourceDemandMod: {
            food: -0.08,       // 粮食需求减少（价格稳定）
            spice: -0.1,       // 香料需求减少（限制商人）
          },
          stratumDemandMod: {
            merchant: -0.15,   // 商人活动减少
            peasant: 0.12,     // 农民活动增加
          },
          buildingProductionMod: {
            farm: 0.08,        // 农场生产增加（粮食供应稳定）
            market: -0.1,      // 市场活动减少
          },
        },
      },
    ],
  },
  {
    id: 'classical_scribe_salon',
    name: '学者沙龙',
    icon: 'BookOpen',
    image: null,
    description: '古典时代的城市中出现了学者聚会，他们在公共广场辩论国家走向。',
    triggerConditions: {
      minEpoch: 2,
      minScience: 800,
      classConditions: {
        scribe: {
          minPop: 4,
        },
        scribe: {
          minInfluenceShare: 0.12,
          minApproval: 60,
        },
      },
    },
    options: [
      {
        id: 'fund_academy',
        text: '资助学术集会',
        description: '为学者提供纸草和津贴，鼓励他们著书立说。',
        effects: {
          resourcePercent: {
            papyrus: -80,
            silver: -0.02,
            science: 0.08,
          },
          approval: {
            scribe: 15,
          },
          resourceDemandMod: {
            papyrus: 0.1,      // 学术活动增加纸草需求
            science: 0.12,     // 科研需求增加
            culture: 0.08,     // 文化需求增加
          },
          stratumDemandMod: {
            scribe: 0.15,      // 文士活动增加
          },
          buildingProductionMod: {
            school: 0.1,       // 学校活动增加
            library: 0.08,     // 图书馆活动增加
          },
        },
      },
      {
        id: 'guide_public_opinion',
        text: '借用学者引导舆论',
        description: '让学者公开支持你的统治。',
        effects: {
          stability: 6,
          approval: {
            scribe: 5,
            peasant: 6,
          },
          resourceDemandMod: {
            culture: 0.08,      // 舆论引导增加文化需求
          },
          stratumDemandMod: {
            scribe: 0.08,       // 文士活动增加（舆论工作）
            peasant: 0.05,      // 农民参与度增加
          },
          buildingProductionMod: {
            market: 0.03,       // 市场活动略微增加（信息传播）
          },
        },
      },
      {
        id: 'limit_discussion',
        text: '限制敏感议题',
        description: '命令学者避谈税制和贵族特权。',
        effects: {
          stability: 3,
          approval: {
            scribe: -12,
            landowner: 8,
          },
          resourceDemandMod: {
            culture: -0.1,      // 限制讨论减少文化需求
            science: -0.08,     // 科研需求减少
          },
          stratumDemandMod: {
            scribe: -0.15,      // 文士活动减少
            landowner: 0.1,     // 地主活动增加
          },
          buildingProductionMod: {
            library: -0.08,      // 学校活动减少
          },
        },
      },
    ],
  },
  {
    id: 'classical_landowner_pressure',
    name: '庄园贵族施压',
    icon: 'Castle',
    image: null,
    description: '土地集中在少数地主手中，他们联合起来要求进一步的特权。',
    triggerConditions: {
      minEpoch: 2,
      classConditions: {
        landowner: {
          minWealthShare: 0.25,
          minInfluenceShare: 0.2,
        },
        peasant: {
          maxApproval: 55,
        },
      },
    },
    options: [
      {
        id: 'grant_privileges',
        text: '妥协，授予更多特权',
        description: '换取庄园贵族的政治支持。',
        effects: {
          stability: 4,
          approval: {
            landowner: 18,
            peasant: -10,
            serf: -8,
          },
          resourceDemandMod: {
            delicacies: 0.12,   // 地主消费奢侈品增加
            fine_clothes: 0.1,  // 精美服装需求增加
            furniture: 0.08,    // 家具需求增加
          },
          stratumDemandMod: {
            landowner: 0.2,     // 地主活动大幅增加
            peasant: -0.12,     // 农民活动减少
            serf: -0.1,         // 农奴活动减少
          },
          buildingProductionMod: { // 贵族庄园生产效率下降
            farm: -0.08,        // 农场生产减少（农民不满）
        
          },
        },
      },
      {
        id: 'balance_reform',
        text: '推动适度土地改革',
        description: '在不激怒贵族的前提下，释放部分土地给自耕农。',
        effects: {
          stability: -4,
          approval: {
            landowner: -12,
            peasant: 12,
          },
          resourceDemandMod: {
            tools: 0.08,        // 农民需要更多农具
            food: 0.06,         // 农民粮食需求增加
          },
          stratumDemandMod: {
            landowner: -0.15,   // 地主活动减少
            peasant: 0.15,      // 农民活动增加
          },
          buildingProductionMod: {
            farm: 0.08,          // 农场生产增加
          },
        },
      },
      {
        id: 'stand_with_people',
        text: '公开站在农民一边',
        description: '指责地主贪婪，赢得民心。',
        effects: {
          stability: -10,
          approval: {
            landowner: -22,
            peasant: 20,
          },
          resourceDemandMod: {
            food: 0.12,         // 农民获得更多土地，粮食需求增加
            tools: 0.15,        // 需要更多农具
          },
          stratumDemandMod: {
            landowner: -0.25,   // 地主活动大幅减少
            peasant: 0.22,      // 农民活动大幅增加
          },
          buildingProductionMod: {
            farm: 0.15,         // 农场生产大幅增加
          },
        },
      },
    ],
  },
  {
    id: 'feudal_knight_parade',
    name: '骑士炫耀武力',
    icon: 'Shield',
    image: null,
    description: '一支骄矜的骑士团在城中游行，高声夸耀他们对王权的重要性。',
    triggerConditions: {
      minEpoch: 3,
      classConditions: {
        knight: {
          minPop: 3,
          minInfluenceShare: 0.15,
        },
        soldier: {
          maxApproval: 70,
        },
      },
    },
    options: [
      {
        id: 'hold_tournament',
        text: '举办比武大会',
        description: '以公开竞赛的方式安抚骑士与军队的虚荣。',
        effects: {
          resourcePercent: {
            food: -0.05,
            silver: -0.022,
          },
          stability: 6,
          approval: {
            knight: 15,
            soldier: 8,
            peasant: 4,
          },
          resourceDemandMod: {
            food: 0.08,        // 比武大会消耗食物
            ale: 0.12,         // 需要大量美酒
            cloth: 0.1,        // 需要彩旗和服装
          },
          stratumDemandMod: {
            knight: 0.18,      // 骑士活动大幅增加
            soldier: 0.1,      // 士兵活动增加
            peasant: 0.06,     // 农民参与观看
          },
          buildingProductionMod: {
            market: 0.08,      // 市场活动增加（观众消费）
            brewery: 0.1,       // 酒馆活动增加
          },
        },
      },
      {
        id: 'praise_soldiers',
        text: '公开赞扬普通士兵',
        description: '在演讲中强调普通军人的贡献。',
        effects: {
          stability: 3,
          approval: {
            soldier: 15,
            knight: -8,
          },
          resourceDemandMod: {
            food: 0.05,        // 士兵需要食物补给
            tools: 0.08,       // 需要武器和维护工具
          },
          stratumDemandMod: {
            soldier: 0.12,     // 士兵活动增加（士气提升）
            knight: -0.1,      // 骑士活动减少
          },
          buildingProductionMod: {
            training_ground: 0.1,     // 军营活动增加
          },
        },
      },
      {
        id: 'limit_knight_power',
        text: '限制骑士在地方的武装权',
        description: '要求骑士团登记武器与兵员。',
        effects: {
          stability: -8,
          approval: {
            knight: -20,
            landowner: -10,
          },
          resourceDemandMod: {
            tools: -0.1,        // 武器需求减少（限制骑士武装）
            furniture: -0.05,   // 奢侈品需求减少
          },
          stratumDemandMod: {
            knight: -0.18,      // 骑士活动大幅减少
            landowner: -0.08,   // 地主活动减少
            official: 0.1,      // 官员活动增加（执行登记）
          },
        },
      },
    ],
  },
  {
    id: 'feudal_cleric_scandal',
    name: '修道院丑闻',
    icon: 'Cross',
    image: null,
    description: '一座富裕修道院的奢侈生活被曝光，信众议论纷纷。',
    triggerConditions: {
      minEpoch: 3,
      classConditions: {
        cleric: {
          minWealthShare: 0.15,
          maxApproval: 80,
        },
      },
    },
    options: [
      {
        id: 'reform_monastery',
        text: '下令整顿修道院',
        description: '没收部分财产，要求简朴生活。',
        effects: {
          resourcePercent: {
            silver: 0.03,
          },
          stability: 4,
          approval: {
            cleric: -10,
            peasant: 8,
          },
          resourceDemandMod: {
            delicacies: -0.12,   // 奢侈品需求减少（简朴生活）
            fine_clothes: -0.1,  // 精美服装需求减少
          },
          stratumDemandMod: {
            cleric: -0.15,       // 神职人员活动减少
            peasant: 0.1,        // 农民活动增加
          },
          buildingProductionMod: {
            church: -0.2,     // 修道院活动大幅减少
            farm: 0.08,          // 农田生产略微增加（资源转向生产）
          },
        },
      },
      {
        id: 'cover_up',
        text: '替教士辩护并掩盖事实',
        description: '宣称这是恶意诽谤。',
        effects: {
          stability: -6,
          approval: {
            cleric: 10,
            peasant: -12,
          },
          resourceDemandMod: {
            delicacies: 0.1,      // 奢侈品需求增加（腐败继续）
            fine_clothes: 0.08,   // 精美服装需求增加
          },
          stratumDemandMod: {
            cleric: 0.15,         // 神职人员活动增加（不受约束）
            peasant: -0.1,        // 农民活动减少（不满）
          },
          buildingProductionMod: {
            church: 0.12,      // 修道院活动继续
            farm: -0.05,          // 农田生产略微减少（资源被占用）
          },
        },
      },
      {
        id: 'tax_church',
        text: '对教会资产征收特别税',
        description: '以维护信仰纯洁为名，收取"圣洁贡金"。',
        effects: {
          resourcePercent: {
            silver: 0.02,
          },
          stability: -2,
          approval: {
            cleric: -15,
            peasant: 5,
          },
          resourceDemandMod: {
            silver: 0.08,        // 白银流通增加（教会缴税）
            delicacies: -0.05,   // 奢侈品需求减少（教会开支减少）
          },
          stratumDemandMod: {
            cleric: -0.12,       // 神职人员活动减少
            peasant: 0.08,       // 农民活动略微增加
            official: 0.06,      // 官员活动增加（征税）
          },
          buildingProductionMod: {
            church: -0.1,     // 修道院活动减少
          },
        },
      },
    ],  },
  {
    id: 'age_of_exploration_merchant_monopoly',
    name: '远洋垄断公司',
    icon: 'Ship',
    image: null,
    description: '少数大商人控制了远洋航线，垄断了香料与奢侈品的进口。',
    triggerConditions: {
      minEpoch: 4,
      classConditions: {
        merchant: {
          minInfluenceShare: 0.25,
          minWealthShare: 0.25,
        },
      },
    },
    options: [
      {
        id: 'charter_company',
        text: '授予皇室特许状',
        description: '以官方垄断公司形式承认既成事实。',
        effects: {
          resourcePercent: {
            silver: 0.045,
          },
          stability: 3,
          approval: {
            merchant: 20,
            peasant: -8,
            worker: -6,
          },
          resourceDemandMod: {
            spice: 0.18,        // 香料需求增加（垄断公司控制进口）
            cloth: 0.15,        // 布料需求增加
            delicacies: 0.12,   // 珍馐需求增加
          },
          stratumDemandMod: {
            merchant: 0.22,     // 商人活动大幅增加
            peasant: -0.1,      // 农民活动减少（被排挤）
            worker: -0.08,      // 工人活动减少
          },
          buildingProductionMod: {
            market: 0.2,        // 市场活动增加（贸易繁荣）
            trade_port: 0.15,        // 码头活动增加（远洋贸易）
            farm: -0.05,        // 农田生产略微减少
          },
        },
      },
      {
        id: 'break_monopoly',
        text: '拆分垄断贸易',
        description: '鼓励更多中小商人参与贸易。',
        effects: {
          stability: -5,
          approval: {
            merchant: -15,
            peasant: 8,
            worker: 6,
          },
          resourceDemandMod: {
            spice: 0.08,        // 香料需求略微增加（更多参与者）
            cloth: 0.06,        // 布料需求略微增加
            delicacies: 0.05,   // 珍馐需求略微增加
          },
          stratumDemandMod: {
            merchant: -0.18,    // 大商人活动减少
            peasant: 0.1,       // 农民活动增加（更多机会）
            worker: 0.08,       // 工人活动增加
          },
          buildingProductionMod: {
            market: 0.12,       // 市场活动增加（更多交易）
            industry: 0.08,     // 工业生产增加（中小企业）
          },
        },
      },
      {
        id: 'raise_tariff',
        text: '提高远洋进口关税',
        description: '以高税率换取财政盈余。',
        effects: {
          resourcePercent: {
            silver: 0.035,
          },
          stability: -2,
          approval: {
            merchant: -10,
          },
          resourceDemandMod: {
            spice: -0.1,        // 香料需求减少（关税太高）
            cloth: -0.08,       // 布料需求减少
            delicacies: -0.06,  // 珍馐需求减少
          },
          stratumDemandMod: {
            merchant: -0.12,    // 商人活动减少（贸易成本增加）
          },
          buildingProductionMod: {
            trade_port: -0.15,       // 码头活动减少（贸易下降）
            market: -0.1,       // 市场活动减少
          },
        },
      },
    ],
  },
  {
    id: 'age_of_exploration_colonial_unrest',
    name: '殖民地骚动',
    icon: 'Globe2',
    image: null,
    description: '海外矿区传来工人罢工的消息，他们抱怨高税与危险的工作环境。',
    triggerConditions: {
      minEpoch: 4,
      classConditions: {
        worker: {
          minPop: 20,
          maxApproval: 55,
        },
        miner: {
          maxApproval: 55,
        },
      },
    },
    options: [
      {
        id: 'send_commissioner',
        text: '派专员调查',
        description: '承诺改善条件，暂时安抚骚动。',
        effects: {
          resourcePercent: {
            silver: -0.022,
          },
          stability: 5,
          approval: {
            worker: 10,
            miner: 10,
          },
          resourceDemandMod: {
            food: 0.08,        // 工人需要食物（改善条件）
            tools: 0.06,       // 需要工具（改善工作环境）
          },
          stratumDemandMod: {
            worker: 0.12,      // 工人活动增加（安抚后复工）
            miner: 0.1,        // 矿工活动增加
            official: 0.08,    // 官员活动增加（专员工作）
          },
          buildingProductionMod: {
            mine: 0.1,         // 矿山生产恢复
            bronze_foundry: 0.05,    // 工业生产恢复
          },
        },
      },
      {
        id: 'use_force',
        text: '动用军队镇压',
        description: '以武力压制抗议，维持短期产量。',
        effects: {
          stability: -12,
          approval: {
            worker: -20,
            miner: -20,
            soldier: 10,
          },
          resourceDemandMod: {
            tools: 0.15,       // 武器需求增加（镇压）
            food: 0.1,         // 士兵需要食物
          },
          stratumDemandMod: {
            worker: -0.25,     // 工人活动大幅减少（压制）
            miner: -0.22,      // 矿工活动大幅减少
            soldier: 0.18,     // 士兵活动增加
          },
          buildingProductionMod: {
            mine: -0.3,        // 矿山生产大幅下降
            training_ground: 0.15,    // 军营活动增加
          },
        },
      },
      {
        id: 'cut_tax',
        text: '降低海外矿区税率',
        description: '让殖民地保留更多利润。',
        effects: {
          resourcePercent: {
            silver: -0.012,
          },
          stability: 3,
          approval: {
            worker: 8,
            miner: 8,
            merchant: 6,
          },
          resourceDemandMod: {
            food: 0.06,        // 工人有更多钱购买食物
            tools: 0.05,       // 工具需求略微增加
          },
          stratumDemandMod: {
            worker: 0.1,       // 工人活动增加（有动力工作）
            miner: 0.08,       // 矿工活动增加
            merchant: 0.08,    // 商人活动增加（利润增加）
          },
          buildingProductionMod: {
            mine: 0.12,        // 矿山生产增加
            trade_port: 0.05,       // 码头活动增加（贸易增加）
          },
        },
      },
    ],
  },
  {
    id: 'enlightenment_pamphlet_storm',
    name: '小册子风暴',
    icon: 'FileText',
    image: null,
    description: '启蒙思想通过廉价小册子在城市街角迅速传播，质疑旧有权威。',
    triggerConditions: {
      minEpoch: 5,
      classConditions: {
        scribe: {
          minPop: 5,
        },
        scribe: {
          minInfluenceShare: 0.18,
          minApproval: 70,
        },
      },
    },
    options: [
      {
        id: 'allow_debate',
        text: '默许公开辩论',
        description: '允许思想在一定范围内自由传播。',
        effects: {
          resourcePercent: {
            science: 0.08,
            culture: 0.08,
          },
          stability: -6,
          approval: {
            scribe: 18,
            peasant: 4,
          },
          resourceDemandMod: {
            papyrus: 0.25,       // 小册子需要纸张
            culture: 0.15,       // 文化需求增加
            science: 0.12,       // 科研需求增加
          },
          stratumDemandMod: {
            scribe: 0.2,         // 文士活动增加（撰写小册子）
            peasant: 0.08,       // 农民阅读需求增加
            merchant: 0.05,      // 商人关注思想变化
          },
          buildingProductionMod: {
            school: 0.1,         // 学校活动增加
            library: 0.15,       // 图书馆活动增加
            tavern: 0.08,        // 酒馆讨论增加
          },
        },
      },
      {
        id: 'censor_print',
        text: '加强出版审查',
        description: '禁止攻击王权与教会的小册子。',
        effects: {
          stability: 4,
          approval: {
            scribe: -12,
            cleric: 8,
          },
        },
      },
      {
        id: 'coopt_scribes',
        text: '邀请部分学者入仕',
        description: '用官职与津贴吸纳激进学者。',
        effects: {
          resourcePercent: {
            silver: -0.025,
          },
          stability: 5,
          approval: {
            scribe: 10,
            official: 6,
          },
        },
      },
    ],
  },
  {
    id: 'enlightenment_coffeehouse_circle',
    name: '咖啡馆圈子',
    icon: 'Coffee',
    image: null,
    description: '商人、工程师和学者聚集在咖啡馆中，讨论最新的技术与金融手段。',
    triggerConditions: {
      minEpoch: 5,
      classConditions: {
        merchant: {
          minInfluenceShare: 0.18,
        },
        engineer: {
          minInfluenceShare: 0.12,
        },
      },
    },
    options: [
      {
        id: 'support_innovation_club',
        text: '资助创新沙龙',
        description: '鼓励他们提出新的工艺与金融工具。',
        effects: {
          resourcePercent: {
            silver: -0.028,
            science: 0.08,
          },
          approval: {
            engineer: 15,
            merchant: 10,
          },
          resourceDemandMod: {
            coffee: 0.3,         // 咖啡馆需要咖啡
            delicacies: 0.15,    // 需要点心
            papyrus: 0.1,        // 需要纸张记录思想
            science: 0.12,       // 科研需求增加
          },
          stratumDemandMod: {
            merchant: 0.18,      // 商人活动增加（资助沙龙）
            engineer: 0.15,      // 工程师活动增加
            scribe: 0.12,        // 文士活动增加
            official: 0.05,      // 官员关注
          },
          buildingProductionMod: {
            coffee_house: 0.2,   // 咖啡馆活动增加
            tavern: 0.1,         // 酒馆活动增加
            market: 0.08,        // 市场活动增加
          },
        },
      },
      {
        id: 'monitor_circle',
        text: '派密探潜伏其间',
        description: '密切关注这些人是否策划政治阴谋。',
        effects: {
          stability: 3,
          approval: {
            official: 6,
            merchant: -6,
          },
        },
      },
      {
        id: 'tax_coffee',
        text: '对咖啡征收奢侈税',
        description: '借新潮饮品获取额外税收。',
        effects: {
          resourcePercent: {
            silver: 0.02,
          },
          approval: {
            merchant: -8,
            engineer: -5,
            peasant: 3,
          },
        },
      },
    ],
  },
  {
    id: 'industrial_general_strike',
    name: '总罢工风潮',
    icon: 'Hammer',
    image: null,
    description: '工厂车间接连停工，工人代表提出加薪与缩短工时的诉求。',
    triggerConditions: {
      minEpoch: 6,
      classConditions: {
        worker: {
          minPop: 30,
          maxApproval: 50,
          maxWealthDelta: 5,
        },
      },
    },
    options: [
      {
        id: 'agree_partial',
        text: '部分接受诉求',
        description: '象征性提高工资，并承诺改善安全条件。',
        effects: {
          resourcePercent: {
            silver: -0.012,
          },
          stability: 6,
          approval: {
            worker: 20,
            capitalist: -8,
          },
          resourceDemandMod: {
            food: 0.1,         // 工人有更多钱购买食物
            cloth: 0.08,       // 需要衣物
            ale: 0.05,         // 庆祝需求
          },
          stratumDemandMod: {
            worker: 0.15,      // 工人活动增加（复工后）
            capitalist: -0.1,  // 资本家活动减少（成本增加）
            official: 0.08,    // 官员活动增加（监督执行）
          },
          buildingProductionMod: {
            textile_mill: 0.12,     // 工厂生产恢复
            industry: 0.1,     // 工业生产恢复
            market: 0.05,      // 市场活动增加
          },
        },
      },
      {
        id: 'bring_in_replacements',
        text: '从农村招募新工人',
        description: '用更廉价的劳动力替换闹事者。',
        effects: {
          stability: -10,
          approval: {
            worker: -20,
            peasant: -6,
            capitalist: 10,
          },
        },
      },
      {
        id: 'negotiate_commission',
        text: '设立劳资调解委员会',
        description: '让代表在你主持的委员会中谈判。',
        effects: {
          stability: 4,
          approval: {
            worker: 12,
            capitalist: -4,
            official: 6,
          },
        },
      },
    ],
  },
  {
    id: 'industrial_capitalist_boom',
    name: '资本狂欢',
    icon: 'Briefcase',
    image: null,
    description: '资本家阶层财富激增，他们开始资助豪华剧院和科学社团。',
    triggerConditions: {
      minEpoch: 6,
      classConditions: {
        capitalist: {
          minWealthShare: 0.3,
          minInfluenceShare: 0.22,
          minWealthDelta: 40,
        },
      },
    },
    options: [
      {
        id: 'encourage_investment',
        text: '鼓励他们继续投资工厂',
        description: '通过减税与荣誉头衔引导资本投向生产。',
        effects: {
          resourcePercent: {
            science: 0.06,
          },
          stability: 4,
          approval: {
            capitalist: 18,
            worker: -6,
          },
          resourceDemandMod: {
            coffee: 0.2,         // 资本家消费咖啡
            delicacies: 0.25,    // 奢侈品需求增加
            fine_clothes: 0.18,  // 精美服装需求增加
            furniture: 0.15,     // 家具需求增加
            steel: 0.1,          // 投资工业需要钢材
          },
          stratumDemandMod: {
            capitalist: 0.22,    // 资本家活动大幅增加
            merchant: 0.15,      // 商人活动增加
            engineer: 0.12,      // 工程师需求增加
            worker: -0.08,       // 工人相对需求减少
          },
          buildingProductionMod: {
            steel_foundry: 0.18,       // 工厂生产增加
            coffee_house: 0.1,  // 咖啡馆活动增加
            market: 0.12,        // 市场活动增加
          },
        },
      },
      {
        id: 'tax_windfall',
        text: '征收暴利税',
        description: '对近期暴涨的利润额外征税，以缓解贫富差距。',
        effects: {
          resourcePercent: {
            silver: 0.045,
          },
          stability: -5,
          approval: {
            capitalist: -20,
            worker: 10,
            peasant: 6,
          },
        },
      },
      {
        id: 'fund_welfare',
        text: '敦促资本家出资兴办福利',
        description: '以捐款形式建设工人公寓与诊所。',
        effects: {
          resourcePercent: {
            silver: -0.025,
          },
          stability: 8,
          approval: {
            worker: 16,
            capitalist: 4,
          },
        },
      },
    ],
  },
  {
    id: 'comet_sighted',
    name: '彗星划过',
    icon: 'Sparkles',
    image: null,
    description: '一颗拖着长长尾巴的彗星划过夜空，整个国家都看到了这个异象。民众议论纷纷，占星家和学者对此有不同的解释。',
    triggerConditions: {
      minEpoch: 1,
    },
    options: [
      {
        id: 'divine_omen',
        text: '宣称这是祥瑞之兆',
        description: '利用这个机会提升民心和神职人员的地位。',
        effects: {
          stability: 10,
          approval: {
            cleric: 15,
            peasant: 10,
            scribe: -10,
          },
        },
      },
      {
        id: 'scientific_phenomenon',
        text: '解释为自然现象',
        description: '让学者向公众解释这只是天文现象，推动科学精神。',
        effects: {
          resourcePercent: {
            science: 0.08,
          },
          approval: {
            scribe: 15,
            cleric: -10,
          },
        },
      },
      {
        id: 'ignore_comet',
        text: '不予置评',
        description: '认为这无足轻重，但可能会引发民众的不安。',
        effects: {
          stability: -5,
          approval: {
            peasant: -5,
          },
        },
      },
    ],
  },
  {
    id: 'inventor_plea',
    name: '发明家的请求',
    icon: 'Lightbulb',
    image: null,
    description: '一位充满激情的发明家带着一个革命性的设计蓝图来拜见你。他声称这个发明将改变世界，但需要一大笔资金和资源来制造原型机。',
    triggerConditions: {
      minEpoch: 5, // 启蒙时代或之后
      classConditions: {
        engineer: {
          minPop: 5,
        },
        capitalist: {
          minPop: 2,
        },
      },
    },
    options: [
      {
        id: 'fund_invention',
        text: '倾力资助！',
        description: '赌一把大的，为这个可能改变未来的项目提供所有必要的支持。',
        effects: {
          resourcePercent: {
            silver: -0.012,
            iron: -0.025,
            tools: -0.06,
            science: 0.08,
          },
          approval: {
            engineer: 20,
            capitalist: 15,
            scribe: 10,
          },
        },
      },
      {
        id: 'limited_support',
        text: '提供有限的支持',
        description: '给予少量资源让他先做个模型看看，降低风险。',
        effects: {
          resourcePercent: {
            silver: -0.025,
            wood: -0.02,
            science: 0.08,
          },
          approval: {
            engineer: 10,
            capitalist: 5,
          },
        },
      },
      {
        id: 'reject_invention',
        text: '简直是天方夜谭！',
        description: '认为这是浪费资源，将发明家赶了出去。',
        effects: {
          approval: {
            engineer: -15,
            scribe: -5,
            capitalist: -5,
          },
        },
      },
    ],
  },
  {
    id: 'great_flood',
    name: '大洪水',
    icon: 'Waves',
    image: null,
    description: '连日的暴雨导致河水泛滥，淹没了大片农田和村庄。你的子民正处于水深火热之中，急需救援。',
    triggerConditions: {
      minPopulation: 30,
    },
    options: [
      {
        id: 'organize_rescue',
        text: '组织大规模救援',
        description: '动用国库，全力救援灾民，重建家园。',
        effects: {
          resourcePercent: {
            silver: -0.03,
            food: -0.05,
            wood: -0.02,
          },
          populationPercent: -0.012,
          stability: 10,
          approval: {
            peasant: 25,
            official: 10,
          },
        },
      },
      {
        id: 'build_dams',
        text: '加固堤坝，亡羊补牢',
        description: '优先保护重要城市和工业区，放弃部分偏远地区。',
        effects: {
          resourcePercent: {
            stone: -0.03,
            wood: -0.025,
          },
          populationPercent: -0.015,
          stability: -5,
          approval: {
            peasant: -15,
            capitalist: 10,
            landowner: 5,
          },
        },
      },
      {
        id: 'let_it_be',
        text: '让河水自然退去',
        description: '相信自然的力量，不进行大规模干预以保存实力。',
        effects: {
          populationPercent: -0.03,
          stability: -15,
          approval: {
            peasant: -30,
            cleric: -10,
          },
        },
      },
    ],
  },
  {
    id: 'stone_age_new_water',
    name: '发现新水源',
    icon: 'Waves',
    image: null,
    description: '侦察队在部落附近发现了一个新的、清澈的泉眼，水量充沛。这可能解决部落的饮水问题，甚至灌溉一小片土地。',
    triggerConditions: {
      minEpoch: 0,
      maxEpoch: 0,
      resourcePercent: {
        food: { max: 100 }, // 当食物储备低于100时更容易触发
      },
    },
    options: [
      {
        id: 'develop_water_source',
        text: '开发水源',
        description: '投入劳力开发，增加食物产出，人口增长加快。',
        effects: {
          resourcePercent: {
            wood: -0.022,
            food: 0.03,
          },
          maxPop: 8,
          stability: 5,
          approval: {
            peasant: 12,
          },
        },
      },
      {
        id: 'secret_protection',
        text: '秘密保护',
        description: '仅供少数人使用，防止其他部落发现。',
        effects: {
          resourcePercent: {
            food: 0.015, // 少量私用
          },
          stability: -3,
          approval: {
            peasant: -5,
            cleric: 5,
          },
        },
      },
      {
        id: 'ignore_water_source',
        text: '不予理会',
        description: '认为不值得投入。',
        effects: {
          stability: -5,
          approval: {
            peasant: -8,
          },
        },
      },
    ],
  },
  {
    id: 'stone_age_stranger_footprints',
    name: '陌生人的足迹',
    icon: 'Users',
    image: null,
    description: '猎人们在部落领地边缘发现了不属于你们的陌生足迹，看起来是另一个部落的侦察队。',
    triggerConditions: {
      minEpoch: 0,
      maxEpoch: 0,
      minPopulation: 15,
    },
    options: [
      {
        id: 'ambush_expel',
        text: '设伏驱逐',
        description: '派遣战士设伏，警告对方。',
        effects: {
          resourcePercent: {
            food: -0.012,
          },

          
          approval: {
            soldier: 10,
          },
        },
        randomEffects: [
            {
            chance: 0.25, // 0~1 之间的概率
            effects: {
                 // 小概率战斗损失
                populationPercent: -0.01,
                stability: -5,
                approval: {
                    peasant: -5,
                },
            },
            },
        // 可以再加更多条
        ],
      },
      {
        id: 'leave_gifts',
        text: '留下礼物',
        description: '在足迹附近留下食物和工具，表达善意。',
        effects: {
          resourcePercent: {
            food: -0.015,
            wood: -0.012,
          },
          culture: 0.02,
          stability: 5,
          approval: {
            peasant: 8,
            cleric: 5,
          },
        },
      },
      {
        id: 'increase_patrol',
        text: '加强巡逻',
        description: '增加巡逻队，但避免直接接触。',
        effects: {
          resourcePercent: {
            food: -0.012,
          },
          stability: -2,
          approval: {
            soldier: 5,
          },
        },
      },
    ],
  },
  {
    id: 'stone_age_harsh_winter',
    name: '恶劣的冬季',
    icon: 'CloudRain',
    image: null,
    description: '一个异常漫长而寒冷的冬季降临，食物储备迅速消耗，部落面临饥饿和寒冷的威胁。',
    triggerConditions: {
      minEpoch: 0,
      maxEpoch: 0,
      minPopulation: 20,
      resourcePercent: {
        food: { max: 150 }, // 当食物储备低于150时更容易触发
      },
    },
    options: [
      {
        id: 'distribute_rations',
        text: '分配稀缺物资',
        description: '严格分配食物和木材，确保每个人都能活下去。',
        effects: {
          resourcePercent: {
            food: -0.05,
            wood: -0.06,
          },
          populationPercent: -0.015, // 仍有少量损失
          stability: 10,
          approval: {
            peasant: 15,
          },
        },
      },
      {
        id: 'encourage_hunting',
        text: '鼓励冒险狩猎',
        description: '派遣更多猎人深入危险区域，寻找食物。',
        effects: {
          populationPercent: -0.03,
          resourcePercent: {
            food: 0.035,
          },
          stability: -8,
          approval: {
            soldier: 12,
            peasant: -15,
          },
        },
      },
      {
        id: 'sacrifice_weak',
        text: '削减老弱口粮',
        description: '优先保障青壮年，牺牲部分老弱。',
        effects: {
          populationPercent: -0.012,
          stability: -20,
          approval: {
            peasant: -30,
            cleric: -15,
          },
        },
      },
    ],
  },
  {
    id: 'stone_age_unexpected_discovery',
    name: '意外的发现',
    icon: 'Gem',
    image: null,
    description: '孩子们在河边玩耍时，发现了一些闪闪发光的石头，它们比普通的石头更坚硬，也更锋利。部落里的工匠对它们很感兴趣。',
    triggerConditions: {
      minEpoch: 0,
      maxEpoch: 0,
      resourcePercent: {
        science: { max: 50 }, // 当科研点数较低时更容易触发
      },
    },
    options: [
      {
        id: 'research_stones',
        text: '交给工匠研究',
        description: '鼓励工匠尝试用这些石头制作工具。',
        effects: {
          resourcePercent: {
            wood: -0.012,
            science: 0.05,
          },
          stability: 3,
          approval: {
            artisan: 15,
            peasant: 5,
          },
        },
      },
      {
        id: 'worship_stones',
        text: '视为神物供奉',
        description: '认为这是神灵的恩赐，将其供奉起来。',
        effects: {
          resourcePercent: {
            culture: 0.04,
          },
          stability: 8,
          approval: {
            cleric: 20,
            artisan: -8,
          },
        },
      },
      {
        id: 'disregard_stones',
        text: '不以为意',
        description: '认为只是普通的石头，不予重视。',
        effects: {
          stability: -3,
          approval: {
            peasant: -5,
          },
        },
      },
    ],
  },
  {
    id: 'stone_age_tribal_legend',
    name: '部落的传说',
    icon: 'BookOpen',
    image: null,
    description: '部落里流传着一个古老的传说，讲述着远方有一片富饶的土地，但那里居住着可怕的巨兽。一些年轻人提议去探索。',
    triggerConditions: {
      minEpoch: 0,
      maxEpoch: 0,
      minPopulation: 25,
      minStability: 50,
      resourcePercent: {
        science: { max: 100 }, // 当科研点数较低时更容易触发
      },
    },
    options: [
      {
        id: 'send_expedition',
        text: '派遣探险队',
        description: '组织一支精锐的探险队，去验证传说的真实性。',
        effects: {
          resourcePercent: {
            food: -0.012,
            science: 0.08,
            culture: 0.07,
          },
          populationPercent: -0.015,
          stability: 5,
          approval: {
            soldier: 15,
          },
        },
      },
      {
        id: 'forbid_exploration',
        text: '禁止探索',
        description: '认为这只是无稽之谈，禁止年轻人冒险。',
        effects: {
          resourcePercent: {
            culture: -0.2,
          },
          stability: 3,
          approval: {
            soldier: -10,
            peasant: -5,
          },
        },
      },
      {
        id: 'encourage_legends',
        text: '鼓励口述传承',
        description: '将传说作为文化遗产，鼓励长老们讲述，但不进行实际探索。',
        effects: {
          resourcePercent: {
            culture: 0.06,
          },
          stability: 6,
          approval: {
            cleric: 12,
            scribe: 8,
          },
        },
      },
    ],
  },
  {
    id: 'bronze_age_bronze_vein',
    name: '青铜矿脉的发现',
    icon: 'Gem',
    image: null,
    description: '探险队在偏远山区发现了一处富含铜矿和锡矿的矿脉，这是制造青铜的关键。这项发现可能彻底改变你的部落力量。',
    triggerConditions: {
      minEpoch: 1,
      maxEpoch: 1,
      minPopulation: 30,
    },
    options: [
      {
        id: 'immediate_mine',
        text: '立即开采',
        description: '投入大量劳力，快速获得资源，但可能引发劳工不满。',
        effects: {
          resourcePercent: {
            copper: 0.15,
            iron: 0.012,
            wood: -0.015,
          },
          populationPercent: -0.015,          stability: -5,
          approval: {
            miner: 15,
            peasant: -8,
          },
        },
      },
      {
        id: 'research_mining',
        text: '谨慎规划与研究',
        description: '先研究更高效的开采技术，确保可持续发展，但速度较慢。',
        effects: {
          resourcePercent: {
            science: 0.06,
            silver: -0.012,
          },
          approval: {
            scribe: 10,
            miner: 5,
          },
        },
      },
      {
        id: 'secret_mine',
        text: '秘密封锁',
        description: '防止其他部落发现，但短期内只能小规模开采。',
        effects: {
          resourcePercent: {
            copper: 0.05,
            iron: 0.016,
          },
          stability: -3,
          approval: {
            peasant: -5,
          },
        },
      },
    ],
  },
  {
    id: 'bronze_age_merchant_plea',
    name: '远方商人的求助',
    icon: 'Handshake',
    image: null,
    description: '一支来自遥远国度的商队在前往你部落的途中遭遇了强盗，他们请求你的军队提供保护，并承诺事成之后将给予丰厚回报。',
    triggerConditions: {
      minEpoch: 1,
      maxEpoch: 1,
      minPopulation: 40,
      classConditions: {
        merchant: {
          minPop: 1,
        },
      },
    },
    options: [
      {
        id: 'send_escort',
        text: '派遣军队护送',
        description: '消耗军事力量，但获得贸易收益和外交声望。',
        effects: {
          resourcePercent: {
            silver: 0.012,
            food: -0.015,
          },
          populationPercent: -0.006, // 护送途中可能发生战斗损失
          stability: 5,
          approval: {
            merchant: 20,
            soldier: 10,
          },
        },
      },
      {
        id: 'provide_aid',
        text: '提供物资援助',
        description: '消耗资源，但建立友好关系，为未来贸易铺路。',
        effects: {
          resourcePercent: {
            food: -0.02,
            wood: -0.015,
          },
          stability: 3,
          approval: {
            merchant: 10,
            peasant: 5,
          },
        },
      },
      {
        id: 'refuse_aid',
        text: '拒绝援助',
        description: '避免风险，但失去潜在盟友和贸易机会，并可能损害声誉。',
        effects: {
          stability: -5,
          approval: {
            merchant: -15,
            soldier: -5,
          },
        },
      },
    ],
  },
  {
    id: 'bronze_age_drought',
    name: '干旱危机',
    icon: 'Droplets',
    image: null,
    description: '连年干旱，河流干涸，农作物大面积枯萎。部落的粮食储备迅速减少，饥荒的阴影笼罩着大地。',
    triggerConditions: {
      minEpoch: 1,
      maxEpoch: 1,
      minPopulation: 50,
      resourcePercent: {
        food: { max: 200 }, // 当食物储备低于200时更容易触发
      },
    },
    options: [
      {
        id: 'build_irrigation',
        text: '修建简易水渠',
        description: '投入劳力，从远处引水缓解旱情，但需要时间。',
        effects: {
          resourcePercent: {
            wood: -0.06,
            stone: -0.03,
            food: 0.02, // 立即获得少量，长期效果在游戏循环中体现
          },
          stability: 8,
          approval: {
            peasant: 20,
            worker: 10,
          },
        },
      },
      {
        id: 'intensive_hunt',
        text: '组织大规模狩猎/采集',
        description: '派遣更多人外出寻找食物，但有风险，可能造成人员伤亡。',
        effects: {
          resourcePercent: {
            food: 0.04,
          },
          populationPercent: -0.025,
          stability: -5,
          approval: {
            peasant: -10,
            soldier: 10,
          },
        },
      },
      {
        id: 'seek_tribute',
        text: '向邻近部落施压',
        description: '派遣军队向邻近部落施压，要求他们提供粮食，但可能引发外交冲突。',
        effects: {
          resourcePercent: {
            food: 0.05,
          },
          stability: -10,
          approval: {
            soldier: 15,
            peasant: -15,
          },
        },
      },
    ],
  },
  {
    id: 'bronze_age_new_priest',
    name: '新祭司的崛起',
    icon: 'Cross',
    image: null,
    description: '一位年轻的祭司声称获得了神灵的启示，能够预知未来并带来丰收。他在民众中获得了极高的声望，传统长老对此感到不安。',
    triggerConditions: {
      minEpoch: 1,
      maxEpoch: 1,
      minPopulation: 35,
      classConditions: {
        cleric: {
          minPop: 1,
        },
      },
    },
    options: [
      {
        id: 'endorse_priest',
        text: '册封为国师',
        description: '利用其影响力巩固统治，提升文化和稳定。',
        effects: {
          resourcePercent: {
            culture: 0.08,
          },
          stability: 10,
          approval: {
            cleric: 20,
            peasant: 15,
            scribe: -10,
          },
        },
      },
      {
        id: 'limit_power',
        text: '限制其权力',
        description: '担心其影响力过大，可能引发冲突，但能安抚传统势力。',
        effects: {
          stability: -5,
          approval: {
            cleric: -15,
            peasant: -5,
            landowner: 5,
          },
        },
      },
      {
        id: 'challenge_divinity',
        text: '质疑其神启',
        description: '挑战其权威，可能导致民众信仰动摇，但能维护理性。',
        effects: {
          resourcePercent: {
            science: 0.05,
          },
          stability: -15,
          approval: {
            cleric: -25,
            peasant: -20,
            scribe: 15,
          },
        },
      },
    ],
  },
  {
    id: 'bronze_age_skirmish',
    name: '部落间的冲突',
    icon: 'Swords',
    image: null,
    description: '你的猎人在边境地区与邻近的“灰狼部落”猎人发生激烈冲突，造成双方人员伤亡。灰狼部落的酋长对此表示强烈不满。',
    triggerConditions: {
      minEpoch: 1,
      maxEpoch: 1,
      minPopulation: 60,
      classConditions: {
        soldier: {
          minPop: 2,
        },
      },
    },
    options: [
      {
        id: 'declare_war',
        text: '立即宣战',
        description: '展现强硬姿态，可能引发全面战争，但士兵士气高涨。',
        effects: {
          stability: -10,
          approval: {
            soldier: 20,
            peasant: -10,
          },
        },
      },
      {
        id: 'send_emissary',
        text: '派遣使者谈判',
        description: '寻求和平解决方案，可能需要付出一些代价，但能避免战争。',
        effects: {
          resourcePercent: {
            silver: -0.012,
            food: -0.015,
          },
          stability: 5,
          approval: {
            merchant: 10,
            peasant: 8,
          },
        },
      },
      {
        id: 'fortify_border',
        text: '加强边境防御',
        description: '避免直接冲突，但可能导致长期对峙和资源消耗。',
        effects: {
          resourcePercent: {
            wood: -0.02,
            stone: -0.015,
          },
          stability: -3,
          approval: {
            soldier: 5,
            peasant: -5,
          },
        },
      },
    ],
  },
  {
    id: 'classical_philosopher_challenge',
    name: '哲学家的挑战',
    icon: 'BookOpen',
    image: null,
    description: '一位极具魅力的哲学家在城邦广场上公开质疑神祇的权威和国家的传统。他的思想吸引了大量追随者，尤其是年轻的学者，但也激怒了祭司和保守派贵族。',
    triggerConditions: {
      minEpoch: 2,
      maxEpoch: 2,
      minPopulation: 80,
      classConditions: {
        scribe: { minPop: 2 },
        cleric: { minPop: 2 },
      },
    },
    options: [
      {
        id: 'embrace_philosophy',
        text: '拥抱理性思辨',
        description: '公开支持哲学家的学说，推动科学与文化发展，但会激怒神职人员。',
        effects: {
          resourcePercent: {
            science: 0.25,
            culture: 0.15,
          },
          approval: {
            scribe: 20,
            cleric: -15,
            peasant: -5,
          },
        },
      },
      {
        id: 'public_debate',
        text: '组织公开辩论',
        description: '让哲学家与祭司进行公开辩论，这可能会引发社会思想动荡。',
        effects: {
          resourcePercent: {
            science: 0.08,
            culture: 0.06,
          },
          stability: -8,
          approval: {
            scribe: 10,
            cleric: -5,
          },
        },
      },
      {
        id: 'exile_philosopher',
        text: '以“腐化青年”之名驱逐他',
        description: '维护传统权威，安抚保守势力，但会扼杀思想的火花。',
        effects: {
          stability: 5,
          approval: {
            cleric: 15,
            landowner: 10,
            scribe: -25,
          },
        },
      },
    ],
  },
  {
    id: 'classical_written_law',
    name: '成文法的呼声',
    icon: 'Gavel',
    image: null,
    description: '随着社会日益复杂，民众和商人阶层要求制定一部清晰的成文法典，以取代贵族们的任意判决。这对你的统治既是挑战也是机遇。',
    triggerConditions: {
      minEpoch: 2,
      maxEpoch: 2,
      minPopulation: 35,
      classConditions: {
        official: { minPop: 3 },
        merchant: { minPop: 5 },
      },
    },
    options: [
      {
        id: 'establish_just_code',
        text: '颁布公正的法典',
        description: '组织抄写员和官员编纂法典，明确所有阶层的权利与义务。',
        effects: {
          resourcePercent: {
            silver: -0.025,
            papyrus: -50,
          },
          stability: 15,
          approval: {
            official: 15,
            merchant: 10,
            peasant: 5,
            landowner: -10,
          },
        },
      },
      {
        id: 'favor_elite_code',
        text: '制定一部有利于精英的法律',
        description: '法典条文向贵族和地主倾斜，以巩固他们的支持。',
        effects: {
          resourcePercent: {
            silver: -0.012,
          },
          stability: -5,
          approval: {
            landowner: 20,
            official: 5,
            merchant: -15,
            peasant: -10,
          },
        },
      },
      {
        id: 'maintain_oral_tradition',
        text: '维持口头判决的传统',
        description: '拒绝编纂法典，认为这会削弱你的裁决权威。',
        effects: {
          stability: -10,
          approval: {
            official: -5,
            merchant: -10,
            peasant: -5,
          },
        },
      },
    ],
  },
  {
    id: 'classical_artistic_patronage',
    name: '艺术家的请求',
    icon: 'Palette',
    image: null,
    description: '一位才华横溢的剧作家带着一部史诗剧本拜见你，他希望能获得赞助，在新建的圆形剧场上演这部作品，以颂扬你的功绩和城邦的荣耀。',
    triggerConditions: {
      minEpoch: 2,
      maxEpoch: 2,
      buildingConditions: {
        amphitheater: { min: 1 },
      },
    },
    options: [
      {
        id: 'fund_grand_performance',
        text: '慷慨解囊，举办盛大演出',
        description: '投入巨资打造一场空前绝后的演出，这将极大地提升文化声望。',
        effects: {
          resourcePercent: {
            silver: -0.03,
            culture: 0.20,
          },
          stability: 8,
          approval: {
            cleric: 15,
            scribe: 10,
            peasant: 5,
          },
        },
      },
      {
        id: 'offer_limited_support',
        text: '提供有限的赞助',
        description: '给予少量资金，让他们举办一场小规模的演出。',
        effects: {
          resourcePercent: {
            silver: -0.012,
            culture: 0.06,
          },
          approval: {
            cleric: 5,
            scribe: 5,
          },
        },
      },
      {
        id: 'dismiss_as_frivolous',
        text: '“戏剧不过是无聊的消遣”',
        description: '认为这是浪费资源，拒绝了剧作家的请求。',
        effects: {
          resourcePercent: {
            culture: -0.5,
          },
          approval: {
            scribe: -10,
            cleric: -5,
          },
        },
      },
    ],
  },
  {
    id: 'classical_aqueduct_proposal',
    name: '引水渠提案',
    icon: 'Waves',
    image: null,
    description: '随着城市人口增长，供水问题日益严峻。一位建筑师向你提交了一份宏伟的引水渠设计图，声称可以从远方的山脉引来清泉，彻底解决城市的缺水问题。',
    triggerConditions: {
      minEpoch: 2,
      maxEpoch: 2,
      minPopulation: 40,
    },
    options: [
      {
        id: 'build_aqueduct',
        text: '不惜代价，建造奇观！',
        description: '投入巨量资源建造引水渠，这将是一项不朽的功绩。',
        effects: {
          resourcePercent: {
            silver: -0.05,
            stone: -0.08,
            brick: -0.06,
          },
          maxPop: 25,
          stability: 15,
          approval: {
            peasant: 20,
            worker: 15,
            official: 10,
          },
        },
      },
      {
        id: 'build_smaller_version',
        text: '先修建一段试试',
        description: '建造一个小型版本，以较低的成本缓解部分供水压力。',
        effects: {
          resourcePercent: {
            silver: -0.025,
            stone: -0.08,
          },
          maxPop: 10,
          stability: 5,
          approval: {
            peasant: 8,
            worker: 5,
          },
        },
      },
      {
        id: 'dig_more_wells',
        text: '“多挖几口井不就行了？”',
        description: '认为引水渠成本过高，选择用更传统的方式解决问题。',
        effects: {
          resourcePercent: {
            wood: -0.015,
          },
          stability: -5,
          approval: {
            peasant: -5,
            scribe: -8,
          },
        },
      },
    ],
  },
  {
    id: 'feudal_guild_charter',
    name: '行会的崛起',
    icon: 'Gavel',
    image: null,
    description: '城里的工匠们正在组建强大的行会，以控制生产标准、商品价格和学徒制度。他们请求你颁发官方特许状，以确立他们的合法地位。',
    triggerConditions: {
      minEpoch: 3,
      maxEpoch: 3,
      classConditions: {
        artisan: { minPop: 10, minInfluenceShare: 0.1 },
        merchant: { minPop: 5 },
      },
    },
    options: [
      {
        id: 'grant_charter',
        text: '授予特许状',
        description: '承认行会的地位，这将提升工业产出和工匠的支持，但可能损害商人的利益。',
        effects: {
          resourcePercent: {
            culture: 0.08,
          },
          stability: 5,
          approval: {
            artisan: 20,
            merchant: -10,
          },
        },
      },
      {
        id: 'regulate_guilds',
        text: '加以管制',
        description: '允许行会存在，但必须接受官员的严格监管，这让你能更好地控制市场。',
        effects: {
          resourcePercent: {
            silver: 0.02,
          },
          stability: -3,
          approval: {
            artisan: -8,
            official: 10,
          },
        },
      },
      {
        id: 'suppress_guilds',
        text: '压制行会',
        description: '宣布行会为非法组织，以保护自由竞争和商人的利益，但这会激怒工匠。',
        effects: {
          stability: -8,
          approval: {
            artisan: -25,
            merchant: 15,
          },
        },
      },
    ],
  },
  {
    id: 'feudal_crusade_call',
    name: '十字军的召唤',
    icon: 'Cross',
    image: null,
    description: '一位极具感召力的教士来到你的领地，号召信徒们加入一场针对遥远异教徒的“圣战”。你的骑士和神职人员对此热情高涨，但商人们担心这会扰乱贸易。',
    triggerConditions: {
      minEpoch: 3,
      maxEpoch: 3,
      classConditions: {
        knight: { minPop: 2 },
        cleric: { minPop: 3 },
      },
    },
    options: [
      {
        id: 'fund_crusade',
        text: '资助圣战！',
        description: '提供资金和士兵，这可能会带来荣耀和财富，但也可能是一场灾难。',
        effects: {
          resourcePercent: {
            silver: -0.04,
            food: -0.015,
          },
          populationPercent: -0.01,
          approval: {
            knight: 25,
            cleric: 20,
            merchant: -15,
          },
        },
      },
      {
        id: 'offer_prayers',
        text: '仅提供祈祷',
        description: '公开支持圣战的道义，但拒绝提供任何实质性援助。',
        effects: {
          stability: -5,
          approval: {
            cleric: 10,
            knight: -10,
          },
        },
      },
      {
        id: 'denounce_call',
        text: '谴责此举',
        description: '宣布此举为鲁莽之举，会激怒信徒和军事贵族，但能赢得商人的支持。',
        effects: {
          stability: -10,
          approval: {
            cleric: -20,
            knight: -15,
            merchant: 15,
            scribe: 10,
          },
        },
      },
    ],
  },
  {
    id: 'feudal_levy_dispute',
    name: '封建征召争端',
    icon: 'ShieldAlert',
    image: null,
    description: '一位强大的封臣以领地歉收为由，拒绝履行提供骑士和士兵的封建义务。这直接挑战了你的权威。',
    triggerConditions: {
      minEpoch: 3,
      maxEpoch: 3,
      classConditions: {
        landowner: { minPop: 3, minInfluenceShare: 0.15 },
        knight: { minPop: 1 },
      },
    },
    options: [
      {
        id: 'force_compliance',
        text: '强制执行',
        description: '派遣你的直属部队强制执行征召，维护你的权威，但这有引发内战的风险。',
        effects: {
          stability: -15,
          approval: {
            landowner: -25,
            soldier: 15,
            official: 10,
          },
        },
      },
      {
        id: 'accept_scutage',
        text: '准许以钱代役',
        description: '允许封臣支付一笔“盾牌钱”来免除兵役。这能充实国库，但开了个坏头。',
        effects: {
          resourcePercent: {
            silver: 0.045,
          },
          stability: -5,
          approval: {
            landowner: 15,
            knight: -10,
          },
        },
      },
      {
        id: 'forgive_levy',
        text: '宽免此次征召',
        description: '体谅他的难处，暂时免除他的义务。这会赢得他的好感，但可能被视为软弱。',
        effects: {
          stability: 5,
          approval: {
            landowner: 20,
            knight: -15,
            official: -10,
          },
        },
      },
    ],
  },
  {
    id: 'feudal_university_founding',
    name: '大学的诞生',
    icon: 'Landmark',
    image: null,
    description: '一群来自各地的学者希望在你的都城建立一所“大学”，系统地教授神学、法律和医学。教会对此表示欢迎，但保守的贵族认为这会动摇他们的地位。',
    triggerConditions: {
      minEpoch: 3,
      maxEpoch: 3,
      minPopulation: 50,
      classConditions: {
        scribe: { minPop: 5 },
        cleric: { minPop: 5 },
      },
    },
    options: [
      {
        id: 'grant_university_charter',
        text: '授予大学特许状',
        description: '为大学提供土地和资金，这将极大地推动科学和文化的发展。',
        effects: {
          resourcePercent: {
            silver: -0.012,
            science: 0.30,
            culture: 0.20,
          },
          approval: {
            scribe: 25,
            cleric: 15,
            landowner: -10,
          },
        },
      },
      {
        id: 'church_control',
        text: '置于教会管辖之下',
        description: '让教会来管理大学，确保其教学内容符合教义。',
        effects: {
          resourcePercent: {
            culture: 0.15,
          },
          stability: 5,
          approval: {
            cleric: 20,
            scribe: -15,
            landowner: 5,
          },
        },
      },
      {
        id: 'reject_university',
        text: '“无用的清谈俱乐部”',
        description: '认为这是浪费资源，拒绝了学者的请求。',
        effects: {
          approval: {
            scribe: -20,
            cleric: -10,
          },
        },
      },
    ],
  },
  {
    id: 'feudal_plague_doctor',
    name: '鸟嘴医生',
    icon: 'Heart',
    image: null,
    description: '一位身穿黑袍、头戴鸟嘴面具的“瘟疫医生”来到你的领地，声称有办法治疗肆虐的疾病。他的方法怪异，但似乎在某些地方取得了效果。',
    triggerConditions: {
      minEpoch: 3,
      maxEpoch: 4,
      minPopulation: 40,
      // 可以在游戏循环中设置一个全局的“瘟疫”状态来触发
    },
    options: [
      {
        id: 'hire_doctor',
        text: '雇佣他作为市政医生',
        description: '授予他官方身份和资金，让他放手治疗病人。',
        effects: {
          resourcePercent: {
            silver: -0.02,
            science: 0.06,
          },
          populationPercent: 0.03, // 象征性地恢复一些人口
          stability: 5,
          approval: {
            peasant: 15,
            cleric: -10, // 挑战教会的治疗权威
          },
        },
      },
      {
        id: 'let_him_practice',
        text: '允许他行医，但自负盈亏',
        description: '不干涉他的行为，让他自己向病人收费。',
        effects: {
          populationPercent: 0.015,
          stability: -3,
          approval: {
            peasant: 5,
            merchant: 5, // 出现新的医疗市场
          },
        },
      },
      {
        id: 'expel_as_charlatan',
        text: '以“江湖骗子”之名驱逐',
        description: '认为他的方法是巫术和欺骗，将其赶出领地。',
        effects: {
          populationPercent: -0.03,
          stability: -8,
          approval: {
            peasant: -15,
            cleric: 15,
          },
        },
      },
    ],
  },
  {
    id: 'exploration_new_world',
    name: '新大陆的发现',
    icon: 'Globe',
    image: null,
    description: '你派遣的探险家带回了惊人的消息：在遥远的大洋彼岸，有一片富饶而未经探索的大陆！这个发现可能彻底改变我们文明的命运。',
    triggerConditions: {
      minEpoch: 4,
      maxEpoch: 4,
      classConditions: {
        navigator: { minPop: 3 },
      },
    },
    options: [
      {
        id: 'fund_colonial_expedition',
        text: '倾国之力，建立殖民地！',
        description: '组织一支庞大的殖民船队，去新大陆建立永久定居点。',
        effects: {
          resourcePercent: {
            silver: -0.012,
            food: -0.02,
            plank: -200,
            tools: -0.012,
          },
          populationPercent: -0.012,
          approval: {
            navigator: 25,
            merchant: 20,
            soldier: 15,
          },
        },
      },
      {
        id: 'establish_trading_post',
        text: '建立一个小型贸易前哨',
        description: '先派遣一小队人建立贸易站，与当地土著进行贸易，降低风险。',
        effects: {
          resourcePercent: {
            silver: -0.03,
            plank: -80,
          },
          populationPercent: -0.015,
          approval: {
            navigator: 15,
            merchant: 15,
          },
        },
      },
      {
        id: 'sell_maps',
        text: '将航海图卖给邻国',
        description: '认为远征风险太高，不如将地图卖掉换取眼前的利益。',
        effects: {
          resourcePercent: {
            silver: 0.02,
          },
          approval: {
            navigator: -25,
            merchant: -10,
          },
          nationRelation: { random: 15 },
          nationWealth: { random: 200 },
        },
      },
    ],
  },
  {
    id: 'exploration_renaissance_artist',
    name: '文艺复兴巨匠',
    icon: 'Palette',
    image: null,
    description: '一位像达芬奇那样的天才艺术家来到了你的宫廷。他不仅是画家，还是发明家和工程师。他请求你的赞助，以完成一项将名垂青史的宏伟艺术品。',
    triggerConditions: {
      minEpoch: 4,
      maxEpoch: 5,
      classConditions: {
        scribe: { minPop: 8 },
        artisan: { minPop: 10 },
      },
    },
    options: [
      {
        id: 'patronize_masterpiece',
        text: '不惜代价，赞助杰作！',
        description: '为这位巨匠提供一切所需，他的作品将成为国家的象征。',
        effects: {
          resourcePercent: {
            silver: -0.05,
            culture: 0.35,
            science: 0.08,
          },
          stability: 10,
          approval: {
            scribe: 20,
            artisan: 15,
            cleric: 10,
          },
        },
      },
      {
        id: 'modest_commission',
        text: '委托一幅肖像画',
        description: '提供一笔小额赞助，让他为你画一幅肖像，以示鼓励。',
        effects: {
          resourcePercent: {
            silver: -0.022,
            culture: 0.08,
          },
          approval: {
            scribe: 8,
            artisan: 5,
          },
        },
      },
      {
        id: 'dismiss_artist',
        text: '“华而不实。”',
        description: '认为艺术是无用的奢侈，将艺术家赶出了宫廷。',
        effects: {
          approval: {
            scribe: -15,
            artisan: -10,
          },
        },
      },
    ],
  },
  {
    id: 'exploration_banking_family',
    name: '银行家族的崛起',
    icon: 'Landmark',
    image: null,
    description: '一个富有的商人家族开始涉足金融业，他们通过发行票据和提供贷款积累了巨大财富，并请求你授予他们“银行”的官方特许状。',
    triggerConditions: {
      minEpoch: 4,
      maxEpoch: 5,
      classConditions: {
        merchant: { minPop: 10, minWealthShare: 0.2 },
        capitalist: { minPop: 1 },
      },
    },
    options: [
      {
        id: 'charter_private_bank',
        text: '授予私人银行特许状',
        description: '允许他们自由经营，这将极大地促进商业，但可能让他们的影响力失控。',
        effects: {
          resourcePercent: {
            silver: 0.03, // 他们支付的特许费用
          },
          stability: -5,
          approval: {
            merchant: 25,
            capitalist: 20,
            landowner: -10,
          },
        },
      },
      {
        id: 'establish_state_bank',
        text: '建立国家银行',
        description: '将银行业务收归国有，由官员管理，以确保国家对金融的控制。',
        effects: {
          resourcePercent: {
            silver: -0.04, // 启动资金
          },
          stability: 10,
          approval: {
            official: 20,
            merchant: -15,
            capitalist: -10,
          },
        },
      },
      {
        id: 'forbid_banking',
        text: '“放贷是可耻的。”',
        description: '宣布高利贷为非法，禁止私人银行业务，以维护传统道德。',
        effects: {
          stability: -8,
          approval: {
            merchant: -20,
            capitalist: -15,
            cleric: 15,
          },
        },
      },
    ],
  },
  {
    id: 'exploration_mercenary_offer',
    name: '佣兵队长的合约',
    icon: 'Swords',
    image: null,
    description: '一位战功赫赫但声名狼藉的佣兵队长，带领着他装备精良的火枪手来到你的面前。他愿意为任何出价最高的人效力。',
    triggerConditions: {
      minEpoch: 4,
      maxEpoch: 5,
      classConditions: {
        soldier: { minPop: 10 },
      },
    },
    options: [
      {
        id: 'hire_mercenaries',
        text: '签订长期合约',
        description: '将他们编入常备军。他们战力强大，但军饷高昂且忠诚堪忧。',
        effects: {
          resourcePercent: {
            silver: -0.05, // 签约费
          },
          // 可以在游戏循环中增加一个高额的军队维护费debuff
          stability: -8,
          approval: {
            soldier: 20,
            knight: -10,
          },
        },
      },
      {
        id: 'one_time_contract',
        text: '雇佣他们打一场仗',
        description: '支付一笔费用，让他们为你解决一个眼前的军事麻烦。',
        effects: {
          resourcePercent: {
            silver: -0.012,
          },
          // 可以触发一个特殊的、玩家优势较高的战斗事件
          approval: {
            soldier: 10,
          },
        },
      },
      {
        id: 'reject_offer',
        text: '“我们不信任唯利是图之辈。”',
        description: '拒绝他们的提议，依靠自己国家的军队。',
        effects: {
          approval: {
            soldier: -5,
            knight: 10,
          },
        },
      },
    ],
  },
  {
    id: 'exploration_gunpowder_plot',
    name: '火药阴谋',
    icon: 'Bomb',
    image: null,
    description: '密探报告称，一群对现状不满的激进分子正在秘密囤积火药，似乎企图策划一场针对你的刺杀或破坏行动。',
    triggerConditions: {
      minEpoch: 4,
      maxEpoch: 5,
      minStability: 0,
      maxStability: 40,
    },
    options: [
      {
        id: 'raid_hideout',
        text: '立即突袭他们的藏身处',
        description: '派遣卫队，在他们行动前将其一网打尽。',
        effects: {
          stability: 15,
          approval: {
            official: 15,
            landowner: 10,
          },
        },
      },
      {
        id: 'public_warning',
        text: '发布公开警告，加强戒备',
        description: '宣布全城戒严，增加卫兵巡逻，让他们不敢轻举妄动。',
        effects: {
          resourcePercent: {
            silver: -0.02,
          },
          stability: 5,
          approval: {
            peasant: -8,
            merchant: -5,
          },
        },
      },
      {
        id: 'ignore_threat',
        text: '“不过是些乌合之众。”',
        description: '认为这只是谣言，不值得大动干戈。',
        effects: {
          // 有一定概率触发负面事件，如建筑被毁或稳定度暴跌

        },
        randomEffects: [
            {
            chance: 0.25, // 0~1 之间的概率
            effects: {
                populationPercent: -0.01,
                stability: -20,
                approval: {
                    peasant: -10,
                },
            },
            },
            // 可以再加更多条
        ],
      },
    ],
  },
];
