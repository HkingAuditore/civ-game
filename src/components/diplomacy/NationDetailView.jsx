import React, { useMemo, useState } from 'react';
import { Button, Card, Tabs, Badge } from '../common/UnifiedUI';
import { Icon } from '../common/UIComponents';
import { RESOURCES, DIPLOMACY_ERA_UNLOCK, BUILDINGS } from '../../config';
import { ORGANIZATION_EFFECTS, TRADE_POLICY_DEFINITIONS, VASSAL_TYPE_CONFIGS } from '../../config/diplomacy';
import { getEstimatedMilitaryStrength } from '../../logic/diplomacy/militaryUtils';
import { getForeignInvestmentTaxRate, hasActiveTreaty, isInSameBloc } from '../../logic/diplomacy/overseasInvestment';
import { getRelationLabel } from '../../utils/diplomacyUtils';
import { calculateDynamicGiftCost, calculateProvokeCost } from '../../utils/diplomaticUtils';
import { calculateForeignPrice, calculateTradeStatus, calculateMaxTradeRoutes } from '../../utils/foreignTrade';
import { getTreatyEffects } from '../../logic/diplomacy/treatyEffects';
import { useLongPress } from '../../hooks/useLongPress';
import { getNationOrganizations, ORGANIZATION_TYPE_CONFIGS } from '../../logic/diplomacy/organizationDiplomacy';

const formatStat = (val) => {
    const numberValue = Number(val || 0);
    if (!Number.isFinite(numberValue)) return '0';
    if (numberValue >= 100000000) return `${(numberValue / 100000000).toFixed(1)}亿`;
    if (numberValue >= 10000) return `${(numberValue / 10000).toFixed(1)}万`;
    return numberValue.toLocaleString();
};

const getTradableResources = (epoch = 0) => {
    return Object.entries(RESOURCES).filter(([key, info]) => {
        if (info.type === 'virtual' || info.type === 'currency') return false;
        if (typeof info.unlockEpoch === 'number' && info.unlockEpoch > epoch) return false;
        return key !== 'silver';
    });
};

// Diplomatic action cooldown configuration (days)
const DIPLOMATIC_COOLDOWNS = {
    gift: 30,
    insult: 30,
    provoke: 30,
    negotiate_treaty: 120,
};

const NationDetailView = ({
    nation,
    relationInfo,
    epoch,
    daysElapsed,
    market,
    diplomaticCooldownMod,
    onDiplomaticAction,
    onNegotiate,
    onDeclareWar,
    onProvoke,
    onOverseasInvestment,
    onOpenVassalSheet,
    diplomacyOrganizations,
    tradeRoutes,
    merchantState,
    onMerchantStateChange,
    foreignInvestments = [],
    gameState,
    taxPolicies,
    popStructure,
    nations = [],  // For AI-AI war lookup
}) => {
    const [activeTab, setActiveTab] = useState('overview');

    // Calculate cooldown status for each action
    const currentDay = gameState?.day || daysElapsed || 0;
    const getCooldownInfo = (actionType) => {
        const lastActionDay = nation?.lastDiplomaticActionDay?.[actionType] || 0;
        const cooldownDays = DIPLOMATIC_COOLDOWNS[actionType] || 0;
        const daysSinceLastAction = currentDay - lastActionDay;
        const isOnCooldown = lastActionDay > 0 && daysSinceLastAction < cooldownDays;
        const remainingDays = isOnCooldown ? cooldownDays - daysSinceLastAction : 0;
        return { isOnCooldown, remainingDays };
    };

    const giftCooldown = getCooldownInfo('gift');
    const insultCooldown = getCooldownInfo('insult');
    const provokeCooldown = getCooldownInfo('provoke');
    const negotiateCooldown = getCooldownInfo('negotiate_treaty');

    // Calculate costs
    const playerWealth = gameState?.resources?.silver || 0;
    const targetWealth = nation.wealth || 0;

    const giftCostValue = calculateDynamicGiftCost(playerWealth, targetWealth);
    const provokeCostValue = calculateProvokeCost(playerWealth, targetWealth);

    const formatCost = (val) => val >= 10000 ? `${(val / 10000).toFixed(1)}万` : val;

    const strengthEstimate = getEstimatedMilitaryStrength
        ? getEstimatedMilitaryStrength(nation, epoch, daysElapsed)
        : { label: '???', colorClass: 'text-gray-400' };

    const relation = relationInfo
        ? relationInfo(nation)
        : { value: 0, label: '未知', color: 'text-ancient-stone', bg: '' };

    const tabs = [
        { id: 'overview', label: '国家概览' },
        { id: 'actions', label: '外交行动' },
        { id: 'trade', label: '贸易与投资' },
        { id: 'vassal', label: '附庸管理' },
    ];

    const sharedMilitaryAlliance = useMemo(() => {
        const orgs = diplomacyOrganizations?.organizations || [];
        return orgs.find(org =>
            org?.type === 'military_alliance' &&
            Array.isArray(org.members) &&
            org.members.includes('player') &&
            org.members.includes(nation.id)
        );
    }, [diplomacyOrganizations, nation.id]);

    const isPlayerVassalTarget = nation.vassalOf === 'player';

    const declareWarDisabled = Boolean(sharedMilitaryAlliance) || isPlayerVassalTarget;
    const declareWarDesc = sharedMilitaryAlliance
        ? `无法宣战：同属军事组织 ${sharedMilitaryAlliance.name}，需先退出。`
        : isPlayerVassalTarget
            ? '无法宣战：该国为你的附庸。'
            : '开启战争！这将导致声誉受损和贸易中断。';

    return (
        <div className="flex flex-col h-full bg-theme-surface-trans">
            <div
                className="p-4 md:p-6 border-b border-theme-border flex-shrink-0"
                style={{ background: 'linear-gradient(to bottom, var(--theme-surface), transparent)' }}
            >
                {/* Header Section */}
                <div className="flex justify-between items-start">
                    <div className="flex items-center gap-4">
                        <div
                            className={`w-12 h-10 md:w-16 md:h-12 flex items-center justify-center bg-black/50 rounded-lg border-2 ${nation.color ? nation.color.replace('text-', 'border-') : 'border-gray-600'} shadow-lg`}
                        >
                            <Icon name="Flag" size={24} className={`${nation.color || 'text-gray-400'} md:w-8 md:h-8`} />
                        </div>
                        <div>
                            <h2 className="text-2xl md:text-3xl font-bold text-theme-accent tracking-wide font-decorative shadow-black drop-shadow-md">
                                {nation.name}
                            </h2>
                            <div className="flex items-center gap-2 mt-1">
                                <span
                                    className={`flex items-center gap-1 text-sm font-bold px-2 py-0.5 rounded border bg-black/40 ${relation.value >= 50 ? 'text-green-400 border-green-800' : relation.value <= 20 ? 'text-red-400 border-red-800' : 'text-ancient-stone border-ancient-stone/40'}`}
                                >
                                    <Icon name={relation.value >= 50 ? 'Smile' : relation.value <= 20 ? 'Frown' : 'Meh'} size={14} />
                                    {getRelationLabel(relation.value)} ({Math.round(relation.value)})
                                </span>
                                {nation.type && (
                                    <Badge variant="neutral" className="capitalize">
                                        {nation.type}
                                    </Badge>
                                )}
                                {nation.isAtWar && (
                                    <Badge variant="danger" className="animate-pulse">
                                        战争状态
                                    </Badge>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Key Stats Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
                    <StatCard icon="Users" label="人口" value={formatStat(nation.population)} color="text-blue-300" />
                    <StatCard icon="Coins" label="财富" value={formatStat(nation.wealth)} color="text-amber-300" />
                    <StatCard
                        icon="Swords"
                        label="军力评估"
                        value={strengthEstimate.label}
                        color={strengthEstimate.colorClass}
                    />
                    <StatCard
                        icon="Crown"
                        label="外交姿态"
                        value={nation.stance && nation.stance !== 'neutral' ? nation.stance : (relation.value > 60 ? '友善' : relation.value < 40 ? '提防' : '中立')}
                        color="text-purple-300"
                    />
                </div>
            </div>

            <div className="px-4 md:px-6 border-b border-theme-border bg-theme-surface-trans">
                <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} variant="underline" />
            </div>

            <div className="flex-1 overflow-y-auto p-4 md:p-6 scrollbar-thin scrollbar-thumb-ancient-gold/20 hover:scrollbar-thumb-ancient-gold/40 scrollbar-track-ancient-ink/10">
                {activeTab === 'overview' && (
                    <div className="space-y-6">
                        {nation.desc && (
                            <div className="p-4 bg-ancient-ink/40 rounded-lg border border-ancient-gold/10 text-ancient-parchment italic font-serif leading-relaxed relative">
                                <Icon name="Quote" size={16} className="absolute top-2 left-2 text-ancient-gold/20" />
                                <div className="pl-4">"{nation.desc}"</div>
                            </div>
                        )}

                        <StrategicStatus nation={nation} epoch={epoch} market={market} daysElapsed={daysElapsed} gameState={gameState} />

                        <TaxRatesCard
                            nation={nation}
                            daysElapsed={daysElapsed}
                            diplomacyOrganizations={diplomacyOrganizations}
                            taxPolicies={taxPolicies}
                        />

                        <ActiveWars nation={nation} gameState={gameState} daysElapsed={daysElapsed} nations={nations} />

                        <InternationalOrganizations 
                            nation={nation} 
                            diplomacyOrganizations={diplomacyOrganizations}
                            gameState={gameState}
                        />

                        <ActiveTreaties nation={nation} daysElapsed={daysElapsed} />
                    </div>
                )}

                {activeTab === 'actions' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        <ActionCard
                            icon="Gift"
                            title="赠礼"
                            desc={giftCooldown.isOnCooldown
                                ? `冷却中，还需 ${giftCooldown.remainingDays} 天`
                                : "提升关系 (+10)，需要银币。"}
                            cost={`银币 ${formatCost(giftCostValue)}`}
                            onClick={() => onDiplomaticAction?.(nation.id, 'gift')}
                            color="green"
                            disabled={giftCooldown.isOnCooldown}
                        />

                        <ActionCard
                            icon="ScrollText"
                            title="外交谈判"
                            desc={epoch < 1
                                ? "未解锁：需要进入下一时代"
                                : negotiateCooldown.isOnCooldown
                                    ? `冷却中，还需 ${negotiateCooldown.remainingDays} 天`
                                    : "谈判条约、贸易协定等。"}
                            onClick={() => onNegotiate?.()}
                            color={epoch < 1 ? "gray" : "blue"}
                            disabled={epoch < 1 || negotiateCooldown.isOnCooldown}
                        />

                        <ActionCard
                            icon="MessageSquareWarning"
                            title="侮辱"
                            desc={insultCooldown.isOnCooldown
                                ? `冷却中，还需 ${insultCooldown.remainingDays} 天`
                                : "大幅降低关系，可能激怒对方。"}
                            onClick={() => onDiplomaticAction?.(nation.id, 'insult')}
                            color="orange"
                            disabled={insultCooldown.isOnCooldown}
                        />
                        <ActionCard
                            icon="Skull"
                            title="挑拨"
                            desc={provokeCooldown.isOnCooldown
                                ? `冷却中，还需 ${provokeCooldown.remainingDays} 天`
                                : "消耗银币离间其与其他国家的关系。"}
                            cost={`银币 ${formatCost(provokeCostValue)}`}
                            onClick={() => onProvoke?.()}
                            color="orange"
                            disabled={provokeCooldown.isOnCooldown}
                        />
                        {nation.isAtWar ? (
                            <ActionCard
                                icon="Flag"
                                title="求和"
                                desc="尝试通过谈判结束战争。"
                                onClick={() => onDiplomaticAction?.(nation.id, 'propose_peace')}
                                color="purple"
                            />
                        ) : (
                            <ActionCard
                                icon="Swords"
                                title="宣战"
                                desc={declareWarDesc}
                                cost="声誉/关系"
                                onClick={() => onDeclareWar?.()}
                                color="red"
                                disabled={declareWarDisabled}
                            />
                        )}
                    </div>
                )}

                {activeTab === 'trade' && (
                    <div className="space-y-6">
                        <div className="flex flex-col sm:flex-row gap-3 items-center justify-between p-4 bg-black/20 rounded-lg">
                            <div className="text-sm text-ancient-stone">
                                管理在该国的投资与资产
                            </div>
                            <Button
                                onClick={() => onOverseasInvestment?.(nation)}
                                variant="secondary"
                                icon={<Icon name="Factory" size={16} />}
                                className="w-full sm:w-auto"
                            >
                                海外投资管理
                            </Button>
                        </div>

                        {/* Foreign Investments from this nation in player's country */}
                        <ForeignInvestmentFromNation
                            nation={nation}
                            foreignInvestments={foreignInvestments}
                        />

                        <Card className="p-0 overflow-hidden border-ancient-gold/20 bg-ancient-ink/30">
                            <div className="p-4 border-b border-white/5 bg-black/20 flex justify-between items-center">
                                <div className="flex items-center gap-2">
                                    <Icon name="Ship" size={20} className="text-ancient-gold" />
                                    <span className="font-bold text-ancient-parchment">详细市场行情</span>
                                </div>
                                <div className="text-xs text-ancient-stone">
                                    本地价格 vs {nation.name}价格
                                </div>
                            </div>

                            <MerchantManager
                                nation={nation}
                                merchantState={merchantState}
                                onMerchantStateChange={onMerchantStateChange}
                                merchantCountTotal={popStructure?.merchant || gameState?.popStructure?.merchant || 0}
                                tick={daysElapsed}
                            />

                            <DetailedMarketTable
                                nation={nation}
                                market={market}
                                epoch={epoch}
                                daysElapsed={daysElapsed}
                            />
                        </Card>


                    </div>
                )}

                {activeTab === 'vassal' && (
                    <VassalManagementTab
                        nation={nation}
                        onDiplomaticAction={onDiplomaticAction}
                        onOpenVassalSheet={onOpenVassalSheet}
                    />
                )}
            </div>
        </div>
    );
};

// --- Sub-Components ---

/**
 * Component to display tariff and investment tax rates between player and this nation
 */
const TaxRatesCard = ({ nation, daysElapsed, diplomacyOrganizations, taxPolicies }) => {
    const organizations = diplomacyOrganizations?.organizations || [];

    // Calculate tax rates for both directions
    const taxInfo = useMemo(() => {
        if (!nation) return null;

        // Outbound: Player investing in this nation
        const outboundTax = getForeignInvestmentTaxRate({
            nation,
            organizations,
            daysElapsed,
            direction: 'outbound'
        });

        // Inbound: This nation investing in player country
        // For inbound, we check if player is nation's vassal (rare) or treaty status
        const inboundTax = getForeignInvestmentTaxRate({
            nation,
            organizations,
            daysElapsed,
            direction: 'inbound'
        });

        // Calculate tariff rates
        // Tariff discount for trading with this nation
        let tariffDiscount = 0;
        let tariffSource = 'DEFAULT';

        // Check for shared economic bloc
        const sharedBloc = organizations.find(org => {
            if (!org || org.type !== 'economic_bloc' || org.isActive === false) return false;
            const members = Array.isArray(org.members) ? org.members : [];
            const nationIdStr = String(nation.id);
            const hasPlayer = members.some(m => String(m) === 'player' || String(m) === '0') ||
                String(org.founderId) === 'player' || String(org.founderId) === '0';
            const hasNation = members.some(m => String(m) === nationIdStr);
            return hasPlayer && hasNation;
        });

        if (sharedBloc) {
            tariffDiscount = Math.max(tariffDiscount, ORGANIZATION_EFFECTS.economic_bloc?.tariffDiscount || 0);
            tariffSource = 'ECONOMIC_BLOC';
        }

        // Check vassal trade policy
        if (nation.vassalOf === 'player') {
            const policyId = nation.vassalPolicy?.tradePolicy || 'preferential';
            const policyDiscount = TRADE_POLICY_DEFINITIONS[policyId]?.tariffDiscount || 0;
            const typeDiscount = VASSAL_TYPE_CONFIGS[nation.vassalType]?.tariffDiscount || 0;
            const vassalDiscount = Math.max(policyDiscount, typeDiscount);
            if (vassalDiscount > tariffDiscount) {
                tariffDiscount = vassalDiscount;
                tariffSource = policyId === 'exclusive' || policyId === 'looting' || policyId === 'dumping'
                    ? 'VASSAL_EXCLUSIVE'
                    : 'VASSAL_PREFERENTIAL';
            }
        }

        // Player's base tariff rates (from tax policies)
        // These are the rates player sets, which get reduced by discount
        const avgImportTariff = taxPolicies?.importTariffMultipliers
            ? Object.values(taxPolicies.importTariffMultipliers).reduce((a, b) => a + b, 0) /
            Math.max(1, Object.keys(taxPolicies.importTariffMultipliers).length)
            : 0;
        const avgExportTariff = taxPolicies?.exportTariffMultipliers
            ? Object.values(taxPolicies.exportTariffMultipliers).reduce((a, b) => a + b, 0) /
            Math.max(1, Object.keys(taxPolicies.exportTariffMultipliers).length)
            : 0;

        return {
            outboundTax,
            inboundTax,
            tariffDiscount,
            tariffSource,
            avgImportTariff: avgImportTariff * (1 - tariffDiscount),
            avgExportTariff: avgExportTariff * (1 - tariffDiscount),
            rawImportTariff: avgImportTariff,
            rawExportTariff: avgExportTariff,
        };
    }, [nation, organizations, daysElapsed, taxPolicies]);

    if (!taxInfo) return null;

    const getSourceLabel = (source) => {
        const labels = {
            'VASSAL': '附庸特权',
            'VASSAL_EXCLUSIVE': '垄断贸易',
            'VASSAL_PREFERENTIAL': '优惠准入',
            'ECONOMIC_BLOC': '经济共同体',
            'TREATY': '投资协定',
            'DEFAULT': '无协议',
        };
        return labels[source] || source;
    };

    const getRateColor = (rate) => {
        if (rate <= 0.1) return 'text-green-400';
        if (rate <= 0.25) return 'text-blue-400';
        if (rate <= 0.4) return 'text-yellow-400';
        return 'text-red-400';
    };

    return (
        <Card className="p-4 bg-ancient-ink/20 border-ancient-gold/10">
            <h3 className="text-xs font-bold text-ancient-gold uppercase tracking-widest mb-3 flex items-center gap-2 opacity-80">
                <Icon name="Receipt" size={14} />
                双边税率
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Outbound: Player -> Nation */}
                <div className="bg-black/20 rounded-lg p-3 border border-white/5">
                    <div className="text-[10px] text-ancient-stone uppercase mb-2 flex items-center gap-1">
                        <Icon name="ArrowUpRight" size={12} className="text-amber-400" />
                        我方 → {nation.name}
                    </div>
                    <div className="space-y-2">
                        <div className="flex justify-between items-center">
                            <span className="text-xs text-ancient-stone">外资利润税</span>
                            <div className="text-right">
                                <span className={`text-sm font-mono font-bold ${getRateColor(taxInfo.outboundTax.rate)}`}>
                                    {(taxInfo.outboundTax.rate * 100).toFixed(0)}%
                                </span>
                                <div className="text-[9px] text-ancient-stone/60">
                                    {getSourceLabel(taxInfo.outboundTax.source)}
                                </div>
                            </div>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-xs text-ancient-stone">关税折扣</span>
                            <div className="text-right">
                                <span className={`text-sm font-mono font-bold ${taxInfo.tariffDiscount > 0 ? 'text-green-400' : 'text-ancient-stone'}`}>
                                    {taxInfo.tariffDiscount > 0 ? `-${(taxInfo.tariffDiscount * 100).toFixed(0)}%` : '无'}
                                </span>
                                {taxInfo.tariffDiscount > 0 && (
                                    <div className="text-[9px] text-ancient-stone/60">
                                        {getSourceLabel(taxInfo.tariffSource)}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Inbound: Nation -> Player */}
                <div className="bg-black/20 rounded-lg p-3 border border-white/5">
                    <div className="text-[10px] text-ancient-stone uppercase mb-2 flex items-center gap-1">
                        <Icon name="ArrowDownLeft" size={12} className="text-blue-400" />
                        {nation.name} → 我方
                    </div>
                    <div className="space-y-2">
                        <div className="flex justify-between items-center">
                            <span className="text-xs text-ancient-stone">外资利润税</span>
                            <div className="text-right">
                                <span className={`text-sm font-mono font-bold ${getRateColor(taxInfo.inboundTax.rate)}`}>
                                    {(taxInfo.inboundTax.rate * 100).toFixed(0)}%
                                </span>
                                <div className="text-[9px] text-ancient-stone/60">
                                    {getSourceLabel(taxInfo.inboundTax.source)}
                                </div>
                            </div>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-xs text-ancient-stone">我方关税</span>
                            <div className="text-right">
                                <div className="flex gap-2 text-sm font-mono">
                                    <span className="text-blue-300" title="进口关税">
                                        进{taxInfo.rawImportTariff !== 0 ? (taxInfo.rawImportTariff * 100).toFixed(0) : 0}%
                                    </span>
                                    <span className="text-amber-300" title="出口关税">
                                        出{taxInfo.rawExportTariff !== 0 ? (taxInfo.rawExportTariff * 100).toFixed(0) : 0}%
                                    </span>
                                </div>
                                {taxInfo.tariffDiscount > 0 && (
                                    <div className="text-[9px] text-green-400/60">
                                        (享{(taxInfo.tariffDiscount * 100).toFixed(0)}%折扣)
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Status indicators */}
            <div className="mt-3 flex flex-wrap gap-2">
                {taxInfo.outboundTax.isVassal && (
                    <Badge variant="neutral" className="text-[10px] bg-purple-900/30 border-purple-500/30 text-purple-300">
                        <Icon name="Crown" size={10} className="mr-1" />
                        附庸国
                    </Badge>
                )}
                {taxInfo.outboundTax.inBloc && (
                    <Badge variant="neutral" className="text-[10px] bg-amber-900/30 border-amber-500/30 text-amber-300">
                        <Icon name="Users" size={10} className="mr-1" />
                        经济共同体
                    </Badge>
                )}
                {taxInfo.outboundTax.hasTreaty && (
                    <Badge variant="neutral" className="text-[10px] bg-blue-900/30 border-blue-500/30 text-blue-300">
                        <Icon name="ScrollText" size={10} className="mr-1" />
                        投资协定
                    </Badge>
                )}
                {!taxInfo.outboundTax.isVassal && !taxInfo.outboundTax.inBloc && !taxInfo.outboundTax.hasTreaty && (
                    <Badge variant="neutral" className="text-[10px] bg-red-900/30 border-red-500/30 text-red-300">
                        <Icon name="AlertTriangle" size={10} className="mr-1" />
                        无投资保护
                    </Badge>
                )}
            </div>
        </Card>
    );
};

/**
 * Component to display foreign investments from a specific nation in player's country
 */
const ForeignInvestmentFromNation = ({ nation, foreignInvestments = [] }) => {
    // Filter investments from this nation in player's country
    const investmentsFromNation = useMemo(() => {
        return foreignInvestments.filter(inv =>
            inv.ownerNationId === nation?.id && inv.status === 'operating'
        ).map(inv => {
            const building = BUILDINGS.find(b => b.id === inv.buildingId);
            return {
                ...inv,
                building,
                buildingName: building?.name || '未知建筑',
            };
        });
    }, [foreignInvestments, nation?.id]);

    // Calculate totals
    const totals = useMemo(() => {
        return investmentsFromNation.reduce((acc, inv) => {
            acc.totalProfit += (inv.dailyProfit || 0);
            acc.totalTax += (inv.operatingData?.taxPaid || 0);
            acc.totalJobs += (inv.jobsProvided || 0);
            return acc;
        }, { totalProfit: 0, totalTax: 0, totalJobs: 0 });
    }, [investmentsFromNation]);

    if (investmentsFromNation.length === 0) {
        return (
            <Card className="p-4 bg-ancient-ink/20 border-ancient-gold/10">
                <div className="flex items-center gap-2 mb-3">
                    <Icon name="Landmark" size={18} className="text-amber-400" />
                    <span className="font-bold text-ancient-parchment">该国在我国的投资</span>
                </div>
                <div className="text-center text-ancient-stone/60 text-sm py-4 italic">
                    {nation?.name || '该国'} 目前在我国没有投资。
                </div>
            </Card>
        );
    }

    return (
        <Card className="p-0 overflow-hidden border-amber-700/30 bg-amber-900/10">
            <div className="p-4 border-b border-amber-700/20 bg-black/20 flex justify-between items-center">
                <div className="flex items-center gap-2">
                    <Icon name="Landmark" size={20} className="text-amber-400" />
                    <span className="font-bold text-ancient-parchment">该国在我国的投资</span>
                    <Badge variant="neutral" className="text-[10px]">
                        {investmentsFromNation.length} 处
                    </Badge>
                </div>
                <div className="text-right text-xs text-ancient-stone">
                    <div className="flex gap-3">
                        <span>税收: <span className="text-green-400 font-mono">+{totals.totalTax.toFixed(1)}</span>/日</span>
                        <span>利润流出: <span className="text-red-400 font-mono">-{(totals.totalProfit - totals.totalTax).toFixed(1)}</span>/日</span>
                    </div>
                    <div className="text-[10px] text-ancient-stone/60 mt-0.5">
                        提供就业: {totals.totalJobs} 人
                    </div>
                </div>
            </div>

            <div className="divide-y divide-amber-700/20 max-h-[250px] overflow-y-auto">
                {investmentsFromNation.map(inv => (
                    <div key={inv.id} className="p-3 hover:bg-white/5 transition-colors">
                        <div className="flex justify-between items-center">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded bg-amber-900/30 flex items-center justify-center">
                                    <Icon name={inv.building?.visual?.icon || "Building"} size={16} className="text-amber-400" />
                                </div>
                                <div>
                                    <div className="text-sm font-bold text-ancient-parchment">
                                        {inv.buildingName}
                                    </div>
                                    <div className="text-[10px] text-ancient-stone flex items-center gap-2">
                                        <span className="bg-gray-900/50 px-1.5 rounded">岗位: {inv.jobsProvided || 0}</span>
                                        <span>日利润: <span className="text-amber-300 font-mono">{(inv.dailyProfit || 0).toFixed(1)}</span></span>
                                    </div>
                                </div>
                            </div>
                            <div className="text-right">
                                <div className="text-xs">
                                    <span className="text-green-400 font-mono">
                                        税: +{(inv.operatingData?.taxPaid || 0).toFixed(1)}
                                    </span>
                                </div>
                                <div className="text-[9px] text-ancient-stone/60">
                                    流出: -{((inv.dailyProfit || 0) - (inv.operatingData?.taxPaid || 0)).toFixed(1)}
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </Card>
    );
};

const StrategicStatus = ({ nation, epoch, market, daysElapsed, gameState }) => {
    // 计算国家的急需资源（基于国际均价）
    const urgentNeeds = useMemo(() => {
        const resources = getTradableResources(epoch);
        const urgentExports = [];
        const urgentImports = [];

        // 计算国际均价
        const internationalPrices = {};
        resources.forEach(([key]) => {
            const prices = [];

            // 玩家国家价格
            prices.push(market?.prices?.[key] ?? RESOURCES[key]?.basePrice ?? 1);

            // 所有外国价格
            const foreignNations = gameState?.foreignNations || [];
            foreignNations.forEach(foreignNation => {
                prices.push(calculateForeignPrice(key, foreignNation, daysElapsed));
            });

            // 计算平均值
            internationalPrices[key] = prices.reduce((sum, p) => sum + p, 0) / prices.length;
        });

        // 计算该国的急需
        resources.forEach(([key, res]) => {
            const nationPrice = calculateForeignPrice(key, nation, daysElapsed);
            const avgPrice = internationalPrices[key];
            const deviation = (nationPrice - avgPrice) / avgPrice;

            if (deviation > 0.15) {  // 高于均价15%以上，需要进口
                urgentImports.push({ key, name: res.name, deviation });
            } else if (deviation < -0.15) {  // 低于均价15%以上，有盈余可出口
                urgentExports.push({ key, name: res.name, deviation: Math.abs(deviation) });
            }
        });

        // 按偏离度排序，取前3个
        urgentExports.sort((a, b) => b.deviation - a.deviation);
        urgentImports.sort((a, b) => b.deviation - a.deviation);

        return {
            exports: urgentExports.slice(0, 3),
            imports: urgentImports.slice(0, 3)
        };
    }, [nation, epoch, market, daysElapsed, gameState]);

    return (
        <Card className="p-4 bg-ancient-ink/20 border-ancient-gold/10">
            <h3 className="text-xs font-bold text-ancient-gold uppercase tracking-widest mb-3 flex items-center gap-2 opacity-80">
                <Icon name="Target" size={14} />
                战略情报
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <div className="text-[10px] text-ancient-stone uppercase mb-1">国家偏好</div>
                    <div className="flex flex-wrap gap-2">
                        {(() => {
                            const traits = [];
                            if (nation.culturalTraits) {
                                // 1. Handle Boolean Traits
                                const TRAIT_MAPPING = {
                                    militaryFocus: { label: '注重军事', color: 'text-red-300 border-red-800 bg-red-900/40' },
                                    militaryTradition: { label: '军事传统', color: 'text-red-300 border-red-800 bg-red-900/40' },
                                    militarySociety: { label: '尚武社会', color: 'text-red-400 border-red-800 bg-red-900/40' },
                                    warlike: { label: '好战', color: 'text-red-500 border-red-800 bg-red-900/40' },

                                    isolationist: { label: '孤立主义', color: 'text-gray-300 border-gray-700 bg-gray-800/40' },
                                    isolationism: { label: '闭关锁国', color: 'text-gray-300 border-gray-700 bg-gray-800/40' },

                                    religiousFocus: { label: '宗教狂热', color: 'text-yellow-300 border-yellow-800 bg-yellow-900/40' },
                                    religiousFervor: { label: '宗教狂热', color: 'text-yellow-300 border-yellow-800 bg-yellow-900/40' },
                                    divineKingship: { label: '神权', color: 'text-yellow-300 border-yellow-800 bg-yellow-900/40' },

                                    peacefulTrade: { label: '和平贸易', color: 'text-green-300 border-green-800 bg-green-900/40' },
                                    agriculturalFocus: { label: '农业立国', color: 'text-green-300 border-green-800 bg-green-900/40' },

                                    miningExpertise: { label: '矿业专精', color: 'text-amber-300 border-amber-800 bg-amber-900/40' },
                                    craftExcellence: { label: '工匠精神', color: 'text-amber-300 border-amber-800 bg-amber-900/40' },

                                    navalSupremacy: { label: '海上霸权', color: 'text-blue-300 border-blue-800 bg-blue-900/40' },
                                    navalTradition: { label: '航海传统', color: 'text-blue-300 border-blue-800 bg-blue-900/40' },
                                    seafaringMastery: { label: '航海大师', color: 'text-blue-300 border-blue-800 bg-blue-900/40' },

                                    culturalHegemony: { label: '文化霸权', color: 'text-purple-300 border-purple-800 bg-purple-900/40' },
                                    philosophyCenter: { label: '哲学中心', color: 'text-purple-300 border-purple-800 bg-purple-900/40' },

                                    raidingCulture: { label: '掠夺文化', color: 'text-orange-400 border-orange-800 bg-orange-900/40' },
                                    revolutionaryZeal: { label: '革命狂热', color: 'text-red-400 border-red-800 bg-red-900/40' },
                                    financialExpertise: { label: '金融专精', color: 'text-emerald-300 border-emerald-800 bg-emerald-900/40' },
                                };

                                Object.entries(nation.culturalTraits).forEach(([key, value]) => {
                                    if (value === true && TRAIT_MAPPING[key]) {
                                        traits.push(TRAIT_MAPPING[key]);
                                    }
                                });

                                // 2. Handle Trading Style
                                if (nation.culturalTraits.tradingStyle) {
                                    const STYLE_MAP = {
                                        aggressive: { label: '激进贸易', color: 'text-orange-300 border-orange-800 bg-orange-900/40' },
                                        merchant: { label: '商业至上', color: 'text-yellow-300 border-yellow-800 bg-yellow-900/40' },
                                        maritime: { label: '海上贸易', color: 'text-blue-300 border-blue-800 bg-blue-900/40' },
                                        monopolistic: { label: '垄断经营', color: 'text-purple-300 border-purple-800 bg-purple-900/40' },
                                        capitalist: { label: '自由资本', color: 'text-emerald-300 border-emerald-800 bg-emerald-900/40' },
                                    };
                                    const style = STYLE_MAP[nation.culturalTraits.tradingStyle];
                                    if (style) traits.push(style);
                                }
                            }

                            // Fallback if no traits found
                            if (traits.length === 0) {
                                return <span className="text-xs text-ancient-stone/50 italic">无明显倾向</span>;
                            }

                            return traits.map((trait, index) => (
                                <Badge
                                    key={index}
                                    variant="neutral"
                                    className={`text-xs border ${trait.color}`}
                                >
                                    {trait.label}
                                </Badge>
                            ));
                        })()}
                    </div>
                </div>
                <div>
                    <div className="text-[10px] text-ancient-stone uppercase mb-1">当前急需</div>
                    <div className="flex flex-wrap gap-2">
                        {urgentNeeds.imports.length > 0 && urgentNeeds.imports.map((item) => (
                            <span key={`import-${item.key}`} className="text-xs text-red-400 flex items-center gap-1">
                                <Icon name="ArrowDown" size={10} /> 进口{item.name}
                            </span>
                        ))}
                        {urgentNeeds.exports.length > 0 && urgentNeeds.exports.map((item) => (
                            <span key={`export-${item.key}`} className="text-xs text-green-400 flex items-center gap-1">
                                <Icon name="ArrowUp" size={10} /> 出口{item.name}
                            </span>
                        ))}
                        {urgentNeeds.imports.length === 0 && urgentNeeds.exports.length === 0 && (
                            <span className="text-xs text-ancient-stone/60 italic">供需平衡</span>
                        )}
                    </div>
                </div>
            </div>
        </Card>
    );
};

const DetailedMarketTable = ({ nation, market, epoch, daysElapsed, onTrade }) => {
    const resources = getTradableResources(epoch);
    const localPrices = market?.prices || {};

    return (
        <div className="overflow-x-auto">
            <table className="w-full text-left text-xs md:text-sm">
                <thead>
                    <tr className="bg-white/5 text-ancient-stone/70 border-b border-white/5">
                        <th className="p-2 md:p-3 font-medium">资源</th>
                        <th className="p-2 md:p-3 font-medium text-right">本地</th>
                        <th className="p-2 md:p-3 font-medium text-right">对方</th>
                        <th className="p-2 md:p-3 font-medium text-center">状态</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                    {resources.map(([key, res]) => {
                        const localPrice = localPrices[key] ?? res.basePrice ?? 1;
                        const foreignPrice = calculateForeignPrice(key, nation, daysElapsed);
                        const status = calculateTradeStatus(key, nation, daysElapsed);
                        const diff = foreignPrice - localPrice;
                        const diffPercent = (diff / localPrice) * 100;

                        const isProfitableExport = diff > 0;
                        const isProfitableImport = diff < 0;

                        return (
                            <tr key={key} className="hover:bg-white/5 transition-colors">
                                <td className="p-2 md:p-3">
                                    <div className="flex items-center gap-2">
                                        <div className={`w-1.5 h-1.5 md:w-2 md:h-2 rounded-full ${isProfitableExport ? 'bg-green-500' : isProfitableImport ? 'bg-blue-500' : 'bg-gray-600'}`}></div>
                                        <span className="text-ancient-parchment font-medium">{res.name}</span>
                                    </div>
                                </td>
                                <td className="p-2 md:p-3 text-right text-ancient-stone font-mono">
                                    {localPrice.toFixed(1)}
                                </td>
                                <td className="p-2 md:p-3 text-right text-ancient-parchment font-mono font-bold">
                                    {foreignPrice.toFixed(1)}
                                    <span className={`ml-1 text-[9px] md:text-[10px] ${diff > 0 ? 'text-green-400' : diff < 0 ? 'text-blue-400' : 'text-gray-500'}`}>
                                        ({diff > 0 ? '+' : ''}{diffPercent.toFixed(0)}%)
                                    </span>
                                </td>
                                <td className="p-2 md:p-3 text-center">
                                    {status.shortageAmount > 0 ? (
                                        <Badge variant="danger" className="text-[10px] scale-90">缺口 {Math.round(status.shortageAmount)}</Badge>
                                    ) : status.surplusAmount > 0 ? (
                                        <Badge variant="success" className="text-[10px] scale-90">盈余 {Math.round(status.surplusAmount)}</Badge>
                                    ) : (
                                        <span className="text-ancient-stone/30">-</span>
                                    )}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
};

const VassalManagementTab = ({ nation, onDiplomaticAction, onOpenVassalSheet }) => (
    <div className="space-y-4">
        {nation.vassalOf === 'player' ? (
            <Card className="p-6 bg-purple-900/10 border-purple-500/30">
                <h3 className="text-purple-300 font-bold mb-4 flex items-center gap-2 text-xl font-decorative">
                    <Icon name="Crown" size={24} />
                    附庸国管理
                </h3>
                <div className="grid grid-cols-1 gap-8 mb-6">
                    <div className="relative">
                        <div className="text-xs text-purple-400/60 uppercase tracking-wider mb-1">独立倾向</div>
                        <div
                            className={`text-3xl font-mono font-bold ${(nation.independencePressure || 0) > 50 ? 'text-red-400' : 'text-green-400'}`}
                        >
                            {Math.round(nation.independencePressure || 0)}%
                        </div>
                        <div className="absolute bottom-0 left-0 w-full h-1 bg-purple-900/50 rounded-full mt-2 overflow-hidden">
                            <div
                                className={`h-full ${(nation.independencePressure || 0) > 50 ? 'bg-red-500' : 'bg-green-500'}`}
                                style={{ width: `${nation.independencePressure || 0}%` }}
                            />
                        </div>
                    </div>
                </div>
                <div className="flex gap-3 flex-wrap">
                    <Button
                        onClick={() => onOpenVassalSheet?.(nation)}
                        variant="primary"
                        size="sm"
                        className="flex-1"
                    >
                        <Icon name="Settings" size={14} className="mr-1" />
                        详细管理
                    </Button>
                    <Button
                        onClick={() => onDiplomaticAction?.(nation.id, 'release_vassal')}
                        variant="danger"
                        size="sm"
                    >
                        释放附庸
                    </Button>
                </div>
            </Card>
        ) : nation.vassals && nation.vassals.includes('player') ? (
            <Card className="p-6 bg-red-900/10 border-red-500/30">
                <h3 className="text-red-300 font-bold mb-2 flex items-center gap-2 text-xl">
                    <Icon name="Lock" size={24} />
                    宗主国
                </h3>
                <p className="text-ancient-stone text-sm mb-4">你是该国的附庸，外交行动受限。</p>
                <Button
                    onClick={() => onDiplomaticAction?.(nation.id, 'declare_independence')}
                    variant="danger"
                    className="w-full sm:w-auto"
                >
                    发动独立战争
                </Button>
            </Card>
        ) : (
            <div className="p-12 text-center text-ancient-stone/50 italic border border-dashed border-ancient-stone/20 rounded-xl">
                <Icon name="ShieldQuestion" size={48} className="mx-auto mb-4 opacity-50" />
                双方之间不存在宗主附庸关系
            </div>
        )}
    </div>
);

const StatCard = ({ icon, label, value, color }) => (
    <div className="bg-theme-surface-trans border border-theme-border p-3 rounded-lg flex items-center gap-3 hover:bg-theme-surface transition-colors">
        <div className={`p-2 rounded bg-black/30 shadow-inner ${color}`}>
            <Icon name={icon} size={18} />
        </div>
        <div>
            <div className="text-[10px] text-theme-text opacity-70 uppercase tracking-wider font-bold">{label}</div>
            <div className={`text-sm font-bold font-mono ${color} drop-shadow-sm`}>{value}</div>
        </div>
    </div>
);

const ActionCard = ({ icon, title, desc, cost, disabled, onClick, color }) => {
    const accentMap = {
        green: 'text-emerald-300',
        emerald: 'text-emerald-300',
        red: 'text-red-300',
        orange: 'text-orange-300',
        blue: 'text-sky-300',
        purple: 'text-purple-300',
    };
    const iconTone = accentMap[color] || 'text-theme-accent';

    return (
        <button
            disabled={disabled}
            onClick={onClick}
            className={`
                group flex items-start gap-3 md:gap-4 p-3 md:p-4 text-left rounded-xl border transition-all duration-300 relative overflow-hidden
                ${disabled
                    ? 'opacity-50 cursor-not-allowed bg-theme-surface-trans border-theme-border text-theme-text'
                    : 'glass-epic border-theme-border text-theme-text hover:border-theme-accent hover:shadow-gold-metal hover:-translate-y-0.5'
                }
            `}
        >
            <div className={`p-2 rounded-lg bg-black/20 ${disabled ? 'opacity-50' : iconTone}`}>
                <Icon name={icon} size={24} />
            </div>
            <div className="flex-1">
                <div className="font-bold text-sm mb-0.5">{title}</div>
                <div className="text-xs opacity-70 mb-1">{desc}</div>
                {cost && (
                    <div className="text-[10px] font-mono opacity-80 bg-black/30 w-fit px-1.5 py-0.5 rounded border border-theme-border">
                        消耗 {cost}
                    </div>
                )}
            </div>
        </button>
    );
};

const ActiveTreaties = ({ nation, daysElapsed }) => {
    if (!nation.treaties || nation.treaties.length === 0) return null;
    return (
        <Card className="p-4 bg-ancient-ink/30 border-ancient-gold/10">
            <h3 className="text-xs font-bold text-ancient-gold uppercase tracking-widest mb-3 flex items-center gap-2 opacity-80">
                <Icon name="ScrollText" size={14} />
                生效中的条约
            </h3>
            <div className="space-y-2">
                {nation.treaties.map((treaty, i) => (
                    <div
                        key={i}
                        className="flex justify-between items-center p-2.5 bg-black/20 rounded border border-white/5 hover:border-ancient-gold/20 transition-colors"
                    >
                        <span className="text-sm text-ancient-parchment font-medium capitalize">
                            {treatyTypeToLabel(treaty.type)}
                        </span>
                        <span className="text-xs text-ancient-stone/70 font-mono">
                            {(() => {
                                const endDay = Number.isFinite(treaty.endDay)
                                    ? treaty.endDay
                                    : (Number.isFinite(treaty.startDay) && Number.isFinite(treaty.duration)
                                        ? treaty.startDay + treaty.duration
                                        : (Number.isFinite(treaty.signedDay) && Number.isFinite(treaty.duration)
                                            ? treaty.signedDay + treaty.duration
                                            : null));
                                return endDay != null
                                    ? `剩余 ${Math.max(0, endDay - daysElapsed)} 天`
                                    : '永久';
                            })()}
                        </span>
                    </div>
                ))}
            </div>
        </Card>
    );
};

/**
 * Component to display international organizations that this nation belongs to
 */
const InternationalOrganizations = ({ nation, diplomacyOrganizations, gameState }) => {
    const organizations = diplomacyOrganizations?.organizations || [];
    
    // Get organizations this nation is a member of
    const nationOrgs = useMemo(() => {
        if (!nation?.id) return [];
        return getNationOrganizations(nation.id, organizations);
    }, [nation?.id, organizations]);

    // Get player's nation ID
    const playerNationId = useMemo(() => {
        return 'player'; // Player is always 'player' or 0
    }, []);

    // Get organizations player is a member of
    const playerOrgs = useMemo(() => {
        return getNationOrganizations(playerNationId, organizations);
    }, [playerNationId, organizations]);

    // Check which organizations both player and this nation are in
    const sharedOrgs = useMemo(() => {
        return nationOrgs.filter(org => 
            playerOrgs.some(playerOrg => playerOrg.id === org.id)
        );
    }, [nationOrgs, playerOrgs]);

    if (nationOrgs.length === 0) return null;

    const getOrgTypeIcon = (type) => {
        const icons = {
            'military_alliance': 'Shield',
            'economic_bloc': 'Landmark',
            'trade_zone': 'Ship',
        };
        return icons[type] || 'Users';
    };

    const getOrgTypeColor = (type) => {
        const colors = {
            'military_alliance': 'text-red-400 border-red-800 bg-red-900/20',
            'economic_bloc': 'text-amber-400 border-amber-800 bg-amber-900/20',
            'trade_zone': 'text-blue-400 border-blue-800 bg-blue-900/20',
        };
        return colors[type] || 'text-gray-400 border-gray-800 bg-gray-900/20';
    };

    const getOrgTypeName = (type) => {
        const config = ORGANIZATION_TYPE_CONFIGS[type];
        return config?.name || type;
    };

    return (
        <Card className="p-4 bg-ancient-ink/30 border-ancient-gold/10">
            <h3 className="text-xs font-bold text-ancient-gold uppercase tracking-widest mb-3 flex items-center gap-2 opacity-80">
                <Icon name="Landmark" size={14} />
                国际组织
            </h3>
            <div className="space-y-2">
                {nationOrgs.map((org) => {
                    const isShared = sharedOrgs.some(sharedOrg => sharedOrg.id === org.id);
                    const orgColor = getOrgTypeColor(org.type);
                    
                    return (
                        <div
                            key={org.id}
                            className={`flex justify-between items-center p-2.5 rounded border transition-colors ${
                                isShared 
                                    ? 'bg-green-900/20 border-green-700/40 hover:border-green-500/50' 
                                    : 'bg-black/20 border-white/5 hover:border-ancient-gold/20'
                            }`}
                        >
                            <div className="flex items-center gap-2 flex-1">
                                <div className={`p-1.5 rounded ${orgColor}`}>
                                    <Icon name={getOrgTypeIcon(org.type)} size={14} />
                                </div>
                                <div className="flex-1">
                                    <div className="text-sm text-ancient-parchment font-medium">
                                        {org.name}
                                    </div>
                                    <div className="text-[10px] text-ancient-stone/70 flex items-center gap-2">
                                        <span>{getOrgTypeName(org.type)}</span>
                                        <span>•</span>
                                        <span>{org.members?.length || 0} 成员</span>
                                    </div>
                                </div>
                            </div>
                            {isShared && (
                                <Badge variant="success" className="text-[9px] scale-90 flex items-center gap-1">
                                    <Icon name="Check" size={10} />
                                    我方也在
                                </Badge>
                            )}
                        </div>
                    );
                })}
            </div>
        </Card>
    );
};

const treatyTypeToLabel = (type) => {
    const map = {
        non_aggression: '互不侵犯条约',
        trade_agreement: '贸易协定',
        military_access: '军事通行条约',
        defensive_pact: '防御协定',
        alliance: '军事同盟',
        peace_treaty: '和平条约',
        open_market: '开放市场',
        investment_pact: '投资协议',
        free_trade: '自由贸易协定',
        academic_exchange: '学术交流',
        economic_bloc: '经济共同体',
    };
    return map[type] || type.replace('_', ' ');
};

const MerchantManager = ({ nation, merchantState, onMerchantStateChange, merchantCountTotal = 0, tick = 0 }) => {
    const merchantCount = merchantState?.merchantAssignments?.[nation.id] || 0;

    // Calculate limit
    const relation = nation.relation || 0;
    const isAllied = nation.alliedWithPlayer === true;

    const treatyEffects = getTreatyEffects(nation, tick);
    const isWarForcedOpenMarket = Boolean(nation.openMarketUntil && tick < nation.openMarketUntil);
    const isTreatyOpenMarket = treatyEffects.bypassRelationCap || treatyEffects.extraMerchantSlots === Infinity;
    const isOpenMarket = isWarForcedOpenMarket || isTreatyOpenMarket;

    const baseMax = calculateMaxTradeRoutes(relation, isAllied, merchantCountTotal);
    const percentBonus = Math.floor(baseMax * (treatyEffects.extraMerchantSlotsPercent || 0));
    const fixedBonus = treatyEffects.extraMerchantSlots === Infinity ? 999 : (treatyEffects.extraMerchantSlots || 0);
    const totalBonus = percentBonus + fixedBonus;

    // Explicit cap logic similar to TradeRoutesModal
    const cap = isOpenMarket ? 999999 : (baseMax + totalBonus);

    // Calculate remaining merchants
    const assignedTotal = Object.values(merchantState?.merchantAssignments || {}).reduce((sum, v) => sum + Math.max(0, Math.floor(Number(v) || 0)), 0);
    const remainingMerchants = merchantCountTotal - assignedTotal;

    const handleAdd = () => {
        if (merchantCount < cap) {
            onMerchantStateChange?.(nation.id, merchantCount + 1);
        }
    };

    const handleAddLongPress = () => {
        // Set to maximum: min of (remaining merchants + current value, nation cap)
        const maxPossible = Math.min(remainingMerchants + merchantCount, cap);
        onMerchantStateChange?.(nation.id, maxPossible);
    };

    const handleRemove = () => {
        if (merchantCount > 0) {
            onMerchantStateChange?.(nation.id, merchantCount - 1);
        }
    };

    const handleRemoveLongPress = () => {
        // Set to zero
        onMerchantStateChange?.(nation.id, 0);
    };

    const longPressAdd = useLongPress(
        handleAddLongPress,
        handleAdd,
        { delay: 500 }
    );

    const longPressRemove = useLongPress(
        handleRemoveLongPress,
        handleRemove,
        { delay: 500 }
    );

    return (
        <Card className="p-4 bg-blue-900/10 border-blue-500/30 flex flex-col sm:flex-row items-center justify-between gap-4 mb-4">
            <div className="text-center sm:text-left">
                <h3 className="text-blue-300 font-bold flex items-center justify-center sm:justify-start gap-2">
                    <Icon name="Ship" size={24} />
                    派驻商人
                </h3>
                <p className="text-xs text-ancient-stone mt-1">
                    商人会自动寻找最有利可图的商品进行贸易。
                </p>
            </div>
            <div className="flex items-center gap-4 bg-black/40 p-2 sm:p-3 rounded-xl border border-blue-500/30 text-white w-full sm:w-auto justify-center">
                <Button
                    size="md"
                    variant="danger"
                    {...(merchantCount > 0 ? longPressRemove : {})}
                    disabled={merchantCount <= 0}
                    className="w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center p-0 rounded-lg shadow-lg hover:bg-red-600 transition-colors"
                    title="点击减少商人，长按归零"
                >
                    <Icon name="Minus" size={20} className="text-white" />
                </Button>
                <div className="text-2xl sm:text-3xl font-bold font-mono w-12 sm:w-16 text-center text-blue-100 drop-shadow-md">
                    {merchantCount}
                </div>
                <Button
                    size="md"
                    variant="primary"
                    {...(merchantCount < cap ? longPressAdd : {})}
                    disabled={merchantCount >= cap}
                    className={`w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center p-0 rounded-lg shadow-lg transition-colors ${merchantCount >= cap ? 'bg-gray-600 cursor-not-allowed' : 'hover:bg-blue-600'}`}
                    title="点击增加商人，长按派驻到最大值"
                >
                    <Icon name="Plus" size={20} className="text-white" />
                </Button>
            </div>
            <div className="text-xs text-center sm:text-right text-ancient-stone mt-2 sm:mt-0 w-full sm:w-auto">
                上限: {isOpenMarket ? '无限制' : cap}
            </div>
        </Card>
    );
};

const ActiveWars = ({ nation, gameState, daysElapsed, nations = [] }) => {
    // Collect all active wars
    const activeWars = useMemo(() => {
        const wars = [];

        // 1. War with Player
        if (nation.isAtWar) {
            wars.push({
                id: 'player',
                name: gameState?.empireName || '我方',
                isPlayer: true,
                startDate: nation.warStartDay || 0,
                score: nation.warScore || 0, // AI vs Player score usually from AI perspective
            });
        }

        // 2. Wars with other AI nations (use nations array instead of gameState.foreignNations)
        if (nation.foreignWars) {
            Object.entries(nation.foreignWars).forEach(([enemyId, warData]) => {
                if (warData && warData.isAtWar) {
                    // Look up enemy in nations array
                    const enemy = nations.find(n => n.id === enemyId);
                    // Safety check: Don't show wars with nations that are annexed or invisible
                    if (!enemy || enemy.isAnnexed || enemy.visible === false) return;
                    if (enemy) {
                        wars.push({
                            id: enemy.id,
                            name: enemy.name,
                            isPlayer: false,
                            startDate: warData.warStartDay || 0,
                            score: warData.warScore || 0,
                        });
                    }
                }
            });
        }

        return wars;
    }, [nation, gameState, nations]);

    if (activeWars.length === 0) return null;

    return (
        <Card className="p-4 bg-red-900/10 border-red-500/20">
            <h3 className="text-xs font-bold text-red-400 uppercase tracking-widest mb-3 flex items-center gap-2 opacity-90">
                <Icon name="Swords" size={14} />
                当前战争
            </h3>
            <div className="space-y-2">
                {activeWars.map(war => {
                    const duration = daysElapsed - war.startDate;
                    return (
                        <div key={war.id} className="flex justify-between items-center p-2.5 bg-black/30 rounded border border-red-900/30 hover:border-red-500/30 transition-colors">
                            <div className="flex items-center gap-2">
                                <Icon name="Skull" size={14} className="text-red-500" />
                                <span className="text-sm text-ancient-parchment font-bold">
                                    VS {war.name}
                                </span>
                                {war.isPlayer && (
                                    <Badge variant="danger" className="text-[9px] scale-90">你</Badge>
                                )}
                            </div>
                            <div className="text-right">
                                <div className="text-xs text-red-300 font-mono">
                                    {(war.score > 0 ? '+' : '') + Math.round(war.score)} 分
                                </div>
                                <div className="text-[10px] text-ancient-stone/60">
                                    持续 {duration} 天
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </Card>
    );
};

export default NationDetailView;
