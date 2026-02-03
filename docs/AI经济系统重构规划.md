# AI经济系统重构规划

## 🔥 当前问题分析

### 1. **代码组织混乱**

#### 问题描述
AI经济逻辑分散在多个文件中，职责不清晰：

- `aiEconomy.js` (739行) - 处理增长、库存、发展
- `nations.js` (1998行，大文件) - 处理外交、战争、经济更新
- `vassalSystem.js` (1998行，大文件) - 处理附庸系统
- `autonomousInvestment.js` - 处理AI投资
- `economyUtils.js` - 工具函数

**具体问题：**
- 同一个功能（如人口增长）在多个地方都有代码
- 函数之间相互调用关系复杂，难以追踪
- 注释中充满了 `[FIX]`、`[FIX v2]`、`[FIX v3]`、`[FIX v4]` 等补丁标记
- 大量的"移除重复增长"、"防止双重增长"等注释，说明之前有严重的bug

#### 示例代码
```javascript
// nations.js 中的注释
// [FIX] REMOVED INDEPENDENT GROWTH - Population growth is now handled ONLY by 
// processAIIndependentGrowth in aiEconomy.js using logistic growth model
// This duplicate growth logic was causing MULTIPLE GROWTH BUG!

// aiEconomy.js 中的注释
// [FIX] REMOVED POPULATION DRIFT - Population is now handled ONLY by processAIIndependentGrowth
// This function should only update economy traits and wealth, NOT population
// Having two functions modify population caused DOUBLE GROWTH BUG!
```

### 2. **数据流混乱**

#### 问题描述
AI国家的经济数据有多个来源和更新点：

```
nation.population          // 当前人口
nation.wealth             // 当前财富
nation.economyTraits.ownBasePopulation  // 基础人口
nation.economyTraits.ownBaseWealth      // 基础财富
nation.economyTraits.basePopulation     // 目标人口
nation.economyTraits.baseWealth         // 目标财富
nation.gdp                // GDP（有时用wealth代替）
nation.budget             // 预算
nation.inventory          // 资源库存
nation.nationPrices       // 资源价格
nation.socialStructure    // 社会结构
```

**问题：**
- 太多相似的字段，不清楚哪个是"真实值"
- `ownBasePopulation` vs `basePopulation` vs `population` - 三者关系不清
- 更新逻辑分散，容易出现不一致

### 3. **增长模型问题**

#### 当前实现
```javascript
// processAIIndependentGrowth - 每10 ticks执行一次
// 1. 使用 logistic growth 模型计算新人口
// 2. 应用战争惩罚
// 3. 应用最小增长保证（各种补丁）
// 4. 财富增长与人口增长绑定
// 5. 应用人均财富上限

// updateAIDevelopment - 每tick执行一次
// 1. 计算目标人口和财富
// 2. 应用战争伤亡
// 3. 应用财富波动
// 4. 更新预算
```

**问题：**
- 两个函数都在修改人口和财富，容易冲突
- 大量的"最小增长保证"补丁，说明模型本身有问题
- 人均财富上限是硬编码的，不够灵活
- 战争惩罚在多个地方应用，可能重复

### 4. **时间管理混乱**

#### 问题描述
```javascript
nation.economyTraits.lastGrowthTick        // 上次增长时间
nation.economyTraits.lastDevelopmentTick   // 上次发展时间
nation._lastEpochUpgradeTick               // 上次时代升级时间
```

**问题：**
- 多个时间戳，容易出现同步问题
- 大量的"修复未来时间戳"代码，说明存在时间倒流bug
- `ticksSinceLastUpdate` 计算在多个地方重复

### 5. **魔法数字泛滥**

#### 示例
```javascript
const epochMultiplier = 1 + epoch * 0.5 + Math.pow(epoch, 1.3) * 0.1;
const wealthFactor = Math.max(0.8, Math.min(2.0, (next.wealth || 1000) / 1000));
const warConsumptionMultiplier = isInAnyWar ? (1.3 + (next.aggression || 0.2) * 0.5) : 1.0;
const populationSoftCap = Math.max(200, playerPopulationBaseline * 0.8, (next.economyTraits?.ownBasePopulation || 16) * 10);
const perCapitaWealthCap = Math.min(50000, 2000 * Math.pow(2, Math.min(epoch, 4)));
```

**问题：**
- 大量硬编码的数字，不知道为什么是这个值
- 难以调整和平衡
- 没有统一的配置文件

### 6. **错误处理不足**

#### 问题描述
```javascript
// 大量的防御性代码
if (!next.economyTraits) next.economyTraits = {};
if (!Number.isFinite(next.population) || next.population < 1) {
    next.population = next.economyTraits.ownBasePopulation;
}
const safePlayerPopulation = Number.isFinite(playerPopulation) && playerPopulation > 0 
    ? playerPopulation 
    : 100;
```

**问题：**
- 到处都是空值检查和默认值
- 说明数据初始化不完整
- 缺少统一的数据验证机制

---

## 🎯 重构目标

### 1. **清晰的职责分离**
- 每个模块只负责一件事
- 数据流向清晰可追踪
- 减少模块间的耦合

### 2. **统一的数据模型**
- 明确的数据结构定义
- 单一数据源原则
- 完整的数据验证

### 3. **可配置的参数系统**
- 所有魔法数字移到配置文件
- 支持难度调整
- 支持运行时调整

### 4. **可测试的代码**
- 纯函数优先
- 减少副作用
- 便于单元测试

---

## 📋 重构方案

### 阶段一：数据模型重构（优先级：🔴 最高）

#### 1.1 创建统一的AI国家数据模型

**新文件：`src/logic/diplomacy/models/AIEconomyState.js`**

```javascript
/**
 * AI Economy State Model
 * 统一的AI国家经济数据模型
 */

export class AIEconomyState {
    constructor(initialData = {}) {
        // === 核心数据 ===
        this.population = initialData.population || 100;
        this.wealth = initialData.wealth || 1000;
        this.epoch = initialData.epoch || 0;
        
        // === 增长基线 ===
        this.basePopulation = initialData.basePopulation || this.population;
        this.baseWealth = initialData.baseWealth || this.wealth;
        
        // === 资源系统 ===
        this.inventory = initialData.inventory || {};
        this.budget = initialData.budget || this.wealth * 0.5;
        this.prices = initialData.prices || {};
        
        // === 增长参数 ===
        this.growthRate = initialData.growthRate || 0.02;
        this.developmentRate = initialData.developmentRate || 1.0;
        
        // === 时间戳 ===
        this.lastUpdateTick = initialData.lastUpdateTick || 0;
        this.lastGrowthTick = initialData.lastGrowthTick || 0;
        this.lastEpochUpgradeTick = initialData.lastEpochUpgradeTick || 0;
        
        // === 状态标记 ===
        this.isAtWar = initialData.isAtWar || false;
        this.isVassal = initialData.isVassal || false;
        
        // === 特性 ===
        this.traits = initialData.traits || {};
        this.resourceBias = initialData.resourceBias || {};
    }
    
    /**
     * 验证数据完整性
     */
    validate() {
        const errors = [];
        
        if (!Number.isFinite(this.population) || this.population < 1) {
            errors.push('Invalid population');
        }
        if (!Number.isFinite(this.wealth) || this.wealth < 0) {
            errors.push('Invalid wealth');
        }
        if (!Number.isFinite(this.epoch) || this.epoch < 0) {
            errors.push('Invalid epoch');
        }
        
        return {
            isValid: errors.length === 0,
            errors
        };
    }
    
    /**
     * 获取人均财富
     */
    getPerCapitaWealth() {
        return this.wealth / Math.max(1, this.population);
    }
    
    /**
     * 获取增长潜力（0-1）
     */
    getGrowthPotential() {
        const perCapitaWealth = this.getPerCapitaWealth();
        const targetPerCapita = 2000 * Math.pow(2, this.epoch);
        return Math.min(1, perCapitaWealth / targetPerCapita);
    }
    
    /**
     * 转换为旧格式（兼容性）
     */
    toLegacyFormat() {
        return {
            population: this.population,
            wealth: this.wealth,
            epoch: this.epoch,
            budget: this.budget,
            inventory: { ...this.inventory },
            economyTraits: {
                ownBasePopulation: this.basePopulation,
                ownBaseWealth: this.baseWealth,
                developmentRate: this.developmentRate,
                lastGrowthTick: this.lastGrowthTick,
                resourceBias: { ...this.resourceBias },
            },
            _lastEpochUpgradeTick: this.lastEpochUpgradeTick,
        };
    }
    
    /**
     * 从旧格式创建（兼容性）
     */
    static fromLegacyFormat(nation) {
        return new AIEconomyState({
            population: nation.population,
            wealth: nation.wealth,
            epoch: nation.epoch,
            budget: nation.budget,
            inventory: nation.inventory,
            basePopulation: nation.economyTraits?.ownBasePopulation,
            baseWealth: nation.economyTraits?.ownBaseWealth,
            developmentRate: nation.economyTraits?.developmentRate,
            lastGrowthTick: nation.economyTraits?.lastGrowthTick,
            lastEpochUpgradeTick: nation._lastEpochUpgradeTick,
            resourceBias: nation.economyTraits?.resourceBias,
            isAtWar: nation.isAtWar,
            isVassal: !!nation.vassalOf,
        });
    }
}
```

#### 1.2 创建配置文件

**新文件：`src/logic/diplomacy/config/aiEconomyConfig.js`**

```javascript
/**
 * AI Economy Configuration
 * 所有AI经济相关的配置参数
 */

export const AI_ECONOMY_CONFIG = {
    // === 增长参数 ===
    growth: {
        // 基础增长率（per 10 ticks）
        baseRate: 0.02,
        
        // 最小增长保证
        minimumGrowth: {
            verySmall: { threshold: 50, minGrowth: 2 },
            small: { threshold: 100, minGrowth: 1 },
            medium: { threshold: 500, minGrowth: 0.5 },
            large: { threshold: 1000, minGrowth: 2 },
            veryLarge: { threshold: 5000, minGrowth: 5 },
            huge: { threshold: 10000, minGrowth: 10 },
        },
        
        // 战争惩罚
        warPenalty: 0.3,  // 战争期间增长率 × 0.3
        
        // 更新频率
        updateInterval: 10,  // 每10 ticks更新一次
    },
    
    // === 财富参数 ===
    wealth: {
        // 人均财富上限（按时代）
        perCapitaCaps: {
            0: 2000,   // Stone Age
            1: 4000,   // Bronze Age
            2: 8000,   // Classical Age
            3: 16000,  // Medieval Age
            4: 32000,  // Renaissance Age
            5: 64000,  // Industrial Age
            6: 128000, // Modern Age
        },
        
        // 财富增长率
        baseGrowthRate: 0.01,
        developmentBonus: 0.005,
        maxGrowthRate: 0.03,
        
        // 预算比例
        budgetRatio: 0.5,
        budgetRecoveryRate: 0.02,
    },
    
    // === 时代进步 ===
    epoch: {
        // 时代升级冷却时间
        upgradeCooldown: 200,  // ticks
        
        // 时代要求倍数
        requirementMultipliers: {
            1: 100,   // Bronze Age
            2: 150,   // Classical Age
            3: 200,   // Medieval Age
            4: 300,   // Renaissance Age
            5: 400,   // Industrial Age
            6: 600,   // Modern Age
            7: 800,   // Information Age
        },
        
        // 时代增长因子
        growthFactor: 0.08,  // 每个时代 +8%
    },
    
    // === 资源系统 ===
    resources: {
        // 库存目标基数
        baseInventoryTarget: 500,
        
        // 生产/消费基础速率
        baseProductionRate: 5.0,
        baseConsumptionRate: 5.0,
        
        // 战争消费倍数
        warConsumptionMultiplier: 1.3,
        
        // 库存范围
        minInventoryRatio: 0.2,
        maxInventoryRatio: 3.0,
        
        // 周期参数
        cyclePeriodMin: 600,
        cyclePeriodMax: 800,
        trendAmplitude: 0.35,
    },
    
    // === 难度调整 ===
    difficulty: {
        veryEasy: 0.7,
        easy: 0.85,
        normal: 1.0,
        hard: 1.15,
        veryHard: 1.3,
        impossible: 1.5,
    },
    
    // === 软上限 ===
    softCaps: {
        populationBase: 200,
        populationPlayerRatio: 0.8,
        populationOwnBaseRatio: 10,
        overageReduction: 0.15,
    },
};

/**
 * 获取配置值（支持路径访问）
 * @param {string} path - 配置路径，如 'growth.baseRate'
 * @param {*} defaultValue - 默认值
 */
export function getConfig(path, defaultValue = null) {
    const keys = path.split('.');
    let value = AI_ECONOMY_CONFIG;
    
    for (const key of keys) {
        if (value && typeof value === 'object' && key in value) {
            value = value[key];
        } else {
            return defaultValue;
        }
    }
    
    return value;
}

/**
 * 获取人均财富上限
 */
export function getPerCapitaWealthCap(epoch) {
    return getConfig(`wealth.perCapitaCaps.${epoch}`, 50000);
}

/**
 * 获取最小增长值
 */
export function getMinimumGrowth(population) {
    const thresholds = getConfig('growth.minimumGrowth');
    
    for (const [key, config] of Object.entries(thresholds)) {
        if (population < config.threshold) {
            return config.minGrowth;
        }
    }
    
    return 0;
}
```

### 阶段二：核心逻辑重构（优先级：🔴 最高）

#### 2.1 创建增长计算器

**新文件：`src/logic/diplomacy/calculators/GrowthCalculator.js`**

```javascript
/**
 * Growth Calculator
 * 负责计算人口和财富增长
 */

import { calculateAILogisticGrowth } from '../../population/logisticGrowth.js';
import { getConfig, getMinimumGrowth, getPerCapitaWealthCap } from '../config/aiEconomyConfig.js';

export class GrowthCalculator {
    /**
     * 计算人口增长
     */
    static calculatePopulationGrowth({
        currentPopulation,
        basePopulation,
        epoch,
        difficulty,
        playerPopulation,
        ticksSinceLastUpdate,
        isAtWar = false,
    }) {
        // 使用 logistic growth 模型
        const modelPopulation = calculateAILogisticGrowth({
            nation: { 
                population: currentPopulation,
                economyTraits: { ownBasePopulation: basePopulation },
                epoch,
            },
            epoch,
            difficulty,
            playerPopulation,
            ticksSinceLastUpdate,
        });
        
        // 计算增长量
        let growth = modelPopulation - currentPopulation;
        
        // 应用战争惩罚
        if (isAtWar) {
            const warPenalty = getConfig('growth.warPenalty', 0.3);
            growth = Math.trunc(growth * warPenalty);
        }
        
        // 应用最小增长保证
        if (growth >= 0) {
            const minGrowth = getMinimumGrowth(currentPopulation);
            growth = Math.max(minGrowth, growth);
        } else {
            // 限制下降速度（最多 -2% per update）
            const maxDecline = Math.max(1, Math.floor(currentPopulation * 0.02));
            growth = Math.max(growth, -maxDecline);
        }
        
        // 计算新人口
        const newPopulation = Math.max(1, currentPopulation + growth);
        
        return {
            newPopulation,
            growth,
            growthRate: growth / Math.max(1, currentPopulation),
        };
    }
    
    /**
     * 计算财富增长
     */
    static calculateWealthGrowth({
        currentWealth,
        currentPopulation,
        newPopulation,
        epoch,
        developmentRate,
        ticksSinceLastUpdate,
    }) {
        // 财富增长与人口增长绑定
        const popGrowthRate = (newPopulation - currentPopulation) / Math.max(1, currentPopulation);
        
        // 发展奖励
        const developmentBonus = (developmentRate - 1) * getConfig('wealth.developmentBonus', 0.005);
        
        // 基础增长率
        const baseGrowthRate = popGrowthRate + developmentBonus;
        
        // 时间缩放
        const tickScale = Math.min(ticksSinceLastUpdate / 10, 2.0);
        const rawGrowthRate = baseGrowthRate * tickScale;
        
        // 限制增长率范围
        const maxGrowthRate = getConfig('wealth.maxGrowthRate', 0.03);
        const cappedGrowthRate = Math.max(-0.02, Math.min(maxGrowthRate, rawGrowthRate));
        
        // 应用人均财富上限
        const perCapitaCap = getPerCapitaWealthCap(epoch);
        const currentPerCapita = currentWealth / Math.max(1, newPopulation);
        
        let finalGrowthRate = cappedGrowthRate;
        if (currentPerCapita >= perCapitaCap) {
            // 达到上限，只允许微小增长
            finalGrowthRate = Math.min(0.005, cappedGrowthRate);
        }
        
        // 计算新财富
        const newWealth = Math.round(currentWealth * (1 + finalGrowthRate));
        
        // 硬上限：确保不超过人均上限
        const maxAllowedWealth = newPopulation * perCapitaCap;
        const finalWealth = Math.min(newWealth, maxAllowedWealth);
        
        return {
            newWealth: Math.max(100, finalWealth),
            growth: finalWealth - currentWealth,
            growthRate: finalGrowthRate,
        };
    }
}
```

#### 2.2 创建资源管理器

**新文件：`src/logic/diplomacy/calculators/ResourceManager.js`**

```javascript
/**
 * Resource Manager
 * 负责管理AI国家的资源库存和价格
 */

import { RESOURCES } from '../../../config/index.js';
import { isTradableResource } from '../../utils/helpers.js';
import { getConfig } from '../config/aiEconomyConfig.js';

export class ResourceManager {
    /**
     * 更新资源库存
     */
    static updateInventory({
        inventory,
        resourceBias,
        epoch,
        wealth,
        isAtWar,
        tick,
        gameSpeed,
    }) {
        const updatedInventory = { ...inventory };
        const foreignResourceKeys = Object.keys(RESOURCES).filter(isTradableResource);
        
        // 时代倍数
        const epochMultiplier = 1 + epoch * 0.5 + Math.pow(epoch, 1.3) * 0.1;
        
        // 财富因子
        const wealthFactor = Math.max(0.8, Math.min(2.0, wealth / 1000));
        
        // 战争消费倍数
        const warMultiplier = isAtWar 
            ? getConfig('resources.warConsumptionMultiplier', 1.3)
            : 1.0;
        
        foreignResourceKeys.forEach((resourceKey) => {
            const bias = resourceBias[resourceKey] ?? 1;
            const currentStock = updatedInventory[resourceKey] || 0;
            
            // 计算目标库存
            const baseTarget = getConfig('resources.baseInventoryTarget', 500);
            const targetInventory = Math.round(
                baseTarget * Math.pow(bias, 1.2) * epochMultiplier * wealthFactor
            );
            
            // 计算生产和消费
            const { production, consumption } = this._calculateProductionConsumption({
                resourceKey,
                bias,
                currentStock,
                targetInventory,
                epoch,
                wealthFactor,
                warMultiplier,
                tick,
                gameSpeed,
            });
            
            // 更新库存
            const netChange = production - consumption;
            const minInventory = targetInventory * getConfig('resources.minInventoryRatio', 0.2);
            const maxInventory = targetInventory * getConfig('resources.maxInventoryRatio', 3.0);
            const nextStock = currentStock + netChange;
            
            updatedInventory[resourceKey] = Math.max(minInventory, Math.min(maxInventory, nextStock));
        });
        
        return updatedInventory;
    }
    
    /**
     * 计算生产和消费（私有方法）
     */
    static _calculateProductionConsumption({
        resourceKey,
        bias,
        currentStock,
        targetInventory,
        epoch,
        wealthFactor,
        warMultiplier,
        tick,
        gameSpeed,
    }) {
        const baseProduction = getConfig('resources.baseProductionRate', 5.0);
        const baseConsumption = getConfig('resources.baseConsumptionRate', 5.0);
        
        const epochMultiplier = 1 + epoch * 0.5 + Math.pow(epoch, 1.3) * 0.1;
        
        // 长周期趋势
        const resourceOffset = resourceKey.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
        const cyclePeriodMin = getConfig('resources.cyclePeriodMin', 600);
        const cyclePeriodMax = getConfig('resources.cyclePeriodMax', 800);
        const cyclePeriod = cyclePeriodMin + (resourceOffset % (cyclePeriodMax - cyclePeriodMin));
        const cyclePhase = Math.sin((tick * 2 * Math.PI) / cyclePeriod + resourceOffset * 0.1);
        
        const trendAmplitude = getConfig('resources.trendAmplitude', 0.35) + Math.abs(bias - 1) * 0.45;
        
        // 特产资源：生产多，消费少
        // 稀缺资源：生产少，消费多
        const productionTrend = bias > 1
            ? 1 + Math.max(0, cyclePhase) * trendAmplitude + 0.2
            : 1 - Math.max(0, cyclePhase) * trendAmplitude * 0.4;
        const consumptionTrend = bias < 1
            ? 1 + Math.max(0, cyclePhase) * trendAmplitude + 0.15
            : 1 - Math.max(0, cyclePhase) * trendAmplitude * 0.25;
        
        // 基础速率
        const productionRate = baseProduction * epochMultiplier * wealthFactor * Math.pow(bias, 1.2) * productionTrend * gameSpeed;
        const consumptionRate = baseConsumption * epochMultiplier * wealthFactor * Math.pow(1 / bias, 0.8) * consumptionTrend * warMultiplier * gameSpeed;
        
        // 库存调整
        const stockRatio = currentStock / targetInventory;
        let productionAdjustment = 1.0;
        let consumptionAdjustment = 1.0;
        
        if (stockRatio > 1.5) {
            productionAdjustment *= 0.5;
            consumptionAdjustment *= 1.15;
        } else if (stockRatio > 1.1) {
            productionAdjustment *= 0.8;
            consumptionAdjustment *= 1.05;
        } else if (stockRatio < 0.5) {
            productionAdjustment *= 1.5;
            consumptionAdjustment *= 0.85;
        } else if (stockRatio < 0.9) {
            productionAdjustment *= 1.2;
            consumptionAdjustment *= 0.95;
        }
        
        // 修正和随机冲击
        const correction = (targetInventory - currentStock) * 0.01 * gameSpeed;
        const randomShock = (Math.random() - 0.5) * targetInventory * 0.1 * gameSpeed;
        
        const finalProduction = productionRate * productionAdjustment + correction + randomShock;
        const finalConsumption = consumptionRate * consumptionAdjustment;
        
        return {
            production: finalProduction,
            consumption: finalConsumption,
        };
    }
    
    /**
     * 更新预算
     */
    static updateBudget({ currentBudget, wealth }) {
        const targetBudget = wealth * getConfig('wealth.budgetRatio', 0.5);
        const recoveryRate = getConfig('wealth.budgetRecoveryRate', 0.02);
        const budgetDiff = targetBudget - currentBudget;
        
        return Math.max(0, currentBudget + budgetDiff * recoveryRate);
    }
}
```

#### 2.3 创建经济更新服务

**新文件：`src/logic/diplomacy/services/AIEconomyService.js`**

```javascript
/**
 * AI Economy Service
 * 统一的AI经济更新服务
 */

import { AIEconomyState } from '../models/AIEconomyState.js';
import { GrowthCalculator } from '../calculators/GrowthCalculator.js';
import { ResourceManager } from '../calculators/ResourceManager.js';
import { getConfig } from '../config/aiEconomyConfig.js';

export class AIEconomyService {
    /**
     * 更新AI国家经济（主入口）
     */
    static update({
        nation,
        tick,
        epoch,
        difficulty,
        playerPopulation,
        gameSpeed = 1.0,
    }) {
        // 转换为新数据模型
        const state = AIEconomyState.fromLegacyFormat(nation);
        
        // 验证数据
        const validation = state.validate();
        if (!validation.isValid) {
            console.error(`[AI Economy] Invalid state for ${nation.name}:`, validation.errors);
            return nation;
        }
        
        // 更新增长
        const shouldGrow = this._shouldUpdateGrowth(state, tick);
        if (shouldGrow) {
            this._updateGrowth(state, {
                tick,
                epoch,
                difficulty,
                playerPopulation,
            });
        }
        
        // 更新资源
        this._updateResources(state, {
            tick,
            gameSpeed,
        });
        
        // 更新预算
        state.budget = ResourceManager.updateBudget({
            currentBudget: state.budget,
            wealth: state.wealth,
        });
        
        // 转换回旧格式
        return {
            ...nation,
            ...state.toLegacyFormat(),
        };
    }
    
    /**
     * 判断是否应该更新增长
     */
    static _shouldUpdateGrowth(state, tick) {
        const updateInterval = getConfig('growth.updateInterval', 10);
        const ticksSinceLastGrowth = tick - state.lastGrowthTick;
        return ticksSinceLastGrowth >= updateInterval;
    }
    
    /**
     * 更新增长
     */
    static _updateGrowth(state, { tick, epoch, difficulty, playerPopulation }) {
        const ticksSinceLastUpdate = tick - state.lastGrowthTick;
        
        // 计算人口增长
        const popResult = GrowthCalculator.calculatePopulationGrowth({
            currentPopulation: state.population,
            basePopulation: state.basePopulation,
            epoch,
            difficulty,
            playerPopulation,
            ticksSinceLastUpdate,
            isAtWar: state.isAtWar,
        });
        
        // 计算财富增长
        const wealthResult = GrowthCalculator.calculateWealthGrowth({
            currentWealth: state.wealth,
            currentPopulation: state.population,
            newPopulation: popResult.newPopulation,
            epoch,
            developmentRate: state.developmentRate,
            ticksSinceLastUpdate,
        });
        
        // 更新状态
        state.population = popResult.newPopulation;
        state.basePopulation = popResult.newPopulation;
        state.wealth = wealthResult.newWealth;
        state.baseWealth = wealthResult.newWealth;
        state.lastGrowthTick = tick;
        state.lastUpdateTick = tick;
    }
    
    /**
     * 更新资源
     */
    static _updateResources(state, { tick, gameSpeed }) {
        state.inventory = ResourceManager.updateInventory({
            inventory: state.inventory,
            resourceBias: state.resourceBias,
            epoch: state.epoch,
            wealth: state.wealth,
            isAtWar: state.isAtWar,
            tick,
            gameSpeed,
        });
    }
}
```

### 阶段三：集成和测试（优先级：🟡 中等）

#### 3.1 创建迁移工具

**新文件：`src/logic/diplomacy/migration/economyMigration.js`**

```javascript
/**
 * Economy Migration Tool
 * 用于将旧数据迁移到新系统
 */

import { AIEconomyState } from '../models/AIEconomyState.js';

export function migrateNationEconomy(nation) {
    // 检查是否已经迁移
    if (nation._economyMigrated) {
        return nation;
    }
    
    // 创建新状态
    const state = AIEconomyState.fromLegacyFormat(nation);
    
    // 验证
    const validation = state.validate();
    if (!validation.isValid) {
        console.warn(`[Migration] Failed to migrate ${nation.name}:`, validation.errors);
        return nation;
    }
    
    // 转换回旧格式并标记已迁移
    return {
        ...nation,
        ...state.toLegacyFormat(),
        _economyMigrated: true,
    };
}

export function migrateAllNations(nations) {
    return nations.map(migrateNationEconomy);
}
```

#### 3.2 创建测试工具

**新文件：`src/logic/diplomacy/__tests__/aiEconomy.test.js`**

```javascript
/**
 * AI Economy Tests
 */

import { AIEconomyState } from '../models/AIEconomyState.js';
import { GrowthCalculator } from '../calculators/GrowthCalculator.js';
import { AIEconomyService } from '../services/AIEconomyService.js';

describe('AIEconomyState', () => {
    test('should create valid state', () => {
        const state = new AIEconomyState({
            population: 1000,
            wealth: 10000,
        });
        
        const validation = state.validate();
        expect(validation.isValid).toBe(true);
    });
    
    test('should calculate per capita wealth', () => {
        const state = new AIEconomyState({
            population: 1000,
            wealth: 10000,
        });
        
        expect(state.getPerCapitaWealth()).toBe(10);
    });
});

describe('GrowthCalculator', () => {
    test('should calculate population growth', () => {
        const result = GrowthCalculator.calculatePopulationGrowth({
            currentPopulation: 1000,
            basePopulation: 1000,
            epoch: 0,
            difficulty: 'normal',
            playerPopulation: 5000,
            ticksSinceLastUpdate: 10,
            isAtWar: false,
        });
        
        expect(result.newPopulation).toBeGreaterThan(1000);
        expect(result.growth).toBeGreaterThan(0);
    });
    
    test('should apply war penalty', () => {
        const peacefulResult = GrowthCalculator.calculatePopulationGrowth({
            currentPopulation: 1000,
            basePopulation: 1000,
            epoch: 0,
            difficulty: 'normal',
            playerPopulation: 5000,
            ticksSinceLastUpdate: 10,
            isAtWar: false,
        });
        
        const warResult = GrowthCalculator.calculatePopulationGrowth({
            currentPopulation: 1000,
            basePopulation: 1000,
            epoch: 0,
            difficulty: 'normal',
            playerPopulation: 5000,
            ticksSinceLastUpdate: 10,
            isAtWar: true,
        });
        
        expect(warResult.growth).toBeLessThan(peacefulResult.growth);
    });
});
```

### 阶段四：文档和工具（优先级：🟢 低）

#### 4.1 创建调试工具

**新文件：`src/logic/diplomacy/debug/economyDebugger.js`**

```javascript
/**
 * Economy Debugger
 * 用于调试AI经济系统
 */

export class EconomyDebugger {
    static enabled = false;
    
    static enable() {
        this.enabled = true;
    }
    
    static disable() {
        this.enabled = false;
    }
    
    static log(nation, message, data = {}) {
        if (!this.enabled) return;
        
        console.log(`[Economy Debug] ${nation.name}: ${message}`, {
            population: nation.population,
            wealth: nation.wealth,
            epoch: nation.epoch,
            ...data,
        });
    }
    
    static logGrowth(nation, before, after) {
        if (!this.enabled) return;
        
        const popGrowth = after.population - before.population;
        const wealthGrowth = after.wealth - before.wealth;
        const popGrowthRate = (popGrowth / before.population * 100).toFixed(2);
        const wealthGrowthRate = (wealthGrowth / before.wealth * 100).toFixed(2);
        
        console.log(`[Growth] ${nation.name}:`, {
            population: `${before.population} → ${after.population} (+${popGrowth}, +${popGrowthRate}%)`,
            wealth: `${before.wealth} → ${after.wealth} (+${wealthGrowth}, +${wealthGrowthRate}%)`,
        });
    }
    
    static exportState(nation) {
        return {
            name: nation.name,
            population: nation.population,
            wealth: nation.wealth,
            epoch: nation.epoch,
            budget: nation.budget,
            inventory: { ...nation.inventory },
            economyTraits: { ...nation.economyTraits },
            timestamp: Date.now(),
        };
    }
}
```

---

## 📅 实施计划

### 第1周：数据模型重构
- [ ] 创建 `AIEconomyState` 模型
- [ ] 创建 `aiEconomyConfig.js` 配置文件
- [ ] 编写单元测试
- [ ] 文档编写

### 第2周：核心逻辑重构
- [ ] 创建 `GrowthCalculator`
- [ ] 创建 `ResourceManager`
- [ ] 创建 `AIEconomyService`
- [ ] 编写单元测试

### 第3周：集成和迁移
- [ ] 创建迁移工具
- [ ] 在 `simulation.js` 中集成新系统
- [ ] 保持向后兼容
- [ ] 测试旧存档加载

### 第4周：清理和优化
- [ ] 移除旧代码
- [ ] 性能优化
- [ ] 完善文档
- [ ] 全面测试

---

## ✅ 重构后的优势

### 1. **代码质量**
- ✅ 清晰的职责分离
- ✅ 易于理解和维护
- ✅ 减少重复代码
- ✅ 更好的错误处理

### 2. **可测试性**
- ✅ 纯函数优先
- ✅ 易于编写单元测试
- ✅ 可预测的行为

### 3. **可配置性**
- ✅ 所有参数集中管理
- ✅ 易于调整平衡
- ✅ 支持难度调整

### 4. **可扩展性**
- ✅ 易于添加新功能
- ✅ 模块化设计
- ✅ 清晰的接口

### 5. **性能**
- ✅ 减少不必要的计算
- ✅ 更好的数据结构
- ✅ 优化的更新频率

---

## 🚨 风险和注意事项

### 1. **向后兼容性**
- ⚠️ 必须支持旧存档加载
- ⚠️ 需要迁移工具
- ⚠️ 保持API兼容

### 2. **测试覆盖**
- ⚠️ 需要全面的测试
- ⚠️ 边界情况测试
- ⚠️ 性能测试

### 3. **渐进式迁移**
- ⚠️ 不要一次性重写所有代码
- ⚠️ 保持系统可运行
- ⚠️ 逐步替换旧代码

---

## 📚 参考资料

### 相关文件
- `src/logic/diplomacy/aiEconomy.js` - 当前实现
- `src/logic/diplomacy/nations.js` - 外交系统
- `src/logic/population/logisticGrowth.js` - 增长模型
- `src/logic/population/growthConfig.js` - 增长配置

### 设计模式
- **Service Layer Pattern** - 业务逻辑层
- **Repository Pattern** - 数据访问层
- **Strategy Pattern** - 算法策略
- **Factory Pattern** - 对象创建

---

## 💡 后续优化方向

### 1. **AI经济策略**
- 不同国家有不同的经济策略
- 资源专业化
- 贸易路线优化

### 2. **动态平衡**
- 根据玩家进度自动调整
- 防止AI过强或过弱
- 保持游戏挑战性

### 3. **经济事件**
- 经济繁荣/衰退
- 资源发现
- 贸易协定

### 4. **可视化工具**
- 经济数据图表
- 增长曲线
- 资源流动图

---

**最后更新：** 2026-02-03
**作者：** AI Assistant
**状态：** 📝 规划中
