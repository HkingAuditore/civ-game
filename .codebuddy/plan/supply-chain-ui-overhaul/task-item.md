# 实施计划：资源详情 - 产业链 UI 重构

- [ ] 1. 审查并修正 `industryChains.js` 与 `buildings.js` 的建筑 ID 一致性
   - 遍历 `INDUSTRY_CHAINS` 所有 stages 中引用的 `buildings` 数组，提取全部建筑 ID
   - 与 `BUILDINGS`（`src/config/buildings.js`）中已定义的建筑 ID 列表进行交叉比对
   - 对于不一致的 ID（如 `smelter`→`bronze_foundry`、`forge`→`iron_tool_workshop`、`steel_mill`→`steel_foundry`），修正 `industryChains.js` 中的引用，使其与 `buildings.js` 中的 ID 完全一致
   - 同时修正 `CHAIN_DEVELOPMENT_PATHS` 中引用的建筑 ID（如 `mining_chain.paths[0].requirements.buildings` 中的 `steel_mill`）
   - _需求：1.3, 1.4_

- [ ] 2. 修复 `BuildingChip` 组件的英文名 fallback 逻辑
   - 在 `ResourceDetailModal.jsx` 第250行的 `BuildingChip` 组件中，将 `const name = bDef?.name || bid;` 改为：当 `bDef` 不存在时，将 `bid` 格式化为友好名称（去下划线、首字母大写），并添加一个"未知"标记样式
   - 确保即使配置不一致，UI 也不会直接暴露英文原始 ID
   - _需求：1.1, 1.2_

- [ ] 3. 重构数据层：新增产业链拓扑解析函数
   - 在 `ResourceDetailModal.jsx` 中新增 `buildChainFlowGraph(chain, resourceKey, epoch)` 函数，替代现有的 `getDirectRelations`
   - 该函数将产业链的 stages 解析为 **有向图结构**：`{ nodes: [...], edges: [...] }`
     - 每个 node 包含：`{ id, type('resource'|'stage'), data(stage/resourceDef), column(列位置), row(行位置), isCurrent(是否当前资源), inEpoch }`
     - 每个 edge 包含：`{ from, to }`
   - 布局算法：按依赖关系自动分配 column（从左到右），同 column 的节点按 row 纵向排列（处理分叉）
   - 保留 `getResourceRole` 不变（用于角色标签显示）
   - _需求：2.1, 2.2, 2.3, 2.4_

- [ ] 4. 实现横向流程图容器组件 `ChainFlowGraph`
   - 新建组件 `ChainFlowGraph`（替代 `ChainCard`），接收 `{ graph, resourceKey, buildingCounts, chain }` props
   - 使用 CSS Grid 布局：列数 = graph 最大 column + 1，行数 = graph 最大 row + 1
   - 容器支持 `overflow-x: auto` 横向滚动，当内容超出宽度时
   - 容器 `min-width` 基于节点数量动态计算，确保节点不会过度拥挤
   - 保留产业链名称标题栏（从 `ChainCard` 的卡片头样式迁移）和角色标签
   - _需求：2.1, 2.5, 4.1, 4.2_

- [ ] 5. 实现流程图节点组件 `FlowNode`
   - 新建 `FlowNode` 组件（替代 `StageRow`），根据 node.type 渲染不同样式：
     - **资源节点**（type='resource'）：圆形，内含资源 icon + 名称；当前资源用金色边框/光晕 (`border-ancient-gold/50 shadow-[0_0_12px_rgba(212,175,55,0.3)]`)
     - **阶段节点**（type='stage'）：圆角矩形，内含阶段名称、关联建筑（复用改进后的 `BuildingChip`）、产出资源小标签
   - 未解锁的节点（`!inEpoch`）使用 `opacity-40` 灰色样式，附带 epochRange 提示
   - hover 时使用 `hover:brightness-110 hover:border-ancient-gold/40` 视觉反馈
   - _需求：2.6, 3.1, 3.2, 3.4, 3.5, 5.2_

- [ ] 6. 实现流程图连接箭头
   - 使用 CSS 伪元素或 SVG overlay 在相邻 column 的节点之间绘制连接线+箭头
   - 箭头方向从左到右，颜色使用 `ancient-gold/30` 渐变
   - 实现方式：在每个 edge 对应的 grid 间隔区域放置一个箭头元素（水平线+三角箭头），通过绝对定位连接源节点和目标节点
   - 对于分叉（一个节点连接多个下游），绘制分叉线段（先横再竖再横）
   - _需求：2.2, 2.3, 3.3_

- [ ] 7. 重构 `DynamicChainView` 主视图
   - 将第403行的 `DynamicChainView` 改为使用新的 `ChainFlowGraph` 替代 `ChainCard` 渲染每条产业链
   - 保留资源概览头（icon + 名称 + 标签）
   - 保留 fallback 逻辑（不在任何产业链中时用建筑 input/output 推断）
   - 多条产业链纵向排列，每条之间有清晰的间距和标题分隔
   - _需求：4.1, 4.2, 4.3_

- [ ] 8. 横向滚动与响应式处理
   - 为 `ChainFlowGraph` 容器添加 `overflow-x: auto` 和滚动指示（左右渐变阴影提示可滚动）
   - 当容器宽度不足时，在右侧显示渐变遮罩提示更多内容
   - 确保在模态框宽度范围内，短产业链（3-4个节点）不需要滚动即可完整显示
   - _需求：2.5, 5.1, 5.3_

- [ ] 9. 清理旧组件并验证完整性
   - 删除不再使用的 `ChainCard`、`StageRow` 组件（如果完全被新组件替代）
   - 保留 `ResourceChip`、`BuildingChip`（已改进）供新组件复用
   - 验证所有产业链（food_chain、wood_chain、textile_chain、mining_chain、knowledge_chain、luxury_chain、military_chain、power_chain、petrochemical_chain、electronics_chain、semiconductor_chain、pharmaceutical_chain）在新 UI 中正确渲染
   - 确保 fallback 路径（非产业链资源）仍然正常工作
   - _需求：1.4, 2.1, 4.3, 5.3_
