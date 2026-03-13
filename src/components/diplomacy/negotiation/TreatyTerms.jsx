import React, { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Card, Input, Icon, Tooltip } from '../../common/UnifiedUI';
import { NEGOTIABLE_TREATY_TYPES, getTreatyDailyMaintenance, calculateTreatySigningCost } from '../../../config/diplomacy';
import { getTreatyLabel, getTreatyUnlockEraName, getTreatyDuration } from '../../../utils/diplomacyUtils';
import { getTreatyEffectDescriptionsByType } from '../../../logic/diplomacy/treatyEffects';
import { getNationOrganizations, ORGANIZATION_TYPE_CONFIGS, getOrganizationMaxMembers } from '../../../logic/diplomacy/organizationDiplomacy';
import { formatNumberShortCN } from '../../../utils/numberFormat';

// Floating tooltip component using portal
const FloatingTooltip = ({ children, content, disabled }) => {
    const [show, setShow] = useState(false);
    const [position, setPosition] = useState({ top: 0, left: 0 });
    const triggerRef = useRef(null);
    const tooltipRef = useRef(null);

    const updatePosition = useCallback(() => {
        if (!triggerRef.current || !tooltipRef.current) return;
        const rect = triggerRef.current.getBoundingClientRect();
        const tooltipRect = tooltipRef.current.getBoundingClientRect();
        const tooltipWidth = tooltipRect.width || 280;
        const tooltipHeight = tooltipRect.height || 200;
        
        const padding = 12;
        const spaceBelow = window.innerHeight - rect.bottom - padding;
        const spaceAbove = rect.top - padding;
        const spaceLeft = rect.left - padding;
        const spaceRight = window.innerWidth - rect.right - padding;
        
        // Determine vertical position (prefer below, then above)
        let top;
        if (spaceBelow >= tooltipHeight || spaceBelow >= spaceAbove) {
            // Show below
            top = rect.bottom + padding;
        } else {
            // Show above
            top = rect.top - tooltipHeight - padding;
        }
        
        // Determine horizontal position (center, but keep within viewport)
        let left = rect.left + rect.width / 2 - tooltipWidth / 2;
        
        // Clamp to viewport
        if (left < padding) left = padding;
        if (left + tooltipWidth > window.innerWidth - padding) {
            left = window.innerWidth - tooltipWidth - padding;
        }
        if (top < padding) top = padding;
        if (top + tooltipHeight > window.innerHeight - padding) {
            top = window.innerHeight - tooltipHeight - padding;
        }
        
        setPosition({ top, left });
    }, []);

    useEffect(() => {
        if (show) {
            // Delay position update to ensure tooltip is rendered
            requestAnimationFrame(() => {
                updatePosition();
            });
            window.addEventListener('scroll', updatePosition, true);
            window.addEventListener('resize', updatePosition);
            return () => {
                window.removeEventListener('scroll', updatePosition, true);
                window.removeEventListener('resize', updatePosition);
            };
        }
    }, [show, updatePosition]);

    if (disabled) return children;

    return (
        <>
            <div
                ref={triggerRef}
                onMouseEnter={() => setShow(true)}
                onMouseLeave={() => setShow(false)}
            >
                {children}
            </div>
            {show && createPortal(
                <div
                    ref={tooltipRef}
                    style={{
                        position: 'fixed',
                        top: position.top,
                        left: position.left,
                        zIndex: 99999,
                        maxWidth: '320px',
                        minWidth: '240px',
                    }}
                    className="p-2 bg-[#0a0a14] border border-ancient-gold/40 rounded shadow-2xl text-xs text-ancient-stone pointer-events-none"
                >
                    {content}
                </div>,
                document.body
            )}
        </>
    );
};

const TreatyTerms = ({
    draft,
    setDraft,
    isDiplomacyUnlocked,
    epoch,
    organizations = [],
    nations = [],
    selectedNation,
    empireName = '我的帝国', // 玩家帝国名称
    playerWealth = 0, // 玩家财富
    disabled = false,
    t = (k, v) => v
}) => {
    // Calculate signing cost
    const signingCost = useMemo(() => {
        const targetWealth = selectedNation?.wealth || 1000;
        return calculateTreatySigningCost(draft.type, playerWealth, targetWealth, epoch);
    }, [draft.type, playerWealth, selectedNation?.wealth, epoch]);

    // Check if player can afford signing cost
    const canAffordSigningCost = playerWealth >= signingCost;

    const playerNationId = useMemo(() => {
        // Try to detect player's nation id from nations list (commonly 0).
        // Fallback keeps backward compatibility with older saves that store 'player' as member id.
        const playerNation = nations.find(n => n.id === 0 || n.id === 'player' || n.isPlayer);
        return playerNation?.id ?? 'player';
    }, [nations]);

    const isOrgLeader = useCallback((org) => {
        if (!org) return false;
        const leaderId = org.leaderId ?? org.founderId;
        return String(leaderId) === String(playerNationId);
    }, [playerNationId]);

    // Check if selected treaty type is an organization type
    const isOrganizationType = draft.type === 'military_alliance' || draft.type === 'economic_bloc';
    
    // Get player's organizations of the selected type
    const playerOrganizations = useMemo(() => {
        if (!isOrganizationType) return [];
        // Only organization leader can invite others in negotiation UI (方案A)
        return getNationOrganizations(playerNationId, organizations)
            .filter(org => org.type === draft.type)
            .filter(isOrgLeader);
    }, [organizations, draft.type, isOrganizationType, playerNationId, isOrgLeader]);
    
    // Get target nation's organizations of the selected type that player can join
    const targetOrganizations = useMemo(() => {
        if (!isOrganizationType || !selectedNation?.id) return [];
        return getNationOrganizations(selectedNation.id, organizations)
            .filter(org => org.type === draft.type && !org.members.includes(playerNationId) && !org.members.includes('player'));
    }, [organizations, selectedNation, draft.type, isOrganizationType, playerNationId]);
    
    // Get shared organizations where both player and target are members (for kick option)
    const sharedOrganizations = useMemo(() => {
        if (!isOrganizationType || !selectedNation?.id) return [];
        // Only organization leader can kick members in negotiation UI (方案A)
        return organizations.filter(org => 
            org.type === draft.type &&
            (org.members?.includes(playerNationId) || org.members?.includes('player')) &&
            org.members?.includes(selectedNation.id) &&
            org.founderId !== selectedNation.id && // Cannot kick founder
            isOrgLeader(org)
        );
    }, [organizations, selectedNation, draft.type, isOrganizationType, playerNationId, isOrgLeader]);
    
    // Get organization type config
    const orgConfig = isOrganizationType ? ORGANIZATION_TYPE_CONFIGS[draft.type] : null;
    
    // Helper to get nation name
    const getNationName = (nationId) => {
        if (nationId === 'player') return empireName;
        const nation = nations.find(n => n.id === nationId);
        return nation?.name || t('common.unknownNation', '未知国家');
    };
    
    // Handle organization selection
    const handleOrgSelect = (orgId, mode) => {
        setDraft(prev => ({
            ...prev,
            targetOrganizationId: orgId,
            organizationMode: mode, // 'invite', 'join', 'create', or 'kick'
        }));
    };

    return (
        <div className="flex flex-col gap-2 lg:gap-4 h-full">
            {/* Treaty Type Selector */}
            <div className="space-y-1 lg:space-y-2">
                <label className="text-xs lg:text-xs font-bold text-ancient-gold uppercase tracking-wider flex items-center justify-center gap-2">
                    <Icon name="FileText" size={14} />
                    {t('negotiation.treatyType', '条约类型')}
                </label>

                <div className="grid grid-cols-3 lg:grid-cols-2 gap-0.5 lg:gap-2">
                    {NEGOTIABLE_TREATY_TYPES.map((type) => {
                        // military_alliance and economic_bloc are organizations, not treaties
                        const isOrgType = type === 'military_alliance' || type === 'economic_bloc';
                        const category = isOrgType ? 'organizations' : 'treaties';
                        const locked = !isDiplomacyUnlocked(category, type, epoch);
                        const label = getTreatyLabel(type);
                        const isSelected = draft.type === type;
                        const effects = getTreatyEffectDescriptionsByType(type);

                        const tooltipContent = (
                            <>
                                <div className="font-bold text-ancient-gold mb-1">{label}</div>
                                <ul className="list-disc list-inside space-y-0.5">
                                    {effects.map((e, i) => <li key={i}>{e}</li>)}
                                </ul>
                            </>
                        );

                        return (
                            <FloatingTooltip key={type} content={tooltipContent} disabled={locked || disabled}>
                                <button
                                    type="button"
                                    disabled={locked || disabled}
                                    onClick={() => {
                                        if (locked || disabled) return;
                                        const targetWealth = selectedNation?.wealth || 1000;
                                        const maintenancePerDay = getTreatyDailyMaintenance(type, playerWealth, targetWealth);
                                        setDraft(prev => ({
                                            ...prev,
                                            type,
                                            durationDays: getTreatyDuration(type, epoch),
                                            maintenancePerDay,
                                            // Reset organization selection when changing type
                                            targetOrganizationId: null,
                                            organizationMode: null,
                                        }));
                                    }}
                                    className={`
                                        relative p-1 lg:p-2 rounded-lg border text-center lg:text-left transition-all
                                        flex flex-col items-center lg:items-start justify-center lg:justify-start h-8 lg:h-auto w-full
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
                                    <div className="text-xs lg:text-xs font-bold text-ancient-parchment truncate w-full">{label}</div>
                                    {locked && (
                                        <div className="hidden lg:flex text-xs lg:text-xs text-red-400 mt-0.5 lg:mt-1 items-center gap-1">
                                            <Icon name="Lock" size={8} />
                                            {getTreatyUnlockEraName(type)}
                                        </div>
                                    )}
                                </button>
                            </FloatingTooltip>
                        );
                    })}
                </div>
            </div>

            {/* Organization Selector - Only shown for military_alliance and economic_bloc */}
            {isOrganizationType && (
                <Card className="p-2 lg:p-3 bg-ancient-ink/30 border-ancient-gold/20 space-y-2">
                    <label className="text-xs lg:text-xs font-bold text-ancient-gold uppercase tracking-wider flex items-center gap-2">
                        <Icon name="Users" size={14} />
                        {t('negotiation.selectOrganization', '选择组织')}
                    </label>
                    
                    {/* Kick Member Option - for shared organizations */}
                    {sharedOrganizations.length > 0 && (
                        <div className="space-y-1">
                            <div className="text-xs lg:text-xs text-ancient-stone flex items-center gap-1">
                                <Icon name="UserMinus" size={10} className="text-red-400" />
                                {t('negotiation.kickMember', '将对方移除出组织')}
                            </div>
                            <div className="grid gap-1">
                                {sharedOrganizations.map(org => {
                                    const isSelected = draft.targetOrganizationId === org.id && draft.organizationMode === 'kick';
                                    const memberCount = org.members?.length || 0;
                                    
                                    return (
                                        <button
                                            key={`kick-${org.id}`}
                                            type="button"
                                            onClick={() => handleOrgSelect(org.id, 'kick')}
                                            className={`
                                                p-2 rounded border text-left transition-all
                                                hover:border-red-500/40 hover:bg-red-500/5
                                                ${isSelected 
                                                    ? 'border-red-500 bg-red-500/10' 
                                                    : 'border-ancient-gold/10 bg-black/20'
                                                }
                                            `}
                                        >
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <Icon 
                                                        name={draft.type === 'military_alliance' ? 'Shield' : 'Briefcase'} 
                                                        size={14} 
                                                        className={isSelected ? 'text-red-400' : 'text-ancient-stone'} 
                                                    />
                                                    <span className="text-xs lg:text-xs font-medium text-ancient-parchment">
                                                        {org.name}
                                                    </span>
                                                </div>
                                                <span className="text-xs text-ancient-stone">
                                                    {memberCount} {t('common.members', '成员')}
                                                </span>
                                            </div>
                                            <div className="text-xs text-red-300 mt-1">
                                                {t('negotiation.kickWarning', '移除后关系将大幅下降')}
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                    
                    {/* Player's Organizations - Invite target to join */}
                    {playerOrganizations.length > 0 && (
                        <div className="space-y-1">
                            <div className="text-xs lg:text-xs text-ancient-stone flex items-center gap-1">
                                <Icon name="UserPlus" size={10} className="text-green-400" />
                                {t('negotiation.inviteToJoin', '邀请对方加入你的组织')}
                            </div>
                            <div className="grid gap-1">
                            {playerOrganizations.map(org => {
                                    const isSelected = draft.targetOrganizationId === org.id && draft.organizationMode === 'invite';
                                    const memberCount = org.members?.length || 0;
                                    const maxMembers = getOrganizationMaxMembers(org.type, epoch);
                                    const isFull = memberCount >= maxMembers;
                                    const alreadyMember = org.members?.includes(selectedNation?.id);
                                    const disabled = isFull || alreadyMember;
                                    
                                    return (
                                        <button
                                            key={org.id}
                                            type="button"
                                            disabled={disabled}
                                            onClick={() => handleOrgSelect(org.id, 'invite')}
                                            className={`
                                                p-2 rounded border text-left transition-all
                                                ${disabled 
                                                    ? 'opacity-40 cursor-not-allowed border-transparent bg-black/20' 
                                                    : 'hover:border-green-500/40 hover:bg-green-500/5'
                                                }
                                                ${isSelected 
                                                    ? 'border-green-500 bg-green-500/10' 
                                                    : 'border-ancient-gold/10 bg-black/20'
                                                }
                                            `}
                                        >
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <Icon 
                                                        name={draft.type === 'military_alliance' ? 'Shield' : 'Briefcase'} 
                                                        size={14} 
                                                        className={isSelected ? 'text-green-400' : 'text-ancient-stone'} 
                                                    />
                                                    <span className="text-xs lg:text-xs font-medium text-ancient-parchment">
                                                        {org.name}
                                                    </span>
                                                </div>
                                                <span className="text-xs text-ancient-stone">
                                                    {memberCount}/{maxMembers} {t('common.members', '成员')}
                                                </span>
                                            </div>
                                            {alreadyMember && (
                                                <div className="text-xs text-amber-400 mt-1">
                                                    {t('negotiation.alreadyMember', '对方已是成员')}
                                                </div>
                                            )}
                                            {isFull && !alreadyMember && (
                                                <div className="text-xs text-red-400 mt-1">
                                                    {t('negotiation.organizationFull', '组织已满员')}
                                                </div>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                    
                    {/* Target Nation's Organizations - Apply to join */}
                    {targetOrganizations.length > 0 && (
                        <div className="space-y-1">
                            <div className="text-xs lg:text-xs text-ancient-stone flex items-center gap-1">
                                <Icon name="LogIn" size={10} className="text-blue-400" />
                                {t('negotiation.applyToJoin', '申请加入对方的组织')}
                            </div>
                            <div className="grid gap-1">
                                {targetOrganizations.map(org => {
                                    const isSelected = draft.targetOrganizationId === org.id && draft.organizationMode === 'join';
                                    const memberCount = org.members?.length || 0;
                                    const maxMembers = getOrganizationMaxMembers(org.type, epoch);
                                    const isFull = memberCount >= maxMembers;
                                    
                                    return (
                                        <button
                                            key={org.id}
                                            type="button"
                                            disabled={isFull}
                                            onClick={() => handleOrgSelect(org.id, 'join')}
                                            className={`
                                                p-2 rounded border text-left transition-all
                                                ${isFull 
                                                    ? 'opacity-40 cursor-not-allowed border-transparent bg-black/20' 
                                                    : 'hover:border-blue-500/40 hover:bg-blue-500/5'
                                                }
                                                ${isSelected 
                                                    ? 'border-blue-500 bg-blue-500/10' 
                                                    : 'border-ancient-gold/10 bg-black/20'
                                                }
                                            `}
                                        >
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <Icon 
                                                        name={draft.type === 'military_alliance' ? 'Shield' : 'Briefcase'} 
                                                        size={14} 
                                                        className={isSelected ? 'text-blue-400' : 'text-ancient-stone'} 
                                                    />
                                                    <span className="text-xs lg:text-xs font-medium text-ancient-parchment">
                                                        {org.name}
                                                    </span>
                                                </div>
                                                <span className="text-xs text-ancient-stone">
                                                    {memberCount}/{maxMembers} {t('common.members', '成员')}
                                                </span>
                                            </div>
                                            <div className="text-xs text-ancient-stone mt-1">
                                                {t('common.founder', '创始国')}: {getNationName(org.founderId)}
                                            </div>
                                            {isFull && (
                                                <div className="text-xs text-red-400 mt-1">
                                                    {t('negotiation.organizationFull', '组织已满员')}
                                                </div>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                    
                    {/* No organizations available - show hint */}
                    {playerOrganizations.length === 0 && targetOrganizations.length === 0 && sharedOrganizations.length === 0 && (
                        <div className="text-center py-3 px-2">
                            <div className="text-xs text-ancient-stone mb-2">
                                {t('negotiation.noOrganizations', '双方都没有可操作的组织')}
                            </div>
                            <div className="text-xs text-amber-400/80 bg-amber-900/20 border border-amber-500/20 rounded p-2">
                                <Icon name="Info" size={12} className="inline mr-1" />
                                {t('negotiation.createOrgHint', '如需创建新组织，请前往「国际组织」面板')}
                            </div>
                        </div>
                    )}
                    
                    {/* Selected Organization Summary */}
                    {draft.targetOrganizationId && draft.targetOrganizationId !== 'new' && (
                        <div className={`mt-2 p-2 rounded border ${draft.organizationMode === 'kick' ? 'bg-red-900/10 border-red-500/20' : 'bg-ancient-gold/5 border-ancient-gold/20'}`}>
                            <div className={`text-xs lg:text-xs flex items-center gap-1 ${draft.organizationMode === 'kick' ? 'text-red-400' : 'text-ancient-gold'}`}>
                                <Icon name={draft.organizationMode === 'kick' ? 'AlertTriangle' : 'CheckCircle'} size={12} />
                                {draft.organizationMode === 'invite' && t('negotiation.willInvite', '将邀请对方加入组织')}
                                {draft.organizationMode === 'join' && t('negotiation.willApply', '将申请加入对方组织')}
                                {draft.organizationMode === 'kick' && t('negotiation.willKick', '将把对方移除出组织')}
                            </div>
                        </div>
                    )}
                </Card>
            )}

            {/* Terms Details */}
            <Card className="p-2 lg:p-3 bg-ancient-ink/20 border-ancient-gold/10 space-y-2 lg:space-y-3">
                <div className="flex justify-between items-center text-xs lg:text-xs border-b border-ancient-gold/10 pb-1 lg:pb-2">
                    <span className="text-ancient-stone">{t('negotiation.signingCost', '签约成本')}</span>
                    <div className="flex items-center gap-1">
                        <span className={`font-mono text-xs lg:text-xs font-bold ${
                            canAffordSigningCost ? 'text-green-400' : 'text-red-400'
                        }`}>
                            {formatNumberShortCN(signingCost)}
                        </span>
                        <Icon name="Coins" size={10} className="text-amber-500" />
                    </div>
                </div>

                <div className="flex justify-between items-center text-xs lg:text-xs border-b border-ancient-gold/10 pb-1 lg:pb-2">
                    <span className="text-ancient-stone">{t('negotiation.duration', '持续时间')}</span>
                    <div className="flex items-center gap-1">
                        <Input
                            type="number"
                            min="30"
                            value={draft.durationDays}
                            onChange={(e) => !disabled && setDraft(prev => ({ ...prev, durationDays: Number(e.target.value) }))}
                            disabled={disabled}
                            className={`w-12 lg:w-16 h-5 lg:h-6 text-right font-mono text-xs lg:text-xs py-0 ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                        />
                        <span className="text-ancient-stone text-xs lg:text-xs">{t('common.days', '天')}</span>
                    </div>
                </div>

                <div className="flex justify-between items-center text-xs lg:text-xs">
                    <span className="text-ancient-stone">{t('negotiation.maintenance', '每日维护')}</span>
                    <div className="flex items-center gap-1">
                        <span className="font-mono text-xs lg:text-xs text-amber-400">{formatNumberShortCN(draft.maintenancePerDay)}</span>
                        <Icon name="Coins" size={10} className="text-amber-500" />
                        <span className="text-ancient-stone text-xs lg:text-xs">{t('common.perDay', '/日')}</span>
                    </div>
                </div>
            </Card>

            {/* Stance Selector */}
            <div className="mt-auto pt-1 lg:pt-2">
                <label className="text-xs lg:text-xs font-bold text-ancient-stone uppercase tracking-wider mb-1 lg:mb-2 block text-center">
                    {t('negotiation.stance', '谈判姿态')}
                </label>
                <div className="flex gap-1 bg-black/30 p-1 rounded-lg">
                    {[
                        { 
                            key: 'friendly', 
                            label: t('stance.friendly', '友善'), 
                            icon: 'Smile',
                            desc: t('stance.friendly.desc', '展现善意，需要良好关系才能提升成功率，但对方会提高要价'),
                            cost: '无成本',
                            guaranteed: '✓ 关系 +2, 声望 +1',
                            risk: '⚠️ 对方会要求更多补偿 (+30%)',
                            color: 'text-green-400',
                            bgColor: 'bg-green-500/10'
                        },
                        { 
                            key: 'normal', 
                            label: t('stance.normal', '中立'), 
                            icon: 'Info',
                            desc: t('stance.normal.desc', '标准谈判，无额外效果'),
                            cost: '无成本',
                            guaranteed: null,
                            risk: null,
                            color: 'text-ancient-stone',
                            bgColor: 'bg-white/5'
                        },
                        { 
                            key: 'aggressive', 
                            label: t('stance.aggressive', '施压'), 
                            icon: 'AlertCircle',
                            desc: t('stance.aggressive.desc', '利用实力或财力优势施压，提高成功率但降低关系和声誉'),
                            cost: '无成本',
                            guaranteed: '✗ 关系 -5, 声望 -2',
                            risk: '⚠️ 需要实力或财力优势，否则反效果',
                            color: 'text-orange-400',
                            bgColor: 'bg-orange-500/10'
                        }
                    ].map(({ key, label, icon, desc, cost, guaranteed, risk, color, bgColor }) => (
                        <FloatingTooltip 
                            key={key}
                            content={
                                <div className="space-y-2.5 min-w-[240px]">
                                    <div className={`font-bold text-sm ${color} pb-1 border-b border-ancient-stone/30`}>{label}</div>
                                    <div className="text-xs text-ancient-parchment leading-relaxed">{desc}</div>
                                    <div className="pt-2 border-t border-ancient-stone/20 space-y-2">
                                        <div className="flex items-start gap-2">
                                            <span className="text-xs">💰</span>
                                            <div className="flex-1">
                                                <div className="text-xs text-ancient-stone/80 mb-0.5">预先成本:</div>
                                                <div className={`text-xs font-semibold ${cost === '无成本' ? 'text-green-400' : 'text-yellow-400'}`}>
                                                    {cost}
                                                </div>
                                            </div>
                                        </div>
                                        {guaranteed && (
                                            <div className="flex items-start gap-2">
                                                <span className="text-xs">📋</span>
                                                <div className="flex-1">
                                                    <div className="text-xs text-ancient-stone/80 mb-0.5">确定后果:</div>
                                                    <div className="text-xs text-blue-400 font-semibold leading-relaxed">
                                                        {guaranteed}
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                        {risk && (
                                            <div className="flex items-start gap-2">
                                                <span className="text-xs">⚡</span>
                                                <div className="flex-1">
                                                    <div className="text-xs text-ancient-stone/80 mb-0.5">危险后果:</div>
                                                    <div className="text-xs text-red-400 font-semibold leading-relaxed">
                                                        {risk}
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            }
                        >                            <button
                                type="button"
                                onClick={() => !disabled && setDraft(prev => ({ ...prev, stance: key }))}
                                disabled={disabled}
                                className={`
                                    flex-1 py-1.5 lg:py-2 px-1 lg:px-2 rounded-lg flex flex-col items-center gap-1 transition-all relative
                                    ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
                                    ${draft.stance === key
                                        ? `${bgColor} ${color} shadow-lg border-2 border-current ring-2 ring-current/20`
                                        : 'text-ancient-stone/70 hover:bg-white/10 hover:text-ancient-parchment border-2 border-transparent'
                                    }
                                `}
                            >
                                <Icon name={icon} size={16} className="lg:hidden" />
                                <Icon name={icon} size={18} className="hidden lg:block" />
                                <span className="text-xs lg:text-xs font-bold whitespace-nowrap">{label}</span>
                                {cost !== '无成本' && (
                                    <span className={`text-xs lg:text-xs font-semibold ${draft.stance === key ? 'text-yellow-300' : 'text-yellow-500/60'}`}>
                                        {cost}
                                    </span>
                                )}
                            </button>
                        </FloatingTooltip>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default TreatyTerms;
