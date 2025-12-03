# 视觉风格迁移指南 - Visual Style Migration Guide

## 📋 概述

本指南帮助你将现有组件升级到新的史诗视觉风格系统。

---

## 🔄 快速迁移步骤

### 1. 更新容器样式

#### 旧样式
```jsx
<div className="bg-gray-900/80 backdrop-blur-md rounded-xl border border-white/10">
  内容
</div>
```

#### 新样式
```jsx
<div className="glass-ancient rounded-xl">
  内容
</div>
```

或使用EpicCard组件：
```jsx
<EpicCard variant="ancient">
  内容
</EpicCard>
```

---

### 2. 更新文本样式

#### 旧样式
```jsx
<h2 className="text-2xl font-bold text-white">标题</h2>
```

#### 新样式
```jsx
<h2 className="text-2xl font-bold text-ancient">标题</h2>
// 或
<h2 className="text-2xl font-bold text-epic">史诗标题</h2>
// 或
<h2 className="text-2xl font-bold text-monument">纪念碑标题</h2>
```

---

### 3. 更新按钮样式

#### 旧样式
```jsx
<button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg">
  按钮
</button>
```

#### 新样式
```jsx
<button className="btn-ancient">
  按钮
</button>
// 或
<button className="btn-epic">
  史诗按钮
</button>
```

---

### 4. 添加装饰元素

#### 为卡片添加角落装饰
```jsx
import { CornerOrnament } from './components/common/EpicDecorations';

<div className="relative glass-ancient rounded-xl p-6">
  <CornerOrnament position="top-left" className="text-amber-500/60" />
  <CornerOrnament position="top-right" className="text-amber-500/60" />
  <CornerOrnament position="bottom-left" className="text-amber-500/60" />
  <CornerOrnament position="bottom-right" className="text-amber-500/60" />
  
  内容
</div>
```

#### 添加分隔线
```jsx
import { DiamondDivider } from './components/common/EpicDecorations';

<div>
  <h3>第一部分</h3>
  <DiamondDivider className="text-amber-500" />
  <h3>第二部分</h3>
</div>
```

---

### 5. 更新动画

#### 旧样式
```jsx
<div className="transition-all duration-300 hover:scale-105">
  内容
</div>
```

#### 新样式
```jsx
<div className="card-ancient">
  内容
</div>
// 自动包含悬停效果和动画
```

或使用专门的动画类：
```jsx
<div className="animate-epic-entrance">
  入场动画
</div>

<div className="animate-pulse-gold">
  金色脉冲
</div>
```

---

## 🎨 组件迁移示例

### 资源面板 (Resource Panel)

#### 旧代码
```jsx
<div className="bg-gray-900/60 backdrop-blur-md rounded-xl border border-white/10 p-4">
  <h3 className="text-lg font-bold text-white mb-3">资源</h3>
  <div className="space-y-2">
    {resources.map(resource => (
      <div key={resource.id} className="flex justify-between">
        <span>{resource.name}</span>
        <span>{resource.amount}</span>
      </div>
    ))}
  </div>
</div>
```

#### 新代码
```jsx
import { EpicCard, DiamondDivider } from './components/common/EpicDecorations';

<EpicCard variant="ancient" className="p-4">
  <h3 className="text-lg font-bold text-ancient mb-3">资源</h3>
  <DiamondDivider className="text-amber-500/50 mb-3" />
  <div className="space-y-2">
    {resources.map(resource => (
      <div key={resource.id} className="flex justify-between hover:text-ancient transition-colors">
        <span>{resource.name}</span>
        <span className="text-ancient">{resource.amount}</span>
      </div>
    ))}
  </div>
</EpicCard>
```

---

### 建筑卡片 (Building Card)

#### 旧代码
```jsx
<div className="bg-gray-800 rounded-lg p-4 hover:bg-gray-700 transition-colors">
  <h4 className="font-bold text-white">{building.name}</h4>
  <p className="text-gray-400 text-sm">{building.description}</p>
  <button className="mt-2 px-3 py-1 bg-blue-600 rounded">
    建造
  </button>
</div>
```

#### 新代码
```jsx
import { ResourceIconFrame } from './components/common/EpicDecorations';

<div className="card-ancient p-4">
  <div className="flex items-center gap-3 mb-2">
    <ResourceIconFrame rarity="rare">
      <Icon name={building.icon} size={32} />
    </ResourceIconFrame>
    <h4 className="font-bold text-ancient">{building.name}</h4>
  </div>
  <p className="text-gray-300 text-sm mb-3">{building.description}</p>
  <button className="btn-ancient w-full">
    建造
  </button>
</div>
```

---

### 模态框 (Modal)

#### 旧代码
```jsx
<div className="fixed inset-0 bg-black/70 flex items-center justify-center">
  <div className="bg-gray-900 rounded-xl p-6 max-w-md">
    <h2 className="text-xl font-bold mb-4">标题</h2>
    <p>内容</p>
    <button className="mt-4 px-4 py-2 bg-blue-600 rounded">
      确定
    </button>
  </div>
</div>
```

#### 新代码
```jsx
import { ScrollBanner, EpicCard } from './components/common/EpicDecorations';

<div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center animate-fade-in">
  <EpicCard variant="monument" className="p-8 max-w-md animate-scale-in">
    <ScrollBanner className="mb-6">
      <h2 className="text-xl font-bold text-monument">标题</h2>
    </ScrollBanner>
    <p className="text-gray-200 mb-6">内容</p>
    <button className="btn-epic w-full">
      确定
    </button>
  </EpicCard>
</div>
```

---

## 🎯 常见场景迁移

### 1. 列表项悬停效果

#### 旧样式
```jsx
<div className="hover:bg-gray-700 transition-colors cursor-pointer">
  列表项
</div>
```

#### 新样式
```jsx
<div className="hover:bg-ancient-gold/10 hover:text-ancient transition-all cursor-pointer hover:translate-x-1">
  列表项
</div>
```

---

### 2. 状态指示器

#### 旧样式
```jsx
<div className={`w-3 h-3 rounded-full ${
  status === 'active' ? 'bg-green-500' : 'bg-red-500'
}`} />
```

#### 新样式
```jsx
<div className={`w-3 h-3 rounded-full ${
  status === 'active' 
    ? 'bg-ancient-gold shadow-glow-gold animate-pulse-gold' 
    : 'bg-ancient-bronze opacity-50'
}`} />
```

---

### 3. 进度条

#### 旧样式
```jsx
<div className="w-full bg-gray-700 rounded-full h-2">
  <div 
    className="bg-blue-500 h-2 rounded-full transition-all"
    style={{ width: `${progress}%` }}
  />
</div>
```

#### 新样式
```jsx
<div className="w-full bg-ancient-ink/50 rounded-full h-2 border border-ancient-gold/20">
  <div 
    className="bg-gradient-to-r from-ancient-bronze to-ancient-gold h-2 rounded-full transition-all shadow-glow-gold"
    style={{ width: `${progress}%` }}
  />
</div>
```

---

### 4. 标签页导航

#### 旧样式
```jsx
<div className="flex border-b border-gray-700">
  {tabs.map(tab => (
    <button
      key={tab.id}
      className={`px-4 py-2 ${
        activeTab === tab.id 
          ? 'border-b-2 border-blue-500 text-white' 
          : 'text-gray-400'
      }`}
    >
      {tab.label}
    </button>
  ))}
</div>
```

#### 新样式
```jsx
<div className="flex border-b border-ancient-gold/20">
  {tabs.map(tab => (
    <button
      key={tab.id}
      className={`px-4 py-2 transition-all ${
        activeTab === tab.id 
          ? 'border-b-2 border-ancient-gold text-ancient shadow-glow-gold' 
          : 'text-gray-400 hover:text-ancient-gold/70'
      }`}
    >
      {tab.label}
    </button>
  ))}
</div>
```

---

## 📱 响应式迁移

### 移动端优化

#### 旧样式
```jsx
<div className="p-4 md:p-6 lg:p-8">
  内容
</div>
```

#### 新样式
```jsx
<div className="p-4 md:p-6 lg:p-8 glass-ancient md:glass-epic">
  内容
</div>
```

### 触摸友好按钮

#### 旧样式
```jsx
<button className="px-3 py-1 text-sm">
  按钮
</button>
```

#### 新样式
```jsx
<button className="btn-ancient min-h-[48px] min-w-[48px] px-4 py-2">
  按钮
</button>
```

---

## ⚡ 性能优化建议

### 1. 条件装饰
```jsx
import { getDeviceType } from './config/epicTheme';

const isDesktop = getDeviceType() === 'desktop';

<div className="glass-ancient">
  {isDesktop && (
    <>
      <CornerOrnament position="top-left" />
      <CornerOrnament position="top-right" />
    </>
  )}
  内容
</div>
```

### 2. 懒加载装饰
```jsx
import { lazy, Suspense } from 'react';

const EpicCard = lazy(() => import('./components/common/EpicDecorations'));

<Suspense fallback={<div className="glass-ancient p-6">加载中...</div>}>
  <EpicCard variant="epic">
    内容
  </EpicCard>
</Suspense>
```

### 3. 减少动画
```jsx
import { PERFORMANCE_CONFIG } from './config/epicTheme';

<div className={`glass-ancient ${
  PERFORMANCE_CONFIG.reduceMotion ? '' : 'animate-epic-entrance'
}`}>
  内容
</div>
```

---

## 🎨 颜色迁移对照表

| 旧颜色 | 新颜色 | 用途 |
|--------|--------|------|
| `text-white` | `text-ancient` | 主要文本 |
| `text-gray-400` | `text-gray-300` | 次要文本 |
| `bg-gray-900` | `glass-ancient` | 主要背景 |
| `bg-gray-800` | `glass-epic` | 次要背景 |
| `border-white/10` | `border-ancient-gold/20` | 边框 |
| `bg-blue-600` | `bg-ancient-gold` | 主要按钮 |
| `text-blue-500` | `text-ancient-gold` | 强调文本 |
| `shadow-lg` | `shadow-ancient` | 阴影 |

---

## ✅ 迁移检查清单

- [ ] 更新所有容器为玻璃拟态样式
- [ ] 更新文本颜色为古代主题色
- [ ] 更新按钮为史诗按钮样式
- [ ] 添加角落装饰到重要卡片
- [ ] 添加分隔线到内容区域
- [ ] 更新动画为史诗动画
- [ ] 优化移动端触摸区域
- [ ] 测试响应式布局
- [ ] 检查性能表现
- [ ] 验证可访问性

---

## 🚀 批量迁移脚本

可以使用以下正则表达式进行批量替换：

### 1. 背景样式
```regex
查找: bg-gray-900/\d+\s+backdrop-blur-md
替换: glass-ancient
```

### 2. 文本颜色
```regex
查找: text-white(?!\/)
替换: text-ancient
```

### 3. 边框
```regex
查找: border-white/10
替换: border-ancient-gold/20
```

---

## 💡 提示

1. **渐进式迁移**: 不需要一次性迁移所有组件，可以逐步更新
2. **保持一致性**: 同一页面的组件使用相同的视觉风格
3. **测试优先**: 每次迁移后都要测试功能是否正常
4. **性能监控**: 注意装饰元素对性能的影响
5. **用户反馈**: 收集用户对新视觉风格的反馈

---

## 📞 需要帮助？

- 查看 `EPIC_VISUAL_STYLE.md` 了解完整的视觉系统
- 查看 `src/components/common/EpicDecorations.jsx` 了解所有装饰组件
- 查看 `src/index.css` 了解所有CSS工具类

---

**祝迁移顺利！** 🎨✨
