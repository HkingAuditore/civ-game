# 实施计划：战线系统全面修复与增强

- [ ] 1. 修复 AI 军团兵力为0（致命 BUG）
   - 在 `militaryUnits.js` 的 `generateNationArmy` 函数中，在 `wealthConstraint` 计算后、`baseArmySize` 计算前，加入最低保底：`const MIN_ARMY_SIZE = Math.max(10, Math.floor(population * 0.001))；` 在 `baseArmySize` 计算后：`const effectiveSize = Math.max(MIN_ARMY_SIZE, baseArmySize)`，后续用 `effectiveSize` 替代 `baseArmySize`
   - 在 `frontSystem.js` 的 `generateEnemyCorpsForFront` 中，生成军团后校验总兵力 > 0，若为0则用 epoch 对应最基础兵种填充 `{[fallbackUnitId]: MIN_ARMY_SIZE}`
   - 在 `battleSystem.js` 的 `createBattle` 中，在返回前添加双方 `currentUnits` 总量校验，若某方为0则返回 `null` 并在 console.warn 记录原因；调用方（useGameLoop.js）需处理 null 返回值
   - _需求：1.1, 1.2, 1.3, 1.4_

- [ ] 2. 定义 Checkpoint 区段数据模型和常量
   - 在 `frontSystem.js` 顶部新增 `FRONT_ZONES` 常量数组，定义 7 个区段：每个含 `{ id, name, start, end, ownerSide, category, buildingCats }` — `category` 为 `'capital'`/`'economic'`/`'frontier'`；`buildingCats` 为该区段暴露的建筑类别数组（如 frontier→`['military','gather']`, economic→`['industry','civic']`, capital→全部）
   - 定义 `CHECKPOINTS = [15, 35, 50, 65, 85]` 常量
   - 新增辅助函数 `getZoneForPosition(linePosition)` 返回当前区段对象
   - 新增辅助函数 `getCheckpointsCrossed(oldPos, newPos)` 返回本次跨越的 checkpoint 列表（方向+值）
   - _需求：2.1_

- [ ] 3. 重构 `generateFront` 和前线数据模型支持 zones
   - 修改 `generateFront` 函数：不再在创建时调用 `generateResourceNodes` 和 `generateInfrastructure` 生成全部资源点；改为初始化 `zones` 对象（7个区段，每个含 `{ resourceNodes: [], infrastructure: [], reached: false, cleared: false }`）
   - 只在初始中立区段（区段3和区段4，即双方前沿 35-65）标记 `reached: true` 并生成初始资源点（少量前沿设施）
   - 保留旧的 `resourceNodes` 和 `infrastructure` 顶层字段作为所有区段资源的聚合视图（getter 函数或在每次 zone 变更后重建）
   - 新增 `destroyedBuildings: { [nationId]: { [buildingId]: count } }` 跟踪战争累计破坏
   - 在 `ensureFrontDefaults` 中处理旧存档迁移：无 `zones` 字段时将旧 `resourceNodes` 迁移到最近的匹配区段
   - _需求：2.1, 3.1（数据模型部分）_

- [ ] 4. 实现区段动态资源点生成（映射真实建筑）
   - 新增 `generateZoneResources(zone, ownerBuildings, epoch)` 函数：
     - 根据区段的 `buildingCats` 筛选 `ownerBuildings` 中匹配类别的建筑
     - 从中随机选取 2-4 个，每个对应一个具体 `buildingId`
     - 资源点 `amount` = `outputRate × count × (2~5)` 天的产出，clamp 到 50~2000
     - 每个资源点带 `linkedBuildingId` 字段指向原建筑
   - 新增 `generateZoneInfrastructure(zone, ownerBuildings, epoch)` 函数：类似逻辑，按类别映射效果
   - AI 方无建筑数据时：基于 `nation.economy.buildings` 或 fallback 模板
   - _需求：3.1_

- [ ] 5. 在 `processFrontAdvance` 中接入 checkpoint 检测和区段资源生成
   - 修改 `processFrontAdvance`：在计算 `newLinePosition` 后，调用 `getCheckpointsCrossed(oldPosition, newLinePosition)` 检测是否跨越 checkpoint
   - 每个跨越的 checkpoint：
     - 计算新进入的区段 ID，若该区段 `reached === false`：标记 `reached = true`，调用 `generateZoneResources` 和 `generateZoneInfrastructure` 生成该区段资源
     - 向 `controlLog` 追加 checkpoint 事件（如「🔥 我军突破敌方前沿，进入经济区！」）
   - 已 reached 但被推回的区段：不重新生成资源（`cleared` 标记不变）
   - 当 `linePosition` 到达 0 或 100：标记 `collapsed`
   - 函数需要额外参数：`attackerBuildings` 和 `defenderBuildings`（从 useGameLoop 传入）
   - 重建顶层 `resourceNodes`/`infrastructure` 聚合视图（合并所有 zone 的资源到顶层数组）
   - _需求：2.2, 2.3, 2.4, 2.5_

- [ ] 6. 实现建筑破坏→真实经济影响
   - 修改 `frontSystem.js` 的 `plunderResourceNode` 函数（或新增 `destroyResourceNode`）：
     - 当资源点被掠夺/破坏时，在 `front.destroyedBuildings[ownerId][linkedBuildingId]` 计数 +1
     - 返回 `{ buildingId, ownerId, destroyedCount }` 供 useGameLoop 同步到实际 buildings state
   - 在 `useGameLoop.js` 战斗结束处理中：读取 `destroyedBuildings`，对玩家调用 `setBuildings(prev => ({...prev, [bId]: Math.max(0, prev[bId] - count)}))`，对 AI 修改 `nation.economy.buildings[bId]`
   - 在核心区段被攻入时（linePosition ≤ 15 或 ≥ 85），每日从被攻入方人口扣除 `0.5% × (深入程度)`：玩家通过 `setPopulation` 减少，AI 修改 `nation.population`
   - 在 `processFrontFriction` 中：当 friction 事件发生在敌方区段时，有 30% 概率破坏一个区段内未破坏的资源点（自动掠夺）
   - _需求：3.2, 3.3, 3.4, 3.5_

- [ ] 7. 重写 `getFrontlineEconomicModifiers` 实现三层经济压力
   - **第一层：基础维持成本**：计算部署兵力总数 × 0.3 food/天 和 × 0.1 silver/天，作为新返回字段 `{ foodUpkeep, silverUpkeep }`
   - **第二层：区段深度惩罚**：替换旧的 `sidePressure` 计算，改用 checkpoint-aware 逻辑：
     - 使用 `getZoneForPosition(linePosition)` 判断当前被攻入的区段深度
     - 前沿被攻入：`productionPenalty += 0.05`
     - 经济区被攻入：`productionPenalty += 0.15, incomePenalty += silverIncome × 0.2`
     - 核心区被攻入：`productionPenalty += 0.25, incomePenalty += silverIncome × 0.4`
   - **第三层：战争疲劳**：基于 `(currentDay - front.startDay)` 每 30 天增加稳定性 -2 修正和阶层满意度调整，返回 `{ stabilityMod, stratumMods }`
   - 补给危机检测：新增 `supplyCrisis` 布尔值返回字段
   - 在 `simulation.js` 的调用点应用新返回值：扣除 foodUpkeep/silverUpkeep，不足时设置 `supplyCrisis = true`
   - _需求：4.1, 4.2, 4.3, 4.4, 4.5_

- [ ] 8. 修复战斗秒结束：调整 `processCombatRound` 的结束条件
   - 将 rout 判定中的 `b.currentRound >= 3` 改为 `b.currentRound >= Math.max(5, Math.floor(b.maxRounds * 0.3))`
   - 在 momentum 更新处添加限速：`const clampedShift = clamp(momentumShift, -8, 8)`，用 `clampedShift` 替代 `momentumShift`
   - 在 `createBattle` 中：当双方兵力比超过 10:1 时，自动将 `battleType` 从 `siege` 改为 `skirmish`
   - _需求：5.1, 5.2, 5.3, 5.4_

- [ ] 9. 战线推进可视化增强（WarfrontCard.jsx）
   - 重写战线推进条渲染：用 7 个 `<div>` 区段替代单一进度条，每段宽度按 checkpoint 比例分配（15%/20%/15%/15%/20%/15%），颜色按需求 7.1 设定
   - 在推进条上用绝对定位 `<span>` 标记 5 个 checkpoint 节点（小圆点+竖线）
   - 当前位置用三角形指示器标记
   - 当 `linePosition ≥ 65`：标题旁显示绿色标签「💪 战线优势」
   - 当 `linePosition ≤ 35`：显示红色标签「⚠️ 战线告急」
   - 距下一 checkpoint 显示进度提示文字（如「距突破敌方经济区还需推进 8%」）
   - _需求：7.1, 7.2, 7.3, 7.4_

- [ ] 10. 战术姿态量化反馈 + 按区段分组展示资源（WarfrontCard.jsx）
   - 在姿态按钮下方添加描述文字：aggressive→「敌军伤亡+50%, 我军伤亡+20%, 推进+0.8/天」、defensive→「标准伤亡率, 推进不变」、passive→「双方伤亡-50%, 推进-0.5/天」
   - 姿态切换时向 `frictionLog` 追加一条姿态变更事件
   - aggressive 姿态下的摩擦事件用 `text-orange-300` 高亮
   - 修改战线详情的资源展示：按区段分组（使用 `FRONT_ZONES` 常量），每个区段一个折叠块；未到达的区段显示灰色「未探索」；当前区段高亮
   - _需求：6.1, 6.2, 6.3, 7.5_

- [ ] 11. 数据兼容性、集成和构建验证
   - 在 `useGameLoop.js` 中：
     - 将玩家 `buildings` 和 AI `nation.economy.buildings` 传给 `processFrontAdvance` 供区段资源生成使用
     - 战斗结束后处理建筑破坏同步：读取 `front.destroyedBuildings`，调用 `setBuildings` 和修改 AI nation
     - 核心区被攻入时的每日人口损失计算和同步
     - 补给危机时的军团兵力损失和士气扣减
   - 在 `simulation.js` 中：应用 `getFrontlineEconomicModifiers` 返回的新字段（foodUpkeep/silverUpkeep/stabilityMod/stratumMods）
   - 旧存档兼容：`ensureFrontDefaults` 迁移无 zones 的旧战线数据
   - App.jsx / MilitaryTab：确保 `onSetPosture` 回调正确传递和处理
   - 构建验证：`npx vite build` 无错误
   - _需求：边界情况（数据迁移、兼容性、集成）_
