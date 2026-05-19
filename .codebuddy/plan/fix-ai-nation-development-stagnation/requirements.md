# 需求文档：修复AI国家发展停滞问题

## 引言

AI国家（如截图中的"藏红花城邦"）出现严重的发展停滞现象：人口持续下降、财政储备不断减少、人均产出极低（6.63），尽管承载率仅3%（远低于上限86.8亿）。这表明AI经济系统存在结构性缺陷，导致AI国家无法正常发展。

### 根因分析

通过代码审计发现以下**4个核心问题**：

#### 问题1：双重经济更新路径互相覆盖（最严重）
- **路径A**（新系统）：`simulation.js` → `AIEconomyService.update()` → 计算人口/财富增长 → `Object.assign(next, updatedNation)`
- **路径B**（旧系统）：`nations.js` → `updateNationEconomy()` → 通过wealth drift修改`nation.wealth`，战时修改`nation.population`
- **执行顺序**：路径B先执行，路径A后执行并覆盖人口/财富。但路径B在执行时已经修改了`economyTraits`（如`ownBaseWealth`、`lastGrowthTick`），这些修改会影响路径A的计算。
- **致命后果**：路径B的wealth drift将财富拉向基于`ownBaseWealth`（初始仅500-1000）的低目标值；路径B提前更新`lastGrowthTick`导致路径A认为"刚刚更新过"而跳过增长计算。

#### 问题2：建筑规模与人口严重脱节
- 建筑目标公式 `getAIBuildingTargetTotal`：`pop / 6.5`，人口2.9亿仅分配约44个建筑
- 建筑epoch上限 `AI_BUILDING_EPOCH_CAPS`：epoch 0=120，远超实际分配
- 44个建筑的food/civic产出极低，无法支撑2.9亿人口的经济活动
- 人口被`capacityFloor`（基于`ownBasePopulation`）人为撑高，但经济基础（建筑）跟不上

#### 问题3：财富增长被多重不一致的cap压制
- `AIEconomyService`中的`perCapitaWealthCap`：epoch 0=120
- `updateNationEconomy`中的`perCapitaWealthCapForDrift`：epoch 0=2000
- 两套cap差异巨大（120 vs 2000），且两个系统都在修改wealth
- `updateNationEconomy`的drift机制会主动将财富拉向低目标值

#### 问题4：低产出→低财富→低承载力的恶性循环
- 建筑太少 → 产出低 → savingsRate低 → 财富不增长
- 财富低 → wealthCapacity低 → carryingCapacity受限
- 人口下降 → 建筑目标更少 → 产出更低 → 恶性循环

## 需求

### 需求 1：消除双重经济更新路径冲突

**用户故事：** 作为一名玩家，我希望AI国家的经济系统只有一条清晰的更新路径，以便AI国家能够稳定地发展而不会因为内部系统冲突而停滞。

#### 验收标准

1. WHEN `updateNationEconomy`（路径B）执行时 THEN 系统 SHALL 不再修改`nation.wealth`、`nation.population`、`nation.economyTraits.lastGrowthTick`，这些字段的更新权完全交给`AIEconomyService`（路径A）
2. WHEN `updateNationEconomy`执行时 THEN 系统 SHALL 仅保留以下职责：初始化`economyTraits`（首次）、计算`desiredPopulation`/`desiredWealth`目标值（供参考）、更新GDP平滑值、更新budget
3. WHEN AI国家处于战争状态时 THEN 系统 SHALL 仅在`AIEconomyService`/`AIDevelopmentService`中统一处理战争伤亡和财富损耗，不在`updateNationEconomy`中重复扣减
4. IF `updateNationEconomy`中的wealth drift被移除 THEN 系统 SHALL 确保`AIEconomyService`的财富增长逻辑能够独立驱动AI国家的财富变化

### 需求 2：修复建筑规模与人口的匹配关系

**用户故事：** 作为一名玩家，我希望AI国家的建筑数量能够合理匹配其人口规模，以便AI国家的经济产出能够支撑其人口。

#### 验收标准

1. WHEN AI国家人口增长时 THEN 系统 SHALL 确保建筑目标数量与人口规模成合理比例（建议每6-8人口对应1个建筑，而非当前的每6.5人口1个建筑但受限于极低的实际分配）
2. WHEN 计算建筑目标总数时 THEN 系统 SHALL 确保公式中的人口单位与实际人口单位一致（当前`pop / 6.5`中的pop是否为万人单位需要确认）
3. IF 建筑数量受`AI_BUILDING_EPOCH_CAPS`限制 THEN 系统 SHALL 确保承载力计算考虑到建筑不足的情况，通过人口基础产出（subsistence）补偿建筑产出缺口
4. WHEN 建筑数量远低于人口需求时 THEN 系统 SHALL 提供一个基于人口规模的最低经济产出保底，防止恶性循环

### 需求 3：统一财富cap体系

**用户故事：** 作为一名玩家，我希望AI国家的财富上限是一致且合理的，以便AI国家的财富能够随着发展稳步增长。

#### 验收标准

1. WHEN 系统检查AI国家财富上限时 THEN 系统 SHALL 使用统一的perCapitaWealthCap配置，消除`AIEconomyService`（120/epoch0）和`updateNationEconomy`（2000/epoch0）之间的不一致
2. WHEN AI国家财富低于目标值时 THEN 系统 SHALL 允许财富以合理速率增长（catch-up机制），不被过低的cap提前截断
3. IF 财富增长被cap限制 THEN 系统 SHALL 确保cap值与同epoch玩家的合理财富水平相当

### 需求 4：打破低产出恶性循环

**用户故事：** 作为一名玩家，我希望AI国家即使在早期或困难时期也能维持基本的经济运转，以便游戏中的AI对手始终具有一定的发展能力。

#### 验收标准

1. WHEN AI国家的人均产出低于epoch目标值的50%时 THEN 系统 SHALL 提供一个基于人口的最低产出保底（代表自给自足经济活动）
2. WHEN AI国家的财富增长（wealthDelta）连续为负时 THEN 系统 SHALL 确保存在一个正向的最低财富恢复机制（如基于人口的subsistence income）
3. WHEN AI国家的savingsRate计算结果为负时 THEN 系统 SHALL 确保最低savingsRate不低于0.05（5%），防止经济完全停滞
4. IF AI国家人口下降导致建筑目标减少 THEN 系统 SHALL 不立即减少建筑数量，而是保持一定的建筑惯性（如最多每30tick减少10%）

### 需求 5：确保修复不引入新的数值膨胀

**用户故事：** 作为一名玩家，我希望修复AI发展停滞的同时不会导致AI国家过度膨胀，以便游戏平衡性得到维护。

#### 验收标准

1. WHEN 修复应用后 THEN 系统 SHALL 保持现有的perCapitaWealthCap体系作为硬上限
2. WHEN 修复应用后 THEN 系统 SHALL 保持现有的hardPopulationCap（1.5x carryingCapacity）作为人口硬上限
3. WHEN 修复应用后 THEN 系统 SHALL 确保AI国家的人均财富不超过同epoch玩家的合理水平
4. IF 旧存档加载后 THEN 系统 SHALL 平滑过渡到新的经济逻辑，不产生突然的人口/财富跳变

## 技术约束

- 所有修改必须在现有架构内完成，不引入新的经济子系统
- 修改范围限制在：`nations.js`（updateNationEconomy）、`AIEconomyService.js`、`AIDevelopmentService.js`、`AIPopulationDynamics.js`、`warEconomy.js`（getAIBuildingTargetTotal）、`aiEconomyConfig.js`
- 必须保持与旧存档的兼容性
- 不修改玩家侧的经济逻辑

## 成功标准

1. AI国家在和平时期人口应稳步增长（至少每100tick增长1%）
2. AI国家财政储备应随时间缓慢增加（非战时）
3. AI国家人均产出应趋近于epoch目标值（targetPerCapita）
4. 控制台不再出现频繁的`[POP JUMP]`或`[POP CLAMP]`警告
