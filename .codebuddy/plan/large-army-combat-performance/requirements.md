# 需求文档：超大兵团对战性能优化

## 引言

当玩家在后期拥有数百万甚至上千万兵力时（如截图中我方 ~1000万兵力 4个军团 vs 敌方 ~208万兵力 1个军团），战斗系统的每 tick 运算量急剧增加，导致游戏主线程卡死。

经过对 `battleSystem.js`、`militaryUnits.js`、`frontSystem.js` 和 `useGameLoop.js` 的深度代码审查，识别出以下性能瓶颈：

1. **`calculateCounterBonus` 数值溢出**：`weight = (attackerCount * defenderCount) / 100` 在超大兵团时产生天文数字（如 `9,999,846 × 2,076,278 / 100 ≈ 2×10¹¹`），导致 `bonusMultiplier` 被加到数十亿级别，完全失去克制系数的意义，同时浮点运算量暴增。
2. **`summarizeFrontState` 每 tick 重复全量计算**：每个活跃战线每 tick 都调用 `summarizeFrontState`，内部调用 `getRoleWeightedStrength` 8次 + `aggregateArmyFromCorps` + `calculateArmyMaintenance` + `buildResourceCoverage`，全部遍历所有军团所有兵种。
3. **摩擦战伤亡分配的随机逐单位循环**：`useGameLoop.js` L3929 的 `while (remaining > 0 && passes < 5)` 循环，在大伤亡量时效率低下且分配不均匀。
4. **`useGameLoop.js` 中大量 `.find()` / `.filter()` 线性查找**：在战斗处理循环中，对 `updatedCorps`、`currentActiveFronts`、`current.nations` 等数组进行重复线性查找。
5. **`processCombatRound` 中每日+阶段双重 `buildCategoryProfile` 和 `calculateCounterBonus` 调用**：每个战斗回合调用 `calculateSideStrength` 两次（双方），每次内部都重建 profile 和计算克制。

## 需求

### 需求 1：修复 `calculateCounterBonus` 的数值溢出与性能问题

**用户故事：** 作为一名玩家，我希望兵种克制系统在超大兵团时仍然正确工作，以便战斗结果合理且不会因数值溢出导致卡顿。

#### 验收标准

1. WHEN 双方兵力总和超过 100,000 THEN `calculateCounterBonus` SHALL 使用**兵种比例**而非**绝对数量**计算克制权重，确保 `multiplier` 始终在合理范围内（如 0.80~1.45）。
2. WHEN `calculateCounterBonus` 被调用 THEN 系统 SHALL 先按 category（infantry/cavalry/archer/gunpowder/siege）聚合双方兵力比例，再基于 5×5 类别矩阵计算克制，而非遍历所有 unitId×unitId 对。
3. WHEN 优化后的 `calculateCounterBonus` 返回结果 THEN `multiplier` 的数值范围 SHALL 与当前 `calculateSideStrength` 中的 `clamp(0.80, 1.45)` 保持一致，不改变战斗平衡。
4. IF 兵力为 0 或无有效兵种 THEN `calculateCounterBonus` SHALL 返回 `{ multiplier: 1.0, counterCount: 0, counters: {} }`。

### 需求 2：优化 `summarizeFrontState` 的重复计算

**用户故事：** 作为一名玩家，我希望战线状态计算不会在每个 tick 重复执行全量遍历，以便大规模战争时游戏保持流畅。

#### 验收标准

1. WHEN `processFrontAdvance` 或 `useGameLoop.js` 中的战斗处理需要 front state THEN 系统 SHALL 在同一 tick 内缓存 `summarizeFrontState` 的结果，避免对同一战线重复调用。
2. WHEN 同一 tick 内多个代码路径（战斗上下文构建、战线推进、摩擦战）需要同一战线的 summary THEN 系统 SHALL 复用已计算的 summary 对象。
3. WHEN 缓存被使用 THEN 系统 SHALL 确保缓存仅在当前 tick 有效，下一 tick 自动失效，不引入陈旧数据。

### 需求 3：优化摩擦战伤亡分配算法

**用户故事：** 作为一名玩家，我希望摩擦战的伤亡能快速且均匀地分配到各军团，以便超大兵团时不会因分配循环导致卡顿。

#### 验收标准

1. WHEN 摩擦战产生伤亡需要分配到多个军团 THEN 系统 SHALL 使用**按兵力比例一次性分配**的算法，替代当前的 `while/for` 随机逐单位循环。
2. WHEN 按比例分配后存在余数 THEN 系统 SHALL 将余数分配给兵力最多的军团，而非进行额外循环。
3. WHEN 军团内部需要扣减兵种 THEN 系统 SHALL 按兵种数量比例分配损失，而非随机选择单个兵种扣减。
4. WHEN 优化后的分配算法执行 THEN 其时间复杂度 SHALL 为 O(军团数 × 兵种数)，而非 O(伤亡数)。

### 需求 4：消除战斗处理循环中的重复线性查找

**用户故事：** 作为一名玩家，我希望战斗处理循环中的数据查找是高效的，以便多条战线同时活跃时游戏不会卡顿。

#### 验收标准

1. WHEN 战斗回合处理开始 THEN 系统 SHALL 预构建 `corpsById`（Map）和 `frontById`（Map）索引，替代循环内的 `.find()` 调用。
2. WHEN 摩擦战处理需要查找军团 THEN 系统 SHALL 使用预构建的 Map 索引，而非 `updatedCorps.find(c => c.id === id)`。
3. WHEN 需要查找 nation THEN 系统 SHALL 使用预构建的 `nationById` Map，而非 `current.nations.find(n => n.id === ...)`。
4. WHEN 索引被构建 THEN 系统 SHALL 确保索引在 corps/front/nation 数组更新后同步更新。

### 需求 5：减少 `processCombatRound` 中的冗余计算

**用户故事：** 作为一名玩家，我希望每个战斗回合的计算量最小化，以便多场会战同时进行时游戏保持流畅。

#### 验收标准

1. WHEN `processCombatRound` 在非阶段结算日执行（`phaseDaysRemaining > 0`）THEN 系统 SHALL 仅执行每日伤亡计算，跳过阶段结算相关的 `calculatePhaseOutcome` 和额外的 `applyLosses` 调用。
2. WHEN `calculateSideStrength` 被调用 THEN 系统 SHALL 复用已构建的 `buildCategoryProfile` 结果，避免在同一回合内对同一方重复构建 profile。
3. WHEN 战斗回合的每日伤亡计算执行 THEN 系统 SHALL 直接使用 `calculateSideStrength` 已计算的 `attackScore` 和 `defenseScore`，而非重新遍历兵种计算。

### 需求 6：防止超大数值导致的浮点精度问题

**用户故事：** 作为一名玩家，我希望战斗系统在任何兵力规模下都能产生合理的数值结果，以便游戏体验不受数值溢出影响。

#### 验收标准

1. WHEN `buildCategoryProfile` 计算 `attack` 和 `defense` 总值 THEN 系统 SHALL 确保中间计算不超过 JavaScript 安全整数范围（`Number.MAX_SAFE_INTEGER`），必要时使用缩放因子。
2. WHEN 兵力超过 1,000,000 THEN `calculateRoundSupplyCost` 中的 `Math.ceil(totalUnits * BASE_SUPPLY_COST.food * plan.supply)` SHALL 不产生超过合理范围的补给需求值。
3. WHEN `calculatePhaseOutcome` 中的兰彻斯特模型计算 `rawAttackerLoss` 和 `rawDefenderLoss` THEN 系统 SHALL 确保损失值不超过当前兵力总数，且 `stochasticRound` 的输入值在合理范围内。
4. IF 任何战斗计算的中间值超过 `1e12` THEN 系统 SHALL 使用对数缩放或分段计算来避免精度丢失。

## 技术约束

- 所有优化必须在现有文件中进行修改，不创建新的并行系统
- `calculateCounterBonus` 的接口签名保持不变（接收两个 army 对象，返回 `{ multiplier, counterCount }` + 可选的 `counters` 字段）
- 战斗结果的数值平衡不应因优化而发生显著变化（小兵力场景下结果应与优化前一致）
- 优化不应影响存档兼容性

## 成功标准

- 在 1000万 vs 200万 兵力规模下，单个 tick 的军事处理时间从当前的卡死（>1000ms）降低到 <50ms
- `calculateCounterBonus` 的 `multiplier` 在任何兵力规模下都保持在 [0.80, 1.45] 范围内
- 摩擦战伤亡分配从 O(伤亡数) 降低到 O(军团数 × 兵种数)
- 同一 tick 内 `summarizeFrontState` 对同一战线最多调用 1 次
