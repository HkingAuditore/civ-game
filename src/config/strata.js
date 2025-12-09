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
    startingWealth: 15,
    defaultResource: 'food',
    needs: { food: 0.55, cloth: 0.05, ale: 0.02, culture: 0.02},
    // Dynamic needs: unlock when wealth ratio >= threshold
    // Includes both luxury goods and practical resources for better living
    luxuryNeeds: {
      1.5: { ale: 0.03, plank: 0.01 },           // More ale, basic planks for home repair
      2.0: { furniture: 0.01, tools: 0.01 },     // Basic furniture and tools
      3.0: { spice: 0.02, brick: 0.01, cloth: 0.02 },  // Some spice, better housing materials, more clothes
      4.0: { food: 0.1, ale: 0.03 },             // More food variety and ale
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
    startingWealth: 18,
    defaultResource: 'wood',
    needs: { food: 0.75, cloth: 0.07, ale: 0.02, culture: 0.02},
    luxuryNeeds: {
      1.5: { ale: 0.03, tools: 0.015 },          // More ale, better tools
      2.0: { furniture: 0.01, plank: 0.02 },     // Furniture, more planks for home
      3.0: { spice: 0.015, cloth: 0.02, brick: 0.01 }, // Spice, more clothes, brick
      4.0: { food: 0.15, ale: 0.03 },            // More food and ale
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
    startingWealth: 8,
    defaultResource: 'food',
    needs: { food: 0.6, cloth: 0.05, ale: 0.02, culture: 0.015},
    luxuryNeeds: {
      2.0: { ale: 0.02, cloth: 0.01 },           // More ale and clothes
      3.0: { furniture: 0.005, plank: 0.01 },    // Basic furniture, planks
      4.0: { food: 0.1, tools: 0.005 },          // More food, basic tools
    },
    buffs: {
      satisfied: { desc: "佃农勤恳", production: 0.08 },
      dissatisfied: { desc: "佃农怠工", production: -0.15 }
    }
  },
  
  // 中层阶级
  worker: { 
    name: "工人", 
    icon: 'Hammer', 
    weight: 2, 
    tax: 3,
    headTaxBase: 0.03,
    desc: "工业时代的基石，推动生产力发展。",
    wealthWeight: 2,
    influenceBase: 1,
    startingWealth: 30,
    defaultResource: 'plank',
    needs: { food: 0.7, cloth: 0.08, tools: 0.03, ale: 0.05, culture: 0.04},
    luxuryNeeds: {
      1.5: { ale: 0.04, furniture: 0.02, tools: 0.02 },  // More ale, furniture, better tools
      2.0: { spice: 0.02, coffee: 0.01, plank: 0.02, brick: 0.01 },  // Spice, coffee, building materials
      3.0: { fine_clothes: 0.02, cloth: 0.03 },  // Fine clothes, more cloth
      4.0: { delicacies: 0.03, furniture: 0.03, stone: 0.01 },  // Delicacies, more furniture, stone
    },
    buffs: {
      satisfied: { desc: "工人积极", industryBonus: 0.15 },
      dissatisfied: { desc: "工人罢工", industryBonus: -0.25 }
    }
  },

  artisan: {
    name: "工匠",
    icon: 'Anvil',
    weight: 1.5,
    tax: 3.5,
    headTaxBase: 0.035,
    desc: "技艺精湛的手工业者，负责加工铜器与印刷制品。",
    wealthWeight: 2.5,
    influenceBase: 1.2,
    startingWealth: 45,
    defaultResource: 'tools',
    needs: { food: 0.65, cloth: 0.1, tools: 0.04, ale: 0.05, furniture: 0.02, culture: 0.05},
    luxuryNeeds: {
      1.5: { spice: 0.03, furniture: 0.03, plank: 0.02, copper: 0.01 },  // Spice, furniture, planks, copper for work
      2.0: { coffee: 0.02, fine_clothes: 0.02, brick: 0.02, tools: 0.02 },  // Coffee, clothes, brick, better tools
      3.0: { delicacies: 0.05, stone: 0.02, cloth: 0.03 },  // Delicacies, stone, more cloth
      4.0: { furniture: 0.05, steel: 0.01 },     // More furniture, steel
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
    startingWealth: 25,
    defaultResource: 'stone',
    needs: { food: 0.85, cloth: 0.08, ale: 0.02, culture: 0.03 },
    luxuryNeeds: {
      1.5: { ale: 0.04, tools: 0.02 },           // More ale, better tools for mining
      2.0: { furniture: 0.015, spice: 0.01, plank: 0.02 },  // Furniture, spice, planks
      3.0: { coffee: 0.01, cloth: 0.02, brick: 0.01 },  // Coffee, clothes, brick
      4.0: { food: 0.2, delicacies: 0.02 },      // More food and delicacies
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
    startingWealth: 30,
    defaultResource: 'spice',
    needs: { delicacies: 0.45, cloth: 0.12, spice: 0.15, furniture: 0.08, plank: 0.05, ale: 0.1, fine_clothes: 0.05, culture: 0.08},
    luxuryNeeds: {
      1.3: { coffee: 0.06, fine_clothes: 0.04, brick: 0.02 },  // Coffee, fine clothes, brick for warehouse
      1.8: { delicacies: 0.15, spice: 0.08, plank: 0.04, stone: 0.02 },  // More luxuries, building materials
      2.5: { furniture: 0.1, steel: 0.02, cloth: 0.05 },  // More furniture, steel, cloth
      3.5: { culture: 0.1, papyrus: 0.03 },      // More culture and papyrus
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
    startingWealth: 80,
    defaultResource: 'spice',
    needs: { food: 0.7, cloth: 0.1, spice: 0.1, ale: 0.1, culture: 0.06},
    luxuryNeeds: {
      1.5: { ale: 0.05, spice: 0.05, tools: 0.02 },  // More ale, spice, navigation tools
      2.0: { coffee: 0.03, furniture: 0.03, plank: 0.03 },  // Coffee, furniture, planks for ship repair
      3.0: { fine_clothes: 0.03, delicacies: 0.05, cloth: 0.03 },  // Fine clothes, delicacies
      4.0: { copper: 0.02, steel: 0.01 },        // Copper and steel for equipment
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
    startingWealth: 55,
    defaultResource: 'papyrus',
    needs: { food: 0.6, cloth: 0.1, papyrus: 0.06, furniture: 0.02, culture: 0.07},
    luxuryNeeds: {
      1.5: { coffee: 0.03, papyrus: 0.03, plank: 0.01 },  // Coffee, more papyrus, planks for desk
      2.0: { fine_clothes: 0.02, furniture: 0.03, brick: 0.01 },  // Fine clothes, furniture, brick
      3.0: { delicacies: 0.04, spice: 0.02, stone: 0.01 },  // Delicacies, spice, stone for study
      4.0: { culture: 0.05, cloth: 0.02 },       // More culture and cloth
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
    startingWealth: 35,
    defaultResource: 'tools',
    needs: { food: 0.95, cloth: 0.08, ale: 0.05, culture: 0.03},
    luxuryNeeds: {
      1.5: { ale: 0.05, tools: 0.03, copper: 0.01 },  // More ale, better tools/weapons, copper
      2.0: { furniture: 0.02, spice: 0.02, plank: 0.02 },  // Furniture, spice, planks for barracks
      3.0: { fine_clothes: 0.03, delicacies: 0.03, steel: 0.01 },  // Fine uniform, delicacies, steel
      4.0: { food: 0.2, cloth: 0.03, brick: 0.02 },  // More food, clothes, brick for quarters
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
    startingWealth: 45,
    defaultResource: 'culture',
    needs: { food: 0.6, cloth: 0.09, papyrus: 0.035, ale: 0.035, culture: 0.06},
    luxuryNeeds: {
      1.5: { papyrus: 0.03, culture: 0.03, plank: 0.01 },  // More papyrus, culture, planks for church
      2.0: { fine_clothes: 0.03, furniture: 0.03, stone: 0.02 },  // Fine vestments, furniture, stone for temple
      3.0: { delicacies: 0.04, spice: 0.02, brick: 0.02 },  // Delicacies, incense spice, brick
      4.0: { copper: 0.02, cloth: 0.03 },        // Copper for bells/vessels, more cloth
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
    startingWealth: 80,
    defaultResource: 'science',
    needs: { delicacies: 0.385, cloth: 0.12, papyrus: 0.08, coffee: 0.04, furniture: 0.06, stone: 0.02, fine_clothes: 0.06, culture: 0.09},
    luxuryNeeds: {
      1.3: { coffee: 0.04, fine_clothes: 0.04, brick: 0.03 },  // More coffee, fine clothes, brick for mansion
      1.6: { delicacies: 0.15, spice: 0.06, plank: 0.04, stone: 0.02 },  // Delicacies, spice, building materials
      2.0: { furniture: 0.08, steel: 0.02, cloth: 0.04 },  // More furniture, steel, cloth
      3.0: { culture: 0.1, papyrus: 0.04, copper: 0.02 },  // Culture, papyrus, copper decorations
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
    startingWealth: 150,
    defaultResource: 'food',
    needs: { delicacies: 0.50, cloth: 0.15, spice: 0.12, furniture: 0.10, brick: 0.05, plank: 0.05, fine_clothes: 0.08, culture: 0.1},
    luxuryNeeds: {
      1.2: { delicacies: 0.2, fine_clothes: 0.06, stone: 0.04 },  // More delicacies, fine clothes, stone for manor
      1.5: { spice: 0.1, coffee: 0.05, furniture: 0.1, brick: 0.04 },  // Spice, coffee, furniture, brick
      2.0: { culture: 0.08, plank: 0.06, steel: 0.02 },  // Culture, planks, steel
      3.0: { cloth: 0.08, copper: 0.03, papyrus: 0.02 },  // More cloth, copper decorations, papyrus
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
    startingWealth: 200,
    defaultResource: 'steel',
    needs: { delicacies: 0.30, cloth: 0.14, coffee: 0.072, furniture: 0.072, steel: 0.02, culture: 0.11},
    luxuryNeeds: {
      1.2: { coffee: 0.05, fine_clothes: 0.06, brick: 0.04 },  // Coffee, fine clothes, brick for factory
      1.5: { delicacies: 0.15, spice: 0.08, furniture: 0.08, steel: 0.03 },  // Delicacies, spice, furniture, steel
      2.0: { culture: 0.1, stone: 0.03, plank: 0.05 },  // Culture, stone, planks
      3.0: { copper: 0.04, papyrus: 0.03, cloth: 0.06 },  // Copper, papyrus, more cloth
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
    startingWealth: 120,
    defaultResource: 'tools',
    needs: { delicacies: 0.75, cloth: 0.15, coffee: 0.05, furniture: 0.08, ale: 0.1, culture: 0.08},
    luxuryNeeds: {
      1.2: { delicacies: 0.2, fine_clothes: 0.05, steel: 0.02 },  // Delicacies, fine clothes, steel for armor
      1.5: { spice: 0.06, furniture: 0.06, ale: 0.05, plank: 0.03 },  // Spice, furniture, ale, planks for stable
      2.0: { culture: 0.06, coffee: 0.04, brick: 0.03, stone: 0.02 },  // Culture, coffee, building materials
      3.0: { tools: 0.03, copper: 0.02, cloth: 0.04 },  // Better tools, copper for decorations, cloth
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
    startingWealth: 160,
    defaultResource: 'steel',
    needs: { food: 0.8, cloth: 0.12, coffee: 0.08, ale: 0.05, furniture: 0.05, culture: 0.07},
    luxuryNeeds: {
      1.3: { coffee: 0.05, fine_clothes: 0.04, tools: 0.03, steel: 0.02 },  // Coffee, clothes, precision tools, steel
      1.6: { delicacies: 0.08, spice: 0.04, furniture: 0.05, brick: 0.03 },  // Delicacies, spice, furniture, brick
      2.0: { culture: 0.06, plank: 0.04, copper: 0.02, stone: 0.02 },  // Culture, planks, copper, stone
      3.0: { papyrus: 0.03, cloth: 0.04 },       // Papyrus for blueprints, more cloth
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
    startingWealth: 5,
    needs: { food: 0.45, cloth: 0.05 },
    luxuryNeeds: {
      2.0: { ale: 0.02, food: 0.05 },            // More ale and food
      3.0: { furniture: 0.005, cloth: 0.01 },    // Basic furniture, more clothes
      4.0: { plank: 0.005 },                     // Basic planks
    },
    buffs: {
      satisfied: { desc: "等待机会", stability: 0.02 },
      dissatisfied: { desc: "失业动荡", stability: -0.1 }
    }
  },
};
