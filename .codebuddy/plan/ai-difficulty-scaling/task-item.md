# 实施计划：AI国家发展水平与难度/玩家发展挂钩

## 修改文件清单

| 文件 | 修改类型 |
|------|----------|
| `src/config/difficulty.js` | 新增配置参数 |
| `src/logic/diplomacy/calculators/AIPopulationDynamics.js` | 增加难度速率调节 + 玩家相对上下限 |
| `src/logic/diplomacy/services/AIDevelopmentService.js` | 增加难度速率调节 + 财富上下限 |
| `src/logic/diplomacy/services/AIEconomyService.js` | 传递玩家财富数据 |
| `src/logic/diplomacy/aiEconomy.js` | 调整目标计算中的玩家影响权重 |
| `src/logic/simulation.js` | 传递玩家人均财富给 AIEconomyService |

---

## 任务列表

- [ ] 1. 在 `difficulty.js` 中新增 AI 发展上下限配置参数
  - 在每个难度级别的 `DIFFICULTY_CONFIG` 中新增以下字段：
    - `aiPopulationCapMultiplier`：AI人口相对于玩家人口的上限倍数（和平0.8→地狱10.0）
    - `aiPopulationFloorMultiplier`：AI人口相对于玩家人口的下限倍数（和平0.15→地狱0.8）
    - `aiWealthCapMultiplier`：AI人均财富相对于玩家人均财富的上限倍数（和平0.8→地狱6.0）
    - `aiWealthFloorMultiplier`：AI人均财富相对于玩家人均财富的下限倍数（和平0.15→地狱0.7）
    - `aiGrowthRateMultiplier`：AI基础增长率的难度乘数（和平0.6→地狱2.0），与现有 `aiDevelopmentMultiplier` 区分，后者影响目标值，此参数影响实际增长速率
  - 新增对应的 getter 函数：`getAIPopulationCapMultiplier(difficulty)`、`getAIPopulationFloorMultiplier(difficulty)` 等
  - 所有 getter 函数使用 `getDifficultyConfig` 并提供普通难度的默认值作为 fallback
  - _需求：5.1、5.2、5.3_

- [ ] 2. 在 `simulation.js` 中计算并传递玩家人均财富给 `AIEconomyService.update`
  - 在调用 `AIEconomyService.update` 的位置（约 line 6093），新增 `playerPerCapitaWealth` 参数
  - 计算方式：`playerWealthBaseline / Math.max(1, playerPopulationBaseline)`（复用已有的 `playerPopulationBaseline` 和 `playerWealthBaseline`）
  - _需求：2.1、3.1_

- [ ] 3. 在 `AIEconomyService.update` 中接收并传递 `playerPerCapitaWealth` 给 `AIDevelopmentService.update`
  - 在 `AIEconomyService.update` 的参数列表中新增 `playerPerCapitaWealth = 0`
  - 将其透传给 `AIDevelopmentService.update` 调用
  - _需求：2.1、3.1_

- [ ] 4. 在 `AIPopulationDynamics.js` 中实现难度驱动的增长率调节和玩家相对人口上下限
  - 修改 `calculateAIPopulationDynamics` 函数：
    - **增长率调节**：将 `baseGrowthRate` 乘以 `aiGrowthRateMultiplier`（从 difficulty config 获取），并 clamp 在 `[0.5x, 2.0x]` 范围内（需求 1.4、1.5）
    - **人口上限软约束**：新增参数 `playerPopulationForCap`（即玩家人口），计算 `popCapThreshold = playerPopulation × aiPopulationCapMultiplier`。当 AI 人口超过 `popCapThreshold × 0.8` 时，对 `netGrowthRate` 施加递减惩罚（线性插值从 1.0 到 0.0），实现软上限（需求 2.2、2.3）
    - **人口下限追赶加成**：计算 `popFloorThreshold = playerPopulation × aiPopulationFloorMultiplier`。当 AI 人口低于 `popFloorThreshold` 时，对 `baseGrowthRate` 施加追赶加成（最高 3x），加成随差距增大而增强，随接近下限而平滑消退（需求 3.2、3.3、3.4）
    - **战时独立**：追赶加成不抵消战时惩罚（`warFactor` 和 `warCasualtyRate` 独立计算后再叠加追赶加成）（需求 4.3）
  - 新增参数：`difficulty`（字符串），用于从 difficulty config 获取上下限倍数
  - _需求：1.1、1.2、1.3、1.4、1.5、2.2、2.3、3.2、3.3、3.4、4.3_

- [ ] 5. 在 `AIDevelopmentService.js` 中实现难度驱动的财富增长调节和玩家相对财富上下限
  - 修改 `AIDevelopmentService.update` 方法：
    - 新增参数 `playerPerCapitaWealth = 0`
    - **subsistence income 调节**：将 `subsistenceIncome` 乘以 `aiGrowthRateMultiplier`（clamp 在 0.5~2.0），使低难度下保底收入更低、高难度下更高（需求 1.3）
    - **财富上限软约束**：计算 AI 当前人均财富 `aiPerCapitaWealth = state.wealth / population`，计算 `wealthCapThreshold = playerPerCapitaWealth × aiWealthCapMultiplier`。当 `aiPerCapitaWealth > wealthCapThreshold × 0.8` 时，对 `effectiveSavingsFlow` 施加递减惩罚（线性插值从 1.0 到 0.1），实现软上限（需求 2.1、2.3）
    - **财富下限追赶加成**：计算 `wealthFloorThreshold = playerPerCapitaWealth × aiWealthFloorMultiplier`。当 `aiPerCapitaWealth < wealthFloorThreshold` 时，对 `subsistenceIncome` 施加追赶加成（最高 3x），加成随差距增大而增强（需求 3.1、3.3、3.4）
    - **战时独立**：追赶加成在战时不生效（`nation.isAtWar` 时跳过追赶加成）（需求 4.3）
  - 将 `difficulty` 字符串传递给 `calculateAIPopulationDynamics` 调用（用于任务 4 中的人口上下限）
  - _需求：1.3、2.1、2.3、2.4、3.1、3.3、3.4、4.3_

- [ ] 6. 在 `aiEconomy.js` 的 `updateAIDevelopment` 中提高玩家影响权重
  - 修改 `getAIPlayerInfluenceFactor` 函数：将基础权重从 `0.12` 提高到 `0.25`，范围从 `[0.10, 0.20]` 调整为 `[0.20, 0.40]`，使 AI 发展目标更紧密跟随玩家发展水平
  - 同步修改 `AIPopulationDynamics.js` 中的 `getPlayerReferenceWeight` 函数（与 `getAIPlayerInfluenceFactor` 保持一致的权重范围）
  - _需求：2.4、3.4_

- [ ] 7. 保持 AI 国家间差异性验证
  - 确认 `foreignPower` 的 `populationFactor`、`wealthFactor`、`volatility` 在上下限计算中被保留（不被覆盖）
  - 在 `AIPopulationDynamics.js` 的人口上下限计算中，将 `popCapThreshold` 和 `popFloorThreshold` 乘以 `nation.foreignPower.populationFactor`（如果存在），使不同国家有不同的上下限
  - 在 `AIDevelopmentService.js` 的财富上下限计算中，将 `wealthCapThreshold` 和 `wealthFloorThreshold` 乘以 `nation.foreignPower.wealthFactor`（如果存在），使不同国家有不同的上下限
  - _需求：4.1、4.2_

- [ ] 8. 旧存档兼容性处理
  - 在 `AIEconomyService._normalizeLegacyOutliers` 中：当 AI 人口远超新的玩家相对上限时，使用现有的 `maxDrop`（最多 10%/tick）机制平滑衰减，不做额外修改（已满足需求 6.3）
  - 确认所有新增的 difficulty config 参数都有合理的 fallback 默认值（普通难度的值），确保旧存档不会因缺少参数而报错
  - 在 `AIDevelopmentService.update` 中：当 `playerPerCapitaWealth <= 0`（旧存档可能未传递）时，跳过上下限逻辑，使用原有的增长机制
  - _需求：6.1、6.2、6.3_

- [ ] 9. 构建验证
  - 运行 `npm run build` 确保无编译错误
  - 检查所有新增的 import 路径正确
  - 确认无循环依赖引入
  - _需求：全部_
