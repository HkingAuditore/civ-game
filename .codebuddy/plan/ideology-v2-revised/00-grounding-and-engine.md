# 理念系统 V2：精细化Buff + 跨学科理念扩展 实施方案（修订版）

> 设计哲学：每张理念卡都是一个「遗物」，玩家通过组合不同理念构建自己的「build」路线。
> 精细维度的引入让理念不再只是全局数值的堆叠，而是与具体的建筑、阶层、兵种、外交状态深度耦合，
> 形成「发现→选择→构建→协同」的心流循环。

---

## 代码现实摘要（Grounding Note）

### 已读取核心文件
- `src/logic/ideology/ideologyEffects.js` — 触发引擎（12种trigger type）、转化引擎（5种sourceType）、规则修改（6种ruleMod type）
- `src/logic/ideology/ideologyEventBus.js` — 事件驱动效果（5种action，30+事件类型）
- `src/logic/buildings/effects.js` — bonuses初始化 + applyEffects管道
- `src/config/ideologies.js` — 当前约50个理念（122KB）
- `src/config/ideologySynergies.js` — 20组正向联动 + 若干反向联动
- `src/logic/simulation.js` — ideologyTriggerState构造 + 消费管道
- `src/config/strata.js` — 18种阶层
- `src/config/militaryUnits.js` — 兵种类别: infantry/archer/cavalry/gunpowder/siege

### 关键架构发现

1. **`ruleMods` 是空壳** — `applyRuleMods()` 只收集数据传给UI展示（IdeologyCard中的RULE_MOD_LABELS），**没有任何游戏逻辑真正消费这些ruleMods**。所有新增ruleMod类型必须同时实现消费逻辑。
2. **triggerState 需扩展** — 当前 `ideologyTriggerState` 只包含 popStructure/epoch/techsUnlocked/resources/buildingCategoryCounts/officialCount/isAtWar/warScore/totalBuildings/stability/population/treasury，缺少 warCount/friendlyCount/vassalCount/tradeVolume/unemployment/legitimacy/avgApproval 等外交/经济状态。
3. **converter > trigger type** — 大部分「源值×比率→目标加成」的效果应走converter路径而非新增trigger type。只有真正有独特逻辑（阈值、非线性、过滤）的才需要新trigger type。
4. **bonuses字段 vs ruleMods 重叠** — 原方案1.1和1.4高度重叠，统一走ruleMods路径，不在bonuses中再开一层。
5. **实体引用需对齐** — STRATA中无'serf'/'scribe'key；兵种modifier系统按category（不按单兵种id）

---

## 第一部分：引擎层扩展

### Phase 0：triggerState 扩展（前置依赖）

在 `simulation.js` 的 `ideologyTriggerState` 构造中新增字段：

```js
const ideologyTriggerState = {
    // ...existing fields (popStructure, epoch, techsUnlocked, resources, 
    //   completedChains, buildingCategoryCounts, officialCount, isAtWar, 
    //   warScore, totalBuildings, stability, population, treasury)...
    
    // === 新增：外交/军事/经济状态 ===
    warCount: nations.filter(n => n.isAtWar).length,
    friendlyCount: nations.filter(n => (n.relation || 0) >= 50 && !n.isAtWar).length,
    vassalCount: nations.filter(n => n.vassalOf === playerNationId).length,
    tradeVolume: /* sum of active trade route values from economy state */,
    unemployment: popStructure?.unemployed || 0,
    legitimacy: currentLegitimacy || 50,
    avgApproval: /* average of Object.values(classApproval) */,
    classLivingStandard: classLivingStandard || {},
    classApproval: classApproval || {},
    classWealth: classWealth || {},
    militarySize: /* total recruited military units */,
    buildingCounts: buildings || {},       // per-building-id counts
    unitCounts: unitCounts || {},          // per-unit-type counts  
    unitCategoryCounts: unitCategoryCounts || {},  // per-category counts
};
```

### 1.1 统一走 ruleMods 路径（不在 bonuses 中重复）

> **修订说明**：原方案1.1中的12个bonuses新字段与1.4的ruleMods高度重叠。
> 统一走ruleMods路径，精细化buff通过ruleMods传递，在对应的消费点被读取。
> 不在 `initializeBonuses()` 中新增精细化字段。

### 1.2 新增 triggerEffect 类型（精简为5种，其余走converter）

> **修订说明**：原方案的14种新trigger type中，大部分是「源值×比率→目标」的线性映射，
> 应走converter的sourceType扩展。只保留有**独特逻辑**的5种新trigger type。

| 新类型 | 独特逻辑 | 为什么不能用converter |
|--------|----------|----------------------|
| `approval_threshold_bonus` | 阈值二值触发（满意度>X才激活） | converter是线性比例，不支持阈值 |
| `building_specific_bonus` | 按特定建筑ID计数（不是建筑类别） | 现有building_count_bonus只支持类别 |
| `unit_count_bonus` | 按兵种类别/ID计数加成 | 新维度，现有引擎无兵种数据 |
| `coalition_diversity_bonus` | 联盟阶层多样性（计数独特值） | 非线性源值（去重计数） |
| `official_faction_bonus` | 按特定派系的官员计数 | 需要过滤逻辑，不是简单读值 |

**被合并到converter的原trigger type（9种）：**
- `friendly_nation_bonus` → converter sourceType `friendlyCount`
- `vassal_count_bonus` → converter sourceType `vassalCount`
- `war_count_bonus` → converter sourceType `warCount`
- `living_standard_pop_bonus` → converter sourceType `wealthyPop` / `poorPop`
- `poor_stratum_count_bonus` → converter sourceType `poorPop`
- `trade_volume_scaling` → converter sourceType `tradeVolume`
- `stratum_wealth_scaling` → converter + 新sourceType `stratumWealth`
- `unemployment_scaling` → converter sourceType `unemployment`
- `legitimacy_scaling` → converter sourceType `legitimacy`

### 1.3 新增 converter sourceType（在 `_readSourceValue` 中）

| sourceType | 读取逻辑 | 用途 |
|---|---|---|
| `warCount` | `triggerState.warCount` | 战争驱动理念 |
| `friendlyCount` | `triggerState.friendlyCount` | 外交驱动理念 |
| `vassalCount` | `triggerState.vassalCount` | 朝贡/帝国理念 |
| `tradeVolume` | `triggerState.tradeVolume` | 贸易驱动理念 |
| `unemployment` | `triggerState.unemployment` | 就业/社会理念 |
| `legitimacy` | `triggerState.legitimacy` | 政治合法性理念 |
| `avgApproval` | `triggerState.avgApproval` | 民意驱动理念 |
| `militarySize` | `triggerState.militarySize` | 军事规模理念 |
| `wealthyPop` | 从classLivingStandard中筛选>=小康的人口 | 功利主义/福利类理念 |
| `poorPop` | 从classLivingStandard中筛选<=贫困的人口 | 社会达尔文/民粹类理念 |
| `specificBuilding` | `triggerState.buildingCounts?.[converter.source]` | 特定建筑计数 |
| `unitCategory` | `triggerState.unitCategoryCounts?.[converter.source]` | 兵种类别计数 |

### 1.4 新增 ruleMods type + **消费点实现**

> **关键修订**：每种ruleMod都必须在simulation.js中有真实的消费逻辑，不能只收集不消费。

| ruleMod type | 消费位置 | 实际逻辑 | 状态 |
|---|---|---|---|
| `building_cost_mod` | 建造/升级动作 | `cost *= (1 + mod[category])` | ✅ 已有概念，需实装消费 |
| `tech_cost_mod` | 科技研究成本 | `cost *= (1 + mod._global)` | ✅ 已有概念，需实装消费 |
| `price_volatility_mod` | 价格计算 | `volatility *= (1 + mod._global)` | ✅ 已有概念，需实装消费 |
| `official_bonus` | 官员效率 | `effectiveness *= (1 + mod[scope])` | ✅ 已有概念，需实装消费 |
| `tax_modifier` | 税收计算 | `tax *= (1 + mod[scope])` | ✅ 已有概念，需实装消费 |
| `cooldown_mod` | 事件冷却 | `cooldown *= (1 + mod._global)` | ✅ 已有概念，需实装消费 |
| `stratum_output_mod` | **新增** 阶层产出计算 | `output *= (1 + mod[stratumKey])` | 🆕 |
| `building_input_mod` | **新增** 建筑消耗计算 | `input *= (1 + mod[buildingId])` | 🆕 |
| `unit_attack_mod` | **新增** 战斗力计算 | `attack *= (1 + mod[category])` | 🆕 |
| `unit_defense_mod` | **新增** 战斗力计算 | `defense *= (1 + mod[category])` | 🆕 |
| `recruit_cost_mod` | **新增** 招募成本 | `cost *= (1 + mod[category])` | 🆕 |
| `maintenance_cost_mod` | **新增** 维护成本 | `cost *= (1 + mod[category])` | 🆕 |
| `corruption_mod` | **新增** 腐败计算 | `corruption *= (1 + mod._global)` | 🆕 |
| `wages_mod` | **新增** 工资计算 | `wage *= (1 + mod[stratumKey])` | 🆕 |
| `trade_route_mod` | **新增** 贸易收益 | `income *= (1 + mod._global)` | 🆕 |
| `resource_price_mod` | **新增** 资源价格 | `price *= (1 + mod[resourceId])` | 🆕 |
| `diplomatic_influence` | **新增** 外交影响力 | `influence += mod._global` | 🆕 |

### 1.5 EventBus 安全上限调整

将 `EFFECT_CAPS.addBuff.maxDuration` 从 180 提升到 360，以支持L3级别的长期战略buff。
同时限制L3 buff的等级缩放，确保不会无限叠加。
