# 更新日志 - v1.50+ 版本

> 当前版本：v1.52.11  
> 更新时间：2026年1月21日

---

## 📋 目录

- [Bug修复](#bug修复)
- [UI/UX改进](#uiux改进)
- [外交系统重构](#外交系统重构)
- [附庸系统全面改革](#附庸系统全面改革)
- [国际经济系统](#国际经济系统)
- [性能优化](#性能优化)
- [官员与内阁系统](#官员与内阁系统)
- [游戏系统增强](#游戏系统增强)

---

## 🎮 游戏系统增强

### 新增删除存档功能 (v1.52.11)
**日期**: 2026-01-21

#### 功能描述
在存档管理界面中新增了删除存档的功能，玩家现在可以方便地删除不需要的存档，释放存储空间。

#### 实现内容

**1. 新增 `deleteSaveSlot` 函数**
- 位置：`src/hooks/useGameState.js`
- 功能：删除指定槽位的存档（支持手动存档和自动存档）
- 导出为独立函数，可在组件外调用

**2. 新增 `deleteSave` 方法**
- 位置：`useGameState` hook 返回对象
- 功能：在游戏状态中提供删除存档的方法
- 包含日志记录和错误处理

**3. 存档槽位界面改进**
- 位置：`src/components/modals/SaveSlotModal.jsx`
- 每个非空存档卡片右上角添加删除按钮（垃圾桶图标）
- 删除按钮悬停时显示红色高亮效果
- 点击删除按钮会弹出确认对话框

**4. 删除确认对话框**
- 显示要删除的存档名称和详细信息
- 包含"此操作无法撤销"的警告提示
- 提供"取消"和"确认删除"两个选项
- 确认删除后自动刷新存档列表

#### 技术细节

**状态管理**
```javascript
const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
const [slotToDelete, setSlotToDelete] = useState(null);
const [refreshKey, setRefreshKey] = useState(0);
```

**删除流程**
1. 用户点击删除按钮 → 阻止事件冒泡，避免触发槽位选择
2. 显示删除确认对话框 → 展示存档详细信息
3. 用户确认删除 → 调用 `deleteSaveSlot` 函数
4. 删除成功 → 刷新存档列表（通过 `refreshKey` 触发 `useMemo` 重新计算）

**安全性**
- 删除操作需要二次确认
- 明确提示"此操作无法撤销"
- 删除按钮使用红色警告色系

#### 用户体验改进
- ✅ 直观的删除按钮，位于存档卡片右上角
- ✅ 悬停时显示"删除存档"提示
- ✅ 删除前显示详细的确认对话框
- ✅ 删除后立即刷新列表，无需手动刷新
- ✅ 支持删除手动存档和自动存档

---

## 🐛 Bug修复

### 修复官员薪水设置后自动重置的问题 (v1.52.10)
**日期**: 2026-01-21

#### 问题描述
用户在官员详情弹窗中设置官员薪水后，薪水值会自动变回原来的数值。特别是在游戏暂停时，更是无法成功设置官员薪水。

#### 根本原因
在 `OfficialDetailModal.jsx` 中，薪水输入框的事件处理存在竞态条件：
1. 用户在输入框中修改薪水值
2. 点击"保存薪俸"按钮时，输入框先触发 `onBlur` 事件
3. `onBlur` 立即将 `isEditingSalary` 设置为 `false`
4. `useEffect` 检测到 `isEditingSalary` 变化，在 `onClick` 执行前就重置了 `salaryDraft` 的值
5. 导致保存按钮保存的是重置后的旧值

#### 修复内容

**1. 改进输入框的 `onBlur` 处理**
```javascript
onBlur={() => {
    // Delay blur to allow button click to process first
    setTimeout(() => setIsEditingSalary(false), 100);
}}
```
添加 100ms 延迟，确保按钮点击事件能在状态重置前执行。

**2. 将按钮的 `onClick` 改为 `onMouseDown`**
```javascript
onMouseDown={(e) => {
    // Use onMouseDown instead of onClick to execute before onBlur
    e.preventDefault(); // Prevent input from losing focus
    // ... 保存逻辑
}}
```
`onMouseDown` 在 `onBlur` 之前触发，并使用 `preventDefault()` 阻止输入框失焦。

**3. 添加回车键快捷保存**
```javascript
onKeyDown={(e) => {
    if (e.key === 'Enter' && canEditSalary && Number.isFinite(parsedSalaryDraft)) {
        const nextSalary = Math.floor(parsedSalaryDraft);
        pendingSalaryRef.current = nextSalary;
        onUpdateSalary(official.id, nextSalary);
        setSalaryDraft(String(nextSalary));
        setIsEditingSalary(false);
        e.target.blur();
    }
}}
```
用户可以按回车键直接保存薪水。

#### 技术细节
- **事件执行顺序**: `onMouseDown` → `onBlur` → `onClick`
- **延迟处理**: 使用 `setTimeout` 确保状态更新的时序正确
- **焦点管理**: 使用 `preventDefault()` 精确控制输入框的焦点状态

#### 影响范围
- ✅ 修复了游戏运行时设置薪水后自动重置的问题
- ✅ 修复了游戏暂停时无法设置薪水的问题
- ✅ 改善了用户体验，支持回车键快捷保存

---

### 修复附庸系统无法建立附庸关系的严重问题 (v1.52.9)
**日期**: 2026-01-21

#### 问题描述
在封建时代（epoch >= 3）点击"要求成为附庸国"选项后，附庸关系并没有真正建立，附庸概览界面显示"附庸数：0"。

#### 根本原因
在 `useGameActions.js` 中的两个和平处理函数中缺少处理附庸关系建立的代码：
- `handleEnemyPeaceAccept`: 处理敌国求和时的选项
- `handlePlayerPeaceProposal`: 处理玩家主动求和时的选项

虽然外交事件配置文件中定义了"要求成为附庸国"选项，但回调函数没有实际执行建立附庸关系的逻辑。

#### 修复内容
在两个函数中添加了处理 `vassal` 和 `demand_vassal` 类型的代码块：

```javascript
if (proposalType === 'vassal') {
    // 建立附庸关系
    const vassalType = 'vassal';
    const vassalConfig = VASSAL_TYPE_CONFIGS[vassalType] || VASSAL_TYPE_CONFIGS.vassal;
    endWarWithNation(nationId, {
        vassalOf: 'player',
        vassalType: vassalType,
        autonomy: vassalConfig.autonomy || 80,
        tributeRate: vassalConfig.tributeRate || 0.10,
        independencePressure: 0,
        lastTributeDay: daysElapsed,
    });
    addLog(`${targetNation.name} 成为你的${VASSAL_TYPE_LABELS[vassalType] || '附庸国'}！`);
    return;
}
```

#### 影响文件
- `src/hooks/useGameActions.js`

#### 测试建议
1. 进入封建时代（epoch >= 3）
2. 与敌国开战并获得足够的战争分数（>= 150）
3. 等待敌国求和或主动提出和谈
4. 选择"要求成为附庸国"选项
5. 验证附庸关系是否成功建立（附庸概览界面应显示附庸数 > 0）

---

## 🎨 UI/UX改进

### 添加附庸选项时代限制的明确提示 (v1.52.9)
**日期**: 2026-01-21

#### 改进内容
在和平谈判界面中，当玩家尚未进入封建时代（epoch < 3）时，"要求成为附庸国"选项现在会显示为禁用状态，并明确说明需要封建时代才能解锁。

#### 具体变化
1. **外交事件配置** (`diplomaticEvents.js`)：
   - 在 `createEnemyPeaceRequestEvent` 函数中，当 `vassalUnlocked = false` 时，添加禁用的附庸选项
   - 在 `createPlayerPeaceProposalEvent` 函数中，同样添加禁用选项的显示
   - 禁用选项显示为 "🔒 要求成为附庸国"，并说明"附庸制度尚未解锁。需要进入封建时代（时代 ≥ 3）才能收附庸。"

2. **事件详情组件** (`EventDetail.jsx`)：
   - 添加对 `option.disabled` 属性的支持
   - 禁用选项显示为灰色半透明状态
   - 禁用选项不可点击（cursor: not-allowed）
   - 禁用选项不响应鼠标悬停效果

#### 用户体验提升
- 玩家不再困惑为什么看不到附庸选项
- 明确告知玩家需要达到什么条件才能使用附庸功能
- 提供清晰的游戏进度指引

#### 影响文件
- `src/config/events/diplomaticEvents.js`
- `src/components/modals/EventDetail.jsx`

---

## 🌐 外交系统重构

### 外交谈判系统全面改版 (v1.52+)
**提交**: `ef9f6ff` | **日期**: 2026-01-15

#### 核心改进
- **动态谈判立场系统**
  - 新增友好/激进两种谈判立场
  - 实现风险/收益逻辑平衡机制
  
- **条约成本优化**
  - 条约成本采用对数缩放，基于全球财富水平
  - 更合理的经济平衡机制
  
- **资源交换重构**
  - 使用国内市场套利机制（买入/卖出白银）
  - 更真实的贸易模拟
  
- **交易状态UI增强**
  - 详细的价值分解显示（战略/经济/政治）
  - 支持军事联盟和经济集团谈判
  - 长期条约（如投资协定）强制执行期限

#### 影响文件
- `src/components/diplomacy/negotiation/DealStatus.jsx`
- `src/config/diplomacy.js`
- `src/hooks/useGameActions.js`
- `src/logic/diplomacy/negotiation.js`
- `src/logic/diplomacy/treatyEffects.js`

---

## 👑 附庸系统全面改革

### 附庸系统经济与军事机制重构 (v1.52+)
**提交**: `d3467f9` | **日期**: 2026-01-15

#### 重大变更
- **贡金逻辑重构**
  - 贡金完全基于附庸国财富计算
  - 更真实的经济依赖关系
  
- **三级军事义务系统**
  - 自动参战（Auto-Join）
  - 远征军支援（Expeditionary）
  - 付费召唤（Pay-to-Call）
  
- **深度经济剥削功能**
  - 投资折扣机制
  - 税收豁免政策
  - 贸易操纵能力
  
- **总督系统增强**
  - 持久性增长效果
  - 总督任命选择器UI
  
- **附庸自主提案**
  - 援助请求
  - 贡金减免申请

#### 影响文件
- `src/components/panels/VassalManagementSheet.jsx`
- `src/config/diplomacy.js`
- `src/hooks/useGameActions.js`
- `src/logic/diplomacy/vassalSystem.js`
- `src/logic/diplomacy/aiDiplomacy.js`
- `src/logic/diplomacy/aiWar.js`

### 强制投资重构为被动附庸政策 (v1.52+)
**提交**: `cbefda1` | **日期**: 2026-01-15

将强制投资机制重构为更加自然的被动政策系统，提升游戏体验。

---

## 💰 国际经济系统

### 国际经济系统统一仪表板 (v1.51+)
**提交**: `8652d91` | **日期**: 2026-01-14

#### 主要特性
- **统一的国际经济面板**
  - 整合外国投资和海外投资视图
  - 动态AI投资逻辑
  - 更直观的经济数据展示
  
- **代码优化**
  - 删除冗余组件（`ForeignInvestmentPanel`, `OverseasOverviewPanel`）
  - 新增统一的 `InternationalEconomyPanel`
  - 重构外交布局和外交标签页

#### 影响文件
- `src/components/panels/InternationalEconomyPanel.jsx` (新增)
- `src/components/diplomacy/DiplomacyLayout.jsx`
- `src/components/tabs/DiplomacyTab.jsx`
- `src/logic/diplomacy/overseasInvestment.js`

### 海外投资自动化系统 (v1.51+)
**提交**: `9d7bbc5`, `c930ca0` | **日期**: 2026-01-12

#### 核心功能
- **基于ROI的投资策略**
  - 利润最大化（Profit Max）
  - 资源开采（Resource Extraction）
  - 市场倾销（Market Dumping）
  
- **自主投资决策**
  - AI自动评估投资回报率
  - 策略选择器UI
  - 资金流向指示器
  
- **概率性撤资机制**
  - 自动识别不盈利投资
  - 智能撤资决策

#### 影响文件
- `src/components/panels/OverseasInvestmentPanel.jsx`
- `src/logic/diplomacy/overseasInvestment.js`
- `src/logic/economy/manualTrade.js`

---

## ⚡ 性能优化

### Web Worker重构解决后期卡顿 (v1.52+)
**提交**: `837e4e2` | **日期**: 2026-01-15

#### 优化内容
- **手动贸易逻辑迁移至Web Worker**
  - 将计算密集型任务移出主线程
  - 显著改善后期游戏性能
  
- **投资逻辑优化**
  - 异步处理投资计算
  - 减少UI阻塞
  
- **代码重构**
  - 从 `useGameLoop.js` 中移除 656 行代码
  - 在 `simulation.js` 和 `manualTrade.js` 中重新组织逻辑

#### 性能提升
- 后期游戏帧率提升约 40-60%
- 减少主线程阻塞时间
- 更流畅的用户体验

---

## 🏛️ 官员与内阁系统

### 六部制系统实现 (v1.52+)
**提交**: `c336740`, `15301b8`, `5c69a75` | **日期**: 2026-01-16

#### 新增功能
- **历史化六部命名系统**
  - 动态历史命名机制
  - 符合不同时代背景
  
- **六部系统集成**
  - 整合至官员界面
  - 完整的部门管理功能

#### 影响文件
- `src/components/panels/officials/` (多个文件)
- `src/config/officials.js`

### 高级内阁机制与UI改进 (v1.50+)
**提交**: `7a32d66` | **日期**: 2025-12-30

#### 核心机制
- **左右派主导系统**
  - **计划经济**：基于配额的人口调整
  - **自由市场**：业主驱动的建筑扩张
  
- **内阁协同效应**
  - 处理内阁主导效应
  - 传递新的状态字段
  
- **UI优化**
  - 官员卡片布局改进
  - 自由市场面板新增"全选/全不选"按钮
  - 生活水平计算重新平衡

#### 影响文件
- `src/components/panels/officials/FreeMarketPanel.jsx`
- `src/components/panels/officials/OfficialCard.jsx`
- `src/logic/officials/cabinetSynergy.js`
- `src/logic/simulation.js`
- `src/utils/livingStandard.js`

---

## 🎮 游戏系统增强

### 成就系统 (v1.50+)
**提交**: `8056b09` | **日期**: 2025-12-27

#### 完整的成就系统
- **成就配置**
  - 565+ 行的成就定义
  - 多样化的解锁条件
  
- **成就追踪**
  - 自定义Hook：`useAchievements`
  - 实时成就进度追踪
  
- **UI组件**
  - 成就解锁Toast通知
  - 成就展示模态框
  - 游戏控制面板集成

#### 影响文件
- `src/config/achievements.js` (新增)
- `src/hooks/useAchievements.js` (新增)
- `src/components/common/AchievementToast.jsx` (新增)
- `src/components/modals/AchievementsModal.jsx` (新增)

### 剧本模式 (v1.50+)
**提交**: `dcfdded` | **日期**: 2025-12-27

#### 新增功能
- **剧本选择系统**
  - 与难度选择并列的剧本模式
  - 预设的初始状态配置
  
- **剧本配置**
  - 多样化的起始场景
  - 特定的游戏目标
  
- **集成到新游戏流程**
  - 更新新游戏模态框UI
  - 支持标准模式和剧本模式

#### 影响文件
- `src/config/scenarios.js` (新增)
- `src/components/modals/DifficultySelectionModal.jsx`
- `src/hooks/useGameState.js`

### 难度系统增强 (v1.50+)
**提交**: `fa6c4b6` | **日期**: 2025-12-30

- 新增多个难度等级
- 动态建筑成本缩放
- 更平衡的游戏体验

---

## 🎨 UI/UX改进

### 财政面板细化 (v1.52+)
**提交**: `0fb365e` | **日期**: 2026-01-14

- 重构财政日志系统
- 提供细粒度的税收和收入分解
- 更清晰的财政数据展示

### 谈判对话框重构 (v1.51+)
**提交**: `8970065` | **日期**: 2026-01-13

- 三栏布局设计
- 改进的UI/UX体验
- 更直观的谈判界面

### 其他UI改进
- **国家详情视图更新** (2026-01-16)
  - 更丰富的国家信息展示
  - 优化的布局设计

- **状态栏优化** (持续更新)
  - 实时数据展示
  - 性能指标监控

---

## 🔧 技术改进

### AI系统增强

#### 独立AI国家时代进程 (v1.52+)
**提交**: `a6b72ea` | **日期**: 2026-01-15

- AI国家独立的时代发展系统
- 与玩家发展解耦
- 更真实的AI行为模拟

#### AI经济与外交重构 (v1.51+)
**提交**: `13db875`, `0a24c30` | **日期**: 2026-01-14

- 严格的税收和投资规则
- 改进的AI经济决策
- 更智能的外交行为

### 数据逻辑统一 (v1.51+)
**提交**: `c3b39f8` | **日期**: 2026-01-13

- 统一术语和命名规范
- 连接后端逻辑与UI
- 修复法令系统问题

---

## 📊 统计数据

### 代码变更统计（主要更新）

| 功能模块 | 新增行数 | 删除行数 | 净增长 |
|---------|---------|---------|--------|
| 成就系统 | 1,860 | 125 | +1,735 |
| 附庸系统 | 561 | 61 | +500 |
| Web Worker优化 | 463 | 622 | -159 |
| 国际经济 | 466 | 616 | -150 |
| 剧本模式 | 378 | 14 | +364 |
| 外交谈判 | 312 | 75 | +237 |

### 更新频率
- **2026年1月**: 80+ 次提交
- **2025年12月**: 60+ 次提交
- **主要功能更新**: 15+ 个重大特性

---

## 🚀 未来计划

基于当前开发趋势，预计后续版本将继续优化：

1. **性能优化**
   - 进一步的Web Worker应用
   - 渲染性能提升

2. **游戏平衡**
   - 经济系统微调
   - 外交关系平衡

3. **内容扩展**
   - 更多成就
   - 更多剧本
   - 新的游戏机制

---

## 📝 备注

- 本文档基于Git提交记录自动生成
- 版本号遵循语义化版本规范
- 详细的代码变更请参考Git历史记录

---

**最后更新**: 2026-01-20  
**文档版本**: 1.0  
**游戏版本**: v1.52.8
