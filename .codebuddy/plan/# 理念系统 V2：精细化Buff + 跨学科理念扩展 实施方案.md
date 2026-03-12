# 理念系统 V2：精细化Buff + 跨学科理念扩展 实施方案（修订版）

> **本方案已修订**，修订版拆分为多个文件，位于 `ideology-v2-revised/` 目录下。
> 
> 修订基于对以下核心文件的深度代码审查：
> - `src/logic/ideology/ideologyEffects.js` — 触发/转化/规则修改引擎
> - `src/logic/ideology/ideologyEventBus.js` — 事件驱动效果
> - `src/logic/buildings/effects.js` — bonuses 初始化管道
> - `src/logic/simulation.js` — triggerState 构造 + 消费管道
> - `src/config/ideologies.js` — 现有约50个理念
> - `src/config/ideologySynergies.js` — 联动配置
> - `src/config/strata.js` — 18种阶层
> - `src/config/militaryUnits.js` — 兵种类别

---

## 修订版文件索引

| 文件 | 内容 |
|------|------|
| [00-grounding-and-engine.md](./ideology-v2-revised/00-grounding-and-engine.md) | 代码现实摘要 + 引擎层扩展（Phase 0-1） |
| [01-ideologies-philosophy-theology-politics.md](./ideology-v2-revised/01-ideologies-philosophy-theology-politics.md) | 哲学(6) + 神学(5) + 政治(6) = 17个理念 |
| [02-ideologies-economy-military.md](./ideology-v2-revised/02-ideologies-economy-military.md) | 经济(6) + 军事(6) = 12个理念 |
| [03-ideologies-aesthetics-science-social.md](./ideology-v2-revised/03-ideologies-aesthetics-science-social.md) | 美学(5) + 科学(5) + 社会(6) = 16个理念 |
| [04-new-ideologies-synergies-ui-implementation.md](./ideology-v2-revised/04-new-ideologies-synergies-ui-implementation.md) | 补充理念(5) + 联动(18+10) + UI + 实施步骤 + 平衡守则 |
| [05-implementation-plan.md](./ideology-v2-revised/05-implementation-plan.md) | **逐步实施规划** — 7个Phase、具体行号、代码示例、风险清单 |

**总计：50个新理念 + 18组正向联动 + 10组反向联动**

---

## 关键修订摘要

### 架构层面的修正

1. **ruleMods 消费逻辑实装**：发现现有 `applyRuleMods()` 只收集不消费，所有17种ruleMod类型需在 simulation.js 中添加真正的消费节点
2. **triggerState 扩展**：新增 warCount/friendlyCount/vassalCount/tradeVolume/unemployment/legitimacy/avgApproval/militarySize 等12个字段
3. **trigger type 精简**：从原方案14种新type → 5种（有独特逻辑的），其余9种合并到 converter sourceType
4. **bonuses 不重复**：取消原方案1.1的12个bonuses新字段，统一走 ruleMods 路径

### 数据层面的修正

5. **~~实体引用对齐~~**：~~serf→peasant, scribe→scholar~~ **勘误：STRATA中确实有serf(行84)和scribe(行284)，此修正撤回**
6. **buff 持续时间**：所有 >180天 的buff → 180天（L3允许360天但需评估）
7. **兵种scope统一**：全部使用 category（infantry/cavalry/gunpowder/siege/archer），不用单兵种id
8. **新增5个理念**：契约农奴制、海洋霸权、哲人王、黄金规则、制图学
9. **新增3组正向联动**：理想国、海上丝路、地图大发现
10. **新增2组反向联动**：哲人与暴君之争、探索与孤立之争

### 实施优先级

```
Phase 0-1（引擎层）→ Phase 2-3（数据层）→ Phase 4（UI层）→ Phase 5（验证）
```
