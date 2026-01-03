# 官员个人投资与产业系统 - 完整设计文档

> **版本**: 1.1  
> **日期**: 2026-01-03  
> **状态**: 待实施

---

## 目录

1. [需求概述](#1-需求概述)
2. [现有系统分析](#2-现有系统分析)
3. [核心设计决策](#3-核心设计决策)
4. [数据结构设计](#4-数据结构设计)
5. [实现阶段](#5-实现阶段)
6. [UI 显示方案](#6-ui-显示方案)
7. [文件修改清单](#7-文件修改清单)
8. [风险与缓解](#8-风险与缓解)

---

## 1. 需求概述

### 1.1 功能目标

实现官员个人化的经济行为系统：

| 功能 | 描述 |
|-----|------|
| **个性化物资需求** | 根据收入和存款动态调整消费档位 |
| **产业投资** | 官员用个人存款购置建筑成为业主 |
| **独立利润核算** | 官员持有的建筑利润归其个人，运营成本由官员个人承担 |
| **建筑升级** | 官员会升级自己持有的建筑 |
| **资产转移** | 官员被处置时产业转给**建筑原始业主阶层** |

### 1.2 关键约束

1. 官员产业**计入**建筑面板的建筑总量
2. 官员产业收益**独立核算**，运营成本由官员个人承担，不与阶层产业混合
3. 官员**可以购买任何有 owner 属性的建筑**，不受出身阶层限制（这是官员的特权）
4. 官员被解雇/流放/处死时，产业**转给建筑定义的原始业主阶层**（`building.owner`）

---

## 2. 现有系统分析

### 2.1 官员财富系统（已实现）

| 功能 | 位置 | 状态 |
|-----|-----|-----|
| 官员个人存款 `official.wealth` | `simulation.js:2675` | ✅ |
| 入职初始存款 400 银 | `manager.js:62-66` | ✅ |
| 俸禄收入（如支付） | `simulation.js:2678-2685` | ✅ |
| 消费支出（购买商品） | `simulation.js:2688-2803` | ✅ |
| 奢侈需求解锁（基于 wealthRatio） | `simulation.js:2789-2803` | ✅ |

### 2.2 阶层业主扩张系统（已实现）

| 功能 | 位置 |
|-----|-----|
| 阶层财富池 `classWealth[stratum]` | `simulation.js` |
| 业主扩张逻辑 `processOwnerExpansions()` | `cabinetSynergy.js:733-879` |
| 建筑盈利计算 `calculateBuildingProfit()` | `cabinetSynergy.js:624-668` |
| 扩张候选人加权随机选择 | `cabinetSynergy.js:804-877` |

### 2.3 官员满意度系统（已实现）

| 功能 | 位置 |
|-----|-----|
| 俸禄支付检查 `officialsPaid` | `useGameLoop.js:1284` |
| 效果减半（未支付俸禄） | `manager.js:209` |
| 政治主张满足/惩罚 | `manager.js:489-505` |

### 2.4 识别的缺失点

- ❌ 官员个人财务满意度（仅有阶层级别）
- ❌ 官员俸禄调节功能
- ❌ 官员个人投资行为
- ❌ 官员产业独立核算

---

## 3. 核心设计决策

### 3.1 产权存储方案

**选择方案 A：官员属性（含唯一实例 ID）**

```javascript
official.ownedProperties = [
    { 
        buildingId: 'farm', 
        instanceId: 'farm_off_123_1704278400000', // 唯一实例ID: 建筑ID_官员ID_时间戳
        purchaseDay: 120, 
        purchaseCost: 200, 
        level: 1 
    },
];
```

**优点**：
- 实现简单，改动少
- 官员删除时数据自动跟随
- 存档自动处理
- **唯一实例 ID 便于追踪升级等级和产业转移**

**弃选方案 B**：全局注册表（复杂度高，暂不需要）

### 3.2 产业计数规则

| 场景 | 行为 |
|-----|------|
| 官员购置建筑 | `buildingCounts[id]++` |
| 官员升级建筑 | 更新 `buildingUpgrades[id][level]` |
| 官员被处置 | 产业转给**建筑原始业主阶层**，计数不变 |

### 3.3 投资偏好来源

官员投资偏好由三个因素决定：

1. **出身阶层** → 决定偏好的建筑类别（影响投资选择的权重）
2. **政治光谱** → 修正偏好（左派避免工业，右派偏好工业）
3. **内阁派系主导** → 影响投资热情（左派主导时投资意愿降低）

**注意**：投资偏好仅影响**投资概率权重**，官员可以购买任何有 `owner` 属性的建筑。

### 3.4 冷却机制

| 行为 | 冷却时间 |
|-----|---------| 
| 购置新建筑 | 90 天 |
| 升级现有建筑 | 60 天 |

**入职初始化**：新官员的 `lastInvestmentDay` 和 `lastUpgradeDay` 设置为 `currentDay - 冷却期 / 2`，给予一定缓冲。

### 3.5 产业收益计算（实际利润）

官员产业收益**独立核算**，考虑以下因素：

1. **理论利润** = `calculateBuildingProfit()` 计算的利润
2. **工作效率** = 该类型建筑的平均工作填充率
3. **实际利润** = 理论利润 × 工作效率  
   说明：`calculateBuildingProfit()` 已包含投入成本、工资与税费，避免重复扣减。

```javascript
// 实际利润计算公式
const theoreticalProfit = calculateBuildingProfit(building, market, taxPolicies).profit;
const workingRatio = getBuildingWorkingRatio(buildingId, jobFill, buildingCounts);
const actualProfit = theoreticalProfit * workingRatio;
```

### 3.6 产业处置规则

**统一规则**：无论官员被解雇、流放还是处死，其产业均**转给建筑定义的原始业主阶层**。

| 处置类型 | 财产没收 | 产业去向 |
|---------|---------|---------|
| 解雇 | 0% | 转给 `building.owner` |
| 流放 | 50% | 转给 `building.owner` |
| 处死 | 100% | 转给 `building.owner` |

**原因**：
- 保持阶层业主扩张系统的一致性
- 避免产生"非法"业主（如矿工持有工厂）
- 目前没有国有建筑的设计

---

## 4. 数据结构设计

### 4.1 官员对象扩展

```javascript
// 在 manager.js 的 hireOfficial() 中初始化
const newOfficial = {
    ...candidate,
    hireDate: currentDay,
    wealth: OFFICIAL_STARTING_WEALTH, // 400
    lastDayExpense: 0,
    
    // ========== 新增字段 ==========
    // 财务状态
    financialSatisfaction: 'satisfied', 
    // 可选值: 'satisfied' | 'uncomfortable' | 'struggling' | 'desperate'
    
    // 投资偏好
    investmentProfile: {
        preferredCategories: ['gather', 'industry'],
        riskTolerance: 0.5,           // 0.3-1.0
        investmentThreshold: 0.3,     // 存款比例阈值
        lastInvestmentDay: currentDay - INVESTMENT_COOLDOWN / 2, // 入职缓冲
        lastUpgradeDay: currentDay - UPGRADE_COOLDOWN / 2,       // 入职缓冲
    },
    
    // 产业持有
    ownedProperties: [],
    // 元素格式: { buildingId, instanceId, purchaseDay, purchaseCost, level }
    
    // 产业收益记录
    lastDayPropertyIncome: 0,
};
```

### 4.2 财务状态定义（动态阈值）

```javascript
// 动态阈值基于官员每日消费成本计算
const calculateFinancialThresholds = (official, market) => {
    // 计算官员每日基本消费成本（基于当前市场价）
    const dailyConsumptionCost = calculateOfficialDailyConsumption(official, market);
    
    return {
        desperateThreshold: dailyConsumptionCost * 10,      // 10天消费
        strugglingThreshold: dailyConsumptionCost * 30,     // 1个月消费
        uncomfortableThreshold: dailyConsumptionCost * 60,  // 2个月消费
    };
};

const FINANCIAL_STATUS = {
    satisfied: { 
        effectMult: 1.0, 
        corruption: 0,
        description: null 
    },
    uncomfortable: { 
        effectMult: 0.9, 
        corruption: 0.01,
        description: '生活拮据'
    },
    struggling: { 
        effectMult: 0.7, 
        corruption: 0.03,
        description: '入不敷出'
    },
    desperate: { 
        effectMult: 0.3, 
        corruption: 0.10,
        description: '濒临破产'
    },
};
```

### 4.3 投资偏好生成

```javascript
// 阶层 → 偏好类别（影响权重，不限制购买）
const STRATUM_INVESTMENT_PREFS = {
    landowner:  { cats: ['gather'], risk: 0.4 },
    merchant:   { cats: ['civic', 'industry'], risk: 0.7 },
    capitalist: { cats: ['industry', 'gather'], risk: 0.8 },
    scribe:     { cats: ['civic'], risk: 0.3 },
    cleric:     { cats: ['civic'], risk: 0.3 },
    peasant:    { cats: ['gather'], risk: 0.4 },
    worker:     { cats: ['industry'], risk: 0.5 },
    artisan:    { cats: ['industry'], risk: 0.5 },
    engineer:   { cats: ['industry'], risk: 0.6 },
    navigator:  { cats: ['civic', 'gather'], risk: 0.6 },
};

// 政治光谱修正
// 左派: 移除 'industry'，添加 'gather'
// 右派: 添加 'industry'
```

### 4.4 存档迁移函数

```javascript
// 在 simulation.js 或单独的 migration.js 中
export const migrateOfficialForInvestment = (official, currentDay) => {
    // 如果已有新字段，直接返回
    if (official.investmentProfile && official.ownedProperties !== undefined) {
        return official;
    }
    
    return {
        ...official,
        // 财务状态（默认满意）
        financialSatisfaction: official.financialSatisfaction || 'satisfied',
        
        // 投资偏好（基于出身阶层和政治主张生成）
        investmentProfile: official.investmentProfile || generateInvestmentProfile(
            official.sourceStratum,
            official.politicalStance,
            currentDay
        ),
        
        // 产业持有（默认空数组）
        ownedProperties: official.ownedProperties || [],
        
        // 产业收益记录
        lastDayPropertyIncome: official.lastDayPropertyIncome || 0,
    };
};

// 在存档加载时调用
export const migrateAllOfficialsForInvestment = (officials, currentDay) => {
    return officials.map(official => migrateOfficialForInvestment(official, currentDay));
};
```

---

## 5. 实现阶段

### Phase 1：财务满意度系统

**目标**：让官员财务状态影响其效果和腐败风险

#### 修改 1.1：财务状态判定（动态阈值）

**文件**: `simulation.js` (官员每日结算后)

```javascript
// 财务满意度判定（使用动态阈值）
officials.forEach(official => {
    const thresholds = calculateFinancialThresholds(official, market);
    const incomeRatio = official.salary / (official.lastDayExpense || 1);
    
    if (official.wealth < thresholds.desperateThreshold) {
        official.financialSatisfaction = 'desperate';
    } else if (incomeRatio < 0.8) {
        official.financialSatisfaction = 'struggling';
    } else if (official.wealth < thresholds.uncomfortableThreshold) {
        official.financialSatisfaction = 'uncomfortable';
    } else {
        official.financialSatisfaction = 'satisfied';
    }
});
```

#### 修改 1.2：效果惩罚

**文件**: `manager.js` 的 `getAggregatedOfficialEffects()`

```javascript
officials.forEach(official => {
    const financialPenalty = FINANCIAL_STATUS[official.financialSatisfaction];
    const effectiveMultiplier = multiplier * financialPenalty.effectMult;
    
    if (financialPenalty.corruption > 0) {
        aggregated.corruption += financialPenalty.corruption;
    }
    // 后续使用 effectiveMultiplier
});
```

---

### Phase 2：动态消费与投资偏好

**目标**：防止官员存款无限积累；生成投资偏好

#### 修改 2.1：动态消费倍率

**文件**: `simulation.js` (官员奢侈消费处)

```javascript
// 财富越高，消费欲望越大
const consumptionMultiplier = Math.min(
    6.0,
    1.0 + Math.log10(Math.max(1, currentWealth / 400)) * 0.8
);

// 应用到所有奢侈消费
Object.entries(needs).forEach(([resource, baseAmount]) => {
    consumeOfficialResource(resource, baseAmount * consumptionMultiplier, true);
});
```

#### 修改 2.2：投资偏好生成（含入职缓冲）

**文件**: `officials.js`

```javascript
const INVESTMENT_COOLDOWN = 90;
const UPGRADE_COOLDOWN = 60;

export const generateInvestmentProfile = (sourceStratum, politicalStance, currentDay) => {
    const base = STRATUM_INVESTMENT_PREFS[sourceStratum] || { cats: ['gather'], risk: 0.5 };
    const stanceSpectrum = POLITICAL_STANCES[politicalStance]?.spectrum;
    
    let cats = [...base.cats];
    if (stanceSpectrum === 'left') {
        cats = cats.filter(c => c !== 'industry');
        if (!cats.includes('gather')) cats.push('gather');
    } else if (stanceSpectrum === 'right') {
        if (!cats.includes('industry')) cats.push('industry');
    }
    
    return {
        preferredCategories: cats,
        riskTolerance: base.risk * (0.8 + Math.random() * 0.4),
        investmentThreshold: 0.2 + Math.random() * 0.3,
        // 入职时给予冷却期一半的缓冲
        lastInvestmentDay: currentDay - Math.floor(INVESTMENT_COOLDOWN / 2),
        lastUpgradeDay: currentDay - Math.floor(UPGRADE_COOLDOWN / 2),
    };
};
```

---

### Phase 3：产业系统

**目标**：官员购置建筑并获得收益

#### 新文件：`officialInvestment.js`

```javascript
import { BUILDINGS } from '../../config/buildings';
import { calculateBuildingProfit } from './cabinetSynergy';
import { calculateBuildingCost } from '../../utils/buildingUpgradeUtils';
import { getBuildingCostGrowthFactor } from '../../config/difficulty';

const INVESTMENT_COOLDOWN = 90;
const MIN_WEALTH_TO_INVEST = 500;
const MAX_INVEST_RATIO = 0.4;
// 注意：市场数据结构沿用现有系统：market.prices / market.wages

/**
 * 生成产业唯一实例ID
 */
const generateInstanceId = (buildingId, officialId) => {
    return `${buildingId}_off_${officialId}_${Date.now()}`;
};

/**
 * 说明：
 * 利润计算统一使用 calculateBuildingProfit()，避免重复扣减投入成本。
 * 若未来需要额外维护费，可单独新增 maintenanceCost（独立字段）。
 */

/**
 * 获取建筑的工作效率（基于岗位填充率）
 */
export const getBuildingWorkingRatio = (buildingId, jobFill, buildingCounts) => {
    const building = BUILDINGS.find(b => b.id === buildingId);
    if (!building?.jobs) return 1.0;
    
    let totalJobs = 0;
    let filledJobs = 0;
    
    Object.entries(building.jobs).forEach(([jobType, jobCount]) => {
        const totalForType = (buildingCounts[buildingId] || 1) * jobCount;
        const fillRate = jobFill[jobType] || 0;
        totalJobs += totalForType;
        filledJobs += totalForType * Math.min(1, fillRate);
    });
    
    return totalJobs > 0 ? filledJobs / totalJobs : 1.0;
};

/**
 * 计算官员产业的实际利润
 */
export const calculateOfficialPropertyProfit = (prop, market, taxPolicies, jobFill, buildingCounts) => {
    const building = BUILDINGS.find(b => b.id === prop.buildingId);
    if (!building) return 0;
    
    // 1. 理论利润
    const theoreticalProfit = calculateBuildingProfit(building, market, taxPolicies).profit;
    
    // 2. 工作效率
    const workingRatio = getBuildingWorkingRatio(prop.buildingId, jobFill, buildingCounts);
    
    // 3. 实际利润 = 理论利润 × 工作效率
    const actualProfit = theoreticalProfit * workingRatio;
    
    return actualProfit;
};

/**
 * 处理官员投资决策
 * 官员可以购买任何有 owner 属性的建筑（这是官员的特权）
 * 投资偏好仅影响选择权重
 */
export const processOfficialInvestment = (
    official, 
    currentDay, 
    market, 
    taxPolicies, 
    cabinetStatus,
    buildingCounts,
    difficultyLevel
) => {
    if (!official?.investmentProfile) return null;
    
    const profile = official.investmentProfile;
    if (currentDay - profile.lastInvestmentDay < INVESTMENT_COOLDOWN) return null;
    if (official.wealth < MIN_WEALTH_TO_INVEST) return null;
    
    // 派系影响投资热情：左派主导时投资意愿降低
    const factionMod = cabinetStatus?.dominance?.faction === 'left' ? 0.5 : 1.0;
    const investChance = profile.riskTolerance * factionMod;
    
    // 随机决定是否投资
    if (Math.random() > investChance) return null;
    
    const budget = official.wealth * MAX_INVEST_RATIO * profile.riskTolerance;
    
    // 筛选可投资且盈利的建筑
    // 官员可以购买任何有 owner 属性的建筑（不受出身阶层限制）
    const candidates = BUILDINGS
        .filter(b => b.owner) // 只要有 owner 属性即可购买
        .map(b => {
            const currentCount = buildingCounts?.[b.id] || 0;
            const growthFactor = getBuildingCostGrowthFactor(difficultyLevel) || 1.15;
            const cost = calculateBuildingCost(b.baseCost, currentCount, growthFactor);
            const profit = calculateBuildingProfit(b, market, taxPolicies).profit;
            // 偏好类别给予额外权重
            const preferenceWeight = profile.preferredCategories.includes(b.cat) ? 2.0 : 1.0;
            return {
                building: b,
                cost,
                profit,
                weight: profit * preferenceWeight,
            };
        })
        .filter(c => c.cost <= budget && c.profit > 0)
        .sort((a, b) => b.weight - a.weight);
    
    if (candidates.length === 0) return null;
    
    // 加权随机选择
    const totalWeight = candidates.reduce((sum, c) => sum + c.weight, 0);
    let pick = Math.random() * totalWeight;
    for (const c of candidates) {
        pick -= c.weight;
        if (pick <= 0) {
            return { 
                buildingId: c.building.id, 
                instanceId: generateInstanceId(c.building.id, official.id),
                cost: c.cost, 
                profit: c.profit 
            };
        }
    }
    return null;
};
```

#### 修改：产业收益结算（实际利润）

**文件**: `simulation.js`

```javascript
// 官员产业收益（计算实际利润）
officials.forEach(official => {
    if (!official.ownedProperties?.length) return;
    
    let totalPropertyIncome = 0;
    official.ownedProperties.forEach(prop => {
        const actualProfit = calculateOfficialPropertyProfit(
            prop, 
            market, 
            taxPolicies, 
            jobFill, 
            buildingCounts
        );
        // 只计入正收益，亏损时不从其他来源补贴
        if (actualProfit > 0) {
            totalPropertyIncome += actualProfit;
        } else {
            // 亏损从官员存款扣除
            official.wealth += actualProfit; // actualProfit 为负数
        }
    });
    
    official.wealth += totalPropertyIncome;
    official.lastDayPropertyIncome = totalPropertyIncome;
});
```

---

### Phase 4：处置与基础 UI

**目标**：处置官员时转移产业给建筑原始业主；官员卡片显示产业

#### 修改：处置产业转移

**文件**: `manager.js` 的 `disposeOfficial()`

```javascript
// 产业转移给建筑原始业主阶层
const propertyTransfer = {
    transfers: (official.ownedProperties || []).map(prop => {
        const building = BUILDINGS.find(b => b.id === prop.buildingId);
        return {
            buildingId: prop.buildingId,
            instanceId: prop.instanceId,
            level: prop.level || 1,
            // 转给建筑定义的原始业主阶层
            targetStratum: building?.owner || official.sourceStratum,
            value: prop.purchaseCost || 0,
        };
    }),
    totalValue: (official.ownedProperties || []).reduce(
        (sum, p) => sum + (p.purchaseCost || 0), 0
    ),
};

// 将产业计入目标阶层的资产
propertyTransfer.transfers.forEach(transfer => {
    // 更新阶层拥有的建筑数据
    // 注意：buildingCounts 不变，因为建筑本身没有消失
    // 只是更新所有权追踪（如果有的话）
});

return { ...existingReturn, propertyTransfer };
```

#### 修改：官员卡片 UI

**文件**: `OfficialCard.jsx`

显示内容：
- 持有产业列表（含实例 ID 用于调试）
- 日收益
- 财务状态警告（濒临破产/入不敷出/生活拮据）

---

### Phase 5：建筑面板业主显示

**目标**：在建筑详情页显示业主来源分解

#### 修改 5.1：官员产业汇总

**文件**: `simulation.js` (tick 结束时)

```javascript
const officialPropertyStats = {};
officials.forEach(official => {
    official.ownedProperties?.forEach(prop => {
        if (!officialPropertyStats[prop.buildingId]) {
            officialPropertyStats[prop.buildingId] = { count: 0, owners: [] };
        }
        officialPropertyStats[prop.buildingId].count++;
        officialPropertyStats[prop.buildingId].owners.push({
            id: official.id,
            name: official.name,
            instanceId: prop.instanceId,
            level: prop.level || 1,
        });
    });
});
```

#### 修改 5.2：建筑详情显示

**文件**: `BuildingDetails.jsx`

```
农田 x 25
  ├── 自耕农业主: 22 座
  └── 官员私产: 3 座 (墨居赞, 酒井博雅)
```

---

### Phase 6：官员建筑升级

**目标**：官员升级自己持有的建筑

#### 修改：升级决策

**文件**: `officialInvestment.js`

```javascript
const UPGRADE_COOLDOWN = 60;

export const processOfficialBuildingUpgrade = (
    official, 
    currentDay, 
    market, 
    taxPolicies,
    cabinetStatus
) => {
    if (!official.ownedProperties?.length) return null;
    if (currentDay - (official.investmentProfile?.lastUpgradeDay || 0) < UPGRADE_COOLDOWN) return null;
    if (official.wealth < 200) return null;
    
    // 派系影响升级热情
    const factionMod = cabinetStatus?.dominance?.faction === 'left' ? 0.7 : 1.0;
    if (Math.random() > official.investmentProfile.riskTolerance * factionMod) return null;
    
    const candidates = [];
    official.ownedProperties.forEach((prop, index) => {
        const upgradePath = BUILDING_UPGRADES[prop.buildingId];
        if (!upgradePath) return;
        
        const currentLevel = prop.level || 0;
        const nextUpgrade = upgradePath[currentLevel];
        if (!nextUpgrade) return;
        
        const cost = calculateUpgradeCost(nextUpgrade.cost, market);
        if (cost > official.wealth * 0.5) return;
        
        const profitGain = calculateProfitGain(prop, market, taxPolicies);
        if (profitGain <= 0) return;
        
        candidates.push({ 
            propertyIndex: index, 
            instanceId: prop.instanceId,
            cost, 
            profitGain, 
            roi: profitGain / cost 
        });
    });
    
    if (!candidates.length) return null;
    candidates.sort((a, b) => b.roi - a.roi);
    return candidates[0];
};
```

---

## 6. UI 显示方案

### 6.1 官员卡片

| 区域 | 内容 |
|-----|------|
| 右上角 | 每日薪俸、个人存款 |
| 右下角 | 持有产业列表、日收益 |
| 警告条 | 财务状态（如"⚠️ 入不敷出"） |

### 6.2 建筑详情页

在"业主"标签下方显示：
```
自耕农业主: 22 座
官员私产: 3 座 (墨居赞×1, 酒井博雅×2)
```

---

## 7. 文件修改清单

| 文件 | 类型 | Phase | 说明 |
|-----|------|-------|-----|
| `officials.js` | MODIFY | 2 | `generateInvestmentProfile()` |
| `manager.js` | MODIFY | 1,4 | 财务惩罚、处置转移 |
| `simulation.js` | MODIFY | 1,2,3,5,6 | 核心逻辑、存档迁移 |
| `officialInvestment.js` | **NEW** | 3,6 | 投资+升级决策+实际利润计算 |
| `OfficialCard.jsx` | MODIFY | 4 | 产业+财务 UI |
| `BuildingDetails.jsx` | MODIFY | 5 | 业主分解显示 |
| `migration.js` | **NEW** | ALL | 存档迁移函数 |

---

## 8. 风险与缓解

| 风险 | 缓解措施 |
|-----|---------| 
| 官员财富爆炸 | 90 天投资冷却 + 动态消费倍率 |
| 产业利润过高 | 产业收益独立核算，运营成本由官员个人承担 |
| 破产官员效果 | 财务满意度 debuff + 腐败风险 |
| 升级过快 | 60 天冷却 + 成本限制 50% 存款 |
| 存档兼容性 | 存档迁移函数 `migrateOfficialForInvestment()` |
| 产业归属混乱 | 唯一实例 ID 追踪每个产业 |
| 派系失衡 | 左派主导时降低投资热情 |
| 阶层业主不一致 | 产业转移给建筑原始业主阶层 |

---

## 9. 设计变更记录

| 版本 | 日期 | 变更内容 |
|-----|------|---------|
| 1.0 | 2026-01-03 | 初版设计 |
| 1.1 | 2026-01-03 | 1. 官员可购买任何有 owner 属性的建筑<br>2. 添加存档迁移函数<br>3. 财务阈值改为动态计算<br>4. 入职冷却期缓冲<br>5. 实际利润计算（含运营成本和工作效率）<br>6. 产业统一转给建筑原始业主<br>7. 产业唯一实例 ID<br>8. 派系影响投资热情 |

---

> **下一步**：用户确认后开始 Phase 1 实施
