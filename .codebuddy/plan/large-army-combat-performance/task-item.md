# 实施计划：超大兵团对战性能优化

- [ ] 1. 重写 `calculateCounterBonus` — 改用兵种比例 + 类别矩阵
  - 修改文件：`src/config/militaryUnits.js`
  - 在 `calculateCounterBonus` 函数中，将 `weight = (attackerCount * defenderCount) / 100` 替换为基于兵种比例的计算：先按 category（infantry/cavalry/archer/gunpowder/siege）聚合双方各类别的兵力占比（0~1），再用 5×5 类别克制矩阵计算加权 multiplier
  - 新增一个 `CATEGORY_COUNTER_MATRIX` 常量对象，定义 5 个类别之间的克制系数（从现有 `UNIT_COUNTERS` 中提取并归纳）
  - 确保 multiplier 输出始终在 [0.80, 1.45] 范围内（与现有 clamp 一致）
  - 兵力为 0 或无有效兵种时返回 `{ multiplier: 1.0, counterCount: 0, counters: {} }`
  - _需求：1.1、1.2、1.3、1.4_

- [ ] 2. 为 `buildCategoryProfile` 和 `calculateSideStrength` 添加缓存复用机制
  - 修改文件：`src/config/militaryUnits.js`
  - 在 `calculateSideStrength` 中，将 `buildCategoryProfile` 的结果存入局部变量，避免同一回合内对同一方重复构建 profile
  - 确保 `calculateCounterBonus` 可以直接接收已构建的 profile 对象（新增可选参数或在调用前预构建）
  - _需求：5.2、5.3_

- [ ] 3. 为 `buildCategoryProfile` 添加大数值缩放保护
  - 修改文件：`src/config/militaryUnits.js`
  - 在 `buildCategoryProfile` 中，当兵力总数超过 1,000,000 时，对 attack/defense 的中间计算引入缩放因子（如除以 `scaleFactor = Math.max(1, Math.floor(totalUnits / 100000))`），最终结果再还原
  - 在 `calculatePhaseOutcome` 中，确保兰彻斯特模型的 `rawAttackerLoss` 和 `rawDefenderLoss` 不超过当前兵力总数，添加 `Math.min(loss, totalUnits)` 保护
  - _需求：6.1、6.3、6.4_

- [ ] 4. 修复 `calculateRoundSupplyCost` 的大数值溢出
  - 修改文件：`src/logic/diplomacy/battleSystem.js`
  - 在 `calculateRoundSupplyCost` 中，当 `totalUnits > 1,000,000` 时，对补给计算进行分段处理或添加合理上限 cap，防止产生不合理的天文数字补给需求
  - _需求：6.2_

- [ ] 5. 在 `useGameLoop.js` 战斗处理段预构建 Map 索引
  - 修改文件：`src/hooks/useGameLoop.js`
  - 在军事处理循环开始前，预构建 `corpsById = new Map(updatedCorps.map(c => [c.id, c]))`、`frontById = new Map(currentActiveFronts.map(f => [f.id, f]))`、`nationById = new Map(current.nations.map(n => [n.id, n]))` 三个索引
  - 将循环内所有 `.find(c => c.id === ...)` 调用替换为 `corpsById.get(id)`，`.find(n => n.id === ...)` 替换为 `nationById.get(id)`
  - 当 corps/front 数组发生变更（如伤亡扣减后）时，同步更新对应 Map 条目
  - _需求：4.1、4.2、4.3、4.4_

- [ ] 6. 实现 `summarizeFrontState` 的 tick 级缓存
  - 修改文件：`src/logic/diplomacy/frontSystem.js` 和 `src/hooks/useGameLoop.js`
  - 在 `frontSystem.js` 中新增一个模块级缓存对象 `_frontStateCache = { tick: -1, cache: new Map() }`
  - 包装 `summarizeFrontState` 为带缓存版本：接收当前 tick 号，若 tick 号与缓存一致且 cache 中有该 frontId 的结果则直接返回，否则计算并存入 cache
  - 在 `useGameLoop.js` 中，每 tick 军事处理开始时传入当前 tick 号以触发缓存失效
  - _需求：2.1、2.2、2.3_

- [ ] 7. 优化 `processCombatRound` 的非结算日执行路径
  - 修改文件：`src/logic/diplomacy/battleSystem.js`
  - 在 `processCombatRound` 中，当 `phaseDaysRemaining > 0`（非阶段结算日）时，跳过 `calculatePhaseOutcome` 和额外的 `applyLosses` 调用，仅执行每日伤亡计算
  - 确保 `calculateSideStrength` 的结果（attackScore、defenseScore）被缓存到 battle 对象上，供每日伤亡计算直接使用，避免每日重新遍历兵种
  - _需求：5.1、5.2、5.3_

- [ ] 8. 重写摩擦战伤亡分配算法为按比例一次性分配
  - 修改文件：`src/hooks/useGameLoop.js`
  - 将 L3929 附近的 `while (remaining > 0 && passes < 5)` 循环替换为按比例分配算法：
    1. 计算各军团兵力占总兵力的比例
    2. 按比例将总伤亡一次性分配到各军团（`Math.floor(totalLoss * ratio)`）
    3. 余数分配给兵力最多的军团
  - 军团内部的兵种扣减也改为按兵种数量比例分配，替代随机选择单个兵种扣减
  - 确保时间复杂度为 O(军团数 × 兵种数)
  - _需求：3.1、3.2、3.3、3.4_

- [ ] 9. 集成验证 — 确保小兵力场景下战斗结果不变
  - 修改文件：涉及上述所有修改文件
  - 在小兵力场景（双方各 1000~10000 兵力）下，对比优化前后的 `calculateCounterBonus` 返回值、`calculateSideStrength` 返回值、`processCombatRound` 的伤亡结果，确保数值差异在可接受范围内（<1%）
  - 在超大兵力场景（1000万 vs 200万）下，验证单 tick 军事处理时间 <50ms，且 `multiplier` 在 [0.80, 1.45] 范围内
  - 运行 `npm run build` 确保无编译错误
  - _需求：成功标准全部_
