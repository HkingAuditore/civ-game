# 需求文档：修复阶层人均收支显示全为 0 的 Bug

## 引言

在 Worker 模式下，阶层详情面板（StratumDetailSheet）的"每日人均收支"（收入、支出、净收入）始终显示为 `+0.00 / -0.00 / +0.00`，同时人头税实际税额也显示为 `0.000`。

### 根因分析

`simulation.worker.js` 中存在 `_tickCounter` 递增时序错误，导致 `stripPayloadForTransfer` 函数的 full tick 判断与 simulation 的 full tick 判断永远错开一个 tick：

1. **第 237 行**：`isFullTickForSim = (_tickCounter % uiInterval) === 0` — 用当前 `_tickCounter`（如 0）判断为 full tick
2. **第 258 行**：simulation 以 `_isFullTick = true` 执行，正确计算了 `classFinancialData`
3. **第 259 行**：`_tickCounter++` — 计数器递增为 1
4. **第 262 行**：`stripPayloadForTransfer(result)` — 内部重新计算 `isFullTick = (1 % 10) === 0 = false`，将 `classFinancialData` 设为 null

**结果**：simulation 在 full tick 时正确计算了 `classFinancialData`，但 strip 函数因 `_tickCounter` 已递增，判断为非 full tick，将数据全部剥离。`classFinancialData` 永远无法传回主线程。

### 影响范围

同样受影响的降频字段包括：
- `classFinancialData`（阶层财务明细）→ 影响人均收支、人头税实际税额显示
- `buildingFinancialData`（建筑财务明细）→ 影响建筑详情面板的财务数据
- `approvalBreakdown`（支持度分解）→ 影响支持度详情显示
- `officials`（官吏数据）
- `activeFronts`、`activeBattles`（军事数据）
- `foreignInvestmentStats`、`tradeOpportunities`（外交/贸易数据）
- `market` 子字段（demand/supply/needsShortages 等）

## 需求

### 需求 1：修复 _tickCounter 递增时序

**用户故事：** 作为一名玩家，我希望阶层详情面板中的每日人均收支能正确显示实际数值，以便我能了解各阶层的经济状况并做出决策。

#### 验收标准

1. WHEN simulation worker 执行 full tick 计算 THEN `stripPayloadForTransfer` SHALL 正确识别该 tick 为 full tick，保留 `classFinancialData` 等降频字段
2. WHEN simulation worker 执行非 full tick 计算 THEN `stripPayloadForTransfer` SHALL 正确识别该 tick 为非 full tick，剥离降频字段以节省传输开销
3. WHEN 修复应用后 THEN 阶层详情面板的"每日人均收支"SHALL 显示非零的实际收入/支出/净收入值（当阶层有经济活动时）
4. WHEN 修复应用后 THEN 人头税实际税额 SHALL 显示正确的非零值（当税率 > 0 且阶层有收入时）
5. WHEN 修复应用后 THEN 所有降频字段（buildingFinancialData、approvalBreakdown、officials、activeFronts、activeBattles、foreignInvestmentStats、tradeOpportunities、market 子字段）SHALL 在 full tick 时正确传回主线程

### 需求 2：确保主线程模式不受影响

**用户故事：** 作为一名开发者，我希望修复不会影响主线程（非 Worker）模式的正常运行，以便两种模式都能正确工作。

#### 验收标准

1. WHEN 游戏在主线程模式运行时 THEN `useSimulationWorker.js` 中的降频逻辑 SHALL 继续正常工作，不受本次修复影响
2. IF 主线程模式使用独立的 `_tickCounter` 和 `shouldUpdatePanelData` 判断 THEN 该逻辑 SHALL 保持不变

### 需求 3：修复方案的简洁性

**用户故事：** 作为一名开发者，我希望修复方案尽可能简洁，只调整 `_tickCounter++` 的位置，以便最小化变更风险。

#### 验收标准

1. WHEN 实施修复时 THEN 修改范围 SHALL 仅限于 `simulation.worker.js` 中 `_tickCounter++` 的位置调整
2. WHEN 实施修复时 THEN 不 SHALL 改变 `stripPayloadForTransfer` 函数的签名或内部逻辑
3. WHEN 实施修复时 THEN 不 SHALL 改变 simulation 函数接收 `_isFullTick` 的方式
