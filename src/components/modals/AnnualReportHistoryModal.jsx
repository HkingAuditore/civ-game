/**
 * AnnualReportHistoryModal - Historical Annual Report Viewer
 * Allows reviewing past annual reports and viewing trend charts.
 */
import React, { useState, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Icon } from '../common/UIComponents';
import { SimpleLineChart } from '../common/SimpleLineChart';
import { EPOCHS, STRATA, RESOURCES } from '../../config';
import { formatNumberShortCN } from '../../utils/numberFormat';
import { generateExportText } from '../../utils/annualReport';

// Grade colors (consistent with AnnualReportModal)
const GRADE_COLORS = {
    S: { bg: 'from-yellow-500/30 to-amber-600/30', border: 'border-yellow-400/60', text: 'text-yellow-300' },
    A: { bg: 'from-green-500/30 to-emerald-600/30', border: 'border-green-400/60', text: 'text-green-300' },
    B: { bg: 'from-blue-500/30 to-cyan-600/30', border: 'border-blue-400/60', text: 'text-blue-300' },
    C: { bg: 'from-gray-500/30 to-slate-600/30', border: 'border-gray-400/60', text: 'text-gray-300' },
    D: { bg: 'from-orange-500/30 to-red-600/30', border: 'border-orange-400/60', text: 'text-orange-300' },
    F: { bg: 'from-red-600/30 to-rose-700/30', border: 'border-red-400/60', text: 'text-red-300' },
};

const fmtNum = (n) => {
    if (n == null || !Number.isFinite(n)) return '—';
    return formatNumberShortCN(n, { decimals: 1 });
};

// Trend chart config: which metrics to show
const TREND_CHARTS = [
    {
        id: 'economy',
        title: '经济指标',
        icon: 'TrendingUp',
        series: [
            { key: 'gdp', label: 'GDP', color: '#60a5fa', extract: (r) => r.reportData?.current?.gdp },
            { key: 'silver', label: '国库', color: '#fbbf24', extract: (r) => r.reportData?.current?.silver },
        ],
    },
    {
        id: 'fiscal',
        title: '财政收支',
        icon: 'Coins',
        series: [
            { key: 'totalTax', label: '日均税收', color: '#34d399', extract: (r) => r.reportData?.current?.totalTax },
            { key: 'fiscalNet', label: '财政净收入', color: '#f87171', extract: (r) => r.reportData?.current?.fiscalNetIncome },
        ],
    },
    {
        id: 'prices',
        title: '物价指数',
        icon: 'BarChart',
        series: [
            { key: 'cpi', label: 'CPI', color: '#a78bfa', extract: (r) => r.reportData?.current?.cpi },
            { key: 'ppi', label: 'PPI', color: '#fb923c', extract: (r) => r.reportData?.current?.ppi },
        ],
    },
    {
        id: 'population',
        title: '人口趋势',
        icon: 'Users',
        series: [
            { key: 'population', label: '总人口', color: '#38bdf8', extract: (r) => r.reportData?.current?.population },
        ],
    },
    {
        id: 'military',
        title: '军事力量',
        icon: 'Swords',
        series: [
            { key: 'army', label: '军队人口', color: '#ef4444', extract: (r) => r.reportData?.current?.armyPopulation },
        ],
    },
    {
        id: 'stability',
        title: '社会稳定',
        icon: 'Shield',
        series: [
            { key: 'stability', label: '稳定度', color: '#22d3ee', extract: (r) => r.reportData?.current?.stability },
        ],
    },
];

// ============================================================
// Sub-components
// ============================================================

/** Year-by-year report list entry */
const ReportListItem = ({ entry, onClick }) => {
    const { year, epoch, reportData } = entry;
    const grade = reportData?.scoring?.grade || '?';
    const score = reportData?.scoring?.score || 0;
    const gradeStyle = GRADE_COLORS[grade] || GRADE_COLORS.C;
    const epochName = EPOCHS?.[epoch]?.name || `时代 ${(epoch || 0) + 1}`;
    const pop = reportData?.current?.population;
    const gdp = reportData?.current?.gdp;

    return (
        <button
            onClick={onClick}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border border-gray-700/50 bg-gray-900/40 hover:bg-gray-800/60 hover:border-ancient-gold/30 transition-all group"
        >
            {/* Grade badge */}
            <div className={`flex-shrink-0 w-10 h-10 rounded-lg border ${gradeStyle.border} bg-gradient-to-br ${gradeStyle.bg} flex items-center justify-center`}>
                <span className={`text-lg font-bold ${gradeStyle.text}`}>{grade}</span>
            </div>
            {/* Info */}
            <div className="flex-1 min-w-0 text-left">
                <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-ancient-parchment">第 {year} 年</span>
                    <span className="text-xs text-ancient-stone">{epochName}</span>
                </div>
                <div className="flex items-center gap-3 text-xs text-gray-400 mt-0.5">
                    <span>评分 {score}</span>
                    {pop != null && <span>人口 {fmtNum(pop)}</span>}
                    {gdp != null && <span>GDP {fmtNum(gdp)}</span>}
                </div>
            </div>
            {/* Arrow */}
            <Icon name="ChevronRight" size={16} className="text-gray-500 group-hover:text-ancient-gold transition-colors flex-shrink-0" />
        </button>
    );
};

/** Single report detail view (simplified version of AnnualReportModal) */
const ReportDetailView = ({ entry, empireName, onBack, onExport }) => {
    const { year, epoch, reportData } = entry;
    const { current, changes, scoring, commentaries } = reportData || {};
    const epochName = EPOCHS?.[epoch]?.name || `时代 ${(epoch || 0) + 1}`;
    const gradeStyle = GRADE_COLORS[scoring?.grade] || GRADE_COLORS.C;
    const isFirstYear = changes?.isFirstYear;
    const [exportStatus, setExportStatus] = useState(null);

    const handleExport = useCallback(async () => {
        try {
            if (onExport) {
                await onExport(entry);
                setExportStatus('success');
                setTimeout(() => setExportStatus(null), 2000);
            }
        } catch {
            setExportStatus('error');
            setTimeout(() => setExportStatus(null), 2000);
        }
    }, [onExport, entry]);

    const DataRow = ({ icon, label, value, change }) => (
        <div className="flex items-center justify-between py-1">
            <div className="flex items-center gap-1.5 text-xs text-gray-400">
                <Icon name={icon} size={11} className="text-gray-500" />
                {label}
            </div>
            <div className="flex items-center gap-2 text-xs">
                <span className="font-mono text-gray-200">{fmtNum(value)}</span>
                {!isFirstYear && change?.delta != null && change.delta !== 0 && (
                    <span className={`font-mono ${change.delta > 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {change.delta > 0 ? '↑' : '↓'}{fmtNum(Math.abs(change.delta))}
                    </span>
                )}
            </div>
        </div>
    );

    const Section = ({ icon, title, commentary, children }) => (
        <div className="rounded-lg border border-gray-700/40 bg-gray-900/30 p-2.5">
            <div className="flex items-center gap-1.5 mb-1.5">
                <Icon name={icon} size={13} className="text-ancient-gold" />
                <span className="text-xs font-bold text-ancient-parchment">{title}</span>
            </div>
            {commentary && <p className="text-xs text-gray-400 mb-1.5 leading-relaxed">{commentary}</p>}
            {children}
        </div>
    );

    // Sort resources by delta
    const resourceEntries = Object.entries(changes?.resources || {})
        .filter(([, v]) => v.delta !== 0)
        .sort((a, b) => Math.abs(b[1].delta) - Math.abs(a[1].delta))
        .slice(0, 5);

    // Population structure
    const popEntries = Object.entries(current?.popStructure || {})
        .filter(([, count]) => count > 0)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8);

    return (
        <div className="flex flex-col h-full">
            {/* Header with back button */}
            <div className="sticky top-0 z-10 bg-gradient-to-b from-gray-950 via-gray-950/98 to-transparent pb-2 px-4 pt-3">
                <div className="flex items-center gap-2 mb-2">
                    <button onClick={onBack} className="p-1 rounded-lg hover:bg-gray-800 transition-colors">
                        <Icon name="ArrowLeft" size={16} className="text-ancient-gold" />
                    </button>
                    <div className="flex-1 text-center">
                        <h3 className="text-sm font-bold text-ancient-gold">第 {year} 年 · 年度政府工作报告</h3>
                        <p className="text-xs text-ancient-stone">{empireName || '我的文明'} · {epochName}</p>
                    </div>
                    <div className={`w-8 h-8 rounded-lg border ${gradeStyle.border} bg-gradient-to-br ${gradeStyle.bg} flex items-center justify-center`}>
                        <span className={`text-sm font-bold ${gradeStyle.text}`}>{scoring?.grade || '?'}</span>
                    </div>
                </div>
                {scoring?.summary && (
                    <p className="text-xs text-gray-400 text-center leading-relaxed">{scoring.summary}</p>
                )}
            </div>

            {/* Report sections */}
            <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-2">
                <Section icon="TrendingUp" title="经济概况" commentary={commentaries?.economy}>
                    <DataRow icon="Coins" label="国库余额" value={current?.silver} change={changes?.economy?.silver} />
                    <DataRow icon="TrendingUp" label="GDP 总量" value={current?.gdp} change={changes?.economy?.gdp} />
                    <DataRow icon="BarChart" label="CPI" value={current?.cpi} change={changes?.economy?.cpi} />
                    <DataRow icon="Factory" label="PPI" value={current?.ppi} change={changes?.economy?.ppi} />
                    <DataRow icon="Banknote" label="日均税收" value={current?.totalTax} change={changes?.economy?.totalTax} />
                </Section>

                <Section icon="Users" title="人口民生" commentary={commentaries?.population}>
                    <DataRow icon="Users" label="人口总量" value={current?.population} change={changes?.population?.total} />
                    {popEntries.length > 0 && (
                        <div className="mt-1 space-y-0.5">
                            {popEntries.map(([cls, count]) => (
                                <div key={cls} className="flex justify-between text-xs">
                                    <span className="text-gray-500">{STRATA[cls]?.name || cls}</span>
                                    <span className="text-gray-300 font-mono">{fmtNum(count)}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </Section>

                <Section icon="Building2" title="产业发展" commentary={commentaries?.industry}>
                    <DataRow icon="Building2" label="建筑总数" value={current?.totalBuildings} change={changes?.industry?.total} />
                </Section>

                <Section icon="Swords" title="军事力量" commentary={commentaries?.military}>
                    <DataRow icon="Users" label="军队人口" value={current?.armyPopulation} change={changes?.military?.armyPop} />
                    <DataRow icon="Shield" label="军团数量" value={current?.corpsCount} change={changes?.military?.corps} />
                </Section>

                {resourceEntries.length > 0 && (
                    <Section icon="Package" title="资源变动 (TOP 5)" commentary={commentaries?.resources}>
                        {resourceEntries.map(([key, val]) => {
                            const resName = RESOURCES[key]?.name || key;
                            return (
                                <div key={key} className="flex justify-between text-xs py-0.5">
                                    <span className="text-gray-400">{resName}</span>
                                    <span className={`font-mono ${val.delta > 0 ? 'text-green-400' : 'text-red-400'}`}>
                                        {val.delta > 0 ? '+' : ''}{fmtNum(val.delta)}
                                    </span>
                                </div>
                            );
                        })}
                    </Section>
                )}

                <Section icon="Shield" title="社会稳定" commentary={commentaries?.social}>
                    <DataRow icon="Shield" label="稳定度" value={current?.stability} change={changes?.social?.stability} />
                </Section>

                <Section icon="Lightbulb" title="科技发展" commentary={commentaries?.tech}>
                    <DataRow icon="Lightbulb" label="已解锁科技" value={current?.techsUnlocked} change={changes?.tech?.total} />
                </Section>
            </div>

            {/* Export button */}
            <div className="sticky bottom-0 px-4 py-2 bg-gradient-to-t from-gray-950 via-gray-950/98 to-transparent border-t border-white/5">
                <button
                    onClick={handleExport}
                    className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-ancient-gold/30 bg-gray-800/50 hover:bg-gray-700/50 text-sm text-ancient-parchment transition-all active:scale-95"
                >
                    <Icon name="Copy" size={14} />
                    {exportStatus === 'success' ? '已复制' : exportStatus === 'error' ? '导出失败' : '导出报告'}
                </button>
            </div>
        </div>
    );
};

/** Trends chart view */
const TrendChartsView = ({ history }) => {
    // Extract time series from report history
    const chartData = useMemo(() => {
        if (!history.length) return {};
        const result = {};
        TREND_CHARTS.forEach(chart => {
            result[chart.id] = {
                years: history.map(r => r.year),
                series: chart.series.map(s => ({
                    ...s,
                    data: history.map(r => {
                        const val = s.extract(r);
                        return Number.isFinite(val) ? val : 0;
                    }),
                })),
            };
        });
        return result;
    }, [history]);

    if (history.length < 2) {
        return (
            <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                <Icon name="BarChart" size={32} className="mb-2 opacity-50" />
                <p className="text-sm">至少需要2年数据才能生成趋势图</p>
            </div>
        );
    }

    return (
        <div className="px-3 pb-3 space-y-4">
            {TREND_CHARTS.map(chart => {
                const cd = chartData[chart.id];
                if (!cd) return null;
                // Use SimpleLineChart with primary + secondary series
                const primary = cd.series[0];
                const secondary = cd.series[1];
                return (
                    <div key={chart.id} className="rounded-lg border border-gray-700/40 bg-gray-900/30 p-3">
                        <div className="flex items-center gap-1.5 mb-2">
                            <Icon name={chart.icon} size={13} className="text-ancient-gold" />
                            <span className="text-xs font-bold text-ancient-parchment">{chart.title}</span>
                            <span className="text-xs text-gray-500 ml-auto">第{cd.years[0]}~{cd.years[cd.years.length - 1]}年</span>
                        </div>
                        <SimpleLineChart
                            data={primary?.data || []}
                            data2={secondary?.data || []}
                            color={primary?.color || '#60a5fa'}
                            color2={secondary?.color || '#f87171'}
                            label={primary?.label || ''}
                            label2={secondary?.label || ''}
                        />
                    </div>
                );
            })}
        </div>
    );
};

// ============================================================
// Main component
// ============================================================
export const AnnualReportHistoryModal = ({
    isOpen,
    onClose,
    history = [],
    empireName,
    currentEpoch,
}) => {
    const [view, setView] = useState('list'); // 'list' | 'detail' | 'charts'
    const [selectedEntry, setSelectedEntry] = useState(null);
    const [activeTab, setActiveTab] = useState('list'); // 'list' | 'charts'

    // Sort history descending (most recent first) for list view
    const sortedHistory = useMemo(() => [...history].reverse(), [history]);

    const handleSelectReport = useCallback((entry) => {
        setSelectedEntry(entry);
        setView('detail');
    }, []);

    const handleBackToList = useCallback(() => {
        setView('list');
        setSelectedEntry(null);
    }, []);

    const handleExportSingle = useCallback(async (entry) => {
        const text = generateExportText(
            entry.reportData,
            empireName,
            entry.year,
            entry.epoch
        );
        try {
            await navigator.clipboard.writeText(text);
        } catch {
            window.prompt('请手动复制以下报告文本：', text);
        }
    }, [empireName]);

    if (!isOpen) return null;

    return createPortal(
        <AnimatePresence>
            <motion.div
                key="report-history-overlay"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/70 backdrop-blur-sm p-2 sm:p-4"
                onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
            >
                <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: 30 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: 30 }}
                    transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                    className="relative w-full max-w-lg max-h-[90vh] flex flex-col rounded-xl border border-ancient-gold/30 bg-gray-950/95 shadow-2xl shadow-ancient-gold/10 overflow-hidden"
                >
                    {view === 'detail' && selectedEntry ? (
                        <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
                        <ReportDetailView
                            entry={selectedEntry}
                            empireName={empireName}
                            onBack={handleBackToList}
                            onExport={handleExportSingle}
                        />
                        </div>
                    ) : (
                        <>
                            {/* Header */}
                            <div className="sticky top-0 z-10 bg-gradient-to-b from-gray-950 via-gray-950/98 to-transparent">
                                <div className="px-4 pt-4 pb-2">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Icon name="Archive" size={18} className="text-ancient-gold" />
                                            <h2 className="text-lg font-bold text-ancient-gold tracking-wide">历年政府工作报告</h2>
                                        </div>
                                        <button
                                            onClick={onClose}
                                            className="p-1 rounded-lg hover:bg-gray-800 transition-colors"
                                        >
                                            <Icon name="X" size={18} className="text-gray-400 hover:text-white" />
                                        </button>
                                    </div>
                                    <p className="text-xs text-ancient-stone mt-1">
                                        {empireName || '我的文明'} · 共 {history.length} 份报告
                                    </p>
                                </div>

                                {/* Tab bar */}
                                {history.length >= 2 && (
                                    <div className="px-4 pb-2 flex gap-1">
                                        <button
                                            onClick={() => setActiveTab('list')}
                                            className={`flex-1 flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                                                activeTab === 'list'
                                                    ? 'bg-ancient-gold/20 border border-ancient-gold/40 text-ancient-gold'
                                                    : 'border border-gray-700/50 text-gray-400 hover:text-gray-300 hover:border-gray-600/50'
                                            }`}
                                        >
                                            <Icon name="FileText" size={12} />
                                            报告列表
                                        </button>
                                        <button
                                            onClick={() => setActiveTab('charts')}
                                            className={`flex-1 flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                                                activeTab === 'charts'
                                                    ? 'bg-ancient-gold/20 border border-ancient-gold/40 text-ancient-gold'
                                                    : 'border border-gray-700/50 text-gray-400 hover:text-gray-300 hover:border-gray-600/50'
                                            }`}
                                        >
                                            <Icon name="BarChart" size={12} />
                                            趋势图表
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Content */}
                            <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
                                {history.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-16 text-gray-500">
                                        <Icon name="FileQuestion" size={40} className="mb-3 opacity-40" />
                                        <p className="text-sm font-medium">暂无历史报告</p>
                                        <p className="text-xs mt-1">年度报告将在每年年末自动生成</p>
                                    </div>
                                ) : activeTab === 'charts' ? (
                                    <TrendChartsView history={history} />
                                ) : (
                                    <div className="px-3 pb-3 space-y-1.5">
                                        {sortedHistory.map((entry) => (
                                            <ReportListItem
                                                key={entry.year}
                                                entry={entry}
                                                onClick={() => handleSelectReport(entry)}
                                            />
                                        ))}
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </motion.div>
            </motion.div>
        </AnimatePresence>,
        document.body
    );
};
