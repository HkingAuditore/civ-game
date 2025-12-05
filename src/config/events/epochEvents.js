// Epoch-specific Events - Events tied to specific historical eras
// Each epoch has 5 unique events with historical references and class conflicts

export const EPOCH_EVENTS = [
  // ==========================================
  // 石器时代 (Epoch 0) - Stone Age Events
  // ==========================================
  {
    id: 'mammoth_hunt',
    name: '猛犸象狩猎',
    icon: 'Target',
    image: null,
    description: '侦察兵发现了一头巨大的猛犸象！这是一次危险但回报丰厚的狩猎机会。整个部落都在讨论是否要组织这次狩猎。',
    triggerConditions: {
      minPopulation: 30,
      maxEpoch: 1,
    },
    options: [
      {
        id: 'full_hunt',
        text: '全族出动',
        description: '动员所有战士，确保成功但风险更大。',
        effects: {
          resourcePercent: {
            food: 0.015,
          },
          populationPercent: -0.015,
          approval: {
            soldier: 15,
            peasant: 10,
          },
        },
        randomEffects: [
          {
            chance: 0.3,
            effects: {
              resourcePercent: { food: 0.07 },
              approval: { soldier: 20 },
            },
            description: '猎人们技艺高超，猛犸象被成功捕获，收获超出预期！',
          },
        ],
      },
      {
        id: 'small_party',
        text: '精英小队',
        description: '只派最好的猎人，风险较低但收获也少。',
        effects: {
          resourcePercent: {
            food: 0.03,
          },
          approval: {
            soldier: 10,
          },
        },
      },
      {
        id: 'let_it_go',
        text: '放弃狩猎',
        description: '猛犸象太危险了，不值得冒险。',
        effects: {
          stability: 5,
          approval: {
            peasant: 5,
            soldier: -10,
          },
        },
      },
    ],
  },
  {
    id: 'fire_discovery',
    name: '火的秘密',
    icon: 'Flame',
    image: null,
    description: '一位老人声称掌握了"驯化"火焰的秘密。他愿意将这个知识传授给部落，但要求特殊的地位和供养。',
    triggerConditions: {
      maxEpoch: 0,
    },
    options: [
      {
        id: 'honor_elder',
        text: '尊敬长者',
        description: '给予他尊贵地位，学习火的奥秘。',
        effects: {
          resourcePercent: {
            science: 0.03,
            food: -0.012,
          },
          approval: {
            cleric: 15,
            peasant: 5,
          },
        },
      },
      {
        id: 'force_knowledge',
        text: '强迫他交出知识',
        description: '知识应该属于所有人，不能被一人垄断。',
        effects: {
          resourcePercent: {
            science: 0.02,
          },
          stability: -10,
          approval: {
            cleric: -20,
            soldier: 10,
          },
        },
      },
      {
        id: 'reject_offer',
        text: '拒绝他的条件',
        description: '我们不需要这种"魔法"。',
        effects: {
          approval: {
            cleric: -10,
            soldier: 5,
          },
        },
      },
    ],
  },
  {
    id: 'cave_dispute',
    name: '洞穴争端',
    icon: 'Home',
    image: null,
    description: '两个家族为争夺一个宽敞温暖的洞穴而发生冲突。双方都声称这是他们祖先发现的。',
    triggerConditions: {
      minPopulation: 40,
      maxEpoch: 0,
    },
    options: [
      {
        id: 'favor_stronger',
        text: '判给强者',
        description: '强大的家族更能保卫洞穴。',
        effects: {
          stability: -5,
          approval: {
            soldier: 15,
            peasant: -10,
          },
        },
      },
      {
        id: 'share_cave',
        text: '共同居住',
        description: '洞穴足够大，可以容纳两家人。',
        effects: {
          stability: 5,
          approval: {
            peasant: 10,
            soldier: -5,
          },
        },
      },
      {
        id: 'build_new',
        text: '建造新住所',
        description: '动员大家建造新的住所，解决住房问题。',
        effects: {
          resourcePercent: {
            food: -0.02,
          },
          populationCapacity: 20,
          approval: {
            peasant: 15,
            artisan: 10,
          },
        },
      },
    ],
  },
  {
    id: 'shaman_ritual',
    name: '萨满仪式',
    icon: 'Star',
    image: null,
    description: '部落萨满宣称天象显示灾难将至，要求举行大型祭祀仪式。他需要大量的食物和祭品。',
    triggerConditions: {
      maxEpoch: 1,
    },
    options: [
      {
        id: 'grand_ritual',
        text: '举行盛大仪式',
        description: '相信萨满，投入资源进行祭祀。',
        effects: {
          resourcePercent: {
            food: -0.04,
            culture: 0.02,
          },
          stability: 10,
          approval: {
            cleric: 25,
            peasant: 5,
          },
        },
        randomEffects: [
          {
            chance: 0.4,
            effects: {
              stability: 15,
              approval: { cleric: 15 },
            },
            description: '仪式后天气好转，人们相信是萨满的功劳！',
          },
        ],
      },
      {
        id: 'simple_ritual',
        text: '简单祭祀',
        description: '进行较小规模的仪式，节省资源。',
        effects: {
          resourcePercent: {
            food: -0.012,
            culture: 0.012,
          },
          approval: {
            cleric: -5,
          },
        },
      },
      {
        id: 'ignore_shaman',
        text: '无视萨满',
        description: '这些预言不可信，我们靠自己的双手生存。',
        effects: {
          stability: -5,
          approval: {
            cleric: -20,
            soldier: 10,
          },
        },
      },
    ],
  },
  {
    id: 'stone_tool_innovation',
    name: '石器革新',
    icon: 'Hammer',
    image: null,
    description: '一位年轻的工匠发明了一种新的打制石器方法，可以制作更锋利的工具。但部落长老认为这违背了祖先传下的方法。',
    triggerConditions: {
      maxEpoch: 0,
    },
    options: [
      {
        id: 'embrace_innovation',
        text: '接受创新',
        description: '新方法更好，应该推广使用。',
        effects: {
          resourcePercent: {
            science: 0.03,
          },
          approval: {
            artisan: 20,
            cleric: -15,
            peasant: 10,
          },
        },
      },
      {
        id: 'keep_tradition',
        text: '坚持传统',
        description: '祖先的智慧不能轻易抛弃。',
        effects: {
          resourcePercent: {
            culture: 0.02,
          },
          approval: {
            cleric: 15,
            artisan: -15,
          },
        },
      },
      {
        id: 'test_first',
        text: '先行试验',
        description: '让工匠证明他的方法确实更好。',
        effects: {
          resourcePercent: {
            science: 0.02,
            culture: 0.012,
          },
          approval: {
            artisan: 10,
            scribe: 10,
          },
        },
      },
    ],
  },

  // ==========================================
  // 青铜时代 (Epoch 1) - Bronze Age Events
  // ==========================================
  {
    id: 'bronze_secret',
    name: '青铜秘方',
    icon: 'Gem',
    image: null,
    description: '一位外来的铸造师声称知道制作最坚固青铜的秘密配方。他愿意以高价出售这个秘密，或者以换取永久居留权和特权。',
    triggerConditions: {
      minEpoch: 1,
      maxEpoch: 2,
    },
    options: [
      {
        id: 'buy_secret',
        text: '购买秘方',
        description: '支付大量银币获得知识。',
        effects: {
          resourcePercent: {
            silver: -0.03,
            science: 0.05,
          },
          approval: {
            artisan: 20,
            merchant: -10,
          },
        },
      },
      {
        id: 'grant_citizenship',
        text: '授予公民权',
        description: '让他成为我们的一员，分享他的知识。',
        effects: {
          resourcePercent: {
            science: 0.04,
          },
          populationPercent: 0.015,
          approval: {
            artisan: 15,
            landowner: -10,
          },
        },
      },
      {
        id: 'steal_secret',
        text: '偷取秘方',
        description: '派人暗中学习他的技术。',
        effects: {
          resourcePercent: {
            science: 0.03,
          },
          stability: -10,
          approval: {
            soldier: 10,
            merchant: -15,
          },
        },
      },
      {
        id: 'refuse_offer',
        text: '拒绝',
        description: '我们的工匠会自己研究出来。',
        effects: {
          approval: {
            artisan: 5,
          },
        },
      },
    ],
  },
  {
    id: 'writing_invention',
    name: '文字的诞生',
    icon: 'BookOpen',
    image: null,
    description: '神庙的祭司们发明了一套符号系统来记录祭祀和贡品。商人们希望也能使用这套系统来记账，但祭司认为这是神圣的知识。',
    triggerConditions: {
      minEpoch: 1,
      maxEpoch: 2,
    },
    options: [
      {
        id: 'sacred_only',
        text: '仅限神圣用途',
        description: '文字是神的礼物，只能用于宗教事务。',
        effects: {
          resourcePercent: {
            culture: 0.04,
          },
          approval: {
            cleric: 25,
            merchant: -20,
            scribe: -10,
          },
        },
      },
      {
        id: 'limited_secular',
        text: '有限开放',
        description: '允许王室和高官使用，但仍由祭司控制。',
        effects: {
          resourcePercent: {
            culture: 0.03,
            science: 0.02,
          },
          approval: {
            cleric: 5,
            scribe: 15,
            merchant: -5,
          },
        },
      },
      {
        id: 'public_writing',
        text: '公开传授',
        description: '文字应该为所有人服务，推广读写教育。',
        effects: {
          resourcePercent: {
            science: 0.04,
            culture: 0.015,
          },
          approval: {
            cleric: -20,
            merchant: 20,
            scribe: 25,
            artisan: 10,
          },
        },
      },
    ],
  },
  {
    id: 'irrigation_project',
    name: '灌溉工程',
    icon: 'Droplet',
    image: null,
    description: '农民们提议建造一条运河来灌溉农田，但这需要大量劳力。贵族们担心这会影响他们的劳动力供应，而农民则渴望增产。',
    triggerConditions: {
      minEpoch: 1,
      maxEpoch: 3,
    },
    options: [
      {
        id: 'forced_labor',
        text: '强制征发劳役',
        description: '命令所有平民参与建设。',
        effects: {
          resourcePercent: {
            food: 0.05,
          },
          stability: -15,
          approval: {
            landowner: 10,
            peasant: -25,
            artisan: -15,
          },
        },
      },
      {
        id: 'paid_workers',
        text: '雇佣工人',
        description: '支付工资，吸引自愿参与者。',
        effects: {
          resourcePercent: {
            silver: -0.025,
            food: 0.04,
          },
          approval: {
            peasant: 15,
            artisan: 10,
            merchant: -5,
          },
        },
      },
      {
        id: 'noble_contribution',
        text: '贵族分担',
        description: '要求贵族贡献劳力和资源。',
        effects: {
          resourcePercent: {
            food: 0.035,
          },
          approval: {
            landowner: -20,
            peasant: 20,
          },
        },
      },
      {
        id: 'postpone_project',
        text: '暂缓工程',
        description: '现在不是建设的好时机。',
        effects: {
          approval: {
            peasant: -10,
            landowner: 5,
          },
        },
      },
    ],
  },
  {
    id: 'slave_rebellion_bronze',
    name: '奴隶起义',
    icon: 'Users',
    image: null,
    description: '矿山的奴隶们发动了起义，他们杀死了监工，占领了矿区。他们要求获得自由，否则将破坏矿山设施。',
    triggerConditions: {
      minEpoch: 1,
      maxEpoch: 3,
    },
    options: [
      {
        id: 'crush_rebellion',
        text: '武力镇压',
        description: '派军队镇压起义，恢复秩序。',
        effects: {
          stability: -10,
          populationPercent: -0.03,
          approval: {
            soldier: 15,
            landowner: 20,
            peasant: -20,
          },
        },
      },
      {
        id: 'negotiate_freedom',
        text: '谈判解放',
        description: '释放部分奴隶，换取和平解决。',
        effects: {
          populationPercent: 0.05,
          approval: {
            landowner: -25,
            peasant: 15,
            artisan: 10,
          },
        },
      },
      {
        id: 'improve_conditions',
        text: '改善待遇',
        description: '承诺改善奴隶待遇，但不给予自由。',
        effects: {
          resourcePercent: {
            food: -0.02,
          },
          stability: 5,
          approval: {
            landowner: -10,
            peasant: 5,
          },
        },
      },
    ],
  },
  {
    id: 'city_state_alliance',
    name: '城邦联盟',
    icon: 'Handshake',
    image: null,
    description: '周边的几个城邦提议建立一个贸易和防御联盟。这将带来贸易利益，但也意味着在战争时必须援助盟友。',
    triggerConditions: {
      minEpoch: 1,
      maxEpoch: 3,
    },
    options: [
      {
        id: 'join_alliance',
        text: '加入联盟',
        description: '成为联盟的正式成员。',
        effects: {
          resourcePercent: {
            silver: 0.012,
          },
          stability: 10,
          approval: {
            merchant: 20,
            landowner: 10,
            soldier: -10,
          },
        },
      },
      {
        id: 'trade_only',
        text: '仅参与贸易',
        description: '只参与经济合作，不承担军事义务。',
        effects: {
          resourcePercent: {
            silver: 0.012,
          },
          approval: {
            merchant: 15,
            soldier: 5,
          },
        },
      },
      {
        id: 'refuse_alliance',
        text: '拒绝联盟',
        description: '保持独立，不受他人约束。',
        effects: {
          stability: -5,
          approval: {
            soldier: 15,
            merchant: -15,
          },
        },
      },
    ],
  },

  // ==========================================
  // 古典时代 (Epoch 2) - Classical Age Events
  // ==========================================
  {
    id: 'philosophy_school',
    name: '哲学学派之争',
    icon: 'BookOpen',
    image: null,
    description: '城市中出现了两个相互对立的哲学学派。一派主张理性至上，一派强调传统美德。两派的辩论已经演变成街头冲突。',
    triggerConditions: {
      minEpoch: 2,
      maxEpoch: 4,
    },
    options: [
      {
        id: 'support_rationalists',
        text: '支持理性派',
        description: '理性和知识是进步的基础。',
        effects: {
          resourcePercent: {
            science: 0.05,
            culture: 0.02,
          },
          approval: {
            scribe: 25,
            cleric: -20,
            merchant: 10,
          },
        },
      },
      {
        id: 'support_traditionalists',
        text: '支持传统派',
        description: '祖先的美德才是社会的基石。',
        effects: {
          xl: {
            culture: 0.05,
          },
          stability: 10,
          approval: {
            cleric: 20,
            scribe: -15,
            landowner: 15,
          },
        },
      },
      {
        id: 'public_debate',
        text: '举办公开辩论',
        description: '让两派公平竞争，由民众评判。',
        effects: {
          xl: {
            culture: 0.03,
            science: 0.03,
          },
          approval: {
            scribe: 15,
            cleric: 5,
            peasant: 10,
          },
        },
      },
      {
        id: 'ban_both',
        text: '禁止两派',
        description: '哲学争论危害社会稳定。',
        effects: {
          stability: 15,
          approval: {
            scribe: -30,
            cleric: -10,
            soldier: 10,
          },
        },
      },
    ],
  },
  {
    id: 'olympic_games',
    name: '运动会提案',
    icon: 'Trophy',
    image: null,
    description: '贵族们提议举办一场盛大的运动会，各城邦派遣最优秀的运动员参赛。这将耗费大量资源，但能增强国家声望。',
    triggerConditions: {
      minEpoch: 2,
      maxEpoch: 4,
    },
    options: [
      {
        id: 'grand_games',
        text: '举办盛大运动会',
        description: '不惜代价展示国家实力。',
        effects: {
          xl: {
            silver: -0.04,
            culture: 0.08,
          },
          stability: 15,
          approval: {
            landowner: 20,
            soldier: 25,
            peasant: 15,
          },
        },
      },
      {
        id: 'modest_games',
        text: '举办适度规模',
        description: '量力而行，不过度铺张。',
        effects: {
          resourcePercent: {
            silver: -0.02,
            culture: 0.04,
          },
          stability: 5,
          approval: {
            soldier: 15,
            peasant: 10,
          },
        },
      },
      {
        id: 'decline_hosting',
        text: '拒绝主办',
        description: '资源应该用在更重要的事情上。',
        effects: {
          approval: {
            landowner: -15,
            soldier: -10,
            merchant: 10,
          },
        },
      },
    ],
  },
  {
    id: 'democratic_reform',
    name: '民主改革呼声',
    icon: 'Vote',
    image: null,
    description: '城市的自由民要求参与政治决策，他们聚集在广场上，要求建立公民大会制度。贵族们强烈反对这种"暴民政治"。',
    triggerConditions: {
      minEpoch: 2,
      maxEpoch: 4,
    },
    options: [
      {
        id: 'full_democracy',
        text: '建立公民大会',
        description: '让所有公民参与重大决策。',
        effects: {
          stability: -10,
          approval: {
            peasant: 30,
            artisan: 25,
            merchant: 20,
            landowner: -30,
            cleric: -15,
          },
        },
      },
      {
        id: 'limited_representation',
        text: '有限代表制',
        description: '设立代表机构，但保留贵族特权。',
        effects: {
          stability: 5,
          approval: {
            peasant: 10,
            artisan: 15,
            landowner: -10,
          },
        },
      },
      {
        id: 'reject_democracy',
        text: '维持现状',
        description: '政治是贵族的事务，平民无权置喙。',
        effects: {
          stability: -5,
          approval: {
            landowner: 20,
            peasant: -25,
            artisan: -20,
          },
        },
      },
    ],
  },
  {
    id: 'theatrical_competition',
    name: '戏剧竞赛',
    icon: 'Drama',
    image: null,
    description: '戏剧节即将来临，但今年的参赛作品引发了争议。一部讽刺当权者的喜剧和一部歌颂英雄的悲剧同时入围。',
    triggerConditions: {
      minEpoch: 2,
      maxEpoch: 4,
    },
    options: [
      {
        id: 'allow_satire',
        text: '允许讽刺剧',
        description: '艺术自由高于一切，即使是批评当权者。',
        effects: {
          resourcePercent: {
            culture: 0.04,
          },
          stability: -5,
          approval: {
            scribe: 25,
            peasant: 15,
            landowner: -15,
          },
        },
      },
      {
        id: 'only_heroic',
        text: '只允许英雄剧',
        description: '戏剧应该歌颂美德，而非嘲笑权威。',
        effects: {
          resourcePercent: {
            culture: 0.03,
          },
          stability: 10,
          approval: {
            landowner: 15,
            soldier: 10,
            scribe: -20,
          },
        },
      },
      {
        id: 'fair_competition',
        text: '公平竞争',
        description: '让观众的欢呼声决定胜负。',
        effects: {
          resourcePercent: {
            culture: 0.04,
          },
          approval: {
            scribe: 15,
            peasant: 10,
            merchant: 10,
          },
        },
      },
    ],
  },
  {
    id: 'gladiator_question',
    name: '角斗士制度',
    icon: 'Swords',
    image: null,
    description: '角斗表演越来越受欢迎，但一些人认为这种血腥娱乐有损国家形象。角斗士们自己也在要求改善待遇。',
    triggerConditions: {
      minEpoch: 2,
      maxEpoch: 4,
    },
    options: [
      {
        id: 'expand_games',
        text: '扩大角斗规模',
        description: '人民需要娱乐，这有助于稳定。',
        effects: {
          resourcePercent: {
            silver: -0.012,
          },
          stability: 15,
          approval: {
            peasant: 20,
            soldier: 15,
            cleric: -15,
          },
        },
      },
      {
        id: 'reform_games',
        text: '改革角斗制度',
        description: '减少致死场次，给予角斗士赎身机会。',
        effects: {
          resourcePercent: {
            silver: -0.028,
          },
          stability: 5,
          approval: {
            cleric: 10,
            peasant: 5,
          },
        },
      },
      {
        id: 'abolish_games',
        text: '废除角斗',
        description: '这种野蛮行为应该被禁止。',
        effects: {
          stability: -10,
          approval: {
            cleric: 25,
            peasant: -20,
            soldier: -15,
          },
        },
      },
    ],
  },

  // ==========================================
  // 封建时代 (Epoch 3) - Feudal Age Events
  // ==========================================
  {
    id: 'crusade_call',
    name: '十字军召唤',
    icon: 'Cross',
    image: null,
    description: '教会号召发动一场圣战，收复圣地。贵族们渴望荣耀和土地，但战争也意味着巨大的人员和财富损失。',
    triggerConditions: {
      minEpoch: 3,
      maxEpoch: 4,
    },
    options: [
      {
        id: 'lead_crusade',
        text: '领导十字军',
        description: '亲自带领大军出征，追求最高荣耀。',
        effects: {
          resourcePercent: {
            silver: -0.012,
            culture: 0.06,
          },
          populationPercent: -0.025,
          approval: {
            cleric: 30,
            soldier: 25,
            landowner: 15,
            peasant: -20,
          },
        },
        randomEffects: [
          {
            chance: 0.4,
            effects: {
              resourcePercent: { silver: 0.08, culture: 0.05 },
              approval: { soldier: 20 },
            },
            description: '十字军大获全胜，带回了大量财宝和圣物！',
          },
          {
            chance: 0.3,
            effects: {
              populationPercent: -0.012,
              stability: -15,
            },
            description: '远征遭遇惨败，大量士兵丧生异乡...',
          },
        ],
      },
      {
        id: 'send_army',
        text: '派遣军队',
        description: '派部分军队参与，但不亲自出征。',
        effects: {
          resourcePercent: {
            silver: -0.03,
            culture: 0.03,
          },
          populationPercent: -0.012,
          approval: {
            cleric: 15,
            soldier: 10,
          },
        },
      },
      {
        id: 'financial_support',
        text: '只提供资金',
        description: '捐赠金钱支持圣战，但不派兵。',
        effects: {
          resourcePercent: {
            silver: -0.025,
          },
          approval: {
            cleric: 10,
            soldier: -10,
            merchant: -5,
          },
        },
      },
      {
        id: 'refuse_crusade',
        text: '拒绝参与',
        description: '我们有自己的事务要处理。',
        effects: {
          approval: {
            cleric: -25,
            soldier: -15,
            merchant: 15,
            peasant: 10,
          },
        },
      },
    ],
  },
  {
    id: 'black_death',
    name: '黑死病',
    icon: 'Skull',
    image: null,
    description: '一种可怕的瘟疫开始在城市蔓延，人们惊恐地死去，街道上到处是尸体。医生束手无策，人们开始寻找替罪羊。',
    triggerConditions: {
      minEpoch: 3,
      maxEpoch: 5,
    },
    options: [
      {
        id: 'quarantine',
        text: '严格隔离',
        description: '封锁疫区，禁止人员流动。',
        effects: {
          populationPercent: -0.012,
          resourcePercent: {
            silver: -0.02,
          },
          stability: -10,
          approval: {
            merchant: -25,
            peasant: -10,
            cleric: 10,
          },
        },
      },
      {
        id: 'blame_outsiders',
        text: '驱逐外来者',
        description: '将瘟疫归咎于外来者，驱逐他们。',
        effects: {
          populationPercent: -0.02,
          stability: 5,
          approval: {
            peasant: 10,
            merchant: -20,
            cleric: -10,
          },
        },
      },
      {
        id: 'prayer_procession',
        text: '举行祈祷游行',
        description: '通过宗教仪式祈求神灵保佑。',
        effects: {
          populationPercent: -0.025,
          resourcePercent: {
            culture: 0.02,
          },
          approval: {
            cleric: 25,
            peasant: 5,
          },
        },
      },
      {
        id: 'medical_research',
        text: '研究治疗方法',
        description: '召集医生研究瘟疫，寻找治愈方法。',
        effects: {
          populationPercent: -0.015,
          resourcePercent: {
            silver: -0.03,
            science: 0.04,
          },
          approval: {
            scribe: 20,
            cleric: -15,
          },
        },
      },
    ],
  },
  {
    id: 'peasant_revolt_feudal',
    name: '农民起义',
    icon: 'Pitchfork',
    image: null,
    description: '不堪重负的农民们拿起草叉和镰刀，在一位神秘领袖的带领下起义了。他们要求减免税赋，废除农奴制度。',
    triggerConditions: {
      minEpoch: 3,
      maxEpoch: 5,
      classConditions: {
        peasant: { maxApproval: 30 },
      },
    },
    options: [
      {
        id: 'crush_revolt',
        text: '武力镇压',
        description: '派骑士镇压这些叛乱的农奴。',
        effects: {
          populationPercent: -0.02,
          stability: -15,
          approval: {
            landowner: 25,
            soldier: 15,
            peasant: -35,
          },
        },
      },
      {
        id: 'negotiate_terms',
        text: '谈判让步',
        description: '减免部分税赋，换取和平。',
        effects: {
          resourcePercent: {
            silver: -0.02,
          },
          stability: 10,
          approval: {
            peasant: 25,
            landowner: -20,
            artisan: 10,
          },
        },
      },
      {
        id: 'promise_reforms',
        text: '承诺改革',
        description: '答应改革，但暗中准备秋后算账。',
        effects: {
          stability: 5,
          approval: {
            peasant: 10,
          },
        },
        randomEffects: [
          {
            chance: 0.5,
            effects: {
              stability: -20,
              approval: { peasant: -30 },
            },
            description: '农民发现承诺是骗局，起义再度爆发且更加激烈！',
          },
        ],
      },
    ],
  },
  {
    id: 'cathedral_construction',
    name: '大教堂工程',
    icon: 'Church',
    image: null,
    description: '主教提议建造一座宏伟的大教堂，以彰显上帝的荣耀和国家的虔诚。这将是一项跨越数代人的工程。',
    triggerConditions: {
      minEpoch: 3,
      maxEpoch: 5,
    },
    options: [
      {
        id: 'grand_cathedral',
        text: '建造宏伟教堂',
        description: '不惜代价建造最壮观的教堂。',
        effects: {
          resourcePercent: {
            silver: -0.02,
            culture: 0.08,
          },
          approval: {
            cleric: 35,
            artisan: 20,
            peasant: -10,
            merchant: -15,
          },
        },
      },
      {
        id: 'modest_church',
        text: '建造朴素教堂',
        description: '建一座实用的教堂就足够了。',
        effects: {
          resourcePercent: {
            silver: -0.03,
            culture: 0.03,
          },
          approval: {
            cleric: 10,
            peasant: 5,
          },
        },
      },
      {
        id: 'secular_building',
        text: '建造世俗建筑',
        description: '资源应该用于市政建设，而非宗教。',
        effects: {
          resourcePercent: {
            silver: -0.04,
            science: 0.03,
          },
          approval: {
            cleric: -25,
            merchant: 20,
            artisan: 15,
          },
        },
      },
    ],
  },
  {
    id: 'guild_monopoly',
    name: '行会特权',
    icon: 'Shield',
    image: null,
    description: '城市的行会要求获得独家生产权，禁止非行会成员从事相关行业。商人们抱怨这会提高物价，年轻工匠则抱怨入会门槛太高。',
    triggerConditions: {
      minEpoch: 3,
      maxEpoch: 5,
    },
    options: [
      {
        id: 'grant_monopoly',
        text: '授予垄断权',
        description: '支持行会，保证产品质量。',
        effects: {
          resourcePercent: {
            culture: 0.02,
          },
          stability: 10,
          approval: {
            artisan: 25,
            merchant: -20,
            peasant: -10,
          },
        },
      },
      {
        id: 'break_monopoly',
        text: '打破垄断',
        description: '开放市场，允许自由竞争。',
        effects: {
          resourcePercent: {
            silver: 0.012,
          },
          approval: {
            artisan: -25,
            merchant: 25,
            peasant: 15,
          },
        },
      },
      {
        id: 'regulate_guilds',
        text: '规范行会',
        description: '保留行会，但限制其特权。',
        effects: {
          stability: 5,
          approval: {
            artisan: -5,
            merchant: 10,
            peasant: 5,
          },
        },
      },
    ],
  },

  // ==========================================
  // 探索时代 (Epoch 4) - Age of Exploration Events
  // ==========================================
  {
    id: 'new_world_discovery',
    name: '新大陆发现',
    icon: 'Compass',
    image: null,
    description: '探险家们报告发现了一片未知的大陆！那里有丰富的资源和原住民。问题是如何处理这片新领土和当地人。',
    triggerConditions: {
      minEpoch: 4,
      maxEpoch: 6,
    },
    options: [
      {
        id: 'colonize_aggressively',
        text: '武力殖民',
        description: '征服原住民，掠夺资源。',
        effects: {
          resourcePercent: {
            silver: 0.02,
            food: 0.015,
          },
          stability: -10,
          approval: {
            soldier: 20,
            merchant: 25,
            cleric: -20,
            peasant: -10,
          },
        },
      },
      {
        id: 'trade_relations',
        text: '建立贸易关系',
        description: '与原住民和平贸易，互通有无。',
        effects: {
          resourcePercent: {
            silver: 0.012,
            culture: 0.03,
          },
          approval: {
            merchant: 30,
            cleric: 10,
            soldier: -10,
          },
        },
      },
      {
        id: 'missionary_work',
        text: '传教为先',
        description: '先派传教士，以宗教感化原住民。',
        effects: {
          resourcePercent: {
            silver: 0.012,
            culture: 0.05,
          },
          approval: {
            cleric: 30,
            merchant: 5,
          },
        },
      },
      {
        id: 'limited_contact',
        text: '限制接触',
        description: '建立少数贸易站，避免深度介入。',
        effects: {
          resourcePercent: {
            silver: 0.02,
          },
          stability: 5,
          approval: {
            merchant: 10,
            cleric: 5,
          },
        },
      },
    ],
  },
  {
    id: 'printing_revolution',
    name: '印刷革命',
    icon: 'Book',
    image: null,
    description: '新发明的印刷术可以大量复制书籍，知识的传播将发生革命性变化。但教会担心异端思想会因此泛滥。',
    triggerConditions: {
      minEpoch: 4,
      maxEpoch: 6,
    },
    options: [
      {
        id: 'embrace_printing',
        text: '推广印刷术',
        description: '支持新技术，传播知识。',
        effects: {
          resourcePercent: {
            science: 0.06,
            culture: 0.04,
          },
          approval: {
            scribe: 30,
            merchant: 20,
            cleric: -25,
          },
        },
      },
      {
        id: 'church_control',
        text: '教会审查',
        description: '允许印刷，但由教会审查内容。',
        effects: {
          resourcePercent: {
            science: 0.03,
            culture: 0.02,
          },
          approval: {
            cleric: 15,
            scribe: -10,
          },
        },
      },
      {
        id: 'ban_printing',
        text: '禁止印刷',
        description: '这种技术会动摇社会秩序。',
        effects: {
          stability: 10,
          approval: {
            cleric: 20,
            scribe: -35,
            merchant: -20,
          },
        },
      },
    ],
  },
  {
    id: 'reformation_movement',
    name: '宗教改革',
    icon: 'ScrollText',
    image: null,
    description: '一位神学家公开质疑教会的权威，他的观点正在迅速传播。支持者和反对者之间的冲突越来越激烈。',
    triggerConditions: {
      minEpoch: 4,
      maxEpoch: 6,
    },
    options: [
      {
        id: 'support_reformers',
        text: '支持改革',
        description: '教会确实需要改革和净化。',
        effects: {
          resourcePercent: {
            culture: 0.05,
          },
          stability: -20,
          approval: {
            cleric: -30,
            scribe: 25,
            merchant: 20,
            peasant: 15,
          },
        },
      },
      {
        id: 'support_church',
        text: '支持教会',
        description: '维护传统权威，镇压异端。',
        effects: {
          resourcePercent: {
            culture: 0.02,
          },
          stability: 10,
          approval: {
            cleric: 30,
            scribe: -20,
            peasant: -10,
          },
        },
      },
      {
        id: 'allow_both',
        text: '允许两派共存',
        description: '宣布宗教宽容，两派都可信仰。',
        effects: {
          stability: -10,
          approval: {
            cleric: -15,
            scribe: 15,
            merchant: 25,
            peasant: 10,
          },
        },
      },
    ],
  },
  {
    id: 'spice_trade_war',
    name: '香料战争',
    icon: 'Anchor',
    image: null,
    description: '控制东方香料贸易的商路成为列强争夺的焦点。我们的商人要求政府支持他们打破竞争对手的垄断。',
    triggerConditions: {
      minEpoch: 4,
      maxEpoch: 6,
    },
    options: [
      {
        id: 'naval_war',
        text: '发动海战',
        description: '用武力打开贸易通道。',
        effects: {
          resourcePercent: {
            silver: -0.04,
          },
          populationPercent: -0.012,
          approval: {
            merchant: 25,
            soldier: 20,
            peasant: -15,
          },
        },
        randomEffects: [
          {
            chance: 0.5,
            effects: {
              resourcePercent: { silver: 0.08 },
            },
            description: '海战胜利！我们获得了香料贸易的优势地位。',
          },
        ],
      },
      {
        id: 'trade_company',
        text: '成立贸易公司',
        description: '组建国家支持的贸易公司。',
        effects: {
          resourcePercent: {
            silver: -0.03,
          },
          approval: {
            merchant: 30,
            landowner: -10,
          },
        },
      },
      {
        id: 'find_alternative',
        text: '寻找替代路线',
        description: '资助探险家寻找新的贸易路线。',
        effects: {
          resourcePercent: {
            silver: -0.025,
            science: 0.03,
          },
          approval: {
            merchant: 15,
            scribe: 15,
          },
        },
      },
    ],
  },
  {
    id: 'witch_trials',
    name: '女巫审判',
    icon: 'Flame',
    image: null,
    description: '人们声称发现了女巫，恐惧在城镇中蔓延。宗教法庭要求进行审判，但一些人质疑这些指控的真实性。',
    triggerConditions: {
      minEpoch: 4,
      maxEpoch: 5,
    },
    options: [
      {
        id: 'full_trials',
        text: '支持审判',
        description: '清除女巫是保护社会的必要之举。',
        effects: {
          populationPercent: -0.01,
          stability: 5,
          approval: {
            cleric: 25,
            peasant: 10,
            scribe: -25,
          },
        },
      },
      {
        id: 'proper_investigation',
        text: '要求证据',
        description: '审判必须有确凿证据，不能仅凭指控。',
        effects: {
          resourcePercent: {
            science: 0.02,
          },
          approval: {
            scribe: 20,
            cleric: -10,
            peasant: -5,
          },
        },
      },
      {
        id: 'stop_trials',
        text: '停止审判',
        description: '这是迷信和迫害，必须停止。',
        effects: {
          stability: -10,
          approval: {
            cleric: -30,
            scribe: 30,
            peasant: -15,
          },
        },
      },
    ],
  },

  // ==========================================
  // 启蒙时代 (Epoch 5) - Age of Enlightenment Events
  // ==========================================
  {
    id: 'encyclopedie',
    name: '百科全书计划',
    icon: 'Library',
    image: null,
    description: '一群学者提议编纂一部包含所有人类知识的百科全书。这将是启蒙运动的里程碑，但也会传播"危险"的思想。',
    triggerConditions: {
      minEpoch: 5,
      maxEpoch: 6,
    },
    options: [
      {
        id: 'fund_encyclopedia',
        text: '资助编纂',
        description: '支持这项伟大的知识工程。',
        effects: {
          resourcePercent: {
            silver: -0.05,
            science: 0.08,
            culture: 0.06,
          },
          approval: {
            scribe: 35,
            merchant: 15,
            cleric: -25,
            landowner: -15,
          },
        },
      },
      {
        id: 'censored_version',
        text: '资助但审查',
        description: '支持编纂，但删除敏感内容。',
        effects: {
          resourcePercent: {
            silver: -0.04,
            science: 0.05,
            culture: 0.03,
          },
          approval: {
            scribe: 5,
            cleric: 5,
          },
        },
      },
      {
        id: 'ban_encyclopedia',
        text: '禁止编纂',
        description: '这种知识传播会动摇社会秩序。',
        effects: {
          stability: 5,
          approval: {
            cleric: 20,
            landowner: 15,
            scribe: -35,
            merchant: -15,
          },
        },
      },
    ],
  },
  {
    id: 'salon_culture',
    name: '沙龙文化',
    icon: 'Users',
    image: null,
    description: '贵族府邸中的沙龙成为思想交流的中心，哲学家、作家和科学家在这里自由讨论。但这些讨论有时涉及敏感的政治话题。',
    triggerConditions: {
      minEpoch: 5,
      maxEpoch: 6,
    },
    options: [
      {
        id: 'encourage_salons',
        text: '鼓励沙龙',
        description: '自由的思想交流有益于文化发展。',
        effects: {
          resourcePercent: {
            culture: 0.05,
            science: 0.03,
          },
          stability: -5,
          approval: {
            scribe: 25,
            landowner: 15,
            cleric: -15,
          },
        },
      },
      {
        id: 'monitor_salons',
        text: '监控沙龙',
        description: '允许沙龙存在，但安插眼线。',
        effects: {
          resourcePercent: {
            culture: 0.03,
            science: 0.02,
          },
          approval: {
            scribe: -10,
            landowner: 5,
          },
        },
      },
      {
        id: 'ban_salons',
        text: '禁止私人聚会',
        description: '这些聚会是阴谋的温床。',
        effects: {
          stability: 10,
          approval: {
            scribe: -30,
            landowner: -20,
            cleric: 10,
          },
        },
      },
    ],
  },
  {
    id: 'social_contract',
    name: '社会契约论',
    icon: 'FileText',
    image: null,
    description: '一本名为《社会契约论》的书正在知识分子中广泛传播。它宣称政府的权力来自人民的同意，而非神授。',
    triggerConditions: {
      minEpoch: 5,
      maxEpoch: 6,
    },
    options: [
      {
        id: 'embrace_ideas',
        text: '接受这些理念',
        description: '政府确实应该服务于人民。',
        effects: {
          resourcePercent: {
            culture: 0.04,
          },
          stability: -15,
          approval: {
            scribe: 30,
            peasant: 25,
            artisan: 20,
            landowner: -25,
            cleric: -20,
          },
        },
      },
      {
        id: 'academic_only',
        text: '限于学术讨论',
        description: '允许学术研究，但禁止政治宣传。',
        effects: {
          resourcePercent: {
            science: 0.03,
          },
          approval: {
            scribe: 10,
            landowner: -5,
          },
        },
      },
      {
        id: 'burn_books',
        text: '焚毁此书',
        description: '这是颠覆性的危险思想。',
        effects: {
          stability: 10,
          approval: {
            cleric: 20,
            landowner: 15,
            scribe: -40,
            peasant: -15,
          },
        },
      },
    ],
  },
  {
    id: 'scientific_academy',
    name: '皇家科学院',
    icon: 'Microscope',
    image: null,
    description: '科学家们请求建立一个由国家资助的科学院，系统地研究自然世界。这将需要大量资金，但可能带来技术进步。',
    triggerConditions: {
      minEpoch: 5,
      maxEpoch: 6,
    },
    options: [
      {
        id: 'grand_academy',
        text: '建立宏大的科学院',
        description: '大力投资科学研究。',
        effects: {
          resourcePercent: {
            silver: -0.05,
            science: 0.08,
          },
          approval: {
            scribe: 35,
            merchant: 15,
            landowner: -10,
          },
        },
      },
      {
        id: 'modest_academy',
        text: '建立小型研究所',
        description: '适度投资，逐步发展。',
        effects: {
          resourcePercent: {
            silver: -0.03,
            science: 0.05,
          },
          approval: {
            scribe: 20,
          },
        },
      },
      {
        id: 'private_funding',
        text: '鼓励私人资助',
        description: '让富人和商人赞助科学研究。',
        effects: {
          resourcePercent: {
            science: 0.03,
          },
          approval: {
            merchant: 15,
            scribe: 10,
          },
        },
      },
    ],
  },
  {
    id: 'vaccination_debate',
    name: '疫苗争议',
    icon: 'Syringe',
    image: null,
    description: '医生发明了一种预防天花的方法——接种牛痘。这种方法有效但争议巨大，许多人认为这是"不自然的"，甚至是亵渎神灵。',
    triggerConditions: {
      minEpoch: 5,
      maxEpoch: 6,
    },
    options: [
      {
        id: 'mandatory_vaccination',
        text: '强制接种',
        description: '为了公共健康，所有人都应该接种。',
        effects: {
          population: 30,
          resourcePercent: {
            silver: -0.025,
            science: 0.04,
          },
          approval: {
            scribe: 25,
            cleric: -25,
            peasant: -15,
          },
        },
      },
      {
        id: 'voluntary_vaccination',
        text: '自愿接种',
        description: '提供接种服务，但不强制。',
        effects: {
          populationPercent: 0.04,
          resourcePercent: {
            silver: -0.012,
            science: 0.03,
          },
          approval: {
            scribe: 15,
            peasant: 5,
          },
        },
      },
      {
        id: 'ban_vaccination',
        text: '禁止接种',
        description: '这种做法违反自然法则。',
        effects: {
          approval: {
            cleric: 20,
            peasant: 10,
            scribe: -30,
          },
        },
      },
    ],
  },

  // ==========================================
  // 工业时代 (Epoch 6) - Industrial Age Events
  // ==========================================
  {
    id: 'factory_conditions',
    name: '工厂劳动条件',
    icon: 'Factory',
    image: null,
    description: '工厂工人的恶劣劳动条件引发了公众关注。童工、超长工时和危险环境成为改革者攻击的目标。工厂主则警告说规制会损害竞争力。',
    triggerConditions: {
      minEpoch: 6,
    },
    options: [
      {
        id: 'strict_regulation',
        text: '严格立法',
        description: '禁止童工，限制工时，强制安全标准。',
        effects: {
          resourcePercent: {
            silver: -0.02,
          },
          stability: 10,
          approval: {
            worker: 35,
            artisan: 20,
            merchant: -25,
            landowner: -15,
          },
        },
      },
      {
        id: 'mild_reform',
        text: '温和改革',
        description: '部分改善条件，但不影响生产。',
        effects: {
          resourcePercent: {
            silver: -0.012,
          },
          approval: {
            worker: 15,
            merchant: -5,
          },
        },
      },
      {
        id: 'free_market',
        text: '市场自由',
        description: '政府不应干预私营企业。',
        effects: {
          resourcePercent: {
            silver: 0.012,
          },
          stability: -10,
          approval: {
            merchant: 25,
            worker: -30,
            artisan: -20,
          },
        },
      },
    ],
  },
  {
    id: 'railway_mania',
    name: '铁路狂热',
    icon: 'Train',
    image: null,
    description: '铁路投资热潮席卷全国，人们疯狂购买铁路公司的股票。这可能是改变时代的机遇，也可能是即将破裂的泡沫。',
    triggerConditions: {
      minEpoch: 6,
    },
    options: [
      {
        id: 'state_railway',
        text: '国有铁路',
        description: '由国家建设和运营铁路网。',
        effects: {
          resourcePercent: {
            silver: -0.015,
            science: 0.04,
          },
          populationCapacity: 50,
          approval: {
            worker: 20,
            merchant: -15,
            landowner: -10,
          },
        },
      },
      {
        id: 'regulate_private',
        text: '规范私营',
        description: '允许私人投资，但政府监管。',
        effects: {
          resourcePercent: {
            silver: -0.03,
            science: 0.03,
          },
          populationCapacity: 30,
          approval: {
            merchant: 15,
            worker: 10,
          },
        },
      },
      {
        id: 'laissez_faire',
        text: '放任自流',
        description: '让市场决定铁路的发展。',
        effects: {
          resourcePercent: {
            science: 0.02,
          },
          approval: {
            merchant: 25,
          },
        },
        randomEffects: [
          {
            chance: 0.4,
            effects: {
              resourcePercent: { silver: -0.05 },
              stability: -15,
            },
            description: '铁路泡沫破裂！许多投资者血本无归，经济陷入衰退。',
          },
        ],
      },
    ],
  },
  {
    id: 'labor_union_formation',
    name: '工会运动',
    icon: 'Users',
    image: null,
    description: '工人们开始组织工会，要求集体谈判的权利。工厂主将其视为对财产权的威胁，而工人们则认为这是唯一能保护他们权益的方式。',
    triggerConditions: {
      minEpoch: 6,
    },
    options: [
      {
        id: 'legalize_unions',
        text: '合法化工会',
        description: '承认工人组织和集体谈判的权利。',
        effects: {
          stability: 5,
          approval: {
            worker: 40,
            artisan: 25,
            merchant: -30,
            landowner: -20,
          },
        },
      },
      {
        id: 'limited_rights',
        text: '有限承认',
        description: '允许工会存在，但限制其活动。',
        effects: {
          approval: {
            worker: 15,
            merchant: -10,
          },
        },
      },
      {
        id: 'ban_unions',
        text: '禁止工会',
        description: '工人结社是对社会秩序的威胁。',
        effects: {
          stability: -15,
          approval: {
            merchant: 20,
            landowner: 15,
            worker: -40,
            artisan: -25,
          },
        },
      },
    ],
  },
  {
    id: 'urban_poverty',
    name: '城市贫民窟',
    icon: 'Home',
    image: null,
    description: '工业化吸引了大量农村人口涌入城市，但住房严重短缺。贫民窟在城市边缘蔓延，疾病和犯罪率上升。',
    triggerConditions: {
      minEpoch: 6,
    },
    options: [
      {
        id: 'public_housing',
        text: '建设公共住房',
        description: '由政府出资建设廉价住房。',
        effects: {
          resourcePercent: {
            silver: -0.05,
          },
          populationCapacity: 40,
          stability: 10,
          approval: {
            worker: 30,
            peasant: 20,
            merchant: -15,
            landowner: -10,
          },
        },
      },
      {
        id: 'incentivize_private',
        text: '鼓励私人建设',
        description: '给予开发商税收优惠。',
        effects: {
          resourcePercent: {
            silver: -0.02,
          },
          populationCapacity: 20,
          approval: {
            merchant: 15,
            worker: 5,
          },
        },
      },
      {
        id: 'demolish_slums',
        text: '拆除贫民窟',
        description: '强制拆除贫民窟，驱散居民。',
        effects: {
          populationPercent: -0.012,
          stability: -10,
          approval: {
            landowner: 15,
            worker: -30,
            peasant: -25,
          },
        },
      },
    ],
  },
  {
    id: 'communist_manifesto',
    name: '共产主义宣言',
    icon: 'BookOpen',
    image: null,
    description: '一本名为《共产主义宣言》的小册子在工人中广泛传播，它呼吁工人阶级联合起来推翻资本主义制度。当局对此深感忧虑。',
    triggerConditions: {
      minEpoch: 6,
    },
    options: [
      {
        id: 'suppress_movement',
        text: '镇压运动',
        description: '逮捕传播者，查禁书籍。',
        effects: {
          stability: 5,
          approval: {
            landowner: 20,
            merchant: 15,
            worker: -35,
            artisan: -20,
          },
        },
      },
      {
        id: 'reform_to_defuse',
        text: '改革化解',
        description: '通过社会改革来减少激进思想的吸引力。',
        effects: {
          resourcePercent: {
            silver: -0.03,
          },
          stability: 10,
          approval: {
            worker: 20,
            artisan: 15,
            merchant: -15,
          },
        },
      },
      {
        id: 'allow_debate',
        text: '允许辩论',
        description: '思想自由是社会进步的基础。',
        effects: {
          resourcePercent: {
            culture: 0.03,
          },
          stability: -15,
          approval: {
            worker: 25,
            scribe: 20,
            landowner: -25,
            merchant: -20,
          },
        },
      },
    ],
  },

  // ==================== 中国历史典故事件 ====================

  // 周礼 - 青铜时代/古典时代
  {
    id: 'ritual_reform',
    name: '礼制改革',
    icon: 'Scroll',
    description: '一位博学的官员上书朝廷，建议制定完整的礼仪制度来规范社会秩序。"礼者，天地之序也。"他认为通过明确的等级礼仪，可以让社会和谐稳定。',
    triggerConditions: {
      minEpoch: 1,
      maxEpoch: 3,
      minPopulation: 100,
    },
    options: [
      {
        id: 'establish_ritual',
        text: '制定周详的礼仪制度',
        description: '让每个阶层都知道自己的位置和本分。',
        effects: {
          resourcePercent: {
            culture: 0.05,
            silver: -0.012,
          },
          stability: 20,
          approval: {
            landowner: 25,
            official: 30,
            cleric: 20,
            peasant: -15,
            worker: -10,
          },
        },
      },
      {
        id: 'simplify_ritual',
        text: '简化礼仪，注重实用',
        description: '礼仪应当简明，不必繁文缛节。',
        effects: {
          resourcePercent: {
            culture: 0.02,
          },
          stability: 5,
          approval: {
            merchant: 15,
            artisan: 10,
            peasant: 10,
            official: -10,
          },
        },
      },
      {
        id: 'reject_ritual',
        text: '拒绝等级礼制',
        description: '人人平等，何须分高下贵贱？',
        effects: {
          stability: -15,
          approval: {
            peasant: 20,
            worker: 20,
            landowner: -30,
            official: -25,
          },
        },
      },
    ],
  },

  // 孔子 - 古典时代
  {
    id: 'wandering_sage',
    name: '周游列国的圣人',
    icon: 'User',
    description: '一位白发苍苍的老者带着一群弟子来到国境。据说他曾是某国的大司寇，因政见不合而离开。他宣扬"仁义礼智信"，希望能找到愿意采纳其学说的君主。',
    triggerConditions: {
      minEpoch: 2,
      maxEpoch: 4,
      minPopulation: 150,
    },
    options: [
      {
        id: 'hire_sage',
        text: '聘请他为国师',
        description: '以仁政治国，德行天下。',
        effects: {
          resourcePercent: {
            culture: 0.08,
            silver: -0.012,
          },
          stability: 15,
          approval: {
            scribe: 35,
            official: 25,
            cleric: 20,
            peasant: 10,
            merchant: -10,
          },
        },
      },
      {
        id: 'allow_teaching',
        text: '允许他在国内讲学',
        description: '有教无类，让百姓也能受教育。',
        effects: {
          resourcePercent: {
            culture: 0.04,
          },
          stability: 5,
          approval: {
            scribe: 25,
            peasant: 15,
            worker: 10,
            official: -5,
          },
        },
      },
      {
        id: 'expel_sage',
        text: '驱逐这些迂腐之人',
        description: '空谈仁义能当饭吃吗？',
        effects: {
          resourcePercent: {
            culture: -0.02,
          },
          stability: 5,
          approval: {
            soldier: 10,
            merchant: 10,
            scribe: -30,
            cleric: -20,
          },
        },
      },
    ],
  },

  // 秦长城 - 古典时代/封建时代
  {
    id: 'great_wall_project',
    name: '万里长城工程',
    icon: 'Building',
    description: '为抵御北方游牧民族的侵扰，将军们提议修建一条横跨边境的巨大城墙，将各段旧城墙连接起来。这将是史无前例的工程，需要征调大量民夫。',
    triggerConditions: {
      minEpoch: 2,
      maxEpoch: 4,
      minPopulation: 250,
    },
    options: [
      {
        id: 'build_wall',
        text: '不惜代价修建长城',
        description: '千秋万代的功业！',
        effects: {
          resourcePercent: {
            stone: -0.03,
            silver: -0.02,
          },
          populationPercent: -0.012,
          stability: -20,
          approval: {
            soldier: 30,
            landowner: 20,
            peasant: -40,
            worker: -35,
            serf: -40,
          },
        },
        randomEffects: [
          {
            chance: 0.4,
            effects: {
              stability: 30,
              approval: {
                soldier: 20,
              },
            },
            description: '长城建成，边境安宁！',
          },
          {
            chance: 0.3,
            effects: {
              stability: -30,
              populationPercent: -0.012,
              approval: {
                peasant: -30,
              },
            },
            description: '民夫大量逃亡，工地怨声载道。',
          },
        ],
      },
      {
        id: 'limited_fortification',
        text: '只修建关键隘口',
        description: '在战略要地建立坚固堡垒。',
        effects: {
          resourcePercent: {
            stone: -0.06,
            silver: -0.028,
          },
          populationPercent: -0.03,
          stability: 5,
          approval: {
            soldier: 15,
            peasant: -10,
          },
        },
      },
      {
        id: 'reject_wall',
        text: '放弃修建计划',
        description: '与其修墙，不如安抚边民。',
        effects: {
          approval: {
            peasant: 20,
            worker: 15,
            soldier: -20,
            landowner: -15,
          },
        },
        randomEffects: [
          {
            chance: 0.3,
            effects: {
              resourcePercent: {
                silver: -0.012,
                food: -0.03,
              },
              stability: -20,
            },
            description: '游牧骑兵南下劫掠！',
          },
        ],
      },
    ],
  },

  // 七国之乱 - 古典时代/封建时代
  {
    id: 'vassal_rebellion',
    name: '诸侯叛乱',
    icon: 'Swords',
    description: '朝廷推行削减诸侯封地的政策引发强烈反弹。数位封疆大吏联合起来，以"清君侧"为名举兵反叛。叛军声势浩大，直逼京师。',
    triggerConditions: {
      minEpoch: 2,
      maxEpoch: 4,
      minPopulation: 200,
      classConditions: {
        landowner: { maxApproval: 40 },
      },
    },
    options: [
      {
        id: 'crush_rebellion',
        text: '派大军平叛',
        description: '顺我者昌，逆我者亡！',
        effects: {
          resourcePercent: {
            silver: -0.025,
          },
          stability: -25,
          approval: {
            soldier: 20,
            official: 15,
            landowner: -30,
          },
        },
        randomEffects: [
          {
            chance: 0.6,
            effects: {
              stability: 35,
              resourcePercent: {
                silver: 0.012,
              },
              approval: {
                landowner: -20,
                official: 20,
              },
            },
            description: '叛乱被成功镇压，诸侯势力大减。',
          },
          {
            chance: 0.4,
            effects: {
              stability: -40,
              populationPercent: -0.015,
              approval: {
                soldier: -20,
                peasant: -30,
              },
            },
            description: '平叛战争陷入僵持，国力大损。',
          },
        ],
      },
      {
        id: 'negotiate_peace',
        text: '与叛军谈判',
        description: '暂时妥协，以图后计。',
        effects: {
          stability: 10,
          approval: {
            landowner: 25,
            official: -20,
            soldier: -15,
          },
        },
      },
      {
        id: 'abandon_reform',
        text: '撤回削藩政策',
        description: '承认错误，恢复旧制。',
        effects: {
          stability: 15,
          approval: {
            landowner: 40,
            official: -30,
            peasant: -10,
          },
        },
      },
    ],
  },

  // 安史之乱 - 封建时代
  {
    id: 'frontier_general_rebellion',
    name: '边将叛乱',
    icon: 'Horse',
    description: '一位手握重兵的边境将军突然起兵造反。这位将军本是皇帝的宠臣，掌管多个边镇，麾下精兵强将无数。叛军势如破竹，京城危在旦夕！',
    triggerConditions: {
      minEpoch: 3,
      maxEpoch: 5,
      minPopulation: 350,
      classConditions: {
        soldier: { maxApproval: 50 },
      },
    },
    options: [
      {
        id: 'flee_capital',
        text: '皇室出奔避难',
        description: '留得青山在，不愁没柴烧。',
        effects: {
          resourcePercent: {
            silver: -0.03,
          },
          stability: -40,
          populationPercent: -0.012,
          approval: {
            official: -30,
            soldier: -20,
            peasant: -25,
            merchant: -30,
          },
        },
        randomEffects: [
          {
            chance: 0.5,
            effects: {
              stability: 30,
              approval: {
                soldier: 30,
              },
            },
            description: '忠臣良将组织起勤王之师！',
          },
        ],
      },
      {
        id: 'defend_capital',
        text: '坚守京城死战',
        description: '天子守国门，君王死社稷！',
        effects: {
          resourcePercent: {
            silver: -0.02,
          },
          stability: -20,
          approval: {
            soldier: 25,
            official: 20,
            peasant: 10,
          },
        },
        randomEffects: [
          {
            chance: 0.4,
            effects: {
              stability: 40,
              approval: {
                soldier: 30,
                official: 25,
              },
            },
            description: '京城保卫战取得胜利！',
          },
          {
            chance: 0.4,
            effects: {
              stability: -50,
              populationPercent: -0.012,
              approval: {
                soldier: -30,
                peasant: -40,
              },
            },
            description: '京城陷落，生灵涂炭。',
          },
        ],
      },
      {
        id: 'seek_foreign_aid',
        text: '借外族兵马平叛',
        description: '以夷制夷，借刀杀人。',
        effects: {
          resourcePercent: {
            silver: -0.025,
          },
          stability: -10,
          approval: {
            soldier: -15,
            peasant: -20,
            official: 10,
          },
        },
        randomEffects: [
          {
            chance: 0.6,
            effects: {
              stability: 25,
            },
            description: '叛乱被平定，但外族势力坐大。',
          },
          {
            chance: 0.3,
            effects: {
              resourcePercent: {
                silver: -0.02,
                food: -0.05,
              },
              stability: -20,
            },
            description: '外族趁火打劫，边境糜烂。',
          },
        ],
      },
    ],
  },

  // 杯酒释兵权 - 封建时代
  {
    id: 'disarm_generals',
    name: '杯酒释兵权',
    icon: 'Wine',
    description: '新建立的王朝担忧武将拥兵自重，重蹈前朝覆辙。皇帝设宴款待功臣宿将，在酒酣耳热之际暗示他们交出兵权，以享富贵。',
    triggerConditions: {
      minEpoch: 3,
      maxEpoch: 5,
      minPopulation: 250,
    },
    options: [
      {
        id: 'release_generals',
        text: '以利诱之，解除兵权',
        description: '给予丰厚赏赐，换取军权集中。',
        effects: {
          resourcePercent: {
            silver: -0.03,
          },
          stability: 30,
          approval: {
            soldier: -25,
            knight: -30,
            official: 30,
            landowner: 20,
            merchant: 15,
          },
        },
      },
      {
        id: 'partial_release',
        text: '只收部分将领兵权',
        description: '留用可信之人，遣散可疑者。',
        effects: {
          resourcePercent: {
            silver: -0.012,
          },
          stability: 15,
          approval: {
            soldier: -10,
            knight: -15,
            official: 15,
          },
        },
      },
      {
        id: 'keep_military',
        text: '维持现状',
        description: '功臣不可负，否则寒天下之心。',
        effects: {
          approval: {
            soldier: 20,
            knight: 25,
            official: -10,
          },
        },
        randomEffects: [
          {
            chance: 0.25,
            effects: {
              stability: -35,
              approval: {
                soldier: -20,
              },
            },
            description: '某位将军拥兵自立，藩镇割据再现。',
          },
        ],
      },
    ],
  },

  // 王安石变法 - 封建时代/探索时代
  {
    id: 'radical_reform',
    name: '激进的变法',
    icon: 'FileText',
    description: '一位锐意进取的大臣提出全面改革方案："天变不足畏，祖宗不足法，人言不足恤！"他主张推行青苗法、免役法、保甲法等新政，引发朝野激烈争论。',
    triggerConditions: {
      minEpoch: 3,
      maxEpoch: 5,
      minPopulation: 300,
    },
    options: [
      {
        id: 'full_reform',
        text: '全面推行变法',
        description: '富国强兵，舍此无他！',
        effects: {
          resourcePercent: {
            silver: 0.012,
            culture: -0.03,
          },
          stability: -25,
          approval: {
            official: -30,
            landowner: -35,
            merchant: 20,
            peasant: 15,
            soldier: 20,
          },
        },
        randomEffects: [
          {
            chance: 0.4,
            effects: {
              resourcePercent: {
                silver: 0.03,
              },
              stability: 20,
            },
            description: '变法初见成效，国库充盈！',
          },
          {
            chance: 0.35,
            effects: {
              stability: -30,
              approval: {
                peasant: -30,
                official: -20,
              },
            },
            description: '变法执行走样，民怨沸腾。',
          },
        ],
      },
      {
        id: 'gradual_reform',
        text: '试点推行，徐徐图之',
        description: '先在部分地区试行，总结经验。',
        effects: {
          resourcePercent: {
            silver: 0.012,
          },
          stability: -5,
          approval: {
            official: -10,
            landowner: -15,
            merchant: 10,
            peasant: 5,
          },
        },
      },
      {
        id: 'reject_reform',
        text: '驳回变法建议',
        description: '祖宗之法不可变！',
        effects: {
          stability: 10,
          approval: {
            official: 20,
            landowner: 25,
            merchant: -15,
            peasant: -10,
          },
        },
      },
    ],
  },

  // 明英宗亲征 - 封建时代/探索时代
  {
    id: 'emperor_personal_campaign',
    name: '皇帝亲征',
    icon: 'Crown',
    description: '北方游牧民族再次入侵，年轻的皇帝不顾群臣劝阻，执意要御驾亲征。宦官们也在一旁怂恿，说这是建立不世功业的大好机会。',
    triggerConditions: {
      minEpoch: 3,
      maxEpoch: 5,
      minPopulation: 350,
    },
    options: [
      {
        id: 'personal_campaign',
        text: '御驾亲征',
        description: '天子亲征，三军用命！',
        effects: {
          resourcePercent: {
            silver: -0.03,
          },
          stability: -15,
          approval: {
            soldier: 30,
            official: -25,
          },
        },
        randomEffects: [
          {
            chance: 0.25,
            effects: {
              stability: 40,
              resourcePercent: {
                culture: 0.05,
              },
              approval: {
                soldier: 30,
                official: 20,
              },
            },
            description: '亲征大捷，威震四方！',
          },
          {
            chance: 0.5,
            effects: {
              stability: -60,
              populationPercent: -0.025,
              resourcePercent: {
                silver: -0.04,
              },
              approval: {
                soldier: -40,
                official: -30,
                peasant: -30,
              },
            },
            description: '兵败被俘！国家陷入危机！',
          },
        ],
      },
      {
        id: 'send_general',
        text: '派遣大将出征',
        description: '运筹帷幄，不必亲冒矢石。',
        effects: {
          resourcePercent: {
            silver: -0.02,
          },
          stability: 5,
          approval: {
            soldier: 15,
            official: 15,
          },
        },
        randomEffects: [
          {
            chance: 0.5,
            effects: {
              stability: 20,
              approval: {
                soldier: 15,
              },
            },
            description: '将军凯旋而归！',
          },
        ],
      },
      {
        id: 'negotiate_tribute',
        text: '和议纳贡',
        description: '以财货换和平，免生灵涂炭。',
        effects: {
          resourcePercent: {
            silver: -0.025,
          },
          stability: 10,
          approval: {
            soldier: -25,
            merchant: 15,
            peasant: 10,
            official: -10,
          },
        },
      },
    ],
  },

  // 张居正改革 - 探索时代
  {
    id: 'grand_secretary_reform',
    name: '首辅改革',
    icon: 'Scale',
    description: '一位铁腕首辅大臣主持朝政，推行"一条鞭法"简化税制，清丈全国土地，严厉打击贪腐。他的改革触动了既得利益者的蛋糕。',
    triggerConditions: {
      minEpoch: 4,
      maxEpoch: 6,
      minPopulation: 350,
    },
    options: [
      {
        id: 'support_reform',
        text: '全力支持改革',
        description: '除弊兴利，中兴有望！',
        effects: {
          resourcePercent: {
            silver: 0.03,
          },
          stability: -15,
          approval: {
            official: -30,
            landowner: -35,
            peasant: 25,
            merchant: 20,
            worker: 15,
          },
        },
        randomEffects: [
          {
            chance: 0.5,
            effects: {
              resourcePercent: {
                silver: 0.012,
              },
              stability: 25,
            },
            description: '改革成功，国库充盈，吏治清明！',
          },
          {
            chance: 0.3,
            effects: {
              stability: -25,
              approval: {
                official: -20,
              },
            },
            description: '改革派遭到政敌清算，人亡政息。',
          },
        ],
      },
      {
        id: 'moderate_reform',
        text: '支持温和改革',
        description: '循序渐进，不可操之过急。',
        effects: {
          resourcePercent: {
            silver: 0.012,
          },
          stability: 5,
          approval: {
            official: -10,
            landowner: -15,
            peasant: 10,
          },
        },
      },
      {
        id: 'block_reform',
        text: '否决改革方案',
        description: '维护既有体制，稳定压倒一切。',
        effects: {
          stability: 10,
          approval: {
            official: 25,
            landowner: 30,
            peasant: -20,
            merchant: -15,
          },
        },
      },
    ],
  },

  // 雍正官绅一体纳粮 - 探索时代/启蒙时代
  {
    id: 'universal_taxation',
    name: '官绅一体纳粮',
    icon: 'Coins',
    description: '长期以来，官员和有功名的士绅享有免税特权，导致税负集中在普通百姓身上。是否要打破这一惯例，要求所有人一体纳税。',
    triggerConditions: {
      minEpoch: 4,
      maxEpoch: 6,
      minPopulation: 350,
    },
    options: [
      {
        id: 'enforce_universal_tax',
        text: '强制推行一体纳粮',
        description: '官民一体，公平税负！',
        effects: {
          resourcePercent: {
            silver: 0.012,
          },
          stability: -20,
          approval: {
            official: -40,
            landowner: -35,
            scribe: -30,
            peasant: 30,
            worker: 25,
            merchant: 10,
          },
        },
        randomEffects: [
          {
            chance: 0.4,
            effects: {
              resourcePercent: {
                silver: 0.012,
              },
              stability: 20,
            },
            description: '改革成功，税收大增，民心归附！',
          },
          {
            chance: 0.3,
            effects: {
              stability: -30,
              approval: {
                official: -20,
                scribe: -15,
              },
            },
            description: '官僚消极抵制，政令难以执行。',
          },
        ],
      },
      {
        id: 'partial_reform',
        text: '部分取消特权',
        description: '只对大地主征税，保留小士绅优免。',
        effects: {
          resourcePercent: {
            silver: 0.02,
          },
          stability: -5,
          approval: {
            landowner: -20,
            official: -15,
            scribe: -10,
            peasant: 15,
          },
        },
      },
      {
        id: 'maintain_privilege',
        text: '维持特权制度',
        description: '祖制不可轻改。',
        effects: {
          stability: 5,
          approval: {
            official: 20,
            landowner: 25,
            scribe: 20,
            peasant: -20,
            worker: -15,
          },
        },
      },
    ],
  },

  // 黑船事件 - 启蒙时代/工业时代
  {
    id: 'black_ships',
    name: '黑船来航',
    icon: 'Ship',
    description: '几艘冒着黑烟的巨大铁甲船出现在港口外，船上的外国人带来了通商的要求。他们的大炮射程远超我国任何武器，令人胆寒。是开国还是攘夷？',
    triggerConditions: {
      minEpoch: 5,
      maxEpoch: 6,
      minPopulation: 350,
    },
    options: [
      {
        id: 'open_ports',
        text: '开港通商',
        description: '师夷长技以制夷。',
        effects: {
          resourcePercent: {
            silver: 0.012,
            culture: 0.03,
          },
          stability: -20,
          approval: {
            merchant: 35,
            official: -20,
            soldier: -30,
            peasant: -15,
            landowner: -20,
          },
          nationRelation: { all: 20 },
          nationAggression: { all: -0.15 },
        },
        randomEffects: [
          {
            chance: 0.5,
            effects: {
              resourcePercent: {
                silver: 0.012,
                science: 0.05,
              },
              stability: 15,
              nationRelation: { random: 10 },
            },
            description: '贸易带来繁荣，西学东渐！',
          },
          {
            chance: 0.3,
            effects: {
              stability: -25,
              approval: {
                peasant: -20,
                worker: -20,
              },
            },
            description: '不平等条约引发民族屈辱感。',
          },
        ],
      },
      {
        id: 'limited_trade',
        text: '限制性通商',
        description: '只开放特定港口，严格管控。',
        effects: {
          resourcePercent: {
            silver: 0.012,
          },
          stability: -5,
          approval: {
            merchant: 15,
            official: 5,
            soldier: -10,
          },
        },
      },
      {
        id: 'resist_foreigners',
        text: '攘夷！驱逐外国人！',
        description: '宁为玉碎，不为瓦全！',
        effects: {
          stability: -10,
          approval: {
            soldier: 30,
            peasant: 15,
            merchant: -30,
            official: 10,
          },
          nationRelation: { all: -30 },
          nationAggression: { all: 0.2 },
        },
        randomEffects: [
          {
            chance: 0.6,
            effects: {
              resourcePercent: {
                silver: -0.025,
              },
              populationPercent: -0.012,
              stability: -30,
              triggerWar: 'strongest',
            },
            description: '外国舰队炮轰港口，列强联军入侵！',
          },
        ],
      },
    ],
  },

  // 掷出窗外事件 - 封建时代/探索时代
  {
    id: 'defenestration',
    name: '掷出窗外事件',
    icon: 'Landmark',
    description: '宗教和政治矛盾激化！一群愤怒的新宗教贵族冲入王宫，将几名代表中央权威的传统宗教官员从窗户扔了出去。这一暴力行为点燃了积蓄已久的火药桶。',
    triggerConditions: {
      minEpoch: 3,
      maxEpoch: 5,
      minPopulation: 250,
      classConditions: {
        cleric: { maxApproval: 50 },
      },
    },
    options: [
      {
        id: 'punish_rebels',
        text: '严惩叛乱者',
        description: '维护朝廷权威，镇压地方势力！',
        effects: {
          resourcePercent: {
            silver: -0.02,
          },
          stability: -30,
          approval: {
            cleric: 20,
            official: 25,
            landowner: -30,
            peasant: -20,
          },
        },
        randomEffects: [
          {
            chance: 0.5,
            effects: {
              stability: -40,
              populationPercent: -0.1,
            },
            description: '全面内战爆发！',
          },
        ],
      },
      {
        id: 'negotiate_settlement',
        text: '谈判解决争端',
        description: '各方妥协，避免流血。',
        effects: {
          stability: -10,
          approval: {
            cleric: -10,
            official: -15,
            landowner: 15,
            merchant: 10,
          },
        },
      },
      {
        id: 'religious_freedom',
        text: '宣布宗教自由',
        description: '各人信仰自由，国家不得干涉。',
        effects: {
          resourcePercent: {
            culture: 0.03,
          },
          stability: -5,
          approval: {
            cleric: -35,
            landowner: 20,
            merchant: 20,
            peasant: 15,
            worker: 10,
          },
        },
      },
    ],
  },
];
