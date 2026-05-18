# 需求文档：底层阶级不能作为业主雇佣他人

## 引言

当前游戏中，投资过滤逻辑只检查建筑是否"有雇佣关系"（即 `jobs` 中存在非 `owner` 阶层的岗位），但没有限制 `owner` 阶层本身的社会地位。这导致矿工（`miner`）、自耕农（`peasant`）、樵夫（`lumberjack`）等底层劳动阶级的建筑也可以被外资/官员投资，形成"底层阶级作为业主雇佣他人"的不合理局面。

**现实问题**：矿工建筑（`shaft_mine`）的 `owner` 是 `miner`，但 `jobs` 中同时有 `engineer`，因此通过了"有雇佣关系"的检查，外资可以大量投资，导致矿工业主岗位被外资占据，出现"外资经营，不提供业主岗位"的奇怪现象，且数量可达天文数字。

**设计意图**：只有中层及以上阶级（`artisan`、`merchant`、`official`、`landowner`、`capitalist`、`engineer` 等）才具备雇佣他人的社会资本和经济能力；底层劳动阶级（`peasant`、`lumberjack`、`serf`、`worker`、`miner`）只能自营，不能作为业主雇佣他人。

---

## 需求

### 需求 1：定义"可作为业主雇佣他人"的阶层白名单

**用户故事：** 作为游戏设计者，我希望明确定义哪些阶层可以作为业主雇佣他人，以便体现社会阶层的经济能力差异。

#### 验收标准

1. WHEN 系统初始化 THEN 系统 SHALL 维护一个"可雇主阶层"白名单，包含中层及以上阶级：`artisan`、`merchant`、`navigator`、`scribe`、`soldier`、`cleric`、`official`、`landowner`、`capitalist`、`engineer`、`scientist`、`technician`、`knight`
2. IF 某阶层属于底层阶级（`peasant`、`lumberjack`、`serf`、`worker`、`miner`、`unemployed`）THEN 系统 SHALL 认定该阶层不具备雇主资格
3. WHEN 新阶层被添加到游戏中 THEN 系统 SHALL 根据其 `STRATUM_TIERS` 层级（Tier ≥ 2 为可雇主）自动判断是否具备雇主资格

---

### 需求 2：海外投资过滤排除底层业主建筑

**用户故事：** 作为玩家，我希望外国资本只能投资由中层及以上阶级经营的建筑，以便体现外资利用有组织劳动力的经济逻辑。

#### 验收标准

1. WHEN 外资筛选可投资建筑时 THEN 系统 SHALL 在现有"有雇佣关系"检查之后，额外检查建筑的 `owner` 是否属于"可雇主阶层"
2. IF 建筑的 `owner` 是底层阶级（如 `miner`、`peasant`、`lumberjack`、`worker`、`serf`）THEN 系统 SHALL 将该建筑从可投资列表中排除，即使该建筑有其他雇员岗位
3. WHEN 外资投资过滤完成后 THEN 系统 SHALL 不再出现"矿工作为业主、外资大量占据矿工业主岗位"的情况

---

### 需求 3：外企/AI 自主投资过滤排除底层业主建筑

**用户故事：** 作为游戏设计者，我希望 AI 外企的自主投资逻辑与海外投资保持一致，以便维护游戏规则的统一性。

#### 验收标准

1. WHEN AI 外企（`autonomousInvestment.js`）筛选可投资建筑时 THEN 系统 SHALL 同样排除 `owner` 为底层阶级的建筑
2. IF 建筑 `owner` 的 `STRATUM_TIERS` 层级 < 2 THEN 系统 SHALL 跳过该建筑，不进行投资

---

### 需求 4：官员投资过滤排除底层业主建筑

**用户故事：** 作为游戏设计者，我希望官员投资逻辑也遵循同样的阶层限制，以便保持三种投资类型的规则一致性。

#### 验收标准

1. WHEN 官员（`officialInvestment.js`）筛选可投资建筑时 THEN 系统 SHALL 同样排除 `owner` 为底层阶级的建筑
2. IF 建筑 `owner` 的 `STRATUM_TIERS` 层级 < 2 THEN 系统 SHALL 跳过该建筑，不进行投资

---

### 需求 5：阶层层级判断逻辑复用

**用户故事：** 作为开发者，我希望"可雇主阶层"的判断逻辑集中在一处，以便三种投资类型共享同一规则，避免重复代码和规则不一致。

#### 验收标准

1. WHEN 需要判断某阶层是否具备雇主资格时 THEN 系统 SHALL 使用已有的 `STRATUM_TIERS`（`src/logic/utils/constants.js`）中的层级定义，Tier ≥ 2 视为可雇主
2. IF 判断逻辑需要修改 THEN 系统 SHALL 只需修改一处（`STRATUM_TIERS` 定义或统一的工具函数），三种投资类型自动生效
3. WHEN 实现时 THEN 系统 SHALL 优先在现有过滤条件中添加判断，而非创建新的过滤架构

---

### 需求 6：存量数据兼容处理

**用户故事：** 作为玩家，我希望规则修改后已有的存量外资投资不会立即消失，以便游戏体验不会因规则变更而突然崩溃。

#### 验收标准

1. WHEN 新规则生效后 THEN 系统 SHALL 只影响新增投资决策，不强制清除已存在的底层业主建筑上的外资
2. IF 已有外资投资了底层业主建筑 THEN 系统 SHALL 允许该投资继续存在直至自然到期或被玩家手动处理
3. WHEN 外资续期或新一轮投资决策时 THEN 系统 SHALL 按新规则执行，不再对底层业主建筑发起新投资
