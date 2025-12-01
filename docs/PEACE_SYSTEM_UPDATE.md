# 和平协议系统优化

## 更新日期
2025-12-01

## 优化内容

### 1. 敌方主动提出和平协议
- **修改文件**: `simulation.js`
- **变更内容**: 
  - 敌方在战争分数 > 12 时会主动请求和平
  - 不再直接处理和平，而是记录日志并标记 `isPeaceRequesting`
  - 由事件系统接管和平协议的处理

### 2. 和平协议事件化
- **修改文件**: `events.js`
- **新增函数**:
  - `createEnemyPeaceRequestEvent`: 敌方请求和平时弹出事件
  - `createPlayerPeaceProposalEvent`: 玩家提出和平时弹出事件
  
- **事件特性**:
  - 根据战争分数（warScore）提供不同的和平选项
  - 战争分数 > 20：大胜，可要求更多赔款
  - 战争分数 > 10：小胜，标准和平条款
  - 战争分数 < 0：劣势，需要支付赔款
  - 战争分数 ≈ 0：僵持，无条件和平

### 3. 玩家提出和平的优化
- **修改文件**: `useGameActions.js`
- **变更内容**:
  - 玩家点击"提出和平协议"按钮时，不再直接处理
  - 触发 `createPlayerPeaceProposalEvent` 事件
  - 根据战争分数显示不同的和平选项
  - 新增处理函数：
    - `handlePlayerPeaceProposal`: 处理玩家的和平提议
    - `handleEnemyPeaceAccept`: 处理敌方和平请求被接受
    - `handleEnemyPeaceReject`: 处理敌方和平请求被拒绝

### 4. 外交事件触发修复
- **修改文件**: `useGameLoop.js`
- **修复内容**:
  - 修复敌方宣战事件的触发
  - 修复敌方和平请求事件的触发
  - 修复突袭事件的触发
  - 确保所有外交事件都能正确弹出

### 5. 战斗/突袭事件优化
- **修改文件**: `events.js`
- **变更内容**:
  - `createBattleEvent` 函数现在能区分正常战斗和突袭
  - 突袭事件会显示资源损失（粮食、银币、人口）
  - 正常战斗显示双方损失

## 和平选项详解

### 敌方请求和平（根据战争分数）

#### 大胜（warScore > 20）
- **要求更多赔款**: 比原提议多50%的赔款
- **接受标准和平**: 接受原提议的赔款
- **拒绝和平**: 继续战争

#### 小胜（warScore > 10）
- **接受和平**: 获得赔款，结束战争
- **拒绝和平**: 继续战争

#### 僵持（warScore ≤ 10）
- **接受和平**: 获得少量赔款，结束战争
- **拒绝和平**: 继续战争

### 玩家提出和平（根据战争分数）

#### 大胜（warScore > 15）
- **要求高额赔款**: 可能被拒绝
- **要求标准赔款**: 较易接受
- **无条件和平**: 不要求赔款
- **取消**: 放弃和平谈判

#### 小胜（warScore > 0）
- **要求赔款**: 要求一定赔款
- **无条件和平**: 不要求赔款
- **取消**: 放弃和平谈判

#### 大败（warScore < -10）
- **支付高额赔款**: 支付高额赔款求和
- **取消**: 放弃和平谈判

#### 小败（warScore < 0）
- **支付赔款**: 支付赔款求和
- **取消**: 放弃和平谈判

#### 僵持（warScore ≈ 0）
- **提议和平**: 无条件停战
- **取消**: 放弃和平谈判

## 技术细节

### 和平请求成功率计算

#### 玩家要求赔款
```javascript
// 高额赔款
willingness = (warScore / 100) + min(0.4, enemyLosses / 250) + min(0.2, warDuration / 250)
成功率 > 70%

// 标准赔款
willingness = (warScore / 80) + min(0.5, enemyLosses / 200) + min(0.3, warDuration / 200)
成功率 > 60%

// 无条件和平
willingness = max(0.3, (warScore / 60) + min(0.4, enemyLosses / 150))
成功率 > 50%
```

### 赔款金额计算

#### 敌方请求和平
```javascript
tribute = min(enemyWealth, max(50, ceil(warScore * 30 + enemyLosses * 2)))
```

#### 玩家要求赔款（大胜）
```javascript
highTribute = min(enemyWealth, ceil(warScore * 50 + enemyLosses * 3))
standardTribute = min(enemyWealth, ceil(warScore * 40 + enemyLosses * 2))
```

#### 玩家支付赔款（劣势）
```javascript
// 大败
payment = max(150, ceil(abs(warScore) * 35 + warDuration * 6))

// 小败
payment = max(100, ceil(abs(warScore) * 30 + warDuration * 5))
```

## 测试建议

1. **测试敌方主动请求和平**:
   - 与敌国开战
   - 持续获胜，提高战争分数至 > 12
   - 观察是否弹出和平请求事件

2. **测试玩家提出和平**:
   - 在不同战争分数下点击"提出和平协议"
   - 验证是否显示正确的选项
   - 测试各选项的成功率

3. **测试敌方宣战**:
   - 降低与敌国的关系至 < 35
   - 观察是否弹出宣战事件

4. **测试突袭事件**:
   - 在战争中等待敌方突袭
   - 验证是否弹出突袭事件并显示损失

## 已知问题

无

## 后续优化建议

1. 添加更多和平条款选项（如割地、贸易协定等）
2. 根据国家性格（aggression）调整和平意愿
3. 添加和平协议的持续时间和违约惩罚
4. 优化和平协议的UI显示
