# 「货币量」改革方案 V3 终稿 —— 商人中介模式

> 基于 V2 方案的渐进式思路，结合"商人替代 void 市场"核心理念。
> 核心设计：**商人作为市场中介，所有市场交易通过商人结算，实现真正的货币守恒**。
> 铸币所→国库→税收/补贴分配货币的链条，让玩家控制货币供给。
>
> 本文为 V3 终稿，已整合全部 6 项 Review 修订。

---

## 〇、设计哲学

### V2 → V3 的核心转变

V2 方案的思路是"保留 void，追踪货币量，用偏离系数驱动宏观效果"——本质上是**观测**货币量。

V3 方案的思路是"用商人替代 void，实现真正的货币守恒"——本质上是**控制**货币量。

| 维度 | V2 | V3 终稿 |
|------|----|----|
| void 交易 | 保留，追踪 | 大部分替换为商人中介 |
| 货币守恒 | 观测但不强制 | **真正守恒**（除铸币所和资本外逃） |
| 商人角色 | 不变（阶层+owner+贸易商） | **纯中介**（完全剥离 owner 身份） |
| 货币来源 | void 创造 + 铸币所额外注入 | **铸币所是唯一来源**（无例外） |
| 安全阀 | 不需要 | **无安全阀**（经济停摆是有意义的游戏状态） |
| 财富衰减 | 保留 | **删除**（商人中介已实现自然平衡） |
| 改动量 | ~80 行（Phase 0） | ~300 行（Phase 0+1 合并） |
| 游戏性 | 铸币政策 + 宏观效果 | 铸币政策 + 宏观效果 + 商人经济 |
| 价格传导 | 偏离系数直接乘价格 | **商人流动性系数→自然传导** |

### 核心设计原则

1. **商人 = 市场**：商人的 wealth 就是"市场中流通的货币"，`res` 就是"商人持有的库存"
2. **铸币所 = 印钞机**：唯一的货币创造来源（void→state），无例外
3. **国库 = 央行**：通过补贴商人控制市场流动性
4. **工资直连**：owner→worker，不经过市场
5. **无安全阀**：流动性不足时按预算比例支付，不从 void 创造货币
6. **商人无 owner 身份**：商人只通过岗位建筑获得人口，类似士兵依赖兵营

---

## 一、国内市场 = 商人的库存（关键概念层）

### 1.1 当前系统中的"国内市场"

当前游戏采用**抽象市场模型**，`res` 对象是一个"无主公共池"：

```
               ┌─────────────────┐
               │   抽象市场 (res) │
               │  food: 245      │
               │  wood: 180      │
               │  stone: 90      │
               │  ...            │
               └────────┬────────┘
                   ↑    ↓
        ┌──────────┴────┴──────────┐
        │                          │
   建筑生产 ──→ res[r] += amount   res[r] -= consumed ←── 阶层消费
        │                          │
    卖出收银币(void→owner)    购买付银币(stratum→void)
```

关键代码路径：
- **生产入库**：`sellProduction()` 中 `res[resource] = (res[resource] || 0) + amount`
- **消费出库**：阶层消费时 `res[resource] = available - amount`
- **建筑 input**：`res[resKey] = available - consumed`
- **军队维护**：`res[resource] = available - consumed`
- **价格计算**：`inventoryStock = resources[resource] || 0`（用 `res` 库存计算库存天数→价格）

这个 `res` 公共池**没有所有者**——资源凭空出现在市场中，消费者凭空从市场取走资源。银币的流动（void→owner、stratum→void）与实物的流动（res 增减）是**完全脱钩**的。

### 1.2 V3 的核心转变：`res` = 商人的库存

在 V3 中，`res` 公共池在概念上变为**商人持有的库存**：

```
               ┌─────────────────────────┐
               │   商人库存 (res)         │
               │   = 国内市场的实物资源    │
               │   food: 245              │
               │   wood: 180              │
               │   ...                    │
               ├─────────────────────────┤
               │   商人钱包 (wealth.merchant)│
               │   = 市场中流通的货币      │
               │   silver: 3200           │
               └────────────┬─────────────┘
                   ↑        ↓
        ┌──────────┴────────┴──────────┐
        │                              │
   建筑生产 ──→ res[r] += amount       res[r] -= consumed ←── 阶层消费
        │                              │
    商人付钱给owner              消费者付钱给商人
    (merchant→owner)             (stratum→merchant)
```

**关键洞察**：`res` 对象的增减操作**完全不需要改动**！

- 生产时 `res[resource] += amount` → 商品进入商人库存（不变）
- 消费时 `res[resource] -= consumed` → 商品从商人库存取走（不变）
- 价格计算用 `res[resource]` 作为库存 → 商人库存决定价格（不变）

**唯一改变的是银币流向**：
- 生产收入：`void→owner` 改为 `merchant→owner`（商人付钱买货）
- 消费支出：`stratum→void` 改为 `stratum→merchant`（消费者付钱给商人）
- 生产成本：`owner→void` 改为 `owner→merchant`（业主付钱买原材料）

### 1.3 这意味着什么

1. **代码改动极小**：所有 `res[resource]` 的增减操作保持不变，只改 `ledger.transfer` 的 from/to
2. **价格系统零改动**：价格仍然基于 `res` 库存计算，而 `res` 现在就是商人库存
3. **供需系统零改动**：supply/demand 的计算完全不受影响
4. **贸易系统自然兼容**：商人进口的资源进入 `res`（= 商人库存），出口从 `res` 取走
5. **叙事一致性**：商人作为中间商，持有所有市场上的实物资源，用银币与生产者和消费者结算

### 1.4 商人的双重资产

V3 中商人同时拥有两类资产：

| 资产类型 | 存储位置 | 语义 | 用途 |
|---------|---------|------|------|
| **银币**（流动性） | `wealth.merchant` | 市场中流通的货币 | 支付生产者收入、接收消费者付款 |
| **实物库存** | `res` 对象 | 国内市场的所有实物资源 | 供消费者购买、供建筑 input 消耗 |

> **经济学类比**：商人就像一个大型批发市场的运营商。
> 他持有所有商品的库存（`res`），也持有用于结算的现金（`wealth.merchant`）。
> 生产者把商品卖给他（商品进入 `res`，银币从 `wealth.merchant` 流出）。
> 消费者从他那里买商品（商品从 `res` 取走，银币流入 `wealth.merchant`）。

### 1.5 商人的有效流动性

商人的 `wealth.merchant` 同时承载阶层财富、贸易资本和市场流动性。计算流动性时须扣除不可用部分：

```javascript
// src/logic/economy/monetary.js

/**
 * 计算商人的有效流动性（可用于国内市场结算的资金）
 */
export function getEffectiveMerchantLiquidity(
    merchantWealth, 
    lockedCapital = 0, 
    merchantPopulation = 0, 
    merchantPerCapitaExpense = 0
) {
    // 1. 扣除贸易在途资本（已被锁定，不可用于国内结算）
    const afterTradeLock = merchantWealth - lockedCapital;
    
    // 2. 扣除预估的商人自身消费需求（预留 3 天的消费缓冲）
    const consumptionReserve = merchantPopulation * merchantPerCapitaExpense * 3;
    
    // 3. 有效流动性 = 总财富 - 锁定资本 - 消费预留
    return Math.max(0, afterTradeLock - consumptionReserve);
}
```

### 1.6 对现有系统的影响总结

| 系统 | 影响 | 说明 |
|------|------|------|
| `res` 增减操作 | **零改动** | 所有 `res[r] += / -=` 保持不变 |
| 价格计算 | **零改动** | 仍用 `res[r]` 作为库存天数的分子 |
| 供需追踪 | **零改动** | supply/demand 计算不变 |
| `ledger.transfer` | **改 from/to** | void→merchant 或 merchant→void |
| 贸易系统 | **零改动** | 进出口仍操作 `res` |
| UI 显示 | **概念更新** | "国内市场"面板可标注为"商人库存" |

---

## 二、现有 void 交易的完整替换映射

### 2.1 当前 15 处 void 交易清单

| # | 代码位置 | 方向 | 语义 | V3 处理 |
|---|---------|------|------|---------|
| 1 | L1565 | void→owner | 银币产出直接给 owner | **删除**：所有建筑不再产出银币 |
| 2 | L1605 | void→owner | 可贸易资源卖出收入 | **merchant→owner**：商人付钱给生产者 |
| 3 | L2966 | owner→void | 建筑生产成本（input 消耗） | **owner→merchant**：业主从商人买原材料 |
| 4 | L3193 | owner→void | 业主支付工资（扣款端） | **owner→role 直连**：合并为一步 |
| 5 | L3219 | void→worker | 工人收到工资（入账端） | **合并到 #4**：owner→role 直连 |
| 6 | L3327 | void→owner | 银币按等级分配给 owner | **删除**：同 #1 |
| 7 | L3969 | stratum→void | 阶层消费支出 | **stratum→merchant**：消费者付钱给商人 |
| 8 | L4254 | stratum→void | 阶层支付建筑建造费 | **stratum→merchant**：建材从商人买 |
| 9 | L4459 | official→void | 官员购买资源 | **official→merchant**：官员从商人买 |
| 10 | L4639 | void→state | 国企利润入国库 | **merchant→state**：国企产出卖给商人 |
| 11 | L4644 | void→official | 国企管理费给官员 | **merchant→official**：同上 |
| 12 | L4652 | void→official | 官员产业收入 | **merchant→official**：官员产业卖给商人 |
| 13 | L5537 | ~~stratum→void~~ | ~~富裕性挥霍~~ | **删除**：V3 中移除整个 wealthDecay 代码块 |
| 14 | L5625 | stratum→void | 资本外逃 | **保留 void**：政治效果，不是交易 |
| 15 | L8182 | owner→void | 建筑建造/升级成本 | **owner→merchant**：建材从商人买 |

### 2.2 替换分类汇总

| 类型 | 数量 | 说明 |
|------|------|------|
| →merchant / merchant→ 替换 | 10 处 | #2,#3,#7,#8,#9,#10,#11,#12,#15 |
| 合并为直连 | 2 处 | #4, #5 (工资) |
| 删除 | 3 处 | #1, #6 (银币产出), #13 (富裕性挥霍) |
| 保留 void | 1 处 | #14 (资本外逃) |

---

## 三、商人角色重新定义

### 3.1 当前商人的三重身份

```
商人（当前）
├── 阶层身份：有人口、wealth、消费需求、满意度
├── 建筑 owner：trading_post, market, harbor, dockyard, trade_port 等 10 个建筑
└── 贸易商：进出口系统的执行者（trading.js）
```

### 3.2 V3 中商人的新定位

```
商人（V3 终稿）
├── 阶层身份：保留（人口、wealth、消费需求、满意度）
├── 市场中介：所有市场交易通过商人 wealth 结算（✅ 新增核心角色）
├── 贸易商：保留（进出口系统）
└── 建筑 owner：❌ 完全剥离
    └── 人口来源：由含 merchant jobs 的建筑提供岗位
```

### 3.3 建筑 owner 重分配

当前 10 个 `owner: 'merchant'` 建筑需要重新分配 owner：

| 建筑 | 当前 owner | 新 owner | 理由 |
|------|-----------|----------|------|
| `trading_post` (贸易站) | merchant | **peasant** | 早期建筑，由部落农民经营物资交换 |
| `market` (市场) | merchant | **无 owner** | 改造为纯商人岗位建筑（见 §3.5） |
| `harbor` (港口) | merchant | **无 owner** | 改造为纯商人岗位建筑（见 §3.5） |
| `navigator_school` (航海学院) | merchant | **删除建筑** | 功能冗余，岗位并入其他建筑 |
| `coffee_house` (咖啡馆) | merchant | **artisan** | 文化场所，工匠经营 |
| `dockyard` (船坞) | merchant | **navigator** | 造船业归水手阶层，移除商人岗位 |
| `trade_port` (贸易港) | merchant | **无 owner** | 改造为纯商人岗位建筑（见 §3.5） |
| `coffee_plantation` (咖啡种植园) | merchant | **landowner** | 种植园归地主 |
| `cotton_plantation` (棉花种植园) | merchant | **landowner** | 种植园归地主 |
| `rubber_plantation` (橡胶园) | merchant | **capitalist** | 工业种植园归资本家 |

### 3.4 商人消费的特殊处理

商人作为市场中介，其消费行为有特殊性：

- **商人消费不走 stratum→merchant 路径**（不能自己付钱给自己）
- **商人消费直接扣减 wealth**，等价于"从自己的库存中取用"
- 这在代码中表现为：消费环节检测到 `key === 'merchant'` 时，跳过 merchant 中介，直接扣减 wealth

```javascript
// 消费环节的特殊处理
if (key === 'merchant') {
    // 商人消费：直接扣减 wealth（从自己库存取用）
    ledger.transfer('merchant', 'void', totalCost, expenseCat, expenseCat, { ... });
} else {
    // 其他阶层消费：付钱给商人
    ledger.transfer(key, 'merchant', totalCost, expenseCat, expenseCat, { ... });
}
```

> **经济学解释**：商人作为中间商，消费自己经手的商品时不需要"付钱给自己"。
> 这等价于商人的消费是一种"库存损耗"，从市场流动性中直接扣除。

### 3.5 商人岗位建筑线

将现有商业/金融/贸易建筑改造为**纯商人岗位建筑**，加上 3 个新建筑填补时代空缺。这些建筑类似兵营提供军事容量——只为商人提供岗位。

**核心原则**：
1. 这些建筑的 jobs **只有 merchant**（移除 worker/scribe/navigator 等）
2. 无 owner（国家公共设施，产出归 state 或无产出）
3. 不产出银币（铸币所唯一来源原则）
4. 少量 culture/science 产出（体现商业活动带来的知识文化交流）
5. 需要少量 input 维护（防止无限建造）

#### 已有建筑改造

| 建筑 | 时代 | 原配置 | 新配置 | 说明 |
|------|------|--------|--------|------|
| **market** (市场) | 1 | jobs: {merchant:3, worker:1}, owner:merchant, input:{brick:0.1}, output:{food:4} | **jobs: {merchant:5}**, 无 owner, input:{brick:0.1}, output:{culture:0.5} | 去掉 worker 和 food 产出，变为纯商人岗位 |
| **harbor** (港口) | 1 | jobs: {merchant:2, worker:2}, owner:merchant, input:{plank:0.2}, output:{silver:1.2} | **jobs: {merchant:4}**, 无 owner, input:{plank:0.1}, output:{culture:0.5} | 去掉 worker 和 silver 产出，成为港口商业区 |
| **trade_port** (贸易港) | 4 | jobs: {merchant:4, worker:6}, owner:merchant, input:{spice:0.35}, output:{food:12, silver:2} | **jobs: {merchant:8}**, 无 owner, input:{spice:0.2}, output:{culture:1} | 去掉 worker、food、silver 产出 |
| **stock_exchange** (证券交易所) | 6 | jobs: {scribe:21, capitalist:2}, owner:capitalist, input:{papyrus:0.49, coffee:0.37}, output:{silver:12.27, culture:1.23} | **jobs: {merchant:15}**, 无 owner, input:{papyrus:0.3, coffee:0.2}, output:{culture:3, science:1} | scribe/capitalist 全改为 merchant |
| **internet_platform** (互联网平台) | 9 | jobs: {scientist:8, scribe:14, capitalist:1}, owner:capitalist, input:{software:0.18, electricity:0.51}, output:{silver:15, culture:1.28} | **jobs: {merchant:18}**, 无 owner, input:{software:0.15, electricity:0.4}, output:{culture:4, science:2} | 全改为商人岗位 |
| **financial_center** (金融中心) | 9 | jobs: {scribe:21, capitalist:2}, owner:capitalist, input:{software:0.18, electricity:0.51}, output:{silver:20} | **jobs: {merchant:20}**, 无 owner, input:{software:0.15, electricity:0.4}, output:{culture:3, science:2} | 全改为商人岗位 |

#### 新增建筑（填补时代空缺）

| 时代 | 建筑 | merchant 岗位 | baseCost | input | output | 解锁科技 |
|------|------|-------------|----------|-------|--------|---------|
| Epoch 3 | **merchant_guild** (商会) | **6** | {plank:120, brick:60} | {papyrus:0.05} | {culture:1} | guild_charter |
| Epoch 7 | **trading_company** (贸易公司) | **10** | {silver:2000, steel:10} | {electricity:0.2, papyrus:0.1} | {culture:2, science:1} | joint_stock_company |
| Epoch 8 | **logistics_hub** (物流中心) | **14** | {silver:4000, steel:20, electronics:5} | {electricity:0.4} | {culture:2, science:2} | supply_chain_management |

#### 微调

- `coffee_house`：商人岗位从 1 增至 **3**，jobs 改为 {merchant:3, scribe:3}，保留 artisan owner
- `dockyard`：移除商人岗位，jobs 改为 {navigator:4, worker:2}，owner 改为 navigator
- `navigator_school`：**删除**，功能与 dockyard 重叠

#### 各时代商人岗位上限一览

假设玩家建满该时代可用的商人建筑：

| 时代 | 可用商人建筑 | 单建筑商人岗位 | 预估合理建造数 | 商人总岗位 |
|------|-------------|--------------|-------------|----------|
| Epoch 0 | trading_post | 2 | 2-3 座 | 4-6 |
| Epoch 1 | +market, harbor | 5, 4 | 各 1-2 座 | 13-24 |
| Epoch 3 | +merchant_guild | 6 | 1-2 座 | 19-36 |
| Epoch 4 | +trade_port | 8 | 1-2 座 | 27-52 |
| Epoch 5 | +coffee_house(3) | 3 | 2-3 座 | 33-61 |
| Epoch 6 | +stock_exchange | 15 | 1 座 | 48-76 |
| Epoch 7 | +trading_company | 10 | 1-2 座 | 58-96 |
| Epoch 8 | +logistics_hub | 14 | 1-2 座 | 72-124 |
| Epoch 9 | +internet_platform, financial_center | 18, 20 | 各 1 座 | 110-162 |

> 这个增长曲线与经济规模的增长大致匹配。Epoch 0 只需要几个商人就能中介小村庄经济，Epoch 9 需要 100+ 商人来中介信息时代的巨量交易。

### 3.6 商人的收入来源

商人没有 owner 收入，但有以下收入渠道：

1. **工资收入**：在商人岗位建筑中打工获得工资（owner→merchant 工资直连）
2. **市场中介净收益**：消费者付给商人的总额 - 商人付给生产者的总额 的差值留在 wealth.merchant 中
3. **贸易利润**：进出口贸易的价差利润

> **关键区别**：在旧系统中，商人作为 owner 获得建筑产出的"利润"。在 V3 中，商人不再获得建筑利润，但获得市场中介的"手续费"（隐含在买卖价差中）。

---

## 四、铸币所与货币创造

### 4.1 铸币建筑完整体系

| 时代 | 建筑 | 输入 | 产出 | maxCount | 解锁条件 |
|------|------|------|------|----------|---------|
| **Epoch 0 (石器)** | **原始铸币坊 (stone_mint)** | **无** | **silver: 0.5** | **2** | **无（初始可建）** |
| Epoch 1 (青铜) | 铸币所 (mint) | copper: 0.3, wood: 0.1 | silver: 2.0 | 3 | minting |
| Epoch 4 (探索) | 铸币厂 (royal_mint) | copper: 0.8, coal: 0.2 | silver: 8.0 | 2 | monetary_reform |
| Epoch 6 (蒸汽) | 中央银行 (central_bank) | papyrus: 0.3 | silver: 25.0 | 1 | central_banking |
| Epoch 8 (原子) | 联储体系 (federal_reserve) | electricity: 0.5 | silver: 80.0 | 1 | modern_monetary |

设计原则：
- 铸币建筑**无 owner**，产出的 silver 通过 `void→state` 进入国库
- 后期数量更少但产出更高，体现"货币发行权集中化"
- 输入从实物（铜）→纸张→电力，体现商品货币→信用货币的演变
- 各时代铸币建筑**可共存**，但 maxCount 限制总量

### 4.2 铸币所的特殊处理

铸币所是**唯一**允许从 void 创造银币的建筑：

```javascript
// sellProduction 中的特殊处理
if (resource === 'silver' && amount > 0) {
    if (isMintBuilding(currentBuildingId)) {
        // 铸币所：void→state（唯一的货币创造）
        ledger.transfer('void', 'state', amount, 
            TRANSACTION_CATEGORIES.INCOME.MINT_OUTPUT, 
            TRANSACTION_CATEGORIES.INCOME.MINT_OUTPUT, 
            { buildingId: currentBuildingId });
        stateBuildingSilverOutput += amount;
    }
    // 其他建筑不再产出银币（已在 Phase 1 中移除）
    return;
}
```

### 4.3 所有建筑移除银币产出 + 补偿

**所有建筑的 silver 产出一律移除，无例外。** 包括金融类建筑（stock_exchange、financial_center、data_center）。

| 建筑 | 原 silver 产出 | 补偿方案 | 补偿理由 |
|------|--------------|---------|---------|
| `trading_post` | 1.6 | food: 4→6 (+2) | 贸易站带来更多物资 |
| `magistrate_office` | 0.6 | science: 0→0.4 | 行政效率提升科研 |
| `harbor` | 1.2 | 改造为纯商人岗位建筑 | 港口吸引人口聚居 |
| `church` | 1.6 | culture: 8→12 (+4) | 教堂核心价值就是文化影响力 |
| `trade_port` | 2.0 | 改造为纯商人岗位建筑 | 贸易港带来更多海外物资 |
| `rail_depot` | 12.0 | maxPop: 21→35 (+14) | 铁路枢纽是城市化引擎 |
| `opera_house` | 2.86 | culture: 10→16 (+6) | 歌剧院的核心价值是文化 |
| `stock_exchange` | 12.27 | 改造为纯商人岗位建筑 | 金融中心促进信息流通和文化交流 |
| `distillery` | 2.4 | ale: 16.2→20 (+3.8) | 酒厂核心价值是酒，不是钱 |
| `high_rise_apartment` | 1.0 | maxPop: 120→125 (+5) | 高层公寓的价值就是住人 |
| `data_center` | 18.0 | science: 2→10 (+8), culture: 0→3 | 数据中心是信息时代科研核心 |
| `internet_platform` | 15.0 | 改造为纯商人岗位建筑 | 互联网平台传播文化和知识 |
| `financial_center` | 20.0 | 改造为纯商人岗位建筑 | 金融中心推动知识经济 |

> **注意**：补偿数值需要在实际测试中微调。核心原则是：移除银币后，建筑的**总经济价值**（产出资源的市场价值总和）应大致等于移除前。

### 4.4 货币流入商人的路径

**不需要专门的注资机制**，商人通过三条自然路径获得货币：

```
路径 1：消费回流（主要）
  各阶层消费 → stratum→merchant → 商人 wealth 增加
  这是商人获得货币的主要渠道

路径 2：生产成本回流
  业主购买原材料 → owner→merchant → 商人 wealth 增加

路径 3：玩家补贴（应急）
  国库 → state→merchant → 商人 wealth 增加
  通过现有的补贴系统（负营业税）实现
```

> **设计理念**：在正常经济循环中，商人通过路径 1 和 2 自然获得货币，
> 不需要玩家干预。只有在经济危机（商人流动性严重不足）时，
> 玩家才需要通过路径 3 主动干预。

---

## 五、完整资金流模型

### 5.1 资金流图（银币 + 实物双视角）

**银币流向**（ledger.transfer 改动的部分）：
```
┌─────────────────────────────────────────────────────────────────┐
│                        货币创造层                                │
│  ┌──────────┐     void→state      ┌──────────┐                 │
│  │  铸币所   │ ──────────────────→ │   国库   │                 │
│  │ (唯一源)  │    铸造银币          │ res.silver│                 │
│  └──────────┘                     └────┬─────┘                 │
│                                        │                        │
│                          ┌─────────────┼─────────────┐          │
│                          │ state→merchant│ state→role  │          │
│                          │   补贴        │  薪俸/军饷  │          │
│                          ▼              ▼             │          │
│  ┌───────────────────────────────────────────────────┐│          │
│  │                   流通层                           ││          │
│  │                                                   ││          │
│  │  ┌──────────┐  merchant→owner  ┌──────────┐      ││          │
│  │  │  商人    │ ───────────────→ │ 建筑 owner│      ││          │
│  │  │ (市场)   │  购买产出         │ (生产者)  │      ││          │
│  │  │          │ ←─────────────── │          │      ││          │
│  │  │          │  owner→merchant  │          │      ││          │
│  │  │          │  购买原材料       └────┬─────┘      ││          │
│  │  │          │                       │             ││          │
│  │  │          │  stratum→merchant     │ owner→role  ││          │
│  │  │          │ ←──────────────┐      │  工资直连   ││          │
│  │  │          │               │      ▼             ││          │
│  │  └──────────┘          ┌────┴─────────────┐      ││          │
│  │                        │  各阶层 (消费者)  │      ││          │
│  │                        │  peasant/worker/  │      ││          │
│  │                        │  artisan/...      │      ││          │
│  │                        └──────────────────┘      ││          │
│  └───────────────────────────────────────────────────┘│          │
│                                                       │          │
│                          ┌────────────────────────────┘          │
│                          │                                       │
│  ┌───────────────────────▼───────────────────────────┐          │
│  │                   回收层                           │          │
│  │  各阶层 → state (税收)                             │          │
│  │  stratum → void (资本外逃，唯一保留的 void 交易)    │          │
│  └───────────────────────────────────────────────────┘          │
└─────────────────────────────────────────────────────────────────┘
```

**实物流向**（`res` 对象操作，完全不变）：
```
┌─────────────────────────────────────────────────────────────────┐
│                                                                  │
│  建筑生产                    商人库存 (res)                       │
│  ┌──────────┐               ┌──────────────────┐                │
│  │ 农田     │──res[food]+=→│  food: 245       │                │
│  │ 矿场     │──res[stone]+=→│  wood: 180       │                │
│  │ 工坊     │──res[tools]+=→│  stone: 90       │                │
│  └──────────┘               │  tools: 45       │                │
│                              │  ...             │                │
│                              └───────┬──────────┘                │
│                                      │                           │
│                    ┌─────────────────┼─────────────────┐         │
│                    ▼                 ▼                 ▼         │
│              阶层消费           建筑 input          军队维护      │
│           res[food]-=10     res[copper]-=5      res[food]-=8    │
│           res[cloth]-=3     res[wood]-=3        res[iron]-=2    │
│                                                                  │
│  ※ 以上所有 res 操作与当前系统完全一致，零改动                    │
│  ※ 唯一改变的是伴随这些操作的 ledger.transfer 的 from/to          │
└─────────────────────────────────────────────────────────────────┘
```

### 5.2 货币守恒方程

在任意时刻 t，系统中的货币总量 M 满足：

```
M(t) = Σ wealth[stratum] + res.silver（国库）

dM/dt = 铸币所产出 - 资本外逃

其中：
- 铸币所产出 = void→state（唯一的货币创造）
- 资本外逃 = Σ stratum→void（CAPITAL_FLIGHT）
```

所有其他交易都是**守恒转移**（A→B），不改变 M 的总量。

### 5.3 典型的一日经济循环

以 Epoch 1（人口约 30）为例：

```
1. 铸币所铸币：void→state +6.0 银币
2. 国库通过税收/补贴/薪俸分配货币：
   - 官员薪俸：state→official +3 银币
   - 商人补贴（如有）：state→merchant +2 银币
3. 建筑生产：
   - 农田产出 food → sellProduction → merchant→peasant +15 银币
   - 矿场产出 stone → sellProduction → merchant→miner +10 银币
   - 工坊产出 tools → sellProduction → merchant→artisan +20 银币
4. 生产成本：
   - 工坊消耗 copper → owner→merchant +5 银币
5. 工资支付：
   - 农田 owner→peasant +8 银币（直连，不经过商人）
   - 矿场 owner→miner +6 银币
6. 消费：
   - 农民买 food → peasant→merchant +12 银币
   - 矿工买 food → miner→merchant +10 银币
   - 工匠买 food → artisan→merchant +15 银币
7. 税收：
   - 各阶层→state +8 银币

净效果：
- 商人 wealth 变化 ≈ (消费收入 + 生产成本收入 + 补贴) - (产出支出) ≈ 平衡
- 国库变化 ≈ 铸币 + 税收 - 补贴 - 薪俸
- 货币总量变化 ≈ 铸币 - 资本外逃 = +6.0 - 0 = +6.0 银币/日（无衰减）
```

---

## 六、Phase 0 —— 基础设施改造（~70 行，低风险）

### 6.1 目标

完成所有基础设施准备：ledger 扩展、工资直连、货币量追踪。

### 6.2 Ledger 扩展

在 `src/logic/economy/ledger.js` 中新增：

```javascript
// EconomyLedger constructor 中新增
this.monetaryStats = {
    created: 0,      // 本 tick 从 void 创造的银币总量
    destroyed: 0,    // 本 tick 销毁到 void 的银币总量
    netCreation: 0,  // 净创造量 = created - destroyed
    transferred: 0,  // 本 tick 守恒转移的银币总量（不含 void）
    merchantInflow: 0,  // 本 tick 流入商人的总额
    merchantOutflow: 0, // 本 tick 流出商人的总额
};

// transfer() 方法中新增追踪
if (from === 'void' && to !== 'void') {
    this.monetaryStats.created += amount;
}
if (to === 'void' && from !== 'void') {
    this.monetaryStats.destroyed += amount;
}
if (from !== 'void' && to !== 'void') {
    this.monetaryStats.transferred += amount;
}
if (to === 'merchant' && from !== 'void') {
    this.monetaryStats.merchantInflow += amount;
}
if (from === 'merchant' && to !== 'void') {
    this.monetaryStats.merchantOutflow += amount;
}
```

### 6.3 新增交易类别

```javascript
// TRANSACTION_CATEGORIES 新增
INCOME: {
    // ... 现有 ...
    MINT_OUTPUT: 'mintOutput',           // 铸币所产出
    MARKET_SALE: 'marketSale',           // 卖出产出给商人
},
EXPENSE: {
    // ... 现有 ...
    MARKET_PURCHASE: 'marketPurchase',   // 从商人购买
}
```

### 6.4 工资直连

将工资支付从 `owner→void→role` 改为 `owner→role`：

**当前代码**（simulation.js L3193, L3219）：
```javascript
// L3193: 业主扣款到 void
ledger.transfer(oKey, 'void', paid, WAGES_PAID, WAGES_PAID, { buildingId: b.id });

// L3219: 从 void 发放给工人
ledger.transfer('void', plan.role, payout, WAGE, WAGE, { buildingId: b.id });
```

**改为**：
```javascript
// 直连发放：owner→role 一步完成
ledger.transfer(plan.ownerKey, plan.role, payout, WAGE, WAGE, { buildingId: b.id });
```

> **实现细节**：当前系统中 `ownerPaidRatio` 的计算逻辑保持不变。
> owner 的总扣款仍然是 `paid`（= min(disposableWealth, ownerBill)），
> worker 的总收款仍然是 `Σ(actualSlotWage × filled)`，
> 两者通过 ratio 保持一致。只是把两步 transfer 合并为一步。

### 6.5 货币总量计算

在 simulation.js 的 return 之前：

```javascript
// 货币总量 M = Σ(各阶层 wealth) + 国库银币
const moneySupply = totalWealth + (res.silver || 0);

const monetaryStats = {
    moneySupply,
    created: ledger.monetaryStats.created,
    destroyed: ledger.monetaryStats.destroyed,
    netCreation: ledger.monetaryStats.created - ledger.monetaryStats.destroyed,
    transferred: ledger.monetaryStats.transferred,
    merchantWealth: classWealthResult.merchant || 0,
    merchantInflow: ledger.monetaryStats.merchantInflow,
    merchantOutflow: ledger.monetaryStats.merchantOutflow,
    velocity: moneySupply > 0 
        ? ledger.monetaryStats.transferred / moneySupply 
        : 0,
};
```

### 6.6 改动清单

| 文件 | 改动 | 行数 |
|------|------|------|
| `src/logic/economy/ledger.js` | monetaryStats 追踪 + 新交易类别 | ~30 行 |
| `src/logic/simulation.js` | 工资直连 | ~20 行 |
| `src/logic/simulation.js` | 货币总量计算 + return 扩展 | ~20 行 |

**总计：~70 行，低风险，可立即实施。**

---

## 七、Phase 1 —— 商人中介化（~300 行，中风险）

### 7.1 目标

将 15 处 void 交易中的 10 处替换为商人中介，实现真正的货币守恒。

### 7.2 预算制：解决产出顺序问题

为防止"先卖出的建筑吃肉、后卖出的喝汤"，在 tick 开始时预计算预算比例：

```javascript
// tick 开始时：预估本 tick 总产出价值
let estimatedTotalOutputValue = 0;
// ... 遍历所有建筑估算产出 ...

// 计算预算比例（使用有效流动性，扣除 lockedCapital 和消费预留）
const effectiveLiquidity = getEffectiveMerchantLiquidity(
    wealth.merchant, lockedCapital, popStructure.merchant, prevMerchantExpense
);
const budgetRatio = estimatedTotalOutputValue > 0
    ? Math.min(1.0, effectiveLiquidity / estimatedTotalOutputValue)
    : 1.0;

// sellProduction 中使用 budgetRatio：每个建筑等比例获得收入，不存在顺序偏差
const actualPayment = grossIncome * budgetRatio;
```

### 7.3 sellProduction 改造（核心）

```javascript
const sellProduction = (resource, amount, ownerKey) => {
    // 铸币所银币产出：唯一的 void→state 创造
    if (resource === 'silver' && amount > 0) {
        if (isMintBuilding(currentBuildingId)) {
            ledger.transfer('void', 'state', amount, 
                TRANSACTION_CATEGORIES.INCOME.MINT_OUTPUT, 
                TRANSACTION_CATEGORIES.INCOME.MINT_OUTPUT, 
                { buildingId: currentBuildingId });
            stateBuildingSilverOutput += amount;
        }
        // 非铸币所的银币产出已在配置中移除
        return;
    }
    if (amount <= 0) return;
    res[resource] = (res[resource] || 0) + amount;
    
    if (isTradableResource(resource)) {
        supply[resource] = (supply[resource] || 0) + amount;
        const marketPrice = getPrice(resource);
        const grossIncome = marketPrice * amount;
        
        // 预算制：按比例支付（使用有效流动性确保不支出被锁定的资金）
        const actualPayment = grossIncome * budgetRatio;
        
        if (actualPayment > 0) {
            ledger.transfer('merchant', ownerKey, actualPayment, 
                TRANSACTION_CATEGORIES.INCOME.OWNER_REVENUE, 
                TRANSACTION_CATEGORIES.INCOME.OWNER_REVENUE, 
                { buildingId: currentBuildingId });
        }
        roleWagePayout[ownerKey] = (roleWagePayout[ownerKey] || 0) + actualPayment;
        
        // 差额不补——自然传导为通缩，玩家看到提示后会建铸币所或发补贴
        if (actualPayment < grossIncome) {
            merchantLiquidityShortfall += (grossIncome - actualPayment);
        }
        
        if (currentBuildingId && buildingFinancialData[currentBuildingId]) {
            buildingFinancialData[currentBuildingId].ownerRevenue += actualPayment;
        }
    }
};
```

> **注意**：Phase 3 引入流动性系数后，`grossIncome` 将改为 `effectivePrice * amount`（`effectivePrice = marketPrice * liquidityFactor`），其余逻辑不变。

### 7.4 其他改造点

| 改动 | 原代码（代码位置） | 新代码 |
|------|--------|--------|
| 生产成本 (#3) | `owner→void` (L2966) | `owner→merchant` |
| 消费支出 (#7) | `stratum→void` (L3969) | `stratum→merchant`（商人消费时 `merchant→void`） |
| 建筑建造费 (#8) | `stratum→void` (L4254) | `stratum→merchant` |
| 官员购买 (#9) | `official→void` (L4459) | `official→merchant` |
| 国企利润 (#10) | `void→state` (L4639) | `merchant→state`（按 merchantAvail 上限） |
| 国企管理费 (#11) | `void→official` (L4644) | `merchant→official` |
| 官员产业 (#12) | `void→official` (L4652) | `merchant→official` |
| 建造/升级 (#15) | `owner→void` (L8182) | `owner→merchant` |

### 7.5 移除富裕性挥霍（Wealth Decay）

V3 中不再需要"富裕性挥霍"机制。商人中介系统已实现货币的自然循环，财富不会无限积累。

| 文件 | 操作 | 说明 |
|------|------|------|
| `gameConstants.js` L17 | 删除 `WEALTH_DECAY_RATE = 0.005` | 常量定义 |
| `config/index.js` L5 | 移除 `WEALTH_DECAY_RATE` 导出 | 导出 |
| `simulation.js` L1 | 移除 `WEALTH_DECAY_RATE` 导入 | 导入 |
| `simulation.js` L5478-5543 | 删除整个 `wealthDecay` 代码块 | 核心逻辑（~70 行） |
| `EconomicDashboard.jsx` L32 | 删除 `decay: '富裕性挥霍'` | UI 标签 |
| `StratumDetailSheet.jsx` L1460, L1569 | 移除 decay 相关的支出追踪和显示 | UI 显示 |

> **注意**：移除富裕性挥霍后，`TRANSACTION_CATEGORIES.EXPENSE.DECAY` 也可以移除，但为了向后兼容（旧存档的 ledger 记录），建议保留该分类常量但不再使用。

### 7.6 建筑配置变更清单

| 文件 | 改动 | 行数 |
|------|------|------|
| `src/logic/simulation.js` | sellProduction 改造（含预算制） | ~50 行 |
| `src/logic/simulation.js` | 10 处 void→merchant 替换 | ~50 行 |
| `src/logic/simulation.js` | 移除富裕性挥霍代码块 | ~-70 行 |
| `src/config/buildings.js` | 10 个建筑 owner 迁移 | ~20 行 |
| `src/config/buildings.js` | 移除所有建筑银币产出 + 补偿 | ~50 行 |
| `src/config/buildings.js` | 6 个建筑改造为商人岗位建筑 | ~40 行 |
| `src/config/buildings.js` | 删除 navigator_school，新增 3 个商人建筑 | ~60 行 |
| `src/config/buildings.js` | dockyard 移除商人岗位 | ~5 行 |
| `src/config/gameConstants.js` | 移除 WEALTH_DECAY_RATE | ~-1 行 |
| UI 文件 | 移除 decay 相关显示 | ~-6 行 |

**总计：~300 行（净增），中风险。**

---

## 八、Phase 2 —— 铸币所体系（~150 行，低风险）

### 8.1 铸币建筑配置

`stone_mint`（Epoch 0）配置示例：

```javascript
// src/config/buildings.js 新增
{
    id: 'stone_mint',
    name: "原始铸币坊",
    desc: "用石头打磨贝壳和天然金属碎片，制作最原始的交换媒介。产量极低。",
    baseCost: { stone: 30, wood: 20 },
    input: {},                    // 无消耗——原始铸币就是捡贝壳磨石头
    output: { silver: 0.5 },     // 极低产出：每日 0.5 银币
    jobs: { peasant: 2 },        // 农民兼职
    // 无 owner → 产出归 state
    epoch: 0,
    cat: 'civic',
    maxCount: 2,                  // 最多 2 座（日产 1.0 银币）
    visual: { icon: 'Shell', color: 'bg-stone-600', text: 'text-stone-200' },
    tags: ['civic', 'monetary'],
}
```

### 8.2 新增科技（7 个）

| 科技 | 时代 | 前置科技 | 解锁建筑 | cost |
|------|------|---------|---------|------|
| `minting` 铸币术 | 1 | - | mint | {science:60, culture:20} |
| `monetary_reform` 货币改革 | 4 | minting | royal_mint | {science:350, culture:120} |
| `central_banking` 中央银行制度 | 6 | monetary_reform | central_bank | {science:1000, culture:350} |
| `modern_monetary` 现代货币理论 | 8 | central_banking | federal_reserve | {science:3500} |
| `guild_charter` 行会特许状 | 3 | caravan_trade | merchant_guild | {science:200, culture:80} |
| `joint_stock_company` 股份公司 | 7 | financial_capitalism | trading_company | {science:1500, culture:500} |
| `supply_chain_management` 供应链管理 | 8 | joint_stock_company | logistics_hub | {science:3000} |

### 8.3 Epoch 0 的处理

有了 `stone_mint`，Epoch 0 走正常流程，**不再依赖高 startingWealth 或安全阀**：

```
Epoch 0 典型场景（人口 5-10）：
- 2 座 stone_mint，日产 1.0 银币
- 日产出支付需求 ~15-30 银币（商人要付给生产者）
- 日消费回流 ~10-20 银币（消费者付给商人）
- 商人日净流出 ~5-10 银币

商人初始储备 500 银币可维持 ~50-100 天；
1.0 银币/日的铸币进入国库 → 通过税收/补贴回流经济 → 部分最终流入商人
加上消费回流，商人 wealth 会趋于动态平衡。

如果仍有缺口：玩家需要主动给商人发补贴或建更多 stone_mint。
```

货币政策面板叙事：
```
🐚 原始货币时代

你的部落使用贝壳和天然金属碎片作为交换媒介。
原始铸币坊能缓慢增加这些"货币"的供给。

建造更多原始铸币坊以增加货币供给，
或研究「铸币术」进入标准化货币时代。

当前市场流动性: 1,245 银币
```

### 8.4 改动清单

| 文件 | 改动 | 行数 |
|------|------|------|
| `src/config/buildings.js` | 5 个铸币建筑（stone_mint + 4 个） | ~100 行 |
| `src/config/technologies.js` | 7 个科技 | ~70 行 |
| `src/config/strata.js` | 商人 startingWealth 改为 500 | ~5 行 |

**总计：~175 行，低风险。**

---

## 九、Phase 3 —— 基于商人流动性的价格传导（~100 行，中风险）

### 9.1 核心思想

**商人手里有多少钱，直接决定他愿意出多少钱买货。**

- 商人钱多 → 溢价收购 → 生产者收入增加 → 工资上涨 → 消费增加 → 物价上涨（通胀）
- 商人钱少 → 折价收购 → 生产者收入减少 → 工资下降 → 消费减少 → 物价下降（通缩）

### 9.2 有效流动性计算

见 §1.5（`getEffectiveMerchantLiquidity`）——扣除 lockedCapital 和商人消费预留后的可用资金。

### 9.3 流动性系数

```javascript
// src/logic/economy/monetary.js
export function getMerchantLiquidityFactor(
    merchantWealth, 
    dailyTurnover, 
    lockedCapital = 0,
    merchantPopulation = 0,
    merchantPerCapitaExpense = 0
) {
    if (dailyTurnover <= 0) return 1.0;
    
    const effectiveLiquidity = getEffectiveMerchantLiquidity(
        merchantWealth, lockedCapital, merchantPopulation, merchantPerCapitaExpense
    );
    
    const coverageDays = effectiveLiquidity / dailyTurnover;
    const TARGET_COVERAGE_DAYS = 5.0; // ⚠️ 需调参
    const coverageRatio = coverageDays / TARGET_COVERAGE_DAYS;
    
    if (coverageRatio >= 1.0) {
        // 货币充裕：轻微溢价，使用对数增长防止无限膨胀
        return Math.min(1.5, 1.0 + Math.log(coverageRatio) * 0.18);
    } else {
        // 货币紧张：折价收购，使用平方根曲线
        return Math.max(0.3, Math.sqrt(coverageRatio));
    }
}
```

**调用处**（sellProduction 中）：
```javascript
const liquidityFactor = getMerchantLiquidityFactor(
    wealth.merchant || 0,
    previousDailyTurnover,
    currentLockedCapital,              // 从 pendingTrades 累加
    popStructure.merchant || 0,
    previousMerchantPerCapitaExpense   // 上一 tick 的人均消费
);
const effectivePrice = marketPrice * liquidityFactor;
```

### 9.4 价格传导路径

```
商人货币量变化
    │
    ├──→ ① sellProduction 中的实际支付价格（liquidityFactor × marketPrice）
    │       → 生产者收入变化
    │
    ├──→ ② 成本价计算
    │       生产者收入变化 → 利润变化 → 成本价信号变化
    │       → 下一 tick 的市场价格自然调整
    │
    ├──→ ③ 工资传导
    │       生产者利润变化 → 工资信号变化 → 工资调整
    │       → 消费能力变化 → 消费量变化
    │
    └──→ ④ 库存传导
            消费量变化 → 库存天数变化 → 库存价格系数变化
            → 市场价格进一步调整
```

**关键特性：逐步传导，而非瞬时生效**（5-15 tick），不会出现突然的价格跳变。

### 9.5 通胀/通缩状态

| 货币状态 | 流动性系数 | 覆盖天数 | 玩家感知 | 游戏效果 |
|---------|-----------|---------|---------|---------|
| 严重通缩 | < 0.5 | < 1天 | 🔵 "市场萧条" | 生产者收入大减，工资暴跌 |
| 轻度通缩 | 0.5-0.85 | 1-3天 | 🔵 "市场偏冷" | 价格逐渐下降，经济放缓 |
| 正常 | 0.85-1.15 | 3-7天 | ⚪ "市场稳定" | 无额外效果 |
| 轻度通胀 | 1.15-1.35 | 7-15天 | 🟡 "市场过热" | 价格逐渐上涨，经济过热 |
| 严重通胀 | > 1.35 | > 15天 | 🔴 "通货膨胀" | 价格飞涨，需要紧缩政策 |

### 9.6 ⚠️ 需要深度研究的问题

#### 问题 1：流动性系数的曲线形状

当前使用 `log` 和 `sqrt` 曲线，但最优曲线可能不同：

```
候选曲线对比（coverageRatio → liquidityFactor）：

方案 A（当前）：sqrt + log
  0.1 → 0.32,  0.5 → 0.71,  1.0 → 1.00,  3.0 → 1.20,  10.0 → 1.41

方案 B：线性 + clamp
  0.1 → 0.30,  0.5 → 0.60,  1.0 → 1.00,  3.0 → 1.30,  10.0 → 1.50

方案 C：sigmoid
  0.1 → 0.35,  0.5 → 0.65,  1.0 → 1.00,  3.0 → 1.25,  10.0 → 1.45

方案 D：分段线性（不同斜率）
  0.1 → 0.40,  0.5 → 0.75,  1.0 → 1.00,  3.0 → 1.15,  10.0 → 1.30
```

需要通过模拟测试确定哪种曲线在不同经济规模下表现最稳定。

#### 问题 2：TARGET_COVERAGE_DAYS 的最优值

- 太低（如 2 天）→ 商人容易进入紧缩状态，经济波动大
- 太高（如 10 天）→ 商人需要大量货币才能正常运转，铸币压力大

需要根据不同时代的经济规模进行校准，可能需要随时代动态调整。

#### 问题 3：传导速度与经济稳定性

价格传导速度取决于价格平滑系数（当前 0.05-0.2）、工资平滑系数、消费对收入的响应速度。
- 传导太快 → 经济剧烈震荡
- 传导太慢 → 玩家感受不到货币政策的效果

#### 问题 4：与现有价格系统的交互

当前价格系统已有多层调节（库存天数、供需权重、成本底线等）：
- 流动性紧缩 + 库存不足 → 双重价格信号冲突？
- 流动性宽裕 + 库存过剩 → 价格信号抵消？

#### 问题 5：大规模经济下的数值稳定性

后期经济日交易量可能达到 10 万+ 银币，商人 wealth 需要维持在 50 万+。
这些大数值下，流动性系数的微小变化可能导致巨大的绝对金额波动。

> ⚠️ **重要提示**：Phase 3 的公式设计需要深度研究。
> 建议在实施前先用电子表格或简单脚本模拟不同参数下的经济行为。

---

## 十、Phase 4 —— 货币政策面板（~300 行，低风险，纯 UI）

### 10.1 面板设计

```
┌─────────────────────────────────────────────────────────────┐
│  💰 货币政策                                                 │
│                                                              │
│  ┌─ 货币概览 ─────────────────────────────────────────────┐ │
│  │ 货币总量 (M):     12,450 银币                          │ │
│  │ 商人流动性:       3,200 银币 (覆盖 4.2 天) ✅          │ │
│  │ 流通速度 (V):     0.34                                 │ │
│  │ 物价指数 (P):     1.12 (▲ +12%)                       │ │
│  │ 货币状态:         🟡 轻度通胀                          │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌─ 货币流量 ─────────────────────────────────────────────┐ │
│  │ 铸币所产出:       +6.0 /日                             │ │
│  │ 商人→生产者:      -340 /日 (产出收入)                  │ │
│  │ 消费者→商人:      +285 /日 (消费支出)                  │ │
│  │ 生产者→商人:      +45 /日 (原材料购买)                 │ │
│  │ ────────────────────────────────────                   │ │
│  │ 商人净流量:       -10 /日 (消费回流不足时可补贴)       │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  💡 如需向商人注入资金，可在税收面板中将商人的营业税率设为负值。 │
│                                                              │
│  ┌─ 铸币设施 ─────────────────────────────────────────────┐ │
│  │ 铸币所 ×2/3     产出: 4.0 silver/日                    │ │
│  │ [建造] [拆除]                                          │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌─ 历史趋势 (最近 30 天) ────────────────────────────────┐ │
│  │ [M 总量] [商人流动性] [物价指数] [流动性系数]            │ │
│  │ ╭──────────────────────────────╮                       │ │
│  │ │    ╱╲    ╱╲                  │                       │ │
│  │ │   ╱  ╲  ╱  ╲   ╱╲          │                       │ │
│  │ └──────────────────────────────╯                       │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### 10.2 智能建议系统

```javascript
function getMonetaryAdvice(monetaryStats) {
    const { liquidityFactor, merchantWealth, dailyTurnover, merchantLiquidityShortfall } = monetaryStats;
    const coverageDays = dailyTurnover > 0 ? merchantWealth / dailyTurnover : Infinity;
    
    // 优先级 0：流动性缺口（无安全阀，直接提示）
    if (merchantLiquidityShortfall > 0) {
        return {
            level: 'danger',
            icon: '🚨',
            text: '市场流动性不足！生产者无法获得足额收入。建议：立即给商人发补贴（负营业税），或建造铸币所。',
        };
    }
    
    // 优先级 1：流动性危机（覆盖不足 1 天）
    if (coverageDays < 1) {
        return {
            level: 'danger',
            icon: '🚨',
            text: '市场流动性严重不足！商人资金即将耗尽。建议：立即给商人发补贴，或建造铸币所。',
        };
    }
    
    // 优先级 2：严重通胀（流动性系数 > 1.35）
    if (liquidityFactor > 1.35) {
        return {
            level: 'danger',
            icon: '🔴',
            text: '严重通胀！物价飞涨，民众不满。建议：减少铸币所、提高税率、停止商人补贴、扩大生产。',
        };
    }
    
    // 优先级 3：严重通缩（流动性系数 < 0.5）
    if (liquidityFactor < 0.5) {
        return {
            level: 'danger',
            icon: '🔵',
            text: '严重通缩！经济萎缩。建议：增建铸币所、降低税率、给商人发补贴。',
        };
    }
    
    // 优先级 4：轻度通胀
    if (liquidityFactor > 1.15) {
        return {
            level: 'warning',
            icon: '🟡',
            text: '通胀压力较大。建议：适当减少铸币或提高税率。',
        };
    }
    
    // 优先级 5：轻度通缩
    if (liquidityFactor < 0.85) {
        return {
            level: 'warning',
            icon: '🔵',
            text: '货币偏紧。建议：适当增加铸币或降低税率。',
        };
    }
    
    return {
        level: 'normal',
        icon: '✅',
        text: '货币供给稳定，经济运行正常。',
    };
}
```

### 10.3 历史数据追踪

```javascript
// useGameState.js 中新增
monetaryHistory: [],

// 每 tick 更新
if (newState.monetaryStats) {
    const history = [...(state.monetaryHistory || []), {
        tick: state.tick,
        moneySupply: newState.monetaryStats.moneySupply,
        merchantWealth: newState.monetaryStats.merchantWealth,
        liquidityFactor: newState.monetaryStats.liquidityFactor,
        shortfall: newState.monetaryStats.merchantLiquidityShortfall || 0,
    }];
    if (history.length > 30) history.shift(); // 保留最近 30 天
    newState.monetaryHistory = history;
}
```

### 10.4 改动清单

| 文件 | 改动 | 行数 |
|------|------|------|
| `src/components/panels/MonetaryPanel.jsx` | 新文件：货币政策面板 | ~200 行 |
| `src/hooks/useGameState.js` | 历史数据追踪 | ~15 行 |
| `src/hooks/useGameActions.js` | 补贴操作引导 | ~20 行 |
| `src/components/tabs/` | 新增货币政策 tab | ~15 行 |

**总计：~250 行，纯 UI，零风险。**

---

## 十一、与现有系统的兼容性

### 11.1 贸易系统兼容（零改动）

贸易系统（trading.js）**完全不受影响**，因为它已经完全基于 `wealth.merchant` 和 `res` 运作。

| 贸易操作 | 当前代码 | V3 影响 | 说明 |
|---------|---------|---------|------|
| 出口取资源 | `res[r] -= amount` | **零改动** | 从商人库存取走，语义一致 |
| 出口收款 | `wealth.merchant += revenue` | **零改动** | 外汇流入商人，增加市场流动性 |
| 进口付款 | `merchant→void` | **零改动** | 货币流出国境，减少市场流动性 |
| 进口入库 | `res[r] += amount` | **零改动** | 资源进入商人库存，语义一致 |
| 关税 | `merchant→state` | **零改动** | 已经是商人付给国库 |
| 贸易利润 | `wealth.merchant += profit` | **零改动** | 利润增加市场流动性 |
| 资本锁定 | `lockedCapital` | **零改动** | 商人贸易资本已从 wealth 中扣除 |

> **关键洞察**：贸易系统已经完全基于 `wealth.merchant` 运作，与 V3 的商人中介模型天然兼容。

**贸易对商人流动性的影响**：
- **出口**：商人库存减少（res 下降），但银币增加（wealth 上升）→ 流动性改善
- **进口**：商人库存增加（res 上升），但银币减少（wealth 下降）→ 流动性恶化
- **贸易顺差**：出口 > 进口 → 商人流动性改善 → 国内经济宽松
- **贸易逆差**：进口 > 出口 → 商人流动性恶化 → 国内经济紧缩

这个机制自然地将国际贸易与国内货币政策联系起来，增加了游戏深度。

### 11.2 外交系统兼容（未来扩展）

货币量指标可以作为外交系统的输入：
- 通胀严重 → 外交信誉下降（货币贬值，外国不信任）
- 通缩严重 → 贸易吸引力下降（国内需求不足）

### 11.3 战争系统兼容

战争对商人 wealth 的影响：
- 战时贸易中断 → 商人贸易收入减少 → 但市场中介功能不受影响
- 建筑被摧毁 → 产出减少 → 商人支出（productionPayment）减少 → 流动性自然平衡

### 11.4 存档兼容

| 字段 | 旧存档处理 |
|------|-----------|
| monetaryStats | 新增字段，旧存档默认为空 |
| monetaryHistory | 新增字段，旧存档为空数组 |
| merchant.startingWealth | 旧存档中商人 wealth 不变，新游戏使用 500 |
| 建筑 owner 变更 | 旧存档中已建建筑的 owner 不变，新建建筑使用新 owner |
| 新建筑（stone_mint 等） | 旧存档中不存在，不影响运行 |

---

## 十二、关键参数汇总

### 12.1 参数表

| 参数 | 值 | 位置 | 说明 |
|------|-----|------|------|
| merchant.startingWealth | **500** | strata.js | 有 stone_mint 后不需要更高 |
| WEALTH_DECAY_RATE | **删除** | ~~gameConstants.js~~ | 移除富裕性挥霍 |
| 安全阀 void→merchant | **无** | - | 不允许紧急货币创造 |
| TARGET_COVERAGE_DAYS | 5.0 | monetary.js | 商人目标覆盖天数（⚠️ 需调参） |
| stone_mint.output.silver | 0.5 | buildings.js | Epoch 0 铸币 |
| stone_mint.maxCount | 2 | buildings.js | 日产上限 1.0 |
| mint.output.silver | 2.0 | buildings.js | Epoch 1 铸币 |
| mint.maxCount | 3 | buildings.js | 日产上限 6.0 |
| 所有建筑 silver 产出 | **全部移除** | buildings.js | 铸币所唯一来源，无例外 |

### 12.2 铸币所产出量的校准

| 时代 | 典型人口 | 典型日经济流量 | 铸币所总产出（满配） | 日净增长 |
|------|---------|--------------|---------------------|--------|
| Epoch 0 | 5-10 | 15-50 | 1.0 (2×0.5) | +1.0 |
| Epoch 1 | 15-50 | 50-200 | 6.0 (3×2.0) | +6.0 |
| Epoch 4 | 200-900 | 2000-8000 | 16.0 (2×8.0) | +16.0 |
| Epoch 6 | 1000-4500 | 15000-60000 | 25.0 (1×25.0) | +25.0 |
| Epoch 8 | 5000-14000 | 80000-300000 | 80.0 (1×80.0) | +80.0 |

> **注意**：铸币所产出的银币进入国库，通过税收、补贴、官员薪俸等渠道流入各阶层，
> 再通过消费回流到商人。铸币量的调控是玩家的核心决策之一。

---

## 十三、完整实施路线图

```
Phase 0 (低风险, ~70行)           Phase 1 (中风险, ~300行)
┌──────────────────────┐         ┌──────────────────────────┐
│ ✅ ledger 追踪        │         │ ⚠️ sellProduction（预算制）│
│ ✅ 工资直连           │   →     │ ⚠️ 10处 void→merchant     │
│ ✅ M 总量计算         │         │ ⚠️ 建筑改造+owner迁移     │
│ ✅ 新交易类别         │         │ ⚠️ 移除银币产出+补偿      │
└──────────────────────┘         │ ⚠️ 移除富裕性挥霍         │
                                  └────────────┬─────────────┘
                                               │
Phase 2 (低风险, ~175行)          Phase 3 (中风险, ~100行)
┌──────────────────────────┐     ┌──────────────────────────┐
│ ✅ stone_mint + 4 铸币所  │ →   │ ⚠️ 有效流动性计算         │
│ ✅ 7 个科技              │     │ ⚠️ 流动性系数             │
│ ✅ 3 个商人岗位新建筑    │     │ ⚠️ 需要深度调参           │
└──────────────────────────┘     └──────────────────────────┘
                                               │
                                  Phase 4 (低风险, ~300行, 纯UI)
                                  ┌──────────────────────────┐
                                  │ ✅ 货币政策面板            │
                                  │ ✅ 智能建议系统            │
                                  │ ✅ 历史趋势图表            │
                                  │ ✅ 补贴操作引导            │
                                  │ ✅ 通胀/通缩指示器         │
                                  └──────────────────────────┘
```

### 各 Phase 的独立价值

| Phase | 独立价值 | 可以单独发布？ | 依赖 |
|-------|---------|--------------|------|
| Phase 0 | 工资直连 + 货币量追踪 | ✅ 是 | 无 |
| Phase 1 | 商人中介 + 货币守恒 | ⚠️ 需要 Phase 0 | Phase 0 |
| Phase 2 | 铸币所体系 | ⚠️ 需要 Phase 1 | Phase 0+1 |
| Phase 3 | 商人流动性价格传导 | ⚠️ 需要 Phase 1，需深度调参 | Phase 0+1 |
| Phase 4 | 货币政策面板 | ⚠️ 需要 Phase 0 | Phase 0 |

> **注意**：Phase 3 和 Phase 4 可以与 Phase 1+2 并行开发。
> Phase 1 和 Phase 2 紧密耦合，建议一起实施。

---

## 十四、与 V2 方案的关键差异

| 决策 | V2 | V3 终稿 | 理由 |
|------|----|----|------|
| void 交易 | 保留，追踪 | 替换为商人中介 | 真正的货币守恒 |
| 货币来源 | void + 铸币所 | 仅铸币所（无例外） | 完全可控 |
| 商人角色 | 不变（阶层+owner+贸易商） | 纯中介（完全剥离 owner） | 避免身份冲突 |
| 银币产出建筑 | 保留 | 全部移除（补偿实物） | 铸币所唯一来源 |
| 消费侧守恒 | Phase 4（可选） | Phase 1（核心） | 从一开始就守恒 |
| 财富衰减 | 保留 | **删除** | 商人中介已实现自然平衡 |
| 注资机制 | 不需要 | **不需要**（用补贴替代） | 减少新概念 |
| 价格传导 | 偏离系数直接乘价格 | **商人流动性系数→自然传导** | 更真实、更渐进 |
| 安全阀 | 不需要 | **无安全阀** | 经济停摆是有意义的游戏状态 |
| 改动量 | ~80行（Phase 0） | ~300行（Phase 0+1） | 稍多但更彻底 |
| 风险 | 极低 | 中等 | 需要充分测试 |

---

## 十五、风险评估与缓解

### 15.1 最大风险：商人流动性不足

**无安全阀**——这是设计决定，不是风险漏洞。

**缓解措施**：
1. 预算制确保等比例分配，不会有建筑因顺序问题得不到收入
2. 铸币所从 Epoch 0 就有（stone_mint）
3. 玩家补贴机制（负营业税）
4. UI 中的流动性监控 + 智能建议

经济停摆是**有意义的游戏状态**——玩家需要学会管理货币供给。

### 15.2 次要风险：建筑 owner 迁移导致经济失衡

**缓解措施**：
1. 旧存档中已建建筑的 owner 不变
2. 逐个建筑审视，确保新 owner 合理
3. 充分测试各时代的经济平衡

### 15.3 次要风险：移除银币产出导致早期经济困难

**缓解措施**：
1. 用等价的实物资源产出补偿，保持建筑的经济价值
2. stone_mint 从 Epoch 0 即可建造
3. 补偿原则：移除银币后，建筑的**总经济价值**（产出资源的市场价值总和）应大致等于移除前

### 15.4 次要风险：商人岗位不足

**缓解措施**：
每个时代都有对应的商人建筑，增长曲线与经济规模大致匹配（Epoch 0 约 4-6 人，Epoch 9 约 110-162 人）。

### 15.5 测试策略

| 测试场景 | 关注点 |
|---------|--------|
| Epoch 0 新游戏 | stone_mint + startingWealth=500 是否足够？ |
| Epoch 0→1 过渡 | 铸币所建造后经济是否加速？ |
| Epoch 1 稳态 | 商人 wealth 是否稳定？budgetRatio 是否 ≈ 1.0？ |
| 快速扩张 | 大量建筑建造时流动性是否充足？ |
| 战争时期 | 建筑被摧毁后经济是否恢复？ |
| 后期经济 | Epoch 6+ 的大规模经济是否稳定？ |
| 极端通胀 | 建 3 个铸币所 + 低税率 + 给商人发补贴 |
| 极端通缩 | 0 个铸币所 + 高税率 |

---

## 十六、游戏性总结

### 核心游戏循环

```
铸币所铸币 → 国库通过税收/补贴/薪俸分配货币 → 各阶层消费付钱给商人 → 
商人付钱给生产者 → 生产者发工资 → 工人消费付钱给商人 → 循环继续

如果铸币不足 → 商人流动性下降 → 预算比例下降 → 生产者收入减少 → 通缩
如果铸币过多 → 货币总量膨胀 → 物价上涨 → 通胀

玩家的任务：通过铸币政策和税收政策，维持经济的健康运转。
```

### 玩家获得的新决策维度

1. **铸币所建造**：什么时候建？建几个？用什么时代的？
2. **补贴策略**：什么时候给商人发补贴？发多少？
3. **税率与货币量联动**：高税率回收货币 vs 低税率释放货币
4. **贸易与货币量联动**：出口赚外汇（增加流动性） vs 进口消耗流动性
5. **生产扩张与货币量联动**：扩大生产降低物价 vs 减少生产提高物价
6. **商人岗位建筑**：建多少市场/商会/交易所来支撑商人人口？
7. **战争与货币量联动**：战时经济紧缩 vs 和平时期繁荣

### 与 P 社游戏的对标

- **Victoria 3**：有完整的货币量和通胀/通缩系统，但过于复杂
- **本方案**：保留核心体验（铸币→分配→流通→回收），大幅简化实现
- **独特之处**：商人作为市场中介的设计，比抽象"市场账户"更有叙事感——玩家能直观感受到"商人的口袋里有多少钱决定了整个经济的活跃度"

