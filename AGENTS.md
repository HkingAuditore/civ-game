# Codex Agents Guide

本文件用于指导自动化编码代理在本仓库内的工作方式与约定。

## 项目概览
- 项目名称：哈耶克的文明：市场经济
- 技术栈：React 19 + Vite + Tailwind CSS
- 主要入口：`src/main.jsx`, `src/App.jsx`
- 游戏与设计文档：`/ai_reports`

## 常用命令
```bash
npm install
npm run dev
npm run build
npm run lint
npm run preview
```

## 目录结构与职责
- `src/components`: UI 组件（含 `common`, `layout`, `game`, `panels`, `modals`, `tabs`），统一导出在 `src/components/index.js`
- `src/logic`: 核心玩法与规则逻辑（`economy`, `population`, `stability`, `buildings`, `diplomacy` 等），统一导出在 `src/logic/index.js`
- `src/utils`: 通用工具与计算（数值计算、格式化、资源处理等）
- `src/hooks`: 自定义 Hooks
- `src/assets`: 静态资源
- `src/workers`: Web Worker 相关代码
- `src/config`: 配置与常量

## 代码约定
- 优先遵循现有结构：玩法逻辑放在 `src/logic`，通用计算放在 `src/utils`。
- UI 以组件化拆分，尽量保持组件单一职责。
- 使用 Tailwind CSS class 作为主要样式组织方式；除非必要，避免使用 `style` 内联样式。
- JS/JSX 使用 4 空格缩进与分号结尾；导出以 `export const`/`export function` 为主。
- 注释多为中文，保留现有叙述风格；复杂逻辑前可用简短说明。
- 组件文件多为 `.jsx`，命名与导入风格保持现有一致（组件名首字母大写、工具函数驼峰）。

## src 逐文件概览
### 根目录
- `src/main.jsx`: 应用入口与根挂载点。
- `src/App.jsx`: 根组件与核心页面结构。
- `src/App.css`: App 级样式（若存在特殊覆盖）。
- `src/index.css`: 全局样式与 Tailwind 基础配置扩展。
- `src/App.test.jsx`: 基础测试占位/示例（当前未启用测试脚本）。

### hooks
- `src/hooks/index.js`: hooks 统一导出。
- `src/hooks/cheatCodes.js`: 作弊码相关逻辑。
- `src/hooks/useAchievements.js`: 成就系统状态与触发逻辑。
- `src/hooks/useDevicePerformance.js`: 设备性能检测与降级策略。
- `src/hooks/useEpicTheme.js`: 史诗主题/视觉风格切换。
- `src/hooks/useGameActions.js`: 游戏操作封装与快捷调用。
- `src/hooks/useGameLoop.js`: 主循环与 tick 逻辑驱动。
- `src/hooks/useGameState.js`: 全局游戏状态管理。
- `src/hooks/useNumberAnimation.js`: 数值滚动/动画工具。
- `src/hooks/useSimulationWorker.js`: 连接 Web Worker 的模拟计算。
- `src/hooks/useSound.js`: 音效管理与播放控制。
- `src/hooks/useViewportHeight.js`: 视口高度适配（移动端）。

### utils
- `src/utils/assetPath.js`: 资源路径拼装与兼容处理。
- `src/utils/buildingUpgradeUtils.js`: 建筑升级计算辅助。
- `src/utils/calendar.js`: 时间与日历相关工具。
- `src/utils/debugFlags.js`: 调试标志与开关。
- `src/utils/diplomaticUtils.js`: 外交相关工具函数。
- `src/utils/economy.js`: 经济相关通用计算。
- `src/utils/effectFormatter.js`: 效果/修正说明文本格式化。
- `src/utils/eventEffectFilter.js`: 事件效果筛选与过滤。
- `src/utils/foreignTrade.js`: 对外贸易辅助逻辑。
- `src/utils/imageRegistry.js`: 图片资源索引与注册。
- `src/utils/livingStandard.js`: 生活水平评分、等级与消费/解锁算法。
- `src/utils/resources.js`: 资源定义辅助与解锁判断。
- `src/utils/soundManager.js`: 音效资源与播放管理。
- `src/utils/styleOptimizer.js`: 样式/动画的性能优化工具。

### components
- `src/components/index.js`: 组件统一导出入口。

#### components/common
- `src/components/common/AchievementToast.jsx`: 成就弹出提示。
- `src/components/common/BattleNotification.jsx`: 战斗提示通知。
- `src/components/common/CompactCard.jsx`: 紧凑型卡片组件。
- `src/components/common/DynamicEffects.jsx`: 通用动态特效集合。
- `src/components/common/EnhancedCards.jsx`: 扩展卡片组件集合。
- `src/components/common/EpicDecorations.jsx`: 史诗风装饰元素。
- `src/components/common/MotionComponents.jsx`: 动画/动效组件封装。
- `src/components/common/SimpleLineChart.jsx`: 简易折线图组件。
- `src/components/common/UIComponents.jsx`: 通用 UI 元件集合。
- `src/components/common/UnifiedUI.jsx`: 统一风格 UI 组件集合。

#### components/game
- `src/components/game/CityMap.jsx`: 城市地图视图。

#### components/layout
- `src/components/layout/BottomNav.jsx`: 底部导航栏。
- `src/components/layout/EraBackground.jsx`: 时代背景/场景背景。
- `src/components/layout/GameControls.jsx`: 游戏控制区按钮/快捷入口。
- `src/components/layout/StatusBar.jsx`: 顶部状态栏。

#### components/modals
- `src/components/modals/AchievementsModal.jsx`: 成就详情弹窗。
- `src/components/modals/AnnualFestivalModal.jsx`: 年度节庆弹窗。
- `src/components/modals/BattleResultModal.jsx`: 战斗结算弹窗。
- `src/components/modals/CardDetailModal.jsx`: 卡片详情弹窗。
- `src/components/modals/DeclareWarModal.jsx`: 宣战弹窗。
- `src/components/modals/DifficultySelectionModal.jsx`: 难度选择弹窗。
- `src/components/modals/EventDetail.jsx`: 事件详情展示。
- `src/components/modals/PopulationDetailModal.jsx`: 人口详情弹窗。
- `src/components/modals/ResourceDetailModal.jsx`: 资源详情弹窗。
- `src/components/modals/SaveSlotModal.jsx`: 存档位选择/管理弹窗。
- `src/components/modals/SaveTransferModal.jsx`: 存档导入导出弹窗。
- `src/components/modals/StratumDetailModal.jsx`: 阶层详情弹窗。
- `src/components/modals/TradeRoutesModal.jsx`: 贸易路线弹窗。
- `src/components/modals/TutorialModal.jsx`: 新手引导弹窗。
- `src/components/modals/WikiModal.jsx`: 游戏百科/说明弹窗。

#### components/panels
- `src/components/panels/CoalitionPanel.jsx`: 执政联盟面板。
- `src/components/panels/DecreeDetailSheet.jsx`: 法令详情底部面板。
- `src/components/panels/DemandsList.jsx`: 诉求列表组件。
- `src/components/panels/DissatisfactionAnalysis.jsx`: 不满来源分析面板。
- `src/components/panels/EmpireScene.jsx`: 帝国场景展示面板。
- `src/components/panels/LogPanel.jsx`: 日志/事件记录面板。
- `src/components/panels/ResourcePanel.jsx`: 资源概览面板。
- `src/components/panels/SettingsPanel.jsx`: 设置面板。
- `src/components/panels/StrategicActionButton.jsx`: 策略行动按钮组件。
- `src/components/panels/StrategicActionCard.jsx`: 策略行动卡片组件。
- `src/components/panels/StrataPanel.jsx`: 阶层列表面板。
- `src/components/panels/StratumDetailSheet.jsx`: 阶层详情底部面板。
- `src/components/panels/TechDetailSheet.jsx`: 科技详情底部面板。
- `src/components/panels/UnitDetailSheet.jsx`: 单位/军队详情底部面板。

#### components/tabs
- `src/components/tabs/BottomSheet.jsx`: 底部抽屉容器。
- `src/components/tabs/BuildTab.jsx`: 建筑/发展页签。
- `src/components/tabs/BuildingDetails.jsx`: 建筑详情展示。
- `src/components/tabs/BuildingUpgradePanel.jsx`: 建筑升级面板。
- `src/components/tabs/DiplomacyTab.jsx`: 外交页签。
- `src/components/tabs/MilitaryTab.jsx`: 军事页签。
- `src/components/tabs/OverviewTab.jsx`: 总览页签。
- `src/components/tabs/PoliticsTab.jsx`: 政治页签。
- `src/components/tabs/ResponsiveContainer.jsx`: 响应式容器。
- `src/components/tabs/TechTab.jsx`: 科技页签。

### config
- `src/config/index.js`: 配置统一导出入口。
- `src/config/achievements.js`: 成就配置。
- `src/config/buildingUpgrades.js`: 建筑升级路径配置。
- `src/config/buildings.js`: 建筑基础配置。
- `src/config/countries.js`: 国家/势力配置。
- `src/config/decrees.js`: 法令配置。
- `src/config/difficulty.js`: 难度参数配置。
- `src/config/epicTheme.js`: 史诗主题配置。
- `src/config/epochs.js`: 时代/纪元配置。
- `src/config/festivalEffects.js`: 节庆效果配置。
- `src/config/gameConstants.js`: 游戏常量配置。
- `src/config/gameData.js`: 游戏初始数据与主配置聚合。
- `src/config/gameSpeeds.js`: 游戏速度档位配置。
- `src/config/iconMap.js`: 图标映射配置。
- `src/config/industryChains.js`: 产业链/生产链配置。
- `src/config/militaryActions.js`: 军事行动配置。
- `src/config/militaryUnits.js`: 军事单位配置。
- `src/config/polityEffects.js`: 政体/政策效果配置。
- `src/config/scenarios.js`: 场景/开局配置。
- `src/config/sounds.js`: 音效资源配置。
- `src/config/strata.js`: 社会阶层配置。
- `src/config/systemSynergies.js`: 系统协同/联动配置。
- `src/config/technologies.js`: 科技配置。
- `src/config/tutorialSteps.js`: 教程步骤配置。
- `src/config/unifiedStyles.js`: 统一 UI 样式变量配置。
- `src/config/zIndex.js`: 层级管理配置。

#### config/events
- `src/config/events/index.js`: 事件配置统一导出。
- `src/config/events/baseEvents.js`: 基础事件配置。
- `src/config/events/classConflictEvents.js`: 阶级冲突事件配置。
- `src/config/events/coalitionEvents.js`: 联盟事件配置。
- `src/config/events/coalitionRebellion.js`: 联盟叛乱事件配置。
- `src/config/events/diplomaticEvents.js`: 外交事件配置。
- `src/config/events/economicEvents.js`: 经济事件配置。
- `src/config/events/epochEvents.js`: 时代事件配置。
- `src/config/events/eventUtils.js`: 事件工具与辅助。
- `src/config/events/rebellionEvents.js`: 叛乱事件配置。
- `src/config/events/staticDiplomaticEvents.js`: 固定外交事件配置。

### logic
- `src/logic/index.js`: 玩法逻辑统一导出入口。
- `src/logic/demands.js`: 诉求生成与不满来源分析。
- `src/logic/organizationPenalties.js`: 组织度惩罚计算。
- `src/logic/organizationSystem.js`: 组织度系统主逻辑。
- `src/logic/promiseTasks.js`: 承诺任务逻辑。
- `src/logic/rebellionSystem.js`: 叛乱系统逻辑。
- `src/logic/rulingCoalition.js`: 执政联盟逻辑。
- `src/logic/simulation.js`: 主模拟循环与推进。
- `src/logic/strategicActions.js`: 策略行动逻辑。

#### logic/buildings
- `src/logic/buildings/index.js`: 建筑逻辑导出入口。
- `src/logic/buildings/effects.js`: 建筑效果计算。

#### logic/diplomacy
- `src/logic/diplomacy/index.js`: 外交逻辑导出入口。
- `src/logic/diplomacy/aiDiplomacy.js`: 外交 AI 决策。
- `src/logic/diplomacy/aiEconomy.js`: 外交相关经济 AI。
- `src/logic/diplomacy/aiWar.js`: 战争 AI 决策。
- `src/logic/diplomacy/nations.js`: 国家关系与外交状态逻辑。

#### logic/economy
- `src/logic/economy/index.js`: 经济逻辑导出入口。
- `src/logic/economy/prices.js`: 商品价格计算。
- `src/logic/economy/taxes.js`: 税收计算。
- `src/logic/economy/trading.js`: 贸易与交易逻辑。
- `src/logic/economy/wages.js`: 工资与收入分配逻辑。

#### logic/population
- `src/logic/population/index.js`: 人口逻辑导出入口。
- `src/logic/population/growth.js`: 人口增长逻辑。
- `src/logic/population/jobs.js`: 职业分配与就业逻辑。
- `src/logic/population/needs.js`: 需求与消费逻辑。

#### logic/stability
- `src/logic/stability/index.js`: 稳定度逻辑导出入口。
- `src/logic/stability/approval.js`: 支持度/好感度计算。
- `src/logic/stability/buffs.js`: 稳定度 Buff/Debuff 处理。

#### logic/utils
- `src/logic/utils/index.js`: 逻辑工具导出入口。
- `src/logic/utils/constants.js`: 逻辑常量与枚举。
- `src/logic/utils/helpers.js`: 逻辑通用辅助函数。

### workers
- `src/workers/simulation.worker.js`: Web Worker 版本的模拟计算。

### assets
- `src/assets/react.svg`: React 占位图标。

#### assets/images/backgrounds
- `src/assets/images/backgrounds/bg_era_0_stone.webp`: 石器时代背景。
- `src/assets/images/backgrounds/bg_era_1_bronze.webp`: 青铜时代背景。
- `src/assets/images/backgrounds/bg_era_2_classical.webp`: 古典时代背景。
- `src/assets/images/backgrounds/bg_era_3_feudal.webp`: 封建时代背景。
- `src/assets/images/backgrounds/bg_era_4_exploration.webp`: 大航海时代背景。
- `src/assets/images/backgrounds/bg_era_6_industrial.webp`: 工业时代背景。
- `src/assets/images/backgrounds/bg_era_7_information.webp`: 信息时代背景。
- `src/assets/images/backgrounds/Gemini_Generated_Image_ksizagksizagksiz.webp`: 额外背景素材。

#### assets/images/buildings
- `src/assets/images/buildings/amphitheater.webp`: 建筑图（圆形剧场）。
- `src/assets/images/buildings/apartment_block.webp`: 建筑图（公寓楼）。
- `src/assets/images/buildings/barracks.webp`: 建筑图（兵营）。
- `src/assets/images/buildings/brickworks.webp`: 建筑图（砖厂）。
- `src/assets/images/buildings/brewery.webp`: 建筑图（酿酒厂）。
- `src/assets/images/buildings/bronze_foundry.webp`: 建筑图（青铜铸造厂）。
- `src/assets/images/buildings/building_materials_plant.webp`: 建筑图（建材厂）。
- `src/assets/images/buildings/cannery.webp`: 建筑图（罐头厂）。
- `src/assets/images/buildings/church.webp`: 建筑图（教堂）。
- `src/assets/images/buildings/coal_mine.webp`: 建筑图（煤矿）。
- `src/assets/images/buildings/coffee_house.webp`: 建筑图（咖啡馆）。
- `src/assets/images/buildings/coffee_plantation.webp`: 建筑图（咖啡种植园）。
- `src/assets/images/buildings/copper_mine.bak.webp`: 建筑图（铜矿备份）。
- `src/assets/images/buildings/copper_mine.webp`: 建筑图（铜矿）。
- `src/assets/images/buildings/culinary_kitchen.webp`: 建筑图（厨房）。
- `src/assets/images/buildings/distillery.webp`: 建筑图（蒸馏厂）。
- `src/assets/images/buildings/dockyard.webp`: 建筑图（船坞）。
- `src/assets/images/buildings/dye_works.webp`: 建筑图（染坊）。
- `src/assets/images/buildings/factory.webp`: 建筑图（工厂）。
- `src/assets/images/buildings/farm.webp`: 建筑图（农场）。
- `src/assets/images/buildings/fortress.webp`: 建筑图（要塞）。
- `src/assets/images/buildings/furniture_factory.webp`: 建筑图（家具厂）。
- `src/assets/images/buildings/furniture_workshop.webp`: 建筑图（家具作坊）。
- `src/assets/images/buildings/garment_factory.webp`: 建筑图（成衣厂）。
- `src/assets/images/buildings/granary.webp`: 建筑图（粮仓）。
- `src/assets/images/buildings/house.webp`: 建筑图（房屋）。
- `src/assets/images/buildings/hut.webp`: 建筑图（小屋）。
- `src/assets/images/buildings/industrial_mine.webp`: 建筑图（工业矿场）。
- `src/assets/images/buildings/iron_tool_workshop.webp`: 建筑图（铁器作坊）。
- `src/assets/images/buildings/large_estate.webp`: 建筑图（大庄园）。
- `src/assets/images/buildings/library.webp`: 建筑图（图书馆）。
- `src/assets/images/buildings/logging_company.webp`: 建筑图（伐木公司）。
- `src/assets/images/buildings/loom_house.webp`: 建筑图（织布坊）。
- `src/assets/images/buildings/lumber_camp.webp`: 建筑图（伐木营）。
- `src/assets/images/buildings/lumber_mill.bak.webp`: 建筑图（锯木厂备份）。
- `src/assets/images/buildings/lumber_mill.webp`: 建筑图（锯木厂）。
- `src/assets/images/buildings/market.webp`: 建筑图（市场）。
- `src/assets/images/buildings/mechanized_farm.webp`: 建筑图（机械化农场）。
- `src/assets/images/buildings/metallurgy_workshop.webp`: 建筑图（冶金作坊）。
- `src/assets/images/buildings/mine.webp`: 建筑图（矿井）。
- `src/assets/images/buildings/navigator_school.webp`: 建筑图（航海学校）。
- `src/assets/images/buildings/opera_house.webp`: 建筑图（歌剧院）。
- `src/assets/images/buildings/paper_mill.webp`: 建筑图（造纸厂）。
- `src/assets/images/buildings/prefab_factory.webp`: 建筑图（预制件工厂）。
- `src/assets/images/buildings/printing_house.webp`: 建筑图（印刷坊）。
- `src/assets/images/buildings/publishing_house.webp`: 建筑图（出版社）。
- `src/assets/images/buildings/quarry.webp`: 建筑图（采石场）。
- `src/assets/images/buildings/rail_depot.webp`: 建筑图（铁路仓库）。
- `src/assets/images/buildings/reed_works.webp`: 建筑图（芦苇作坊）。
- `src/assets/images/buildings/sawmill.webp`: 建筑图（锯木厂）。
- `src/assets/images/buildings/steel_foundry.webp`: 建筑图（钢铁铸造厂）。
- `src/assets/images/buildings/steel_works.webp`: 建筑图（钢铁厂）。
- `src/assets/images/buildings/stock_exchange.webp`: 建筑图（证券交易所）。
- `src/assets/images/buildings/stone_tool_workshop.webp`: 建筑图（石器作坊）。
- `src/assets/images/buildings/tailor_workshop.webp`: 建筑图（裁缝铺）。
- `src/assets/images/buildings/textile_mill.webp`: 建筑图（纺织厂）。
- `src/assets/images/buildings/town_hall.webp`: 建筑图（市政厅）。
- `src/assets/images/buildings/trade_port.webp`: 建筑图（贸易港）。
- `src/assets/images/buildings/trading_post.webp`: 建筑图（贸易站）。
- `src/assets/images/buildings/training_ground.webp`: 建筑图（训练场）。
- `src/assets/images/buildings/university.webp`: 建筑图（大学）。

#### assets/images/events
- `src/assets/images/events/age_of_exploration_colonial_unrest.webp`: 事件图（殖民动荡）。
- `src/assets/images/events/age_of_exploration_merchant_monopoly.webp`: 事件图（商人垄断）。
- `src/assets/images/events/assassination_plot.webp`: 事件图（刺杀阴谋）。
- `src/assets/images/events/bread_and_circuses.webp`: 事件图（面包与马戏）。
- `src/assets/images/events/bread_price_crisis.webp`: 事件图（面包价格危机）。
- `src/assets/images/events/bronze_age_bronze_vein.webp`: 事件图（青铜矿脉）。
- `src/assets/images/events/bronze_age_drought.webp`: 事件图（青铜时代干旱）。
- `src/assets/images/events/bronze_age_merchant_boom.webp`: 事件图（商贸繁荣）。
- `src/assets/images/events/bronze_age_merchant_plea.webp`: 事件图（商人请愿）。
- `src/assets/images/events/bronze_age_miner_unrest.webp`: 事件图（矿工动荡）。
- `src/assets/images/events/bronze_age_new_priest.webp`: 事件图（新任祭司）。
- `src/assets/images/events/bronze_age_skirmish.webp`: 事件图（小规模冲突）。
- `src/assets/images/events/classical_aqueduct_proposal.webp`: 事件图（引水道提案）。
- `src/assets/images/events/classical_artistic_patronage.webp`: 事件图（艺术赞助）。
- `src/assets/images/events/classical_landowner_pressure.webp`: 事件图（土地主压力）。
- `src/assets/images/events/classical_philosopher_challenge.webp`: 事件图（哲人挑战）。
- `src/assets/images/events/classical_scribe_salon.webp`: 事件图（书记沙龙）。
- `src/assets/images/events/classical_written_law.webp`: 事件图（成文法）。
- `src/assets/images/events/comet_sighted.webp`: 事件图（彗星目击）。
- `src/assets/images/events/currency_crisis.webp`: 事件图（货币危机）。
- `src/assets/images/events/enlightenment_coffeehouse_circle.webp`: 事件图（咖啡馆沙龙）。
- `src/assets/images/events/enlightenment_pamphlet_storm.webp`: 事件图（小册子风暴）。
- `src/assets/images/events/exploration_banking_family.webp`: 事件图（银行家族）。
- `src/assets/images/events/exploration_gunpowder_plot.webp`: 事件图（火药阴谋）。
- `src/assets/images/events/exploration_mercenary_offer.webp`: 事件图（雇佣兵提议）。
- `src/assets/images/events/exploration_new_world.webp`: 事件图（新大陆发现）。
- `src/assets/images/events/exploration_renaissance_artist.webp`: 事件图（文艺复兴艺术家）。
- `src/assets/images/events/feudal_cleric_scandal.webp`: 事件图（教士丑闻）。
- `src/assets/images/events/feudal_crusade_call.webp`: 事件图（十字军号召）。
- `src/assets/images/events/feudal_guild_charter.webp`: 事件图（行会特许）。
- `src/assets/images/events/feudal_knight_parade.webp`: 事件图（骑士巡游）。
- `src/assets/images/events/feudal_levy_dispute.webp`: 事件图（征召争议）。
- `src/assets/images/events/feudal_plague_doctor.webp`: 事件图（瘟疫医生）。
- `src/assets/images/events/feudal_university_founding.webp`: 事件图（大学创立）。
- `src/assets/images/events/good_harvest.webp`: 事件图（丰收）。
- `src/assets/images/events/great_famine.webp`: 事件图（大饥荒）。
- `src/assets/images/events/great_flood.webp`: 事件图（大洪水）。
- `src/assets/images/events/industrial_capitalist_boom.webp`: 事件图（资本繁荣）。
- `src/assets/images/events/industrial_general_strike.webp`: 事件图（大罢工）。
- `src/assets/images/events/inventor_plea.webp`: 事件图（发明家请求）。
- `src/assets/images/events/land_reform_proposal.webp`: 事件图（土地改革提案）。
- `src/assets/images/events/military_coup_threat.webp`: 事件图（军事政变威胁）。
- `src/assets/images/events/merchant_caravan.webp`: 事件图（商队）。
- `src/assets/images/events/natural_disaster.webp`: 事件图（自然灾害）。
- `src/assets/images/events/palace_guard_demands.webp`: 事件图（宫廷卫队诉求）。
- `src/assets/images/events/peasant_crusade.webp`: 事件图（农民十字军）。
- `src/assets/images/events/plague_outbreak.webp`: 事件图（瘟疫爆发）。
- `src/assets/images/events/stone_age_elder_council.webp`: 事件图（长老议会）。
- `src/assets/images/events/stone_age_harsh_winter.webp`: 事件图（严冬）。
- `src/assets/images/events/stone_age_hungry_peasants.webp`: 事件图（饥饿的农民）。
- `src/assets/images/events/stone_age_new_water.webp`: 事件图（新水源）。
- `src/assets/images/events/stone_age_stranger_footprints.webp`: 事件图（陌生足迹）。
- `src/assets/images/events/stone_age_tribal_legend.webp`: 事件图（部族传说）。
- `src/assets/images/events/stone_age_unexpected_discovery.webp`: 事件图（意外发现）。
- `src/assets/images/events/stone_tool_innovation.webp`: 事件图（石器创新）。
- `src/assets/images/events/succession_dispute.webp`: 事件图（继承争端）。
- `src/assets/images/events/technological_breakthrough.webp`: 事件图（技术突破）。
## 测试与校验
- `package.json` 当前未配置 `test` 脚本；如需测试请先补充工具链。
- 代码变更后建议至少执行 `npm run lint` 与 `npm run build` 进行验证。
