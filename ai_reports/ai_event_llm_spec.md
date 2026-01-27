# AI 事件系统接入规范（LLM I/O 合同）

本文档给出一套“能直接落地到当前事件系统”的 LLM 输入/输出规范，并对应到仓库中的真实接入点与校验逻辑。

强烈建议：**LLM 只负责生成 JSON（事件内容与效果），真正执行前必须走本地校验/裁剪（normalize）**。

相关代码参考：
- 事件选择与执行入口：`src/hooks/useGameActions.js:517`, `src/hooks/useGameActions.js:599`, `src/hooks/useGameActions.js:834`
- 事件效果过滤：`src/utils/eventEffectFilter.js:94`
- 事件效果随时间衰减：`src/hooks/useGameLoop.js:273`
- 本次新增的 AI 适配器：`src/logic/ai/aiEventAdapter.js`

---

## 1. 推荐接入位点（最小改动路径）

你现在的事件流是：
1) 触发事件：`triggerRandomEvent`
2) 展示事件：`currentEvent`
3) 执行选项：`handleEventOption -> applyEventEffects`

最小接入方案：
1) 在 `triggerRandomEvent` 之外新增一个 `triggerAiEvent`（或在其中增加分支）。
2) 触发前构造上下文（context snapshot）。
3) 调用 LLM 获取 JSON。
4) 使用 `normalizeAiEvent` 做白名单裁剪与数值钳制。
5) 通过现有的 `launchDiplomaticEvent(event)` 接入 UI 与执行链路。

伪代码（贴近你当前结构）：

```js
import { buildAiEventContext, normalizeAiEvent } from '../logic/ai/aiEventAdapter';

const triggerAiEvent = async () => {
    const context = buildAiEventContext({
        epoch,
        daysElapsed,
        population,
        stability,
        resources,
        classApproval,
        classInfluence,
        rulingCoalition,
        techsUnlocked,
        nations,
    });

    const rawEvent = await callYourLlmApi(context);
    const safeEvent = normalizeAiEvent(rawEvent, context);
    if (!safeEvent) return;

    launchDiplomaticEvent(safeEvent);
};
```

---

## 2. LLM 输入规范（Input Schema）

目标：给模型“足够但不过量”的上下文 + 一份严格的白名单字典（reference）。

推荐输入结构：

```json
{
  "epoch": 2,
  "daysElapsed": 1234,
  "population": 180,
  "stability": 62,
  "resources": { "food": 1200, "silver": 800, "science": 55 },
  "classApproval": { "peasant": 48, "merchant": 72 },
  "classInfluence": { "peasant": 120, "merchant": 80 },
  "rulingCoalition": ["merchant", "official"],
  "techsUnlocked": ["pottery", "tool_making"],
  "nations": [
    { "id": "nation_qin", "name": "秦", "relation": 35, "aggression": 0.4, "wealth": 900, "isAtWar": false }
  ],
  "reference": {
    "resources": ["food", "wood"],
    "strata": ["peasant", "merchant"],
    "buildings": ["farm", "market"],
    "buildingCategories": ["gather", "industry", "civic", "military", "all"],
    "diplomacySelectors": ["random", "strongest", "weakest", "hostile", "friendly", "all"],
    "nationIds": ["nation_qin"],
    "numericLimits": {
      "approval": { "min": -30, "max": 30 }
    },
    "effectKeys": ["resources", "resourcePercent"]
  }
}
```

其中：
- 你可以直接用：`buildAiEventContext(...)`
- `reference` 是关键：它明确告诉模型“只能用哪些 key / 标签 / 范围”

---

## 3. LLM 输出规范（Output Schema）

### 3.1 顶层结构

LLM 必须返回**纯 JSON**（不要 Markdown）：

```json
{
  "id": "grain_shortage_relief",
  "name": "粮仓告急",
  "description": "连续阴雨让收成骤降，城中粮价上涨。",
  "icon": "Wheat",
  "options": [
    {
      "id": "release_reserves",
      "text": "开仓放粮",
      "description": "用国库稳定物价",
      "effects": {
        "resources": { "food": 200, "silver": -120 },
        "approval": { "peasant": 12, "merchant": -6 },
        "stability": 4,
        "resourceDemandMod": { "food": -0.1 },
        "buildingProductionMod": { "farm": 0.05 }
      }
    }
  ]
}
```

注意：
- `options` 至少 1 个，建议 2-3 个
- 所有数值必须是数字（不要字符串）

### 3.2 effects 白名单（与当前运行时一致）

这些 key 会被现有系统识别（见 `applyEventEffects`）：

1) 立即数值类：
- `resources: { [resourceKey]: number }`
- `resourcePercent: { [resourceKey]: number }` 例如 `-0.05 = -5%`
- `population: number`（人口绝对变化）
- `populationPercent: number`（人口比例变化）
- `maxPop: number`（人口上限变化）

2) 随时间衰减类（会进入 activeEventEffects）：
- `approval: { [stratumKey]: number }`
- `stability: number`
- `resourceDemandMod: { [resourceKey]: number }`
- `stratumDemandMod: { [stratumKey]: number }`
- `buildingProductionMod: { [buildingIdOrCategory]: number }`

3) 外交类：
- `nationRelation: { [selectorOrNationId]: number, exclude?: string[] }`
- `nationAggression: { [selectorOrNationId]: number }`
- `nationWealth: { [selectorOrNationId]: number }`
- `nationMarketVolatility: { [selectorOrNationId]: number }`
- `triggerWar: selectorOrNationId`
- `triggerPeace: selectorOrNationId`

4) 政治联盟类：
- `modifyCoalition: { addToCoalition?: stratumKey, removeFromCoalition?: stratumKey }`

### 3.3 randomEffects（可选）

结构如下：

```json
{
  "randomEffects": [
    {
      "chance": 0.25,
      "effects": {
        "stability": -6
      }
    }
  ]
}
```

---

## 4. 标签字典（从真实配置提取）

以下标签都能在仓库中找到来源：

1) 资源 keys（来自 `RESOURCES`）
- `food, wood, stone, cloth, brick, tools, plank, copper, dye, papyrus, delicacies, furniture, ale, fine_clothes, iron, spice, coffee, coal, steel, silver, science, culture, maxPop, militaryCapacity`

建议：让模型只从 `reference.resources` 中选。

2) 阶层 keys（来自 `STRATA`）
- `peasant, lumberjack, serf, worker, artisan, miner, merchant, navigator, scribe, soldier, cleric, official, landowner, capitalist, engineer, unemployed`

建议：让模型只从 `reference.strata` 中选。

3) 建筑 id（来自 `BUILDINGS[*].id`）
- 以 `reference.buildings` 为准（避免写死）

4) 建筑类别（代码内硬编码）
- `gather, industry, civic, military, all`

5) 外交 selector（代码内硬编码）
- `random, strongest, weakest, hostile, friendly, all`
- 或具体 `nationId`

---

## 5. 数值范围（强约束建议）

这些范围已经在 `normalizeAiEvent` 里实现钳制：

- `approval`: [-30, 30]
- `stability`: [-20, 20]
- `resourcePercent`: [-0.35, 0.35]
- `populationPercent`: [-0.25, 0.25]
- `population`（绝对变化）: [-200, 200]
- `resourceDemandMod / stratumDemandMod / buildingProductionMod`: [-0.6, 1.0]
- `nationRelation`: [-50, 50]（最终会再被系统夹到 [0,100]）
- `nationAggression`: [-0.4, 0.4]（最终会被夹到 [0,1]）
- `nationWealth`: [-500, 500]
- `nationMarketVolatility`: [-0.4, 0.4]（最终会被夹到 [0,1]）

如果你想更保守，可以进一步收紧这些常量：
- `src/logic/ai/aiEventAdapter.js:10`

---

## 6. 强烈建议的 Prompt 约束写法（可直接用）

系统提示词（建议）：

```text
你是一个事件生成器。你必须只输出 JSON，不要输出任何解释。
你只能使用 reference 中列出的 resources / strata / buildings / nationIds / effectKeys。
所有数值必须在 reference.numericLimits 的范围内。
options 生成 2-3 个，每个选项都必须有 text，effects 尽量简洁。
不要使用 reference.effectKeys 之外的字段。
```

用户提示词（建议）：

```text
基于以下游戏状态生成一个“经济或社会治理类”事件：
{CONTEXT_JSON}
```

---

## 7. 本地安全网（已经给你写好）

新增文件：
- `src/logic/ai/aiEventAdapter.js`

关键函数：
1) `buildAiEventContext(gameState)`
- 负责组装 LLM 输入

2) `getAiEventReference(...)`
- 提供白名单字典

3) `normalizeAiEvent(rawEvent, context)`
- 负责：
  - 字段白名单过滤
  - key 白名单过滤
  - 数值钳制
  - 时代/科技过滤（复用 `filterEventEffects`）
  - 自动加 `ai_` 前缀

这一步是“AI 接入是否可控”的核心。

---

## 8. 下一步我可以继续帮你做的两件事

如果你愿意，我可以直接继续：

1) 在 `useGameActions` 里接一条完整链路
- 新增 `triggerAiEvent`
- 按一定概率与现有随机事件混合
- 自动写日志（区分 AI 事件）

2) 给你补一个最小 LLM 代理（避免前端暴露 key）
- 用一个极简的 serverless/edge 代理风格接口
- 前端只传 context，后端拿 key 调模型

