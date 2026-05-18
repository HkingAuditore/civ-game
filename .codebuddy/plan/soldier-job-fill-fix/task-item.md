# 实施计划

- [ ] 1. 在 `simulation.js` 的建筑生产循环结束后，补充军人岗位的 `buildingJobFill` 数据
   - 在 `BUILDINGS.forEach` 生产循环结束后（约行2308初始化 `buildingJobFill = {}`，约行8740返回 `jobFill: buildingJobFill`），找到建筑循环结束的位置
   - 添加逻辑：当 `jobsAvailable.soldier > 0` 时，写入 `buildingJobFill['_military'] = { soldier: Math.min(popStructure.soldier || 0, jobsAvailable.soldier) }`
   - 使用 `_military` 作为虚拟键，以 `_` 前缀确保不与任何真实建筑 ID 冲突（建筑 ID 均为小写字母+下划线格式，无 `_` 前缀）
   - 军人在岗数取 `popStructure.soldier` 和 `jobsAvailable.soldier` 的较小值，防止在岗数超过岗位数
   - _需求：1.1, 1.2, 1.4, 4.4_

- [ ] 2. 验证 `PopulationDetailModal.jsx` 的聚合逻辑无需修改
   - 确认 `Object.values(buildingJobFill).forEach(slotMap => ...)` 会自动遍历到 `_military` 键的值
   - 确认 `filledByStratum.soldier` 会被正确累加
   - 确认 `allRoles` 集合会包含 `soldier`（因为 `jobsAvailable.soldier > 0` 或 `filledByStratum.soldier > 0`）
   - 确认到岗率计算 `Math.min(1, filled / available)` 和缺口计算 `Math.max(0, available - filled)` 对军人角色正确工作
   - 如果逻辑已正确，此步骤无需代码修改；如果发现问题则修复
   - _需求：1.2, 1.3, 1.4, 2.1, 2.2, 2.3_

- [ ] 3. 验证 `BuildTab.jsx` 和 `BuildingDetails.jsx` 不受 `_military` 键影响
   - `BuildTab.jsx` 的 `buildingJobStatsById` 使用 `BUILDINGS.forEach` 遍历，只按 `building.id` 查找 `buildingJobFill`，不会遍历 `_military`
   - `BuildingDetails.jsx` 使用 `jobFill?.[building.id]?.[role]` 查找，不会访问 `_military`
   - `autonomousInvestment.js` 使用 `targetJobFill[b.id]` 查找，不会访问 `_military`
   - 如果逻辑已安全，此步骤无需代码修改；如果发现问题则修复
   - _需求：3.1, 3.2, 3.3_

- [ ] 4. 处理边界情况：无军队时不写入 `_military` 键
   - 确保当 `jobsAvailable.soldier` 为 0 或不存在时，不写入 `buildingJobFill['_military']`
   - 这样 `PopulationDetailModal` 的 `allRoles` 集合中不会出现 `soldier`，军人行自然不显示
   - _需求：1.5, 4.3_

- [ ] 5. 处理边界情况：训练队列中的军人岗位
   - 确认 `jobsAvailable.soldier` 已包含训练队列的人口需求（`currentArmyPopNeeded + queuePopNeeded`，约行1947）
   - 确认 `popStructure.soldier` 已包含训练中的军人人口（由 `fillVacancies` 分配）
   - 如果训练中的军人尚未被分配到 `popStructure.soldier`，需要在 `buildingJobFill['_military']` 中额外处理
   - _需求：4.1, 4.2_

- [ ] 6. 运行构建验证
   - 执行 `npm run build` 确保无编译错误
   - 检查是否有 lint 警告
   - _需求：3.1（不影响现有系统）_
