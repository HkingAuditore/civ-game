/**
 * International Economy Dashboard
 * Unifies Overseas Investment (Outgoing) and Foreign Investment (Incoming) management.
 */

import React, { useState, useMemo, useEffect, memo } from 'react';
import { BottomSheet } from '../tabs/BottomSheet';
import { Icon, Tabs, Card, Button, Badge } from '../common/UnifiedUI';
import { BUILDINGS, RESOURCES } from '../../config';
import { formatNumberShortCN } from '../../utils/numberFormat';
import {
    calculateOverseasInvestmentSummary,
    FOREIGN_INVESTMENT_POLICIES,
    getOverseasInvestmentGroupKey,
} from '../../logic/diplomacy/overseasInvestment';

// --- Configuration ---

const PAGE_SIZE = 20;

const TABS = [
    { id: 'assets', label: '海外资产', icon: 'Globe' },
    { id: 'capital', label: '外资企业', icon: 'Landmark' },
];

const STRATUM_CONFIG = {
    capitalist: { name: '资本家', color: 'text-purple-400', bg: 'bg-purple-900/30' },
    merchant: { name: '商人', color: 'text-amber-400', bg: 'bg-amber-900/30' },
    landowner: { name: '地主', color: 'text-green-400', bg: 'bg-green-900/30' },
};

// --- Sub-components ---

const ResourceFlowBadge = ({ type, resource, amount }) => {
    const isLocal = type === 'local';
    const isHome = type === 'home';
    return (
        <div className={`flex items-center gap-1 text-xs px-1.5 py-0.5 rounded border ${
            isHome
                ? 'bg-purple-900/40 border-purple-500/30 text-purple-300'
                : 'bg-gray-800/60 border-gray-600/30 text-gray-400'
        }`}>
            {isHome && <Icon name={amount > 0 ? "Upload" : "Download"} size={10} className="mr-0.5" />}
            <span>{isHome ? '跨国' : '本地'}</span>
            <span className={isHome ? 'text-white font-bold' : 'text-gray-300'}>
                {RESOURCES[resource]?.name}
            </span>
        </div>
    );
};

const FlowVisualizer = ({ building, decisions }) => {
    if (!building) return null;

    const inputEntries = Object.entries(building.input || {});
    const outputEntries = Object.entries(building.output || {}).filter(([k]) => !['maxPop', 'militaryCapacity'].includes(k));

    return (
        <div className="flex items-center gap-2 w-full bg-black/20 p-2 rounded-lg mt-2 overflow-x-auto">
            {/* Inputs */}
            <div className="flex flex-col gap-1 min-w-fit">
                {inputEntries.length > 0 ? inputEntries.map(([res, amt]) => (
                    <div key={res} className="flex items-center justify-end gap-1">
                         <ResourceFlowBadge type={decisions?.inputs?.[res] || 'local'} resource={res} amount={-amt} />
                    </div>
                )) : <span className="text-xs text-gray-600 text-right px-2">无原料</span>}
            </div>

            {/* Arrow */}
            <Icon name="ArrowRight" size={14} className="text-gray-500 flex-shrink-0" />

            {/* Factory */}
            <div className="flex flex-col items-center min-w-fit px-2">
                 <Icon name={building.visual?.icon || 'Factory'} size={20} className="text-gray-400" />
            </div>

             {/* Arrow */}
             <Icon name="ArrowRight" size={14} className="text-gray-500 flex-shrink-0" />

            {/* Outputs */}
            <div className="flex flex-col gap-1 min-w-fit">
                {outputEntries.length > 0 ? outputEntries.map(([res, amt]) => (
                    <div key={res} className="flex items-center gap-1">
                        <ResourceFlowBadge type={decisions?.outputs?.[res] || 'local'} resource={res} amount={amt} />
                    </div>
                )) : <span className="text-xs text-gray-600 px-2">无产出</span>}
            </div>
        </div>
    );
};

/**
 * Tab 1: Overseas Assets (Outgoing)
 */
const OverseasAssetsTab = ({ overseasInvestments, nations, summary }) => {
    const [page, setPage] = useState(1);
    const [expandedIds, setExpandedIds] = useState(new Set());

    const activeInvestments = useMemo(() => {
        const grouped = new Map();
        overseasInvestments
            .filter(inv => inv.status === 'operating')
            .forEach(inv => {
                const key = getOverseasInvestmentGroupKey(inv);
                if (!grouped.has(key)) {
                    grouped.set(key, {
                        ...inv,
                        count: 0,
                        profitPerDay: 0,
                        repatriatedPerDay: 0,
                        taxPerDay: 0,
                        investmentAmount: 0,
                        decisions: inv.operatingData?.decisions,
                    });
                }
                const entry = grouped.get(key);
                entry.count += inv.count || 1;
                entry.investmentAmount += inv.investmentAmount || 0;
                const profit = inv.operatingData?.profit || 0;
                const repatriated = inv.operatingData?.repatriatedProfit;
                const retained = inv.operatingData?.retainedProfit;
                entry.profitPerDay += profit;
                entry.repatriatedPerDay += typeof repatriated === 'number' ? repatriated : profit;
                entry.taxPerDay += typeof retained === 'number' ? retained : 0;
                if (!entry.decisions && inv.operatingData?.decisions) {
                    entry.decisions = inv.operatingData.decisions;
                }
            });

        return Array.from(grouped.values())
            .map(inv => {
                const nation = nations.find(n => n.id === inv.targetNationId);
                const building = BUILDINGS.find(b => b.id === inv.buildingId);
                const effectiveTaxRate = inv.profitPerDay > 0
                    ? (inv.taxPerDay / inv.profitPerDay)
                    : 0;

                return {
                    ...inv,
                    nationName: nation?.name || '未知国家',
                    nationColor: nation?.color,
                    building,
                    buildingName: building?.name || '未知建筑',
                    effectiveTaxRate,
                };
            })
            .sort((a, b) => b.investmentAmount - a.investmentAmount);
    }, [overseasInvestments, nations]);

    // 数据变化时重置到第一页
    useEffect(() => {
        setPage(1);
        setExpandedIds(new Set());
    }, [overseasInvestments]);

    const totalPages = Math.max(1, Math.ceil(activeInvestments.length / PAGE_SIZE));
    const pagedInvestments = activeInvestments.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    const toggleExpand = (id) => {
        setExpandedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    };

    return (
        <div className="space-y-4">
             {/* Summary Cards */}
             <div className="grid grid-cols-3 gap-2">
                <div className="bg-gradient-to-br from-amber-900/40 to-black/40 rounded-lg p-2.5 border border-amber-700/30 shadow-lg">
                    <div className="text-xs text-amber-500 uppercase tracking-wider font-bold mb-0.5">总资产价值</div>
                    <div className="text-lg font-bold text-amber-200 font-mono">
                        {formatNumberShortCN(summary.totalValue)}
                    </div>
                </div>
                <div className="bg-gradient-to-br from-green-900/40 to-black/40 rounded-lg p-2.5 border border-green-700/30 shadow-lg">
                    <div className="text-xs text-green-500 uppercase tracking-wider font-bold mb-0.5">日净汇回</div>
                    <div className="text-lg font-bold text-green-300 font-mono">
                        +{formatNumberShortCN(summary.estimatedDailyProfit)}
                    </div>
                </div>
                <div className="bg-gradient-to-br from-blue-900/40 to-black/40 rounded-lg p-2.5 border border-blue-700/30 shadow-lg">
                    <div className="text-xs text-blue-500 uppercase tracking-wider font-bold mb-0.5">运营项目</div>
                    <div className="text-lg font-bold text-blue-200 font-mono">
                        {summary.count}
                    </div>
                </div>
            </div>

            {/* List */}
            <div className="bg-gray-800/30 rounded-lg border border-white/5 overflow-hidden">
                <div className="px-3 py-2 bg-white/5 border-b border-white/5 flex justify-between items-center">
                    <span className="text-xs font-bold text-gray-300">资产列表</span>
                    <span className="text-xs text-gray-500">
                        共 {activeInvestments.length} 类 · 点击条目展开流程
                    </span>
                </div>
                <div className="divide-y divide-white/5">
                    {pagedInvestments.length > 0 ? pagedInvestments.map(inv => {
                        const isExpanded = expandedIds.has(inv.id);
                        return (
                            <div key={inv.id} className="px-3 py-2 hover:bg-white/5 transition-colors">
                                {/* Clickable header row */}
                                <div
                                    className="flex justify-between items-start mb-1.5 cursor-pointer"
                                    onClick={() => toggleExpand(inv.id)}
                                >
                                    <div className="flex items-center gap-2">
                                        <div className="w-7 h-7 rounded bg-gray-700 flex items-center justify-center flex-shrink-0">
                                            <Icon name={inv.building?.visual?.icon || "Building"} size={14} className="text-gray-300"/>
                                        </div>
                                        <div>
                                            <div className="text-sm font-bold text-gray-200 flex items-center gap-2">
                                                {inv.buildingName}
                                                <Badge variant="neutral" className="text-xs scale-90">
                                                    {STRATUM_CONFIG[inv.ownerStratum]?.name || inv.ownerStratum}
                                                </Badge>
                                                {inv.count > 1 && (
                                                    <Badge variant="secondary" className="text-xs scale-90">
                                                        ×{inv.count}
                                                    </Badge>
                                                )}
                                            </div>
                                            <div className="text-xs text-gray-400 flex items-center gap-1">
                                                <Icon name="MapPin" size={10}/>
                                                <span className={inv.nationColor}>{inv.nationName}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="text-right">
                                            <div className={`text-sm font-mono font-bold ${inv.repatriatedPerDay >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                {inv.repatriatedPerDay >= 0 ? '+' : ''}{Math.round(inv.repatriatedPerDay)}/日
                                            </div>
                                            <div className="text-xs text-gray-500">净汇回</div>
                                        </div>
                                        <Icon
                                            name={isExpanded ? "ChevronUp" : "ChevronDown"}
                                            size={14}
                                            className="text-gray-500 flex-shrink-0"
                                        />
                                    </div>
                                </div>

                                {/* Tax line */}
                                <div className="flex justify-between items-center text-xs text-gray-500 mb-1">
                                    <span>外资利润税/汇回税</span>
                                    <span>
                                        <span className="text-gray-400">税率</span> <span className="text-amber-300 font-mono">{(inv.effectiveTaxRate * 100).toFixed(1)}%</span>
                                        <span className="mx-2 text-gray-600">|</span>
                                        <span className="text-gray-400">日税额</span> <span className="text-red-300 font-mono">-{Math.round(inv.taxPerDay)}</span>
                                    </span>
                                </div>

                                {/* Visual Flow — 懒展开 */}
                                {isExpanded && (
                                    <FlowVisualizer building={inv.building} decisions={inv.decisions} />
                                )}
                            </div>
                        );
                    }) : (
                        <div className="p-8 text-center text-gray-500 italic text-xs">
                            暂无海外投资项目。请在外交界面选择国家进行投资。
                        </div>
                    )}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="px-3 py-2 bg-white/5 border-t border-white/5 flex items-center justify-between">
                        <button
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            disabled={page === 1}
                            className="flex items-center gap-1 px-2 py-1 text-xs text-gray-400 hover:text-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        >
                            <Icon name="ChevronLeft" size={12} />
                            上一页
                        </button>
                        <span className="text-xs text-gray-500">
                            {page} / {totalPages}
                            <span className="ml-1 text-gray-600">
                                （{(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, activeInvestments.length)} / {activeInvestments.length}）
                            </span>
                        </span>
                        <button
                            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                            disabled={page === totalPages}
                            className="flex items-center gap-1 px-2 py-1 text-xs text-gray-400 hover:text-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        >
                            下一页
                            <Icon name="ChevronRight" size={12} />
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

const NATION_PAGE_SIZE = 5;

/**
 * Tab 2: Foreign Capital (Incoming)
 */
const ForeignCapitalTab = ({ foreignInvestments, nations, currentPolicy, onPolicyChange, onNationalize }) => {
    const [nationPage, setNationPage] = useState(1);
    const [expandedInvIds, setExpandedInvIds] = useState(new Set());

    const toggleInv = (key) => {
        setExpandedInvIds(prev => {
            const next = new Set(prev);
            if (next.has(key)) {
                next.delete(key);
            } else {
                next.add(key);
            }
            return next;
        });
    };

    // 按国家分组，国家内按 buildingId 二次合并
    const investmentsByNation = useMemo(() => {
        const groups = {};
        foreignInvestments.forEach(inv => {
            if (inv.status !== 'operating') return;
            const nationId = inv.ownerNationId;
            if (!groups[nationId]) {
                const nation = nations.find(n => n.id === nationId);
                groups[nationId] = {
                    nationId,
                    nationName: nation?.name || '未知国家',
                    nationColor: nation?.color || 'text-gray-300',
                    mergedMap: {},
                    totalProfit: 0,
                    totalTax: 0,
                    totalJobs: 0,
                    totalCount: 0
                };
            }
            const g = groups[nationId];
            g.totalProfit += (inv.dailyProfit || 0);
            g.totalTax += (inv.operatingData?.taxPaid || 0);
            g.totalJobs += (inv.jobsProvided || 0);
            g.totalCount += (inv.count || 1);

            // 按 buildingId 合并
            const bid = inv.buildingId;
            if (!g.mergedMap[bid]) {
                g.mergedMap[bid] = {
                    buildingId: bid,
                    count: 0,
                    dailyProfit: 0,
                    jobsProvided: 0,
                    operatingData: inv.operatingData,
                };
            }
            const m = g.mergedMap[bid];
            m.count += (inv.count || 1);
            m.dailyProfit += (inv.dailyProfit || 0);
            m.jobsProvided += (inv.jobsProvided || 0);
        });

        return Object.values(groups)
            .map(g => ({
                ...g,
                mergedInvestments: Object.values(g.mergedMap)
                    .sort((a, b) => b.dailyProfit - a.dailyProfit),
            }))
            .sort((a, b) => b.totalProfit - a.totalProfit);
    }, [foreignInvestments, nations]);

    // 数据变化时重置分页和展开状态
    useEffect(() => {
        setNationPage(1);
        setExpandedInvIds(new Set());
    }, [foreignInvestments]);

    const totalNationPages = Math.max(1, Math.ceil(investmentsByNation.length / NATION_PAGE_SIZE));
    const pagedNations = investmentsByNation.slice(
        (nationPage - 1) * NATION_PAGE_SIZE,
        nationPage * NATION_PAGE_SIZE
    );

    return (
        <div className="space-y-4">
            {/* Global Actions */}
            <div className="flex justify-end">
                <button
                    onClick={() => onNationalize?.()}
                    className="flex items-center gap-1 px-3 py-1.5 bg-red-900/20 border border-red-800/30 text-red-400 hover:bg-red-900/40 rounded-lg text-xs transition-colors"
                >
                    <Icon name="AlertTriangle" size={12} />
                    <span>国有化所有外资</span>
                </button>
            </div>

            {/* Note about tax source */}
            <div className="text-xs text-gray-500 bg-gray-900/30 border border-gray-800/40 rounded-lg p-2">
                外资利润税会在每日结算时自动扣除并计入国库（税率受条约/共同体等外交规则影响）。
            </div>

            {/* List */}
            <div className="space-y-3">
                {pagedNations.length > 0 ? pagedNations.map(group => (
                    <div key={group.nationId} className="bg-gray-800/30 rounded-lg border border-gray-700/40 overflow-hidden">
                        {/* Header */}
                        <div className="px-3 py-2 bg-white/5 flex justify-between items-center">
                            <div className="flex items-center gap-1.5">
                                <Icon name="Flag" size={14} className={group.nationColor} />
                                <span className="text-xs font-bold text-gray-200">{group.nationName}</span>
                                <Badge variant="neutral" className="text-xs">
                                    {group.totalCount} 处资产
                                </Badge>
                            </div>
                            <div className="text-right text-xs text-gray-400">
                                <div className="flex flex-col items-end">
                                    <div className="flex gap-2">
                                        <span>纳税: <span className="text-green-400">+{formatNumberShortCN(group.totalTax)}</span></span>
                                        <span>流出: <span className="text-red-400">-{formatNumberShortCN(group.totalProfit - group.totalTax)}</span></span>
                                    </div>
                                    <div className="text-xs opacity-70">
                                        实际税率: {group.totalProfit > 0 ? ((group.totalTax / group.totalProfit) * 100).toFixed(1) : 0}%
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Merged Items — 点击展开 FlowVisualizer */}
                        <div className="divide-y divide-gray-700/30">
                            {group.mergedInvestments.map(merged => {
                                const building = BUILDINGS.find(b => b.id === merged.buildingId);
                                const expandKey = `${group.nationId}_${merged.buildingId}`;
                                const isExpanded = expandedInvIds.has(expandKey);
                                return (
                                    <div
                                        key={expandKey}
                                        className="px-3 py-2 cursor-pointer hover:bg-white/5 transition-colors"
                                        onClick={() => toggleInv(expandKey)}
                                    >
                                        <div className="flex justify-between mb-1">
                                            <div className="text-xs font-bold text-gray-300 flex items-center gap-2">
                                                {building?.name || merged.buildingId}
                                                <span className="text-xs font-normal text-gray-500 bg-gray-900/50 px-1.5 rounded">
                                                    岗位: {merged.jobsProvided}
                                                </span>
                                                {merged.count > 1 && (
                                                    <span className="text-xs font-normal text-gray-500 bg-gray-900/50 px-1.5 rounded">
                                                        ×{merged.count}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <div className="text-xs font-mono text-amber-400">
                                                    利润: {formatNumberShortCN(merged.dailyProfit)}
                                                </div>
                                                <Icon
                                                    name={isExpanded ? "ChevronUp" : "ChevronDown"}
                                                    size={12}
                                                    className="text-gray-500"
                                                />
                                            </div>
                                        </div>
                                        {isExpanded && (
                                            <FlowVisualizer building={building} decisions={merged.operatingData?.decisions} />
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )) : (
                    <div className="p-8 text-center text-gray-500 italic text-xs bg-gray-800/20 rounded-xl border border-dashed border-gray-700">
                        目前国内没有外资企业。
                        <br/>
                        <span className="opacity-70 mt-1 block">与其他国家签署【投资协议】可吸引外资。</span>
                    </div>
                )}
            </div>

            {/* Nation Pagination */}
            {totalNationPages > 1 && (
                <div className="px-3 py-2 bg-white/5 border border-white/5 rounded-lg flex items-center justify-between">
                    <button
                        onClick={() => setNationPage(p => Math.max(1, p - 1))}
                        disabled={nationPage === 1}
                        className="flex items-center gap-1 px-2 py-1 text-xs text-gray-400 hover:text-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                        <Icon name="ChevronLeft" size={12} />
                        上一页
                    </button>
                    <span className="text-xs text-gray-500">
                        {nationPage} / {totalNationPages}
                        <span className="ml-1 text-gray-600">
                            （{investmentsByNation.length} 个来源国）
                        </span>
                    </span>
                    <button
                        onClick={() => setNationPage(p => Math.min(totalNationPages, p + 1))}
                        disabled={nationPage === totalNationPages}
                        className="flex items-center gap-1 px-2 py-1 text-xs text-gray-400 hover:text-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                        下一页
                        <Icon name="ChevronRight" size={12} />
                    </button>
                </div>
            )}
        </div>
    );
};


// --- Main Component ---

export const InternationalEconomyPanel = memo(({
    isOpen,
    onClose,
    overseasInvestments = [], // Outgoing
    foreignInvestments = [], // Incoming
    nations = [],
    playerMarket = {}, // Used for Incoming context
    currentPolicy = 'normal',
    onPolicyChange,
    onNationalize,
}) => {
    const [activeTab, setActiveTab] = useState('assets');

    // Calculate Summary for Outgoing
    const outgoingSummary = useMemo(() => {
        return calculateOverseasInvestmentSummary(overseasInvestments);
    }, [overseasInvestments]);

    // Calculate Summary for Incoming
    const incomingCount = foreignInvestments
        .filter(i => i.status === 'operating')
        .reduce((sum, inv) => sum + (inv.count || 1), 0);

    return (
        <BottomSheet
            isOpen={isOpen}
            onClose={onClose}
            title="🌍 国际经济概览"
        >
            <div className="flex flex-col h-full pb-4">
                <Tabs
                    tabs={[
                        { ...TABS[0], badge: outgoingSummary.count > 0 ? outgoingSummary.count : null },
                        { ...TABS[1], badge: incomingCount > 0 ? incomingCount : null }
                    ]}
                    activeTab={activeTab}
                    onChange={setActiveTab}
                    className="mb-4"
                />

                <div className="flex-1 overflow-y-auto min-h-[300px]">
                    {activeTab === 'assets' && (
                        <OverseasAssetsTab
                            overseasInvestments={overseasInvestments}
                            nations={nations}
                            summary={outgoingSummary}
                        />
                    )}

                    {activeTab === 'capital' && (
                        <ForeignCapitalTab
                            foreignInvestments={foreignInvestments}
                            nations={nations}
                            currentPolicy={currentPolicy}
                            onPolicyChange={onPolicyChange}
                            onNationalize={onNationalize}
                        />
                    )}
                </div>
            </div>
        </BottomSheet>
    );
});

export default InternationalEconomyPanel;
