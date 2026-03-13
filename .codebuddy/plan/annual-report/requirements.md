# 需求文档：年度庆典 → 年度政府工作报告

## 引言

将现有的"年度庆典"（Annual Festival）系统从一个选择 buff 的机制，改造为一个**年度政府工作报告**系统。该系统在每年结束时自动触发，以精美的动效展示玩家在过去一年中的治理成果，生成一份详尽、可视化、充满代入感的《政府工作报告》。玩家可以一键导出该报告。

### 背景

- 现有理念系统（Ideology System）已取代了庆典 buff 的策略功能，庆典 buff 不再需要
- 年度庆典的触发时机（年份变化检测）和暂停游戏的行为可以复用
- 游戏中已有丰富的数据源可用于报告生成：`history`（treasury/tax/population/gdp/cpi/ppi）、`economicIndicators`、`classApproval`、`stability`、`army`、`resources`、`market`、`buildings`、`popStructure`、`classWealth/Income/Expense`、`fiscalActual` 等

### 核心设计理念

参考 P 社游戏（如 Victoria 3 的年度回顾）和真实世界的政府工作报告形式，报告应当：
1. **充满仪式感**：漂亮的进场动效，让玩家有"一年结束了"的沉浸体验
2. **数据驱动、可视化**：用数值对比、增长率、迷你图表等方式直观呈现变化
3. **叙事性强**：不只是干巴巴的数字，要有评语、评级、趣味描述
4. **可导出**：支持一键导出为图片或文本，方便分享

### 影响域

| 层级 | 涉及文件 | 操作 |
|------|----------|------|
| 配置 | `src/config/festivalEffects.js` | **删除**（不再需要 buff 配置） |
| 状态 | `src/stores/useEconomyStore.js` | 移除 `activeFestivalEffects` 相关状态；`festivalModal` 改为存储年度快照数据 |
| 触发 | `src/hooks/useGameLoop.js` | 保留年份检测逻辑，改为采集年度快照 + 打开报告模态框；移除 buff 过期清理 |
| 效果 | `src/logic/buildings/effects.js` | 移除 `applyFestivalEffects` |
| 模拟 | `src/logic/simulation.js` | 移除庆典效果的 `applyFestivalEffects` 调用 |
| 交互 | `src/App.jsx` | 移除 `handleFestivalSelect`、庆典历史列表；新增报告模态框渲染和导出处理 |
| UI | `src/components/modals/AnnualFestivalModal.jsx` | **重写为** `AnnualReportModal.jsx` |
| 工具 | `src/utils/annualReport.js`（新增） | 年度快照采集 + 数据对比计算 + 报告生成逻辑 |
| 同步 | `src/stores/storeUtils.js`、`useStoreSync.js` | 更新快照/恢复字段 |

---

## 需求

### 需求 1：移除旧庆典 buff 系统

**用户故事：** 作为一名开发者，我希望完全移除旧的庆典 buff 选择系统，以便为新的年度报告系统腾出空间，同时消除与理念系统功能重叠的冗余机制。

#### 验收标准

1. WHEN 旧庆典系统被移除 THEN 系统 SHALL 删除 `src/config/festivalEffects.js` 文件（80 个 buff 效果配置）
2. WHEN 旧庆典系统被移除 THEN 系统 SHALL 从 `useEconomyStore.js` 中移除 `activeFestivalEffects`、`setActiveFestivalEffects` 状态及其初始值
3. WHEN 旧庆典系统被移除 THEN 系统 SHALL 从 `effects.js` 中移除 `applyFestivalEffects` 函数
4. WHEN 旧庆典系统被移除 THEN 系统 SHALL 从 `simulation.js` 中移除对 `applyFestivalEffects` 的调用
5. WHEN 旧庆典系统被移除 THEN 系统 SHALL 从 `App.jsx` 中移除 `handleFestivalSelect`、`formatFestivalEffects`、庆典历史列表渲染
6. WHEN 旧庆典系统被移除 THEN 系统 SHALL 从 `useGameLoop.js` 中移除庆典效果过期清理逻辑（L1066-L1087）
7. WHEN 旧庆典系统被移除 THEN 系统 SHALL 从 `storeUtils.js` 和 `useStoreSync.js` 中移除 `activeFestivalEffects` 的快照/恢复字段
8. WHEN 旧存档加载且包含 `activeFestivalEffects` 数据 THEN 系统 SHALL 安全忽略该字段而不报错（向后兼容）

### 需求 2：年度快照数据采集

**用户故事：** 作为一名玩家，我希望游戏在每年结束时自动采集当前国家的关键数据，以便生成有意义的年度对比报告。

#### 验收标准

1. WHEN 游戏检测到年份从 Y 变为 Y+1 THEN 系统 SHALL 采集以下年末快照数据：
   - **经济**：国库银币余额、年度税收总额、GDP（总量+增长率）、CPI、PPI
   - **人口**：总人口、各阶层人口分布（popStructure）
   - **社会**：各阶层满意度（classApproval）、总体稳定度（stability）
   - **产业**：各建筑数量及总数、按类别（gather/industry/civic/military）汇总
   - **军事**：军队总兵力（含散兵+军团）、军事容量、军团数量
   - **资源**：各资源库存量
   - **科技/文化**：已解锁科技数量、当前时代
2. WHEN 年末快照被采集 THEN 系统 SHALL 同时记录该年的起始数据快照（即上一年末的快照），以便计算 YoY（Year-over-Year）变化
3. IF 是游戏的第一年（lastFestivalYear 为初始值） THEN 系统 SHALL 使用当前数据作为基准，不计算变化率，仅展示当前状态
4. WHEN 快照数据被采集 THEN 系统 SHALL 将其存储在 `festivalModal`（或重命名的 `annualReportData`）状态中，并暂停游戏
5. WHEN 快照数据被采集 THEN 系统 SHALL 保留 `lastFestivalYear` 机制以防重复触发

### 需求 3：年度报告数据计算与评级

**用户故事：** 作为一名玩家，我希望看到的不只是原始数字，还有增长率、评级和叙事性评语，让报告像一份真正的政府工作报告一样有代入感。

#### 验收标准

1. WHEN 年度快照数据可用 THEN 系统 SHALL 计算以下核心指标的 YoY 变化：
   - 国库余额变化（绝对值 + 百分比）
   - GDP 增长率
   - 人口增长率
   - 总建筑数增长
   - 军事力量变化
   - 平均满意度变化
   - 稳定度变化
2. WHEN 各项指标的 YoY 变化已计算 THEN 系统 SHALL 对每项指标生成评级（如 S/A/B/C/D/F 或 ★~★★★★★），评级规则基于增长幅度
3. WHEN 评级已生成 THEN 系统 SHALL 计算一个综合年度评分（加权汇总），并给出一个总体评语（如"繁荣盛世"、"稳步发展"、"艰难时期"等）
4. WHEN 各项指标数据可用 THEN 系统 SHALL 为每个板块生成一句自然语言的总结评语（如"经济蓬勃发展，GDP 增长 15.2%，国库充盈"或"民生堪忧，三个阶层满意度跌破 40%"）
5. IF 某项数据在上年和本年均为零或不可用 THEN 系统 SHALL 显示"暂无数据"而非显示 0% 或 NaN

### 需求 4：年度报告 UI 展示

**用户故事：** 作为一名玩家，我希望看到一个精美、有仪式感的年度报告界面，让每年结束时都有"翻开新篇章"的感觉。

#### 验收标准

1. WHEN 年度报告模态框被触发 THEN 系统 SHALL 以全屏覆盖 + 入场动效的形式展示（复用 framer-motion + createPortal 模式）
2. WHEN 模态框展示 THEN 系统 SHALL 包含以下视觉元素：
   - **头部**：年份标题（如"第 5 年 · 年度政府工作报告"）、当前时代名称、帝国名称
   - **综合评分区**：总评分 + 总评语 + 等级徽章
   - **分项报告板块**（以卡片/区段形式展示）：
     - 📊 **经济概况**：国库/GDP/CPI/税收的变化，含迷你柱状图或增长箭头
     - 👥 **人口与民生**：总人口增长、各阶层人口分布饼图或条形图、平均满意度
     - 🏗️ **产业发展**：建筑总数变化、按类别的建筑分布
     - ⚔️ **军事力量**：兵力变化、军团数、军事容量
     - 📦 **资源储备**：关键资源变化（高亮增减最大的资源）
     - 🔬 **科技文化**：已解锁科技数量、时代信息
     - ⚖️ **社会稳定**：稳定度变化、各阶层满意度变化（红绿箭头）
3. WHEN 各板块展示变化量时 THEN 系统 SHALL 使用直观的视觉指示器：
   - 增长用绿色 + ▲ 箭头
   - 下降用红色 + ▼ 箭头
   - 无变化用灰色 + - 横线
   - 百分比变化显示在旁
4. WHEN 报告内容超出屏幕 THEN 系统 SHALL 支持垂直滚动查看完整报告
5. WHEN 玩家点击"继续"按钮 THEN 系统 SHALL 关闭模态框并恢复游戏暂停前的状态
6. WHEN 报告展示时 THEN 系统 SHALL 在每个板块中包含一句评语（来自需求 3 的自然语言总结）
7. WHEN 模态框展示 THEN 系统 SHALL 适配移动端和桌面端（响应式布局），移动端以单列垂直滚动为主

### 需求 5：年度报告导出

**用户故事：** 作为一名玩家，我希望能一键导出年度报告，方便在社交媒体或朋友间分享我的治理成果。

#### 验收标准

1. WHEN 报告模态框展示 THEN 系统 SHALL 提供"导出报告"按钮
2. WHEN 玩家点击"导出报告" THEN 系统 SHALL 生成一份格式化的纯文本报告，并复制到剪贴板
3. WHEN 文本报告被生成 THEN 系统 SHALL 包含以下内容：
   - 标题行（帝国名称 + 年份 + 时代）
   - 综合评分和总评语
   - 各板块的关键数据和变化量
   - 用 ASCII 艺术或 Emoji 增强可读性
4. WHEN 导出成功 THEN 系统 SHALL 显示成功提示（toast/短暂反馈）
5. IF 剪贴板 API 不可用 THEN 系统 SHALL 回退到弹出文本框供手动复制

### 需求 6：存档兼容性与状态管理

**用户故事：** 作为一名玩家，我希望系统升级后旧存档能正常加载，不丢失任何游戏进度。

#### 验收标准

1. WHEN 旧存档包含 `activeFestivalEffects` 字段 THEN 系统 SHALL 安全忽略该字段且不影响游戏加载
2. WHEN 旧存档包含 `lastFestivalYear` 字段 THEN 系统 SHALL 继续使用该字段控制年报触发，确保不会在加载后立即触发
3. WHEN 年度快照数据存在于 `festivalModal`（或新字段）中 THEN 系统 SHALL 将其纳入存档的快照/恢复流程
4. WHEN 游戏重置（resetEconomy）被调用 THEN 系统 SHALL 正确清除年报相关状态
5. WHEN 年报模态框打开期间玩家存档并重载 THEN 系统 SHALL 能正确恢复模态框状态

### 需求 7：年初快照基准采集

**用户故事：** 作为一名玩家，我希望报告能准确对比"年初"和"年末"的数据变化，而不是和游戏开始时对比。

#### 验收标准

1. WHEN 年度报告关闭（玩家点击继续） THEN 系统 SHALL 采集当前时刻的数据作为下一年的"年初基准快照"并持久化存储
2. WHEN 下一年结束触发报告 THEN 系统 SHALL 用上一次保存的年初基准快照与当前数据做对比
3. IF 没有年初基准快照（首次运行或旧存档） THEN 系统 SHALL 使用当前数据作为基准，报告中标注"首年报告，无对比数据"
4. WHEN 年初基准快照被存储 THEN 系统 SHALL 将其纳入存档的快照/恢复流程（`storeUtils.js`）

---

## 边界情况与技术约束

### 边界情况
1. **第一年**：无对比数据，展示当前状态，各变化量显示 "N/A" 或 "首年"
2. **加速模式**：现有触发逻辑已处理加速模式下的跳过问题（检测年份变化而非特定日期）
3. **存档加载到年末**：如果在年末时刻加载存档，需要确保不会重复触发报告（`lastFestivalYear` 机制保障）
4. **数据缺失**：部分数据可能为空（如军队为空、某些资源未解锁），需要优雅降级
5. **性能**：快照数据采集应在一次同步操作中完成，不阻塞 tick loop

### 技术约束
1. **复用优先**：使用现有 `festivalModal` + `lastFestivalYear` 状态控制流程，不引入新的顶层状态变量
2. **UI 风格一致**：复用现有的 glass-epic、gradient、framer-motion 等 UI 模式
3. **导出简单化**：优先实现纯文本剪贴板导出，暂不引入 html2canvas 等重型依赖
4. **不新增经济模型**：数据采集使用现有的 gameState 数据源，不修改 simulation 的计算逻辑

---

## 成功标准

1. 旧庆典 buff 系统被完全移除，不留残余代码
2. 年度报告在每年结束时自动弹出，包含 7 个板块的详尽数据
3. 数据对比准确（YoY），评级和评语合理且有趣
4. UI 动效流畅，移动端和桌面端均可用
5. 导出功能正常工作，生成的文本报告格式清晰
6. 旧存档能正常加载，不受影响
