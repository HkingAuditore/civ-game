# 任务规划：税收系统一致性修复

## 影响域
- **logic**: simulation.js, economy/taxes.js, economy/trading.js, population/jobs.js, demands.js, organizationSystem.js, rulingCoalition.js
- **components**: panels/StratumDetailSheet.jsx
- **hooks**: useGameLoop.js (数据传递)

## 现有机制摘要

### effectiveTaxModifier 当前计算（simulation.js L2084-2087）
```
effectiveTaxModifier = Math.max(0,
    taxModifier(1.0) × legitimacyTaxModifier(0.3~1.0) × (1 + taxBonus + ideoTaxModifier)
)
```
- `taxModifier` = 1.0（固定）
- `legitimacyTaxModifier` = `getLegitimacyTaxModifier(previousLegitimacy)` = `0.3 + (legitimacy/100) × 0.7`，范围 [0.3, 1.0]
- `taxBonus` = 累加自官员效果、立场效果、科技效果
- `ideoTaxModifier` = 来自意识形态规则
- **问题**：当 `taxBonus + ideoTaxModifier > 0` 时，结果可以 > 1.0

### 人头税征收流程（simulation.js L3490-3560）
1. 获取 `headRate`（税率）
2. 获取 `roleTaxableIncome[key]`（应税收入）
3. 计算 `plannedPerCapitaTax = Math.min(incomeBase × headRate × effectiveTaxModifier, incomeBase)`
4. 受限于阶层财富上限
5. 通过 ledger.transfer 转入国库

### 腐败处理（simulation.js L8310-8380）
1. 计算 `effectiveTaxEfficiency = clamp(efficiency × (1 + taxEfficiencyBonus - corruption), 0, 1)`
2. 计算 `corruptionLoss = taxBase × (efficiencyNoCorruption - effectiveTaxEfficiency)`
3. 从国库扣除腐败损失，分配给官员

### 商人应税收入时序
- 建筑产出写入 `roleTaxableIncome.merchant`：L1594, L1634（在人头税之前）
- 工资写入 `roleTaxableIncome[role]`：L3275（在人头税之前）
- 人头税征收使用 `roleTaxableIncome[key]`：L3494（此时只有建筑产出+工资）
- 贸易收入写入 `roleTaxableIncome.merchant`：trading.js L683（在人头税之后，L7587）
- **问题**：贸易收入未被计入人头税征税基数

---

## 子任务列表

### 任务 1：修正 effectiveTaxModifier 公式（核心修复）
**文件**: `src/logic/simulation.js` L2084-2087
**修改内容**:
```js
// 旧公式
const effectiveTaxModifier = Math.max(0,
    taxModifier * legitimacyTaxModifier * (1 + (bonuses.taxBonus || 0) + (bonuses.ideoTaxModifier || 0))
);

// 新公式：taxBonus 减少效率损耗，结果永远 ≤ 1.0
const baseTaxEfficiency = taxModifier * legitimacyTaxModifier; // [0.3, 1.0]
const bonusRecovery = Math.max(0, Math.min(1, (bonuses.taxBonus || 0) + (bonuses.ideoTaxModifier || 0)));
const effectiveTaxModifier = Math.min(1.0,
    baseTaxEfficiency + (1 - baseTaxEfficiency) * bonusRecovery
);
```
**验证**: legitimacy=100,bonus=0 → 1.0; legitimacy=0,bonus=0 → 0.3; legitimacy=50,bonus=0.5 → 0.825

### 任务 2：修正 getLegitimacyTaxModifier 注释
**文件**: `src/logic/rulingCoalition.js`
**修改内容**: 修正注释中的错误范围 `[0.3, 1.5]` → `[0.3, 1.0]`

### 任务 3：移除所有 Math.min cap（7处）
**前提**: 任务1完成后，effectiveTaxModifier ≤ 1.0，不再需要 cap

**文件 & 位置**:
1. `simulation.js` L2150: `headTaxCost = Math.min(ownerIncomeBase * ownerHeadRate * effectiveTaxModifier, ownerIncomeBase)` → 移除 Math.min
2. `simulation.js` L3520: `plannedPerCapitaTax = Math.min(incomeBase * headRate * effectiveTaxModifier, incomeBase)` → 移除 Math.min
3. `simulation.js` L4581: `plannedPerCapitaTax = Math.min(officialIncomeBase * headRate * effectiveTaxModifier, officialIncomeBase)` → 移除 Math.min
4. `simulation.js` L7795: `headTaxCost = Math.min(roleIncomeBase * priceEstHeadRate * effectiveTaxModifier, roleIncomeBase)` → 移除 Math.min
5. `simulation.js` L7862: `taxCost = Math.min(headIncBase * empHeadRate * effectiveTaxModifier, headIncBase)` → 移除 Math.min
6. `simulation.js` L7915: `taxCostPerCapita = Math.min(headIncomeBase * sumHeadRate * effectiveTaxModifier, headIncomeBase)` → 移除 Math.min
7. `jobs.js` L257: `taxCost = Math.min(incomeBase * headRate * effectiveTaxModifier, incomeBase)` → 移除 Math.min

### 任务 4：修复商人贸易收入应税时序
**方案**: 使用上一 tick 的贸易收入作为征税基数（类似军人使用 previousWages 的方案）

**文件 & 修改**:
1. `simulation.js` 返回值：新增 `previousMerchantTradeIncome` 字段，记录本 tick 商人贸易收入总额
2. `simulation.js` 函数参数：接收上一 tick 的 `previousMerchantTradeIncome`
3. `simulation.js` 人头税征收前（L3490附近）：将 `previousMerchantTradeIncome` 加入 `roleTaxableIncome.merchant`
4. `useGameLoop.js`：传递 `previousMerchantTradeIncome` 到下一 tick
5. `trading.js`：返回本 tick 的商人贸易收入总额

### 任务 5：同步修改 demands.js 和 organizationSystem.js
**文件**: `src/logic/demands.js` L215, L217
**修改内容**: 这两个文件只是消费 effectiveTaxModifier，不需要修改公式，但需要确认它们接收的值已经是修正后的（≤ 1.0）。由于它们从 simulation.js 传入，任务1修正后自动生效。

**验证**: 确认 demands.js 和 organizationSystem.js 中没有独立计算 effectiveTaxModifier 的逻辑。✅ 已确认，它们都是从外部传入。

### 任务 6：同步修改 taxes.js 中的 collectHeadTax
**文件**: `src/logic/economy/taxes.js` L121, L123
**修改内容**: collectHeadTax 函数也使用 effectiveTaxModifier，但该函数在 simulation.js 中**未被调用**（simulation.js 内联了人头税逻辑）。为保持一致性，仍需更新注释说明 effectiveTaxModifier 的新语义。

### 任务 7：UI 显示优化
**文件**: `src/components/panels/StratumDetailSheet.jsx`
**修改内容**:
1. L730-732: 将"含税收修正 ×1.53"改为"征收效率: 65%"（更直观）
2. L737: 应税收入 tooltip 更新，说明包含贸易收入
3. L1367-1369: taxBaseMismatch 逻辑可能需要调整（贸易收入纳入后差异应减小）

### 任务 8：清理未使用的 calculateFinalTaxes
**文件**: `src/logic/economy/taxes.js`, `src/logic/simulation.js`
**修改内容**: `calculateFinalTaxes` 被导入但从未调用。可以：
- 选项A：移除该函数和导入（减少死代码）
- 选项B：保留但添加注释说明其设计意图（备用）
**建议**: 选项B，保留备用，添加 `@deprecated` 注释

---

## 执行顺序

```
任务1（核心公式修正）
  ↓
任务2（注释修正）← 可与任务1并行
  ↓
任务3（移除cap）← 依赖任务1
  ↓
任务4（商人贸易收入时序）← 独立于任务1-3
  ↓
任务5（验证demands/organization）← 依赖任务1
  ↓
任务6（taxes.js注释）← 可与任务3并行
  ↓
任务7（UI显示）← 依赖任务1+4
  ↓
任务8（清理死代码）← 最后执行
```

## 风险评估

1. **平衡性影响**: effectiveTaxModifier 从可能 > 1.0 变为 ≤ 1.0，会导致税收收入下降。需要关注：
   - 国库收入是否足够维持军费、官员薪俸等支出
   - 如果 taxBonus 之前被用来补偿低合法性的税收损失，新公式下可能需要调整 taxBonus 的数值
2. **商人贸易收入纳入征税**: 会增加商人的税负，可能影响商人阶层的财富积累和满意度
3. **向后兼容**: 存档中的 effectiveTaxModifier 值可能 > 1.0，加载后会被新公式覆盖（无影响，因为每 tick 重新计算）
