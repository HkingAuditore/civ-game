---
name: zero-min-price
overview: 将所有物资的 minPrice 改为 0，让价格能在供过于求时真正降到零，修复建筑持续生产但价格不下跌的问题
todos:
  - id: set-price-floor-to-zero
    content: 将 constants.js 中 PRICE_FLOOR 改为 0，将 gameConstants.js 中所有物资 minPrice 改为 0（silver 除外）
    status: completed
---

## 用户需求

将游戏中所有可交易物资的最低价格下限（`minPrice`）设置为 0，同时将全局价格兜底常量 `PRICE_FLOOR` 也改为 0。

## 问题背景

当前所有物资在 `gameConstants.js` 中都配置了非零的 `minPrice`（约为 `basePrice` 的 1%，如 food=0.1, wood=0.02 等），且 `PRICE_FLOOR = 0.0001` 作为全局兜底。这导致在供过于求时价格无法降至 0，建筑仍能维持盈利而持续生产，库存无法出清，供需调节机制失效。

## 核心功能

- 将 `src/config/gameConstants.js` 中所有 47 处物资的 `minPrice` 字段改为 `0`
- 将 `src/logic/utils/constants.js` 中 `PRICE_FLOOR = 0.0001` 改为 `0`
- 价格改为 0 后，`Math.max(price, 0)` 仅防止负价格，逻辑不破坏；价格跌至 0 时建筑无利润自然停产，供需均衡得以自然实现

注意：`silver`（货币）的 `minPrice: 1` 为固定汇率锚点，**不修改**；其余所有物资统一改为 0。

## 技术栈

React 19 + Vite，纯 JS 配置与逻辑层修改，无需引入新依赖。

## 实现方案

### 核心思路

直接将两处价格下限配置清零。改动后：

- `Math.max(finalPrice, minPrice)` → `Math.max(finalPrice, 0)`，等价于只禁止负价格
- `Math.max(price, PRICE_FLOOR)` → `Math.max(price, 0)`，同上
- 价格降为 0 时建筑成本收入持平或亏损，业主利润消失，建筑自然停产，库存积压问题得以通过市场机制自行化解

### 需要修改的位置

**文件 1：`src/config/gameConstants.js`**

- 共 47 处 `minPrice: <非零值>` → `minPrice: 0`
- 特别保留：`silver` 条目的 `minPrice: 1`（货币锚定，不能改）

**文件 2：`src/logic/utils/constants.js`**

- `PRICE_FLOOR = 0.0001` → `PRICE_FLOOR = 0`
- 后续所有引用此常量的地方（`prices.js`、`simulation.js`、`wages.js`）自动生效，无需改动调用方

### 关键决策

- **不修改调用方逻辑**：`Math.max(x, 0)` 在数学上等价于不允许负价格，行为完全合理，无需重构
- **不删除 minPrice 字段**：保留字段结构，只将值改为 0，便于将来按需单独调整某资源
- **silver 除外**：货币的固定汇率 `minPrice: 1` 是设计意图，不属于市场价格下限问题

## 目录结构

```
src/
├── config/
│   └── gameConstants.js   # [MODIFY] 将所有 RESOURCES 中的 minPrice 改为 0（silver 除外）
└── logic/
    └── utils/
        └── constants.js   # [MODIFY] PRICE_FLOOR = 0.0001 → 0
```

## 实现注意事项

- `wages.js` 中的 `Math.max(PRICE_FLOOR, prev)` 改后变为 `Math.max(0, prev)`，工资不会变负，无副作用
- `prices.js` 中的 `return PRICE_FLOOR` 改后返回 0，供无产出建筑时兜底价格为 0，符合预期
- `simulation.js` 中三处 `minPrice ?? PRICE_FLOOR` 在 minPrice=0 时取到 0，行为正确（`??` 只在 undefined/null 时取右值，0 是合法值会被正常使用）