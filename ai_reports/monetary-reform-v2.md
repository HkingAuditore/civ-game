# 「货币量」改革方案 V2 —— 渐进式可落地版

> 基于对 V1 方案的深度 review，解决了死锁、性能、价格系统冲突等致命问题。
> 核心理念：**不推翻现有系统，而是在现有架构上逐层叠加货币量追踪能力**。

---

## 〇、设计哲学

### 为什么不能一步到位？

V1 方案试图一次性将"信用货币 + 无主公共池"替换为"商品货币 + 建筑库存"，这会导致：

1. **鸡生蛋死锁**：铸币所产出不足 → 经济循环无法启动 → 通缩螺旋
2. **性能灾难**：逐笔购买遍历所有建筑 → tick 时间翻倍
3. **两套价格系统冲突**：`calculateAskPrice` vs 现有 `updateMarketPrices`
4. **贸易系统不兼容**：Trade 3.2 的 2234 行代码完全没有适配
5. **14 个银币产出建筑的处理**：trading_post, town_hall, church 等

### V2 的核心思路

**不改变现有的 void 创造/销毁模式**，而是：

1. 在 ledger 层面**追踪**每 tick 的货币创造量和销毁量
2. 引入铸币所作为**额外的、可控的**货币注入源
3. 用"货币量指标"驱动**宏观经济效果**（通胀/通缩）
4. 让玩家通过铸币政策**间接影响**经济

这样做的好处：
- **零破坏性**：现有经济循环完全不变，不会出现死锁
- **零性能损耗**：不需要逐笔购买，不需要建筑库存
- **渐进式**：每个 Phase 都是独立可测试的增量改动
- **有游戏性**：玩家获得了"铸币政策"这个新的决策维度

---

## 一、Phase 0 —— 货币量追踪基础设施（~80 行改动，零风险）

### 1.1 目标

在不改变任何经济逻辑的前提下，追踪每 tick 的货币创造量、销毁量和总量。

### 1.2 实现：扩展 EconomyLedger

在 `src/logic/economy/ledger.js` 中新增追踪字段：

```javascript
// EconomyLedger constructor 中新增
this.monetaryStats = {
    created: 0,      // 本 tick 从 void 创造的银币总量
    destroyed: 0,    // 本 tick 销毁到 void 的银币总量
    netCreation: 0,  // 净创造量 = created - destroyed
    transferred: 0,  // 本 tick 守恒转移的银币总量（不含 void）
};
```

在 `transfer()` 方法中自动统计：

```javascript
transfer(from, to, amount, category, subCategory, metadata = {}) {
    if (amount <= 0) return;

    // 货币量追踪
    if (from === 'void' && to !== 'void') {
        this.monetaryStats.created += amount;
    }
    if (to === 'void' && from !== 'void') {
        this.monetaryStats.destroyed += amount;
    }
    if (from !== 'void' && to !== 'void') {
        this.monetaryStats.transferred += amount;
    }

    // ... 现有逻辑不变 ...
}
```

### 1.3 实现：计算货币总量 M

在 simulation.js 的 return 之前，计算并返回货币总量：

```javascript
// 货币总量 M = Σ(各阶层 wealth) + 国库银币
const moneySupply = totalWealth + (res.silver || 0);

// 本 tick 的货币流量统计
const monetaryStats = {
    moneySupply,                              // M: 货币总量
    created: ledger.monetaryStats.created,     // 本 tick 创造量
    destroyed: ledger.monetaryStats.destroyed, // 本 tick 销毁量
    netCreation: ledger.monetaryStats.created - ledger.monetaryStats.destroyed,
    transferred: ledger.monetaryStats.transferred, // 守恒流转量
    velocity: 0, // Phase 1 计算
};
```

### 1.4 实现：工资直连

将工资支付从 `oKey→void→role` 改为 `oKey→role`：

**simulation.js:3193** — 删除 owner 扣款到 void：
```javascript
// 旧：ledger.transfer(oKey, 'void', paid, WAGES_PAID, WAGES_PAID, { buildingId: b.id });
// 改为：不再单独扣款，由下方的工资发放直接从 owner 扣
```

**simulation.js:3219** — 工资发放改为直连：
```javascript
// 旧：ledger.transfer('void', plan.role, payout, WAGE, WAGE, { buildingId: b.id });
// 新：ledger.transfer(oKey, plan.role, payout, WAGE, WAGE, { buildingId: b.id });
```

> **注意**：这里需要仔细处理 `ownerPaidRatio` 的逻辑。当前系统中 owner 先统一扣款到 void（按 ownerBill），然后 worker 按 ratio 从 void 收款。改为直连后，需要确保 owner 的扣款总额 = 所有 worker 的收款总额。
>
> 具体做法：保留 `ownerPaidRatio` 的计算逻辑不变，但将两步 transfer 合并为一步。owner 的总扣款仍然是 `paid`（= min(disposableWealth, ownerBill)），worker 的总收款仍然是 `Σ(actualSlotWage × filled)`，两者通过 ratio 保持一致。

### 1.5 返回值扩展

在 simulation.js 的 return 对象中新增：

```javascript
return {
    // ... 现有字段 ...
    monetaryStats,  // 新增：货币量统计
};
```

### 1.6 UI 展示

在经济面板中新增一行：

```
💰 货币总量: 12,450 银币 | 本日创造: +340 | 本日销毁: -285 | 净变化: +55
```

### 1.7 改动清单

| 文件 | 改动 | 行数 |
|------|------|------|
| `src/logic/economy/ledger.js` | 新增 monetaryStats 追踪 | ~15 行 |
| `src/logic/simulation.js` | 计算 moneySupply，工资直连 | ~30 行 |
| `src/logic/simulation.js` | return 中新增 monetaryStats | ~5 行 |
| `src/components/panels/EconomyPanel.jsx` | 显示货币量指标 | ~30 行 |

**总计：~80 行，零风险，可立即实施。**

---

## 二、Phase 1 —— 铸币所与货币政策（~300 行改动，低风险）

### 2.1 目标

引入铸币所建筑，作为**额外的、可控的**货币注入源。**不改变现有的 void 创造/销毁模式**。

### 2.2 铸币所建筑设计

```javascript
// src/config/buildings.js 新增
{
    id: 'mint',
    name: "铸币所",
    desc: "将铜锭熔铸为标准化铜钱。铸币所归国家所有，产出的银币直接进入国库，是国家调控货币供给的核心手段。",
    baseCost: { stone: 60, wood: 40, copper: 15 },
    input: { copper: 0.3, wood: 0.1 },
    output: { silver: 2.0 },
    jobs: { official: 1, worker: 3 },
    // 无 owner → 产出归 state
    epoch: 1,
    cat: 'civic',
    requiresTech: 'minting',
    maxCount: 3,  // 限制数量，防止无限铸币
    visual: { icon: 'Coins', color: 'bg-yellow-700', text: 'text-yellow-200' },
    marketConfig: {
        price: { livingCostWeight: 0.05, taxCostWeight: 0.05 },
        wage: { livingCostWeight: 0.05, taxCostWeight: 0.05 },
    },
    tags: ['civic', 'monetary'],
}
```

**关键设计决策**：

1. **`maxCount: 3`**：限制铸币所数量，防止玩家无限铸币导致恶性通胀。这是一个**硬约束**，比依赖铜矿供给来限制更可靠。
2. **`output: { silver: 2.0 }`**：保守的产出量。3 个铸币所 = 6.0 silver/tick，在 Epoch 1（人口 ~15-50）的经济体量下是合理的补充。
3. **无 owner**：产出进入国库（`res.silver`），由玩家通过税收/补贴/军饷等渠道分配到经济循环中。

### 2.3 时代演进的铸币建筑

| 时代 | 建筑 | 输入 | 产出 | maxCount | 解锁科技 |
|------|------|------|------|----------|---------|
| Epoch 1 (青铜) | 铸币所 (mint) | copper: 0.3, wood: 0.1 | silver: 2.0 | 3 | minting |
| Epoch 4 (探索) | 铸币厂 (royal_mint) | copper: 0.8, coal: 0.2 | silver: 8.0 | 2 | monetary_reform |
| Epoch 6 (蒸汽) | 中央银行 (central_bank) | papyrus: 0.3 | silver: 25.0 | 1 | central_banking |
| Epoch 8 (原子) | 联储体系 (federal_reserve) | electricity: 0.5 | silver: 80.0 | 1 | modern_monetary |

**设计原则**：
- 每个时代的铸币建筑**替代**上一时代的（通过 `replacedBy` 或 `obsoletedBy` 机制）
- 后期铸币建筑数量更少但产出更高，体现"货币发行权集中化"的历史趋势
- 输入从实物（铜）逐渐转向抽象（纸张 → 电力），体现从商品货币到信用货币的演变

### 2.4 铸币所的特殊处理

铸币所的 silver 产出在 `sellProduction()` 中已经有现成的处理路径：

```javascript
// simulation.js 中现有的 sellProduction()
if (resource === 'silver' && amount > 0) {
    // 银币产出直接给 owner（对于铸币所，owner 是 state）
    ledger.transfer('void', ownerKey, amount, OWNER_REVENUE, ...);
    return;
}
```

由于铸币所没有 `owner` 字段，`ownerKey` 默认为 `'state'`，银币直接进入国库。**不需要任何特殊代码**。

### 2.5 新增科技

```javascript
// src/config/technologies.js 新增
{
    id: 'minting',
    name: "铸币术",
    desc: "标准化金属货币的铸造技术，建立统一的计价体系。解锁铸币所。",
    cost: { science: 60, culture: 20 },
    epoch: 1,
    effects: {}
},
{
    id: 'monetary_reform',
    name: "货币改革",
    desc: "统一度量衡和币值标准，大幅提升铸币效率。解锁铸币厂。",
    cost: { science: 350, culture: 120 },
    epoch: 4,
    requiresTech: 'minting',
    effects: {}
},
{
    id: 'central_banking',
    name: "中央银行制度",
    desc: "设立国家级金融机构，统一管理货币发行。解锁中央银行。",
    cost: { science: 1000, culture: 350 },
    epoch: 6,
    requiresTech: 'monetary_reform',
    effects: {}
},
{
    id: 'modern_monetary',
    name: "现代货币理论",
    desc: "法定货币与信用扩张体系，货币发行不再依赖贵金属。解锁联储体系。",
    cost: { science: 3500 },
    epoch: 8,
    requiresTech: 'central_banking',
    effects: {}
},
```

### 2.6 货币流通速度计算

在 Phase 0 的 `monetaryStats` 基础上，计算流通速度：

```javascript
// simulation.js 中
const moneySupply = totalWealth + (res.silver || 0);

// 流通速度 V = 守恒转移量 / 货币总量
// transferred 包含：税收、补贴、工资（直连后）、军饷等所有非 void 转移
const velocity = moneySupply > 0
    ? ledger.monetaryStats.transferred / moneySupply
    : 0;

// 物价指数 P = 加权平均价格 / 基准价格
// 复用现有的 updatedPrices 数据
let priceIndex = 0;
let priceIndexWeight = 0;
Object.entries(updatedPrices).forEach(([resKey, price]) => {
    const basePrice = RESOURCES[resKey]?.basePrice || 1;
    const weight = demand[resKey] || 0;
    priceIndex += (price / basePrice) * weight;
    priceIndexWeight += weight;
});
priceIndex = priceIndexWeight > 0 ? priceIndex / priceIndexWeight : 1.0;

const monetaryStats = {
    moneySupply,
    created: ledger.monetaryStats.created,
    destroyed: ledger.monetaryStats.destroyed,
    netCreation: ledger.monetaryStats.created - ledger.monetaryStats.destroyed,
    transferred: ledger.monetaryStats.transferred,
    velocity,
    priceIndex,
    mintOutput: stateBuildingSilverOutput, // 铸币所产出（已有字段）
};
```

### 2.7 改动清单

| 文件 | 改动 | 行数 |
|------|------|------|
| `src/config/buildings.js` | 新增 4 个铸币建筑 | ~80 行 |
| `src/config/technologies.js` | 新增 4 个科技 | ~40 行 |
| `src/logic/simulation.js` | 计算 velocity, priceIndex | ~30 行 |
| `src/components/panels/EconomyPanel.jsx` | 显示完整货币指标 | ~60 行 |
| `src/components/panels/BuildingPanel.jsx` | 铸币所特殊 UI | ~30 行 |

**总计：~240 行，低风险。铸币所只是一个普通的国有建筑，不改变任何经济逻辑。**

---

## 三、Phase 2 —— 货币量驱动宏观效果（~200 行改动，中风险）

### 3.1 目标

让货币量指标**影响**经济行为，产生通胀/通缩的宏观效果。

### 3.2 核心机制：货币量偏离系数

```javascript
// src/logic/economy/monetary.js（新文件，~100 行）

/**
 * 计算货币量偏离系数
 * 
 * 理想货币量 M* = 经济体量 × 目标 M/GDP 比率
 * 偏离系数 = M / M*
 * 
 * 偏离系数 > 1 → 货币过多 → 通胀压力
 * 偏离系数 < 1 → 货币不足 → 通缩压力
 * 偏离系数 ≈ 1 → 货币量适中
 */
export function calculateMonetaryDeviation(moneySupply, economicActivity, config = {}) {
    const targetRatio = config.targetMGDPRatio || 3.0;  // 目标 M/GDP ≈ 3
    const idealM = economicActivity * targetRatio;
    
    if (idealM <= 0) return 1.0; // 无经济活动时，偏离系数为 1
    
    const deviation = moneySupply / idealM;
    
    // 限制在 [0.2, 5.0] 范围内，防止极端值
    return Math.max(0.2, Math.min(5.0, deviation));
}

/**
 * 货币量偏离对价格的影响
 * 
 * 通胀时：价格上涨压力（但受 smoothing 限制，不会突变）
 * 通缩时：价格下跌压力
 * 
 * 这个系数叠加到现有的 updateMarketPrices 中的 priceMultiplier 上
 */
export function getMonetaryPriceEffect(deviation) {
    if (deviation >= 0.8 && deviation <= 1.2) {
        return 1.0; // 正常范围，无影响
    }
    
    if (deviation > 1.2) {
        // 通胀：价格上涨，但有上限
        // deviation 1.5 → 1.1x, deviation 2.0 → 1.2x, deviation 3.0 → 1.4x
        const inflationPressure = 1.0 + (deviation - 1.2) * 0.25;
        return Math.min(1.5, inflationPressure);
    }
    
    // 通缩：价格下跌，但有下限
    // deviation 0.5 → 0.925x, deviation 0.3 → 0.875x
    const deflationPressure = 1.0 - (0.8 - deviation) * 0.25;
    return Math.max(0.75, deflationPressure);
}

/**
 * 货币量偏离对工资的影响
 * 
 * 通胀时：工人要求更高工资（生活成本上升）
 * 通缩时：工资下行压力（企业利润下降）
 */
export function getMonetaryWageEffect(deviation) {
    if (deviation >= 0.85 && deviation <= 1.15) {
        return 1.0;
    }
    
    if (deviation > 1.15) {
        // 通胀推高工资，但滞后于价格（工资粘性）
        const wagePush = 1.0 + (deviation - 1.15) * 0.15;
        return Math.min(1.3, wagePush);
    }
    
    // 通缩压低工资
    const wageDrag = 1.0 - (0.85 - deviation) * 0.15;
    return Math.max(0.8, wageDrag);
}

/**
 * 货币量偏离对满意度的影响
 * 
 * 严重通胀 → 民众不满（物价飞涨）
 * 严重通缩 → 民众不满（失业增加）
 * 适度通胀 → 无影响
 */
export function getMonetaryApprovalEffect(deviation) {
    if (deviation >= 0.6 && deviation <= 1.8) {
        return 0; // 正常范围，无满意度影响
    }
    
    if (deviation > 1.8) {
        // 严重通胀：-5 到 -20 满意度
        return -Math.min(20, (deviation - 1.8) * 15);
    }
    
    // 严重通缩：-5 到 -15 满意度
    return -Math.min(15, (0.6 - deviation) * 25);
}
```

### 3.3 集成到现有系统

**价格系统集成**（`src/logic/economy/prices.js`）：

在 `updateMarketPrices` 的最终价格计算中，叠加货币量效果：

```javascript
// 在现有的 priceMultiplier 计算之后，叠加货币量效果
const monetaryPriceEffect = getMonetaryPriceEffect(monetaryDeviation);
priceMultiplier *= monetaryPriceEffect;
```

**工资系统集成**（`src/logic/economy/wages.js`）：

在 `updateWages` 中，叠加货币量效果：

```javascript
// 在现有的 smoothed 计算之后
const monetaryWageEffect = getMonetaryWageEffect(monetaryDeviation);
const adjustedSmoothed = smoothed * monetaryWageEffect;
updatedWages[role] = parseFloat(adjustedSmoothed.toFixed(2));
```

**满意度系统集成**（`src/logic/stability/approval.js`）：

在满意度计算中新增一个 breakdown 项：

```javascript
// 货币量对满意度的影响
const monetaryApproval = getMonetaryApprovalEffect(monetaryDeviation);
if (monetaryApproval !== 0) {
    approvalBreakdown[key].monetary = monetaryApproval;
    targetApproval += monetaryApproval;
}
```

### 3.4 经济活动量的计算

`economicActivity` 是计算偏离系数的关键输入。使用现有数据：

```javascript
// 经济活动量 ≈ 所有阶层的收入总和（已有 roleWagePayout）
// 这等价于 GDP 的收入法计算
const economicActivity = Object.values(roleWagePayout).reduce((sum, v) => sum + v, 0)
    + (ledger.dailyOwnerRevenue || 0);  // 加上建筑产出收入
```

### 3.5 游戏性设计：通胀/通缩的玩家感知

| 货币状态 | 偏离系数 | 玩家感知 | 游戏效果 |
|---------|---------|---------|---------|
| 严重通缩 | < 0.5 | 🔵 "货币紧缩" | 价格下跌，工资下降，满意度 -15 |
| 轻度通缩 | 0.5-0.8 | 🔵 "货币偏紧" | 价格略降，工资略降 |
| 正常 | 0.8-1.2 | ⚪ "货币稳定" | 无额外效果 |
| 轻度通胀 | 1.2-1.8 | 🟡 "货币宽松" | 价格略升，工资略升 |
| 严重通胀 | > 1.8 | 🔴 "通货膨胀" | 价格飞涨，满意度 -20 |

**玩家的决策空间**：
- 建更多铸币所 → 增加货币供给 → 缓解通缩 / 加剧通胀
- 拆除铸币所 → 减少货币供给 → 缓解通胀 / 加剧通缩
- 提高税率 → 国库吸收货币 → 减少流通中的货币
- 增加补贴 → 国库释放货币 → 增加流通中的货币
- 扩大生产 → 增加实际产出 → 在货币量不变时降低物价

### 3.6 改动清单

| 文件 | 改动 | 行数 |
|------|------|------|
| `src/logic/economy/monetary.js` | 新文件：偏离系数和效果函数 | ~100 行 |
| `src/logic/economy/prices.js` | 叠加 monetaryPriceEffect | ~5 行 |
| `src/logic/economy/wages.js` | 叠加 monetaryWageEffect | ~5 行 |
| `src/logic/simulation.js` | 计算 deviation, economicActivity | ~20 行 |
| `src/logic/stability/approval.js` | 新增 monetary breakdown | ~10 行 |
| `src/components/panels/EconomyPanel.jsx` | 通胀/通缩状态指示器 | ~40 行 |

**总计：~180 行。唯一的新文件是 `monetary.js`，其余都是在现有模块中添加 1-2 行乘法。**

---

## 四、Phase 3 —— 铸币政策面板（~250 行改动，低风险，纯 UI）

### 4.1 目标

给玩家一个专门的"货币政策"面板，让铸币决策成为有意义的游戏体验。

### 4.2 面板设计

```
┌─────────────────────────────────────────────────┐
│  💰 货币政策                                      │
│                                                   │
│  ┌─ 货币概览 ──────────────────────────────────┐ │
│  │ 货币总量 (M):     12,450 银币                │ │
│  │ 流通速度 (V):     0.34                       │ │
│  │ 物价指数 (P):     1.12 (▲ +12%)             │ │
│  │ 货币状态:         🟡 轻度通胀                │ │
│  │ 偏离系数:         1.35                       │ │
│  └──────────────────────────────────────────────┘ │
│                                                   │
│  ┌─ 货币流量 ──────────────────────────────────┐ │
│  │ 铸币所产出:       +6.0 /日                   │ │
│  │ 建筑产出收入:     +340 /日 (void→owner)      │ │
│  │ 消费支出:         -285 /日 (stratum→void)    │ │
│  │ 财富衰减:         -12 /日                    │ │
│  │ ─────────────────────────────                │ │
│  │ 净变化:           +49 /日                    │ │
│  └──────────────────────────────────────────────┘ │
│                                                   │
│  ┌─ 铸币设施 ──────────────────────────────────┐ │
│  │ 铸币所 ×2/3     产出: 4.0 silver/日          │ │
│  │ [建造] [拆除]                                │ │
│  │                                               │ │
│  │ 💡 建议：当前通胀压力较大，                   │ │
│  │    考虑减少铸币所或提高税率。                  │ │
│  └──────────────────────────────────────────────┘ │
│                                                   │
│  ┌─ 历史趋势 ──────────────────────────────────┐ │
│  │ [M 总量折线图] [P 物价指数折线图]            │ │
│  │ (最近 30 天)                                  │ │
│  └──────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

### 4.3 智能建议系统

```javascript
function getMonetaryAdvice(monetaryStats) {
    const { deviation, priceIndex, velocity } = monetaryStats;
    
    if (deviation > 2.0) {
        return {
            level: 'danger',
            text: '严重通胀！物价飞涨，民众不满。建议：减少铸币所、提高税率、扩大生产。',
        };
    }
    if (deviation > 1.5) {
        return {
            level: 'warning',
            text: '通胀压力较大。建议：适当减少铸币或提高税率以回收货币。',
        };
    }
    if (deviation < 0.4) {
        return {
            level: 'danger',
            text: '严重通缩！经济萎缩，工资下降。建议：增建铸币所、降低税率、增加补贴。',
        };
    }
    if (deviation < 0.7) {
        return {
            level: 'warning',
            text: '货币偏紧。建议：适当增加铸币或降低税率以释放货币。',
        };
    }
    return {
        level: 'normal',
        text: '货币供给稳定，经济运行正常。',
    };
}
```

### 4.4 历史数据追踪

在 `useGameState.js` 中新增历史数据存储：

```javascript
// 货币量历史（最近 30 天）
monetaryHistory: [],

// 每 tick 更新
if (newState.monetaryStats) {
    const history = [...(state.monetaryHistory || []), {
        tick: state.tick,
        moneySupply: newState.monetaryStats.moneySupply,
        priceIndex: newState.monetaryStats.priceIndex,
        deviation: newState.monetaryStats.deviation,
    }];
    // 保留最近 30 天
    if (history.length > 30) history.shift();
    newState.monetaryHistory = history;
}
```

---

## 五、Phase 4 —— 消费侧货币守恒（~400 行改动，高风险，需充分测试）

### 5.1 目标

这是**可选的进阶改动**。将消费环节从"货币销毁"改为"货币转移"，让消费者的支出成为生产者的收入。

### 5.2 为什么放在最后？

Phase 0-3 已经实现了"货币量"的核心游戏体验：
- 玩家能看到货币总量和通胀/通缩状态
- 玩家能通过铸币政策影响经济
- 通胀/通缩会影响价格、工资和满意度

Phase 4 是**锦上添花**——让货币流转更"真实"，但代价是：
- 需要追踪"谁生产了什么"（建筑类型级库存）
- 需要处理滞销/积压问题
- 需要适配贸易系统

### 5.3 简化的库存方案

**不使用 V1 的完整建筑库存系统**，而是使用更轻量的"产出归属追踪"：

```javascript
// 每 tick 开始时，记录每种资源的产出来源
const productionSources = {};
// { food: { farm: { amount: 23.2, ownerKey: 'peasant' }, large_estate: { amount: 12.0, ownerKey: 'landowner' } } }
```

消费时，按产出比例将货币分配给生产者：

```javascript
function consumeWithPayment(buyerKey, resourceKey, amount, price, productionSources) {
    const sources = productionSources[resourceKey];
    if (!sources) {
        // 回退到现有的 void 模式
        ledger.transfer(buyerKey, 'void', amount * price, CONSUMPTION);
        return;
    }
    
    // 计算总产出
    const totalOutput = Object.values(sources).reduce((sum, s) => sum + s.amount, 0);
    if (totalOutput <= 0) {
        ledger.transfer(buyerKey, 'void', amount * price, CONSUMPTION);
        return;
    }
    
    // 按产出比例分配货币给各生产者
    const totalCost = amount * price;
    Object.entries(sources).forEach(([buildingId, source]) => {
        const share = source.amount / totalOutput;
        const payment = totalCost * share;
        if (payment > 0) {
            // 累积到 tradeBuffer，tick 结束时批量结算
            accumulateTrade(buyerKey, source.ownerKey, payment);
        }
    });
}
```

### 5.4 批量结算（复用 V1 的 tradeBuffer 思路）

```javascript
const tradeBuffer = {};

function accumulateTrade(buyer, seller, amount) {
    if (buyer === seller) return; // 自产自销，不需要转账
    const key = `${buyer}→${seller}`;
    tradeBuffer[key] = (tradeBuffer[key] || 0) + amount;
}

function settleAllTrades(ledger) {
    Object.entries(tradeBuffer).forEach(([route, amount]) => {
        const [from, to] = route.split('→');
        if (amount > 0.01) { // 忽略极小金额
            ledger.transfer(from, to, amount, 'MARKET_PURCHASE', 'MARKET_SALE');
        }
    });
}
```

**性能**：最多 S² = 15² = 225 次 ledger 调用，远小于逐笔交易。

### 5.5 安全阀：防止通缩螺旋

当消费侧改为货币转移后，如果某种资源滞销，生产者收不到钱，可能引发通缩螺旋。

**安全阀机制**：

```javascript
// 如果某个阶层的 wealth 低于 startingWealth 的 20%，
// 且该阶层有正的产出（是生产者），
// 则从 void 注入少量"紧急流动性"
Object.keys(STRATA).forEach(key => {
    const wealth = classWealthResult[key] || 0;
    const startingWealth = STRATA[key]?.startingWealth || 100;
    const isProducer = Object.values(productionSources).some(
        sources => Object.values(sources).some(s => s.ownerKey === key)
    );
    
    if (isProducer && wealth < startingWealth * 0.2) {
        const injection = startingWealth * 0.1; // 注入 10% 的初始财富
        ledger.transfer('void', key, injection, 'EMERGENCY_LIQUIDITY', 'EMERGENCY_LIQUIDITY');
    }
});
```

这个安全阀确保即使在极端情况下，经济也不会完全停摆。

### 5.6 贸易系统适配

进口的资源视为"外部生产者"，出口的货币视为"外部消费者"：

```javascript
// 进口：外国生产者 → 商人购买
// 在 productionSources 中添加 'foreign' 来源
productionSources[resourceKey]['foreign_import'] = {
    amount: importedAmount,
    ownerKey: 'merchant', // 商人是进口的中间商
};

// 出口：商人卖出 → 外国消费者
// 出口收入已经在 Trade 3.2 中处理，不需要额外改动
```

### 5.7 改动清单

| 文件 | 改动 | 行数 |
|------|------|------|
| `src/logic/simulation.js` | productionSources 追踪 | ~50 行 |
| `src/logic/simulation.js` | consumeWithPayment 替换 | ~80 行 |
| `src/logic/simulation.js` | tradeBuffer 和 settleAllTrades | ~40 行 |
| `src/logic/simulation.js` | 安全阀机制 | ~30 行 |
| `src/logic/simulation.js` | 贸易适配 | ~20 行 |
| `src/logic/economy/ledger.js` | 新增 MARKET_PURCHASE/SALE 类别 | ~10 行 |

**总计：~230 行。但由于涉及 simulation.js 的核心消费循环，需要充分测试。**

---

## 六、Epoch 0（石器时代）的处理

### 6.1 结论：不做任何特殊处理

基于上一轮 review 的分析，**石器时代不需要单独的市场设计**。

理由：
1. Epoch 0 已经有银币经济（trading_post 产出 silver: 1.6）
2. 以物易物需要全新的交易子系统，工作量巨大
3. 从以物易物到货币经济的过渡对玩家体验是灾难性的
4. Epoch 0 是教学阶段，不需要复杂的货币机制

### 6.2 Epoch 0 的货币量叙事

在 Phase 2 的货币政策面板中，Epoch 0 显示：

```
💰 货币政策

📜 原始货币时代
你的部落使用贝壳和贵金属碎片作为交换媒介。
这些"原始货币"由贸易站自然产生。

研究「铸币术」以建造铸币所，
正式进入标准化货币时代。

当前货币总量: 245 银币
```

这样既保持了叙事的连贯性，又不需要任何代码改动。

---

## 七、现有银币产出建筑的处理

### 7.1 问题

当前有 14 个建筑产出 silver（trading_post, town_hall, church, harbor 等）。在新方案中，这些建筑的银币产出如何定位？

### 7.2 方案：重新定义为"经济活动收入"

这些建筑的银币产出**不是铸币**，而是代表"经济活动产生的收入"：
- trading_post 的 silver 产出 = 贸易利润
- town_hall 的 silver 产出 = 行政收费
- church 的 silver 产出 = 信众捐献

在 Phase 0-2 中，这些建筑的处理**完全不变**——它们仍然从 void 创造银币给 owner。

在 Phase 4 中，如果需要更严格的货币守恒，可以将这些建筑的 silver 产出改为"从国库转移"而非"从 void 创造"：

```javascript
// 可选的 Phase 4 改动
if (resource === 'silver' && amount > 0) {
    if (isMintBuilding(buildingId)) {
        // 铸币所：唯一的 void → state 创造
        ledger.transfer('void', 'state', amount, 'MINT_OUTPUT');
    } else {
        // 其他银币产出建筑：从国库转移（如果国库有钱）
        const available = Math.min(amount, res.silver || 0);
        if (available > 0) {
            ledger.transfer('state', ownerKey, available, 'ECONOMIC_ACTIVITY_INCOME');
        }
        // 国库不足时，仍从 void 创造（安全阀）
        const shortfall = amount - available;
        if (shortfall > 0) {
            ledger.transfer('void', ownerKey, shortfall, 'ECONOMIC_ACTIVITY_INCOME');
        }
    }
}
```

但这是**可选的**，Phase 0-3 完全不需要处理这个问题。

---

## 八、完整实施路线图

```
Phase 0 (零风险, ~80行)          Phase 1 (低风险, ~240行)
┌──────────────────┐            ┌──────────────────────┐
│ ✅ ledger 追踪    │            │ ✅ 铸币所建筑 ×4      │
│ ✅ 工资直连       │     →      │ ✅ 铸币科技 ×4        │
│ ✅ M 总量计算     │            │ ✅ V 流通速度         │
│ ✅ 基础 UI        │            │ ✅ P 物价指数         │
└──────────────────┘            └──────────────────────┘
                                          │
                                          ▼
Phase 3 (低风险, ~250行)         Phase 2 (中风险, ~180行)
┌──────────────────────┐        ┌──────────────────────┐
│ ✅ 货币政策面板       │   ←    │ ✅ 偏离系数计算       │
│ ✅ 智能建议系统       │        │ ✅ 价格叠加效果       │
│ ✅ 历史趋势图表       │        │ ✅ 工资叠加效果       │
│ ✅ 通胀/通缩指示器    │        │ ✅ 满意度影响         │
└──────────────────────┘        └──────────────────────┘
                                          │
                                          ▼
                                Phase 4 (高风险, ~230行, 可选)
                                ┌──────────────────────┐
                                │ ⚠️ 消费侧货币守恒    │
                                │ ⚠️ productionSources │
                                │ ⚠️ tradeBuffer       │
                                │ ⚠️ 安全阀机制        │
                                │ ⚠️ 贸易适配          │
                                └──────────────────────┘
```

### 各 Phase 的独立价值

| Phase | 独立价值 | 可以单独发布？ |
|-------|---------|--------------|
| Phase 0 | 工资直连 + 货币量追踪 | ✅ 是，纯基础设施 |
| Phase 1 | 铸币所建筑 + 经济指标 | ✅ 是，新建筑 + 新 UI |
| Phase 2 | 通胀/通缩宏观效果 | ✅ 是，经济深度大幅提升 |
| Phase 3 | 货币政策面板 | ✅ 是，玩家决策维度 |
| Phase 4 | 消费侧货币守恒 | ⚠️ 需要充分测试后发布 |

**每个 Phase 都是独立可发布的增量改动**，不需要等待后续 Phase 完成。

---

## 九、数值平衡指南

### 9.1 铸币所产出量的校准

铸币所的产出量需要与经济体量匹配。以下是各时代的参考数据：

| 时代 | 典型人口 | 典型日 GDP | 铸币所产出 | M/GDP 目标 |
|------|---------|-----------|-----------|-----------|
| Epoch 1 (青铜) | 15-50 | ~50-200 | 2.0×3=6.0 | ~3.0 |
| Epoch 4 (探索) | 200-900 | ~2000-8000 | 8.0×2=16.0 | ~3.0 |
| Epoch 6 (蒸汽) | 1000-4500 | ~15000-60000 | 25.0×1=25.0 | ~3.0 |
| Epoch 8 (原子) | 5000-14000 | ~80000-300000 | 80.0×1=80.0 | ~3.0 |

> **注意**：这些数值是初始估计，需要在实际测试中调整。关键指标是 `monetaryDeviation` 应该在 0.8-1.2 的正常范围内波动。

### 9.2 现有银币产出建筑的影响

当前 14 个银币产出建筑的总产出（假设各 1 个）：

```
trading_post:    1.6
town_hall:       4.0 (×silver)
church:          1.6
harbor:          12.0
magistrate:      0.6
large_estate:    2.0
tavern:          2.4
amphitheater:    2.86
monastery:       12.27
apartment:       1.0
university:      18.0
opera_house:     15.0
stock_exchange:  20.0
```

这些建筑的银币产出在 Phase 0-3 中仍然从 void 创造，会被 `monetaryStats.created` 追踪。铸币所的产出是**额外的**货币注入，叠加在这些现有来源之上。

因此，铸币所的产出量应该设置得**保守**——它是"额外的可控注入"，而非"唯一来源"。

### 9.3 偏离系数的调参

`calculateMonetaryDeviation` 中的 `targetMGDPRatio` 是关键参数：

- 设为 3.0：适中，大多数时候偏离系数在 0.8-1.5 之间
- 设为 5.0：宽松，需要更多货币才会触发通胀
- 设为 2.0：紧缩，容易触发通胀

建议初始设为 3.0，根据测试调整。

---

## 十、与现有系统的兼容性

### 10.1 存档兼容

Phase 0-3 的改动**完全向后兼容**：
- `monetaryStats` 是新增字段，旧存档没有时默认为空
- 铸币所是新建筑，旧存档中不存在，不影响
- 偏离系数在没有历史数据时默认为 1.0（正常）

### 10.2 贸易系统兼容

Phase 0-3 **完全不影响** Trade 3.2 系统。铸币所只是一个普通的国有建筑，贸易系统不需要知道它的存在。

Phase 4 需要在贸易系统中添加 `productionSources['foreign_import']`，但这是一个简单的追加，不改变贸易逻辑。

### 10.3 外交系统兼容

货币量指标可以作为外交系统的输入：
- 通胀严重的国家 → 外交信誉下降
- 通缩严重的国家 → 贸易吸引力下降

但这是**未来扩展**，不在当前方案范围内。

---

## 十一、游戏性总结

### 玩家获得的新决策维度

1. **铸币所建造时机**：什么时候建？建几个？
2. **铸币所拆除时机**：通胀严重时是否拆除？
3. **税率与货币量的联动**：高税率回收货币 vs 低税率释放货币
4. **补贴与货币量的联动**：补贴注入货币 vs 减少补贴回收货币
5. **生产扩张与货币量的联动**：扩大生产降低物价 vs 减少生产提高物价

### 玩家感受到的经济深度

- 看到"货币总量"和"物价指数"的变化，理解宏观经济
- 看到"通胀"/"通缩"的状态指示，感受经济周期
- 通过铸币政策影响经济，获得"央行行长"的体验
- 在通胀和通缩之间寻找平衡，增加策略深度

### 与 P 社游戏的对标

- **Victoria 3**：有完整的货币量和通胀/通缩系统，但过于复杂
- **本方案**：保留核心体验（货币量 → 通胀/通缩 → 经济效果），但大幅简化实现
- **关键差异**：V3 的货币量影响所有价格和工资；本方案通过"偏离系数"间接影响，更温和、更可控

---

## 十二、关键设计决策总结

| 决策 | V1 选择 | V2 选择 | 理由 |
|------|---------|---------|------|
| 核心方法 | 推翻 void，建筑库存 | 保留 void，追踪+叠加 | 零破坏性，渐进式 |
| 铸币所定位 | 唯一货币来源 | 额外可控注入源 | 避免死锁 |
| 库存系统 | 建筑类型级库存 | 不需要（Phase 4 用 productionSources） | 避免性能问题 |
| 价格系统 | 新的 calculateAskPrice | 复用现有 updateMarketPrices + 乘数 | 避免两套价格 |
| 工资支付 | owner→worker 直连 | 同 V1 | 改动最小 |
| Epoch 0 | 以物易物 | 不做特殊处理 | 避免新子系统 |
| 消费侧守恒 | 核心改动 | 可选的 Phase 4 | 降低风险 |
| 性能 | 逐笔购买 + 批量结算 | 不需要（Phase 4 用 tradeBuffer） | 零性能损耗 |
| 贸易适配 | 未提及 | Phase 4 简单追加 | 最小改动 |
| 银币产出建筑 | 未提及 | Phase 0-3 不变，Phase 4 可选改为国库转移 | 渐进式 |
