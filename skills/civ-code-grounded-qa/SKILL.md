---
name: civ-code-grounded-qa
description: Answer civ-game mechanic questions by strictly grounding every claim in the current repository code and config. Use when users ask how gameplay systems work, why a value changes, unlock conditions, formulas, event effects, diplomacy/economy logic, UI behavior, or balance details. Require file-level evidence, avoid speculation, and explicitly state when the code does not contain enough information.
---

# Civ Code Grounded QA

## 目标

仅基于当前仓库已有实现回答机制问题，不输出臆测、脑补设定或“可能如此”的描述。

## 执行流程

1. 先把问题转成可检索对象：系统名、资源名、事件名、变量名、UI 面板名。
2. 在代码中检索并定位实现：优先查 `src/logic`、`src/config`、`src/utils`、`src/hooks`，UI 问题再查 `src/components`。
3. 阅读“定义 + 调用链 + 相关常量”，不要只看单一片段。
4. 交叉核对最终结论是否被多个模块共同修正（例如基础值、buff/debuff、难度系数、时代修正）。
5. 仅在证据闭环后输出答案；无法闭环时明确写“代码中未找到充分依据”并指出缺失点。

## 证据规则

1. 每条关键结论都要能映射到具体文件与符号（函数、常量、配置项、状态字段）。
2. 明确区分“代码直接事实”和“由代码推导的结论”。
3. 不得虚构不存在的配置、公式、事件、单位、建筑、参数。
4. 当逻辑存在分支时，写清触发条件，不把局部分支当全局规则。
5. 用户问题超出仓库实现范围时，直接说明超出范围，不延展到外部设定。

## 输出格式

按以下结构回答，保持简洁：

1. `结论`：直接回答用户问题。
2. `代码依据`：列出关键文件与符号。
3. `生效条件/边界`：说明前提、分支、版本状态。
4. `未确认项`：仅在证据不足时填写。

## 快速导航

先阅读 [references/lookup-playbook.md](references/lookup-playbook.md) 的检索路径与关键词建议，再进入具体问题定位。
