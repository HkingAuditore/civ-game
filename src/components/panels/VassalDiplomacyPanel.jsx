/**
 * 附庸外交审批与指令面板
 * 显示附庸外交审批队列，并允许玩家下达外交指令
 */

import React, { memo, useMemo, useState } from 'react';
import { BottomSheet } from '../tabs/BottomSheet';
import { Icon } from '../common/UIComponents';
import { Button } from '../common/UnifiedUI';

const ACTION_LABELS = {
    trade: '贸易协定',
    declare_war: '宣战',
    propose_peace: '媾和',
    join_org: '加入组织',
    leave_org: '退出组织',
    join_alliance: '加入同盟',
    create_alliance: '建立同盟',
    create_economic_bloc: '建立经济同盟',
    alliance: '结盟意向',
};

const ORDER_ACTIONS = [
    { id: 'declare_war', label: '宣战' },
    { id: 'propose_peace', label: '媾和' },
    { id: 'trade', label: '贸易协定' },
    { id: 'create_alliance', label: '建立同盟' },
    { id: 'create_economic_bloc', label: '建立经济同盟' },
];

export const VassalDiplomacyPanel = memo(({
    isOpen,
    onClose,
    nations = [],
    queue = [],
    history = [],
    currentDay = 0,
    onApprove,
    onReject,
    onIssueOrder,
}) => {
    const vassals = useMemo(() => nations.filter(n => n.vassalOf === 'player'), [nations]);
    const pendingRequests = useMemo(
        () => (queue || []).filter(item => item && item.status === 'pending'),
        [queue]
    );

    const [selectedVassalId, setSelectedVassalId] = useState('');
    const [selectedAction, setSelectedAction] = useState('declare_war');
    const [selectedTargetId, setSelectedTargetId] = useState('');

    const selectedVassal = vassals.find(v => v.id === selectedVassalId) || null;
    const availableTargets = useMemo(() => {
        if (!selectedVassal) return [];
        return nations.filter(n => n.id !== selectedVassal.id && !n.isAnnexed);
    }, [nations, selectedVassal]);

    const warTargets = useMemo(() => {
        if (!selectedVassal || !selectedVassal.foreignWars) return [];
        return Object.entries(selectedVassal.foreignWars)
            .filter(([, war]) => war?.isAtWar)
            .map(([enemyId]) => nations.find(n => n.id === enemyId))
            .filter(Boolean);
    }, [nations, selectedVassal]);

    const handleIssueOrder = () => {
        if (!selectedVassal || !onIssueOrder) return;
        const needsTarget = ['declare_war', 'trade', 'propose_peace'].includes(selectedAction);
        if (needsTarget && !selectedTargetId) return;
        const payload = {};
        if (selectedTargetId) {
            payload.targetId = selectedTargetId;
        }
        if (selectedAction === 'propose_peace' && selectedTargetId) {
            payload.targetId = selectedTargetId;
        }
        onIssueOrder(selectedVassal.id, selectedAction, payload);
    };
    const canIssue = !!selectedVassal && (!['declare_war', 'trade', 'propose_peace'].includes(selectedAction) || !!selectedTargetId);

    return (
        <BottomSheet isOpen={isOpen} onClose={onClose} title="📜 附庸外交中心">
            <div className="space-y-4">
                <div className="bg-gray-800/40 border border-gray-700/40 rounded-lg p-3">
                    <div className="flex items-center gap-2 text-sm text-gray-300 mb-2">
                        <Icon name="ClipboardList" size={14} className="text-amber-400" />
                        待审批请求
                        <span className="text-xs text-gray-500">({pendingRequests.length})</span>
                    </div>
                    {pendingRequests.length > 0 ? (
                        <div className="space-y-2">
                            {pendingRequests.map(item => (
                                <div key={item.id} className="border border-gray-700/50 rounded-lg p-3 bg-gray-900/40">
                                    <div className="flex items-center justify-between">
                                        <div className="text-sm font-semibold text-white">
                                            {item.vassalName || '附庸国'} · {ACTION_LABELS[item.actionType] || item.actionType}
                                        </div>
                                        <div className="text-[10px] text-gray-400">
                                            {item.expiresAt != null ? `剩余 ${Math.max(0, item.expiresAt - currentDay)} 天` : '长期有效'}
                                        </div>
                                    </div>
                                    <div className="text-xs text-gray-400 mt-1">
                                        目标：{item.targetName || item.payload?.orgName || '未知'}
                                    </div>
                                    <div className="mt-2 flex gap-2">
                                        <Button size="sm" variant="primary" onClick={() => onApprove?.(item.id)}>
                                            批准
                                        </Button>
                                        <Button size="sm" variant="secondary" onClick={() => onReject?.(item.id, '玩家拒绝')}>
                                            拒绝
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-xs text-gray-500">暂无待审批请求。</div>
                    )}
                </div>

                <div className="bg-gray-800/40 border border-gray-700/40 rounded-lg p-3">
                    <div className="flex items-center gap-2 text-sm text-gray-300 mb-2">
                        <Icon name="ScrollText" size={14} className="text-blue-400" />
                        下达外交指令
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                        <div>
                            <div className="text-[10px] text-gray-500 mb-1">附庸国</div>
                            <select
                                value={selectedVassalId}
                                onChange={(e) => setSelectedVassalId(e.target.value)}
                                className="w-full bg-gray-900/60 border border-gray-700/60 rounded px-2 py-1 text-gray-200"
                            >
                                <option value="">选择附庸</option>
                                {vassals.map(vassal => (
                                    <option key={vassal.id} value={vassal.id}>{vassal.name}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <div className="text-[10px] text-gray-500 mb-1">指令类型</div>
                            <select
                                value={selectedAction}
                                onChange={(e) => setSelectedAction(e.target.value)}
                                className="w-full bg-gray-900/60 border border-gray-700/60 rounded px-2 py-1 text-gray-200"
                            >
                                {ORDER_ACTIONS.map(action => (
                                    <option key={action.id} value={action.id}>{action.label}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <div className="text-[10px] text-gray-500 mb-1">目标国家</div>
                            <select
                                value={selectedTargetId}
                                onChange={(e) => setSelectedTargetId(e.target.value)}
                                className="w-full bg-gray-900/60 border border-gray-700/60 rounded px-2 py-1 text-gray-200"
                            >
                                <option value="">选择目标</option>
                                {(selectedAction === 'propose_peace' ? warTargets : availableTargets).map(target => (
                                    <option key={target.id} value={target.id}>{target.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <div className="mt-3">
                        <Button size="sm" variant="primary" onClick={handleIssueOrder} disabled={!canIssue}>
                            执行指令
                        </Button>
                    </div>
                </div>

                <div className="bg-gray-800/40 border border-gray-700/40 rounded-lg p-3">
                    <div className="flex items-center gap-2 text-sm text-gray-300 mb-2">
                        <Icon name="History" size={14} className="text-gray-400" />
                        最近处理记录
                    </div>
                    {history.length > 0 ? (
                        <div className="space-y-2 text-xs text-gray-400">
                            {history.slice(0, 5).map(item => (
                                <div key={item.id} className="flex items-center justify-between">
                                    <span>{item.vassalName || '附庸国'} · {ACTION_LABELS[item.actionType] || item.actionType}</span>
                                    <span className="text-[10px] text-gray-500">{item.status}</span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-xs text-gray-500">暂无记录。</div>
                    )}
                </div>
            </div>
        </BottomSheet>
    );
});

VassalDiplomacyPanel.displayName = 'VassalDiplomacyPanel';

export default VassalDiplomacyPanel;
