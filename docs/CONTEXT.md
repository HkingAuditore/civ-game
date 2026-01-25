# civ-game 当前上下文

## 当前状态
- **阶段**: Phase 1 - 军事系统增强开发
- **进度**: P0-P7 完成，战线地图UI重构进行中（形态修复中）
- **下一步**: 验证矩形布局是否与显示窗口契合

## 本次对话目标
优化战线系统UI，让玩家能够顺利操作军团、查看军团状态。

## 已完成事项

### P0: 新资源 + 产业链建筑 ✓
- [x] `gameConstants.js` - 新增4个军事资源：
  - `saltpeter` 硝石（Epoch 4，火药原料）
  - `weapons` 兵器（Epoch 2，古典时代武器）
  - `gunpowder` 火药（Epoch 4，枪炮原料）
  - `firearms` 枪炮（Epoch 5，工业时代武器）

- [x] `buildings.js` - 新增4个军事建筑：
  - `weapon_workshop` 兵器铺（Epoch 2，产出兵器）
  - `saltpeter_mine` 硝石矿（Epoch 4，开采硝石）
  - `powder_mill` 火药坊（Epoch 4，制造火药）
  - `arsenal` 军械厂（Epoch 5，生产枪炮）

- [x] `technologies.js` - 新增4个军事科技：
  - `saltpeter_extraction` 硝石开采
  - `gunpowder_formula` 火药配方
  - `firearms_manufacturing` 枪炮制造
  - `ballistics` 弹道学

- [x] `industryChains.js` - 更新军事产业链配置

### P1: 兵种武器消耗 ✓
- [x] `militaryWeapons.js` - 新增武器消耗配置文件：
  - 定义各兵种招募时的武器消耗
  - 定义各兵种维护时的武器消耗
  - 时代演进：Epoch 0-1用工具，Epoch 2-4用兵器，Epoch 5+用枪炮
  - 提供武器供应状态检查工具函数

## 待开发事项

### P2: 战线地图生成 ✓
- [x] 创建 `frontlineConfig.js` 配置文件
  - 战线规模配置（5级：边境冲突→史诗战役）
  - 地形类型（平原/森林/山地/河流/道路/沼泽）
  - 建筑类型（农田/矿场/工坊/市场/军营等）
  - 战争分数和疲劳配置
- [x] 创建 `frontlineSystem.js` 核心逻辑
  - 地图生成算法（动态规模计算）
  - 兵团创建和管理
  - 每日战斗处理
  - 建筑攻击和摧毁
  - 战争分数计算

### P3: 兵团系统 ✓
- [x] 创建 `corpsSystem.js` 兵团管理逻辑
  - 从军队创建/解散兵团
  - 移动/攻击/防守/撤退命令
  - 兵力补充和状态查询


### P4-P5: AI行为 ✓
- [x] 创建 `aiFrontline.js` AI战线决策逻辑
  - AI战术策略（进攻/防御/均衡/机会）
  - 兵团创建和指挥决策
  - 局部兵力对比计算
- [x] AI-AI简化战斗模拟
  - 简化战斗判定（不生成战线地图）
  - 武器消耗和战备度系统
  - 战争疲劳和恢复机制

### P6: UI开发 ✓
- [x] `FrontlineMapPanel.jsx` 战线地图组件
  - 战线地图网格显示
  - 地形、建筑、兵团可视化
  - 战争状态栏（分数/天数/控制率）
  - 选中格子详情面板
- [x] `CorpsManagementPanel.jsx` 兵团管理面板
  - 创建兵团和分配单位
  - 兵团状态和命令下达
  - 武器供应状态显示
- [x] `FrontlineBattleSection.jsx` 战线战斗面板
  - 整合战线地图和兵团管理
  - 战争概览和状态显示
  - 视图切换（地图/兵团）

### P6.5: 游戏循环集成 ✓
- [x] `frontlineIntegration.js` 集成模块
- [x] `nations.js` 更新（集成战线调用）

### P7: UI入口集成 ✓
- [x] 修改 `MilitaryTab.jsx`
  - 导入 `FrontlineBattleSection` 组件
  - 将标签页从"战斗"改为"战线"
  - 完全取代旧的战斗系统UI
  - 清理旧战斗系统相关代码（WAR_SCORE_GUIDE、战争分数模态框等）
- [x] 禁用旧的突袭系统 `aiWar.js`
  - 禁用 `processRebelWarActions` 中的叛军突袭逻辑
  - 禁用 `processAIMilitaryAction` 中的AI突袭逻辑
  - 战线系统完全接管所有战斗逻辑
- [x] 集成战线系统到游戏循环 `simulation.js`
  - 导入 `processPlayerWarDaily` 和 `processAIAIWarsDaily`
  - 在AI军事行动处理中调用战线系统
  - 传递正确的 `buildings` 数据给战线系统
  - 同步战争分数到nation对象

### P8: 测试平衡
- [ ] 武器产出/消耗平衡测试
- [ ] 战斗系统测试
- [ ] 战线系统完整流程测试

### P8.1: UI交互优化 (本次进度) ✓
- [x] `FrontlineMapPanel.jsx` 优化:
  - 增大六边形尺寸（从18改为24基础尺寸）
  - 添加地图缩放控制（50%-150%可调）
  - 优化地图布局和滚动区域
  - 添加选中兵团操作提示和取消选中按钮
- [x] 战线地图六边形布局重构（odd-q尖顶布局），修复重叠与错位问题
- [x] `CorpsManagementPanel.jsx` 优化:
  - 添加"全部"快速分配按钮
  - 添加详细操作说明
  - 优化空状态显示
- [x] `FrontlineBattleSection.jsx` 优化:
  - 添加视图切换时的操作引导提示
  - 自动在切换到地图视图时选中第一个兵团

## 已完成阶段
- P0-P7 全部完成，战线系统UI已完全集成到军事标签页
- 修复战线地图生成失败：支持玩家建筑对象格式并接入建筑升级数据
- 平顶六边形战线地图渲染与坐标更新；兵团可通过地图点击进行移动/攻击/围攻；战斗节奏为每日走格+每日结算
- UI交互优化：增大六边形、添加缩放控制、操作引导提示

## 战线系统操作流程

### 玩家操作流程
1. 进入军事标签页 → 战线标签
2. 切换到"兵团管理"视图
3. 点击"创建兵团"按钮
4. 分配部队（使用+/-按钮或"全部"按钮）
5. 输入兵团名称，点击"确认创建"
6. 切换到"战线地图"视图
7. 点击己方兵团（蓝色）选中
8. 点击目标格子：
   - 空地 → 移动
   - 敌军（红色）→ 攻击
   - 敌方建筑 → 围攻

## 相关设计文档
- 详细设计方案: `.gemini/antigravity/brain/88e2645a-d97d-4824-9b5b-ece31d98a9bd/implementation_plan.md`

---
*最后更新: 2026-01-25*
