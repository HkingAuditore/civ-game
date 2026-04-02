# 「货币量」改革方案 V3 —— 商人中介模式

> 基于 V2 方案的渐进式思路，结合用户提出的"商人替代 void 市场"核心理念。
> 核心设计：**商人作为市场中介，所有市场交易通过商人结算，实现真正的货币守恒**。
> 铸币所→国库→税收/补贴分配货币的链条，让玩家控制货币供给。

---

## 〇、设计哲学

### V2 → V3 的核心转变

V2 方案的思路是"保留 void，追踪货币量，用偏离系数驱动宏观效果"——本质上是**观测**货币量。

V3 方案的思路是"用商人替代 void，实现真正的货币守恒"——本质上是**控制**货币量。

| 维度 | V2 | V3 |
|------|----|----|
| void 交易 | 保留，追踪 | 大部分替换为商人中介 |
| 货币守恒 | 观测但不强制 | 真正守恒（除铸币所和衰减） |
| 商人角色 | 不变（阶层+owner+贸易商） | **纯中介**（剥离 owner 身份） |
| 货币来源 | void 创造 + 铸币所额外注入 | **铸币所是唯一来源** |
| 改动量 | ~80 行（Phase 0） | ~300 行（Phase 0+1 合并） |
| 游戏性 | 铸币政策 + 宏观效果 | 铸币政策 + 宏观效果 + 商人经济 |

### 核心设计原则

1. **商人 = 市场**：商人的 wealth 就是"市场中流通的货币"，商人的库存就是"国内市场的资源库存"
2. **铸币所 = 印钞机**：唯一的货币创造来源（void→state）
3. **国库 = 央行**：通过补贴商人控制市场流动性
4. **工资直连**：owner→worker，不经过市场
5. **安全阀**：商人资金不足时有降级处理，防止经济停摆

---

## 〇.5、国内市场 = 商人的库存（关键概念层）

### 当前系统中的"国内市场"

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

### V3 的核心转变：`res` = 商人的库存

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

### 这意味着什么

1. **代码改动极小**：所有 `res[resource]` 的增减操作保持不变，只改 `ledger.transfer` 的 from/to
2. **价格系统零改动**：价格仍然基于 `res` 库存计算，而 `res` 现在就是商人库存
3. **供需系统零改动**：supply/demand 的计算完全不受影响
4. **贸易系统自然兼容**：商人进口的资源进入 `res`（= 商人库存），出口从 `res` 取走
5. **叙事一致性**：商人作为中间商，持有所有市场上的实物资源，用银币与生产者和消费者结算

### 商人的双重资产

V3 中商人同时拥有两类资产：

| 资产类型 | 存储位置 | 语义 | 用途 |
|---------|---------|------|------|
| **银币**（流动性） | `wealth.merchant` | 市场中流通的货币 | 支付生产者收入、接收消费者付款 |
| **实物库存** | `res` 对象 | 国内市场的所有实物资源 | 供消费者购买、供建筑 input 消耗 |

> **经济学类比**：商人就像一个大型批发市场的运营商。
> 他持有所有商品的库存（`res`），也持有用于结算的现金（`wealth.merchant`）。
> 生产者把商品卖给他（商品进入 `res`，银币从 `wealth.merchant` 流出）。
> 消费者从他那里买商品（商品从 `res` 取走，银币流入 `wealth.merchant`）。

### 对现有系统的影响总结

| 系统 | 影响 | 说明 |
|------|------|------|
| `res` 增减操作 | **零改动** | 所有 `res[r] += / -=` 保持不变 |
| 价格计算 | **零改动** | 仍用 `res[r]` 作为库存天数的分子 |
| 供需追踪 | **零改动** | supply/demand 计算不变 |
| `ledger.transfer` | **改 from/to** | void→merchant 或 merchant→void |
| 贸易系统 | **零改动** | 进出口仍操作 `res` |
| UI 显示 | **概念更新** | "国内市场"面板可标注为"商人库存" |

---

## 一、现有 void 交易的完整替换映射

### 1.1 当前 15 处 void 交易清单

| # | 代码位置 | 方向 | 语义 | V3 处理 |
|---|---------|------|------|---------|
| 1 | L1565 | void→owner | 银币产出直接给 owner | **删除**：除铸币所外不再有银币产出建筑 |
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

### 1.2 替换分类汇总

| 类型 | 数量 | 说明 |
|------|------|------|
| void→merchant 替换 | 5 处 | #2, #10, #11, #12 (收入侧) |
| merchant→void 替换 | 5 处 | #3, #7, #8, #9, #15 (支出侧) |
| 合并为直连 | 2 处 | #4, #5 (工资) |
| 删除 | 3 处 | #1, #6 (银币产出), #13 (富裕性挥霍) |
| 保留 void | 1 处 | #14 (资本外逃) |

---

## 二、商人角色重新定义

### 2.1 当前商人的三重身份

```
商人（当前）
├── 阶层身份：有人口、wealth、消费需求、满意度
├── 建筑 owner：trading_post, market, harbor, dockyard, trade_port 等 10 个建筑
└── 贸易商：进出口系统的执行者（trading.js）
```

### 2.2 V3 中商人的新定位

```
商人（V3）
├── 阶层身份：保留（人口、消费需求、满意度）
├── 市场中介：所有市场交易通过商人 wealth 结算
├── 贸易商：保留（进出口系统）
└── 建筑 owner：剥离大部分，仅保留贸易类建筑
```

### 2.3 建筑 owner 迁移方案

当前 10 个 `owner: 'merchant'` 建筑需要重新分配 owner：

| 建筑 | 当前 owner | 新 owner | 理由 |
|------|-----------|----------|------|
| `trading_post` (贸易站) | merchant | **保留 merchant** | 核心贸易建筑 |
| `market` (市场) | merchant | **state** | 市场是公共设施，归国家管理 |
| `harbor` (港口) | merchant | **state** | 港口是公共基础设施 |
| `navigator_school` (航海学院) | merchant | **state** | 教育机构归国家 |
| `coffee_house` (咖啡馆) | merchant | **artisan** | 文化场所，工匠经营 |
| `dockyard` (船坞) | merchant | **navigator** | 造船业归水手阶层 |
| `trade_port` (贸易港) | merchant | **保留 merchant** | 核心贸易建筑 |
| `coffee_plantation` (咖啡种植园) | merchant | **landowner** | 种植园归地主 |
| `cotton_plantation` (棉花种植园) | merchant | **landowner** | 种植园归地主 |
| `rubber_plantation` (橡胶园) | merchant | **capitalist** | 工业种植园归资本家 |

**设计原则**：
- 贸易类建筑（trading_post, trade_port）保留 merchant owner
- 公共设施（market, harbor, navigator_school）改为 state
- 生产类建筑按产品类型分配给对应阶层
- 商人仍然在这些建筑中提供**岗位**（jobs 不变），只是不再是 owner

### 2.4 商人消费的特殊处理

商人作为市场中介，其消费行为有特殊性：

- **商人消费不走 stratum→merchant 路径**（不能自己付钱给自己）
- **商人消费直接扣减 wealth**，等价于"从自己的库存中取用"
- 这在代码中表现为：消费环节检测到 `key === 'merchant'` 时，跳过 merchant 中介，直接扣减 wealth

```javascript
// 消费环节的特殊处理
if (key === 'merchant') {
    // 商人消费：直接从自己库存取用物资，不涉及银币转移
    // 商人拥有的物资是他已经买了的（res 就是商人库存），
    // 消费时只需要扣减 res（已在上方完成），不需要额外的银币操作。
    // 在 ledger 中记录为内部消耗（merchant→merchant），仅用于审计追踪
    ledger.transfer('merchant', 'merchant', totalCost, expenseCat, expenseCat, { ... });
} else {
    // 其他阶层消费：付钱给商人
    ledger.transfer(key, 'merchant', totalCost, expenseCat, expenseCat, { ... });
}
```

> **经济学解释**：商人作为中间商，拥有的物资是他已经买了的（res 就是商人库存）。
> 消费时直接从库存取用，这个过程和银币没什么关系。
> 不使用 `merchant→void`，因为这会销毁货币，破坏守恒。
> 也不使用 `merchant→merchant`（自循环），因为实际上根本不需要银币操作。
> 只需要扣减 res（已在消费逻辑中自动完成）即可。
---

## 三、铸币所与货币注入机制

### 3.1 铸币所建筑设计

```javascript
// src/config/buildings.js 新增
{
    id: 'stone_mint',
    name: "原始铸币块",
    desc: "用石头和铜矿粗制货币。原始的铸币设施，产出少量银币。",
    baseCost: { stone: 30, wood: 20 },
    input: { stone: 0.2, wood: 0.1 },
    output: { silver: 1.0 },
    jobs: { worker: 2 },
    // 无 owner → 产出归 state
    epoch: 0,
    cat: 'civic',
    // 无 requiresTech，开局即可建造
    visual: { icon: 'Coins', color: 'bg-stone-700', text: 'text-stone-200' },
    tags: ['civic', 'monetary'],
}
```

```javascript
{
    id: 'mint',
    name: "铸币所",
    desc: "将铜锭熔铸为标准化铜钱。铸币所归国家所有，产出的银币直接进入国库。",
    baseCost: { stone: 60, wood: 40, copper: 15 },
    input: { copper: 0.3, wood: 0.1 },
    output: { silver: 2.0 },
    jobs: { official: 1, worker: 3 },
    // 无 owner → 产出归 state
    epoch: 1,
    cat: 'civic',
    requiresTech: 'minting',
    // 无 maxCount，玩家可以自由建造任意数量
    visual: { icon: 'Coins', color: 'bg-yellow-700', text: 'text-yellow-200' },
    tags: ['civic', 'monetary'],
}
```

### 3.2 铸币所的特殊处理

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

### 3.3 现有银币产出建筑的处理

当前有多个建筑产出 silver：

| 建筑 | 时代 | 当前 silver 产出 | V3 处理 |
|------|------|-----------------|--------|
| trading_post (贸易站) | E0 | 1.6 | **移除 silver**，增加 food 产出补偿（food: 4→6） |
| magistrate_office (官署) | E1 | 0.6 | **移除 silver**，增加 science: 0.3 产出补偿 |
| harbor (港口) | E1 | 1.2 | **移除 silver**，增加 maxPop: 3 补偿 |
| town_hall (市政厅) | E3 | 4.0 | **移除 silver**，增加 science: 1.5 产出补偿 |
| church (教堂) | E3 | 1.6 | **移除 silver**，增加 culture: 8→10 补偿 |
| trade_port (贸易港) | E4 | 2.0 | **移除 silver**，增加 food: 12→16 补偿 |
| distillery (蒸馏酒厂) | E5 | 2.40 | **移除 silver**，增加 ale: 16.20→20.00 补偿 |
| opera_house (歌剧院) | E5 | 2.8573 | **移除 silver**，增加 culture: 10→13 补偿 |
| rail_depot (铁路枢纽) | E6 | 12.0 | **移除 silver**，增加 maxPop: 21→30 补偿 |
| stock_exchange (证券交易所) | E6 | 12.2667 | **移除 silver**，增加 culture: 1.2267→6.0 补偿 |
| high_rise_apartment (高层公寓) | E8 | 1.0 | **移除 silver**，增加 maxPop: 120→125 补偿 |
| data_center (数据中心) | E9 | 18.0 | **移除 silver**，增加 science: 2.0→8.0 补偿 |
| internet_platform (互联网平台) | E9 | 15.0 | **移除 silver**，增加 culture: 1.2778→6.0 补偿 |
| financial_center (金融中心) | E9 | 20.0 | **移除 silver**，增加 science: 5.0（新增）补偿 |

> **共 14 个建筑需要移除 silver 产出**。补偿原则：
> - 贸易/商业建筑 → 补偿 food 或 maxPop（贸易带来的实物繁荣）
> - 行政/文化建筑 → 补偿 science 或 culture（行政/文化价值）
> - 工业建筑 → 补偿主产品产量（工业效率提升）
> - 金融建筑 → 补偿 science 或 culture（金融知识/影响力）
> - 补偿量按 silver 产出的等价市场价值估算
**设计原则**：
- 移除 silver 产出时，用等价的实物资源产出补偿，保持建筑的经济价值
- 补偿资源选择与建筑主题一致（贸易建筑补偿贸易品，行政建筑补偿 science）
- 铸币所成为唯一的银币来源，让货币供给完全可控

### 3.4 货币流入商人的路径：补贴机制

铸币所产出的银币进入国库后，**不需要专门的注资机制**。玩家可以通过现有的**补贴系统**向商人发放资金，这与向其他阶层发补贴的操作完全一致。

**为什么不需要单独的注资系统？**

1. **现有补贴系统已经足够**：游戏中已有 `state→stratum` 的补贴机制（负营业税），商人作为阶层可以直接接收补贴
2. **减少新概念**：玩家不需要学习“注资”这个新概念，用已有的补贴操作即可
3. **统一体验**：给商人发钱和给其他阶层发钱的操作完全一致，降低学习成本
4. **自然平衡**：商人通过市场交易自然获得货币（消费者付款），只有在流动性不足时才需要玩家主动补贴

**货币流入商人的三条自然路径**：

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

## 四、完整资金流模型

### 4.1 资金流图（银币 + 实物双视角）

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
│                          │   注资        │  薪俸/军饷  │          │
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
│  │  stratum → void (资本外逃)                         │          │
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

### 4.2 货币守恒方程

在任意时刻 t，系统中的货币总量 M 满足：

```
M(t) = Σ wealth[stratum] + res.silver (国库)

dM/dt = 铸币所产出 - 资本外逃

其中：
- 铸币所产出 = void→state（唯一的货币创造）
- 资本外逃 = Σ stratum→void（CAPITAL_FLIGHT）
```

所有其他交易都是**守恒转移**（A→B），不改变 M 的总量。

### 4.3 典型的一日经济循环

以 Epoch 1（人口 ~30）为例：

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

## 五、Phase 0 —— 基础设施改造（~200 行改动，低风险）

### 5.1 目标

完成所有基础设施准备：ledger 扩展、工资直连、货币量追踪。

### 5.2 Ledger 扩展

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
    
    // 商人资金流追踪
    if (to === 'merchant' && from !== 'void') {
        this.monetaryStats.merchantInflow += amount;
    }
    if (from === 'merchant' && to !== 'void') {
        this.monetaryStats.merchantOutflow += amount;
    }

    // ... 现有逻辑不变 ...
}
```

### 5.3 新增交易类别

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

### 5.4 工资直连

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
// L3193: 业主扣款（改为暂存，不转到 void）
// 删除此行，改为在下方直接从 owner 转给 worker

// L3219: 直连发放
ledger.transfer(plan.ownerKey, plan.role, payout, WAGE, WAGE, { buildingId: b.id });
```

> **实现细节**：当前系统中 `ownerPaidRatio` 的计算逻辑保持不变。
> owner 的总扣款仍然是 `paid`（= min(disposableWealth, ownerBill)），
> worker 的总收款仍然是 `Σ(actualSlotWage × filled)`，
> 两者通过 ratio 保持一致。只是把两步 transfer 合并为一步。

### 5.5 货币总量计算

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

### 5.6 改动清单

| 文件 | 改动 | 行数 |
|------|------|------|
| `src/logic/economy/ledger.js` | monetaryStats 追踪 + 新交易类别 | ~30 行 |
| `src/logic/simulation.js` | 工资直连 | ~20 行 |
| `src/logic/simulation.js` | 货币总量计算 + return 扩展 | ~20 行 |

**总计：~70 行，低风险，可立即实施。**

---

## 六、Phase 1 —— 商人中介化（~250 行改动，中风险）

### 6.1 目标

将 15 处 void 交易中的 9 处替换为商人中介，实现真正的货币守恒。

### 6.2 sellProduction 改造（#1, #2, #6）

这是最核心的改动。当前 `sellProduction()` 从 void 给 owner 钱：

```javascript
// 当前代码
ledger.transfer('void', ownerKey, netIncome, OWNER_REVENUE, OWNER_REVENUE, { ... });
```

**改为预算制（Budget System）**：

> **核心问题**：如果逐建筑顺序支付，先遍历到的建筑拿到全额，后面的建筑可能拿不到钱。
> **解决方案**：在 tick 开始时预估总产出价值，计算 `budgetRatio = min(1.0, merchantWealth / estimatedTotalOutputValue)`，所有建筑按同一比例获得收入。

```javascript
// === Phase 1: 预算制 ===
// 在 sellProduction 循环开始前，预估本 tick 总产出价值
let estimatedTotalOutputValue = 0;
for (const b of activeBuildings) {
    for (const [resource, amount] of Object.entries(b.effectiveOutput || {})) {
        if (resource === 'silver' || resource === 'maxPop' || resource === 'militaryCapacity') continue;
        if (isTradableResource(resource) && amount > 0) {
            estimatedTotalOutputValue += getPrice(resource) * amount;
        }
    }
}

// 预算比率：商人能支付的比例（0~1.0）
const budgetRatio = estimatedTotalOutputValue > 0
    ? Math.min(1.0, (wealth.merchant || 0) / estimatedTotalOutputValue)
    : 1.0;

// 记录本 tick 的流动性缺口
let merchantLiquidityShortfall = 0;
if (budgetRatio < 1.0) {
    merchantLiquidityShortfall = estimatedTotalOutputValue - (wealth.merchant || 0);
}

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
        
        // 价格管制逻辑保持不变...
        let effectivePrice = marketPrice;
        // ... (省略价格管制代码，保持不变) ...
        
        const grossIncome = effectivePrice * amount;
        
        // === V3 核心改动：预算制 ===
        // 所有建筑按同一 budgetRatio 获得收入，公平分配
        const actualPayment = grossIncome * budgetRatio;
        
        roleWagePayout[ownerKey] = (roleWagePayout[ownerKey] || 0) + actualPayment;
        
        if (actualPayment > 0) {
            ledger.transfer('merchant', ownerKey, actualPayment, 
                TRANSACTION_CATEGORIES.INCOME.OWNER_REVENUE, 
                TRANSACTION_CATEGORIES.INCOME.OWNER_REVENUE, 
                { buildingId: currentBuildingId });
        }
        
        if (currentBuildingId && buildingFinancialData[currentBuildingId]) {
            buildingFinancialData[currentBuildingId].ownerRevenue += actualPayment;
        }
    }
};
```

> **预算制的优势**：
> 1. **公平性**：所有建筑按同一比例获得收入，不受遍历顺序影响
> 2. **简洁性**：只需在循环前计算一次 budgetRatio，循环内逻辑简单
> 3. **自然传导**：budgetRatio < 1.0 时，所有生产者等比例减收 → 利润下降 → 工资下降 → 消费减少 → 经济自然减速
> 4. **无需安全阀**：商人钱不够时不会"停摆"，只是所有人少拿一点

### 6.3 生产成本改造（#3）

当前代码（L2966）：
```javascript
ledger.transfer(ownerKey, 'void', baseCost, PRODUCTION_COST, PRODUCTION_COST, { buildingId: b.id });
```

**改为**：
```javascript
// 业主购买原材料：付钱给商人
ledger.transfer(ownerKey, 'merchant', baseCost, PRODUCTION_COST, PRODUCTION_COST, { buildingId: b.id });
```

### 6.4 消费支出改造（#7）

当前代码（L3969）：
```javascript
ledger.transfer(key, 'void', totalCost, expenseCat, expenseCat, { ... });
```

**改为**：
```javascript
if (key === 'merchant') {
    // 商人消费：直接从自己库存取用物资，不涉及银币转移
    // 商人拥有的物资是他已经买了的（res 就是商人库存），
    // 消费时只需要扣减 res（已在上方完成），不需要额外的银币操作。
    // 在 ledger 中记录为内部消耗（merchant→merchant），仅用于审计追踪
    ledger.transfer('merchant', 'merchant', totalCost, expenseCat, expenseCat, { ... });
} else {
    // 其他阶层消费：付钱给商人
    ledger.transfer(key, 'merchant', totalCost, expenseCat, expenseCat, { ... });
}
```

### 6.5 阶层建筑建造费改造（#8）

当前代码（L4254）：
```javascript
ledger.transfer(stratum, 'void', amount, BUILDING_COST, BUILDING_COST);
```

**改为**：
```javascript
// 阶层购买建材：付钱给商人
ledger.transfer(stratum, 'merchant', amount, BUILDING_COST, BUILDING_COST);
```

### 6.6 官员购买资源改造（#9）

当前代码（L4459）：
```javascript
ledger.transfer('official', 'void', totalCost, expenseCat, expenseCat, { ... });
```

**改为**：
```javascript
// 官员购买资源：付钱给商人
ledger.transfer('official', 'merchant', totalCost, expenseCat, expenseCat, { ... });
```

### 6.7 国企/官员收入改造（#10, #11, #12）

当前代码（L4639, L4644, L4652）：
```javascript
ledger.transfer('void', 'state', treasuryIncome, OWNER_REVENUE, 'state_enterprise_profit');
ledger.transfer('void', 'official', managementFeeIncome, OWNER_REVENUE, 'MANAGEMENT_FEE');
ledger.transfer('void', 'official', totalPropertyIncome, OWNER_REVENUE, OWNER_REVENUE);
```

**改为**：
```javascript
// 国企产出卖给商人 → 商人付钱给国库/官员
// 同样使用预算制的 budgetRatio，确保公平分配
if (treasuryIncome > 0) {
    const actualTreasury = treasuryIncome * budgetRatio;
    if (actualTreasury > 0) {
        ledger.transfer('merchant', 'state', actualTreasury, OWNER_REVENUE, 'state_enterprise_profit');
    }
}
if (managementFeeIncome > 0) {
    const actualFee = managementFeeIncome * budgetRatio;
    if (actualFee > 0) {
        ledger.transfer('merchant', 'official', actualFee, OWNER_REVENUE, 'MANAGEMENT_FEE');
    }
}
// 官员产业收入同理
if (totalPropertyIncome > 0) {
    const actualProperty = totalPropertyIncome * budgetRatio;
    if (actualProperty > 0) {
        ledger.transfer('merchant', 'official', actualProperty, OWNER_REVENUE, OWNER_REVENUE);
    }
}
```

### 6.8 建筑建造/升级成本改造（#15）

当前代码（L8182）：
```javascript
ledger.transfer(ownerKey, 'void', totalSilverCost, BUILDING_COST, BUILDING_COST);
```

**改为**：
```javascript
// 建筑建造：业主购买建材，付钱给商人
ledger.transfer(ownerKey, 'merchant', totalSilverCost, BUILDING_COST, BUILDING_COST);
```

### 6.9 无安全阀设计（预算制自然兜底）

V3 **完全不需要安全阀**。预算制（budgetRatio）已经自然解决了商人 wealth 不足的问题：

- 当 `budgetRatio = 1.0` 时：商人资金充足，所有生产者获得全额收入
- 当 `budgetRatio = 0.7` 时：商人资金偏紧，所有生产者获得 70% 收入
- 当 `budgetRatio = 0.3` 时：商人资金严重不足，所有生产者仅获得 30% 收入
- 当 `budgetRatio = 0.0` 时：商人完全没钱，生产者零收入（经济停摆）

**经济停摆本身就是有意义的游戏状态**——它告诉玩家“你的钱不够用了，赶紧建铸币所或给商人发补贴”。

> **为什么不需要安全阀？**
> 1. 预算制已经保证了商人不会“透支”——它只花自己有的钱
> 2. 经济减速是自然的反馈信号，不应被人为掩盖
> 3. void 创造货币会破坏“铸币所是唯一货币来源”的核心承诺
> 4. 玩家需要感受到经济压力，才会主动调控货币政策

### 6.10 改动清单

| 文件 | 改动 | 行数 |
|------|------|------|
| `src/logic/simulation.js` | sellProduction 改造 | ~40 行 |
| `src/logic/simulation.js` | 生产成本 void→merchant | ~5 行 |
| `src/logic/simulation.js` | 消费支出 void→merchant | ~10 行 |
| `src/logic/simulation.js` | 阶层建筑费 void→merchant | ~5 行 |
| `src/logic/simulation.js` | 官员购买 void→merchant | ~5 行 |
| `src/logic/simulation.js` | 国企/官员收入 void→merchant | ~30 行 |
| `src/logic/simulation.js` | 建筑建造 void→merchant | ~5 行 |
| `src/logic/simulation.js` | 安全阀机制 | ~~已移除，用预算制替代~~ |
| `src/config/buildings.js` | owner 迁移（10 个建筑） | ~20 行 |
| `src/config/buildings.js` | 移除银币产出 + 补偿 | ~30 行 |
| `src/config/buildings.js` | 新增铸币所 | ~20 行 |
| `src/logic/simulation.js` | 移除富裕性挥霍代码块 | ~-70 行 |
| `src/config/gameConstants.js` | 移除 WEALTH_DECAY_RATE 常量 | ~-1 行 |
| `src/config/index.js` | 移除 WEALTH_DECAY_RATE 导出 | ~-1 行 |
| `src/components/modals/EconomicDashboard.jsx` | 移除 decay 显示标签 | ~-1 行 |
| `src/components/panels/StratumDetailSheet.jsx` | 移除富裕性挥霍支出显示 | ~-5 行 |

**总计：~200 行核心改动 + ~50 行配置改动 - ~78 行移除富裕性挥霍。**

### 6.11 移除富裕性挥霍（Wealth Decay）

V3 中不再需要“富裕性挥霍”机制。在商人中介系统下，货币的自然平衡通过市场交易实现，不需要人为的财富销毁。

**为什么可以去掉？**

1. **原来的作用**：防止财富无限积累，模拟“维护、服务、非商品消费”
2. **V3 中的替代**：商人中介系统已经实现了货币的自然循环——消费者付钱给商人，商人付钱给生产者，生产者发工资给工人，工人再消费。财富不会无限积累，因为它始终在流动。
3. **简化系统**：减少一个“凭空销毁货币”的机制，让货币守恒更干净

**具体移除步骤**：

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/config/gameConstants.js` L17 | 删除 `WEALTH_DECAY_RATE = 0.005` | 常量定义 |
| `src/config/index.js` L5 | 从导出中移除 `WEALTH_DECAY_RATE` | 导出 |
| `src/logic/simulation.js` L1 | 从导入中移除 `WEALTH_DECAY_RATE` | 导入 |
| `src/logic/simulation.js` L5478-5543 | 删除整个 `wealthDecay` 代码块 | 核心逻辑（~70 行） |
| `src/components/modals/EconomicDashboard.jsx` L32 | 删除 `decay: '富裕性挥霍'` | UI 标签 |
| `src/components/panels/StratumDetailSheet.jsx` L1460, L1569 | 移除 decay 相关的支出追踪和显示 | UI 显示 |

> **注意**：移除富裕性挥霍后，`TRANSACTION_CATEGORIES.EXPENSE.DECAY` 也可以移除，
> 但为了向后兼容（旧存档的 ledger 记录），建议保留该分类常量但不再使用。

---

## 七、Phase 2 —— 铸币所体系（~150 行改动，低风险）

### 7.1 时代演进的铸币建筑

| 时代 | 建筑 | 输入 | 产出 | 解锁科技 |
|------|------|------|------|----------|
| Epoch 0 (石器) | 原始铸币块 (stone_mint) | stone: 0.2, wood: 0.1 | silver: 1.0 | 无（开局解锁） |
| Epoch 1 (青铜) | 铸币所 (mint) | copper: 0.3, wood: 0.1 | silver: 2.0 | minting |
| Epoch 4 (探索) | 铸币厂 (royal_mint) | copper: 0.8, coal: 0.2 | silver: 8.0 | monetary_reform |
| Epoch 6 (蒸汽) | 中央银行 (central_bank) | papyrus: 0.3 | silver: 25.0 | central_banking |
| Epoch 8 (原子) | 联储体系 (federal_reserve) | electricity: 0.5 | silver: 80.0 | modern_monetary |

**设计原则**：
- **无建造数量上限**：玩家可以自由建造任意数量的铸币建筑，通过铸币所数量控制货币供给
- 输入从实物（石头/铜）逐渐转向抽象（纸张→电力），体现从商品货币到信用货币的演变
- 每个时代的铸币建筑**不替代**上一时代的（可以共存）
- Epoch 0 的原始铸币块无需科技解锁，确保开局就有货币来源
### 7.2 新增科技

```javascript
// src/config/technologies.js 新增
{
    id: 'minting',
    name: "铸币术",
    desc: "标准化金属货币的铸造技术。解锁铸币所。",
    cost: { science: 60, culture: 20 },
    epoch: 1,
    effects: {}
},
{
    id: 'monetary_reform',
    name: "货币改革",
    desc: "统一度量衡和币值标准。解锁铸币厂。",
    cost: { science: 350, culture: 120 },
    epoch: 4,
    requiresTech: 'minting',
    effects: {}
},
{
    id: 'central_banking',
    name: "中央银行制度",
    desc: "设立国家级金融机构。解锁中央银行。",
    cost: { science: 1000, culture: 350 },
    epoch: 6,
    requiresTech: 'monetary_reform',
    effects: {}
},
{
    id: 'modern_monetary',
    name: "现代货币理论",
    desc: "法定货币与信用扩张体系。解锁联储体系。",
    cost: { science: 3500 },
    epoch: 8,
    requiresTech: 'central_banking',
    effects: {}
},
```

### 7.3 货币流入商人的自然路径

V3 中**不需要专门的自动注资系统**。商人通过以下自然路径获得货币：

1. **消费回流**：各阶层消费时付钱给商人（`stratum→merchant`），这是主要来源
2. **生产成本回流**：业主购买原材料时付钱给商人（`owner→merchant`）
3. **建筑建造回流**：建造建筑时购买建材付钱给商人（`owner/stratum→merchant`）

当商人流动性不足时，玩家可以通过**现有的补贴系统**（负营业税）向商人发放资金。

### 7.4 Epoch 0 的处理

Epoch 0 已有原始铸币块（stone_mint），无需特殊处理：

1. **初始商人 wealth 适度提高**：`startingWealth: 500` → `startingWealth: 800`
   - 这代表“原始货币”（贝壳、贵金属碎片）的初始存量
2. **原始铸币块开局可建**：无需科技解锁，玩家可以立即建造
3. **无安全阀**：预算制自然兜底，不需要任何特殊处理
4. **叙事**：Epoch 0 的货币政策面板显示“原始货币时代”
### 7.5 改动清单

| 文件 | 改动 | 行数 |
|------|------|------|
| `src/config/buildings.js` | 5 个铸币建筑（含 stone_mint） | ~100 行 |
| `src/config/technologies.js` | 4 个科技 | ~40 行 |
| `src/config/strata.js` | 商人 startingWealth 调整 | ~5 行 |

**总计：~145 行。铸币所只是普通国有建筑，无需注资系统，无建造数量上限。**

---

## 八、Phase 3 —— 基于库存变化的自然价格传导（零额外代码，纯机制传导）

### 8.1 核心思想：通过库存变化间接传导，不直接干预价格

**V3 不使用任何"流动性系数"或"偏离系数"直接乘到价格上**。

取而代之的是一个完全自然的传导链条：

> **商人钱少 → 买的少（budgetRatio < 1.0）→ 生产者收入减少 → 工资下降 → 消费减少 → 库存上升 → 价格自然下降**

这个传导链条**不需要任何新代码**——它完全依赖现有的价格系统（库存天数→价格系数）自动完成。

### 8.2 传导路径详解

```
铸币不足 → 商人 wealth 逐渐减少
    → budgetRatio < 1.0（预算制自动生效）
    → 所有生产者等比例减收
    → 利润下降 → 工资下降（现有工资系统自动调整）
    → 消费能力下降 → 消费量减少
    → 库存增加（res 中资源积压）
    → 库存天数上升 → 价格系数下降（现有价格系统自动调整）
    → 市场价格自然下降 → 通缩

铸币过多 → 商人 wealth 逐渐增加
    → budgetRatio = 1.0（正常支付）
    → 各阶层 wealth 充裕 → 消费增加
    → 库存减少（res 中资源被消耗）
    → 库存天数下降 → 价格系数上升（现有价格系统自动调整）
    → 市场价格自然上涨 → 通胀
```

### 8.3 为什么不需要流动性系数？

| 方案 | 机制 | 问题 |
|------|------|------|
| 流动性系数直接乘价格 | `effectivePrice = marketPrice × liquidityFactor` | 生产者收入受影响，但消费者购买价格不受影响 → 商人赚/亏差价，不自然 |
| **库存间接传导（采用）** | 预算制减收 → 工资下降 → 消费减少 → 库存变化 → 价格自然调整 | 买卖两端同时受影响，完全自然，零额外代码 |

**关键优势**：
1. **买卖两端一致**：价格变化同时影响生产者和消费者，不会出现"商人赚差价"的扭曲
2. **零新代码**：完全依赖现有的库存→价格系统，不需要新的 `monetary.js` 文件
3. **渐进传导**：价格调整是渐进的（通过库存变化→价格平滑系数），不会出现突然的价格跳变
4. **与现有系统零冲突**：不在价格计算链条上叠加新的系数，避免多层调节的交互风险

### 8.4 预算制如何驱动传导

预算制（budgetRatio）是唯一的"新机制"，但它已经在 Phase 1 中实现了。Phase 3 不需要额外代码：

```
budgetRatio = 1.0 → 正常经济，价格由供需自然决定
budgetRatio = 0.8 → 生产者收入减 20% → 工资下降 → 消费减少 → 库存上升 → 价格下降
budgetRatio = 0.5 → 生产者收入减 50% → 工资大幅下降 → 消费大幅减少 → 库存大幅上升 → 价格大幅下降
budgetRatio = 0.0 → 经济停摆 → 无收入 → 无消费 → 库存持续积压 → 价格跌至底线
```

### 8.5 通胀/通缩的游戏性感知

| 货币状态 | budgetRatio | 玩家感知 | 游戏效果 |
|---------|------------|---------|---------|
| 严重通缩 | < 0.3 | 🔵 "市场萧条" | 生产者收入大减，工资暴跌，库存积压 |
| 轻度通缩 | 0.3-0.8 | 🔵 "市场偏冷" | 价格逐渐下降，经济放缓 |
| 正常 | 0.8-1.0 | ⚪ "市场稳定" | 无额外效果 |
| 轻度通胀 | 1.0（但商人 wealth 持续增长） | 🟡 "市场过热" | 消费旺盛，库存下降，价格上涨 |
| 严重通胀 | 1.0（商人 wealth 远超需求） | 🔴 "通货膨胀" | 库存严重不足，价格飞涨 |

> **注意**：通胀时 budgetRatio 始终为 1.0（商人钱够用），通胀信号来自库存不足导致的价格上涨。
> 通缩时 budgetRatio < 1.0，通缩信号来自预算制减收导致的连锁反应。

### 8.6 改动清单

| 文件 | 改动 | 行数 |
|------|------|------|
| 无 | Phase 3 不需要额外代码 | 0 行 |

**总计：0 行新代码。** Phase 3 的价格传导完全依赖 Phase 1 的预算制 + 现有价格系统自动完成。

> **这是 V3 方案最优雅的部分**：通过预算制这一个简单机制，
> 就实现了"商人货币量→价格传导"的完整链条，无需任何新的价格公式。

---

## 九、Phase 4 —— 货币政策面板（~300 行改动，低风险，纯 UI）

### 9.1 面板设计

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
│  ┌─ 货币流量 ─────────────────────────────────────┐ │
│  │ 铸币所产出:       +6.0 /日                             │ │
│  │ 商人→生产者:      -340 /日 (产出收入)                  │ │
│  │ 消费者→商人:      +285 /日 (消费支出)                  │ │
│  │ 生产者→商人:      +45 /日 (原材料购买)                 │ │
│  │ ──────────────────────────────────────                          │ │
│  │ 商人净流量:       -10 /日 (消费回流不足时可补贴)       │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  💡 如需向商人注入资金，可在税收面板中将商人的营业税率设为负值。 │
│                                                              │
│  ┌─ 铸币设施 ─────────────────────────────────────┐ ││  │ 铸币所 ×2/3     产出: 4.0 silver/日                    │ │
│  │ [建造] [拆除]                                          │ │
│  │                                                        │ │
│  │ 💡 当前商人流动性充足，无需额外补贴。             │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌─ 历史趋势 (最近 30 天) ────────────────────────────────┐ │
│  │ [M 总量] [商人流动性] [物价指数] [流动性系数]            │ │
│  │ ╭──────────────────────────────╮                       │ │
│  │ │    ╱╲    ╱╲                  │                       │ │
│  │ │   ╱  ╲  ╱  ╲   ╱╲          │                       │ │
│  │ │  ╱    ╲╱    ╲  ╱  ╲         │                       │ │
│  │ │ ╱            ╲╱    ╲        │                       │ │
│  │ ╰──────────────────────────────╯                       │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### 9.2 智能建议系统

```javascript
function getMonetaryAdvice(monetaryStats) {
    const { liquidityFactor, merchantWealth, dailyTurnover } = monetaryStats;
    const coverageDays = dailyTurnover > 0 ? merchantWealth / dailyTurnover : Infinity;
    
    // 优先级 1：流动性危机
    if (coverageDays < 1) {
        return {
            level: 'danger',
            icon: '🚨',
            text: '市场流动性严重不足！商人资金即将耗尽。建议：立即给商人发补贴，或建造铸币所。',
        };
    }
    
    // 优先级 2：严重通胀
    if (deviation > 2.0) {
        return {
            level: 'danger',
            icon: '🔴',
            text: '严重通胀！物价飞涨，民众不满。建议：减少铸币所、提高税率、停止商人补贴、扩大生产。',
        };
    }
    
    // 优先级 3：严重通缩
    if (deviation < 0.4) {
        return {
            level: 'danger',
            icon: '🔵',
            text: '严重通缩！经济萎缩。建议：增建铸币所、降低税率、给商人发补贴。',
        };
    }
    
    // 优先级 4：轻度异常
    if (deviation > 1.5) {
        return {
            level: 'warning',
            icon: '🟡',
            text: '通胀压力较大。建议：适当减少铸币或提高税率。',
        };
    }
    if (deviation < 0.7) {
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

### 9.3 历史数据追踪

```javascript
// useGameState.js 中新增
monetaryHistory: [],

// 每 tick 更新
if (newState.monetaryStats) {
    const history = [...(state.monetaryHistory || []), {
        tick: state.tick,
        moneySupply: newState.monetaryStats.moneySupply,
        merchantWealth: newState.monetaryStats.merchantWealth,
        priceIndex: newState.monetaryStats.priceIndex,
        deviation: newState.monetaryStats.deviation,
    }];
    if (history.length > 30) history.shift();
    newState.monetaryHistory = history;
}
```

### 9.4 改动清单

| 文件 | 改动 | 行数 |
|------|------|------|
| `src/components/panels/MonetaryPanel.jsx` | 新文件：货币政策面板 | ~200 行 |
| `src/hooks/useGameState.js` | 历史数据追踪 | ~15 行 |
| `src/hooks/useGameActions.js` | 补贴操作引导 | ~20 行 |
| `src/components/tabs/` | 新增货币政策 tab | ~15 行 |

**总计：~250 行，纯 UI，零风险。**

---

## 十、Epoch 0（石器时代）的处理

### 10.1 设计决策：不做特殊市场设计

与 V2 方案一致，Epoch 0 不需要以物易物系统。

### 10.2 Epoch 0 的经济运转方式

1. **初始状态**：商人 startingWealth 提高到 800，代表“原始货币”
2. **原始铸币块**：Epoch 0 开局即可建造 stone_mint，无需科技解锁
3. **无安全阀**：预算制自然兜底
4. **叙事**：货币政策面板显示“原始货币时代”
```
📜 原始货币时代

你的部落使用贝壳和贵金属碎片作为交换媒介。
建造「原始铸币块」可以将石头和木材加工为粗制货币。

研究「铸币术」以解锁更高效的铸币所。

当前市场流动性: 1,245 银币
```
### 10.3 Epoch 0 → Epoch 1 的过渡

当玩家研究「铸币术」并建造第一个铸币所时：
- 铸币所开始产出银币 → 国库增加
- 国库通过税收/补贴/薪俸等渠道分配货币 → 各阶层消费 → 商人流动性增加
- 经济开始加速增长
- 货币政策面板切换为完整模式

这个过渡是**自然的**，不需要任何特殊代码。

---

## 十一、数值平衡指南

### 11.1 商人 startingWealth 的校准

商人的 startingWealth 需要足以支撑 Epoch 0 的经济循环：

```
Epoch 0 典型经济流量：
- 人口 ~5-10
- 日消费 ~10-30 银币
- 日产出收入 ~15-40 银币
- 商人需要的最低流动性 ≈ 日产出收入 × 3 天 ≈ 45-120 银币
- 原始铸币块日产 1.0 银币，可持续补充流动性

建议：startingWealth = 800（足以支撑 ~20-50 天的经济循环，配合原始铸币块可无限续命）
```

### 11.2 铸币所产出量的校准

| 时代 | 典型人口 | 典型日经济流量 | 铸币所总产出 | 日净增长 |
|------|---------|--------------|-------------|--------|--------|
| Epoch 1 | 15-50 | 50-200 | 6.0 (3×2.0) | +6 |
| Epoch 4 | 200-900 | 2000-8000 | 16.0 (2×8.0) | +16 |
| Epoch 6 | 1000-4500 | 15000-60000 | 25.0 (1×25.0) | +25 |
| Epoch 8 | 5000-14000 | 80000-300000 | 80.0 (1×80.0) | +80 |

> **注意**：铸币所产出的银币进入国库，通过税收、补贴、官员薪俸等渠道流入各阶层，
> 再通过消费回流到商人。铸币量的调控是玩家的核心决策之一。

### 11.3 关键参数汇总

| 参数 | 值 | 位置 | 说明 |
|------|-----|------|------|
| merchant.startingWealth | 800 | strata.js | 商人初始流动性 |
| WEALTH_DECAY_RATE | ~~0.005~~ | ~~gameConstants.js~~ | **删除**：V3 移除富裕性挥霍机制 |
| targetMGDPRatio | ~~3.0~~ | ~~monetary.js~~ | **删除**：不再使用偏离系数 |
| TARGET_COVERAGE_DAYS | ~~5.0~~ | ~~monetary.js~~ | **删除**：不再使用流动性系数 |
| liquidityBufferDays | ~~5~~ | ~~货币政策~~ | **删除**：不再需要自动注资 |
| maxInjectionRatio | ~~0.1~~ | ~~货币政策~~ | **删除**：不再需要自动注资 |
| stone_mint.output.silver | 1.0 | buildings.js | 原始铸币块日产出（无建造上限） |
| mint.output.silver | 2.0 | buildings.js | 铸币所日产出（无建造上限） |

---

## 十二、与现有系统的兼容性

### 12.1 存档兼容

| 字段 | 旧存档处理 |
|------|-----------|
| monetaryStats | 新增字段，旧存档默认为空 |
| monetaryPolicy | 新增字段，旧存档使用默认值 |
| monetaryHistory | 新增字段，旧存档为空数组 |
| merchant.startingWealth | 旧存档中商人 wealth 不变，新游戏使用新值 |
| 建筑 owner 变更 | 旧存档中已建建筑的 owner 不变，新建建筑使用新 owner |

### 12.2 贸易系统兼容

商人的贸易系统（trading.js）**完全不受影响**，但需要理解其与商人中介角色的关系：

**当前贸易系统的资金流**：
```
出口：
  1. 商人从 res 取走资源 (res[r] -= amount)
  2. 商人从外国收到银币 (wealth.merchant += revenue)
  3. 商人缴纳关税 (merchant→state)
  
进口：
  1. 商人向外国支付银币 (merchant→void, 代表货币流出国境)
  2. 资源进入 res (res[r] += amount)
  3. 商人缴纳关税 (merchant→state)
```

**V3 中的兼容性分析**：

| 贸易操作 | 当前代码 | V3 影响 | 说明 |
|---------|---------|---------|------|
| 出口取资源 | `res[r] -= amount` | **零改动** | 从商人库存取走，语义一致 |
| 出口收款 | `wealth.merchant += revenue` | **零改动** | 外汇流入商人，增加市场流动性 |
| 进口付款 | `merchant→void` | **零改动** | 货币流出国境，减少市场流动性 |
| 进口入库 | `res[r] += amount` | **零改动** | 资源进入商人库存，语义一致 |
| 关税 | `merchant→state` | **零改动** | 已经是商人付给国库 |
| 贸易利润 | `wealth.merchant += profit` | **零改动** | 利润增加市场流动性 |
| 资本锁定 | `lockedCapital` | **零改动** | 商人贸易资本已从 wealth 中扣除 |

**关键洞察**：贸易系统已经完全基于 `wealth.merchant` 运作，与 V3 的商人中介模型天然兼容。

**贸易对商人流动性的影响**：
- **出口**：商人库存减少（res 下降），但银币增加（wealth 上升）→ 流动性改善
- **进口**：商人库存增加（res 上升），但银币减少（wealth 下降）→ 流动性恶化
- **贸易顺差**：出口 > 进口 → 商人流动性改善 → 国内经济宽松
- **贸易逆差**：进口 > 出口 → 商人流动性恶化 → 国内经济紧缩

这个机制自然地将国际贸易与国内货币政策联系起来，增加了游戏深度。

### 12.3 外交系统兼容

货币量指标可以作为外交系统的输入（未来扩展）：
- 通胀严重 → 外交信誉下降
- 通缩严重 → 贸易吸引力下降

### 12.4 战争系统兼容

战争对商人 wealth 的影响：
- 战时贸易中断 → 商人贸易收入减少 → 但市场中介功能不受影响
- 建筑被摧毁 → 产出减少 → 商人支出减少 → 流动性自然平衡

---

## 十三、完整实施路线图

```
Phase 0 (低风险, ~70行)           Phase 1 (中风险, ~250行)
┌──────────────────────┐         ┌──────────────────────────┐
│ ✅ ledger 追踪        │         │ ⚠️ sellProduction 改造   │
│ ✅ 工资直连           │   →     │ ⚠️ 9处 void→merchant     │
│ ✅ M 总量计算         │         │ ⚠️ 预算制（无安全阀）      │
│ ✅ 新交易类别         │         │ ⚠️ 建筑 owner 迁移       │
└──────────────────────┘         │ ⚠️ 移除银币产出（14个）    │
                                  └────────────┬─────────────┘
                                               │
                                               ▼
Phase 3 (零代码, 自动传导)       Phase 2 (低风险, ~145行)
┌──────────────────────────┐     ┌──────────────────────────┐
│ ✅ 预算制→工资下降       │ ←   │ ✅ 铸币所建筑 ×5         │
│ ✅ 消费减少→库存上升   │     │ ✅ 铸币科技 ×4           │
│ ✅ 现有价格系统自动调整 │     │ ✅ 无建造数量上限        │
│ ✅ 无需额外代码          │     └──────────────────────────┘
└──────────────────────────┘
               │
               ▼
Phase 4 (低风险, ~250行, 纯UI)
┌──────────────────────────┐
│ ✅ 货币政策面板           │
│ ✅ 智能建议系统           │
│ ✅ 历史趋势图表           │
│ ✅ 补贴操作引导           │
│ ✅ 通胀/通缩指示器        │
└──────────────────────────┘
```

### 各 Phase 的独立价值

| Phase | 独立价值 | 可以单独发布？ | 依赖 |
|-------|---------|--------------|------|
| Phase 0 | 工资直连 + 货币量追踪 | ✅ 是 | 无 |
| Phase 1 | 商人中介 + 预算制 + 货币守恒 | ⚠️ 需要 Phase 0 | Phase 0 |
| Phase 2 | 铸币所体系 | ⚠️ 需要 Phase 1 | Phase 0+1 |
| Phase 3 | 库存间接价格传导 | ✅ 自动完成，零代码 | Phase 0+1 |
| Phase 4 | 货币政策面板 | ⚠️ 需要 Phase 0 | Phase 0 |

> **注意**：Phase 3 不再需要单独实施——它是 Phase 1 预算制 + 现有价格系统的自然结果。
> Phase 0 是所有后续 Phase 的前置条件。
> Phase 1 和 Phase 2 是紧密耦合的，建议一起实施。

---

## 十四、与 V2 方案的关键差异

| 决策 | V2 | V3 | 理由 |
|------|----|----|------|
| void 交易 | 保留，追踪 | 替换为商人中介 | 真正的货币守恒 |
| 货币来源 | void + 铸币所 | 仅铸币所 | 完全可控 |
| 商人角色 | 不变 | 纯中介（剥离 owner） | 避免身份冲突 |
| 银币产出建筑 | 保留 | 移除（补偿实物） | 铸币所唯一来源 |
| 消费侧守恒 | Phase 4（可选） | Phase 1（核心） | 从一开始就守恒 |
| 财富衰减 | 保留 | **删除** | 商人中介已实现自然平衡 |
| 注资机制 | 不需要 | **不需要**（用补贴替代） | 减少新概念 |
| 价格传导 | 偏离系数直接乘价格 | **预算制→库存变化→自然传导** | 更自然、零额外代码 |
| 安全阀 | 不需要 | **不需要（预算制兜底）** | 经济停摆是有意义的游戏状态 |
| 改动量 | ~80行（Phase 0） | ~250行（Phase 0+1） | 稍多但更彻底 |
| 风险 | 极低 | 中等 | 需要充分测试 |

---

## 十五、风险评估与缓解

### 15.1 最大风险：商人 wealth 耗尽导致经济停摆

**缓解措施**：
1. 预算制自然兜底（budgetRatio 渐进下降，不会突然停摆）
2. 原始铸币块开局可建，确保始终有货币来源
3. 商人 startingWealth 足够高（800）
4. 流动性监控 + 玩家提示（Phase 4 UI）
5. 玩家可通过补贴系统紧急注资商人

### 15.2 次要风险：建筑 owner 迁移导致经济失衡

**缓解措施**：
1. 逐个建筑审视，确保新 owner 合理
2. 旧存档中已建建筑 owner 不变
3. 充分测试各时代的经济平衡

### 15.3 次要风险：移除银币产出导致早期经济困难

**缓解措施**：
1. 用等价实物资源补偿（14 个建筑已全部制定补偿方案）
2. 原始铸币块开局即可建造，铸币所在 Epoch 1 解锁
3. 铸币建筑无建造数量上限，玩家可自由调控货币供给

### 15.4 测试策略

| 测试场景 | 关注点 |
|---------|--------|
| Epoch 0 新游戏 | 商人初始流动性是否足够？ |
| Epoch 0→1 过渡 | 铸币所建造后经济是否加速？ |
| Epoch 1 稳态 | 商人 wealth 是否稳定？budgetRatio 是否接近 1.0？ |
| 快速扩张 | 大量建筑建造时流动性是否充足？ |
| 战争时期 | 建筑被摧毁后经济是否恢复？ |
| 后期经济 | Epoch 6+ 的大规模经济是否稳定？ |
| 极端通胀 | 建很多铸币所 + 低税率 + 给商人发补贴 |
| 极端通缩 | 0 个铸币所 + 高税率 |

---

## 十六、游戏性总结

### 玩家获得的新决策维度

1. **铸币所建造**：什么时候建？建几个？用什么时代的？
2. **补贴策略**：什么时候给商人发补贴？发多少？
3. **税率与货币量联动**：高税率回收货币 vs 低税率释放货币
4. **贸易与货币量联动**：出口赚外汇 vs 进口消耗外汇
5. **生产扩张与货币量联动**：扩大生产降低物价 vs 减少生产提高物价
6. **战争与货币量联动**：战时经济紧缩 vs 和平时期繁荣

### 与 P 社游戏的对标

- **Victoria 3**：有完整的货币量和通胀/通缩系统，但过于复杂
- **本方案**：保留核心体验（铸币→分配→流通→回收），大幅简化实现
- **独特之处**：商人作为市场中介的设计，比 V3 的抽象"市场账户"更有叙事感

### 核心游戏循环

```
铸币所铸币 → 国库通过税收/补贴/薪俸分配货币 → 各阶层消费付钱给商人 → 
商人付钱给生产者 → 生产者发工资 → 工人消费付钱给商人 → 循环继续

如果铸币不足 → 商人流动性下降 → 生产者收入减少 → 通缩
如果铸币过多 → 货币总量膨胀 → 物价上涨 → 通胀

玩家的任务：通过铸币政策和税收政策，维持经济的健康运转。
```
