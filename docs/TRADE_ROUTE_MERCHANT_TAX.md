# 贸易路线商人税收机制

## 修改日期
2025-12-04

## 概述
本次修改将贸易路线的逻辑从"玩家直接获得贸易利润"改为"商人群体进行交易，玩家只赚取交易税"，使游戏机制更加真实和合理。

## 修改内容

### 1. 出口机制

#### 修改前
- 玩家直接以国内价格购买资源
- 玩家直接以国外价格出售资源
- 玩家获得全部利润：`利润 = (国外价 - 国内价) × 数量`

#### 修改后
- **商人群体**在国内以国内市场价购买资源
- **商人群体**在国外以国外市场价出售资源
- **商人群体**获得贸易利润：`商人利润 = (国外价 - 国内价) × 数量`
- **玩家**只获得商人在国内购买时的交易税：`玩家税收 = 国内价 × 数量 × 交易税率`

#### 示例
假设：
- 资源：食物
- 国内价格：5 银币/单位
- 国外价格：8 银币/单位
- 出口数量：10 单位
- 交易税率：5%

**商人的交易：**
- 国内购买成本：5 × 10 = 50 银币
- 国外销售收入：8 × 10 = 80 银币
- 商人利润：80 - 50 = 30 银币

**玩家的收益：**
- 交易税：50 × 0.05 = 2.5 银币

### 2. 进口机制

#### 修改前
- 玩家直接以国外价格购买资源
- 玩家直接以国内价格出售资源
- 玩家获得全部利润：`利润 = (国内价 - 国外价) × 数量`

#### 修改后
- **商人群体**在国外以国外市场价购买资源
- **商人群体**在国内以国内市场价出售资源
- **商人群体**获得贸易利润：`商人利润 = (国内价 - 国外价) × 数量`
- **玩家**只获得商人在国内销售时的交易税：`玩家税收 = 国内价 × 数量 × 交易税率`

#### 示例
假设：
- 资源：木材
- 国外价格：3 银币/单位
- 国内价格：6 银币/单位
- 进口数量：10 单位
- 交易税率：5%

**商人的交易：**
- 国外购买成本：3 × 10 = 30 银币
- 国内销售收入：6 × 10 = 60 银币
- 商人利润：60 - 30 = 30 银币

**玩家的收益：**
- 交易税：60 × 0.05 = 3 银币

## 代码修改

### 1. useGameLoop.js - processTradeRoutes 函数

#### 出口逻辑修改
```javascript
// 修改前
const purchaseCost = localPrice * exportAmount;
const saleRevenue = foreignPrice * exportAmount;
const profit = saleRevenue - purchaseCost;
setResources(prev => ({
  ...prev,
  silver: (prev.silver || 0) + profit,
  [resource]: Math.max(0, (prev[resource] || 0) - exportAmount),
}));

// 修改后
const domesticPurchaseCost = localPrice * exportAmount;
const taxRate = taxPolicies?.resourceTaxRates?.[resource] || 0;
const tradeTax = domesticPurchaseCost * taxRate;
const foreignSaleRevenue = foreignPrice * exportAmount;
const merchantProfit = foreignSaleRevenue - domesticPurchaseCost;

setResources(prev => ({
  ...prev,
  silver: (prev.silver || 0) + tradeTax,  // 玩家只获得交易税
  [resource]: Math.max(0, (prev[resource] || 0) - exportAmount),
}));
```

#### 进口逻辑修改
```javascript
// 修改前
const purchaseCost = foreignPrice * importAmount;
const saleRevenue = localPrice * importAmount;
const profit = saleRevenue - purchaseCost;
setResources(prev => ({
  ...prev,
  silver: (prev.silver || 0) + profit,
  [resource]: (prev[resource] || 0) + importAmount,
}));

// 修改后
const foreignPurchaseCost = foreignPrice * importAmount;
const domesticSaleRevenue = localPrice * importAmount;
const taxRate = taxPolicies?.resourceTaxRates?.[resource] || 0;
const tradeTax = domesticSaleRevenue * taxRate;
const merchantProfit = domesticSaleRevenue - foreignPurchaseCost;

setResources(prev => ({
  ...prev,
  silver: (prev.silver || 0) + tradeTax,  // 玩家只获得交易税
  [resource]: (prev[resource] || 0) + importAmount,
}));
```

#### 返回值修改
```javascript
// 修改前
return { income: totalIncome, expense: totalExpense };

// 修改后
return { tradeTax: totalTradeTax };
```

### 2. 日志显示修改

#### 出口日志
```javascript
// 修改前
tradeLog.push(`🚢 出口 ${exportAmount.toFixed(1)} ${RESOURCES[resource]?.name || resource} 至 ${nation.name}（国内价 ${localPrice.toFixed(1)} → 国外价 ${foreignPrice.toFixed(1)}），${profitText} 银币。`);

// 修改后
tradeLog.push(`🚢 出口 ${exportAmount.toFixed(1)} ${RESOURCES[resource]?.name || resource} 至 ${nation.name}：商人国内购 ${domesticPurchaseCost.toFixed(1)} 银币（税 ${tradeTax.toFixed(1)}），国外售 ${foreignSaleRevenue.toFixed(1)} 银币，商人赚 ${merchantProfit.toFixed(1)} 银币。`);
```

#### 进口日志
```javascript
// 修改前
tradeLog.push(`🚢 进口 ${importAmount.toFixed(1)} ${RESOURCES[resource]?.name || resource} 从 ${nation.name}（国外价 ${foreignPrice.toFixed(1)} → 国内价 ${localPrice.toFixed(1)}），${profitText} 银币。`);

// 修改后
tradeLog.push(`🚢 进口 ${importAmount.toFixed(1)} ${RESOURCES[resource]?.name || resource} 从 ${nation.name}：商人国外购 ${foreignPurchaseCost.toFixed(1)} 银币，国内售 ${domesticSaleRevenue.toFixed(1)} 银币（税 ${tradeTax.toFixed(1)}），商人赚 ${merchantProfit.toFixed(1)} 银币。`);
```

### 3. 税收面板显示修改

#### StatusBar.jsx
```javascript
// 修改前
const tradeIncome = tradeStats?.income || 0;
const tradeExpense = tradeStats?.expense || 0;
const tradeNet = tradeIncome - tradeExpense;

// 税收详情显示
<div className="flex justify-between py-1 border-b border-gray-800">
  <span>贸易路线</span>
  <div className="text-right">
    <span className={`${tradeNetClass} font-mono block`}>
      {tradeNet >= 0 ? '+' : ''}{tradeNet.toFixed(2)}
    </span>
    <span className="text-[10px] text-gray-500">
      收 {tradeIncome.toFixed(1)} / 支 {tradeExpense.toFixed(1)}
    </span>
  </div>
</div>

// 修改后
const tradeTax = tradeStats?.tradeTax || 0;

// 税收详情显示
<div className="flex justify-between py-1 border-b border-gray-800">
  <span>贸易路线税</span>
  <span className={`${tradeTaxClass} font-mono`}>
    {tradeTax >= 0 ? '+' : ''}{tradeTax.toFixed(2)}
  </span>
</div>
```

#### App.jsx
```javascript
// 修改前
const tradeStats = gameState.tradeStats || { income: 0, expense: 0 };
const tradeNet = (tradeStats.income || 0) - (tradeStats.expense || 0);
const netSilverPerDay = taxes.total + tradeNet - silverUpkeepPerDay;

// 修改后
const tradeStats = gameState.tradeStats || { tradeTax: 0 };
const tradeTax = tradeStats.tradeTax || 0;
const netSilverPerDay = taxes.total + tradeTax - silverUpkeepPerDay;
```

### 4. 状态管理修改

#### useGameState.js
```javascript
// 修改前
const [tradeStats, setTradeStats] = useState({ income: 0, expense: 0 });

// 存档加载
setTradeStats(data.tradeStats || { income: 0, expense: 0 });

// 修改后
const [tradeStats, setTradeStats] = useState({ tradeTax: 0 });

// 存档加载
setTradeStats(data.tradeStats || { tradeTax: 0 });
```

#### useGameLoop.js
```javascript
// 修改前
let tradeSummary = { income: 0, expense: 0 };
if (current.tradeRoutes && current.tradeRoutes.routes && current.tradeRoutes.routes.length > 0) {
  const summary = processTradeRoutes(current, result, addLog, setResources, setNations, setTradeRoutes);
  if (summary) {
    tradeSummary = summary;
  }
}
setTradeStats(tradeSummary);

// 修改后
let tradeTax = 0;
if (current.tradeRoutes && current.tradeRoutes.routes && current.tradeRoutes.routes.length > 0) {
  const summary = processTradeRoutes(current, result, addLog, setResources, setNations, setTradeRoutes);
  if (summary) {
    tradeTax = summary.tradeTax || 0;
  }
}
setTradeStats({ tradeTax });
```

## 游戏平衡影响

### 1. 玩家收益降低
- 修改前：玩家获得全部贸易利润
- 修改后：玩家只获得交易税（通常为交易额的5%）
- **影响**：贸易路线的收益大幅降低，玩家需要更多依赖其他收入来源

### 2. 税率的重要性提升
- 交易税率直接影响贸易路线的收益
- 玩家可以通过调整交易税率来平衡财政收入和市场活力
- 高税率增加收入但可能抑制贸易

### 3. 更真实的经济模拟
- 商人阶级成为真正的贸易主体
- 玩家作为统治者，通过税收而非直接贸易获利
- 符合历史上的贸易和税收模式

## 测试建议

### 1. 基础功能测试
- 创建出口路线，验证玩家只获得交易税
- 创建进口路线，验证玩家只获得交易税
- 检查日志显示是否正确显示商人利润和玩家税收

### 2. 税率测试
- 调整交易税率，验证税收计算是否正确
- 测试负税率（补贴）的情况
- 验证不同资源的税率设置

### 3. 财政平衡测试
- 对比修改前后的财政收入
- 验证游戏是否仍然可玩
- 检查是否需要调整其他收入来源

### 4. UI显示测试
- 验证税收面板显示正确
- 检查状态栏的贸易税显示
- 确认日志信息清晰易懂

## 相关文件

- `src/hooks/useGameLoop.js` - 贸易路线处理逻辑
- `src/components/layout/StatusBar.jsx` - 税收面板显示
- `src/App.jsx` - 主应用逻辑
- `src/hooks/useGameState.js` - 状态管理

## 版本历史

### v2.0 (2025-12-04)
- ✅ 修改贸易路线为商人群体交易模式
- ✅ 玩家只获得交易税而非全部利润
- ✅ 更新日志显示，显示商人利润和玩家税收
- ✅ 更新税收面板，显示贸易路线税
- ✅ 更新状态管理，使用tradeTax替代income/expense

### v1.2 (2025-12-03)
- 修复贸易盈亏计算逻辑
- 改进日志显示

### v1.1 (2025-12-03)
- 修复贸易状态计算逻辑
- 调整缺口/盈余阈值

### v1.0 (2025-12-03)
- 初始实现贸易路线系统
