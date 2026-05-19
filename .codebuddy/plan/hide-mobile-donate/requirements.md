# 需求文档：隐藏移动端打赏入口

## 引言

游戏目前在移动端和桌面端均通过 `GameControls` 组件的菜单中提供"打赏作者"入口。用户希望暂时在移动端隐藏该入口，桌面端保持不变。

**当前实现分析：**
- 打赏按钮位于 `src/components/layout/GameControls.jsx` 的游戏菜单中
- `App.jsx` 中有两处 `GameControls` 实例：
  - 桌面端（`lg:block` 区域，约第1475行）：传入 `onDonate` prop
  - 移动端（`lg:hidden` 区域，约第1505行）：传入 `onDonate` prop
- `DonateModal` 弹窗由 `showDonateModal` 状态控制

---

## 需求

### 需求 1

**用户故事：** 作为游戏开发者，我希望在移动端隐藏打赏入口，以便暂时不在移动端展示该功能，同时保持桌面端不受影响。

#### 验收标准

1. WHEN 用户在移动端（视口宽度 < 1024px）打开游戏菜单 THEN 系统 SHALL 不显示"打赏作者"按钮
2. WHEN 用户在桌面端（视口宽度 ≥ 1024px）打开游戏菜单 THEN 系统 SHALL 正常显示"打赏作者"按钮，功能不变
3. IF 移动端 `GameControls` 的 `onDonate` prop 未传入或为 `undefined` THEN 系统 SHALL 不渲染打赏按钮（利用现有的 `disabled={!onDonate}` 逻辑或直接不渲染）
4. WHEN 修改完成后 THEN 系统 SHALL 不影响 `DonateModal` 弹窗本身的代码，仅控制入口可见性
5. WHEN 修改完成后 THEN 系统 SHALL 不影响其他菜单项（设置、存档、教程、百科、更新日志等）的正常显示和功能
