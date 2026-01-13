/**
 * 附庸管理面板 (Bottom Sheet)
 * 用于管理单个附庸国家的详细设置
 * 包含概览和政策调整两个Tab
 */

import React, { useState, useMemo, memo } from 'react';
import { BottomSheet } from '../tabs/BottomSheet';
import { Icon } from '../common/UIComponents';
import { Button } from '../common/UnifiedUI';
import { formatNumberShortCN } from '../../utils/numberFormat';
import { VASSAL_TYPE_LABELS, VASSAL_TYPE_CONFIGS, getAutonomyEffects } from '../../config/diplomacy';
import { calculateEnhancedTribute } from '../../logic/diplomacy/vassalSystem';

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
            <div className={`w-3 h-3 rounded-full border-2 ${
                selected ? 'border-blue-400 bg-blue-400' : 'border-gray-500'
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
    </button>
));

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

/**
 * 自主度效果展示
 */
const AutonomyEffectsDisplay = memo(({ autonomy }) => {
    const effects = getAutonomyEffects(autonomy);
    
    return (
        <div className="bg-gray-800/50 rounded-lg p-2 mt-2">
            <div className="text-xs text-gray-400 mb-1">当前自主度权限：</div>
            <div className="grid grid-cols-2 gap-1 text-xs">
                <div className={`flex items-center gap-1 ${effects.canDeclareWar ? 'text-green-400' : 'text-red-400'}`}>
                    <Icon name={effects.canDeclareWar ? 'Check' : 'X'} size={12} />
                    <span>自主宣战</span>
                </div>
                <div className={`flex items-center gap-1 ${effects.canSignTreaties ? 'text-green-400' : 'text-red-400'}`}>
                    <Icon name={effects.canSignTreaties ? 'Check' : 'X'} size={12} />
                    <span>签署条约</span>
                </div>
                <div className={`flex items-center gap-1 ${effects.canSetTariffs ? 'text-green-400' : 'text-red-400'}`}>
                    <Icon name={effects.canSetTariffs ? 'Check' : 'X'} size={12} />
                    <span>设置关税</span>
                </div>
                <div className="flex items-center gap-1 text-gray-300">
                    <Icon name="Percent" size={12} />
                    <span>朝贡减免 {((1 - effects.tributeReduction) * 100).toFixed(0)}%</span>
                </div>
            </div>
        </div>
    );
});

// 外交控制政策选项
const DIPLOMATIC_CONTROL_OPTIONS = [
    {
        id: 'autonomous',
        title: '自主外交',
        description: '允许附庸自主进行外交活动',
        effects: '自主度+10/年，独立倾向-5/年',
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
        title: '傀儡外交',
        description: '完全控制附庸的外交行为',
        effects: '自主度-5/年，独立倾向+3/年',
        effectColor: 'text-red-400',
    },
];

// 贸易政策选项
const TRADE_POLICY_OPTIONS = [
    {
        id: 'free',
        title: '自由贸易',
        description: '附庸可与任何国家自由贸易',
        effects: '贸易收益-20%，独立倾向-5/年',
        effectColor: 'text-green-400',
    },
    {
        id: 'preferential',
        title: '优惠准入',
        description: '你的商人享有优先贸易权',
        effects: '维持现状（默认）',
        effectColor: 'text-gray-400',
    },
    {
        id: 'monopoly',
        title: '垄断贸易',
        description: '强制所有贸易通过你的商人',
        effects: '贸易收益+30%，独立倾向+10/年',
        effectColor: 'text-red-400',
    },
];

// 控制手段选项
const CONTROL_MEASURES = [
    {
        id: 'governor',
        title: '派遣总督',
        icon: 'UserCheck',
        description: '派遣一名总督管理附庸内政',
        effects: '独立倾向-0.2/天',
        effectColor: 'text-blue-400',
        dailyCost: 50,
    },
    {
        id: 'garrison',
        title: '驻军占领',
        icon: 'Shield',
        description: '在附庸境内驻扎军队',
        effects: '独立倾向-0.5/天',
        effectColor: 'text-red-400',
        dailyCost: 100,
    },
    {
        id: 'cultural',
        title: '文化同化',
        icon: 'BookOpen',
        description: '推广本国文化和语言',
        effects: '长期降低独立上限',
        effectColor: 'text-purple-400',
        dailyCost: 30,
    },
    {
        id: 'economic_aid',
        title: '经济扶持',
        icon: 'DollarSign',
        description: '提供经济援助改善民生',
        effects: '提升民众满意度',
        effectColor: 'text-green-400',
        dailyCost: 80,
    },
];

// ==================== Tab 内容组件 ====================

/**
 * 概览 Tab 内容
 */
const OverviewTab = memo(({ nation, tribute, typeConfig, isAtRisk, vassalType, autonomy, independence, onDiplomaticAction, onClose }) => (
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
        <div className="grid grid-cols-2 gap-3">
            {/* 自治度 */}
            <div className="p-4 bg-gray-800/50 rounded-lg border border-gray-700/40">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-gray-400 uppercase tracking-wider">自治度</span>
                    <span className="text-xl font-bold text-purple-300 font-mono">
                        {Math.round(autonomy)}%
                    </span>
                </div>
                <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-purple-500 transition-all duration-300"
                        style={{ width: `${autonomy}%` }}
                    />
                </div>
                <div className="text-[10px] text-gray-500 mt-1">
                    {autonomy > 70 ? '高度自治' : autonomy > 40 ? '中等控制' : '严密控制'}
                </div>
            </div>

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
            </div>
        </div>

        {/* 朝贡信息 */}
        <div className="p-4 bg-amber-900/20 rounded-lg border border-amber-700/40">
            <div className="flex items-center gap-2 mb-3">
                <Icon name="Coins" size={18} className="text-amber-400" />
                <span className="text-amber-200 font-semibold">朝贡收入</span>
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <div className="text-xs text-gray-400">月朝贡</div>
                    <div className="text-lg font-bold text-amber-300">
                        +{formatNumberShortCN(tribute.silver || 0)} 银
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
                    <span className="text-gray-400">军事通行:</span>
                    <span className={typeConfig.militaryAccess ? 'text-green-400' : 'text-red-400'}>
                        {typeConfig.militaryAccess ? '允许' : '不允许'}
                    </span>
                </div>
                <div className="flex justify-between">
                    <span className="text-gray-400">外交自主:</span>
                    <span className={typeConfig.diplomaticAutonomy ? 'text-yellow-400' : 'text-green-400'}>
                        {typeConfig.diplomaticAutonomy ? '独立' : '跟随宗主'}
                    </span>
                </div>
            </div>
        </div>

        {/* 释放附庸按钮 */}
        <Button
            onClick={() => {
                onDiplomaticAction?.(nation.id, 'release_vassal');
                onClose();
            }}
            variant="danger"
            className="w-full"
        >
            <Icon name="Unlock" size={16} className="mr-2" />
            释放附庸
        </Button>

        {/* 提示 */}
        {isAtRisk && (
            <div className="p-3 bg-red-900/30 rounded-lg border border-red-700/40 text-center">
                <div className="text-xs text-red-300">
                    ⚠️ 该附庸国独立倾向过高，可能随时发动独立战争！
                </div>
                <div className="text-[10px] text-red-400/70 mt-1">
                    建议：降低朝贡率、提高自治度或军事镇压
                </div>
            </div>
        )}
    </div>
));

/**
 * 政策调整 Tab 内容
 */
const PolicyTab = memo(({ nation, onApplyPolicy }) => {
    // 获取附庸配置
    const vassalConfig = VASSAL_TYPE_CONFIGS[nation?.vassalType] || {};
    const baseAutonomy = vassalConfig.autonomy || 50;
    const baseTributeRate = vassalConfig.tributeRate || 0.1;
    
    // 政策状态
    const [diplomaticControl, setDiplomaticControl] = useState(
        nation?.vassalPolicy?.diplomaticControl || 'guided'
    );
    const [tradePolicy, setTradePolicy] = useState(
        nation?.vassalPolicy?.tradePolicy || 'preferential'
    );
    const [autonomy, setAutonomy] = useState(nation?.autonomy || baseAutonomy);
    const [tributeRate, setTributeRate] = useState(
        (nation?.tributeRate || baseTributeRate) * 100
    );
    
    // 控制手段状态（多选）
    const [activeControlMeasures, setActiveControlMeasures] = useState(
        nation?.vassalPolicy?.controlMeasures || []
    );
    
    // 切换控制手段
    const toggleControlMeasure = (measureId) => {
        setActiveControlMeasures(prev => 
            prev.includes(measureId) 
                ? prev.filter(id => id !== measureId)
                : [...prev, measureId]
        );
    };
    
    // 计算控制手段总成本
    const totalControlCost = useMemo(() => {
        return activeControlMeasures.reduce((sum, measureId) => {
            const measure = CONTROL_MEASURES.find(m => m.id === measureId);
            return sum + (measure?.dailyCost || 0);
        }, 0);
    }, [activeControlMeasures]);
    
    // 计算预估朝贡收入
    const estimatedTribute = useMemo(() => {
        const gdp = nation?.gdp || 10000;
        return gdp * (tributeRate / 100);
    }, [nation?.gdp, tributeRate]);
    
    // 应用政策
    const handleApply = () => {
        onApplyPolicy?.({
            diplomaticControl,
            tradePolicy,
            autonomy,
            tributeRate: tributeRate / 100,
            controlMeasures: activeControlMeasures,
            controlCostPerDay: totalControlCost,
        });
    };
    
    // 重置为默认
    const handleReset = () => {
        setDiplomaticControl('guided');
        setTradePolicy('preferential');
        setAutonomy(baseAutonomy);
        setTributeRate(baseTributeRate * 100);
        setActiveControlMeasures([]);
    };
    
    return (
        <div className="space-y-4">
            {/* 外交控制 */}
            <div>
                <h3 className="text-sm font-bold text-white mb-2 flex items-center gap-1.5">
                    <Icon name="Globe" size={14} className="text-blue-400" />
                    外交控制
                </h3>
                <div className="space-y-2">
                    {DIPLOMATIC_CONTROL_OPTIONS.map(option => (
                        <PolicyOptionCard
                            key={option.id}
                            selected={diplomaticControl === option.id}
                            title={option.title}
                            description={option.description}
                            effects={option.effects}
                            effectColor={option.effectColor}
                            onClick={() => setDiplomaticControl(option.id)}
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
                            onClick={() => setTradePolicy(option.id)}
                        />
                    ))}
                </div>
            </div>
            
            {/* 自主度调整 */}
            <div>
                <h3 className="text-sm font-bold text-white mb-2 flex items-center gap-1.5">
                    <Icon name="Sliders" size={14} className="text-cyan-400" />
                    自主度调整
                </h3>
                <div className="bg-gray-800/30 rounded-lg p-3 border border-gray-700/50">
                    <SliderControl
                        label="自主度"
                        value={autonomy}
                        onChange={setAutonomy}
                        min={Math.floor(baseAutonomy * 0.5)}
                        max={Math.min(100, Math.floor(baseAutonomy * 1.2))}
                        format={(v) => `${Math.round(v)}%`}
                        description={`基准值：${baseAutonomy}%`}
                        warningThreshold={baseAutonomy * 0.7}
                        warningText="过低的自主度会增加独立倾向"
                    />
                    <AutonomyEffectsDisplay autonomy={autonomy} />
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
            
            {/* 控制手段 */}
            <div>
                <h3 className="text-sm font-bold text-white mb-2 flex items-center gap-1.5">
                    <Icon name="Target" size={14} className="text-orange-400" />
                    控制手段
                    {totalControlCost > 0 && (
                        <span className="text-xs text-amber-400 ml-2">
                            (每日成本: {totalControlCost} 银币)
                        </span>
                    )}
                </h3>
                <div className="grid grid-cols-2 gap-2">
                    {CONTROL_MEASURES.map(measure => {
                        const isActive = activeControlMeasures.includes(measure.id);
                        return (
                            <button
                                key={measure.id}
                                onClick={() => toggleControlMeasure(measure.id)}
                                className={`
                                    p-2 rounded-lg border transition-all text-left
                                    ${isActive 
                                        ? 'border-orange-500 bg-orange-900/30' 
                                        : 'border-gray-600/50 bg-gray-800/30 hover:bg-gray-700/30'
                                    }
                                `}
                            >
                                <div className="flex items-center gap-2 mb-1">
                                    <Icon 
                                        name={measure.icon} 
                                        size={14} 
                                        className={isActive ? 'text-orange-400' : 'text-gray-400'} 
                                    />
                                    <span className={`text-xs font-bold ${isActive ? 'text-white' : 'text-gray-300'}`}>
                                        {measure.title}
                                    </span>
                                </div>
                                <p className="text-[10px] text-gray-400">{measure.description}</p>
                                <div className="flex items-center justify-between mt-1">
                                    <span className={`text-[10px] ${measure.effectColor}`}>{measure.effects}</span>
                                    <span className="text-[10px] text-amber-300">{measure.dailyCost}/天</span>
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>
            
            {/* 底部操作按钮 */}
            <div className="flex items-center justify-between pt-2 border-t border-gray-700">
                <button
                    onClick={handleReset}
                    className="px-3 py-1.5 text-sm text-gray-400 hover:text-white transition-colors"
                >
                    重置为默认
                </button>
                <button
                    onClick={handleApply}
                    className="px-4 py-1.5 text-sm rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-colors"
                >
                    应用政策
                </button>
            </div>
        </div>
    );
});

// ==================== 主组件 ====================

/**
 * 附庸管理 Bottom Sheet
 */
export const VassalManagementSheet = memo(({
    isOpen,
    onClose,
    nation,
    playerResources = {},
    onApplyVassalPolicy,
    onDiplomaticAction,
}) => {
    // 所有 hooks 必须在条件返回之前调用
    const [activeTab, setActiveTab] = useState('overview');
    
    // 计算朝贡信息（即使 nation 无效也要调用，确保 hooks 顺序一致）
    const tribute = useMemo(() => {
        if (!nation) return { silver: 0 };
        return calculateEnhancedTribute(nation, playerResources.silver || 10000);
    }, [nation, playerResources]);

    // 预先计算所有派生值
    const independence = nation?.independencePressure || 0;
    const autonomy = nation?.autonomy || 0;
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
                                text-sm font-medium transition-all
                                ${activeTab === tab.id
                                    ? 'text-blue-400 border-b-2 border-blue-400'
                                    : 'text-gray-400 hover:text-gray-200'
                                }
                            `}
                        >
                            <Icon name={tab.icon} size={16} />
                            {tab.label}
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
                        autonomy={autonomy}
                        independence={independence}
                        onDiplomaticAction={onDiplomaticAction}
                        onClose={onClose}
                    />
                )}
                
                {activeTab === 'policy' && (
                    <PolicyTab
                        nation={nation}
                        onApplyPolicy={(policy) => {
                            onApplyVassalPolicy?.(nation.id, policy);
                        }}
                    />
                )}
            </div>
        </BottomSheet>
    );
});

VassalManagementSheet.displayName = 'VassalManagementSheet';

export default VassalManagementSheet;
