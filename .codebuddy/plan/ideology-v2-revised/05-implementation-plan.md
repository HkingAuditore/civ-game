# 理念系统 V2 — 逐步实施规划

> **基于代码审查的实施路线图**
> 
> 审查文件：ideologyEffects.js (780行，12种trigger/5种sourceType/6种ruleMod) | simulation.js (8442行) | ideologyEventBus.js (423行) | ideologies.js (60个理念) | ideologySynergies.js (30组联动) | strata.js (18种阶层含serf/scribe) | buildings.js (50种建筑) | militaryUnits.js (5种category)

---

## ⚠️ 方案勘误

修订方案中称"STRATA中无serf/scribe key"是**错误的**。经代码验证：
- `serf` 存在于 strata.js 第84行 ✅
- `scribe` 存在于 strata.js 第284行 ✅
- 因此方案中所有 `serf→peasant`、`scribe→scholar` 的"修正"应**撤回**，保留原始引用

---

## 总览：7个Phase，预估总工作量 4000-5000 行变更

```
Phase 1: triggerState 扩展           ── simulation.js ~30行
Phase 2: converter sourceType 扩展    ── ideologyEffects.js ~50行
Phase 3: trigger type 新增            ── ideologyEffects.js ~150行
Phase 4: ruleMods 类型注册+消费实装   ── ideologyEffects.js ~30行 + simulation.js ~200行 + 各消费点文件
Phase 5: EventBus 上限调整            ── ideologyEventBus.js ~5行
Phase 6: 理念数据+联动数据            ── ideologies.js ~3000行 + ideologySynergies.js ~400行
Phase 7: UI label 扩展                ── IdeologyCard.jsx ~60行
```

---

## Phase 1：triggerState 扩展（前置依赖）

### 目标
在 `simulation.js` 的 `ideologyTriggerState`（第1320行）中新增外交/军事/经济状态字段，使 converter 和 trigger 能读到这些值。

### 涉及文件
| 文件 | 修改范围 | 类型 |
|------|----------|------|
| `src/logic/simulation.js` 第1320-1336行 | 扩展 ideologyTriggerState 对象 | 扩展现有 |

### 具体步骤

**Step 1.1** 在 ideologyTriggerState 中追加字段：

```js
const ideologyTriggerState = {
    // ...existing 13 fields...
    
    // === 新增 ===
    warCount: (nations || []).filter(n => n.isAtWar).length,
    friendlyCount: (nations || []).filter(n => (n.relation || 0) >= 50 && !n.isAtWar && !n.isAnnexed).length,
    vassalCount: (nations || []).filter(n => n.vassalOf === 'player').length,
    unemployment: previousPopStructure?.unemployed || 0,
    legitimacy: currentLegitimacy ?? 50,  // 需确认变量名（搜索 legitimacy 在 simulation.js 中的位置）
    avgApproval: _calcAvgApproval(classApproval),  // 辅助函数
    militarySize: _calcMilitarySize(recruitedUnits), // 辅助函数
    buildingCounts: buildings || {},
    unitCategoryCounts: _calcUnitCategoryCounts(recruitedUnits), // 辅助函数
};
```

**Step 1.2** 新增3个辅助函数（在 simulation.js 的 ideologyTriggerState 构造附近）：

```js
function _calcAvgApproval(classApproval) {
    if (!classApproval || typeof classApproval !== 'object') return 50;
    const values = Object.values(classApproval).filter(v => typeof v === 'number');
    return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 50;
}

function _calcMilitarySize(recruitedUnits) {
    if (!Array.isArray(recruitedUnits)) return 0;
    return recruitedUnits.reduce((sum, u) => sum + (u.count || 0), 0);
}

function _calcUnitCategoryCounts(recruitedUnits) {
    const counts = {};
    if (!Array.isArray(recruitedUnits)) return counts;
    for (const u of recruitedUnits) {
        if (u.category) counts[u.category] = (counts[u.category] || 0) + (u.count || 0);
    }
    return counts;
}
```

**Step 1.3** `tradeVolume` 字段需要追踪数据源：
- 搜索 simulation.js 中是否有贸易总量的计算
- 如果有现成的 `totalTradeValue` / `tradeIncome` 变量，直接引用
- 如果没有，暂时设置为 0，在 Phase 4 中与贸易系统对接

### 前置依赖
- 无，这是第一步

### 验证方式
- `npm run build` 通过
- 现有理念功能不受影响（新字段只新增不修改）
- console.log 一次 ideologyTriggerState 确认新字段有合理值

---

## Phase 2：converter sourceType 扩展

### 目标
在 `ideologyEffects.js` 的 `_readSourceValue` 函数（第586行）中新增12种 sourceType。

### 涉及文件
| 文件 | 修改范围 | 类型 |
|------|----------|------|
| `src/logic/ideology/ideologyEffects.js` 第586-600行 | `_readSourceValue` switch 扩展 | 扩展现有 |

### 具体步骤

**Step 2.1** 在 `_readSourceValue` 的 switch 中追加 case：

```js
// 现有5种: resource, buildingCount, officialCount, population, stability
// 新增12种:
case 'warCount':
    return triggerState.warCount || 0;
case 'friendlyCount':
    return triggerState.friendlyCount || 0;
case 'vassalCount':
    return triggerState.vassalCount || 0;
case 'tradeVolume':
    return triggerState.tradeVolume || 0;
case 'unemployment':
    return triggerState.unemployment || 0;
case 'legitimacy':
    return triggerState.legitimacy || 0;
case 'avgApproval':
    return triggerState.avgApproval || 0;
case 'militarySize':
    return triggerState.militarySize || 0;
case 'wealthyPop':
    // 从 classLivingStandard 中统计富裕人口
    return _sumPopByLivingStandard(triggerState, 'wealthy');
case 'poorPop':
    return _sumPopByLivingStandard(triggerState, 'poor');
case 'specificBuilding':
    return triggerState.buildingCounts?.[converter.source] || 0;
case 'unitCategory':
    return triggerState.unitCategoryCounts?.[converter.source] || 0;
```

**Step 2.2** 新增辅助函数 `_sumPopByLivingStandard`：

```js
function _sumPopByLivingStandard(triggerState, tier) {
    const cls = triggerState.classLivingStandard;
    if (!cls || typeof cls !== 'object') return 0;
    let sum = 0;
    for (const [stratum, level] of Object.entries(cls)) {
        const pop = triggerState.popStructure?.[stratum] || 0;
        if (tier === 'wealthy' && level >= 3) sum += pop;  // 3=小康以上
        if (tier === 'poor' && level <= 1) sum += pop;     // 1=贫困以下
    }
    return sum;
}
```

> **注意**：`classLivingStandard` 的数据格式需要确认。搜索 `livingStandard` 在 simulation.js 中的计算位置，确认存储格式（数字等级 or 字符串 label）。如果是字符串，需要调整比较逻辑。

### 前置依赖
- Phase 1 完成（triggerState 中有这些字段）

### 验证方式
- 编写一个测试理念配置，使用新的 sourceType，确认 converter 正确读值
- `npm run build` 通过

---

## Phase 3：新增5种 triggerEffect 类型

### 目标
在 `ideologyEffects.js` 的 `evaluateTriggerEffects` 函数（第72行的 switch）中新增5种需要独特逻辑的 trigger type。

### 涉及文件
| 文件 | 修改范围 | 类型 |
|------|----------|------|
| `src/logic/ideology/ideologyEffects.js` | switch 追加5个 case + 5个实现函数 | 扩展现有 |

### 具体步骤

**Step 3.1** 在 switch 中追加5个 case（第109行 `case 'resource_drain'` 之后）：

```js
case 'approval_threshold_bonus':
    _applyApprovalThresholdBonus(trigger, gameState, bonuses, levelScale);
    break;
case 'building_specific_bonus':
    _applyBuildingSpecificBonus(trigger, gameState, bonuses, levelScale);
    break;
case 'unit_count_bonus':
    _applyUnitCountBonus(trigger, gameState, bonuses, levelScale);
    break;
case 'coalition_diversity_bonus':
    _applyCoalitionDiversityBonus(trigger, gameState, bonuses, levelScale);
    break;
case 'official_faction_bonus':
    _applyOfficialFactionBonus(trigger, gameState, bonuses, levelScale);
    break;
```

**Step 3.2** 实现5个私有函数：

| 函数 | 核心逻辑 | 预估行数 |
|------|----------|----------|
| `_applyApprovalThresholdBonus` | 读 `classApproval[stratum]`，判断是否 >threshold（或 invert 时 <threshold），满足则 applyScaledEffects(bonus) | ~20行 |
| `_applyBuildingSpecificBonus` | 读 `buildingCounts[buildingId]`，按 per 计组，应用 bonus，cap 限制 | ~25行 |
| `_applyUnitCountBonus` | 读 `unitCategoryCounts[category]`，按 per 计组，应用 bonus，cap 限制 | ~25行 |
| `_applyCoalitionDiversityBonus` | 统计当前执政联盟中的独立阶层数量，每个 +perStratum 效果，cap 限制 | ~30行 |
| `_applyOfficialFactionBonus` | 过滤 officials 数组中特定 faction 的官员数量，每个 +bonus，cap 限制 | ~25行 |

> **关键确认**：
> - `_applyApprovalThresholdBonus` 需要 gameState 中有 classApproval 数据 → 确认 Phase 1 已加入
> - `_applyCoalitionDiversityBonus` 需要访问执政联盟阶层 → 搜索 `rulingCoalition` 在 simulation.js 中的传递路径
> - `_applyOfficialFactionBonus` 需要 officials 数组中有 faction 字段 → 搜索 official 数据结构

### 前置依赖
- Phase 1 完成（gameState 中有 classApproval、buildingCounts、unitCategoryCounts）

### 验证方式
- 每种 trigger type 编写一个最小测试理念验证
- `npm run build` 通过
- ESLint 无错误

---

## Phase 4：ruleMods 类型注册 + 消费逻辑实装

### 目标
这是**最复杂的一步**。当前 `applyRuleMods()` 只收集数据，没有任何游戏逻辑消费。需要：
1. 在 `ideologyEffects.js` 中注册新的 ruleMod 类型
2. 在各个**消费点**实装读取逻辑

### 涉及文件
| 文件 | 修改范围 | 类型 |
|------|----------|------|
| `src/logic/ideology/ideologyEffects.js` 第673行 | activeRuleMods 对象扩展11种新type | 扩展现有 |
| `src/logic/simulation.js` | 多个消费点插入 ruleMod 读取逻辑 | 扩展现有 |
| `src/logic/economy/prices.js` | resource_price_mod / price_volatility_mod 消费 | 扩展现有 |
| `src/logic/economy/wages.js` | wages_mod 消费 | 扩展现有 |
| `src/logic/economy/taxes.js` | tax_modifier 消费 | 扩展现有 |
| `src/logic/economy/trading.js` | trade_route_mod 消费 | 扩展现有 |
| `src/hooks/useGameActions.js` | building_cost_mod / recruit_cost_mod 在用户操作时消费 | 扩展现有 |

### 具体步骤（按优先级分批）

#### Phase 4A：注册 ruleMod 类型（~10行）

在 `applyRuleMods()` 的 activeRuleMods 初始化中新增：

```js
const activeRuleMods = {
    // 现有6种
    building_cost_mod: {},
    official_bonus: {},
    tax_modifier: {},
    cooldown_mod: {},
    price_volatility_mod: {},
    tech_cost_mod: {},
    // 新增11种
    stratum_output_mod: {},
    building_input_mod: {},
    unit_attack_mod: {},
    unit_defense_mod: {},
    recruit_cost_mod: {},
    maintenance_cost_mod: {},
    corruption_mod: {},
    wages_mod: {},
    trade_route_mod: {},
    resource_price_mod: {},
    diplomatic_influence: {},
};
```

#### Phase 4B：优先消费 — 影响核心游戏循环的 ruleMod（~100行）

按影响面和复杂度排序，分3批实装：

**第1批（高优先级，影响经济循环）：**

| ruleMod | 消费文件 | 具体位置 | 实装方式 |
|---------|----------|----------|----------|
| `stratum_output_mod` | simulation.js | 阶层产出计算循环（搜索 "产出" 或 "production per stratum"） | 产出乘以 `(1 + mod[stratumKey])` |
| `wages_mod` | economy/wages.js | 工资计算主函数 | 工资基线乘以 `(1 + mod[stratumKey])` |
| `tax_modifier` | economy/taxes.js | 税收计算主函数 | 应税收入乘以 `(1 + mod[scope])` |
| `resource_price_mod` | economy/prices.js | 价格计算主函数 | 资源价格乘以 `(1 + mod[resourceId])` |
| `price_volatility_mod` | economy/prices.js | 价格波动计算 | 波动系数乘以 `(1 + mod._global)` |

> **实装模式**：每个消费点的模式相同：
> 1. 从 simulation.js 传递 `ideologyRuleMods` 到对应的经济函数
> 2. 在函数内读取对应的 ruleMod bucket
> 3. 用乘法叠加：`value *= (1 + (bucket[scope] || 0) + (bucket._global || 0))`

**第2批（中优先级，影响军事系统）：**

| ruleMod | 消费文件 | 具体位置 | 实装方式 |
|---------|----------|----------|----------|
| `unit_attack_mod` | 搜索战斗计算逻辑 | 攻击力计算 | `attack *= (1 + mod[category])` |
| `unit_defense_mod` | 搜索战斗计算逻辑 | 防御力计算 | `defense *= (1 + mod[category])` |
| `recruit_cost_mod` | useGameActions.js | 招募动作 | `cost *= (1 + mod[category])` |
| `maintenance_cost_mod` | simulation.js | 军事维护费计算 | `cost *= (1 + mod[category])` |

**第3批（低优先级，影响辅助系统）：**

| ruleMod | 消费文件 | 具体位置 | 实装方式 |
|---------|----------|----------|----------|
| `building_cost_mod` | useGameActions.js | 建造动作 | `cost *= (1 + mod[category])` |
| `building_input_mod` | simulation.js | 建筑消耗循环 | `input *= (1 + mod[buildingId])` |
| `tech_cost_mod` | 搜索科技研究成本 | 研究消耗 | `cost *= (1 + mod._global)` |
| `trade_route_mod` | economy/trading.js | 贸易收益 | `income *= (1 + mod._global)` |
| `corruption_mod` | 搜索腐败计算 | 腐败率 | `rate *= (1 + mod._global)` |
| `diplomatic_influence` | diplomacy/ | 外交影响力 | `influence += mod._global` |
| `official_bonus` | simulation.js | 官员效率 | `effectiveness *= (1 + mod[scope])` |
| `cooldown_mod` | ideologyEventBus.js | 事件冷却 | `cd *= (1 + mod._global)` |

> **关键注意**：每个消费点都需要：
> 1. 先搜索当前的函数签名
> 2. 确认 `ideologyRuleMods` 能通过参数传入
> 3. 如果函数签名需要变更，追踪所有调用者并更新

### 前置依赖
- Phase 1 完成（triggerState 中有数据）
- Phase 4A 完成（类型已注册）

### 验证方式
- 每种 ruleMod 写一个测试理念，观察数值变化
- 确认经济循环的数值合理性（没有导致无限循环或NaN）
- `npm run build` + `npm run lint`

---

## Phase 5：EventBus 安全上限调整

### 目标
调整 `EFFECT_CAPS.addBuff.maxDuration` 从 180 → 360，支持 L3 级别长期 buff。

### 涉及文件
| 文件 | 修改范围 | 类型 |
|------|----------|------|
| `src/logic/ideology/ideologyEventBus.js` 第97行 | EFFECT_CAPS.addBuff.maxDuration | 修改常量 |

### 具体步骤

**Step 5.1** 修改常量：
```js
addBuff: { maxDuration: 360 },  // was 180
```

### 前置依赖
- 无（独立变更）

### 验证方式
- `npm run build` 通过

---

## Phase 6：理念数据 + 联动数据

### 目标
在 `ideologies.js` 中新增50个理念配置，在 `ideologySynergies.js` 中新增18+10组联动。

### 涉及文件
| 文件 | 修改范围 | 类型 |
|------|----------|------|
| `src/config/ideologies.js` (122KB, 60个现有) | 追加50个理念对象 | 扩展现有 |
| `src/config/ideologySynergies.js` | 追加18组正向 + 10组反向 | 扩展现有 |

### 具体步骤

**Step 6.1** 分批添加理念（按类别）：

| 批次 | 类别 | 数量 | 预估行数 | 依赖的新机制 |
|------|------|------|----------|-------------|
| 6.1a | 哲学 (philosophy) | 6个 | ~400行 | inverse_scaling, converter, official_faction_bonus |
| 6.1b | 神学 (theology) | 5个 | ~330行 | converter(warCount/unemployment/stability), building_specific_bonus |
| 6.1c | 政治 (politics) | 6个 | ~400行 | coalition_diversity_bonus, converter(friendlyCount/vassalCount), official_faction_bonus |
| 6.1d | 经济 (economy) | 6个 | ~400行 | building_specific_bonus, stratum_output_mod, converter(tradeVolume) |
| 6.1e | 军事 (military) | 6个 | ~400行 | unit_attack_mod, unit_defense_mod, recruit_cost_mod, unit_count_bonus |
| 6.1f | 美学 (aesthetics) | 5个 | ~330行 | building_specific_bonus, stratum_output_mod |
| 6.1g | 科学 (science) | 5个 | ~330行 | converter(buildingCount), epoch_scaling, resource_price_mod |
| 6.1h | 社会 (social) | 6个 | ~400行 | approval_threshold_bonus, inverse_scaling, corruption_mod |
| 6.1i | 补充 (mixed) | 5个 | ~330行 | serfdom/thalassocracy/philosopher_king/golden_rule/cartography |

> **每个理念的数据结构模板**（参考现有理念格式）：
> ```js
> {
>     id: 'xxx',
>     name: 'XXX',
>     category: 'philosophy',
>     rarity: 'rare',
>     lore: '...',
>     minEpoch: 3,
>     effects: {
>         levels: [
>             { /* L1 */ },
>             { /* L2 - 含 triggerEffects/converters/ruleMods */ },
>             { /* L3 - 含 onEvents */ },
>         ],
>     },
> }
> ```

**Step 6.2** 添加联动（18+10=28组）：

> 每组联动约15行配置，共约420行
> 正向联动追加到 `IDEOLOGY_SYNERGIES` 数组
> 反向联动追加到 `ANTI_SYNERGIES` 数组

### 前置依赖
- Phase 1-4 全部完成（引擎层支持新机制）
- Phase 5 完成（buff 时长上限提升）

### 验证方式
- **引用校验**：确认所有 stratum/building/unit/ideology ID 在对应配置中存在
- **数值校验**：单理念最大加成 ≤ 0.15(L3)，converter cap ≤ 0.20，stability ≤ ±15
- `npm run build` + `npm run lint`
- 在游戏中装备新理念，确认效果正确显示和生效

---

## Phase 7：UI label 扩展

### 目标
在 IdeologyCard 组件中添加新 ruleMod/converter/trigger 类型的中文显示标签。

### 涉及文件
| 文件 | 修改范围 | 类型 |
|------|----------|------|
| `src/components/tabs/IdeologyCard.jsx` | RULE_MOD_LABELS + CONVERTER_SOURCE_LABELS + describeTriggerEffect | 扩展现有 |
| `src/utils/effectFormatter.js`（如果存在） | 新效果类型格式化 | 扩展现有 |

### 具体步骤

**Step 7.1** 在 RULE_MOD_LABELS 中追加11种新标签
**Step 7.2** 在 CONVERTER_SOURCE_LABELS 中追加12种新标签
**Step 7.3** 在 describeTriggerEffect() 中追加5种新 case

### 前置依赖
- Phase 3 完成（trigger type 代码存在）
- Phase 6 完成（有理念使用这些标签）

### 验证方式
- 在游戏中查看新理念卡片，确认所有效果文本正确显示
- 无 "unknown" 或空白效果

---

## 实施节奏建议

### 里程碑 1：引擎就绪（Phase 1-5）
- **预估工时**：2-3天
- **可交付**：现有60个理念正常工作 + 新引擎机制可用
- **风险点**：Phase 4 的 ruleMod 消费逻辑需要修改多个文件签名

### 里程碑 2：首批理念可玩（Phase 6 的 6.1a-6.1c）
- **预估工时**：1-2天
- **可交付**：17个新理念（哲学+神学+政治）可装备可生效
- **验证**：试玩「辩证法+虚无主义」混沌流、「佛法+道法自然」田园流

### 里程碑 3：全量理念+联动（Phase 6 剩余 + Phase 7）
- **预估工时**：2-3天
- **可交付**：全部50个新理念 + 28组联动 + UI完整
- **验证**：全部12条 build 路线各试玩一轮

### 里程碑 4：平衡调整
- **预估工时**：持续迭代
- **内容**：根据试玩反馈调整数值、修复边缘情况

---

## 风险清单

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| Phase 4 修改经济函数签名导致全局影响 | 高 | 搜索所有调用者，逐一确认参数传递链 |
| `tradeVolume` 在当前代码中无现成数据源 | 中 | 暂用0或基于贸易条约数量估算，后续对接 |
| `classLivingStandard` 数据格式与预期不符 | 中 | Phase 2 开始前先确认格式 |
| `unitCategoryCounts` 依赖 recruitedUnits 结构 | 中 | Phase 1 开始前先确认军事单位数据结构 |
| 50个理念的引用ID可能与现有理念冲突 | 低 | 添加前 grep 所有现有 ID |
| L3 buff 360天可能导致长期数值膨胀 | 低 | 强制 cooldown ≥ 360天，且 buff 不叠加 |

---

## 执行检查表

在开始每个 Phase 前，执行以下检查：

- [ ] 读取将要修改的文件的当前实现
- [ ] 搜索所有相关的 import/export 链
- [ ] 确认修改不会破坏现有测试
- [ ] 确认新增字段的数据源在 simulation tick 中可用
- [ ] 修改后运行 `npm run build`
