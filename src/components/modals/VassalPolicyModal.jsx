/**
 * 附庸政策调整模态框
 * 允许玩家调整附庸国的外交控制、贸易政策、自主度和朝贡率
 */
import React, { useState, useMemo, memo } from 'react';
import { Icon } from '../common/UIComponents';
import { VASSAL_TYPE_CONFIGS, VASSAL_TYPE_LABELS, getAutonomyEffects, INDEPENDENCE_CONFIG } from '../../config/diplomacy';
import { formatNumberShortCN } from '../../utils/numberFormat';
import { calculateControlMeasureCost, checkGarrisonEffectiveness, calculateGovernorEffectiveness } from '../../logic/diplomacy/vassalSystem';

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
            <span className={`text-sm font-bold ${selected ? 'text-white' : 'text-gray-300'} font-decorative`}>
                {title}
            </span>
        </div>
        {description && (
            <p className="text-xs text-gray-400 ml-5 font-body">{description}</p>
        )}
        {effects && (
            <p className={`text-xs ml-5 mt-0.5 font-body ${effectColor}`}>{effects}</p>
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
                <span className="text-sm text-gray-300 font-body">{label}</span>
                <span className={`text-sm font-mono font-epic ${showWarning ? 'text-yellow-400' : 'text-white'}`}>
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
                    [&::-webkit-slider-thumb]:hover:bg-blue-400
                "
                style={{
                    background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${percentage}%, #374151 ${percentage}%, #374151 100%)`
                }}
            />
            {description && (
                <p className="text-xs text-gray-500 font-body">{description}</p>
            )}
            {showWarning && warningText && (
                <p className="text-xs text-yellow-400 flex items-center gap-1 font-body">
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
            <div className="text-xs text-gray-400 mb-1 font-body">当前自主度权限：</div>
            <div className="grid grid-cols-2 gap-1 text-xs">
                <div className={`flex items-center gap-1 ${effects.canDeclareWar ? 'text-green-400' : 'text-red-400'}`}>
                    <Icon name={effects.canDeclareWar ? 'Check' : 'X'} size={12} />
                    <span className="font-body">自主宣战</span>
                </div>
                <div className={`flex items-center gap-1 ${effects.canSignTreaties ? 'text-green-400' : 'text-red-400'}`}>
                    <Icon name={effects.canSignTreaties ? 'Check' : 'X'} size={12} />
                    <span className="font-body">签署条约</span>
                </div>
                <div className={`flex items-center gap-1 ${effects.canSetTariffs ? 'text-green-400' : 'text-red-400'}`}>
                    <Icon name={effects.canSetTariffs ? 'Check' : 'X'} size={12} />
                    <span className="font-body">设置关税</span>
                </div>
                <div className="flex items-center gap-1 text-gray-300">
                    <Icon name="Percent" size={12} />
                    <span className="font-body">朝贡减免 {((1 - effects.tributeReduction) * 100).toFixed(0)}%</span>
                </div>
            </div>
        </div>
    );
});

/**
 * 外交控制政策选项
 */
const DIPLOMATIC_CONTROL_OPTIONS = [
    {
        id: 'autonomous',
        title: '自主外交',
        description: '允许附庸自主进行外交活动',
        effects: '自主度+10/年，独立倾向-5/年',
        effectColor: 'text-green-400',
        autonomyChange: 10,
        independenceChange: -5,
    },
    {
        id: 'guided',
        title: '引导外交',
        description: '附庸外交需经过你的审批',
        effects: '维持现状（默认）',
        effectColor: 'text-gray-400',
        autonomyChange: 0,
        independenceChange: 0,
    },
    {
        id: 'puppet',
        title: '傀儡外交',
        description: '完全控制附庸的外交行为',
        effects: '自主度-5/年，独立倾向+3/年',
        effectColor: 'text-red-400',
        autonomyChange: -5,
        independenceChange: 3,
    },
];

/**
 * 贸易政策选项
 */
const TRADE_POLICY_OPTIONS = [
    {
        id: 'free',
        title: '自由贸易',
        description: '附庸可与任何国家自由贸易',
        effects: '贸易收益-20%，独立倾向-5/年',
        effectColor: 'text-green-400',
        profitChange: -0.2,
        independenceChange: -5,
    },
    {
        id: 'preferential',
        title: '优惠准入',
        description: '你的商人享有优先贸易权',
        effects: '维持现状（默认）',
        effectColor: 'text-gray-400',
        profitChange: 0,
        independenceChange: 0,
    },
    {
        id: 'monopoly',
        title: '垄断贸易',
        description: '强制所有贸易通过你的商人',
        effects: '贸易收益+30%，独立倾向+10/年',
        effectColor: 'text-red-400',
        profitChange: 0.3,
        independenceChange: 10,
    },
];

/**
 * 控制手段选项 (REVAMPED with dynamic costs)
 */
const CONTROL_MEASURES = [
    {
        id: 'governor',
        title: '派遣总督',
        icon: 'UserCheck',
        description: '派遣一名官员担任总督管理附庸内政',
        effects: '效果基于官员能力',
        effectColor: 'text-blue-400',
        requiresOfficial: true,
    },
    {
        id: 'garrison',
        title: '驻军占领',
        icon: 'Shield',
        description: '在附庸境内驻扎军队（需要足够军力）',
        effects: '独立倾向-0.5/天，平民满意度-3',
        effectColor: 'text-red-400',
        requiresMilitary: true,
    },
    {
        id: 'assimilation',
        title: '文化同化',
        icon: 'BookOpen',
        description: '推广本国文化和语言',
        effects: '独立倾向上限-0.05/天（长期）',
        effectColor: 'text-purple-400',
    },
    {
        id: 'economicAid',
        title: '经济扶持',
        icon: 'DollarSign',
        description: '提供经济援助改善民生',
        effects: '平民满意度+3，下层满意度+5，独立倾向-0.1',
        effectColor: 'text-green-400',
    },
];

/**
 * Official Selector Component for Governor Assignment
 */
const OfficialSelector = memo(({
    officials = [],
    selectedOfficialId,
    onSelect,
    measureConfig,
}) => {
    const availableOfficials = useMemo(() => {
        // Filter officials that can be assigned (not busy, etc.)
        return officials.filter(o => o && !o.isBusy);
    }, [officials]);

    const selectedOfficial = useMemo(() => {
        return officials.find(o => o?.id === selectedOfficialId);
    }, [officials, selectedOfficialId]);

    // Calculate projected effectiveness if an official is selected
    const effectiveness = useMemo(() => {
        if (!selectedOfficial) return null;
        return calculateGovernorEffectiveness(selectedOfficial, measureConfig);
    }, [selectedOfficial, measureConfig]);

    return (
        <div className="space-y-2">
            <label className="text-xs text-gray-400 font-body">选择总督官员</label>
            <select
                value={selectedOfficialId || ''}
                onChange={(e) => onSelect(e.target.value || null)}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-sm text-white focus:border-blue-500 focus:outline-none"
            >
                <option value="">-- 选择官员 --</option>
                {availableOfficials.map(official => (
                    <option key={official.id} value={official.id}>
                        {official.name} (威望:{official.prestige || 50} 忠诚:{official.loyalty || 50})
                    </option>
                ))}
            </select>
            
            {selectedOfficial && effectiveness && (
                <div className="bg-gray-900/50 rounded p-2 space-y-1">
                    <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-400">官员</span>
                        <span className="text-white font-medium">{effectiveness.officialName}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-400">威望/忠诚</span>
                        <span className="text-blue-400">{effectiveness.officialPrestige} / {effectiveness.officialLoyalty}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-400">预计效能</span>
                        <span className={`${effectiveness.effectiveness > 0.7 ? 'text-green-400' : effectiveness.effectiveness > 0.4 ? 'text-yellow-400' : 'text-red-400'}`}>
                            {(effectiveness.effectiveness * 100).toFixed(0)}%
                        </span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-400">独立倾向减少</span>
                        <span className="text-green-400">-{effectiveness.independenceReduction.toFixed(2)}/天</span>
                    </div>
                    {effectiveness.loyaltyRisk && (
                        <div className="flex items-center gap-1 text-xs text-yellow-400 mt-1">
                            <Icon name="AlertTriangle" size={10} />
                            <span>警告: 低忠诚度官员可能引发问题</span>
                        </div>
                    )}
                </div>
            )}
            
            {availableOfficials.length === 0 && (
                <div className="text-xs text-yellow-400 flex items-center gap-1">
                    <Icon name="AlertCircle" size={12} />
                    <span>没有可用的官员，请先招募官员</span>
                </div>
            )}
        </div>
    );
});

/**
 * Garrison Military Check Component
 */
const GarrisonMilitaryCheck = memo(({
    playerMilitary = 1.0,
    vassalMilitary = 0.5,
}) => {
    const check = checkGarrisonEffectiveness(playerMilitary, vassalMilitary);
    
    return (
        <div className={`bg-gray-900/50 rounded p-2 ${check.isEffective ? 'border-green-500/30' : 'border-red-500/30'} border`}>
            <div className="flex items-center justify-between text-xs">
                <span className="text-gray-400">军力要求</span>
                <span className={check.isEffective ? 'text-green-400' : 'text-red-400'}>
                    {check.requiredStrength.toFixed(1)} (当前: {playerMilitary.toFixed(1)})
                </span>
            </div>
            <div className="flex items-center justify-between text-xs mt-1">
                <span className="text-gray-400">状态</span>
                <span className={check.isEffective ? 'text-green-400' : 'text-red-400'}>
                    {check.isEffective ? '✓ 有效' : '✗ 军力不足 (仅20%效果)'}
                </span>
            </div>
        </div>
    );
});

/**
 * 附庸政策调整模态框主组件
 */
const VassalPolicyModalComponent = ({
    nation,
    onClose,
    onApply,
    officials = [],       // NEW: Officials list for governor selection
    playerMilitary = 1.0, // NEW: Player military strength
}) => {
    // 获取附庸配置
    const vassalConfig = VASSAL_TYPE_CONFIGS[nation?.vassalType] || {};
    const baseAutonomy = vassalConfig.autonomy || 50;
    const baseTributeRate = vassalConfig.tributeRate || 0.1;
    const vassalWealth = nation?.wealth || 500;
    const vassalMilitary = nation?.militaryStrength || 0.5;
    
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
    
    // 控制手段状态 (NEW: Object format with officialId support)
    const [controlMeasures, setControlMeasures] = useState(() => {
        const existing = nation?.vassalPolicy?.controlMeasures || {};
        const initial = {};
        CONTROL_MEASURES.forEach(m => {
            if (typeof existing[m.id] === 'boolean') {
                // Migrate from legacy boolean format
                initial[m.id] = { active: existing[m.id], officialId: null };
            } else if (existing[m.id]) {
                initial[m.id] = { ...existing[m.id] };
            } else {
                initial[m.id] = { active: false, officialId: null };
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
    
    // Get active control measure IDs
    const activeControlMeasures = useMemo(() => {
        return Object.entries(controlMeasures)
            .filter(([, data]) => data.active)
            .map(([id]) => id);
    }, [controlMeasures]);
    
    // 计算控制手段总成本 (NEW: Dynamic cost calculation)
    const totalControlCost = useMemo(() => {
        return activeControlMeasures.reduce((sum, measureId) => {
            return sum + calculateControlMeasureCost(measureId, vassalWealth);
        }, 0);
    }, [activeControlMeasures, vassalWealth]);
    
    // Calculate individual measure costs for display
    const measureCosts = useMemo(() => {
        const costs = {};
        CONTROL_MEASURES.forEach(m => {
            costs[m.id] = calculateControlMeasureCost(m.id, vassalWealth);
        });
        return costs;
    }, [vassalWealth]);
    
    // 计算控制手段带来的独立倾向变化
    const controlMeasuresIndependenceChange = useMemo(() => {
        let total = 0;
        activeControlMeasures.forEach(measureId => {
            const config = INDEPENDENCE_CONFIG.controlMeasures[measureId];
            if (config?.independenceReduction) {
                total -= config.independenceReduction * 365; // Annualized
            }
            if (config?.independenceCapReduction) {
                total -= config.independenceCapReduction * 365;
            }
        });
        // Apply governor effectiveness modifier if governor is selected
        if (controlMeasures.governor?.active && controlMeasures.governor?.officialId) {
            const official = officials.find(o => o.id === controlMeasures.governor.officialId);
            if (official) {
                const govConfig = INDEPENDENCE_CONFIG.controlMeasures.governor;
                const eff = calculateGovernorEffectiveness(official, govConfig);
                // Adjust for actual governor effectiveness
                total = total * (0.5 + eff.effectiveness * 0.5);
            }
        }
        return total;
    }, [activeControlMeasures, controlMeasures.governor, officials]);
    
    // 计算预估独立倾向变化
    const estimatedIndependenceChange = useMemo(() => {
        let change = 0;
        
        // 外交控制影响
        const dipOption = DIPLOMATIC_CONTROL_OPTIONS.find(o => o.id === diplomaticControl);
        if (dipOption) change += dipOption.independenceChange;
        
        // 贸易政策影响
        const tradeOption = TRADE_POLICY_OPTIONS.find(o => o.id === tradePolicy);
        if (tradeOption) change += tradeOption.independenceChange;
        
        // 朝贡率变化影响
        const tributeChange = (tributeRate / 100) - baseTributeRate;
        if (tributeChange > 0) change += tributeChange * 50;
        
        // 自主度变化影响
        const autonomyChange = autonomy - baseAutonomy;
        if (autonomyChange < 0) change += Math.abs(autonomyChange) * 0.3;
        
        // 控制手段影响
        change += controlMeasuresIndependenceChange;
        
        return change;
    }, [diplomaticControl, tradePolicy, autonomy, tributeRate, baseAutonomy, baseTributeRate, controlMeasuresIndependenceChange]);
    
    // 计算预估朝贡收入
    const estimatedTribute = useMemo(() => {
        const gdp = nation?.gdp || 10000;
        return gdp * (tributeRate / 100);
    }, [nation?.gdp, tributeRate]);
    
    // 应用政策
    const handleApply = () => {
        onApply?.({
            diplomaticControl,
            tradePolicy,
            autonomy,
            tributeRate: tributeRate / 100,
            controlMeasures,  // NEW: Pass full object with officialId
            controlCostPerDay: totalControlCost,
        });
        onClose?.();
    };
    
    // 重置为默认
    const handleReset = () => {
        setDiplomaticControl('guided');
        setTradePolicy('preferential');
        setAutonomy(baseAutonomy);
        setTributeRate(baseTributeRate * 100);
        const resetMeasures = {};
        CONTROL_MEASURES.forEach(m => {
            resetMeasures[m.id] = { active: false, officialId: null };
        });
        setControlMeasures(resetMeasures);
    };
    
    if (!nation) return null;
    
    return (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm">
            {/* Bottom Sheet Container */}
            <div 
                className="bg-gray-900 rounded-t-2xl border-t border-x border-gray-700 shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden animate-slide-up"
                style={{
                    animation: 'slideUp 0.3s ease-out'
                }}
            >
                {/* 拖动指示条 */}
                <div className="flex justify-center py-2">
                    <div className="w-12 h-1 bg-gray-600 rounded-full" />
                </div>
                
                {/* 标题栏 */}
                <div className="flex items-center justify-between px-4 py-2 border-b border-gray-700 bg-gray-800/50">
                    <div className="flex items-center gap-2">
                        <Icon name="Settings" size={18} className="text-purple-400" />
                        <h2 className="text-base font-bold text-white font-decorative">
                            附庸政策：{nation.name}
                        </h2>
                        <span className="text-xs px-2 py-0.5 rounded bg-purple-900/50 text-purple-300 font-body">
                            {VASSAL_TYPE_LABELS[nation.vassalType] || '附庸'}
                        </span>
                    </div>
                    <button 
                        onClick={onClose}
                        className="p-1.5 rounded-full hover:bg-gray-700 transition-colors"
                    >
                        <Icon name="X" size={18} className="text-gray-400" />
                    </button>
                </div>
                
                {/* 内容区 */}
                <div className="p-4 space-y-4 overflow-y-auto max-h-[calc(85vh-140px)]">
                    {/* 外交控制 */}
                    <div>
                        <h3 className="text-sm font-bold text-white mb-2 flex items-center gap-1.5 font-decorative">
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
                        <h3 className="text-sm font-bold text-white mb-2 flex items-center gap-1.5 font-decorative">
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
                        <h3 className="text-sm font-bold text-white mb-2 flex items-center gap-1.5 font-decorative">
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
                                description={`基准值：${baseAutonomy}%，可调范围：${Math.floor(baseAutonomy * 0.5)}%-${Math.min(100, Math.floor(baseAutonomy * 1.2))}%`}
                                warningThreshold={baseAutonomy * 0.7}
                                warningText="过低的自主度会增加独立倾向"
                            />
                            <AutonomyEffectsDisplay autonomy={autonomy} />
                        </div>
                    </div>
                    
                    {/* 朝贡率调整 */}
                    <div>
                        <h3 className="text-sm font-bold text-white mb-2 flex items-center gap-1.5 font-decorative">
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
                                description={`基准值：${Math.round(baseTributeRate * 100)}%，预计月收入：${formatNumberShortCN(estimatedTribute)}`}
                                warningThreshold={baseTributeRate * 120}
                                warningText="过高的朝贡率会增加独立倾向"
                            />
                        </div>
                    </div>
                    
                    {/* 控制手段 (REVAMPED) */}
                    <div>
                        <h3 className="text-sm font-bold text-white mb-2 flex items-center gap-1.5 font-decorative">
                            <Icon name="Target" size={14} className="text-orange-400" />
                            控制手段
                            {totalControlCost > 0 && (
                                <span className="text-xs text-amber-400 font-body ml-2">
                                    (每日成本: {formatNumberShortCN(totalControlCost)} 银币)
                                </span>
                            )}
                        </h3>
                        <p className="text-xs text-gray-500 mb-2">
                            成本基于附庸财富动态计算：基础成本 + 附庸财富 × 比例系数
                        </p>
                        <div className="grid grid-cols-1 gap-3">
                            {CONTROL_MEASURES.map(measure => {
                                const isActive = controlMeasures[measure.id]?.active;
                                const dynamicCost = measureCosts[measure.id];
                                
                                return (
                                    <div
                                        key={measure.id}
                                        className={`
                                            p-3 rounded-lg border transition-all
                                            ${isActive 
                                                ? 'border-orange-500 bg-orange-900/30' 
                                                : 'border-gray-600/50 bg-gray-800/30'
                                            }
                                        `}
                                    >
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => !measure.requiresOfficial && toggleControlMeasure(measure.id)}
                                                    className={`flex items-center gap-2 ${measure.requiresOfficial ? 'cursor-default' : 'cursor-pointer'}`}
                                                >
                                                    <Icon 
                                                        name={measure.icon} 
                                                        size={16} 
                                                        className={isActive ? 'text-orange-400' : 'text-gray-400'} 
                                                    />
                                                    <span className={`text-sm font-bold ${isActive ? 'text-white' : 'text-gray-300'} font-decorative`}>
                                                        {measure.title}
                                                    </span>
                                                </button>
                                                {!measure.requiresOfficial && (
                                                    <button
                                                        onClick={() => toggleControlMeasure(measure.id)}
                                                        className={`px-2 py-0.5 text-xs rounded ${isActive ? 'bg-orange-600 text-white' : 'bg-gray-700 text-gray-300'}`}
                                                    >
                                                        {isActive ? '启用' : '禁用'}
                                                    </button>
                                                )}
                                            </div>
                                            <span className="text-xs text-amber-300 font-body">
                                                {formatNumberShortCN(dynamicCost)}/天
                                            </span>
                                        </div>
                                        
                                        <p className="text-xs text-gray-400 mb-2 font-body">{measure.description}</p>
                                        <p className={`text-xs ${measure.effectColor} font-body mb-2`}>{measure.effects}</p>
                                        
                                        {/* Governor-specific: Official Selector */}
                                        {measure.id === 'governor' && (
                                            <OfficialSelector
                                                officials={officials}
                                                selectedOfficialId={controlMeasures.governor?.officialId}
                                                onSelect={setGovernorOfficial}
                                                measureConfig={INDEPENDENCE_CONFIG.controlMeasures.governor}
                                            />
                                        )}
                                        
                                        {/* Garrison-specific: Military Check */}
                                        {measure.id === 'garrison' && isActive && (
                                            <GarrisonMilitaryCheck
                                                playerMilitary={playerMilitary}
                                                vassalMilitary={vassalMilitary}
                                            />
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                    
                    {/* 预估影响 */}
                    <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700/50">
                        <h3 className="text-sm font-bold text-white mb-2 flex items-center gap-1.5 font-decorative">
                            <Icon name="AlertCircle" size={14} className="text-yellow-400" />
                            预估影响
                        </h3>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                            <div className="flex items-center justify-between bg-gray-900/50 rounded px-2 py-1.5">
                                <span className="text-gray-400 font-body">独立倾向变化</span>
                                <span className={`font-mono font-epic ${
                                    estimatedIndependenceChange > 0 ? 'text-red-400' :
                                    estimatedIndependenceChange < 0 ? 'text-green-400' : 'text-gray-400'
                                }`}>
                                    {estimatedIndependenceChange > 0 ? '+' : ''}{estimatedIndependenceChange.toFixed(1)}/年
                                </span>
                            </div>
                            <div className="flex items-center justify-between bg-gray-900/50 rounded px-2 py-1.5">
                                <span className="text-gray-400 font-body">预计月朝贡</span>
                                <span className="text-amber-400 font-mono font-epic">
                                    {formatNumberShortCN(estimatedTribute)}
                                </span>
                            </div>
                            {totalControlCost > 0 && (
                                <>
                                    <div className="flex items-center justify-between bg-gray-900/50 rounded px-2 py-1.5">
                                        <span className="text-gray-400 font-body">每日控制成本</span>
                                        <span className="text-red-400 font-mono font-epic">
                                            -{formatNumberShortCN(totalControlCost)}/天
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between bg-gray-900/50 rounded px-2 py-1.5">
                                        <span className="text-gray-400 font-body">月控制成本</span>
                                        <span className="text-red-400 font-mono font-epic">
                                            -{formatNumberShortCN(totalControlCost * 30)}/月
                                        </span>
                                    </div>
                                </>
                            )}
                        </div>
                        
                        {estimatedIndependenceChange > 5 && (
                            <div className="mt-2 text-xs text-yellow-400 flex items-center gap-1 font-body">
                                <Icon name="AlertTriangle" size={12} />
                                当前政策可能导致附庸独立倾向上升较快
                            </div>
                        )}
                        
                        {totalControlCost > estimatedTribute && (
                            <div className="mt-2 text-xs text-red-400 flex items-center gap-1 font-body">
                                <Icon name="AlertTriangle" size={12} />
                                控制成本超过朝贡收入！考虑减少控制措施
                            </div>
                        )}
                    </div>
                </div>
                
                {/* 底部按钮 */}
                <div className="flex items-center justify-between px-4 py-3 border-t border-gray-700 bg-gray-800/50">
                    <button
                        onClick={handleReset}
                        className="px-3 py-1.5 text-sm text-gray-400 hover:text-white transition-colors font-body"
                    >
                        重置为默认
                    </button>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={onClose}
                            className="px-4 py-1.5 text-sm rounded-lg bg-gray-700 hover:bg-gray-600 text-white transition-colors font-body"
                        >
                            取消
                        </button>
                        <button
                            onClick={handleApply}
                            className="px-4 py-1.5 text-sm rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-colors font-body"
                        >
                            应用政策
                        </button>
                    </div>
                </div>
            </div>
            
            {/* 动画样式 */}
            <style>{`
                @keyframes slideUp {
                    from {
                        transform: translateY(100%);
                        opacity: 0;
                    }
                    to {
                        transform: translateY(0);
                        opacity: 1;
                    }
                }
            `}</style>
        </div>
    );
};

export const VassalPolicyModal = memo(VassalPolicyModalComponent);
export default VassalPolicyModal;
