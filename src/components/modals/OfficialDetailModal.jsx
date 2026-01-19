import React, { useMemo, useState, useEffect, useRef } from 'react';
import { Modal } from '../common/UnifiedUI';
import { Icon } from '../common/UIComponents';
import { BUILDINGS, RESOURCES, STRATA } from '../../config';
import { POLITICAL_STANCES, POLITICAL_ISSUES } from '../../config/politicalStances';
import { calculatePrestige, getPrestigeLevel } from '../../logic/officials/manager';
import { LOYALTY_CONFIG } from '../../config/officials';
import { formatNumberShortCN } from '../../utils/numberFormat';

const formatCost = (value) => {
    if (!Number.isFinite(value)) return '0';
    if (Math.abs(value) >= 1000) return value.toFixed(0);
    if (Math.abs(value) >= 100) return value.toFixed(1);
    return value.toFixed(2);
};

const formatEffectNumber = (value) => {
    if (!Number.isFinite(value)) return value;
    const abs = Math.abs(value);
    if (abs >= 10) return value.toFixed(0);
    if (abs >= 1) return value.toFixed(1);
    return value.toFixed(2);
};

// 效果名称映射
const EFFECT_NAMES = {
    stability: '稳定度',
    legitimacyBonus: '合法性',
    militaryBonus: '军队战力',
    tradeBonus: '贸易利润',
    taxEfficiency: '税收效率',
    industryBonus: '工业产出',
    gatherBonus: '采集产出',
    incomePercentBonus: '税收收入',
    researchSpeed: '科研产出',
    populationGrowth: '人口增长',
    needsReduction: '全民消耗',
    buildingCostMod: '建筑成本',
    cultureBonus: '文化产出',
    organizationDecay: '组织度增速',
    approval: '满意度',
    diplomaticBonus: '外交关系',
    productionInputCost: '原料消耗',
    stratumInfluence: '阶层影响力',
    warProductionBonus: '战时生产',
    factionConflict: '派系冲突',
    corruption: '腐败',
    corruptionMod: '腐败程度',
    buildings: '建筑产出',
    categories: '类别产出',
    passive: '被动产出',
    passivePercent: '收入加成',
    maxPop: '人口上限',
    coalitionApproval: '联盟满意度',
    diplomaticIncident: '外交摩擦',
    diplomaticCooldown: '外交冷却',
    influenceBonus: '影响力',
    wageModifier: '薪俸成本',
    stratumDemandMod: '阶层消耗',
    resourceDemandMod: '资源需求',
    resourceSupplyMod: '资源供给',
    militaryUpkeep: '军事维护费',
    militaryPower: '军事力量',
    tradeEfficiency: '贸易效率',
    constructionSpeed: '建造速度',
    upkeepCost: '维护成本',
};

// 获取目标名称（建筑/阶层/资源）
const getTargetDisplayName = (target) => {
    // 先查阶层
    if (STRATA[target]) return STRATA[target].name;
    // 再查资源
    if (RESOURCES[target]) return RESOURCES[target].name;
    // 再查建筑
    const building = BUILDINGS.find(b => b.id === target);
    if (building) return building.name;
    // 类别名称
    const categoryNames = { gather: '采集', industry: '工业', civic: '民用', military: '军事' };
    if (categoryNames[target]) return categoryNames[target];
    return target;
};

// 政治光谱配置
const SPECTRUM_CONFIG = {
    left: { bg: 'bg-red-900/40', border: 'border-red-500/60', text: 'text-red-300', label: '左派', icon: 'Users' },
    center: { bg: 'bg-blue-900/40', border: 'border-blue-500/60', text: 'text-blue-300', label: '建制派', icon: 'Scale' },
    right: { bg: 'bg-amber-900/40', border: 'border-amber-500/60', text: 'text-amber-300', label: '右派', icon: 'TrendingUp' },
};

export const OfficialDetailModal = ({ isOpen, onClose, official, onUpdateSalary, onUpdateName, currentDay = 0, isStanceSatisfied = null, stability = 50, officialsPaid = true }) => {
    const [salaryDraft, setSalaryDraft] = useState('');
    const [isEditingSalary, setIsEditingSalary] = useState(false);
    const [nameDraft, setNameDraft] = useState('');
    const [isEditingName, setIsEditingName] = useState(false);
    const lastOfficialIdRef = useRef(null);
    const pendingSalaryRef = useRef(null); // Track pending salary to prevent reset
    const pendingNameRef = useRef(null);

    useEffect(() => {
        if (!isOpen) {
            setIsEditingSalary(false);
            setIsEditingName(false);
            pendingSalaryRef.current = null;
            pendingNameRef.current = null;
            return;
        }
        const currentId = official?.id || null;
        if (currentId !== lastOfficialIdRef.current) {
            lastOfficialIdRef.current = currentId;
            pendingSalaryRef.current = null;
            pendingNameRef.current = null;
            setSalaryDraft(Number.isFinite(official?.salary) ? String(official.salary) : '');
            setNameDraft(official?.name || '');
            setIsEditingSalary(false);
            setIsEditingName(false);
            return;
        }
        // Check if the official.salary matches the pending saved value
        if (pendingSalaryRef.current !== null && official?.salary === pendingSalaryRef.current) {
            pendingSalaryRef.current = null; // Clear pending after sync
        }
        if (pendingNameRef.current !== null && official?.name === pendingNameRef.current) {
            pendingNameRef.current = null;
        }
        if (!isEditingSalary && pendingSalaryRef.current === null) {
            setSalaryDraft(Number.isFinite(official?.salary) ? String(official.salary) : '');
        }
        if (!isEditingName && pendingNameRef.current === null) {
            setNameDraft(official?.name || '');
        }
    }, [official, isOpen, isEditingSalary, isEditingName]);

    // 产业汇总
    const propertySummary = useMemo(() => {
        const summary = {};
        (official?.ownedProperties || []).forEach(prop => {
            if (!prop?.buildingId) return;
            if (!summary[prop.buildingId]) {
                summary[prop.buildingId] = { count: 0, levels: {} };
            }
            summary[prop.buildingId].count += 1;
            const level = prop.level || 0;
            summary[prop.buildingId].levels[level] = (summary[prop.buildingId].levels[level] || 0) + 1;
        });
        return summary;
    }, [official]);

    const propertyRows = useMemo(() => {
        return Object.entries(propertySummary)
            .map(([buildingId, data]) => {
                const buildingName = BUILDINGS.find(b => b.id === buildingId)?.name || buildingId;
                const levelText = Object.entries(data.levels)
                    .sort((a, b) => Number(a[0]) - Number(b[0]))
                    .map(([level, count]) => `L${level}×${count}`)
                    .join(' ');
                return { buildingId, buildingName, count: data.count, levelText: levelText || 'L0' };
            })
            .sort((a, b) => b.count - a.count);
    }, [propertySummary]);

    // 开销明细
    const expenseRows = useMemo(() => {
        const breakdown = official?.lastDayExpenseBreakdown || {};
        return Object.entries(breakdown)
            .map(([resource, data]) => ({
                resource,
                name: RESOURCES[resource]?.name || resource,
                amount: data?.amount || 0,
                cost: data?.cost || 0,
            }))
            .filter(row => row.amount > 0 || row.cost > 0)
            .sort((a, b) => b.cost - a.cost);
    }, [official]);

    // 基础数据
    const wealth = typeof official?.wealth === 'number' ? official.wealth : 0;
    const salary = typeof official?.salary === 'number' ? official.salary : 0;
    const propertyIncome = typeof official?.lastDayPropertyIncome === 'number' ? official.lastDayPropertyIncome : 0;
    const totalIncome = salary + propertyIncome;
    const totalExpense = typeof official?.lastDayExpense === 'number' ? official.lastDayExpense : 0;
    const luxuryExpense = typeof official?.lastDayLuxuryExpense === 'number' ? official.lastDayLuxuryExpense : 0;

    // 忠诚度
    const loyalty = official?.loyalty ?? 75;
    const lowLoyaltyDays = official?.lowLoyaltyDays ?? 0;
    const loyaltyColor = loyalty >= 75 ? 'text-green-400' : loyalty >= 50 ? 'text-yellow-400' : loyalty >= 25 ? 'text-orange-400' : 'text-red-400';
    const loyaltyBg = loyalty >= 75 ? 'bg-green-500' : loyalty >= 50 ? 'bg-yellow-500' : loyalty >= 25 ? 'bg-orange-500' : 'bg-red-500';

    // 威望
    const prestige = calculatePrestige(official, currentDay);
    const prestigeInfo = getPrestigeLevel(prestige);

    // 政治立场
    const stanceData = official?.politicalStance || {};
    const stance = POLITICAL_STANCES[stanceData.stanceId || stanceData];
    const stanceSpectrum = stance?.spectrum || 'center';
    const spectrumStyle = SPECTRUM_CONFIG[stanceSpectrum] || SPECTRUM_CONFIG.center;

    // 出身阶层
    const stratumKey = official?.sourceStratum || official?.stratum;
    const stratumDef = STRATA[stratumKey];

    // 官员效果
    const displayEffects = useMemo(() => {
        if (official?.effects && Object.keys(official.effects).length > 0) return official.effects;
        if (Array.isArray(official?.rawEffects) && official.rawEffects.length > 0) {
            return official.rawEffects.reduce((acc, raw) => {
                if (!raw?.type) return acc;
                if (raw.target) {
                    if (!acc[raw.type]) acc[raw.type] = {};
                    acc[raw.type][raw.target] = raw.value;
                } else {
                    acc[raw.type] = raw.value;
                }
                return acc;
            }, {});
        }
        return {};
    }, [official]);

    const canEditSalary = typeof onUpdateSalary === 'function' && official?.id;
    const canEditName = typeof onUpdateName === 'function' && official?.id;
    const parsedSalaryDraft = Number.parseInt(salaryDraft, 10);
    const displayName = official?.name || '官员';
    const trimmedNameDraft = nameDraft.trim();

    const adminValue = official?.stats?.administrative ?? official?.administrative ?? 50;
    const militaryValue = official?.stats?.military ?? official?.military ?? 30;
    const diplomacyValue = official?.stats?.diplomacy ?? official?.diplomacy ?? 30;
    const prestigeValue = official?.stats?.prestige ?? official?.prestige ?? 50;

    const handleNameSave = () => {
        if (!canEditName) return;
        if (!trimmedNameDraft) {
            setNameDraft(displayName);
            setIsEditingName(false);
            return;
        }
        if (trimmedNameDraft === official?.name) {
            setIsEditingName(false);
            return;
        }
        pendingNameRef.current = trimmedNameDraft;
        onUpdateName?.(official.id, trimmedNameDraft);
        setIsEditingName(false);
    };

    const handleNameCancel = () => {
        setNameDraft(displayName);
        pendingNameRef.current = null;
        setIsEditingName(false);
    };

    // 忠诚度变化原因分析
    const loyaltyReasons = useMemo(() => {
        const reasons = [];
        const { DAILY_CHANGES } = LOYALTY_CONFIG;

        // 政治诉求
        if (isStanceSatisfied === true) {
            reasons.push({ text: '政治诉求满足', value: DAILY_CHANGES.stanceSatisfied, positive: true });
        } else if (isStanceSatisfied === false) {
            reasons.push({ text: '政治诉求未满足', value: DAILY_CHANGES.stanceUnsatisfied, positive: false });
        }

        // 财务状况
        const fs = official?.financialSatisfaction;
        if (fs === 'satisfied') reasons.push({ text: '财务状况良好', value: DAILY_CHANGES.financialSatisfied, positive: true });
        else if (fs === 'uncomfortable') reasons.push({ text: '生活拮据', value: DAILY_CHANGES.financialUncomfortable, positive: false });
        else if (fs === 'struggling') reasons.push({ text: '入不敷出', value: DAILY_CHANGES.financialStruggling, positive: false });
        else if (fs === 'desperate') reasons.push({ text: '濒临破产', value: DAILY_CHANGES.financialDesperate, positive: false });

        // 国家稳定度
        const stabilityValue = (stability ?? 50) / 100;
        if (stabilityValue > 0.7) {
            reasons.push({ text: '国家稳定', value: DAILY_CHANGES.stabilityHigh, positive: true });
        } else if (stabilityValue < 0.3) {
            reasons.push({ text: '国家动荡', value: DAILY_CHANGES.stabilityLow, positive: false });
        }

        // 薪资发放
        if (officialsPaid) {
            reasons.push({ text: '薪资按时发放', value: DAILY_CHANGES.salaryPaid, positive: true });
        } else {
            reasons.push({ text: '薪资未发放', value: DAILY_CHANGES.salaryUnpaid, positive: false });
        }

        return reasons;
    }, [official, isStanceSatisfied, stability, officialsPaid]);

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`${displayName} · 详细信息`} size="xl">
            <div className="space-y-4">
                {/* 顶部信息栏 */} 
                <div className="flex flex-wrap items-center gap-3 pb-3 border-b border-gray-700/50">
                    {/* 官员姓名 */}
                    <div className="flex items-center gap-2 min-w-[160px]">
                        {isEditingName ? (
                            <input
                                value={nameDraft}
                                onChange={(event) => setNameDraft(event.target.value)}
                                onKeyDown={(event) => {
                                    if (event.key === 'Enter') handleNameSave();
                                    if (event.key === 'Escape') handleNameCancel();
                                }}
                                maxLength={20}
                                className="w-40 bg-gray-900/60 border border-gray-600/60 rounded px-2 py-1 text-sm text-gray-100 focus:outline-none focus:ring-1 focus:ring-emerald-400/60"
                                placeholder="输入官员姓名"
                            />
                        ) : (
                            <div className="text-base font-semibold text-gray-100 truncate max-w-[10rem]">
                                {displayName}
                            </div>
                        )}
                        {canEditName && !isEditingName && (
                            <button
                                type="button"
                                className="p-1 rounded bg-gray-800/70 text-gray-300 hover:text-emerald-300 hover:bg-gray-700/70 transition-colors"
                                onClick={() => setIsEditingName(true)}
                                title="修改官员姓名"
                            >
                                <Icon name="Edit2" size={12} />
                            </button>
                        )}
                        {canEditName && isEditingName && (
                            <div className="flex items-center gap-1">
                                <button
                                    type="button"
                                    className="p-1 rounded bg-emerald-700/70 text-emerald-100 hover:bg-emerald-600/70 transition-colors"
                                    onClick={handleNameSave}
                                    title="保存姓名"
                                >
                                    <Icon name="Check" size={12} />
                                </button>
                                <button
                                    type="button"
                                    className="p-1 rounded bg-gray-700/70 text-gray-200 hover:bg-gray-600/70 transition-colors"
                                    onClick={handleNameCancel}
                                    title="取消修改"
                                >
                                    <Icon name="X" size={12} />
                                </button>
                            </div>
                        )}
                    </div>
                    {/* 派系标签 */}
                    <div className={`px-2 py-1 rounded text-xs font-semibold ${spectrumStyle.bg} ${spectrumStyle.border} ${spectrumStyle.text} border`}>
                        <Icon name={spectrumStyle.icon} size={12} className="inline mr-1" />
                        {spectrumStyle.label}
                    </div>
                    {/* 出身 */}
                    {stratumDef && (
                        <div className={`px-2 py-1 rounded text-xs ${stratumDef.color} bg-gray-800/60 border border-gray-700/50`}>
                            <Icon name={stratumDef.icon} size={12} className="inline mr-1" />
                            {stratumDef.name}出身
                        </div>
                    )}
                    {/* 威望 */}
                    {prestigeInfo && (
                        <div className={`px-2 py-1 rounded text-xs ${prestigeInfo.color} bg-gray-800/60 border border-gray-700/50`}>
                            <Icon name="Award" size={12} className="inline mr-1" />
                            {prestigeInfo.name}
                        </div>
                    )}
                </div>

                {/* 核心数据 - 四格布局 */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {/* 存款 */}
                    <div className="rounded-lg border border-amber-700/40 bg-gradient-to-br from-amber-900/30 to-gray-900/50 p-3">
                        <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-amber-400/80">
                            <Icon name="Vault" size={12} />
                            个人存款
                        </div>
                        <div className="mt-1 text-lg font-mono font-bold text-amber-300">
                            {formatNumberShortCN(wealth, { decimals: 1 })}
                        </div>
                    </div>
                    {/* 日收益 */}
                    <div className="rounded-lg border border-emerald-700/40 bg-gradient-to-br from-emerald-900/30 to-gray-900/50 p-3">
                        <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-emerald-400/80">
                            <Icon name="TrendingUp" size={12} />
                            日收益
                        </div>
                        <div className={`mt-1 text-lg font-mono font-bold ${totalIncome >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
                            {totalIncome >= 0 ? '+' : ''}{formatCost(totalIncome)}
                        </div>
                        <div className="text-[9px] text-gray-500">薪俸{salary} + 产业{propertyIncome >= 0 ? '+' : ''}{formatCost(propertyIncome)}</div>
                    </div>
                    {/* 日支出 */}
                    <div className="rounded-lg border border-orange-700/40 bg-gradient-to-br from-orange-900/30 to-gray-900/50 p-3">
                        <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-orange-400/80">
                            <Icon name="ShoppingBag" size={12} />
                            日支出
                        </div>
                        <div className="mt-1 text-lg font-mono font-bold text-orange-300">
                            {formatCost(totalExpense)}
                        </div>
                        <div className="text-[9px] text-gray-500">奢侈消费 {formatCost(luxuryExpense)}</div>
                    </div>
                    {/* 忠诚度 */}
                    <div className="rounded-lg border border-gray-700/40 bg-gradient-to-br from-gray-800/50 to-gray-900/50 p-3">
                        <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-gray-400">
                            <Icon name="Heart" size={12} />
                            忠诚度
                        </div>
                        <div className={`mt-1 text-lg font-mono font-bold ${loyaltyColor}`}>
                            {Math.round(loyalty)}
                        </div>
                        <div className="mt-1 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                            <div className={`h-full ${loyaltyBg} transition-all`} style={{ width: `${Math.min(100, loyalty)}%` }} />
                        </div>
                        {lowLoyaltyDays > 0 && (
                            <div className="text-[9px] text-red-400 mt-1">⚠ 低忠诚 {lowLoyaltyDays} 天</div>
                        )}
                    </div>
                </div>

                {/* 官员属性 */}
                <div className="rounded-lg border border-gray-700/50 bg-gray-900/40 p-3">
                    <div className="flex items-center gap-2 text-xs font-semibold text-gray-300 mb-2">
                        <Icon name="BarChart2" size={14} />
                        官员属性
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <div className="rounded-md border border-blue-700/40 bg-blue-900/20 p-2 text-center">
                            <div className="text-[10px] text-blue-300">行政</div>
                            <div className="text-sm font-mono text-blue-200">{adminValue}</div>
                        </div>
                        <div className="rounded-md border border-red-700/40 bg-red-900/20 p-2 text-center">
                            <div className="text-[10px] text-red-300">军事</div>
                            <div className="text-sm font-mono text-red-200">{militaryValue}</div>
                        </div>
                        <div className="rounded-md border border-green-700/40 bg-green-900/20 p-2 text-center">
                            <div className="text-[10px] text-green-300">外交</div>
                            <div className="text-sm font-mono text-green-200">{diplomacyValue}</div>
                        </div>
                        <div className="rounded-md border border-purple-700/40 bg-purple-900/20 p-2 text-center">
                            <div className="text-[10px] text-purple-300">威望</div>
                            <div className="text-sm font-mono text-purple-200">{prestigeValue}</div>
                        </div>
                    </div>
                </div>

                {/* 忠诚度变化原因 */}
                {loyaltyReasons.length > 0 && (
                    <div className="rounded-lg border border-gray-700/50 bg-gray-900/40 p-3">
                        <div className="flex items-center gap-2 text-xs font-semibold text-gray-300 mb-2">
                            <Icon name="Activity" size={14} />
                            忠诚度变化因素
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {loyaltyReasons.map((r, i) => (
                                <div key={i} className={`px-2 py-1 rounded text-[10px] ${r.positive ? 'bg-green-900/40 text-green-300 border-green-700/50' : 'bg-red-900/40 text-red-300 border-red-700/50'} border`}>
                                    {r.text} <span className="font-mono">{r.value > 0 ? '+' : ''}{r.value.toFixed(2)}/日</span>
                                </div>
                            ))}
                        </div>
                        {/* 净变化汇总 */}
                        <div className="mt-2 pt-2 border-t border-gray-700/50 flex items-center gap-2">
                            <span className="text-[10px] text-gray-400">每日净变化:</span>
                            <span className={`font-mono text-xs ${loyaltyReasons.reduce((sum, r) => sum + r.value, 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                {loyaltyReasons.reduce((sum, r) => sum + r.value, 0) > 0 ? '+' : ''}{loyaltyReasons.reduce((sum, r) => sum + r.value, 0).toFixed(2)}/日
                            </span>
                        </div>
                    </div>
                )}

                {/* 政治立场 */}
                {stance && (
                    <div className={`rounded-lg border ${spectrumStyle.border} ${spectrumStyle.bg} p-3`}>
                        <div className="flex items-center gap-2 text-xs font-semibold text-gray-200 mb-2">
                            <Icon name="Flag" size={14} />
                            政治立场：{stance.name}
                        </div>
                        <div className="flex flex-wrap gap-1 mb-2">
                            {(stance.issues || []).map(issueId => {
                                const issue = POLITICAL_ISSUES[issueId];
                                return issue ? (
                                    <span key={issueId} className="px-1.5 py-0.5 rounded text-[10px] bg-gray-800/60 text-gray-300 border border-gray-600/50">
                                        {issue.name}
                                    </span>
                                ) : null;
                            })}
                        </div>
                        {/* 触发条件 - 使用官员的 stanceConditionText */}
                        {official?.stanceConditionText && (
                            <div className="text-[11px] text-gray-300 mb-2 p-2 rounded bg-gray-800/50 border border-gray-700/50">
                                <span className="font-semibold text-amber-400">触发条件：</span>
                                <span className="ml-1">{official.stanceConditionText}</span>
                            </div>
                        )}
                        {/* 备选：使用 stance.condition?.description */}
                        {!official?.stanceConditionText && stance.condition?.description && (
                            <div className="text-[11px] text-gray-400 mb-2">
                                <span className="font-semibold">政治主张：</span> {stance.condition.description}
                            </div>
                        )}
                        {isStanceSatisfied !== null && (
                            <div className={`text-[11px] font-semibold mb-2 ${isStanceSatisfied ? 'text-green-400' : 'text-red-400'}`}>
                                {isStanceSatisfied ? '✓ 主张已满足' : '✗ 主张未满足'}
                            </div>
                        )}
                        {/* 满足时效果 */}
                        {stance.activeEffects && Object.keys(stance.activeEffects).length > 0 && (
                            <div className="mt-2 pt-2 border-t border-gray-700/50">
                                <div className="text-[10px] text-green-400/80 mb-1">满足时效果：</div>
                                <div className="flex flex-wrap gap-1">
                                    {Object.entries(stance.activeEffects).flatMap(([key, val]) => {
                                        const effectName = EFFECT_NAMES[key] || key;
                                        // 处理嵌套对象（如 approval: { worker: 5 }）
                                        if (typeof val === 'object' && val !== null) {
                                            return Object.entries(val).map(([target, v]) => {
                                                const targetName = getTargetDisplayName(target);
                                                const displayVal = `${v > 0 ? '+' : ''}${v}`;
                                                return (
                                                    <span key={`${key}-${target}`} className="px-1.5 py-0.5 rounded text-[10px] bg-green-900/40 text-green-300 border border-green-700/40">
                                                        {effectName}: {targetName} {displayVal}
                                                    </span>
                                                );
                                            });
                                        }
                                        const isPercent = Math.abs(val) < 2 && !['approval', 'diplomaticBonus'].includes(key);
                                        // needsReduction 正值表示减少消耗，显示为负号更直观
                                        let displayVal;
                                        if (key === 'needsReduction') {
                                            displayVal = val > 0
                                                ? `-${(val * 100).toFixed(0)}%`
                                                : `+${(Math.abs(val) * 100).toFixed(0)}%`;
                                        } else {
                                            displayVal = isPercent
                                                ? `${val > 0 ? '+' : ''}${(val * 100).toFixed(0)}%`
                                                : `${val > 0 ? '+' : ''}${val}`;
                                        }
                                        return (
                                            <span key={key} className="px-1.5 py-0.5 rounded text-[10px] bg-green-900/40 text-green-300 border border-green-700/40">
                                                {effectName} {displayVal}
                                            </span>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                        {/* 未满足时效果 */}
                        {stance.failureEffects && Object.keys(stance.failureEffects).length > 0 && (
                            <div className="mt-2 pt-2 border-t border-gray-700/50">
                                <div className="text-[10px] text-red-400/80 mb-1">未满足时惩罚：</div>
                                <div className="flex flex-wrap gap-1">
                                    {Object.entries(stance.failureEffects).flatMap(([key, val]) => {
                                        const effectName = EFFECT_NAMES[key] || key;
                                        // 处理嵌套对象（如 approval: { worker: -5 }）
                                        if (typeof val === 'object' && val !== null) {
                                            return Object.entries(val).map(([target, v]) => {
                                                const targetName = getTargetDisplayName(target);
                                                const displayVal = `${v > 0 ? '+' : ''}${v}`;
                                                return (
                                                    <span key={`${key}-${target}`} className="px-1.5 py-0.5 rounded text-[10px] bg-red-900/40 text-red-300 border border-red-700/40">
                                                        {effectName}: {targetName} {displayVal}
                                                    </span>
                                                );
                                            });
                                        }
                                        const isPercent = Math.abs(val) < 2 && !['approval', 'diplomaticBonus'].includes(key);
                                        // needsReduction 正值表示减少消耗，显示为负号更直观
                                        let displayVal;
                                        if (key === 'needsReduction') {
                                            displayVal = val > 0
                                                ? `-${(val * 100).toFixed(0)}%`
                                                : `+${(Math.abs(val) * 100).toFixed(0)}%`;
                                        } else {
                                            displayVal = isPercent
                                                ? `${val > 0 ? '+' : ''}${(val * 100).toFixed(0)}%`
                                                : `${val > 0 ? '+' : ''}${val}`;
                                        }
                                        return (
                                            <span key={key} className="px-1.5 py-0.5 rounded text-[10px] bg-red-900/40 text-red-300 border border-red-700/40">
                                                {effectName} {displayVal}
                                            </span>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* 官员效果 */}
                {displayEffects && Object.keys(displayEffects).length > 0 && (
                    <div className="rounded-lg border border-gray-700/50 bg-gray-900/40 p-3">
                        <div className="flex items-center gap-2 text-xs font-semibold text-gray-300 mb-2">
                            <Icon name="Zap" size={14} />
                            官员能力
                        </div>
                        <div className="space-y-1">
                            {/* 阶层影响力加成 */}
                            {official.stratumInfluenceBonus > 0 && (
                                <div className="flex items-center gap-1 text-[11px] text-purple-300">
                                    <Icon name="Users" size={12} className="text-purple-400" />
                                    <span>{stratumDef?.name || '阶层'}影响力 +{(official.stratumInfluenceBonus * 100).toFixed(0)}%</span>
                                </div>
                            )}
                            {/* 遍历效果对象 */}
                            {Object.entries(displayEffects).map(([type, valueOrObj]) => {
                                if (typeof valueOrObj === 'object' && valueOrObj !== null) {
                                    return Object.entries(valueOrObj).map(([target, value]) => {
                                        const targetName = getTargetDisplayName(target);
                                        const isPercent = Math.abs(value) < 2;
                                        const displayVal = isPercent
                                            ? `${value > 0 ? '+' : ''}${(value * 100).toFixed(0)}%`
                                            : `${value > 0 ? '+' : ''}${formatEffectNumber(value)}`;
                                        const isGood = ['productionInputCost', 'buildingCostMod', 'needsReduction'].includes(type) ? value < 0 : value > 0;
                                        return (
                                            <div key={`${type}-${target}`} className={`flex items-center gap-1 text-[11px] ${isGood ? 'text-green-300' : 'text-red-300'}`}>
                                                <Icon name={isGood ? "Plus" : "Minus"} size={12} className={isGood ? "text-green-500" : "text-red-500"} />
                                                <span>{EFFECT_NAMES[type] || type} ({targetName}) {displayVal}</span>
                                            </div>
                                        );
                                    });
                                } else {
                                    const value = valueOrObj;
                                    const isPercent = Math.abs(value) < 2;
                                    const displayVal = isPercent
                                        ? `${value > 0 ? '+' : ''}${(value * 100).toFixed(0)}%`
                                        : `${value > 0 ? '+' : ''}${formatEffectNumber(value)}`;
                                    const isGood = ['productionInputCost', 'buildingCostMod', 'needsReduction'].includes(type) ? value < 0 : value > 0;
                                    return (
                                        <div key={type} className={`flex items-center gap-1 text-[11px] ${isGood ? 'text-green-300' : 'text-red-300'}`}>
                                            <Icon name={isGood ? "Plus" : "Minus"} size={12} className={isGood ? "text-green-500" : "text-red-500"} />
                                            <span>{EFFECT_NAMES[type] || type} {displayVal}</span>
                                        </div>
                                    );
                                }
                            })}
                        </div>
                    </div>
                )}

                {/* 产业持有 */}
                <div className="rounded-lg border border-gray-700/50 bg-gray-900/40 p-3">
                    <div className="flex items-center justify-between text-xs font-semibold text-gray-300 mb-2">
                        <div className="flex items-center gap-2">
                            <Icon name="Building" size={14} />
                            产业持有
                        </div>
                        <span className="text-emerald-300 font-mono">日收益 +{formatCost(propertyIncome)}</span>
                    </div>
                    {propertyRows.length > 0 ? (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1">
                            {propertyRows.map(row => (
                                <div key={row.buildingId} className="flex items-center justify-between text-[11px] text-gray-300 px-2 py-1 bg-gray-800/40 rounded">
                                    <span>{row.buildingName}</span>
                                    <span className="text-emerald-300">×{row.count}</span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-[11px] text-gray-500">暂无产业持有</div>
                    )}
                </div>

                {/* 薪俸设置 */}
                <div className="rounded-lg border border-gray-700/50 bg-gray-900/40 p-3">
                    <div className="flex items-center gap-2 text-xs font-semibold text-gray-300 mb-2">
                        <Icon name="Coins" size={14} />
                        薪俸设置
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <input
                            type="number"
                            inputMode="numeric"
                            value={salaryDraft}
                            onChange={(e) => setSalaryDraft(e.target.value)}
                            onFocus={() => setIsEditingSalary(true)}
                            onBlur={() => setIsEditingSalary(false)}
                            className="w-28 bg-gray-800/70 border border-gray-600 text-sm text-gray-200 rounded px-2 py-1 focus:ring-1 focus:ring-amber-400 focus:border-amber-400 text-center"
                        />
                        <button
                            className={`px-3 py-1 rounded text-xs font-semibold ${canEditSalary ? 'bg-amber-600/80 hover:bg-amber-500 text-white' : 'bg-gray-700 text-gray-400 cursor-not-allowed'}`}
                            disabled={!canEditSalary}
                            onClick={() => {
                                if (!canEditSalary || !Number.isFinite(parsedSalaryDraft)) return;
                                const nextSalary = Math.floor(parsedSalaryDraft);
                                pendingSalaryRef.current = nextSalary; // Mark as pending to prevent reset
                                onUpdateSalary(official.id, nextSalary);
                                setSalaryDraft(String(nextSalary));
                                setIsEditingSalary(false);
                            }}
                        >
                            保存薪俸
                        </button>
                    </div>
                </div>

                {/* 开销明细（折叠） */}
                {expenseRows.length > 0 && (
                    <details className="rounded-lg border border-gray-700/50 bg-gray-900/40">
                        <summary className="p-3 cursor-pointer text-xs font-semibold text-gray-300 flex items-center gap-2">
                            <Icon name="ShoppingBag" size={14} />
                            开销明细（点击展开）
                        </summary>
                        <div className="px-3 pb-3 space-y-1">
                            {expenseRows.map(row => (
                                <div key={row.resource} className="flex items-center justify-between text-[11px] text-gray-300">
                                    <span>{row.name} × {row.amount.toFixed(2)}</span>
                                    <span className="font-mono text-amber-200">{formatCost(row.cost)}</span>
                                </div>
                            ))}
                        </div>
                    </details>
                )}
            </div>
        </Modal>
    );
};
