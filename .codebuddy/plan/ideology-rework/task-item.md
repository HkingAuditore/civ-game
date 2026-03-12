# 理念系统重设计 — 实施计划

## 依赖关系总览

```
任务1 (事件总线) ──┐
任务2 (数据模型) ──┤
任务3 (效果引擎) ──┼── 任务5 (simulation集成) ── 任务7 (理念数据重写) ── 任务8 (UI升级)
任务4 (联动引擎) ──┘          │
                           任务6 (事件锚点埋点)
                              │
                           任务9 (平衡性 & 兼容性)
```

---

- [x] 1. 创建事件总线（Event Bus）基础设施
   - 在 `src/logic/ideology/` 下新建 `ideologyEventBus.js`
   - 实现轻量级发布/订阅模式：`emit(eventId, eventData)`、`on(eventId, handler)`、`off(eventId, handler)`
   - 支持 `cooldownDays` 和 `maxTriggers` 控制：每次 emit 时检查冷却和触发次数上限
   - 事件触发时生成 `{ ideologyId, eventId, effectResult, timestamp }` 日志条目，使用紫色高亮格式推入游戏日志
   - 支持条件过滤：`condition` 字段与 `eventData` 匹配时才执行效果
   - 事件ID覆盖需求1中 A~G 全部分类（约30个事件类型），定义为常量枚举
   - _需求：1.1, 1.3, 1.4, 1.5, 1.6_

- [x] 2. 扩展理念数据模型
   - 修改 `src/config/ideologies.js`，在现有 `effects.levels[n]` 结构中新增三个可选数组字段：
     - `onEvents: [{ event, effect, cooldownDays?, maxTriggers?, condition? }]`
     - `converters: [{ source, sourceType, ratio, target, targetType, cap? }]`
     - `ruleMods: [{ type, scope, value }]`
   - 现有纯数值字段（`stability`、`scienceBonus`、`categories` 等）保持不变，确保向后兼容
   - `onEvents[].effect` 支持的动作类型：`addResource`（加资源）、`addStability`（加稳定度）、`addBuff`（添加时限buff，复用 activeEventEffects）、`addIdeologyScore`（加理念分数）、`modifyBonus`（临时修改bonuses字段）
   - `converters[].sourceType` 枚举：`resource`（资源数量）、`buildingCount`（建筑类别数量）、`officialCount`（官员数量）、`population`（人口数量）、`stability`（稳定度值）
   - `ruleMods[].type` 枚举：`building_cost_mod`、`official_bonus`、`tax_modifier`、`cooldown_mod`、`price_volatility_mod`、`tech_cost_mod`
   - 效果随等级缩放：L1 = 1.0x, L2 = 1.5x, L3 = 2.0x（复用现有 `levelMultiplier` 逻辑）
   - _需求：5.1, 5.2, 5.3, 5.4, 5.5, 5.6_

- [x] 3. 改造效果引擎 — 新增转化引擎和规则修改处理器
   - 在 `src/logic/ideology/ideologyEffects.js` 中新增两个处理函数：
     - `applyConverters(equippedIdeologies, triggerState, bonuses)`: 遍历所有已装备理念的 `converters`，根据 `sourceType` 从 `triggerState` 读取源值，乘以 `ratio`，写入 `bonuses` 对应的 `targetType` 字段，受 `cap` 上限约束
     - `applyRuleMods(equippedIdeologies, triggerState)`: 遍历所有已装备理念的 `ruleMods`，返回 `activeRuleMods` 对象供其他系统读取（如建筑成本计算、税率计算等）
   - 转化引擎的安全上限（safety cap）：任何单个 converter 的最终加成不超过 50%，所有 converters 总加成不超过 100%
   - 将 `activeRuleMods` 作为 simulation 返回值的一部分，供 `useGameActions.js` 在建筑成本计算等场景读取
   - _需求：2.1~2.6, 3.1~3.6_

- [x] 4. 改造联动引擎 — 新增 `mechanicEffect` 处理
   - 在 `src/config/ideologySynergies.js` 中扩展联动配置，新增 `mechanicEffect` 字段
   - `mechanicEffect` 支持的类型：
     - `auto_build`: `{ type, buildingId, intervalDays }` — 定期自动建造指定建筑
     - `resource_echo`: `{ type, sourceResource, echoResource, ratio }` — 获得资源时额外获得另一种
     - `crisis_immunity`: `{ type, immuneTo }` — 免疫特定负面事件
     - `epoch_rush`: `{ type, costReduction }` — 降低时代升级成本
   - 在 `src/logic/ideology/ideologyEffects.js` 中扩展 `applySynergyEffects`，增加对 `mechanicEffect` 的识别和应用逻辑
   - `auto_build` 通过在 simulation 返回值中添加 `pendingAutoBuilds` 数组实现，由 `useGameLoop.js` 消费执行
   - `resource_echo` 通过在 bonuses 中记录 `resourceEchoes` 映射实现，在资源产出计算后追加
   - _需求：4.1~4.6_

- [x] 5. simulation.js 集成 — 扩展 `ideologyTriggerState` 并接入新引擎
   - 扩展 `ideologyTriggerState` 对象，新增以下字段（从现有游戏状态中读取）：
     - `officialCount`：从 `officials` 参数获取在任官员数（`officials.filter(o => o.hired).length`）
     - `isAtWar`：从传入的 `warState` 或 nation 数据获取
     - `warScore`：从战争状态获取当前 warScore
     - `totalBuildings`：遍历 `buildings` 对象求和
     - `stability`：从当前 tick 计算的 `finalStability` 获取
     - `population`：从 `previousPopStructure` 总人口获取
     - `treasury`：从 `resources.silver` 获取
     - `classLivingStandard`：从当前 tick 计算的生活水平获取
     - `classApproval`：从当前 tick 计算的阶层满意度获取
   - 在理念效果应用管道中，按顺序调用：`applyIdeologyEffects()` → `applyConverters()` → `evaluateTriggerEffects()` → `applySynergyEffects()`
   - 将 `activeRuleMods` 和 `pendingAutoBuilds` 加入 simulation 返回值
   - _需求：6.1~6.3, 需求 3 和 5 的集成_

- [x] 6. 在游戏关键行为点埋设事件锚点
   - [x] 6.1 `useGameActions.js` 中埋设玩家主动操作类锚点（A类）
     - `buyBuilding()` 成功后 emit `on_build`，携带 `{ buildingId, category, count, totalBuildings }`
     - `upgradeBuilding()` 成功后 emit `on_upgrade`，携带 `{ buildingId, fromLevel, toLevel }`
     - 科技解锁后 emit `on_tech_unlock`，携带 `{ techId, techCount }`
     - `upgradeEpoch()` 成功后 emit `on_epoch_advance`，携带 `{ newEpoch, epochName }`
     - `hireOfficial()` / `fireOfficial()` 后分别 emit `on_hire_official` / `on_fire_official`
     - 条约签订/撕毁后 emit `on_treaty_sign` / `on_treaty_break`
     - 宣战后 emit `on_declare_war`
     - _需求：1.2（A类全部锚点）_
   - [x] 6.2 `useGameLoop.js` 中埋设战斗/战争系统类锚点（B类）
     - 战斗结束且 `result.finalized` 时，根据 winner 判断 emit `on_battle_victory` 或 `on_battle_defeat`
     - 战争结束时（`isAtWar` 变 false）emit `on_war_victory`
     - 被宣战时 emit `on_war_start`
     - _需求：1.2（B类全部锚点）_
   - [x] 6.3 `simulation.js` 中埋设经济/人口/稳定/时间类锚点（C~G类）
     - 在商人贸易结算后 emit `on_trade_complete`
     - 在税收计算后 emit `on_tax_collect`
     - 在补贴发放时 emit `on_subsidy_paid`
     - 在银币跨越里程碑阈值时 emit `on_treasury_milestone`
     - 在产业链检测到新完成的链时 emit `on_chain_complete`（与任务5中已实现的 completedChains 比较上一tick）
     - 在人口增长后检测里程碑 emit `on_pop_milestone`
     - 在饥荒死亡发生时 emit `on_starvation`
     - 在生活水平等级变化时 emit `on_living_standard_change`
     - 在阶层满意度低于阈值时 emit `on_class_approval_low`
     - 在稳定度跌破/超过阈值时 emit `on_stability_crisis` / `on_stability_high`
     - 在叛乱阶段变化时 emit `on_rebellion_start`
     - 在合法性大幅变动时 emit `on_legitimacy_change`
     - 在关系跨越阈值时 emit `on_relation_improve` / `on_relation_hostile`
     - 在获得附庸时 emit `on_vassal_gain`
     - `tick % 360 === 0` 时 emit `on_year_end`，`tick % 90 === 0` 时 emit `on_season_change`
     - _需求：1.2（C~G类全部锚点）_

- [x] 7. 重写约 15 个代表性理念数据
   - 从现有 `IDEOLOGIES` 数组中选取 15+ 个理念，重新设计其 effects 以使用新效果类型
   - 必须覆盖全部 8 个分类（经济/政治/军事/社会/哲学/科学/文化/宗教），每类至少 1 个
   - 每个重设计理念至少包含一个 `onEvents` 或 `converters` 或 `ruleMods`
   - 确保至少 3 条 build 路径可行：军事引擎、经济引擎、文化/科研引擎
   - 每个理念必须有明确 tradeoff（如强力军事效果伴随文化/经济负面）
   - 重写 `IDEOLOGY_SYNERGIES` 中至少 5 个联动，使其包含 `mechanicEffect`
   - 保留所有现有理念的基础数值效果（`stability`、`scienceBonus` 等），仅在其基础上追加新效果层
   - _需求：7.1~7.5_

- [x] 8. 升级理念 UI 卡片组件
   - 修改 `src/components/panels/IdeologyCard.jsx`：
     - `onEvents` 效果渲染为 `⚡ 每次[事件名称]: [效果描述]` 格式
     - `converters` 效果渲染为 `🔄 每[N]个[源]: +[X]% [目标]` 格式
     - `ruleMods` 效果渲染为 `⚙️ [规则名称]: [修改值]` 格式
   - 事件驱动效果显示触发计数器（读取事件总线中记录的触发次数）
   - 联动卡片中 `mechanicEffect` 使用金色边框 + 特殊标记区分
   - 效果冷却/上限信息附加在效果描述末尾：`(冷却: N天)` / `(上限: N次)`
   - 确保新效果描述在三选一弹窗和已装备卡槽中均正确渲染
   - _需求：8.1~8.6_

- [x] 9. 向后兼容与平衡性保障
   - 在效果引擎中添加防御性检查：`onEvents`/`converters`/`ruleMods` 为 undefined/null 时跳过处理
   - 旧存档加载时，旧格式理念正常工作（新字段默认为空数组）
   - 添加全局安全上限：
     - 单个 converter 加成上限 50%
     - 所有 converters 总加成上限 100%
     - 事件驱动的 `addResource` 单次上限（银币 ≤ 1000，其他资源 ≤ 100）
     - `addBuff` 持续时间上限 180 天
   - 新效果等效加成不超过旧系统同级理念的 2 倍（通过 cap 值和 ratio 控制）
   - 运行 `npm run build` 验证无编译错误
   - _需求：9.1~9.5_
