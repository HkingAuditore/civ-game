// Class Conflict Events - Events about social classes, political economy and historical references
// These events focus on: class struggles, political-economic conflicts, historical netas

export const CLASS_CONFLICT_EVENTS = [
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
