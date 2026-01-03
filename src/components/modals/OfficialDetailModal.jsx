import React, { useMemo, useState, useEffect, useRef } from 'react';
import { Modal } from '../common/UnifiedUI';
import { Icon } from '../common/UIComponents';
import { BUILDINGS, RESOURCES } from '../../config';

const formatCost = (value) => {
    if (!Number.isFinite(value)) return '0';
    if (Math.abs(value) >= 1000) return value.toFixed(0);
    if (Math.abs(value) >= 100) return value.toFixed(1);
    return value.toFixed(2);
};

export const OfficialDetailModal = ({ isOpen, onClose, official, onUpdateSalary }) => {
    const [salaryDraft, setSalaryDraft] = useState('');
    const [isEditingSalary, setIsEditingSalary] = useState(false);
    const lastOfficialIdRef = useRef(null);

    useEffect(() => {
        if (!isOpen) {
            setIsEditingSalary(false);
            return;
        }
        const currentId = official?.id || null;
        if (currentId !== lastOfficialIdRef.current) {
            lastOfficialIdRef.current = currentId;
            setSalaryDraft(Number.isFinite(official?.salary) ? String(official.salary) : '');
            setIsEditingSalary(false);
            return;
        }
        if (!isEditingSalary) {
            setSalaryDraft(Number.isFinite(official?.salary) ? String(official.salary) : '');
        }
    }, [official, isOpen, isEditingSalary]);
    const propertySummary = useMemo(() => {
        const summary = {};
        (official?.ownedProperties || []).forEach(prop => {
            if (!prop?.buildingId) return;
            if (!summary[prop.buildingId]) {
                summary[prop.buildingId] = {
                    count: 0,
                    levels: {},
                    totalCost: 0,
                };
            }
            const entry = summary[prop.buildingId];
            entry.count += 1;
            const level = prop.level || 0;
            entry.levels[level] = (entry.levels[level] || 0) + 1;
            entry.totalCost += prop.purchaseCost || 0;
        });
        return summary;
    }, [official]);

    const expenseRows = useMemo(() => {
        const breakdown = official?.lastDayExpenseBreakdown || {};
        return Object.entries(breakdown)
            .map(([resource, data]) => ({
                resource,
                name: RESOURCES[resource]?.name || resource,
                amount: data?.amount || 0,
                cost: data?.cost || 0,
                tax: data?.tax || 0,
            }))
            .filter(row => row.amount > 0 || row.cost > 0)
            .sort((a, b) => b.cost - a.cost);
    }, [official]);

    const propertyRows = useMemo(() => {
        return Object.entries(propertySummary)
            .map(([buildingId, data]) => {
                const buildingName = BUILDINGS.find(b => b.id === buildingId)?.name || buildingId;
                const levelText = Object.entries(data.levels)
                    .sort((a, b) => Number(a[0]) - Number(b[0]))
                    .map(([level, count]) => `L${level}×${count}`)
                    .join(' ');
                return {
                    buildingId,
                    buildingName,
                    count: data.count,
                    levelText: levelText || 'L0×0',
                    totalCost: data.totalCost,
                };
            })
            .sort((a, b) => b.count - a.count);
    }, [propertySummary]);

    const totalExpense = typeof official?.lastDayExpense === 'number' ? official.lastDayExpense : 0;
    const luxuryExpense = typeof official?.lastDayLuxuryExpense === 'number' ? official.lastDayLuxuryExpense : 0;
    const essentialExpense = typeof official?.lastDayEssentialExpense === 'number' ? official.lastDayEssentialExpense : 0;
    const propertyIncome = typeof official?.lastDayPropertyIncome === 'number' ? official.lastDayPropertyIncome : 0;
    const canEditSalary = typeof onUpdateSalary === 'function' && official?.id;
    const parsedSalaryDraft = Number.parseInt(salaryDraft, 10);

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={`${official?.name || '官员'} · 个人资产详情`}
            size="lg"
        >
            <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="rounded-lg border border-gray-700/70 bg-gray-900/40 p-3">
                        <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-gray-400">
                            <Icon name="Coins" size={12} />
                            日收益
                        </div>
                        <div className={`mt-1 text-lg font-mono font-bold ${propertyIncome >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
                            {propertyIncome >= 0 ? '+' : ''}{formatCost(propertyIncome)}
                        </div>
                    </div>
                    <div className="rounded-lg border border-gray-700/70 bg-gray-900/40 p-3">
                        <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-gray-400">
                            <Icon name="Wallet" size={12} />
                            额外资源开销
                        </div>
                        <div className="mt-1 text-lg font-mono font-bold text-amber-300">
                            {formatCost(luxuryExpense)}
                        </div>
                        <div className="mt-1 text-[10px] text-gray-500">
                            基础 {formatCost(essentialExpense)} · 总计 {formatCost(totalExpense)}
                        </div>
                    </div>
                </div>

                <div className="rounded-lg border border-gray-700/70 bg-gray-900/40 p-3">
                    <div className="flex items-center gap-2 text-xs font-semibold text-gray-300 mb-2">
                        <Icon name="Building" size={14} />
                        产业详情
                    </div>
                    {propertyRows.length > 0 ? (
                        <div className="space-y-2">
                            {propertyRows.map(row => (
                                <div key={row.buildingId} className="flex items-center justify-between text-[11px] text-gray-300">
                                    <div>
                                        <span className="font-semibold text-gray-200">{row.buildingName}</span>
                                        <span className="ml-2 text-gray-500">{row.levelText}</span>
                                    </div>
                                    <div className="flex items-center gap-3 text-xs">
                                        <span className="text-emerald-300">× {row.count}</span>
                                        {/* <span className="font-mono text-amber-200">成本 {formatCost(row.totalCost)}</span> */}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-[11px] text-gray-500">暂无产业持有</div>
                    )}
                </div>

                <div className="rounded-lg border border-gray-700/70 bg-gray-900/40 p-3">
                    <div className="flex items-center gap-2 text-xs font-semibold text-gray-300 mb-2">
                        <Icon name="Coins" size={14} />
                        薪俸设置
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <input
                            type="number"
                            inputMode="numeric"
                            value={salaryDraft}
                            onChange={(e) => {
                                setSalaryDraft(e.target.value);
                            }}
                            onFocus={() => setIsEditingSalary(true)}
                            onBlur={() => setIsEditingSalary(false)}
                            className="w-28 bg-gray-800/70 border border-gray-600 text-sm text-gray-200 rounded px-2 py-1 focus:ring-1 focus:ring-amber-400 focus:border-amber-400 text-center"
                        />
                        <button
                            className={`ml-auto px-2.5 py-1 rounded text-xs font-semibold ${canEditSalary ? 'bg-amber-600/80 hover:bg-amber-500 text-white' : 'bg-gray-700 text-gray-400 cursor-not-allowed'}`}
                            disabled={!canEditSalary}
                            onClick={() => {
                                if (!canEditSalary) return;
                                if (!Number.isFinite(parsedSalaryDraft)) return;
                                const nextSalary = Math.floor(parsedSalaryDraft);
                                onUpdateSalary(official.id, nextSalary);
                                setSalaryDraft(String(nextSalary));
                                setIsEditingSalary(false);
                            }}
                        >
                            保存薪俸
                        </button>
                    </div>
                    <div className="mt-1 text-[10px] text-gray-500">调整后立即影响每日薪俸支出与官员财务状态</div>
                </div>

                <div className="rounded-lg border border-gray-700/70 bg-gray-900/40 p-3">
                    <div className="flex items-center gap-2 text-xs font-semibold text-gray-300 mb-2">
                        <Icon name="ShoppingBag" size={14} />
                        额外资源开销明细
                    </div>
                    <div className="text-[10px] text-gray-500 mb-2">含基础与奢侈消费、交易税费</div>
                    {expenseRows.length > 0 ? (
                        <div className="space-y-1">
                            {expenseRows.map(row => (
                                <div key={row.resource} className="flex items-center justify-between text-[11px] text-gray-300">
                                    <div className="flex items-center gap-2">
                                        <span>{row.name}</span>
                                        <span className="text-gray-500">× {row.amount.toFixed(2)}</span>
                                    </div>
                                    <div className="font-mono text-amber-200">
                                        {formatCost(row.cost)}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-[11px] text-gray-500">暂无开销记录</div>
                    )}
                </div>
            </div>
        </Modal>
    );
};
