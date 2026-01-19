/**
 * International Economy Dashboard
 * Unifies Overseas Investment (Outgoing) and Foreign Investment (Incoming) management.
 */

import React, { useState, useMemo, memo } from 'react';
import { BottomSheet } from '../tabs/BottomSheet';
import { Icon, Tabs, Card, Button, Badge } from '../common/UnifiedUI';
import { BUILDINGS, RESOURCES } from '../../config';
import { formatNumberShortCN } from '../../utils/numberFormat';
import {
    calculateOverseasInvestmentSummary,
    FOREIGN_INVESTMENT_POLICIES,
} from '../../logic/diplomacy/overseasInvestment';

// --- Configuration ---

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
    // For Assets: Home = Player (Import/Export), Local = Foreign
    // For Capital: Home = AI (Import/Export), Local = Player

    // Using generic terms: "Local" vs "Cross-Border"
    return (
        <div className={`flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border ${
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
    // decisions: { inputs: { res: 'local'|'home' }, outputs: { res: 'local'|'home' } }
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
                )) : <span className="text-[9px] text-gray-600 text-right px-2">无原料</span>}
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
                )) : <span className="text-[9px] text-gray-600 px-2">无产出</span>}
            </div>
        </div>
    );
};

/**
 * Tab 1: Overseas Assets (Outgoing)
 */
const OverseasAssetsTab = ({ overseasInvestments, nations, summary }) => {
    const activeInvestments = useMemo(() => {
        return overseasInvestments
            .filter(inv => inv.status === 'operating')
            .map(inv => {
                const nation = nations.find(n => n.id === inv.targetNationId);
                const building = BUILDINGS.find(b => b.id === inv.buildingId);
                const profit = inv.operatingData?.profit || 0;
                // These are computed in processOverseasInvestments (overseasInvestment.js)
                const repatriated = inv.operatingData?.repatriatedProfit;
                const retained = inv.operatingData?.retainedProfit;
                // Use the stored effectiveTaxRate directly from operatingData
                const effectiveTaxRate = inv.operatingData?.effectiveTaxRate ?? (
                    // Fallback: calculate from retained/profit if not stored
                    profit > 0 && typeof retained === 'number'
                        ? (retained / profit)
                        : 0
                );

                return {
                    ...inv,
                    nationName: nation?.name || '未知国家',
                    nationColor: nation?.color,
                    building,
                    buildingName: building?.name || '未知建筑',
                    profitPerDay: profit,
                    repatriatedPerDay: typeof repatriated === 'number' ? repatriated : profit,
                    taxPerDay: typeof retained === 'number' ? retained : 0,
                    effectiveTaxRate,
                    decisions: inv.operatingData?.decisions
                };
            })
            .sort((a, b) => b.investmentAmount - a.investmentAmount);
    }, [overseasInvestments, nations]);

    return (
        <div className="space-y-4">
             {/* Summary Cards */}
             <div className="grid grid-cols-3 gap-3">
                <div className="bg-gradient-to-br from-amber-900/40 to-black/40 rounded-xl p-3 border border-amber-700/30 shadow-lg">
                    <div className="text-[10px] text-amber-500 uppercase tracking-wider font-bold mb-1">总资产价值</div>
                    <div className="text-xl font-bold text-amber-200 font-mono">
                        {formatNumberShortCN(summary.totalValue)}
                    </div>
                </div>
                <div className="bg-gradient-to-br from-green-900/40 to-black/40 rounded-xl p-3 border border-green-700/30 shadow-lg">
                    <div className="text-[10px] text-green-500 uppercase tracking-wider font-bold mb-1">日净汇回</div>
                    <div className="text-xl font-bold text-green-300 font-mono">
                        +{formatNumberShortCN(summary.estimatedDailyProfit)}
                    </div>
                </div>
                <div className="bg-gradient-to-br from-blue-900/40 to-black/40 rounded-xl p-3 border border-blue-700/30 shadow-lg">
                    <div className="text-[10px] text-blue-500 uppercase tracking-wider font-bold mb-1">运营项目</div>
                    <div className="text-xl font-bold text-blue-200 font-mono">
                        {summary.count}
                    </div>
                </div>
            </div>

            {/* List */}
            <div className="bg-gray-800/30 rounded-xl border border-white/5 overflow-hidden">
                <div className="p-3 bg-white/5 border-b border-white/5 flex justify-between items-center">
                    <span className="text-sm font-bold text-gray-300">资产列表</span>
                    <span className="text-[10px] text-gray-500">显示最近30天内的运营状态</span>
                </div>
                <div className="divide-y divide-white/5 max-h-[50vh] overflow-y-auto">
                    {activeInvestments.length > 0 ? activeInvestments.map(inv => (
                        <div key={inv.id} className="p-3 hover:bg-white/5 transition-colors">
                            <div className="flex justify-between items-start mb-2">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded bg-gray-700 flex items-center justify-center">
                                        <Icon name={inv.building?.visual?.icon || "Building"} size={16} className="text-gray-300"/>
                                    </div>
                                    <div>
                                        <div className="text-sm font-bold text-gray-200 flex items-center gap-2">
                                            {inv.buildingName}
                                            <Badge variant="neutral" className="text-[9px] scale-90">
                                                {STRATUM_CONFIG[inv.ownerStratum]?.name || inv.ownerStratum}
                                            </Badge>
                                        </div>
                                        <div className="text-[10px] text-gray-400 flex items-center gap-1">
                                            <Icon name="MapPin" size={10}/>
                                            <span className={inv.nationColor}>{inv.nationName}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className={`text-sm font-mono font-bold ${inv.repatriatedPerDay >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                        {inv.repatriatedPerDay >= 0 ? '+' : ''}{inv.repatriatedPerDay.toFixed(1)}/日
                                    </div>
                                    <div className="text-[9px] text-gray-500">净汇回</div>
                                </div>
                            </div>

                            {/* Tax line */}
                            <div className="flex justify-between items-center text-[10px] text-gray-500 mb-2">
                                <span>外资利润税/汇回税</span>
                                <span>
                                    <span className="text-gray-400">税率</span> <span className="text-amber-300 font-mono">{(inv.effectiveTaxRate * 100).toFixed(1)}%</span>
                                    <span className="mx-2 text-gray-600">|</span>
                                    <span className="text-gray-400">日税额</span> <span className="text-red-300 font-mono">-{inv.taxPerDay.toFixed(1)}</span>
                                </span>
                            </div>

                            {/* Visual Flow */}
                            <FlowVisualizer building={inv.building} decisions={inv.decisions} />
                        </div>
                    )) : (
                        <div className="p-8 text-center text-gray-500 italic text-xs">
                            暂无海外投资项目。请在外交界面选择国家进行投资。
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

/**
 * Tab 2: Foreign Capital (Incoming)
 */
const ForeignCapitalTab = ({ foreignInvestments, nations, currentPolicy, onPolicyChange, onNationalize }) => {
    // Group logic similar to original panel but improved
    const investmentsByNation = useMemo(() => {
        const groups = {};
        foreignInvestments.forEach(inv => {
            if(inv.status !== 'operating') return;
            const nationId = inv.ownerNationId;
            if (!groups[nationId]) {
                const nation = nations.find(n => n.id === nationId);
                groups[nationId] = {
                    nationId,
                    nationName: nation?.name || '未知国家',
                    nationColor: nation?.color || 'text-gray-300',
                    investments: [],
                    totalProfit: 0,
                    totalTax: 0,
                    totalJobs: 0
                };
            }
            groups[nationId].investments.push(inv);
            groups[nationId].totalProfit += (inv.dailyProfit || 0);
            groups[nationId].totalTax += (inv.operatingData?.taxPaid || 0);
            groups[nationId].totalJobs += (inv.jobsProvided || 0);
        });
        return Object.values(groups).sort((a,b) => b.totalProfit - a.totalProfit);
    }, [foreignInvestments, nations]);

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
            <div className="text-[10px] text-gray-500 bg-gray-900/30 border border-gray-800/40 rounded-lg p-2">
                外资利润税会在每日结算时自动扣除并计入国库（税率受条约/共同体等外交规则影响）。
            </div>

            {/* List */}
             <div className="space-y-3 max-h-[50vh] overflow-y-auto">
                {investmentsByNation.length > 0 ? investmentsByNation.map(group => (
                    <div key={group.nationId} className="bg-gray-800/30 rounded-xl border border-gray-700/40 overflow-hidden">
                        {/* Header */}
                        <div className="p-3 bg-white/5 flex justify-between items-center">
                             <div className="flex items-center gap-2">
                                <Icon name="Flag" size={18} className={group.nationColor} />
                                <span className="text-sm font-bold text-gray-200">{group.nationName}</span>
                                <Badge variant="neutral" className="text-[10px]">
                                    {group.investments.length} 处资产
                                </Badge>
                             </div>
                             <div className="text-right text-[10px] text-gray-400">
                                <div className="flex flex-col items-end">
                                    <div className="flex gap-2">
                                        <span>纳税: <span className="text-green-400">+{formatNumberShortCN(group.totalTax)}</span></span>
                                        <span>流出: <span className="text-red-400">-{formatNumberShortCN(group.totalProfit - group.totalTax)}</span></span>
                                    </div>
                                    <div className="text-[9px] opacity-70">
                                        实际税率: {group.totalProfit > 0 ? ((group.totalTax / group.totalProfit) * 100).toFixed(1) : 0}%
                                    </div>
                                </div>
                             </div>
                        </div>

                        {/* Items */}
                        <div className="divide-y divide-gray-700/30">
                            {group.investments.map(inv => {
                                const building = BUILDINGS.find(b => b.id === inv.buildingId);
                                return (
                                    <div key={inv.id} className="p-3">
                                        <div className="flex justify-between mb-2">
                                            <div className="text-xs font-bold text-gray-300 flex items-center gap-2">
                                                {building?.name || inv.buildingId}
                                                <span className="text-[10px] font-normal text-gray-500 bg-gray-900/50 px-1.5 rounded">
                                                    提供岗位: {inv.jobsProvided}
                                                </span>
                                            </div>
                                            <div className="text-xs font-mono text-amber-400">
                                                利润: {formatNumberShortCN(inv.dailyProfit)}
                                            </div>
                                        </div>
                                        <FlowVisualizer building={building} decisions={inv.operatingData?.decisions} />
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
    // (Simplified, mostly needed for badge counts if desired)
    const incomingCount = foreignInvestments.filter(i => i.status === 'operating').length;

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
