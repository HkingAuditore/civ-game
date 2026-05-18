# 实施计划：底层阶级不能作为业主雇佣他人

## 背景说明

**关键数据**（`src/logic/utils/constants.js` 中的 `STRATUM_TIERS`）：
- Tier 0（底层）：`unemployed`, `serf`
- Tier 1（下层）：`peasant`, `lumberjack`, `miner`, `worker`
- Tier 2（中层）：`artisan`, `soldier`, `navigator`, `scribe`, `merchant`, `cleric`, `technician`
- Tier 3（上层）：`official`, `landowner`, `capitalist`, `engineer`, `scientist`

**规则**：Tier ≥ 2 才具备雇主资格，可作为业主雇佣他人。

**涉及文件**：
- `src/logic/diplomacy/overseasInvestment.js` — `getInvestableBuildings()` 函数（第 109 行）
- `src/logic/diplomacy/autonomousInvestment.js` — `INVESTOR_STRATA` 常量（第 467 行）
- `src/logic/officials/officialInvestment.js` — 建筑过滤逻辑

---

- [ ] 1. 在 `getInvestableBuildings` 中添加业主阶层层级检查
   - 修改 `src/logic/diplomacy/overseasInvestment.js` 的 `getInvestableBuildings()` 函数
   - 在现有"有雇佣关系"检查（步骤 5）之后，新增步骤 6：导入 `STRATUM_TIERS`，检查 `buildingOwner` 的 tier，若 `STRATUM_TIERS[buildingOwner] < 2` 则返回 `false`
   - 此修改同时覆盖海外投资（需求 2）和所有调用该函数的路径
   - _需求：1.3、2.1、2.2、5.1、5.2_

- [ ] 2. 修正 `autonomousInvestment.js` 中的 `INVESTOR_STRATA` 列表
   - 修改 `src/logic/diplomacy/autonomousInvestment.js` 第 467 行的 `INVESTOR_STRATA` 常量
   - 移除 `peasant` 和 `lumberjack`（Tier 1，不具备雇主资格）
   - 保留 `capitalist`, `merchant`, `artisan`（Tier 2/3，具备雇主资格）
   - _需求：3.1、3.2、1.1、1.2_

- [ ] 3. 检查并修正 `officialInvestment.js` 中的建筑过滤逻辑
   - 读取 `src/logic/officials/officialInvestment.js`，找到筛选可投资建筑的过滤条件
   - 若该文件直接调用 `getInvestableBuildings()`，则任务 1 已自动覆盖，无需额外修改
   - 若该文件有独立的建筑过滤逻辑，则同样添加 `STRATUM_TIERS[buildingOwner] < 2` 的排除条件
   - _需求：4.1、4.2、5.3_
