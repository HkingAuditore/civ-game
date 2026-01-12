/**
 * Overseas Investment Management Panel
 * BottomSheet form for complete overseas investment management
 */

import React, { useState, useMemo, memo } from 'react';
import { BottomSheet } from '../tabs/BottomSheet';
import { Icon } from '../common/UIComponents';
import { BUILDINGS, RESOURCES } from '../../config';
import { formatNumberShortCN } from '../../utils/numberFormat';
import { InvestmentRow } from './InvestmentRow';
import {
    OVERSEAS_INVESTMENT_CONFIGS,
    INVESTABLE_BUILDINGS,
    INVESTMENT_STRATEGIES,
    getInvestmentsInNation,
    calculateOverseasInvestmentSummary,
    OVERSEAS_BUILDING_CATEGORIES,
    compareLaborCost,
} from '../../logic/diplomacy/overseasInvestment';

// Stratum Configuration
const STRATUM_CONFIG = {
    capitalist: { name: '资本家', icon: '🏭', color: 'text-purple-400', categories: ['gather', 'industry'] },
    merchant: { name: '商人', icon: '⚖️', color: 'text-amber-400', categories: ['industry'] },
    landowner: { name: '地主', icon: '🌾', color: 'text-green-400', categories: ['gather'] },
};

/**
 * Overseas Investment Management Panel
 */
export const OverseasInvestmentPanel = memo(({
    isOpen,
    onClose,
    targetNation,
    overseasInvestments = [],
    classWealth = {},
    epoch = 0,
    market = {},
    onInvest,
    onWithdraw,
    onConfigChange,
    playerNation,
}) => {
    const [expandedCard, setExpandedCard] = useState(null);
    const [selectedStratum, setSelectedStratum] = useState('capitalist');
    const [selectedStrategy, setSelectedStrategy] = useState('PROFIT_MAX');
    const [showNewInvestment, setShowNewInvestment] = useState(true);
    const [investFeedback, setInvestFeedback] = useState(null); // { buildingId, message, type }

    // Group current investments by building type
    const groupedInvestments = useMemo(() => {
        if (!targetNation || !overseasInvestments) return [];

        // 1. Filter investments for this nation
        const nationInvestments = getInvestmentsInNation(overseasInvestments, targetNation.id);

        // 2. Group by buildingId
        const groups = {};
        nationInvestments.forEach(inv => {
            if (!groups[inv.buildingId]) {
                groups[inv.buildingId] = {
                    buildingId: inv.buildingId,
                    investments: [],
                    totalInvestment: 0,
                    totalProfit: 0,
                };
            }
            const g = groups[inv.buildingId];
            g.investments.push(inv);
            g.totalInvestment += (inv.investmentAmount || 0);
            g.totalProfit += (inv.operatingData?.profit || 0);
        });

        return Object.values(groups);
    }, [overseasInvestments, targetNation]);

    // Calculate investable buildings
    const availableBuildings = useMemo(() => {
        if (!targetNation) return [];

        // Filter by stratum categories
        const allowedCategories = STRATUM_CONFIG[selectedStratum]?.categories || [];

        return INVESTABLE_BUILDINGS.filter(bId => {
            const building = BUILDINGS.find(b => b.id === bId);
            if (!building) return false;

            // Simple owner match or category fallback
            if (building.owner === selectedStratum) return true;

            // Fallback: check categories (mostly for legacy or multi-class buildings)
            const category = building.cat || building.category || 'industry';
            if (allowedCategories.includes(category)) return true;

            return false;

            // Tech condition (simple check: if epoch requirement is met)
            // Assuming simplified condition for now as full tech tree availability might not be passed
            return true;
        }).map(bId => BUILDINGS.find(b => b.id === bId));
    }, [targetNation, selectedStratum]);

    const handleInvest = (buildingId) => {
        if (onInvest) {
            onInvest(targetNation.id, buildingId, selectedStratum, selectedStrategy);
            // Show temporary feedback (mock) or rely on parent update
            setInvestFeedback({ buildingId, message: '投资建立中...', type: 'success' });
            setTimeout(() => setInvestFeedback(null), 2000);
        }
    };

    const stratumWealth = classWealth[selectedStratum] || 0;

    if (!isOpen || !targetNation) return null;

    return (
        <BottomSheet isOpen={isOpen} onClose={onClose} title={`对 ${targetNation.name} 的海外投资`}>
            <div className="space-y-4 pb-20">
                {/* 顶部概览: 阶层财富 */}
                <div className="bg-gray-800/50 rounded-lg p-3 flex justify-between items-center border border-gray-700/50">
                    <div className="text-xs text-gray-400">可用投资资金</div>
                    <div className="font-bold text-amber-400 text-lg flex items-center gap-2">
                        <span>{STRATUM_CONFIG[selectedStratum]?.icon}</span>
                        {formatNumberShortCN(stratumWealth)}
                    </div>
                </div>

                {/* 现有投资列表 */}
                <div className="space-y-2">
                    <div className="text-xs text-gray-400 font-bold uppercase tracking-wider flex justify-between items-center">
                        <span>现有业务 ({groupedInvestments.length})</span>
                    </div>

                    {groupedInvestments.length > 0 ? (
                        <div className="space-y-2">
                            {groupedInvestments.map(group => (
                                <InvestmentRow
                                    key={group.buildingId}
                                    group={group}
                                    expandedCard={expandedCard}
                                    setExpandedCard={setExpandedCard}
                                    playerNation={playerNation}
                                    targetNation={targetNation}
                                    onConfigChange={onConfigChange}
                                    onWithdraw={onWithdraw}
                                />
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-6 text-gray-400 bg-gray-800/30 rounded-lg border border-gray-700/40">
                            <Icon name="Building2" size={32} className="mx-auto mb-2 opacity-50" />
                            <div className="text-sm">暂无海外投资</div>
                            <div className="text-[10px] mt-1">点击下方按钮新建投资</div>
                        </div>
                    )}
                </div>

                {/* 新建投资区域 */}
                <div className="border-t border-gray-700/50 pt-4">
                    <button
                        className={`w-full px-4 py-2 rounded-lg font-semibold transition-all flex items-center justify-center gap-2 ${showNewInvestment
                            ? 'bg-gray-700 text-white'
                            : 'bg-amber-600 hover:bg-amber-500 text-white'
                            }`}
                        onClick={() => setShowNewInvestment(!showNewInvestment)}
                    >
                        <Icon name={showNewInvestment ? 'ChevronUp' : 'Plus'} size={16} />
                        {showNewInvestment ? '收起' : '新建海外投资'}
                    </button>

                    {showNewInvestment && (
                        <div className="mt-3 space-y-3">
                            {/* 阶层选择 */}
                            <div>
                                <div className="text-[10px] text-gray-400 mb-1.5">选择投资阶层:</div>
                                <div className="flex gap-1">
                                    {Object.entries(STRATUM_CONFIG).map(([stratumId, config]) => {
                                        const wealth = classWealth[stratumId] || 0;
                                        const isSelected = selectedStratum === stratumId;
                                        return (
                                            <button
                                                key={stratumId}
                                                className={`flex-1 px-2 py-2 rounded-lg text-[11px] transition-all ${isSelected
                                                    ? 'bg-amber-600 text-white border border-amber-500'
                                                    : 'bg-gray-700/50 text-gray-300 hover:bg-gray-600/50 border border-gray-600/50'
                                                    }`}
                                                onClick={() => setSelectedStratum(stratumId)}
                                            >
                                                <div>{config.icon} {config.name}</div>
                                                <div className="text-[9px] opacity-70 mt-0.5">
                                                    财富: {formatNumberShortCN(wealth)}
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* 策略选择 */}
                            <div>
                                <div className="text-[10px] text-gray-400 mb-1.5">选择运营策略:</div>
                                <div className="flex gap-1">
                                    {Object.values(INVESTMENT_STRATEGIES).map(strat => {
                                        const isSelected = selectedStrategy === strat.id;
                                        return (
                                            <button
                                                key={strat.id}
                                                className={`flex-1 px-2 py-2 rounded-lg text-[10px] transition-all text-left group relative ${isSelected
                                                    ? 'bg-amber-600 text-white border border-amber-500'
                                                    : 'bg-gray-700/50 text-gray-300 hover:bg-gray-600/50 border border-gray-600/50'
                                                    }`}
                                                onClick={() => setSelectedStrategy(strat.id)}
                                                title={strat.desc}
                                            >
                                                <div className="font-bold mb-0.5">{strat.name}</div>
                                                <div className="text-[8px] opacity-70 line-clamp-2 leading-tight">
                                                    {strat.desc}
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* 可建建筑列表 */}
                            <div>
                                <div className="text-[10px] text-gray-400 mb-1.5">可投资建筑 ({availableBuildings.length}种):</div>
                                <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
                                    {availableBuildings.map(building => {
                                        const cost = Object.values(building.cost || building.baseCost || {}).reduce((sum, v) => sum + v, 0) * 1.5; // Estimated overseas cost factor
                                        const canAfford = stratumWealth >= cost;

                                        // Labor Analysis Preview
                                        const laborAnalysis = targetNation && playerNation ? compareLaborCost(building.id, playerNation, targetNation) : null;

                                        const inputEntries = Object.entries(building.input || {});
                                        const outputEntries = Object.entries(building.output || {}).filter(([k]) => !['maxPop', 'militaryCapacity'].includes(k));

                                        return (
                                            <button
                                                key={building.id}
                                                disabled={!canAfford}
                                                className={`w-full text-left p-3 rounded-lg border transition-all ${canAfford
                                                    ? 'bg-gray-800/60 border-gray-700 hover:bg-gray-700 hover:border-gray-600'
                                                    : 'bg-gray-800/30 border-gray-800 opacity-50 cursor-not-allowed'
                                                    }`}
                                                onClick={() => handleInvest(building.id)}
                                            >
                                                <div className="flex items-center justify-between mb-2">
                                                    <div className="flex items-center gap-2">
                                                        <div className={`w-8 h-8 rounded flex items-center justify-center ${building.visual?.color || 'bg-gray-700'}`}>
                                                            <Icon name={building.visual?.icon || 'Building'} size={16} className={building.visual?.text || 'text-gray-200'} />
                                                        </div>
                                                        <div>
                                                            <div className="font-bold text-sm text-gray-200">{building.name}</div>
                                                            <div className="text-[10px] text-amber-500 font-medium">
                                                                成本: {formatNumberShortCN(cost)}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {investFeedback?.buildingId === building.id ? (
                                                        <span className="text-[10px] text-green-400 animate-pulse">{investFeedback.message}</span>
                                                    ) : (
                                                        <div className="bg-gray-900/50 px-2 py-1 rounded text-[10px]">
                                                            <span className="text-gray-400">预计利润: </span>
                                                            <span className="text-green-400">Yes/日</span>
                                                            {/* Actual prediction is complex, skipping for UI simplicity or need logic */}
                                                        </div>
                                                    )}
                                                </div>

                                                {/* 资源预览 */}
                                                <div className="flex items-center gap-2 text-[10px] text-gray-500 bg-gray-900/20 p-1.5 rounded">
                                                    <div className="flex items-center gap-1 flex-1">
                                                        <span className="text-gray-600">需:</span>
                                                        {inputEntries.length > 0 ? inputEntries.map(([k, v]) => (
                                                            <span key={k}>{RESOURCES[k]?.name}</span>
                                                        )) : <span>无</span>}
                                                    </div>
                                                    <Icon name="ArrowRight" size={10} className="text-gray-600" />
                                                    <div className="flex items-center gap-1 flex-1 justify-end">
                                                        <span className="text-gray-600">产:</span>
                                                        {outputEntries.map(([k, v]) => (
                                                            <span key={k} className="text-gray-300">{RESOURCES[k]?.name}</span>
                                                        ))}
                                                    </div>
                                                </div>

                                                {/* Labor Cost Preview Label */}
                                                {laborAnalysis && (
                                                    <div className="mt-1 flex justify-end">
                                                        {laborAnalysis.ratio < 0.8 && (
                                                            <span className="text-[9px] text-green-400">📉 人工成本低 ({Math.round(laborAnalysis.ratio * 100)}%)</span>
                                                        )}
                                                        {laborAnalysis.ratio > 1.2 && (
                                                            <span className="text-[9px] text-red-400">📈 人工成本高 ({Math.round(laborAnalysis.ratio * 100)}%)</span>
                                                        )}
                                                    </div>
                                                )}
                                            </button>
                                        );
                                    })}
                                    {availableBuildings.length === 0 && (
                                        <div className="text-center py-4 text-gray-500 text-xs italic">
                                            该阶层暂无可投资的此类建筑
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </BottomSheet>
    );
});
