# 商人交易系统测试指南

## 🎯 测试目的

验证商人交易状态是否正确保存，以及商人是否能够完成完整的买入-卖出周期。

## 📋 测试前准备

### 1. 启用调试日志

编辑 `src/config/strata.js`，找到商人配置：

```javascript
merchant: {
  // ...
  tradeConfig: {
    // ...
    enableDebugLog: true,  // 改为 true
  }
}
```

### 2. 打开浏览器控制台

- Chrome/Edge: 按 `F12` 或 `Ctrl+Shift+I`
- Firefox: 按 `F12` 或 `Ctrl+Shift+K`
- Safari: `Cmd+Option+I`

## 🧪 测试步骤

### 测试1：基本交易周期

#### 步骤

1. **建立贸易站**
   - 在游戏中建造贸易站（Trade Post）
   - 分配至少 1 个商人

2. **准备商品**
   - 确保有可交易的商品（如布料、工具等）
   - 库存至少 20 单位

3. **开始游戏**
   - 设置游戏速度为 1（正常速度）
   - 取消暂停

4. **观察第一个tick（买入）**
   - 在控制台查看日志：`[商人调试] 📦 购买...准备出口`
   - 记录买入的商品和数量
   - 检查库存是否减少
   - 检查商人财富是否减少

5. **检查状态保存**
   - 在控制台输入：
     ```javascript
     console.log(window.gameState?.merchantState)
     ```
   - 应该看到：
     ```javascript
     {
       pendingTrades: [
         {
           type: 'export',
           resource: 'cloth',
           amount: 10,
           revenue: 150,
           profit: 50,
           daysRemaining: 3
         }
       ],
       lastTradeTime: 100
     }
     ```

6. **等待3个游戏日**
   - 观察 `daysRemaining` 倒计时：3 → 2 → 1 → 0
   - 每个tick在控制台检查状态

7. **观察卖出**
   - 在控制台查看日志：`[商人调试] ✅ 交易完成`
   - 检查商人财富是否增加
   - 检查 `pendingTrades` 是否变为空数组

#### 预期结果

✅ **成功标志**：
- 商人成功买入商品
- `merchantState.pendingTrades` 不为空
- 状态在每个tick之间保持
- 3天后商人成功卖出
- 商人财富增加
- `pendingTrades` 变为空

❌ **失败标志**：
- 买入后 `pendingTrades` 为空
- 状态在tick之间丢失
- 商人从不卖出
- 商人财富持续下降

### 测试2：多个商人并发交易

#### 步骤

1. **分配多个商人**
   - 在贸易站分配 5-10 个商人

2. **观察并发交易**
   - 多个商人可能同时买入不同商品
   - 检查 `pendingTrades` 数组长度

3. **等待交易完成**
   - 观察不同交易的完成时间
   - 检查每个交易是否正确完成

#### 预期结果

✅ **成功标志**：
- 多个交易同时存在于 `pendingTrades`
- 每个交易独立倒计时
- 所有交易都能正确完成
- 商人总财富增加

### 测试3：不同游戏倍速

#### 步骤

1. **测试 gameSpeed = 1**
   - 商人应该等待 3 个tick（3天）

2. **测试 gameSpeed = 2**
   - 商人应该等待 2 个tick（4天）

3. **测试 gameSpeed = 3**
   - 商人应该等待 1 个tick（3天）

4. **测试 gameSpeed = 5**
   - 商人应该等待 1 个tick（5天）

#### 预期结果

✅ **成功标志**：
- 无论倍速如何，商人都能完成交易
- 等待时间至少 3 个游戏日
- 状态在不同倍速下都能正确保存

### 测试4：存档和读档

#### 步骤

1. **创建交易**
   - 让商人买入商品
   - 确保有待完成的交易（`daysRemaining > 0`）

2. **保存游戏**
   - 点击保存按钮
   - 记录当前的 `merchantState`

3. **刷新页面**
   - 重新加载游戏

4. **读取存档**
   - 加载刚才的存档
   - 检查 `merchantState` 是否恢复

5. **继续游戏**
   - 取消暂停
   - 观察交易是否继续倒计时
   - 观察交易是否能正常完成

#### 预期结果

✅ **成功标志**：
- 存档包含 `merchantState`
- 读档后状态正确恢复
- 交易继续正常进行
- 交易能够完成

## 🔍 调试技巧

### 查看当前状态

在浏览器控制台输入：

```javascript
// 查看商人状态
console.log(window.gameState?.merchantState)

// 查看商人财富
console.log(window.gameState?.classWealth?.merchant)

// 查看商人数量
console.log(window.gameState?.popStructure?.merchant)

// 查看当前游戏日
console.log(window.gameState?.daysElapsed)
```

### 手动触发交易

如果需要强制触发交易（仅用于测试）：

```javascript
// 注意：这会修改游戏状态，仅用于调试
window.gameState.setMerchantState({
  pendingTrades: [
    {
      type: 'export',
      resource: 'cloth',
      amount: 10,
      revenue: 150,
      profit: 50,
      daysRemaining: 1  // 下一个tick就会完成
    }
  ],
  lastTradeTime: window.gameState.daysElapsed
})
```

### 清空交易状态

如果需要重置商人状态：

```javascript
window.gameState.setMerchantState({
  pendingTrades: [],
  lastTradeTime: 0
})
```

## 📊 测试检查清单

### 基本功能
- [ ] 商人能够买入商品
- [ ] 买入后库存减少
- [ ] 买入后商人财富减少
- [ ] `merchantState.pendingTrades` 不为空
- [ ] 交易状态在tick之间保持
- [ ] `daysRemaining` 正确倒计时
- [ ] 商人能够卖出商品
- [ ] 卖出后商人财富增加
- [ ] 卖出后 `pendingTrades` 变为空

### 高级功能
- [ ] 多个商人可以并发交易
- [ ] 不同倍速下都能正常工作
- [ ] 存档包含商人状态
- [ ] 读档后状态正确恢复
- [ ] 交易冷却时间正确工作
- [ ] 利润计算正确
- [ ] 税费计算正确

### 边界情况
- [ ] 商人财富不足时不会交易
- [ ] 库存不足时不会出口
- [ ] 没有可交易商品时不会崩溃
- [ ] 没有外国贸易伙伴时不会崩溃
- [ ] 游戏暂停时交易不会进行

## 🎉 测试通过标准

所有以下条件都满足：

1. ✅ 商人能够完成完整的买入-卖出周期
2. ✅ 交易状态在tick之间正确保存
3. ✅ 商人财富合理增长（有利润）
4. ✅ 不同游戏倍速下都能正常工作
5. ✅ 存档和读档功能正常
6. ✅ 控制台没有错误信息
7. ✅ 游戏性能正常（无卡顿）

## 🐛 常见问题

### 问题1：商人不买入商品

**可能原因**：
- 商人财富不足（< 10）
- 没有可交易的商品
- 没有外国贸易伙伴
- 利润率不足（< 10%）

**解决方案**：
- 增加商人初始财富
- 确保有可交易商品
- 检查外国贸易伙伴配置
- 调整 `minProfitMargin` 参数

### 问题2：商人买入但不卖出

**可能原因**：
- 交易状态丢失（本次修复的问题）
- `daysRemaining` 没有倒计时

**解决方案**：
- 确认已应用本次修复
- 检查 `merchantState` 是否正确保存
- 查看控制台是否有错误

### 问题3：商人财富下降

**可能原因**：
- 交易未完成就丢失
- 利润计算错误
- 税费过高

**解决方案**：
- 确认交易能够完成
- 检查利润计算逻辑
- 调整税率

## 📝 测试报告模板

```markdown
## 商人交易系统测试报告

**测试日期**: YYYY-MM-DD
**测试版本**: 2.1.6
**测试人员**: [你的名字]

### 测试环境
- 浏览器: [Chrome/Firefox/Safari]
- 操作系统: [Windows/Mac/Linux]
- 游戏倍速: [1/2/3/5]

### 测试结果

#### 基本功能
- [ ] 通过 / [ ] 失败 - 商人买入商品
- [ ] 通过 / [ ] 失败 - 状态保存
- [ ] 通过 / [ ] 失败 - 商人卖出商品
- [ ] 通过 / [ ] 失败 - 财富增长

#### 高级功能
- [ ] 通过 / [ ] 失败 - 多商人并发
- [ ] 通过 / [ ] 失败 - 不同倍速
- [ ] 通过 / [ ] 失败 - 存档读档

### 发现的问题
1. [描述问题]
2. [描述问题]

### 总体评价
[ ] 通过 / [ ] 失败

### 备注
[其他说明]
```

---

**文档版本**: 1.0  
**最后更新**: 2025-11-24  
**相关修复**: [MERCHANT_STATE_LOSS_FIX.md](./MERCHANT_STATE_LOSS_FIX.md)
