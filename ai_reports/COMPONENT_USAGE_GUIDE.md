# 📦 组件使用快速参考

## 🎯 自定义钩子

### useGameState
```javascript
import { useGameState } from './hooks';

const gameState = useGameState();
// 返回所有游戏状态和状态更新函数
```

### useGameLoop
```javascript
import { useGameLoop } from './hooks';

useGameLoop(gameState, addLog);
// 自动处理游戏循环逻辑
```

### useGameActions
```javascript
import { useGameActions } from './hooks';

const actions = useGameActions(gameState, addLog);
// 返回所有游戏操作函数
```

---

## 🎨 面板组件

### ResourcePanel
```javascript
<ResourcePanel 
  resources={gameState.resources} 
  rates={gameState.rates} 
/>
```

### StrataPanel
```javascript
<StrataPanel 
  popStructure={gameState.popStructure}
  classApproval={gameState.classApproval}
  classInfluence={gameState.classInfluence}
  stability={gameState.stability}
  onDetailClick={(key) => gameState.setStratumDetailView(key)}
/>
```

### LogPanel
```javascript
<LogPanel logs={gameState.logs} />
```

---

## 📑 标签页组件

### BuildTab
```javascript
<BuildTab
  buildings={gameState.buildings}
  resources={gameState.resources}
  epoch={gameState.epoch}
  techsUnlocked={gameState.techsUnlocked}
  onBuy={actions.buyBuilding}
  onSell={actions.sellBuilding}
/>
```

### MilitaryTab
```javascript
<MilitaryTab
  army={gameState.army}
  militaryQueue={gameState.militaryQueue}
  resources={gameState.resources}
  epoch={gameState.epoch}
  population={gameState.population}
  adminCap={gameState.adminCap}
  nations={gameState.nations}
  selectedTarget={gameState.selectedTarget}
  onRecruit={actions.recruitUnit}
  onDisband={actions.disbandUnit}
  onSelectTarget={gameState.setSelectedTarget}
  onLaunchBattle={actions.launchBattle}
/>
```

### TechTab
```javascript
<TechTab
  techsUnlocked={gameState.techsUnlocked}
  epoch={gameState.epoch}
  resources={gameState.resources}
  population={gameState.population}
  onResearch={actions.researchTech}
  onUpgradeEpoch={actions.upgradeEpoch}
  canUpgradeEpoch={actions.canUpgradeEpoch}
/>
```

### PoliticsTab
```javascript
<PoliticsTab
  decrees={gameState.decrees}
  onToggle={actions.toggleDecree}
/>
```

### DiplomacyTab
```javascript
<DiplomacyTab
  nations={gameState.nations}
/>
```

---

## 🔔 模态框组件

### BattleResultModal
```javascript
<BattleResultModal
  result={gameState.battleResult}
  onClose={() => gameState.setBattleResult(null)}
/>
```

### StratumDetailModal
```javascript
<StratumDetailModal
  stratumKey={gameState.stratumDetailView}
  popStructure={gameState.popStructure}
  classApproval={gameState.classApproval}
  classInfluence={gameState.classInfluence}
  classWealth={gameState.classWealth}
  totalInfluence={gameState.totalInfluence}
  totalWealth={gameState.totalWealth}
  activeBuffs={gameState.activeBuffs}
  activeDebuffs={gameState.activeDebuffs}
  onClose={() => gameState.setStratumDetailView(null)}
/>
```

---

## 🎮 完整使用示例

```javascript
import React from 'react';
import { useGameState, useGameLoop, useGameActions } from './hooks';
import {
  ResourcePanel,
  StrataPanel,
  LogPanel,
  BuildTab,
  MilitaryTab,
  TechTab,
  PoliticsTab,
  DiplomacyTab,
  BattleResultModal,
  StratumDetailModal,
  CityMap,
  FloatingText,
} from './components';

export default function RiseOfCivs() {
  // 1. 使用状态管理钩子
  const gameState = useGameState();
  
  // 2. 添加日志函数
  const addLog = (msg) => {
    gameState.setLogs(prev => [msg, ...prev].slice(0, 8));
  };
  
  // 3. 使用游戏循环钩子
  useGameLoop(gameState, addLog);
  
  // 4. 使用操作函数钩子
  const actions = useGameActions(gameState, addLog);

  return (
    <div className="min-h-screen bg-gray-900 text-white flex">
      {/* 左侧边栏 */}
      <aside className="w-80 bg-gray-800 p-4 space-y-4 overflow-y-auto">
        <ResourcePanel 
          resources={gameState.resources} 
          rates={gameState.rates} 
        />
        
        <StrataPanel 
          popStructure={gameState.popStructure}
          classApproval={gameState.classApproval}
          classInfluence={gameState.classInfluence}
          stability={gameState.stability}
          onDetailClick={(key) => gameState.setStratumDetailView(key)}
        />
        
        <LogPanel logs={gameState.logs} />
      </aside>

      {/* 主内容区 */}
      <main className="flex-1 p-6 overflow-y-auto">
        {/* 标签页导航 */}
        <div className="mb-6">
          <div className="flex gap-2">
            {['build', 'military', 'tech', 'politics', 'diplomacy'].map(tab => (
              <button
                key={tab}
                onClick={() => gameState.setActiveTab(tab)}
                className={`px-4 py-2 rounded ${
                  gameState.activeTab === tab
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {tab === 'build' && '建设'}
                {tab === 'military' && '军事'}
                {tab === 'tech' && '科技'}
                {tab === 'politics' && '政令'}
                {tab === 'diplomacy' && '外交'}
              </button>
            ))}
          </div>
        </div>

        {/* 标签页内容 */}
        {gameState.activeTab === 'build' && (
          <BuildTab
            buildings={gameState.buildings}
            resources={gameState.resources}
            epoch={gameState.epoch}
            techsUnlocked={gameState.techsUnlocked}
            onBuy={actions.buyBuilding}
            onSell={actions.sellBuilding}
          />
        )}

        {gameState.activeTab === 'military' && (
          <MilitaryTab
            army={gameState.army}
            militaryQueue={gameState.militaryQueue}
            resources={gameState.resources}
            epoch={gameState.epoch}
            population={gameState.population}
            adminCap={gameState.adminCap}
            nations={gameState.nations}
            selectedTarget={gameState.selectedTarget}
            onRecruit={actions.recruitUnit}
            onDisband={actions.disbandUnit}
            onSelectTarget={gameState.setSelectedTarget}
            onLaunchBattle={actions.launchBattle}
          />
        )}

        {gameState.activeTab === 'tech' && (
          <TechTab
            techsUnlocked={gameState.techsUnlocked}
            epoch={gameState.epoch}
            resources={gameState.resources}
            population={gameState.population}
            onResearch={actions.researchTech}
            onUpgradeEpoch={actions.upgradeEpoch}
            canUpgradeEpoch={actions.canUpgradeEpoch}
          />
        )}

        {gameState.activeTab === 'politics' && (
          <PoliticsTab
            decrees={gameState.decrees}
            onToggle={actions.toggleDecree}
          />
        )}

        {gameState.activeTab === 'diplomacy' && (
          <DiplomacyTab
            nations={gameState.nations}
          />
        )}
      </main>

      {/* 模态框 */}
      {gameState.battleResult && (
        <BattleResultModal
          result={gameState.battleResult}
          onClose={() => gameState.setBattleResult(null)}
        />
      )}

      {gameState.stratumDetailView && (
        <StratumDetailModal
          stratumKey={gameState.stratumDetailView}
          popStructure={gameState.popStructure}
          classApproval={gameState.classApproval}
          classInfluence={gameState.classInfluence}
          classWealth={gameState.classWealth}
          totalInfluence={gameState.totalInfluence}
          totalWealth={gameState.totalWealth}
          activeBuffs={gameState.activeBuffs}
          activeDebuffs={gameState.activeDebuffs}
          onClose={() => gameState.setStratumDetailView(null)}
        />
      )}

      {/* 浮动文本 */}
      {gameState.clicks.map(click => (
        <FloatingText key={click.id} {...click} />
      ))}
    </div>
  );
}
```

---

## 📝 注意事项

1. **导入顺序**
   - 先导入钩子
   - 再导入组件
   - 保持代码整洁

2. **状态管理**
   - 使用 `useGameState` 集中管理状态
   - 避免在组件中直接使用 `useState`
   - 保持状态的单一数据源

3. **操作函数**
   - 使用 `useGameActions` 提供的函数
   - 不要在组件中直接修改状态
   - 保持数据流的单向性

4. **性能优化**
   - 可以使用 `React.memo` 优化组件
   - 可以使用 `useMemo` 和 `useCallback` 优化计算
   - 避免不必要的重渲染

---

## 🔗 相关文档

- [APP_REFACTORING_PHASE2_COMPLETE.md](./APP_REFACTORING_PHASE2_COMPLETE.md) - 第二阶段完成报告
- [APP_REFACTORING_PHASE1_COMPLETE.md](./APP_REFACTORING_PHASE1_COMPLETE.md) - 第一阶段完成报告
- [CODE_STRUCTURE.md](./CODE_STRUCTURE.md) - 代码结构参考
