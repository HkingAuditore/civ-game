# 实施计划：理念系统优化

- [ ] 1. 补全 `ideologyScoring.js` 中缺失的三种分数触发逻辑
   - 在 `checkAndAwardIdeologyScore` 中新增 `trade_milestone` 触发：读取 `gameState.totalTradeVolume`，对照 `IDEOLOGY_SCORE_TRIGGERS.trade_milestone.milestones`（[1000, 5000, 20000, 100000]），用 `milestones` 数组记录已达成节点（key: `trade_vol_${idx}`），每达成一个节点授予 `base` 分
   - 新增 `war_result` 触发：读取 `gameState.lastWarResult`（胜/败/平），对照 `baseWin`/`baseLose` 授予分数，用 `milestones` 记录已处理的战争事件 ID 防止重复
   - 新增 `chain_complete` 触发：读取 `gameState.completedChains`，对比 `prevState.completedChains`，每新增一条产业链授予 `base` 分
   - _需求：1.1、1.2、1.3_

- [ ] 2. 在 `useGameLoop.js` 中向 `checkAndAwardIdeologyScore` 传入新触发所需的状态字段
   - 在 `curState` 对象中补充 `totalTradeVolume`、`lastWarResult`、`completedChains` 字段（从 `current` 中读取）
   - 在 `prevState` 对象中同步补充 `completedChains` 字段（用于 diff 检测）
   - _需求：1.1、1.2、1.3_

- [ ] 3. 在 `IdeologyTab.jsx` 中实现收藏上限计数与视觉提示
   - 新增常量 `MAX_COLLECTION_SIZE = 10`
   - 计算 `unequippedCount`（未装备理念数量）并在收藏区域标题旁显示 `{unequippedCount}/10` 计数器
   - 当 `unequippedCount >= 10` 时，将计数器样式改为红色警告色并显示"已满"标签
   - _需求：2.4、2.5_

- [ ] 4. 在 `IdeologyEmergenceModal.jsx` 中实现收藏满时的"替换"流程
   - 新增 `collectionFull` prop（`boolean`）和 `collectionList` prop（未装备理念列表）
   - 当 `collectionFull === true` 且选中的候选理念不是已有理念的升级时，进入"替换模式"：在弹窗内新增第二步 UI，展示当前未装备理念列表，要求玩家选择一个放弃
   - 同 ID 升级（`ownedMap[id]` 存在）时跳过替换步骤，直接确认
   - 修改 `onSelect` 回调签名为 `(ideologyId, discardId?)` 以传递被放弃的理念 ID
   - _需求：2.1、2.2、2.3_

- [ ] 5. 在 `App.jsx` 中更新涌现选择处理逻辑以支持替换流程
   - 向 `IdeologyEmergenceModal` 传入 `collectionFull` 和 `collectionList` props
   - 修改 `onSelect` 处理函数：若收到 `discardId`，先从 `ideologyCollection` 中移除该理念，再执行 `selectIdeology`
   - _需求：2.1、2.2_

- [ ] 6. 新建 `IdeologyDetailSheet.jsx` 底部抽屉组件
   - 基于现有 `IdeologyEmergenceModal.jsx` 的 Portal + AnimatePresence 模式创建新组件
   - 接收 `ideology`、`level`、`isEquipped`、`onEquip`、`onUnequip`、`onClose` props
   - 面板从屏幕底部滑入（`y: '100%' → 0`），背景半透明遮罩（`bg-black/60`）
   - 内容区展示理念完整详情（复用 `IdeologyCard` 的详情渲染逻辑，或直接渲染 `IdeologyCard` 的展开态内容）
   - 底部固定"装备"/"卸下"操作按钮
   - 支持点击遮罩关闭；移动端支持 `touchstart` + `touchmove` 下滑手势关闭（位移 > 80px 触发）
   - _需求：3.1、3.2、3.3、3.5、3.6、3.7_

- [ ] 7. 改造 `IdeologyTab.jsx` 中的收藏库列表，接入 BottomSheet
   - 新增 `selectedIdeology` state（`null | { id, level }`）
   - 将收藏库中的 `IdeologyCard` 改为 `compact` 模式（`compact={true}`），移除原有的 `expanded` 展开逻辑
   - 为每张卡片绑定 `onClick` → `setSelectedIdeology({ id, level })`
   - 在组件底部渲染 `IdeologyDetailSheet`，传入 `selectedIdeology` 对应的数据及 `onEquip`/`onUnequip`/`onClose` 回调
   - _需求：3.1、3.4_
