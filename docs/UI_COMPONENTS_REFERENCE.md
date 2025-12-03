# UI组件快速参考 - Quick Reference

## 🎨 动态效果组件 (DynamicEffects)

### FloatingParticles - 浮动粒子
```jsx
<FloatingParticles count={20} className="..." />
```
- `count`: 粒子数量 (默认: 20)
- `className`: 额外CSS类

### LightSweep - 光线扫描
```jsx
<LightSweep color="ancient-gold" className="..." />
```
- `color`: 光线颜色 (默认: 'ancient-gold')
- `className`: 额外CSS类

### BorderGlow - 边框光晕
```jsx
<BorderGlow intensity="medium" className="..." />
```
- `intensity`: 强度 ('low' | 'medium' | 'high')
- `className`: 额外CSS类

### GridBackground - 网格背景
```jsx
<GridBackground opacity={0.03} className="..." />
```
- `opacity`: 透明度 (默认: 0.03)
- `className`: 额外CSS类

### DynamicGradient - 动态渐变
```jsx
<DynamicGradient className="..." />
```
- `className`: 额外CSS类

### StarField - 星空背景
```jsx
<StarField count={50} className="..." />
```
- `count`: 星星数量 (默认: 50)
- `className`: 额外CSS类

### EpicBackground - 组合背景
```jsx
<EpicBackground 
  showParticles={true}
  showGrid={true}
  showGradient={true}
  showStars={false}
  className="..."
/>
```
- `showParticles`: 显示粒子 (默认: true)
- `showGrid`: 显示网格 (默认: true)
- `showGradient`: 显示渐变 (默认: true)
- `showStars`: 显示星空 (默认: false)

### HoverCard - 3D悬浮卡片
```jsx
<HoverCard className="...">
  {children}
</HoverCard>
```
- 自动添加3D倾斜效果

---

## 🎴 增强卡片组件 (EnhancedCards)

### EnhancedCard - 基础增强卡片
```jsx
<EnhancedCard
  variant="default"
  hover={true}
  glow={false}
  corners={false}
  pattern={false}
  className="..."
  onClick={handleClick}
>
  {children}
</EnhancedCard>
```
- `variant`: 变体 ('default' | 'primary' | 'success' | 'warning' | 'danger' | 'info')
- `hover`: 启用悬停效果 (默认: true)
- `glow`: 启用光晕效果 (默认: false)
- `corners`: 显示角落装饰 (默认: false)
- `pattern`: 显示背景图案 (默认: false)

### InfoCard - 信息卡片
```jsx
<InfoCard
  icon={<Icon name="Coins" size={24} />}
  title="标题"
  value="12,345"
  subtitle="副标题"
  trend={+123}
  color="ancient-gold"
  className="..."
/>
```
- `icon`: 图标元素
- `title`: 标题文字
- `value`: 主要数值
- `subtitle`: 副标题 (可选)
- `trend`: 趋势数值 (可选)
- `color`: 颜色主题 ('ancient-gold' | 'ancient-bronze' | 'blue' | 'green' | 'red' | 'purple')

### ListCard - 列表卡片
```jsx
<ListCard
  items={[...]}
  renderItem={(item, index) => <div>{item.name}</div>}
  emptyMessage="暂无数据"
  className="..."
/>
```
- `items`: 列表数据数组
- `renderItem`: 渲染函数
- `emptyMessage`: 空列表提示 (默认: '暂无数据')

### CollapsibleCard - 可折叠卡片
```jsx
<CollapsibleCard
  title="标题"
  icon={<Icon name="Hammer" size={20} />}
  defaultExpanded={true}
  badge="12"
  className="..."
>
  {children}
</CollapsibleCard>
```
- `title`: 标题文字
- `icon`: 图标元素 (可选)
- `defaultExpanded`: 默认展开 (默认: true)
- `badge`: 徽章文字 (可选)

### ActionCard - 操作卡片
```jsx
<ActionCard
  title="标题"
  description="描述文字"
  icon={<Icon name="Hammer" size={24} />}
  actionLabel="执行操作"
  onAction={handleAction}
  disabled={false}
  variant="primary"
  className="..."
/>
```
- `title`: 标题文字
- `description`: 描述文字 (可选)
- `icon`: 图标元素 (可选)
- `actionLabel`: 按钮文字
- `onAction`: 点击回调
- `disabled`: 禁用状态 (默认: false)
- `variant`: 按钮变体 ('primary' | 'default')

### ProgressCard - 进度卡片
```jsx
<ProgressCard
  title="标题"
  current={1234}
  max={2000}
  icon={<Icon name="Users" size={16} />}
  color="ancient-gold"
  showPercentage={true}
  className="..."
/>
```
- `title`: 标题文字
- `current`: 当前值
- `max`: 最大值
- `icon`: 图标元素 (可选)
- `color`: 进度条颜色 ('ancient-gold' | 'ancient-bronze' | 'blue' | 'green' | 'red' | 'purple')
- `showPercentage`: 显示百分比 (默认: true)

### CardGrid - 网格容器
```jsx
<CardGrid cols={3} gap={4} className="...">
  {children}
</CardGrid>
```
- `cols`: 列数 (1 | 2 | 3 | 4)
- `gap`: 间距 (默认: 4)

---

## 🎭 史诗装饰组件 (EpicDecorations)

### EpicCard - 史诗卡片
```jsx
<EpicCard variant="ancient" className="...">
  {children}
</EpicCard>
```
- `variant`: 变体 ('ancient' | 'epic' | 'monument')

### DiamondDivider - 钻石分隔线
```jsx
<DiamondDivider className="..." />
```

### CornerOrnament - 角落装饰
```jsx
<CornerOrnament 
  position="top-left" 
  size={24} 
  className="..." 
/>
```
- `position`: 位置 ('top-left' | 'top-right' | 'bottom-left' | 'bottom-right')
- `size`: 尺寸 (默认: 24)

### AncientPattern - 古代图案
```jsx
<AncientPattern opacity={0.03} className="..." />
```
- `opacity`: 透明度 (默认: 0.03)

### LaurelWreath - 月桂花环
```jsx
<LaurelWreath size={48} className="..." />
```
- `size`: 尺寸 (默认: 48)

### ShieldEmblem - 盾徽
```jsx
<ShieldEmblem size={64} className="..." />
```
- `size`: 尺寸 (默认: 64)

### ScrollBanner - 卷轴横幅
```jsx
<ScrollBanner className="...">
  {children}
</ScrollBanner>
```

---

## 🎨 CSS工具类速查

### 玻璃拟态
```css
.glass-ancient   /* 古代石材效果 */
.glass-epic      /* 史诗玻璃效果 */
.glass-monument  /* 纪念碑效果 */
```

### 文本样式
```css
.text-ancient    /* 古代金色文字 */
.text-epic       /* 史诗渐变文字 */
.text-monument   /* 纪念碑闪光文字 */
```

### 按钮样式
```css
.btn-ancient     /* 古代按钮 */
.btn-epic        /* 史诗按钮 */
```

### 卡片样式
```css
.card-ancient    /* 古代卡片 */
.card-epic       /* 史诗卡片 */
```

### 光晕效果
```css
.glow-gold          /* 金色光晕 */
.glow-gold-intense  /* 强烈金色光晕 */
.glow-bronze        /* 青铜光晕 */
.shadow-glow-gold   /* 金色阴影光晕 */
```

### 阴影
```css
.shadow-ancient   /* 古代阴影 */
.shadow-epic      /* 史诗阴影 */
.shadow-monument  /* 纪念碑阴影 */
```

### 动画
```css
.animate-shimmer        /* 闪光动画 */
.animate-pulse-gold     /* 金色脉冲 */
.animate-float          /* 漂浮动画 */
.animate-fade-in-up     /* 淡入上升 */
.animate-slide-in-right /* 右侧滑入 */
.animate-scale-in       /* 缩放进入 */
.animate-epic-entrance  /* 史诗入场 */
```

### 边框
```css
.border-ancient-gold/20  /* 20%透明度金色边框 */
.border-ancient-gold/40  /* 40%透明度金色边框 */
.border-ancient-gold/60  /* 60%透明度金色边框 */
```

---

## 🎨 颜色系统

### 古代色板
```css
.text-ancient-gold      /* #d4af37 */
.text-ancient-bronze    /* #cd7f32 */
.text-ancient-marble    /* #f5f5dc */
.text-ancient-stone     /* #8b7355 */
.text-ancient-parchment /* #f4e8d0 */
.text-ancient-ink       /* #2c1810 */

.bg-ancient-gold        /* 背景金色 */
.bg-ancient-bronze      /* 背景青铜色 */
/* ... 其他背景色 */

.border-ancient-gold    /* 边框金色 */
.border-ancient-bronze  /* 边框青铜色 */
/* ... 其他边框色 */
```

---

## 📋 常用组合模式

### 1. 带特效的信息面板
```jsx
<EpicCard variant="epic" className="p-6">
  <EpicBackground showParticles={true} showGrid={true} />
  <h3 className="text-ancient text-xl mb-4">面板标题</h3>
  <DiamondDivider className="text-ancient-gold/50 mb-4" />
  <div className="relative z-10">
    内容
  </div>
</EpicCard>
```

### 2. 统计信息网格
```jsx
<CardGrid cols={3} gap={4}>
  <InfoCard icon={...} title="..." value="..." color="ancient-gold" />
  <InfoCard icon={...} title="..." value="..." color="blue" />
  <InfoCard icon={...} title="..." value="..." color="green" />
</CardGrid>
```

### 3. 可折叠列表
```jsx
<CollapsibleCard title="..." icon={...} badge="...">
  <ListCard items={...} renderItem={...} />
</CollapsibleCard>
```

### 4. 进度展示
```jsx
<ProgressCard
  title="..."
  current={...}
  max={...}
  icon={...}
  color="blue"
/>
```

### 5. 操作按钮卡片
```jsx
<ActionCard
  title="..."
  description="..."
  icon={...}
  actionLabel="..."
  onAction={...}
  variant="primary"
/>
```

---

## 💡 使用技巧

### 1. 性能优化
```jsx
// 移动端减少粒子
const particleCount = window.innerWidth < 768 ? 5 : 20;
<FloatingParticles count={particleCount} />
```

### 2. 条件装饰
```jsx
// 只在桌面端显示完整装饰
<EnhancedCard
  corners={window.innerWidth >= 1024}
  pattern={window.innerWidth >= 1024}
>
  内容
</EnhancedCard>
```

### 3. 组合效果
```jsx
// 多层背景效果
<div className="relative">
  <GridBackground opacity={0.02} />
  <DynamicGradient />
  <FloatingParticles count={10} />
  <div className="relative z-10">内容</div>
</div>
```

### 4. 响应式卡片
```jsx
<CardGrid 
  cols={3}  // 桌面3列
  gap={4}
  className="grid-cols-1 md:grid-cols-2 lg:grid-cols-3"
>
  {cards}
</CardGrid>
```

---

## 🎯 最佳实践

1. **适度使用特效** - 不要在一个页面使用过多动画
2. **保持层次** - 使用不同的卡片变体区分重要性
3. **响应式优先** - 移动端简化装饰和动画
4. **性能监控** - 定期检查动画性能
5. **一致性** - 同一页面使用相同的视觉风格

---

**快速开始，打造史诗级UI！** 🚀✨
