# Phase 3：信息时代（epoch 9）完整配置

> 依赖 Phase 1 + Phase 2 完成。本阶段新增 epoch 9 + scientist 阶层。

---

## 一、epochs.js 新增

```javascript
{
    id: 9,
    name: "信息时代",
    desc: "硅片上的文明。半导体、互联网和可再生能源重塑人类社会。",
    yearRange: "1990-2050",
    color: "cyan",
    tileColor: "cyan-500",
    bgGradient: "from-cyan-900 via-teal-800 to-slate-900",
    bonuses: { gatherBonus: 3.5, industryBonus: 5.0, scienceBonus: 4.0 },
    req: { science: 80000, population: 1800, culture: 22000 },
    cost: { silver: 20000, electronics: 15, plastics: 20, aluminum: 10 },
    unlocks: [
        "半导体与芯片制造",
        "互联网与软件产业",
        "可再生能源",
        "复合材料",
        "生物科技"
    ]
}
```

---

## 二、新增资源（gameConstants.js）

### 2.1 半导体（semiconductors）

```javascript
semiconductors: {
    name: "半导体",
    icon: 'Cpu',
    color: "text-teal-300",
    basePrice: 80.0,
    minPrice: 0.8,
    maxPrice: 8000,
    defaultOwner: 'engineer',
    unlockEpoch: 9,
    unlockTech: 'semiconductor_manufacturing',
    tags: ['manufactured', 'high_tech'],
    // 终极工业品：高波动、高弹性
    marketConfig: {
        supplyDemandWeight: 1.3,
        inventoryTargetDays: 40.0,
        inventoryPriceImpact: 0.4,
        demandElasticity: 0.7,
        outputVariation: 0.2
    }
},
```

### 2.2 软件（software）

```javascript
software: {
    name: "软件",
    icon: 'Code',
    color: "text-blue-400",
    basePrice: 50.0,
    minPrice: 0.5,
    maxPrice: 5000,
    defaultOwner: 'capitalist',
    unlockEpoch: 9,
    unlockTech: 'software_engineering',
    tags: ['manufactured', 'high_tech'],
    // 数字产品：高利润、高弹性
    marketConfig: {
        supplyDemandWeight: 1.2,
        inventoryTargetDays: 50.0,
        inventoryPriceImpact: 0.35,
        demandElasticity: 0.8,
        outputVariation: 0.15
    }
},
```

### 2.3 复合材料（composites）

```javascript
composites: {
    name: "复合材料",
    icon: 'Hexagon',
    color: "text-indigo-300",
    basePrice: 45.0,
    minPrice: 0.45,
    maxPrice: 4500,
    defaultOwner: 'engineer',
    unlockEpoch: 9,
    unlockTech: 'composite_materials',
    tags: ['manufactured', 'high_tech'],
    marketConfig: {
        supplyDemandWeight: 1.1,
        inventoryTargetDays: 50.0,
        inventoryPriceImpact: 0.35,
        demandElasticity: 0.6,
        outputVariation: 0.2
    }
},
```

---

## 三、新增阶层：scientist（科学家）

### 3.1 strata.js 新增

```javascript
{
    id: 'scientist',
    name: '科学家',
    desc: '顶尖知识工作者，推动基础研究与技术创新。信息时代的智力引擎。',
    epoch: 9,
    tier: 3,        // 上层阶级
    weight: 2,
    taxContribution: 4,
    influenceBase: 5,
    defaultResource: 'papyrus',
    startingWealth: 300,
    needs: {
        food: 1.0,
        cloth: 0.5
    },
    luxuryNeeds: {
        0.3: { coffee: 0.3, papyrus: 0.2 },
        0.5: { furniture: 0.2, medicine: 0.1 },
        0.8: { electronics: 0.05, software: 0.05 },
        1.5: { ale: 0.1, fine_clothes: 0.1 }
    },
    // buff/debuff
    happyThreshold: 85,
    happyNeedSatisfaction: 0.9,
    happyEffect: { scienceBonus: 0.20 },
    happyBuffName: "学术繁荣",
    unhappyThreshold: 40,
    unhappyInfluenceReq: 0.15,
    unhappyEffect: { scienceBonus: -0.15, stability: -0.15 },
    unhappyBuffName: "学者出走"
},
```

### 3.2 constants.js 注册

```javascript
// ROLE_PRIORITY 中，在 engineer 后插入 scientist
export const ROLE_PRIORITY = [
    'official', 'cleric', 'capitalist', 'landowner', 'engineer',
    'scientist',     // ← 新增
    'navigator', 'merchant', 'soldier', 'scribe',
    'technician',
    'worker', 'artisan', 'miner', 'lumberjack', 'serf', 'peasant'
];

// STRATUM_TIERS 中
export const STRATUM_TIERS = {
    0: ['unemployed', 'serf'],
    1: ['peasant', 'lumberjack', 'miner', 'worker'],
    2: ['artisan', 'soldier', 'navigator', 'scribe', 'merchant', 'cleric', 'technician'],
    3: ['official', 'landowner', 'capitalist', 'engineer', 'scientist']  // ← 新增
};
```

---

## 四、新增建筑（buildings.js）

### epoch 9 建筑列表（10 座）

#### 4.1 半导体工厂（semiconductor_fab）— 尖端制造

```javascript
{
    id: 'semiconductor_fab',
    name: '半导体工厂',
    desc: '在无尘室中将硅片蚀刻为芯片。铜从青铜时代走到了信息时代的终极用途。',
    epoch: 9,
    cat: 'industry',
    requiresTech: 'semiconductor_manufacturing',
    baseCost: { silver: 12000, steel: 60, electronics: 20, chemicals: 15 },
    input: { electronics: 0.3, chemicals: 0.2, copper: 0.2, stone: 0.1 },
    output: { semiconductors: 0.15 },
    jobs: { technician: 6, scientist: 3, engineer: 2 },
    owner: 'capitalist',
    visual: { icon: 'Cpu', color: 'teal-300' },
    marketConfig: { inventoryTargetDays: 40 }
},
```

**设计说明**：
- 终极超长链终端：copper(epoch 1)→wiring(epoch 7)→electronics(epoch 8)→semiconductors(epoch 9)
- 原料成本 = 0.3×40 + 0.2×18 + 0.2×5.5 + 0.1×3 = 12+3.6+1.1+0.3 = 17.0
- 产出价值 = 0.15×80 = 12.0
- ⚠️ basePrice 计算看似亏损，但半导体市场价在供不应求时远高于 basePrice（80→120+）
- **标志性建筑**：建造半导体工厂是信息时代最重要的里程碑

#### 4.2 软件公司（software_company）— 信息产业

```javascript
{
    id: 'software_company',
    name: '软件公司',
    desc: '开发各种软件产品和服务，知识经济的核心。',
    epoch: 9,
    cat: 'industry',
    requiresTech: 'software_engineering',
    baseCost: { silver: 6000, electronics: 10 },
    input: { semiconductors: 0.05, electricity: 0.3 },
    output: { software: 0.2, science: 0.3 },
    jobs: { scientist: 4, scribe: 3, capitalist: 1 },
    owner: 'capitalist',
    visual: { icon: 'Code', color: 'blue-400' },
    marketConfig: { inventoryTargetDays: 50 }
},
```

**设计说明**：
- 低原料消耗、高价值产出——符合软件行业"高毛利"特征
- 原料成本 = 0.05×80 + 0.3×10 = 4+3 = 7.0
- 产出价值 = 0.2×50 + 0.3×5 = 10+1.5 = 11.5
- 毛利 = 4.5/tick
- 4 个 scientist 岗位——scientist 阶层的最大雇主

#### 4.3 数据中心（data_center）— 信息基础设施

```javascript
{
    id: 'data_center',
    name: '数据中心',
    desc: '钢架机柜、海量存储，支撑互联网运行的物理基础。',
    epoch: 9,
    cat: 'industry',
    requiresTech: 'cloud_computing',
    baseCost: { silver: 8000, steel: 40, brick: 30, semiconductors: 5 },
    input: { semiconductors: 0.05, electricity: 0.5, steel: 0.05 },
    output: { silver: 4.0, science: 0.5 },
    jobs: { technician: 5, scientist: 2, engineer: 2 },
    owner: 'capitalist',
    visual: { icon: 'Server', color: 'gray-500' },
    marketConfig: {}
},
```

**设计说明**：
- 类似汽车厂/家电厂模式，终端建筑直接产出 silver + science
- 消耗 semiconductors + electricity + steel（旧资源持续需求）
- 大量 technician 岗位

#### 4.4 互联网平台（internet_platform）— 商业

```javascript
{
    id: 'internet_platform',
    name: '互联网平台',
    desc: '连接数十亿用户的数字平台，广告和交易收入惊人。',
    epoch: 9,
    cat: 'civic',
    requiresTech: 'internet',
    baseCost: { silver: 7000, electronics: 8, software: 3 },
    input: { software: 0.1, electricity: 0.2 },
    output: { silver: 3.5, culture: 0.5 },
    jobs: { scientist: 3, scribe: 3, merchant: 2, capitalist: 1 },
    owner: 'capitalist',
    visual: { icon: 'Globe', color: 'blue-500' },
    marketConfig: {}
},
```

#### 4.5 太阳能电站（solar_power_plant）— 清洁能源

```javascript
{
    id: 'solar_power_plant',
    name: '太阳能电站',
    desc: '利用半导体光伏板将阳光转化为电能。石料（硅砂）的终极旅程。',
    epoch: 9,
    cat: 'industry',
    requiresTech: 'solar_energy',
    baseCost: { silver: 5000, semiconductors: 8, aluminum: 15, steel: 20 },
    input: { stone: 0.1, aluminum: 0.05 },
    output: { electricity: 3.0 },
    jobs: { technician: 4, engineer: 2 },
    owner: 'engineer',
    visual: { icon: 'Sun', color: 'amber-400' },
    marketConfig: { inventoryTargetDays: 200 }
},
```

**设计说明**：
- 产出 3.0 electricity/tick，介于燃煤（1.5）和核电（4.0）之间
- 消耗 stone（硅砂）和 aluminum（框架），让石料在信息时代有了终极用途
- **石料的一生**：从石器时代的石斧原料 → 信息时代的太阳能板硅原料

#### 4.6 复合材料厂（composites_factory）— 高级材料

```javascript
{
    id: 'composites_factory',
    name: '复合材料厂',
    desc: '将塑料、铝材和化学品合成为超强复合材料。',
    epoch: 9,
    cat: 'industry',
    requiresTech: 'composite_materials',
    baseCost: { silver: 5500, aluminum: 10, plastics: 10 },
    input: { plastics: 0.3, aluminum: 0.2, chemicals: 0.1 },
    output: { composites: 0.25 },
    jobs: { technician: 4, worker: 3, engineer: 1 },
    owner: 'engineer',
    visual: { icon: 'Hexagon', color: 'indigo-300' },
    marketConfig: { inventoryTargetDays: 50 }
},
```

#### 4.7 研究院（research_institute）— 终极科研

```javascript
{
    id: 'research_institute',
    name: '研究院',
    desc: '顶级科研机构，整合半导体和学术文献（纸张）推动前沿研究。',
    epoch: 9,
    cat: 'civic',
    requiresTech: 'ai_research',
    baseCost: { silver: 10000, semiconductors: 10, electronics: 15 },
    input: { semiconductors: 0.05, electricity: 0.3, papyrus: 0.15 },
    output: { science: 2.0, culture: 0.3 },
    jobs: { scientist: 6, scribe: 3, engineer: 1 },
    owner: 'official',
    visual: { icon: 'Microscope', color: 'cyan-400' },
    marketConfig: {}
},
```

**设计说明**：
- 产出 2.0 science/tick，是全游戏最强科研建筑
- 消耗 papyrus（学术论文），让纸张在信息时代仍是"学术基础设施"
- 6 个 scientist 岗位——scientist 阶层的核心就业
- **纸张的终极用途**：从芦苇作坊(epoch 2)到研究院(epoch 9)，横跨 7 个时代

#### 4.8 金融中心（financial_center）— 高级商业

```javascript
{
    id: 'financial_center',
    name: '金融中心',
    desc: '全球金融网络的节点，海量交易产生巨额收入。',
    epoch: 9,
    cat: 'civic',
    requiresTech: 'fintech',
    baseCost: { silver: 9000, software: 5, electronics: 8, steel: 15 },
    input: { software: 0.1, electricity: 0.2 },
    output: { silver: 5.0 },
    jobs: { merchant: 4, scribe: 3, capitalist: 2 },
    owner: 'capitalist',
    visual: { icon: 'Landmark', color: 'amber-300' },
    marketConfig: {}
},
```

**设计说明**：
- 全游戏最高银币产出（5.0/tick）
- 代表金融资本主义的终极形态
- merchant 阶层在信息时代的核心就业出口

#### 4.9 生物科技中心（biotech_center）— 尖端科研

```javascript
{
    id: 'biotech_center',
    name: '生物科技中心',
    desc: '基因工程和分子生物学的前沿研究基地。',
    epoch: 9,
    cat: 'civic',
    requiresTech: 'biotech',
    baseCost: { silver: 8000, medicine: 10, electronics: 10 },
    input: { medicine: 0.1, electronics: 0.05, chemicals: 0.1 },
    output: { science: 1.5, medicine: 0.15 },
    jobs: { scientist: 5, technician: 3, engineer: 1 },
    owner: 'official',
    visual: { icon: 'Dna', color: 'green-400' },
    marketConfig: {}
},
```

#### 4.10 自动化矿场（automated_mine）— 终极采集

```javascript
{
    id: 'automated_mine',
    name: '自动化矿场',
    desc: '机器人和AI驱动的全自动采矿系统，多种矿产同时开采。',
    epoch: 9,
    cat: 'gather',
    requiresTech: 'ai_automation',
    baseCost: { silver: 6000, semiconductors: 5, machinery: 10, steel: 30 },
    input: { electricity: 0.3 },
    output: { copper: 1.0, iron: 0.5, coal: 0.8, stone: 0.8 },
    jobs: { technician: 3, engineer: 2 },
    owner: 'capitalist',
    visual: { icon: 'HardDrive', color: 'zinc-400' },
    marketConfig: {}
},
```

**设计说明**：
- 终极版采集建筑，同时产出 4 种旧原料
- 极少人力（5 人），高度自动化
- 解决信息时代的旧资源供给压力

---

## 五、新增科技（technologies.js）

### epoch 9 科技树（12 项）

#### 第一批

```javascript
{
    id: 'photolithography',
    name: '光刻技术',
    desc: '在硅片上精确蚀刻纳米级电路图案的关键技术。',
    epoch: 9,
    cost: { science: 55000, culture: 10000 },
    effects: {},
    prerequisites: ['integrated_circuits']
},
{
    id: 'semiconductor_manufacturing',
    name: '半导体制造',
    desc: '大规模集成电路的工业化生产，信息时代的基石。',
    epoch: 9,
    cost: { science: 60000, culture: 12000 },
    effects: { unlockBuilding: ['semiconductor_fab'] },
    prerequisites: ['photolithography']
},
{
    id: 'solar_energy',
    name: '太阳能发电',
    desc: '光伏效应将阳光直接转化为电能，清洁能源革命。',
    epoch: 9,
    cost: { science: 52000, culture: 8000 },
    effects: { unlockBuilding: ['solar_power_plant'] },
    prerequisites: ['semiconductor_manufacturing']
},
{
    id: 'composite_materials',
    name: '复合材料',
    desc: '碳纤维和先进聚合物的工业化应用。',
    epoch: 9,
    cost: { science: 50000, culture: 7000 },
    effects: { unlockBuilding: ['composites_factory'] },
    prerequisites: ['polymer_chemistry', 'aluminum_smelting']
},
```

#### 第二批

```javascript
{
    id: 'internet',
    name: '互联网',
    desc: '全球计算机网络连接改变信息传播方式。',
    epoch: 9,
    cost: { science: 58000, culture: 12000 },
    effects: { unlockBuilding: ['internet_platform'] },
    prerequisites: ['semiconductor_manufacturing']
},
{
    id: 'software_engineering',
    name: '软件工程',
    desc: '系统化的软件开发方法论和工具链。',
    epoch: 9,
    cost: { science: 56000, culture: 10000 },
    effects: { unlockBuilding: ['software_company'] },
    prerequisites: ['internet']
},
{
    id: 'cloud_computing',
    name: '云计算',
    desc: '将计算资源虚拟化并按需分配。',
    epoch: 9,
    cost: { science: 62000, culture: 12000 },
    effects: { unlockBuilding: ['data_center'] },
    prerequisites: ['internet', 'software_engineering']
},
{
    id: 'fintech',
    name: '金融科技',
    desc: '数字化金融服务重塑全球资本市场。',
    epoch: 9,
    cost: { science: 60000, culture: 10000 },
    effects: { unlockBuilding: ['financial_center'] },
    prerequisites: ['cloud_computing']
},
```

#### 第三批

```javascript
{
    id: 'biotech',
    name: '生物科技',
    desc: '基因编辑和分子工程开创医学新纪元。',
    epoch: 9,
    cost: { science: 65000, culture: 12000 },
    effects: { unlockBuilding: ['biotech_center'] },
    prerequisites: ['pharmaceutical_industry', 'semiconductor_manufacturing']
},
{
    id: 'ai_automation',
    name: 'AI与自动化',
    desc: '人工智能驱动的全面自动化，劳动力需求锐减。',
    epoch: 9,
    cost: { science: 70000, culture: 15000 },
    effects: { unlockBuilding: ['automated_mine'] },
    prerequisites: ['software_engineering', 'automation_basics']
},
{
    id: 'ai_research',
    name: '前沿AI研究',
    desc: '深度学习和通用人工智能的突破性进展。',
    epoch: 9,
    cost: { science: 75000, culture: 18000 },
    effects: { unlockBuilding: ['research_institute'] },
    prerequisites: ['ai_automation', 'cloud_computing']
},
{
    id: 'space_technology',
    name: '航天科技',
    desc: '复合材料和精密电子使太空探索成为可能。终极科技。',
    epoch: 9,
    cost: { science: 80000, culture: 20000 },
    effects: {
        categoryBonuses: { industry: 0.20, gather: 0.15 },
        passivePercentGains: { science: 0.10, culture: 0.05, silver: 0.05 }
    },
    prerequisites: ['composite_materials', 'ai_research']
},
```

---

## 六、新增军事单位（militaryUnits.js）

### epoch 9 军事单位（3 种）

#### 6.1 无人机（drone）

```javascript
{
    id: 'drone',
    name: '无人机',
    desc: '远程遥控的精确打击武器，零伤亡作战。',
    epoch: 9,
    category: 'cavalry',
    stats: {
        attack: 100,
        defense: 30,
        speed: 15,
        morale: 90,
        supplyNeed: 2.0,
        siegePower: 12
    },
    cost: {
        silver: 1500,
        electronics: 5,
        semiconductors: 2,
        composites: 3
    },
    upkeep: { silver: 35, electricity: 0.5 },
    requiresTech: 'ai_automation',
    size: 15
},
```

#### 6.2 精确制导导弹（guided_missile）

```javascript
{
    id: 'guided_missile',
    name: '精确制导导弹',
    desc: '卫星制导的远程精确打击武器，改变战争形态。',
    epoch: 9,
    category: 'siege',
    stats: {
        attack: 120,
        defense: 10,
        speed: 20,
        morale: 80,
        supplyNeed: 4.0,
        siegePower: 60
    },
    cost: {
        silver: 2000,
        semiconductors: 3,
        electronics: 3,
        chemicals: 5
    },
    upkeep: { silver: 50 },
    requiresTech: 'ai_research',
    size: 10
},
```

#### 6.3 网络战部队（cyber_unit）

```javascript
{
    id: 'cyber_unit',
    name: '网络战部队',
    desc: '在数字战场上作战的精英部队，瘫痪敌方基础设施。',
    epoch: 9,
    category: 'infantry',
    stats: {
        attack: 70,
        defense: 90,
        speed: 20,
        morale: 85,
        supplyNeed: 1.5,
        siegePower: 20
    },
    cost: {
        silver: 1000,
        software: 3,
        electronics: 2
    },
    upkeep: { silver: 30, electricity: 0.3 },
    requiresTech: 'ai_research',
    size: 20
},
```

---

## 七、建筑升级（buildingUpgrades.js）

```javascript
semiconductor_fab: {
    maxLevel: 2,
    upgrades: {
        1: { costMultiplier: 4.0, outputMultiplier: 1.3, name: "14nm工艺" },
        2: { costMultiplier: 8.0, outputMultiplier: 2.25, name: "3nm工艺" }
    }
},
software_company: {
    maxLevel: 2,
    upgrades: {
        1: { costMultiplier: 3.0, outputMultiplier: 1.3, name: "敏捷开发" },
        2: { costMultiplier: 6.0, outputMultiplier: 2.25, name: "AI辅助编程" }
    }
},
data_center: {
    maxLevel: 2,
    upgrades: {
        1: { costMultiplier: 3.5, outputMultiplier: 1.3, name: "虚拟化集群" },
        2: { costMultiplier: 7.0, outputMultiplier: 2.25, name: "量子计算中心" }
    }
},
internet_platform: {
    maxLevel: 2,
    upgrades: {
        1: { costMultiplier: 3.0, outputMultiplier: 1.3, name: "移动互联" },
        2: { costMultiplier: 6.0, outputMultiplier: 2.25, name: "元宇宙平台" }
    }
},
solar_power_plant: {
    maxLevel: 2,
    upgrades: {
        1: { costMultiplier: 3.0, outputMultiplier: 1.3, name: "高效单晶硅" },
        2: { costMultiplier: 6.0, outputMultiplier: 2.25, name: "钙钛矿串联" }
    }
},
composites_factory: {
    maxLevel: 2,
    upgrades: {
        1: { costMultiplier: 3.0, outputMultiplier: 1.3, name: "碳纤维增强" },
        2: { costMultiplier: 6.0, outputMultiplier: 2.25, name: "纳米复合材料" }
    }
},
research_institute: {
    maxLevel: 2,
    upgrades: {
        1: { costMultiplier: 4.0, outputMultiplier: 1.3, name: "超级计算" },
        2: { costMultiplier: 8.0, outputMultiplier: 2.25, name: "AGI研究中心" }
    }
},
financial_center: {
    maxLevel: 2,
    upgrades: {
        1: { costMultiplier: 3.5, outputMultiplier: 1.3, name: "高频交易" },
        2: { costMultiplier: 7.0, outputMultiplier: 2.25, name: "去中心化金融" }
    }
},
biotech_center: {
    maxLevel: 2,
    upgrades: {
        1: { costMultiplier: 3.5, outputMultiplier: 1.3, name: "基因编辑" },
        2: { costMultiplier: 7.0, outputMultiplier: 2.25, name: "合成生物学" }
    }
},
automated_mine: {
    maxLevel: 2,
    upgrades: {
        1: { costMultiplier: 3.0, outputMultiplier: 1.3, name: "自主采掘" },
        2: { costMultiplier: 6.0, outputMultiplier: 2.25, name: "深海/太空采矿" }
    }
},
```

---

## 八、产业链更新

### 8.1 新增：semiconductor_chain

```javascript
semiconductor_chain: {
    name: '半导体产业',
    stages: [
        { name: '铜矿开采', buildings: ['copper_mine', 'advanced_copper_mine'], epochRange: [1, 9] },
        { name: '电缆制造', buildings: ['wiring_factory'], epochRange: [7, 9] },
        { name: '电子元件', buildings: ['electronics_factory'], epochRange: [8, 9] },
        { name: '芯片制造', buildings: ['semiconductor_fab'], epochRange: [9, 9], bottleneck: '全链供给' },
        { name: '软件开发', buildings: ['software_company'], epochRange: [9, 9] },
    ]
},
```

### 8.2 延长：knowledge_chain

追加：
```javascript
{ name: '互联网', buildings: ['internet_platform'], epochRange: [9, 9] },
{ name: '前沿科研', buildings: ['research_institute'], epochRange: [9, 9] },
```

### 8.3 延长：power_chain

追加：
```javascript
{ name: '太阳能发电', buildings: ['solar_power_plant'], epochRange: [9, 9] },
```

---

## 九、systemSynergies.js 更新

```javascript
9: {
    name: "信息革命",
    effects: {
        categoryBonuses: { industry: 0.25, gather: 0.20, civic: 0.15 },
        passivePercentGains: { silver: 0.08, science: 0.10, culture: 0.05 },
        populationGrowthModifier: 0.10
    },
    description: "数字化转型与AI革命重塑一切"
},
```

---

## 十、Phase 3 验证清单

- [ ] epoch 9 在 epochs.js 中正确定义
- [ ] 3 种新资源在 gameConstants.js 中正确定义
- [ ] scientist 阶层在 strata.js 中正确定义
- [ ] ROLE_PRIORITY 和 STRATUM_TIERS 已更新
- [ ] 10 座新建筑在 buildings.js 中正确定义
- [ ] scientist 岗位在建筑中被正确引用
- [ ] 12 项新科技在 technologies.js 中正确定义
- [ ] 3 种新军事单位可以招募
- [ ] 从 epoch 8 可以正常升级到 epoch 9
- [ ] 半导体超长链（7 步）完整运行
- [ ] scientist 阶层能被正确分配岗位
- [ ] semiconductor 的价格在市场上合理波动
- [ ] software 作为消费品/产业品被正确定价
- [ ] 100 tick 经济压力测试通过
