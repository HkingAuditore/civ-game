# 商人交易配置说明

## 概述

商人交易系统现在支持通过配置文件灵活控制交易行为。所有配置参数位于 `src/config/strata.js` 文件的 `merchant.tradeConfig` 对象中。

## 配置参数

### 1. minProfitMargin（最低利润率）
- **类型**: Number (0-1之间的小数)
- **默认值**: 0.10 (10%)
- **说明**: 商人只会进行利润率高于此值的交易
- **示例**: 
  - `0.10` = 10%利润率
  - `0.20` = 20%利润率
  - 设置更高的值会让商人更谨慎，只做高利润交易

### 2. maxPurchaseAmount（单次最大购买量）
- **类型**: Number
- **默认值**: 20
- **说明**: 商人单次交易的最大商品数量
- **影响**: 
  - 较小的值会让交易更频繁但规模更小
  - 较大的值会让交易规模更大但频率降低

### 3. exportProbability（出口概率）
- **类型**: Number (0-1之间的小数)
- **默认值**: 0.5 (50%)
- **说明**: 商人选择出口而非进口的概率
- **调整建议**:
  - 如果希望商人更多出口本地商品，提高此值（如0.7）
  - 如果希望商人更多进口外国商品，降低此值（如0.3）

### 4. maxInventoryRatio（最大库存占用比例）
- **类型**: Number (0-1之间的小数)
- **默认值**: 0.3 (30%)
- **说明**: 出口时，商人最多使用可用库存的此比例
- **作用**: 防止商人一次性买空本地市场
- **示例**:
  - `0.3` = 最多使用30%的可用库存
  - `0.5` = 最多使用50%的可用库存

### 5. minWealthForTrade（最低交易财富要求）
- **类型**: Number
- **默认值**: 10
- **说明**: 商人阶层总财富低于此值时停止交易
- **作用**: 防止商人破产

### 6. tradeDuration（贸易周期）
- **类型**: Number（天数）
- **默认值**: 3
- **说明**: 买入商品后等待X天才能卖出（模拟运输时间）
- **机制**:
  - **出口**: 商人购买本地商品后，需要等待tradeDuration天才能在外国市场卖出
  - **进口**: 商人从外国购买商品后，需要等待tradeDuration天才能到货并在本地卖出
  - 购买时立即支付成本和税费，卖出时才获得收入
- **影响**:
  - 较长的周期会增加商人的资金压力（资金被占用）
  - 较短的周期会让商人更快获得收益
  - 设置为0表示立即完成交易（无延迟）

### 7. tradeCooldown（交易冷却时间）
- **类型**: Number（天数）
- **默认值**: 0
- **说明**: 两次交易之间的最小间隔时间
- **机制**:
  - 商人完成一次交易后，需要等待tradeCooldown天才能进行下一次交易
  - 用于限制交易频率，防止商人过于频繁交易
- **影响**:
  - 设置为0表示无冷却，商人可以每天交易
  - 设置为1表示商人每2天才能交易一次
  - 设置为3表示商人每4天才能交易一次
- **用途**:
  - 模拟真实的商业节奏
  - 游戏平衡：防止商人通过高频交易快速致富

### 8. enableDebugLog（启用调试日志）
- **类型**: Boolean
- **默认值**: false
- **说明**: 是否在浏览器控制台输出详细的交易调试信息
- **用途**: 
  - 设置为 `true` 可以查看布料等商品的详细交易信息
  - 用于调试和分析商人交易行为

## 交易机制说明

### 交易流程

#### 出口流程
1. **评估阶段**: 检查是否满足交易条件（价格差异、利润率、库存等）
2. **购买阶段**: 
   - 立即支付成本（本地价格 × 1.2）和税费
   - 从本地库存中扣除商品
   - 记录到待完成交易列表
3. **等待期**: 等待 `tradeDuration` 天（模拟运输）
4. **出售阶段**: 
   - 在外国市场卖出
   - 获得收入（外国价格 × 数量）
   - 完成交易

#### 进口流程
1. **评估阶段**: 检查是否满足交易条件（价格差异、利润率、资金等）
2. **购买阶段**: 
   - 立即支付成本（外国价格）和税费
   - 记录到待完成交易列表
3. **等待期**: 等待 `tradeDuration` 天（模拟运输）
4. **到货阶段**: 
   - 商品到达本地，加入库存
   - 在本地市场卖出
   - 获得收入（本地价格 × 数量 × 0.8）
   - 完成交易

### 出口逻辑
商人会出口满足以下条件的商品：
1. **外部价格 > 内部价格**（价格差异驱动）
2. **利润率 ≥ minProfitMargin**
3. **本地有库存**
4. **库存使用量 ≤ maxInventoryRatio**
5. **距离上次交易 ≥ tradeCooldown**

### 进口逻辑
商人会进口满足以下条件的商品：
1. **外部价格 < 内部价格**（价格差异驱动）
2. **利润率 ≥ minProfitMargin**
3. **商人有足够资金**
4. **距离上次交易 ≥ tradeCooldown**

### 利润计算
- **出口利润** = 外国售价 - (本地购买价 × 1.2) - 税费
- **进口利润** = 本地售价 - 外国购买价 - 税费
- **利润率** = 利润 / 总成本

## 配置示例

### 保守型商人（高利润、小规模、慢节奏）
```javascript
tradeConfig: {
  minProfitMargin: 0.20,        // 要求20%利润率
  maxPurchaseAmount: 10,         // 单次最多买10个
  exportProbability: 0.5,
  maxInventoryRatio: 0.2,        // 只用20%库存
  minWealthForTrade: 20,
  tradeDuration: 5,              // 5天贸易周期
  tradeCooldown: 3,              // 3天冷却时间
  enableDebugLog: false
}
```

### 激进型商人（低利润、大规模、快节奏）
```javascript
tradeConfig: {
  minProfitMargin: 0.05,        // 只要5%利润就做
  maxPurchaseAmount: 50,         // 单次最多买50个
  exportProbability: 0.5,
  maxInventoryRatio: 0.5,        // 可用50%库存
  minWealthForTrade: 5,
  tradeDuration: 1,              // 1天贸易周期（快速交易）
  tradeCooldown: 0,              // 无冷却（每天都能交易）
  enableDebugLog: false
}
```

### 出口导向型商人
```javascript
tradeConfig: {
  minProfitMargin: 0.10,
  maxPurchaseAmount: 20,
  exportProbability: 0.8,        // 80%概率选择出口
  maxInventoryRatio: 0.3,
  minWealthForTrade: 10,
  tradeDuration: 3,              // 3天贸易周期
  tradeCooldown: 0,
  enableDebugLog: false
}
```

### 调试模式
```javascript
tradeConfig: {
  minProfitMargin: 0.10,
  maxPurchaseAmount: 20,
  exportProbability: 0.5,
  maxInventoryRatio: 0.3,
  minWealthForTrade: 10,
  tradeDuration: 3,
  tradeCooldown: 0,
  enableDebugLog: true          // 启用调试日志
}
```

## 调试方法

1. 在 `strata.js` 中设置 `enableDebugLog: true`
2. 运行游戏并打开浏览器控制台（F12）
3. 查看类似以下的日志：

```
[商人调试] 布料信息: {
  supply: 6,
  demand: 6.6,
  availableStock: 6,
  localPrice: 2.04,
  foreignPrice: 40,
  priceDiff: 37.96,
  profitMargin: "1860.78%",
  isExportable: true,
  isImportable: false
}

[商人调试] 📦 购买布料准备出口: {
  amount: 2,
  cost: 4.08,
  tax: 0.816,
  expectedRevenue: 80,
  expectedProfit: 75.104,
  profitMargin: "1536.00%",
  daysUntilSale: 3
}

// 3天后...
[商人调试] ✅ 交易完成: {
  type: "出口",
  resource: "cloth",
  amount: 2,
  revenue: 80,
  profit: 75.104
}
```

## 修改历史

### 2025-11-24 (下午)
- ✅ 实现 tradeDuration（贸易周期）参数
- ✅ 实现 tradeCooldown（交易冷却）参数
- ✅ 添加待完成交易（pendingTrades）机制
- ✅ 修改交易流程：购买和出售分离，中间有等待期
- ✅ 更新调试日志，显示交易状态变化

### 2025-11-24 (上午)
- ✅ 添加配置参数系统
- ✅ 修复交易逻辑：从基于供需改为基于价格差异
- ✅ 添加库存保护机制（maxInventoryRatio）
- ✅ 添加调试日志功能
- ✅ 修复布料等高利润商品不交易的问题

## 游戏状态持久化

为了让贸易延迟和冷却机制正常工作，游戏需要在状态中保存以下信息：

1. **pendingTrades**: 待完成的交易列表
   - 每个交易包含：类型、资源、数量、收入、利润、剩余天数
   - 每个tick减少1天，到期时完成交易

2. **lastTradeTime**: 上次交易的tick时间
   - 用于计算冷却时间
   - 当 `tick - lastTradeTime >= tradeCooldown` 时才能交易

这些状态会在 `simulateTick` 的返回值中提供，需要在游戏主循环中保存并传递。

## 已知问题

- [x] tradeCooldown 参数已实现 ✅
- [x] tradeDuration 参数已实现 ✅
- [ ] 需要添加交易历史记录功能
- [ ] 可以考虑添加商人偏好某些商品的配置
- [ ] 需要在UI中显示待完成的交易

## 相关文件

- 配置文件: `src/config/strata.js`
- 交易逻辑: `src/logic/simulation.js` (商人交易部分)
- 外贸价格: `src/utils/foreignTrade.js`
