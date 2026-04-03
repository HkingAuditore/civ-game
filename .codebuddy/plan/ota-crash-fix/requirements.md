# 需求文档：OTA 热更新闪退修复方案

## 引言

### 问题描述

玩家反馈：通过 Capgo OTA 热更新的游戏 APP 会闪退，但使用 Android Studio 直接打一个新包安装则不会闪退。

### 技术背景

项目使用 **Capacitor 8** 作为 Web→Android 桥接层，**@capgo/capacitor-updater v8.45.0** 作为 OTA 热更新方案，**Vite 7** 构建 React 19 应用。游戏核心模拟运行在 **Web Worker** 中（`simulation.worker.js`，构建后 735KB），主 Bundle 为 3.47MB。

### 根因分析

经过深度代码 review，确认闪退是以下多个因素的**组合效应**：

1. **Web Worker 路径在 OTA 环境下可能断裂**：Capgo OTA 更新后，WebView 的 `serverBasePath` 被切换到内部存储的 OTA bundle 目录。Vite 构建的 Worker 使用 `new Worker(new URL("./assets/simulation.worker-xxx.js", import.meta.url))` 模式，`import.meta.url` 在 OTA 环境下可能解析到错误的 origin，导致 Worker 创建失败。Worker 失败后回退到主线程模式，内存压力翻倍。

2. **OTA 清理逻辑存在 Bug**：`useOtaUpdate.js` 第 271-278 行，下载新 bundle 后的清理逻辑中 `postDownloadProtected` 只包含新 bundle ID，**不包含当前正在运行的 bundle ID**，可能导致当前 bundle 被误删。

3. **Android 原生配置缺失**：`AndroidManifest.xml` 未启用 `android:largeHeap="true"`，对于 3.47MB 主 Bundle + 735KB Worker + 大量图片资源的重度 WebView 应用，默认堆内存（128-256MB）不足。

4. **OTA 下载与游戏运行内存叠加**：OTA 更新在游戏启动时触发（`useOtaUpdate` 在 APP 启动时执行），下载 ~29MB bundle + 解压 + 写入磁盘的过程与游戏模拟同时进行，内存叠加可能触发 OOM。

5. **Vite 生产构建 `drop: ['console']` 导致 OTA 环境下无法排查**：所有 `console.log/warn/error` 在生产包中被移除，OTA 用户的崩溃日志缺失关键信息。

### 影响域

- `src/hooks/useOtaUpdate.js`（OTA 更新逻辑）
- `src/hooks/useSimulationWorker.js`（Worker 初始化与回退）
- `android/app/src/main/AndroidManifest.xml`（Android 原生配置）
- `vite.config.js`（构建配置）
- `capacitor.config.json`（Capacitor 插件配置）
- `dist/index.html`（崩溃日志收集）

### 关键约束

- 所有修复不得改变游戏逻辑的正确性
- 修复必须在现有架构内扩展，不引入新的并行系统
- 必须保持 Worker 模式和主线程回退模式的行为一致性
- 不得破坏存档兼容性
- 修复方案需与已有的 `memory-optimization-p0p1` 计划互补，不重复

---

## 需求

### 需求 1：修复 OTA 环境下 Web Worker 路径兼容性

**用户故事：** 作为一名通过 OTA 热更新的移动端玩家，我希望游戏的 Web Worker 在 OTA 更新后仍能正常加载，以便模拟计算不会回退到主线程导致内存压力翻倍。

#### 1.1 Worker 创建增加 OTA 路径容错

**验收标准：**

1. WHEN Worker 通过 Vite 的 `?worker` 语法创建失败（`onerror` 触发） THEN 系统 SHALL 尝试使用备用路径重新创建 Worker（基于 `document.baseURI` 或 `location.href` 拼接 Worker 文件名）
2. IF 备用路径创建 Worker 也失败 THEN 系统 SHALL 回退到主线程模式（与当前行为一致），并通过 GA 上报 `WorkerOTAPathFail` 事件，包含 `import.meta.url` 和 `document.baseURI` 的值
3. WHEN Worker 在 OTA 环境下成功创建 THEN 系统 SHALL 通过 GA 上报 `WorkerOTAPathOK` 事件，用于统计 OTA 环境下 Worker 的成功率

#### 1.2 验证 Vite Worker 构建产物的路径模式

**验收标准：**

1. WHEN Vite 构建生产包时 THEN 构建产物中的 Worker 引用 SHALL 使用相对路径（与 `base: './'` 配置一致），而非绝对路径
2. IF Worker 引用使用了绝对路径（如 `/assets/simulation.worker-xxx.js`） THEN 需要在 `vite.config.js` 中配置 `worker.format` 和 `worker.rollupOptions` 确保使用相对路径
3. WHEN 验证完成后 THEN 应在 CI/CD 或手动测试中确认：OTA bundle 目录下的 Worker 文件可被 WebView 正确加载

#### 1.3 Worker 健康状态上报

**验收标准：**

1. WHEN Worker 成功初始化（收到 `READY` 消息） THEN 系统 SHALL 记录 Worker 启动成功事件到 `civ_crash_log`（localStorage），包含 `isOTA` 标志（通过 `CapacitorUpdater.current()` 判断）
2. WHEN Worker 创建失败或崩溃 THEN 系统 SHALL 记录失败事件到 `civ_crash_log`，包含错误信息、`isOTA` 标志、`import.meta.url` 值
3. IF 连续 3 次启动 Worker 都失败 THEN 系统 SHALL 在 localStorage 中设置 `civ_worker_disabled` 标志，后续启动直接使用主线程模式，避免重复失败的开销

---

### 需求 2：修复 OTA Bundle 清理逻辑 Bug

**用户故事：** 作为一名玩家，我希望 OTA 更新过程不会误删当前正在使用的 bundle，以便游戏在更新后不会因资源缺失而闪退。

#### 2.1 修复 `postDownloadProtected` 缺少当前 bundle ID

**验收标准：**

1. WHEN 新 bundle 下载成功后执行清理 THEN `postDownloadProtected` 集合 SHALL 同时包含新 bundle ID **和**当前正在运行的 bundle ID
2. WHEN `protectedIdsRef.current` 被更新时 THEN 新值 SHALL 是当前 bundle ID 和新 bundle ID 的并集，而非仅新 bundle ID
3. IF `getCurrentBundleInfo()` 返回的当前 bundle ID 为空（builtin 模式） THEN 清理逻辑 SHALL 仅保护新 bundle ID（与当前行为一致，因为 builtin 不在 bundle 列表中）

#### 2.2 增强清理安全性

**验收标准：**

1. WHEN 执行 `cleanupOldBundles` 时 THEN 系统 SHALL 在删除前检查每个待删除 bundle 的 `status` 字段，跳过 `status === 'set'`（即被 `CapacitorUpdater.set()` 标记为下次启动使用的 bundle）
2. WHEN 清理完成后 THEN 系统 SHALL 通过 GA 上报清理结果（cleaned/failed/total），用于监控清理行为
3. IF 清理过程中发生异常 THEN 系统 SHALL 不影响游戏正常运行（当前已实现，确认保留）

---

### 需求 3：优化 Android 原生配置

**用户故事：** 作为一名 Android 玩家，我希望游戏能获得足够的系统资源，以便在长时间游玩时不会因内存不足而闪退。

#### 3.1 启用 `largeHeap`

**验收标准：**

1. WHEN Android APP 启动时 THEN 系统 SHALL 请求 `android:largeHeap="true"`，使可用堆内存从默认的 128-256MB 提升到 512MB+
2. WHEN `largeHeap` 启用后 THEN `performance.memory.jsHeapSizeLimit` 的值 SHALL 显著增加（可通过 `civ_mem_log` 验证）

#### 3.2 启用硬件加速

**验收标准：**

1. WHEN Android APP 启动时 THEN `<application>` 标签 SHALL 包含 `android:hardwareAccelerated="true"`（Capacitor 默认应已启用，需确认）
2. IF 硬件加速已默认启用 THEN 无需额外修改

#### 3.3 WebView 进程隔离（可选，需评估）

**验收标准：**

1. IF Android 版本 >= 8.0 (API 26) THEN 评估是否可以为 WebView 启用独立进程（`android:process=":webview"`），使 WebView 崩溃不影响主进程
2. IF 进程隔离会导致 Capacitor 插件通信问题 THEN 放弃此方案

---

### 需求 4：防止 OTA 下载与游戏运行的内存叠加

**用户故事：** 作为一名玩家，我希望 OTA 更新不会在游戏运行时占用大量内存，以便游戏不会因更新过程而闪退。

#### 4.1 延迟 OTA 检查时机

**验收标准：**

1. WHEN APP 启动时 THEN OTA 检查 SHALL 延迟到游戏完成初始化后（loading screen 消失后）再执行，避免与初始化阶段的内存峰值叠加
2. WHEN OTA 检查开始时 THEN 系统 SHALL 等待至少 10 秒（可配置），确保游戏已稳定运行
3. IF 用户在延迟期间切换到后台 THEN OTA 检查 SHALL 在用户返回前台后重新计时

#### 4.2 OTA 下载内存保护

**验收标准：**

1. WHEN OTA 开始下载新 bundle 时 THEN 系统 SHALL 检查当前内存使用情况（通过 `performance.memory` 或已有的 `useMemoryMonitor`）
2. IF 当前内存使用超过可用堆的 60% THEN 系统 SHALL 推迟下载到下次 APP 启动，并通过 toast 提示"内存不足，更新将在下次启动时进行"
3. WHEN 下载进行中 THEN 系统 SHALL 不阻塞游戏主循环（当前已是异步，确认保留）

---

### 需求 5：增强 OTA 环境下的可观测性

**用户故事：** 作为开发者，我希望能在生产环境中收集足够的诊断信息，以便快速定位 OTA 相关的闪退问题。

#### 5.1 保留关键日志（不被 esbuild drop）

**验收标准：**

1. WHEN Vite 生产构建时 THEN `console.error` 和 `console.warn` SHALL 不被 esbuild 的 `drop` 配置移除（仅 drop `console.log` 和 `debugger`）
2. IF 修改 `drop` 配置会导致包体积显著增加 THEN 改为使用自定义的 `logError` / `logWarn` 函数替代 `console.error` / `console.warn`，这些函数不会被 drop

#### 5.2 OTA 启动诊断信息

**验收标准：**

1. WHEN APP 通过 OTA bundle 启动时 THEN 系统 SHALL 在 `civ_crash_log` 中记录一条启动诊断信息，包含：
   - 当前 bundle 版本和 ID
   - `document.baseURI` 和 `location.href`
   - `import.meta.url`（在 Worker 初始化前记录）
   - `performance.memory` 初始值
   - Worker 是否成功创建
2. WHEN APP 通过 builtin bundle 启动时（非 OTA） THEN 系统 SHALL 同样记录启动诊断信息，用于对比

#### 5.3 崩溃日志增强

**验收标准：**

1. WHEN `civ_crash_log` 记录错误时 THEN 每条记录 SHALL 额外包含 `isOTA` 字段（boolean）和 `bundleVersion` 字段
2. WHEN 用户查看崩溃日志（启动时的 confirm 弹窗） THEN 弹窗 SHALL 显示 OTA 状态信息
3. IF `civ_crash_log` 中连续 3 条以上错误都标记为 `isOTA: true` THEN 系统 SHALL 在启动时额外提示"OTA 更新可能存在问题，建议重新安装 APP"

---

### 需求 6：OTA 回滚保护机制

**用户故事：** 作为一名玩家，我希望当 OTA 更新导致游戏无法正常运行时，系统能自动回滚到上一个可用版本，以便我不会被困在一个无法使用的版本中。

#### 6.1 利用 Capgo 内置回滚机制

**验收标准：**

1. WHEN APP 启动后 THEN `CapacitorUpdater.notifyAppReady()` SHALL 在 10 秒内被调用（当前已实现，确认保留）
2. IF `notifyAppReady()` 未在 10 秒内被调用（APP 在启动过程中崩溃） THEN Capgo 插件 SHALL 自动回滚到上一个 bundle（这是 Capgo 的内置行为，确认 `capacitor.config.json` 配置正确）
3. WHEN `notifyAppReady()` 调用失败 THEN 系统 SHALL 通过 `persistCrashLog` 记录失败信息

#### 6.2 主动回滚触发

**验收标准：**

1. IF APP 启动后 30 秒内发生 3 次以上未捕获异常（通过 `window.onerror` 和 `unhandledrejection` 计数） THEN 系统 SHALL 调用 `CapacitorUpdater.reset()` 回滚到 builtin bundle，并通过 toast 提示"检测到异常，正在回滚到稳定版本"
2. WHEN 主动回滚触发时 THEN 系统 SHALL 通过 GA 上报 `OTA_AutoRollback` 事件，包含错误计数和 bundle 版本
3. IF 回滚后仍然崩溃（builtin bundle 也有问题） THEN 系统 SHALL 不再尝试回滚（避免无限循环）

---

### 需求 7：`capacitor.config.json` 配置优化

**用户故事：** 作为开发者，我希望 Capgo 插件的配置能最大程度地保障 OTA 更新的稳定性。

#### 7.1 启用 `resetWhenUpdate`

**验收标准：**

1. WHEN `capacitor.config.json` 中的 `CapacitorUpdater` 配置被更新时 THEN `resetWhenUpdate` SHALL 设置为 `true`（当前为 `false`）
2. WHEN 原生 APP 版本更新（通过应用商店安装新 APK） THEN Capgo 插件 SHALL 自动清除所有 OTA bundle，使用新 APK 内置的 builtin bundle
3. IF `resetWhenUpdate: true` 会导致用户每次原生更新后都需要重新下载 OTA bundle THEN 这是可接受的行为（原生更新频率远低于 OTA 更新）

#### 7.2 确认自动清理配置

**验收标准：**

1. WHEN `autoDeleteFailed` 为 `true` 时 THEN Capgo 插件 SHALL 自动删除下载失败或安装失败的 bundle（当前已配置，确认保留）
2. WHEN `autoDeletePrevious` 为 `true` 时 THEN Capgo 插件 SHALL 在成功切换到新 bundle 后自动删除上一个 bundle（当前已配置，确认保留）
3. IF `autoDeleteBundles` 和手动清理逻辑（`cleanupOldBundles`）同时存在 THEN 需要确认两者不会冲突（例如手动清理删除了 Capgo 正在使用的 bundle）
