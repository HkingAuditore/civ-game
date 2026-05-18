# 需求文档：AI国家发展水平与难度/玩家发展挂钩

## 引言

当前AI国家的发展系统存在以下问题：
1. **难度关联薄弱**：`aiDevelopmentMultiplier` 仅作为目标值的乘数，不直接影响AI的实际增长速率、承载力上限或财富积累速度。低难度下AI仍可能过强，高难度下AI可能发展不足。
2. **玩家参考权重过低**：AI发展目标中玩家影响因子仅10-20%（`getAIPlayerInfluenceFactor`），AI发展主要由自身 `ownBasePopulation/ownBaseWealth` 驱动，导致AI发展轨迹与玩家发展水平脱节。
3. **缺乏动态上下限**：没有机制确保AI发展水平在玩家发展水平的某个合理范围内波动，导致AI可能远远落后于玩家（如截图所示的"藏红花城邦"），或在某些情况下远超玩家。

本需求旨在建立一套**基于难度等级和玩家当前发展水平**的AI发展动态调节机制，使AI国家的发展水平始终处于一个与玩家相关的合理区间内，同时保持不同AI国家之间的差异性。

### 现有系统关键数据流

```
difficulty.js → aiDevelopmentMultiplier (0.8~4.0)
                ↓
aiEconomy.js → updateAIDevelopment() → desiredPopulation/desiredWealth
    - AI自身目标 = ownBase × eraGrowthFactor × powerFactor × multiplier
    - 玩家目标 = playerBaseline × powerFactor × eraMomentum
    - 混合 = AI自身 × (1 - 10~20%) + 玩家 × (10~20%)
                ↓
AIEconomyService → AIDevelopmentService → AIPopulationDynamics
    - 实际增长由承载力、食物、就业、财富等因子决定
    - difficultyMultiplier 影响 playerReferenceWeight 和 softCapBoost
```

## 需求

### 需求 1：基于难度的AI发展速率调节

**用户故事：** 作为一名玩家，我希望AI国家的发展速度与当前难度等级直接相关，以便在不同难度下获得不同的挑战体验。

#### 验收标准

1. WHEN 难度为"和平"或"简单" THEN AI国家的人口增长率和财富积累速率 SHALL 受到明显的减速（相对于普通难度），使AI发展节奏慢于玩家。
2. WHEN 难度为"困难"、"灾厄"或"地狱" THEN AI国家的人口增长率和财富积累速率 SHALL 获得加速，使AI发展节奏快于玩家。
3. WHEN `aiDevelopmentMultiplier` 改变时 THEN 该乘数 SHALL 同时影响以下三个维度：
   - AI人口增长的基础增长率（`baseGrowthRate`）
   - AI财富积累的 subsistence income 和 savings flow
   - AI承载力计算中的 `capacityFloor`
4. IF 难度乘数 < 1.0 THEN AI的基础增长率 SHALL 按比例降低，但不低于普通难度的 50%。
5. IF 难度乘数 > 1.0 THEN AI的基础增长率 SHALL 按比例提高，但不超过普通难度的 200%。

### 需求 2：AI发展水平的玩家相对上限

**用户故事：** 作为一名玩家，我希望AI国家的发展水平有一个与我当前发展水平相关的上限，以便AI不会无限膨胀到不合理的程度。

#### 验收标准

1. WHEN AI国家的人均财富超过玩家人均财富的一定倍数时 THEN 系统 SHALL 对该AI国家的财富增长施加递减惩罚。
   - 和平/简单：上限为玩家人均财富的 0.8x / 1.0x
   - 普通：上限为玩家人均财富的 1.5x
   - 困难：上限为玩家人均财富的 2.5x
   - 灾厄/地狱：上限为玩家人均财富的 4.0x / 6.0x
2. WHEN AI国家的人口超过玩家人口的一定倍数时 THEN 系统 SHALL 对该AI国家的人口增长施加递减惩罚（通过降低承载力上限）。
   - 和平/简单：上限为玩家人口的 1.0x / 1.5x
   - 普通：上限为玩家人口的 2.5x
   - 困难：上限为玩家人口的 4.0x
   - 灾厄/地狱：上限为玩家人口的 6.0x / 10.0x
3. IF AI国家的发展水平接近上限（>80%） THEN 增长速率 SHALL 平滑递减（软上限），而非突然截断（硬上限）。
4. WHEN 玩家发展水平提升时 THEN AI国家的发展上限 SHALL 相应提升，允许AI继续增长。

### 需求 3：AI发展水平的玩家相对下限（追赶机制）

**用户故事：** 作为一名玩家，我希望AI国家不会因为早期发展不利而永远停滞，以便游戏中始终存在有意义的外交和军事互动对象。

#### 验收标准

1. WHEN AI国家的人均财富低于玩家人均财富的一定比例时 THEN 系统 SHALL 为该AI国家提供额外的发展加速（追赶加成）。
   - 和平/简单：下限为玩家人均财富的 0.15x / 0.2x
   - 普通：下限为玩家人均财富的 0.3x
   - 困难/灾厄/地狱：下限为玩家人均财富的 0.5x / 0.6x / 0.7x
2. WHEN AI国家的人口低于玩家人口的一定比例时 THEN 系统 SHALL 为该AI国家提供人口增长加速。
   - 和平/简单：下限为玩家人口的 0.2x / 0.3x
   - 普通：下限为玩家人口的 0.4x
   - 困难/灾厄/地狱：下限为玩家人口的 0.6x / 0.7x / 0.8x
3. IF AI国家的发展水平低于下限 THEN 追赶加成 SHALL 随差距增大而增强，但不超过正常增长率的 3 倍。
4. WHEN AI国家的发展水平回到下限以上时 THEN 追赶加成 SHALL 平滑消退。

### 需求 4：保持AI国家间的差异性

**用户故事：** 作为一名玩家，我希望不同AI国家之间仍然保持发展差异，以便游戏世界感觉真实且多样化。

#### 验收标准

1. WHEN 应用难度和玩家相对调节时 THEN 系统 SHALL 保留每个AI国家的 `foreignPower` 特征（`populationFactor`、`wealthFactor`、`volatility`），使不同国家有不同的发展轨迹。
2. WHEN 多个AI国家同时存在时 THEN 它们的发展水平 SHALL 在上下限范围内呈现自然分布，而非趋同于同一水平。
3. IF AI国家处于战争状态 THEN 战时惩罚 SHALL 独立于难度调节机制运作，不被追赶加成抵消。

### 需求 5：难度配置的可扩展性

**用户故事：** 作为一名开发者，我希望新增的难度相关参数集中在现有的 `difficulty.js` 配置中，以便未来调整平衡时只需修改配置值。

#### 验收标准

1. WHEN 新增AI发展上下限参数时 THEN 这些参数 SHALL 定义在 `DIFFICULTY_CONFIG` 的各难度级别中。
2. WHEN 需要调整某个难度的AI发展范围时 THEN 开发者 SHALL 只需修改 `difficulty.js` 中的配置值，无需修改逻辑代码。
3. WHEN 新增难度级别时 THEN 新的AI发展参数 SHALL 自动继承默认值（普通难度的值）。

### 需求 6：与现有系统的兼容性

**用户故事：** 作为一名玩家，我希望加载旧存档时AI国家能平滑过渡到新的发展机制，以便不会出现突然的数值跳变。

#### 验收标准

1. WHEN 加载不包含新参数的旧存档时 THEN 系统 SHALL 使用合理的默认值，不产生错误。
2. WHEN 新机制首次应用于旧存档的AI国家时 THEN 发展水平的调整 SHALL 在多个tick内平滑过渡，而非一次性跳变。
3. IF AI国家当前发展水平远超新上限 THEN 系统 SHALL 通过缓慢衰减（而非截断）使其逐步回归合理范围。

## 技术约束

- 所有修改应在现有模块内完成，不创建新的并行系统
- 主要修改点：`difficulty.js`（配置）、`AIPopulationDynamics.js`（人口增长）、`AIDevelopmentService.js`（财富积累）、`aiEconomy.js`（目标计算）
- 保持 `AIEconomyService` 作为唯一的经济更新入口
- 不修改玩家侧的经济逻辑
