---
name: general-politics-design
overview: 将军系统与政治/经济系统深度联动的策划案。在不新增大型子系统的前提下，利用现有军人阶层(soldier)、执政联盟、满意度、诉求、策略行动等框架，建立将军-政治双向反馈环路。
todos:
  - id: write-design-doc
    content: 使用 [skill:civ-grounded-development] 撰写将军系统策划案文档，涵盖系统现状、成长体系、军政联动、战争社会影响、军事诉求、数值框架和实现对接点七大模块，保存至 ai_reports/ 目录
    status: completed
---

## 用户需求

撰写一份关于将军系统的**详细游戏策划案**，以设计文档形式输出。

## 产品概述

基于现有军人阶层(soldier)、将军/军团系统、执政联盟、满意度、经济循环等已实现的子系统，设计一套完整的**将军-军政联动**体系。策划案需明确将军的成长路线、与政治/经济系统的双向联动机制、战争对全社会的影响、军事专属诉求，以及各环节的数值框架。

## 核心内容

### 一、系统现状盘点

- 梳理已有的军人阶层属性（低税、高影响力、militaryPower buff）
- 将军生成（随机/官员转化）、8种特质、7级成长、经验升级
- 军团机制（8团上限、士气/疲劳、24兵种x7时代）
- 军费经济循环（国库 → Ledger → 军人阶层劳动收入）
- 政体效果（军事独裁+30%军力、军人政府+22%等）

### 二、将军成长体系

- 获取途径（随机招募、官员转化、战功提拔）
- 经验与升级（战斗经验、练兵经验、升级后解锁新特质槽）
- 特质演化（初始特质+战斗中习得特质）
- 将军退场机制（阵亡、老迈退役、政变风险）

### 三、军政联动（核心新机制）

- 将军威望 → 政治影响力（战功积累 → 影响联盟合法性）
- 军人阶层满意度 ↔ 军团士气双向传导
- 军事独裁路径的条件与代价
- 战争胜利/失败对各阶层满意度的差异化影响

### 四、战争社会影响

- 战争厌倦(War Weariness)：长期战争递增全民满意度惩罚
- 胜利红利：战胜后临时满意度/稳定度加成
- 败战代价：投降/割地的阶层分化反应

### 五、军事诉求系统

- 增加军饷、扩军、对外宣战等军事专属诉求
- 与现有诉求框架（TAX_RELIEF/SUBSIDY/RESOURCE/POLITICAL）的对接

### 六、数值框架

- 各机制关键数值的初始设定与取值区间
- 与现有经济系统的平衡约束

### 七、实现对接点

- 标注每个新机制应插入的现有文件/函数位置

## 技术上下文（现有系统定位）

此策划案的技术基础来自对以下模块的深度分析，确保设计方案可在现有架构中落地：

### 现有文件与系统映射

| 系统模块 | 文件路径 | 关键数据/函数 |
| --- | --- | --- |
| 军人阶层定义 | `src/config/strata.js:315-345` | soldier: weight=3, tax=1, influenceBase=2, buffs.satisfied.militaryPower=0.2 |
| 将军系统 | `src/logic/diplomacy/corpsSystem.js` | generateGeneral(), createGeneralFromOfficial(), GENERAL_TRAITS(8种), LEVEL_UP_XP, calculateCorpsCombatPower() |
| 军团系统 | `src/logic/diplomacy/corpsSystem.js` | MAX_CORPS_PER_PLAYER=8, CORPS_FRONT_TASKS(4种), selectPrimaryBattleCorps() |
| 前线系统 | `src/logic/diplomacy/frontSystem.js` | FRONT_POSTURES, FRONT_ZONES, getFrontlineEconomicModifiers(), processFrontTick() |
| 战斗系统 | `src/logic/diplomacy/battleSystem.js` | BATTLE_PLANS(4种战术), createBattle(), processBattleRound() |
| 军费计算 | `src/logic/simulation.js:3140-3242` | Ledger.transfer('state','soldier'), totalArmyCost, 军饷不足警告 |
| 满意度系统 | `src/logic/stability/approval.js` | calculateClassApproval(): 惯性2%/tick, 生活水平硬上限, 无战争因子 |
| 执政联盟 | `src/logic/rulingCoalition.js` | STRATA_CATEGORIES.military=['soldier'], 合法性40%阈值 |
| 政体效果 | `src/config/polityEffects.js:102-113` | 军人专政: exactCoalition=['soldier'], militaryBonus=0.3 |
| 诉求系统 | `src/logic/demands.js` | 4种类型(TAX_RELIEF/SUBSIDY/RESOURCE/POLITICAL), 无军事诉求 |
| 策略行动 | `src/logic/strategicActions.js` | crackdown: minMilitaryPower=0.3, forbiddenStrata=['soldier'] |
| 系统协同 | `src/config/systemSynergies.js:249-256` | military_chain: soldier+engineer, 3级militaryPower加成 |
| 政令组合 | `src/config/systemSynergies.js:279-283` | 军国主义: militaryPower=0.6, recruitSpeed=0.5 |
| AI战争 | `src/logic/diplomacy/aiWar.js` | AI_DOCTRINES(4种学说), generateAICorps(), evaluateAIFrontPlan() |
| 官员系统 | `src/config/officials.js` | sourceStratum含soldier(+30军事属性), militaryBonus/militaryUpkeep效果 |


### 关键联动断点（策划案需解决）

1. **将军 → 政治**：`corpsSystem.js`中将军升级/战功不输出任何政治信号，`rulingCoalition.js`中无将军相关逻辑
2. **满意度 → 士气**：`strata.js`中soldier的`militaryPower` buff在`strategicActions.js`和`organizationPenalties.js`被读取，但`corpsSystem.js`的`calculateCorpsCombatPower()`不读取此值
3. **战争 → 满意度**：`approval.js`的`calculateClassApproval()`缺少isAtWar因子（AI国家有-5，玩家没有）
4. **军事诉求**：`demands.js`中4种诉求类型均为通用类型，无军事特有类型
5. **征兵 → 人口**：`militaryUnits.js`中有`populationCost`字段，但征兵时未做阶层间人口流动

### 策划案产出格式

生成一份完整的Markdown策划案文档，保存至 `ai_reports/` 目录，遵循项目既有的中文文档风格。

## Agent Extensions

### Skill

- **civ-grounded-development**
- Purpose: 确保策划案中的每个机制设计都基于对现有代码的实际验证，避免凭空设计
- Expected outcome: 策划案中的所有"对接点"准确指向真实的文件路径和函数名

### SubAgent

- **code-explorer**
- Purpose: 在撰写策划案过程中，对不确定的代码细节进行补充探索
- Expected outcome: 验证特定函数签名、数据模型字段等，确保策划案技术准确性