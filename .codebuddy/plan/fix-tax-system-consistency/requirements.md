# 需求文档：税收系统一致性修复

## 引言

当前税收系统存在两个核心问题：

1. **`effectiveTaxModifier`（税收修正系数）语义错误**：该系数可以 > 1，导致民众被扣的税款超过其全部应税收入（"虚空税"）。用户的设计意图是：税收效率代表"贪污损耗"，民众被扣 X 的钱，国库只收到 ≤ X 的钱。`taxBonus`（税收加成）应该减少损耗、提高效率，而不是凭空增加征税额。

2. **商人应税收入与显示收入不一致**：由于执行顺序问题（人头税在贸易之前执行），`roleTaxableIncome.merchant` 在征税时不包含贸易收入，但 UI 显示的总收入包含贸易收入，导致"应税收入"远小于"总收入"。

### 当前数据流（有问题）

```
effectiveTaxModifier = taxModifier(1.0) × legitimacyTaxModifier(0.3~1.0) × (1 + taxBonus + ideoTaxModifier)
                     → 当 taxBonus > 0 时可以 > 1.0

民众被扣 = incomeBase × headRate × effectiveTaxModifier  → 可能 > incomeBase
国库收到 = taxBreakdown.headTax × effectiveTaxEfficiency  → 腐败后的实际入库
```

### 用户期望的数据流

```
effectiveTaxModifier ≤ 1.0（永远不超过100%效率）
民众被扣 = incomeBase × headRate × effectiveTaxModifier  → 永远 ≤ incomeBase × headRate
国库收到 = 民众被扣 × (1 - 腐败率)
taxBonus 的作用 = 减少损耗（提高 effectiveTaxModifier 向 1.0 靠近），而不是超过 1.0
```

### 截图数据验证

- **樵夫**：50%税率，应税收入 2.59/人/日，实际税额 1.983。1.983/2.59 = 76.6%，但设了50%税率。说明 `effectiveTaxModifier ≈ 1.53`，50% × 1.53 = 76.5%。
- **商人**：总收入 78.13（经营营收 22.20 + 贸易收入 55.94），应税收入 10.99。应税收入远小于总收入，因为贸易收入在人头税之后才计入。

## 需求

### 需求 1：修正 effectiveTaxModifier 语义

**用户故事：** 作为玩家，我希望税收效率系数永远不超过 100%，以便 100% 税率最多收走全部收入，而不会出现"虚空税"。

#### 验收标准

1. WHEN `effectiveTaxModifier` 被计算 THEN 系统 SHALL 确保其值在 `[0, 1.0]` 范围内。
2. WHEN `taxBonus > 0` THEN 系统 SHALL 将其作用理解为"减少效率损耗"（使 `effectiveTaxModifier` 向 1.0 靠近），而非"放大征税倍率"。
3. WHEN `legitimacy = 100` 且 `taxBonus = 0` THEN `effectiveTaxModifier` SHALL 等于 `1.0`（满合法性、无加成 = 100%效率）。
4. WHEN `legitimacy = 0` 且 `taxBonus = 0` THEN `effectiveTaxModifier` SHALL 等于 `0.3`（最低合法性 = 30%效率）。
5. WHEN `legitimacy = 50` 且 `taxBonus = 0.5` THEN `effectiveTaxModifier` SHALL 大于无加成时的值，但不超过 `1.0`。
6. WHEN 任何阶层的人头税被计算 THEN `plannedPerCapitaTax` SHALL 永远不超过 `incomeBase`（即 100% 税率下最多收走全部应税收入）。
7. IF `effectiveTaxModifier` 的新公式被应用 THEN 所有使用该系数的位置（simulation.js 主人头税、官员税、建筑预扣税估算、贸易价格估算、jobs.js 岗位填充估算）SHALL 统一使用新公式。

#### 设计建议

当前公式：`effectiveTaxModifier = taxModifier × legitimacyTaxModifier × (1 + taxBonus + ideoTaxModifier)`

建议新公式：
```
baseTaxEfficiency = taxModifier × legitimacyTaxModifier  // [0.3, 1.0]
// taxBonus 减少效率损耗：将 baseTaxEfficiency 向 1.0 拉近
effectiveTaxModifier = baseTaxEfficiency + (1 - baseTaxEfficiency) × clamp(taxBonus + ideoTaxModifier, 0, 1)
// 结果范围：[baseTaxEfficiency, 1.0]，永远不超过 1.0
```

例如：
- legitimacy=100, taxBonus=0 → base=1.0, final=1.0（满效率）
- legitimacy=50, taxBonus=0 → base=0.65, final=0.65
- legitimacy=50, taxBonus=0.5 → base=0.65, final=0.65 + 0.35×0.5 = 0.825
- legitimacy=0, taxBonus=1.0 → base=0.3, final=0.3 + 0.7×1.0 = 1.0（加成完全弥补了低合法性）

### 需求 2：修复商人应税收入数据流

**用户故事：** 作为玩家，我希望商人的"应税收入"能正确反映其全部应税收入来源（包括贸易收入），以便理解税收计算的合理性。

#### 验收标准

1. WHEN 商人贸易完成产生收入 THEN 该收入 SHALL 被计入 `roleTaxableIncome.merchant`，且在人头税征收时可用。
2. IF 贸易收入在人头税之后才结算（执行顺序限制） THEN 系统 SHALL 使用上一 tick 的贸易收入作为征税基数的一部分（类似军人使用 `previousWages` 的方案）。
3. WHEN UI 显示"应税收入" THEN 该值 SHALL 与人头税征收时使用的实际征税基数一致。
4. WHEN UI 显示"总收入"和"应税收入" THEN 两者的差异 SHALL 仅来自免税项目（补贴等），而非时序差异。

### 需求 3：移除之前的 cap 修复

**用户故事：** 作为开发者，我希望移除之前添加的 `Math.min(..., incomeBase)` cap，因为修正 `effectiveTaxModifier` 语义后不再需要它。

#### 验收标准

1. WHEN `effectiveTaxModifier` 被正确限制在 `[0, 1.0]` THEN 系统 SHALL 移除所有 7 处 `Math.min(incomeBase * headRate * effectiveTaxModifier, incomeBase)` 的 cap 逻辑。
2. WHEN cap 被移除后 THEN `plannedPerCapitaTax = incomeBase * headRate * effectiveTaxModifier` 的结果 SHALL 自然不超过 `incomeBase`（因为 `headRate ≤ 1.0` 且 `effectiveTaxModifier ≤ 1.0`）。

### 需求 4：统一 effectiveTaxModifier 和 taxEfficiency 的概念

**用户故事：** 作为开发者，我希望税收系统中"效率"的概念清晰统一，以便维护和理解。

#### 验收标准

1. `effectiveTaxModifier`（征收效率）SHALL 代表"民众实际被扣的比例"，范围 [0, 1.0]。
2. `effectiveTaxEfficiency`（入库效率）SHALL 代表"国库实际收到的比例"，范围 [0, 1.0]，受腐败影响。
3. WHEN 两个效率概念被使用 THEN 代码注释 SHALL 清晰区分两者的含义。
4. `taxBonus` SHALL 同时影响征收效率和入库效率（减少损耗），但两者都不超过 1.0。

### 需求 5：UI 显示优化

**用户故事：** 作为玩家，我希望概览页和财务页的税收信息清晰准确，以便理解税收系统的运作。

#### 验收标准

1. WHEN 概览页显示"实际税额" THEN 该值 SHALL 等于 `应税收入 × 税率 × 征收效率`。
2. WHEN 概览页显示"应税收入" THEN 该值 SHALL 包含所有应税收入来源（建筑产出 + 工资 + 贸易收入），不包含免税项目（补贴）。
3. WHEN 财务页显示"应税收入" THEN 该值 SHALL 与概览页一致。
4. IF 征收效率 < 1.0 THEN 概览页 SHALL 显示"征收效率: XX%"提示，帮助玩家理解税额与应税收入的关系。
5. WHEN 征收效率 = 1.0 THEN 系统 SHALL 不显示效率提示（避免信息冗余）。
