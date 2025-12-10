import React, { useState } from 'react';
import { Icon } from '../common/UIComponents';
import { getRivalStratum } from '../../logic/organizationSystem';
import { STRATA } from '../../config/strata';

/**
 * 策略行动卡片组件
 * 展示完整的行动信息：描述、成本、效果预览、副作用、使用建议
 */
export const StrategicActionCard = ({
    action,
    stratumKey,
    stratumName,
    popCount = 0,
    disabled = false,
    unavailableReason = '',
    onExecute,
    resources = {},
    actionUsage = {},
}) => {
    const [showConfirm, setShowConfirm] = useState(false);
    const [expanded, setExpanded] = useState(false);

    if (!action) return null;

    // 计算实际成本
    const calculateActualCost = () => {
        const cost = { ...action.cost };
        if (!cost) return { total: 0, items: [] };

        const items = [];
        let total = 0;

        // 按人口计算的银币成本
        if (cost.silverPerPop) {
            const usageKey = `${action.id}_${stratumKey}`;
            const usageCount = actionUsage[usageKey] || 0;
            const multiplier = Math.pow(action.costMultiplier || 1, usageCount);
            const silverCost = Math.ceil(cost.silverPerPop * popCount * multiplier);
            items.push({ resource: 'silver', amount: silverCost, label: '银币' });
            total += silverCost;
        }

        // 固定银币成本
        if (cost.silver) {
            items.push({ resource: 'silver', amount: cost.silver, label: '银币' });
            total += cost.silver;
        }

        // 文化成本
        if (cost.culture) {
            items.push({ resource: 'culture', amount: cost.culture, label: '文化' });
        }

        return { total, items };
    };

    const costInfo = calculateActualCost();

    // 获取对立阶层名称
    const getRivalName = () => {
        if (action.id === 'divide') {
            const rivalKey = getRivalStratum(stratumKey);
            return STRATA[rivalKey]?.name || rivalKey;
        }
        return null;
    };

    // 获取严重程度对应的样式
    const getSeverityStyles = (severity) => {
        switch (severity) {
            case 'danger':
                return 'bg-red-900/30 border-red-500/40 text-red-300';
            case 'warning':
                return 'bg-orange-900/30 border-orange-500/40 text-orange-300';
            case 'info':
            default:
                return 'bg-blue-900/30 border-blue-500/40 text-blue-300';
        }
    };

    const handleClick = () => {
        if (disabled) return;
        setExpanded(!expanded);
    };

    const handleConfirmExecute = () => {
        setShowConfirm(false);
        setExpanded(false);
        if (onExecute) {
            onExecute(action.id, stratumKey);
        }
    };

    const rivalName = getRivalName();

    return (
        <div className={`rounded-lg border transition-all duration-200 ${disabled
                ? 'bg-gray-800/30 border-gray-700/50 opacity-60'
                : expanded
                    ? 'bg-gray-700/60 border-blue-500/50 shadow-lg'
                    : 'bg-gray-800/50 border-gray-600/50 hover:bg-gray-700/50 hover:border-gray-500/50'
            }`}>
            {/* 头部：基本信息 */}
            <div
                className={`p-3 ${!disabled ? 'cursor-pointer' : ''}`}
                onClick={handleClick}
            >
                <div className="flex items-start gap-3">
                    {/* 图标 */}
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${disabled ? 'bg-gray-700/50' : 'bg-gray-700'
                        }`}>
                        <Icon name={action.icon} size={20} className={disabled ? 'text-gray-500' : 'text-gray-200'} />
                    </div>

                    {/* 名称和简短描述 */}
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                            <span className={`text-sm font-bold ${disabled ? 'text-gray-400' : 'text-white'}`}>
                                {action.name}
                            </span>
                            {action.cooldown > 0 && (
                                <span className="text-[9px] px-1.5 py-0.5 rounded bg-gray-700 text-gray-400">
                                    冷却 {action.cooldown}天
                                </span>
                            )}
                        </div>
                        <p className={`text-[10px] leading-tight mt-0.5 ${disabled ? 'text-gray-500' : 'text-gray-400'}`}>
                            {action.description}
                        </p>

                        {/* 成本摘要 */}
                        {costInfo.items.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1.5">
                                {costInfo.items.map((item, idx) => (
                                    <span key={idx} className="text-[9px] px-1.5 py-0.5 rounded bg-gray-700/70 text-yellow-300">
                                        {item.amount} {item.label}
                                    </span>
                                ))}
                            </div>
                        )}
                        {action.cost === null && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-green-900/30 text-green-300 mt-1.5 inline-block">
                                无消耗
                            </span>
                        )}

                        {/* 不可用原因 */}
                        {disabled && unavailableReason && (
                            <div className="text-[10px] text-red-400 mt-1 flex items-center gap-1">
                                <Icon name="XCircle" size={10} />
                                {unavailableReason}
                            </div>
                        )}
                    </div>

                    {/* 展开箭头 */}
                    {!disabled && (
                        <Icon
                            name={expanded ? 'ChevronUp' : 'ChevronDown'}
                            size={16}
                            className="text-gray-400 flex-shrink-0"
                        />
                    )}
                </div>
            </div>

            {/* 展开内容：详细信息 */}
            {expanded && !disabled && (
                <div className="px-3 pb-3 space-y-3 border-t border-gray-600/50 pt-3">
                    {/* 详细描述 */}
                    {action.detailedDescription && (
                        <div className="bg-gray-800/50 rounded p-2">
                            <div className="flex items-center gap-1.5 mb-1">
                                <Icon name="FileText" size={12} className="text-blue-400" />
                                <span className="text-[10px] font-bold text-gray-300">详细说明</span>
                            </div>
                            <p className="text-[10px] text-gray-400 leading-relaxed">
                                {action.detailedDescription}
                            </p>
                        </div>
                    )}

                    {/* 对立阶层提示（分化专用） */}
                    {action.id === 'divide' && rivalName && (
                        <div className="bg-purple-900/20 rounded p-2 border border-purple-500/30">
                            <div className="flex items-center gap-1.5">
                                <Icon name="GitBranch" size={12} className="text-purple-400" />
                                <span className="text-[10px] text-purple-300">
                                    {stratumName}的对立阶层是「{rivalName}」
                                </span>
                            </div>
                        </div>
                    )}

                    {/* 效果预览 */}
                    {action.effectPreview && (
                        <div className="bg-gray-800/50 rounded p-2">
                            <div className="flex items-center gap-1.5 mb-2">
                                <Icon name="Zap" size={12} className="text-yellow-400" />
                                <span className="text-[10px] font-bold text-gray-300">效果预览</span>
                            </div>
                            <div className="grid grid-cols-2 gap-1.5">
                                {Object.entries(action.effectPreview).map(([key, effect]) => (
                                    <div key={key} className="bg-gray-900/50 rounded px-2 py-1">
                                        <div className="text-[9px] text-gray-400">{effect.label || key}</div>
                                        <div className={`text-xs font-bold ${effect.value > 0 ? 'text-green-400' :
                                                effect.value < 0 ? 'text-red-400' : 'text-blue-400'
                                            }`}>
                                            {effect.value > 0 ? '+' : ''}{effect.value}{effect.unit || ''}
                                            {effect.duration && (
                                                <span className="text-[8px] text-gray-500 ml-1">({effect.duration})</span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* 副作用警告 */}
                    {action.sideEffects && action.sideEffects.length > 0 && (
                        <div className="space-y-1">
                            <div className="flex items-center gap-1.5">
                                <Icon name="AlertTriangle" size={12} className="text-orange-400" />
                                <span className="text-[10px] font-bold text-gray-300">副作用</span>
                            </div>
                            {action.sideEffects.map((effect, idx) => (
                                <div
                                    key={idx}
                                    className={`rounded px-2 py-1.5 border text-[10px] flex items-center gap-1.5 ${getSeverityStyles(effect.severity)}`}
                                >
                                    {effect.icon && <Icon name={effect.icon} size={12} />}
                                    {effect.text}
                                </div>
                            ))}
                        </div>
                    )}

                    {/* 使用建议 */}
                    {action.usageHint && (
                        <div className="bg-blue-900/20 rounded p-2 border border-blue-500/30">
                            <div className="flex items-start gap-1.5">
                                <Icon name="Lightbulb" size={12} className="text-blue-400 flex-shrink-0 mt-0.5" />
                                <p className="text-[10px] text-blue-300 leading-relaxed">
                                    <span className="font-bold">使用建议：</span>{action.usageHint}
                                </p>
                            </div>
                        </div>
                    )}

                    {/* 适用阶段 */}
                    {action.applicableStagesNames && (
                        <div className="flex items-center gap-2">
                            <span className="text-[9px] text-gray-400">适用阶段：</span>
                            <div className="flex flex-wrap gap-1">
                                {action.applicableStagesNames.map((stage, idx) => (
                                    <span key={idx} className="text-[9px] px-1.5 py-0.5 rounded bg-gray-700 text-gray-300">
                                        {stage}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* 执行按钮 */}
                    <div className="flex gap-2 pt-2">
                        {!showConfirm ? (
                            <>
                                <button
                                    onClick={() => setShowConfirm(true)}
                                    className="flex-1 py-2 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-colors flex items-center justify-center gap-1"
                                >
                                    <Icon name="Play" size={14} />
                                    执行
                                </button>
                                <button
                                    onClick={() => setExpanded(false)}
                                    className="px-4 py-2 rounded bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs transition-colors"
                                >
                                    取消
                                </button>
                            </>
                        ) : (
                            <>
                                <button
                                    onClick={handleConfirmExecute}
                                    className="flex-1 py-2 rounded bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition-colors flex items-center justify-center gap-1"
                                >
                                    <Icon name="Check" size={14} />
                                    确认执行
                                </button>
                                <button
                                    onClick={() => setShowConfirm(false)}
                                    className="px-4 py-2 rounded bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs transition-colors"
                                >
                                    返回
                                </button>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default StrategicActionCard;
