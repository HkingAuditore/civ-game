# 实施计划：游戏后期模拟性能优化（轻重Tick分离方案）

- [ ] 1. 扩展 `performanceUtils.js` 频率配置与工具函数
   - 在 `RATE_LIMIT_CONFIG` 中新增所有缺失的频率配置项（`overseasInvestmentFrequency=20`、`foreignInvestmentFrequency=20`、`officialSimFrequency=5`、`cabinetFrequency=5`、`rebellionFrequency=3`、`exodusFrequency=5`）
   - 为三级频率定义常量枚举（`TICK_PRIORITY.CRITICAL` / `DEFERRED` / `BATCH`），并为每个性能分段标注所属级别
   - 新增 `getDynamicFrequency(baseFreq, nationCount, perfMode)` 函数，根据AI国家数量和设备性能模式动态计算实际频率
   - 确保 `shouldRunThisTick()` 兼容新增的所有频率配置项，无需调用方修改
   - _需求：2.1、2.2、2.3、2.4_

- [ ] 2. 在 `simulation.js` 中为所有deferred级分段接入频率控制
   - 为 `officialsSim`、`cabinetMechanics`、`exodusAndPenalties`、`rebellionDaily`、`priceConvergence` 五个分段添加 `shouldRunThisTick` 守卫，使用步骤1中新增的频率配置
   - 为 `monthlyRelationDecay`、`orgMonthly`、`migrationMonthly` 确认现有的月度守卫逻辑是否已满足需求，若不足则补充频率控制
   - 确保所有被跳过的tick中，critical级（税收、生产、消费等20个分段）仍然完整执行且数值不受影响
   - _需求：1.1、1.2_

- [ ] 3. 实现投资系统批量结算（batch级）
   - 为 `overseasInvestments`、`overseasUpgrades`、`foreignInvestments`、`foreignUpgrades` 四个分段添加batch级守卫（默认每20tick执行一次）
   - 修改投资结算函数，接受 `ticksElapsed` 参数，将收益（利润、税收）乘以累积tick数，实现一次结算N个tick的量
   - 保留投资"静态效果"（就业岗位等）在非结算tick中正常生效，仅延迟"动态效果"（利润回流、升级决策）
   - 处理结算间隔期间的异常事件（如被投资国家被吞并），确保下次结算时正确处理
   - 将 `manualTrade` 的频率从现有3tick调整为可配置，纳入batch级管理
   - _需求：1.1、1.3、3.1、3.2、3.3、3.4_

- [ ] 4. AI国家分片与轻重分离增强
   - 修改 `aiNationUpdate` 的分片逻辑：当AI国家 > 10时，`aiNationUpdateSlices` 自动调整为 `Math.max(4, Math.ceil(nationCount / 4))`
   - 在AI国家模拟内部区分"收入流转"与"决策行为"：将AI国家的税收/预算/人口增长提取为每tick必执行路径，建筑扩建/宣战/贸易策略调整走分片路径
   - 修改 `diplomacyAI` 的分片逻辑，使 `diplomacyUpdateSlices` 根据国家数量动态调整
   - _需求：4.1、4.2、4.3、4.4_

- [ ] 5. 动态频率自适应（国家数量 + 设备性能）
   - 在 `simulation.js` 的 `simulateTick` 入口处，根据当前存活AI国家数量调用 `getDynamicFrequency` 计算本tick的实际频率配置
   - 设定国家数量阈值（如15个），超过时自动提升deferred和batch级操作的间隔
   - 集成 `useDevicePerformance` 的性能模式信息：低性能模式下所有deferred频率×1.5、batch频率×2；高性能模式使用默认值
   - 确保用户手动切换性能模式时，频率配置立即在下一个tick生效
   - _需求：2.2、2.3、9.1、9.2、9.3_

- [ ] 6. Tick预算保护机制
   - 在 `simulateTick` 中引入 `performance.now()` 计时，在critical级分段全部执行完毕后检查已用时间
   - 若已用时间接近预算上限（150ms），将剩余的deferred和batch级操作标记为"推迟"，留到下一个tick执行
   - 维护推迟计数器：连续3个tick发生推迟时，在控制台输出性能警告
   - 确保单tick主线程阻塞时间不超过200ms（含state apply）
   - _需求：8.1、8.2、8.3、8.4_

- [ ] 7. History数据从simulation输入中分离
   - 从 `simulateTick` 的参数和Worker `postMessage` 的payload中移除 `classWealthHistory`、`classNeedsHistory` 等历史数组
   - 在 `useGameLoop.js` 中使用 ref 管理历史数据，基于每tick的结果数据在主线程追加历史条目
   - 将 `HISTORY_UPDATE_INTERVAL` 改为可配置项，纳入 `RATE_LIMIT_CONFIG`；低性能模式下自动从5提升到10或更高
   - _需求：7.1、7.2、7.3、7.4_

- [ ] 8. Worker通信差异传输优化
   - 在 Worker 端实现 `diffResult(prevState, newState)` 函数，仅提取本tick实际变化的字段
   - 调试面板未打开时，从传输payload中剔除 `_debug`、`buildingDebugData`、`modifiers.sources` 等数据
   - 在 `useGameLoop.js` 中修改结果apply逻辑，支持差异数据与现有状态的正确合并（shallow merge + 深层字段处理）
   - _需求：5.1、5.2、5.3、5.4_

- [ ] 9. UI渲染节流扩展
   - 为所有非活跃tab的面板组件应用 `useThrottledSelector` + `UI_THROTTLE_PRESETS.slow`（500ms）
   - 为统计/图表面板应用 `UI_THROTTLE_PRESETS.background`（1000ms）
   - 低性能模式下自动将所有 `UI_THROTTLE_PRESETS` 时间间隔翻倍
   - 确保 `useThrottledSelector` 仅在选中的状态切片实际变化时才触发重渲染
   - _需求：6.1、6.2、6.3、6.4_

- [ ] 10. 集成验证与帧率监控
   - 添加帧率监控逻辑：运行中检测到持续帧率低于目标时，通过UI提示建议用户切换低性能模式
   - 在开发环境下，为每个性能分段输出执行/跳过日志，验证三级频率体系的正确性
   - 对比优化前后的tick执行时间，确认后期总计算量降低≥40%
   - _需求：1.4、9.4_
