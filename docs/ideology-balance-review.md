# 理念数值深度Review报告

> 评审视角：P社游戏策划 × civ-game开发者 × 构筑游戏玩家
> 评审日期：2026-03-13

---

## 一、核心问题诊断

### 1.1 数值量级错位

**问题描述**：理念的基础加成数值设计停留在"早期游戏"尺度，完全无法匹配后期规模。

| 维度 | 早期(时代0-2) | 中期(时代3-5) | 后期(时代6-8) | 当前理念加成 |
|------|--------------|--------------|--------------|-------------|
| 人口 | 100-500 | 500-2000 | 2000-10000+ | maxPop: 2%-8% |
| 建筑 | 20-80 | 80-300 | 300-3000+ | categories: 3%-12% |
| 银币/tick | 50-200 | 200-1000 | 1000-10000+ | taxIncome: 3%-8% |
| 资源库存 | 500-5000 | 5K-50K | 50K-500M+ | 阈值: 300-1000 |

**典型案例**：
- `communism` 1级 `production: 0.08` → 后期基础产出×(1+科技+时代+其他理念)已经500%+，这8%几乎不可感知
- `tributary_system` 1级仅 `taxIncome: 0.03` → 后期银币流数万/天，3%加成毫无策略意义
- `messianic_faith` 阈值 `threshold: 500` → 后期文化库存数亿，500阈值形同虚设

### 1.2 升级收益递减/倒挂

**问题描述**：多数理念升级后，边际收益递减甚至出现负面效果放大，违背"成长路线"的乐趣预期。

**典型案例**：

```
共产主义升级路线：
1级: +8%产出, +4%人口, -4%税收, -2%科研
2级: +10%产出(+2%), +6%人口(+2%), -2%稳定(新增!), -3%税收(+1%), +5%工业(新增), -3%科研(-1%更差!)
3级: +12%产出(+2%), +8%人口(+2%), -1%稳定(+1%), +8%工业(+3%), +4%军事(新增), -3%科研(不变)

问题：2级新增-2%稳定惩罚，科研惩罚反而增加，升级感是"付出代价换新能力"而非"纯粹变强"
```

```
朝贡体系升级路线：
1级: +3%税收
2级: +5%税收(+2%), converter: vassalCount×0.03→taxIncome
3级: +8%税收(+3%), 新增converter和ruleMods

问题：1级→2级仅+2%税收，在后期数万银币流中毫无感知；converter依赖附庸数量，无附庸时升级几乎无收益
```

### 1.3 触发条件阈值失效

**问题描述**：资源阈值型效果使用固定数值，在后期完全失效。

```javascript
// 当前实现 (失效)
{ type: 'resource_threshold', resource: 'culture', threshold: 500, bonus: { stability: 3 } }
// 后期文化库存: 500,000,000 → 阈值永远满足，无条件触发

// scaling系统已存在但应用不足
{ type: 'resource_threshold', resource: 'silver', threshold: 10000, ... }
// scaleLegacyResourceThreshold() 可以将 10000 → 500000+
// 但很多理念没有正确使用这个scaling
```

### 1.4 建筑计数型效果疲软

**问题描述**：`building_count_bonus` 使用线性per值，后期建筑上万时收益过低或需要调整。

```javascript
// 当前实现
{ type: 'building_count_bonus', category: 'industry', per: 8, bonus: { militaryBonus: 0.04 } }
// 10000建筑 ÷ 8 = 1250组 → 但有对数缩放

// 对数缩放公式: effectiveSets = sets × (1 + ln(1 + sets/10)) / (1 + sets/10)
// 1250组 → 有效组数约 1250 × 0.25 = 312 组 → 加成 312 × 0.04 = 12.48%
// 问题：后期1万建筑才换来12%加成，而基础加成才3-8%
```

### 1.5 Converter上限过低

**问题描述**：converter的cap设置为35%-50%，限制了后期成长性。

```javascript
// 当前实现
{ source: 'industry', sourceType: 'buildingCount', ratio: 0.015, target: 'production', cap: 0.35 }
// 1000工业建筑 × 0.015 = 15 → 但cap在0.35(35%)
// 实际上 24 建筑就触达上限，后期建筑无意义

// 应该设计为阶梯式cap或使用对数缩放
```

---

## 二、按理念类别的问题清单

### 2.1 经济类理念 (economy)

| 理念ID | 问题级别 | 具体问题 |
|--------|---------|---------|
| `mercantilism` | 严重 | 1级仅+4%税收，无任何成长机制；2级converter依赖tradeVolume但cap仅35% |
| `laissez_faire` | 中等 | 与communism互斥惩罚过高(-15%产出)，但自身加成平平 |
| `physiocracy` | 严重 | 仅+3%采集产出，后期采集类建筑数百座，3%几乎无感 |
| `communism` | 中等 | 升级路径有倒挂(科研惩罚增加)；converter设计良好但cap偏低 |
| `state_capitalism` | 轻微 | 整体设计较好，但onEvent触发条件过于宽泛 |

**改进方向**：
1. 经济理念应随建筑数量/贸易量/银币流进行缩放
2. 增加按建筑类别细分的converter
3. 增加资源消耗型强力效果(resource_drain)

### 2.2 政治类理念 (politics)

| 理念ID | 问题级别 | 具体问题 |
|--------|---------|---------|
| `tributary_system` | 严重 | 1级无任何机制，仅+3%税收；无附庸时完全白板 |
| `nationalism` | 中等 | 触发条件on_war_start太依赖外部事件，和平时期白板 |
| `republicanism` | 轻微 | 整体设计合理，但converters的cap偏低 |
| `divine_right` | 中等 | 依赖稳定度阈值但无scaling，后期稳定度常年80+ |

**改进方向**：
1. 政治理念应有"和平时期"和"战时"两种模式(conditional_flip)
2. 增加按统治联盟组成的加成(coalition_diversity_bonus)
3. 增加按官吏派系的加成(official_faction_bonus)

### 2.3 军事类理念 (military)

| 理念ID | 问题级别 | 具体问题 |
|--------|---------|---------|
| `militarism` | 轻微 | 整体设计较好，on_war_victory触发合理 |
| `pacifism` | 严重 | 和平加成perEpoch但上限不明确；无战时期收益过高 |
| `levee_en_masse` | 中等 | 按人口比例加成但ratio=0.006太低，1万人口才+60军事力 |
| `sea_power` | 中等 | 条约和战争事件触发，但日常无任何效果 |

**改进方向**：
1. 军事理念应增加"军备竞赛"机制(按军事建筑/单位数量缩放)
2. 增加"威慑力"机制(和平时期也有军事存在感)
3. 区分进攻型和防御型军事理念

### 2.4 宗教类理念 (theology)

| 理念ID | 问题级别 | 具体问题 |
|--------|---------|---------|
| `monotheism` | 严重 | 3级资源阈值500完全失效；文化消耗drainPerTick:3太少 |
| `polytheism` | 中等 | per: 5太粗糙，应按采集建筑类型细分 |
| `ancestor_worship` | 轻微 | epoch_scaling设计合理，成长曲线平滑 |
| `messianic_faith` | 中等 | drainPerTick: 3和threshold: 500在后期无意义 |

**改进方向**：
1. 宗教理念应有"信仰狂热度"机制(按 cleric 人口或宗教建筑缩放)
2. 资源消耗应随时代缩放(scaleLegacyResourceAmount)
3. 增加"神迹"类一次性强力效果(有冷却时间)

### 2.5 科学类理念 (science)

| 理念ID | 问题级别 | 具体问题 |
|--------|---------|---------|
| `positivism` | 中等 | tech_count_bonus perTech: 0.0015太低，100科技才+15%产出 |
| `natural_philosophy` | 轻微 | 整体设计合理，但军事惩罚-2%固定值 |
| `mechanization` | 中等 | per: 10太粗糙，后期工业建筑上千仅100组 |

**改进方向**：
1. 科学理念应与"科技树深度"联动(按科技数量/时代缩放)
2. 增加"科研机构"机制(按学术派官吏缩放)
3. 区分基础研究和应用研究两类理念

---

## 三、数值改进建议

### 3.1 基础加成缩放

**原则**：基础百分比加成保持固定，但增加可缩放的叠加层。

```javascript
// 当前
{ production: 0.08 }

// 改进方案
{
  production: 0.08,  // 固定基础
  converters: [
    { source: 'industry', sourceType: 'buildingCount', ratio: 0.003, target: 'production', cap: 0.50 }
    // 100工业建筑 → +30%，1000工业建筑 → +50%(触顶)
  ]
}
```

### 3.2 阈值动态化

**原则**：所有固定阈值必须使用scaling系统。

```javascript
// 当前 (失效)
{ type: 'resource_threshold', resource: 'culture', threshold: 500, bonus: { stability: 3 } }

// 改进方案
{ 
  type: 'resource_threshold', 
  resource: 'culture', 
  threshold: 500,  // 会被scaleLegacyResourceThreshold放大
  bonus: { stability: 3 },
  // 或使用比例阈值
  thresholdRatio: 0.1,  // 当期文化库存的10%
}
```

### 3.3 建筑计数阶梯化

**原则**：建筑计数效果应有阶梯式收益，而非线性或纯对数。

```javascript
// 当前 (对数缩放)
{ type: 'building_count_bonus', category: 'industry', per: 8, bonus: { militaryBonus: 0.04 } }

// 改进方案：阶梯式
{
  type: 'building_count_bonus',
  category: 'industry',
  tiers: [
    { min: 0, max: 50, per: 5, bonus: { militaryBonus: 0.02 } },
    { min: 50, max: 200, per: 10, bonus: { militaryBonus: 0.03 } },
    { min: 200, max: null, per: 20, bonus: { militaryBonus: 0.04 } }
  ],
  // 0-50建筑: 每5座+2% → 最多+20%
  // 50-200建筑: 每10座+3% → 额外+45%
  // 200+建筑: 每20座+4% → 额外成长
}
```

### 3.4 Converter上限分层

**原则**：converter cap应按时代或建筑数量分层。

```javascript
// 当前
{ source: 'industry', sourceType: 'buildingCount', ratio: 0.015, target: 'production', cap: 0.35 }

// 改进方案：分层cap
{
  source: 'industry',
  sourceType: 'buildingCount',
  ratio: 0.015,
  target: 'production',
  capTiers: [
    { buildings: 50, cap: 0.25 },
    { buildings: 150, cap: 0.40 },
    { buildings: 500, cap: 0.60 },
    { buildings: null, cap: 0.80 }
  ]
}
```

### 3.5 升级路径重设计

**原则**：升级应是"纯粹变强+解锁新机制"，而非"代价换能力"。

```javascript
// 当前 communism 升级路径 (有倒挂)
levels: [
  { production: 0.08, taxIncome: -0.04, scienceBonus: -0.02 },
  { production: 0.10, stability: -2, taxIncome: -0.03, scienceBonus: -0.03 },  // 科研惩罚增加!
  { production: 0.12, stability: -1, scienceBonus: -0.03 }  // 科研惩罚不变!
]

// 改进方案：边际递增
levels: [
  { 
    production: 0.08, 
    taxIncome: -0.04, 
    scienceBonus: -0.02,
    triggerEffects: [{ type: 'stratum_bonus', stratum: 'worker', bonus: { perPopPassive: { food: 0.002 } } }]
  },
  { 
    production: 0.12,  // +4% (比1级+4%)
    taxIncome: -0.03,  // 税收惩罚减轻
    scienceBonus: -0.02,  // 科研惩罚不增加
    categories: { industry: 0.05 },  // 新增工业加成
    converters: [{ source: 'industry', sourceType: 'buildingCount', ratio: 0.02, target: 'production', cap: 0.40 }]
  },
  { 
    production: 0.16,  // +4% (继续增长)
    taxIncome: -0.02,  // 税收惩罚继续减轻
    categories: { industry: 0.10 },  // 工业加成翻倍
    militaryBonus: 0.04,  // 新增军事加成
    onEvents: [{ event: 'on_epoch_advance', effect: { action: 'addBuff', ... } }]
  }
]
```

---

## 四、重点理念改进案例

### 4.1 朝贡体系 (tributary_system)

**现状**：1级完全白板(+3%税收)，无附庸时无任何机制。

**改进方案**：

```javascript
{
  id: 'tributary_system',
  name: '朝贡体系',
  category: 'politics',
  effects: {
    levels: [
      {
        taxIncome: 0.05,
        cultureBonus: 0.03,
        triggerEffects: [
          // 基础：按外交关系数量给予加成
          { type: 'unit_count_bonus', category: 'infantry', per: 3, bonus: { taxIncome: 0.01 }, cap: 0.15 },
        ],
      },
      {
        taxIncome: 0.08,
        cultureBonus: 0.05,
        converters: [
          // 核心机制：附庸贡献
          { source: 'vassalCount', sourceType: 'vassalCount', ratio: 0.05, target: 'taxIncome', cap: 0.60 },
          { source: 'vassalCount', sourceType: 'vassalCount', ratio: 0.03, target: 'cultureBonus', cap: 0.30 },
        ],
        ruleMods: [
          { type: 'diplomatic_influence', value: 0.10 },
        ],
      },
      {
        taxIncome: 0.12,
        cultureBonus: 0.08,
        converters: [
          { source: 'vassalCount', sourceType: 'vassalCount', ratio: 0.08, target: 'taxIncome', cap: 0.80 },
          { source: 'vassalCount', sourceType: 'vassalCount', ratio: 0.05, target: 'cultureBonus', cap: 0.40 },
          // 新增：友好国家也能贡献
          { source: 'friendlyCount', sourceType: 'friendlyCount', ratio: 0.02, target: 'taxIncome', cap: 0.30 },
        ],
        onEvents: [
          { event: 'on_treaty_sign', effect: { action: 'addBuff', name: '万国来朝', duration: 180, effects: { taxIncome: 0.15, cultureBonus: 0.10 } }, cooldownDays: 60 },
        ],
        triggerEffects: [
          // 条件翻转：稳定度高时获得额外加成
          { type: 'conditional_flip', condition: 'stability_above', threshold: 70,
            normalBonus: {}, flippedBonus: { cultureBonus: 0.05, taxIncome: 0.03 } },
        ],
      },
    ],
  },
}
```

### 4.2 重商主义 (mercantilism)

**现状**：1级仅+4%税收和-3%采集，无成长机制。

**改进方案**：

```javascript
{
  id: 'mercantilism',
  name: '重商主义',
  category: 'economy',
  effects: {
    levels: [
      {
        taxIncome: 0.06,
        categories: { gather: -0.03 },
        triggerEffects: [
          // 核心机制：贸易盈余 → 税收加成
          { type: 'resource_threshold', resource: 'silver', threshold: 2000, bonus: { taxIncome: 0.02 } },
          // 按完整产业链给予奖励
          { type: 'chain_count_bonus', countType: 'complete', perCount: { taxIncome: 0.015 }, cap: 0.25 },
        ],
      },
      {
        taxIncome: 0.10,
        categories: { industry: 0.04, gather: -0.04 },
        converters: [
          // 核心机制：贸易量 → 税收
          { source: 'tradeVolume', sourceType: 'tradeVolume', ratio: 0.0002, target: 'taxIncome', cap: 0.50 },
        ],
        ruleMods: [
          { type: 'trade_route_mod', value: 0.15 },  // 贸易路线容量+15%
        ],
      },
      {
        taxIncome: 0.15,
        categories: { industry: 0.06, gather: -0.05 },
        stability: 3,
        converters: [
          { source: 'tradeVolume', sourceType: 'tradeVolume', ratio: 0.0003, target: 'taxIncome', cap: 0.70 },
          // 新增：银币库存也能贡献
          { source: 'silver', sourceType: 'resource', ratio: 0.00001, target: 'production', cap: 0.30 },
        ],
        onEvents: [
          { event: 'on_trade_complete', effect: { action: 'addBuff', name: '关税整编', duration: 90, effects: { taxIncome: 0.12, stability: 5 } }, cooldownDays: 20 },
          { event: 'on_treasury_milestone', effect: { action: 'addStability', amount: 8 }, cooldownDays: 45 },
        ],
        triggerEffects: [
          // 互斥惩罚：与自由贸易理念冲突
          { type: 'mutual_exclusion', conflictsWith: ['laissez_faire'], 
            penalty: { taxIncome: -0.10, stability: -5 }, 
            bonusIfPure: { taxIncome: 0.05, production: 0.03 } },
        ],
      },
    ],
  },
}
```

### 4.3 共产主义 (communism)

**现状**：升级有倒挂，科研惩罚不合理放大。

**改进方案**：

```javascript
{
  id: 'communism',
  name: '共产主义',
  category: 'economy',
  effects: {
    levels: [
      {
        production: 0.10,
        maxPop: 0.05,
        taxIncome: -0.03,
        scienceBonus: -0.02,
        triggerEffects: [
          { type: 'stratum_bonus', stratum: 'worker', bonus: { perPopPassive: { food: 0.003 } } },
          { type: 'mutual_exclusion', conflictsWith: ['laissez_faire'], 
            penalty: { production: -0.12, stability: -8 }, 
            bonusIfPure: { production: 0.04 } },
        ],
      },
      {
        production: 0.15,
        maxPop: 0.08,
        taxIncome: -0.02,  // 税收惩罚减轻
        scienceBonus: -0.02,  // 科研惩罚不增加
        categories: { industry: 0.08 },
        converters: [
          { source: 'industry', sourceType: 'buildingCount', ratio: 0.02, target: 'production', cap: 0.50 },
          // 新增：工人人口 → 产出
          { source: 'worker', sourceType: 'population', ratio: 0.0001, target: 'production', cap: 0.30 },
        ],
        ruleMods: [
          { type: 'building_cost_mod', scope: 'industry', value: -0.15 },
        ],
      },
      {
        production: 0.20,
        maxPop: 0.12,
        taxIncome: -0.01,  // 税收惩罚继续减轻
        categories: { industry: 0.12 },
        militaryBonus: 0.05,
        scienceBonus: -0.01,  // 科研惩罚减轻
        converters: [
          { source: 'industry', sourceType: 'buildingCount', ratio: 0.025, target: 'production', cap: 0.70 },
          { source: 'worker', sourceType: 'population', ratio: 0.00015, target: 'production', cap: 0.40 },
        ],
        onEvents: [
          { event: 'on_epoch_advance', effect: { action: 'addBuff', name: '工业化运动', duration: 240, effects: { production: 0.25, categories: { industry: 0.15 } } }, cooldownDays: 90 },
        ],
        triggerEffects: [
          // 条件翻转：低稳定度时获得额外产出(革命激情)
          { type: 'conditional_flip', condition: 'stability_below', threshold: 50,
            normalBonus: { production: 0.02 },
            flippedBonus: { production: 0.08, stability: -3 } },
        ],
      },
    ],
  },
}
```

---

## 五、系统性改进建议

### 5.1 理念分层设计

按解锁时代设计差异化强度：

| 时代 | 基础加成范围 | Converter Cap | 触发效果强度 |
|------|------------|--------------|------------|
| 0-2 | 3%-8% | 25%-35% | 轻度 |
| 3-5 | 5%-12% | 35%-50% | 中度 |
| 6-8 | 8%-18% | 50%-80% | 重度 |

### 5.2 后期成长机制

为每个理念增加至少一种后期成长路径：

1. **建筑计数型**：`building_count_bonus` + 对数缩放
2. **资源转化型**：`converters` + 分层cap
3. **时代缩放型**：`epoch_scaling`
4. **人口关联型**：按阶层人口缩放
5. **官吏派系型**：按学术/军事派官吏缩放

### 5.3 互斥博弈强化

增加理念组合的深度博弈：

```javascript
// 示例：经济路线三选一
communism ⟷ laissez_faire  // 强互斥，同时装备-15%产出
mercantilism ⟷ free_trade  // 中互斥，同时装备-8%税收
state_capitalism           // 中立，可与多数搭配但效果折中
```

### 5.4 资源消耗型强力效果

为高稀有度理念增加资源消耗换取强力效果：

```javascript
{
  type: 'resource_drain',
  resource: 'silver',
  drainPerTick: 50,  // 后期会通过scaling放大
  bonus: { production: 0.15, scienceBonus: 0.10 },
  penaltyIfDrained: { production: -0.08, stability: -10 }
}
```

---

## 六、总结

### 核心问题
1. **数值量级错位**：早期设计的数值无法匹配后期规模
2. **升级路径倒挂**：升级付出大于收益，违背成长乐趣
3. **阈值条件失效**：固定阈值在后期形同虚设
4. **成长性不足**：converter cap过早触顶

### 改进优先级
1. **紧急**：修复明显倒挂的升级路径(communism, welfare_state等) ✅ **已完成 communism**
2. **高优先**：为白板理念添加成长机制(tributary_system, physiocracy等) ✅ **已完成 tributary_system, mercantilism**
3. **中优先**：调整converter cap分层机制 ✅ **已在三个理念中应用分层cap**
4. **低优先**：增加理念间的联动和互斥 ✅ **已在 mercantilism 中添加互斥机制**

---

## 七、已完成修改清单 (2026-03-13)

### 7.1 朝贡体系 (tributary_system)
**修改前问题**：1级完全白板，无附庸时无任何机制
**修改内容**：
- 1级增加基础税收+5%、文化+3%、步兵关联机制
- 2级 converter cap 从 45% 提升至 60%，增加外交影响力
- 3级 converter cap 从 45% 提升至 80%，新增友好国家贡献、条约事件

### 7.2 重商主义 (mercantilism)
**修改前问题**：1级仅+4%税收，无成长机制
**修改内容**：
- 1级增加银币阈值触发、产业链关联机制
- 2级 converter cap 从 35% 提升至 50%，增加贸易路线加成
- 3级 converter cap 从 35% 提升至 70%，新增银币→产出converter、互斥机制

### 7.3 共产主义 (communism)
**修改前问题**：升级路径科研惩罚倒挂，边际收益不足
**修改内容**：
- 1级产出从8%提升至10%，税收惩罚从-4%减轻至-3%
- 2级产出从10%提升至15%，科研惩罚不再增加，converter cap从35%提升至50%
- 3级产出从12%提升至20%，税收/科研惩罚继续减轻，converter cap提升至70%
- 新增工人人口→产出converter、低稳定度革命激情机制

### 7.4 一神教 (monotheism)
**修改前问题**：3级阈值500失效，升级路径科研惩罚倒挂(-3%→-4%→-5%)
**修改内容**：
- 1级基础稳定+6%、文化+5%，增加神职人员人口关联
- 2级科研惩罚不再增加，增加神职人员→稳定度converter，civic建筑cap提升至45%
- 3级阈值从500提升至5000，科研惩罚减轻至-2%，增加条件翻转（高稳定度信仰更虔诚）

### 7.5 弥赛亚信仰 (messianic_faith)
**修改前问题**：阈值500+drainPerTick:3在后期完全失效
**修改内容**：
- 重构为3级独立levels（原为全局triggerEffects）
- 阈值分层：3000→8000→20000，随后期规模有效触发
- drainPerTick从3提升至50（随scaling系统放大）
- 3级新增神职人员→稳定度converter、civic建筑→文化converter

### 7.6 重农主义 (physiocracy)
**修改前问题**：仅+3%采集产出，无任何成长机制
**修改内容**：
- 1级采集从8%提升至10%，增加采集建筑计数关联（每5座+2%）
- 2级增加农民人口→产出converter、采集建筑→税收converter
- 3级采集提升至20%，新增农业革命事件、条件翻转（高稳定度土地更肥沃）

### 7.7 君权神授 (divine_right)
**修改前问题**：epoch_scaling递减设计，升级科研惩罚倒挂
**修改内容**：
- 移除epoch_scaling递减，改为升级路径科研惩罚逐级减轻
- 增加农民人口→稳定度converter（封建地租）
- resource_drain随升级增加（10→20→35），体现宫廷规模扩大
- 3级新增农民→税收converter、条件翻转（高稳定度君权更巩固）

### 7.8 民族主义 (nationalism)
**修改前问题**：和平时期几乎白板，仅靠on_war_start事件
**修改内容**：
- 1级增加工业建筑计数关联（和平时期也有效果）
- 2级工业建筑→军事加成converter，人口converter cap提升至40%
- 3级双converter（人口+工业），军事加成提升至16%，战时buff增强

### 7.9 自由放任 (laissez_faire)
**修改前问题**：自身加成平平，互斥惩罚过高但bonusIfPure不足
**修改内容**：
- 1级工业从8%提升至10%，税收从4%提升至6%，chain_count_bonus增加cap
- 2级增加产业链→产出converter，converter cap提升至50%
- 3级工业提升至18%，税收提升至12%，增加条件翻转（高稳定度市场更活跃）

### 7.10 和平主义 (pacifism)
**修改前问题**：和平加成无上限，epoch_scaling无限增长
**修改内容**：
- 增加文化建筑计数关联（每5座+0.5稳定度，上限10/15/20）
- 增加civic建筑→科研/文化converter，cap分层35%→40%→55%
- epoch_scaling移至3级，避免无限增长
- 互斥和条件翻转移至各级，逻辑更清晰

### 7.11 全民皆兵 (levee_en_masse)
**修改前问题**：ratio=0.006太低，1万人口才+60军事力
**修改内容**：
- pop_ratio_bonus从0.01/0.005提升至0.015/0.008→0.018/0.010→0.020/0.012
- 人口converter ratio从0.00007提升至0.00010→0.00013，cap提升至50%→65%
- 战时buff效果增强（全民动员+18%→+22%）

### 7.12 海权论 (sea_power)
**修改前问题**：日常无任何效果，完全依赖事件触发
**修改内容**：
- 1级增加军事建筑计数关联（每5座+2.5%税收，cap 30%）
- 2级converter cap提升至45%，军事建筑→军事加成cap提升至40%
- 3级新增贸易路线加成+20%，converter cap提升至60%/55%

### 7.13 实证主义 (positivism)
**修改前问题**：perTech:0.0015太低，100科技才+15%产出
**修改内容**：
- perTech从0.0015提升至0.003→0.004→0.005
- 增加techCount→产出converter，cap分层50%→65%
- 3级新增techCount→科研加成converter（复利机制）
- 新增科研突破事件（on_tech_research）

### 7.14 机械化思维 (mechanization)
**修改前问题**：per:10太粗糙，升级路径文化惩罚倒挂
**修改内容**：
- building_count_bonus per从10降至8→6→5，cap分层35%→45%→55%
- 增加工业建筑→科研/产出双converter，cap分层50%→65%
- 升级路径文化惩罚不再增加（-3%→-3%→-4%）
- 新增机械化浪潮事件（on_epoch_advance）

### 预期效果
- 每个理念在任何时代都有"存在感"
- 升级永远是正向反馈
- 后期建筑/资源规模下效果仍可感知
- 理念组合有深度博弈空间

---

## 八、空置触发器补充 (2026-03-13)

### 8.1 补充背景

通过对 `ideologies.js` 的全面扫描，发现以下触发器类型完全未被使用：

| 类型 | 说明 | 补充到的理念 |
|------|------|------------|
| `unit_count_bonus` | 军事单位数量关联 | 军国主义、全民皆兵、海权论 |
| `building_specific_bonus` | 特定建筑ID计数加成 | 一神教、多神教、祖先崇拜、重商主义、重农主义、实证主义、机械化思维 |
| `militarySize` converter | 军队总规模 | 军国主义、全民皆兵 |
| `avgApproval` converter | 平均满意度 | 共和主义、一神教、多神教、重商主义 |
| `legitimacy` converter | 合法性 | 君权神授、祖先崇拜 |
| `unitCategory` converter | 特定兵种数量 | 海权论（海军） |
| `inverse_scaling` | 逆向缩放（扩展） | 共和主义、机械化思维 |

### 8.2 军事类理念补充

#### 军国主义 (militarism)
- 1级新增：步兵数量 → 军事加成（每5单位+1.5%，cap 25%）
- 2级新增：骑兵数量 → 军事加成（每3单位+2%，cap 30%）；军队规模 → 稳定度 converter
- 3级新增：全兵种数量 → 军事加成（每8单位+1.8%，cap 45%）；军队规模 → 军事加成 converter

#### 全民皆兵 (levee_en_masse)
- 1级新增：步兵数量 → 军事力（每10单位+1.2%，cap 20%）
- 2级新增：全兵种数量 → 军事力（每8单位+1.5%，cap 30%）；军队规模 → 稳定度 converter
- 3级新增：全兵种数量 → 军事力（每6单位+1.8%，cap 45%）；军队规模 → 军事加成 converter

#### 海权论 (sea_power)
- 1级新增：海军单位数量 → 税收（每3单位+2%，cap 25%）
- 2级新增：海军规模 → 贸易量 converter（unitCategory）；海军单位 → 军事加成（每2单位+1.8%，cap 35%）
- 3级新增：海军规模 → 军事加成 converter（unitCategory）；海军单位 → 税收+军事（每2单位+2.2%+1.5%，cap 55%）

### 8.3 宗教类理念补充

#### 一神教 (monotheism)
- 1级新增：寺庙数量 → 稳定度（每3座+0.8，cap 12）
- 2级新增：寺庙数量 → 稳定度+文化（每2座+1.0+1%，cap 18）；满意度 → 文化 converter
- 3级新增：寺庙数量 → 稳定度+文化+人口（每2座+1.2+1.5%+0.5%，cap 25）；满意度 → 稳定度 converter

#### 多神教 (polytheism)
- 1级新增：神庙数量 → 采集加成（每3座+2%，cap 30%）
- 2级新增：神庙数量 → 采集+文化（每2座+2.5%+0.8%，cap 40%）；满意度 → 文化 converter
- 3级新增：神庙数量 → 采集+文化+人口（每2座+3%+1%+0.4%，cap 50%）；满意度 → 文化+稳定度 converter

#### 祖先崇拜 (ancestor_worship)
- 1级新增：祠堂数量 → 稳定度（每3座+0.8，cap 12）
- 2级新增：祠堂数量 → 稳定度+人口（每2座+1.0+0.4%，cap 18）；合法性 → 稳定度 converter
- 3级新增：祠堂数量 → 稳定度+人口+文化（每2座+1.2+0.5%+0.8%，cap 25）；合法性 → 稳定度+文化 converter

### 8.4 政治类理念补充

#### 君权神授 (divine_right)
- 2级新增：合法性 → 稳定度 converter（ratio 0.06，cap 8）
- 3级新增：合法性 → 稳定度+税收 converter（ratio 0.10/0.004，cap 14/35%）

#### 共和主义 (republicanism)
- 2级新增：满意度 → 稳定度 converter（ratio 0.08，cap 8）
- 3级新增：满意度 → 稳定度+文化 converter（ratio 0.12/0.003，cap 12/30%）；inverse_scaling（军事越强稳定惩罚越大）

### 8.5 经济类理念补充

#### 重商主义 (mercantilism)
- 1级新增：港口数量 → 税收（每2座+1.8%，cap 30%）
- 2级新增：港口数量 → 税收+工业（每2座+2.2%+0.8%，cap 40%）；满意度 → 税收 converter
- 3级新增：港口数量 → 税收+产出+稳定度（每2座+2.5%+1%+0.5，cap 55%）；满意度 → 税收 converter

#### 重农主义 (physiocracy)
- 1级新增：农场数量 → 采集加成（每4座+2.5%，cap 35%）
- 2级新增：农场数量 → 采集+税收（每3座+3%+0.8%，cap 45%）
- 3级新增：农场数量 → 采集+税收+人口（每3座+3.5%+1%+0.5%，cap 60%）

### 8.6 科学类理念补充

#### 实证主义 (positivism)
- 1级新增：实验室数量 → 科研（每2座+2.5%，cap 35%）
- 2级新增：实验室数量 → 科研+产出（每2座+3%+1%，cap 45%）
- 3级新增：实验室数量 → 科研+产出+工业（每2座+3.5%+1.2%+0.8%，cap 60%）

#### 机械化思维 (mechanization)
- 2级新增：工厂数量 → 科研+产出（每3座+3%+1.5%，cap 45%）
- 3级新增：工厂数量 → 科研+产出+工业（每3座+3.5%+1.8%+1%，cap 60%）；inverse_scaling（工业化越高文化惩罚越大）

### 8.7 补充后触发器使用状态

| 类型 | 补充前 | 补充后 |
|------|--------|--------|
| `unit_count_bonus` | ❌ 0次 | ✅ 8次 |
| `building_specific_bonus` | ❌ 0次 | ✅ 21次 |
| `militarySize` converter | ❌ 0次 | ✅ 4次 |
| `avgApproval` converter | ❌ 0次 | ✅ 6次 |
| `legitimacy` converter | ❌ 0次 | ✅ 4次 |
| `unitCategory` converter | ❌ 0次 | ✅ 2次 |
| `inverse_scaling` | ⚠️ 1次 | ✅ 3次 |
