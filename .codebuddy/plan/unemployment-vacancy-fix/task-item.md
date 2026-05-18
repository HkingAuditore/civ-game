# 实施计划：修复 Tier 0/1 空缺岗位失业人口不就业问题

## 涉及文件

- `src/logic/utils/constants.js` — 常量定义
- `src/logic/population/jobs.js` — `fillVacancies` 函数核心逻辑
- `src/logic/simulation.js` — `getSmartExpectedWage` 定义和 `fillVacancies` 调用

---

- [ ] 1. 在 `constants.js` 中新增 Tier 0/1 专用填补速率常量
   - 在 `VACANCY_FILL_RATIO_PER_TICK`（第41行）附近新增 `VACANCY_FILL_RATIO_TIER01 = 0.75`，用于 Tier 0/1 岗位的独立填补速率
   - 保留原 `VACANCY_FILL_RATIO_PER_TICK = 0.25` 不变，仅用于 Tier 2/3 岗位
   - _需求：1.1, 1.3_

- [ ] 2. 在 `jobs.js` 中导入新常量并修改 `fillVacancies` 的排序逻辑
   - 在 `jobs.js` 顶部导入列表（第23行附近）中添加 `VACANCY_FILL_RATIO_TIER01`
   - 修改 `vacancyRanking` 的 `.sort()` 逻辑（约第305行）：先按 tier 分组排序（tier <= 1 排在前面），同组内再按 `netIncome` 降序排列
   - _需求：2.1, 2.2_

- [ ] 3. 修改 `fillVacancies` 中 Tier 0/1 的填补速率计算
   - 在 `vacancyRanking.forEach` 内部（约第315行），将 `perRoleFillCap` 的计算改为根据 `entry.tier` 选择不同的速率常量：`entry.tier <= 1` 时使用 `VACANCY_FILL_RATIO_TIER01`，否则使用 `VACANCY_FILL_RATIO_PER_TICK`
   - 确保 `Math.max(1, ...)` 的保底逻辑不变
   - _需求：1.1, 1.2_

- [ ] 4. 为 Tier 0/1 岗位的净收入估算添加保底值
   - 在 `estimateRoleNetIncome` 函数（约第250行）中，当计算结果 <= 0 且 `STRATUM_TIERS[role] <= 1` 时，返回一个保底值（如所有 Tier 0/1 角色平均工资的 50%，或固定最小正值 `0.01`）
   - 这确保 Tier 0/1 岗位不会因为净收入为 0/负数而被排到列表末尾
   - _需求：3.2, 3.3_

- [ ] 5. 优化 `simulation.js` 中 `getSmartExpectedWage` 的低人口判断
   - 在 `getSmartExpectedWage`（第2262行）中，当 `currentPop === 0`（完全空缺）时，始终使用 `estimatePotentialIncomeForVacancy` 的结果，不受 `LOW_POP_THRESHOLD` 限制
   - 确保新建建筑的岗位即使没有历史工资数据也能获得合理的收入预估
   - _需求：3.1_

- [ ] 6. 验证 Tier 2/3 岗位逻辑未受影响
   - 确认 Tier 2/3 岗位仍使用原 `VACANCY_FILL_RATIO_PER_TICK = 0.25` 速率
   - 确认 Tier 2/3 的财富门槛、Lucky Promotion、候选人筛选逻辑均未被修改
   - 确认 `official` 角色仍被排除在 `vacancyRanking` 之外
   - _需求：4.1, 4.2_

- [ ] 7. 端到端功能验证
   - 运行 `npm run build` 确认无编译错误
   - 在游戏中测试：建造新建筑后，Tier 0/1 岗位空缺应在 2 tick 内被失业者填满
   - 在游戏中测试：拆除建筑后，裁员人口应在 2-3 tick 内被重新分配到其他有空缺的 Tier 0/1 岗位
   - 在游戏中测试：Tier 2/3 岗位的填补行为应与修改前一致
   - _需求：1.2, 4.3_
