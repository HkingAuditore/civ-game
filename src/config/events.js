// 事件配置文件
// 定义游戏中的随机事件及其选项

/**
 * 事件配置数组
 * 每个事件包含：
 * - id: 事件唯一标识
 * - name: 事件名称
 * - icon: 事件图标
 * - image: 概览图片（可选）
 * - description: 事件详情描述
 * - triggerConditions: 触发条件（可选）
 * - options: 事件选项数组
 *   - id: 选项ID
 *   - text: 选项文本
 *   - effects: 选项效果
 *     - resources: 资源变化
 *     - approval: 阶层支持度变化
 *     - stability: 稳定度变化
 *     - other: 其他效果
 */

export const EVENTS = [
  {
    id: 'plague_outbreak',
    name: '瘟疫爆发',
    icon: 'AlertTriangle',
    image: null, // 可以添加图片路径
    description: '一场可怕的瘟疫在城市中蔓延，人们惊恐不安。医者们束手无策，死亡人数不断攀升。你必须立即采取行动来控制疫情。',
    triggerConditions: {
      minPopulation: 500,
      minEpoch: 1,
    },
    options: [
      {
        id: 'quarantine',
        text: '实施严格隔离',
        description: '封锁疫区，限制人员流动',
        effects: {
          resources: {
            food: -100,
            silver: -50,
          },
          population: -50,
          stability: -5,
          approval: {
            peasant: -10,
            merchant: -15,
        
          },
        },
      },
      {
        id: 'pray',
        text: '组织祈祷仪式',
        description: '向神明祈求庇佑，安抚民心',
        effects: {
          resources: {
            silver: -20,
          },
          population: -100,
          stability: 5,
          approval: {
            peasant: 10,
            clergy: 15,
            
          },
        },
      },
      {
        id: 'ignore',
        text: '听天由命',
        description: '让瘟疫自然消退',
        effects: {
          population: -200,
          stability: -15,
          approval: {
            peasant: -20,
            merchant: -15,
            
          },
        },
      },
    ],
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
          resources: {
            silver: -100,
            delicacies: 50,
            furniture: 50,
            fine_clothes: 50,
            tools: 30,
          },
          approval: {
            merchant: 15,
            
          },
        },
      },
      {
        id: 'tax',
        text: '征收关税',
        description: '允许他们交易，但要收取高额税金',
        effects: {
          resources: {
            silver: 50,
          },
          approval: {
            merchant: -10,
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
        },
      },
    ],
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
          resources: {
            food: 300,
          },
          approval: {
            peasant: 10,
          },
        },
      },
      {
        id: 'sell',
        text: '出售粮食',
        description: '趁价格好的时候卖出粮食换取黄金',
        effects: {
          resources: {
            food: 100,
            silver: 150,
          },
          approval: {
            merchant: 15,
            peasant: -5,
          },
        },
      },
      {
        id: 'celebrate',
        text: '举办庆典',
        description: '举办盛大的丰收庆典，与民同乐',
        effects: {
          resources: {
            food: 50,
            silver: -30,
          },
          stability: 10,
          approval: {
            peasant: 20,
            merchant: 5,
            
          },
        },
      },
    ],
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
          resources: {
            silver: -200,
            tools: -50,
          },
          science: 50,
          approval: {
            artisan: 20,
            merchant: 10,
          },
        },
      },
      {
        id: 'gradual',
        text: '逐步应用',
        description: '小规模试点，逐步推广',
        effects: {
          resources: {
            silver: -50,
          },
          science: 20,
          approval: {
            artisan: 10,
          },
        },
      },
      {
        id: 'monopoly',
        text: '技术垄断',
        description: '将技术作为国家机密，限制传播',
        effects: {
          resources: {
            silver: 100,
          },
          science: 10,
          stability: -5,
          approval: {
            artisan: -15,
            merchant: -10,
          },
        },
      },
    ],
  },
  {
    id: 'natural_disaster',
    name: '自然灾害',
    icon: 'CloudRain',
    image: null,
    description: '一场突如其来的自然灾害袭击了你的领地。洪水冲毁了农田，暴风摧毁了建筑，许多人失去了家园。',
    triggerConditions: {
      minPopulation: 300,
    },
    options: [
      {
        id: 'relief',
        text: '紧急救援',
        description: '动用国库资源进行紧急救援',
        effects: {
          resources: {
            silver: -150,
            food: -100,
            wood: -100,
          },
          stability: 5,
          approval: {
            peasant: 20,
            merchant: 5,
            
          },
        },
      },
      {
        id: 'rebuild',
        text: '重建家园',
        description: '组织人力重建被毁的建筑',
        effects: {
          resources: {
            silver: -100,
            wood: -150,
            stone: -100,
          },
          approval: {
            peasant: 15,
            artisan: 10,
          },
        },
      },
      {
        id: 'minimal',
        text: '最低限度援助',
        description: '只提供基本的救援物资',
        effects: {
          resources: {
            food: -50,
          },
          stability: -10,
          approval: {
            peasant: -15,
            merchant: -10,
          },
        },
      },
    ],
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
          resources: {
            food: -120,
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
          resources: {
            food: 60,
          },
          stability: -3,
          approval: {
            peasant: 8,
          },
        },
      },
      {
        id: 'ignore_hunger',
        text: '告诉他们“咬牙挺过去”',
        description: '避免动用库存，但可能激起更深的不满。',
        effects: {
          stability: -8,
          approval: {
            peasant: -18,
          },
        },
      },
    ],
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
        },
      },
      {
        id: 'gift_to_elder',
        text: '赠予长老礼物',
        description: '以私下馈赠换取支持。',
        effects: {
          resources: {
            silver: -40,
          },
          stability: 2,
          approval: {
            peasant: -5,
            cleric: 12,
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
          resources: {
            wood: -80,
            stone: -60,
          },
          stability: 6,
          approval: {
            miner: 18,
            worker: 5,
          },
        },
      },
      {
        id: 'raise_wage',
        text: '提高矿工待遇',
        description: '用额外报酬换取安静。',
        effects: {
          resources: {
            silver: -120,
          },
          stability: 3,
          approval: {
            miner: 15,
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
          resources: {
            silver: 200,
          },
          stability: -3,
          approval: {
            merchant: 20,
            peasant: -6,
          },
        },
      },
      {
        id: 'tax_merchant',
        text: '适度征收商路税',
        description: '从商贸繁荣中为国库抽取一份。',
        effects: {
          resources: {
            silver: 120,
          },
          stability: 1,
          approval: {
            merchant: -10,
            peasant: 4,
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
          resources: {
            papyrus: -80,
            silver: -100,
            science: 120,
          },
          approval: {
            scribe: 15,
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
          resources: {
            food: -150,
            silver: -120,
          },
          stability: 6,
          approval: {
            knight: 15,
            soldier: 8,
            peasant: 4,
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
          resources: {
            silver: 150,
          },
          stability: 4,
          approval: {
            cleric: -10,
            peasant: 8,
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
        },
      },
      {
        id: 'tax_church',
        text: '对教会资产征收特别税',
        description: '以维护信仰纯洁为名，收取“圣洁贡金”。',
        effects: {
          resources: {
            silver: 80,
          },
          stability: -2,
          approval: {
            cleric: -15,
            peasant: 5,
          },
        },
      },
    ],
  },
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
          resources: {
            silver: 250,
          },
          stability: 3,
          approval: {
            merchant: 20,
            peasant: -8,
            worker: -6,
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
        },
      },
      {
        id: 'raise_tariff',
        text: '提高远洋进口关税',
        description: '以高税率换取财政盈余。',
        effects: {
          resources: {
            silver: 180,
          },
          stability: -2,
          approval: {
            merchant: -10,
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
          resources: {
            silver: -120,
          },
          stability: 5,
          approval: {
            worker: 10,
            miner: 10,
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
        },
      },
      {
        id: 'cut_tax',
        text: '降低海外矿区税率',
        description: '让殖民地保留更多利润。',
        effects: {
          resources: {
            silver: -80,
          },
          stability: 3,
          approval: {
            worker: 8,
            miner: 8,
            merchant: 6,
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
          resources: {
            science: 160,
            culture: 120,
          },
          stability: -6,
          approval: {
            scribe: 18,
            peasant: 4,
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
          resources: {
            silver: -150,
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
          resources: {
            silver: -180,
            science: 120,
          },
          approval: {
            engineer: 15,
            merchant: 10,
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
          resources: {
            silver: 90,
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
          resources: {
            silver: -250,
          },
          stability: 6,
          approval: {
            worker: 20,
            capitalist: -8,
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
          resources: {
            science: 80,
          },
          stability: 4,
          approval: {
            capitalist: 18,
            worker: -6,
          },
        },
      },
      {
        id: 'tax_windfall',
        text: '征收暴利税',
        description: '对近期暴涨的利润额外征税，以缓解贫富差距。',
        effects: {
          resources: {
            silver: 260,
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
          resources: {
            silver: -150,
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
          resources: {
            science: 150,
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
          resources: {
            silver: -500,
            iron: -150,
            tools: -80,
            science: 400,
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
          resources: {
            silver: -150,
            wood: -100,
            science: 150,
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
      minPopulation: 100,
    },
    options: [
      {
        id: 'organize_rescue',
        text: '组织大规模救援',
        description: '动用国库，全力救援灾民，重建家园。',
        effects: {
          resources: {
            silver: -200,
            food: -150,
            wood: -100,
          },
          population: -20,
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
          resources: {
            stone: -200,
            wood: -150,
          },
          population: -50,
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
          population: -100,
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
      resources: {
        food: { max: 100 }, // 当食物储备低于100时更容易触发
      },
    },
    options: [
      {
        id: 'develop_water_source',
        text: '开发水源',
        description: '投入劳力开发，增加食物产出，人口增长加快。',
        effects: {
          resources: {
            wood: -30,
            food: 80,
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
          resources: {
            food: 20, // 少量私用
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
          resources: {
            food: -20,
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
                population: -1,
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
          resources: {
            food: -40,
            wood: -10,
          },
          culture: 20,
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
          resources: {
            food: -15,
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
      resources: {
        food: { max: 150 }, // 当食物储备低于150时更容易触发
      },
    },
    options: [
      {
        id: 'distribute_rations',
        text: '分配稀缺物资',
        description: '严格分配食物和木材，确保每个人都能活下去。',
        effects: {
          resources: {
            food: -150,
            wood: -80,
          },
          population: -5, // 仍有少量损失
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
          population: -10,
          resources: {
            food: 100,
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
          population: -20,
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
      resources: {
        science: { max: 50 }, // 当科研点数较低时更容易触发
      },
    },
    options: [
      {
        id: 'research_stones',
        text: '交给工匠研究',
        description: '鼓励工匠尝试用这些石头制作工具。',
        effects: {
          resources: {
            wood: -15,
            science: 60,
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
          resources: {
            culture: 40,
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
      resources: {
        science: { max: 100 }, // 当科研点数较低时更容易触发
      },
    },
    options: [
      {
        id: 'send_expedition',
        text: '派遣探险队',
        description: '组织一支精锐的探险队，去验证传说的真实性。',
        effects: {
          resources: {
            food: -60,
            science: 100,
            culture: 70,
          },
          population: -5,
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
          resources: {
            culture: -20,
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
          resources: {
            culture: 80,
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
          resources: {
            copper: 150,
            iron: 50,
            wood: -50,
          },
          population: -5, // 艰苦劳作可能导致人口损失
          stability: -5,
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
          resources: {
            science: 80,
            silver: -30,
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
          resources: {
            copper: 50,
            iron: 20,
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
          resources: {
            silver: 100,
            food: -30,
          },
          population: -2, // 护送途中可能发生战斗损失
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
          resources: {
            food: -50,
            wood: -20,
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
      resources: {
        food: { max: 200 }, // 当食物储备低于200时更容易触发
      },
    },
    options: [
      {
        id: 'build_irrigation',
        text: '修建简易水渠',
        description: '投入劳力，从远处引水缓解旱情，但需要时间。',
        effects: {
          resources: {
            wood: -80,
            stone: -40,
            food: 50, // 立即获得少量，长期效果在游戏循环中体现
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
          resources: {
            food: 120,
          },
          population: -8,
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
          resources: {
            food: 150,
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
          resources: {
            culture: 100,
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
          resources: {
            science: 50,
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
          resources: {
            silver: -50,
            food: -30,
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
          resources: {
            wood: -100,
            stone: -50,
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
          resources: {
            science: 250,
            culture: 150,
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
          resources: {
            science: 100,
            culture: 80,
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
      minPopulation: 120,
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
          resources: {
            silver: -150,
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
          resources: {
            silver: -80,
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
          resources: {
            silver: -200,
            culture: 200,
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
          resources: {
            silver: -80,
            culture: 80,
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
          resources: {
            culture: -50,
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
      minPopulation: 150,
    },
    options: [
      {
        id: 'build_aqueduct',
        text: '不惜代价，建造奇观！',
        description: '投入巨量资源建造引水渠，这将是一项不朽的功绩。',
        effects: {
          resources: {
            silver: -400,
            stone: -300,
            brick: -150,
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
          resources: {
            silver: -150,
            stone: -120,
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
          resources: {
            wood: -50,
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
          resources: {
            culture: 120,
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
          resources: {
            silver: 80,
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
          resources: {
            silver: -300,
            food: -200,
          },
          population: -15,
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
          resources: {
            silver: 250,
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
      minPopulation: 200,
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
          resources: {
            silver: -250,
            science: 300,
            culture: 200,
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
          resources: {
            culture: 150,
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
      minPopulation: 150,
      // 可以在游戏循环中设置一个全局的“瘟疫”状态来触发
    },
    options: [
      {
        id: 'hire_doctor',
        text: '雇佣他作为市政医生',
        description: '授予他官方身份和资金，让他放手治疗病人。',
        effects: {
          resources: {
            silver: -100,
            science: 80,
          },
          population: 10, // 象征性地恢复一些人口
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
          population: 5,
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
          population: -10,
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
          resources: {
            silver: -500,
            food: -300,
            plank: -200,
            tools: -100,
          },
          population: -20,
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
          resources: {
            silver: -200,
            plank: -80,
          },
          population: -5,
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
          resources: {
            silver: 400,
          },
          approval: {
            navigator: -25,
            merchant: -10,
          },
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
          resources: {
            silver: -400,
            culture: 350,
            science: 150,
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
          resources: {
            silver: -120,
            culture: 100,
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
          resources: {
            silver: 150, // 他们支付的特许费用
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
          resources: {
            silver: -300, // 启动资金
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
          resources: {
            silver: -400, // 签约费
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
          resources: {
            silver: -250,
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
          resources: {
            silver: -100,
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
                population: -15,
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

  // ========== New Events: Class Conflict, Political Economy, Historical Neta ==========

  // --- Historical Neta: French Revolution Style ---
  {
    id: 'bread_price_crisis',
    name: '面包价格暴涨',
    icon: 'ShoppingCart',
    image: null,
    description: '城中面包价格一夜之间翻了三倍！愤怒的妇女们聚集在市场上高喊："我们的孩子在挨饿！"商人们则辩称是粮食歉收所致。一些激进者已经开始砸毁商铺橱窗。',
    triggerConditions: {
      minEpoch: 3,
      minPopulation: 200,
      classConditions: {
        peasant: {
          maxApproval: 50,
        },
        merchant: {
          minWealthShare: 0.2,
        },
      },
    },
    options: [
      {
        id: 'price_control',
        text: '"面包价格不得超过昨日！"',
        description: '强制实施价格管制，平息民愤但激怒商人。',
        effects: {
          resources: {
            silver: -80,
          },
          stability: 8,
          approval: {
            peasant: 20,
            worker: 15,
            merchant: -25,
            capitalist: -15,
          },
        },
      },
      {
        id: 'open_granary',
        text: '开放国库粮仓',
        description: '用国库储备平抑物价，但消耗大量资源。',
        effects: {
          resources: {
            food: -200,
            silver: -50,
          },
          stability: 15,
          approval: {
            peasant: 25,
            worker: 20,
            merchant: 5,
          },
        },
      },
      {
        id: 'let_them_eat_cake',
        text: '"那就让他们吃蛋糕吧。"',
        description: '无视民众诉求，可能会有严重后果。',
        effects: {
          stability: -20,
          approval: {
            peasant: -35,
            worker: -30,
            merchant: 10,
            landowner: 5,
          },
        },
        randomEffects: [
          {
            chance: 0.4,
            effects: {
              population: -30,
              stability: -25,
            },
          },
        ],
      },
    ],
  },

  // --- Class Alliance: Workers and Peasants Unite ---
  {
    id: 'worker_peasant_alliance',
    name: '工农联盟的萌芽',
    icon: 'Users',
    image: null,
    description: '工厂工人和佃农代表在酒馆里秘密会面，他们发现彼此面临着相同的困境——低工资、长工时、被剥削。有人提议组建互助会，也有人主张更激进的行动。',
    triggerConditions: {
      minEpoch: 5,
      classConditions: {
        worker: {
          minPop: 20,
          maxApproval: 55,
        },
        peasant: {
          maxApproval: 55,
        },
        capitalist: {
          minWealthShare: 0.25,
        },
      },
    },
    options: [
      {
        id: 'allow_mutual_aid',
        text: '允许他们组建互助会',
        description: '承认工农有自我组织的权利，可能为未来埋下隐患。',
        effects: {
          stability: -8,
          approval: {
            worker: 20,
            peasant: 18,
            capitalist: -20,
            landowner: -15,
          },
        },
      },
      {
        id: 'divide_and_rule',
        text: '挑拨离间',
        description: '秘密散布谣言，让工人和农民互相猜疑。',
        effects: {
          resources: {
            silver: -60,
          },
          stability: 5,
          approval: {
            worker: -10,
            peasant: -10,
            official: 8,
          },
        },
      },
      {
        id: 'preemptive_reform',
        text: '先发制人：宣布改革',
        description: '在他们提出要求之前主动改善待遇，化解潜在危机。',
        effects: {
          resources: {
            silver: -200,
          },
          stability: 10,
          approval: {
            worker: 15,
            peasant: 12,
            capitalist: -12,
            official: 5,
          },
        },
      },
    ],
  },

  // --- Historical Neta: Gracchus Brothers Style Land Reform ---
  {
    id: 'land_reform_proposal',
    name: '土地改革的呼声',
    icon: 'Map',
    image: null,
    description: '一位年轻而理想主义的官员在议会上慷慨陈词："大地主们圈占了祖先的土地，而真正耕种的人却无立锥之地！我提议限制每户土地上限，将多余的分给无地者。"此言一出，议会炸开了锅。',
    triggerConditions: {
      minEpoch: 2,
      classConditions: {
        landowner: {
          minWealthShare: 0.3,
          minInfluenceShare: 0.25,
        },
        peasant: {
          maxApproval: 50,
          maxWealthShare: 0.1,
        },
      },
    },
    options: [
      {
        id: 'support_reform',
        text: '支持改革！',
        description: '站在农民一边，强行推动土地重新分配。这将永远改变权力格局。',
        effects: {
          resources: {
            food: 150,
          },
          stability: -20,
          approval: {
            peasant: 35,
            worker: 15,
            landowner: -40,
            knight: -20,
            official: -10,
          },
        },
      },
      {
        id: 'compromise_reform',
        text: '推动温和改革',
        description: '限制土地兼并，但不没收现有土地，各方勉强接受。',
        effects: {
          stability: -5,
          approval: {
            peasant: 12,
            landowner: -15,
            official: 5,
          },
        },
      },
      {
        id: 'reject_reform',
        text: '"这是对神圣财产权的侵犯！"',
        description: '维护既得利益者的权利，驳回改革提案。',
        effects: {
          stability: 5,
          approval: {
            peasant: -25,
            worker: -15,
            landowner: 25,
            knight: 10,
          },
        },
        randomEffects: [
          {
            chance: 0.3,
            effects: {
              population: -10,
              stability: -15,
              approval: {
                peasant: -20,
              },
            },
          },
        ],
      },
    ],
  },

  // --- Class Conflict: Rich vs Poor Taxation ---
  {
    id: 'progressive_tax_debate',
    name: '累进税制之争',
    icon: 'Coins',
    image: null,
    description: '国库空虚，财政大臣提出两套方案：一是向所有人征收统一人头税；二是按财富比例征收累进税。富人们强烈反对后者，声称"这是惩罚成功"；而普通民众则高喊"让富人付出应有的份额！"',
    triggerConditions: {
      minEpoch: 4,
      resources: {
        silver: { max: 300 },
      },
      classConditions: {
        capitalist: {
          minWealthShare: 0.2,
        },
        merchant: {
          minWealthShare: 0.15,
        },
      },
    },
    options: [
      {
        id: 'progressive_tax',
        text: '实施累进税制',
        description: '富人多缴，穷人少缴。公平但可能导致资本外流。',
        effects: {
          resources: {
            silver: 300,
          },
          stability: -8,
          approval: {
            peasant: 20,
            worker: 18,
            merchant: -20,
            capitalist: -30,
            landowner: -15,
          },
        },
      },
      {
        id: 'poll_tax',
        text: '实施人头税',
        description: '人人平等缴纳。简单粗暴，但对穷人负担更重。',
        effects: {
          resources: {
            silver: 200,
          },
          stability: -15,
          approval: {
            peasant: -25,
            worker: -20,
            merchant: 15,
            capitalist: 20,
          },
        },
      },
      {
        id: 'tax_compromise',
        text: '混合税制',
        description: '基础人头税加上对高收入者的附加税，试图两边讨好。',
        effects: {
          resources: {
            silver: 250,
          },
          stability: -3,
          approval: {
            peasant: 5,
            worker: 5,
            merchant: -8,
            capitalist: -10,
          },
        },
      },
    ],
  },

  // --- Historical Neta: Spartacus Rebellion ---
  {
    id: 'slave_gladiator_revolt',
    name: '角斗场的怒火',
    icon: 'Swords',
    image: null,
    description: '一名来自色雷斯的角斗士带领同伴们杀死了看守，逃出了角斗场。他们打出"自由与尊严"的旗号，沿途不断有奴隶、佃农甚至破产的自由民加入。这支队伍已经壮大到令人不安的规模。',
    triggerConditions: {
      minEpoch: 2,
      maxEpoch: 3,
      minPopulation: 150,
      classConditions: {
        serf: {
          minPop: 30,
          maxApproval: 40,
        },
        peasant: {
          maxApproval: 50,
        },
      },
    },
    options: [
      {
        id: 'military_suppression',
        text: '调集大军镇压',
        description: '用武力粉碎叛乱，杀一儆百。',
        effects: {
          resources: {
            food: -150,
            silver: -200,
          },
          population: -50,
          stability: 10,
          approval: {
            serf: -30,
            peasant: -15,
            soldier: 15,
            landowner: 20,
          },
        },
      },
      {
        id: 'negotiate_freedom',
        text: '承诺释放部分奴隶',
        description: '以和平方式瓦解叛军，但将动摇奴隶制的根基。',
        effects: {
          resources: {
            silver: -100,
          },
          stability: -10,
          approval: {
            serf: 25,
            peasant: 15,
            landowner: -30,
            merchant: -10,
          },
        },
      },
      {
        id: 'bribe_leaders',
        text: '收买叛军首领',
        description: '用金钱和赦免令瓦解叛军领导层。',
        effects: {
          resources: {
            silver: -250,
          },
          stability: 5,
          approval: {
            serf: -10,
            peasant: -5,
            official: -10,
          },
        },
      },
    ],
  },

  // --- Political Intrigue: Assassination Attempt ---
  {
    id: 'assassination_plot',
    name: '刺杀阴谋',
    icon: 'AlertTriangle',
    image: null,
    description: '你的密探带来了令人不安的消息：一群不满的贵族正在密谋刺杀你。他们认为你的改革损害了他们的利益，只有换一个统治者才能恢复"旧日的秩序"。元老会似乎对此睁一只眼闭一只眼。',
    triggerConditions: {
      minEpoch: 2,
      classConditions: {
        landowner: {
          maxApproval: 35,
          minInfluenceShare: 0.2,
        },
        knight: {
          maxApproval: 40,
        },
      },
    },
    options: [
      {
        id: 'preemptive_purge',
        text: '"先下手为强！"',
        description: '逮捕所有嫌疑人，不管有没有确凿证据。',
        effects: {
          resources: {
            silver: -100,
          },
          stability: 15,
          approval: {
            landowner: -25,
            knight: -20,
            official: 10,
            peasant: 5,
          },
        },
      },
      {
        id: 'public_trial',
        text: '公开审判',
        description: '将阴谋公之于众，让民众做见证。',
        effects: {
          resources: {
            silver: -50,
          },
          stability: 5,
          approval: {
            peasant: 15,
            worker: 10,
            landowner: -20,
            scribe: 8,
          },
        },
      },
      {
        id: 'offer_reconciliation',
        text: '主动示好，寻求和解',
        description: '暂缓改革，安抚贵族。但这会被视为软弱。',
        effects: {
          stability: -5,
          approval: {
            landowner: 20,
            knight: 15,
            peasant: -20,
            worker: -15,
          },
        },
      },
    ],
  },

  // --- Economic Crisis: Bank Run ---
  {
    id: 'bank_run_panic',
    name: '银行挤兑风暴',
    icon: 'Building',
    image: null,
    description: '谣言像野火一样蔓延：国家最大的银行即将倒闭！恐慌的储户挤满了银行门口，要求取出全部存款。如果银行真的倒闭，将引发连锁反应，整个经济可能陷入瘫痪。',
    triggerConditions: {
      minEpoch: 5,
      classConditions: {
        merchant: {
          minPop: 10,
        },
        capitalist: {
          minPop: 5,
        },
      },
    },
    options: [
      {
        id: 'government_bailout',
        text: '政府紧急注资',
        description: '用国库资金拯救银行，防止系统性崩溃。',
        effects: {
          resources: {
            silver: -400,
          },
          stability: 10,
          approval: {
            capitalist: 15,
            merchant: 20,
            peasant: -15,
            worker: -20,
          },
        },
      },
      {
        id: 'let_it_fail',
        text: '"太大而不能倒？不存在的。"',
        description: '让市场自行调整，投机者自食其果。',
        effects: {
          resources: {
            silver: -100,
          },
          stability: -25,
          approval: {
            capitalist: -30,
            merchant: -25,
            peasant: 10,
            worker: 5,
          },
        },
      },
      {
        id: 'partial_guarantee',
        text: '担保小额存款',
        description: '只保护普通储户，让大投资者承担损失。',
        effects: {
          resources: {
            silver: -200,
          },
          stability: -5,
          approval: {
            peasant: 15,
            worker: 12,
            capitalist: -20,
            merchant: -10,
          },
        },
      },
    ],
  },

  // --- Historical Neta: Boston Tea Party Style ---
  {
    id: 'colonial_tea_protest',
    name: '茶叶倾倒事件',
    icon: 'Coffee',
    image: null,
    description: '殖民地商人对新颁布的茶叶垄断令怒不可遏。昨夜，一群化装成原住民的年轻人登上运茶船，将全部茶叶倾倒入海，高喊"无代表不纳税！"。这一行动在各地引发了巨大反响。',
    triggerConditions: {
      minEpoch: 4,
      classConditions: {
        merchant: {
          maxApproval: 45,
          minInfluenceShare: 0.15,
        },
      },
    },
    options: [
      {
        id: 'harsh_punishment',
        text: '铁腕镇压',
        description: '逮捕所有参与者，关闭该港口，杀鸡儆猴。',
        effects: {
          resources: {
            silver: 100,
          },
          stability: -20,
          approval: {
            merchant: -30,
            peasant: -20,
            worker: -15,
            soldier: 10,
          },
        },
      },
      {
        id: 'repeal_monopoly',
        text: '废除垄断令',
        description: '承认错误，恢复自由贸易。虽然丢面子，但能恢复秩序。',
        effects: {
          resources: {
            silver: -80,
          },
          stability: 10,
          approval: {
            merchant: 25,
            peasant: 10,
            official: -15,
          },
        },
      },
      {
        id: 'token_compromise',
        text: '象征性让步',
        description: '降低茶税但维持垄断，试图敷衍了事。',
        effects: {
          resources: {
            silver: -30,
          },
          stability: -5,
          approval: {
            merchant: -10,
            peasant: -5,
            official: 5,
          },
        },
      },
    ],
  },

  // --- Class Conflict: Luddite Movement ---
  {
    id: 'machine_breakers',
    name: '捣毁机器运动',
    icon: 'Hammer',
    image: null,
    description: '愤怒的工匠们闯入新建的纺织工厂，用铁锤砸毁了蒸汽动力织布机。他们的领袖——自称"卢德将军"——宣称："这些机器抢走了我们的饭碗！我们要砸烂它们！"工厂主们要求你派兵保护。',
    triggerConditions: {
      minEpoch: 6,
      classConditions: {
        artisan: {
          minPop: 15,
          maxApproval: 50,
        },
        capitalist: {
          minPop: 5,
        },
      },
    },
    options: [
      {
        id: 'protect_factories',
        text: '派兵保护工厂',
        description: '工业化不可阻挡，但这会激化与工匠的矛盾。',
        effects: {
          resources: {
            silver: -80,
          },
          stability: 5,
          approval: {
            artisan: -25,
            worker: -10,
            capitalist: 20,
            engineer: 15,
          },
        },
      },
      {
        id: 'slow_mechanization',
        text: '限制机械化速度',
        description: '要求工厂主逐步引入机器，给工匠适应的时间。',
        effects: {
          resources: {
            science: -50,
          },
          stability: 8,
          approval: {
            artisan: 15,
            worker: 10,
            capitalist: -15,
            engineer: -10,
          },
        },
      },
      {
        id: 'retraining_program',
        text: '开办转业培训',
        description: '用国库资金帮助工匠学习操作新机器。',
        effects: {
          resources: {
            silver: -150,
            science: 30,
          },
          stability: 10,
          approval: {
            artisan: 12,
            worker: 15,
            capitalist: 5,
          },
        },
      },
    ],
  },

  // --- Political: Constitutional Crisis ---
  {
    id: 'constitutional_crisis',
    name: '宪政危机',
    icon: 'FileText',
    image: null,
    description: '新兴的资产阶级和知识分子联合起来，要求召开制宪会议，限制君主权力，建立代议制政府。传统贵族和教士则坚决捍卫旧制度。街头出现了对立的示威人群，国家正处于历史的十字路口。',
    triggerConditions: {
      minEpoch: 5,
      classConditions: {
        capitalist: {
          minInfluenceShare: 0.2,
          minApproval: 40,
        },
        scribe: {
          minInfluenceShare: 0.1,
        },
        landowner: {
          minInfluenceShare: 0.2,
        },
      },
    },
    options: [
      {
        id: 'grant_constitution',
        text: '顺应潮流，颁布宪法',
        description: '自上而下的改革，在保留部分权力的同时迎接新时代。',
        effects: {
          resources: {
            science: 100,
            culture: 80,
          },
          stability: -10,
          approval: {
            capitalist: 25,
            scribe: 30,
            merchant: 20,
            landowner: -30,
            cleric: -20,
            knight: -25,
          },
        },
      },
      {
        id: 'crack_down',
        text: '坚决镇压',
        description: '逮捕激进分子，禁止政治集会，维护旧秩序。',
        effects: {
          stability: -15,
          approval: {
            capitalist: -30,
            scribe: -35,
            merchant: -20,
            landowner: 20,
            cleric: 15,
            soldier: 10,
          },
        },
        randomEffects: [
          {
            chance: 0.35,
            effects: {
              population: -20,
              stability: -25,
            },
          },
        ],
      },
      {
        id: 'delay_tactics',
        text: '"让我们成立一个委员会研究此事..."',
        description: '拖延战术，既不拒绝也不同意，争取时间。',
        effects: {
          stability: -5,
          approval: {
            capitalist: -15,
            scribe: -20,
            landowner: -10,
            official: 10,
          },
        },
      },
    ],
  },

  // --- Historical Neta: Dreyfus Affair Style ---
  {
    id: 'spy_scandal',
    name: '间谍丑闻',
    icon: 'Eye',
    image: null,
    description: '一名来自少数族裔的军官被指控向敌国出卖军事机密。军方坚称证据确凿，但一些记者和知识分子公开质疑："我控诉！他们在迫害无辜者！"社会分裂成两派，争论异常激烈。',
    triggerConditions: {
      minEpoch: 5,
      classConditions: {
        soldier: {
          minInfluenceShare: 0.15,
        },
        scribe: {
          minInfluenceShare: 0.1,
        },
      },
    },
    options: [
      {
        id: 'support_military',
        text: '维护军方判决',
        description: '稳定军心，但可能造成冤案，并加剧社会对立。',
        effects: {
          stability: 5,
          approval: {
            soldier: 15,
            knight: 10,
            scribe: -25,
            merchant: -10,
          },
        },
      },
      {
        id: 'reopen_case',
        text: '重新调查此案',
        description: '追求真相和正义，但会动摇军方威信。',
        effects: {
          resources: {
            silver: -100,
          },
          stability: -10,
          approval: {
            soldier: -20,
            knight: -15,
            scribe: 25,
            merchant: 10,
            peasant: 5,
          },
        },
      },
      {
        id: 'quiet_pardon',
        text: '秘密赦免',
        description: '不公开翻案，但悄悄释放被告。两边都不会满意。',
        effects: {
          stability: -3,
          approval: {
            soldier: -10,
            scribe: -15,
            official: 5,
          },
        },
      },
    ],
  },

  // --- Economic: Monopoly Trust ---
  {
    id: 'robber_baron_monopoly',
    name: '巨头垄断危机',
    icon: 'Briefcase',
    image: null,
    description: '几位最富有的资本家秘密会面后，联合控制了全国的钢铁、铁路和石油供应。他们可以任意定价，竞争者和小商人纷纷破产。民间开始出现"反托拉斯"的呼声。',
    triggerConditions: {
      minEpoch: 6,
      classConditions: {
        capitalist: {
          minWealthShare: 0.35,
          minInfluenceShare: 0.25,
        },
        merchant: {
          maxApproval: 55,
        },
      },
    },
    options: [
      {
        id: 'break_up_trusts',
        text: '拆分垄断企业',
        description: '强制将大企业分解，恢复市场竞争。',
        effects: {
          resources: {
            silver: 150,
          },
          stability: -10,
          approval: {
            capitalist: -35,
            merchant: 20,
            worker: 15,
            peasant: 10,
          },
        },
      },
      {
        id: 'regulate_prices',
        text: '实施价格管制',
        description: '保留垄断但限制定价权，折中方案。',
        effects: {
          stability: 5,
          approval: {
            capitalist: -15,
            merchant: 10,
            worker: 8,
          },
        },
      },
      {
        id: 'laissez_faire',
        text: '"市场自会调节。"',
        description: '相信自由市场的力量，不干预。',
        effects: {
          resources: {
            silver: 100,
          },
          stability: -8,
          approval: {
            capitalist: 25,
            merchant: -20,
            worker: -15,
            peasant: -10,
          },
        },
      },
    ],
  },

  // --- Class Conflict: General Assembly ---
  {
    id: 'three_estates_assembly',
    name: '三级会议风波',
    icon: 'Landmark',
    image: null,
    description: '财政危机迫使你召开三级会议。但第三等级——商人、工匠、农民的代表——要求按人头投票而非按等级投票。"我们代表95%的人口，凭什么只有三分之一的投票权？"贵族和教士坚决反对。',
    triggerConditions: {
      minEpoch: 4,
      resources: {
        silver: { max: 200 },
      },
      classConditions: {
        landowner: {
          minInfluenceShare: 0.2,
        },
        cleric: {
          minInfluenceShare: 0.1,
        },
        merchant: {
          minPop: 10,
        },
      },
    },
    options: [
      {
        id: 'support_third_estate',
        text: '支持按人头投票',
        description: '站在多数人一边，这将彻底改变权力结构。',
        effects: {
          resources: {
            silver: 100,
          },
          stability: -15,
          approval: {
            peasant: 25,
            worker: 25,
            merchant: 20,
            artisan: 20,
            landowner: -35,
            cleric: -30,
            knight: -25,
          },
        },
      },
      {
        id: 'maintain_tradition',
        text: '维持传统投票方式',
        description: '安抚贵族和教会，但第三等级可能采取激进行动。',
        effects: {
          resources: {
            silver: 50,
          },
          stability: -10,
          approval: {
            peasant: -25,
            worker: -20,
            merchant: -20,
            landowner: 20,
            cleric: 15,
          },
        },
        randomEffects: [
          {
            chance: 0.4,
            effects: {
              stability: -20,
              approval: {
                peasant: -15,
              },
            },
          },
        ],
      },
      {
        id: 'dissolve_assembly',
        text: '解散会议',
        description: '取消会议，另寻他法解决财政问题。但这会激怒所有人。',
        effects: {
          stability: -20,
          approval: {
            peasant: -20,
            merchant: -25,
            landowner: -15,
            cleric: -10,
          },
        },
      },
    ],
  },

  // --- Historical Neta: Salt March ---
  {
    id: 'salt_tax_protest',
    name: '盐税抗议',
    icon: 'Users',
    image: null,
    description: '一位受人尊敬的智者带领数千名追随者徒步走向海边，公开煮海水制盐以抗议盐税。他说："他们可以打断我的骨头，但永远无法打断我的精神。"这场非暴力抗议正在全国蔓延。',
    triggerConditions: {
      minEpoch: 5,
      classConditions: {
        peasant: {
          minPop: 100,
          maxApproval: 50,
        },
        cleric: {
          minApproval: 50,
        },
      },
    },
    options: [
      {
        id: 'mass_arrest',
        text: '大规模逮捕抗议者',
        description: '填满监狱，但这可能让运动获得更多同情。',
        effects: {
          resources: {
            silver: -100,
          },
          stability: -15,
          approval: {
            peasant: -25,
            worker: -20,
            cleric: -15,
            soldier: 10,
          },
        },
      },
      {
        id: 'abolish_salt_tax',
        text: '废除盐税',
        description: '承认失败，但能平息抗议并赢得民心。',
        effects: {
          resources: {
            silver: -150,
          },
          stability: 15,
          approval: {
            peasant: 30,
            worker: 25,
            cleric: 10,
            merchant: -10,
          },
        },
      },
      {
        id: 'negotiate_with_leader',
        text: '与智者谈判',
        description: '邀请他进行对话，寻求妥协方案。',
        effects: {
          resources: {
            silver: -50,
          },
          stability: 5,
          approval: {
            peasant: 10,
            cleric: 15,
            official: 5,
          },
        },
      },
    ],
  },

  // --- Class Alliance: Merchant-Scholar Alliance ---
  {
    id: 'merchant_scholar_alliance',
    name: '商学联盟',
    icon: 'BookOpen',
    image: null,
    description: '富有的商人开始资助学者的研究和出版，条件是学者为自由贸易和财产权提供理论辩护。这个联盟正在形成一种新的意识形态力量，挑战传统的土地贵族和教会权威。',
    triggerConditions: {
      minEpoch: 5,
      classConditions: {
        merchant: {
          minWealthShare: 0.2,
          minApproval: 55,
        },
        scribe: {
          minInfluenceShare: 0.12,
          minApproval: 55,
        },
      },
    },
    options: [
      {
        id: 'embrace_new_ideas',
        text: '拥抱新思想',
        description: '支持这股新兴力量，推动社会现代化。',
        effects: {
          resources: {
            science: 120,
            culture: 80,
          },
          stability: -5,
          approval: {
            merchant: 20,
            scribe: 25,
            capitalist: 15,
            landowner: -20,
            cleric: -25,
          },
        },
      },
      {
        id: 'censor_publications',
        text: '加强出版审查',
        description: '压制"危险思想"的传播，维护传统秩序。',
        effects: {
          resources: {
            science: -50,
          },
          stability: 8,
          approval: {
            merchant: -15,
            scribe: -25,
            landowner: 15,
            cleric: 20,
          },
        },
      },
      {
        id: 'cootp_movement',
        text: '收编这股力量',
        description: '任命一些温和派学者为官员，削弱运动的锋芒。',
        effects: {
          resources: {
            silver: -100,
          },
          stability: 3,
          approval: {
            scribe: 5,
            merchant: 5,
            official: 10,
          },
        },
      },
    ],
  },

  // --- Political: Military Coup Threat ---
  {
    id: 'military_coup_threat',
    name: '将军的野心',
    icon: 'Swords',
    image: null,
    description: '战功赫赫的大将军在军队中拥有极高威望，士兵们对他的忠诚甚至超过对你。近来他在公开场合对你的决策多有批评，有人传言他正在密谋"清君侧"。',
    triggerConditions: {
      minEpoch: 3,
      classConditions: {
        soldier: {
          minInfluenceShare: 0.2,
          maxApproval: 60,
        },
        knight: {
          minInfluenceShare: 0.15,
        },
      },
    },
    options: [
      {
        id: 'preemptive_dismissal',
        text: '先发制人：解除其兵权',
        description: '趁他还没行动，剥夺其军职。但如果他反抗...',
        effects: {
          stability: -15,
          approval: {
            soldier: -25,
            knight: -20,
            official: 15,
          },
        },
        randomEffects: [
          {
            chance: 0.3,
            effects: {
              population: -30,
              stability: -30,
            },
          },
        ],
      },
      {
        id: 'appease_general',
        text: '给他更多权力和荣誉',
        description: '用高位厚禄拉拢他，但这会让他更加尾大不掉。',
        effects: {
          resources: {
            silver: -150,
          },
          stability: 5,
          approval: {
            soldier: 15,
            knight: 10,
            peasant: -10,
            official: -15,
          },
        },
      },
      {
        id: 'build_loyal_force',
        text: '秘密组建亲卫队',
        description: '培养只忠于你的武装力量，以防万一。',
        effects: {
          resources: {
            silver: -200,
            food: -100,
          },
          stability: 3,
          approval: {
            soldier: -10,
            official: 10,
          },
        },
      },
    ],
  },

  // --- Social: Famine and Distribution ---
  {
    id: 'great_famine',
    name: '大饥荒',
    icon: 'CloudRain',
    image: null,
    description: '连年天灾导致全国性饥荒，饿殍遍野。然而，地主的粮仓里堆满了粮食，商人正在囤积居奇。愤怒的饥民已经开始抢劫粮车，"打开粮仓，否则我们就自己来！"',
    triggerConditions: {
      minEpoch: 2,
      minPopulation: 200,
      resources: {
        food: { max: 100 },
      },
    },
    options: [
      {
        id: 'requisition_grain',
        text: '征用私人粮食',
        description: '强制地主和商人交出囤粮，救济灾民。',
        effects: {
          resources: {
            food: 300,
          },
          stability: 5,
          approval: {
            peasant: 25,
            worker: 20,
            landowner: -35,
            merchant: -30,
          },
        },
      },
      {
        id: 'buy_grain',
        text: '用国库购买粮食',
        description: '高价收购粮食分发，维护市场秩序但财政大出血。',
        effects: {
          resources: {
            food: 200,
            silver: -400,
          },
          stability: 8,
          approval: {
            peasant: 15,
            merchant: 20,
            landowner: 10,
          },
        },
      },
      {
        id: 'let_market_decide',
        text: '"饥荒会自己结束的。"',
        description: '不干预市场，让价格机制发挥作用。后果自负。',
        effects: {
          population: -80,
          stability: -25,
          approval: {
            peasant: -40,
            worker: -35,
            merchant: 15,
            landowner: 10,
          },
        },
      },
    ],
  },

  // --- Historical Neta: Peasant's Crusade ---
  {
    id: 'peasant_crusade',
    name: '农民十字军',
    icon: 'Cross',
    image: null,
    description: '一位狂热的传教士号召农民们拿起武器，去夺回圣地。成千上万的农民响应号召，抛下农田加入这支"神圣军队"。他们装备简陋、缺乏训练，但充满狂热。这对农业生产是灾难性的打击。',
    triggerConditions: {
      minEpoch: 3,
      maxEpoch: 4,
      classConditions: {
        peasant: {
          minPop: 80,
        },
        cleric: {
          minInfluenceShare: 0.15,
          minApproval: 60,
        },
      },
    },
    options: [
      {
        id: 'bless_and_send',
        text: '祝福他们出征',
        description: '顺应宗教热情，但农业劳动力会大幅减少。',
        effects: {
          resources: {
            food: -150,
            culture: 80,
          },
          population: -40,
          stability: 10,
          approval: {
            cleric: 25,
            peasant: 15,
            landowner: -20,
          },
        },
      },
      {
        id: 'redirect_to_charity',
        text: '引导他们从事慈善',
        description: '说服传教士将热情转向帮助穷人，而非远征。',
        effects: {
          resources: {
            silver: -80,
            culture: 40,
          },
          stability: 8,
          approval: {
            cleric: 10,
            peasant: 10,
          },
        },
      },
      {
        id: 'ban_movement',
        text: '禁止这场运动',
        description: '强制农民返回田间，但会激怒教会和信徒。',
        effects: {
          resources: {
            food: 50,
          },
          stability: -10,
          approval: {
            cleric: -30,
            peasant: -20,
            landowner: 15,
          },
        },
      },
    ],
  },

  // --- Class Conflict: Urban vs Rural ---
  {
    id: 'urban_rural_tension',
    name: '城乡对立',
    icon: 'Building',
    image: null,
    description: '城市居民抱怨食品价格太高，要求政府压低农产品价格；农民则抗议说他们的收成卖不出好价钱，根本无法维持生计。双方的矛盾日益激化，甚至有农民威胁要停止向城市供粮。',
    triggerConditions: {
      minEpoch: 4,
      classConditions: {
        worker: {
          minPop: 30,
          maxApproval: 55,
        },
        peasant: {
          minPop: 50,
          maxApproval: 55,
        },
      },
    },
    options: [
      {
        id: 'subsidize_farmers',
        text: '补贴农民',
        description: '用国库补贴农民，让他们能以低价卖粮而不亏本。',
        effects: {
          resources: {
            silver: -200,
            food: 100,
          },
          stability: 10,
          approval: {
            peasant: 20,
            worker: 15,
          },
        },
      },
      {
        id: 'price_ceiling',
        text: '强制限价',
        description: '规定农产品最高售价，保护城市居民利益。',
        effects: {
          resources: {
            food: -50,
          },
          stability: -5,
          approval: {
            worker: 15,
            peasant: -25,
            merchant: -10,
          },
        },
      },
      {
        id: 'let_negotiate',
        text: '让双方自行谈判',
        description: '组织城乡代表会议，政府只做调解人。',
        effects: {
          resources: {
            silver: -30,
          },
          stability: 3,
          approval: {
            worker: 5,
            peasant: 5,
            official: 8,
          },
        },
      },
    ],
  },

  // --- Historical Neta: Opium War Style ---
  {
    id: 'foreign_drug_trade',
    name: '鸦片贸易危机',
    icon: 'AlertTriangle',
    image: null,
    description: '外国商人大量走私成瘾性药物进入国内，换取你的白银。官员们争论不休：一派主张严禁，"烟毒害人，必须铲除！"另一派警告说强硬措施可能引发与强大外邦的战争。',
    triggerConditions: {
      minEpoch: 5,
      classConditions: {
        merchant: {
          minPop: 15,
        },
      },
    },
    options: [
      {
        id: 'strict_prohibition',
        text: '严禁鸦片，销毁存货',
        description: '当众销毁没收的鸦片，冒与外邦开战的风险。',
        effects: {
          resources: {
            silver: -100,
          },
          stability: 10,
          approval: {
            peasant: 20,
            official: 15,
            soldier: 10,
            merchant: -25,
          },
        },
        randomEffects: [
          {
            chance: 0.4,
            effects: {
              stability: -30,
              population: -20,
            },
          },
        ],
      },
      {
        id: 'legalize_and_tax',
        text: '合法化并征税',
        description: '既然禁不住，不如管起来收税。但这在道德上很难辩护。',
        effects: {
          resources: {
            silver: 200,
          },
          stability: -10,
          approval: {
            peasant: -25,
            cleric: -20,
            merchant: 20,
            official: -10,
          },
        },
      },
      {
        id: 'diplomatic_negotiation',
        text: '外交谈判',
        description: '尝试通过谈判让外国商人自愿减少贸易。缓慢但安全。',
        effects: {
          resources: {
            silver: -50,
          },
          stability: 3,
          approval: {
            official: 10,
            merchant: 5,
          },
        },
      },
    ],
  },

  // --- Class Conflict: Guild vs Free Labor ---
  {
    id: 'guild_monopoly_crisis',
    name: '行会垄断危机',
    icon: 'Users',
    image: null,
    description: '传统行会严格控制着各行业的从业资格、价格和工艺标准。外来工人和想要创新的年轻工匠抱怨行会扼杀了竞争和创新。行会长老则警告：废除行会将导致劣质产品泛滥和恶性竞争。',
    triggerConditions: {
      minEpoch: 4,
      classConditions: {
        artisan: {
          minPop: 20,
          minInfluenceShare: 0.1,
        },
        worker: {
          minPop: 15,
          maxApproval: 55,
        },
      },
    },
    options: [
      {
        id: 'abolish_guilds',
        text: '废除行会特权',
        description: '实现自由竞争，促进创新，但得罪传统工匠。',
        effects: {
          resources: {
            science: 60,
          },
          stability: -10,
          approval: {
            artisan: -25,
            worker: 20,
            merchant: 15,
            capitalist: 20,
          },
        },
      },
      {
        id: 'reform_guilds',
        text: '改革行会制度',
        description: '保留行会但降低准入门槛，折中方案。',
        effects: {
          stability: 5,
          approval: {
            artisan: -5,
            worker: 10,
            merchant: 5,
          },
        },
      },
      {
        id: 'strengthen_guilds',
        text: '加强行会权力',
        description: '维护传统，保护工匠利益，但可能阻碍发展。',
        effects: {
          resources: {
            science: -30,
          },
          stability: 8,
          approval: {
            artisan: 20,
            worker: -15,
            merchant: -10,
            capitalist: -15,
          },
        },
      },
    ],
  },

  // --- Political: Reformer vs Conservative ---
  {
    id: 'court_faction_war',
    name: '朝廷党争',
    icon: 'Users',
    image: null,
    description: '朝廷中形成了尖锐对立的两派：改革派主张学习外国先进制度，"不变法必亡国！"保守派则坚持祖宗之法不可变，"祖宗自有制度，何须效法蛮夷？"双方互相攻讦，政务几乎瘫痪。',
    triggerConditions: {
      minEpoch: 5,
      classConditions: {
        official: {
          minPop: 10,
        },
        scribe: {
          minInfluenceShare: 0.1,
        },
      },
    },
    options: [
      {
        id: 'support_reformers',
        text: '全力支持改革派',
        description: '大刀阔斧推行新政，冒着激进变革的风险。',
        effects: {
          resources: {
            science: 100,
            silver: -100,
          },
          stability: -15,
          approval: {
            scribe: 25,
            merchant: 15,
            official: -10,
            landowner: -25,
            cleric: -20,
          },
        },
      },
      {
        id: 'support_conservatives',
        text: '维护传统',
        description: '支持保守派，维护稳定但可能错失发展机遇。',
        effects: {
          resources: {
            culture: 50,
          },
          stability: 10,
          approval: {
            landowner: 20,
            cleric: 15,
            scribe: -25,
            merchant: -15,
          },
        },
      },
      {
        id: 'balance_factions',
        text: '玩弄平衡',
        description: '不表态，让两派互相牵制。高明但危险的游戏。',
        effects: {
          stability: -5,
          approval: {
            official: 10,
            scribe: -10,
            landowner: -10,
          },
        },
      },
    ],
  },

  // --- Workers' Rights Movement ---
  {
    id: 'eight_hour_day_movement',
    name: '八小时工作制运动',
    icon: 'Clock',
    image: null,
    description: '工人们走上街头，高喊"八小时工作、八小时休息、八小时归自己！"他们要求立法限制工作时间。资本家们强烈反对，声称这将摧毁工业竞争力。',
    triggerConditions: {
      minEpoch: 6,
      classConditions: {
        worker: {
          minPop: 40,
          maxApproval: 55,
        },
        capitalist: {
          minWealthShare: 0.25,
        },
      },
    },
    options: [
      {
        id: 'pass_labor_law',
        text: '通过劳动法',
        description: '立法规定八小时工作制，工人阶级的历史性胜利。',
        effects: {
          resources: {
            science: -30,
          },
          stability: 10,
          approval: {
            worker: 30,
            peasant: 15,
            capitalist: -30,
            merchant: -15,
          },
        },
      },
      {
        id: 'voluntary_guidelines',
        text: '发布非强制性指导原则',
        description: '建议但不强制执行，让企业自愿遵守。',
        effects: {
          stability: 3,
          approval: {
            worker: 5,
            capitalist: 5,
          },
        },
      },
      {
        id: 'crush_movement',
        text: '镇压示威',
        description: '派警察驱散游行，逮捕组织者。',
        effects: {
          stability: -15,
          approval: {
            worker: -35,
            peasant: -20,
            capitalist: 20,
            soldier: 10,
          },
        },
        randomEffects: [
          {
            chance: 0.3,
            effects: {
              population: -15,
              stability: -20,
            },
          },
        ],
      },
    ],
  },

  // --- Historical Neta: Boxer Rebellion Style ---
  {
    id: 'anti_foreign_movement',
    name: '排外运动',
    icon: 'Flag',
    image: null,
    description: '一个神秘的民间组织崛起，宣称习练神功可以刀枪不入。他们把国家的所有问题都归咎于外国人和信仰外国宗教的本国人，开始攻击外国使馆和教堂。各国公使发出严厉警告。',
    triggerConditions: {
      minEpoch: 5,
      classConditions: {
        peasant: {
          minPop: 60,
          maxApproval: 50,
        },
        cleric: {
          maxApproval: 60,
        },
      },
    },
    options: [
      {
        id: 'support_movement',
        text: '"这些都是忠勇之士！"',
        description: '公开支持排外运动，利用民族情绪，但可能引发国际危机。',
        effects: {
          stability: -20,
          approval: {
            peasant: 25,
            soldier: 15,
            cleric: -20,
            merchant: -25,
            scribe: -20,
          },
        },
        randomEffects: [
          {
            chance: 0.5,
            effects: {
              population: -50,
              stability: -30,
              resources: {
                silver: -300,
              },
            },
          },
        ],
      },
      {
        id: 'suppress_movement',
        text: '坚决镇压',
        description: '保护外国人和少数信仰者，维护国际关系。',
        effects: {
          resources: {
            silver: -100,
          },
          stability: 10,
          approval: {
            peasant: -30,
            soldier: -10,
            cleric: 15,
            merchant: 20,
          },
        },
      },
      {
        id: 'ambiguous_stance',
        text: '态度暧昧',
        description: '不明确表态，看形势发展再说。',
        effects: {
          stability: -10,
          approval: {
            peasant: 5,
            merchant: -15,
            official: -10,
          },
        },
      },
    ],
  },

  // --- Historical Neta: Bread and Circuses ---
  {
    id: 'bread_and_circuses',
    name: '面包与马戏',
    icon: 'Theater',
    image: null,
    description: '民众对高失业率和物价上涨怨声载道。一位老练的顾问建议："陛下，给他们面包和马戏，他们就会忘记抱怨。只要肚子不饿、眼睛有东西看，谁还关心政治呢？"',
    triggerConditions: {
      minEpoch: 2,
      classConditions: {
        peasant: {
          maxApproval: 50,
        },
        worker: {
          maxApproval: 50,
        },
      },
    },
    options: [
      {
        id: 'grand_spectacle',
        text: '举办盛大竞技表演',
        description: '花费巨资举办壮观的表演，转移民众注意力。',
        effects: {
          resources: {
            silver: -250,
            food: -100,
            culture: 80,
          },
          stability: 15,
          approval: {
            peasant: 20,
            worker: 18,
            merchant: 5,
            capitalist: -10,
          },
        },
      },
      {
        id: 'free_grain',
        text: '发放免费粮食',
        description: '直接解决饥饿问题，但可能养成依赖。',
        effects: {
          resources: {
            food: -200,
          },
          stability: 12,
          approval: {
            peasant: 25,
            worker: 20,
            landowner: -15,
          },
        },
      },
      {
        id: 'address_real_issues',
        text: '正视问题根源',
        description: '拒绝粉饰太平，着手解决根本问题。艰难但诚实。',
        effects: {
          resources: {
            silver: -150,
          },
          stability: -5,
          approval: {
            peasant: 8,
            worker: 10,
            scribe: 15,
            official: -10,
          },
        },
      },
    ],
  },

  // --- Historical Neta: Praetorian Guard ---
  {
    id: 'palace_guard_demands',
    name: '禁卫军的要求',
    icon: 'Shield',
    image: null,
    description: '禁卫军士兵聚集在宫殿门前，要求发放拖欠的饷银和"登基赏赐"。他们的将领暗示：历史上有很多统治者因为怠慢禁卫军而"意外身亡"。这分明是勒索！',
    triggerConditions: {
      minEpoch: 2,
      classConditions: {
        soldier: {
          minInfluenceShare: 0.18,
          maxApproval: 55,
        },
      },
    },
    options: [
      {
        id: 'pay_demands',
        text: '满足他们的要求',
        description: '花钱买平安，但这会助长他们的嚣张气焰。',
        effects: {
          resources: {
            silver: -300,
          },
          stability: 10,
          approval: {
            soldier: 25,
            knight: 15,
            peasant: -15,
            merchant: -10,
          },
        },
      },
      {
        id: 'face_them_down',
        text: '"你们敢威胁朕？"',
        description: '当面斥责他们的无礼，展现君主威严。高风险高回报。',
        effects: {
          stability: -10,
          approval: {
            soldier: -20,
            official: 15,
            peasant: 10,
          },
        },
        randomEffects: [
          {
            chance: 0.25,
            effects: {
              population: -5,
              stability: -25,
              approval: {
                soldier: -20,
              },
            },
          },
        ],
      },
      {
        id: 'reform_guard',
        text: '改革禁卫军制度',
        description: '答应部分要求，但同时削减禁卫军规模和特权。',
        effects: {
          resources: {
            silver: -150,
          },
          stability: 5,
          approval: {
            soldier: -5,
            official: 10,
            peasant: 5,
          },
        },
      },
    ],
  },

  // --- Historical Neta: Magna Carta Style ---
  {
    id: 'nobles_charter_demand',
    name: '贵族的宪章',
    icon: 'Scroll',
    image: null,
    description: '联合起来的贵族们带着武装随从来到王宫，递上一份文件——他们称之为"自由宪章"。上面列举了对王权的种种限制：未经贵族同意不得加税、不得任意逮捕贵族、必须保障贵族审判权...不签字，他们就不离开。',
    triggerConditions: {
      minEpoch: 3,
      classConditions: {
        landowner: {
          minInfluenceShare: 0.25,
          maxApproval: 45,
        },
        knight: {
          minInfluenceShare: 0.15,
          maxApproval: 50,
        },
      },
    },
    options: [
      {
        id: 'sign_charter',
        text: '签署宪章',
        description: '限制王权，但避免内战，可能为法治开创先例。',
        effects: {
          resources: {
            culture: 100,
          },
          stability: 10,
          approval: {
            landowner: 30,
            knight: 25,
            peasant: -10,
            official: -20,
          },
        },
      },
      {
        id: 'reject_and_fight',
        text: '拒绝并召集王军',
        description: '宁可开战也不向威胁低头。',
        effects: {
          resources: {
            silver: -200,
            food: -150,
          },
          population: -30,
          stability: -20,
          approval: {
            landowner: -35,
            knight: -30,
            soldier: 15,
            peasant: 10,
          },
        },
      },
      {
        id: 'delay_and_divide',
        text: '假意接受，暗中分化',
        description: '签字后秘密拉拢部分贵族，伺机废除宪章。',
        effects: {
          resources: {
            silver: -100,
          },
          stability: -5,
          approval: {
            landowner: 10,
            knight: 5,
            official: 10,
          },
        },
      },
    ],
  },

  // --- Class Conflict: Tenant Farmers Strike ---
  {
    id: 'tenant_strike',
    name: '佃农罢耕',
    icon: 'Wheat',
    image: null,
    description: '数百名佃农拒绝下地干活，他们围坐在地主庄园门前："地租太高了！我们辛苦一年，收成的六成都要交给老爷，剩下的连糊口都难！降租，否则这地我们不种了！"',
    triggerConditions: {
      minEpoch: 3,
      classConditions: {
        peasant: {
          minPop: 50,
          maxApproval: 45,
        },
        landowner: {
          minWealthShare: 0.25,
        },
        serf: {
          minPop: 20,
          maxApproval: 45,
        },
      },
    },
    options: [
      {
        id: 'force_rent_reduction',
        text: '强制地主降租',
        description: '站在佃农一边，用法令限制地租上限。',
        effects: {
          resources: {
            food: 100,
          },
          stability: 5,
          approval: {
            peasant: 30,
            serf: 25,
            landowner: -35,
            knight: -15,
          },
        },
      },
      {
        id: 'send_troops',
        text: '派兵驱散',
        description: '帮助地主恢复秩序，强制佃农复工。',
        effects: {
          stability: -10,
          approval: {
            peasant: -30,
            serf: -25,
            landowner: 25,
            soldier: 10,
          },
        },
      },
      {
        id: 'mediate',
        text: '居中调停',
        description: '召集双方谈判，寻求双方都能接受的方案。',
        effects: {
          resources: {
            silver: -50,
          },
          stability: 3,
          approval: {
            peasant: 10,
            serf: 8,
            landowner: -10,
            official: 8,
          },
        },
      },
    ],
  },

  // --- Economic: Currency Debasement ---
  {
    id: 'currency_crisis',
    name: '货币贬值危机',
    icon: 'Coins',
    image: null,
    description: '国库空虚，财政大臣提出一个"妙计"：在新铸的银币中掺入更多铜，表面看起来一样，实际含银量减少一半。这样我们就能用同样的银子铸出两倍的钱！但如果被发现...',
    triggerConditions: {
      minEpoch: 2,
      resources: {
        silver: { max: 150 },
      },
    },
    options: [
      {
        id: 'debase_currency',
        text: '批准货币减值计划',
        description: '短期解决财政危机，但可能引发通货膨胀和信任危机。',
        effects: {
          resources: {
            silver: 300,
          },
          stability: -8,
          approval: {
            merchant: -20,
            capitalist: -25,
            peasant: -10,
            official: 10,
          },
        },
        randomEffects: [
          {
            chance: 0.5,
            effects: {
              stability: -15,
              approval: {
                merchant: -20,
                peasant: -15,
              },
            },
          },
        ],
      },
      {
        id: 'raise_taxes',
        text: '老实加税',
        description: '痛苦但诚实的解决方案。',
        effects: {
          resources: {
            silver: 150,
          },
          stability: -5,
          approval: {
            peasant: -15,
            merchant: -10,
            landowner: -10,
          },
        },
      },
      {
        id: 'cut_spending',
        text: '削减开支',
        description: '勒紧裤腰带，裁减官员和军队。',
        effects: {
          resources: {
            silver: 80,
          },
          stability: -3,
          approval: {
            official: -20,
            soldier: -15,
            peasant: 5,
          },
        },
      },
    ],
  },

  // --- Historical Neta: Witch Hunt ---
  {
    id: 'witch_hunt_hysteria',
    name: '女巫审判',
    icon: 'Flame',
    image: null,
    description: '某个村庄发生了一系列不幸事件——牲畜死亡、孩子患病、庄稼枯萎。村民们确信这是巫术作祟，已经指控并逮捕了几名"女巫"。教会法庭要求处以火刑，但也有人质疑这些指控毫无根据。',
    triggerConditions: {
      minEpoch: 3,
      maxEpoch: 5,
      classConditions: {
        cleric: {
          minInfluenceShare: 0.15,
        },
        peasant: {
          maxApproval: 55,
        },
      },
    },
    options: [
      {
        id: 'allow_trial',
        text: '允许审判继续',
        description: '顺应民意和教会，但可能助长迷信和冤案。',
        effects: {
          resources: {
            culture: -30,
          },
          stability: 5,
          approval: {
            cleric: 20,
            peasant: 10,
            scribe: -25,
          },
        },
        randomEffects: [
          {
            chance: 0.4,
            effects: {
              population: -5,
              stability: -10,
            },
          },
        ],
      },
      {
        id: 'demand_evidence',
        text: '要求确凿证据',
        description: '坚持法律程序，需要真正的证据才能定罪。',
        effects: {
          resources: {
            science: 30,
          },
          stability: -5,
          approval: {
            cleric: -15,
            peasant: -10,
            scribe: 20,
            official: 10,
          },
        },
      },
      {
        id: 'release_accused',
        text: '释放被告',
        description: '宣布指控荒谬，释放所有被告。这会激怒很多人。',
        effects: {
          resources: {
            science: 50,
          },
          stability: -15,
          approval: {
            cleric: -30,
            peasant: -20,
            scribe: 30,
          },
        },
      },
    ],
  },

  // --- Class Alliance: Clergy-Landowner Alliance ---
  {
    id: 'church_noble_alliance',
    name: '教会与贵族联盟',
    icon: 'Handshake',
    image: null,
    description: '主教大人与大贵族们秘密会面后，联合向你施压：他们要求维护教会的免税特权和贵族的土地权利，威胁说如果改革继续，他们将联合"保卫传统秩序"。',
    triggerConditions: {
      minEpoch: 3,
      classConditions: {
        cleric: {
          minInfluenceShare: 0.15,
          minWealthShare: 0.1,
        },
        landowner: {
          minInfluenceShare: 0.2,
          minWealthShare: 0.25,
        },
      },
    },
    options: [
      {
        id: 'submit_to_pressure',
        text: '屈服于压力',
        description: '保证不触动他们的利益，换取支持。',
        effects: {
          stability: 10,
          approval: {
            cleric: 25,
            landowner: 25,
            peasant: -20,
            worker: -15,
            merchant: -10,
          },
        },
      },
      {
        id: 'divide_alliance',
        text: '分化瓦解',
        description: '秘密拉拢一方，许诺好处让他们背叛盟友。',
        effects: {
          resources: {
            silver: -150,
          },
          stability: 3,
          approval: {
            cleric: 5,
            landowner: -15,
            official: 10,
          },
        },
      },
      {
        id: 'defy_alliance',
        text: '公开对抗',
        description: '向民众揭露他们的阴谋，争取平民支持。',
        effects: {
          stability: -15,
          approval: {
            cleric: -30,
            landowner: -30,
            peasant: 25,
            worker: 20,
            merchant: 15,
          },
        },
      },
    ],
  },

  // --- Political: Succession Crisis ---
  {
    id: 'succession_dispute',
    name: '继承权之争',
    icon: 'Crown',
    image: null,
    description: '你的两个孩子都声称自己是合法继承人。长子有传统和法律支持，但名声不佳；幼子更受欢迎和有能力，但按照长子继承制没有资格。朝廷分裂成两派，各自支持一方。',
    triggerConditions: {
      minEpoch: 2,
      minStability: 40,
      classConditions: {
        landowner: {
          minInfluenceShare: 0.15,
        },
        official: {
          minPop: 5,
        },
      },
    },
    options: [
      {
        id: 'support_eldest',
        text: '支持长子',
        description: '遵循传统，维护长子继承权。',
        effects: {
          stability: 5,
          approval: {
            landowner: 15,
            cleric: 10,
            official: -10,
            peasant: -5,
          },
        },
      },
      {
        id: 'support_younger',
        text: '支持幼子',
        description: '打破传统，选择更有能力者。但这会树立危险的先例。',
        effects: {
          resources: {
            culture: -30,
          },
          stability: -10,
          approval: {
            landowner: -20,
            cleric: -15,
            official: 15,
            peasant: 10,
          },
        },
      },
      {
        id: 'split_inheritance',
        text: '分割领土',
        description: '各给一块领地，避免内战但削弱国家。',
        effects: {
          maxPop: -20,
          stability: -5,
          approval: {
            landowner: 5,
            official: 5,
          },
        },
      },
    ],
  },

  // --- Historical Neta: Bread Riots ---
  {
    id: 'bread_riot',
    name: '面包暴动',
    icon: 'AlertTriangle',
    image: null,
    description: '饥饿的民众冲进面包店和粮仓，抢夺一切能吃的东西。暴动正在蔓延——妇女们走在最前面，喊着"面包！我们要面包！"城市卫队不知所措，等待你的命令。',
    triggerConditions: {
      minEpoch: 3,
      minPopulation: 150,
      resources: {
        food: { max: 80 },
      },
      classConditions: {
        peasant: {
          maxApproval: 40,
        },
        worker: {
          maxApproval: 40,
        },
      },
    },
    options: [
      {
        id: 'distribute_reserves',
        text: '开放粮仓',
        description: '将国家储备分发给民众，解燃眉之急。',
        effects: {
          resources: {
            food: -150,
          },
          stability: 15,
          approval: {
            peasant: 30,
            worker: 28,
            merchant: -10,
          },
        },
      },
      {
        id: 'military_response',
        text: '军事镇压',
        description: '出动军队恢复秩序，不惜流血。',
        effects: {
          population: -25,
          stability: -15,
          approval: {
            peasant: -35,
            worker: -30,
            soldier: 10,
            landowner: 15,
          },
        },
      },
      {
        id: 'blame_hoarders',
        text: '惩罚囤积居奇者',
        description: '将矛头指向商人和地主，没收他们的粮食。',
        effects: {
          resources: {
            food: 200,
          },
          stability: -5,
          approval: {
            peasant: 25,
            worker: 22,
            merchant: -30,
            landowner: -25,
          },
        },
      },
    ],
  },

  // --- Class Conflict: Artisan Guild Politics ---
  {
    id: 'guild_master_corruption',
    name: '行会腐败案',
    icon: 'Briefcase',
    image: null,
    description: '有人揭发铁匠行会的会长贪污会费、垄断原料、排挤竞争者。普通工匠要求彻查，但会长是有势力的人物，与多位官员有密切关系。',
    triggerConditions: {
      minEpoch: 3,
      classConditions: {
        artisan: {
          minPop: 15,
        },
        official: {
          minPop: 5,
        },
      },
    },
    options: [
      {
        id: 'full_investigation',
        text: '彻底调查',
        description: '不管牵扯到谁都要查到底。',
        effects: {
          resources: {
            silver: -80,
          },
          stability: -5,
          approval: {
            artisan: 25,
            worker: 15,
            official: -20,
            merchant: 10,
          },
        },
      },
      {
        id: 'quiet_removal',
        text: '悄悄换人',
        description: '私下让会长退休，不公开追究。保全各方颜面。',
        effects: {
          stability: 3,
          approval: {
            artisan: 5,
            official: 10,
            worker: -5,
          },
        },
      },
      {
        id: 'ignore_accusations',
        text: '驳回指控',
        description: '宣称证据不足，维护现状。',
        effects: {
          stability: -8,
          approval: {
            artisan: -20,
            worker: -15,
            official: 15,
          },
        },
      },
    ],
  },

  // --- Historical Neta: Peasant Revolts ---
  {
    id: 'peasant_jacquerie',
    name: '农民起义',
    icon: 'Swords',
    image: null,
    description: '长期的剥削终于引爆了农民的怒火。数千名手持草叉和镰刀的农民攻占了庄园，烧毁契约，处死了几名特别可恶的地主。他们的领袖——一个自称"大雅克"的人——宣布要"杀光贵族"。',
    triggerConditions: {
      minEpoch: 3,
      maxEpoch: 5,
      classConditions: {
        peasant: {
          minPop: 80,
          maxApproval: 35,
        },
        serf: {
          minPop: 30,
          maxApproval: 35,
        },
        landowner: {
          minWealthShare: 0.3,
        },
      },
    },
    options: [
      {
        id: 'brutal_suppression',
        text: '血腥镇压',
        description: '集合骑士和军队，杀鸡儆猴。',
        effects: {
          resources: {
            silver: -150,
            food: -100,
          },
          population: -60,
          stability: 5,
          approval: {
            peasant: -40,
            serf: -35,
            landowner: 30,
            knight: 20,
            soldier: 15,
          },
        },
      },
      {
        id: 'negotiate_grievances',
        text: '承认部分诉求',
        description: '宣布调查地主暴行，承诺减轻徭役负担。',
        effects: {
          stability: -10,
          approval: {
            peasant: 20,
            serf: 18,
            landowner: -30,
            knight: -20,
          },
        },
      },
      {
        id: 'divide_rebels',
        text: '分化瓦解',
        description: '许诺赦免放下武器者，孤立核心分子。',
        effects: {
          resources: {
            silver: -80,
          },
          population: -20,
          stability: 0,
          approval: {
            peasant: -5,
            serf: -5,
            landowner: 5,
            official: 10,
          },
        },
      },
    ],
  },

  // --- Modern Era: Labor Union Recognition ---
  {
    id: 'union_recognition_fight',
    name: '工会承认之战',
    icon: 'Users',
    image: null,
    description: '全国最大的工厂工人联合起来，要求政府承认工会的合法地位。资本家威胁说如果工会合法化，他们就关闭工厂、转移资产。工人代表则警告：如果不承认，将发动全国总罢工。',
    triggerConditions: {
      minEpoch: 6,
      classConditions: {
        worker: {
          minPop: 50,
          maxApproval: 55,
        },
        capitalist: {
          minWealthShare: 0.3,
        },
      },
    },
    options: [
      {
        id: 'legalize_unions',
        text: '承认工会合法地位',
        description: '赋予工人组织和集体谈判的权利。',
        effects: {
          stability: -10,
          approval: {
            worker: 35,
            peasant: 15,
            capitalist: -35,
            merchant: -15,
          },
        },
      },
      {
        id: 'ban_unions',
        text: '宣布工会非法',
        description: '站在资本家一边，镇压工人运动。',
        effects: {
          stability: -20,
          approval: {
            worker: -40,
            peasant: -20,
            capitalist: 30,
            soldier: 10,
          },
        },
        randomEffects: [
          {
            chance: 0.4,
            effects: {
              population: -20,
              stability: -25,
            },
          },
        ],
      },
      {
        id: 'regulated_unions',
        text: '有条件承认',
        description: '承认工会但加以限制：禁止政治性罢工，要求事先通知。',
        effects: {
          stability: 0,
          approval: {
            worker: 10,
            capitalist: -10,
            official: 10,
          },
        },
      },
    ],
  },

  // --- Historical Neta: Enclosure Movement ---
  {
    id: 'enclosure_movement',
    name: '圈地运动',
    icon: 'Fence',
    image: null,
    description: '大地主们开始用篱笆圈占公共牧场，驱逐在那里放牧了几代人的小农。他们声称这样能提高土地效率。但无数农民失去了生计，被迫流落到城市寻找工作，或沦为乞丐。',
    triggerConditions: {
      minEpoch: 4,
      classConditions: {
        landowner: {
          minWealthShare: 0.25,
          minInfluenceShare: 0.2,
        },
        peasant: {
          minPop: 60,
        },
      },
    },
    options: [
      {
        id: 'support_enclosure',
        text: '支持圈地',
        description: '以提高生产效率的名义，允许并保护圈地行为。',
        effects: {
          resources: {
            food: 150,
            science: 30,
          },
          stability: -15,
          approval: {
            landowner: 30,
            capitalist: 20,
            peasant: -35,
            worker: 10,
          },
        },
      },
      {
        id: 'protect_commons',
        text: '保护公地权利',
        description: '颁布法令禁止圈地，维护传统公地使用权。',
        effects: {
          stability: 10,
          approval: {
            peasant: 25,
            landowner: -30,
            capitalist: -15,
          },
        },
      },
      {
        id: 'compensation_scheme',
        text: '要求赔偿失地农民',
        description: '允许圈地但要求地主补偿被驱逐的农民。',
        effects: {
          resources: {
            food: 80,
          },
          stability: -5,
          approval: {
            peasant: 5,
            landowner: -15,
            worker: 8,
          },
        },
      },
    ],
  },

  // --- Political: Free Speech Debate ---
  {
    id: 'press_freedom_debate',
    name: '新闻自由之争',
    icon: 'Newspaper',
    image: null,
    description: '一份报纸刊登了揭露政府腐败的调查报道，引发轩然大波。涉事官员要求查封报社、逮捕编辑；记者和学者则高呼"真相不能被压制！"。这场争论已经超越了个案，变成了关于新闻自由的原则之争。',
    triggerConditions: {
      minEpoch: 5,
      classConditions: {
        scribe: {
          minInfluenceShare: 0.12,
        },
        official: {
          minPop: 10,
        },
      },
    },
    options: [
      {
        id: 'protect_press',
        text: '保护新闻自由',
        description: '宣布报道合法，调查被揭露的腐败。',
        effects: {
          resources: {
            culture: 60,
          },
          stability: -5,
          approval: {
            scribe: 30,
            merchant: 15,
            peasant: 10,
            official: -25,
          },
        },
      },
      {
        id: 'shut_down_paper',
        text: '关闭报社',
        description: '以"散布谣言"为由查封报社，逮捕编辑。',
        effects: {
          resources: {
            culture: -40,
          },
          stability: 5,
          approval: {
            scribe: -35,
            merchant: -10,
            peasant: -15,
            official: 20,
          },
        },
      },
      {
        id: 'regulate_press',
        text: '加强媒体管理',
        description: '不追究此事，但设立审查委员会"规范"报道。',
        effects: {
          resources: {
            culture: -20,
          },
          stability: 3,
          approval: {
            scribe: -20,
            official: 15,
            merchant: 5,
          },
        },
      },
    ],
  },

  // --- Class Conflict: Tax Farmer Abuse ---
  {
    id: 'tax_farmer_abuse',
    name: '包税人之祸',
    icon: 'Coins',
    image: null,
    description: '你将征税权外包给了富商——他们预付税款，然后自己去向百姓收取更多以牟利。现在民间怨声载道：包税人勒索、殴打、甚至关押交不起税的农民。有人开始武力抗税。',
    triggerConditions: {
      minEpoch: 3,
      classConditions: {
        merchant: {
          minWealthShare: 0.2,
        },
        peasant: {
          maxApproval: 50,
        },
      },
    },
    options: [
      {
        id: 'abolish_tax_farming',
        text: '废除包税制',
        description: '收回征税权，建立国家税务机构。',
        effects: {
          resources: {
            silver: -100,
          },
          stability: 8,
          approval: {
            peasant: 25,
            worker: 15,
            merchant: -25,
            official: 15,
          },
        },
      },
      {
        id: 'regulate_tax_farmers',
        text: '限制包税人权力',
        description: '设立规则限制其收取的金额，但保留制度。',
        effects: {
          resources: {
            silver: -30,
          },
          stability: 3,
          approval: {
            peasant: 10,
            merchant: -10,
            official: 5,
          },
        },
      },
      {
        id: 'crack_down_resisters',
        text: '镇压抗税者',
        description: '杀一儆百，确保税收不受影响。',
        effects: {
          population: -15,
          stability: -10,
          approval: {
            peasant: -30,
            worker: -20,
            merchant: 15,
            soldier: 10,
          },
        },
      },
    ],
  },

  // --- Historical Neta: Terror and Virtue ---
  {
    id: 'reign_of_terror',
    name: '恐怖时期',
    icon: 'Skull',
    image: null,
    description: '革命委员会声称到处都是"人民的敌人"和"反革命分子"。断头台日夜不停，任何人都可能被邻居告发。一位革命领袖宣称："没有美德的恐怖是有害的，没有恐怖的美德是无力的！"',
    triggerConditions: {
      minEpoch: 5,
      minStability: 20,
      maxStability: 45,
      classConditions: {
        peasant: {
          minApproval: 55,
        },
        landowner: {
          maxApproval: 35,
        },
      },
    },
    options: [
      {
        id: 'end_terror',
        text: '结束恐怖',
        description: '公开谴责滥杀无辜，解散革命法庭。',
        effects: {
          stability: 10,
          approval: {
            landowner: 25,
            merchant: 20,
            cleric: 15,
            peasant: -20,
            worker: -15,
          },
        },
      },
      {
        id: 'intensify_terror',
        text: '加剧清洗',
        description: '"革命尚未成功！"扩大打击范围。',
        effects: {
          population: -40,
          stability: -15,
          approval: {
            peasant: 15,
            worker: 10,
            landowner: -35,
            merchant: -30,
            cleric: -30,
          },
        },
      },
      {
        id: 'redirect_terror',
        text: '转移矛头',
        description: '将恐怖对准革命领袖自身，"革命吞噬自己的孩子"。',
        effects: {
          population: -10,
          stability: 5,
          approval: {
            peasant: -5,
            official: 15,
            merchant: 10,
          },
        },
      },
    ],
  },

  // --- Economic: Market Crash ---
  {
    id: 'stock_market_crash',
    name: '股市崩盘',
    icon: 'TrendingDown',
    image: null,
    description: '股票交易所今天上演了末日景象：投资者争相抛售，股价一落千丈。许多人一夜之间倾家荡产，有人当场从交易所大楼跳下。经济危机的阴影正在笼罩整个国家。',
    triggerConditions: {
      minEpoch: 6,
      classConditions: {
        capitalist: {
          minPop: 8,
          minWealthShare: 0.25,
        },
        merchant: {
          minPop: 15,
        },
      },
    },
    options: [
      {
        id: 'massive_intervention',
        text: '大规模国家干预',
        description: '政府入市购买股票，稳定金融系统。',
        effects: {
          resources: {
            silver: -500,
          },
          stability: 10,
          approval: {
            capitalist: 20,
            merchant: 15,
            worker: -15,
            peasant: -20,
          },
        },
      },
      {
        id: 'let_market_correct',
        text: '让市场自我修正',
        description: '"这是市场的自我净化。"不进行干预。',
        effects: {
          stability: -20,
          approval: {
            capitalist: -30,
            merchant: -25,
            worker: 5,
            peasant: 5,
          },
        },
      },
      {
        id: 'protect_small_investors',
        text: '保护小投资者',
        description: '只帮助普通人，让大资本家自生自灭。',
        effects: {
          resources: {
            silver: -200,
          },
          stability: -5,
          approval: {
            capitalist: -25,
            merchant: 10,
            worker: 15,
            peasant: 12,
          },
        },
      },
    ],
  },

  // --- Social: Education Reform ---
  {
    id: 'education_reform_debate',
    name: '教育改革之争',
    icon: 'GraduationCap',
    image: null,
    description: '改革派提议建立全民免费义务教育制度。教会反对："教育是教会的传统领域！"贵族担心："如果农民的孩子都能读书，谁来种地？"但也有人说："国家的未来取决于民众的素质。"',
    triggerConditions: {
      minEpoch: 5,
      classConditions: {
        scribe: {
          minInfluenceShare: 0.1,
        },
        cleric: {
          minInfluenceShare: 0.1,
        },
      },
    },
    options: [
      {
        id: 'universal_education',
        text: '推行全民教育',
        description: '建立国家学校体系，所有儿童必须上学。',
        effects: {
          resources: {
            silver: -300,
            science: 150,
            culture: 100,
          },
          stability: -5,
          approval: {
            scribe: 30,
            peasant: 15,
            worker: 15,
            cleric: -25,
            landowner: -20,
          },
        },
      },
      {
        id: 'church_education',
        text: '维持教会办学',
        description: '将教育继续交给教会，国家给予补贴。',
        effects: {
          resources: {
            silver: -100,
            culture: 50,
          },
          stability: 5,
          approval: {
            cleric: 25,
            landowner: 10,
            scribe: -20,
            peasant: -10,
          },
        },
      },
      {
        id: 'elite_education',
        text: '只教育精英',
        description: '建立有限的精英学校，培养统治阶层。',
        effects: {
          resources: {
            silver: -150,
            science: 80,
          },
          stability: 3,
          approval: {
            scribe: 10,
            landowner: 15,
            peasant: -15,
            worker: -15,
          },
        },
      },
    ],
  },

  // --- Historical Neta: Great Schism Style ---
  {
    id: 'religious_schism',
    name: '宗教分裂',
    icon: 'Cross',
    image: null,
    description: '教会内部爆发了关于教义的激烈争论，两派互相指责对方为异端。各地信众开始选边站，有些地方甚至发生了信徒间的暴力冲突。双方都要求你表态支持。',
    triggerConditions: {
      minEpoch: 3,
      classConditions: {
        cleric: {
          minInfluenceShare: 0.15,
        },
        peasant: {
          minPop: 50,
        },
      },
    },
    options: [
      {
        id: 'support_orthodox',
        text: '支持传统派',
        description: '站在正统教会一边，镇压"异端"。',
        effects: {
          stability: 5,
          approval: {
            cleric: 20,
            landowner: 10,
            peasant: -10,
            scribe: -15,
          },
        },
      },
      {
        id: 'support_reformers',
        text: '支持改革派',
        description: '支持宗教改革，可能引发与传统势力的冲突。',
        effects: {
          resources: {
            culture: 50,
          },
          stability: -10,
          approval: {
            cleric: -25,
            peasant: 15,
            scribe: 20,
            landowner: -15,
          },
        },
      },
      {
        id: 'religious_tolerance',
        text: '宣布宗教宽容',
        description: '允许两派共存，国家保持中立。',
        effects: {
          resources: {
            culture: 30,
          },
          stability: -5,
          approval: {
            cleric: -15,
            merchant: 15,
            scribe: 15,
            peasant: 5,
          },
        },
      },
    ],
  },
];

/**
 * 检查事件是否可以触发
 * @param {Object} event - 事件对象
 * @param {Object} gameState - 游戏状态
 * @returns {boolean} - 是否可以触发
 */
export function canTriggerEvent(event, gameState) {
  if (!event.triggerConditions) return true;
  
  const conditions = event.triggerConditions;
  
  // 检查人口条件
  if (conditions.minPopulation && gameState.population < conditions.minPopulation) {
    return false;
  }
  
  // 检查时代条件
  if ((conditions.minEpoch !== undefined && gameState.epoch < conditions.minEpoch) || (conditions.maxEpoch !== undefined && gameState.epoch > conditions.maxEpoch)) {
        return false;
    }
    

  
  // 检查科技条件
  if (conditions.minScience && gameState.resources.science < conditions.minScience) {
    return false;
  }
  
  
  // 检查阶层相关条件（人口、好感度、影响力占比、收入与财富变动）
  if (conditions.classConditions) {
    const popStructure = gameState.popStructure || {};
    const classApproval = gameState.classApproval || {};
    const classInfluence = gameState.classInfluence || {};
    const classWealth = gameState.classWealth || {};
    const classWealthDelta = gameState.classWealthDelta || {};
    const classIncome = gameState.classIncome || {};

    let totalInfluence = gameState.totalInfluence;
    if (!totalInfluence || totalInfluence <= 0) {
      totalInfluence = Object.values(classInfluence).reduce((sum, val) => sum + (val || 0), 0);
    }

    let totalWealth = gameState.totalWealth;
    if (!totalWealth || totalWealth <= 0) {
      totalWealth = Object.values(classWealth).reduce((sum, val) => sum + (val || 0), 0);
    }

    for (const key in conditions.classConditions) {
      const cond = conditions.classConditions[key];
      if (!cond) continue;

      const pop = popStructure[key] || 0;
      const approval = classApproval[key] ?? 50;
      const influenceValue = classInfluence[key] || 0;
      const wealthValue = classWealth[key] || 0;
      const wealthDelta = classWealthDelta[key] || 0;
      const income = classIncome[key] || 0;

      const influenceShare = totalInfluence > 0 ? influenceValue / totalInfluence : 0;
      const wealthShare = totalWealth > 0 ? wealthValue / totalWealth : 0;

      if (cond.minPop !== undefined && pop < cond.minPop) return false;
      if (cond.maxPop !== undefined && pop > cond.maxPop) return false;

      if (cond.minApproval !== undefined && approval < cond.minApproval) return false;
      if (cond.maxApproval !== undefined && approval > cond.maxApproval) return false;

      if (cond.minInfluenceShare !== undefined && influenceShare < cond.minInfluenceShare) return false;
      if (cond.maxInfluenceShare !== undefined && influenceShare > cond.maxInfluenceShare) return false;

      if (cond.minWealth !== undefined && wealthValue < cond.minWealth) return false;
      if (cond.maxWealth !== undefined && wealthValue > cond.maxWealth) return false;

      if (cond.minWealthShare !== undefined && wealthShare < cond.minWealthShare) return false;
      if (cond.maxWealthShare !== undefined && wealthShare > cond.maxWealthShare) return false;

      if (cond.minWealthDelta !== undefined && wealthDelta < cond.minWealthDelta) return false;
      if (cond.maxWealthDelta !== undefined && wealthDelta > cond.maxWealthDelta) return false;

      if (cond.minIncome !== undefined && income < cond.minIncome) return false;
      if (cond.maxIncome !== undefined && income > cond.maxIncome) return false;
    }
  }
  
  return true;
}

/**
 * 获取可触发的随机事件
 * @param {Object} gameState - 游戏状态
 * @returns {Object|null} - 随机事件或null
 */
export function getRandomEvent(gameState) {
  const availableEvents = EVENTS.filter(event => canTriggerEvent(event, gameState));
  
  if (availableEvents.length === 0) return null;
  
  const randomIndex = Math.floor(Math.random() * availableEvents.length);
  return availableEvents[randomIndex];
}

/**
 * 创建外交事件 - 敌国宣战
 * @param {Object} nation - 宣战的国家
 * @param {Function} onAccept - 接受宣战的回调
 * @returns {Object} - 外交事件对象
 */
export function createWarDeclarationEvent(nation, onAccept) {
  return {
    id: `war_declaration_${nation.id}_${Date.now()}`,
    name: `${nation.name}宣战`,
    icon: 'Swords',
    image: null,
    description: `${nation.name}对你的国家发动了战争！他们的军队正在集结，边境局势十分紧张。这是一场不可避免的冲突，你必须做好应战准备。`,
    isDiplomaticEvent: true,
    options: [
      {
        id: 'acknowledge',
        text: '应战',
        description: '接受战争状态，准备迎战',
        effects: {},
        callback: onAccept,
      },
    ],
  };
}

/**
 * 创建外交事件 - 敌国送礼
 * @param {Object} nation - 送礼的国家
 * @param {number} giftAmount - 礼物金额
 * @param {Function} onAccept - 接受礼物的回调
 * @returns {Object} - 外交事件对象
 */
export function createGiftEvent(nation, giftAmount, onAccept) {
  return {
    id: `gift_${nation.id}_${Date.now()}`,
    name: `${nation.name}的礼物`,
    icon: 'Gift',
    image: null,
    description: `${nation.name}派遣使节前来，带来了价值${giftAmount}银币的珍贵礼物。这是他们表达善意和改善关系的诚意之举。`,
    isDiplomaticEvent: true,
    options: [
      {
        id: 'accept',
        text: '接受礼物',
        description: `收下礼物，获得${giftAmount}银币`,
        effects: {
          resources: {
            silver: giftAmount,
          },
        },
        callback: onAccept,
      },
    ],
  };
}

/**
 * 创建外交事件 - 敌国请求和平
 * @param {Object} nation - 请求和平的国家
 * @param {number} tribute - 赔款金额
 * @param {Function} onAccept - 接受和平的回调
 * @returns {Object} - 外交事件对象
 */
/**
 * 创建外交事件 - 敌国请求和平（根据战争分数提供不同选项）
 * @param {Object} nation - 请求和平的国家
 * @param {number} tribute - 基础赔款金额
 * @param {number} warScore - 战争分数
 * @param {Function} callback - 回调函数，接收accepted参数
 * @returns {Object} - 外交事件对象
 */
// 分期赔款总额相对一次性赔款的倍率（保证总额更高）
const INSTALLMENT_TOTAL_MULTIPLIER = 3;

export function createEnemyPeaceRequestEvent(nation, tribute, warScore, callback) {
  const options = [];
  
  // 根据战争分数提供不同的和平选项
  if (warScore > 20) {
    // 大胜：可以要求更多赔款或领土
    const highTribute = Math.floor(tribute * 1.5);
    const highInstallmentTotal = Math.ceil(highTribute * INSTALLMENT_TOTAL_MULTIPLIER);
    const installmentAmount = Math.ceil(highInstallmentTotal / 365); // 每天支付
    // 使用财富估算人口（假设每100财富对应约50人口）
    const estimatedPopulation = Math.floor((nation.wealth || 800) / 100 * 50);
    const populationDemand = Math.max(6, Math.floor(estimatedPopulation * 0.04)); // 要求4%人口，至少4人
    
    options.push({
      id: 'demand_more',
      text: '要求更多赔款',
      description: `要求${highTribute}银币赔款（比原提议多50%）`,
      effects: {
        resources: {
          silver: highTribute,
        },
      },
      callback: () => callback(true, 'demand_more', highTribute),
    });
    options.push({
      id: 'demand_installment',
      text: '要求分期支付',
      description: `要求每天支付${installmentAmount}银币，持续一年（共${installmentAmount * 365}银币）`,
      effects: {},
      callback: () => callback(true, 'installment', installmentAmount),
    });
    options.push({
      id: 'demand_population',
      text: '要求割地',
      description: `要求割让人口上限 ${populationDemand}（附带等量人口）`,
      effects: {},
      callback: () => callback(true, 'population', populationDemand),
    });
    options.push({
      id: 'accept_standard',
      text: '接受标准和平',
      description: `接受${tribute}银币赔款，快速结束战争`,
      effects: {
        resources: {
          silver: tribute,
        },
      },
      callback: () => callback(true, 'standard', tribute),
    });
  } else if (warScore > 10) {
    // 小胜：标准和平条款 + 分期支付选项
    const installmentTotal = Math.ceil(tribute * INSTALLMENT_TOTAL_MULTIPLIER);
    const installmentAmount = Math.ceil(installmentTotal / 365); // 每天支付
    // 使用财富估算人口（假设每100财富对应约50人口）
    const estimatedPopulation = Math.floor((nation.wealth || 800) / 100 * 50);
    const populationDemand = Math.max(4, Math.floor(estimatedPopulation * 0.02)); // 要求2%人口，至少2人
    
    options.push({
      id: 'accept',
      text: '接受和平',
      description: `结束战争，获得${tribute}银币赔款`,
      effects: {
        resources: {
          silver: tribute,
        },
      },
      callback: () => callback(true, 'standard', tribute),
    });
    options.push({
      id: 'demand_installment',
      text: '要求分期支付',
      description: `要求每天支付${installmentAmount}银币，持续一年（共${installmentAmount * 365}银币）`,
      effects: {},
      callback: () => callback(true, 'installment', installmentAmount),
    });
    options.push({
      id: 'demand_population',
      text: '要求割地',
      description: `要求割让人口上限 ${populationDemand}（附带等量人口）`,
      effects: {},
      callback: () => callback(true, 'population', populationDemand),
    });
  } else {
    // 僵持：可以接受或继续战争
    options.push({
      id: 'accept',
      text: '接受和平',
      description: `结束战争，获得${tribute}银币赔款`,
      effects: {
        resources: {
          silver: tribute,
        },
      },
      callback: () => callback(true, 'standard', tribute),
    });
  }
  
  // 总是可以拒绝和平
  options.push({
    id: 'reject',
    text: '拒绝和平',
    description: '继续战争，追求更大的胜利',
    effects: {},
    callback: () => callback(false),
  });
  
  // 根据战争分数生成不同的描述
  let description = '';
  if (warScore > 20) {
    description = `${nation.name}在战争中遭受惨重损失，他们派遣使节前来恳求和平。作为和平的代价，他们愿意支付${tribute}银币的赔款。鉴于你的巨大优势，你可以要求更多。`;
  } else if (warScore > 10) {
    description = `${nation.name}在战争中处于劣势，他们派遣使节前来请求和平。作为和平的代价，他们愿意支付${tribute}银币的赔款。`;
  } else {
    description = `${nation.name}派遣使节前来请求和平。虽然战局尚未明朗，但他们愿意支付${tribute}银币作为和平的诚意。`;
  }
  
  return {
    id: `enemy_peace_request_${nation.id}_${Date.now()}`,
    name: `${nation.name}请求和平`,
    icon: 'HandHeart',
    image: null,
    description,
    isDiplomaticEvent: true,
    options,
  };
}

/**
 * 创建外交事件 - 玩家提出和平（根据战争分数提供不同选项）
 * @param {Object} nation - 目标国家
 * @param {number} warScore - 战争分数（正数表示玩家优势，负数表示劣势）
 * @param {number} warDuration - 战争持续时间
 * @param {number} enemyLosses - 敌方损失
 * @param {Function} callback - 回调函数
 * @returns {Object} - 外交事件对象
 */
export function createPlayerPeaceProposalEvent(nation, warScore, warDuration, enemyLosses, callback) {
  const options = [];
  
  if (warScore > 15) {
    // 大胜：可以要求赔款
    const highTribute = Math.min(nation.wealth || 0, Math.ceil(warScore * 50 + enemyLosses * 3));
    const standardTribute = Math.min(nation.wealth || 0, Math.ceil(warScore * 40 + enemyLosses * 2));
    const highInstallmentTotal = Math.ceil(highTribute * INSTALLMENT_TOTAL_MULTIPLIER);
    const installmentAmount = Math.ceil(highInstallmentTotal / 365);
    const estimatedPopulation = Math.floor((nation.wealth || 800) / 100 * 50);
    const populationDemand = Math.max(5, Math.floor(estimatedPopulation * 0.03)); // 或 0.03
    
    options.push({
      id: 'demand_high',
      text: '要求高额赔款',
      description: `要求${highTribute}银币赔款（可能被拒绝）`,
      effects: {},
      callback: () => callback('demand_high', highTribute),
    });
    options.push({
      id: 'demand_installment',
      text: '要求分期支付',
      description: `要求每天支付${installmentAmount}银币，持续一年（共${installmentAmount * 365}银币）`,
      effects: {},
      callback: () => callback('demand_installment', installmentAmount),
    });
    options.push({
      id: 'demand_population',
      text: '要求割地',
      description: `要求割让人口上限 ${populationDemand}（附带等量人口）`,
      effects: {},
      callback: () => callback('demand_population', populationDemand),
    });
    options.push({
      id: 'demand_standard',
      text: '要求标准赔款',
      description: `要求${standardTribute}银币赔款（较易接受）`,
      effects: {},
      callback: () => callback('demand_standard', standardTribute),
    });
    options.push({
      id: 'peace_only',
      text: '无条件和平',
      description: '不要求赔款，直接结束战争',
      effects: {},
      callback: () => callback('peace_only', 0),
    });
  } else if (warScore > 0) {
    // 小胜：可以要求少量赔款或无条件和平
    const tribute = Math.min(nation.wealth || 0, Math.ceil(warScore * 40 + enemyLosses * 2));
    const installmentTotal = Math.ceil(tribute * INSTALLMENT_TOTAL_MULTIPLIER);
    const installmentAmount = Math.ceil(installmentTotal / 365);
    const estimatedPopulation = Math.floor((nation.wealth || 800) / 100 * 50);
    const populationDemand = Math.max(5, Math.floor(estimatedPopulation * 0.01)); // 或 0.03
    
    options.push({
      id: 'demand_tribute',
      text: '要求赔款',
      description: `要求${tribute}银币赔款`,
      effects: {},
      callback: () => callback('demand_tribute', tribute),
    });
    options.push({
      id: 'demand_installment',
      text: '要求分期支付',
      description: `要求每天支付${installmentAmount}银币，持续一年（共${installmentAmount * 365}银币）`,
      effects: {},
      callback: () => callback('demand_installment', installmentAmount),
    });
    options.push({
      id: 'demand_population',
      text: '要求割地',
      description: `要求割让人口上限 ${populationDemand}（附带等量人口）`,
      effects: {},
      callback: () => callback('demand_population', populationDemand),
    });
    options.push({
      id: 'peace_only',
      text: '无条件和平',
      description: '不要求赔款，直接结束战争',
      effects: {},
      callback: () => callback('peace_only', 0),
    });
  } else if (warScore < -10) {
    // 大败：需要支付高额赔款
    const payment = Math.max(150, Math.ceil(Math.abs(warScore) * 35 + warDuration * 6));
    const highInstallmentTotal = Math.ceil(payment * INSTALLMENT_TOTAL_MULTIPLIER);
    const installmentAmount = Math.ceil(highInstallmentTotal / 365);
    const populationOffer = Math.floor((nation.population || 1000) * 0.05);
    
    options.push({
      id: 'pay_high',
      text: `支付${payment}银币求和`,
      description: '支付高额赔款以结束战争',
      effects: {},
      callback: () => callback('pay_high', payment),
    });
    options.push({
      id: 'pay_installment',
      text: `分期支付赔款`,
      description: `每天支付${installmentAmount}银币，持续一年（共${installmentAmount * 365}银币）`,
      effects: {},
      callback: () => callback('pay_installment', installmentAmount),
    });
    options.push({
      id: 'offer_population',
      text: `割让人口上限 ${populationOffer}`,
      description: '割让领土（减少人口上限和人口）以结束战争',
      effects: {},
      callback: () => callback('offer_population', populationOffer),
    });
  } else if (warScore < 0) {
    // 小败：需要支付赔款
    const payment = Math.max(100, Math.ceil(Math.abs(warScore) * 30 + warDuration * 5));
    const installmentTotal = Math.ceil(payment * INSTALLMENT_TOTAL_MULTIPLIER);
    const installmentAmount = Math.ceil(installmentTotal / 365);
    const populationOffer = Math.floor((nation.population || 1000) * 0.03);
    
    options.push({
      id: 'pay_standard',
      text: `支付${payment}银币求和`,
      description: '支付赔款以结束战争',
      effects: {},
      callback: () => callback('pay_standard', payment),
    });
    options.push({
      id: 'pay_installment',
      text: `分期支付赔款`,
      description: `每天支付${installmentAmount}银币，持续一年（共${installmentAmount * 365}银币）`,
      effects: {},
      callback: () => callback('pay_installment', installmentAmount),
    });
    options.push({
      id: 'offer_population',
      text: `割让人口上限 ${populationOffer}`,
      description: '割让领土（减少人口上限和人口）以结束战争',
      effects: {},
      callback: () => callback('offer_population', populationOffer),
    });
  } else {
    // 僵持：无条件和平
    options.push({
      id: 'peace_only',
      text: '提议和平',
      description: '提议无条件停战',
      effects: {},
      callback: () => callback('peace_only', 0),
    });
  }
  
  // 总是可以取消
  options.push({
    id: 'cancel',
    text: '取消',
    description: '放弃和平谈判',
    effects: {},
    callback: () => callback('cancel', 0),
  });
  
  // 根据战争分数生成描述
  let description = '';
  if (warScore > 15) {
    description = `你在与${nation.name}的战争中占据压倒性优势。现在是提出和平条款的好时机，你可以要求丰厚的赔款。`;
  } else if (warScore > 0) {
    description = `你在与${nation.name}的战争中略占上风。你可以提出和平，并要求一定的赔款作为补偿。`;
  } else if (warScore < -10) {
    description = `你在与${nation.name}的战争中处于极大劣势。如果想要和平，可能需要支付高额赔款。`;
  } else if (warScore < 0) {
    description = `你在与${nation.name}的战争中处于劣势。如果想要和平，需要支付一定的赔款。`;
  } else {
    description = `你与${nation.name}的战争陷入僵持。双方都没有明显优势，可以提议无条件停战。`;
  }
  
  return {
    id: `player_peace_proposal_${nation.id}_${Date.now()}`,
    name: `向${nation.name}提出和平`,
    icon: 'HandHeart',
    image: null,
    description,
    isDiplomaticEvent: true,
    options,
  };
}

// 保留旧函数名以兼容
export function createPeaceRequestEvent(nation, tribute, onAccept) {
  return createEnemyPeaceRequestEvent(nation, tribute, 0, (accepted) => {
    if (accepted) onAccept();
  });
}

/**
 * 创建外交事件 - 敌国发起战斗
 * @param {Object} nation - 发起战斗的国家
 * @param {Object} battleResult - 战斗结果
 * @param {Function} onAcknowledge - 确认的回调
 * @returns {Object} - 外交事件对象
 */
export function createBattleEvent(nation, battleResult, onAcknowledge) {
  const isVictory = battleResult.victory;
  const isRaid = battleResult.foodLoss !== undefined || battleResult.silverLoss !== undefined;
  
  let description = '';
  if (isRaid) {
    // 突袭事件
    description = `${nation.name}趁你不备发动了突袭！他们掠夺了你的资源并造成了人员伤亡。`;
    description += `\n\n突袭损失：`;
    if (battleResult.foodLoss) description += `\n粮食：${battleResult.foodLoss}`;
    if (battleResult.silverLoss) description += `\n银币：${battleResult.silverLoss}`;
    if (battleResult.playerLosses) description += `\n人口：${battleResult.playerLosses}`;
  } else {
    // 正常战斗
    description = isVictory
      ? `${nation.name}的军队向你发起了进攻，但在你的英勇抵抗下被击退了！敌军损失惨重，士气低落。`
      : `${nation.name}的军队向你发起了猛烈进攻！你的军队遭受了重大损失，局势十分危急。`;
    
    description += `\n\n战斗结果：\n我方损失：${battleResult.playerLosses || 0}人\n敌方损失：${battleResult.enemyLosses || 0}人`;
  }
  
  return {
    id: `battle_${nation.id}_${Date.now()}`,
    name: isRaid ? `${nation.name}的突袭` : `${nation.name}的进攻`,
    icon: isVictory ? 'Shield' : 'AlertTriangle',
    image: null,
    description,
    isDiplomaticEvent: true,
    options: [
      {
        id: 'acknowledge',
        text: '了解',
        description: '查看详情',
        effects: {},
        callback: onAcknowledge,
      },
    ],
  };
}
