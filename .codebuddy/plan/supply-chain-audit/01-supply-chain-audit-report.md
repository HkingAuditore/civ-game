# 产业链与物资消费结构深度审计报告

> 审计范围：civ-game 全部 10 个时代（Epoch 0-9）的建筑、资源、阶层消费体系
> 审计基于：`buildings.js`、`buildingUpgrades.js`、`strata.js`、`gameConstants.js`、`industryChains.js`、`epochs.js`、`needs.js`

---

## 目录

1. [资源全景图：生产-消费矩阵](#1-资源全景图)
2. [各时代产业链完整性分析](#2-各时代产业链完整性分析)
3. [空转/孤立资源识别](#3-空转孤立资源识别)
4. [阶层消费结构分析](#4-阶层消费结构分析)
5. [产业链瓶颈与失衡点](#5-产业链瓶颈与失衡点)
6. [建筑升级体系一致性检查](#6-建筑升级体系一致性检查)
7. [经济循环完整性检查](#7-经济循环完整性检查)
8. [问题汇总与严重度评级](#8-问题汇总与严重度评级)

---

## 1. 资源全景图

### 1.1 全部资源列表（按解锁时代）

| 时代 | 资源 | 类型 | 生产来源 | 消费去向 | 阶层需求 |
|------|------|------|----------|----------|----------|
| **Epoch 0** | food | 必需品 | farm, trading_post, market, trade_port | 建筑输入(culinary_kitchen, brewery等), 阶层基础需求 | 全阶层基础需求 |
| | wood | 原材料 | lumber_camp | sawmill, brickworks, 建筑输入多种 | 樵夫/自耕农/工人奢侈 |
| | stone | 原材料 | quarry | brickworks, 建筑消耗 | 多阶层奢侈 |
| | cloth | 必需品 | loom_house | tailor_workshop, armorsmith, furniture_workshop | 全阶层基础需求 |
| | tools | 工业品 | stone_tool_workshop | 多种建筑维护输入 | 工人/矿工/工匠奢侈 |
| | brick | 工业品 | brickworks | 建筑消耗(town_hall, 多种civic) | 多阶层奢侈 |
| | silver | 货币 | trading_post, church等 | 购买一切 | — |
| **Epoch 1** | plank | 工业品 | sawmill | furniture_workshop, 建筑建造 | 多阶层奢侈 |
| | copper | 原材料 | copper_mine | bronze_foundry, swordsmith | 多阶层奢侈 |
| | dye | 工业品 | dye_works | tailor_workshop, dye_workshop | 地主/商人/工匠奢侈 |
| | culture | 特殊 | amphitheater, church等 | 阶层消费, town_hall维护 | 全阶层(解锁后)奢侈 |
| **Epoch 2** | papyrus | 工业品 | reed_works | library, printing_house, university | 学者/神职/官员奢侈 |
| | delicacies | 奢侈品 | culinary_kitchen | 阶层消费, town_hall/coffee_house维护 | 商人/地主/资本家/官员奢侈 |
| | furniture | 奢侈品 | furniture_workshop | 阶层消费, church维护 | 商人/地主/资本家/工程师奢侈 |
| | ale | 奢侈品 | brewery, monastery_cellar | 阶层消费, rail_depot维护 | 全阶层奢侈(解锁后) |
| | fine_clothes | 奢侈品 | tailor_workshop | 阶层消费, church/amphitheater/opera_house维护 | 商人/地主/资本家/官员奢侈 |
| | iron | 原材料 | mine | iron_tool_workshop, swordsmith, armorsmith等 | 军人/工程师/资本家奢侈 |
| | swords | 军事品 | swordsmith | 军事系统 | — |
| **Epoch 3** | plate_armor | 军事品 | armorsmith | 军事系统 | — |
| **Epoch 4** | spice | 贸易品 | dockyard | trade_port, dye_workshop | 水手/商人/地主等奢侈 |
| | gunpowder | 军事品 | powder_mill | gun_workshop, ammo_factory | — |
| | muskets | 军事品 | gun_workshop | 军事系统 | — |
| | cotton | 原材料 | cotton_plantation | cotton_weaving_house, textile_mill等 | — |
| **Epoch 5** | coffee | 奢侈品 | coffee_plantation | coffee_house, printing_house, university | 商人/官员/工程师/学者等奢侈 |
| | rifles | 军事品 | rifle_works | 军事系统 | — |
| | ammunition | 军事品 | ammo_factory, arms_factory | 军事系统 | — |
| **Epoch 6** | coal | 原材料 | coal_mine | steel_foundry, factory, 多种工业 | 资本家/工程师奢侈 |
| | steel | 工业品 | steel_foundry, steel_works | factory, 多种工业建筑 | 资本家/工程师/军人奢侈 |
| | ordnance | 军事品 | arms_factory | 军事系统 | — |
| **Epoch 7** | oil | 原材料 | oil_well | oil_refinery, plastics_factory | — |
| | rubber | 原材料 | rubber_plantation | wiring_factory, automobile_factory | — |
| | chemicals | 中间品 | oil_refinery | fertilizer_plant, plastics_factory等 | — |
| | wiring | 中间品 | wiring_factory | 电子相关建筑建造 | — |
| | electricity | 能源 | coal_power_plant | 多种现代建筑输入 | — |
| | machinery | 中间品 | machinery_plant | automobile_factory | — |
| | synthetic_fiber | 工业品 | synthetic_fiber_plant | synthetic_textile_mill | — |
| **Epoch 8** | plastics | 中间品 | plastics_factory | appliance_factory, composites_factory | — |
| | electronics | 中间品 | electronics_factory | 多种现代建筑输入 | 科学家奢侈 |
| | uranium | 原材料 | uranium_mine | nuclear_power_plant | — |
| | aluminum | 中间品 | aluminum_smelter | 多种信息时代建筑 | — |
| | medicine | 消费品 | pharmaceutical_plant, biotech_center | 阶层消费 | 技术工人/科学家奢侈 |
| **Epoch 9** | semiconductors | 高科技 | semiconductor_fab | software_company, data_center等 | — |
| | software | 高科技 | software_company | internet_platform, financial_center | 科学家奢侈 |
| | composites | 高科技 | composites_factory | (无直接消费建筑) | — |

---

## 2. 各时代产业链完整性分析

### 2.1 Epoch 0-1（石器→青铜时代）：基础循环 ✅ 基本完整

**核心循环**：
```
farm → food → 阶层消费
lumber_camp → wood → sawmill → plank
quarry → stone → brickworks → brick
loom_house → cloth → 阶层消费
stone_tool_workshop: wood+stone → tools → 建筑维护
trading_post → food+silver
```

**问题**：
- ✅ 基础自洽，开局有足够的生产-消费循环
- ⚠️ `dye_works`（Epoch 1）消耗 `food` 产出 `dye`，但 `dye` 在 Epoch 1 只有 `tailor_workshop`（需要 `tools` tech）消费。染料在青铜早期可能积压

### 2.2 Epoch 2-3（古典→封建时代）：产业链初步展开 ✅ 较完整

**新增链路**：
```
reed_works: wood → papyrus
culinary_kitchen: food+tools → delicacies
brewery: food+wood → ale
furniture_workshop: plank+cloth+tools → furniture
tailor_workshop: cloth+dye+tools → fine_clothes+culture
mine: tools → iron
iron_tool_workshop: iron+wood → tools（tools升级路线）
```

**封建时代补充**：
```
large_estate → food（大规模）
monastery_cellar: food+wood → ale+culture
wool_workshop: food+tools → cloth+fine_clothes
stone_workshop: tools → stone（反向采集增强）
hardwood_camp: tools → wood（反向采集增强）
```

**问题**：
- ✅ `church` 消耗 `furniture+fine_clothes`，产出 `culture+silver`，形成了奢侈品→文化的正向循环
- ✅ `town_hall` 作为行政建筑消耗多种资源（brick, papyrus, delicacies, fine_clothes, culture, science），是重要的资源水槽
- ⚠️ **papyrus 早期需求不足**：Epoch 2 造纸工坊产出 papyrus，但主要消费者是 `library`（不消耗 papyrus 作 input），`magistrate_office`（消耗极少 0.015/s），`town_hall`（Epoch 3, 0.02/s）。papyrus 在 Epoch 2 可能只被阶层奢侈需求消化。

### 2.3 Epoch 4-5（探索→启蒙时代）：殖民贸易链 ✅ 完整

**新增链路**：
```
dockyard: wood → spice
trade_port: spice → food（贸易转化）
cotton_plantation → cotton → cotton_weaving_house → cloth+fine_clothes
dye_workshop: food+cloth+spice+science → dye+fine_clothes
coffee_plantation → coffee → coffee_house → culture+science
shaft_mine: tools+wood+science → iron+copper（多产出）
printing_house: papyrus+coffee+science → science+culture
navigator_school → science+culture
```

**问题**：
- ✅ 纺织链在 Epoch 4 通过棉花种植园得到了重大扩展
- ⚠️ **`dye_workshop` 消耗 science**（0.02/s），在探索时代 science 是珍贵资源，这可能让玩家犹豫是否建造
- ✅ `coffee_house` 形成了 coffee→culture+science 的良好转化

### 2.4 Epoch 5-6（启蒙→工业时代）：工业化转型 ✅ 完整

**新增链路**：
```
coal_mine → coal
steel_foundry: iron+coal+science → steel
factory: steel+coal+science → tools（大规模）
steel_works: iron+coal+science → steel+tools
textile_mill: food+dye → cloth+fine_clothes
lumber_mill: wood → plank（大规模）
building_materials_plant: stone+wood+coal → brick
paper_mill: wood+coal → papyrus
cannery: food+iron+coal → delicacies
distillery: food+coal → ale+silver
garment_factory: cloth+dye+coal → fine_clothes+culture
furniture_factory: plank+cloth+coal → furniture+culture
prefab_factory: brick+steel+stone+coal → brick（大规模）
rail_depot: coal+ale+delicacies+science → silver+maxPop
arms_factory: steel+coal+science → ordnance+ammunition
```

**问题**：
- ✅ 工业时代建筑普遍以 `coal` 为核心输入，形成了煤炭经济核心地位
- ✅ `rail_depot` 消耗 ale+delicacies，形成了有趣的"铁路需要消费品"机制
- ⚠️ **工具产出爆炸**：`factory` 基础产出 15 tools/s，升级后可达 32 tools/s。而工具的消费方（建筑维护）通常每座只需 0.02-0.2 tools/s。一座工厂足以供应几十座建筑的工具需求，可能导致 tools 严重过剩和价格崩溃

### 2.5 Epoch 7（电气时代）：新资源链 ✅ 基本完整

**新增资源链路**：
```
oil_well → oil → oil_refinery → chemicals → fertilizer_plant → food
rubber_plantation → rubber → wiring_factory → wiring
coal_power_plant: coal → electricity
machinery_plant: steel+iron+tools → machinery → automobile_factory → silver+culture
synthetic_fiber_plant: coal+steel+science → synthetic_fiber
electric_textile_mill: cotton+coal+dye → cloth+fine_clothes
advanced_copper_mine: electricity → copper
broadcast_station: electricity+papyrus → science+culture
```

**问题**：
- ⚠️ **`fertilizer_plant` 产出极低**：输入 chemicals(0.3)+coal(0.2)，产出 food(0.8)。chemicals 的上游是 oil_refinery（需要 oil+coal+dye），整条链路投入巨大但食物产出微乎其微。一个 `mechanized_farm` 产出 38.5 food。化肥厂的存在意义主要是象征性的
- ⚠️ **`automobile_factory` 是银币水龙头**：输入 steel(0.4)+rubber(0.3)+machinery(0.3)，产出 silver(2.0)+culture(0.05)。汽车不进入任何消费链，不被任何阶层需求。输出只是银币，本质是"烧资源换钱"的空转设施
- ⚠️ **`machinery` 只有汽车厂消费**：machinery_plant 产出 machinery(0.4)，但唯一的消费建筑是 automobile_factory（消耗 0.3）和一些建筑的建造成本。machinery 作为资源几乎是单点链路

### 2.6 Epoch 8（原子时代）：深加工链 ✅ 基本完整

**新增链路**：
```
uranium_mine → uranium → nuclear_power_plant → electricity
plastics_factory: chemicals+oil → plastics → appliance_factory → silver+culture
electronics_factory: copper+wiring+chemicals+stone → electronics
pharmaceutical_plant: chemicals+papyrus → medicine
aluminum_smelter: stone+coal+electricity → aluminum
appliance_factory: electronics+plastics+steel → silver+culture
television_station: electricity+electronics → culture+science
synthetic_textile_mill: synthetic_fiber+dye+electricity → fine_clothes
military_industrial_complex: electronics+steel+chemicals → ordnance
high_rise_apartment → maxPop(120!)
```

**问题**：
- ⚠️ **`appliance_factory` 又是银币水龙头**：与汽车厂同样模式，输入三种中间品，产出 silver+culture。家电不被任何阶层需求
- ✅ `medicine` 被 technician 和 scientist 奢侈需求消费，有合理的消费端
- ⚠️ **stone 在高级建筑中的新角色**：`electronics_factory` 消耗 stone（代表石英砂/硅），`aluminum_smelter` 消耗 stone（代表铝土矿），`nuclear_power_plant` 消耗 stone（代表屏蔽层）。设计上有合理性，但可能让玩家困惑为什么"石头"在原子时代仍然重要。说明文本不够清晰

### 2.7 Epoch 9（信息时代）：终极产业链 ⚠️ 有问题

**新增链路**：
```
semiconductor_fab: electronics+chemicals+copper+stone → semiconductors
software_company: semiconductors+electricity → software+science
data_center: semiconductors+electricity+steel → silver+science
internet_platform: software+electricity → silver+culture
solar_power_plant: stone+aluminum → electricity
composites_factory: plastics+aluminum+chemicals → composites
research_institute: semiconductors+electricity+papyrus → science+culture
financial_center: software+electricity → silver
biotech_center: medicine+electronics+chemicals → science+medicine
automated_mine: electricity → copper+iron+coal+stone
```

**问题**：
- 🔴 **`composites`（复合材料）完全无消费端！** composites_factory 产出 composites(0.25)，但**没有任何建筑消耗 composites 作为 input，也没有任何阶层需求 composites**。这是一个典型的空转资源
- ⚠️ **`data_center` 和 `internet_platform` 和 `financial_center` 都是银币水龙头**：输入高科技资源，产出银币。虽然在信息时代"数字经济产银"合理，但三种建筑模式雷同
- ⚠️ **`software` 消费端较窄**：只有 `internet_platform`(0.1) 和 `financial_center`(0.1) 消费 software，没有阶层需求（科学家奢侈需求中有 software: 0.02，但数量极小）

---

## 3. 空转/孤立资源识别

### 3.1 完全空转资源（有生产无消费）

| 资源 | 生产来源 | 问题 | 严重度 |
|------|----------|------|--------|
| **composites** | composites_factory | **没有任何消费端**。不被任何建筑输入、不被任何阶层需求 | 🔴 严重 |

### 3.2 准空转资源（消费端极窄或象征性存在）

| 资源 | 生产来源 | 消费端 | 问题 | 严重度 |
|------|----------|--------|------|--------|
| **machinery** | machinery_plant | 仅 automobile_factory(0.3) + 建造成本 | 单点链路，无阶层需求 | ⚠️ 中等 |
| **software** | software_company | internet_platform(0.1), financial_center(0.1), scientist奢侈(微量) | 消费端窄，且都是银币水龙头 | ⚠️ 中等 |
| **composites** | composites_factory | 无 | 如上 | 🔴 严重 |

### 3.3 银币水龙头建筑（无实物产出，仅产银/文化）

| 建筑 | 时代 | 输入 | 输出 | 评估 |
|------|------|------|------|------|
| automobile_factory | E7 | steel+rubber+machinery | silver(2.0)+culture(0.05) | ⚠️ 无实物产出 |
| appliance_factory | E8 | electronics+plastics+steel | silver(3.0)+culture(0.08) | ⚠️ 无实物产出 |
| data_center | E9 | semiconductors+electricity+steel | silver(4.0)+science(0.5) | ⚠️ 模式雷同 |
| internet_platform | E9 | software+electricity | silver(3.5)+culture(0.5) | ⚠️ 模式雷同 |
| financial_center | E9 | software+electricity | silver(5.0) | ⚠️ 纯银币 |

**评估**：这些建筑缺少中间的"消费品"环节。在纪元1800中，汽车/家电/电话等消费品会被居民消费提升幸福度。当前设计中它们直接产银币，缺少"消费品经济"的心流。

### 3.4 几乎没有建筑消耗的资源（仅靠阶层奢侈需求消化）

| 资源 | 建筑消费端 | 阶层需求 | 评估 |
|------|-----------|----------|------|
| ale | rail_depot(0.36) | 全阶层广泛奢侈需求 | ✅ 需求端充足 |
| delicacies | town_hall(0.10), coffee_house(0.267), rail_depot(0.18), university等 | 上层阶层大量奢侈需求 | ✅ 需求端充足 |
| furniture | church(0.04) | 多阶层奢侈需求 | ✅ 但建筑消费较少 |
| fine_clothes | church(0.03), amphitheater(0.09), opera_house | 上层阶层奢侈需求 | ✅ 合理 |

---

## 4. 阶层消费结构分析

### 4.1 基础需求覆盖

所有阶层的基础需求只包含 `food` 和 `cloth` 两种资源。这是合理的设计——简洁的基础层确保核心生存需求清晰。

| 阶层 | food/人/s | cloth/人/s | 评估 |
|------|----------|-----------|------|
| 失业者 | 0.30 | 0.04 | 最低 |
| 佃农 | 0.36 | 0.05 | 低 |
| 自耕农 | 0.42 | 0.06 | 较低 |
| 樵夫 | 0.46 | 0.07 | 中低 |
| 工人 | 0.52 | 0.09 | 中 |
| 矿工 | 0.56 | 0.10 | 中高 |
| 水手 | 0.60 | 0.10 | 中高 |
| 军人 | 0.60 | 0.10 | 中高 |
| 工匠 | 0.62 | 0.11 | 较高 |
| 学者 | 0.62 | 0.11 | 较高 |
| 神职 | 0.65 | 0.11 | 较高 |
| 技术工人 | 0.60 | 0.10 | 中高 |
| 科学家 | 0.70 | 0.12 | 高 |
| 商人 | 0.70 | 0.14 | 高 |
| 工程师 | 0.75 | 0.12 | 高 |
| 官员 | 0.85 | 0.14 | 很高 |
| 地主 | 0.95 | 0.15 | 极高 |
| 资本家 | 1.00 | 0.16 | 最高 |

### 4.2 奢侈需求资源覆盖分析

以下统计各资源被多少阶层的奢侈需求层级引用：

| 资源 | 引用阶层数 | 主要消费阶层 | 评估 |
|------|-----------|-------------|------|
| **culture** | 17/18 | 几乎全部（除失业者极少） | ✅ 最广泛的奢侈需求 |
| **ale** | 15/18 | 全部底层+中层 | ✅ "酒类是文明的润滑剂" |
| **delicacies** | 14/18 | 中层以上为主 | ✅ 合理的进阶奢侈品 |
| **furniture** | 14/18 | 广泛分布 | ✅ 住居品质需求 |
| **fine_clothes** | 13/18 | 中上层为主 | ✅ 体面需求 |
| **spice** | 12/18 | 中上层 | ✅ 高端调味品 |
| **coffee** | 11/18 | 中层以上 | ✅ 知识/商业阶层偏好 |
| **tools** | 8/18 | 底层+工匠+军人 | ✅ 劳动阶层工具需求 |
| **plank** | 8/18 | 底层+中层 | ✅ 建材/家居 |
| **brick** | 8/18 | 中上层 | ✅ 建筑改善 |
| **stone** | 8/18 | 中上层 | ✅ 建筑材料 |
| **copper** | 7/18 | 中上层 | ✅ 器皿/装饰 |
| **steel** | 6/18 | 上层阶层 | ✅ 工业/设备 |
| **papyrus** | 5/18 | 学者/神职/官员/商人/工人 | ✅ 文化阶层 |
| **iron** | 3/18 | 军人/官员/资本家 | ⚠️ 偏少 |
| **coal** | 3/18 | 资本家/工程师/官员 | ✅ 工业阶层 |
| **wood** | 2/18 | 自耕农/樵夫 | ⚠️ 偏少 |
| **dye** | 2/18 | 工匠/商人 | ⚠️ 偏少 |
| **food** | 2/18 | 佃农/失业者(额外) | ✅ 基础需求已覆盖 |
| **medicine** | 2/18 | 技术工人/科学家 | ✅ 合理（Epoch 8+） |
| **electronics** | 1/18 | 科学家 | ⚠️ 偏少 |
| **software** | 1/18 | 科学家 | ⚠️ 偏少 |
| **science** | 3/18 | 学者/官员/工程师/科学家 | ✅ 知识阶层 |
| **cotton** | 0/18 | **无** | ⚠️ 虽为原料但无直接阶层需求是合理的 |
| **oil/rubber/chemicals/wiring/electricity/machinery** | 0/18 | **无** | ✅ 工业中间品，不应有直接消费 |
| **synthetic_fiber** | 0/18 | 无 | ✅ 中间品 |
| **plastics/aluminum/uranium** | 0/18 | 无 | ✅ 工业品 |
| **semiconductors** | 0/18 | 无 | ⚠️ 信息时代，半导体理应影响消费 |
| **composites** | 0/18 | **无** | 🔴 完全无消费 |

### 4.3 消费弹性与上限设计评估

| 阶层类型 | wealthElasticity | maxMultiplier | greedy | 评估 |
|---------|-----------------|---------------|--------|------|
| 底层(失业/佃农/自耕农/樵夫) | 0.3-0.6 | 3x | N | ✅ 合理的低消费上限 |
| 工人/矿工 | 0.6-0.7 | 3-4x | N | ✅ 劳动阶层适度消费 |
| 中层(工匠/水手/神职/军人) | 0.6-0.9 | 6x | N | ✅ 合理 |
| 学者/技术工人 | 0.8-1.0 | 6x | N | ✅ 合理 |
| 商人 | 1.5 | 10x | N | ⚠️ 弹性很高但无贪婪标记 |
| 工程师 | 1.1 | 10x | N | ✅ 技术精英 |
| 地主 | 1.4 | 10x | N | ✅ 传统贵族 |
| 资本家 | 1.8 | 10x | N | ✅ 最高弹性 |
| 官员 | 2.5 | 50x | **Y** | ⚠️ 官员唯一的greedy=true，50倍上限极高 |
| 科学家 | 1.2 | 10x | N | ✅ 知识精英 |

**问题**：
- ⚠️ **官员消费上限异常**：50倍消费上限远超其他上层阶层（10倍），配合 2.5 的弹性和 greedy 标记，可能导致官员成为资源黑洞。这是有意的"腐败"设计还是数值失衡？
- ⚠️ **商人弹性（1.5）很高但无上层岗位支撑**：商人权重6、弹性1.5、上限10x，消费增长很快。但商人岗位在后期相对稀少（市场3+贸易站2+贸易港4+咖啡馆1+铁路枢纽3），可能不会造成实际问题

---

## 5. 产业链瓶颈与失衡点

### 5.1 food 链：稳定但效率差异大

| 建筑 | 时代 | 产出 food/worker | 评估 |
|------|------|-----------------|------|
| farm | E0 | 4.8/3 = 1.60 | 基础 |
| large_estate | E3 | 24.0/9 = 2.67 | ✅ 合理提升 |
| mechanized_farm | E6 | 38.5/18 = 2.14 | ⚠️ 人均产出竟然低于庄园！|

**问题**：`mechanized_farm`（机械化农场）的人均食物产出(2.14)反而低于`large_estate`（庄园, 2.67）。虽然机械化农场总产出更高（38.5 vs 24.0），但考虑到需要消耗 tools(0.175)+coal(0.35)，其效率优势存疑。从纪元1800的设计逻辑看，工业化应该显著提升人均效率。

### 5.2 tools 链：产出严重过剩

| 建筑 | 时代 | 产出 tools/s | 总工人 | tools/worker |
|------|------|-------------|--------|-------------|
| stone_tool_workshop | E0 | 0.75 | 3 | 0.25 |
| bronze_foundry | E1 | 1.333 | 4 | 0.333 |
| iron_tool_workshop | E2 | 2.0 | 4 | 0.50 |
| metallurgy_workshop | E4 | 3.429 | 8 | 0.429 |
| factory | E6 | **15.0** | 25 | 0.60 |
| steel_works | E6 | 0.96 (副产) | 25 | — |

**问题**：`factory` 一座就产出 15 tools/s，而全部建筑的 tools 消耗加起来很难超过 2-3 tools/s。工具产出爆炸后价格会崩溃到底。应该考虑：
- 让更多建筑消耗 tools（模拟设备磨损）
- 或降低 factory 的 tools 产出，增加其他产出（如 machinery）

### 5.3 coal 链：工业时代核心瓶颈

**coal 消费清单**（仅列基础版建筑）：

| 消费建筑 | coal/s | 时代 |
|----------|--------|------|
| steel_foundry | 0.70 | E6 |
| factory | 2.00 | E6 |
| steel_works | 1.20 | E6 |
| rail_depot | 0.72 | E6 |
| building_materials_plant | 0.45 | E5 |
| garment_factory | 0.45 | E6 |
| furniture_factory | 0.5625 | E6 |
| cannery | 0.5625 | E6 |
| distillery | 0.45 | E5 |
| prefab_factory | 0.80 | E6 |
| arms_factory | 0.80 | E6 |
| coal_power_plant | 0.80 | E7 |
| oil_refinery | 0.30 | E7 |
| synthetic_fiber_plant | 1.50 | E7 |
| fertilizer_plant | 0.20 | E7 |
| **总计** | **~11.5** | |

**coal 供给**：
- coal_mine: 3.0/s（12 miners+1 capitalist）
- coal_mine Lv1: 5.0/s
- coal_mine Lv2: 8.0/s

**评估**：一座满级煤矿（8.0/s）无法支撑所有消费。玩家需要 2-3 座煤矿才能维持工业化运转。这是合理的——煤炭应该是工业时代的战略瓶颈。但需要确保煤矿的解锁不会太晚（当前 coal_mine 解锁于 E6，与大量消费建筑同时代，节奏合理）。

### 5.4 cloth→fine_clothes 链：多路径但比例可能失衡

**cloth 生产来源**：

| 建筑 | cloth/s | 时代 | 其他产出 |
|------|---------|------|----------|
| loom_house | 2.88 | E0 | — |
| wool_workshop | 4.8 | E3 | fine_clothes 0.3 |
| cotton_weaving_house | 6.0 | E4 | fine_clothes 0.4 |
| textile_mill | 12.5 | E5 | fine_clothes 1.5 |
| electric_textile_mill | 18.0 | E7 | fine_clothes 3.0 |

**cloth 消费（建筑）**：

| 建筑 | cloth/s |
|------|---------|
| tailor_workshop | 1.5 |
| furniture_workshop | 0.40 |
| armorsmith | 0.40 |
| cotton_weaving_house | 0 (消耗cotton不是cloth) |
| garment_factory | 3.75 |

**评估**：cloth 的供给随时代大幅增长（2.88→18.0），消费端虽然有阶层需求（全阶层基础需求 cloth），但 fine_clothes 生产链也消耗大量 cloth。整体来看，纺织链路径丰富，设计合理。

### 5.5 iron 链：Epoch 2-4 可能供不应求

**iron 消费清单**：

| 建筑 | iron/s | 时代 |
|------|--------|------|
| iron_tool_workshop | 1.067 | E2 |
| swordsmith | 0.60 | E2 |
| armorsmith | 0.80 | E3 |
| gun_workshop | 0.70 | E4 |
| steel_foundry | 0.70 | E6 |
| cannery | 0.675 | E6 |
| steel_works | 1.44 | E6 |
| machinery_plant | 0.40 | E7 |

**iron 供给**：
- mine: 0.90/s（E2, 需要 tools 0.072/s）
- shaft_mine: 1.44/s iron + 0.96/s copper（E4, 需要 tools+wood+science）
- industrial_mine: 2.96/s iron + 0.96/s copper（E6）

**评估**：在 Epoch 2-3，只有一种矿（mine, 0.9/s），但 iron_tool_workshop(1.067)+swordsmith(0.6) 就需要 1.667/s。两座铁矿才能支撑。再加 armorsmith 就需要三座。这是有意的设计瓶颈，但可能让新手玩家在古典时代陷入铁矿石危机。

---

## 6. 建筑升级体系一致性检查

### 6.1 升级倍率验证

设计原则：Lv1 = 1.3x, Lv2 = 2.25x

**抽样检查**：

| 建筑 | base → Lv1 → Lv2 | 实际倍率 | 符合？ |
|------|-------------------|----------|--------|
| farm | 4.8 → 6.24 → 10.8 | 1.3x → 2.25x | ✅ |
| lumber_camp | 3.84 → 4.992 → 8.64 | 1.3x → 2.25x | ✅ |
| quarry | 3.0 → 3.9 → 6.75 | 1.3x → 2.25x | ✅ |
| coal_mine | 3.0 → **5.0** → **8.0** | **1.67x → 2.67x** | ⚠️ 超标（激进升级） |
| steel_foundry | 0.7 → **1.2** → **2.4** | **1.71x → 3.43x** | ⚠️ 超标 |
| factory | 15 → **22** → **32** | **1.47x → 2.13x** | ⚠️ 接近但不精确 |
| amphitheater | 5.4 → **6.5** → **9.0** | **1.2x → 1.67x** | ⚠️ 低于标准 |
| coffee_house | 4.0/1.33 → **4.8/1.73** → **7.0/3.0** | 见注 | ⚠️ 不规则 |

**评估**：
- 大部分早期建筑严格遵循 1.3x/2.25x 规则
- 工业时代建筑（coal_mine, steel_foundry, factory）采用了更激进的升级比例，这是有意的设计（注释中说明了"激进升级"）
- `amphitheater` 和 `coffee_house` 的升级采用了效率提升模式（减少岗位而非增加产出），偏离了标准倍率

### 6.2 缺失升级的建筑

以下建筑在 `BUILDING_UPGRADES` 中**没有定义升级**：

| 建筑 | 类型 | 时代 | 评估 |
|------|------|------|------|
| hut/house/manor_house/townhouse/civic_apartment | 居住 | E0-5 | ✅ 居住建筑不需升级 |
| granary | 仓储 | E1 | ✅ 功能建筑 |
| barracks/training_ground/fortress | 军事容量 | E0-4 | ✅ 军事容量建筑不需升级 |
| magistrate_office | 行政 | E1 | ⚠️ 可以考虑升级 |
| town_hall | 行政 | E3 | ⚠️ 重要行政建筑缺少升级 |
| stock_exchange | 金融 | E6 | ⚠️ 后期重要建筑缺少升级 |
| apartment_block | 居住 | E6 | ✅ 居住建筑 |
| **Epoch 7 所有建筑** | 各类 | E7 | ✅ 全部有升级 |
| **Epoch 8 所有建筑** | 各类 | E8 | ✅ 全部有升级 |
| **Epoch 9 所有建筑** | 各类 | E9 | ✅ 全部有升级 |

---

## 7. 经济循环完整性检查

### 7.1 "死锁"风险分析

**问题场景**：某些建筑需要的输入来自其自身或同级建筑产出，可能造成"先有鸡还是先有蛋"问题。

| 风险点 | 描述 | 实际情况 |
|--------|------|----------|
| tools 死锁 | 多建筑需要 tools，但 tools 生产也需要资源 | ✅ stone_tool_workshop 只需 wood+stone（无 tools），可以启动 |
| iron 死锁 | mine 需要 tools(0.072)，iron_tool_workshop 需要 iron | ✅ 可以先用 bronze_foundry(copper→tools) 或 stone_tool_workshop 供 tools |
| coal 死锁 | coal_mine 需要 tools(0.20)，但 tools 来自哪里？ | ✅ 此时已有 iron_tool_workshop 或 metallurgy_workshop |
| steel 死锁 | steel_foundry 需要 iron+coal+science | ✅ 都是独立来源 |
| electricity 死锁 | 多建筑需要 electricity，coal_power_plant 需要 coal | ✅ 煤矿独立供给 |

**结论**：当前设计没有不可解的死锁，资源链的启动路径是清晰的。

### 7.2 资源价格-工资-消费反馈环

**正向反馈（危险）**：
1. 资源短缺 → 价格上涨 → 生活成本上升 → 需要更高工资 → 生产成本上升 → 价格进一步上涨
2. 缓解机制：price maxPrice caps, wage subsistence mode for serfs

**负向反馈（稳定）**：
1. 资源过剩 → 价格下跌 → inventoryPriceImpact 降低产出 → 产出减少 → 价格回升
2. 缓解机制：minPrice floors, outputVariation

### 7.3 特殊产出资源（culture/science）的消费路径

| 资源 | 生产来源 | 建筑消费 | 阶层消费 | 评估 |
|------|----------|----------|----------|------|
| culture | amphitheater, church, 多种建筑 | town_hall(0.03/s), university(内含science消耗) | 全阶层广泛奢侈需求 | ✅ 良好 |
| science | library, printing_house, university等 | town_hall(0.05), shaft_mine(0.05), dye_workshop(0.02), factory(0.50), steel_foundry(0.20), steel_works(0.40) | 学者/官员/工程师/科学家奢侈 | ✅ 良好 |

**评估**：culture 和 science 既是"生产要素"（建筑消耗）又是"消费品"（阶层需求），双重角色设计合理。工厂消耗 science 代表"技术研发投入"，是好的设计。

---

## 8. 问题汇总与严重度评级

### 🔴 严重问题（影响游戏体验和经济循环）

| # | 问题 | 位置 | 建议 |
|---|------|------|------|
| S1 | **composites 完全无消费端** | composites_factory (E9) | 需要添加消费建筑或阶层需求，详见优化方案 |
| S2 | **银币水龙头建筑缺少消费品中间环节** | automobile/appliance/data_center等 | 引入"消费品"资源或让这些产出进入阶层需求 |

### ⚠️ 中等问题（影响平衡和游戏深度）

| # | 问题 | 位置 | 建议 |
|---|------|------|------|
| M1 | **tools 产出爆炸**（factory 15/s） | factory (E6) | 降低 tools 产出或增加消费端 |
| M2 | **machinery 单点链路** | machinery_plant→automobile_factory | 增加 machinery 消费端 |
| M3 | **fertilizer_plant 产出极低** | fertilizer_plant (E7) | 提升 food 产出或增加其他产出 |
| M4 | **mechanized_farm 人均效率低于庄园** | mechanized_farm (E6) | 提升产出或降低工人数 |
| M5 | **官员 50x 消费上限** | strata.js official | 确认是否为有意设计（腐败机制） |
| M6 | **Epoch 2 papyrus 消费不足** | 早期经济 | 考虑增加早期 papyrus 消费（如更多建筑维护） |
| M7 | **软件(software)消费端狭窄** | E9 经济 | 增加 software 消费端或阶层需求 |
| M8 | **coal_mine/steel_foundry/factory 升级倍率超标** | buildingUpgrades.js | 确认是否为有意的"激进升级"设计 |

### 💡 改善建议（提升体验和深度）

| # | 建议 | 影响域 | 详见 |
|---|------|--------|------|
| L1 | 为 stone 在高级建筑中的角色添加更清晰的描述 | UI/desc | 改描述即可 |
| L2 | 考虑为 town_hall 和 stock_exchange 添加升级 | buildingUpgrades.js | 扩展升级体系 |
| L3 | 考虑让更多阶层在高富裕度时消费 electronics | strata.js | 丰富消费端 |
| L4 | 信息时代三种银币水龙头（data_center/internet/financial）可以差异化 | buildings.js | 产出差异化 |
| L5 | dye 在青铜时代消费不足 | 早期平衡 | 考虑增加 dye 消费场景 |

---

*报告完成。详细优化方案见第二份文件。*
