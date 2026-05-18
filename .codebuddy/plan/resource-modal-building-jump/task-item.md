# 实施计划：资源详情弹窗 → 建筑调控快速跳转

- [ ] 1. 在 `App.jsx` 中实现 `handleNavigateToBuilding` 回调并传入 `ResourceDetailModal`
   - 在 `App.jsx` 中新增 `handleNavigateToBuilding` 函数（`useCallback`），逻辑为：调用 `gameState.setResourceDetailView(null)` 关闭弹窗 + `gameState.setActiveTab('build')` 切换到建设Tab + `handleShowBuildingDetails(buildingId)` 打开对应建筑的 `BuildingDetails` 底部面板
   - 在 `<ResourceDetailModal>` 的 JSX 调用处新增 `onNavigateToBuilding={handleNavigateToBuilding}` prop
   - _需求：3.1、3.3_

- [ ] 2. 在 `ResourceDetailContent` 组件中接收并向下传递 `onNavigateToBuilding` prop
   - 在 `ResourceDetailContent` 的 props 解构中添加 `onNavigateToBuilding = null`
   - 将 `onNavigateToBuilding` 传递给供需分析 Tab 中的建筑列表渲染区域（`buildingSupply.map` 和 `buildingDemand.map`）
   - 将 `onNavigateToBuilding` 传递给产业链 Tab 的 `DynamicChainView` 组件
   - _需求：3.1、3.2_

- [ ] 3. 在供需分析 Tab 的"生产来源"列表条目中添加跳转按钮
   - 定位到 `ResourceDetailModal.jsx` 中 `buildingSupply.map(item => ...)` 渲染的 `<div>` 条目（约第 2330 行）
   - 在条目右侧数值区域旁添加跳转图标按钮：`IF onNavigateToBuilding && item.id !== 'import'` 则渲染一个 `<button>` 包裹 `<VisualIcon name="ExternalLink" size={12} />`，点击时调用 `onNavigateToBuilding(item.id)` 并阻止冒泡
   - 按钮样式使用 `text-gray-400 hover:text-ancient-gold transition-colors`，添加 `title="前往建筑调控"` tooltip
   - _需求：1.1、1.3、1.4、4.1、4.2、4.3、4.4_

- [ ] 4. 在供需分析 Tab 的"建筑需求"列表条目中添加跳转按钮
   - 定位到 `ResourceDetailModal.jsx` 中 `buildingDemand.map(item => ...)` 渲染的 `<div>` 条目（约第 2231 行）
   - 同任务 3，在条目右侧添加跳转按钮，`IF onNavigateToBuilding && item.id !== 'export'` 则渲染，点击调用 `onNavigateToBuilding(item.id)`
   - _需求：1.2、1.3、1.4、4.1、4.2、4.3、4.4_

- [ ] 5. 在产业链 Tab 的 `BuildingIOCard` 中添加跳转按钮
   - 在 `DynamicChainView` 组件中，为 `BuildingIOCard` 新增 `onNavigateToBuilding` prop 传递
   - 在 `BuildingIOCard` 组件的 props 中接收 `onNavigateToBuilding`，在卡片右上角或右侧添加跳转图标按钮，样式与任务 3 一致
   - 点击时调用 `onNavigateToBuilding(building.id)` 并阻止冒泡；无论建筑数量是否为 0 均显示
   - _需求：2.1、2.2、2.3、4.1、4.2、4.3_
