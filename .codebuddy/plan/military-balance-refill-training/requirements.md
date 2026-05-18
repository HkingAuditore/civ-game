# 需求文档：军事补兵平衡优化

## 引言

当前战线系统中，AI国家与玩家在军队补充速度上存在严重的结构性不对称：

- **AI回填**：每tick基于缺额百分比瞬间补充兵力（战时基础率0.15%，上限0.3%），无训练延迟、无资源消耗、无人口限制。对于300万军队损失50%的情况，AI每tick可回填约4500人。
- **玩家补兵**：受四重瓶颈限制——军事容量（兵营数×10/20/40）、士兵人口占用、资源消耗（food/wood/silver等）、训练时间（2-18 tick不等）。补充1000个步兵需要5-6个tick，且消耗大量资源。

此外，还存在两个严重的逻辑缺陷：
- **AI回填不消耗任何经济资源**：`syncAINationMilitary`中的回填逻辑直接给军团加兵，不从stockpile或wealth中扣除任何费用，相当于AI凭空变出士兵
- **AI军队战斗伤亡不扣减人口**：摩擦战和会战中敌方军团的`units`被正确扣减，但没有对应的`nation.population`扣减。只有战线推进到核心区（linePosition > 85 或 < 15）时才会扣AI人口，正常战斗中死掉的士兵不影响AI人口

本次优化包含四个方向：
1. **进一步降低AI战时回填率**，使玩家的战斗杀伤能够有效削弱敌军
2. **AI回填消耗经济资源**，使AI爆兵有经济代价
3. **AI军队伤亡扣减人口**，使战斗死亡的士兵从AI人口中移除
4. **优化玩家训练算法**，根据军事建筑数量实现批量训练加速

---

## 需求

### 需求 1：降低AI战时回填率

**用户故事：** 作为一名玩家，我希望在战线上对敌军造成的杀伤能够真正削弱敌方兵力，以便我的军事优势能够随时间转化为战场胜势。

#### 验收标准

1. WHEN AI国家处于战争状态 THEN 系统 SHALL 将AI军队回填基础率从当前的 `0.15%/tick`（基于缺额）降低至 `0.05%/tick`（基于缺额）
2. WHEN AI国家处于战争状态 THEN 系统 SHALL 将AI军队回填率上限从当前的 `0.3%` 降低至 `0.12%`
3. WHEN AI国家处于和平状态 THEN 系统 SHALL 保持当前和平时期回填率不变（基础率0.8%，上限1.2%），确保AI在非战争期间能正常恢复军力
4. WHEN AI军队缺额接近0 THEN 系统 SHALL 确保回填量自然趋近于0（因为回填基于缺额百分比，缺额越小回填越少，此行为已存在，无需额外修改）
5. WHEN 时代加成（epochBonus）、人口加成（popBonus）、经济加成（econBonus）生效时 THEN 系统 SHALL 相应降低各加成的上限值，使其与新的基础率匹配：
   - epochBonus 上限从 `0.15%` 降至 `0.05%`
   - popBonus 上限从 `0.1%` 降至 `0.03%`
   - econBonus 上限从 `0.1%` 降至 `0.03%`

#### 数值推演

以300万满编AI军队为例，损失50%（缺额150万）：
- **修改前**：回填 = 150万 × 0.3% = 4500人/tick
- **修改后**：回填 = 150万 × 0.12% = 1800人/tick
- 若摩擦战+会战每tick杀伤3000人，修改后净减少1200人/tick，约1250天（tick）可消灭150万敌军

---

### 需求 2：AI回填消耗经济资源

**用户故事：** 作为一名玩家，我希望AI补兵需要花费经济资源，以便持续的战争能够消耗AI的国力，使经济战成为可行的战略。

#### 验收标准

1. WHEN AI军队执行回填（每tick补充兵力）THEN 系统 SHALL 从AI国家的`wealth`中扣除对应的征兵费用
2. WHEN 计算征兵费用时 THEN 系统 SHALL 使用公式：`refillCost = actualRefill × costPerUnit`，其中 `costPerUnit` 基于时代缩放：
   - `costPerUnit = baseCost × (1 + epoch × 0.3)`
   - `baseCost = 0.5`（每个士兵的基础征兵成本，以wealth为单位）
3. IF AI国家的`wealth`不足以支付全部征兵费用 THEN 系统 SHALL 按比例缩减实际回填量：`actualRefill = floor(affordableRefill)`，其中 `affordableRefill = wealth / costPerUnit`
4. WHEN AI国家`wealth`低于安全阈值（`wealth < population × 0.5`）THEN 系统 SHALL 完全停止回填，优先保障国家经济不崩溃
5. WHEN 回填费用从wealth中扣除后 THEN 系统 SHALL 确保wealth不低于100（与现有wealth下限一致）
6. WHEN AI处于和平时期回填 THEN 系统 SHALL 同样消耗wealth，但和平时期经济恢复速度更快，自然能支撑更高的回填率

#### 数值推演

以300万军队的AI国家为例（wealth=50000，epoch=3）：
- costPerUnit = 0.5 × (1 + 3 × 0.3) = 0.95
- 每tick回填1800人的费用 = 1800 × 0.95 = 1710 wealth
- 50000 wealth可支撑约29 tick的满速回填
- 之后wealth耗尽，回填速度骤降，形成"经济放血"效果

---

### 需求 3：AI军队伤亡扣减人口

**用户故事：** 作为一名玩家，我希望在战线上杀死的敌军士兵能够从敌国人口中移除，以便持续的战争消耗能够真正削弱敌国的国力和后续征兵能力。

#### 验收标准

1. WHEN 摩擦战（friction）造成敌方军团伤亡 THEN 系统 SHALL 将伤亡数量按比例从对应AI国家的`population`中扣减
2. WHEN 会战（battle）造成敌方军团伤亡 THEN 系统 SHALL 同样将伤亡数量从AI国家的`population`中扣减
3. WHEN 扣减AI人口时 THEN 系统 SHALL 使用转换系数：`populationLoss = casualties × casualtyToPopRatio`，其中 `casualtyToPopRatio = 0.8`（每个士兵阵亡对应0.8人口损失，与现有军事行动中的比例一致，参见useGameActions.js L3283）
4. WHEN 扣减AI人口后 THEN 系统 SHALL 确保AI人口不低于安全下限（使用现有的`reducePopulationWithFloor`函数或等效逻辑，最低保留100人口）
5. WHEN AI人口因战斗伤亡降低 THEN 系统 SHALL 自然影响后续的回填上限（因为`maxManpower = population × manpowerRatio`，人口越少可维持的军队越少）
6. WHEN 摩擦战和会战同时发生在同一tick THEN 系统 SHALL 分别累计伤亡，统一扣减人口，避免重复计算

#### 数值推演

以200万军队的AI国家为例（population=5000万）：
- 摩擦战每tick杀伤2000敌军
- 人口损失 = 2000 × 0.8 = 1600人/tick
- 5000万人口可承受约31250 tick的持续消耗
- 但人口下降会降低maxManpower上限，形成"人口→军队→人口"的负反馈循环
- 当人口降至一定程度，AI将无法维持大规模军队，被迫求和

---

### 需求 4：基于军事建筑的玩家批量训练扩容

**用户故事：** 作为一名玩家，我希望建造更多军事建筑后能够每tick同时训练更多的士兵，以便我的军事基础设施投资能够转化为更高的补兵吞吐量。

#### 背景：当前训练瓶颈分析

当前训练系统中，每tick能从`waiting`→`training`的单位数量受限于**士兵人口岗位**（`availableJobsForNewTraining = currentSoldierPop - occupiedPopulation`）。这意味着：
- 已有军队 + 正在训练的单位 占用了士兵人口岗位
- 剩余的空闲岗位决定了每tick能开始训练多少新单位
- 军事建筑（兵营/训练场/要塞）目前只提供**军事容量上限**（militaryCapacity），即军队总规模上限
- 军事建筑**不影响**每tick的训练吞吐量

本需求的核心是：引入"训练吞吐量"概念，军事建筑越多，每tick能同时开始训练的单位数量越大。

#### 验收标准

1. WHEN 系统计算每tick可开始训练的单位数量时 THEN 系统 SHALL 引入"训练吞吐量"（trainingThroughput）作为额外的并行训练上限
2. WHEN 计算 trainingThroughput 时 THEN 系统 SHALL 使用公式：
   - `trainingThroughput = baseThroughput × (1 + log2(militaryBuildingCount) × 0.5)`
   - 其中 `baseThroughput = 5`（基础每tick可同时开始训练5个单位）
   - 其中 `militaryBuildingCount` 为所有提供militaryCapacity的建筑总数量
   - 该值有上限 `50`（防止后期建筑过多导致瞬间爆兵）
3. WHEN 每tick处理 waiting→training 转换时 THEN 系统 SHALL 同时受两个条件约束：
   - 条件A：士兵人口岗位限制（`remainingPopCapacity`，现有逻辑不变）
   - 条件B：训练吞吐量限制（`trainingThroughput - currentTrainingCount`，即吞吐量减去当前正在训练的数量）
   - 实际可开始训练数 = min(条件A可支持数, 条件B可支持数)
4. IF 玩家没有军事建筑（militaryBuildingCount = 0）THEN 系统 SHALL 使用 baseThroughput = 5 作为默认吞吐量
5. WHEN 大臣训练速度加成（ministerEffects.militaryTrainingSpeed）生效时 THEN 系统 SHALL 保持其对训练时间的缩短效果不变，与训练吞吐量独立运作（吞吐量管"同时训练多少个"，大臣加成管"每个训练多快"）
6. WHEN 训练吞吐量生效时 THEN 系统 SHALL 在军事面板UI中显示当前的训练吞吐量信息（如"训练容量：15/tick"），让玩家了解建筑带来的训练加速效果

#### 数值推演

| 军事建筑数 | trainingThroughput | 说明 |
|---|---|---|
| 0 | 5 | 基础值，无建筑也能训练 |
| 1 | 5 | 1座建筑，log2(1)=0，无加成 |
| 2 | 7 | 5 × (1 + 0.5) = 7.5 → 7 |
| 5 | 10 | 5 × (1 + 1.16) = 10.8 → 10 |
| 10 | 14 | 5 × (1 + 1.66) = 13.3 → 14 |
| 20 | 18 | 5 × (1 + 2.16) = 15.8 → 18 |
| 50 | 25 | 5 × (1 + 2.82) = 19.1 → 25 |
| 100 | 33 | 5 × (1 + 3.32) = 21.6 → 33 |
| 200+ | 50(上限) | 硬性上限，防止失控 |

**实际效果对比**（假设有足够士兵人口岗位）：
- **修改前**：10座兵营，每tick能开始训练的数量仅受士兵人口限制（可能几百上千，但训练时间长）
- **修改后**：10座兵营，每tick最多同时有14个单位处于训练状态，训练完成后腾出位置给下一批
- 这意味着：10座兵营 + 步兵训练时间5天 = 每5天产出14个步兵 = 平均2.8个/tick
- 对比1座兵营：每5天产出5个步兵 = 平均1个/tick
- 建筑投资带来约2.8倍的补兵效率提升

---

## 边界情况与技术约束

### 边界情况
1. **AI回填率为0的情况**：当AI军队满编（deficit=0）时，回填量自然为0，无需特殊处理
2. **AI wealth耗尽**：当wealth低于安全阈值时停止回填，AI军队将持续被消耗直到求和或灭亡
3. **AI人口降至极低**：使用reducePopulationWithFloor确保最低100人口；maxManpower会自动限制军队规模
4. **AI-AI战争中的人口扣减**：现有的`applyFrontlinePopulationCasualties`已处理AI-AI战争的人口损失，本次新增的是玩家-AI战线中摩擦战/会战伤亡对AI人口的扣减
5. **玩家无军事建筑**：trainingThroughput默认为baseThroughput=5，不影响现有行为
6. **士兵人口不足时**：训练吞吐量再高也无法超过士兵人口岗位限制，两个条件取最小值
7. **训练队列中已有训练中批次**：吞吐量限制的是"当前正在训练的总数"，已在训练中的批次占用吞吐量配额
8. **大臣加成与吞吐量独立**：大臣加成缩短训练时间（更快完成），吞吐量增加并行数（同时训练更多），两者效果叠加但机制独立

### 性能约束
1. 训练吞吐量应在每tick开始时基于建筑状态计算一次并缓存，而非每个批次重复计算
2. 批量训练处理仍保持O(batches)复杂度，仅在现有循环中增加一个计数器判断
3. AI回填率调整仅修改常量值，不改变算法结构，无性能影响
4. AI人口扣减在摩擦战/会战伤亡计算后统一执行一次setNations，不额外增加渲染周期
5. AI回填经济消耗在现有回填逻辑中内联计算，不引入新的函数调用

### 涉及文件
- `src/logic/diplomacy/aiWar.js` — syncAINationMilitary函数中的回填率常量和回填经济消耗
- `src/hooks/useGameLoop.js` — 摩擦战/会战伤亡后的AI人口扣减、训练队列处理逻辑（L8140-8430区域）、getMilitaryCapacity函数、新增getTrainingThroughput函数
- `src/components/tabs/MilitaryTab.jsx` — 训练队列UI显示（显示训练吞吐量信息）
