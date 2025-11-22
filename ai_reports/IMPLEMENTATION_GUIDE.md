# 游戏系统扩展实现指南

## 概述

本文档提供了如何在游戏中实际使用新增系统的快速指南。

---

## 一、配置文件导入

### 1.1 导入所有配置

```javascript
// 方式1: 从统一入口导入
import {
  COUNTRIES,
  DECREES,
  INDUSTRY_CHAINS,
  NATION_DECREE_SYNERGIES,
  CHAIN_CLASS_INTERACTION,
  DECREE_COMBINATIONS
} from './config';

// 方式2: 从具体文件导入
import { COUNTRIES } from './config/countries';
import { DECREES } from './config/decrees';
import { INDUSTRY_CHAINS } from './config/industryChains';
import { NATION_DECREE_SYNERGIES } from './config/systemSynergies';
```

### 1.2 配置文件结构

```
src/config/
├── index.js                 # 统一导出入口
├── gameData.js             # 游戏数据集合
├── countries.js            # 国家配置 (扩展)
├── decrees.js              # 政令配置 (扩展)
├── industryChains.js       # 产业链系统 (新增)
└── systemSynergies.js      # 系统联动 (新增)
```

---

## 二、国家系统使用

### 2.1 获取国家信息

```javascript
// 获取所有国家
const allCountries = COUNTRIES;

// 根据时代筛选国家
const currentEpochCountries = COUNTRIES.filter(
  country => country.appearEpoch <= currentEpoch && 
             country.expireEpoch > currentEpoch
);

// 获取特定国家
const nation = COUNTRIES.find(c => c.id === 'silk_empire');
```

### 2.2 应用国家特性

```javascript
// 检查国家特殊能力
if (nation.specialAbilities) {
  nation.specialAbilities.forEach(ability => {
    switch(ability.type) {
      case 'trade_bonus':
        tradeIncome *= (1 + ability.value);
        break;
      case 'military_bonus':
        militaryPower *= (1 + ability.value);
        break;
      // ... 其他能力类型
    }
  });
}

// 应用经济偏好
const resourceBias = nation.economyTraits.resourceBias;
Object.keys(resourceBias).forEach(resource => {
  marketPrices[resource] *= resourceBias[resource];
});
```

### 2.3 国家与政令联动

```javascript
import { NATION_DECREE_SYNERGIES } from './config/systemSynergies';

// 获取国家对政令的影响
const nationSynergy = NATION_DECREE_SYNERGIES[currentNation.id];

if (nationSynergy && nationSynergy.enhanced_decrees) {
  const enhancement = nationSynergy.enhanced_decrees[decreeId];
  if (enhancement) {
    // 应用增强效果
    applyBonus(enhancement.bonus);
  }
}

if (nationSynergy && nationSynergy.restricted_decrees) {
  const restriction = nationSynergy.restricted_decrees[decreeId];
  if (restriction) {
    // 应用限制惩罚
    applyPenalty(restriction.penalty);
  }
}
```

---

## 三、政令系统使用

### 3.1 激活政令

```javascript
// 检查政令是否可用
const decree = DECREES.find(d => d.id === decreeId);

if (decree.unlockEpoch <= currentEpoch) {
  // 检查行政成本
  if (canAfford(decree.cost)) {
    // 激活政令
    decree.active = true;
    
    // 应用效果
    applyDecreeEffects(decree);
    
    // 检查协同效果
    checkDecreSynergies();
  }
}
```

### 3.2 应用政令效果

```javascript
function applyDecreeEffects(decree) {
  const modifiers = decree.modifiers;
  
  // 被动资源产出
  if (modifiers.passive) {
    Object.keys(modifiers.passive).forEach(resource => {
      resourceRates[resource] += modifiers.passive[resource];
    });
  }
  
  // 类别加成
  if (modifiers.categories) {
    Object.keys(modifiers.categories).forEach(category => {
      categoryBonus[category] += modifiers.categories[category];
    });
  }
  
  // 建筑加成
  if (modifiers.buildings) {
    Object.keys(modifiers.buildings).forEach(building => {
      buildingBonus[building] += modifiers.buildings[building];
    });
  }
  
  // 阶层好感度
  if (modifiers.classApproval) {
    Object.keys(modifiers.classApproval).forEach(classKey => {
      classApproval[classKey] += modifiers.classApproval[classKey];
    });
  }
}
```

### 3.3 检查政令组合

```javascript
import { DECREE_COMBINATIONS } from './config/systemSynergies';

function checkDecreSynergies() {
  const activeDecrees = DECREES.filter(d => d.active).map(d => d.id);
  
  // 检查协同组合
  DECREE_COMBINATIONS.synergies.forEach(combo => {
    const hasAll = combo.decrees.every(d => activeDecrees.includes(d));
    if (hasAll) {
      console.log(`激活组合: ${combo.name}`);
      applyBonus(combo.bonus);
      if (combo.penalty) {
        applyPenalty(combo.penalty);
      }
    }
  });
  
  // 检查冲突组合
  DECREE_COMBINATIONS.conflicts.forEach(conflict => {
    const hasAll = conflict.decrees.every(d => activeDecrees.includes(d));
    if (hasAll) {
      console.warn(`政令冲突: ${conflict.name}`);
      applyPenalty(conflict.penalty);
    }
  });
}
```

### 3.4 阶层反馈机制

```javascript
import { CLASS_DECREE_FEEDBACK } from './config/systemSynergies';

function applyClassFeedback(classKey, decreeId) {
  const approval = classApproval[classKey];
  const feedback = CLASS_DECREE_FEEDBACK.class_specific[classKey];
  
  if (feedback && feedback.affects_decrees.includes(decreeId)) {
    if (approval >= CLASS_DECREE_FEEDBACK.high_approval.threshold) {
      // 高好感度加成
      applyBonus(feedback.high_approval_bonus);
    } else if (approval <= CLASS_DECREE_FEEDBACK.low_approval.threshold) {
      // 低好感度惩罚
      applyPenalty(feedback.low_approval_penalty);
    }
  }
}
```

---

## 四、产业链系统使用

### 4.1 获取产业链信息

```javascript
import { INDUSTRY_CHAINS } from './config/industryChains';

// 获取特定产业链
const foodChain = INDUSTRY_CHAINS.food_chain;

// 检查产业链是否解锁
if (foodChain.unlockEpoch <= currentEpoch) {
  // 产业链可用
}
```

### 4.2 计算产业链效率

```javascript
function calculateChainEfficiency(chainId) {
  const chain = INDUSTRY_CHAINS[chainId];
  let efficiency = 1.0;
  
  // 检查各阶段是否完整
  const stagesComplete = chain.stages.every(stage => {
    return stage.buildings.some(b => buildings[b] > 0);
  });
  
  if (stagesComplete) {
    // 完整产业链加成
    efficiency *= (1 + CHAIN_SYNERGIES.complete_chain.bonus.efficiency);
  }
  
  // 检查规模经济
  const totalBuildings = chain.stages.reduce((sum, stage) => {
    return sum + stage.buildings.reduce((s, b) => s + (buildings[b] || 0), 0);
  }, 0);
  
  CHAIN_SYNERGIES.economy_of_scale.thresholds.forEach(threshold => {
    if (totalBuildings >= threshold.count) {
      efficiency *= (1 + (threshold.bonus.efficiency || 0));
    }
  });
  
  // 检查瓶颈
  const hasBottleneck = checkChainBottleneck(chain);
  if (hasBottleneck) {
    efficiency *= (1 + CHAIN_BOTTLENECKS[hasBottleneck].penalty.efficiency);
  }
  
  return efficiency;
}
```

### 4.3 应用产业链升级

```javascript
function upgradeChain(chainId, upgradeId) {
  const chain = INDUSTRY_CHAINS[chainId];
  const upgrade = chain.upgrades.find(u => u.id === upgradeId);
  
  if (!upgrade) return false;
  
  // 检查解锁条件
  if (upgrade.unlockEpoch > currentEpoch) {
    return false;
  }
  
  // 检查成本
  if (!canAfford(upgrade.cost)) {
    return false;
  }
  
  // 扣除成本
  deductResources(upgrade.cost);
  
  // 应用加成
  applyBonus(upgrade.bonus);
  
  // 标记已升级
  if (!chain.activeUpgrades) {
    chain.activeUpgrades = [];
  }
  chain.activeUpgrades.push(upgradeId);
  
  return true;
}
```

### 4.4 产业链与阶层互动

```javascript
import { CHAIN_CLASS_INTERACTION } from './config/systemSynergies';

function updateChainClassEffects(chainId, level) {
  const interaction = CHAIN_CLASS_INTERACTION[chainId];
  
  if (!interaction) return;
  
  // 应用发展效果
  const effects = interaction.development_effects[`level_${level}`];
  if (effects) {
    // 更新阶层好感度
    if (effects.classApproval) {
      Object.keys(effects.classApproval).forEach(classKey => {
        classApproval[classKey] += effects.classApproval[classKey];
      });
    }
    
    // 更新阶层财富
    if (effects.wealth) {
      Object.keys(effects.wealth).forEach(classKey => {
        classWealth[classKey] += effects.wealth[classKey];
      });
    }
    
    // 其他效果
    if (effects.culture) {
      cultureBonus += effects.culture;
    }
    if (effects.science) {
      scienceBonus += effects.science;
    }
  }
}
```

### 4.5 产业链发展路径

```javascript
import { CHAIN_DEVELOPMENT_PATHS } from './config/industryChains';

function chooseDevelopmentPath(chainId, pathId) {
  const paths = CHAIN_DEVELOPMENT_PATHS[chainId];
  if (!paths) return false;
  
  const path = paths.paths.find(p => p.id === pathId);
  if (!path) return false;
  
  // 检查需求
  if (path.requirements.epoch > currentEpoch) {
    return false;
  }
  
  if (path.requirements.tech) {
    const hasTech = path.requirements.tech.every(t => 
      techsUnlocked.includes(t)
    );
    if (!hasTech) return false;
  }
  
  // 应用路径效果
  applyBonus(path.effects);
  
  // 记录选择的路径
  if (!INDUSTRY_CHAINS[chainId].activePath) {
    INDUSTRY_CHAINS[chainId].activePath = pathId;
  }
  
  return true;
}
```

---

## 五、系统联动使用

### 5.1 时代系统效果

```javascript
import { EPOCH_SYSTEM_EFFECTS } from './config/systemSynergies';

function onEpochChange(newEpoch) {
  const epochEffects = EPOCH_SYSTEM_EFFECTS[newEpoch];
  
  // 更新可用产业链
  availableChains = epochEffects.available_chains;
  
  // 调整阶层结构
  targetClassStructure = epochEffects.class_structure;
  
  // 更新政令效率
  decreeEfficiencyMultiplier = epochEffects.decree_efficiency;
  
  // 解锁新机制
  if (epochEffects.new_mechanics) {
    epochEffects.new_mechanics.forEach(mechanic => {
      unlockMechanic(mechanic);
    });
  }
}
```

### 5.2 动态平衡机制

```javascript
import { BALANCE_MECHANISMS } from './config/systemSynergies';

function applyBalanceMechanisms() {
  // 阶层平衡
  Object.keys(classInfluence).forEach(classKey => {
    const influence = classInfluence[classKey] / totalInfluence;
    
    // 主导阶层惩罚
    if (influence > BALANCE_MECHANISMS.class_balance.dominant_class_penalty.threshold) {
      const penalty = BALANCE_MECHANISMS.class_balance.dominant_class_penalty.effects;
      classInfluence[classKey] *= (1 - penalty.influence_decay);
      
      // 其他阶层加成
      Object.keys(classInfluence).forEach(otherClass => {
        if (otherClass !== classKey) {
          classInfluence[otherClass] *= (1 + penalty.other_class_bonus);
        }
      });
    }
    
    // 弱势阶层保护
    if (influence < BALANCE_MECHANISMS.class_balance.weak_class_protection.threshold) {
      const protection = BALANCE_MECHANISMS.class_balance.weak_class_protection.effects;
      classInfluence[classKey] *= (1 + protection.influence_boost);
      classApproval[classKey] += protection.approval_bonus;
    }
  });
  
  // 经济平衡
  const silverGrowth = (currentSilver - lastSilver) / lastSilver;
  if (silverGrowth > BALANCE_MECHANISMS.economic_balance.inflation.trigger.silver_growth) {
    const inflation = BALANCE_MECHANISMS.economic_balance.inflation.effects;
    applyInflation(inflation);
  }
  
  // 军事平衡
  const militarySpending = militaryCost / totalIncome;
  if (militarySpending > BALANCE_MECHANISMS.military_balance.over_militarization.threshold.military_spending) {
    const penalty = BALANCE_MECHANISMS.military_balance.over_militarization.effects;
    applyPenalty(penalty);
  }
}
```

### 5.3 随机事件触发

```javascript
import { SYSTEM_TRIGGERED_EVENTS } from './config/systemSynergies';

function checkTriggeredEvents() {
  // 检查产业链事件
  Object.keys(SYSTEM_TRIGGERED_EVENTS.chain_events).forEach(eventKey => {
    const event = SYSTEM_TRIGGERED_EVENTS.chain_events[eventKey];
    
    // 检查触发条件
    let canTrigger = true;
    Object.keys(event.trigger).forEach(condition => {
      if (!checkCondition(condition, event.trigger[condition])) {
        canTrigger = false;
      }
    });
    
    if (canTrigger && Math.random() < event.probability) {
      triggerEvent(event);
    }
  });
  
  // 检查阶层事件
  Object.keys(SYSTEM_TRIGGERED_EVENTS.class_events).forEach(eventKey => {
    const event = SYSTEM_TRIGGERED_EVENTS.class_events[eventKey];
    
    let canTrigger = true;
    Object.keys(event.trigger).forEach(condition => {
      if (!checkCondition(condition, event.trigger[condition])) {
        canTrigger = false;
      }
    });
    
    if (canTrigger && Math.random() < event.probability) {
      triggerEvent(event);
    }
  });
}

function triggerEvent(event) {
  console.log(`事件触发: ${event.desc}`);
  
  // 应用事件效果
  Object.keys(event.effects).forEach(effect => {
    if (effect === 'duration') return;
    
    applyTemporaryEffect(effect, event.effects[effect], event.effects.duration);
  });
}
```

---

## 六、实用工具函数

### 6.1 效果应用函数

```javascript
// 应用加成
function applyBonus(bonus) {
  Object.keys(bonus).forEach(key => {
    switch(key) {
      case 'production':
        productionMultiplier += bonus[key];
        break;
      case 'efficiency':
        efficiencyMultiplier += bonus[key];
        break;
      case 'tradeIncome':
        tradeIncomeMultiplier += bonus[key];
        break;
      case 'classApproval':
        Object.keys(bonus[key]).forEach(classKey => {
          if (classKey === 'all') {
            Object.keys(classApproval).forEach(c => {
              classApproval[c] += bonus[key][classKey];
            });
          } else {
            classApproval[classKey] += bonus[key][classKey];
          }
        });
        break;
      case 'passive':
        Object.keys(bonus[key]).forEach(resource => {
          resourceRates[resource] += bonus[key][resource];
        });
        break;
      case 'categories':
        Object.keys(bonus[key]).forEach(category => {
          categoryBonus[category] += bonus[key][category];
        });
        break;
      // ... 其他效果类型
    }
  });
}

// 应用惩罚
function applyPenalty(penalty) {
  // 惩罚通常是负值加成
  applyBonus(penalty);
}
```

### 6.2 条件检查函数

```javascript
function checkCondition(condition, value) {
  switch(condition) {
    case 'epoch':
      return currentEpoch >= value;
    case 'chain_level':
      return getChainLevel(currentChain) >= value;
    case 'class_approval':
      return classApproval[currentClass] <= value;
    case 'class_influence':
      return (classInfluence[currentClass] / totalInfluence) >= value;
    case 'nation_relation':
      return nationRelations[currentNation] >= value;
    case 'science':
      return resources.science >= value;
    case 'culture':
      return resources.culture >= value;
    case 'stability':
      return stability >= value;
    // ... 其他条件
    default:
      return true;
  }
}
```

### 6.3 资源检查函数

```javascript
function canAfford(cost) {
  return Object.keys(cost).every(resource => {
    return resources[resource] >= cost[resource];
  });
}

function deductResources(cost) {
  Object.keys(cost).forEach(resource => {
    resources[resource] -= cost[resource];
  });
}
```

---

## 七、UI集成建议

### 7.1 国家选择界面

```javascript
// 显示可用国家
function renderNationSelection() {
  const availableNations = COUNTRIES.filter(
    c => c.appearEpoch <= currentEpoch && c.expireEpoch > currentEpoch
  );
  
  return (
    <div className="nation-selection">
      {availableNations.map(nation => (
        <NationCard
          key={nation.id}
          nation={nation}
          onSelect={() => selectNation(nation.id)}
        />
      ))}
    </div>
  );
}
```

### 7.2 政令管理界面

```javascript
// 显示政令列表
function renderDecreePanel() {
  const availableDecrees = DECREES.filter(
    d => d.unlockEpoch <= currentEpoch
  );
  
  return (
    <div className="decree-panel">
      {availableDecrees.map(decree => (
        <DecreeCard
          key={decree.id}
          decree={decree}
          active={decree.active}
          canAfford={canAfford(decree.cost)}
          onToggle={() => toggleDecree(decree.id)}
        />
      ))}
    </div>
  );
}
```

### 7.3 产业链可视化

```javascript
// 显示产业链状态
function renderIndustryChain(chainId) {
  const chain = INDUSTRY_CHAINS[chainId];
  const efficiency = calculateChainEfficiency(chainId);
  
  return (
    <div className="industry-chain">
      <h3>{chain.name}</h3>
      <p>{chain.desc}</p>
      <div className="efficiency">效率: {(efficiency * 100).toFixed(0)}%</div>
      
      <div className="stages">
        {chain.stages.map((stage, index) => (
          <StageCard
            key={index}
            stage={stage}
            buildings={buildings}
          />
        ))}
      </div>
      
      <div className="upgrades">
        {chain.upgrades.map(upgrade => (
          <UpgradeButton
            key={upgrade.id}
            upgrade={upgrade}
            unlocked={upgrade.unlockEpoch <= currentEpoch}
            active={chain.activeUpgrades?.includes(upgrade.id)}
            onUpgrade={() => upgradeChain(chainId, upgrade.id)}
          />
        ))}
      </div>
    </div>
  );
}
```

---

## 八、性能优化建议

### 8.1 缓存计算结果

```javascript
// 缓存产业链效率
const chainEfficiencyCache = {};

function getCachedChainEfficiency(chainId) {
  if (!chainEfficiencyCache[chainId] || 
      chainEfficiencyCache[chainId].timestamp < Date.now() - 1000) {
    chainEfficiencyCache[chainId] = {
      value: calculateChainEfficiency(chainId),
      timestamp: Date.now()
    };
  }
  return chainEfficiencyCache[chainId].value;
}
```

### 8.2 批量更新

```javascript
// 批量应用效果
function batchApplyEffects(effects) {
  const batch = {};
  
  effects.forEach(effect => {
    Object.keys(effect).forEach(key => {
      if (!batch[key]) batch[key] = 0;
      batch[key] += effect[key];
    });
  });
  
  applyBonus(batch);
}
```

### 8.3 事件节流

```javascript
// 限制事件检查频率
let lastEventCheck = 0;
const EVENT_CHECK_INTERVAL = 5000; // 5秒

function throttledEventCheck() {
  const now = Date.now();
  if (now - lastEventCheck > EVENT_CHECK_INTERVAL) {
    checkTriggeredEvents();
    lastEventCheck = now;
  }
}
```

---

## 九、调试工具

### 9.1 系统状态查看

```javascript
// 打印当前系统状态
function debugSystemState() {
  console.log('=== 系统状态 ===');
  console.log('当前时代:', currentEpoch);
  console.log('当前国家:', currentNation?.name);
  console.log('激活政令:', DECREES.filter(d => d.active).map(d => d.name));
  console.log('产业链效率:', 
    Object.keys(INDUSTRY_CHAINS).map(id => ({
      name: INDUSTRY_CHAINS[id].name,
      efficiency: calculateChainEfficiency(id)
    }))
  );
  console.log('阶层好感度:', classApproval);
  console.log('阶层影响力:', classInfluence);
}
```

### 9.2 效果追踪

```javascript
// 追踪效果来源
const effectSources = {};

function trackEffect(source, effect, value) {
  if (!effectSources[effect]) {
    effectSources[effect] = [];
  }
  effectSources[effect].push({ source, value });
}

function debugEffectSources(effect) {
  console.log(`=== ${effect} 效果来源 ===`);
  if (effectSources[effect]) {
    effectSources[effect].forEach(({ source, value }) => {
      console.log(`${source}: ${value > 0 ? '+' : ''}${value}`);
    });
  }
}
```

---

## 十、常见问题

### Q1: 如何添加新国家？
在 `countries.js` 中添加新的国家对象，确保包含所有必需字段。

### Q2: 如何创建新的政令组合？
在 `systemSynergies.js` 的 `DECREE_COMBINATIONS` 中添加新的协同或冲突组合。

### Q3: 如何调整产业链平衡？
修改 `industryChains.js` 中的效率值、升级加成和瓶颈惩罚。

### Q4: 如何测试系统联动？
使用调试工具函数查看当前状态，并手动触发不同条件测试效果。

### Q5: 性能问题如何优化？
使用缓存、批量更新和事件节流等技术，减少不必要的计算。

---

## 总结

本指南提供了新增系统的实际使用方法，包括：
- 配置文件的导入和使用
- 各系统的核心功能实现
- UI集成建议
- 性能优化技巧
- 调试工具

通过遵循本指南，可以快速将新系统集成到游戏中，并确保良好的性能和用户体验。
