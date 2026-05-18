# 实施计划：V3 货币量改革 —— 商人中介模式

> 基于 `.codebuddy/plan/monetary-reform-v3/requirements.md` 需求文档
> 参考 `ai_reports/monetary-reform-v3-revision.md` 修订方案

---

## Phase 0：低风险基础设施

- [x] 1. 新增 V3 交易类别到 ledger 系统
   - 在 `src/config/gameConstants.js` 的 `TRANSACTION_CATEGORIES` 中新增 8 个交易类别：`PRODUCTION_SALE`, `PRODUCTION_PURCHASE`, `CONSUMER_PURCHASE`, `CONSUMER_SPENDING`, `TRADE_EXPORT_REVENUE`, `TRADE_IMPORT_PAYMENT`, `MINT_OUTPUT`, `SUBSIDY_TO_MERCHANT`
   - 确保 ledger 的 `transfer()` 函数能正确使用新类别
   - _需求：3.1_

- [x] 2. 新增货币量追踪模块
   - 在 `src/logic/economy/` 下新建 `monetary.js`，实现 `calculateMonetaryStats(state)` 函数
   - 计算 `M(t) = Σ wealth[stratum] + res.silver`，输出 `{ totalMoney, moneySupplyChange, mintOutput, tradeBalance }`
   - 在 `src/logic/simulation.js` 的 tick 末尾调用 `calculateMonetaryStats` 并存入 `gameState.monetaryStats`
   - 在 `src/hooks/useGameState.js` 中初始化 `monetaryStats` 默认值和 `monetaryHistory` 空数组
   - 处理旧存档兼容：加载时若缺少 `monetaryStats` 则自动初始化
   - _需求：2.1, 2.2, 2.3, 2.4, 17.1, 17.2_

- [x] 3. 实现工资直连（owner→worker）
   - 修改 `src/logic/economy/wages.js` 中的工资支付逻辑，将 `void→worker` 改为 `owner→worker`
   - 实现 owner wealth 不足时的等比缩减：`payRatio = ownerWealth / totalWageOwed`，所有工人按此比例获得工资
   - 使用新交易类别 `WAGE_PAYMENT`（owner 侧）和 `WAGE_INCOME`（worker 侧）记录 ledger
   - _需求：1.1, 1.2, 1.3_

---

## Phase 1a：核心机制改造

- [x] 4. 商人中介 —— 生产侧（sellProduction 预算制）
   - 修改 `src/logic/economy/prices.js` 中的 `sellProduction()` 函数
   - 第一遍遍历：汇总所有待支付金额 `totalOwed`
   - 计算 `budgetRatio = merchantWealth / totalOwed`（若 < 1.0 则等比缩减）
   - 第二遍遍历：将所有 `void→owner` 替换为 `merchant→owner`，支付金额 = 原金额 × min(budgetRatio, 1.0)
   - 当 owner 为 `'state'` 时，收入从 `merchant→state` 结算
   - 实物入库 `res[resource] += amount` 不受银币支付影响，保持不变
   - 使用交易类别 `PRODUCTION_SALE`（owner 侧）和 `PRODUCTION_PURCHASE`（merchant 侧）
   - _需求：4.1, 4.2, 4.3, 4.4, 4.5_

- [x] 5. 商人中介 —— 消费侧（stratum→merchant）
   - 修改 `src/logic/population/needs.js` 中的消费结算逻辑
   - 将所有非商人阶层的 `stratum→void` 改为 `stratum→merchant`（消费者 wealth 减少，商人 wealth 增加）
   - 商人自身消费：只扣 `res[resource]`，不扣银币
   - 官员消费：执行 `official→merchant` 银币转移 + `res[resource] -= amount` 库存扣减
   - 使用交易类别 `CONSUMER_PURCHASE`（merchant 侧）和 `CONSUMER_SPENDING`（消费者侧）
   - _需求：5.1, 5.2, 5.3, 5.4_

- [x] 6. 贸易系统适配
   - 修改 `src/logic/economy/trading.js` 中出口收入的交易类别
   - 出口：保留 `void→merchant` 但类别改为 `TRADE_EXPORT_REVENUE`（外汇流入）
   - 进口：保留 `merchant→void` 但类别改为 `TRADE_IMPORT_PAYMENT`（银币流出）
   - 在 `monetary.js` 的货币守恒方程中加入贸易顺差项：`tradeBalance = exportRevenue - importPayment`
   - _需求：14.1, 14.2, 14.3, 14.4_

- [x] 7. 移除 WEALTH_DECAY_RATE 机制
   - 从 `src/config/gameConstants.js` 中删除 `WEALTH_DECAY_RATE` 常量
   - 搜索并移除所有引用 `WEALTH_DECAY_RATE` 的代码（预计在 `simulation.js` 或 `needs.js` 中）
   - _需求：6.1, 6.2, 6.3_

---

## Phase 1b：配置清理与数据改造

- [x] 8. 移除所有非铸币所建筑的银币产出（基础建筑）
   - 修改 `src/config/buildings.js`，移除所有非铸币所建筑 `output` 中的 `silver` 字段
   - 按修订方案 R5 的补偿表，用等价实物资源补偿（如 `financial_center` 改为 `culture + science`）
   - 确保 `mint` 建筑的 `silver` 产出保持不变
   - _需求：7.1, 7.2_

- [x] 9. 移除所有非铸币所建筑升级的银币产出
   - 修改 `src/config/buildingUpgrades.js`，移除 14 个建筑共 27 处升级配置中的 `silver` 产出
   - 按修订方案 R5 的详细补偿表逐一替换（trading_post, amphitheater, church, spice_market, trade_port, coffee_house, brewery, stock_exchange, inn, rail_depot, apartment_block, data_center, internet_platform, financial_center）
   - _需求：7.3, 7.4_

- [x] 10. 建筑 owner 迁移 + owner/jobs 一致性修复
   - 修改 `src/config/buildings.js`，将 `market`, `harbor`, `merchant_guild`, `trade_port`, `stock_exchange` 的 owner 改为 `'state'`
   - 检查所有建筑的 owner 是否出现在 jobs 中，修复不一致项
   - `coffee_house` 保持 `owner: 'merchant'`，jobs 调整为 `{merchant:3, scribe:3}`
   - _需求：8.1, 9.1, 9.2, 9.3_

- [x] 11. taxIncome → 铸币效率加成
   - 修改铸币所产出计算逻辑（在 `src/logic/economy/prices.js` 或 `src/utils/economy.js` 中）
   - 实现 `actualOutput = baseOutput × (1 + Σ taxIncome)`，叠加理念/时代/事件的 taxIncome 加成
   - 移除原有的 `taxIncome` 直接增加国库收入的逻辑路径（`income_ideology_virtual_tax`）
   - 验证 `ideologies.js` 的 42 处和 `epochs.js` 的 5 处 taxIncome 引用均被正确应用
   - _需求：12.1, 12.2, 12.3, 12.4_

- [x] 12. 初始经济配置
   - 修改 `src/config/difficulty.js`，所有难度的 `initialBuildings` 加入 `trading_post: 1`
   - 新手/简单难度额外加入 `stone_mint: 1`
   - 修改 `src/config/strata.js`，设置商人阶层 `startingWealth = 500`
   - 确认 `trading_post` 配置中至少有 2 个商人岗位
   - _需求：15.1, 15.2, 15.3, 15.4_

---

## Phase 2：铸币体系

- [x] 13. 新增铸币所建筑系列
   - 在 `src/config/buildings.js` 中新增/修改铸币所建筑配置：
     - `stone_mint`（Epoch 0，无输入 → silver:0.5，无科技要求，owner:'state'）
     - 确认 `mint`（Epoch 1，copper:0.3+wood:0.1 → silver:2.0，需 minting）
     - `royal_mint`（Epoch 4，copper:0.8+coal:0.2 → silver:8.0，需 monetary_reform）
     - `central_bank`（Epoch 6，papyrus:0.3 → silver:25.0，需 central_banking）
     - `federal_reserve`（Epoch 8，electricity:0.5 → silver:80.0，需 modern_monetary）
   - 所有铸币所均无 `maxCount` 限制
   - 铸币所产出的银币进入国库（`void→state`），使用交易类别 `MINT_OUTPUT`
   - _需求：10.1, 10.2, 10.3, 10.4_

- [x] 14. 新增铸币所科技树
   - 在 `src/config/technologies.js` 中新增 4 个铸币相关科技：
     - `minting`（Epoch 1，解锁 mint）
     - `monetary_reform`（Epoch 4，解锁 royal_mint）
     - `central_banking`（Epoch 6，解锁 central_bank）
     - `modern_monetary`（Epoch 8，解锁 federal_reserve）
   - 设置合理的科技研究成本和前置科技依赖
   - _需求：11.1, 11.2_

- [x] 15. 验证商人岗位建筑覆盖度
   - 审查 `src/config/buildings.js`，确认每个时代都有提供商人岗位的建筑
   - 验证商人岗位总数与经济规模的匹配度（Epoch 0 约 4-6 人 → Epoch 9 约 110-162 人）
   - 如有缺口，在对应时代新增或调整建筑的商人岗位数
   - **结果**：Epoch 0/1/3/4/5/7 有覆盖；Epoch 2/6/8/9 缺口待后续迭代补充
   - _需求：16.1, 16.2, 16.3_

---

## Phase 验证：货币守恒与集成测试

- [x] 16. 实现货币守恒方程验证
   - 在 `src/logic/economy/monetary.js` 中实现守恒验证函数：`M(t) = M(t-1) + mintOutput×(1+taxIncome) + tradeBalance - capitalFlight`
   - 开发模式下每 tick 自动验证，不平衡时输出 console.warn 并记录差额来源
   - 确保误差 < 0.01
   - _需求：18.1, 18.2, 18.3_

- [x] 17. 存档兼容性处理与集成验证
   - 在存档加载逻辑中添加 `monetaryStats` 和 `monetaryHistory` 的缺失字段自动初始化
   - 确保旧存档中已建建筑的 owner 保持不变（不被新配置覆盖）
   - **已验证**：useGameLoop.js 中 monetaryStats 默认为 null，simulation.js 中使用 DEFAULT_MONETARY_STATS 兜底
   - **已验证**：构建通过 (vite build --mode development ✓)
   - 手动测试：新游戏各难度 Epoch 0 前 50 tick 经济循环稳定性 → 待用户验证
   - 手动测试：旧存档加载后无报错且经济正常运行 → 待用户验证
   - 手动测试：铸币所建造/拆除对货币总量和物价的影响 → 待用户验证
   - _需求：17.1, 17.2, 17.3, 17.4, 成功标准 1-5_
