# 需求文档：AI之间战线模拟系统

## 引言

当前 AI-AI 战争使用纯数值衰减模型（`processAIAIWarProgression`），无战线位置、建筑破坏、兵力分摊等机制。这导致：
1. 附庸宣战无法分散敌方兵力（AI多线作战不影响对玩家战线的表现）
2. 战争分数只有每10天±5的随机值，缺乏战线推进驱动
3. AI国家没有建筑数据，无法计算建筑破坏
4. 玩家在外交面板看到AI之间的战争列表，但无法点击查看战线详情

**核心目标**：在 `processAIAIWarProgression` 中引入轻量"抽象战线位置"模型，并为AI国家生成"虚拟建筑画像"，使AI-AI战争具备与玩家战线语义一致的推进、建筑破坏、兵力分摊机制，同时保持高性能（不创建完整的 front 对象）。此外，在外交面板的"当前战争"列表中支持点击查看AI-AI战争的战线详情。

## 现有机制摘要

### AI-AI 战争（`aiWar.js` → `processAIAIWarProgression`）
- 数据结构：`nation.foreignWars[enemyId] = { isAtWar, warStartDay, warScore, endScoreThreshold }`
- 每tick：双方 `wealth × 0.997` 衰减 + `population × 0.998` 衰减
- 每10天：根据 `milStrength × pop × (1+aggression)` 的胜率掷骰，warScore ±5
- 战争结束：`|warScore| >= endScoreThreshold(25~80)` 或随机结束
- 结算：根据 victoryTier 转移 population/wealth

### 玩家战线（`frontSystem.js`）
- 数据结构：完整 `front` 对象（zones, resourceNodes, infrastructure, assignedCorps, sideState...）
- 每tick：`processFrontAdvance()` 计算 linePosition 推进，基于双方兵力、姿态、补给比等
- checkpoint crossing：触发 `calculateWarBuildingDamage()`、`calculateWarPopulationLoss()`
- 战争经济：`getFrontlineEconomicModifiers()` 计算 productionPenalty/taxEfficiencyPenalty

### AI国家数据
- 宏观数值：`wealth, population, militaryStrength, aggression`
- 军事系统：`military.forcePool.targetCorps`, `military.stockpile`, 实际军团列表
- 无建筑：没有 `buildings: { buildingId: count }` 数据

### 兵力调度（`aiWar.js` → `allocateAICorpsToFronts`）
- 已存在多战线军团分配器：根据战线优先级分配有限军团
- 已存在 `syncAINationMilitary`：每tick更新AI军事状态和军团

### 外交面板UI（`NationDetailView.jsx` → `ActiveWars` 组件）
- "当前战争"列表位于 `NationDetailView` 的国家概览区域底部
- 每行显示：VS 敌国名称、warScore、持续天数
- 当前为纯展示，不可点击，无交互行为
- 主视角为当前选中的AI国家（`nation` prop）

## 需求

### 需求 1：AI-AI 抽象战线位置

**用户故事：** 作为一名玩家，我希望AI之间的战争有战线推进机制，以便附庸宣战能通过分散敌方兵力真实减轻我方战线压力。

#### 验收标准

1. WHEN AI-AI战争开始 THEN 系统 SHALL 在 `war` 对象上初始化 `linePosition: 50`（50=均势起点）和 `lastCheckpointDay: warStartDay`。

2. WHEN `processAIAIWarProgression` 每tick执行 THEN 系统 SHALL 根据双方"有效军事力量"计算 `linePosition` 推进delta：
   - 有效军事力量 = `militaryStrength × population × (1 + aggression)`
   - delta = `(nationStrength - enemyStrength) / (nationStrength + enemyStrength) × advanceRate`
   - `advanceRate` 基础值 0.3~0.6/tick，受多线战争折减影响
   - linePosition 范围 [5, 95]

3. WHEN AI国家同时参与多场战争 THEN 系统 SHALL 计算"有效军事力量"时按 `1/sqrt(activeWarCount)` 折减该国家的 `militaryStrength`。
   - 此折减同时影响该国家在玩家战线上的表现（通过影响 `militaryStrength` 基础值）
   - 折减在 `processAIAIWarProgression` 开始时计算，在战争循环结束后恢复原值

4. WHEN `linePosition` 跨越检查点（15, 35, 50, 65, 85）THEN 系统 SHALL：
   - 生成 warScore 增量（与玩家战线语义一致：跨越核心区±15, 经济区±10, 边境±5）
   - 触发建筑破坏（需求3）和人口流失（复用 `calculateWarPopulationLoss` 比率）
   - 触发经济损伤（被侵入方 wealth × 损伤率）

5. WHEN AI-AI抽象战线的 `linePosition` 达到极端值（<=8 或 >=92）THEN 系统 SHALL 大幅增加被压制方的经济衰减速率（wealth衰减率翻倍），模拟腹地沦陷。

6. WHEN AI-AI战争结束结算 THEN 系统 SHALL 根据 `linePosition` 的终止位置调整胜负等级（linePosition >=80 → 至少 minor 胜利，>=90 → major），而非仅依赖 warScore。

7. WHEN `processAIAIWarProgression` 执行完毕 THEN 系统 SHALL 在日志中记录战线位置变化事件（仅在跨越checkpoint时生成日志，避免日志过多）。

### 需求 2：多线战争兵力分摊对玩家战线的影响

**用户故事：** 作为一名玩家，我希望让附庸对敌国宣战后，敌国在我方战线上的兵力会减少，以便体现多线作战的劣势。

#### 验收标准

1. WHEN AI国家同时与玩家和其他AI交战 THEN 系统 SHALL 在 `syncAINationMilitary` 或 `generateEnemyCorpsForFront` 中，使该AI在玩家战线上的军团总兵力按多线折减系数降低。

2. WHEN 折减生效时 THEN 系统 SHALL 使用以下计算：
   - `effectiveStrengthRatio = 1 / sqrt(totalActiveWarCount)`（含对玩家的战争）
   - 例如：2场战争→0.707，3场→0.577，4场→0.5
   - 折减作用于军团生成时的 `deploymentRatio` 参数

3. WHEN AI国家的某个AI-AI战线 linePosition 到达极端值（<=15 或 >=85）THEN 系统 SHALL 进一步降低该AI在玩家战线上的兵力（核心区压力下军团被抽调），额外折减 20%。

4. IF AI国家只有1场战争（仅与玩家交战）THEN 系统 SHALL 不做任何折减（`effectiveStrengthRatio = 1.0`）。

### 需求 3：AI国家虚拟建筑画像

**用户故事：** 作为一名玩家，我希望AI国家也有（模拟的）建筑数据，以便战争中的建筑破坏机制可以统一计算，且我可以看到摧毁了敌方哪些建筑。

#### 验收标准

1. WHEN AI-AI战争开始（或AI与玩家的战争开始）且目标AI国家没有 `virtualBuildings` 数据 THEN 系统 SHALL 调用 `generateAIBuildingProfile(nation, epoch)` 生成虚拟建筑画像并存储在 `nation.virtualBuildings`。

2. WHEN `generateAIBuildingProfile` 被调用 THEN 系统 SHALL：
   - 根据 `population` 估算建筑总量：`Math.max(5, Math.floor(population / 8))`
   - 根据 `epoch` 过滤可用建筑（`building.epoch <= epoch`）
   - 按类别分配比例：gather 40%, industry 30%, civic 20%, military 10%
   - 返回 `{ buildingId: count }` 格式，与玩家 `buildings` 完全兼容

3. WHEN AI-AI 抽象战线触发 checkpoint crossing 建筑破坏 THEN 系统 SHALL 将 `nation.virtualBuildings` 作为 `buildings` 参数传入 `calculateWarBuildingDamage()`，实现统一的建筑破坏逻辑。

4. WHEN AI虚拟建筑被破坏 THEN 系统 SHALL 直接从 `nation.virtualBuildings` 中扣减对应数量，并按被破坏建筑的产出价值折算 wealth 损失（`wealthLoss += buildingOutputValue × 50`）。

5. WHEN 战争结束 THEN 系统 SHALL 保留 `nation.virtualBuildings`（不清除），使其在下一次战争中反映战争累积损伤。下一次战争开始时，如果 `virtualBuildings` 已存在且建筑总量 >= `population / 12`，则不重新生成。

6. WHEN AI国家在和平时期 THEN 系统 SHALL 不主动更新 `virtualBuildings`（避免性能开销），仅在开战时按需生成。

7. WHEN `calculateWarBuildingDamage` 对AI国家执行时 THEN 系统 SHALL 在AI侧也生成 `destroyedBuildings` 统计数据（与玩家侧一致），使 UI 可以显示"摧毁了敌方XX建筑"。

### 需求 4：性能约束

**用户故事：** 作为一名玩家，我希望AI之间的战线模拟不会导致游戏卡顿，以便游戏体验流畅。

#### 验收标准

1. `processAIAIWarProgression` 增加的每tick计算开销 SHALL 不超过现有开销的2倍（主要是 linePosition delta 计算 + 偶发 checkpoint 事件）。

2. 系统 SHALL 不为AI-AI战争创建完整的 `front` 对象（不创建 zones, resourceNodes, infrastructure, assignedCorps 等重量级数据结构）。

3. `generateAIBuildingProfile` SHALL 仅在战争开始时调用一次（O(B)，B=可用建筑种类数≈20~40），不在每tick中调用。

4. 抽象战线的 checkpoint 事件 SHALL 仅在 `linePosition` 实际跨越阈值时触发（不是每tick检查所有战线的所有checkpoint）。

5. 多线折减系数 SHALL 通过简单数学计算（`1/sqrt(n)`）实现，不涉及遍历其他战线。

### 需求 5：外交面板AI战争战线详情查看

**用户故事：** 作为一名玩家，我希望在外交面板查看某个AI国家的"当前战争"列表时，可以点击某场战争查看战线详情，以便了解AI之间的战线态势和经济损伤。

#### 验收标准

1. WHEN 玩家在外交面板的 `NationDetailView` 中查看某AI国家的"当前战争"列表 THEN 系统 SHALL 使每行战争条目可点击（添加 `cursor-pointer` 和 hover 交互效果）。

2. WHEN 玩家点击某场AI-AI战争条目（非玩家参与的战争）THEN 系统 SHALL 在当前面板下方展开（或以内联折叠方式展示）一个轻量战线详情视图，主视角为当前选中的AI国家。

3. WHEN AI战线详情视图展开 THEN 系统 SHALL 显示以下信息：
   - **战线位置条**：复用 `FrontViewPanel` 中战线位置条的视觉样式，显示 `war.linePosition`（0~100），左侧=当前选中国家领土、右侧=敌方领土
   - **区域标注**：在位置条上标注核心区（0~15 / 85~100）、经济区（15~35 / 65~85）、边境区（35~65），与玩家战线语义一致
   - **战争分数**：显示 `war.warScore`，正值=当前国家优势、负值=敌方优势
   - **持续天数**：当前日 - `war.warStartDay`

4. WHEN AI战线详情视图展开 THEN 系统 SHALL 显示双方战力概览：
   - **当前国家侧**：军事力量（`militaryStrength`）、人口、财富、多线折减系数（如有）
   - **敌方侧**：军事力量、人口、财富、多线折减系数（如有）
   - 如果某方同时参与多场战争，标注"多线作战 ×N"和折减比例

5. WHEN AI战线详情视图展开且双方有 `virtualBuildings` 数据 THEN 系统 SHALL 显示建筑破坏统计：
   - 当前国家侧：累计被摧毁建筑数（从 `war.destroyedBuildings[nationId]` 读取）
   - 敌方侧：累计被摧毁建筑数（从 `war.destroyedBuildings[enemyId]` 读取）
   - 如果有具体建筑类型数据，以"建筑名 ×N"的列表形式展示

6. WHEN 玩家点击"VS 玩家"的战争条目（即与玩家自身的战争）THEN 系统 SHALL 不展开AI战线详情，而是提示"在军事面板中查看此战线"或跳转到军事面板（因为玩家战线使用完整的 `front` 对象，有更丰富的 `FrontViewPanel`）。

7. WHEN 战线详情已展开时再次点击同一条目 THEN 系统 SHALL 收起（折叠）该详情视图。

8. WHEN 同一时间点击另一场战争条目 THEN 系统 SHALL 收起当前展开的详情，展开新点击的详情（同时只展开一个）。

## 技术约束与复用策略

### 必须复用的现有系统
- `calculateWarBuildingDamage()` — 直接传入 `nation.virtualBuildings` 即可
- `calculateWarPopulationLoss()` — 已是纯函数，直接复用比率
- `calculateWarPlunder()` — 战时财富掠夺逻辑
- `WAR_ECONOMY` 常量 — 所有数值参数
- `allocateAICorpsToFronts()` — 已有的多战线军团分配器
- `BUILDINGS` 配置 — 建筑定义数据
- `getCheckpointsCrossed()` — 检查点跨越检测
- `FrontViewPanel` 中战线位置条的视觉样式 — AI战线详情视图中复用

### 扩展点
- `processAIAIWarProgression()` — 主要修改点，增加 linePosition 逻辑
- `war` 对象 — 扩展 `linePosition`, `lastCheckpointDay`, `destroyedBuildings` 字段
- `nation` 对象 — 扩展 `virtualBuildings` 字段
- `syncAINationMilitary()` 或 `generateEnemyCorpsForFront()` — 多线折减
- `NationDetailView.jsx` → `ActiveWars` 组件 — 增加点击交互和展开式详情

### 新建的组件（最小化）
- `AIWarFrontDetail`：内联折叠式AI战线详情组件，放在 `NationDetailView.jsx` 内部或 `src/components/diplomacy/` 目录下
  - 不需要新文件：如果代码量<100行，可作为 `ActiveWars` 的子组件直接内联
  - 如果代码量较大，抽取为 `src/components/diplomacy/AIWarFrontDetail.jsx`

### 不需要新建的模块
- 不需要新建逻辑文件：所有逻辑在现有 `aiWar.js` 和 `warEconomy.js` 中扩展
- 不需要新的数据模型：`virtualBuildings` 与玩家 `buildings` 格式完全一致

## 边界情况

1. **AI-AI战争中一方被吞并**：linePosition 到达极端值 + 人口/财富极低时触发吞并，需确保 virtualBuildings 一起清理
2. **附庸跟随宗主参战**：附庸对某国宣战时，该国的多线折减应立即生效
3. **和平条约期间**：linePosition 冻结，不再推进
4. **AI国家 population 极低**：virtualBuildings 数量也极少（5座保底），避免除零
5. **同一AI同时与3+个国家交战**：折减因子 1/sqrt(3) ≈ 0.577，不会导致兵力归零
6. **玩家参与的战争条目**：点击"VS 你"的条目不展开AI详情，引导到军事面板
7. **war 对象尚无 linePosition**：旧存档的 `foreignWars` 中没有 `linePosition` 字段，详情视图需容错处理（显示"战线数据不可用"或使用 50 默认值）
8. **AI国家无 virtualBuildings**：和平时期从未开战的国家没有此数据，详情中建筑破坏区域显示为空或"无数据"
