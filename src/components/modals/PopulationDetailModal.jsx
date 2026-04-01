import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Icon } from '../common/UIComponents';
import { STRATA } from '../../config';
import { SimpleLineChart } from '../common/SimpleLineChart';
import { formatNumberShortCN } from '../../utils/numberFormat';

export const PopulationDetailModal = ({
    isOpen,
    onClose,
    population = 0,
    maxPop = 0,
    popStructure = {},
    history = {},
    jobsAvailable = {},
    buildingJobFill = {},
}) => {
    // Removed isAnimatingOut as framer-motion handles it

    const handleClose = () => {
        onClose();
    };

    const populationHistory = history?.population || [];
    const entries = Object.keys(STRATA)
        .map(key => {
            const count = popStructure[key] || 0;
            const percent = population > 0 ? (count / population) * 100 : 0;
            return {
                key,
                name: STRATA[key].name,
                icon: STRATA[key].icon,
                count,
                percent,
            };
        })
        .filter(item => item.count > 0)
        .sort((a, b) => b.count - a.count);

    // 计算岗位就业数据：按阶层聚合 buildingJobFill
    const jobStats = useMemo(() => {
        // filledByStratum: 各阶层实际在岗人数（来自 buildingJobFill 聚合）
        const filledByStratum = {};
        Object.values(buildingJobFill).forEach(slotMap => {
            if (!slotMap || typeof slotMap !== 'object') return;
            Object.entries(slotMap).forEach(([role, count]) => {
                filledByStratum[role] = (filledByStratum[role] || 0) + (Number(count) || 0);
            });
        });

        // 汇总所有有岗位或有人口的阶层
        const allRoles = new Set([
            ...Object.keys(jobsAvailable).filter(k => (jobsAvailable[k] || 0) > 0),
            ...Object.keys(filledByStratum).filter(k => (filledByStratum[k] || 0) > 0),
        ]);

        // 排除 unemployed
        allRoles.delete('unemployed');

        const result = Array.from(allRoles).map(role => {
            const available = Math.round(jobsAvailable[role] || 0);
            const filled = Math.round(filledByStratum[role] || 0);
            const gap = Math.max(0, available - filled);
            const fillRate = available > 0 ? Math.min(1, filled / available) : 1;
            return {
                role,
                name: STRATA[role]?.name || role,
                icon: STRATA[role]?.icon || 'Briefcase',
                available,
                filled,
                gap,
                fillRate,
            };
        }).filter(item => item.available > 0 || item.filled > 0)
          .sort((a, b) => b.available - a.available);

        const totalAvailable = result.reduce((s, i) => s + i.available, 0);
        const totalFilled = result.reduce((s, i) => s + i.filled, 0);
        const totalGap = Math.max(0, totalAvailable - totalFilled);
        const overallRate = totalAvailable > 0 ? Math.min(1, totalFilled / totalAvailable) : 1;

        return { items: result, totalAvailable, totalFilled, totalGap, overallRate };
    }, [jobsAvailable, buildingJobFill]);

    return createPortal(
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-end justify-center lg:items-center">
                    {/* 遮罩层 */}
                    <motion.div
                        className="absolute inset-0 bg-black/70"
                        onClick={handleClose}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.3 }}
                    />

                    {/* 内容面板 */}
                    <motion.div
                        className="relative w-full max-w-2xl glass-epic border-t-2 lg:border-2 border-ancient-gold/30 rounded-t-2xl lg:rounded-2xl shadow-metal-xl flex flex-col max-h-[90vh]"
                        initial={{ y: "100%", opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: "100%", opacity: 0 }}
                        transition={{ type: "spring", damping: 25, stiffness: 300 }}
                    >
                        {/* 头部 */}
                        <div className="flex-shrink-0 p-3 border-b border-gray-700 bg-gray-900/70">
                            <div className="flex items-center gap-2">
                                <div className="w-10 h-10 icon-metal-container icon-metal-container-lg flex-shrink-0">
                                    <Icon name="Users" size={24} className="text-blue-300 icon-metal-blue" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h2 className="text-base font-bold text-white leading-tight font-decorative">人口详情</h2>
                                    <p className="text-xs text-gray-400 leading-tight">
                                        当前人口 {formatNumberShortCN(Math.round(population), { decimals: 0 })} / {formatNumberShortCN(Math.round(maxPop), { decimals: 0 })}
                                    </p>
                                </div>
                                <button onClick={handleClose} className="p-2 rounded-full hover:bg-gray-700 flex-shrink-0">
                                    <Icon name="X" size={18} className="text-gray-400" />
                                </button>
                            </div>
                        </div>

                        {/* 内容 */}
                        <div className="flex-1 overflow-y-auto p-3 space-y-3">
                            {/* 人口趋势 */}
                            <div className="bg-gray-700/50 rounded p-2 border border-gray-600">
                                <div className="mb-1.5 flex items-center justify-between">
                                    <div>
                                        <p className="text-xs uppercase tracking-wide text-gray-500 leading-none">总人口变化趋势</p>
                                        <p className="text-sm font-semibold text-white leading-tight mt-0.5">
                                            当前 {formatNumberShortCN(Math.round(population), { decimals: 0 })} 人 · 上限 {formatNumberShortCN(Math.round(maxPop), { decimals: 0 })}
                                        </p>
                                    </div>
                                    <Icon name="Activity" size={16} className="text-blue-300" />
                                </div>
                                <SimpleLineChart data={populationHistory} color="#60a5fa" label="人口" />
                            </div>

                            {/* 阶层构成 */}
                            <div className="bg-gray-700/50 rounded p-2 border border-gray-600">
                                <div className="mb-1.5 flex items-center justify-between">
                                    <div>
                                        <p className="text-xs uppercase tracking-wide text-gray-500 leading-none">阶层构成</p>
                                        <p className="text-sm font-semibold text-white leading-tight mt-0.5">当前活跃阶层</p>
                                    </div>
                                    <Icon name="Layers" size={16} className="text-purple-300" />
                                </div>
                                <div className="space-y-2">
                                    {entries.length ? (
                                        entries.map(item => (
                                            <div key={item.key}>
                                                <div className="flex items-center justify-between text-xs text-gray-300">
                                                    <div className="flex items-center gap-1.5">
                                                        <Icon name={item.icon} size={14} className="text-amber-300" />
                                                        <span className="leading-none">{item.name}</span>
                                                    </div>
                                                    <div className="text-xs text-gray-400 font-mono leading-none">
                                                        {formatNumberShortCN(Math.round(item.count), { decimals: 0 })} 人 · {item.percent.toFixed(1)}%
                                                    </div>
                                                </div>
                                                <div className="mt-1 h-1.5 rounded-full bg-gray-800">
                                                    <div
                                                        className="h-full rounded-full bg-gradient-to-r from-blue-400 to-purple-500"
                                                        style={{ width: `${Math.min(item.percent, 100)}%` }}
                                                    />
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <p className="text-xs text-gray-500 text-center py-2">暂无社会阶层数据。</p>
                                    )}
                                </div>
                            </div>

                            {/* 岗位就业总览 */}
                            {jobStats.items.length > 0 && (
                                <div className="bg-gray-700/50 rounded p-2 border border-gray-600">
                                    <div className="mb-1.5 flex items-center justify-between">
                                        <div>
                                            <p className="text-xs uppercase tracking-wide text-gray-500 leading-none">岗位就业总览</p>
                                            <p className="text-sm font-semibold text-white leading-tight mt-0.5">
                                                综合到岗率 <span className={jobStats.overallRate >= 0.9 ? 'text-green-300' : jobStats.overallRate >= 0.7 ? 'text-yellow-300' : 'text-red-300'}>
                                                    {(jobStats.overallRate * 100).toFixed(1)}%
                                                </span>
                                                {jobStats.totalGap > 0 && (
                                                    <span className="text-red-400 ml-2 text-xs">缺口 {formatNumberShortCN(jobStats.totalGap, { decimals: 0 })} 人</span>
                                                )}
                                            </p>
                                        </div>
                                        <Icon name="Briefcase" size={16} className="text-amber-300" />
                                    </div>
                                    {/* 汇总进度条 */}
                                    <div className="mb-2 h-1.5 rounded-full bg-gray-800">
                                        <div
                                            className={`h-full rounded-full transition-all ${jobStats.overallRate >= 0.9 ? 'bg-green-400' : jobStats.overallRate >= 0.7 ? 'bg-yellow-400' : 'bg-red-400'}`}
                                            style={{ width: `${Math.min(jobStats.overallRate * 100, 100)}%` }}
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        {jobStats.items.map(item => (
                                            <div key={item.role}>
                                                <div className="flex items-center justify-between text-xs mb-0.5">
                                                    <div className="flex items-center gap-1.5 text-gray-300">
                                                        <Icon name={item.icon} size={12} className="text-amber-300 flex-shrink-0" />
                                                        <span>{item.name}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2 font-mono text-gray-400">
                                                        <span>
                                                            {formatNumberShortCN(item.filled, { decimals: 0 })}
                                                            <span className="text-gray-600"> / </span>
                                                            {formatNumberShortCN(item.available, { decimals: 0 })}
                                                        </span>
                                                        <span className={`w-10 text-right font-semibold ${item.fillRate >= 0.9 ? 'text-green-300' : item.fillRate >= 0.7 ? 'text-yellow-300' : 'text-red-300'}`}>
                                                            {(item.fillRate * 100).toFixed(0)}%
                                                        </span>
                                                        {item.gap > 0 && (
                                                            <span className="text-red-400 w-14 text-right">
                                                                -缺{formatNumberShortCN(item.gap, { decimals: 0 })}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="h-1 rounded-full bg-gray-800">
                                                    <div
                                                        className={`h-full rounded-full ${item.fillRate >= 0.9 ? 'bg-green-400/70' : item.fillRate >= 0.7 ? 'bg-yellow-400/70' : 'bg-red-400/70'}`}
                                                        style={{ width: `${Math.min(item.fillRate * 100, 100)}%` }}
                                                    />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    <p className="text-xs text-gray-600 mt-2">在岗数 / 岗位数 · 颜色表示到岗率（绿≥90% 黄≥70% 红&lt;70%）</p>
                                </div>
                            )}
                        </div>

                        {/* 底部按钮 */}
                        <div className="flex-shrink-0 px-3 py-2 border-t border-gray-700 bg-gray-800/50">
                            <button
                                onClick={handleClose}
                                className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-bold transition-colors"
                            >
                                关闭
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>,
        document.body
    );
};

