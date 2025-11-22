/**
 * 政令配置
 * 每个政令包含：
 * - id: 政令唯一标识
 * - name: 政令名称
 * - desc: 政令描述和效果
 * - cost: 行政成本
 * - active: 是否激活（初始状态）
 */
export const DECREES = [
  {
    id: 'clan_tribute',
    name: "部族贡粮",
    desc: "动员氏族共享余粮，防止断粮危机。",
    category: 'social',
    unlockEpoch: 0,
    cost: { admin: 4 },
    effects: ["每日 +1 粮食", "采集效率 +5%"],
    drawbacks: ["全局生产 -3%"],
    modifiers: { passive: { food: 1 }, categories: { gather: 0.05 }, production: -0.03 },
    active: false,
  },
  {
    id: 'grain_rationing',
    name: "粮食配给",
    desc: "严格管控粮仓，换取更稳定的口粮发放。",
    category: 'economy',
    unlockEpoch: 0,
    cost: { admin: 6 },
    effects: ["每日 +2 粮食"],
    drawbacks: ["全局生产 -5%"],
    modifiers: { passive: { food: 2 }, production: -0.05 },
    active: false,
  },
  {
    id: 'citizen_roadworks',
    name: "徭役筑路",
    desc: "征调公民维护道路，采集运输更加顺畅。",
    category: 'economy',
    unlockEpoch: 1,
    cost: { admin: 8 },
    effects: ["采集类建筑 +5%"],
    drawbacks: ["税收效率 -3%"],
    modifiers: { categories: { gather: 0.05 }, taxIncome: -0.03 },
    active: false,
  },
  { 
    id: 'forced_labor', 
    name: "强制劳动", 
    desc: "强迫佃农与矿工超时工作，换取短期增产。", 
    category: 'social',
    unlockEpoch: 3,
    cost: { admin: 10 }, 
    effects: ["矿井与庄园 +20% 产出"],
    drawbacks: ["佃农与矿工好感 -20/-15"],
    active: false 
  },
  { 
    id: 'tithe', 
    name: "什一税", 
    desc: "向神职人员征税，增加收入但降低其好感。", 
    category: 'culture',
    unlockEpoch: 3,
    cost: { admin: 5 }, 
    effects: ["定期征收神职人员财富"],
    drawbacks: ["神职好感 -10"],
    active: false 
  },
  {
    id: 'colonial_charter',
    name: "殖民特许",
    desc: "授予贸易公司海外特权，贸易港收益大增。",
    category: 'economy',
    unlockEpoch: 4,
    cost: { admin: 12 },
    effects: ["贸易港 +15%", "每日 +1 银币"],
    drawbacks: ["全局生产 -3%"],
    modifiers: { buildings: { trade_port: 0.15 }, passive: { silver: 1 }, production: -0.03 },
    active: false,
  },
  {
    id: 'press_freedom',
    name: "出版自由",
    desc: "允许民间刊物畅行，文化与舆论活跃。",
    category: 'culture',
    unlockEpoch: 5,
    cost: { admin: 10 },
    effects: ["咖啡馆、印刷所产出 +10%~15%"],
    drawbacks: ["税收效率 -5%"],
    modifiers: { buildings: { coffee_house: 0.1, printing_house: 0.15 }, taxIncome: -0.05 },
    active: false,
  },
  {
    id: 'workers_compact',
    name: "工人公约",
    desc: "改善工人待遇，换取工厂稳定运转。",
    category: 'social',
    unlockEpoch: 6,
    cost: { admin: 12 },
    effects: ["工业建筑 +10% 产出"],
    drawbacks: ["每日 -1 银币"],
    modifiers: { categories: { industry: 0.1 }, passive: { silver: -1 } },
    active: false 
  },
];
