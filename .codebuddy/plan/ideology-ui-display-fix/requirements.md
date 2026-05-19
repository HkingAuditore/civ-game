# 需求文档：理念卡牌 UI 显示修复

## 引言

理念系统的设计意图是**层层叠加**——高等级理念包含低等级的全部效果，并在此基础上新增加成。然而当前 UI 存在两类显示缺陷，导致玩家产生"升级后反而更弱"或"效果被覆盖"的错觉：

1. **叠加感缺失**：卡牌顶部标签显示当前等级的绝对值，展开后"效果递进"区域显示每级的增量差值，两者混用且没有任何视觉提示说明"这是叠加的"，玩家无法直观感知升级是在原有基础上增强。

2. **triggerEffects 跨级覆盖**：天命、看不见的手等理念的 `triggerEffects` 分散在各 `levels[i]` 内部，但卡牌只读取顶层 `ideology.effects.triggerEffects`（该字段为空），导致各级的条件触发效果完全不显示在"效果递进"区域；同时，3 级的 `triggerEffects` 在卡牌顶部"特殊效果"区域会覆盖/替换 1 级的显示，给人"升级后 1 级效果消失了"的错觉。

3. **converters 继承不显示**：天命 2 级有 converters（🔁），3 级的 converters 与 2 级完全相同（无新增），`getLevelIncrementalEffects` 的 `getNewArrayItems` 返回空，导致 3 级递进区显示"无新增数值"，但实际上 converters 仍然生效，玩家误以为升到 3 级后 🔁 效果消失了。

---

## 需求

### 需求 1：效果递进区域增加叠加感视觉提示

**用户故事：** 作为玩家，我希望在展开理念卡牌的"效果递进"区域时，能清晰看到每个等级是在前一级基础上叠加的，以便理解升级始终是正向收益。

#### 验收标准

1. WHEN 玩家展开理念卡牌的"效果递进"区域 THEN 系统 SHALL 在每个等级行的增量标签旁显示"▲ 新增"前缀或类似视觉标识，明确表示该行是新增内容。
2. WHEN 某等级的数值增量为正 THEN 系统 SHALL 以绿色高亮显示该增量标签，与"基础值"区分。
3. WHEN 某等级无新增数值增量但有继承的 converters/ruleMods THEN 系统 SHALL 显示"🔁 继承前级"或类似提示，而非显示"无新增数值"。
4. IF 当前等级为 2 级或 3 级 THEN 系统 SHALL 在该等级行旁显示"累计总效果"摘要（折叠/tooltip 形式），让玩家可以查看该等级的完整绝对值。

### 需求 2：triggerEffects 按等级分级显示

**用户故事：** 作为玩家，我希望在"效果递进"区域能看到每个等级解锁的条件触发效果（紫色 ⚡ 标签），以便了解升级带来的特殊机制变化。

#### 验收标准

1. WHEN 某等级的 `levels[i]` 内包含 `triggerEffects` THEN 系统 SHALL 在该等级的递进行中显示新增的 triggerEffects（与 converters/onEvents 同样处理方式）。
2. WHEN 某等级的 `triggerEffects` 与上一级完全相同（无新增） THEN 系统 SHALL 显示"⚡ 继承前级特殊效果"提示，而非空白。
3. WHEN 玩家查看卡牌顶部的"特殊效果"区域 THEN 系统 SHALL 显示**当前等级及以下所有等级**累积的 triggerEffects，而非仅显示顶层 `ideology.effects.triggerEffects`（该字段通常为空）。
4. IF 理念的 `triggerEffects` 分散在 `levels[i]` 内部 THEN 系统 SHALL 在卡牌顶部摘要区域正确聚合并展示所有已解锁等级的 triggerEffects。

### 需求 3：converters 继承状态正确显示

**用户故事：** 作为玩家，我希望在升级理念后，能看到前一级的 🔁 converter 效果仍然存在（继承），而不是消失，以便确认升级没有削弱已有效果。

#### 验收标准

1. WHEN 某等级的 converters 与上一级完全相同（无新增） THEN 系统 SHALL 在该等级的递进行中显示"🔁 继承：[converter描述]"，而非"无新增数值"。
2. WHEN 某等级新增了 converters THEN 系统 SHALL 仅显示新增的 converters，不重复显示继承的部分（避免冗余）。
3. WHEN 某等级同时有继承的 converters 和新增的 converters THEN 系统 SHALL 分别以"🔁 继承"和"🔁 新增"标识区分。
4. IF ruleMods 存在同样的继承情况 THEN 系统 SHALL 对 ruleMods 应用相同的继承显示逻辑。

### 需求 4：卡牌顶部效果摘要与当前等级一致

**用户故事：** 作为玩家，我希望卡牌顶部显示的效果标签（绿色数值标签、🔁 converter、⚡ triggerEffects）能准确反映当前等级的完整效果，以便快速了解理念当前的实际加成。

#### 验收标准

1. WHEN 卡牌处于 N 级 THEN 系统 SHALL 在顶部效果标签区域显示 N 级的完整绝对值（现有行为，保持不变）。
2. WHEN 卡牌处于 N 级且 `levels[0..N-1]` 中有 triggerEffects THEN 系统 SHALL 在顶部"特殊效果"区域聚合显示所有已解锁等级的 triggerEffects（修复读取路径）。
3. WHEN 卡牌处于 N 级且 `levels[0..N-1]` 中有 converters THEN 系统 SHALL 在顶部"特殊效果摘要"区域显示当前等级的 converters（现有行为，保持不变）。
4. IF 理念的 triggerEffects 同时存在于顶层 `ideology.effects.triggerEffects` 和 `levels[i].triggerEffects` THEN 系统 SHALL 合并去重后显示，不重复。

---

## 技术约束

- 所有修改限定在 `src/components/tabs/IdeologyCard.jsx` 内，不修改配置文件和逻辑层。
- `getLevelIncrementalEffects` 函数需扩展以支持 `triggerEffects` 的增量计算（与 `converters` 同样逻辑）。
- 继承显示逻辑通过新增辅助函数 `getLevelInheritedItems` 实现，不破坏现有增量计算逻辑。
- 卡牌顶部 triggerEffects 读取路径改为聚合函数，向后兼容顶层 `triggerEffects` 字段。
- UI 风格与现有组件保持一致（颜色、字号、间距）。
