import React from 'react';
import { Icon } from '../common/UIComponents';

/**
 * 不满来源分析组件
 * 展示导致阶层组织度增长的各项因素
 */
export const DissatisfactionAnalysis = ({
    sources = [],
    totalContribution = 0,
    className = '',
}) => {
    if (!sources || sources.length === 0) {
        return (
            <div className={`bg-green-900/20 rounded-lg p-3 border border-green-500/30 ${className}`}>
                <div className="flex items-center gap-2">
                    <Icon name="CheckCircle" size={16} className="text-green-400" />
                    <span className="text-xs text-green-300">该阶层当前没有明显不满来源</span>
                </div>
            </div>
        );
    }

    const getSeverityStyles = (severity) => {
        switch (severity) {
            case 'danger':
                return {
                    bg: 'bg-red-900/30',
                    border: 'border-red-500/40',
                    text: 'text-red-300',
                    icon: 'text-red-400',
                    bar: 'bg-red-500',
                };
            case 'warning':
                return {
                    bg: 'bg-orange-900/30',
                    border: 'border-orange-500/40',
                    text: 'text-orange-300',
                    icon: 'text-orange-400',
                    bar: 'bg-orange-500',
                };
            default:
                return {
                    bg: 'bg-yellow-900/30',
                    border: 'border-yellow-500/40',
                    text: 'text-yellow-300',
                    icon: 'text-yellow-400',
                    bar: 'bg-yellow-500',
                };
        }
    };

    return (
        <div className={`space-y-2 ${className}`}>
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                    <Icon name="BarChart2" size={14} className="text-gray-400" />
                    <span className="text-xs font-bold text-gray-300">不满来源分析</span>
                </div>
                <span className="text-[10px] text-gray-400">
                    总影响: <span className="text-orange-400">+{totalContribution.toFixed(1)}/天</span>
                </span>
            </div>

            <div className="space-y-1.5">
                {sources.map((source, idx) => {
                    const styles = getSeverityStyles(source.severity);
                    const barWidth = Math.min(100, (source.contribution / 2) * 100);

                    return (
                        <div
                            key={idx}
                            className={`rounded-lg p-2 border ${styles.bg} ${styles.border}`}
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Icon name={source.icon} size={14} className={styles.icon} />
                                    <div>
                                        <div className={`text-xs font-medium ${styles.text}`}>
                                            {source.label}
                                        </div>
                                        <div className="text-[9px] text-gray-400">
                                            {source.detail}
                                        </div>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className={`text-xs font-bold ${styles.text}`}>
                                        +{source.contribution.toFixed(1)}/天
                                    </div>
                                </div>
                            </div>

                            {/* 贡献度条 */}
                            <div className="mt-1.5 h-1 bg-gray-700/50 rounded-full overflow-hidden">
                                <div
                                    className={`h-full rounded-full transition-all duration-300 ${styles.bar}`}
                                    style={{ width: `${barWidth}%` }}
                                />
                            </div>

                            {/* 相关资源（如有） */}
                            {source.resources && source.resources.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-1.5">
                                    {source.resources.slice(0, 4).map((resource, ridx) => (
                                        <span
                                            key={ridx}
                                            className="text-[8px] px-1 py-0.5 rounded bg-gray-700/50 text-gray-400"
                                        >
                                            {resource}
                                        </span>
                                    ))}
                                    {source.resources.length > 4 && (
                                        <span className="text-[8px] text-gray-500">
                                            +{source.resources.length - 4}
                                        </span>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default DissatisfactionAnalysis;
