## 第二部分（续）：新增理念设计 — 经济/军事（12个）

### 2.4 经济理念 (economy) — 6个

#### 2.4.1 金本位 (gold_standard)
- **灵感**：19世纪国际金融体系
- **稀有度**：uncommon | **解锁**：epoch 5
- **核心机制**：银币储备带来信用
- **L1**：taxIncome +0.03, stability +2
- **L2**：triggerEffect `resource_threshold` { resource: 'silver', above: { threshold: 5000, bonus: { taxIncome: 0.08 } }, below: { threshold: 1000, bonus: { stability: -5 } } }
- **L3**：ruleMod `price_volatility_mod` { value: -0.2 }; converter { sourceType: 'resource', sourceId: 'silver', ratio: 0.0001, target: 'stabilityBonus', cap: 0.1 }
- **Build方向**：「金融稳定流」

#### 2.4.2 计划经济 (planned_economy)
- **灵感**：苏联五年计划
- **稀有度**：rare | **解锁**：epoch 6
- **核心机制**：牺牲效率换取可控性
- **L1**：industryBonus +0.06, production +0.04, needsReduction +0.03
- **L2**：ruleMod `price_volatility_mod` { value: -0.25 }; ruleMod `building_cost_mod` { scope: 'industry', value: -0.12 }
- **L3**：triggerEffect `building_count_bonus` { category: 'industry', per: 5, bonus: 0.02, cap: 0.2, target: 'production' }; converter { sourceType: 'tradeVolume', ratio: -0.005, target: 'taxIncome', cap: -0.15 }（贸易越多反而减税收）
- **Build方向**：「重工业自给流」，与共产主义、集体主义协同，与自由放任anti-synergy

#### 2.4.3 庄园经济 (manorial_economy)
- **灵感**：中世纪庄园制
- **稀有度**：common | **解锁**：epoch 3
- **核心机制**：庄园=自给自足的微型世界
- **L1**：production +0.04, needsReduction +0.02
- **L2**：triggerEffect `building_specific_bonus` { buildingId: 'large_estate', per: 1, bonus: { production: 0.02, stabilityBonus: 0.01 }, cap: { production: 0.10, stabilityBonus: 0.10 } }
- **L3**：ruleMod `stratum_output_mod` { scope: 'peasant', value: +0.15 }; ruleMod `stratum_output_mod` { scope: 'worker', value: +0.08 }
- **⚠️ 修正**：原scope 'serf' → 改为 'peasant'（STRATA中无serf key）
- **Build方向**：「封建农业流」，与封建主义、祖先崇拜协同

#### 2.4.4 海上贸易 (maritime_trade)
- **灵感**：汉萨同盟、威尼斯/热那亚
- **稀有度**：uncommon | **解锁**：epoch 3
- **核心机制**：贸易路线=生命线
- **L1**：taxIncome +0.05, cultureBonus +0.02
- **L2**：converter { sourceType: 'tradeVolume', ratio: 0.001, target: 'taxIncome', cap: 0.10 }; triggerEffect `building_specific_bonus` { buildingId: 'trade_port', per: 1, bonus: { taxIncome: 0.02 }, cap: 0.10 }
- **L3**：ruleMod `trade_route_mod` { value: +0.15 }; converter { sourceType: 'friendlyCount', ratio: 0.02, target: 'taxIncome', cap: 0.12 }
- **Build方向**：「海洋贸易流」，与重商主义、海权论协同

#### 2.4.5 金融资本主义 (finance_capitalism)
- **灵感**：罗斯柴尔德、摩根、现代投行
- **稀有度**：rare | **解锁**：epoch 6
- **核心机制**：钱生钱，但风险高
- **L1**：taxIncome +0.05, stability -2
- **L2**：converter { sourceType: 'resource', sourceId: 'silver', ratio: 0.00015, target: 'taxIncome', cap: 0.15 }
- **L3**：converter { sourceType: 'stability', ratio: 0.002, target: 'taxIncome', cap: 0.10 }; onEvent `on_stability_crisis` → addBuff "金融恐慌" { taxIncome: -0.15, duration: 120 }
- **Build方向**：「高风险高收益金融流」

#### 2.4.6 合作社运动 (cooperative_movement)
- **灵感**：罗奇代尔先驱者、蒙德拉贡
- **稀有度**：uncommon | **解锁**：epoch 5
- **核心机制**：工人共享利润，效率+满意度
- **L1**：stability +3, industryBonus +0.03
- **L2**：triggerEffect `approval_threshold_bonus` { stratum: 'worker', threshold: 70, bonus: { industryBonus: 0.08 } }; ruleMod `wages_mod` { scope: 'worker', value: +0.08 }
- **L3**：triggerEffect `building_count_bonus` { category: 'industry', per: 5, bonus: 0.015, target: 'stability' }; converter { sourceType: 'stability', ratio: 0.003, target: 'industryBonus', cap: 0.12 }
- **Build方向**：「工人友好工业流」，与工人运动、平等主义协同

---

### 2.5 军事理念 (military) — 6个

#### 2.5.1 骑士精神 (chivalry)
- **灵感**：中世纪骑士道
- **稀有度**：uncommon | **解锁**：epoch 3
- **核心机制**：精锐骑兵为核心
- **L1**：militaryBonus +0.04, cultureBonus +0.02
- **L2**：ruleMod `unit_attack_mod` { scope: 'cavalry', value: +0.12 }; ruleMod `unit_defense_mod` { scope: 'cavalry', value: +0.08 }
- **L3**：triggerEffect `unit_count_bonus` { category: 'cavalry', per: 5, bonus: { militaryBonus: 0.01 }, cap: 0.10 }; onEvent `on_battle_victory` → addResource culture 20
- **Build方向**：「骑兵精英流」

#### 2.5.2 要塞战术 (fortress_doctrine)
- **灵感**：沃邦要塞体系、马奇诺防线
- **稀有度**：uncommon | **解锁**：epoch 4
- **核心机制**：防御工事=不可攻克
- **L1**：stability +3, militaryBonus +0.03
- **L2**：ruleMod `unit_defense_mod` { scope: 'infantry', value: +0.15 }; triggerEffect `building_specific_bonus` { buildingId: 'fortress', per: 1, bonus: { militaryBonus: 0.03 }, cap: 0.15 }
- **L3**：ruleMod `building_cost_mod` { scope: 'military', value: -0.15 }; onEvent `on_battle_defeat` → addBuff "哀兵必胜" { militaryBonus: 0.20, duration: 180 }, cooldownDays: 360
- **Build方向**：「龟壳防御流」

#### 2.5.3 闪电战 (blitzkrieg)
- **灵感**：古德里安、隆美尔
- **稀有度**：rare | **解锁**：epoch 7
- **核心机制**：速度就是一切
- **L1**：militaryBonus +0.06
- **L2**：ruleMod `unit_attack_mod` { scope: 'cavalry', value: +0.15 }; ruleMod `unit_attack_mod` { scope: 'gunpowder', value: +0.10 }
- **L3**：converter { sourceType: 'warCount', ratio: 0.10, target: 'militaryBonus', cap: 0.10 }（首场战争+10%，单cap限制防止多场叠加）; ruleMod `recruit_cost_mod` { scope: 'cavalry', value: -0.2 }
- **Build方向**：「闪击速胜流」

#### 2.5.4 人民战争 (peoples_war)
- **灵感**：毛泽东军事思想、越战
- **稀有度**：rare | **解锁**：epoch 6
- **核心机制**：人民是汪洋大海
- **L1**：militaryBonus +0.04, stability +2
- **L2**：converter { sourceType: 'population', ratio: 0.00003, target: 'militaryBonus', cap: 0.15 }; ruleMod `recruit_cost_mod` { scope: 'infantry', value: -0.2 }
- **L3**：triggerEffect `approval_threshold_bonus` { stratum: 'peasant', threshold: 70, bonus: { militaryBonus: 0.10 } }; onEvent `on_battle_defeat` → addBuff "敌后根据地" { militaryBonus: 0.12, production: 0.08, duration: 180 }
- **⚠️ 修正**：原方案buff 240天 → 改为180天
- **Build方向**：「人海+民意军事流」，与全民皆兵、游击战术协同

#### 2.5.5 火器革命 (gunpowder_revolution)
- **灵感**：火药从中国到欧洲的传播
- **稀有度**：uncommon | **解锁**：epoch 4
- **核心机制**：火器碾压冷兵器
- **L1**：militaryBonus +0.05
- **L2**：ruleMod `unit_attack_mod` { scope: 'gunpowder', value: +0.15 }; ruleMod `unit_defense_mod` { scope: 'siege', value: +0.1 }
- **L3**：triggerEffect `epoch_scaling` { perEpoch: { militaryBonus: 0.02 } }; triggerEffect `building_specific_bonus` { buildingId: 'barracks', per: 1, bonus: { militaryBonus: 0.02 }, cap: 0.10 }
- **Build方向**：「火器专精流」

#### 2.5.6 军事工业复合体 (military_industrial_complex)
- **灵感**：艾森豪威尔告别演说
- **稀有度**：legendary | **解锁**：epoch 7
- **核心机制**：军事和工业互相喂养
- **L1**：militaryBonus +0.05, industryBonus +0.05, stability -3
- **L2**：converter { sourceType: 'buildingCount', sourceId: 'military', ratio: 0.02, target: 'industryBonus', cap: 0.15 }; converter { sourceType: 'buildingCount', sourceId: 'industry', ratio: 0.015, target: 'militaryBonus', cap: 0.12 }
- **L3**：converter { sourceType: 'warCount', ratio: 0.03, target: 'industryBonus', cap: 0.12 }; converter { sourceType: 'warCount', ratio: 0.03, target: 'militaryBonus', cap: 0.12 }; ruleMod `maintenance_cost_mod` { scope: 'gunpowder', value: -0.15 }
- resource_drain silver 8/tick
- **Build方向**：「军工一体化」终极build
