# Diplomacy Expansion Summary and Plan (Rechecked)

> 本文已严格按你最新的阶段定义重新核对与重写。

## 0. 当前完成度总览（按阶段）

- 阶段1（基础骨架）：部分完成
- 阶段2（条约体系）：已完成
- 阶段3（国际组织）：部分完成
- 阶段4（多轮谈判）：已完成
- 阶段5（附庸/保护国/殖民地）：已完成
- 阶段6（海外建筑）：已完成
- 阶段7（AI与事件补齐）：已完成
- 阶段8（UI与体验收尾）：大部分完成

---

## 1. 阶段1：基础骨架

### 目标
- 新增外交扩展配置与常量：`gameConstants.js`, `gameData.js`, `index.js`
- 新增/扩展数据结构定义：`nations.js`, `index.js`
- 加入时代解锁门控与工具函数：`epochs.js`, `src/utils/*`

### 已完成
- `src/config/diplomacy.js`：加入 `DIPLOMACY_ERA_UNLOCK`、条约/组织相关常量与工具函数。
- `src/config/index.js`、`src/config/gameData.js`：已导出外交新增配置与常量。
- `src/hooks/useGameState.js`：扩展国家初始结构（条约字段、组织成员、附庸字段）。

### 未完成
- `gameConstants.js`/`epochs.js` 内的统一门控工具是否还需集中整理（目前门控函数散在 `src/config/diplomacy.js`）。

---

## 2. 阶段2：条约体系

### 目标
- 条约类型与期限配置：`src/config/*`
- 条约签订/到期/违约处理：`aiDiplomacy.js`, `nations.js`
- UI灰化与提示：`DiplomacyTab.jsx`

### 已完成
- `src/config/diplomacy.js`：条约类型、期限、违约惩罚配置。
- `src/logic/simulation.js`：条约维护与到期处理。
- `src/logic/diplomacy/nations.js`：AI 在极端关系下撕毁和平条约并触发惩罚与日志。
- `src/logic/diplomacy/aiDiplomacy.js`：AI-玩家维度的和平条约违约触发与惩罚日志。
- `src/config/events/diplomaticEvents.js` / `src/hooks/useGameLoop.js`：条约撕毁事件弹窗与日志解析。
- `src/components/tabs/DiplomacyTab.jsx`：条约相关 UI 的解锁提示已接入。
- **新增**：历史条约记录组件 `TreatyHistory`（在 `DiplomacyStatsPanel.jsx` 中）
  - 正常到期条约统计
  - 违约记录展示（区分我方/对方违约）
  - 近期到期条约列表

### 未完成
- 无

---

## 3. 阶段3：国际组织（经济共同体/自贸区）

### 目标
- 组织数据结构与成员管理：`index.js`
- 经济加成与关税联动：`src/logic/economy/*`, `src/logic/diplomacy/*`
- UI入口与成员列表：`DiplomacyTab.jsx`, `src/components/panels/*`

### 已完成
- 组织结构与成员管理已接入 `useGameActions.js`。
- 关税折扣已接入贸易：
  - 玩家贸易（`useGameLoop.js` / `aiDiplomacy.js`）
  - AI-AI 贸易（`aiDiplomacy.js`）
- `DiplomacyTab.jsx` 增加组织入口与成员列表展示。

### 未完成
- 组织在 AI 决策层面的影响较浅（仅贸易层面）。
- 经济逻辑层（`src/logic/economy/*`）尚未出现组织加成的统一入口。

---

## 4. 阶段4：多轮谈判

### 目标
- 谈判轮次与接受率逻辑：`aiDiplomacy.js`
- 筹码系统（资金/资源/时长/军事担保）：`src/logic/diplomacy/*`, `src/logic/economy/*`
- UI对话框：`src/components/modals/*`

### 状态
已完成。

### 已完成
- 新增谈判评估与反提案逻辑：`src/logic/diplomacy/negotiation.js`。
- 接入多轮谈判行动与条约签署落地：`src/hooks/useGameActions.js`。
- 外交谈判入口与模态框：`src/components/tabs/DiplomacyTab.jsx`。
- 修复外交页乱码与字符串损坏，恢复历史中文文案：`src/components/tabs/DiplomacyTab.jsx`。

---

## 5. 阶段5：附庸/保护国/殖民地

### 目标
- 关系层级与自治/贡赋/独立倾向：`nations.js`
- 事件与反抗触发：`src/config/events/*`, `rebellionSystem.js`
- UI展示：`DiplomacyTab.jsx`

### 状态
已完成。

### 已完成
- 附庸系统配置：`src/config/diplomacy.js`
  - 新增 `VASSAL_TYPE_CONFIGS`：保护国/朝贡国/傀儡国/殖民地配置
  - 新增 `calculateIndependenceDesire`：独立倾向计算函数
  - 新增 `calculateTribute`：朝贡金额计算函数
  - 新增 `INDEPENDENCE_WAR_CONDITIONS`：独立战争触发条件
  - 新增 `VASSAL_TRANSITION_REQUIREMENTS`：附庸转换要求
- 附庸系统核心逻辑：`src/logic/diplomacy/vassalSystem.js`
  - `processVassalUpdates`：每日附庸更新（朝贡结算、独立倾向、独立战争检测）
  - `establishVassalRelation`：建立附庸关系
  - `releaseVassal`：释放附庸
  - `adjustVassalPolicy`：调整附庸政策（支持外交控制、贸易政策、自主度、朝贡率）
  - `canEstablishVassal`：检查是否可建立附庸
  - `getPlayerVassals`：获取玩家所有附庸
  - `calculateVassalBenefits`：计算附庸系统收益
- 附庸系统集成：`src/logic/diplomacy/nations.js`
  - `updateNations` 集成附庸处理
  - 附庸国不会对玩家宣战（由独立战争系统处理）
  - 朝贡收入自动结算到国库（`vassalTributeIncome`）
- 外交行动支持：`src/hooks/useGameActions.js`
  - `establish_vassal`：建立附庸关系
  - `release_vassal`：释放附庸
  - `adjust_vassal_policy`：调整附庸政策
- UI 展示：`src/components/tabs/DiplomacyTab.jsx`
  - 附庸状态面板（自主度、朝贡率、独立倾向、预计朝贡）
  - 国家列表附庸标签
  - 战争状态下可要求成为附庸（基于战争分数）
  - **新增**：调整政策按钮，打开附庸政策调整模态框
- **新增**：附庸政策调整模态框：`src/components/modals/VassalPolicyModal.jsx`
  - 外交控制选项（自主外交/引导外交/傀儡外交）
  - 贸易政策选项（自由贸易/优惠准入/垄断贸易）
  - 自主度滑动条调整（显示权限变化）
  - 朝贡率滑动条调整（显示预计收入）
  - 预估影响面板（独立倾向变化、月朝贡预估）
- 独立战争事件：`src/config/events/diplomaticEvents.js`
  - `createIndependenceWarEvent`：独立战争事件弹窗（镇压/谈判/释放三选项）
  - `createVassalAutonomyRequestEvent`：附庸请求提高自主度事件
  - `createVassalRequestEvent`：AI请求成为附庸事件
- 独立战争处理：`src/hooks/useGameLoop.js`
  - `VASSAL_INDEPENDENCE_WAR` 日志解析与事件触发
  - 镇压/谈判/释放三种处理逻辑

### 未完成
- AI 附庸决策逻辑完善（主动请求成为附庸的触发条件）
- 附庸国叛乱与现有叛乱系统联动

---

## 6. 阶段6：海外建筑（海外投资系统）

### 目标
- 最小记录结构与收益归属：`src/logic/buildings/*`, `src/logic/economy/*`
- 外资策略切换与影响：`src/components/modals/*`, `src/components/panels/*`

### 状态
已完成。

### 已完成
- 海外投资系统核心逻辑：`src/logic/diplomacy/overseasInvestment.js`
  - `OVERSEAS_INVESTMENT_CONFIGS`：投资配置（限制、运营模式、收益率、利润汇回率）
  - `INVESTABLE_BUILDINGS`：各阶层可投资的建筑类型
  - `createOverseasInvestment`：创建海外投资记录
  - `createForeignInvestment`：创建外资建筑记录
  - `canEstablishOverseasInvestment`：检查投资条件
  - `calculateLocalModeProfit`：计算当地运营模式利润
  - `calculateDumpingModeProfit`：计算倾销模式利润
  - `calculateBuybackModeProfit`：计算回购模式利润
  - `processOverseasInvestments`：处理每日海外投资更新
  - `establishOverseasInvestment`：建立新的海外投资
  - `nationalizeInvestment`：国有化外资建筑
  - `calculateOverseasInvestmentSummary`：计算投资总收益
- 游戏状态扩展：`src/hooks/useGameState.js`
  - 新增 `overseasInvestments` 状态：玩家在附庸国的投资
  - 新增 `foreignInvestments` 状态：外国在玩家国的投资
  - 保存/加载支持
- 外交行动支持：`src/hooks/useGameActions.js`
  - `establish_overseas_investment`：建立海外投资
  - `withdraw_overseas_investment`：撤回投资
  - `change_investment_mode`：切换运营模式
  - `nationalize_foreign_investment`：国有化外资
- 海外投资每日结算：`src/hooks/useGameLoop.js`
  - 集成 `processOverseasInvestments` 到每日更新循环
  - 利润自动汇入各阶层财富
  - 投资相关日志输出
- 海外投资 UI 面板：`src/components/tabs/DiplomacyTab.jsx`
  - 在附庸管理区域显示海外投资面板
  - 显示投资列表、月利润、运营模式
  - 支持撤回投资操作
  - 支持新建投资（按阶层财富筛选可投资建筑）
- App.jsx 集成
  - 传递 `overseasInvestments` 和 `classWealth` 给 DiplomacyTab
- AI 投资决策逻辑：`src/logic/diplomacy/aiDiplomacy.js`
  - `makeAIInvestmentDecision`：单国投资决策评估
  - `processAIInvestmentSuggestions`：批量处理投资建议
  - 根据阶层财富、附庸自主度、市场价格智能选择投资策略

---

## 7. 阶段7：AI与事件补齐

### 目标
- AI外交策略：`aiDiplomacy.js`, `aiEconomy.js`
- 事件补充：`src/config/events/*`

### 状态
已完成。

### 已完成
- `aiDiplomacy.js` 已接入组织贸易加成逻辑。
- AI 海外投资决策逻辑：
  - `makeAIInvestmentDecision`：单国投资决策评估
  - `processAIInvestmentSuggestions`：批量处理投资建议
- 外交事件补齐：`src/config/events/diplomaticEvents.js`
  - `createOverseasInvestmentOpportunityEvent`：海外投资机会事件
  - `createNationalizationThreatEvent`：外资国有化威胁事件
  - `createTradeDisputeEvent`：国际贸易争端事件
  - `createMilitaryAllianceInviteEvent`：军事同盟邀请事件
  - `createBorderIncidentEvent`：边境冲突事件
  - `createVassalRequestEvent`：附庸请求事件
- 事件导出配置更新：`src/config/events/index.js`
  - 新增所有外交事件的导入和导出
- 事件触发逻辑集成到游戏循环：`src/hooks/useGameLoop.js`
  - `OVERSEAS_INVESTMENT_OPPORTUNITY`：海外投资机会日志解析与事件触发
  - `NATIONALIZATION_THREAT`：外资国有化威胁日志解析与事件触发
  - `TRADE_DISPUTE`：贸易争端日志解析与事件触发
  - `MILITARY_ALLIANCE_INVITE`：军事同盟邀请日志解析与事件触发
  - `BORDER_INCIDENT`：边境冲突日志解析与事件触发
  - `VASSAL_REQUEST`：附庸请求日志解析与事件触发

---

## 8. 阶段8：UI与体验收尾

### 目标
- 统计/提示/可视化与动效：`src/components/common/*`, `src/components/panels/*`
- 文案与提示统一：`effectFormatter.js`

### 状态
大部分完成。

### 已完成
- 文案格式化工具：`src/utils/effectFormatter.js`
  - `getRelationDescription`：关系等级描述（敌对/不友好/中立/友好/同盟）
  - `getVassalTypeDescription`：附庸类型描述（保护国/朝贡国/傀儡国/殖民地）
  - `formatDiplomaticActionResult`：外交行动结果格式化
  - `formatIndependenceDesire`：独立倾向显示格式化
  - `formatTradeProfit`：贸易利润格式化
  - `formatTributeAmount`：朝贡金额格式化
  - `formatTreatyDuration`：条约剩余时间格式化
- 海外投资UI面板已集成到DiplomacyTab
- 附庸状态面板已集成到DiplomacyTab
- 外交统计面板：`src/components/panels/DiplomacyStatsPanel.jsx`
  - `RelationDistribution`：外交关系分布统计（含可视化进度条）
  - `ActiveTreatiesStats`：活跃条约统计（按类型统计、即将到期提醒）
  - `TradeStats`：贸易统计（活跃路线、贸易伙伴、进出口分布）
  - `TreatyHistory`：历史条约记录（正常到期、违约记录、近期到期）
  - `VassalStats`：附庸统计（按类型统计、高独立倾向警告）
  - `InvestmentStats`：海外投资统计（投资总额、月利润、按国家分布）
  - 可折叠面板设计，支持展开/收起
- 外交统计面板已集成到 `DiplomacyTab.jsx`（桌面端）

### 未完成
- 更丰富的可视化图表（如趋势图）
- 动效优化（过渡动画）
