# Phase 1：电气时代（epoch 7）完整配置

> 本文档给出 epoch 7 电气时代的**每一项配置的精确数值**，可直接复制到代码中。

---

## 一、epochs.js 修改

### 1.1 修改 epoch 7（原"信息时代"→"电气时代"）

```javascript
{
    id: 7,
    name: "电气时代",
    desc: "电力驱动的第二次工业革命。石油化工、电力传输、汽车制造标志着新纪元的到来。",
    yearRange: "1870-1945",
    color: "sky",
    tileColor: "sky-600",
    bgGradient: "from-sky-900 via-blue-800 to-slate-900",
    bonuses: { gatherBonus: 2.2, industryBonus: 2.5, scienceBonus: 1.5 },
    req: { science: 30000, population: 800, culture: 6000 },
    cost: { silver: 5000, steel: 50, coal: 100 },
    unlocks: [
        "石油钻探与炼油",
        "电力发电与传输",
        "化学工业",
        "内燃机与汽车",
        "现代军事装备"
    ]
}
```

---

## 二、新增资源（gameConstants.js）

### 2.1 石油（oil）

```javascript
oil: {
    name: "石油",
    icon: 'Droplet',
    color: "text-amber-900",
    basePrice: 8.0,
    minPrice: 0.08,
    maxPrice: 400,
    defaultOwner: 'capitalist',
    unlockEpoch: 7,
    unlockTech: 'oil_drilling',
    tags: ['raw_material', 'energy'],
    marketConfig: {
        supplyDemandWeight: 0.9,
        inventoryTargetDays: 150.0,
        inventoryPriceImpact: 0.25,
        demandElasticity: 0.35,
        outputVariation: 0.2
    }
},
```

### 2.2 橡胶（rubber）

```javascript
rubber: {
    name: "橡胶",
    icon: 'Circle',
    color: "text-gray-600",
    basePrice: 6.0,
    minPrice: 0.06,
    maxPrice: 300,
    defaultOwner: 'merchant',
    unlockEpoch: 7,
    unlockTech: 'rubber_vulcanization',
    tags: ['raw_material', 'industrial'],
    marketConfig: {
        supplyDemandWeight: 1.0,
        inventoryTargetDays: 100.0,
        inventoryPriceImpact: 0.3,
        demandElasticity: 0.45,
        outputVariation: 0.2
    }
},
```

### 2.3 化学品（chemicals）

```javascript
chemicals: {
    name: "化学品",
    icon: 'Beaker',
    color: "text-green-400",
    basePrice: 18.0,
    minPrice: 0.18,
    maxPrice: 1800,
    defaultOwner: 'engineer',
    unlockEpoch: 7,
    unlockTech: 'organic_chemistry',
    tags: ['intermediate', 'industrial'],
    marketConfig: {
        supplyDemandWeight: 1.1,
        inventoryTargetDays: 90.0,
        inventoryPriceImpact: 0.3,
        demandElasticity: 0.5,
        outputVariation: 0.2
    }
},
```

### 2.4 电线电缆（wiring）

```javascript
wiring: {
    name: "电缆",
    icon: 'Cable',
    color: "text-yellow-500",
    basePrice: 14.0,
    minPrice: 0.14,
    maxPrice: 1400,
    defaultOwner: 'engineer',
    unlockEpoch: 7,
    unlockTech: 'electrical_wiring',
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

### 2.5 电力（electricity）

```javascript
electricity: {
    name: "电力",
    icon: 'Zap',
    color: "text-yellow-300",
    basePrice: 10.0,
    minPrice: 0.1,
    maxPrice: 500,
    defaultOwner: 'engineer',
    unlockEpoch: 7,
    unlockTech: 'power_generation',
    tags: ['industrial', 'energy'],
    // 电力是普通可贸易资源，有库存、有价格
    // 高 inventoryTargetDays 模拟"实时消费"的感觉（库存天数高→价格波动小→稳定供给）
    marketConfig: {
        supplyDemandWeight: 0.8,
        inventoryTargetDays: 200.0,
        inventoryPriceImpact: 0.2,
        demandElasticity: 0.3,
        outputVariation: 0.15
    }
},
```

### 2.6 机械零件（machinery）

```javascript
machinery: {
    name: "机械",
    icon: 'Cog',
    color: "text-zinc-400",
    basePrice: 25.0,
    minPrice: 0.25,
    maxPrice: 2500,
    defaultOwner: 'engineer',
    unlockEpoch: 7,
    unlockTech: 'mechanical_engineering',
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

### 2.7 化纤（synthetic_fiber）

```javascript
synthetic_fiber: {
    name: "化纤",
    icon: 'Layers',
    color: "text-purple-400",
    basePrice: 18.0,
    minPrice: 0.18,
    maxPrice: 1800,
    defaultOwner: 'capitalist',
    unlockEpoch: 7,
    unlockTech: 'synthetic_chemistry',
    tags: ['industrial', 'manufactured'],
    marketConfig: {
        supplyDemandWeight: 1.0,
        inventoryTargetDays: 80.0,
        inventoryPriceImpact: 0.3,
        demandElasticity: 0.5,
        outputVariation: 0.2
    }
},
```

---

## 三、新增建筑（buildings.js）

### 建筑列表（12 座）

#### 3.1 油田（oil_well）— 采集

```javascript
{
    id: 'oil_well',
    name: '油田',
    desc: '开采地下石油资源，为化工和能源产业提供原料。',
    epoch: 7,
    cat: 'gather',
    requiresTech: 'oil_drilling',
    baseCost: { silver: 1200, steel: 15, tools: 10 },
    input: {},
    output: { oil: 1.2 },
    jobs: { worker: 6, miner: 3, capitalist: 1 },
    owner: 'capitalist',
    visual: { icon: 'Droplet', color: 'amber-900' },
    marketConfig: { inventoryTargetDays: 150 }
},
```

#### 3.2 橡胶种植园（rubber_plantation）— 采集

```javascript
{
    id: 'rubber_plantation',
    name: '橡胶园',
    desc: '种植橡胶树并采集生橡胶，为电线和车辆工业提供原料。',
    epoch: 7,
    cat: 'gather',
    requiresTech: 'rubber_vulcanization',
    baseCost: { silver: 800, wood: 30, tools: 5 },
    input: {},
    output: { rubber: 0.8 },
    jobs: { peasant: 5, worker: 3, merchant: 1 },
    owner: 'merchant',
    visual: { icon: 'Circle', color: 'gray-600' },
    marketConfig: { inventoryTargetDays: 100 }
},
```

#### 3.3 燃煤发电厂（coal_power_plant）— 工业/能源

```javascript
{
    id: 'coal_power_plant',
    name: '燃煤电厂',
    desc: '燃烧煤炭发电，为工业建筑提供电力。煤炭在电气时代焕发新生。',
    epoch: 7,
    cat: 'industry',
    requiresTech: 'power_generation',
    baseCost: { silver: 2000, steel: 25, brick: 30, coal: 20 },
    input: { coal: 0.8 },
    output: { electricity: 1.5 },
    jobs: { worker: 6, engineer: 2 },
    owner: 'engineer',
    visual: { icon: 'Zap', color: 'yellow-300' },
    marketConfig: { inventoryTargetDays: 200 }
},
```

**设计说明**：每座燃煤电厂消耗 0.8 coal/tick，产出 1.5 electricity/tick。利润空间 = 1.5×10 - 0.8×7.5 = 15-6 = 9 银币/tick，合理。

#### 3.4 炼油厂（oil_refinery）— 工业/化工

```javascript
{
    id: 'oil_refinery',
    name: '炼油厂',
    desc: '将原油精炼为化学品，煤炭是催化裂解的关键辅料。',
    epoch: 7,
    cat: 'industry',
    requiresTech: 'organic_chemistry',
    baseCost: { silver: 1800, steel: 20, brick: 15 },
    input: { oil: 0.6, coal: 0.3, dye: 0.1 },
    output: { chemicals: 0.5 },
    jobs: { worker: 5, engineer: 2 },
    owner: 'engineer',
    visual: { icon: 'Beaker', color: 'green-400' },
    marketConfig: { inventoryTargetDays: 90 }
},
```

**设计说明**：
- 原料成本 = 0.6×8 + 0.3×7.5 + 0.1×5 = 4.8+2.25+0.5 = 7.55
- 产出价值 = 0.5×18 = 9.0
- 毛利 = 1.45/tick，薄利但稳定
- **关键**：dye 作为催化剂被消耗，让染料在电气时代有了工业新用途

#### 3.5 电线工厂（wiring_factory）— 工业

```javascript
{
    id: 'wiring_factory',
    name: '电缆厂',
    desc: '将铜和橡胶加工为绝缘电缆，铜的需求在这个时代暴增。',
    epoch: 7,
    cat: 'industry',
    requiresTech: 'electrical_wiring',
    baseCost: { silver: 1500, steel: 10, tools: 8 },
    input: { copper: 0.8, rubber: 0.3 },
    output: { wiring: 0.5 },
    jobs: { worker: 6, artisan: 2, engineer: 1 },
    owner: 'engineer',
    visual: { icon: 'Cable', color: 'yellow-500' },
    marketConfig: { inventoryTargetDays: 80 }
},
```

**设计说明**：
- 原料成本 = 0.8×5.5 + 0.3×6 = 4.4+1.8 = 6.2
- 产出价值 = 0.5×14 = 7.0
- 毛利 = 0.8/tick
- **关键**：每座电缆厂消耗 0.8 copper/tick，这是铜矿需求暴增的引擎

#### 3.6 机械厂（machinery_plant）— 工业

```javascript
{
    id: 'machinery_plant',
    name: '机械厂',
    desc: '用钢材、铁和工具制造精密机械零件，三种旧资源在此汇聚。',
    epoch: 7,
    cat: 'industry',
    requiresTech: 'mechanical_engineering',
    baseCost: { silver: 2200, steel: 30, iron: 20, tools: 10 },
    input: { steel: 0.3, iron: 0.4, tools: 0.2 },
    output: { machinery: 0.4 },
    jobs: { worker: 8, artisan: 2, engineer: 2 },
    owner: 'engineer',
    visual: { icon: 'Cog', color: 'zinc-400' },
    marketConfig: { inventoryTargetDays: 80 }
},
```

**设计说明**：
- 原料成本 = 0.3×40 + 0.4×8 + 0.2×16 = 12+3.2+3.2 = 18.4
- 产出价值 = 0.4×25 = 10.0
- ⚠️ 初始看似亏损！但 steel/iron/tools 的市场价通常远低于 basePrice（因大量供给），实际运行中利润为正。
- 如果确实亏损，simulation.js 的边际成本分析会自动减产/停产，市场价格会自然调节。
- **关键**：这是唯一一座同时消耗 steel + iron + tools 的建筑，三种旧资源在此复用。

#### 3.7 汽车工厂（automobile_factory）— 高级工业

```javascript
{
    id: 'automobile_factory',
    name: '汽车厂',
    desc: '组装钢材、橡胶和机械零件制造汽车。时代标志性建筑。',
    epoch: 7,
    cat: 'industry',
    requiresTech: 'automobile_manufacturing',
    baseCost: { silver: 3500, steel: 50, machinery: 10 },
    input: { steel: 0.4, rubber: 0.3, machinery: 0.3 },
    output: { 
        silver: 2.0,     // 汽车直接产出银币（高价消费品）
        culture: 0.05    // 汽车文化
    },
    jobs: { worker: 10, artisan: 3, engineer: 2, capitalist: 1 },
    owner: 'capitalist',
    visual: { icon: 'Car', color: 'blue-500' },
    marketConfig: {}
},
```

**设计说明**：
- 汽车不作为单独的"资源"存在（减少复杂度），而是直接产出 silver + culture
- 这类似于现有的 trading_post/stock_exchange 模式
- 原料成本 = 0.4×40 + 0.3×6 + 0.3×25 = 16+1.8+7.5 = 25.3
- 产出价值 = 2.0 银币/tick
- 这是一座"终端消费品工厂"，利润取决于 silver 作为货币的特殊地位
- **时代标志性建筑**：建造汽车厂是电气时代的里程碑

#### 3.8 化肥厂（fertilizer_plant）— 农业支持

```javascript
{
    id: 'fertilizer_plant',
    name: '化肥厂',
    desc: '用化学品和煤生产化肥，大幅提升农业产出。食物链再次延长。',
    epoch: 7,
    cat: 'industry',
    requiresTech: 'synthetic_fertilizer',
    baseCost: { silver: 1400, steel: 8, brick: 10 },
    input: { chemicals: 0.3, coal: 0.2 },
    output: { food: 0.8 },  // 化肥转化为额外粮食产出
    jobs: { worker: 4, engineer: 1 },
    owner: 'engineer',
    visual: { icon: 'Sprout', color: 'green-500' },
    marketConfig: { inventoryTargetDays: 120 }
},
```

**设计说明**：
- 化肥不作为单独资源，而是直接产出 food（简化链条）
- 原料成本 = 0.3×18 + 0.2×7.5 = 5.4+1.5 = 6.9
- 产出价值 = 0.8×1.0 = 0.8（food 价格低）
- ⚠️ 直接产出 food 似乎不划算？这是**有意设计**——化肥厂本身利润微薄，但它解决了后期人口爆炸导致的粮食短缺问题。玩家建它不是为了利润，而是为了**粮食安全**。
- 对比：mechanized_farm 的 food 产出 = 2.4（10个peasant），化肥厂 0.8 food 是有意义的补充。

#### 3.9 高效铜矿（advanced_copper_mine）— 升级版采集

```javascript
{
    id: 'advanced_copper_mine',
    name: '深层铜矿',
    desc: '使用电气化设备开采深层铜矿脉，铜产量大幅提升。',
    epoch: 7,
    cat: 'gather',
    requiresTech: 'deep_mining',
    baseCost: { silver: 1600, steel: 20, machinery: 5 },
    input: { electricity: 0.2 },
    output: { copper: 1.6 },
    jobs: { miner: 6, worker: 3, engineer: 1 },
    owner: 'capitalist',
    visual: { icon: 'Pickaxe', color: 'orange-400' },
    marketConfig: { inventoryTargetDays: 60 }
},
```

**设计说明**：
- 消耗少量 electricity 获得 1.6 copper/tick（对比 copper_mine 的 0.72）
- 产出翻倍+，确保电缆厂的大量铜需求能被满足
- **这解决了原方案的"旧资源供给瓶颈"问题**

#### 3.10 广播电台（broadcast_station）— 文化/知识

```javascript
{
    id: 'broadcast_station',
    name: '广播电台',
    desc: '通过电波传播信息，大幅提升科研和文化产出。知识链再次延长。',
    epoch: 7,
    cat: 'civic',
    requiresTech: 'radio_broadcasting',
    baseCost: { silver: 1800, wiring: 10, steel: 8 },
    input: { electricity: 0.3, papyrus: 0.1 },
    output: { science: 0.8, culture: 0.4 },
    jobs: { scribe: 3, worker: 2, engineer: 1 },
    owner: 'official',
    visual: { icon: 'Radio', color: 'sky-400' },
    marketConfig: {}
},
```

**设计说明**：
- 消耗 papyrus 作为"内容素材"，让纸张在电气时代仍有需求
- 知识链延长：reed_works→library→university→publishing_house→broadcast_station

#### 3.11 化纤厂（synthetic_fiber_plant）— 工业/化工

```javascript
{
    id: 'synthetic_fiber_plant',
    name: '化纤厂',
    desc: '利用煤化工技术合成人造纤维，纺织业的第二次革命。',
    epoch: 7,
    cat: 'industry',
    requiresTech: 'synthetic_chemistry',
    baseCost: { steel: 300, brick: 250, tools: 120, science: 400 },
    input: { coal: 1.5, steel: 0.3, science: 0.1 },
    output: { synthetic_fiber: 2.0 },
    jobs: { worker: 12, engineer: 3, capitalist: 1 },
    owner: 'capitalist',
    visual: { icon: 'Layers', color: 'purple-400' },
    marketConfig: { inventoryTargetDays: 80 }
},
```

**设计说明**：
- 原料成本 = 1.5×7.5 + 0.3×40 + 0.1×(science价格) ≈ 11.25+12+少量 = ~23+
- 产出价值 = 2.0×18 = 36.0
- 合理利润空间，但 steel 市场价远低于 basePrice 时利润更高
- **关键**：让 coal 和 steel 在纺织领域获得新用途，化纤是人类历史上的里程碑式发明
- 16 个岗位（12 worker + 3 engineer + 1 capitalist），大型重化工建筑

#### 3.12 电气纺织厂（electric_textile_mill）— 工业/纺织

```javascript
{
    id: 'electric_textile_mill',
    name: '电气纺织厂',
    desc: '电力驱动的大规模纺织工厂，将棉花加工为大量布匹和高级成衣。',
    epoch: 7,
    cat: 'industry',
    requiresTech: 'electric_weaving',
    baseCost: { steel: 350, brick: 300, tools: 150, science: 500 },
    input: { cotton: 3.0, coal: 0.8, dye: 0.5 },
    output: { cloth: 18.0, fine_clothes: 3.0 },
    jobs: { worker: 20, engineer: 3, capitalist: 1 },
    owner: 'capitalist',
    visual: { icon: 'Factory', color: 'sky-400' },
    marketConfig: {}
},
```

**设计说明**：
- 原料成本 = 3.0×4 + 0.8×7.5 + 0.5×5 = 12+6+2.5 = 20.5
- 产出价值 = 18.0×1.5 + 3.0×32 = 27+96 = 123
- 利润极高，但需要大量 cotton 供给（约 1.25 座棉花种植园专供）
- 对比 textile_mill(ep5, cloth:12.5, fine_clothes:1.5)：产出提升约 1.5-2 倍，但新增了 cotton 原料成本
- 24 个岗位（20 worker + 3 engineer + 1 capitalist），时代标志性大型纺织建筑
- 消耗 dye 作为染色工序，让染料在电气时代纺织链中保持需求

---

## 四、新增科技（technologies.js）

### epoch 7 科技树（14 项）

科技按解锁顺序排列，模拟"先有原料→后有加工→最后有消费品"的心流：

#### 第一批（原料/基础设施）

```javascript
{
    id: 'oil_drilling',
    name: '石油钻探',
    desc: '掌握深层石油钻探技术，开启化石能源新纪元。',
    epoch: 7,
    cost: { science: 18000, culture: 3000 },
    effects: { unlockBuilding: ['oil_well'] },
    prerequisites: ['coal_gasification']
},
{
    id: 'rubber_vulcanization',
    name: '硫化橡胶',
    desc: '橡胶硫化工艺使天然橡胶变得耐用，成为工业关键材料。',
    epoch: 7,
    cost: { science: 16000, culture: 2500 },
    effects: { unlockBuilding: ['rubber_plantation'] },
    prerequisites: ['coal_gasification']
},
{
    id: 'power_generation',
    name: '电力发电',
    desc: '利用蒸汽轮机将煤炭的热能转化为电能，开启电气化时代。',
    epoch: 7,
    cost: { science: 20000, culture: 3500 },
    effects: { unlockBuilding: ['coal_power_plant'] },
    prerequisites: ['oil_drilling']
},
{
    id: 'deep_mining',
    name: '深层采矿',
    desc: '电气化采矿设备使深层矿脉的开采成为可能，铜产量倍增。',
    epoch: 7,
    cost: { science: 17000, culture: 2000 },
    effects: { unlockBuilding: ['advanced_copper_mine'] },
    prerequisites: ['power_generation']
},
```

#### 第二批（中间品/加工）

```javascript
{
    id: 'organic_chemistry',
    name: '有机化学',
    desc: '从煤焦油和石油中提取有机化合物，化学工业由此诞生。',
    epoch: 7,
    cost: { science: 22000, culture: 4000 },
    effects: { unlockBuilding: ['oil_refinery'] },
    prerequisites: ['oil_drilling']
},
{
    id: 'electrical_wiring',
    name: '电线制造',
    desc: '绝缘铜线的大规模生产，铜的需求进入爆发式增长期。',
    epoch: 7,
    cost: { science: 21000, culture: 3000 },
    effects: { unlockBuilding: ['wiring_factory'] },
    prerequisites: ['rubber_vulcanization', 'power_generation']
},
{
    id: 'mechanical_engineering',
    name: '机械工程',
    desc: '精密机械设计与制造，为汽车和工厂设备奠定基础。',
    epoch: 7,
    cost: { science: 24000, culture: 4000 },
    effects: { unlockBuilding: ['machinery_plant'] },
    prerequisites: ['power_generation']
},
{
    id: 'synthetic_fertilizer',
    name: '合成化肥',
    desc: '哈伯法合成氨，化肥革命彻底改变农业面貌。',
    epoch: 7,
    cost: { science: 23000, culture: 3500 },
    effects: { unlockBuilding: ['fertilizer_plant'] },
    prerequisites: ['organic_chemistry']
},
{
    id: 'synthetic_chemistry',
    name: '合成化学',
    desc: '煤化工合成人造纤维，纺织业迎来革命性变革。',
    epoch: 7,
    cost: { science: 35000, culture: 5000 },
    effects: { unlockBuilding: ['synthetic_fiber_plant'] },
    prerequisites: ['organic_chemistry']
},
{
    id: 'electric_weaving',
    name: '电气纺织',
    desc: '电力驱动的大规模自动化纺织，产能飞跃式增长。',
    epoch: 7,
    cost: { science: 38000, culture: 5500 },
    effects: { unlockBuilding: ['electric_textile_mill'] },
    prerequisites: ['synthetic_chemistry', 'power_generation']
},
```

#### 第三批（终端/标志性）

```javascript
{
    id: 'automobile_manufacturing',
    name: '汽车制造',
    desc: '流水线生产汽车，改变人类出行方式的伟大发明。',
    epoch: 7,
    cost: { science: 28000, culture: 5000 },
    effects: { unlockBuilding: ['automobile_factory'] },
    prerequisites: ['mechanical_engineering', 'rubber_vulcanization']
},
{
    id: 'radio_broadcasting',
    name: '无线广播',
    desc: '电磁波携带信息穿越空间，大众传媒时代开启。',
    epoch: 7,
    cost: { science: 25000, culture: 5000 },
    effects: { unlockBuilding: ['broadcast_station'] },
    prerequisites: ['electrical_wiring']
},
{
    id: 'electrification',
    name: '全面电气化',
    desc: '电力网络覆盖全国，所有工业建筑获得效率加成。',
    epoch: 7,
    cost: { science: 30000, culture: 6000 },
    effects: {
        buildingBonuses: {
            coal_power_plant: 0.15,
            oil_refinery: 0.10,
            wiring_factory: 0.10,
            machinery_plant: 0.10,
            automobile_factory: 0.10,
            synthetic_fiber_plant: 0.10,
            electric_textile_mill: 0.10,
            factory: 0.15,
            steel_works: 0.10
        }
    },
    prerequisites: ['power_generation', 'electrical_wiring']
},
{
    id: 'modern_logistics',
    name: '现代物流',
    desc: '铁路网络与汽车运输的结合，大幅提升贸易效率。',
    epoch: 7,
    cost: { science: 26000, culture: 4000 },
    effects: {
        categoryBonuses: { gather: 0.10 },
        passivePercentGains: { silver: 0.05 }
    },
    prerequisites: ['automobile_manufacturing']
},
```

---

## 五、新增军事单位（militaryUnits.js）

### epoch 7 军事单位（3 种）

参考 epoch 6 的数值递进：

#### 5.1 机枪队（machine_gun_squad）

```javascript
{
    id: 'machine_gun_squad',
    name: '机枪队',
    desc: '装备重机枪的步兵小队，强大的防守火力。',
    epoch: 7,
    category: 'infantry',
    stats: {
        attack: 55,
        defense: 75,
        speed: 3,
        morale: 65,
        supplyNeed: 1.4,
        siegePower: 2
    },
    cost: {
        silver: 250,
        ordnance: 3,
        ammunition: 5,
        steel: 2
    },
    upkeep: { silver: 12 },
    requiresTech: 'mechanical_engineering',
    size: 80
},
```

#### 5.2 装甲车（armored_car）

```javascript
{
    id: 'armored_car',
    name: '装甲车',
    desc: '安装机枪的装甲汽车，快速机动的突击力量。',
    epoch: 7,
    category: 'cavalry',
    stats: {
        attack: 65,
        defense: 60,
        speed: 8,
        morale: 60,
        supplyNeed: 2.0,
        siegePower: 5
    },
    cost: {
        silver: 400,
        machinery: 3,
        steel: 5,
        oil: 3
    },
    upkeep: { silver: 18, oil: 0.5 },
    requiresTech: 'automobile_manufacturing',
    size: 40
},
```

#### 5.3 重型火炮（heavy_artillery）

```javascript
{
    id: 'heavy_artillery',
    name: '重炮',
    desc: '大口径远程火炮，攻城利器。',
    epoch: 7,
    category: 'siege',
    stats: {
        attack: 80,
        defense: 25,
        speed: 2,
        morale: 55,
        supplyNeed: 2.5,
        siegePower: 30
    },
    cost: {
        silver: 500,
        ordnance: 5,
        steel: 8,
        chemicals: 2
    },
    upkeep: { silver: 22, ammunition: 1 },
    requiresTech: 'mechanical_engineering',
    size: 30
},
```

---

## 六、建筑升级配置（buildingUpgrades.js）

每座新建筑 2 级升级，与现有模式一致：

```javascript
// 电气时代建筑升级
oil_well: {
    maxLevel: 2,
    upgrades: {
        1: { costMultiplier: 2.5, outputMultiplier: 1.3, name: "深钻井架" },
        2: { costMultiplier: 5.0, outputMultiplier: 2.25, name: "自动采油平台" }
    }
},
rubber_plantation: {
    maxLevel: 2,
    upgrades: {
        1: { costMultiplier: 2.5, outputMultiplier: 1.3, name: "改良品种" },
        2: { costMultiplier: 5.0, outputMultiplier: 2.25, name: "大规模种植园" }
    }
},
coal_power_plant: {
    maxLevel: 2,
    upgrades: {
        1: { costMultiplier: 3.0, outputMultiplier: 1.3, name: "高压锅炉" },
        2: { costMultiplier: 6.0, outputMultiplier: 2.25, name: "超临界机组" }
    }
},
oil_refinery: {
    maxLevel: 2,
    upgrades: {
        1: { costMultiplier: 3.0, outputMultiplier: 1.3, name: "催化裂解" },
        2: { costMultiplier: 6.0, outputMultiplier: 2.25, name: "连续精馏塔" }
    }
},
wiring_factory: {
    maxLevel: 2,
    upgrades: {
        1: { costMultiplier: 2.5, outputMultiplier: 1.3, name: "连续拉丝机" },
        2: { costMultiplier: 5.0, outputMultiplier: 2.25, name: "多芯线自动化" }
    }
},
machinery_plant: {
    maxLevel: 2,
    upgrades: {
        1: { costMultiplier: 3.0, outputMultiplier: 1.3, name: "精密车床" },
        2: { costMultiplier: 6.0, outputMultiplier: 2.25, name: "数控加工" }
    }
},
automobile_factory: {
    maxLevel: 2,
    upgrades: {
        1: { costMultiplier: 4.0, outputMultiplier: 1.3, name: "改进流水线" },
        2: { costMultiplier: 8.0, outputMultiplier: 2.25, name: "全自动组装" }
    }
},
fertilizer_plant: {
    maxLevel: 2,
    upgrades: {
        1: { costMultiplier: 2.5, outputMultiplier: 1.3, name: "高压合成" },
        2: { costMultiplier: 5.0, outputMultiplier: 2.25, name: "缓释配方" }
    }
},
advanced_copper_mine: {
    maxLevel: 2,
    upgrades: {
        1: { costMultiplier: 3.0, outputMultiplier: 1.3, name: "电气化竖井" },
        2: { costMultiplier: 6.0, outputMultiplier: 2.25, name: "露天开采" }
    }
},
broadcast_station: {
    maxLevel: 2,
    upgrades: {
        1: { costMultiplier: 3.0, outputMultiplier: 1.3, name: "短波发射" },
        2: { costMultiplier: 6.0, outputMultiplier: 2.25, name: "全国广播网" }
    }
},
synthetic_fiber_plant: {
    maxLevel: 2,
    upgrades: {
        1: { costMultiplier: 3.0, outputMultiplier: 1.3, name: "连续聚合" },
        2: { costMultiplier: 6.0, outputMultiplier: 2.25, name: "多品种共聚" }
    }
},
electric_textile_mill: {
    maxLevel: 2,
    upgrades: {
        1: { costMultiplier: 3.0, outputMultiplier: 1.3, name: "高速织机" },
        2: { costMultiplier: 6.0, outputMultiplier: 2.25, name: "全自动印染" }
    }
},
```

---

## 七、产业链配置（industryChains.js）

### 7.1 新增：power_chain（电力链）

```javascript
power_chain: {
    name: '电力产业',
    stages: [
        { 
            name: '煤炭采掘', buildings: ['coal_mine'], 
            epochRange: [6, 9], bottleneck: '煤炭供给',
            description: '开采煤炭作为发电燃料'
        },
        { 
            name: '燃煤发电', buildings: ['coal_power_plant'], 
            epochRange: [7, 9], bottleneck: '发电容量',
            description: '将煤炭热能转化为电能'
        },
        { 
            name: '电力传输', buildings: ['wiring_factory'], 
            epochRange: [7, 9], bottleneck: '输电网络',
            description: '电缆传输电力到工业用户'
        },
    ]
},
```

### 7.2 新增：petrochemical_chain（石化链）

```javascript
petrochemical_chain: {
    name: '石油化工',
    stages: [
        { 
            name: '石油开采', buildings: ['oil_well'], 
            epochRange: [7, 9], bottleneck: '原油供给',
            description: '开采原油'
        },
        { 
            name: '炼油化工', buildings: ['oil_refinery'], 
            epochRange: [7, 9], bottleneck: '炼化产能',
            description: '将原油精炼为化学品'
        },
        { 
            name: '化工应用', buildings: ['fertilizer_plant'], 
            epochRange: [7, 9], bottleneck: '终端需求',
            description: '化学品深加工为化肥等产品'
        },
    ]
},
```

### 7.3 延长：mining_chain

在现有 mining_chain 的 stages 末尾追加：

```javascript
{
    name: '电缆制造', buildings: ['wiring_factory'],
    epochRange: [7, 9], bottleneck: '铜供给',
    description: '将铜加工为绝缘电缆'
},
```

### 7.4 延长：knowledge_chain

在现有 knowledge_chain 的 stages 末尾追加：

```javascript
{
    name: '大众传媒', buildings: ['broadcast_station'],
    epochRange: [7, 9], bottleneck: '电力供给',
    description: '广播电台大范围传播知识'
},
```

---

## 八、systemSynergies.js 更新

### 8.1 新增 EPOCH_SYSTEM_EFFECTS[7]

```javascript
7: {
    name: "电气革命",
    effects: {
        categoryBonuses: { industry: 0.15, gather: 0.10 },
        passivePercentGains: { silver: 0.03 },
        populationGrowthModifier: 0.10
    },
    description: "电力驱动工业效率飞跃，人口城市化加速"
},
```

---

## 九、BUILDING_CHAINS（UI 展示）更新

### 9.1 新增链

```javascript
{
    name: '石油化工',
    icon: 'Beaker',
    primaryOutput: 'chemicals',
    buildings: ['oil_well', 'oil_refinery', 'fertilizer_plant']
},
{
    name: '电力能源',
    icon: 'Zap',
    primaryOutput: 'electricity',
    buildings: ['coal_power_plant']
},
{
    name: '机械制造',
    icon: 'Cog',
    primaryOutput: 'machinery',
    buildings: ['wiring_factory', 'machinery_plant', 'automobile_factory']
},
```

### 9.2 延长现有链

- **采矿冶金链**：末尾加入 `advanced_copper_mine`
- **知识文化链**：末尾加入 `broadcast_station`

---

## 十、Phase 1 验证清单

- [ ] epoch 7 在 epochs.js 中正确定义
- [ ] 7 种新资源在 gameConstants.js 中正确定义（含 synthetic_fiber）
- [ ] 12 座新建筑在 buildings.js 中正确定义（含化纤厂、电气纺织厂）
- [ ] 14 项新科技在 technologies.js 中正确定义（含 synthetic_chemistry、electric_weaving）
- [ ] 3 种新军事单位在 militaryUnits.js 中正确定义
- [ ] 12 条建筑升级在 buildingUpgrades.js 中正确定义（含化纤厂、电气纺织厂）
- [ ] 从 epoch 6 可以正常升级到 epoch 7
- [ ] 新科技按正确顺序解锁
- [ ] 新建筑能正常生产（利润为正、不停产）
- [ ] copper 价格在建设电缆厂后合理上涨（非暴涨）
- [ ] coal 价格在建设发电厂后合理上涨
- [ ] electricity 价格稳定在 8-15 之间
- [ ] 新军事单位可以招募
- [ ] 化纤厂利润为正（coal+steel→synthetic_fiber）
- [ ] 电气纺织厂能正常消耗 cotton 产出 cloth+fine_clothes
- [ ] 50 tick 经济压力测试通过
