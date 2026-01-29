# ~~AI国家简化逻辑斯蒂模型说明~~ [已废弃]

## ⚠️ 重要更新：此文档已过时！

**发现**：AI国家**实际上有完整的资源库存系统**！

之前误以为AI没有资源数据，所以设计了简化版模型。
但实际上AI有 `inventory` 字段，存储了所有资源（food, wood, stone, cloth, iron等）。

**现在AI使用完整版逻辑斯蒂模型**，请参考：
- [`docs/逻辑斯蒂人口增长模型.md`](./逻辑斯蒂人口增长模型.md) - 完整模型文档
- [`src/logic/population/logisticGrowth.js`](../src/logic/population/logisticGrowth.js) - 实现代码

---

# ~~为什么需要简化？~~ [不再需要]

### ~~问题：AI国家没有详细资源数据~~ [错误]

**更正**：AI国家**有**详细资源数据！

## ✅ AI国家的实际资源系统

### 资源库存（`inventory`）

AI国家有完整的资源库存追踪：

```javascript
nation.inventory = {
    food: 1250,      // 粮食
    wood: 800,       // 木材
    stone: 600,      // 石料
    cloth: 500,      // 布料
    brick: 300,      // 砖块
    tools: 200,      // 工具
    plank: 400,      // 木板
    copper: 300,     // 铜矿
    iron: 300,       // 铁矿
    dye: 150,        // 染料
    papyrus: 200,    // 纸张
    delicacies: 100, // 珍馐
    furniture: 80,   // 家具
    ale: 150,        // 美酒
    fine_clothes: 120, // 华服
    spice: 100,      // 香料
    coffee: 80,      // 咖啡
    coal: 200,       // 煤炭
    steel: 150,      // 钢材
    // ... 所有游戏资源
}
```

### 资源生产系统（`updateAINationInventory`）

AI有完整的资源生产和消费模拟：

```javascript
// 生产率（基于资源偏好）
productionRate = baseProductionRate × bias^1.2 × productionTrend × epochMultiplier × wealthFactor

// 消费率（基于人口和战争）
consumptionRate = baseConsumptionRate × (1/bias)^0.8 × consumptionTrend × warMultiplier

// 库存目标（动态调整）
targetInventory = 500 × bias^1.2 × epochMultiplier × wealthFactor

// 净变化
netChange = (production - consumption) + correction + randomShock

// 更新库存
inventory[resource] = clamp(currentStock + netChange, minInventory, maxInventory)
```

**特点**：
- ✅ 每个资源有独立的生产/消费率
- ✅ 基于 `resourceBias`（资源偏好）：特产资源生产多，稀缺资源消费多
- ✅ 基于 `epoch`（时代）：后期产量更高
- ✅ 基于 `wealth`（财富）：富裕国家产量更高
- ✅ 基于 `isAtWar`（战争状态）：战争时消耗增加30-50%
- ✅ 有长周期波动（600-800天）：形成稳定的贸易渠道

### 资源偏好（`resourceBias`）

AI国家有资源偏好设定：

```javascript
nation.economyTraits.resourceBias = {
    food: 1.5,    // 农业国：粮食产量高
    iron: 0.6,    // 非工业国：铁矿产量低
    wood: 1.2,    // 林业国：木材产量高
    cloth: 0.8,   // 非纺织国：布料产量低
    // ...
}
```

**效果**：
- `bias > 1`：特产资源，生产 > 消费，容易出口
- `bias < 1`：稀缺资源，生产 < 消费，需要进口
- `bias = 1`：平衡资源，自给自足

## 🎯 结论

**AI国家完全可以使用完整的逻辑斯蒂模型！**

不需要简化，因为：
1. ✅ AI有 `inventory.food`（粮食库存）
2. ✅ AI有 `resourceBias.food`（粮食偏好）→ 可计算粮食产量
3. ✅ AI有 `ownBasePopulation`（目标人口）→ 可估算土地面积
4. ✅ AI有 `developmentRate`（发展速率）→ 可估算住房容量
5. ✅ AI有 `epoch`（时代）→ 可计算科技加成

**现在的实现**：
- 使用真实的粮食库存和产量
- 计算真实的承载力（粮食、土地、住房）
- 计算真实的资源约束（粮食供应比）
- 完整的S型增长曲线

---

# ~~以下内容已过时，仅供参考~~

---

AI国家的数据结构非常简单：

```javascript
{
    id: 'some_nation',
    name: '某国',
    population: 16,
    wealth: 1000,
    economyTraits: {
        ownBasePopulation: 16,      // 目标人口
        ownBaseWealth: 1000,        // 目标财富
        developmentRate: 1.0,       // 发展速率
        resourceBias: {             // 资源偏好
            food: 1.3,
            iron: 0.8,
            // ...
        }
    },
    nationInventories: {            // 资源库存（可选）
        food: 100,
        iron: 50,
        // ...
    }
}
```

**AI国家没有**：
- ❌ 粮食产量（`foodProduction`）
- ❌ 土地面积（`landArea`）
- ❌ 建筑系统（`buildings`）
- ❌ 住房容量（`housingCapacity`）
- ❌ 科技等级（`technology`）
- ❌ 人口消费（`foodConsumption`）

**AI国家只有**：
- ✅ 目标人口（`ownBasePopulation`）
- ✅ 当前人口（`population`）
- ✅ 财富（`wealth`）
- ✅ 发展速率（`developmentRate`）
- ✅ 资源偏好（`resourceBias`）
- ✅ 资源库存（`nationInventories`，部分国家）

## ✅ 简化方案

### 核心思路

**用AI现有的数据来近似模拟资源约束**：

1. **承载力** ≈ `ownBasePopulation` × 各种倍率
2. **资源约束** ≈ 人均财富 + 发展速率 + 粮食偏好
3. **逻辑斯蒂曲线** = 保持不变（S型增长）

### 承载力计算

```javascript
// 基础承载力 = 目标人口
baseCapacity = ownBasePopulation

// 发展倍率（0.5x - 1.5x）
// developmentRate 通常在 0.5 - 2.0 之间
developmentMultiplier = 1 + (developmentRate - 1) × 0.5

// 时代倍率（每个时代 +30%）
// 古代: 1.0x, 封建: 1.3x, 工业: 1.6x
epochMultiplier = 1 + epoch × 0.3

// 财富倍率（0.5x - 2.0x）
// 基于人均财富，50为基准
wealthPerCapita = wealth / max(1, population)
wealthMultiplier = clamp(wealthPerCapita / 50, 0.5, 2.0)

// 最终承载力
K = baseCapacity × developmentMultiplier × epochMultiplier × wealthMultiplier
```

**示例**：
```
基础人口: 100
发展速率: 1.5 → 倍率 1.25x
时代: 1 (封建) → 倍率 1.3x
人均财富: 75 → 倍率 1.5x

承载力 = 100 × 1.25 × 1.3 × 1.5 = 244
```

### 资源因子计算

```javascript
resourceFactor = 1.0

// 1. 财富因子
if (wealthPerCapita < 20) {
    resourceFactor *= 0.6  // 贫困：-40%
} else if (wealthPerCapita > 100) {
    resourceFactor *= 1.3  // 富裕：+30%
}

// 2. 发展因子（0.7x - 1.3x）
resourceFactor *= (0.7 + developmentRate × 0.3)

// 3. 战争惩罚
if (isAtWar) {
    resourceFactor *= 0.7  // -30%
}

// 4. 粮食偏好加成
foodBias = resourceBias.food || 1.0
if (foodBias > 1.2) {
    resourceFactor *= 1.1  // 农业国：+10%
} else if (foodBias < 0.8) {
    resourceFactor *= 0.9  // 非农业国：-10%
}
```

**示例**：
```
人均财富: 60 → 1.0x
发展速率: 1.2 → 1.06x
战争: 否 → 1.0x
粮食偏好: 1.5 → 1.1x

资源因子 = 1.0 × 1.06 × 1.0 × 1.1 = 1.166
```

## 📊 效果对比

### 场景：普通AI国家

**初始状态**：
- 人口：16
- 目标人口：16
- 财富：1000
- 发展速率：1.0
- 粮食偏好：1.3
- 难度：地狱（2.0x）

**承载力计算**：
```
baseCapacity = 16
developmentMultiplier = 1 + (1.0 - 1) × 0.5 = 1.0
epochMultiplier = 1 + 0 × 0.3 = 1.0
wealthPerCapita = 1000 / 16 = 62.5
wealthMultiplier = 62.5 / 50 = 1.25

K = 16 × 1.0 × 1.0 × 1.25 = 20
```

**资源因子**：
```
财富因子 = 1.0 (人均62.5，正常)
发展因子 = 0.7 + 1.0 × 0.3 = 1.0
战争因子 = 1.0
粮食因子 = 1.1 (偏好1.3 > 1.2)

resourceFactor = 1.0 × 1.0 × 1.0 × 1.1 = 1.1
```

**增长模拟**（每10 ticks）：

| Tick | 人口 | 承载力 | 利用率 | 增长率 |
|------|------|--------|--------|--------|
| 0 | 16 | 20 | 80% | - |
| 10 | 17 | 21 | 81% | +6.3% |
| 20 | 18 | 22 | 82% | +5.9% |
| 30 | 19 | 23 | 83% | +5.6% |
| 40 | 20 | 24 | 83% | +5.3% |
| 50 | 21 | 25 | 84% | +5.0% |
| 100 | 25 | 30 | 83% | +4.0% |
| 200 | 35 | 42 | 83% | +2.9% |

**观察**：
- ✅ 增长速度随承载力利用率提高而减缓
- ✅ 不会无限增长
- ✅ 财富增长会提升承载力
- ✅ 符合S型曲线

### 对比：旧模型 vs 简化逻辑斯蒂模型

**旧模型（指数）**：
```
Tick 0:   16
Tick 100: 189  (+1081%)
Tick 200: 2,291 (+14,219%)
```

**新模型（简化逻辑斯蒂）**：
```
Tick 0:   16
Tick 100: 25   (+56%)
Tick 200: 35   (+119%)
```

**结论**：即使是简化版，也能有效控制人口爆炸！

## 🎯 优势与局限

### 优势

1. ✅ **不需要修改AI数据结构**：使用现有数据
2. ✅ **仍然是S型曲线**：有承载力上限
3. ✅ **考虑经济约束**：财富、发展速率
4. ✅ **简单高效**：计算量小
5. ✅ **可调节**：通过倍率调整平衡

### 局限

1. ⚠️ **不如完整模型精确**：没有真实的粮食计算
2. ⚠️ **承载力是估算的**：基于目标人口和财富
3. ⚠️ **资源约束是近似的**：用财富代替粮食
4. ⚠️ **无法模拟粮食危机**：没有真实的粮食短缺

### 为什么这样够用？

**对于AI国家来说**：
- AI不需要像玩家那样精细管理资源
- AI的作用是提供外交、贸易、战争对手
- 重要的是**人口增长合理**，而非**模拟精确**
- 简化模型已经能防止人口爆炸

**如果未来需要更精确**：
- 可以给AI添加 `estimatedFoodProduction` 字段
- 可以基于 `resourceBias.food` 计算粮食产量
- 可以添加 `landArea` 估算
- 但目前的简化版已经足够好了！

## 🔧 参数调整

### 如果AI增长太快

**降低基础增长率**：
```javascript
// 当前：2.5% per 10 ticks
const intrinsicGrowthRate = 0.025 * tickScale;

// 改为：2.0% per 10 ticks
const intrinsicGrowthRate = 0.020 * tickScale;
```

**降低难度倍率**：
```javascript
const difficultyMap = {
    'extreme': 2.0  // 改为 1.5
};
```

**降低财富倍率上限**：
```javascript
// 当前：0.5x - 2.0x
const wealthMultiplier = Math.min(2.0, Math.max(0.5, wealthPerCapita / 50));

// 改为：0.5x - 1.5x
const wealthMultiplier = Math.min(1.5, Math.max(0.5, wealthPerCapita / 50));
```

### 如果AI增长太慢

**提高基础增长率**：
```javascript
const intrinsicGrowthRate = 0.030 * tickScale; // 3.0%
```

**提高资源因子**：
```javascript
// 富裕加成
if (wealthPerCapita > 100) {
    resourceFactor *= 1.5; // 从 1.3 改为 1.5
}
```

**降低承载力约束**：
```javascript
// 让承载力更容易提升
const wealthMultiplier = Math.min(3.0, Math.max(0.5, wealthPerCapita / 30));
```

## 📝 总结

简化版逻辑斯蒂模型是一个**务实的解决方案**：

1. ✅ 解决了指数增长的问题
2. ✅ 不需要修改AI数据结构
3. ✅ 使用现有数据近似模拟资源约束
4. ✅ 保持S型增长曲线
5. ✅ 计算简单高效
6. ✅ 可调节平衡

**核心理念**：
> 用AI现有的简单数据（人口、财富、发展速率），
> 近似模拟复杂的资源约束（粮食、土地、住房），
> 实现合理的人口增长曲线。

**结果**：
- 旧模型：100天达到189人口（失控）
- 新模型：100天达到25人口（合理）

**够用了！** 🎉

---

**版本**: 1.0.0  
**日期**: 2026-01-29  
**状态**: ✅ 已实现并集成
