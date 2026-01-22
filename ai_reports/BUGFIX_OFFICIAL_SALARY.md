# 官员薪水设置Bug修复报告

**日期**: 2026-01-21  
**版本**: v1.52.10  
**修复文件**: `src/components/modals/OfficialDetailModal.jsx`

---

## 🐛 问题描述

### 用户反馈
用户报告在官员详情弹窗中设置官员薪水后，薪水值会自动变回原来的数值。特别是在游戏暂停时，更是无法成功设置官员薪水。

### 复现步骤
1. 打开游戏，招募一名官员
2. 点击官员卡片，打开官员详情弹窗
3. 在"薪俸设置"区域修改薪水值（例如从 50 改为 100）
4. 点击"保存薪俸"按钮
5. **预期结果**: 薪水应该保存为 100
6. **实际结果**: 薪水立即变回 50

### 游戏暂停时的问题
1. 点击暂停按钮，暂停游戏
2. 打开官员详情弹窗
3. 修改薪水并点击保存
4. **实际结果**: 薪水无法保存，立即恢复原值

---

## 🔍 根本原因分析

### 问题1: 事件执行顺序导致的竞态条件

在 React 中，事件的执行顺序是：
```
onMouseDown → onBlur → onClick
```

原代码的问题：
```javascript
// 输入框
<input
    onFocus={() => setIsEditingSalary(true)}
    onBlur={() => setIsEditingSalary(false)}  // ❌ 立即设置为 false
/>

// 保存按钮
<button
    onClick={() => {
        // 保存逻辑
        setIsEditingSalary(false);
    }}
/>
```

**执行流程**：
1. 用户在输入框中输入新值（例如 100）
2. 用户点击"保存薪俸"按钮
3. 输入框先触发 `onBlur` → `setIsEditingSalary(false)`
4. `useEffect` 检测到 `isEditingSalary` 变为 `false`
5. `useEffect` 执行重置逻辑：`setSalaryDraft(official.salary)` → 恢复为 50
6. 按钮的 `onClick` 才执行，但此时 `salaryDraft` 已经是 50 了
7. 结果：保存的是旧值 50，而不是用户输入的 100

### 问题2: useEffect 的重置逻辑

```javascript
useEffect(() => {
    // ...
    if (!isEditingSalary && pendingSalaryRef.current === null) {
        setSalaryDraft(Number.isFinite(official?.salary) ? String(official.salary) : '');
    }
}, [official, isOpen, isEditingSalary, isEditingName]);
```

当 `isEditingSalary` 变为 `false` 时，`useEffect` 会立即重置 `salaryDraft`。

---

## ✅ 修复方案

### 方案1: 延迟 onBlur 的状态更新

```javascript
onBlur={() => {
    // Delay blur to allow button click to process first
    setTimeout(() => setIsEditingSalary(false), 100);
}}
```

**原理**: 添加 100ms 延迟，确保按钮的 `onClick` 能在状态重置前执行。

### 方案2: 使用 onMouseDown 替代 onClick

```javascript
<button
    onMouseDown={(e) => {
        // Use onMouseDown instead of onClick to execute before onBlur
        e.preventDefault(); // Prevent input from losing focus
        if (!canEditSalary || !Number.isFinite(parsedSalaryDraft)) return;
        const nextSalary = Math.floor(parsedSalaryDraft);
        pendingSalaryRef.current = nextSalary;
        onUpdateSalary(official.id, nextSalary);
        setSalaryDraft(String(nextSalary));
        setIsEditingSalary(false);
    }}
>
    保存薪俸
</button>
```

**原理**: 
- `onMouseDown` 在 `onBlur` 之前触发
- `e.preventDefault()` 阻止输入框失焦，避免触发 `onBlur`
- 保存逻辑在状态重置前执行

### 方案3: 添加回车键快捷保存

```javascript
onKeyDown={(e) => {
    if (e.key === 'Enter' && canEditSalary && Number.isFinite(parsedSalaryDraft)) {
        const nextSalary = Math.floor(parsedSalaryDraft);
        pendingSalaryRef.current = nextSalary;
        onUpdateSalary(official.id, nextSalary);
        setSalaryDraft(String(nextSalary));
        setIsEditingSalary(false);
        e.target.blur();
    }
}}
```

**原理**: 用户可以按回车键直接保存，无需点击按钮。

---

## 🧪 测试验证

### 测试用例1: 游戏运行时修改薪水

**步骤**:
1. 启动游戏，确保游戏正在运行（未暂停）
2. 招募一名官员（如果还没有）
3. 点击官员卡片，打开官员详情弹窗
4. 记录当前薪水值（例如 50）
5. 在薪水输入框中输入新值（例如 100）
6. 点击"保存薪俸"按钮
7. **验证**: 薪水应该保存为 100，不会变回 50
8. 关闭弹窗，再次打开
9. **验证**: 薪水仍然是 100

**预期结果**: ✅ 薪水成功保存为 100

---

### 测试用例2: 游戏暂停时修改薪水

**步骤**:
1. 点击暂停按钮，暂停游戏
2. 打开官员详情弹窗
3. 记录当前薪水值（例如 100）
4. 在薪水输入框中输入新值（例如 200）
5. 点击"保存薪俸"按钮
6. **验证**: 薪水应该保存为 200，不会变回 100
7. 关闭弹窗，再次打开
8. **验证**: 薪水仍然是 200
9. 取消暂停，继续游戏
10. 再次打开官员详情弹窗
11. **验证**: 薪水仍然是 200

**预期结果**: ✅ 即使在游戏暂停时，薪水也能成功保存

---

### 测试用例3: 使用回车键保存

**步骤**:
1. 打开官员详情弹窗
2. 点击薪水输入框，输入新值（例如 150）
3. 按下回车键（Enter）
4. **验证**: 薪水应该保存为 150
5. 输入框应该失去焦点
6. 关闭弹窗，再次打开
7. **验证**: 薪水仍然是 150

**预期结果**: ✅ 回车键快捷保存功能正常工作

---

### 测试用例4: 快速连续修改

**步骤**:
1. 打开官员详情弹窗
2. 修改薪水为 100，点击保存
3. 立即再次修改薪水为 200，点击保存
4. 再次修改薪水为 300，点击保存
5. **验证**: 每次修改都应该成功保存
6. 最终薪水应该是 300

**预期结果**: ✅ 快速连续修改不会导致数据丢失

---

### 测试用例5: 输入无效值

**步骤**:
1. 打开官员详情弹窗
2. 在薪水输入框中输入非数字（例如 "abc"）
3. 点击"保存薪俸"按钮
4. **验证**: 应该不会保存，薪水保持原值
5. 输入负数（例如 -50）
6. 点击保存
7. **验证**: 应该保存为 -50（向下取整）

**预期结果**: ✅ 输入验证正常工作

---

## 📊 技术细节

### 事件执行顺序

| 事件 | 触发时机 | 执行顺序 |
|------|---------|---------|
| `onMouseDown` | 鼠标按下时 | 1 |
| `onBlur` | 输入框失焦时 | 2 |
| `onClick` | 鼠标松开时 | 3 |

### 修复前后对比

| 场景 | 修复前 | 修复后 |
|------|--------|--------|
| 点击保存按钮 | ❌ 值被重置 | ✅ 成功保存 |
| 游戏暂停时保存 | ❌ 无法保存 | ✅ 成功保存 |
| 按回车键保存 | ❌ 不支持 | ✅ 支持 |
| 快速连续修改 | ❌ 可能丢失 | ✅ 全部保存 |

---

## 🎯 影响范围

### 修改的文件
- `src/components/modals/OfficialDetailModal.jsx`

### 修改的代码行数
- 新增: 约 20 行
- 修改: 约 10 行
- 删除: 约 5 行

### 影响的功能
- ✅ 官员薪水设置
- ✅ 官员详情弹窗交互
- ✅ 游戏暂停时的UI操作

### 不影响的功能
- ✅ 游戏循环和模拟逻辑
- ✅ 官员的其他属性修改
- ✅ 其他UI组件

---

## 🚀 后续优化建议

### 1. 统一输入框处理逻辑
考虑创建一个通用的 `EditableNumberInput` 组件，封装这些复杂的事件处理逻辑，避免在其他地方重复出现类似问题。

### 2. 添加保存成功提示
在薪水保存成功后，显示一个短暂的提示消息（例如 Toast），让用户明确知道操作已成功。

### 3. 添加撤销功能
允许用户在保存后撤销修改，恢复到之前的值。

### 4. 批量修改薪水
在官员列表中添加批量修改薪水的功能，方便管理多个官员。

---

## 📝 总结

这次修复解决了一个由事件执行顺序引起的竞态条件问题。通过以下三个改进：

1. **延迟 `onBlur` 的状态更新** - 确保保存逻辑有足够时间执行
2. **使用 `onMouseDown` 替代 `onClick`** - 在 `onBlur` 之前执行保存逻辑
3. **添加回车键快捷保存** - 改善用户体验

成功修复了官员薪水设置后自动重置的问题，并且支持在游戏暂停时修改薪水。

---

## ✅ 验证清单

- [x] 游戏运行时可以正常修改薪水
- [x] 游戏暂停时可以正常修改薪水
- [x] 回车键快捷保存功能正常
- [x] 快速连续修改不会丢失数据
- [x] 输入验证正常工作
- [x] 修改后的薪水在游戏循环中正确保存
- [x] 关闭弹窗后再次打开，薪水值正确显示
- [x] 不影响其他官员属性的修改
- [x] 不影响游戏的其他功能

---

**修复完成** ✅
