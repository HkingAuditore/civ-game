import React, { useState, useEffect, useMemo } from 'react';
import { Modal, Button, Input } from '../common/UnifiedUI';
import { Icon } from '../common/UIComponents';
import { ORGANIZATION_TYPE_CONFIGS, calculateCreateOrganizationCost, getOrganizationMaxMembers } from '../../logic/diplomacy/organizationDiplomacy';

export const CreateOrganizationModal = ({
    isOpen,
    onClose,
    orgType,
    onCreate,
    silver = 0, // Player's current silver
    epoch = 0,  // Current era for max members calculation
    defaultName = ''
}) => {
    const [name, setName] = useState(defaultName);

    useEffect(() => {
        if (isOpen) {
            setName(defaultName || (orgType?.name ? `New ${orgType.name}` : 'New Organization'));
        }
    }, [isOpen, defaultName, orgType]);

    // Calculate creation cost
    const createCost = useMemo(() => {
        if (!orgType?.type) return 0;
        return calculateCreateOrganizationCost(orgType.type, silver);
    }, [orgType?.type, silver]);

    const canAfford = silver >= createCost;
    const config = orgType?.type ? ORGANIZATION_TYPE_CONFIGS[orgType.type] : null;

    const handleSubmit = () => {
        if (!name.trim() || !canAfford) return;
        onCreate(name);
        onClose();
    };

    if (!orgType) return null;

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={`建立${orgType.name}`}
            size="sm"
            footer={
                <div className="flex justify-end gap-2">
                    <Button variant="secondary" onClick={onClose}>
                        取消
                    </Button>
                    <Button
                        variant="primary"
                        onClick={handleSubmit}
                        disabled={!name.trim() || !canAfford}
                        title={!canAfford ? `需要 ${createCost.toLocaleString()} 银币` : ''}
                    >
                        {canAfford ? '建立' : '资金不足'}
                    </Button>
                </div>
            }
        >
            <div className="space-y-4">
                <p className="text-ancient-stone text-sm">
                    请为即将建立的{orgType.name}命名。一个响亮的名字有助于提升组织的威望。
                </p>

                <div className="space-y-2">
                    <label className="text-xs font-bold text-ancient-gold uppercase tracking-wider">
                        组织名称
                    </label>
                    <Input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="请输入组织名称..."
                        autoFocus
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && name.trim() && canAfford) {
                                handleSubmit();
                            }
                        }}
                    />
                </div>

                {/* Creation Cost */}
                <div className={`p-3 rounded border ${canAfford ? 'bg-amber-900/20 border-amber-500/30' : 'bg-red-900/20 border-red-500/30'}`}>
                    <h4 className={`text-xs font-bold mb-2 flex items-center gap-2 ${canAfford ? 'text-amber-400' : 'text-red-400'}`}>
                        <Icon name="Coins" size={14} />
                        创建成本
                    </h4>
                    <div className="flex justify-between items-center text-sm">
                        <span className="text-ancient-stone">所需银币：</span>
                        <span className={`font-bold ${canAfford ? 'text-ancient-parchment' : 'text-red-400'}`}>
                            {createCost.toLocaleString()} 银币
                        </span>
                    </div>
                    <div className="flex justify-between items-center text-sm mt-1">
                        <span className="text-ancient-stone">当前银币：</span>
                        <span className="text-ancient-parchment font-mono">{Math.floor(silver).toLocaleString()}</span>
                    </div>
                    {config && (
                        <div className="text-xs text-ancient-stone/70 mt-2">
                            创建费用为当前财富的 {(config.createCost * 100).toFixed(0)}%
                        </div>
                    )}
                </div>

                {/* Requirements */}
                {config && (
                    <div className="p-3 rounded bg-blue-900/20 border border-blue-500/30">
                        <h4 className="text-xs font-bold text-blue-400 mb-2 flex items-center gap-2">
                            <Icon name="Info" size={14} />
                            组织要求
                        </h4>
                        <div className="space-y-1 text-xs text-ancient-stone">
                            <div>• 最低关系要求：{config.minRelation}（邀请成员时）</div>
                            <div>• 当前时代成员上限：{getOrganizationMaxMembers(config.id, epoch)} 国</div>
                            <div>• 成员费：每月财富 × {(config.memberFee * 100).toFixed(1)}%</div>
                        </div>
                    </div>
                )}

                <div className="p-3 rounded bg-ancient-ink/30 border border-ancient-gold/10">
                    <h4 className="text-xs font-bold text-ancient-stone mb-1">组织效果预览：</h4>
                    <p className="text-xs text-ancient-stone/70 leading-relaxed">
                        {orgType.desc}
                    </p>
                </div>
            </div>
        </Modal>
    );
};
