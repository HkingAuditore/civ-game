# 「货币量」机制——完整设计策划案

---

## 一、现状诊断

### 1.1 当前货币流转的真实结构

经过逐行代码审计，当前经济系统中的货币流转如下：

| 环节 | ledger 调用 | 实质 |
|------|------------|------|
| 建筑产出售出 | `void → ownerKey` | **凭空创造货币**给业主 |
| 建筑购买原料 | `ownerKey → void` (生产成本) | **货币被销毁** |
| 建筑购买原料的税 | `ownerKey → state` | 守恒转移 |
| 工资——扣款 | `ownerKey → void` | owner 的钱**被销毁** |
| 工资——发放 | `void → workerRole` | worker 的钱**被创造** |
| 阶层消费 | `stratumKey → void` | **货币被销毁** |
| 阶层消费的税 | `stratumKey → state` | 守恒转移 |
| 营业税 | `ownerKey → state` | 守恒转移 |
| 补贴 | `state → entityKey` | 守恒转移 |
| 建筑升级 | `ownerKey → void` | **货币被销毁** |

**关键事实**：
1. **工资支付中 owner 确实在付钱**（从 `wealth[oKey]` 扣除真金白银），只是通过 void 中转后工人从 void 重新收到等额的钱。金额守恒（`payout = expectedSlotWage × ratio × filled`，ratio 基于 owner 实际支付的比例），但在 ledger 层面是两步独立操作。
2. **产出收入**是纯粹的货币创造——产品进入 `res[]` 无主公共池，owner 从 void 获得收入，没有任何实体在付钱。
3. **消费支出**是纯粹的货币销毁——资源从 `res[]` 取出，消费者的钱消失到 void，没有任何生产者收到钱。
4. `res[]` 是完全无主的公共池，物资没有归属。

**系统中不存在"货币量"概念**——货币在产出时被创造、在消费时被销毁，每个 tick 的总量都在波动。

### 1.2 改革目标

将系统从"**信用货币 + 无主公共池**"转变为"**商品货币 + 建筑持有库存**"：

1. **消灭产出/消费环节的 void**——买方的支出必须成为卖方的收入
2. **给资源标记归属**——产出进入建筑的库存，而非无主公共池
3. **引入铸币所**——作为系统中唯一的货币创造源
4. **工资支付直连**——从 `owner→void→worker` 改为 `owner→worker`

---

## 二、铸币所——系统唯一的货币之源

### 2.1 设计理念

在新体系中，**银币不再从 void 凭空创造**。系统中所有银币的来源只有一个：**铸币所**（Mint）。这从根本上建立了"货币量"的概念——系统中的银币总量 = 铸币所历史总产出 - 建筑升级/损耗等永久消耗。

### 2.2 建筑配置

```javascript
{
    id: 'mint',
    name: "铸币所",
    desc: "将铜锭熔铸为标准化银币，是国家法定货币的唯一来源。铸币所归国家所有，产出的银币直接进入国库。",
    baseCost: { stone: 80, wood: 60, copper: 20 },
    input: { copper: 0.5, wood: 0.2 },   // 需要铜和燃料（木炭）
    output: { silver: 3.0 },              // 产出银币
    jobs: { official: 2, worker: 4 },     // 需要官员监督 + 工人操作
    // 无 owner 字段 → 产出归 state（国库）
    epoch: 1,                             // 青铜时代解锁（需要铜）
    cat: 'civic',
    requiresTech: 'minting',              // 需要新科技"铸币术"
    visual: { icon: 'Coins', color: 'bg-yellow-700', text: 'text-yellow-200' },
    marketConfig: {
        price: { livingCostWeight: 0.05, taxCostWeight: 0.05 },
        wage: { livingCostWeight: 0.05, taxCostWeight: 0.05 },
    }
}
```

### 2.3 时代演进

| 时代 | 建筑 | 输入 | 产出 | 解锁科技 |
|------|------|------|------|---------|
| Epoch 0 (石器) | 无（以物易物） | — | — | — |
| Epoch 1 (青铜) | 铸币所 (mint) | copper: 0.5, wood: 0.2 | silver: 3.0 | minting |
| Epoch 4 (探索) | 铸币厂 (royal_mint) | copper: 1.5, coal: 0.3 | silver: 12.0 | monetary_reform |
| Epoch 6 (工业) | 中央银行 (central_bank) | papyrus: 0.5, steel: 0.1 | silver: 40.0 | central_banking |
| Epoch 9 (信息) | 数字货币中心 (digital_mint) | electricity: 0.8, semiconductors: 0.05 | silver: 120.0 | digital_currency |

**设计原则**：
- 铸币所始终**归国家所有**（无 owner 字段），产出的 silver 进入 `res.silver`（国库）
- 早期铸币需要消耗铜（真正的"铜钱"），后期逐渐转向信用货币（纸币 → 电子货币）
- 铸币所的产出量应该与经济体量大致匹配——太少则通缩（买不起东西），太多则通胀

### 2.4 Epoch 0 的过渡方案——以物易物阶段

在铸币所解锁之前（石器时代），系统使用**以物易物**模式：

```
建筑产出 → 直接进入建筑库存
阶层消费 → 以物换物（用自己持有的资源直接交换）
工资 → 业主用实物（food/wood）支付
```

具体实现：石器时代每次"购买"资源时，不扣银币，而是从买方库存中扣除等价的基础资源（food/wood/stone），按 basePrice 比率折算。这既符合历史真实，也让铸币所的解锁成为一个有意义的里程碑。

**或者更简单的做法**：给玩家初始国库配置一定量银币（代表部落积累的贵金属/贝壳货币），让石器时代短暂使用这些原始货币，直到铸币所建成后进入正规货币体系。

---

## 三、建筑库存系统

### 3.1 数据结构

```javascript
/**
 * 建筑类型级库存（非单个建筑实例，节省内存）
 * 同一类型的所有建筑共享一个聚合库存池
 * 
 * 键：buildingId（如 'farm', 'sawmill'）
 * 值：{ [resourceKey]: InventoryEntry }
 */
const buildingInventory = {
    farm: {
        food: {
            stock: 45.2,           // 当前库存量
            costPrice: 1.05,       // 加权平均成本价（原料+工资+税）
            lastTickOutput: 23.2,  // 上一tick产出量
            unsold: 12.1,          // 本tick未售出量（用于滞销判断）
        }
    },
    sawmill: {
        plank: {
            stock: 12.8,
            costPrice: 4.9,
            lastTickOutput: 17.4,
            unsold: 0,
        }
    },
    mint: {
        silver: {
            stock: 0,  // 铸币所产出直接进国库，不留库存
            costPrice: 0,
            lastTickOutput: 3.0,
            unsold: 0,
        }
    }
};
```

### 3.2 `res[]` 公共池的转变

`res[]` 不再是"无主公共池"，而是变为**从所有建筑库存聚合的只读视图**：

```javascript
// 替代直接访问 res[resource]
function getTotalMarketStock(resourceKey) {
    let total = 0;
    for (const [buildingId, inventory] of Object.entries(buildingInventory)) {
        total += inventory[resourceKey]?.stock || 0;
    }
    // 加上国库持有的银币
    if (resourceKey === 'silver') {
        total += state.treasury;
    }
    return total;
}
```

UI 和价格计算仍使用全局聚合数据，但物资的实际归属在建筑类型级别。

### 3.3 产出流程变化

**现有**：
```javascript
// sellProduction(): 产品进入无主池，owner 凭空获得收入
res[resource] += amount;
ledger.transfer('void', ownerKey, income, OWNER_REVENUE);
```

**新方案**：
```javascript
// produceToInventory(): 产品进入建筑库存，owner 暂不获得收入
function produceToInventory(buildingId, resourceKey, amount, costPerUnit) {
    if (!buildingInventory[buildingId]) {
        buildingInventory[buildingId] = {};
    }
    const entry = buildingInventory[buildingId][resourceKey] || 
                  { stock: 0, costPrice: 0, lastTickOutput: 0, unsold: 0 };
    
    // 加权平均成本价更新
    const totalValue = entry.stock * entry.costPrice + amount * costPerUnit;
    const totalStock = entry.stock + amount;
    entry.costPrice = totalStock > 0 ? totalValue / totalStock : costPerUnit;
    entry.stock = totalStock;
    entry.lastTickOutput += amount;
    
    buildingInventory[buildingId][resourceKey] = entry;
}

// 铸币所特殊处理：产出的 silver 直接进国库
if (buildingId === 'mint' && resourceKey === 'silver') {
    res.silver += amount;  // 直接进国库
    return;
}
```

**关键变化**：产出不再立即转化为收入。Owner 的收入要等到**消费者实际购买**时才实现。

---

## 四、购买机制——"潜在购买关系"的实现

### 4.1 核心函数：`purchaseFromMarket`

当任何实体（阶层/建筑）需要资源时，调用统一的购买函数：

```javascript
/**
 * 从市场购买资源
 * 建立"买方 → 建筑业主"的定向货币流转
 * 
 * @param {string} buyerKey - 购买者（阶层key 或 'state'）
 * @param {string} resourceKey - 资源类型
 * @param {number} desiredAmount - 期望购买量
 * @param {Object} marketState - 当前市场状态
 * @returns {{ bought: number, totalCost: number, sellers: Array }}
 */
function purchaseFromMarket(buyerKey, resourceKey, desiredAmount, marketState) {
    // 1. 查找所有持有该资源库存的建筑（使用已有的 resourceBuildingIndex）
    const sellers = [];
    for (const [buildingId, inventory] of Object.entries(buildingInventory)) {
        const entry = inventory[resourceKey];
        if (!entry || entry.stock <= 0) continue;
        
        const building = BUILDINGS_BY_ID.get(buildingId);
        const ownerKey = building?.owner || 'state';
        
        sellers.push({
            buildingId,
            ownerKey,
            stock: entry.stock,
            costPrice: entry.costPrice,
            askPrice: calculateAskPrice(resourceKey, entry, marketState),
        });
    }
    
    if (sellers.length === 0) {
        return { bought: 0, totalCost: 0, sellers: [] };
    }
    
    // 2. 按价格排序（买方总是选择最便宜的卖家）
    sellers.sort((a, b) => a.askPrice - b.askPrice);
    
    // 3. 逐个卖家购买
    let remaining = desiredAmount;
    let totalCost = 0;
    const transactions = [];
    
    for (const seller of sellers) {
        if (remaining <= 0) break;
        
        const bought = Math.min(remaining, seller.stock);
        const cost = bought * seller.askPrice;
        
        // 检查买方是否付得起
        const buyerWealth = getBuyerWealth(buyerKey);
        const affordable = seller.askPrice > 0 ? buyerWealth / seller.askPrice : Infinity;
        const actualBought = Math.min(bought, affordable);
        if (actualBought <= 0) continue;
        
        const actualCost = actualBought * seller.askPrice;
        
        // 4. 执行交易——货币从买方定向流向卖方业主
        //    这就是你说的"潜在购买关系"：阶层→建筑业主、建筑业主→建筑业主
        ledger.transfer(buyerKey, seller.ownerKey, actualCost, 'PURCHASE', 'SALE');
        
        // 5. 库存从卖方转移到买方
        seller.stock -= actualBought;
        buildingInventory[seller.buildingId][resourceKey].stock -= actualBought;
        
        remaining -= actualBought;
        totalCost += actualCost;
        transactions.push({
            sellerId: seller.buildingId,
            sellerOwner: seller.ownerKey,
            amount: actualBought,
            unitPrice: seller.askPrice,
            totalPrice: actualCost,
        });
    }
    
    return {
        bought: desiredAmount - remaining,
        totalCost,
        sellers: transactions,
    };
}
```

### 4.2 卖方要价函数

```javascript
/**
 * 计算建筑的要价（ask price）
 * 
 * 公式：P_ask = max(成本价 × 最低利润率, 基准价) × 稀缺因子
 * 
 * 稀缺因子由全局库存天数决定（复用现有的分段函数）
 * 当库存充裕时价格接近成本价，当库存紧张时溢价
 */
function calculateAskPrice(resourceKey, inventoryEntry, marketState) {
    const costPrice = inventoryEntry.costPrice || 0;
    const basePrice = RESOURCES[resourceKey]?.basePrice || 1;
    
    // 全局库存天数（复用现有逻辑）
    const totalStock = getTotalMarketStock(resourceKey);
    const dailyDemand = marketState.demand[resourceKey] || 1;
    const resourceConfig = RESOURCES[resourceKey]?.marketConfig || {};
    const targetDays = resourceConfig.inventoryTargetDays || 30;
    const inventoryRatio = (totalStock / dailyDemand) / targetDays;
    
    // 稀缺因子（复用现有的第7277-7297行分段函数）
    let scarcityMultiplier = 1.0;
    if (inventoryRatio < 0.1) {
        scarcityMultiplier = 3.0 + (0.1 - inventoryRatio) * 20.0;
        scarcityMultiplier = Math.min(5.0, scarcityMultiplier);
    } else if (inventoryRatio < 0.5) {
        scarcityMultiplier = 1.0 + (0.5 - inventoryRatio) * 5.0;
    } else if (inventoryRatio > 3.0) {
        scarcityMultiplier = 0.65 - (inventoryRatio - 3.0) * 0.1;
        scarcityMultiplier = Math.max(0.2, scarcityMultiplier);
    } else if (inventoryRatio > 2.0) {
        scarcityMultiplier = 0.85 - (inventoryRatio - 2.0) * 0.2;
    } else if (inventoryRatio > 1.0) {
        scarcityMultiplier = 1.0 - (inventoryRatio - 1.0) * 0.15;
    }
    
    // 最低利润率（复用 RESOURCES 中的 supplyDemandWeight 作为参考）
    const minMargin = 1.1; // 至少10%利润
    
    const floorPrice = Math.max(costPrice * minMargin, basePrice);
    return floorPrice * scarcityMultiplier;
}
```

### 4.3 三种购买关系的实现

你提到的三种"潜在购买关系"，在新架构中自然产生：

| 购买关系 | 触发场景 | 示例 |
|---------|---------|------|
| **阶层 → 建筑业主** | 阶层消费资源 | 农民买布料 → 钱付给织布坊的 peasant 业主 |
| **建筑业主 → 建筑业主** | 建筑购买原料 | 铁器铺的 artisan 买铁矿 → 钱付给铁矿井的 landowner 业主 |
| **玩家(国库) → 建筑业主** | 玩家建造建筑/军队维护 | 国库买钢材建工厂 → 钱付给炼钢厂的 capitalist 业主 |

---

## 五、各环节的货币流转改造

### 5.1 建筑原料消耗（建筑业主 → 建筑业主）

**现有**：
```javascript
// owner 付钱给 void（销毁），从 res[] 取出原料
ledger.transfer(ownerKey, 'void', baseCost, PRODUCTION_COST);
res[resKey] -= consumed;
```

**新方案**：
```javascript
// owner 通过 purchaseFromMarket 购买，钱付给原料生产者
const result = purchaseFromMarket(ownerKey, resKey, consumed, marketState);
// 交易税另行处理
if (taxRate > 0) {
    ledger.transfer(ownerKey, 'state', result.totalCost * taxRate, RESOURCE_TAX);
}
```

### 5.2 阶层消费（阶层 → 建筑业主）

**现有**：
```javascript
// 阶层付钱给 void（销毁），从 res[] 取出资源
ledger.transfer(key, 'void', totalCost, CONSUMPTION);
res[resKey] -= amount;
```

**新方案**：
```javascript
// 阶层通过 purchaseFromMarket 购买，钱付给资源生产者
const result = purchaseFromMarket(key, resKey, amount, marketState);
// 交易税
if (taxRate > 0) {
    ledger.transfer(key, 'state', result.totalCost * taxRate, RESOURCE_TAX);
}
```

### 5.3 工资支付（业主 → 工人，直连）

**现有**（两步经过 void）：
```javascript
ledger.transfer(oKey, 'void', paid, WAGES_PAID);    // owner 扣钱
ledger.transfer('void', role, payout, WAGE);          // worker 收钱
```

**新方案**（一步直连）：
```javascript
ledger.transfer(oKey, role, payout, WAGES_PAID);      // owner 直接付给 worker
```

**改动极小**，但让货币在工资环节完全守恒。

### 5.4 铸币所产出（唯一的货币创造源）

```javascript
// 铸币所是唯一允许 void → state 创造货币的建筑
if (buildingId === 'mint' || buildingId === 'royal_mint' || 
    buildingId === 'central_bank' || buildingId === 'digital_mint') {
    // 银币产出直接进国库（这是系统中唯一的货币创造）
    ledger.transfer('void', 'state', silverAmount, 'MINT_OUTPUT');
    return;
}
```

### 5.5 国库的货币分配

国库通过以下渠道将铸币所创造的货币注入经济循环：

| 渠道 | 流向 | 说明 |
|------|------|------|
| 官员薪水 | state → official | 国库直接支付 |
| 军饷 | state → soldier | 国库直接支付 |
| 补贴 | state → 各阶层 | 负税率时触发 |
| 建筑建造 | state → 建筑业主 | 通过 purchaseFromMarket 购买建材 |
| 人头税退税 | state → 各阶层 | 负税率时触发 |

---

## 六、货币量的数学模型

### 6.1 货币总量公式

```
M(t) = M(t-1) + ΔMint - ΔDestroy

ΔMint = 铸币所本tick产出的银币量
ΔDestroy = 建筑升级/建造消耗的银币（silver 作为 baseCost 的一部分被永久消耗）
         + 财富自然衰减（WEALTH_DECAY_RATE = 0.5%/day）

M(t) = Σ(各阶层 wealth) + state.treasury（国库银币）
```

### 6.2 货币流通速度

```
V = GDP / M

GDP ≈ Σ(所有交易的成交额) / tick
M = 当前货币总量

V 高 → 钱流转快，经济活跃
V 低 → 钱囤积多，经济停滞
```

### 6.3 物价水平

```
P = M × V / Y

Y = 实际产出总量（所有建筑的实际产出）
M↑ 且 Y 不变 → P↑（通胀）
M 不变且 Y↑ → P↓（通缩，或者说产品变便宜了）
```

### 6.4 铸币所产出量的平衡设计

铸币所的产出量需要与经济体量匹配。设计原则：

```
理想的 M/GDP 比率 ≈ 2-5（类似现实中的 M2/GDP）

如果 M/GDP < 2 → 通缩信号，需要更多铸币所 或 提升铸币效率
如果 M/GDP > 5 → 通胀信号，需要减少铸币 或 提升生产力
```

具体的数值平衡需要在实际测试中调整铸币所的 output 量。

---

## 七、滞销与利润率机制

### 7.1 建筑滞销判定

```javascript
/**
 * 计算建筑的滞销率
 * 滞销率高 → 业主利润下降 → 减产（现有的 marginRatio 机制加强）
 */
function calculateUnsoldRatio(buildingId, resourceKey) {
    const entry = buildingInventory[buildingId]?.[resourceKey];
    if (!entry || entry.lastTickOutput <= 0) return 0;
    
    // 滞销率 = 未售出量 / 本tick产出量
    return entry.unsold / entry.lastTickOutput;
}
```

### 7.2 利润率驱动开工率

现有的 `marginRatio` 机制可以直接加强：

```javascript
// 现有：marginRatio 基于预估收入和预估成本
// 新增：考虑库存积压对利润的压制

const baseMarginRatio = (estimatedRevenue - estimatedCost) / estimatedRevenue;
const unsoldPenalty = Math.max(0.3, 1 - unsoldRatio * 0.7); // 滞销越多，利润越低
const effectiveMarginRatio = baseMarginRatio * unsoldPenalty;

// 如果利润率过低，建筑自动减产
if (effectiveMarginRatio < minProfitMargin) {
    marginMultiplier = effectiveMarginRatio / minProfitMargin;
}
```

### 7.3 库存过剩时的价格调整

当某种资源的总库存天数远超目标时，现有的分段价格函数已经会自动降价。新增的库存归属机制让这个降价有了更真实的语义——建筑库存积压 → 业主急于出货 → 主动降价。

---

## 八、性能优化架构

### 8.1 索引体系

```javascript
// 已有（直接复用）：resource → buildings 的 O(1) 映射
// resourceBuildingIndex.js 中的 getOutputBuildingsForResource()

// 新增索引1：resource → 持有库存的建筑（每tick开始时重建）
const resourceStockIndex = {};
// { food: ['farm', 'large_estate', 'mechanized_farm'], iron: ['mine', 'shaft_mine'] }

// 新增索引2：owner → 建筑列表（启动时构建，建筑数量变化时更新）
const ownerBuildingIndex = {};
// { peasant: ['farm', 'loom_house'], artisan: ['sawmill', 'bronze_foundry'] }
```

### 8.2 每tick预计算有效售价

不需要每次购买都遍历所有卖家。在 tick 开头预计算每种资源的有效售价：

```javascript
// tick 开始时
const effectivePrices = {};
Object.keys(RESOURCES).forEach(resourceKey => {
    // 基于库存/成本/稀缺度计算统一售价
    effectivePrices[resourceKey] = calculateMarketPrice(resourceKey, marketState);
});
```

消费和生产过程中直接使用 `effectivePrices[resource]`，避免重复计算。

### 8.3 批量交易缓冲区

一个 tick 内的所有购买先累积到缓冲区，tick 结束时批量结算：

```javascript
// 交易缓冲区
const tradeBuffer = {};  // { 'peasant→artisan': 1250.5, 'worker→miner': 380.2 }

// 购买时累积
function accumulateTrade(buyer, seller, amount) {
    const key = `${buyer}→${seller}`;
    tradeBuffer[key] = (tradeBuffer[key] || 0) + amount;
}

// tick 结束时批量执行 ledger.transfer
function settleAllTrades() {
    for (const [route, amount] of Object.entries(tradeBuffer)) {
        const [from, to] = route.split('→');
        if (amount > 0) {
            ledger.transfer(from, to, amount, 'TRADE_SETTLEMENT', 'TRADE_SETTLEMENT');
        }
    }
}
```

**复杂度**：O(S²) ≈ 225 次 ledger 调用（S = 阶层数 ≈ 15），远小于逐笔交易。

### 8.4 库存聚合缓存

每次调用 `getTotalMarketStock` 时不需要重新遍历所有建筑。维护一个按资源聚合的缓存：

```javascript
// 每次库存变动时同步更新缓存
const totalStockCache = {};  // { food: 245.3, iron: 12.8 }

function updateStockCache(resourceKey) {
    let total = 0;
    for (const [buildingId, inventory] of Object.entries(buildingInventory)) {
        total += inventory[resourceKey]?.stock || 0;
    }
    totalStockCache[resourceKey] = total;
}
```

---

## 九、完整 Tick 流程（改造后）

```
┌─ Tick 开始 ─────────────────────────────────────────────┐
│                                                          │
│  1. 预计算阶段                                           │
│     ├─ 重建 resourceStockIndex                           │
│     ├─ 计算 effectivePrices（基于库存+成本+稀缺度）      │
│     ├─ 计算 livingCosts / wages                          │
│     └─ 初始化 tradeBuffer                                │
│                                                          │
│  2. 建筑生产循环                                         │
│     ├─ 计算 actualMultiplier（人手/原料/利润/滞销）       │
│     ├─ 购买原料 → purchaseFromMarket(ownerKey, ...)      │
│     │   └─ tradeBuffer[ownerKey→supplierOwner] += cost   │
│     ├─ 产出 → produceToInventory(buildingId, ...)        │
│     │   └─ 铸币所特殊：silver 直接进国库                 │
│     ├─ 工资 → ledger.transfer(ownerKey, workerRole, ...) │
│     └─ 营业税 → ledger.transfer(ownerKey, 'state', ...)  │
│                                                          │
│  3. 阶层消费循环                                         │
│     ├─ 基础需求 → purchaseFromMarket(stratumKey, ...)    │
│     │   └─ tradeBuffer[stratumKey→producerOwner] += cost │
│     ├─ 奢侈需求 → purchaseFromMarket(stratumKey, ...)   │
│     ├─ 交易税 → ledger.transfer(stratumKey, 'state',...) │
│     └─ 需求满足率计算                                    │
│                                                          │
│  4. 税收与转移支付                                       │
│     ├─ 人头税 → ledger.transfer(stratum, 'state', ...)   │
│     ├─ 补贴 → ledger.transfer('state', stratum, ...)     │
│     └─ 关税（外贸环节）                                  │
│                                                          │
│  5. 批量结算                                             │
│     └─ settleAllTrades() → 执行 tradeBuffer 中的转账     │
│                                                          │
│  6. 市场价格更新                                         │
│     ├─ 基于新的库存/成本/交易量重新计算价格              │
│     └─ 工资更新                                          │
│                                                          │
│  7. 库存管理                                             │
│     ├─ 计算各建筑的 unsoldRatio                          │
│     ├─ 更新 totalStockCache                              │
│     └─ 财富自然衰减（0.5%/day）                          │
│                                                          │
│  8. 商人外贸（保持现有 Trade 3.2）                       │
│     └─ 进口的资源进入商人的建筑库存                      │
│                                                          │
│  9. 人口转职/增长/其他系统                               │
│                                                          │
└─ Tick 结束 ─────────────────────────────────────────────┘
```

---

## 十、存档兼容性

### 10.1 迁移策略

旧存档没有 `buildingInventory` 数据。加载旧存档时：

```javascript
function migrateToInventorySystem(oldState) {
    if (oldState.buildingInventory) return oldState; // 已有
    
    // 用现有 res[] 中的库存按产出比例分配给各建筑
    const buildingInventory = {};
    Object.keys(RESOURCES).forEach(resourceKey => {
        const stock = oldState.resources[resourceKey] || 0;
        if (stock <= 0) return;
        
        const producers = getOutputBuildingsForResource(resourceKey);
        const totalOutput = producers.reduce((sum, p) => {
            const count = oldState.buildings[p.building.id] || 0;
            return sum + p.outputAmount * count;
        }, 0);
        
        if (totalOutput <= 0) return;
        
        producers.forEach(p => {
            const count = oldState.buildings[p.building.id] || 0;
            if (count <= 0) return;
            const share = (p.outputAmount * count) / totalOutput;
            const allocated = stock * share;
            
            if (!buildingInventory[p.building.id]) {
                buildingInventory[p.building.id] = {};
            }
            buildingInventory[p.building.id][resourceKey] = {
                stock: allocated,
                costPrice: oldState.market?.prices?.[resourceKey] || 
                           RESOURCES[resourceKey]?.basePrice || 1,
                lastTickOutput: p.outputAmount * count,
                unsold: 0,
            };
        });
    });
    
    return { ...oldState, buildingInventory };
}
```

---

## 十一、新增科技

```javascript
// 铸币术 — 解锁铸币所
{
    id: 'minting',
    name: "铸币术",
    desc: "标准化金属货币的铸造技术，建立统一的计价体系。",
    cost: { science: 80, culture: 30 },
    epoch: 1,
    effects: {
        passive: { silver: 0.5 }, // 解锁后有少量被动银币收入（代表贸易活跃）
    }
}

// 货币改革 — 解锁铸币厂
{
    id: 'monetary_reform',
    name: "货币改革",
    desc: "统一度量衡和币值标准，大幅提升铸币效率。",
    cost: { science: 400, culture: 150 },
    epoch: 4,
    requiresTech: 'minting',
    effects: {}
}

// 中央银行制度 — 解锁中央银行
{
    id: 'central_banking',
    name: "中央银行",
    desc: "设立国家级金融机构，统一管理货币发行和信贷。",
    cost: { science: 1200, culture: 400 },
    epoch: 6,
    requiresTech: 'monetary_reform',
    effects: {}
}

// 数字货币 — 解锁数字货币中心
{
    id: 'digital_currency',
    name: "数字货币",
    desc: "基于区块链和加密技术的新型货币体系。",
    cost: { science: 5000 },
    epoch: 9,
    requiresTech: 'central_banking',
    effects: {}
}
```

---

## 十二、实施路线图

### Phase 1：基础设施（~200行改动）
- [ ] 新增 `buildingInventory` 数据结构和相关工具函数
- [ ] 新增 `purchaseFromMarket` 核心购买函数
- [ ] 新增 `produceToInventory` 产出函数
- [ ] 新增铸币所建筑配置和科技配置
- [ ] 工资支付改为 `owner→worker` 直连

### Phase 2：核心替换（~500行改动）
- [ ] `sellProduction` 改为 `produceToInventory`
- [ ] 建筑原料消耗改为 `purchaseFromMarket`
- [ ] 阶层消费改为 `purchaseFromMarket`
- [ ] 实现 tradeBuffer 批量结算
- [ ] 存档迁移逻辑

### Phase 3：价格与库存（~300行改动）
- [ ] 实现 `calculateAskPrice`（卖方要价）
- [ ] 实现滞销率计算和利润率压制
- [ ] 价格更新逻辑适配新的库存数据源
- [ ] `res[]` 改为聚合视图

### Phase 4：平衡测试
- [ ] 铸币所产出量 vs 经济体量的平衡
- [ ] 各时代建筑产出/消耗的银币流量测试
- [ ] 通胀/通缩场景测试
- [ ] Epoch 0 以物易物 vs Epoch 1 铸币过渡的平滑度

### Phase 5：UI 适配
- [ ] 资源面板显示"市场库存"（聚合视图）
- [ ] 建筑详情显示"库存/滞销/利润率"
- [ ] 经济面板显示"货币总量 M / GDP / 物价指数 P"
- [ ] 铸币所专用面板

---

## 十三、关键设计决策总结

| 决策 | 选择 | 理由 |
|------|------|------|
| 库存粒度 | 建筑类型级（非实例级） | 同类型建筑共享 owner，实例级浪费内存 |
| 货币创造源 | 仅铸币所 | 建立明确的"货币量"概念 |
| 工资支付 | owner→worker 直连 | 消除 void 中转，改动最小 |
| 消费支付 | stratum→producerOwner | 消灭消费侧的 void |
| 原料支付 | ownerA→ownerB | 消灭生产侧的 void |
| 商人国内贸易 | 暂不实现 | 降低复杂度，后续可扩展 |
| 性能 | 批量结算 + 预计算价格 | O(S²) 而非 O(B×R) |
| Epoch 0 | 初始银币 + 以物易物 | 铸币所从 Epoch 1 开始 |
| 死锁防护 | 铸币所注入 + 国库分配 | 不需要额外的央行信贷机制 |
