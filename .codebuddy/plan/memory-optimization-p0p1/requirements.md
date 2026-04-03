# 需求文档：游戏内存优化（P0 + P1）

## 引言

游戏在运行约10分钟后出现闪退（OOM崩溃），大量建造建筑会加速闪退。经过代码审查，根本原因是：

1. **P0 — Worker↔主线程 `postMessage` 结构化克隆导致内存峰值过高**：每 tick 通过 `postMessage` 传输完整游戏状态（`simulationParams` 约60+字段）和完整模拟结果（`simulateTick` 返回约80+字段），structured clone 在发送端和接收端各创建一份深拷贝，导致每 tick 产生大量内存分配。
2. **P1 — `simulateTick` 每 tick 创建大量临时对象**：9112行的 `simulation.js` 在每次 tick 中创建数十个临时对象（`effectiveOps`、`ownerLevelGroups`、`wagePlans`、`buildingFinancialData` 等），建筑越多创建越多，GC 压力巨大。

### 现有优化机制（已实施）

当前代码已有以下优化，新需求需在此基础上扩展而非重复：

- `stripPayloadForTransfer()`（simulation.worker.js）：Worker→主线程方向，已实现调试字段剥离 + 降频传输（`BASE_UI_INTERVAL=10 × gameSpeed`）
- `_reusableSilverMap`（simulation.js L486）：模块级可复用 Map，避免每 tick 分配新 Map
- `gameSpeed >= 3` 时自动切换主线程模式（useGameLoop.js L1469）：跳过 postMessage 序列化
- `_historyCache`（simulation.worker.js）：Worker 内部缓存 history 数据，避免每 tick 传输
- `unstable_batchedUpdates`（useGameLoop.js L3056）：将 50+ 次 setState 合并为 1 次渲染
- `_shouldUpdateUI` 高速降频（useGameLoop.js L1535）：高速模式下跳过纯展示 setState
- `simulationParams.nations` 裁剪（useGameLoop.js L1293）：发送前裁剪已击败国家和 AI 国家的历史字段

### 影响域

- `workers`：simulation.worker.js（传输层优化）
- `hooks`：useSimulationWorker.js（通信协议）、useGameLoop.js（状态应用层）
- `logic`：simulation.js（对象创建优化）
- `config`：可能需要新增性能相关常量

### 关键约束

- 所有优化不得改变游戏逻辑的正确性（模拟结果必须完全一致）
- 优化必须在现有架构内扩展，不引入新的并行系统
- 必须保持 Worker 模式和主线程回退模式的行为一致性
- 不得破坏存档兼容性

---

## 需求

### 需求 1：进一步减少 Worker→主线程 postMessage 传输量（P0）

**用户故事：** 作为一名移动端玩家，我希望游戏在长时间运行时不会因内存不足而闪退，以便我能持续游玩超过10分钟。

#### 1.1 增量传输（Delta Encoding）

**验收标准：**

1. WHEN Worker 完成一次 tick 计算 THEN Worker SHALL 对比当前结果与上一次结果，仅传输发生变化的字段（delta）
2. WHEN 主线程收到 delta 结果 THEN 主线程 SHALL 将 delta 合并到上一次的完整结果上，还原出完整状态
3. IF 某个字段的值与上一 tick 完全相同（引用相等或深度相等） THEN Worker SHALL 在传输 payload 中省略该字段（设为 undefined 或不包含）
4. WHEN 第一个 tick 执行时（无上一次结果可对比） THEN Worker SHALL 传输完整结果（与当前行为一致）
5. IF delta 编码后的 payload 大小未显著减少（<20%） THEN 系统 SHALL 回退到传输完整结果，避免 delta 计算的额外开销

#### 1.2 进一步剥离非必要字段

**验收标准：**

1. WHEN `stripPayloadForTransfer` 处理非 full tick 的结果时 THEN 系统 SHALL 额外剥离以下仅 UI 用的字段：`officials`（官员详情）、`activeFronts`（战线详情）、`activeBattles`（战斗详情）、`foreignInvestmentStats`、`tradeOpportunities`
2. IF 被剥离的字段在主线程侧有缓存（上一次 full tick 的值） THEN 主线程 SHALL 使用缓存值填充，确保 UI 不出现空白
3. WHEN `modifiers` 对象被传输时 THEN 系统 SHALL 仅在 full tick 时传输完整的 `modifiers` 对象，非 full tick 时仅传输 `ideologyRuleMods` 和 `officialEffects`（simulation 必需的子集）
4. WHEN `market` 对象在非 full tick 被传输时 THEN 系统 SHALL 仅保留 `prices`、`wages`（simulation 下一 tick 必需），剥离 `demand`、`supply`、`needsShortages`（仅 UI 用）

#### 1.3 减少主线程→Worker 方向的传输量

**验收标准：**

1. WHEN 构建 `simulationParams` 时 THEN 系统 SHALL 将不会在 tick 间变化的静态配置（如 `equippedIdeologies` 解析结果、`ideologySynergies`、`antiSynergies`）缓存在 Worker 内部，仅在变化时同步
2. WHEN `equippedIdeologies` 或理念配置发生变化（用户装备/卸载理念） THEN 主线程 SHALL 通过专用的 `SYNC_CONFIG` 消息类型同步到 Worker
3. IF `simulationParams` 中的某个字段与上一 tick 发送的值引用相同 THEN 系统 SHALL 在 payload 中省略该字段，Worker 使用缓存值

---

### 需求 2：减少 `simulateTick` 中的临时对象创建（P1）

**用户故事：** 作为一名喜欢大量建造建筑的玩家，我希望建筑数量增多时游戏不会明显卡顿或闪退，以便我能自由发展经济。

#### 2.1 建筑循环中的对象池化

**验收标准：**

1. WHEN `simulateTick` 的生产循环（L2322 `BUILDINGS.forEach`）遍历每栋建筑时 THEN 系统 SHALL 复用模块级预分配的对象，而非每次创建新的 `effectiveOps`、`ownerLevelGroups`
2. WHEN 建筑循环开始处理一栋新建筑时 THEN 系统 SHALL 清空（clear）可复用对象的内容，而非分配新对象
3. IF 建筑的 `effectiveOps`（input/output/jobs）需要在循环外被引用 THEN 系统 SHALL 在循环结束时将必要数据拷贝到最终结果中，而非保留对池化对象的引用

#### 2.2 `buildingFinancialData` 按需生成

**验收标准：**

1. WHEN `stripPayloadForTransfer` 判定当前为非 full tick 时 THEN `simulateTick` SHALL 跳过 `buildingFinancialData` 的详细计算（`wagesByRole`、`paidWagePerWorkerByRole`、`filledByRole` 等子对象的创建）
2. IF 当前为 full tick 或调试模式开启 THEN `simulateTick` SHALL 正常计算完整的 `buildingFinancialData`
3. WHEN 跳过 `buildingFinancialData` 计算时 THEN 系统 SHALL 通过传入 `_isFullTick` 标志到 `simulateTick` 参数中来控制，而非在计算完成后丢弃
4. WHEN `buildingFinancialData` 被跳过时 THEN `simulateTick` 返回的 `buildingFinancialData` SHALL 为 `null`，主线程使用上一次 full tick 的缓存值

#### 2.3 减少 `return` 对象中的临时对象创建

**验收标准：**

1. WHEN `simulateTick` 构建最终返回对象（L8930-9112）时 THEN 系统 SHALL 避免在 return 语句中使用展开运算符（`...`）创建新对象，改为直接引用已有变量
2. WHEN `modifiers.sources` 被构建时 THEN 系统 SHALL 仅在 `_simDebugEnabled` 或 full tick 时构建完整的 `sources` 子对象，其余时候设为 `null`
3. WHEN `modifiers` 对象中的 `resourceDemand` 和 `stratumDemand` 使用 `Object.fromEntries` + `Object.entries` + `map` 链式调用合并事件修饰符时 THEN 系统 SHALL 改用简单的 for 循环就地合并，避免创建中间数组

#### 2.4 扩展模块级可复用对象模式

**验收标准：**

1. WHEN `simulateTick` 初始化每 tick 的临时变量时 THEN 系统 SHALL 对以下高频创建的对象采用模块级复用（参照已有的 `_reusableSilverMap` 模式）：
   - `supplyBreakdown`（资源供给分解）
   - `resourceLossBreakdown`（资源损失分解）
   - `roleLaborIncome` / `roleExpense` / `roleHeadTaxPaid` / `roleBusinessTaxPaid`（阶层财务追踪）
2. WHEN 复用对象在 tick 开始时 THEN 系统 SHALL 清空所有键值（使用 `for...in delete` 或重新赋值为 `{}`），确保不残留上一 tick 的数据
3. IF 复用对象需要在 `simulateTick` 返回后被主线程读取 THEN 系统 SHALL 在返回前创建浅拷贝（`{ ...obj }`），确保 Worker 下一 tick 清空时不影响主线程已接收的数据

---

### 需求 3：优化 `useGameLoop` 中的状态应用层（P0 辅助）

**用户故事：** 作为一名玩家，我希望游戏在所有速度下都能流畅运行，不会因为状态更新过多而导致卡顿。

#### 3.1 合并冗余的 setState 调用

**验收标准：**

1. WHEN `unstable_batchedUpdates` 回调中处理 simulation 结果时 THEN 系统 SHALL 将多个相关的 setState 调用合并为更少的调用（例如将 `setClassWealth` + `setClassWealthDelta` + `setClassIncome` + `setClassExpense` 合并为一个 `setClassEconomics` 或使用 useReducer）
2. WHEN 非 full tick 的结果中某些字段为 `null`（被 `stripPayloadForTransfer` 剥离） THEN 主线程 SHALL 跳过对应的 setState 调用，而非设置 null 值
3. WHEN `_shouldUpdateUI` 为 false（高速模式降频） THEN 系统 SHALL 确保仅更新 `stateRef.current`（供下一 tick 使用），完全跳过所有 `setState` 调用（包括当前仍在执行的 `setClassApproval`、`setActiveBuffs` 等）

#### 3.2 缓存上一次 full tick 的 UI 数据

**验收标准：**

1. WHEN 主线程收到 full tick 的结果时 THEN 系统 SHALL 将 UI-only 字段（`buildingFinancialData`、`classFinancialData`、`approvalBreakdown`、`officials`、`activeFronts`、`activeBattles`）缓存到 ref 中
2. WHEN 主线程收到非 full tick 的结果（上述字段为 null） THEN 系统 SHALL 使用 ref 中缓存的上一次 full tick 数据，不触发 setState
3. IF 用户打开了需要这些数据的面板 THEN 面板 SHALL 从缓存 ref 中读取数据，而非依赖 React state

---

### 需求 4：内存监控与保护机制（P0 辅助）

**用户故事：** 作为一名移动端玩家，我希望游戏能在内存不足时自动采取保护措施，而非直接闪退。

#### 4.1 内存使用监控

**验收标准：**

1. WHEN 游戏运行时 THEN 系统 SHALL 每 30 秒检测一次内存使用情况（使用 `performance.memory.usedJSHeapSize`，仅 Chrome/WebView 可用）
2. IF `performance.memory` 不可用 THEN 系统 SHALL 使用启发式方法估算内存压力（基于 tick 执行时间的增长趋势）
3. WHEN 内存使用超过可用堆的 70% THEN 系统 SHALL 触发"内存压力"警告级别
4. WHEN 内存使用超过可用堆的 85% THEN 系统 SHALL 触发"内存危险"级别

#### 4.2 内存压力自动响应

**验收标准：**

1. WHEN 内存压力达到"警告"级别 THEN 系统 SHALL 自动将 `BASE_UI_INTERVAL` 翻倍（从 10 增加到 20），减少 full tick 传输频率
2. WHEN 内存压力达到"危险"级别 THEN 系统 SHALL 自动暂停游戏并显示提示，建议玩家保存游戏
3. WHEN 内存压力从"警告"恢复到正常 THEN 系统 SHALL 恢复原始的 `BASE_UI_INTERVAL` 值
4. IF 连续 3 次检测到"危险"级别 THEN 系统 SHALL 强制将游戏速度降至 1x 并禁用 Worker（切换到主线程模式以避免双份内存）
