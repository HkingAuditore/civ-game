# 实施计划：补贴吸引转职失效 Bug 修复

> 基于 [requirements.md](./requirements.md) 4 个核心需求拆分。所有任务均为编码任务，按依赖顺序排列。

---

- [ ] 1. 在 `src/logic/utils/constants.js` 新增/调整 Subsidy 区段常量
   - 在现有 `// ============== Subsidy Income Signal Constants ==============` 区段补充：`SUBSIDY_PULL_MULTIPLIER = 2.8`（补贴拉力加速倍率，介于 `JOB_MIGRATION_RATIO` 与 `EMERGENCY_MIGRATION_RATIO` 之间）、`SUBSIDY_RESISTANCE_REDUCTION_THRESHOLD = 0.3`（补贴金额相对源 `potentialIncome` 占比阈值，触发同 tier 阻力削减）、`SUBSIDY_HIGH_ATTRACTIVENESS_RATIO = 1.5`（"显著高吸引力"判定倍率）
   - 保留 `SUBSIDY_INCOME_SIGNAL_BONUS = 0.5` 不动，使用方式由调用方调整（供向后兼容）
   - 每个常量附中文注释，说明含义、量级、需求来源
   - _需求：4.6、4.7、3.1、3.3_

- [ ] 2. 修复 `simulation.js` 中 `potentialIncome` 的补贴信号量级
   - 定位 `simulation.js` 第 8231–8238 行附近的 `subsidySignalBonus` 计算
   - 改为：当 `taxCostPerCapita < 0`（补贴）时，将 `Math.abs(taxCostPerCapita) * effectiveTaxModifier`（按现有税收效率折扣后的到账值）以 **1.0 倍**直接并入 `incomeSignal`；当 `taxCostPerCapita > 0`（征税）时，沿用 `SUBSIDY_INCOME_SIGNAL_BONUS = 0.5` 作为信号缓和系数（保留现有行为）
   - 保证 `headRate >= 0` 时补贴信号为 0（无残留）
   - _需求：1.1、1.5、1.6、4.7_

- [ ] 3. 在 `estimatePotentialIncomeForVacancy` 雇员分支注入业务税补贴传导
   - 定位 `simulation.js` 第 2158 行起的 `estimatePotentialIncomeForVacancy(role)` 函数
   - 在"按建筑利润反推合理工资"分支中：当所属建筑 `businessTaxRate < 0` 时，将业务税补贴的到账金额（`Math.abs(buildingDailyOutputValue * businessTaxRate) * effectiveTaxModifier`）按现有"利润分润比例 0.4"加入 `estimatedWage`
   - 业主分支：在 `netProfit` 累加业务税补贴到账金额（如已计入需保持一致，避免重复）
   - _需求：2.1、2.2、2.5_

- [ ] 4. 在 `estimatePotentialIncomeForVacancy` 中追加人头税补贴预估（`pop===0` 路径）
   - 同函数内，对入参 `role` 取其 `headRate`，若 `< 0`，追加人均补贴预估值（`Math.abs(headRate) * effectiveTaxModifier`）到返回的预估收入
   - 与雇员/业主分支独立累加，避免与业务税补贴重复
   - 确保 `getSmartExpectedWage` 对 `fillVacancies` 的工资参考值同步反映抬升
   - _需求：1.4、2.3、2.4_

- [ ] 5. 在 `handleJobMigration` 中识别"补贴显著高吸引力目标"
   - 定位 `jobs.js` 中 `handleJobMigration` 函数（约 469–712 行）
   - 在选出 `targetCandidate` 后，计算 `subsidyAmountPerCapita`（目标角色的人均到账补贴金额，对账 `taxes.js` 口径）
   - 判定 `isSubsidyDriven = subsidyAmountPerCapita > 0 && targetCandidate.potentialIncome >= avgPotentialIncome * SUBSIDY_HIGH_ATTRACTIVENESS_RATIO`，将该标志传入后续迁移率与阻力计算
   - _需求：3.1、4.5_

- [ ] 6. 实现补贴拉力加速与单向冷却
   - 在 `handleJobMigration` 应用 `migrationRatio` 处：当 `isSubsidyDriven === true` 时，使用 `JOB_MIGRATION_RATIO * SUBSIDY_PULL_MULTIPLIER`（替代默认 `JOB_MIGRATION_RATIO`）
   - 迁移完成后冷却写入：仅对源角色调用 `setMigrationCooldown`，**不**对目标角色设置冷却（修改现有双向冷却为单向，仅在 `isSubsidyDriven` 分支生效，其他场景保持原行为）
   - 单次迁移人数仍 clamp 到 `targetCandidate.vacancy` 与建筑容量上限
   - _需求：3.1、3.2、3.5_

- [ ] 7. 实现同 tier 阻力按补贴强度线性削减
   - 在 `handleJobMigration` 计算 `effectiveResistance` 处：若 `isSubsidyDriven` 且源/目标同 tier
   - 计算 `subsidyStrengthRatio = subsidyAmountPerCapita / sourceCandidate.potentialIncome`
   - 当 `subsidyStrengthRatio >= SUBSIDY_RESISTANCE_REDUCTION_THRESHOLD` 时，按 `resistance = lerp(SAME_TIER_MIGRATION_RESISTANCE, 1.0, clamp01((subsidyStrengthRatio - 0.3) / 0.7))`，下限 1.0
   - 仅作用于本次迁移，不写回常量；补贴撤销后下一 tick 自动恢复
   - _需求：3.3、3.4_

- [ ] 8. 多补贴阶层并存场景的目标候选排序
   - 在 `handleJobMigration` 选择目标候选时，若有多个候选满足"补贴显著"条件，按 `subsidyAmountPerCapita` 由高到低参与 `maxPotentialIncome` 比较，避免被 `incomeSignal` 噪声掩盖（沿用任务 2 的并入主项后已自然满足，本任务仅需追加 tie-break：当 potentialIncome 相近 ±5% 时优先选补贴更高者）
   - _需求：1.3、1.2_

- [ ] 9. 数值一致性自检与边界保护
   - 对任务 1 新增常量在 `constants.js` 用 `Number.isFinite` 校验或文件级 sanity check
   - 在 `simulation.js` 与 `jobs.js` 新增分支处对 `effectiveTaxModifier`、`headRate`、`businessTaxRate` 加空值/NaN 兜底（取 0），不破坏 `forcedSubsidy` 叠加逻辑
   - 确保 `headRate >= 0` 路径完全不进入新增的补贴信号分支
   - _需求：1.5、4.4、E3、E5_

- [ ] 10. 验证与回归
   - 运行 `npm run lint` 与 `npm run build`，修复必要告警
   - 运行 `tests/` 下与 `jobs`/`taxes`/`simulation` 相关的现有单测，确认无回归
   - 在游戏内手动验证两个场景：(a) 对 `peasant` 设置 `headTaxMultiplier = -3` 后 30 日 `peasant` 净流入显著上升；(b) 对农田设置 `businessTaxRate = -2` 后 30 日 `peasant` 雇员空缺率显著下降；(c) 撤销补贴后下一 tick `potentialIncome` 立即回落
   - _需求：4.1、4.2、4.3、成功标准 1–4_
