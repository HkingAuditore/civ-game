# Phase 4：系统联动、事件与完善

> 依赖 Phase 1-3 完成。本阶段完善事件系统、国家配置、UI 适配等。

---

## 一、事件设计（events/epochEvents.js）

### 设计原则

每个时代 6-8 个事件，遵循以下分类：
1. **经济事件**（2-3个）：与新产业链/资源相关
2. **社会事件**（2-3个）：与新阶层/人口/生活水平相关
3. **军事/外交事件**（1-2个）：与新军事单位/国际关系相关

### 1.1 电气时代事件（epoch 7）

#### 事件 1：石油热潮

```javascript
{
    id: 'oil_rush',
    name: '石油热潮',
    desc: '勘探队在边疆发现了巨大的石油储量！投机者蜂拥而至。',
    epoch: 7,
    triggerConditions: {
        minEpoch: 7,
        maxEpoch: 7,
        requiredBuildings: { oil_well: 1 },
        probability: 0.08
    },
    choices: [
        {
            text: '国家主导开发',
            effects: {
                resources: { oil: 50 },
                buildingBonuses: { oil_well: 0.20 },
                buffDuration: 20,
                approval: { official: 10, capitalist: -5 }
            }
        },
        {
            text: '放任自由市场',
            effects: {
                resources: { oil: 30, silver: 500 },
                buildingBonuses: { oil_well: 0.30 },
                buffDuration: 15,
                approval: { capitalist: 10, worker: -5 }
            }
        }
    ]
},
```

#### 事件 2：铜线短缺危机

```javascript
{
    id: 'copper_wire_crisis',
    name: '铜线短缺危机',
    desc: '电气化建设对铜的需求远超预期，铜价飞涨，多家工厂被迫停产。',
    epoch: 7,
    triggerConditions: {
        minEpoch: 7,
        maxEpoch: 8,
        requiredBuildings: { wiring_factory: 2 },
        resourceCondition: { copper: { below: 20 } },
        probability: 0.10
    },
    choices: [
        {
            text: '强制征收铜储备',
            effects: {
                resources: { copper: 40 },
                approval: { merchant: -10, engineer: 5 }
            }
        },
        {
            text: '鼓励回收利用',
            effects: {
                buildingBonuses: { wiring_factory: -0.15, advanced_copper_mine: 0.20 },
                buffDuration: 15
            }
        },
        {
            text: '进口外国铜矿',
            effects: {
                resources: { copper: 60, silver: -300 }
            }
        }
    ]
},
```

#### 事件 3：电力工人罢工

```javascript
{
    id: 'power_worker_strike',
    name: '电力工人罢工',
    desc: '发电厂工人要求提高工资和改善工作条件。如不妥善处理，全城可能陷入黑暗。',
    epoch: 7,
    triggerConditions: {
        minEpoch: 7,
        maxEpoch: 8,
        requiredBuildings: { coal_power_plant: 2 },
        stratumCondition: { worker: { approval: { below: 50 } } },
        probability: 0.07
    },
    choices: [
        {
            text: '接受工资要求',
            effects: {
                approval: { worker: 15, engineer: 5 },
                passiveGains: { silver: -0.5 },
                buffDuration: 20
            }
        },
        {
            text: '派军队维持秩序',
            effects: {
                approval: { worker: -20, soldier: 5 },
                stability: -0.1,
                buffDuration: 10
            }
        }
    ]
},
```

#### 事件 4：汽车展览会

```javascript
{
    id: 'automobile_exhibition',
    name: '汽车展览会',
    desc: '第一届国际汽车博览会在首都盛大开幕，各国厂商展示最新车型。',
    epoch: 7,
    triggerConditions: {
        minEpoch: 7,
        maxEpoch: 8,
        requiredBuildings: { automobile_factory: 1 },
        probability: 0.06
    },
    choices: [
        {
            text: '大力宣传国产汽车',
            effects: {
                resources: { culture: 200 },
                buildingBonuses: { automobile_factory: 0.15 },
                buffDuration: 15,
                approval: { capitalist: 10 }
            }
        },
        {
            text: '引进外国技术',
            effects: {
                resources: { science: 300 },
                buildingBonuses: { machinery_plant: 0.10 },
                buffDuration: 15
            }
        }
    ]
},
```

#### 事件 5：化学武器争议

```javascript
{
    id: 'chemical_weapons_debate',
    name: '化学武器争议',
    desc: '军方提议利用化工产业生产化学武器。这引发了激烈的道德争论。',
    epoch: 7,
    triggerConditions: {
        minEpoch: 7,
        maxEpoch: 8,
        requiredBuildings: { oil_refinery: 1 },
        probability: 0.05
    },
    choices: [
        {
            text: '秘密发展化学武器',
            effects: {
                militaryBonus: 0.15,
                approval: { soldier: 10, cleric: -15, worker: -5 },
                stability: -0.05,
                buffDuration: 25
            }
        },
        {
            text: '签署禁止公约',
            effects: {
                approval: { cleric: 10, worker: 5 },
                resources: { culture: 150 },
                diplomaticReputation: 0.10
            }
        }
    ]
},
```

#### 事件 6：广播黄金时代

```javascript
{
    id: 'radio_golden_age',
    name: '广播黄金时代',
    desc: '无线电广播席卷全国，家家户户围坐收听，大众文化迎来繁荣。',
    epoch: 7,
    triggerConditions: {
        minEpoch: 7,
        maxEpoch: 8,
        requiredBuildings: { broadcast_station: 1 },
        probability: 0.08
    },
    choices: [
        {
            text: '国家控制广播内容',
            effects: {
                resources: { culture: 100 },
                approval: { official: 10, cleric: -5 },
                passiveGains: { culture: 0.2 },
                buffDuration: 20
            }
        },
        {
            text: '允许商业广播',
            effects: {
                resources: { silver: 300, culture: 200 },
                approval: { merchant: 10, capitalist: 5 },
                buffDuration: 15
            }
        }
    ]
},
```

### 1.2 原子时代事件（epoch 8）

#### 事件 7：核能辩论

```javascript
{
    id: 'nuclear_debate',
    name: '核能大辩论',
    desc: '核电站的建设引发社会激烈讨论。支持者赞颂清洁能源，反对者担忧安全风险。',
    epoch: 8,
    triggerConditions: {
        minEpoch: 8,
        maxEpoch: 9,
        requiredBuildings: { nuclear_power_plant: 1 },
        probability: 0.08
    },
    choices: [
        {
            text: '大力发展核电',
            effects: {
                buildingBonuses: { nuclear_power_plant: 0.20 },
                approval: { engineer: 10, worker: -5 },
                buffDuration: 25
            }
        },
        {
            text: '限制核电规模',
            effects: {
                approval: { worker: 10, cleric: 5 },
                buildingBonuses: { coal_power_plant: 0.15 },
                buffDuration: 20
            }
        }
    ]
},
```

#### 事件 8：电子革命

```javascript
{
    id: 'electronics_revolution',
    name: '电子革命',
    desc: '晶体管的发明引发一场技术海啸，电子产品开始走进千家万户。',
    epoch: 8,
    triggerConditions: {
        minEpoch: 8,
        maxEpoch: 8,
        techRequirement: ['integrated_circuits'],
        probability: 0.10
    },
    choices: [
        {
            text: '国家投资电子工业',
            effects: {
                buildingBonuses: { electronics_factory: 0.20 },
                resources: { science: 500 },
                approval: { engineer: 10, technician: 10 },
                buffDuration: 20
            }
        },
        {
            text: '扶持民间创新',
            effects: {
                buildingBonuses: { electronics_factory: 0.10 },
                resources: { silver: 500, culture: 100 },
                approval: { capitalist: 10 },
                buffDuration: 20
            }
        }
    ]
},
```

#### 事件 9：医药突破

```javascript
{
    id: 'medical_breakthrough',
    name: '医药突破',
    desc: '研究人员成功合成了一种革命性的新药，可以治疗多种致命疾病。',
    epoch: 8,
    triggerConditions: {
        minEpoch: 8,
        maxEpoch: 9,
        requiredBuildings: { pharmaceutical_plant: 1 },
        probability: 0.06
    },
    choices: [
        {
            text: '低价普及给所有人',
            effects: {
                populationGrowthModifier: 0.10,
                approval: { worker: 10, peasant: 10 },
                resources: { silver: -200 },
                buffDuration: 30
            }
        },
        {
            text: '高价销售获取利润',
            effects: {
                resources: { silver: 800, medicine: 20 },
                approval: { capitalist: 10, worker: -5 },
                buffDuration: 20
            }
        }
    ]
},
```

#### 事件 10：太空竞赛

```javascript
{
    id: 'space_race',
    name: '太空竞赛',
    desc: '邻国宣布成功发射人造卫星！举国震惊，科学界呼吁加大投入。',
    epoch: 8,
    triggerConditions: {
        minEpoch: 8,
        maxEpoch: 9,
        probability: 0.05
    },
    choices: [
        {
            text: '启动国家太空计划',
            effects: {
                resources: { silver: -1000 },
                passiveGains: { science: 1.0, culture: 0.5 },
                approval: { engineer: 15, scientist: 15, official: 10 },
                buffDuration: 30
            }
        },
        {
            text: '专注民用科技',
            effects: {
                buildingBonuses: { electronics_factory: 0.15, television_station: 0.15 },
                approval: { worker: 5, merchant: 5 },
                buffDuration: 20
            }
        }
    ]
},
```

#### 事件 11：技术工人短缺

```javascript
{
    id: 'technician_shortage',
    name: '技术工人短缺',
    desc: '新兴电子工业的快速扩张导致合格技术工人严重不足。',
    epoch: 8,
    triggerConditions: {
        minEpoch: 8,
        maxEpoch: 9,
        requiredBuildings: { electronics_factory: 2 },
        probability: 0.08
    },
    choices: [
        {
            text: '建立职业培训体系',
            effects: {
                resources: { silver: -300 },
                approval: { technician: 15, worker: 5 },
                // 加速 worker → technician 晋升
                buffDuration: 25
            }
        },
        {
            text: '引进外国技术人员',
            effects: {
                resources: { silver: -500 },
                populationGrowthModifier: 0.05,
                approval: { technician: 10, worker: -5 },
                buffDuration: 20
            }
        }
    ]
},
```

#### 事件 12：环境污染

```javascript
{
    id: 'industrial_pollution',
    name: '工业污染危机',
    desc: '化工厂和冶炼厂排放导致周边水源和空气严重污染，居民健康受损。',
    epoch: 8,
    triggerConditions: {
        minEpoch: 8,
        maxEpoch: 9,
        requiredBuildings: { plastics_factory: 1, oil_refinery: 1 },
        probability: 0.07
    },
    choices: [
        {
            text: '实施严格环保法规',
            effects: {
                categoryBonuses: { industry: -0.10 },
                approval: { worker: 10, cleric: 5 },
                populationGrowthModifier: 0.05,
                buffDuration: 20
            }
        },
        {
            text: '经济发展优先',
            effects: {
                categoryBonuses: { industry: 0.05 },
                approval: { worker: -10, capitalist: 5 },
                populationGrowthModifier: -0.05,
                buffDuration: 20
            }
        }
    ]
},
```

### 1.3 信息时代事件（epoch 9）

#### 事件 13：芯片战争

```javascript
{
    id: 'chip_war',
    name: '芯片战争',
    desc: '邻国开始限制半导体出口，我国芯片供应面临严峻挑战。',
    epoch: 9,
    triggerConditions: {
        minEpoch: 9,
        maxEpoch: 9,
        requiredBuildings: { semiconductor_fab: 1 },
        probability: 0.08
    },
    choices: [
        {
            text: '举国攻关自主芯片',
            effects: {
                resources: { silver: -2000, science: 500 },
                buildingBonuses: { semiconductor_fab: 0.25 },
                approval: { engineer: 15, scientist: 15, capitalist: -5 },
                buffDuration: 30
            }
        },
        {
            text: '外交斡旋恢复贸易',
            effects: {
                resources: { semiconductors: 10 },
                diplomaticReputation: -0.05,
                approval: { merchant: 10 },
                buffDuration: 15
            }
        }
    ]
},
```

#### 事件 14：AI觉醒恐慌

```javascript
{
    id: 'ai_panic',
    name: 'AI觉醒恐慌',
    desc: '一个AI系统展示出惊人的自主行为，公众对人工智能的恐惧急剧上升。',
    epoch: 9,
    triggerConditions: {
        minEpoch: 9,
        maxEpoch: 9,
        techRequirement: ['ai_automation'],
        probability: 0.06
    },
    choices: [
        {
            text: '设立AI伦理委员会',
            effects: {
                resources: { culture: 300, science: -100 },
                approval: { cleric: 10, worker: 5, scientist: -5 },
                buffDuration: 20
            }
        },
        {
            text: '加速AI发展',
            effects: {
                buildingBonuses: { software_company: 0.20, research_institute: 0.15 },
                approval: { scientist: 10, worker: -10 },
                stability: -0.05,
                buffDuration: 20
            }
        }
    ]
},
```

#### 事件 15：互联网泡沫

```javascript
{
    id: 'dotcom_bubble',
    name: '互联网泡沫',
    desc: '互联网企业估值飙升至不可思议的高度。这是新经济的黎明还是投机泡沫？',
    epoch: 9,
    triggerConditions: {
        minEpoch: 9,
        maxEpoch: 9,
        requiredBuildings: { internet_platform: 2 },
        probability: 0.08
    },
    choices: [
        {
            text: '加强金融监管',
            effects: {
                buildingBonuses: { internet_platform: -0.10, financial_center: -0.10 },
                stability: 0.10,
                approval: { merchant: -10, capitalist: -5 },
                buffDuration: 20
            }
        },
        {
            text: '让市场自行调节',
            effects: {
                // 50% 概率崩盘
                resources: { silver: -1000 },
                buildingBonuses: { internet_platform: 0.20 },
                stability: -0.15,
                buffDuration: 15
            }
        }
    ]
},
```

#### 事件 16：清洁能源革命

```javascript
{
    id: 'clean_energy_revolution',
    name: '清洁能源革命',
    desc: '太阳能发电成本骤降，可再生能源终于可以与化石燃料竞争。',
    epoch: 9,
    triggerConditions: {
        minEpoch: 9,
        maxEpoch: 9,
        requiredBuildings: { solar_power_plant: 1 },
        probability: 0.07
    },
    choices: [
        {
            text: '全面转型清洁能源',
            effects: {
                buildingBonuses: { solar_power_plant: 0.30, coal_power_plant: -0.20 },
                resources: { culture: 200 },
                approval: { engineer: 10, worker: 5, miner: -10 },
                buffDuration: 25
            }
        },
        {
            text: '能源多元化发展',
            effects: {
                buildingBonuses: { solar_power_plant: 0.15, coal_power_plant: 0.05, nuclear_power_plant: 0.10 },
                approval: { miner: 5 },
                buffDuration: 20
            }
        }
    ]
},
```

#### 事件 17：科学家外流

```javascript
{
    id: 'brain_drain',
    name: '科学家外流',
    desc: '邻国开出优厚条件吸引我国科学家移民，科研人才面临流失。',
    epoch: 9,
    triggerConditions: {
        minEpoch: 9,
        maxEpoch: 9,
        stratumCondition: { scientist: { approval: { below: 60 } } },
        probability: 0.07
    },
    choices: [
        {
            text: '提高科研人员待遇',
            effects: {
                resources: { silver: -500 },
                approval: { scientist: 20, engineer: 10 },
                passiveGains: { science: 0.3 },
                buffDuration: 25
            }
        },
        {
            text: '限制人才出境',
            effects: {
                approval: { scientist: -15 },
                stability: -0.05,
                buffDuration: 15
            }
        }
    ]
},
```

#### 事件 18：数据隐私风暴

```javascript
{
    id: 'data_privacy_scandal',
    name: '数据隐私风暴',
    desc: '一家大型互联网公司被曝大规模收集和泄露用户隐私数据。',
    epoch: 9,
    triggerConditions: {
        minEpoch: 9,
        maxEpoch: 9,
        requiredBuildings: { data_center: 1 },
        probability: 0.06
    },
    choices: [
        {
            text: '出台数据保护法',
            effects: {
                buildingBonuses: { data_center: -0.10, internet_platform: -0.05 },
                approval: { worker: 10, cleric: 5 },
                resources: { culture: 100 },
                buffDuration: 20
            }
        },
        {
            text: '企业自律即可',
            effects: {
                buildingBonuses: { data_center: 0.05 },
                approval: { capitalist: 5, worker: -10 },
                buffDuration: 15
            }
        }
    ]
},
```

---

## 二、BUILDING_CHAINS（UI 展示链）完整更新

### Phase 1-3 汇总后的完整新增链

```javascript
// 新增 BUILDING_CHAINS 条目
{
    name: '石油化工',
    icon: 'Beaker',
    primaryOutput: 'chemicals',
    buildings: ['oil_well', 'oil_refinery', 'fertilizer_plant', 'plastics_factory']
},
{
    name: '电力能源',
    icon: 'Zap',
    primaryOutput: 'electricity',
    buildings: ['coal_power_plant', 'nuclear_power_plant', 'solar_power_plant']
},
{
    name: '机械制造',
    icon: 'Cog',
    primaryOutput: 'machinery',
    buildings: ['wiring_factory', 'machinery_plant', 'automobile_factory']
},
{
    name: '电子半导体',
    icon: 'Cpu',
    primaryOutput: 'electronics',
    buildings: ['electronics_factory', 'semiconductor_fab', 'appliance_factory']
},
{
    name: '医药生物',
    icon: 'Pill',
    primaryOutput: 'medicine',
    buildings: ['pharmaceutical_plant', 'biotech_center']
},
{
    name: '信息产业',
    icon: 'Globe',
    primaryOutput: 'software',
    buildings: ['software_company', 'data_center', 'internet_platform', 'financial_center']
},
{
    name: '新材料',
    icon: 'Hexagon',
    primaryOutput: 'composites',
    buildings: ['aluminum_smelter', 'composites_factory']
},
```

### 延长现有链

- **采矿冶金**：加入 `advanced_copper_mine`, `automated_mine`
- **知识文化**：加入 `broadcast_station`, `television_station`, `research_institute`
- **住房建筑**：加入 `high_rise_apartment`
- **军事工业**：加入 `military_industrial_complex`

---

## 三、systemSynergies.js 完整更新

### 3.1 CHAIN_SYNERGIES 新增

```javascript
// 电力链 ↔ 其他链的协同
{ chain1: 'power_chain', chain2: 'mining_chain', bonus: 0.08, desc: '电力驱动采矿效率提升' },
{ chain1: 'power_chain', chain2: 'petrochemical_chain', bonus: 0.10, desc: '电力支撑化工生产' },
{ chain1: 'electronics_chain', chain2: 'military_chain', bonus: 0.12, desc: '电子化提升军事装备' },
{ chain1: 'electronics_chain', chain2: 'knowledge_chain', bonus: 0.10, desc: '电子媒体促进文化传播' },
{ chain1: 'petrochemical_chain', chain2: 'food_chain', bonus: 0.08, desc: '化肥提升农业产出' },
{ chain1: 'semiconductor_chain', chain2: 'knowledge_chain', bonus: 0.15, desc: '半导体驱动知识革命' },
```

### 3.2 CHAIN_CLASS_INTERACTION 新增

```javascript
// technician 阶层的产业链互动
{ stratum: 'technician', chain: 'electronics_chain', bonus: 0.10, desc: '技术工人的专业技能提升电子产业效率' },
{ stratum: 'technician', chain: 'power_chain', bonus: 0.08, desc: '技术工人维护电力系统' },

// scientist 阶层的产业链互动
{ stratum: 'scientist', chain: 'semiconductor_chain', bonus: 0.12, desc: '科学家推动半导体技术进步' },
{ stratum: 'scientist', chain: 'knowledge_chain', bonus: 0.15, desc: '科学家是知识生产的核心' },
```

---

## 四、UI 适配

### 4.1 EraBackground.jsx

需要为 epoch 7-9 添加背景图：

```
// 需要新增的背景图
src/assets/images/backgrounds/bg_era_7_electric.webp    — 电气时代（电线杆、工厂烟囱、汽车）
src/assets/images/backgrounds/bg_era_8_atomic.webp      — 原子时代（核电站、电视、卫星）
src/assets/images/backgrounds/bg_era_9_information.webp  — 信息时代（数据中心、太阳能、城市夜景）
```

### 4.2 建筑图片

每座新建筑需要一张 webp 图片，放在 `src/assets/images/buildings/` 下。

Phase 1（10 座）：
```
oil_well.webp
rubber_plantation.webp
coal_power_plant.webp
oil_refinery.webp
wiring_factory.webp
machinery_plant.webp
automobile_factory.webp
fertilizer_plant.webp
advanced_copper_mine.webp
broadcast_station.webp
```

Phase 2（10 座）：
```
uranium_mine.webp
nuclear_power_plant.webp
plastics_factory.webp
electronics_factory.webp
pharmaceutical_plant.webp
aluminum_smelter.webp
appliance_factory.webp
television_station.webp
high_rise_apartment.webp
military_industrial_complex.webp
```

Phase 3（10 座）：
```
semiconductor_fab.webp
software_company.webp
data_center.webp
internet_platform.webp
solar_power_plant.webp
composites_factory.webp
research_institute.webp
financial_center.webp
biotech_center.webp
automated_mine.webp
```

### 4.3 图标映射（iconMap.js）

确保所有新使用的 Lucide 图标名称在 iconMap 中有映射：
```
Droplet, Circle, Beaker, Cable, Zap, Atom, Box, Layers, Pill, Cpu (已有), 
Hexagon, Code, Sun, Globe, Server, Car, Sprout, Radio, Tv, Refrigerator,
Building, Microscope, Landmark, Dna, HardDrive
```

---

## 五、国家配置更新（countries.js）

### 5.1 现有国家 expireEpoch 调整

大部分国家的 `expireEpoch: 9` 已经兼容。无需修改。

### 5.2 可选：新增国家（低优先级）

如果需要，可以为新时代添加国家：

```javascript
// 电气时代国家（可选）
{
    id: 'electric_republic',
    name: '电力共和国',
    desc: '以电气化工业闻名的新兴强国。',
    appearEpoch: 7,
    expireEpoch: 9,
    personality: { aggression: 0.4, trade: 0.7, science: 0.8 },
    bonuses: { power_chain: 0.15, electronics_chain: 0.10 }
},
// 原子时代国家（可选）
{
    id: 'atomic_superpower',
    name: '原子超级大国',
    desc: '以核能和军事工业为支柱的超级大国。',
    appearEpoch: 8,
    expireEpoch: 9,
    personality: { aggression: 0.6, trade: 0.4, science: 0.9 },
    bonuses: { military_chain: 0.15, power_chain: 0.10 }
},
```

---

## 六、全局一致性检查清单

### 6.1 数据一致性

- [ ] 所有新建筑的 requiresTech 引用的科技确实存在
- [ ] 所有新科技的 prerequisites 引用的科技确实存在
- [ ] 所有新建筑的 input 引用的资源确实存在且 unlockEpoch ≤ 建筑 epoch
- [ ] 所有新建筑的 output 引用的资源确实存在
- [ ] 所有新建筑的 jobs 引用的阶层确实存在
- [ ] 所有新建筑的 owner 引用的阶层确实存在
- [ ] 所有新军事单位的 cost 引用的资源确实存在
- [ ] 新阶层在 ROLE_PRIORITY 和 STRATUM_TIERS 中都已注册
- [ ] EPOCH_SYSTEM_EFFECTS 覆盖 epoch 7-9
- [ ] BUILDING_CHAINS 包含所有新建筑
- [ ] buildingUpgrades 覆盖所有 30 座新建筑

### 6.2 经济平衡性

- [ ] 每座建筑的 basePrice 收入 > 原料 basePrice 成本（至少 10% 毛利）
- [ ] 中间品的 inventoryTargetDays ≥ 80（防止价格剧烈波动）
- [ ] owner 分散在 capitalist/engineer/official/merchant（不集中于一个阶层）
- [ ] 每种旧资源至少有 2 条新产业链消耗
- [ ] 新时代有升级版采集建筑解决旧资源供给瓶颈
- [ ] 每时代的 epoch.cost 中包含该时代新资源（拉动新链）

### 6.3 UI/UX

- [ ] 所有新建筑有图片文件
- [ ] 所有新资源的 icon 在 Lucide 图标库中存在
- [ ] 时代背景图存在
- [ ] 新阶层在 StrataPanel 中正确显示

---

## 七、Phase 4 验证清单

- [ ] 18 个事件在 epochEvents.js 中正确定义
- [ ] 事件按 minEpoch/maxEpoch 正确过滤
- [ ] 事件选项效果正确生效
- [ ] CHAIN_SYNERGIES 新增条目正确生效
- [ ] CHAIN_CLASS_INTERACTION 新增条目正确生效
- [ ] BUILDING_CHAINS（UI）正确显示所有新建筑链
- [ ] 所有新建筑图片到位
- [ ] 图标映射正确
- [ ] 全链路 100 tick 无崩溃测试通过
- [ ] 从 epoch 0 一路升级到 epoch 9 的完整游戏流程测试通过
