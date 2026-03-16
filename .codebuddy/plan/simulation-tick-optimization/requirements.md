# 需求文档：游戏后期模拟性能优化（轻重Tick分离方案）

## 引言

游戏在后期（大量AI国家、建筑数百、多层级经济流转）出现明显卡顿。根本原因是 `simulateTick`（8851行，35个性能分段）在每个tick中执行了全量计算，包括收入结算和AI决策。

本方案的核心设计原则是：**将每tick计算分为"必须每tick执行的收入/经济流转类"和"可以延迟多tick批量执行的决策/行动类"两大类**，在确保所有税收、居民收入、朝贡等经济数字每tick精确的前提下，大幅降低后期计算负载。

### 关键约束
- **收入类（每tick必须执行）**：所有的税、玩家国内居民收入、各种经济流转、玩家附庸的朝贡等有关收入的东西，必须保证每一个tick收的都是对的。
- **决策类（可延迟执行）**：建筑扩建、投资、国家间宣战等决策内容，可以每隔一段时间才执行一次；甚至像玩家国内/国外投资可以20个tick才结算一次，一次做够20tick的量。

### 现有基础设施
- `performanceUtils.js`：已有 `RATE_LIMIT_CONFIG`（aiDecisionFrequency=7, diplomacyUpdateFrequency=10等）、`shouldRunThisTick()`、`TickCache`、`dirtyFlags`
- `useSimulationWorker.js`：单Worker + 主线程fallback
- `useThrottledGameState.js`：UI节流 hook（`useThrottledSelector`、`UI_THROTTLE_PRESETS`）
- `useDevicePerformance.js`：设备检测 + 三级性能模式（AUTO/HIGH/LOW）
- `simulation.js` 中已有 `getSlice()` 分片逻辑和 `shouldRunThisTick` 频率控制（但仅用于5个场景）

### 当前 simulation.js 35个性能分段分类

**必须每tick执行（收入/经济流转）：**
- `preProduction` — 生产前准备
- `ownerJobsAdjust` — 业主岗位调整
- `availableResources` — 可用资源计算
- `populationJobs` — 人口就业分配
- `passiveGains` — 被动收益
- `headTax` — 人头税
- `productionLoop` — 建筑生产循环（核心产出/消耗）
- `armyMaintenance` — 军队维护费
- `needsConsumption` — 需求消费
- `socialEconomy` — 社会经济流转
- `livingStandards` — 生活水平计算
- `approvalCalc` — 满意度计算
- `wealthDecay` — 财富衰减
- `influenceCalc` — 影响力计算
- `stabilityCalc` — 稳定性计算
- `marketEconomy` — 市场经济模拟
- `marketUpdate` — 市场价格更新
- `vassalUpdates` — 附庸更新（含朝贡收入）
- `buffsDebuffs` — buff/debuff应用
- `bonusesApply` — 加成应用

**可延迟执行（决策/行动类）：**
- `aiNationUpdate` — AI国家全量模拟（已有分片，可进一步降频）
- `diplomacyAI` — 外交AI决策
- `officialsSim` — 官员系统模拟
- `cabinetMechanics` — 内阁机制
- `exodusAndPenalties` — 人口外流与惩罚
- `monthlyRelationDecay` — 月度关系衰减
- `orgMonthly` — 组织月度更新
- `migrationMonthly` — 月度迁移
- `rebellionDaily` — 叛乱系统
- `priceConvergence` — 价格收敛（条约效果）

**可大幅延迟执行（低频结算）：**
- `overseasInvestments` — 海外投资（可20tick结算一次）
- `overseasUpgrades` — 海外投资升级（可20tick结算一次）
- `foreignInvestments` — 外国投资（可20tick结算一次）
- `foreignUpgrades` — 外国投资升级（可20tick结算一次）
- `manualTrade` — 手动贸易路线（已有3tick频率，可进一步降低）

---

## 需求

### 需求 1：建立三级Tick频率分类体系

**用户故事：** 作为一名玩家，我希望游戏在后期不会因为大量AI计算而卡顿，以便我能流畅地体验完整的游戏流程。

#### 验收标准

1. WHEN simulateTick 执行时 THEN 系统 SHALL 根据操作类型将所有35个性能分段分为三个频率级别：
   - **每tick级（critical）**：税收、生产、消费、工资、朝贡等收入/经济流转，每个tick都完整执行
   - **低频级（deferred）**：AI决策、外交、官员、内阁等决策类操作，按配置频率间隔执行
   - **超低频级（batch）**：国内外投资结算，每20tick执行一次，一次结算20tick的量

2. WHEN 低频级操作跳过某个tick时 THEN 系统 SHALL 保证该tick的收入/经济流转数字不受影响，所有资源/银币变动精确无误

3. IF 超低频级操作（如投资）跳过了N个tick THEN 系统 SHALL 在执行tick时将效果乘以N（即累积结算），确保长期收益总量一致

4. WHEN 使用三级频率体系时 THEN 系统 SHALL 将后期每tick的总计算量降低至少40%（相对于当前全量计算）

### 需求 2：动态频率配置系统

**用户故事：** 作为一名开发者，我希望频率参数可以集中配置和动态调整，以便根据游戏规模和设备性能灵活优化。

#### 验收标准

1. WHEN 系统初始化时 THEN `performanceUtils.js` 中的 `RATE_LIMIT_CONFIG` SHALL 扩展为包含三级频率的完整配置，新增以下配置项：
   - `overseasInvestmentFrequency`（默认20）
   - `foreignInvestmentFrequency`（默认20）
   - `officialSimFrequency`（默认5）
   - `cabinetFrequency`（默认5）
   - `rebellionFrequency`（默认3）
   - `exodusFrequency`（默认5）

2. WHEN 游戏中的AI国家数量超过阈值（如15个存活国家）THEN 系统 SHALL 自动提升低频级和超低频级操作的间隔（如 `aiDecisionFrequency` 从7增加到12，`diplomacyUpdateFrequency` 从10增加到20）

3. WHEN 设备处于低性能模式（`useDevicePerformance` 检测结果）THEN 系统 SHALL 进一步增大所有非critical操作的频率间隔

4. IF `RATE_LIMIT_CONFIG` 中的任何频率值被修改 THEN `shouldRunThisTick()` 函数 SHALL 自动适配新频率，无需修改调用方代码

### 需求 3：投资系统批量结算机制

**用户故事：** 作为一名玩家，我希望我的国内外投资收益在后期不会因为性能优化而变少或变多，以便投资决策的经济反馈保持准确。

#### 验收标准

1. WHEN 投资结算tick到达（每20tick一次）THEN 系统 SHALL 一次性计算20个tick的累积收益（利润、税收、就业岗位效果），结果等价于逐tick计算的总和

2. WHEN 投资结算被延迟执行时 THEN 系统 SHALL 在非结算tick中仍然保留投资的"静态效果"（如外资建筑提供的就业岗位），仅延迟"动态效果"（如利润回流、升级决策）

3. IF 在两次投资结算之间发生了投资相关事件（如所投资的国家被吞并）THEN 系统 SHALL 在下次结算时正确处理该事件，不遗漏也不重复

4. WHEN 投资批量结算完成后 THEN 系统 SHALL 返回与逐tick结算在±2%误差范围内一致的经济数字

### 需求 4：AI国家分片与降频优化增强

**用户故事：** 作为一名玩家，我希望大量AI国家的存在不会导致游戏帧率显著下降，以便多国博弈的游戏体验保持流畅。

#### 验收标准

1. WHEN AI国家数量 > 10 THEN `aiNationUpdateSlices` SHALL 自动增加到 `Math.max(4, Math.ceil(nationCount / 4))`，确保每个tick只处理约4个AI国家的完整AI逻辑

2. WHEN AI国家的经济模拟执行时 THEN 系统 SHALL 区分AI国家的"收入流转"（每tick执行）和"决策行为"（按分片频率执行）：
   - 每tick：AI国家的税收、预算变动、人口增长等数值更新
   - 分片tick：AI国家的建筑扩建决策、宣战/和平决策、贸易策略调整

3. WHEN 某个AI国家在本tick不在分片范围内时 THEN 系统 SHALL 跳过该国家的决策逻辑但保留其经济流转，确保AI国家的财政数据始终准确

4. WHEN 外交AI（`diplomacyAI`）执行时 THEN `diplomacyUpdateSlices` SHALL 自动根据国家数量调整，确保每tick只处理一部分国家的外交计算

### 需求 5：Worker通信序列化优化

**用户故事：** 作为一名玩家，我希望在使用Web Worker时不会因为数据传输而产生额外的卡顿，以便Worker模式真正起到加速作用。

#### 验收标准

1. WHEN simulation结果通过Worker postMessage返回时 THEN 系统 SHALL 仅传输本tick实际变化的字段，而非完整状态对象

2. IF 调试面板未打开 THEN 系统 SHALL 不传输 `_debug`、`buildingDebugData`、`modifiers.sources` 等调试/展示数据

3. WHEN 使用差异传输时 THEN 系统 SHALL 确保 `useGameLoop.js` 中的结果apply逻辑能正确合并差异数据与现有状态

4. WHEN Worker序列化优化启用后 THEN 单次postMessage的数据量 SHALL 减少至少50%（相对于当前全量传输）

### 需求 6：UI渲染节流扩展

**用户故事：** 作为一名玩家，我希望非关键UI面板不会因为频繁刷新而消耗不必要的性能，以便CPU资源更多地用于模拟计算。

#### 验收标准

1. WHEN 游戏运行时 THEN 所有非当前活跃tab的UI面板 SHALL 使用 `UI_THROTTLE_PRESETS.slow`（500ms）或更低的刷新频率

2. WHEN 统计/图表面板显示时 THEN 系统 SHALL 使用 `UI_THROTTLE_PRESETS.background`（1000ms）的刷新间隔

3. WHEN `useThrottledSelector` 应用于非关键组件时 THEN 系统 SHALL 确保只在选中的状态切片实际发生变化时才触发重渲染

4. IF 设备处于低性能模式 THEN 系统 SHALL 将所有 `UI_THROTTLE_PRESETS` 的时间间隔翻倍

### 需求 7：History数据分离

**用户故事：** 作为一名开发者，我希望历史数据不会在每tick的模拟循环中增加不必要的序列化和传输成本，以便模拟核心保持轻量。

#### 验收标准

1. WHEN simulateTick执行时 THEN `classWealthHistory`、`classNeedsHistory` 等历史数组 SHALL 不作为simulateTick的输入参数传入Worker

2. WHEN 历史数据需要更新时 THEN 系统 SHALL 在 `useGameLoop.js` 中通过 ref 管理历史追加逻辑，仅使用当前tick的结果数据生成历史条目

3. IF 历史数据的更新频率（当前HISTORY_UPDATE_INTERVAL=5）可以进一步降低 THEN 系统 SHALL 支持配置化调整，低性能模式下可设为10或更高

4. WHEN 历史数据从simulation输入中移除后 THEN Worker postMessage的payload大小 SHALL 减少相应的历史数据体积

### 需求 8：Tick预算保护机制

**用户故事：** 作为一名玩家，我希望即使在极端后期场景下游戏也不会完全卡死，以便我始终能保持基本的操作响应。

#### 验收标准

1. WHEN 单个tick的总执行时间接近预算上限（如150ms）THEN 系统 SHALL 将剩余的低频/超低频操作推迟到下一个tick执行

2. WHEN 操作被推迟时 THEN 系统 SHALL 确保所有critical级（收入/经济流转）操作已经完成，仅推迟deferred和batch级操作

3. IF 连续3个tick都发生了操作推迟 THEN 系统 SHALL 在控制台输出性能警告日志，提示可能需要降低游戏速度或启用低性能模式

4. WHEN tick预算机制启用后 THEN 系统 SHALL 确保任何单个tick的主线程阻塞时间不超过200ms（包含apply state时间）

### 需求 9：性能模式与设备自适应整合

**用户故事：** 作为一名在不同设备上游戏的玩家，我希望性能优化策略能自动匹配我的设备能力，以便无论在高端还是低端设备上都有最佳体验。

#### 验收标准

1. WHEN 设备被检测为低性能模式 THEN 系统 SHALL 自动应用更激进的频率配置（所有deferred操作频率×1.5，所有batch操作频率×2）

2. WHEN 设备为高性能模式 THEN 系统 SHALL 使用默认频率配置，不做额外降频处理

3. WHEN 用户手动切换性能模式时 THEN 频率配置 SHALL 立即生效，无需重启游戏

4. IF 游戏运行中检测到持续的帧率低于目标 THEN 系统 SHALL 自动建议用户切换到低性能模式（通过UI提示）
