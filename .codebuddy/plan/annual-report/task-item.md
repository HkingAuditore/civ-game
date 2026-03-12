# 实施计划：年度庆典 → 年度政府工作报告

- [ ] 1. 移除旧庆典 buff 系统的核心逻辑和配置
  - 删除 `src/config/festivalEffects.js` 文件（80 个 buff 效果配置）
  - 移除 `src/config/index.js` L125 的 `export { FESTIVAL_EFFECTS } from './festivalEffects.js'`
  - 移除 `src/logic/buildings/effects.js` 中的 `applyFestivalEffects` 函数（约 7 行）
  - 移除 `src/logic/simulation.js` L291 的 `applyFestivalEffects` import 和 L1259 的调用
  - 移除 `src/hooks/useGameLoop.js` L20 的 `import { getRandomFestivalEffects }` 导入
  - 移除 `src/hooks/useGameLoop.js` L1048-1060 中调用 `getRandomFestivalEffects` + `setFestivalModal` 的旧庆典触发代码（保留年份变化检测框架）
  - 移除 `src/hooks/useGameLoop.js` L1066-1087 中 `activeFestivalEffects` 过期清理逻辑块
  - _需求：1.1、1.2、1.3、1.4、1.6_

- [ ] 2. 清理旧庆典系统的状态管理和 UI 引用
  - 修改 `src/stores/useEconomyStore.js`：移除 `activeFestivalEffects` / `setActiveFestivalEffects` 状态定义（L42-43）；新增 `annualReportBaseline: null` / `setAnnualReportBaseline` 状态（用于存储年初基准快照）；保留 `festivalModal` / `setFestivalModal`（改为存储年度报告数据）和 `lastFestivalYear` / `setLastFestivalYear`（继续用于防重复触发）；在 `resetEconomy` 中移除 `activeFestivalEffects: []`、新增 `annualReportBaseline: null`
  - 修改 `src/stores/storeUtils.js`：L111 移除 `activeFestivalEffects` 快照字段，新增 `annualReportBaseline` 快照字段；L248 将恢复逻辑中的 `activeFestivalEffects` 替换为 `annualReportBaseline`
  - 修改 `src/stores/useStoreSync.js`：L147 移除 `activeFestivalEffects` 同步字段，新增 `annualReportBaseline` 同步；L288 将同步列表中的 `activeFestivalEffects` 替换为 `annualReportBaseline`
  - 修改 `src/hooks/useGameLoop.js`：从 `gameState` 解构中移除 `activeFestivalEffects` / `setActiveFestivalEffects`；从 `stateRef.current` 中移除 `activeFestivalEffects` 字段
  - 修改 `src/App.jsx`：移除 L44 的 `AnnualFestivalModal` import；移除 L196-234 的 `formatFestivalEffects` 函数；移除 L254 的 `expandedFestival` state；移除 L458-480 的 `handleFestivalSelect` 函数；移除 L1931-2015 的庆典历史列表渲染块；移除 L2116-2126 的 `AnnualFestivalModal` 渲染
  - 删除 `src/components/modals/AnnualFestivalModal.jsx` 文件
  - 移除 `src/components/index.js` L84 的 `AnnualFestivalModal` 导出
  - _需求：1.2、1.5、1.7、1.8、6.1、6.4、7.4_

- [ ] 3. 创建年度报告核心工具模块 `src/utils/annualReport.js`
  - 实现 `collectAnnualSnapshot(gameState)` 函数：从 gameState 采集经济（resources.silver, economicIndicators.GDP, economicIndicators.CPI, economicIndicators.PPI, fiscalActual）、人口（population, popStructure）、社会（classApproval, stability）、产业（buildings, buildingUpgrades, 按 BUILDINGS config 分类汇总）、军事（army 含散兵+军团、militaryCorps）、资源（resources 全量）、科技（techsUnlocked.length, epoch）数据，返回扁平化快照对象
  - 实现 `computeYoYChanges(currentSnapshot, baselineSnapshot)` 函数：计算两个快照之间各指标的绝对值变化和百分比变化；对 baselineSnapshot 为 null 的情况返回 `{ isFirstYear: true }`
  - 实现 `rateMetric(metricKey, changePercent)` 函数：基于指标类型和变化幅度返回 S/A/B/C/D/F 评级
  - 实现 `computeOverallScore(changes)` 函数：加权汇总各项指标评级，返回综合评分（0-100）和总评语字符串（如"繁荣盛世"、"稳步发展"、"艰难时期"等）
  - 实现 `generateSectionCommentary(sectionKey, sectionData, changes)` 函数：为 7 个板块各生成一句自然语言评语
  - 实现 `generateExportText(reportData, empireName, year, epochName)` 函数：生成纯文本版年度报告，含 Emoji 格式化、各板块关键数据、评级和评语
  - 处理边界：数据为 null/undefined/0 时返回 "暂无数据"、避免 NaN/Infinity
  - _需求：2.1、2.3、3.1、3.2、3.3、3.4、3.5、5.3_

- [ ] 4. 在 `useGameLoop.js` 中集成年度快照采集和报告触发
  - 在保留的年份变化检测位置（原 L1048 处），调用 `collectAnnualSnapshot(current)` 采集年末快照
  - 从 `stateRef.current` 中获取 `annualReportBaseline`（年初基准），调用 `computeYoYChanges` 计算变化
  - 调用 `computeOverallScore` + `generateSectionCommentary` 生成报告数据
  - 将完整报告数据传入 `setFestivalModal({ reportData, year: currentCalendar.year })`，并 `setIsPaused(true)`
  - 更新 `setLastFestivalYear(currentCalendar.year)` 防止重复触发
  - 新增 `annualReportBaseline` 到 `gameState` 解构和 `stateRef.current` 中
  - import `collectAnnualSnapshot, computeYoYChanges, computeOverallScore, generateSectionCommentary` from `../utils/annualReport`
  - _需求：2.1、2.2、2.4、2.5、7.2、7.3_

- [ ] 5. 创建年度报告 UI 组件 `src/components/modals/AnnualReportModal.jsx`
  - 使用 `createPortal` + `framer-motion`（AnimatePresence / motion.div）实现全屏覆盖入场动效（参考旧 AnnualFestivalModal 的动画模式）
  - **头部区域**：年份标题（"第 N 年 · 年度政府工作报告"）、时代名称、帝国名称、综合评分徽章（S~F 等级 + 数值分数 + 总评语）
  - **分项报告板块**（以卡片形式垂直排列，每个板块含标题图标 + 评语 + 数据项）：
    - 📊 经济概况：国库余额、GDP、CPI、PPI、年度税收，每项显示当前值 + YoY 变化（绿色▲/红色▼/灰色-）
    - 👥 人口与民生：总人口、各阶层人口分布（CSS 横向条形图）、平均满意度
    - 🏗️ 产业发展：建筑总数、按类别（采集/工业/民政/军事）数量分布
    - ⚔️ 军事力量：总兵力、军团数、军事容量
    - 📦 资源储备：高亮增减最大的 Top3 资源，其余折叠
    - 🔬 科技文化：已解锁科技数量、当前时代
    - ⚖️ 社会稳定：稳定度、各阶层满意度变化
  - 首年报告：各变化量显示 "首年" 标签，不显示增长箭头
  - **底部**："导出报告" 按钮 + "继续" 按钮
  - 支持垂直滚动、响应式布局（移动端单列）
  - 在 `src/components/index.js` 中添加新组件导出
  - _需求：4.1、4.2、4.3、4.4、4.5、4.6、4.7_

- [ ] 6. 在 `App.jsx` 中集成年度报告模态框和导出功能
  - 新增 `AnnualReportModal` 的 import（替代旧的 `AnnualFestivalModal`）
  - 新增 `handleReportClose` 回调：关闭模态框 `setFestivalModal(null)`；恢复暂停状态 `setIsPaused(pausedBeforeEvent)`；调用 `collectAnnualSnapshot(gameState)` 保存为新的 `annualReportBaseline`（年初基准）；添加日志 `"📋 第 N 年年度报告已阅。"`
  - 新增 `handleReportExport` 回调：调用 `generateExportText` 生成纯文本；使用 `navigator.clipboard.writeText` 复制到剪贴板；成功时添加日志提示 `"📋 年度报告已复制到剪贴板"`；若剪贴板 API 不可用，回退到 `window.prompt` 供手动复制
  - 在原 `AnnualFestivalModal` 渲染位置替换为 `AnnualReportModal`，传入 `reportData={gameState.festivalModal?.reportData}`、`year`、`epoch`、`empireName`、`onClose={handleReportClose}`、`onExport={handleReportExport}`
  - 移除庆典历史列表 BottomSheet 所在的整个区块（已在任务 2 处理），该位置保持空白或移除对应 BottomSheet trigger
  - _需求：5.1、5.2、5.4、5.5、6.5、7.1_

- [ ] 7. 保存暂停状态 + 存档兼容性处理
  - 修改 `useGameLoop.js` 中年报触发代码：在调用 `setIsPaused(true)` 之前，先保存 `setPausedBeforeEvent(current.isPaused)` 到状态中（修复原庆典系统的暂停状态恢复 bug）
  - 修改 `src/stores/storeUtils.js` 的 `restoreFromSnapshot` 函数：对旧存档中的 `activeFestivalEffects` 字段不做恢复（移除相关恢复行后自然实现向后兼容，旧字段会被忽略）
  - 确认 `annualReportBaseline` 已在 `getSnapshot` / `restoreFromSnapshot` / `useStoreSync` 中正确纳入
  - _需求：6.1、6.2、6.3、6.5、7.4_

- [ ] 8. 构建验证与回归测试
  - 运行 `npm run build` 确认无编译错误（旧引用全部清除、新模块导入正确）
  - 运行 `npm run lint` 确认无 lint 错误
  - 手动验证：新游戏第一年结束时弹出报告（首年模式）、第二年及以后有 YoY 对比、导出按钮工作、关闭后暂停状态恢复正确、旧存档加载无报错
  - _需求：全部_
