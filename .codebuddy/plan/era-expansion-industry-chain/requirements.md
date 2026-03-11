# 需求文档：时代扩展与产业链全面升级

## 引言

当前游戏包含 8 个时代（石器→青铜→古典→封建→探索→启蒙→工业→信息），产业链在工业时代(epoch 6)基本到达终点，信息时代(epoch 7)缺乏专属建筑和产业链，后期内容空洞。本需求旨在**保留启蒙时代(epoch 5)不变**，在其之后将现有的「工业时代-信息时代」替换并扩展为**「蒸汽时代-电气时代-原子时代-信息时代」**四个全新时代，并为每个新时代设计完整的产业链、建筑、科技、资源和阶层。

### 设计原则

1. **严格遵循现有范式**：所有新内容在数据结构、命名规则、数值体系上与现有系统完全一致
2. **延长而非替代**：新时代的建筑和产业链优先在现有产业链末端延伸，而非创建平行系统
3. **超长产业链**：引入多层级加工（原材料→初级加工→中级加工→高级制成品→最终消费），让经济网络更复杂
4. **经济模型一致**：新资源遵循抽象市场模型（供需→价格→工资→税收反馈循环）
5. **数值递进一致**：建筑产出倍率、时代加成系数、科技成本等遵循现有递进曲线
6. **保留epoch 0-5不变**：石器、青铜、古典、封建、探索、启蒙六个时代的所有内容完全保留

### 时代体系映射

| 现有时代 | 现有 epoch ID | 重构后 | 新 epoch ID | 变更说明 |
|---------|-------------|--------|-------------|---------|
| 石器时代 | 0 | 石器时代 | 0 | 不变 |
| 青铜时代 | 1 | 青铜时代 | 1 | 不变 |
| 古典时代 | 2 | 古典时代 | 2 | 不变 |
| 封建时代 | 3 | 封建时代 | 3 | 不变 |
| 探索时代 | 4 | 探索时代 | 4 | 不变 |
| 启蒙时代 | 5 | 启蒙时代 | 5 | **不变** |
| 工业时代 | 6 | **蒸汽时代** | 6 | 改名，保留并重新归类现有epoch 6建筑/科技 |
| 信息时代 | 7 | **电气时代** | 7 | 改名，填充全新内容（原epoch 7无专属建筑/科技） |
| (无) | (无) | **原子时代** | 8 | 全新时代 |
| (无) | (无) | **信息时代** | 9 | 全新终极时代 |

### 现有 epoch 6（工业时代）建筑归属

现有 epoch 6 的 16 个建筑将全部归入**蒸汽时代(epoch 6)**，因为它们的主题（蒸汽动力、煤炭驱动、机械化）天然契合蒸汽时代：

- 采集类：煤矿(coal_mine)、工业矿场(industrial_mine)、机械化农场(mechanized_farm)、伐木公司(logging_company)
- 工业类：蒸汽工厂(steam_factory)、炼钢厂(steel_foundry)、钢铁联合体(steel_works)、服装工厂(garment_factory)、家具工厂(furniture_factory)、预制构件厂(prefab_factory)、罐头厂(cannery)、出版社(publishing_house)
- 军事类：兵工厂(arsenal)
- 市政类：火车站(railway_station)、公寓楼(apartment_block)

### 现有 epoch 6（工业时代）科技归属

现有 epoch 6 的 20 个科技将全部归入**蒸汽时代(epoch 6)**，保留其解锁关系不变。

---

## 需求

### 需求 1：时代体系重构

**用户故事：** 作为一名玩家，我希望在启蒙时代之后经历蒸汽时代、电气时代、原子时代、信息时代四个时代，以便感受到从早期机械化到现代信息社会的完整文明发展历程。

#### 验收标准

1. WHEN 玩家查看时代列表 THEN 系统 SHALL 显示 10 个时代：石器(0)→青铜(1)→古典(2)→封建(3)→探索(4)→启蒙(5)→蒸汽(6)→电气(7)→原子(8)→信息(9)
2. WHEN 时代 0-5 的配置加载 THEN 系统 SHALL 完全保留现有数据（id、name、req、cost、bonuses）不做任何修改
3. WHEN 蒸汽时代(epoch 6)配置加载 THEN 系统 SHALL 将现有工业时代的 name 改为"蒸汽时代"，保留其 req/cost/bonuses 数值（科研≥20000，人口≥650，文化≥4000）
4. WHEN 电气时代(epoch 7)配置加载 THEN 系统 SHALL 将现有信息时代的 name 改为"电气时代"，并调整 req/cost/bonuses（科研≥35000，人口≥1000，文化≥8000）
5. WHEN 原子时代(epoch 8)配置新增 THEN 系统 SHALL 设置升级条件（科研≥55000，人口≥1500，文化≥15000）及对应 bonuses
6. WHEN 信息时代(epoch 9)配置新增 THEN 系统 SHALL 设置升级条件（科研≥85000，人口≥2200，文化≥25000）及对应 bonuses
7. WHEN 时代升级发生 THEN 系统 SHALL 应用对应时代的 bonuses（gatherBonus, militaryBonus, cultureBonus, scienceBonus, industryBonus 等），数值递进符合现有曲线
8. WHEN 新时代 bonuses 定义完成 THEN 系统 SHALL 确保递增趋势：
   - gatherBonus: 蒸汽2.0 → 电气3.0 → 原子4.0 → 信息5.0
   - industryBonus: 蒸汽2.0 → 电气3.0 → 原子4.5 → 信息6.0
   - scienceBonus: 蒸汽1.2 → 电气2.0 → 原子3.5 → 信息5.0
9. WHEN 新时代的 color/bg/tileColor 定义完成 THEN 系统 SHALL 为每个时代分配独特的 Tailwind 颜色主题

---

### 需求 2：新资源引入

**用户故事：** 作为一名玩家，我希望在后期时代解锁新的资源类型（棉花、橡胶、石油、电力、塑料、化学品、车辆、电子元件、半导体等），以便构建更丰富和更长的产业链。

#### 验收标准

1. WHEN 玩家进入蒸汽时代(epoch 6) THEN 系统 SHALL 解锁以下新资源：
   - **棉花**(cotton)：基础纺织原材料，tags: ['raw']
   - **橡胶**(rubber)：工业原材料，tags: ['raw', 'industrial']

2. WHEN 玩家进入电气时代(epoch 7) THEN 系统 SHALL 解锁以下新资源：
   - **石油**(oil)：战略能源资源，tags: ['raw', 'energy']
   - **电力**(electricity)：虚拟能源资源（type: 'virtual_energy'），由发电厂产出，被工业建筑消费
   - **化学品**(chemicals)：中间工业品，tags: ['intermediate', 'industrial']
   - **车辆**(vehicles)：高级制成品，tags: ['manufactured', 'military']

3. WHEN 玩家进入原子时代(epoch 8) THEN 系统 SHALL 解锁以下新资源：
   - **塑料**(plastics)：通用工业材料，tags: ['intermediate', 'industrial']
   - **电子元件**(electronics)：高级工业品，tags: ['manufactured', 'industrial']
   - **铀矿**(uranium)：战略资源，tags: ['raw', 'strategic']
   - **医药**(medicine)：消费品，tags: ['manufactured', 'consumer']

4. WHEN 玩家进入信息时代(epoch 9) THEN 系统 SHALL 解锁以下新资源：
   - **半导体**(semiconductors)：尖端工业品，tags: ['manufactured', 'high_tech']
   - **数据**(data)：虚拟资源（type: 'virtual'），tags: ['virtual', 'high_tech']
   - **服务**(services)：虚拟消费品（type: 'virtual'），tags: ['virtual', 'consumer']

5. WHEN 新资源被定义 THEN 系统 SHALL 为每个资源配置完整的 RESOURCES 数据项（name, icon, color, basePrice, minPrice, maxPrice, defaultOwner, unlockEpoch, unlockTech, tags, marketConfig），遵循 `src/config/gameConstants.js` 中现有 RESOURCES 的范式
6. IF 新资源为虚拟能源类型（如电力） THEN 系统 SHALL 将其标记为 type: 'virtual_energy'，不可存储但可实时消费，不进入市场交易
7. WHEN 新资源的 basePrice 定义完成 THEN 系统 SHALL 确保价格层级：原材料(棉花/橡胶/石油/铀: 2-8) < 中间品(化学品/塑料: 10-20) < 工业品(电子/车辆/医药: 25-60) < 尖端品(半导体: 80-150)

---

### 需求 3：蒸汽时代(epoch 6)产业链与建筑

**用户故事：** 作为一名玩家，我希望在蒸汽时代体验早期工业化的产业链，包括蒸汽动力驱动的工厂、棉纺织业和铁路运输，以便感受第一次工业革命的变革力量。

#### 验收标准

1. WHEN 蒸汽时代配置加载 THEN 系统 SHALL 保留现有 epoch 6 的全部 16 个建筑不变（仅时代名称从"工业时代"改为"蒸汽时代"）
2. WHEN 玩家解锁蒸汽时代新科技 THEN 系统 SHALL 提供以下**新增**建筑（遵循 BUILDINGS 数组数据范式）：
   - **棉花种植园**(cotton_plantation)：采集建筑，产出棉花，雇佣佃农/工人，epoch:6
   - **棉纺厂**(cotton_mill)：工业建筑，棉花→布料+华服，蒸汽动力大规模生产，epoch:6
   - **橡胶种植园**(rubber_plantation)：采集建筑，产出橡胶，epoch:6
   - **蒸馏厂**(distillery_upgrade)：将酒类产业升级，消耗煤炭提高效率，epoch:6（如现有蒸馏酒厂未覆盖此功能）

3. WHEN 蒸汽时代建筑定义完成 THEN 系统 SHALL 确保每个建筑包含完整字段：id, name, desc, baseCost, input, output, jobs, owner, epoch:6, cat, requiresTech, visual, marketConfig
4. WHEN 棉纺产业链运行 THEN 系统 SHALL 实现：棉花(采集) → 棉纺厂(加工为布料/华服) → 消费者需求，延长现有纺织产业链
5. WHEN 相关 BUILDING_CHAINS 配置更新 THEN 系统 SHALL 将新建筑加入对应的建筑链（如 cotton_plantation 加入纺织链）
6. WHEN 相关 INDUSTRY_CHAINS 配置更新 THEN 系统 SHALL 在 textile_chain 中新增蒸汽时代阶段

---

### 需求 4：电气时代(epoch 7)产业链与建筑

**用户故事：** 作为一名玩家，我希望在电气时代体验石油化工、电力驱动、汽车制造等第二次工业革命的产业链，以便感受现代工业体系的复杂性。

#### 验收标准

1. WHEN 玩家解锁电气时代科技 THEN 系统 SHALL 提供以下新建筑（epoch:7）：
   - **油田**(oil_well)：采集建筑，产出石油
   - **炼油厂**(oil_refinery)：工业建筑，石油→化学品+燃料
   - **燃煤电厂**(coal_power_plant)：能源建筑，消耗煤炭→产出电力
   - **火力发电厂**(thermal_power_plant)：能源建筑，消耗石油→产出更多电力
   - **化工厂**(chemical_plant)：化学品+石油→塑料/化肥等
   - **汽车工厂**(automobile_factory)：钢材+橡胶+工具→车辆
   - **电气工厂**(electric_factory)：通用工业升级，消耗电力代替煤炭，效率更高
   - **电话交换局**(telephone_exchange)：市政建筑，产出银币/文化
   - **百货商场**(department_store)：商业建筑，消耗多种消费品→银币+文化
   - **现代医院**(modern_hospital)：市政建筑，增加人口上限/人口增长率

2. WHEN 电气时代建筑定义完成 THEN 系统 SHALL 确保所有建筑遵循 BUILDINGS 数据范式
3. WHEN 石化产业链运行 THEN 系统 SHALL 实现超长链：石油(采集) → 炼油厂(化学品) → 化工厂(塑料/化肥) → 汽车工厂(车辆) → 消费/军事
4. WHEN 电力系统运行 THEN 系统 SHALL 实现：煤炭/石油 → 发电厂 → 电力 → 工业建筑消费电力获得产出加成
5. WHEN 相关产业链配置更新 THEN 系统 SHALL 新增 **petrochemical_chain**（石化产业链）、**automotive_chain**（汽车产业链）、**power_chain**（电力产业链）

---

### 需求 5：原子时代(epoch 8)产业链与建筑

**用户故事：** 作为一名玩家，我希望在原子时代体验核能、电子工业、医药和消费品大规模生产，以便感受战后经济繁荣与科技爆炸。

#### 验收标准

1. WHEN 玩家解锁原子时代科技 THEN 系统 SHALL 提供以下新建筑（epoch:8）：
   - **铀矿**(uranium_mine)：采集建筑，产出铀矿
   - **核电站**(nuclear_power_plant)：产出大量电力，消耗铀矿
   - **塑料工厂**(plastics_factory)：化学品+石油→塑料
   - **电子工厂**(electronics_factory)：钢材+塑料+化学品→电子元件
   - **制药厂**(pharmaceutical_plant)：化学品→医药
   - **家电工厂**(appliance_factory)：电子元件+塑料+钢材→高级消费品
   - **电视台**(television_station)：电子元件+电力→文化+影响力
   - **医院**(hospital)：消耗医药，增加人口上限和人口增长率
   - **高层公寓**(high_rise_apartment)：大型市政建筑，提供大量人口上限
   - **军工综合体**(military_industrial_complex)：电子元件+钢材+化学品→高级军事装备

2. WHEN 电子产业链运行 THEN 系统 SHALL 实现超长链：矿石 → 钢材 → 化学品 → 塑料 → 电子元件 → 消费品/军事
3. WHEN 核能产业链运行 THEN 系统 SHALL 实现：铀矿 → 核电站 → 电力 → 工业消费
4. WHEN 医药产业链运行 THEN 系统 SHALL 实现：化学品 → 制药厂 → 医药 → 医院消费（增加人口上限/健康度）
5. WHEN 相关产业链配置更新 THEN 系统 SHALL 新增 **electronics_chain**（电子产业链）、**pharmaceutical_chain**（医药产业链），并扩展 power_chain

---

### 需求 6：信息时代(epoch 9)产业链与建筑

**用户故事：** 作为一名玩家，我希望在信息时代体验半导体产业、互联网经济和服务业，以便作为文明发展的终极目标感受到信息革命的全面影响。

#### 验收标准

1. WHEN 玩家解锁信息时代科技 THEN 系统 SHALL 提供以下新建筑（epoch:9）：
   - **半导体工厂**(semiconductor_fab)：电子元件+化学品+电力→半导体
   - **数据中心**(data_center)：半导体+电力→数据
   - **软件公司**(software_company)：数据+电力→服务+科研
   - **互联网平台**(internet_platform)：数据+电力→银币+文化
   - **研究院**(research_institute)：半导体+数据+电力→大量科研
   - **金融中心**(financial_center)：数据+服务→大量银币
   - **购物中心**(shopping_mall)：消费品+服务→银币+文化
   - **太阳能电站**(solar_power_plant)：清洁电力生产
   - **生物科技中心**(biotech_center)：医药+电子元件+数据→超级医药/科研
   - **智能工厂**(smart_factory)：半导体+电力→全品类工业品超高效生产

2. WHEN 半导体产业链运行 THEN 系统 SHALL 实现终极超长链：矿石 → 化学品 → 电子元件 → 半导体 → 数据中心/软件 → 数据/服务
3. WHEN 服务业产业链运行 THEN 系统 SHALL 实现：数据+电力 → 软件/互联网平台 → 服务 → 消费者需求满足
4. WHEN 相关产业链配置更新 THEN 系统 SHALL 新增 **semiconductor_chain**（半导体产业链）、**digital_chain**（数字产业链）、**service_chain**（服务业产业链）

---

### 需求 7：科技树扩展

**用户故事：** 作为一名玩家，我希望每个新时代都有对应的科技树，解锁新建筑和产业升级，以便通过科研驱动文明发展。

#### 验收标准

1. WHEN 蒸汽时代(epoch 6)科技树配置加载 THEN 系统 SHALL 保留现有 epoch 6 的全部 20 个科技不变（仅随时代名称变更），并新增以下科技：
   - 棉花种植(cotton_cultivation) → 棉纺技术(cotton_spinning) → 橡胶加工(rubber_processing)
   - 科技cost范围：12000-20000

2. WHEN 电气时代(epoch 7)科技树定义完成 THEN 系统 SHALL 包含以下科技：
   - 石油钻探(oil_drilling) → 炼油技术(oil_refining) → 内燃机(internal_combustion) → 汽车制造(automobile_manufacturing)
   - 发电技术(electricity_generation) → 电力传输(power_transmission) → 电气化(electrification)
   - 化工技术(chemical_engineering) → 合成材料(synthetic_materials)
   - 电话技术(telephony) → 大众零售(mass_retail)
   - 科技cost范围：20000-35000

3. WHEN 原子时代(epoch 8)科技树定义完成 THEN 系统 SHALL 包含以下科技：
   - 核物理(nuclear_physics) → 核能发电(nuclear_power) → 铀浓缩(uranium_enrichment)
   - 晶体管(transistor) → 集成电路(integrated_circuit) → 电子工业(electronics_industry)
   - 抗生素(antibiotics) → 制药工业(pharmaceutical_industry) → 公共卫生(public_health)
   - 消费电子(consumer_electronics) → 电视广播(television_broadcasting)
   - 科技cost范围：35000-55000

4. WHEN 信息时代(epoch 9)科技树定义完成 THEN 系统 SHALL 包含以下科技：
   - 光刻技术(photolithography) → 半导体制造(semiconductor_manufacturing) → 芯片设计(chip_design)
   - 互联网(internet) → 云计算(cloud_computing) → 人工智能(artificial_intelligence)
   - 可再生能源(renewable_energy) → 太阳能发电(solar_power)
   - 金融工程(financial_engineering) → 数字经济(digital_economy)
   - 基因工程(genetic_engineering) → 生物技术(biotechnology)
   - 科技cost范围：55000-85000

5. WHEN 科技定义完成 THEN 系统 SHALL 确保每个科技包含：id, name, desc, cost, epoch, effects, prerequisites（如有），遵循 `src/config/technologies.js` 中现有 TECHS 范式

---

### 需求 8：社会阶层扩展

**用户故事：** 作为一名玩家，我希望新时代引入新的社会阶层，以便体现工业化和信息化带来的社会结构变革。

#### 验收标准

1. WHEN 电气时代(epoch 7)解锁 THEN 系统 SHALL 引入以下新阶层（遵循 `src/config/strata.js` 中 STRATA 数据范式）：
   - **技术工人**(technician)：操作电气设备和复杂机械的熟练工，介于工人和工程师之间
   - 阶层需包含完整字段：name, icon, weight, tax, headTaxBase, desc, wealthWeight, influenceBase, startingWealth, defaultResource, needs, luxuryNeeds, buffs

2. WHEN 原子时代(epoch 8)解锁 THEN 系统 SHALL 引入以下新阶层：
   - **科学家**(scientist)：高级知识工作者，从事核物理/化学/电子研究
   - **医生**(doctor)：专业服务阶层，在医院和制药厂工作

3. WHEN 信息时代(epoch 9)解锁 THEN 系统 SHALL 引入以下新阶层：
   - **程序员**(programmer)：信息时代核心劳动力，在软件公司和数据中心工作
   - **企业家**(entrepreneur)：创新型资本家，拥有互联网平台和高科技企业

4. WHEN 新阶层定义完成 THEN 系统 SHALL 确保新阶层的需求体系（needs + luxuryNeeds）包含新时代资源，且 wealthElasticity 和 maxConsumptionMultiplier 等参数符合社会地位设定
5. IF 新阶层需要被新建筑的 jobs 字段引用 THEN 系统 SHALL 在相应建筑中添加对应工作岗位
6. WHEN 新阶层的 needs 定义完成 THEN 系统 SHALL 确保需求链合理：低阶层需要基础消费品(food/cloth) → 中阶层增加工业品需求(tools/furniture) → 高阶层增加新时代资源需求(electronics/services/data)

---

### 需求 9：现有产业链延长与升级

**用户故事：** 作为一名玩家，我希望现有的产业链（粮食、木材、纺织、采矿、知识、奢侈品、军事）在新时代得到延长和升级，以便感受到产业的持续进化。

#### 验收标准

1. WHEN 蒸汽时代解锁 THEN 系统 SHALL 在 textile_chain 中新增阶段：棉花种植 → 棉纺厂 → 大规模成衣生产
2. WHEN 电气时代解锁 THEN 系统 SHALL 在 mining_chain 中新增阶段：石油开采 → 炼油 → 化工，将采矿链延伸到石化领域
3. WHEN 电气时代解锁 THEN 系统 SHALL 在 food_chain 中新增阶段：化肥应用 → 机械化农业升级 → 冷链食品加工
4. WHEN 原子时代解锁 THEN 系统 SHALL 在 knowledge_chain 中新增阶段：电视传播 → 大众传媒 → 知识普及
5. WHEN 信息时代解锁 THEN 系统 SHALL 在 knowledge_chain 中新增阶段：互联网传播 → 数字化知识 → 信息时代教育
6. WHEN 产业链延长完成 THEN 系统 SHALL 更新 CHAIN_DEVELOPMENT_PATHS（`src/config/industryChains.js`）中对应产业链的发展路径
7. WHEN 军事产业链延长 THEN 系统 SHALL 新增：
   - 电气时代：汽车工厂→装甲车辆
   - 原子时代：军工综合体→高级军事装备（电子元件+钢材+化学品）
   - 信息时代：精确制导武器（半导体+电子元件）

---

### 需求 10：数值平衡与经济一致性

**用户故事：** 作为一名玩家，我希望新时代的经济系统与现有系统保持一致的数值递进感，以便游戏节奏平滑且不出现通胀/通缩失控。

#### 验收标准

1. WHEN 新时代的 bonuses 被定义 THEN 系统 SHALL 保持各加成值的递增趋势与现有曲线一致
2. WHEN 新建筑的 baseCost 被定义 THEN 系统 SHALL 确保同类型建筑的建造成本呈合理递增（约 1.5-2x 每时代）
3. WHEN 新建筑的 output/input 被定义 THEN 系统 SHALL 确保人均产出递增约 1.3-1.5x 每时代，且消耗的中间品比例合理
4. WHEN 新资源的 basePrice 和 marketConfig 被定义 THEN 系统 SHALL 确保价格层级合理（原材料 < 工业品 < 奢侈品 < 高级制成品）
5. WHEN 新科技的 cost 被定义 THEN 系统 SHALL 确保科研成本在各时代区间内合理递增
6. WHEN 时代升级 cost 被定义 THEN 系统 SHALL 确保升级所需的资源中包含该时代的新资源（如电气时代升级需要石油，原子时代需要电子元件），形成资源需求拉动
7. IF 新产业链形成循环依赖（A→B→A） THEN 系统 SHALL 打破循环，确保单向流动
8. WHEN 生产消费循环运行 THEN 系统 SHALL 确保新资源的供需能在市场定价中自然平衡（遵循现有 ECONOMIC_INFLUENCE 机制）

---

### 需求 11：建筑链与 UI 配置更新

**用户故事：** 作为一名玩家，我希望新建筑在 UI 上正确显示在对应的建筑链中，并在合适的时机解锁，以便管理产业时一目了然。

#### 验收标准

1. WHEN 新建筑被添加 THEN 系统 SHALL 更新 BUILDING_CHAINS（`src/config/buildingChains.js`）配置，将新建筑加入对应链或创建新链
2. WHEN 新建筑链被创建 THEN 系统 SHALL 包含完整的链配置：name, icon, primaryOutput, buildings 数组
3. WHEN BUILDING_TO_CHAIN 反向索引构建 THEN 系统 SHALL 自动包含所有新建筑的映射
4. WHEN 新建筑的 visual 被定义 THEN 系统 SHALL 为每个建筑分配符合类别的 icon、color（bg-xxx）、text（text-xxx）
5. IF 同一建筑链中有多个时代的建筑 THEN 系统 SHALL 确保后续建筑的人均产出高于前序建筑（构成升级关系）
6. WHEN 需要新增建筑链 THEN 系统 SHALL 至少创建以下新链：石化链(petrochemical)、电力链(power)、汽车链(automotive)、电子链(electronics)、医药链(pharmaceutical)、半导体链(semiconductor)、数字服务链(digital_services)

---

### 需求 12：系统联动配置更新

**用户故事：** 作为一名玩家，我希望新时代的产业链与国家特性、政令、产业协同等系统正确联动，以便策略选择有意义。

#### 验收标准

1. WHEN 新产业链被添加 THEN 系统 SHALL 更新 CHAIN_NATION_BONUSES（`src/config/industryChains.js`），为不同国家模板提供新产业链的差异化加成
2. WHEN 新产业链被添加 THEN 系统 SHALL 更新 CHAIN_DECREE_EFFECTS，使现有政令和新增政令影响新产业链
3. WHEN 新产业链被添加 THEN 系统 SHALL 更新 CHAIN_SYNERGIES，定义新产业链之间以及新旧产业链之间的协同效率加成
4. WHEN 新时代效果被定义 THEN 系统 SHALL 更新 EPOCH_SYSTEM_EFFECTS（`src/config/systemSynergies.js`）中对应时代的系统效果
5. IF 新阶层与新建筑交互 THEN 系统 SHALL 更新 CHAIN_CLASS_INTERACTION 中阶层与产业链的联动

---

## 边界情况与技术限制

### 边界情况
- **旧存档兼容**：epoch 6 从"工业时代"改名为"蒸汽时代"、epoch 7 从"信息时代"改名为"电气时代"后，旧存档中的 epoch 数值仍然有效（数字未变），只需处理名称显示即可
- **空时代问题**：如果玩家快速跳过某个时代，确保不会因为缺少中间资源而导致后续产业链断裂——每个时代应有自给自足的基础建筑
- **虚拟资源处理**：电力(electricity)作为虚拟能源需要特殊处理——不进入市场交易，只在建筑间实时产消
- **阶层过多**：新增阶层后总计 21+ 个阶层，需确保人口分配系统和 UI 能处理
- **epoch 数组扩展**：EPOCHS 数组从 8 个扩展到 10 个，需确认所有引用 EPOCHS 的代码不假定数组长度

### 技术限制
- 所有配置在 `src/config/` 目录下的对应文件中扩展
- 产业链逻辑在 `src/logic/simulation.js` 的 tick 循环中处理
- 市场价格系统 `src/logic/economy/prices.js` 需支持新资源
- UI 组件需要处理更多的建筑和资源显示
- 电力系统可能需要在现有 `simulation.js` 中扩展"能源网络"概念（作为虚拟资源的产消匹配）

### 成功标准
- 10 个时代（epoch 0-9），前 6 个时代（0-5）完全不受影响
- 蒸汽时代(6)保留现有 16 个建筑 + 3-4 个新增建筑
- 电气时代(7)新增 8-10 个专属建筑
- 原子时代(8)新增 8-10 个专属建筑
- 信息时代(9)新增 8-10 个专属建筑
- 每个新时代 8-15 个专属科技
- 新增 13 种资源
- 新增 5 个社会阶层
- 7+ 条新建筑链
- 所有数值符合现有递进曲线
- 不破坏现有游戏前 6 个时代（epoch 0-5）的任何功能
