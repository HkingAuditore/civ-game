# Simulation.js 重构报告

## 概述

原始的 `simulation.js` 文件有约 5000 行代码，已被拆分为多个模块，以提高代码的可维护性和可读性。

## 新的目录结构

```
src/logic/
├── index.js                    # 统一导出入口
├── simulation.js               # 主入口（保留，后续可逐步简化）
│
├── utils/
│   ├── index.js               # Utils 导出
│   ├── constants.js           # 常量定义（~60行）
│   └── helpers.js             # 辅助函数（~110行）
│
├── economy/
│   ├── index.js               # Economy 导出
│   ├── wages.js               # 工资和生活成本计算（~170行）
│   ├── prices.js              # 价格计算和市场更新（~240行）
│   ├── taxes.js               # 税收计算（~150行）
│   └── trading.js             # 商人交易系统（~380行）
│
├── population/
│   ├── index.js               # Population 导出
│   ├── jobs.js                # 职业分配和岗位管理（~280行）
│   ├── needs.js               # 需求满足和资源消费（~280行）
│   └── growth.js              # 人口增长、死亡、外流（~230行）
│
├── stability/
│   ├── index.js               # Stability 导出
│   ├── approval.js            # 阶层满意度计算（~170行）
│   └── buffs.js               # Buff/Debuff 和稳定性（~150行）
│
├── buildings/
│   ├── index.js               # Buildings 导出
│   └── effects.js             # 政令/科技效果应用（~200行）
│
├── diplomacy/
│   ├── index.js               # Diplomacy 导出
│   └── nations.js             # AI国家更新、战争、外交（~550行）
│
└── 已有模块（未变动）
    ├── demands.js
    ├── organizationPenalties.js
    ├── organizationSystem.js
    ├── promiseTasks.js
    ├── rebellionSystem.js
    └── strategicActions.js
```

## 模块说明

### 1. Utils 模块 (`utils/`)

**constants.js** - 常量定义
- `ROLE_PRIORITY` - 职业优先级列表
- `JOB_MIGRATION_RATIO` - 职业迁移比例
- `PRICE_FLOOR` - 价格下限
- `BASE_WAGE_REFERENCE` - 基础工资参考值
- `SPECIAL_TRADE_RESOURCES` - 特殊交易资源
- 人口增长相关常量
- 战争相关常量

**helpers.js** - 辅助函数
- `clamp()` - 值限制函数
- `isTradableResource()` - 判断资源是否可交易
- `getBasePrice()` - 获取资源基础价格
- `scaleEffectValues()` - 缩放效果值
- `computePriceMultiplier()` - 计算价格乘数
- `calculateMinProfitMargin()` - 计算最低利润率

### 2. Economy 模块 (`economy/`)

**wages.js** - 工资计算
- `computeLivingCosts()` - 计算生活成本
- `buildLivingCostMap()` - 构建生活成本映射
- `getLivingCostFloor()` - 获取生活成本下限
- `getExpectedWage()` - 获取预期工资
- `calculateWeightedAverageWage()` - 计算加权平均工资
- `updateWages()` - 更新工资

**prices.js** - 价格计算
- `calculateResourceCost()` - 计算资源成本
- `updateMarketPrices()` - 更新市场价格

**taxes.js** - 税收计算
- `initializeTaxBreakdown()` - 初始化税收分解
- `getHeadTaxRate()` - 获取人头税率
- `getResourceTaxRate()` - 获取资源税率
- `getBusinessTaxRate()` - 获取营业税率
- `collectHeadTax()` - 征收人头税
- `calculateFinalTaxes()` - 计算最终税收

**trading.js** - 商人交易
- `simulateMerchantTrade()` - 模拟商人交易
- `DEFAULT_TRADE_CONFIG` - 默认交易配置

### 3. Population 模块 (`population/`)

**jobs.js** - 职业管理
- `initializeJobsAvailable()` - 初始化可用岗位
- `initializeWageTracking()` - 初始化工资追踪
- `initializeExpenseTracking()` - 初始化支出追踪
- `allocatePopulation()` - 分配人口到岗位
- `handleLayoffs()` - 处理裁员
- `fillVacancies()` - 填补空缺
- `handleJobMigration()` - 处理职业迁移

**needs.js** - 需求满足
- `processNeedsConsumption()` - 处理需求消费
- `calculateLivingStandards()` - 计算生活水平
- `calculateLaborEfficiency()` - 计算劳动效率

**growth.js** - 人口增长
- `calculateFertilityGrowth()` - 计算生育增长
- `calculateStarvationDeaths()` - 计算饥饿死亡
- `calculateExodus()` - 计算人口外流

### 4. Stability 模块 (`stability/`)

**approval.js** - 满意度
- `calculateClassApproval()` - 计算阶层满意度
- `calculateDecreeApprovalModifiers()` - 计算政令满意度修正

**buffs.js** - Buff 和稳定性
- `calculateBuffsAndDebuffs()` - 计算 Buff/Debuff
- `calculateStability()` - 计算稳定性
- `calculateClassInfluence()` - 计算阶层影响力

### 5. Buildings 模块 (`buildings/`)

**effects.js** - 建筑效果
- `initializeBonuses()` - 初始化加成结构
- `applyEffects()` - 应用效果
- `applyTechEffects()` - 应用科技效果
- `applyDecreeEffects()` - 应用政令效果
- `applyFestivalEffects()` - 应用节日效果
- `calculateTotalMaxPop()` - 计算总人口上限

### 6. Diplomacy 模块 (`diplomacy/`)

**nations.js** - AI 国家
- `updateNations()` - 更新所有 AI 国家

## 使用方式

### 导入模块

```javascript
// 方式 1: 从各模块单独导入
import { computeLivingCosts, buildLivingCostMap } from './logic/economy/wages';
import { calculateClassApproval } from './logic/stability/approval';

// 方式 2: 从统一入口导入
import { 
    computeLivingCosts, 
    buildLivingCostMap,
    calculateClassApproval,
    simulateTick 
} from './logic';

// 方式 3: 保持向后兼容
import { simulateTick } from './logic/simulation';
```

### 渐进式迁移

1. **第一阶段**: 新模块与原始 `simulation.js` 共存
   - 新代码可以使用拆分后的模块
   - 原始 `simulateTick` 保持不变

2. **第二阶段**: 逐步替换 `simulateTick` 内部实现
   - 将 `simulateTick` 内的代码替换为调用新模块
   - 每次替换后进行测试

3. **第三阶段**: 完全迁移
   - `simulation.js` 仅作为入口文件
   - 所有逻辑在子模块中实现

## 当前迁移状态 (2025-12-16)

### ✅ 已完成

1. **模块创建**: 所有新模块文件已创建完成
2. **导入整合**: `simulation.js` 已添加新模块的导入语句
3. **代码注释**: 以下本地定义已被注释（从新模块导入替代）：
   - `ROLE_PRIORITY` - 从 `./utils/constants` 导入
   - `JOB_MIGRATION_RATIO` - 从 `./utils/constants` 导入
   - `clamp()` - 从 `./utils/helpers` 导入
   - `SPECIAL_TRADE_RESOURCES` - 从 `./utils/constants` 导入
   - `isTradableResource()` - 从 `./utils/helpers` 导入
   - `PEACE_REQUEST_COOLDOWN_DAYS` - 从 `./utils/constants` 导入
   - `getBasePrice()` - 从 `./utils/helpers` 导入
   - `PRICE_FLOOR` - 从 `./utils/constants` 导入
   - `BASE_WAGE_REFERENCE` - 从 `./utils/constants` 导入
   - `calculateResourceCost()` - 从 `./economy/prices` 导入
   - `computeLivingCosts()` - 从 `./economy/wages` 导入
   - `buildLivingCostMap()` - 从 `./economy/wages` 导入
   - `scaleEffectValues()` - 从 `./utils/helpers` 导入
   - 商人相关常量 - 从 `./utils/constants` 导入

4. **构建验证**: 项目构建成功，无语法错误

5. **`simulateTick` 内部重构 (第二阶段)**:
   - `taxBreakdown` 初始化使用 `initializeTaxBreakdown()` 替换
   - 建筑加成变量使用 `initializeBonuses()` 初始化
   - `computePriceMultiplier` 本地定义已注释，使用导入版本
   - 本地 `applyEffects` 闭包已注释，使用模块函数替代：
     - `applyTechEffects(techsUnlocked, bonuses)`
     - `applyDecreeEffects(decrees, bonuses)`
     - `applyFestivalEffects(activeFestivalEffects, bonuses)`
   - 人口增长常量使用导入版本：
     - `FERTILITY_BASE_RATE`, `FERTILITY_BASELINE_RATE`
     - `LOW_POP_THRESHOLD`, `LOW_POP_GUARANTEE`
     - `WEALTH_BASELINE`
   - 稳定性常量 `STABILITY_INERTIA` 使用导入版本
   - 战争常量使用导入版本：
     - `MAX_CONCURRENT_WARS`, `GLOBAL_WAR_COOLDOWN`

### 🔄 待完成

1. **保留的本地定义** (尚未迁移):
   - `initializeWealth()` - 财富初始化
   - `TECH_MAP` - 科技映射
   - `simulateMerchantTrade()` - 完整版在 `./economy/trading.js`，但本地版仍在使用

2. **`simulateTick` 内部替换** (下一步):
   - 将 `simulateTick` 内部的逻辑替换为调用新模块函数
   - 例如：用 `initializeTaxBreakdown()` 替换内联的税收初始化
   - 用模块函数替换人口分配、需求计算等逻辑

3. **函数签名对齐**:
   - 确保新模块函数的参数与 `simulateTick` 内部调用兼容

## 测试建议

1. **单元测试**: 为每个新模块编写单元测试
2. **集成测试**: 确保模块之间协同工作
3. **回归测试**: 对比重构前后的游戏行为

## 后续优化

1. 继续拆分 `simulation.js` 中的建筑生产逻辑
2. 优化 `nations.js` 中的 AI vs AI 战争逻辑
3. 添加 TypeScript 类型定义
4. 添加 JSDoc 文档注释

## 文件统计

| 模块 | 文件数 | 总行数 |
|------|--------|--------|
| utils | 3 | ~189 |
| economy | 5 | ~1024 |
| population | 4 | ~937 |
| stability | 3 | ~342 |
| buildings | 2 | ~198 |
| diplomacy | 5 | ~1867 |
| **总计** | **22** | **~4557** |

原始 `simulation.js`: ~5009 行

重构后代码更加模块化，每个文件职责清晰，便于维护和测试。

---

## 文件行数对比

| 阶段 | simulation.js | 新模块总计 | 说明 |
|------|--------------|-----------|------|
| 重构前 | 5009 行 | 0 行 | 所有代码在单一文件 |
| 第一阶段 | 5116 行 | 3263 行 | 包含注释块和新导入 |
| 第二阶段 | 5101 行 | 3263 行 | 更多代码使用模块函数 |
| 第三阶段 | 4464 行 | 3263 行 | simulateMerchantTrade 已迁移 |
| 第四阶段 | 4403 行 | 3287 行 | 更多函数/常量迁移 |
| 第五阶段 | 3521 行 | ~4450 行 | AI/外交模块迁移+代码替换 |
| **第六阶段** | **2985 行** | **~4557 行** | **AI战争+AI经济全面迁移** |
| 最终目标 | ~1500 行 | ~5000 行 | simulateTick 作为协调者 |

### 当前状态统计 (第六阶段完成)
- `simulation.js`: **2985 行**（减少 2024 行，40.4%）
- 新模块总计: ~4557 行
- **总计行数**: ~7542 行
- 文件大小: ~137KB

## 变更日志

### 2025-12-16 (第六阶段) - AI战争系统+AI经济全面迁移
- **aiWar.js 新增函数**:
  - `processCollectiveAttackWarmonger` - 集体攻击好战者
  - `processAIAIWarDeclaration` - AI-AI 宣战系统
  - `processAIAIWarProgression` - AI-AI 战争处理
  - aiWar.js 从 ~640 行增加到 **~920 行**
- **内联代码替换** (20 处，新增 5 处):
  15. 集体攻击好战者: ~32 行 → ~2 行
  16. AI-AI 宣战逻辑: ~210 行 → ~2 行
  17. AI-AI 战争处理: ~126 行 → ~2 行
  18. 外国经济模拟: ~65 行 → ~2 行
  19. 人口与财富波动模型: ~115 行 → ~8 行
- **simulation.js**: 从 3521 行减少到 **2985 行** (减少 536 行)
- **累计减少**: 从 5009 行减少到 2985 行 (**-2024 行, -40.4%**)
- **构建验证**: 全部通过

### 2025-12-16 (第五阶段) - AI/外交模块迁移
- **新模块创建**:
  - `aiWar.js` (~640行) - AI 战争逻辑
  - `aiDiplomacy.js` (~340行) - AI 外交行为
  - `aiEconomy.js` (~307行) - AI 经济模拟
- **内联代码替换** (15 处):
  1. 叛军逻辑: ~140 行 → ~20 行
  2. 关系衰减+解盟: ~40 行 → ~6 行
  3. AI 军事行动: ~276 行 → ~12 行
  4. 和平/投降请求: ~55 行 → ~5 行
  5. 宣战逻辑: ~86 行 → ~11 行
  6. 分期赔款+战后恢复: ~23 行 → ~8 行
  7. 国家关系初始化: ~30 行 → ~2 行
  8. 月度关系衰减: ~24 行 → ~5 行
  9. 盟友冷淡事件: ~21 行 → ~2 行
  10. AI送礼外交: ~58 行 → ~2 行
  11. AI-AI贸易: ~40 行 → ~2 行
  12. AI-玩家贸易: ~92 行 → ~2 行
  13. AI-玩家互动: ~64 行 → ~2 行
  14. AI-AI结盟: ~38 行 → ~2 行
- **simulation.js**: 从 5009 行减少到 **3521 行** (减少 1488 行, 29.7%)
- **构建验证**: 全部通过

### 2025-12-16 (第四阶段)
- **常量/函数迁移**:
  - `initializeWealth` 迁移到 `./population/growth.js`
  - `TECH_MAP` 迁移到 `./utils/constants.js`
- **代码清理**:
  - 删除本地 `calculateMinProfitMargin` 函数（~28行）
  - 删除已注释的 `computePriceMultiplier` 函数（~18行）
  - 简化 REFACTORED 注释
- **文件大小**: 从 4451 行减少到 4403 行

### 2025-12-16 (第三阶段)
- **simulateMerchantTrade 迁移**:
  - 本地 `simulateMerchantTrade` 函数（~355行）已删除
  - 改为从 `./economy/trading` 模块导入
- **代码清理**:
  - 删除所有已注释的迁移代码块（约 150 行）
  - 简化 REFACTORED 注释为简洁说明
- **文件大小减少**: 从 5009 行减少到 4464 行（减少 ~545 行）

### 2025-12-16 (第二阶段)
- **效果系统迁移**: 
  - 本地 `applyEffects` 闭包替换为模块函数
  - 使用 `applyTechEffects`, `applyDecreeEffects`, `applyFestivalEffects`
- **常量统一**: 
  - 人口增长常量迁移到模块并在 simulateTick 中使用
  - 稳定性常量 `STABILITY_INERTIA` 使用导入版本
  - 战争常量 `MAX_CONCURRENT_WARS`, `GLOBAL_WAR_COOLDOWN` 使用导入版本
- **代码清理**: 注释掉约 200 行已迁移的本地代码

### 2025-12-16 (第一阶段)
- 初始重构：创建所有新模块（19个文件）
- 添加模块导入语句到 `simulation.js`
- 注释掉重复的常量和函数定义
- `taxBreakdown` 使用 `initializeTaxBreakdown()` 替换
- `bonuses` 使用 `initializeBonuses()` 初始化
- `computePriceMultiplier` 本地定义已注释

---

*创建时间: 2025-12-16*
*最后更新: 2025-12-16*
*作者: AI Assistant*
