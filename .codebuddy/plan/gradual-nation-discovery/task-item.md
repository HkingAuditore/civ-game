# 实施计划：渐进式国家发现系统

- [ ] 1. 在配置层添加发现机制参数
   - 在 `src/config/gameConstants.js` 中新增 `DISCOVERY_CONFIG` 配置块
   - 包含：每时代初始解锁比例（如 0.5）、最小/最大解锁数、逐步发现tick间隔、基础发现概率、航海家加成系数、时代加成系数
   - 提供合理默认值，确保无需修改逻辑代码即可调整发现节奏
   - _需求：6.1、6.2、6.3_

- [ ] 2. 为国家数据模型添加 `discovered` 字段
   - 在 `src/hooks/useGameState.js` 的 `buildInitialNations()` 中，为每个国家添加 `discovered` 字段
   - 初始时代（epoch 0）的国家默认 `discovered: true`，其余为 `false`
   - 在存档加载逻辑中添加迁移：旧存档中无 `discovered` 字段的国家，若 `appearEpoch <= currentEpoch` 且 `relation` 已有值，则自动标记为 `discovered: true`
   - _需求：3.4、7.1、7.2、7.3_

- [ ] 3. 实现时代升级时的随机部分解锁逻辑
   - 在 `src/logic/diplomacy/` 下新建 `nationDiscovery.js` 模块（或扩展现有模块）
   - 实现 `discoverNationsOnEpochChange({ nations, newEpoch, config })` 函数：从该时代可解锁国家池中随机选取部分国家标记为 `discovered: true`
   - 处理 `alwaysDiscover` 标记的国家必定解锁
   - 若可解锁数 ≤ 最小解锁数，则全部解锁
   - 为新发现的国家调用现有的 `scaleNewlyUnlockedNation` 进行实力缩放
   - _需求：1.1、1.2、1.3、1.4_

- [ ] 4. 实现逐步发现机制（tick驱动）
   - 在 `nationDiscovery.js` 中实现 `processGradualDiscovery({ nations, tick, epoch, navigatorPop, config })` 函数
   - 每隔配置的tick间隔，以基础概率（受航海家人口和时代加成）从未发现国家池中随机发现一个国家
   - 若所有当前时代国家已发现，跳过检查
   - 返回新发现的国家列表和日志消息
   - _需求：2.1、2.2、2.3、2.4、2.5_

- [ ] 5. 创建统一的国家可见性工具函数
   - 在 `src/utils/` 下新建 `nationVisibility.js`（或扩展 `src/utils/diplomacyUtils.js`）
   - 实现 `isNationDiscovered(nation)` 和 `getDiscoveredNations(nations, epoch)` 工具函数
   - 统一封装 `discovered === true` + `appearEpoch` + `expireEpoch` + `isAnnexed` + 附庸豁免等判断逻辑
   - 所有UI和逻辑层的可见性过滤统一调用此函数，避免分散的重复判断
   - _需求：3.1、3.5_

- [ ] 6. 修改 simulation.js 集成发现系统
   - 在 `simulation.js` 的主循环中集成 `processGradualDiscovery` 调用（在国家更新循环附近）
   - 修改 `hasAppeared` 判断（L5882）：未发现的国家仅执行最小化后台增长，不执行完整AI模拟
   - 在时代升级检测逻辑后调用 `discoverNationsOnEpochChange`
   - 修改 `initializeForeignRelations`（L6276）：仅在双方都已发现时建立外交关系
   - 处理边界情况：未发现国家主动发起战争/外交事件时自动标记为已发现
   - _需求：3.2、3.3、4.1、4.4_

- [ ] 7. 实现AI国家间的发现机制
   - 扩展 `aiDiplomacy.js` 的 `initializeForeignRelations`：仅对互相已发现的国家初始化关系
   - 在AI时代升级逻辑（`aiEconomy.js` 的 `checkAIEpochProgression`）后触发AI国家的发现逻辑
   - 相邻时代的AI国家有更高互相发现概率
   - AI国家间发生战争时自动互相发现
   - _需求：4.1、4.2、4.3、4.4_

- [ ] 8. 更新所有UI组件的国家可见性过滤
   - 修改 `DiplomacyTab.jsx`（L95-112）：使用统一的 `isNationDiscovered` 替换现有过滤逻辑
   - 修改 `DiplomacyDashboard.jsx`（L51）：同上
   - 修改 `TradeRoutesModal.jsx`（L392）：同上
   - 修改 `VassalManagementSheet.jsx`（L1677）：同上
   - 修改 `MilitaryTab.jsx`（L607）：同上
   - 修改 `eventUtils.js`（L97-132）的 `resolveRandomNationInEvent`：同上
   - 修改 `useGameActions.js`（L750-760）的 `getVisibleNations`：同上
   - _需求：5.1、3.1_

- [ ] 9. 添加发现相关的UI提示
   - 在 `DiplomacyTab.jsx` 或 `DiplomacyDashboard.jsx` 中添加"未探索国家数量"提示（如"还有 X 个文明等待发现"）
   - 在日志系统中添加发现通知格式（如"🌍 探险家发现了新的文明：XXX！"）
   - 升时代时在外交界面显示"发现新国家"的提示
   - _需求：5.2、5.3、5.4_

- [ ] 10. 存档兼容性验证与边界情况处理
   - 在 `useGameState.js` 的存档加载函数中确保 `discovered` 字段的迁移逻辑正确
   - 验证：旧存档加载后所有已有 `relation` 的国家被标记为已发现
   - 验证：新游戏开始时只有初始时代国家被发现
   - 确保 `buildMinimalAutoSavePayload` 保留 `discovered` 字段
   - _需求：7.1、7.2、7.3_
