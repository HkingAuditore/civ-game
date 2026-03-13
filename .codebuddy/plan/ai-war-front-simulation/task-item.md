# 实施计划：AI之间战线模拟系统

- [ ] 1. 扩展 `war` 对象数据结构，初始化抽象战线字段
   - 在 `aiWar.js` 的 `processAIAIWarProgression` 中，为每对交战AI的 `war` 对象补充字段：`linePosition`(默认50)、`lastCheckpointDay`、`destroyedBuildings`(空对象)
   - 对已存在 `isAtWar` 但缺少 `linePosition` 的旧存档 `war` 对象，补充默认值（容错处理）
   - _需求：1.1, 1.7（旧存档容错）_

- [ ] 2. 实现多线战争兵力折减计算工具函数
   - 在 `aiWar.js` 中新增 `getMultiWarStrengthRatio(nation, allNations)` 工具函数
   - 遍历 `nation.foreignWars` 统计活跃战争数量 `activeWarCount`，返回 `1 / sqrt(activeWarCount)`
   - 同时返回是否有极端战线（任何AI-AI战线 linePosition <=15 或 >=85），用于额外20%折减
   - _需求：1.3, 2.2, 2.3, 2.4, 4.5_

- [ ] 3. 在 `processAIAIWarProgression` 中实现 linePosition 推进逻辑
   - 替换原有"每10天掷骰 warScore ±5"逻辑为每tick的 linePosition delta 计算
   - delta 公式：`(nationStr - enemyStr) / (nationStr + enemyStr) × advanceRate`，其中有效军事力量 = `militaryStrength × sqrt(population) × (1 + aggression) × multiWarRatio`
   - linePosition 限制在 [5, 95] 范围内
   - 保留原有 wealth × 0.997 和 population × 0.998 衰减逻辑
   - 极端值（<=8 或 >=92）时将被压制方的 wealth 衰减率翻倍
   - _需求：1.2, 1.3, 1.5_

- [ ] 4. 实现 checkpoint crossing 事件触发
   - 复用 `frontSystem.js` 中已有的 `getCheckpointsCrossed(oldPos, newPos)` 函数（需在 `aiWar.js` 中导入）
   - 当 linePosition 跨越检查点 [15, 35, 50, 65, 85] 时：
     - 根据区域类型生成 warScore 增量（核心区±15, 经济区±10, 边境±5）
     - 调用 `calculateWarPopulationLoss` 比率计算人口流失
     - 对被侵入方 wealth 施加额外损伤
     - 触发建筑破坏（任务6实现后接入）
   - 生成日志事件（通过 `logs` 参数记录）
   - _需求：1.4, 1.6, 1.7, 4.4_

- [ ] 5. 实现 `generateAIBuildingProfile` 虚拟建筑画像生成函数
   - 在 `warEconomy.js` 中新增 `generateAIBuildingProfile(nation, epoch)` 导出函数
   - 根据 `population` 估算建筑总量：`Math.max(5, Math.floor(population / 8))`
   - 从 `BUILDINGS` 配置中过滤 `building.epoch <= epoch` 的可用建筑
   - 按类别分配：gather 40%, industry 30%, civic 20%, military 10%，将总量按比例分配到每个类别的建筑中
   - 返回 `{ buildingId: count }` 格式，存入 `nation.virtualBuildings`
   - 仅在 `virtualBuildings` 不存在或建筑总量 < `population / 12` 时生成
   - _需求：3.1, 3.2, 3.5, 3.6, 4.3_

- [ ] 6. 在 checkpoint crossing 中接入建筑破坏和经济损伤
   - 在任务4的 checkpoint 事件中，调用 `generateAIBuildingProfile`（按需生成）确保双方有 `virtualBuildings`
   - 调用已有的 `calculateWarBuildingDamage()` 传入 `nation.virtualBuildings`、`enemyUnits`（从militaryStrength估算）、`unitRatio`
   - 将破坏结果从 `nation.virtualBuildings` 中真实扣减
   - 累计记录到 `war.destroyedBuildings[nationId]` 供 UI 读取
   - 按被破坏建筑的产出价值折算 wealth 损失
   - _需求：3.3, 3.4, 3.7, 1.4_

- [ ] 7. 修改 AI-AI 战争结束结算逻辑
   - 在 `processAIAIWarProgression` 的战争结束判定中，结合 linePosition 终止位置调整胜负等级
   - linePosition >=80 → 至少 minor 胜利, >=90 → major 胜利（覆盖纯 warScore 判定）
   - 保留 `virtualBuildings`（不在结算时清除）
   - _需求：1.6, 3.5_

- [ ] 8. 在 `syncAINationMilitary` 中实现多线折减对玩家战线的影响
   - 在 `aiWar.js` 第1951行的 `syncAINationMilitary` 函数中，调用任务2实现的 `getMultiWarStrengthRatio`
   - 将折减系数应用到军团生成/同步逻辑中的总兵力计算（影响该AI在玩家战线上的有效兵力）
   - 如果该AI有极端战线，额外折减20%
   - 仅当 `activeWarCount > 1` 时生效
   - _需求：2.1, 2.2, 2.3, 2.4_

- [ ] 9. 在 `NationDetailView.jsx` 的 `ActiveWars` 组件中增加点击交互
   - 在第1483行的 `ActiveWars` 组件中，为每行战争条目添加 `cursor-pointer` 和 hover 样式
   - 添加 `expandedWarId` 状态，实现手风琴模式（同时只展开一个）
   - 点击"VS 你"的条目时显示提示"在军事面板中查看此战线"，不展开详情
   - 再次点击同一条目收起详情
   - _需求：5.1, 5.2, 5.6, 5.7, 5.8_

- [ ] 10. 实现 `AIWarFrontDetail` 战线详情展开组件
   - 在 `NationDetailView.jsx` 中的 `ActiveWars` 内部或 `src/components/diplomacy/AIWarFrontDetail.jsx` 中实现
   - 复用 `FrontViewPanel.jsx` 中的 `PLAYER_FRONT_ZONES` 数据结构和战线位置条的视觉样式（色块区间 + 指示器）
   - 显示战线位置条（linePosition 0~100）、区域标注（核心/经济/边境）、warScore、持续天数
   - 显示双方战力概览：militaryStrength、population、wealth、多线折减系数
   - 显示建筑破坏统计：从 `war.destroyedBuildings` 读取，以"建筑名 ×N"列表展示
   - 主视角为当前选中的AI国家（左侧=该国领土）
   - 旧存档缺少 linePosition 时显示默认值50或"战线数据不可用"
   - _需求：5.2, 5.3, 5.4, 5.5, 边界情况7/8_
