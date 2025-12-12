import { createPortal } from 'react-dom';
import { useState, useMemo, useEffect } from 'react';
import { Icon } from '../common/UIComponents';
import { RESOURCES } from '../../config';
import { calculateForeignPrice, calculateTradeStatus } from '../../utils/foreignTrade';

const TradeRoutesModal = ({
    tradeRoutes,
    nations,
    resources,
    market,
    taxPolicies,
    daysElapsed,
    epoch = 0,
    onClose,
    onCancelRoute,
    onCreateRoute // New: allow creating routes from this modal
}) => {
    // Tab state: 'active', 'bestExport', 'bestImport'
    const [activeTab, setActiveTab] = useState('active');

    // Helper to get nation name by ID
    const getNationName = (id) => {
        const nation = nations.find(n => n.id === id);
        return nation ? nation.name : 'Unknown Nation';
    };

    // Get all tradable resources for current epoch
    const tradableResources = useMemo(() => {
        return Object.entries(RESOURCES).filter(
            ([key, def]) =>
                def.type !== 'virtual' &&
                key !== 'silver' &&
                (def.unlockEpoch ?? 0) <= epoch
        );
    }, [epoch]);

    // Get visible nations for current epoch
    const visibleNations = useMemo(() => {
        return nations.filter(
            (nation) =>
                epoch >= (nation.appearEpoch ?? 0) &&
                (nation.expireEpoch == null || epoch <= nation.expireEpoch) &&
                !nation.isAtWar // Exclude nations at war
        );
    }, [nations, epoch]);

    // Check if a trade route exists
    const hasTradeRoute = (nationId, resourceKey, type) => {
        if (!tradeRoutes?.routes) return false;
        return tradeRoutes.routes.some(
            route => route.nationId === nationId && route.resource === resourceKey && route.type === type
        );
    };

    // Calculate estimated profit/cost for a potential trade opportunity
    const calculateTradeOpportunity = (nation, resourceKey, type) => {
        const localPrice = market?.prices?.[resourceKey] ?? (RESOURCES[resourceKey]?.basePrice || 1);
        const foreignPrice = calculateForeignPrice(resourceKey, nation, daysElapsed);
        const tradeStatus = calculateTradeStatus(resourceKey, nation, daysElapsed);

        const TRADE_SPEED = 0.05;
        const taxRate = taxPolicies?.resourceTaxRates?.[resourceKey] || 0;
        const tariffMultiplier = Math.max(0, taxPolicies?.resourceTariffMultipliers?.[resourceKey] ?? 1);
        const effectiveTaxRate = taxRate * tariffMultiplier;

        const resourceName = RESOURCES[resourceKey]?.name || resourceKey;
        const isActive = hasTradeRoute(nation.id, resourceKey, type);

        if (type === 'export') {
            // Export: We sell to them. Need foreign shortage.
            const myInventory = resources[resourceKey] || 0;
            const mySurplus = Math.max(0, myInventory - 500);
            const foreignShortage = tradeStatus.shortageAmount || 0;
            const possibleVolume = Math.min(mySurplus, foreignShortage) * TRADE_SPEED;

            // Calculate profit even if volume is 0 (show potential)
            const potentialVolume = Math.max(possibleVolume, foreignShortage * TRADE_SPEED);
            const domesticCost = localPrice * potentialVolume;
            const taxRevenue = domesticCost * effectiveTaxRate;
            const foreignRevenue = foreignPrice * potentialVolume;
            const merchantMargin = foreignRevenue - domesticCost - taxRevenue;

            // Price difference is key for export profitability
            const priceDiff = foreignPrice - localPrice;

            return {
                nationId: nation.id,
                nationName: nation.name,
                resource: resourceKey,
                resourceName,
                type: 'export',
                isActive,
                localPrice,
                foreignPrice,
                priceDiff,
                taxRevenue: possibleVolume > 0.1 && merchantMargin > 0 ? taxRevenue : 0,
                possibleVolume,
                shortage: foreignShortage,
                surplus: mySurplus,
                merchantMargin,
                // Score for ranking: higher is better
                // For export: we want high price diff AND they have shortage
                profitScore: priceDiff > 0 ? priceDiff * Math.min(foreignShortage, 1000) : 0,
                status: possibleVolume < 0.1 ? (mySurplus < 1 ? '我方无货' : '对方无需求') :
                    merchantMargin <= 0 ? '商人无利' : '可交易',
                statusClass: possibleVolume < 0.1 || merchantMargin <= 0 ? 'text-gray-500' : 'text-green-400'
            };
        } else {
            // Import: We buy from them. Need foreign surplus.
            const foreignSurplus = tradeStatus.surplusAmount || 0;
            const possibleVolume = Math.min(foreignSurplus, 500) * TRADE_SPEED;

            // Price difference: positive means we save money (foreign is cheaper)
            const priceDiff = localPrice - foreignPrice;
            const savingsPerDay = priceDiff * possibleVolume;

            return {
                nationId: nation.id,
                nationName: nation.name,
                resource: resourceKey,
                resourceName,
                type: 'import',
                isActive,
                localPrice,
                foreignPrice,
                priceDiff, // Positive = cheaper import
                savingsPerDay,
                possibleVolume,
                surplus: foreignSurplus,
                // Score for ranking: higher is better
                // For import: we want high price diff (local more expensive than foreign) AND they have surplus
                profitScore: priceDiff > 0 ? priceDiff * Math.min(foreignSurplus, 1000) : 0,
                status: possibleVolume < 0.1 ? '对方无货' : priceDiff <= 0 ? '无价差优势' : '可交易',
                statusClass: possibleVolume < 0.1 ? 'text-gray-500' : priceDiff <= 0 ? 'text-yellow-500' : 'text-blue-400'
            };
        }
    };

    // Generate all possible trade opportunities
    const allOpportunities = useMemo(() => {
        const opportunities = [];

        for (const nation of visibleNations) {
            for (const [resourceKey] of tradableResources) {
                // Export opportunity
                opportunities.push(calculateTradeOpportunity(nation, resourceKey, 'export'));
                // Import opportunity
                opportunities.push(calculateTradeOpportunity(nation, resourceKey, 'import'));
            }
        }

        return opportunities;
    }, [visibleNations, tradableResources, market, resources, taxPolicies, daysElapsed, tradeRoutes]);

    // Best export opportunities (sorted by profit score)
    const bestExportOpportunities = useMemo(() => {
        return allOpportunities
            .filter(o => o.type === 'export' && o.profitScore > 0)
            .sort((a, b) => b.profitScore - a.profitScore)
            .slice(0, 20); // Top 20
    }, [allOpportunities]);

    // Best import opportunities (sorted by savings score)
    const bestImportOpportunities = useMemo(() => {
        return allOpportunities
            .filter(o => o.type === 'import' && o.profitScore > 0)
            .sort((a, b) => b.profitScore - a.profitScore)
            .slice(0, 20); // Top 20
    }, [allOpportunities]);

    // Active routes with economics data
    const activeRoutes = useMemo(() => {
        return (tradeRoutes.routes || []).map(route => {
            const nation = nations.find(n => n.id === route.nationId);
            if (!nation) return { ...route, economics: null };
            return {
                ...route,
                opportunity: calculateTradeOpportunity(nation, route.resource, route.type)
            };
        });
    }, [tradeRoutes.routes, nations, market, resources, taxPolicies, daysElapsed]);

    // Counts
    const exportCount = bestExportOpportunities.length;
    const importCount = bestImportOpportunities.length;

    const tabs = [
        { id: 'active', label: '已建立路线', count: activeRoutes.length, icon: 'List' },
        { id: 'bestExport', label: '出口机会', count: exportCount, icon: 'ArrowUpRight' },
        { id: 'bestImport', label: '进口机会', count: importCount, icon: 'ArrowDownLeft' },
    ];

    const renderOpportunityRow = (opp, index, showRank = false) => {
        const isExport = opp.type === 'export';
        return (
            <div
                key={`${opp.nationId}-${opp.resource}-${opp.type}-${index}`}
                className={`grid grid-cols-12 gap-1 sm:gap-2 items-center p-2 sm:p-3 rounded-lg ${opp.isActive ? 'bg-amber-900/30 border-amber-500/30' : 'bg-gray-800/40 border-white/5'
                    } hover:bg-gray-800/60 border hover:border-white/10 transition-colors text-xs sm:text-sm`}
            >
                {/* Rank */}
                {showRank && (
                    <div className="col-span-1 text-center">
                        <span className={`inline-flex items-center justify-center w-5 h-5 sm:w-6 sm:h-6 rounded text-[10px] sm:text-xs font-bold ${index === 0 ? 'bg-yellow-500/30 text-yellow-300' :
                            index === 1 ? 'bg-gray-400/30 text-gray-300' :
                                index === 2 ? 'bg-amber-700/30 text-amber-400' :
                                    'bg-gray-700/30 text-gray-500'
                            }`}>
                            {index + 1}
                        </span>
                    </div>
                )}

                {/* Nation */}
                <div className={`${showRank ? 'col-span-2' : 'col-span-3'} font-medium text-gray-200 truncate`} title={opp.nationName}>
                    {opp.nationName}
                </div>

                {/* Resource */}
                <div className="col-span-2 flex items-center gap-1">
                    <span className="text-gray-300 truncate">{opp.resourceName}</span>
                </div>

                {/* Price Info */}
                <div className="col-span-3 text-right">
                    <div className="flex flex-col items-end">
                        <span className={`font-mono text-[10px] sm:text-xs ${opp.priceDiff > 0 ? 'text-green-400' : opp.priceDiff < 0 ? 'text-red-400' : 'text-gray-400'}`}>
                            {isExport ? (
                                <>外价: {opp.foreignPrice.toFixed(1)} ({opp.priceDiff > 0 ? '+' : ''}{opp.priceDiff.toFixed(1)})</>
                            ) : (
                                <>外价: {opp.foreignPrice.toFixed(1)} ({opp.priceDiff > 0 ? '-' : '+'}{Math.abs(opp.priceDiff).toFixed(1)})</>
                            )}
                        </span>
                        <span className="text-[9px] sm:text-[10px] text-gray-500">
                            本地: {opp.localPrice.toFixed(1)}
                        </span>
                    </div>
                </div>

                {/* Status / Volume */}
                <div className="col-span-2 text-center">
                    <span className={`text-[10px] sm:text-xs ${opp.statusClass}`}>
                        {opp.status}
                    </span>
                    {opp.possibleVolume > 0.1 && (
                        <div className="text-[9px] text-gray-500">
                            {opp.possibleVolume.toFixed(1)}/天
                        </div>
                    )}
                </div>

                {/* Action */}
                <div className="col-span-2 flex justify-center">
                    {opp.isActive ? (
                        <button
                            onClick={() => onCancelRoute(opp.nationId, opp.resource, opp.type)}
                            className="p-1 sm:p-1.5 rounded bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 transition-colors"
                            title="取消路线"
                        >
                            <Icon name="X" size={12} />
                        </button>
                    ) : onCreateRoute ? (
                        <button
                            onClick={() => onCreateRoute(opp.nationId, opp.resource, opp.type)}
                            className={`p-1 sm:p-1.5 rounded ${isExport
                                ? 'bg-green-500/10 hover:bg-green-500/20 text-green-400 border border-green-500/20'
                                : 'bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20'
                                } transition-colors`}
                            title="创建路线"
                        >
                            <Icon name="Plus" size={12} />
                        </button>
                    ) : (
                        <span className="text-[10px] text-gray-600">-</span>
                    )}
                </div>
            </div>
        );
    };

    const renderActiveRouteRow = (route, index) => {
        const opp = route.opportunity;
        if (!opp) {
            return (
                <div key={index} className="p-3 bg-gray-800/40 rounded-lg text-gray-500 text-sm flex items-center justify-between group">
                    <span>无效路线（国家已不可用）</span>
                    <button
                        onClick={() => onCancelRoute(route.nationId, route.resource, route.type)}
                        className="px-2 py-1 bg-red-600/20 hover:bg-red-600/40 text-red-400 rounded text-xs transition-colors flex items-center gap-1"
                    >
                        <Icon name="Trash" size={12} />
                        <span className="opacity-0 group-hover:opacity-100 transition-opacity">清除</span>
                    </button>
                </div>
            );
        }
        return renderOpportunityRow(opp, index, false);
    };

    // Auto-cleanup invalid routes when the modal is open
    useEffect(() => {
        const invalidRoutes = activeRoutes.filter(r => r.economics === null);
        if (invalidRoutes.length > 0) {
            // Clean up one by one to avoid state conflicts, rely on re-renders
            const route = invalidRoutes[0];
            if (onCancelRoute) {
                // Use a small timeout to avoid render-cycle conflicts
                const timer = setTimeout(() => {
                    onCancelRoute(route.nationId, route.resource, route.type);
                }, 0);
                return () => clearTimeout(timer);
            }
        }
    }, [activeRoutes, onCancelRoute]);

    return createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose}></div>

            {/* Modal Content */}
            <div className="relative w-full max-w-2xl glass-panel border-2 border-amber-500/30 rounded-2xl shadow-2xl overflow-hidden animate-slide-up bg-gray-900/90 max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="p-3 sm:p-4 border-b border-amber-500/20 bg-gradient-to-r from-amber-900/40 to-gray-900/60 flex items-center justify-between flex-shrink-0">
                    <div className="flex items-center gap-2 sm:gap-3">
                        <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-amber-500/20 flex items-center justify-center border border-amber-500/30">
                            <Icon name="TrendingUp" size={18} className="text-amber-400" />
                        </div>
                        <div>
                            <h2 className="text-base sm:text-xl font-bold text-amber-100">贸易路线分析</h2>
                            <p className="text-[10px] sm:text-xs text-gray-400 hidden sm:block">发现最佳贸易机会</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-full hover:bg-white/10 transition-colors text-gray-400 hover:text-white"
                    >
                        <Icon name="X" size={18} />
                    </button>
                </div>

                {/* Tab Navigation */}
                <div className="flex border-b border-white/10 bg-gray-800/50 flex-shrink-0">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex-1 flex items-center justify-center gap-1 sm:gap-2 px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm font-medium transition-all ${activeTab === tab.id
                                ? 'text-amber-300 border-b-2 border-amber-400 bg-amber-500/10'
                                : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
                                }`}
                        >
                            <Icon name={tab.icon} size={14} />
                            <span className="hidden xs:inline sm:inline">{tab.label}</span>
                            <span className={`px-1 sm:px-1.5 py-0.5 rounded text-[10px] sm:text-xs ${activeTab === tab.id ? 'bg-amber-500/20 text-amber-200' : 'bg-gray-700 text-gray-400'
                                }`}>
                                {tab.count}
                            </span>
                        </button>
                    ))}
                </div>

                {/* Table Header */}
                <div className={`grid ${activeTab !== 'active' ? 'grid-cols-12' : 'grid-cols-12'} gap-1 sm:gap-2 px-3 sm:px-6 py-2 bg-white/5 text-[10px] sm:text-xs font-bold text-gray-400 uppercase tracking-wider border-b border-white/5 flex-shrink-0`}>
                    {activeTab !== 'active' && <div className="col-span-1 text-center">#</div>}
                    <div className={`${activeTab !== 'active' ? 'col-span-2' : 'col-span-3'}`}>国家</div>
                    <div className="col-span-2">商品</div>
                    <div className="col-span-3 text-right">价格差</div>
                    <div className="col-span-2 text-center">状态</div>
                    <div className="col-span-2 text-center">操作</div>
                </div>

                {/* Scrollable List */}
                <div className="flex-1 overflow-y-auto p-2 sm:p-4 space-y-1 sm:space-y-2 custom-scrollbar">
                    {activeTab === 'active' && (
                        activeRoutes.length === 0 ? (
                            <div className="text-center py-8 sm:py-12 text-gray-500">
                                <Icon name="Route" size={40} className="mx-auto mb-3 opacity-20" />
                                <p className="text-sm">暂无活跃的贸易路线</p>
                                <p className="text-xs mt-1">切换到"出口机会"或"进口机会"发现商机</p>
                            </div>
                        ) : (
                            activeRoutes.map((route, index) => renderActiveRouteRow(route, index))
                        )
                    )}

                    {activeTab === 'bestExport' && (
                        bestExportOpportunities.length === 0 ? (
                            <div className="text-center py-8 sm:py-12 text-gray-500">
                                <Icon name="ArrowUpRight" size={40} className="mx-auto mb-3 opacity-20" />
                                <p className="text-sm">暂无优质出口机会</p>
                                <p className="text-xs mt-1">当外国价格高于本地时会出现出口机会</p>
                            </div>
                        ) : (
                            bestExportOpportunities.map((opp, index) => renderOpportunityRow(opp, index, true))
                        )
                    )}

                    {activeTab === 'bestImport' && (
                        bestImportOpportunities.length === 0 ? (
                            <div className="text-center py-8 sm:py-12 text-gray-500">
                                <Icon name="ArrowDownLeft" size={40} className="mx-auto mb-3 opacity-20" />
                                <p className="text-sm">暂无优质进口机会</p>
                                <p className="text-xs mt-1">当外国价格低于本地时会出现进口机会</p>
                            </div>
                        ) : (
                            bestImportOpportunities.map((opp, index) => renderOpportunityRow(opp, index, true))
                        )
                    )}
                </div>

                {/* Footer */}
                <div className="p-2 sm:p-4 border-t border-white/5 bg-gray-900/50 flex justify-between items-center text-[10px] sm:text-xs text-gray-500 flex-shrink-0">
                    <div className="flex gap-2 sm:gap-4">
                        <span>已建立: <span className="text-amber-300">{activeRoutes.length}</span></span>
                        <span className="hidden sm:inline">出口机会: <span className="text-green-400">{exportCount}</span></span>
                        <span className="hidden sm:inline">进口机会: <span className="text-blue-400">{importCount}</span></span>
                    </div>
                    <button
                        onClick={onClose}
                        className="px-3 sm:px-4 py-1.5 sm:py-2 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded transition-colors text-xs"
                    >
                        关闭
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default TradeRoutesModal;
