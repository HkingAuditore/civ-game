import React from 'react';
import { Icon } from '../common/UIComponents';

/**
 * 好感度变化分析组件
 * 展示影响阶层好感度变化的各项正负因素
 */
export const DissatisfactionAnalysis = ({
    sources = [],
    totalContribution = 0,
    className = '',
    maxItems = null, // number | null
    showContributionValue = false,
    showContributionPercent = true,
    title = '好感度变化分析',
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
            case 'info':
                return {
                    bg: 'bg-gray-800/30',
                    border: 'border-gray-500/40',
                    text: 'text-gray-300',
                    icon: 'text-gray-400',
                    bar: 'bg-gray-500',
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

    // 将数值转换为易于理解的文字描述
    const getSeverityText = (contribution) => {
        if (contribution >= 1.5) return '严重';
        if (contribution >= 1.0) return '较重';
        if (contribution >= 0.5) return '中等';
        return '轻微';
    };

    // 总体评估文字 - 只根据负面因素计算严重程度
    // severity 为 'danger' 或 'warning' 视为负面因素，'info' 视为正面/中性因素
    const negativeSources = sources.filter(s => s.severity === 'danger' || s.severity === 'warning');
    const positiveSources = sources.filter(s => s.severity === 'info');
    const negativeTotal = negativeSources.reduce((sum, s) => sum + s.contribution, 0);
    const positiveTotal = positiveSources.reduce((sum, s) => sum + s.contribution, 0);

    const getOverallAssessment = (negTotal, posTotal) => {
        // 如果没有负面因素，根据正面因素给出积极评价
        if (negTotal < 0.1) {
            if (posTotal >= 2) return { text: '良好', color: 'text-green-400' };
            if (posTotal >= 1) return { text: '稳定', color: 'text-green-400' };
            return { text: '平稳', color: 'text-gray-400' };
        }
        // 有负面因素时，根据负面程度评估
        if (negTotal >= 3) return { text: '危急', color: 'text-red-400' };
        if (negTotal >= 2) return { text: '严峻', color: 'text-red-400' };
        if (negTotal >= 1) return { text: '需关注', color: 'text-orange-400' };
        return { text: '轻微', color: 'text-yellow-400' };
    };

    const overallAssessment = getOverallAssessment(negativeTotal, positiveTotal);

    const normalizedTotal = Number.isFinite(totalContribution) && totalContribution > 0 ? totalContribution : 0;
    const visibleSources = (Number.isFinite(maxItems) && maxItems > 0)
        ? sources.slice(0, maxItems)
        : sources;

    return (
        <div className={`space-y-2 ${className}`}>
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                    <Icon name="BarChart2" size={14} className="text-gray-400" />
                    <span className="text-xs font-bold text-gray-300">{title}</span>
                </div>
                <span className="text-[10px] text-gray-400">
                    综合评估: <span className={overallAssessment.color}>{overallAssessment.text}</span>
                </span>
            </div>

            <div className="space-y-1.5">
                {visibleSources.map((source, idx) => {
                    const styles = getSeverityStyles(source.severity);
                    const barWidth = Math.min(100, (source.contribution / 2) * 100);
                    const severityText = getSeverityText(source.contribution);
                    const percent = normalizedTotal > 0 ? Math.round((source.contribution / normalizedTotal) * 100) : 0;

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
                                        {severityText}
                                    </div>
                                    {(showContributionValue || showContributionPercent) && (
                                        <div className="text-[9px] text-gray-400 font-mono leading-tight">
                                            {showContributionValue ? source.contribution.toFixed(2) : ''}
                                            {(showContributionValue && showContributionPercent) ? ' · ' : ''}
                                            {showContributionPercent ? `${percent}%` : ''}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* 严重程度条 */}
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

