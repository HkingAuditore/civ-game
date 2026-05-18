# 实施计划：投资结算切片优化

## 涉及文件

| 文件 | 角色 |
|------|------|
| `src/logic/utils/performanceUtils.js` | 配置：`RATE_LIMIT_CONFIG` 新增切片数配置 |
| `src/logic/simulation.js` | 主循环：改造海外资产/外资企业结算的调用方式 |
| `src/logic/diplomacy/overseasInvestment.js` | 核心：`processOverseasInvestments` / `processForeignInvestments` 函数签名和内部逻辑 |

---

## 任务清单

- [ ] 1. 在 `RATE_LIMIT_CONFIG` 中新增切片配置项
   - 在 `src/logic/utils/performanceUtils.js` 的 `RATE_LIMIT_CONFIG` 对象中新增：
     - `foreignInvestmentSlices: 5` — 外资企业切片数
     - `overseasInvestmentSlices: 5` — 海外资产切片数
   - 保留原有的 `foreignInvestmentFrequency: 20` 和 `overseasInvestmentFrequency: 20`（升级逻辑仍需使用）
   - _需求：6.1、6.2_

- [ ] 2. 改造海外资产结算：从频率守卫改为切片轮转
   - 修改 `src/logic/simulation.js` 中海外资产结算部分（约 L941 附近）：
     - 移除 `shouldSettleOverseasInvestment` 守卫条件，改为每 tick 都执行
     - 使用 `getSlice(overseasInvestments, oiSlices)` 获取当前 tick 的切片
     - 将 `ticksElapsed` 参数从 `overseasInvestmentFreq`（20）改为 `oiSlices`（切片数）
     - 当切片数 ≤ 1 或投资数量少于切片数时，自动退化为全量结算（`ticksElapsed = 1`）
   - 确保以下所有经济效应都基于切片后的投资列表正确处理：
     - `profitByStratum` → `wealth[stratum]` 更新
     - `costsByStratum` → `classFinancialData[stratum]` 更新
     - `tariffRevenue` / `tariffSubsidy` → `applySilverChange`
     - `playerInventoryChanges` → `applyResourceChange`
     - `marketChanges` → `nation.inventory` 更新
     - `nationInvestmentEffects` → `nation._investmentEffects` 更新
   - _需求：2.1、2.2、2.3、2.4、2.5_

- [ ] 3. 改造外资企业结算：从频率守卫改为切片轮转
   - 修改 `src/logic/simulation.js` 中外资企业结算部分（约 L8593 附近）：
     - 移除 `shouldSettleForeignInvestment` 守卫条件，改为每 tick 都执行
     - 使用 `getSlice(updatedForeignInvestments, fiSlices)` 获取当前 tick 的切片
     - 将 `ticksElapsed` 参数从 `foreignInvestmentFreq`（20）改为 `fiSlices`（切片数）
     - 当切片数 ≤ 1 或投资数量少于切片数时，自动退化为全量结算（`ticksElapsed = 1`）
   - 确保以下所有经济效应都基于切片后的投资列表正确处理：
     - `taxRevenue` → `applySilverChange(_, 'foreign_investment_tax')`
     - `tariffRevenue` / `tariffSubsidy` → `applySilverChange`
     - `marketChanges` → `applyResourceChange`
     - `profitOutflow`（记录值）
   - _需求：1.1、1.2、1.3、1.4、1.5_

- [ ] 4. 确认外资企业 `marketChanges` 的 `ticksElapsed` 缩放行为
   - 阅读 `src/logic/diplomacy/overseasInvestment.js` 中 `processForeignInvestments` 的 `marketChanges` 计算逻辑
   - 确认 `marketChanges` 的 delta 当前是否乘了 `ticksElapsed`：
     - 如果**未乘**（只乘了 count）：切片化后无需额外处理，但需在代码注释中说明原因
     - 如果**已乘**：切片化后 `ticksElapsed` 从 20 改为 5 会自动缩放，无需额外处理
   - 对比海外资产的 `scaledOutput`/`scaledInput`（已确认乘了 `ticksElapsed`），确保两者行为一致或差异有合理解释
   - _需求：1.3、1.4（注意事项）_

- [ ] 5. 保持升级逻辑低频独立执行
   - 确认 `processOverseasInvestmentUpgrades`（约 L1025）仍使用 `shouldSettleOverseasInvestment` 守卫
   - 确认 `processForeignInvestmentUpgrades`（约 L8644）仍使用 `shouldSettleForeignInvestment` 守卫
   - 由于利润结算已移除频率守卫，需要为升级逻辑**单独保留或新建**频率守卫变量（如 `shouldUpgradeOverseasInvestment`），使用原有的 `overseasInvestmentFrequency: 20` / `foreignInvestmentFrequency: 20`
   - 升级逻辑的 `ticksElapsed` 参数（如有）保持原有频率值不变
   - _需求：3.1、3.2_

- [ ] 6. 处理切片边界：投资列表变化时的适配
   - `getSlice()` 基于 `tick % slices` 计算切片索引，当投资列表长度变化时（新增/移除/国家吞并转移），下一个 tick 的切片自动重新分配
   - 验证 `getSlice()` 在以下边界情况下的行为：
     - 投资列表为空 → 返回空数组，不执行结算
     - 投资列表长度 < 切片数 → 返回完整列表（已由 `getSlice` 内部 `list.length <= slices` 处理）
     - 投资列表在轮转周期中途变化 → 部分投资可能在本周期被跳过或重复结算（可接受，与贸易切片行为一致）
   - _需求：1.5、1.6、2.5_

- [ ] 7. 清理废弃的频率守卫变量
   - 移除或重命名 `shouldSettleOverseasInvestment` 和 `shouldSettleForeignInvestment` 变量（利润结算不再需要）
   - 如果升级逻辑复用了这些变量，则保留但重命名为 `shouldUpgradeOverseasInvestment` / `shouldUpgradeForeignInvestment`，使语义更清晰
   - 更新相关注释，说明利润结算已改为切片轮转模式
   - _需求：1.1、2.1、3.1_

- [ ] 8. 数值一致性验证
   - 在浏览器控制台中进行手动验证：
     - 记录改造前 20 tick 的外资税收总额 A
     - 改造后运行 20 tick，记录外资税收总额 B
     - 验证 A ≈ B（允许浮点误差）
   - 同样验证海外资产的阶层财富变化总量
   - 验证财政面板（`StatusBar.jsx`）每天都能显示 `外资税收` 条目
   - _需求：1.4、2.4、4.1、5.1、5.2_

- [ ] 9. 性能验证
   - 确认切片化后单 tick 的投资处理数量 ≈ 总数 / 切片数
   - 确认不再有"20 tick 空转 + 1 tick 爆发"的脉冲式计算
   - 确认 `getDynamicFrequency` 机制仍可用于升级逻辑的动态频率调整
   - _需求：4.1、4.2、4.3_
