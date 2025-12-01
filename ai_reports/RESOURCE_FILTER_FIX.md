# 资源显示过滤修复

## 问题描述
在游戏中，当某些资源还没有解锁时（基于时代或科技要求），这些资源不应该在建筑的输入/输出和民众的需求中显示。

## 解决方案

### 1. 创建资源解锁检查工具函数
**文件**: `src/utils/resources.js`

提供了两个工具函数：
- `isResourceUnlocked(resourceKey, epoch, techsUnlocked)`: 检查单个资源是否已解锁
- `filterUnlockedResources(resourcesObj, epoch, techsUnlocked)`: 过滤资源对象，只保留已解锁的资源

### 2. 修改的组件

#### BuildTab (建设标签页)
- 在显示建筑的输入/输出资源时，使用`filterUnlockedResources`过滤
- 只显示已解锁的资源流
- **注意**: 建筑成本不过滤，因为玩家需要知道建造需要什么资源

#### StratumDetailModal (阶层详情模态框)
- 在显示阶层资源需求时，使用`isResourceUnlocked`过滤
- 添加了`techsUnlocked`参数支持

#### MilitaryTab (军事标签页)
- 在显示军队维护成本时，使用`filterUnlockedResources`过滤
- 添加了`techsUnlocked`参数支持
- **注意**: 招募成本不过滤，因为玩家需要知道招募需要什么资源

### 3. 资源解锁逻辑

资源解锁需要满足以下条件：
1. **科技要求**: 如果资源有`unlockTech`属性，必须已研究该科技
2. **时代要求**: 如果资源有`unlockEpoch`属性，当前时代必须达到要求

### 4. 示例

```javascript
// 资源配置示例
{
  plank: { 
    name: "木板", 
    unlockEpoch: 1, 
    unlockTech: 'tools' 
  }
}

// 在石器时代（epoch 0），即使研究了tools科技，木板也不会显示
// 在青铜时代（epoch 1），如果没有研究tools科技，木板也不会显示
// 只有在青铜时代且研究了tools科技后，木板才会显示
```

## 测试建议

1. 在石器时代，查看建筑的输入/输出，确认不显示青铜时代的资源
2. 升级到青铜时代但不研究科技，确认需要科技解锁的资源不显示
3. 研究科技后，确认对应资源正确显示
4. 查看阶层详情，确认只显示已解锁的资源需求
5. 查看军队维护成本，确认只显示已解锁的资源

## 相关文件

- `src/utils/resources.js` - 资源解锁检查工具函数
- `src/components/tabs/BuildTab.jsx` - 建设标签页
- `src/components/modals/StratumDetailModal.jsx` - 阶层详情模态框
- `src/components/tabs/MilitaryTab.jsx` - 军事标签页
- `src/App.jsx` - 主应用组件（传递参数）
- `src/logic/simulation.js` - 游戏逻辑（已有资源过滤）
