// 内置百科模态框组件
// 提供分类导航、搜索和详情展示
// v2.1: 补充税收、人口增长、转职等核心机制说明

import React, { useEffect, useMemo, useState } from 'react';
import { Icon } from '../common/UIComponents';
import {
    BUILDINGS,
    TECHS,
    DECREES,
    RESOURCES,
    UNIT_TYPES,
    STRATA,
    EPOCHS,
    BASE_EVENTS,
    EPOCH_EVENTS,
    FESTIVAL_EFFECTS,
    STATIC_DIPLOMATIC_EVENTS,
} from '../../config';

// --- 核心机制攻略文案数据 ---
const MECHANICS_GUIDES = [
    {
        id: 'mech_quickstart',
        name: '新手入门指南',
        icon: 'Zap',
        summary: '快速上手游戏的基础操作和发展路线',
        content: [
            { type: 'h4', text: '🎮 游戏目标' },
            { type: 'p', text: '发展你的文明，从石器时代走向现代，通过经济、军事、文化等多种方式实现繁荣。' },
            { type: 'h4', text: '📋 基础操作' },
            {
                type: 'list', items: [
                    '建设标签：建造各类建筑，生产资源和提供就业岗位',
                    '科技标签：研究科技解锁新建筑和能力，升级时代',
                    '政令标签：颁布政令获得各种加成，调整税率',
                    '军事标签：招募军队，查看部队状态',
                    '外交标签：与其他国家贸易、结盟或开战',
                    '阶层标签：查看各阶层状态，满足他们的需求'
                ]
            },
            { type: 'h4', text: '🚀 发展路线建议' },
            { type: 'p', text: '石器时代（前10分钟）：' },
            {
                type: 'list', items: [
                    '1. 建造农田和伐木场，确保粮食和木材稳定供应',
                    '2. 建造简陋小屋提升人口上限，让人口自然增长',
                    '3. 建造图书馆积累科研点数',
                    '4. 研究"基础工具"和"车轮"科技',
                    '5. 当科研≥500且人口≥20时，准备升级到青铜时代'
                ]
            },
            { type: 'p', text: '青铜时代（10-30分钟）：' },
            {
                type: 'list', items: [
                    '1. 建造庄园和木屋，提升资源产出和人口上限',
                    '2. 建造市场开始贸易，积累银币',
                    '3. 建造兵营招募基础军队保护国家',
                    '4. 研究"封建制度"解锁更多建筑',
                    '5. 注意满足各阶层的物资需求，保持稳定度'
                ]
            },
            { type: 'h4', text: '💡 新手提示' },
            {
                type: 'list', items: [
                    '资源不足时可以调整游戏速度（右上角1x/2x/5x）',
                    '粮食是最重要的资源，人口增长和军队维护都需要它',
                    '不要过度征税，会导致阶层不满和人口流失',
                    '建筑可以出售回收部分资源，但会失去岗位',
                    '定期查看日志了解游戏事件和提示',
                    '善用外交贸易，低买高卖赚取差价'
                ]
            }
        ]
    },
    {
        id: 'mech_economy',
        name: '市场与税收',
        icon: 'Coins',
        summary: '价格波动、进出口贸易与税收财政',
        content: [
            { type: 'h4', text: '1. 市场价格机制' },
            { type: 'p', text: '资源价格由供需关系实时决定。' },
            {
                type: 'list', items: [
                    '供给 (Supply)：国内生产 + 进口',
                    '需求 (Demand)：国内消耗 + 出口 + 人口维护',
                    '当需求 > 供给时，价格上涨；反之价格下跌。',
                    '银币是唯一的通用货币，不参与价格波动。'
                ]
            },
            { type: 'h4', text: '2. 财政税收体系' },
            { type: 'p', text: '国家收入主要来源于三种税收（可在政令-税收面板调整）：' },
            {
                type: 'list', items: [
                    '人头税 (Head Tax)：按人口每日征收。针对不同阶层有不同的基准税率。这是最稳定的收入来源，但过高会降低阶层好感度。',
                    '资源税 (Resource Tax)：对市场交易征收。每当资源在市场上买卖（无论是自动生产消耗还是进出口）时触发。工业发达时这笔收入很可观。',
                    '营业税 (Business Tax)：对建筑每次产出收取固定银币值。每种建筑可设置不同税率，由建筑业主支付。业主财产不足时放弃收税。',
                    '负税率 (补贴)：你可以将税率设为负数，变成补贴。人头税补贴提升阶层好感度和财富，营业税补贴降低企业生产成本。'
                ]
            },
            { type: 'h4', text: '2.1 营业税详解' },
            { type: 'p', text: '营业税是对建筑产出征收的固定税额，具有以下特点：' },
            {
                type: 'list', items: [
                    '征收时机：每当建筑产出资源时，自动从业主财产中扣除税款',
                    '固定税额：按"税率 × 建筑数量 × 产出倍率"计算，而非按比例收取',
                    '业主支付：由建筑的所有者（如商人、地主、资本家等）支付，算入生产成本',
                    '财产检查：如果业主财产不足支付税款，政府会放弃征收（不会导致负债）',
                    '补贴机制：设置负税率时，政府会向业主支付补贴，降低企业成本，但需要国库有足够资金',
                    '灵活调控：可以对不同建筑设置不同税率，实现精准的产业政策'
                ]
            },
            { type: 'h4', text: '2.2 营业税策略建议' },
            {
                type: 'list', items: [
                    '对盈利能力强的建筑（如市场、贸易港）适当收税，增加财政收入',
                    '对基础生产建筑（如农田、伐木场）考虑补贴，降低基础物资成本',
                    '对新兴产业给予补贴扶持，加速产业发展',
                    '注意国库余额，避免补贴过多导致财政困难',
                    '观察业主财富状况，避免过度征税导致企业破产'
                ]
            },
            { type: 'h4', text: '3. 国际贸易' },
            { type: 'p', text: '利用"外交"标签页中的贸易功能进行套利：' },
            {
                type: 'list', items: [
                    '出口：将盈余资源卖给高价收购的国家。',
                    '进口：从低价出售的国家买入资源，用于国内生产或赚取差价。',
                    '贸易技巧：观察各国的收购价和出售价，寻找套利机会。'
                ]
            },
            { type: 'h4', text: '4. 商人系统' },
            { type: 'p', text: '商人是特殊的阶层，他们会自动进行贸易：' },
            {
                type: 'list', items: [
                    '商人会买入低价资源，等待3个游戏日后高价卖出',
                    '每个商人每3天完成一次交易，利润率约20%',
                    '建造贸易站提供商人岗位',
                    '满足商人的奢侈品需求可以提升贸易效率'
                ]
            }
        ]
    },
    {
        id: 'mech_price_calculation',
        name: '市场价格计算详解',
        icon: 'TrendingUp',
        summary: '深入理解价格形成机制与差异化配置',
        content: [
            { type: 'h4', text: '📊 价格计算概述' },
            { type: 'p', text: '市场价格是一个多层次、动态平衡的系统，由成本基础、供需调节、库存调节和平滑处理四个环节组成。每个资源和建筑都可以有独特的经济参数配置。' },

            { type: 'h4', text: '🎯 第一步：成本锚定价格' },
            { type: 'p', text: '计算资源的生产成本作为价格基准：' },
            {
                type: 'list', items: [
                    '成本锚定价格 = (原料成本 + 人工成本) / 产出数量',
                    '原料成本 = Σ(投入资源数量 × 当前市场价格)',
                    '人工成本 = Σ(岗位数量 × 工资)',
                    '工资底线 = max(基础工资 × 0.8, 生活成本 × 1.05)',
                    '生活成本受建筑的 marketConfig.wage 权重影响'
                ]
            },
            { type: 'p', text: '示例（农田生产粮食）：投入无原料，2个农民×工资10=20，产出20单位，成本价=20/20=1.0' },

            { type: 'h4', text: '🎯 第二步：供需调节' },
            { type: 'p', text: '根据供需比例动态调整价格：' },
            {
                type: 'list', items: [
                    '供需比例 = (实际需求 + 虚拟需求) / 供应量',
                    '虚拟需求 = 人口 × virtualDemandPerPop（模拟市场基础需求）',
                    'pressure = tanh(ln(供需比例) × 0.9) × supplyDemandWeight',
                    '供不应求时：价格乘数 = 1 + pressure × (3.5 - 1)',
                    '供过于求时：价格乘数 = 1 + pressure × (1 - 0.7)'
                ]
            },
            { type: 'p', text: 'supplyDemandWeight 是关键参数，可通过 marketConfig 差异化配置：' },
            {
                type: 'list', items: [
                    '粮食：0.6（价格稳定，基础必需品）',
                    '家具：1.5（价格波动大，奢侈品）',
                    '默认：1.0（标准波动）'
                ]
            },
            { type: 'p', text: '示例：供需比例=2.0时，pressure≈0.55，价格乘数≈2.375（价格翻倍以上）' },

            { type: 'h4', text: '🎯 第三步：库存调节' },
            { type: 'p', text: '根据库存水平进一步调整价格：' },
            {
                type: 'list', items: [
                    '库存比例 = 当前库存 / 期望库存',
                    '期望库存 = 调整后需求 × inventoryTargetDays',
                    '库存压力 = max(0.3, 1 + (1 - 库存比例) × inventoryPriceImpact)',
                    '库存不足时价格上涨，库存充足时价格下跌'
                ]
            },
            { type: 'p', text: 'inventoryTargetDays 和 inventoryPriceImpact 可差异化配置：' },
            {
                type: 'list', items: [
                    '粮食：目标30天，影响0.15（战略储备，价格稳定）',
                    '家具：目标10天，影响0.4（非必需品，价格敏感）',
                    '默认：目标20天，影响0.25（标准配置）'
                ]
            },
            { type: 'p', text: '示例：库存100，期望200，库存比例0.5，库存压力=1+(1-0.5)×0.25=1.125' },

            { type: 'h4', text: '🎯 第四步：价格合成与平滑' },
            {
                type: 'list', items: [
                    '目标价格 = 成本锚定价格 × 价格乘数 × 库存压力',
                    '应用成本底线：max(目标价格, 成本锚定价格 × 0.6)',
                    '应用绝对底线：max(目标价格, PRICE_FLOOR)',
                    '平滑处理：最终价格 = 上一轮价格 + (目标价格 - 上一轮价格) × 0.1',
                    '平滑处理避免价格剧烈波动，模拟真实市场惯性'
                ]
            },

            { type: 'h4', text: '🏭 建筑配置的影响' },
            { type: 'p', text: '建筑的 marketConfig 影响其生产资源的成本计算：' },
            {
                type: 'list', items: [
                    'price.livingCostWeight：价格受生活成本影响的权重',
                    'price.taxCostWeight：价格受税收影响的权重',
                    'wage.livingCostWeight：工资受生活成本影响的权重',
                    'wage.taxCostWeight：工资受税收影响的权重'
                ]
            },
            { type: 'p', text: '农田示例（基础生产）：' },
            {
                type: 'list', items: [
                    'price: {livingCostWeight: 0.15, taxCostWeight: 0.2}',
                    'wage: {livingCostWeight: 0.08, taxCostWeight: 0.05}',
                    '效果：农民工资和粮食价格相对稳定，不易受市场波动影响'
                ]
            },
            { type: 'p', text: '家具工坊示例（奢侈品工艺）：' },
            {
                type: 'list', items: [
                    'price: {livingCostWeight: 0.3, taxCostWeight: 0.4}',
                    'wage: {livingCostWeight: 0.15, taxCostWeight: 0.15}',
                    '效果：工匠工资和家具价格随市场波动，反映奢侈品特性'
                ]
            },

            { type: 'h4', text: '📈 完整计算流程' },
            {
                type: 'list', items: [
                    '1. 查找生产建筑，获取其 marketConfig 配置',
                    '2. 计算成本锚定价格（使用建筑的 wage 权重）',
                    '3. 计算供需比例，应用 supplyDemandWeight 得到价格乘数',
                    '4. 计算库存比例，应用 inventoryPriceImpact 得到库存压力',
                    '5. 合成目标价格 = 成本 × 乘数 × 压力',
                    '6. 应用成本底线（60%）和绝对底线',
                    '7. 平滑处理（10%权重）得到最终价格'
                ]
            },

            { type: 'h4', text: '💡 差异化配置的意义' },
            {
                type: 'list', items: [
                    '基础必需品（粮食）：低波动权重 + 高库存目标 = 价格稳定',
                    '奢侈品（家具）：高波动权重 + 低库存目标 = 价格敏感',
                    '工业品：中等配置，平衡稳定性和市场反应',
                    '虚拟资源（科研、文化）：特殊配置，不受市场影响',
                    '策划可以为每个资源和建筑定制经济特性'
                ]
            },

            { type: 'h4', text: '🎮 玩家策略建议' },
            {
                type: 'list', items: [
                    '观察价格趋势：供需失衡时及时调整生产',
                    '库存管理：维持合理库存避免价格剧烈波动',
                    '套利机会：利用不同资源的价格波动特性进行贸易',
                    '产业链优化：建立完整生产链提升资源价值',
                    '建筑选择：了解不同建筑的经济特性，合理布局'
                ]
            }
        ]
    },
    {
        id: 'mech_strata',
        name: '人口与阶层流动',
        icon: 'Users',
        summary: '人口增长、职业转换与满意度影响',
        content: [
            { type: 'h4', text: '1. 人口增长机制' },
            { type: 'p', text: '人口不会凭空暴涨，需要满足以下条件才会自然增长：' },
            {
                type: 'list', items: [
                    '住房充足：当前人口 < 人口上限 (MaxPop)。建造房屋可提升上限。',
                    '粮食盈余：当前粮食库存 > 人口数 × 1.5。',
                    '社会稳定：稳定度越高，人口增长概率越大。',
                    '反之，如果粮食耗尽 (0)，人口会发生饥荒并减少。'
                ]
            },
            { type: 'h4', text: '2. 职业流动 (转职) 机制' },
            { type: 'p', text: '你的人民是"趋利"的，他们会自动寻找更有前途的工作：' },
            {
                type: 'list', items: [
                    '自动填补：当有空缺岗位时，失业人口会自动填补。',
                    '跳槽逻辑：如果某个职业的"潜在收入"（工资+资源出售收益）远高于当前职业，且目标职业有空缺，人口会辞职并转职。',
                    '财富携带：转职时，他们会带走自己积累的财富。',
                    '转职冷却：人口不会频繁跳槽，有一定的稳定期。'
                ]
            },
            { type: 'h4', text: '3. 阶层满意度' },
            { type: 'p', text: '阶层好感度决定了Buff/Debuff：' },
            {
                type: 'list', items: [
                    '物资需求：这是最关键的因素。满足日常需求（如商人的香料、工人的工具）能大幅提升好感。',
                    '税率影响：低税率提升好感，高税率降低好感。',
                    '如果好感度过低且该阶层影响力大，可能导致人口外流（带着财富离开）甚至叛乱。',
                    '高好感度会提供强大的加成：农民提升采集效率、工匠提升生产效率、学者提升科研等。'
                ]
            },
            { type: 'h4', text: '4. 阶层影响力' },
            { type: 'p', text: '每个阶层的影响力由人口数量和财富决定：' },
            {
                type: 'list', items: [
                    '影响力高的阶层对国家政策有更大发言权',
                    '贵族和资本家的影响力通常较高',
                    '平衡各阶层影响力是维持稳定的关键'
                ]
            },
            { type: 'h4', text: '5. 消费升级 (富裕需求)' },
            { type: 'p', text: '随着阶层积累财富，他们会陷入“财富陷阱”——变得更难取悦：' },
            {
                type: 'list', items: [
                    '需求升级：当人均财富达到初始值的1.5倍、2倍、3倍...时，会解锁新的奢侈品需求',
                    '如：农民开始需要香料，工人需要咖啡，贵族需要珍馐和华服',
                    '如果只给予高工资却无法提供相应的商品，阶层好感度反而会下降',
                    '这就是发展的代价：富裕的社会需要更复杂的供应链来维持'
                ]
            }
        ]
    },
    {
        id: 'mech_rebellion',
        name: '叛乱与危机',
        icon: 'Skull',
        summary: '不满、组织度与联合叛乱机制',
        content: [
            { type: 'h4', text: '⚠️ 叛乱机制' },
            { type: 'p', text: '叛乱不再是随机事件，而是基于“组织度”的确定性危机。' },
            { type: 'h4', text: '1. 叛乱三阶段' },
            {
                type: 'list', items: [
                    '【酝酿阶段】(组织度 > 30%)：阶层内部开始出现流言蜚语。此时尚未有实质威胁，但需警惕。',
                    '【密谋阶段】(组织度 > 70%)：不满分子开始武装集结，推选领袖。必须立即采取行动！',
                    '【爆发阶段】(主动触发)：当组织度极高时，叛乱正式爆发，叛军将分裂国家，成立敌对政权。'
                ]
            },
            { type: 'h4', text: '2. 联合叛乱 (Coalition)' },
            { type: 'p', text: '最危险的时刻：如果多个阶层同时处于高组织度状态，他们会放下成见，通过“人民联合阵线”共同发动叛乱。联合叛军拥有庞大的人口和财富，极难对付。' },
            { type: 'h4', text: '3. 应对策略' },
            { type: 'p', text: '点击左侧“社会阶层”面板，进入详情页使用策略行动：' },
            {
                type: 'list', items: [
                    '安抚：发放补贴或公开表态，消耗银币或稳定度换取时间',
                    '分化：挑拨离间，降低组织度',
                    '镇压：动用军队强行抓捕领袖，高风险但能根除隐患',
                    '改革：最根本的解决之道是满足他们的物资需求'
                ]
            }
        ]
    },
    {
        id: 'mech_events',
        name: '机遇与事件',
        icon: 'Zap',
        summary: '随机事件、抉择与后果',
        content: [
            { type: 'h4', text: '🎲 事件系统' },
            { type: 'p', text: '执政过程中会遇到各种突发状况，你的每一个抉择都在书写历史。' },
            { type: 'h4', text: '1. 事件类型' },
            {
                type: 'list', items: [
                    '外交事件：他国的宣战、结盟请求、贸易勒索等',
                    '叛乱事件：国内阶层的不满暴动',
                    '随机事件：自然灾害（旱灾、瘟疫）、丰收、流民入境等',
                    '庆典事件：每年一次的全国性庆典，提供为期一年的强力Buff'
                ]
            },
            { type: 'h4', text: '2. 抉择与后果' },
            { type: 'p', text: '事件通常提供多个选项，权衡利弊是关键：' },
            {
                type: 'list', items: [
                    '资源置换：花钱消灾，或牺牲名誉换取利益',
                    '概率风险：某些选项（如“强行镇压”）具有成功率，失败会导致更严重的后果',
                    '长远影响：某些决定会永久改变国家属性或外交关系'
                ]
            }
        ]
    },
    {
        id: 'mech_military',
        name: '单位与克制',
        icon: 'Swords',
        summary: '兵种克制、战斗计算与战利品',
        content: [
            { type: 'h4', text: '1. 兵种克制循环' },
            { type: 'p', text: '战场遵循严格的克制关系，利用好这一点可以以少胜多：' },
            {
                type: 'list', items: [
                    '步兵/长矛兵 克制 骑兵 (+60%~100% 伤害) - 长矛阵克制骑兵冲锋',
                    '骑兵 克制 弓箭手/火器 (+50%~90% 伤害) - 快速突袭，近身作战优势',
                    '弓箭手 克制 步兵 (+40%~70% 伤害) - 远程火力压制',
                    '火器 克制 步兵/骑兵 (+40%~80% 伤害) - 火力优势，但近战被骑兵克制',
                    '攻城器械 对建筑有效，但机动性差，被所有近战克制'
                ]
            },
            { type: 'h4', text: '2. 战斗力计算' },
            { type: 'p', text: '总战力 = (单位攻击+防御) × 数量 × 时代加成 × 克制修正。' },
            { type: 'p', text: '此外，社会阶层（如军人、骑士）的满意度会提供全局军事Buff。' },
            { type: 'h4', text: '3. 军队管理' },
            {
                type: 'list', items: [
                    '人口限制：军队人口不能超过总人口的30%',
                    '维护成本：每个单位每秒消耗资源（粮食、黄金等）',
                    '训练时间：高级单位需要更长的训练时间',
                    '时代优势：高时代单位对低时代单位有额外伤害加成'
                ]
            }
        ]
    },
    {
        id: 'mech_military_actions',
        name: '军事行动',
        icon: 'Crosshair',
        summary: '战争手段、战利品与掠夺机制',
        content: [
            { type: 'h4', text: '⚔️ 主动出击' },
            { type: 'p', text: '除了防御，你可以对敌国发起多种类型的军事行动：' },
            { type: 'h4', text: '1. 行动类型' },
            {
                type: 'list', items: [
                    '边境掠夺 (Raid)：低风险。派遣小股部队袭扰，主要抢夺粮食和木材。适合前期积累。',
                    '正面攻势 (Assault)：中风险。寻求与敌军主力决战，削减敌方军力，缴获武器和金属。',
                    '围城压制 (Siege)：高风险高回报。攻陷敌方城市，掠夺国库银币、工业品甚至文化科研成果。',
                    '海上劫掠 (Naval Raid)：针对敌方贸易线，截获香料、咖啡等珍稀贸易品。',
                    '焦土战术 (Scorched Earth)：旨在破坏敌方经济潜力（人口/田地），自身收益低但对敌打击大。'
                ]
            },
            { type: 'h4', text: '2. 战利品机制' },
            {
                type: 'list', items: [
                    '按比例掠夺：敌国越富裕（库存越多），你能抢到的就越多。',
                    '运输能力：我方资源存量（后勤能力）也会影响战利品上限。',
                    '有的放矢：缺粮就去“掠夺”，缺钱就去“围城”，缺香料就去“海盗”。'
                ]
            }
        ]
    },
    {
        id: 'mech_tech',
        name: '科技与时代',
        icon: 'Cpu',
        summary: '时代演进与科技解锁逻辑',
        content: [
            { type: 'h4', text: '1. 时代升级' },
            { type: 'p', text: '时代是文明发展的里程碑。升级时代需要满足三个条件：' },
            {
                type: 'list', items: [
                    '科研点数达标',
                    '人口规模达标',
                    '文化点数达标（封建时代起）',
                    '足够的升级资源（粮食、木材、石料、黄金等）'
                ]
            },
            { type: 'h4', text: '2. 时代加成' },
            { type: 'p', text: '每次升级时代都会获得永久性的全局加成：' },
            {
                type: 'list', items: [
                    '青铜时代：采集效率+15%，军事力量+10%',
                    '古典时代：采集效率+20%，军事力量+15%，文化产出+10%',
                    '封建时代：采集效率+25%，军事力量+20%，文化产出+15%',
                    '探索时代：采集效率+30%，军事力量+25%，文化产出+20%',
                    '启蒙时代：采集效率+35%，军事力量+30%，文化产出+25%',
                    '工业时代：采集效率+40%，军事力量+35%，文化产出+30%',
                    '信息时代：采集效率+50%，军事力量+40%，文化产出+35%'
                ]
            },
            { type: 'h4', text: '3. 解锁新机制' },
            { type: 'p', text: '新时代不仅仅解锁建筑，还会解锁核心机制：' },
            {
                type: 'list', items: [
                    '青铜时代：解锁贸易系统和基础外交。',
                    '古典时代：解锁文化系统和高级政令。',
                    '封建时代：解锁宗教和更复杂的阶层互动。',
                    '工业时代：解锁产业链深度加工（如煤→钢）。'
                ]
            },
            { type: 'h4', text: '4. 科技研究' },
            {
                type: 'list', items: [
                    '科技需要消耗科研点数解锁',
                    '某些科技有前置科技要求',
                    '科技效果包括：解锁建筑、提升效率、增加容量等',
                    '优先研究关键科技可以快速发展'
                ]
            }
        ]
    },
    {
        id: 'mech_diplomacy',
        name: '外交与吞并',
        icon: 'Globe',
        summary: '贸易、结盟、战争与国家吞并',
        content: [
            { type: 'h4', text: '1. 外交关系' },
            {
                type: 'list', items: [
                    '关系值：-100（死敌）到 +100（盟友）',
                    '影响：决定贸易价格优惠程度，以及是否会被主动宣战',
                    '结盟：关系极好时可签订“共同防御条约”，一方受袭，盟友自动参战'
                ]
            },
            { type: 'h4', text: '2. 战争与和平' },
            { type: 'p', text: '战争不再是无休止的消耗，而是通过“战争分数”来结算：' },
            {
                type: 'list', items: [
                    '战争分数：通过赢得战斗、攻占城市获得，最高 +/- 500分',
                    '求和：分数落后时，AI会主动求和并提供赔款',
                    '索取：分数领先时，你可以主动提出和平条款，索要银币、资源或割地'
                ]
            },
            { type: 'h4', text: '3. 国家吞并 (Annexation)' },
            { type: 'p', text: '彻底征服一个国家的终极手段：' },
            {
                type: 'list', items: [
                    '触发条件：当战争分数 > 350 时，可在和平谈判中提出“吞并”',
                    '无条件投降：当战争分数 > 450 时，敌国会绝望投降，任你处置',
                    '吞并效果：获得敌国所有剩余人口、并将你的人口上限直接增加等量数值',
                    '后果：敌国将从地图上永久抹除，并在外交史上留下浓重一笔'
                ]
            },
            { type: 'h4', text: '4. 国家灭亡' },
            { type: 'p', text: '除了被吞并，如果一个国家的人口因战争消耗或饥荒降为0，它也会自动灭亡。残存的流民可能会逃入你的国家。' }
        ]
    },
    {
        id: 'mech_decrees',
        name: '政令系统',
        icon: 'Gavel',
        summary: '国家政策、税收调整与政令效果',
        content: [
            { type: 'h4', text: '1. 政令类型' },
            { type: 'p', text: '政令分为多个类别，每个都有独特的效果：' },
            {
                type: 'list', items: [
                    '经济政令：影响生产、贸易和税收',
                    '军事政令：影响军队招募和战斗力',
                    '文化政令：影响科研和文化产出',
                    '社会政令：影响阶层关系和稳定度'
                ]
            },
            { type: 'h4', text: '2. 政令管理' },
            {
                type: 'list', items: [
                    '可以随时激活或取消政令',
                    '合理选择政令以获得最佳效果'
                ]
            },
            { type: 'h4', text: '3. 政令效果' },
            { type: 'p', text: '政令通常有正面效果和负面代价：' },
            {
                type: 'list', items: [
                    '强制劳动：生产+30%，但农民好感度-20',
                    '自由贸易：贸易收益+25%，但税收-10%',
                    '征兵法：军队招募速度+50%，但人口增长-20%',
                    '公共教育：科研+30%，但维护成本增加',
                    '需要权衡利弊选择合适的政令'
                ]
            },
            { type: 'h4', text: '4. 税收政令' },
            { type: 'p', text: '税收面板可以调整各阶层的税率：' },
            {
                type: 'list', items: [
                    '人头税：对每个人口征收固定税额',
                    '资源税：对市场交易征收百分比税',
                    '可以设置负税率（补贴）提升阶层好感',
                    '过高的税率会导致阶层不满和人口流失',
                    '建议：前期低税率发展，后期适度征税'
                ]
            },
            { type: 'h4', text: '5. 政令策略' },
            {
                type: 'list', items: [
                    '经济流：激活贸易和生产相关政令',
                    '军事流：激活征兵和军事加成政令',
                    '文化流：激活科研和教育政令',
                    '平衡流：少量激活各类政令保持平衡',
                    '根据游戏阶段和目标调整政令组合'
                ]
            }
        ]
    },
    {
        id: 'mech_buildings',
        name: '建筑与生产',
        icon: 'Home',
        summary: '建筑类型、生产链与资源管理',
        content: [
            { type: 'h4', text: '1. 建筑类别' },
            {
                type: 'list', items: [
                    '采集建筑：农田、伐木场、采石场、矿场等，生产基础资源',
                    '工业建筑：锯木厂、砖窑、铁匠铺等，加工原料为成品',
                    '民生建筑：房屋、市场、图书馆等，提供人口和服务',
                    '军事建筑：兵营、马厩、攻城工坊等，训练军队'
                ]
            },
            { type: 'h4', text: '2. 生产机制' },
            {
                type: 'list', items: [
                    '建筑需要岗位才能运作（由对应阶层填补）',
                    '有些建筑需要消耗原料才能生产（如锯木厂需要木材）',
                    '生产效率受时代加成、科技、政令、阶层好感度影响',
                    '建筑可以出售回收部分成本，但会失去岗位'
                ]
            },
            { type: 'h4', text: '3. 资源流转' },
            { type: 'p', text: '理解资源的生产和消耗链条很重要：' },
            {
                type: 'list', items: [
                    '基础资源：粮食、木材、石料（采集建筑生产）',
                    '加工资源：木板、砖块、工具（工业建筑加工）',
                    '高级资源：奢侈品、文化、科研（特殊建筑产出）',
                    '人口消耗：所有人口都需要粮食维持',
                    '阶层需求：不同阶层需要不同的物资（如商人需要香料）'
                ]
            },
            { type: 'h4', text: '4. 建筑策略' },
            {
                type: 'list', items: [
                    '前期：优先建造采集建筑和房屋，确保基础资源和人口',
                    '中期：建造工业建筑形成生产链，提升资源价值',
                    '后期：建造高级建筑产出文化、科研等虚拟资源',
                    '平衡：确保生产和消耗平衡，避免资源短缺或过剩',
                    '升级：随着时代升级，旧建筑效率降低，需要建造新建筑'
                ]
            },
            { type: 'h4', text: '5. 建筑解锁' },
            {
                type: 'list', items: [
                    '建筑按时代解锁，升级时代解锁更多建筑',
                    '某些建筑需要特定科技才能解锁',
                    '高级建筑通常效率更高但成本也更高',
                    '查看建筑详情了解解锁条件'
                ]
            }
        ]
    },
    {
        id: 'mech_festivals',
        name: '年度庆典系统',
        icon: 'PartyPopper',
        summary: '每年一次的庆典选择与效果',
        content: [
            { type: 'h4', text: '1. 庆典触发' },
            {
                type: 'list', items: [
                    '每年（游戏内时间）会触发一次年度庆典',
                    '庆典会暂停游戏，要求你做出选择',
                    '必须选择一个庆典效果才能继续游戏'
                ]
            },
            { type: 'h4', text: '2. 庆典类型' },
            { type: 'p', text: '每次庆典提供3个随机选项，分为两类：' },
            {
                type: 'list', items: [
                    '短期效果：持续1年，数值较高（如科研+50%）',
                    '永久效果：永久生效，数值较低（如科研+10%）',
                    '不同时代有不同的庆典选项'
                ]
            },
            { type: 'h4', text: '3. 庆典效果' },
            { type: 'p', text: '庆典可以提供各种加成：' },
            {
                type: 'list', items: [
                    '资源产出加成：采集、生产、科研、文化等',
                    '军事加成：军事力量、招募速度等',
                    '经济加成：贸易收益、税收等',
                    '社会加成：稳定度、人口增长等'
                ]
            },
            { type: 'h4', text: '4. 选择策略' },
            {
                type: 'list', items: [
                    '前期：选择资源产出加成快速发展',
                    '中期：根据发展方向选择（军事/经济/文化）',
                    '后期：优先选择永久效果累积优势',
                    '短期效果适合应急（如准备战争时选军事加成）',
                    '永久效果适合长期发展（如科研+10%永久）'
                ]
            },
            { type: 'h4', text: '5. 庆典示例' },
            {
                type: 'list', items: [
                    '丰收节：采集效率+30%（1年）',
                    '黄金时代：全面提升20%（1年）',
                    '科学博览会：科研+40%（1年）',
                    '教育改革：科研+12%（永久）',
                    '流水线革命：工业+15%（永久）'
                ]
            }
        ]
    },
    {
        id: 'mech_advanced',
        name: '高级策略与技巧',
        icon: 'Trophy',
        summary: '进阶玩法、优化策略与胜利条件',
        content: [
            { type: 'h4', text: '1. 经济优化' },
            {
                type: 'list', items: [
                    '套利贸易：低价进口资源，高价出口赚取差价',
                    '产业链：建立完整的生产链（如木材→木板→家具）提升价值',
                    '税收平衡：适度征税避免阶层不满，同时保证财政收入',
                    '商人系统：建造贸易站让商人自动交易赚取利润',
                    '市场调控：通过进出口调节国内资源价格'
                ]
            },
            { type: 'h4', text: '2. 军事策略' },
            {
                type: 'list', items: [
                    '克制配置：侦察敌军后针对性招募克制兵种',
                    '时代压制：优先升级时代获得科技优势',
                    '经济支撑：确保有足够的资源维持大规模军队',
                    '混合部队：步兵+弓箭手+骑兵的平衡配置',
                    '压倒性优势：集中优势兵力减少伤亡'
                ]
            },
            { type: 'h4', text: '3. 科技路线' },
            {
                type: 'list', items: [
                    '优先科技：基础工具、车轮、封建制度等关键科技',
                    '建筑解锁：研究解锁重要建筑的科技',
                    '效率提升：研究提升生产效率的科技',
                    '军事科技：准备战争时优先研究军事科技',
                    '平衡发展：不要只研究一类科技'
                ]
            },
            { type: 'h4', text: '4. 阶层管理' },
            {
                type: 'list', items: [
                    '满足需求：优先满足影响力大的阶层需求',
                    '税率调整：对富裕阶层高税率，对贫困阶层低税率或补贴',
                    '职业引导：通过调整工资和需求引导人口转职',
                    '平衡影响力：避免某个阶层影响力过大',
                    '危机处理：阶层不满时及时调整政策'
                ]
            },
            { type: 'h4', text: '5. 胜利策略' },
            { type: 'p', text: '游戏没有明确的胜利条件，但可以追求以下目标：' },
            {
                type: 'list', items: [
                    '经济胜利：积累大量财富，成为贸易强国',
                    '军事胜利：征服所有邻国，建立帝国',
                    '文化胜利：科研和文化产出领先，成为文明灯塔',
                    '时代胜利：最快速度升级到信息时代',
                    '平衡胜利：各方面均衡发展，建立繁荣文明'
                ]
            },
            { type: 'h4', text: '6. 常见陷阱' },
            {
                type: 'list', items: [
                    '资源失衡：某种资源严重短缺影响发展',
                    '忽视军事：没有军队容易被邻国攻击',
                    '过度征税：高税率导致阶层不满和人口流失',
                    '盲目战争：没有经济支撑的战争会拖垮国家'
                ]
            }
        ]
    }
];
const CATEGORY_CONFIG = [
    { id: 'mechanics', label: '核心机制', icon: 'BookOpen' },
    { id: 'economy', label: '社会阶层', icon: 'Users' },
    { id: 'buildings', label: '建筑设施', icon: 'Home' },
    { id: 'military', label: '军事单位', icon: 'Shield' },
    { id: 'technologies', label: '科技研究', icon: 'Cpu' },
    { id: 'decrees', label: '国家政令', icon: 'Gavel' },
    { id: 'events', label: '事件列表', icon: 'Zap' },
    { id: 'resources', label: '物资资源', icon: 'Package' },
];

// 汉化映射表
const BUILDING_CATEGORY_LABELS = {
    gather: '采集与农业',
    industry: '工业生产',
    civic: '民生建筑',
    military: '军事设施',
};

const UNIT_CATEGORY_LABELS = {
    infantry: '步兵',
    archer: '远程',
    cavalry: '骑兵',
    siege: '攻城',
    support: '支援',
};

const TECH_NAME_MAP = (TECHS || []).reduce((acc, tech) => {
    acc[tech.id] = tech.name;
    return acc;
}, {});

const BUILDING_NAME_MAP = (BUILDINGS || []).reduce((acc, building) => {
    acc[building.id] = building.name;
    return acc;
}, {});

const STRATA_NAME_MAP = Object.entries(STRATA || {}).reduce((acc, [key, value]) => {
    acc[key] = value?.name || key;
    return acc;
}, {});

const techNameById = (id) => TECH_NAME_MAP[id] || id;
const buildingNameById = (id) => BUILDING_NAME_MAP[id] || id;
const stratumNameById = (id) => STRATA_NAME_MAP[id] || id;

const WIKI_DATA = buildWikiData();

function buildWikiData() {
    return {
        mechanics: MECHANICS_GUIDES.map(guide => ({
            id: guide.id,
            name: guide.name,
            summary: guide.summary,
            icon: guide.icon,
            iconColor: 'text-blue-300',
            type: 'mechanics',
            data: guide.content
        })),
        economy: Object.entries(STRATA || {}).map(([id, data]) => ({
            id,
            name: data?.name || id,
            summary: data?.desc,
            icon: data?.icon || 'Users',
            iconColor: 'text-amber-200',
            type: 'economy',
            data,
        })),
        buildings: (BUILDINGS || []).map((building) => ({
            id: building.id,
            name: building.name,
            summary: building.desc,
            icon: building.visual?.icon || 'Home',
            iconColor: building.visual?.text || 'text-slate-200',
            type: 'building',
            data: building,
        })),
        military: Object.values(UNIT_TYPES || {}).map((unit) => ({
            id: unit.id,
            name: unit.name,
            summary: unit.desc,
            icon: unit.icon || 'Swords',
            iconColor: 'text-red-200',
            type: 'military',
            data: unit,
        })),
        technologies: (TECHS || []).map((tech) => ({
            id: tech.id,
            name: tech.name,
            summary: tech.desc,
            icon: 'Cpu',
            iconColor: 'text-purple-200',
            type: 'technology',
            data: tech,
        })),
        decrees: (DECREES || []).map((decree) => ({
            id: decree.id,
            name: decree.name,
            summary: decree.desc,
            icon: 'Gavel',
            iconColor: 'text-amber-200',
            type: 'decree',
            data: decree,
        })),
        resources: Object.entries(RESOURCES || {}).map(([id, data]) => ({
            id,
            name: data?.name || id,
            summary: data?.tags?.map(tag => {
                if (tag === 'raw_material') return '原料';
                if (tag === 'manufactured') return '加工品';
                if (tag === 'luxury') return '奢侈品';
                if (tag === 'essential') return '必需品';
                if (tag === 'special') return '特殊';
                if (tag === 'virtual') return '虚拟';
                if (tag === 'currency') return '货币';
                if (tag === 'industrial') return '工业品';
                return tag;
            }).join(' · '),
            icon: data?.icon || 'Package',
            iconColor: data?.color || 'text-slate-200',
            type: 'resource',
            data: { ...data, id },
        })),
        events: [
            ...BASE_EVENTS.map(e => ({
                id: e.id,
                name: e.name,
                summary: e.description,
                icon: e.icon || 'Zap',
                iconColor: 'text-yellow-400',
                type: 'event',
                data: { ...e, type: 'random' },
            })),
            ...EPOCH_EVENTS.map(e => ({
                id: e.id,
                name: e.name,
                summary: e.description,
                icon: 'Clock',
                iconColor: 'text-blue-400',
                type: 'event',
                data: { ...e, type: 'epoch' },
            })),
            ...Object.values(FESTIVAL_EFFECTS).flat().map(e => ({
                id: e.id,
                name: e.name,
                summary: e.description,
                icon: 'PartyPopper',
                iconColor: 'text-purple-400',
                type: 'event',
                data: { ...e, type: 'festival', options: [] },
            })),
            ...(STATIC_DIPLOMATIC_EVENTS || []).map(e => ({
                id: e.id,
                name: e.name,
                summary: e.description,
                icon: e.icon || 'Globe2',
                iconColor: 'text-sky-300',
                type: 'event',
                data: { ...e, type: 'diplomatic' },
            })),
        ],
    };
}

const formatNumber = (value) => {
    if (typeof value !== 'number') return value;
    if (Math.abs(value) >= 100) return value.toFixed(0);
    if (Math.abs(value - Math.round(value)) < 0.001) return Math.round(value).toString();
    return value.toFixed(2);
};

const formatEpoch = (epoch) => {
    if (epoch === undefined || epoch === null || Number.isNaN(epoch)) return undefined;
    const epochName = EPOCHS[epoch]?.name || `第 ${epoch + 1} 时代`;
    return epochName;
};

const getResourceMeta = (key) => RESOURCES?.[key] || { name: key };

const formatEffectNumber = (value, { isPercent } = {}) => {
    if (typeof value !== 'number') return value;
    if (isPercent) {
        const percent = value * 100;
        const sign = percent > 0 ? '+' : percent < 0 ? '' : '';
        return `${sign}${formatNumber(percent)}%`;
    }
    const sign = value > 0 ? '+' : value < 0 ? '' : '';
    return `${sign}${formatNumber(value)}`;
};

const flattenEffects = (source, prefix = '', options = {}) => {
    if (!source) return [];
    if (Array.isArray(source)) return source;
    if (typeof source === 'string') return [source];
    if (typeof source === 'number') {
        return [`${prefix}${prefix ? ': ' : ''}${formatEffectNumber(source, options)}`];
    }

    if (typeof source === 'object') {
        return Object.entries(source).flatMap(([key, value]) => {
            // 汉化效果键名
            let cnKey = key;
            if (key === 'production') cnKey = '全局生产';
            else if (key === 'taxIncome') cnKey = '税收收入';
            else if (key === 'stability') cnKey = '稳定度';
            else if (key === 'scienceBonus' || key === 'science') cnKey = '科研产出';
            else if (key === 'cultureBonus') cnKey = '文化产出';
            else if (key === 'industry') cnKey = '工业效率';
            else if (key === 'gather') cnKey = '采集效率';
            else if (key === 'maxPop') cnKey = '人口上限';
            else if (key === 'resourcePercent') cnKey = '资源储量变化';
            else if (key === 'populationPercent') cnKey = '人口总量变化';
            else if (key === 'approval') cnKey = '阶层好感度';
            else if (key === 'resourceDemandMod') cnKey = '资源需求变化';
            else if (key === 'buildingProductionMod') cnKey = '建筑产出变化';
            else if (key === 'stratumDemandMod') cnKey = '阶层活动度变化';
            else if (key === 'nationRelation') cnKey = '外交关系变化';
            else if (key === 'nationAggression') cnKey = '他国侵略性变化';
            else if (key === 'nationWealth') cnKey = '他国财富变化';
            else if (key === 'nationMarketVolatility') cnKey = '他国市场波动';
            else if (key === 'triggerWar') cnKey = '发动战争';
            else if (key === 'triggerPeace') cnKey = '缔结和平';
            else if (key === 'random') cnKey = '随机国家';
            else if (key === 'all') cnKey = '所有国家';
            else if (key === 'hostile') cnKey = '敌对国家';
            else if (key === 'friendly') cnKey = '友好国家';
            else if (key === 'strongest') cnKey = '最强国家';
            else if (key === 'weakest') cnKey = '最弱国家';

            // 资源、建筑与阶层名称本地化
            if (RESOURCES && RESOURCES[key]) {
                cnKey = getResourceMeta(key).name;
            } else if (BUILDING_NAME_MAP && BUILDING_NAME_MAP[key]) {
                cnKey = buildingNameById(key);
            } else if (STRATA_NAME_MAP && STRATA_NAME_MAP[key]) {
                cnKey = stratumNameById(key);
            }

            // 百分比类效果上下文
            const isPercentContext =
                options.isPercent ||
                key === 'resourcePercent' ||
                key === 'populationPercent' ||
                key === 'resourceDemandMod' ||
                key === 'buildingProductionMod' ||
                key === 'stratumDemandMod' ||
                key === 'nationAggression' ||
                key === 'nationMarketVolatility';

            const childOptions = { ...options, isPercent: isPercentContext };
            const nextPrefix = prefix ? `${prefix} › ${cnKey}` : cnKey;
            if (typeof value === 'object' && !Array.isArray(value)) {
                return flattenEffects(value, nextPrefix, childOptions);
            }
            if (Array.isArray(value)) {
                return value.map((item) => `${nextPrefix}: ${formatEffectNumber(item, childOptions)}`);
            }
            return [`${nextPrefix}: ${formatEffectNumber(value, childOptions)}`];
        });
    }

    return [];
};

const renderResourceSection = (label, resources) => {
    if (!resources || typeof resources !== 'object') return null;
    const entries = Object.entries(resources);
    if (!entries.length) return null;

    return (
        <div className="space-y-2">
            <p className="text-sm text-gray-400">{label}</p>
            <div className="flex flex-wrap gap-2">
                {entries.map(([key, value]) => {
                    const meta = getResourceMeta(key);
                    return (
                        <span
                            key={`${label}-${key}`}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-gray-800/70 text-gray-200 text-xs border border-gray-700"
                        >
                            {meta.icon && <Icon name={meta.icon} size={14} className={meta.color || 'text-gray-200'} />}
                            <span>{meta.name || key}</span>
                            {value !== undefined && <span className="font-mono text-[11px]">{formatNumber(value)}</span>}
                        </span>
                    );
                })}
            </div>
        </div>
    );
};

const renderJobSection = (jobs) => {
    if (!jobs || typeof jobs !== 'object') return null;
    const entries = Object.entries(jobs);
    if (!entries.length) return null;

    return (
        <div className="space-y-2">
            <p className="text-sm text-gray-400">提供岗位</p>
            <div className="flex flex-wrap gap-2">
                {entries.map(([key, value]) => {
                    const stratum = STRATA?.[key];
                    return (
                        <span
                            key={`job-${key}`}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-gray-800/70 text-gray-200 text-xs border border-gray-700"
                        >
                            {stratum?.icon && <Icon name={stratum.icon} size={14} className="text-slate-200" />}
                            <span>{stratum?.name || key}</span>
                            <span className="font-mono text-[11px]">x{formatNumber(value)}</span>
                        </span>
                    );
                })}
            </div>
        </div>
    );
};

const renderListSection = (label, items) => {
    if (!items || !items.length) return null;
    return (
        <div className="space-y-2">
            <p className="text-sm text-gray-400">{label}</p>
            <ul className="list-disc list-inside text-gray-200 text-sm space-y-1">
                {items.map((item, idx) => (
                    <li key={`${label}-${idx}`}>{item}</li>
                ))}
            </ul>
        </div>
    );
};

const InfoGrid = ({ rows }) => {
    if (!rows || !rows.length) return null;
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {rows.map((row) => (
                <div key={row.label} className="bg-gray-800/60 rounded-lg p-3 border border-gray-700">
                    <p className="text-xs text-gray-400">{row.label}</p>
                    <p className="text-sm text-white font-semibold mt-1">{row.value}</p>
                </div>
            ))}
        </div>
    );
};

const StrataBuffs = ({ buffs }) => {
    if (!buffs) return null;
    const entries = Object.entries(buffs);
    if (!entries.length) return null;

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {entries.map(([state, info]) => {
                const { desc, ...rest } = info || {};
                return (
                    <div key={state} className="bg-gray-800/60 border border-gray-700 rounded-lg p-3">
                        <p className="text-xs uppercase tracking-wide text-gray-400">{state === 'satisfied' ? '满意效果' : '不满后果'}</p>
                        <p className="text-sm text-gray-200 mt-1 font-semibold">{desc}</p>
                        {renderListSection('数值影响', flattenEffects(rest))}
                    </div>
                );
            })}
        </div>
    );
};

const ResourceTags = ({ tags }) => {
    if (!tags || !tags.length) return null;
    return (
        <div className="flex flex-wrap gap-2">
            {tags.map((tag) => (
                <span
                    key={tag}
                    className="px-2 py-0.5 text-[11px] uppercase tracking-wide bg-gray-800/70 border border-gray-700 rounded-full text-gray-300"
                >
                    {tag}
                </span>
            ))}
        </div>
    );
};

export const WikiModal = ({ show, onClose }) => {
    const [selectedCategory, setSelectedCategory] = useState(CATEGORY_CONFIG[0].id);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedEntryId, setSelectedEntryId] = useState(null);
    const [showSidebar, setShowSidebar] = useState(true); // 移动端控制侧边栏显示

    useEffect(() => {
        if (!show) return;
        setSelectedEntryId((prev) => prev || (WIKI_DATA[selectedCategory]?.[0]?.id ?? null));
    }, [show, selectedCategory]);
    const entries = useMemo(() => WIKI_DATA[selectedCategory] || [], [selectedCategory]);
    const normalizedSearch = searchTerm.trim().toLowerCase();
    const filteredEntries = useMemo(() => {
        if (!normalizedSearch) return entries;
        return entries.filter((entry) => {
            const haystack = `${entry.name} ${entry.summary || ''}`.toLowerCase();
            return haystack.includes(normalizedSearch);
        });
    }, [entries, normalizedSearch]);

    useEffect(() => {
        if (!filteredEntries.length) {
            setSelectedEntryId(null);
            return;
        }
        if (!filteredEntries.some((entry) => entry.id === selectedEntryId)) {
            setSelectedEntryId(filteredEntries[0].id);
        }
    }, [filteredEntries, selectedEntryId]);

    const selectedEntry =
        filteredEntries.find((entry) => entry.id === selectedEntryId) ||
        entries.find((entry) => entry.id === selectedEntryId) ||
        filteredEntries[0];

    // 选择条目时在移动端自动切换到内容视图
    const handleSelectEntry = (entryId) => {
        setSelectedEntryId(entryId);
        setShowSidebar(false);
    };

    if (!show) return null;

    return (
        <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-0 sm:p-4">
            <div className="bg-gray-900/95 backdrop-blur-lg sm:rounded-2xl border-t sm:border border-indigo-500/40 shadow-2xl w-full max-w-6xl h-full sm:h-[90vh] flex flex-col overflow-hidden">
                {/* 头部 - 移动端紧凑 */}
                <div className="flex items-center justify-between px-3 sm:px-6 py-2 sm:py-4 border-b border-gray-800 bg-gray-900">
                    <div>
                        <p className="text-[10px] sm:text-xs uppercase tracking-widest text-indigo-400 mb-0.5 sm:mb-1">CIVILIZATION KNOWLEDGE BASE</p>
                        <h2 className="text-base font-decorative sm:text-2xl font-bold text-white flex items-center gap-1 sm:gap-2">
                            <Icon name="BookOpen" size={18} className="text-indigo-300 sm:w-6 sm:h-6" />
                            文明百科全书
                        </h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 sm:p-2 rounded-lg border border-gray-700 text-gray-300 hover:text-white hover:border-gray-500 transition-colors"
                        aria-label="关闭百科"
                    >
                        <Icon name="X" size={18} className="sm:w-5 sm:h-5" />
                    </button>
                </div>

                <div className="flex flex-1 overflow-hidden relative">
                    {/* 侧边栏 - 移动端条件显示 */}
                    <aside className={`${showSidebar ? 'flex' : 'hidden'} lg:flex w-full lg:w-72 border-r border-gray-800 bg-gray-900/60 flex-col overflow-y-auto absolute lg:relative inset-0 lg:inset-auto z-10`}>
                        {/* 侧边栏分类按钮 - 移动端紧凑 */}
                        <div className="grid grid-cols-2 gap-1 sm:gap-2 p-2 sm:p-4">
                            {CATEGORY_CONFIG.map((category) => {
                                const isActive = category.id === selectedCategory;
                                return (
                                    <button
                                        key={category.id}
                                        type="button"
                                        onClick={() => setSelectedCategory(category.id)}
                                        className={`flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg border text-[10px] sm:text-xs font-medium transition-colors ${isActive
                                            ? 'border-indigo-400 bg-indigo-900/40 text-indigo-100'
                                            : 'border-gray-700 text-gray-400 hover:text-gray-100 hover:border-gray-500'
                                            }`}
                                    >
                                        <Icon name={category.icon} size={12} className="sm:w-3.5 sm:h-3.5" />
                                        <span className="truncate">{category.label}</span>
                                    </button>
                                );
                            })}
                        </div>

                        {/* 搜索框 - 移动端紧凑 */}
                        <div className="px-2 sm:px-4 pb-2">
                            <div className="relative">
                                <Icon
                                    name="Search"
                                    size={12}
                                    className="text-gray-500 absolute left-2 sm:left-3 top-1/2 -translate-y-1/2 sm:w-3.5 sm:h-3.5"
                                />
                                <input
                                    type="text"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    placeholder={`搜索${CATEGORY_CONFIG.find(c => c.id === selectedCategory)?.label}...`}
                                    className="w-full bg-gray-800/70 border border-gray-700 rounded-lg pl-7 sm:pl-9 pr-2 sm:pr-3 py-1.5 sm:py-2 text-[11px] sm:text-xs text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>
                        </div>

                        {/* 条目列表 - 移动端紧凑 */}
                        <div className="flex-1 overflow-y-auto px-2 sm:px-3 pb-4 space-y-0.5 sm:space-y-1">
                            {filteredEntries.length === 0 ? (
                                <p className="text-[10px] sm:text-xs text-gray-500 px-2 py-3 sm:py-4 text-center border border-dashed border-gray-800 rounded-lg">
                                    暂无符合条件的条目
                                </p>
                            ) : (
                                filteredEntries.map((entry) => {
                                    const isActive = entry.id === selectedEntryId;
                                    return (
                                        <button
                                            key={entry.id}
                                            type="button"
                                            onClick={() => handleSelectEntry(entry.id)}
                                            className={`w-full text-left px-2 sm:px-3 py-1.5 sm:py-2.5 rounded-lg sm:rounded-xl border transition-all ${isActive
                                                ? 'bg-indigo-900/30 border-indigo-500/40 shadow-sm'
                                                : 'bg-transparent border-transparent hover:bg-gray-800/50 hover:border-gray-700'
                                                }`}
                                        >
                                            <p className={`text-xs sm:text-sm font-semibold flex items-center gap-1 sm:gap-2 ${isActive ? 'text-indigo-200' : 'text-gray-300'}`}>
                                                <Icon name={entry.icon || 'Bookmark'} size={12} className={`${isActive ? 'text-indigo-300' : entry.iconColor} sm:w-3.5 sm:h-3.5`} />
                                                <span className="truncate">{entry.name}</span>
                                            </p>
                                            {entry.summary && (
                                                <p className="text-[10px] sm:text-[11px] text-gray-500 mt-0.5 truncate ml-4 sm:ml-6">{entry.summary}</p>
                                            )}
                                        </button>
                                    );
                                })
                            )}
                        </div>
                    </aside>

                    {/* 内容区域 - 移动端全屏 */}
                    <section className={`${showSidebar ? 'hidden' : 'flex'} lg:flex flex-1 flex-col bg-gray-900/30 overflow-hidden`}>
                        {selectedEntry ? (
                            <>
                                {/* 头部 - 移动端紧凑，带返回按钮 */}
                                <div className="p-3 sm:p-6 border-b border-gray-800 bg-gray-800/20">
                                    {/* 移动端返回按钮 */}
                                    <button
                                        onClick={() => setShowSidebar(true)}
                                        className="lg:hidden mb-2 flex items-center gap-1 text-indigo-300 hover:text-white text-xs font-semibold bg-indigo-900/30 hover:bg-indigo-900/60 border border-indigo-500/40 rounded-full px-3 py-1 transition-all"
                                    >
                                        <Icon name="ChevronLeft" size={14} />
                                        <span>返回目录</span>
                                    </button>
                                    <div className="flex items-center gap-2 sm:gap-4">
                                        <div className="p-2 sm:p-3 rounded-lg sm:rounded-2xl bg-gray-800 shadow-lg border border-gray-700">
                                            <Icon name={selectedEntry.icon || 'Book'} size={20} className={`${selectedEntry.iconColor} sm:w-8 sm:h-8`} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[10px] sm:text-xs uppercase tracking-widest text-indigo-400 mb-0.5 sm:mb-1">
                                                {CATEGORY_CONFIG.find((c) => c.id === selectedCategory)?.label}
                                            </p>
                                            <h3 className="text-lg sm:text-3xl font-bold text-white truncate font-decorative">{selectedEntry.name}</h3>
                                            {selectedEntry.summary && (
                                                <p className="text-xs sm:text-sm text-gray-400 mt-0.5 sm:mt-1 line-clamp-2">{selectedEntry.summary}</p>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* 内容 - 移动端紧凑 */}
                                <div className="flex-1 overflow-y-auto p-3 sm:p-8 space-y-4 sm:space-y-8">
                                    {renderEntryDetails(selectedEntry)}
                                </div>
                            </>
                        ) : (
                            <div className="flex-1 flex flex-col items-center justify-center text-gray-500 opacity-50 p-4">
                                <Icon name="BookOpen" size={48} className="mb-3 sm:w-16 sm:h-16 sm:mb-4" />
                                <p className="text-xs sm:text-base text-center">请从左侧选择一个条目查看详情</p>
                            </div>
                        )}
                    </section>
                </div>
            </div>
        </div>
    );
};

const renderEntryDetails = (entry) => {
    const { data, type } = entry;
    if (!data) {
        return <p className="text-gray-400">暂无详情。</p>;
    }

    switch (type) {
        case 'mechanics':
            return renderMechanicsDetails(data);
        case 'economy':
            return renderEconomyDetails(data);
        case 'building':
            return renderBuildingDetails(data);
        case 'military':
            return renderMilitaryDetails(data);
        case 'technology':
            return renderTechDetails(data);
        case 'decree':
            return renderDecreeDetails(data);
        case 'resource':
            return renderResourceDetails(data);
        case 'event':
            return renderEventDetails(data);
        default:
            return (
                <div className="space-y-4">
                    <p className="text-gray-300">{entry.summary || '暂无描述。'}</p>
                </div>
            );
    }
};

const renderMechanicsDetails = (content) => {
    if (!Array.isArray(content)) return null;

    return (
        <div className="space-y-3 sm:space-y-6 max-w-3xl">
            {content.map((block, idx) => {
                if (block.type === 'h4') {
                    return <h4 key={idx} className="text-sm sm:text-lg font-bold text-indigo-300 mt-3 sm:mt-6 mb-1 sm:mb-2 pb-1 sm:pb-2 border-b border-gray-700 font-decorative">{block.text}</h4>;
                }
                if (block.type === 'p') {
                    return <p key={idx} className="text-gray-300 leading-5 sm:leading-7 text-xs sm:text-sm">{block.text}</p>;
                }
                if (block.type === 'list') {
                    return (
                        <ul key={idx} className="list-disc list-inside space-y-1 sm:space-y-2 bg-gray-800/40 p-2 sm:p-4 rounded-lg border border-gray-700/50">
                            {block.items.map((item, i) => (
                                <li key={i} className="text-gray-300 text-xs sm:text-sm leading-tight sm:leading-normal">{item}</li>
                            ))}
                        </ul>
                    );
                }
                return null;
            })}
        </div>
    );
};

const renderEconomyDetails = (data) => {
    const rows = [
        data.weight !== undefined && { label: '分配权重', value: formatNumber(data.weight) },
        data.tax !== undefined && { label: '税收贡献 (每人)', value: formatNumber(data.tax) },
        data.headTaxBase !== undefined && { label: '人头税基准', value: `${formatNumber(data.headTaxBase)} 银币/日` },
        data.wealthWeight !== undefined && { label: '财富系数', value: formatNumber(data.wealthWeight) },
        data.influenceBase !== undefined && { label: '基础影响力', value: formatNumber(data.influenceBase) },
        data.startingWealth !== undefined && { label: '初始财富', value: `${formatNumber(data.startingWealth)} 银币` },
        data.defaultResource && { label: '生产资源', value: getResourceMeta(data.defaultResource).name },
    ].filter(Boolean);

    return (
        <div className="space-y-3 sm:space-y-6">
            <div className="bg-gray-800/40 p-2 sm:p-4 rounded-lg sm:rounded-xl border border-gray-700/50">
                <p className="text-gray-300 leading-relaxed text-xs sm:text-sm">{data.desc}</p>
            </div>
            <InfoGrid rows={rows} />
            {renderResourceSection('日常物资需求', data.needs)}
            <StrataBuffs buffs={data.buffs} />
        </div>
    );
};

const renderBuildingDetails = (data) => {
    const rows = [
        data.cat && { label: '建筑类别', value: BUILDING_CATEGORY_LABELS[data.cat] || data.cat },
        data.owner && { label: '运营阶层', value: stratumNameById(data.owner) },
        (data.epoch !== undefined || data.unlockEpoch !== undefined) && {
            label: '解锁时代',
            value: formatEpoch(data.epoch ?? data.unlockEpoch),
        },
        data.requiresTech && { label: '前置科技', value: techNameById(data.requiresTech) },
    ].filter(Boolean);

    return (
        <div className="space-y-6">
            <div className="bg-gray-800/40 p-4 rounded-xl border border-gray-700/50">
                <p className="text-gray-300 leading-relaxed text-sm">{data.desc}</p>
            </div>
            <InfoGrid rows={rows} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {renderResourceSection('建造成本', data.baseCost)}
                {renderResourceSection('产出资源', data.output)}
                {renderResourceSection('消耗原料', data.input)}
                {renderJobSection(data.jobs)}
            </div>
        </div>
    );
};

const renderMilitaryDetails = (data) => {
    const rows = [
        data.category && { label: '兵种类别', value: UNIT_CATEGORY_LABELS[data.category] || data.category },
        data.epoch !== undefined && { label: '解锁时代', value: formatEpoch(data.epoch) },
        data.populationCost !== undefined && { label: '人口占用', value: formatNumber(data.populationCost) },
        data.trainingTime !== undefined && { label: '训练时间 (秒)', value: formatNumber(data.trainingTime) },
        data.attack !== undefined && { label: '攻击力', value: formatNumber(data.attack) },
        data.defense !== undefined && { label: '防御力', value: formatNumber(data.defense) },
        data.range !== undefined && { label: '射程', value: formatNumber(data.range) },
    ].filter(Boolean);

    return (
        <div className="space-y-6">
            <div className="bg-gray-800/40 p-4 rounded-xl border border-gray-700/50">
                <p className="text-gray-300 leading-relaxed text-sm">{data.desc}</p>
            </div>
            <InfoGrid rows={rows} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {renderResourceSection('征召成本', data.recruitCost)}
                {renderResourceSection('每日维护', data.maintenanceCost)}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {renderListSection('特殊能力', data.abilities)}
                {renderListSection('克制对象', flattenEffects(data.counters).map(s => s.replace('infantry', '步兵').replace('cavalry', '骑兵').replace('archer', '远程').replace('siege', '攻城')))}
            </div>
        </div>
    );
};

const renderTechDetails = (data) => {
    const rows = [
        data.epoch !== undefined && { label: '所属时代', value: formatEpoch(data.epoch) },
    ].filter(Boolean);

    return (
        <div className="space-y-6">
            <div className="bg-gray-800/40 p-4 rounded-xl border border-gray-700/50">
                <p className="text-gray-300 leading-relaxed text-sm">{data.desc}</p>
            </div>
            <InfoGrid rows={rows} />
            {renderResourceSection('科研成本', data.cost)}
            {renderListSection('科技效果', flattenEffects(data.effects))}
        </div>
    );
};

const renderDecreeDetails = (data) => {
    const rows = [
        data.category && { label: '政令类别', value: data.category === 'economy' ? '经济' : data.category === 'military' ? '军事' : data.category === 'culture' ? '文化' : '社会' },
        data.unlockEpoch !== undefined && { label: '解锁时代', value: formatEpoch(data.unlockEpoch) },
    ].filter(Boolean);

    return (
        <div className="space-y-6">
            <div className="bg-gray-800/40 p-4 rounded-xl border border-gray-700/50">
                <p className="text-gray-300 leading-relaxed text-sm">{data.desc}</p>
            </div>
            <InfoGrid rows={rows} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-4 bg-green-900/20 border border-green-800/30 rounded-lg">
                    {renderListSection('正面效果', data.effects)}
                </div>
                <div className="p-4 bg-red-900/20 border border-red-800/30 rounded-lg">
                    {renderListSection('负面代价', data.drawbacks)}
                </div>
            </div>
        </div>
    );
};

const renderResourceDetails = (data) => {
    const rows = [
        data.basePrice !== undefined && { label: '基础价格', value: `${formatNumber(data.basePrice)} 银币` },
        data.type && { label: '资源类型', value: data.type === 'currency' ? '货币' : data.type === 'virtual' ? '概念' : '实物' },
        data.unlockEpoch !== undefined && { label: '解锁时代', value: formatEpoch(data.unlockEpoch) },
        data.unlockTech && { label: '解锁科技', value: techNameById(data.unlockTech) },
        data.defaultOwner && { label: '主要生产者', value: stratumNameById(data.defaultOwner) },
    ].filter(Boolean);

    return (
        <div className="space-y-6">
            <div className="bg-gray-800/40 p-4 rounded-xl border border-gray-700/50">
                <p className="text-gray-300 leading-relaxed text-sm">{data.desc || '基础资源信息'}</p>
            </div>
            <InfoGrid rows={rows} />
            <ResourceTags tags={data.tags} />
        </div>
    );

};

// 事件触发条件描述
const buildTriggerConditionLines = (conditions) => {
    if (!conditions) return [];

    const lines = [];
    const {
        minEpoch,
        maxEpoch,
        minPopulation,
        maxPopulation,
        minScience,
        minStability,
        maxStability,
        classConditions,
    } = conditions;

    // 时代条件
    if (minEpoch !== undefined || maxEpoch !== undefined) {
        if (minEpoch !== undefined && maxEpoch !== undefined) {
            lines.push(`时代范围：${formatEpoch(minEpoch)} 至 ${formatEpoch(maxEpoch)}`);
        } else if (minEpoch !== undefined) {
            lines.push(`最低时代：${formatEpoch(minEpoch)}`);
        } else if (maxEpoch !== undefined) {
            lines.push(`最高时代：${formatEpoch(maxEpoch)}`);
        }
    }

    // 总人口条件
    if (minPopulation !== undefined || maxPopulation !== undefined) {
        const parts = [];
        if (minPopulation !== undefined) parts.push(`≥ ${minPopulation}`);
        if (maxPopulation !== undefined) parts.push(`≤ ${maxPopulation}`);
        lines.push(`总人口：${parts.join('，')}`);
    }

    // 稳定度条件
    if (minStability !== undefined || maxStability !== undefined) {
        const parts = [];
        if (minStability !== undefined) parts.push(`≥ ${minStability}`);
        if (maxStability !== undefined) parts.push(`≤ ${maxStability}`);
        lines.push(`稳定度：${parts.join('，')}`);
    }

    // 科技条件
    if (minScience !== undefined) {
        lines.push(`科研储备：≥ ${formatNumber(minScience)}`);
    }

    // 阶层相关条件
    if (classConditions && typeof classConditions === 'object') {
        Object.entries(classConditions).forEach(([stratumId, cond]) => {
            if (!cond) return;
            const parts = [];

            // 人口
            if (cond.minPop !== undefined || cond.maxPop !== undefined) {
                if (cond.minPop !== undefined && cond.maxPop !== undefined) {
                    parts.push(`人口在 ${cond.minPop}–${cond.maxPop} 之间`);
                } else if (cond.minPop !== undefined) {
                    parts.push(`人口≥${cond.minPop}`);
                } else if (cond.maxPop !== undefined) {
                    parts.push(`人口≤${cond.maxPop}`);
                }
            }

            // 好感度
            if (cond.minApproval !== undefined || cond.maxApproval !== undefined) {
                if (cond.minApproval !== undefined && cond.maxApproval !== undefined) {
                    parts.push(`好感度在 ${cond.minApproval}–${cond.maxApproval} 之间`);
                } else if (cond.minApproval !== undefined) {
                    parts.push(`好感度≥${cond.minApproval}`);
                } else if (cond.maxApproval !== undefined) {
                    parts.push(`好感度≤${cond.maxApproval}`);
                }
            }

            // 影响力占比
            if (cond.minInfluenceShare !== undefined || cond.maxInfluenceShare !== undefined) {
                const minShare = cond.minInfluenceShare !== undefined ? `${formatNumber(cond.minInfluenceShare * 100)}%` : null;
                const maxShare = cond.maxInfluenceShare !== undefined ? `${formatNumber(cond.maxInfluenceShare * 100)}%` : null;
                if (minShare && maxShare) {
                    parts.push(`影响力占比在 ${minShare}–${maxShare} 之间`);
                } else if (minShare) {
                    parts.push(`影响力占比≥${minShare}`);
                } else if (maxShare) {
                    parts.push(`影响力占比≤${maxShare}`);
                }
            }

            // 财富相关
            if (cond.minWealth !== undefined || cond.maxWealth !== undefined) {
                if (cond.minWealth !== undefined && cond.maxWealth !== undefined) {
                    parts.push(`人均财富在 ${formatNumber(cond.minWealth)}–${formatNumber(cond.maxWealth)} 之间`);
                } else if (cond.minWealth !== undefined) {
                    parts.push(`人均财富≥${formatNumber(cond.minWealth)}`);
                } else if (cond.maxWealth !== undefined) {
                    parts.push(`人均财富≤${formatNumber(cond.maxWealth)}`);
                }
            }

            if (cond.minWealthShare !== undefined || cond.maxWealthShare !== undefined) {
                const minShare = cond.minWealthShare !== undefined ? `${formatNumber(cond.minWealthShare * 100)}%` : null;
                const maxShare = cond.maxWealthShare !== undefined ? `${formatNumber(cond.maxWealthShare * 100)}%` : null;
                if (minShare && maxShare) {
                    parts.push(`财富占比在 ${minShare}–${maxShare} 之间`);
                } else if (minShare) {
                    parts.push(`财富占比≥${minShare}`);
                } else if (maxShare) {
                    parts.push(`财富占比≤${maxShare}`);
                }
            }

            if (cond.minWealthDelta !== undefined || cond.maxWealthDelta !== undefined) {
                if (cond.minWealthDelta !== undefined && cond.maxWealthDelta !== undefined) {
                    parts.push(`近期财富变动在 ${formatNumber(cond.minWealthDelta)}–${formatNumber(cond.maxWealthDelta)} 之间`);
                } else if (cond.minWealthDelta !== undefined) {
                    parts.push(`近期财富变动≥${formatNumber(cond.minWealthDelta)}`);
                } else if (cond.maxWealthDelta !== undefined) {
                    parts.push(`近期财富变动≤${formatNumber(cond.maxWealthDelta)}`);
                }
            }

            if (cond.minIncome !== undefined || cond.maxIncome !== undefined) {
                if (cond.minIncome !== undefined && cond.maxIncome !== undefined) {
                    parts.push(`人均收入在 ${formatNumber(cond.minIncome)}–${formatNumber(cond.maxIncome)} 之间`);
                } else if (cond.minIncome !== undefined) {
                    parts.push(`人均收入≥${formatNumber(cond.minIncome)}`);
                } else if (cond.maxIncome !== undefined) {
                    parts.push(`人均收入≤${formatNumber(cond.maxIncome)}`);
                }
            }

            if (parts.length) {
                lines.push(`${stratumNameById(stratumId)}：${parts.join('，')}`);
            }
        });
    }

    return lines;
};

// --- 事件显示逻辑 ---
const renderEventDetails = (data) => {
    // 渲染选项详情
    const renderOption = (option) => (
        <div
            key={option.id}
            className="bg-gray-800/60 p-3 rounded-lg border border-gray-700/50 mb-3 last:mb-0 hover:border-amber-400/60 hover:bg-gray-800/80 transition-colors"
        >
            <div className="flex justify-between items-start mb-2">
                <span className="text-amber-300 font-semibold text-sm">{option.text}</span>
            </div>
            <p className="text-xs text-gray-400 mb-2 leading-relaxed">{option.description}</p>

            {/* 效果预览 */}
            {(option.effects || option.randomEffects) && (
                <div className="mt-2 space-y-2 text-xs">
                    {option.effects && (
                        <div className="bg-gray-900/60 p-2 rounded-lg border border-emerald-700/40">
                            <div className="flex items-center mb-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400/70 mr-2" />
                                <span className="text-emerald-200 font-medium">固定效果</span>
                            </div>
                            <div className="space-y-0.5">
                                {flattenEffects(option.effects).map((eff, i) => (
                                    <div
                                        key={i}
                                        className="flex items-start gap-2 text-gray-200"
                                    >
                                        <span className="mt-1 w-1 h-1 rounded-full bg-emerald-300/70" />
                                        <span className="leading-snug">{eff}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    {option.randomEffects &&
                        option.randomEffects.map((rand, i) => (
                            <div
                                key={i}
                                className="bg-gray-900/60 p-2 rounded-lg border border-dashed border-purple-700/60"
                            >
                                <div className="flex items-center justify-between mb-1">
                                    <span className="text-purple-300 text-[11px] font-medium flex items-center gap-1">
                                        <span>🎲 随机分支</span>
                                        <span className="px-1.5 py-0.5 rounded-full bg-purple-900/60 border border-purple-500/50 text-[10px] text-purple-100">
                                            {Math.round(rand.chance * 100)}%
                                        </span>
                                    </span>
                                </div>
                                {rand.description && (
                                    <div className="text-gray-400 text-[10px] mb-1 italic leading-snug">
                                        "{rand.description}"
                                    </div>
                                )}
                                <div className="space-y-0.5">
                                    {flattenEffects(rand.effects).map((eff, j) => (
                                        <div
                                            key={j}
                                            className="flex items-start gap-2 text-gray-200"
                                        >
                                            <span className="mt-1 w-1 h-1 rounded-full bg-purple-300/80" />
                                            <span className="leading-snug">{eff}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                </div>
            )}
        </div>
    );

    const rows = [
        data.type && {
            label: '事件类型',
            value:
                data.type === 'festival'
                    ? '年度庆典'
                    : data.type === 'epoch'
                        ? '时代事件'
                        : data.type === 'diplomatic'
                            ? '外交事件'
                            : '随机事件',
        },
        data.duration && { label: '持续时间', value: `${data.duration} 天` },
    ].filter(Boolean);

    const triggerLines = buildTriggerConditionLines(data.triggerConditions);

    return (
        <div className="space-y-6">
            <div className="bg-gray-800/40 p-4 rounded-xl border border-gray-700/50">
                <p className="text-gray-300 leading-relaxed text-sm italic">"{data.description}"</p>
                {data.flavorText && <p className="text-gray-500 text-xs mt-2 text-right">—— {data.flavorText}</p>}
            </div>

            <InfoGrid rows={rows} />

            {triggerLines.length > 0 && (
                <div>
                    <h4 className="text-sm font-medium text-gray-400 mb-2 border-l-4 border-indigo-500/50 pl-3">触发条件</h4>
                    <div className="bg-gray-800/60 p-3 rounded-lg border border-gray-700/50">
                        {triggerLines.map((line, idx) => (
                            <div key={idx} className="text-gray-300 mb-1 flex items-center text-xs">
                                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400/70 mr-2"></span>
                                <span>{line}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {data.options && data.options.length > 0 ? (
                <div>
                    <h4 className="text-sm font-medium text-gray-400 mb-3 border-l-4 border-amber-500/50 pl-3">抉择选项</h4>
                    <div className="grid grid-cols-1 gap-1">
                        {data.options.map(renderOption)}
                    </div>
                </div>
            ) : data.effects ? (
                <div>
                    <h4 className="text-sm font-medium text-gray-400 mb-3 border-l-4 border-green-500/50 pl-3">生效效果</h4>
                    <div className="bg-gray-800/60 p-3 rounded-lg border border-gray-700/50">
                        {flattenEffects(data.effects).map((eff, i) => (
                            <div key={i} className="text-gray-300 mb-1 flex items-center">
                                <span className="w-1.5 h-1.5 rounded-full bg-green-500/50 mr-2"></span>
                                {eff}
                            </div>
                        ))}
                    </div>
                </div>
            ) : null}
        </div>
    );
};
