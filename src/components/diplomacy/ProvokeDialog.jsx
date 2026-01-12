import React, { useState } from 'react';
import { Modal } from '../common/UnifiedUI';
import { Icon } from '../common/UIComponents';
import { calculateProvokeCost } from '../../utils/diplomaticUtils';

// Relation info helper (duplicated from DiplomacyTab for independence)
const relationInfo = (relation = 0, isAllied = false) => {
    if (isAllied) return { label: '盟友', color: 'text-green-300', bg: 'bg-green-900/20' };
    if (relation >= 80) return { label: '亲密', color: 'text-emerald-300', bg: 'bg-emerald-900/20' };
    if (relation >= 60) return { label: '友好', color: 'text-blue-300', bg: 'bg-blue-900/20' };
    if (relation >= 40) return { label: '中立', color: 'text-gray-300', bg: 'bg-gray-800/40' };
    if (relation >= 20) return { label: '冷淡', color: 'text-yellow-300', bg: 'bg-yellow-900/20' };
    return { label: '敌对', color: 'text-red-300', bg: 'bg-red-900/20' };
};

const ProvokeDialog = ({
    isOpen,
    onClose,
    selectedNation,
    onConfirm,
    provokeTargetNations = [],
    playerWealth = 0
}) => {
    const [selectedTargetId, setSelectedTargetId] = useState(null);

    const handleConfirm = () => {
        if (selectedTargetId) {
            onConfirm(selectedTargetId);
            setSelectedTargetId(null);
        }
    };

    const handleClose = () => {
        setSelectedTargetId(null);
        onClose();
    };

    const cost = calculateProvokeCost(playerWealth, selectedNation?.wealth || 0);

    return (
        <Modal
            isOpen={isOpen}
            onClose={handleClose}
            title={`挑拨 ${selectedNation?.name || ''} 的关系`}
            footer={
                <div className="flex gap-2 justify-end">
                    <button
                        className="px-3 py-1.5 bg-gray-600 hover:bg-gray-500 rounded text-white text-sm font-body"
                        onClick={handleClose}
                    >
                        取消
                    </button>
                    <button
                        className={`px-3 py-1.5 rounded text-white text-sm font-body ${selectedTargetId
                            ? 'bg-indigo-600 hover:bg-indigo-500'
                            : 'bg-gray-500 cursor-not-allowed'
                            }`}
                        onClick={handleConfirm}
                        disabled={!selectedTargetId}
                    >
                        确认挑拨 ({cost}银币)
                    </button>
                </div>
            }
        >
            <div className="space-y-2">
                <p className="text-sm text-gray-300 font-body mb-3">
                    选择要离间的目标国家。挑拨成功后，{selectedNation?.name} 与目标国家的关系将会恶化。
                </p>
                <div className="max-h-[50vh] overflow-y-auto space-y-1 scrollbar-thin scrollbar-thumb-gray-600">
                    {provokeTargetNations.map(nation => {
                        const nationRelation = relationInfo(nation.relation || 0, nation.alliedWithPlayer === true);
                        const foreignRelation = selectedNation?.foreignRelations?.[nation.id] ?? 50;
                        // Check if these two AI nations are formally allied
                        const areAllied = (selectedNation?.allies || []).includes(nation.id) ||
                            (nation.allies || []).includes(selectedNation?.id);

                        const foreignRelationInfo = (() => {
                            if (areAllied) return { label: '盟友', color: 'text-green-300' };
                            if (foreignRelation >= 80) return { label: '亲密', color: 'text-emerald-300' };
                            if (foreignRelation >= 60) return { label: '友好', color: 'text-blue-300' };
                            if (foreignRelation >= 40) return { label: '中立', color: 'text-gray-300' };
                            if (foreignRelation >= 20) return { label: '冷淡', color: 'text-yellow-300' };
                            return { label: '敌对', color: 'text-red-300' };
                        })();

                        return (
                            <button
                                key={nation.id}
                                onClick={() => setSelectedTargetId(nation.id)}
                                className={`w-full flex items-center justify-between p-2 rounded border transition-colors ${selectedTargetId === nation.id
                                    ? 'bg-indigo-900/50 border-indigo-500'
                                    : 'bg-gray-800/60 border-gray-700 hover:bg-gray-700/60'
                                    }`}
                            >
                                <div className="flex items-center gap-2">
                                    <Icon name="Flag" size={14} className={nation.color || 'text-gray-300'} />
                                    <span className="text-sm text-white font-body">{nation.name}</span>
                                    <span className={`text-[10px] px-1 py-0.5 rounded ${nationRelation.bg} ${nationRelation.color}`}>
                                        与你:{nationRelation.label}
                                    </span>
                                </div>
                                <div className="flex items-center gap-1 text-[10px]">
                                    <span className="text-gray-400">两国关系:</span>
                                    <span className={foreignRelationInfo.color}>{foreignRelationInfo.label}</span>
                                    <span className="text-gray-500">({Math.round(foreignRelation)})</span>
                                </div>
                            </button>
                        );
                    })}
                </div>
                {provokeTargetNations.length === 0 && (
                    <p className="text-sm text-gray-400 text-center py-4 font-body">
                        没有其他可选择的国家
                    </p>
                )}
            </div>
        </Modal>
    );
};

export default ProvokeDialog;
