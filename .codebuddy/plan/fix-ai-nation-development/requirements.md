# 需求文档：修复外国（AI）国家数值发展系统

## 引言

在修复了 Worker `stripPayloadForTransfer` 删除 `economyTraits` 导致的人口震荡问题后，AI 国家的人口虽然稳定了，但完全不再增长或下降——外国的数值发展看起来完全不正常。

**根因分析：** 为了修复人口震荡，引入了多层安全限制机制，这些机制叠加后过度压制了正常的增长空间：

1. **`_normalizeLegacyOutliers` 的 hardPopulationCap**：每个 tick 都将人口 cap 到 `carryingCapacity * 1.15`，而 `carryingCapacity` 本身受 `basePopulation` 限制，形成了"人口被 cap → 无法突破 cap → 永远不增长"的死循环
2. **10% safety clamp**：`AIEconomyService.update` 中限制每个增长周期人口最多变化 10%，这本身合理但与其他限制叠加后过于保守
3. **basePopulation 增长过慢**：仅 0.5%/周期，且被 `carryingCapacity * 0.5` 封顶，导致 `carryingCapacity` 几乎不增长
4. **effectiveCapacityFloor 被过度限制**：`hardCapacityLimit * 2.5` 的上限使得 `capacityFloor` 无法为增长提供足够空间
5. **crowdingFactor 在接近 capacity 时急剧下降**：当 `capacityRatio` 接近 1 时，增长率被大幅压缩

这些机制的初衷是防止人口爆炸和震荡，但叠加后形成了"增长天花板 = 当前人口"的效果，使 AI 国家完全停滞。

## 需求

### 需求 1：恢复 AI 国家正常的人口增长/衰退能力

**用户故事：** 作为一名玩家，我希望外国（AI）国家的人口能够随时间自然增长或因战争/资源不足而衰退，以便游戏世界感觉是动态和真实的。

#### 验收标准

1. WHEN AI 国家处于和平状态且资源充足 THEN 系统 SHALL 使其人口以合理速率持续增长（epoch 1 下约 0.1%-0.4%/增长周期）
2. WHEN AI 国家人口远低于 carryingCapacity THEN 系统 SHALL 提供较高的增长率（接近基础增长率上限）
3. WHEN AI 国家人口接近 carryingCapacity THEN 系统 SHALL 逐渐降低增长率但不完全归零（S 曲线特征）
4. WHEN AI 国家处于战争状态 THEN 系统 SHALL 降低增长率但不完全阻止增长（战争惩罚系数）
5. WHEN AI 国家资源严重不足（食物短缺） THEN 系统 SHALL 允许人口负增长（衰退）
6. IF 人口在连续 100 个 tick 内变化幅度小于 0.1% THEN 系统 SHALL 被视为异常停滞（用于验证修复效果）

### 需求 2：修复 basePopulation 与 carryingCapacity 的正反馈循环控制

**用户故事：** 作为一名开发者，我希望 basePopulation 的增长机制既能防止失控爆炸，又能为正常发展留出空间，以便 AI 国家的承载力能随发展逐步提升。

#### 验收标准

1. WHEN AI 国家人口持续增长 THEN 系统 SHALL 以合理速率提升 basePopulation（建议 1%-2%/周期，而非当前的 0.5%）
2. WHEN basePopulation 增长 THEN 系统 SHALL 确保 carryingCapacity 相应提升，为进一步增长留出空间
3. IF basePopulation 的增长导致 carryingCapacity 在单个周期内增长超过 5% THEN 系统 SHALL 限制 basePopulation 增长速率以防止正反馈失控
4. WHEN basePopulation ceiling 被计算时 THEN 系统 SHALL 使用 `carryingCapacity * 0.8`（而非当前的 0.5）作为上限，给予更多增长空间

### 需求 3：调整 _normalizeLegacyOutliers 的 population cap 策略

**用户故事：** 作为一名开发者，我希望 population cap 机制只在真正异常的情况下触发（如旧存档数据错误），而不是每个 tick 都限制正常增长，以便 AI 国家能正常发展。

#### 验收标准

1. WHEN AI 国家人口在 carryingCapacity 的合理范围内（≤ 1.3 倍） THEN 系统 SHALL 不触发 population cap
2. WHEN AI 国家人口超过 carryingCapacity 的 1.3 倍 THEN 系统 SHALL 以平滑方式（每 tick 最多降 10%）将人口拉回合理范围
3. IF hardPopulationCap 被触发 THEN 系统 SHALL 记录日志以便调试
4. WHEN population cap 从 1.15 倍调整为 1.3 倍 THEN 系统 SHALL 不导致人口爆炸（需验证与其他增长限制的配合）

### 需求 4：优化 AIPopulationDynamics 的增长模型参数

**用户故事：** 作为一名开发者，我希望人口增长模型的参数能产生合理的 S 曲线增长，以便 AI 国家在不同阶段都有适当的发展速度。

#### 验收标准

1. WHEN capacityRatio < 0.5 THEN 系统 SHALL 提供接近最大增长率的增长速度（快速扩张阶段）
2. WHEN capacityRatio 在 0.5-0.8 之间 THEN 系统 SHALL 提供中等增长率（稳定增长阶段）
3. WHEN capacityRatio 在 0.8-1.0 之间 THEN 系统 SHALL 提供较低但非零的增长率（减速阶段）
4. WHEN capacityRatio > 1.0 THEN 系统 SHALL 提供负增长率（人口收缩阶段）
5. WHEN effectiveCapacityFloor 被计算时 THEN 系统 SHALL 使用 `hardCapacityLimit * 3.5`（而非 2.5）作为上限，给予更多增长空间

### 需求 5：确保 AI 国家的财富、时代升级等其他发展指标正常运作

**用户故事：** 作为一名玩家，我希望外国不仅人口能增长，财富、科技、时代等也能正常发展，以便游戏中后期外国能成为有意义的对手或伙伴。

#### 验收标准

1. WHEN AI 国家人口增长 THEN 系统 SHALL 同步增长其财富（基于人均财富模型）
2. WHEN AI 国家满足时代升级条件 THEN 系统 SHALL 正常触发时代升级
3. WHEN AI 国家财富增长 THEN 系统 SHALL 不超过人均财富上限（perCapitaWealthCap）
4. IF AI 国家在 500 个 tick 内人口、财富、时代均无变化 THEN 系统 SHALL 被视为发展异常

### 需求 6：移除或精简过度的安全限制，保留必要的防护

**用户故事：** 作为一名开发者，我希望安全限制机制只保留真正必要的防护（防止数据错误导致的爆炸），移除过度保守的限制，以便系统既稳定又能正常运作。

#### 验收标准

1. WHEN 10% safety clamp 被评估时 THEN 系统 SHALL 将上限放宽至 15%-20%（或根据 ticksSinceUpdate 动态调整）
2. WHEN [POP JUMP] 日志被触发 THEN 系统 SHALL 仅在变化超过 20% 时记录警告（降低噪音）
3. WHEN [POP CLAMP] 被触发 THEN 系统 SHALL 记录详细信息以便调试
4. IF 所有安全限制被调整后 THEN 系统 SHALL 不出现人口震荡（回归测试）
5. IF 所有安全限制被调整后 THEN 系统 SHALL 不出现人口爆炸（单个增长周期内人口翻倍以上）
