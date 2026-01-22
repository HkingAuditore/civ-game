/**
 * 附庸概览面板
 * 显示玩家所有附庸国的汇总信息和管理入口
 */

import React, { useMemo, memo } from 'react';
import { BottomSheet } from '../tabs/BottomSheet';
import { Icon } from '../common/UIComponents';
import { formatNumberShortCN } from '../../utils/numberFormat';
import { VASSAL_TYPE_LABELS, VASSAL_TYPE_CONFIGS } from '../../config/diplomacy';
import { calculateEnhancedTribute } from '../../logic/diplomacy/vassalSystem';

/**
 * 附庸概览面板
 */
export const VassalOverviewPanel = memo(({
    isOpen,
    onClose,
    nations = [],
    playerResources = {},
    onSelectVassal,
    onAdjustPolicy,
    onReleaseVassal,
}) => {
    // 获取所有附庸
    const vassals = useMemo(() => {
        return nations.filter(n => n.vassalOf === 'player');
    }, [nations]);

    // 计算汇总数据
    const summary = useMemo(() => {
        let totalTribute = 0;
        let totalWealth = 0;
        let totalPopulation = 0;
        let avgIndependence = 0;
        let atRiskCount = 0;

        vassals.forEach(v => {
            const tribute = calculateEnhancedTribute(v, playerResources.silver || 10000);
            totalTribute += tribute.silver || 0;
            totalWealth += v.wealth || 0;
            totalPopulation += v.population || 0;
            avgIndependence += v.independencePressure || 0;
            if ((v.independencePressure || 0) > 60) atRiskCount++;
        });

        if (vassals.length > 0) {
            avgIndependence /= vassals.length;
        }

        return {
            count: vassals.length,
            totalTribute,
            totalWealth,
            totalPopulation,
            avgIndependence,
            atRiskCount,
        };
    }, [vassals, playerResources]);

    // 按附庸类型分组
    const vassalsByType = useMemo(() => {
        const groups = {};
        vassals.forEach(v => {
            const type = v.vassalType || 'protectorate';
            if (!groups[type]) groups[type] = [];
            groups[type].push(v);
        });
        return groups;
    }, [vassals]);

    return (
        <BottomSheet
            isOpen={isOpen}
            onClose={onClose}
            title="👑 附庸概览"
        >
            <div className="space-y-4">
                {/* 汇总统计 */}
                <div className="grid grid-cols-3 gap-2">
                    <div className="bg-purple-900/30 rounded-lg p-3 border border-purple-700/40">
                        <div className="text-[10px] text-purple-400 mb-1">附庸数</div>
                        <div className="text-lg font-bold text-purple-200">{summary.count}</div>
                    </div>
                    <div className="bg-amber-900/30 rounded-lg p-3 border border-amber-700/40">
                        <div className="text-[10px] text-amber-400 mb-1">日朝贡</div>
                        <div className="text-lg font-bold text-amber-200">{formatNumberShortCN(summary.totalTribute / 30)}</div>
                    </div>
                    <div className={`rounded-lg p-3 border ${summary.atRiskCount > 0 ? 'bg-red-900/30 border-red-700/40' : 'bg-gray-800/50 border-gray-700/40'}`}>
                        <div className="text-[10px] text-gray-400 mb-1">独立风险</div>
                        <div className={`text-lg font-bold ${summary.atRiskCount > 0 ? 'text-red-400' : 'text-green-400'}`}>
                            {summary.atRiskCount > 0 ? `${summary.atRiskCount}国` : '无'}
                        </div>
                    </div>
                </div>

                {/* 整体统计 */}
                <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700/40">
                    <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                            <span className="text-gray-400">附庸总财富:</span>
                            <span className="text-white ml-2">{formatNumberShortCN(summary.totalWealth)}</span>
                        </div>
                        <div>
                            <span className="text-gray-400">附庸总人口:</span>
                            <span className="text-white ml-2">{formatNumberShortCN(summary.totalPopulation)}</span>
                        </div>
                        <div>
                            <span className="text-gray-400">平均独立倾向:</span>
                            <span className={`ml-2 ${summary.avgIndependence > 50 ? 'text-red-400' : 'text-green-400'}`}>
                                {summary.avgIndependence.toFixed(0)}%
                            </span>
                        </div>
                    </div>
                </div>

                {/* 附庸列表 - Unified List */}
                {vassals.length > 0 ? (
                    <div className="space-y-4">
                        <div>
                            <div className="text-sm font-semibold text-gray-300 mb-2 flex items-center gap-2">
                                <Icon name="Crown" size={14} className="text-purple-400" />
                                附庸国列表
                                <span className="text-gray-500 text-xs">({vassals.length})</span>
                            </div>
                            <div className="space-y-2">
                                {vassals.map(vassal => {
                                    const tribute = calculateEnhancedTribute(vassal, playerResources.silver || 10000);
                                    const independence = vassal.independencePressure || 0;
                                    const isAtRisk = independence > 60;
                                    const vassalLabel = VASSAL_TYPE_LABELS[vassal.vassalType] || '附庸国';

                                    return (
                                        <div
                                            key={vassal.id}
                                            className={`p-3 rounded-lg border transition-all cursor-pointer hover:bg-gray-700/30 ${isAtRisk ? 'border-red-700/50 bg-red-900/20' : 'border-gray-700/40 bg-gray-800/30'}`}
                                            onClick={() => onSelectVassal && onSelectVassal(vassal)}
                                        >
                                            <div className="flex items-center justify-between mb-2">
                                                <div className="flex items-center gap-2">
                                                    <Icon name="Flag" size={16} className="text-amber-400" />
                                                    <span className="font-semibold text-white">{vassal.name}</span>
                                                    {isAtRisk && (
                                                        <span className="px-1.5 py-0.5 text-[9px] bg-red-600 text-white rounded">风险</span>
                                                    )}
                                                </div>
                                                <div className="text-sm text-amber-400 font-semibold">
                                                    +{formatNumberShortCN(tribute.silver)}/月
                                                </div>
                                            </div>

                                            {/* 详细指标 */}
                                            <div className="grid grid-cols-2 gap-2 text-[11px]">
                                                <div>
                                                    <span className="text-gray-400">朝贡率:</span>
                                                    <span className="text-white ml-1">{Math.round((vassal.tributeRate || 0) * 100)}%</span>
                                                </div>
                                                <div>
                                                    <span className="text-gray-400">独立:</span>
                                                    <span className={`ml-1 ${isAtRisk ? 'text-red-400' : 'text-gray-200'}`}>
                                                        {Math.round(independence)}%
                                                    </span>
                                                </div>
                                            </div>

                                            {/* 操作按钮 */}
                                            <div className="flex gap-2 mt-2">
                                                <button
                                                    className="flex-1 py-1.5 text-[10px] rounded bg-blue-900/50 text-blue-300 hover:bg-blue-800/50 border border-blue-700/40"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onAdjustPolicy && onAdjustPolicy(vassal);
                                                    }}
                                                >
                                                    调整政策
                                                </button>
                                                <button
                                                    className="flex-1 py-1.5 text-[10px] rounded bg-purple-900/50 text-purple-300 hover:bg-purple-800/50 border border-purple-700/40"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onReleaseVassal && onReleaseVassal(vassal);
                                                    }}
                                                >
                                                    释放附庸
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="text-center py-8 text-gray-400 bg-gray-800/30 rounded-lg border border-gray-700/40">
                        <Icon name="Crown" size={40} className="mx-auto mb-3 opacity-50" />
                        <div className="text-base font-semibold mb-1">暂无附庸国</div>
                        <div className="text-sm">通过战争或外交途径征服/接纳附庸</div>
                    </div>
                )}

                {/* 提示 */}
                <div className="text-[10px] text-gray-500 text-center pt-2 border-t border-gray-700/30">
                    💡 高独立倾向的附庸可能发动独立战争，需加强控制或提高满意度
                </div>
            </div>
        </BottomSheet>
    );
});

VassalOverviewPanel.displayName = 'VassalOverviewPanel';

export default VassalOverviewPanel;
