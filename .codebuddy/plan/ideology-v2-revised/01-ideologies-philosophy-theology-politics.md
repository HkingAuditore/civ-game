## 第二部分：新增理念设计 — 哲学/神学/政治（17个）

> 设计原则（修订版）：
> - 每个理念有明确的「build方向」，让玩家看到就知道它适合什么路线
> - 三级递进：L1温和→L2显著→L3改变游戏规则
> - **所有 stratum key 必须存在于 STRATA 中**（peasant/worker/merchant/scholar/scientist/engineer/cleric/official 等）
> - **所有兵种 scope 使用 category**（infantry/cavalry/gunpowder/siege/archer）
> - **converter 优先于新 trigger type**（能用converter的不用新trigger type）
> - **buff 持续时间 ≤ 180天(L1-L2)，≤ 360天(L3)**

---

### 2.1 哲学理念 (philosophy) — 6个

#### 2.1.1 辩证法 (dialectics)
- **灵感**：黑格尔→马克思，正反合
- **稀有度**：rare | **解锁**：epoch 3
- **核心机制**：矛盾越大，力量越大
- **L1**：stability -3, scienceBonus +0.05, cultureBonus +0.05
- **L2**：triggerEffect `inverse_scaling` { source: 'stability', threshold: 55, aboveBonus: { scienceBonus: -0.003 }, belowBonus: { scienceBonus: 0.005 }, cap: 0.15 }
- **L3**：onEvent `on_rebellion_start` → addBuff "扬弃" { scienceBonus: 0.15, cultureBonus: 0.10, duration: 180 }, cooldownDays: 360
- **Build方向**：「低稳定度科研流」的核心卡，和存在主义、无政府主义协同

#### 2.1.2 功利主义 (utilitarianism)
- **灵感**：边沁→密尔，最大多数人的最大幸福
- **稀有度**：uncommon | **解锁**：epoch 4
- **核心机制**：以生活水平衡量一切
- **L1**：taxIncome +0.04, needsReduction +0.03
- **L2**：converter { sourceType: 'population', ratio: 0.00005, target: 'taxBonus', cap: 0.15 }
- **L3**：converter { sourceType: 'wealthyPop', ratio: 0.001, target: 'stabilityBonus', cap: 0.15 }
- **Build方向**：「民生内政流」核心，与福利国家、公民社会协同

#### 2.1.3 虚无主义 (nihilism)
- **灵感**：尼采"上帝已死"、陀思妥耶夫斯基
- **稀有度**：rare | **解锁**：epoch 5
- **核心机制**：解构一切，在废墟上重建
- **L1**：stability -5, cultureBonus +0.08
- **L2**：ruleMod `corruption_mod` { value: -0.15 }；triggerEffect `diminishing_returns` { category: 'theology' }
- **L3**：onEvent `on_stability_crisis` → addBuff "永恒轮回" { scienceBonus: 0.10, cultureBonus: 0.10, militaryBonus: 0.10, industryBonus: 0.10, duration: 180 }；resource_drain silver 5/tick
- **⚠️ 修正**：原方案buff 360天 → 改为180天（符合EFFECT_CAPS安全上限）
- **Build方向**：反神学build，与理性主义、科学方法形成「启蒙三角」

#### 2.1.4 社会达尔文主义 (social_darwinism)
- **灵感**：赫伯特·斯宾塞，适者生存
- **稀有度**：uncommon | **解锁**：epoch 5
- **核心机制**：不平等催生效率
- **L1**：industryBonus +0.05, stability -2
- **L2**：converter { sourceType: 'poorPop', ratio: 0.0005, target: 'industryBonus', cap: 0.12 }
- **⚠️ 修正**：原`poor_stratum_count_bonus`改用converter + sourceType `poorPop`
- **L3**：ruleMod `wages_mod` { scope: 'worker', value: -0.15 }; militaryBonus +0.08
- **Build方向**：「剥削工业流」，与国家资本主义、精英主义协同

#### 2.1.5 解构主义 (deconstructionism)
- **灵感**：德里达，去中心化
- **稀有度**：rare | **解锁**：epoch 7
- **核心机制**：消解等级，释放创造力
- **L1**：cultureBonus +0.06, taxIncome -0.03
- **L2**：triggerEffect `coalition_diversity_bonus` { perStratum: { cultureBonus: 0.03 }, cap: 0.18 }
- **L3**：ruleMod `official_bonus` { scope: 'all', value: -0.1 }; converter { sourceType: 'officialCount', ratio: -0.02, target: 'cultureBonus', cap: 0.15 }（官员越少文化越高）
- **Build方向**：「去官僚化文化流」，与无政府主义、先锋派协同

#### 2.1.6 超人哲学 (ubermensch)
- **灵感**：尼采的超人概念
- **稀有度**：legendary | **解锁**：epoch 6
- **核心机制**：英雄驱动历史
- **L1**：militaryBonus +0.05, stability -3
- **L2**：triggerEffect `official_faction_bonus` { faction: 'military', per: 1, bonus: { militaryBonus: 0.03 }, cap: 0.15 }
- **L3**：onEvent `on_battle_victory` → addBuff "意志的胜利" { militaryBonus: 0.15, scienceBonus: 0.10, duration: 120 }, cooldownDays: 360
- **triggerEffect** `mutual_exclusion` 与集体主义、平等主义

---

### 2.2 神学理念 (theology) — 5个

#### 2.2.1 佛法 (buddhism)
- **灵感**：四圣谛、中道、缘起性空
- **稀有度**：uncommon | **解锁**：epoch 2
- **核心机制**：减少欲望，化苦为乐
- **L1**：needsReduction +0.05, stability +3
- **L2**：ruleMod `resource_price_mod` { scope: '_all', value: -0.08 }
- **L3**：converter { sourceType: 'unemployment', ratio: 0.003, target: 'stabilityBonus', cap: 0.08 }; converter { sourceType: 'stability', ratio: 0.003, target: 'cultureBonus', cap: 0.2 }
- **Build方向**：「低欲望稳定流」，与和平主义、斯多葛主义协同

#### 2.2.2 末世论 (eschatology)
- **灵感**：天启四骑士、千禧年主义
- **稀有度**：rare | **解锁**：epoch 3
- **核心机制**：危机中的狂热
- **L1**：militaryBonus +0.06, stability -2
- **L2**：triggerEffect `conditional_flip` { condition: 'isAtWar', trueBonus: { militaryBonus: 0.12 }, falseBonus: { militaryBonus: -0.05 } }
- **L3**：onEvent `on_war_start` → addResource silver 500; onEvent `on_rebellion_start` → addBuff "天启" { militaryBonus: 0.20, duration: 180 }
- **⚠️ 修正**：原方案buff 240天 → 改为180天
- **Build方向**：「战争狂热流」，与军国主义、弥赛亚信仰协同

#### 2.2.3 道法自然 (taoism)
- **灵感**：老子《道德经》，无为而治
- **稀有度**：uncommon | **解锁**：epoch 2
- **核心机制**：少做多得，自然运转
- **L1**：production +0.04, stability +2
- **L2**：ruleMod `building_cost_mod` { scope: 'gather', value: -0.12 }; triggerEffect `building_specific_bonus` { buildingId: 'farm', per: 1, bonus: { production: 0.01 }, cap: 0.15 }
- **L3**：converter { sourceType: 'stability', ratio: 0.004, target: 'production', cap: 0.25 }; needsReduction +0.08
- **Build方向**：「农业+高稳定流」，与重农主义、祖先崇拜协同

#### 2.2.4 圣战思想 (jihad_doctrine)
- **灵感**：历史上的圣战概念（十字军/吉哈德）
- **稀有度**：rare | **解锁**：epoch 3
- **核心机制**：信仰转化为军事力量
- **L1**：militaryBonus +0.05, cultureBonus +0.03
- **L2**：converter { sourceType: 'warCount', ratio: 0.04, target: 'militaryBonus', cap: 0.16 }
- **L3**：ruleMod `recruit_cost_mod` { scope: 'infantry', value: -0.2 }; onEvent `on_war_victory` → addResource silver 300, addStability 5
- **Build方向**：「宗教军事流」，与一神教形成强联动

#### 2.2.5 自然神论 (deism)
- **灵感**：伏尔泰、富兰克林，上帝创世后不干预
- **稀有度**：uncommon | **解锁**：epoch 4
- **核心机制**：信仰与理性的桥梁
- **L1**：scienceBonus +0.04, stability +2
- **L2**：triggerEffect `tech_count_bonus` { per: 10, bonus: { cultureBonus: 0.01 } }; 与理性主义形成正向联动而非anti-synergy
- **L3**：converter { sourceType: 'population', ratio: 0.00005, target: 'scienceBonus', cap: 0.15 }
- **Build方向**：「科学神学混搭」，打破神学/科学对立

---

### 2.3 政治理念 (politics) — 6个

#### 2.3.1 联邦主义 (federalism)
- **灵感**：美国联邦制、瑞士
- **稀有度**：uncommon | **解锁**：epoch 4
- **核心机制**：多元自治带来稳定
- **L1**：stability +4, taxIncome -0.03
- **L2**：triggerEffect `coalition_diversity_bonus` { perStratum: { stabilityBonus: 0.02, taxIncome: 0.01 }, cap: { stabilityBonus: 0.12, taxIncome: 0.06 } }
- **L3**：converter { sourceType: 'friendlyCount', ratio: 0.01, target: 'taxIncome', cap: 0.08 }
- **Build方向**：「多元联盟外交流」

#### 2.3.2 极权主义 (totalitarianism)
- **灵感**：汉娜·阿伦特《极权主义的起源》
- **稀有度**：rare | **解锁**：epoch 6
- **核心机制**：绝对控制，高效但脆弱
- **L1**：taxIncome +0.08, stability -3, cultureBonus -0.05
- **L2**：ruleMod `corruption_mod` { value: -0.2 }; ruleMod `wages_mod` { scope: 'official', value: +0.2 }
- **L3**：converter { sourceType: 'officialCount', ratio: 0.03, target: 'militaryBonus', cap: 0.2 }; triggerEffect `conditional_flip` { condition: 'legitimacy<30', trueBonus: { stability: -15 } }
- **Build方向**：「高税高控制流」，与国家资本主义、精英主义协同

#### 2.3.3 外交均势 (balance_of_power)
- **灵感**：梅特涅、俾斯麦的欧洲均势
- **稀有度**：uncommon | **解锁**：epoch 4
- **核心机制**：外交关系带来红利
- **L1**：stability +3, ruleMod `diplomatic_influence` { value: +0.1 }
- **L2**：converter { sourceType: 'friendlyCount', ratio: 0.015, target: 'taxIncome', cap: 0.10 }; converter { sourceType: 'friendlyCount', ratio: 0.01, target: 'cultureBonus', cap: 0.10 }
- **L3**：converter { sourceType: 'vassalCount', ratio: 0.04, target: 'taxIncome', cap: 0.12 }; converter { sourceType: 'vassalCount', ratio: 0.02, target: 'militaryBonus', cap: 0.12 }; onEvent `on_treaty_sign` → addStability 3
- **Build方向**：「外交大师流」

#### 2.3.4 革命先锋 (vanguardism)
- **灵感**：列宁先锋队理论
- **稀有度**：rare | **解锁**：epoch 6
- **核心机制**：少数精英推动变革
- **L1**：scienceBonus +0.05, stability -3
- **L2**：triggerEffect `official_faction_bonus` { faction: 'academic', per: 1, bonus: { scienceBonus: 0.03 }, cap: 0.15 }
- **L3**：ruleMod `tech_cost_mod` { value: -0.15 }; onEvent `on_epoch_advance` → addBuff "革命浪潮" { scienceBonus: 0.08, cultureBonus: 0.08, militaryBonus: 0.08, industryBonus: 0.08, duration: 360 }
- **Build方向**：「科技跃进流」，与共产主义、科学方法协同

#### 2.3.5 朝贡体系 (tributary_system)
- **灵感**：中华朝贡体系、奥斯曼附庸体系
- **稀有度**：uncommon | **解锁**：epoch 2
- **核心机制**：附庸即力量
- **L1**：taxIncome +0.03, ruleMod `diplomatic_influence` { value: +0.05 }
- **L2**：converter { sourceType: 'vassalCount', ratio: 0.03, target: 'taxIncome', cap: 0.15 }
- **L3**：ruleMod `maintenance_cost_mod` { scope: 'infantry', value: -0.1 }; converter { sourceType: 'vassalCount', ratio: 0.04, target: 'cultureBonus', cap: 0.2 }
- **Build方向**：「附庸帝国流」，与帝国主义、天命协同

#### 2.3.6 民粹主义 (populism)
- **灵感**：从格拉古兄弟到现代民粹
- **稀有度**：uncommon | **解锁**：epoch 5
- **核心机制**：迎合底层，获取合法性
- **L1**：stability +3, taxIncome -0.03
- **L2**：converter { sourceType: 'poorPop', ratio: 0.0005, target: 'stabilityBonus', cap: 0.10 }
- **L3**：ruleMod `wages_mod` { scope: 'peasant', value: +0.1 }; triggerEffect `approval_threshold_bonus` { stratum: 'peasant', threshold: 75, bonus: { production: 0.05 } }
- **Build方向**：「底层民意流」，与平等主义、工人运动协同
