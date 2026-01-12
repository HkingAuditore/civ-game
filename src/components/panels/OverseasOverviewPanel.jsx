import React, { useMemo } from 'react';
import { BottomSheet } from '../tabs/BottomSheet';
import { Icon } from '../common/UIComponents';
import { BUILDINGS, RESOURCES } from '../../config';
import { formatNumberShortCN } from '../../utils/numberFormat';
import {
    calculateOverseasInvestmentSummary,
} from '../../logic/diplomacy/overseasInvestment';

/**
 * Global Overseas Investment Overview Panel
 * Displays aggregated stats for all overseas investments.
 */
export const OverseasOverviewPanel = ({
    isOpen,
    onClose,
    overseasInvestments = [],
    nations = [],
    market = {},
}) => {
    // 1. Calculate Summary Data
    const summary = useMemo(() => {
        return calculateOverseasInvestmentSummary(overseasInvestments);
    }, [overseasInvestments]);

    // 2. Aggregate Resource Flow (Import/Export)
    const resourceFlow = useMemo(() => {
        const flow = {
            imports: {}, // Output sent to home ("home" dest)
            exports: {}, // Input sourced from home ("home" source)
        };

        overseasInvestments.forEach(inv => {
            if (inv.status !== 'operating') return;
            const building = BUILDINGS.find(b => b.id === inv.buildingId);
            if (!building) return;

            // Check Input Source
            if (inv.inputSource === 'home') {
                Object.entries(building.input || {}).forEach(([res, amount]) => {
                    flow.exports[res] = (flow.exports[res] || 0) + amount;
                });
            }

            // Check Output Dest
            if (inv.outputDest === 'home') {
                Object.entries(building.output || {}).forEach(([res, amount]) => {
                    if (['maxPop', 'militaryCapacity'].includes(res)) return;
                    flow.imports[res] = (flow.imports[res] || 0) + amount;
                });
            }
        });
        return flow;
    }, [overseasInvestments]);

    // 3. Stratum Breakdown Data
    const stratumData = useMemo(() => {
        return Object.entries(summary.byStratum || {}).map(([stratum, data]) => ({
            id: stratum,
            name: { capitalist: '资本家', merchant: '商人', landowner: '地主' }[stratum] || stratum,
            profit: data.dailyProfit, // Daily profit
            value: data.value,
            count: data.count,
            color: { capitalist: 'text-purple-400', merchant: 'text-amber-400', landowner: 'text-green-400' }[stratum],
            bg: { capitalist: 'bg-purple-900/30', merchant: 'bg-amber-900/30', landowner: 'bg-green-900/30' }[stratum],
        })).filter(d => d.count > 0);
    }, [summary]);

    // 4. Detailed Investment List
    const activeInvestments = useMemo(() => {
        return overseasInvestments
            .filter(inv => inv.status === 'operating')
            .map(inv => {
                const nation = nations.find(n => n.id === inv.targetNationId);
                const building = BUILDINGS.find(b => b.id === inv.buildingId);
                return {
                    ...inv,
                    nationName: nation?.name || '未知国家',
                    buildingName: building?.name || '未知建筑',
                    profitPerDay: inv.operatingData?.profit || 0,
                };
            })
            .sort((a, b) => b.investmentAmount - a.investmentAmount);
    }, [overseasInvestments, nations]);

    return (
        <BottomSheet
            isOpen={isOpen}
            onClose={onClose}
            title="🌐 全球海外投资总览"
        >
            <div className="space-y-6 pb-6">
                {/* Top Summary Cards */}
                <div className="grid grid-cols-3 gap-3">
                    <div className="bg-gradient-to-br from-amber-900/40 to-black/40 rounded-xl p-4 border border-amber-700/30 shadow-lg">
                        <div className="text-xs text-amber-500 uppercase tracking-wider font-bold mb-1">总投资资产</div>
                        <div className="text-2xl font-bold text-amber-200 font-mono tracking-tight">
                            {formatNumberShortCN(summary.totalValue)}
                        </div>
                    </div>
                    <div className="bg-gradient-to-br from-green-900/40 to-black/40 rounded-xl p-4 border border-green-700/30 shadow-lg">
                        <div className="text-xs text-green-500 uppercase tracking-wider font-bold mb-1">日净利润 (汇回)</div>
                        <div className="text-2xl font-bold text-green-300 font-mono tracking-tight">
                            +{formatNumberShortCN(summary.estimatedDailyProfit)}
                        </div>
                    </div>
                    <div className="bg-gradient-to-br from-blue-900/40 to-black/40 rounded-xl p-4 border border-blue-700/30 shadow-lg">
                        <div className="text-xs text-blue-500 uppercase tracking-wider font-bold mb-1">运营中建筑</div>
                        <div className="text-2xl font-bold text-blue-200 font-mono tracking-tight">
                            {summary.count}
                        </div>
                    </div>
                </div>

                {/* Stratum Breakdown */}
                {stratumData.length > 0 && (
                    <div className="bg-black/20 rounded-xl border border-white/10 overflow-hidden">
                        <div className="bg-white/5 px-4 py-2 border-b border-white/5 flex items-center justify-between">
                            <h3 className="text-sm font-bold text-gray-300 flex items-center gap-2">
                                <Icon name="Users" size={14} className="text-amber-500" />
                                阶层收益分配
                            </h3>
                            <span className="text-[10px] text-gray-500">利润自动汇入各阶层金库</span>
                        </div>
                        <div className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
                            {stratumData.map(d => (
                                <div key={d.id} className={`${d.bg} rounded-lg p-3 border border-white/5 flex flex-col`}>
                                    <div className={`font-bold text-sm ${d.color} mb-2`}>{d.name}</div>
                                    <div className="flex justify-between items-end mt-auto">
                                        <div>
                                            <div className="text-[10px] text-gray-400">投资额</div>
                                            <div className="font-mono text-gray-200">{formatNumberShortCN(d.value)}</div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-[10px] text-gray-400">日利润</div>
                                            <div className={`font-mono font-bold ${d.profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                {d.profit >= 0 ? '+' : ''}{formatNumberShortCN(d.profit)}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Resource Flow */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Exports (Inputs sourced from home) */}
                    <div className="bg-black/20 rounded-xl border border-white/10 overflow-hidden">
                        <div className="bg-red-900/10 px-3 py-2 border-b border-red-500/10 flex items-center gap-2">
                            <Icon name="Upload" size={14} className="text-red-400" />
                            <h4 className="text-xs font-bold text-red-300">国内流出 (作为原料)</h4>
                        </div>
                        <div className="p-3">
                            {Object.keys(resourceFlow.exports).length > 0 ? (
                                <div className="space-y-1">
                                    {Object.entries(resourceFlow.exports).map(([res, amount]) => (
                                        <div key={res} className="flex justify-between text-xs">
                                            <span className="text-gray-400">{RESOURCES[res]?.name || res}</span>
                                            <span className="text-red-300 font-mono">-{amount.toFixed(1)}/日</span>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-[10px] text-gray-600 italic text-center py-2">无国内资源流出</div>
                            )}
                        </div>
                    </div>

                    {/* Imports (Outputs sent to home) */}
                    <div className="bg-black/20 rounded-xl border border-white/10 overflow-hidden">
                        <div className="bg-green-900/10 px-3 py-2 border-b border-green-500/10 flex items-center gap-2">
                            <Icon name="Download" size={14} className="text-green-400" />
                            <h4 className="text-xs font-bold text-green-300">回流国内 (作为产品)</h4>
                        </div>
                        <div className="p-3">
                            {Object.keys(resourceFlow.imports).length > 0 ? (
                                <div className="space-y-1">
                                    {Object.entries(resourceFlow.imports).map(([res, amount]) => (
                                        <div key={res} className="flex justify-between text-xs">
                                            <span className="text-gray-400">{RESOURCES[res]?.name || res}</span>
                                            <span className="text-green-300 font-mono">+{amount.toFixed(1)}/日</span>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-[10px] text-gray-600 italic text-center py-2">无产品回流国内</div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Investment List Table */}
                <div className="bg-black/20 rounded-xl border border-white/10 overflow-hidden">
                    <div className=" px-4 py-3 border-b border-white/5">
                        <h3 className="text-sm font-bold text-gray-300">投资项目详情</h3>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                            <thead className="bg-white/5 text-gray-500 uppercase font-bold text-[10px]">
                                <tr>
                                    <th className="p-3">国家/建筑</th>
                                    <th className="p-3">所属阶层</th>
                                    <th className="p-3 text-right">投资额</th>
                                    <th className="p-3 text-right">日利润</th>
                                    <th className="p-3 text-center">模式</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {activeInvestments.map(inv => (
                                    <tr key={inv.id} className="hover:bg-white/5 transition-colors">
                                        <td className="p-3">
                                            <div className="font-bold text-gray-200">{inv.buildingName}</div>
                                            <div className="text-[10px] text-gray-500">{inv.nationName}</div>
                                        </td>
                                        <td className="p-3">
                                            {inv.ownerStratum === 'capitalist' && <span className="text-purple-400">资本家</span>}
                                            {inv.ownerStratum === 'merchant' && <span className="text-amber-400">商人</span>}
                                            {inv.ownerStratum === 'landowner' && <span className="text-green-400">地主</span>}
                                        </td>
                                        <td className="p-3 text-right font-mono text-gray-400">
                                            {formatNumberShortCN(inv.investmentAmount)}
                                        </td>
                                        <td className={`p-3 text-right font-mono font-bold ${inv.profitPerDay >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                            {inv.profitPerDay >= 0 ? '+' : ''}{inv.profitPerDay.toFixed(1)}
                                        </td>
                                        <td className="p-3 text-center">
                                            <div className="flex flex-col gap-1 items-center">
                                                <span className={`px-1.5 py-0.5 rounded text-[9px] ${inv.inputSource === 'home' ? 'bg-red-900/30 text-red-300 border border-red-800' : 'bg-gray-800 text-gray-500'}`}>
                                                    {inv.inputSource === 'home' ? '进口原料' : '当地采购'}
                                                </span>
                                                <span className={`px-1.5 py-0.5 rounded text-[9px] ${inv.outputDest === 'home' ? 'bg-green-900/30 text-green-300 border border-green-800' : 'bg-gray-800 text-gray-500'}`}>
                                                    {inv.outputDest === 'home' ? '产品回国' : '当地销售'}
                                                </span>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {activeInvestments.length === 0 && (
                                    <tr>
                                        <td colSpan="5" className="p-6 text-center text-gray-600 italic">
                                            暂无活跃的海外投资项目
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </BottomSheet>
    );
};
