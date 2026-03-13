# 产业链优化方案

> 基于审计报告的发现，按优先级排列的具体优化方案
> 原则：优先扩展现有系统，配置驱动，最小化架构变更

---

## 目录

1. [P0：修复 composites 空转问题](#p0-composites)
2. [P1：解决银币水龙头缺乏消费品中间环节](#p1-银币水龙头)
3. [P1：tools 产出过剩优化](#p1-tools)
4. [P2：machinery 单点链路扩展](#p2-machinery)
5. [P2：fertilizer_plant 效率优化](#p2-fertilizer)
6. [P2：mechanized_farm 效率修正](#p2-mechanized-farm)
7. [P3：software/electronics 消费端扩展](#p3-software)
8. [P3：数值微调汇总](#p3-数值微调)
9. [实施路线图](#实施路线图)

---

## P0：修复 composites 空转问题 {#p0-composites}

### 问题
`composites_factory`（信息时代）产出 `composites` 但无任何建筑消费或阶层需求。

### 方案 A：让 composites 进入现有建筑的输入（推荐）

在现有信息时代建筑中添加 composites 消耗：

1. **`data_center`**：添加 `composites: 0.03` 到 input（机柜轻量化外壳）
2. **`solar_power_plant`**：修改为 `input: { stone: 0.1, aluminum: 0.03, composites: 0.05 }`（光伏支架用复合材料）
3. **`semiconductor_fab`**：添加 `composites: 0.02` 到 input（无尘室面板）
4. **`research_institute`**：添加 `composites: 0.02`（实验设备外壳）

**同时**在 `strata.js` 中为以下阶层添加 composites 奢侈需求：
- **scientist** (E9)：在 wealthRatio 5.0 层级添加 `composites: 0.01`（先进材料需求）
- **engineer** (E9 解锁后)：在 wealthRatio 6.0 层级添加 `composites: 0.01`
- **capitalist** (E9)：在 wealthRatio 4.0 层级添加 `composites: 0.02`（高端消费）

**预期效果**：
- composites 总消费约 0.12/s（建筑）+ 阶层消费
- composites_factory 产出 0.25/s，需要约 2 座消费建筑匹配
- 资源不再空转

### 方案 B：添加新建筑（不推荐，违反最小化原则）

添加"航空航天工厂"消耗 composites 产出 silver+culture。但这又增加了一个银币水龙头。

**推荐方案 A**。

---

## P1：解决银币水龙头缺乏消费品中间环节 {#p1-银币水龙头}

### 问题
`automobile_factory`、`appliance_factory`、`data_center`、`internet_platform`、`financial_center` 消耗工业品直接产出银币，缺少"消费品"环节。在纪元1800中，这些产出物（汽车、家电）会被居民消费。

### 方案：在阶层奢侈需求中引入"代理消费"

不引入新资源（如"汽车"、"家电"），而是让这些建筑的**现有产出（silver）通过阶层消费间接回流**。具体做法：

1. **保持 automobile_factory 等建筑产出 silver 不变**
2. **在阶层奢侈需求中增加对这些建筑产出链上游资源的需求**

这等价于"居民通过市场购买汽车/家电"的经济效果：银币产出→阶层收入→购买更多奢侈品。

**具体调整**：

对于 E7+ 解锁的阶层奢侈需求，增加以下代理资源：

| 阶层 | 新增奢侈需求（高富裕度） | 代表含义 |
|------|--------------------------|----------|
| worker (E7+, wealthRatio 8.0+) | `rubber: 0.01`, `machinery: 0.005` | "工人买自行车/缝纫机" |
| artisan (E7+, wealthRatio 8.0+) | `rubber: 0.015`, `machinery: 0.008` | "工匠购买工具机" |
| merchant (E7+, wealthRatio 8.0+) | `machinery: 0.015` | "商人购买商用设备" |
| engineer (E7+, wealthRatio 6.0+) | `machinery: 0.02` | "工程师购买精密仪器" |
| capitalist (E7+, wealthRatio 6.0+) | `machinery: 0.03` | "资本家购买机械设备" |
| scientist (E9, wealthRatio 3.0+) | `electronics: 0.02, software: 0.03` | "科学家购买计算设备和软件" |
| technician (E8+, wealthRatio 5.0+) | `electronics: 0.015` | "技术工人需要电子设备" |

**预期效果**：
- `machinery` 不再是单点链路，获得多阶层消费
- `electronics` 和 `software` 消费端大幅扩展
- `rubber` 获得直接消费端（而非仅通过 wiring/automobile 中转）
- 间接解决了 M2 和 M7 问题

**注意**：这些需求应该使用 `potentialResources` 门控，只有当玩家解锁了相关建筑后才出现需求。当前需求系统已有此机制。

---

## P1：tools 产出过剩优化 {#p1-tools}

### 问题
`factory` 单座产出 15 tools/s，远超所有建筑维护消耗总和。

### 方案 A：调整 factory 产出结构（推荐）

将 `factory` 的产出从纯 tools 改为 tools + machinery 混合产出：

```
当前：input { steel: 2.00, coal: 2.00, science: 0.50 } → output { tools: 15.00 }
修改为：input { steel: 2.00, coal: 2.00, science: 0.50 } → output { tools: 8.00, machinery: 0.30 }
```

**理由**：
- 工厂是工业时代标志建筑，应该同时产出通用工具和机械
- tools 产出降至 8.0 仍然是其他所有 tools 建筑的数倍
- 新增 machinery(0.30) 产出使得 machinery 不再完全依赖 E7 的 machinery_plant
- factory 的升级也需要相应调整

**升级调整**：
```
factory Lv1: output { tools: 12.0, machinery: 0.45 }
factory Lv2: output { tools: 17.0, machinery: 0.65, steel: 0.1, science: 0.2 }
```

### 方案 B：增加 tools 消费端

让更多 E6+ 建筑消耗 tools：
- `rail_depot` 添加 `tools: 0.30`
- `arms_factory` 添加 `tools: 0.50`
- 各工业建筑的 tools 维护成本翻倍

**评估**：方案 B 改动面太广，且不解决根因（单一建筑产出过多）。**推荐方案 A**。

---

## P2：machinery 单点链路扩展 {#p2-machinery}

### 问题
`machinery` 只有 `automobile_factory` 一个消费建筑。

### 方案（与 P1 factory 方案联动）

如果采用 P1 方案 A（factory 产 machinery），则 machinery 供给增加。同时通过 P1 阶层消费方案增加 machinery 的消费端。

额外建议：
1. `arms_factory` input 添加 `machinery: 0.10`（现代军工需要机械）
2. `steel_works` input 添加 `machinery: 0.05`（钢铁联合体需要机械维护）

**效果**：machinery 形成完整的供给-消费网络。

---

## P2：fertilizer_plant 效率优化 {#p2-fertilizer}

### 问题
化肥厂投入 chemicals(0.3)+coal(0.2)，产出仅 food(0.8)。整条上游链（oil→chemicals→fertilizer）投入巨大但 food 产出微乎其微。

### 方案

提升 fertilizer_plant 的 food 产出并添加一个"加成"机制：

```
当前：input { chemicals: 0.3, coal: 0.2 } → output { food: 0.8 }
修改为：input { chemicals: 0.25, coal: 0.15 } → output { food: 3.0 }
```

**理由**：
- 化肥应该是农业的重大生产力提升，food 产出应显著高于现值
- 降低 input 使性价比合理
- 3.0 food/s 约等于一座未升级农田的 63% 产出，但不需要大量农民岗位（仅 4 worker + 1 engineer），体现了化工对农业的革命性提升

**升级调整**：
```
fertilizer_plant Lv1: input { chemicals: 0.325, coal: 0.195 } → output { food: 3.9 }
fertilizer_plant Lv2: input { chemicals: 0.5625, coal: 0.3375 } → output { food: 6.75 }
```

---

## P2：mechanized_farm 效率修正 {#p2-mechanized-farm}

### 问题
mechanized_farm 人均 food 产出(2.14/worker)低于 large_estate(2.67/worker)，违反"工业化提升效率"直觉。

### 方案

调整 mechanized_farm 的工人配置，减少总工人数以提升人均效率：

```
当前：jobs { peasant: 8, worker: 8, engineer: 1, capitalist: 1 } = 18人
修改为：jobs { peasant: 4, worker: 6, engineer: 1, capitalist: 1 } = 12人
```

**效果**：
- 人均产出：38.5/12 = 3.21/worker（高于庄园的 2.67）
- 总产出不变（38.5 food/s），但需要更少的人口
- 体现"机械化减少劳动力需求"的核心设计意图

**升级也需同步调整**：
- Lv1: 减少至 `{ peasant: 5, worker: 6, engineer: 1, capitalist: 1 }` = 13人
- Lv2: 减少至 `{ peasant: 5, worker: 7, engineer: 1, capitalist: 1 }` = 14人

---

## P3：software/electronics 消费端扩展 {#p3-software}

### 问题
`software` 仅被 internet_platform 和 financial_center 消费，`electronics` 阶层需求极少。

### 方案

已在 P1 阶层消费方案中覆盖。额外建议：

**在 E8+ 阶层奢侈需求中添加 `electronics` 消费**：

| 阶层 | 层级 | 新增 | 含义 |
|------|------|------|------|
| worker | 10.0 | `electronics: 0.005` | 工人购买收音机 |
| artisan | 10.0 | `electronics: 0.008` | 工匠购买电子工具 |
| merchant | 8.0 | `electronics: 0.015` | 商人需要电子通讯 |
| official | 9.0 | `electronics: 0.02` | 官员需要电子设备 |
| landowner | 9.0 | `electronics: 0.01` | 地主购买家电 |
| capitalist | 6.0 | `electronics: 0.03` | 资本家大量电子设备 |

**在 E9 阶层奢侈需求中添加 `software` 消费**：

| 阶层 | 层级 | 新增 | 含义 |
|------|------|------|------|
| merchant | 12.0 | `software: 0.02` | 商人需要商业软件 |
| official | 14.0 | `software: 0.02` | 官员需要行政软件 |
| capitalist | 10.0 | `software: 0.04` | 资本家需要企业软件 |

---

## P3：数值微调汇总 {#p3-数值微调}

### 官员消费上限确认

当前官员 `maxConsumptionMultiplier: 50` 和 `greedy: true`。

**建议**：如果这是有意的"腐败/贪婪"设计，应在代码注释中明确说明。如果不是有意设计，建议将 `maxConsumptionMultiplier` 降至 15-20，与其他上层阶层（10x）保持一定差距但不至于极端。

### papyrus 早期消费增强

在 `magistrate_office` 的 papyrus 消耗从 0.015 提升至 0.05/s。在 `library` 添加 `papyrus: 0.03` input。

### dye 青铜时代消费增强

考虑在 `amphitheater`（E1）添加 `dye: 0.02` input（舞台布景需要染料），增加 dye 早期消费。当前 amphitheater input 为 `{ fine_clothes: 0.09, brick: 0.02 }`，添加 dye 是合理的。

### stone 描述优化

在 `electronics_factory`、`aluminum_smelter`、`semiconductor_fab` 的 desc 中明确说明 stone 代表什么：
- electronics_factory: "将铜、电缆、化学品和**石英砂（硅）**加工为电子元件" ✅ 已有
- semiconductor_fab: "在无尘室中将**硅片**蚀刻为芯片" ✅ 已有
- aluminum_smelter: "**电解铝土矿（石料）**冶炼铝材" ✅ 已有

描述已经合理，无需改动。

---

## 实施路线图

### Phase 1：紧急修复（1-2 个 PR）
1. **P0 composites 消费端** → 修改 buildings.js + strata.js + gameConstants.js
2. **P2 fertilizer_plant 数值** → 修改 buildings.js + buildingUpgrades.js
3. **P2 mechanized_farm 数值** → 修改 buildings.js + buildingUpgrades.js

### Phase 2：平衡优化（2-3 个 PR）
4. **P1 factory 产出重构** → 修改 buildings.js + buildingUpgrades.js
5. **P1 阶层消费扩展** → 修改 strata.js
6. **P2 machinery 消费端** → 修改 buildings.js

### Phase 3：体验打磨（1-2 个 PR）
7. **P3 electronics/software 阶层消费** → 修改 strata.js
8. **P3 papyrus/dye 微调** → 修改 buildings.js
9. **P3 官员消费上限确认** → 可能修改 strata.js

### 改动文件汇总

| 文件 | 涉及的修改 |
|------|-----------|
| `src/config/buildings.js` | factory产出、fertilizer_plant数值、mechanized_farm工人数、composites消费端建筑、machinery消费端 |
| `src/config/buildingUpgrades.js` | factory/fertilizer_plant/mechanized_farm 升级同步调整 |
| `src/config/strata.js` | 阶层奢侈需求扩展（machinery/electronics/software/composites/rubber） |
| `src/config/industryChains.js` | 可能需要更新产业链配置以反映新的资源流向 |

### 不需要改动的文件
- `src/logic/population/needs.js` → 消费逻辑无需改变，配置驱动
- `src/logic/economy/` → 价格/工资/税收逻辑无需改变
- `src/hooks/` → 游戏循环无需改变
- `src/components/` → UI 无需改变（除非涉及产业链 UI 重构，但那是另一个任务）

---

## 附录：资源供需平衡速查表

### 工业时代(E6)典型配置下的资源平衡

假设玩家有：3 coal_mine, 2 mine, 1 factory, 1 steel_foundry, 1 steel_works, 2 mechanized_farm

| 资源 | 供给/s | 消费/s | 盈余 |
|------|--------|--------|------|
| coal | 9.0 | ~7.5 | +1.5 ✅ |
| iron | 1.8 | ~3.5 | -1.7 ⚠️ |
| steel | 1.4 | ~2.5 | -1.1 ⚠️ |
| tools | 15.96 | ~2.0 | **+13.96** 🔴 |
| food | 77.0 | ~40.0 | +37.0 ✅ |

**这验证了 tools 过剩问题的严重性。**

---

*本优化方案与审计报告配套使用。所有修改均遵循 civ-game 的"配置驱动、扩展优先"原则。*
