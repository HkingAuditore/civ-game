import React from 'react';
import { Icon, Badge } from '../../common/UnifiedUI';
import { NEGOTIATION_MAX_ROUNDS } from '../../../config/diplomacy';

const DealStatus = ({
    round,
    evaluation,
    counterOffer,
    onViewCounter,
    t = (k, v) => v
}) => {
    const dealScore = Math.round(evaluation.dealScore || 0);
    const dealScale = 2000; // Visual scale range +/- 2000
    // Scale: -100 (Red, Left) to +100 (Green, Right). 0 is Center.
    const progressPercent = Math.min(100, Math.max(0, ((dealScore + dealScale) / (2 * dealScale)) * 100));

    const acceptChance = evaluation.acceptChance || 0;

    // Status color logic
    let statusColor = 'text-ancient-stone';
    let statusText = t('status.evaluating', '评估中');
    if (acceptChance > 0.8) { statusColor = 'text-green-400'; statusText = t('status.veryLikely', '极高可能'); }
    else if (acceptChance > 0.5) { statusColor = 'text-green-200'; statusText = t('status.likely', '有可能'); }
    else if (acceptChance > 0.2) { statusColor = 'text-amber-400'; statusText = t('status.reluctant', '勉强'); }
    else { statusColor = 'text-red-400'; statusText = t('status.hopeless', '毫无希望'); }

    // Extract Breakdown
    const {
        strategicValue = 0,
        politicalCost = 0,
        offerValue = 0,
        demandValue = 0
    } = evaluation.dealBreakdown || {};

    const economicNet = offerValue - demandValue;

    return (
        <div className="w-full flex flex-col gap-2 lg:gap-4">
            {/* Header: Round & Chance */}
            <div className="flex justify-between items-end border-b border-ancient-gold/10 pb-1 lg:pb-2">
                <div className="flex flex-col">
                    <span className="text-[8px] lg:text-[10px] text-ancient-stone uppercase tracking-widest">{t('negotiation.round', '谈判轮次')}</span>
                    <div className="text-base lg:text-xl font-bold font-mono text-ancient-parchment flex items-center gap-1 lg:gap-2">
                        <Icon name="Clock" size={16} className="text-ancient-gold" />
                        {round} <span className="text-ancient-stone text-xs lg:text-sm">/ {NEGOTIATION_MAX_ROUNDS}</span>
                    </div>
                </div>
                <div className="flex flex-col items-end">
                    <span className="text-[8px] lg:text-[10px] text-ancient-stone uppercase tracking-widest">{t('negotiation.successChance', '成功率')}</span>
                    <div className={`text-base lg:text-xl font-bold font-mono ${statusColor}`}>
                        {Math.round(acceptChance * 100)}%
                        <span className="text-[10px] lg:text-xs ml-1 opacity-70">({statusText})</span>
                    </div>
                </div>
            </div>

            {/* Detailed Breakdown Grid */}
            <div className="grid grid-cols-3 gap-2">
                {/* Strategic Value */}
                <div className="bg-blue-900/20 p-2 rounded border border-blue-500/30 flex flex-col items-center">
                    <div className="flex items-center gap-1 mb-1">
                        <Icon name="Shield" size={10} className="text-blue-300" />
                        <span className="text-[9px] text-blue-300 uppercase tracking-wide">{t('breakdown.strategic', '战略价值')}</span>
                    </div>
                    <span className="text-sm font-bold text-blue-100 font-mono">+{Math.round(strategicValue)}</span>
                </div>

                {/* Economic Value */}
                <div className={`p-2 rounded border flex flex-col items-center ${economicNet >= 0 ? 'bg-green-900/20 border-green-500/30' : 'bg-red-900/20 border-red-500/30'}`}>
                    <div className="flex items-center gap-1 mb-1">
                        <Icon name="Coins" size={10} className={economicNet >= 0 ? 'text-green-300' : 'text-red-300'} />
                        <span className={`text-[9px] uppercase tracking-wide ${economicNet >= 0 ? 'text-green-300' : 'text-red-300'}`}>{t('breakdown.economic', '经济净值')}</span>
                    </div>
                    <span className={`text-sm font-bold font-mono ${economicNet >= 0 ? 'text-green-100' : 'text-red-100'}`}>
                        {economicNet > 0 ? '+' : ''}{Math.round(economicNet)}
                    </span>
                </div>

                {/* Political Cost */}
                <div className={`p-2 rounded border flex flex-col items-center ${politicalCost > 0 ? 'bg-orange-900/20 border-orange-500/30' : 'bg-gray-800/30 border-gray-600/30'}`}>
                    <div className="flex items-center gap-1 mb-1">
                        <Icon name="AlertTriangle" size={10} className={politicalCost > 0 ? 'text-orange-300' : 'text-gray-400'} />
                        <span className={`text-[9px] uppercase tracking-wide ${politicalCost > 0 ? 'text-orange-300' : 'text-gray-400'}`}>{t('breakdown.political', '政治风险')}</span>
                    </div>
                    <span className={`text-sm font-bold font-mono ${politicalCost > 0 ? 'text-orange-100' : 'text-gray-400'}`}>
                        -{Math.round(politicalCost)}
                    </span>
                </div>
            </div>

            {/* The Deal Scale Slider */}
            <div className="mt-2 bg-black/40 rounded-xl p-2 lg:p-3 border border-ancient-gold/20 shadow-inner relative overflow-hidden">
                <div className="absolute top-0 bottom-0 left-1/2 w-px bg-ancient-gold/30 z-10" />
                <div className="flex justify-between text-[8px] lg:text-[10px] text-ancient-stone mb-0.5 lg:mb-1 font-bold">
                    <span className="text-red-400">{t('negotiation.loss', 'AI亏损')}</span>
                    <span className="text-green-400">{t('negotiation.gain', 'AI获利')}</span>
                </div>
                <div className="h-2 lg:h-3 w-full bg-gray-800/50 rounded-full relative">
                    <div
                        className={`absolute top-1/2 -translate-y-1/2 w-3 h-3 lg:w-4 lg:h-4 rounded-full border-2 border-white shadow-[0_0_10px_rgba(255,255,255,0.5)] transition-all duration-500 z-20
                            ${dealScore >= 0 ? 'bg-green-500' : 'bg-red-500'}
                        `}
                        style={{ left: `calc(${progressPercent}% - 6px)` }}
                    />
                    <div
                        className={`absolute top-0 bottom-0 transition-all duration-500 opacity-30
                            ${dealScore >= 0 ? 'bg-green-500 left-1/2' : 'bg-red-500 right-1/2'}
                        `}
                        style={{ width: `${Math.abs(progressPercent - 50)}%` }}
                    />
                </div>
                <div className="flex justify-center mt-1 lg:mt-2">
                    <Badge variant={dealScore >= 0 ? 'success' : 'danger'} className="font-mono text-[10px] lg:text-xs">
                        {dealScore > 0 ? '+' : ''}{dealScore}
                    </Badge>
                </div>
            </div>

            {/* Warnings */}
            {evaluation.relationGate && (
                <div className="bg-red-900/20 border border-red-500/30 rounded p-2 flex items-start gap-2 text-xs text-red-300 animate-pulse mt-2">
                    <Icon name="AlertTriangle" size={14} className="mt-0.5 flex-shrink-0" />
                    <span>{t('negotiation.relationBlock', '关系恶劣，对方拒绝谈判。')}</span>
                </div>
            )}

            {/* Counter Offer Alert */}
            {counterOffer && (
                <button
                    onClick={onViewCounter}
                    className="w-full bg-amber-900/20 hover:bg-amber-900/30 border border-amber-500/50 hover:border-amber-400 text-amber-100 p-2 lg:p-3 rounded-xl transition-all shadow-glow-gold flex items-center justify-between group animate-bounce-slow mt-2"
                >
                    <div className="flex items-center gap-3">
                        <div className="p-1.5 lg:p-2 bg-amber-500/20 rounded-full text-amber-400 group-hover:scale-110 transition-transform">
                            <Icon name="MessageSquare" size={16} />
                        </div>
                        <div className="text-left">
                            <div className="font-bold text-xs lg:text-sm text-amber-400">{t('negotiation.counterReceived', '收到反提案')}</div>
                            <div className="text-[9px] lg:text-[10px] text-amber-200/70">{t('negotiation.counterDesc', '对方修改了条款')}</div>
                        </div>
                    </div>
                    <Icon name="ChevronRight" size={14} className="text-amber-500/50 group-hover:translate-x-1 transition-transform" />
                </button>
            )}
        </div>
    );
};

export default DealStatus;
