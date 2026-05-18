# 实施计划

## 修复阶层人均收支显示全为 0 的 Bug（_tickCounter 递增时序竞态）

- [x] 1. 在 `src/workers/simulation.worker.js` 中将 `_tickCounter++` 移到 `stripPayloadForTransfer()` 之后
   - 当前代码（第 259-262 行）执行顺序为：`simulateTick()` → `_tickCounter++` → `stripPayloadForTransfer()`
   - 修改为：`simulateTick()` → `stripPayloadForTransfer()` → `_tickCounter++`
   - 具体操作：将第 259 行的 `_tickCounter++;` 移到第 262 行 `const stripped = stripPayloadForTransfer(result);` 之后
   - 这样 `stripPayloadForTransfer` 内部重新计算 `isFullTick` 时使用的 `_tickCounter` 值与 simulation 判断时一致
   - **[已完成]** Worker 端已在之前修复（strip 在 `_tickCounter++` 之前执行）
   - **[新增修复]** 主线程模式（`useSimulationWorker.js`）的 `stripMainThreadResult` 重构为 `runMainThreadSimulation`，在调用 `simulateTick` 前注入 `_isFullTick`，确保 simulation 在 full tick 时返回 `classFinancialData`
   - _需求：1.1、1.2、1.5、3.1、3.2、3.3_

- [x] 2. 验证修复后的执行时序正确性
   - 确认修改后的代码流程：`isFullTickForSim = (_tickCounter % uiInterval) === 0` → `simulateTick(enrichedPayload)` → `stripPayloadForTransfer(result)`（此时 `_tickCounter` 未变，strip 内部 `isFullTick` 判断与 sim 一致）→ `_tickCounter++`
   - 确认 `computeDelta` 和后续 `postMessage` 逻辑不依赖 `_tickCounter` 的值，移动不会产生副作用
   - **[已验证]** 主线程模式：`isFullTick` 计算 → `simulateTick(enrichedState)` → `mainThreadTickCounterRef.current++` → strip 结果
   - _需求：1.1、1.2、2.1_

- [x] 3. 确认主线程模式（`useSimulationWorker.js`）不受影响
   - 检查 `useSimulationWorker.js` 中的降频逻辑是否使用独立的 tick 计数器和 `shouldUpdatePanelData` 判断
   - 确认本次修改仅涉及 worker 文件，主线程模式的代码路径完全独立
   - **[已修复]** 主线程模式是本次修复的重点：之前 `simulateTick` 未传入 `_isFullTick`，导致 simulation 始终返回 `classFinancialData: null`
   - _需求：2.1、2.2_
