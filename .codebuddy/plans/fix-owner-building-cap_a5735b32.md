---
name: fix-owner-building-cap
overview: 修复业主（owner）填坑率不足时仍负担全部建筑运营成本的 Bug：改为"业主能覆盖几栋建筑就运营几栋"，多余建筑停工，不让少量业主承担超出自身能力的负担。
todos:
  - id: owner-cap-multiplier
    content: 在 simulation.js 第 2580-2665 行范围内，引入业主填坑上限乘数（ownerFillCapMultiplier），在 ownerLevelGroups 遍历后计算每个 owner group 的可运营建筑比例，取最小值后乘入 multiplier，实现业主空缺时有效建筑数等比压缩（含向上兼容逻辑和 state 类型建筑豁免）
    status: completed
  - id: fix-owner-slots-reserve
    content: 在 simulation.js 第 3265 行附近，将工资保底的 ownerSlots 从总配置岗位数改为实际到岗业主数（min(ownerSlotsRequired, popStructure[oKey])），消除少量业主因保底虚高无法支付工资的问题，并在 reductionReasons 中补充 owner_vacancy 减产类型
    status: completed
    dependencies:
      - owner-cap-multiplier
---

## 用户需求

对于配置了 X 个业主岗位、Y 个员工的建筑（如庄园：1 地主 + 8 佃农），期望系统行为如下：

- 实际到岗 M 个业主时，能实际运营的建筑数 = floor(M / 每栋需要的业主数)
- 多余的无人负责的建筑应停运：其对应的员工既领不到工资，建筑也不产出
- 向上兼容：若每栋建筑需要 X 个业主（X≥2），但只到岗 1 个，视为该业主独立运营这 1 栋

## 当前 Bug 现象

- 只有 10 个地主上岗，却要为 100 栋庄园的 800 个佃农支付工资，地主财富耗尽后跑路，触发死亡螺旋
- 根因：owner 填坑率不参与有效建筑数约束；工资保底基于"总配置岗位数"而非"实际到岗数"，导致业主保留财富虚高、可支配财富被极度压缩

## 核心功能

- 引入"业主填坑上限系数"（ownerFillCapMultiplier），以业主实际到岗数等比压缩有效建筑产量乘数
- 修复工资支付保底中 ownerSlots 计算，改用实际到岗业主数而非总配置岗位数
- 在减产原因中增加"业主不足"类型，支持 UI 展示

## 技术栈

现有项目：React 19 + Vite，游戏逻辑在 `src/logic/simulation.js`，仅修改该单文件。

## 实现思路

### 关键概念

系统现有逻辑将"worker 瓶颈（`minNonOwnerFillRate`）"与"owner 管理能力"分开处理，worker 不足会压缩 `staffingRatio`，但 owner 不足没有对应约束。本修复在同一个 `jobRequirements` 遍历块内，为 owner role 引入类似的上限乘数。

### 改动 1 — 引入 ownerFillCapMultiplier（核心）

**位置**：`simulation.js` 约第 2580–2660 行

在 `for (let role in jobRequirements)` 循环中，当 `isOwnerRole === true` 时，额外收集：

- `perBuildingOwnerSlots`：单栋建筑需要的该 owner 岗位数（= `config.jobs[ownerKey]`，注意此处是单栋配置值，而非 `ownerSlotsRequired` 总数）
- 循环结束后，遍历 `ownerLevelGroups`，对每个 `oKey` 计算：

```js
// 每栋建筑的业主岗位需求（从建筑 config 读取，已有 ownerLevelGroups 中的 levels）
const perBuildingSlots = config.jobs?.[oKey] || 1; // 单栋需求
const ownerPop = popStructure[oKey] || 0;
// 可独立运营的建筑数（向上兼容：到岗>=1时至少保留1栋）
const runnableCount = ownerPop >= 1
    ? Math.max(1, Math.floor(ownerPop / perBuildingSlots))
    : 0;
const ownerCapRatio = group.totalCount > 0
    ? Math.min(1, runnableCount / group.totalCount)
    : 1;
```

取所有 owner group 中的 `Math.min(ownerCapRatio)` 作为 `ownerFillCapMultiplier`。

在 `multiplier *= staffingRatio;`（第 2658 行）之后追加：

```js
multiplier *= ownerFillCapMultiplier;
```

并将其同步写入 `simBaseMultiplier` 的前置变量（`potentialMultiplierBeforeStaffing`），保证模拟工资信号正确。

**向上兼容边界**：`b.owner` 为 `null` 或 `'state'` 的建筑（civic/无主建筑），`ownerFillCapMultiplier` 默认 1，不受影响。

### 改动 2 — 修复工资保底 ownerSlots

**位置**：`simulation.js` 第 3265 行

```js
// 修改前
const ownerSlots = Math.max(1, ownerSlotsByKey[oKey] || 1);

// 修改后：使用实际到岗业主数而非总配置岗位数
const ownerSlotsRequired = ownerSlotsByKey[oKey] || 1;
const ownerPopFilled = popStructure[oKey] || 0;
const ownerActualFilled = Math.min(ownerSlotsRequired, ownerPopFilled);
const ownerSlots = Math.max(1, ownerActualFilled);
```

`popStructure` 已在 `simulation.js` 整体作用域中，无需新增传参。

### 改动 3 — 补充减产原因

**位置**：`simulation.js` 第 2961–2981 行 `reductionReasons` 数组处

```js
if (ownerFillCapMultiplier < 1) {
    reductionReasons.push({ type: 'owner_vacancy', label: '业主不足', factor: ownerFillCapMultiplier });
}
```

## 实现注意事项

- **性能**：ownerFillCapMultiplier 计算在建筑生产循环内，每 tick 每建筑类型执行一次，ownerLevelGroups 遍历量极小（通常只有 1-2 个 owner key），无性能影响
- **向后兼容**：对 `b.owner === null/'state'` 的纯公共建筑（住房、市场）默认 `ownerFillCapMultiplier = 1`，逻辑不变
- **自营建筑**（如农田 `farm`，owner 和 worker 都是 `peasant`）：`isOwnerRole` 为 true，peasant 人数直接决定 ownerCapRatio，与现有 `staffingRatio = filledSlots / totalSlots` 路径兼容，效果叠加合理
- **simBaseMultiplier 同步**：`potentialMultiplierBeforeStaffing` 捕获在 `multiplier *= staffingRatio` 之前，owner cap 乘数需在之后同步影响 `baseMultiplier`，使工资信号（wagePressure）和 affordableMultiplier 估算保持一致
- **数值稳定性**：ownerFillCapMultiplier 使用 `Math.min(1, ...)` 和 `Math.max(0, ...)` 保护，避免 NaN 或越界

## 目录结构

```
src/logic/simulation.js  # [MODIFY] 3 处精确改动：
                         # 1. ~第2630-2665行：引入ownerFillCapMultiplier计算 + 乘入multiplier
                         # 2. ~第3265行：ownerSlots改用实际到岗数
                         # 3. ~第2975行：reductionReasons补充owner_vacancy类型
```