import React, { useState } from 'react';
import { Modal, Button, Icon, Card } from '../common/UnifiedUI';
import TradeColumn from './negotiation/TradeColumn';
import TreatyTerms from './negotiation/TreatyTerms';
import DealStatus from './negotiation/DealStatus';
import { RESOURCES } from '../../config/gameConstants';

const NegotiationDialog = ({
    isOpen,
    onClose,
    selectedNation,
    negotiationDraft,
    setNegotiationDraft,
    negotiationRound,
    negotiationEvaluation,
    negotiationCounter,
    negotiationFeedback,
    daysElapsed,
    submitNegotiation,
    isDiplomacyUnlocked,
    epoch,
    tradableResources,
    organizations = [],
    nations = [],
    t = (k, v) => v // Default translation function
}) => {
    // State to toggle Counter Offer view
    const [showCounterOverlay, setShowCounterOverlay] = useState(false);

    // Apply Counter Offer to Draft
    const handleAcceptCounter = () => {
        if (negotiationCounter) {
            submitNegotiation({ ...negotiationCounter, stance: negotiationDraft.stance }, { forceAccept: true, round: negotiationRound });
        }
    };

    // Helper to convert old format to new format
    const convertToResourcesArray = (key, amount) => {
        if (!key || !amount) return [];
        return [{ key, amount }];
    };

    // Helper to format resources for display
    const formatResourcesDisplay = (resources, resourceKey, resourceAmount) => {
        // Support both old and new format
        const resourcesList = resources || convertToResourcesArray(resourceKey, resourceAmount);
        if (!resourcesList || resourcesList.length === 0) return null;
        return resourcesList
            .filter(r => r.key && r.amount > 0)
            .map(r => `${RESOURCES[r.key]?.name || r.key} x${r.amount}`)
            .join(', ');
    };

    const handleApplyCounterToDraft = () => {
        if (!negotiationCounter) return;
        // Convert counter's demands to our offer, and counter's offer to our demand
        const counterDemandResources = negotiationCounter.demandResources || 
            convertToResourcesArray(negotiationCounter.demandResourceKey, negotiationCounter.demandResourceAmount);
        const counterOfferResources = negotiationCounter.resources || 
            convertToResourcesArray(negotiationCounter.resourceKey, negotiationCounter.resourceAmount);
        
        setNegotiationDraft({
            type: negotiationDraft.type,
            durationDays: negotiationCounter.durationDays,
            maintenancePerDay: negotiationCounter.maintenancePerDay,
            signingGift: negotiationCounter.demandSilver || 0,
            resources: counterDemandResources,
            demandSilver: negotiationCounter.signingGift || 0,
            demandResources: counterOfferResources,
            stance: negotiationDraft.stance
        });
        setShowCounterOverlay(false);
    };

    // Footer Rendering
    const renderFooter = () => {
        // military_alliance and economic_bloc are organizations, not treaties
        const isOrganizationType = negotiationDraft.type === 'military_alliance' || negotiationDraft.type === 'economic_bloc';
        const category = isOrganizationType ? 'organizations' : 'treaties';
        const treatyUnlocked = isDiplomacyUnlocked(category, negotiationDraft.type, epoch);
        
        // For organization types, must select an organization or choose to create new
        const organizationSelected = !isOrganizationType || 
            (negotiationDraft.targetOrganizationId && negotiationDraft.organizationMode);
        
        const canSubmit = !!selectedNation && treatyUnlocked && !selectedNation?.isAtWar && organizationSelected;

        return (
            <div className="flex gap-3 justify-end w-full">
                <Button variant="secondary" onClick={onClose} size="sm">
                    {negotiationCounter ? t('negotiation.abandon', '放弃谈判') : t('common.cancel', '取消')}
                </Button>

                {negotiationCounter && (
                     <Button
                        variant="warning"
                        onClick={handleApplyCounterToDraft}
                        icon={<Icon name="RefreshCw" size={14} />}
                        size="sm"
                    >
                        {t('negotiation.loadCounter', '加载反提案')}
                    </Button>
                )}

                {negotiationCounter ? (
                     <Button
                        variant="primary"
                        onClick={handleAcceptCounter}
                        disabled={!canSubmit}
                        icon={<Icon name="Check" size={14} />}
                        className="min-w-[120px]"
                    >
                        {t('negotiation.acceptCounter', '接受反提案')}
                    </Button>
                ) : (
                    <Button
                        variant="epic"
                        onClick={() => submitNegotiation(negotiationDraft, { round: negotiationRound })}
                        disabled={!canSubmit}
                        icon={<Icon name="Send" size={14} />}
                        className="min-w-[120px]"
                    >
                        {t('negotiation.sendOffer', '发起提案')}
                    </Button>
                )}
            </div>
        );
    };

    // Disabled reason for negotiation submit
    const isOrganizationType = negotiationDraft.type === 'military_alliance' || negotiationDraft.type === 'economic_bloc';
    const category = isOrganizationType ? 'organizations' : 'treaties';
    const treatyUnlocked = isDiplomacyUnlocked(category, negotiationDraft.type, epoch);
    const organizationSelected = !isOrganizationType || 
        (negotiationDraft.targetOrganizationId && negotiationDraft.organizationMode);
    const disableReason = !selectedNation
        ? t('negotiation.noNation', '未选择国家')
        : selectedNation?.isAtWar
            ? t('negotiation.atWar', '对方正在战争中，无法谈判')
            : !treatyUnlocked
                ? t('negotiation.treatyLocked', '条约未解锁')
                : !organizationSelected
                    ? t('negotiation.selectOrg', '请选择组织选项')
                    : null;
    const getTreatyEndDay = (treaty) => {
        if (Number.isFinite(treaty?.endDay)) return treaty.endDay;
        if (Number.isFinite(treaty?.startDay) && Number.isFinite(treaty?.duration)) {
            return treaty.startDay + treaty.duration;
        }
        if (Number.isFinite(treaty?.signedDay) && Number.isFinite(treaty?.duration)) {
            return treaty.signedDay + treaty.duration;
        }
        return null;
    };
    const hasActiveOpenMarketTreaty = Array.isArray(selectedNation?.treaties)
        && selectedNation.treaties.some((treaty) => {
            const endDay = getTreatyEndDay(treaty);
            const isActive = endDay == null || (Number.isFinite(daysElapsed) && daysElapsed < endDay);
            return isActive && (treaty.type === 'trade_agreement' || treaty.type === 'open_market' || treaty.type === 'free_trade');
        });
    const willReplaceOpenMarket = negotiationDraft.type === 'open_market' && hasActiveOpenMarketTreaty;

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={`${t('negotiation.title', '外交谈判')} - ${selectedNation?.name || t('common.unknownNation', '未知国家')}`}
            footer={renderFooter()}
            size="xl"
            containerClassName="max-h-[95vh] flex flex-col overflow-hidden"
        >
            <div className="flex-1 flex flex-col lg:grid lg:grid-cols-[1fr_1.5fr_1fr] gap-2 lg:gap-3 overflow-hidden p-1">

                {/* --- LEFT: MY OFFER --- */}
                <div className="lg:order-1 overflow-y-auto custom-scrollbar">
                    <TradeColumn
                        type="offer"
                        draft={negotiationDraft}
                        setDraft={setNegotiationDraft}
                        tradableResources={tradableResources}
                        t={t}
                    />
                </div>

                {/* --- CENTER: TERMS & STATUS --- */}
                <div className="flex flex-col gap-2 lg:order-2 overflow-y-auto custom-scrollbar">
                    {/* Status Section */}
                    <Card className="p-2 bg-black/40 border-ancient-gold/20 flex-shrink-0">
                        <DealStatus
                            round={negotiationRound}
                            evaluation={negotiationEvaluation}
                            counterOffer={negotiationCounter}
                            onViewCounter={() => setShowCounterOverlay(true)}
                            t={t}
                        />
                    </Card>

                    {/* Terms Section */}
                    <div className="flex-1 min-h-0">
                         <TreatyTerms
                            draft={negotiationDraft}
                            setDraft={setNegotiationDraft}
                            isDiplomacyUnlocked={isDiplomacyUnlocked}
                            epoch={epoch}
                            organizations={organizations}
                            nations={nations}
                            selectedNation={selectedNation}
                            t={t}
                        />
                    </div>
                </div>

                {/* --- RIGHT: MY DEMAND --- */}
                <div className="lg:order-3 overflow-y-auto custom-scrollbar">
                     <TradeColumn
                        type="demand"
                        draft={negotiationDraft}
                        setDraft={setNegotiationDraft}
                        tradableResources={tradableResources}
                        t={t}
                    />
                </div>
            </div>

            {(negotiationFeedback || disableReason || willReplaceOpenMarket) && (
                <div className="mt-2 rounded border border-red-500/40 bg-red-950/40 px-3 py-2 text-xs text-red-200">
                    {negotiationFeedback || disableReason || '将覆盖现有贸易协定。'}
                </div>
            )}

            {/* Counter Offer Overlay */}
            {showCounterOverlay && negotiationCounter && (
                <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
                    <Card className="w-full max-w-lg bg-ancient-ink border-2 border-amber-500/50 shadow-2xl relative">
                        <button
                            onClick={() => setShowCounterOverlay(false)}
                            className="absolute top-2 right-2 p-2 hover:bg-white/10 rounded-full"
                        >
                            <Icon name="X" size={20} />
                        </button>

                        <div className="p-6 space-y-4">
                            <div className="flex items-center gap-3 text-amber-400 border-b border-amber-500/30 pb-4">
                                <Icon name="MessageSquare" size={24} />
                                <h3 className="text-xl font-bold font-decorative">{t('negotiation.counterOfferTitle', '对方提出的反向提案')}</h3>
                            </div>

                            <div className="grid grid-cols-2 gap-6 text-sm">
                                <div className="space-y-3">
                                    <h4 className="font-bold text-ancient-stone uppercase text-xs">{t('negotiation.theyPay', '对方愿意支付')}</h4>
                                    <div className="flex justify-between border-b border-white/10 pb-1">
                                        <span>{t('negotiation.signingGift', '签约金')}:</span>
                                        <span className="font-mono text-amber-400">{negotiationCounter.signingGift || 0}</span>
                                    </div>
                                    <div className="flex justify-between border-b border-white/10 pb-1">
                                        <span>{t('negotiation.resource', '资源')}:</span>
                                        <span className="font-mono text-cyan-400">
                                            {formatResourcesDisplay(negotiationCounter.resources, negotiationCounter.resourceKey, negotiationCounter.resourceAmount) || t('common.none', '无')}
                                        </span>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <h4 className="font-bold text-ancient-stone uppercase text-xs">{t('negotiation.theyDemand', '对方索要')}</h4>
                                    <div className="flex justify-between border-b border-white/10 pb-1">
                                        <span>{t('negotiation.silver', '银币')}:</span>
                                        <span className="font-mono text-red-400">{negotiationCounter.demandSilver || 0}</span>
                                    </div>
                                    <div className="flex justify-between border-b border-white/10 pb-1">
                                        <span>{t('negotiation.resource', '资源')}:</span>
                                        <span className="font-mono text-red-400">
                                            {formatResourcesDisplay(negotiationCounter.demandResources, negotiationCounter.demandResourceKey, negotiationCounter.demandResourceAmount) || t('common.none', '无')}
                                        </span>
                                    </div>
                                </div>

                                <div className="col-span-2 mt-2 pt-2 border-t border-white/10 flex justify-between text-xs text-ancient-stone">
                                    <span>{t('negotiation.duration', '期限')}: <span className="text-white">{negotiationCounter.durationDays} {t('common.days', '天')}</span></span>
                                    <span>{t('negotiation.maintenance', '维护费')}: <span className="text-white">{negotiationCounter.maintenancePerDay} {t('common.perDay', '/日')}</span></span>
                                </div>
                            </div>

                            <div className="flex gap-3 mt-6 pt-4">
                                <Button variant="secondary" onClick={() => setShowCounterOverlay(false)} className="flex-1">
                                    {t('common.close', '关闭')}
                                </Button>
                                <Button variant="warning" onClick={handleApplyCounterToDraft} className="flex-1">
                                    {t('negotiation.modifyToCounter', '修改为该方案')}
                                </Button>
                                <Button variant="primary" onClick={handleAcceptCounter} className="flex-1">
                                    {t('negotiation.acceptDirectly', '直接成交')}
                                </Button>
                            </div>
                        </div>
                    </Card>
                </div>
            )}

        </Modal>
    );
};

export default NegotiationDialog;
