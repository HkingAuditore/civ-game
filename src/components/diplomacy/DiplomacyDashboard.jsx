import React, { useMemo, useState } from 'react';
import { Icon } from '../common/UIComponents';
import { Card, Button } from '../common/UnifiedUI';
import { RESOURCES } from '../../config';
import { isDiplomacyUnlocked } from '../../config/diplomacy';
import { calculateForeignPrice, calculateTradeStatus } from '../../utils/foreignTrade';
import { CreateOrganizationModal } from '../modals/CreateOrganizationModal';
import { BottomSheet } from '../tabs/BottomSheet';

const ORG_TYPES = [
    { type: 'military_alliance', name: '军事同盟', icon: 'Shield', era: 3, color: 'text-red-400', desc: '共同防御与军事通行 (时代 3 解锁)' },
    { type: 'economic_bloc', name: '经济共同体', icon: 'TrendingUp', era: 5, color: 'text-amber-400', desc: '关税减免、贸易加成与市场整合 (时代 5 解锁)' },
];

const formatNumber = (value) => {
    if (!Number.isFinite(value)) return '0';
    if (value >= 100000000) return `${(value / 100000000).toFixed(1)}亿`;
    if (value >= 10000) return `${(value / 10000).toFixed(1)}万`;
    return value.toLocaleString();
};

const getTradableResources = (epoch = 0) => {
    return Object.entries(RESOURCES).filter(([key, info]) => {
        if (info.type === 'virtual' || info.type === 'currency') return false;
        if (typeof info.unlockEpoch === 'number' && info.unlockEpoch > epoch) return false;
        return key !== 'silver';
    });
};

const DiplomacyDashboard = ({
    nations,
    gameState,
    epoch,
    silver = 0,
    diplomacyOrganizations,
    overseasInvestments,
    market,
    daysElapsed,
    tradeOpportunities = { exports: [], imports: [] }, // [NEW] Backend-driven
    onDiplomaticAction,
    onViewOrganization,
}) => {
    const [showCreateOrgModal, setShowCreateOrgModal] = useState(false);
    const [createOrgType, setCreateOrgType] = useState(null);
    const [showOrgsSheet, setShowOrgsSheet] = useState(false);

    const visibleNations = useMemo(() => {

        return (nations || []).filter(
            (nation) =>
                epoch >= (nation.appearEpoch ?? 0) &&
                (nation.expireEpoch == null || epoch <= nation.expireEpoch) &&
                !nation.isAnnexed // 排除已被吞并的国家
        );
    }, [nations, epoch]);

    const wars = visibleNations.filter((n) => n.isAtWar);
    const allies = visibleNations.filter((n) => n.alliedWithPlayer);

    const organizations = Array.isArray(diplomacyOrganizations?.organizations)
        ? diplomacyOrganizations.organizations
        : [];
    const playerOrgs = organizations.filter((org) =>
        Array.isArray(org?.members) && org.members.includes('player')
    );

    const totalInvestments = overseasInvestments ? overseasInvestments.length : 0;
    const totalInvestmentIncome = overseasInvestments
        ? overseasInvestments.reduce((sum, inv) => sum + (inv.dailyProfit || 0), 0)
        : 0;

    const marketSignals = useMemo(() => {
        const tradables = getTradableResources(epoch);
        const localPrices = market?.prices || {};
        const localEntries = tradables.map(([key, res]) => {
            const basePrice = res.basePrice || 1;
            const price = localPrices[key] ?? basePrice;
            const ratio = basePrice > 0 ? price / basePrice : 1;
            return {
                key,
                name: res.name || key,
                price,
                ratio,
            };
        });

        const expensive = localEntries.slice().sort((a, b) => b.ratio - a.ratio).slice(0, 3);
        const cheap = localEntries.slice().sort((a, b) => a.ratio - b.ratio).slice(0, 3);

        return { expensive, cheap };
    }, [market, epoch]);

    return (
        <div className="p-6 h-full overflow-y-auto space-y-6 scrollbar-thin scrollbar-thumb-ancient-gold/20">
            {/* Header */}
            <div className="flex flex-col gap-1">
                <h1 className="text-3xl font-bold text-ancient-gold font-decorative flex items-center gap-3">
                    <Icon name="Globe" size={32} />
                    外交概览
                </h1>
                <p className="text-ancient-stone text-sm">掌握局势、组织关系与全球市场动向。</p>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <DashboardCard
                    title="当前战争"
                    value={wars.length}
                    icon="Swords"
                    color="text-red-400"
                    borderColor="border-red-500/30"
                    bg="bg-red-900/10"
                />
                <DashboardCard
                    title="盟友数量"
                    value={allies.length}
                    icon="Handshake"
                    color="text-green-400"
                    borderColor="border-green-500/30"
                    bg="bg-green-900/10"
                />
                <DashboardCard
                    title="外交声誉"
                    value={Math.round(gameState?.diplomaticReputation || 50)}
                    icon="Award"
                    color="text-blue-400"
                    borderColor="border-blue-500/30"
                    bg="bg-blue-900/10"
                />
                <DashboardCard
                    title="海外收益"
                    value={`+${formatNumber(totalInvestmentIncome)}`}
                    subValue={`${totalInvestments} 处资产`}
                    icon="Coins"
                    color="text-amber-400"
                    borderColor="border-amber-500/30"
                    bg="bg-amber-900/10"
                />
            </div>

            {/* Main Content Layout: 2 Columns */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

                {/* Column 1: International Organizations */}
                <div className="space-y-6">
                    <div className="flex items-center justify-between border-b border-ancient-gold/20 pb-2">
                        <h3 className="text-xl font-bold text-ancient-parchment font-decorative flex items-center gap-2">
                            <Icon name="Landmark" size={24} className="text-ancient-gold" />
                            国际组织与联盟
                        </h3>
                    </div>

                    <div className="space-y-4">
                        {/* Create Org Section */}
                        <div className="grid grid-cols-1 gap-3">
                            {ORG_TYPES.map((orgType) => {
                                const isUnlocked = isDiplomacyUnlocked('organizations', orgType.type, epoch);
                                const playerHasOrg = playerOrgs.some((o) => o.type === orgType.type);
                                const canClick = isUnlocked && !playerHasOrg;

                                return (
                                    <button
                                        key={orgType.type}
                                        onClick={() => {
                                            if (canClick) {
                                                setCreateOrgType(orgType);
                                                setShowCreateOrgModal(true);
                                            }
                                        }}
                                        disabled={!canClick}
                                        className={`
                                            relative overflow-hidden p-4 rounded-xl border flex items-center gap-4 transition-all duration-300 text-left group
                                            ${canClick
                                                ? 'bg-ancient-ink/40 border-ancient-gold/30 hover:bg-ancient-gold/10 hover:border-ancient-gold/60 hover:shadow-gold-metal cursor-pointer'
                                                : 'bg-ancient-ink/20 border-ancient-stone/10 opacity-60 cursor-not-allowed'
                                            }
                                        `}
                                    >
                                        <div className={`p-3 rounded-lg bg-ancient-ink/60 border border-current ${orgType.color} shadow-inner bg-opacity-50`}>
                                            <Icon name={orgType.icon} size={28} />
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex justify-between items-center mb-1">
                                                <div className="font-bold text-ancient-parchment text-lg group-hover:text-ancient-gold transition-colors">
                                                    {playerHasOrg ? `已建立${orgType.name}` : `建立${orgType.name}`}
                                                </div>
                                                {!isUnlocked && (
                                                    <span className="text-xs bg-black/40 px-2 py-0.5 rounded text-ancient-stone">
                                                        解锁于时代 {orgType.era}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="text-xs text-ancient-stone/80">
                                                {orgType.desc}
                                            </div>
                                        </div>
                                        {canClick && (
                                            <Icon name="Plus" size={20} className="text-ancient-gold/50 group-hover:text-ancient-gold transition-colors" />
                                        )}
                                    </button>
                                );
                            })}
                        </div>

                        {/* Existing Orgs List - 只显示前2个 */}
                        {organizations.length > 0 && (
                            <div className="mt-4 space-y-3">
                                <div className="flex items-center justify-between">
                                    <h4 className="text-sm font-bold text-ancient-stone uppercase tracking-wider">活跃组织</h4>
                                    {organizations.length > 2 && (
                                        <span className="text-xs text-ancient-stone/60">
                                            共 {organizations.length} 个组织
                                        </span>
                                    )}
                                </div>
                                {organizations.slice(0, 2).map((org) => (
                                    <OrganizationCard 
                                        key={org.id} 
                                        org={org} 
                                        onViewOrganization={onViewOrganization} 
                                        onDiplomaticAction={onDiplomaticAction}
                                    />
                                ))}
                                {/* 查看全部按钮 */}
                                {organizations.length > 2 && (
                                    <button
                                        onClick={() => setShowOrgsSheet(true)}
                                        className="w-full p-3 rounded-lg border border-ancient-gold/30 bg-ancient-ink/40 hover:bg-ancient-gold/10 hover:border-ancient-gold/50 transition-all duration-300 flex items-center justify-center gap-2 text-ancient-parchment group"
                                    >
                                        <Icon name="Building2" size={16} className="text-ancient-gold/70 group-hover:text-ancient-gold" />
                                        <span className="text-sm font-medium">查看全部 {organizations.length} 个组织</span>
                                        <Icon name="ChevronRight" size={16} className="text-ancient-stone group-hover:text-ancient-gold transition-colors" />
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Column 2: Market & Trade */}
                <div className="space-y-6">
                    <div className="flex items-center justify-between border-b border-ancient-gold/20 pb-2">
                        <h3 className="text-xl font-bold text-ancient-parchment font-decorative flex items-center gap-2">
                            <Icon name="Store" size={24} className="text-ancient-gold" />
                            市场与贸易情报
                        </h3>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-4">
                        <Card className="p-4 border-ancient-gold/20 bg-ancient-ink/30 relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-2 opacity-10">
                                <Icon name="TrendingUp" size={64} />
                            </div>
                            <h4 className="text-sm font-bold text-ancient-stone mb-3 uppercase tracking-wider">国内价格信号</h4>
                            <div className="space-y-2">
                                <MarketSignalList title="价格偏高 (利润↑)" tone="text-green-300" items={marketSignals.expensive} />
                                <div className="h-px bg-white/5 my-2"></div>
                                <MarketSignalList title="价格偏低 (适宜囤货)" tone="text-blue-300" items={marketSignals.cheap} />
                            </div>
                        </Card>

                        <Card className="p-4 border-ancient-gold/20 bg-ancient-ink/30 relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-2 opacity-10">
                                <Icon name="Ship" size={64} />
                            </div>
                            <h4 className="text-sm font-bold text-ancient-stone mb-3 uppercase tracking-wider">全球贸易良机</h4>
                            <div className="space-y-2">
                                <TradeOpportunityList title="最佳出口目标" tone="text-amber-300" items={tradeOpportunities.exports} />
                                <div className="h-px bg-white/5 my-2"></div>
                                <TradeOpportunityList title="最佳进口来源" tone="text-cyan-300" items={tradeOpportunities.imports} />
                            </div>
                        </Card>
                    </div>
                </div>

            </div>
            {/* 组织列表 BottomSheet */}
            <BottomSheet
                isOpen={showOrgsSheet}
                onClose={() => setShowOrgsSheet(false)}
                title={`🏛️ 全部国际组织 (${organizations.length})`}
            >
                <div className="space-y-3">
                    {organizations.length === 0 ? (
                        <div className="text-center py-8 text-ancient-stone">
                            <Icon name="Building2" size={48} className="mx-auto mb-3 opacity-30" />
                            <p>暂无活跃的国际组织</p>
                        </div>
                    ) : (
                        organizations.map((org) => (
                            <OrganizationCard
                                key={org.id}
                                org={org}
                                onViewOrganization={(o) => {
                                    setShowOrgsSheet(false);
                                    onViewOrganization?.(o);
                                }}
                                onDiplomaticAction={onDiplomaticAction}
                            />
                        ))
                    )}
                </div>
            </BottomSheet>

            {/* Create Org Modal */}
            <CreateOrganizationModal
                isOpen={showCreateOrgModal}
                onClose={() => {
                    setShowCreateOrgModal(false);
                    setCreateOrgType(null);
                }}
                orgType={createOrgType}
                silver={silver}
                onCreate={(name) => {
                    if (onDiplomaticAction && createOrgType) {
                        onDiplomaticAction('player', 'create_org', {
                            type: createOrgType.type,
                            name: name
                        });
                    }
                }}
            />
        </div>
    );
};

// --- Sub-Components ---

/**
 * 组织卡片组件 - 用于展示单个国际组织
 */
const OrganizationCard = ({ org, onViewOrganization, onDiplomaticAction }) => {
    const isMember = org.members?.includes('player');
    return (
        <Card
            onClick={() => onDiplomaticAction && onViewOrganization && onViewOrganization(org)}
            className={`
                p-4 flex items-center justify-between group transition-all duration-300
                ${onViewOrganization
                    ? 'cursor-pointer hover:bg-ancient-gold/10 hover:border-ancient-gold/40'
                    : ''
                }
                ${isMember
                    ? 'border-ancient-gold/40 bg-ancient-gold/5'
                    : 'border-ancient-stone/20 bg-ancient-ink/30'
                }
            `}
        >
            <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-ancient-stone/20 flex items-center justify-center border border-ancient-stone/30 font-bold text-ancient-parchment">
                    {org.name.charAt(0)}
                </div>
                <div>
                    <div className="font-bold text-ancient-parchment text-base group-hover:text-ancient-gold transition-colors">{org.name}</div>
                    <div className="text-xs text-ancient-stone flex items-center gap-2">
                        <span>{org.members?.length || 0} 个成员国</span>
                        <span className="opacity-50">|</span>
                        <span className="capitalize">{ORG_TYPES.find(t => t.type === org.type)?.name || org.type}</span>
                    </div>
                </div>
            </div>

            {!isMember ? (
                <div className="flex flex-col items-end gap-1">
                    <span className="text-xs text-ancient-stone/70 px-2 py-1 rounded bg-ancient-stone/10 border border-ancient-stone/20 flex items-center gap-1">
                        <Icon name="MessageSquare" size={12} />
                        需与创始国谈判
                    </span>
                </div>
            ) : (
                <span className="text-xs text-green-400 font-bold px-2 py-1 rounded bg-green-900/20 border border-green-500/20 flex items-center gap-1">
                    <Icon name="Check" size={12} />
                    成员国
                </span>
            )}
        </Card>
    );
};

const DashboardCard = ({ title, value, subValue, icon, color, borderColor = 'border-ancient-gold/20', bg = 'bg-ancient-ink/40' }) => (
    <div
        className={`
            relative overflow-hidden p-4 rounded-xl border ${borderColor} ${bg}
            flex items-center justify-between transition-all duration-300 hover:shadow-metal-sm group
        `}
    >
        <div>
            <div className="text-[10px] uppercase font-bold tracking-wider mb-1 opacity-70 flex items-center gap-1 text-ancient-stone">
                {title}
            </div>
            <div className={`text-3xl font-bold ${color} font-epic shadow-black drop-shadow-md`}>{value}</div>
            {subValue && <div className="text-[10px] text-ancient-stone mt-1">{subValue}</div>}
        </div>
        <div className={`p-3 rounded-full bg-black/20 border border-white/5 ${color} group-hover:scale-110 transition-transform`}>
            <Icon name={icon} size={24} />
        </div>
    </div>
);

const MarketSignalList = ({ title, tone, items }) => (
    <div className="space-y-1">
        <div className={`text-[10px] font-bold uppercase tracking-wider ${tone} mb-1 opacity-80`}>{title}</div>
        {items.length === 0 ? (
            <div className="text-xs text-ancient-stone/60 italic p-1">暂无明显信号</div>
        ) : (
            <div className="space-y-1">
                {items.map((item) => (
                    <div key={item.key} className="flex items-center justify-between text-xs bg-black/30 rounded px-2 py-1.5 border border-white/5">
                        <span className="text-ancient-parchment font-medium">{item.name}</span>
                        <span className="text-ancient-stone font-mono">×{item.ratio.toFixed(2)}</span>
                    </div>
                ))}
            </div>
        )}
    </div>
);

const TradeOpportunityList = ({ title, tone, items }) => (
    <div className="space-y-1">
        <div className={`text-[10px] font-bold uppercase tracking-wider ${tone} mb-1 opacity-80`}>{title}</div>
        {items.length === 0 ? (
            <div className="text-xs text-ancient-stone/60 italic p-1">暂无明显机会</div>
        ) : (
            <div className="space-y-1">
                {items.map((item, index) => (
                    <div key={`${item.nationId}-${index}`} className="flex items-center justify-between text-xs bg-black/30 rounded px-2 py-1.5 border border-white/5">
                        <div className="flex flex-col">
                            <span className="text-ancient-parchment font-medium">{item.resourceName}</span>
                            <span className="text-[10px] text-ancient-stone/70">{item.nationName}</span>
                        </div>
                        <span className="text-ancient-stone font-mono">+{item.diff.toFixed(1)}</span>
                    </div>
                ))}
            </div>
        )}
    </div>
);

export default DiplomacyDashboard;
