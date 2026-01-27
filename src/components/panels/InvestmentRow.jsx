
import React, { useMemo, memo } from 'react';
import { Icon } from '../common/UIComponents';
import { BUILDINGS, RESOURCES } from '../../config';
import { formatNumberShortCN } from '../../utils/numberFormat';
import {
    INVESTMENT_STRATEGIES,
    compareLaborCost,
} from '../../logic/diplomacy/overseasInvestment';

/**
 * Single investment row component extracted from OverseasInvestmentPanel
 */
export const InvestmentRow = memo(({ group, expandedCard, setExpandedCard, playerNation, targetNation, onConfigChange, onWithdraw }) => {
    const building = BUILDINGS.find(b => b.id === group.buildingId);
    const isExpanded = expandedCard === group.buildingId;
    const dailyProfit = group.totalProfit;
    const count = group.totalCount || group.investments.reduce((sum, inv) => sum + (inv.count || 1), 0);

    // Labor Cost Analysis
    const laborAnalysis = useMemo(() => {
        if (!playerNation || !targetNation) return null;
        return compareLaborCost(group.buildingId, playerNation, targetNation);
    }, [playerNation, targetNation, group.buildingId]);

    const laborLabel = useMemo(() => {
        if (!laborAnalysis) return null;
        const { ratio } = laborAnalysis;
        if (ratio < 0.8) {
            return <span className="text-[9px] px-1.5 py-0.5 rounded bg-green-900/50 text-green-300 border border-green-700/50">低廉劳动力 (-{Math.round((1 - ratio) * 100)}%)</span>;
        }
        if (ratio > 1.2) {
            return <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-900/50 text-red-300 border border-red-700/50">高昂人工 (+{Math.round((ratio - 1) * 100)}%)</span>;
        }
        return null;
    }, [laborAnalysis]);

    return (
        <div
            className={`rounded-lg border transition-all cursor-pointer ${isExpanded
                ? 'border-amber-400/50 bg-amber-900/30'
                : 'border-gray-700/50 bg-gray-800/30 hover:bg-gray-700/30'
                }`}
            onClick={() => setExpandedCard(isExpanded ? null : group.buildingId)}
        >
            {/* 合并卡片头部 */}
            <div className="p-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className={`w-8 h-8 rounded flex items-center justify-center ${building?.visual?.color || 'bg-gray-700'}`}>
                        <Icon name={building?.visual?.icon || 'Building'} size={16} className={building?.visual?.text || 'text-gray-200'} />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-white">{building?.name || group.buildingId}</span>
                            {count > 1 && (
                                <span className="px-1.5 py-0.5 text-[9px] bg-amber-600 text-white rounded-full">×{count}</span>
                            )}
                            {laborLabel}
                        </div>
                        <div className="text-[9px] text-gray-400">
                            投资额: {formatNumberShortCN(group.totalInvestment)}
                        </div>
                    </div>
                </div>
                <div className="text-right">
                    <div className={`text-sm font-bold ${dailyProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {dailyProfit >= 0 ? '+' : ''}{dailyProfit.toFixed(1)}/日
                    </div>
                </div>
            </div>

            {/* 展开后显示汇总数据和批量操作 */}
            {isExpanded && (
                <div className="border-t border-gray-700/50 p-3 space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
                    {/* 策略选择 */}
                    <div className="bg-gray-900/40 p-2 rounded-lg border border-gray-700/30">
                        <div className="text-[10px] text-gray-400 mb-1.5 flex justify-between">
                            <span>运营策略</span>
                            <span className="text-amber-500 cursor-help" title="批量应用到此类所有建筑">
                                (自动管理)
                            </span>
                        </div>
                        <div className="flex gap-1">
                            {Object.values(INVESTMENT_STRATEGIES).map(strat => {
                                const isActive = group.investments[0]?.strategy === strat.id || (!group.investments[0]?.strategy && strat.id === 'PROFIT_MAX');
                                return (
                                    <button
                                        key={strat.id}
                                        className={`flex-1 py-1.5 px-1 rounded text-center transition-all relative overflow-hidden ${isActive
                                            ? 'bg-amber-600 text-white shadow-sm ring-1 ring-amber-500'
                                            : 'bg-gray-800 text-gray-400 hover:text-gray-300 hover:bg-gray-700'
                                            }`}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (!isActive && onConfigChange) {
                                                const ids = group.investments.map(inv => inv.id);
                                                onConfigChange(ids, { strategy: strat.id });
                                            }
                                        }}
                                        title={strat.desc}
                                    >
                                        <div className="text-[10px] font-bold">{strat.name}</div>
                                        {isActive && <div className="absolute top-0 right-0 w-1.5 h-1.5 bg-white rounded-bl-sm shadow-sm" />}
                                    </button>
                                );
                            })}
                        </div>
                        <div className="text-[9px] text-gray-500 mt-1 italic leading-tight">
                            {Object.values(INVESTMENT_STRATEGIES).find(s => s.id === (group.investments[0]?.strategy || 'PROFIT_MAX'))?.desc}
                        </div>
                    </div>

                    {/* 投入产出物流可视化 */}
                    <div className="bg-gray-900/40 rounded-lg p-3 border border-gray-700/30">
                        <div className="grid grid-cols-2 gap-4">
                            {/* 投入流向 */}
                            <div>
                                <div className="text-[10px] text-gray-400 mb-1">原料来源</div>
                                {building && Object.entries(building.input || {}).map(([r, v]) => {
                                    const strategyDecisions = group.investments[0]?.operatingData?.decisions || { inputs: {}, outputs: {} };
                                    const source = strategyDecisions.inputs?.[r] || 'local';
                                    return (
                                        <div key={r} className="flex items-center justify-between text-[10px] bg-gray-800/50 rounded p-1 mb-1">
                                            <span className="text-gray-300 flex items-center gap-1">
                                                {RESOURCES[r]?.name} <span className="text-gray-500">×{v}</span>
                                            </span>
                                            <div className="flex items-center gap-1">
                                                <span className={`px-1 rounded text-[9px] ${source === 'home'
                                                    ? 'bg-blue-900/40 text-blue-300 border border-blue-800/50'
                                                    : 'bg-amber-900/20 text-amber-500/80 border border-amber-800/30'}`}>
                                                    {source === 'home' ? '国内' : '本地'}
                                                </span>
                                                <Icon name="ArrowRight" size={10} className="text-gray-500" />
                                            </div>
                                        </div>
                                    );
                                })}
                                {building && Object.keys(building.input || {}).length === 0 && <div className="text-[10px] text-gray-600 italic">无原料需求</div>}
                            </div>

                            {/* 产出流向 */}
                            <div>
                                <div className="text-[10px] text-gray-400 mb-1">产品流向</div>
                                {building && Object.entries(building.output || {})
                                    .filter(([k]) => !['maxPop', 'militaryCapacity'].includes(k))
                                    .map(([r, v]) => {
                                        const strategyDecisions = group.investments[0]?.operatingData?.decisions || { inputs: {}, outputs: {} };
                                        const dest = strategyDecisions.outputs?.[r] || 'local';
                                        return (
                                            <div key={r} className="flex items-center justify-between text-[10px] bg-gray-800/50 rounded p-1 mb-1">
                                                <div className="flex items-center gap-1">
                                                    <Icon name="ArrowRight" size={10} className="text-gray-500" />
                                                    <span className={`px-1 rounded text-[9px] ${dest === 'home'
                                                        ? 'bg-purple-900/40 text-purple-300 border border-purple-800/50'
                                                        : 'bg-green-900/20 text-green-500/80 border border-green-800/30'}`}>
                                                        {dest === 'home' ? '回流' : '本地'}
                                                    </span>
                                                </div>
                                                <span className="text-gray-300 flex items-center gap-1">
                                                    {RESOURCES[r]?.name} <span className="text-gray-500">×{v}</span>
                                                </span>
                                            </div>
                                        );
                                    })}
                                {building && Object.entries(building.output || {}).filter(([k]) => !['maxPop', 'militaryCapacity'].includes(k)).length === 0 && <div className="text-[10px] text-gray-600 italic">无产出</div>}
                            </div>
                        </div>
                    </div>

                    {/* 详细财务数据 */}
                    <div className="grid grid-cols-3 gap-2 text-[10px] bg-gray-900/20 rounded p-2">
                        <div>
                            <div className="text-gray-500">产值</div>
                            <div className="text-green-400">{group.investments.reduce((s, i) => s + (i.operatingData?.outputValue || 0), 0).toFixed(1)}</div>
                        </div>
                        <div>
                            <div className="text-gray-500">劳务</div>
                            <div className="text-orange-400">{group.investments.reduce((s, i) => s + (i.operatingData?.wageCost || 0), 0).toFixed(1)}</div>
                        </div>
                        <div>
                            <div className="text-gray-500">原材料成本</div>
                            <div className="text-red-400">{group.investments.reduce((s, i) => s + ((i.operatingData?.inputCost || 0) + (i.operatingData?.transportCost || 0)), 0).toFixed(1)}</div>
                        </div>
                    </div>

                    {/* 税收/汇回展示 */}
                    {(() => {
                        const profit = group.investments.reduce((s, i) => s + (i.operatingData?.profit || 0), 0);
                        const tax = group.investments.reduce((s, i) => s + (i.operatingData?.retainedProfit || 0), 0);
                        const repatriated = group.investments.reduce((s, i) => {
                            const v = i.operatingData?.repatriatedProfit;
                            return s + (typeof v === 'number' ? v : 0);
                        }, 0);
                        // Use stored effectiveTaxRate directly (prefer first investment's rate)
                        const storedRate = group.investments[0]?.operatingData?.effectiveTaxRate;
                        const rate = typeof storedRate === 'number' ? storedRate : (profit > 0 ? (tax / profit) : 0);

                        // If repatriatedProfit/retainedProfit not present yet (older save / not processed this tick), hide.
                        const hasTaxFields = group.investments.some(i => typeof i.operatingData?.retainedProfit === 'number' || typeof i.operatingData?.repatriatedProfit === 'number');
                        if (!hasTaxFields) return null;

                        return (
                            <div className="flex justify-between items-center text-[10px] bg-gray-900/30 border border-gray-700/30 rounded p-2">
                                <div className="text-gray-400">外资利润税 / 汇回税</div>
                                <div className="text-right">
                                    <div>
                                        <span className="text-gray-500">税率</span>{' '}
                                        <span className="text-amber-300 font-mono">{(rate * 100).toFixed(1)}%</span>{' '}
                                        <span className="text-gray-600 mx-1">|</span>{' '}
                                        <span className="text-gray-500">日税额</span>{' '}
                                        <span className="text-red-300 font-mono">-{tax.toFixed(1)}</span>
                                    </div>
                                    <div className="text-[9px] text-gray-500 mt-0.5">净汇回: <span className="text-green-300 font-mono">{repatriated.toFixed(1)}/日</span></div>
                                </div>
                            </div>
                        );
                    })()}

                    {/* 批量撤回 - 已禁用，投资由阶层自主决策 */}
                    <div className="w-full px-3 py-2 rounded text-[10px] bg-gray-800/30 text-gray-500 border border-gray-700/30 text-center italic">
                        投资撤回由阶层根据盈利情况自动决策
                    </div>
                </div>
            )}
        </div>
    );
});
