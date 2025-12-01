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
            noble: 5,
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
            noble: -5,
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
            noble: -10,
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
            luxury: 50,
            tools: 30,
          },
          approval: {
            merchant: 15,
            noble: 10,
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
            noble: 10,
          },
        },
      },
    ],
  },
  {
    id: 'noble_conspiracy',
    name: '贵族阴谋',
    icon: 'Shield',
    image: null,
    description: '你的密探发现了一个贵族阴谋。几位有权势的贵族正在密谋反对你的统治，他们试图煽动其他阶层加入他们的行列。',
    triggerConditions: {
      minEpoch: 2,
      maxNobleApproval: 30,
    },
    options: [
      {
        id: 'arrest',
        text: '逮捕主谋',
        description: '立即逮捕阴谋的主要策划者',
        effects: {
          stability: -10,
          approval: {
            noble: -25,
            peasant: 10,
            merchant: 5,
          },
        },
      },
      {
        id: 'negotiate',
        text: '私下谈判',
        description: '与贵族们进行秘密谈判，做出一些让步',
        effects: {
          resources: {
            silver: -100,
          },
          stability: 5,
          approval: {
            noble: 15,
            peasant: -10,
          },
        },
      },
      {
        id: 'ignore',
        text: '假装不知',
        description: '继续监视，但暂不采取行动',
        effects: {
          stability: -5,
          approval: {
            noble: -5,
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
            noble: -5,
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
    id: 'classical_scholar_salon',
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
        scholar: {
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
            scholar: 15,
            scribe: 10,
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
            scholar: 5,
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
            scholar: -12,
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
        scholar: {
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
            scholar: 18,
            scribe: 10,
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
            scholar: -12,
            cleric: 8,
          },
        },
      },
      {
        id: 'coopt_scholars',
        text: '邀请部分学者入仕',
        description: '用官职与津贴吸纳激进学者。',
        effects: {
          resources: {
            silver: -150,
          },
          stability: 5,
          approval: {
            scholar: 10,
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
  if (conditions.minEpoch !== undefined && gameState.epoch < conditions.minEpoch) {
    return false;
  }
  
  // 检查科技条件
  if (conditions.minScience && gameState.resources.science < conditions.minScience) {
    return false;
  }
  
  // 检查贵族支持度条件
  if (conditions.maxNobleApproval !== undefined) {
    const nobleApproval = gameState.classApproval?.noble || 50;
    if (nobleApproval > conditions.maxNobleApproval) {
      return false;
    }
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
