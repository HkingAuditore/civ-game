# Civ Game II 策划案

> 项目代号：**Civ Game II**（civ-game 续作）  
> 版本：**v1.0**（完整策划案）  
> 类型：单机网页端 · 文明经营 · 宏观模拟 · 回合/实时混合  
> 基础版本：基于 [civ-game](https://github.com/hkinghuang/simple_nation_game) v2.x 的核心系统演化  
> 配套文档：
> - `.codebuddy/plan/tile-system/design.md`（地块系统玩法蓝图）
> - `.codebuddy/plan/tile-system/requirements.md`（地块系统工程清单）
> - `.codebuddy/plan/sequel-design/task-item.md`（本案任务清单，待生成）

---

## 目录

- [0. 设计总览](#0-设计总览)
- [1. 地图 Map](#1-地图-map)
  - [1.1 地块 Tile](#11-地块-tile)
  - [1.2 地形 Terrain](#12-地形-terrain)
- [2. 经济 Economy](#2-经济-economy)
  - [2.1 资源 Resources](#21-资源-resources)
  - [2.2 建筑 Buildings](#22-建筑-buildings)
  - [2.3 产业链 Industry Chains](#23-产业链-industry-chains)
  - [2.4 市场 Market](#24-市场-market)
- [3. 人口 Population](#3-人口-population)
  - [3.1 阶层 Strata](#31-阶层-strata)
  - [3.2 满意度 Approval](#32-满意度-approval)
  - [3.3 生活水平 Living Standard](#33-生活水平-living-standard)
- [4. 军事 Military](#4-军事-military)
  - [4.1 军团 Corps](#41-军团-corps)
  - [4.2 将领 Generals](#42-将领-generals)
- [5. 政府 Government](#5-政府-government)
  - [5.1 政体 Polity](#51-政体-polity)
  - [5.2 理念 Ideology](#52-理念-ideology)
- [6. 科技 Technology](#6-科技-technology)
- [7. 外交 Diplomacy](#7-外交-diplomacy)
  - [7.1 外国 Foreign Nations](#71-外国-foreign-nations)
  - [7.2 国际组织 International Organizations](#72-国际组织-international-organizations)
  - [7.3 国际贸易 International Trade](#73-国际贸易-international-trade)
- [8. UI/UX 结构](#8-uiux-结构)
- [9. 数值骨架与平衡](#9-数值骨架与平衡)
- [10. 分阶段上线路线](#10-分阶段上线路线)
- [11. 非目标与未来扩展](#11-非目标与未来扩展)
- [12. 风险与缓解](#12-风险与缓解)
- [附录 A：与现有系统对接点](#附录-a与现有系统对接点)
- [附录 B：EARS 验收需求清单](#附录-beas-验收需求清单)

---

## 0. 设计总览

### 0.1 一句话定位
> **在一张看得见的国土上，经营一部由经济、阶层、政治、外交共同驱动的文明**。

从前作"单一抽象聚合国家"升级为"地理分片式文明"，在保留前作所有宏观系统（市场/阶层/理念/政体/外交）的前提下，为所有玩法注入**空间决策维度**。

### 0.2 核心设计原则

| # | 原则 | 含义 |
|---|---|---|
| P1 | **地理优先** | "哪里建"比"建多少"更重要 |
| P2 | **共享市场隔离风险** | 空间性锁在生产端，价格/贸易保持全国 |
| P3 | **老玩家零迁移成本** | 老存档自动变单地块帝国，手感不变 |
| P4 | **UI 分层** | 宏观全国聚合 vs 微观地块下钻 |
| P5 | **现有系统优先扩展** | 不重写核心机制，复用前作成熟子系统 |

### 0.3 相较前作的总览差异

| 维度 | 前作 | 续作 |
|---|---|---|
| 国家呈现 | 单一抽象聚合体 | 由 30–80 地块组成的国土 |
| 建造 | 全国池笼统建造 | 选地块 → 按地形建造 |
| 就业 | 全国岗位大池 | 本地匹配、本地工资 |
| 战争奖励 | 数值奖励 | 翻转敌方地块归属 |
| 扩张 | 隐式（maxPop） | 显式（殖民/征服） |
| 市场 | 全国 | 全国（保持不变） |
| 阶层数据 | 全国聚合 | 按地块存储、聚合使用 |
| 外交割地 | 数值标量 | 具体地块翻转 |

### 0.4 继承自前作的优势资产

- 🏛️ **真实市场供需价格系统**（`prices.js / trading.js`）
- 👥 **17+ 阶层 + 基础/奢侈需求 + 富裕陷阱**（`strata.js / needs.js`）
- 📊 **6 档生活水平 + 好感度上限**（`livingStandard.js`）
- 🎴 **理念卡槽 + 涌现 + 协同/反协同**（`ideologies.js / ideologyEffects.js`）
- 👑 **政体自动浮现 + 执政联盟**（`rulingCoalition.js / polityEffects.js`）
- ⚔️ **军团/将领/前线/战术**（`corpsSystem.js / frontSystem.js / battleSystem.js`）
- 🌐 **AI 国家 + 10 种条约 + 3 类国际组织 + 海外投资**（`diplomacy/`）
- 🎓 **10 时代 + 科技树 + 时代 bonuses**（`epochs.js / technologies.js`）

---

## 1. 地图 Map

### 1.1 地块 Tile

#### 1.1.1 基础定义
地块是本作**最小的空间单位**。所有建造、人口、就业、阶层财富都绑定到具体地块上。

```js
{
  id: 'tile_0x3y2',
  x: 3, y: 2,
  terrain: 'plains',
  owner: 'player' | 'neutral' | `nation_${id}`,
  isCapital: false,
  buildingCapacity: 6,
  buildings: { farm: 2, house: 3, market: 1 },
  popStructure: { peasant: 80, artisan: 25, landowner: 5 },
  classFinancialData: { /* 本地各阶层财富/收入/支出 */ },
  adjacentTiles: ['tile_0x2y2', 'tile_0x4y2', /* ... */],
  meta: {
    conqueredBy: null,         // 非原生归属时记录征服者
    conqueredAtDay: null,      // 用于"被征服 Debuff" 未来扩展
    localUnrest: 0,            // 预留给地区起义
  }
}
```

#### 1.1.2 地块的四大属性维度
| 维度 | 字段 | 含义 |
|---|---|---|
| **身份** | `id, x, y, isCapital` | 地图定位 |
| **地理** | `terrain, buildingCapacity, passable` | 决定能建什么、建多少 |
| **归属** | `owner, conqueredBy` | 决定谁能操作、是否被同化 |
| **内容** | `buildings, popStructure, classFinancialData` | 本地的人、物、钱 |

#### 1.1.3 地块规模分档

| 地图规模 | 地块数 | AI 国数 | 体验定位 |
|---|---|---|---|
| 小图 | 30 | 3–5 | 快速对局（2–3 小时） |
| 中图 | 50 | 5–7 | 标准体验（5–8 小时） |
| 大图 | 80 | 8–10 | 史诗对局（15+ 小时） |

#### 1.1.4 地块归属规则

| 值 | 含义 | 玩家可做 |
|---|---|---|
| `'player'` | 玩家拥有 | 建造、拆除、征税、管理人口 |
| `'neutral'` | 无主之地 | 派殖民者占领（未来扩展） |
| `'nation_xxx'` | 外国拥有 | 宣战占领 / 外交割让 |

#### 1.1.5 归属翻转规则（征服/割让）
当地块 owner 发生翻转时：
- ✅ 建筑**原地保留**（不销毁）
- ✅ 人口**原地保留**（不清空）
- ✅ 阶层财富**原地保留**（不转账）
- ⚠️ 记录 `conqueredBy` 与 `conqueredAtDay`（为未来"被征服 Debuff" 预留）
- ⚠️ 战败方首都地块**不可被割让**（防一战灭国）

### 1.2 地形 Terrain

#### 1.2.1 10 种标准地形

| ID | 中文 | 通行 | 承载 | 主产出加成 | 抑制产出 | 设计意图 |
|---|---|---|---|---|---|---|
| `plains` | 平原 | ✅ | 6 | food×1.2, cotton×1.1 | — | 开局主地，粮仓首选 |
| `hills` | 丘陵 | ✅ | 4 | iron×1.3, stone×1.2 | food×0.8 | 矿业 + 防御 |
| `mountain` | 山地 | ❌* | 2 | iron×2.0, gold×2.0, stone×1.5 | food×0, cotton×0 | 稀有资源、低承载 |
| `river` | 河流 | ✅ | 5 | food×1.3, fish×1.5 | — | 粮食+水运节点 |
| `ocean` | 海洋 | ❌* | 0 | fish×2.0 | 陆地产物 | 仅港口/渔场 |
| `desert` | 沙漠 | ✅ | 2 | gold×1.5 | food×0, cotton×0.5 | 贫瘠但有稀有 |
| `plateau` | 高原 | ✅ | 3 | stone×1.3, silver×1.2 | food×0.7 | 中庸混合加成 |
| `marsh` | 沼泽 | ✅ | 2 | — | food×0.5, iron×0.5 | 惩罚性地形 |
| `forest` | 森林 | ✅ | 4 | wood×2.0, fur×1.5 | food×0.9 | 木材皮草重镇 |
| `snow` | 雪原 | ✅ | 2 | fur×1.3 | food×0.5, cotton×0 | 边疆，承载低 |

> `*passable: false` 不代表"什么都不能做"，而是默认不能建造；特殊建筑（港口/矿井）可通过 `allowedTerrain` 白名单豁免。

#### 1.2.2 资源加成语义

| 加成值 | 含义 |
|---|---|
| `= 1.0` | 标准产出（默认） |
| `= 0` | **硬禁止**（概念上不合理，如山地种麦） |
| `> 1.0` | 正向加成（如 ×2.5 = 2.5 倍产出） |
| `0 < x < 1` | 惩罚性减产（如 ×0.5 = 减半） |

#### 1.2.3 地图生成算法（设计层）
1. 用简化 Perlin 噪声划分大地形带（海洋带 / 山脉带 / 平原带）
2. 在主导带内按概率细化（平原带里散布丘陵 15% / 森林 15%）
3. 河流从山脉向海洋延伸成链（保证至少 1 条贯通河流）
4. 玩家首都选 `plains` 或 `river`，**强制相邻 2 格 passable**
5. 各 AI 国首都按 `diplomacy/nations.js` 人格分散到地图其余位置（保证最短间距 ≥ 3 格）
6. 剩余地块设为 `neutral`

#### 1.2.4 地形与美术色卡（建议）

| 地形 | 底色 | 图标 |
|---|---|---|
| plains | 🟢 浅绿 | 🌾 |
| hills | 🟡 土黄 | ⛰️ |
| mountain | ⚫ 深灰 | 🏔️ |
| river | 🔵 浅青 | 🌊 |
| ocean | 🔵 深蓝 | 🌐 |
| desert | 🟠 砂橙 | 🏜️ |
| plateau | 🟣 灰紫 | 🗻 |
| marsh | 🟤 褐色 | 🌫️ |
| forest | 🟢 深绿 | 🌲 |
| snow | ⚪ 雪白 | ❄️ |

---

## 2. 经济 Economy

### 2.1 资源 Resources

#### 2.1.1 资源分层
前作已成型、续作延续：

| 层级 | 代表资源 | 用途 |
|---|---|---|
| **基础生存** | food / wood / stone / cloth | 人口需求、基础建造 |
| **加工一级** | plank / brick / tools / iron / copper | 进阶建筑、初级军工 |
| **加工二级** | steel / fine_clothes / furniture / papyrus | 高级产业链、奢侈品 |
| **军事专用** | swords / plate_armor / ordnance | 兵种招募消耗 |
| **奢侈贸易** | spice / coffee / dye / delicacies / ale | 阶层动态奢侈需求 |
| **工业时代** | coal / steel / oil / wiring / chemicals / electronics / plastics / aluminum | 后期产业链 |
| **无形资源** | silver（货币）/ science / culture / faith / knowledge | 全局支撑 |

#### 2.1.2 资源解锁机制
每个资源有 `unlockEpoch`（时代门槛）与 `unlockTech`（科技门槛）。

```js
iron: { unlockEpoch: 2, unlockTech: 'ironworking', tags: ['raw_material'] }
spice: { unlockEpoch: 4, unlockTech: 'cartography', tags: ['essential', 'manufactured'] }
```

#### 2.1.3 资源市场配置（marketConfig）
每个资源有独立的市场参数（继承自前作）：

| 参数 | 含义 | 典型值 |
|---|---|---|
| `basePrice` | 基础价 | food=1, silver=—, spice=26, ordnance=60 |
| `maxPrice` | 价格上限（倍率） | 生存品 30×，奢侈品 100×，军火 150× |
| `supplyDemandWeight` | 供需对价格的影响 | 0.8（稳定资源）–1.4（波动资源） |
| `inventoryTargetDays` | 目标库存天数 | 150–300 |
| `demandElasticity` | 需求弹性 | 0.3（刚需）–0.9（奢侈） |
| `outputVariation` | 产出浮动 | ±20% |

### 2.2 建筑 Buildings

#### 2.2.1 建筑类别分类

| 类别 | 代表建筑 | 主要作用 |
|---|---|---|
| **住房** | hut / house / mansion | 提供 maxPop |
| **农业** | farm / ranch / cotton_plantation | 基础食物/棉花 |
| **采集** | lumber_camp / mine / quarry / brickworks | 原材料 |
| **加工** | sawmill / loom_house / tool_workshop / steel_foundry | 加工品 |
| **商业** | market / trading_post / trade_port | 贸易、税收 |
| **军事** | barracks / training_ground / fortress / armory | 训练/防御/军火 |
| **行政** | town_hall / administrative_office | 官员容纳、税收加成 |
| **文化** | library / church / printing_house / university | 科研、文化、信仰 |
| **工业** | factory / textile_mill / steel_mill / refinery | 大规模工业产出 |
| **港口** | dockyard / harbor / navigator_school | 海运、贸易 |

#### 2.2.2 建筑新增元数据（续作核心）

```js
{
  id: 'farm',
  name: '农田',
  // ...原有字段...

  // ==== 续作新增 ====
  allowedTerrain: ['plains', 'river', 'hills'],  // 地形白名单
  preferredTerrain: ['plains'],                  // 推荐地形（UI 提示）
  occupiesCapacity: 1,                           // 占用承载格数
  isCoastalRequired: false,                      // 是否需要临海
}
```

#### 2.2.3 建筑升级系统（继承前作）
- 每个建筑有 0–3 级升级链（`buildingUpgrades.js`）
- 每级升级消耗资源、科技前置
- 升级提升产出、消耗、效率系数

#### 2.2.4 建造流程

```
玩家在 MapPanel 选中一个 player 地块
    ↓
进入 TileDetailView（二级界面）
    ↓
"可建造"列表按 allowedTerrain 筛选并标注禁建原因
    ↓
点击建造 → buyBuilding(id, tileId)
    ↓
校验：owner === 'player' && terrain 符合 && capacity 未满 && 资源足够
    ↓
tile.buildings[id]++
```

### 2.3 产业链 Industry Chains

#### 2.3.1 产业链是什么
产业链（`industryChains.js`）是一组相关建筑的**组合玩法**：原料 → 加工 → 消费 形成闭环，共同激活阶层加成、效率加成、特殊事件。

#### 2.3.2 已有 8 条产业链（延续前作）

| 产业链 | 阶段 | 代表建筑 | 消费阶层 | 目标时代 |
|---|---|---|---|---|
| `grain_chain` | 农业→磨坊→面包 | farm / mill / bakery | peasant, worker | Epoch 1+ |
| `textile_chain` | 棉花→织布→成衣 | cotton_plantation / loom_house / tailor | artisan, merchant | Epoch 2+ |
| `metal_chain` | 矿石→熔炼→武器 | mine / smelter / armory | soldier, engineer | Epoch 2+ |
| `wood_chain` | 伐木→锯木→家具 | lumber_camp / sawmill / carpenter | worker, artisan | Epoch 1+ |
| `stone_chain` | 采石→砖窑→建材 | quarry / brickworks / mason | worker | Epoch 1+ |
| `luxury_chain` | 香料/咖啡→精加工→上层消费 | coffee_plantation / coffee_house / trade_port | noble, merchant | Epoch 4+ |
| `industrial_chain` | 煤铁→钢铁→机械 | coal_mine / steel_foundry / factory | engineer, capitalist | Epoch 6+ |
| `energy_chain` | 石油→精炼→电力 | oil_pump / refinery / power_plant | engineer, technician | Epoch 7+ |

#### 2.3.3 产业链的激活条件
- 必须在**同一国家**内拥有完整的"原料 → 加工 → 消费"三阶段建筑
- 消费阶层人口足够
- 激活后提供 `efficiency / approval / influence` 加成
- 可通过科技升级该产业链的效率/利润

#### 2.3.4 空间性对产业链的影响（续作新增）

> ⚠️ 本期设计决定：**产业链激活判定仍按全国聚合**，不要求三阶段建筑在邻接地块。
> 理由：若强制空间临近，小图玩家几乎无法激活任何产业链，体验过于苛刻。
> 后续迭代可引入 **"地区产业集群"** 概念：邻接地块齐备时额外 +20% 加成。

### 2.4 市场 Market

#### 2.4.1 核心机制（严格保持前作）

> 🔒 **设计锁定**：市场系统是前作最成熟的子系统之一，续作**原样保留**，仅做地块侧的数据汇入改造。

**保留机制列表**：
1. **全国统一资源池**：所有玩家地块的产出 → 汇入全国 `resources`
2. **价格动态调节**：`inventoryRatio = 实际库存 / (消费 × targetDays)`，比率越低价格越高
3. **库存天数目标**：刚需 200d+、奢侈品 180d、军工品 270d+
4. **工资生存地板**：工资下限由"生存必需品篮子成本"决定
5. **头税 + 商业税 + 理念税**：分层征税，理念税进入 `virtualTaxIncome`（虚拟银币）
6. **跨国贸易**：条约影响关税、商人槽位、市场准入

#### 2.4.2 市场与地块的关系

```
地块 A：食物 +500      ┐
地块 B：食物 +300      ├──▶  全国食物池 += 1200
地块 C：食物 +400      ┘          ↓
                             全国食物消费 -1100
                                  ↓
                          库存比率 = 高 → 价格下跌
                                  ↓
                           农民收入下降 → 农民满意度
```

#### 2.4.3 税收系统
**头税**（按人头）+ **商业税**（按交易额）+ **关税**（国际贸易）。  
各税种由执政联盟/政体/理念影响最终税率修正系数。

---

## 3. 人口 Population

### 3.1 阶层 Strata

#### 3.1.1 完整阶层列表（18 个，延续前作）

##### 🏛️ 上流阶级（Upper Class）
| ID | 中文 | 初始财富 | 消费上限 | 影响力基数 | 主要需求 |
|---|---|---|---|---|---|
| `capitalist` | 资本家 | 1200 | 10× | 2.0 | 奢侈品全系 |
| `landowner` | 地主 | 800 | 8× | 1.8 | 精美衣物、珍馐 |
| `official` | 官员 | 400 | 8× | 1.6 | 书籍、文化、上层需求 |
| `engineer` | 工程师 | 700 | 8× | 1.5 | 工具、高端消费 |
| `scientist` | 科学家 | 600 | 8× | 1.5 | 书籍、文化、科研 |
| `merchant` | 商人 | 500 | 8× | 1.4 | 贸易品、奢侈品 |

##### ⚖️ 中产阶级（Middle Class）
| ID | 中文 | 初始财富 | 消费上限 | 影响力基数 | 主要需求 |
|---|---|---|---|---|---|
| `artisan` | 工匠 | 200 | 6× | 1.0 | 布料、工具、中等食物 |
| `soldier` | 军人 | 180 | 6× | 1.0 | 布料、酒、武器（间接） |
| `cleric` | 神职人员 | 220 | 6× | 1.1 | 书籍、文化、信仰 |
| `scribe` | 学者 | 250 | 6× | 1.1 | 书籍、papyrus |
| `navigator` | 水手 | 300 | 6× | 1.0 | 贸易品、酒、香料 |
| `technician` | 技师 | 280 | 6× | 1.0 | 工具、电子品 |

##### 🔨 下层阶级（Lower Class）
| ID | 中文 | 初始财富 | 消费上限 | 影响力基数 | 主要需求 |
|---|---|---|---|---|---|
| `worker` | 工人 | 80 | 3× | 0.7 | 食物、布料、工具 |
| `miner` | 矿工 | 85 | 3× | 0.6 | 食物、酒、工具 |
| `peasant` | 自耕农 | 80 | 3× | 0.5 | 食物、布料 |
| `serf` | 佃农 | 40 | 3× | 0.3 | 食物（仅） |
| `lumberjack` | 樵夫 | 75 | 3× | 0.5 | 食物、工具 |
| `unemployed` | 失业者 | 20 | 2× | 0.1 | 食物（仅勉强） |

#### 3.1.2 阶层分组与分类

**纵向分组（UI 分层显示）**：
- `upper`：上流阶级
- `middle`：中产阶级
- `lower`：下层阶级

**横向分类（政策/事件命中）**：
- `aristocracy`：贵族 = landowner + official
- `bourgeoisie`：资产阶级 = capitalist + merchant + engineer
- `proletariat`：无产阶级 = worker + miner + peasant + serf + lumberjack
- `military`：军事 = soldier
- `clerical`：宗教 = cleric
- `intellectual`：知识 = scribe + scientist + engineer
- `commercial`：商业 = merchant + navigator
- `agrarian`：农业 = peasant + serf + lumberjack + landowner
- `industrial`：工业 = worker + artisan + capitalist + engineer + miner + technician

#### 3.1.3 社会流动（Social Mobility）

| Tier | 阶层 | 进入财富门槛（目标阶层 startingWealth 倍数） |
|---|---|---|
| 0 | serf / unemployed | — |
| 1 | peasant / lumberjack / miner / worker | 0.8× |
| 2 | artisan / soldier / scribe / merchant / cleric / navigator / technician | 1.2× |
| 3 | official / landowner / capitalist / engineer / scientist | 1.5× |

当阶层财富累积到高 Tier 目标的门槛，且人口有冗余，即触发**阶层跃迁**。反之失业或饥荒导致下跌。

#### 3.1.4 阶层需求系统

##### 基础需求（startingWealth 以下）
每个阶层固定的"活下去"需求，如：
- peasant: food 0.42, cloth 0.06
- worker: food 0.35, cloth 0.12, tools 0.03
- capitalist: food 0.20, fine_clothes 0.15, delicacies 0.20, culture 0.25

##### 动态奢侈需求（财富阈值解锁）
随着阶层人均财富达到 `startingWealth × 1.5 / 2 / 3 / 4` 等阈值，逐档解锁新的奢侈需求。例：
- peasant 人均财富 > 120（1.5×）→ 解锁 `spice` 需求
- worker 人均财富 > 160（2×）→ 解锁 `coffee` 需求
- capitalist 人均财富 > 2400（2×）→ 解锁 `fine_clothes + culture + delicacies` 全档

##### 富裕陷阱（Wealth Trap）
- 财富涨了但供应链跟不上 → 新奢侈需求短缺 → 满意度**反而下降**
- 这是对"印钱治国"的直接惩罚

#### 3.1.5 阶层需求地块化（续作新增）

> ⚠️ **关键决策**：阶层需求消费**仍按全国市场执行**。
> 但 `classFinancialData` 按地块独立存储。
> 这样既保留了"全国级富人不满"事件强度，又为未来"地区起义" 预留了钩子。

### 3.2 满意度 Approval

#### 3.2.1 好感度综合公式

```
target_approval = 基础值 (70)
    + 生活水平加成 (赤贫 60 / 贫困 65 / 温饱 70 / 小康 75 / 富裕 85 / 奢华 95)
    - 税负惩罚 (headTax 超 incomeRatio 0.5 时封顶 40)
    + 低税率奖励 (headRate < 0.6 时 +5)
    - 基础需求短缺惩罚 (全部短缺封顶 0，部分封顶 30)
    - 奢侈需求短缺惩罚 (每个 -3，封顶 -15)
    - 生活水平长期低于温饱 streak 惩罚 (每档 1.5-2.5/tick, 封顶 -30)
    + 满足高满意度奖励 (≥98% 时 +10)
    + 失业阶层特殊惩罚 (2 + ratio×30)
    + 事件修正 (eventApprovalModifiers)
    + 法令修正 (decreeApprovalModifiers)

current = current + (target - current) × 0.02  // 惯性
final = min(current, livingStandardCap)         // 生活水平封顶
```

#### 3.2.2 生活水平的好感度上限（硬约束）

| 生活水平 | 好感度上限 |
|---|---|
| 赤贫 | 30 |
| 贫困 | 50 |
| 温饱 | 70 |
| 小康 | 85 |
| 富裕 | 95 |
| 奢华 | 100 |

> **设计含义**：生活水平是好感度的天花板——即使税收再低、政策再好，赤贫的农民最多喜欢你 30 分。

### 3.3 生活水平 Living Standard

#### 3.3.1 六档生活水平

| 等级 | 图标 | 分数区间 | 财富门槛（相对动态基准） | 典型特征 |
|---|---|---|---|---|
| 赤贫 `DESTITUTE` | 💀 | 0–20 | < 0.5× | 饭都吃不饱 |
| 贫困 `POOR` | ⚠️ | 20–40 | 0.5–1× | 基础需求部分满足 |
| 温饱 `SUBSISTENCE` | 🍴 | 40–55 | 1–2× | 能活下去 |
| 小康 `COMFORTABLE` | 🏠 | 55–70 | 2–4× | 有住房、能积蓄 |
| 富裕 `PROSPEROUS` | 💎 | 70–85 | 4–8× | 消费奢侈品 |
| 奢华 `LUXURIOUS` | 👑 | 85–100 | 8×+ | 全档需求满足 |

#### 3.3.2 生活水平综合评分（满分 100）

```
总分 = 收入充裕度 (0-50)
     + 需求满足率 × 30
     + 财务安全度 (0-20)
```

其中：
- **收入充裕度**：`(income - essentialCost) / essentialCost` → 线性映射
- **需求满足率**：满足的需求 / 总有效需求
- **财务安全度**：`savings / (dailyExpense × bufferDays)` → 不同档位 bufferDays 不同

##### bufferDays（财务安全缓冲天数）
| 生活水平 | bufferDays |
|---|---|
| 贫困 | 45 |
| 温饱 | 90 |
| 小康 | 180 |
| 富裕 | 540 |
| 奢华 | 1440 |

#### 3.3.3 动态购买力基准（Dynamic Wealth Reference）
生活水平**不再看静态银币数**，而是看"我能买多少当前物价下的必需品篮子"。

```
basketCost = 按当前价格 × 对应档位消费量累加
threshold[level] = basketCost × bufferDays[level]
```

> 这样设计的目的：通胀/通缩时生活水平不会虚假上升/下降。

---

## 4. 军事 Military

### 4.1 军团 Corps

#### 4.1.1 军团核心概念
军团（Corps）是兵力的**组织单位**。所有兵种必须编入军团才能执行作战任务。

```js
{
  id: 'corps_001',
  name: '第一集团军',
  units: { militia: 50, swordsman: 30 },
  generalId: 'gen_001' | null,
  assignedFrontId: 'front_001' | null,
  status: 'idle' | 'deployed' | 'in_combat' | 'retreating' | 'replenishing',
  morale: 80,  // 0-100
  isAI: false,
  nationId: 'player',
}
```

#### 4.1.2 军团规则
| 规则 | 数值 |
|---|---|
| 玩家最大军团数 | 8 |
| 无将领战力惩罚 | -15% |
| 士气对战力的影响 | 0.5 + (morale/100) × 0.5 |
| 军团解散 | 单位退回全国 army 池 |
| 军团补员 | 可配置自动补员队列 |

#### 4.1.3 兵种时代解锁（摘录）

| 时代 | 代表兵种 |
|---|---|
| 0 石器 | militia（民兵）、tribal_warrior（部落战士） |
| 1 青铜 | spearman（长矛兵）、bronze_infantry |
| 2 古典 | swordsman（刀剑手）、cavalry（骑兵）、archer |
| 3 封建 | knight（骑士）、crossbowman（弩手） |
| 4 探索 | musketeer（火枪手）、pikeman、galleon（盖伦帆船） |
| 5 启蒙 | line_infantry（线列步兵）、field_cannon（野战炮） |
| 6 蒸汽 | rifleman（来复枪兵）、steam_ironclad（铁甲舰） |
| 7 电气 | machinegunner、howitzer、dreadnought |
| 8 原子 | mechanized_infantry、tank、bomber |
| 9 信息 | marine、missile_unit、carrier、drone |

#### 4.1.4 前线系统（Front System）
- 宣战后自动生成一条或多条**前线**（`front_001 / front_002`）
- 每个前线有 `linePosition`（0–100），代表战线推进度
- 军团可被分配到前线，不分配则为"预备役"
- 双方军团在同一前线 → 触发战斗冷却 → 战斗结算

#### 4.1.5 交战类型（Engagement Type）

| 类型 | 触发条件 | 特点 |
|---|---|---|
| `probe` 试探 | 小规模接触 | 低伤亡、低推进 |
| `assault` 强攻 | 兵力比 ≥ 1.3 或规模 ≥ 200 | 中伤亡、中推进 |
| `siege` 围城 | `linePosition` ≥ 82 / ≤ 18 且规模 > 180 | 高伤亡、决定性 |

#### 4.1.6 战斗结算因子
- 兵种属性（attack / defense）
- 将领特质（流浪/勇猛/谨慎/后勤/火器精通…）
- 士气
- 战术（auto_tactic 按 engagement + 将领）
- 地形加成（未来扩展：如山地防御 +20%）

### 4.2 将领 Generals

#### 4.2.1 将领数据结构

```js
{
  id: 'gen_001',
  name: '岳飞',  // 从 GENERAL_NAMES 池中抽取
  level: 3,       // 1-5
  experience: 780,
  traits: ['brave', 'tactician'],  // 1-3 条
  assignedCorpsId: 'corps_001' | null,
  lastBattleProposalDay: 120,
}
```

#### 4.2.2 将领特质（Traits）
每位将领有 1–3 条特质，影响军团战力修正：

| 特质 | 效果 |
|---|---|
| `brave` 勇猛 | attack +15% |
| `cautious` 谨慎 | defense +15% |
| `tactician` 战术家 | 解锁高级战术 |
| `logistician` 后勤专家 | 补给消耗 -20% |
| `firearm_expert` 火器精通 | 火器兵种 attack +20% |
| `cavalry_leader` 骑将 | 骑兵兵种 attack +20% |
| `siege_master` 攻城能手 | siege 交战 attack +30% |
| `inspirational` 鼓舞人心 | 士气回复 +50% |
| `ruthless` 冷酷 | 战损加给敌方 +10%，己方士气 -5 |

#### 4.2.3 将领晋升
- 战胜获得经验
- 经验达阈值自动升级
- 升级提升加成倍率（level 1 → 1.0× / level 5 → 1.5×）

#### 4.2.4 将领来源
- **初始**：开局送 1 位青铜时代将领
- **选拔**：从现有官员中提拔（消耗 silver + 声望）
- **历史事件**：特定事件奖励
- **将领提议**：前线将领可主动提议作战（战斗弹窗），玩家批准/否决

#### 4.2.5 战争奖励（续作核心变化）

| 胜利程度 | 可割让地块数 | 特殊奖励 |
|---|---|---|
| 压倒性胜利 | 最多 4 块 | 赔款 + 掠夺 + 条约 |
| 决定性胜利 | 最多 3 块 | 赔款 + 掠夺 |
| 战术胜利 | 1–2 块 | 赔款 |
| 勉强胜利 | 0–1 块 | — |

> **硬约束**：
> 1. 可选地块必须**相邻于战胜方现有国土**
> 2. **不能选战败方首都**（防一战灭国）
> 3. 地块翻转时建筑/人口/财富随之转移

#### 4.2.6 掠夺机制（延续前作）
战胜方按战争类型掠夺不同比例资源：
- `raid` 劫掠：食物/银币/货币多
- `pillage` 洗劫：全类别少量
- `sack` 洗劫城市：大量各类 + 建筑资源
- `sack_trade` 劫掠商路：贸易品/奢侈品为主

---

## 5. 政府 Government

### 5.1 政体 Polity

#### 5.1.1 政体是"浮现"的，不是"选择"的

> 🔑 **核心设计**：玩家**不直接选政体**，而是通过调整执政联盟（rulingCoalition）间接决定。

```
执政联盟（1-N 个阶层）
      ↓
由 rulingCoalition.js 按优先级规则匹配
      ↓
浮现一个政体名称（如"工农联合政府"、"资产阶级共和国"）
      ↓
应用政体效果（taxIncome / production / stability / officialCapacity / ...）
```

#### 5.1.2 政体名称表（30+ 种，延续前作）

| 执政联盟特征 | 浮现政体 |
|---|---|
| 无联盟 | 无执政联盟（混乱） |
| 仅 landowner | 封建君主制 |
| 仅 cleric | 神权政体 |
| 仅 capitalist | 资产阶级寡头 |
| 仅 soldier | 军人政府 |
| 仅 merchant | 商业共和国 |
| peasant + landowner | 封建王国 |
| peasant + worker | 工农联合政府 |
| peasant + soldier + landowner | 王朝封建制 |
| worker + artisan | 工人自治政府 |
| capitalist + merchant | 资产阶级共和国 |
| capitalist + engineer + scientist | 技术官僚制 |
| cleric + landowner | 神权封建王国 |
| cleric + official | 神圣帝国 |
| soldier + official | 军事官僚制 |
| peasant + worker + soldier | 人民阵线 |
| 三阶级均衡 | 全民联合政府 |
| soldier + cleric | 十字军政权 |
| capitalist + official | 重商君主制 |
| landowner + official + cleric | 古典帝国 |
| ...共计 30+ 种 | ... |

#### 5.1.3 政体效果维度

| 效果类型 | 说明 |
|---|---|
| `taxIncome` | 税收加成（正/负） |
| `production` | 生产效率加成 |
| `industryBonus` | 工业加成 |
| `stability` | 稳定度基础修正 |
| `stabilityFlat` | 稳定度绝对值修正 |
| `officialCapacity` | 官员上限修正 |
| `buildingProductionMod` | 特定建筑产出修正 |
| `stratumDemandMod` | 特定阶层需求修正 |
| `militaryBonus` | 军事单位加成 |
| `approvalMod` | 特定阶层好感度修正 |
| `maxPopMod` | 人口上限修正 |
| `officialFactionBias` | 官员派系偏好 |

#### 5.1.4 政治立场（Political Stances）

> 🔧 注：不同于"政体"，政治立场是**玩家可主动选择**的政策立场。

##### 立场维度（12 个）
| 维度 | 代表立场 |
|---|---|
| 威权度 | authoritarian ↔ liberal |
| 经济体制 | planned ↔ market |
| 社会阶层 | egalitarian ↔ hierarchical |
| 军事取向 | pacifist ↔ militarist |
| 宗教态度 | theocratic ↔ secular |
| 民族认同 | nationalist ↔ cosmopolitan |
| 福利 | welfare ↔ austerity |
| 产权 | private ↔ public |
| 效率 | efficient ↔ inefficient |
| 进步 | progressive ↔ conservative |
| 自然 | green ↔ industrial |
| 稳定 | stable ↔ revolutionary |

##### 时代解锁的立场条目（摘录）
| 时代 | 解锁立场 |
|---|---|
| 0 | tribalism, clan_rule |
| 2 | theocracy, republicanism, populares, legalism |
| 3 | confucianism, mohism, monarchism |
| 4 | mercantilism, absolutism |
| 5 | conservatism, liberalism, classical_liberalism |
| 6 | utilitarianism, nationalism |
| 7 | social_democracy, anarchism, fascism |
| 8 | eco_socialism, communism |
| 9 | transhumanism, technocracy |

##### 立场激活条件与惩罚
每个立场有一组条件（如"农民影响力 ≥ 15%"、"国库 > 10000"、"启用了 XX 理念"）。  
- ✅ 条件全部满足 → 激活正向效果
- ❌ 条件不满足 → 触发惩罚（不稳定 / 满意度下降）

#### 5.1.5 官员与内阁（Officials & Cabinet）

##### 官员核心属性
```js
{
  id: 'official_001',
  name: '王安石',
  hired: true,
  sourceStratum: 'scribe',   // 出身阶层
  faction: 'reformist',       // 派系（保守/改革/中立/军国/商业/...）
  stance: 'progressive',
  loyalty: 85,                // 忠诚度
  influence: 240,             // 影响力
  tenure: 120,                // 任期（天）
  traits: ['silver_+15%', 'stability_+2'],
  portfolio: 'finance_minister' | 'war_minister' | null,
}
```

##### 官员效果类别（摘录）
| 类别 | 类型 | 典型效果范围 |
|---|---|---|
| 经济 | `passive_percent` | 银币/食物产出 +6~28% |
| 需求 | `stratum_demand` | 阶层需求 -10~35% |
| 需求 | `resource_demand` | 单资源需求 -6~28% |
| 军事 | `military_bonus` | 单位攻防 +5~20% |
| 外交 | `diplomacy_bonus` | 关系衰减 -10~50% |
| 稳定 | `stability_flat` | 稳定度 +3~10 |
| 科研 | `science_bonus` | 科研速度 +10~40% |
| 文化 | `culture_bonus` | 文化产出 +10~50% |

##### 内阁协同（Cabinet Synergy）
将多位官员组织成"内阁组合"触发额外加成：
- 3 位 reformist 官员 → 建筑速度 +15%
- 财政 + 国防 + 外交 三部齐备 → 官员容纳上限 +2
- 2 位同派系官员 → 派系影响力 +10%

##### 官员投资（Official Investment）
官员可用自身 silver 投资私人产业，形成个人资产，影响本人/派系影响力。

### 5.2 理念 Ideology

#### 5.2.1 理念系统核心机制

> 🎴 **设计定位**：理念是**玩法行为的涌现奖励**，决定文明的意识形态走向。

##### 核心循环
```
玩法行为（建造里程碑 / 人口里程碑 / 事件触发）
      ↓
积攒理念分（Ideology Score）
      ↓
达到阈值（35 + ownedCount × 20）→ 触发三选一涌现
      ↓
玩家选一个（新理念 = Lv.1 / 已有则升级，上限 Lv.3）
      ↓
装备到卡槽 → 激活效果
```

##### 卡槽数量表
| 时代 | 卡槽数 |
|---|---|
| 0 石器 | 3（基础） |
| 1 青铜 | 4 |
| 2 古典 | 5 |
| 3 封建 | 6 |
| 4 探索 | 7 |
| 5 启蒙 | 8 |
| 6+ | 最多 10（联动加成可提升） |

##### 装备规则
- 未装备的理念不生效
- 理念可随时卸下，但卸下后**冷却 30 天**不能装备同一个
- 卡槽已满时必须先卸下一个才能装备新理念

#### 5.2.2 理念稀有度与权重

| 稀有度 | 权重倍率 | 跳过加成（1/2/3 次） |
|---|---|---|
| common | 1.0 | 0.88/0.76/0.64 |
| uncommon | 0.85 | 1.4/1.9/2.5 |
| rare | 0.65 | 1.9/3.2/5.2 |
| legendary | 0.4 | 3.2/6.5/11 |

跳过候选池 1/2/3 次后，下一次涌现强制保底 uncommon / rare / rare 以上稀有度。

#### 5.2.3 理念分类（Category）

| 类别 | 代表理念 |
|---|---|
| `philosophy` 哲学 | 理性主义、人文主义、存在主义 |
| `politics` 政治 | 君主神权、人民主权、精英主义 |
| `economy` 经济 | 重商主义、自由市场、计划经济、绿色经济 |
| `military` 军事 | 尚武精神、职业化军队、全民皆兵 |
| `social` 社会 | 种姓制度、平等主义、能贤至上 |
| `religion` 宗教 | 一神论、多神论、无神论、正教合一 |
| `culture` 文化 | 文艺复兴、古典复兴、保守文化 |
| `science` 科学 | 经验主义、技术崇拜、反智主义 |

#### 5.2.4 理念效果类型（Trigger Effects）

| 类型 | 功能 | 示例 |
|---|---|---|
| `flat_bonus` | 直接数值加成 | `production: +0.05` |
| `percent_bonus` | 百分比加成 | `scienceBonus: +0.10` |
| `stratum_bonus` | 特定阶层加成 | `peasant 产出 food +0.003/人` |
| `epoch_scaling` | 按时代缩放 | 每进一时代 `production +0.02` |
| `converter` | 资源转换 | 每 100 silver → 1 culture（有 cap） |
| `conditional_flip` | 条件翻转 | 若稳定 > 80 加成翻倍 |
| `mutual_exclusion` | 理念互斥 | 种姓制度 vs 平等主义冲突扣 stability |
| `diminishing_returns` | 递减收益 | 同类别第 N+1 个开始 -3% |
| `resource_drain` | 资源消耗 | 每天消耗 food 某某 |
| `official_faction_bonus` | 官员派系绑定 | 3 个 reformist 官员 → 某加成 |
| `ruleMods` | 规则层修正 | building_cost/tax_modifier/cooldown_mod |

#### 5.2.5 理念协同与反协同

##### 协同（Synergy）
指定一组理念全部装备 → 触发额外效果。
- 例：`rationalism + empiricism + humanism` → 解锁 `启蒙运动` 协同，科研 +15%、文化 +10%

##### 反协同（Anti-Synergy）
指定冲突组合 → 触发惩罚。
- 例：`caste_system + egalitarianism` → 稳定 -15、人口 -5%（根本矛盾）

#### 5.2.6 理念升级与阶段解锁

每个理念有 3 级，每升一级阶段解锁更多效果：
- Lv.1：基础数值
- Lv.2：+附加加成（如扩大范围）
- Lv.3：解锁高级 triggerEffects / converter / ruleMods

---

## 6. 科技 Technology

### 6.1 时代与科技的关系

前作沿用的双层结构：
- **时代（Epoch）**：宏观阶段，10 个时代
- **科技（Technology）**：微观解锁点，依附于时代

### 6.2 10 时代总表

| # | 时代 | 代表颜色 | 前置门槛 | 进入成本（摘录） | 核心 bonuses |
|---|---|---|---|---|---|
| 0 | 石器时代 | stone-400 | — | — | gather +30% |
| 1 | 青铜时代 | orange-400 | science 280, pop 15 | food 3000, wood 1500, silver 250 | gather +40%, military +20%, industry +20% |
| 2 | 古典时代 | amber-300 | science 1800, pop 150 | food 20k, wood 10k, silver 5k | gather +60%, science +20%, industry +30%, maxPop +10% |
| 3 | 封建时代 | blue-400 | science 4500, pop 400, culture 600 | food 100k, iron 12.5k | gather +80%, taxIncome +10% |
| 4 | 探索时代 | cyan-300 | science 8000, pop 900, culture 1400 | plank 70k, iron 35k | industry +60%, taxIncome +25% |
| 5 | 启蒙时代 | purple-400 | science 12k, pop 1800, culture 2500 | spice 20k, silver 50k | scienceBonus +80%, stability +10 |
| 6 | 蒸汽时代 | gray-200 | science 20k, pop 4500 | iron 120k, tools 75k | industry +200%, maxPop +20% |
| 7 | 电气时代 | sky-400 | science 30k, pop 8000 | steel 8000, coal 15k | industry +250%, taxIncome +15% |
| 8 | 原子时代 | violet-400 | science 50k, pop 14000 | oil 8000, chemicals 4000 | science +250%, industry +350% |
| 9 | 信息时代 | cyan-400 | science 80k, pop 25000 | electronics 5000, plastics 8000 | science +400%, industry +500% |

### 6.3 科技树结构

每个科技节点包含：
```js
{
  id: 'ironworking',
  name: '铁器',
  epoch: 2,
  cost: { science: 180 },
  prereq: ['bronze_casting'],          // 前置科技
  unlocks: {
    resources: ['iron'],
    buildings: ['iron_mine'],
    units: ['iron_spearman'],
    ideologies: ['metallurgy_cult'],
  },
  bonuses: {
    militaryBonus: 0.03,
    buildingProductionMod: { iron_mine: 0.10 },
  }
}
```

### 6.4 科研资源来源
- **文化建筑产出**（library / university / printing_house）
- **阶层科研 per pop**（scientist / scribe / engineer）
- **理念加成**（`scienceBonus`）
- **条约加成**（academic_exchange +5%）
- **国际组织加成**（economic_bloc 间接）

### 6.5 时代升级流程
1. 满足 `req`（科研点、人口、文化门槛）
2. 支付 `cost`（一次性大额消耗）
3. 应用 `bonuses`（全局常驻加成）
4. 解锁下一时代的资源/建筑/科技/理念

### 6.6 科技与地块的关系
- 大多数科技**不按地块生效**，是全国加成
- 少数科技影响"建筑在特定地形的加成"（如"灌溉 → 平原 food +10% 额外"）
- 未来扩展：地形改造科技（平原 → 耕地、山地 → 梯田）

---

## 7. 外交 Diplomacy

### 7.1 外国 Foreign Nations

#### 7.1.1 AI 国家的数据模型

```js
{
  id: 'nation_xia',
  name: '夏',
  color: '#c0392b',
  isAnnexed: false,
  isRebelNation: false,
  capitalTileId: 'tile_15x8',
  ownedTileIds: ['tile_14x8', 'tile_15x8', 'tile_15x9', ...],
  socialStructure: {
    elites:      { ratio: 0.10, satisfaction: 75, influence: 0.45, wealth, population },
    commoners:   { ratio: 0.80, satisfaction: 50, influence: 0.35, wealth, population },
    underclass:  { ratio: 0.10, satisfaction: 35, influence: 0.20, wealth, population },
  },
  economy: { silver, stockpiles: { /* 资源池 */ } },
  militaryStrength: 1.2,        // 与玩家对比倍率
  tradeNeeds: { wants: [...], offers: [...], urgency },
  foreignRelations: { player: 60, nation_xxx: 45, ... },
  foreignWars: { player: { isAtWar: true, startDay: 100 } },
  treaties: [ /* 与各方签订的条约 */ ],
  organizations: [ 'mil_alliance_003' ],
  diplomacyPersonality: 'aggressive' | 'merchant' | 'isolationist' | 'balanced',
  isVassal: false,
  vassalLordId: null,
}
```

#### 7.1.2 社会结构模板（按政体）

| 政体 | elites | commoners | underclass |
|---|---|---|---|
| monarchy 君主制 | 10%, 75满, 0.45影响 | 80%, 50, 0.35 | 10%, 35, 0.20 |
| republic 共和制 | 15%, 65, 0.35 | 75%, 60, 0.45 | 10%, 45, 0.20 |
| theocracy 神权 | 12%, 70, 0.50 | 78%, 55, 0.30 | 10%, 40, 0.20 |
| tribal 部落 | 8%, 60, 0.40 | 82%, 55, 0.40 | 10%, 50, 0.20 |

#### 7.1.3 AI 国家的人格
| 人格 | 倾向 |
|---|---|
| `aggressive` 激进 | 高频宣战、抢地、低容忍挑衅 |
| `merchant` 商人 | 优先贸易/自贸/投资协议 |
| `isolationist` 孤立主义 | 拒绝联盟、重防御条约 |
| `balanced` 均衡 | 无特殊偏好 |
| `dominant` 霸权 | 主动拉帮结派、建联盟 |

#### 7.1.4 外交关系（Relations）
- 0–100 的整数
- 关系越高，条约通过率越高，建联盟可能性越大
- 关系衰减：不交流每月 -0.5，条约/组织可减缓衰减
- 关系事件修正（签条约 +10 / 违约 -20 / 宣战 -50）

#### 7.1.5 附庸系统（Vassal）
- 胜利后可要求战败国成为附庸
- 附庸自动跟随宗主参战
- 附庸贡献年度朝贡（资源/人口/科研）
- 附庸叛离条件：关系 < 20 或宗主实力 < 附庸实力

### 7.2 国际组织 International Organizations

#### 7.2.1 三大国际组织

##### ⚔️ 军事联盟（Military Alliance）
| 属性 | 值 |
|---|---|
| 最小时代 | Epoch 3（封建） |
| 最低创建/加入关系 | 60 |
| 创建成本 | 财富 × 5% |
| 成员费（月） | 财富 × 0.1% |
| 成员上限按时代 | 3:4, 4:6, 5:8, 6:10, 7:12, 8:15 |
| 核心效果 | 共同防御 + 军事力量 +10% + 关系 +5 |
| 退出关系惩罚 | -15（创始退出 -25） |

##### 💰 经济共同体（Economic Bloc）
| 属性 | 值 |
|---|---|
| 最小时代 | Epoch 5（启蒙） |
| 最低加入关系 | 75（硬门槛） |
| 创建成本 | 财富 × 8% |
| 成员效果 | 关税 -40% + 贸易效率 +30% + 海外投资利润税 10% + 成员互开海外投资 |

##### 🚢 自由贸易区（Free Trade Zone）
| 属性 | 值 |
|---|---|
| 最小时代 | Epoch 4（探索） |
| 最低加入关系 | 50 |
| 成员效果 | 关税 -25% + 商人槽位 +3 + 贸易效率 +15% |

#### 7.2.2 国际组织的双向机制
- 玩家可**创建**（消耗财富 + 关系门槛 + 成员数下限）
- 玩家可**申请加入**（若满足门槛，向创始国外交申请）
- 玩家可**退出**（扣关系 + 一次性成本）
- AI 自动评估加入/退出（关系阈值判定）

### 7.3 国际贸易 International Trade

#### 7.3.1 条约列表（10 种）

| 条约 | 主效果 | 关税 | 商人槽位 | 期限（年） |
|---|---|---|---|---|
| peace_treaty 和平条约 | 停战 | — | — | 5 |
| non_aggression 互不侵犯 | 不宣战 | — | — | 10 |
| trade_agreement 贸易协定 | 初级贸易 | -15% | +20% | 10 |
| open_market 开放市场 | 完全市场准入 | -10% | ∞ | 15 |
| free_trade 自由贸易 | 关税归零 | -100% | +50% | 20 |
| investment_pact 投资协议 | 解锁海外建筑 | -10% | +1 | 15 |
| academic_exchange 学术交流 | 科技 +5% | — | — | 10 |
| defensive_pact 共同防御 | 被攻击互助 | -10% | +1 | 15 |
| military_alliance 军事同盟 | 主动互助 | -15% | +2 | 20 |
| economic_bloc 经济共同体 | 全面经济一体化 | -40% | +5 | 25 |

#### 7.3.2 国际贸易的撮合逻辑
```
每 30 tick 更新各国的 tradeNeeds
      ↓
每 50 tick 执行供需匹配
      ↓
wantMap / offerMap 按资源构建
      ↓
按需求紧急度排序，有卖家的成交
      ↓
关税结算 = 贸易额 × 关税率 × (1 - 条约减免) × (1 - 组织减免)
      ↓
结果计入玩家/AI 的 silver 流水
```

#### 7.3.3 海外投资（Overseas Investment）
- 签订 `investment_pact` 或加入 `economic_bloc` 后解锁
- 玩家可在外国建造海外资产（海外工厂、种植园、贸易站）
- 利润汇回受条约税率影响（无条约 50%、投资协议 10%、经济共同体 10%）
- 海外资产在战争时可能被没收

#### 7.3.4 国际贸易与地块的关系（续作新增）
- 玩家的**外国贸易"路径"不再抽象**，改为：
  1. 贸易品从玩家的**港口地块**出发（必须是 `harbor / dockyard` 建筑）
  2. 经过双方外交关系抽象的"航线" 
  3. 到达对方港口地块
- 无港口的国家只能做**陆路贸易**（陆路关税 +20%）
- 港口贸易效率 +15%

#### 7.3.5 外交割地（续作核心变化）
- 旧机制：调整 `maxPop` 标量
- 新机制：**具体指定地块翻转**
- 谈判界面：列出可割地块（相邻于战胜方国土、排除首都），玩家勾选
- 地块翻转后，建筑/人口/财富随地块转移

---

## 8. UI/UX 结构

### 8.1 顶级导航变化

```
旧：[资源] [建筑] [人口] [外交] [军事] [官员] [理念] [科技]
新：[资源] [🗺️地图] [人口] [外交] [军事] [官员] [理念] [科技]
                                                                    ⬆
                                         "建筑"按钮被"地图"取代
```

### 8.2 地图 → 地块二级界面（核心玩法入口）

#### 8.2.1 一级地图界面
- 俯视 2D 地图
- 地形颜色 + 归属边框 + 首都 ★ 标识
- 支持缩放、平移、地块 hover 提示
- 图例栏：地形色卡 + 归属说明

#### 8.2.2 二级地块详情界面（我方地块）
- 顶栏：返回地图 + 地块名（地形 · 归属 · 首都标记）
- 地块概览：承载使用、资源加成、本地人口、就业率
- 本地建筑列表：可查看/拆除
- 可建造列表（复用 BuildTab 卡片）：带筛选/搜索/禁建原因提示
- 底部操作条：快速切换到其他我方地块的快捷键

#### 8.2.3 二级地块详情界面（非我方地块）
- 只读概览（地形、归属国家、大致人口）
- 不展示具体建筑/阶层数据（信息不透明）
- 底部：`[派遣使节] [贸易请求] [宣战] [殖民（若 neutral）]`

### 8.3 其他 Tab 的改动

| Tab | 改动 |
|---|---|
| 资源 | 保持（全国资源池） |
| 人口 | 顶部加"全国聚合"/"按地块"切换 |
| 外交 | 割地界面改为"勾选地块列表" |
| 军事 | 前线界面显示前线位置（地图可视化） |
| 官员 | 保持 |
| 理念 | 保持 |
| 科技 | 保持 |

### 8.4 视觉语言

| 元素 | 处理 |
|---|---|
| 地形底色 | 见 1.2.4 色卡 |
| 归属边框 | 玩家金色 / 中立灰 / 他国代表色 |
| 首都标记 | ★ 金色 |
| 选中态 | 粗金色外描边 + 淡金色发光 |
| 建筑数量徽章 | 地块中央小圆徽"5/6" |
| 战线 | 前线地块闪红 |
| 连通线 | 同国家地块同色 + 内边线淡化 |

### 8.5 移动端适配
- 地图双指缩放 + 单指平移
- 地块点击热区 ≥ 44×44 px
- 二级界面小屏满屏占据，大屏侧拉抽屉
- 地块概览区可折叠

---

## 9. 数值骨架与平衡

### 9.1 地块承载分布（参考）

| 承载档 | 数值 | 对应地形 |
|---|---|---|
| 极小 | 2 | mountain / desert / marsh / snow |
| 小 | 3 | plateau |
| 中 | 4 | hills / forest |
| 大 | 5 | river |
| 特大 | 6 | plains |

### 9.2 开局参数

| 参数 | 值 |
|---|---|
| 首都地形 | plains |
| 首都承载 | 6 |
| 相邻 2 格强制可通行 | ✅ |
| 初始人口 | 与前作一致（5） |
| 初始建筑 | 与前作一致 |
| 初始 silver | 与前作一致 |
| 初始理念 | 无 |
| 初始科技 | 石器时代基础 |

### 9.3 扩张节奏（预期）

| 游戏日 | 预期地块数 | 典型获取方式 |
|---|---|---|
| 0 | 1 | 初始首都 |
| 50 | 2–3 | 殖民邻近 neutral |
| 150 | 5–7 | 小规模战争 + 外交割让 |
| 400 | 10–15 | 大战争 + 联盟分赃 |
| 1000 | 15+ | 霸权战争 |

### 9.4 就业失配惩罚（地块化新增）

| 情况 | 阈值 | 惩罚 |
|---|---|---|
| 本地失业率 > 30% | 30% | 阶层每月财富 -5% |
| 本地缺工率 > 30% | 30% | 建筑产出 ×0.8 起（按填充率线性） |
| 长期失业 > 90 天 | 90d | 可能下降到 `unemployed` |

### 9.5 战争规模与可割地块数

| 规模 | 参战兵力 | 可割地块上限 |
|---|---|---|
| 冲突 | < 200 | 1 |
| 局部战争 | 200–500 | 2 |
| 大规模战争 | 500–1500 | 3 |
| 世界大战 | > 1500 | 4 |

### 9.6 地形加成平衡准则

| 规则 | 说明 |
|---|---|
| 最高加成 | ≤ ×2.5（避免地块卡位过度） |
| 最低加成 | ≥ ×0.5（非硬禁止情况下） |
| 硬禁止（×0） | 仅用于"概念上完全不合理"组合 |
| 每种地形应有 1 个强项 | 避免完全无用地形 |

---

## 10. 分阶段上线路线

### Phase 1：基础数据层（2 周）
**目标**：底层迁移，玩家无感

- [ ] 地图生成算法 + 10 种地形
- [ ] `tiles` 数据结构 + 邻接表
- [ ] `useGameState.js` 新增 `tiles` 状态
- [ ] `simulation.js` 主循环增加按 tile 遍历层（功能开关关闭时等价前作）
- [ ] `workers/simulation.worker.js` 序列化 tiles
- [ ] 老存档迁移：单地块首都 + 数据完整迁移
- [ ] 迁移单元测试

### Phase 2：核心玩法（3 周）
**目标**：玩家能完整体验地块玩法

- [ ] MapPanel 一级地图 UI（俯视 + 缩放 + 平移）
- [ ] TileDetailView 二级地块界面
- [ ] BottomNav "建筑" → "地图"
- [ ] `buildings.js` 新增 `allowedTerrain`（100+ 建筑）
- [ ] `buyBuilding(id, tileId)` 签名改造
- [ ] 本地就业匹配（按 tile 独立）
- [ ] `classFinancialData` 按 tile 分片 + 全国聚合

### Phase 3：战争外交联动（1–2 周）
**目标**：战争/外交产出"看得见的地皮"

- [ ] 外交割地改为地块翻转
- [ ] 战争胜利"可选地块"UI
- [ ] AI 按地块建造（V1 随机可建地块）
- [ ] 地块翻转的建筑/人口/财富迁移

### Phase 4：打磨与平衡（1 周）
**目标**：上线前收尾

- [ ] 数值调优（承载、加成、惩罚）
- [ ] UI 动效润色
- [ ] 移除功能开关
- [ ] 回归测试

**合计工期：6–8 周（单人全职口径）**

---

## 11. 非目标与未来扩展

### 11.1 本期明确不做

❌ 每地块独立市场与跨地块运输成本  
❌ 军队在地块间逐格推进、地形战术、行军路线  
❌ 地区性叛乱/起义（阶层不满按地块触发）  
❌ 跨地块人口自动迁移 UI  
❌ AI 的高智能地块经济决策  
❌ 地形改造（如平原 → 耕地）  
❌ 城市/村庄分级  
❌ 国家等级系统（此为前作未有机制，可作为后续大版本扩展）  

### 11.2 未来扩展钩子

| 功能 | 本期预留 |
|---|---|
| 跨地块人口迁移 | 邻接表已存 |
| 地区叛乱 | 阶层财富按地块存储 |
| 军队在地块间移动 | 通行性 + 邻接表已存 |
| 贸易路线（含中转节点） | 邻接表 + 归属信息 |
| 地形改造 | 地形字段可变 |
| 地块独立市场 | 全局市场架构不阻挡未来拆分 |
| 中立地殖民 | 归属字段已支持 `'neutral'` |
| 城市/村庄分级 | 承载上限字段已存 |
| 被征服 Debuff | `conqueredBy / conqueredAtDay` 已存 |
| 历史领袖/势力特色 | 可参考国家等级系统框架未来独立扩展 |

---

## 12. 风险与缓解

| # | 风险 | 严重度 | 缓解策略 |
|---|---|---|---|
| R1 | 本地就业导致"失业+缺工并存" 体验差 | 🔴 高 | UI 醒目告警；V2 加自动迁移 |
| R2 | 存档迁移出错 | 🔴 高 | 保留全国聚合冗余字段 + 版本号 + 迁移单元测试 |
| R3 | 阶层财富聚合削弱富人不满事件 | 🟡 中 | 下个迭代做"地区起义" |
| R4 | 地图 UI 低端设备卡顿 | 🟡 中 | 限制地图规模；用 CSS Grid 而非 Canvas |
| R5 | AI 按地块决策变弱 | 🟢 低 | V1 用"随机已拥地块"保底 |
| R6 | 工期失控 | 🟡 中 | 功能开关可回滚、分阶段上线 |
| R7 | 产业链激活逻辑混乱 | 🟢 低 | 明确保持全国聚合判定 |
| R8 | 战争平衡被空间扩张打破 | 🟡 中 | 数值调优：割地上限、首都保护 |
| R9 | 外交 AI 不会抢地 | 🟡 中 | V2 扩展 AI 主动扩张逻辑 |

---

## 附录 A：与现有系统对接点

| 模块 | 改动程度 | 说明 |
|---|---|---|
| `src/logic/simulation.js` | 🔴 大 | 主循环按 tile 遍历层 |
| `src/logic/population/jobs.js` | 🔴 大 | 按 tile 独立匹配 |
| `src/logic/economy/wages.js` | 🟡 中 | 按地块阶层发工资 |
| `src/logic/economy/prices.js` | 🟢 无 | 保持全国 |
| `src/logic/economy/trading.js` | 🟢 无 | 保持全国 |
| `src/logic/economy/taxes.js` | 🟡 中 | 按地块聚合后征收 |
| `src/logic/diplomacy/*` | 🟡 中 | 割地改为翻转地块 |
| `src/logic/ai/*` | 🟡 中 | 建造决策加 tileId |
| `src/hooks/useGameState.js` | 🔴 大 | 新增 `tiles` 状态 |
| `src/hooks/useGameActions.js` | 🔴 大 | build/destroy 加 tileId |
| `src/components/tabs/BuildTab.jsx` | 🔴 大 | 不再作为一级入口 |
| `src/components/game/CityMap.jsx` | 🔴 大 | 重写为 MapPanel |
| `src/components/game/TileDetailView.jsx` | 🆕 新建 | 二级地块界面 |
| `src/components/layout/BottomNav.jsx` | 🟡 中 | "建筑"→"地图" |
| `src/workers/simulation.worker.js` | 🟡 中 | 序列化 tiles |
| `src/config/buildings.js` | 🟢 小 | 新增 `allowedTerrain` |

---

## 附录 B：EARS 验收需求清单

本章节是对应"任务分解"的原子需求清单。每条需求都可以独立测试验证，后续 `task-item.md` 将引用此处编号。

### 需求 1：地图与地块

**用户故事：** 作为玩家，我希望看到一张由多种地形组成的战略地图，以便让决策更具"地理感"。

#### 验收标准
1. WHEN 新局开始 THEN 系统 SHALL 生成一张 30–80 格的网格地图，包含 10 种地形。
2. WHEN 玩家打开地图界面 THEN 系统 SHALL 以俯视 2D 展示全部地块并区分归属。
3. WHEN 玩家点击我方地块 THEN 系统 SHALL 进入该地块二级详情界面。
4. WHEN 玩家点击非我方地块 THEN 系统 SHALL 进入只读界面并提供外交入口。
5. IF 地块 `passable = false` THEN 系统 SHALL 默认禁止建造，除非建筑有 `allowedTerrain` 豁免。
6. WHEN 地块归属翻转 THEN 系统 SHALL 把建筑、人口、阶层财富一并转移。

### 需求 2：地形加成

**用户故事：** 作为玩家，我希望每块地有独特产出偏好，以便规划差异化的地块用途。

#### 验收标准
1. WHEN 建筑在地块生产资源 THEN 系统 SHALL 按 `基础 × 全局 × 本地 resourceModifiers` 计算。
2. WHEN 地形加成为 0 THEN 系统 SHALL 彻底禁止该资源在该地块产出。
3. WHEN 玩家尝试建造 THEN 系统 SHALL 校验 `allowedTerrain`、`owner`、`capacity`。
4. WHEN 玩家查看"可建造"列表 THEN 系统 SHALL 标注每建筑可建状态与禁建原因。

### 需求 3：全国市场 × 本地生产

**用户故事：** 作为老玩家，我希望价格、贸易、税收保持前作手感。

#### 验收标准
1. WHEN 各地块产出 THEN 系统 SHALL 汇入全国资源池。
2. WHEN 市场计算价格 THEN 系统 SHALL 延用前作 `prices.js / trading.js / taxes.js` 核心逻辑。
3. WHEN 阶层财富累积 THEN 系统 SHALL 按地块独立记账。
4. IF 未来扩展地区叛乱 THEN 系统 SHALL 能直接使用按地块存储的阶层数据。

### 需求 4：本地人口与就业

**用户故事：** 作为玩家，我希望人口只在本地就业，让空间决策真正有意义。

#### 验收标准
1. WHEN 就业匹配 THEN 系统 SHALL 对每玩家地块独立执行匹配。
2. WHEN 本地岗位 > 本地人口 THEN 系统 SHALL 标记"本地缺工"并按填充率降低产出。
3. WHEN 本地人口 > 本地岗位 THEN 系统 SHALL 标记"本地失业"。
4. WHEN 人口增长 THEN 系统 SHALL 仅在本地有住房建筑提供 maxPop 时增长。
5. 本期 SHALL NOT 做地块间自动迁移。

### 需求 5：阶层系统延续

**用户故事：** 作为玩家，我希望所有阶层规则保持前作一致。

#### 验收标准
1. 系统 SHALL 保留 17+ 阶层及其分组/分类。
2. 系统 SHALL 延用"基础需求 + 动态奢侈需求"模型。
3. WHEN 阶层财富达阈值 THEN 系统 SHALL 解锁下一档奢侈需求。
4. 阶层财富 SHALL 按地块存储。

### 需求 6：满意度 × 生活水平 × 稳定度

**用户故事：** 作为玩家，我希望"发展经济→生活水平→稳定"回路保持顺畅。

#### 验收标准
1. 系统 SHALL 保留 6 档生活水平与对应好感度上限。
2. WHEN 阶层长期低于温饱 THEN 系统 SHALL 按 streak 惩罚好感度。
3. WHEN 计算稳定度 THEN 系统 SHALL 按阶层好感度 × 影响力份额加权。
4. 稳定度 SHALL 采用惯性公式避免突变。

### 需求 7：军事 - 军团 + 将领 + 前线

**用户故事：** 作为玩家，我希望组建军团、任命将领并在前线作战，战胜获得看得见的地皮。

#### 验收标准
1. 系统 SHALL 保留军团系统（最多 8 个、将领可指派、前线分配）。
2. 系统 SHALL 保留将领机制（level/experience/traits、无将领 -15%）。
3. 系统 SHALL 保留兵种时代限制。
4. WHEN 战斗触发 THEN 系统 SHALL 按 engagement type 结算。
5. WHEN 战争胜利 THEN 系统 SHALL 允许选择相邻战败方地块割让（排除首都）。
6. 系统 SHALL 保留掠夺机制。

### 需求 8：政府 - 政体 + 立场 + 官员

**用户故事：** 作为玩家，我希望政体由执政联盟自动浮现。

#### 验收标准
1. 系统 SHALL 保留执政联盟机制（1–N 阶层）。
2. WHEN 执政联盟变更 THEN 系统 SHALL 自动浮现政体并应用效果。
3. 系统 SHALL 保留 30+ 政体名称与差异化效果。
4. 系统 SHALL 保留政治立场按时代解锁与条件激活/惩罚。
5. 系统 SHALL 保留官员/内阁系统（派系、忠诚、影响力、协同）。

### 需求 9：理念

**用户故事：** 作为玩家，我希望通过玩法行为涌现理念，塑造意识形态。

#### 验收标准
1. 系统 SHALL 保留理念卡槽（基础 3，时代推进至最多 10）。
2. 系统 SHALL 保留三选一涌现机制（阈值 `35 + owned×20`）。
3. 系统 SHALL 保留 common/uncommon/rare/legendary 加权。
4. 系统 SHALL 保留 Synergy / Anti-Synergy。
5. 系统 SHALL 保留 trigger effects 全家桶。
6. 每理念 SHALL 有 3 级阶段解锁效果。

### 需求 10：科技与时代

**用户故事：** 作为玩家，我希望通过科研/人口/文化推进时代，解锁新内容。

#### 验收标准
1. 系统 SHALL 保留 10 时代及其 req/cost/bonuses。
2. 系统 SHALL 保留科技树与前置关系。
3. WHEN 时代升级 THEN 系统 SHALL 应用 bonuses。
4. 资源 SHALL 有 unlockEpoch / unlockTech。

### 需求 11：外交

**用户故事：** 作为玩家，我希望与外国做多维度外交博弈。

#### 验收标准
1. 系统 SHALL 保留 AI 国家系统与人格。
2. 系统 SHALL 保留 10 种条约及其效果。
3. 系统 SHALL 保留 3 类国际组织。
4. 系统 SHALL 保留 AI 供需撮合的国际贸易。
5. 系统 SHALL 保留海外投资与利润汇回机制。
6. 系统 SHALL 保留附庸/独立运动。
7. WHEN 外交割地 THEN 系统 SHALL 具体指定翻转地块。

### 需求 12：UI 结构变化

**用户故事：** 作为玩家，我希望"建造"行为必须通过地图完成，建立空间心智。

#### 验收标准
1. 系统 SHALL 将 BottomNav "建筑"替换为"地图"。
2. 原 BuildTab 的卡片/筛选/收藏/搜索 SHALL 复用到二级地块界面。
3. 本期 SHALL NOT 保留全国直接建造的捷径。
4. 其他 tab SHALL 保持原入口层级。

### 需求 13：老存档兼容

**用户故事：** 作为老玩家，我希望老存档能自动迁移。

#### 验收标准
1. WHEN 导入前作存档 THEN 系统 SHALL 生成单 plains 首都，承载 6，迁移所有数据。
2. WHEN 迁移完成 THEN 游戏手感 SHALL 与前作接近一致。
3. 系统 SHALL 写单元测试验证迁移完整性（建筑/人口/资源数）。

---
