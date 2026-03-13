# 实施计划：军事系统全面升级

> 基于需求文档：`.codebuddy/plan/military-system-overhaul/requirements.md`

---

- [x] 1. 新增军事资源定义与市场集成
  - 在 `src/config/gameConstants.js` 的 RESOURCES 中添加7种军事资源：swords(Epoch 2)、plate_armor(Epoch 3)、gunpowder(Epoch 4)、muskets(Epoch 4)、rifles(Epoch 5)、ammunition(Epoch 5)、ordnance(Epoch 6)
  - 每种资源配置完整的 basePrice/minPrice/maxPrice/marketConfig，标记 tags 包含 'military'，设置正确的 unlockEpoch
  - 确保新资源可被现有的市场价格/供需系统（`src/logic/economy/`）自动识别和处理
  - 在 `src/config/iconMap.js` 中为每种新资源配置图标映射
  - _需求：1.1-17, 5.1-1_

- [x] 2. 新增军事生产建筑
  - 在 `src/config/buildings.js` 中添加7种军事生产建筑：铸剑坊(swordsmith, Epoch 2)、甲胄工坊(armorsmith, Epoch 3)、火药工坊(powder_mill, Epoch 4)、枪炮作坊(gun_workshop, Epoch 4)、枪械工坊(rifle_works, Epoch 5)、弹药厂(ammo_factory, Epoch 5)、兵工厂(arms_factory, Epoch 6)
  - 每栋建筑配置完整的 baseCost/input/output/jobs/category(military)，确保 input 消耗与 output 产出遵循需求文档中的原料→成品关系
  - 在 `src/config/buildingUpgrades.js` 中为新建筑配置升级路径（0→1→2级），产出倍率遵循现有 1.3x→1.8x 规律
  - _需求：1.2-1~8, 5.3-1_

- [x] 3. 新增军事科技并更新科技树
  - 在 `src/config/technologies.js` 中添加6项军事科技：swordsmithing(Epoch 2)、armor_forging(Epoch 3)、gunpowder_formula(Epoch 4)、musket_manufacturing(Epoch 4, 前置:gunpowder_formula)、rifle_engineering(Epoch 5)、military_industrialization(Epoch 6)
  - 每项科技配置 cost/epoch/prerequisites/effects，effects 中包含解锁对应资源和建筑、军事建筑效率加成等
  - 确保科技 cost 遵循现有递增规律，prerequisites 形成合理的军事科技分支
  - _需求：1.3-1~7_

- [x] 4. 更新兵种的招募和维护成本
  - 在 `src/config/militaryUnits.js` 中修改各时代兵种的 recruitCost 和 maintenanceCost，按需求文档的资源-兵种对照表添加军事资源消耗：
    - Epoch 0-1 兵种：保持仅消耗基础资源(food/wood/copper)
    - Epoch 2 兵种(剑士/弩手等)：recruitCost 增加 swords
    - Epoch 3 兵种(重步兵/骑士等)：recruitCost 增加 swords + plate_armor
    - Epoch 4 火器兵种：recruitCost 增加 muskets，maintenanceCost 增加 gunpowder；冷兵器兵种仍需 swords/plate_armor
    - Epoch 5 兵种：recruitCost 增加 rifles，maintenanceCost 增加 ammunition
    - Epoch 6 兵种：recruitCost 增加 ordnance，maintenanceCost 增加 ammunition
  - 添加装备加成机制：有充足军事资源供应的兵种获得攻击/防御加成；火器类兵种缺少 gunpowder/ammunition 时战斗力大幅降低
  - _需求：1.1-1~16, 3.5-4_

- [x] 5. 更新军事产业链配置
  - 在 `src/config/industryChains.js` 中重写 military_chain，反映从 Epoch 0 到 Epoch 6 的时代演进多级加工链
  - 在 `src/config/buildingChains.js` 中新增军事生产建筑链条目，展示各时代建筑的升级路径
  - _需求：1.4-1~3_

- [x] 6. 实现军团(Army Corps)与将领(General)数据模型
  - 在 `src/config/militaryUnits.js` 或新建 `src/config/militaryCorps.js`（仅当 militaryUnits.js 不适合扩展时）中定义军团数据结构：{ id, name, units[], generalId, assignedFrontId, status }
  - 定义将领数据结构：{ id, name, level, experience, traits: { attackBonus, defenseBonus, speedBonus, moraleBonus } }
  - 在 `src/logic/diplomacy/militaryUtils.js` 中添加军团管理函数：createCorps/disbandCorps/assignUnitsToCorps/removeUnitsFromCorps
  - 添加将领管理函数：generateGeneral（随机属性）、assignGeneral/removeGeneral、gainExperience/levelUp
  - 无将领的军团施加 -15% 战斗力惩罚
  - _需求：2.2-1~5, 2.3-1~5_

- [x] 7. 实现战线(Front)系统与经济掠夺
  - 在 `src/logic/diplomacy/` 中新建 `frontSystem.js`，实现战线核心逻辑：
    - generateFront(war)：宣战时自动生成战线，包含资源点(基于双方经济)和建筑设施(基于双方建筑)
    - assignCorpsToFront/removeCorpsFromFront：军团分配/撤离
    - 多战线管理：每场战争独立战线，gameState.fronts[] 维护所有活跃战线
  - 实现战线经济掠夺逻辑：
    - plunderResourceNode(front, winner)：胜方掠夺资源点，转移资源并降低被掠夺方产出
    - damageInfrastructure(front, attacker)：攻击建筑设施，根据攻击力和耐久度计算破坏
    - applyFrontDamageToEconomy(gameState)：将战线上的破坏映射为实际经济减产效果
  - 在 `src/logic/diplomacy/nations.js` 的宣战/和平逻辑中集成战线的创建与销毁
  - _需求：2.1-1~5, 2.4-1~6, 5.1-3_

- [x] 8. 重构战斗系统为持续时间制
  - 在 `src/config/militaryUnits.js` 中重构 `simulateBattle()` 函数（或新建 `src/logic/diplomacy/battleSystem.js`），将瞬时结算改为创建 Battle 对象的持续时间制：
    - createBattle(attackerCorps, defenderCorps, front, battleType)：创建战斗，计算预计持续天数（遭遇战3-5天/会战10-30天/围城30-90天）
    - processCombatRound(battle)：单回合战斗计算——按兵种类别匹配，每回合独立计算克制加成、特殊能力触发、伤亡分配
    - 战场态势(momentum)系统：维护 0-100 的态势值，每回合根据伤亡比更新；态势>75 触发溃败效果
    - 战斗结束条件：兵力归零 / 士气崩溃 / 回合数达上限 / 撤退完成
  - 在 `src/logic/simulation.js` 的主循环 tick 中添加 `processActiveBattles()` 调用，每日推进所有进行中战斗一个回合
  - _需求：3.1-1~5, 3.2-1~5, 3.5-1~3_

- [x] 9. 实现战斗补给消耗与玩家战术干预
  - 在战斗回合处理中集成经济影响：
    - 每回合消耗参战军团的补给(food + 时代对应军事消耗品)
    - 补给不足时施加战斗力惩罚(-30%攻击/-20%防御)
    - 战斗超时后补给消耗加速
  - 实现玩家战术指令系统：
    - setTacticOrder(battle, order)：支持 'focus_attack'(集中攻击目标兵种)、'defensive'(防御姿态+30%防御/-20%攻击)、'retreat'(1-3回合撤退，受追击)
    - processReinforcement(battle, corps)：增援到达延迟1-3回合后加入战斗
  - 在 `src/logic/diplomacy/aiWar.js` 中更新 AI 战争行为，使 AI 也能使用军团/战线/战术系统
  - _需求：3.3-1~5, 3.4-1~5_

- [x] 10. 更新军事面板UI——军团管理与战线视图
  - 在 `src/components/tabs/MilitaryTab.jsx` 中新增军团管理区域：
    - 军团列表（名称/兵力构成/将领/部署位置）
    - 创建/编辑军团（兵种分配界面）
    - 将领查看与指派
  - 在 `src/components/tabs/MilitaryTab.jsx` 中新增战线视图区域：
    - 活跃战线列表（敌方国家/兵力对比/资源点状态）
    - 战线详情展开（己方军团/敌方估计兵力/资源和建筑状态）
    - 军团→战线的分配操作
  - _需求：4.1-1~3, 4.2-1~3_

- [x] 11. 更新战斗进度展示与战斗结果UI
  - 修改 `src/components/common/BattleNotification.jsx` 以支持显示进行中战斗的实时状态（进度条/当前回合/态势值/兵力变化）
  - 修改 `src/components/modals/BattleResultModal.jsx` 以支持：
    - 进行中战斗的回合报告（伤亡/克制效果/特殊能力触发/战术指令效果）
    - 玩家战术操作按钮（集中攻击/防御姿态/撤退/派遣增援）
    - 战斗结束后的完整总结报告（总伤亡/战利品/战线设施变化）
  - _需求：4.3-1~3, 3.4-1~5_

- [x] 12. 系统集成：外交/经济/AI联动与数值平衡
  - 在 `src/logic/diplomacy/aiDiplomacy.js` 中更新 AI 宣战评估，考虑目标国军事产业链完整度
  - 在 `src/logic/diplomacy/negotiation.js` 中更新和平谈判逻辑，将战线设施破坏程度纳入赔款计算
  - 在 `src/logic/diplomacy/aiWar.js` 中增加 AI 在战线重大损失后的求和倾向
  - 在经济系统中确保军事资源的时代过渡：旧式资源需求下降价格走低，新式资源需求上升
  - 全局数值平衡检查：军事产业链投入产出比、战斗持续时间合理性、掠夺收益递减、将领加成范围(+5%~+25%)
  - _需求：5.1-1~4, 5.2-1~3, 5.3-1~5_
