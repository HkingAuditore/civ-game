# 实施计划：军事系统精细化修复

- [ ] 1. 军团面板过滤 AI 军团和将领
   - 在 `CorpsManagementPanel.jsx` 军团列表渲染处（行172 `{militaryCorps.map(...)`），将 `militaryCorps` 替换为 `militaryCorps.filter(c => !c.isAI)` 过滤 AI 军团
   - 在将领区域（行321 `{generals.map(...)}`），过滤 `generals.filter(g => !g.id?.startsWith('ai_gen_'))` 隐藏 AI 将领
   - 在将领管理下拉（行287 `{generals.filter(g => !g.assignedCorpsId).map(...)}`），增加 `&& !g.id?.startsWith('ai_gen_')` 条件
   - 在军团计数（行155 `{militaryCorps.length}/{MAX_CORPS_PER_PLAYER}`）替换为仅统计玩家军团
   - 在未编入兵力池计算（行44 `for (const corps of militaryCorps)`），只遍历非 AI 军团
   - _需求：1.1, 1.2, 1.3, 2.1, 2.2_

- [ ] 2. 战局视图中敌方将领差异化展示
   - 在 `WarfrontCard.jsx` 敌方军团列表（展开详情中的 enemyCorpsList）中，为 AI 将领使用不同的视觉标记（暗红色文字 + `text-red-400` 而非 `text-yellow-400`）
   - AI 将领标签用「敌将」前缀替代「⭐」图标
   - _需求：2.3_

- [ ] 3. 将领选拔从官员系统桥接
   - 在 `corpsSystem.js` 中新增 `createGeneralFromOfficial(official, epoch)` 函数：
     - `name` = `official.name`
     - `level` = 基于 `official.stats?.military`（≥70→Lv.3, ≥85→Lv.4）和官员 `effects.militaryBonus`（≥0.2→+1级）推算
     - `traits` = 根据 `official.sourceStratum`（`soldier`→`aggressive`/`veteran`概率更高）和 `effects`（有 `militaryUpkeep`→`logistics`；有 `militaryBonus`≥0.15→`inspiring`）映射
     - 保留 `officialId` 字段指向原官员 ID
   - 修改 `CorpsManagementPanel.jsx` 的 `handleRecruitGeneral`（行118）：不再调用 `generateGeneral(epoch)`，改为打开一个官员选择面板
   - 新增内联 UI：列出 `officials.filter(o => !generals.some(g => g.officialId === o.id))`（排除已领军的官员），显示官员名称、出身、军事属性值、militaryBonus
   - 选中官员后调用 `createGeneralFromOfficial(official, epoch)` 生成将领，追加到 generals 数组
   - 无合适官员时显示"无合适官员可担任将领"提示
   - 需要给 `CorpsManagementPanel` 新增 `officials` prop（从 App.jsx 传递）
   - _需求：3.1, 3.2, 3.5_

- [ ] 4. 官员面板显示"领军中"状态
   - 在 `OfficialCard.jsx` 中，当官员的 `id` 匹配某个将领的 `officialId` 时，显示「🎖️ 领军中」标签
   - 在官员解雇逻辑中，检查该官员是否正在领军（`generals.some(g => g.officialId === official.id && g.assignedCorpsId)`），如果是则阻止解雇并提示
   - 将领卸任时（`handleUnassignGeneral` 后如果将领被移除）恢复官员正常状态（移除将领记录即可，无额外字段需清理）
   - _需求：3.3, 3.4, 3.6_

- [ ] 5. 前线摩擦事件引擎
   - 在 `frontSystem.js` 中新增 `processFrontFriction(front, playerCorps, enemyCorps, day, posture)` 函数：
     - 前置条件：双方军团都 > 0 且无 activeBattle
     - 每 3-5 天随机触发一次摩擦事件（用 `day % interval === 0` 控制频率）
     - 从事件模板池中随机选取（"边境巡逻队遭遇敌方斥候…"、"小股敌军试图渗透…"等，共 8-10 条模板）
     - 双方各损失 0.1%~0.5% 兵力，warScore ±1~3
     - 返回 `{ events: [{text, day}], casualties: {player, enemy}, warScoreDelta }`
   - 摩擦频率受 `posture` 参数调整（`aggressive`: 频率+50%；`defensive`: 标准；`passive`: 频率-50%）
   - _需求：4.1, 4.2, 4.3_

- [ ] 6. 战线战术姿态 UI 和前线摩擦可视化
   - 在 `WarfrontCard.jsx` 中，当双方有军团但无进行中战斗时，新增"战线态势"区域：
     - 战术姿态选择：三个按钮（主动骚扰/积极防御/消极防守），存储为 `front.posture` 字段
     - 滚动事件日志区域：显示最近 3-5 条前线摩擦事件，每条带时间戳和简短描述
     - 淡入淡出动画：新事件插入时使用 `animate-fade-in` 效果
   - 在 `useGameLoop.js` 每日 tick 中调用 `processFrontFriction`，将事件推入 `front.frictionLog` 数组，伤亡同步到军团
   - 需要给 WarfrontCard 新增 `onSetPosture` 回调，和 App.jsx 中的对应 handler
   - _需求：4.4, 4.5, 4.6_

- [ ] 7. 战线资源节点重构：基于 BUILDINGS 配置生成
   - 重写 `frontSystem.js` 的 `generateResourceNodes` 函数：
     - 玩家方：从 `attackerEco.buildings`（`{buildingId: count}`）中筛选 count > 0 的建筑，查 `BUILDINGS` 配置获取 `output` 中的主产出资源，随机抽取 2-4 个生成资源节点
     - 节点 `resource` = 建筑 `output` 的第一个 key（如 farm→food, mine→iron）
     - 节点 `amount` = 建筑产出量 × building count × 系数（50-100）
     - 节点 `desc` = 建筑 `name`
   - 删除 `RESOURCE_NODE_TEMPLATES` 中的 `swords`/`gunpowder`/`ammunition`（不在 `RESOURCES` 中定义的类型）
   - 敌方（AI）：如果没有建筑数据，基于 `enemyEco.wealth`/`population`/`epoch` 推算，从 `BUILDINGS.filter(b => b.epoch <= epoch)` 中模拟选取建筑，确保资源类型在 `RESOURCES` 范围内
   - 在 `BUILDINGS` 配置文件顶部 import `BUILDINGS`
   - _需求：5.1, 5.4, 5.6_

- [ ] 8. 战线设施重构：基于 BUILDINGS 类别映射
   - 重写 `frontSystem.js` 的 `generateInfrastructure` 函数：
     - 从实际拥有的建筑中，按 `cat` 分类选取代表性设施：
       - `military` 类（如 barracks/walls）→ 军事设施，提供 defense 效果
       - `civic` 类（如 trading_post/library）→ 民用设施，提供 income 效果
       - `gather`/`industry` 类 → 经济设施，提供 supply 效果
     - 设施 `name` = 建筑 `name`，`durability` = 基于建筑等级（100 × (1 + level × 0.3)）
   - 删除 `INFRASTRUCTURE_TEMPLATES` 硬编码数组
   - _需求：5.2_

- [ ] 9. 战线详情资源展示对齐游戏主 UI
   - 在 `WarfrontCard.jsx` 战线详情的资源节点渲染中，使用 `RESOURCES[node.resource]?.icon` 和 `RESOURCES[node.resource]?.color` 替代纯文本显示
   - 确保 tooltip 显示建筑来源名称和实际产出数据
   - 修复已掠夺节点的视觉标识（使用一致的灰色+删除线+💀图标，目前已有但确保生效）
   - _需求：5.3, 5.5_

- [ ] 10. 数据兼容性和集成收尾
   - 在 App.jsx 中给 `MilitaryTab` / `CorpsManagementPanel` 传递 `officials` prop
   - 在 `useGameLoop.js` 中接入 `processFrontFriction` 调用（与 `processFrontTick` 同处）
   - 旧存档兼容：将领若无 `officialId` 字段应 graceful fallback（视为独立将领，不影响功能）
   - 旧存档资源节点若含 `swords`/`gunpowder` 等已移除资源类型，展示时 fallback 到最近的有效资源名称
   - 构建验证：`npx vite build` 无错误
   - _需求：边界情况（数据迁移、AI军团清理、旧存档兼容）_
