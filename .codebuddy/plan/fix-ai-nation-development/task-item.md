# 实施计划：修复外国（AI）国家数值发展系统

## 涉及文件

| 文件 | 角色 |
|------|------|
| `src/logic/diplomacy/services/AIEconomyService.js` | 主入口：population cap、safety clamp、basePopulation 增长逻辑 |
| `src/logic/diplomacy/calculators/AIPopulationDynamics.js` | 增长模型：S 曲线参数、capacityFloor、crowdingFactor |
| `src/logic/diplomacy/services/AIDevelopmentService.js` | 发展服务：调用增长模型、财富计算 |
| `src/logic/diplomacy/models/AIEconomyState.js` | 数据模型：fromLegacyFormat / toLegacyFormat |

---

- [ ] 1. 放宽 `_normalizeLegacyOutliers` 的 hardPopulationCap 阈值
   - 文件：`AIEconomyService.js` → `_normalizeLegacyOutliers` 方法（约 line 378+）
   - 将 `hardPopulationCap` 从 `carryingCapacity * 1.15` 调整为 `carryingCapacity * 1.5`
   - 当人口在 `carryingCapacity` 的 1.5 倍以内时不触发 cap，超过时以平滑方式（每 tick 最多降 10%）拉回
   - 保留 cap 触发时的日志输出
   - _需求：3.1、3.2、3.3_

- [ ] 2. 放宽 `update` 方法中的 safety clamp 限制
   - 文件：`AIEconomyService.js` → `update` 方法（约 line 155-165）
   - 将 `maxPopChange` 从 `beforePop * 0.10` 放宽至 `beforePop * 0.20`
   - 将 `[POP JUMP]` 日志的触发阈值从 `beforePop * 0.1` 调整为 `beforePop * 0.2`
   - _需求：6.1、6.2_

- [ ] 3. 提升 basePopulation 增长速率和上限
   - 文件：`AIEconomyService.js` → `update` 方法（约 line 170-185）
   - 将 `basePopGrowthRate` 从 `0.005`（0.5%）提升至 `0.015`（1.5%）
   - 将 `basePopCeiling` 从 `carryingCapacity * 0.5` 提升至 `carryingCapacity * 0.8`
   - 确保 basePopulation 增长不会导致 carryingCapacity 单周期增长超过 5%（添加增量检查）
   - _需求：2.1、2.2、2.3、2.4_

- [ ] 4. 调整 `AIPopulationDynamics` 的 effectiveCapacityFloor 上限
   - 文件：`AIPopulationDynamics.js`（约 line 82-84）
   - 将 `hardCapacityLimit * 2.5` 调整为 `hardCapacityLimit * 3.5`
   - 这为增长模型提供更大的 capacity 空间，使 capacityRatio 不会过早接近 1.0
   - _需求：4.5_

- [ ] 5. 优化 `AIPopulationDynamics` 的 crowdingFactor 曲线
   - 文件：`AIPopulationDynamics.js`（约 line 107-109）
   - 调整 crowdingFactor 公式使其在 capacityRatio 0.5-0.8 区间仍保持中等增长率
   - 当前公式 `1.08 - capacityRatio * 0.28` 在 ratio=0.8 时已降至 0.856，调整为更平缓的衰减
   - 建议改为 `1.08 - capacityRatio * 0.18`，使 ratio=0.8 时 crowdingFactor ≈ 0.936
   - 确保 capacityRatio > 1.0 时仍产生负增长
   - _需求：4.1、4.2、4.3、4.4、1.1、1.2、1.3_

- [ ] 6. 验证 AIDevelopmentService 的财富和时代升级逻辑
   - 文件：`AIDevelopmentService.js` → `update` 方法
   - 确认财富增长与人口增长同步（人均财富模型正常运作）
   - 确认时代升级条件检查正常触发
   - 确认 `perCapitaWealthCap` 限制仍然有效
   - 如有问题则修复，无问题则跳过
   - _需求：5.1、5.2、5.3_

- [ ] 7. 添加关键调试日志并清理冗余日志
   - 文件：`AIEconomyService.js`、`AIPopulationDynamics.js`
   - 在 `[POP OSCILLATION?]` 日志中增加 `capacityRatio`、`crowdingFactor`、`netGrowthRate` 信息
   - 确保 `[POP CAP]`、`[POP CLAMP]` 日志仅在实际触发时输出
   - 移除或降级不再需要的调试日志（如之前为排查震荡问题添加的临时日志）
   - _需求：3.3、6.2、6.3_

- [ ] 8. 构建验证与回归测试
   - 执行 `npm run build` 确保无编译错误
   - 运行游戏观察 AI 国家在 100+ tick 内的人口变化趋势：应呈现缓慢增长而非停滞
   - 验证不出现人口震荡（连续 tick 间人口不应大幅来回波动）
   - 验证不出现人口爆炸（单个增长周期内人口不应翻倍）
   - _需求：1.6、5.4、6.4、6.5_
