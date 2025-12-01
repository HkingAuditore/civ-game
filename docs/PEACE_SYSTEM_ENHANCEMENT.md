# 和平协议系统增强更新

## 更新日期
2025-12-01

## 新增功能

### 1. 分期支付赔款选项
玩家和敌方都可以选择分期支付赔款，而不是一次性支付。

#### 特性
- **支付周期**: 每天支付一定金额，持续365天（一年）
- **总金额**: 分期支付的总金额通常比一次性支付略高
- **自动扣款**: 每天自动从银币中扣除
- **违约惩罚**: 如果玩家银币不足无法支付，和平协议将被破坏，立即重新开战

#### 计算公式
```javascript
// 每天支付金额 = 总赔款 / 12
installmentAmount = Math.floor(totalTribute / 12)
// 一年总支付 = 每天金额 * 365
totalPayment = installmentAmount * 365
```

### 2. 提供人口选项
作为赔偿的一种形式，可以提供人口而不是银币。

#### 特性
- **大胜时**: 可要求敌方提供5%的人口
- **小胜时**: 可要求敌方提供3%的人口
- **劣势时**: 玩家可提供5%或3%的人口求和
- **人口转移**: 人口直接从一方转移到另一方

### 3. 和平协议期限
所有和平协议都有一年的有效期，期间双方不能再次开战。

#### 特性
- **有效期**: 365天（一年）
- **宣战限制**: 在和平协议期间，双方都无法宣战
- **自动过期**: 一年后和平协议自动失效，可以再次宣战
- **UI显示**: 在外交界面显示剩余天数

## 修改的文件

### 1. events.js
**路径**: `src/config/events.js`

#### 修改内容
- 在 `createEnemyPeaceRequestEvent` 函数中添加了分期支付和提供人口的选项
- 在 `createPlayerPeaceProposalEvent` 函数中添加了分期支付和提供人口的选项
- 根据战争分数提供不同的选项组合

#### 新增选项
**敌方请求和平时（大胜）**:
- 要求更多赔款（一次性）
- 要求分期支付（每天支付，持续一年）
- 要求提供人口（5%人口）
- 接受标准和平（原赔款金额）
- 拒绝和平

**敌方请求和平时（小胜）**:
- 接受和平（一次性赔款）
- 要求分期支付（每天支付，持续一年）
- 要求提供人口（3%人口）
- 拒绝和平

**玩家提出和平时（大胜）**:
- 要求高额赔款
- 要求分期支付
- 要求提供人口（5%人口）
- 要求标准赔款
- 无条件和平
- 取消

**玩家提出和平时（小胜）**:
- 要求赔款
- 要求分期支付
- 要求提供人口（3%人口）
- 无条件和平
- 取消

**玩家提出和平时（劣势）**:
- 支付赔款
- 分期支付赔款
- 提供人口（5%或3%）
- 取消

### 2. useGameActions.js
**路径**: `src/hooks/useGameActions.js`

#### 修改内容
- 更新 `handleEnemyPeaceAccept` 函数，支持分期支付和提供人口
- 更新 `handlePlayerPeaceProposal` 函数，添加新选项的处理逻辑
- 在 `handleDiplomaticAction` 的宣战逻辑中添加和平协议限制检查
- 所有和平协议都会设置 `peaceTreatyUntil` 字段（当前天数 + 365）

#### 新增处理逻辑
```javascript
// 分期支付
if (proposalType === 'installment') {
  nation.installmentPayment = {
    amount: dailyAmount,
    remainingDays: 365,
    totalAmount: dailyAmount * 365,
    paidAmount: 0,
  };
}

// 提供人口
if (proposalType === 'population') {
  setPopulation(prev => prev + amount);
  nation.population -= amount;
}

// 和平协议期限
nation.peaceTreatyUntil = daysElapsed + 365;
```

### 3. simulation.js
**路径**: `src/logic/simulation.js`

#### 修改内容
- 在敌方AI宣战逻辑中添加和平协议检查
- 添加敌方分期支付的自动处理逻辑

#### 新增逻辑
```javascript
// 检查和平协议
const hasPeaceTreaty = nation.peaceTreatyUntil && tick < nation.peaceTreatyUntil;
if (!nation.isAtWar && !hasPeaceTreaty && canDeclareWar) {
  // 宣战
}

// 处理敌方分期支付
if (nation.installmentPayment && nation.installmentPayment.remainingDays > 0) {
  resources.silver += nation.installmentPayment.amount;
  nation.installmentPayment.paidAmount += nation.installmentPayment.amount;
  nation.installmentPayment.remainingDays -= 1;
  
  if (nation.installmentPayment.remainingDays === 0) {
    delete nation.installmentPayment;
  }
}
```

### 4. useGameState.js
**路径**: `src/hooks/useGameState.js`

#### 修改内容
- 添加 `playerInstallmentPayment` 状态，用于跟踪玩家的分期支付
- 在返回值中导出新状态

#### 新增状态
```javascript
const [playerInstallmentPayment, setPlayerInstallmentPayment] = useState(null);

// 数据结构
{
  nationId: string,
  amount: number,        // 每天支付金额
  remainingDays: number, // 剩余天数
  totalAmount: number,   // 总金额
  paidAmount: number,    // 已支付金额
}
```

### 5. useGameLoop.js
**路径**: `src/hooks/useGameLoop.js`

#### 修改内容
- 添加玩家分期支付的自动处理逻辑
- 处理违约情况（银币不足）

#### 新增逻辑
```javascript
// 每天检查玩家的分期支付
if (playerInstallmentPayment && playerInstallmentPayment.remainingDays > 0) {
  if (resources.silver >= paymentAmount) {
    // 扣除银币
    resources.silver -= paymentAmount;
    // 更新支付进度
    playerInstallmentPayment.paidAmount += paymentAmount;
    playerInstallmentPayment.remainingDays -= 1;
  } else {
    // 违约：重新开战
    nation.isAtWar = true;
    nation.relation -= 50;
    playerInstallmentPayment = null;
  }
}
```

### 6. DiplomacyTab.jsx
**路径**: `src/components/tabs/DiplomacyTab.jsx`

#### 修改内容
- 添加和平协议状态的显示
- 添加敌方分期支付的显示
- 添加玩家分期支付的显示

#### 新增UI元素
1. **和平协议显示**（绿色框）
   - 剩余天数
   - 敌方分期支付信息（如果有）

2. **玩家分期支付显示**（黄色框）
   - 每天支付金额
   - 剩余天数
   - 已支付/总金额

## 游戏机制详解

### 和平选项成功率

#### 分期支付
```javascript
// 比一次性支付略容易接受
willingness = (warScore / 90) + min(0.45, enemyLosses / 220) + min(0.25, warDuration / 220)
成功率阈值: > 65%
```

#### 提供人口
```javascript
// 比一次性支付稍难接受
willingness = (warScore / 95) + min(0.42, enemyLosses / 230) + min(0.23, warDuration / 230)
成功率阈值: > 68%
```

### 和平协议限制

#### 宣战限制
- 在和平协议有效期内（365天），双方都无法宣战
- 尝试宣战时会显示提示：`无法宣战：与XX的和平协议还有N天有效期`
- 敌方AI也会遵守这个限制

#### 违约惩罚
- 如果玩家无法支付分期赔款（银币不足）
- 和平协议立即破坏
- 立即重新开战
- 关系度降低50点
- 显示警告：`银币不足，无法支付分期赔款！和平协议被破坏。`

### 分期支付计算示例

#### 示例1：大胜要求分期支付
```
战争分数: 25
敌方损失: 150人
基础赔款: 1500银币

分期支付:
- 每天金额: 1500 / 12 = 125银币
- 持续天数: 365天
- 总支付: 125 * 365 = 45,625银币
```

#### 示例2：劣势分期支付求和
```
战争分数: -15
战争持续: 50天
应付赔款: 200银币

分期支付:
- 每天金额: 200 / 12 = 16银币
- 持续天数: 365天
- 总支付: 16 * 365 = 5,840银币
```

### 人口转移示例

#### 示例1：大胜要求人口
```
敌方人口: 2000人
要求比例: 5%
获得人口: 2000 * 0.05 = 100人

结果:
- 玩家人口 +100
- 敌方人口 -100
```

#### 示例2：劣势提供人口
```
玩家人口: 1500人
提供比例: 3%
提供人口: 1500 * 0.03 = 45人

结果:
- 玩家人口 -45
- 敌方人口 +45
```

## UI显示

### 外交界面

#### 和平协议状态（绿色框）
```
🤝 和平协议
剩余天数: 287
分期支付: 每天 125 银币（剩余 287 天）
```

#### 玩家分期支付（黄色框）
```
💰 你的分期支付
每天支付: 16 银币
剩余天数: 300
已支付: 1040 / 5840 银币
```

### 日志消息

#### 分期支付相关
- `你接受了和平协议，XX将每天支付 N 银币，持续一年（共M银币）。`
- `你与 XX 达成和平，将每天支付 N 银币，持续一年（共M银币）。`
- `💰 XX 完成了所有分期赔款支付（共M银币）。`
- `💰 你完成了所有分期赔款支付（共M银币）。`
- `⚠️ 银币不足，无法支付分期赔款！和平协议被破坏。`

#### 人口转移相关
- `你接受了和平协议，XX提供了 N 人口。`
- `你提供 N 人口，与 XX 达成和平。`

#### 和平协议限制
- `无法宣战：与 XX 的和平协议还有 N 天有效期。`

## 测试建议

### 1. 测试分期支付（敌方）
1. 与敌国开战并获得优势（warScore > 10）
2. 等待敌方请求和平
3. 选择"要求分期支付"选项
4. 观察每天是否自动收到银币
5. 在外交界面查看分期支付进度

### 2. 测试分期支付（玩家）
1. 与敌国开战并处于劣势（warScore < 0）
2. 点击"提出和平协议"
3. 选择"分期支付赔款"选项
4. 观察每天是否自动扣除银币
5. 测试银币不足时的违约情况

### 3. 测试提供人口
1. 在大胜时选择"要求提供人口"
2. 检查玩家人口是否增加
3. 检查敌方人口是否减少
4. 在劣势时选择"提供人口"
5. 检查人口变化是否正确

### 4. 测试和平协议限制
1. 达成和平协议后
2. 尝试立即宣战
3. 验证是否显示限制提示
4. 等待365天后再次尝试宣战
5. 验证是否可以正常宣战

### 5. 测试违约惩罚
1. 达成玩家分期支付协议
2. 消耗所有银币
3. 等待下一天
4. 验证是否重新开战
5. 检查关系度是否降低

## 已知问题

无

## 后续优化建议

1. **提前还款**: 允许玩家提前一次性还清剩余赔款
2. **延期支付**: 在特殊情况下允许延期支付（需要额外代价）
3. **赔款减免**: 在某些条件下可以申请减免部分赔款
4. **资源赔偿**: 除了银币和人口，还可以用其他资源作为赔偿
5. **领土割让**: 添加割让领土的选项（需要先实现领土系统）
6. **贸易协定**: 和平协议可以包含贸易优惠条款
7. **军事限制**: 和平协议可以限制军队规模
8. **赔款保险**: 可以购买保险来防止违约惩罚
