// 游戏更新日志模态框
import React, { useState } from 'react';
import { Icon } from '../common/UIComponents';

/**
 * 更新日志条目配置
 * 每次更新后在此数组头部添加新版本记录
 */
export const CHANGELOG = [
    {
        version: '2.1.0',
        date: '2026-03-17',
        isLatest: true,
        highlights: ['修复军团士兵不计入阶层人口的问题', '修复市场恶性清空资源 bug', '军团卡片新增可展开详情面板', '组织度面板重做', '各难度满意度阈值调整', '税收通过弹性机制自然抑制各阶层需求意愿量'],
        changes: [
            { type: 'fix', text: '修复编入军团的士兵不计入 soldier 阶层岗位需求的问题：军团内单位现在会与散兵一同参与 soldier 岗位计算，确保军人阶层人口数量、满意度、军饷转账等下游数值正确反映实际兵力' },
            { type: 'fix', text: '修复市场商人自动贸易逻辑导致的恶性清空资源 bug：移除了建筑循环内商人以自有资金强制进行以物易物的逻辑，避免市场库存被异常抽空' },
            { type: 'fix', text: '修复外交面板商人状态变更回调参数格式错误，避免商人分配数据被意外覆盖' },
            { type: 'new', text: '战线面板军团卡片新增可展开详情面板：点击军团卡片可展开查看兵种配置（按类别分组）、将领特质与加成、战斗力分项（攻击/防御/士气/将领修正）、日均军需银币折算' },
            { type: 'improve', text: '组织度面板 UI 重做：新增趋势指示（上升/下降/稳定）、组织度变化因素分析（好感度阈值对比、物资短缺驱动）、50% 上限锁定提示，视觉风格统一为古典主题' },
            { type: 'balance', text: '各难度满意度阈值下调：和平 30→25、简单 40→35、普通 50→45、困难 70→60、灾厄 85→75、地狱 90→85，降低阈值使组织度更容易衰减，减少"好感度已高但组织度不降"的体验' },
            { type: 'balance', text: '组织度衰减死区从 +5 缩小到 +3：满意度超过阈值 3 点即开始衰减（原为 5 点），减少安全区宽度，提升组织度响应灵敏度' },
            { type: 'improve', text: '税收需求弹性抑制：交易税现在会通过弹性机制自然压低各阶层对资源的需求意愿量，而非仅靠"买不起"硬截断。抑制强度综合考虑三个维度：资源需求弹性（必需品如粮食几乎不受影响，奢侈品如香料、珍馐受影响显著）、阶层人均存款充裕度（存款越充裕对税收越不敏感，富人不在乎税）、是否为奢侈性需求（luxuryNeeds 中的需求额外放大 1.5 倍敏感度）。综合抑制率上限 50%，与原有 affordable 硬截断协同工作' },
        ],
    },
    {
        version: '2.0.10',
        date: '2026-03-17',
        isLatest: false,
        highlights: ['新增年度报告历史弹窗', '信息时代视觉主题', '政体效果大幅扩展', 'Tick 预算管理与性能优化', '游戏循环重构'],
        changes: [
            { type: 'new', text: '新增年度报告历史弹窗（AnnualReportHistoryModal），支持查看历史年度报告，涵盖经济、人口、军事等多维度数据对比' },
            { type: 'new', text: '新增信息时代（epoch 8）完整视觉主题：配色方案、粒子效果与时代背景图片渲染' },
            { type: 'new', text: '政体效果大幅扩展：新增商业帝国、神权封建王国、科技联盟等多种政体配置，覆盖更多时代与政治路线' },
            { type: 'improve', text: 'Tick 预算管理：新增单帧时间预算机制（150ms 上限），防止模拟计算超时导致界面卡顿' },
            { type: 'improve', text: '节流状态分层优化：背景/装饰元素降低刷新频率，减少不必要的 React 重渲染' },
            { type: 'improve', text: 'Worker 通信优化：主线程与模拟 Worker 间消息传递重构，降低序列化开销' },
            { type: 'improve', text: '游戏循环重构：精简 useGameLoop 主循环逻辑，减少冗余状态同步' },
            { type: 'improve', text: '内阁协同效果优化：调整协同加成逻辑，提升内阁组合的策略深度' },
            { type: 'fix', text: '修复理念涌现系统中涌现条件判断的边界问题，确保理念在正确时机触发' },
            { type: 'fix', text: '修复建筑面板在特定筛选条件下的显示异常' },
            { type: 'balance', text: '进一步微调各难度下的库存目标与经济波动参数，强化难度梯度差异' },
        ],
    },
    {
        version: '2.0.9',
        date: '2026-03-16',
        isLatest: false,
        highlights: ['修复敌方停战提议接受流程', '放缓 AI 时代推进速度', '重做难度库存缓冲与价格波动', '修正营业税补贴导致的负成本价'],
        changes: [
            { type: 'fix', text: '修复接受敌方停战提议时流程未统一走战争结束逻辑的问题，避免停战状态与外交后续处理不一致' },
            { type: 'fix', text: '修复营业税为负值（补贴）时可能出现负成本价的问题，成本价现在保底为 0，避免价格模型被异常拉偏' },
            { type: 'fix', text: '清理雇员工资冷启动推导代码中的注释串行问题，避免影响后续维护与阅读' },
            { type: 'balance', text: '大幅放缓 AI 时代推进：提高各时代科技/文化需求系数，时代升级冷却由 200 提升至 600，科技文化累积速率下调至 0.4' },
            { type: 'balance', text: '重做各难度库存目标倍率：和平/简单模式增加库存缓冲提升稳定性，困难/灾厄/地狱模式降低缓冲以增强价格波动与经营压力' },
            { type: 'improve', text: '建筑利润计算改为统一通过税务模块读取营业税倍率，确保税率被正确限制在合法范围内' },
            { type: 'improve', text: '敌方停战事件按钮文案优化为“婉拒停战”，提升交互语义清晰度' },
        ],
    },
    {
        version: '2.0.8',
        date: '2026-03-16',
        isLatest: false,
        highlights: ['新增建筑/国家收藏置顶功能', '修复外交赠礼费用显示错误', '修复成衣作坊时代配置', '新增港口建筑', '平衡调整'],
        changes: [
            { type: 'new', text: '新增建筑收藏功能：建筑卡片左上角悬停出现 ⭐ 按钮，可收藏常用建筑；建筑面板新增"⭐ 收藏"过滤器，收藏数据持久保存' },
            { type: 'new', text: '新增国家收藏功能：外交国家卡片右上角悬停出现 ⭐ 按钮，可收藏常用国家；国家列表新增"⭐ 收藏"过滤器，收藏的国家自动置顶' },
            { type: 'new', text: '新增港口（harbor）建筑：epoch 1，需要航海术科技，消耗木板产出银币，填补航海术的实际解锁目标' },
            { type: 'fix', text: '修复外交赠礼费用显示与实际花费不一致的问题（UI 显示固定 100 但实际花费更高）' },
            { type: 'fix', text: '修复成衣作坊时代配置错误：从 epoch 1 调整为 epoch 2，前置科技改为高级纺织，与华服解锁时代对齐' },
            { type: 'fix', text: '修正航海术科技描述：解锁港口（而非船坞）；修正海图绘制描述：明确解锁船坞' },
            { type: 'balance', text: '小幅提升教堂基础产出：文化 3.2 → 4.0（+25%），银币 0.67 → 0.8（+20%），强化文化+财政双产出定位' },
            { type: 'balance', text: '大幅降低各理念 taxIncome 数值（约 -50%）：修复后期 income_ideology_virtual_tax 异常偏高的问题' },
            { type: 'balance', text: '同步降低各时代 taxIncome 加成：封建 0.20→0.10，探索 0.50→0.25，电气 0.30→0.15，原子 0.35→0.18，信息 0.40→0.20' },
        ],
    },
    {
        version: '2.0.6',
        date: '2026-03-15',
        isLatest: false,
        highlights: ['更新日志功能上线', '修复密谋事件反复弹出的问题', '修复同一官员反复出现的问题'],
        changes: [
            { type: 'fix', text: '修复密谋/起义事件在玩家未处理时反复弹出的问题（现在有未处理事件时不会触发新的组织度事件）' },
            { type: 'fix', text: '修复同一官员候选人反复出现的问题' },
            { type: 'fix', text: '事件弹出时游戏现在会自动暂停' },
            { type: 'new', text: '新增更新日志功能，方便玩家了解游戏更新内容' },
            { type: 'remove', text: '移除存档的"导出到剪贴板"和"从剪贴板导入"功能（已由文件导入导出替代）' },
        ],
    },
    {
        version: '2.0.5',
        date: '2026-03-15',
        highlights: ['外交系统优化', '理念系统平衡调整'],
        changes: [
            { type: 'new', text: '外交谈判新增更多条约类型' },
            { type: 'balance', text: '调整多项理念数值，修复升级收益倒挂问题' },
            { type: 'fix', text: '修复贸易路线税收计算错误' },
            { type: 'fix', text: '修复官员忠诚度在某些情况下不正确衰减的问题' },
        ],
    },
    {
        version: '2.0.4',
        date: '2026-03-14',
        highlights: ['军团系统上线', '战线管理优化'],
        changes: [
            { type: 'new', text: '新增军团编组系统，支持多军团同时作战' },
            { type: 'new', text: '新增战线管理界面，可为不同战线分配军团' },
            { type: 'new', text: '新增将领系统，将领可为军团提供战斗加成' },
            { type: 'balance', text: '调整军队维护成本计算，加入规模惩罚机制' },
            { type: 'fix', text: '修复战斗结算时部分单位数量计算错误' },
        ],
    },
];

// 变更类型配置
const CHANGE_TYPE_CONFIG = {
    new: { label: '新增', color: 'text-emerald-300', bg: 'bg-emerald-900/30 border-emerald-500/30' },
    fix: { label: '修复', color: 'text-blue-300', bg: 'bg-blue-900/30 border-blue-500/30' },
    balance: { label: '平衡', color: 'text-amber-300', bg: 'bg-amber-900/30 border-amber-500/30' },
    remove: { label: '移除', color: 'text-red-300', bg: 'bg-red-900/30 border-red-500/30' },
    improve: { label: '优化', color: 'text-purple-300', bg: 'bg-purple-900/30 border-purple-500/30' },
};

/**
 * 单个版本条目组件
 */
const VersionEntry = ({ entry, defaultOpen = false }) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);

    return (
        <div className={`rounded-lg border overflow-hidden ${entry.isLatest ? 'border-ancient-gold/40' : 'border-gray-700/50'}`}>
            {/* 版本头部 */}
            <button
                type="button"
                onClick={() => setIsOpen(prev => !prev)}
                className={`w-full flex items-center justify-between px-3 py-2.5 text-left transition-colors ${
                    entry.isLatest
                        ? 'bg-ancient-gold/10 hover:bg-ancient-gold/15'
                        : 'bg-gray-800/50 hover:bg-gray-800/70'
                }`}
            >
                <div className="flex items-center gap-2">
                    {entry.isLatest && (
                        <span className="px-1.5 py-0.5 rounded text-xs font-bold bg-ancient-gold/20 text-ancient-gold border border-ancient-gold/30">
                            最新
                        </span>
                    )}
                    <span className={`text-sm font-bold ${entry.isLatest ? 'text-ancient-gold' : 'text-gray-200'}`}>
                        v{entry.version}
                    </span>
                    <span className="text-xs text-gray-500">{entry.date}</span>
                </div>
                <Icon
                    name="ChevronDown"
                    size={14}
                    className={`text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                />
            </button>

            {/* 版本内容 */}
            {isOpen && (
                <div className="px-3 py-2 space-y-2 bg-gray-900/40">
                    {/* 亮点摘要 */}
                    {entry.highlights?.length > 0 && (
                        <p className="text-xs text-gray-400 leading-relaxed">
                            {entry.highlights.join(' · ')}
                        </p>
                    )}
                    {/* 详细变更列表 */}
                    <div className="space-y-1.5">
                        {entry.changes.map((change, idx) => {
                            const typeConfig = CHANGE_TYPE_CONFIG[change.type] || CHANGE_TYPE_CONFIG.new;
                            return (
                                <div key={idx} className="flex items-start gap-2">
                                    <span className={`flex-shrink-0 mt-0.5 px-1.5 py-0.5 rounded text-xs font-bold border ${typeConfig.bg} ${typeConfig.color}`}>
                                        {typeConfig.label}
                                    </span>
                                    <span className="text-xs text-gray-300 leading-relaxed">{change.text}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};

/**
 * 更新日志模态框
 */
export const ChangelogModal = ({ isOpen, onClose }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* 背景遮罩 */}
            <div
                className="absolute inset-0 bg-black/70 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* 模态框内容 */}
            <div className="relative w-full max-w-md bg-gray-900/95 border border-gray-700 rounded-xl shadow-2xl animate-slide-up flex flex-col max-h-[80vh]">
                {/* 头部 */}
                <div className="flex items-center justify-between p-3 border-b border-gray-700 flex-shrink-0">
                    <h3 className="text-base font-bold text-gray-100 flex items-center gap-2">
                        <Icon name="ScrollText" size={18} className="text-ancient-gold" />
                        更新日志
                    </h3>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-full bg-gray-800 hover:bg-gray-700 border border-gray-600 text-gray-300 transition-colors"
                    >
                        <Icon name="X" size={14} />
                    </button>
                </div>

                {/* 版本列表 */}
                <div className="overflow-y-auto p-3 space-y-2 flex-1">
                    {CHANGELOG.map((entry, idx) => (
                        <VersionEntry
                            key={entry.version}
                            entry={entry}
                            defaultOpen={idx === 0}
                        />
                    ))}
                </div>

                {/* 底部 */}
                <div className="p-3 border-t border-gray-700 flex-shrink-0">
                    <p className="text-xs text-gray-500 text-center">
                        QQ群546526159，游戏持续更新中 🎮
                    </p>
                </div>
            </div>
        </div>
    );
};
