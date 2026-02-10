/**
 * 条约签署模态框
 * 显示条约详细信息、成本、效果预览，支持签署/取消操作
 */

import React, { useMemo, memo } from 'react';
import { BottomSheet } from '../tabs/BottomSheet';
import { Icon } from '../common/UIComponents';
import { formatNumberShortCN } from '../../utils/numberFormat';
import {
    TREATY_TYPE_LABELS,
    TREATY_CONFIGS,
    TREATY_COSTS,
    DIPLOMACY_ERA_UNLOCK,
    getTreatyDuration,
    calculateTreatySigningCost,
    getTreatyDailyMaintenance,
    isDiplomacyUnlocked,
} from '../../config/diplomacy';
import { getTreatyEffectDescriptionsByType } from '../../logic/diplomacy/treatyEffects';

// 条约图标和颜色配置
const TREATY_VISUALS = {
    peace_treaty: { icon: 'Handshake', color: 'green', bg: 'bg-green-900/40', border: 'border-green-600/50' },
    non_aggression: { icon: 'Shield', color: 'emerald', bg: 'bg-emerald-900/40', border: 'border-emerald-600/50' },
    trade_agreement: { icon: 'Handshake', color: 'amber', bg: 'bg-amber-900/40', border: 'border-amber-600/50' },
    free_trade: { icon: 'Globe', color: 'teal', bg: 'bg-teal-900/40', border: 'border-teal-600/50' },
    investment_pact: { icon: 'Building2', color: 'cyan', bg: 'bg-cyan-900/40', border: 'border-cyan-600/50' },
    open_market: { icon: 'Store', color: 'blue', bg: 'bg-blue-900/40', border: 'border-blue-600/50' },
    academic_exchange: { icon: 'BookOpen', color: 'purple', bg: 'bg-purple-900/40', border: 'border-purple-600/50' },
    defensive_pact: { icon: 'ShieldCheck', color: 'red', bg: 'bg-red-900/40', border: 'border-red-600/50' },
};

/**
 * 条约签署模态框
 */
export const TreatyNegotiationModal = memo(({
    isOpen,
    onClose,
    targetNation,
    treatyType,
    epoch = 0,
    playerWealth = 0,
    daysElapsed = 0,
    onPropose,
    existingTreaties = [],
}) => {
    // 计算条约详情
    const treatyDetails = useMemo(() => {
        if (!treatyType || !targetNation) return null;

        const isUnlocked = isDiplomacyUnlocked('treaties', treatyType, epoch);
        const config = TREATY_CONFIGS[treatyType];
        const unlockEra = DIPLOMACY_ERA_UNLOCK.treaties[treatyType]?.minEra || 0;
        const duration = getTreatyDuration(treatyType, epoch);
        const signingCost = calculateTreatySigningCost(treatyType, playerWealth, targetNation.wealth || 1000, epoch);
        const dailyMaintenance = getTreatyDailyMaintenance(treatyType, playerWealth, targetNation.wealth || 1000);
        const visual = TREATY_VISUALS[treatyType] || TREATY_VISUALS.peace_treaty;
        const effects = getTreatyEffectDescriptionsByType(treatyType);

        // 检查是否已有同类型条约
        const hasExisting = existingTreaties.some(t => t.type === treatyType && (!t.endDay || daysElapsed < t.endDay));

        // 关系要求
        const minRelation = config?.minRelation || 0;
        const currentRelation = targetNation.relation || 50;
        const relationMet = currentRelation >= minRelation;

        // 是否可签署
        const canSign = isUnlocked && relationMet && !hasExisting && playerWealth >= signingCost;

        let blockReason = null;
        if (!isUnlocked) blockReason = `需要${DIPLOMACY_ERA_UNLOCK.treaties[treatyType]?.name || '更高时代'}解锁（Era ${unlockEra}+）`;
        else if (!relationMet) blockReason = `关系需达到 ${minRelation}（当前 ${Math.round(currentRelation)}）`;
        else if (hasExisting) blockReason = '已有同类型条约生效中';
        else if (playerWealth < signingCost) blockReason = `资金不足（需要 ${signingCost}）`;

        return {
            type: treatyType,
            name: TREATY_TYPE_LABELS[treatyType] || treatyType,
            isUnlocked,
            unlockEra,
            duration,
            durationYears: Math.round(duration / 365 * 10) / 10,
            signingCost,
            dailyMaintenance,
            monthlyMaintenance: dailyMaintenance * 30,
            visual,
            effects,
            minRelation,
            currentRelation,
            relationMet,
            hasExisting,
            canSign,
            blockReason,
        };
    }, [treatyType, targetNation, epoch, playerWealth, existingTreaties, daysElapsed]);

    if (!treatyDetails || !targetNation) return null;

    return (
        <BottomSheet
            isOpen={isOpen}
            onClose={onClose}
            title={`📜 ${treatyDetails.name}`}
        >
            <div className="space-y-3">
                {/* 条约头部 */}
                <div className={`p-3 rounded-lg border ${treatyDetails.visual.bg} ${treatyDetails.visual.border}`}>
                    <div className="flex items-center gap-2">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${treatyDetails.visual.bg}`}>
                            <Icon name={treatyDetails.visual.icon} size={20} className={`text-${treatyDetails.visual.color}-400`} />
                        </div>
                        <div>
                            <h3 className="text-base font-bold text-white">{treatyDetails.name}</h3>
                            <div className="text-sm text-gray-400">
                                与 <span className="text-amber-300">{targetNation.name}</span> 签订
                            </div>
                        </div>
                    </div>
                </div>

                {/* 条约效果 */}
                <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700/40">
                    <h4 className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
                        <Icon name="Sparkles" size={14} className="text-amber-400" />
                        条约效果
                    </h4>
                    <div className="space-y-1.5">
                        {treatyDetails.effects.length > 0 ? (
                            treatyDetails.effects.map((effect, idx) => (
                                <div key={idx} className="flex items-center gap-2 text-sm text-gray-300">
                                    <Icon name="Check" size={12} className="text-green-400" />
                                    {effect}
                                </div>
                            ))
                        ) : (
                            <div className="text-xs text-gray-500">暂无明确经济效果</div>
                        )}
                    </div>
                </div>

                {/* 条约参数 */}
                <div className="grid grid-cols-2 gap-2">
                    <div className="bg-gray-800/50 rounded-lg p-2.5 border border-gray-700/40">
                        <div className="text-[10px] text-gray-400 mb-0.5">有效期</div>
                        <div className="text-base font-bold text-white">
                            {treatyDetails.durationYears}年
                            <span className="text-xs text-gray-500 ml-1">({treatyDetails.duration}天)</span>
                        </div>
                    </div>
                    <div className="bg-gray-800/50 rounded-lg p-2.5 border border-gray-700/40">
                        <div className="text-[10px] text-gray-400 mb-0.5">解锁时代</div>
                        <div className={`text-base font-bold ${treatyDetails.isUnlocked ? 'text-green-400' : 'text-red-400'}`}>
                            {treatyDetails.isUnlocked ? '✓ 已解锁' : `Era ${treatyDetails.unlockEra}`}
                        </div>
                    </div>
                    <div className="bg-amber-900/30 rounded-lg p-2.5 border border-amber-700/40">
                        <div className="text-[10px] text-amber-400 mb-0.5">签约成本</div>
                        <div className="text-base font-bold text-amber-200">
                            {formatNumberShortCN(treatyDetails.signingCost)} 银
                        </div>
                    </div>
                    <div className="bg-gray-800/50 rounded-lg p-2.5 border border-gray-700/40">
                        <div className="text-[10px] text-gray-400 mb-0.5">月维护费</div>
                        <div className="text-base font-bold text-gray-200">
                            {treatyDetails.monthlyMaintenance > 0 ? `${treatyDetails.monthlyMaintenance} 银/月` : '无'}
                        </div>
                    </div>
                </div>

                {/* 关系要求 */}
                <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700/40">
                    <div className="flex items-center justify-between">
                        <div className="text-sm text-gray-300">关系要求</div>
                        <div className={`text-sm font-semibold ${treatyDetails.relationMet ? 'text-green-400' : 'text-red-400'}`}>
                            {treatyDetails.currentRelation.toFixed(0)} / {treatyDetails.minRelation}
                            {treatyDetails.relationMet ? ' ✓' : ' ✗'}
                        </div>
                    </div>
                    {/* 关系进度条 */}
                    <div className="mt-2 h-2 bg-gray-700 rounded-full overflow-hidden">
                        <div
                            className={`h-full transition-all ${treatyDetails.relationMet ? 'bg-green-500' : 'bg-red-500'}`}
                            style={{ width: `${Math.min(100, (treatyDetails.currentRelation / treatyDetails.minRelation) * 100)}%` }}
                        />
                    </div>
                </div>

                {/* 阻止原因 */}
                {treatyDetails.blockReason && (
                    <div className="bg-red-900/30 rounded-lg p-3 border border-red-700/40 text-red-300 text-sm flex items-center gap-2">
                        <Icon name="AlertTriangle" size={16} />
                        {treatyDetails.blockReason}
                    </div>
                )}

                {/* 操作按钮 */}
                <div className="flex gap-2">
                    <button
                        className="flex-1 py-2.5 px-4 rounded-lg bg-gray-700 hover:bg-gray-600 text-white font-semibold text-sm transition-all"
                        onClick={onClose}
                    >
                        取消
                    </button>
                    <button
                        className={`flex-1 py-2.5 px-4 rounded-lg font-semibold text-sm transition-all flex items-center justify-center gap-2 ${treatyDetails.canSign
                                ? 'bg-green-600 hover:bg-green-500 text-white'
                                : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                            }`}
                        onClick={() => {
                            if (treatyDetails.canSign && onPropose) {
                                onPropose(targetNation.id, treatyType, { durationDays: treatyDetails.duration });
                                onClose();
                            }
                        }}
                        disabled={!treatyDetails.canSign}
                    >
                        <Icon name="FileSignature" size={16} />
                        提议签署
                    </button>
                </div>

                {/* 提示 */}
                <div className="text-[10px] text-gray-500 text-center">
                    💡 签约需双方同意，AI国家将基于关系和利益评估决定是否接受
                </div>
            </div>
        </BottomSheet>
    );
});

TreatyNegotiationModal.displayName = 'TreatyNegotiationModal';

export default TreatyNegotiationModal;
