# 时代系统扩展实施方案 (优化版)

> [!IMPORTANT]
> **设计原则（强约束）**：
> 1. **去伪存真**：严格剔除当前游戏底层不支持的机制（如：外交距离、单位移动速度、环保值、舆论值、文化科研混合产出）。只使用现有且经过验证的数值属性（如：稳定度、税收效率、工业/科研加成）。
> 2. **先迁移后填充**：优先解决因时代 ID 变更导致的数据错位问题。
> 3. **复杂度后置**：Epoch 7-9 以“短链”为主快速落地；Epoch 10-11 才引入“长产业链”作为高收益高脆弱路线。

---

## 1. 目标与边界

### 1.1 目标
- 修正时代命名与定位错位问题，并把后期内容拆分为更细颗粒度的时代。
- 引入 **流量资源（Flow）**，为后期工业/科研提供“卡脖子”约束。
- 为后期提供 **更长的产业链**：在不新增底层系统的前提下，通过“资源输入/输出 + 现有属性增益”实现更深的规划空间。

### 1.2 不做什么
- 不引入新结算维度（例如：碳排放、舆论、文化融合、外交距离、单位移动等）。
- 不引入复杂物流/运输/路线系统。
- 不承诺旧存档兼容（见风险控制）。

---

## 2. 时代架构重构

目标：将时代粒度细化，同时修正原有的命名错位。

| ID | 旧名称 | **新名称** | 核心特征 (Keywords) | 关键资源 |
| :--- | :--- | :--- | :--- | :--- |
| 0-5 | (保持不变) | (保持不变) | - | - |
| 6 | 工业时代 | **蒸汽时代 (Steam)** | 煤炭、铁路、高污染 | 煤炭 |
| 7 | 信息时代 | **电气时代 (Electric)** | 电力、流水线、大众消费 | **电力 (Flow)**、石油 |
| 8 | (新增) | **原子时代 (Atomic)** | 核能、冷战背景、极端效率 | 铀矿 |
| 9 | (新增) | **信息时代 (Information)** | 互联网、半导体、全球化 | **算力 (Flow)** |
| 10 | (新增) | **智能时代 (Intelligent)** | AI、自动化、规模化管理 | （无新基础资源，强调组合消耗） |
| 11 | (新增) | **未来时代 (Future)** | 可控聚变、后稀缺 | - |

---

## 3. 核心系统：流量资源 (Flow Resources)

### 3.1 定义
- **即产即销，不可存储**。产出 < 消耗时触发惩罚。
- Flow 的意义：让后期增长具备硬约束，避免纯滚雪球。

### 3.2 类型
1. **电力 (Electricity)** (Epoch 7+)
   - 定位：工业倍增器。
   - 产出：发电体系（火电→核电→未来能源）。
   - 消耗：工厂/数据中心/后期自动化建筑。
2. **算力 (Computing)** (Epoch 9+)
   - 定位：科研与治理倍增器。
   - 产出：半导体/数据中心体系。
   - 消耗：国家实验室、AI/自动化、数字治理。

### 3.3 短缺惩罚（分层，仍只用现有属性）
> 目的：避免“一断电/断算力就像坏档”的突兀体验，同时保留卡脖子压力。

- **轻度短缺（供给/需求 ≥ 70%）**：按缺口比例削减对应加成（电→`industryBonus`，算力→`scienceBonus`）。
- **重度短缺（30% ≤ 供给/需求 < 70%）**：在削减加成基础上，叠加 `stability` 负向（停工/社会压力）。
- **崩溃级短缺（供给/需求 < 30%）**：进一步叠加 `taxEfficiency` 负向（治理失灵/黑市/系统性损耗）。

---

## 4. 建筑与产业链设计

### 4.1 总原则
- **Epoch 7-9：短链优先**（Input: 基础资源/钱/Flow → Output: 资源或现有属性）。
- **Epoch 10-11：长链优先**（高效率 + 高脆弱），短链作为低效率保底存在。
- “长链”的奖励来自：更高的最终产出、更强的 `industryBonus/scienceBonus/taxEfficiency/stability` 组合收益。
- “长链”的代价来自：更高的 Flow 依赖、更高的建设成本与输入复杂度。

### 4.2 Epoch 7: 电气时代（短链）
- **火力发电厂**：消耗 `Coal` → 产出 `Electricity` + 小幅 `industryBonus`。
- **电气工厂**：消耗 `Electricity` + `Iron` → 产出大量 `Tools` / `Steel`（替代旧工厂，效率更高）。
- **百货公司**：消耗 `Fine Clothes` / `Furniture` → 产出大量 `Silver` + `stability`（用过剩工业品换稳定与税基）。

### 4.3 Epoch 8: 原子时代（短链 + 稳态电力）
- **核电站**：消耗 `Uranium` → 产出巨量 `Electricity`。
- **国家实验室**：消耗 `Silver`（巨额经费）+ `Electricity` → 产出大量 `Science`。

### 4.4 Epoch 9: 信息时代（短链，准备长链基础）
- **数据中心**：消耗 `Electricity` → 产出 `Computing` + `taxEfficiency`（信息化治理）。
- **半导体工厂**：消耗 `Gold` + `Electricity` → 产出 `Computing`。（先简化掉硅片环节，保证可落地）

### 4.5 Epoch 10-11: 后期长产业链（新增策略层）
> 目标：在不新增底层机制的前提下，用“更多中间品 + Flow 依赖 + 更高收益”实现更深规划。

#### 长链策略（总规则）
- **短链路线**：少步骤、少依赖、产出较低但稳定。
- **长链路线**：多步骤、多依赖，产出更高，但对 `Electricity/Computing` 极敏感。

#### 长链主线 A：化工—材料—高端制造（工业侧）
- 资源建议：`Oil`（基础）、`Chemicals`、`Plastics`、`AdvancedAlloys`、`Consumer Goods`。
- 建筑建议：
  - **炼油厂**：`Oil` + `Electricity` → `Chemicals`。
  - **化工厂**：`Chemicals` + `Electricity` → `Plastics`。
  - **材料工厂**：`Steel` + `Chemicals` → `AdvancedAlloys`。
  - **高端制造中心**：`AdvancedAlloys` + `Plastics` + `Computing` + `Electricity` → 大量 `Consumer Goods` + `industryBonus`（可选）。

#### 长链主线 B：电子—设备—算力闭环（科研/治理侧）
- 资源建议：`Chips`、`Electronics`（如不想新增矿物，可跳过硅提纯）。
- 建筑建议：
  - **芯片制造厂**：`Gold` + `Electricity` → `Chips`。
  - **服务器工厂**：`Chips` + `Steel` → `Electronics`。
  - **高级数据中心**：`Electronics` + `Electricity` → 大量 `Computing` + `taxEfficiency`。
  - **高级国家实验室**：`Computing` + `Electricity` + `Silver` → 巨量 `ScienceBonus`。

#### 长链主线 C：民生—治理（稳定/税效侧，可选）
- 资源建议：`Medicine`（或用 `Chemicals` 直接代替以降复杂度）。
- 建筑建议：
  - **制药企业**：`Chemicals` + `Computing` + `Electricity` → `Medicine` + 小幅 `stability`。
  - **全民医疗系统**：`Medicine` + `Silver` → 大量 `stability`（并可通过更高成本平衡）。
  - **数字政务中心**：`Computing` → `taxEfficiency` + `stability`。

#### “黑灯工厂 (Lights-out Factory)”定位修正（避免跳过产业链）
- 岗位：仅需极少 `Engineer`（无需工人）。
- 消耗：巨量 `Computing` + `Electricity` +（建议）终端材料 `AdvancedAlloys/Plastics`。
- 产出：巨量 `Consumer Goods`。
- 目的：解决后期人口不足；同时让其成为长链“放大器”，而不是一键跳过所有中间品。

---

## 5. 政治立场的迁移与重构

必须修正因 ID 变动导致的“穿越”BUG。

- **迁移任务**：
  - 原 Epoch 7（旧信息时代）的立场（如：`数字民主`, `技术官僚`, `生态社会主义`）→ **移动到 Epoch 9**。
- **填补任务（Epoch 7/8）**：
  - 新增 **财阀统治 (Plutocracy)** (Epoch 7)：强工业、弱稳定。
  - 新增 **福利国家 (Welfare State)** (Epoch 7)：高税收高福利，提高底层满意度与稳定。
  - 新增 **核威慑 (Nuclear Deterrence)** (Epoch 8)：提升军事与合法性。

---

## 6. 实施步骤（执行清单）

### 阶段一：时代 ID 重构与数据迁移 (Day 1)
> 目标：搭建 12 时代框架，确保现有游戏不报错、无内容错位。

1. 修改 `src/config/epochs.js`
   - 重命名 Epoch 6 为 `Steam`。
   - 重命名 Epoch 7 为 `Electric`，并重置其属性适应新定位。
   - 创建 Epoch 8-11 的空壳配置。
2. 修改 `src/hooks/cheatCodes.js`
   - 更新 `EPOCH_ALIASES`，确保能通过控制台进入新时代。
3. 修改 `src/config/politicalStances.js`
   - 搜索替换：所有 `unlockEpoch: 7` → `unlockEpoch: 9`。
   - Epoch 7-8 暂时沿用前时代立场，或添加临时占位。

### 阶段二：资源与基础系统 (Day 2)
1. 修改 `src/config/gameConstants.js`
   - 添加基础资源：`Uranium`、`Oil`（建议保留以支撑后期长链）。
   - 添加 Flow：`Electricity`、`Computing`（标记 `type: 'flow'`）。
   - （如实施长链）添加中间品：`Chemicals/Plastics/AdvancedAlloys`、以及 `Chips/Electronics`（可分批引入）。
2. 修改 `src/logic/simulation.js`
   - 实现 Flow 计算逻辑 `calculateFlowResources`。
   - 实现 Flow 短缺惩罚（按 3.3 分层规则）。

### 阶段三：填充新内容 (Day 3-4)
1. 修改 `src/config/technologies.js`
   - 填充 Epoch 7-11 关键科技（内燃机、核能、互联网、AI）。
   - 科技效果严格使用现有属性（如 `industryBonus`, `scienceBonus`, `taxEfficiency`, `stability`）。
2. 修改 `src/config/buildings.js`
   - 实现 Epoch 7-9 的短链建筑。
   - 实现 Epoch 10-11 的长链建筑（建议先上“化工材料链”或“电子算力链”之一）。
   - 控制数值膨胀：造价与维护随时代指数上升（通过 `cost` 控制）。

---

## 7. 风险控制

- **存档兼容性**
  - ID 6（工业）→ ID 6（蒸汽）：兼容。
  - ID 7（信息）→ ID 7（电气）：**不兼容**。处于旧信息时代的存档载入后将变为电气时代，可能丢失科技。
  - 对策：仅作为开发版本更新，不保证旧存档兼容。
- **数值膨胀**
  - 新时代的指数级加成可能导致金钱/科研溢出。
  - 对策：后期科技/建筑的造价与维护也应指数级上升（由 `cost` 指数控制）。
- **复杂度失控**
  - 对策：长链内容分批引入（先化工材料链，再电子算力链）。
