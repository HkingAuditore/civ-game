import React, { useState, memo } from 'react';
import { Icon } from '../common/UIComponents';
import { STRATA, RESOURCES } from '../../config';
import { formatEffectDetails } from '../../utils/effectFormatter';
import { isResourceUnlocked } from '../../utils/resources';
import { calculateLivingStandardData, calculateWealthMultiplier, calculateUnlockMultiplier, calculateLuxuryConsumptionMultiplier, LIVING_STANDARD_LEVELS } from '../../utils/livingStandard';
import {
    getOrganizationStage,
    getStageName,
    getStageIcon,
    predictDaysToUprising,
    ORGANIZATION_STAGE,
} from '../../logic/organizationSystem';
import { getAvailableActions } from '../../logic/strategicActions';
import { getPromiseTaskRemainingDays } from '../../logic/promiseTasks';
import { analyzeDissatisfactionSources } from '../../logic/demands';
import { StrategicActionButton } from './StrategicActionButton';
import { DissatisfactionAnalysis } from './DissatisfactionAnalysis';
import { DemandsList } from './DemandsList';

/**
 * 阶层详情底部面板组件
 * 在BottomSheet中显示阶层的详细信息
 */
const StratumDetailSheetComponent = ({
    stratumKey,
    popStructure,
    population = 0,
    classApproval,
    classInfluence,
    classWealth,
    classWealthDelta = {},
    classIncome,
    classExpense,
    classShortages,
    classLivingStandard = {}, // 新增：从simulation传来的生活水平数据
    classFinancialData = {}, // Detailed financial breakdown
    rebellionStates = {}, // 新增：组织度状态
    actionCooldowns = {},
    actionUsage = {},
    activeBuffs = [],
    activeDebuffs = [],
    dayScale = 1,
    daysElapsed = 0,
    taxPolicies,
    onUpdateTaxPolicies,
    onStrategicAction, // 新增：策略行动回调
    resources = {}, // 新增：资源用于检查行动可用性
    militaryPower = 0,
    promiseTasks = [],
    epoch = 0,
    techsUnlocked = [],
    totalInfluence = 0, // 新增：总影响力
    activeDemands = {}, // 新增：活跃诉求
    nations = [],
    onClose,
}) => {
    const safeDayScale = Math.max(dayScale, 0.0001);
    const stratum = STRATA[stratumKey];
    const [draftMultiplier, setDraftMultiplier] = useState(null);
    const [activeTab, setActiveTab] = useState('overview'); // 新增：tab状态

    if (!stratum) {
        return (
            <div className="text-center text-gray-400 py-8">
                <Icon name="AlertCircle" size={32} className="mx-auto mb-2" />
                <p>未找到该阶层信息</p>
            </div>
        );
    }

    const count = popStructure[stratumKey] || 0;
    const approval = classApproval[stratumKey] || 50;
    const influence = classInfluence[stratumKey] || 0;
    const wealthValue = classWealth[stratumKey] ?? 0;
    const totalIncome = (classIncome[stratumKey] || 0) / safeDayScale;
    const totalExpense = (classExpense[stratumKey] || 0) / safeDayScale;
    const incomePerCapita = totalIncome / Math.max(count, 1);
    const expensePerCapita = totalExpense / Math.max(count, 1);
    // Net income should be income minus expense, not wealth delta
    // Wealth delta includes many other factors (market trades, events, etc.)
    const netIncomePerCapita = incomePerCapita - expensePerCapita;
    const shortages = classShortages[stratumKey] || [];
    const headTaxMultiplier = taxPolicies?.headTaxRates?.[stratumKey] ?? 1;
    const stratumRebellionState = rebellionStates[stratumKey] || {};
    const currentOrganization = stratumRebellionState.organization ?? 0;
    const derivedDemands =
        (activeDemands[stratumKey] && activeDemands[stratumKey].length > 0)
            ? activeDemands[stratumKey]
            : (stratumRebellionState.activeDemands || []);

    // 使用从simulation传来的生活水平数据，如果没有则重新计算
    let livingStandardData = classLivingStandard[stratumKey];

    if (!livingStandardData) {
        // 如果没有预计算数据，重新计算
        const startingWealth = stratum.startingWealth || 80;
        const luxuryNeeds = stratum.luxuryNeeds || {};
        const luxuryThresholds = Object.keys(luxuryNeeds).map(Number).sort((a, b) => a - b);
        const wealthPerCapita = count > 0 ? wealthValue / count : 0;
        const wealthRatio = startingWealth > 0 ? wealthPerCapita / startingWealth : 0;

        // 基础需求数量（已解锁的资源）
        const baseNeedsCount = stratum.needs
            ? Object.keys(stratum.needs).filter(r => isResourceUnlocked(r, epoch, techsUnlocked)).length
            : 0;

        // 计算已解锁的奢侈需求档位（使用消费能力而非财富比率）
        // 先计算收入比率
        const baseNeeds = stratum.needs || {};
        let essentialCost = 0;
        const essentialResources = ['food', 'cloth'];
        essentialResources.forEach(resKey => {
            if (baseNeeds[resKey]) {
                // 使用资源配置中的基础价格（而非硬编码的1）
                const basePrice = RESOURCES[resKey]?.basePrice || 1;
                essentialCost += baseNeeds[resKey] * basePrice;
            }
        });
        const incomeRatio = essentialCost > 0 ? incomePerCapita / essentialCost : 1;
        // 解锁乘数（不受阶层上限限制，用于解锁判断）
        const unlockMultiplier = calculateUnlockMultiplier(
            incomeRatio,
            wealthRatio,
            stratum.wealthElasticity || 1.0,
            null
        );
        // 消费倍率（受阶层上限限制，用于 UI 显示）
        const maxConsumptionMultiplier = stratum.maxConsumptionMultiplier || 6;
        const fallbackMultiplier = calculateWealthMultiplier(incomeRatio, wealthRatio, stratum.wealthElasticity || 1.0, maxConsumptionMultiplier);

        let unlockedLuxuryTiers = 0;
        let effectiveNeedsCount = baseNeedsCount;
        for (const threshold of luxuryThresholds) {
            if (unlockMultiplier >= threshold) {
                unlockedLuxuryTiers++;
                const tierNeeds = luxuryNeeds[threshold];
                const unlockedResources = Object.keys(tierNeeds).filter(r => isResourceUnlocked(r, epoch, techsUnlocked));
                const newResources = unlockedResources.filter(r => !stratum.needs?.[r]);
                effectiveNeedsCount += newResources.length;
            }
        }

        livingStandardData = calculateLivingStandardData({
            count,
            income: totalIncome * count,
            expense: totalExpense * count,
            wealthValue,
            startingWealth,
            essentialCost: essentialCost * count, // 传入总基础生存成本（非人均）
            shortagesCount: shortages.length,
            effectiveNeedsCount,
            unlockedLuxuryTiers,
            totalLuxuryTiers: luxuryThresholds.length,
            previousScore: null,
            isNewStratum: true,
            maxConsumptionMultiplier,
            wealthElasticity: stratum.wealthElasticity || 1.0,
        });
    }

    // 从livingStandardData中提取所需的值（添加空值检查）
    const {
        wealthPerCapita = 0,
        wealthRatio = 0,
        wealthMultiplier = 1,
        satisfactionRate = 0,
        luxuryUnlockRatio = 0,
        unlockedLuxuryTiers = 0,
        totalLuxuryTiers = 0,
        level: livingStandardLevel = '赤贫',
        icon: livingStandardIcon = 'Skull',
        color: livingStandardColor = 'text-gray-400',
        bgColor: livingStandardBgColor = 'bg-gray-900/30',
        borderColor: livingStandardBorderColor = 'border-gray-500/30',
        approvalCap = 30,
        score: livingStandardScore = 0,
    } = livingStandardData || {};

    // 计算解锁乘数（用于奢侈需求解锁判断，不受阶层消费上限限制）
    // 这里重新计算是因为 livingStandardData 中的 wealthMultiplier 是受上限限制的
    const startingWealthForCalc = stratum.startingWealth || 80;
    const wealthPerCapitaForCalc = count > 0 ? wealthValue / count : 0;
    const wealthRatioForCalc = startingWealthForCalc > 0 ? wealthPerCapitaForCalc / startingWealthForCalc : 0;
    const baseNeedsForCalc = stratum.needs || {};
    let essentialCostForCalc = 0;
    ['food', 'cloth'].forEach(resKey => {
        if (baseNeedsForCalc[resKey]) essentialCostForCalc += baseNeedsForCalc[resKey] * 1;
    });
    const incomeRatioForCalc = essentialCostForCalc > 0 ? incomePerCapita / essentialCostForCalc : 1;
    const unlockMultiplier = calculateUnlockMultiplier(
        incomeRatioForCalc,
        wealthRatioForCalc,
        stratum.wealthElasticity || 1.0,
        livingStandardLevel
    );
    const luxuryConsumptionMultiplier = calculateLuxuryConsumptionMultiplier({
        consumptionMultiplier: wealthMultiplier,
        incomeRatio: incomeRatioForCalc,
        wealthRatio: wealthRatioForCalc,
        livingStandardLevel,
    });

    // 已解锁的奢侈需求详情（使用解锁乘数判断，不受阶层消费上限限制）
    const luxuryNeeds = stratum.luxuryNeeds || {};
    const luxuryThresholds = Object.keys(luxuryNeeds).map(Number).sort((a, b) => a - b);
    let unlockedLuxuryNeedsDetail = [];
    for (const threshold of luxuryThresholds) {
        if (unlockMultiplier >= threshold) {
            const tierNeeds = luxuryNeeds[threshold];
            // Only show unlocked resources in tooltip
            const unlockedResources = Object.keys(tierNeeds).filter(r => isResourceUnlocked(r, epoch, techsUnlocked));
            const newResources = unlockedResources.filter(r => !stratum.needs?.[r]);
            if (unlockedResources.length > 0) {
                unlockedLuxuryNeedsDetail.push({ threshold, count: unlockedResources.length, newResources });
            }
        }
    }

    const handleDraftChange = (raw) => {
        setDraftMultiplier(raw);
    };

    const commitDraft = () => {
        if (draftMultiplier === null || !onUpdateTaxPolicies) return;
        const parsed = parseFloat(draftMultiplier);
        const numeric = Number.isNaN(parsed) ? 1 : parsed; // 如果输入无效，重置为1
        onUpdateTaxPolicies(prev => ({
            ...prev,
            headTaxRates: {
                ...(prev?.headTaxRates || {}),
                [stratumKey]: numeric,
            },
        }));
        setDraftMultiplier(null);
    };


    const getApprovalColor = (value) => {
        if (value >= 70) return 'text-green-400';
        if (value >= 40) return 'text-yellow-400';
        return 'text-red-400';
    };

    const getApprovalBgColor = (value) => {
        if (value >= 70) return 'bg-green-500';
        if (value >= 40) return 'bg-yellow-500';
        return 'bg-red-500';
    };

    // 筛选专属于该阶层的效果（使用class属性匹配当前阶层）
    const relevantBuffs = activeBuffs.filter(buff =>
        buff.class === stratumKey
    );
    const relevantDebuffs = activeDebuffs.filter(debuff =>
        debuff.class === stratumKey
    );
    const actionGameState = {
        resources,
        organizationStates: rebellionStates,
        popStructure,
        actionCooldowns,
        actionUsage,
        population,
        militaryPower,
        nations,
    };
    const availableActions = getAvailableActions(stratumKey, actionGameState);
    const stratumPromiseTasks = (promiseTasks || []).filter(task => task.stratumKey === stratumKey);

    return (
        <div className="space-y-2">
            {/* 头部：阶层名称和图标 */}
            <div className="flex items-center gap-2 pb-2 border-b border-gray-700">
                <div className="w-12 h-12 bg-gray-700 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Icon name={stratum.icon} size={24} className="text-gray-300" />
                </div>
                <div className="flex-1 min-w-0">
                    <h2 className="text-lg font-bold text-white leading-tight font-decorative">{stratum.name}</h2>
                    <p className="text-xs text-gray-400 leading-tight truncate">{stratum.desc}</p>
                </div>
            </div>

            {/* Tab 导航 */}
            <div className="flex items-center gap-2 text-sm rounded-full glass-ancient border border-ancient-gold/30 p-1 shadow-metal-sm">
                <button
                    onClick={() => setActiveTab('overview')}
                    className={`w-1/3 py-2 rounded-full border-2 transition-all ${activeTab === 'overview'
                        ? 'bg-ancient-gold/20 border-ancient-gold/70 text-ancient-parchment shadow-gold-metal'
                        : 'border-transparent text-ancient-stone hover:text-ancient-parchment'
                        }`}
                >
                    <span className="flex items-center justify-center gap-1.5 font-bold">
                        <Icon name="FileText" size={12} />
                        概览
                    </span>
                </button>
                <button
                    onClick={() => setActiveTab('organization')}
                    className={`w-1/3 py-2 rounded-full border-2 transition-all ${activeTab === 'organization'
                        ? 'bg-orange-900/40 border-ancient-gold/60 text-orange-100 shadow-metal-sm'
                        : 'border-transparent text-ancient-stone hover:text-ancient-parchment'
                        }`}
                >
                    <span className="flex items-center justify-center gap-1.5 font-bold">
                        <Icon name="AlertTriangle" size={12} />
                        组织度
                        {(() => {
                            const org = rebellionStates[stratumKey]?.organization ?? 0;
                            if (org > 30) return <span className={`ml-1 px-1 py-0.5 rounded text-[9px] ${org >= 70 ? 'bg-red-600' : 'bg-orange-600'}`}>{org.toFixed(0)}%</span>;
                            return null;
                        })()}
                    </span>
                </button>
                <button
                    onClick={() => setActiveTab('finance')}
                    className={`w-1/3 py-2 rounded-full border-2 transition-all ${activeTab === 'finance'
                        ? 'bg-emerald-900/40 border-ancient-gold/60 text-emerald-100 shadow-metal-sm'
                        : 'border-transparent text-ancient-stone hover:text-ancient-parchment'
                        }`}
                >
                    <span className="flex items-center justify-center gap-1.5 font-bold">
                        <Icon name="Coins" size={12} />
                        财务
                    </span>
                </button>
            </div>

            {/* 概览Tab内容 */}
            {activeTab === 'overview' && (
                <>
                    {/* 核心数据卡片 */}
                    <div className="grid grid-cols-4 gap-1.5">
                        {/* 人口数量 */}
                        <div className="bg-gray-700/50 rounded p-1.5 border border-gray-600">
                            <div className="flex items-center gap-1 mb-0.5">
                                <Icon name="Users" size={12} className="text-blue-400" />
                                <span className="text-[9px] text-gray-400 leading-none">人口</span>
                            </div>
                            <div className="text-sm font-bold text-white font-mono leading-none">{count}</div>
                        </div>

                        {/* 好感度 */}
                        <div className="bg-gray-700/50 rounded p-1.5 border border-gray-600">
                            <div className="flex items-center gap-1 mb-0.5">
                                <Icon name="Heart" size={12} className="text-pink-400" />
                                <span className="text-[9px] text-gray-400 leading-none">好感</span>
                            </div>
                            <div className={`text-sm font-bold font-mono leading-none ${getApprovalColor(approval)}`}>
                                {approval.toFixed(0)}%
                            </div>
                        </div>

                        {/* 影响力 */}
                        <div className="bg-gray-700/50 rounded p-1.5 border border-gray-600">
                            <div className="flex items-center gap-1 mb-0.5">
                                <Icon name="Zap" size={12} className="text-purple-400" />
                                <span className="text-[9px] text-gray-400 leading-none">影响</span>
                            </div>
                            <div className="text-sm font-bold text-purple-300 font-mono leading-none">{influence.toFixed(0)}</div>
                        </div>

                        {/* 财富总额 */}
                        <div className="bg-gray-700/50 rounded p-1.5 border border-gray-600">
                            <div className="flex items-center gap-1 mb-0.5">
                                <Icon name="Coins" size={12} className="text-yellow-400" />
                                <span className="text-[9px] text-gray-400 leading-none">财富</span>
                            </div>
                            <div className="text-sm font-bold text-yellow-300 font-mono leading-none">{wealthValue.toFixed(0)}</div>
                        </div>
                    </div>

                    {/* 生活水平 */}
                    <div className={`rounded p-2 border ${livingStandardBorderColor} ${livingStandardBgColor}`}>
                        <h3 className="text-[10px] font-bold text-white mb-1.5 flex items-center gap-1">
                            <Icon name="Activity" size={12} className="text-cyan-400" />
                            生活水平
                        </h3>
                        <div className="flex items-center gap-3">
                            {/* 等级图标和名称 */}
                            <div className="flex items-center gap-2">
                                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${livingStandardBgColor} border ${livingStandardBorderColor}`}>
                                    <Icon name={livingStandardIcon} size={20} className={livingStandardColor} />
                                </div>
                                <div>
                                    <div className={`text-lg font-bold ${livingStandardColor}`}>{livingStandardLevel}</div>
                                    <div className="text-[9px] text-gray-400 leading-none">综合评分: {livingStandardScore.toFixed(0)}</div>
                                </div>
                            </div>

                            {/* 详细指标 */}
                            <div className="flex-1 grid grid-cols-3 gap-1.5">
                                <div className="bg-gray-800/40 rounded px-2 py-1">
                                    <div className="text-[9px] text-gray-400 leading-none mb-0.5">人均财富</div>
                                    <div className="text-xs font-bold text-yellow-300 font-mono">{wealthPerCapita.toFixed(1)}</div>
                                    <div className="text-[8px] text-gray-500 leading-none">
                                        {wealthRatio >= 1 ? '↑' : '↓'} 基准{wealthRatio >= 1 ? '+' : ''}{((wealthRatio - 1) * 100).toFixed(0)}%
                                    </div>
                                </div>
                                <div className="bg-gray-800/40 rounded px-2 py-1">
                                    <div className="text-[9px] text-gray-400 leading-none mb-0.5">消费能力</div>
                                    <div className={`text-xs font-bold font-mono ${wealthMultiplier >= 2 ? 'text-purple-400' : wealthMultiplier >= 1.5 ? 'text-blue-400' : wealthMultiplier >= 1 ? 'text-green-400' : 'text-red-400'}`}>
                                        ×{wealthMultiplier.toFixed(2)}
                                    </div>
                                    <div className="text-[8px] text-gray-500 leading-none">
                                        倍率 | 弹性: {stratum.wealthElasticity ?? 1.0}
                                    </div>
                                </div>
                                <div className="bg-gray-800/40 rounded px-2 py-1">
                                    <div className="text-[9px] text-gray-400 leading-none mb-0.5">需求满足</div>
                                    <div className={`text-xs font-bold font-mono ${satisfactionRate >= 0.8 ? 'text-green-400' : satisfactionRate >= 0.5 ? 'text-yellow-400' : 'text-red-400'}`}>
                                        {(satisfactionRate * 100).toFixed(0)}%
                                    </div>
                                    <div className="text-[8px] text-gray-500 leading-none">
                                        满意度上限: {approvalCap}%
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* 富裕需求解锁进度 - 只显示已解锁的档位，且只显示当前时代已解锁的资源 */}
                        {unlockedLuxuryNeedsDetail.length > 0 && (
                            <div className="mt-2 pt-2 border-t border-gray-700/50">
                                <div className="flex items-center justify-between mb-1">
                                    <span className="text-[9px] text-gray-400">已解锁富裕需求</span>
                                    <span className="text-[9px] font-bold text-blue-400">
                                        {unlockedLuxuryNeedsDetail.length} 档
                                    </span>
                                </div>
                                <div className="flex gap-1">
                                    {unlockedLuxuryNeedsDetail.map(({ threshold, count }) => {
                                        const tierNeeds = luxuryNeeds[threshold];
                                        // Only show unlocked resources in tooltip
                                        const unlockedResources = Object.keys(tierNeeds).filter(r => isResourceUnlocked(r, epoch, techsUnlocked));
                                        const resourceNames = unlockedResources.map(r => RESOURCES[r]?.name || r).join('、');
                                        return (
                                            <div
                                                key={threshold}
                                                className="flex-1 rounded px-1.5 py-1 text-center bg-blue-900/30 border border-blue-500/40"
                                                title={`${threshold}x财富解锁: ${resourceNames}`}
                                            >
                                                <div className="text-[9px] font-bold text-blue-300">
                                                    {threshold}×
                                                </div>
                                                <div className="text-[8px] text-gray-300">
                                                    +{count}项
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* 人头税调整 */}
                    {onUpdateTaxPolicies && (
                        <div className="bg-gray-700/50 rounded p-2 border border-gray-600">
                            <h3 className="text-[10px] font-bold text-white mb-1.5 flex items-center gap-1">
                                <Icon name="Sliders" size={12} className="text-yellow-400" />
                                人头税调整
                            </h3>
                            <div className="grid grid-cols-2 gap-2 items-center">
                                <div>
                                    <div className="text-[9px] text-gray-400 mb-0.5 leading-none">税率系数</div>
                                    <div className="flex items-center gap-1">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const currentValue = parseFloat(draftMultiplier ?? headTaxMultiplier);
                                                const newValue = isNaN(currentValue) ? -1 : -currentValue;
                                                handleDraftChange(String(newValue));
                                                // 直接提交
                                                onUpdateTaxPolicies(prev => ({
                                                    ...prev,
                                                    headTaxRates: {
                                                        ...(prev?.headTaxRates || {}),
                                                        [stratumKey]: newValue,
                                                    },
                                                }));
                                                setDraftMultiplier(null);
                                            }}
                                            className="btn-compact flex-shrink-0 w-6 h-6 bg-gray-700 hover:bg-gray-600 border border-gray-500 rounded text-[10px] font-bold text-gray-300 flex items-center justify-center transition-colors"
                                            title="切换正负值（税收/补贴）"
                                        >
                                            ±
                                        </button>
                                        <input
                                            type="text"
                                            inputMode="decimal"
                                            step="0.05"
                                            value={draftMultiplier ?? headTaxMultiplier}
                                            onChange={(e) => handleDraftChange(e.target.value)}
                                            onBlur={commitDraft}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    commitDraft();
                                                    e.target.blur();
                                                }
                                            }}
                                            className="flex-grow min-w-0 bg-gray-900/70 border border-gray-600 text-sm text-gray-200 rounded px-2 py-1 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-center"
                                            placeholder="税率系数"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <div className="text-[9px] text-gray-400 mb-0.5 leading-none">实际税额 (每人每日)</div>
                                    <div className="bg-gray-800/50 rounded px-2 py-1.5 text-center">
                                        <span className={`text-sm font-bold font-mono ${(stratum.headTaxBase * headTaxMultiplier) > 0 ? 'text-yellow-300' : (stratum.headTaxBase * headTaxMultiplier) < 0 ? 'text-green-300' : 'text-gray-400'
                                            }`}>
                                            {(stratum.headTaxBase * headTaxMultiplier) < 0 ? '补贴 ' : ''}{Math.abs((stratum.headTaxBase || 0.01) * headTaxMultiplier).toFixed(3)}
                                        </span>
                                        <Icon
                                            name={(stratum.headTaxBase * headTaxMultiplier) > 0 ? "TrendingUp" : (stratum.headTaxBase * headTaxMultiplier) < 0 ? "TrendingDown" : "Coins"}
                                            size={12}
                                            className={`inline-block ml-1 ${(stratum.headTaxBase * headTaxMultiplier) > 0 ? 'text-yellow-400' : (stratum.headTaxBase * headTaxMultiplier) < 0 ? 'text-green-400' : 'text-gray-500'
                                                }`}
                                        />
                                    </div>
                                </div>
                            </div>
                            <p className="text-[10px] text-gray-500 mt-1.5">实际税额 = 阶层基准税额 × 税率系数。负数系数代表补贴。</p>
                        </div>
                    )}

                    {/* 收支情况 */}
                    <div className="bg-gray-700/50 rounded p-2 border border-gray-600">
                        <h3 className="text-[10px] font-bold text-white mb-1.5 flex items-center gap-1">
                            <Icon name="TrendingUp" size={12} className="text-green-400" />
                            每日人均收支
                        </h3>
                        <div className="grid grid-cols-3 gap-2">
                            <div>
                                <div className="text-[9px] text-gray-400 mb-0.5 leading-none">收入</div>
                                <div className="text-sm font-bold text-green-400 font-mono leading-none">
                                    +{incomePerCapita.toFixed(2)}
                                </div>
                            </div>
                            <div>
                                <div className="text-[9px] text-gray-400 mb-0.5 leading-none">支出</div>
                                <div className="text-sm font-bold text-red-400 font-mono leading-none">
                                    -{expensePerCapita.toFixed(2)}
                                </div>
                            </div>
                            <div>
                                <div className="text-[9px] text-gray-400 mb-0.5 leading-none">净收入</div>
                                <div className={`text-sm font-bold font-mono leading-none ${netIncomePerCapita >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                    {netIncomePerCapita >= 0 ? '+' : ''}{netIncomePerCapita.toFixed(2)}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 资源需求 */}
                    <div className="bg-gray-700/50 rounded p-2 border border-gray-600">
                        <h3 className="text-[10px] font-bold text-white mb-1.5 flex items-center gap-1">
                            <Icon name="Package" size={12} className="text-amber-400" />
                            资源需求清单
                            {totalLuxuryTiers > 0 && unlockedLuxuryTiers > 0 && (
                                <span className="text-[8px] text-purple-400 ml-1">(含富裕需求)</span>
                            )}
                        </h3>

                        {(() => {
                            // Build effective needs map with source tracking
                            const effectiveNeedsMap = {};
                            // Add base needs (only if resource is unlocked)
                            if (stratum.needs) {
                                for (const [resKey, amount] of Object.entries(stratum.needs)) {
                                    // Skip resources that are not yet unlocked in current epoch/tech
                                    if (!isResourceUnlocked(resKey, epoch, techsUnlocked)) continue;
                                    effectiveNeedsMap[resKey] = { amount, isBase: true, luxuryThreshold: null };
                                }
                            }
                            // Add unlocked luxury needs (only if resource is unlocked)
                            // 使用解锁乘数（unlockMultiplier）判断，不受阶层消费上限限制
                            if (stratum.luxuryNeeds) {
                                for (const threshold of luxuryThresholds) {
                                    if (unlockMultiplier >= threshold) {
                                        const tierNeeds = stratum.luxuryNeeds[threshold];
                                        for (const [resKey, amount] of Object.entries(tierNeeds)) {
                                            // Skip resources that are not yet unlocked in current epoch/tech
                                            if (!isResourceUnlocked(resKey, epoch, techsUnlocked)) continue;
                                            if (effectiveNeedsMap[resKey]) {
                                                effectiveNeedsMap[resKey].amount += (amount * luxuryConsumptionMultiplier);
                                                if (!effectiveNeedsMap[resKey].isBase) {
                                                    effectiveNeedsMap[resKey].luxuryThreshold = Math.min(effectiveNeedsMap[resKey].luxuryThreshold || Infinity, threshold);
                                                }
                                            } else {
                                                effectiveNeedsMap[resKey] = { amount: amount * luxuryConsumptionMultiplier, isBase: false, luxuryThreshold: threshold };
                                            }
                                        }
                                    }
                                }
                            }

                            const effectiveNeedsEntries = Object.entries(effectiveNeedsMap);

                            if (effectiveNeedsEntries.length === 0) {
                                return (
                                    <div className="text-center text-gray-400 text-[10px] py-2">
                                        该阶层暂无特殊资源需求
                                    </div>
                                );
                            }

                            return (
                                <div className="space-y-1.5">
                                    {effectiveNeedsEntries.map(([resourceKey, { amount, isBase, luxuryThreshold }]) => {
                                        const resource = RESOURCES[resourceKey];
                                        const shortage = shortages.find(s =>
                                            (typeof s === 'string' ? s : s.resource) === resourceKey
                                        );
                                        const isShortage = !!shortage;
                                        const reason = shortage && typeof shortage !== 'string' ? shortage.reason : 'outOfStock';

                                        let statusIcon = 'CheckCircle';
                                        let statusColor = 'text-green-400';
                                        let statusText = '✓ 需求已满足';
                                        let statusBg = 'bg-green-900/20';
                                        let borderColor = 'border-green-500/30';
                                        let reasonDetail = '';

                                        if (isShortage) {
                                            if (reason === 'unaffordable') {
                                                statusIcon = 'DollarSign';
                                                statusColor = 'text-orange-400';
                                                statusText = '✗ 需求未满足';
                                                statusBg = 'bg-orange-900/20';
                                                borderColor = 'border-orange-500/40';
                                                reasonDetail = '原因：该阶层买不起此资源';
                                            } else if (reason === 'outOfStock') {
                                                statusIcon = 'XCircle';
                                                statusColor = 'text-red-400';
                                                statusText = '✗ 需求未满足';
                                                statusBg = 'bg-red-900/20';
                                                borderColor = 'border-red-500/40';
                                                reasonDetail = '原因：市场上此资源缺货';
                                            } else if (reason === 'both') {
                                                statusIcon = 'AlertTriangle';
                                                statusColor = 'text-red-500';
                                                statusText = '✗ 需求未满足';
                                                statusBg = 'bg-red-900/30';
                                                borderColor = 'border-red-500/50';
                                                reasonDetail = '原因：市场缺货且该阶层买不起';
                                            }
                                        }

                                        return (
                                            <div
                                                key={resourceKey}
                                                className={`rounded p-2 border ${borderColor} ${statusBg} ${isShortage ? 'animate-pulse' : ''}`}
                                            >
                                                {/* 资源名称和图标 */}
                                                <div className="flex items-center gap-2 mb-1">
                                                    <div className="w-7 h-7 bg-gray-800/60 rounded flex items-center justify-center flex-shrink-0">
                                                        <Icon name={resource?.icon || 'HelpCircle'} size={16} className={resource?.color || 'text-gray-400'} />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-1">
                                                            <span className="text-xs font-bold text-white leading-tight">{resource?.name || resourceKey}</span>
                                                            {!isBase && (
                                                                <span className="text-[8px] px-1 py-0.5 rounded bg-purple-900/40 text-purple-300 border border-purple-500/30">
                                                                    富裕 {luxuryThreshold}×
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="text-[9px] text-gray-400 leading-tight truncate">{resource?.desc || '资源描述'}</div>
                                                    </div>
                                                </div>

                                                {/* 需求量信息 */}
                                                <div className="bg-gray-800/40 rounded px-2 py-1 mb-1">
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-[9px] text-gray-400 leading-none">人均需求</span>
                                                        <span className="text-[10px] font-bold text-white font-mono leading-none">{amount}</span>
                                                    </div>
                                                    <div className="flex items-center justify-between mt-0.5">
                                                        <span className="text-[9px] text-gray-400 leading-none">总需求</span>
                                                        <span className="text-[10px] font-bold text-blue-300 font-mono leading-none">{(amount * count).toFixed(0)}</span>
                                                    </div>
                                                </div>

                                                {/* 满足状态 */}
                                                <div className={`flex items-center gap-1.5 px-2 py-1 rounded ${statusBg}`}>
                                                    <Icon name={statusIcon} size={12} className={statusColor} />
                                                    <div className="flex-1 min-w-0">
                                                        <div className={`text-[10px] font-bold ${statusColor} leading-tight`}>{statusText}</div>
                                                        {reasonDetail && (
                                                            <div className={`text-[9px] ${statusColor} leading-tight truncate`}>{reasonDetail}</div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            );
                        })()}
                    </div>

                    {/* 激活效果 */}
                    {(relevantBuffs.length > 0 || relevantDebuffs.length > 0) && (
                        <div className="bg-gray-700/50 rounded p-2 border border-gray-600">
                            <h3 className="text-[10px] font-bold text-white mb-1.5 flex items-center gap-1">
                                <Icon name="Activity" size={12} className="text-blue-400" />
                                激活效果
                            </h3>
                            <div className="space-y-1">
                                {relevantBuffs.map((buff, index) => {
                                    const details = formatEffectDetails(buff);
                                    return (
                                        <div key={`buff-${index}`} className="bg-green-900/20 border border-green-500/30 rounded p-1.5">
                                            <div className="flex items-center gap-1 mb-0.5">
                                                <Icon name="ArrowUp" size={10} className="text-green-400" />
                                                <span className="text-[10px] font-semibold text-green-300 leading-tight">{buff.desc || '满意加成'}</span>
                                            </div>
                                            {details.length > 0 && (
                                                <div className="text-[9px] text-gray-300 ml-4 leading-tight">{details.join('，')}</div>
                                            )}
                                        </div>
                                    );
                                })}
                                {relevantDebuffs.map((debuff, index) => {
                                    const details = formatEffectDetails(debuff);
                                    return (
                                        <div key={`debuff-${index}`} className="bg-red-900/20 border border-red-500/30 rounded p-1.5">
                                            <div className="flex items-center gap-1 mb-0.5">
                                                <Icon name="ArrowDown" size={10} className="text-red-400" />
                                                <span className="text-[10px] font-semibold text-red-300 leading-tight">{debuff.desc || '不满惩罚'}</span>
                                            </div>
                                            {details.length > 0 && (
                                                <div className="text-[9px] text-gray-300 ml-4 leading-tight">{details.join('，')}</div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </>
            )}

            {/* 组织度Tab内容 */}
            {activeTab === 'organization' && (
                <div className="space-y-2">
                    {(() => {
                        const orgState = rebellionStates[stratumKey] || {};
                        const organization = orgState.organization ?? 0;
                        const growthRate = orgState.growthRate ?? 0;
                        const orgStage = getOrganizationStage(organization);
                        const orgStageName = getStageName(orgStage);
                        const orgStageIcon = getStageIcon(orgStage);
                        const daysToUprising = predictDaysToUprising(organization, growthRate);

                        return (
                            <>
                                {/* 组织度状态卡片 */}
                                <div className="bg-gray-700/50 rounded p-3 border border-gray-600">
                                    <h3 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
                                        <Icon name="AlertTriangle" size={16} className="text-orange-400" />
                                        组织度状态
                                    </h3>

                                    {/* 组织度进度条 */}
                                    <div className="mb-3">
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-2">
                                                <Icon
                                                    name={orgStageIcon}
                                                    size={18}
                                                    className={organization >= 70 ? 'text-red-500 animate-pulse' : organization >= 30 ? 'text-orange-400' : 'text-yellow-400'}
                                                />
                                                <span className={`text-sm font-bold ${organization >= 70 ? 'text-red-400' : organization >= 30 ? 'text-orange-400' : 'text-yellow-400'}`}>
                                                    {orgStageName}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-lg font-mono font-bold text-white">{organization.toFixed(0)}%</span>
                                                {growthRate !== 0 && (
                                                    <span className={`text-xs font-mono ${growthRate > 0 ? 'text-red-300' : 'text-green-300'}`}>
                                                        ({growthRate > 0 ? '+' : ''}{growthRate.toFixed(2)}/天)
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="w-full bg-gray-800/50 rounded-full h-3 border border-gray-600 overflow-hidden">
                                            <div
                                                className={`h-3 rounded-full transition-all ${organization >= 90 ? 'bg-red-500 animate-pulse' :
                                                    organization >= 70 ? 'bg-orange-500' :
                                                        organization >= 30 ? 'bg-yellow-500' : 'bg-gray-500'
                                                    }`}
                                                style={{ width: `${organization}%` }}
                                            />
                                        </div>
                                        {daysToUprising !== null && daysToUprising < 200 && (
                                            <div className="text-sm text-red-400 mt-2 animate-pulse font-bold">
                                                ⚠️ 预计 {daysToUprising} 天后爆发叛乱
                                            </div>
                                        )}
                                    </div>

                                    {/* 阶段说明 */}
                                    {/* <div className="bg-gray-800/50 rounded p-2 text-xs text-gray-300">
                                        <div className="grid grid-cols-2 gap-2">
                                            <div><span className="text-yellow-400">0-29%</span>: 平静</div>
                                            <div><span className="text-yellow-400">30-49%</span>: 不满</div>
                                            <div><span className="text-orange-400">50-69%</span>: 动员</div>
                                            <div><span className="text-red-400">70-89%</span>: 激进</div>
                                            <div className="col-span-2"><span className="text-red-500">90-100%</span>: 起义爆发！</div>
                                        </div>
                                    </div> */}
                                </div>

                                {/* 不满来源分析 */}
                                {(() => {
                                    const dissatisfactionContext = {
                                        classShortages,
                                        classApproval,
                                        classInfluence,
                                        totalInfluence,
                                        classLivingStandard,
                                        taxPolicies,
                                        classIncome,
                                        classExpense,
                                        popStructure,
                                    };
                                    const analysis = analyzeDissatisfactionSources(stratumKey, dissatisfactionContext);
                                    return analysis.hasIssues ? (
                                        <div className="bg-gray-700/50 rounded p-3 border border-gray-600">
                                            <DissatisfactionAnalysis
                                                sources={analysis.sources}
                                                totalContribution={analysis.totalContribution}
                                            />
                                        </div>
                                    ) : null;
                                })()}

                                {/* 当前诉求 */}
                                {(currentOrganization >= 50 || derivedDemands.length > 0) && (
                                    <div className="bg-gray-700/50 rounded p-3 border border-gray-600">
                                        <DemandsList
                                            demands={derivedDemands}
                                            currentDay={daysElapsed}
                                        />
                                        {derivedDemands.length === 0 && (
                                            <div className="flex items-center gap-2 text-xs text-gray-400">
                                                <Icon name="Scroll" size={14} className="text-purple-400" />
                                                <span>当前没有具体诉求</span>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* 策略行动区 */}
                                <div className="bg-gray-700/50 rounded p-3 border border-gray-600 space-y-3">
                                    <div>
                                        <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                                            <Icon name="Zap" size={16} className="text-blue-400" />
                                            策略行动
                                        </h3>
                                        <div className="space-y-1.5">
                                            {availableActions.map(action => (
                                                <StrategicActionButton
                                                    key={action.id}
                                                    action={action}
                                                    stratumKey={stratumKey}
                                                    stratumName={stratum.name}
                                                    popCount={count}
                                                    disabled={!onStrategicAction || !action.available}
                                                    unavailableReason={action.unavailableReason}
                                                    onExecute={onStrategicAction}
                                                    actionUsage={actionUsage}
                                                />
                                            ))}
                                        </div>
                                        {availableActions.length === 0 && (
                                            <div className="text-xs text-gray-400 text-center mt-2">暂无可用的策略行动</div>
                                        )}
                                        {!onStrategicAction && (
                                            <div className="text-xs text-gray-500 mt-2 text-center bg-gray-800/30 rounded p-2">
                                                策略行动功能开发中...
                                            </div>
                                        )}
                                    </div>
                                    <div className="pt-2 border-t border-gray-600/60">
                                        <h4 className="text-[11px] font-bold text-white mb-1 flex items-center gap-1">
                                            <Icon name="FileText" size={12} className="text-amber-300" />
                                            承诺任务
                                        </h4>
                                        {stratumPromiseTasks.length > 0 ? (
                                            <div className="space-y-1">
                                                {stratumPromiseTasks.map(task => {
                                                    const remaining = getPromiseTaskRemainingDays(task, daysElapsed || 0);
                                                    return (
                                                        <div key={task.id} className="bg-gray-800/60 border border-gray-600 rounded p-2">
                                                            <div className="flex items-center justify-between text-[10px] text-gray-300">
                                                                <span className="font-semibold text-white">{task.description}</span>
                                                                <span className={`font-mono ${remaining <= 5 ? 'text-red-300' : 'text-green-300'}`}>
                                                                    剩余 {remaining} 天
                                                                </span>
                                                            </div>
                                                            <div className="text-[9px] text-gray-400 mt-0.5">
                                                                失败惩罚: 组织度 +{task.failurePenalty?.organization || 0}%
                                                                {task.failurePenalty?.forcedUprising ? '（直接爆发）' : ''}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        ) : (
                                            <div className="text-[11px] text-gray-400">暂无该阶层的承诺。</div>
                                        )}
                                    </div>
                                </div>
                            </>
                        );
                    })()}
                </div>
            )}
            {/* 财务Tab内容 */}
            {activeTab === 'finance' && (
                <div className="space-y-2">
                    {/* 总收支概览 */}
                    <div className="bg-gray-700/50 rounded p-2 border border-gray-600">
                        <h3 className="text-[10px] font-bold text-white mb-1.5 flex items-center gap-1">
                            <Icon name="TrendingUp" size={12} className="text-green-400" />
                            每日人均收支总览
                        </h3>
                        <div className="grid grid-cols-3 gap-2">
                            <div>
                                <div className="text-[9px] text-gray-400 mb-0.5 leading-none">总收入</div>
                                <div className="text-sm font-bold text-green-400 font-mono leading-none">
                                    +{incomePerCapita.toFixed(2)}
                                </div>
                            </div>
                            <div>
                                <div className="text-[9px] text-gray-400 mb-0.5 leading-none">总支出</div>
                                <div className="text-sm font-bold text-red-400 font-mono leading-none">
                                    -{expensePerCapita.toFixed(2)}
                                </div>
                            </div>
                            <div>
                                <div className="text-[9px] text-gray-400 mb-0.5 leading-none">净收益</div>
                                <div className={`text-sm font-bold font-mono leading-none ${netIncomePerCapita >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                    {netIncomePerCapita >= 0 ? '+' : ''}{netIncomePerCapita.toFixed(2)}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 收入明细 */}
                    <div className="bg-gray-700/50 rounded p-2 border border-gray-600">
                        <h3 className="text-[10px] font-bold text-white mb-2 flex items-center gap-1">
                            <Icon name="ArrowDownLeft" size={12} className="text-green-400" />
                            收入构成 (人均/日)
                        </h3>
                        {(() => {
                            const data = classFinancialData[stratumKey]?.income || {};
                            const wage = (data.wage || 0) / safeDayScale / Math.max(count, 1);
                            const ownerRevenue = (data.ownerRevenue || 0) / safeDayScale / Math.max(count, 1);
                            const subsidy = (data.subsidy || 0) / safeDayScale / Math.max(count, 1);
                            const salary = (data.salary || 0) / safeDayScale / Math.max(count, 1); // 官员俸禄

                            return (
                                <div className="space-y-1.5">
                                    {wage > 0.001 && (
                                        <div className="flex justify-between items-center text-xs">
                                            <span className="text-gray-300">工资收入</span>
                                            <span className="text-green-400 font-mono">+{wage.toFixed(2)}</span>
                                        </div>
                                    )}
                                    {salary > 0.001 && (
                                        <div className="flex justify-between items-center text-xs">
                                            <span className="text-gray-300">官员俸禄</span>
                                            <span className="text-green-400 font-mono">+{salary.toFixed(2)}</span>
                                        </div>
                                    )}
                                    {ownerRevenue > 0.001 && (
                                        <div className="flex justify-between items-center text-xs">
                                            <span className="text-gray-300">经营营收</span>
                                            <span className="text-green-400 font-mono">+{ownerRevenue.toFixed(2)}</span>
                                        </div>
                                    )}
                                    {subsidy > 0.001 && (
                                        <div className="flex justify-between items-center text-xs">
                                            <span className="text-gray-300">政府补贴</span>
                                            <span className="text-green-400 font-mono">+{subsidy.toFixed(2)}</span>
                                        </div>
                                    )}
                                    {wage <= 0.001 && ownerRevenue <= 0.001 && subsidy <= 0.001 && salary <= 0.001 && (
                                        <div className="text-gray-500 text-xs italic text-center">暂无显著收入</div>
                                    )}
                                </div>
                            );
                        })()}
                    </div>

                    {/* 支出明细 */}
                    <div className="bg-gray-700/50 rounded p-2 border border-gray-600">
                        <h3 className="text-[10px] font-bold text-white mb-2 flex items-center gap-1">
                            <Icon name="ArrowUpRight" size={12} className="text-red-400" />
                            支出构成 (人均/日)
                        </h3>
                        {(() => {
                            const data = classFinancialData[stratumKey]?.expense || {};
                            const headTax = (data.headTax || 0) / safeDayScale / Math.max(count, 1);
                            const transactionTax = (data.transactionTax || 0) / safeDayScale / Math.max(count, 1);
                            const businessTax = (data.businessTax || 0) / safeDayScale / Math.max(count, 1);
                            const tariffs = (data.tariffs || 0) / safeDayScale / Math.max(count, 1);

                            // 必需品消费
                            const essentialNeedsRaw = typeof data.essentialNeeds === 'object'
                                ? Object.values(data.essentialNeeds).reduce((sum, entry) => {
                                    const cost = typeof entry === 'object' ? entry.cost : entry;
                                    return sum + (cost || 0);
                                }, 0)
                                : 0;
                            const essentialNeeds = essentialNeedsRaw / safeDayScale / Math.max(count, 1);

                            // 奢侈品消费
                            const luxuryNeedsRaw = typeof data.luxuryNeeds === 'object'
                                ? Object.values(data.luxuryNeeds).reduce((sum, entry) => {
                                    const cost = typeof entry === 'object' ? entry.cost : entry;
                                    return sum + (cost || 0);
                                }, 0)
                                : 0;
                            const luxuryNeeds = luxuryNeedsRaw / safeDayScale / Math.max(count, 1);

                            const decayRaw = (data.decay || 0);
                            const decay = decayRaw / safeDayScale / Math.max(count, 1);

                            const productionCostsRaw = (data.productionCosts || 0);
                            const productionCosts = productionCostsRaw / safeDayScale / Math.max(count, 1);

                            // 工资支出（业主支付给工人）
                            const wagesRaw = (data.wages || 0);
                            const wages = wagesRaw / safeDayScale / Math.max(count, 1);

                            // Calculate 'Other' based on total roleExpense vs tracked items
                            const trackedTotal = headTax + transactionTax + businessTax + tariffs + essentialNeeds + luxuryNeeds + decay + productionCosts + wages;
                            const other = Math.max(0, expensePerCapita - trackedTotal);

                            return (
                                <div className="space-y-1.5">
                                    {headTax > 0.001 && (
                                        <div className="flex justify-between items-center text-xs">
                                            <span className="text-gray-300">人头税</span>
                                            <span className="text-red-400 font-mono">-{headTax.toFixed(2)}</span>
                                        </div>
                                    )}
                                    {transactionTax > 0.001 && (
                                        <div className="flex justify-between items-center text-xs">
                                            <span className="text-gray-300">交易税</span>
                                            <span className="text-red-400 font-mono">-{transactionTax.toFixed(2)}</span>
                                        </div>
                                    )}
                                    {businessTax > 0.001 && (
                                        <div className="flex justify-between items-center text-xs">
                                            <span className="text-gray-300">营业税</span>
                                            <span className="text-red-400 font-mono">-{businessTax.toFixed(2)}</span>
                                        </div>
                                    )}
                                    {tariffs > 0.001 && (
                                        <div className="flex justify-between items-center text-xs">
                                            <span className="text-gray-300">关税支出</span>
                                            <span className="text-red-400 font-mono">-{tariffs.toFixed(2)}</span>
                                        </div>
                                    )}
                                    {productionCosts > 0.001 && (
                                        <div className="flex justify-between items-center text-xs">
                                            <span className="text-gray-300">生产经营投入</span>
                                            <span className="text-red-400 font-mono">-{productionCosts.toFixed(2)}</span>
                                        </div>
                                    )}
                                    {essentialNeeds > 0.001 && (
                                        <div className="space-y-1">
                                            <div className="flex justify-between items-center text-xs">
                                                <span className="text-gray-300 font-medium">必需品消费</span>
                                                <span className="text-red-400 font-mono">-{essentialNeeds.toFixed(2)}</span>
                                            </div>
                                            {/* 各资源明细 */}
                                            <div className="pl-2 space-y-0.5 border-l-2 border-gray-700">
                                                {Object.entries(data.essentialNeeds || {}).map(([resKey, entry]) => {
                                                    const costVal = typeof entry === 'object' ? entry.cost : entry;
                                                    const qtyVal = typeof entry === 'object' ? entry.quantity : 0;
                                                    const priceVal = typeof entry === 'object' ? entry.price : 0;
                                                    const perCapitaCost = costVal / safeDayScale / Math.max(count, 1);
                                                    const perCapitaQty = qtyVal / safeDayScale / Math.max(count, 1);
                                                    if (perCapitaCost < 0.001) return null;
                                                    const resInfo = RESOURCES[resKey];
                                                    return (
                                                        <div key={resKey} className="flex items-center justify-between text-[10px] gap-1">
                                                            <span className="flex items-center gap-1 text-gray-400">
                                                                <Icon name={resInfo?.icon || 'Package'} size={10} className={resInfo?.color || 'text-gray-400'} />
                                                                {resInfo?.name || resKey}
                                                            </span>
                                                            <span className="flex items-center gap-0.5 text-gray-500">
                                                                <span className="font-mono">{perCapitaQty.toFixed(2)}</span>
                                                                <span>×</span>
                                                                <span className="font-mono">{priceVal.toFixed(2)}</span>
                                                                <Icon name="Coins" size={8} className="text-yellow-500" />
                                                                <span>=</span>
                                                                <span className="text-red-300 font-mono">-{perCapitaCost.toFixed(2)}</span>
                                                            </span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                    {luxuryNeeds > 0.001 && (
                                        <div className="space-y-1">
                                            <div className="flex justify-between items-center text-xs">
                                                <span className="text-gray-300 font-medium">奢侈品消费</span>
                                                <span className="text-red-400 font-mono">-{luxuryNeeds.toFixed(2)}</span>
                                            </div>
                                            {/* 各资源明细 */}
                                            <div className="pl-2 space-y-0.5 border-l-2 border-gray-700">
                                                {Object.entries(data.luxuryNeeds || {}).map(([resKey, entry]) => {
                                                    const costVal = typeof entry === 'object' ? entry.cost : entry;
                                                    const qtyVal = typeof entry === 'object' ? entry.quantity : 0;
                                                    const priceVal = typeof entry === 'object' ? entry.price : 0;
                                                    const perCapitaCost = costVal / safeDayScale / Math.max(count, 1);
                                                    const perCapitaQty = qtyVal / safeDayScale / Math.max(count, 1);
                                                    if (perCapitaCost < 0.001) return null;
                                                    const resInfo = RESOURCES[resKey];
                                                    return (
                                                        <div key={resKey} className="flex items-center justify-between text-[10px] gap-1">
                                                            <span className="flex items-center gap-1 text-gray-400">
                                                                <Icon name={resInfo?.icon || 'Package'} size={10} className={resInfo?.color || 'text-gray-400'} />
                                                                {resInfo?.name || resKey}
                                                            </span>
                                                            <span className="flex items-center gap-0.5 text-gray-500">
                                                                <span className="font-mono">{perCapitaQty.toFixed(2)}</span>
                                                                <span>×</span>
                                                                <span className="font-mono">{priceVal.toFixed(2)}</span>
                                                                <Icon name="Coins" size={8} className="text-yellow-500" />
                                                                <span>=</span>
                                                                <span className="text-red-300 font-mono">-{perCapitaCost.toFixed(2)}</span>
                                                            </span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                    {decay > 0.001 && (
                                        <div className="flex justify-between items-center text-xs">
                                            <span className="text-gray-300">富裕性挥霍</span>
                                            <span className="text-red-400 font-mono">-{decay.toFixed(2)}</span>
                                        </div>
                                    )}
                                    {wages > 0.001 && (
                                        <div className="flex justify-between items-center text-xs">
                                            <span className="text-gray-300">工资支出</span>
                                            <span className="text-red-400 font-mono">-{wages.toFixed(2)}</span>
                                        </div>
                                    )}
                                    {other > 0.01 && (
                                        <div className="flex justify-between items-center text-xs">
                                            <span className="text-gray-300">其他支出</span>
                                            <span className="text-red-400 font-mono">-{other.toFixed(2)}</span>
                                        </div>
                                    )}
                                    {expensePerCapita <= 0.001 && (
                                        <div className="text-gray-500 text-xs italic text-center">暂无显著支出</div>
                                    )}
                                </div>
                            );
                        })()}
                    </div>
                </div>
            )}
        </div>
    );
};

// Memoized for performance - prevents re-render when props unchanged
export const StratumDetailSheet = memo(StratumDetailSheetComponent);
