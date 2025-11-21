export const GAME_SPEEDS = [1, 2, 5];

export const EPOCHS = [
  { id: 0, name: "石器时代", color: "text-stone-400", bg: "bg-stone-900", tileColor: "bg-stone-700", req: { science: 0 } },
  { id: 1, name: "青铜时代", color: "text-orange-400", bg: "bg-orange-950", tileColor: "bg-orange-800", req: { science: 500, population: 20 } },
  { id: 2, name: "封建时代", color: "text-blue-400", bg: "bg-blue-950", tileColor: "bg-blue-800", req: { science: 2000, population: 100, culture: 500 } },
  { id: 3, name: "工业时代", color: "text-gray-200", bg: "bg-gray-800", tileColor: "bg-gray-600", req: { science: 10000, population: 500, culture: 2000 } },
  { id: 4, name: "信息时代", color: "text-purple-400", bg: "bg-purple-950", tileColor: "bg-purple-800", req: { science: 50000, population: 2000, culture: 10000 } },
];

export const STRATA = {
  slave: { name: "奴隶", icon: 'UserCog', weight: 0.1, tax: 0, admin: 0.5, desc: "无权利的劳动力，提供高产出但降低稳定度。" },
  peasant: { name: "自耕农", icon: 'Wheat', weight: 1, tax: 1, admin: 1, desc: "社会的基础，提供稳定的粮食和兵源。" },
  serf: { name: "佃农", icon: 'Users', weight: 0.5, tax: 2, admin: 0.8, desc: "依附于地主的农民，产出归地主所有。" },
  worker: { name: "工人", icon: 'Hammer', weight: 2, tax: 3, admin: 1.5, desc: "工业时代的基石，推动生产力发展。" },
  soldier: { name: "军人", icon: 'Swords', weight: 3, tax: 1, admin: 2, desc: "维护国家安全，但也可能造成动荡。" },
  cleric: { name: "神职人员", icon: 'Cross', weight: 4, tax: 0.5, admin: 1, desc: "提供信仰和文化，安抚民心。" },
  official: { name: "官员", icon: 'ScrollText', weight: 5, tax: 2, admin: -5, desc: "行政管理者，增加行政容量。" },
  landowner: { name: "地主", icon: 'Castle', weight: 10, tax: 5, admin: 3, desc: "传统精英，掌控土地和农业。" },
  capitalist: { name: "资本家", icon: 'Briefcase', weight: 15, tax: 8, admin: 4, desc: "工业精英，提供投资和工业加成。" },
  knight: { name: "骑士", icon: 'Shield', weight: 8, tax: 2, admin: 2, desc: "军事贵族，强大的战斗力。" },
};

export const RESOURCES = {
  food: { name: "粮食", icon: 'Wheat', color: "text-yellow-400" },
  wood: { name: "木材", icon: 'Trees', color: "text-emerald-400" },
  stone: { name: "石料", icon: 'Pickaxe', color: "text-stone-400" },
  plank: { name: "木板", icon: 'Hammer', color: "text-amber-600" },
  brick: { name: "砖块", icon: 'Home', color: "text-red-400" },
  iron: { name: "铁矿", icon: 'Pickaxe', color: "text-zinc-400" },
  tools: { name: "工具", icon: 'Anvil', color: "text-blue-300" },
  gold: { name: "黄金", icon: 'Crown', color: "text-yellow-300" },
  science: { name: "科研", icon: 'Cpu', color: "text-cyan-400" },
  culture: { name: "文化", icon: 'ScrollText', color: "text-pink-400" },
  admin: { name: "行政力", icon: 'Scale', color: "text-purple-300", type: 'virtual' },
};

export const COUNTRIES = [
  { id: 'empire', name: "大秦帝国", type: "军事专制", color: "text-red-400", desc: "好战的邻居，拥有强大的军队。" },
  { id: 'republic', name: "威尼斯共和国", type: "商业共和", color: "text-blue-400", desc: "富有的商人国家，贸易繁荣。" },
  { id: 'theocracy', name: "教皇国", type: "神权政治", color: "text-purple-400", desc: "宗教圣地，文化影响力巨大。" }
];

export const BUILDINGS = [
  // 采集与农业
  { id: 'farm', name: "农田", desc: "提供自耕农岗位。", baseCost: { wood: 10 }, output: { food: 4 }, jobs: { peasant: 2 }, epoch: 0, cat: 'gather', visual: { icon: 'Wheat', color: 'bg-yellow-700', text: 'text-yellow-200' } },
  { id: 'large_estate', name: "庄园", desc: "地主控制的土地，雇佣佃农。", baseCost: { wood: 100, gold: 50 }, output: { food: 10 }, jobs: { serf: 6, landowner: 1 }, epoch: 1, cat: 'gather', visual: { icon: 'Castle', color: 'bg-amber-800', text: 'text-amber-200' } },
  { id: 'lumber_camp', name: "伐木场", desc: "砍伐木材。", baseCost: { food: 15 }, output: { wood: 2 }, jobs: { peasant: 2 }, epoch: 0, cat: 'gather', visual: { icon: 'Trees', color: 'bg-emerald-800', text: 'text-emerald-200' } },
  { id: 'quarry', name: "采石场", desc: "开采石料，早期使用奴隶。", baseCost: { wood: 50 }, output: { stone: 1 }, jobs: { slave: 3 }, epoch: 0, cat: 'gather', visual: { icon: 'Pickaxe', color: 'bg-stone-600', text: 'text-stone-200' } },

  // 居住与行政
  { id: 'hut', name: "简陋小屋", desc: "增加人口上限。", baseCost: { wood: 20, food: 20 }, output: { maxPop: 3 }, epoch: 0, cat: 'civic', visual: { icon: 'Tent', color: 'bg-orange-800', text: 'text-orange-200' } },
  { id: 'house', name: "木屋", desc: "增加更多人口。", baseCost: { plank: 20, food: 100 }, output: { maxPop: 6 }, epoch: 1, cat: 'civic', visual: { icon: 'Home', color: 'bg-amber-700', text: 'text-amber-100' } },
  { id: 'town_hall', name: "市政厅", desc: "官员办公地，增加行政容量。", baseCost: { brick: 200, plank: 200 }, output: { admin: 10 }, jobs: { official: 5 }, epoch: 2, cat: 'civic', visual: { icon: 'Scale', color: 'bg-slate-800', text: 'text-slate-200' } },
  { id: 'barracks', name: "兵营", desc: "训练士兵，增加军事力量。", baseCost: { stone: 100, food: 200 }, jobs: { soldier: 5 }, epoch: 1, cat: 'military', visual: { icon: 'Swords', color: 'bg-red-900', text: 'text-red-200' } },
  { id: 'church', name: "教堂", desc: "安抚民心，产出文化。", baseCost: { stone: 150, gold: 50 }, output: { culture: 2 }, jobs: { cleric: 3 }, epoch: 1, cat: 'civic', visual: { icon: 'Cross', color: 'bg-purple-900', text: 'text-purple-200' } },

  // 工业产业链
  { id: 'sawmill', name: "锯木厂", desc: "加工木材，需要工人。", baseCost: { wood: 100, stone: 20 }, input: { wood: 3 }, output: { plank: 1.5 }, jobs: { worker: 3 }, epoch: 0, cat: 'industry', visual: { icon: 'Hammer', color: 'bg-amber-900', text: 'text-amber-300' } },
  { id: 'brickworks', name: "砖窑", desc: "烧制砖块。", baseCost: { wood: 150, stone: 100 }, input: { stone: 3, wood: 1 }, output: { brick: 1.5 }, jobs: { worker: 3 }, epoch: 1, cat: 'industry', visual: { icon: 'Factory', color: 'bg-red-900', text: 'text-red-300' } },
  { id: 'mine', name: "深井矿", desc: "开采铁矿，条件恶劣。", baseCost: { plank: 100, food: 200 }, output: { iron: 1 }, jobs: { slave: 5 }, epoch: 1, cat: 'gather', visual: { icon: 'Settings', color: 'bg-zinc-700', text: 'text-zinc-300' } },
  { id: 'factory', name: "工厂", desc: "工业化生产，资本家管理。", baseCost: { brick: 500, iron: 200 }, input: { iron: 2, wood: 2 }, output: { tools: 2 }, jobs: { worker: 10, capitalist: 1 }, epoch: 3, cat: 'industry', visual: { icon: 'Factory', color: 'bg-blue-900', text: 'text-blue-200' } },

  // 科研与市场
  { id: 'library', name: "图书馆", desc: "研究科技。", baseCost: { wood: 200, stone: 50 }, output: { science: 2 }, jobs: { cleric: 2, official: 1 }, epoch: 0, cat: 'civic', visual: { icon: 'Landmark', color: 'bg-cyan-800', text: 'text-cyan-200' } },
  { id: 'market', name: "市场", desc: "贸易中心。", baseCost: { plank: 100 }, output: { gold: 2 }, jobs: { peasant: 2 }, epoch: 1, cat: 'civic', visual: { icon: 'Handshake', color: 'bg-yellow-800', text: 'text-yellow-200' } },
];

export const TECHS = [
  { id: 'tools', name: "基础工具", desc: "解锁锯木厂 (需木板加工)", cost: { science: 50 }, epoch: 0 },
  { id: 'wheel', name: "车轮", desc: "采集效率提升 20%", cost: { science: 150 }, epoch: 0 },
  { id: 'feudalism', name: "封建制度", desc: "解锁庄园和地主阶层", cost: { science: 300 }, epoch: 1 },
  { id: 'theology', name: "神学", desc: "解锁教堂和神职人员", cost: { science: 500 }, epoch: 1 },
  { id: 'bureaucracy', name: "官僚制度", desc: "解锁市政厅，减少行政惩罚", cost: { science: 1000 }, epoch: 2 },
  { id: 'industrialization', name: "工业化", desc: "解锁工厂和资本家", cost: { science: 5000 }, epoch: 3 },
];

export const DECREES = [
  { id: 'forced_labor', name: "强制劳动", desc: "奴隶/佃农产出+20%，但好感大幅下降。", cost: { admin: 10 }, active: false },
  { id: 'tithe', name: "什一税", desc: "向神职人员征税，增加收入但降低其好感。", cost: { admin: 5 }, active: false },
];
