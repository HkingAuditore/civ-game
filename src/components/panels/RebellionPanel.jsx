/**
 * 叛乱系统面板
 * 
 * 功能：
 * 1. 显示AI国家稳定度
 * 2. 显示叛乱风险评估
 * 3. 显示进行中的内战
 * 4. 提供玩家干预选项
 */

import React, { useState, useMemo } from 'react';
import { 
    getStabilityLevelInfo, 
    getRebellionRiskAssessment,
    INTERVENTION_OPTIONS,
    GOVERNMENT_TYPES,
} from '../../logic/diplomacy/rebellionSystem';

/**
 * 稳定度进度条
 */
const StabilityBar = ({ value, level }) => {
    const levelInfo = getStabilityLevelInfo(level);
    
    return (
        <div className="w-full">
            <div className="flex justify-between text-xs mb-1">
                <span className={levelInfo.color}>{levelInfo.label}</span>
                <span className="text-gray-400">{value}/100</span>
            </div>
            <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                <div 
                    className={`h-full transition-all duration-300 ${
                        value >= 80 ? 'bg-green-500' :
                        value >= 60 ? 'bg-blue-500' :
                        value >= 40 ? 'bg-yellow-500' :
                        value >= 20 ? 'bg-orange-500' :
                        'bg-red-500'
                    }`}
                    style={{ width: `${value}%` }}
                />
            </div>
        </div>
    );
};

/**
 * 叛乱进度条
 */
const RebellionProgressBar = ({ progress }) => {
    return (
        <div className="w-full">
            <div className="flex justify-between text-xs mb-1">
                <span className="text-red-400">叛乱酝酿</span>
                <span className="text-gray-400">{Math.round(progress)}%</span>
            </div>
            <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                <div 
                    className="h-full bg-red-500 transition-all duration-300"
                    style={{ width: `${Math.min(100, progress)}%` }}
                />
            </div>
        </div>
    );
};

/**
 * 内战状态卡片
 */
const CivilWarCard = ({ nation, onIntervene }) => {
    const { civilWarData } = nation;
    if (!civilWarData) return null;
    
    const govStrength = civilWarData.governmentStrength || 0;
    const rebelStrength = civilWarData.rebelStrength || 0;
    const totalStrength = govStrength + rebelStrength;
    const govPercent = totalStrength > 0 ? (govStrength / totalStrength) * 100 : 50;
    
    return (
        <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-2">
                <span className="text-red-400">⚔️</span>
                <span className="text-red-300 font-medium">内战进行中</span>
            </div>
            
            <div className="space-y-2">
                <div className="text-xs text-gray-400">势力对比</div>
                <div className="h-3 bg-gray-700 rounded-full overflow-hidden flex">
                    <div 
                        className="h-full bg-blue-500 transition-all"
                        style={{ width: `${govPercent}%` }}
                        title="官军"
                    />
                    <div 
                        className="h-full bg-red-500 transition-all"
                        style={{ width: `${100 - govPercent}%` }}
                        title="叛军"
                    />
                </div>
                <div className="flex justify-between text-xs">
                    <span className="text-blue-400">官军 {Math.round(govStrength)}</span>
                    <span className="text-red-400">叛军 {Math.round(rebelStrength)}</span>
                </div>
                
                {/* 外部支持 */}
                <div className="flex gap-4 text-xs mt-2">
                    {civilWarData.governmentSupport?.length > 0 && (
                        <span className="text-blue-300">
                            支持方: {civilWarData.governmentSupport.length}国
                        </span>
                    )}
                    {civilWarData.rebelSupport?.length > 0 && (
                        <span className="text-red-300">
                            叛军支持者: {civilWarData.rebelSupport.length}国
                        </span>
                    )}
                </div>
                
                {/* 干预按钮 */}
                <div className="flex gap-2 mt-2">
                    <button
                        onClick={() => onIntervene(nation.id, 'support_government')}
                        className="flex-1 px-2 py-1 bg-blue-600/50 hover:bg-blue-600 
                                   text-blue-200 text-xs rounded transition-colors"
                    >
                        支持当局
                    </button>
                    <button
                        onClick={() => onIntervene(nation.id, 'support_rebels')}
                        className="flex-1 px-2 py-1 bg-red-600/50 hover:bg-red-600 
                                   text-red-200 text-xs rounded transition-colors"
                    >
                        支持叛军
                    </button>
                </div>
            </div>
        </div>
    );
};

/**
 * 国家稳定度卡片
 */
const NationStabilityCard = ({ nation, onIntervene, isExpanded, onToggle }) => {
    const riskAssessment = getRebellionRiskAssessment(nation);
    const govType = GOVERNMENT_TYPES[nation.governmentType] || GOVERNMENT_TYPES.monarchy;
    
    const getRiskColor = (level) => {
        switch (level) {
            case 'critical': return 'text-red-400 bg-red-900/30';
            case 'high': return 'text-orange-400 bg-orange-900/30';
            case 'moderate': return 'text-yellow-400 bg-yellow-900/30';
            case 'active': return 'text-red-500 bg-red-900/50';
            default: return 'text-green-400 bg-green-900/30';
        }
    };
    
    const getRiskLabel = (level) => {
        switch (level) {
            case 'critical': return '危急';
            case 'high': return '高风险';
            case 'moderate': return '中等';
            case 'active': return '内战中';
            default: return '稳定';
        }
    };
    
    return (
        <div className="bg-gray-800/50 rounded-lg border border-gray-700/50 overflow-hidden">
            {/* 头部 */}
            <button
                onClick={onToggle}
                className="w-full flex items-center justify-between p-3 hover:bg-gray-700/30 transition-colors"
            >
                <div className="flex items-center gap-3">
                    <span className="text-xl">{nation.flag || '🏴'}</span>
                    <div className="text-left">
                        <div className="text-sm font-medium text-gray-200">{nation.name}</div>
                        <div className="text-xs text-gray-500">{govType.name}</div>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-xs ${getRiskColor(riskAssessment.riskLevel)}`}>
                        {getRiskLabel(riskAssessment.riskLevel)}
                    </span>
                    <span className="text-gray-500">{isExpanded ? '▼' : '▶'}</span>
                </div>
            </button>
            
            {/* 展开内容 */}
            {isExpanded && (
                <div className="p-3 border-t border-gray-700/50 space-y-3">
                    {/* 稳定度 */}
                    <StabilityBar 
                        value={riskAssessment.stability} 
                        level={nation.stabilityLevel || 'stable'} 
                    />
                    
                    {/* 叛乱进度（非内战时显示） */}
                    {!nation.isInCivilWar && riskAssessment.rebellionProgress > 0 && (
                        <RebellionProgressBar progress={riskAssessment.rebellionProgress} />
                    )}
                    
                    {/* 内战状态 */}
                    {nation.isInCivilWar && (
                        <CivilWarCard nation={nation} onIntervene={onIntervene} />
                    )}
                    
                    {/* 稳定度因素 */}
                    {nation.stabilityFactors && nation.stabilityFactors.length > 0 && (
                        <div className="space-y-1">
                            <div className="text-xs text-gray-500">影响因素</div>
                            {nation.stabilityFactors.map((factor, idx) => (
                                <div key={idx} className="flex justify-between text-xs">
                                    <span className="text-gray-400">{factor.name}</span>
                                    <span className={factor.value >= 0 ? 'text-green-400' : 'text-red-400'}>
                                        {factor.value >= 0 ? '+' : ''}{factor.value}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                    
                    {/* 干预选项（非内战时） */}
                    {!nation.isInCivilWar && (
                        <div className="grid grid-cols-2 gap-2 pt-2">
                            <button
                                onClick={() => onIntervene(nation.id, 'support_government')}
                                className="px-2 py-1.5 bg-blue-600/30 hover:bg-blue-600/50 
                                           text-blue-300 text-xs rounded transition-colors"
                                title="增加该国稳定度，提升关系"
                            >
                                🏛️ 支持当局
                            </button>
                            <button
                                onClick={() => onIntervene(nation.id, 'destabilize')}
                                className="px-2 py-1.5 bg-red-600/30 hover:bg-red-600/50 
                                           text-red-300 text-xs rounded transition-colors"
                                title="降低该国稳定度，可能触发叛乱"
                            >
                                🕵️ 颠覆活动
                            </button>
                            <button
                                onClick={() => onIntervene(nation.id, 'support_rebels')}
                                className="px-2 py-1.5 bg-orange-600/30 hover:bg-orange-600/50 
                                           text-orange-300 text-xs rounded transition-colors"
                                title="资助反对派，加速叛乱"
                            >
                                🏴 资助反对派
                            </button>
                            <button
                                onClick={() => onIntervene(nation.id, 'humanitarian_aid')}
                                className="px-2 py-1.5 bg-green-600/30 hover:bg-green-600/50 
                                           text-green-300 text-xs rounded transition-colors"
                                title="提供援助，小幅改善关系"
                            >
                                ❤️ 人道援助
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

/**
 * 叛乱系统面板主组件
 */
const RebellionPanel = ({ 
    nations = [], 
    onIntervene,
    playerResources = {},
}) => {
    const [expandedNationId, setExpandedNationId] = useState(null);
    const [filterMode, setFilterMode] = useState('all'); // 'all', 'unstable', 'civil_war'
    
    // 过滤和排序国家
    const filteredNations = useMemo(() => {
        let filtered = nations.filter(n => !n.isPlayer && !n.isRebelNation);
        
        switch (filterMode) {
            case 'unstable':
                filtered = filtered.filter(n => {
                    const risk = getRebellionRiskAssessment(n);
                    return risk.riskLevel !== 'low';
                });
                break;
            case 'civil_war':
                filtered = filtered.filter(n => n.isInCivilWar);
                break;
        }
        
        // 按风险排序
        return filtered.sort((a, b) => {
            const riskA = getRebellionRiskAssessment(a);
            const riskB = getRebellionRiskAssessment(b);
            return riskB.riskScore - riskA.riskScore;
        });
    }, [nations, filterMode]);
    
    // 统计数据
    const stats = useMemo(() => {
        const aiNations = nations.filter(n => !n.isPlayer && !n.isRebelNation);
        return {
            total: aiNations.length,
            unstable: aiNations.filter(n => {
                const risk = getRebellionRiskAssessment(n);
                return risk.riskLevel !== 'low';
            }).length,
            civilWars: aiNations.filter(n => n.isInCivilWar).length,
        };
    }, [nations]);
    
    const handleToggle = (nationId) => {
        setExpandedNationId(expandedNationId === nationId ? null : nationId);
    };
    
    const handleIntervene = (nationId, interventionType) => {
        const option = INTERVENTION_OPTIONS[interventionType];
        if (!option) return;
        
        // 检查资源
        if (option.cost.silver && (playerResources.silver || 0) < option.cost.silver) {
            alert(`银币不足！需要 ${option.cost.silver} 银币。`);
            return;
        }
        
        if (onIntervene) {
            onIntervene(nationId, interventionType);
        }
    };
    
    return (
        <div className="h-full flex flex-col bg-gray-900/50 rounded-lg">
            {/* 标题栏 */}
            <div className="p-3 border-b border-gray-700/50">
                <div className="flex items-center justify-between mb-2">
                    <h3 className="text-lg font-medium text-gray-200 flex items-center gap-2">
                        <span>⚔️</span>
                        <span>世界局势</span>
                    </h3>
                    <div className="text-xs text-gray-500">
                        {stats.civilWars > 0 && (
                            <span className="text-red-400 mr-2">🔥 {stats.civilWars}场内战</span>
                        )}
                        <span>{stats.unstable}/{stats.total} 国家不稳定</span>
                    </div>
                </div>
                
                {/* 筛选按钮 */}
                <div className="flex gap-2">
                    <button
                        onClick={() => setFilterMode('all')}
                        className={`px-3 py-1 text-xs rounded transition-colors ${
                            filterMode === 'all' 
                                ? 'bg-blue-600 text-white' 
                                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                        }`}
                    >
                        全部 ({stats.total})
                    </button>
                    <button
                        onClick={() => setFilterMode('unstable')}
                        className={`px-3 py-1 text-xs rounded transition-colors ${
                            filterMode === 'unstable' 
                                ? 'bg-orange-600 text-white' 
                                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                        }`}
                    >
                        不稳定 ({stats.unstable})
                    </button>
                    <button
                        onClick={() => setFilterMode('civil_war')}
                        className={`px-3 py-1 text-xs rounded transition-colors ${
                            filterMode === 'civil_war' 
                                ? 'bg-red-600 text-white' 
                                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                        }`}
                    >
                        内战中 ({stats.civilWars})
                    </button>
                </div>
            </div>
            
            {/* 国家列表 */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {filteredNations.length === 0 ? (
                    <div className="text-center text-gray-500 py-8">
                        {filterMode === 'civil_war' 
                            ? '当前没有国家处于内战状态' 
                            : filterMode === 'unstable'
                            ? '当前所有国家都很稳定'
                            : '暂无可显示的国家'}
                    </div>
                ) : (
                    filteredNations.map(nation => (
                        <NationStabilityCard
                            key={nation.id}
                            nation={nation}
                            onIntervene={handleIntervene}
                            isExpanded={expandedNationId === nation.id}
                            onToggle={() => handleToggle(nation.id)}
                        />
                    ))
                )}
            </div>
            
            {/* 干预成本说明 */}
            <div className="p-3 border-t border-gray-700/50 bg-gray-800/30">
                <div className="text-xs text-gray-500 mb-1">干预成本</div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                    {Object.values(INTERVENTION_OPTIONS).map(opt => {
                        if (opt.requiresCivilWar) return null; // Skip civil war only options in summary
                        const iconMap = {
                            support_government: '🏛️',
                            destabilize: '🕵️',
                            support_rebels: '🏴',
                            humanitarian_aid: '❤️',
                            military_intervention: '⚔️'
                        };
                        return (
                            <span key={opt.id} className="text-gray-400">
                                {iconMap[opt.id] || '•'} {opt.name}: {opt.cost.silver}银
                            </span>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default RebellionPanel;
