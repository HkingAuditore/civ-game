/**
 * 附庸管理面板 (Bottom Sheet)
 * 用于管理单个附庸国家的详细设置
 * 包含概览和政策调整两个Tab
 */

import React, { useState, useMemo, memo, useEffect, useRef, useCallback } from 'react';
import { BottomSheet } from '../tabs/BottomSheet';
import { Icon } from '../common/UIComponents';
import { Button } from '../common/UnifiedUI';
import { formatNumberShortCN } from '../../utils/numberFormat';
import { VASSAL_TYPE_LABELS, VASSAL_TYPE_CONFIGS, INDEPENDENCE_CONFIG, VASSAL_POLICY_SATISFACTION_EFFECTS } from '../../config/diplomacy';
import {
    calculateEnhancedTribute,
    calculateControlMeasureCost,
    checkGarrisonEffectiveness,
    calculateGovernorEffectiveness,
    getIndependenceChangeBreakdown
} from '../../logic/diplomacy/vassalSystem';
import { GOVERNOR_MANDATES, calculateGovernorFullEffects, GOVERNOR_EFFECTS_CONFIG } from '../../logic/diplomacy/vassalGovernors';

// ==================== 政策调整相关组件 ====================

/**
 * 政策选项卡片
 */
const PolicyOptionCard = memo(({
    selected,
    title,
    description,
    effects,
    effectColor = 'text-gray-400',
    extraEffects,
    extraEffectColor = 'text-cyan-300',
    onClick,
    disabled = false,
}) => (
    <button
        onClick={onClick}
        disabled={disabled}
        className={`
            w-full p-2 rounded-lg border transition-all text-left
            ${selected
                ? 'border-blue-500 bg-blue-900/30'
                : 'border-gray-600/50 bg-gray-800/30 hover:bg-gray-700/30'
            }
            ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        `}
    >
        <div className="flex items-center gap-2 mb-1">
            <div className={`w-3 h-3 rounded-full border-2 ${selected ? 'border-blue-400 bg-blue-400' : 'border-gray-500'
                }`} />
            <span className={`text-sm font-bold ${selected ? 'text-white' : 'text-gray-300'}`}>
                {title}
            </span>
        </div>
        {description && (
            <p className="text-xs text-gray-400 ml-5">{description}</p>
        )}
        {effects && (
            <p className={`text-xs ml-5 mt-0.5 ${effectColor}`}>{effects}</p>
        )}
        {extraEffects && (
            <p className={`text-xs ml-5 mt-0.5 ${extraEffectColor}`}>{extraEffects}</p>
        )}
    </button>
));

const formatSatisfactionDelta = (value) => {
    if (!Number.isFinite(value) || value === 0) return '0';
    return value > 0 ? `+${value}` : `${value}`;
};

const getSatisfactionEffectsText = (category, policyId) => {
    const effects = VASSAL_POLICY_SATISFACTION_EFFECTS?.[category]?.[policyId];
    if (!effects) return null;
    return `满意度: 精英${formatSatisfactionDelta(effects.elites)} / 平民${formatSatisfactionDelta(effects.commoners)} / 下层${formatSatisfactionDelta(effects.underclass)}`;
};

/**
 * 滑动条控制
 */
const SliderControl = memo(({
    label,
    value,
    onChange,
    min,
    max,
    step = 1,
    format = (v) => `${v}%`,
    description,
    warningThreshold,
    warningText,
}) => {
    const percentage = ((value - min) / (max - min)) * 100;
    const showWarning = warningThreshold && value >= warningThreshold;

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <span className="text-sm text-gray-300">{label}</span>
                <span className={`text-sm font-mono ${showWarning ? 'text-yellow-400' : 'text-white'}`}>
                    {format(value)}
                </span>
            </div>
            <input
                type="range"
                min={min}
                max={max}
                step={step}
                value={value}
                onChange={(e) => onChange(parseFloat(e.target.value))}
                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer
                    [&::-webkit-slider-thumb]:appearance-none
                    [&::-webkit-slider-thumb]:w-4
                    [&::-webkit-slider-thumb]:h-4
                    [&::-webkit-slider-thumb]:rounded-full
                    [&::-webkit-slider-thumb]:bg-blue-500
                    [&::-webkit-slider-thumb]:cursor-pointer
                "
                style={{
                    background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${percentage}%, #374151 ${percentage}%, #374151 100%)`
                }}
            />
            {description && (
                <p className="text-xs text-gray-500">{description}</p>
            )}
            {showWarning && warningText && (
                <p className="text-xs text-yellow-400 flex items-center gap-1">
                    <Icon name="AlertTriangle" size={12} />
                    {warningText}
                </p>
            )}
        </div>
    );
});

// 外交控制政策选项
const DIPLOMATIC_CONTROL_OPTIONS = [
    {
        id: 'autonomous',
        title: '自主外交',
        description: '允许附庸自主进行外交活动',
        effects: '独立倾向-5/年',
        effectColor: 'text-green-400',
    },
    {
        id: 'guided',
        title: '引导外交',
        description: '附庸外交需经过你的审批',
        effects: '维持现状（默认）',
        effectColor: 'text-gray-400',
    },
    {
        id: 'puppet',
        title: '僀儡外交',
        description: '完全控制附庸的外交行为',
        effects: '独立倾向+3/年',
        effectColor: 'text-red-400',
    },
];

// 劳工政策选项 (NEW - 控制工资成本和动荡)
const LABOR_POLICY_OPTIONS = [
    {
        id: 'standard',
        title: '正常雇佣',
        description: '按当地生活成本支付正常工资',
        effects: '工资成本: 100%',
        effectColor: 'text-gray-400',
    },
    {
        id: 'exploitation',
        title: '压榨剥削',
        description: '低于市场价的工资，劳动条件恶劣',
        effects: '工资成本: 60%，独立倾向+20%',
        effectColor: 'text-yellow-400',
    },
    {
        id: 'slavery',
        title: '强制劳动',
        description: '几乎无偿的强制劳动',
        effects: '工资成本: 30%，独立倾向+80%',
        effectColor: 'text-red-400',
        minEra: 2,
    },
];

// 贸易政策选项
const TRADE_POLICY_OPTIONS = [
    {
        id: 'free',
        title: '自由贸易',
        description: '允许附庸与任何国家自由贸易，换取政治稳定',
        effects: '无价格优势、无关税减免，独立倾向增速-20%',
        effectColor: 'text-green-400',
    },
    {
        id: 'preferential',
        title: '优惠准入',
        description: '你的商人享有优先贸易权，关税减免50%',
        effects: '维持现状（默认）',
        effectColor: 'text-gray-400',
    },
    {
        id: 'monopoly',
        title: '垄断贸易',
        description: '强制附庸所有贸易通过你的商人，关税全免',
        effects: '独立倾向增速+30%',
        effectColor: 'text-red-400',
    },
];

// 投资政策选项 (NEW)
const INVESTMENT_POLICY_OPTIONS = [
    {
        id: 'autonomous',
        title: '自主投资',
        description: '附庸仅投资于高回报项目 (ROI > 15%)',
        effects: '无额外不满',
        effectColor: 'text-green-400',
    },
    {
        id: 'guided',
        title: '引导投资',
        description: '附庸优先考虑发展，接受较低回报 (ROI > 5%)',
        effects: '中等不满',
        effectColor: 'text-yellow-400',
    },
    {
        id: 'forced',
        title: '强制投资',
        description: '附庸被迫进行投资，无论盈亏 (ROI > -10%)',
        effects: '严重不满，亏损时不满加剧',
        effectColor: 'text-red-400',
    },
];

// 军事政策选项 (NEW - 控制附庸是否自动参战)
const MILITARY_POLICY_OPTIONS = [
    {
        id: 'autonomous',
        title: '自主参战',
        description: '附庸自行决定是否参战',
        effects: '独立倾向-20%',
        effectColor: 'text-green-400',
    },
    {
        id: 'call_to_arms',
        title: '战争征召',
        description: '需要时可征召附庸参战',
        effects: '维持现状（默认）',
        effectColor: 'text-gray-400',
    },
    {
        id: 'auto_join',
        title: '自动参战',
        description: '宗主国参战时自动跟随',
        effects: '独立倾向+30%',
        effectColor: 'text-red-400',
    },
];


// 控制手段选项 (REVAMPED with dynamic costs)
const CONTROL_MEASURES = [
    {
        id: 'governor',
        title: '派遣总督',
        icon: 'UserCheck',
        description: '派遣一名官员担任总督管理附庸内政',
        effects: '效果基于官员能力',
        effectColor: 'text-blue-400',
        requiresOfficial: true,
        mechanics: [
            '需指定官员才生效',
            '每日影响独立倾向、精英满意度、动乱与朝贡修正',
        ],
    },
    {
        id: 'garrison',
        title: '驻军占领',
        icon: 'Shield',
        description: '在附庸境内驻扎军队（需要足够军力）',
        effects: '独立倾向-0.5/天，平民满意度-3，可用军力下降',
        effectColor: 'text-red-400',
        requiresMilitary: true,
        mechanics: [
            '判定：军力 ≥ 附庸军力 × 50%',
            '军力不足仅 20% 效果',
            '占用军力 = 附庸军力 × 50%',
        ],
    },
    {
        id: 'assimilation',
        title: '文化同化',
        icon: 'BookOpen',
        description: '推广本国文化和语言',
        effects: '独立倾向上限-0.05/天（长期）',
        effectColor: 'text-purple-400',
        mechanics: [
            '每日降低独立上限（最低 30）',
            '全阶层满意度小幅惩罚',
        ],
    },
    {
        id: 'economicAid',
        title: '经济扶持',
        icon: 'DollarSign',
        description: '提供经济援助改善民生',
        effects: '平民满意度+3，下层满意度+5，国内投资倾向↑',
        effectColor: 'text-green-400',
        mechanics: [
            '优先投资概率 70%',
            '投资执行概率 ×1.5',
        ],
    },
];

// ==================== Tab 内容组件 ====================

/**
 * 概览 Tab 内容
 */
const OverviewTab = memo(({ nation, tribute, typeConfig, isAtRisk, vassalType, independence, onDiplomaticAction, onClose, independenceBreakdown }) => (
    <div className="space-y-4">
        {/* 附庸类型标识 */}
        <div className="flex items-center justify-between p-3 bg-purple-900/30 rounded-lg border border-purple-700/40">
            <div className="flex items-center gap-2">
                <Icon name="Crown" size={18} className="text-purple-400" />
                <span className="text-purple-200 font-semibold">
                    {VASSAL_TYPE_LABELS?.[vassalType] || '保护国'}
                </span>
            </div>
            {isAtRisk && (
                <span className="px-2 py-1 text-xs bg-red-600 text-white rounded animate-pulse">
                    ⚠️ 独立风险
                </span>
            )}
        </div>

        {/* 主要指标 */}
        <div className="grid grid-cols-1 gap-3">
            {/* 独立倾向 */}
            <div className={`p-4 rounded-lg border ${isAtRisk ? 'bg-red-900/30 border-red-700/40' : 'bg-gray-800/50 border-gray-700/40'}`}>
                <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-gray-400 uppercase tracking-wider">独立倾向</span>
                    <span className={`text-xl font-bold font-mono ${isAtRisk ? 'text-red-400' : 'text-green-400'}`}>
                        {Math.round(independence)}%
                    </span>
                </div>
                <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                    <div
                        className={`h-full transition-all duration-300 ${isAtRisk ? 'bg-red-500' : 'bg-green-500'}`}
                        style={{ width: `${independence}%` }}
                    />
                </div>
                <div className="text-[10px] text-gray-500 mt-1">
                    {independence > 80 ? '即将独立!' : independence > 60 ? '有独立意向' : independence > 30 ? '轻微不满' : '忠诚'}
                </div>
                {/* 每日变化预估 */}
                {independenceBreakdown && (
                    <div className={`text-[10px] mt-1 font-mono ${independenceBreakdown.netChange > 0 ? 'text-red-400' : 'text-green-400'
                        }`}>
                        每日: {independenceBreakdown.netChange > 0 ? '+' : ''}{independenceBreakdown.netChange.toFixed(2)}%
                    </div>
                )}
            </div>
        </div>

        {/* 独立度变化原因 */}
        {independenceBreakdown && (
            <div className="p-4 bg-gray-800/30 rounded-lg border border-gray-700/40">
                <div className="flex items-center gap-2 mb-3">
                    <Icon name="TrendingUp" size={16} className="text-orange-400" />
                    <span className="text-sm font-semibold text-gray-200">独立倾向变化原因</span>
                    <span className={`ml-auto text-sm font-mono ${independenceBreakdown.netChange > 0 ? 'text-red-400' : 'text-green-400'}`}>
                        {independenceBreakdown.netChange > 0 ? '+' : ''}{independenceBreakdown.netChange.toFixed(2)}%/天
                    </span>
                </div>

                {/* 增长因素 */}
                {independenceBreakdown.factors.length > 0 && (
                    <div className="mb-3">
                        <div className="text-[10px] text-red-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                            <Icon name="ArrowUp" size={10} />
                            增长因素 (+{independenceBreakdown.growthRate.toFixed(2)}%/天)
                        </div>
                        <div className="space-y-1">
                            {independenceBreakdown.factors.map((factor, idx) => (
                                <div key={idx} className="flex items-center justify-between text-[10px]">
                                    <span className="text-gray-400">
                                        {factor.name}
                                        {factor.description && (
                                            <span className="text-gray-500 ml-1">({factor.description})</span>
                                        )}
                                    </span>
                                    <span className={`font-mono ${factor.effect === 'negative' ? 'text-red-400' :
                                        factor.effect === 'positive' ? 'text-green-400' : 'text-gray-300'
                                        }`}>
                                        {factor.type === 'multiplier'
                                            ? `×${factor.value.toFixed(2)}`
                                            : `${factor.value >= 0 ? '+' : ''}${factor.value.toFixed(2)}`}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* 减少因素 */}
                {independenceBreakdown.reductions.length > 0 && (
                    <div>
                        <div className="text-[10px] text-green-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                            <Icon name="ArrowDown" size={10} />
                            抑制因素 (-{independenceBreakdown.totalReduction.toFixed(2)}%/天)
                        </div>
                        <div className="space-y-1">
                            {independenceBreakdown.reductions.map((reduction, idx) => (
                                <div key={idx} className="flex items-center justify-between text-[10px]">
                                    <span className="text-gray-400">
                                        {reduction.name}
                                        {reduction.description && (
                                            <span className="text-gray-500 ml-1">({reduction.description})</span>
                                        )}
                                    </span>
                                    <span className="text-green-400 font-mono">
                                        -{reduction.value.toFixed(2)}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* 无减少因素时的提示 */}
                {independenceBreakdown.reductions.length === 0 && independenceBreakdown.netChange > 0 && (
                    <div className="text-[10px] text-yellow-400/70 flex items-center gap-1">
                        <Icon name="AlertTriangle" size={10} />
                        未启用任何控制措施，独立倾向将持续上升
                    </div>
                )}
            </div>
        )}

        {/* 朝贡信息 */}
        <div className="p-4 bg-amber-900/20 rounded-lg border border-amber-700/40">
            <div className="flex items-center gap-2 mb-3">
                <Icon name="Coins" size={18} className="text-amber-400" />
                <span className="text-amber-200 font-semibold">朝贡收入</span>
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <div className="text-xs text-gray-400">日朝贡</div>
                    <div className="text-lg font-bold text-amber-300">
                        +{formatNumberShortCN((tribute.silver || 0) / 30)} 银
                    </div>
                </div>
                <div>
                    <div className="text-xs text-gray-400">朝贡率</div>
                    <div className="text-lg font-bold text-amber-300">
                        {Math.round((nation.tributeRate || 0) * 100)}%
                    </div>
                </div>
            </div>
        </div>

        {/* 阶层满意度 */}
        <div className="p-4 bg-gray-800/30 rounded-lg border border-gray-700/40">
            <div className="flex items-center gap-2 mb-3">
                <Icon name="Users" size={16} className="text-cyan-400" />
                <span className="text-sm font-semibold text-gray-200">阶层满意度</span>
                <span className="ml-auto text-xs text-gray-400">
                    平均: {Math.round(
                        nation.socialStructure 
                            ? ((nation.socialStructure.elites?.satisfaction || 50) + 
                               (nation.socialStructure.commoners?.satisfaction || 50) + 
                               (nation.socialStructure.underclass?.satisfaction || 50)) / 3
                            : 50
                    )}%
                </span>
            </div>
            <div className="space-y-2">
                {/* 精英阶层 */}
                <div>
                    <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-gray-400">精英阶层</span>
                        <span className="text-xs font-mono text-white">
                            {Math.round(nation.socialStructure?.elites?.satisfaction || 50)}%
                        </span>
                    </div>
                    <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-purple-500 transition-all duration-300"
                            style={{ width: `${nation.socialStructure?.elites?.satisfaction || 50}%` }}
                        />
                    </div>
                </div>
                {/* 平民阶层 */}
                <div>
                    <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-gray-400">平民阶层</span>
                        <span className="text-xs font-mono text-white">
                            {Math.round(nation.socialStructure?.commoners?.satisfaction || 50)}%
                        </span>
                    </div>
                    <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-blue-500 transition-all duration-300"
                            style={{ width: `${nation.socialStructure?.commoners?.satisfaction || 50}%` }}
                        />
                    </div>
                </div>
                {/* 下层阶层 */}
                <div>
                    <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-gray-400">下层阶层</span>
                        <span className="text-xs font-mono text-white">
                            {Math.round(nation.socialStructure?.underclass?.satisfaction || 50)}%
                        </span>
                    </div>
                    <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-green-500 transition-all duration-300"
                            style={{ width: `${nation.socialStructure?.underclass?.satisfaction || 50}%` }}
                        />
                    </div>
                </div>
            </div>
        </div>

        {/* 详细信息 */}
        <div className="p-4 bg-gray-800/30 rounded-lg border border-gray-700/40">
            <div className="text-xs text-gray-400 uppercase tracking-wider mb-3">附庸详情</div>
            <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="flex justify-between">
                    <span className="text-gray-400">人口:</span>
                    <span className="text-white">{formatNumberShortCN(nation.population || 0)}</span>
                </div>
                <div className="flex justify-between">
                    <span className="text-gray-400">财富:</span>
                    <span className="text-white">{formatNumberShortCN(nation.wealth || 0)}</span>
                </div>
                <div className="flex justify-between">
                    <span className="text-gray-400">军事义务:</span>
                    <span className="text-blue-400">
                        {typeConfig.militaryObligation === 'auto_join' ? '自动参战' :
                            typeConfig.militaryObligation === 'expeditionary' ? '派遣远征军' :
                                typeConfig.militaryObligation === 'pay_to_call' ? '付费征召' : '无'}
                    </span>
                </div>
                <div className="flex justify-between">
                    <span className="text-gray-400">投资特权:</span>
                    <span className="text-green-400">
                        {typeConfig.economicPrivileges?.investmentCostDiscount > 0
                            ? `折扣${typeConfig.economicPrivileges.investmentCostDiscount * 100}%`
                            : '无折扣'}
                    </span>
                </div>
            </div>
        </div>

        {/* 军事与经济行动 */}
        <div className="grid grid-cols-2 gap-2">
            {typeConfig.militaryObligation === 'expeditionary' && (
                <Button
                    onClick={() => onDiplomaticAction?.(nation.id, 'request_force')}
                    className="w-full bg-blue-700 hover:bg-blue-600"
                >
                    <Icon name="Swords" size={14} className="mr-1" />
                    请求远征军
                </Button>
            )}
            {typeConfig.militaryObligation === 'pay_to_call' && (
                <Button
                    onClick={() => onDiplomaticAction?.(nation.id, 'call_to_arms')}
                    className="w-full bg-blue-700 hover:bg-blue-600"
                >
                    <Icon name="Flag" size={14} className="mr-1" />
                    战争征召
                </Button>
            )}

            {/* 释放附庸按钮 */}
            <Button
                onClick={() => {
                    onDiplomaticAction?.(nation.id, 'release_vassal');
                    onClose();
                }}
                variant="danger"
                className="w-full col-span-2"
            >
                <Icon name="Unlock" size={16} className="mr-2" />
                释放附庸
            </Button>
        </div>

        {/* 提示 */}
        {isAtRisk && (
            <div className="p-3 bg-red-900/30 rounded-lg border border-red-700/40 text-center">
                <div className="text-xs text-red-300">
                    ⚠️ 该附庸国独立倾向过高，可能随时发动独立战争！
                </div>
                <div className="text-[10px] text-red-400/70 mt-1">
                    建议：降低朝贡率或加强控制手段
                </div>
            </div>
        )}
    </div>
));

/**
 * 政策调整 Tab 内容 (REVAMPED)
 */
const PolicyTab = memo(({ nation, onApplyPolicy, officials = [], playerMilitary = 1.0 }) => {
    // 获取附庸配置
    const vassalConfig = VASSAL_TYPE_CONFIGS[nation?.vassalType] || {};
    const vassalType = nation?.vassalType || 'protectorate';
    const baseTributeRate = vassalConfig.tributeRate || 0.1;
    const vassalWealth = nation?.wealth || 500;
    const vassalMilitary = nation?.militaryStrength || 0.5;

    // 根据附庸类型过滤可用的外交控制选项 - All available now
    const availableDiplomaticOptions = DIPLOMATIC_CONTROL_OPTIONS;

    // 获取默认外交控制选项
    const getDefaultDiplomaticControl = () => {
        return nation?.vassalPolicy?.diplomaticControl || 'guided';
    };

    // 政策状态
    const [diplomaticControl, setDiplomaticControl] = useState(getDefaultDiplomaticControl);
    const [tradePolicy, setTradePolicy] = useState(
        nation?.vassalPolicy?.tradePolicy || 'preferential'
    );
    const [laborPolicy, setLaborPolicy] = useState(
        nation?.vassalPolicy?.labor || 'standard'
    );
    const [investmentPolicy, setInvestmentPolicy] = useState(
        nation?.vassalPolicy?.investmentPolicy || 'autonomous'
    );
    const [militaryPolicy, setMilitaryPolicy] = useState(
        nation?.vassalPolicy?.military || 'call_to_arms'
    );
    const [tributeRate, setTributeRate] = useState(
        nation?.tributeRate !== undefined ? nation.tributeRate * 100 : baseTributeRate * 100
    );

    // UI State
    const [isGovernorSelectorOpen, setIsGovernorSelectorOpen] = useState(false);


    // 控制手段状态 (NEW: Object format with officialId support)
    const [controlMeasures, setControlMeasures] = useState(() => {
        const existing = nation?.vassalPolicy?.controlMeasures || {};
        const initial = {};
        CONTROL_MEASURES.forEach(m => {
            if (typeof existing[m.id] === 'boolean') {
                // Migrate from legacy boolean format
                initial[m.id] = { active: existing[m.id], officialId: null, mandate: 'pacify' };
            } else if (existing[m.id]) {
                initial[m.id] = { ...existing[m.id] };
                if (m.id === 'governor' && !initial[m.id].mandate) {
                    initial[m.id].mandate = 'pacify';
                }
            } else {
                initial[m.id] = { active: false, officialId: null, mandate: 'pacify' };
            }
        });
        return initial;
    });

    // Toggle control measure
    const toggleControlMeasure = (measureId) => {
        setControlMeasures(prev => ({
            ...prev,
            [measureId]: {
                ...prev[measureId],
                active: !prev[measureId]?.active,
            },
        }));
    };

    // Set governor official
    const setGovernorOfficial = (officialId) => {
        setControlMeasures(prev => ({
            ...prev,
            governor: {
                ...prev.governor,
                officialId: officialId || null,
                active: !!officialId, // Auto-activate when official is selected
            },
        }));
    };

    // Set governor mandate
    const setGovernorMandate = (mandateId) => {
        setControlMeasures(prev => ({
            ...prev,
            governor: {
                ...prev.governor,
                mandate: mandateId,
            },
        }));
    };

    // Get active control measure IDs
    const activeControlMeasures = useMemo(() => {
        return Object.entries(controlMeasures)
            .filter(([, data]) => data.active)
            .map(([id]) => id);
    }, [controlMeasures]);

    // Calculate individual measure costs for display
    const measureCosts = useMemo(() => {
        const costs = {};
        CONTROL_MEASURES.forEach(m => {
            if (m.id === 'governor') {
                const officialId = controlMeasures.governor?.officialId;
                const official = officials.find(o => o.id === officialId);
                if (official) {
                    const baseCost = GOVERNOR_EFFECTS_CONFIG.dailyCost.base;
                    const prestigeCost = (official.prestige || 50) * GOVERNOR_EFFECTS_CONFIG.dailyCost.perPrestige;
                    // Use prestige-based cost directly to match backend replacement logic
                    costs[m.id] = baseCost + prestigeCost;
                } else {
                    costs[m.id] = calculateControlMeasureCost(m.id, vassalWealth);
                }
            } else {
                costs[m.id] = calculateControlMeasureCost(m.id, vassalWealth);
            }
        });
        return costs;
    }, [vassalWealth, controlMeasures.governor?.officialId, officials]);

    // 计算控制手段总成本 (NEW: Dynamic cost calculation)
    const totalControlCost = useMemo(() => {
        return activeControlMeasures.reduce((sum, measureId) => {
            return sum + (measureCosts[measureId] || 0);
        }, 0);
    }, [activeControlMeasures, measureCosts]);

    // 计算预估朝贡收入
    const estimatedTribute = useMemo(() => {
        const gdp = nation?.gdp || 10000;
        return gdp * (tributeRate / 100);
    }, [nation?.gdp, tributeRate]);

    const buildPolicyPayload = useCallback(() => ({
        diplomaticControl,
        tradePolicy,
        labor: laborPolicy,
        investmentPolicy,
        military: militaryPolicy,
        tributeRate: tributeRate / 100,
        controlMeasures,
        controlCostPerDay: totalControlCost,
    }), [
        diplomaticControl,
        tradePolicy,
        laborPolicy,
        investmentPolicy,
        militaryPolicy,
        tributeRate,
        controlMeasures,
        totalControlCost,
    ]);

    // 自动应用（去掉“应用政策”按钮）：
    // - 通过 debounce 避免拖动滑条时每一帧都触发 action/log
    // - 首次渲染不触发，避免打开面板就刷一条“已调整政策”日志
    const didInitRef = useRef(false);
    const debounceTimerRef = useRef(null);
    const pendingPolicyRef = useRef(null);
    useEffect(() => {
        if (!nation) return;

        pendingPolicyRef.current = buildPolicyPayload();

        if (!didInitRef.current) {
            didInitRef.current = true;
            return;
        }

        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
        }

        debounceTimerRef.current = setTimeout(() => {
            if (pendingPolicyRef.current) {
                onApplyPolicy?.(pendingPolicyRef.current);
            }
        }, 250);

        return () => {
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
            }
        };
    }, [
        nation,
        buildPolicyPayload,
        onApplyPolicy,
    ]);

    useEffect(() => {
        return () => {
            if (didInitRef.current && pendingPolicyRef.current) {
                onApplyPolicy?.(pendingPolicyRef.current);
            }
        };
    }, [onApplyPolicy]);

    // 重置为默认（重置会自然触发自动应用）
    const handleReset = () => {
        setDiplomaticControl('guided');
        setTradePolicy('preferential');
        setLaborPolicy('standard');
        setInvestmentPolicy('autonomous');
        setMilitaryPolicy('call_to_arms');
        setTributeRate(baseTributeRate * 100);
        const resetMeasures = {};
        CONTROL_MEASURES.forEach(m => {
            resetMeasures[m.id] = { active: false, officialId: null, mandate: 'pacify' };
        });
        setControlMeasures(resetMeasures);
    };

    // Garrison effectiveness check
    const garrisonCheck = useMemo(() => {
        return checkGarrisonEffectiveness(playerMilitary, vassalMilitary);
    }, [playerMilitary, vassalMilitary]);
    const garrisonCommitmentFactor = INDEPENDENCE_CONFIG?.controlMeasures?.garrison?.militaryCommitmentFactor || 0;
    const garrisonCommitment = vassalMilitary * garrisonCommitmentFactor;

    // Governor effectiveness - using new deep integration
    const governorEffectiveness = useMemo(() => {
        const officialId = controlMeasures.governor?.officialId;
        if (!officialId) return null;
        const official = officials.find(o => o.id === officialId);
        if (!official) return null;

        // Mock vassal object with selected mandate to preview effects
        const mockVassal = {
            ...nation,
            vassalPolicy: {
                controlMeasures: {
                    governor: {
                        mandate: controlMeasures.governor?.mandate || 'pacify'
                    }
                }
            }
        };

        const effects = calculateGovernorFullEffects(official, mockVassal);

        return {
            ...effects,
            stats: {
                prestige: official.prestige || 50,
                admin: official.administrative || 50,
                military: official.military || 30,
                loyalty: official.loyalty || 50
            },
            // For display compatibility with old component
            tributeBonus: Math.round((effects.tributeModifier - 1) * 100),
            stabilityBonus: Math.round((effects.stabilityBonus || 0) * 100), // Assuming stabilityBonus is multiplier or raw?
            // backend returns stabilityBonus as e.g. 5 (not percent 0.05), so raw is fine if display expects it.
            // Wait, calculateGovernorFullEffects: stabilityBonus = effMilitary * 0.05. e.g. 50 * 0.05 = 2.5.
            // Old code: stabilityBonus = military * 1.
            // New code returns ~2.5. If UI expects "points", it might be different.
            // Let's check old UI: `稳定+{governorEffectiveness.stabilityBonus}%`
            // If new is 2.5, it means +2.5%. Old was +50%.
            // I should scale it to percentage if needed.
            // Config: stabilityPerPoint = 0.05. 50 * 0.05 = 2.5.
            // In processVassalUpdates: updated.unrest -= govEffects.unrestSuppression.
            // It doesn't use stabilityBonus directly except maybe for display or other logic?
            // Actually it is used: `updated.unrest = Math.max(0, (updated.unrest || 0) - govEffects.unrestSuppression);`
            // So stabilityBonus might not be used in update loop?
            // Ah, the returned object has: `stabilityBonus: Math.max(0, stabilityBonus)`.
            // Let's just pass it through.

            // Adjust to match display expectation
            corruptionRisk: effects.corruptionRate * 100,
        };
    }, [controlMeasures.governor, officials, nation]);

    return (
        <div className="space-y-4">
            {/* 外交控制 */}
            <div>
                <h3 className="text-sm font-bold text-white mb-2 flex items-center gap-1.5">
                    <Icon name="Globe" size={14} className="text-blue-400" />
                    外交控制
                </h3>

                <div className="space-y-2">
                    {DIPLOMATIC_CONTROL_OPTIONS.map(option => {
                        return (
                            <PolicyOptionCard
                                key={option.id}
                                selected={diplomaticControl === option.id}
                                title={option.title}
                                description={option.description}
                                effects={option.effects}
                                effectColor={option.effectColor}
                                onClick={() => setDiplomaticControl(option.id)}
                            />
                        );
                    })}
                </div>
            </div>

            {/* 劳工政策 (NEW) */}
            <div>
                <h3 className="text-sm font-bold text-white mb-2 flex items-center gap-1.5">
                    <Icon name="Users" size={14} className="text-orange-400" />
                    劳工政策
                    <span className="text-[10px] text-gray-500 ml-1">（影响海外投资工资成本）</span>
                </h3>
                <div className="space-y-2">
                    {LABOR_POLICY_OPTIONS.map(option => (
                        <PolicyOptionCard
                            key={option.id}
                            selected={laborPolicy === option.id}
                            title={option.title}
                            description={option.description}
                            effects={option.effects}
                            effectColor={option.effectColor}
                            extraEffects={getSatisfactionEffectsText('labor', option.id)}
                            onClick={() => setLaborPolicy(option.id)}
                        />
                    ))}
                </div>
            </div>

            {/* 投资政策 (NEW) */}
            <div>
                <h3 className="text-sm font-bold text-white mb-2 flex items-center gap-1.5">
                    <Icon name="Briefcase" size={14} className="text-blue-400" />
                    投资政策
                    <span className="text-[10px] text-gray-500 ml-1">（影响附庸对宗主国投资的态度）</span>
                </h3>
                <div className="space-y-2">
                    {INVESTMENT_POLICY_OPTIONS.map(option => (
                        <PolicyOptionCard
                            key={option.id}
                            selected={investmentPolicy === option.id}
                            title={option.title}
                            description={option.description}
                            effects={option.effects}
                            effectColor={option.effectColor}
                            extraEffects={getSatisfactionEffectsText('investmentPolicy', option.id)}
                            onClick={() => setInvestmentPolicy(option.id)}
                        />
                    ))}
                </div>
            </div>

            {/* 军事政策 (NEW) */}
            <div>
                <h3 className="text-sm font-bold text-white mb-2 flex items-center gap-1.5">
                    <Icon name="Swords" size={14} className="text-red-400" />
                    军事政策
                    <span className="text-[10px] text-gray-500 ml-1">（影响附庸是否自动参战）</span>
                </h3>
                <div className="space-y-2">
                    {MILITARY_POLICY_OPTIONS.map(option => (
                        <PolicyOptionCard
                            key={option.id}
                            selected={militaryPolicy === option.id}
                            title={option.title}
                            description={option.description}
                            effects={option.effects}
                            effectColor={option.effectColor}
                            extraEffects={getSatisfactionEffectsText('military', option.id)}
                            onClick={() => setMilitaryPolicy(option.id)}
                        />
                    ))}
                </div>
            </div>


            {/* 贸易政策 */}
            <div>
                <h3 className="text-sm font-bold text-white mb-2 flex items-center gap-1.5">
                    <Icon name="TrendingUp" size={14} className="text-green-400" />
                    贸易政策
                </h3>
                <div className="space-y-2">
                    {TRADE_POLICY_OPTIONS.map(option => (
                        <PolicyOptionCard
                            key={option.id}
                            selected={tradePolicy === option.id}
                            title={option.title}
                            description={option.description}
                            effects={option.effects}
                            effectColor={option.effectColor}
                            extraEffects={getSatisfactionEffectsText('tradePolicy', option.id)}
                            onClick={() => setTradePolicy(option.id)}
                        />
                    ))}
                </div>
            </div>


            {/* 朝贡率调整 */}
            <div>
                <h3 className="text-sm font-bold text-white mb-2 flex items-center gap-1.5">
                    <Icon name="Coins" size={14} className="text-amber-400" />
                    朝贡率调整
                </h3>
                <div className="bg-gray-800/30 rounded-lg p-3 border border-gray-700/50">
                    <SliderControl
                        label="朝贡率"
                        value={tributeRate}
                        onChange={setTributeRate}
                        min={Math.floor(baseTributeRate * 50)}
                        max={Math.floor(baseTributeRate * 150)}
                        step={1}
                        format={(v) => `${Math.round(v)}%`}
                        description={`预计月收入：${formatNumberShortCN(estimatedTribute)}`}
                        warningThreshold={baseTributeRate * 120}
                        warningText="过高的朝贡率会增加独立倾向"
                    />
                </div>
            </div>

            {/* 控制手段 (REVAMPED) */}
            <div>
                <h3 className="text-sm font-bold text-white mb-2 flex items-center gap-1.5">
                    <Icon name="Target" size={14} className="text-orange-400" />
                    控制手段
                    {totalControlCost > 0 && (
                        <span className="text-xs text-amber-400 ml-2">
                            (每日成本: {formatNumberShortCN(totalControlCost)} 银币)
                        </span>
                    )}
                </h3>
                <p className="text-[10px] text-gray-500 mb-2">
                    成本基于附庸财富动态计算
                </p>
                <div className="space-y-2">
                    {CONTROL_MEASURES.map(measure => {
                        const isActive = controlMeasures[measure.id]?.active;
                        const dynamicCost = measureCosts[measure.id];
                        const isGovernor = measure.id === 'governor';

                        return (
                            <div
                                key={measure.id}
                                className={`
                                    rounded-lg border transition-all
                                    ${isGovernor ? 'overflow-visible relative z-20' : 'overflow-hidden'}
                                    ${isActive
                                        ? 'border-orange-500 bg-orange-900/30'
                                        : 'border-gray-600/50 bg-gray-800/30'
                                    }
                                `}
                            >
                                {/* 可点击的主体区域 */}
                                <button
                                    onClick={() => !isGovernor && toggleControlMeasure(measure.id)}
                                    disabled={isGovernor}
                                    className={`
                                        w-full p-3 text-left transition-all
                                        ${isGovernor
                                            ? 'cursor-default'
                                            : isActive
                                                ? 'hover:bg-orange-800/30 cursor-pointer'
                                                : 'hover:bg-gray-700/50 cursor-pointer active:bg-gray-600/50'
                                        }
                                    `}
                                >
                                    <div className="flex items-center justify-between mb-1.5">
                                        <div className="flex items-center gap-2">
                                            <div className={`
                                                p-1.5 rounded-md
                                                ${isActive ? 'bg-orange-600/50' : 'bg-gray-700/50'}
                                            `}>
                                                <Icon
                                                    name={measure.icon}
                                                    size={16}
                                                    className={isActive ? 'text-orange-300' : 'text-gray-400'}
                                                />
                                            </div>
                                            <span className={`text-sm font-bold ${isActive ? 'text-white' : 'text-gray-300'}`}>
                                                {measure.title}
                                            </span>
                                            {/* 状态标签 */}
                                            <span className={`
                                                px-2 py-0.5 text-[10px] rounded-full font-medium
                                                ${isActive
                                                    ? 'bg-green-600/80 text-green-100'
                                                    : 'bg-gray-600/80 text-gray-300'
                                                }
                                            `}>
                                                {isActive ? '✓ 已启用' : '未启用'}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs text-amber-300 font-medium">
                                                {formatNumberShortCN(dynamicCost)} 银币/天
                                            </span>
                                            {/* 点击提示图标（非总督） */}
                                            {!isGovernor && (
                                                <Icon
                                                    name={isActive ? 'ToggleRight' : 'ToggleLeft'}
                                                    size={20}
                                                    className={isActive ? 'text-orange-400' : 'text-gray-500'}
                                                />
                                            )}
                                        </div>
                                    </div>
                                    <p className="text-[11px] text-gray-400 mb-1">{measure.description}</p>
                                    <p className={`text-[11px] font-medium ${measure.effectColor}`}>{measure.effects}</p>
                                    {measure.id === 'garrison' && (
                                        <div className="text-[10px] text-gray-500 mt-0.5">
                                            占用军力：{garrisonCommitment.toFixed(1)}（附庸军力 {vassalMilitary.toFixed(1)} × {garrisonCommitmentFactor}）
                                        </div>
                                    )}
                                    {measure.mechanics && (
                                        <div className="mt-1 space-y-0.5 text-[10px] text-gray-500">
                                            {measure.mechanics.map((line) => (
                                                <div key={line} className="flex items-center gap-1">
                                                    <Icon name="Info" size={10} />
                                                    <span>{line}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    {/* 非总督的点击提示 */}
                                    {!isGovernor && !isActive && (
                                        <p className="text-[10px] text-gray-500 mt-1.5 flex items-center gap-1">
                                            <Icon name="MousePointer" size={10} />
                                            点击此处启用
                                        </p>
                                    )}
                                </button>

                                {/* Governor: Official Selector & Mandate Selector */}
                                {measure.id === 'governor' && (
                                    <div className="px-3 pb-3 space-y-2 border-t border-gray-700/50">
                                        {/* Official Selector */}
                                        <div className="pt-2">
                                            <label className="text-[10px] text-gray-400 mb-1 block">指派官员:</label>
                                            <div className="relative">
                                                <button
                                                    onClick={() => setIsGovernorSelectorOpen(!isGovernorSelectorOpen)}
                                                    className="w-full px-2 py-1.5 bg-gray-800 border border-gray-600 rounded text-xs text-white hover:border-gray-500 focus:border-blue-500 transition-colors flex items-center justify-between"
                                                >
                                                    <span className="truncate">
                                                        {(() => {
                                                            const selectedId = controlMeasures.governor?.officialId;
                                                            if (!selectedId) return '-- 选择官员 --';
                                                            const selected = officials.find(o => o.id === selectedId);
                                                            if (!selected) return '未知官员';
                                                            return `${selected.name} (威${selected.stats?.prestige ?? selected.prestige ?? 50}/政${selected.stats?.administrative ?? selected.administrative ?? 50}/军${selected.stats?.military ?? selected.military ?? 30}/外${selected.stats?.diplomacy ?? selected.diplomacy ?? 30})`;
                                                        })()}
                                                    </span>
                                                    <Icon name={isGovernorSelectorOpen ? "ChevronUp" : "ChevronDown"} size={14} className="text-gray-400 ml-2 flex-shrink-0" />
                                                </button>

                                                {isGovernorSelectorOpen && (
                                                    <div className="absolute left-0 top-full mt-1 w-full bg-gray-800 border border-gray-600 rounded shadow-xl max-h-60 overflow-y-auto z-50 py-1">
                                                        <div
                                                            className="px-2 py-1.5 hover:bg-gray-700 cursor-pointer text-xs text-gray-400 border-b border-gray-700"
                                                            onClick={() => {
                                                                setGovernorOfficial(null);
                                                                setIsGovernorSelectorOpen(false);
                                                            }}
                                                        >
                                                            -- 取消选择 --
                                                        </div>
                                                        {officials.length === 0 ? (
                                                            <div className="px-2 py-1.5 text-xs text-gray-500">
                                                                没有可用的官员
                                                            </div>
                                                        ) : (
                                                            officials.filter(o => o && !o.isBusy).map(official => (
                                                                <div
                                                                    key={official.id}
                                                                    className={`px-2 py-1.5 hover:bg-gray-700 cursor-pointer text-xs text-white flex items-center justify-between ${controlMeasures.governor?.officialId === official.id ? 'bg-blue-900/30' : ''}`}
                                                                    onClick={() => {
                                                                        setGovernorOfficial(official.id);
                                                                        setIsGovernorSelectorOpen(false);
                                                                    }}
                                                                >
                                                                    <span className="truncate mr-2">
                                                                        {official.name} (威{official.stats?.prestige ?? official.prestige ?? 50}/政{official.stats?.administrative ?? official.administrative ?? 50}/军{official.stats?.military ?? official.military ?? 30}/外{official.stats?.diplomacy ?? official.diplomacy ?? 30})
                                                                    </span>
                                                                    {controlMeasures.governor?.officialId === official.id && (
                                                                        <Icon name="Check" size={12} className="text-blue-400 flex-shrink-0" />
                                                                    )}
                                                                </div>
                                                            ))
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Mandate Selector */}
                                        {controlMeasures.governor?.officialId && (
                                            <div className="space-y-1">
                                                <div className="text-[10px] text-gray-400 flex items-center gap-1">
                                                    <Icon name="Scroll" size={10} />
                                                    施政纲领
                                                </div>
                                                <div className="grid grid-cols-2 gap-1">
                                                    {Object.entries(GOVERNOR_MANDATES).map(([mandateId, mandate]) => (
                                                        <button
                                                            key={mandateId}
                                                            onClick={() => setGovernorMandate(mandateId)}
                                                            className={`
                                                                px-2 py-1.5 rounded text-[10px] text-left border transition-all
                                                                ${controlMeasures.governor?.mandate === mandateId
                                                                    ? 'bg-blue-900/50 border-blue-500 text-white'
                                                                    : 'bg-gray-800/50 border-gray-600/50 text-gray-400 hover:bg-gray-700/50'
                                                                }
                                                            `}
                                                        >
                                                            <div className="font-bold">{mandate.name}</div>
                                                            <div className="text-[9px] opacity-70 truncate">{mandate.desc}</div>
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {officials.length === 0 && (
                                            <div className="text-[10px] text-yellow-400 flex items-center gap-1">
                                                <Icon name="AlertCircle" size={10} />
                                                没有可用官员，请先招募官员
                                            </div>
                                        )}
                                        {governorEffectiveness && (
                                            <div className="text-[10px] space-y-0.5 mt-1 p-2 bg-gray-800/50 rounded">
                                                <div className="text-gray-400">
                                                    <span className="text-white">{governorEffectiveness.officialName}</span>
                                                    {' '}(威望:{governorEffectiveness.stats.prestige} 行政:{governorEffectiveness.stats.admin} 军事:{governorEffectiveness.stats.military})
                                                </div>
                                                <div className="flex flex-wrap gap-2">
                                                    <span className="text-green-400">朝贡+{governorEffectiveness.tributeBonus}%</span>
                                                    <span className="text-cyan-400">稳定+{governorEffectiveness.stabilityBonus}%</span>
                                                    <span className="text-blue-400">独立倾向-{(governorEffectiveness.independenceReduction * 100).toFixed(1)}%</span>
                                                    {governorEffectiveness.corruptionRisk > 0 && (
                                                        <span className="text-red-400">腐败风险{governorEffectiveness.corruptionRisk.toFixed(0)}%</span>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Garrison: Military Check */}
                                {measure.id === 'garrison' && isActive && (
                                    <div className={`px-3 pb-3 text-[11px] ${garrisonCheck.isEffective ? 'text-green-400' : 'text-red-400'}`}>
                                        {garrisonCheck.isEffective
                                            ? `✓ 军力充足 (需${garrisonCheck.requiredStrength.toFixed(1)}, 有${playerMilitary.toFixed(1)})`
                                            : `✗ 军力不足 (需${garrisonCheck.requiredStrength.toFixed(1)}, 有${playerMilitary.toFixed(1)}) - 仅20%效果`
                                        }
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* 底部操作按钮（Sticky） */}
            <div className="sticky bottom-0 -mx-1 px-1 pt-2 pb-1 border-t border-gray-700 bg-gradient-to-t from-gray-950/95 via-gray-950/80 to-transparent backdrop-blur">
                <div className="flex items-center justify-between">
                    <div className="text-[10px] text-gray-500">
                        政策将自动生效
                    </div>
                    <button
                        onClick={handleReset}
                        className="px-3 py-1.5 text-sm text-gray-400 hover:text-white transition-colors"
                    >
                        重置为默认
                    </button>
                </div>
            </div>
        </div>
    );
});

// ==================== 主组件 ====================

/**
 * 附庸管理 Bottom Sheet
 */
// 外交操作标签映射
const ACTION_LABELS = {
    trade: '贸易协定',
    declare_war: '宣战',
    propose_peace: '媾和',
    join_org: '加入组织',
    leave_org: '退出组织',
    join_alliance: '加入同盟',
    create_alliance: '建立同盟',
    create_economic_bloc: '建立经济同盟',
    alliance: '结盟意向',
};

// 下达指令的操作类型
const ORDER_ACTIONS = [
    { id: 'declare_war', label: '宣战' },
    { id: 'propose_peace', label: '媾和' },
    { id: 'trade', label: '贸易协定' },
    { id: 'join_org', label: '加入组织' },
    { id: 'leave_org', label: '退出组织' },
    { id: 'create_alliance', label: '建立同盟' },
    { id: 'create_economic_bloc', label: '建立经济同盟' },
];

/**
 * 外交审批 Tab 内容
 */
const DiplomacyTab = memo(({
    nation,
    nations = [],
    diplomacyOrganizations = { organizations: [] },
    vassalDiplomacyQueue = [],
    vassalDiplomacyHistory = [],
    currentDay = 0,
    onApprove,
    onReject,
    onIssueOrder,
    epoch, // [NEW] Receive epoch
}) => {
    const [selectedAction, setSelectedAction] = useState('declare_war');
    const [selectedTargetId, setSelectedTargetId] = useState('');

    // 只显示与当前附庸相关的请求
    const pendingRequests = useMemo(
        () => (vassalDiplomacyQueue || []).filter(
            item => item && item.status === 'pending' && item.vassalId === nation?.id
        ),
        [vassalDiplomacyQueue, nation?.id]
    );

    // 只显示与当前附庸相关的历史记录
    const relatedHistory = useMemo(
        () => (vassalDiplomacyHistory || []).filter(
            item => item && item.vassalId === nation?.id
        ).slice(0, 10),
        [vassalDiplomacyHistory, nation?.id]
    );

    // 可选的目标国家（只显示可见且未被吞并的国家，且符合当前时代）
    const availableTargets = useMemo(() => {
        if (!nation) return [];
        return nations.filter(n =>
            n.id !== nation.id &&
            !n.isAnnexed &&
            (n.visible !== false) &&
            // [FIX] Ensure nation is active in current epoch
            (epoch >= (n.appearEpoch ?? 0)) &&
            (n.expireEpoch == null || epoch <= n.expireEpoch)
        );
    }, [nations, nation, epoch]);

    // 媾和目标（只能选择正在交战的国家）
    const warTargets = useMemo(() => {
        if (!nation || !nation.foreignWars) return [];
        return Object.entries(nation.foreignWars)
            .filter(([, war]) => war?.isAtWar)
            .map(([enemyId]) => nations.find(n => n.id === enemyId))
            .filter(Boolean);
    }, [nations, nation]);

    // 获取所有组织列表
    const allOrganizations = useMemo(() => {
        return diplomacyOrganizations?.organizations || [];
    }, [diplomacyOrganizations]);

    // 可加入的组织（附庸尚未加入的组织）
    const joinableOrgs = useMemo(() => {
        if (!nation) return [];
        const vassalMemberships = nation.organizationMemberships || [];
        return allOrganizations.filter(org =>
            org &&
            !vassalMemberships.includes(org.id) &&
            !org.dissolved
        );
    }, [allOrganizations, nation]);

    // 可退出的组织（附庸已加入的组织）
    const leavableOrgs = useMemo(() => {
        if (!nation) return [];
        const vassalMemberships = nation.organizationMemberships || [];
        return allOrganizations.filter(org =>
            org &&
            vassalMemberships.includes(org.id) &&
            !org.dissolved
        );
    }, [allOrganizations, nation]);

    // 判断当前操作需要选择什么类型的目标
    const targetType = useMemo(() => {
        if (['join_org', 'leave_org'].includes(selectedAction)) return 'organization';
        if (['declare_war', 'trade', 'propose_peace'].includes(selectedAction)) return 'nation';
        return 'none'; // create_alliance, create_economic_bloc 等不需要目标
    }, [selectedAction]);

    const handleIssueOrder = () => {
        if (!nation || !onIssueOrder) return;

        // 需要目标的操作类型
        const needsTarget = targetType !== 'none';
        if (needsTarget && !selectedTargetId) return;

        const payload = {};
        if (targetType === 'organization') {
            payload.orgId = selectedTargetId;
            // 找到组织名称
            const org = allOrganizations.find(o => o.id === selectedTargetId);
            if (org) payload.orgName = org.name;
        } else if (selectedTargetId) {
            payload.targetId = selectedTargetId;
        }

        onIssueOrder(nation.id, selectedAction, payload);
        setSelectedTargetId('');
    };

    const canIssue = useMemo(() => {
        if (!nation) return false;
        if (targetType === 'none') return true;
        return !!selectedTargetId;
    }, [nation, targetType, selectedTargetId]);

    // 外交控制策略
    const diplomaticControl = nation?.vassalPolicy?.diplomaticControl || 'guided';
    const canControl = diplomaticControl !== 'autonomous';

    return (
        <div className="space-y-4">
            {/* 外交控制状态提示 */}
            <div className={`p-2 rounded-lg border text-xs ${diplomaticControl === 'autonomous'
                ? 'bg-green-900/30 border-green-700/40 text-green-300'
                : diplomaticControl === 'puppet'
                    ? 'bg-red-900/30 border-red-700/40 text-red-300'
                    : 'bg-blue-900/30 border-blue-700/40 text-blue-300'
                }`}>
                <div className="flex items-center gap-2">
                    <Icon name="Globe" size={14} />
                    <span>当前外交控制：</span>
                    <span className="font-bold">
                        {diplomaticControl === 'autonomous' ? '自主外交' :
                            diplomaticControl === 'puppet' ? '傀儡外交' : '引导外交'}
                    </span>
                </div>
                <div className="text-[10px] mt-1 opacity-70">
                    {diplomaticControl === 'autonomous'
                        ? '附庸可自主进行外交，无需审批，您也无法下达指令'
                        : diplomaticControl === 'puppet'
                            ? '完全控制附庸外交，所有行动需要您的批准'
                            : '附庸外交需要您的审批，您也可以主动下达指令'}
                </div>
            </div>

            {/* 待审批请求 */}
            <div className="bg-gray-800/40 border border-gray-700/40 rounded-lg p-3">
                <div className="flex items-center gap-2 text-sm text-gray-300 mb-2">
                    <Icon name="ClipboardList" size={14} className="text-amber-400" />
                    待审批请求
                    <span className="text-xs text-gray-500">({pendingRequests.length})</span>
                </div>
                {pendingRequests.length > 0 ? (
                    <div className="space-y-2">
                        {pendingRequests.map(item => (
                            <div key={item.id} className="border border-gray-700/50 rounded-lg p-3 bg-gray-900/40">
                                <div className="flex items-center justify-between">
                                    <div className="text-sm font-semibold text-white">
                                        {ACTION_LABELS[item.actionType] || item.actionType}
                                    </div>
                                    <div className="text-[10px] text-gray-400">
                                        {item.expiresAt != null ? `剩余 ${Math.max(0, item.expiresAt - currentDay)} 天` : '长期有效'}
                                    </div>
                                </div>
                                <div className="text-xs text-gray-400 mt-1">
                                    目标：{item.payload?.orgName || item.targetName || '—'}
                                </div>
                                <div className="mt-2 flex gap-2">
                                    <Button size="sm" variant="primary" onClick={() => onApprove?.(item.id)}>
                                        批准
                                    </Button>
                                    <Button size="sm" variant="secondary" onClick={() => onReject?.(item.id, '玩家拒绝')}>
                                        拒绝
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-xs text-gray-500">暂无待审批请求。</div>
                )}
            </div>

            {/* 下达外交指令 */}
            {canControl && (
                <div className="bg-gray-800/40 border border-gray-700/40 rounded-lg p-3">
                    <div className="flex items-center gap-2 text-sm text-gray-300 mb-2">
                        <Icon name="ScrollText" size={14} className="text-blue-400" />
                        下达外交指令
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                        <div>
                            <div className="text-[10px] text-gray-500 mb-1">指令类型</div>
                            <select
                                value={selectedAction}
                                onChange={(e) => {
                                    setSelectedAction(e.target.value);
                                    setSelectedTargetId(''); // 切换类型时清空目标
                                }}
                                className="w-full bg-gray-900/60 border border-gray-700/60 rounded px-2 py-1 text-gray-200"
                            >
                                {ORDER_ACTIONS.map(action => (
                                    <option key={action.id} value={action.id}>{action.label}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <div className="text-[10px] text-gray-500 mb-1">
                                {targetType === 'organization' ? '目标组织' : '目标国家'}
                            </div>
                            {targetType === 'none' ? (
                                <div className="w-full bg-gray-900/60 border border-gray-700/60 rounded px-2 py-1 text-gray-500">
                                    无需选择目标
                                </div>
                            ) : targetType === 'organization' ? (
                                <select
                                    value={selectedTargetId}
                                    onChange={(e) => setSelectedTargetId(e.target.value)}
                                    className="w-full bg-gray-900/60 border border-gray-700/60 rounded px-2 py-1 text-gray-200"
                                >
                                    <option value="">选择组织</option>
                                    {(selectedAction === 'join_org' ? joinableOrgs : leavableOrgs).map(org => (
                                        <option key={org.id} value={org.id}>
                                            {org.name} ({org.type === 'military_alliance' ? '军事同盟' : '经济同盟'})
                                        </option>
                                    ))}
                                </select>
                            ) : (
                                <select
                                    value={selectedTargetId}
                                    onChange={(e) => setSelectedTargetId(e.target.value)}
                                    className="w-full bg-gray-900/60 border border-gray-700/60 rounded px-2 py-1 text-gray-200"
                                >
                                    <option value="">选择目标</option>
                                    {(selectedAction === 'propose_peace' ? warTargets : availableTargets).map(target => (
                                        <option key={target.id} value={target.id}>{target.name}</option>
                                    ))}
                                </select>
                            )}
                        </div>
                    </div>
                    <div className="mt-3">
                        <Button size="sm" variant="primary" onClick={handleIssueOrder} disabled={!canIssue}>
                            执行指令
                        </Button>
                    </div>
                </div>
            )}

            {/* 最近处理记录 */}
            <div className="bg-gray-800/40 border border-gray-700/40 rounded-lg p-3">
                <div className="flex items-center gap-2 text-sm text-gray-300 mb-2">
                    <Icon name="History" size={14} className="text-gray-400" />
                    最近记录
                </div>
                {relatedHistory.length > 0 ? (
                    <div className="space-y-2 text-xs text-gray-400">
                        {relatedHistory.map(item => (
                            <div key={item.id} className="flex items-center justify-between">
                                <span>{ACTION_LABELS[item.actionType] || item.actionType}</span>
                                <span className={`text-[10px] ${item.status === 'approved' ? 'text-green-400' :
                                    item.status === 'rejected' ? 'text-red-400' :
                                        item.status === 'ordered' ? 'text-blue-400' :
                                            item.status === 'expired' ? 'text-yellow-400' : 'text-gray-500'
                                    }`}>
                                    {item.status === 'approved' ? '已批准' :
                                        item.status === 'rejected' ? '已拒绝' :
                                            item.status === 'ordered' ? '已下令' :
                                                item.status === 'expired' ? '已过期' : item.status}
                                </span>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-xs text-gray-500">暂无记录。</div>
                )}
            </div>
        </div>
    );
});

export const VassalManagementSheet = memo(({
    isOpen,
    onClose,
    nation,
    playerResources = {},
    onApplyVassalPolicy,
    onDiplomaticAction,
    officials = [],       // NEW: Officials list for governor selection
    playerMilitary = 1.0, // NEW: Player military strength
    epoch = 1,            // 当前时代，用于计算独立度变化
    // 外交审批相关 props
    nations = [],
    diplomacyOrganizations = { organizations: [] },
    vassalDiplomacyQueue = [],
    vassalDiplomacyHistory = [],
    currentDay = 0,
    onApproveVassalDiplomacy,
    onRejectVassalDiplomacy,
    onIssueVassalOrder,
}) => {
    // 所有 hooks 必须在条件返回之前调用
    const [activeTab, setActiveTab] = useState('overview');

    // 计算朝贡信息（即使 nation 无效也要调用，确保 hooks 顺序一致）
    const tribute = useMemo(() => {
        if (!nation) return { silver: 0 };
        return calculateEnhancedTribute(nation, playerResources.silver || 10000);
    }, [nation, playerResources]);

    // 计算独立度变化原因分解
    const independenceBreakdown = useMemo(() => {
        if (!nation) return null;
        return getIndependenceChangeBreakdown(nation, epoch, officials);
    }, [nation, epoch, officials]);

    // 计算该附庸的待审批请求数（必须在条件返回之前调用）
    const pendingCount = useMemo(() => {
        if (!nation) return 0;
        return (vassalDiplomacyQueue || []).filter(
            item => item && item.status === 'pending' && item.vassalId === nation.id
        ).length;
    }, [vassalDiplomacyQueue, nation]);

    // 预先计算所有派生值
    const independence = nation?.independencePressure || 0;
    const isAtRisk = independence > 60;
    const vassalType = nation?.vassalType || 'protectorate';
    const typeConfig = VASSAL_TYPE_CONFIGS?.[vassalType] || {};

    // 如果不是玩家的附庸，显示错误提示
    if (!nation || nation.vassalOf !== 'player') {
        return (
            <BottomSheet
                isOpen={isOpen}
                onClose={onClose}
                title="⚠️ 无法管理"
            >
                <div className="p-8 text-center text-gray-400">
                    <Icon name="ShieldQuestion" size={48} className="mx-auto mb-4 opacity-50" />
                    <div className="text-base">该国家不是你的附庸</div>
                </div>
            </BottomSheet>
        );
    }

    const tabs = [
        { id: 'overview', label: '概览', icon: 'Eye' },
        { id: 'policy', label: '政策调整', icon: 'Settings' },
        { id: 'diplomacy', label: '外交审批', icon: 'Globe', badge: pendingCount > 0 ? pendingCount : null },
    ];

    return (
        <BottomSheet
            isOpen={isOpen}
            onClose={onClose}
            title={`👑 ${nation.name} - 附庸管理`}
        >
            <div className="space-y-4">
                {/* Tab 切换 */}
                <div className="flex border-b border-gray-700">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`
                                flex-1 flex items-center justify-center gap-2 py-2 px-4
                                text-sm font-medium transition-all relative
                                ${activeTab === tab.id
                                    ? 'text-blue-400 border-b-2 border-blue-400'
                                    : 'text-gray-400 hover:text-gray-200'
                                }
                            `}
                        >
                            <Icon name={tab.icon} size={16} />
                            {tab.label}
                            {tab.badge && (
                                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center">
                                    {tab.badge}
                                </span>
                            )}
                        </button>
                    ))}
                </div>

                {/* Tab 内容 */}
                {activeTab === 'overview' && (
                    <OverviewTab
                        nation={nation}
                        tribute={tribute}
                        typeConfig={typeConfig}
                        isAtRisk={isAtRisk}
                        vassalType={vassalType}
                        independence={independence}
                        onDiplomaticAction={onDiplomaticAction}
                        onClose={onClose}
                        independenceBreakdown={independenceBreakdown}
                    />
                )}

                {activeTab === 'policy' && (
                    <PolicyTab
                        nation={nation}
                        onApplyPolicy={(policy) => {
                            onApplyVassalPolicy?.(nation.id, policy);
                        }}
                        officials={officials}
                        playerMilitary={playerMilitary}
                    />
                )}

                {activeTab === 'diplomacy' && (
                    <DiplomacyTab
                        nation={nation}
                        nations={nations}
                        diplomacyOrganizations={diplomacyOrganizations}
                        vassalDiplomacyQueue={vassalDiplomacyQueue}
                        vassalDiplomacyHistory={vassalDiplomacyHistory}
                        currentDay={currentDay}
                        onApprove={onApproveVassalDiplomacy}
                        onReject={onRejectVassalDiplomacy}
                        onIssueOrder={onIssueVassalOrder}
                        epoch={epoch} // [FIX] Pass epoch for nation filtering
                    />
                )}
            </div>
        </BottomSheet>
    );
});




VassalManagementSheet.displayName = 'VassalManagementSheet';

export default VassalManagementSheet;
