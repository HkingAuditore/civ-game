# Diplomacy Expansion Summary and Plan (Rechecked)

> 本文已严格按你最新的阶段定义重新核对与重写。

## 0. 当前完成度总览（按阶段）

- 阶段1（基础骨架）：部分完成
- 阶段2（条约体系）：部分完成
- 阶段3（国际组织）：部分完成
- 阶段4（多轮谈判）：进行中
- 阶段5（附庸/保护国/殖民地）：未开始
- 阶段6（海外建筑）：未开始
- 阶段7（AI与事件补齐）：部分完成
- 阶段8（UI与体验收尾）：未开始

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

### 未完成
- UI 违约反馈仍可加强（如历史记录、统计面板归档）。

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
进行中。

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
- 未开始。

---

## 6. 阶段6：海外建筑

### 目标
- 最小记录结构与收益归属：`src/logic/buildings/*`, `src/logic/economy/*`
- 外资策略切换与影响：`src/components/modals/*`, `src/components/panels/*`

### 状态
- 未开始。

---

## 7. 阶段7：AI与事件补齐

### 目标
- AI外交策略：`aiDiplomacy.js`, `aiEconomy.js`
- 事件补充：`src/config/events/*`

### 已完成
- `aiDiplomacy.js` 已接入组织贸易加成逻辑。

### 未完成
- AI 的条约/组织/多轮谈判策略仍未成体系。
- 外交事件补齐未开展。

---

## 8. 阶段8：UI与体验收尾

### 目标
- 统计/提示/可视化与动效：`src/components/common/*`, `src/components/panels/*`
- 文案与提示统一：`effectFormatter.js`

### 状态
- 未开始。
