# 理念系统重设计方案 — 需求文档

## 引言

当前理念系统本质上是"另一套科技/政策"——每个理念提供 `scienceBonus +8%`、`stability +5` 这类平面数值加成，玩家选择理念时只需比较谁的数字更大，缺乏构建（build）的深度和联动乐趣。

本方案的核心目标是：**将理念系统从"被动数值buff列表"重设计为一个深度 build-crafting 系统**，参考《杀戮尖塔》/《小丑牌》的设计哲学：

1. **效果机制化，而非数值化**：理念效果应该改变游戏规则、触发链式反应，而非简单加减数字
2. **强调联动组合（Synergy）**：理念之间、理念与游戏系统（建筑/战争/官员/经济）之间要有深度互动
3. **build 路径多样化**：玩家应该能根据自己的游戏风格组装出不同的"引擎"——军事引擎、经济引擎、文化引擎等
4. **决策有代价（Tradeoff）**：强力理念必须有显著的负面效果或条件限制

### 设计原则

- **"改规则" > "改数字"**：好的理念应该是"每建造一个建筑回复 5 稳定度"而非"稳定度 +5%"
- **"触发 + 条件" > "被动"**：效果应该基于玩家的行为或游戏状态动态触发
- **"引擎 build" > "数值堆叠"**：鼓励玩家组装互相增幅的理念组合
- **"少而精" > "多而杂"**：每个理念都应该让玩家说"哇，这个能和那个配合"

### 约束条件（基于现有架构）

现有 civ-game 架构中可以安全扩展的联动点：
- **bonuses 效果管道**：支持 `buildingBonuses`、`categoryBonuses`、`passiveGains`、`perPopPassiveGains`、`incomePercentBonus`、`stabilityBonus`、`scienceBonus`、`cultureBonus`、`militaryBonus`、`maxPopPercent`、`productionBonus`、`taxBonus`、`needsReduction` 等20+字段
- **triggerEffects 框架**：已有 7 种触发类型（`stratum_bonus`、`pop_ratio_bonus`、`chain_count_bonus`、`tech_count_bonus`、`resource_threshold`、`building_count_bonus`、`epoch_scaling`），可扩展新类型
- **simulation tick 循环**：每 tick 可访问完整游戏状态（建筑、人口、资源、战争状态、官员、稳定度等）
- **ideologyTriggerState**：在 simulation.js 中构建，可扩展传入更多游戏状态字段
- **IDEOLOGY_SYNERGIES**：已有联动配置机制

---

## 需求

### 需求 1：新增 "事件驱动" 触发效果类型

**用户故事：** 作为一名策略游戏玩家，我希望理念的效果能响应我的游戏行为（如建造建筑、打赢仗、研发科技），以便感受到理念与我的操作之间的深度互动，而非仅仅是被动的数值加成。

#### 支持的事件锚点全清单

以下是从代码中深度挖掘的所有可用事件触发锚点，按系统分类：

##### A. 玩家主动操作类（锚点在 `useGameActions.js`）
| 事件ID | 触发时机 | 代码锚点 | 可用 eventData |
|--------|----------|----------|----------------|
| `on_build` | 玩家建造建筑 | `buyBuilding()` 成功后 (~L1307) | `{ buildingId, category, count, totalBuildings }` |
| `on_upgrade` | 玩家升级建筑 | `upgradeBuilding()` 成功后 (~L1518) | `{ buildingId, fromLevel, toLevel }` |
| `on_tech_unlock` | 玩家解锁科技 | 科技解锁逻辑成功后 | `{ techId, techCount }` |
| `on_epoch_advance` | 玩家进入新时代 | `upgradeEpoch()` 中 `setEpoch(epoch+1)` 后 (~L1274) | `{ newEpoch, epochName }` |
| `on_hire_official` | 玩家录用官员 | `hireOfficial()` 成功后 (~L2068) | `{ officialId, officialCount }` |
| `on_fire_official` | 玩家解雇官员 | `fireOfficial()` 调用后 | `{ officialId, officialCount }` |
| `on_treaty_sign` | 玩家签订条约 | `propose_treaty` case 成功后 (~L4003) | `{ nationId, treatyType }` |
| `on_treaty_break` | 玩家撕毁条约 | `break_treaty` case 执行后 (~L4820) | `{ nationId, treatyType }` |
| `on_declare_war` | 玩家主动宣战 | `startWarAgainstPlayer()` 或攻击行动后 | `{ nationId }` |

##### B. 战斗/战争系统类（锚点在 `useGameLoop.js` 战斗处理区域 ~L2780-3070）
| 事件ID | 触发时机 | 代码锚点 | 可用 eventData |
|--------|----------|----------|----------------|
| `on_battle_victory` | 玩家方赢得一场战斗 | 战斗结束 `result.finalized` AND `winner === playerSide` (~L2873) | `{ battleId, enemyId, casualties, durationDays }` |
| `on_battle_defeat` | 玩家方输掉一场战斗 | 战斗结束 `result.finalized` AND `winner !== playerSide` | `{ battleId, enemyId, casualties, durationDays }` |
| `on_war_victory` | 玩家赢得整场战争（对手求和/投降） | nation.isAtWar 变为 false 且 warScore > 0 (~L6001) | `{ nationId, warScore, warDuration }` |
| `on_war_start` | 有国家对玩家宣战 | `startWarAgainstPlayer()` / AI 宣战事件 (~L5360) | `{ nationId, reason }` |

##### C. 经济/贸易系统类（锚点在 `simulation.js` 主循环）
| 事件ID | 触发时机 | 代码锚点 | 可用 eventData |
|--------|----------|----------|----------------|
| `on_trade_complete` | 商人完成一笔贸易 | `simulateMerchantTrade()` 返回后 (~L6975) | `{ profit, volume, nationId }` |
| `on_tax_collect` | 每日税收征收完成 | `calculateFinalTaxes()` 后 | `{ totalTax, headTax, businessTax, tariffs }` |
| `on_subsidy_paid` | 政府发放补贴 | 补贴逻辑执行时 (~L2087/L3106) | `{ stratumKey, amount }` |
| `on_treasury_milestone` | 国库银币达到里程碑 | 每tick检测 `res.silver` 跨越阈值 | `{ milestone, treasury }` |
| `on_chain_complete` | 玩家完成一条产业链 | `BUILDING_CHAINS` 遍历检测到新完成的链 (~L1305) | `{ chainId, chainName }` |

##### D. 人口/社会系统类（锚点在 `simulation.js`）
| 事件ID | 触发时机 | 代码锚点 | 可用 eventData |
|--------|----------|----------|----------------|
| `on_pop_milestone` | 人口达到里程碑(100/500/1000等) | 人口增长计算后 (~L6393) | `{ population, milestone }` |
| `on_starvation` | 发生饥荒死亡 | `starvationDeaths > 0` (~L6430) | `{ deaths, stratumKey }` |
| `on_living_standard_change` | 某阶层生活水平等级变化 | `classLivingStandard` 计算完毕后 (~L4769)，与上tick比较 | `{ stratumKey, oldLevel, newLevel }` |
| `on_class_approval_low` | 某阶层满意度低于阈值 | `classApproval` 计算后检测 | `{ stratumKey, approval }` |

##### E. 稳定/政治系统类（锚点在 `simulation.js` + `useGameLoop.js`）
| 事件ID | 触发时机 | 代码锚点 | 可用 eventData |
|--------|----------|----------|----------------|
| `on_stability_crisis` | 稳定度跌破 20 | `calculateStability` 后检测 (~L5341) | `{ stability }` |
| `on_stability_high` | 稳定度超过 80 | `calculateStability` 后检测 | `{ stability }` |
| `on_rebellion_start` | 叛乱进入活跃阶段 | 叛乱系统检测到 `ACTIVE` 阶段 | `{ stratumKey, rebellionType }` |
| `on_legitimacy_change` | 合法性大幅变动 | `coalitionLegitimacy` 计算后 | `{ legitimacy, delta }` |

##### F. 外交/国际关系类（锚点在 `simulation.js` 外交处理区域 + `useGameLoop.js`）
| 事件ID | 触发时机 | 代码锚点 | 可用 eventData |
|--------|----------|----------|----------------|
| `on_relation_improve` | 与某国关系提升至友好(>60) | 关系变化后检测 | `{ nationId, relation }` |
| `on_relation_hostile` | 与某国关系恶化至敌对(<30) | 关系变化后检测 | `{ nationId, relation }` |
| `on_vassal_gain` | 获得新附庸 | `vassalOf = 'player'` 时 | `{ nationId, vassalType }` |
| `on_ally_request` | 收到盟友求助/请求 | 盟友事件触发时 | `{ nationId, requestType }` |

##### G. 时间/周期类（锚点在 `simulation.js` tick 计数）
| 事件ID | 触发时机 | 代码锚点 | 可用 eventData |
|--------|----------|----------|----------------|
| `on_year_end` | 每年结束（每360天） | `tick % 360 === 0` | `{ year, daysElapsed }` |
| `on_season_change` | 季节更替（每90天） | `tick % 90 === 0` | `{ season, daysElapsed }` |
| `per_N_days` | 每N天定时触发 | 可配置的tick间隔检测 | `{ daysElapsed }` |

#### 验收标准

1. WHEN 玩家装备了含有 `onEvents` 的理念 AND 对应事件发生 THEN 系统 SHALL 执行该理念配置的效果（如：回复稳定度、获得文化、获得理念分数、添加 buff 等）
2. WHEN 系统 SHALL 支持上述 A~G 分类中列出的所有事件锚点，每个事件的 `eventData` 包含表中列出的上下文信息
3. WHEN 事件驱动效果包含 `condition` 字段 THEN 系统 SHALL 仅在条件满足时触发（如 `{ "category": "military" }` 表示仅军事建筑触发）
4. IF 事件驱动效果有 `cooldownDays` 配置 THEN 系统 SHALL 在冷却期内不重复触发同一效果
5. IF 事件驱动效果有 `maxTriggers` 配置 THEN 系统 SHALL 在达到最大触发次数后永久停止该效果
6. WHEN 事件驱动效果触发 THEN 系统 SHALL 在游戏日志中显示紫色高亮的触发信息 "[理念] ..."，让玩家感知到理念在生效
7. WHEN 事件触发的效果包含 `addBuff` 类型 THEN 系统 SHALL 向 `activeEventEffects` 管道添加带衰减的时限性 buff（复用现有事件效果框架）

### 需求 2：新增 "转化引擎" 效果类型

**用户故事：** 作为一名喜欢 build 组装的玩家，我希望有些理念能将一种资源/状态转化为另一种收益，以便我能构建出独特的"引擎"——比如把军事力量转化为经济收入，或把文化积累转化为科研加速。

#### 验收标准

1. WHEN 玩家装备了含有 `convert` 效果的理念（如"重商主义"：每 1000 银币库存提供 +2% 军事力量）THEN 系统 SHALL 每 tick 根据源资源数量计算并应用转化后的加成
2. WHEN 玩家装备了含有 `official_convert` 效果的理念（如"科举治国"：每个官员提供额外 +3% 科研）THEN 系统 SHALL 根据当前官员数量动态计算加成
3. WHEN 玩家装备了含有 `building_convert` 效果的理念（如"军国主义"：每个军事建筑提供 +1% 生产力）THEN 系统 SHALL 根据指定类别的建筑数量计算加成
4. WHEN 玩家装备了含有 `pop_convert` 效果的理念（如"集体主义"：总人口每 100 人提供 +1 稳定度）THEN 系统 SHALL 根据人口数量计算加成
5. IF 转化效果存在上限配置 THEN 系统 SHALL 将效果限制在上限值以内，防止数值爆炸
6. WHEN 多个转化引擎叠加 THEN 系统 SHALL 使用加法叠加，且总效果受全局上限约束

### 需求 3：新增 "规则修改" 效果类型

**用户故事：** 作为一名追求独特玩法的策略玩家，我希望有些理念能改变游戏的基础规则（如免费建造特定建筑、降低冷却时间、改变价格机制），以便感受到每局游戏因理念选择不同而产生的差异化体验。

#### 验收标准

1. WHEN 玩家装备了含有 `rule_mod` 效果的理念（如"行会制度"：工业建筑建造成本 -15%）THEN 系统 SHALL 修改对应的游戏参数
2. WHEN 玩家装备了含有 `rule_mod` 类型为 `building_cost_mod` 的理念 THEN 系统 SHALL 在建筑成本计算时应用折扣修正
3. WHEN 玩家装备了含有 `rule_mod` 类型为 `official_bonus` 的理念（如"儒家思想"：官员额外提供文化被动）THEN 系统 SHALL 在官员效果聚合时附加额外效果
4. WHEN 玩家装备了含有 `rule_mod` 类型为 `tax_modifier` 的理念（如"重农主义"：农业税减半但农田产出 +20%）THEN 系统 SHALL 同时修改税率和产出
5. WHEN 玩家装备了含有 `rule_mod` 类型为 `cooldown_mod` 的理念（如"官僚主义"：理念更换冷却时间减半）THEN 系统 SHALL 修改对应的冷却时间计算
6. IF 规则修改效果在玩家卸下理念后 THEN 系统 SHALL 立即撤销该规则修改

### 需求 4：重新设计理念联动（Synergy）为 "组合引擎"

**用户故事：** 作为一名 Roguelike 卡牌游戏爱好者，我希望理念之间的联动不只是"两个一起装就加数值"，而是能产生质变的新机制，以便体验到组装强力 build 的成就感。

#### 验收标准

1. WHEN 玩家同时装备了联动组合中的所有必需理念 THEN 系统 SHALL 激活联动的 `mechanicEffect`（机制效果），而非仅仅是数值加成
2. WHEN 联动的 `mechanicEffect` 类型为 `auto_build` THEN 系统 SHALL 定期自动建造指定类型的建筑（如"田园牧歌"联动：每 60 天自动建造一个农田）
3. WHEN 联动的 `mechanicEffect` 类型为 `resource_echo` THEN 系统 SHALL 在获得指定资源时额外获得一定比例的另一种资源（如"科学革命"联动：获得科研时额外获得 10% 的文化）
4. WHEN 联动的 `mechanicEffect` 类型为 `crisis_immunity` THEN 系统 SHALL 提供对特定负面事件的免疫或大幅减弱
5. WHEN 联动的 `mechanicEffect` 类型为 `epoch_rush` THEN 系统 SHALL 降低进入下一时代的成本
6. IF 玩家卸下联动中任一必需理念 THEN 系统 SHALL 立即停用该联动的所有机制效果

### 需求 5：重新设计理念数据模型以支持多层效果

**用户故事：** 作为一名开发者，我需要理念的数据模型能够支持新的效果类型（事件驱动、转化引擎、规则修改），以便在配置文件中灵活定义丰富多样的理念效果。

#### 验收标准

1. WHEN 在理念配置中定义 `effects.onEvents` 数组 THEN 系统 SHALL 识别并注册事件驱动触发器，每个条目包含 `{ event, effect, cooldownDays?, maxTriggers?, condition? }`
2. WHEN 在理念配置中定义 `effects.converters` 数组 THEN 系统 SHALL 识别并每 tick 评估转化引擎，每个条目包含 `{ source, sourceType, ratio, target, targetType, cap? }`
3. WHEN 在理念配置中定义 `effects.ruleMods` 数组 THEN 系统 SHALL 识别并在相关系统中应用规则修改，每个条目包含 `{ type, scope, value }`
4. WHEN 在理念配置中定义 `effects.levels` 时 THEN 系统 SHALL 保持向后兼容——现有的纯数值效果（`stability`、`scienceBonus`、`categories` 等）继续工作
5. IF 效果字段包含新增的 `onEvents`/`converters`/`ruleMods` THEN 系统 SHALL 将其作为该理念等级的增强效果，随等级提升数值缩放
6. WHEN 理念升级到更高等级 THEN `onEvents` 的触发效果数值增加（按 level 1/1.5/2.0 缩放），`converters` 的转化比率增加，`ruleMods` 的修改值增强

### 需求 6：扩展 `ideologyTriggerState` 以支持全状态访问

**用户故事：** 作为一名开发者，我需要在理念效果评估时能够访问完整的游戏状态，以便新的触发效果类型能正确判断条件（如战争状态、官员数量、近期事件等）。

#### 验收标准

1. WHEN 系统在 simulation tick 中构建 `ideologyTriggerState` THEN 系统 SHALL 包含以下新增字段：
   - `officialCount`: 当前在任官员数量
   - `isAtWar`: 是否处于战争状态
   - `warScore`: 当前战争分数（如处于战争中）
   - `totalBuildings`: 总建筑数量
   - `stability`: 当前稳定度值
   - `population`: 当前总人口
   - `treasury`: 当前银币数量
2. WHEN 新增字段值发生变化 THEN 系统 SHALL 在下一 tick 中反映最新值
3. IF 某些字段来源不可用（如未处于战争状态时 warScore） THEN 系统 SHALL 使用默认值（0/false）

### 需求 7：重新设计约 15 个代表性理念以展示新机制

**用户故事：** 作为一名玩家，我希望理念的效果描述能让我立刻感受到"这不是简单的数字加成"，每个理念都有独特的机制和 build 潜力，以便我在三选一时面临有意义的抉择。

#### 验收标准

1. WHEN 重设计完成 THEN 系统 SHALL 包含至少 15 个使用新效果类型（事件驱动/转化引擎/规则修改）的理念，覆盖所有 8 个分类
2. WHEN 重设计完成 THEN 每个理念 SHALL 至少包含一个非纯数值效果（`onEvents`/`converters`/`ruleMods` 之一）
3. WHEN 重设计完成 THEN 至少有 3 个明显的 "build 路径"：
   - **军事引擎 build**：通过军事理念组合形成 "打仗越多越强" 的正反馈循环
   - **经济引擎 build**：通过经济理念组合形成 "钱生钱" 的复利引擎
   - **文化/科研引擎 build**：通过文化/科学理念形成 "知识爆炸" 的加速引擎
4. WHEN 重设计完成 THEN 每个理念 SHALL 有明确的 tradeoff（如强力军事效果必须牺牲经济/文化）
5. WHEN 重设计完成 THEN 至少有 5 个理念的联动效果包含 `mechanicEffect`（机制级联动，而非纯数值联动）

### 需求 8：升级理念 UI 卡片展示以呈现新效果

**用户故事：** 作为一名玩家，我希望理念卡片能清晰展示新的效果类型——事件触发、转化引擎、规则修改等应该有直观的图标和描述，以便我在选择理念时能快速理解它的机制。

#### 验收标准

1. WHEN 理念卡片包含 `onEvents` 效果 THEN UI SHALL 用闪电图标 ⚡ 和描述格式 "⚡ 每次[事件]: [效果]" 展示
2. WHEN 理念卡片包含 `converters` 效果 THEN UI SHALL 用循环图标 🔄 和描述格式 "🔄 每[N]个[源]: [效果]" 展示
3. WHEN 理念卡片包含 `ruleMods` 效果 THEN UI SHALL 用齿轮图标 ⚙️ 和描述格式 "⚙️ [规则]: [修改]" 展示
4. WHEN 事件驱动效果触发 THEN 理念卡片 SHALL 显示触发次数计数器（如 "⚡ 已触发 5 次"）
5. WHEN 联动效果包含 `mechanicEffect` THEN 联动卡片 SHALL 用金色边框和特殊标记区分于纯数值联动
6. IF 理念效果有冷却/上限 THEN UI SHALL 在效果描述后显示 "(冷却: N天)" 或 "(上限: N)"

### 需求 9：保持向后兼容和数值平衡

**用户故事：** 作为一名开发者，我需要确保新设计不破坏现有存档和游戏平衡，以便已有玩家可以无缝过渡到新系统。

#### 验收标准

1. WHEN 加载旧存档（包含旧格式理念数据）THEN 系统 SHALL 正确识别并按旧逻辑执行，不产生错误
2. WHEN 旧格式理念被装备 THEN 系统 SHALL 仅应用其 `effects.levels` 中的数值效果，新增字段(`onEvents`/`converters`/`ruleMods`)默认为空
3. IF 转化引擎或事件驱动效果的数值产出过高 THEN 系统 SHALL 有全局上限机制防止数值爆炸
4. WHEN 数值平衡检查时 THEN 单个理念通过新效果产生的等效加成 SHALL 不超过旧系统中同等级理念效果的 2 倍
5. IF 存在 bug 导致效果无限叠加 THEN 系统 SHALL 有 safety cap 限制任何单项加成的最大值

---

## 示例 Build 路径（设计参考，非硬性需求）

### Build A: "铁血工业" 引擎
- **法家思想** (onEvent: 每建一个工业建筑 +3 稳定度) + **国家资本主义** (converter: 每个工业建筑 +2% 生产力) + **军国主义** (converter: 生产力转化为军事力量)
- 联动"铁血政策"：激活 mechanicEffect `industrial_war_machine`（战争期间工业建筑产出翻倍）

### Build B: "知识帝国" 引擎
- **经验主义** (onEvent: 每解锁科技获得文化) + **人文主义** (converter: 每 10 文化提供 +1% 科研) + **科学方法** (ruleMod: 科技成本 -10%)
- 联动"科学革命"：激活 mechanicEffect `knowledge_cascade`（科研产出溢出为理念分数）

### Build C: "贸易帝国" 引擎
- **重商主义** (onEvent: 每完成一条产业链 +500 银币) + **海权论** (converter: 银币库存转化为军事力量) + **自由放任** (ruleMod: 市场价格波动减半)
- 联动"无形之手"：激活 mechanicEffect `trade_snowball`（贸易收入的 5% 自动转化为科研和文化）
