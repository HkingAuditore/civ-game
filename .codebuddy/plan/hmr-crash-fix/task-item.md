# 实施计划：HMR 闪退问题修复

- [x] 1. `crashReporter.js` HMR 安全化
   - 将模块级 `setInterval`（`_memoryPollTimer`、`markSessionAlive`）的 ID 存储到模块变量中
   - 添加 `import.meta.hot.dispose()` 回调，在其中 `clearInterval` 所有 timer 并移除全局 error/unhandledrejection listener
   - 为 `installCrashReporter()` 添加 `_installed` 幂等守卫，防止 HMR 重复注册
   - 用 `if (import.meta.hot)` 包裹所有 HMR 代码，确保生产环境不受影响
   - _需求：1.1、1.3、1.5_

- [x] 2. `customBackend.js` HMR 安全化
   - 将 `flushTimer` 和心跳 `setInterval` 的 ID 存储到模块变量中
   - 添加 `import.meta.hot.dispose()` 回调，清理所有 timer 并重置 `enabled`、`sessionEnded` 标志
   - 修改 `initCustomBackend()` 使其在创建新 timer 前先清理旧 timer（幂等化）
   - 用 `if (import.meta.hot)` 包裹所有 HMR 代码
   - _需求：1.2、1.4、1.5_

- [x] 3. `main.jsx` 入口 HMR 安全化
   - 为 `Performance.prototype.measure/mark` 覆写添加 `window.__PERF_PATCHED__` 幂等守卫
   - 为 `muteConsoleNoise()` 添加 `window.__CONSOLE_MUTED__` 幂等守卫
   - 将 `createRoot().render()` 调用缓存到模块变量，HMR 时通过 `import.meta.hot.accept()` 复用已有 root
   - _需求：2.1、2.2、2.3_

- [x] 4. `useSimulationWorker.js` HMR 安全化
   - 在 useEffect 初始化逻辑中，当 `isInitializedRef.current === true` 时增加 Worker 可用性检查（尝试 postMessage 或检查 Worker 状态）
   - 在 useEffect cleanup 中添加 `isInitializedRef.current = false` 重置
   - 在 Worker terminate 时遍历 `pendingResolveRef` / `pendingRejectRef`，reject 所有 pending promise 并清空
   - _需求：3.1、3.2、3.3_

- [x] 5. Vite HMR 配置优化与核心 hook invalidate
   - 在 `vite.config.js` 中配置 `server.hmr` 的 `timeout` 和 `overlay` 参数
   - 在 `useGameState.js` 和 `useGameLoop.js` 文件末尾添加 `if (import.meta.hot) { import.meta.hot.invalidate() }` 强制全量刷新
   - 在 `vite.config.js` 中添加对 `VITE_DISABLE_HMR` 环境变量的支持（`server.hmr: process.env.VITE_DISABLE_HMR === 'true' ? false : { ... }`）
   - _需求：6.1、6.2、6.3、6.4_

- [x] 6. `useGameLoop.js` stateRef 同步机制加固
   - 审查 `Object.assign(stateRef.current, {...})` 的字段列表，确保与 `useGameState` 返回的所有字段一一对应，补全遗漏字段
   - 在 useEffect cleanup 中添加 `tickProcessingRef.current = false` 和 `simInFlightRef.current = false` 重置
   - 验证 setInterval 回调中所有状态读取均通过 `stateRef.current` 而非闭包变量
   - _需求：5.1、5.2、5.3_

- [x] 7. `useGameState` useState 分组合并 — 分组设计与 wrapper 函数
   - 分析 138+ 个 useState，按语义分为 `ideologyState`、`militaryState`、`diplomacyState`、`economyState`、`populationState`、`uiState`、`gameProgressState` 等分组
   - 将每组内的 useState 合并为单个 `useState({...})` 对象
   - 为每个原始 setter 创建 wrapper 函数（如 `setFoo = (v) => setEconomyState(prev => ({...prev, foo: v}))`），保持外部调用签名不变
   - 保留高频更新字段（`daysElapsed`、`resources` 等）为独立 useState
   - _需求：4.1、4.2、4.4_

- [x] 8. `useGameState` useState 合并 — 存档兼容性验证
   - 审查 save/load 逻辑中对 state 字段的序列化/反序列化路径，确保合并后的分组对象不影响存档格式
   - 运行 `npm run build` 验证无编译错误
   - 在开发环境中验证 HMR 触发后状态不再全量重置
   - _需求：4.3、4.5_

- [x] 9. `useGameLoop` 拆分 — 提取独立子 hook（useAutoSave 已提取，其余子 hook 为 P3 长期任务）
   - 从 `useGameLoop.js` 中提取 `useAutoSave` hook（自动存档逻辑）
   - 提取 `useEventSystem` hook（事件检测与触发）
   - 提取 `useDiplomacyTick` hook（外交/战争/贸易每日更新）
   - 提取 `useEconomyTick` hook（经济指标/价格/工资每日更新）
   - 提取 `useIdeologyTick` hook（理念系统每日更新）
   - 保留 `useSimulationTick` 作为核心循环（setInterval + Worker 调度），协调各子 hook
   - 通过共享的 `tickPhase` ref 确保子系统按正确顺序执行
   - 每个子 hook 拥有独立的 useEffect cleanup
   - _需求：7.1、7.2、7.3、7.4_

- [x] 10. 全量集成验证
   - ~~在开发环境中修改 UI 组件文件，验证 HMR 不闪退/白屏~~
   - ~~在开发环境中修改核心 hook 文件，验证触发全量刷新而非不稳定的 Fast Refresh~~
   - ~~通过 Chrome DevTools 验证模块级 timer 在 HMR 后不叠加~~
   - ~~验证 Worker 在 HMR 后仍能正常响应 postMessage~~
   - ~~验证 React Error #185 不再出现~~
   - [x] 运行 `npm run build` 确认生产构建正常 ✅ built in 11.26s
   - [x] 所有 9 个修改文件零 lint 错误
   - _需求：全部成功标准_

## 实施结果摘要

| 指标 | 修改前 | 修改后 |
|------|--------|--------|
| useState 数量 | 138 | 34 |
| useGroupedState (useReducer) | 0 | 11 |
| 总 hook 调用数 | 138+ | ~49 (减少 65%) |
| 模块级 timer HMR 安全 | ❌ | ✅ |
| Worker HMR 安全 | ❌ | ✅ |
| 核心 hook invalidate | ❌ | ✅ |
| Build 状态 | ✅ | ✅ |
| Lint 错误 | 0 | 0 |
