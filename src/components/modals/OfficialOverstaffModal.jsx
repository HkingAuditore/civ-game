import React, { useState } from 'react';
import { Icon } from '../common/UIComponents';
import { STRATA } from '../../config/strata';

/**
 * 官员超编强制解雇弹窗
 * 当官员数量超过容量上限时强制用户解雇官员
 */
const OfficialOverstaffModal = ({
    officials = [],
    currentCount,
    maxCapacity,
    onFireOfficial,
    onClose, // 只有解雇足够官员后才能关闭
}) => {
    const [selectedIds, setSelectedIds] = useState(new Set());
    const excessCount = currentCount - maxCapacity;
    const needToFire = excessCount - selectedIds.size;
    const canClose = needToFire <= 0;

    const toggleSelection = (id) => {
        const next = new Set(selectedIds);
        if (next.has(id)) {
            next.delete(id);
        } else {
            next.add(id);
        }
        setSelectedIds(next);
    };

    const handleConfirm = () => {
        if (!canClose) return;
        // 解雇所有选中的官员
        selectedIds.forEach(id => {
            onFireOfficial(id);
        });
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[9999]">
            <div className="bg-gray-900 border-2 border-red-500/50 rounded-lg p-6 max-w-lg w-full mx-4 shadow-2xl">
                {/* 标题 */}
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-red-500/20 rounded-full flex items-center justify-center">
                        <Icon name="UserMinus" size={20} className="text-red-400" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-red-400">官员编制超额</h2>
                        <p className="text-sm text-gray-400">必须解雇部分官员以符合新的编制限制</p>
                    </div>
                </div>

                {/* 说明 */}
                <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4 mb-4">
                    <p className="text-sm text-gray-300">
                        由于政体变更或其他原因，官员编制从 <span className="text-white font-bold">{currentCount}</span> 人
                        降低至 <span className="text-white font-bold">{maxCapacity}</span> 人。
                    </p>
                    <p className="text-sm text-red-400 mt-2">
                        您需要解雇 <span className="font-bold">{excessCount}</span> 名官员。
                        {needToFire > 0 ? (
                            <span className="ml-1">还需选择 <span className="font-bold">{needToFire}</span> 人</span>
                        ) : (
                            <span className="ml-1 text-green-400">已选择足够官员</span>
                        )}
                    </p>
                </div>

                {/* 官员列表 */}
                <div className="space-y-2 max-h-64 overflow-y-auto mb-4">
                    {officials.map(official => {
                        const isSelected = selectedIds.has(official.id);
                        const stratumInfo = STRATA[official.sourceStratum];

                        return (
                            <div
                                key={official.id}
                                className={`
                                    flex items-center justify-between p-3 rounded-lg cursor-pointer
                                    transition-all duration-200
                                    ${isSelected
                                        ? 'bg-red-900/40 border-2 border-red-500'
                                        : 'bg-gray-800 border border-gray-700 hover:border-gray-500'
                                    }
                                `}
                                onClick={() => toggleSelection(official.id)}
                            >
                                <div className="flex items-center gap-3">
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isSelected ? 'bg-red-500' : 'bg-gray-700'
                                        }`}>
                                        {isSelected ? (
                                            <Icon name="Check" size={16} className="text-white" />
                                        ) : (
                                            <Icon name={stratumInfo?.icon || 'User'} size={16} className="text-gray-400" />
                                        )}
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium text-white">{official.name}</p>
                                        <p className="text-xs text-gray-400">
                                            {stratumInfo?.name || official.sourceStratum} · 俸禄 {official.salary}/日
                                        </p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className={`text-xs ${isSelected ? 'text-red-400' : 'text-gray-500'}`}>
                                        {isSelected ? '将被解雇' : '点击选择'}
                                    </p>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* 确认按钮 */}
                <button
                    onClick={handleConfirm}
                    disabled={!canClose}
                    className={`
                        w-full py-3 rounded-lg font-medium transition-all
                        ${canClose
                            ? 'bg-red-600 hover:bg-red-500 text-white cursor-pointer'
                            : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                        }
                    `}
                >
                    {canClose ? (
                        <span className="flex items-center justify-center gap-2">
                            <Icon name="UserMinus" size={16} />
                            确认解雇 {selectedIds.size} 名官员
                        </span>
                    ) : (
                        <span>请选择要解雇的官员</span>
                    )}
                </button>
            </div>
        </div>
    );
};

export default OfficialOverstaffModal;
