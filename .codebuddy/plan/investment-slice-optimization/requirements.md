# 需求文档：投资结算切片优化（参考贸易切片模式）

## 引言

### 背景

当前游戏中存在三类需要定期结算的经济操作，它们采用不同的性能优化策略：

| 操作 | 当前模式 | 频率 | 优先级 | 问题 |
|------|---------|------|--------|------|
| **贸易** | 切片轮转（Trade 3.0-3.2） | 每 tick 执行一个切片 | CRITICAL | ✅ 无问题 |
| **外资企业结算** | 全量跳过 + 批量补偿 | 每 20 tick 一次 | BATCH | ❌ 19/20 天财政面板无数据 |
| **海外资产结算** | 全量跳过 + 批量补偿 | 每 20 tick 一次 | BATCH | ❌ 19/20 天阶层收入无数据 |
| **军费** | 每 tick 全量执行 | 每 tick | CRITICAL | ✅ 无问题（但计算量较小） |

### 贸易切片优化法的核心思想

贸易系统（Trade 3.0-3.2）采用了一种**分层切片 + 缓存**的优化模式：

1. **分离评估与执行**：昂贵的机会评估（STEP 1）低频执行并缓存结果，轻量的交易执行（STEP 2-3）每 tick 都运行
2. **Partner 分片评估**：将贸易伙伴分成 `partnerSliceCount`（默认 10）个切片，每次刷新只评估一个切片，结果增量合并到全局缓存
3. **Opportunity 轮转执行**：将缓存的贸易机会分成 `tradeSlicesPerCycle`（默认 3）个切片，每 tick 只执行一个切片的交易
4. **核心优势**：每 tick 都有实际的经济活动发生，避免了"N tick 空转 + 1 tick 爆发"的脉冲式结算

### 现有切片模式参考

项目中已有多处使用 `getSlice()` 的切片模式：

- **AI 国家更新**：`aiSliceCount` 动态分片，每 tick 只更新一部分 AI 国家
- **附庸更新**：`vassalUpdateSlices` 分片更新经济/独立性，但**朝贡全量结算**（`unprocessedVassals` fallback）
- **手动贸易路线**：`manualTradeSlices` 分片处理

附庸的模式尤其值得参考：**重计算（经济模拟）分片执行，轻计算（朝贡收入）全量执行**。

### 本次优化目标

将外资企业和海外资产的结算从"全量跳过 + 批量补偿（×20 倍率）"模式，改为参考贸易切片的**分片轮转**模式，使得：
- 每 tick 都有一部分投资被结算（倍率从原来的 ×20 降为 ×切片数，如 ×5）
- 财政面板每天都能看到外资税收
- 阶层财务数据每天都能反映海外资产收入
- 总体计算量不增加（甚至可能减少，因为每 tick 只处理一小部分）

军费计算当前已是每 tick 执行，且计算量不大，**不纳入本次切片优化范围**。

---

## 需求

### 需求 1：外资企业结算切片化

**用户故事：** 作为一名玩家，我希望外资企业的税收每天都能结算并显示在财政面板中，以便随时了解外资对国库的贡献。

#### 涉及的完整经济效应

外资企业（AI在玩家国）的结算不仅涉及税收，还包括以下所有经济活动，切片化时必须全部正确处理：

| 经济效应 | 当前代码 | 说明 |
|---|---|---|
| 外资税收 | `applySilverChange(taxRevenue, 'foreign_investment_tax')` | 利润 × 税率 → 国库 |
| 关税收入 | `applySilverChange(tariffRevenue, 'foreign_investment_tariff')` | 进出口关税 → 国库 |
| 关税补贴 | `applySilverChange(-tariffSubsidy, 'foreign_investment_tariff_subsidy')` | 关税补贴 → 国库支出 |
| 市场资源变化 | `applyResourceChange(key, delta, 'autonomous_investment_return')` | 外资从本国市场采购原料、向本国市场出售产品 |
| 利润外流 | `profitOutflow`（记录值） | 税后利润流出本国（不直接扣银币，但影响经济统计） |

**注意**：当前代码中 `marketChanges` 的 delta 只乘了 `multiplier`（count），**未乘 `ticksElapsed`**。切片化后需确认此行为是否正确（即市场资源变化是否应该按切片数放大）。

#### 验收标准

1. WHEN 玩家国内存在外资企业 THEN 系统 SHALL 将所有外资企业分成 N 个切片（N 由配置决定），每 tick 结算一个切片的利润和税收。
2. WHEN 某个切片的外资企业被结算时 THEN 系统 SHALL 按该切片内企业的利润 × 切片数（`sliceCount`）计算税收（即补偿轮转间隔），并通过 `applySilverChange` 记录到审计日志。
3. WHEN 某个切片被结算时 THEN 系统 SHALL 同时正确处理该切片的关税收入/补贴（`tariffRevenue`/`tariffSubsidy`）和市场资源变化（`marketChanges`），确保所有经济效应与利润结算同步。
4. WHEN 所有切片轮转一个完整周期后 THEN 每家外资企业 SHALL 恰好被结算一次，且 N 个 tick 的总税收金额、总关税金额、总市场资源变化 SHALL 与改造前 N 个 tick 的总量一致。
5. IF 外资企业数量少于切片数 THEN 系统 SHALL 自动退化为每 tick 全量结算（切片数 = 1）。
6. WHEN 外资企业列表发生变化（新增/移除/国家吞并转移） THEN 切片分配 SHALL 在下一个轮转周期自动适配。

### 需求 2：海外资产结算切片化

**用户故事：** 作为一名玩家，我希望海外资产的利润每天都能结算并反映在阶层财务数据中，以便准确了解各阶层的海外投资收益。

#### 涉及的完整经济效应

海外资产（玩家在AI国）的结算涉及以下所有经济活动，切片化时必须全部正确处理：

| 经济效应 | 当前代码 | 说明 |
|---|---|---|
| 利润 → 阶层财富 | `wealth[stratum] += profit`（通过 `profitByStratum`） | 投资利润按业主阶层分配到 `classWealth` |
| 成本 → 阶层财务 | `classFinancialData[stratum].income/expense += ...`（通过 `costsByStratum`） | 产出收入、投入成本、工资、营业税、运输费记入阶层财务报表 |
| 关税收入 | `applySilverChange(tariffRevenue, 'overseas_investment_tariff')` | 海外投资相关关税 → 国库 |
| 关税补贴 | `applySilverChange(-tariffSubsidy, 'overseas_investment_tariff_subsidy')` | 关税补贴 → 国库支出 |
| 玩家库存变化 | `applyResourceChange(key, delta, 'overseas_investment_return')` | 从海外运回的资源进入玩家库存 |
| 目标国市场变化 | `nation.inventory[resKey] += amount`（通过 `marketChanges`） | 在目标国采购/出售资源影响其库存 |
| 附庸国投资效果 | `nation._investmentEffects = effects`（通过 `nationInvestmentEffects`） | 投资对附庸国阶层经济的影响（工资、利润抽取、再投资） |

**注意**：海外资产的 `scaledProfit`、`scaledOutput`、`scaledInput`、`scaledWage` 等**全部乘了 `ticksElapsed`**，切片化时这些值都需要用 `sliceCount` 替代原来的频率值。

#### 验收标准

1. WHEN 玩家拥有海外资产 THEN 系统 SHALL 将所有海外资产分成 N 个切片，每 tick 结算一个切片的利润和成本。
2. WHEN 某个切片的海外资产被结算时 THEN 系统 SHALL 按该切片内资产的利润 × 切片数（`sliceCount`）计算收益（即补偿轮转间隔），并正确更新 `classWealth` 和 `classFinancialData`。
3. WHEN 某个切片被结算时 THEN 系统 SHALL 同时正确处理该切片的：关税收入/补贴、玩家库存变化（`playerInventoryChanges`）、目标国市场变化（`marketChanges`）、附庸国投资效果（`nationInvestmentEffects`），确保所有经济效应与利润结算同步。
4. WHEN 所有切片轮转一个完整周期后 THEN 每项海外资产 SHALL 恰好被结算一次，且 N 个 tick 的总收益、总阶层财务数据、总资源变动 SHALL 与改造前 N 个 tick 的总量一致。
5. IF 海外资产数量少于切片数 THEN 系统 SHALL 自动退化为每 tick 全量结算。

### 需求 3：投资升级保持低频执行

**用户故事：** 作为一名开发者，我希望投资升级逻辑（`processOverseasInvestmentUpgrades` / `processForeignInvestmentUpgrades`）保持低频执行，以避免不必要的性能开销。

#### 验收标准

1. WHEN 投资利润结算被切片化后 THEN 投资升级逻辑 SHALL 仍然保持低频执行（如每 20 tick 一次），不随利润结算一起切片化。
2. IF 升级逻辑依赖 `ticksElapsed` 参数 THEN 该参数 SHALL 保持原有的批量频率值，不受利润结算切片化的影响。

### 需求 4：性能不退化

**用户故事：** 作为一名玩家，我希望切片优化后游戏的帧率不会下降，以便保持流畅的游戏体验。

#### 验收标准

1. WHEN 切片化后每 tick 处理的投资数量 SHALL 约等于总投资数 / 切片数，确保单 tick 计算量不超过改造前的全量结算。
2. IF AI 国家数量超过 15 个或设备处于低性能模式 THEN 切片数 SHALL 可通过动态频率机制自动调整（与现有 `getDynamicFrequency` 机制兼容）。
3. WHEN 切片化执行时 THEN 系统 SHALL 复用现有的 `getSlice()` 工具函数，不引入新的切片基础设施。

### 需求 5：财政面板每日显示外资税收（原需求延续）

**用户故事：** 作为一名玩家，我希望在财政收支面板中每天都能看到外资企业的税收收入项。

#### 验收标准

1. WHEN 外资企业结算被切片化后 THEN 每 tick 的 `silverChangeLog` 中 SHALL 自然包含 `foreign_investment_tax` 条目（因为每 tick 都有切片在结算）。
2. WHEN 财政面板显示"外资税收"时 THEN 金额 SHALL 为当天实际结算的切片税收总和（非估算值）。
3. IF 当天结算的切片中所有外资企业利润为零 THEN 财政面板 SHALL 不显示外资税收项（金额为 0 时不显示）。
4. WHEN 切片化完成后 THEN 之前讨论的方案 B（useGameLoop fallback 补充）SHALL 不再需要，因为根本问题已通过切片化解决。

### 需求 6：配置可调

**用户故事：** 作为一名开发者，我希望切片数量可通过配置调整，以便根据性能测试结果进行优化。

#### 验收标准

1. WHEN 配置外资/海外资产切片数时 THEN 系统 SHALL 在 `RATE_LIMIT_CONFIG` 中提供 `foreignInvestmentSlices` 和 `overseasInvestmentSlices` 配置项。
2. IF 切片数配置为 1 THEN 系统 SHALL 退化为每 tick 全量结算（等价于当前军费的模式）。
3. WHEN 切片数配置发生变化时 THEN 系统 SHALL 在下一个 tick 自动适配，无需重启游戏。

---

## 技术方案

### 核心思路：参考附庸模式的"重计算分片 + 轻计算全量"

外资/海外资产的结算可以分为两部分：
- **重计算**：`processForeignInvestments` / `processOverseasInvestments` 中的利润计算（涉及建筑产出、供应链、税率等）
- **轻计算**：将计算结果应用到国库/阶层财富（`applySilverChange`、`wealth[stratum] += profit`）

切片化只需要将**投资列表**分片传入处理函数，每 tick 只处理一个切片。

### 实现要点

1. **将 `ticksElapsed` 倍率从频率值改为切片数**：切片化后每项投资每个轮转周期恰好被结算一次，`ticksElapsed` 参数改为传入切片数（`sliceCount`），以补偿轮转间隔。例如分 5 个切片时，每次结算传 `ticksElapsed = 5`，表示该切片的投资需要补偿 5 天的利润。

2. **复用 `getSlice()`**：
   ```javascript
   // 外资切片
   const fiSlices = Math.max(1, RATE_LIMIT_CONFIG.foreignInvestmentSlices || 5);
   const fiSlice = getSlice(foreignInvestments, fiSlices);
   
   // 海外资产切片
   const oiSlices = Math.max(1, RATE_LIMIT_CONFIG.overseasInvestmentSlices || 5);
   const oiSlice = getSlice(overseasInvestments, oiSlices);
   ```

3. **移除利润结算的 `shouldRunThisTick` 守卫**：切片化后每 tick 都执行（处理一个切片），不再需要频率守卫来跳过 tick。切片轮转本身就是性能控制手段。

4. **升级逻辑保持独立**：`processForeignInvestmentUpgrades` / `processOverseasInvestmentUpgrades` 仍使用 `shouldRunThisTick` 守卫，保持低频执行。

5. **切片数建议值**：
   - 外资企业：`foreignInvestmentSlices: 5`（即 5 tick 轮转一次全部外资）
   - 海外资产：`overseasInvestmentSlices: 5`（即 5 tick 轮转一次全部海外资产）
   - 相比原来的 20 tick 一次全量，单 tick 计算量降为 1/5（而非 1/20 后突然 20 倍），更平滑

### 数值一致性验证

- **改造前**：每 20 tick 结算一次，每次利润 × 20 → 20 tick 总收入 = 利润 × 20
- **改造后（5 切片）**：每 tick 结算 1 个切片，每次利润 × 5（切片数）→ 每项投资每 5 tick 被结算 1 次，获得利润 × 5。20 tick 内每项投资被结算 4 次，总收入 = 4 × (利润 × 5) = 利润 × 20 ✅
- **关键区别**：改造前是“20 tick 空转 + 1 tick 爆发”，财政面板 19/20 天无数据；改造后是“每 tick 平滑结算 1/5 的投资”，财政面板每天都有数据。倍率从 20 降为 5，但结算频率从 1/20 升为 1/5，总量不变。

### 不纳入范围

- **军费计算**：当前已是每 tick 执行，计算量不大（只需遍历军队单位计算维护费），无需切片化。
- **投资升级**：保持低频执行，升级是低概率事件，不影响每日财务数据。
