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
    const dealScale = 2000;
    // Scale: -100 (Red, Left) to +100 (Green, Right). 0 is Center.
    // dealProgress represents the position of the slider from 0% (Left) to 100% (Right).
    // A score of 0 should be at 50%.
    // -2000 => 0%, 0 => 50%, +2000 => 100%
    const progressPercent = Math.min(100, Math.max(0, ((dealScore + dealScale) / (2 * dealScale)) * 100));

    const acceptChance = evaluation.acceptChance || 0;

    // Status color logic
    let statusColor = 'text-ancient-stone';
    let statusText = t('status.evaluating', '评估中');
    if (acceptChance > 0.8) { statusColor = 'text-green-400'; statusText = t('status.veryLikely', '极高可能'); }
    else if (acceptChance > 0.5) { statusColor = 'text-green-200'; statusText = t('status.likely', '有可能'); }
    else if (acceptChance > 0.2) { statusColor = 'text-amber-400'; statusText = t('status.reluctant', '勉强'); }
    else { statusColor = 'text-red-400'; statusText = t('status.hopeless', '毫无希望'); }

    return (
        <div className="w-full flex flex-col gap-4">
            {/* Header: Round & Chance */}
            <div className="flex justify-between items-end border-b border-ancient-gold/10 pb-2">
                <div className="flex flex-col">
                    <span className="text-[10px] text-ancient-stone uppercase tracking-widest">{t('negotiation.round', 'Negotiation Round')}</span>
                    <div className="text-xl font-bold font-mono text-ancient-parchment flex items-center gap-2">
                        <Icon name="Clock" size={16} className="text-ancient-gold" />
                        {round} <span className="text-ancient-stone text-sm">/ {NEGOTIATION_MAX_ROUNDS}</span>
                    </div>
                </div>
                <div className="flex flex-col items-end">
                    <span className="text-[10px] text-ancient-stone uppercase tracking-widest">{t('negotiation.successChance', 'Success Chance')}</span>
                    <div className={`text-xl font-bold font-mono ${statusColor}`}>
                        {Math.round(acceptChance * 100)}%
                        <span className="text-xs ml-1 opacity-70">({statusText})</span>
                    </div>
                </div>
            </div>

            {/* The Deal Scale */}
            <div className="bg-black/40 rounded-xl p-3 border border-ancient-gold/20 shadow-inner relative overflow-hidden">
                {/* Center Marker */}
                <div className="absolute top-0 bottom-0 left-1/2 w-px bg-ancient-gold/30 z-10" />

                {/* Labels */}
                <div className="flex justify-between text-[10px] text-ancient-stone mb-1 font-bold">
                    <span className="text-red-400">{t('negotiation.loss', '亏损 (Loss)')}</span>
                    <span className="text-green-400">{t('negotiation.gain', '获利 (Gain)')}</span>
                </div>

                {/* Bar Background */}
                <div className="h-3 w-full bg-gray-800/50 rounded-full relative">
                    {/* The Indicator Pips */}
                    <div
                        className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border-2 border-white shadow-[0_0_10px_rgba(255,255,255,0.5)] transition-all duration-500 z-20
                            ${dealScore >= 0 ? 'bg-green-500' : 'bg-red-500'}
                        `}
                        style={{ left: `calc(${progressPercent}% - 8px)` }}
                    />
                    {/* The Fill */}
                    <div
                        className={`absolute top-0 bottom-0 transition-all duration-500 opacity-30
                            ${dealScore >= 0 ? 'bg-green-500 left-1/2' : 'bg-red-500 right-1/2'}
                        `}
                        style={{
                            width: `${Math.abs(progressPercent - 50)}%`
                        }}
                    />
                </div>

                <div className="flex justify-center mt-2">
                    <Badge variant={dealScore >= 0 ? 'success' : 'danger'} className="font-mono">
                        {dealScore > 0 ? '+' : ''}{dealScore}
                    </Badge>
                </div>
            </div>

            {/* Warnings */}
            {evaluation.relationGate && (
                <div className="bg-red-900/20 border border-red-500/30 rounded p-2 flex items-start gap-2 text-xs text-red-300 animate-pulse">
                    <Icon name="AlertTriangle" size={14} className="mt-0.5 flex-shrink-0" />
                    <span>{t('negotiation.relationBlock', '关系恶劣，对方拒绝谈判。')}</span>
                </div>
            )}

            {/* Counter Offer Alert */}
            {counterOffer && (
                <button
                    onClick={onViewCounter}
                    className="w-full bg-amber-900/20 hover:bg-amber-900/30 border border-amber-500/50 hover:border-amber-400 text-amber-100 p-3 rounded-xl transition-all shadow-glow-gold flex items-center justify-between group animate-bounce-slow"
                >
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-amber-500/20 rounded-full text-amber-400 group-hover:scale-110 transition-transform">
                            <Icon name="MessageSquare" size={18} />
                        </div>
                        <div className="text-left">
                            <div className="font-bold text-sm text-amber-400">{t('negotiation.counterReceived', '收到反提案')}</div>
                            <div className="text-[10px] text-amber-200/70">{t('negotiation.counterDesc', '对方修改了条款')}</div>
                        </div>
                    </div>
                    <Icon name="ChevronRight" size={16} className="text-amber-500/50 group-hover:translate-x-1 transition-transform" />
                </button>
            )}
        </div>
    );
};

export default DealStatus;
