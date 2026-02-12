# 需求文档：战线系统全面修复与增强

## 引言

当前战线系统存在多个严重的功能性缺陷和设计脱节问题，导致战争体验缺乏紧张感和爽快感，与经济系统等已有系统几乎没有切实联动。本次修复需要解决以下核心问题：

1. **AI军团兵力为0**（致命BUG）：`generateNationArmy` 中财富约束系数过于严苛，导致AI军团生成时兵力为0，战斗创建后第1回合即因 annihilation 结束
2. **经济压力始终为0**：经济压力完全依赖资源点被掠夺和设施被破坏（需赢得战斗），且战线推进只在被反推时产生压力，导致攻方永无经济压力
3. **发起进攻秒结束**：因AI军团无兵力，战斗创建后立即结束
4. **战线上的资源点是固定的**：一次性在战线创建时生成，不随推进变化，与玩家真实经济脱节
5. **战术姿态效果不直观**：姿态在代码中有效果但UI无量化反馈
6. **战线推进是连续滑条**：`linePosition` 0-100连续变化没有关键节点，推进本身无直接后果

**核心设计理念变更**：将战线从"连续滑条+固定资源容器"重构为"分段 checkpoint 推进 + 动态资源点映射真实经济 + 双向建筑/人口破坏"。

修复范围涉及：`logic/diplomacy`（frontSystem.js、battleSystem.js）、`config`（militaryUnits.js）、`hooks`（useGameLoop.js、useGameState.js）、`logic`（simulation.js）、`components`（WarfrontCard.jsx）

## 需求

### 需求 1：修复 AI 军团兵力为0（致命BUG）

**用户故事：** 作为玩家，我希望敌方军团有合理的兵力规模，以便战斗真正发生而不是瞬间结束

#### 验收标准

1. WHEN `generateNationArmy` 被调用生成 AI 军团 THEN 系统 SHALL 确保返回的军队总兵力不低于最低下限（`MIN_ARMY_SIZE = max(10, population * 0.001)`）
2. IF `wealthConstraint` 计算结果导致 `baseArmySize < MIN_ARMY_SIZE` THEN 系统 SHALL 使用 `MIN_ARMY_SIZE` 作为下限
3. WHEN `generateEnemyCorpsForFront` 生成 AI 军团 THEN 系统 SHALL 在生成后校验每个军团的总兵力 > 0，若为0则使用 fallback 填充（基于 epoch 的最低配置兵种）
4. WHEN 战斗通过 `createBattle` 创建 THEN 系统 SHALL 在创建前校验双方 `currentUnits` 总量 > 0，若某方为0则阻止创建并在日志中记录原因

### 需求 2：战线分段推进（Checkpoint 制）

**用户故事：** 作为玩家，我希望战线推进是一段一段的、有明确里程碑的，以便我能直观感受战局进展和控制区域变化

#### 验收标准

1. WHEN 战线创建 THEN 系统 SHALL 将 `linePosition`（0-100）划分为若干 **checkpoint 区段**，从守方领地到攻方领地依次为：
   - **区段 0-15**：守方核心区（Capital Zone）— 包含守方核心建筑和人口
   - **区段 15-35**：守方经济区（Economic Zone）— 包含守方生产性建筑
   - **区段 35-50**：守方前沿（Frontier）— 包含守方军事/采集类建筑
   - **区段 50**：中立线（No Man's Land）— 战线初始位置
   - **区段 50-65**：攻方前沿（Frontier）
   - **区段 65-85**：攻方经济区（Economic Zone）
   - **区段 85-100**：攻方核心区（Capital Zone）
   每个区段边界是一个 checkpoint（15、35、50、65、85），共 5 个关键节点
2. WHEN `linePosition` 跨越任一 checkpoint THEN 系统 SHALL：
   - 触发一条控制日志事件（如「我军突破敌方前沿，进入经济区！」或「⚠️ 敌军突入我方经济区！」）
   - 根据**新进入的区段**动态生成该区段的资源点和设施（见需求 3）
   - UI 使用醒目动画和颜色变化标记 checkpoint 突破
3. WHEN 战线被推回已清除的区段 THEN 系统 SHALL **不重新生成**已被破坏的资源点和设施（战争破坏是永久的，直到战争结束后重建）
4. WHEN 战线推进到某个区段但未突破下一个 checkpoint THEN 系统 SHALL 在 UI 上显示"距下一关键节点 X%"的进度提示
5. WHEN 战线到达 0 或 100 THEN 系统 SHALL 标记该战线为 `collapsed`，触发战争结算

### 需求 3：动态资源点映射真实经济

**用户故事：** 作为玩家，我希望战线上的资源点和设施是从我（或敌方）真实拥有的建筑中映射而来的，以便破坏它们会对对方造成切实的经济打击

#### 验收标准

1. WHEN 战线推进到**敌方的某个区段** THEN 系统 SHALL 根据敌方**真实拥有的建筑**（`buildings: {buildingId: count}`）动态生成该区段的资源点：
   - **前沿区段**（35-50 / 50-65）：暴露敌方 `cat: 'military'` 和 `cat: 'gather'` 类建筑
   - **经济区段**（15-35 / 65-85）：暴露敌方 `cat: 'industry'` 和 `cat: 'civic'` 类建筑
   - **核心区段**（0-15 / 85-100）：暴露敌方全部建筑（包括住宅和关键基础设施）
   - 每个区段生成 2-4 个资源点，每个点对应一个具体的 `buildingId`
   - 资源点的 `amount` 应在合理范围（50~2000），基于建筑产出量 × 小系数（2-5天的产出）
2. WHEN 敌方资源点被掠夺或破坏 THEN 系统 SHALL **直接减少敌方对应建筑的 count**：
   - 掠夺一个资源点 = 敌方该建筑 count -1（建筑被缴获/破坏）
   - 该建筑的产出、工作岗位、人口容量等立即在下一个经济 tick 中生效
   - 如果是 AI 敌方，修改 `nation.economy.buildings[buildingId]` count
   - 如果是玩家被攻入，修改玩家的 `buildings` state（通过 `setBuildings`）
3. WHEN 核心区段被攻入（linePosition ≤ 15 或 ≥ 85）THEN 系统 SHALL 额外造成**人口损失**：
   - 每日损失 `0.5% × (区段深入程度)` 的人口（代表平民伤亡和难民逃离）
   - 对于玩家：通过现有 population 机制减少
   - 对于 AI：减少 `nation.population`
4. WHEN 己方区段被攻入 THEN 系统 SHALL 同样暴露**己方**的真实建筑作为资源点：
   - 敌方（AI）会在每次成功的摩擦事件或战斗胜利中自动掠夺/破坏己方资源点
   - 己方被破坏的建筑 count 同样 -1，立即影响经济
5. WHEN 战争结束 THEN 系统 SHALL 保留所有建筑损毁结果（不自动恢复），玩家需要战后手动重建被破坏的建筑

### 需求 4：战争经济压力模型

**用户故事：** 作为玩家，我希望战争对经济产生切实的持续压力，以便战争有紧张感和资源管理的策略性

#### 验收标准

1. WHEN 玩家处于战争状态（存在活跃战线）THEN 系统 SHALL 每天对玩家施加**基础战争维持成本**：
   - 粮食消耗：`部署兵力 × 0.3 / 天`（军队粮饷）
   - 银币消耗：`部署兵力 × 0.1 / 天`（军队饷银）
   - 该成本从玩家资源中直接扣除，不足时军团士气每天下降 2-5 点
2. WHEN 战线推进对玩家不利（被反推跨越 checkpoint）THEN 系统 SHALL 基于**被攻入的区段深度**施加额外经济惩罚：
   - 前沿被攻入：产出 -5%
   - 经济区被攻入：产出 -15%，银币收入 -20%
   - 核心区被攻入：产出 -25%，银币收入 -40%，人口每日流失
3. WHEN 战争持续超过30天 THEN 系统 SHALL 施加**战争疲劳**修正：
   - 每30天战争持续，全局稳定性 -2
   - 军事阶层满意度 +3（主战）、商人阶层满意度 -3（厌战）
   - UI 上在经济压力行显示战争维持成本明细
4. IF 玩家资源（粮食或银币）降至0 AND 战争仍在持续 THEN 系统 SHALL 触发**补给危机**：部署军团每日损失 1-2% 兵力（逃兵），士气每日 -5
5. WHEN 敌方建筑被破坏 THEN 该经济惩罚反过来施加到敌方（AI nation 的 economy 受损）

### 需求 5：让战斗能持续多个回合

**用户故事：** 作为玩家，我希望发起的进攻能持续多个回合展开战斗过程，以便有时间进行战术调整和体验战斗的紧张感

#### 验收标准

1. WHEN 战斗因 momentum 达到 `MOMENTUM_ROUT_THRESHOLD`(80) 而结束 THEN 系统 SHALL 将 rout 的最低回合要求从 3 提高到 `max(5, maxRounds × 0.3)`
2. WHEN 战斗双方兵力悬殊超过 10:1 THEN 系统 SHALL 使用 `skirmish` 类型（3-5回合快速结束），而非 `siege`
3. WHEN momentum 在一轮中变化超过 15 THEN 系统 SHALL 限制单轮 momentum 最大变化量为 8，防止一轮即决
4. WHEN 战斗结束（任何原因）THEN 系统 SHALL 在下一次 tick 中正确同步军团状态

### 需求 6：战术姿态量化反馈

**用户故事：** 作为玩家，我希望在选择战术姿态时能看到量化的效果说明，以便做出有意义的战术决策

#### 验收标准

1. WHEN 玩家选择战术姿态 THEN UI SHALL 在姿态按钮下方显示量化效果：
   - 主动袭扰：「敌军伤亡+50%, 我军伤亡+20%, 推进速度+0.8/天」
   - 积极防御：「标准伤亡率, 推进速度保持不变」
   - 消极防守：「双方伤亡-50%, 推进速度-0.5/天」
2. WHEN 姿态切换 THEN 系统 SHALL 在战线日志中记录一条姿态变更事件
3. WHEN 当前姿态为"主动袭扰"AND 前线摩擦事件触发 THEN UI SHALL 使用橙色高亮显示该事件

### 需求 7：战线推进可视化增强

**用户故事：** 作为玩家，我希望能直观地看到战线推进的阶段状态和 checkpoint，以便理解当前战局态势

#### 验收标准

1. WHEN 渲染战线推进条 THEN UI SHALL 将推进条分为 7 个可视区段（与需求 2 的 checkpoint 对应），每个区段用不同的颜色区分：
   - 守方核心区：深红色
   - 守方经济区：橙色
   - 守方前沿：浅黄色
   - 中立线：灰色竖线分隔
   - 攻方前沿：浅蓝色
   - 攻方经济区：蓝色
   - 攻方核心区：深蓝色
   - 已被攻入的区段使用半透明叠加+斜线纹理标记
2. WHEN `linePosition` 跨越 checkpoint THEN UI SHALL 使用闪烁动画高亮该 checkpoint 节点持续 2 秒
3. WHEN 战线处于敌方经济区或核心区（linePosition ≥ 65）THEN UI SHALL 在战线标题旁显示绿色标签「💪 战线优势 - 正在破坏敌方经济」
4. WHEN 战线处于己方经济区或核心区（linePosition ≤ 35）THEN UI SHALL 显示红色警示标签「⚠️ 战线告急 - 我方经济遭受破坏」
5. WHEN 展开战线详情 THEN UI SHALL 按区段分组显示资源点和设施，未到达的区段显示为灰色"未探索"

## 技术约束与边界情况

### 数据模型扩展
- Front 对象新增字段：
  - `zones`: `{ zoneId: { type, ownerId, checkpointStart, checkpointEnd, resourceNodes[], infrastructure[], reached: boolean, cleared: boolean } }` — 区段详情
  - `destroyedBuildings`: `{ nationId: { buildingId: destroyedCount } }` — 战争期间累计破坏的建筑
- 现有 `resourceNodes[]` 和 `infrastructure[]` 改为按区段组织，向后兼容：旧战线在 `ensureFrontDefaults` 中迁移到 zone 0 / zone 6

### 数值一致性
- 战争维持成本：中期玩家银币收入约 100-500/天，军队 500-5000 人，`0.1 银币/人/天` = 50-500 银币/天，约收入 10%-100%
- 建筑破坏影响：破坏一个 `farm`（产出 food 4.8/tick）= 直接减少 4.8 food/tick 的产出，影响显著但不致命
- 资源点 amount 限制在 50-2000：使用 `outputRate × count × (2~5)` 代替旧的 `50-100` coefficient
- 人口损失率 0.5%/天 在核心区被攻入时 = 百万人口城市每天损失 5000 人，30天 ≈ 15% 人口

### 旧存档兼容
- 已有 `activeFronts` 中没有 `zones` 字段 → `ensureFrontDefaults` 需要从旧的 `resourceNodes[]` 迁移
- 已有 AI 军团兵力为 0 → 下次 tick 时校验并补充
- `generateNationArmy` 修改不影响非战线场景

### 经济系统耦合
- 建筑破坏通过 `setBuildings(prev => ({...prev, [buildingId]: Math.max(0, prev[buildingId] - 1)}))` 实现
- AI 国家建筑破坏通过修改 `nation.economy.buildings` 实现
- 玩家建筑被破坏后，对应的工作岗位、产出、人口容量全部自动减少（已有的 simulation.js 计算流程自然处理）
- 战后不自动恢复，玩家需手动重建

### 性能约束
- checkpoint 跨越检测在已有的 `processFrontAdvance` 中完成，不新增独立 tick
- 区段资源点生成是懒加载的（仅在首次到达时生成），不在战线创建时全部生成
- 每日战争维持成本在 simulation.js 已有的 `getFrontlineEconomicModifiers` 调用点中完成

### UI 限制
- 所有新 UI 元素必须使用已有 WarfrontCard 的设计语言
- checkpoint 可视化使用 CSS gradient + 绝对定位标记实现，不引入新的 UI 库
