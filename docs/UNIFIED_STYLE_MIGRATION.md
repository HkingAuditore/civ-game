# 统一样式系统迁移指南

## 📋 概述

本指南帮助你将现有组件迁移到新的统一样式系统，确保所有UI组件在桌面端和移动端保持一致的视觉风格。

## 🎯 核心原则

### 1. 样式统一
- 所有组件使用相同的配色方案（古代金色系）
- 统一的间距、圆角、阴影系统
- 一致的交互反馈（悬停、点击、禁用状态）

### 2. 响应式设计
- 移动端和桌面端使用相同的组件
- 通过Tailwind的响应式类实现适配
- 最小触摸区域44x44px（移动端标准）

### 3. 可访问性
- 足够的颜色对比度
- 清晰的视觉层次
- 明确的交互状态

## 🔄 迁移步骤

### 步骤1：导入统一样式

```jsx
// 旧代码
import React from 'react';
import { Icon } from './common/UIComponents';

// 新代码
import React from 'react';
import { Icon } from './common/UIComponents';
import { Button, Card, Badge } from './common/UnifiedUI';
import { cn } from '../config/unifiedStyles';
```

### 步骤2：替换按钮样式

#### 旧样式（需要替换）
```jsx
<button className="px-3 py-2 bg-gray-700/60 hover:bg-gray-600/60 text-gray-200 rounded-xl">
  按钮
</button>
```

#### 新样式（统一风格）
```jsx
<Button variant="primary" size="md">
  按钮
</Button>

// 或使用原生button + 统一样式
<button className={cn(
  'px-3 py-2 glass-ancient border border-ancient-gold/20',
  'text-ancient-parchment rounded-xl transition-all',
  'hover:border-ancient-gold/40 hover:glow-gold',
  'min-h-[44px]' // 移动端友好
)}>
  按钮
</button>
```

### 步骤3：替换卡片样式

#### 旧样式
```jsx
<div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
  内容
</div>
```

#### 新样式
```jsx
<Card variant="default" padding="md">
  内容
</Card>

// 或
<div className="glass-ancient border border-ancient-gold/20 rounded-xl p-4">
  内容
</div>
```

### 步骤4：替换弹窗样式

#### 旧样式
```jsx
<div className="fixed inset-0 bg-gray-900/80 z-50">
  <div className="bg-gray-800 border border-gray-700 rounded-2xl">
    {/* 内容 */}
  </div>
</div>
```

#### 新样式
```jsx
<Modal
  isOpen={isOpen}
  onClose={onClose}
  title="标题"
  size="md"
>
  {/* 内容 */}
</Modal>
```

## 🎨 样式替换对照表

### 颜色替换

| 旧样式 | 新样式 | 说明 |
|--------|--------|------|
| `bg-gray-900` | `bg-ancient-ink/90` | 深色背景 |
| `bg-gray-800` | `glass-ancient` | 中等背景（玻璃拟态） |
| `bg-gray-700` | `glass-ancient` | 浅色背景 |
| `text-gray-200` | `text-ancient-parchment` | 主要文字 |
| `text-gray-400` | `text-ancient-stone` | 次要文字 |
| `text-gray-500` | `text-ancient-stone/70` | 弱化文字 |
| `border-gray-700` | `border-ancient-gold/20` | 边框 |
| `border-gray-600` | `border-ancient-gold/30` | 强调边框 |

### 按钮变体

| 用途 | 旧样式 | 新样式 |
|------|--------|--------|
| 主要操作 | `bg-blue-600 text-white` | `variant="primary"` |
| 次要操作 | `bg-gray-700 text-gray-200` | `variant="secondary"` |
| 成功操作 | `bg-green-600 text-white` | `variant="success"` |
| 警告操作 | `bg-orange-600 text-white` | `variant="warning"` |
| 危险操作 | `bg-red-600 text-white` | `variant="danger"` |
| 幽灵按钮 | `bg-transparent border` | `variant="ghost"` |

### 卡片变体

| 用途 | 旧样式 | 新样式 |
|------|--------|--------|
| 普通卡片 | `bg-gray-800 border-gray-700` | `variant="default"` |
| 史诗卡片 | `bg-gray-800 border-2` | `variant="epic"` |
| 纪念碑卡片 | `bg-gray-900 border-2 shadow-2xl` | `variant="monument"` |
| 扁平卡片 | `bg-gray-800/50` | `variant="flat"` |

## 📝 常见模式

### 模式1：带图标的按钮

```jsx
// 旧代码
<button className="flex items-center gap-2 px-3 py-2 bg-gray-700 text-gray-200">
  <Icon name="Save" size={14} />
  <span>保存</span>
</button>

// 新代码
<Button 
  variant="primary" 
  size="md"
  icon={<Icon name="Save" size={14} />}
>
  保存
</Button>
```

### 模式2：悬停效果

```jsx
// 旧代码
<div className="p-3 hover:bg-gray-700/50 cursor-pointer">
  内容
</div>

// 新代码
<div className="p-3 hover:bg-ancient-gold/10 hover:border-ancient-gold/30 cursor-pointer transition-all">
  内容
</div>
```

### 模式3：禁用状态

```jsx
// 旧代码
<button 
  disabled={isDisabled}
  className={`px-3 py-2 ${isDisabled ? 'bg-gray-800 text-gray-500 cursor-not-allowed' : 'bg-blue-600 text-white'}`}
>
  按钮
</button>

// 新代码
<Button 
  variant="primary" 
  size="md"
  disabled={isDisabled}
>
  按钮
</Button>
```

### 模式4：列表项

```jsx
// 旧代码
<div className="flex items-center gap-3 p-3 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg">
  内容
</div>

// 新代码
<ListItem hover border>
  内容
</ListItem>
```

### 模式5：进度条

```jsx
// 旧代码
<div className="w-full h-2 bg-gray-700 rounded-full overflow-hidden">
  <div 
    className="h-full bg-blue-500 rounded-full"
    style={{ width: `${percentage}%` }}
  />
</div>

// 新代码
<ProgressBar 
  current={current} 
  max={max} 
  variant="default"
  showLabel
/>
```

## 🔧 实用工具

### cn() 函数

用于组合多个类名，自动过滤空值：

```jsx
import { cn } from '../config/unifiedStyles';

// 基础用法
<div className={cn('base-class', 'another-class')} />

// 条件类名
<div className={cn(
  'base-class',
  isActive && 'active-class',
  isDisabled && 'disabled-class'
)} />

// 合并外部类名
<div className={cn(baseStyles, className)} />
```

### 样式获取函数

```jsx
import { getButtonStyles, getCardStyles, getBadgeStyles } from '../config/unifiedStyles';

// 获取按钮样式
const buttonClass = getButtonStyles('primary', 'md', false);

// 获取卡片样式
const cardClass = getCardStyles('epic', 'lg', true);

// 获取徽章样式
const badgeClass = getBadgeStyles('success');
```

## 📱 移动端适配

### 响应式尺寸

```jsx
// 移动端小，桌面端大
<Button 
  size="sm" 
  className="sm:px-4 sm:py-2.5 lg:px-6 lg:py-3"
>
  按钮
</Button>

// 移动端隐藏文字，只显示图标
<Button variant="primary" size="md">
  <Icon name="Save" size={16} />
  <span className="hidden sm:inline">保存</span>
</Button>
```

### 触摸友好

```jsx
// 确保最小触摸区域
<button className="min-h-[44px] min-w-[44px] p-3">
  <Icon name="Menu" size={20} />
</button>

// 增大移动端间距
<div className="flex gap-2 sm:gap-3 lg:gap-4">
  {/* 内容 */}
</div>
```

## ✅ 检查清单

迁移完成后，检查以下项目：

- [ ] 所有 `bg-gray-*` 已替换为古代色系
- [ ] 所有 `text-gray-*` 已替换为古代色系
- [ ] 所有 `border-gray-*` 已替换为 `border-ancient-gold/*`
- [ ] 按钮最小高度为 44px（移动端友好）
- [ ] 悬停效果使用 `hover:bg-ancient-gold/10`
- [ ] 边框使用 `border-ancient-gold/20` 或更高透明度
- [ ] 玻璃拟态效果使用 `glass-ancient/epic/monument`
- [ ] 阴影使用 `shadow-ancient/epic/monument`
- [ ] 动画使用统一的动画类
- [ ] 移动端和桌面端样式一致

## 🎯 最佳实践

### 1. 优先使用组件

```jsx
// ✅ 推荐：使用统一组件
<Button variant="primary" size="md">操作</Button>

// ⚠️ 可接受：使用统一样式类
<button className={getButtonStyles('primary', 'md')}>操作</button>

// ❌ 避免：自定义样式
<button className="px-3 py-2 bg-blue-600 text-white">操作</button>
```

### 2. 保持一致性

```jsx
// ✅ 同一页面使用相同的卡片变体
<Card variant="epic" padding="md">卡片1</Card>
<Card variant="epic" padding="md">卡片2</Card>

// ❌ 避免混用不同变体
<Card variant="default">卡片1</Card>
<Card variant="epic">卡片2</Card>
```

### 3. 合理使用层级

```jsx
// ✅ 清晰的视觉层级
<Card variant="monument">  {/* 最高层级 */}
  <Card variant="epic">    {/* 中等层级 */}
    <Card variant="default"> {/* 基础层级 */}
      内容
    </Card>
  </Card>
</Card>
```

## 🐛 常见问题

### Q: 为什么我的按钮在移动端太小？
A: 确保添加 `min-h-[44px]` 类，这是移动端的最小触摸区域标准。

### Q: 如何在不同设备上使用不同的样式？
A: 使用Tailwind的响应式前缀：`sm:`, `md:`, `lg:`, `xl:`

```jsx
<div className="p-2 sm:p-3 md:p-4 lg:p-6">
  内容
</div>
```

### Q: 玻璃拟态效果不明显怎么办？
A: 确保父容器有背景，玻璃拟态需要背景才能显示效果。

### Q: 如何自定义颜色？
A: 在 `tailwind.config.js` 中扩展颜色配置，或使用 `style` 属性。

## 📚 参考资源

- [统一样式配置](../config/unifiedStyles.js)
- [统一UI组件](../components/common/UnifiedUI.jsx)
- [史诗装饰组件](../components/common/EpicDecorations.jsx)
- [动态效果组件](../components/common/DynamicEffects.jsx)
- [UI组件快速参考](./UI_COMPONENTS_REFERENCE.md)

## 🎉 完成

恭喜！你已经掌握了统一样式系统的使用方法。现在你的组件将拥有：

- ✨ 一致的视觉风格
- 📱 完美的移动端适配
- 🎨 史诗级的古代主题
- 🚀 流畅的交互体验

开始迁移你的组件吧！
