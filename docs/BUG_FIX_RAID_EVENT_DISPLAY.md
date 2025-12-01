# 突袭事件显示方式修复文档

## 问题描述

突袭事件的结算与显示方式与正常战斗不一致，需要使用与`BattleResultModal`相同的显示方式。

## 修复方案

### 1. 修改 useGameActions.js

**文件：** `src/hooks/useGameActions.js`

将`setBattleResult`添加到返回值中，以便在`useGameLoop`中使用：

```javascript
return {
  // ... 其他函数
  
  // 战斗结果
  setBattleResult,
};
```

### 2. 修改 useGameLoop.js

**文件：** `src/hooks/useGameLoop.js`

#### 修改1：移除不需要的导入

移除`createBattleEvent`导入，因为现在直接使用`setBattleResult`：

```javascript
import { createEnemyPeaceRequestEvent } from '../config/events';
```

#### 修改2：修改突袭事件处理逻辑

将突袭事件从简单的事件弹窗改为使用`BattleResultModal`：

```javascript
// 检测突袭事件（使用BattleResultModal显示）
if (log.includes('的突袭')) {
  const match = log.match(/❗ (.+) 的突袭夺走了粮食 (\d+)、银币 (\d+)，人口损失 (\d+)/);
  if (match) {
    const nationName = match[1];
    const foodLoss = parseInt(match[2], 10);
    const silverLoss = parseInt(match[3], 10);
    const popLoss = parseInt(match[4], 10);
    const nation = result.nations?.find(n => n.name === nationName);
    
    if (nation && currentActions.setBattleResult) {
      // 构造符合BattleResultModal要求的battleResult对象
      const battleResult = {
        victory: false,
        missionName: `${nation.name}的突袭`,
        missionDesc: '敌方趁你不备发动了突袭！',
        nationName: nation.name,
        ourPower: 0,
        enemyPower: 0,
        powerRatio: 0,
        score: 0,
        losses: {},
        attackerLosses: {},
        enemyLosses: {},
        defenderLosses: {},
        resourcesGained: {},
        description: `${nation.name}趁你不备发动了突袭！他们掠夺了你的资源并造成了人员伤亡。\n\n突袭损失：\n粮食：-${foodLoss}\n银币：-${silverLoss}\n人口：-${popLoss}`,
        // 添加突袭特有的损失信息
        foodLoss,
        silverLoss,
        popLoss,
        isRaid: true, // 标记这是突袭事件
      };
      
      currentActions.setBattleResult(battleResult);
    }
  }
}
```

### 3. 修改 BattleResultModal.jsx

**文件：** `src/components/modals/BattleResultModal.jsx`

#### 修改1：隐藏战斗统计（突袭事件）

在突袭事件中不显示战力对比：

```javascript
{/* 战斗统计（仅在非突袭事件中显示） */}
{!result.isRaid && (
  <div className="bg-gray-700/50 rounded p-2 border border-gray-600">
    {/* ... 战斗统计内容 ... */}
  </div>
)}
```

#### 修改2：隐藏我方军队损失（突袭事件）

在突袭事件中不显示军队损失：

```javascript
{/* 我方损失（仅在非突袭事件中显示军队损失） */}
{!result.isRaid && (
  <div className="bg-gray-700/50 rounded p-2 border border-gray-600">
    {/* ... 我方损失内容 ... */}
  </div>
)}
```

#### 修改3：隐藏敌方损失（突袭事件）

在突袭事件中不显示敌方损失：

```javascript
{/* 敌方损失（仅在非突袭事件中显示） */}
{!result.isRaid && result.enemyLosses && Object.keys(result.enemyLosses).length > 0 && (
  <div className="bg-gray-700/50 rounded p-2 border border-gray-600">
    {/* ... 敌方损失内容 ... */}
  </div>
)}
```

#### 修改4：添加资源损失显示（突袭事件）

在突袭事件中显示资源损失：

```javascript
{/* 资源损失（突袭事件） */}
{result.isRaid && (result.foodLoss > 0 || result.silverLoss > 0) && (
  <div className="bg-gray-700/50 rounded p-2 border border-gray-600">
    <h3 className="text-[10px] font-bold mb-1.5 flex items-center gap-1 text-white">
      <Icon name="AlertTriangle" size={12} className="text-red-400" />
      资源损失
    </h3>
    <div className="grid grid-cols-2 gap-1.5">
      {result.foodLoss > 0 && (
        <div className="flex items-center justify-between bg-red-900/20 border border-red-600/30 p-1.5 rounded">
          <span className="text-[10px] text-gray-300 leading-none">粮食</span>
          <span className="text-[10px] font-bold text-red-400 font-mono leading-none">-{result.foodLoss}</span>
        </div>
      )}
      {result.silverLoss > 0 && (
        <div className="flex items-center justify-between bg-red-900/20 border border-red-600/30 p-1.5 rounded">
          <span className="text-[10px] text-gray-300 leading-none">银币</span>
          <span className="text-[10px] font-bold text-red-400 font-mono leading-none">-{result.silverLoss}</span>
        </div>
      )}
    </div>
  </div>
)}
```

#### 修改5：添加人口损失显示（突袭事件）

在突袭事件中显示人口损失：

```javascript
{/* 人口损失（突袭事件） */}
{result.isRaid && result.popLoss > 0 && (
  <div className="bg-gray-700/50 rounded p-2 border border-gray-600">
    <h3 className="text-[10px] font-bold mb-1.5 flex items-center gap-1 text-white">
      <Icon name="Users" size={12} className="text-red-400" />
      人口损失
    </h3>
    <div className="bg-red-900/20 border border-red-600/30 p-1.5 rounded">
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-gray-300 leading-none">总人口</span>
        <span className="text-[10px] font-bold text-red-400 font-mono leading-none">-{result.popLoss}</span>
      </div>
    </div>
  </div>
)}
```

## 修复效果

### 突袭事件显示

现在突袭事件会使用`BattleResultModal`显示，包含：

1. **标题**：显示"💀 战斗失败..."和突袭国家名称
2. **资源损失**：显示粮食和银币的损失
3. **人口损失**：显示总人口损失
4. **战斗描述**：显示突袭的详细描述

### 与正常战斗的区别

突袭事件不显示：
- 战斗统计（战力对比）
- 我方军队损失
- 敌方军队损失
- 战利品

## 技术要点

### battleResult对象结构

突袭事件的`battleResult`对象包含以下特殊字段：

```javascript
{
  victory: false,           // 突袭总是失败
  isRaid: true,            // 标记为突袭事件
  foodLoss: number,        // 粮食损失
  silverLoss: number,      // 银币损失
  popLoss: number,         // 人口损失
  missionName: string,     // 任务名称
  missionDesc: string,     // 任务描述
  nationName: string,      // 敌国名称
  description: string,     // 详细描述
  // ... 其他标准字段
}
```

### 条件渲染

使用`result.isRaid`标志来区分突袭事件和正常战斗：

```javascript
{!result.isRaid && (
  // 仅在正常战斗中显示
)}

{result.isRaid && (
  // 仅在突袭事件中显示
)}
```

## 测试步骤

1. 与AI国家开战
2. 等待AI发起突袭（概率事件）
3. 验证突袭事件使用`BattleResultModal`显示
4. 确认显示内容包括：
   - 资源损失（粮食、银币）
   - 人口损失
   - 不显示战力对比
   - 不显示军队损失

## 相关文件

- `src/hooks/useGameActions.js` - 添加`setBattleResult`到返回值
- `src/hooks/useGameLoop.js` - 修改突袭事件处理逻辑
- `src/components/modals/BattleResultModal.jsx` - 添加突袭事件的特殊显示逻辑

## 后续优化建议

1. 移除调试日志（在生产环境中）
2. 考虑为突袭事件添加音效
3. 考虑为突袭事件添加动画效果
4. 统一所有战斗相关事件的显示方式
