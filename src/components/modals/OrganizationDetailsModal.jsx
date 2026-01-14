import React, { useMemo } from 'react';
import { Icon } from '../common/UIComponents';
import { Card, Button, Modal } from '../common/UnifiedUI';
import { ORGANIZATION_TYPE_CONFIGS, getOrganizationEffectDescriptions } from '../../logic/diplomacy/organizationDiplomacy';

const OrganizationDetailsModal = ({
    isOpen,
    onClose,
    organization,
    nations = [],
    playerNationId = 'player',
    onJoin,
    onLeave,
    isDiplomacyUnlocked
}) => {
    if (!organization) return null;

    const config = ORGANIZATION_TYPE_CONFIGS[organization.type];
    const isMember = organization.members.includes(playerNationId);

    // Calculate if player can join if not a member
    const canJoin = useMemo(() => {
        if (isMember) return false;
        // Basic check, more complex logic handled by parent or API, 
        // but we can disable if membership full or other obvious blocks if data available
        if (config && organization.members.length >= config.maxMembers) return false;
        return true;
    }, [isMember, config, organization]);

    const memberList = useMemo(() => {
        return organization.members.map(memberId => {
            if (memberId === playerNationId) {
                return {
                    id: playerNationId,
                    name: '你的国家',
                    isPlayer: true,
                    isFounder: memberId === organization.founderId,
                    relation: 0
                };
            }
            const nation = nations.find(n => n.id === memberId);
            return {
                id: memberId,
                name: nation?.name || '未知国家',
                isPlayer: false,
                isFounder: memberId === organization.founderId,
                relation: nation?.relation || 0,
            };
        });
    }, [organization.members, nations, playerNationId, organization.founderId]);

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
                            {memberList.find(m => m.isFounder)?.name || '未知'}
                        </div>
                        <div className="text-ancient-stone text-xs mt-2">
                            成立已 {Math.floor(organization.createdDay || 0)} 天
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
                            成员国 ({memberList.length}/{config?.maxMembers})
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

                {/* Actions */}
                <div className="flex justify-end gap-3 pt-4 border-t border-ancient-gold/10">
                    <Button variant="ghost" onClick={onClose}>
                        关闭
                    </Button>

                    {isMember ? (
                        <Button
                            variant="danger"
                            onClick={() => {
                                onLeave && onLeave(organization.id);
                                onClose();
                            }}
                        >
                            退出组织
                        </Button>
                    ) : (
                        <Button
                            variant="primary"
                            disabled={!canJoin}
                            onClick={() => {
                                onJoin && onJoin(organization.id);
                                onClose();
                            }}
                        >
                            申请加入
                        </Button>
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
