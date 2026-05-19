# 需求文档：AI-AI 战争分数僵死修复

## 引言

当前 AI-AI 战争系统存在严重的分数僵死问题：两个 AI 国家之间的战争可以持续 30000+ 天（约90年），但战争分数始终为 0 分，导致战争永远无法结束。

**根因分析**：

问题由多个因素叠加导致：

1. **tick 频率与模运算不匹配**：`processAIAIWarProgression` 每 7 个 tick 才执行一次（`aiDecisionFrequency: 7`），但 occupation score 使用 `warDuration % 5 === 0`、attrition score 使用 `warDuration % 15 === 0` 作为触发条件。由于 7 和 5/15 的最小公倍数分别是 35 和 105，实际触发频率远低于设计意图（occupation 每35天一次而非5天，attrition 每105天一次而非15天）。

2. **均势战线无法积累分数**：当双方实力相当时，战线在 50±2 范围内震荡。occupation score 要求 `Math.abs(posOffset) > 2` 才触发，checkpoint crossing 需要跨越 [15, 35, 50, 65, 85] 这些固定点。战线在中线附近来回拉锯时，只有 50 这个 checkpoint 可能被反复跨越，但正反方向的分数互相抵消。

3. **战争结束条件依赖分数**：战争结束需要 `absoluteWarScore >= endScoreThreshold`（最低 30~40 分），或者通过 exhaustion 概率结束（基础仅 0.5%~3%）。当分数始终为 0 时，只能依赖极低的随机概率结束战争。

4. **战争疲劳积累过慢**：`warFatigue` 的增长依赖于军力损失率和财富损失率，但 AI 国家的 wealth 有 100 的下限保护，且 `fatigueDelta` 每次增量极小（通常 < 0.01），导致疲劳需要数千天才能达到阈值。

## 需求

### 需求 1：修复 tick 频率与分数触发条件的不匹配

**用户故事：** 作为一名玩家，我希望 AI-AI 战争的分数能按设计频率正常累积，以便战争能在合理时间内产生有意义的分数变化。

#### 验收标准

1. WHEN AI-AI 战争进行中且 `processAIAIWarProgression` 被调用 THEN 系统 SHALL 使用基于实际调用次数的计数器（而非 `warDuration % N`）来触发 occupation score 和 attrition score 的计算，确保不受 tick 频率影响。
2. WHEN occupation score 触发条件满足 THEN 系统 SHALL 按照每 5 天（实际游戏天数）的设计意图累积分数，而非受限于 7-tick 调用周期与 5 的最小公倍数。
3. WHEN attrition score 触发条件满足 THEN 系统 SHALL 按照每 15 天的设计意图累积分数。

### 需求 2：为均势战争引入持续分数积累机制

**用户故事：** 作为一名玩家，我希望即使 AI-AI 战争处于均势僵持状态，战争分数也能缓慢积累，以便战争最终能够产生胜负结果。

#### 验收标准

1. WHEN 战线位置在 48~52 范围内（均势区）且战争持续超过 30 天 THEN 系统 SHALL 仍然为实力略占优势的一方（或随机一方）每次调用累积少量分数（如 ±1 分），模拟消耗战的此消彼长。
2. WHEN 战线位置偏离中线不足 2 点但战争已持续超过 100 天 THEN 系统 SHALL 降低 occupation score 的偏移阈值（如从 >2 降至 >0），确保微小优势也能转化为分数。
3. WHEN checkpoint 50 被反复跨越 THEN 系统 SHALL 不因方向交替而完全抵消分数，而是保留净分数的绝对值增长趋势（如每次跨越给优势方额外 +1 分）。

### 需求 3：加速长期战争的结束机制

**用户故事：** 作为一名玩家，我希望持续过久的 AI-AI 战争能通过疲劳或外交机制自然结束，以便游戏世界不会出现持续数十年的无意义战争。

#### 验收标准

1. WHEN AI-AI 战争持续超过 365 天（1年）THEN 系统 SHALL 显著提高 exhaustion 结束概率（如从基础 0.5% 提升到 5%+），且概率随持续时间递增。
2. WHEN AI-AI 战争持续超过 730 天（2年）且分数绝对值仍低于 endScoreThreshold 的 50% THEN 系统 SHALL 强制降低 endScoreThreshold 至当前分数绝对值 + 10，确保战争能在合理时间内结束。
3. WHEN 战争疲劳（warFatigue）计算时 THEN 系统 SHALL 确保每次调用的最低增量不低于 0.002，避免疲劳增长过慢导致永远无法达到阈值。
4. IF 战争持续超过 1095 天（3年）THEN 系统 SHALL 强制结束战争，以当前 warScore 判定胜负（0 分视为平局）。

### 需求 4：确保 UI 正确显示 AI-AI 战争分数

**用户故事：** 作为一名玩家，我希望在查看 AI 国家详情时能看到准确的战争分数和战况信息，以便了解 AI 之间的战争进展。

#### 验收标准

1. WHEN 玩家查看某个 AI 国家的详情页 THEN 系统 SHALL 显示该国与其他 AI 国家战争的实时 warScore（从 `nation.foreignWars[enemyId].warScore` 读取）。
2. WHEN AI-AI 战争分数为 0 且战争持续超过 30 天 THEN 系统 SHALL 在 UI 中显示"僵持"标签，而非仅显示"0 分"，帮助玩家理解战况。
3. WHEN AI-AI 战争详情展开时 THEN 系统 SHALL 显示分数明细（checkpoint / bonus / occupation / attrition），帮助玩家理解分数来源。

### 需求 5：防止 checkpoint 50 分数互相抵消

**用户故事：** 作为一名玩家，我希望 AI-AI 战争中战线在中线附近拉锯时不会因为反复跨越同一 checkpoint 而导致分数完全抵消，以便均势战争也能产生有意义的分数变化。

#### 验收标准

1. WHEN 同一 checkpoint 在短时间内（如 30 天内）被反复跨越 THEN 系统 SHALL 对重复跨越的分数进行衰减（如第二次 50%、第三次 25%），避免完全抵消但也防止刷分。
2. WHEN checkpoint 50 被跨越 THEN 系统 SHALL 给予较低的基础分数（如 2~3 分而非 5 分），因为中线附近的拉锯是常态而非战略突破。
