// 建筑配置文件
// 定义游戏中的所有建筑及其属性

/**
 * 建筑配置数组
 * 每个建筑包含：
 * - id: 建筑唯一标识
 * - name: 建筑名称
 * - desc: 建筑描述
 * - baseCost: 基础建造成本
 * - output: 产出资源（每秒）
 * - input: 消耗资源（每秒）
 * - jobs: 提供的工作岗位
 * - epoch: 解锁时代
 * - cat: 建筑类别（gather/industry/civic/military）
 * - visual: 视觉效果配置
 */
export const BUILDINGS = [
  // ========== 采集与农业建筑 ==========
  { 
    id: 'farm', 
    name: "农田", 
    desc: "提供自耕农岗位。", 
    baseCost: { wood: 10 }, 
    output: { food: 4 }, 
    jobs: { peasant: 2 }, 
    epoch: 0, 
    cat: 'gather', 
    visual: { icon: 'Wheat', color: 'bg-yellow-700', text: 'text-yellow-200' } 
  },
  
  { 
    id: 'large_estate', 
    name: "庄园", 
    desc: "地主控制的土地，雇佣佃农。", 
    baseCost: { wood: 100, gold: 50 }, 
    output: { food: 10 }, 
    jobs: { serf: 6, landowner: 1 }, 
    epoch: 1, 
    cat: 'gather', 
    visual: { icon: 'Castle', color: 'bg-amber-800', text: 'text-amber-200' } 
  },
  
  { 
    id: 'lumber_camp', 
    name: "伐木场", 
    desc: "砍伐木材。", 
    baseCost: { food: 15 }, 
    output: { wood: 2 }, 
    jobs: { peasant: 2 }, 
    epoch: 0, 
    cat: 'gather', 
    visual: { icon: 'Trees', color: 'bg-emerald-800', text: 'text-emerald-200' } 
  },
  
  { 
    id: 'quarry', 
    name: "采石场", 
    desc: "开采石料，早期使用奴隶。", 
    baseCost: { wood: 50 }, 
    output: { stone: 1 }, 
    jobs: { slave: 3 }, 
    epoch: 0, 
    cat: 'gather', 
    visual: { icon: 'Pickaxe', color: 'bg-stone-600', text: 'text-stone-200' } 
  },
  
  { 
    id: 'mine', 
    name: "深井矿", 
    desc: "开采铁矿，条件恶劣。", 
    baseCost: { plank: 100, food: 200 }, 
    output: { iron: 1 }, 
    jobs: { slave: 5 }, 
    epoch: 1, 
    cat: 'gather', 
    visual: { icon: 'Settings', color: 'bg-zinc-700', text: 'text-zinc-300' } 
  },

  // ========== 居住与行政建筑 ==========
  { 
    id: 'hut', 
    name: "简陋小屋", 
    desc: "增加人口上限。", 
    baseCost: { wood: 20, food: 20 }, 
    output: { maxPop: 3 }, 
    epoch: 0, 
    cat: 'civic', 
    visual: { icon: 'Tent', color: 'bg-orange-800', text: 'text-orange-200' } 
  },
  
  { 
    id: 'house', 
    name: "木屋", 
    desc: "增加更多人口。", 
    baseCost: { plank: 20, food: 100 }, 
    output: { maxPop: 6 }, 
    epoch: 1, 
    cat: 'civic', 
    visual: { icon: 'Home', color: 'bg-amber-700', text: 'text-amber-100' } 
  },
  
  { 
    id: 'town_hall', 
    name: "市政厅", 
    desc: "官员办公地，增加行政容量。", 
    baseCost: { brick: 200, plank: 200 }, 
    output: { admin: 10 }, 
    jobs: { official: 5 }, 
    epoch: 2, 
    cat: 'civic', 
    visual: { icon: 'Scale', color: 'bg-slate-800', text: 'text-slate-200' } 
  },
  
  { 
    id: 'barracks', 
    name: "兵营", 
    desc: "训练士兵，增加军事力量。", 
    baseCost: { stone: 100, food: 200 }, 
    jobs: { soldier: 5 }, 
    epoch: 1, 
    cat: 'military', 
    visual: { icon: 'Swords', color: 'bg-red-900', text: 'text-red-200' } 
  },
  
  { 
    id: 'church', 
    name: "教堂", 
    desc: "安抚民心，产出文化。", 
    baseCost: { stone: 150, gold: 50 }, 
    output: { culture: 2 }, 
    jobs: { cleric: 3 }, 
    epoch: 1, 
    cat: 'civic', 
    visual: { icon: 'Cross', color: 'bg-purple-900', text: 'text-purple-200' } 
  },

  // ========== 工业产业链建筑 ==========
  { 
    id: 'sawmill', 
    name: "锯木厂", 
    desc: "加工木材，需要工人。", 
    baseCost: { wood: 100, stone: 20 }, 
    input: { wood: 3 }, 
    output: { plank: 1.5 }, 
    jobs: { worker: 3 }, 
    epoch: 0, 
    cat: 'industry', 
    visual: { icon: 'Hammer', color: 'bg-amber-900', text: 'text-amber-300' } 
  },
  
  { 
    id: 'brickworks', 
    name: "砖窑", 
    desc: "烧制砖块。", 
    baseCost: { wood: 150, stone: 100 }, 
    input: { stone: 3, wood: 1 }, 
    output: { brick: 1.5 }, 
    jobs: { worker: 3 }, 
    epoch: 1, 
    cat: 'industry', 
    visual: { icon: 'Factory', color: 'bg-red-900', text: 'text-red-300' } 
  },
  
  { 
    id: 'factory', 
    name: "工厂", 
    desc: "工业化生产，资本家管理。", 
    baseCost: { brick: 500, iron: 200 }, 
    input: { iron: 2, wood: 2 }, 
    output: { tools: 2 }, 
    jobs: { worker: 10, capitalist: 1 }, 
    epoch: 3, 
    cat: 'industry', 
    visual: { icon: 'Factory', color: 'bg-blue-900', text: 'text-blue-200' } 
  },

  // ========== 科研与市场建筑 ==========
  { 
    id: 'library', 
    name: "图书馆", 
    desc: "研究科技。", 
    baseCost: { wood: 200, stone: 50 }, 
    output: { science: 2 }, 
    jobs: { cleric: 2, official: 1 }, 
    epoch: 0, 
    cat: 'civic', 
    visual: { icon: 'Landmark', color: 'bg-cyan-800', text: 'text-cyan-200' } 
  },
  
  { 
    id: 'market', 
    name: "市场", 
    desc: "贸易中心。", 
    baseCost: { plank: 100 }, 
    output: { gold: 2 }, 
    jobs: { peasant: 2 }, 
    epoch: 1, 
    cat: 'civic', 
    visual: { icon: 'Handshake', color: 'bg-yellow-800', text: 'text-yellow-200' } 
  },
];
