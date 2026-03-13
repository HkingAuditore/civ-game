# 需求文档：军事系统全面升级

## 引言

本次需求对现有军事系统进行全面升级，涵盖三大核心领域：

1. **军事产业链深化** — 引入随时代演进的军事资源体系：早期时代无专门军需品（军队直接使用基础原料），中期出现刀剑/铠甲，后期引入火枪/火药，最终进入步枪/弹药的工业化军工。配套建设相应的军事生产建筑和科技
2. **战线与军团系统** — 引入战线(Front/Theater)概念，每场战争生成对应战线，玩家可分配军团(Army Corps)及将领，战线上有可掠夺/破坏的资源和建筑
3. **战斗系统增强** — 将战斗从瞬时结算改为持续时间过程，引入更细致的兵种克制、战场态势演变，以及玩家在战斗进行中的干预能力

### 现有系统概况

| 模块 | 现状 | 改进方向 |
|------|------|---------|
| 军事产业链 | 概念性定义(industryChains.js)，无实际军事中间品资源 | 随时代演进的多级军事资源体系 |
| 军事建筑 | 3种(兵营/训练场/要塞)，仅提供militaryCapacity | 新增各时代军事生产建筑 |
| 军事科技 | 2种(military_training/fortification) | 新增覆盖各时代的军事科技树 |
| 兵种系统 | 5类别，20+兵种，已较完善 | 保持现有兵种，增强克制关系细化 |
| 战斗模拟 | simulateBattle()瞬时结算 | 改为多回合/持续时间制，加入战场态势 |
| 战争系统 | AI随机行动(掠夺/攻势/围城)，无战线 | 引入战线系统，军团分配，经济掠夺 |

### 军事资源时代演进设计理念

军事资源体系应反映人类战争技术的真实历史演进，资源命名应具体、有时代感。关键原则：

- **石器时代(Epoch 0) / 青铜时代(Epoch 1)**：没有专门的军需品。民兵/长矛兵/投石兵用木棒、石器、青铜农具武装自己，招募和维护只消耗基础资源(food/wood/copper)
- **古典时代(Epoch 2)**：冶金技术成熟，出现专业化的**刀剑(swords)**，代表铁质刀、剑、矛头等近战金属兵器。剑士、重步兵等兵种需要此资源
- **封建时代(Epoch 3)**：锻造技术进步，出现**铠甲(plate_armor)**，代表铁甲、锁子甲、盾牌等金属防具。重甲步兵、骑士等兵种需要此资源
- **探索时代(Epoch 4)**：火药的发明改变战争形态，出现**火药(gunpowder)**（火器和攻城类兵种的关键消耗材料）和**火枪(muskets)**（代表火绳枪、射石炮等早期火器装备）
- **启蒙时代(Epoch 5)**：枪械技术进步，出现**步枪(rifles)**（代表滑膛枪/线膛枪等精确火器，替代旧式火枪）和**弹药(ammunition)**（代表标准化弹药/炮弹，替代粗糙火药填装）
- **工业时代(Epoch 6)**：军事全面工业化，出现**制式军火(ordnance)**（代表加特林机枪、后装步枪、野战炮等工业化制式武器），实现大规模标准化生产

### 军事资源与兵种对照表

| 时代 | 代表兵种 | 所需军事资源 |
|------|---------|-------------|
| Epoch 0 石器 | 民兵、投石兵 | 无（仅food/wood/stone） |
| Epoch 1 青铜 | 长矛兵、弓箭手、战车 | 无（仅food/wood/copper） |
| Epoch 2 古典 | 剑士、弩手、攻城槌 | **刀剑(swords)** |
| Epoch 3 封建 | 重步兵、弩兵、骑士、投石机 | **刀剑(swords)** + **铠甲(plate_armor)** |
| Epoch 4 探索 | 长枪兵、火绳枪手、胸甲骑兵、射石炮 | **火枪(muskets)** + **火药(gunpowder)**；冷兵器兵种仍需swords/plate_armor |
| Epoch 5 启蒙 | 刺刀火枪兵、线膛枪手、龙骑兵、野战炮 | **步枪(rifles)** + **弹药(ammunition)** |
| Epoch 6 工业 | 线列步兵、加特林机枪组、枪骑兵、重型火炮 | **制式军火(ordnance)** + **弹药(ammunition)** |

---

## 需求

### 需求 1：军事产业链深化

**用户故事：** 作为一名玩家，我希望拥有更丰富、更长且随时代演进的军事产业链（早期没有专门军需品，后来有了刀剑和铠甲，再后来有了火枪，最后有了步枪和制式军火），以便军事力量的建设更有深度、更有时代感和策略性。

#### 1.1 军事资源时代演进体系

##### 验收标准

**Phase 1: 原始与青铜时代 (Epoch 0-1) — 无专门军需品**

1. WHEN 玩家处于石器时代(Epoch 0)或青铜时代(Epoch 1) THEN 系统 SHALL 不提供任何专门的军事资源，兵种的recruitCost和maintenanceCost仅消耗基础资源(food/wood/stone/copper等)
2. IF 玩家在Epoch 0-1招募兵种 THEN 系统 SHALL 体现"民兵化"特征：招募成本低，但兵种没有装备加成

**Phase 2: 古典与封建时代 (Epoch 2-3) — 刀剑与铠甲时代**

3. WHEN 玩家解锁古典时代(Epoch 2)并研究对应科技 THEN 系统 SHALL 解锁"刀剑(swords)"资源，代表铁质刀、剑、矛头等近战金属兵器
4. WHEN 玩家解锁封建时代(Epoch 3)并研究对应科技 THEN 系统 SHALL 解锁"铠甲(plate_armor)"资源，代表铁甲、锁子甲、盾牌等金属防具
5. WHEN Epoch 2+的近战/步兵兵种被招募 THEN 系统 SHALL 在recruitCost中增加swords消耗；Epoch 3+的重装兵种在recruitCost中增加plate_armor消耗
6. IF 军队拥有足够的swords/plate_armor供应 THEN 系统 SHALL 为对应兵种提供攻击/防御装备加成

**Phase 3: 探索时代 (Epoch 4) — 火药革命**

7. WHEN 玩家解锁探索时代(Epoch 4)并研究火药相关科技 THEN 系统 SHALL 解锁"火药(gunpowder)"资源，作为火器和攻城类兵种的关键消耗材料
8. WHEN 玩家进一步研究火器科技 THEN 系统 SHALL 解锁"火枪(muskets)"资源，代表火绳枪、早期火炮等火药武器装备
9. WHEN 火器类兵种(火绳枪手/射石炮等)被招募 THEN 系统 SHALL 在recruitCost中要求muskets；maintenanceCost中持续消耗gunpowder
10. IF 火器类兵种缺少gunpowder补给 THEN 系统 SHALL 大幅降低其战斗力（火枪无弹药等同于烧火棍）
11. WHEN Epoch 4的冷兵器兵种(长枪兵/胸甲骑兵)被招募 THEN 系统 SHALL 仍消耗swords/plate_armor（火药时代冷兵器与火器并存）

**Phase 4: 启蒙时代 (Epoch 5) — 步枪与标准化弹药**

12. WHEN 玩家解锁启蒙时代(Epoch 5)并研究对应科技 THEN 系统 SHALL 解锁"步枪(rifles)"资源，代表滑膛枪/线膛枪等精确火器
13. WHEN 玩家解锁启蒙时代(Epoch 5)并研究对应科技 THEN 系统 SHALL 解锁"弹药(ammunition)"资源，代表标准化弹药/炮弹
14. WHEN Epoch 5的兵种(刺刀火枪兵/线膛枪手/龙骑兵/野战炮)被招募 THEN 系统 SHALL 在recruitCost中要求rifles(替代旧式muskets)；maintenanceCost中消耗ammunition(替代旧式gunpowder)

**Phase 5: 工业时代 (Epoch 6) — 制式军火**

15. WHEN 玩家解锁工业时代(Epoch 6)并研究对应科技 THEN 系统 SHALL 解锁"制式军火(ordnance)"资源，代表加特林机枪、后装步枪、工业化火炮等制式武器
16. WHEN Epoch 6的兵种(线列步兵/加特林机枪组/枪骑兵/重型火炮)被招募 THEN 系统 SHALL 在recruitCost中要求ordnance(替代旧式rifles)；maintenanceCost中消耗ammunition
17. IF 新军事资源在RESOURCES中定义 THEN 系统 SHALL 为每种资源配置完整的市场参数(basePrice/minPrice/maxPrice/marketConfig)，并标记tags包含'military'

#### 1.2 军事生产建筑（随时代演进）

##### 验收标准

1. WHEN 玩家解锁古典时代(Epoch 2)并研究锻造科技 THEN 系统 SHALL 提供"铸剑坊(swordsmith)"建筑，消耗iron+copper生产swords
2. WHEN 玩家解锁封建时代(Epoch 3)并研究铠甲工艺科技 THEN 系统 SHALL 提供"甲胄工坊(armorsmith)"建筑，消耗iron+cloth生产plate_armor
3. WHEN 玩家解锁探索时代(Epoch 4)并研究火药配方科技 THEN 系统 SHALL 提供"火药工坊(powder_mill)"建筑，消耗coal+特定原料生产gunpowder
4. WHEN 玩家解锁探索时代(Epoch 4)并研究火器制造科技 THEN 系统 SHALL 提供"枪炮作坊(gun_workshop)"建筑，消耗iron+gunpowder生产muskets
5. WHEN 玩家解锁启蒙时代(Epoch 5)并研究精密枪械科技 THEN 系统 SHALL 提供"枪械工坊(rifle_works)"建筑，消耗steel+tools生产rifles；并提供"弹药厂(ammo_factory)"建筑，消耗steel+gunpowder生产ammunition
6. WHEN 玩家解锁工业时代(Epoch 6)并研究军事工业化科技 THEN 系统 SHALL 提供"兵工厂(arms_factory)"建筑，消耗steel+coal大规模生产ordnance和ammunition
7. IF 军事生产建筑被定义 THEN 系统 SHALL 确保每个建筑有合理的baseCost/input/output/jobs配置，遵循现有经济平衡原则
8. WHEN 军事生产建筑建造完成 THEN 系统 SHALL 产出对应的军事资源，参与市场交易系统

#### 1.3 军事科技（随时代演进）

##### 验收标准

1. WHEN 玩家研究"锻造术(swordsmithing)"科技(Epoch 2) THEN 系统 SHALL 解锁swords资源和铸剑坊建筑
2. WHEN 玩家研究"铠甲锻造(armor_forging)"科技(Epoch 3) THEN 系统 SHALL 解锁plate_armor资源和甲胄工坊建筑
3. WHEN 玩家研究"火药配方(gunpowder_formula)"科技(Epoch 4) THEN 系统 SHALL 解锁gunpowder资源和火药工坊建筑
4. WHEN 玩家研究"火器制造(musket_manufacturing)"科技(Epoch 4) THEN 系统 SHALL 解锁muskets资源和枪炮作坊建筑，前置科技为gunpowder_formula
5. WHEN 玩家研究"精密枪械(rifle_engineering)"科技(Epoch 5) THEN 系统 SHALL 解锁rifles资源和枪械工坊建筑，并解锁ammunition资源和弹药厂建筑
6. WHEN 玩家研究"军事工业化(military_industrialization)"科技(Epoch 6) THEN 系统 SHALL 解锁ordnance资源和兵工厂建筑，所有军事建筑效率+20%
7. IF 新军事科技被添加 THEN 系统 SHALL 将其整合到现有technologies.js配置中，遵循现有科技树的epoch分布和cost递增规律

#### 1.4 更新军事产业链配置

##### 验收标准

1. WHEN industryChains.js中的military_chain被更新 THEN 系统 SHALL 反映随时代演进的多级加工链：
   - Epoch 0-1: 基础资源(food/wood/copper) → 直接招募民兵/长矛兵
   - Epoch 2: 原料(iron/copper) → **刀剑(swords)** → 装备剑士/重步兵
   - Epoch 3: 原料(iron/cloth) → **铠甲(plate_armor)** → 装备重甲兵/骑士
   - Epoch 4: 原料(coal) → **火药(gunpowder)** → 消耗品; 原料(iron)+gunpowder → **火枪(muskets)** → 装备火绳枪手
   - Epoch 5: 原料(steel/tools) → **步枪(rifles)** → 装备线膛枪手; 原料(steel)+gunpowder → **弹药(ammunition)** → 消耗品
   - Epoch 6: 原料(steel/coal) → **制式军火(ordnance)** → 装备线列步兵/机枪组; 弹药(ammunition)大规模生产
2. IF buildingChains.js存在 THEN 系统 SHALL 新增军事生产链条目，展示从基础到高级的建筑升级路径
3. WHEN 时代进步时 THEN 系统 SHALL 使旧式军事资源仍可生产和使用（不强制淘汰），但新式资源提供更高的装备加成

---

### 需求 2：战线与军团系统

**用户故事：** 作为一名玩家，我希望在与不同国家的战争中出现独立的战线，能够往战线上分配带有将领的军团，战线上有可掠夺/破坏的资源和建筑，以便战争体验更有策略深度，战争能直接影响双方经济。

#### 2.1 战线(Front/Theater)生成

##### 验收标准

1. WHEN 两个国家之间宣战 THEN 系统 SHALL 自动生成一条该战争专属的战线(Front)对象
2. WHEN 战线生成时 THEN 系统 SHALL 根据双方国力、地理特征生成战线上的资源点(resource nodes)和建筑设施(infrastructure)
3. IF 玩家同时与多个国家处于战争状态 THEN 系统 SHALL 为每场战争维护独立的战线，玩家需要在多条战线间分配兵力
4. WHEN 战争结束(和平/投降) THEN 系统 SHALL 销毁或归档对应的战线数据
5. IF 战线上的资源点或建筑被破坏 THEN 系统 SHALL 对拥有方的经济产生实际影响（如减少对应资源产出、降低对应建筑效率）

#### 2.2 军团(Army Corps)系统

##### 验收标准

1. WHEN 玩家拥有军队 THEN 系统 SHALL 允许玩家将部队编组为多个军团(Army Corps)
2. WHEN 创建军团 THEN 系统 SHALL 要求玩家指定军团名称，并从可用兵力中分配兵种和数量
3. WHEN 战线存在 THEN 系统 SHALL 允许玩家将军团分配到特定战线
4. IF 某条战线上没有分配军团 THEN 系统 SHALL 该战线处于无防御状态，敌方行动不会遇到抵抗
5. WHEN 军团被分配到战线 THEN 系统 SHALL 该军团的兵力参与该战线上的所有战斗

#### 2.3 将领(General)系统

##### 验收标准

1. WHEN 玩家拥有军团 THEN 系统 SHALL 允许为军团指派将领
2. WHEN 将领被生成 THEN 系统 SHALL 随机赋予将领属性（如攻击加成/防御加成/速度加成/士气加成等），范围在合理区间内
3. IF 军团拥有将领 THEN 系统 SHALL 将将领的属性加成应用到该军团的战斗计算中
4. WHEN 将领指挥多次战斗 THEN 系统 SHALL 累积将领经验值，允许将领升级提升属性
5. IF 军团没有将领 THEN 系统 SHALL 对该军团施加一个战斗力惩罚（如-15%）

#### 2.4 战线经济掠夺与破坏

##### 验收标准

1. WHEN 战斗在某条战线上进行 THEN 系统 SHALL 允许胜方掠夺战线上的资源点
2. WHEN 资源点被掠夺 THEN 系统 SHALL 将一定比例的资源转移给掠夺方，并降低被掠夺方的资源产出
3. WHEN 战线上的建筑设施被攻击 THEN 系统 SHALL 根据攻击力和建筑耐久度计算破坏程度
4. IF 建筑设施被破坏 THEN 系统 SHALL 降低该建筑的产出效率，直到战后修复
5. WHEN 焦土战术在战线上执行 THEN 系统 SHALL 对战线上所有己方（被执行方的）设施造成大范围破坏
6. IF 战争结束 THEN 系统 SHALL 根据和平条约内容决定战线设施的归属或恢复

---

### 需求 3：战斗系统增强

**用户故事：** 作为一名玩家，我希望战斗不是瞬间完成的，而是一个有持续时间的过程，在这个过程中我的行为、经济状况都会影响战斗结果，以便战斗体验更有游戏性和沉浸感。

#### 3.1 持续时间制战斗

##### 验收标准

1. WHEN 战斗开始 THEN 系统 SHALL 创建一个Battle对象，记录参战双方、开始时间、预计持续回合数
2. WHEN 每个游戏tick(日)推进 THEN 系统 SHALL 对所有进行中的战斗执行一个战斗回合(combat round)，计算该回合的伤亡和态势变化
3. IF 战斗预计持续时间取决于双方兵力规模 THEN 系统 SHALL 计算合理的战斗持续天数（如小规模遭遇战3-5天，大规模会战10-30天，围城30-90天）
4. WHEN 战斗进行中 THEN 系统 SHALL 在军事面板显示战斗进度、当前态势、双方剩余兵力
5. WHEN 某方兵力降至0或士气崩溃 THEN 系统 SHALL 提前结束战斗，宣布另一方胜利

#### 3.2 战场态势系统

##### 验收标准

1. WHEN 战斗进行中 THEN 系统 SHALL 维护一个战场态势值(battle momentum)，反映哪方占据优势
2. WHEN 一方在某回合造成更多伤亡 THEN 系统 SHALL 将态势值向该方倾斜
3. IF 态势值严重偏向一方(如>75%) THEN 系统 SHALL 触发"溃败"效果，劣势方损失加速
4. WHEN 兵种克制关系生效时 THEN 系统 SHALL 在每个战斗回合中独立计算克制加成，而非仅在战斗开始时一次性计算
5. IF 某方获得增援(玩家手动派遣新军团到战线) THEN 系统 SHALL 将增援纳入下一回合的战斗计算

#### 3.3 战斗中的经济影响

##### 验收标准

1. WHEN 战斗进行中 THEN 系统 SHALL 持续消耗参战军团的补给（food以及当前时代对应的军事消耗品：gunpowder/ammunition等）
2. IF 参战方补给耗尽 THEN 系统 SHALL 对该方军队施加战斗力惩罚（如-30%攻击，-20%防御）
3. WHEN 战斗持续时间超过一定阈值 THEN 系统 SHALL 增加补给消耗速率（战争消耗加速）
4. IF 玩家通过建设/贸易恢复了补给 THEN 系统 SHALL 自动解除补给不足的惩罚
5. WHEN 战斗结束 THEN 系统 SHALL 根据战果计算战利品，战利品规模与战斗持续时间和破坏程度正相关

#### 3.4 玩家战斗干预

##### 验收标准

1. WHEN 战斗正在进行 THEN 系统 SHALL 允许玩家执行战术操作（如：集中攻击某兵种、防御姿态切换、撤退命令）
2. WHEN 玩家下达"集中攻击"指令 THEN 系统 SHALL 在下一回合计算中优先对目标兵种分配伤害
3. WHEN 玩家下达"防御姿态"指令 THEN 系统 SHALL 提升己方防御加成，降低攻击输出
4. WHEN 玩家下达"撤退"指令 THEN 系统 SHALL 在1-3回合内完成撤退，撤退期间受到额外追击伤害
5. IF 玩家向进行中的战斗派遣增援军团 THEN 系统 SHALL 在增援到达后（延迟1-3回合）将其加入战斗

#### 3.5 增强兵种克制与能力系统

##### 验收标准

1. WHEN 战斗计算时 THEN 系统 SHALL 基于现有的5类兵种克制关系(步兵↔骑兵↔弓箭↔步兵/火器↔...)进行每回合计算
2. IF 某方兵种构成严重被克制(如纯步兵对抗大量弓箭手) THEN 系统 SHALL 在战斗报告中明确指出克制劣势并量化影响
3. WHEN 兵种拥有特殊能力(如范围伤害/冲锋/坚守/穿甲) THEN 系统 SHALL 在每个回合中根据战场态势动态触发这些能力效果
4. IF 军事资源(swords/plate_armor/muskets/rifles/ordnance)充足 THEN 系统 SHALL 将装备质量纳入兵种战斗力计算（如有充足plate_armor的步兵获得额外防御加成，有ordnance的部队获得攻击加成）

---

### 需求 4：UI展示与交互

**用户故事：** 作为一名玩家，我希望在军事面板中能清晰地看到战线状态、军团部署、进行中的战斗，并方便地进行军事操作，以便做出明智的军事决策。

#### 4.1 战线视图

##### 验收标准

1. WHEN 存在活跃的战争 THEN 系统 SHALL 在军事面板中显示每条战线的概览（敌方国家、双方兵力对比、战线资源点状态）
2. WHEN 玩家点击某条战线 THEN 系统 SHALL 展开战线详情，显示己方军团列表、敌方估计兵力、战线上的资源和建筑
3. IF 战线上有进行中的战斗 THEN 系统 SHALL 在战线视图中高亮显示战斗状态和进度

#### 4.2 军团管理界面

##### 验收标准

1. WHEN 玩家打开军团管理 THEN 系统 SHALL 显示所有已创建的军团列表，包括各军团的兵力构成、将领信息、当前部署位置
2. WHEN 玩家创建/编辑军团 THEN 系统 SHALL 提供兵种分配的拖拽或输入界面
3. WHEN 玩家分配军团到战线 THEN 系统 SHALL 通过下拉/选择界面完成分配操作

#### 4.3 战斗进度展示

##### 验收标准

1. WHEN 战斗正在进行 THEN 系统 SHALL 显示战斗进度条、当前回合数/总回合数、双方兵力变化曲线
2. WHEN 每个战斗回合结束 THEN 系统 SHALL 生成该回合的简要报告（伤亡数、克制效果、特殊能力触发）
3. WHEN 战斗结束 THEN 系统 SHALL 生成完整的战斗总结报告，包括总伤亡、战利品、战线设施变化

---

### 需求 5：系统集成与平衡

**用户故事：** 作为一名玩家，我希望新的军事系统与现有的经济、外交、稳定性系统紧密集成，确保军事投入有意义且平衡，以便游戏整体体验和谐一致。

#### 5.1 经济系统集成

##### 验收标准

1. WHEN 新军事资源加入经济系统 THEN 系统 SHALL 确保它们参与现有的价格/供需调节机制
2. IF 战争导致军事资源需求激增 THEN 系统 SHALL 军事资源价格上涨，影响军队维护成本
3. WHEN 战线设施被破坏 THEN 系统 SHALL 对相应建筑的实际产出施加减产效果
4. WHEN 时代从刀剑过渡到火枪 THEN 系统 SHALL 使旧式军事资源(swords/plate_armor)需求下降、价格走低，新式资源(muskets/gunpowder)需求上升

#### 5.2 外交系统集成

##### 验收标准

1. WHEN AI国家评估是否宣战 THEN 系统 SHALL 考虑目标国家的军事产业链完整度（有军工产业的国家更难被攻击）
2. IF AI国家在战线上遭受重大损失 THEN 系统 SHALL 增加AI求和倾向
3. WHEN 和平谈判时 THEN 系统 SHALL 考虑战线上的设施破坏程度作为赔款因素

#### 5.3 数值平衡

##### 验收标准

1. IF 新军事资源被引入 THEN 系统 SHALL 确保军事产业链的投入产出比与现有产业链（如工具链、纺织链）保持一致的平衡哲学
2. WHEN 战斗持续时间制实施 THEN 系统 SHALL 确保小规模战斗不会拖延游戏节奏，大规模战斗的持续时间给玩家足够的战略窗口
3. IF 战线经济掠夺系统实施 THEN 系统 SHALL 确保掠夺收益不会导致"以战养战"的无限循环，应有递减收益
4. WHEN 将领系统实施 THEN 系统 SHALL 确保将领加成在合理范围内（如攻击+5%到+25%），不会导致"超级将领"支配一切
5. WHEN 军事资源时代过渡发生 THEN 系统 SHALL 确保旧式资源不会立即变得无用——旧式装备仍可使用，只是相对新式装备有战斗力劣势
