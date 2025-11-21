// 社会阶层配置文件
// 定义游戏中的各个社会阶层及其属性和影响

/**
 * 社会阶层配置对象
 * 每个阶层包含：
 * - name: 阶层名称
 * - icon: 显示图标
 * - weight: 权重（影响分配优先级）
 * - tax: 税收贡献（每人每秒）
 * - admin: 行政影响（正值为压力，负值为容量）
 * - desc: 描述
 * - wealthWeight: 财富权重
 * - influenceBase: 基础影响力
 * - needs: 资源需求（每人每秒）
 * - buffs: 满意/不满时的效果
 */
export const STRATA = {
  // 底层阶级
  slave: { 
    name: "奴隶", 
    icon: 'UserCog', 
    weight: 0.1, 
    tax: 0, 
    admin: 0.5, 
    desc: "无权利的劳动力，提供高产出但降低稳定度。",
    wealthWeight: 0,
    influenceBase: 0,
    needs: { food: 0.3 },
    buffs: {
      satisfied: { desc: "奴隶温顺", production: 0.05 },
      dissatisfied: { desc: "奴隶暴动风险", stability: -0.15 }
    }
  },
  
  peasant: { 
    name: "自耕农", 
    icon: 'Wheat', 
    weight: 1, 
    tax: 1, 
    admin: 1, 
    desc: "社会的基础，提供稳定的粮食和兵源。",
    wealthWeight: 1,
    influenceBase: 0.5,
    needs: { food: 0.5, wood: 0.1 },
    buffs: {
      satisfied: { desc: "民心稳定", taxIncome: 0.1, production: 0.05 },
      dissatisfied: { desc: "民怨沸腾", taxIncome: -0.2, production: -0.1 }
    }
  },
  
  serf: { 
    name: "佃农", 
    icon: 'Users', 
    weight: 0.5, 
    tax: 2, 
    admin: 0.8, 
    desc: "依附于地主的农民，产出归地主所有。",
    wealthWeight: 0.5,
    influenceBase: 0.3,
    needs: { food: 0.4 },
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
    admin: 1.5, 
    desc: "工业时代的基石，推动生产力发展。",
    wealthWeight: 2,
    influenceBase: 1,
    needs: { food: 0.6, tools: 0.05 },
    buffs: {
      satisfied: { desc: "工人积极", industryBonus: 0.15 },
      dissatisfied: { desc: "工人罢工", industryBonus: -0.25 }
    }
  },
  
  soldier: { 
    name: "军人", 
    icon: 'Swords', 
    weight: 3, 
    tax: 1, 
    admin: 2, 
    desc: "维护国家安全，但也可能造成动荡。",
    wealthWeight: 2,
    influenceBase: 2,
    needs: { food: 0.8, gold: 0.5 },
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
    admin: 1, 
    desc: "提供信仰和文化，安抚民心。",
    wealthWeight: 3,
    influenceBase: 3,
    needs: { food: 0.5, culture: 1 },
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
    admin: -5,  // 负值表示增加行政容量
    desc: "行政管理者，增加行政容量。",
    wealthWeight: 5,
    influenceBase: 4,
    needs: { food: 0.7, gold: 1, culture: 0.5 },
    buffs: {
      satisfied: { desc: "吏治清明", adminBonus: 5, taxIncome: 0.1 },
      dissatisfied: { desc: "官员腐败", adminBonus: -3, taxIncome: -0.2 }
    }
  },
  
  landowner: { 
    name: "地主", 
    icon: 'Castle', 
    weight: 10, 
    tax: 5, 
    admin: 3, 
    desc: "传统精英，掌控土地和农业。",
    wealthWeight: 10,
    influenceBase: 5,
    needs: { food: 1, gold: 2, culture: 1 },
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
    admin: 4, 
    desc: "工业精英，提供投资和工业加成。",
    wealthWeight: 20,
    influenceBase: 6,
    needs: { gold: 3, tools: 0.2, science: 1 },
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
    admin: 2, 
    desc: "军事贵族，强大的战斗力。",
    wealthWeight: 8,
    influenceBase: 4,
    needs: { food: 1, gold: 1.5 },
    buffs: {
      satisfied: { desc: "骑士忠诚", militaryPower: 0.25, stability: 0.1 },
      dissatisfied: { desc: "骑士不满", militaryPower: -0.2, stability: -0.15 }
    }
  },
};
