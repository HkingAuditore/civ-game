# 需求文档：时代扩展与超长产业链全面升级

## 引言

当前游戏有8个时代（石器→信息），26种资源，6条主要产业链，产业链最长4阶段。核心问题：
1. **产业链太短**：大多数链只有采集→加工→消费3步，缺乏深度
2. **后期空洞**：工业时代(epoch 6)内容尚可但信息时代(epoch 7)完全空壳
3. **缺乏中间品**：没有足够的中间加工品让产业链变长

本需求旨在**保留启蒙时代(epoch 5)不变**，将现有「工业→信息」替换为**「蒸汽→电气→原子→信息」**四时代，核心设计理念：
- **旧资源新生命**：wood/iron/copper/coal/cloth/stone/tools/plank/brick/papyrus/dye 等全部在新产业中被大量复用为投入品
- **超长产业链**：引入大量中间品，使产业链达到 5-8 个加工阶段
- **交织网络**：不同产业链通过共享中间品形成复杂的供需网络
- **数值一致**：所有新内容严格遵循现有经济模型和数据范式

### 设计原则

1. **严格遵循现有范式**：数据结构、命名规则、数值体系完全一致
2. **旧资源深度复用**：每种旧资源至少在2-3条新产业链中作为投入品
3. **超长产业链**：单条链最长 6-8 步加工，最短 4 步
4. **中间品枢纽**：化学品/塑料/电子元件等中间品被多条链共享，形成供需枢纽
5. **经济模型一致**：遵循抽象市场模型（供需→价格→工资→税收反馈循环）
6. **保留 epoch 0-5 完全不变**

### 时代体系映射

| 现有时代 | 现有 epoch | 重构后 | 新 epoch | 变更说明 |
|---------|-----------|--------|----------|---------|
| 石器~启蒙 | 0-5 | 不变 | 0-5 | **完全不变** |
| 工业时代 | 6 | **蒸汽时代** | 6 | 改名，保留全部16个建筑+20个科技 |
| 信息时代 | 7 | **电气时代** | 7 | 改名，填充全新内容（原epoch 7空壳） |
| (无) | - | **原子时代** | 8 | 全新时代 |
| (无) | - | **信息时代** | 9 | 全新终极时代 |

### 现有资源在新时代的复用规划（核心！）

这是本次设计的灵魂——旧资源不会在新时代变成废物，而是成为新产业链的关键投入品：

| 旧资源 | 现有用途 | 蒸汽时代新用途 | 电气时代新用途 | 原子时代新用途 | 信息时代新用途 |
|--------|---------|-------------|-------------|-------------|-------------|
| **wood** | 建筑/家具/船 | 蒸汽机燃料、枕木(铁路)、工业包装 | 电线杆、建筑模板 | 建筑模板 | 生态建材 |
| **iron** | 工具/武器 | 蒸汽锅炉、铁轨、管道 | 电机铁芯、汽车底盘 | 核反应堆容器 | - |
| **copper** | 青铜器/工具 | 蒸汽管道、电报线 | **电线电缆**(大量！)、电子元件 | 电路板、导线 | 芯片布线 |
| **coal** | 蒸汽工厂燃料 | 所有蒸汽建筑燃料 | **发电厂燃料**、化工原料 | 活性炭/化工 | - |
| **cloth** | 衣物 | 工业织带/滤布 | 汽车内饰、绝缘材料 | 防护服 | - |
| **stone** | 建筑 | 工厂地基 | 水坝/电站地基 | 核电站屏蔽层 | 数据中心地基 |
| **brick** | 建筑 | 工厂建筑 | 发电厂建筑 | 高层建筑 | 数据中心 |
| **tools** | 生产工具 | 蒸汽机维护 | 汽车组装工具 | 精密仪器 | 半导体工具 |
| **plank** | 家具/建筑 | 铁路枕木、包装箱 | 建筑模板 | - | - |
| **papyrus** | 书籍/文化 | 蒸汽时代报纸 | 电气时代媒体 | 科研论文 | 知识数据化 |
| **dye** | 华服 | 合成染料原料 | 化学品原料 | 药品着色 | - |
| **steel** | 军工/工业 | 铁路/蒸汽机 | **汽车/电站**(大量！) | 核电/航天 | 智能工厂 |

---

## 需求

### 需求 1：时代体系重构

**用户故事：** 作为一名玩家，我希望在启蒙时代之后经历蒸汽、电气、原子、信息四个时代，感受完整文明发展历程。

#### 验收标准

1. WHEN 玩家查看时代列表 THEN 系统 SHALL 显示 10 个时代：石器(0)→青铜(1)→古典(2)→封建(3)→探索(4)→启蒙(5)→蒸汽(6)→电气(7)→原子(8)→信息(9)
2. WHEN 时代 0-5 配置加载 THEN 系统 SHALL 完全保留现有数据不做任何修改
3. WHEN 蒸汽时代(epoch 6) THEN 系统 SHALL 将现有工业时代 name 改为"蒸汽时代"，保留 req/cost/bonuses
4. WHEN 电气时代(epoch 7) THEN 系统 SHALL 改名"电气时代"，调整 req/cost/bonuses（科研≥35000，人口≥1000，文化≥8000）
5. WHEN 原子时代(epoch 8)新增 THEN 系统 SHALL 设置（科研≥55000，人口≥1500，文化≥15000）
6. WHEN 信息时代(epoch 9)新增 THEN 系统 SHALL 设置（科研≥85000，人口≥2200，文化≥25000）
7. WHEN 时代 bonuses 定义 THEN 系统 SHALL 确保递增：gatherBonus 2.0→3.0→4.0→5.0, industryBonus 2.0→3.0→4.5→6.0, scienceBonus 1.2→2.0→3.5→5.0
8. WHEN 时代升级 cost 定义 THEN 系统 SHALL 包含该时代新资源（电气需石油、原子需电子元件、信息需半导体），拉动新产业链
9. WHEN 新时代 color/bg/tileColor 定义 THEN 系统 SHALL 为每个时代分配独特 Tailwind 颜色

---

### 需求 2：新资源引入（大幅扩展版）

**用户故事：** 作为一名玩家，我希望后期时代有大量新资源类型，特别是中间加工品，使产业链变得更长更复杂。

#### 2.1 蒸汽时代(epoch 6)新资源

1. WHEN 进入蒸汽时代 THEN 系统 SHALL 解锁：
   - **棉花**(cotton)：基础纺织原材料，tags:['raw'], basePrice:3, 被棉纺厂/化工厂消耗
   - **橡胶**(rubber)：工业原材料，tags:['raw','industrial'], basePrice:5, 被汽车/电缆消耗
   - **水泥**(cement)：中间建材品，tags:['intermediate','industrial'], basePrice:8, 由石料+�ite+coal制造，被大型建筑消耗。**关键复用**：消耗stone+coal（旧资源）
   - **玻璃**(glass)：中间工业品，tags:['intermediate','industrial'], basePrice:10, 由stone(砂)+coal制造，被建筑/电子消耗。**关键复用**：消耗stone+coal

#### 2.2 电气时代(epoch 7)新资源

2. WHEN 进入电气时代 THEN 系统 SHALL 解锁：
   - **石油**(oil)：战略能源，tags:['raw','energy'], basePrice:6
   - **电力**(electricity)：虚拟能源(type:'virtual_energy')，不进市场交易，实时产消
   - **化学品**(chemicals)：关键中间品！tags:['intermediate','industrial'], basePrice:15。由coal+oil+dye制造。**关键复用**：消耗coal+dye（旧资源）
   - **电线电缆**(wiring)：中间工业品，tags:['intermediate','industrial'], basePrice:12。由copper+rubber制造。**关键复用**：消耗copper（旧资源，大量！）
   - **机械零件**(machinery)：中间工业品，tags:['intermediate','industrial'], basePrice:20。由steel+iron+tools制造。**关键复用**：消耗steel+iron+tools（全部旧资源！）
   - **车辆**(vehicles)：高级制成品，tags:['manufactured','military'], basePrice:45。由steel+rubber+machinery+glass制造
   - **化肥**(fertilizer)：农业中间品，tags:['intermediate'], basePrice:8。由chemicals+coal制造。**关键复用**：消耗coal，直接延长food_chain

#### 2.3 原子时代(epoch 8)新资源

3. WHEN 进入原子时代 THEN 系统 SHALL 解锁：
   - **塑料**(plastics)：关键中间品！tags:['intermediate','industrial'], basePrice:12。由chemicals+oil制造
   - **电子元件**(electronics)：高级中间品！tags:['intermediate','manufactured'], basePrice:35。由copper+wiring+chemicals+glass制造。**关键复用**：消耗copper+glass
   - **铀矿**(uranium)：战略资源，tags:['raw','strategic'], basePrice:8
   - **医药**(medicine)：高级消费品，tags:['manufactured','consumer'], basePrice:30。由chemicals+papyrus(药典)制造。**关键复用**：消耗papyrus
   - **合成纤维**(synthetic_fiber)：中间品，tags:['intermediate'], basePrice:10。由chemicals+oil→取代部分cloth需求，但也需cloth混纺。**关键复用**：与cloth(旧资源)形成互补
   - **铝材**(aluminum)：工业金属，tags:['intermediate','industrial'], basePrice:18。由stone(铝土矿)+coal+electricity制造。**关键复用**：消耗stone+coal
   - **家电**(appliances)：高级消费品，tags:['manufactured','consumer'], basePrice:40。由electronics+plastics+steel+glass制造。**关键复用**：消耗steel+glass

#### 2.4 信息时代(epoch 9)新资源

4. WHEN 进入信息时代 THEN 系统 SHALL 解锁：
   - **半导体**(semiconductors)：尖端工业品，tags:['manufactured','high_tech'], basePrice:100。由electronics+chemicals+copper制造。**关键复用**：消耗copper
   - **数据**(data)：虚拟资源(type:'virtual')，tags:['virtual','high_tech'], basePrice:不适用
   - **软件**(software)：虚拟产品，tags:['virtual','high_tech'], basePrice:60
   - **服务**(services)：虚拟消费品(type:'virtual')，tags:['virtual','consumer'], basePrice:不适用
   - **复合材料**(composites)：终极材料，tags:['manufactured','high_tech'], basePrice:55。由plastics+aluminum+synthetic_fiber+glass制造
   - **精密仪器**(precision_instruments)：尖端工业品，tags:['manufactured','high_tech'], basePrice:80。由electronics+tools+glass制造。**关键复用**：消耗tools+glass

#### 2.5 资源通用规范

5. WHEN 新资源被定义 THEN 系统 SHALL 为每个资源配置完整的 RESOURCES 数据项（name, icon, color, basePrice, minPrice, maxPrice, defaultOwner, unlockEpoch, unlockTech, tags, marketConfig），遵循 gameConstants.js 现有范式
6. IF 资源为虚拟能源类型（电力） THEN 系统 SHALL 标记 type:'virtual_energy'，不可存储，不进入市场交易
7. WHEN basePrice 定义完成 THEN 系统 SHALL 确保价格层级：原材料(3-8) < 中间品(8-20) < 高级工业品(30-55) < 尖端品(60-150)
8. WHEN 新资源设计完成 THEN 系统 SHALL 确保每种旧资源至少被2条新产业链消耗（参见"旧资源复用规划"表）

---

### 需求 3：蒸汽时代(epoch 6)产业链与建筑

**用户故事：** 作为玩家，我希望蒸汽时代不仅有新工业，还能让木材/铁/煤/铜/石料/布料等旧资源成为蒸汽工业的原料。

#### 验收标准

1. WHEN 蒸汽时代配置加载 THEN 系统 SHALL 保留现有 epoch 6 全部 16 建筑（仅改时代名）
2. WHEN 蒸汽时代新科技解锁 THEN 系统 SHALL 新增以下建筑（epoch:6）：
   - **棉花种植园**(cotton_plantation)：采集，产出cotton，雇佣serf/worker
   - **棉纺厂**(cotton_mill)：加工，cotton+dye→fine_clothes（大规模），消耗旧资源dye
   - **橡胶种植园**(rubber_plantation)：采集，产出rubber，雇佣serf/worker
   - **水泥厂**(cement_works)：加工，**stone+coal→cement**，消耗旧资源stone+coal
   - **玻璃工厂**(glass_works)：加工，**stone+coal→glass**，消耗旧资源stone+coal
   - **电报局**(telegraph_office)：市政，消耗copper+papyrus→产出culture+science。消耗旧资源copper+papyrus
   - **蒸汽印刷厂**(steam_press)：加工，papyrus+coal→更多culture+science，升级出版社。消耗旧资源papyrus+coal

3. WHEN 蒸汽时代建筑定义 THEN 系统 SHALL 确保每个建筑含完整字段（id/name/desc/baseCost/input/output/jobs/owner/epoch/cat/requiresTech/visual/marketConfig）
4. WHEN 水泥/玻璃产业运行 THEN 系统 SHALL 实现：stone(旧采集) → 水泥厂/玻璃工厂(新加工) → 后续建筑建材需求，**直接延长 mining_chain**
5. WHEN 棉纺产业运行 THEN 系统 SHALL 实现：cotton(新采集) + dye(旧资源) → 棉纺厂 → fine_clothes(旧消费品大规模生产)，**直接延长 textile_chain**
6. WHEN 电报系统运行 THEN 系统 SHALL 实现：copper(旧原料) + papyrus(旧原料) → 电报局 → culture+science，**让铜和纸在后期仍有价值**

---

### 需求 4：电气时代(epoch 7)产业链与建筑

**用户故事：** 作为玩家，我希望电气时代引入石油化工、电力、汽车等第二次工业革命产业链，且旧资源（煤/铜/铁/钢/工具/染料）是这些新产业的关键投入品。

#### 验收标准

1. WHEN 电气时代科技解锁 THEN 系统 SHALL 新增以下建筑（epoch:7）：
   - **油田**(oil_well)：采集，产出oil
   - **炼油厂**(oil_refinery)：加工，oil+coal→chemicals（**煤是关键投入！**）
   - **燃煤电厂**(coal_power_plant)：能源，**coal→electricity**（让煤在电气时代仍是核心资源！）
   - **火力电厂**(thermal_power_plant)：能源，oil→更多electricity
   - **化工厂**(chemical_plant)：关键加工，chemicals+dye→高级化学品/化肥（**染料变工业原料！**）
   - **电线工厂**(wiring_factory)：加工，**copper+rubber→wiring**（铜的新生命！大量消耗！）
   - **机械厂**(machinery_plant)：加工，**steel+iron+tools→machinery**（三种旧资源全用！）
   - **汽车工厂**(automobile_factory)：高级，steel+rubber+machinery+glass→vehicles
   - **化肥厂**(fertilizer_plant)：加工，chemicals+coal→fertilizer（**煤的又一出路！**）
   - **电气纺织厂**(electric_textile_mill)：升级，cotton+cloth+electricity→大量fine_clothes（**旧布料+新棉花混合！**）
   - **百货商场**(department_store)：商业，消耗多种消费品→silver+culture
   - **现代医院**(modern_hospital)：市政，增加人口上限/增长率

2. WHEN 石化产业链运行 THEN 系统 SHALL 实现超长链：oil(采集)→炼油厂(+coal→chemicals)→化工厂(+dye→高级化学品)→化肥厂→农业消费 **链长5步，复用coal+dye**
3. WHEN 电力产业链运行 THEN 系统 SHALL 实现：coal/oil→电厂→electricity→工业建筑消费，**让煤成为电气时代的核心战略资源**
4. WHEN 汽车产业链运行 THEN 系统 SHALL 实现超长链：iron+steel(矿)+copper(铜线)+rubber(橡胶)→machinery+wiring+glass→automobile_factory→vehicles **链长6步，复用iron+steel+copper+tools**
5. WHEN 化肥投入food_chain THEN 系统 SHALL 使machine_farm消耗fertilizer获得产量加成，**直接延长粮食产业链**
6. WHEN 电线产业运行 THEN 系统 SHALL 大量消耗copper，**使铜矿在电气时代需求暴增**
7. WHEN 相关产业链配置更新 THEN 系统 SHALL 新增 petrochemical_chain、automotive_chain、power_chain，并延长 mining_chain/food_chain/textile_chain

---

### 需求 5：原子时代(epoch 8)产业链与建筑

**用户故事：** 作为玩家，我希望原子时代体验核能、电子工业、医药、消费品大规模生产，且旧资源（铜/钢/煤/石料/纸张/玻璃/工具）深度参与新产业。

#### 验收标准

1. WHEN 原子时代科技解锁 THEN 系统 SHALL 新增以下建筑（epoch:8）：
   - **铀矿**(uranium_mine)：采集，产出uranium
   - **核电站**(nuclear_power_plant)：能源，uranium+**steel**(容器)+**stone**(屏蔽)→大量electricity。**复用steel+stone**
   - **塑料工厂**(plastics_factory)：加工，chemicals+oil→plastics
   - **电子工厂**(electronics_factory)：关键加工，**copper+wiring+chemicals+glass**→electronics。**铜/玻璃的新生命！**
   - **制药厂**(pharmaceutical_plant)：加工，chemicals+**papyrus**(药典研究)→medicine。**纸张的新生命！**
   - **合成纤维厂**(synthetic_fiber_plant)：加工，chemicals+oil→synthetic_fiber（与cloth互补）
   - **铝冶炼厂**(aluminum_smelter)：加工，**stone**(铝土)+**coal**+electricity→aluminum。**石料+煤的新生命！**
   - **家电工厂**(appliance_factory)：高级，electronics+plastics+**steel**+glass→appliances。**复用steel**
   - **电视台**(television_station)：文化，electronics+electricity→大量culture
   - **高层公寓**(high_rise_apartment)：住房，需cement+**steel**+glass，大量maxPop
   - **军工综合体**(military_complex)：军事，electronics+**steel**+chemicals→高级军备

2. WHEN 电子产业链运行 THEN 系统 SHALL 实现终极超长链：**copper**(采集)→wiring(+rubber)→**electronics**(+chemicals+glass)→**appliances**(+plastics+steel)→消费。**链长6步，复用copper/glass/steel**
3. WHEN 核能产业链运行 THEN 系统 SHALL 实现：uranium+**steel+stone**→核电站→electricity→工业消费
4. WHEN 医药产业链运行 THEN 系统 SHALL 实现：coal+oil+dye→chemicals→**chemicals+papyrus**→medicine→医院消费。**链长5步，复用coal/dye/papyrus**
5. WHEN 铝材产业运行 THEN 系统 SHALL 实现：**stone+coal**+electricity→aluminum→复合材料/航空。**石料和煤在原子时代仍是关键投入！**
6. WHEN 相关产业链配置更新 THEN 系统 SHALL 新增 electronics_chain、pharmaceutical_chain、aluminum_chain，延长 power_chain/mining_chain

---

### 需求 6：信息时代(epoch 9)产业链与建筑

**用户故事：** 作为玩家，我希望信息时代有半导体、互联网、服务业等终极产业，且旧资源仍通过长链间接参与。

#### 验收标准

1. WHEN 信息时代科技解锁 THEN 系统 SHALL 新增以下建筑（epoch:9）：
   - **半导体工厂**(semiconductor_fab)：尖端加工，electronics+chemicals+**copper**→semiconductors。**铜的终极用途！**
   - **数据中心**(data_center)：信息，semiconductors+electricity+**cement**(建筑)+**steel**(机架)→data
   - **软件公司**(software_company)：信息，data+electricity→software+science
   - **互联网平台**(internet_platform)：商业，data+software+electricity→silver+culture
   - **研究院**(research_institute)：科研，semiconductors+data+**papyrus**(论文)+electricity→大量science。**纸张的终极用途！**
   - **金融中心**(financial_center)：商业，data+software→大量silver
   - **购物中心**(shopping_mall)：商业，消费品+services+**cement**(建筑)→silver+culture
   - **太阳能电站**(solar_power_plant)：清洁能源，**glass**(太阳能板)+aluminum→electricity。**玻璃的终极用途！**
   - **复合材料厂**(composites_factory)：加工，plastics+aluminum+synthetic_fiber+**glass**→composites
   - **精密仪器厂**(precision_instruments_factory)：尖端，electronics+**tools**+**glass**→precision_instruments。**工具+玻璃的终极用途！**
   - **智能工厂**(smart_factory)：终极工业，semiconductors+electricity→全品类工业品超高效
   - **生物科技中心**(biotech_center)：尖端，medicine+electronics+data→超级医药/science

2. WHEN 半导体产业链运行 THEN 系统 SHALL 实现终极超长链：**copper**(矿)→wiring→electronics→semiconductors→data_center→software→services。**链长7步，从青铜时代的铜矿一路到信息时代的软件！**
3. WHEN 服务业产业链运行 THEN 系统 SHALL 实现：data+software→互联网平台/金融中心→services→消费
4. WHEN 太阳能产业运行 THEN 系统 SHALL 实现：**stone**(砂)→**glass**→太阳能电站→electricity。**石料经历了整个文明的旅程**
5. WHEN 相关产业链配置更新 THEN 系统 SHALL 新增 semiconductor_chain、digital_chain、service_chain、composites_chain

---

### 需求 7：旧产业链延长升级（核心需求！）

**用户故事：** 作为玩家，我希望现有的6条产业链在新时代都得到实质性延长，而不仅仅是添加独立的新链。

#### 7.1 粮食产业链延长

1. WHEN 电气时代解锁 THEN 系统 SHALL 在 food_chain 新增：化肥厂(chemicals+coal→fertilizer) → 机械化农场消耗fertilizer获得产量加成
2. WHEN 原子时代解锁 THEN 系统 SHALL 在 food_chain 新增：冷链运输(vehicles+electricity→食品保鲜加成) → 超市(多种食品→silver+culture)
3. 延长后链长：farm→granary→culinary_kitchen→cannery→fertilizer_plant→supermarket = **6步**

#### 7.2 木材产业链延长

4. WHEN 蒸汽时代解锁 THEN 系统 SHALL 在 wood_chain 新增：工业包装厂(plank+iron→包装箱，被工业建筑消耗)
5. WHEN 电气时代解锁 THEN 系统 SHALL 在 wood_chain 新增：木材+chemicals→合成板材(替代部分plank需求)
6. 延长后链长：lumber→sawmill→furniture_workshop→packaging_factory→synthetic_board = **5步**

#### 7.3 纺织产业链延长

7. WHEN 蒸汽时代解锁 THEN 系统 SHALL 在 textile_chain 新增：棉花种植→棉纺厂(cotton+dye→大规模fine_clothes)
8. WHEN 电气时代解锁 THEN 系统 SHALL 新增：电气纺织厂(cotton+cloth+electricity→更多fine_clothes)
9. WHEN 原子时代解锁 THEN 系统 SHALL 新增：合成纤维厂(chemicals+oil→synthetic_fiber) → 高级服装(synthetic_fiber+cloth→终极华服)
10. 延长后链长：loom→dye_works→tailor→cotton_mill→electric_textile→synthetic_fiber→designer_fashion = **7步**

#### 7.4 采矿产业链延长

11. WHEN 蒸汽时代解锁 THEN 系统 SHALL 在 mining_chain 新增：水泥厂/玻璃厂(stone+coal→cement/glass)
12. WHEN 电气时代解锁 THEN 系统 SHALL 新增：电线工厂(copper→wiring)、机械厂(steel+iron+tools→machinery)
13. WHEN 原子时代解锁 THEN 系统 SHALL 新增：电子工厂(copper+wiring+chemicals→electronics)、铝冶炼(stone+coal→aluminum)
14. WHEN 信息时代解锁 THEN 系统 SHALL 新增：半导体(electronics+copper→semiconductors)
15. 延长后链长：quarry→smelter→steel_mill→wiring_factory→electronics_factory→semiconductor_fab = **6步**

#### 7.5 知识产业链延长

16. WHEN 蒸汽时代解锁 THEN 系统 SHALL 在 knowledge_chain 新增：蒸汽印刷厂(papyrus+coal→大量culture+science)
17. WHEN 电气时代解锁 THEN 系统 SHALL 新增：电话交换局(wiring+electricity→culture)、广播站
18. WHEN 原子时代解锁 THEN 系统 SHALL 新增：电视台(electronics+electricity→大量culture)
19. WHEN 信息时代解锁 THEN 系统 SHALL 新增：互联网平台(data+software→culture+silver)、研究院(semiconductors+data+papyrus→大量science)
20. 延长后链长：reed_works→library→university→steam_press→broadcast→television→internet_platform = **7步**

#### 7.6 军事产业链延长

21. WHEN 电气时代解锁 THEN 系统 SHALL 在 military_chain 新增：汽车工厂→装甲车辆(vehicles+steel+ordnance)
22. WHEN 原子时代解锁 THEN 系统 SHALL 新增：军工综合体(electronics+steel+chemicals→高级军备)
23. WHEN 信息时代解锁 THEN 系统 SHALL 新增：精确制导武器(semiconductors+electronics→终极军备)
24. 延长后epochRange全部更新到9

#### 7.7 奢侈品产业链延长

25. WHEN 原子时代解锁 THEN 系统 SHALL 在 luxury_chain 新增：家电(electronics+plastics+steel→appliances作为新奢侈消费品)
26. WHEN 信息时代解锁 THEN 系统 SHALL 新增：数字娱乐(data+software→virtual luxury)

---

### 需求 8：科技树扩展

**用户故事：** 作为玩家，我希望每个新时代有足够的科技来解锁新建筑和产业升级。

#### 验收标准

1. WHEN 蒸汽时代(epoch 6)科技树 THEN 系统 SHALL 保留现有20个科技，新增：
   - 棉花种植→棉纺技术→橡胶加工→水泥工艺→玻璃制造→电报技术→蒸汽印刷
   - cost范围12000-20000

2. WHEN 电气时代(epoch 7)科技树 THEN 系统 SHALL 包含：
   - 石油钻探→炼油技术→有机化学→合成化学→化肥生产
   - 发电技术→电力传输→电气化
   - 内燃机→汽车制造→机械工程
   - 电报升级→电话技术→大众零售
   - 电线制造→电气纺织
   - cost范围20000-35000

3. WHEN 原子时代(epoch 8)科技树 THEN 系统 SHALL 包含：
   - 核物理→核能发电→铀浓缩
   - 晶体管→集成电路→电子工业
   - 高分子化学→塑料工业→合成纤维
   - 抗生素→制药工业→公共卫生
   - 铝冶炼→轻合金
   - 消费电子→电视广播
   - cost范围35000-55000

4. WHEN 信息时代(epoch 9)科技树 THEN 系统 SHALL 包含：
   - 光刻技术→半导体制造→芯片设计
   - 互联网→云计算→人工智能
   - 可再生能源→太阳能发电
   - 金融工程→数字经济→服务业
   - 基因工程→生物技术
   - 复合材料→精密仪器
   - cost范围55000-85000

5. WHEN 科技定义 THEN 系统 SHALL 确保每个科技含 id/name/desc/cost/epoch/effects/prerequisites，遵循 technologies.js 范式

---

### 需求 9：社会阶层扩展

**用户故事：** 作为玩家，我希望新时代引入新的社会阶层，且这些阶层的消费需求包含新旧资源的混合。

#### 验收标准

1. WHEN 电气时代解锁 THEN 系统 SHALL 新增阶层（遵循 strata.js 范式）：
   - **技术工人**(technician)：操作电气设备的熟练工。needs含food+cloth(旧)+新时代资源。luxuryNeeds含tools/copper/steel(旧)+chemicals/wiring(新)

2. WHEN 原子时代解锁 THEN 系统 SHALL 新增：
   - **科学家**(scientist)：高级知识工作者。needs含food+cloth+papyrus(旧)。luxuryNeeds含coffee/culture(旧)+electronics/medicine(新)
   - **医生**(doctor)：专业服务阶层。needs含food+cloth(旧)。luxuryNeeds含papyrus/coffee(旧)+medicine/electronics(新)

3. WHEN 信息时代解锁 THEN 系统 SHALL 新增：
   - **程序员**(programmer)：信息时代核心劳动力。needs含food+cloth+coffee(旧)。luxuryNeeds含electronics/furniture(旧)+semiconductors/software/data(新)
   - **企业家**(entrepreneur)：创新型资本家。needs含food+cloth+coffee+furniture(旧)。luxuryNeeds含所有旧奢侈品+新时代尖端品

4. WHEN 新阶层定义 THEN 系统 SHALL 确保：
   - needs基础需求始终包含food+cloth（与所有现有阶层一致）
   - luxuryNeeds的低财富比阈值使用旧资源，高财富比阈值逐步引入新资源
   - 这确保**旧资源永远有消费需求**

5. IF 新阶层被新建筑 jobs 引用 THEN 系统 SHALL 在相应建筑添加工作岗位

---

### 需求 10：产业链网络交织设计（新增核心需求）

**用户故事：** 作为玩家，我希望不同产业链之间通过共享中间品形成复杂的供需网络，而非各自独立运行。

#### 验收标准

1. WHEN chemicals(化学品)被定义 THEN 系统 SHALL 确保它是至少4条链的投入品：石化链/医药链/电子链/合成纤维链/化肥链
2. WHEN electronics(电子元件)被定义 THEN 系统 SHALL 确保它是至少3条链的投入品：家电/军工/半导体/精密仪器
3. WHEN copper(铜)在新时代使用 THEN 系统 SHALL 确保它在电线工厂(大量)、电子工厂、半导体工厂中被消耗，使铜矿从青铜时代一直延续到信息时代
4. WHEN steel(钢)在新时代使用 THEN 系统 SHALL 确保它在机械厂、汽车厂、家电厂、核电站、数据中心中被消耗
5. WHEN glass(玻璃)在新时代使用 THEN 系统 SHALL 确保它在电子工厂、家电厂、太阳能电站、精密仪器厂中被消耗
6. WHEN 产业链交织设计完成 THEN 系统 SHALL 确保无循环依赖（所有资源流单向：原材料→中间品→制成品→消费）
7. WHEN 中间品供需瓶颈出现 THEN 系统 SHALL 通过现有 CHAIN_BOTTLENECKS 机制自动降低相关链效率

---

### 需求 11：数值平衡与经济一致性

**用户故事：** 作为玩家，我希望新时代经济系统与现有系统保持一致的数值递进感。

#### 验收标准

1. WHEN 新建筑 baseCost 定义 THEN 系统 SHALL 确保同类型建筑建造成本约 1.5-2x/时代递增
2. WHEN 新建筑 output/input 定义 THEN 系统 SHALL 确保人均产出约 1.3-1.5x/时代递增
3. WHEN 新资源 marketConfig 定义 THEN 系统 SHALL 设置合理的供需权重/库存目标/弹性：原材料(低弹性高库存) < 中间品(中弹性中库存) < 制成品(高弹性低库存)
4. WHEN 旧资源在新产业中被大量消耗 THEN 系统 SHALL 确保旧资源的供给建筑（如铜矿、煤矿、采石场）在新时代有升级版本或效率加成，防止供不应求导致价格崩溃
5. IF 新产业链形成循环依赖 THEN 系统 SHALL 打破循环确保单向流动
6. WHEN 生产消费循环运行 THEN 系统 SHALL 确保新资源供需在市场定价中自然平衡

---

### 需求 12：建筑链与 UI 配置更新

**用户故事：** 作为玩家，我希望新建筑在 UI 上正确显示在对应的建筑链中。

#### 验收标准

1. WHEN 新建筑添加 THEN 系统 SHALL 更新 BUILDING_CHAINS，将新建筑加入对应链或创建新链
2. WHEN 新建筑链创建 THEN 系统 SHALL 含完整配置：name/icon/primaryOutput/buildings数组
3. WHEN 需要新增建筑链 THEN 系统 SHALL 至少创建：
   - 水泥链(cement_production)：水泥厂→后续建筑
   - 玻璃链(glass_production)：玻璃工厂→后续建筑
   - 石油链(oil_production)：油田→炼油厂
   - 电力链(power_production)：燃煤电厂→火力电厂→核电站→太阳能电站
   - 化学链(chemical_production)：炼油厂→化工厂→化肥厂/塑料厂
   - 电线链(wiring_production)：电线工厂
   - 机械链(machinery_production)：机械厂→汽车厂
   - 电子链(electronics_production)：电子工厂→半导体工厂
   - 医药链(medicine_production)：制药厂→生物科技中心
   - 信息链(data_production)：数据中心→软件公司→互联网平台
4. WHEN BUILDING_TO_CHAIN 反向索引构建 THEN 系统 SHALL 自动包含所有新建筑
5. IF 同链多时代建筑 THEN 系统 SHALL 确保后续建筑人均产出高于前序

---

### 需求 13：系统联动配置更新

**用户故事：** 作为玩家，我希望新产业链与国家特性、政令、产业协同等系统正确联动。

#### 验收标准

1. WHEN 新产业链添加 THEN 系统 SHALL 更新 CHAIN_NATION_BONUSES，为不同国家提供差异化加成
2. WHEN 新产业链添加 THEN 系统 SHALL 更新 CHAIN_DECREE_EFFECTS，使政令影响新链
3. WHEN 新产业链添加 THEN 系统 SHALL 更新 CHAIN_SYNERGIES，定义新旧链之间的协同效率
4. WHEN 新时代效果定义 THEN 系统 SHALL 更新 EPOCH_SYSTEM_EFFECTS
5. IF 新阶层与新建筑交互 THEN 系统 SHALL 更新 CHAIN_CLASS_INTERACTION

---

## 旧资源需求量预估（确保不脱节）

以下是旧资源在新时代的预期需求增长，确保旧资源永不过时：

| 旧资源 | 蒸汽时代需求增量 | 电气时代需求增量 | 原子时代需求增量 | 信息时代需求增量 |
|--------|----------------|----------------|----------------|----------------|
| copper | +20%(电报线) | +80%(电线电缆！) | +40%(电子元件) | +20%(半导体) |
| coal | +30%(蒸汽机) | +60%(发电+化工！) | +20%(铝冶炼) | - |
| stone | +15%(水泥) | +10%(电站地基) | +25%(铝冶炼+核电！) | +10%(太阳能) |
| iron | +10%(铁路) | +30%(机械厂！) | +10% | - |
| steel | +20%(铁路) | +40%(汽车+机械！) | +30%(核电+家电) | +15%(数据中心) |
| tools | +10% | +20%(机械厂) | +10%(精密仪器) | +10%(半导体) |
| cloth | +5% | +15%(电气纺织) | +10%(合成纤维混纺) | - |
| dye | +5%(棉纺) | +20%(化工原料！) | +5%(药品) | - |
| papyrus | +10%(印刷) | +5% | +15%(制药！) | +10%(研究院) |
| wood | +15%(铁路枕木) | +5% | - | - |

---

## 产业链长度对比（改造前 vs 改造后）

| 产业链 | 现有最长步数 | 改造后最长步数 | 增加步数 |
|--------|-----------|-------------|---------|
| food_chain | 3(farm→kitchen→consumption) | 6(+fertilizer+supermarket) | +3 |
| wood_chain | 3(camp→sawmill→furniture) | 5(+packaging+synthetic_board) | +2 |
| textile_chain | 3(loom→dye→tailor) | 7(+cotton_mill+electric+synthetic+designer) | +4 |
| mining_chain | 3(quarry→smelter→factory) | 6(+wiring+electronics+semiconductor) | +3 |
| knowledge_chain | 3(reed→library→university) | 7(+steam_press+broadcast+TV+internet) | +4 |
| military_chain | 5(mine→swords→muskets→rifles→ordnance) | 8(+vehicles+military_complex+guided) | +3 |
| 新：petrochemical | - | 5(oil→refinery→chemical→plastic→consumption) | 全新 |
| 新：electronics | - | 7(copper→wiring→electronics→semiconductor→data→software→service) | 全新 |
| 新：power | - | 4(coal/oil/uranium→power_plant→electricity→industrial) | 全新 |

---

## 边界情况与技术限制

### 边界情况
- **旧存档兼容**：epoch 6/7改名不影响旧存档（数字ID不变）
- **旧资源供给压力**：新产业大量消耗旧资源时，需确保旧资源有升级版采集建筑（如工业矿场/机械化农场已存在），必要时新增更高效版本
- **虚拟资源处理**：electricity/data/services不进市场，需在simulation.js中扩展实时产消匹配
- **阶层过多**：新增5个阶层后共21个，需确保UI和人口分配系统能处理
- **产业链网络复杂度**：中间品被多条链共享，需确保市场定价系统能处理多买家竞争同一资源
- **epoch数组扩展**：EPOCHS从8→10个，需确认所有引用代码不假定数组长度

### 技术限制
- 所有配置在 src/config/ 对应文件中扩展
- 产业链逻辑在 src/logic/simulation.js 的 tick 循环中处理
- 市场价格系统 src/logic/economy/prices.js 需支持新资源
- 电力系统需在 simulation.js 中扩展"能源网络"概念
- UI组件需处理更多建筑和资源显示

### 成功标准
- 10个时代(epoch 0-9)，前6个(0-5)完全不受影响
- **新增约20种资源**（含大量中间品）
- **蒸汽时代(6)**：保留16建筑 + 7个新建筑
- **电气时代(7)**：12个新建筑
- **原子时代(8)**：11个新建筑
- **信息时代(9)**：12个新建筑
- 每个新时代 8-15 个科技
- 新增 5 个社会阶层
- 10+ 条新建筑链
- **每种旧资源至少在2条新产业链中被消耗**
- **最长产业链达7-8步**
- 所有数值符合现有递进曲线
