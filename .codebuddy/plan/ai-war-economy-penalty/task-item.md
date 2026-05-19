# 任务规划：AI战时经济惩罚真实化

## 现有机制摘要

### 已实现（上一轮军事补兵需求中）
- `useGameLoop.js`：玩家-AI战线持续经济衰减（基础0.3%/tick + 本土压力加成 + 人口压力）
- `aiWar.js`：AI回填率降低（战时0.05%基础率）、回填消耗wealth、征兵消耗人口
- `useGameLoop.js`：战斗伤亡（摩擦战+会战）扣减AI人口

### 未实现（本轮需求）
- `getFrontlineEconomicModifiers` 的 productionPenalty/taxEfficiencyPenalty 未应用到AI
- `getAIWarGrowthRetention` 不感知战线位置（固定0.50~0.72）
- 本土压力不影响AI人口增长和sustainableArmy目标
- 缺少经济崩溃状态触发机制

---

## 任务列表

### 任务1：战线经济惩罚应用到AI国家（需求1+4补充）
- **文件**: `src/hooks/useGameLoop.js`
- **位置**: 现有的"玩家-AI战线持续经济衰减"代码块（L4400-4465）
- **方案**: 在现有衰减块中，为每条活跃战线调用 `getFrontlineEconomicModifiers(front, enemyId, ...)` 获取 `productionPenalty` 和 `taxEfficiencyPenalty`，将 `productionPenalty` 叠加到 `wealthDecayRate`（`wealthDecayRate += productionPenalty * 0.02`），将 `taxEfficiencyPenalty` 存储到AI国家的临时属性 `_warTaxPenalty` 供增长系统使用
- **依赖**: 需要在 useGameLoop.js 中导入 `getFrontlineEconomicModifiers`（已在 FrontViewPanel 中使用）
- **验收**: 战线95%时，AI的wealth衰减率应从当前的~1.4%/tick增加到~3%/tick（叠加productionPenalty 80% × 0.02 = 1.6%）

### 任务2：AI经济增长系统感知战线位置（需求2）
- **文件**: `src/logic/diplomacy/aiEconomy.js`
- **位置**: `processAIIndependentGrowth` 函数（L262-420）和 `getAIWarGrowthRetention` 函数（L41-45）
- **方案**: 
  1. 扩展 `processAIIndependentGrowth` 参数，新增 `activeFronts` 可选参数
  2. 在函数内部计算AI国家的最大战线入侵深度（`maxHomelandPressure`）
  3. 修改 `warPenalty` 计算：当有战线入侵时，根据入侵深度动态调整保留率
     - 边境区(0~0.33): 保留率0.60
     - 经济区(0.33~0.78): 保留率0.30
     - 核心区(0.78~0.93): 保留率0.10
     - 极端(>0.93): 保留率0.0 + GDP负增长
  4. 同时修改 `updateAIDevelopment` 中的 `warPenalty` 逻辑
- **依赖**: 需要在 `simulation.js` 中传递 `activeFronts` 参数（任务5）
- **验收**: 战线95%时，AI经济增长保留率应从0.50~0.72降至0.0，经济停滞

### 任务3：本土压力影响AI人口增长和sustainableArmy（需求3）
- **文件**: `src/logic/diplomacy/aiWar.js` + `src/logic/diplomacy/aiEconomy.js`
- **位置**: 
  - `aiWar.js`: `syncAINationMilitary` 中 `sustainableArmy` 计算后（L2800附近）
  - `aiEconomy.js`: `processAIIndependentGrowth` 中人口增长计算
- **方案**:
  1. 在 `syncAINationMilitary` 中，从 `updatedNation._warHomelandPressure`（由任务1写入）读取本土压力
  2. 当 `homelandPressure >= 80` 时，缩减 `sustainableArmy`：`sustainableArmy *= (1 - (pressure - 80) / 40)`
  3. 在 `processAIIndependentGrowth` 中，当 `homelandPressure >= 100` 时停止人口增长并施加衰减
- **依赖**: 任务1（写入 `_warHomelandPressure`）
- **验收**: 本土压力100时，sustainableArmy应降低50%，人口增长停滞

### 任务4：经济崩溃状态触发（需求4补充）
- **文件**: `src/logic/diplomacy/aiWar.js`
- **位置**: `syncAINationMilitary` 中 `sustainableArmy` 计算后
- **方案**: 当 `wealth < population × 0.3` 时，额外将 `sustainableArmy` 乘以0.5，迫使AI裁军
- **依赖**: 无
- **验收**: AI wealth极低时，sustainableArmy应降至正常值的50%

### 任务5：传递战线信息到AI经济系统（需求2依赖）
- **文件**: `src/logic/simulation.js`
- **位置**: `AIEconomyService.update` 调用处（L6119）
- **方案**: 在调用前，从 `activeFronts` 中提取与当前AI国家相关的战线信息，计算 `maxHomelandPressure`，写入 `nation._warHomelandPressure` 临时属性
- **依赖**: 无
- **验收**: AI国家对象上应有 `_warHomelandPressure` 属性反映战线入侵深度

### 任务6：构建验证与数值校验
- **文件**: 所有修改的文件
- **方案**: `npm run build` 验证无编译错误，`read_lints` 验证无lint错误
- **依赖**: 任务1-5全部完成

---

## 实施顺序

```
任务5（传递战线信息） → 任务1（经济惩罚应用） → 任务2（增长感知战线） → 任务3（本土压力） → 任务4（经济崩溃） → 任务6（验证）
```

任务5是基础设施，为后续任务提供数据；任务1-4可以在任务5完成后并行或顺序实施。

---

## 数值推演（战线95%场景）

| 机制 | 修改前 | 修改后 |
|---|---|---|
| **wealth衰减/tick** | ~1.4%（仅持续衰减） | ~3.0%（+productionPenalty 80%×0.02） |
| **经济增长保留率** | 0.50~0.72（固定） | 0.0（极端位置，经济停滞） |
| **GDP变化** | 正增长（减少28%~50%） | 负增长（-0.5%/tick） |
| **人口增长** | 正常增长（减少28%~50%） | 停滞+衰减（-0.03%/tick） |
| **sustainableArmy** | 基于当前wealth/pop | 降低50%（本土压力100） + 再降50%（经济崩溃） |
| **回填速度** | 1800人/tick | ~450人/tick（sustainableArmy降低→deficit降低→回填降低） |

预期效果：战线95%时，AI的wealth在~30 tick内降至极低，sustainableArmy大幅缩减，军队被迫裁减，形成正反馈循环。
