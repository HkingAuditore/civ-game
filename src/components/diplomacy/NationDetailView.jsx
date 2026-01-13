import React, { useMemo, useState } from 'react';
import { Button, Card, Tabs, Badge } from '../common/UnifiedUI';
import { Icon } from '../common/UIComponents';
import { RESOURCES, DIPLOMACY_ERA_UNLOCK } from '../../config';
import { getEstimatedMilitaryStrength } from '../../logic/diplomacy/militaryUtils';
import { getRelationLabel } from '../../utils/diplomacyUtils';
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
}) => {
    const [activeTab, setActiveTab] = useState('overview');

    const strengthEstimate = getEstimatedMilitaryStrength
        ? getEstimatedMilitaryStrength(nation, epoch, daysElapsed)
        : { label: '???', colorClass: 'text-gray-400' };

    const relation = relationInfo
        ? relationInfo(nation)
        : { value: 0, label: '未知', color: 'text-ancient-stone', bg: '' };

    // Get player's organizations to invite nation to
    const playerOrganizations = useMemo(() => {
        if (!diplomacyOrganizations?.organizations) return [];
        return diplomacyOrganizations.organizations.filter(org =>
            Array.isArray(org.members) && org.members.includes('player')
        );
    }, [diplomacyOrganizations]);

    const tabs = [
        { id: 'overview', label: '国家概览' },
        { id: 'actions', label: '外交行动' },
        { id: 'trade', label: '贸易与投资' },
        { id: 'vassal', label: '附庸管理' },
    ];

    return (
        <div className="flex flex-col h-full bg-theme-surface-trans">
            <div
                className="p-6 border-b border-theme-border flex-shrink-0"
                style={{ background: 'linear-gradient(to bottom, var(--theme-surface), transparent)' }}
            >
                {/* Header Section */}
                <div className="flex justify-between items-start">
                    <div className="flex items-center gap-4">
                        <div
                            className={`w-16 h-12 flex items-center justify-center bg-black/50 rounded-lg border-2 ${nation.color ? nation.color.replace('text-', 'border-') : 'border-gray-600'} shadow-lg`}
                        >
                            <Icon name="Flag" size={32} className={nation.color || 'text-gray-400'} />
                        </div>
                        <div>
                            <h2 className="text-3xl font-bold text-theme-accent tracking-wide font-decorative shadow-black drop-shadow-md">
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

            <div className="px-6 border-b border-theme-border bg-theme-surface-trans">
                <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} variant="underline" />
            </div>

            <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-ancient-gold/20 hover:scrollbar-thumb-ancient-gold/40 scrollbar-track-ancient-ink/10">
                {activeTab === 'overview' && (
                    <div className="space-y-6">
                        {nation.desc && (
                            <div className="p-4 bg-ancient-ink/40 rounded-lg border border-ancient-gold/10 text-ancient-parchment italic font-serif leading-relaxed relative">
                                <Icon name="Quote" size={16} className="absolute top-2 left-2 text-ancient-gold/20" />
                                <div className="pl-4">"{nation.desc}"</div>
                            </div>
                        )}

                        <StrategicStatus nation={nation} epoch={epoch} market={market} daysElapsed={daysElapsed} />

                        <ActiveTreaties nation={nation} daysElapsed={daysElapsed} />
                    </div>
                )}

                {activeTab === 'actions' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        <ActionCard
                            icon="Gift"
                            title="赠礼"
                            desc="提升关系 (+10)，需要银币。"
                            cost="银币"
                            onClick={() => onDiplomaticAction?.(nation.id, 'gift')}
                            color="green"
                        />
                        <ActionCard
                            icon="Handshake"
                            title="提议结盟"
                            desc={nation.relation >= 70 ? '请求建立正式军事同盟。' : '关系需达到 70。'}
                            disabled={nation.relation < 70}
                            onClick={() => onDiplomaticAction?.(nation.id, 'propose_alliance')}
                            color="emerald"
                        />
                        <ActionCard
                            icon="ScrollText"
                            title="外交谈判"
                            desc="谈判条约、贸易协定等。"
                            onClick={() => onNegotiate?.()}
                            color="blue"
                        />

                        {/* Invite to Organization Buttons */}
                        {playerOrganizations.map(org => {
                            const isMember = Array.isArray(nation.organizationMemberships) && nation.organizationMemberships.includes(org.id);
                            return (
                                <ActionCard
                                    key={org.id}
                                    icon="Users"
                                    title={`邀请加入${org.name}`}
                                    desc={isMember ? '已是成员。' : `邀请该国加入 ${org.name}。`}
                                    disabled={isMember}
                                    onClick={() => onDiplomaticAction?.(nation.id, 'join_org', { orgId: org.id })}
                                    color="purple"
                                />
                            );
                        })}

                        <ActionCard
                            icon="MessageSquareWarning"
                            title="侮辱"
                            desc="大幅降低关系，可能激怒对方。"
                            onClick={() => onDiplomaticAction?.(nation.id, 'insult')}
                            color="orange"
                        />
                        <ActionCard
                            icon="Skull"
                            title="挑拨"
                            desc="消耗银币离间其与其他国家的关系。"
                            cost="银币"
                            onClick={() => onProvoke?.()}
                            color="orange"
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
                                desc="开启战争！这将导致稳定度下降。"
                                cost={diplomaticCooldownMod ? `稳定度-${diplomaticCooldownMod}` : '稳定度'}
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

const StrategicStatus = ({ nation, epoch }) => {
    // Generate some fake but plausible preferences based on personality/resources if actual data is missing
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
                        {/* Simple logic to show what they might buy */}
                        <span className="text-xs text-green-300 flex items-center gap-1">
                            <Icon name="ArrowDown" size={10} /> 进口粮食
                        </span>
                        <span className="text-xs text-blue-300 flex items-center gap-1">
                            <Icon name="ArrowDown" size={10} /> 进口武器
                        </span>
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
            <table className="w-full text-left text-sm">
                <thead>
                    <tr className="bg-white/5 text-ancient-stone/70 border-b border-white/5">
                        <th className="p-3 font-medium">资源</th>
                        <th className="p-3 font-medium text-right">本地价格</th>
                        <th className="p-3 font-medium text-right">对方价格</th>
                        <th className="p-3 font-medium text-center">状态</th>
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
                                <td className="p-3">
                                    <div className="flex items-center gap-2">
                                        <div className={`w-2 h-2 rounded-full ${isProfitableExport ? 'bg-green-500' : isProfitableImport ? 'bg-blue-500' : 'bg-gray-600'}`}></div>
                                        <span className="text-ancient-parchment font-medium">{res.name}</span>
                                    </div>
                                </td>
                                <td className="p-3 text-right text-ancient-stone font-mono">
                                    {localPrice.toFixed(1)}
                                </td>
                                <td className="p-3 text-right text-ancient-parchment font-mono font-bold">
                                    {foreignPrice.toFixed(1)}
                                    <span className={`ml-1 text-[10px] ${diff > 0 ? 'text-green-400' : diff < 0 ? 'text-blue-400' : 'text-gray-500'}`}>
                                        ({diff > 0 ? '+' : ''}{diffPercent.toFixed(0)}%)
                                    </span>
                                </td>
                                <td className="p-3 text-center">
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
                group flex items-start gap-4 p-4 text-left rounded-xl border transition-all duration-300 relative overflow-hidden
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
                            {treaty.endDay ? `剩余 ${Math.max(0, treaty.endDay - daysElapsed)} 天` : '永久'}
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

    // Assuming a max limit or cost logic could be relevant, but for now just UI
    const handleAdd = () => {
        onMerchantStateChange?.(nation.id, merchantCount + 1);
    };

    const handleRemove = () => {
        if (merchantCount > 0) {
            onMerchantStateChange?.(nation.id, merchantCount - 1);
        }
    };

    return (
        <Card className="p-4 bg-blue-900/10 border-blue-500/30 flex items-center justify-between mb-4">
            <div>
                <h3 className="text-blue-300 font-bold flex items-center gap-2">
                    <Icon name="Ship" size={24} />
                    派驻商人
                </h3>
                <p className="text-xs text-ancient-stone mt-1">
                    商人会自动寻找最有利可图的商品进行贸易。
                </p>
            </div>
            <div className="flex items-center gap-4 bg-black/40 p-3 rounded-xl border border-blue-500/30 text-white">
                <Button
                    size="md"
                    variant="danger"
                    onClick={handleRemove}
                    disabled={merchantCount <= 0}
                    className="w-12 h-12 flex items-center justify-center p-0 rounded-lg shadow-lg hover:bg-red-600 transition-colors"
                    title="减少商人"
                >
                    <Icon name="Minus" size={24} className="text-white" />
                </Button>
                <div className="text-3xl font-bold font-mono w-16 text-center text-blue-100 drop-shadow-md">
                    {merchantCount}
                </div>
                <Button
                    size="md"
                    variant="primary"
                    onClick={handleAdd}
                    className="w-12 h-12 flex items-center justify-center p-0 rounded-lg shadow-lg hover:bg-blue-600 transition-colors"
                    title="增加商人"
                >
                    <Icon name="Plus" size={24} className="text-white" />
                </Button>
            </div>
        </Card>
    );
};

export default NationDetailView;
