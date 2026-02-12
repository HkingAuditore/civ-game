# 实施计划：战线-战斗系统融合

- [x] 1. 在 App.jsx 中绑定缺失的军事回调并传递给 MilitaryTab
   - 在 App.jsx 中实现 `handleAssignCorpsToFront`（调用 `frontSystem.assignCorpsToFront`，同步更新 `activeFronts` + `militaryCorps` 状态）
   - 在 App.jsx 中实现 `handleRemoveCorpsFromFront`（调用 `frontSystem.removeCorpsFromFront`，恢复军团为 idle）
   - 在 App.jsx 中实现 `handleSetBattleTactic`（更新 `activeBattles` 中指定 battle 的玩家 tactic 字段）
   - 将三个回调作为 props 传递给 `<MilitaryTab>`：`onAssignCorpsToFront`、`onRemoveCorpsFromFront`、`onSetBattleTactic`
   - _需求：1.1, 1.2, 1.3, 1.4_

- [x] 2. 在 useGameLoop 中接入战斗回合推进和战线 tick
   - 在 useGameLoop 的每日 tick 中（`runSimulation(...).then(result => {...})` 内部），对 `activeBattles` 中每场 `status === 'active'` 的战斗调用 `processCombatRound`
   - 将战斗回合伤亡同步到对应军团的 `units` 和全局 `army`（减少阵亡单位数量），同步更新 `setMilitaryCorps` 和 `setArmy`
   - 对每条 `status === 'active'` 的战线调用 `processFrontTick`，处理资源再生
   - 当战斗结束（`status` 变为非 active）时，更新 `warScore`、调用战利品结算逻辑、恢复军团状态
   - 扣除战斗补给消耗（food/silver），不足时应用 `getSupplyPenalty`
   - _需求：2.1, 2.2, 2.3, 2.4, 2.5_

- [x] 3. 实现 AI 敌方军团自动生成和战线战斗入口
   - 在 `frontSystem.generateFront` 中（或新建辅助函数）扩展：生成战线时自动为敌方创建 1-3 个 AI 军团（根据 `nation.militaryStrength` 和时代匹配兵种），存储到 `front.enemyCorps`
   - 为每个 AI 军团自动生成将领（复用 `corpsSystem.generateGeneral`）
   - 在 useGameLoop 战斗推进逻辑中，当战线上双方都有军团但无进行中战斗时，每 5-15 天由 AI 发起一次进攻（调用 `createBattle`）
   - 当 AI 军团被消灭时，根据敌国剩余 `militaryStrength` 概率在 30-60 天后补充新 AI 军团
   - 在战线面板中添加"发起进攻"按钮入口：当玩家有已部署军团且敌方有军团时显示；若敌方无军团则显示"扫荡"按钮
   - 调用 `createBattle` 创建战斗，根据双方兵力确定 `battleType`（skirmish/pitched_battle/siege）
   - 同一战线上已有进行中战斗时禁止发起新战斗
   - _需求：3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 4.1, 4.2, 4.3, 4.4, 4.5_

- [x] 4. 实现战斗结果与战线的互动（掠夺/破坏/warScore）
   - 战斗结束后，根据胜负调用 `plunderResourceNode`（掠夺 1-2 个资源点）和 `damageInfrastructure`（破坏 1 个设施）
   - 玩家胜利时将掠夺的资源添加到 `gameState.resources`，败方被掠夺
   - 更新 nation 的 `warScore`：胜方 +20~50，败方 -20~50
   - 若战线上所有敌方资源点和设施均被掠夺/摧毁，标记为"战线压制"状态，增加 AI 求和倾向
   - 将掠夺/破坏信息记录到日志 `addLog`
   - _需求：6.1, 6.2, 6.3, 6.4, 6.5, 6.6_

- [x] 5. 合并"战线"和"战斗"Tab 为统一的"战局"视图
   - 在 MilitaryTab 中将 `activeSection === 'fronts'` 和 `activeSection === 'battle'` 合并为单一的 `activeSection === 'warfront'`（"战局"Tab）
   - 更新 Tab 导航栏：4 个 Tab 变为 3 个（士兵 / 军团 / 战局），"战局"Tab 使用交叉剑+地图图标
   - _需求：5.1, 7.1, 7.4_

- [x] 6. 构建统一战局视图的战线卡片组件 — WarfrontCard
   - 新建 `WarfrontCard.jsx` 组件（或重构 `FrontViewPanel.jsx`），每条活跃战线渲染一张卡片
   - **卡片头部**：敌国名称 + 战争持续天数 + 整体局势指示条（根据 warScore 色彩：绿/黄/红）
   - **兵力对比条**：左（玩家）右（敌方）总兵力宽度比例可视化，用色块对比
   - **已部署军团列表**：每个军团显示名称、兵力数、将领名、士气进度条、状态（待命/战斗中标签）；带"撤回"按钮调用 `onRemoveCorpsFromFront`
   - **增派军团区域**：列出未部署的 idle 军团，点击可调用 `onAssignCorpsToFront` 快速部署
   - **无军团警告**：无部署时显示 `⚠️ 无防御` 警告 + 快速部署按钮
   - **战线资源点和设施**：折叠式展示，已掠夺/被破坏的用灰色删除线+破坏图标标识
   - _需求：5.2, 5.4, 5.6_

- [x] 7. 在 WarfrontCard 中内嵌战斗面板和交互
   - 当战线上有进行中的战斗时，在卡片内嵌展示战斗信息（复用/重构 `ActiveBattlePanel` 的核心 UI）
   - 显示：回合数、态势条（momentum）、双方兵力伤亡实时数据、战术选择按钮
   - 战斗进行中时，卡片边框使用橙色/红色 + 脉冲动画 (`animate-pulse` / `border-orange-500`)
   - 当没有战斗但可以发起进攻时，显示"发起进攻"按钮
   - 点击"发起进攻"弹出确认界面（显示双方预估兵力、战斗类型预测），确认后调用 `createBattle`
   - _需求：5.2(进行中的战斗内嵌面板), 5.3, 5.5, 3.1, 3.2_

- [x] 8. 替代旧军事行动系统
   - 当存在活跃战线时，"战局" Tab 显示 WarfrontCard 列表；无战争时显示"暂无交战国"提示
   - 移除或隐藏旧的 `MILITARY_ACTIONS` 卡片区域（`activeSection === 'battle'` 中的遭遇战/大规模攻势/围城等卡片），用新的战局视图完全替代
   - 保留旧系统中的冷却机制概念（战线上两次战斗之间需要间隔），以及战利品显示
   - _需求：7.1, 7.2, 7.3_

- [x] 9. 边界情况处理和健壮性
   - 和平协议/投降时（在 `useGameActions` 或 `useGameLoop` 的和平处理逻辑中），清理相关战线的所有战斗、恢复军团状态、从 `activeFronts` 中移除
   - 军团在战斗中被解散时（`CorpsManagementPanel` 解散回调），先终止相关战斗、退回兵力、再执行解散
   - 确保多条战线多场战斗独立推进不冲突
   - 敌方军团全灭且无补充时，战线进入"无抵抗"状态，允许自由扫荡
   - 确保 `activeFronts`、`activeBattles`、军团部署状态在存档/读档时正确序列化和恢复（检查 `useGameState` 的初始化和 saveGame/loadGame 逻辑）
   - _需求：8.1, 8.2, 8.3, 8.4, 8.5_
