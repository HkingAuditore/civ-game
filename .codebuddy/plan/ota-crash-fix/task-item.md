# 实施计划：OTA 热更新闪退修复

- [ ] 1. 修复 `AndroidManifest.xml` 启用 `largeHeap`
   - 在 `android/app/src/main/AndroidManifest.xml` 的 `<application>` 标签中添加 `android:largeHeap="true"`
   - 确认 `android:hardwareAccelerated="true"` 是否已由 Capacitor 默认启用，若未启用则一并添加
   - _需求：3.1、3.2_

- [ ] 2. 修改 `capacitor.config.json` 将 `resetWhenUpdate` 设为 `true`
   - 将 `plugins.CapacitorUpdater.resetWhenUpdate` 从 `false` 改为 `true`
   - 确认 `autoDeleteBundles`、`autoDeleteFailed`、`autoDeletePrevious` 保持 `true` 不变
   - _需求：7.1、7.2_

- [ ] 3. 修改 `vite.config.js` 保留 `console.error` 和 `console.warn`
   - 将 `esbuild.drop: ['console', 'debugger']` 改为 `esbuild.drop: ['debugger']`，并添加 `esbuild.pure: ['console.log', 'console.debug', 'console.info']` 来仅移除非关键日志
   - 验证构建后 `console.error` 和 `console.warn` 调用被保留在产物中
   - _需求：5.1_

- [ ] 4. 修复 `useOtaUpdate.js` 中 `postDownloadProtected` 缺少当前 bundle ID 的 Bug
   - 在第 271-278 行的下载成功后清理逻辑中，将 `const postDownloadProtected = new Set([bundle.id])` 改为同时包含当前 bundle ID：先通过 `getCurrentBundleInfo()` 获取当前 ID，再构建 `new Set([bundle.id, ...currentProtectedIds])`
   - 在 `cleanupOldBundles` 函数中增加对 `status === 'set'` 的 bundle 的跳过逻辑（在现有 `SKIP_STATUSES` 集合中添加 `'set'`）
   - _需求：2.1、2.2_

- [ ] 5. 延迟 OTA 检查时机，避免与游戏初始化内存峰值叠加
   - 在 `useOtaUpdate.js` 的 `checkAndUpdate()` 函数开头添加延迟逻辑：在 `notifyAppReady()` 之后、拉取 `updates.json` 之前，等待 10 秒（可配置常量 `OTA_CHECK_DELAY_MS`）
   - 注意：`notifyAppReady()` 必须保持在最前面立即调用（Capgo 10 秒回滚机制），延迟仅影响后续的版本检查和下载流程
   - _需求：4.1_

- [ ] 6. 添加 OTA 下载前的内存检查保护
   - 在 `useOtaUpdate.js` 的下载新 bundle 之前（第 248 行 `CapacitorUpdater.download()` 调用前），检查 `performance.memory.usedJSHeapSize / performance.memory.jsHeapSizeLimit`
   - 若比值超过 0.6（60%），跳过本次下载，通过 `showOtaToast` 提示"内存不足，更新将在下次启动时进行"，并通过 GA 上报 `OTA_SkippedHighMemory` 事件
   - 若 `performance.memory` 不可用（非 Chromium 环境），则跳过检查正常下载
   - _需求：4.2_

- [ ] 7. 为 `useSimulationWorker.js` 添加 OTA 环境下的 Worker 路径容错
   - 在 `useEffect` 中 `new SimulationWorker()` 的 `catch` 块内，增加备用路径重试逻辑：通过 `document.baseURI` 拼接 Worker 文件名创建 `new Worker(new URL(workerFileName, document.baseURI))`
   - Worker 文件名需要在构建时确定（Vite 的 `?worker` 语法会生成带 hash 的文件名），考虑在 `vite.config.js` 中配置 `worker.rollupOptions.output.entryFileNames` 固定 Worker 文件名（如 `simulation.worker.js`），或在运行时通过 `import.meta.url` 解析
   - 若备用路径也失败，保持现有的主线程回退行为不变
   - _需求：1.1、1.2_

- [ ] 8. 添加 Worker 健康状态上报和连续失败熔断
   - 在 `useSimulationWorker.js` 中，Worker 成功收到 `READY` 消息时，向 `localStorage` 的 `civ_crash_log` 写入 Worker 启动成功事件（包含 `isOTA` 标志，通过检查 `CapacitorUpdater.current()` 判断）
   - Worker 创建失败或 `onerror` 触发时，向 `civ_crash_log` 写入失败事件（包含错误信息、`import.meta.url`、`document.baseURI`）
   - 读取 `localStorage` 中 `civ_worker_fail_count`，若连续 3 次启动 Worker 都失败，设置 `civ_worker_disabled` 标志，后续启动直接跳过 Worker 创建使用主线程模式
   - Worker 成功启动时重置 `civ_worker_fail_count` 为 0
   - _需求：1.3_

- [ ] 9. 添加 OTA 启动诊断信息记录
   - 在 `useOtaUpdate.js` 的 `checkAndUpdate()` 中 `notifyAppReady()` 成功后，向 `civ_crash_log` 写入一条启动诊断记录，包含：当前 bundle 版本/ID、`document.baseURI`、`location.href`、`performance.memory` 初始值
   - 增强现有 `civ_crash_log` 的每条记录，添加 `isOTA` 和 `bundleVersion` 字段（需要创建一个共享的 `getOtaInfo()` 工具函数供 `useSimulationWorker` 和 `useOtaUpdate` 共用）
   - _需求：5.2、5.3_

- [ ] 10. 添加 OTA 主动回滚保护机制
   - 在 `useOtaUpdate.js` 中新增启动后异常计数逻辑：注册 `window.onerror` 和 `window.onunhandledrejection` 监听器，在 APP 启动后 30 秒内计数未捕获异常
   - 若 30 秒内异常计数 >= 3，调用 `CapacitorUpdater.reset()` 回滚到 builtin bundle，通过 `showOtaToast` 提示"检测到异常，正在回滚到稳定版本"
   - 通过 `localStorage` 标志 `civ_ota_rollback_done` 防止回滚后再次触发回滚（builtin bundle 也有问题时避免无限循环）
   - 30 秒后移除监听器，不再计数
   - _需求：6.2_
