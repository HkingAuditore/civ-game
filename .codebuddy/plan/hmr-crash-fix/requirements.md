# 需求文档：HMR 闪退问题修复

## 引言

自从项目引入 Vite 开发环境的 HMR（Hot Module Replacement）/ React Fast Refresh 以来，开发过程中频繁出现闪退/白屏问题。经过对代码的全面分析，闪退的根因涉及以下几个层面：

1. **`useGameState` 拥有 138+ 个 `useState` 调用**：React Fast Refresh 在 hook 数量/顺序变化时无法正确保留状态，导致全部状态重置并触发渲染风暴
2. **`useGameLoop` 是一个 8914 行的巨型 useEffect**：包含 `setInterval` 驱动的主循环，HMR 时 cleanup/重建过程中 `stateRef` 与 React state 可能不同步
3. **模块级副作用（timer）无法被 HMR 清理**：`crashReporter.js` 和 `customBackend.js` 在模块作用域创建 `setInterval`，HMR 重新加载模块时旧 timer 不会被清理，导致 timer 叠加
4. **Worker 生命周期在 HMR 时不一致**：`useSimulationWorker` 的 `isInitializedRef` 在 Fast Refresh 保留 ref 时阻止新 Worker 创建，但旧 Worker 可能已被 terminate
5. **`main.jsx` 中的 `Performance.prototype` 覆写在 HMR 时重复执行**
6. **React Error #185（Maximum update depth exceeded）**：多个 useEffect 的依赖在 HMR 后被重置，形成 setState 无限循环

本方案分为**短期止血**、**中期架构改善**、**长期重构**三个阶段，优先解决开发体验问题，同时为后续架构优化铺路。

## 需求

### 需求 1：短期止血 — 模块级副作用 HMR 安全化

**用户故事：** 作为一名开发者，我希望在 HMR 触发时模块级 timer 不会叠加累积，以便开发过程中不会因为 timer 泄漏导致内存增长和闪退。

#### 验收标准

1. WHEN Vite HMR 重新加载 `crashReporter.js` 模块 THEN 系统 SHALL 在 `import.meta.hot.dispose()` 回调中清理旧的 `_memoryPollTimer` 和 `markSessionAlive` 的 `setInterval`，确保不会产生重复 timer
2. WHEN Vite HMR 重新加载 `customBackend.js` 模块 THEN 系统 SHALL 在 `import.meta.hot.dispose()` 回调中清理旧的 `flushTimer` 和心跳 `setInterval`，并重置 `enabled` 和 `sessionEnded` 标志
3. WHEN `installCrashReporter()` 被多次调用（HMR 导致） THEN 系统 SHALL 使用幂等守卫（如 `_installed` 标志），确保全局 error listener 和 timer 只注册一次
4. WHEN `initCustomBackend()` 被多次调用（HMR 导致） THEN 系统 SHALL 先清理旧的 timer 再创建新的，避免叠加
5. IF `import.meta.hot` 不可用（生产环境） THEN 系统 SHALL 跳过所有 HMR 相关的 dispose 注册，不影响生产行为

### 需求 2：短期止血 — main.jsx 入口 HMR 安全化

**用户故事：** 作为一名开发者，我希望 `main.jsx` 中的全局副作用（Performance.prototype 覆写、console 静默）在 HMR 时不会重复执行，以便开发环境行为稳定。

#### 验收标准

1. WHEN Vite HMR 重新加载 `main.jsx` THEN 系统 SHALL 使用幂等守卫确保 `Performance.prototype.measure/mark` 覆写只执行一次
2. WHEN Vite HMR 重新加载 `main.jsx` THEN 系统 SHALL 使用幂等守卫确保 `muteConsoleNoise()` 只执行一次
3. WHEN Vite HMR 重新加载 `main.jsx` THEN 系统 SHALL 不重复调用 `createRoot().render()`，而是通过 `import.meta.hot.accept()` 让 React Fast Refresh 处理组件更新

### 需求 3：短期止血 — useSimulationWorker HMR 安全化

**用户故事：** 作为一名开发者，我希望 Worker 在 HMR 后仍然能正常工作，以便模拟循环不会因为 Worker 状态不一致而卡死。

#### 验收标准

1. WHEN HMR 触发且 `isInitializedRef.current` 已为 `true`（Fast Refresh 保留了 ref） THEN 系统 SHALL 检查 `workerRef.current` 是否仍然可用（未被 terminate），如果不可用则重新创建 Worker
2. WHEN useEffect cleanup 执行（HMR 卸载旧组件） THEN 系统 SHALL 同时重置 `isInitializedRef.current = false`，确保下次 mount 时能正确初始化
3. WHEN Worker 被 terminate 后仍有 pending promise THEN 系统 SHALL reject 所有 pending promise 并清理 `pendingResolveRef` / `pendingRejectRef`

### 需求 4：中期改善 — useGameState 状态合并（减少 useState 数量）

**用户故事：** 作为一名开发者，我希望 `useGameState` 中的 138+ 个 `useState` 被合理分组合并，以便 React Fast Refresh 能更稳定地保留状态，减少 HMR 时的渲染风暴。

#### 验收标准

1. WHEN 重构 `useGameState` THEN 系统 SHALL 将语义相关的 useState 合并为分组对象（如 `ideologyState`、`militaryState`、`diplomacyState`、`economyState`、`uiState` 等），将 useState 调用数量从 138+ 降低到 30 个以内
2. WHEN 合并 useState 后 THEN 系统 SHALL 保持所有现有的 setter 函数签名不变（通过 wrapper 函数），确保 `useGameLoop` 和其他消费者无需修改
3. WHEN 合并 useState 后 THEN 系统 SHALL 确保存档/读档（save/load）逻辑正常工作，序列化/反序列化路径不受影响
4. IF 某些 state 字段更新频率极高（如 `daysElapsed`、`resources`） THEN 系统 SHALL 将其保留为独立的 useState，避免高频更新触发整个分组对象的重新渲染
5. WHEN 合并完成后 THEN 系统 SHALL 通过 `npm run build` 验证无编译错误，并在开发环境中验证 HMR 不再触发全量状态重置

### 需求 5：中期改善 — useGameLoop stateRef 同步机制加固

**用户故事：** 作为一名开发者，我希望 `useGameLoop` 中的 `stateRef` 在 HMR 后与 React state 保持同步，以便模拟循环不会读到过期数据。

#### 验收标准

1. WHEN HMR 触发导致 useEffect 重新执行 THEN 系统 SHALL 在 setInterval 回调的每次执行开始时从 `stateRef.current` 读取最新值，而非依赖闭包捕获的旧值
2. WHEN `Object.assign(stateRef.current, {...})` 执行时 THEN 系统 SHALL 确保所有 90+ 字段都被正确同步，不遗漏新增字段
3. WHEN useEffect 的 cleanup 函数执行（HMR 卸载） THEN 系统 SHALL 清理 `tickProcessingRef.current = false` 和 `simInFlightRef.current = false`，避免下次 mount 时被旧的 guard 阻塞

### 需求 6：中期改善 — Vite HMR 配置优化

**用户故事：** 作为一名开发者，我希望 Vite 的 HMR 配置针对本项目的特殊架构进行优化，以便减少不必要的全量刷新和状态丢失。

#### 验收标准

1. WHEN `vite.config.js` 被更新 THEN 系统 SHALL 配置 `server.hmr` 选项，设置合理的 `timeout` 和 `overlay` 参数
2. WHEN 修改 `useGameState.js` 或 `useGameLoop.js` 等核心 hook 文件时 THEN 系统 SHALL 通过在这些文件末尾添加 `if (import.meta.hot) { import.meta.hot.invalidate() }` 强制全量刷新，避免 Fast Refresh 的部分更新导致状态不一致
3. WHEN 修改非核心组件文件（如 UI 组件）时 THEN 系统 SHALL 允许 Fast Refresh 正常工作，只刷新变更的组件
4. IF 开发者希望完全禁用 HMR THEN 系统 SHALL 提供 `VITE_DISABLE_HMR=true` 环境变量选项

### 需求 7：长期重构 — useGameLoop 拆分

**用户故事：** 作为一名开发者，我希望 `useGameLoop` 的 8914 行巨型 useEffect 被拆分为多个独立的、可维护的子 hook，以便每个子系统有独立的 cleanup 逻辑，HMR 时只重建受影响的部分。

#### 验收标准

1. WHEN 拆分 `useGameLoop` THEN 系统 SHALL 将其分为以下独立 hook：
   - `useSimulationTick`：核心模拟循环（setInterval + Worker 调度）
   - `useAutoSave`：自动存档逻辑
   - `useEventSystem`：事件检测与触发
   - `useDiplomacyTick`：外交/战争/贸易每日更新
   - `useEconomyTick`：经济指标/价格/工资每日更新
   - `useIdeologyTick`：理念系统每日更新
2. WHEN 每个子 hook 的 useEffect cleanup 执行时 THEN 系统 SHALL 只清理该子系统的资源（timer、ref 等），不影响其他子系统
3. WHEN 拆分完成后 THEN 系统 SHALL 确保游戏行为与拆分前完全一致（通过对比同一存档在拆分前后的模拟结果）
4. IF 拆分导致 tick 执行顺序变化 THEN 系统 SHALL 通过共享的 `tickPhase` ref 确保子系统按正确顺序执行

## 边界情况与技术限制

### 边界情况
- **生产环境不受影响**：所有 `import.meta.hot` 相关代码在生产构建时会被 tree-shaking 移除
- **存档兼容性**：useState 合并不能改变序列化格式，需要保持向后兼容
- **Worker 降级路径**：Worker HMR 修复不能影响现有的 main-thread fallback 机制
- **多标签页场景**：timer 清理不能影响正常的多标签页使用

### 技术限制
- React Fast Refresh 对 hook 数量变化的容忍度有限，超过一定数量后会 fallback 到全量刷新
- `useGameLoop` 的 8914 行 useEffect 内部有大量闭包引用，拆分时需要仔细处理共享状态
- `stateRef` 的 `Object.assign` 模式是性能优化的结果，不能简单替换为多个独立 ref

### 成功标准
- 开发环境中修改任意 UI 组件文件后，HMR 不再导致闪退/白屏
- 开发环境中修改核心 hook 文件后，通过 `invalidate()` 触发全量刷新而非不稳定的 Fast Refresh
- 模块级 timer 在 HMR 后不再叠加（可通过 Chrome DevTools 的 timer 面板验证）
- Worker 在 HMR 后仍能正常响应 `postMessage`
- React Error #185 的出现频率降为 0

## 实施优先级

| 优先级 | 需求 | 预期工作量 | 影响范围 |
|--------|------|-----------|---------|
| P0 | 需求 1（模块级 timer HMR 安全化） | 小 | crashReporter.js, customBackend.js |
| P0 | 需求 2（main.jsx HMR 安全化） | 小 | main.jsx |
| P0 | 需求 3（Worker HMR 安全化） | 小 | useSimulationWorker.js |
| P1 | 需求 6（Vite HMR 配置优化） | 小 | vite.config.js, 核心 hook 文件 |
| P1 | 需求 5（stateRef 同步加固） | 中 | useGameLoop.js |
| P2 | 需求 4（useState 合并） | 大 | useGameState.js, 所有消费者 |
| P3 | 需求 7（useGameLoop 拆分） | 很大 | useGameLoop.js, 整体架构 |
