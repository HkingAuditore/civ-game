---
name: version-update-workflow
description: Summarize and execute civ-game version update workflow, including change classification, changelog entry authoring, release highlights, and verification steps. Use when the user mentions version update, changelog, release notes, patch notes, or asks to prepare a new version.
---

# Version Update Workflow

## 适用场景

当用户提到以下关键词时使用本技能：
- 版本更新
- 更新日志 / changelog
- 发版说明 / release notes
- patch notes
- 准备新版本

本技能默认用于本仓库的版本更新流程，目标是把“代码改动 -> 可发布日志”标准化。

## 快速原则

1. 先基于事实：先看变更，再写文案。
2. 文案可读：`highlights` 用短句，`changes` 用完整句。
3. 类型准确：`fix/improve/balance/new/remove` 不混用。
4. 一次只做一个版本号，避免混入历史内容。
5. 版本更新后必须运行 `update_version.bat` 同步版本位点。
6. 交付前至少做一次最小验证（`lint` 或 `build`）。

## 标准流程

按以下步骤执行：

1. 收集改动事实  
   - 查看当前改动与已提交记录，梳理“做了什么、为什么做”。
   - 合并重复点，去掉纯实现细节噪音。

2. 归类更新类型  
   - `fix`: 修 bug、纠正错误行为
   - `improve`: 体验/性能/结构优化（不改变核心平衡）
   - `balance`: 数值、概率、门槛、产出等平衡调整
   - `new`: 新功能/新内容
   - `remove`: 移除功能

3. 生成版本摘要  
   - `highlights` 建议 2-4 条，每条 12-24 字左右，突出玩家可感知收益。
   - 避免“重构了某某函数”这类纯技术表达。

4. 更新 `src/config/changelog.js`  
   - 在数组头部新增新版本对象。
   - 字段顺序保持一致：`version` -> `date` -> `isLatest` -> `highlights` -> `changes`。
   - 新版本 `isLatest: true`。
   - 上一个最新版本改为 `isLatest: false`。

5. 运行版本同步脚本  
   - 在仓库根目录执行：`update_version.bat`（或 `.\update_version.bat`）。
   - 脚本失败时不得跳过，需先修复失败原因再继续后续步骤。
   - 执行后检查 `package.json`、`android/app/build.gradle` 等版本位点是否已同步。

6. 质量检查  
   - 检查文案是否与改动一一对应，不夸大。
   - 检查所有条目都带 `type` 与 `text`。
   - 建议运行：`npm run lint`，必要时补 `npm run build`。

7. 输出交付说明  
   - 告知更新了哪些文件。
   - 给出本次版本核心亮点、`update_version.bat` 执行结果与验证结果。

## changelog 条目模板

使用以下结构插入到 `CHANGELOG` 数组头部：

```javascript
{
    version: 'x.y.z',
    date: 'YYYY-MM-DD',
    isLatest: true,
    highlights: [
        '亮点 1',
        '亮点 2',
    ],
    changes: [
        { type: 'fix', text: '...' },
        { type: 'improve', text: '...' },
        { type: 'balance', text: '...' },
    ],
},
```

## 文案风格约束

- 使用简体中文，面向玩家可读。
- 每条 `changes.text` 尽量包含：
  - 触发条件/问题背景
  - 具体修复或调整内容
  - 结果（避免了什么问题、提升了什么体验）
- 避免空泛词：`优化了一些问题`、`修复若干 bug`。

## 执行时默认行为

- 若用户只说“更新版本”，先从现有改动自动归纳候选 `highlights` 和 `changes`，再写入。
- 若用户给了明确版本号，直接使用该版本号；否则先询问版本号。
- 若用户只要“总结流程”，输出流程文档，不修改代码文件。

## 示例（来自 2.1.8 可复用模式）

- `fix`：修复 tick 写回与玩家同帧操作的竞态覆盖。
- `improve`：基于 tick 基线做增量合并，保证自动与手动升级共存。
- `balance`：调整理念稀有度分布，提高常见理念出现概率。

这三类组合常用于“稳定性修复 + 机制增强 + 数值微调”的小版本更新。
