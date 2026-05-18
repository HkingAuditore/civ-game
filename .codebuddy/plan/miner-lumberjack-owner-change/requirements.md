# 需求文档：矿工与樵夫业主建筑更换

## 引言

当前游戏中，部分建筑的 `owner` 字段设置为 `miner`（矿工）或 `lumberjack`（樵夫），但这些建筑同时雇佣了其他阶层（如 `worker`、`engineer`），形成了"底层劳动阶级作为业主雇佣他人"的不合理局面。

**涉及文件：**
- `src/config/buildings.js`：基础建筑配置（owner、jobs）
- `src/config/buildingUpgrades.js`：建筑升级配置（每级升级的 jobs）

**涉及建筑：**

| 建筑 ID | 建筑名 | 当前 owner | 当前 jobs | 问题 |
|---------|--------|-----------|-----------|------|
| `copper_mine` | 铜矿井 | `miner` | `{ miner: 4, worker: 1 }` | 矿工雇佣了 worker |
| `stone_workshop` | 采石工场 | `miner` | `{ miner: 4, worker: 4 }` | 矿工雇佣了 worker |
| `shaft_mine` | 竖井矿场 | `miner` | `{ miner: 6, engineer: 12 }` | 矿工雇佣了 engineer |
| `hardwood_camp` | 硬木林场 | `lumberjack` | `{ lumberjack: 5, worker: 5 }` | 樵夫雇佣了 worker |

**设计意图**：矿工和樵夫属于底层劳动阶级，不具备雇佣他人的社会资本与经济能力。需要将这些建筑的 `owner` 更换为更合适的中层及以上阶级，同时在 `jobs` 字段中新增对应的业主岗位（数量为 1），以保持建筑的经济逻辑合理性。升级后的建筑同样需要保持业主岗位的一致性。

---

## 需求

### 需求 1：铜矿井（copper_mine）更换业主

**用户故事：** 作为游戏设计者，我希望铜矿井由更有资本的阶层经营，以便体现采矿业需要一定资本投入的经济逻辑。

#### 验收标准

1. WHEN 铜矿井建筑被加载时 THEN 系统 SHALL 将其 `owner` 字段设置为 `artisan`（工匠），而非 `miner`
2. WHEN 铜矿井的基础 `jobs` 被计算时 THEN 系统 SHALL 将 `jobs` 更新为 `{ miner: 4, worker: 1, artisan: 1 }`，新增 `artisan: 1` 作为业主岗位
3. WHEN 铜矿井升级为"深铜矿"（1级）时 THEN 系统 SHALL 将升级 `jobs` 设置为 `{ miner: 4, worker: 1, artisan: 1 }`
4. WHEN 铜矿井升级为"大铜矿"（2级）时 THEN 系统 SHALL 将升级 `jobs` 设置为 `{ miner: 5, worker: 1, artisan: 1 }`
5. IF 铜矿井任意等级的 owner 为 artisan THEN 系统 SHALL 确保该等级 `jobs` 中 artisan 岗位数量为 1

---

### 需求 2：采石工场（stone_workshop）更换业主

**用户故事：** 作为游戏设计者，我希望采石工场由工匠阶层经营，以便体现封建时代石料加工需要有技艺的工匠主持。

#### 验收标准

1. WHEN 采石工场建筑被加载时 THEN 系统 SHALL 将其 `owner` 字段设置为 `artisan`（工匠），而非 `miner`
2. WHEN 采石工场的基础 `jobs` 被计算时 THEN 系统 SHALL 将 `jobs` 更新为 `{ miner: 4, worker: 4, artisan: 1 }`，新增 `artisan: 1` 作为业主岗位
3. WHEN 采石工场升级为"大采石工场"（1级）时 THEN 系统 SHALL 将升级 `jobs` 设置为 `{ miner: 4, worker: 4, artisan: 1 }`
4. WHEN 采石工场升级为"皇家采石场"（2级）时 THEN 系统 SHALL 将升级 `jobs` 设置为 `{ miner: 5, worker: 5, artisan: 1 }`
5. IF 采石工场任意等级的 owner 为 artisan THEN 系统 SHALL 确保该等级 `jobs` 中 artisan 岗位数量为 1

---

### 需求 3：竖井矿场（shaft_mine）更换业主

**用户故事：** 作为游戏设计者，我希望竖井矿场由商人阶层经营，以便体现探索时代深井采矿需要大量资本投入和商业组织能力。

#### 验收标准

1. WHEN 竖井矿场建筑被加载时 THEN 系统 SHALL 将其 `owner` 字段设置为 `merchant`（商人），而非 `miner`
2. WHEN 竖井矿场的基础 `jobs` 被计算时 THEN 系统 SHALL 将 `jobs` 更新为 `{ miner: 6, engineer: 12, merchant: 1 }`，新增 `merchant: 1` 作为业主岗位
3. WHEN 竖井矿场升级为"通风矿井"（1级）时 THEN 系统 SHALL 将升级 `jobs` 设置为 `{ miner: 6, engineer: 12, merchant: 1 }`
4. WHEN 竖井矿场升级为"蒸汽矿井"（2级）时 THEN 系统 SHALL 将升级 `jobs` 设置为 `{ miner: 7, engineer: 13, merchant: 1 }`
5. IF 竖井矿场任意等级的 owner 为 merchant THEN 系统 SHALL 确保该等级 `jobs` 中 merchant 岗位数量为 1

---

### 需求 4：硬木林场（hardwood_camp）更换业主

**用户故事：** 作为游戏设计者，我希望硬木林场由商人阶层经营，以便体现封建时代有组织的林业开采需要商业资本支持。

#### 验收标准

1. WHEN 硬木林场建筑被加载时 THEN 系统 SHALL 将其 `owner` 字段设置为 `merchant`（商人），而非 `lumberjack`
2. WHEN 硬木林场的基础 `jobs` 被计算时 THEN 系统 SHALL 将 `jobs` 更新为 `{ lumberjack: 5, worker: 5, merchant: 1 }`，新增 `merchant: 1` 作为业主岗位
3. WHEN 硬木林场升级为"特用林场"（1级）时 THEN 系统 SHALL 将升级 `jobs` 设置为 `{ lumberjack: 5, worker: 5, merchant: 1 }`
4. WHEN 硬木林场升级为"皇家御林"（2级）时 THEN 系统 SHALL 将升级 `jobs` 设置为 `{ lumberjack: 6, worker: 6, merchant: 1 }`
5. IF 硬木林场任意等级的 owner 为 merchant THEN 系统 SHALL 确保该等级 `jobs` 中 merchant 岗位数量为 1

---

### 需求 5：兼容性与一致性

**用户故事：** 作为开发者，我希望业主更换只影响建筑配置文件，以便不破坏现有的投资逻辑、人口就业计算和经济系统。

#### 验收标准

1. WHEN 建筑配置被修改后 THEN 系统 SHALL 确保所有引用这些建筑的逻辑（投资过滤、就业计算、人口需求）自动适配新的 owner 和 jobs
2. IF 存量游戏存档中已有这些建筑的实例 THEN 系统 SHALL 允许存量数据继续运行，不强制清除
3. WHEN 新规则生效后 THEN 系统 SHALL 在新的投资决策中按新 owner 阶层进行过滤和分配
4. WHEN 建筑 jobs 字段被修改后 THEN 系统 SHALL 确保新增的业主岗位（artisan/merchant）参与正常的就业分配和工资计算
5. WHEN `buildings.js` 和 `buildingUpgrades.js` 均被修改后 THEN 系统 SHALL 确保基础建筑与各升级等级的 owner 和 jobs 保持一致
