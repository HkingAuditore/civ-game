---
name: foreign-capital-tab-perf
overview: 对外资企业 Tab（ForeignCapitalTab）新增同类建筑合并（按 buildingId 聚合）+ 国家级分页（每页显示5个国家），彻底消除 33000+ 条目渲染卡顿。
todos:
  - id: foreign-capital-tab-perf
    content: 对 ForeignCapitalTab 的 useMemo 追加 buildingId 二次聚合，新增 nationPage 分页（每页5国）和翻页控件，展开 key 改为 nationId_buildingId
    status: completed
---

## 用户需求

外资企业 Tab 当前显示 33141 个项目，存在两处性能瓶颈导致严重卡顿：

1. **同国家内同类建筑未合并**：截图中"成衣作坊 ×240"实际是 240 条独立 `inv` 对象各自渲染，雅典娜城邦单国就有 1029 处资产
2. **国家列表无分页**：所有国家的分组卡片全量渲染，无上限控制

## 产品概览

在不改变用户信息完整性的前提下，对外资企业列表进行两级优化：同类建筑合并简并（减少每国明细行数），加国家级分页（限制同屏国家数量），使面板打开时渲染的 DOM 节点数量从数万降至可控范围。

## 核心功能

- **同类建筑简并**：同一国家内相同 `buildingId` 的投资条目合并为一行，累加 `count`、`dailyProfit`、`jobsProvided`，展开后显示合并后的 FlowVisualizer
- **国家级分页**：对按国家分组的结果分页，每页显示 5 个国家，底部提供上一页/下一页翻页控件及页码信息
- **数据变化重置**：`foreignInvestments` 数据变化时自动重置到第一页并清空展开状态

## 技术栈

- 已有项目：React 19 + Vite + Tailwind CSS
- 仅修改 `src/components/panels/InternationalEconomyPanel.jsx` 中的 `ForeignCapitalTab` 组件，零外部依赖

## 实现思路

### 两级优化策略

**第一级：useMemo 内聚合**

在现有 `investmentsByNation` 的 `useMemo` 计算中，对每国的 `investments` 数组追加按 `buildingId` 的二次聚合：

```
外层：nationId → group
内层：buildingId → mergedInv（累加 count / dailyProfit / jobsProvided，取第一条的 operatingData）
```

合并后每国明细行数 = 该国不同建筑类型数（通常 < 20），雅典娜城邦 1029 条降至约 10 行。

**第二级：国家分页**

新增 `nationPage` state，对 `investmentsByNation` 数组切片，每页 `NATION_PAGE_SIZE = 5` 个国家，底部渲染翻页控件。总国家数通常 < 20，5 个/页即 2~4 页，渲染开销极小。

**展开状态 key 变更**

合并后不再用单条 `inv.id` 作为展开 key，改用 `${nationId}_${buildingId}` 字符串，保证唯一性且与合并逻辑对齐。

### 关键决策

- **聚合在 useMemo 内完成**：聚合结果缓存，仅在 `foreignInvestments` / `nations` 变化时重算，不污染渲染路径
- **每页 5 个国家而非 10 个**：每国仍有多行明细，5 个国家约 50~100 行，体感流畅；可后续调参
- **`useEffect` 监听数据重置**：数据变化时清空 `nationPage` 和 `expandedInvIds`，防止翻到不存在的页面

## 实现注意事项

- `expandedInvIds` Set 更新须 `new Set(...)` 创建新引用触发 re-render
- 翻页控件仅在 `totalNationPages > 1` 时渲染，避免冗余 DOM
- 合并时 `operatingData` 取第一条即可，FlowVisualizer 只需建筑定义和 decisions，无需精确累加
- 国家列表改为不含 `max-h overflow-y-auto`（分页后无需滚动容器），或保留但高度可收紧

## 架构设计

```
ForeignCapitalTab
├── nationPage          (useState, 初始 1)
├── expandedInvIds      (useState<Set<string>>, key="${nationId}_${buildingId}")
├── investmentsByNation (useMemo)
│   └── nationId 分组 → 每组内 buildingId 二次合并 → mergedInvestments[]
├── pagedNations = investmentsByNation.slice((nationPage-1)*5, nationPage*5)
├── 渲染 pagedNations (最多 5 国)
│   └── 每国 group.mergedInvestments 逐行渲染
│       └── 点击行 toggle expandedInvIds → 展开 FlowVisualizer
└── 翻页控件 (totalNationPages > 1 时渲染)
```

## 目录结构

```
src/components/panels/
└── InternationalEconomyPanel.jsx  # [MODIFY] 仅改 ForeignCapitalTab：useMemo 内追加 buildingId 聚合，新增 nationPage state 和翻页控件，展开 key 改为 nationId_buildingId
```