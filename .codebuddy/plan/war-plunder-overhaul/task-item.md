# 实施计划：战争掠夺机制优化（War Plunder Overhaul）

- [ ] 1. 在 `gameConstants.js` 的 `WAR_ECONOMY` 中新增掠夺配置常量
   - 新增 `REVERSE_PLUNDER_EFFICIENCY`(0.6)、`AI_AI_PLUNDER_EFFICIENCY`(0.5)、`RESOURCE_PLUNDER_RATE_ECONOMIC`(0.02)、`RESOURCE_PLUNDER_RATE_CAPITAL`(0.04)、`MAX_RESOURCE_TYPES_PLUNDERED`(3)、`PLUNDER_SILVER_FLOOR_RATIO`(0.2)
   - 保持现有 `PLUNDER_RATE_ECONOMIC`、`PLUNDER_RATE_CAPITAL`、`PLUNDER_GAIN_RATIO` 不变，新配置与其并列
   - _需求：5.1、5.2_

- [ ] 2. 扩展 `warEconomy.js` 中的 `calculateWarPlunder` 函数，支持效率系数和反向掠夺
   - 为 `calculateWarPlunder` 新增可选参数 `efficiencyOverride`，传入时乘以掠夺率覆盖默认效率
   - 确保函数对攻方/守方身份无硬编码假设，可被任意一方调用（双向复用）
   - _需求：5.3、1.1、1.2、1.5_

- [ ] 3. 在 `warEconomy.js` 中新增 `calculateResourcePlunder` 纯函数，计算实物资源掠夺
   - 入参：玩家资源库存对象、区域类型（economic/capital）、效率系数
   - 逻辑：按库存量排序取前 `MAX_RESOURCE_TYPES_PLUNDERED` 种，每种扣减 `库存 × RESOURCE_PLUNDER_RATE × zoneMultiplier`，库存为 0 则跳过
   - 返回：`{ resourcesPlundered: { [resourceType]: amount }, totalWealthEquivalent: number }`（使用 `nationPrices` 估价折算 wealth）
   - _需求：2.1、2.2、2.3、2.5_

- [ ] 4. 扩展 `frontSystem.js` 的 `processFrontFriction` 返回双向掠夺结果
   - 在现有攻方掠夺计算（`attackerPlunder`）之后，新增守方掠夺计算（`defenderPlunder`）：当守方战线深入攻方经济区/核心区时，调用 `calculateWarPlunder` 并传入 `REVERSE_PLUNDER_EFFICIENCY`
   - `plunderResult` 返回对象扩展为 `{ attackerPlunder, defenderPlunder }`，两者结构一致
   - 当任一方不在对方经济区/核心区时，对应掠夺结果为 `{ wealthPlundered: 0 }`
   - _需求：6.1、6.2_

- [ ] 5. 在 `frontSystem.js` 的 `processFrontFriction` 中新增资源节点反向掠夺逻辑
   - 当 AI 处于玩家所属战区 zone 时，以 30% 概率选择一个未被掠夺的玩家资源节点，调用 `plunderResourceNode`
   - 节点被完全掠夺且有 `linkedBuildingId` 时触发玩家建筑销毁（1座）
   - 将掠夺事件信息附加到返回结果中，供消费端处理
   - _需求：4.1、4.2、4.3_

- [ ] 6. 修改 `useGameLoop.js` 中的摩擦掠夺消费逻辑，处理双向掠夺和实物资源扣减
   - 扩展 `frictionPlunderQueue` 同时收集玩家获益（`attackerPlunder`）和玩家损失（`defenderPlunder`）两类条目
   - 玩家获益部分：加到 `resources.silver`（保持现有逻辑）
   - 玩家损失部分：从 `resources.silver` 扣减，受 `PLUNDER_SILVER_FLOOR_RATIO` 保护（保留 20% 银币下限）；银币不足部分调用 `calculateResourcePlunder` 转为实物资源扣减
   - AI 方 wealth 相应增减
   - 资源节点被掠夺时：从玩家对应资源中扣除
   - _需求：6.3、6.4、1.3、1.6、4.2_

- [ ] 7. 在 `aiWar.js` 的 `processAIAIWarProgression` 中新增持续掠夺逻辑
   - 在每 tick 战争进展计算中，根据双方 linePosition 判断是否占领对方经济区/核心区
   - 若占领则调用 `calculateWarPlunder` 传入 `AI_AI_PLUNDER_EFFICIENCY`(0.5)，将 `wealthPlundered` 从被侵方 wealth 扣除、`wealthGained` 加到攻方 wealth
   - 双方均可能同时掠夺对方（如双方都深入对方经济区）
   - 标记受影响 AI 国家的 `economyDirtyFlags.resourcesDirty = true`
   - _需求：3.1、3.2、3.3、3.4_

- [ ] 8. 新增掠夺事件的战斗日志输出
   - 玩家被掠夺银币：红色日志 `"💸 敌军掠夺了我方 {amount} 银币"`
   - 玩家被掠夺实物资源：红色日志 `"💸 敌军掠夺了我方 {amount1} 食物、{amount2} 木材"`（合并显示）
   - 玩家资源节点被 AI 掠夺：日志 `"🏚️ 敌军掠夺了我方 {resource} ×{amount}（{nodeName}）"`
   - 日志在 `useGameLoop.js` 消费掠夺结果时生成，复用现有 `addLogEntry` / 战斗日志机制
   - _需求：1.4、2.4、4.4_

- [ ] 9. 扩展 `warEconomy.js` 的 `calculateFrontEconomicImpact` 返回掠夺流数据，并在战线面板 UI 中展示
   - 返回值新增 `plunder` 字段：`playerDailyPlunderGain`、`playerDailyPlunderLoss`、`netPlunderFlow`
   - 在战线详情面板的经济影响区域渲染掠夺流：正值绿色 `"掠夺收入 +{amount}/天"`，负值红色 `"被掠夺 -{amount}/天"`，中线附近灰色 `"0/天"`
   - _需求：7.1、7.2、7.3_

- [ ] 10. 存档兼容性处理
   - 在 `ensureFrontDefaults`（或等效的战线数据初始化函数）中为 `plunderResult.defenderPlunder`、资源节点掠夺状态等新增字段提供默认值
   - 确保旧存档加载时新字段缺失不报错，掠夺逻辑能优雅降级
   - _需求：边界情况 1_
