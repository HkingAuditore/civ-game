# 需求文档

## 引言

当前游戏中存在一个数据不一致的 bug：军事面板显示有大量军人（如 30 万+人口占用），人口阶层面板也正确显示了军人人口（31 万人，75%），但在**岗位就业总览**中，军人的"在岗数"始终显示为 **0**，导致综合到岗率计算错误，并产生虚假的"缺口"提示。

### 根因分析

1. **`jobsAvailable.soldier`** 在 `simulation.js` 中被正确计算：包含现役军队人口需求 + 训练队列人口需求。
2. **`buildingJobFill`** 是按建筑遍历生成的——只有建筑的 `jobRequirements` 中定义的角色才会被写入 `buildingJobFill[buildingId][role]`。
3. **军人（soldier）岗位不来自任何建筑**，而是来自军队系统（`army` + `militaryCorps` + `militaryQueue`），因此 `buildingJobFill` 中永远不会有 `soldier` 的填充数据。
4. **`PopulationDetailModal`** 的岗位就业总览通过聚合 `buildingJobFill` 来计算各角色的"在岗数"（filled），由于 `buildingJobFill` 中没有 soldier 数据，军人在岗数始终为 0。

### 影响范围

- `src/logic/simulation.js`：`buildingJobFill` 的生成逻辑
- `src/components/modals/PopulationDetailModal.jsx`：岗位就业总览的显示逻辑
- 可能影响其他依赖 `buildingJobFill` 的组件（如 `BuildTab.jsx`、`BuildingDetails.jsx`）

---

## 需求

### 需求 1：军人岗位填充数据补全

**用户故事：** 作为一名玩家，我希望岗位就业总览中军人的在岗数能正确反映实际军队人口，以便我能准确了解国家的就业状况和人力分配。

#### 验收标准

1. WHEN 玩家拥有军队（army 或 militaryCorps 中有单位）THEN 系统 SHALL 在 `buildingJobFill` 或等效数据结构中记录 soldier 角色的实际填充人数（= `popStructure.soldier`）。
2. WHEN 岗位就业总览面板渲染时 THEN 系统 SHALL 显示军人的在岗数等于 `popStructure.soldier`（而非 0），岗位数等于 `jobsAvailable.soldier`。
3. WHEN 军人在岗数 > 0 THEN 系统 SHALL 正确计算军人的到岗率（`filled / available`），并以对应颜色（绿/黄/红）展示。
4. WHEN 军人在岗数 < 岗位数 THEN 系统 SHALL 显示正确的缺口数（`available - filled`），表示尚未招满的军人岗位。
5. WHEN 没有军队（army 为空且无训练队列）THEN 系统 SHALL 不在岗位就业总览中显示军人行。

### 需求 2：综合到岗率计算修正

**用户故事：** 作为一名玩家，我希望综合到岗率能正确包含军人岗位的填充情况，以便我能获得准确的整体就业状况评估。

#### 验收标准

1. WHEN 计算综合到岗率时 THEN 系统 SHALL 将军人的在岗数和岗位数纳入总计算（`totalFilled` 和 `totalAvailable`）。
2. WHEN 军人岗位存在大量缺口时 THEN 系统 SHALL 在综合缺口数中正确反映该缺口。
3. IF 修复前综合到岗率为 99%（因军人 0/31万被错误计算）THEN 修复后 SHALL 显示包含军人实际填充率的正确综合到岗率。

### 需求 3：不影响现有建筑岗位系统

**用户故事：** 作为一名开发者，我希望修复方案不破坏现有的建筑岗位填充逻辑，以便其他依赖 `buildingJobFill` 的功能（建筑详情、建筑列表等）继续正常工作。

#### 验收标准

1. WHEN 修复军人岗位数据后 THEN 系统 SHALL 保持所有建筑的岗位填充数据不变（`buildingJobFill[buildingId][role]` 对于非军人角色的值不受影响）。
2. IF 使用特殊键（如 `_military`）在 `buildingJobFill` 中存储军人数据 THEN 系统 SHALL 确保该键不与任何真实建筑 ID 冲突。
3. WHEN `BuildTab.jsx` 或 `BuildingDetails.jsx` 遍历 `buildingJobFill` 时 THEN 系统 SHALL 不因新增的军人数据产生异常显示。

### 需求 4：边界情况处理

**用户故事：** 作为一名玩家，我希望在各种军队状态下（训练中、战斗损失、解散等），岗位就业总览都能正确反映军人就业情况。

#### 验收标准

1. WHEN 有军队正在训练队列中（status = 'waiting' 或 'training'）THEN 系统 SHALL 将训练队列的人口需求计入军人岗位数（`jobsAvailable.soldier`），训练中的人口计入在岗数。
2. WHEN 军队在战斗中损失单位后 THEN 系统 SHALL 在下一 tick 更新军人在岗数，反映减少的军队人口。
3. WHEN 玩家解散全部军队 THEN 系统 SHALL 将军人岗位数和在岗数都归零，军人行从岗位就业总览中消失。
4. WHEN `popStructure.soldier` 大于 `jobsAvailable.soldier`（理论上不应发生，但作为防御性编程）THEN 系统 SHALL 将到岗率上限为 100%，不显示负缺口。
