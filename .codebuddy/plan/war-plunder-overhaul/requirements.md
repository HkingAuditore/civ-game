# 需求文档：战争掠夺机制优化（War Plunder Overhaul）

## 引言

当前 civ-game 的战线系统（frontSystem + warEconomy）在掠夺机制上存在明显的不对称性和不完整性：

**现状问题：**

1. **玩家→AI 掠夺过强且单向**：玩家推入敌方经济区/核心区后，每 tick 持续通过 `calculateWarPlunder` 抽取敌方 wealth 转化为银币（经济区 5%/tick、核心区 10%/tick），同时通过 `plunderResourceNode` 获取实物资源节点——但 AI 推入玩家领土时**完全没有对等的银币/资源掠夺**，只有建筑损毁和人口流失。
2. **AI-AI 战争掠夺残缺**：AI 对 AI 仅在 checkpoint crossing 时有 40% 的 wealth 转移（`attackerNation.wealth += wealthDmg * 0.4`），缺乏持续占领掠夺，导致 AI 之间战争的经济消耗不够真实。
3. **掠夺品种单一**：战线掠夺只涉及 wealth/silver，不涉及实物资源（food、iron、wood 等），与旧军事行动系统（`MILITARY_ACTIONS` 配置了丰富的 lootConfig）形成割裂。
4. **缺乏玩家受害反馈**：AI 打入玩家经济区/核心区时，玩家感受不到"被掠夺"的紧迫感——没有银币直接减少的心理冲击，也没有醒目的 UI 提示。

**设计目标：**

让战线掠夺成为一个**双向对称、多资源类型、三场景统一**的系统：
- **双向**：AI 打入玩家领土时，玩家的银币和实物资源会被持续掠夺，形成"战线=经济前线"的紧迫感
- **多资源**：掠夺品不仅限于银币，还包括战区相关的实物资源（food、iron、wood 等），增加掠夺的丰富度
- **统一**：玩家→AI、AI→玩家、AI→AI 三种场景共用同一套掠夺计算逻辑（`calculateWarPlunder` 的扩展），只是消费端不同
- **有感知**：玩家被掠夺时有明显的 UI 反馈（日志、数值变红等），创造"打不赢就该求和"的决策压力

**保守原则：**
- 不新建子系统，所有逻辑在现有 `warEconomy.js` / `frontSystem.js` / `aiWar.js` / `useGameLoop.js` 中扩展
- 不改变战线的基本数据模型（zone/checkpoint/linePosition），仅在经济层叠加掠夺逻辑
- AI 掠夺玩家的力度应比玩家掠夺 AI 稍弱（AI 不够"聪明"，掠夺效率低），避免新手劝退
- 掠夺率走 `gameConstants.js` 的 `WAR_ECONOMY` 配置，便于后续调参

---

## 需求

### 需求 1：反向掠夺——AI 持续掠夺玩家银币

**用户故事：** 作为一名玩家，我希望当 AI 推入我的经济区/核心区时，我的银币会被持续掠夺，以便我感受到战线失利的经济代价，产生"必须反击或求和"的决策压力。

#### 验收标准

1.1 WHEN AI 军队占领玩家的经济区（linePosition 对玩家方 relativePosition < 35）THEN 系统 SHALL 每次摩擦 tick 从玩家银币中扣减 `silver × PLUNDER_RATE_ECONOMIC × enemyRaidMod × unitRatioBonus`，其中 unitRatioBonus 的计算方式与现有 `calculateWarPlunder` 一致。

1.2 WHEN AI 军队占领玩家的核心区（relativePosition < 15）THEN 系统 SHALL 使用 `PLUNDER_RATE_CAPITAL` 替代经济区掠夺率，掠夺强度更高。

1.3 IF 玩家当前银币不足以覆盖掠夺量 THEN 系统 SHALL 将掠夺量上限设为当前银币的 80%（保留最低生存银币），并将不足部分转为等值的食物/木材扣减。

1.4 WHEN 玩家被掠夺银币时 THEN 系统 SHALL 在战斗日志中添加红色醒目日志，格式为 `"💸 敌军掠夺了我方 {amount} 银币"`。

1.5 系统 SHALL 为 AI 反向掠夺引入 `REVERSE_PLUNDER_EFFICIENCY` 配置系数（默认 0.6），使 AI 的掠夺效率为玩家掠夺效率的 60%，避免新手劝退。

1.6 AI 掠夺的银币 SHALL 按 `PLUNDER_GAIN_RATIO`（现有 0.6）转化为 AI 国家的 wealth 增加。

---

### 需求 2：反向掠夺——AI 掠夺玩家实物资源

**用户故事：** 作为一名玩家，我希望 AI 占领我的经济区/核心区时，不仅掠夺银币，还会掠夺食物、木材等战略资源，以便战争对我的整体经济产生多维度影响。

#### 验收标准

2.1 WHEN AI 占领玩家经济区/核心区 AND 发生摩擦 tick THEN 系统 SHALL 从玩家库存中扣减 1-3 种资源，优先选择库存量最大的资源类型。

2.2 每种资源的掠夺量 SHALL 为 `库存量 × RESOURCE_PLUNDER_RATE × zoneMultiplier`，其中 `RESOURCE_PLUNDER_RATE` 为新配置常量（建议 0.02 经济区 / 0.04 核心区），`zoneMultiplier` 与区域等级挂钩。

2.3 IF 某资源库存为 0 THEN 系统 SHALL 跳过该资源，不产生负数。

2.4 WHEN 实物资源被掠夺时 THEN 系统 SHALL 在战斗日志中合并显示，格式为 `"💸 敌军掠夺了我方 {amount1} 食物、{amount2} 木材"`。

2.5 实物资源掠夺 SHALL 不直接增加 AI 的 nationInventory（AI 经济是宏观模型，不追踪实物库存明细），而是折算为等值 wealth 增量（使用 `nationPrices` 估价）。

---

### 需求 3：AI-AI 战争持续掠夺

**用户故事：** 作为一名玩家（旁观 AI 间战争），我希望 AI 之间的战争也有持续的经济掠夺效果，以便 AI 战争能真实削弱参战国经济、影响国际格局。

#### 验收标准

3.1 WHEN AI-AI 战争中一方占领另一方的经济区或核心区 THEN 系统 SHALL 在 `processAIAIWarProgression` 的每 tick 中调用 `calculateWarPlunder` 计算持续掠夺，并将 `wealthPlundered` 从被侵方 wealth 中扣除、`wealthGained` 加到攻方 wealth。

3.2 AI-AI 的持续掠夺 SHALL 使用与玩家战线相同的 `PLUNDER_RATE_ECONOMIC` / `PLUNDER_RATE_CAPITAL` 配置，但额外乘以 `AI_AI_PLUNDER_EFFICIENCY`（建议 0.5）以控制 AI 互掠速度。

3.3 WHEN AI-AI 战争双方均未占领对方经济区/核心区 THEN `calculateWarPlunder` SHALL 返回 0 掠夺量（与现有行为一致）。

3.4 持续掠夺产生的 wealth 变化 SHALL 影响 AI 国家的 `economyDirtyFlags`（标记 `resourcesDirty: true`），驱动后续经济模拟的重新计算。

---

### 需求 4：掠夺品扩展——战线资源节点掠夺对称化

**用户故事：** 作为一名玩家，我希望当 AI 推入我的战区时，我的战线资源节点也会被 AI 掠夺（就像我掠夺 AI 节点一样），以便战线的资源节点系统成为双向博弈。

#### 验收标准

4.1 WHEN AI 方在摩擦 tick 中处于玩家所属的战区 zone THEN 系统 SHALL 以 30% 概率（与现有玩家掠夺节点概率一致）选择一个未被掠夺的玩家资源节点，调用 `plunderResourceNode`。

4.2 AI 掠夺玩家资源节点后 THEN 系统 SHALL 将掠夺的资源量从玩家对应资源中扣除（与玩家掠夺 AI 节点对称）。

4.3 IF 资源节点被完全掠夺（`plundered: true`）AND 该节点有 `linkedBuildingId` THEN 系统 SHALL 触发玩家建筑的真实销毁（1座），与现有玩家掠夺 AI 节点的行为对称。

4.4 WHEN 玩家资源节点被 AI 掠夺时 THEN 系统 SHALL 在战斗日志中显示 `"🏚️ 敌军掠夺了我方 {resource} ×{amount}（{nodeName}）"`。

---

### 需求 5：掠夺配置集中化

**用户故事：** 作为一名开发者，我希望所有掠夺相关数值都集中在 `gameConstants.js` 的 `WAR_ECONOMY` 对象中，以便后续数值调参时只需修改一处。

#### 验收标准

5.1 系统 SHALL 在 `WAR_ECONOMY` 中新增以下配置项：
   - `REVERSE_PLUNDER_EFFICIENCY: 0.6` — AI 掠夺玩家的效率系数
   - `AI_AI_PLUNDER_EFFICIENCY: 0.5` — AI-AI 间持续掠夺的效率系数
   - `RESOURCE_PLUNDER_RATE_ECONOMIC: 0.02` — 经济区实物资源掠夺率/tick
   - `RESOURCE_PLUNDER_RATE_CAPITAL: 0.04` — 核心区实物资源掠夺率/tick
   - `MAX_RESOURCE_TYPES_PLUNDERED: 3` — 每次摩擦最多掠夺的资源种类数
   - `PLUNDER_SILVER_FLOOR_RATIO: 0.2` — 玩家被掠夺后保留的最低银币比例

5.2 现有的 `PLUNDER_RATE_ECONOMIC`、`PLUNDER_RATE_CAPITAL`、`PLUNDER_GAIN_RATIO` SHALL 保持不变，新配置与其并列。

5.3 `calculateWarPlunder` 函数 SHALL 新增一个可选参数 `efficiencyOverride`，当传入时覆盖默认效率（用于区分玩家掠夺/AI反向掠夺/AI-AI掠夺三种场景）。

---

### 需求 6：战线摩擦掠夺统一化

**用户故事：** 作为一名开发者，我希望 `processFrontFriction` 能同时计算双方的掠夺结果（而不仅仅是玩家方），以便调用者（`useGameLoop.js`）能在同一个摩擦事件中处理双向掠夺。

#### 验收标准

6.1 `processFrontFriction` SHALL 返回 `plunderResult` 对象中同时包含 `attackerPlunder` 和 `defenderPlunder` 两个子结果，分别代表攻方掠夺守方、守方掠夺攻方的计算结果。

6.2 WHEN 攻方不在守方经济区/核心区 THEN `attackerPlunder` SHALL 为空（`wealthPlundered: 0`）；守方掠夺同理。

6.3 `useGameLoop.js` 中的摩擦掠夺消费逻辑 SHALL 同时处理 `attackerPlunder` 和 `defenderPlunder`：
   - 玩家获益部分加到 `resources.silver`
   - 玩家损失部分从 `resources.silver` 和实物资源中扣减
   - AI 方的 wealth 相应调整

6.4 现有的 `frictionPlunderQueue` SHALL 扩展为同时收集玩家获益和玩家损失两类条目。

---

### 需求 7：战争经济 UI 反馈

**用户故事：** 作为一名玩家，我希望在战线面板中能清晰看到我方和敌方的持续掠夺收入/损失数据，以便我评估战争的经济可持续性并做出战术决策。

#### 验收标准

7.1 `calculateFrontEconomicImpact` 的返回值 SHALL 新增 `plunder` 字段，包含：
   - `playerDailyPlunderGain` — 玩家每日从敌方掠夺的预估银币（当战线在敌方经济区/核心区时）
   - `playerDailyPlunderLoss` — 玩家每日被敌方掠夺的预估银币（当战线在我方经济区/核心区时）
   - `netPlunderFlow` — 净掠夺流（gain - loss）

7.2 战线详情面板中的经济影响区域 SHALL 显示掠夺流数据：正值显示绿色 `"掠夺收入 +{amount}/天"`，负值显示红色 `"被掠夺 -{amount}/天"`。

7.3 WHEN 战线中线附近（40-60）双方均无掠夺 THEN 掠夺流显示 SHALL 为 `"—"` 或灰色 `"0/天"`，不产生视觉干扰。

---

## 边界情况与技术约束

1. **存档兼容**：所有新增字段（如 `plunderResult.defenderPlunder`）需在 `ensureFrontDefaults` 中提供默认值，旧存档加载不报错。
2. **性能**：`calculateWarPlunder` 已是纯函数且运算量极小，双向调用不会对 tick 性能产生可测量影响。AI-AI 的持续掠夺在 `processAIAIWarProgression` 中每 tick 执行，但该函数已在 worker 中运行。
3. **经济平衡**：AI 反向掠夺玩家应使用 0.6 倍效率系数，避免早期战争就让玩家经济崩溃。这个值应在 playtest 后微调。
4. **旧军事行动系统**：`processAIMilitaryAction`（旧 raid/assault 系统）不受本次改动影响，它在没有战线的战争场景中仍独立运行。两套系统互不干涉。
5. **附庸国战争**：附庸国的战线掠夺应遵循与普通战争相同的规则，不做特殊处理。
