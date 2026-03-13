# Civ-Game v2.0.0 版本更新日志

> **发布日期**：2026-03-13  
> **合并分支**：`MilRemake` → `master`  
> **变更规模**：299 个文件，55,775 行新增，7,547 行删除

---

## 概述

2.0.0 是一次大规模系统性重构与功能扩展版本，核心围绕**军事系统全面重做**展开，同时引入了全新的**理念系统**、**年度报告**、**科技树可视化**等重要功能，并对 AI 经济、状态管理架构进行了深度优化。

---

## 🗡️ 军事系统重做（MilRemake 核心）

### 战线系统（Front System）
- 新增 `src/logic/diplomacy/frontSystem.js`（2000+ 行）：战争触发后自动生成战线，包含资源节点与基础设施
- 战线划分为 **7 个区域**（守方核心区 → 守方经济区 → 守方前沿 → 中立区 → 攻方前沿 → 攻方经济区 → 攻方核心区），5 个检查点控制区域归属
- 战线位置（0–100）动态变化，影响双方经济产出与税收效率
- 新增 `FrontViewPanel.jsx`：战线状态可视化面板，展示区域控制、补给消耗、经济损失

### 军团与将领系统（Corps & General System）
- 新增 `src/logic/diplomacy/corpsSystem.js`（580+ 行）：军团组织管理
- 军团可编组不同兵种，最多 8 支军团
- 将领系统：8 种特质（猛攻/铁壁/疾行/鼓舞/诡诈/百战/辎重/攻城），经验值升级机制（6 级上限）
- 军团任务类型：主攻 / 守备 / 骚扰 / 预备队，影响战斗权重
- 新增 `CorpsManagementPanel.jsx`（720+ 行）：军团管理 UI，支持编组、分配将领、指派战线任务
- 新增 `WarfrontCard.jsx`（170+ 行）：战线卡片组件

### 战斗系统（Battle System）
- 新增 `src/logic/diplomacy/battleSystem.js`（1190+ 行）：完整战斗结算逻辑
- 战斗结果影响战线推进、资源掠夺、建筑损毁、人口损失
- 新增 `ActiveBattlePanel.jsx`（168 行）：实时战斗状态面板

### 战争经济联动（War Economy）
- 新增 `src/logic/diplomacy/warEconomy.js`（1030+ 行）：战争-经济联动核心模块
- 战争对经济的影响体现在：产能下降、资源变动、税收波动
- 支持战争掠夺（`calculateWarPlunder`）、建筑损毁（`calculateWarBuildingDamage`）、人口损失（`calculateWarPopulationLoss`）

### AI 战争逻辑增强
- `src/logic/diplomacy/aiWar.js` 大幅扩展（+1379 行），AI 能够参与战线推进、军团调度

---

## 🧠 理念系统（全新）

### 核心架构
- 新增 `src/config/ideologies.js`（4710 行）：约 50 个理念，覆盖 **8 大分类**：
  - 哲学 / 神学 / 政治 / 经济 / 军事 / 美学 / 科学 / 社会
- 每个理念支持 **3 个等级**，效果随等级递增
- 新增 `src/config/ideologyDsl.js`（326 行）：理念 DSL 规范化引擎
- 新增 `src/config/ideologySynergies.js`（466 行）：理念协同效果配置

### 效果引擎
- 新增 `src/logic/ideology/ideologyEffects.js`（1140+ 行）：理念效果引擎
  - 支持 10 种条件触发类型：阶层关联型、人口比例型、产业链关联型、知识计数型、资源阈值型、建筑计数型、时代关联型、逆向缩放型、互斥惩罚型、递减收益型
  - `converters`：将军事/银币/官员等资源转换为加成
  - `ruleMods`：建筑成本修正、官员加成、税收修正、冷却时间修正等
- 新增 `src/logic/ideology/ideologyScaling.js`（306 行）：数值缩放引擎，解决后期数值量级错位问题
- 新增 `src/logic/ideology/ideologyScoring.js`（111 行）：理念分数计算

### 涌现机制
- 新增 `src/logic/ideology/ideologyEmergence.js`（179 行）：**三选一涌现机制**
  - 理念分数达到阈值时触发，加权随机抽取 3 个候选理念
  - 权重受稀有度、时代匹配、执政联盟影响
- 新增 `src/logic/ideology/ideologySlots.js`（158 行）：理念槽位管理
- 新增 `src/logic/ideology/ideologyEventBus.js`（418 行）：理念事件总线
  - 支持 40+ 种事件类型（建造/升级/科技/战争/贸易/人口/稳定性/外交等）
  - 支持冷却时间、触发上限、条件过滤

### UI 组件
- 新增 `src/components/tabs/IdeologyTab.jsx`（531 行）：理念标签页
- 新增 `src/components/tabs/IdeologyCard.jsx`（1039 行）：理念卡片组件，展示效果详情、等级进度、协同关系
- 新增 `src/components/modals/IdeologyEmergenceModal.jsx`（138 行）：理念涌现三选一弹窗

---

## 📊 年度报告系统（全新）

- 新增 `src/utils/annualReport.js`（841 行）：年度数据快照采集、同比对比、评级计算、导出文本生成
- 新增 `src/components/modals/AnnualReportModal.jsx`（561 行）：年度政府报告弹窗
  - 涵盖经济、人口、工业、军事、资源、科技、社会 7 大板块
  - S/A/B/C/D/F 六档评级系统，带动画效果
  - 支持同比变化指示器（📈/📉）
  - 替换原有的年度节日弹窗（`AnnualFestivalModal.jsx` 已移除）

---

## 🔬 科技树可视化（全新）

- 新增 `src/components/tabs/TechTreeView.jsx`（537 行）：科技树可视化组件
  - 全文明统一从上到下的树形布局，跨时代前置关系连线展示
  - 动态布局参数，适配手机竖屏（最小 320px 宽度）
  - 支持大/中/小三档屏幕尺寸自适应

---

## 🏗️ 建筑与产业链扩展

### 新建筑（30+ 个）
新增覆盖蒸汽时代至信息时代的建筑，包括：
- 军工类：`arms_factory`（军工厂）、`ammo_factory`（弹药厂）、`military_industrial_complex`（军工综合体）、`gun_workshop`（枪械作坊）、`rifle_works`（步枪厂）、`powder_mill`（火药厂）、`armorsmith`（铠甲匠）、`swordsmith`（铸剑坊）
- 能源类：`coal_power_plant`（煤电厂）、`solar_power_plant`（太阳能电站）
- 工业类：`machinery_plant`（机械厂）、`aluminum_smelter`（铝冶炼厂）、`fertilizer_plant`（化肥厂）、`plastics_factory`（塑料厂）、`composites_factory`（复合材料厂）、`wiring_factory`（电线厂）
- 高科技类：`semiconductor_fab`（半导体厂）、`electronics_factory`（电子厂）、`software_company`（软件公司）、`data_center`（数据中心）、`biotech_center`（生物科技中心）、`internet_platform`（互联网平台）
- 资源类：`oil_well`（油井）、`oil_refinery`（炼油厂）、`uranium_mine`（铀矿）、`automated_mine`（自动化矿山）、`rubber_plantation`（橡胶园）、`cotton_plantation`（棉花种植园）
- 民用类：`financial_center`（金融中心）、`broadcast_station`（广播站）、`high_rise_apartment`（高层公寓）、`appliance_factory`（家电厂）、`automobile_factory`（汽车厂）

### 建筑升级扩展
- `src/config/buildingUpgrades.js` 大幅扩展（+822 行），覆盖新建筑的升级路径

### 产业链更新
- `src/config/industryChains.js` 大幅扩展（+863 行），新增现代工业产业链

### 资源图谱系统
- 新增 `src/utils/resourceGraph.js`（663 行）：自动从建筑 I/O 数据构建资源依赖图
  - 替代手动维护的 `INDUSTRY_CHAINS` 方式
  - 支持上游/下游 BFS 遍历，智能识别终端资源

---

## 🌍 外国经济模拟增强

- 新增 `src/logic/diplomacy/foreignEconomy.js`（552 行）：外国经济模拟
  - 基于建筑 I/O 数据自动计算外国劳动力分配、产出、就业结构
  - 支持 4 类劳动力（农业/工人/精英/士兵）和 4 类建筑（采集/工业/民政/军事）

---

## 🏛️ 官员系统增强

- 新增 `src/logic/officials/officialInvestment.js`（493 行）：官员自主投资系统
  - 官员根据阶层偏好（地主/商人/资本家/文人/神职等）自主投资建筑
  - 财务状态系统（满足/不适/挣扎/绝望），影响效果倍率和腐败率
  - 投资冷却机制（90 天投资冷却，60 天升级冷却）
- `OfficialCard.jsx` 大幅重构（+510 行），展示官员投资状态、财务状况

---

## 🗃️ 状态管理架构重构（Zustand Stores）

新增 `src/stores/` 目录，引入 Zustand 分域状态管理：
- `useUIStore.js`：UI 状态
- `useResourceStore.js`：资源状态
- `usePopulationStore.js`：人口状态
- `useBuildingStore.js`：建筑状态
- `useEconomyStore.js`：经济状态
- `useMilitaryStore.js`：军事状态
- `useDiplomacyStore.js`：外交状态
- `usePoliticsStore.js`：政治状态
- `useOfficialStore.js`：官员状态
- `useEventStore.js`：事件状态
- `useTradeStore.js`：贸易状态
- `useStoreSync.js`（327 行）：`useGameState` → Zustand 单向同步层
- `useStoreBridge.js`（67 行）：组件迁移辅助桥接工具
- `storeUtils.js`（357 行）：快照/批量更新工具

---

## 🎨 UI 改进

### 资源详情弹窗重构
- `ResourceDetailModal.jsx` 大幅重构（+1249 行），集成资源图谱可视化，展示上下游产业链

### 外交国家详情增强
- `NationDetailView.jsx` 大幅扩展（+865 行），展示外国经济结构、军事力量、外交关系

### 军事标签页重做
- `MilitaryTab.jsx` 全面重构（+647 行），整合军团管理、战线视图、战斗状态

### 科技标签页增强
- `TechTab.jsx` 大幅扩展（+290 行），集成科技树可视化视图

### 其他 UI 改进
- `StratumDetailSheet.jsx` 重构（+231 行）
- `OfficialDetailModal.jsx` 重构（+911 行）
- `LogPanel.jsx` 改进（+38 行）
- 新增 `src/config/iconMap.js`（95 行）：统一图标映射配置

---

## 🤖 AI 经济系统优化

- `src/logic/diplomacy/services/AIEconomyService.js` 大幅优化（+434 行）
- AI 建筑扩张规划器：按时代设置建筑上限（0代120→7代3200），结合人口和财富动态计算目标建筑数
- `src/logic/diplomacy/config/aiEconomyConfig.js` 更新（+50 行）

---

## 🕹️ 游戏常量与配置更新

- `src/config/gameConstants.js` 大幅扩展（+605 行），新增战争经济（`WAR_ECONOMY`）、军团系统等常量
- `src/config/technologies.js` 大幅扩展（+759 行），新增现代科技树节点
- `src/config/militaryUnits.js` 扩展（+553 行），新增现代兵种
- `src/config/epochs.js` 更新（+62 行），新增蒸汽/电气/原子/信息时代背景图
- `src/config/strata.js` 更新（+100 行）
- `src/config/ownerTypes.js` 更新（+91 行）
- `src/config/systemSynergies.js` 新增（98 行）：系统协同配置

---

## 🐛 Bug 修复（合并后）

- `fix_resource_detail_layout`：修复资源详情弹窗布局问题
- `fix: 修复建筑成本100%减免仍上涨及官员ID碰撞问题`
- `fix: 防止官员被重复雇佣 (BUG#3)`

---

## 📦 依赖更新

- `package.json` 更新，新增相关依赖
- `package-lock.json` 同步更新（+280 行）

---

## 🗑️ 移除内容

- `src/config/festivalEffects.js`（-1115 行）：年度节日效果配置，功能由年度报告系统替代
- `docs/CONTEXT.md`（-331 行）：旧版上下文文档

---

## 新增资源图片

新增 30+ 张建筑图片（`.webp` 格式）及 4 张时代背景图（蒸汽/电气/原子/信息时代）。
