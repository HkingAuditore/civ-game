# V3 方案修订补丁（基于 Review 反馈）

> 本文档是对 `monetary-reform-v3.md` 的修订补充，记录 6 项设计决策变更。

---

## 修订 1：流动性系数扣除 lockedCapital 和商人消费

### 原方案问题

`wealth.merchant` 同时承载三重角色（阶层财富、贸易资本、市场流动性），大额进口贸易锁定 `lockedCapital` 后会导致国内市场流动性骤降。

### 修订方案

计算流动性系数时，从 `wealth.merchant` 中扣除贸易锁定资本和预估消费需求：

```javascript
// src/logic/economy/monetary.js

/**
 * 计算商人的有效流动性（可用于国内市场结算的资金）
 * 
 * @param {number} merchantWealth - 商人当前总 wealth
 * @param {number} lockedCapital - 贸易在途锁定的资本
 * @param {number} merchantPopulation - 商人人口数
 * @param {number} merchantPerCapitaExpense - 商人人均日消费支出（上一 tick）
 * @returns {number} 有效流动性
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

/**
 * 商人流动性系数（修订版）
 */
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
    const TARGET_COVERAGE_DAYS = 5.0;
    const coverageRatio = coverageDays / TARGET_COVERAGE_DAYS;
    
    if (coverageRatio >= 1.0) {
        return Math.min(1.5, 1.0 + Math.log(coverageRatio) * 0.18);
    } else {
        return Math.max(0.3, Math.sqrt(coverageRatio));
    }
}
```

### 调用处变更

**原方案 Phase 3（§8.4）**中 sellProduction 的流动性系数计算改为：

```javascript
const liquidityFactor = getMerchantLiquidityFactor(
    wealth.merchant || 0,
    previousDailyTurnover,
    currentLockedCapital,          // 从 pendingTrades 累加
    popStructure.merchant || 0,
    previousMerchantPerCapitaExpense  // 上一 tick 的人均消费
);
```

### 影响

- **sellProduction 中的 merchantAvailable 也应使用有效流动性**（不能用被锁定的钱付给生产者）
- 贸易系统无需改动（`lockedCapital` 已在 trading.js 中管理）
- 解决了"大额进口导致国内经济停摆"的问题

---

## 修订 2：Epoch 0 新增原始铸币所（stone_mint）

### 原方案问题

V3 原方案 §3.1 铸币所是 `epoch: 1, requiresTech: 'minting'`，但 Epoch 0 没有货币来源。商人 startingWealth 会单调递减直至归零。

### 修订方案

新增 Epoch 0 专属的原始铸币所，**无原料消耗**，产出极少银币：

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

### 铸币建筑完整体系（修订后）

| 时代 | 建筑 | 输入 | 产出 | maxCount | 解锁条件 |
|------|------|------|------|----------|---------|
| **Epoch 0 (石器)** | **原始铸币坊 (stone_mint)** | **无** | **silver: 0.5** | **2** | **无（初始可建）** |
| Epoch 1 (青铜) | 铸币所 (mint) | copper: 0.3, wood: 0.1 | silver: 2.0 | 3 | minting |
| Epoch 4 (探索) | 铸币厂 (royal_mint) | copper: 0.8, coal: 0.2 | silver: 8.0 | 2 | monetary_reform |
| Epoch 6 (蒸汽) | 中央银行 (central_bank) | papyrus: 0.3 | silver: 25.0 | 1 | central_banking |
| Epoch 8 (原子) | 联储体系 (federal_reserve) | electricity: 0.5 | silver: 80.0 | 1 | modern_monetary |

### 数值验证

```
Epoch 0 典型场景（人口 5-10）：
- 2 座 stone_mint，日产 1.0 银币
- 日产出支付需求 ~15-30 银币（商人要付给生产者）
- 日消费回流 ~10-20 银币（消费者付给商人）
- 商人日净流出 ~5-10 银币
- startingWealth = 500（降低，不再需要 2000）

商人储备可维持 ~50-100 天；
1.0 银币/日的铸币进入国库 → 通过税收/补贴回流经济 → 部分最终流入商人
加上消费回流，商人 wealth 会趋于动态平衡

如果仍有缺口：玩家需要主动给商人发补贴或建更多 stone_mint
```

### 叙事调整

Epoch 0 货币政策面板：
```
🐚 原始货币时代

你的部落使用贝壳和天然金属碎片作为交换媒介。
原始铸币坊能缓慢增加这些"货币"的供给。

建造更多原始铸币坊以增加货币供给，
或研究「铸币术」进入标准化货币时代。
```

### 对 V3 原方案的修订

- §3.1 铸币建筑表格新增 stone_mint 行
- §7.4 "Epoch 0 的特殊处理"整节重写：不再依赖高 startingWealth + 安全阀
- §10 "Epoch 0 的处理"整节重写：有了 stone_mint，Epoch 0 走正常流程
- §11.1 商人 startingWealth 从 2000 降至 500

---

## 修订 3：确认移除所有非铸币所的银币产出

### 设计决策

**所有建筑的 silver 产出一律移除，无例外。** 包括金融类建筑（stock_exchange, financial_center, data_center）。

### 理由

1. **铸币所唯一来源**是 V3 的核心约束，不能有例外
2. 金融类建筑的核心价值应该是**提供高薪岗位**和**产出 culture/science**，而不是"生钱"
3. 现实中证券交易所和数据中心也不"创造"货币——它们创造的是服务价值（对应 science/culture）
4. 银币产出移除后，这些建筑的盈利模式变为：高薪岗位 → 阶层有钱 → 消费拉动经济

### 完整银币产出移除 + 补偿表

| 建筑 | 当前 silver 产出 | 补偿方案 | 补偿理由 |
|------|-----------------|---------|---------|
| `trading_post` | 1.6 | food: 4→6 (+2) | 贸易站带来更多物资 |
| `magistrate_office` | 0.6 | science: 0→0.4 | 行政效率提升科研 |
| `harbor` | 1.2 | maxPop: 0→3 | 港口吸引人口聚居 |
| `church` | 1.6 | culture: 8→12 (+4) | 教堂核心价值就是文化影响力 |
| `trade_port` | 2.0 | food: 12→16 (+4) | 贸易港带来更多海外物资 |
| `rail_depot` | 12.0 | maxPop: 21→35 (+14) | 铁路枢纽是城市化引擎 |
| `opera_house` | 2.86 | culture: 10→16 (+6) | 歌剧院的核心价值是文化 |
| `stock_exchange` | 12.27 | culture: 1.23→6 (+4.77), science: 0→2 | 金融中心促进信息流通和文化交流 |
| `distillery` | 2.4 | ale: 16.2→20 (+3.8) | 酒厂核心价值是酒，不是钱 |
| `high_rise_apartment` | 1.0 | maxPop: 120→125 (+5) | 高层公寓的价值就是住人 |
| `data_center` | 18.0 | science: 2→10 (+8), culture: 0→3 | 数据中心是信息时代科研核心 |
| `internet_platform` | 15.0 | culture: 1.28→8 (+6.72), science: 0→4 | 互联网平台传播文化和知识 |
| `financial_center` | 20.0 | science: 0→5, culture: 0→5 | 金融中心推动知识经济 |

> **注意**：补偿数值需要在实际测试中微调。核心原则是：移除银币后，建筑的**总经济价值**（产出资源的市场价值总和）应大致等于移除前。

---

## 修订 4：移除安全阀机制

### 设计决策

**完全移除安全阀**。不允许任何形式的 void→merchant 紧急创造。

### 理由

1. 安全阀会变成常态触发，使 V3 退化为旧系统
2. "铸币所是唯一货币来源"的承诺必须彻底——包括紧急情况
3. 经济停摆本身就是**有意义的游戏状态**——玩家需要学会管理货币供给

### 替代方案：生产者部分收入延迟

当商人 wealth 不足以支付全部产出收入时，**不从 void 创造**，而是：

```javascript
const sellProduction = (resource, amount, ownerKey) => {
    // ... 铸币所特殊处理不变 ...
    if (amount <= 0) return;
    res[resource] = (res[resource] || 0) + amount;
    
    if (isTradableResource(resource)) {
        supply[resource] = (supply[resource] || 0) + amount;
        const marketPrice = getPrice(resource);
        
        // Phase 3: 流动性系数调整价格
        const liquidityFactor = getMerchantLiquidityFactor(...);
        const effectivePrice = marketPrice * liquidityFactor;
        const grossIncome = effectivePrice * amount;
        
        // 从商人有效流动性中支付
        const effectiveLiquidity = getEffectiveMerchantLiquidity(...);
        
        if (effectiveLiquidity >= grossIncome) {
            // 正常路径：全额支付
            ledger.transfer('merchant', ownerKey, grossIncome, 
                OWNER_REVENUE, OWNER_REVENUE, { buildingId: currentBuildingId });
            roleWagePayout[ownerKey] = (roleWagePayout[ownerKey] || 0) + grossIncome;
        } else {
            // 流动性不足：按比例支付（商人有多少付多少）
            const actualPayment = Math.max(0, effectiveLiquidity);
            if (actualPayment > 0) {
                ledger.transfer('merchant', ownerKey, actualPayment, 
                    OWNER_REVENUE, OWNER_REVENUE, { buildingId: currentBuildingId });
            }
            roleWagePayout[ownerKey] = (roleWagePayout[ownerKey] || 0) + actualPayment;
            
            // 差额不补：生产者就是少收了钱
            // 这会自然传导为：利润下降 → 工资下降 → 消费下降 → 通缩
            // 玩家看到"市场流动性不足"提示后会去建铸币所或发补贴
            merchantLiquidityShortfall += (grossIncome - actualPayment);
        }
        
        if (currentBuildingId && buildingFinancialData[currentBuildingId]) {
            buildingFinancialData[currentBuildingId].ownerRevenue += 
                Math.min(grossIncome, effectiveLiquidity);
        }
    }
};
```

### 预算制：解决产出顺序问题

为防止"先卖出的建筑吃肉、后卖出的喝汤"，在 tick 开始时预计算预算比例：

```javascript
// tick 开始时：预估本 tick 总产出价值
let estimatedTotalOutputValue = 0;
// ... 遍历所有建筑估算产出 ...

// 计算预算比例
const effectiveLiquidity = getEffectiveMerchantLiquidity(...);
const budgetRatio = estimatedTotalOutputValue > 0
    ? Math.min(1.0, effectiveLiquidity / estimatedTotalOutputValue)
    : 1.0;

// sellProduction 中使用 budgetRatio
const actualPayment = grossIncome * budgetRatio;
// 这样每个建筑等比例获得收入，不存在顺序偏差
```

### 对 V3 原方案的修订

- §6.9 "安全阀机制"整节**删除**
- §6.2 sellProduction 改造：使用预算制 + 按比例支付
- §15.1 风险评估：移除"商人 wealth 耗尽导致经济停摆"的缓解措施，改为"经济停摆是有意义的游戏状态"
- §9.2 智能建议系统新增提示：当 `merchantLiquidityShortfall > 0` 时提示"市场流动性不足，建议建造铸币所或给商人发放补贴"

---

## 修订 5：商人 owner 完全剥离，商人岗位由专门建筑提供

### 设计决策

商人不再是任何建筑的 owner。商人的人口来源完全依赖**提供 merchant 岗位的建筑**——类似士兵依赖兵营提供 militaryCapacity。

### 新定位

```
商人（修订后）
├── 阶层身份：保留（人口、wealth、消费需求、满意度）
├── 市场中介：所有市场交易通过商人 wealth 结算
├── 贸易商：保留（进出口系统）
└── 建筑 owner：❌ 完全剥离
    └── 人口来源：由含 merchant jobs 的建筑提供岗位
```

### 建筑 owner 重分配

| 建筑 | 原 owner | 新 owner | 理由 |
|------|----------|----------|------|
| `trading_post` (贸易站) | merchant | **peasant** | 早期建筑，由部落农民经营物资交换 |
| `market` (市场) | merchant | 无 owner | 改造为纯商人岗位建筑（见修订 6） |
| `harbor` (港口) | merchant | 无 owner | 改造为纯商人岗位建筑（见修订 6） |
| `navigator_school` (航海学院) | merchant | **删除建筑** | 功能冗余，岗位并入其他建筑 |
| `coffee_house` (咖啡馆) | merchant | **artisan** | 文化场所，工匠经营 |
| `dockyard` (船坞) | merchant | **navigator** | 造船业归水手，移除商人岗位 |
| `trade_port` (贸易港) | merchant | 无 owner | 改造为纯商人岗位建筑（见修订 6） |
| `coffee_plantation` (咖啡种植园) | merchant | **landowner** | 种植园归地主 |
| `cotton_plantation` (棉花种植园) | merchant | **landowner** | 种植园归地主 |
| `rubber_plantation` (橡胶园) | merchant | **capitalist** | 工业种植园归资本家 |

### 商人消费的处理（不变）

仍然使用 V3 原方案的逻辑：商人消费时 `merchant→void`（从自己库存取用）。

### 商人的收入来源（修订后）

商人没有 owner 收入，但有以下收入渠道：

1. **工资收入**：在商人岗位建筑中打工获得工资（owner→merchant 工资直连）
2. **市场中介净收益**：消费者付给商人的总额 - 商人付给生产者的总额 的差值留在 wealth.merchant 中
3. **贸易利润**：进出口贸易的价差利润

---

## 修订 6：商人岗位建筑线——改造现有建筑

### 设计决策

不新建建筑线，而是**将现有商业/金融/贸易建筑改造为纯商人岗位建筑**。这些建筑移除所有非商人雇员，变成类似兵营提供军事容量的角色——只为商人提供岗位。

### 核心原则

1. 这些建筑的 jobs **只有 merchant**（移除 worker/scribe/navigator 等）
2. 无 owner（国家公共设施，产出归 state 或无产出）
3. 不产出银币（铸币所唯一来源原则）
4. 少量 culture/science 产出（体现商业活动带来的知识文化交流）
5. 需要少量 input 维护（防止无限建造）

### 完整改造表

#### 已有建筑改造

| 建筑 | 时代 | 原配置 | 新配置 | 说明 |
|------|------|--------|--------|------|
| **market** (市场) | 1 | jobs: {merchant:3, worker:1}, owner:merchant, input:{brick:0.1}, output:{food:4} | **jobs: {merchant:5}**, 无 owner, input:{brick:0.1}, output:{culture:0.5} | 去掉 worker 和 food 产出，变为纯商人岗位 |
| **harbor** (港口) | 1 | jobs: {merchant:2, worker:2}, owner:merchant, input:{plank:0.2}, output:{silver:1.2} | **jobs: {merchant:4}**, 无 owner, input:{plank:0.1}, output:{culture:0.5} | 去掉 worker 和 silver 产出，成为港口商业区 |
| **trade_port** (贸易港) | 4 | jobs: {merchant:4, worker:6}, owner:merchant, input:{spice:0.35}, output:{food:12, silver:2} | **jobs: {merchant:8}**, 无 owner, input:{spice:0.2}, output:{culture:1} | 去掉 worker、food、silver 产出 |
| **stock_exchange** (证券交易所) | 6 | jobs: {scribe:21, capitalist:2}, owner:capitalist, input:{papyrus:0.49, coffee:0.37}, output:{silver:12.27, culture:1.23} | **jobs: {merchant:15}**, 无 owner, input:{papyrus:0.3, coffee:0.2}, output:{culture:3, science:1} | scribe/capitalist 全改为 merchant |
| **internet_platform** (互联网平台) | 9 | jobs: {scientist:8, scribe:14, capitalist:1}, owner:capitalist, input:{software:0.18, electricity:0.51}, output:{silver:15, culture:1.28} | **jobs: {merchant:18}**, 无 owner, input:{software:0.15, electricity:0.4}, output:{culture:4, science:2} | 全改为商人岗位 |
| **financial_center** (金融中心) | 9 | jobs: {scribe:21, capitalist:2}, owner:capitalist, input:{software:0.18, electricity:0.51}, output:{silver:20} | **jobs: {merchant:20}**, 无 owner, input:{software:0.15, electricity:0.4}, output:{culture:3, science:2} | 全改为商人岗位 |

#### 需要补充的时代空缺

当前改造后仍有 Epoch 2-3 和 Epoch 5、7-8 的商人岗位空缺。需要**将一些现有建筑增加商人岗位**或**新建小型商人建筑**填补：

| 时代 | 方案 | 商人岗位 | 说明 |
|------|------|---------|------|
| Epoch 0 | `trading_post`（已有） | 2 | 不变，但 owner 改为 peasant |
| Epoch 1 | `market`（改造） | 5 | 见上表 |
| Epoch 1 | `harbor`（改造） | 4 | 见上表 |
| Epoch 3 | **新增：`merchant_guild`（商会）** | **6** | 封建时代商人行会，baseCost:{plank:120, brick:60}, input:{papyrus:0.05}, output:{culture:1}, requiresTech:'guild_charter' |
| Epoch 4 | `trade_port`（改造） | 8 | 见上表 |
| Epoch 5 | **`coffee_house` 增加商人岗位** | 1→**3** | jobs 改为 {merchant:3, scribe:3}，保留 artisan owner |
| Epoch 6 | `stock_exchange`（改造） | 15 | 见上表 |
| Epoch 7 | **新增：`trading_company`（贸易公司）** | **10** | baseCost:{silver:2000, steel:10}, input:{electricity:0.2, papyrus:0.1}, output:{culture:2, science:1}, requiresTech:'joint_stock_company' |
| Epoch 8 | **新增：`logistics_hub`（物流中心）** | **14** | baseCost:{silver:4000, steel:20, electronics:5}, input:{electricity:0.4}, output:{culture:2, science:2}, requiresTech:'supply_chain_management' |
| Epoch 9 | `internet_platform`（改造） | 18 | 见上表 |
| Epoch 9 | `financial_center`（改造） | 20 | 见上表 |

#### 删除的建筑

| 建筑 | 原因 |
|------|------|
| `navigator_school` (航海学院) | 功能与 `dockyard` 重叠，商人岗位只有 1 个意义不大。航海教育功能可以并入 `university` 或 `dockyard` |

#### dockyard 的调整

`dockyard`（船坞）不再提供商人岗位，回归纯造船建筑：
```javascript
// 原配置
jobs: { navigator: 3, worker: 2, merchant: 1 }
owner: 'merchant'

// 新配置
jobs: { navigator: 4, worker: 2 }
owner: 'navigator'
```

### 各时代商人岗位上限一览

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

### 新增科技

| 科技 | 时代 | 前置科技 | 解锁建筑 | cost |
|------|------|---------|---------|------|
| `guild_charter` (行会特许状) | 3 | `caravan_trade` | merchant_guild | { science: 200, culture: 80 } |
| `joint_stock_company` (股份公司) | 7 | `financial_capitalism` | trading_company | { science: 1500, culture: 500 } |
| `supply_chain_management` (供应链管理) | 8 | `joint_stock_company` | logistics_hub | { science: 3000 } |

### 对 V3 原方案的修订

- §2.2-2.3 整节重写
- §2.4 商人消费的特殊处理保持不变
- 所有提到 "保留 merchant owner" 的地方改为新 owner
- 删除 `navigator_school` 建筑
- 新增 3 个纯商人岗位建筑（merchant_guild, trading_company, logistics_hub）
- `coffee_house` 商人岗位从 1 增至 3
- `dockyard` 移除商人岗位

---

## 修订后的关键参数汇总

| 参数 | 原值 | 修订值 | 位置 | 说明 |
|------|------|--------|------|------|
| merchant.startingWealth | 2000 | **500** | strata.js | 有 stone_mint 后不需要那么高 |
| stone_mint.output.silver | (无) | **0.5** | buildings.js | Epoch 0 铸币所 |
| stone_mint.maxCount | (无) | **2** | buildings.js | 日产上限 1.0 银币 |
| WEALTH_DECAY_RATE | ~~0.005~~ | **删除** | ~~gameConstants.js~~ | 不变 |
| 安全阀 void→merchant | 有 | **删除** | simulation.js | 不允许紧急货币创造 |
| 所有建筑 silver 产出 | 各异 | **全部移除** | buildings.js | 铸币所唯一来源，无例外 |
| 10个建筑 owner | merchant | **各自重分配** | buildings.js | 商人完全剥离 owner |

---

## 修订后的 Phase 实施计划变更

### Phase 0（~70 行，不变）
- ledger 追踪
- 工资直连
- 货币总量计算

### Phase 1（~300 行，增加预算制）
- sellProduction 改造 **（含预算制）**
- 9 处 void→merchant 替换
- **无安全阀**（移除）
- 建筑 owner 全部重分配（从 merchant 迁出）
- 移除**所有**建筑的银币产出 + 补偿
- 移除富裕性挥霍

### Phase 2（~150 行，新增 stone_mint）
- **stone_mint**（Epoch 0 铸币所）
- mint / royal_mint / central_bank / federal_reserve
- 4+1 个铸币科技

### Phase 3（~100 行，使用有效流动性）
- `getEffectiveMerchantLiquidity`（扣除 lockedCapital + 消费预留）
- `getMerchantLiquidityFactor`（修订版）
- sellProduction 中应用流动性系数

### Phase 4（~250 行，不变）
- 货币政策面板
- 智能建议系统
- 历史趋势图表
