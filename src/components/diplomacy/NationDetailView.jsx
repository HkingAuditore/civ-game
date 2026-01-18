import React, { useMemo, useState } from 'react';
import { Button, Card, Tabs, Badge } from '../common/UnifiedUI';
import { Icon } from '../common/UIComponents';
import { RESOURCES, DIPLOMACY_ERA_UNLOCK, BUILDINGS } from '../../config';
import { getEstimatedMilitaryStrength } from '../../logic/diplomacy/militaryUtils';
import { getRelationLabel } from '../../utils/diplomacyUtils';
import { calculateDynamicGiftCost, calculateProvokeCost } from '../../utils/diplomaticUtils';
import { calculateForeignPrice, calculateTradeStatus } from '../../utils/foreignTrade';

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
                                desc="开启战争！这将导致声誉受损和贸易中断。"
                                cost="声誉/关系"
                                onClick={() => onDeclareWar?.()}
                                color="red"
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
                        {/* Placeholder logic for preferences - simplified for UI overhaul */}
                        <Badge variant="neutral" className="text-xs">注重军事</Badge>
                        <Badge variant="neutral" className="text-xs">贸易保护</Badge>
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
                <div className="grid grid-cols-2 gap-8 mb-6">
                    <div className="relative">
                        <div className="text-xs text-purple-400/60 uppercase tracking-wider mb-1">自治度</div>
                        <div className="text-3xl font-mono text-purple-100 font-bold">
                            {Math.round(nation.autonomy || 0)}%
                        </div>
                        <div className="absolute bottom-0 left-0 w-full h-1 bg-purple-900/50 rounded-full mt-2 overflow-hidden">
                            <div
                                className="h-full bg-purple-500"
                                style={{ width: `${nation.autonomy || 0}%` }}
                            />
                        </div>
                    </div>
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

const treatyTypeToLabel = (type) => {
    const map = {
        non_aggression: '互不侵犯条约',
        trade_agreement: '贸易协定',
        military_access: '军事通行条约',
        defensive_pact: '防御协定',
        alliance: '军事同盟',
        peace_treaty: '和平条约',
        open_market: '开放市场',
        free_trade: '自由贸易',
    };
    return map[type] || type.replace('_', ' ');
};

const MerchantManager = ({ nation, merchantState, onMerchantStateChange }) => {
    const merchantCount = merchantState?.merchantAssignments?.[nation.id] || 0;

    const handleAdd = () => {
        onMerchantStateChange?.(nation.id, merchantCount + 1);
    };

    const handleRemove = () => {
        if (merchantCount > 0) {
            onMerchantStateChange?.(nation.id, merchantCount - 1);
        }
    };

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
                    onClick={handleRemove}
                    disabled={merchantCount <= 0}
                    className="w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center p-0 rounded-lg shadow-lg hover:bg-red-600 transition-colors"
                    title="减少商人"
                >
                    <Icon name="Minus" size={20} className="text-white" />
                </Button>
                <div className="text-2xl sm:text-3xl font-bold font-mono w-12 sm:w-16 text-center text-blue-100 drop-shadow-md">
                    {merchantCount}
                </div>
                <Button
                    size="md"
                    variant="primary"
                    onClick={handleAdd}
                    className="w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center p-0 rounded-lg shadow-lg hover:bg-blue-600 transition-colors"
                    title="增加商人"
                >
                    <Icon name="Plus" size={20} className="text-white" />
                </Button>
            </div>
        </Card>
    );
};

export default NationDetailView;
