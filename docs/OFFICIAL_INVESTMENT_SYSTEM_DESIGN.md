# 官员个人投资与产业系统 - 完整设计文档

> **版本**: 1.0  
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
| **独立利润核算** | 官员持有的建筑利润归其个人 |
| **建筑升级** | 官员会升级自己持有的建筑 |
| **资产转移** | 官员被处置时产业转给出身阶层 |

### 1.2 关键约束

1. 官员产业**计入**建筑面板的建筑总量
2. 官员产业收益**独立核算**，不与阶层产业混合
3. 官员被解雇/流放/处死时，产业**转给出身阶层**

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

**选择方案 A：官员属性**

```javascript
official.ownedProperties = [
    { buildingId: 'farm', purchaseDay: 120, purchaseCost: 200, level: 1 },
];
```

**优点**：
- 实现简单，改动少
- 官员删除时数据自动跟随
- 存档自动处理

**弃选方案 B**：全局注册表（复杂度高，暂不需要）

### 3.2 产业计数规则

| 场景 | 行为 |
|-----|------|
| 官员购置建筑 | `buildingCounts[id]++` |
| 官员升级建筑 | 更新 `buildingUpgrades[id][level]` |
| 官员被处置 | 产业转给出身阶层，计数不变 |

### 3.3 投资偏好来源

官员投资偏好由两个因素决定：

1. **出身阶层** → 决定偏好的建筑类别
2. **政治光谱** → 修正偏好（左派避免工业，右派偏好工业）

### 3.4 冷却机制

| 行为 | 冷却时间 |
|-----|---------|
| 购置新建筑 | 90 天 |
| 升级现有建筑 | 60 天 |

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
        lastInvestmentDay: 0,
        lastUpgradeDay: 0,
    },
    
    // 产业持有
    ownedProperties: [],
    // 元素格式: { buildingId, purchaseDay, purchaseCost, level }
    
    // 产业收益记录
    lastDayPropertyIncome: 0,
};
```

### 4.2 财务状态定义

```javascript
const FINANCIAL_STATUS = {
    satisfied: { 
        effectMult: 1.0, 
        corruption: 0,
        description: null 
    },
    uncomfortable: { 
        effectMult: 0.9, 
        corruption: 0.01,
        threshold: { wealthRatio: 0.5 },
        description: '生活拮据'
    },
    struggling: { 
        effectMult: 0.7, 
        corruption: 0.03,
        threshold: { incomeRatio: 0.8 },
        description: '入不敷出'
    },
    desperate: { 
        effectMult: 0.3, 
        corruption: 0.10,
        threshold: { wealth: 50 },
        description: '濒临破产'
    },
};
```

### 4.3 投资偏好生成

```javascript
// 阶层 → 偏好类别
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

---

## 5. 实现阶段

### Phase 1：财务满意度系统

**目标**：让官员财务状态影响其效果和腐败风险

#### 修改 1.1：财务状态判定

**文件**: `simulation.js` (官员每日结算后)

```javascript
// 财务满意度判定
officials.forEach(official => {
    const wealthRatio = official.wealth / 400;
    const incomeRatio = official.salary / (official.lastDayExpense || 1);
    
    if (official.wealth < 50) {
        official.financialSatisfaction = 'desperate';
    } else if (incomeRatio < 0.8) {
        official.financialSatisfaction = 'struggling';
    } else if (wealthRatio < 0.5) {
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

#### 修改 2.2：投资偏好生成

**文件**: `officials.js`

```javascript
export const generateInvestmentProfile = (sourceStratum, politicalStance) => {
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
        lastInvestmentDay: 0,
        lastUpgradeDay: 0,
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

const INVESTMENT_COOLDOWN = 90;
const MIN_WEALTH_TO_INVEST = 500;
const MAX_INVEST_RATIO = 0.4;

export const processOfficialInvestment = (official, currentDay, market, taxPolicies) => {
    if (!official?.investmentProfile) return null;
    
    const profile = official.investmentProfile;
    if (currentDay - profile.lastInvestmentDay < INVESTMENT_COOLDOWN) return null;
    if (official.wealth < MIN_WEALTH_TO_INVEST) return null;
    
    const budget = official.wealth * MAX_INVEST_RATIO * profile.riskTolerance;
    
    // 筛选可投资且盈利的建筑
    const candidates = BUILDINGS
        .filter(b => b.owner && profile.preferredCategories.includes(b.cat))
        .map(b => ({
            building: b,
            cost: calculateBuildingCost(b, market),
            profit: calculateBuildingProfit(b, market, taxPolicies).profit,
        }))
        .filter(c => c.cost <= budget && c.profit > 0)
        .sort((a, b) => b.profit - a.profit);
    
    if (candidates.length === 0) return null;
    
    // 加权随机选择
    const totalWeight = candidates.reduce((sum, c) => sum + c.profit, 0);
    let pick = Math.random() * totalWeight;
    for (const c of candidates) {
        pick -= c.profit;
        if (pick <= 0) return { buildingId: c.building.id, cost: c.cost, profit: c.profit };
    }
    return null;
};
```

#### 修改：产业收益结算

**文件**: `simulation.js`

```javascript
// 官员产业收益
officials.forEach(official => {
    if (!official.ownedProperties?.length) return;
    
    let totalPropertyIncome = 0;
    official.ownedProperties.forEach(prop => {
        const building = BUILDINGS.find(b => b.id === prop.buildingId);
        if (!building) return;
        const profit = calculateBuildingProfit(building, market, taxPolicies).profit;
        if (profit > 0) totalPropertyIncome += profit;
    });
    
    official.wealth += totalPropertyIncome;
    official.lastDayPropertyIncome = totalPropertyIncome;
});
```

---

### Phase 4：处置与基础 UI

**目标**：处置官员时转移产业；官员卡片显示产业

#### 修改：处置产业转移

**文件**: `manager.js` 的 `disposeOfficial()`

```javascript
const propertyTransfer = {
    stratum: official.sourceStratum,
    buildings: official.ownedProperties || [],
    totalValue: (official.ownedProperties || []).reduce(
        (sum, p) => sum + (p.purchaseCost || 0), 0
    ),
};

return { ...existingReturn, propertyTransfer };
```

#### 修改：官员卡片 UI

**文件**: `OfficialCard.jsx`

显示内容：
- 持有产业列表
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

export const processOfficialBuildingUpgrade = (official, currentDay, market, taxPolicies) => {
    if (!official.ownedProperties?.length) return null;
    if (currentDay - (official.investmentProfile?.lastUpgradeDay || 0) < UPGRADE_COOLDOWN) return null;
    if (official.wealth < 200) return null;
    
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
        
        candidates.push({ propertyIndex: index, cost, profitGain, roi: profitGain / cost });
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
| `simulation.js` | MODIFY | 1,2,3,5,6 | 核心逻辑 |
| `officialInvestment.js` | **NEW** | 3,6 | 投资+升级决策 |
| `OfficialCard.jsx` | MODIFY | 4 | 产业+财务 UI |
| `BuildingDetails.jsx` | MODIFY | 5 | 业主分解显示 |

---

## 8. 风险与缓解

| 风险 | 缓解措施 |
|-----|---------|
| 官员财富爆炸 | 90 天投资冷却 + 动态消费倍率 |
| 产业利润过高 | 产业收益计入官员阶层总收入，受税收影响 |
| 破产官员效果 | 财务满意度 debuff + 腐败风险 |
| 升级过快 | 60 天冷却 + 成本限制 50% 存款 |
| 存档兼容性 | 读取时检查 `ownedProperties` 默认值 |

---

> **下一步**：用户确认后开始 Phase 1 实施
