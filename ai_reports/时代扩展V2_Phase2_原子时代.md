# Phase 2：原子时代（epoch 8）完整配置

> 依赖 Phase 1 完成。本阶段新增 epoch 8 + technician 阶层。

---

## 一、epochs.js 新增

```javascript
{
    id: 8,
    name: "原子时代",
    desc: "核能释放、电子革命、塑料帝国。人类文明进入超级工业化阶段。",
    yearRange: "1945-1990",
    color: "violet",
    tileColor: "violet-600",
    bgGradient: "from-violet-900 via-purple-800 to-indigo-900",
    bonuses: { gatherBonus: 2.8, industryBonus: 3.5, scienceBonus: 2.5 },
    req: { science: 50000, population: 1200, culture: 12000 },
    cost: { silver: 10000, oil: 80, wiring: 30, chemicals: 20 },
    unlocks: [
        "核能发电",
        "晶体管与电子工业",
        "塑料与高分子材料",
        "制药工业",
        "铝材冶炼"
    ]
}
```

---

## 二、新增资源（gameConstants.js）

### 2.1 塑料（plastics）

```javascript
plastics: {
    name: "塑料",
    icon: 'Box',
    color: "text-blue-300",
    basePrice: 15.0,
    minPrice: 0.15,
    maxPrice: 1500,
    defaultOwner: 'engineer',
    unlockEpoch: 8,
    unlockTech: 'polymer_chemistry',
    tags: ['intermediate', 'industrial'],
    marketConfig: {
        supplyDemandWeight: 1.0,
        inventoryTargetDays: 90.0,
        inventoryPriceImpact: 0.3,
        demandElasticity: 0.5,
        outputVariation: 0.2
    }
},
```

### 2.2 电子元件（electronics）

```javascript
electronics: {
    name: "电子元件",
    icon: 'Cpu',
    color: "text-emerald-300",
    basePrice: 40.0,
    minPrice: 0.4,
    maxPrice: 4000,
    defaultOwner: 'engineer',
    unlockEpoch: 8,
    unlockTech: 'integrated_circuits',
    tags: ['intermediate', 'manufactured'],
    // 多链枢纽：家电/军工/半导体共享
    marketConfig: {
        supplyDemandWeight: 1.2,
        inventoryTargetDays: 60.0,
        inventoryPriceImpact: 0.35,
        demandElasticity: 0.6,
        outputVariation: 0.2
    }
},
```

### 2.3 铀矿（uranium）

```javascript
uranium: {
    name: "铀矿",
    icon: 'Atom',
    color: "text-lime-400",
    basePrice: 12.0,
    minPrice: 0.12,
    maxPrice: 1200,
    defaultOwner: 'official',
    unlockEpoch: 8,
    unlockTech: 'nuclear_physics',
    tags: ['raw_material', 'strategic'],
    marketConfig: {
        supplyDemandWeight: 0.8,
        inventoryTargetDays: 180.0,
        inventoryPriceImpact: 0.2,
        demandElasticity: 0.3,
        outputVariation: 0.15
    }
},
```

### 2.4 铝材（aluminum）

```javascript
aluminum: {
    name: "铝材",
    icon: 'Layers',
    color: "text-slate-300",
    basePrice: 22.0,
    minPrice: 0.22,
    maxPrice: 2200,
    defaultOwner: 'engineer',
    unlockEpoch: 8,
    unlockTech: 'aluminum_smelting',
    tags: ['intermediate', 'industrial'],
    marketConfig: {
        supplyDemandWeight: 1.0,
        inventoryTargetDays: 80.0,
        inventoryPriceImpact: 0.3,
        demandElasticity: 0.5,
        outputVariation: 0.2
    }
},
```

### 2.5 医药（medicine）

```javascript
medicine: {
    name: "医药",
    icon: 'Pill',
    color: "text-red-300",
    basePrice: 35.0,
    minPrice: 0.35,
    maxPrice: 3500,
    defaultOwner: 'engineer',
    unlockEpoch: 8,
    unlockTech: 'pharmaceutical_industry',
    tags: ['manufactured', 'consumer'],
    marketConfig: {
        supplyDemandWeight: 1.1,
        inventoryTargetDays: 60.0,
        inventoryPriceImpact: 0.35,
        demandElasticity: 0.7,
        outputVariation: 0.2
    }
},
```

---

## 三、新增阶层：technician（技术工人）

### 3.1 strata.js 新增

```javascript
{
    id: 'technician',
    name: '技术工人',
    desc: '操作电子和化工设备的熟练技术人员，是现代工业的骨干力量。',
    epoch: 8,
    tier: 2,        // 中产阶级
    weight: 3,
    taxContribution: 3,
    influenceBase: 3,
    defaultResource: 'tools',
    startingWealth: 120,
    needs: {
        food: 1.0,
        cloth: 0.5
    },
    luxuryNeeds: {
        0.3: { tools: 0.3 },
        0.5: { coffee: 0.2 },
        0.8: { medicine: 0.1 },
        1.5: { furniture: 0.1, ale: 0.1 }
    },
    // buff/debuff
    happyThreshold: 85,
    happyNeedSatisfaction: 0.9,
    happyEffect: { industryBonus: 0.15 },
    happyBuffName: "技术精湛",
    unhappyThreshold: 40,
    unhappyInfluenceReq: 0.2,
    unhappyEffect: { industryBonus: -0.10, stability: -0.1 },
    unhappyBuffName: "技术人员怠工"
},
```

### 3.2 constants.js 注册

```javascript
// ROLE_PRIORITY 中，在 worker 和 artisan 之间插入 technician
export const ROLE_PRIORITY = [
    'official', 'cleric', 'capitalist', 'landowner', 'engineer',
    'navigator', 'merchant', 'soldier', 'scribe',
    'technician',  // ← 新增
    'worker', 'artisan', 'miner', 'lumberjack', 'serf', 'peasant'
];

// STRATUM_TIERS 中
export const STRATUM_TIERS = {
    0: ['unemployed', 'serf'],
    1: ['peasant', 'lumberjack', 'miner', 'worker'],
    2: ['artisan', 'soldier', 'navigator', 'scribe', 'merchant', 'cleric', 'technician'],  // ← 新增
    3: ['official', 'landowner', 'capitalist', 'engineer']
};
```

---

## 四、新增建筑（buildings.js）

### epoch 8 建筑列表（11 座）

#### 4.1 铀矿（uranium_mine）— 采集

```javascript
{
    id: 'uranium_mine',
    name: '铀矿',
    desc: '在地质稳定区开采铀矿石，为核电站提供燃料。',
    epoch: 8,
    cat: 'gather',
    requiresTech: 'nuclear_physics',
    baseCost: { silver: 2500, steel: 30, tools: 15 },
    input: {},
    output: { uranium: 0.6 },
    jobs: { miner: 6, worker: 3, official: 1 },
    owner: 'official',
    visual: { icon: 'Atom', color: 'lime-400' },
    marketConfig: { inventoryTargetDays: 180 }
},
```

#### 4.2 核电站（nuclear_power_plant）— 能源

```javascript
{
    id: 'nuclear_power_plant',
    name: '核电站',
    desc: '利用核裂变释放巨大能量发电。需要钢铁容器和石料屏蔽层。',
    epoch: 8,
    cat: 'industry',
    requiresTech: 'nuclear_power',
    baseCost: { silver: 8000, steel: 80, stone: 100, brick: 50 },
    input: { uranium: 0.2, steel: 0.1, stone: 0.1 },
    output: { electricity: 4.0 },
    jobs: { technician: 6, engineer: 3, official: 1 },
    owner: 'official',
    visual: { icon: 'Atom', color: 'lime-500' },
    marketConfig: { inventoryTargetDays: 200 }
},
```

**设计说明**：
- 产出 4.0 electricity/tick，是燃煤电厂（1.5）的 2.67 倍
- 消耗 steel 和 stone 作为维护材料，让这两种旧资源在原子时代有持续需求
- 建造成本极高（8000 银币），是时代标志性建筑
- 由 official 拥有（国有核电概念），由 technician 操作

#### 4.3 塑料工厂（plastics_factory）— 化工

```javascript
{
    id: 'plastics_factory',
    name: '塑料厂',
    desc: '将化学品和石油聚合为各种塑料制品。',
    epoch: 8,
    cat: 'industry',
    requiresTech: 'polymer_chemistry',
    baseCost: { silver: 2800, steel: 20, chemicals: 10 },
    input: { chemicals: 0.4, oil: 0.3 },
    output: { plastics: 0.5 },
    jobs: { worker: 5, technician: 3, engineer: 1 },
    owner: 'engineer',
    visual: { icon: 'Box', color: 'blue-300' },
    marketConfig: { inventoryTargetDays: 90 }
},
```

**设计说明**：
- 原料成本 = 0.4×18 + 0.3×8 = 7.2+2.4 = 9.6
- 产出价值 = 0.5×15 = 7.5
- ⚠️ 初始看似微亏，但 chemicals 市场价通常低于 basePrice（供给充足时），实际利润为正
- 3 个 technician 岗位是该阶层的主要就业出口

#### 4.4 电子工厂（electronics_factory）— 关键加工

```javascript
{
    id: 'electronics_factory',
    name: '电子工厂',
    desc: '将铜、电缆、化学品和石英砂（硅）加工为电子元件。原子时代的心脏。',
    epoch: 8,
    cat: 'industry',
    requiresTech: 'integrated_circuits',
    baseCost: { silver: 4000, steel: 25, wiring: 15, chemicals: 10 },
    input: { copper: 0.3, wiring: 0.3, chemicals: 0.2, stone: 0.2 },
    output: { electronics: 0.3 },
    jobs: { technician: 5, worker: 4, engineer: 2 },
    owner: 'engineer',
    visual: { icon: 'Cpu', color: 'emerald-300' },
    marketConfig: { inventoryTargetDays: 60 }
},
```

**设计说明**：
- 原料成本 = 0.3×5.5 + 0.3×14 + 0.2×18 + 0.2×3 = 1.65+4.2+3.6+0.6 = 10.05
- 产出价值 = 0.3×40 = 12.0
- 毛利 = 1.95/tick，合理
- **关键**：消耗 copper + stone（硅砂），让铜和石料在原子时代仍是核心投入
- **5 个 technician 岗位**——这是 technician 阶层的最大雇主

#### 4.5 制药厂（pharmaceutical_plant）— 消费品

```javascript
{
    id: 'pharmaceutical_plant',
    name: '制药厂',
    desc: '用化学品和药典研究（纸张）制造现代医药。纸张在此获得新生。',
    epoch: 8,
    cat: 'industry',
    requiresTech: 'pharmaceutical_industry',
    baseCost: { silver: 3200, steel: 15, chemicals: 8 },
    input: { chemicals: 0.3, papyrus: 0.2 },
    output: { medicine: 0.25 },
    jobs: { technician: 3, scribe: 2, engineer: 1 },
    owner: 'engineer',
    visual: { icon: 'Pill', color: 'red-300' },
    marketConfig: { inventoryTargetDays: 60 }
},
```

**设计说明**：
- 原料成本 = 0.3×18 + 0.2×6.5 = 5.4+1.3 = 6.7
- 产出价值 = 0.25×35 = 8.75
- 毛利 = 2.05/tick
- **关键**：papyrus 代表"药学文献研究"，让纸张在原子时代有了全新的工业需求

#### 4.6 铝冶炼厂（aluminum_smelter）— 金属加工

```javascript
{
    id: 'aluminum_smelter',
    name: '铝冶炼厂',
    desc: '电解铝土矿（石料）冶炼铝材。需要大量电力和煤作为还原剂。',
    epoch: 8,
    cat: 'industry',
    requiresTech: 'aluminum_smelting',
    baseCost: { silver: 3500, steel: 25, brick: 20 },
    input: { stone: 0.5, coal: 0.3, electricity: 0.5 },
    output: { aluminum: 0.35 },
    jobs: { worker: 6, technician: 2, engineer: 1 },
    owner: 'engineer',
    visual: { icon: 'Layers', color: 'slate-300' },
    marketConfig: { inventoryTargetDays: 80 }
},
```

**设计说明**：
- 原料成本 = 0.5×3 + 0.3×7.5 + 0.5×10 = 1.5+2.25+5 = 8.75
- 产出价值 = 0.35×22 = 7.7
- ⚠️ 微亏！但 stone 价格通常远低于 basePrice（丰富资源），实际利润为正
- **关键**：stone + coal + electricity 三种资源在此交汇，让石料和煤在原子时代焕发新生

#### 4.7 家电工厂（appliance_factory）— 高级消费品

```javascript
{
    id: 'appliance_factory',
    name: '家电厂',
    desc: '用电子元件、塑料和钢材制造冰箱、洗衣机等家用电器。',
    epoch: 8,
    cat: 'industry',
    requiresTech: 'consumer_electronics',
    baseCost: { silver: 5000, steel: 30, electronics: 5 },
    input: { electronics: 0.2, plastics: 0.2, steel: 0.1 },
    output: { 
        silver: 3.0,      // 高价消费品直接产出银币
        culture: 0.08     // 消费文化
    },
    jobs: { worker: 8, technician: 3, capitalist: 1 },
    owner: 'capitalist',
    visual: { icon: 'Refrigerator', color: 'blue-200' },
    marketConfig: {}
},
```

**设计说明**：
- 类似汽车厂的"终端消费品工厂"模式
- 原料成本 = 0.2×40 + 0.2×15 + 0.1×40 = 8+3+4 = 15
- 产出 3.0 银币/tick
- 消耗 electronics + plastics + steel，三条中间品链的下游终端

#### 4.8 电视台（television_station）— 文化

```javascript
{
    id: 'television_station',
    name: '电视台',
    desc: '电子影像传播文化，比广播更具影响力。',
    epoch: 8,
    cat: 'civic',
    requiresTech: 'television_broadcasting',
    baseCost: { silver: 4000, electronics: 8, wiring: 10, steel: 10 },
    input: { electricity: 0.3, electronics: 0.05 },
    output: { culture: 0.8, science: 0.3 },
    jobs: { scribe: 4, technician: 2, engineer: 1 },
    owner: 'official',
    visual: { icon: 'Tv', color: 'purple-400' },
    marketConfig: {}
},
```

#### 4.9 高层公寓（high_rise_apartment）— 住房

```javascript
{
    id: 'high_rise_apartment',
    name: '高层公寓',
    desc: '钢筋混凝土高层住宅，容纳大量城市人口。',
    epoch: 8,
    cat: 'civic',
    requiresTech: 'high_rise_construction',
    baseCost: { silver: 3000, steel: 40, brick: 50, stone: 30 },
    input: {},
    output: { maxPop: 120 },
    jobs: { worker: 2 },
    owner: 'capitalist',
    visual: { icon: 'Building', color: 'gray-400' },
    marketConfig: {}
},
```

**设计说明**：
- maxPop 120 对比 apartment_block(epoch 6) 的 80，递增 50%
- 消耗大量 steel + brick + stone 建造，让这些旧资源有持续建设需求

#### 4.10 军工综合体（military_industrial_complex）— 军事

```javascript
{
    id: 'military_industrial_complex',
    name: '军工综合体',
    desc: '整合电子、钢铁和化学品生产现代化军事装备。',
    epoch: 8,
    cat: 'military',
    requiresTech: 'military_electronics',
    baseCost: { silver: 6000, steel: 50, electronics: 10, chemicals: 15 },
    input: { electronics: 0.15, steel: 0.2, chemicals: 0.1 },
    output: { ordnance: 0.3, militaryCapacity: 30 },
    jobs: { worker: 6, technician: 3, engineer: 2, official: 1 },
    owner: 'official',
    visual: { icon: 'Shield', color: 'red-500' },
    marketConfig: {}
},
```

---

## 五、新增科技（technologies.js）

### epoch 8 科技树（13 项）

#### 第一批（原料/基础）

```javascript
{
    id: 'nuclear_physics',
    name: '核物理',
    desc: '理解原子核结构与裂变反应原理。',
    epoch: 8,
    cost: { science: 32000, culture: 6000 },
    effects: { unlockBuilding: ['uranium_mine'] },
    prerequisites: ['electrification']
},
{
    id: 'polymer_chemistry',
    name: '高分子化学',
    desc: '合成塑料和高分子聚合物的技术突破。',
    epoch: 8,
    cost: { science: 30000, culture: 5000 },
    effects: { unlockBuilding: ['plastics_factory'] },
    prerequisites: ['organic_chemistry']
},
{
    id: 'aluminum_smelting',
    name: '铝冶炼',
    desc: '电解法大规模冶炼铝材，轻量化金属革命。',
    epoch: 8,
    cost: { science: 31000, culture: 5000 },
    effects: { unlockBuilding: ['aluminum_smelter'] },
    prerequisites: ['power_generation']
},
```

#### 第二批（中间品/加工）

```javascript
{
    id: 'transistor',
    name: '晶体管',
    desc: '固态电子器件取代真空管，电子工业的黎明。',
    epoch: 8,
    cost: { science: 35000, culture: 7000 },
    effects: {},
    prerequisites: ['electrical_wiring']
},
{
    id: 'integrated_circuits',
    name: '集成电路',
    desc: '在硅片上集成数百个晶体管，电子元件微型化革命。',
    epoch: 8,
    cost: { science: 38000, culture: 8000 },
    effects: { unlockBuilding: ['electronics_factory'] },
    prerequisites: ['transistor']
},
{
    id: 'pharmaceutical_industry',
    name: '制药工业',
    desc: '抗生素和现代药物的大规模工业化生产。',
    epoch: 8,
    cost: { science: 33000, culture: 5500 },
    effects: { unlockBuilding: ['pharmaceutical_plant'] },
    prerequisites: ['polymer_chemistry']
},
{
    id: 'nuclear_power',
    name: '核能发电',
    desc: '将受控核裂变转化为电能，能源新纪元。',
    epoch: 8,
    cost: { science: 40000, culture: 8000 },
    effects: { unlockBuilding: ['nuclear_power_plant'] },
    prerequisites: ['nuclear_physics']
},
{
    id: 'synthetic_textiles',
    name: '合成纺织',
    desc: '化纤大规模应用于纺织业，人造纤维彻底改变服装产业。',
    epoch: 8,
    cost: { science: 50000, culture: 8000 },
    effects: { unlockBuilding: ['synthetic_textile_mill'] },
    prerequisites: ['synthetic_chemistry', 'polymer_chemistry']
},
```

#### 第三批（终端/标志性）

```javascript
{
    id: 'consumer_electronics',
    name: '消费电子',
    desc: '电子元件进入千家万户，家电工业蓬勃发展。',
    epoch: 8,
    cost: { science: 42000, culture: 8000 },
    effects: { unlockBuilding: ['appliance_factory'] },
    prerequisites: ['integrated_circuits']
},
{
    id: 'television_broadcasting',
    name: '电视广播',
    desc: '影像传播革命，视觉媒体主宰大众文化。',
    epoch: 8,
    cost: { science: 36000, culture: 9000 },
    effects: { unlockBuilding: ['television_station'] },
    prerequisites: ['integrated_circuits', 'radio_broadcasting']
},
{
    id: 'high_rise_construction',
    name: '高层建筑',
    desc: '钢筋混凝土技术使摩天大楼成为可能。',
    epoch: 8,
    cost: { science: 34000, culture: 5000 },
    effects: { unlockBuilding: ['high_rise_apartment'] },
    prerequisites: ['aluminum_smelting']
},
{
    id: 'military_electronics',
    name: '军事电子化',
    desc: '电子设备应用于军事指挥和武器系统。',
    epoch: 8,
    cost: { science: 44000, culture: 7000 },
    effects: { unlockBuilding: ['military_industrial_complex'] },
    prerequisites: ['integrated_circuits']
},
{
    id: 'automation_basics',
    name: '自动化基础',
    desc: '工业自动化的初步应用，生产效率全面提升。',
    epoch: 8,
    cost: { science: 48000, culture: 10000 },
    effects: {
        categoryBonuses: { industry: 0.15, gather: 0.10 },
        buildingBonuses: {
            electronics_factory: 0.15,
            plastics_factory: 0.10,
            synthetic_textile_mill: 0.10,
            coal_power_plant: 0.10,
            nuclear_power_plant: 0.10
        }
    },
    prerequisites: ['consumer_electronics', 'military_electronics']
},
```

---

## 六、新增军事单位（militaryUnits.js）

### epoch 8 军事单位（3 种）

#### 6.1 坦克（tank）

```javascript
{
    id: 'tank',
    name: '坦克',
    desc: '钢铁洪流，地面战场的绝对王者。',
    epoch: 8,
    category: 'cavalry',
    stats: {
        attack: 85,
        defense: 80,
        speed: 6,
        morale: 70,
        supplyNeed: 3.0,
        siegePower: 15
    },
    cost: {
        silver: 800,
        machinery: 5,
        steel: 10,
        oil: 5,
        ordnance: 3
    },
    upkeep: { silver: 30, oil: 1.0 },
    requiresTech: 'military_electronics',
    size: 30
},
```

#### 6.2 战斗机（fighter_plane）

```javascript
{
    id: 'fighter_plane',
    name: '战斗机',
    desc: '制空权的象征，现代战争的关键力量。',
    epoch: 8,
    category: 'cavalry',  // 复用 cavalry 类型（高速打击）
    stats: {
        attack: 90,
        defense: 40,
        speed: 12,
        morale: 75,
        supplyNeed: 3.5,
        siegePower: 8
    },
    cost: {
        silver: 1200,
        aluminum: 8,
        oil: 5,
        electronics: 2
    },
    upkeep: { silver: 40, oil: 1.5 },
    requiresTech: 'military_electronics',
    size: 20
},
```

#### 6.3 火箭炮（rocket_artillery）

```javascript
{
    id: 'rocket_artillery',
    name: '火箭炮',
    desc: '多管火箭齐射，面积覆盖的毁灭性武器。',
    epoch: 8,
    category: 'siege',
    stats: {
        attack: 95,
        defense: 20,
        speed: 3,
        morale: 60,
        supplyNeed: 3.0,
        siegePower: 40
    },
    cost: {
        silver: 700,
        chemicals: 5,
        electronics: 2,
        steel: 5
    },
    upkeep: { silver: 25, ammunition: 2 },
    requiresTech: 'military_electronics',
    size: 25
},
```

---

## 七、建筑升级（buildingUpgrades.js）

```javascript
uranium_mine: {
    maxLevel: 2,
    upgrades: {
        1: { costMultiplier: 3.0, outputMultiplier: 1.3, name: "离心浓缩" },
        2: { costMultiplier: 6.0, outputMultiplier: 2.25, name: "气体扩散法" }
    }
},
nuclear_power_plant: {
    maxLevel: 2,
    upgrades: {
        1: { costMultiplier: 4.0, outputMultiplier: 1.3, name: "沸水反应堆" },
        2: { costMultiplier: 8.0, outputMultiplier: 2.25, name: "快中子堆" }
    }
},
plastics_factory: {
    maxLevel: 2,
    upgrades: {
        1: { costMultiplier: 2.5, outputMultiplier: 1.3, name: "注塑成型" },
        2: { costMultiplier: 5.0, outputMultiplier: 2.25, name: "吹塑挤压" }
    }
},
electronics_factory: {
    maxLevel: 2,
    upgrades: {
        1: { costMultiplier: 3.5, outputMultiplier: 1.3, name: "洁净车间" },
        2: { costMultiplier: 7.0, outputMultiplier: 2.25, name: "微米级工艺" }
    }
},
pharmaceutical_plant: {
    maxLevel: 2,
    upgrades: {
        1: { costMultiplier: 3.0, outputMultiplier: 1.3, name: "GMP标准化" },
        2: { costMultiplier: 6.0, outputMultiplier: 2.25, name: "生物制剂" }
    }
},
aluminum_smelter: {
    maxLevel: 2,
    upgrades: {
        1: { costMultiplier: 3.0, outputMultiplier: 1.3, name: "预焙阳极" },
        2: { costMultiplier: 6.0, outputMultiplier: 2.25, name: "惰性阳极" }
    }
},
appliance_factory: {
    maxLevel: 2,
    upgrades: {
        1: { costMultiplier: 3.5, outputMultiplier: 1.3, name: "模块化组装" },
        2: { costMultiplier: 7.0, outputMultiplier: 2.25, name: "智能家电" }
    }
},
television_station: {
    maxLevel: 2,
    upgrades: {
        1: { costMultiplier: 3.0, outputMultiplier: 1.3, name: "彩色广播" },
        2: { costMultiplier: 6.0, outputMultiplier: 2.25, name: "卫星转播" }
    }
},
high_rise_apartment: {
    maxLevel: 2,
    upgrades: {
        1: { costMultiplier: 3.0, outputMultiplier: 1.3, name: "电梯公寓" },
        2: { costMultiplier: 6.0, outputMultiplier: 2.25, name: "豪华公寓" }
    }
},
military_industrial_complex: {
    maxLevel: 2,
    upgrades: {
        1: { costMultiplier: 4.0, outputMultiplier: 1.3, name: "精确制造" },
        2: { costMultiplier: 8.0, outputMultiplier: 2.25, name: "模块化军工" }
    }
},
```

---

## 八、产业链更新（industryChains.js）

### 8.1 新增：electronics_chain

```javascript
electronics_chain: {
    name: '电子产业',
    stages: [
        { name: '铜矿开采', buildings: ['copper_mine', 'advanced_copper_mine'], epochRange: [1, 9] },
        { name: '电缆制造', buildings: ['wiring_factory'], epochRange: [7, 9] },
        { name: '电子元件', buildings: ['electronics_factory'], epochRange: [8, 9], bottleneck: '铜/化学品供给' },
    ]
},
```

### 8.2 延长：petrochemical_chain

追加：
```javascript
{ name: '塑料制造', buildings: ['plastics_factory'], epochRange: [8, 9], bottleneck: '化学品供给' },
```

### 8.3 延长：power_chain

追加：
```javascript
{ name: '核能发电', buildings: ['nuclear_power_plant'], epochRange: [8, 9], bottleneck: '铀供给' },
```

### 8.4 延长：textile_chain

追加：
```javascript
{ name: '化纤纺织', buildings: ['synthetic_textile_mill'], epochRange: [8, 9], bottleneck: '化纤供给',
  description: '使用化纤大规模生产高级成衣，纺织链终极节点' },
```

---

## 九、systemSynergies.js 更新

```javascript
8: {
    name: "原子时代",
    effects: {
        categoryBonuses: { industry: 0.20, gather: 0.15 },
        passivePercentGains: { silver: 0.05, science: 0.05 },
        populationGrowthModifier: 0.15
    },
    description: "核能与电子革命推动超级工业化"
},
```

---

## 十、Phase 2 验证清单

- [ ] epoch 8 在 epochs.js 中正确定义
- [ ] 5 种新资源在 gameConstants.js 中正确定义
- [ ] technician 阶层在 strata.js 中正确定义
- [ ] ROLE_PRIORITY 和 STRATUM_TIERS 已更新
- [ ] 11 座新建筑在 buildings.js 中正确定义（含化纤纺织厂）
- [ ] technician 岗位在建筑中被正确引用
- [ ] 13 项新科技在 technologies.js 中正确定义（含 synthetic_textiles）
- [ ] 3 种新军事单位可以招募
- [ ] 从 epoch 7 可以正常升级到 epoch 8
- [ ] electronics 的供需在 50 tick 后达到平衡
- [ ] technician 阶层能被正确分配岗位（非全体失业）
- [ ] medicine 作为消费品被阶层正确消费
- [ ] 核电站利润为正且 electricity 价格稳定
- [ ] 化纤纺织厂能正常生产（synthetic_fiber 供给充足时 fine_clothes 产出 8.0）
- [ ] 纺织链完整：loom_house→textile_mill→garment_factory→electric_textile_mill→synthetic_textile_mill
