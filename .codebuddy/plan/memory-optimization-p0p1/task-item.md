# 实施计划：游戏内存优化（P0 + P1）

- [ ] 1. 扩展 `stripPayloadForTransfer` 剥离更多非必要字段
   - 在 `simulation.worker.js` 的 `stripPayloadForTransfer` 函数中，非 full tick 时额外剥离：`officials`、`activeFronts`、`activeBattles`、`foreignInvestmentStats`、`tradeOpportunities`
   - 非 full tick 时 `market` 对象仅保留 `prices`、`wages`，剥离 `demand`、`supply`、`needsShortages`（当前保留了这三个字段但它们仅 UI 用）
   - 非 full tick 时 `modifiers` 仅保留 `ideologyRuleMods` 和 `officialEffects`（simulation 必需子集），剥离其余字段
   - 同步更新 `useSimulationWorker.js` 中的 `stripMainThreadResult`，使主线程回退模式行为一致
   - 给 stripped 对象添加 `_isFullTick` 标志（当前已有，确认保留）
   - _需求：1.2.1、1.2.3、1.2.4_

- [ ] 2. 在 `useGameLoop` 中建立 full tick UI 数据缓存机制
   - 在 `useGameLoop.js` 中新增 `fullTickCacheRef = useRef({})`，缓存字段包括：`buildingFinancialData`、`classFinancialData`、`approvalBreakdown`、`officials`、`activeFronts`、`activeBattles`、`foreignInvestmentStats`、`tradeOpportunities`
   - 当收到 `_isFullTick === true` 的结果时，将上述字段写入缓存
   - 当收到非 full tick 结果（上述字段为 null）时，从缓存中读取并填充，跳过对应的 setState 调用
   - 确保 `market` 的 `demand`、`supply`、`needsShortages` 也走缓存逻辑
   - _需求：1.2.2、3.2.1、3.2.2_

- [ ] 3. 实现主线程→Worker 方向的静态配置缓存（`SYNC_CONFIG` 消息）
   - 在 `simulation.worker.js` 中新增 `_configCache` 模块变量，存储 `equippedIdeologies` 解析结果、`ideologySynergies`、`antiSynergies` 等静态配置
   - 新增 `SYNC_CONFIG` 消息类型处理：收到时更新 `_configCache`
   - 修改 `SIMULATE` 消息处理：从 `_configCache` 注入静态配置到 `enrichedPayload`（与现有 `_historyCache` 注入模式一致）
   - 在 `useSimulationWorker.js` 中新增 `syncConfig` 方法，暴露给 `useGameLoop` 调用
   - 在 `useGameLoop.js` 中检测 `equippedIdeologies` 变化时调用 `syncConfig`，并从 `simulationParams` 中移除这些静态字段
   - _需求：1.3.1、1.3.2、1.3.3_

- [ ] 4. 实现 Worker→主线程的增量传输（Delta Encoding）
   - 在 `simulation.worker.js` 中新增 `_lastResult` 模块变量，存储上一次传输的完整结果
   - 在 `stripPayloadForTransfer` 之后新增 `computeDelta(current, lastResult)` 函数：对顶层字段进行浅比较（`===`），相同则省略；对 `nations` 数组、`market` 对象等复杂字段进行键级比较
   - 第一个 tick（`_lastResult` 为 null）传输完整结果
   - delta payload 添加 `_isDelta: true` 标志
   - 在 `useSimulationWorker.js` 的 `onmessage RESULT` 处理中新增 `applyDelta(delta, lastFullResult)` 函数：将 delta 合并到上一次完整结果上
   - 新增 `_lastFullResultRef` 在 `useSimulationWorker` 中存储上一次完整结果
   - 如果 delta 大小 >= 原始大小的 80%，回退传输完整结果（设 `_isDelta: false`）
   - _需求：1.1.1、1.1.2、1.1.3、1.1.4、1.1.5_

- [ ] 5. 向 `simulateTick` 传入 `_isFullTick` 标志，按需跳过 `buildingFinancialData` 计算
   - 在 `simulation.worker.js` 中计算 `isFullTick` 后，将其作为 `enrichedPayload._isFullTick` 传入 `simulateTick`
   - 在 `simulation.js` 的 `simulateTick` 函数开头读取 `_isFullTick` 参数
   - 当 `_isFullTick === false` 且 `_simDebugEnabled === false` 时，跳过建筑循环中 `buildingFinancialData` 的详细子对象创建（`wagesByRole`、`paidWagePerWorkerByRole`、`filledByRole` 等），仅保留 simulation 必需的汇总数据（总工资支出、总利润等）
   - 返回值中 `buildingFinancialData` 设为 `null`，主线程使用任务2中建立的缓存
   - 同理，`classFinancialData` 和 `approvalBreakdown` 在非 full tick 时也跳过详细计算
   - `modifiers.sources` 仅在 full tick 或 `_simDebugEnabled` 时构建
   - _需求：2.2.1、2.2.2、2.2.3、2.2.4、2.3.2_

- [ ] 6. 建筑循环中的对象池化（`effectiveOps`、`ownerLevelGroups`）
   - 在 `simulation.js` 模块顶层新增可复用对象池：`_reusableEffectiveOps = { inputs: {}, outputs: {}, jobs: {} }`、`_reusableOwnerLevelGroups = {}`
   - 在建筑循环（L2322 `BUILDINGS.forEach`）开始处理每栋建筑时，清空池化对象（`for...in delete` 或重置为空对象）而非创建新对象
   - 确保循环内部使用池化对象的引用，循环结束后如需保留数据则创建浅拷贝
   - 参照已有的 `_reusableSilverMap` 模式实现
   - _需求：2.1.1、2.1.2、2.1.3_

- [ ] 7. 扩展模块级可复用对象模式到高频临时变量
   - 在 `simulation.js` 模块顶层新增以下可复用对象（参照 `_reusableSilverMap`）：
     - `_reusableSupplyBreakdown = {}`
     - `_reusableResourceLossBreakdown = {}`
     - `_reusableRoleLaborIncome = {}`、`_reusableRoleExpense = {}`、`_reusableRoleHeadTaxPaid = {}`、`_reusableRoleBusinessTaxPaid = {}`
   - 在 `simulateTick` 开头清空这些对象的所有键值
   - 在 `simulateTick` 返回前，对需要传输到主线程的复用对象创建浅拷贝（`{ ...obj }`）
   - _需求：2.4.1、2.4.2、2.4.3_

- [ ] 8. 优化 `simulateTick` 返回对象中的展开运算符和链式调用
   - 在 `simulation.js` 的 return 语句（L8930-9112）中，将 `{ ...existingObj, newField }` 模式改为直接赋值到已有对象上（`existingObj.newField = value`），减少临时对象创建
   - 将 `modifiers` 中 `resourceDemand` 和 `stratumDemand` 的 `Object.fromEntries(Object.entries(...).map(...))` 链式调用改为简单的 `for...in` 循环就地合并
   - _需求：2.3.1、2.3.3_

- [ ] 9. 优化 `useGameLoop` 中的 setState 调用
   - 在 `unstable_batchedUpdates` 回调中，当非 full tick 结果的字段为 `null` 时，跳过对应的 setState 调用（而非设置 null）
   - 当 `_shouldUpdateUI === false`（高速模式降频）时，确保完全跳过所有 setState 调用（包括 `setClassApproval`、`setActiveBuffs` 等当前仍在执行的调用），仅更新 `stateRef.current`
   - 评估将 `setClassWealth` + `setClassWealthDelta` + `setClassIncome` + `setClassExpense` 等相关调用合并为单个 `setClassEconomics` 的可行性，如可行则实施
   - _需求：3.1.1、3.1.2、3.1.3_

- [ ] 10. 实现内存监控与自动保护机制
   - 在 `src/hooks/` 下新增 `useMemoryMonitor.js` hook：
     - 每 30 秒通过 `performance.memory.usedJSHeapSize` 检测内存使用（不可用时基于 tick 执行时间趋势估算）
     - 定义两个阈值：70% 为"警告"、85% 为"危险"
   - 警告级别响应：自动将 `BASE_UI_INTERVAL` 翻倍（通过新增 `SET_UI_INTERVAL` Worker 消息类型动态调整）
   - 危险级别响应：自动暂停游戏并显示提示（复用现有暂停机制 + toast/modal 提示保存）
   - 连续 3 次危险：强制降速至 1x 并禁用 Worker（设置 `window.__SIM_DISABLE_WORKER = true`）
   - 恢复正常时还原所有参数
   - _需求：4.1.1、4.1.2、4.1.3、4.1.4、4.2.1、4.2.2、4.2.3、4.2.4_
