# 实施计划：理念卡牌 UI 显示修复

所有修改限定在 `src/components/tabs/IdeologyCard.jsx`。

---

- [ ] 1. 修复卡牌顶部 triggerEffects 读取路径，聚合 levels 内的触发效果
   - 新增辅助函数 `getAggregatedTriggerEffects(ideology, level)`：遍历 `ideology.effects.levels[0..level-1]`，收集所有 `triggerEffects`，与顶层 `ideology.effects.triggerEffects` 合并去重后返回
   - 将卡牌顶部"条件触发效果摘要"区域（当前读取 `ideology.effects?.triggerEffects`）改为调用 `getAggregatedTriggerEffects(ideology, displayLevel)`
   - _需求：4.2、4.4_

- [ ] 2. 扩展 `getLevelIncrementalEffects` 以支持 triggerEffects 增量计算
   - 在 `getLevelIncrementalEffects` 的数组类型处理分支中，新增对 `triggerEffects` 的处理（与 `converters`/`onEvents`/`ruleMods` 同样逻辑，调用 `getNewArrayItems`）
   - _需求：2.1_

- [ ] 3. 新增辅助函数 `getLevelInheritedItems`，计算某等级继承自上一级的数组项
   - 函数签名：`getLevelInheritedItems(levels, index, key)`，返回 `levels[index][key]` 中与 `levels[index-1][key]` 完全相同的项（即非新增的继承项）
   - 当 `index === 0` 时返回空数组
   - _需求：1.3、2.2、3.1、3.4_

- [ ] 4. 在"效果递进"区域渲染 triggerEffects 的新增与继承状态
   - 在"展开详情"的 `levels.map` 渲染循环中，读取 `levelDiff.triggerEffects`（新增项）和 `getLevelInheritedItems(..., 'triggerEffects')`（继承项）
   - 新增项：在 `renderOnEvents`/`renderConverters` 同级位置，以紫色 `⚡ 新增：` 前缀渲染 `describeTriggerEffect`
   - 继承项：若存在继承的 triggerEffects，显示 `⚡ 继承前级特殊效果` 灰色提示行
   - _需求：2.1、2.2_

- [ ] 5. 在"效果递进"区域渲染 converters/ruleMods 的继承状态
   - 在 `levels.map` 渲染循环中，对 `converters` 和 `ruleMods` 分别调用 `getLevelInheritedItems` 获取继承项
   - 若某等级有继承的 converters，在该等级行的特殊效果区域追加 `🔁 继承：[converter描述]` 蓝灰色提示行
   - 若某等级有继承的 ruleMods，追加 `⚙️ 继承：[ruleMod描述]` 青灰色提示行
   - 同时修复"无新增数值"的判断条件：当存在继承项时不显示"无新增数值"
   - _需求：1.3、3.1、3.2、3.3、3.4_

- [ ] 6. 在"效果递进"区域为每个等级增量标签添加"▲ 新增"视觉标识
   - 在 `EffectTag` 组件或其调用处，为递进区域的增量标签添加 `▲` 前缀（或通过 `isIncremental` prop 控制样式）
   - 确保增量为正时标签以绿色高亮显示（与现有 `positive` 逻辑一致，无需额外改动）
   - 同步更新 `showCandidateProgress`（成长路线）区域，应用相同的继承显示逻辑
   - _需求：1.1、1.2_

