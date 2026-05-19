# 需求文档：补贴吸引转职失效 Bug 修复

## 引言

**问题现象**：玩家在税收面板对农田（建筑业务税补贴）和自耕农阶层（人头税补贴 / `headTaxMultiplier < 0`）发放大量补贴，但人口并未明显地从其他阶层向自耕农岗位、或从其他建筑向农田流动。

**经过对现有代码（`src/logic/economy/taxes.js`、`src/logic/population/jobs.js`、`src/logic/simulation.js`）的实际审计**，确认补贴金额本身已经真实到账（`wealth` 与 `roleWagePayout` 均能反映补贴流入），**因此本次不修改结算环节**。Bug 的真因集中在"**转职信号传导**"与"**人口流动机制**"两层：

1. **信号量级缺陷**：阶层补贴 `subsidySignalBonus` 仅按 0.5 倍系数加入 `potentialIncome`，量级远小于 `incomeSignal`（人均工资+利润），即便补贴翻倍也埋没在主信号噪声中。
2. **建筑业务税补贴传导缺失**：`estimatePotentialIncomeForVacancy` 中**雇员分支完全没考虑业务税补贴**，导致"对农田发业务税补贴 → peasant 雇员吸引力不变"的硬性失效。
3. **流动机制限制**：`JOB_MIGRATION_RATIO=0.012` + `MIGRATION_COOLDOWN_TICKS=5`（双向冷却）+ 同 tier `SAME_TIER_MIGRATION_RESISTANCE=1.5`，使得即便信号修复后，玩家短时间内也看不到明显人口涌入。

**核心目标**：让"补贴 → 人口转职"在游戏内**因果可见**且**经济数值稳定**，所有修复在现有模块内扩展，不引入新子系统、不修改税收结算路径。

**范围**：
- 转职信号计算（`activeRoleMetrics.potentialIncome`、`estimatePotentialIncomeForVacancy`）
- 迁移速率与阻力（必要时通过常量调参，不重构）
- 经济与数值一致性约束（防止过度修复破坏现有市场反馈环）

**不在本次范围内**：
- 修改 `taxes.js` 中补贴的结算路径（保持 `effectiveTaxModifier` 折扣与"国库不足整笔丢弃"现状）
- 新增 UI 提示、日志类型、补贴可观测性面板
- 新增补贴类型或重写税收/转职整体架构

---

## 需求

### 需求 1：补贴信号量级修复（信号环节核心）

**用户故事：** 作为玩家，我希望补贴在"人口转职决策信号"中拥有与其经济量级匹配的吸引力，以便补贴政策真正能改变阶层之间的迁移方向。

#### 验收标准

1. WHEN 计算 `activeRoleMetrics[role].potentialIncome` 时 AND 该角色 `headRate < 0`（享受补贴） THEN 系统 SHALL 将"日补贴金额（人均）"以 **1.0 倍系数**（而非现有 0.5 倍 `SUBSIDY_INCOME_SIGNAL_BONUS`）加入 `incomeSignal` 主项，使补贴像工资一样直接体现在该阶层的潜在收入信号中。
2. WHEN 补贴金额（人均日值）≥ 该阶层基础工资（`expectedWage`）的 30% THEN 该阶层在 `handleJobMigration` 中的 `potentialIncome` SHALL 进入 `maxPotentialIncome` 候选前列， AND 能稳定通过"目标候选"判定（`effectiveAttractiveness > sourceIncome * 1.3 * resistance`），从而对其他阶层产生有效拉力。
3. WHEN 多个阶层同时享受补贴 THEN 系统 SHALL 按补贴金额绝对值由高到低，依次让它们成为合法的迁移目标候选，避免"只有一个补贴生效"。
4. IF 该阶层 `pop === 0`（暂无人在岗） THEN 系统 SHALL 通过 `estimatePotentialIncomeForVacancy` 路径将该角色的"人头税补贴金额（按现有 `effectiveTaxModifier` 折扣后的实际到账值）"加入预估收入，使从未有人涉足的岗位也能因补贴变得有吸引力。
5. WHEN 玩家撤销补贴（headRate ≥ 0） THEN 系统 SHALL 在下一 tick 立即移除补贴对 `potentialIncome` 的加成， AND 不出现"信号残留"。
6. WHERE 修复保持与现有结算路径**对账一致**：`potentialIncome` 中的补贴信号金额 SHALL 等于 `taxes.js` 中实际到账的人均补贴金额（即 `|headRate| * effectiveTaxModifier`），不放大、不绕过税收效率折扣。

---

### 需求 2：建筑业务税补贴对岗位吸引力的传导修复

**用户故事：** 作为玩家，我希望对农田发放业务税补贴后，**农田岗位对所有可入职角色（业主与雇员）**的吸引力都同步上升，以便人口涌向有补贴的建筑。

#### 验收标准

1. WHEN 计算 `estimatePotentialIncomeForVacancy(role)` 时 AND 该 `role` 是某建筑的雇员 AND 该建筑 `businessTaxRate < 0`（业务税补贴） THEN 系统 SHALL 在"建筑利润反推合理工资"分支中，将业务税补贴金额（按现有税收效率折扣后的到账值）按现有"利润分润比例"（约 40%）加入 `estimatedWage`， AND 同步反映到 `getSmartExpectedWage` 给 `fillVacancies` 的工资参考值。
2. WHEN 计算 `estimatePotentialIncomeForVacancy(role)` 时 AND 该 `role` 是建筑业主 THEN 系统 SHALL 在 `netProfit` 中正确累加业务税补贴的到账金额（保持与 `taxes.js` 实际结算口径一致）。
3. WHEN 同一建筑同时拥有"对业主的人头税补贴"、"对雇员的人头税补贴"、"业务税补贴" THEN 系统 SHALL 三者独立累加进入对应角色的潜在收入信号，无遗漏、无重复计入。
4. WHEN 业务税补贴存在 AND 该建筑有空缺岗位 THEN `fillVacancies` 在 Tier 0/1 直接填补阶段中，对该建筑岗位的 `estimateRoleNetIncome(role)` SHALL 反映出补贴抬升后的工资，从而提高其填补优先级。
5. WHERE 与需求 1.6 保持一致性：建筑业务税补贴在信号中使用的金额 SHALL 等于 `taxes.js` 中实际到账金额，不放大、不绕过税收效率折扣。

---

### 需求 3：迁移速率与阻力对补贴政策的响应度

**用户故事：** 作为玩家，我希望在发放显著补贴后，能在合理时间窗口（5–15 个游戏日）内**肉眼可见**有人口流入，以便我对政策做出及时反馈。

#### 验收标准

1. WHEN 某阶层因补贴成为"显著高吸引力候选"（`potentialIncome ≥ avgPotentialIncome * 1.5`） THEN 该阶层 SHALL 享受**补贴拉力加速**：在 `handleJobMigration` 中作为目标时，本次迁移的有效迁移比例 SHALL 提升至 `JOB_MIGRATION_RATIO * SUBSIDY_PULL_MULTIPLIER`（建议常量 = 2.5–3.0，介于普通迁移与 `EMERGENCY_MIGRATION_RATIO` 之间）。
2. WHEN 补贴拉力下的迁移完成后 THEN 系统 SHALL 仅对"源角色"设置冷却（沿用 `MIGRATION_COOLDOWN_TICKS`）， **目标角色不进入冷却**（避免补贴目标被自身冷却屏蔽，下一 tick 仍有空缺却无人涌入）。
3. IF 补贴目标的同 tier 阻力（`SAME_TIER_MIGRATION_RESISTANCE = 1.5`）阻止了应有迁移 AND 补贴金额（人均日值）≥ 源角色 `potentialIncome` 的 30% THEN 系统 SHALL 将该次迁移的 tier 阻力按"补贴强度比例"线性削减，下限 1.0（与升级 tier 同等阻力），不低于 1.0。
4. WHEN 补贴政策被取消 THEN 系统 SHALL 立刻撤销上述 3 项加速/降阻效果，下一 tick 起恢复默认迁移参数。
5. WHEN 补贴拉力加速生效 THEN 单次迁移人数 SHALL 仍受 `targetCandidate.vacancy`（目标空缺）与建筑容量上限约束，不允许突破岗位/建筑容量。

---

### 需求 4：经济与数值一致性约束

**用户故事：** 作为开发者，我希望补贴修复不破坏现有"市场—工资—税收—消费"反馈环，以便整体经济模拟保持稳定。

#### 验收标准

1. WHEN 补贴修复完成 THEN 系统 SHALL 通过 `npm run build` 与 `npm run lint`， AND 现有 `tests/` 下相关测试不出现回归失败。
2. WHEN 补贴金额相对市场总量较小（< 国库每日税收 10%） THEN 修复后的迁移行为相对修复前 SHALL 仅有"温和增强"（迁移人数变化 ≤ 修复前 2 倍），避免数值爆炸。
3. WHEN 补贴金额相对市场总量较大（≥ 国库每日税收 50%） THEN 修复后 SHALL 出现明确的人口涌入（每日 ≥ `JOB_MIGRATION_RATIO * SUBSIDY_PULL_MULTIPLIER` × 源阶层人口），但单 tick 涌入量受目标空缺与建筑容量约束。
4. WHEN 补贴维持长期发放 THEN 系统 SHALL 仍受市场反馈调节（资源价格下降 → 利润下降 → 自然平衡），不出现"无限堆人到农田"的崩溃。
5. IF 补贴对象阶层在 `STRATUM_TIERS` 中跨多个 tier（如 `peasant=1`、`serf=0`） THEN 修复 SHALL 对所有 tier 一致生效，不歧视特定阶层。
6. WHEN 新增常量（如 `SUBSIDY_PULL_MULTIPLIER`、`SUBSIDY_RESISTANCE_REDUCTION_THRESHOLD`） THEN 这些常量 SHALL 集中放在 `src/logic/utils/constants.js` 的 `Subsidy` 区段， AND 附中文注释说明含义、量级、来源（关联本需求文档）。
7. WHEN 修复完成后 THEN 现有 `SUBSIDY_INCOME_SIGNAL_BONUS` 常量 SHALL 保留（向后兼容），但其在 `simulation.js` 中的使用方式 SHALL 由"次项 0.5 倍加成"调整为"主项 1.0 倍并入"，使量级与工资可比。

---

## 边界情况与风险

| # | 边界情况 | 处理预期 |
|---|---|---|
| E1 | 玩家对失业者（`unemployed`）发补贴 | 失业者不参与建筑岗位，但参与 `fillVacancies` 的源候选；补贴会让"留在失业"更有吸引力，进而**抑制**反向流入。本次需求不为此特例改造，沿用现有 `unemployed` 处理路径。 |
| E2 | 同时对多个互斥阶层发补贴（如 worker + peasant） | 两个目标各自累加 pull 信号，最终由 `handleJobMigration` 单次只挑选一对源/目标，每 tick 流向"最强吸引力"那一边；多 tick 会轮流满足。需求 1.3 已覆盖。 |
| E3 | 补贴叠加事件强制补贴（`forcedSubsidy`） | `forcedSubsidy` 走独立结算路径，本次修复 SHALL 不破坏其与 `headRate < 0` 的叠加效果（信号侧统一以最终 headRate 反推到账金额）。 |
| E4 | 国库长期不足导致补贴未真实发放 | 由于本次不修改结算路径（按用户要求），此情况下 `wealth` 与 `roleWagePayout` 都不会增加，`potentialIncome` 信号也**不应**出现"虚假补贴吸引力"——需求 1.6 / 2.5 通过"信号金额对账实际到账金额"已覆盖。 |
| E5 | 数值 NaN / 极端 headRate | 沿用现有 `getHeadTaxRate` 兜底；新增常量 SHALL 通过 `Number.isFinite` 校验。 |

---

## 成功标准（可验证指标）

1. 在新建一局游戏后，对 `peasant` 阶层设置 `headTaxMultiplier = -3`（补贴 3 银币/人/日）后**连续 30 个游戏日内**：
   - `peasant` 人口净流入 ≥ 50 人（或 ≥ 当前 `peasant` 人口的 8%）。
   - 对照组（不补贴）净流入 < 10 人或负流入。
2. 对农田建筑设置 `businessTaxRate = -2`（补贴）后 30 日内：
   - 农田 `peasant` 雇员岗位空缺率从 > 30% 下降到 < 10%。
3. 当玩家撤销补贴时，下一 tick 起 `peasant` 的 `potentialIncome` 立即回落，迁移率回归默认。
4. 修复前后对比：补贴金额相同时，修复后人口涌入速率为修复前 ≥ 2 倍（小补贴情形 ≤ 2 倍，避免爆炸；大补贴情形 ≥ 2 倍，可见效）。

---

## 现有机制摘要（实施参考，不计入需求条款）

> 来源：`src/logic/economy/taxes.js:128-156`、`src/logic/population/jobs.js:469-712`、`src/logic/simulation.js:8171-8278`、`src/logic/utils/constants.js`

- **补贴结算入口**（**本次不修改**）：`collectHeadTax` 在 `headRate < 0` 分支，按 `due = count * headRate * effectiveTaxModifier` 计算总额，从 `treasury` 扣除并加入 `wealth` 与 `roleWagePayout`，国库不足时整笔丢弃。
- **转职信号入口**：`activeRoleMetrics[i].potentialIncome = incomeSignal + stabilityBonus + subsidySignalBonus`，其中 `subsidySignalBonus = |taxCostPerCapita| * 0.5`，量级远小于 `incomeSignal`。**修复点**：将补贴金额并入 `incomeSignal` 主项（1.0 倍），保留 `subsidySignalBonus` 常量但调整使用方式。
- **迁移触发**：`handleJobMigration` 中源候选需"挣扎"（push）、目标候选需 `effectiveAttractiveness > source * 1.3 * resistance`，同 tier `resistance = 1.5`。**修复点**：对补贴显著目标加速 + 单向冷却 + 阻力按补贴强度线性削减至 1.0。
- **建筑业务税补贴的雇员传导路径**：`estimatePotentialIncomeForVacancy` 中**不存在**。这是导致"对农田发业务税补贴 → peasant 雇员吸引力不变"的关键缺陷。**修复点**：在 `estimatePotentialIncomeForVacancy` 雇员分支补充业务税补贴的"利润分润 → 工资抬升"传导。

---

## 实施重用决策（依据 civ-grounded-development 规则）

| 决策 | 是否重用 | 说明 |
|---|---|---|
| 修改 `simulation.js` 中 `potentialIncome` 三项加权 | ✅ 重用 | 调整加权方式，不新建信号系统 |
| 修改 `estimatePotentialIncomeForVacancy` 增加业务税补贴注入 | ✅ 重用 | 在现有函数内新增分支，不复制函数 |
| 新增 `SUBSIDY_PULL_MULTIPLIER`、`SUBSIDY_RESISTANCE_REDUCTION_THRESHOLD` 等常量 | ✅ 重用 | 集中加入 `constants.js` 的 Subsidy 区段 |
| 修改 `taxes.js` 补贴结算路径 | ❌ 不修改 | 按用户要求保持现状 |
| 新增独立"补贴流动模型" / UI 可观测性 / 日志类型 | ❌ 不重用 | 现有信号 + 迁移系统足以承载，不需要新子系统 |
