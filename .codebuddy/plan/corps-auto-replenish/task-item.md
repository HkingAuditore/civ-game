# 实施计划：军团自动补兵系统修复

- [ ] 1. 扩展军团数据模型，添加自动补兵相关字段
   - 在 `src/logic/diplomacy/corpsSystem.js` 的 `createCorps` 函数中，为军团对象添加 `autoReplenish: true`（默认值）字段
   - 在 `src/hooks/useGameState.js` 中新增 `corpsReplenishQueue` 状态字段，数据结构为 `{ [corpsId]: { [unitId]: deficitCount } }`，用于跟踪每个军团的待补兵缺额
   - _需求：2.1、4.1_

- [ ] 2. 扩展 AUTO_REPLENISH_LOSSES 信号以携带军团 ID 信息
   - 在 `src/logic/diplomacy/aiWar.js` 中，战斗损失日志 `AUTO_REPLENISH_LOSSES:` 的 JSON 负载扩展为 `{ losses: {unitId: count}, corpsLosses: { [corpsId]: {unitId: count} } }`，同时保持向后兼容（仍包含顶层 losses）
   - 在 `src/hooks/useGameLoop.js` 约第6542行的信号解析逻辑中，除了解析 `allAutoReplenishLosses`（按兵种汇总），还解析出 `corpsLossDetails`（按军团ID分组的损失明细），写入 `corpsReplenishQueue`
   - _需求：2.1、2.2_

- [ ] 3. 在会战结算中记录军团级别的损失明细
   - 在 `src/hooks/useGameLoop.js` 约第2776行 `distributeSurvivorsToCorps` 之后，计算每个玩家军团的战前 vs 战后单位差值，生成 `corpsLossDetails: { [corpsId]: {unitId: lossCount} }`
   - 将此损失明细合并写入 `corpsReplenishQueue` 状态（通过 `setCorpsReplenishQueue` 或等价机制），而非仅通过日志信号传递
   - _需求：2.1、2.2_

- [ ] 4. 在战线摩擦 `processFrontFriction` 返回结果中添加军团损失追踪
   - 在 `src/logic/diplomacy/frontSystem.js` 的 `processFrontFriction` 函数返回值中，新增 `corpsLosses: { [corpsId]: {unitId: count} }` 字段，标明各军团在摩擦中的损失
   - 在 `src/hooks/useGameLoop.js` 中调用 `processFrontFriction` 的位置（约第2966行），将 `frictionResult.corpsLosses` 累加到 `corpsReplenishQueue`，并在累计阈值 ≥ 3 人/军团时触发补兵
   - _需求：3.1、3.2_

- [ ] 5. 修改训练完成逻辑，将补兵单位自动编入受损军团
   - 在 `src/hooks/useGameLoop.js` 约第6810行训练完成 `setArmy` 逻辑处，对 `isAutoReplenish: true` 的完成项：
     1. 读取 `corpsReplenishQueue`，找到缺少该兵种最多且 `autoReplenish !== false` 且 `status !== 'in_combat'` 的军团
     2. 如果找到目标军团，通过 `setMilitaryCorps` 将单位直接加入 `corps.units`（而非 `setArmy`），并将 `corpsReplenishQueue` 中对应缺额 -1
     3. 如果没找到或军团正在战斗中，回退到现有行为（加入散兵池 `army`）
   - 添加日志：`[自动补兵] {单位名} 已补充到 {军团名}`
   - _需求：1.1、1.2、1.3、1.4、1.5_

- [ ] 6. 实现多军团补兵优先级排序
   - 在 `src/logic/diplomacy/corpsSystem.js` 中新增 `getCorpsReplenishPriority(corps, activeFronts)` 工具函数，返回优先级分数：部署到活跃战线的军团 +100，缺员比例越高分数越高，创建时间越早分数越高
   - 在任务5的分配逻辑中使用此函数排序，优先补兵到高优先级军团
   - 当资源不足时添加日志提示优先补充哪个军团
   - _需求：5.1、5.2、5.3_

- [ ] 7. 处理军团解散和手动编入时的缺额同步
   - 在 `src/components/panels/CorpsManagementPanel.jsx` 的 `handleDisbandCorps` 中，解散军团时清除 `corpsReplenishQueue` 中该军团的记录
   - 在 `handleAssignUnits`（手动编入单位）中，编入后重新计算该军团的缺额并更新 `corpsReplenishQueue`（减少对应兵种的 deficit）
   - 当补兵完成（某军团所有兵种缺额清零）时自动清除该军团的记录
   - _需求：2.3、2.4_

- [ ] 8. 在军团管理面板中添加军团级别的自动补兵开关 UI
   - 在 `src/components/panels/CorpsManagementPanel.jsx` 的军团详情区域中添加"自动补兵"开关组件，默认为 `true`
   - 切换时更新 `corps.autoReplenish` 字段并通过 `onUpdateCorps` 回传
   - 全局自动补兵关闭时，该开关显示为禁用状态并附提示文字
   - 变更时添加日志记录
   - _需求：4.1、4.2、4.3、4.4_

- [ ] 9. 在 `handleAutoReplenishLosses`（玩家主动出击路径）中也支持军团感知
   - 在 `src/hooks/useGameActions.js` 的 `handleAutoReplenishLosses` 函数中，支持新增的 `options.corpsLosses` 参数
   - 当 `options.source === 'player_battle'` 且传入了 `corpsLosses` 时，将军团损失明细写入 `corpsReplenishQueue`
   - 确保通过 `useGameActions.js` 触发的补兵训练项也能在完成时正确分配到军团
   - _需求：1.1、2.1_

- [ ] 10. 端到端验证与边界情况测试
   - 验证场景1：会战后训练完成的单位自动回到受损军团（非散兵池）
   - 验证场景2：战线摩擦累积 ≥ 3 人后触发补兵，且补兵目标正确
   - 验证场景3：军团在补兵期间被解散，训练中的单位正常进入散兵池
   - 验证场景4：军团 `in_combat` 状态时，补兵单位暂入散兵池
   - 验证场景5：多军团同时补兵，优先级排序正确
   - 验证场景6：关闭某军团自动补兵开关后，该军团不再接收补兵
   - 验证场景7：无军团场景下（散兵模式），自动补兵行为不变
   - _需求：1.1–5.3、边界情况 1–5_
