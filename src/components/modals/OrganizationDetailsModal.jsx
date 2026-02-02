import React, { useMemo } from 'react';
import { Icon } from '../common/UIComponents';
import { Card, Button, Modal } from '../common/UnifiedUI';
import { ORGANIZATION_TYPE_CONFIGS, getOrganizationEffectDescriptions, calculateLeaveOrganizationCost, getOrganizationMaxMembers } from '../../logic/diplomacy/organizationDiplomacy';

const OrganizationDetailsModal = ({
    isOpen,
    onClose,
    organization,
    nations = [],
    playerNationId = 'player',
    empireName = '我的帝国', // 玩家帝国名称
    silver = 0, // Player's current silver for cost calculation
    epoch = 0,  // Current era for max members calculation
    daysElapsed = 0, // Current game days for calculating organization age
    onLeave,
    onNegotiateWithFounder, // New: callback to open negotiation with founder
    isDiplomacyUnlocked
}) => {
    if (!organization) return null;

    const config = ORGANIZATION_TYPE_CONFIGS[organization.type];
    const isMember = organization.members.includes(playerNationId);
    const isFounder = organization.founderId === playerNationId;

    // Calculate leave cost if player is a member
    const leaveCostInfo = useMemo(() => {
        if (!isMember) return null;
        return calculateLeaveOrganizationCost(organization, playerNationId, silver);
    }, [isMember, organization, playerNationId, silver]);

    // Find the founder nation for negotiation
    const founderNation = useMemo(() => {
        if (!organization.founderId || organization.founderId === 'player') return null;
        return nations.find(n => n.id === organization.founderId);
    }, [organization.founderId, nations]);

    // Get founder name (even if they left the organization)
    const founderName = useMemo(() => {
        if (!organization.founderId) {
            // Fallback: try to find founder from members list
            const founderMember = organization.members?.[0];
            if (founderMember === playerNationId) return empireName;
            const nation = nations.find(n => n.id === founderMember);
            return nation?.name || '未知国家（已消亡）';
        }
        if (organization.founderId === playerNationId) return empireName;
        const founder = nations.find(n => n.id === organization.founderId);
        return founder?.name || `未知国家（ID: ${organization.founderId.slice(0, 8)}）`;
    }, [organization.founderId, organization.members, nations, playerNationId, empireName]);

    const memberList = useMemo(() => {
        return organization.members.map(memberId => {
            if (memberId === playerNationId) {
                return {
                    id: playerNationId,
                    name: empireName,
                    isPlayer: true,
                    isFounder: memberId === (organization.founderId || organization.leaderId),
                    relation: 0
                };
            }
            const nation = nations.find(n => n.id === memberId);
            return {
                id: memberId,
                name: nation?.name || '未知国家',
                isPlayer: false,
                isFounder: memberId === (organization.founderId || organization.leaderId),
                relation: nation?.relation || 0,
            };
        });
    }, [organization.members, nations, playerNationId, organization.founderId, organization.leaderId, empireName]);

    const effects = useMemo(() => {
        return getOrganizationEffectDescriptions(organization.type);
    }, [organization.type]);

    const relationInfoHelper = (relation) => {
        if (relation >= 80) return { label: '亲密', color: 'text-emerald-300' };
        if (relation >= 60) return { label: '友好', color: 'text-blue-300' };
        if (relation >= 40) return { label: '中立', color: 'text-gray-300' };
        if (relation >= 20) return { label: '冷淡', color: 'text-yellow-300' };
        return { label: '敌对', color: 'text-red-300' };
    };

    const canAffordLeave = leaveCostInfo ? silver >= leaveCostInfo.cost : true;

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={
                <div className="flex items-center gap-2">
                    <Icon name={getOrgIcon(organization.type)} size={24} className="text-ancient-gold" />
                    <span>{organization.name}</span>
                </div>
            }
            size="lg"
            containerClassName="max-w-2xl"
        >
            <div className="space-y-6">
                {/* Header Info */}
                <div className="bg-ancient-ink/40 p-4 rounded-lg border border-ancient-gold/20 flex justify-between items-start">
                    <div>
                        <div className="text-ancient-stone text-xs uppercase tracking-wider mb-1">组织类型</div>
                        <div className="text-ancient-parchment font-bold text-lg mb-2">{config?.name || organization.type}</div>
                        <div className="text-ancient-stone text-sm">{config?.description}</div>
                    </div>
                    <div className="text-right">
                        <div className="text-ancient-stone text-xs uppercase tracking-wider mb-1">创始人</div>
                        <div className="text-ancient-gold font-bold">
                            {founderName}
                        </div>
                        <div className="text-ancient-stone text-xs mt-2">
                            成立已 {Math.max(0, Math.floor(daysElapsed - (organization.createdDay || 0)))} 天
                        </div>
                    </div>
                </div>

                {/* Effects Section */}
                <div>
                    <h3 className="text-ancient-parchment font-bold text-sm uppercase tracking-wider mb-3 flex items-center gap-2">
                        <Icon name="Sparkles" size={16} className="text-ancient-gold" />
                        组织效力
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {effects.length > 0 ? (
                            effects.map((effect, idx) => (
                                <div key={idx} className="bg-ancient-ink/30 border border-ancient-gold/10 p-2 rounded flex items-center gap-2">
                                    <Icon name="CheckCircle" size={14} className="text-green-400" />
                                    <span className="text-ancient-parchment text-sm">{effect}</span>
                                </div>
                            ))
                        ) : (
                            <div className="text-ancient-stone italic text-sm">暂无明显效果</div>
                        )}
                    </div>
                </div>

                {/* Members Section */}
                <div>
                    <div className="flex justify-between items-end mb-3">
                        <h3 className="text-ancient-parchment font-bold text-sm uppercase tracking-wider flex items-center gap-2">
                            <Icon name="Users" size={16} className="text-ancient-gold" />
                            成员国 ({memberList.length}/{getOrganizationMaxMembers(organization.type, epoch)})
                        </h3>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-60 overflow-y-auto pr-1">
                        {memberList.map(member => {
                            const rInfo = relationInfoHelper(member.relation);
                            return (
                                <div key={member.id} className={`
                                    flex items-center justify-between p-2 rounded border
                                    ${member.isPlayer ? 'bg-ancient-gold/10 border-ancient-gold/40' : 'bg-ancient-ink/20 border-white/5'}
                                `}>
                                    <div className="flex items-center gap-2">
                                        <div className="w-6 h-6 rounded-full bg-ancient-stone/20 flex items-center justify-center border border-ancient-stone/30 text-xs font-bold text-ancient-parchment">
                                            {member.name.charAt(0)}
                                        </div>
                                        <div>
                                            <div className="text-sm font-medium text-ancient-parchment flex items-center gap-1">
                                                {member.name}
                                                {member.isFounder && (
                                                    <Icon name="Crown" size={12} className="text-amber-400" />
                                                )}
                                                {member.isPlayer && (
                                                    <span className="text-[10px] bg-ancient-gold/20 text-ancient-gold px-1 rounded ml-1">你</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    {!member.isPlayer && (
                                        <div className={`text-xs px-2 py-0.5 rounded bg-black/30 ${rInfo.color}`}>
                                            {rInfo.label}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Leave Cost Warning (for members) */}
                {isMember && leaveCostInfo && (
                    <div className={`p-4 rounded-lg border ${isFounder ? 'bg-red-900/20 border-red-500/30' : 'bg-amber-900/20 border-amber-500/30'}`}>
                        <h4 className={`font-bold text-sm mb-2 flex items-center gap-2 ${isFounder ? 'text-red-400' : 'text-amber-400'}`}>
                            <Icon name={isFounder ? 'AlertTriangle' : 'Info'} size={16} />
                            退出须知
                        </h4>
                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between items-center">
                                <span className="text-ancient-stone">退出违约金：</span>
                                <span className={`font-bold ${canAffordLeave ? 'text-ancient-parchment' : 'text-red-400'}`}>
                                    {leaveCostInfo.cost.toLocaleString()} 银币
                                    {!canAffordLeave && <span className="text-xs ml-1">(不足)</span>}
                                </span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-ancient-stone">关系惩罚：</span>
                                <span className="text-red-400 font-bold">{leaveCostInfo.relationPenalty} (对所有成员)</span>
                            </div>
                            {leaveCostInfo.willDisband && (
                                <div className="mt-2 p-2 bg-red-900/30 rounded border border-red-500/40 text-red-300 text-xs">
                                    <Icon name="AlertOctagon" size={14} className="inline mr-1" />
                                    <strong>警告：</strong>作为创始国退出将导致组织<strong>解散</strong>！所有成员将受到外交惩罚。
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Non-member info */}
                {!isMember && (
                    <div className="p-4 rounded-lg border bg-blue-900/20 border-blue-500/30">
                        <h4 className="font-bold text-sm mb-2 flex items-center gap-2 text-blue-400">
                            <Icon name="Info" size={16} />
                            如何加入
                        </h4>
                        <div className="mt-4">
                            <div className="text-ancient-stone font-bold mb-2">如何加入</div>
                            <div className="text-xs text-ancient-stone space-y-2">
                                <div>
                                    加入国际组织需要通过外交谈判。请前往创始国的外交界面，选择"军事同盟"或"经济共同体"条约类型，然后选择"申请加入该组织"。
                                </div>

                                {organization?.type === 'economic_bloc' && (
                                    <div className="rounded border border-amber-500/30 bg-black/30 p-2">
                                        <div className="font-semibold text-amber-300 mb-1">经济共同体（方案B：高门槛但写清楚）</div>
                                        <div>• 硬门槛：与创始国关系需达到 <span className="text-amber-200 font-mono">75</span>（未达标会直接被阻止，或通过率极低）</div>
                                        <div>• 时代门槛：需要解锁经济共同体（Era 5+）</div>
                                        <div>• 战争限制：对方处于战争中时无法谈判</div>
                                        <div>• 附庸限制：若你是“傀儡附庸/外交受控”，则不能独立申请加入组织</div>
                                        <div className="mt-1 text-[11px] text-ancient-stone">
                                            提示：实际是否满足门槛，以谈判面板里显示的“关系需达到 75（当前 X）”为准。
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Actions */}
                <div className="flex justify-end gap-3 pt-4 border-t border-ancient-gold/10">
                    <Button variant="ghost" onClick={onClose}>
                        关闭
                    </Button>

                    {isMember ? (
                        <Button
                            variant="danger"
                            disabled={!canAffordLeave}
                            onClick={() => {
                                if (leaveCostInfo?.willDisband) {
                                    // Could add a confirmation dialog here
                                    if (!window.confirm(`作为创始国退出将解散 ${organization.name}！确定要继续吗？`)) {
                                        return;
                                    }
                                }
                                onLeave && onLeave(organization.id);
                                onClose();
                            }}
                            title={!canAffordLeave ? `需要 ${leaveCostInfo?.cost?.toLocaleString()} 银币` : ''}
                        >
                            <Icon name={leaveCostInfo?.willDisband ? 'Trash2' : 'LogOut'} size={16} className="mr-1" />
                            {leaveCostInfo?.willDisband ? '解散组织' : '退出组织'}
                        </Button>
                    ) : (
                        <>
                            {founderNation && onNegotiateWithFounder ? (
                                <Button
                                    variant="primary"
                                    onClick={() => {
                                        onNegotiateWithFounder(founderNation, organization);
                                        onClose();
                                    }}
                                >
                                    <Icon name="MessageSquare" size={16} className="mr-1" />
                                    与创始国谈判
                                </Button>
                            ) : (
                                <div className="text-red-400 text-sm flex items-center gap-2">
                                    <Icon name="AlertCircle" size={16} />
                                    <span>创始国不存在或已消亡，无法加入此组织</span>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </Modal>
    );
};

// Helper for icon mapping
const getOrgIcon = (type) => {
    switch (type) {
        case 'military_alliance': return 'Shield';
        case 'economic_bloc': return 'TrendingUp';
        default: return 'Flag';
    }
};

export default OrganizationDetailsModal;
