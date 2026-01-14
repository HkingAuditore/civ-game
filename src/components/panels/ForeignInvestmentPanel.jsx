/**
 * 外资管理面板
 * 显示和管理外国在玩家国家的投资建筑
 * 
 * 功能：
 * - 显示所有外资建筑列表
 * - 每座建筑的岗位、产出、利润外流
 * - 国有化/提高税率操作
 */

import React, { useState, useMemo, memo } from 'react';
import { BottomSheet } from '../tabs/BottomSheet';
import { Icon } from '../common/UIComponents';
import { BUILDINGS, RESOURCES } from '../../config';
import { formatNumberShortCN } from '../../utils/numberFormat';

// 外资政策选项
const FOREIGN_INVESTMENT_POLICIES = {
    normal: { name: '正常经营', taxRate: 0.1, description: '外资正常纳税，10%利润税', relationImpact: 0 },
    increased_tax: { name: '提高税率', taxRate: 0.25, description: '外资缴纳25%利润税', relationImpact: -5 },
    heavy_tax: { name: '重税政策', taxRate: 0.5, description: '外资缴纳50%利润税', relationImpact: -15 },
    nationalization: { name: '国有化', taxRate: 1.0, description: '没收外资资产，关系大幅恶化', relationImpact: -40 },
};

/**
 * 外资管理面板
 */
export const ForeignInvestmentPanel = memo(({
    isOpen,
    onClose,
    foreignInvestments = [],
    nations = [],
    market = {},
    onPolicyChange,
    onNationalize,
    currentPolicy = 'normal',
}) => {
    const [selectedNation, setSelectedNation] = useState(null);
    const [expandedBuilding, setExpandedBuilding] = useState(null);

    // 过滤出有效的投资（排除不存在的国家）
    const validForeignInvestments = useMemo(() => {
        const existingNationIds = new Set(nations.map(n => n.id));
        return foreignInvestments.filter(inv => existingNationIds.has(inv.ownerNationId));
    }, [foreignInvestments, nations]);

    // 按投资来源国家分组（只包含存在的国家）
    const investmentsByNation = useMemo(() => {
        const groups = {};
        validForeignInvestments.forEach(inv => {
            const nationId = inv.ownerNationId;
            if (!groups[nationId]) {
                const nation = nations.find(n => n.id === nationId);
                groups[nationId] = {
                    nationId,
                    nationName: nation?.name || nationId,
                    nationColor: nation?.color || 'text-gray-300',
                    relation: nation?.relation || 50,
                    investments: [],
                    totalProfit: 0,
                    totalTaxableProfit: 0,
                    totalJobs: 0,
                };
            }
            groups[nationId].investments.push(inv);
            groups[nationId].totalProfit += inv.dailyProfit || 0;
            // Only count positive profit for outflow/tax calculation
            if ((inv.dailyProfit || 0) > 0) {
                groups[nationId].totalTaxableProfit += inv.dailyProfit;
            }
            groups[nationId].totalJobs += inv.jobsProvided || 0;
        });
        return Object.values(groups);
    }, [validForeignInvestments, nations]);

    // 总览统计（只统计存在的国家的投资）
    const summary = useMemo(() => {
        const totalBuildings = validForeignInvestments.length;
        // Total raw profit (can be negative)
        const totalDailyProfit = validForeignInvestments.reduce((sum, inv) => sum + (inv.dailyProfit || 0), 0);
        const totalJobs = validForeignInvestments.reduce((sum, inv) => sum + (inv.jobsProvided || 0), 0);

        const policyConfig = FOREIGN_INVESTMENT_POLICIES[currentPolicy] || FOREIGN_INVESTMENT_POLICIES.normal;

        // Calculate tax and outflow based on POSITIVE profits only (no negative tax)
        // Aggregated by investment to match logic
        let dailyTaxRevenue = 0;
        let dailyProfitOutflow = 0;

        validForeignInvestments.forEach(inv => {
            const profit = inv.dailyProfit || 0;
            if (profit > 0) {
                dailyTaxRevenue += profit * policyConfig.taxRate;
                dailyProfitOutflow += profit * (1 - policyConfig.taxRate);
            }
        });

        return {
            totalBuildings,
            totalDailyProfit,
            totalJobs,
            dailyTaxRevenue,
            dailyProfitOutflow,
            investorCount: investmentsByNation.length,
        };
    }, [validForeignInvestments, investmentsByNation, currentPolicy]);

    const policyConfig = FOREIGN_INVESTMENT_POLICIES[currentPolicy] || FOREIGN_INVESTMENT_POLICIES.normal;

    return (
        <BottomSheet
            isOpen={isOpen}
            onClose={onClose}
            title="🏭 外资管理"
        >
            <div className="space-y-4">
                {/* 总览统计 */}
                <div className="grid grid-cols-3 gap-2">
                    <div className="bg-purple-900/30 rounded-lg p-3 border border-purple-700/40">
                        <div className="text-[10px] text-purple-400 mb-1">外资建筑</div>
                        <div className="text-lg font-bold text-purple-200">{summary.totalBuildings}</div>
                    </div>
                    <div className="bg-green-900/30 rounded-lg p-3 border border-green-700/40">
                        <div className="text-[10px] text-green-400 mb-1">提供岗位</div>
                        <div className="text-lg font-bold text-green-200">{summary.totalJobs}</div>
                    </div>
                    <div className="bg-amber-900/30 rounded-lg p-3 border border-amber-700/40">
                        <div className="text-[10px] text-amber-400 mb-1">投资国</div>
                        <div className="text-lg font-bold text-amber-200">{summary.investorCount}</div>
                    </div>
                </div>

                {/* 利润流向 */}
                <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700/40">
                    <div className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
                        <Icon name="TrendingUp" size={14} className="text-green-400" />
                        每日利润流向
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="bg-green-900/20 rounded p-2 border border-green-700/30">
                            <div className="text-[10px] text-gray-400 mb-1">税收收入 ({(policyConfig.taxRate * 100).toFixed(0)}%)</div>
                            <div className="text-base font-bold text-green-400">+{formatNumberShortCN(summary.dailyTaxRevenue)}/日</div>
                        </div>
                        <div className="bg-red-900/20 rounded p-2 border border-red-700/30">
                            <div className="text-[10px] text-gray-400 mb-1">利润外流</div>
                            <div className="text-base font-bold text-red-400">-{formatNumberShortCN(summary.dailyProfitOutflow)}/日</div>
                        </div>
                    </div>
                </div>

                {/* 外资政策 */}
                <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700/40">
                    <div className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
                        <Icon name="Scale" size={14} className="text-blue-400" />
                        外资政策
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        {Object.entries(FOREIGN_INVESTMENT_POLICIES).map(([policyId, config]) => {
                            const isActive = currentPolicy === policyId;
                            const isNationalize = policyId === 'nationalization';
                            return (
                                <button
                                    key={policyId}
                                    className={`p-2 rounded-lg text-left transition-all border ${isActive
                                        ? 'bg-blue-900/40 border-blue-500/50 text-blue-200'
                                        : isNationalize
                                            ? 'bg-red-900/20 border-red-700/30 text-red-300 hover:bg-red-900/30'
                                            : 'bg-gray-700/30 border-gray-600/30 text-gray-300 hover:bg-gray-600/30'
                                        }`}
                                    onClick={() => {
                                        if (isNationalize) {
                                            if (onNationalize) onNationalize();
                                        } else if (onPolicyChange) {
                                            onPolicyChange(policyId);
                                        }
                                    }}
                                >
                                    <div className="text-[11px] font-semibold mb-0.5">{config.name}</div>
                                    <div className="text-[9px] opacity-70">{config.description}</div>
                                    {config.relationImpact !== 0 && (
                                        <div className={`text-[9px] mt-1 ${config.relationImpact < 0 ? 'text-red-400' : 'text-green-400'}`}>
                                            关系: {config.relationImpact > 0 ? '+' : ''}{config.relationImpact}
                                        </div>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* 按国家分组的投资列表 */}
                <div>
                    <div className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
                        <Icon name="Globe" size={14} className="text-purple-400" />
                        外资来源
                    </div>

                    {investmentsByNation.length > 0 ? (
                        <div className="space-y-2 max-h-[40vh] overflow-y-auto">
                            {investmentsByNation.map(group => (
                                <div
                                    key={group.nationId}
                                    className="bg-gray-800/30 rounded-lg border border-gray-700/40"
                                >
                                    {/* 国家头部 */}
                                    <button
                                        className="w-full p-3 flex items-center justify-between text-left hover:bg-gray-700/30 transition-all rounded-lg"
                                        onClick={() => setSelectedNation(selectedNation === group.nationId ? null : group.nationId)}
                                    >
                                        <div className="flex items-center gap-2">
                                            <Icon name="Flag" size={16} className={group.nationColor} />
                                            <div>
                                                <div className="text-sm font-semibold text-white">{group.nationName}</div>
                                                <div className="text-[10px] text-gray-400">
                                                    {group.investments.length}建筑 · {group.totalJobs}岗位
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-sm font-bold text-red-400">
                                                -{formatNumberShortCN(group.totalTaxableProfit * (1 - policyConfig.taxRate))}/日
                                            </div>
                                            <div className="text-[9px] text-gray-500">利润外流</div>
                                        </div>
                                    </button>

                                    {/* 展开的建筑列表 */}
                                    {selectedNation === group.nationId && (
                                        <div className="border-t border-gray-700/40 p-2 space-y-1">
                                            {group.investments.map(inv => {
                                                const building = BUILDINGS.find(b => b.id === inv.buildingId);
                                                return (
                                                    <div
                                                        key={inv.id}
                                                        className="flex items-center justify-between bg-gray-900/40 rounded p-2"
                                                    >
                                                        <div className="flex items-center gap-2">
                                                            <div className={`w-6 h-6 rounded flex items-center justify-center ${building?.visual?.color || 'bg-gray-700'}`}>
                                                                <Icon name={building?.visual?.icon || 'Building'} size={12} className={building?.visual?.text || 'text-gray-200'} />
                                                            </div>
                                                            <div>
                                                                <div className="text-[11px] font-medium text-white">{building?.name || inv.buildingId}</div>
                                                                <div className="text-[9px] text-gray-400">
                                                                    👷 {inv.jobsProvided || 0}岗位
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="text-right">
                                                            <div className="text-[11px] font-semibold text-amber-400">
                                                                {formatNumberShortCN(inv.dailyProfit || 0)}/日
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-6 text-gray-400 bg-gray-800/30 rounded-lg border border-gray-700/40">
                            <Icon name="Building2" size={32} className="mx-auto mb-2 opacity-50" />
                            <div className="text-sm">暂无外资建筑</div>
                            <div className="text-[10px] mt-1">与其他国家签署投资协议后，他们可能在此投资</div>
                        </div>
                    )}
                </div>

                {/* 提示信息 */}
                <div className="text-[10px] text-gray-500 text-center pt-2 border-t border-gray-700/30">
                    💡 外资建筑提供就业岗位，但部分利润会流向母国
                </div>
            </div>
        </BottomSheet>
    );
});

ForeignInvestmentPanel.displayName = 'ForeignInvestmentPanel';

export default ForeignInvestmentPanel;
