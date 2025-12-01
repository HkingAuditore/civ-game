# 战争事件Bug修复文档

## 问题描述

在战争期间，敌方的突袭和求和事件没有触发相应的事件弹窗。即使事件弹窗能够显示，赔款金额显示为0，人口需求显示为NaN。

## 问题原因

### 1. 参数传递错误

在 `useGameLoop.js` 中调用 `handleEnemyPeaceAccept` 函数时，缺少了 `proposalType` 参数。

**错误代码：**
```javascript
actions.handleEnemyPeaceAccept(nation.id, amount || tribute)
```

**正确代码：**
```javascript
actions.handleEnemyPeaceAccept(nation.id, proposalType, amount || tribute)
```

### 2. React闭包陷阱

`useGameLoop` 中的 `actions` 对象没有被添加到 `stateRef` 中，导致在事件检测逻辑中 `actions` 始终为 `undefined`。

### 3. 赔款金额计算不合理

在 `simulation.js` 中，`tribute` 的计算可能导致金额为0：

```javascript
const tribute = Math.min(next.wealth || 0, Math.max(50, Math.ceil((next.warScore || 0) * 30 + (next.enemyLosses || 0) * 2)));
```

当 `next.wealth` 很小时，`tribute` 可能为0。

### 4. 人口需求计算错误

在 `createEnemyPeaceRequestEvent` 函数中，使用了 `nation.population`，但是 nation 对象**没有 `population` 字段**，导致计算结果为 `NaN`：

```javascript
const populationDemand = Math.floor(nation.population * 0.05); // nation.population 是 undefined
```

### 5. 分期支付金额计算错误

分期支付金额除以12（月）而不是365（天），导致显示不正确：

```javascript
const installmentAmount = Math.floor(tribute / 12); // 应该是 365
```

## 修复方案

### 1. 修复 useGameLoop.js

**文件：** `src/hooks/useGameLoop.js`

**在文件开头添加 import 语句**（约第11行）：
```javascript
import { createEnemyPeaceRequestEvent, createBattleEvent } from '../config/events';
```

**移除动态 require 语句**：
```javascript
// ❌ 移除这行
const { createEnemyPeaceRequestEvent } = require('../config/events');

// ✅ 直接使用已导入的函数
const event = createEnemyPeaceRequestEvent(...);
```

**修改位置 1**：初始化 `stateRef`（约第247行）
```javascript
const stateRef = useRef({
  resources,
  market,
  // ... 其他状态
  tradeRoutes,
  actions,  // ✅ 添加 actions
});
```

**修改位置 2**：更新 `stateRef` 的 `useEffect`（约第288行）
```javascript
useEffect(() => {
  stateRef.current = {
    resources,
    market,
    // ... 其他状态
    tradeRoutes,
    actions,  // ✅ 添加 actions
  };
}, [
  resources, 
  market, 
  // ... 其他依赖
  tradeRoutes, 
  actions  // ✅ 添加到依赖数组
]);
```

**修改位置 3**：在事件检测代码中使用 `current.actions`（约第645行）
```javascript
// 检测外交事件并触发事件系统
const currentActions = current.actions;  // ✅ 从 current 中获取 actions
if (currentActions && currentActions.triggerDiplomaticEvent) {
  result.logs.forEach(log => {
    // ... 事件检测逻辑
    currentActions.triggerDiplomaticEvent(event);  // ✅ 使用 currentActions
  });
}
```

**修改位置 4**：修复和平请求参数传递（约第684行）
```javascript
// 修改前
actions.handleEnemyPeaceAccept(nation.id, amount || tribute)

// 修改后
currentActions.handleEnemyPeaceAccept(nation.id, proposalType, amount || tribute)
```

**修改位置 5**：清除和平请求标志（约第691行）
```javascript
// 清除和平请求标志，避免重复触发
setNations(prev => prev.map(n => 
  n.id === nation.id ? { ...n, isPeaceRequesting: false } : n
));
```

### 2. 修复 simulation.js

**文件：** `src/logic/simulation.js`

#### 修改：改进 tribute 计算逻辑

确保 `tribute` 至少有一个合理的最小值：

```javascript
// 计算赔款金额，确保至少有一个合理的最小值
const baseTribute = Math.ceil((next.warScore || 0) * 30 + (next.enemyLosses || 0) * 2);
const minTribute = Math.max(200, Math.floor((next.wealth || 800) * 0.1)); // 至少是财富的10%，最低200
const maxTribute = Math.floor((next.wealth || 800) * 0.8); // 最多是财富的80%
const tribute = Math.min(maxTribute, Math.max(minTribute, baseTribute));
// 只记录日志，不直接处理和平，让事件系统处理
logs.push(`🤝 ${next.name} 请求和平，愿意支付 ${tribute} 银币作为赔款。`);
// 标记该国家正在请求和平，避免重复触发
next.isPeaceRequesting = true;
// 保存tribute值到nation对象，供事件系统使用
next.peaceTribute = tribute;
```

### 3. 修复 events.js

**文件：** `src/config/events.js`

#### 修改1：修复人口需求计算（warScore > 20）

使用财富估算人口，而不是直接使用 `nation.population`：

```javascript
// 使用财富估算人口（假设每100财富对应约50人口）
const estimatedPopulation = Math.floor((nation.wealth || 800) / 100 * 50);
const populationDemand = Math.max(5, Math.floor(estimatedPopulation * 0.05)); // 要求5%人口，至少5人
```

#### 修改2：修复分期支付金额计算（warScore > 20）

除以365天而不是12月：

```javascript
const installmentAmount = Math.floor(highTribute / 365); // 每天支付
```

#### 修改3：修复人口需求计算（warScore > 10）

同样使用财富估算人口：

```javascript
const installmentAmount = Math.floor(tribute / 365); // 每天支付
// 使用财富估算人口（假设每100财富对应约50人口）
const estimatedPopulation = Math.floor((nation.wealth || 800) / 100 * 50);
const populationDemand = Math.max(3, Math.floor(estimatedPopulation * 0.03)); // 要求3%人口，至少3人
```

## 技术要点

### React 闭包陷阱
在 `useEffect` 中使用 `setInterval` 时，闭包会捕获创建时的变量值。解决方案：
1. 使用 `useRef` 保存最新状态
2. 在 `useEffect` 中更新 ref 的值
3. 在闭包中使用 `ref.current` 访问最新值
4. 将变量添加到依赖数组中

### 示例
```javascript
// ❌ 错误：闭包捕获初始值
const MyComponent = ({ actions }) => {
  useEffect(() => {
    const timer = setInterval(() => {
      actions.doSomething();  // actions 可能是 undefined
    }, 1000);
    return () => clearInterval(timer);
  }, []);  // 空依赖数组
};

// ✅ 正确：使用 ref 保存最新值
const MyComponent = ({ actions }) => {
  const stateRef = useRef({ actions });
  
  useEffect(() => {
    stateRef.current = { actions };
  }, [actions]);
  
  useEffect(() => {
    const timer = setInterval(() => {
      const current = stateRef.current;
      current.actions?.doSomething();  // 访问最新的 actions
    }, 1000);
    return () => clearInterval(timer);
  }, []);
};
```

### Nation对象结构

从代码分析可知，nation对象**不包含 `population` 字段**。nation对象的主要字段包括：
- `id`：国家ID
- `name`：国家名称
- `wealth`：财富值
- `budget`：预算
- `inventory`：资源库存
- `relation`：与玩家的关系
- `warScore`：战争分数
- `isAtWar`：是否处于战争状态
- `isPeaceRequesting`：是否正在请求和平
- 等等

因此，在需要人口数据时，必须使用其他方式估算（如基于财富值）。

## 测试步骤

### 测试突袭事件

1. 与AI国家开战
2. 等待AI发起突袭（概率事件）
3. 应该会弹出战斗事件弹窗，显示资源损失

### 测试求和事件

1. 与AI国家开战
2. 持续获胜，提高战争分数至 > 12
3. 等待AI请求和平（概率事件）
4. 应该会弹出和平请求事件弹窗，显示不同的和平选项
5. **验证赔款金额不为0，人口需求不为NaN**

## 后续优化建议

1. 移除调试日志（在生产环境中）
2. 考虑使用更健壮的事件系统（如事件总线）
3. 将事件检测逻辑从 `useGameLoop` 中分离出来
4. 添加单元测试来验证事件触发逻辑
5. **在nation对象中添加 `population` 字段，以便更准确地计算人口需求**
6. **统一分期支付的时间单位（天 vs 月）**

## 修复结果

- ✅ 突袭事件正常弹出
- ✅ 求和事件正常弹出
- ✅ 事件窗口显示正确的信息
- ✅ 事件回调函数正常工作
- ✅ 不再有重复触发的问题

## 修复日期

2025-12-01
