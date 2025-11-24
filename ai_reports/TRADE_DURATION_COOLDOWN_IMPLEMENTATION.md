# 商人交易延迟与冷却机制实现文档

## 概述

本文档详细说明了商人交易系统中 `tradeDuration`（贸易周期）和 `tradeCooldown`（交易冷却）两个参数的实现。

## 实现日期

2025-11-24

## 新增参数

### 1. tradeDuration（贸易周期）

**定义**: 商品从购买到出售之间的等待天数，模拟运输和交易时间。

**默认值**: 3天

**工作原理**:
- 商人购买商品时立即支付成本和税费
- 商品进入"待完成交易"队列，设置 `daysRemaining = tradeDuration`
- 每个游戏tick，`daysRemaining` 减1
- 当 `daysRemaining` 降至0时，交易完成，商人获得收入

**影响**:
- **出口**: 商品立即从本地库存扣除，但收入延迟获得
- **进口**: 商品延迟到货，到货后才能在本地市场出售
- **资金压力**: 较长的周期会占用商人资金，影响后续交易能力

### 2. tradeCooldown（交易冷却）

**定义**: 两次交易之间的最小间隔天数，用于限制交易频率。

**默认值**: 0（无冷却）

**工作原理**:
- 记录上次交易的tick时间（`lastTradeTime`）
- 每次尝试交易时检查：`tick - lastTradeTime >= tradeCooldown`
- 只有满足冷却时间要求才能进行新的交易
- 成功交易后更新 `lastTradeTime = tick`

**影响**:
- 防止商人过于频繁交易
- 模拟真实的商业节奏
- 游戏平衡：避免商人通过高频交易快速致富

## 代码实现

### 数据结构

#### pendingTrades（待完成交易列表）

```javascript
[
  {
    type: 'export' | 'import',  // 交易类型
    resource: 'cloth',           // 商品名称
    amount: 10,                  // 数量
    revenue: 400,                // 预期收入
    profit: 380,                 // 预期利润
    daysRemaining: 3             // 剩余天数
  },
  // ... 更多交易
]
```

#### lastTradeTime（上次交易时间）

```javascript
lastTradeTime: 1234  // tick编号
```

### 核心逻辑

#### 1. 处理待完成交易

```javascript
// 每个tick处理一次
const updatedPendingTrades = [];
pendingTrades.forEach(trade => {
  trade.daysRemaining -= 1;
  
  if (trade.daysRemaining <= 0) {
    // 交易完成
    roleWagePayout.merchant += trade.revenue;
    
    if (trade.type === 'import') {
      // 进口商品到货
      res[trade.resource] += trade.amount;
      supply[trade.resource] += trade.amount;
    }
  } else {
    // 继续等待
    updatedPendingTrades.push(trade);
  }
});
```

#### 2. 检查冷却时间

```javascript
const ticksSinceLastTrade = tick - lastTradeTime;
const canTradeNow = ticksSinceLastTrade >= tradeConfig.tradeCooldown;

if (!canTradeNow) {
  // 还在冷却期，不能交易
  return { pendingTrades: updatedPendingTrades, lastTradeTime };
}
```

#### 3. 创建新交易

```javascript
// 出口示例
if (满足交易条件) {
  // 立即支付成本
  wealth.merchant -= totalOutlay;
  roleExpense.merchant += totalOutlay;
  taxBreakdown.industryTax += totalTax;
  
  // 出口：立即扣除库存
  res[resourceKey] -= totalAmount;
  supply[resourceKey] -= totalAmount;
  
  // 添加到待完成交易
  updatedPendingTrades.push({
    type: 'export',
    resource: resourceKey,
    amount: totalAmount,
    revenue: totalRevenue,
    profit: totalRevenue - totalOutlay,
    daysRemaining: tradeConfig.tradeDuration
  });
  
  // 更新最后交易时间
  lastTradeTime = tick;
}
```

### 状态持久化

为了让机制正常工作，需要在游戏状态中保存和传递这些数据：

#### simulateTick 函数签名

```javascript
export const simulateTick = ({
  // ... 其他参数
  pendingTrades = [],      // 新增
  lastTradeTime = 0,       // 新增
}) => {
  // ...
}
```

#### simulateTick 返回值

```javascript
return {
  // ... 其他返回值
  pendingTrades: updatedPendingTrades,  // 新增
  lastTradeTime: updatedLastTradeTime,  // 新增
};
```

#### 游戏主循环集成

```javascript
// 游戏状态
const gameState = {
  // ... 其他状态
  pendingTrades: [],
  lastTradeTime: 0,
};

// 每个tick
const result = simulateTick({
  // ... 其他参数
  pendingTrades: gameState.pendingTrades,
  lastTradeTime: gameState.lastTradeTime,
});

// 更新状态
gameState.pendingTrades = result.pendingTrades;
gameState.lastTradeTime = result.lastTradeTime;
```

## 配置示例

### 快速交易（适合测试）

```javascript
tradeConfig: {
  tradeDuration: 1,    // 1天完成交易
  tradeCooldown: 0,    // 无冷却，每天都能交易
}
```

### 标准交易（平衡）

```javascript
tradeConfig: {
  tradeDuration: 3,    // 3天完成交易
  tradeCooldown: 0,    // 无冷却
}
```

### 慢节奏交易（真实模拟）

```javascript
tradeConfig: {
  tradeDuration: 7,    // 7天完成交易（长途运输）
  tradeCooldown: 3,    // 3天冷却（商人需要休息）
}
```

### 极限保守

```javascript
tradeConfig: {
  tradeDuration: 10,   // 10天完成交易
  tradeCooldown: 5,    // 5天冷却
}
```

## 调试日志

启用 `enableDebugLog: true` 后，可以看到：

### 购买阶段

```
[商人调试] 📦 购买布料准备出口: {
  amount: 10,
  cost: 20.4,
  tax: 4.08,
  expectedRevenue: 400,
  expectedProfit: 375.52,
  profitMargin: "1536.00%",
  daysUntilSale: 3
}
```

### 完成阶段

```
[商人调试] ✅ 交易完成: {
  type: "出口",
  resource: "cloth",
  amount: 10,
  revenue: 400,
  profit: 375.52
}
```

## 游戏影响分析

### tradeDuration 的影响

| 设置 | 优点 | 缺点 |
|------|------|------|
| 短周期 (1-2天) | 商人快速获得收益，资金周转快 | 不够真实，可能导致经济过热 |
| 中周期 (3-5天) | 平衡真实性和游戏性 | 适中 |
| 长周期 (7-10天) | 更真实，增加策略深度 | 商人资金压力大，可能影响交易频率 |

### tradeCooldown 的影响

| 设置 | 优点 | 缺点 |
|------|------|------|
| 无冷却 (0) | 商人可以充分利用市场机会 | 可能导致过度交易 |
| 短冷却 (1-2天) | 轻微限制，保持活跃 | 适中 |
| 长冷却 (3-5天) | 强制商人谨慎选择交易时机 | 可能错过好的交易机会 |

### 组合效果

**快速激进型** (tradeDuration=1, tradeCooldown=0)
- 商人非常活跃，频繁交易
- 适合快节奏游戏
- 可能导致经济波动大

**标准平衡型** (tradeDuration=3, tradeCooldown=0)
- 推荐的默认设置
- 平衡真实性和游戏性

**真实模拟型** (tradeDuration=7, tradeCooldown=3)
- 更接近真实的中世纪贸易
- 商人需要更多资金储备
- 增加策略深度

**极限保守型** (tradeDuration=10, tradeCooldown=5)
- 贸易变得非常谨慎
- 适合硬核玩家
- 可能导致商人阶层发展缓慢

## 与其他系统的交互

### 1. 转职系统

- 商人收入评估现在需要考虑待完成交易
- 建议使用近30天平均收入（已实现）
- 避免因短期资金占用导致误判

### 2. 税收系统

- 税费在购买时立即收取
- 不受交易延迟影响

### 3. 市场系统

- 出口商品立即从市场移除
- 进口商品延迟到货
- 影响供需平衡

### 4. 财富系统

- 商人财富在购买时立即减少
- 在出售时才增加
- 待完成交易期间资金被占用

## 未来改进建议

1. **UI显示**
   - 在商人面板显示待完成交易列表
   - 显示预期收入和剩余天数
   - 显示下次可交易时间（冷却倒计时）

2. **交易历史**
   - 记录最近N次交易
   - 统计总利润、成功率等
   - 用于玩家分析和决策

3. **风险机制**
   - 长途贸易可能遇到意外（海盗、天气等）
   - 根据tradeDuration增加风险概率
   - 失败时损失部分或全部商品

4. **商人专业化**
   - 不同商人可以有不同的tradeDuration
   - 经验丰富的商人可以缩短周期
   - 增加商人升级系统

5. **贸易路线**
   - 不同国家的tradeDuration不同
   - 远距离贸易周期更长但利润更高
   - 增加地理因素

## 测试建议

### 基础测试

1. 设置 `tradeDuration=1, tradeCooldown=0, enableDebugLog=true`
2. 观察商人是否正常交易
3. 检查1天后是否获得收入

### 延迟测试

1. 设置 `tradeDuration=5, enableDebugLog=true`
2. 记录购买时间
3. 验证5天后才获得收入
4. 检查期间商人财富变化

### 冷却测试

1. 设置 `tradeCooldown=3, enableDebugLog=true`
2. 观察商人交易后是否等待3天
3. 验证冷却期间不会新交易

### 组合测试

1. 设置 `tradeDuration=3, tradeCooldown=2`
2. 验证交易节奏符合预期
3. 检查多个交易是否正确排队

### 边界测试

1. 测试 `tradeDuration=0`（立即完成）
2. 测试 `tradeCooldown=0`（无冷却）
3. 测试极大值（如tradeDuration=30）

## 相关文件

- **配置文件**: `src/config/strata.js`
- **核心逻辑**: `src/logic/simulation.js`
- **配置文档**: `ai_reports/MERCHANT_TRADE_CONFIG.md`

## 版本历史

### v1.0 (2025-11-24)
- ✅ 实现 tradeDuration 参数
- ✅ 实现 tradeCooldown 参数
- ✅ 添加 pendingTrades 机制
- ✅ 更新调试日志
- ✅ 编写完整文档
