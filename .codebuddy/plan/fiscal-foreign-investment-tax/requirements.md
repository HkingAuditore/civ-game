# 需求文档：财政收支面板显示外资企业税收

## 引言

当前游戏中，外资企业（AI 国家在玩家国内的投资建筑）的利润税收已在 `simulation.js` 中正确计算并入库（通过 `applySilverChange(fiResult.taxRevenue, 'foreign_investment_tax')`），在"国际经济概览"面板中也能看到各国外资的纳税金额。然而，在状态栏的**财政收支面板**中，玩家大多数时候看不到"外资税收"这一收入项。

### 根因分析

经代码追踪，问题根源在于**外资结算频率与财政面板数据源的时间粒度不匹配**：

1. **外资结算频率**：`foreignInvestmentFrequency: 20`，即每 20 个 tick 才执行一次外资利润结算。结算时通过 `ticksElapsed` 倍率补偿累积（一次性结算 20 天的利润和税收）。
2. **财政面板数据源**：`StatusBar.jsx` 的 `actualFiscalSummary` 基于 `treasuryChangeLog` 中**当天（或上一天）**的条目构建。`treasuryChangeLog` 的条目来自 `_auditLog`（即 `silverChangeLog`），而 `silverChangeLog` 只在实际执行 `applySilverChange` 的 tick 中才会有对应条目。
3. **结果**：在 20 天中只有 1 天的 `_auditLog` 包含 `foreign_investment_tax` 条目，其余 19 天的财政面板中完全看不到外资税收。玩家在大多数时候打开财政面板都看不到这笔收入，造成信息缺失。

### 影响范围

- **UI 组件**：`src/components/layout/StatusBar.jsx`（财政收支弹窗）
- **逻辑层**：`src/logic/simulation.js`（外资结算与审计日志）
- **Hook 层**：`src/hooks/useGameLoop.js`（审计条目聚合）、`src/hooks/useGameState.js`（treasuryChangeLog 写入）
- **配置层**：`src/logic/utils/performanceUtils.js`（结算频率配置）

---

## 需求

### 需求 1：财政收支面板每日显示外资税收

**用户故事：** 作为一名玩家，我希望在财政收支面板中每天都能看到外资企业的税收收入项，以便准确了解国库的收入构成。

#### 验收标准

1. WHEN 玩家国内存在外资企业且外资企业有正利润 THEN 财政收支面板 SHALL 每天都显示"外资税收"收入项，而非仅在结算 tick 所在的那一天显示。
2. WHEN 外资税收在批量结算 tick 中一次性入库（如 20 天累积） THEN 系统 SHALL 将该笔税收按日均分摊到对应的天数中，使每天的财政面板都能反映外资税收贡献。
3. IF 外资企业利润为零或为负 THEN 系统 SHALL 不在财政面板中显示外资税收项（金额为 0 时不显示）。
4. WHEN 外资税收显示在财政面板中 THEN 其标签 SHALL 为"外资税收"，与现有 `REASON_LABELS` 映射一致。

### 需求 2：外资税收金额的准确性

**用户故事：** 作为一名玩家，我希望财政面板中显示的外资税收金额与实际入库金额一致，以便信任财政数据的准确性。

#### 验收标准

1. WHEN 外资税收按日均分摊显示时 THEN 每日显示的金额 SHALL 等于批量结算总额除以结算间隔天数（如总额 / 20）。
2. WHEN 外资结算 tick 实际执行时 THEN 实际入库的银币总额 SHALL 不受显示逻辑的影响（即只改变显示方式，不改变实际经济计算）。
3. IF 外资结算频率配置发生变化（如从 20 改为其他值） THEN 日均分摊逻辑 SHALL 自动适配新的频率值。

### 需求 3：与现有财政面板的一致性

**用户故事：** 作为一名玩家，我希望外资税收的显示方式与其他财政项目（如人头税、交易税）保持一致，以便获得统一的阅读体验。

#### 验收标准

1. WHEN 外资税收显示在财政面板中 THEN 其排序 SHALL 遵循现有的按金额绝对值降序排列规则。
2. WHEN 财政面板处于"实际"模式（基于 treasuryChangeLog） THEN 外资税收 SHALL 作为收入项出现在收入列表中。
3. WHEN 财政面板处于"估算"模式（基于 taxes.breakdown） THEN 外资税收 SHALL 同样可见（当前 `taxes.breakdown.foreignInvestmentTax` 已在估算模式中显示，此需求确保两种模式一致）。
4. IF 财政面板收入项超过 MAX_FISCAL_ITEMS（当前为 10） THEN 外资税收 SHALL 与其他项目一样遵循截断合并规则。

---

## 技术方案建议

### 方案 A：在 simulation.js 中每 tick 写入日均外资税收审计条目

在非结算 tick 中，基于上一次结算的日均值，向 `silverChangeLog` 写入一条 `foreign_investment_tax` 审计条目（金额为日均值）。实际银币变动仍只在结算 tick 发生。

- **优点**：每天的 `_auditLog` 都包含外资税收条目，`StatusBar.jsx` 无需修改
- **缺点**：审计日志中的条目金额与实际银币变动不完全对应（审计条目是"虚拟"的日均值）

### 方案 B：在 useGameLoop.js 的审计聚合阶段补充外资税收

在 `useGameLoop.js` 构建 `auditEntries` 时，如果当前 tick 的 `_auditLog` 中没有 `foreign_investment_tax` 条目，但 `taxes.breakdown.foreignInvestmentTax` 有值，则基于日均值补充一条 fallback 条目。

- **优点**：不修改 simulation 核心逻辑，与现有的 fallback 机制（如军费、补贴）一致
- **缺点**：需要在 gameLoop 中维护外资税收的日均值状态

### 方案 C：在 StatusBar.jsx 中直接从 taxes.breakdown 补充缺失项

当 `actualFiscalSummary` 中没有外资税收条目时，从 `taxes.breakdown.foreignInvestmentTax` 读取并按日均值补充。

- **优点**：改动最小，仅影响 UI 层
- **缺点**：可能导致"实际"模式和"估算"模式的数据混合

**推荐方案 B**，因为它与现有的 fallback 机制（军费、补贴等）保持一致，且不污染 simulation 核心审计日志。
