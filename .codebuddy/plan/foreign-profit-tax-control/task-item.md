# 实施计划：外资利润税控制（含逐国覆盖）

> 基于已实现的全局税率控制功能，本计划聚焦三项增量改动：去掉关系影响显示、新增逐国覆盖机制、在外交详情面板增加税率控制入口。

- [ ] 1. 去掉全局税率选择控件中的关系影响显示
   - 文件：`src/components/panels/InternationalEconomyPanel.jsx`（`ForeignCapitalTab` 组件）
   - 移除每个档位按钮中 `relationImpact` 的渲染（当前显示 `+2/月`、`-5/月` 等）
   - 移除非默认政策时底部的关系影响提示条（`⚡ 当前政策：...，关系+X/月`）中的关系部分
   - 保留档位名称和税率百分比的显示
   - _需求：1.2、5.5、7.4_

- [ ] 2. 新增 `foreignInvestmentPolicyOverrides` 状态和对应 action
   - 文件：`src/stores/useDiplomacyStore.js` — 新增 `foreignInvestmentPolicyOverrides: {}` 和 `setForeignInvestmentPolicyOverrides` setter
   - 文件：`src/hooks/useGameState.js` — 新增 `foreignInvestmentPolicyOverrides` state 和 setter（与 `foreignInvestmentPolicy` 相邻）
   - 文件：`src/hooks/useGameActions.js` — 新增 `set_foreign_investment_policy_override` action：接收 `{ nationId, policy }` payload，当 `policy` 为 `null` 或 `'follow_global'` 时从 overrides 中删除该国条目，否则写入
   - 确保旧存档兼容：缺失时默认为 `{}`
   - _需求：2.2、2.3_

- [ ] 3. 修改 `processForeignInvestments` 支持逐国覆盖
   - 文件：`src/logic/diplomacy/overseasInvestment.js`（`processForeignInvestments` 函数）
   - 新增参数 `foreignInvestmentPolicyOverrides = {}`
   - 在遍历每笔投资时，根据 `inv.ownerNationId` 查找逐国覆盖：`overrides[nationId] || foreignInvestmentPolicy`，获取对应的 `policyConfig`
   - 将当前的全局 `policyConfig` 查找逻辑改为逐投资的有效 `policyConfig` 查找
   - 在 `relationChanges` 返回中，每个国家使用各自有效档位的 `relationImpact`
   - _需求：4.2、4.3、5.2_

- [ ] 4. 修改 `simulation.js` 传递 `foreignInvestmentPolicyOverrides` 到 `processForeignInvestments`
   - 文件：`src/logic/simulation.js`（调用 `processForeignInvestments` 的位置）
   - 在调用参数中新增 `foreignInvestmentPolicyOverrides`
   - 确保从 state 中正确读取该值
   - _需求：4.2_

- [ ] 5. 修改AI投资决策逻辑支持逐国覆盖
   - 文件：`src/logic/diplomacy/autonomousInvestment.js`（`selectInboundInvestmentsBatch` 等函数）和 `src/logic/diplomacy/overseasInvestment.js`（`aiDecideForeignInvestment` 函数）
   - 在评估AI是否投资玩家国时，使用该AI国家的有效税率档位（`overrides[nationId] || globalPolicy`）来获取 `investmentMultiplier`
   - 需要在 `simulation.js` 调用这些函数时传入 `foreignInvestmentPolicyOverrides`
   - _需求：6.1、6.2、6.3_

- [ ] 6. 在外资企业面板的国家分组头部添加逐国税率选择器
   - 文件：`src/components/panels/InternationalEconomyPanel.jsx`（`ForeignCapitalTab` 组件）
   - 在每个国家分组头部（旗帜、国名、资产数旁边）添加一个紧凑的下拉选择器，选项为"跟随全局" + 四个档位
   - 当选择非"跟随全局"时，调用 `onPolicyOverrideChange(nationId, policy)` 回调
   - 有逐国覆盖的国家以不同颜色/标记区分（如覆盖档位名称标签）
   - `ForeignCapitalTab` 需新增 props：`policyOverrides`、`onPolicyOverrideChange`
   - _需求：2.1、2.2、2.3、2.4、7.2_

- [ ] 7. 打通状态传递链路：`useGameState` → `App.jsx` → `DiplomacyTab` → 面板组件
   - 文件：`src/App.jsx` — 将 `foreignInvestmentPolicyOverrides` 和 `setForeignInvestmentPolicyOverrides`（或封装的 action 回调）传递到 `DiplomacyTab`
   - 文件：`src/components/tabs/DiplomacyTab.jsx` — 接收并传递到 `InternationalEconomyPanel` 和 `DiplomacyLayout`
   - 文件：`src/components/panels/InternationalEconomyPanel.jsx` — 接收 `policyOverrides` 和 `onPolicyOverrideChange` 并传递到 `ForeignCapitalTab`
   - 文件：`src/components/diplomacy/DiplomacyLayout.jsx` — 接收并传递到 `NationDetailView`
   - _需求：2.2、3.2、7.3_

- [ ] 8. 在外交详情面板的 `ForeignInvestmentFromNation` 中添加逐国税率选择器
   - 文件：`src/components/diplomacy/NationDetailView.jsx`（`ForeignInvestmentFromNation` 组件）
   - 新增 props：`currentPolicy`（全局默认）、`policyOverride`（该国的覆盖值，可能为 undefined）、`onPolicyOverrideChange`
   - 在"该国在我国的投资"标题行旁添加一个税率档位选择按钮（与外资企业面板中的逐国选择器功能一致）
   - 当该国无投资时不显示选择器（已有空状态处理）
   - `NationDetailView` 需接收并向下传递 `foreignInvestmentPolicy`、`foreignInvestmentPolicyOverrides`、`onPolicyOverrideChange`
   - _需求：3.1、3.2、3.3、3.4、7.3_

- [ ] 9. 提取共享的逐国税率选择器组件（可选优化）
   - 如果任务6和任务8的选择器UI逻辑高度重复，提取为一个共享的 `ForeignTaxPolicySelector` 组件
   - 接收 props：`nationId`、`currentOverride`（当前覆盖值或 null）、`globalPolicy`、`onChange`
   - 渲染"跟随全局（当前：XX%）" + 四个档位选项
   - 在 `InternationalEconomyPanel.jsx` 和 `NationDetailView.jsx` 中复用
   - _需求：7.3_

- [ ] 10. 构建验证与端到端检查
   - 运行 `npm run build` 确保无编译错误
   - 验证状态传递完整性：全局政策变更 → 未覆盖国家生效、覆盖国家不受影响
   - 验证两个入口（外资企业面板、外交详情面板）修改同一国家的覆盖后状态同步
   - 验证旧存档兼容性：`foreignInvestmentPolicyOverrides` 缺失时默认为 `{}`
   - _需求：1.4、2.4、3.2、7.3_
