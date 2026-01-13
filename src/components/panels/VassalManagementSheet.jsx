/**
 * 附庸管理面板 (Bottom Sheet)
 * 用于管理单个附庸国家的详细设置
 */

import React, { useMemo, memo } from 'react';
import { BottomSheet } from '../tabs/BottomSheet';
import { Icon } from '../common/UIComponents';
import { Button } from '../common/UnifiedUI';
import { formatNumberShortCN } from '../../utils/numberFormat';
import { VASSAL_TYPE_LABELS, VASSAL_TYPE_CONFIGS } from '../../config/diplomacy';
import { calculateEnhancedTribute } from '../../logic/diplomacy/vassalSystem';

/**
 * 附庸管理 Bottom Sheet
 */
export const VassalManagementSheet = memo(({
    isOpen,
    onClose,
    nation,
    playerResources = {},
    onVassalPolicy,
    onDiplomaticAction,
}) => {
    // 如果不是玩家的附庸，不显示
    if (!nation || nation.vassalOf !== 'player') {
        return (
            <BottomSheet
                isOpen={isOpen}
                onClose={onClose}
                title="⚠️ 无法管理"
            >
                <div className="p-8 text-center text-gray-400">
                    <Icon name="ShieldQuestion" size={48} className="mx-auto mb-4 opacity-50" />
                    <div className="text-base">该国家不是你的附庸</div>
                </div>
            </BottomSheet>
        );
    }

    // 计算朝贡信息
    const tribute = useMemo(() => {
        return calculateEnhancedTribute(nation, playerResources.silver || 10000);
    }, [nation, playerResources]);

    const independence = nation.independencePressure || 0;
    const autonomy = nation.autonomy || 0;
    const isAtRisk = independence > 60;
    const vassalType = nation.vassalType || 'protectorate';
    const typeConfig = VASSAL_TYPE_CONFIGS?.[vassalType] || {};

    return (
        <BottomSheet
            isOpen={isOpen}
            onClose={onClose}
            title={`👑 ${nation.name} - 附庸管理`}
        >
            <div className="space-y-4">
                {/* 附庸类型标识 */}
                <div className="flex items-center justify-between p-3 bg-purple-900/30 rounded-lg border border-purple-700/40">
                    <div className="flex items-center gap-2">
                        <Icon name="Crown" size={18} className="text-purple-400" />
                        <span className="text-purple-200 font-semibold">
                            {VASSAL_TYPE_LABELS?.[vassalType] || '保护国'}
                        </span>
                    </div>
                    {isAtRisk && (
                        <span className="px-2 py-1 text-xs bg-red-600 text-white rounded animate-pulse">
                            ⚠️ 独立风险
                        </span>
                    )}
                </div>

                {/* 主要指标 */}
                <div className="grid grid-cols-2 gap-3">
                    {/* 自治度 */}
                    <div className="p-4 bg-gray-800/50 rounded-lg border border-gray-700/40">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-xs text-gray-400 uppercase tracking-wider">自治度</span>
                            <span className="text-xl font-bold text-purple-300 font-mono">
                                {Math.round(autonomy)}%
                            </span>
                        </div>
                        <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-purple-500 transition-all duration-300"
                                style={{ width: `${autonomy}%` }}
                            />
                        </div>
                        <div className="text-[10px] text-gray-500 mt-1">
                            {autonomy > 70 ? '高度自治' : autonomy > 40 ? '中等控制' : '严密控制'}
                        </div>
                    </div>

                    {/* 独立倾向 */}
                    <div className={`p-4 rounded-lg border ${isAtRisk ? 'bg-red-900/30 border-red-700/40' : 'bg-gray-800/50 border-gray-700/40'}`}>
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-xs text-gray-400 uppercase tracking-wider">独立倾向</span>
                            <span className={`text-xl font-bold font-mono ${isAtRisk ? 'text-red-400' : 'text-green-400'}`}>
                                {Math.round(independence)}%
                            </span>
                        </div>
                        <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                            <div
                                className={`h-full transition-all duration-300 ${isAtRisk ? 'bg-red-500' : 'bg-green-500'}`}
                                style={{ width: `${independence}%` }}
                            />
                        </div>
                        <div className="text-[10px] text-gray-500 mt-1">
                            {independence > 80 ? '即将独立!' : independence > 60 ? '有独立意向' : independence > 30 ? '轻微不满' : '忠诚'}
                        </div>
                    </div>
                </div>

                {/* 朝贡信息 */}
                <div className="p-4 bg-amber-900/20 rounded-lg border border-amber-700/40">
                    <div className="flex items-center gap-2 mb-3">
                        <Icon name="Coins" size={18} className="text-amber-400" />
                        <span className="text-amber-200 font-semibold">朝贡收入</span>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <div className="text-xs text-gray-400">月朝贡</div>
                            <div className="text-lg font-bold text-amber-300">
                                +{formatNumberShortCN(tribute.silver || 0)} 银
                            </div>
                        </div>
                        <div>
                            <div className="text-xs text-gray-400">朝贡率</div>
                            <div className="text-lg font-bold text-amber-300">
                                {Math.round((nation.tributeRate || 0) * 100)}%
                            </div>
                        </div>
                    </div>
                </div>

                {/* 详细信息 */}
                <div className="p-4 bg-gray-800/30 rounded-lg border border-gray-700/40">
                    <div className="text-xs text-gray-400 uppercase tracking-wider mb-3">附庸详情</div>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                        <div className="flex justify-between">
                            <span className="text-gray-400">人口:</span>
                            <span className="text-white">{formatNumberShortCN(nation.population || 0)}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-400">财富:</span>
                            <span className="text-white">{formatNumberShortCN(nation.wealth || 0)}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-400">军事通行:</span>
                            <span className={typeConfig.militaryAccess ? 'text-green-400' : 'text-red-400'}>
                                {typeConfig.militaryAccess ? '允许' : '不允许'}
                            </span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-400">外交自主:</span>
                            <span className={typeConfig.diplomaticAutonomy ? 'text-yellow-400' : 'text-green-400'}>
                                {typeConfig.diplomaticAutonomy ? '独立' : '跟随宗主'}
                            </span>
                        </div>
                    </div>
                </div>

                {/* 操作按钮 */}
                <div className="space-y-2 pt-2">
                    <Button
                        onClick={() => {
                            onVassalPolicy?.(nation);
                            onClose();
                        }}
                        variant="primary"
                        className="w-full"
                    >
                        <Icon name="Settings" size={16} className="mr-2" />
                        调整附庸政策
                    </Button>
                    <Button
                        onClick={() => {
                            onDiplomaticAction?.(nation.id, 'release_vassal');
                            onClose();
                        }}
                        variant="danger"
                        className="w-full"
                    >
                        <Icon name="Unlock" size={16} className="mr-2" />
                        释放附庸
                    </Button>
                </div>

                {/* 提示 */}
                {isAtRisk && (
                    <div className="p-3 bg-red-900/30 rounded-lg border border-red-700/40 text-center">
                        <div className="text-xs text-red-300">
                            ⚠️ 该附庸国独立倾向过高，可能随时发动独立战争！
                        </div>
                        <div className="text-[10px] text-red-400/70 mt-1">
                            建议：降低朝贡率、提高自治度或军事镇压
                        </div>
                    </div>
                )}
            </div>
        </BottomSheet>
    );
});

VassalManagementSheet.displayName = 'VassalManagementSheet';

export default VassalManagementSheet;
