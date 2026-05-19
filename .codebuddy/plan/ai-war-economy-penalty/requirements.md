# 需求文档：AI战时经济惩罚真实化

## 引言

当前战争经济面板中，**敌方的经济惩罚数据（生产效率损失、税收效率损失、本土压力等）全部是"假的"**——它们被正确计算并显示在UI上，但**没有任何机制将这些惩罚真正作用到AI国家的经济系统上**。

### 问题分析

从代码追踪发现以下结构性缺陷：

1. **`getFrontlineEconomicModifiers` 只为玩家生效**：在 `simulation.js` 中，该函数只以 `'player'` 为参数调用，计算结果（`frontlineProductionPenalty`、`frontlineTaxEfficiencyPenalty`）被应用到玩家的生产系统。**从未为AI国家调用并应用**。

2. **`FrontViewPanel.jsx` 中的敌方数据纯粹是UI展示**：面板为敌方调用 `getFrontlineEconomicModifiers(frontContext, enemyId, ...)` 计算了生产效率损失80%、税收效率损失85%等数值，但这些数值**只用于渲染进度条**，不反馈到AI国家的 `wealth`、`gdp`、`population` 或任何经济属性上。

3. **AI-AI战争有经济衰减，玩家-AI战争没有**：`processAIAIWarProgression` 中有完整的每tick经济衰减机制（`nationWealthDecay`、`warExpense`、`applyFrontlinePopulationCasualties`），但该函数只处理AI-AI战争。当 `enemyId='player'` 时，`updatedNations.find(n => n.id === enemyId)` 找不到玩家，战争被跳过。

4. **AI经济增长系统的战争惩罚不感知战线位置**：`getAIWarGrowthRetention` 只基于 `isAtWar` 标志返回 0.50~0.72 的保留率（减少28%~50%增长），**不考虑战线已推到核心区、经济破坏116、本土压力100的事实**。

### 后果

玩家将战线推到95%、经济破坏116、本土压力100，但AI国家：
- 经济照常增长（只减少28%~50%）
- 人口照常增长
- 军队持续回填到满编
- 面板上显示的"生产效率损失80%"、"税收效率损失85%"完全是装饰性数字

---

## 需求

### 需求 1：将战线经济惩罚真实应用到AI国家

**用户故事：** 作为一名玩家，我希望战争经济面板上显示的敌方经济惩罚（生产效率损失、税收效率损失）能够真正影响AI国家的经济，以便我的军事推进能够转化为对敌国的实际经济打击。

#### 验收标准

1. WHEN 玩家-AI战线处于活跃状态 THEN 系统 SHALL 每tick为AI国家计算战线经济惩罚，使用与UI显示相同的 `getFrontlineEconomicModifiers` 函数
2. WHEN AI国家的战线经济惩罚被计算后 THEN 系统 SHALL 将 `productionPenalty` 转化为AI国家的 `wealth` 衰减：`wealthLoss = wealth × productionPenalty × decayFactor`，其中 `decayFactor` 为每tick的衰减转化系数（建议0.02，即每tick将生产损失的2%转化为实际wealth损失）
3. WHEN AI国家的战线经济惩罚被计算后 THEN 系统 SHALL 将 `taxEfficiencyPenalty` 转化为AI国家的 `gdp` 增长抑制：AI的GDP增长率乘以 `(1 - taxEfficiencyPenalty)` 的保留系数
4. WHEN 多条战线同时存在 THEN 系统 SHALL 累加各战线的经济惩罚，但总惩罚不超过上限（productionPenalty ≤ 0.90，taxEfficiencyPenalty ≤ 0.95）
5. WHEN AI国家的wealth因战线经济惩罚降低 THEN 系统 SHALL 确保wealth不低于100（与现有wealth下限一致）

### 需求 2：AI经济增长系统感知战线位置

**用户故事：** 作为一名玩家，我希望当我将战线推入敌方核心区时，AI国家的经济增长应该大幅下降甚至变为负增长，以便持续的军事压力能够从根本上削弱敌国国力。

#### 验收标准

1. WHEN AI国家处于战争状态且战线位于其领土内 THEN 系统 SHALL 根据战线位置动态调整AI经济增长保留率，而非使用固定的 `isAtWar` 惩罚
2. WHEN 战线位于AI边境区（50%~65%）THEN 系统 SHALL 将AI经济增长保留率设为 0.60（减少40%增长）
3. WHEN 战线位于AI经济区（65%~85%）THEN 系统 SHALL 将AI经济增长保留率设为 0.30（减少70%增长）
4. WHEN 战线位于AI核心区（85%~100%）THEN 系统 SHALL 将AI经济增长保留率设为 0.10（减少90%增长），使AI经济接近停滞
5. WHEN 战线位于AI极端位置（>92%）THEN 系统 SHALL 将AI经济增长保留率设为 0.0，并额外施加GDP负增长（每tick GDP × -0.5%），模拟国家经济崩溃
6. WHEN 多条战线同时存在 THEN 系统 SHALL 取最严重的战线位置作为惩罚基准（取最低保留率）
7. WHEN AI国家不处于战争状态或战线位于中线以外 THEN 系统 SHALL 保持现有的经济增长率不变

### 需求 3：本土压力影响AI人口增长和稳定性

**用户故事：** 作为一名玩家，我希望当敌国本土压力达到100时，AI国家的人口增长应该停滞甚至下降，以便持续的战争压力能够削弱敌国的人力储备。

#### 验收标准

1. WHEN AI国家的本土压力 > 0 THEN 系统 SHALL 将本土压力转化为人口增长抑制：人口增长率乘以 `(1 - homelandPressure / 120)` 的保留系数
2. WHEN AI国家的本土压力 ≥ 100 THEN 系统 SHALL 完全停止AI人口自然增长，并施加每tick人口衰减（`population × 0.0003`），模拟战争难民和平民伤亡
3. WHEN AI国家的本土压力 ≥ 80 THEN 系统 SHALL 降低AI的 `sustainableArmy` 目标（乘以 `(1 - (homelandPressure - 80) / 40)`），使AI在高压力下无法维持满编军队
4. WHEN 本土压力降低（如战线后退）THEN 系统 SHALL 逐步恢复人口增长和军队目标，恢复速度为每tick恢复1%的差值

### 需求 4：AI战时wealth持续衰减（对齐AI-AI战争机制）

**用户故事：** 作为一名玩家，我希望与AI的战争能够像AI-AI战争一样消耗AI的国力，以便玩家-AI战争和AI-AI战争在经济影响上保持一致。

#### 验收标准

1. WHEN 玩家-AI战线处于活跃状态 THEN 系统 SHALL 每tick对AI国家施加基础战时wealth衰减，衰减率与AI-AI战争中的 `nationWealthDecay`（0.997/tick，即0.3%/tick）保持一致
2. WHEN 战线深入AI领土 THEN 系统 SHALL 根据入侵深度增加额外衰减：
   - 边境区（50%~65%）：额外 +0.1%/tick
   - 经济区（65%~85%）：额外 +0.3%/tick
   - 核心区（85%~100%）：额外 +0.8%/tick
3. WHEN AI国家处于战争状态 THEN 系统 SHALL 每tick扣除战争开支：`warExpense = GDP × 0.1%`（与AI-AI战争中的 `warExpense` 计算方式一致）
4. WHEN AI国家的wealth因衰减降至安全阈值以下（`wealth < population × 0.3`）THEN 系统 SHALL 触发AI的"经济崩溃"状态，大幅降低 `sustainableArmy` 目标（乘以0.5），迫使AI裁军或求和
5. WHEN AI国家的wealth衰减后 THEN 系统 SHALL 确保wealth不低于100

---

## 边界情况与技术约束

### 边界情况

1. **AI同时与玩家和其他AI开战**：玩家-AI战线的经济惩罚与AI-AI战争的经济衰减应叠加，但总衰减率有上限（wealth衰减率 ≤ 5%/tick），防止AI瞬间破产
2. **战线刚开启时**：战线位置为50%（中线），此时只有基础战时衰减（0.3%/tick），不会有额外的领土惩罚
3. **战线来回拉锯**：经济惩罚应基于当前战线位置实时计算，战线后退时惩罚自动减轻
4. **AI国家wealth已经很低**：wealth下限为100，低于此值不再扣减；同时 `sustainableArmy` 会因wealth不足而自然降低
5. **多条战线叠加**：每条战线独立计算惩罚，然后累加到AI国家上，但有总上限防止极端情况
6. **和平后恢复**：战争结束后，所有战线经济惩罚立即停止，AI经济按正常增长率恢复

### 性能约束

1. 战线经济惩罚计算复用现有的 `getFrontlineEconomicModifiers` 函数，不引入新的计算逻辑
2. AI经济衰减在现有的战线处理循环中内联计算，不引入新的遍历
3. 所有AI国家状态变更通过单次 `setNations` 批量更新，不额外增加渲染周期
4. 本土压力值直接从战线的 `homelandPressure` 字段读取，不重复计算

### 涉及文件

- `src/hooks/useGameLoop.js` — 战线处理循环中添加AI经济惩罚应用逻辑（需求1、4）
- `src/logic/diplomacy/aiEconomy.js` — 修改 `getAIWarGrowthRetention` 使其感知战线位置（需求2）
- `src/logic/diplomacy/aiWar.js` — `syncAINationMilitary` 中根据本土压力调整 `sustainableArmy`（需求3）
- `src/logic/simulation.js` — AI人口增长逻辑中加入本土压力抑制（需求3）
