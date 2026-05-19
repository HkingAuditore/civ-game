# 实施计划：修复AI国家发展停滞问题

- [ ] 1. 剥离 `updateNationEconomy` 中对 AI 国家 wealth/population 的直接修改
  - 在 `nations.js` 的 `updateNationEconomy` 函数中：
    - 移除 wealth drift 逻辑（约 line 1270-1310 的 `adjustedWealth` 计算和 `nation.wealth = ...` 赋值）
    - 移除战时人口扣减逻辑（约 line 1264 的 `nation.population = Math.max(3, ...)` 赋值）
    - 移除 `nation.economyTraits.lastGrowthTick = tick` 赋值（约 line 1256），该字段由 `AIEconomyService` 独占管理
    - 保留：`economyTraits` 初始化（首次）、`desiredPopulation`/`desiredWealth` 目标值计算、GDP 平滑、budget 更新
  - 同步移除 `nation._lastWealth` 赋值（GDP 计算改为使用 `AIEconomyService` 输出的 `gdp`）
  - _需求：1.1, 1.2, 1.3, 1.4_

- [ ] 2. 确保 `AIEconomyService` 独立处理战时经济惩罚
  - 在 `AIDevelopmentService.update` 中确认战时逻辑已完整覆盖：
    - 战时人口伤亡：检查 `populationDynamics` 中的 `warRecovery` 因子是否正确降低增长率
    - 战时财富损耗：检查 `warLoss` 计算（当前 `maintenanceCost * 0.55 + nextPopulation * 0.006`）是否合理
  - 如果 `AIPopulationDynamics.js` 中的战时惩罚不足，补充战时人口下降逻辑（确保与移除的 `updateNationEconomy` 战时扣减等效）
  - _需求：1.3_

- [ ] 3. 修复建筑目标公式中的人口单位问题
  - 在 `warEconomy.js` 的 `getAIBuildingTargetTotal` 函数中：
    - 确认 `actualPop` 的单位（万人 vs 绝对值），当前 `pop / 6.5` 在人口 2.9亿（即 `actualPop=29000` 万人单位或 `290000000` 绝对值）下产出差异巨大
    - 如果 `actualPop` 是万人单位（29000），则 `29000 / 6.5 ≈ 4461` 个建筑，受 epoch cap 120 限制 → 120 个建筑（合理）
    - 如果 `actualPop` 是绝对值（290000000），则 `290000000 / 6.5 ≈ 44615384`，受 epoch cap 120 限制 → 120 个建筑（也合理但公式冗余）
    - 根据实际单位调整公式，确保建筑数量与人口规模合理匹配
  - 检查 `AI_BUILDING_EPOCH_CAPS` 是否需要根据人口规模动态调整
  - _需求：2.1, 2.2_

- [ ] 4. 为 AI 国家添加基于人口的最低经济产出保底
  - 在 `AIDevelopmentService.update` 的财富计算部分：
    - 在 `grossSavingsFlow` 计算后，添加基于人口的 subsistence income 保底：`subsistenceIncome = nextPopulation * targetPerCapita * 0.003 * tickScale`
    - 当 `grossSavingsFlow < subsistenceIncome` 时，使用 `subsistenceIncome` 作为最低值
  - 确保 `savingsRate` 最低值从当前的 `0.08` 保持不变（已满足需求 4.3 的 5% 要求）
  - _需求：4.1, 4.2, 4.3_

- [ ] 5. 统一财富 cap 体系，移除 `updateNationEconomy` 中的独立 cap
  - 在任务 1 中移除 wealth drift 后，`updateNationEconomy` 中的 `perCapitaWealthCapForDrift`（2000 × 2^epoch）自然失效
  - 确认 `AIEconomyService._normalizeLegacyOutliers` 中的 `perCapitaCap`（来自 `aiEconomyConfig.js`：epoch 0=120）作为唯一的硬上限
  - 确认 `AIDevelopmentService.update` 中的 `getPerCapitaWealthCap(epoch)` 用于 `nextWealth` 计算的 cap
  - 验证 epoch 0 的 cap=120 是否过低（人口 29000 × 120 = 348万财富上限），如果过低则适当上调 `aiEconomyConfig.js` 中的 `perCapitaCaps` 值
  - _需求：3.1, 3.2, 3.3_

- [ ] 6. 添加建筑惯性机制防止建筑数量随人口下降而骤减
  - 在 `warEconomy.js` 或建筑扩展相关逻辑中：
    - 记录上一次的建筑目标数量到 `nation.economyTraits.lastBuildingTarget`
    - 当新目标 < 上次目标时，限制每次更新最多减少 10%：`newTarget = Math.max(newTarget, Math.round(lastTarget * 0.9))`
    - 确保建筑惯性不会导致建筑数量超过 epoch cap
  - _需求：4.4_

- [ ] 7. 确保旧存档兼容性和平滑过渡
  - 在 `AIEconomyService._normalizeLegacyOutliers` 中：
    - 确认 `lastGrowthTick` 哨兵值 `-1` 的处理逻辑正确（已有：`state.lastGrowthTick = Math.max(0, tick - updateInterval)`）
    - 添加对 `economyTraits.lastGrowthTick` 被旧系统污染的检测：如果 `lastGrowthTick` 与当前 tick 差值 < `updateInterval` 但 `lastUpdateTick` 未设置，重置为 `tick - updateInterval`
  - 在 `updateNationEconomy` 的 `economyTraits` 初始化中，确保不再设置 `lastGrowthTick`（改为由 `AIEconomyService` 首次运行时设置）
  - _需求：5.4_

- [ ] 8. 验证修复效果并添加诊断日志
  - 在 `AIEconomyService.update` 中添加低频诊断日志（每 100 tick）：
    - 输出 `nation.name`、`population`、`wealth`、`wealthDelta`、`carryingCapacity`、`buildingCount`、`savingsRate`
    - 仅对附庸国或前 3 个 AI 国家输出，避免日志洪泛
  - 运行 `npm run build` 验证编译通过
  - _需求：5.1, 5.2, 5.3_
