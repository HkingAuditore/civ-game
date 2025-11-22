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
    output: { food: 3.00 }, 
    jobs: { peasant: 2 }, 
    owner: 'peasant',
    epoch: 0, 
    cat: 'gather', 
    visual: { icon: 'Wheat', color: 'bg-yellow-700', text: 'text-yellow-200' } 
  },
  
  { 
    id: 'large_estate', 
    name: "庄园", 
    desc: "地主控制的土地，雇佣佃农。", 
    baseCost: { wood: 120, plank: 20 }, 
    output: { food: 10.00 }, 
    jobs: { serf: 6, landowner: 1 }, 
    owner: 'landowner',
    epoch: 3, 
    cat: 'gather', 
    requiresTech: 'feudalism',
    visual: { icon: 'Castle', color: 'bg-amber-800', text: 'text-amber-200' } 
  },
  
  { 
    id: 'lumber_camp', 
    name: "伐木场", 
    desc: "砍伐木材。", 
    baseCost: { food: 15 }, 
    output: { wood: 2.00 }, 
    jobs: { lumberjack: 2 }, 
    owner: 'lumberjack',
    epoch: 0, 
    cat: 'gather', 
    visual: { icon: 'Trees', color: 'bg-emerald-800', text: 'text-emerald-200' } 
  },
  
  { 
    id: 'quarry', 
    name: "采石场", 
    desc: "开采石料，由矿工负责。", 
    baseCost: { wood: 50 }, 
    output: { stone: 1.50 }, 
    jobs: { miner: 2 }, 
    owner: 'landowner',
    epoch: 0, 
    cat: 'gather', 
    visual: { icon: 'Pickaxe', color: 'bg-stone-600', text: 'text-stone-200' } 
  },
  
  { 
    id: 'copper_mine', 
    name: "铜矿井", 
    desc: "开采铜矿石，是所有青铜器的基础。", 
    baseCost: { food: 120, wood: 120 }, 
    output: { copper: 0.35 }, 
    jobs: { miner: 3 }, 
    owner: 'landowner',
    epoch: 1, 
    cat: 'gather', 
    requiresTech: 'copper_mining',
    visual: { icon: 'Gem', color: 'bg-orange-700', text: 'text-orange-200' } 
  },
  
  { 
    id: 'reed_works', 
    name: "纸草田", 
    desc: "在河畔收割、晾晒用于记录知识的纸草。", 
    baseCost: { food: 140, wood: 80 }, 
    output: { papyrus: 0.40 }, 
    jobs: { peasant: 2 }, 
    owner: 'peasant',
    epoch: 2, 
    cat: 'gather', 
    requiresTech: 'papyrus_cultivation',
    visual: { icon: 'ScrollText', color: 'bg-lime-800', text: 'text-lime-200' } 
  },

  { 
    id: 'mine', 
    name: "铁矿井", 
    desc: "深入岩层采集铁矿，为武器与机器供料。", 
    baseCost: { plank: 120, food: 220 }, 
    output: { iron: 0.35 }, 
    jobs: { miner: 5 }, 
    owner: 'capitalist',
    epoch: 3, 
    cat: 'gather', 
    requiresTech: 'ironworking',
    visual: { icon: 'Mountain', color: 'bg-zinc-700', text: 'text-zinc-200' } 
  },

  { 
    id: 'coffee_plantation', 
    name: "咖啡种植园", 
    desc: "开垦远方殖民地的咖啡种植地。", 
    baseCost: { wood: 200, spice: 30 }, 
    output: { coffee: 0.40 }, 
    jobs: { serf: 4, merchant: 1 }, 
    owner: 'merchant',
    epoch: 5, 
    cat: 'gather', 
    requiresTech: 'coffee_agronomy',
    visual: { icon: 'Coffee', color: 'bg-amber-900', text: 'text-amber-200' } 
  },

  { 
    id: 'coal_mine', 
    name: "煤矿", 
    desc: "开采地下煤炭，支撑蒸汽动力。", 
    baseCost: { plank: 200, tools: 60 }, 
    output: { coal: 0.45 }, 
    jobs: { miner: 6 }, 
    owner: 'capitalist',
    epoch: 6, 
    cat: 'gather', 
    requiresTech: 'coal_gasification',
    visual: { icon: 'Flame', color: 'bg-slate-700', text: 'text-slate-100' } 
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
    desc: "以木板与砖块搭建的整洁居所。", 
    baseCost: { plank: 60, brick: 40 }, 
    output: { maxPop: 6 }, 
    epoch: 2, 
    cat: 'civic', 
    requiresTech: 'urban_planning',
    visual: { icon: 'Home', color: 'bg-amber-700', text: 'text-amber-100' } 
  },
  
  { 
    id: 'granary', 
    name: "粮仓", 
    desc: "加固的干燥粮仓，提升人口承载。", 
    baseCost: { wood: 120, brick: 40 }, 
    output: { maxPop: 6 }, 
    jobs: { worker: 1 }, 
    owner: 'official',
    epoch: 1, 
    cat: 'civic', 
    requiresTech: 'granary_architecture',
    visual: { icon: 'Boxes', color: 'bg-yellow-900', text: 'text-yellow-200' } 
  },
  
  { 
    id: 'town_hall', 
    name: "市政厅", 
    desc: "官员办公地，增加行政容量。", 
    baseCost: { brick: 200, plank: 200 }, 
    output: { admin: 3.00 }, 
    jobs: { official: 5 }, 
    epoch: 3, 
    cat: 'civic', 
    requiresTech: 'bureaucracy',
    visual: { icon: 'Scale', color: 'bg-slate-800', text: 'text-slate-200' } 
  },
  
  { 
    id: 'church', 
    name: "教堂", 
    desc: "安抚民心，产出文化。", 
    baseCost: { stone: 150, plank: 50 }, 
    output: { culture: 0.60 }, 
    jobs: { cleric: 3 }, 
    owner: 'cleric',
    epoch: 3, 
    cat: 'civic', 
    requiresTech: 'theology',
    visual: { icon: 'Cross', color: 'bg-purple-900', text: 'text-purple-200' } 
  },

  { 
    id: 'amphitheater', 
    name: "剧场", 
    desc: "古典时代的文化舞台，激发灵感。", 
    baseCost: { stone: 200, brick: 80 }, 
    output: { culture: 0.90 }, 
    jobs: { cleric: 2, peasant: 1 }, 
    owner: 'cleric',
    epoch: 2, 
    cat: 'civic', 
    requiresTech: 'amphitheater_design',
    visual: { icon: 'Music2', color: 'bg-rose-900', text: 'text-rose-200' } 
  },

  { 
    id: 'navigator_school', 
    name: "航海学院", 
    desc: "培养探索时代的开路者，产出科研文化。", 
    baseCost: { wood: 160, papyrus: 80 }, 
    output: { science: 0.60, culture: 0.20 }, 
    jobs: { navigator: 2, scribe: 1 }, 
    owner: 'official',
    epoch: 4, 
    cat: 'civic', 
    requiresTech: 'navigator_schooling',
    visual: { icon: 'Navigation', color: 'bg-cyan-900', text: 'text-cyan-200' } 
  },

  { 
    id: 'coffee_house', 
    name: "咖啡馆", 
    desc: "啜饮咖啡、交流思想的启蒙沙龙。", 
    baseCost: { plank: 140, coffee: 40 }, 
    input: { coffee: 0.20 }, 
    output: { culture: 0.80, science: 0.20 }, 
    jobs: { merchant: 2, scribe: 1 }, 
    owner: 'merchant',
    epoch: 5, 
    cat: 'civic', 
    requiresTech: 'coffeehouse_philosophy',
    visual: { icon: 'Coffee', color: 'bg-brown-900', text: 'text-amber-200' } 
  },

  { 
    id: 'rail_depot', 
    name: "铁路枢纽", 
    desc: "蒸汽时代的交通心脏，连接全国贸易。", 
    baseCost: { steel: 180, coal: 120 }, 
    input: { coal: 0.40 }, 
    output: { silver: 1.50, maxPop: 2 }, 
    jobs: { engineer: 2, merchant: 2 }, 
    owner: 'capitalist',
    epoch: 6, 
    cat: 'civic', 
    requiresTech: 'rail_network',
    visual: { icon: 'Train', color: 'bg-gray-900', text: 'text-gray-100' } 
  },

  // ========== 工业产业链建筑 ==========
  { 
    id: 'sawmill', 
    name: "锯木厂", 
    desc: "在铜制工具辅助下高效加工木板。", 
    baseCost: { wood: 80, stone: 30 }, 
    input: { wood: 0.90 }, 
    output: { plank: 0.50 }, 
    jobs: { worker: 3 }, 
    owner: 'artisan',
    epoch: 1, 
    requiresTech: 'tools',
    cat: 'industry', 
    visual: { icon: 'Hammer', color: 'bg-amber-900', text: 'text-amber-300' } 
  },
  
  { 
    id: 'brickworks', 
    name: "砖窑", 
    desc: "烧制砖块，供城墙与民宅所用。", 
    baseCost: { wood: 150, stone: 100 }, 
    input: { stone: 0.80, wood: 0.30 }, 
    output: { brick: 0.50 }, 
    jobs: { artisan: 3 }, 
    owner: 'artisan',
    epoch: 1, 
    cat: 'industry', 
    requiresTech: 'pottery',
    visual: { icon: 'Factory', color: 'bg-red-900', text: 'text-red-300' } 
  },
  
  { 
    id: 'bronze_foundry', 
    name: "青铜铸坊", 
    desc: "熔炼铜与木炭，制造精良工具。", 
    baseCost: { wood: 150, stone: 80, copper: 40 }, 
    input: { copper: 0.40, wood: 0.30 }, 
    output: { tools: 0.40 }, 
    jobs: { artisan: 4 }, 
    owner: 'artisan',
    epoch: 1, 
    cat: 'industry', 
    requiresTech: 'bronze_working',
    visual: { icon: 'Anvil', color: 'bg-orange-800', text: 'text-amber-200' } 
  },

  { 
    id: 'factory', 
    name: "工厂", 
    desc: "蒸汽驱动的流水线生产工具与机械。", 
    baseCost: { brick: 400, steel: 200 }, 
    input: { steel: 0.50, coal: 0.30 }, 
    output: { tools: 0.70 }, 
    jobs: { worker: 10, engineer: 2, capitalist: 1 }, 
    owner: 'capitalist',
    epoch: 6, 
    requiresTech: 'industrialization',
    cat: 'industry', 
    visual: { icon: 'Factory', color: 'bg-blue-900', text: 'text-blue-200' } 
  },

  { 
    id: 'printing_house', 
    name: "印刷所", 
    desc: "启蒙时代的出版重镇，大量复制知识。", 
    baseCost: { brick: 200, papyrus: 80 }, 
    input: { papyrus: 0.40, coffee: 0.10 }, 
    output: { science: 1.20 }, 
    jobs: { artisan: 2, scribe: 2 }, 
    owner: 'capitalist',
    epoch: 5, 
    cat: 'industry', 
    requiresTech: 'printing_press',
    visual: { icon: 'BookOpen', color: 'bg-indigo-900', text: 'text-indigo-200' } 
  },

  { 
    id: 'steel_foundry', 
    name: "炼钢厂", 
    desc: "以煤炭为燃料的炼钢炉，供应工业时代钢材。", 
    baseCost: { brick: 300, iron: 200 }, 
    input: { iron: 0.40, coal: 0.40 }, 
    output: { steel: 0.35 }, 
    jobs: { engineer: 3, worker: 4 }, 
    owner: 'capitalist',
    epoch: 6, 
    cat: 'industry', 
    requiresTech: 'steel_alloys',
    visual: { icon: 'Cog', color: 'bg-gray-900', text: 'text-gray-200' } 
  },

  // ========== 科研与市场建筑 ==========
  { 
    id: 'library', 
    name: "图书馆", 
    desc: "编目典籍，持续产出科研。", 
    baseCost: { wood: 200, stone: 60 }, 
    output: { science: 0.80 }, 
    jobs: { scribe: 2 }, 
    owner: 'official',
    epoch: 0, 
    cat: 'civic', 
    visual: { icon: 'Landmark', color: 'bg-cyan-800', text: 'text-cyan-200' } 
  },
  
  { 
    id: 'market', 
    name: "市场", 
    desc: "贸易中心。", 
    baseCost: { plank: 100 }, 
    output: { silver: 0.60 }, 
    jobs: { merchant: 2 }, 
    owner: 'merchant',
    epoch: 2, 
    requiresTech: 'caravan_trade',
    cat: 'civic', 
    visual: { icon: 'Handshake', color: 'bg-yellow-800', text: 'text-yellow-200' } 
  },

  { 
    id: 'dockyard', 
    name: "船坞", 
    desc: "建造远洋船队，换取异域香料。", 
    baseCost: { plank: 200, tools: 40 }, 
    input: { wood: 0.50 }, 
    output: { spice: 0.35 }, 
    jobs: { navigator: 2, worker: 2 }, 
    owner: 'merchant',
    epoch: 4, 
    cat: 'industry', 
    requiresTech: 'cartography',
    visual: { icon: 'Anchor', color: 'bg-sky-900', text: 'text-sky-200' } 
  },

  { 
    id: 'trade_port', 
    name: "贸易港", 
    desc: "汇聚香料、银币与海外特许的繁忙港口。", 
    baseCost: { plank: 220, spice: 60 }, 
    input: { spice: 0.30 }, 
    output: { silver: 1.10 }, 
    jobs: { merchant: 3 }, 
    owner: 'merchant',
    epoch: 4, 
    cat: 'civic', 
    requiresTech: 'charter_companies',
    visual: { icon: 'Ship', color: 'bg-indigo-900', text: 'text-indigo-200' } 
  },
];
