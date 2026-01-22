# civ-game 当前上下文

## 当前状态
- **阶段**: 附庸系统调试
- **进度**: 附庸独立倾向单轨模型已接入主模拟循环；满意度日更接入；控制手段持久化修复；独立战争上限触发修复；自治度系统已移除
- **下一步**: 完成实际验收（独立倾向日变化、独立战争触发、控制手段持久化、附庸满意度变动）

## 需求背景与用户反馈
- 独立倾向只在政策调整时变化，没有日升/日降
- 独立倾向满值未触发独立战争
- 控制手段切换Tab后回退
- 附庸阶层满意度变化不可见
- 自治度被认为无价值，要求移除其影响

## 已完成改动（核心逻辑）
1) **独立倾向日更新接入主循环**
   - 在 `src/logic/simulation.js` 中加入：
     - 对附庸执行 `initializeNationEconomyData` + `updateNationEconomyData`（保证阶层满意度可日更新）
     - 调用 `processVassalUpdates`，将独立倾向/朝贡/控制成本融入日循环
     - 将朝贡收入与控制成本写入银币收支
     - 记录独立战争事件日志

2) **独立倾向模型单轨化 & 日衰减**
   - `src/config/diplomacy.js`：新增 `INDEPENDENCE_MODEL_CONFIG`（baseRate=0.005, dailyDecay=0.005）
   - `src/logic/diplomacy/vassalSystem.js`：
     - `getEnhancedIndependenceGrowthRate` 改为单轨“加法模型”
     - `getIndependenceChangeBreakdown` 与新模型一致

3) **独立战争必触发**
   - `checkIndependenceWarTrigger` 增加“独立倾向达到上限必触发”

4) **满意度算法明确**
   - `src/logic/diplomacy/nations.js`：
     - SoL期望值调整为：精英15/平民6/下层4
     - 新增 `getPolicySatisfactionModifier`，政策对满意度的修正明确
   - `src/config/diplomacy.js`：
     - 新增 `VASSAL_POLICY_SATISFACTION_EFFECTS` 配置

5) **自治度系统移除**
   - UI与逻辑中不再显示/使用自治度
   - 权限与朝贡不再依赖自治度

6) **控制手段持久化**
   - `src/components/panels/VassalManagementSheet.jsx`：
     - 增加“切换Tab前提交”的兜底逻辑，避免控制手段回退

## 仍需验证/可能问题
- **独立倾向未变化**：需确认 `simulateTick` 是否在实际运行路径中使用更新后的 `processVassalUpdates`（已接入，但需实机验证）
- **满意度可见性**：附庸满意度来源于 `updateNationEconomyData`，UI需确认引用的 `nation.socialStructure` 是否为最新
- **控制成本入账**：控制成本已写入 `vassal_control_cost`，需在UI确认账目变化
- **朝贡显示**：朝贡改为每日结算，需验证财政面板与附庸面板日朝贡一致

## 关键文件（本次修改）
- `src/logic/simulation.js`：接入附庸日更新与朝贡/控制成本结算
- `src/logic/diplomacy/vassalSystem.js`：单轨独立倾向模型 + 上限触发独立战争
- `src/logic/diplomacy/nations.js`：附庸满意度算法与政策修正
- `src/config/diplomacy.js`：新增独立倾向模型配置与满意度政策表
- `src/components/panels/VassalManagementSheet.jsx`：控制手段持久化修复与自治度UI移除
- `src/components/modals/VassalPolicyModal.jsx`：移除自治度调整
- `docs/QA_TEST_CASES.md`：新增附庸相关测试用例
- `docs/CHANGELOG.md`：记录本次变更

## 待决策事项
- 是否补充“外交权限（宣战/条约/关税）”在政策中的明确展示

## 未完成事项
- 未运行任何测试
- 未提交 Git（本机未配置 user.name/user.email）

## Git 状态备注
- 变更未提交；提交因缺少 git 用户信息失败
- 需先执行：
  - `git config user.name "Your Name"`
  - `git config user.email "you@example.com"`


---
*最后更新: 2026-01-21*
