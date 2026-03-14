# 🏛️ AI 文明真实发展系统 — 完整策划案

**版本：** v1.0  
**日期：** 2026-03-14  
**定位：** 快速落地、高性能、可感知

---

## 一、现状诊断与设计哲学

### 现状问题

读完代码后，核心问题很清晰：

| 问题 | 现状机制 | 玩家感受 |
|------|---------|---------|
| AI 发展是"估算" | `updateAINationInventory` 靠 bias+周期函数模拟库存，不真正生产 | 经济是假的，数字在飘 |
| 建筑只是"画像" | `planAIBuildingProfile` 只是规划配比，`virtualBuildings` 是数字，不执行生产逻辑 | AI 没有真实产出链 |
| 时代升级靠财富阈值 | `checkAIEpochProgression` 只看 `population >= reqPop && wealth >= reqWealth` | AI 瞬跳时代，无过程感 |
| 贸易缺乏动机 | AI 互相贸易是库存溢出时的被动行为，无策略 | 贸易冷清，感觉是摆设 |
| 战争无胜负目标 | `aiWar.js` 战争逻辑完善，但 AI 无法感知"要打赢需要什么" | 战争没有准备，乱开战 |
| 外交是随机事件 | 结盟靠关系值随机达成，无地缘/利益逻辑 | 外交感觉随机 |

### 设计哲学：三层抽象

不要让 AI 跑完全相同的玩家逻辑（太重），也不要纯数字模拟（太假）。用三层：

```
Layer 1: 战略层 [每 50~200 tick]  → 目标设定、时代决策、战争意愿
Layer 2: 运营层 [每 10~30 tick]   → 虚拟建筑执行、资源流转、贸易发起
Layer 3: 表现层 [每 tick]         → 人口/财富微调、动画数字
```

**性能关键：** 80% 的 AI 用 Light-path（只跑 Layer 3），20% 用 Full-path（全三层），用 tick 轮转错开。

---

## 二、核心机制一：AI 真实建筑执行系统

### 2.1 现状与改造点

`virtualBuildings` 现在是一个 `{ building_id: count }` 的 profile，计划了但不执行产出。`foreignEconomy.js` 里的 `calculateAIVirtualEconomy` 已经在计算"虚拟经济输出"了——**这个基础很好，但还缺少一步：让产出真正驱动资源和科技积累**。

### 2.2 改造方案：给虚拟建筑"接线"

在 `AIDevelopmentService.update()` 里，每次 heavy update 时执行：

```js
// 新增：virtualBuildingTick() — 让虚拟建筑真实产出
export const processAIVirtualBuildingOutput = ({ nation, epoch, tickScale }) => {
  const profile = nation.virtualBuildings || {};
  const output = {}; // 本轮产出

  for (const [buildingId, count] of Object.entries(profile)) {
    const building = BUILDINGS.find(b => b.id === buildingId);
    if (!building || (building.epoch || 0) > epoch) continue;
    
    for (const [resourceKey, amount] of Object.entries(building.output || {})) {
      if (resourceKey === 'maxPop') { /* 更新 carryingCapacity */ continue; }
      if (resourceKey === 'militaryCapacity') { /* 更新 militaryStrength */ continue; }
      // 科技/文化单独走累积器
      if (resourceKey === 'science') {
        nation._scienceAccum = (nation._scienceAccum || 0) + amount * count * tickScale;
        continue;
      }
      if (resourceKey === 'culture') {
        nation._cultureAccum = (nation._cultureAccum || 0) + amount * count * tickScale;
        continue;
      }
      output[resourceKey] = (output[resourceKey] || 0) + amount * count * tickScale;
    }
  }

  // 消耗输入资源（简化版：只检查关键输入）
  applyBuildingInputConsumption(nation, profile, tickScale);
  
  // 把产出写入 inventory（而非凭空维持）
  for (const [key, amount] of Object.entries(output)) {
    nation.inventory[key] = Math.min(
      getInventoryCap(key, epoch),
      (nation.inventory[key] || 0) + amount
    );
  }
}
```

### 2.3 建筑 Profile 动态调整触发器

当前 `planAIBuildingProfile` 只在初始化时运行。改为：

- **每 200 tick**：重新评估一次建筑配比（`AIBuildingExpansionPlanner`）
- **触发条件加权：**
  - 食物安全度 < 0.7 → 强制提升 gather 比例
  - 在战争中 > 100 tick → 提升 military 比例 +30%
  - 科技积累量足够下一时代 80% → 提升 civic/science 比例
  - 贸易逆差持续 50 tick → 提升对应短缺资源的 industry

---

## 三、核心机制二：AI 时代真实演进系统

### 3.1 当前问题

`checkAIEpochProgression` 只检查 `population + wealth` 阈值。AI 跳时代没有任何"研究过程"，导致 AI 经常在财富积累够了就突然升时代，而科技感为零。

### 3.2 科技积累器（Tech Accumulator）

在 nation 上新增字段：

```js
nation._scienceAccum   // 科技点累积（来自虚拟建筑真实产出）
nation._cultureAccum   // 文化点累积
nation._epochReadiness // 0~1，时代准备度（供 UI 展示）
```

**时代升级条件改造：**

```js
export const checkAIEpochProgression = (nation, logs, tick) => {
  const nextEpoch = EPOCHS.find(e => e.id === (nation.epoch || 0) + 1);
  if (!nextEpoch) return;
  
  // 科技门槛：用累积科技点 vs reqScience（按比例缩减）
  const scienceReq = (nextEpoch.req?.science || 0) * AI_SCIENCE_SCALE; // 建议 0.3x
  const cultureReq  = (nextEpoch.req?.culture || 0) * AI_CULTURE_SCALE; // 建议 0.3x
  const popReq      = nextEpoch.req?.population || 0;
  
  const scienceReady  = (nation._scienceAccum || 0) >= scienceReq;
  const cultureReady  = (nation._cultureAccum || 0) >= cultureReq;
  const popReady      = (nation.population || 0) >= popReq;
  const wealthReady   = (nation.wealth || 0) >= (nextEpoch.cost?.silver || 0) * 2;
  
  // 计算准备度（可视化用）
  const readiness = Math.min(1, [
    scienceReady ? 1 : (nation._scienceAccum || 0) / Math.max(1, scienceReq),
    cultureReady ? 1 : (nation._cultureAccum || 0) / Math.max(1, cultureReq),
    popReady ? 1 : (nation.population || 0) / Math.max(1, popReq),
    wealthReady ? 1 : (nation.wealth || 0) / Math.max(1, (nextEpoch.cost?.silver || 0) * 2),
  ].reduce((a, b) => a + b, 0) / 4);
  
  nation._epochReadiness = readiness;
  
  if (scienceReady && cultureReady && popReady && wealthReady) {
    // 消耗资源
    nation._scienceAccum -= scienceReq;
    nation._cultureAccum -= cultureReq;
    nation.wealth = Math.max(0, nation.wealth - nextEpoch.cost.silver);
    nation.epoch = nextEpoch.id;
    nation._lastEpochUpgradeTick = tick;
    logs.push(`🚀 ${nation.name} 迈入了【${nextEpoch.name}】！`);
    
    // 时代升级后：解锁新建筑配比
    nation._needsBuildingReplan = true;
  }
}
```

**效果：** AI 升时代有了真实的"研究-积累-突破"过程，和玩家感觉相近但轻量得多。

---

## 四、核心机制三：AI 战争决策系统（有头有尾）

### 4.1 现状问题

`aiWar.js` 的宣战逻辑已经很完善（有侵略性、关系值等），但缺少**战争目标**和**战前准备**。AI 开战往往不是"打得赢就打"，而是随机乱打。

### 4.2 战争目标系统（War Goal）

```js
const WAR_GOALS = {
  TRIBUTE:      { id: 'tribute',      minPowerRatio: 1.3 }, // 要钱：需要军力优势1.3x
  VASSAL:       { id: 'vassal',       minPowerRatio: 1.8 }, // 附庸：需要2x
  ANNEX_BORDER: { id: 'annex_border', minPowerRatio: 1.5 }, // 割地
  PREEMPTIVE:   { id: 'preemptive',   minPowerRatio: 1.0 }, // 先发制人（被威胁时）
  REVENGE:      { id: 'revenge',      minPowerRatio: 0.8 }, // 复仇（关系值<10时可以劣势开打）
};
```

**宣战前的决策树：**

```
1. 扫描周边国 → 计算 powerRatio = 自身军力 / 目标军力
2. 检查是否有合适 warGoal（powerRatio >= goal.minPowerRatio）
3. 检查战争预算（wealth >= 预计战费 × 2）
4. 检查盟友态度（有盟友则 powerRatio 加成）
5. 通过 → 宣战并记录 warGoal
```

### 4.3 战前准备阶段（War Preparation Phase）

新增 `warPreparationPhase`，当 AI 决定要打某国后，**先进入 50~150 tick 的备战期**：

```js
nation.warPreparation = {
  targetId:  'nation_xx',
  startTick: tick,
  readyTick: tick + 50 + Math.floor(aggression * 100), // 侵略性越高准备越仓促
  actions:   ['recruit_military', 'stockpile_food', 'diplomatic_isolation']
}
```

备战期内：
- 军事建筑配比 +40%
- 食物库存目标 +50%（备粮）
- 向目标国盟友发外交压力（降低关系值）
- **可见！** → 玩家能从 NationDetailView 看到"某国正在备战"

### 4.4 战争疲劳与结束条件

```js
// 每 tick 战争中累积
nation.warFatigue = (nation.warFatigue || 0) + (militaryLoss / maxMilitary) * 0.1;
nation.warFatigue += (wealthLoss / wealth) * 0.05;

// 达到阈值：AI 主动求和
if (nation.warFatigue > WAR_FATIGUE_THRESHOLD[warGoal]) {
  triggerAIPeaceRequest(nation, target, logs);
}
```

| warGoal | 疲劳阈值 | 含义 |
|---------|---------|------|
| TRIBUTE | 0.4 | 要钱的仗不值得拼命 |
| ANNEX_BORDER | 0.6 | 领土战打到中等消耗 |
| VASSAL | 0.65 | 建立附庸需要持续压力 |
| PREEMPTIVE | 0.5 | 先发制人不宜久拖 |
| REVENGE | 0.8 | 仇恨战争打到底 |

---

## 五、核心机制四：AI 贸易系统（有供需动机）

### 5.1 现状问题

AI 互相贸易是"库存溢出时被动卖出"，没有主动需求，贸易路线感觉冷清。

### 5.2 贸易需求信号系统

新增 `nation.tradeNeeds`（每 30 tick 更新一次）：

```js
nation.tradeNeeds = {
  wants:   ['food', 'iron'],    // 短缺的，想买
  offers:  ['wood', 'stone'],   // 盈余的，想卖
  urgency: 0.7,                 // 0~1，越高越急
}
```

**匹配逻辑（每 50 tick 运行一次 AI-AI 贸易撮合）：**

```js
export const processAIAITradeMatching = (nations, tick) => {
  const wantMap  = buildWantMap(nations);   // resource -> [nation]
  const offerMap = buildOfferMap(nations);  // resource -> [nation]
  
  for (const [resource, buyers] of Object.entries(wantMap)) {
    const sellers = offerMap[resource] || [];
    if (sellers.length === 0) continue;
    
    buyers.sort((a, b) => b.urgency - a.urgency);
    
    for (const buyer of buyers.slice(0, 3)) { // 每轮最多匹配3个
      const seller = selectBestSeller(sellers, buyer); // 考虑关系值
      if (!seller) continue;
      
      const tradeAmount = Math.min(
        seller.inventory[resource] * 0.3,
        calculateBuyerNeed(buyer, resource)
      );
      const price = calculateTradePrice(resource, seller, buyer);
      
      executeTrade(seller, buyer, resource, tradeAmount, price);
      adjustRelations(seller, buyer, +Math.floor(2 + Math.random() * 4)); // 关系 +2~5
    }
  }
}
```

### 5.3 贸易协定与经济圈

当两国贸易关系达到阈值（关系 >= 75 + 贸易次数 >= 10），自动触发**贸易协定**：

- 双方资源价格互相折扣 -20%
- 关系值锚点提升到 65（更难恶化）
- 可在外交界面可见
- **形成经济圈**：一组互有协定的国家 → 对外统一态度（类似 EU）

---

## 六、核心机制五：结盟逻辑（地缘 + 利益驱动）

### 6.1 现状问题

结盟靠关系值随机，没有地缘和利益逻辑，经常出现"风马牛不相及的两国突然结盟"。

### 6.2 结盟评分模型

```js
const evaluateAllianceScore = (nation, target, nations) => {
  let score = 0;
  
  // 1. 共同敌人（最强动机）
  const commonEnemies = getCommonEnemies(nation, target, nations);
  score += commonEnemies.length * 25;
  
  // 2. 贸易互补性（有钱一起赚）
  const tradeCompatibility = calculateTradeCompatibility(nation, target);
  score += tradeCompatibility * 20; // 0~1 → 0~20分
  
  // 3. 时代差距（太落后结盟没意义）
  const epochGap = Math.abs((nation.epoch || 0) - (target.epoch || 0));
  score -= epochGap * 10;
  
  // 4. 意识形态相近度
  if (nation.ideology && target.ideology) {
    const ideologyMatch = calculateIdeologyMatch(nation.ideology, target.ideology);
    score += ideologyMatch * 15;
  }
  
  // 5. 关系值基础
  score += (nation.foreignRelations?.[target.id] || 50) * 0.4;
  
  // 6. 对方盟友过多（扩散成本）
  const targetAllyCount = countAllies(target, nations);
  score -= targetAllyCount * 5;
  
  return score; // > 60 才会发出结盟请求
}
```

---

## 七、性能架构设计

### 7.1 分级更新调度器

```js
const AI_UPDATE_TIERS = {
  FULL:   { interval: 50, coverage: 0.15 }, // 15% AI 每50tick全量更新
  NORMAL: { interval: 20, coverage: 0.35 }, // 35% AI 每20tick运营更新
  LIGHT:  { interval: 5,  coverage: 0.50 }, // 50% AI 每5tick仅表现层
};

// 用 nation.id hash % 100 分桶，确保每 tick 负载均匀
const getTierForNation = (nation, tick) => {
  const hash = hashNationId(nation.id); // 0~99
  if (hash < 15 && tick % 50 === hash % 50) return 'FULL';
  if (hash < 50 && tick % 20 === hash % 20) return 'NORMAL';
  return 'LIGHT';
};
```

### 7.2 战略决策缓存

```js
// 战略层结果缓存在 nation 上，避免每次重算
nation._strategyCache = {
  tick: 1234,
  warTarget: null,
  tradeNeeds: {...},
  epochReadiness: 0.72,
  allianceScore: {...},
};

// 只有 FULL tier 才重算 strategyCache
if (tier === 'FULL') {
  nation._strategyCache = recalcStrategyCache(nation, allNations, tick);
}
```

### 7.3 增量式建筑执行

```js
// 每次建筑 profile 变化时，预计算净产出向量（一次性）
nation._buildingOutputVector = precomputeBuildingOutput(nation.virtualBuildings, epoch);
// { food: 12.3, wood: 8.1, science: 2.4, ... }

// 之后每 tick 只是：
for (const [resource, amount] of Object.entries(nation._buildingOutputVector)) {
  nation.inventory[resource] = (nation.inventory[resource] || 0) + amount * tickScale;
}
// O(资源数) 而非 O(建筑数×资源数)
```

---

## 八、实施路线图

### Phase 1（1~2 天，可立即落地）

| 任务 | 文件 | 优先级 |
|-----|------|--------|
| 给虚拟建筑接线（产出真实流入 inventory） | `foreignEconomy.js` + `AIDevelopmentService` | 🔴 最高 |
| 科技/文化累积器 + 时代升级改造 | `aiEconomy.js` → `checkAIEpochProgression` | 🔴 最高 |
| 预计算建筑产出向量（性能） | 新建 `buildingOutputCache.js` | 🟠 高 |

### Phase 2（3~5 天）

| 任务 | 文件 | 优先级 |
|-----|------|--------|
| 战争目标系统 + 备战阶段 | `aiWar.js` 扩展 | 🟠 高 |
| 战争疲劳值 | `aiWar.js` + `gameConstants.js` | 🟠 高 |
| AI-AI 贸易撮合器 | 新建 `aiTradeMatching.js` | 🟡 中 |
| 贸易需求信号 | `aiEconomy.js` 扩展 | 🟡 中 |

### Phase 3（1 周+）

| 任务 | 说明 | 优先级 |
|-----|------|--------|
| 结盟评分模型 | 替换现有随机结盟 | 🟡 中 |
| 贸易协定 + 经济圈 | 外交可视化 | 🟢 低（但玩法价值高）|
| 三级更新调度器 | 性能优化 | 🟢 低（当前 AI 数量下不是瓶颈）|

---

## 九、可感知性设计

这些改动如果玩家感受不到等于白做：

1. **NationDetailView 显示 `_epochReadiness`**：「🔬 科技进度：72%，距离封建时代还需约 80 天」
2. **备战状态标记**：关系界面显示「⚔️ 疑似备战中」
3. **贸易路线 UI**：有实际贸易记录的国家对显示贸易量
4. **时代升级新闻**：确保日志面板醒目显示
5. **经济圈标记**：地图上用虚线圈出有贸易协定的国家组

---

## 十、数值建议

| 参数 | 建议值 | 原因 |
|-----|--------|------|
| `AI_SCIENCE_SCALE`（时代科技需求系数） | 0.25~0.30 | 让 AI 能在合理时间升时代 |
| `AI_CULTURE_SCALE` | 0.20 | 文化门槛略低于科技 |
| 备战期长度 | `60 + (1 - aggression) * 90` tick | 保守型 AI 准备更充分 |
| 战争疲劳阈值（TRIBUTE目标） | 0.4 | 不值得拼命 |
| 战争疲劳阈值（REVENGE目标） | 0.8 | 仇恨战争打到底 |
| AI-AI 贸易撮合频率 | 每 50 tick | 不要太频繁（性能+真实）|
| 贸易关系值加成/次 | +2~5 | 积少成多，自然形成关系 |
| 建筑 Profile 重评估间隔 | 200 tick | 约 2 个游戏月 |

---

*策划案由小助手根据 civ-game 代码架构分析生成，2026-03-14*
