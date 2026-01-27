/**
 * Overseas Investment Management Panel
 * BottomSheet form for complete overseas investment management
 */

import React, { useState, useMemo, memo } from 'react';
import { BottomSheet } from '../tabs/BottomSheet';
import { Icon } from '../common/UIComponents';
import { BUILDINGS, RESOURCES, STRATA } from '../../config';
import { formatNumberShortCN } from '../../utils/numberFormat';
import { InvestmentRow } from './InvestmentRow';
import {
    OVERSEAS_INVESTMENT_CONFIGS,
    INVESTMENT_STRATEGIES,
    getInvestmentsInNation,
    calculateOverseasInvestmentSummary,
    OVERSEAS_BUILDING_CATEGORIES,
    getInvestableBuildings,
    compareLaborCost,
    hasActiveTreaty,
    calculateOverseasProfit,
} from '../../logic/diplomacy/overseasInvestment';

// No hardcoded stratum list - dynamically computed from available buildings

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
    unlockedTechs = null,
}) => {
    const [expandedCard, setExpandedCard] = useState(null);
    const [selectedStratumOverride, setSelectedStratumOverride] = useState(null);
    const [selectedStrategy, setSelectedStrategy] = useState('PROFIT_MAX');
    const [showNewInvestment, setShowNewInvestment] = useState(true);
    const [investFeedback, setInvestFeedback] = useState(null);

    // Determine access type based on nation relationship
    const accessType = useMemo(() => {
        if (!targetNation) return 'treaty';
        const isVassal = targetNation.vassalOf === 'player';
        return isVassal ? 'vassal' : 'treaty';
    }, [targetNation]);

    const canInvest = useMemo(() => {
        if (!targetNation) return false;
        const isVassal = targetNation.vassalOf === 'player';
        const hasPact = hasActiveTreaty(targetNation, 'investment_pact', targetNation.daysElapsed || 0);
        return isVassal || hasPact;
    }, [targetNation]);

    // Get all investable buildings first (without stratum filter)
    // This gives us the list of buildings and their owners dynamically
    const allInvestableBuildings = useMemo(() => {
        return getInvestableBuildings(accessType, null, epoch, unlockedTechs);
    }, [accessType, epoch, unlockedTechs]);

    // Dynamically compute which strata can invest (based on buildings that have them as owner)
    const investableStrata = useMemo(() => {
        const strataSet = new Set();
        allInvestableBuildings.forEach(b => {
            if (b.owner) strataSet.add(b.owner);
        });
        // Convert to array with config from STRATA
        return Array.from(strataSet).map(stratumId => ({
            id: stratumId,
            name: STRATA[stratumId]?.name || stratumId,
            icon: STRATA[stratumId]?.icon || '👤',
            color: STRATA[stratumId]?.color || 'text-gray-400',
        })).sort((a, b) => {
            // Sort by common investment strata first
            const order = ['capitalist', 'landowner', 'merchant'];
            return (order.indexOf(a.id) === -1 ? 999 : order.indexOf(a.id)) - 
                   (order.indexOf(b.id) === -1 ? 999 : order.indexOf(b.id));
        });
    }, [allInvestableBuildings]);

    // Selected stratum: use override if set, otherwise first available
    const selectedStratum = useMemo(() => {
        if (selectedStratumOverride && investableStrata.find(s => s.id === selectedStratumOverride)) {
            return selectedStratumOverride;
        }
        return investableStrata[0]?.id || 'capitalist';
    }, [selectedStratumOverride, investableStrata]);

    // Get buildings for the selected stratum
    const availableBuildings = useMemo(() => {
        return getInvestableBuildings(accessType, selectedStratum, epoch, unlockedTechs);
    }, [accessType, selectedStratum, epoch, unlockedTechs]);

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
                    totalCount: 0,
                };
            }
            const g = groups[inv.buildingId];
            g.investments.push(inv);
            g.totalInvestment += (inv.investmentAmount || 0);
            g.totalProfit += (inv.operatingData?.profit || 0);
            g.totalCount += (inv.count || 1);
        });

        return Object.values(groups);
    }, [overseasInvestments, targetNation]);

    const handleInvest = (buildingId) => {
        console.log('🟢🟢🟢 [INVEST-CLICK] handleInvest 被调用:', {
            buildingId,
            targetNationId: targetNation?.id,
            selectedStratum,
            selectedStrategy,
            onInvestExists: !!onInvest
        });
        if (onInvest) {
            console.log('🟢🟢🟢 [INVEST-CLICK] 调用 onInvest 回调...');
            onInvest(targetNation.id, buildingId, selectedStratum, selectedStrategy);
            // Show temporary feedback (mock) or rely on parent update
            setInvestFeedback({ buildingId, message: '投资建立中...', type: 'success' });
            setTimeout(() => setInvestFeedback(null), 2000);
        } else {
            console.error('🔴🔴🔴 [INVEST-CLICK] onInvest 回调不存在！');
        }
    };

    const stratumWealth = classWealth[selectedStratum] || 0;
    const selectedStratumConfig = investableStrata.find(s => s.id === selectedStratum) || { name: selectedStratum, icon: '👤' };

    if (!isOpen || !targetNation) return null;

    return (
        <BottomSheet isOpen={isOpen} onClose={onClose} title={`对 ${targetNation.name} 的海外投资`}>
            <div className="space-y-4 pb-20">
                {/* 顶部概览: 选中阶层的可用财富 */}
                {/* <div className="bg-gray-800/50 rounded-lg p-3 flex justify-between items-center border border-gray-700/50">
                    <div className="text-xs text-gray-400">
                        <span className="text-gray-500">{selectedStratumConfig.name}</span> 可用资金
                    </div>
                    <div className="font-bold text-amber-400 text-lg flex items-center gap-2">
                        <Icon name={selectedStratumConfig.icon} size={18} className="text-amber-400" />
                        {formatNumberShortCN(stratumWealth)}
                    </div>
                </div> */}

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

                {/* 新建投资区域 - 已禁用，投资由阶层自动决策 */}
                <div className="border-t border-gray-700/50 pt-4">
                    <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700/50 text-center">
                        <Icon name="TrendingUp" size={32} className="mx-auto mb-2 text-amber-400 opacity-50" />
                        <div className="text-sm text-gray-300 font-semibold mb-1">投资由阶层自主决策</div>
                        <div className="text-xs text-gray-400 leading-relaxed">
                            资本家、商人等阶层会根据市场机会自动寻找高利润投资项目。<br/>
                            您可以通过外交政策和条约引导投资方向。
                        </div>
                    </div>


                </div>
            </div>
        </BottomSheet>
    );
});
