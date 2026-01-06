// 社会阶层配置文件
// 定义游戏中的各个社会阶层及其属性和影响

/**
 * 社会阶层配置对象
 * 每个阶层包含：
 * - name: 阶层名称
 * - icon: 显示图标
 * - weight: 权重（影响分配优先级）
 * - tax: 税收贡献（每人每秒）
 * - headTaxBase: 头税基准（银币/人/日）
 * - desc: 描述
 * - wealthWeight: 财富权重
 * - influenceBase: 基础影响力
 * - needs: 资源需求（每人每秒）
 * - startingWealth: 初始财富（银币）
 * - luxuryNeeds: 动态需求（当财富比例达到阈值时解锁的额外需求）
 * - buffs: 满意/不满时的效果
 */
export const STRATA = {
    peasant: {
        name: "自耕农",
        icon: 'Wheat',
        weight: 1,
        tax: 1,
        headTaxBase: 0.01,
        desc: "社会的基础，提供稳定的粮食和兵源。",
        wealthWeight: 1,
        influenceBase: 0.5,
        startingWealth: 80,
        defaultResource: 'food',
        wealthElasticity: 0.5, // 底层阶级：收入翻倍时消费只增50%
        maxConsumptionMultiplier: 3, // 底层阶级消费上限3倍
        needs: { food: 0.55, cloth: 0.08 },
        // Dynamic needs: unlock when wealth ratio >= threshold
        luxuryNeeds: {
            1.0: { ale: 0.04 },
            1.5: { wood: 0.02, culture: 0.02 },                    // 基本工具和衣物，基础文化
            2.0: { plank: 0.03, stone: 0.01 },          // 更多麦酒，修缮材料
            2.5: { furniture: 0.02, tools: 0.02 },                // 基本家具，石材
            3.0: { spice: 0.04, brick: 0.02, culture: 0.05 },        // 香料，砖块，更多文化
            4.5: { copper: 0.004 }, // 更好家具，更多木板，铜器
            5.5: { delicacies: 0.02, fine_clothes: 0.01, culture: 0.08 }, // 珍馐，华服，文化
            7.0: { coffee: 0.02 },     // 咖啡，香料，石材
            8.0: {} // 高端奢侈需求
        },
        buffs: {
            satisfied: { desc: "民心稳定", taxIncome: 0.1, production: 0.05 },
            dissatisfied: { desc: "民怨沸腾", taxIncome: -0.2, production: -0.1 }
        }
    },

    lumberjack: {
        name: "樵夫",
        icon: 'Trees',
        weight: 0.8,
        tax: 1.2,
        headTaxBase: 0.02,
        desc: "专职砍伐木材，维系城市建设。",
        wealthWeight: 1,
        influenceBase: 0.4,
        startingWealth: 90,
        defaultResource: 'wood',
        wealthElasticity: 0.6, // 体力劳动者：消费增长适中
        maxConsumptionMultiplier: 3, // 底层阶级消费上限3倍
        needs: { food: 0.65, cloth: 0.10 },
        luxuryNeeds: {
            1.0: { ale: 0.04 },
            1.5: { stone: 0.01, culture: 0.02 },                     // 更好工具和工作衣物，基础文化
            2.0: { plank: 0.04, wood: 0.03 },           // 麦酒，板材，木材
            2.5: { furniture: 0.025 },                // 家具，优质工具
            3.0: { spice: 0.03, brick: 0.025, culture: 0.05 },       // 香料，砖块，更多文化
            4.5: { copper: 0.006, tools: 0.03 },   // 家具，铜工具，木材
            5.5: { delicacies: 0.025, fine_clothes: 0.015, culture: 0.08 }, // 珍馐，华服，文化
            7.0: { coffee: 0.03 },       // 咖啡，香料，石材
            8.0: {} // 高端需求
        },
        buffs: {
            satisfied: { desc: "林场顺畅", production: 0.06 },
            dissatisfied: { desc: "供应迟滞", production: -0.1 }
        }
    },

    serf: {
        name: "佃农",
        icon: 'Users',
        weight: 0.5,
        tax: 2,
        headTaxBase: 0.015,
        desc: "依附于地主的农民，产出归地主所有。",
        wealthWeight: 0.5,
        influenceBase: 0.3,
        startingWealth: 50,
        defaultResource: 'food',
        wealthElasticity: 0.4, // 最底层：收入增长转化消费最慢
        maxConsumptionMultiplier: 3, // 底层阶级消费上限3倍
        needs: { food: 0.50, cloth: 0.06 },
        luxuryNeeds: {
            1.0: { ale: 0.03 },
            2.0: { culture: 0.015 },                      // 基本舒适品，开始渴望文化
            2.5: { food: 0.06 },           // 更多麦酒，衣物，食物
            3.0: { furniture: 0.01, plank: 0.02, tools: 0.006 },   // 基本家具，板材，工具
            4.0: { spice: 0.02, stone: 0.006, culture: 0.03 }, // 香料，石材，更多文化
            5.0: {}, // 麦酒，家具，衣物，板材
            6.0: { delicacies: 0.01, brick: 0.015, culture: 0.05 }, // 珍馐，砖块，文化
            7.5: { fine_clothes: 0.008, copper: 0.004 }, // 华服，香料，板材，铜器
            9.0: { coffee: 0.01 }, // 珍馐，家具，砖块，咖啡
            10.0: {} // 华服，文化，香料
        },
        buffs: {
            satisfied: { desc: "佃农勤恳", production: 0.08 },
            dissatisfied: { desc: "佃农怠工", production: -0.15 }
        }
    },

    worker: {
        name: "工人",
        icon: 'Hammer',
        weight: 2,
        tax: 3,
        headTaxBase: 0.03,
        desc: "工业时代的基石，推动生产力发展。",
        wealthWeight: 2,
        influenceBase: 1,
        startingWealth: 80,
        defaultResource: 'plank',
        wealthElasticity: 0.7, // 工人阶级：消费增长中等
        maxConsumptionMultiplier: 3, // 底层阶级消费上限3倍（防止补贴导致消费爆炸）
        needs: { food: 0.70, cloth: 0.12 },
        luxuryNeeds: {
            1.0: { tools: 0.05, ale: 0.07 },
            1.5: { plank: 0.02, culture: 0.03 },          // 更好工具，板材，基础文化
            2.5: { furniture: 0.03, spice: 0.02 },    // 家具，香料，衣物
            3.0: { coffee: 0.025, brick: 0.03, culture: 0.08 }, // 咖啡，砖块，更多文化
            4.0: { fine_clothes: 0.03, delicacies: 0.04, stone: 0.015 }, // 华服，珍馐，石材
            5.0: { steel: 0.01, copper: 0.008, culture: 0.12 }, // 钢，铜器，大量文化
            6.5: {}, // 珍馐，华服，砖块
            8.0: { papyrus: 0.02 }, // 纸张，衣物，麦酒，咖啡
            10.0: {}, // 香料，钢，家具
            12.0: {} // 华服，珍馐，砖块
        },
        buffs: {
            satisfied: { desc: "工人积极", industryBonus: 0.15 },
            dissatisfied: { desc: "工人罢工", industryBonus: -0.25 }
        }
    },


    // 中层阶级

    artisan: {
        name: "工匠",
        icon: 'Anvil',
        weight: 1.5,
        tax: 3.5,
        headTaxBase: 0.035,
        desc: "技艺精湛的手工业者，负责加工铜器与印刷制品。",
        wealthWeight: 2.5,
        influenceBase: 1.2,
        startingWealth: 200,
        defaultResource: 'tools',
        wealthElasticity: 0.8, // 手工业者：消费意愿较强
        maxConsumptionMultiplier: 6, // 中层阶级消费上限6倍
        needs: { food: 0.80, cloth: 0.14 },
        luxuryNeeds: {
            1.0: { tools: 0.06, ale: 0.08, furniture: 0.04, culture: 0.04 },
            1.8: { copper: 0.015, spice: 0.04 },   // 铜料，香料，家具
            2.5: { coffee: 0.03, fine_clothes: 0.025, brick: 0.03, culture: 0.10 }, // 咖啡，华服，砖块，更多文化
            3.5: { delicacies: 0.06, stone: 0.025, dye: 0.015 }, // 珍馐，石材，衣物
            4.5: { steel: 0.008, iron: 0.01, culture: 0.15 }, // 家具，钢，大量文化
            6.0: {}, // 华服，珍馐，砖块
            8.0: { papyrus: 0.03 }, // 纸张，家具，工具
            10.0: {}, // 钢，香料，麦酒，衣物
            12.0: {} // 珍馐，华服，咖啡
        },
        buffs: {
            satisfied: { desc: "坊市繁盛", production: 0.1 },
            dissatisfied: { desc: "工坊停工", production: -0.15 }
        }
    },

    miner: {
        name: "矿工",
        icon: 'Pickaxe',
        weight: 1.2,
        tax: 2.5,
        headTaxBase: 0.025,
        desc: "深入地下采集矿石，承担艰苦劳动。",
        wealthWeight: 1.5,
        influenceBase: 0.8,
        startingWealth: 120,
        defaultResource: 'stone',
        wealthElasticity: 0.6, // 体力劳动者：消费增长适中
        maxConsumptionMultiplier: 4, // 中层阶级消费上限6倍
        needs: { food: 0.70, cloth: 0.12 },
        luxuryNeeds: {
            1.0: { ale: 0.05 },
            1.8: { wood: 0.03 },          // 采矿工具，麦酒，衣物
            2.0: { culture: 0.02 },    // 开始需要文化娱乐
            2.5: { furniture: 0.02, spice: 0.015, food: 0.15 },    // 家具，香料，食物
            3.0: { plank: 0.03, brick: 0.02, coffee: 0.015 }, // 板材，砖块，咖啡
            4.0: { delicacies: 0.03, culture: 0.05 }, // 珍馐，更多文化
            5.5: { copper: 0.01 }, // 家具，铜器，香料
            7.0: { fine_clothes: 0.02, culture: 0.08 }, // 华服，大量文化
            9.0: {}, // 珍馐，板材，麦酒
            11.0: {} // 钢，家具，香料，华服
        },
        buffs: {
            satisfied: { desc: "矿脉稳定", gatherBonus: 0.1 },
            dissatisfied: { desc: "矿难隐患", stability: -0.1 }
        }
    },

    merchant: {
        name: "商人",
        icon: 'Coins',
        weight: 6,
        tax: 5,
        headTaxBase: 0.09,
        desc: "控制贸易网络的阶层，主宽港口与市场。",
        wealthWeight: 8,
        influenceBase: 3.5,
        startingWealth: 500,
        defaultResource: 'spice',
        wealthElasticity: 1.5, // 商人：收入转化消费能力很强
        maxConsumptionMultiplier: 10, // 中层阶级消费上限6倍
        needs: { food: 1.80, cloth: 0.25 },
        luxuryNeeds: {
            1.0: { delicacies: 0.60, spice: 0.20, furniture: 0.12, plank: 0.08, ale: 0.15, fine_clothes: 0.10, culture: 0.20, dye: 0.02 },
            1.5: { coffee: 0.14 },         // 咖啡，华服
            2.0: { delicacies: 0.35, plank: 0.12, brick: 0.05, culture: 0.35 }, // 珍馐，板材，大量文化
            3.0: { steel: 0.05, coal: 0.03 }, // 家具，钢，衣物
            5.0: { papyrus: 0.08, copper: 0.06, stone: 0.05, culture: 0.50 }, // 纸张，铜器，巨量文化
            8.0: {}, // 香料，咖啡，钢
            12.0: {}, // 珍馐，家具，砖块，板材
            18.0: {} // 华服，纸张，铜器
        },
        buffs: {
            satisfied: { desc: "商贸兴隆", taxIncome: 0.15, gatherBonus: 0.05 },
            dissatisfied: { desc: "贸易停滞", taxIncome: -0.2, stability: -0.1 }
        },
        // 商人交易配置
        tradeConfig: {
            minProfitMargin: 0.10,        // 最低利润率（10%）
            maxPurchaseAmount: 10,         // 单次最大购买量
            exportProbability: 0.5,        // 出口概率（50%）
            maxInventoryRatio: 0.1,        // 最大库存占用比例（出口时最多使用10%的可用库存）
            minWealthForTrade: 10,         // 最低交易财富要求
            tradeDuration: 3,              // 贸易周期（天）- 买入后等待X天才能卖出
            tradeCooldown: 0,              // 交易冷却时间（天）- 两次交易之间的最小间隔，0表示无冷却
            enableDebugLog: true          // 是否启用调试日志
        }
    },
    navigator: {
        name: "水手",
        icon: 'Compass',
        weight: 4,
        tax: 3,
        headTaxBase: 0.06,
        desc: "探索时代的海员与测绘师，推动航海扩张。",
        wealthWeight: 3,
        influenceBase: 2.5,
        startingWealth: 300,
        defaultResource: 'spice',
        wealthElasticity: 0.7, // 水手：消费增长中等
        maxConsumptionMultiplier: 6, // 中层阶级消费上限6倍
        needs: { food: 0.75, cloth: 0.12 },
        luxuryNeeds: {
            1.0: { spice: 0.12, ale: 0.12, culture: 0.08 },
            1.8: { tools: 0.05 },          // 麦酒，香料，工具
            2.5: { coffee: 0.07, furniture: 0.07, culture: 0.15 }, // 咖啡，家具，更多文化
            3.5: { fine_clothes: 0.08, delicacies: 0.12, plank: 0.07 }, // 华服，珍馐，板材
            5.0: { copper: 0.05, steel: 0.03, culture: 0.25 }, // 铜器，钢，大量文化
            7.0: { papyrus: 0.05 }, // 纸张，家具，咖啡，麦酒
            10.0: { brick: 0.08 }, // 珍馐，华服，砖块
            14.0: {} // 钢，铜器，家具，石材
        },
        buffs: {
            satisfied: { desc: "海权扩张", gatherBonus: 0.1 },
            dissatisfied: { desc: "航员哗变", gatherBonus: -0.1, stability: -0.1 }
        }
    },

    scribe: {
        name: "学者",
        icon: 'Feather',
        weight: 2.5,
        tax: 2,
        headTaxBase: 0.04,
        desc: "记录知识的学者，为图书馆与学院服务。",
        wealthWeight: 2.5,
        influenceBase: 1.5,
        startingWealth: 250,
        defaultResource: 'papyrus',
        wealthElasticity: 1.0, // 学者：收入转化消费正常
        maxConsumptionMultiplier: 6, // 中层阶级消费上限6倍
        needs: { food: 0.85, cloth: 0.15 },
        luxuryNeeds: {
            1.0: { papyrus: 0.10, furniture: 0.05, culture: 0.12 },
            1.5: { coffee: 0.07 },         // 咖啡，纸张
            2.0: { fine_clothes: 0.05, plank: 0.025, culture: 0.25 },  // 华服，板材，大量文化
            3.0: { delicacies: 0.09, spice: 0.05 },       // 珍馐，香料
            5.0: { copper: 0.035, brick: 0.025, culture: 0.35 }, // 铜器，砖块，巨量文化
            7.0: {}, // 咖啡，华服，家具
            10.0: { stone: 0.04 }, // 珍馐，香料，石材，板材
            14.0: { cloth: 0.07 }, // 纸张，衣物，铜器
            18.0: { steel: 0.015 } // 钢，家具，华服
        },
        buffs: {
            satisfied: { desc: "文献井然", scienceBonus: 0.15 },
            dissatisfied: { desc: "文献损失", scienceBonus: -0.2 }
        }
    },

    soldier: {
        name: "军人",
        icon: 'Swords',
        weight: 3,
        tax: 1,
        headTaxBase: 0.04,
        desc: "维护国家安全，但也可能造成动荡。",
        wealthWeight: 2,
        influenceBase: 2,
        startingWealth: 180,
        defaultResource: 'tools',
        wealthElasticity: 0.6, // 军人：消费需求稳定
        maxConsumptionMultiplier: 6, // 中层阶级消费上限6倍
        needs: { food: 0.85, cloth: 0.12 },
        luxuryNeeds: {
            1.0: { ale: 0.08 },
            1.5: { culture: 0.06 },    // 军人需要士气文化
            2.0: { tools: 0.07, copper: 0.025, iron: 0.02 },          // 麦酒，武器，铜器
            2.5: { furniture: 0.05, spice: 0.05 },    // 家具，香料
            3.0: { culture: 0.12 },    // 更多士气文化
            3.5: { fine_clothes: 0.07, delicacies: 0.07, steel: 0.025 }, // 华服，珍馐，钢
            5.0: { brick: 0.05, culture: 0.18 }, // 砖块，大量文化
            7.0: { coffee: 0.09, stone: 0.05 }, // 咖啡，石材，工具
            10.0: {}, // 华服，珍馐，钢
            14.0: {} // 砖块，板材，铜器，家具
        },
        buffs: {
            satisfied: { desc: "军心稳固", militaryPower: 0.2 },
            dissatisfied: { desc: "军队哗变风险", militaryPower: -0.3, stability: -0.2 }
        }
    },

    cleric: {
        name: "神职人员",
        icon: 'Cross',
        weight: 4,
        tax: 0.5,
        headTaxBase: 0.05,
        desc: "提供信仰和文化，安抚民心。",
        wealthWeight: 3,
        influenceBase: 3,
        startingWealth: 220,
        defaultResource: 'culture',
        wealthElasticity: 0.9, // 神职：消费增长较快（奉献精神）
        maxConsumptionMultiplier: 6, // 中层阶级消费上限6倍
        needs: { food: 0.90, cloth: 0.15 },
        luxuryNeeds: {
            1.0: { papyrus: 0.08, ale: 0.06, culture: 0.18 },
            1.5: { plank: 0.02 },      // 纸张，板材
            2.0: { fine_clothes: 0.06, furniture: 0.06, stone: 0.04, culture: 0.30 }, // 华服，家具，石材，大量文化
            3.0: { delicacies: 0.08, spice: 0.04 },    // 珍馐，香料
            4.5: { copper: 0.04, brick: 0.04, culture: 0.40 },          // 铜器，砖块，巨量文化
            6.0: { coffee: 0.05, steel: 0.01 },        // 咖啡，钢
            8.0: { papyrus: 0.09 }, // 家具，华服，纸张
            10.0: {} // 珍馐，砖块，铜器，香料
        },
        buffs: {
            satisfied: { desc: "宗教和谐", cultureBonus: 0.2, stability: 0.1 },
            dissatisfied: { desc: "信仰危机", cultureBonus: -0.15, stability: -0.1 }
        }
    },

    // 上层阶级
    official: {
        name: "官员",
        icon: 'ScrollText',
        weight: 5,
        tax: 2,
        headTaxBase: 0.08,
        desc: "政府管理者。",
        wealthWeight: 5,
        influenceBase: 4,
        startingWealth: 400,
        defaultResource: 'science',
        wealthElasticity: 2.5, // 官员：贪婪消费，极高弹性
        maxConsumptionMultiplier: 50, // 极高消费上限
        greedy: true, // 启用贪婪消费逻辑
        needs: { food: 1.20, cloth: 0.20 },
        luxuryNeeds: {
            1.0: { delicacies: 0.50, papyrus: 0.12, coffee: 0.08, furniture: 0.10, stone: 0.04, fine_clothes: 0.10, culture: 0.25 },
            1.3: {},  // 咖啡，华服
            1.8: { delicacies: 0.30, spice: 0.12, plank: 0.08, brick: 0.06 },  // 珍馐，香料，板材，砖块
            2.0: { culture: 0.40 }, // 大量文化需求
            2.5: { steel: 0.04, iron: 0.03, coal: 0.03 }, // 家具，钢，衣物
            4.0: { papyrus: 0.08, copper: 0.04, stone: 0.04, culture: 0.55 },       // 纸张，铜器，巨量文化
            6.0: { fine_clothes: 0.15 }, // 珍馐，华服，钢
            9.0: {}, // 香料，咖啡，砖块，家具
            14.0: {}, // 纸张，铜器，石材
            20.0: {} // 钢，家具，珍馐，华服
        },
        buffs: {
            satisfied: { desc: "吏治清明", taxIncome: 0.1 },
            dissatisfied: { desc: "官员腐败", taxIncome: -0.2 }
        }
    },

    landowner: {
        name: "地主",
        icon: 'Castle',
        weight: 10,
        tax: 5,
        headTaxBase: 0.07,
        desc: "传统精英，掌控土地和农业。",
        wealthWeight: 10,
        influenceBase: 5,
        startingWealth: 800,
        defaultResource: 'food',
        wealthElasticity: 1.4, // 地主：消费增长很快
        maxConsumptionMultiplier: 10, // 上层阶级消费上限10倍
        needs: { food: 2.00, cloth: 0.30 },
        luxuryNeeds: {
            1.0: { delicacies: 0.80, spice: 0.20, furniture: 0.18, brick: 0.10, plank: 0.10, fine_clothes: 0.15, culture: 0.30 },
            1.3: { delicacies: 0.40, fine_clothes: 0.12 },  // 珍馐，华服
            1.5: { culture: 0.45 },  // 大量文化需求
            1.8: { spice: 0.20, coffee: 0.10, stone: 0.08 },  // 香料，咖啡，家具，石材
            2.5: { plank: 0.12, steel: 0.04, brick: 0.08, culture: 0.60 }, // 板材，钢，巨量文化
            4.0: { copper: 0.06, papyrus: 0.04 },         // 衣物，铜器，纸张
            6.0: {}, // 珍馐，华服，钢
            9.0: {}, // 香料，咖啡，砖块，家具
            14.0: {}, // 纸张，铜器，石材
            20.0: {} // 钢，家具，珍馐，华服
        },
        buffs: {
            satisfied: { desc: "贵族支持", taxIncome: 0.15, stability: 0.15 },
            dissatisfied: { desc: "贵族叛乱", taxIncome: -0.3, stability: -0.25 }
        }
    },

    capitalist: {
        name: "资本家",
        icon: 'Briefcase',
        weight: 15,
        tax: 8,
        headTaxBase: 0.08,
        desc: "工业精英，提供投资和工业加成。",
        wealthWeight: 20,
        influenceBase: 6,
        startingWealth: 1200,
        defaultResource: 'steel',
        wealthElasticity: 1.8, // 资本家：消费增长最快
        maxConsumptionMultiplier: 10, // 上层阶级消费上限10倍
        needs: { food: 2.50, cloth: 0.35 },
        luxuryNeeds: {
            1.0: { delicacies: 0.70, coffee: 0.15, furniture: 0.15, steel: 0.05, culture: 0.35 },
            1.3: { fine_clothes: 0.12 },  // 咖啡，华服
            1.5: { culture: 0.50 },  // 大量文化需求
            1.8: { delicacies: 0.30, spice: 0.15, brick: 0.08 },  // 珍馐，香料，砖块
            2.5: { stone: 0.06, plank: 0.10, coal: 0.04, iron: 0.03, culture: 0.70 }, // 石材，板材，巨量文化
            4.0: { copper: 0.08, papyrus: 0.06 },       // 铜器，纸张，衣物
            6.0: {}, // 珍馐，华服，钢
            10.0: {}, // 香料，咖啡，砖块，家具
            15.0: {}, // 纸张，铜器，石材
            22.0: {} // 钢，家具，珍馐，华服
        },
        buffs: {
            satisfied: { desc: "资本繁荣", industryBonus: 0.25, scienceBonus: 0.15 },
            dissatisfied: { desc: "资本外逃", industryBonus: -0.3, taxIncome: -0.25 }
        }
    },

    knight: {
        name: "骑士",
        icon: 'Shield',
        weight: 8,
        tax: 2,
        headTaxBase: 0.09,
        desc: "军事贵族，强大的战斗力。",
        wealthWeight: 8,
        influenceBase: 4,
        startingWealth: 600,
        defaultResource: 'tools',
        wealthElasticity: 1.0, // 骑士：消费增长正常
        maxConsumptionMultiplier: 10, // 上层阶级消费上限10倍
        needs: { food: 1.50, cloth: 0.25 },
        luxuryNeeds: {
            1.0: { delicacies: 0.90, coffee: 0.10, furniture: 0.15, ale: 0.15, culture: 0.20 },
            1.3: { delicacies: 0.40, fine_clothes: 0.10 },  // 珍馐，华服
            1.5: { culture: 0.35 },  // 大量荣耀文化
            1.8: { spice: 0.12, steel: 0.04 },  // 香料，钢
            2.5: { coffee: 0.08, brick: 0.06, stone: 0.04, culture: 0.50 }, // 咖啡，砖块，巨量文化
            4.0: { tools: 0.06, copper: 0.04, plank: 0.06 },  // 工具，铜器，板材
            6.0: {}, // 珍馐，华服，钢
            10.0: {}, // 香料，咖啡，砖块，家具
            15.0: {}, // 铜器，纸张，石材
            22.0: {} // 钢，家具，珍馐，华服
        },
        buffs: {
            satisfied: { desc: "骑士忠诚", militaryPower: 0.25, stability: 0.1 },
            dissatisfied: { desc: "骑士不满", militaryPower: -0.2, stability: -0.15 }
        }
    },

    engineer: {
        name: "工程师",
        icon: 'Cog',
        weight: 7,
        tax: 6,
        headTaxBase: 0.1,
        desc: "掌控蒸汽与机器的技术阶层。",
        wealthWeight: 6,
        influenceBase: 3.5,
        startingWealth: 700,
        defaultResource: 'steel',
        wealthElasticity: 1.1, // 工程师：技术精英消费增长较快
        maxConsumptionMultiplier: 10, // 上层阶级消费上限10倍
        needs: { food: 1.00, cloth: 0.18 },
        luxuryNeeds: {
            1.0: { coffee: 0.12, ale: 0.08, furniture: 0.10, culture: 0.18 },
            1.3: { fine_clothes: 0.08 },  // 咖啡，华服
            1.8: { delicacies: 0.15, spice: 0.08, tools: 0.06 },  // 珍馐，香料，工具
            2.0: { culture: 0.30 },       // 大量知识文化
            2.5: { plank: 0.08, copper: 0.04, stone: 0.04 },       // 板材，铜器，石材
            4.0: { papyrus: 0.06, brick: 0.06, steel: 0.04, coal: 0.05, iron: 0.03, culture: 0.45 },        // 纸张，砖块，巨量文化
            6.0: {}, // 珍馐，华服，钢
            10.0: {},    // 香料，咖啡，砖块，家具
            15.0: {},    // 铜器，纸张，石材
            22.0: {} // 钢，家具，珍馐，华服
        },
        buffs: {
            satisfied: { desc: "工艺革新", industryBonus: 0.2, scienceBonus: 0.1 },
            dissatisfied: { desc: "技术流失", industryBonus: -0.25 }
        }
    },

    unemployed: {
        name: "失业者",
        icon: 'AlertTriangle',
        weight: 0.2,
        tax: 1,
        headTaxBase: 0.01,
        desc: "暂时没有工作的平民，如果得不到安排会渐渐不满。",
        wealthWeight: 0.2,
        influenceBase: 0.3,
        startingWealth: 30,
        wealthElasticity: 0.3, // 失业者：收入增长转化消费最慢（优先储蓄）
        maxConsumptionMultiplier: 3, // 底层阶级消费上限3倍
        needs: { food: 0.40, cloth: 0.05 },
        luxuryNeeds: {
            2.5: { ale: 0.04, food: 0.10 },            // 麦酒，食物
            3.5: { furniture: 0.01 },     // 基本家具，衣物
            4.5: { plank: 0.01, culture: 0.004 },      // 板材，少量文化
            5.5: { tools: 0.004 },          // 更多麦酒，基本工具
            7.0: { spice: 0.008 }, // 香料，更多食物，文化
            9.0: { brick: 0.006 }, // 家具，衣物，砖块
        },
        buffs: {
            satisfied: { desc: "等待机会", stability: 0.02 },
            dissatisfied: { desc: "失业动荡", stability: -0.1 }
        }
    },
};
