# civ-game 当前上下文

## 当前状态
- **阶段**: Phase 1 - 军事系统增强开发
- **进度**: P0-P1 完成，P2-P6 待开发
- **下一步**: 继续战线地图系统开发 或 测试已完成功能

## 本次对话目标
设计并实现更完整、生动、有趣的军事机制，包括：
1. 时代武器系统（工具→兵器→枪炮）
2. 火药产业链
3. 动态战线地图系统
4. 兵团战术系统
5. AI-AI交战简化模拟

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

### P2: 战线地图生成
- [ ] 创建 `frontlineConfig.js` 配置文件
- [ ] 实现战线地图生成算法
- [ ] 动态规模计算（基于交战国实力）

### P3: 兵团系统
- [ ] 创建 `corpsSystem.js` 兵团管理逻辑
- [ ] 实现兵团移动和战斗结算

### P4-P5: AI行为
- [ ] AI战线决策逻辑
- [ ] AI-AI简化战斗模拟

### P6: UI开发
- [ ] `FrontlineMap.jsx` 战线地图组件
- [ ] `CorpsPanel.jsx` 兵团管理面板

### P7: 测试平衡
- [ ] 武器产出/消耗平衡测试
- [ ] 战斗系统测试

## 待决策事项
- 是否继续开发战线系统（P2+）
- 还是先测试已完成的资源/建筑/科技部分

## 相关设计文档
- 详细设计方案: `.gemini/antigravity/brain/88e2645a-d97d-4824-9b5b-ece31d98a9bd/implementation_plan.md`

---
*最后更新: 2026-01-21*

