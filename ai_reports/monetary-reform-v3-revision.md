# V3 终稿修订方案 —— 基于 12 条反馈的完整修订

> 本文档记录对 `monetary-reform-v3-final.md` 的所有修订。
> 每条修订对应一条反馈，标注影响的章节和代码文件。

---

## 修订总览

| # | 反馈摘要 | 影响章节 | 影响代码 | 风险 |
|---|---------|---------|---------|------|
| R1 | 贸易收入改为：进口→res，出口→商人收入 | §11.1 | trading.js L653 | 中 |
| R2 | 预算制修改（按 review 建议） | §6 | sellProduction | 低 |
| R3 | 商人消费只扣 res，不扣银币 | §3.4 | needs.js | 低 |
| R4 | 官员消费也找商人买东西 | §3.4（新增） | needs.js | 中 |
| R5 | 所有升级配置中的银币产出移除+补偿 | §4.3（扩展） | buildingUpgrades.js | 高 |
| R6 | "银币产出+X%"改为增加铸币产量 | §4（新增） | events, ideologies | 中 |
| R7 | taxIncome 加成在 V3 中变成新货币来源 | §4（新增） | ideologies.js, epochs.js | 中 |
| R8 | 商人收入=工资+中介净收益+贸易利润，新增 state 商人建筑 | §3.5, §3.6 | buildings.js | 中 |
| R9 | 铸币所不设建造数量上限 | §4.1 | buildings.js | 低 |
| R10 | 开局有初始商人建筑、商人群体、初始商人财富 | §12.1（修改） | difficulty.js, strata.js | 低 |
| R11 | owner=artisan 但无 artisan 岗位→设计失误，移除 merchant 岗位 | §3.5 | buildings.js | 低 |
| R12 | 保留 navigator_school | §3.5 | 无改动 | 无 |

---

## R1：贸易系统改造（反馈 #1）

### 原方案（§11.1）
声称"贸易系统零改动"，保留 `void→merchant` 的收入结算。

### 问题
`trading.js` L653 有一处 `void→merchant` 的货币创造：
```javascript
ledger.transfer('void', 'merchant', trade.revenue, 
    TRANSACTION_CATEGORIES.INCOME.OWNER_REVENUE, 
    TRANSACTION_CATEGORIES.INCOME.OWNER_REVENUE);
```
这违反了"铸币所唯一来源"原则。

### 修订后的贸易模型

**出口**（卖给外国）：
- `res[resource] -= amount`（商人库存减少）
- 外国付款 → `wealth.merchant += revenue`（但这笔钱从哪来？）
- **修订**：出口收入应该是 `void→merchant`，因为外汇是从国境外流入的真实货币。这是**唯一合理的 void→merchant**，因为外国的银币不在本国货币守恒范围内。
- 或者更严格地说：出口收入 = 外国银币流入 = 货币供给增加，这与铸币所类似，是一种"外部货币注入"。

**进口**（从外国买）：
- 进口资源进入 `res`（商人库存增加）
- 商人付款 → `merchant→void`（银币流出国境）
- **修订**：进口不需要单独结算"收入"。资源进入 res 后，日后这些资源将参与到后续的交易流程（商人卖给消费者时自然获得银币）。

### 修订后的 §11.1 贸易兼容表

| 贸易操作 | 当前代码 | V3 修订 | 说明 |
|---------|---------|---------|------|
| 出口取资源 | `res[r] -= amount` | **零改动** | 从商人库存取走 |
| 出口收款 | `void→merchant` (L653) | **保留但重新分类** | 外汇流入=外部货币注入，不违反国内守恒 |
| 进口付款 | `merchant→void` | **零改动** | 银币流出国境 |
| 进口入库 | `res[r] += amount` | **零改动** | 资源进入商人库存，日后参与交易流程 |
| 关税 | `merchant→state` | **零改动** | 商人付给国库 |

### 货币守恒方程修订

```
dM/dt = 铸币所产出 + 出口收入 - 进口支出 - 资本外逃

其中：
- 铸币所产出 = void→state（国内唯一的货币创造）
- 出口收入 = void→merchant（外汇流入，不属于国内创造）
- 进口支出 = merchant→void（银币流出国境）
- 资本外逃 = stratum→void
```

> **关键洞察**：贸易顺差 = 外部货币净流入，等价于"额外的铸币"。
> 这让贸易政策与货币政策产生了深层联动——出口导向型经济自带通胀压力，
> 进口导向型经济自带通缩压力。这是非常好的游戏机制。

### 代码改动

`trading.js` L653 的 `void→merchant` **保留**，但交易类别改为：
```javascript
// 出口收入：外汇流入（不属于国内货币创造，而是国际贸易带来的外部注入）
ledger.transfer('void', 'merchant', trade.revenue, 
    TRANSACTION_CATEGORIES.INCOME.TRADE_EXPORT_REVENUE,  // 新类别
    TRANSACTION_CATEGORIES.INCOME.TRADE_EXPORT_REVENUE);
```

---

## R2：预算制修改（反馈 #2）

### 修订
按 review 建议修改预算制计算。具体来说：

**原方案**：在 tick 开始时预估产出总值，按比例分配。
**修订后**：改为**实时预算制**——每次 `sellProduction` 时，检查商人当前 wealth 是否足够支付。如果不够，按 `wealth / totalOwed` 的比例支付（所有待支付的生产者按比例缩减）。

这避免了"预估不准"的问题，因为不需要预估——每次支付时实时检查余额。

### 实现要点
```javascript
// sellProduction 中的预算制
function payForProduction(owner, amount, price) {
    const totalOwed = amount * price;
    const available = wealth.merchant;
    
    if (available >= totalOwed) {
        // 足额支付
        ledger.transfer('merchant', owner, totalOwed, ...);
    } else {
        // 按比例支付（所有生产者等比缩减）
        const ratio = available / totalOwed;
        const actualPayment = totalOwed * ratio;
        ledger.transfer('merchant', owner, actualPayment, ...);
        // 差额不补——自然传导为通缩
    }
}
```

---

## R3：商人消费只扣 res（反馈 #3）

### 原方案（§3.4）
已经正确描述了"商人消费时，只扣 res（商品从库存取走），不扣银币"。

### 确认
此条无需修改，原方案已正确。商人消费 = 库存损耗，不涉及银币流转。

---

## R4：官员消费也找商人买东西（反馈 #4）

### 原方案
遗漏了官员消费路径。官员（official）有独立的消费系统。

### 修订
官员消费也走商人中介：
```
官员消费 food/cloth/... → official→merchant（银币）+ res[resource] -= amount
```

这意味着：
1. 官员从国库领薪俸（`state→official`）
2. 官员用薪俸向商人购买消费品（`official→merchant`）
3. 商人库存减少（`res[resource] -= amount`）

### 影响
- 官员的消费也会消耗商人流动性
- 官员薪俸过高 → 商人获得更多银币 → 通胀压力
- 这让官员系统与货币系统产生了联动

### 代码改动
在 `needs.js` 中，官员消费的 ledger 记录从 `official→void` 改为 `official→merchant`。

---

## R5：所有升级配置中的银币产出移除+补偿（反馈 #5）

### 原方案（§4.3）
只列出了基础建筑的银币产出移除，遗漏了 `buildingUpgrades.js` 中的 27 处升级银币产出。

### 完整的升级银币产出清单及补偿方案

#### trading_post 升级
| 等级 | 原 output | 移除 silver 后 | 补偿 |
|------|----------|---------------|------|
| Lv1 | `food:10.4, silver:4.16` | `food:10.4` | `food:10.4→14` (+3.6，用实物补偿) |
| Lv2 | `food:18, silver:7.2, spice:0.02` | `food:18, spice:0.02` | `food:18→24, spice:0.02→0.05` |

#### amphitheater（圆形剧场）升级
| 等级 | 原 output | 移除 silver 后 | 补偿 |
|------|----------|---------------|------|
| Lv1 | `culture:9.75, silver:1.2` | `culture:9.75` | `culture:9.75→12` |
| Lv2 | `culture:13.5, silver:2.25` | `culture:13.5` | `culture:13.5→18` |

#### church（教堂）升级
| 等级 | 原 output | 移除 silver 后 | 补偿 |
|------|----------|---------------|------|
| Lv1 | `culture:20.8, silver:5.76` | `culture:20.8` | `culture:20.8→28` |
| Lv2 | `culture:36, silver:9.60, science:0.3` | `culture:36, science:0.3` | `culture:36→48, science:0.3→0.8` |

#### spice_market（香料市场）升级
| 等级 | 原 output | 移除 silver 后 | 补偿 |
|------|----------|---------------|------|
| Lv2 | `spice:1.55, silver:0.25, science:0.05` | `spice:1.55, science:0.05` | `spice:1.55→1.8, science:0.05→0.15` |

#### trade_port（贸易港）升级
| 等级 | 原 output | 移除 silver 后 | 补偿 |
|------|----------|---------------|------|
| Lv1 | `food:93.6, silver:2.6` | `food:93.6` | `food:93.6→100` |
| Lv2 | `food:162, silver:4.5` | `food:162` | `food:162→175` |

#### coffee_house（咖啡馆）升级
| 等级 | 原 output | 移除 silver 后 | 补偿 |
|------|----------|---------------|------|
| Lv1 | `culture:14.4, science:5.20, silver:1.2` | `culture:14.4, science:5.20` | `culture:14.4→16, science:5.20→6.5` |
| Lv2 | `culture:15.75, science:6.75, silver:1.8` | `culture:15.75, science:6.75` | `culture:15.75→18, science:6.75→8.5` |

#### brewery（酿酒坊）升级
| 等级 | 原 output | 移除 silver 后 | 补偿 |
|------|----------|---------------|------|
| Lv1 | `ale:17.85, silver:2.90` | `ale:17.85` | `ale:17.85→21` |
| Lv2 | `ale:21.45, silver:3.80, culture:0.18` | `ale:21.45, culture:0.18` | `ale:21.45→26, culture:0.18→0.5` |

#### stock_exchange（证券交易所）升级
| 等级 | 原 output | 移除 silver 后 | 补偿 |
|------|----------|---------------|------|
| Lv1 | `culture:14.22, silver:4.06` | `culture:14.22` | `culture:14.22→20, science:0→2` |
| Lv2 | `culture:25.16, silver:7.19, science:0.48` | `culture:25.16, science:0.48` | `culture:25.16→35, science:0.48→3` |

#### inn（旅馆）升级
| 等级 | 原 output | 移除 silver 后 | 补偿 |
|------|----------|---------------|------|
| Lv1 | `food:5.2, silver:1.5` | `food:5.2` | `food:5.2→7, culture:0→0.5` |
| Lv2 | `food:6.75, silver:1.8, culture:0.225` | `food:6.75, culture:0.225` | `food:6.75→9, culture:0.225→1` |

#### rail_depot（铁路枢纽）升级
| 等级 | 原 output | 移除 silver 后 | 补偿 |
|------|----------|---------------|------|
| Lv1 | `silver:62.22, maxPop:34.5` | `maxPop:34.5` | `maxPop:34.5→50, food:0→2` |
| Lv2 | `silver:80, maxPop:37.5, food:0.75, culture:0.15` | `maxPop:37.5, food:0.75, culture:0.15` | `maxPop:37.5→60, food:0.75→3, culture:0.15→1` |

#### apartment_block（公寓楼）升级
| 等级 | 原 output | 移除 silver 后 | 补偿 |
|------|----------|---------------|------|
| Lv1 | `maxPop:156, silver:1.5` | `maxPop:156` | `maxPop:156→170` |
| Lv2 | `maxPop:270, silver:2.5` | `maxPop:270` | `maxPop:270→300` |

#### data_center（数据中心）升级
| 等级 | 原 output | 移除 silver 后 | 补偿 |
|------|----------|---------------|------|
| Lv1 | `silver:94.5, science:9.2` | `science:9.2` | `science:9.2→20` |
| Lv2 | `silver:126, science:12.4` | `science:12.4` | `science:12.4→30` |

#### internet_platform（互联网平台）升级
| 等级 | 原 output | 移除 silver 后 | 补偿 |
|------|----------|---------------|------|
| Lv1 | `silver:75, culture:3.83` | `culture:3.83` | `culture:3.83→12, science:0→5` |
| Lv2 | `silver:107.14, culture:5.49` | `culture:5.49` | `culture:5.49→18, science:0→8` |

#### financial_center（金融中心）升级
| 等级 | 原 output | 移除 silver 后 | 补偿 |
|------|----------|---------------|------|
| Lv1 | `silver:100` | （无其他产出） | `culture:0→8, science:0→5` |
| Lv2 | `silver:180` | （无其他产出） | `culture:0→15, science:0→10` |

### 补偿原则
1. **优先用同类资源补偿**：食物建筑补食物，文化建筑补文化
2. **银币产出越高，补偿越丰厚**：确保升级仍有吸引力
3. **后期建筑补 science/culture**：体现信息时代的知识经济
4. **纯银币建筑（financial_center）改为 culture+science**：金融中心变为"知识经济中心"

---

## R6：银币产出百分比 → 铸币产量加成（反馈 #6）

### 原方案
未处理 `resourcePercent.silver` 的语义变化。

### 修订
在 V3 系统中，`resourcePercent: { silver: X }` 的含义从"所有建筑银币产出 +X%"变为"铸币所银币产出 +X%"。

因为只有铸币所产出银币，所以 `resourcePercent.silver` 自然只影响铸币所。

### 影响范围
`economicEvents.js` 中有 **50 处** `resourcePercent.silver`，这些事件效果在 V3 中自动变为"铸币产量加成"。

**无需代码改动**——因为 `resourcePercent` 的应用逻辑是对所有产出该资源的建筑生效。当只有铸币所产出 silver 时，效果自然只作用于铸币所。

### 语义变化说明
| 事件效果 | V2 含义 | V3 含义 |
|---------|---------|---------|
| `resourcePercent: { silver: 0.08 }` | 所有建筑银币产出 +8% | 铸币所产量 +8% |
| `resourcePercent: { silver: -0.05 }` | 所有建筑银币产出 -5% | 铸币所产量 -5% |

> **游戏性影响**：这些事件在 V3 中变得更有意义——它们直接影响货币供给，
> 而不是分散在各种建筑上的微小银币产出。一个 +8% 铸币产量的事件
> 意味着通胀压力增加，玩家需要考虑是否接受。

---

## R7：taxIncome 加成 → 新的货币来源（反馈 #7）

### 原方案
未处理理念系统中大量的 `taxIncome` 加成。

### 修订
在 V3 系统中，`taxIncome` 的含义需要重新定义：

**当前含义**：`taxIncome` 是一个虚拟税收加成，直接增加国库收入（`income_ideology_virtual_tax`）。

**V3 含义选项**：

#### 方案 A：taxIncome → 铸币效率加成（推荐）
将 `taxIncome` 重新解释为"货币政策效率"——提高铸币所的产出效率。

```javascript
// 铸币所产出 = 基础产出 × (1 + Σ taxIncome加成)
const mintBonus = 1 + totalTaxIncomeBonus;
const actualMintOutput = baseMintOutput * mintBonus;
```

**理由**：
- taxIncome 本质上是"国家获取货币的能力"
- 在 V3 中，国家获取货币的唯一途径是铸币所
- 因此 taxIncome → 铸币效率 是最自然的映射

#### 方案 B：taxIncome → 税率加成
将 `taxIncome` 解释为"税收征收效率"——提高实际税率。

**问题**：税率已经是玩家可控的，额外加成可能导致混乱。

#### 推荐方案 A

### 影响范围
- `ideologies.js`：42 处 `taxIncome` 引用
- `epochs.js`：5 处 `taxIncome` 引用（封建 0.10、探索 0.25、电气 0.15、原子 0.18、信息 0.20）

### 实现
在铸币所产出计算中，叠加所有 `taxIncome` 加成：
```javascript
function calculateMintOutput(baseMintOutput, state) {
    const ideologyBonus = getIdeologyTaxIncome(state);  // 理念加成
    const epochBonus = getEpochTaxIncome(state);         // 时代加成
    const eventBonus = getEventTaxIncome(state);         // 事件加成
    
    const totalBonus = 1 + ideologyBonus + epochBonus + eventBonus;
    return baseMintOutput * totalBonus;
}
```

---

## R8：商人收入来源 + 新增 state 商人建筑（反馈 #8）

### 原方案（§3.5, §3.6）
商人没有 owner 收入，只有工资+中介净收益+贸易利润。

### 修订
确认商人的三种收入来源：
1. **工资收入**：在商人岗位建筑中打工获得工资
2. **市场中介净收益**：消费者付给商人的总额 - 商人付给生产者的总额
3. **贸易利润**：进出口贸易的价差利润

### 新增 ownerKey='state' 的商人建筑

为了确保商人有稳定的工资来源，新增一些 `ownerKey='state'` 的商人建筑，工资由国库支付：

| 建筑 | 时代 | 修改 | 说明 |
|------|------|------|------|
| **market** (市场) | 1 | `owner: 'state'` | 市场是公共设施，国家运营 |
| **harbor** (港口) | 1 | `owner: 'state'` | 港口是公共基础设施 |
| **merchant_guild** (商会) | 3 | `owner: 'state'` | 国家特许的商业组织 |
| **trade_port** (贸易港) | 4 | `owner: 'state'` | 国家贸易港 |
| **stock_exchange** (证券交易所) | 6 | `owner: 'state'` | 国家监管的交易所 |

**工资支付路径**：`state→merchant`（国库直接支付商人工资）

**经济学意义**：
- 国家通过建造商人建筑 → 创造商人岗位 → 国库支付工资 → 货币流入商人
- 这是除铸币所之外，国家向商人注入流动性的第二条路径
- 玩家可以通过建造更多商人建筑来增加市场流动性

---

## R9：铸币所不设建造数量上限（反馈 #9）

### 原方案（§4.1）
各时代铸币所有 maxCount 限制：stone_mint:2, mint:3, royal_mint:2, central_bank:1, federal_reserve:1

### 修订
**移除所有铸币所的 maxCount 限制**。

| 时代 | 建筑 | 原 maxCount | 修订后 |
|------|------|------------|--------|
| Epoch 0 | stone_mint | 2 | **无限制** |
| Epoch 1 | mint | 3 | **无限制** |
| Epoch 4 | royal_mint | 2 | **无限制** |
| Epoch 6 | central_bank | 1 | **无限制** |
| Epoch 8 | federal_reserve | 1 | **无限制** |

**设计理由**：
- 铸币所的数量应该由玩家自主决策
- 建太多铸币所 → 通胀 → 物价飞涨 → 民众不满 → 自然惩罚
- 建太少铸币所 → 通缩 → 经济萎缩 → 也是自然惩罚
- 建造成本本身就是限制（需要铜、煤、纸张、电力等输入）
- 让玩家自由探索"印多少钱合适"是核心游戏乐趣

### §4.1 修订后的铸币建筑表

| 时代 | 建筑 | 输入 | 产出 | 解锁条件 |
|------|------|------|------|---------|
| **Epoch 0** | **stone_mint** | **无** | **silver: 0.5** | **无（初始可建）** |
| Epoch 1 | mint | copper: 0.3, wood: 0.1 | silver: 2.0 | minting |
| Epoch 4 | royal_mint | copper: 0.8, coal: 0.2 | silver: 8.0 | monetary_reform |
| Epoch 6 | central_bank | papyrus: 0.3 | silver: 25.0 | central_banking |
| Epoch 8 | federal_reserve | electricity: 0.5 | silver: 80.0 | modern_monetary |

---

## R10：开局有初始商人建筑、商人群体、初始商人财富（反馈 #10）

### 原方案
`merchant.startingWealth = 500`，但未在 `difficulty.js` 的 `initialBuildings` 中包含商人建筑。

### 修订

#### difficulty.js 初始建筑修改

| 难度 | 原 initialBuildings | 修订后 |
|------|-------------------|--------|
| 新手 | farm:2, lumber_camp:2, quarry:1, loom_house:1, market:1 | +`trading_post:1` |
| 简单 | farm:2, lumber_camp:2, loom_house:1 | +`trading_post:1` |
| 普通 | farm:1, lumber_camp:1 | +`trading_post:1` |
| 困难 | farm:1 | +`trading_post:1` |
| 灾厄 | （空） | +`trading_post:1` |
| 自定义 | （空） | +`trading_post:1` |

> **所有难度都有初始 trading_post**，确保开局就有商人群体和市场中介功能。

#### 初始商人财富
- `merchant.startingWealth = 500`（保持不变）
- trading_post 提供 2 个商人岗位 → 开局就有 2 个商人
- 这 2 个商人 + 500 初始财富 = 足够中介 Epoch 0 的小规模经济

#### 初始铸币所
- 新手/简单难度：`initialBuildings` 中加入 `stone_mint: 1`
- 普通及以上：不加，让玩家自己决定何时建造

| 难度 | 初始 stone_mint |
|------|----------------|
| 新手 | 1 |
| 简单 | 1 |
| 普通 | 0 |
| 困难 | 0 |
| 灾厄 | 0 |

---

## R11：owner=artisan 但无 artisan 岗位 → 设计失误（反馈 #11）

### 原方案（§3.5）
`coffee_house` 的 jobs 改为 `{merchant:3, scribe:3}`，保留 `artisan` owner。

### 问题
如果 `owner: 'artisan'` 但 jobs 中没有 artisan 岗位，这是设计失误。owner 也应该出现在岗位里。

### 修订
检查 `coffee_house` 当前配置：
```javascript
{
    id: 'coffee_house',
    jobs: { merchant: 1, scribe: 5 },
    owner: 'merchant',  // 当前 owner 是 merchant
}
```

当前 `coffee_house` 的 owner 是 `merchant`，jobs 中有 `merchant:1`，**没有不匹配问题**。

但原方案提议将 coffee_house 改为 `owner: 'artisan'`，这会导致不匹配。

**修订后**：coffee_house 保持 `owner: 'merchant'`，不改变 owner。jobs 调整为 `{merchant:3, scribe:3}`。

### 通用规则
对所有建筑执行检查：**如果 owner 是某阶层，该阶层必须出现在 jobs 中**。如果发现不匹配，移除 jobs 中的 merchant 岗位，替换为 owner 阶层的岗位。

---

## R12：保留 navigator_school（反馈 #12）

### 原方案
删除 `navigator_school`。

### 修订
**保留 navigator_school**，不做任何改动。

---

## 修订后的 §12.1 参数表

| 参数 | 值 | 位置 | 说明 |
|------|-----|------|------|
| merchant.startingWealth | **500** | strata.js | 初始商人财富 |
| WEALTH_DECAY_RATE | **删除** | ~~gameConstants.js~~ | 移除富裕性挥霍 |
| 安全阀 void→merchant | **无** | - | 不允许紧急货币创造 |
| TARGET_COVERAGE_DAYS | 5.0 | monetary.js | 商人目标覆盖天数 |
| stone_mint.output.silver | 0.5 | buildings.js | Epoch 0 铸币 |
| stone_mint.maxCount | **无限制** | buildings.js | 玩家自由决策 |
| mint.output.silver | 2.0 | buildings.js | Epoch 1 铸币 |
| mint.maxCount | **无限制** | buildings.js | 玩家自由决策 |
| 所有建筑 silver 产出 | **全部移除** | buildings.js | 铸币所唯一来源 |
| 所有升级 silver 产出 | **全部移除** | buildingUpgrades.js | 铸币所唯一来源 |
| resourcePercent.silver | **仅影响铸币所** | 自动生效 | 无需代码改动 |
| taxIncome | **→ 铸币效率加成** | ideologies.js, epochs.js | 方案 A |
| 初始 trading_post | **所有难度 1 座** | difficulty.js | 确保开局有商人 |
| 商人建筑 owner | **'state'** | buildings.js | 国库支付商人工资 |

---

## 修订后的货币守恒方程

```
M(t) = Σ wealth[stratum] + res.silver（国库）

dM/dt = 铸币所产出×(1+taxIncome加成) + 贸易顺差 - 资本外逃

其中：
- 铸币所产出 = void→state × (1 + Σ taxIncome + Σ resourcePercent.silver)
- 贸易顺差 = 出口收入(void→merchant) - 进口支出(merchant→void)
- 资本外逃 = Σ stratum→void
```

---

## 修订后的实施优先级调整

### Phase 1 改动量重新估算

| 改动项 | 原估算 | 修订后估算 | 说明 |
|--------|--------|-----------|------|
| sellProduction 预算制 | 100行 | 80行 | 实时预算制更简单 |
| void→merchant 替换 | 100行 | 80行 | 10处替换 |
| 建筑改造+owner迁移 | 50行 | 50行 | 不变 |
| 移除银币产出（基础） | 30行 | 30行 | 不变 |
| **移除银币产出（升级）** | **0行** | **60行** | **新增：27处升级配置** |
| **官员消费走商人** | **0行** | **30行** | **新增：needs.js 改动** |
| **taxIncome→铸币加成** | **0行** | **40行** | **新增：铸币产出计算** |
| **difficulty.js 初始建筑** | **0行** | **15行** | **新增：所有难度加 trading_post** |
| 移除富裕性挥霍 | 20行 | 20行 | 不变 |
| **总计** | **~300行** | **~405行** | 增加约 35% |

### 建议的 Phase 拆分

由于改动量增加，建议将 Phase 1 拆分为：

**Phase 1a**（核心机制，~200行）：
- sellProduction 预算制
- void→merchant 替换（10处）
- 移除富裕性挥霍
- 官员消费走商人

**Phase 1b**（配置清理，~200行）：
- 移除所有基础建筑银币产出 + 补偿
- 移除所有升级银币产出 + 补偿
- 建筑 owner 迁移为 'state'
- difficulty.js 初始建筑
- taxIncome → 铸币效率加成

---

## 附录：需要验证的边界情况

1. **Epoch 0 经济启动**：只有 trading_post(1座) + stone_mint(新手/简单有1座)，商人 wealth=500，是否足够启动经济循环？
2. **taxIncome 叠加上限**：理念+时代+事件的 taxIncome 叠加后，铸币效率可能达到 +100% 以上，是否需要 cap？
3. **官员消费量**：官员消费如果很大，会不会过快消耗商人流动性？
4. **升级补偿平衡**：移除银币后的实物补偿是否保持了升级的吸引力？
5. **贸易顺差通胀**：大量出口导致的外汇流入是否会造成不可控通胀？
