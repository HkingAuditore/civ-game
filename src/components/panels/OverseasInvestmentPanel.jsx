/**
 * 海外投资管理面板
 * BottomSheet形式的完整海外投资管理界面
 */

import React, { useState, useMemo, memo } from 'react';
import { BottomSheet } from '../tabs/BottomSheet';
import { Icon } from '../common/UIComponents';
import { BUILDINGS, RESOURCES } from '../../config';
import { formatNumberShortCN } from '../../utils/numberFormat';
// import { OverseasBuildingCard } from './OverseasBuildingCard'; // Unused
import {
    OVERSEAS_INVESTMENT_CONFIGS,
    INVESTABLE_BUILDINGS,
    getInvestmentsInNation,
    calculateOverseasInvestmentSummary,
    OVERSEAS_BUILDING_CATEGORIES,
} from '../../logic/diplomacy/overseasInvestment';

// 阶层配置
const STRATUM_CONFIG = {
    capitalist: { name: '资本家', icon: '🏭', color: 'text-purple-400', categories: ['gather', 'industry'] },
    merchant: { name: '商人', icon: '🛒', color: 'text-amber-400', categories: ['industry'] },
    landowner: { name: '地主', icon: '🌾', color: 'text-green-400', categories: ['gather'] },
};

/**
 * 海外投资管理面板
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
}) => {
    const [expandedCard, setExpandedCard] = useState(null);
    const [selectedStratum, setSelectedStratum] = useState('capitalist');
    const [showNewInvestment, setShowNewInvestment] = useState(true);
    const [investFeedback, setInvestFeedback] = useState(null); // { buildingId, message, type }

    // 当前国家的投资
    const nationInvestments = useMemo(() => {
        if (!targetNation) return [];
        return getInvestmentsInNation(overseasInvestments, targetNation.id);
    }, [overseasInvestments, targetNation]);

    // 按建筑类型分组投资
    const groupedInvestments = useMemo(() => {
        const groups = {};
        nationInvestments.forEach(inv => {
            const key = inv.buildingId;
            if (!groups[key]) {
                groups[key] = {
                    buildingId: inv.buildingId,
                    investments: [],
                    totalProfit: 0,
                    totalInvestment: 0,
                };
            }
            groups[key].investments.push(inv);
            groups[key].totalProfit += inv.operatingData?.profit || 0;
            groups[key].totalInvestment += inv.investmentAmount || 0;
        });
        return Object.values(groups);
    }, [nationInvestments]);

    // 投资汇总
    const summary = useMemo(() => {
        const totalValue = nationInvestments.reduce((sum, inv) => sum + (inv.investmentAmount || 0), 0);
        const monthlyProfit = nationInvestments.reduce((sum, inv) => sum + ((inv.operatingData?.profit || 0) * 30), 0);
        return { totalValue, monthlyProfit, count: nationInvestments.length };
    }, [nationInvestments]);

    // 可投资建筑列表（需匹配建筑业主）
    const availableBuildings = useMemo(() => {
        const stratum = STRATUM_CONFIG[selectedStratum];
        if (!stratum) return [];

        return BUILDINGS.filter(b => {
            // 检查建筑类别
            if (!stratum.categories.includes(b.cat)) return false;
            // 检查时代解锁
            if ((b.epoch || 0) > epoch) return false;
            // 检查建筑业主是否匹配投资阶层
            const buildingOwner = b.owner || 'worker';
            // 资本家只能投资 capitalist 或无明确owner的工业建筑
            if (selectedStratum === 'capitalist') {
                return buildingOwner === 'capitalist' || (b.cat === 'industry' && !b.owner);
            }
            // 商人只能投资 merchant 建筑
            if (selectedStratum === 'merchant') {
                return buildingOwner === 'merchant';
            }
            // 地主只能投资 landowner 建筑
            if (selectedStratum === 'landowner') {
                return buildingOwner === 'landowner';
            }
            return false;
        });
    }, [selectedStratum, epoch]);

    // 阶层财富
    const stratumWealth = classWealth[selectedStratum] || 0;

    // UI helper: treaty affects profit repatriation (logic uses 80% / 100%)
    const hasInvestmentPact = useMemo(() => {
        const treaties = targetNation?.treaties;
        if (!treaties) return false;
        if (Array.isArray(treaties)) {
            return treaties.some(t => t?.type === 'investment_pact' && t?.status === 'active');
        }
        return treaties?.investment_pact?.status === 'active';
    }, [targetNation]);

    const repatriationRate = hasInvestmentPact ? 1.0 : 0.8;

    if (!targetNation) return null;

    return (
        <BottomSheet
            isOpen={isOpen}
            onClose={onClose}
            title={`🏗️ 海外投资 - ${targetNation.name}`}
        >
            <div className="space-y-4">
                {/* 投资概览 */}
                <div className="grid grid-cols-3 gap-2">
                    <div className="bg-amber-900/30 rounded-lg p-3 border border-amber-700/40">
                        <div className="text-[10px] text-amber-400 mb-1">总投资额</div>
                        <div className="text-lg font-bold text-amber-200">{formatNumberShortCN(summary.totalValue)}</div>
                    </div>
                    <div className={`rounded-lg p-3 border ${summary.monthlyProfit >= 0 ? 'bg-green-900/30 border-green-700/40' : 'bg-red-900/30 border-red-700/40'}`}>
                        <div className="text-[10px] text-gray-400 mb-1">月利润</div>
                        <div className={`text-lg font-bold ${summary.monthlyProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {summary.monthlyProfit >= 0 ? '+' : ''}{formatNumberShortCN(summary.monthlyProfit)}
                        </div>
                    </div>
                    <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700/40">
                        <div className="text-[10px] text-gray-400 mb-1">建筑数</div>
                        <div className="text-lg font-bold text-white">{summary.count}</div>
                    </div>
                </div>

                {/* 现有海外建筑 */}
                <div>
                    <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                            <Icon name="Building2" size={14} className="text-amber-400" />
                            现有海外资产
                        </h4>
                        {nationInvestments.length > 0 && (
                            <span className="text-[10px] text-gray-400">{nationInvestments.length}项投资</span>
                        )}
                    </div>

                    {/* 规则提示 */}
                    <div className="text-[10px] text-gray-400 bg-gray-900/30 border border-gray-700/40 rounded-lg p-2 mb-2 leading-relaxed">
                        <div className="font-semibold text-gray-200 mb-0.5">结算说明</div>
                        <div>— 工资：按<strong>目标国</strong>物价与阶层生存需求估算（不是国内的 market.wages 体系）。</div>
                        <div>— 运输：跨国调货/运回会产生约 <strong>15%</strong> 的损耗/运费。</div>
                        <div>— 利润汇回：当前为 <strong>{Math.round(repatriationRate * 100)}%</strong>{hasInvestmentPact ? '（已签署投资协议）' : '（未签署投资协议）'}。</div>
                    </div>

                    {groupedInvestments.length > 0 ? (
                        <div className="space-y-2 max-h-[50vh] overflow-y-auto">
                            {groupedInvestments.map(group => {
                                const building = BUILDINGS.find(b => b.id === group.buildingId);
                                const isExpanded = expandedCard === group.buildingId;
                                const dailyProfit = group.totalProfit;
                                const monthlyProfit = dailyProfit * 30;
                                const count = group.investments.length;

                                return (
                                    <div
                                        key={group.buildingId}
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
                                                <div className="text-[9px] text-gray-400">月利: {formatNumberShortCN(monthlyProfit)}</div>
                                            </div>
                                        </div>

                                        {/* 展开后显示汇总数据和批量操作 */}
                                        {isExpanded && (
                                            <div className="border-t border-gray-700/50 p-3 space-y-3">
                                                {/* 汇总运营数据 */}
                                                <div className="grid grid-cols-2 gap-2 text-[11px]">
                                                    <div className="bg-gray-900/40 rounded p-2">
                                                        <div className="text-gray-400">总产出价值</div>
                                                        <div className="text-green-400 font-semibold">
                                                            {group.investments.reduce((s, i) => s + (i.operatingData?.outputValue || 0), 0).toFixed(1)}/日
                                                        </div>
                                                    </div>
                                                    <div className="bg-gray-900/40 rounded p-2">
                                                        <div className="text-gray-400">总投入成本</div>
                                                        <div className="text-red-400 font-semibold">
                                                            {group.investments.reduce((s, i) => s + (i.operatingData?.inputCost || 0), 0).toFixed(1)}/日
                                                        </div>
                                                    </div>
                                                    <div className="bg-gray-900/40 rounded p-2 relative group">
                                                        <div className="text-gray-400">总工资成本（目标国）</div>
                                                        <div className="text-orange-400 font-semibold cursor-help">
                                                            {group.investments.reduce((s, i) => s + (i.operatingData?.wageCost || 0), 0).toFixed(1)}/日
                                                        </div>

                                                        {/* Wage Breakdown Tooltip */}
                                                        <div className="absolute bottom-full left-0 mb-2 w-56 bg-gray-900 border border-gray-700 rounded-lg shadow-xl p-2 hidden group-hover:block z-50">
                                                            <div className="text-[10px] text-gray-400 mb-1 border-b border-gray-700 pb-1">工资明细（单座建筑 / 按目标国物价）</div>
                                                            {group.investments[0]?.operatingData?.wageBreakdown?.map((item, idx) => (
                                                                <div key={idx} className="flex justify-between text-[10px] items-center mb-0.5 last:mb-0">
                                                                    <span className="text-gray-300">
                                                                        {(() => {
                                                                            const nameMap = {
                                                                                peasant: '农民', worker: '工人', artisan: '工匠',
                                                                                merchant: '商人', engineer: '工程师', scribe: '学者',
                                                                                official: '官员', cleric: '教士', capitalist: '资本家',
                                                                                landowner: '地主', serf: '农奴', lumberjack: '伐木工',
                                                                                miner: '矿工', navigator: '航海家'
                                                                            };
                                                                            return nameMap[item.stratumId] || item.stratumId;
                                                                        })()}
                                                                        <span className="text-gray-500 ml-1">×{item.count}</span>
                                                                    </span>
                                                                    <span className="text-orange-300 font-mono">
                                                                        {item.total.toFixed(1)}
                                                                    </span>
                                                                </div>
                                                            ))}
                                                            {!group.investments[0]?.operatingData?.wageBreakdown && (
                                                                <div className="text-[9px] text-gray-500 italic">暂无明细数据</div>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="bg-gray-900/40 rounded p-2">
                                                        <div className="text-gray-400">总投资额</div>
                                                        <div className="text-amber-400 font-semibold">{formatNumberShortCN(group.totalInvestment)}</div>
                                                    </div>
                                                </div>

                                                {/* 投入产出价格对比 */}
                                                {(() => {
                                                    const buildingConfig = BUILDINGS.find(b => b.id === group.buildingId);
                                                    if (!buildingConfig) return null;
                                                    const inputEntries = Object.entries(buildingConfig.input || {});
                                                    const outputEntries = Object.entries(buildingConfig.output || {}).filter(([k]) => !['maxPop', 'militaryCapacity'].includes(k));

                                                    // Get current mode from first investment in group
                                                    const currentInputMode = group.investments[0]?.inputSource || 'local';
                                                    const currentOutputMode = group.investments[0]?.outputDest || 'local';

                                                    return (
                                                        <div className="grid grid-cols-2 gap-2 text-[10px]">
                                                            {/* 投入部分 */}
                                                            <div className="bg-gray-900/40 rounded p-2">
                                                                <div className="text-red-400 mb-1 flex justify-between">
                                                                    <span>📥 投入</span>
                                                                    <span className="text-[9px] text-gray-400">
                                                                        {currentInputMode === 'local' ? '当地采购' : '国内进口'}
                                                                    </span>
                                                                </div>
                                                                {inputEntries.length > 0 ? (
                                                                    inputEntries.map(([r, v]) => {
                                                                        const localPrice = market?.prices?.[r] ?? RESOURCES[r]?.basePrice ?? 1;
                                                                        const foreignPrice = targetNation?.market?.prices?.[r] ?? targetNation?.prices?.[r] ?? RESOURCES[r]?.basePrice ?? 1;

                                                                        // Calculate effective cost based on mode
                                                                        const costLocal = foreignPrice;
                                                                        const costImport = localPrice * 1.15; // 15% transport
                                                                        const activeCost = currentInputMode === 'local' ? costLocal : costImport;

                                                                        return (
                                                                            <div key={r} className="flex justify-between items-center mb-1">
                                                                                <span className="text-gray-300">{RESOURCES[r]?.name || r} ×{v}</span>
                                                                                <div className="text-right">
                                                                                    <div className="text-red-300 font-mono">-{activeCost.toFixed(1)}</div>
                                                                                    <div className="text-[8px] text-gray-500 scale-90 origin-right">
                                                                                        (当地:{costLocal.toFixed(1)} / 进口:{costImport.toFixed(1)})
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                        );
                                                                    })
                                                                ) : (
                                                                    <div className="text-gray-500">无</div>
                                                                )}
                                                            </div>

                                                            {/* 产出部分 */}
                                                            <div className="bg-gray-900/40 rounded p-2">
                                                                <div className="text-green-400 mb-1 flex justify-between">
                                                                    <span>📤 产出</span>
                                                                    <span className="text-[9px] text-gray-400">
                                                                        {currentOutputMode === 'local' ? '当地销售' : '运回国内'}
                                                                    </span>
                                                                </div>
                                                                {outputEntries.length > 0 ? (
                                                                    outputEntries.map(([r, v]) => {
                                                                        const localPrice = market?.prices?.[r] ?? RESOURCES[r]?.basePrice ?? 1;
                                                                        const foreignPrice = targetNation?.market?.prices?.[r] ?? targetNation?.prices?.[r] ?? RESOURCES[r]?.basePrice ?? 1;

                                                                        // Calculate effective revenue based on mode
                                                                        const revLocal = foreignPrice;
                                                                        const revExport = localPrice * 0.85; // 15% transport deduction
                                                                        const activeRev = currentOutputMode === 'local' ? revLocal : revExport;

                                                                        return (
                                                                            <div key={r} className="flex justify-between items-center mb-1">
                                                                                <span className="text-gray-300">{RESOURCES[r]?.name || r} ×{v}</span>
                                                                                <div className="text-right">
                                                                                    <div className="text-green-300 font-mono">+{activeRev.toFixed(1)}</div>
                                                                                    <div className="text-[8px] text-gray-500 scale-90 origin-right">
                                                                                        (当地:{revLocal.toFixed(1)} / 运回:{revExport.toFixed(1)})
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                        );
                                                                    })
                                                                ) : (
                                                                    <div className="text-gray-500">无</div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    );
                                                })()}

                                                {/* 批量配置 */}
                                                <div className="grid grid-cols-2 gap-2 mt-2">
                                                    {/* 原料来源 */}
                                                    <div className="bg-gray-900/40 rounded p-2">
                                                        <div className="text-[10px] text-gray-400 mb-1">原料来源（决定用哪国价格）</div>
                                                        <div className="flex gap-1">
                                                            {[
                                                                { id: 'local', name: '当地采购' },
                                                                { id: 'home', name: '国内进口' }
                                                            ].map(opt => {
                                                                const isActive = group.investments[0]?.inputSource === opt.id || (!group.investments[0]?.inputSource && opt.id === 'local');
                                                                return (
                                                                    <button
                                                                        key={opt.id}
                                                                        className={`flex-1 px-1 py-1.5 rounded text-[9px] transition-all ${isActive
                                                                            ? 'bg-amber-600 text-white'
                                                                            : 'bg-gray-700/50 text-gray-400 hover:bg-gray-600'
                                                                            }`}
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            if (!isActive && onConfigChange) {
                                                                                const ids = group.investments.map(inv => inv.id);
                                                                                onConfigChange(ids, { inputSource: opt.id });
                                                                            }
                                                                        }}
                                                                    >
                                                                        {opt.name}
                                                                    </button>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>

                                                    {/* 产品去向 */}
                                                    <div className="bg-gray-900/40 rounded p-2">
                                                        <div className="text-[10px] text-gray-400 mb-1">产出销售地（决定用哪国价格）</div>
                                                        <div className="flex gap-1">
                                                            {[
                                                                { id: 'local', name: '当地销售' },
                                                                { id: 'home', name: '运回国内' }
                                                            ].map(opt => {
                                                                const isActive = group.investments[0]?.outputDest === opt.id || (!group.investments[0]?.outputDest && opt.id === 'local');
                                                                return (
                                                                    <button
                                                                        key={opt.id}
                                                                        className={`flex-1 px-1 py-1.5 rounded text-[9px] transition-all ${isActive
                                                                            ? 'bg-amber-600 text-white'
                                                                            : 'bg-gray-700/50 text-gray-400 hover:bg-gray-600'
                                                                            }`}
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            if (!isActive && onConfigChange) {
                                                                                const ids = group.investments.map(inv => inv.id);
                                                                                onConfigChange(ids, { outputDest: opt.id });
                                                                            }
                                                                        }}
                                                                    >
                                                                        {opt.name}
                                                                    </button>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* 批量撤回 */}
                                                <button
                                                    className="w-full px-3 py-1.5 rounded text-[11px] bg-red-900/50 text-red-300 hover:bg-red-800/50 border border-red-700/50"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        if (onWithdraw) {
                                                            group.investments.forEach(inv => onWithdraw(inv.id));
                                                        }
                                                    }}
                                                >
                                                    撤回全部{count}个投资（-20% 违约金）
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
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

                            {/* 可建建筑列表 - 详细信息 */}
                            <div>
                                <div className="text-[10px] text-gray-400 mb-1.5">
                                    可投资建筑 ({availableBuildings.length}种):
                                </div>
                                <div className="space-y-2 max-h-[50vh] overflow-y-auto">
                                    {availableBuildings.map(building => {
                                        const cost = Object.values(building.cost || building.baseCost || {}).reduce((sum, v) => sum + v, 0) * 1.5;
                                        const canAfford = stratumWealth >= cost;

                                        // 计算投入产出
                                        const inputEntries = Object.entries(building.input || {});
                                        const outputEntries = Object.entries(building.output || {}).filter(([k]) => !['maxPop', 'militaryCapacity'].includes(k));

                                        return (
                                            <div
                                                key={building.id}
                                                className={`p-3 rounded-lg transition-all ${canAfford
                                                    ? 'bg-gray-700/50 border border-gray-600/50 hover:border-amber-600/50'
                                                    : 'bg-gray-800/30 border border-gray-700/30 opacity-50'
                                                    }`}
                                            >
                                                {/* 建筑头部 */}
                                                <div className="flex items-center justify-between mb-2">
                                                    <div className="flex items-center gap-2">
                                                        <div className={`w-8 h-8 rounded flex items-center justify-center ${building.visual?.color || 'bg-gray-600'}`}>
                                                            <Icon name={building.visual?.icon || 'Building'} size={14} className={building.visual?.text || 'text-gray-200'} />
                                                        </div>
                                                        <div>
                                                            <div className="text-[12px] font-semibold text-white">{building.name}</div>
                                                            <div className={`text-[10px] ${canAfford ? 'text-amber-400' : 'text-gray-500'}`}>
                                                                投资成本: {formatNumberShortCN(cost)} 银
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="flex flex-col items-end gap-1">
                                                        <button
                                                            className={`px-3 py-1.5 rounded text-[10px] font-semibold transition-all ${investFeedback?.buildingId === building.id
                                                                ? 'bg-green-600 text-white'
                                                                : canAfford
                                                                    ? 'bg-amber-600 hover:bg-amber-500 text-white'
                                                                    : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                                                                }`}
                                                            disabled={!canAfford || investFeedback?.buildingId === building.id}
                                                            onClick={() => {
                                                                if (canAfford && onInvest) {
                                                                    onInvest(targetNation.id, building.id, selectedStratum);
                                                                    setInvestFeedback({ buildingId: building.id, message: '已投资!', type: 'success' });
                                                                    setTimeout(() => setInvestFeedback(null), 2000);
                                                                }
                                                            }}
                                                        >
                                                            {investFeedback?.buildingId === building.id ? '✓ 已投资!' : '+ 投资'}
                                                        </button>
                                                    </div>
                                                </div>

                                                {/* 投入产出信息（含价格对比） */}
                                                <div className="grid grid-cols-2 gap-2 text-[10px]">
                                                    <div className="bg-gray-900/40 rounded p-2">
                                                        <div className="text-red-400 mb-1">📥 投入:</div>
                                                        {inputEntries.length > 0 ? (
                                                            inputEntries.map(([r, v]) => {
                                                                const localPrice = market?.prices?.[r] ?? RESOURCES[r]?.basePrice ?? 1;
                                                                const foreignPrice = targetNation?.market?.prices?.[r] ?? targetNation?.prices?.[r] ?? RESOURCES[r]?.basePrice ?? 1;
                                                                const priceDiff = foreignPrice - localPrice;
                                                                return (
                                                                    <div key={r} className="flex justify-between items-center">
                                                                        <span className="text-gray-300">{RESOURCES[r]?.name || r} ×{v}</span>
                                                                        <span className={`text-[8px] ${priceDiff < 0 ? 'text-green-400' : priceDiff > 0 ? 'text-red-400' : 'text-gray-500'}`}>
                                                                            {priceDiff < 0 ? `▼${Math.abs(priceDiff).toFixed(1)}` : priceDiff > 0 ? `▲${priceDiff.toFixed(1)}` : '='}
                                                                        </span>
                                                                    </div>
                                                                );
                                                            })
                                                        ) : (
                                                            <div className="text-gray-500">无</div>
                                                        )}
                                                    </div>
                                                    <div className="bg-gray-900/40 rounded p-2">
                                                        <div className="text-green-400 mb-1">📤 产出:</div>
                                                        {outputEntries.map(([r, v]) => {
                                                            const localPrice = market?.prices?.[r] ?? RESOURCES[r]?.basePrice ?? 1;
                                                            const foreignPrice = targetNation?.market?.prices?.[r] ?? targetNation?.prices?.[r] ?? RESOURCES[r]?.basePrice ?? 1;
                                                            const priceDiff = localPrice - foreignPrice;
                                                            return (
                                                                <div key={r} className="flex justify-between items-center">
                                                                    <span className="text-gray-300">{RESOURCES[r]?.name || r} ×{v}</span>
                                                                    <span className={`text-[8px] ${priceDiff > 0 ? 'text-green-400' : priceDiff < 0 ? 'text-red-400' : 'text-gray-500'}`}>
                                                                        {priceDiff > 0 ? `▲回购+${priceDiff.toFixed(1)}` : priceDiff < 0 ? `▼倾销+${Math.abs(priceDiff).toFixed(1)}` : '='}
                                                                    </span>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>

                                                {/* 岗位信息 */}
                                                {building.jobs && Object.keys(building.jobs).length > 0 && (
                                                    <div className="mt-2 text-[9px] text-gray-400">
                                                        👷 岗位: {Object.entries(building.jobs).map(([s, c]) => `${s}×${c}`).join(', ')}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* 提示信息 */}
                <div className="text-[10px] text-gray-500 text-center pt-2 border-t border-gray-700/30">
                    💡 海外投资：资金来自阶层财富；原料来源/产出销售地会影响价格与运输成本。
                </div>
            </div>
        </BottomSheet >
    );
});

OverseasInvestmentPanel.displayName = 'OverseasInvestmentPanel';

export default OverseasInvestmentPanel;
