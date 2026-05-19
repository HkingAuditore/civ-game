# 实施计划

## 涉及文件

| 文件 | 角色 |
|------|------|
| `src/logic/diplomacy/aiWar.js` | 主要修改：战争分数累积逻辑、战争结束判定、疲劳累积 |
| `src/logic/diplomacy/frontSystem.js` | 次要修改：checkpoint 分数衰减逻辑 |
| `src/config/gameConstants.js` | 配置修改：疲劳速率、战争时长上限等常量 |
| `src/components/diplomacy/NationDetailView.jsx` | UI修改：战争分数显示增强 |

---

- [ ] 1. 修复 occupation/attrition 分数的 tick 频率不匹配问题
   - 在 `aiWar.js` 的 `processAIAIWarProgression` 函数中（约 L2260-2278），将 occupation score 的触发条件从 `warDuration % 5 === 0` 改为基于 `warDuration` 区间判断：计算自上次触发以来经过的天数，每满 5 天就触发一次（可能一次触发多次补偿）
   - 同理将 attrition score 的触发条件从 `warDuration % 15 === 0` 改为基于区间的补偿触发机制
   - 具体方案：在 war 对象上新增 `lastOccupationDay` 和 `lastAttritionDay` 字段（初始化为 `warStartDay`），每次调用时检查 `warDuration - lastOccupationDay >= 5`，若满足则触发并更新 `lastOccupationDay`；attrition 同理用 15 天间隔
   - _需求：1.1、1.2、1.3_

- [ ] 2. 降低均势战争的 occupation score 偏移阈值
   - 在 `aiWar.js` 的 occupation score 计算块中（约 L2261），将 `Math.abs(posOffset) > 2` 的硬编码阈值改为动态阈值：战争持续超过 100 天时阈值降至 0（即任何偏移都产生分数），超过 50 天时阈值降至 1
   - 具体逻辑：`const occThreshold = warDuration > 100 ? 0 : warDuration > 50 ? 1 : 2;`，然后用 `Math.abs(posOffset) > occThreshold` 替换原条件
   - _需求：2.2_

- [ ] 3. 为均势僵持战争添加基础消耗分
   - 在 `aiWar.js` 的 attrition score 计算块之后（约 L2278），新增一段"均势消耗分"逻辑：当战线在 48~52 范围内且战争持续超过 30 天时，每次调用（每 7 tick）给实力略占优势的一方累积 +1 分（双方极度均势时随机给一方）
   - 这确保即使战线完全僵持，分数也会缓慢漂移，最终触发结束条件
   - 将此分数计入 `warScoreBreakdown.occupation`（复用现有字段）
   - _需求：2.1_

- [ ] 4. 实现 checkpoint 50 的分数衰减机制
   - 在 `aiWar.js` 的 checkpoint crossing 事件处理块中（约 L2200-2250），为 checkpoint 50 添加特殊处理：
     - 在 war 对象上新增 `checkpointCrossCount` 字段（`Map<checkpoint, {count, lastDay}>`），记录每个 checkpoint 的跨越次数和最近跨越时间
     - 当 checkpoint 50 在 30 天内被重复跨越时，分数按次数衰减：第2次 50%、第3次 25%、第4次及以后 10%
     - checkpoint 50 的基础分数从 5 降至 3（因为中线拉锯是常态）
   - _需求：5.1、5.2_

- [ ] 5. 添加长期战争的加速结束机制
   - 在 `aiWar.js` 的战争结束判定块中（约 L2330-2360），添加以下逻辑：
     - 当 `warDuration > 365` 时，将 `exhaustionEndChance` 的基础值从 0.005 提升为 `0.005 + (warDuration - 365) / 5000`，使概率随时间递增（1年后约 0.5%，2年后约 7.8%，3年后约 15%）
     - 当 `warDuration > 730` 且 `absoluteWarScore < endScoreThreshold * 0.5` 时，将 `endScoreThreshold` 强制降低为 `Math.max(15, absoluteWarScore + 10)`
     - 当 `warDuration > 1095`（3年）时，强制结束战争，跳过概率检查直接进入结算流程
   - _需求：3.1、3.2、3.4_

- [ ] 6. 提高战争疲劳的最低增量
   - 在 `aiWar.js` 的战争疲劳累积块中（约 L2303-2320），为 `fatigueDelta` 添加最低增量保障：`const fatigueDelta = Math.max(0.002, nationMilRatio * milLossRate + nationWealthRatio * wealthLossRate + scorePenalty);`
   - 同理为 `enemyFatigueDelta` 添加相同的最低增量
   - 这确保即使双方经济健康、军力完整，疲劳也会以每 tick 至少 0.002 的速率增长（约 500 tick / 3500 天达到 fatigueThreshold 0.5 的一半，配合其他机制可在 1-2 年内产生效果）
   - _需求：3.3_

- [ ] 7. 在 `gameConstants.js` 中添加 AI-AI 战争相关配置常量
   - 在 `AI_WAR_DECISION` 对象中（约 L1120）新增以下常量，将硬编码值提取为可配置参数：
     - `AI_WAR_MAX_DURATION: 1095` — 强制结束战争的天数上限（3年）
     - `AI_WAR_LONG_WAR_THRESHOLD: 365` — 长期战争加速结束的起始天数
     - `AI_WAR_STALEMATE_THRESHOLD: 730` — 僵持战争降低结束阈值的天数
     - `FATIGUE_MIN_DELTA: 0.002` — 疲劳最低增量
     - `OCCUPATION_BASE_THRESHOLD: 2` — occupation score 偏移基础阈值
     - `CHECKPOINT_50_BASE_SCORE: 3` — checkpoint 50 的基础分数
   - _需求：1、2、3（配置化支持）_

- [ ] 8. UI 增强：战争分数显示优化
   - 在 `NationDetailView.jsx` 的战争列表渲染部分（约 L1786），当 `war.score === 0` 且 `duration > 30` 天时，在分数旁显示"僵持"标签（使用灰色 Badge）
   - 在展开的战争详情面板中（约 L2073-2100），确保 `warScoreBreakdown` 的 checkpoint / bonus / occupation 三项分数明细正确显示，并为 occupation 项添加 tooltip 说明其包含持续占领分和消耗分
   - _需求：4.1、4.2、4.3_

- [ ] 9. 兼容性处理：旧存档字段初始化
   - 在 `aiWar.js` 的旧存档容错块中（约 L2000-2010），为新增的 `lastOccupationDay`、`lastAttritionDay`、`checkpointCrossCount` 字段添加初始化逻辑
   - 确保旧存档加载后这些字段有合理的默认值（`lastOccupationDay = warStartDay`、`lastAttritionDay = warStartDay`、`checkpointCrossCount = {}`）
   - _需求：1.1（兼容性）_

- [ ] 10. 构建验证
   - 运行 `npm run build` 确保无编译错误
   - 运行 `npm run lint` 确保无代码风格问题
   - _需求：全部_
