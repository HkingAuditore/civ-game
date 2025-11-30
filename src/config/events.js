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
            gold: -50,
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
            gold: -20,
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
            gold: -100,
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
            gold: 50,
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
            gold: 150,
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
            gold: -30,
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
            gold: -100,
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
            gold: -200,
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
            gold: -50,
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
            gold: 100,
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
            gold: -150,
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
            gold: -100,
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
export function createPeaceRequestEvent(nation, tribute, onAccept) {
  return {
    id: `peace_request_${nation.id}_${Date.now()}`,
    name: `${nation.name}请求和平`,
    icon: 'HandHeart',
    image: null,
    description: `${nation.name}在战争中遭受重创，他们派遣使节前来请求和平。作为和平的代价，他们愿意支付${tribute}银币的赔款。`,
    isDiplomaticEvent: true,
    options: [
      {
        id: 'accept',
        text: '接受和平',
        description: `结束战争，获得${tribute}银币赔款`,
        effects: {
          resources: {
            silver: tribute,
          },
        },
        callback: onAccept,
      },
      {
        id: 'reject',
        text: '拒绝和平',
        description: '继续战争，追求更大的胜利',
        effects: {},
        callback: () => {}, // 什么都不做，继续战争
      },
    ],
  };
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
  const description = isVictory
    ? `${nation.name}的军队向你发起了进攻，但在你的英勇抵抗下被击退了！敌军损失惨重，士气低落。`
    : `${nation.name}的军队向你发起了猛烈进攻！你的军队遭受了重大损失，局势十分危急。`;
  
  return {
    id: `battle_${nation.id}_${Date.now()}`,
    name: `${nation.name}的进攻`,
    icon: isVictory ? 'Shield' : 'AlertTriangle',
    image: null,
    description: description + `\n\n战斗结果：\n我方损失：${battleResult.playerLosses || 0}人\n敌方损失：${battleResult.enemyLosses || 0}人`,
    isDiplomaticEvent: true,
    options: [
      {
        id: 'acknowledge',
        text: '了解',
        description: '查看战斗详情',
        effects: {},
        callback: onAcknowledge,
      },
    ],
  };
}
