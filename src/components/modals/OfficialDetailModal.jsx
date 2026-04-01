import React, { useMemo, useState, useEffect, useRef } from 'react';
import { Modal } from '../common/UnifiedUI';
import { Icon } from '../common/UIComponents';
import { BUILDINGS, RESOURCES, STRATA } from '../../config';
import { POLITICAL_STANCES, POLITICAL_ISSUES } from '../../config/politicalStances';
import { calculatePrestige, getPrestigeLevel } from '../../logic/officials/manager';
import { LOYALTY_CONFIG, PROPERTY_POLICY_CONFIG } from '../../config/officials';
import { formatNumberShortCN } from '../../utils/numberFormat';
import { calculateEfficiencyBonus, calculateManagementFee, calculateCorruptionLoss } from '../../logic/officials/officialInvestment';

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
    taxBonus: '税收加成',
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
    wartimeProduction: '战时生产',
    warProductionBonus: '战时生产',
    factionConflict: '派系冲突',
    corruption: '腐败',
    corruptionMod: '腐败程度',
    resourceWaste: '资源浪费',
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

export const OfficialDetailModal = ({
    isOpen,
    onClose,
    official,
    onUpdateSalary,
    onUpdateName,
    currentDay = 0,
    isStanceSatisfied = null,
    stability = 50,
    officialsPaid = true,
    buildingCounts = {},
    buildingFinancialData = {},
    onChangePolicy,
}) => {
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

    // 产业汇总：直接读取 _propertySummary（simulation 已维护）
    const propertySummary = useMemo(() => {
        const ps = official?._propertySummary;
        if (!ps) return {};
        const summary = {};
        Object.entries(ps.byBuildingLevel || {}).forEach(([buildingId, levels]) => {
            summary[buildingId] = { count: ps.byBuilding?.[buildingId] || 0, levels: levels || {} };
        });
        Object.entries(ps.byBuilding || {}).forEach(([buildingId, count]) => {
            if (!summary[buildingId]) summary[buildingId] = { count, levels: { 0: count } };
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

    const propertyProfitRows = useMemo(() => {
        const ps = official?._propertySummary;
        if (!ps?.byBuilding) return [];
        const rows = {};
        Object.entries(ps.byBuilding).forEach(([buildingId, count]) => {
            if (!count) return;
            const finance = buildingFinancialData?.[buildingId];
            const ownerRevenue = finance?.ownerRevenue || 0;
            const productionCosts = finance?.productionCosts || 0;
            const businessTaxPaid = finance?.businessTaxPaid || 0;
            const totalWagesPaid = Object.values(finance?.wagesByRole || {})
                .reduce((sum, val) => sum + (Number.isFinite(val) ? val : 0), 0);
            const totalProfit = ownerRevenue - productionCosts - businessTaxPaid - totalWagesPaid;
            const totalBuildingCount = buildingCounts?.[buildingId] || 0;
            const perBuildingProfit = totalBuildingCount > 0 ? totalProfit / totalBuildingCount : 0;
            const building = BUILDINGS.find(b => b.id === buildingId);
            rows[buildingId] = {
                buildingId,
                buildingName: building?.name || buildingId,
                count,
                perBuildingProfit,
                profit: perBuildingProfit * count,
                hasActual: !!finance,
            };
        });
        return Object.values(rows)
            .sort((a, b) => b.profit - a.profit);
    }, [official, buildingFinancialData, buildingCounts]);

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
    const headTaxPaid = typeof official?.lastDayHeadTaxPaid === 'number' ? official.lastDayHeadTaxPaid : 0;
    const investmentCost = typeof official?.lastDayInvestmentCost === 'number' ? official.lastDayInvestmentCost : 0;
    const upgradeCost = typeof official?.lastDayUpgradeCost === 'number' ? official.lastDayUpgradeCost : 0;
    const corruptionIncome = typeof official?.lastDayCorruptionIncome === 'number' ? official.lastDayCorruptionIncome : 0;
    const netChange = typeof official?.lastDayNetChange === 'number'
        ? official.lastDayNetChange
        : (totalIncome - totalExpense - headTaxPaid - investmentCost - upgradeCost + corruptionIncome);

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
    const stanceActiveEffects = (official?.stanceActiveEffects && Object.keys(official.stanceActiveEffects).length > 0)
        ? official.stanceActiveEffects
        : stance?.activeEffects;
    const stanceFailureEffects = (official?.stanceUnsatisfiedPenalty && Object.keys(official.stanceUnsatisfiedPenalty).length > 0)
        ? official.stanceUnsatisfiedPenalty
        : stance?.failureEffects;

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

    // 优先使用UI层实时重算结果，避免显示滞后；
    // 若无实时值再回退到模拟端缓存值（旧存档兼容）
    const derivedStanceSatisfied = isStanceSatisfied ?? official?.isStanceSatisfied ?? null;

    // 忠诚度变化原因分析
    const loyaltyReasons = useMemo(() => {
        // 优先使用模拟端计算好的数据
        if (official?.loyaltyChangeFactors && Array.isArray(official.loyaltyChangeFactors)) {
            const factorTextMap = {
                'stanceSatisfied': '政治诉求满足',
                'stanceUnsatisfied': '政治诉求未满足',
                'financialSatisfied': '财务状况良好',
                'financialUncomfortable': '生活拮据',
                'financialStruggling': '入不敷出',
                'financialDesperate': '濒临破产',
                'stabilityHigh': '国家稳定',
                'stabilityLow': '国家动荡',
                'salaryPaid': '薪资按时发放',
                'salaryUnpaid': '薪资未发放',
            };

            return official.loyaltyChangeFactors.map(factor => ({
                text: factorTextMap[factor.factor] || factor.factor,
                value: factor.value,
                positive: factor.value > 0,
            }));
        }

        // 降级方案：如果没有loyaltyChangeFactors（旧存档兼容），使用原来的计算逻辑
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

    // Tab 状态
    const [activeTab, setActiveTab] = useState('overview');

    // 产业政策相关计算（Tab2共用）
    const officialPolicy = official?.propertyPolicy || 'private';
    const policyConfig = PROPERTY_POLICY_CONFIG[officialPolicy] || PROPERTY_POLICY_CONFIG.private;
    const managedSummaryData = official?._managedSummary || { byBuilding: {}, totalCount: 0 };
    const managedCount = managedSummaryData.totalCount || 0;
    const managementFee = typeof official?.lastDayManagementFee === 'number' ? official.lastDayManagementFee : 0;
    const cooldownRemaining = Math.max(0, (policyConfig.switchCooldown || 90) - (currentDay - (official?.lastPolicyChangeDay ?? -999)));
    const canSwitch = cooldownRemaining <= 0;
    const policyColors = {
        private: { bg: 'bg-gray-800/60', border: 'border-gray-600/50', text: 'text-gray-300', activeBg: 'bg-emerald-700', activeText: 'text-white', icon: 'Building' },
        high_salary: { bg: 'bg-blue-900/30', border: 'border-blue-700/50', text: 'text-blue-300', activeBg: 'bg-blue-600', activeText: 'text-white', icon: 'DollarSign' },
        state_managed: { bg: 'bg-amber-900/30', border: 'border-amber-700/50', text: 'text-amber-300', activeBg: 'bg-amber-600', activeText: 'text-white', icon: 'Building2' },
    };

    // 属性进度条配置
    const attrBars = [
        { label: '行政', value: adminValue, color: 'bg-blue-500', textColor: 'text-blue-300', borderColor: 'border-blue-700/40' },
        { label: '军事', value: militaryValue, color: 'bg-red-500', textColor: 'text-red-300', borderColor: 'border-red-700/40' },
        { label: '外交', value: diplomacyValue, color: 'bg-green-500', textColor: 'text-green-300', borderColor: 'border-green-700/40' },
        { label: '威望', value: prestigeValue, color: 'bg-purple-500', textColor: 'text-purple-300', borderColor: 'border-purple-700/40' },
    ];

    // Tab 配置
    const tabs = [
        { id: 'overview', label: '概览', icon: 'BarChart2' },
        { id: 'economy', label: '产业与财务', icon: 'Briefcase' },
        { id: 'politics', label: '政治立场', icon: 'Flag' },
    ];

    // 效果好坏判断函数（复用于Tab1）
    const negativeIsGoodTypes = [
        'productionInputCost', 'buildingCostMod', 'resourceWaste',
        'militaryUpkeep', 'diplomaticCooldown', 'stratumDemandMod',
        'resourceDemandMod', 'organizationDecay', 'corruption',
        'factionConflict', 'diplomaticIncident', 'wageModifier',
        'corruptionMod'
    ];
    const getEffectStatus = (t, v) => negativeIsGoodTypes.includes(t) ? v < 0 : v > 0;

    // 立场效果渲染辅助
    const renderStanceEffectBadges = (effects, isActive) => {
        if (!effects || Object.keys(effects).length === 0) return null;
        return Object.entries(effects).flatMap(([key, val]) => {
            const effectName = EFFECT_NAMES[key] || key;
            if (typeof val === 'object' && val !== null) {
                return Object.entries(val).map(([target, v]) => {
                    const targetName = getTargetDisplayName(target);
                    const displayVal = `${v > 0 ? '+' : ''}${v}`;
                    return (
                        <span key={`${key}-${target}`} className={`px-1.5 py-0.5 rounded text-xs border ${isActive ? 'bg-green-900/40 text-green-300 border-green-700/40' : 'bg-red-900/40 text-red-300 border-red-700/40'}`}>
                            {effectName}: {targetName} {displayVal}
                        </span>
                    );
                });
            }
            const isPercent = Math.abs(val) < 2 && !['approval', 'diplomaticBonus'].includes(key);
            let displayVal;
            if (key === 'needsReduction') {
                displayVal = val > 0 ? `-${(val * 100).toFixed(0)}%` : `+${(Math.abs(val) * 100).toFixed(0)}%`;
            } else {
                displayVal = isPercent ? `${val > 0 ? '+' : ''}${(val * 100).toFixed(0)}%` : `${val > 0 ? '+' : ''}${val}`;
            }
            return (
                <span key={key} className={`px-1.5 py-0.5 rounded text-xs border ${isActive ? 'bg-green-900/40 text-green-300 border-green-700/40' : 'bg-red-900/40 text-red-300 border-red-700/40'}`}>
                    {effectName} {displayVal}
                </span>
            );
        });
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`${displayName} · 详细信息`} size="xl">
            <div className="space-y-3">
                {/* ===== 顶栏：姓名 + 标签 ===== */}
                <div className="flex flex-wrap items-center gap-2 pb-2 border-b border-gray-700/50">
                    <div className="flex items-center gap-2 min-w-[140px]">
                        {isEditingName ? (
                            <input
                                value={nameDraft}
                                onChange={(event) => setNameDraft(event.target.value)}
                                onKeyDown={(event) => {
                                    if (event.key === 'Enter') handleNameSave();
                                    if (event.key === 'Escape') handleNameCancel();
                                }}
                                maxLength={20}
                                className="w-36 bg-gray-900/60 border border-gray-600/60 rounded px-2 py-1 text-sm text-gray-100 focus:outline-none focus:ring-1 focus:ring-emerald-400/60"
                                placeholder="输入官员姓名"
                            />
                        ) : (
                            <div className="text-base font-semibold text-gray-100 truncate max-w-[10rem]">
                                {displayName}
                            </div>
                        )}
                        {canEditName && !isEditingName && (
                            <button type="button" className="p-1 rounded bg-gray-800/70 text-gray-300 hover:text-emerald-300 hover:bg-gray-700/70 transition-colors" onClick={() => setIsEditingName(true)} title="修改官员姓名">
                                <Icon name="Edit2" size={12} />
                            </button>
                        )}
                        {canEditName && isEditingName && (
                            <div className="flex items-center gap-1">
                                <button type="button" className="p-1 rounded bg-emerald-700/70 text-emerald-100 hover:bg-emerald-600/70 transition-colors" onClick={handleNameSave} title="保存姓名">
                                    <Icon name="Check" size={12} />
                                </button>
                                <button type="button" className="p-1 rounded bg-gray-700/70 text-gray-200 hover:bg-gray-600/70 transition-colors" onClick={handleNameCancel} title="取消修改">
                                    <Icon name="X" size={12} />
                                </button>
                            </div>
                        )}
                    </div>
                    <div className={`px-2 py-0.5 rounded text-xs font-semibold ${spectrumStyle.bg} ${spectrumStyle.border} ${spectrumStyle.text} border`}>
                        <Icon name={spectrumStyle.icon} size={10} className="inline mr-0.5" />
                        {spectrumStyle.label}
                    </div>
                    {stratumDef && (
                        <div className={`px-2 py-0.5 rounded text-xs ${stratumDef.color} bg-gray-800/60 border border-gray-700/50`}>
                            {stratumDef.name}出身
                        </div>
                    )}
                    {prestigeInfo && (
                        <div className={`px-2 py-0.5 rounded text-xs ${prestigeInfo.color} bg-gray-800/60 border border-gray-700/50`}>
                            {prestigeInfo.name}
                        </div>
                    )}
                </div>

                {/* ===== 核心数据四格 ===== */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div className="rounded-lg border border-amber-700/40 bg-gradient-to-br from-amber-900/30 to-gray-900/50 p-2">
                        <div className="flex items-center gap-1 text-xs text-amber-400/80">
                            <Icon name="Vault" size={10} /> 存款
                        </div>
                        <div className="text-sm font-mono font-bold text-amber-300">{formatNumberShortCN(wealth, { decimals: 1 })}</div>
                    </div>
                    <div className="rounded-lg border border-emerald-700/40 bg-gradient-to-br from-emerald-900/30 to-gray-900/50 p-2">
                        <div className="flex items-center gap-1 text-xs text-emerald-400/80">
                            <Icon name="TrendingUp" size={10} /> 日收益
                        </div>
                        <div className={`text-sm font-mono font-bold ${totalIncome >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
                            {totalIncome >= 0 ? '+' : ''}{formatCost(totalIncome)}
                        </div>
                    </div>
                    <div className="rounded-lg border border-orange-700/40 bg-gradient-to-br from-orange-900/30 to-gray-900/50 p-2">
                        <div className="flex items-center gap-1 text-xs text-orange-400/80">
                            <Icon name="ShoppingBag" size={10} /> 日支出
                        </div>
                        <div className="text-sm font-mono font-bold text-orange-300">{formatCost(totalExpense)}</div>
                    </div>
                    <div className="rounded-lg border border-gray-700/40 bg-gradient-to-br from-gray-800/50 to-gray-900/50 p-2">
                        <div className="flex items-center gap-1 text-xs text-gray-400">
                            <Icon name="Heart" size={10} /> 忠诚
                        </div>
                        <div className={`text-sm font-mono font-bold ${loyaltyColor}`}>{Math.round(loyalty)}</div>
                        <div className="mt-0.5 h-1 bg-gray-700 rounded-full overflow-hidden">
                            <div className={`h-full ${loyaltyBg} transition-all`} style={{ width: `${Math.min(100, loyalty)}%` }} />
                        </div>
                    </div>
                </div>

                {/* ===== Tab 切换栏 ===== */}
                <div className="flex border-b border-gray-700/50">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex-1 flex items-center justify-center gap-1 py-2 text-xs font-semibold transition-colors border-b-2 ${
                                activeTab === tab.id
                                    ? 'text-emerald-400 border-emerald-400'
                                    : 'text-gray-500 border-transparent hover:text-gray-300 hover:border-gray-600'
                            }`}
                        >
                            <Icon name={tab.icon} size={12} />
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* ===== Tab 内容 ===== */}

                {/* Tab1: 概览 */}
                {activeTab === 'overview' && (
                    <div className="space-y-3">
                        {/* 属性进度条 */}
                        <div className="rounded-lg border border-gray-700/50 bg-gray-900/40 p-3">
                            <div className="flex items-center gap-2 text-xs font-semibold text-gray-300 mb-2">
                                <Icon name="BarChart2" size={14} />
                                官员属性
                                {(official?.level || 1) > 1 && (
                                    <span className="ml-1 px-1.5 py-0.5 bg-purple-900/50 text-purple-300 rounded text-xs">Lv.{official.level}</span>
                                )}
                                {official?.ambition > 50 && (
                                    <span className="ml-1 px-1.5 py-0.5 bg-orange-900/50 text-orange-300 rounded text-xs">
                                        <Icon name="Flame" size={8} className="inline" /> 野心 {official.ambition}
                                    </span>
                                )}
                            </div>
                            <div className="space-y-1.5">
                                {attrBars.map(attr => (
                                    <div key={attr.label} className="flex items-center gap-2">
                                        <span className={`w-8 text-xs font-medium ${attr.textColor} text-right`}>{attr.label}</span>
                                        <div className={`flex-1 h-3 bg-gray-700/60 rounded-full overflow-hidden border ${attr.borderColor}`}>
                                            <div
                                                className={`h-full ${attr.color} transition-all duration-500 rounded-full`}
                                                style={{ width: `${Math.min(100, attr.value)}%` }}
                                            />
                                        </div>
                                        <span className={`w-8 text-xs font-mono font-bold ${attr.textColor} text-right`}>{attr.value}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* 忠诚度变化因素 */}
                        {loyaltyReasons.length > 0 && (
                            <div className="rounded-lg border border-gray-700/50 bg-gray-900/40 p-3">
                                <div className="flex items-center gap-2 text-xs font-semibold text-gray-300 mb-2">
                                    <Icon name="Activity" size={14} />
                                    忠诚度变化因素
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                    {loyaltyReasons.map((r, i) => (
                                        <div key={i} className={`px-2 py-1 rounded text-xs ${r.positive ? 'bg-green-900/40 text-green-300 border-green-700/50' : 'bg-red-900/40 text-red-300 border-red-700/50'} border`}>
                                            {r.text} <span className="font-mono">{r.value > 0 ? '+' : ''}{r.value.toFixed(2)}/日</span>
                                        </div>
                                    ))}
                                </div>
                                <div className="mt-2 pt-2 border-t border-gray-700/50 flex items-center gap-2">
                                    <span className="text-xs text-gray-400">每日净变化:</span>
                                    <span className={`font-mono text-xs ${loyaltyReasons.reduce((sum, r) => sum + r.value, 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                        {loyaltyReasons.reduce((sum, r) => sum + r.value, 0) > 0 ? '+' : ''}{loyaltyReasons.reduce((sum, r) => sum + r.value, 0).toFixed(2)}/日
                                    </span>
                                </div>
                            </div>
                        )}

                        {/* 官员能力/效果 */}
                        {(displayEffects && Object.keys(displayEffects).length > 0 || official?.stratumInfluenceBonus > 0) && (
                            <div className="rounded-lg border border-gray-700/50 bg-gray-900/40 p-3">
                                <div className="flex items-center gap-2 text-xs font-semibold text-gray-300 mb-2">
                                    <Icon name="Zap" size={14} />
                                    官员能力
                                </div>
                                <div className="space-y-1">
                                    {official?.stratumInfluenceBonus > 0 && (
                                        <div className="flex items-center gap-1 text-xs text-purple-300">
                                            <Icon name="Users" size={12} className="text-purple-400" />
                                            <span>{stratumDef?.name || '阶层'}影响力 +{(official.stratumInfluenceBonus * 100).toFixed(0)}%</span>
                                        </div>
                                    )}
                                    {Object.entries(displayEffects).map(([type, valueOrObj]) => {
                                        if (typeof valueOrObj === 'object' && valueOrObj !== null) {
                                            return Object.entries(valueOrObj).map(([target, value]) => {
                                                const targetName = getTargetDisplayName(target);
                                                const isPercent = Math.abs(value) < 2;
                                                const displayVal = isPercent
                                                    ? `${value > 0 ? '+' : ''}${(value * 100).toFixed(0)}%`
                                                    : `${value > 0 ? '+' : ''}${formatEffectNumber(value)}`;
                                                const isGood = getEffectStatus(type, value);
                                                return (
                                                    <div key={`${type}-${target}`} className={`flex items-center gap-1 text-xs ${isGood ? 'text-green-300' : 'text-red-300'}`}>
                                                        <Icon name={isGood ? "Plus" : "Minus"} size={12} className={isGood ? "text-green-500" : "text-red-500"} />
                                                        <span>{EFFECT_NAMES[type] || type} ({targetName}) {displayVal}</span>
                                                    </div>
                                                );
                                            });
                                        }
                                        const value = valueOrObj;
                                        const isPercent = Math.abs(value) < 2;
                                        let displayVal;
                                        if (type === 'needsReduction') {
                                            displayVal = value > 0 ? `-${(Math.abs(value) * 100).toFixed(0)}%` : `+${(Math.abs(value) * 100).toFixed(0)}%`;
                                        } else {
                                            displayVal = isPercent
                                                ? `${value > 0 ? '+' : ''}${(value * 100).toFixed(0)}%`
                                                : `${value > 0 ? '+' : ''}${formatEffectNumber(value)}`;
                                        }
                                        const isGood = getEffectStatus(type, value);
                                        return (
                                            <div key={type} className={`flex items-center gap-1 text-xs ${isGood ? 'text-green-300' : 'text-red-300'}`}>
                                                <Icon name={isGood ? "Plus" : "Minus"} size={12} className={isGood ? "text-green-500" : "text-red-500"} />
                                                <span>{EFFECT_NAMES[type] || type} {displayVal}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Tab2: 产业与财务 */}
                {activeTab === 'economy' && (
                    <div className="space-y-3">
                        {/* 产业政策三选一大按钮（置顶突出） */}
                        <div className={`rounded-lg border ${policyColors[officialPolicy]?.border || 'border-gray-700/50'} bg-gray-900/40 p-3`}>
                            <div className="flex items-center justify-between text-xs font-semibold text-gray-300 mb-2">
                                <div className="flex items-center gap-2">
                                    <Icon name="Settings" size={14} />
                                    产业政策
                                </div>
                                {!canSwitch && (
                                    <span className="text-xs text-gray-500">冷却 {cooldownRemaining}天</span>
                                )}
                            </div>
                            {onChangePolicy && (
                                <div className="grid grid-cols-3 gap-2 mb-2">
                                    {Object.entries(PROPERTY_POLICY_CONFIG).map(([key, config]) => {
                                        const isActive = officialPolicy === key;
                                        const colors = policyColors[key];
                                        return (
                                            <button
                                                key={key}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (!isActive && canSwitch) onChangePolicy(official.id, key);
                                                }}
                                                disabled={isActive || !canSwitch}
                                                className={`flex flex-col items-center gap-1 py-3 px-2 rounded-lg text-xs font-semibold transition-all border-2 ${
                                                    isActive
                                                        ? `${colors.activeBg} ${colors.activeText} border-transparent ring-2 ring-offset-1 ring-offset-gray-900 ${key === 'private' ? 'ring-emerald-500/50' : key === 'high_salary' ? 'ring-blue-500/50' : 'ring-amber-500/50'}`
                                                        : canSwitch
                                                            ? `${colors.bg} ${colors.text} ${colors.border} hover:brightness-125 cursor-pointer hover:scale-[1.02]`
                                                            : 'bg-gray-800/30 text-gray-500 border-gray-700/30 cursor-not-allowed'
                                                }`}
                                                title={config.description}
                                            >
                                                <Icon name={colors.icon} size={18} />
                                                <span>{config.name}</span>
                                                {isActive && <span className="text-xs opacity-70">当前</span>}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                            <div className="text-xs text-gray-400">{policyConfig.description}</div>
                        </div>

                        {/* 产业持有/代管列表 */}
                        <div className="rounded-lg border border-gray-700/50 bg-gray-900/40 p-3">
                            {officialPolicy === 'high_salary' ? (
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2 text-xs font-semibold text-blue-300 mb-1">
                                        <Icon name="DollarSign" size={14} />
                                        高薪养廉
                                    </div>
                                    <div className="flex items-center justify-between text-xs text-blue-300 px-2 py-1 bg-blue-900/20 rounded">
                                        <span>薪资倍率</span>
                                        <span className="font-mono">×{policyConfig.salaryMultiplier}</span>
                                    </div>
                                    <div className="text-xs text-gray-500">禁止置办任何产业，以高薪补偿</div>
                                </div>
                            ) : officialPolicy === 'state_managed' ? (
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2 text-xs font-semibold text-amber-300 mb-1">
                                        <Icon name="Building2" size={14} />
                                        代管国有产业
                                    </div>
                                    {official && (
                                        <div className="grid grid-cols-2 gap-1 text-xs">
                                            <div className="flex items-center justify-between px-2 py-1 bg-amber-900/15 rounded text-amber-200">
                                                <span>经营效率</span>
                                                <span className="font-mono">×{calculateEfficiencyBonus(official).toFixed(2)}</span>
                                            </div>
                                            <div className="flex items-center justify-between px-2 py-1 bg-amber-900/15 rounded text-amber-200">
                                                <span>管理费分成</span>
                                                <span className="font-mono">{(calculateManagementFee(official) * 100).toFixed(0)}%</span>
                                            </div>
                                            <div className="flex items-center justify-between px-2 py-1 bg-red-900/15 rounded text-red-300">
                                                <span>腐败损耗</span>
                                                <span className="font-mono">{(calculateCorruptionLoss(official) * 100).toFixed(0)}%</span>
                                            </div>
                                            {managementFee > 0 && (
                                                <div className="flex items-center justify-between px-2 py-1 bg-emerald-900/15 rounded text-emerald-300">
                                                    <span>昨日管理费</span>
                                                    <span className="font-mono">+{formatCost(managementFee)}</span>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                    {managedCount > 0 ? (
                                        <div>
                                            <div className="text-xs text-amber-400 mb-1">代管建筑 ({managedCount})</div>
                                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1">
                                                {Object.entries(managedSummaryData.byBuilding || {}).map(([buildingId, count]) => {
                                                    const buildingName = BUILDINGS.find(b => b.id === buildingId)?.name || buildingId;
                                                    return (
                                                        <div key={buildingId} className="flex items-center justify-between text-xs text-amber-200 px-2 py-1 bg-amber-900/20 rounded">
                                                            <span>🏛️ {buildingName}</span>
                                                            <span>×{count}</span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="text-xs text-gray-500">暂无代管产业</div>
                                    )}
                                </div>
                            ) : (
                                <div>
                                    <div className="flex items-center justify-between text-xs font-semibold text-gray-300 mb-1">
                                        <div className="flex items-center gap-2">
                                            <Icon name="Building" size={14} />
                                            产业持有
                                        </div>
                                        <span className="text-emerald-300 font-mono">日收益 {propertyIncome >= 0 ? '+' : ''}{formatCost(propertyIncome)}</span>
                                    </div>
                                    {propertyRows.length > 0 ? (
                                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1">
                                            {propertyRows.map(row => (
                                                <div key={row.buildingId} className="flex items-center justify-between text-xs text-gray-300 px-2 py-1 bg-gray-800/40 rounded">
                                                    <span>{row.buildingName}</span>
                                                    <span className="text-emerald-300">×{row.count}</span>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="text-xs text-gray-500">暂无产业持有</div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* 收支明细 */}
                        <div className="rounded-lg border border-gray-700/40 bg-gray-900/40 p-2.5 text-xs text-gray-400">
                            <div className="flex items-center justify-between mb-1">
                                <span className="font-semibold text-gray-300">每日净变化</span>
                                <span className={`font-mono ${netChange >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
                                    {netChange >= 0 ? '+' : ''}{formatCost(netChange)}
                                </span>
                            </div>
                            <div className="flex flex-wrap gap-2 text-xs text-gray-500">
                                <span>薪俸 {salary}</span>
                                <span>产业 {propertyIncome >= 0 ? '+' : ''}{formatCost(propertyIncome)}</span>
                                <span>消费 -{formatCost(totalExpense)}</span>
                                <span>税 -{formatCost(headTaxPaid)}</span>
                                {investmentCost > 0 && <span>投资 -{formatCost(investmentCost)}</span>}
                                {upgradeCost > 0 && <span>升级 -{formatCost(upgradeCost)}</span>}
                                {corruptionIncome > 0 && <span className="text-emerald-400">腐败 +{formatCost(corruptionIncome)}</span>}
                            </div>
                        </div>

                        {/* 薪俸设置 */}
                        <div className="rounded-lg border border-gray-700/50 bg-gray-900/40 p-3">
                            <div className="flex items-center gap-2 text-xs font-semibold text-gray-300 mb-2">
                                <Icon name="Coins" size={14} />
                                薪俸设置
                                {salary < 0 && (
                                    <span className="text-xs text-amber-400 bg-amber-900/30 px-2 py-0.5 rounded border border-amber-700/50">
                                        负薪酬：每日缴纳 {Math.abs(salary)} 银
                                    </span>
                                )}
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                                <input
                                    type="number"
                                    inputMode="numeric"
                                    value={salaryDraft}
                                    onChange={(e) => setSalaryDraft(e.target.value)}
                                    onFocus={() => setIsEditingSalary(true)}
                                    onBlur={() => {
                                        setTimeout(() => {
                                            if (!pendingSalaryRef.current) setIsEditingSalary(false);
                                        }, 150);
                                    }}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && canEditSalary && Number.isFinite(parsedSalaryDraft)) {
                                            const nextSalary = Math.floor(parsedSalaryDraft);
                                            pendingSalaryRef.current = nextSalary;
                                            onUpdateSalary(official.id, nextSalary);
                                            setSalaryDraft(String(nextSalary));
                                            setIsEditingSalary(false);
                                            e.target.blur();
                                        }
                                    }}
                                    placeholder="可输入负数"
                                    className="w-28 bg-gray-800/70 border border-gray-600 text-sm text-gray-200 rounded px-2 py-1 focus:ring-1 focus:ring-amber-400 focus:border-amber-400 text-center"
                                />
                                <button
                                    type="button"
                                    className={`px-3 py-1 rounded text-xs font-semibold ${canEditSalary && Number.isFinite(parsedSalaryDraft) ? 'bg-amber-600/80 hover:bg-amber-500 text-white' : 'bg-gray-700 text-gray-400 cursor-not-allowed'}`}
                                    disabled={!canEditSalary || !Number.isFinite(parsedSalaryDraft)}
                                    onClick={(e) => {
                                        e.preventDefault();
                                        if (!canEditSalary || !Number.isFinite(parsedSalaryDraft)) return;
                                        const nextSalary = Math.floor(parsedSalaryDraft);
                                        pendingSalaryRef.current = nextSalary;
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
                                        <div key={row.resource} className="flex items-center justify-between text-xs text-gray-300">
                                            <span>{row.name} × {row.amount.toFixed(2)}</span>
                                            <span className="font-mono text-amber-200">{formatCost(row.cost)}</span>
                                        </div>
                                    ))}
                                </div>
                            </details>
                        )}
                    </div>
                )}

                {/* Tab3: 政治立场 */}
                {activeTab === 'politics' && (
                    <div className="space-y-3">
                        {stance ? (
                            <div className={`rounded-lg border ${spectrumStyle.border} ${spectrumStyle.bg} p-3`}>
                                {/* 立场名称 + 状态 */}
                                <div className="flex items-center gap-2 mb-2">
                                    <Icon name={stance.icon || 'Flag'} size={16} className={spectrumStyle.text} />
                                    <span className="text-sm font-bold text-gray-100">{stance.name}</span>
                                    {derivedStanceSatisfied !== null && (
                                        <span className={`px-2 py-0.5 rounded text-xs font-semibold ${derivedStanceSatisfied ? 'bg-green-900/40 text-green-300 border border-green-700/40' : 'bg-red-900/40 text-red-300 border border-red-700/40'}`}>
                                            {derivedStanceSatisfied ? '✓ 已满足' : '✗ 未满足'}
                                        </span>
                                    )}
                                </div>

                                {/* 政治议题 */}
                                {stance.issues && stance.issues.length > 0 && (
                                    <div className="flex flex-wrap gap-1 mb-2">
                                        {stance.issues.map(issueId => {
                                            const issue = POLITICAL_ISSUES[issueId];
                                            return issue ? (
                                                <span key={issueId} className="px-1.5 py-0.5 rounded text-xs bg-gray-800/60 text-gray-300 border border-gray-600/50">
                                                    {issue.name}
                                                </span>
                                            ) : null;
                                        })}
                                    </div>
                                )}

                                {/* 触发条件 */}
                                {(official?.stanceConditionText || stance.condition?.description) && (
                                    <div className="text-xs text-gray-300 mb-3 p-2 rounded bg-gray-800/50 border border-gray-700/50">
                                        <span className="font-semibold text-amber-400">触发条件：</span>
                                        <span className="ml-1">{official?.stanceConditionText || stance.condition?.description}</span>
                                    </div>
                                )}

                                {/* 满足时效果 */}
                                {stanceActiveEffects && Object.keys(stanceActiveEffects).length > 0 && (
                                    <div className="pt-2 border-t border-gray-700/50">
                                        <div className="text-xs text-green-400/80 mb-1 font-semibold">满足时效果：</div>
                                        <div className="flex flex-wrap gap-1">
                                            {renderStanceEffectBadges(stanceActiveEffects, true)}
                                        </div>
                                    </div>
                                )}

                                {/* 未满足惩罚 */}
                                {stanceFailureEffects && Object.keys(stanceFailureEffects).length > 0 && (
                                    <div className="mt-2 pt-2 border-t border-gray-700/50">
                                        <div className="text-xs text-red-400/80 mb-1 font-semibold">未满足时惩罚：</div>
                                        <div className="flex flex-wrap gap-1">
                                            {renderStanceEffectBadges(stanceFailureEffects, false)}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="rounded-lg border border-gray-700/50 bg-gray-900/40 p-6 text-center">
                                <Icon name="Flag" size={24} className="text-gray-600 mx-auto mb-2" />
                                <div className="text-sm text-gray-500">该官员无政治立场</div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </Modal>
    );
};
