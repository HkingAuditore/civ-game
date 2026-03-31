import React, { useState, memo } from 'react';
import { Icon } from '../common/UIComponents';
import { STRATA, RESOURCES, TAX_BASE_RATES, TAX_LIMITS } from '../../config';
import { formatEffectDetails } from '../../utils/effectFormatter';
import { isResourceUnlocked } from '../../utils/resources';
import { formatNumberShortCN } from '../../utils/numberFormat';
import { calculateLivingStandardData, calculateWealthMultiplier, calculateUnlockMultiplier, calculateLuxuryConsumptionMultiplier, calculatePriceAwareLivingStandardThresholds, LIVING_STANDARD_LEVELS } from '../../utils/livingStandard';

import {
    getOrganizationStage,
    getStageName,
    getStageIcon,
    predictDaysToUprising,
    ORGANIZATION_STAGE,
    STAGE_THRESHOLDS,
} from '../../logic/organizationSystem';
import { getSatisfactionThreshold, getDifficultyConfig, DEFAULT_DIFFICULTY } from '../../config/difficulty';
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
    approvalBreakdown = {},
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
    market = null, // { prices: { [resourceKey]: number } }
    militaryPower = 0,
    promiseTasks = [],
    epoch = 0,
    techsUnlocked = [],
    totalInfluence = 0, // 新增：总影响力
    activeDemands = {}, // 新增：活跃诉求
    nations = [],
    officials = [], // 新增：官员列表
    difficulty, // 游戏难度

    // Optional: extra approval drivers from simulation (to explain 'mysterious' drops)
    legitimacyTaxModifier = 1,
    effectiveTaxModifier = 1,
    taxShock = {},
    eventApprovalModifiers = {},
    decreeApprovalModifiers = {},
    legitimacyApprovalModifier = 0,

    onClose,
}) => {
    const safeDayScale = Math.max(dayScale, 0.0001);
    const stratum = STRATA[stratumKey];
    const [draftMultiplier, setDraftMultiplier] = useState(null);
    const [activeTab, setActiveTab] = useState('overview'); // 新增：tab状态
    const getMarketPrice = (resourceKey) => {
        const marketPrice = market?.prices?.[resourceKey];
        const basePrice = RESOURCES[resourceKey]?.basePrice || 1;
        return Number.isFinite(marketPrice) && marketPrice > 0 ? marketPrice : basePrice;
    };

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
    // Use classFinancialData for overview consistent with finance tab
    // Special case for 'official': classFinancialData is reset every tick but officialSim only runs every 5 ticks,
    // so we aggregate from the persistent lastDay* fields on each official object instead.
    const finData = (() => {
        if (stratumKey === 'official' && officials.length > 0) {
            let totalSalary = 0, totalPropertyIncome = 0, totalHeadTax = 0;
            let totalEssentialCost = 0, totalLuxuryCost = 0;
            officials.forEach(o => {
                totalSalary += (o.salary || 0);
                totalPropertyIncome += (o.lastDayPropertyIncome || 0);
                totalHeadTax += (o.lastDayHeadTaxPaid || 0);
                // lastDayExpense includes essential+luxury consumption (excluding headTax)
                const consumption = Math.max(0, (o.lastDayExpense || 0) - (o.lastDayHeadTaxPaid || 0));
                const luxuryPart = o.lastDayLuxuryExpense || 0;
                totalLuxuryCost += luxuryPart;
                totalEssentialCost += Math.max(0, consumption - luxuryPart);
            });
            return {
                income: {
                    salary: totalSalary, ownerRevenue: totalPropertyIncome, wage: 0,
                    subsidy: classFinancialData?.official?.income?.subsidy || 0,
                    headTaxSubsidy: classFinancialData?.official?.income?.headTaxSubsidy || 0,
                    militaryPay: 0, tradeImportRevenue: 0, layoffTransfer: 0
                },
                expense: {
                    headTax: totalHeadTax,
                    essentialNeeds: totalEssentialCost > 0 ? { _total: { cost: totalEssentialCost, quantity: 0 } } : {},
                    luxuryNeeds: totalLuxuryCost > 0 ? { _total: { cost: totalLuxuryCost, quantity: 0 } } : {},
                    transactionTax: 0, businessTax: 0, tariffs: 0, productionCosts: 0,
                    wages: 0, decay: 0, tradeExportPurchase: 0, capitalFlight: 0, buildingCost: 0, layoffTransfer: 0
                }
            };
        }
        return classFinancialData[stratumKey] || {};
    })();
    const incomeData = finData.income || {};
    const expenseData = finData.expense || {};

    // Calculate total income from detailed breakdown
    const wageInc = (incomeData.wage || 0);
    const ownerRev = (incomeData.ownerRevenue || 0);
    const subsidyInc = (incomeData.subsidy || 0);
    const salaryInc = (incomeData.salary || 0);
    const militaryInc = (incomeData.militaryPay || 0);
    const tradeImportRevInc = (incomeData.tradeImportRevenue || 0);
    const layoffTransferInInc = (incomeData.layoffTransfer || 0);
    const calculatedTotalIncome = (wageInc + ownerRev + subsidyInc + salaryInc + militaryInc + tradeImportRevInc + layoffTransferInInc) / safeDayScale;

    // Calculate total expense from detailed breakdown
    const headTaxExp = (expenseData.headTax || 0);
    const transTaxExp = (expenseData.transactionTax || 0);
    const bizTaxExp = (expenseData.businessTax || 0);
    const tariffsExp = (expenseData.tariffs || 0);
    const prodCostsExp = (expenseData.productionCosts || 0);
    const wagesExp = (expenseData.wages || 0);
    const decayExp = (expenseData.decay || 0);
    const tradeExportPurchaseExp = (expenseData.tradeExportPurchase || 0);
    const capitalFlightExp = (expenseData.capitalFlight || 0);
    const buildingCostExp = (expenseData.buildingCost || 0);
    const layoffTransferOutExp = (expenseData.layoffTransfer || 0);

    // Sum object-based needs expenses
    const essentialNeedsExp = typeof expenseData.essentialNeeds === 'object'
        ? Object.values(expenseData.essentialNeeds).reduce((sum, entry) => sum + (typeof entry === 'object' ? entry.cost : entry || 0), 0)
        : 0;
    const luxuryNeedsExp = typeof expenseData.luxuryNeeds === 'object'
        ? Object.values(expenseData.luxuryNeeds).reduce((sum, entry) => sum + (typeof entry === 'object' ? entry.cost : entry || 0), 0)
        : 0;

    const calculatedTotalExpense = (headTaxExp + transTaxExp + bizTaxExp + tariffsExp + prodCostsExp + wagesExp + decayExp + essentialNeedsExp + luxuryNeedsExp + tradeExportPurchaseExp + capitalFlightExp + buildingCostExp + layoffTransferOutExp) / safeDayScale;

    // Use calculated values if available (non-zero or if we trust finData structure is present), fall back to props if purely empty
    // We prefer the calculated one to match Finance tab
    const totalIncome = calculatedTotalIncome;
    const totalExpense = calculatedTotalExpense;
    const incomePerCapita = totalIncome / Math.max(count, 1);
    const expensePerCapita = totalExpense / Math.max(count, 1);
    // Net income should be income minus expense, not wealth delta
    // Wealth delta includes many other factors (market trades, events, etc.)
    const netIncomePerCapita = incomePerCapita - expensePerCapita;
    const shortages = classShortages[stratumKey] || [];
    const rawHeadTaxMultiplier = taxPolicies?.headTaxRates?.[stratumKey] ?? 1;
    // 安全检查：处理 Infinity、NaN 等异常值
    const headTaxMultiplier = (Number.isFinite(rawHeadTaxMultiplier) ? rawHeadTaxMultiplier : 1);
    const stratumRebellionState = rebellionStates[stratumKey] || {};
    const currentOrganization = stratumRebellionState.organization ?? 0;
    const derivedDemands =
        (activeDemands[stratumKey] && activeDemands[stratumKey].length > 0)
            ? activeDemands[stratumKey]
            : (stratumRebellionState.activeDemands || []);

    // 使用从simulation传来的生活水平数据，如果没有则重新计算
    let livingStandardData = classLivingStandard[stratumKey];

    if (!livingStandardData) {
        // 如果没有预计算数据，按主链逻辑回退，避免详情页自己退回旧财富口径
        const startingWealth = stratum.startingWealth || 80;
        const luxuryNeeds = stratum.luxuryNeeds || {};
        const luxuryThresholds = Object.keys(luxuryNeeds).map(Number).sort((a, b) => a - b);
        const wealthPerCapita = count > 0 ? wealthValue / count : 0;
        const priceAwareThresholds = calculatePriceAwareLivingStandardThresholds({
            baseNeeds: stratum.needs || {},
            luxuryNeeds,
            priceMap: getMarketPrice,
            epoch,
            techsUnlocked,
        });

        const wealthReference = priceAwareThresholds.referenceThreshold || startingWealth;
        const wealthRatio = wealthReference > 0 ? wealthPerCapita / wealthReference : 0;

        // 基础需求数量（已解锁的资源）
        const baseNeedsCount = stratum.needs
            ? Object.keys(stratum.needs).filter(r => isResourceUnlocked(r, epoch, techsUnlocked)).length
            : 0;

        // 计算已解锁的奢侈需求档位（与主链保持一致：收入看当前物价，财富仍用配置基线判断解锁能力）
        const baseNeeds = stratum.needs || {};
        let essentialCost = 0;
        const essentialResources = ['food', 'cloth'];
        essentialResources.forEach(resKey => {
            if (baseNeeds[resKey] && isResourceUnlocked(resKey, epoch, techsUnlocked)) {
                const marketPrice = getMarketPrice(resKey);
                const basePrice = RESOURCES[resKey]?.basePrice || 1;
                essentialCost += baseNeeds[resKey] * Math.max(marketPrice, basePrice);
            }
        });
        const incomeRatio = essentialCost > 0 ? incomePerCapita / essentialCost : (incomePerCapita > 0 ? 10 : 0);
        const unlockWealthRatio = startingWealth > 0 ? wealthPerCapita / startingWealth : 0;
        const unlockMultiplier = calculateUnlockMultiplier(
            incomeRatio,
            unlockWealthRatio,
            stratum.wealthElasticity || 1.0,
            null
        );
        const maxConsumptionMultiplier = stratum.maxConsumptionMultiplier || 6;

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
            income: totalIncome,
            expense: totalExpense,
            wealthValue,
            startingWealth,
            wealthReference,
            wealthThresholds: priceAwareThresholds.thresholds,
            essentialCost: essentialCost * count,
            shortagesCount: shortages.length,
            effectiveNeedsCount,
            unlockedLuxuryTiers,
            totalLuxuryTiers: luxuryThresholds.length,
            previousScore: null,
            isNewStratum: true,
            maxConsumptionMultiplier,
            wealthElasticity: stratum.wealthElasticity || 1.0,
        });


        if (livingStandardData) {
            livingStandardData.basketDailyCosts = priceAwareThresholds.dailyCosts;
            livingStandardData.basketThresholds = priceAwareThresholds.thresholds;
            livingStandardData.basketBufferDays = priceAwareThresholds.bufferDays;
        }
    }


    // 从 livingStandardData 中提取所需的值（添加空值检查）
    const {
        wealthPerCapita = 0,
        wealthMultiplier = 1,
        satisfactionRate = 0,
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

    const formatRatioValue = (ratio) => {
        if (!Number.isFinite(ratio) || ratio <= 0) return '0';
        if (ratio >= 100) return ratio.toFixed(0);
        if (ratio >= 10) return ratio.toFixed(1);
        return ratio.toFixed(2);
    };


    // 计算解锁乘数（用于奢侈需求解锁判断，不受阶层消费上限限制）
    // 这里重新计算是因为 livingStandardData 中的 wealthMultiplier 是受上限限制的
    const startingWealthForCalc = stratum.startingWealth || 80;
    const wealthPerCapitaForCalc = count > 0 ? wealthValue / count : 0;
    const wealthRatioForCalc = startingWealthForCalc > 0 ? wealthPerCapitaForCalc / startingWealthForCalc : 0;
    const baseNeedsForCalc = stratum.needs || {};
    let essentialCostForCalc = 0;
    ['food', 'cloth'].forEach(resKey => {
        if (baseNeedsForCalc[resKey] && isResourceUnlocked(resKey, epoch, techsUnlocked)) {
            const marketPrice = getMarketPrice(resKey);
            const basePrice = RESOURCES[resKey]?.basePrice || 1;
            essentialCostForCalc += baseNeedsForCalc[resKey] * Math.max(marketPrice, basePrice);
        }
    });
    const incomeRatioForCalc = essentialCostForCalc > 0 ? incomePerCapita / essentialCostForCalc : (incomePerCapita > 0 ? 10 : 0);
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
    const unlockedLuxuryNeedsDetail = [];
    for (const threshold of luxuryThresholds) {
        if (unlockMultiplier >= threshold) {
            const tierNeeds = luxuryNeeds[threshold];
            const unlockedResources = Object.keys(tierNeeds).filter(r => isResourceUnlocked(r, epoch, techsUnlocked));
            const newResources = unlockedResources.filter(r => !stratum.needs?.[r]);
            if (unlockedResources.length > 0) {
                unlockedLuxuryNeedsDetail.push({ threshold, count: unlockedResources.length, newResources });
            }
        }
    }


    // 人头税：正值 = 税收（百分比），负值 = 补贴（银币/人/日绝对值）
    const headBaseRate = TAX_BASE_RATES?.HEAD_TAX_INCOME_RATIO || 0.05;
    const isSubsidyMode = headTaxMultiplier < 0 || Object.is(headTaxMultiplier, -0);
    const displayHeadPercent = isSubsidyMode ? 0 : headTaxMultiplier * headBaseRate * 100;
    const displaySubsidyValue = isSubsidyMode ? Math.abs(headTaxMultiplier) : 0;
    const headPercentToMultiplier = (pct) => pct / (headBaseRate * 100);

    const handleDraftChange = (raw) => {
        setDraftMultiplier(raw);
    };

    const maxHeadPercent = (TAX_LIMITS?.MAX_HEAD_TAX || 100) * headBaseRate * 100;
    const commitDraft = () => {
        if (draftMultiplier === null || !onUpdateTaxPolicies) return;
        const parsed = parseFloat(draftMultiplier);
        if (Number.isNaN(parsed)) { setDraftMultiplier(null); return; }
        let storeValue;
        if (isSubsidyMode) {
            storeValue = -(Math.max(0, Math.abs(parsed)));
        } else {
            const clampedPct = Math.min(Math.max(0, parsed), maxHeadPercent);
            storeValue = headPercentToMultiplier(clampedPct);
        }
        onUpdateTaxPolicies(prev => ({
            ...prev,
            headTaxRates: {
                ...(prev?.headTaxRates || {}),
                [stratumKey]: storeValue,
            },
        }));
        setDraftMultiplier(null);
    };

    // 组件卸载时自动提交未保存的 draft
    const draftRef = React.useRef(null);
    draftRef.current = { draftMultiplier, isSubsidyMode, maxHeadPercent, headPercentToMultiplier, onUpdateTaxPolicies, stratumKey };
    React.useEffect(() => {
        return () => {
            const ctx = draftRef.current;
            if (ctx.draftMultiplier === null || !ctx.onUpdateTaxPolicies) return;
            const parsed = parseFloat(ctx.draftMultiplier);
            if (Number.isNaN(parsed)) return;
            let storeValue;
            if (ctx.isSubsidyMode) {
                storeValue = -(Math.max(0, Math.abs(parsed)));
            } else {
                const clampedPct = Math.min(Math.max(0, parsed), ctx.maxHeadPercent);
                storeValue = ctx.headPercentToMultiplier(clampedPct);
            }
            ctx.onUpdateTaxPolicies(prev => ({
                ...prev,
                headTaxRates: {
                    ...(prev?.headTaxRates || {}),
                    [ctx.stratumKey]: storeValue,
                },
            }));
        };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps


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
                {(stratumKey !== 'official') && (
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
                                if (org > 30) return <span className={`ml-1 px-1 py-0.5 rounded text-xs ${org >= 70 ? 'bg-red-600' : 'bg-orange-600'}`}>{org.toFixed(0)}%</span>;
                                return null;
                            })()}
                        </span>
                    </button>
                )}
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
                                <span className="text-xs text-gray-400 leading-none">人口</span>
                            </div>
                            <div className="text-sm font-bold text-white font-mono leading-none">{Math.floor(count)}</div>
                        </div>

                        {/* 好感度 / 官员忠诚度 (特殊处理) */}
                        {stratumKey === 'official' ? (
                            <div className="bg-gray-700/50 rounded p-1.5 border border-gray-600">
                                <div className="flex items-center gap-1 mb-0.5">
                                    <Icon name="Shield" size={12} className="text-blue-400" />
                                    <span className="text-xs text-gray-400 leading-none">忠诚</span>
                                </div>
                                {(() => {
                                    const employedOfficials = officials || [];
                                    const avgLoyalty = employedOfficials.length > 0
                                        ? employedOfficials.reduce((sum, o) => sum + (o.loyalty || 0), 0) / employedOfficials.length
                                        : 0;
                                    const supportColor = avgLoyalty >= 80 ? 'text-green-400' : avgLoyalty >= 60 ? 'text-blue-400' : avgLoyalty >= 40 ? 'text-yellow-400' : 'text-red-400';
                                    return (
                                        <div className={`text-sm font-bold font-mono leading-none ${supportColor}`}>
                                            {avgLoyalty.toFixed(0)}%
                                        </div>
                                    );
                                })()}
                            </div>
                        ) : (
                            <div className="bg-gray-700/50 rounded p-1.5 border border-gray-600">
                                <div className="flex items-center gap-1 mb-0.5">
                                    <Icon name="Heart" size={12} className="text-pink-400" />
                                    <span className="text-xs text-gray-400 leading-none">好感</span>
                                </div>
                                <div className={`text-sm font-bold font-mono leading-none ${getApprovalColor(approval)}`}>
                                    {approval.toFixed(0)}%
                                </div>
                            </div>
                        )}

                        {/* 影响力 */}
                        <div className="bg-gray-700/50 rounded p-1.5 border border-gray-600">
                            <div className="flex items-center gap-1 mb-0.5">
                                <Icon name="Zap" size={12} className="text-purple-400" />
                                <span className="text-xs text-gray-400 leading-none">影响</span>
                            </div>
                            <div className="text-sm font-bold text-purple-300 font-mono leading-none">{influence.toFixed(0)}</div>
                        </div>

                        {/* 财富 total */}
                        <div className="bg-gray-700/50 rounded p-1.5 border border-gray-600">
                            <div className="flex items-center gap-1 mb-0.5">
                                <Icon name="Coins" size={12} className="text-yellow-400" />
                                <span className="text-xs text-gray-400 leading-none">财富</span>
                            </div>
                            <div className="text-sm font-bold text-yellow-300 font-mono leading-none">{formatNumberShortCN(wealthValue, { decimals: 1 })}</div>
                        </div>
                    </div>

                    {/* 生活水平 */}
                    <div className={`rounded p-2 border ${livingStandardBorderColor} ${livingStandardBgColor}`}>
                        <h3 className="text-xs font-bold text-white mb-1.5 flex items-center gap-1">
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
                                    <div className="text-xs text-gray-400 leading-none">综合评分: {livingStandardScore.toFixed(0)}</div>
                                </div>
                            </div>

                            {/* detail metrics */}
                            <div className="flex-1 grid grid-cols-2 gap-1.5">
                                <div className="bg-gray-800/40 rounded px-2 py-1">
                                    <div className="text-xs text-gray-400 leading-none mb-0.5">{'\u4eba\u5747\u8d22\u5bcc'}</div>
                                    <div className="text-xs font-bold text-yellow-300 font-mono">{formatNumberShortCN(wealthPerCapita, { decimals: 1 })}</div>
                                    <div className="text-xs text-gray-500 leading-none">{'\u7528\u4e8e\u8861\u91cf\u5f53\u524d\u9636\u5c42\u8d44\u4ea7\u6c34\u5e73'}</div>
                                </div>
                                <div className="bg-gray-800/40 rounded px-2 py-1">
                                    <div className="text-xs text-gray-400 leading-none mb-0.5">{'\u9700\u6c42\u6ee1\u8db3'}</div>
                                    <div className={`text-xs font-bold font-mono ${satisfactionRate >= 0.8 ? 'text-green-400' : satisfactionRate >= 0.5 ? 'text-yellow-400' : 'text-red-400'}`}>
                                        {(satisfactionRate * 100).toFixed(0)}%
                                    </div>
                                    <div className="text-xs text-gray-500 leading-none">{`\u6ee1\u610f\u5ea6\u4e0a\u9650: ${approvalCap}%`}</div>
                                </div>
                            </div>
                        </div>

                        <div className="mt-2 grid grid-cols-2 gap-1.5">
                            <div className="bg-gray-800/30 rounded px-2 py-1 border border-gray-700/50">
                                <div className="text-xs text-gray-400 leading-none mb-0.5">消费能力</div>
                                <div className={`text-xs font-bold font-mono ${wealthMultiplier >= 2 ? 'text-purple-400' : wealthMultiplier >= 1.5 ? 'text-blue-400' : wealthMultiplier >= 1 ? 'text-green-400' : 'text-red-400'}`}>
                                    ×{wealthMultiplier.toFixed(2)}
                                </div>
                                <div className="text-xs text-gray-500 leading-none">购买量倍率 | 弹性 {stratum.wealthElasticity ?? 1.0}</div>
                            </div>
                            <div className="bg-gray-800/30 rounded px-2 py-1 border border-gray-700/50">
                                <div className="text-xs text-gray-400 leading-none mb-0.5">奢侈解锁</div>
                                <div className="text-xs font-bold text-blue-300 font-mono">{unlockedLuxuryTiers}/{totalLuxuryTiers || 0} 档</div>
                                <div className="text-xs text-gray-500 leading-none">消费阈值 {formatRatioValue(unlockMultiplier)}× | 奢侈消费 {formatRatioValue(luxuryConsumptionMultiplier)}×</div>
                            </div>
                        </div>


                        {/* 奢侈需求解锁进度：这里展示的是消费倍率阈值，不是生活水平财富线 */}
                        {unlockedLuxuryNeedsDetail.length > 0 && (
                            <div className="mt-2 pt-2 border-t border-gray-700/50">
                                <div className="flex items-center justify-between mb-1">
                                    <span className="text-xs text-gray-400">已解锁奢侈需求</span>
                                    <span className="text-xs font-bold text-blue-400">
                                        {unlockedLuxuryNeedsDetail.length} 档
                                    </span>
                                </div>
                                <div className="flex gap-1">
                                    {unlockedLuxuryNeedsDetail.map(({ threshold, count }) => {
                                        const tierNeeds = luxuryNeeds[threshold];
                                        const unlockedResources = Object.keys(tierNeeds).filter(r => isResourceUnlocked(r, epoch, techsUnlocked));
                                        const resourceNames = unlockedResources.map(r => RESOURCES[r]?.name || r).join('、');
                                        return (
                                            <div
                                                key={threshold}
                                                className="flex-1 rounded px-1.5 py-1 text-center bg-blue-900/30 border border-blue-500/40"
                                                title={`${threshold}×消费阈值解锁: ${resourceNames}`}
                                            >
                                                <div className="text-xs font-bold text-blue-300">
                                                    {threshold}×
                                                </div>
                                                <div className="text-xs text-gray-300">
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
                            <h3 className="text-xs font-bold text-white mb-1.5 flex items-center gap-1">
                                <Icon name="Sliders" size={12} className="text-yellow-400" />
                                人头税调整
                            </h3>
                            <div className="grid grid-cols-2 gap-2 items-center">
                                <div>
                                    <div className="text-xs text-gray-400 mb-0.5 leading-none">
                                        {isSubsidyMode ? '补贴 (银币/人/日)' : '税率 (%)'}
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const newValue = isSubsidyMode ? 1.0 : -0.05;
                                                onUpdateTaxPolicies(prev => ({
                                                    ...prev,
                                                    headTaxRates: {
                                                        ...(prev?.headTaxRates || {}),
                                                        [stratumKey]: newValue,
                                                    },
                                                }));
                                                setDraftMultiplier(null);
                                            }}
                                            className={`btn-compact flex-shrink-0 w-6 h-6 border rounded text-xs font-bold flex items-center justify-center transition-colors ${
                                                isSubsidyMode
                                                    ? 'bg-green-900/50 hover:bg-green-800/50 border-green-600 text-green-300'
                                                    : 'bg-gray-700 hover:bg-gray-600 border-gray-500 text-gray-300'
                                            }`}
                                            title={isSubsidyMode ? '切换到税收模式' : '切换到补贴模式'}
                                        >
                                            {isSubsidyMode ? '补' : '税'}
                                        </button>
                                        <input
                                            type="text"
                                            inputMode="decimal"
                                            step={isSubsidyMode ? '0.01' : '1'}
                                            value={draftMultiplier ?? (isSubsidyMode
                                                ? displaySubsidyValue.toFixed(2)
                                                : (Number.isInteger(displayHeadPercent) ? displayHeadPercent : displayHeadPercent.toFixed(1))
                                            )}
                                            onChange={(e) => handleDraftChange(e.target.value)}
                                            onBlur={commitDraft}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    commitDraft();
                                                    e.target.blur();
                                                }
                                            }}
                                            className="flex-grow min-w-0 bg-gray-900/70 border border-gray-600 text-sm text-gray-200 rounded px-2 py-1 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-center"
                                            placeholder={isSubsidyMode ? '银币/人/日' : '收入税率%'}
                                        />
                                    </div>
                                </div>
                                <div>
                                    {(() => {
                                        const isTax = !isSubsidyMode && displayHeadPercent > 0;
                                        const displayValue = isSubsidyMode
                                            ? displaySubsidyValue
                                            : (expenseData.headTax || 0) / safeDayScale / Math.max(count, 1);
                                        return (
                                            <>
                                                <div className="text-xs text-gray-400 mb-0.5 leading-none">{isSubsidyMode ? '设定补贴' : '实际税额'} (每人每日)</div>
                                                <div className="bg-gray-800/50 rounded px-2 py-1.5 text-center">
                                                    <span className={`text-sm font-bold font-mono ${isTax ? 'text-yellow-300' : isSubsidyMode ? 'text-green-300' : 'text-gray-400'}`}>
                                                        {isSubsidyMode ? '补贴 ' : ''}{isSubsidyMode ? displayValue.toFixed(2) : Math.abs(displayValue).toFixed(3)}
                                                    </span>
                                                    <Icon
                                                        name="Coins"
                                                        size={12}
                                                        className={`inline-block ml-1 ${isTax ? 'text-yellow-400' : isSubsidyMode ? 'text-green-400' : 'text-gray-500'}`}
                                                    />
                                                </div>
                                                {!isSubsidyMode && Math.abs((effectiveTaxModifier || 1) - 1) > 0.001 && (
                                                    <div className="text-[11px] text-gray-500 mt-1 text-center">
                                                        含税收修正 ×{(effectiveTaxModifier || 1).toFixed(2)}
                                                    </div>
                                                )}
                                            </>
                                        );
                                    })()}
                                </div>
                            </div>

                        </div>
                    )}

                    {/* 收支情况 */}
                    <div className="bg-gray-700/50 rounded p-2 border border-gray-600">
                        <h3 className="text-xs font-bold text-white mb-1.5 flex items-center gap-1">
                            <Icon name="TrendingUp" size={12} className="text-green-400" />
                            每日人均收支
                        </h3>
                        <div className="grid grid-cols-3 gap-2">
                            <div>
                                <div className="text-xs text-gray-400 mb-0.5 leading-none">收入</div>
                                <div className="text-sm font-bold text-green-400 font-mono leading-none">
                                    +{Math.abs(incomePerCapita).toFixed(2)}
                                </div>
                            </div>
                            <div>
                                <div className="text-xs text-gray-400 mb-0.5 leading-none">支出</div>
                                <div className="text-sm font-bold text-red-400 font-mono leading-none">
                                    -{Math.abs(expensePerCapita).toFixed(2)}
                                </div>
                            </div>
                            <div>
                                <div className="text-xs text-gray-400 mb-0.5 leading-none">净收入</div>
                                <div className={`text-sm font-bold font-mono leading-none ${netIncomePerCapita >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                    {netIncomePerCapita >= 0 ? '+' : ''}{netIncomePerCapita.toFixed(2)}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 资源需求 */}
                    <div className="bg-gray-700/50 rounded p-2 border border-gray-600">
                        <h3 className="text-xs font-bold text-white mb-1.5 flex items-center gap-1">
                            <Icon name="Package" size={12} className="text-amber-400" />
                            资源需求清单
                            {totalLuxuryTiers > 0 && unlockedLuxuryTiers > 0 && (
                                <span className="text-xs text-purple-400 ml-1">(含富裕需求)</span>
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
                                    <div className="text-center text-gray-400 text-xs py-2">
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
                                                                <span className="text-xs px-1 py-0.5 rounded bg-purple-900/40 text-purple-300 border border-purple-500/30">
                                                                    富裕 {luxuryThreshold}×
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="text-xs text-gray-400 leading-tight truncate">{resource?.desc || '资源描述'}</div>
                                                    </div>
                                                </div>

                                                {/* 需求量信息 */}
                                                <div className="bg-gray-800/40 rounded px-2 py-1 mb-1">
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-xs text-gray-400 leading-none">人均需求</span>
                                                        <span className="text-xs font-bold text-white font-mono leading-none">{amount.toFixed(2)}</span>
                                                    </div>
                                                    <div className="flex items-center justify-between mt-0.5">
                                                        <span className="text-xs text-gray-400 leading-none">总需求</span>
                                                        <span className="text-xs font-bold text-blue-300 font-mono leading-none">{(amount * count).toFixed(2)}</span>
                                                    </div>
                                                </div>

                                                {/* 满足状态 */}
                                                <div className={`flex items-center gap-1.5 px-2 py-1 rounded ${statusBg}`}>
                                                    <Icon name={statusIcon} size={12} className={statusColor} />
                                                    <div className="flex-1 min-w-0">
                                                        <div className={`text-xs font-bold ${statusColor} leading-tight`}>{statusText}</div>
                                                        {reasonDetail && (
                                                            <div className={`text-xs ${statusColor} leading-tight truncate`}>{reasonDetail}</div>
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
                            <h3 className="text-xs font-bold text-white mb-1.5 flex items-center gap-1">
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
                                                <span className="text-xs font-semibold text-green-300 leading-tight">{buff.desc || '满意加成'}</span>
                                            </div>
                                            {details.length > 0 && (
                                                <div className="text-xs text-gray-300 ml-4 leading-tight">{details.join('，')}</div>
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
                                                <span className="text-xs font-semibold text-red-300 leading-tight">{debuff.desc || '不满惩罚'}</span>
                                            </div>
                                            {details.length > 0 && (
                                                <div className="text-xs text-gray-300 ml-4 leading-tight">{details.join('，')}</div>
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
                    {/* 特殊处理：官员阶层显示忠诚度 */}
                    {stratumKey === 'official' ? (
                        (() => {
                            const employedOfficials = officials || [];
                            const avgLoyalty = employedOfficials.length > 0
                                ? employedOfficials.reduce((sum, o) => sum + (o.loyalty || 0), 0) / employedOfficials.length
                                : 0;
                            const supportText = avgLoyalty >= 80 ? '极高' : avgLoyalty >= 60 ? '高' : avgLoyalty >= 40 ? '一般' : '低';
                            const supportColor = avgLoyalty >= 80 ? 'text-green-400' : avgLoyalty >= 60 ? 'text-blue-400' : avgLoyalty >= 40 ? 'text-yellow-400' : 'text-red-400';

                            return (
                                <div className="bg-gray-700/50 rounded p-3 border border-gray-600">
                                    <h3 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
                                        <Icon name="Shield" size={16} className="text-blue-400" />
                                        官员支持度 (平均忠诚)
                                    </h3>
                                    <div className="flex items-center justify-between mb-2">
                                        <span className={`text-lg font-bold ${supportColor}`}>{supportText}</span>
                                        <span className="text-2xl font-mono font-bold text-white">{avgLoyalty.toFixed(1)}</span>
                                    </div>
                                    <div className="w-full bg-gray-800/50 rounded-full h-3 border border-gray-600 overflow-hidden">
                                        <div
                                            className={`h-3 rounded-full transition-all ${avgLoyalty >= 80 ? 'bg-green-500' : avgLoyalty >= 60 ? 'bg-blue-500' : avgLoyalty >= 40 ? 'bg-yellow-500' : 'bg-red-500'}`}
                                            style={{ width: `${avgLoyalty}%` }}
                                        />
                                    </div>
                                    <p className="text-xs text-gray-400 mt-2">
                                        官员的支持度取决于他们的平均忠诚度。忠诚的官员能提高行政效率，减少腐败。
                                    </p>
                                </div>
                            );
                        })()
                    ) : (
                        (() => {
                            const orgState = rebellionStates[stratumKey] || {};
                            const organization = orgState.organization ?? 0;
                            const growthRate = orgState.growthRate ?? 0;
                            const orgStage = getOrganizationStage(organization);
                            const orgStageName = getStageName(orgStage);
                            const orgStageIcon = getStageIcon(orgStage);
                            const daysToUprising = predictDaysToUprising(organization, growthRate);

                            // 组织度增减分析
                            const diffLevel = difficulty || DEFAULT_DIFFICULTY;
                            const satThreshold = getSatisfactionThreshold(diffLevel);
                            const decayThreshold = satThreshold + 3;
                            const isGrowing = growthRate > 0;
                            const isDecaying = growthRate < 0;
                            const isStable = growthRate === 0;

                            // 趋势判断
                            let trendLabel, trendColor, trendIcon;
                            if (isGrowing) {
                                trendLabel = '上升中';
                                trendColor = 'text-red-400';
                                trendIcon = 'TrendingUp';
                            } else if (isDecaying) {
                                trendLabel = '下降中';
                                trendColor = 'text-green-400';
                                trendIcon = 'TrendingDown';
                            } else {
                                trendLabel = '稳定';
                                trendColor = 'text-gray-400';
                                trendIcon = 'Minus';
                            }

                            // 根据好感度和阈值判断组织度增减原因
                            const currentApproval = classApproval[stratumKey] ?? 50;
                            const orgDrivers = [];
                            if (currentApproval < satThreshold) {
                                orgDrivers.push({
                                    label: `好感度 ${currentApproval.toFixed(0)} < 增长阈值 ${satThreshold}`,
                                    effect: '推动组织度增长',
                                    color: 'text-red-300',
                                    icon: 'AlertTriangle',
                                });
                            } else if (currentApproval > decayThreshold) {
                                orgDrivers.push({
                                    label: `好感度 ${currentApproval.toFixed(0)} > 衰减阈值 ${decayThreshold}`,
                                    effect: '推动组织度衰减',
                                    color: 'text-green-300',
                                    icon: 'Heart',
                                });
                            } else {
                                orgDrivers.push({
                                    label: `好感度 ${currentApproval.toFixed(0)} 在安全区间 [${satThreshold}, ${decayThreshold}]`,
                                    effect: '好感度因素无变化',
                                    color: 'text-gray-400',
                                    icon: 'Minus',
                                });
                            }

                            // 驱动因子（shortages, tax 等）
                            const shortages = classShortages[stratumKey] || [];
                            if (shortages.length > 0) {
                                const basicShortages = shortages.filter(s => {
                                    const stratum = STRATA[stratumKey];
                                    return stratum?.needs?.[s.resource];
                                });
                                if (basicShortages.length > 0) {
                                    orgDrivers.push({
                                        label: `基础物资短缺 (${basicShortages.map(s => RESOURCES[s.resource]?.name || s.resource).join('、')})`,
                                        effect: '加速组织度增长',
                                        color: 'text-red-300',
                                        icon: 'PackageX',
                                    });
                                }
                            }

                            // 50%上限检测
                            const hasBasicShortage = shortages.some(s => {
                                const stratum = STRATA[stratumKey];
                                return stratum?.needs?.[s.resource];
                            });
                            const isCappedAt50 = !hasBasicShortage && currentApproval > 60;

                            return (
                                <>
                                    {/* 组织度主卡片 */}
                                    <div className="bg-ancient-ink/40 rounded-lg p-3 border border-ancient-gold/20">
                                        {/* 标题行 */}
                                        <div className="flex items-center justify-between mb-2.5">
                                            <div className="flex items-center gap-2">
                                                <Icon
                                                    name={orgStageIcon}
                                                    size={18}
                                                    className={organization >= 70 ? 'text-red-500 animate-pulse' : organization >= 30 ? 'text-orange-400' : 'text-green-400'}
                                                />
                                                <span className={`text-sm font-bold ${organization >= 70 ? 'text-red-400' : organization >= 30 ? 'text-orange-400' : 'text-green-400'}`}>
                                                    {orgStageName}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-xl font-mono font-bold text-ancient-parchment">{organization.toFixed(0)}%</span>
                                            </div>
                                        </div>

                                        {/* 进度条 */}
                                        <div className="w-full bg-ancient-ink/60 rounded-full h-2.5 border border-ancient-gold/10 overflow-hidden mb-2">
                                            <div
                                                className={`h-2.5 rounded-full transition-all duration-500 ${organization >= 90 ? 'bg-red-500 animate-pulse' :
                                                    organization >= 70 ? 'bg-orange-500' :
                                                        organization >= 50 ? 'bg-yellow-500' :
                                                            organization >= 30 ? 'bg-yellow-600' : 'bg-green-600'
                                                    }`}
                                                style={{ width: `${organization}%` }}
                                            />
                                        </div>

                                        {/* 趋势行 */}
                                        <div className="flex items-center justify-between">
                                            <div className={`flex items-center gap-1.5 text-xs font-medium ${trendColor}`}>
                                                <Icon name={trendIcon} size={14} />
                                                <span>{trendLabel}</span>
                                                {growthRate !== 0 && (
                                                    <span className="font-mono">
                                                        ({growthRate > 0 ? '+' : ''}{growthRate.toFixed(2)}/天)
                                                    </span>
                                                )}
                                            </div>
                                            {daysToUprising !== null && daysToUprising < 200 && (
                                                <span className="text-xs text-red-400 animate-pulse font-bold">
                                                    ⚠️ {daysToUprising}天后叛乱
                                                </span>
                                            )}
                                            {isCappedAt50 && organization >= 49 && (
                                                <span className="text-xs text-blue-300 flex items-center gap-1">
                                                    <Icon name="Lock" size={11} />
                                                    上限50%（无物资短缺）
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* 组织度变化因素 */}
                                    <div className="bg-ancient-ink/30 rounded-lg p-3 border border-ancient-gold/15">
                                        <h3 className="text-xs font-bold text-ancient-parchment mb-2 flex items-center gap-1.5">
                                            <Icon name="Activity" size={14} className="text-ancient-gold" />
                                            组织度变化因素
                                        </h3>
                                        <div className="space-y-1.5">
                                            {orgDrivers.map((driver, idx) => (
                                                <div key={idx} className="flex items-start gap-2 text-xs">
                                                    <Icon name={driver.icon} size={13} className={`${driver.color} flex-shrink-0 mt-0.5`} />
                                                    <div className="flex-1 min-w-0">
                                                        <span className="text-ancient-stone">{driver.label}</span>
                                                        <span className={`ml-1.5 font-medium ${driver.color}`}>→ {driver.effect}</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* 好感度变化分析 */}
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
                                            classWealth,
                                            approvalBreakdown,
                                            classFinancialData,
                                            effectiveTaxModifier: effectiveTaxModifier ?? 1,
                                            popStructure,
                                            dayScale,
                                            market: market || { prices: {} },
                                            taxShock: taxShock || {},
                                            eventApprovalModifiers: eventApprovalModifiers || {},
                                            decreeApprovalModifiers: decreeApprovalModifiers || {},
                                            legitimacyApprovalModifier: legitimacyApprovalModifier || 0,
                                        };
                                        const analysis = analyzeDissatisfactionSources(stratumKey, dissatisfactionContext);
                                        return (
                                            <div className="bg-ancient-ink/30 rounded-lg p-3 border border-ancient-gold/15">
                                                <DissatisfactionAnalysis
                                                    sources={analysis.sources}
                                                    totalContribution={analysis.totalContribution}
                                                    showContributionPercent
                                                    showContributionValue
                                                />
                                            </div>
                                        );
                                    })()}

                                    {/* 当前诉求 */}
                                    {derivedDemands.length > 0 && (
                                        <div className="bg-ancient-ink/30 rounded-lg p-3 border border-ancient-gold/15">
                                            <DemandsList
                                                demands={derivedDemands}
                                                currentDay={daysElapsed}
                                            />
                                        </div>
                                    )}

                                    {/* 策略行动 */}
                                    <div className="bg-ancient-ink/30 rounded-lg p-3 border border-ancient-gold/15 space-y-2.5">
                                        <h3 className="text-xs font-bold text-ancient-parchment flex items-center gap-1.5">
                                            <Icon name="Zap" size={14} className="text-blue-400" />
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
                                            <div className="text-xs text-ancient-stone text-center">暂无可用的策略行动</div>
                                        )}

                                        {/* 承诺任务 */}
                                        {stratumPromiseTasks.length > 0 && (
                                            <div className="pt-2 border-t border-ancient-gold/10">
                                                <h4 className="text-xs font-bold text-ancient-parchment mb-1.5 flex items-center gap-1">
                                                    <Icon name="FileText" size={12} className="text-amber-300" />
                                                    承诺任务
                                                </h4>
                                                <div className="space-y-1">
                                                    {stratumPromiseTasks.map(task => {
                                                        const remaining = getPromiseTaskRemainingDays(task, daysElapsed || 0);
                                                        return (
                                                            <div key={task.id} className="bg-ancient-ink/40 border border-ancient-gold/10 rounded p-2">
                                                                <div className="flex items-center justify-between text-xs">
                                                                    <span className="font-semibold text-ancient-parchment">{task.description}</span>
                                                                    <span className={`font-mono ${remaining <= 5 ? 'text-red-300' : 'text-green-300'}`}>
                                                                        剩余 {remaining} 天
                                                                    </span>
                                                                </div>
                                                                <div className="text-xs text-ancient-stone mt-0.5">
                                                                    失败惩罚: 组织度 +{task.failurePenalty?.organization || 0}%
                                                                    {task.failurePenalty?.forcedUprising ? '（直接爆发）' : ''}
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </>
                            );
                        })())}                </div>
            )}
            {/* 财务Tab内容 */}
            {activeTab === 'finance' && (
                <div className="space-y-2">
                    {/* 总收支概览 - 使用顶层 finData（official 阶层已从 officials 数组汇总，避免 classFinancialData 每 tick 重置问题） */}
                    {(() => {
                        const incomeData = finData.income || {};
                        const expenseData = finData.expense || {};

                        // 计算收入总计
                        const wage = (incomeData.wage || 0) / safeDayScale / Math.max(count, 1);
                        const ownerRevenue = (incomeData.ownerRevenue || 0) / safeDayScale / Math.max(count, 1);
                        // income.subsidy 已经包含人头税补贴（ledger 自动记账），不再单独加 headTaxSubsidy
                        const subsidy = (incomeData.subsidy || 0) / safeDayScale / Math.max(count, 1);
                        const salary = (incomeData.salary || 0) / safeDayScale / Math.max(count, 1);
                        const militaryPay = (incomeData.militaryPay || 0) / safeDayScale / Math.max(count, 1);
                        const tradeImportRevenue = (incomeData.tradeImportRevenue || 0) / safeDayScale / Math.max(count, 1);
                        const layoffTransferIn = (incomeData.layoffTransfer || 0) / safeDayScale / Math.max(count, 1);
                        const totalIncomeCalc = wage + ownerRevenue + subsidy + salary + militaryPay + tradeImportRevenue + layoffTransferIn;

                        // 计算支出总计
                        const headTax = (expenseData.headTax || 0) / safeDayScale / Math.max(count, 1);
                        const transactionTax = (expenseData.transactionTax || 0) / safeDayScale / Math.max(count, 1);
                        const businessTax = (expenseData.businessTax || 0) / safeDayScale / Math.max(count, 1);
                        const tariffs = (expenseData.tariffs || 0) / safeDayScale / Math.max(count, 1);
                        const productionCosts = (expenseData.productionCosts || 0) / safeDayScale / Math.max(count, 1);
                        const wagesExpense = (expenseData.wages || 0) / safeDayScale / Math.max(count, 1);
                        const decay = (expenseData.decay || 0) / safeDayScale / Math.max(count, 1);
                        const tradeExportPurchase = (expenseData.tradeExportPurchase || 0) / safeDayScale / Math.max(count, 1);
                        const capitalFlight = (expenseData.capitalFlight || 0) / safeDayScale / Math.max(count, 1);
                        const buildingCost = (expenseData.buildingCost || 0) / safeDayScale / Math.max(count, 1);
                        const layoffTransferOut = (expenseData.layoffTransfer || 0) / safeDayScale / Math.max(count, 1);

                        const essentialNeedsRaw = typeof expenseData.essentialNeeds === 'object'
                            ? Object.values(expenseData.essentialNeeds).reduce((sum, entry) => {
                                const cost = typeof entry === 'object' ? entry.cost : entry;
                                return sum + (cost || 0);
                            }, 0)
                            : 0;
                        const essentialNeeds = essentialNeedsRaw / safeDayScale / Math.max(count, 1);

                        const luxuryNeedsRaw = typeof expenseData.luxuryNeeds === 'object'
                            ? Object.values(expenseData.luxuryNeeds).reduce((sum, entry) => {
                                const cost = typeof entry === 'object' ? entry.cost : entry;
                                return sum + (cost || 0);
                            }, 0)
                            : 0;
                        const luxuryNeeds = luxuryNeedsRaw / safeDayScale / Math.max(count, 1);

                        const totalExpenseCalc = headTax + transactionTax + businessTax + tariffs + productionCosts + wagesExpense + decay + essentialNeeds + luxuryNeeds + tradeExportPurchase + capitalFlight + buildingCost + layoffTransferOut;
                        const netIncome = totalIncomeCalc - totalExpenseCalc;

                        return (
                            <div className="bg-gray-700/50 rounded p-2 border border-gray-600">
                                <h3 className="text-xs font-bold text-white mb-1.5 flex items-center gap-1">
                                    <Icon name="TrendingUp" size={12} className="text-green-400" />
                                    每日人均收支总览
                                </h3>
                                <div className="grid grid-cols-3 gap-2">
                                    <div>
                                        <div className="text-xs text-gray-400 mb-0.5 leading-none">总收入</div>
                                        <div className="text-sm font-bold text-green-400 font-mono leading-none">
                                            +{totalIncomeCalc.toFixed(2)}
                                        </div>
                                    </div>
                                    <div>
                                        <div className="text-xs text-gray-400 mb-0.5 leading-none">总支出</div>
                                        <div className="text-sm font-bold text-red-400 font-mono leading-none">
                                            -{totalExpenseCalc.toFixed(2)}
                                        </div>
                                    </div>
                                    <div>
                                        <div className="text-xs text-gray-400 mb-0.5 leading-none">净收益</div>
                                        <div className={`text-sm font-bold font-mono leading-none ${netIncome >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                            {netIncome >= 0 ? '+' : '-'}{netIncome.toFixed(2)}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })()}

                    {/* 收入明细 */}
                    <div className="bg-gray-700/50 rounded p-2 border border-gray-600">
                        <h3 className="text-xs font-bold text-white mb-2 flex items-center gap-1">
                            <Icon name="ArrowDownLeft" size={12} className="text-green-400" />
                            收入构成 (人均/日)
                        </h3>
                        {(() => {
                            const data = finData.income || {};
                            const wage = (data.wage || 0) / safeDayScale / Math.max(count, 1);
                            const ownerRevenue = (data.ownerRevenue || 0) / safeDayScale / Math.max(count, 1);
                            // income.subsidy 已包含人头税补贴，拆分为：人头税补贴 + 其他补贴
                            const headTaxSubsidyInc = (data.headTaxSubsidy || 0) / safeDayScale / Math.max(count, 1);
                            const otherSubsidy = Math.max(0, ((data.subsidy || 0) - (data.headTaxSubsidy || 0))) / safeDayScale / Math.max(count, 1);
                            const salary = (data.salary || 0) / safeDayScale / Math.max(count, 1);
                            const militaryPay = (data.militaryPay || 0) / safeDayScale / Math.max(count, 1);
                            const tradeImportRevenue = (data.tradeImportRevenue || 0) / safeDayScale / Math.max(count, 1);
                            const layoffTransferIn = (data.layoffTransfer || 0) / safeDayScale / Math.max(count, 1);
                            const hasAnyIncome = wage > 0.001 || ownerRevenue > 0.001 || otherSubsidy > 0.001 || headTaxSubsidyInc > 0.001 || salary > 0.001 || militaryPay > 0.001 || tradeImportRevenue > 0.001 || layoffTransferIn > 0.001;

                            return (
                                <div className="space-y-1.5">
                                    {wage > 0.001 && (
                                        <div className="flex justify-between items-center text-xs">
                                            <span className="text-gray-300">工资收入</span>
                                            <span className="text-green-400 font-mono">+{wage.toFixed(2)}</span>
                                        </div>
                                    )}
                                    {militaryPay > 0.001 && (
                                        <div className="flex justify-between items-center text-xs">
                                            <span className="text-gray-300">军饷</span>
                                            <span className="text-green-400 font-mono">+{militaryPay.toFixed(2)}</span>
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
                                    {headTaxSubsidyInc > 0.001 && (
                                        <div className="flex justify-between items-center text-xs">
                                            <span className="text-gray-300">人头税补贴</span>
                                            <span className="text-green-400 font-mono">+{headTaxSubsidyInc.toFixed(2)}</span>
                                        </div>
                                    )}
                                    {otherSubsidy > 0.001 && (
                                        <div className="flex justify-between items-center text-xs">
                                            <span className="text-gray-300">政府补贴</span>
                                            <span className="text-green-400 font-mono">+{otherSubsidy.toFixed(2)}</span>
                                        </div>
                                    )}
                                    {tradeImportRevenue > 0.001 && (
                                        <div className="flex justify-between items-center text-xs">
                                            <span className="text-gray-300">贸易进口收入</span>
                                            <span className="text-green-400 font-mono">+{tradeImportRevenue.toFixed(2)}</span>
                                        </div>
                                    )}
                                    {layoffTransferIn > 0.001 && (
                                        <div className="flex justify-between items-center text-xs">
                                            <span className="text-gray-300">人口流入财富</span>
                                            <span className="text-green-400 font-mono">+{layoffTransferIn.toFixed(2)}</span>
                                        </div>
                                    )}
                                    {!hasAnyIncome && (
                                        <div className="text-gray-500 text-xs italic text-center">暂无显著收入</div>
                                    )}
                                </div>
                            );
                        })()}
                    </div>

                    {/* 支出明细 */}
                    <div className="bg-gray-700/50 rounded p-2 border border-gray-600">
                        <h3 className="text-xs font-bold text-white mb-2 flex items-center gap-1">
                            <Icon name="ArrowUpRight" size={12} className="text-red-400" />
                            支出构成 (人均/日)
                        </h3>
                        {(() => {
                            const data = finData.expense || {};
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

                            // 新增支出项
                            const tradeExportPurchase = (data.tradeExportPurchase || 0) / safeDayScale / Math.max(count, 1);
                            const capitalFlight = (data.capitalFlight || 0) / safeDayScale / Math.max(count, 1);
                            const buildingCost = (data.buildingCost || 0) / safeDayScale / Math.max(count, 1);
                            const layoffTransferOut = (data.layoffTransfer || 0) / safeDayScale / Math.max(count, 1);

                            // Calculate 'Other' based on total roleExpense vs tracked items
                            const trackedTotal = headTax + transactionTax + businessTax + tariffs + essentialNeeds + luxuryNeeds + decay + productionCosts + wages + tradeExportPurchase + capitalFlight + buildingCost + layoffTransferOut;
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
                                                    const costVal = (typeof entry === 'object' ? entry.cost : entry) || 0;
                                                    const qtyVal = (typeof entry === 'object' ? entry.quantity : 0) || 0;
                                                    const priceVal = (typeof entry === 'object' ? entry.price : 0) || 0;
                                                    const perCapitaCost = costVal / safeDayScale / Math.max(count, 1);
                                                    const perCapitaQty = qtyVal / safeDayScale / Math.max(count, 1);
                                                    if (perCapitaCost < 0.001) return null;
                                                    const resInfo = RESOURCES[resKey];
                                                    return (
                                                        <div key={resKey} className="flex items-center justify-between text-xs gap-1">
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
                                                    const costVal = (typeof entry === 'object' ? entry.cost : entry) || 0;
                                                    const qtyVal = (typeof entry === 'object' ? entry.quantity : 0) || 0;
                                                    const priceVal = (typeof entry === 'object' ? entry.price : 0) || 0;
                                                    const perCapitaCost = costVal / safeDayScale / Math.max(count, 1);
                                                    const perCapitaQty = qtyVal / safeDayScale / Math.max(count, 1);
                                                    if (perCapitaCost < 0.001) return null;
                                                    const resInfo = RESOURCES[resKey];
                                                    return (
                                                        <div key={resKey} className="flex items-center justify-between text-xs gap-1">
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
                                    {tradeExportPurchase > 0.001 && (
                                        <div className="flex justify-between items-center text-xs">
                                            <span className="text-gray-300">贸易出口成本</span>
                                            <span className="text-red-400 font-mono">-{tradeExportPurchase.toFixed(2)}</span>
                                        </div>
                                    )}
                                    {capitalFlight > 0.001 && (
                                        <div className="flex justify-between items-center text-xs">
                                            <span className="text-gray-300">资本外逃</span>
                                            <span className="text-red-400 font-mono">-{capitalFlight.toFixed(2)}</span>
                                        </div>
                                    )}
                                    {buildingCost > 0.001 && (
                                        <div className="flex justify-between items-center text-xs">
                                            <span className="text-gray-300">建筑投资</span>
                                            <span className="text-red-400 font-mono">-{buildingCost.toFixed(2)}</span>
                                        </div>
                                    )}
                                    {layoffTransferOut > 0.001 && (
                                        <div className="flex justify-between items-center text-xs">
                                            <span className="text-gray-300">人口流出财富</span>
                                            <span className="text-red-400 font-mono">-{layoffTransferOut.toFixed(2)}</span>
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
