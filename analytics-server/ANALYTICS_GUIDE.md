# civ-game 数据分析查询手册

## 数据库连接

```
主机: 你的MySQL服务器IP
端口: 3306
数据库: civ_analytics
```

---

## 数据表结构

### sessions — 会话表

| 字段 | 类型 | 说明 |
|---|---|---|
| user_id | VARCHAR(64) | 匿名玩家ID（浏览器生成的UUID） |
| session_id | VARCHAR(64) | 本次会话ID |
| app_version | VARCHAR(32) | 游戏版本 |
| difficulty | VARCHAR(32) | 难度 |
| scenario | VARCHAR(64) | 剧本 |
| user_agent | TEXT | 浏览器UA |
| started_at | DATETIME | 会话开始时间 |
| ended_at | DATETIME | 会话结束时间（页面关闭时写入） |
| last_seen | DATETIME | 最后心跳时间（每60秒更新） |
| duration_ms | INT | 会话时长（毫秒） |

### design_events — 设计事件表（核心数据）

| 字段 | 类型 | 说明 |
|---|---|---|
| user_id | VARCHAR(64) | 匿名玩家ID |
| session_id | VARCHAR(64) | 会话ID |
| event_id | VARCHAR(128) | 事件名（冒号分层），如 `Building:Buy:farm` |
| event_value | DOUBLE | 数值，含义取决于事件类型 |
| epoch | VARCHAR(32) | 当前时代 |
| days_elapsed | INT | 游戏内天数 |
| created_at | DATETIME | 事件时间 |

### resource_events — 资源收支表

| 字段 | 类型 | 说明 |
|---|---|---|
| flow_type | ENUM | `source`（收入）或 `sink`（支出） |
| currency | VARCHAR(32) | 货币：silver / science / culture |
| amount | INT | 数量 |
| item_type | VARCHAR(32) | 来源类型：tax / trade / building / military … |
| item_id | VARCHAR(64) | 具体项目ID |

### error_events — 错误表

| 字段 | 类型 | 说明 |
|---|---|---|
| severity | VARCHAR(16) | debug / info / warning / error / critical |
| message | TEXT | 错误信息 |

---

## event_id 完整索引

所有 design_events 的 `event_id` 遵循 `类别:子类:具体项` 的命名规则。

### 游戏生命周期

| event_id 格式 | event_value | 说明 |
|---|---|---|
| `Game:NewGame:easy` | — | 新建游戏，最后一段为难度 |
| `Game:Load` | daysElapsed | 读档 |
| `Game:Save` | daysElapsed | 手动存档 |
| `Game:AutoSave` | daysElapsed | 自动存档 |
| `Game:Reset` | daysElapsed | 重置游戏 |
| `Game:Export` | — | 导出存档 |
| `Game:Import` | — | 导入存档 |
| `Game:Difficulty:hard` | — | 选择难度 |
| `Game:Scenario:freeplay` | — | 选择剧本 |

### 建筑

| event_id 格式 | event_value | 说明 |
|---|---|---|
| `Building:Buy:farm` | 银两花费 | 购买建筑 |
| `Building:Sell:farm` | — | 卖出建筑 |
| `Building:Upgrade:farm` | 当前等级 | 升级建筑 |
| `Building:Downgrade:farm` | 当前等级 | 降级建筑 |
| `Building:BatchUpgrade:farm` | 升级数量 | 批量升级 |
| `Building:BatchDown:farm` | 降级数量 | 批量降级 |

### 科技

| event_id 格式 | event_value | 说明 |
|---|---|---|
| `Tech:Research:bronze_working` | 科研花费 | 研究科技 |

### 时代

| event_id 格式 | event_value | 说明 |
|---|---|---|
| `Epoch:Upgrade:1` | daysElapsed | 升级到新时代 |

### 外交

| event_id 格式 | event_value | 说明 |
|---|---|---|
| `Diplomacy:DeclareWar:nationId` | — | 宣战 |
| `Diplomacy:Peace:nationId` | — | 和平 |
| `Diplomacy:Treaty:nationId` | — | 条约 |
| `Diplomacy:TradeRoute:nationId` | — | 贸易路线 |
| `Diplomacy:Alliance:nationId` | — | 联盟 |
| `Diplomacy:Vassal:nationId` | — | 附庸 |
| `Diplomacy:Gift:nationId` | — | 赠礼 |
| `Diplomacy:Trade:nationId` | — | 交易 |
| `Diplomacy:Annex:nationId` | — | 吞并 |
| `Vassal:Approve:action:nationId` | — | 批准附庸外交 |
| `Vassal:Reject:action:nationId` | — | 拒绝附庸外交 |
| `Vassal:Order:actionType:nationId` | — | 下达附庸指令 |
| `Peace:Accept:nationId` | — | 接受和约 |
| `Peace:Reject:nationId` | — | 拒绝和约 |
| `Peace:Propose:nationId` | — | 提出和约 |

### 军事

| event_id 格式 | event_value | 说明 |
|---|---|---|
| `Military:Recruit:unitId` | 数量 | 招募 |
| `Military:Battle:Launch` | — | 发起战斗 |
| `Military:Battle:Victory` / `Defeat` | 损失率 | 战斗结果 |
| `Military:Disband:unitId` | 数量 | 解散 |
| `Military:DisbandAll` | 总数 | 全部解散 |
| `Military:CancelTrain:unitId` | — | 取消训练 |
| `Military:CancelAll` | 队列长度 | 取消全部训练 |
| `Military:AutoReplenish:on/off` | — | 自动补充开关 |
| `Military:WageRatio` | 百分比 | 军饷倍率 |

### 政治

| event_id 格式 | event_value | 说明 |
|---|---|---|
| `Strategic:type:stratumId` | — | 策略行动 |
| `Decree:Toggle:decreeId` | — | 法令开关 |
| `Rebellion:phase:stratumId` | 组织度 | 叛乱阶段 |
| `Rebellion:Action:action:stratumId` | — | 叛乱处置 |
| `Rebellion:Coalition:stratumId` | — | 联合叛乱 |
| `Official:Hire` | — | 雇佣官员 |
| `Official:Fire` | — | 解雇官员 |
| `Official:Salary` | 薪俸值 | 调整薪俸 |
| `Official:Minister:role` | — | 大臣任命 |
| `Coalition:Change` | 成员数 | 执政联盟变动 |

### 税收与贸易

| event_id 格式 | event_value | 说明 |
|---|---|---|
| `Tax:Change:taxType:stratum` | 税率百分比 | 调整税率 |
| `Policy:PriceControl:resource` | 控制价格 | 价格管制 |
| `Trade:Preference:direction:resource` | — | 贸易偏好 |
| `Trade:Merchant:nationId` | 商人数 | 商人分配 |
| `Trade:RouteMode:nationId:mode` | — | 贸易路线模式 |

### 事件与理念

| event_id 格式 | event_value | 说明 |
|---|---|---|
| `Event:Choose:eventId:optionId` | — | 事件选项 |
| `Ideology:Equip:ideologyId` | — | 装备理念 |
| `Ideology:Unequip:ideologyId` | — | 卸下理念 |
| `Achievement:Unlock:achievementId` | daysElapsed | 解锁成就 |

### 周期采样指标（每30游戏日记录一次）

| event_id | event_value | 说明 |
|---|---|---|
| `Economy:GDP` | GDP值 | 国内生产总值 |
| `Economy:CPI` | CPI指数 | 消费者价格指数 |
| `Economy:PPI` | PPI指数 | 生产者价格指数 |
| `Economy:Treasury` | 银两余额 | 国库 |
| `Economy:Crisis:bankruptcy` | 0 | 破产 |
| `Economy:Crisis:hyperinflation` | CPI值 | 恶性通胀 |
| `Population:Total` | 人口数 | 总人口 |
| `Population:Milestone:1000` | 人口数 | 人口里程碑 |
| `Population:Starvation` | 死亡数 | 饥荒死亡 |
| `Stability:Level` | 稳定度 | 稳定度采样 |
| `Stability:LevelChange:critical` | 稳定度 | 稳定度等级变化 |
| `Military:ArmySize` | 军队人数 | 军队规模 |

### 经济流水（每30游戏日汇总）

| event_id | event_value | 说明 |
|---|---|---|
| `EconFlow:Tax` | 银两 | 税收收入 |
| `EconFlow:Trade` | 银两 | 贸易收入 |
| `EconFlow:Military` | 银两 | 军事开支 |
| `EconFlow:Building` | 银两 | 建筑维护 |
| `EconFlow:Official` | 银两 | 官员薪俸 |

### 市场价格（每30游戏日采样）

| event_id | event_value | 说明 |
|---|---|---|
| `Price:food` | 价格 | 食物价格 |
| `Price:wood` | 价格 | 木材价格 |
| `Price:stone` | 价格 | 石材价格 |
| `Price:iron` | 价格 | 铁矿价格 |
| `Price:cloth` | 价格 | 布匹价格 |
| `Price:tools` | 价格 | 工具价格 |

### 诉求与组织度

| event_id 格式 | event_value | 说明 |
|---|---|---|
| `Demand:Generate:type:stratumKey` | — | 诉求生成 |
| `Demand:Complete:type` | 完成天数 | 诉求完成 |
| `Demand:Fail:type` | — | 诉求失败 |
| `Organization:Phase:stratum:phase` | 组织度 | 组织度阶段变化 |

### UI 导航

| event_id 格式 | event_value | 说明 |
|---|---|---|
| `UI:Tab:overview` | — | 切换主标签 |
| `UI:SubTab:military:units` | — | 切换子标签 |
| `UI:Speed:2` | — | 切换游戏速度 |
| `UI:Pause` | — | 暂停 |
| `UI:Resume` | — | 继续 |
| `UI:Pin:Building:farm` | — | 置顶建筑 |
| `UI:Filter:Building:production` | — | 筛选建筑分类 |
| `UI:Tutorial` | — | 打开教程 |
| `UI:Wiki` | — | 打开百科 |
| `UI:Settings` | — | 打开设置 |

---

## 常用查询速查

以下所有查询直接复制到 MySQL 客户端执行即可。完整版见 `queries.sql`。

### 实时在线

```sql
-- 当前在线玩家数（2分钟内有心跳）
SELECT COUNT(DISTINCT user_id) AS online_now
FROM sessions WHERE last_seen > DATE_SUB(NOW(), INTERVAL 2 MINUTE);

-- 在线玩家详情
SELECT user_id, TIMESTAMPDIFF(MINUTE, started_at, NOW()) AS minutes, last_seen
FROM sessions WHERE last_seen > DATE_SUB(NOW(), INTERVAL 2 MINUTE)
ORDER BY started_at DESC;
```

### 用户概览

```sql
-- 今日 DAU
SELECT COUNT(DISTINCT user_id) FROM sessions WHERE DATE(started_at) = CURDATE();

-- 每个玩家总游戏时长（小时）
SELECT user_id, ROUND(SUM(duration_ms)/3600000, 2) AS hours, COUNT(*) AS sessions
FROM sessions WHERE duration_ms IS NOT NULL
GROUP BY user_id ORDER BY hours DESC LIMIT 20;
```

### 游戏平衡

```sql
-- 最热门建筑 Top 10
SELECT SUBSTRING_INDEX(event_id, ':', -1) AS building, COUNT(*) AS cnt
FROM design_events WHERE event_id LIKE 'Building:Buy:%'
GROUP BY building ORDER BY cnt DESC LIMIT 10;

-- GDP 趋势
SELECT DATE(created_at) AS day, ROUND(AVG(event_value)) AS avg_gdp
FROM design_events WHERE event_id = 'Economy:GDP'
GROUP BY day ORDER BY day DESC LIMIT 14;

-- CPI 趋势
SELECT DATE(created_at) AS day, ROUND(AVG(event_value), 2) AS avg_cpi
FROM design_events WHERE event_id = 'Economy:CPI'
GROUP BY day ORDER BY day DESC LIMIT 14;

-- 物价
SELECT DATE(created_at) AS day,
    ROUND(AVG(CASE WHEN event_id='Price:food' THEN event_value END),2) AS food,
    ROUND(AVG(CASE WHEN event_id='Price:iron' THEN event_value END),2) AS iron
FROM design_events WHERE event_id LIKE 'Price:%'
GROUP BY day ORDER BY day DESC LIMIT 14;
```

### 玩家行为

```sql
-- 事件选项偏好
SELECT event_id, COUNT(*) AS cnt FROM design_events
WHERE event_id LIKE 'Event:Choose:%' GROUP BY event_id ORDER BY cnt DESC LIMIT 20;

-- 时代到达率
SELECT SUBSTRING_INDEX(event_id,':',-1) AS epoch, COUNT(DISTINCT user_id) AS players
FROM design_events WHERE event_id LIKE 'Epoch:Upgrade:%' GROUP BY epoch ORDER BY players DESC;

-- 最常研究的科技
SELECT SUBSTRING_INDEX(event_id,':',-1) AS tech, COUNT(*) AS cnt
FROM design_events WHERE event_id LIKE 'Tech:Research:%' GROUP BY tech ORDER BY cnt DESC LIMIT 10;
```

### 错误监控

```sql
-- 严重错误 Top 10
SELECT LEFT(message, 100) AS msg, COUNT(*) AS cnt, MAX(created_at) AS last_seen
FROM error_events WHERE severity IN ('error','critical')
GROUP BY msg ORDER BY cnt DESC LIMIT 10;
```

---

## 自定义查询技巧

### 按事件类别筛选

所有 event_id 都以 `类别:` 开头，用 `LIKE` 匹配：

```sql
-- 所有外交事件
WHERE event_id LIKE 'Diplomacy:%'

-- 所有军事事件
WHERE event_id LIKE 'Military:%'

-- 所有周期采样
WHERE event_id LIKE 'Economy:%' OR event_id LIKE 'Price:%' OR event_id LIKE 'Population:%'
```

### 提取事件中的具体项

```sql
-- 第一段（类别）
SUBSTRING_INDEX(event_id, ':', 1)

-- 最后一段（具体ID）
SUBSTRING_INDEX(event_id, ':', -1)

-- 第二段（子类别）
SUBSTRING_INDEX(SUBSTRING_INDEX(event_id, ':', 2), ':', -1)
```

### 按时间范围

```sql
-- 最近7天
WHERE created_at > DATE_SUB(NOW(), INTERVAL 7 DAY)

-- 某一天
WHERE DATE(created_at) = '2026-03-26'

-- 某个小时
WHERE created_at BETWEEN '2026-03-26 14:00:00' AND '2026-03-26 15:00:00'
```

### 按玩家筛选

```sql
-- 查看某个玩家的所有行为
WHERE user_id = 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'
ORDER BY created_at
```
