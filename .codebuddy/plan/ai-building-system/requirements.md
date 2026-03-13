# 需求文档：AI 建筑系统

## 引言

当前 AI 国家不维护真实建筑数据。上一轮 plan 中为战争服务引入了 `generateAIBuildingProfile` 函数，在 AI-AI 战线 checkpoint crossing 时按需生成"虚拟建筑画像"（`nation.virtualBuildings = { buildingId: count }`），使 `calculateWarBuildingDamage` 可统一计算建筑破坏。

然而现有实现存在以下问题：
1. **Epoch 估算粗糙**：用 `Math.floor(pop/80)` 近似，与游戏实际 epoch 脱节。大人口 AI 可能生成远超当前时代的建筑。
2. **建筑分配机械均匀**：不考虑国家特质（商业海洋国 vs 军事侵略国），所有 AI 的建筑画像雷同。
3. **不考虑科技门槛**：`requiresTech` 字段被忽略，AI 可能拥有它根本不应拥有的高级建筑。
4. **战后不恢复**：战争损毁的建筑永久丢失，和平时期 AI 不重建，导致长期战争后 AI 建筑画像退化为空。
5. **与 AI 经济完全脱节（双向断联）**：
   - **正向断联**：虚拟建筑数量纯粹根据人口推算，不反映 AI 的 `wealth`、`inventory`（库存/产量）、`nationPrices`（市场价）或 `resourceBias`（产业偏好）等真实经济数据。类别内均匀分配给所有建筑，而非根据 AI 实际的产出特征来分配。
   - **反向断联**：战争中建筑被破坏后，AI 的资源产量完全不受影响。现有 AI 产量公式 `productionRate = baseProductionRate × bias^1.2 × productionTrend × epochMultiplier × wealthFactor` 不读取 `virtualBuildings` 数据。例如：即使破坏了敌国所有农田，其粮食产量依然不变。
6. **UI 不可见**：玩家无法查看 AI 的建筑概况（只能在战线详情中看到建筑破坏统计数字）。
7. **海外投资建筑与虚拟建筑完全割裂**：玩家通过海外投资系统（`overseasInvestments`）在 AI 国家建造的建筑，以及 AI 在玩家国投资的建筑（`foreignInvestments`），与 `virtualBuildings` 完全独立。海外投资建筑虽然通过 `processOverseasInvestments` 的 `marketChanges` 影响了 AI 的 `inventory`（库存），但不计入 `virtualBuildings`。这意味着：战争中对 `virtualBuildings` 的建筑破坏不涉及海外投资建筑；建筑画像生成时不考虑已有的海外投资产能；`NationDetailView` 中的建筑概况无法体现外资建筑的存在。

**核心目标**：
- **正向链接**（经济→建筑）：优化 `generateAIBuildingProfile` 使其由 AI 国家的真实经济数据驱动——人口决定规模、财富决定数量、资源库存/市场价/resourceBias决定建筑类型分布——从而产生差异化的建筑画像。
- **反向链接**（建筑→经济）：建筑破坏后反向影响 AI 的资源产量和经济指标——在 `updateAINationInventory` 中引入"建筑完好度"修正因子，使战争中建筑损毁切实削弱 AI 的产能和库存。
- **海外投资桥接**（投资→建筑画像）：将玩家在 AI 国的海外投资建筑纳入 AI 建筑画像体系，使其在战线推进时可被破坏（和保护），并在外交面板建筑概况中可见。
- 同时增加和平恢复机制，并在外交面板中展示。

## 现有 AI 经济数据摘要

AI 国家已有的经济数据字段（均可用于驱动建筑画像）：

| 字段 | 含义 | 在画像中的用途 |
|------|------|---------------|
| `population` | 当前人口 | 建筑规模基数 |
| `wealth` | 财富存量 | 建筑规模加成、civic类建筑倾斜 |
| `epoch` | 当前时代 (0-6) | 过滤可用建筑 |
| `inventory` | 资源库存 `{ food: 1250, iron: 300, ... }` | 库存高的资源→对应建筑更多 |
| `nationPrices` | 各资源市场价 `{ food: 1.2, iron: 2.5, ... }` | 价格高（稀缺）→对应建筑少；价格低（盈余）→对应建筑多 |
| `economyTraits.resourceBias` | 资源偏好 `{ food: 1.3, iron: 0.8, ... }` | bias>1 的资源→对应产出建筑更多（产业特长） |
| `aggression` | 侵略性 (0-1) | 军事建筑倾斜 |
| `budget` | 政府预算 | 辅助判断经济健康度 |

现有建筑配置关键字段：`output`（产出资源和数量）、`input`（消耗资源）、`cat`（gather/industry/civic/military）、`epoch`（时代）、`requiresTech`（科技门槛）。

**关键关联**：建筑的 `output` 字段定义了它产出哪种资源。例如 `farm` 的 `output: { food: 4.8 }` 说明它是食物产出建筑。通过将建筑的 output 资源与 AI 的 `resourceBias`/`inventory` 交叉匹配，可以得出"这个AI应该有多少此类建筑"。

### 现有 AI 产量公式（`updateAINationInventory`）

```
productionRate = baseProductionRate × bias^1.2 × productionTrend × epochMultiplier × wealthFactor
```

此公式中 **没有** 任何来自建筑的因子。需求6将在此公式中注入"建筑完好度修正"。

## 需求

### 需求 1：经济驱动的 AI 虚拟建筑画像生成算法

**用户故事：** 作为一名玩家，我希望 AI 国家的建筑画像能体现其真实经济特征（人口、财富、产业结构、库存、市场价），以便不同 AI 的建筑构成有明显差异，战争中建筑破坏的后果更真实。

#### 验收标准

**A. 建筑规模（总量计算）**

1. WHEN `generateAIBuildingProfile(nation, epoch)` 被调用 THEN 系统 SHALL 根据人口和财富计算建筑总量：
   - `totalBuildings = Math.max(5, Math.floor(population / 8) + Math.floor(wealth / 2000))`
   - 人口决定基础规模，财富提供加成（富裕经济体有更多建筑设施）

**B. 时代过滤**

2. WHEN 过滤可用建筑时 THEN 系统 SHALL 使用传入的 `epoch` 参数（而非从人口推算），应用 `BUILDINGS.filter(b => b.epoch <= epoch)` 获取可用建筑列表。

3. WHEN 过滤可用建筑时 THEN 系统 SHALL 额外排除 `requiresTech` 存在且该建筑 `epoch > 当前 epoch` 的建筑（简化科技门槛：建筑 epoch 即科技门槛）。

**C. 类别比例（国家特质驱动）**

4. WHEN 分配建筑到四大类别时 THEN 系统 SHALL 根据国家特质调整类别比例：
   - 默认比例：gather 35%, industry 30%, civic 20%, military 15%
   - 如果 `aggression > 0.6`：military +10%, industry -5%, civic -5%
   - 如果 `traits` 包含 `maritime` 或 `commercial`：civic +10%, military -5%, gather -5%
   - 如果 `traits` 包含 `agricultural`：gather +10%, industry -5%, civic -5%
   - 各类别比例最终 clamp 在 [5%, 50%] 范围内，并归一化使总和为100%

**D. 类别内分配（经济数据驱动 — 核心新增）**

5. WHEN 在单个类别内将该类别的配额分配到具体建筑 ID 时 THEN 系统 SHALL 根据 AI 国家的 `resourceBias`、`inventory` 和 `nationPrices` 计算每个建筑的"经济匹配权重"：
   - 步骤1：取建筑的 `output` 字段，确定其主要产出资源 `mainResource`（output中数量最大的资源）
   - 步骤2：计算该资源的经济匹配分：
     - `biasScore = nation.economyTraits.resourceBias[mainResource] || 1.0`（bias>1表示特产→权重高）
     - `inventoryScore = Math.min(2.0, (nation.inventory[mainResource] || 0) / 500)`（库存充裕→产能高→权重高）
     - `priceScore = 1 / Math.max(0.5, (nation.nationPrices[mainResource] || 1) / basePrice)`（市场价低于基础价=供应充足→权重高；价格高=稀缺→权重低）
   - 步骤3：合成权重 `weight = biasScore × (0.5 + inventoryScore × 0.3 + priceScore × 0.2)`
   - 步骤4：再乘以时代加权 `weight × (1 + building.epoch / maxEpoch)`（高时代建筑优先）
   - 步骤5：归一化所有权重后按比例分配该类别的配额

6. IF 某个建筑的 `output` 中没有任何资源与 `resourceBias` 匹配（如 silver 产出的贸易建筑）THEN 系统 SHALL 使用默认权重 1.0。

7. IF AI 国家没有 `inventory` 或 `nationPrices` 数据（旧存档兼容）THEN 系统 SHALL 回退到仅使用 `resourceBias` + 时代加权的简化模式。

**E. 幂等性**

8. WHEN `nation.virtualBuildings` 已存在且建筑总量 >= `population / 12` THEN 系统 SHALL 直接返回现有画像，不重新生成。

### 需求 2：AI 建筑和平时期恢复

**用户故事：** 作为一名玩家，我希望 AI 国家在战后能逐步恢复建筑，以便长期游戏中 AI 不会因为一次战争永久性衰退。

#### 验收标准

1. WHEN AI 国家处于和平状态（无活跃战争）且 `nation.virtualBuildings` 存在 THEN 系统 SHALL 每 30 天执行一次恢复检查。

2. WHEN 恢复检查执行时 THEN 系统 SHALL 计算当前建筑总量与"应有总量"（`Math.floor(population / 8) + Math.floor(wealth / 2000)`）的差值。

3. IF 当前建筑总量 < 应有总量的 80% THEN 系统 SHALL 每次恢复 `Math.ceil(差值 * 0.1)` 座建筑（缓慢恢复，约10轮即300天恢复到应有水平）。

4. WHEN 恢复建筑时 THEN 系统 SHALL 优先恢复被破坏数量最多的建筑类型，按当前经济数据重新计算匹配权重分配恢复名额（恢复也遵循经济驱动逻辑）。

5. IF AI 国家处于战争状态 THEN 系统 SHALL 不执行恢复逻辑（战时不重建）。

### 需求 3：将实际游戏 epoch 传入 AI 建筑生成

**用户故事：** 作为一名玩家，我希望 AI 的建筑画像与当前游戏时代一致，以便不会出现原始时代 AI 拥有工业时代建筑的不合理情况。

#### 验收标准

1. WHEN `processAIAIWarProgression` 中触发 checkpoint crossing 且需要生成虚拟建筑画像时 THEN 系统 SHALL 使用从调用链传入的实际 `epoch` 参数。

2. WHEN `processAIAIWarProgression` 的函数签名中添加 `epoch` 参数后 THEN 系统 SHALL 确保 `simulation.js` 中的调用处正确传入当前 epoch。

3. IF `epoch` 参数未提供（旧存档兼容）THEN 系统 SHALL 回退到使用 `nation.epoch || Math.min(6, Math.floor(pop / 80))` 估算。

### 需求 4：外交面板展示 AI 建筑概况

**用户故事：** 作为一名玩家，我希望在外交面板查看 AI 国家详情时能看到该国的建筑概况，以便了解其经济构成和军事设施。

#### 验收标准

1. WHEN 玩家在外交面板 `NationDetailView` 中查看某个 AI 国家 THEN 系统 SHALL 在"国家概览"区域显示该国的建筑概况摘要。

2. WHEN 显示建筑概况时 THEN 系统 SHALL 按类别（采集、工业、民政、军事）分组，每组显示总数和代表性建筑名称（最多3个最高数量的建筑）。

3. IF AI 国家没有 `virtualBuildings` 数据 THEN 系统 SHALL 显示"暂无情报"（不主动触发生成，只显示已有数据）。

4. WHEN 显示建筑概况时 THEN 系统 SHALL 使用紧凑的布局（4列网格，图标+数量），与现有的"战略情报"面板视觉风格一致。

5. IF AI 国家在战争中且有建筑破坏数据 THEN 系统 SHALL 在建筑概况旁标注"战损 N 座"（红色小字）。

### 需求 5：性能约束

**用户故事：** 作为一名玩家，我希望 AI 建筑系统不影响游戏性能。

#### 验收标准

1. `generateAIBuildingProfile` 每次调用 SHALL 不超过 O(B) 复杂度（B = 可用建筑种类数，约 20~60），仅在战争开始或和平恢复时调用，不在每 tick 中调用。

2. 和平恢复检查 SHALL 每 30 天执行一次（不是每 tick），且仅对有 `virtualBuildings` 数据的国家执行。

3. 系统 SHALL 不为未参与过战争的 AI 国家生成 `virtualBuildings`（按需生成策略不变）。

4. UI 展示 SHALL 直接读取 `nation.virtualBuildings`，不触发任何新的计算。

5. 经济匹配权重计算 SHALL 只在生成/恢复时执行（一次性 O(B) 遍历），不在每 tick 中运行。

6. 建筑完好度修正（需求6）的每tick计算开销 SHALL 限制为一次 O(B) 的 map-reduce 操作，缓存结果供同tick内多次访问。

### 需求 6：建筑破坏反向影响 AI 产量（建筑→经济反馈闭环）

**用户故事：** 作为一名玩家，我希望当我通过战争大量摧毁敌国的农田时，敌国的粮食产量会下降；当我摧毁敌国的矿场时，其铁矿产量也会下降——以便战争中的建筑破坏有切实的经济后果，使战略轰炸有意义。

#### 验收标准

**A. 建筑完好度修正因子计算**

1. WHEN AI 国家拥有 `virtualBuildings` 数据 THEN 系统 SHALL 计算每种资源的"建筑完好度修正"（`buildingIntegrityModifier`）：
   - 步骤1：遍历 `virtualBuildings` 中所有建筑，根据 `BUILDINGS[id].output` 确定每个建筑的主要产出资源
   - 步骤2：对每种资源，汇总"当前数量"（`currentCount`）和"初始数量"（`baselineCount`，来自画像首次生成时的快照 `nation.virtualBuildingsBaseline`）
   - 步骤3：计算完好度 `integrity = currentCount / baselineCount`（范围 [0, 1]）
   - 步骤4：转化为产量修正因子 `modifier = 0.3 + integrity × 0.7`（即使建筑全毁也保留30%基础产量——人民还有手工劳动）

2. IF `virtualBuildings` 不存在或 `virtualBuildingsBaseline` 不存在 THEN 系统 SHALL 返回默认修正因子 1.0（不影响产量）。

3. IF 某种资源没有对应的产出建筑（如该资源的所有建筑 count = 0 且 baseline = 0）THEN 系统 SHALL 返回该资源的默认修正因子 1.0。

**B. 注入 `updateAINationInventory` 产量公式**

4. WHEN `updateAINationInventory` 每tick计算某资源的 `productionRate` 时 THEN 系统 SHALL 将"建筑完好度修正"乘入产量公式：
   - 修改后公式：`productionRate = baseProductionRate × bias^1.2 × productionTrend × epochMultiplier × wealthFactor × buildingIntegrityModifier[resource]`
   - 例如：敌国原有 20 座 farm，被破坏 15 座后剩 5 座，food 完好度 = 5/20 = 0.25，修正因子 = 0.3 + 0.25×0.7 = 0.475，粮食产量降至原来的 47.5%

5. WHEN 建筑完好度修正导致产量下降时 THEN 系统 SHALL 使 AI 国家的对应资源库存自然下降（因为产出 < 消耗），进而通过现有的库存驱动定价机制推高该资源的市场价。

**C. 基线快照管理**

6. WHEN `generateAIBuildingProfile` 首次为某 AI 国家生成虚拟建筑画像时 THEN 系统 SHALL 同时保存一份深拷贝作为 `nation.virtualBuildingsBaseline`。

7. WHEN AI 建筑和平恢复（需求2）使建筑数量恢复时 THEN 系统 SHALL 同步更新 `virtualBuildingsBaseline` 中对应建筑的基线数量（使恢复后的建筑不再被视为"损毁"）。

8. WHEN `generateAIBuildingProfile` 因重新生成（如人口大幅变化导致幂等性检查失败）而覆盖旧画像时 THEN 系统 SHALL 同时更新 `virtualBuildingsBaseline`。

**D. 经济连锁效应**

9. WHEN 建筑破坏导致某资源产量下降 THEN 系统 SHALL 通过现有经济机制自然产生连锁效应：
   - 产量下降 → 库存下降 → 库存/目标比率降低 → `calculateForeignPrice` 推高市场价 → 该资源出口减少/进口增加 → 贸易平衡恶化
   - 不需要额外代码：这些连锁效应已经存在于 `updateAINationInventory`（库存自动调节）和 `calculateForeignPrice`（库存驱动定价）中

10. WHEN 大量 gather 类建筑（farm, lumber_camp, mine 等）被摧毁时 THEN 系统 SHALL 使 AI 国家的基础资源产量显著下降，但 industry 类建筑（工厂、作坊）的破坏影响加工品产量而非原材料产量。

### 需求 7：海外投资建筑与 AI 虚拟建筑的桥接

**用户故事：** 作为一名玩家，我希望在 AI 国家投资建造的建筑能被视为该国建筑体系的一部分，以便战争时这些建筑也会被破坏（我需要保护我的投资），并且在建筑概况中能看到外资建筑的存在。

#### 验收标准

**A. 海外投资建筑纳入 AI 建筑画像**

1. WHEN `generateAIBuildingProfile(nation, epoch)` 生成或刷新虚拟建筑画像时 THEN 系统 SHALL 查询 `overseasInvestments` 中所有 `targetNationId === nation.id && status === 'operating'` 的投资记录，将其 `{ buildingId: count }` 叠加到 `virtualBuildings` 中。

2. WHEN 叠加海外投资建筑时 THEN 系统 SHALL 在 `virtualBuildings` 中用独立的标记区分本地建筑和外资建筑，以便后续破坏时可以区分处理：
   - `nation.virtualBuildingsForeign = { buildingId: count }` — 仅记录外资部分
   - `virtualBuildings` 中的总量 = 本地画像 + 外资部分

3. IF `overseasInvestments` 数据不可用（如在 `processAIAIWarProgression` 中未传入）THEN 系统 SHALL 仅使用本地画像（不含外资部分），降级但不报错。

**B. 战争中外资建筑的破坏与后果**

4. WHEN `calculateWarBuildingDamage` 对 AI 国家执行建筑破坏时 THEN 系统 SHALL 从 `virtualBuildings`（含外资部分）的总量中随机选择破坏目标。外资建筑和本地建筑被破坏的概率相同（战争不区分所有权）。

5. WHEN 被破坏的建筑属于外资部分（`virtualBuildingsForeign[buildingId] > 0`）THEN 系统 SHALL：
   - 同步从 `virtualBuildingsForeign` 中扣减
   - 记录到战争日志中标注"外资建筑被破坏"
   - 在战争结束结算时，将被破坏的外资建筑数量同步到 `overseasInvestments` 中扣减对应 `count`
   - 投资方（玩家）收到通知日志："你在 [国家名] 的 [建筑名] ×N 在战争中被摧毁"

6. WHEN 外资建筑被破坏后 THEN 系统 SHALL 使该建筑的产能损失同时体现在建筑完好度修正（需求6）中——因为 `virtualBuildings` 总量下降，而 `virtualBuildingsBaseline` 中包含外资部分，完好度自然下降。

**C. 外交面板中的外资建筑显示**

7. WHEN `NationDetailView` 展示 AI 建筑概况时 THEN 系统 SHALL 在每个类别中区分显示"本地 N 座 + 外资 M 座"（外资部分用特殊颜色如蓝色标注）。

8. IF AI 国家有外资建筑但没有 `virtualBuildings` THEN 系统 SHALL 仍显示外资建筑部分（从 `overseasInvestments` 直接读取）。

**D. 完好度修正中的外资贡献**

9. WHEN 计算建筑完好度修正时 THEN 系统 SHALL 使用 `virtualBuildings`（含外资）的总量作为 `currentCount`，`virtualBuildingsBaseline`（含外资初始量）作为 `baselineCount`。这意味着：
   - 外资建筑被破坏会降低完好度，影响 AI 产量
   - 新增的海外投资建筑会提高完好度（通过增加 `currentCount` 超过或接近 `baselineCount`），缓解战损

10. IF 外资建筑在和平时期被撤回/国有化 THEN 系统 SHALL 从 `virtualBuildings` 和 `virtualBuildingsForeign` 中同步移除，但不更新 `virtualBuildingsBaseline`（撤资会暂时降低完好度，直到下次重新生成画像）。

## 边界情况

1. **AI 被吞并**：`nation.isAnnexed = true` 时，清除 `virtualBuildings` 和 `virtualBuildingsBaseline`（胜者已获得资源）。
2. **人口极低的 AI**：`population < 10` 时，建筑总量保底 5 座。
3. **epoch = 0 时可用建筑极少**：只有 farm, lumber_camp, quarry, hut, loom_house, barracks, brickworks, library, stone_tool_workshop, trading_post 等基础建筑，画像应只包含这些。
4. **多次战争后恢复**：恢复逻辑需检查已有画像中的建筑 epoch 是否仍 <= 当前 epoch，不恢复超时代建筑。
5. **trait 不存在**：大多数 AI 国家没有 `traits` 数组，应容错处理为默认比例。
6. **inventory/nationPrices 不存在**：旧存档或未初始化的 AI 国家可能缺少这些字段，回退到仅用 resourceBias + 时代加权。
7. **建筑 output 产出多种资源**：取 output 中数量最大的资源作为主要资源进行匹配。
8. **建筑无 output**：极少数建筑可能没有 output（如纯提供岗位的建筑），使用默认权重 1.0。
9. **resourceBias 中不包含某资源**：默认 bias = 1.0（无偏好）。
10. **建筑全部被摧毁**：完好度 = 0，修正因子 = 0.3（保留30%基础产量，代表手工劳动和非建筑来源的经济活动）。
11. **virtualBuildingsBaseline 缺失（旧存档）**：从当前 `virtualBuildings` 复制一份作为基线，此时完好度 = 1.0。
12. **和平恢复后再次开战**：基线已更新为恢复后的数量，新的战争损毁从新基线计算完好度。
13. **海外投资建筑在战后被破坏**：战后结算时同步销毁 `overseasInvestments` 记录，投资方收到通知日志。
14. **AI-AI战争中破坏了玩家的海外投资**：两个AI交战时，如果玩家在其中一国有海外投资建筑，这些建筑也可能被破坏，玩家应收到通知。
15. **海外投资建筑不参与和平恢复**：AI 和平恢复（需求2）只恢复本地建筑（`virtualBuildings - virtualBuildingsForeign`），外资建筑的恢复由投资方重新建造。
16. **海外投资在战后被冻结/国有化**：如果海外投资因战争被国有化，则该建筑从 `virtualBuildingsForeign` 中移除并转入本地画像。

## 技术约束与复用策略

### 必须复用的现有系统
- `generateAIBuildingProfile()` — 现有函数，原地优化（核心改造点）
- `BUILDINGS` 配置 — 所有建筑定义数据，利用 `output`/`cat`/`epoch`/`requiresTech` 字段
- `RESOURCES` 配置 — 资源定义数据，利用 `basePrice` 字段进行价格对比
- `calculateWarBuildingDamage()` — 保持兼容，不修改接口
- `processAIAIWarProgression()` — 修改 epoch 传参
- `updateAINationInventory()` — 注入建筑完好度修正因子（核心接入点）
- `calculateForeignPrice()` — 无需修改，自然受益于库存下降→价格上涨的连锁反应
- `NationDetailView.jsx` — 在现有"国家概览"区域扩展

### 数据流（双向）
```
=== 正向：经济 → 建筑画像 ===
nation.population + nation.wealth → 建筑总量
nation.economyTraits.resourceBias → 类别比例微调 + 类别内权重
nation.inventory → 类别内权重（inventoryScore）
nation.nationPrices + RESOURCES.basePrice → 类别内权重（priceScore）
nation.aggression + nation.traits → 类别比例微调
epoch → 可用建筑过滤 + 时代加权

=== 反向：建筑破坏 → 经济影响 ===
war → calculateWarBuildingDamage → nation.virtualBuildings 扣减（含外资部分）
nation.virtualBuildings / nation.virtualBuildingsBaseline → buildingIntegrityModifier[resource]
buildingIntegrityModifier → updateAINationInventory → productionRate 降低
productionRate 降低 → inventory 下降 → nationPrices 上涨 → 贸易恶化

=== 桥接：海外投资 → 建筑画像 ===
overseasInvestments.filter(targetNationId) → virtualBuildingsForeign
virtualBuildingsForeign + 本地画像 → virtualBuildings（总量）
war → 破坏 virtualBuildings → 可能命中外资部分 → 战后同步销毁 overseasInvestments 记录
```

### 不需要新建的模块
- 不需要新文件：所有逻辑在 `warEconomy.js` 和 `aiEconomy.js` 中扩展
- 不需要新组件：建筑概况在 `NationDetailView.jsx` 内联实现
- 不需要新的配置文件：使用现有 `BUILDINGS`、`RESOURCES` 和 `WAR_ECONOMY` 常量
- 建筑完好度修正函数（`calculateBuildingIntegrityModifiers`）作为 `warEconomy.js` 的导出函数，供 `aiEconomy.js` 调用
- `processOverseasInvestments()` — 已有的海外投资结算，保持兼容
- `overseasInvestments` 状态 — 查询玩家在各AI国的投资记录
- `calculateInvestmentImpact()` / `_investmentEffects` — 已有的投资经济影响机制
