# 贸易路线与商人岗位关联规则

## 修改日期
2025-12-03

## 修改概述
修改了贸易路线系统，使其与商人岗位数量关联：
1. **贸易路线数量上限**：与商人岗位上限相关
2. **有效贸易路线数量**：与在岗商人数量相关
3. **贸易状态计算修复**：修改了缺口/盈余的判断逻辑，确保总有贸易机会

## 核心规则

### 1. 贸易路线数量上限
- **规则**：贸易路线的最大数量 = 商人岗位上限（`jobsAvailable.merchant`）
- **特殊情况**：如果没有建造任何提供商人岗位的建筑（`merchantJobLimit = 0`），则不限制贸易路线数量（保持原有行为）
- **限制位置**：创建贸易路线时检查
- **提示信息**：当达到上限时，提示"贸易路线数量已达上限（X），需要更多商人岗位。请建造更多贸易站。"

### 2. 有效贸易路线数量
- **规则**：有效的贸易路线数量 = 在岗商人数量（`popStructure.merchant`）
- **执行逻辑**：每个tick只处理前N条贸易路线，N = 在岗商人数量
- **效果**：有多少个商人在岗，就让多少条贸易路线有用

## 实现细节

### 1. 创建贸易路线限制（useGameActions.js）

```javascript
// 在 handleTradeRouteAction 函数中添加检查
if (action === 'create') {
  // 检查贸易路线数量是否超过商人岗位上限（只有当有商人岗位时才检查）
  const merchantJobLimit = jobsAvailable?.merchant || 0;
  const currentRouteCount = tradeRoutes.routes.length;
  if (merchantJobLimit > 0 && currentRouteCount >= merchantJobLimit) {
    addLog(`贸易路线数量已达上限（${merchantJobLimit}），需要更多商人岗位。请建造更多贸易站。`);
    return;
  }
  // ... 其他检查
}
```

### 2. 有效贸易路线限制（useGameLoop.js）

```javascript
const processTradeRoutes = (current, result, addLog, setResources, setNations, setTradeRoutes) => {
  const { tradeRoutes, nations, resources, daysElapsed, market, popStructure } = current;
  const routes = tradeRoutes.routes || [];

  // 获取在岗商人数量，决定有多少条贸易路线有效
  const merchantCount = popStructure?.merchant || 0;
  
  // 只处理前 merchantCount 条贸易路线
  routes.forEach((route, index) => {
    // 如果超过商人数量，则跳过该贸易路线
    if (index >= merchantCount) {
      return;
    }
    // ... 处理贸易路线
  });
}
```

### 3. UI显示（DiplomacyTab.jsx）

在外交标签页中添加了以下信息显示：

#### 顶部统计栏
```javascript
// 显示贸易路线和商人信息
<div className="bg-blue-900/20 px-2 py-1 rounded border border-blue-600/20">
  <span className="text-gray-400">贸易路线:</span>
  <span className={`font-bold ml-1 ${
    activeRouteCount < currentRouteCount ? 'text-yellow-300' : 'text-blue-300'
  }`}>{activeRouteCount}/{currentRouteCount}</span>
  <span className="text-gray-500 text-[10px] ml-1">(上限:{merchantJobLimit})</span>
</div>
<div className="bg-amber-900/20 px-2 py-1 rounded border border-amber-600/20">
  <span className="text-gray-400">商人在岗:</span>
  <span className="text-amber-300 font-bold ml-1">{merchantCount}/{merchantJobLimit}</span>
</div>
```

#### 贸易路线管理区域
```javascript
// 显示详细信息
<div className="text-[10px] text-gray-400">
  <div>创建贸易路线以自动进出口资源</div>
  <div className="mt-0.5">
    <span className={activeRouteCount < currentRouteCount ? 'text-yellow-400' : 'text-blue-400'}>
      有效路线: {activeRouteCount}/{currentRouteCount}
    </span>
    <span className="text-gray-500 mx-1">|</span>
    <span className={currentRouteCount >= merchantJobLimit ? 'text-red-400' : 'text-green-400'}>
      上限: {merchantJobLimit}
    </span>
    <span className="text-gray-500 mx-1">|</span>
    <span className="text-amber-400">
      商人: {merchantCount}/{merchantJobLimit}
    </span>
  </div>
</div>
```

#### 警告提示
```javascript
// 当有未激活的贸易路线时
{activeRouteCount < currentRouteCount && (
  <div className="mb-2 p-2 bg-yellow-900/30 border border-yellow-600/30 rounded text-[10px] text-yellow-300">
    <Icon name="AlertTriangle" size={12} className="inline mr-1" />
    当前有 {currentRouteCount - activeRouteCount} 条贸易路线未激活。需要更多商人在岗才能激活所有路线。
  </div>
)}

// 当达到贸易路线上限时
{currentRouteCount >= merchantJobLimit && (
  <div className="mb-2 p-2 bg-red-900/30 border border-red-600/30 rounded text-[10px] text-red-300">
    <Icon name="AlertCircle" size={12} className="inline mr-1" />
    贸易路线数量已达上限。建造更多贸易站以增加商人岗位上限。
  </div>
)}
```

## 游戏机制说明

### 如何增加贸易路线上限
1. 建造更多**贸易站**（Trading Post）
2. 每个贸易站提供1个商人岗位
3. 商人岗位上限 = 贸易路线数量上限

### 如何激活更多贸易路线
1. 确保有足够的商人在岗
2. 在人口分配界面，将人口分配到商人岗位
3. 在岗商人数量 = 有效贸易路线数量

### 示例场景

#### 场景1：正常运作
- 商人岗位上限：5
- 在岗商人：5
- 创建的贸易路线：5
- 有效贸易路线：5
- **结果**：所有贸易路线正常运作 ✅

#### 场景2：商人不足
- 商人岗位上限：5
- 在岗商人：3
- 创建的贸易路线：5
- 有效贸易路线：3
- **结果**：只有前3条贸易路线有效，后2条暂停 ⚠️

#### 场景3：达到上限
- 商人岗位上限：5
- 在岗商人：5
- 创建的贸易路线：5
- **结果**：无法创建新的贸易路线，需要建造更多贸易站 🚫

## 相关建筑

### 贸易站（Trading Post）
- **解锁时代**：石器时代（Epoch 0）
- **需要科技**：以物易物（barter）
- **建造成本**：木材 50，石料 10
- **提供岗位**：商人 × 1
- **产出**：食物 2

### 其他提供商人岗位的建筑
- **市场**（Market）：商人 × 2
- **港口**（Harbor）：商人 × 1
- **交易所**（Exchange）：商人 × 3
- 等等...

## 注意事项

1. **贸易路线不会自动删除**：即使商人数量不足，已创建的贸易路线仍然保留，只是暂停执行
2. **优先级**：贸易路线按创建顺序执行，先创建的先执行
3. **动态调整**：商人数量变化时，有效贸易路线数量会实时调整
4. **战争影响**：战争期间贸易路线会暂停，但不会删除

## 测试建议

### 测试1：创建贸易路线上限
1. 建造1个贸易站（商人岗位上限 = 1）
2. 尝试创建2条贸易路线
3. **预期**：第2条创建失败，提示达到上限

### 测试2：有效贸易路线数量
1. 建造3个贸易站（商人岗位上限 = 3）
2. 创建3条贸易路线
3. 只分配2个商人到商人岗位
4. **预期**：只有前2条贸易路线有效，第3条暂停

### 测试3：动态调整
1. 建造3个贸易站，创建3条贸易路线
2. 分配3个商人（所有路线有效）
3. 将1个商人调离岗位
4. **预期**：第3条贸易路线暂停

## 贸易状态计算修复

### 问题描述
原有的 `calculateTradeStatus` 函数使用了过于严格的阈值：
- **缺口阈值**：库存 < 目标的50%
- **盈余阈值**：库存 > 目标的150%

这导致当AI国家的库存在50%-150%之间时，既没有缺口也没有盈余，**无法创建任何贸易路线**。

### 修复方案
修改阈值逻辑，使其更合理：
- **缺口阈值**：库存 < 目标的90%（低于目标视为缺口）
- **盈余阈值**：库存 > 目标的110%（高于目标视为盈余）

这样可以确保大部分情况下都有贸易机会，使贸易系统更加活跃。

### 修改位置
文件：`src/utils/foreignTrade.js`
函数：`calculateTradeStatus`

```javascript
// 修改前
const shortageThreshold = dynamicTarget * 0.5;  // 50%
const surplusThreshold = dynamicTarget * 1.5;   // 150%

// 修改后
const shortageThreshold = dynamicTarget * 0.9;  // 90%
const surplusThreshold = dynamicTarget * 1.1;   // 110%
```

## 贸易盈亏逻辑修复

### 问题描述
原有的贸易逻辑存在严重错误：
- **出口**：只用外国价格计算收入，没有考虑国内购买成本
- **进口**：只用外国价格计算支出，没有考虑国内销售收入

这导致即使外国商品价格更低，进口仍然亏损的不合理现象。

### 正确的贸易逻辑

#### 出口流程
1. **从国内购买**：以国内价格（`localPrice`）购买商品
2. **到国外销售**：以国外价格（`foreignPrice`）销售商品
3. **计算利润**：`profit = foreignPrice - localPrice`
4. **盈利条件**：`foreignPrice > localPrice`（外国价格高于国内）

#### 进口流程
1. **从国外购买**：以国外价格（`foreignPrice`）购买商品
2. **到国内销售**：以国内价格（`localPrice`）销售商品
3. **计算利润**：`profit = localPrice - foreignPrice`
4. **盈利条件**：`localPrice > foreignPrice`（国内价格高于外国）

### 修复实现

文件：`src/hooks/useGameLoop.js`
函数：`processTradeRoutes`

#### 出口修复
```javascript
// 修复前
const revenue = foreignPrice * exportAmount;
setResources(prev => ({
  ...prev,
  silver: (prev.silver || 0) + revenue,  // ❌ 只计算收入
  [resource]: Math.max(0, (prev[resource] || 0) - exportAmount),
}));

// 修复后
const purchaseCost = localPrice * exportAmount;  // 国内购买成本
const saleRevenue = foreignPrice * exportAmount;  // 国外销售收入
const profit = saleRevenue - purchaseCost;  // 净利润

setResources(prev => ({
  ...prev,
  silver: (prev.silver || 0) + profit,  // ✅ 计算净利润
  [resource]: Math.max(0, (prev[resource] || 0) - exportAmount),
}));
```

#### 进口修复
```javascript
// 修复前
const cost = foreignPrice * importAmount;
setResources(prev => ({
  ...prev,
  silver: Math.max(0, (prev.silver || 0) - cost),  // ❌ 只计算支出
  [resource]: (prev[resource] || 0) + importAmount,
}));

// 修复后
const purchaseCost = foreignPrice * importAmount;  // 国外购买成本
const saleRevenue = localPrice * importAmount;  // 国内销售收入
const profit = saleRevenue - purchaseCost;  // 净利润

setResources(prev => ({
  ...prev,
  silver: (prev.silver || 0) + profit,  // ✅ 计算净利润
  [resource]: (prev[resource] || 0) + importAmount,
}));
```

### 日志改进

修复后的日志会显示详细的价格和盈亏信息：

```javascript
// 出口日志
🚢 出口 10.0 食物 至 丛林帝国（国内价 5.0 → 国外价 8.0），盈利 30.0 银币。

// 进口日志
🚢 进口 10.0 木材 从 丛林帝国（国外价 3.0 → 国内价 6.0），盈利 30.0 银币。

// 亏损情况
🚢 出口 10.0 食物 至 丛林帝国（国内价 8.0 → 国外价 5.0），亏损 30.0 银币。
```

### 经济意义

修复后的贸易系统符合真实的经济逻辑：

1. **套利机会**：商人通过价格差异获利
   - 出口：国内便宜 → 国外贵 → 赚取差价
   - 进口：国外便宜 → 国内贵 → 赚取差价

2. **市场平衡**：贸易会逐渐平衡价格
   - 出口增加 → 国内供应减少 → 国内价格上涨
   - 进口增加 → 国内供应增加 → 国内价格下降

3. **风险管理**：价格波动可能导致亏损
   - 如果价格逆转，贸易可能变成亏损
   - 需要及时调整贸易策略

## 版本历史

### v1.2 (2025-12-03)
- **重要修复**：修复贸易盈亏计算逻辑
- 出口：正确计算国内购买成本和国外销售收入
- 进口：正确计算国外购买成本和国内销售收入
- 改进日志显示，显示详细的价格和盈亏信息

### v1.1 (2025-12-03)
- 修复贸易状态计算逻辑，调整缺口/盈余阈值
- 确保总有贸易机会，避免无法创建贸易路线的情况

### v1.0 (2025-12-03)
- 初始实现
- 贸易路线数量上限与商人岗位上限关联
- 有效贸易路线数量与在岗商人数量关联
- UI显示优化，添加警告提示
