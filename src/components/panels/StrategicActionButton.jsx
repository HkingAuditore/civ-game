import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '../common/UIComponents';
import { STRATA } from '../../config/strata';
import { getRivalStratum } from '../../logic/organizationSystem';

/**
 * 策略行动按钮组件
 * 简化版：显示图标和名称，点击打开弹窗
 */
export const StrategicActionButton = ({
    action,
    stratumKey,
    stratumName,
    disabled = false,
    unavailableReason = '',
    onExecute,
    popCount = 0,
    actionUsage = {},
}) => {
    const [showModal, setShowModal] = useState(false);

    if (!action) return null;

    // 计算实际成本
    const getCostText = () => {
        if (!action.cost) return '无消耗';
        const parts = [];
        if (action.cost.silver) parts.push(`${action.cost.silver}银币`);
        if (action.cost.culture) parts.push(`${action.cost.culture}文化`);
        if (action.cost.silverPerPop) {
            const usageKey = `${action.id}_${stratumKey}`;
            const usageCount = actionUsage[usageKey] || 0;
            const multiplier = Math.pow(action.costMultiplier || 1, usageCount);
            const cost = Math.ceil(action.cost.silverPerPop * popCount * multiplier);
            parts.push(`${cost}银币`);
        }
        return parts.length > 0 ? parts.join(' + ') : '无消耗';
    };

    // 获取对立阶层名称
    const getRivalName = () => {
        if (action.id === 'divide') {
            const rivalKey = getRivalStratum(stratumKey);
            return STRATA[rivalKey]?.name || rivalKey;
        }
        return null;
    };

    const handleExecute = () => {
        setShowModal(false);
        if (onExecute) {
            onExecute(action.id, stratumKey);
        }
    };

    const rivalName = getRivalName();

    return (
        <>
            {/* 按钮 */}
            <button
                onClick={() => setShowModal(true)}
                className={`w-full p-2 rounded-lg border transition-all text-left ${disabled
                    ? 'bg-gray-800/30 border-gray-700/50 opacity-50 cursor-not-allowed'
                    : 'bg-gray-800/50 border-gray-600/50 hover:bg-gray-700/50 hover:border-gray-500/50'
                    }`}
            >
                <div className="flex items-center gap-2">
                    <div className={`w-8 h-8 rounded flex items-center justify-center ${disabled ? 'bg-gray-700/50' : 'bg-gray-700'}`}>
                        <Icon name={action.icon} size={16} className={disabled ? 'text-gray-500' : 'text-gray-200'} />
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                            <span className={`text-xs font-bold ${disabled ? 'text-gray-400' : 'text-white'}`}>
                                {action.name}
                            </span>
                            {action.cooldown > 0 && (
                                <span className="text-[8px] px-1 py-0.5 rounded bg-gray-700 text-gray-400">
                                    {action.cooldown}天 冷却
                                </span>
                            )}
                        </div>
                        <p className="text-[9px] text-gray-400 truncate">{action.description}</p>
                    </div>
                    <Icon name="ChevronRight" size={14} className="text-gray-500" />
                </div>
            </button>

            {/* 弹窗 - 使用 createPortal 渲染到 document.body */}
            {showModal && createPortal(
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
                    {/* 遮罩层 */}
                    <div className="absolute inset-0 bg-black/70 backdrop-blur-sm"></div>

                    {/* 内容面板 */}
                    <div
                        className="relative w-full max-w-sm bg-gray-800 rounded-2xl border border-gray-600 shadow-2xl overflow-hidden animate-slide-up"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* 标题栏 */}
                        <div className="flex items-center gap-3 p-4 border-b border-gray-700 bg-gradient-to-r from-blue-900/40 to-gray-800/60">
                            <div className="w-10 h-10 rounded-lg bg-gray-700 flex items-center justify-center">
                                <Icon name={action.icon} size={20} className="text-white" />
                            </div>
                            <div className="flex-1">
                                <h3 className="text-sm font-bold text-white">{action.name}</h3>
                                <p className="text-[10px] text-gray-400">对 {stratumName}</p>
                            </div>
                            <button
                                onClick={() => setShowModal(false)}
                                className="p-2 rounded-full hover:bg-white/10 transition-colors text-gray-400"
                            >
                                <Icon name="X" size={16} />
                            </button>
                        </div>

                        <div className="p-4 space-y-3">
                            {/* 效果预览 */}
                            <div className="bg-gray-900/50 rounded-lg p-3">
                                <div className="text-[10px] text-gray-400 mb-2">效果</div>
                                <div className="grid grid-cols-2 gap-2">
                                    {action.effectPreview && Object.entries(action.effectPreview).map(([key, effect]) => (
                                        <div key={key} className="flex items-center gap-1">
                                            <span className={`text-xs font-bold ${effect.value > 0 ? 'text-green-400' :
                                                effect.value < 0 ? 'text-red-400' : 'text-blue-400'
                                                }`}>
                                                {effect.value > 0 ? '+' : ''}{effect.value}{effect.unit || ''}
                                            </span>
                                            <span className="text-[9px] text-gray-500">{effect.label}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* 分化行动的对立阶层提示 */}
                            {action.id === 'divide' && rivalName && (
                                <div className="text-[10px] text-purple-300 bg-purple-900/20 rounded p-2">
                                    <Icon name="GitBranch" size={10} className="inline mr-1" />
                                    对立阶层：{rivalName}
                                </div>
                            )}

                            {/* 消耗 */}
                            <div className="flex items-center justify-between text-[10px]">
                                <span className="text-gray-400">消耗</span>
                                <span className="text-yellow-300 font-medium">{getCostText()}</span>
                            </div>

                            {/* 副作用警告 */}
                            {action.sideEffects && action.sideEffects.length > 0 && (
                                <div className="text-[9px] text-orange-300/80 flex items-start gap-1">
                                    <Icon name="AlertTriangle" size={10} className="mt-0.5 flex-shrink-0" />
                                    <span>{action.sideEffects.map(e => e.text).join('；')}</span>
                                </div>
                            )}

                            {/* 不可用原因 */}
                            {disabled && unavailableReason && (
                                <div className="text-[10px] text-red-400 bg-red-900/20 rounded p-2 flex items-center gap-1">
                                    <Icon name="XCircle" size={12} />
                                    {unavailableReason}
                                </div>
                            )}
                        </div>

                        {/* 底部按钮 */}
                        <div className="p-4 border-t border-gray-700/50 bg-gray-900/50 flex gap-3">
                            <button
                                onClick={() => setShowModal(false)}
                                className="flex-1 px-4 py-2.5 bg-gray-600 hover:bg-gray-500 text-white rounded-lg text-sm font-bold transition-colors"
                            >
                                取消
                            </button>
                            <button
                                onClick={handleExecute}
                                disabled={disabled}
                                className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-bold transition-colors flex items-center justify-center gap-2 ${disabled
                                    ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                                    : 'bg-blue-600 hover:bg-blue-500 text-white'
                                    }`}
                            >
                                <Icon name="Play" size={14} />
                                执行
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </>
    );
};

export default StrategicActionButton;
