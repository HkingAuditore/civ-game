import React from 'react';
import { Card, Input, Icon, Tooltip } from '../../common/UnifiedUI';
import { NEGOTIABLE_TREATY_TYPES } from '../../../config/diplomacy';
import { getTreatyLabel, getTreatyUnlockEraName, getTreatyDuration } from '../../../utils/diplomacyUtils';
import { getTreatyEffectDescriptionsByType } from '../../../logic/diplomacy/treatyEffects';

const TreatyTerms = ({
    draft,
    setDraft,
    isDiplomacyUnlocked,
    epoch,
    t = (k, v) => v
}) => {
    return (
        <div className="flex flex-col gap-4 h-full">
            {/* Treaty Type Selector */}
            <div className="space-y-2">
                <label className="text-xs font-bold text-ancient-gold uppercase tracking-wider flex items-center justify-center gap-2">
                    <Icon name="FileText" size={14} />
                    {t('negotiation.treatyType', '条约类型')}
                </label>

                <div className="grid grid-cols-2 gap-2">
                    {NEGOTIABLE_TREATY_TYPES.map((type) => {
                        const locked = !isDiplomacyUnlocked('treaties', type, epoch);
                        const label = getTreatyLabel(type);
                        const isSelected = draft.type === type;
                        const effects = getTreatyEffectDescriptionsByType(type);

                        return (
                            <button
                                key={type}
                                type="button"
                                disabled={locked}
                                onClick={() => {
                                    if (locked) return;
                                    setDraft(prev => ({
                                        ...prev,
                                        type,
                                        durationDays: getTreatyDuration(type, epoch)
                                    }));
                                }}
                                className={`
                                    relative p-2 rounded-lg border text-left transition-all group
                                    ${locked
                                        ? 'opacity-40 cursor-not-allowed border-transparent bg-black/20 grayscale'
                                        : 'hover:border-ancient-gold/40 hover:bg-ancient-gold/5'
                                    }
                                    ${isSelected
                                        ? 'border-ancient-gold bg-ancient-gold/10 shadow-gold-glow-intense'
                                        : 'border-ancient-gold/20 bg-ancient-ink/40'
                                    }
                                `}
                            >
                                <div className="text-xs font-bold text-ancient-parchment truncate">{label}</div>
                                {locked && (
                                    <div className="text-[9px] text-red-400 mt-1 flex items-center gap-1">
                                        <Icon name="Lock" size={8} />
                                        {getTreatyUnlockEraName(type)}
                                    </div>
                                )}

                                {/* Tooltip on Hover */}
                                {!locked && (
                                    <div className="absolute left-0 bottom-full mb-2 w-48 p-2 bg-black/90 border border-ancient-gold/30 rounded shadow-xl z-50 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none text-[10px] text-ancient-stone">
                                        <div className="font-bold text-ancient-gold mb-1">{label}</div>
                                        <ul className="list-disc list-inside space-y-0.5">
                                            {effects.map((e, i) => <li key={i}>{e}</li>)}
                                        </ul>
                                    </div>
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Terms Details */}
            <Card className="p-3 bg-ancient-ink/20 border-ancient-gold/10 space-y-3">
                <div className="flex justify-between items-center text-xs border-b border-ancient-gold/10 pb-2">
                    <span className="text-ancient-stone">{t('negotiation.duration', '持续时间')}</span>
                    <div className="flex items-center gap-1">
                        <Input
                            type="number"
                            min="30"
                            value={draft.durationDays}
                            onChange={(e) => setDraft(prev => ({ ...prev, durationDays: Number(e.target.value) }))}
                            className="w-16 h-6 text-right font-mono text-xs py-0"
                        />
                        <span className="text-ancient-stone text-[10px]">{t('common.days', '天')}</span>
                    </div>
                </div>

                <div className="flex justify-between items-center text-xs">
                    <span className="text-ancient-stone">{t('negotiation.maintenance', '每日维护')}</span>
                    <div className="flex items-center gap-1">
                        <Input
                            type="number"
                            min="0"
                            value={draft.maintenancePerDay}
                            onChange={(e) => setDraft(prev => ({ ...prev, maintenancePerDay: Number(e.target.value) }))}
                            className="w-16 h-6 text-right font-mono text-xs py-0 text-amber-400"
                        />
                        <Icon name="Coins" size={10} className="text-amber-500" />
                    </div>
                </div>
            </Card>

            {/* Stance Selector */}
            <div className="mt-auto pt-2">
                <label className="text-[10px] font-bold text-ancient-stone uppercase tracking-wider mb-2 block text-center">
                    {t('negotiation.stance', '谈判姿态')}
                </label>
                <div className="flex gap-1 bg-black/30 p-1 rounded-lg">
                    {[
                        { key: 'friendly', label: t('stance.friendly', '友好'), icon: 'Smile' },
                        { key: 'normal', label: t('stance.normal', '中立'), icon: 'User' },
                        { key: 'threat', label: t('stance.threat', '强硬'), icon: 'Frown' }
                    ].map(({ key, label, icon }) => (
                        <button
                            key={key}
                            type="button"
                            onClick={() => setDraft(prev => ({ ...prev, stance: key }))}
                            className={`
                                flex-1 py-1.5 px-2 rounded flex flex-col items-center gap-0.5 transition-all
                                ${draft.stance === key
                                    ? 'bg-ancient-gold/20 text-ancient-gold shadow-inner border border-ancient-gold/30'
                                    : 'text-ancient-stone hover:bg-white/5 hover:text-ancient-parchment'
                                }
                            `}
                        >
                            <Icon name={icon} size={14} />
                            <span className="text-[10px] font-bold">{label}</span>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default TreatyTerms;
