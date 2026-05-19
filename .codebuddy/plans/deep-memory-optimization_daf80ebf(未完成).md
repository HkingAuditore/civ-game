---
name: deep-memory-optimization
overview: 基于两次堆快照对比（441MB→825MB，heap number从760万暴增到2314万），系统性修复游戏运行中每tick线性增长的Object/Number/String对象泄漏。核心问题是：simulateTick每tick返回的巨型result对象（~190个字段）通过Worker postMessage结构化克隆+React setState闭包链，导致旧状态快照无法被GC。
---

## 用户需求

对游戏运行2年后堆内存从441MB暴涨到825MB（55M节点）的问题，制定一个深层、细致、可落地的架构级内存优化方案。

## 产品概述

这是一个基于React的文明模拟游戏（哈耶克的文明：市场经济），使用Web Worker进行模拟计算。游戏每tick（约200-1000ms）执行一次完整的经济/外交/人口模拟，产生大量临时对象和深层嵌套数据结构。

## 核心问题

1. **heap number从760万暴增到2314万（+178MB）** — 每tick创建的浮点<plan_result>
<req>

## 用户需求

游戏运行2个游戏年后堆内存从441MB暴增至825MB（快照55M节点/3.18GB），需要一个深层的、架构级的内存优化方案来解决线性增长的内存泄漏问题。

## 产品概述

这是一个基于React + Vite的文明模拟游戏，核心游戏循环每tick调用simulateTick计算经济/外交/军事等状态，通过Web Worker在后台线程执行，再通过postMessage将结果传回主线程更新React状态。

## 核心问题

1. **heap number从760万暴增至2314万（+178MB）**：每tick创建的浮点数对象未被GC回收
2. **Object从235万暴增至554万（+166MB）**：大量游戏状态对象通过浅拷贝链和React闭包被长期持有
3. **数值字符串如"0.25"从88K暴增至213K**：Object.entries/Object.keys产生的key字符串累积
4. 第一轮修复的PerformanceMeasure/console泄漏仅占总堆的3%，核心问题是每tick产生的约5万个临时JS对象和约20万个浮点数未被及时回收

## 核心优化目标

- 将2游戏年后的堆内存从825MB降至200-300MB范围
- 消除线性增长趋势，使内存在运行一段时间后趋于稳定

## 技术栈

- React 19 + Vite + Tailwind CSS
- Web Worker（simulation.worker.js）用于后台计算
- 无状态管理库，全部使用useState/useRef

## 实现方案

### 策略一：Worker通信增量化（预计节省40-60%传输量）

**核心思路**：在Worker中维护上一tick的完整state快照，每tick只传回变化的字段（delta），主线程合并delta到当前state。

**具体做法**：

- Worker内部缓存 `_prevResult` 对象，每tick计算完后与上一tick做浅比较
- 对于大型不变字段（nations中未参战的nation、未变化的prices），传回 `undefined` 表示沿用上一次
- nations数组改为只传回有变化的nation（通过比较关键字段如wealth/population/relation判断）
- market对象：prices/demand/supply每tick都变需要传；stratumConsumption/supplyBreakdown/demandBreakdown已有降频
- 主线程在useSimulationWorker中维护 `_lastFullResult` ref，收到delta后合并

**影响文件**：

- `src/workers/simulation.worker.js` — 添加增量diff逻辑
- `src/hooks/useSimulationWorker.js` — 添加增量merge逻辑

**性能考量**：

- 浅比较的开销远小于结构化克隆的开销
- nations数组（10-20个nation）的浅比较只需检查几个关键字段
- 最差情况（所有数据都变了）退化为全量传输，不会比现在差

### 策略二：simulation返回对象分层（预计减少30-50%对象创建）

**核心思路**：将simulateTick返回对象分为三层：

- **Layer 0 (必需层)**：下一tick计算必需的数据（resources, popStructure, nations, market.prices/demand/supply/wages, army, stability等）
- **Layer 1 (UI层)**：仅供UI显示的数据（classFinancialData, buildingFinancialData, approvalBreakdown, economicIndicators等）
- **Layer 2 (调试层)**：仅调试用（_auditLog, _debug, buildingDebugData, modifiers.sources）

**具体做法**：

- Layer 2已通过stripPayloadForTransfer处理，继续保持
- Layer 1的UI数据改为懒计算：不在simulateTick中计算，而是在主线程需要时（面板打开时）才计算
- 或者Layer 1数据降频到每10tick才计算一次（利用现有的_isFullTick机制）
- simulation.js返回对象中删除重复字段（如needsShortages在market和顶层都有）

**影响文件**：

- `src/logic/simulation.js` — 条件化Layer 1计算
- `src/workers/simulation.worker.js` — stripPayloadForTransfer增强

### 策略三：nations就地修改消除浅拷贝链（预计减少50-70%的nation相关对象创建）

**核心思路**：在simulation内部，nations对象改为就地修改（mutate-in-place），而不是每tick为每个nation创建5-8个浅拷贝。

**具体做法**：

- `updateNations` 函数中，对每个nation直接修改属性而非 `{ ...nationInput }`
- `updateNationEconomyData` 中