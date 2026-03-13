## 第二部分（续）：新增补充理念（5个全新理念）

> 这5个理念是在原方案45个基础上新增的，填补了原方案缺少的有趣维度。

---

### 2.9 补充理念 — 5个

#### 2.9.1 契约农奴制 (serfdom) — 经济理念
- **灵感**：俄国农奴制、欧洲庄园制度
- **稀有度**：uncommon | **解锁**：epoch 2
- **核心机制**：锁定底层劳动力，产出高但极不稳定
- **L1**：production +0.05, stability -2
- **L2**：ruleMod `stratum_output_mod` { scope: 'peasant', value: +0.12 }; ruleMod `wages_mod` { scope: 'peasant', value: -0.15 }
- **L3**：triggerEffect `approval_threshold_bonus` { stratum: 'peasant', threshold: 40, invert: true, bonus: { production: 0.05 } }（农民满意度<40时+5%产出）; onEvent `on_rebellion_start` → addBuff "农奴起义" { stability: -15, duration: 120 }
- **Build方向**：「高压农业流」，高产出但叛乱风险
- **联动**：与庄园经济正向联动，与平等主义反向联动

#### 2.9.2 海洋霸权 (thalassocracy) — 军事理念
- **灵感**：雅典、迦太基、大英帝国海军
- **稀有度**：rare | **解锁**：epoch 4
- **核心机制**：贸易+海军双轮驱动
- **L1**：militaryBonus +0.03, taxIncome +0.03
- **L2**：converter { sourceType: 'tradeVolume', ratio: 0.0001, target: 'militaryBonus', cap: 0.12 }
- **L3**：converter { sourceType: 'friendlyCount', ratio: 0.02, target: 'taxIncome', cap: 0.10 }; onEvent `on_war_victory` → addResource silver 500
- **Build方向**：「海上帝国流」，与海权论、海上贸易强联动

#### 2.9.3 哲人王 (philosopher_king) — 哲学理念
- **灵感**：柏拉图《理想国》
- **稀有度**：rare | **解锁**：epoch 3
- **核心机制**：学者统治，知识即权力
- **L1**：scienceBonus +0.04, stability +3
- **L2**：triggerEffect `official_faction_bonus` { faction: 'academic', per: 1, bonus: { scienceBonus: 0.02, stabilityBonus: 0.01 }, cap: { scienceBonus: 0.10, stabilityBonus: 0.10 } }
- **L3**：converter { sourceType: 'officialCount', ratio: 0.04, target: 'scienceBonus', cap: 0.15 }; ruleMod `corruption_mod` { value: -0.1 }
- **Build方向**：「学者治国流」，与贤能主义联动

#### 2.9.4 黄金规则 (golden_rule) — 神学理念
- **灵感**：几乎所有文明的道德金律「己所不欲勿施于人」
- **稀有度**：uncommon | **解锁**：epoch 1
- **核心机制**：道德外交，关系驱动稳定
- **L1**：stability +4, cultureBonus +0.03
- **L2**：converter { sourceType: 'friendlyCount', ratio: 0.02, target: 'stabilityBonus', cap: 0.12 }
- **L3**：onEvent `on_treaty_sign` → addStability 5, addResource culture 30; converter { sourceType: 'vassalCount', ratio: 0.03, target: 'cultureBonus', cap: 0.15 }
- **Build方向**：「和平外交流」

#### 2.9.5 制图学 (cartography) — 科学理念
- **灵感**：大航海时代的地图学革命
- **稀有度**：uncommon | **解锁**：epoch 3
- **核心机制**：探索和贸易的知识基础
- **L1**：scienceBonus +0.03, cultureBonus +0.02
- **L2**：converter { sourceType: 'friendlyCount', ratio: 0.015, target: 'scienceBonus', cap: 0.10 }; converter { sourceType: 'tradeVolume', ratio: 0.0001, target: 'cultureBonus', cap: 0.08 }
- **L3**：onEvent `on_tech_unlock` → addResource silver 80; triggerEffect `epoch_scaling` { perEpoch: { scienceBonus: 0.01 } }
- **Build方向**：「航海探索流」

---

## 第三部分：新增协同组合（18组正向 + 10组反向）

### 3.1 正向联动（原15组 + 新增3组 = 18组）

| # | 联动名 | 所需理念 | 核心效果 | 机制效果 |
|---|--------|----------|----------|----------|
| 1 | 十字军东征 | jihad_doctrine + chivalry | militaryBonus +0.15, cultureBonus +0.08 | unit_attack_mod cavalry +0.10 |
| 2 | 工业革命 | mechanization + materials_science | industryBonus +0.15, scienceBonus +0.10 | stratum_output_mod worker +0.12 |
| 3 | 大宪章 | federalism + social_contract | stability: 12 | crisis_immunity: legitimacy_crisis |
| 4 | 丝绸之路 | maritime_trade + balance_of_power | taxIncome +0.12, cultureBonus +0.08 | resource_echo: cloth→culture |
| 5 | 黄金时代 | renaissance + humanism | cultureBonus +0.15, scienceBonus +0.10, stability: 5 | epoch_rush: 0.10 |
| 6 | 铁幕 | planned_economy + totalitarianism | industryBonus +0.18, militaryBonus +0.10 | auto_build: factory, 120天 |
| 7 | 福利资本主义 | finance_capitalism + welfare_state | taxIncome +0.10, stability: 8 | — |
| 8 | 知行合一 | confucianism + calligraphy | cultureBonus +0.12, stability: 8, scienceBonus +0.05 | stratum_output_mod scholar +0.15 |
| 9 | 永续和平 | pacifism + buddhism | stability: 15, cultureBonus +0.10, militaryBonus -0.10 | crisis_immunity: class_rebellion |
| 10 | 闪击风暴 | blitzkrieg + military_industrial_complex | militaryBonus +0.12, industryBonus +0.08 | recruit_cost_mod cavalry -0.25 |
| 11 | 全民动员 | peoples_war + cooperative_movement | militaryBonus +0.10, production +0.08, stability: 5 | recruit_cost_mod infantry -0.20 |
| 12 | 启蒙双星 | deism + natural_history | scienceBonus +0.12, cultureBonus +0.08 | — |
| 13 | 虚无之花 | nihilism + deconstructionism | cultureBonus +0.15, stability: -8 | corruption_mod -0.20 |
| 14 | 进化论 | social_darwinism + natural_history | scienceBonus +0.08, industryBonus +0.08 | wages_mod worker -0.10 |
| 15 | 数字乌托邦 | information_theory + cypherpunk | scienceBonus +0.20, cultureBonus +0.10, stability: -10 | tech_cost_mod -0.15 |
| **16** | **理想国** | philosopher_king + rationalism | scienceBonus +0.15, stability: 8 | — |
| **17** | **海上丝路** | thalassocracy + maritime_trade | taxIncome +0.15, militaryBonus +0.08 | resource_echo: silver→culture |
| **18** | **地图大发现** | cartography + thalassocracy | scienceBonus +0.10, cultureBonus +0.10 | epoch_rush: 0.08 |

### 3.2 反向联动（原8组 + 新增2组 = 10组）

| # | 联动名 | 冲突理念 | 惩罚 |
|---|--------|----------|------|
| 1 | 自由与计划之争 | laissez_faire + planned_economy | industryBonus -0.08, stability -5 |
| 2 | 战争与和平之争 | blitzkrieg + pacifism | militaryBonus -0.08, stability -5 |
| 3 | 进步与传统之争 | cypherpunk + oral_tradition | cultureBonus -0.08, scienceBonus -0.05 |
| 4 | 集权与联邦之争 | totalitarianism + federalism | stability -8, taxIncome -0.05 |
| 5 | 物质与精神之争 | finance_capitalism + buddhism | stability -5, cultureBonus -0.05 |
| 6 | 隔离与平等之争 | apartheid + egalitarianism | stability -10, cultureBonus -0.08 |
| 7 | 环保与工业之争 | environmentalism + military_industrial_complex | industryBonus -0.05, stability -5 |
| 8 | 教条与实用之争 | eschatology + pragmatism | scienceBonus -0.05, stability -5 |
| **9** | **哲人与暴君之争** | philosopher_king + totalitarianism | scienceBonus -0.08, stability -5 |
| **10** | **探索与孤立之争** | cartography + planned_economy | scienceBonus -0.05, taxIncome -0.05 |

---

## 第四部分：UI层扩展

### 4.1 IdeologyCard.jsx 需扩展的 label 映射

```js
// RULE_MOD_LABELS 新增
stratum_output_mod: '阶层产出',
building_input_mod: '建筑消耗',
unit_attack_mod: '兵种攻击',
unit_defense_mod: '兵种防御',
recruit_cost_mod: '招募费用',
maintenance_cost_mod: '维护费用',
corruption_mod: '腐败',
trade_route_mod: '贸易收益',
resource_price_mod: '资源价格',
wages_mod: '阶层工资',
diplomatic_influence: '外交影响',

// CONVERTER_SOURCE_LABELS 新增
warCount: '战争数',
friendlyCount: '友好国家',
vassalCount: '附庸国',
tradeVolume: '贸易额',
unemployment: '失业人口',
legitimacy: '合法性',
avgApproval: '平均满意度',
militarySize: '军队规模',
wealthyPop: '富裕人口',
poorPop: '贫困人口',
specificBuilding: '建筑数量',
unitCategory: '兵种数量',
```

### 4.2 describeTriggerEffect() 新增5种触发效果的中文描述

```js
case 'approval_threshold_bonus':
  return `${STRATA_LABELS[e.stratum]}满意度>${e.threshold}时${formatBonus(e.bonus)}`;
case 'building_specific_bonus':
  return `每${e.per}座${BUILDING_LABELS[e.buildingId]}${formatBonus(e.bonus)}(上限${formatCap(e.cap)})`;
case 'unit_count_bonus':
  return `每${e.per}个${UNIT_LABELS[e.category]}${formatBonus(e.bonus)}(上限${formatCap(e.cap)})`;
case 'coalition_diversity_bonus':
  return `联盟每增加1个阶层${formatBonus(e.perStratum)}(上限${formatCap(e.cap)})`;
case 'official_faction_bonus':
  return `每个${FACTION_LABELS[e.faction]}官员${formatBonus(e.bonus)}(上限${formatCap(e.cap)})`;
```

---

## 第五部分：实施步骤与优先级

### 实施顺序

```
Phase 0 (triggerState扩展)         ─┐
Phase 1A (converter sourceType ×12) ─┤── 引擎层（必须先做，约600-800行）
Phase 1B (trigger types ×5)         ─┤
Phase 1C (ruleMod消费逻辑 ×17)     ─┘
           ↓
Phase 2 (50个新理念数据)           ─── 数据层（约3000-4000行配置）
Phase 3 (18正向 + 10反向联动)      ─── 数据层
           ↓
Phase 4 (UI label扩展)             ─── 展示层（约100行）
Phase 5 (验证)                     ─── 质量保证
```

### Phase 1: 引擎层扩展（核心前置）

1. **`src/logic/simulation.js`** — 扩展 `ideologyTriggerState` 构造 + **实装所有ruleMod消费逻辑**
2. **`src/logic/ideology/ideologyEffects.js`** — 新增5种triggerEffect + 12种converter sourceType + 11种ruleMod type
3. **`src/logic/ideology/ideologyEventBus.js`** — 调整 EFFECT_CAPS.addBuff.maxDuration = 360

### Phase 2: 数据层

4. **`src/config/ideologies.js`** — 新增50个理念
5. **`src/config/ideologySynergies.js`** — 新增18组正向联动 + 10组反向联动

### Phase 3: UI层

6. **`src/components/tabs/IdeologyCard.jsx`** — RULE_MOD_LABELS / CONVERTER_SOURCE_LABELS / describeTriggerEffect()
7. **`src/utils/effectFormatter.js`** — 新增效果类型的格式化

### Phase 4: 验证

8. `npm run build` 通过
9. ESLint 无新增错误
10. 所有 stratum/building/unit 引用与配置文件对齐
11. ruleMod 消费逻辑在 simulation.js 中实装
12. 新理念卡片UI正确显示所有效果类型
13. 理念总数：约50(现有) + 50(新增) = 约100个

---

## 第六部分：设计哲学与build路线图

### 6.1 Build路线分类（修订版 12条路线）

| 路线 | 核心理念 | 关键协同 | 玩法风格 |
|------|----------|----------|----------|
| 🗡️ 骑兵精英流 | 骑士精神+闪电战 | +军事工业 | 速攻/精锐少量 |
| 🏰 龟壳防御流 | 要塞战术+和平主义 | +佛法 | 种田防守 |
| 🔫 人民战争流 | 人民战争+全民皆兵 | +合作社 | 人海战术 |
| 💰 金融帝国流 | 金融资本+重商主义 | +海上贸易 | 经济碾压 |
| 🏭 重工业流 | 计划经济+材料科学 | +军工复合体 | 工业产能 |
| 🌾 田园牧歌流 | 庄园经济+道法自然 | +佛法 | 高稳定低消耗 |
| 📚 文化科研流 | 文艺复兴+全民教育 | +信息论 | 科技碾压 |
| 🌐 外交大师流 | 外交均势+朝贡体系 | +联邦主义 | 外交红利 |
| 🔥 混沌之力流 | 虚无主义+密码朋克 | +辩证法 | 低稳定极限操作 |
| 👑 铁腕统治流 | 极权主义+种族隔离 | +超人哲学 | 高压高效但脆弱 |
| ⚓ 海上帝国流 | 海洋霸权+海上贸易 | +制图学 | 贸易+军事双驱动 |
| 🏛️ 学者治国流 | 哲人王+理性主义 | +全民教育 | 官员科研驱动 |

### 6.2 杀戮尖塔/小丑牌式心流

1. **发现**：理念涌现时看到新卡，评估它是否适合当前build
2. **选择**：在3张候选中选1张，形成取舍焦虑
3. **构建**：通过合理搭配，让卡之间产生1+1>2的协同
4. **转折**：反协同机制惩罚贪心（想要所有好东西），迫使玩家专精
5. **高潮**：L3效果 + 联动 = 终极build完成，产生碾压感
6. **风险**：resource_drain/conditional_flip/mutual_exclusion 制造持续紧张感

### 6.3 数值平衡守则

| 维度 | 上限 | 依据 |
|---|---|---|
| 单个理念最大加成 | ≤ 0.15 (L3) | 避免单卡过强 |
| 单个converter的cap | ≤ 0.20 (L3 × 2.0x) | CONVERTER_SINGLE_CAP = 0.50 安全 |
| 联动效果 | ≤ 0.20 最大单维度 | 与现有联动一致 |
| stability加成 | ≤ ±15 | 避免单卡决定稳定度 |
| buff持续时间 | ≤ 180天(L1-L2), ≤ 360天(L3) | 对应cooldown ≥ 180天 |
| resource_drain | ≤ 10/tick | 避免国库瞬间清空 |
| ruleMod 单项修正 | ≤ ±0.25 (L3) | 确保不破坏经济平衡 |
