# 知识与理念系统 — 实施计划

---

- [x] 1. 配置层：知识树前置关系补全与命名重构
  - 修改 `src/config/technologies.js`，为所有现有科技节点（约110+个）补充 `prerequisites` 字段，形成真正的树状依赖关系
  - 设计原则：同时代内形成2-3条独立路线（经济线/军事线/文化线），跨时代衔接自然合理
  - 保留已有 prerequisites 链条（军事线 gunpowder_formula → musket_manufacturing → rifle_engineering → military_industrialization，以及电气/原子/信息时代已有链条）不变
  - 添加运行时校验函数：检查循环依赖和无效引用，控制台输出警告
  - 在 `src/config/gameData.js` 或相关资源配置中，将 `science` 资源的显示名称改为"学识"
  - _需求：1.1、1.2、1.3_

- [x] 2. 效果系统扩展：理念效果引擎
  - 在 `src/logic/buildings/effects.js` 中扩展 `applyEffects` 函数，新增对理念基础效果字段的处理（复用现有 effects 字段格式：buildings/categories/incomePercent/maxPop/scienceBonus/cultureBonus/militaryBonus/stability/perPopPassive 等）
  - 新建 `src/logic/ideology/ideologyEffects.js`，实现理念效果引擎：
    - `applyIdeologyEffects(equippedIdeologies, bonuses, gameState)` — 将所有装备理念的基础数值效果应用到 bonuses
    - `evaluateTriggerEffects(equippedIdeologies, gameState)` — 计算所有条件触发效果（7种类型：stratum_bonus / pop_ratio_bonus / chain_count_bonus / tech_count_bonus / resource_threshold / building_count_bonus / epoch_scaling），返回额外 bonuses
    - `evaluateSynergyEffects(equippedIdeologyIds, synergyConfig)` — 检查联动组合，返回联动 bonuses
    - 效果缓存机制：仅在卡槽变化/相关状态变化时重新计算
  - 在 `src/logic/simulation.js` 的效果叠加管道中（约L1229 applyTechEffects 之后、politEffects 之后）插入理念效果应用调用，叠加顺序：科技 → 政令 → 庆典 → buff/debuff → 政体 → **理念** → 时代
  - _需求：2.4.1、2.4.2、2.4.3、2.6、3.1、3.2_

- [x] 3. 配置层：理念数据与联动定义
  - 新建 `src/config/ideologies.js`，定义 `IDEOLOGIES` 数组（首批约 20-30 个理念，覆盖 8 个分类各 3-4 个），数据结构包含：id / name / category / icon / color / unlockEpoch / desc / rarity / weightModifiers / effects.levels（3级） / effects.triggerEffects
  - 新建 `src/config/ideologySynergies.js`，定义 `IDEOLOGY_SYNERGIES` 数组，每条包含：id / name / required（理念id数组）/ effects / desc
  - 定义理念分类常量 `IDEOLOGY_CATEGORIES`（8种：philosophy/theology/politics/economy/military/aesthetics/science/social）
  - 定义理念分数触发行为常量 `IDEOLOGY_SCORE_TRIGGERS`，包含各行为类型的基础分数和公式
  - _需求：2.5、附录A、附录B_

- [x] 4. 状态管理：理念系统集成到游戏状态
  - 在 `src/hooks/useGameState.js` 中新增以下状态：
    - `ideologyScore`（当前理念分数，number）
    - `ideologyScoreSpent`（已消耗理念分数总量，number）
    - `ideologyCollection`（理念库：`[{ id, level }]`）
    - `equippedIdeologies`（已装备理念id列表：`string[]`）
    - `ideologySlotCount`（当前卡槽数量，初始3）
    - `ideologyCooldowns`（冷却状态：`{ [ideologyId]: remainingDays }`）
    - `ideologyMilestones`（已触发的里程碑记录：`string[]`，防止重复奖励）
    - `pendingIdeologyEmergence`（待处理的理念涌现事件：`null | { candidates: [...] }`）
  - 在 `buildSavePayload` 中添加上述所有字段的序列化
  - 在 `applyLoadedGameState` 中添加上述字段的反序列化与默认值兜底（向前兼容）
  - _需求：2.1、2.3、2.9、3.2_

- [x] 5. 核心逻辑：理念分数获取与涌现触发
  - 新建 `src/logic/ideology/ideologyScoring.js`，实现理念分数获取逻辑：
    - `checkAndAwardIdeologyScore(gameState, prevState)` — 在 simulation tick 中调用，检查各种行为触发条件并累加分数
    - 支持的触发类型：研发知识 / 进入新时代 / 成就达成 / 建筑里程碑 / 人口里程碑 / 战争结果 / 产业链完成 / 阶层和谐 / 危机存活 / 文化繁荣
    - `getEmergenceThreshold(ownedCount)` — 返回下次涌现所需分数 `50 + ownedCount × 30`
    - `checkEmergence(score, ownedCount)` — 检查是否触发涌现事件
  - 在 `src/logic/simulation.js` 的适当位置（tick末尾、状态更新后）调用分数检查逻辑
  - _需求：2.1、2.7_

- [x] 6. 核心逻辑：理念涌现抽取与三选一
  - 新建 `src/logic/ideology/ideologyEmergence.js`，实现涌现机制：
    - `generateEmergenceCandidates(gameState, ideologyCollection)` — 使用加权随机算法从可用理念池中抽取3个候选理念
    - 权重计算：时代匹配(×2) / 行为关联(×1.5) / 阶层关联 / 稀有度 / 互斥限制
    - 已拥有理念允许重复出现（标记为"强化"选项），但已满级(3级)的理念不参与抽取
    - 保证至少1个可选理念（含未拥有或未满级）
    - `selectIdeology(ideologyId, ideologyCollection)` — 处理玩家选择：新增或升级理念（1→2：效果×1.5，2→3：效果×2.0）
  - _需求：2.2、2.8_

- [x] 7. 核心逻辑：卡槽管理与冷却
  - 新建 `src/logic/ideology/ideologySlots.js`，实现卡槽系统：
    - `getMaxSlots(epoch, techsUnlocked, synergyBonuses)` — 根据当前时代和条件计算最大卡槽数（初始3，每时代+1至8，特殊条件最多10）
    - `equipIdeology(ideologyId, state)` — 装备理念到卡槽（检查槽位/冷却/已装备）
    - `unequipIdeology(ideologyId, state)` — 卸下理念（检查冷却）
    - `tickCooldowns(cooldowns)` — 每tick减少冷却天数
    - 冷却期设为30个游戏日
  - _需求：2.3_

- [x] 8. UI：知识Tab重构为多子Tab结构 + 知识树可视化
  - 修改 `src/components/tabs/TechTab.jsx`：
    - 将原有组件包装为"知识树"子Tab内容
    - 添加子Tab切换逻辑（"知识树" / "理念"），参考现有军事/政治Tab的分Tab模式
    - 将所有用户可见的"科技"文案替换为"知识"
    - 标题栏"科技树"改为"知识树"
  - 实现知识树图形化可视化（替代当前的网格平铺列表）：
    - 按依赖深度自动排列节点层级（根节点在左，末端在右）
    - 用有向连线（箭头）表示依赖关系
    - 连线根据解锁状态着色：已研究(高亮) / 可研究(半透明) / 锁定(灰色)
    - 同一层节点水平均匀分布
    - 仍然按时代分组，每个时代独立的树布局
  - 在 `canResearch` 函数中添加前置知识检查逻辑
  - _需求：1.1、1.2、1.4_

- [x] 9. UI：理念子Tab — 卡槽界面与理念库
  - 新建 `src/components/tabs/IdeologyTab.jsx`，实现理念管理界面：
    - 顶部：理念分数进度条（当前分数 / 下次涌现阈值），使用动画展示分数增长
    - 中部：卡槽区域 — 水平排列的理念卡槽，已装备的理念以卡牌形式展示，空槽显示虚线轮廓，锁定槽显示锁图标和解锁条件
    - 下部：理念库 — 所有已获得但未装备的理念卡牌，支持按分类筛选
    - 联动效果展示：当多个已装备理念触发联动时，在卡槽区域显示联动标识和效果说明
  - 新建 `src/components/tabs/IdeologyCard.jsx`，实现理念卡牌组件：
    - 卡牌背景根据分类着色（8种颜色主题）
    - 等级星标（1-3星）
    - 理念图标（使用 lucide-react）
    - 名称、一句话描述、效果标签列表
    - 点击展开详细效果和史实背景描述
    - 联动提示（与卡槽中其他理念的联动）
  - 点击装备/卸下交互（检查冷却和槽位）
  - _需求：2.3、2.10、3.2_

- [x] 10. UI：理念涌现弹窗（三选一）
  - 新建 `src/components/modals/IdeologyEmergenceModal.jsx`，实现涌现弹窗：
    - 全屏半透明遮罩
    - 3张理念卡牌横向排列展示
    - 强化选项标记（已拥有理念显示当前等级和升级预览）
    - 选择交互：点击选中卡牌高亮放大，未选卡牌淡出
    - 使用 framer-motion 实现卡牌翻转/出现/选择动画
    - 自动暂停游戏直到玩家做出选择
  - 在游戏主循环中检测 `pendingIdeologyEmergence` 状态，触发弹窗显示
  - _需求：2.2、2.10_

- [x] 11. 整合与平衡：效果渗透到各子系统 + tooltip 显示
  - 在 `src/logic/simulation.js` 中确保理念效果正确渗透到：
    - 建筑产出计算（通过 bonuses 管道）
    - 军事力量计算（militaryBonus + pop_ratio_bonus 触发效果）
    - 税收/财政计算（incomePercent/taxBonus）
    - 人口上限计算（maxPop/maxPopPercent）
    - 科研/文化产出计算（scienceBonus/cultureBonus）
    - 阶层满意度修正（stabilityBonus + stratum_bonus 触发效果）
  - 在 `src/components/modals/ResourceDetailModal.jsx` 和 `src/components/tabs/BuildingDetails.jsx` 的 tooltip 中添加"理念加成"来源显示
  - 实施效果数值平衡：单个理念加成上限不超过同级科技50%，联动效果上限不超过最强政体80%
  - 实施同类效果软上限递减：`实际加成 = 100% + (超出部分 × 0.5)`
  - 为条件触发效果设置合理的上限(cap)防止数值爆炸
  - _需求：2.6、3.3_

- [x] 12. 理念内容扩充与联动完善
  - 将 `src/config/ideologies.js` 中的理念数据扩充至 60-80 个，覆盖所有 8 个分类每类 5-8 个
  - 每个理念确保：具有明确 unlockEpoch / 3级效果递进 / 至少1个条件触发效果 / 至少参与1个联动 / 史实背景描述
  - 扩充 `src/config/ideologySynergies.js` 联动配置至 15-20 个联动组合
  - 确保不同build路线有明确取舍（trade-off）：军事路线牺牲经济/文化，经济路线牺牲军事/稳定，文化路线牺牲生产效率
  - _需求：2.5、3.3、附录A、附录B_
