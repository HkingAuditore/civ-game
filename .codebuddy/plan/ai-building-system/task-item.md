# 实施计划：AI 建筑系统

- [ ] 1. 重写 `generateAIBuildingProfile` 核心算法——经济驱动的建筑画像生成
   - 在 `warEconomy.js` 中重写现有 `generateAIBuildingProfile(nation, epoch)` 函数
   - A. 总量计算：`Math.max(5, Math.floor(population / 8) + Math.floor(wealth / 2000))`
   - B. 时代过滤：使用传入 `epoch` 参数，`BUILDINGS.filter(b => b.epoch <= epoch)`，排除 `requiresTech` 且 `b.epoch > epoch` 的建筑
   - C. 类别比例：根据 `aggression`/`traits` 调整 gather/industry/civic/military 比例（默认35/30/20/15），clamp [5%,50%] 后归一化
   - D. 类别内经济匹配权重：从建筑 `output` 取 `mainResource`，计算 `biasScore × (0.5 + inventoryScore×0.3 + priceScore×0.2)` × 时代加权，归一化后按比例分配
   - E. 幂等性：已存在且总量 >= `population/12` 时跳过
   - 旧存档兼容：`inventory`/`nationPrices` 不存在时回退到 `resourceBias` + 时代加权
   - 首次生成时同步保存 `nation.virtualBuildingsBaseline` 深拷贝
   - _需求：1.1~1.8, 6.6, 6.8_

- [ ] 2. 修改 `processAIAIWarProgression` 传入实际 epoch 参数
   - 在 `aiWar.js` 的 `processAIAIWarProgression` 函数签名中新增 `epoch` 参数
   - 将 `epoch` 传递给内部调用的 `generateAIBuildingProfile(nation, epoch)`
   - 在 `simulation.js` 中找到 `processAIAIWarProgression` 的调用处，将当前 `epoch` 作为参数传入
   - epoch 未提供时回退到 `nation.epoch || Math.min(6, Math.floor(pop / 80))`
   - _需求：3.1, 3.2, 3.3_

- [ ] 3. 实现 `calculateBuildingIntegrityModifiers` 完好度修正函数
   - 在 `warEconomy.js` 中新增导出函数 `calculateBuildingIntegrityModifiers(nation)`
   - 遍历 `virtualBuildings` 和 `virtualBuildingsBaseline`，按每个建筑的 `output` 主资源汇总 `currentCount` / `baselineCount`
   - 计算每种资源的 `modifier = 0.3 + (currentCount/baselineCount) × 0.7`，clamp 在 [0.3, 1.0]
   - `virtualBuildings`/`virtualBuildingsBaseline` 不存在时返回空对象（表示全部 1.0）
   - 某资源无对应建筑时返回该资源 modifier = 1.0
   - _需求：6.1, 6.2, 6.3, 5.6_

- [ ] 4. 将完好度修正注入 `updateAINationInventory` 产量公式
   - 在 `aiEconomy.js`（或 `nations.js` 中 `updateAINationInventory` 所在文件）的资源产量计算处导入并调用 `calculateBuildingIntegrityModifiers`
   - 在 `productionRate = baseProductionRate × bias^1.2 × ... × wealthFactor` 后追加 `× (integrityModifiers[resource] || 1.0)`
   - 不修改 `calculateForeignPrice`，连锁效应（库存下降→价格上涨→贸易恶化）由现有机制自然产生
   - _需求：6.4, 6.5, 6.9, 6.10_

- [ ] 5. 实现 AI 建筑和平恢复逻辑
   - 在 `warEconomy.js` 中新增导出函数 `processAIBuildingRecovery(nation, epoch, day)`
   - 每 30 天检查一次（`day % 30 === 0`），仅对和平状态且有 `virtualBuildings` 的国家执行
   - 计算应有总量与当前总量差值，如当前 < 应有的80%，恢复 `Math.ceil(差值 × 0.1)` 座
   - 恢复建筑时按经济匹配权重分配（复用任务1中的权重计算逻辑），优先恢复被破坏最多的类型
   - 仅恢复本地建筑（不含 `virtualBuildingsForeign` 部分）
   - 恢复后同步更新 `virtualBuildingsBaseline`
   - 在 `simulation.js` 中找到合适的每tick位置调用此函数（仅在 `day % 30 === 0` 时）
   - _需求：2.1~2.5, 6.7, 5.2, 边界4/15_

- [ ] 6. 实现海外投资建筑纳入 AI 建筑画像
   - 在 `generateAIBuildingProfile` 中增加可选参数 `overseasInvestments`
   - 查询 `overseasInvestments.filter(inv => inv.targetNationId === nation.id && inv.status === 'operating')`，汇总 `{ buildingId: count }`
   - 将外资建筑叠加到 `virtualBuildings` 总量中，同时存入 `nation.virtualBuildingsForeign`
   - 外资部分也计入 `virtualBuildingsBaseline`
   - `overseasInvestments` 未传入时降级为仅本地画像
   - _需求：7.1, 7.2, 7.3_

- [ ] 7. 实现战争中外资建筑的破坏处理
   - 修改 `calculateWarBuildingDamage`（或其调用方），使其从 `virtualBuildings`（含外资）总量中选择破坏目标
   - 被破坏建筑命中外资部分（`virtualBuildingsForeign[id] > 0`）时：同步扣减 `virtualBuildingsForeign`，记录到日志
   - 在战争结束结算时，将被破坏的外资建筑数量同步到 `overseasInvestments` 中扣减 `count`
   - 投资方收到通知日志："你在 [国家名] 的 [建筑名] ×N 在战争中被摧毁"
   - AI-AI 战争中如果玩家有海外投资在交战国，同样产生通知
   - _需求：7.4, 7.5, 7.6, 7.9, 7.10, 边界13/14/16_

- [ ] 8. 在 `NationDetailView.jsx` 中实现 AI 建筑概况 UI
   - 在 `NationDetailView` 的"国家概览"区域（"战略情报"面板下方）新增"建筑概况"区块
   - 按 4 大类别（采集/工业/民政/军事）分组，每组显示总数和前3个最高数量的建筑名称
   - 区分显示"本地 N 座 + 外资 M 座"（外资部分蓝色标注）
   - 无 `virtualBuildings` 时显示"暂无情报"；有战损数据时标注"战损 N 座"（红色）
   - 紧凑4列网格布局，与现有"战略情报"面板视觉风格一致
   - `virtualBuildings` 不存在但有 `overseasInvestments` 时仍显示外资部分
   - _需求：4.1~4.5, 7.7, 7.8_

- [ ] 9. 数据清理和边界情况处理
   - AI 被吞并时（`isAnnexed = true`）：清除 `virtualBuildings`、`virtualBuildingsBaseline`、`virtualBuildingsForeign`
   - 旧存档 `virtualBuildingsBaseline` 缺失时：从当前 `virtualBuildings` 复制一份作为基线
   - `traits` 不存在时使用默认类别比例
   - `resourceBias` 中某资源缺失时默认 bias = 1.0
   - 建筑无 `output` 时使用默认权重 1.0
   - 建筑 `output` 多资源时取数量最大的作为 `mainResource`
   - 在 `processAIAIWarProgression` 和 `generateAIBuildingProfile` 入口处添加容错
   - _需求：边界1~12_

- [ ] 10. 构建验证
   - 执行 `npm run build` 验证无编译错误
   - 检查所有新增的导入/导出路径正确性
   - 确认 `simulation.js` 中 `processAIAIWarProgression` 调用处正确传入 epoch
   - 确认 `updateAINationInventory` 中完好度修正注入不影响无 `virtualBuildings` 的国家
   - _需求：5.1~5.6_
