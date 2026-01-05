import { createPortal } from 'react-dom';
import { useState, useMemo, useEffect } from 'react';
import { Icon } from '../common/UIComponents';
import { RESOURCES } from '../../config';
import { calculateForeignPrice, calculateTradeStatus } from '../../utils/foreignTrade';
import { formatNumberShortCN } from '../../utils/numberFormat';

const TradeRoutesModal = ({
    tradeRoutes,
    nations,
    resources,
    market,
    taxPolicies,
    daysElapsed,
    epoch = 0,
    merchantCount = 0,
    merchantAssignments = {},
    merchantTradePreferences = { import: {}, export: {} },
    pendingTrades = [],
    onUpdateMerchantAssignments,
    onUpdateMerchantTradePreferences,
    onClose,
    onCancelRoute,
    onCreateRoute // New: allow creating routes from this modal
}) => {
    // Tab state: 'assignments', 'priceCompare'
    const [activeTab, setActiveTab] = useState('assignments');

    // New: trade route mode selector (controls create buttons)
    // normal: regular trade
    // force_sell: 倾销（强卖）
    // force_buy: 强买
    const [selectedRouteMode, setSelectedRouteMode] = useState('normal');
    // 价格对比分栏的资源筛选状态
    const [selectedResource, setSelectedResource] = useState(null);

    const assignedTotal = useMemo(() => {
        if (!merchantAssignments || typeof merchantAssignments !== 'object') return 0;
        return Object.values(merchantAssignments).reduce((sum, v) => sum + Math.max(0, Math.floor(Number(v) || 0)), 0);
    }, [merchantAssignments]);

    const remainingMerchants = Math.max(0, (merchantCount || 0) - assignedTotal);

    const setAssignment = (nationId, nextValue) => {
        if (!onUpdateMerchantAssignments) return;

        const nation = nations.find(n => n.id === nationId);
        const relation = nation?.relation || 0;
        const isAllied = nation?.alliedWithPlayer === true;
        const isOpenMarket = Boolean(nation?.openMarketUntil && daysElapsed < nation.openMarketUntil);

        const getMaxTradeRoutesForRelation = (rel = 0, allied = false) => {
            if (allied) return 4;
            if (rel >= 80) return 4;
            if (rel >= 60) return 3;
            if (rel >= 40) return 2;
            if (rel >= 20) return 1;
            return 0;
        };

        const cap = isOpenMarket ? 999 : getMaxTradeRoutesForRelation(relation, isAllied);
        const safe = Math.max(0, Math.min(cap, Math.floor(Number(nextValue) || 0)));

        const next = {
            ...(merchantAssignments && typeof merchantAssignments === 'object' ? merchantAssignments : {}),
            [nationId]: safe,
        };
        if (safe <= 0) {
            delete next[nationId];
        }
        onUpdateMerchantAssignments(next);
    };

    // Helper to get nation name by ID
    const getNationName = (id) => {
        const nation = nations.find(n => n.id === id);
        return nation ? nation.name : 'Unknown Nation';
    };

    const formatCompactNumber = (value) => {
        return formatNumberShortCN(value, { decimals: 1 });
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
    const hasTradeRoute = (nationId, resourceKey, type, mode = 'normal') => {
        if (!tradeRoutes?.routes) return false;
        const wantMode = mode || 'normal';
        return tradeRoutes.routes.some(route =>
            route.nationId === nationId &&
            route.resource === resourceKey &&
            route.type === type &&
            (route.mode || 'normal') === wantMode
        );
    };

    // Calculate estimated profit/cost for a potential trade opportunity
    const calculateTradeOpportunity = (nation, resourceKey, type) => {
        const localPrice = market?.prices?.[resourceKey] ?? (RESOURCES[resourceKey]?.basePrice || 1);
        const foreignPrice = calculateForeignPrice(resourceKey, nation, daysElapsed);
        const tradeStatus = calculateTradeStatus(resourceKey, nation, daysElapsed);

        const TRADE_SPEED = 0.05;
        const taxRate = taxPolicies?.resourceTaxRates?.[resourceKey] || 0;
        // 根据交易类型使用进口或出口关税倍率：0=无关税，1=100%关税，<0=补贴
        const tariffMultiplier = type === 'export'
            ? (taxPolicies?.exportTariffMultipliers?.[resourceKey] ?? taxPolicies?.resourceTariffMultipliers?.[resourceKey] ?? 0)
            : (taxPolicies?.importTariffMultipliers?.[resourceKey] ?? taxPolicies?.resourceTariffMultipliers?.[resourceKey] ?? 0);
        const effectiveTaxRate = taxRate * (1 + tariffMultiplier);

        const resourceName = RESOURCES[resourceKey]?.name || resourceKey;
        const isActive = hasTradeRoute(nation.id, resourceKey, type, selectedRouteMode);

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
                opportunity: {
                    ...calculateTradeOpportunity(nation, route.resource, route.type),
                    mode: route?.mode || 'normal',
                }
            };
        });
    }, [tradeRoutes.routes, nations, market, resources, taxPolicies, daysElapsed]);

    // Counts
    const exportCount = bestExportOpportunities.length;
    const importCount = bestImportOpportunities.length;

    // 为价格对比生成各国物价数据（按所选资源）
    const priceComparisonData = useMemo(() => {
        if (!selectedResource) return [];
        const localPrice = market?.prices?.[selectedResource] ?? (RESOURCES[selectedResource]?.basePrice || 1);

        return visibleNations.map(nation => {
            const foreignPrice = calculateForeignPrice(selectedResource, nation, daysElapsed);
            const priceDiff = foreignPrice - localPrice;
            const priceDiffPercent = localPrice > 0 ? (priceDiff / localPrice) * 100 : 0;
            const tradeStatus = calculateTradeStatus(selectedResource, nation, daysElapsed);

            return {
                nationId: nation.id,
                nationName: nation.name,
                nationColor: nation.color,
                relation: nation.relation || 0,
                isAllied: nation.alliedWithPlayer === true,
                localPrice,
                foreignPrice,
                priceDiff,
                priceDiffPercent,
                surplus: tradeStatus.surplusAmount || 0,
                shortage: tradeStatus.shortageAmount || 0,
                // 建议类型：外价高 -> 适合出口，外价低 -> 适合进口
                recommendation: priceDiff > localPrice * 0.1 ? 'export' :
                    priceDiff < -localPrice * 0.1 ? 'import' : 'neutral'
            };
        }).sort((a, b) => b.priceDiff - a.priceDiff); // 按价差降序排列
    }, [selectedResource, visibleNations, market, daysElapsed]);

    // New: Price scanner tab state (resource filtering)
    const [resourceSearch, setResourceSearch] = useState('');

    const filteredTradableResources = useMemo(() => {
        const q = (resourceSearch || '').trim().toLowerCase();
        if (!q) return tradableResources;
        return tradableResources.filter(([key, def]) => {
            const name = (def?.name || key).toLowerCase();
            return key.toLowerCase().includes(q) || name.includes(q);
        });
    }, [tradableResources, resourceSearch]);

    const selectedResourceDef = useMemo(() => {
        if (!selectedResource) return null;
        return RESOURCES[selectedResource] || null;
    }, [selectedResource]);

    const localSelectedPrice = useMemo(() => {
        if (!selectedResource) return null;
        return market?.prices?.[selectedResource] ?? (RESOURCES[selectedResource]?.basePrice || 1);
    }, [selectedResource, market]);

    const [priceSortField, setPriceSortField] = useState('diff'); // 'foreignPrice' | 'diff' | 'diffPct'
    const [priceSortDir, setPriceSortDir] = useState('desc'); // 'asc' | 'desc'

    const priceScannerRows = useMemo(() => {
        if (!selectedResource) return [];
        const localPrice = localSelectedPrice ?? 1;

        const rows = visibleNations.map(nation => {
            const foreignPrice = calculateForeignPrice(selectedResource, nation, daysElapsed);
            const diff = foreignPrice - localPrice;
            const diffPct = localPrice > 0 ? (diff / localPrice) * 100 : 0;
            return {
                nationId: nation.id,
                nationName: nation.name,
                nationColor: nation.color,
                relation: nation.relation || 0,
                isAllied: nation.alliedWithPlayer === true,
                localPrice,
                foreignPrice,
                diff,
                diffPct,
            };
        });

        const dir = priceSortDir === 'asc' ? 1 : -1;
        const getValue = (row) => {
            if (priceSortField === 'foreignPrice') return row.foreignPrice;
            if (priceSortField === 'diffPct') return row.diffPct;
            return row.diff; // default
        };

        return rows.slice().sort((a, b) => {
            const av = getValue(a);
            const bv = getValue(b);
            if (av === bv) return 0;
            return av > bv ? dir : -dir;
        });
    }, [selectedResource, visibleNations, daysElapsed, localSelectedPrice, priceSortField, priceSortDir]);

    const tabs = [
        { id: 'assignments', label: '派驻商人', shortLabel: '派驻', count: assignedTotal, icon: 'Users' },
        { id: 'activeTrades', label: '进行中贸易', shortLabel: '进行中', count: pendingTrades.length, icon: 'Loader' },
        { id: 'priceCompare', label: '物价对比', shortLabel: '物价', count: tradableResources.length, icon: 'BarChart2' },
    ];

    const getMaxTradeRoutesForRelation = (relation = 0, isAllied = false) => {
        if (isAllied) return 4;
        if (relation >= 80) return 4; // Intimate
        if (relation >= 60) return 3; // Friendly
        if (relation >= 40) return 2; // Neutral
        if (relation >= 20) return 1; // Cold
        return 0; // Hostile: no trade
    };

    const isOpenMarketActiveWithNation = (nation) => {
        return Boolean(nation?.openMarketUntil && daysElapsed < nation.openMarketUntil);
    };

    const renderAssignmentRow = (nation) => {
        const valueRaw = merchantAssignments?.[nation.id] ?? 0;
        const value = Math.max(0, Math.floor(Number(valueRaw) || 0));

        const maxWithNation = isOpenMarketActiveWithNation(nation)
            ? 999
            : getMaxTradeRoutesForRelation(nation.relation || 0, nation.alliedWithPlayer === true);

        const disabledInc = remainingMerchants <= 0 || nation.isAtWar || value >= maxWithNation;
        const disabledDec = value <= 0;

        return (
            <div
                key={nation.id}
                className="grid grid-cols-12 gap-2 items-center p-3 rounded-lg bg-gray-800/40 border border-white/5 hover:bg-gray-800/60 hover:border-white/10 transition-colors text-sm"
            >
                <div className="col-span-5 flex items-center gap-2 min-w-0">
                    <Icon name="Flag" size={14} className={nation.color || 'text-gray-300'} />
                    <div className="min-w-0">
                        <div className="font-medium text-gray-200 truncate" title={nation.name}>{nation.name}</div>
                        <div className="text-[10px] text-gray-500">关系 {Math.round(nation.relation || 0)}{nation.alliedWithPlayer ? ' · 盟友' : ''}</div>
                    </div>
                </div>

                <div className="col-span-3 text-right text-xs text-gray-400">
                    <div>战争: <span className={nation.isAtWar ? 'text-red-400' : 'text-green-400'}>{nation.isAtWar ? '是' : '否'}</span></div>
                    {nation.isAtWar && <div className="text-[10px] text-red-400">交战国不可贸易</div>}
                    {!nation.isAtWar && maxWithNation === 0 && <div className="text-[10px] text-red-400">关系敌对不可派驻</div>}
                    {!nation.isAtWar && maxWithNation > 0 && maxWithNation < 999 && <div className="text-[10px] text-gray-500">上限 {maxWithNation}</div>}
                    {!nation.isAtWar && maxWithNation >= 999 && <div className="text-[10px] text-green-400">开放市场：无限制</div>}
                </div>

                <div className="col-span-4 flex items-center justify-end gap-2">
                    <button
                        className="w-8 h-8 rounded bg-gray-700 hover:bg-gray-600 text-white border border-white/10 disabled:opacity-40 disabled:cursor-not-allowed"
                        onClick={() => setAssignment(nation.id, value - 1)}
                        disabled={disabledDec}
                        title="减少 1"
                    >
                        <Icon name="Minus" size={14} />
                    </button>

                    <input
                        className="w-16 h-8 rounded bg-gray-900/60 border border-white/10 text-gray-100 text-center font-mono"
                        value={value}
                        onChange={(e) => setAssignment(nation.id, e.target.value)}
                        inputMode="numeric"
                        disabled={nation.isAtWar || maxWithNation === 0}
                    />

                    <button
                        className="w-8 h-8 rounded bg-amber-600/70 hover:bg-amber-600 text-white border border-amber-400/30 disabled:opacity-40 disabled:cursor-not-allowed"
                        onClick={() => setAssignment(nation.id, value + 1)}
                        disabled={disabledInc}
                        title={nation.isAtWar ? '战争中不可派驻' : (maxWithNation === 0 ? '关系敌对不可派驻' : (value >= maxWithNation ? '已达该国派驻上限' : (remainingMerchants <= 0 ? '没有可用商人' : '增加 1')))}
                    >
                        <Icon name="Plus" size={14} />
                    </button>
                </div>
            </div>
        );
    };

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
                <div className="col-span-2 flex items-center gap-1 min-w-0">
                    <span className="text-gray-300 truncate">{opp.resourceName}</span>
                    {opp.mode && opp.mode !== 'normal' && (
                        <span
                            className={`px-1.5 py-0.5 rounded text-[9px] border ${opp.mode === 'force_sell'
                                ? 'bg-red-500/10 text-red-300 border-red-500/20'
                                : 'bg-purple-500/10 text-purple-300 border-purple-500/20'
                                }`}
                            title={opp.mode === 'force_sell' ? '倾销（强卖）' : '强买'}
                        >
                            {opp.mode === 'force_sell' ? '倾销' : '强买'}
                        </span>
                    )}
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
                            {formatCompactNumber(opp.possibleVolume)}/天
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
                            onClick={() => onCreateRoute(opp.nationId, opp.resource, opp.type, { mode: selectedRouteMode })}
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

            {/* Modal Content - Fixed height to prevent jumping when market data changes */}
            <div className="relative w-full max-w-2xl glass-panel border-2 border-amber-500/30 rounded-2xl shadow-2xl overflow-hidden animate-slide-up bg-gray-900/90 h-[85vh] sm:h-[80vh] max-h-[700px] flex flex-col">
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
                            {/* Show short label on narrow screens, full label on wider screens */}
                            <span className="sm:hidden">{tab.shortLabel}</span>
                            <span className="hidden sm:inline">{tab.label}</span>
                            <span className={`px-1 sm:px-1.5 py-0.5 rounded text-[10px] sm:text-xs ${activeTab === tab.id ? 'bg-amber-500/20 text-amber-200' : 'bg-gray-700 text-gray-400'
                                }`}>
                                {tab.count}
                            </span>
                        </button>
                    ))}
                </div>

                {/* Scrollable List */}
                <div className="flex-1 overflow-y-auto p-2 sm:p-4 space-y-2 sm:space-y-3 custom-scrollbar">
                    {activeTab === 'assignments' && (
                        <div className="space-y-2">
                            <div className="p-3 rounded-lg bg-amber-900/20 border border-amber-500/20 text-xs text-gray-300">
                                <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2">
                                        <Icon name="Users" size={14} className="text-amber-300" />
                                        <span className="font-semibold text-amber-100">商人派驻</span>
                                    </div>
                                    <div className="font-mono text-[11px]">
                                        总商人: <span className="text-amber-300">{merchantCount}</span>
                                        <span className="text-gray-500"> / </span>
                                        已派驻: <span className="text-blue-300">{assignedTotal}</span>
                                        <span className="text-gray-500"> / </span>
                                        剩余: <span className={remainingMerchants > 0 ? 'text-green-400' : 'text-red-400'}>{remainingMerchants}</span>
                                    </div>
                                </div>
                                <div className="mt-1 text-[10px] text-gray-400">
                                    派驻到某国的商人越多，每回合越倾向在该国寻找最赚钱且最能修复供需缺口的交易。交战国自动无法贸易。
                                </div>
                            </div>

                            {/* Preference Controls (scalable + multi-select) */}
                            <div className="p-3 rounded-lg bg-gray-800/30 border border-white/5">
                                <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2">
                                        <Icon name="Target" size={14} className="text-amber-300" />
                                        <span className="font-semibold text-gray-100">贸易偏好</span>
                                    </div>
                                    <div className="text-[10px] text-gray-500">多选 · 影响商人选品权重</div>
                                </div>

                                <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {/* Import prefs */}
                                    <div className="rounded-lg border border-white/5 bg-gray-900/30 p-2">
                                        <div className="flex items-center justify-between">
                                            <div className="text-xs font-semibold text-blue-200 flex items-center gap-1">
                                                <Icon name="ArrowDown" size={12} className="text-blue-300" />
                                                进口优先
                                            </div>
                                            <button
                                                className="text-[10px] px-2 py-1 rounded bg-gray-700/50 hover:bg-gray-700 text-gray-200"
                                                onClick={() => {
                                                    if (!onUpdateMerchantTradePreferences) return;
                                                    onUpdateMerchantTradePreferences({
                                                        ...(merchantTradePreferences || { import: {}, export: {} }),
                                                        import: {},
                                                    });
                                                }}
                                                title="清空进口偏好"
                                            >
                                                清空
                                            </button>
                                        </div>

                                        <div className="mt-2 flex flex-wrap gap-1.5 max-h-28 overflow-y-auto custom-scrollbar">
                                            {tradableResources.map(([resourceKey, def]) => {
                                                const current = merchantTradePreferences?.import?.[resourceKey] ?? 1;
                                                const isSelected = (current ?? 1) > 1.05;
                                                const bias = isSelected ? current : 1.6;
                                                return (
                                                    <button
                                                        key={`imp-${resourceKey}`}
                                                        className={`px-2 py-1 rounded border text-[10px] transition-colors ${isSelected
                                                            ? 'bg-blue-500/15 border-blue-400/30 text-blue-200'
                                                            : 'bg-gray-800/30 border-white/5 text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'
                                                            }`}
                                                        onClick={() => {
                                                            if (!onUpdateMerchantTradePreferences) return;
                                                            const base = merchantTradePreferences && typeof merchantTradePreferences === 'object'
                                                                ? merchantTradePreferences
                                                                : { import: {}, export: {} };
                                                            const nextImport = { ...(base.import || {}) };
                                                            if (isSelected) delete nextImport[resourceKey];
                                                            else nextImport[resourceKey] = bias;
                                                            onUpdateMerchantTradePreferences({
                                                                ...base,
                                                                import: nextImport,
                                                            });
                                                        }}
                                                        title={isSelected ? `已偏好 x${Number(current).toFixed(1)}（点击取消）` : `点击设置为偏好 x${bias.toFixed(1)}`}
                                                    >
                                                        {def?.name || resourceKey}
                                                        {isSelected && <span className="ml-1 text-blue-300 font-mono">x{Number(current).toFixed(1)}</span>}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* Export prefs */}
                                    <div className="rounded-lg border border-white/5 bg-gray-900/30 p-2">
                                        <div className="flex items-center justify-between">
                                            <div className="text-xs font-semibold text-green-200 flex items-center gap-1">
                                                <Icon name="ArrowUp" size={12} className="text-green-300" />
                                                出口优先
                                            </div>
                                            <button
                                                className="text-[10px] px-2 py-1 rounded bg-gray-700/50 hover:bg-gray-700 text-gray-200"
                                                onClick={() => {
                                                    if (!onUpdateMerchantTradePreferences) return;
                                                    onUpdateMerchantTradePreferences({
                                                        ...(merchantTradePreferences || { import: {}, export: {} }),
                                                        export: {},
                                                    });
                                                }}
                                                title="清空出口偏好"
                                            >
                                                清空
                                            </button>
                                        </div>

                                        <div className="mt-2 flex flex-wrap gap-1.5 max-h-28 overflow-y-auto custom-scrollbar">
                                            {tradableResources.map(([resourceKey, def]) => {
                                                const current = merchantTradePreferences?.export?.[resourceKey] ?? 1;
                                                const isSelected = (current ?? 1) > 1.05;
                                                const bias = isSelected ? current : 1.6;
                                                return (
                                                    <button
                                                        key={`exp-${resourceKey}`}
                                                        className={`px-2 py-1 rounded border text-[10px] transition-colors ${isSelected
                                                            ? 'bg-green-500/15 border-green-400/30 text-green-200'
                                                            : 'bg-gray-800/30 border-white/5 text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'
                                                            }`}
                                                        onClick={() => {
                                                            if (!onUpdateMerchantTradePreferences) return;
                                                            const base = merchantTradePreferences && typeof merchantTradePreferences === 'object'
                                                                ? merchantTradePreferences
                                                                : { import: {}, export: {} };
                                                            const nextExport = { ...(base.export || {}) };
                                                            if (isSelected) delete nextExport[resourceKey];
                                                            else nextExport[resourceKey] = bias;
                                                            onUpdateMerchantTradePreferences({
                                                                ...base,
                                                                export: nextExport,
                                                            });
                                                        }}
                                                        title={isSelected ? `已偏好 x${Number(current).toFixed(1)}（点击取消）` : `点击设置为偏好 x${bias.toFixed(1)}`}
                                                    >
                                                        {def?.name || resourceKey}
                                                        {isSelected && <span className="ml-1 text-green-300 font-mono">x{Number(current).toFixed(1)}</span>}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-2 text-[10px] text-gray-500">
                                    提示：偏好会把该资源的候选分数乘以倍率（范围 0.1～5）。可以同时偏好多个商品。
                                </div>
                            </div>

                            {/* Assignments list header */}
                            <div className="grid grid-cols-12 gap-1 sm:gap-2 px-1 sm:px-2 py-2 bg-white/5 text-[10px] sm:text-xs font-bold text-gray-400 uppercase tracking-wider border border-white/5 rounded-lg">
                                <div className="col-span-5">国家</div>
                                <div className="col-span-3 text-right">限制</div>
                                <div className="col-span-4 text-right">派驻商人</div>
                            </div>

                            {visibleNations.length === 0 ? (
                                <div className="text-center py-10 text-gray-500">
                                    <Icon name="Flag" size={40} className="mx-auto mb-3 opacity-20" />
                                    <p className="text-sm">暂无可接触国家</p>
                                </div>
                            ) : (
                                visibleNations
                                    .slice()
                                    .sort((a, b) => (b.relation || 0) - (a.relation || 0))
                                    .map(renderAssignmentRow)
                            )}
                        </div>
                    )}

                    {activeTab === 'activeTrades' && (
                        <div className="space-y-2">
                            <div className="p-3 rounded-lg bg-amber-900/20 border border-amber-500/20 text-xs text-gray-300">
                                <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2">
                                        <Icon name="Loader" size={14} className="text-amber-300 animate-spin" />
                                        <span className="font-semibold text-amber-100">进行中贸易</span>
                                    </div>
                                    <div className="font-mono text-[11px]">
                                        共 <span className="text-amber-300">{pendingTrades.length}</span> 笔交易运输中
                                    </div>
                                </div>
                                <div className="mt-1 text-[10px] text-gray-400">
                                    商人发起贸易后需要一定时间完成运输，完成后才会结算收益。
                                </div>
                            </div>

                            {pendingTrades.length === 0 ? (
                                <div className="space-y-3">
                                    <div className="text-center py-6 text-gray-500">
                                        <Icon name="PackageOpen" size={40} className="mx-auto mb-3 opacity-20" />
                                        <p className="text-sm">当前没有进行中的贸易</p>
                                        <p className="text-xs text-gray-600 mt-1">派驻商人到其他国家后，他们会自动发起贸易</p>
                                    </div>

                                    {/* 调试信息面板 */}
                                    <div className="p-3 rounded-lg bg-red-900/20 border border-red-500/30 text-xs">
                                        <div className="flex items-center gap-2 mb-2">
                                            <Icon name="Bug" size={14} className="text-red-400" />
                                            <span className="font-semibold text-red-300">诊断信息</span>
                                        </div>
                                        <div className="mt-2 pt-2 border-t border-red-500/20 text-[10px] text-gray-400">
                                            <p>可能原因分析:</p>
                                            <ul className="list-disc list-inside mt-1 space-y-0.5">
                                                {merchantCount <= 0 && <li className="text-red-300">商人数量为0</li>}
                                                {assignedTotal <= 0 && <li className="text-red-300">没有派驻商人到任何国家</li>}
                                                {assignedTotal > 0 && merchantCount > 0 && (
                                                    <li className="text-yellow-300">可能是价差不足或市场条件不满足</li>
                                                )}
                                            </ul>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {/* Header */}
                                    <div className="grid grid-cols-12 gap-1 sm:gap-2 px-1 sm:px-2 py-2 bg-white/5 text-[10px] sm:text-xs font-bold text-gray-400 uppercase tracking-wider border border-white/5 rounded-lg">
                                        <div className="col-span-2">类型</div>
                                        <div className="col-span-3">商品</div>
                                        <div className="col-span-2 text-right">数量</div>
                                        <div className="col-span-3">贸易伙伴</div>
                                        <div className="col-span-2 text-right">剩余</div>
                                    </div>

                                    {/* Trades list */}
                                    {pendingTrades.map((trade, idx) => {
                                        const resourceDef = RESOURCES[trade.resource];
                                        const resourceName = resourceDef?.name || trade.resource;
                                        const resourceIcon = resourceDef?.icon || 'Box';
                                        const resourceColor = resourceDef?.color || 'text-gray-400';
                                        const partnerNation = nations.find(n => n?.id === trade.partnerId);
                                        const partnerName = partnerNation?.name || trade.partnerId || '未知';
                                        const isExport = trade.type === 'export';

                                        return (
                                            <div
                                                key={`${trade.partnerId}-${trade.resource}-${trade.type}-${idx}`}
                                                className={`grid grid-cols-12 gap-1 sm:gap-2 items-center p-2 sm:p-3 rounded-lg border transition-colors text-xs sm:text-sm ${isExport
                                                    ? 'bg-green-900/20 border-green-500/20 hover:bg-green-900/30'
                                                    : 'bg-blue-900/20 border-blue-500/20 hover:bg-blue-900/30'
                                                    }`}
                                            >
                                                {/* Type */}
                                                <div className="col-span-2">
                                                    <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${isExport
                                                        ? 'bg-green-500/20 text-green-300'
                                                        : 'bg-blue-500/20 text-blue-300'
                                                        }`}>
                                                        {isExport ? '出口' : '进口'}
                                                    </span>
                                                </div>

                                                {/* Resource */}
                                                <div className="col-span-3 flex items-center gap-1.5">
                                                    <Icon name={resourceIcon} size={14} className={resourceColor} />
                                                    <span className="text-gray-200 truncate">{resourceName}</span>
                                                </div>

                                                {/* Amount */}
                                                <div className="col-span-2 text-right font-mono text-gray-300">
                                                    {trade.amount?.toFixed(1) || '0'}
                                                </div>

                                                {/* Partner */}
                                                <div className="col-span-3 flex items-center gap-1.5">
                                                    <Icon name="Flag" size={12} className={partnerNation?.color || 'text-gray-400'} />
                                                    <span className="text-gray-200 truncate" title={partnerName}>{partnerName}</span>
                                                </div>

                                                {/* Remaining days */}
                                                <div className="col-span-2 text-right">
                                                    <span className="px-2 py-0.5 rounded bg-gray-700/50 text-amber-300 font-mono text-[10px]">
                                                        {trade.daysRemaining || 0}天
                                                    </span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'priceCompare' && (
                        <div className="space-y-2">
                            <div className="p-3 rounded-lg bg-gray-800/30 border border-white/5 text-xs text-gray-300">
                                <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2">
                                        <Icon name="BarChart2" size={14} className="text-blue-300" />
                                        <span className="font-semibold text-gray-100">物价对比</span>
                                    </div>
                                    <div className="text-[10px] text-gray-500">筛选资源 → 查看各国相对本地价差</div>
                                </div>

                                <div className="mt-2 flex items-center gap-2">
                                    <div className="relative flex-1">
                                        <div className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500">
                                            <Icon name="Search" size={14} />
                                        </div>
                                        <input
                                            className="w-full pl-8 pr-2 py-2 rounded bg-gray-900/60 border border-white/10 text-gray-100 text-xs"
                                            value={resourceSearch}
                                            onChange={(e) => setResourceSearch(e.target.value)}
                                            placeholder="搜索资源..."
                                        />
                                    </div>
                                    <button
                                        className="px-2 py-2 rounded bg-gray-700/40 hover:bg-gray-700 text-gray-200 text-xs"
                                        onClick={() => {
                                            setResourceSearch('');
                                            setSelectedResource(null);
                                        }}
                                        title="清空筛选"
                                    >
                                        清空
                                    </button>
                                </div>

                                {/* New: route mode selector */}
                                <div className="mt-2 flex items-center gap-2">
                                    <div className="text-[10px] text-gray-500">创建路线模式：</div>
                                    <div className="inline-flex rounded-lg overflow-hidden border border-white/10">
                                        <button
                                            type="button"
                                            onClick={() => setSelectedRouteMode('normal')}
                                            className={`px-2 py-1 text-[10px] transition-colors ${selectedRouteMode === 'normal'
                                                ? 'bg-amber-500/20 text-amber-200'
                                                : 'bg-gray-800/40 text-gray-400 hover:text-gray-200'
                                                }`}
                                            title="正常贸易：遵循对方盈余/缺口"
                                        >
                                            正常
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setSelectedRouteMode('force_sell')}
                                            className={`px-2 py-1 text-[10px] transition-colors ${selectedRouteMode === 'force_sell'
                                                ? 'bg-red-500/20 text-red-200'
                                                : 'bg-gray-800/40 text-gray-400 hover:text-gray-200'
                                                }`}
                                            title="倾销：允许强卖（出口无视对方缺口），会折价且损失关系"
                                        >
                                            倾销
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setSelectedRouteMode('force_buy')}
                                            className={`px-2 py-1 text-[10px] transition-colors ${selectedRouteMode === 'force_buy'
                                                ? 'bg-purple-500/20 text-purple-200'
                                                : 'bg-gray-800/40 text-gray-400 hover:text-gray-200'
                                                }`}
                                            title="强买：允许强买（进口无视对方盈余），会溢价且损失关系"
                                        >
                                            强买
                                        </button>
                                    </div>
                                    <div className="text-[10px] text-gray-600 hidden sm:block">
                                        倾销/强买：关系下降，且价格会被折价/溢价
                                    </div>
                                </div>

                                <div className="mt-2 flex flex-wrap gap-1.5 max-h-28 overflow-y-auto custom-scrollbar">
                                    {filteredTradableResources.map(([resourceKey, def]) => {
                                        const isSelected = selectedResource === resourceKey;
                                        return (
                                            <button
                                                key={`res-${resourceKey}`}
                                                className={`px-2 py-1 rounded border text-[10px] transition-colors ${isSelected
                                                    ? 'bg-amber-500/15 border-amber-400/30 text-amber-200'
                                                    : 'bg-gray-800/30 border-white/5 text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'
                                                    }`}
                                                onClick={() => setSelectedResource(isSelected ? null : resourceKey)}
                                                title={def?.name || resourceKey}
                                            >
                                                {def?.name || resourceKey}
                                            </button>
                                        );
                                    })}
                                </div>

                                {selectedResource && (
                                    <div className="mt-2 text-[10px] text-gray-400">
                                        当前资源：<span className="text-amber-200 font-semibold">{selectedResourceDef?.name || selectedResource}</span>
                                        <span className="text-gray-600"> · </span>
                                        本地价：<span className="text-white font-mono">{Number(localSelectedPrice ?? 0).toFixed(1)}</span>
                                        <span className="text-gray-600"> · </span>
                                        <span className="text-green-300">绿色=外价更高（适合出口）</span>
                                        <span className="text-gray-600"> / </span>
                                        <span className="text-blue-300">蓝色=外价更低（适合进口）</span>
                                    </div>
                                )}
                            </div>

                            {!selectedResource ? (
                                <div className="text-center py-10 text-gray-500">
                                    <Icon name="Filter" size={40} className="mx-auto mb-3 opacity-20" />
                                    <p className="text-sm">先选择一个资源</p>
                                </div>
                            ) : priceScannerRows.length === 0 ? (
                                <div className="text-center py-10 text-gray-500">
                                    <Icon name="BarChart2" size={40} className="mx-auto mb-3 opacity-20" />
                                    <p className="text-sm">暂无可对比国家</p>
                                </div>
                            ) : (
                                <div className="rounded-lg border border-white/5 overflow-hidden">
                                    <div className="grid grid-cols-12 gap-2 px-2 py-2 bg-white/5 text-[10px] font-bold text-gray-400 uppercase tracking-wider select-none">
                                        <div className="col-span-4">国家</div>

                                        <button
                                            type="button"
                                            className="col-span-3 text-right hover:text-gray-200"
                                            onClick={() => {
                                                setPriceSortField('foreignPrice');
                                                setPriceSortDir((prev) => (priceSortField === 'foreignPrice' ? (prev === 'desc' ? 'asc' : 'desc') : 'desc'));
                                            }}
                                            title="按外价排序"
                                        >
                                            外价{priceSortField === 'foreignPrice' ? (priceSortDir === 'desc' ? ' ↓' : ' ↑') : ''}
                                        </button>

                                        <button
                                            type="button"
                                            className="col-span-3 text-right hover:text-gray-200"
                                            onClick={() => {
                                                setPriceSortField('diff');
                                                setPriceSortDir((prev) => (priceSortField === 'diff' ? (prev === 'desc' ? 'asc' : 'desc') : 'desc'));
                                            }}
                                            title="按相对本地价差排序"
                                        >
                                            相对本地{priceSortField === 'diff' ? (priceSortDir === 'desc' ? ' ↓' : ' ↑') : ''}
                                        </button>

                                        <button
                                            type="button"
                                            className="col-span-2 text-right hover:text-gray-200"
                                            onClick={() => {
                                                setPriceSortField('diffPct');
                                                setPriceSortDir((prev) => (priceSortField === 'diffPct' ? (prev === 'desc' ? 'asc' : 'desc') : 'desc'));
                                            }}
                                            title="按百分比排序"
                                        >
                                            %{priceSortField === 'diffPct' ? (priceSortDir === 'desc' ? ' ↓' : ' ↑') : ''}
                                        </button>
                                    </div>
                                    <div className="divide-y divide-white/5">
                                        {priceScannerRows.map((row) => {
                                            const diffClass = row.diff > 0
                                                ? 'text-green-300'
                                                : row.diff < 0
                                                    ? 'text-blue-300'
                                                    : 'text-gray-300';
                                            const sign = row.diff > 0 ? '+' : '';
                                            return (
                                                <div key={row.nationId} className="grid grid-cols-12 gap-2 px-2 py-2 text-[11px] hover:bg-white/5">
                                                    <div className="col-span-4 flex items-center gap-2 min-w-0">
                                                        <Icon name="Flag" size={12} className={row.nationColor || 'text-gray-300'} />
                                                        <span className="truncate text-gray-200" title={row.nationName}>{row.nationName}</span>
                                                    </div>
                                                    <div className="col-span-3 text-right font-mono text-gray-200">{row.foreignPrice.toFixed(1)}</div>
                                                    <div className={`col-span-3 text-right font-mono ${diffClass}`}>{sign}{row.diff.toFixed(1)}</div>
                                                    <div className={`col-span-2 text-right font-mono ${diffClass}`}>{sign}{row.diffPct.toFixed(0)}%</div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-2 sm:p-4 border-t border-white/5 bg-gray-900/50 flex justify-between items-center text-[10px] sm:text-xs text-gray-500 flex-shrink-0">
                    <div className="flex gap-2 sm:gap-4">
                        <span>已派驻: <span className="text-blue-300">{assignedTotal}</span></span>
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
