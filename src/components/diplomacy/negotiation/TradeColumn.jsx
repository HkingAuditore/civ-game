import React from 'react';
import { Card, Input, Icon } from '../../common/UnifiedUI';
import { RESOURCES } from '../../../config/gameConstants';

const TradeColumn = ({
    type,
    draft,
    setDraft,
    tradableResources,
    className,
    t = (k, v) => v
}) => {
    const isOffer = type === 'offer';
    const silverKey = isOffer ? 'signingGift' : 'demandSilver';
    const resourceKeyKey = isOffer ? 'resourceKey' : 'demandResourceKey';
    const resourceAmountKey = isOffer ? 'resourceAmount' : 'demandResourceAmount';

    // Theme colors
    const themeColor = isOffer ? 'text-green-400' : 'text-red-400';
    const iconName = isOffer ? 'Gift' : 'Hand';
    const borderColor = isOffer ? 'border-green-500/30' : 'border-red-500/30';
    const bgColor = isOffer ? 'bg-green-900/10' : 'bg-red-900/10';

    return (
        <Card className={`h-full flex flex-col gap-4 ${bgColor} ${borderColor} ${className}`}>
            <div className={`text-sm font-bold uppercase tracking-wider flex items-center gap-2 border-b ${borderColor} pb-3 mb-1 ${themeColor}`}>
                <Icon name={iconName} size={16} />
                {isOffer ? t('negotiation.myOffer', '我方筹码 (Offer)') : t('negotiation.myDemand', '我方索求 (Demand)')}
            </div>

            <div className="flex-1 space-y-6">
                {/* Silver Input */}
                <div className="space-y-2">
                    <label className="text-xs text-ancient-stone uppercase font-bold flex items-center gap-1">
                        <Icon name="Coins" size={12} className={isOffer ? 'text-amber-400' : 'text-red-300'} />
                        {isOffer ? t('negotiation.paySilver', '支付银币') : t('negotiation.demandSilver', '索要银币')}
                    </label>

                    {/* Updated Silver Input with Flex Layout for Robustness */}
                    <div className={`flex items-center rounded-lg overflow-hidden border transition-colors group
                         ${isOffer ? 'border-ancient-gold/10 hover:border-ancient-gold/30 bg-black/20' : 'border-ancient-gold/10 hover:border-ancient-gold/30 bg-black/20'}
                    `}>
                        <input
                            type="number"
                            min="0"
                            value={draft[silverKey]}
                            onChange={(e) => setDraft(prev => ({ ...prev, [silverKey]: Number(e.target.value) }))}
                            className={`flex-1 bg-transparent py-2 pl-3 text-right font-mono text-lg font-bold outline-none
                                ${isOffer ? 'text-amber-400' : 'text-red-300'}
                            `}
                        />
                         <div className="px-3 py-2 text-xs text-ancient-stone bg-black/20 h-full flex items-center select-none border-l border-white/5">
                            {t('negotiation.silverUnit', 'Silver')}
                        </div>
                    </div>
                </div>

                {/* Resource Input */}
                <div className="space-y-2">
                    <label className="text-xs text-ancient-stone uppercase font-bold flex items-center gap-1">
                        <Icon name="Package" size={12} className="text-blue-400" />
                        {isOffer ? t('negotiation.giveResource', '交付资源') : t('negotiation.askResource', '索取资源')}
                    </label>

                    <div className="bg-black/20 rounded-lg p-1 border border-ancient-gold/10 hover:border-ancient-gold/30 transition-colors">
                        <select
                            className="w-full bg-transparent text-ancient-parchment text-sm p-2 outline-none cursor-pointer"
                            value={draft[resourceKeyKey]}
                            onChange={(e) => setDraft(prev => ({ ...prev, [resourceKeyKey]: e.target.value }))}
                        >
                            <option value="" className="bg-gray-900 text-ancient-stone">{t('negotiation.selectResource', '-- 选择资源 --')}</option>
                            {tradableResources.map(([key, res]) => (
                                <option key={key} value={key} className="bg-gray-900">
                                    {res.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    {draft[resourceKeyKey] && (
                        <div className="relative group animate-fade-in-up">
                            <Input
                                type="number"
                                min="0"
                                placeholder={t('common.amount', '数量')}
                                value={draft[resourceAmountKey]}
                                onChange={(e) => setDraft(prev => ({ ...prev, [resourceAmountKey]: Number(e.target.value) }))}
                                className="font-mono text-center text-lg font-bold text-blue-300 bg-black/20 border-ancient-gold/10 group-hover:border-ancient-gold/30"
                            />
                            <div className="text-center text-[10px] text-ancient-stone mt-1">
                                {RESOURCES[draft[resourceKeyKey]]?.name || ''}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </Card>
    );
};

export default TradeColumn;
