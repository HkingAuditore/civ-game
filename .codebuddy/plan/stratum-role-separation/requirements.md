# 需求文档：阶层角色分离（业主/雇员互斥）

## 引言

当前建筑系统中，多个阶层同时在某些建筑中担任**业主**、在另一些建筑中担任**雇员**，这造成了经济角色定位模糊。本次优化的核心目标是：**每个阶层在整个建筑体系中，要么只作为业主出现，要么只作为雇员出现，不得跨角色**。同时明确"自营"的定义：只有当建筑的 `jobs` 中只有一个角色且该角色等于 `owner` 时，才算自营。

### 用户设定的设计原则

1. **worker（工人）→ 纯雇员**：早期自营建筑的 owner 改为 artisan
2. **engineer（工程师）→ 纯雇员**：所有 engineer 作为 owner 的建筑需另选业主
3. **scribe（学者）→ 纯雇员**：所有 scribe 作为 owner 的建筑需另选业主
4. **peasant（自耕农）→ 纯自营业主**：不应成为雇员（不在别人建筑中打工），也不应雇佣人（农田只有 peasant 一种 job）
5. **official（官员）→ 纯雇员**：当前作为 owner 的研究院和生科中心需另选业主

## 当前状态分析

### 冲突阶层及修改方案

#### 1. worker（工人）- 7个 owner 建筑 → 改为 artisan 做 owner

| 建筑 | 行号 | 当前 owner | 当前 jobs | 改后 owner | 改后 jobs |
|------|------|-----------|-----------|-----------|-----------|
| reed_works（造纸工坊） | L146 | worker | { worker: 3 } | artisan | { artisan: 3 }（自营） |
| brewery（酿造坊） | L181 | worker | { worker: 3 } | artisan | { artisan: 3 }（自营） |
| loom_house（织布坊） | L225 | worker | { worker: 3 } | artisan | { artisan: 3 }（自营） |
| dye_works（染坊） | L250 | worker | { worker: 3 } | artisan | { artisan: 3 }（自营） |
| stone_workshop（采石工场）| L504 | miner | { miner: 4, worker: 1 } | 不变（miner自营，见下方） | — |
| sawmill（锯木厂） | L633 | worker | { worker: 4 } | artisan | { artisan: 4 }（自营） |
| brickworks（砖窑） | L653 | worker | { worker: 3 } | artisan | { artisan: 3 }（自营） |

> 注：原 worker 自营建筑改为 artisan 自营后，这些建筑的 jobs 中 worker 角色也需改为 artisan（因为自营定义要求 jobs 中只有 owner 角色）。

#### 2. engineer（工程师）- 11个 owner 建筑 → 改为 capitalist 做 owner

| 建筑 | 行号 | 当前 jobs | 建议新 owner |
|------|------|-----------|-------------|
| coal_power_plant（燃煤电厂） | L1435 | { worker: 6, engineer: 2 } | capitalist |
| oil_refinery（炼油厂） | L1449 | { worker: 5, engineer: 2 } | capitalist |
| wiring_factory（电缆厂） | L1463 | { worker: 6, artisan: 2, engineer: 1 } | capitalist |
| machinery_plant（机械厂） | L1477 | { worker: 8, artisan: 2, engineer: 2 } | capitalist |
| fertilizer_plant（化肥厂） | L1505 | { worker: 4, engineer: 1 } | capitalist |
| plastics_factory（塑料厂） | L1605 | { worker: 5, technician: 3, engineer: 1 } | capitalist |
| electronics_factory（电子工厂） | L1619 | { worker: 4, technician: 5, engineer: 2 } | capitalist |
| pharmaceutical_plant（制药厂） | L1633 | { technician: 3, scribe: 2, engineer: 1 } | capitalist |
| aluminum_smelter（铝冶炼厂） | L1647 | { worker: 6, technician: 2, engineer: 1 } | capitalist |
| solar_power_plant（太阳能电站） | L1789 | { technician: 4, engineer: 2 } | capitalist |
| composites_factory（复合材料厂） | L1803 | { technician: 4, worker: 3, engineer: 1 } | capitalist |

> 注：这些建筑改 owner 为 capitalist 后，需要在 jobs 中增加 `capitalist: 1`（如果原本没有），engineer 保留在 jobs 中作为雇员。

#### 3. scribe（学者）- 3个 owner 建筑 → 另选业主

| 建筑 | 行号 | 当前 jobs | 建议新 owner | 理由 |
|------|------|-----------|-------------|------|
| library（图书馆） | L771 | { scribe: 4 } | cleric | 古代图书馆由神职/教会管理，scribe 作为雇员 |
| navigator_school（航海学院） | L552 | { navigator: 3, scribe: 1 } | merchant | 航海学院服务于商业贸易，商人资助 |
| university（大学） | L1331 | { scribe: 4, engineer: 2 } | cleric | 历史上大学多由教会创办 |

> 注：改为新 owner 后需在 jobs 中加入对应的 owner 角色岗位。

#### 4. peasant（自耕农）- 纯自营，不做雇员

peasant 当前在以下建筑中作为雇员出现：

| 建筑 | 行号 | 当前 jobs | 修改方案 |
|------|------|-----------|---------|
| culinary_kitchen（烹饪坊） | L165 | { artisan: 3, peasant: 1 } | 将 peasant: 1 改为 worker: 1 |
| mechanized_farm（机械化农场） | L1278 | { peasant: 4, worker: 6, engineer: 1, capitalist: 1 } | 将 peasant: 4 改为 worker: 4 |
| rubber_plantation（橡胶园） | L1420 | { peasant: 5, worker: 3, merchant: 1 } | 将 peasant: 5 改为 worker: 5 |

> 注：peasant 被替换为 worker（工人），因为这些建筑不是自营农田，是被资本家/商人雇佣的劳动力。

#### 5. official（官员）- 2个 owner 建筑 → 另选业主

| 建筑 | 行号 | 当前 jobs | 建议新 owner | 理由 |
|------|------|-----------|-------------|------|
| research_institute（研究院） | L1817 | { scientist: 4, scribe: 2, engineer: 2 } | capitalist | 信息时代的研究院多由企业资助 |
| biotech_center（生物科技中心） | L1845 | { scientist: 5, technician: 3, engineer: 1 } | capitalist | 生物科技企业由资本运营 |

#### 6. 其他冲突阶层处理

**lumberjack（樵夫）**：owner 出现在 lumber_camp(L88) 和 hardwood_camp(L519)（均自营）；jobs 出现在 logging_company(L1297, owner=capitalist)。当前不冲突——伐木公司的 lumberjack 是雇员（owner 是 capitalist）。**但 lumberjack 同时既是 owner 又是 employee，仍然冲突**。
- 方案：lumberjack 定为纯自营（类似 peasant）。从 logging_company 的 jobs 中将 lumberjack: 9 改为 worker: 9。

**miner（矿工）**：owner 出现在 quarry(L107)、copper_mine(L126)、stone_workshop(L504)、shaft_mine(L567)（均自营或半自营）；jobs 出现在 mine(L278)、industrial_mine(L338)、oil_well(L1406)、advanced_copper_mine(L1518)、iron_smelter(L1576)、industrial_mine(L1259)。
- 方案：miner 定为纯自营（类似 peasant），从非 miner-owned 建筑的 jobs 中将 miner 替换为 worker。
- **但注意**：mine(L278) owner 是 landowner，miner:9 是雇员 → 改为 worker:9
- industrial_mine(L338) owner 是 capitalist，miner:12 是雇员 → 改为 worker:12
- industrial_mine(L1259) owner 是 capitalist，miner:13 是雇员 → 改为 worker:13
- oil_well(L1406) owner 是 capitalist，miner:3 是雇员 → 改为 worker:3
- advanced_copper_mine(L1518) owner 是 ?, miner:6 是雇员 → 改为 worker:6
- iron_smelter(L1576) miner:6 是雇员 → 改为 worker:6

**merchant（商人）**：owner 出现在 9 个建筑中；jobs 出现在 opera_house(L1345)、stock_exchange(L1360)、internet_platform(L1774)、financial_center(L1830)、rubber_plantation(L1420)、rail_depot(L616)。
- 方案：merchant 定为纯业主。从非 merchant-owned 建筑的 jobs 中将 merchant 替换为 scribe（在文书/金融场景）或 worker（在体力劳动场景）。

**artisan（工匠）**：用户指定 worker 的 owner 改为 artisan。artisan 当前既是 15 个建筑的 owner，又在 12 个建筑中作为雇员。
- 方案：artisan 定为纯业主。在非 artisan-owned 的建筑中将 artisan 雇员替换为 worker。

### 不冲突的阶层（无需修改）

| 阶层 | 当前角色 | 状态 |
|------|---------|------|
| cleric（神职） | 纯业主 | ✅ |
| landowner（地主） | 纯业主 | ✅ |
| capitalist（资本家） | 纯业主 | ✅ |
| serf（佃农） | 纯雇员 | ✅ |
| navigator（水手） | 纯雇员 | ✅ |
| technician（技术工人） | 纯雇员 | ✅ |
| scientist（科学家） | 纯雇员 | ✅ |
| soldier（军人） | 无岗位 | ✅ |
| unemployed（失业者） | 无岗位 | ✅ |

## 需求

### 需求 1：worker 变为纯雇员

**用户故事：** 作为游戏设计者，我希望 worker 只作为雇员出现在建筑中，以便明确其"被雇佣的劳动力"定位。

#### 验收标准

1. WHEN 检查所有建筑配置 THEN buildings.js SHALL 不存在 `owner: 'worker'` 的建筑
2. WHEN 原 worker 自营建筑（造纸工坊、酿造坊、织布坊、染坊、锯木厂、砖窑）修改后 THEN 这些建筑 SHALL 改为 `owner: 'artisan'` 且 jobs 中的 worker 角色 SHALL 改为 artisan
3. WHEN 修改后的建筑检查自营条件 THEN 只有 jobs 中仅有一个角色且该角色等于 owner 的建筑 SHALL 被视为自营

### 需求 2：engineer 变为纯雇员

**用户故事：** 作为游戏设计者，我希望 engineer 只作为雇员出现，以便让工程师成为"高级技术雇员"而非企业主。

#### 验收标准

1. WHEN 检查所有建筑配置 THEN buildings.js SHALL 不存在 `owner: 'engineer'` 的建筑
2. WHEN 原 engineer-owned 的 11 个建筑修改后 THEN 这些建筑 SHALL 改为 `owner: 'capitalist'`
3. WHEN 修改后的建筑 jobs 中没有 capitalist 角色 THEN SHALL 添加 `capitalist: 1` 到 jobs 中
4. WHEN 修改后 THEN engineer SHALL 继续保留在 jobs 中作为雇员角色

### 需求 3：scribe 变为纯雇员

**用户故事：** 作为游戏设计者，我希望 scribe 只作为雇员出现，以便让学者成为"知识型雇员"。

#### 验收标准

1. WHEN 检查所有建筑配置 THEN buildings.js SHALL 不存在 `owner: 'scribe'` 的建筑
2. WHEN 图书馆和大学修改后 THEN 其 owner SHALL 改为 cleric，且 jobs 中 SHALL 添加 cleric 业主岗位
3. WHEN 航海学院修改后 THEN 其 owner SHALL 改为 merchant，且 jobs 中 SHALL 添加 merchant 业主岗位
4. WHEN 修改后 THEN scribe SHALL 继续保留在 jobs 中作为雇员角色

### 需求 4：peasant 变为纯自营

**用户故事：** 作为游戏设计者，我希望 peasant（自耕农）只在自己的农田自营，不在别人的建筑当雇员，也不雇佣其他人，以符合"自耕农"的字面含义。

#### 验收标准

1. WHEN 检查所有建筑配置 THEN peasant SHALL 只出现在 `owner: 'peasant'` 的建筑（即农田）的 jobs 中
2. WHEN peasant 不是建筑的 owner THEN 该建筑的 jobs 中 SHALL 不包含 peasant 角色
3. WHEN 烹饪坊、机械化农场、橡胶园修改后 THEN 其 jobs 中的 peasant SHALL 替换为 worker
4. WHEN 农田检查自营条件 THEN 农田 SHALL 满足自营定义（jobs 仅有 peasant，owner 为 peasant）

### 需求 5：official 变为纯雇员

**用户故事：** 作为游戏设计者，我希望 official 只作为雇员出现，以便让官员成为"行政雇员"。

#### 验收标准

1. WHEN 检查所有建筑配置 THEN buildings.js SHALL 不存在 `owner: 'official'` 的建筑
2. WHEN 研究院和生物科技中心修改后 THEN 其 owner SHALL 改为 capitalist
3. WHEN 修改后的建筑 jobs 中没有 capitalist 角色 THEN SHALL 添加 `capitalist: 1` 到 jobs 中

### 需求 6：lumberjack 和 miner 变为纯自营

**用户故事：** 作为游戏设计者，我希望 lumberjack 和 miner 只在自己的建筑中自营，不在别人建筑中打工，以保持采集阶层的独立性。

#### 验收标准

1. WHEN lumberjack 不是建筑的 owner THEN 该建筑的 jobs 中 SHALL 不包含 lumberjack 角色（替换为 worker）
2. WHEN miner 不是建筑的 owner THEN 该建筑的 jobs 中 SHALL 不包含 miner 角色（替换为 worker）
3. WHEN 伐木公司(logging_company)修改后 THEN 其 jobs 中的 lumberjack: 9 SHALL 改为 worker: 9
4. WHEN 铁矿井(mine)、工业矿场(industrial_mine)等修改后 THEN 其 jobs 中的 miner SHALL 改为 worker

### 需求 7：merchant 和 artisan 变为纯业主

**用户故事：** 作为游戏设计者，我希望 merchant 和 artisan 只作为业主出现，不在别人的建筑中当雇员。

#### 验收标准

1. WHEN merchant 不是建筑的 owner THEN 该建筑的 jobs 中 SHALL 不包含 merchant 角色（替换为 scribe 或 worker）
2. WHEN artisan 不是建筑的 owner THEN 该建筑的 jobs 中 SHALL 不包含 artisan 角色（替换为 worker）
3. WHEN 歌剧院修改后 THEN 其 jobs 中的 merchant: 1 SHALL 替换为合适的雇员角色
4. WHEN 证券交易所、金融中心等修改后 THEN 其 jobs 中的 merchant SHALL 替换为 scribe
5. WHEN 工厂类建筑的 artisan 雇员修改后 THEN SHALL 替换为 worker

### 需求 8：buildingUpgrades.js 中的 jobs 同步修改

**用户故事：** 作为游戏设计者，我希望建筑升级配置中的 jobs 定义也遵循相同的角色分离规则。

#### 验收标准

1. WHEN 建筑升级配置(buildingUpgrades.js)中包含与 buildings.js 冲突的角色定义 THEN SHALL 同步修改使其一致
2. WHEN 升级后的 jobs 中包含违反角色分离规则的角色 THEN SHALL 按相同规则替换

### 需求 9：整体一致性校验

**用户故事：** 作为游戏设计者，我希望修改后的整个建筑体系中每个阶层的角色定位是完全一致的。

#### 验收标准

1. WHEN 所有修改完成后 THEN 以下阶层 SHALL 满足"纯业主"角色（只在 owner 字段出现，在非自己 owner 的建筑中不出现在 jobs 中）：peasant、lumberjack、miner、artisan、merchant、cleric、landowner、capitalist
2. WHEN 所有修改完成后 THEN 以下阶层 SHALL 满足"纯雇员"角色（不出现在任何建筑的 owner 字段中）：worker、engineer、scribe、official、serf、navigator、technician、scientist
3. WHEN 所有修改完成后 THEN 项目 SHALL 能成功构建（npm run build 无错误）

## 风险与注意事项

1. **经济平衡影响**：大量建筑的业主/雇员变更会改变岗位分布，影响各阶层的就业结构和收入分配
2. **人口需求变化**：部分阶层的岗位需求会显著变化（如 artisan 岗位大增，worker 岗位可能减少）
3. **buildingUpgrades.js 同步**：该文件中的 jobs 定义也需要同步修改，确保升级后不引入新的违规
4. **simulation.js 无需修改**：现有的业主/雇员判断逻辑（通过 `building.owner === role` 判断）不受配置变更影响
5. **UI 无需修改**：阶层面板和建筑面板通过配置动态渲染，配置变更自动反映到 UI
