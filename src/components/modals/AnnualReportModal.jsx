/**
 * AnnualReportModal - Annual Government Report
 * Displays year-end statistics with animations and export capability.
 */
import React, { useState, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Icon } from '../common/UIComponents';
import { EPOCHS, STRATA, RESOURCES } from '../../config';
import { formatNumberShortCN } from '../../utils/numberFormat';

// Grade badge color mapping
const GRADE_COLORS = {
    S: { bg: 'from-yellow-500/30 to-amber-600/30', border: 'border-yellow-400/60', text: 'text-yellow-300', glow: 'shadow-yellow-500/30', ring: 'text-yellow-400' },
    A: { bg: 'from-green-500/30 to-emerald-600/30', border: 'border-green-400/60', text: 'text-green-300', glow: 'shadow-green-500/30', ring: 'text-green-400' },
    B: { bg: 'from-blue-500/30 to-cyan-600/30', border: 'border-blue-400/60', text: 'text-blue-300', glow: 'shadow-blue-500/30', ring: 'text-blue-400' },
    C: { bg: 'from-gray-500/30 to-slate-600/30', border: 'border-gray-400/60', text: 'text-gray-300', glow: 'shadow-gray-500/30', ring: 'text-gray-400' },
    D: { bg: 'from-orange-500/30 to-red-600/30', border: 'border-orange-400/60', text: 'text-orange-300', glow: 'shadow-orange-500/30', ring: 'text-orange-400' },
    F: { bg: 'from-red-600/30 to-rose-700/30', border: 'border-red-400/60', text: 'text-red-300', glow: 'shadow-red-500/30', ring: 'text-red-400' },
};

// Category name map
const CATEGORY_NAMES = { gather: '采集', industry: '工业', civic: '民政', military: '军事' };
const ARMY_CAT_NAMES = { infantry: '步兵', archer: '弓兵', cavalry: '骑兵', siege: '攻城', gunpowder: '火器', other: '其他' };

// Section icon config - map section to Lucide icon name
const SECTION_ICONS = {
    economy: 'TrendingUp',
    population: 'Users',
    industry: 'Building2',
    military: 'Swords',
    resources: 'Package',
    tech: 'Lightbulb',
    social: 'Scale',
};

// Format number display - use Chinese abbreviations (万/亿) consistent with game UI
const fmtNum = (n) => {
    if (n == null || !Number.isFinite(n)) return '—';
    return formatNumberShortCN(n, { decimals: 1 });
};

// Change indicator component - enhanced visual weight for changes
const ChangeIndicator = ({ delta, percent, isFirstYear, size = 'sm' }) => {
    if (isFirstYear) {
        return <span className="text-xs text-blue-400/70 ml-1">首年</span>;
    }
    if (delta == null || !Number.isFinite(delta)) return null;
    if (delta === 0 && (percent == null || percent === 0)) {
        return <span className="text-xs text-gray-500 ml-1">— 持平</span>;
    }
    const isPositive = delta > 0;
    const color = isPositive ? 'text-green-400' : 'text-red-400';
    const bgColor = isPositive ? 'bg-green-500/10' : 'bg-red-500/10';
    const arrow = isPositive ? '▲' : '▼';
    const deltaStr = formatNumberShortCN(Math.abs(delta), { decimals: 1, sign: false });
    const pctStr = percent != null && Number.isFinite(percent) ? `${percent > 0 ? '+' : ''}${percent.toFixed(1)}%` : '';
    const sizeClass = size === 'lg' ? 'text-sm font-semibold px-1.5 py-0.5' : 'text-xs px-1 py-0';
    return (
        <span className={`${sizeClass} ${color} ${bgColor} rounded ml-1 inline-flex items-center gap-0.5`}>
            {arrow} {isPositive ? '+' : '-'}{deltaStr}{pctStr ? ` (${pctStr})` : ''}
        </span>
    );
};

// Section card component - uses Lucide icons
const ReportSection = ({ icon, title, commentary, children, delay = 0 }) => (
    <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 + delay * 0.15, duration: 0.5 }}
        className="bg-gray-900/60 backdrop-blur-md rounded-lg border border-ancient-gold/20 overflow-hidden"
    >
        <div className="px-3 py-2 border-b border-ancient-gold/15 bg-gradient-to-r from-ancient-gold/10 to-transparent">
            <div className="flex items-center gap-2">
                <Icon name={icon} size={14} className="text-ancient-gold/80" />
                <span className="text-sm font-bold text-ancient-gold">{title}</span>
            </div>
        </div>
        {commentary && (
            <div className="px-3 py-1.5 bg-gray-800/30 border-b border-white/5">
                <p className="text-xs text-ancient-parchment/80 italic leading-relaxed">"{commentary}"</p>
            </div>
        )}
        <div className="p-3 space-y-1.5">
            {children}
        </div>
    </motion.div>
);

// Data row component - clean layout without emoji prefix
const DataRow = ({ icon, label, value, change, isFirstYear, suffix }) => (
    <div className="flex items-center justify-between text-xs py-0.5">
        <span className="text-ancient-stone flex items-center gap-1.5">
            {icon && <Icon name={icon} size={11} className="text-gray-500 flex-shrink-0" />}
            {label}
        </span>
        <div className="flex items-center gap-1">
            <span className="text-ancient-parchment font-medium">{fmtNum(value)}{suffix || ''}</span>
            {change && <ChangeIndicator delta={change.delta} percent={change.percent} isFirstYear={isFirstYear} size={!isFirstYear && Math.abs(change.percent || 0) > 10 ? 'lg' : 'sm'} />}
        </div>
    </div>
);

// Stratum color palette for PopBar differentiation
const STRATUM_COLORS = {
    official: 'from-amber-500/70 to-yellow-400/70',
    cleric: 'from-purple-500/70 to-violet-400/70',
    capitalist: 'from-yellow-500/70 to-amber-400/70',
    landlord: 'from-orange-500/70 to-amber-400/70',
    engineer: 'from-sky-500/70 to-blue-400/70',
    sailor: 'from-teal-500/70 to-cyan-400/70',
    merchant: 'from-emerald-500/70 to-green-400/70',
    soldier: 'from-red-500/70 to-rose-400/70',
    scholar: 'from-indigo-500/70 to-blue-400/70',
    worker: 'from-cyan-600/70 to-teal-400/70',
    artisan: 'from-lime-500/70 to-green-400/70',
    miner: 'from-stone-500/70 to-gray-400/70',
    lumberjack: 'from-green-600/70 to-emerald-400/70',
    tenant: 'from-yellow-700/70 to-amber-500/70',
    peasant: 'from-green-500/70 to-lime-400/70',
    unemployed: 'from-gray-500/70 to-slate-400/70',
};
const DEFAULT_BAR_COLOR = 'from-blue-500/70 to-cyan-400/70';

// Pop structure bar chart with stratum-specific colors
const PopBar = ({ label, count, total, change, isFirstYear, stratumKey }) => {
    const pct = total > 0 ? (count / total) * 100 : 0;
    const barColor = STRATUM_COLORS[stratumKey] || DEFAULT_BAR_COLOR;
    return (
        <div className="space-y-0.5">
            <div className="flex items-center justify-between text-xs">
                <span className="text-ancient-stone">{label}</span>
                <div className="flex items-center gap-1">
                    <span className="text-ancient-parchment">{fmtNum(count)}</span>
                    <span className="text-gray-500">({pct.toFixed(0)}%)</span>
                    {change && <ChangeIndicator delta={change.delta} isFirstYear={isFirstYear} />}
                </div>
            </div>
            <div className="h-1.5 bg-gray-700/50 rounded-full overflow-hidden">
                <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(pct, 100)}%` }}
                    transition={{ duration: 0.6, delay: 0.5 }}
                    className={`h-full bg-gradient-to-r ${barColor} rounded-full`}
                />
            </div>
        </div>
    );
};

// Compact approval grid item
const ApprovalCell = ({ label, value, delta, isFirstYear }) => {
    const valColor = value >= 80 ? 'text-green-400' : value >= 50 ? 'text-ancient-parchment' : value >= 30 ? 'text-orange-400' : 'text-red-400';
    return (
        <div className="flex items-center justify-between text-xs px-1.5 py-0.5 bg-gray-800/30 rounded">
            <span className="text-gray-400 truncate">{label}</span>
            <div className="flex items-center gap-0.5">
                <span className={`font-medium ${valColor}`}>{(value || 0).toFixed(0)}</span>
                {!isFirstYear && delta != null && delta !== 0 && (
                    <ChangeIndicator delta={delta} isFirstYear={false} />
                )}
            </div>
        </div>
    );
};

export const AnnualReportModal = ({
    reportData,
    year,
    epoch,
    empireName,
    gameState,
    onClose,
    onExport,
}) => {
    const [exportStatus, setExportStatus] = useState(null);
    const [showResourceDetail, setShowResourceDetail] = useState(false);
    const [showAllPop, setShowAllPop] = useState(false);

    if (!reportData) return null;

    const { current, changes, scoring, commentaries } = reportData;
    const isFirstYear = changes?.isFirstYear;
    const epochName = EPOCHS?.[epoch]?.name || `时代 ${(epoch || 0) + 1}`;
    const gradeStyle = GRADE_COLORS[scoring?.grade] || GRADE_COLORS.C;

    const handleExport = useCallback(async () => {
        try {
            if (onExport) {
                await onExport();
                setExportStatus('success');
                setTimeout(() => setExportStatus(null), 2000);
            }
        } catch {
            setExportStatus('error');
            setTimeout(() => setExportStatus(null), 2000);
        }
    }, [onExport]);

    // Sort resources by absolute delta for top movers
    const resourceEntries = Object.entries(changes?.resources || {})
        .filter(([, v]) => v.delta !== 0)
        .sort((a, b) => Math.abs(b[1].delta) - Math.abs(a[1].delta));
    const topResources = showResourceDetail ? resourceEntries : resourceEntries.slice(0, 3);

    // Population: sort by count desc, show top 8 by default
    const popEntries = useMemo(() => {
        return Object.entries(current?.popStructure || {})
            .filter(([, count]) => count > 0)
            .sort((a, b) => b[1] - a[1]);
    }, [current?.popStructure]);
    const displayPop = showAllPop ? popEntries : popEntries.slice(0, 8);
    const hiddenPopCount = popEntries.length - 8;

    // War info from gameState.nations
    const warInfo = useMemo(() => {
        if (!gameState?.nations) return null;
        const enemies = gameState.nations.filter(n => n?.isAtWar);
        if (enemies.length === 0) return null;
        return {
            count: enemies.length,
            names: enemies.map(n => n.name || n.id).slice(0, 3),
            isAtWar: true,
        };
    }, [gameState?.nations]);

    return createPortal(
        <AnimatePresence>
            <motion.div
                key="annual-report-overlay"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm p-2 sm:p-4"
            >
                <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: 30 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: 30 }}
                    transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                    className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl border border-ancient-gold/30 bg-gray-950/95 shadow-2xl shadow-ancient-gold/10"
                    style={{ scrollbarWidth: 'thin' }}
                >
                    {/* Header with gradient */}
                    <div className="sticky top-0 z-10 bg-gradient-to-b from-gray-950 via-gray-950/98 to-transparent pb-2">
                        {/* Title area */}
                        <motion.div
                            initial={{ opacity: 0, y: -20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 }}
                            className="px-4 pt-4 pb-2 text-center"
                        >
                            <div className="flex items-center justify-center gap-2 mb-1">
                                <Icon name="ScrollText" size={18} className="text-ancient-gold" />
                                <h2 className="text-lg font-bold text-ancient-gold tracking-wide">
                                    第 {year} 年 · 年度政府工作报告
                                </h2>
                            </div>
                            <p className="text-xs text-ancient-stone flex items-center justify-center gap-1">
                                <Icon name="Landmark" size={11} className="text-ancient-stone" />
                                {empireName || '我的文明'} · {epochName}
                            </p>
                        </motion.div>

                        {/* Overall score badge with ring */}
                        <motion.div
                            initial={{ opacity: 0, scale: 0.5 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: 0.2, type: 'spring', damping: 15 }}
                            className="flex justify-center px-4 pb-2"
                        >
                            <div className={`inline-flex items-center gap-3 px-5 py-2.5 rounded-xl border bg-gradient-to-r ${gradeStyle.bg} ${gradeStyle.border} shadow-lg ${gradeStyle.glow}`}>
                                {/* Circular score ring */}
                                <div className="relative w-11 h-11 flex items-center justify-center">
                                    <svg className="absolute inset-0 w-11 h-11 -rotate-90" viewBox="0 0 44 44">
                                        <circle cx="22" cy="22" r="18" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-gray-700/40" />
                                        <motion.circle
                                            cx="22" cy="22" r="18" fill="none" stroke="currentColor" strokeWidth="2.5"
                                            className={gradeStyle.ring}
                                            strokeLinecap="round"
                                            strokeDasharray={`${2 * Math.PI * 18}`}
                                            initial={{ strokeDashoffset: 2 * Math.PI * 18 }}
                                            animate={{ strokeDashoffset: 2 * Math.PI * 18 * (1 - (scoring?.score || 0) / 100) }}
                                            transition={{ delay: 0.5, duration: 1.2, ease: 'easeOut' }}
                                        />
                                    </svg>
                                    <span className={`text-lg font-black ${gradeStyle.text} z-10`}>
                                        {scoring?.grade || 'C'}
                                    </span>
                                </div>
                                <div className="text-left">
                                    <div className={`text-base font-bold ${gradeStyle.text}`}>
                                        {scoring?.score || 50} 分
                                    </div>
                                    <div className="text-xs text-ancient-stone/80">
                                        {scoring?.summary || '—'}
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    </div>

                    {/* Report sections */}
                    <div className="px-3 pb-3 space-y-2.5">

                        {/* Economy */}
                        <ReportSection icon={SECTION_ICONS.economy} title="经济概况" commentary={commentaries?.economy} delay={0}>
                            <DataRow icon="Coins" label="国库余额" value={current?.silver} change={changes?.economy?.silver} isFirstYear={isFirstYear} />
                            <DataRow icon="TrendingUp" label="GDP 总量" value={current?.gdp} change={changes?.economy?.gdp} isFirstYear={isFirstYear} />
                            <DataRow icon="BarChart" label="消费价格（CPI）" value={current?.cpi} change={changes?.economy?.cpi} isFirstYear={isFirstYear} />
                            <DataRow icon="Factory" label="生产价格（PPI）" value={current?.ppi} change={changes?.economy?.ppi} isFirstYear={isFirstYear} />
                            <DataRow icon="Banknote" label="日均税收" value={current?.totalTax} change={changes?.economy?.totalTax} isFirstYear={isFirstYear} />
                            <DataRow icon="Wallet" label="日均财政净收入" value={current?.fiscalNetIncome} change={changes?.economy?.fiscalNetIncome} isFirstYear={isFirstYear} />
                        </ReportSection>

                        {/* Population & Livelihood */}
                        <ReportSection icon={SECTION_ICONS.population} title="人口与民生" commentary={commentaries?.population} delay={1}>
                            <DataRow icon="Users" label="人口总量" value={current?.population} change={changes?.population?.total} isFirstYear={isFirstYear} />
                            {/* Population structure - show top strata with expand */}
                            <div className="mt-1.5 space-y-1">
                                {displayPop.map(([cls, count]) => (
                                    <PopBar
                                        key={cls}
                                        label={STRATA[cls]?.name || cls}
                                        count={count}
                                        total={current?.population || 1}
                                        change={changes?.population?.structure?.[cls]}
                                        isFirstYear={isFirstYear}
                                        stratumKey={cls}
                                    />
                                ))}
                            </div>
                            {hiddenPopCount > 0 && (
                                <button
                                    onClick={() => setShowAllPop(!showAllPop)}
                                    className="text-xs text-blue-400 hover:text-blue-300 transition-colors mt-1 flex items-center gap-0.5"
                                >
                                    {showAllPop ? '收起' : `展开全部 ${popEntries.length} 个阶层`}
                                    <Icon name={showAllPop ? 'ChevronUp' : 'ChevronDown'} size={10} />
                                </button>
                            )}
                            {/* Approval grid */}
                            {(() => {
                                const approvalMap = current?.classApproval || {};
                                const approvalChanges = changes?.social?.approval || {};
                                const entries = Object.entries(approvalMap).filter(([, v]) => v != null);
                                if (entries.length === 0) return null;
                                return (
                                    <div className="mt-2 pt-2 border-t border-white/5">
                                        <span className="text-xs text-ancient-stone font-medium">阶层满意度</span>
                                        <div className="mt-1 grid grid-cols-2 gap-1">
                                            {entries.map(([cls, val]) => (
                                                <ApprovalCell
                                                    key={cls}
                                                    label={STRATA[cls]?.name || cls}
                                                    value={val}
                                                    delta={approvalChanges[cls]?.delta}
                                                    isFirstYear={isFirstYear}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                );
                            })()}
                        </ReportSection>

                        {/* Industry */}
                        <ReportSection icon={SECTION_ICONS.industry} title="产业发展" commentary={commentaries?.industry} delay={2}>
                            <DataRow icon="Building2" label="建筑总数" value={current?.totalBuildings} change={changes?.industry?.total} isFirstYear={isFirstYear} suffix=" 座" />
                            <div className="mt-1 grid grid-cols-2 gap-1">
                                {Object.entries(CATEGORY_NAMES).map(([cat, name]) => (
                                    <div key={cat} className="flex items-center justify-between text-xs px-1.5 py-0.5 bg-gray-800/30 rounded">
                                        <span className="text-gray-400">{name}</span>
                                        <div className="flex items-center">
                                            <span className="text-ancient-parchment">{current?.buildingsByCategory?.[cat] || 0}</span>
                                            {!isFirstYear && <ChangeIndicator delta={changes?.industry?.categories?.[cat]?.delta} isFirstYear={false} />}
                                        </div>
                                    </div>
                                ))}
                            </div>
                            {/* Building upgrades info */}
                            {(() => {
                                const upgrades = current?.buildingUpgrades || {};
                                let totalUpgraded = 0;
                                for (const levels of Object.values(upgrades)) {
                                    for (const [lvl, cnt] of Object.entries(levels || {})) {
                                        if (parseInt(lvl) > 0 && cnt > 0) totalUpgraded += cnt;
                                    }
                                }
                                if (totalUpgraded === 0) return null;
                                return (
                                    <div className="mt-1.5 pt-1.5 border-t border-white/5 flex items-center justify-between text-xs">
                                        <span className="text-ancient-stone flex items-center gap-1">
                                            <Icon name="Star" size={11} className="text-amber-400" /> 已升级建筑
                                        </span>
                                        <div className="flex items-center">
                                            <span className="text-amber-400 font-medium">{totalUpgraded} 座</span>
                                            {!isFirstYear && changes?.industry?.upgrades?.delta > 0 && (
                                                <ChangeIndicator delta={changes.industry.upgrades.delta} isFirstYear={false} />
                                            )}
                                        </div>
                                    </div>
                                );
                            })()}
                        </ReportSection>

                        {/* Military */}
                        <ReportSection icon={SECTION_ICONS.military} title="军事力量" commentary={commentaries?.military} delay={3}>
                            <DataRow icon="Users" label="总兵力" value={current?.armyPopulation} change={changes?.military?.armyPopulation} isFirstYear={isFirstYear} />
                            <DataRow icon="Flag" label="军团数" value={current?.corpsCount} change={changes?.military?.corpsCount} isFirstYear={isFirstYear} />
                            {current?.dailyMilitaryExpense > 0 && (
                                <DataRow icon="Coins" label="日均军费" value={current.dailyMilitaryExpense} change={changes?.military?.dailyMilitaryExpense} isFirstYear={isFirstYear} />
                            )}
                            {/* War status */}
                            {warInfo && (
                                <div className="mt-1.5 pt-1.5 border-t border-white/5">
                                    <div className="flex items-center gap-1.5 text-xs">
                                        <Icon name="Sword" size={11} className="text-red-400" />
                                        <span className="text-red-400 font-medium">交战中</span>
                                        <span className="text-ancient-stone">
                                            — 与{warInfo.names.join('、')}
                                            {warInfo.count > 3 ? `等 ${warInfo.count} 国` : ''}开战
                                        </span>
                                    </div>
                                </div>
                            )}
                            {!warInfo && !isFirstYear && (
                                <div className="mt-1.5 pt-1.5 border-t border-white/5">
                                    <div className="flex items-center gap-1.5 text-xs">
                                        <Icon name="Shield" size={11} className="text-green-400/70" />
                                        <span className="text-green-400/70">和平时期</span>
                                    </div>
                                </div>
                            )}
                            {/* Army composition by category */}
                            {(() => {
                                const comp = current?.armyComposition || {};
                                const categories = Object.entries(comp).filter(([, d]) => d.population > 0);
                                if (categories.length === 0) return null;
                                return (
                                    <div className="mt-1.5 pt-1.5 border-t border-white/5">
                                        <span className="text-xs text-ancient-stone">兵种构成</span>
                                        <div className="mt-1 grid grid-cols-2 gap-1">
                                            {categories.map(([cat, data]) => (
                                                <div key={cat} className="flex items-center justify-between text-xs px-1.5 py-0.5 bg-gray-800/30 rounded">
                                                    <span className="text-gray-400">{ARMY_CAT_NAMES[cat] || cat}</span>
                                                    <span className="text-ancient-parchment">{fmtNum(data.population)}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })()}
                        </ReportSection>

                        {/* Resources */}
                        <ReportSection icon={SECTION_ICONS.resources} title="资源储备" commentary={commentaries?.resources} delay={4}>
                            {isFirstYear ? (
                                (() => {
                                    const firstYearRes = Object.entries(current?.resources || {})
                                        .filter(([k, v]) => k !== 'silver' && (v || 0) > 0)
                                        .sort((a, b) => (b[1] || 0) - (a[1] || 0))
                                        .slice(0, 5);
                                    return firstYearRes.length > 0 ? (
                                        firstYearRes.map(([key, val]) => (
                                            <DataRow key={key} label={RESOURCES?.[key]?.name || key} value={val} isFirstYear={true} />
                                        ))
                                    ) : (
                                        <p className="text-xs text-gray-500 py-1">尚无资源储备</p>
                                    );
                                })()
                            ) : resourceEntries.length === 0 ? (
                                <p className="text-xs text-gray-500 py-1">无显著变动</p>
                            ) : (
                                <>
                                    {topResources.map(([key, val]) => (
                                        <DataRow key={key} label={RESOURCES?.[key]?.name || key} value={val.current} change={val} isFirstYear={false} />
                                    ))}
                                    {resourceEntries.length > 3 && (
                                        <button
                                            onClick={() => setShowResourceDetail(!showResourceDetail)}
                                            className="text-xs text-blue-400 hover:text-blue-300 transition-colors mt-1 flex items-center gap-0.5"
                                        >
                                            {showResourceDetail ? '收起' : `查看全部 ${resourceEntries.length} 项`}
                                            <Icon name={showResourceDetail ? 'ChevronUp' : 'ChevronDown'} size={10} />
                                        </button>
                                    )}
                                </>
                            )}
                        </ReportSection>

                        {/* Tech & Culture */}
                        <ReportSection icon={SECTION_ICONS.tech} title="科技文化" commentary={commentaries?.tech} delay={5}>
                            <DataRow icon="Lightbulb" label="已解锁科技" value={current?.techsUnlocked} change={changes?.tech?.techsUnlocked} isFirstYear={isFirstYear} suffix=" 项" />
                            <div className="flex items-center justify-between text-xs py-0.5">
                                <span className="text-ancient-stone flex items-center gap-1.5">
                                    <Icon name="Globe" size={11} className="text-gray-500" /> 当前时代
                                </span>
                                <span className="text-ancient-parchment font-medium">{epochName}</span>
                            </div>
                            {/* Recent / new techs */}
                            {(() => {
                                const recentTechs = current?.recentTechs || [];
                                const techDelta = !isFirstYear ? (changes?.tech?.techsUnlocked?.delta || 0) : 0;
                                const displayTechs = !isFirstYear && techDelta > 0
                                    ? recentTechs.slice(-techDelta).slice(0, 5)
                                    : isFirstYear
                                        ? recentTechs.slice(-3)
                                        : [];
                                if (displayTechs.length === 0) return null;
                                const label = !isFirstYear ? '本年新科技' : '最近研发';
                                return (
                                    <div className="mt-1.5 pt-1.5 border-t border-white/5">
                                        <span className="text-xs text-ancient-stone">{label}</span>
                                        <div className="mt-1 flex flex-wrap gap-1">
                                            {displayTechs.map(t => (
                                                <span key={t.id} className="text-xs px-1.5 py-0.5 bg-indigo-500/15 text-indigo-300 border border-indigo-500/20 rounded">
                                                    {t.name}
                                                </span>
                                            ))}
                                            {!isFirstYear && techDelta > 5 && (
                                                <span className="text-xs text-gray-500">等共 {techDelta} 项</span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })()}
                        </ReportSection>

                        {/* Social Stability - concise, no duplicated approval grid */}
                        <ReportSection icon={SECTION_ICONS.social} title="社会稳定" commentary={commentaries?.social} delay={6}>
                            <DataRow icon="Scale" label="稳定度" value={current?.stability} change={changes?.social?.stability} isFirstYear={isFirstYear} />
                        </ReportSection>
                    </div>

                    {/* Footer buttons */}
                    <div className="sticky bottom-0 px-4 py-3 bg-gradient-to-t from-gray-950 via-gray-950/98 to-transparent border-t border-white/5">
                        <div className="flex gap-2">
                            <button
                                onClick={handleExport}
                                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-ancient-gold/30 bg-gray-800/50 hover:bg-gray-700/50 text-sm text-ancient-parchment transition-all active:scale-95"
                            >
                                <Icon name="Copy" size={14} />
                                {exportStatus === 'success' ? '已复制' : exportStatus === 'error' ? '导出失败' : '导出报告'}
                            </button>
                            <button
                                onClick={onClose}
                                className="flex-[2] flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-gradient-to-r from-ancient-gold/20 to-amber-600/20 border border-ancient-gold/40 hover:from-ancient-gold/30 hover:to-amber-600/30 text-sm font-bold text-ancient-gold transition-all active:scale-95"
                            >
                                <Icon name="ArrowRight" size={14} />
                                继续治理
                            </button>
                        </div>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>,
        document.body
    );
};
