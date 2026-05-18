# 实施计划：军事补兵平衡优化

- [ ] 1. 降低AI战时回填率常量
   - 修改 `src/logic/diplomacy/aiWar.js` 中 `syncAINationMilitary` 函数的回填率参数
   - 战时基础率 `0.15%` → `0.05%`，战时上限 `0.3%` → `0.12%`
   - epochBonus 上限 `0.15%` → `0.05%`，popBonus 上限 `0.1%` → `0.03%`，econBonus 上限 `0.1%` → `0.03%`
   - 和平时期参数保持不变（基础率0.8%，上限1.2%）
   - _需求：1.1, 1.2, 1.5_

- [ ] 2. AI回填消耗wealth经济资源
   - 在 `src/logic/diplomacy/aiWar.js` 的 `syncAINationMilitary` 函数中，回填兵力后扣除对应的wealth
   - 实现 `costPerUnit = 0.5 × (1 + epoch × 0.3)` 公式计算每兵征兵成本
   - 当 `wealth < population × 0.5` 时完全停止回填（安全阈值）
   - 当wealth不足以支付全部回填费用时，按 `floor(wealth / costPerUnit)` 缩减实际回填量
   - 扣除wealth后确保不低于100下限
   - _需求：2.1, 2.2, 2.3, 2.4, 2.5_

- [ ] 3. AI军队伤亡扣减人口 — 摩擦战部分
   - 在 `src/hooks/useGameLoop.js` 中摩擦战（friction）伤亡计算逻辑之后，累计对AI国家造成的总伤亡
   - 使用 `casualtyToPopRatio = 0.8` 将伤亡转换为人口损失
   - 调用现有的 `reducePopulationWithFloor` 或等效逻辑扣减AI人口，最低保留100
   - _需求：3.1, 3.3, 3.4_

- [ ] 4. AI军队伤亡扣减人口 — 会战部分
   - 在 `src/hooks/useGameLoop.js` 中会战（battle）伤亡计算逻辑之后，累计对AI国家造成的总伤亡
   - 同样使用 `casualtyToPopRatio = 0.8` 转换为人口损失
   - 与摩擦战伤亡合并后统一执行一次人口扣减和setNations，避免重复渲染
   - _需求：3.2, 3.4, 3.6_

- [ ] 5. 实现训练吞吐量计算函数
   - 在 `src/hooks/useGameLoop.js` 中新增 `getTrainingThroughput` 函数
   - 统计所有提供 militaryCapacity 的建筑总数量（`militaryBuildingCount`）
   - 实现公式：`trainingThroughput = floor(min(50, baseThroughput × (1 + log2(max(1, count)) × 0.5)))`，其中 `baseThroughput = 5`
   - 当 `militaryBuildingCount = 0` 时返回默认值5
   - _需求：4.1, 4.2, 4.4_

- [ ] 6. 将训练吞吐量集成到训练队列处理逻辑
   - 在 `src/hooks/useGameLoop.js` 训练队列处理区域（waiting→training转换循环）中引入吞吐量限制
   - 每tick开始时计算一次 `trainingThroughput` 并缓存
   - 统计当前正在训练的单位总数（`currentTrainingCount`）
   - 可用训练槽位 = `trainingThroughput - currentTrainingCount`
   - 实际可开始训练数 = `min(remainingPopCapacity可支持数, 可用训练槽位)`
   - 在现有循环中增加计数器，达到吞吐量上限后停止将waiting批次转为training
   - 确保大臣训练速度加成（缩短训练时间）与吞吐量（并行数）独立运作
   - _需求：4.3, 4.5_

- [ ] 7. 军事面板UI显示训练吞吐量信息
   - 在 `src/components/tabs/MilitaryTab.jsx` 训练队列区域添加训练吞吐量显示
   - 展示格式如"训练容量：14/tick"，让玩家了解当前军事建筑带来的训练加速效果
   - 显示当前正在训练数 / 吞吐量上限（如"训练中：8/14"）
   - _需求：4.6_

- [ ] 8. 构建验证与数值校验
   - 运行 `npm run build` 确保无编译错误
   - 核对AI回填数值：300万军队损失50%时，回填应为 ~1800人/tick（上限0.12%）
   - 核对AI回填经济消耗：epoch=3时costPerUnit=0.95，1800人回填消耗~1710 wealth/tick
   - 核对训练吞吐量：10座军事建筑时throughput应为~14
   - 确认摩擦战/会战伤亡正确扣减AI人口（casualtyToPopRatio=0.8）
   - _需求：1, 2, 3, 4 全部_
