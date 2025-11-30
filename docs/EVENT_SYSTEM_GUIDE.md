# 事件系统使用指南

## 概述

事件系统为游戏增加了随机事件机制，玩家需要在不同的选项中做出选择，每个选择都会产生不同的效果，影响游戏进程。

## 系统架构

### 1. 配置文件
- **位置**: `/src/config/events.js`
- **功能**: 定义所有事件的数据结构、触发条件和效果

### 2. 组件
- **EventDetail**: `/src/components/modals/EventDetail.jsx`
  - 使用BottomSheet实现多平台兼容
  - 显示事件详情和选项
  - 展示每个选项的效果预览

### 3. 状态管理
- **useGameState**: 添加了 `currentEvent` 和 `eventHistory` 状态
- **useGameActions**: 添加了 `triggerRandomEvent` 和 `handleEventOption` 方法

### 4. UI集成
- **App.jsx**: 集成事件显示的BottomSheet
- **GameControls**: 添加了测试按钮（可选）

## 事件数据结构

```javascript
{
  id: 'event_id',              // 事件唯一标识
  name: '事件名称',             // 事件标题
  icon: 'IconName',            // Lucide图标名称
  image: null,                 // 概览图片路径（可选）
  description: '事件详情...',   // 事件描述文本
  triggerConditions: {         // 触发条件（可选）
    minPopulation: 500,        // 最小人口
    minEpoch: 1,              // 最小时代
    minScience: 100,          // 最小科技值
    maxNobleApproval: 30,     // 最大贵族支持度
  },
  options: [                   // 事件选项数组
    {
      id: 'option_id',         // 选项ID
      text: '选项文本',         // 选项标题
      description: '选项描述',  // 选项详细说明
      effects: {               // 选项效果
        resources: {           // 资源变化
          food: -100,
          gold: 50,
        },
        population: -50,       // 人口变化
        stability: -5,         // 稳定度变化
        science: 20,          // 科技变化
        approval: {           // 阶层支持度变化
          peasant: -10,
          merchant: 15,
        },
      },
    },
    // ... 更多选项
  ],
}
```

## 添加新事件

### 步骤1: 在配置文件中定义事件

编辑 `/src/config/events.js`，在 `EVENTS` 数组中添加新事件：

```javascript
{
  id: 'my_new_event',
  name: '我的新事件',
  icon: 'Star',
  description: '这是一个新事件的描述...',
  triggerConditions: {
    minEpoch: 2,
  },
  options: [
    {
      id: 'option1',
      text: '选项一',
      description: '选择这个选项的说明',
      effects: {
        resources: { gold: 100 },
        stability: 5,
      },
    },
    {
      id: 'option2',
      text: '选项二',
      description: '选择这个选项的说明',
      effects: {
        resources: { gold: -50 },
        approval: { peasant: 20 },
      },
    },
  ],
}
```

### 步骤2: 测试事件

1. 启动游戏
2. 点击顶部控制栏的"事件"按钮（黄色闪电图标）
3. 查看事件是否正确显示
4. 选择不同选项，验证效果是否正确应用

## 触发机制

### 自动触发
- 游戏每30秒检查一次
- 如果游戏未暂停且没有事件正在显示
- 有10%的概率触发随机事件
- 只会触发满足条件的事件

### 手动触发（测试用）
- 点击GameControls中的"事件"按钮
- 立即触发一个随机事件

## 触发条件

事件可以设置以下触发条件：

- `minPopulation`: 最小人口数量
- `minEpoch`: 最小时代等级
- `minScience`: 最小科技点数
- `maxNobleApproval`: 最大贵族支持度（用于负面事件）

如果不设置 `triggerConditions`，事件可以在任何时候触发。

## 效果类型

事件选项可以产生以下效果：

### 1. 资源效果 (resources)
```javascript
resources: {
  food: 100,      // 增加食物
  gold: -50,      // 减少黄金
  wood: 200,      // 增加木材
  // ... 任何资源类型
}
```

### 2. 人口效果 (population)
```javascript
population: -100  // 减少100人口
```

### 3. 稳定度效果 (stability)
```javascript
stability: 10     // 增加10点稳定度
```

### 4. 科技效果 (science)
```javascript
science: 50       // 增加50点科技
```

### 5. 阶层支持度效果 (approval)
```javascript
approval: {
  peasant: 20,    // 农民支持度+20
  merchant: -10,  // 商人支持度-10
  noble: 5,       // 贵族支持度+5
}
```

## 事件历史

系统会自动记录玩家的事件选择历史：

```javascript
{
  eventId: 'plague_outbreak',
  eventName: '瘟疫爆发',
  optionId: 'quarantine',
  optionText: '实施严格隔离',
  timestamp: 1234567890,
  day: 365,
}
```

历史记录保存在 `gameState.eventHistory` 中，最多保留50条记录。

## 示例事件

配置文件中已包含以下示例事件：

1. **瘟疫爆发** - 需要处理疫情危机
2. **商队来访** - 贸易机会
3. **丰收之年** - 粮食丰收的处理
4. **贵族阴谋** - 政治危机
5. **技术突破** - 科技发展机会
6. **自然灾害** - 灾害应对

## 最佳实践

### 1. 平衡性
- 确保每个选项都有利弊
- 避免"明显最优"的选项
- 考虑长期和短期效果的平衡

### 2. 叙事性
- 编写引人入胜的事件描述
- 选项文本要清晰明了
- 效果要符合逻辑和游戏世界观

### 3. 触发条件
- 根据游戏进度设置合理的触发条件
- 避免在游戏早期触发过于复杂的事件
- 考虑事件与游戏状态的关联性

### 4. 效果设计
- 效果数值要与游戏规模相匹配
- 考虑玩家当前的资源状况
- 避免过于极端的效果（除非是特殊事件）

## 扩展建议

### 1. 事件链
可以创建相互关联的事件序列：

```javascript
// 第一个事件
{
  id: 'event_part1',
  // ... 
  options: [
    {
      id: 'option1',
      effects: {
        // 设置一个标记，用于触发后续事件
        eventFlags: { 'event_chain_started': true }
      }
    }
  ]
}

// 后续事件
{
  id: 'event_part2',
  triggerConditions: {
    eventFlags: { 'event_chain_started': true }
  },
  // ...
}
```

### 2. 时间限制
可以添加事件的时间限制：

```javascript
{
  id: 'timed_event',
  expiresAfter: 30, // 30天后自动消失
  // ...
}
```

### 3. 多次触发
某些事件可以设置为可重复触发：

```javascript
{
  id: 'repeatable_event',
  repeatable: true,
  cooldown: 100, // 100天后才能再次触发
  // ...
}
```

## 调试技巧

1. **查看事件历史**: 在浏览器控制台输入 `gameState.eventHistory`
2. **强制触发事件**: 点击"事件"测试按钮
3. **检查触发条件**: 在 `canTriggerEvent` 函数中添加 console.log
4. **验证效果**: 观察顶部状态栏的资源和支持度变化

## 注意事项

1. 事件ID必须唯一
2. 选项ID在同一事件内必须唯一
3. 图标名称必须是有效的Lucide图标
4. 资源类型必须在游戏中已定义
5. 阶层名称必须与游戏中的阶层配置匹配
6. 所有数值效果都会自动限制在合理范围内（如支持度0-100）

## 未来改进

- [ ] 添加事件图片支持
- [ ] 实现事件链系统
- [ ] 添加事件统计和成就
- [ ] 支持条件性选项（某些选项需要特定条件才能选择）
- [ ] 添加事件预览功能
- [ ] 实现事件编辑器
