# Civ 机制答疑检索指引

## 检索优先级

1. `src/logic`: 机制主流程与数值演算。
2. `src/config`: 静态配置、阈值、解锁条件、事件池。
3. `src/utils`: 通用计算与格式转换。
4. `src/hooks`: 状态流转、循环驱动、与 UI 交互。
5. `src/components`: 仅用于确认展示逻辑、按钮触发与文案映射。

## 常见问题到目录映射

- 经济/价格/税收/工资: `src/logic/economy`, `src/utils/economy.js`
- 人口/就业/需求: `src/logic/population`
- 稳定度/支持度/buff: `src/logic/stability`
- 外交/战争/AI: `src/logic/diplomacy`
- 事件触发/事件效果: `src/config/events`, `src/utils/eventEffectFilter.js`
- 建筑与升级: `src/config/buildings.js`, `src/config/buildingUpgrades.js`, `src/logic/buildings`
- 科技/时代/法令: `src/config/technologies.js`, `src/config/epochs.js`, `src/config/decrees.js`

## 推荐检索方式

优先使用 `rg`，先关键词再符号名：

```bash
rg "关键词" src
rg "函数名|常量名|字段名" src/logic src/config src/utils src/hooks
```

对关键结论至少做一次反向检索，确认没有被其他模块覆盖修正。
