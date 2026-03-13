## 第二部分（续）：新增理念设计 — 美学/科学/社会（16个）

### 2.6 美学理念 (aesthetics) — 5个

#### 2.6.1 文艺复兴 (renaissance)
- **灵感**：达芬奇、米开朗基罗
- **稀有度**：rare | **解锁**：epoch 4
- **核心机制**：文化爆发带动科技
- **L1**：cultureBonus +0.06, scienceBonus +0.04
- **L2**：converter { sourceType: 'buildingCount', sourceId: 'civic', ratio: 0.015, target: 'scienceBonus', cap: 0.12 }
- **L3**：onEvent `on_tech_unlock` → addResource culture 30; triggerEffect `building_specific_bonus` { buildingId: 'university', per: 1, bonus: { cultureBonus: 0.02 }, cap: 0.10 }
- **Build方向**：「文化→科技转化流」

#### 2.6.2 包豪斯 (bauhaus)
- **灵感**：包豪斯设计学院，形式追随功能
- **稀有度**：uncommon | **解锁**：epoch 7
- **核心机制**：设计=效率
- **L1**：industryBonus +0.04, cultureBonus +0.03
- **L2**：ruleMod `building_cost_mod` { scope: 'civic', value: -0.12 }; ruleMod `building_cost_mod` { scope: 'industry', value: -0.08 }
- **L3**：triggerEffect `building_count_bonus` { category: 'industry', per: 5, bonus: 0.01, target: 'cultureBonus', cap: 0.1 }
- **Build方向**：「工业美学流」

#### 2.6.3 书法传统 (calligraphy)
- **灵感**：中国书法、阿拉伯书法、日本书道
- **稀有度**：common | **解锁**：epoch 1
- **核心机制**：文字即文明的根基
- **L1**：cultureBonus +0.04, scienceBonus +0.02
- **L2**：triggerEffect `building_specific_bonus` { buildingId: 'library', per: 1, bonus: { cultureBonus: 0.02, scienceBonus: 0.01 }, cap: { cultureBonus: 0.08, scienceBonus: 0.08 } }
- **L3**：ruleMod `stratum_output_mod` { scope: 'scholar', value: +0.15 }; onEvent `on_tech_unlock` → addResource culture 15
- **⚠️ 修正**：原scope 'scribe' → 改为 'scholar'（STRATA中无scribe key）
- **Build方向**：「学者文化流」

#### 2.6.4 口头传统 (oral_tradition)
- **灵感**：荷马史诗、格里奥、吟游诗人
- **稀有度**：common | **解锁**：epoch 0
- **核心机制**：人口即文化载体
- **L1**：cultureBonus +0.03, stability +2
- **L2**：converter { sourceType: 'population', ratio: 0.00004, target: 'cultureBonus', cap: 0.12 }
- **L3**：triggerEffect `stratum_bonus` { stratum: 'cleric', bonus: { cultureBonus: 0.005 }, per: 5 }; needsReduction +0.03
- **Build方向**：「人口→文化流」，早期可用

#### 2.6.5 建筑美学 (architectural_aesthetics)
- **灵感**：从帕特农到悉尼歌剧院
- **稀有度**：uncommon | **解锁**：epoch 2
- **核心机制**：宏伟建筑=文明丰碑
- **L1**：cultureBonus +0.03, stability +2
- **L2**：triggerEffect `building_count_bonus` { category: 'civic', per: 3, bonus: 0.015, target: 'cultureBonus', cap: 0.12 }
- **L3**：onEvent `on_build` { condition: { category: 'civic' } } → addResource culture 15, addStability 1; ruleMod `building_cost_mod` { scope: 'civic', value: +0.1 }（市政建筑更贵但更有文化价值）
- **Build方向**：「市政建筑流」

---

### 2.7 科学理念 (science) — 5个

#### 2.7.1 炼金术 (alchemy)
- **灵感**：从赫尔墨斯到牛顿的炼金实验
- **稀有度**：common | **解锁**：epoch 2
- **核心机制**：资源转化
- **L1**：scienceBonus +0.03
- **L2**：converter { sourceType: 'resource', sourceId: 'copper', ratio: 0.005, target: 'scienceBonus', cap: 0.1 }
- **L3**：ruleMod `resource_price_mod` { scope: 'iron', value: -0.1 }; onEvent `on_tech_unlock` → addResource silver 50
- **Build方向**：「资源→科技流」

#### 2.7.2 博物学 (natural_history)
- **灵感**：林奈分类法、达尔文、洪堡
- **稀有度**：uncommon | **解锁**：epoch 4
- **核心机制**：观察自然=知识宝库
- **L1**：scienceBonus +0.04, cultureBonus +0.02
- **L2**：triggerEffect `building_count_bonus` { category: 'gather', per: 5, bonus: 0.015, target: 'scienceBonus', cap: 0.12 }
- **L3**：converter { sourceType: 'buildingCount', sourceId: 'gather', ratio: 0.01, target: 'scienceBonus', cap: 0.15 }; triggerEffect `epoch_scaling` { perEpoch: { scienceBonus: 0.01 } }
- **Build方向**：「采集→科研流」，与经验主义协同

#### 2.7.3 系统论 (systems_theory)
- **灵感**：贝塔朗菲、维纳控制论、复杂系统
- **稀有度**：rare | **解锁**：epoch 8
- **核心机制**：系统越复杂越强
- **L1**：scienceBonus +0.05, industryBonus +0.03
- **L2**：triggerEffect `chain_count_bonus` { per: 1, bonus: { scienceBonus: 0.03, industryBonus: 0.02 }, cap: { scienceBonus: 0.15, industryBonus: 0.15 } }
- **L3**：converter { sourceType: 'buildingCount', sourceId: 'industry', ratio: 0.01, target: 'scienceBonus', cap: 0.15 }; converter { sourceType: 'stability', ratio: 0.003, target: 'industryBonus', cap: 0.12 }
- **Build方向**：「产业链→科技流」

#### 2.7.4 材料科学 (materials_science)
- **灵感**：从青铜到碳纤维
- **稀有度**：uncommon | **解锁**：epoch 5
- **核心机制**：材料定义时代
- **L1**：industryBonus +0.04, scienceBonus +0.03
- **L2**：ruleMod `building_cost_mod` { scope: 'industry', value: -0.1 }; triggerEffect `building_specific_bonus` { buildingId: 'smelter', per: 1, bonus: { industryBonus: 0.02 }, cap: 0.10 }
- **L3**：ruleMod `stratum_output_mod` { scope: 'engineer', value: +0.15 }; ruleMod `resource_price_mod` { scope: 'iron', value: -0.12 }; ruleMod `resource_price_mod` { scope: 'steel', value: -0.1 }
- **Build方向**：「重工业材料流」

#### 2.7.5 信息论 (information_theory)
- **灵感**：香农、图灵
- **稀有度**：legendary | **解锁**：epoch 9
- **核心机制**：信息是终极资源
- **L1**：scienceBonus +0.08, cultureBonus +0.05
- **L2**：converter { sourceType: 'population', ratio: 0.00005, target: 'scienceBonus', cap: 0.2 }; triggerEffect `tech_count_bonus` { per: 5, bonus: { scienceBonus: 0.01, cultureBonus: 0.01, industryBonus: 0.01 } }
- **L3**：ruleMod `tech_cost_mod` { value: -0.2 }; triggerEffect `building_specific_bonus` { buildingId: 'university', per: 1, bonus: { scienceBonus: 0.03 }, cap: 0.15 }; onEvent `on_tech_unlock` → addBuff "突破" { scienceBonus: 0.15, duration: 120 }, cooldownDays: 180
- **Build方向**：「信息时代终极科研流」

---

### 2.8 社会理念 (social) — 6个

#### 2.8.1 种族隔离 (apartheid)
- **灵感**：历史上的种族隔离制度（南非等）
- **稀有度**：rare | **解锁**：epoch 6
- **核心机制**：阶层分离带来效率但摧毁凝聚力
- **L1**：industryBonus +0.05, stability -4
- **L2**：ruleMod `stratum_output_mod` { scope: 'worker', value: +0.12 }; ruleMod `wages_mod` { scope: 'worker', value: -0.15 }
- **L3**：converter { sourceType: 'poorPop', ratio: 0.0005, target: 'industryBonus', cap: 0.12 }; triggerEffect `conditional_flip` { condition: 'legitimacy<40', trueBonus: { stability: -10 } }
- **Build方向**：「高压工业流」，极端高风险高回报

#### 2.8.2 全民教育 (universal_education)
- **灵感**：普鲁士义务教育、北欧教育体系
- **稀有度**：uncommon | **解锁**：epoch 5
- **核心机制**：教育提升所有人口质量
- **L1**：scienceBonus +0.04, cultureBonus +0.03
- **L2**：triggerEffect `building_specific_bonus` { buildingId: ['library', 'university'], per: 1, bonus: { scienceBonus: 0.015 }, cap: 0.12 }; converter { sourceType: 'population', ratio: 0.00003, target: 'scienceBonus', cap: 0.12 }
- **L3**：ruleMod `stratum_output_mod` { scope: 'scholar', value: +0.15 }; ruleMod `stratum_output_mod` { scope: 'scientist', value: +0.12 }; stability +3
- **⚠️ 修正**：原scope 'scribe' → 改为 'scholar'
- **Build方向**：「教育→科研流」

#### 2.8.3 游牧精神 (nomadic_spirit)
- **灵感**：蒙古帝国、贝都因人、斯基泰人
- **稀有度**：common | **解锁**：epoch 0
- **核心机制**：流动性=生存力
- **L1**：production +0.03, militaryBonus +0.03
- **L2**：ruleMod `unit_attack_mod` { scope: 'cavalry', value: +0.1 }; ruleMod `recruit_cost_mod` { scope: 'cavalry', value: -0.12 }
- **L3**：triggerEffect `inverse_scaling` { source: 'totalBuildings', threshold: 100, belowBonus: { militaryBonus: 0.10 }, aboveBonus: { militaryBonus: -0.05 } }
- **Build方向**：「早期骑兵rush流」

#### 2.8.4 公共卫生 (public_health)
- **灵感**：约翰·斯诺（霍乱地图）、巴斯德
- **稀有度**：uncommon | **解锁**：epoch 5
- **核心机制**：健康人口=更多劳动力
- **L1**：maxPop +0.05, stability +2
- **L2**：needsReduction +0.05; converter { sourceType: 'wealthyPop', ratio: 0.0005, target: 'production', cap: 0.08 }
- **L3**：converter { sourceType: 'population', ratio: 0.00004, target: 'maxPop', cap: 0.15 }; ruleMod `stratum_output_mod` { scope: 'peasant', value: +0.08 }
- **Build方向**：「人口→生产力流」

#### 2.8.5 密码朋克 (cypherpunk)
- **灵感**：密码学自由主义、比特币
- **稀有度**：legendary | **解锁**：epoch 9
- **核心机制**：去中心化+加密=自由
- **L1**：scienceBonus +0.06, taxIncome -0.05, stability -2
- **L2**：ruleMod `corruption_mod` { value: -0.25 }; triggerEffect `tech_count_bonus` { per: 10, bonus: { taxIncome: 0.02 }, cap: 0.12 }
- **L3**：converter { sourceType: 'stability', ratio: -0.005, target: 'scienceBonus', cap: 0.2 }（稳定度越低科研越高！）; onEvent `on_rebellion_start` → addBuff "匿名抵抗" { scienceBonus: 0.20, cultureBonus: 0.15, duration: 180 }
- **⚠️ 修正**：原方案buff 240天 → 改为180天
- **triggerEffect** `mutual_exclusion` 与极权主义、君权神授
- **Build方向**：「极端科技自由流」，终极反建制build

#### 2.8.6 环境保护主义 (environmentalism)
- **灵感**：蕾切尔·卡森《寂静的春天》
- **稀有度**：uncommon | **解锁**：epoch 8
- **核心机制**：可持续发展
- **L1**：stability +3, production +0.03
- **L2**：triggerEffect `building_count_bonus` { category: 'gather', per: 5, bonus: 0.02, target: 'stability', cap: 10 }; ruleMod `building_input_mod` { scope: 'gather', value: -0.1 }
- **L3**：triggerEffect `inverse_scaling` { source: 'buildingCategoryCounts.industry', threshold: 35, belowBonus: { stability: 8 }, aboveBonus: { stability: -5 } }; converter { sourceType: 'buildingCount', sourceId: 'gather', ratio: 0.02, target: 'production', cap: 0.15 }
- **Build方向**：「绿色可持续流」，与道法自然、和平主义协同
