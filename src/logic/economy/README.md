# Economic Indicators Module

经济指标计算模块

## 📋 概述

本模块提供游戏经济指标的计算功能，包括：
- **价格历史管理**: 记录和维护市场价格历史
- **长期均衡价格**: 基于90天滚动平均的动态基准价格
- **GDP**: 国内生产总值（支出法）
- **CPI**: 消费者物价指数
- **PPI**: 生产者物价指数

## 🎯 核心概念

### 长期均衡价格

使用90天滚动平均作为CPI/PPI的动态基准，相比静态basePrice更能反映真实经济状况。

**优势**：
- ✅ 自动适应时代变化
- ✅ 反映真实供需关系
- ✅ 平滑短期价格波动

## 📚 API文档

### 价格历史管理

#### `updatePriceHistory(params)`

更新价格历史记录

**参数**：
```javascript
{
  priceHistory: Object,    // 当前价格历史
  currentPrices: Object,   // 当前市场价格
  maxLength: number        // 最大保留天数（默认365）
}
```

**返回**：
```javascript
{
  food: [1.0, 1.1, 1.2, ...],
  wood: [2.0, 2.1, 2.0, ...],
  // ... 其他资源
}
```

**示例**：
```javascript
const updatedHistory = updatePriceHistory({
  priceHistory: currentHistory,
  currentPrices: marketPrices,
  maxLength: 365,
});
```

---

### 均衡价格计算

#### `calculateEquilibriumPrices(params)`

计算长期均衡价格（90天滚动平均）

**参数**：
```javascript
{
  priceHistory: Object,    // 价格历史数据
  basePrices: Object,      // 基准价格（fallback）
  window: number           // 滚动窗口天数（默认90）
}
```

**返回**：
```javascript
{
  food: 1.15,    // 90天平均价格
  wood: 2.05,
  // ... 其他资源
}
```

**示例**：
```javascript
const equilibriumPrices = calculateEquilibriumPrices({
  priceHistory: history,
  basePrices: getBasePrices(),
  window: 90,
});
```

---

### GDP计算

#### `calculateGDP(params)`

计算GDP（支出法）：GDP = C + I + G + NX

**参数**：
```javascript
{
  classFinancialData: Object,      // 阶层财务数据
  buildingFinancialData: Object,   // 建筑财务数据
  dailyMilitaryExpense: number,    // 每日军费
  officials: Array,                // 官员列表
  taxBreakdown: Object,            // 税收分解
  demandBreakdown: Object,         // 需求分解
  marketPrices: Object,            // 市场价格
  previousGDP: number              // 上期GDP
}
```

**返回**：
```javascript
{
  total: 50000,           // GDP总计
  consumption: 30000,     // 消费
  investment: 10000,      // 投资
  government: 8000,       // 政府支出
  netExports: 2000,       // 净出口
  change: 2.5,            // 增长率%
  breakdown: {            // 详细分解
    consumption: 30000,
    investment: 10000,
    government: 8000,
    netExports: 2000,
    exports: 5000,
    imports: 3000,
  }
}
```

**示例**：
```javascript
const gdp = calculateGDP({
  classFinancialData: result.classFinancialData,
  buildingFinancialData: result.buildingFinancialData,
  dailyMilitaryExpense: result.dailyMilitaryExpense,
  officials: current.officials,
  taxBreakdown: result.taxes.breakdown,
  demandBreakdown: market.demandBreakdown,
  marketPrices: market.prices,
  previousGDP: previousIndicators.gdp?.total || 0,
});
```

---

### CPI计算

#### `calculateCPI(params)`

计算消费者物价指数

**参数**：
```javascript
{
  marketPrices: Object,         // 当前市场价格
  equilibriumPrices: Object,    // 长期均衡价格
  previousCPI: number           // 上期CPI
}
```

**返回**：
```javascript
{
  index: 105.3,           // CPI指数
  change: 1.2,            // 变化率%
  breakdown: {            // 各资源贡献
    food: {
      weight: 0.4,
      currentPrice: 1.2,
      basePrice: 1.0,
      priceChange: 20,
      contribution: 8,
    },
    // ... 其他资源
  }
}
```

**消费者篮子权重**：
```javascript
{
  food: 0.40,      // 40% - 生活必需品
  cloth: 0.15,     // 15% - 基础衣物
  wood: 0.10,      // 10% - 燃料/建材
  iron: 0.10,      // 10% - 工具/器具
  luxury: 0.15,    // 15% - 奢侈品
  wine: 0.05,      // 5% - 娱乐消费
  books: 0.05,     // 5% - 文化消费
}
```

**示例**：
```javascript
const cpi = calculateCPI({
  marketPrices: market.prices,
  equilibriumPrices: equilibriumPrices,
  previousCPI: previousIndicators.cpi?.index || 100,
});
```

---

### PPI计算

#### `calculatePPI(params)`

计算生产者物价指数

**参数**：
```javascript
{
  marketPrices: Object,         // 当前市场价格
  equilibriumPrices: Object,    // 长期均衡价格
  previousPPI: number           // 上期PPI
}
```

**返回**：与CPI相同结构

**生产者篮子权重**：
```javascript
{
  food: 0.20,      // 20% - 农产品
  wood: 0.25,      // 25% - 木材
  stone: 0.15,     // 15% - 石材
  iron: 0.20,      // 20% - 金属
  coal: 0.15,      // 15% - 能源
  cloth: 0.05,     // 5% - 纺织品
}
```

---

### 综合计算

#### `calculateAllIndicators(params)`

一次性计算所有经济指标

**参数**：包含所有必要数据的参数对象

**返回**：
```javascript
{
  gdp: { /* GDP数据 */ },
  cpi: { /* CPI数据 */ },
  ppi: { /* PPI数据 */ }
}
```

## 🔧 配置参数

```javascript
ECONOMIC_INDICATOR_CONFIG = {
  priceHistory: {
    maxLength: 365,           // 最多保留365天
    updateInterval: 1,        // 每天更新
  },
  equilibriumPrice: {
    window: 90,               // 90天滚动平均
    updateInterval: 10,       // 每10天重新计算
    minDataPoints: 30,        // 至少30天数据才使用均衡价格
  },
  gdp: {
    updateInterval: 1,        // 每天计算
  },
  inflation: {
    updateInterval: 1,        // 每天计算
    historyLength: 100,       // 保留100天历史
  },
}
```

## 📊 使用示例

### 完整流程

```javascript
import {
  updatePriceHistory,
  calculateEquilibriumPrices,
  calculateAllIndicators,
  getBasePrices,
} from './economicIndicators';

// 1. 更新价格历史（每天）
const updatedPriceHistory = updatePriceHistory({
  priceHistory: currentPriceHistory,
  currentPrices: marketPrices,
});

// 2. 计算均衡价格（每10天）
let equilibriumPrices = currentEquilibriumPrices;
if (tick % 10 === 0) {
  equilibriumPrices = calculateEquilibriumPrices({
    priceHistory: updatedPriceHistory,
    basePrices: getBasePrices(),
    window: 90,
  });
}

// 3. 计算所有经济指标（每天）
const indicators = calculateAllIndicators({
  // 价格数据
  priceHistory: updatedPriceHistory,
  equilibriumPrices,
  marketPrices,
  
  // GDP数据
  classFinancialData: result.classFinancialData,
  buildingFinancialData: result.buildingFinancialData,
  dailyMilitaryExpense: result.dailyMilitaryExpense,
  officials: current.officials,
  taxBreakdown: result.taxes.breakdown,
  demandBreakdown: market.demandBreakdown,
  
  // 历史数据
  previousIndicators: currentIndicators,
});

// 4. 使用指标数据
console.log('GDP:', indicators.gdp.total);
console.log('CPI:', indicators.cpi.index);
console.log('PPI:', indicators.ppi.index);
```

## 🧪 测试用例

### 价格历史测试

```javascript
// 测试1: 正确记录价格
const history = updatePriceHistory({
  priceHistory: {},
  currentPrices: { food: 1.2 },
});
// 预期: history.food = [1.2]

// 测试2: 长度限制
const history = updatePriceHistory({
  priceHistory: { food: [...Array(365).fill(1.0)] },
  currentPrices: { food: 1.3 },
  maxLength: 365,
});
// 预期: history.food.length = 365, 最新值为1.3
```

### 均衡价格测试

```javascript
// 测试3: 数据不足时使用平均值
const equilibrium = calculateEquilibriumPrices({
  priceHistory: { food: [1.0, 1.1] },
  basePrices: { food: 1.0 },
  window: 90,
});
// 预期: equilibrium.food = 1.05

// 测试4: 正常滚动平均
const equilibrium = calculateEquilibriumPrices({
  priceHistory: { food: [...Array(100).fill(1.0)] },
  basePrices: { food: 1.0 },
  window: 90,
});
// 预期: equilibrium.food = 1.0
```

### GDP测试

```javascript
// 测试5: GDP各组成部分
const gdp = calculateGDP({
  classFinancialData: { /* 消费=30000 */ },
  buildingFinancialData: { /* 投资=10000 */ },
  dailyMilitaryExpense: 5000,
  officials: [{ salary: 1000 }, { salary: 2000 }],
  taxBreakdown: { subsidy: -1000 },
  demandBreakdown: { exports: {}, imports: {} },
  marketPrices: {},
});
// 预期: gdp.total = 30000 + 10000 + 8000 + 0 = 48000
```

## 📝 注意事项

1. **数据有效性**: 所有计算函数都包含数据验证，确保不会因为无效数据崩溃
2. **性能优化**: 均衡价格每10天更新一次，减少计算开销
3. **向后兼容**: 当历史数据不足时，自动使用basePrice作为fallback
4. **精度**: 所有百分比计算保留2位小数

## 🔗 相关文档

- [经济指标系统设计](../../docs/经济指标系统设计.md)
- [AI经济系统重构规划](../../docs/AI经济系统重构规划.md)

---

**版本**: v1.0  
**创建日期**: 2026-02-04  
**维护者**: AI + 用户协作
