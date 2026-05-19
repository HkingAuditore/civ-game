# 需求文档：V3 货币量改革 —— 商人中介模式

## 引言

本需求文档定义了 civ-game 的 V3 货币量改革的完整实施需求。该改革的核心目标是：**用商人替代 void 市场，实现真正的货币守恒**。

### 背景

当前游戏采用抽象市场模型，`res` 是无主公共池，银币通过 `void→owner` 凭空创造、通过 `stratum→void` 凭空消失。V3 改革将：
- 商人作为市场中介，所有市场交易通过商人结算
- 铸币所作为唯一的货币创造来源（`void→state`）
- 国库通过税收/补贴/薪俸分配货币
- 贸易顺差/逆差作为外部货币注入/流出

### 参考文档
- `ai_reports/monetary-reform-v3-final.md`：V3 终稿方案
- `ai_reports/monetary-reform-v3-revision.md`：基于 12 条反馈的修订方案

### 影响域
- **logic**：`simulation.js`, `economy/prices.js`, `economy/wages.js`, `economy/taxes.js`, `economy/trading.js`, `population/needs.js`, `population/jobs.js`
- **config**：`buildings.js`, `buildingUpgrades.js`, `strata.js`, `difficulty.js`, `gameConstants.js`, `epochs.js`, `ideologies.js`
- **utils**：`economy.js`, `livingStandard.js`
- **components**：货币政策面板（Phase 4）

### 实施阶段概览

改革分为 5 个 Phase，本需求文档覆盖 **Phase 0 ~ Phase 2**（核心机制+配置改造+铸币体系），Phase 3（价格传导）和 Phase 4（UI面板）将在后续迭代中定义。

---

## 需求

### 需求 1：工资直连（Phase 0）

**用户故事：** 作为一名开发者，我希望建筑 owner 直接向 worker 支付工资（`owner→worker`），以便消除 `void→worker` 的货币凭空创造，为后续货币守恒打下基础。

#### 验收标准

1. WHEN 建筑产出结算时 THEN 系统 SHALL 将工资支付路径从 `void→worker` 改为 `owner→worker`，owner 的 wealth 减少，worker 的 wealth 增加
2. WHEN owner 的 wealth 不足以支付全部工资时 THEN 系统 SHALL 按 `wealth / totalWageOwed` 的比例等比缩减所有工人的工资
3. WHEN 工资支付发生时 THEN ledger SHALL 记录交易类别为 `TRANSACTION_CATEGORIES.EXPENSE.WAGE_PAYMENT`（owner 侧）和 `TRANSACTION_CATEGORIES.INCOME.WAGE_INCOME`（worker 侧）

---

### 需求 2：货币量追踪（Phase 0）

**用户故事：** 作为一名玩家，我希望系统能追踪和展示货币总量（M）及其变化趋势，以便我理解经济的宏观状态并做出决策。

#### 验收标准

1. WHEN 每个 tick 结束时 THEN 系统 SHALL 计算 `M(t) = Σ wealth[stratum] + res.silver`（所有阶层财富总和 + 国库银币）
2. WHEN 货币量计算完成时 THEN 系统 SHALL 将 `monetaryStats` 存入 gameState，包含：`totalMoney`, `moneySupplyChange`, `mintOutput`, `tradeBalance`, `capitalFlight`
3. WHEN 新游戏开始时 THEN 系统 SHALL 初始化 `monetaryStats` 为默认值，`monetaryHistory` 为空数组
4. IF 加载旧存档且 `monetaryStats` 不存在 THEN 系统 SHALL 自动初始化为默认值，不影响游戏运行

---

### 需求 3：新交易类别（Phase 0）

**用户故事：** 作为一名开发者，我希望 ledger 系统新增 V3 所需的交易类别，以便准确分类和追踪所有货币流动。

#### 验收标准

1. WHEN ledger 系统初始化时 THEN 系统 SHALL 包含以下新交易类别：
   - `INCOME.PRODUCTION_SALE`（生产者卖给商人）
   - `EXPENSE.PRODUCTION_PURCHASE`（商人买入生产品）
   - `INCOME.CONSUMER_PURCHASE`（消费者向商人购买）
   - `EXPENSE.CONSUMER_SPENDING`（消费者消费支出）
   - `INCOME.TRADE_EXPORT_REVENUE`（出口外汇流入）
   - `EXPENSE.TRADE_IMPORT_PAYMENT`（进口银币流出）
   - `INCOME.MINT_OUTPUT`（铸币所产出）
   - `EXPENSE.SUBSIDY_TO_MERCHANT`（国库补贴商人）

---

### 需求 4：商人中介 —— 生产侧（Phase 1a 核心）

**用户故事：** 作为一名玩家，我希望建筑的产出通过商人中介结算（而非凭空获得银币），以便实现真正的货币守恒，让我的铸币决策有实际意义。

#### 验收标准

1. WHEN `sellProduction()` 执行时 THEN 系统 SHALL 将所有 `void→owner` 的收入结算改为 `merchant→owner`，商人 wealth 减少，owner wealth 增加
2. WHEN 商人 wealth 不足以支付所有生产者时 THEN 系统 SHALL 采用**实时预算制**：`budgetRatio = merchantWealth / totalOwed`，所有生产者按此比例等比缩减收入
3. WHEN `budgetRatio < 1.0` 时 THEN 系统 SHALL 记录差额但**不从 void 补充**（无安全阀），差额自然传导为通缩信号
4. WHEN 生产结算完成时 THEN 系统 SHALL 确保 `res[resource] += amount` 仍然正常执行（实物入库不受银币支付影响）
5. WHEN 建筑的 owner 是 `'state'` 时 THEN 系统 SHALL 将生产收入从 `merchant→state` 结算（国库直接获得）

---

### 需求 5：商人中介 —— 消费侧（Phase 1a 核心）

**用户故事：** 作为一名玩家，我希望各阶层的消费通过商人中介结算（而非凭空消失银币），以便货币在消费环节也守恒。

#### 验收标准

1. WHEN 农民/工人/贵族等阶层消费资源时 THEN 系统 SHALL 将 `stratum→void` 改为 `stratum→merchant`，消费者 wealth 减少，商人 wealth 增加
2. WHEN 商人自身消费资源时 THEN 系统 SHALL 只扣减 `res[resource]`（库存减少），**不扣减商人银币**（从自己库存取用）
3. WHEN 官员（official）消费资源时 THEN 系统 SHALL 执行 `official→merchant` 的银币转移 + `res[resource] -= amount` 的库存扣减（官员也找商人买东西）
4. WHEN 消费者 wealth 不足以支付消费时 THEN 系统 SHALL 按现有逻辑处理（减少消费量或降低生活水平）

---

### 需求 6：移除富裕性挥霍（Phase 1a）

**用户故事：** 作为一名开发者，我希望移除 `WEALTH_DECAY_RATE` 机制，以便在商人中介模式下不再需要人为的财富衰减来维持平衡。

#### 验收标准

1. WHEN 系统初始化时 THEN `gameConstants.js` 中 SHALL 不再包含 `WEALTH_DECAY_RATE` 常量
2. WHEN 每 tick 执行时 THEN 系统 SHALL 不再对任何阶层执行基于 `WEALTH_DECAY_RATE` 的财富衰减
3. IF 存在引用 `WEALTH_DECAY_RATE` 的代码 THEN 系统 SHALL 移除所有相关引用

---

### 需求 7：移除所有非铸币所建筑的银币产出（Phase 1b 配置）

**用户故事：** 作为一名玩家，我希望只有铸币所能产出银币，以便我的铸币决策是控制货币供给的唯一手段，增加策略深度。

#### 验收标准

1. WHEN 建筑配置加载时 THEN `buildings.js` 中所有非铸币所建筑的 `output.silver` SHALL 被移除
2. WHEN 银币产出被移除时 THEN 系统 SHALL 用等价的实物资源产出补偿，确保建筑的总经济价值大致不变。具体补偿方案参见 `monetary-reform-v3-revision.md` R5 章节
3. WHEN 建筑升级配置加载时 THEN `buildingUpgrades.js` 中所有非铸币所建筑升级的 `output.silver` SHALL 被移除，并用实物资源补偿。涉及 14 个建筑的 27 处升级配置
4. WHEN 纯银币产出建筑（如 `financial_center`）的银币被移除时 THEN 系统 SHALL 改为产出 `culture` + `science`（知识经济转型）

---

### 需求 8：建筑 owner 迁移为 state（Phase 1b 配置）

**用户故事：** 作为一名玩家，我希望部分商人建筑由国家运营（`owner: 'state'`），以便国库通过支付商人工资向市场注入流动性，给我更多的经济调控手段。

#### 验收标准

1. WHEN 建筑配置加载时 THEN 以下建筑的 `owner` SHALL 改为 `'state'`：`market`, `harbor`, `merchant_guild`, `trade_port`, `stock_exchange`
2. WHEN state-owned 商人建筑运营时 THEN 系统 SHALL 从国库（`state`）支付商人岗位的工资（`state→merchant`）
3. WHEN 旧存档加载时 THEN 已建建筑的 owner SHALL 保持不变（仅新建建筑使用新 owner）

---

### 需求 9：owner/jobs 一致性规则（Phase 1b 配置）

**用户故事：** 作为一名开发者，我希望所有建筑的 owner 阶层都出现在 jobs 中，以便消除设计不一致导致的潜在 bug。

#### 验收标准

1. WHEN 建筑配置中 `owner` 为某阶层 THEN 该阶层 SHALL 出现在该建筑的 `jobs` 配置中
2. IF 发现 `owner` 阶层不在 `jobs` 中 THEN 系统 SHALL 将 jobs 中不匹配的岗位替换为 owner 阶层的岗位
3. WHEN `coffee_house` 配置加载时 THEN 其 `owner` SHALL 保持为 `'merchant'`，`jobs` 调整为 `{merchant:3, scribe:3}`

---

### 需求 10：铸币所建筑体系（Phase 2）

**用户故事：** 作为一名玩家，我希望每个时代都有对应的铸币所建筑，且没有建造数量上限，以便我自由探索"印多少钱合适"这一核心决策。

#### 验收标准

1. WHEN Epoch 0 开始时 THEN 系统 SHALL 提供 `stone_mint` 建筑（无输入，产出 silver:0.5，无科技解锁要求）
2. WHEN 各时代铸币所配置加载时 THEN 系统 SHALL 包含以下铸币所且**无 maxCount 限制**：
   - Epoch 0: `stone_mint`（无输入 → silver:0.5）
   - Epoch 1: `mint`（copper:0.3, wood:0.1 → silver:2.0，需 `minting` 科技）
   - Epoch 4: `royal_mint`（copper:0.8, coal:0.2 → silver:8.0，需 `monetary_reform` 科技）
   - Epoch 6: `central_bank`（papyrus:0.3 → silver:25.0，需 `central_banking` 科技）
   - Epoch 8: `federal_reserve`（electricity:0.5 → silver:80.0，需 `modern_monetary` 科技）
3. WHEN 铸币所产出银币时 THEN 银币 SHALL 进入国库（`void→state`），不直接进入商人
4. WHEN 玩家建造过多铸币所导致通胀时 THEN 系统 SHALL 通过物价上涨、民众不满等现有机制自然惩罚（不设人为上限）

---

### 需求 11：铸币所科技树（Phase 2）

**用户故事：** 作为一名玩家，我希望通过研究科技来解锁更高级的铸币所，以便铸币能力随时代进步而增长。

#### 验收标准

1. WHEN 科技树加载时 THEN 系统 SHALL 包含以下铸币相关科技：
   - `minting`（Epoch 1，解锁 mint）
   - `monetary_reform`（Epoch 4，解锁 royal_mint）
   - `central_banking`（Epoch 6，解锁 central_bank）
   - `modern_monetary`（Epoch 8，解锁 federal_reserve）
2. WHEN 铸币科技被研究完成时 THEN 对应的铸币所建筑 SHALL 出现在建造列表中

---

### 需求 12：taxIncome → 铸币效率加成（Phase 1b）

**用户故事：** 作为一名玩家，我希望理念系统中的 `taxIncome` 加成能提高铸币所的产出效率，以便理念选择与货币政策产生有意义的联动。

#### 验收标准

1. WHEN 铸币所计算产出时 THEN 系统 SHALL 将所有 `taxIncome` 加成（理念+时代+事件）叠加为铸币效率倍率：`actualOutput = baseOutput × (1 + Σ taxIncome)`
2. WHEN `ideologies.js` 中的 `taxIncome` 加成生效时 THEN 系统 SHALL 将其应用于铸币所产出计算（42 处引用）
3. WHEN `epochs.js` 中的时代 `taxIncome` 加成生效时 THEN 系统 SHALL 将其应用于铸币所产出计算（5 处引用：封建 0.10、探索 0.25、电气 0.15、原子 0.18、信息 0.20）
4. IF `taxIncome` 叠加后总倍率超过合理范围 THEN 系统 SHALL 考虑设置上限（具体值待调参）

---

### 需求 13：resourcePercent.silver 语义变化（Phase 1b）

**用户故事：** 作为一名玩家，我希望事件中的"银币产出+X%"效果能直接影响铸币所产量，以便这些事件在新系统中有更明确的策略意义。

#### 验收标准

1. WHEN 只有铸币所产出 silver 时 THEN `resourcePercent: { silver: X }` SHALL 自动仅影响铸币所产出（无需代码改动，由现有 resourcePercent 应用逻辑保证）
2. WHEN `economicEvents.js` 中的 50 处 `resourcePercent.silver` 事件触发时 THEN 效果 SHALL 等价于"铸币所产量 +X%"

---

### 需求 14：贸易系统适配（Phase 1a）

**用户故事：** 作为一名玩家，我希望贸易系统与货币守恒兼容——出口带来外汇流入，进口消耗银币，以便贸易政策与货币政策产生深层联动。

#### 验收标准

1. WHEN 出口交易发生时 THEN 系统 SHALL 保留 `void→merchant` 的收款（外汇流入不违反国内货币守恒），但交易类别改为 `TRADE_EXPORT_REVENUE`
2. WHEN 进口交易发生时 THEN 系统 SHALL 保留 `merchant→void` 的付款（银币流出国境），资源进入 `res` 后参与后续交易流程
3. WHEN 贸易顺差时 THEN 系统 SHALL 在货币守恒方程中体现为外部货币净流入（`dM/dt` 增加）
4. WHEN 贸易逆差时 THEN 系统 SHALL 在货币守恒方程中体现为货币净流出（`dM/dt` 减少）

---

### 需求 15：初始经济配置（Phase 1b）

**用户故事：** 作为一名玩家，我希望开局就有初始商人建筑、商人群体和初始商人财富，以便经济循环从第一天就能运转。

#### 验收标准

1. WHEN 新游戏开始时 THEN `difficulty.js` 中所有难度的 `initialBuildings` SHALL 包含 `trading_post: 1`
2. WHEN 新手或简单难度开始时 THEN `initialBuildings` SHALL 额外包含 `stone_mint: 1`
3. WHEN 新游戏开始时 THEN 商人阶层 SHALL 拥有 `startingWealth = 500` 的初始财富
4. WHEN `trading_post` 建成时 THEN 系统 SHALL 提供至少 2 个商人岗位，确保开局有商人群体

---

### 需求 16：商人岗位建筑（Phase 2）

**用户故事：** 作为一名玩家，我希望每个时代都有对应的商人岗位建筑，以便商人人口能随经济规模增长。

#### 验收标准

1. WHEN 各时代建筑配置加载时 THEN 系统 SHALL 确保每个时代都有提供商人岗位的建筑
2. WHEN 商人岗位建筑的 owner 为 `'state'` 时 THEN 国库 SHALL 支付该建筑中商人的工资
3. WHEN 商人人口增长时 THEN 系统 SHALL 确保商人岗位总数与经济规模大致匹配（Epoch 0 约 4-6 人，Epoch 9 约 110-162 人）

---

### 需求 17：存档兼容性

**用户故事：** 作为一名玩家，我希望旧存档在 V3 改革后仍能正常加载和运行，以便我不会丢失游戏进度。

#### 验收标准

1. IF 加载旧存档且缺少 `monetaryStats` 字段 THEN 系统 SHALL 自动初始化为默认值
2. IF 加载旧存档且缺少 `monetaryHistory` 字段 THEN 系统 SHALL 初始化为空数组
3. WHEN 旧存档中已建建筑的 owner 与新配置不同时 THEN 系统 SHALL 保持旧存档中的 owner 不变
4. WHEN 旧存档中不存在新建筑（如 `stone_mint`）时 THEN 系统 SHALL 正常运行，不报错

---

### 需求 18：货币守恒方程

**用户故事：** 作为一名开发者，我希望系统在每个 tick 都满足货币守恒方程，以便验证实现的正确性。

#### 验收标准

1. WHEN 每个 tick 结束时 THEN 系统 SHALL 满足：`M(t) = M(t-1) + 铸币产出×(1+taxIncome) + 贸易顺差 - 资本外逃`
2. WHEN 开发/调试模式下 THEN 系统 SHALL 可选地验证货币守恒方程，如果不平衡则输出警告
3. WHEN 货币守恒方程中出现不平衡 THEN 系统 SHALL 记录差额来源（哪个环节的 void 交易未被替换）

---

## 边界情况与风险

### 边界情况

1. **Epoch 0 冷启动**：只有 trading_post(1座) + stone_mint(新手/简单有1座)，商人 wealth=500，需验证是否足够启动经济循环
2. **商人 wealth 归零**：所有生产者收入为 0，经济停摆——这是**有意义的游戏状态**，不是 bug
3. **taxIncome 叠加溢出**：理念+时代+事件叠加后铸币效率可能超过 +100%，需要考虑是否设 cap
4. **官员消费量过大**：官员消费如果很大，可能过快消耗商人流动性
5. **贸易顺差通胀**：大量出口导致的外汇流入可能造成不可控通胀
6. **旧存档中建筑 owner 不一致**：旧存档保持旧 owner，新建筑使用新 owner，同一类建筑可能有不同 owner

### 技术限制

1. `resourcePercent.silver` 的语义变化依赖于"只有铸币所产出 silver"这一前提——必须确保所有非铸币所的 silver 产出都被移除
2. `taxIncome` 的重新解释需要修改铸币所产出计算逻辑，不能简单复用现有的 `taxIncome` 应用路径
3. 预算制的实时计算需要在 `sellProduction` 中先汇总所有待支付金额，再按比例分配——这改变了当前的逐建筑结算顺序

### 成功标准

1. 货币守恒方程在每个 tick 都成立（误差 < 0.01）
2. Epoch 0 新游戏能在 50 tick 内建立稳定的经济循环
3. 所有难度下，经济不会在前 100 tick 内崩溃
4. 旧存档加载后游戏正常运行，无报错
5. 铸币所建造/拆除能明显影响货币总量和物价水平
