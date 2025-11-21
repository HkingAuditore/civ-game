# 代码结构快速参考

## 📁 项目文件结构

```
civ-game/
├── src/
│   ├── config/                    # 配置文件目录
│   │   ├── gameData.js           # 统一导出（保持向后兼容）
│   │   ├── epochs.js             # 时代配置
│   │   ├── strata.js             # 社会阶层配置
│   │   ├── buildings.js          # 建筑配置
│   │   ├── gameConstants.js      # 游戏常量（资源、科技、政令等）
│   │   ├── militaryUnits.js      # 军事单位配置
│   │   └── iconMap.js            # 图标映射
│   │
│   ├── components/                # 组件目录
│   │   ├── common/               # 通用组件
│   │   │   └── UIComponents.jsx # Icon、FloatingText
│   │   └── game/                 # 游戏组件
│   │       └── CityMap.jsx       # 城市地图
│   │
│   ├── logic/                     # 游戏逻辑
│   │   └── simulation.js         # 游戏模拟计算
│   │
│   └── App.jsx                    # 主应用（待进一步拆分）
│
└── docs/                          # 文档目录
    ├── REFACTORING_REPORT.md     # 重构报告
    ├── MILITARY_SYSTEM_GUIDE.md  # 军事系统指南
    └── MILITARY_QUICK_REF.md     # 军事系统快速参考
```

---

## 🔧 配置文件说明

### `epochs.js` - 时代配置
```javascript
export const EPOCHS = [
  { 
    id: 0,                    // 时代ID
    name: "石器时代",         // 时代名称
    color: "text-stone-400",  // 显示颜色
    req: { science: 0 },      // 升级要求
    cost: {},                 // 升级成本
    bonuses: {                // 时代加成
      gatherBonus: 0.15,      // 采集 +15%
      militaryBonus: 0.1      // 军事 +10%
    }
  },
  // ... 更多时代
];
```

### `strata.js` - 社会阶层配置
```javascript
export const STRATA = {
  peasant: {
    name: "自耕农",           // 阶层名称
    icon: 'Wheat',           // 图标
    tax: 1,                  // 税收贡献
    admin: 1,                // 行政压力
    wealthWeight: 1,         // 财富权重
    influenceBase: 0.5,      // 基础影响力
    needs: {                 // 资源需求
      food: 0.5,
      wood: 0.1
    },
    buffs: {                 // 满意/不满效果
      satisfied: { ... },
      dissatisfied: { ... }
    }
  },
  // ... 更多阶层
};
```

### `buildings.js` - 建筑配置
```javascript
export const BUILDINGS = [
  {
    id: 'farm',              // 建筑ID
    name: "农田",            // 建筑名称
    baseCost: { wood: 10 }, // 基础成本
    output: { food: 4 },    // 产出
    input: {},              // 消耗
    jobs: { peasant: 2 },   // 提供岗位
    epoch: 0,               // 解锁时代
    cat: 'gather',          // 类别
    visual: { ... }         // 视觉效果
  },
  // ... 更多建筑
];
```

### `gameConstants.js` - 游戏常量
```javascript
// 游戏速度
export const GAME_SPEEDS = [1, 2, 5];

// 资源类型
export const RESOURCES = {
  food: { name: "粮食", icon: 'Wheat', color: "text-yellow-400" },
  // ... 更多资源
};

// 科技树
export const TECHS = [
  { id: 'tools', name: "基础工具", cost: { science: 50 }, epoch: 0 },
  // ... 更多科技
];

// 政令
export const DECREES = [
  { id: 'forced_labor', name: "强制劳动", cost: { admin: 10 } },
  // ... 更多政令
];

// 外交国家
export const COUNTRIES = [
  { id: 'empire', name: "大明帝国", type: "军事专制" },
  // ... 更多国家
];
```

---

## 🎨 组件说明

### `UIComponents.jsx` - 通用UI组件

#### Icon 组件
```javascript
import { Icon } from './components/common/UIComponents';

// 使用示例
<Icon name="Wheat" size={16} className="text-yellow-400" />
```

#### FloatingText 组件
```javascript
import { FloatingText } from './components/common/UIComponents';

// 使用示例
<FloatingText 
  x={100} 
  y={200} 
  text="+1" 
  color="text-white" 
  onComplete={() => console.log('完成')} 
/>
```

### `CityMap.jsx` - 城市地图组件
```javascript
import { CityMap } from './components/game/CityMap';

// 使用示例
<CityMap buildings={buildings} epoch={epoch} />
```

---

## 📦 导入方式

### 导入配置
```javascript
// 方式1：从统一导出文件导入（推荐）
import { EPOCHS, STRATA, BUILDINGS } from './config/gameData';

// 方式2：从单独文件导入
import { EPOCHS } from './config/epochs';
import { STRATA } from './config/strata';
import { BUILDINGS } from './config/buildings';
```

### 导入组件
```javascript
// 导入通用组件
import { Icon, FloatingText } from './components/common/UIComponents';

// 导入游戏组件
import { CityMap } from './components/game/CityMap';
```

---

## 🔄 如何添加新内容

### 添加新时代
1. 打开 `src/config/epochs.js`
2. 在 `EPOCHS` 数组中添加新对象
3. 设置 id、name、color、req、cost、bonuses

### 添加新阶层
1. 打开 `src/config/strata.js`
2. 在 `STRATA` 对象中添加新键值对
3. 设置 name、icon、tax、admin、needs、buffs

### 添加新建筑
1. 打开 `src/config/buildings.js`
2. 在 `BUILDINGS` 数组中添加新对象
3. 设置 id、name、baseCost、output、jobs、epoch、cat、visual

### 添加新科技
1. 打开 `src/config/gameConstants.js`
2. 在 `TECHS` 数组中添加新对象
3. 设置 id、name、desc、cost、epoch

### 添加新组件
1. 在 `src/components/` 下创建新文件
2. 导出组件
3. 在需要的地方导入使用

---

## 🎯 代码规范

### 注释规范
```javascript
/**
 * 函数/组件描述
 * @param {类型} 参数名 - 参数说明
 * @returns {类型} 返回值说明
 */
```

### 命名规范
- **配置常量**：大写下划线（EPOCHS, STRATA）
- **组件**：大驼峰（CityMap, Icon）
- **函数**：小驼峰（buyBuilding, recruitUnit）
- **文件名**：
  - 配置文件：小驼峰（epochs.js, gameConstants.js）
  - 组件文件：大驼峰（CityMap.jsx, UIComponents.jsx）

### 文件组织
- **配置文件**：放在 `src/config/`
- **组件文件**：放在 `src/components/`
  - 通用组件：`src/components/common/`
  - 游戏组件：`src/components/game/`
- **逻辑文件**：放在 `src/logic/`

---

## 🚀 开发流程

### 1. 修改配置
```bash
# 修改时代配置
vim src/config/epochs.js

# 修改阶层配置
vim src/config/strata.js

# 修改建筑配置
vim src/config/buildings.js
```

### 2. 创建组件
```bash
# 创建新组件
touch src/components/game/NewComponent.jsx

# 编辑组件
vim src/components/game/NewComponent.jsx
```

### 3. 测试构建
```bash
# 开发模式
npm run dev

# 生产构建
npm run build
```

---

## 📚 相关文档

- [重构报告](./REFACTORING_REPORT.md) - 详细的重构说明
- [军事系统指南](./MILITARY_SYSTEM_GUIDE.md) - 军事系统完整文档
- [军事系统快速参考](./MILITARY_QUICK_REF.md) - 军事系统速查表

---

## 💡 常见问题

### Q: 为什么要拆分配置文件？
A: 提高可维护性，每个文件职责单一，便于查找和修改。

### Q: 拆分后会影响性能吗？
A: 不会。构建工具会自动优化，最终打包结果相同。

### Q: 如何保持向后兼容？
A: gameData.js 作为统一导出文件，其他代码无需修改导入路径。

### Q: 组件拆分的原则是什么？
A: 单一职责、可复用、易测试。每个组件只做一件事。

### Q: 如何添加中文注释？
A: 使用 JSDoc 风格，在函数/组件前添加 `/** */` 注释块。

---

**最后更新**：2025-11-21
**维护者**：开发团队
