---
name: memory-optimization-console-log-cleanup
overview: 根据堆内存快照分析报告，清理 src/logic/ 中所有热路径的 console.log 调试输出，预计减少 60-80% 内存占用（从 ~2GB 降至 200-400MB）。
todos:
  - id: p0-trading-simulation
    content: 使用 [skill:civ-grounded-development] 注释 trading.js:1981 的出口贸易 console.log 和 simulation.js 中6处活跃的 console.log（treaty/vassal/popGrowth）
    status: completed
  - id: p0-economic-indicators
    content: 注释 economicIndicators.js 中全部11处 console.log 及配套的 console.group/console.groupEnd（共3组）
    status: completed
  - id: p0-cabinet-synergy
    content: 注释 cabinetSynergy.js 中8处 DOMINANCE DEBUG 和 FREE MARKET 调试 console.log
    status: completed
  - id: p1-vassal-ai
    content: 注释 vassalSystem.js 5处和 aiEconomy.js 6处活跃的调试 console.log
    status: completed
  - id: p2-misc-cleanup
    content: 注释 organizationSystem.js 3处、negotiation.js 1处、overseasInvestment.js 1处、performanceUtils.js 2处残留 console.log
    status: completed
---

## 用户需求

根据堆内存快照分析报告，优化游戏内存占用。当前运行 365 tick 后堆内存达 2,176 MB（预期 100-300 MB），节点数 1900 万（预期 200-500 万），是预期的 5-10 倍。

## 产品概述

清理游戏模拟循环（热路径）中残留的 `console.log` 调试语句，这些语句导致 Chrome DevTools 永久保留所有 log 参数的引用，GC 无法回收，是内存膨胀的根本原因（~1.5 GB 字符串内存）。

## 核心功能

- **P0 清理**：删除/注释 `trading.js`、`simulation.js`、`economicIndicators.js`、`cabinetSynergy.js` 中每 tick 无条件执行的 console.log（预计减少 60-80% 内存）
- **P1 清理**：注释 `vassalSystem.js`、`aiEconomy.js` 中中等频率的调试日志
- **P2 清理**：注释 `organizationSystem.js`、`negotiation.js`、`overseasInvestment.js`、`performanceUtils.js` 中低频但应清理的日志
- **统一调试门控**：对需要保留调试能力的日志，改用项目已有的 `debugLog(flag, ...)` 门控机制，默认不输出

## 技术栈

- 现有项目：React 19 + Vite + Tailwind CSS
- 不涉及 UI 变更，仅修改 `src/logic/` 下的 JS 逻辑文件

## 实现方案

### 策略

将热路径中的 `console.log` / `console.group` / `console.groupEnd` 按三种方式处理：

1. **直接注释**：纯调试用途、已不需要的日志，注释掉并保留 `// [DEBUG]` 标记方便将来启用
2. **替换为 `debugLog`**：仍有调试价值的日志，改为 `debugLog(flag, ...)` 门控输出（项目已有完善的 `debugFlags` 机制，默认全部 `false`）
3. **保留不动**：已注释的、有 `globalThis.__CIV_DEBUG__` 或 `this.enabled` 守卫的

### 关键技术决策

- 项目已有 `src/utils/debugFlags.js`，提供 `debugLog(flag, ...args)` 和 `isDebugEnabled(flag)` 函数，支持通过 `localStorage` 或 `globalThis.__CIV_DEBUG__` 动态开启，且默认全部关闭
- `simulation.js` 和 `trading.js` 已导入 `debugLog`，其他文件需新增 import
- 使用现有 flag 名（`simulation`、`trade`、`vassal`）或新增语义明确的 flag（`economy`、`cabinet`、`coalition`、`negotiation`）

### 根因与预期效果

| 文件 | 活跃 console.log 数 | 触发频率 | 预估内存贡献 |
| --- | --- | --- | --- |
| economicIndicators.js | 11 + 4 group | 每 tick | 极高 |
| trading.js | 1 | 每次出口交易 | 极高 |
| simulation.js | 6 | 每 tick | 高 |
| cabinetSynergy.js | 8 | 每 tick | 中高 |
| vassalSystem.js | 5 | 每10天/UI | 中 |
| aiEconomy.js | 6 | 增长周期 | 中 |
| 其他 | 6 | 低频 | 低 |


修复后预计内存从 ~2,176 MB 降至 200-400 MB 范围。

## 实现注意事项

1. **console.group/groupEnd 必须成对处理**：`economicIndicators.js` 中有 3 组 `console.group` + `console.groupEnd`，需要整组注释/替换
2. **不改动功能逻辑**：只处理日志输出语句，不修改任何计算/赋值/控制流
3. **import 语句**：对未导入 `debugLog` 的文件（economicIndicators.js、cabinetSynergy.js、vassalSystem.js、aiEconomy.js、organizationSystem.js、negotiation.js），需添加 `import { debugLog } from '...'` 或直接注释
4. **向后兼容**：保留注释形式的调试代码，开发者可通过 `localStorage.setItem('civ_debug_flags', '{"economy":true}')` 随时启用

## 目录结构

```
src/logic/
├── simulation.js                        # [MODIFY] 注释6处活跃console.log（treaty/vassal/popGrowth调试）
├── economy/
│   ├── trading.js                       # [MODIFY] 注释1处出口贸易调试log
│   └── economicIndicators.js            # [MODIFY] 注释11处console.log + 4处console.group/groupEnd
├── officials/
│   └── cabinetSynergy.js                # [MODIFY] 注释8处dominance/free market调试log
├── diplomacy/
│   ├── vassalSystem.js                  # [MODIFY] 注释5处活跃的附庸系统调试log
│   ├── aiEconomy.js                     # [MODIFY] 注释6处AI经济调试log
│   ├── negotiation.js                   # [MODIFY] 注释1处谈判计算调试log
│   └── overseasInvestment.js            # [MODIFY] 注释1处缺失配置警告log
├── organizationSystem.js                # [MODIFY] 注释3处联盟调试log
└── utils/
    └── performanceUtils.js              # [MODIFY] 注释2处PerfLog内的console.log
```

## Agent Extensions

### Skill

- **civ-grounded-development**
- Purpose: 确保修改遵循项目现有架构约定，使用已有的 debugFlags 系统而非引入新模式
- Expected outcome: 所有 console.log 清理均复用现有 debugLog 门控机制，保持代码一致性