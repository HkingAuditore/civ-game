---
name: international-economy-panel-perf
overview: 对国际经济概览面板进行性能优化：引入分页/虚拟滚动，折叠 FlowVisualizer，合并同类建筑展示，消除 47000+ 条目同时渲染导致的卡顿。
todos:
  - id: optimize-international-economy-panel
    content: 对 InternationalEconomyPanel.jsx 的海外资产列表添加分页（每页20条）和 FlowVisualizer 懒展开，外资企业列表同步添加懒展开，数值精简为整数显示
    status: completed
---

## 用户需求

国际经济概览面板（`InternationalEconomyPanel`）在"海外资产"和"外资企业"两个 Tab 中，当建筑数量极多时（截图显示 47055 / 33135 项），页面卡顿严重。需要对列表渲染进行性能简化，保留现有信息结构的前提下大幅减少初始 DOM 节点数量。

## 产品概览

国际经济概览是外交系统的子面板，以 BottomSheet 形式展示玩家的海外资产（出境投资）和外资企业（入境投资）。当前每条资产条目都会立即渲染含多个 badge 节点的 `FlowVisualizer`（原料→建筑→产出流程图），条目数量极大时导致大量 DOM 同步挂载，造成卡顿。

## 核心功能

- **分页浏览**：海外资产列表每页 20 条，提供上一页/下一页翻页控件，切换 Tab 或搜索时自动重置到第一页
- **FlowVisualizer 按需展开**：每条资产条目默认折叠流程图，点击条目标题行后展开/收起，初始渲染时完全不挂载 FlowVisualizer 节点
- **外资企业同步优化**：ForeignCapitalTab 中每个国家分组下的投资明细同样默认折叠 FlowVisualizer，点击行展开
- **数值精简显示**：日税额等数值统一改为整数显示，减少小数位渲染开销

## 技术栈

- 已有项目：React 19 + Vite + Tailwind CSS
- 仅修改 `src/components/panels/InternationalEconomyPanel.jsx`，零外部依赖引入

## 实现思路

### 核心策略：分页 + 懒展开

两个瓶颈同时解决：

1. **分页**：将 `activeInvestments` 按 `PAGE_SIZE=20` 切片，仅渲染当前页条目，绕过 CSS 虚拟滚动（`max-h overflow-y-auto` 虽然有滚动容器，但所有 DOM 节点已全量挂载）
2. **懒展开**：用 `useState<Set<string>>` 记录已展开的 entry id，FlowVisualizer 用条件渲染 `{expandedIds.has(id) && <FlowVisualizer .../>}`，初始为空 Set，默认不渲染任何流程图

### 关键决策

- **选择分页而非虚拟滚动**：虚拟滚动需引入 react-window 或自行实现，复杂度高；分页仅需 `useState` + 数组切片，符合零依赖要求，且在移动端触感更好
- **选择 id Set 而非 boolean per item**：避免将展开状态写入 `activeInvestments` 数组导致重新 memo 计算，Set 存于独立 state，条目数据不变
- **切换 Tab 时重置 page**：`activeTab` 变化时应重置为第 1 页，用 `useEffect` 监听实现

## 实现注意事项

- `activeInvestments` 通过 `useMemo` 计算，分页切片在渲染阶段完成，不进入 memo 依赖，避免多余计算
- `expandedIds` Set 更新时需 `new Set(...)` 创建新引用触发 re-render
- 翻页控件仅在总页数 > 1 时渲染
- `ForeignCapitalTab` 的展开状态独立管理，key 用 `inv.id`
- 数值显示：`toFixed(1)` 改为 `Math.round()` 或 `toFixed(0)`，减少 DOM 文本节点差异比较

## 架构设计

仅修改单文件内的两个子组件，不影响任何外部调用方：

```
InternationalEconomyPanel.jsx
├── OverseasAssetsTab
│   ├── page (useState, 初始 1)
│   ├── expandedIds (useState<Set>, 初始 empty)
│   ├── pagedInvestments = activeInvestments.slice((page-1)*PAGE_SIZE, page*PAGE_SIZE)
│   ├── 列表渲染 pagedInvestments
│   │   └── 点击 header 行 → toggle expandedIds
│   │   └── expandedIds.has(inv.id) && <FlowVisualizer/>
│   └── 翻页控件（上一页 / 页码 / 下一页）
└── ForeignCapitalTab
    ├── expandedInvIds (useState<Set>, 初始 empty)
    └── group.investments 渲染
        └── expandedInvIds.has(inv.id) && <FlowVisualizer/>
```

## 目录结构

```
src/components/panels/
└── InternationalEconomyPanel.jsx  # [MODIFY] 对 OverseasAssetsTab 和 ForeignCapitalTab 进行分页+懒展开改造，无外部文件变更
```