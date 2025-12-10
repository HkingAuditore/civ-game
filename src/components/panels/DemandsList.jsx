import React from 'react';
import { Icon } from '../common/UIComponents';
import { getDemandRemainingDays, DEMAND_CONFIG } from '../../logic/demands';

/**
 * 诉求列表组件
 * 展示阶层当前的诉求及其完成状态
 */
export const DemandsList = ({
    demands = [],
    currentDay = 0,
    className = '',
}) => {
    if (!demands || demands.length === 0) {
        return null; // 没有诉求时不显示
    }

    const getProgressColor = (progress) => {
        if (progress >= 0.8) return 'bg-green-500';
        if (progress >= 0.5) return 'bg-yellow-500';
        return 'bg-orange-500';
    };

    const getUrgencyLevel = (remainingDays, totalDuration) => {
        const ratio = remainingDays / totalDuration;
        if (ratio <= 0.25) return 'critical';
        if (ratio <= 0.5) return 'urgent';
        return 'normal';
    };

    const getUrgencyStyles = (urgency) => {
        switch (urgency) {
            case 'critical':
                return {
                    border: 'border-red-500/50',
                    bg: 'bg-red-900/20',
                    timeText: 'text-red-400',
                    pulse: true,
                };
            case 'urgent':
                return {
                    border: 'border-orange-500/40',
                    bg: 'bg-orange-900/20',
                    timeText: 'text-orange-400',
                    pulse: false,
                };
            default:
                return {
                    border: 'border-gray-600/50',
                    bg: 'bg-gray-800/30',
                    timeText: 'text-gray-400',
                    pulse: false,
                };
        }
    };

    return (
        <div className={`space-y-2 ${className}`}>
            <div className="flex items-center gap-1.5">
                <Icon name="Scroll" size={14} className="text-purple-400" />
                <span className="text-xs font-bold text-gray-300">当前诉求</span>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-900/30 text-purple-300">
                    {demands.length}
                </span>
            </div>

            <div className="space-y-2">
                {demands.map((demand, idx) => {
                    const config = DEMAND_CONFIG[demand.type] || {};
                    const remainingDays = getDemandRemainingDays(demand, currentDay);
                    const totalDuration = config.duration || 30;
                    const urgency = getUrgencyLevel(remainingDays, totalDuration);
                    const styles = getUrgencyStyles(urgency);
                    const progress = demand.currentProgress || 0;

                    return (
                        <div
                            key={demand.id || idx}
                            className={`rounded-lg border p-3 ${styles.border} ${styles.bg} ${styles.pulse ? 'animate-pulse' : ''
                                }`}
                        >
                            {/* 头部：类型图标和剩余时间 */}
                            <div className="flex items-start justify-between mb-2">
                                <div className="flex items-center gap-2">
                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${config.bgColor || 'bg-gray-700'}`}>
                                        <Icon
                                            name={config.icon || 'HelpCircle'}
                                            size={16}
                                            className={config.color || 'text-gray-400'}
                                        />
                                    </div>
                                    <div>
                                        <div className={`text-xs font-bold ${config.color || 'text-gray-300'}`}>
                                            {config.name || demand.type}
                                        </div>
                                        <div className="text-[9px] text-gray-400">
                                            {config.description}
                                        </div>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className={`text-xs font-bold ${styles.timeText}`}>
                                        剩余 {remainingDays} 天
                                    </div>
                                    {urgency === 'critical' && (
                                        <div className="text-[9px] text-red-400 flex items-center gap-0.5 justify-end">
                                            <Icon name="AlertTriangle" size={10} />
                                            紧急
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* 要求说明 */}
                            <div className="bg-gray-900/40 rounded p-2 mb-2">
                                <div className="text-[10px] text-gray-400">
                                    <span className="font-bold text-gray-300">要求：</span>
                                    {demand.requirement || config.requirement}
                                </div>
                            </div>

                            {/* 进度条 */}
                            <div className="mb-2">
                                <div className="flex items-center justify-between mb-1">
                                    <span className="text-[9px] text-gray-400">完成进度</span>
                                    <span className="text-[9px] text-gray-300">
                                        {Math.round(progress * 100)}%
                                    </span>
                                </div>
                                <div className="h-1.5 bg-gray-700/50 rounded-full overflow-hidden">
                                    <div
                                        className={`h-full rounded-full transition-all duration-300 ${getProgressColor(progress)}`}
                                        style={{ width: `${progress * 100}%` }}
                                    />
                                </div>
                            </div>

                            {/* 失败惩罚 */}
                            <div className="bg-red-900/20 rounded p-2 border border-red-500/30">
                                <div className="flex items-start gap-1.5">
                                    <Icon name="AlertOctagon" size={12} className="text-red-400 flex-shrink-0 mt-0.5" />
                                    <div>
                                        <div className="text-[9px] text-red-300 font-bold">
                                            失败后果
                                        </div>
                                        <div className="text-[9px] text-red-400">
                                            {demand.failurePenalty?.description || config.failurePenalty?.description}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* 相关资源（物资诉求） */}
                            {demand.missingResources && demand.missingResources.length > 0 && (
                                <div className="mt-2">
                                    <div className="text-[9px] text-gray-400 mb-1">缺少的物资：</div>
                                    <div className="flex flex-wrap gap-1">
                                        {demand.missingResources.map((resource, ridx) => (
                                            <span
                                                key={ridx}
                                                className="text-[9px] px-1.5 py-0.5 rounded bg-orange-900/30 text-orange-300 border border-orange-500/30"
                                            >
                                                {resource}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* 减税诉求进度 */}
                            {demand.type === 'tax_relief' && demand.daysMet !== undefined && (
                                <div className="mt-2 text-[9px] text-gray-400">
                                    已保持低税率 {demand.daysMet}/{demand.daysRequired || 10} 天
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default DemandsList;
