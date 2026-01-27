
// 政令标签页组件 -> 改名为政治标签页 (由于不再只包含政令)
// 显示政府、税收及官员管理

import React, { memo } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '../common/UIComponents';
import { STRATA, RESOURCES, EPOCHS, BUILDINGS, TAX_LIMITS } from '../../config';
import { isResourceUnlocked } from '../../utils/resources';
import { CoalitionPanel } from '../panels/CoalitionPanel';
import { OfficialsPanel } from '../panels/officials/OfficialsPanel';
import { formatNumberShortCN } from '../../utils/numberFormat';

// Helper to clamp values
const clamp = (val, min, max) => Math.min(Math.max(val, min), max);

// 定义阶层分组，用于UI显示
const STRATA_GROUPS = {
    upper: {
        name: '上流阶级',
        keys: ['merchant', 'official', 'landowner', 'capitalist', 'engineer'],
    },
    middle: {
        name: '中产阶级',
        keys: ['artisan', 'soldier', 'cleric', 'scribe', 'navigator'],
    },
    lower: {
        name: '底层阶级',
        keys: ['unemployed', 'peasant', 'worker', 'miner', 'serf', 'lumberjack', 'slave'],
    },
};

// 定义资源分组
const RESOURCE_GROUPS = {
    basic: {
        name: '基础资源',
        keys: ['food', 'wood', 'stone', 'cloth'],
    },
    industrial: {
        name: '工业原料',
        keys: ['brick', 'plank', 'copper', 'tools', 'dye', 'iron', 'coal', 'steel'],
    },
    consumer: {
        name: '消费品',
        keys: ['papyrus', 'delicacies', 'furniture', 'ale', 'fine_clothes', 'spice', 'coffee'],
    }
};
const ALL_GROUPED_RESOURCES = new Set(Object.values(RESOURCE_GROUPS).flatMap(g => g.keys));

// 紧凑型资源税卡片
const ResourceTaxCard = ({
    resourceKey,
    info,
    rate,
    hasSupply,
    draftRate,
    onDraftChange,
    onCommit,
    importTariffMultiplier,
    exportTariffMultiplier,
    draftImportTariff,
    draftExportTariff,
    onImportTariffDraftChange,
    onExportTariffDraftChange,
    onImportTariffCommit,
    onExportTariffCommit,
    onImportTariffToggleSign,
    onExportTariffToggleSign,
}) => {
    // 当税率为负时，作为"交易补贴"运作
    const currentRate = rate ?? 0;
    const isSubsidy = currentRate < 0;
    const displayValue = Math.abs(currentRate * 100).toFixed(0);
    const valueColor = isSubsidy ? 'text-green-300' : 'text-blue-300';
    const currentImportTariff = Number.isFinite(importTariffMultiplier) ? importTariffMultiplier : 0;
    const currentExportTariff = Number.isFinite(exportTariffMultiplier) ? exportTariffMultiplier : 0;

    return (
        <div
            className={`bg-gray-900/40 p-2 rounded-lg border flex flex-col justify-between transition-opacity ${hasSupply ? 'border-gray-700/60' : 'border-gray-800/50 opacity-50'
                }`}
        >
            <div>
                {/* 头部：Icon + 名称 + 缺货标记 */}
                <div className="flex items-center gap-1.5 mb-0.5">
                    <Icon name={info.icon || 'Box'} size={14} className={info.color || 'text-gray-400'} />
                    <span className="font-semibold text-gray-300 text-xs flex-grow whitespace-nowrap overflow-hidden text-ellipsis">{info.name}</span>
                    {!hasSupply && <div className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" title="当前无市场供应"></div>}
                </div>
                {/* 状态栏：当前税率/补贴 */}
                <div className="text-center my-0.5">
                    <span className={`${valueColor} text-lg`}>
                        {isSubsidy ? `补贴 ${displayValue}` : `${displayValue}`}<span className="text-xs">%</span>
                    </span>
                </div>
            </div>
            {/* 控制区：输入框 + 正负切换按钮 */}
            <div className="flex items-center gap-1">
                <button
                    type="button"
                    onClick={() => {
                        const currentValue = parseFloat(draftRate ?? (currentRate * 100));
                        const newValue = isNaN(currentValue) ? -10 : -currentValue;
                        onDraftChange(resourceKey, String(newValue));
                        setTimeout(() => onCommit(resourceKey), 0);
                    }}
                    className="btn-compact flex-shrink-0 w-5 h-5 bg-gray-700 hover:bg-gray-600 border border-gray-500 rounded text-[9px] font-bold text-gray-300 flex items-center justify-center transition-colors"
                    title="切换正负值（税收/补贴）"
                >
                    ±
                </button>
                <input
                    type="text"
                    inputMode="numeric"
                    step="0.01"
                    value={draftRate ?? ((currentRate * 100).toFixed(0))}
                    onChange={(e) => onDraftChange(resourceKey, e.target.value)}
                    onBlur={() => onCommit(resourceKey)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            onCommit(resourceKey);
                            e.target.blur();
                        }
                    }}
                    className="flex-grow min-w-0 bg-gray-900/70 border border-gray-600 text-[11px] text-gray-200 rounded px-1.5 py-0.5 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-center"
                    placeholder="税率%"
                />
            </div>
            <div className="mt-1.5 border-t border-gray-800/70 pt-1.5 space-y-1.5">
                {/* 进口关税 */}
                <div>
                    <div className="flex items-center justify-between text-[10px] text-gray-400 mb-0.5">
                        <span className="flex items-center gap-0.5">
                            <Icon name="ArrowDownLeft" size={10} className="text-blue-400" />
                            进口关税
                        </span>
                        <span className={`font-mono text-xs ${currentImportTariff < 0 ? 'text-green-300' : 'text-gray-200'}`}>
                            {currentImportTariff < 0 ? '补贴 ' : ''}{(currentImportTariff * 100).toFixed(0)}%
                        </span>
                    </div>
                    <div className="flex items-center gap-1">
                        <button
                            type="button"
                            onClick={() => onImportTariffToggleSign && onImportTariffToggleSign(resourceKey, draftImportTariff ?? currentImportTariff)}
                            className="btn-compact flex-shrink-0 w-5 h-5 bg-gray-700 hover:bg-gray-600 border border-gray-500 rounded text-[9px] font-bold text-gray-300 flex items-center justify-center transition-colors"
                            title="切换正负值（关税/补贴）"
                        >
                            ±
                        </button>
                        <input
                            type="text"
                            inputMode="decimal"
                            step="0.1"
                            value={draftImportTariff ?? (currentImportTariff * 100).toFixed(0)}
                            onChange={(e) => onImportTariffDraftChange(resourceKey, e.target.value)}
                            onBlur={() => onImportTariffCommit(resourceKey)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    onImportTariffCommit(resourceKey);
                                    e.target.blur();
                                }
                            }}
                            className="flex-grow min-w-0 bg-gray-900/70 border border-gray-600 text-[11px] text-gray-200 rounded px-1.5 py-0.5 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-center"
                            placeholder="进口关税%"
                        />
                    </div>
                </div>
                {/* 出口关税 */}
                <div>
                    <div className="flex items-center justify-between text-[10px] text-gray-400 mb-0.5">
                        <span className="flex items-center gap-0.5">
                            <Icon name="ArrowUpRight" size={10} className="text-green-400" />
                            出口关税
                        </span>
                        <span className={`font-mono text-xs ${currentExportTariff < 0 ? 'text-green-300' : 'text-gray-200'}`}>
                            {currentExportTariff < 0 ? '补贴 ' : ''}{(currentExportTariff * 100).toFixed(0)}%
                        </span>
                    </div>
                    <div className="flex items-center gap-1">
                        <button
                            type="button"
                            onClick={() => onExportTariffToggleSign && onExportTariffToggleSign(resourceKey, draftExportTariff ?? currentExportTariff)}
                            className="btn-compact flex-shrink-0 w-5 h-5 bg-gray-700 hover:bg-gray-600 border border-gray-500 rounded text-[9px] font-bold text-gray-300 flex items-center justify-center transition-colors"
                            title="切换正负值（关税/补贴）"
                        >
                            ±
                        </button>
                        <input
                            type="text"
                            inputMode="decimal"
                            step="0.1"
                            value={draftExportTariff ?? (currentExportTariff * 100).toFixed(0)}
                            onChange={(e) => onExportTariffDraftChange(resourceKey, e.target.value)}
                            onBlur={() => onExportTariffCommit(resourceKey)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    onExportTariffCommit(resourceKey);
                                    e.target.blur();
                                }
                            }}
                            className="flex-grow min-w-0 bg-gray-900/70 border border-gray-600 text-[11px] text-gray-200 rounded px-1.5 py-0.5 focus:ring-1 focus:ring-green-500 focus:border-green-500 text-center"
                            placeholder="出口关税%"
                        />
                    </div>
                </div>
                <p className="text-[9px] text-gray-500 mt-1">最终税率 = 交易税 + 关税（加法叠加）</p>
            </div>
        </div>
    );
};
// 营业税卡片组件
const BusinessTaxCard = ({ building, multiplier, buildingCount, draftMultiplier, onDraftChange, onCommit, onToggleSign }) => {
    const base = building.businessTaxBase ?? 0.1; // 默认税基
    const currentMultiplier = multiplier ?? 1;
    const finalRate = currentMultiplier * base;
    const isSubsidy = finalRate < 0;
    const isTax = finalRate > 0;

    const valueColor = isSubsidy ? 'text-green-300' : 'text-yellow-300';
    const borderColor = isSubsidy ? 'border-green-700/60' : (isTax ? 'border-yellow-700/60' : 'border-gray-700/60');
    const bgColor = building.visual?.color || 'bg-gray-700';
    const textColor = building.visual?.text || 'text-gray-200';

    return (
        <div
            className={`bg-gray-900/40 p-1.5 rounded-lg border ${borderColor} flex flex-col gap-1 transition-all ${buildingCount > 0 ? '' : 'opacity-50'
                }`}
        >
            <div>
                {/* 头部：Icon + 名称 + 建筑数量 */}
                <div className="flex items-center gap-1 mb-0.5">
                    <div className={`${bgColor} ${textColor} p-0.5 rounded`}>
                        <Icon name={building.visual?.icon || 'Building'} size={14} />
                    </div>
                    <span className="font-semibold text-gray-300 text-xs flex-grow whitespace-nowrap overflow-hidden text-ellipsis">
                        {building.name}
                    </span>
                    <span className="text-gray-500 text-[10px] font-mono">{buildingCount}</span>
                </div>

                {/* 状态栏：当前税率/补贴 */}
                <div className="text-center my-0.5">
                    {isSubsidy ? (
                        <div className="flex items-center justify-center gap-1">
                            <Icon name="TrendingDown" size={12} className="text-green-400" />
                            <span className={`${valueColor} text-sm font-semibold`}>
                                补贴 {Math.abs(finalRate).toFixed(2)}
                            </span>
                        </div>
                    ) : isTax ? (
                        <div className="flex items-center justify-center gap-1">
                            <Icon name="TrendingUp" size={12} className="text-yellow-400" />
                            <span className={`${valueColor} text-sm font-semibold`}>
                                {finalRate.toFixed(2)}
                            </span>
                        </div>
                    ) : (
                        <span className="text-gray-500 text-sm">无税收</span>
                    )}
                    <div className="text-[10px] text-gray-500 mt-0">银币/建筑/次 (基{base.toFixed(2)})</div>
                </div>
            </div>

            {/* 控制区：输入框 + 正负切换按钮 */}
            <div className="flex items-center gap-1">
                <button
                    type="button"
                    onClick={() => onToggleSign && onToggleSign(building.id, draftMultiplier ?? currentMultiplier)}
                    className="btn-compact flex-shrink-0 w-5 h-5 bg-gray-700 hover:bg-gray-600 border border-gray-500 rounded text-[9px] font-bold text-gray-300 flex items-center justify-center transition-colors"
                    title="切换正负值（税收/补贴）"
                >
                    ±
                </button>
                <input
                    type="text"
                    inputMode="decimal"
                    step="0.05"
                    value={draftMultiplier ?? (currentMultiplier ?? 1)}
                    onChange={(e) => onDraftChange(building.id, e.target.value)}
                    onBlur={() => onCommit(building.id)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            onCommit(building.id);
                            e.target.blur();
                        }
                    }}
                    className="flex-grow min-w-0 bg-gray-900/70 border border-gray-600 text-[11px] text-gray-200 rounded px-1.5 py-0 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-center"
                    placeholder="税率系数"
                />
            </div>
        </div>
    );
};

/**
 * 政治标签页组件 (PoliticsTab)
 * 管理政府、税收和官员
 */
const PoliticsTabComponent = ({
    // Shared Props
    epoch = 0,
    techsUnlocked = [],
    popStructure = {},
    buildings = {},
    market = {},
    jobFill = {},
    jobsAvailable = {},
    resources = {},
    buildingFinancialData = {},

    // Politics Props (Coalition)
    rulingCoalition = [],
    onUpdateCoalition,
    classInfluence = {},
    totalInfluence = 0,
    legitimacy = 0,
    classApproval = {},
    silver = 0,
    onSpendSilver,

    // Tax Props
    taxPolicies,
    onUpdateTaxPolicies,

    // Official System Props
    officials = [],
    candidates = [],
    capacity = 0,
    lastSelectionDay = 0,
    currentTick = 0,
    onTriggerSelection,
    onHire,
    onFire,
    onDispose,
    onUpdateOfficialSalary,
    onUpdateOfficialName,
    ministerAssignments = {},
    ministerAutoExpansion = {},
    lastMinisterExpansionDay = 0,
    onAssignMinister,
    onClearMinister,
    onToggleMinisterAutoExpansion,

    // Cabinet Synergy Props
    classWealth = {},
    activeDecrees = {},
    decreeCooldowns = {},
    quotaTargets = {},
    expansionSettings = {},
    onUpdateQuotas,
    onUpdateExpansionSettings,
    onEnactDecree,

    // [NEW] 额外上下文
    jobCapacity = 0,
    maxCapacity = 3,
    stanceContext = {},

    // [NEW] 价格管制相关
    priceControls = { enabled: false, governmentBuyPrices: {}, governmentSellPrices: {} },
    onUpdatePriceControls,

    // [NEW] 忠诚度系统 UI 相关
    stability = 50,        // 当前国家稳定度 (0-100)
    officialsPaid = true,  // 是否支付了全额薪水

    // [NEW] 政令相关
    decrees = [],
    onToggleDecree,
    onShowDecreeDetails,
}) => {

    const [activeTaxTab, setActiveTaxTab] = React.useState('head'); // 'head', 'resource', 'business'
    const [activeSection, setActiveSection] = React.useState('government'); // 'government', 'tax', 'officials'

    const headRates = taxPolicies?.headTaxRates || {};
    const resourceRates = taxPolicies?.resourceTaxRates || {};
    const importTariffs = taxPolicies?.importTariffMultipliers || taxPolicies?.resourceTariffMultipliers || {};
    const exportTariffs = taxPolicies?.exportTariffMultipliers || taxPolicies?.resourceTariffMultipliers || {};
    const businessRates = taxPolicies?.businessTaxRates || {};

    const [headDrafts, setHeadDrafts] = React.useState({});
    const [resourceDrafts, setResourceDrafts] = React.useState({});
    const [importTariffDrafts, setImportTariffDrafts] = React.useState({});
    const [exportTariffDrafts, setExportTariffDrafts] = React.useState({});
    const [businessDrafts, setBusinessDrafts] = React.useState({});

    // 获取所有已解锁的阶层
    const unlockedStrataKeys = React.useMemo(() => {
        return Object.keys(STRATA).filter(key => {
            const stratum = STRATA[key];
            if (stratum.unlockEpoch !== undefined && stratum.unlockEpoch > epoch) return false;
            if (stratum.unlockTech && !techsUnlocked.includes(stratum.unlockTech)) return false;
            return true;
        });
    }, [epoch, techsUnlocked]);

    // 筛选出有岗位提供的阶层（用于人头税面板显示）
    const strataToDisplay = React.useMemo(() => {
        return unlockedStrataKeys.filter(key => {
            if (key === 'unemployed') return true;
            const jobSlots = jobsAvailable[key] || 0;
            return jobSlots > 0;
        });
    }, [unlockedStrataKeys, jobsAvailable]);

    // Tax Draft Handlers (Keeping existing logic)
    const handleHeadDraftChange = (key, raw) => setHeadDrafts(prev => ({ ...prev, [key]: raw }));
    const commitHeadDraft = (key) => {
        if (headDrafts[key] === undefined) return;
        const parsed = parseFloat(headDrafts[key]);
        const numeric = Number.isNaN(parsed) ? 1 : parsed;

        // Enforce Limit
        const limit = TAX_LIMITS?.MAX_HEAD_TAX || 10000;
        const clamped = clamp(numeric, -limit, limit);

        onUpdateTaxPolicies(prev => ({ ...prev, headTaxRates: { ...(prev?.headTaxRates), [key]: clamped } }));
        setHeadDrafts(prev => { const next = { ...prev }; delete next[key]; return next; });
    };

    const handleResourceDraftChange = (key, raw) => setResourceDrafts(prev => ({ ...prev, [key]: raw }));
    const commitResourceDraft = (key) => {
        if (resourceDrafts[key] === undefined) return;
        const parsed = parseFloat(resourceDrafts[key]);
        const rateValue = (Number.isNaN(parsed) ? 0 : parsed) / 100;

        // Enforce Limit (rateValue is decimals, limit is percentage rate like 5.0 for 500%)
        const limit = TAX_LIMITS?.MAX_RESOURCE_TAX || 5.0;
        const clamped = clamp(rateValue, -limit, limit);

        onUpdateTaxPolicies(prev => ({ ...prev, resourceTaxRates: { ...(prev?.resourceTaxRates), [key]: clamped } }));
        setResourceDrafts(prev => { const next = { ...prev }; delete next[key]; return next; });
    };

    const handleImportTariffDraftChange = (key, raw) => setImportTariffDrafts(prev => ({ ...prev, [key]: raw }));
    const commitImportTariffDraft = (key) => {
        if (importTariffDrafts[key] === undefined) return;
        const parsed = parseFloat(importTariffDrafts[key]);
        const rateValue = (Number.isNaN(parsed) ? 0 : parsed) / 100; // 百分数转小数
        onUpdateTaxPolicies?.(prev => ({ ...prev, importTariffMultipliers: { ...(prev?.importTariffMultipliers), [key]: rateValue } }));
        setImportTariffDrafts(prev => { const next = { ...prev }; delete next[key]; return next; });
    };

    const handleExportTariffDraftChange = (key, raw) => setExportTariffDrafts(prev => ({ ...prev, [key]: raw }));
    const commitExportTariffDraft = (key) => {
        if (exportTariffDrafts[key] === undefined) return;
        const parsed = parseFloat(exportTariffDrafts[key]);
        const rateValue = (Number.isNaN(parsed) ? 0 : parsed) / 100; // 百分数转小数
        onUpdateTaxPolicies?.(prev => ({ ...prev, exportTariffMultipliers: { ...(prev?.exportTariffMultipliers), [key]: rateValue } }));
        setExportTariffDrafts(prev => { const next = { ...prev }; delete next[key]; return next; });
    };

    const handleBusinessDraftChange = (key, raw) => setBusinessDrafts(prev => ({ ...prev, [key]: raw }));
    const commitBusinessDraft = (key) => {
        if (businessDrafts[key] === undefined) return;
        const parsed = parseFloat(businessDrafts[key]);
        const numeric = Number.isNaN(parsed) ? 1 : parsed;

        // Enforce Limit
        const limit = TAX_LIMITS?.MAX_BUSINESS_TAX || 10000;
        const clamped = clamp(numeric, -limit, limit);

        onUpdateTaxPolicies(prev => ({ ...prev, businessTaxRates: { ...(prev?.businessTaxRates), [key]: clamped } }));
        setBusinessDrafts(prev => { const next = { ...prev }; delete next[key]; return next; });
    };

    // Toggle Sign Handlers
    const toggleBusinessSign = (key, currentValue) => {
        const parsed = parseFloat(currentValue);
        const newValue = isNaN(parsed) ? -1 : -parsed;
        onUpdateTaxPolicies(prev => ({ ...prev, businessTaxRates: { ...(prev?.businessTaxRates), [key]: newValue } }));
        setBusinessDrafts(prev => { const next = { ...prev }; delete next[key]; return next; });
    };
    const toggleImportTariffSign = (key, currentValue) => {
        const parsed = parseFloat(currentValue);
        const newValue = isNaN(parsed) ? -0.1 : -(parsed / 100); // 输入是百分数，转换后翻转符号
        onUpdateTaxPolicies?.(prev => ({ ...prev, importTariffMultipliers: { ...(prev?.importTariffMultipliers), [key]: newValue } }));
        setImportTariffDrafts(prev => { const next = { ...prev }; delete next[key]; return next; });
    };
    const toggleExportTariffSign = (key, currentValue) => {
        const parsed = parseFloat(currentValue);
        const newValue = isNaN(parsed) ? -0.1 : -(parsed / 100); // 输入是百分数，转换后翻转符号
        onUpdateTaxPolicies?.(prev => ({ ...prev, exportTariffMultipliers: { ...(prev?.exportTariffMultipliers), [key]: newValue } }));
        setExportTariffDrafts(prev => { const next = { ...prev }; delete next[key]; return next; });
    };

    // Unlocked Resources Logic
    const unlockedResourceKeys = React.useMemo(() => {
        return Object.keys(RESOURCES).filter(key => {
            const resource = RESOURCES[key];
            if (resource.type && (resource.type === 'virtual' || resource.type === 'currency')) return false;
            return isResourceUnlocked(key, epoch, techsUnlocked);
        });
    }, [epoch, techsUnlocked]);

    const orderedResourceKeys = React.useMemo(() => {
        if (unlockedResourceKeys.length === 0) return [];
        const ordered = [];
        Object.values(RESOURCE_GROUPS).forEach(group => {
            group.keys.forEach(key => {
                if (unlockedResourceKeys.includes(key)) ordered.push(key);
            });
        });
        unlockedResourceKeys.forEach(key => {
            if (!ordered.includes(key)) ordered.push(key);
        });
        return ordered;
    }, [unlockedResourceKeys]);

    const taxableResources = orderedResourceKeys
        .map(key => [key, RESOURCES[key]])
        .filter(([, info]) => info && (!info.type || (info.type !== 'virtual' && info.type !== 'currency')));

    // Buildings Logic
    const builtBuildings = React.useMemo(() => {
        return BUILDINGS.filter(b => (buildings[b.id] || 0) > 0).sort((a, b) => {
            const countA = buildings[a.id] || 0;
            const countB = buildings[b.id] || 0;
            if (a.cat !== b.cat) return a.cat.localeCompare(b.cat);
            return countB - countA;
        });
    }, [buildings]);

    const buildingsByCategory = React.useMemo(() => {
        const categories = {
            gather: { name: '采集建筑', buildings: [] },
            industry: { name: '工业建筑', buildings: [] },
            civic: { name: '市政建筑', buildings: [] },
        };
        builtBuildings.forEach(building => {
            const cat = building.cat || 'civic';
            const isHousingBuilding = building.cat === 'civic' && !building.owner && building.output?.maxPop > 0;
            const isMilitaryBuilding = building.cat === 'military';
            if (isHousingBuilding || isMilitaryBuilding) return;

            if (categories[cat]) categories[cat].buildings.push(building);
        });
        return categories;
    }, [builtBuildings]);

    // Render Functions (Copied/Reused)
    const renderStratumCard = (key) => {
        const stratumInfo = STRATA[key] || {};
        const base = stratumInfo.headTaxBase ?? 0.01;
        const multiplier = headRates[key] ?? 1;
        const finalRate = multiplier * base;
        const population = popStructure[key] || 0;
        const hasPopulation = population > 0;
        const isSubsidy = finalRate < 0;
        const isTax = finalRate > 0;

        return (
            <div key={key} className={`bg-gray-900/40 p-1.5 rounded-md border text-xs flex flex-col gap-1 ${hasPopulation ? (isSubsidy ? 'border-green-700/60' : isTax ? 'border-yellow-700/60' : 'border-gray-700/60') : 'border-gray-800 opacity-60'}`}>
                <div className="flex items-center gap-1">
                    <Icon name={stratumInfo.icon || 'User'} size={14} className="text-gray-400" />
                    <span className="font-semibold text-gray-300 flex-grow">{stratumInfo.name || key}</span>
                    <span className="text-gray-500 text-[10px] font-mono">{formatNumberShortCN(Math.round(population), { decimals: 0 })} 人</span>
                </div>
                <div className="flex items-center justify-center gap-0.5">
                    {isSubsidy ? (
                        <><Icon name="TrendingDown" size={12} className="text-green-400" /><span className="font-mono text-green-300 whitespace-nowrap text-[11px]">补贴 {Math.abs(finalRate).toFixed(3)}/人</span></>
                    ) : isTax ? (
                        <><Icon name="TrendingUp" size={12} className="text-yellow-400" /><span className="font-mono text-yellow-300 whitespace-nowrap text-[11px]">{finalRate.toFixed(3)}/人</span></>
                    ) : (<span className="font-mono text-gray-500 whitespace-nowrap text-[11px]">无税收</span>)}
                </div>
                <div className="flex items-center gap-1">
                    <button type="button" onClick={() => {
                        const currentValue = parseFloat(headDrafts[key] ?? headRates[key] ?? 1);
                        const newValue = isNaN(currentValue) ? -1 : -currentValue;
                        handleHeadDraftChange(key, String(newValue));
                        onUpdateTaxPolicies(prev => ({ ...prev, headTaxRates: { ...(prev?.headTaxRates || {}), [key]: newValue } }));
                        setHeadDrafts(prev => { const next = { ...prev }; delete next[key]; return next; });
                    }} className="btn-compact flex-shrink-0 w-5 h-5 bg-gray-700 hover:bg-gray-600 border border-gray-500 rounded text-[9px] font-bold text-gray-300 flex items-center justify-center transition-colors">±</button>
                    <input type="text" inputMode="decimal" step="0.05" value={headDrafts[key] ?? (headRates[key] ?? 1)} onChange={(e) => handleHeadDraftChange(key, e.target.value)} onBlur={() => commitHeadDraft(key)} onKeyDown={(e) => { if (e.key === 'Enter') { commitHeadDraft(key); e.target.blur(); } }} className="flex-grow min-w-0 bg-gray-900/70 border border-gray-600 text-[11px] text-gray-200 rounded px-1 py-0 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-center" placeholder="系数" />
                </div>
            </div>
        );
    };

    const renderResourceGroup = (group, resources) => {
        const groupResources = resources.filter(([key]) => group.keys.includes(key));
        if (groupResources.length === 0) return null;
        return (
            <div key={group.name} className="mb-4">
                <h5 className="text-xs font-semibold text-gray-400 mb-2">{group.name}</h5>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-2">
                    {groupResources.map(([key, info]) => (
                        <ResourceTaxCard
                            key={key}
                            resourceKey={key}
                            info={info}
                            rate={resourceRates[key]}
                            hasSupply={(market?.supply?.[key] || 0) > 0}
                            draftRate={resourceDrafts[key]}
                            importTariffMultiplier={importTariffs[key] ?? 0}
                            exportTariffMultiplier={exportTariffs[key] ?? 0}
                            draftImportTariff={importTariffDrafts[key]}
                            draftExportTariff={exportTariffDrafts[key]}
                            onDraftChange={handleResourceDraftChange}
                            onCommit={commitResourceDraft}
                            onImportTariffDraftChange={handleImportTariffDraftChange}
                            onExportTariffDraftChange={handleExportTariffDraftChange}
                            onImportTariffCommit={commitImportTariffDraft}
                            onExportTariffCommit={commitExportTariffDraft}
                            onImportTariffToggleSign={toggleImportTariffSign}
                            onExportTariffToggleSign={toggleExportTariffSign}
                        />
                    ))}
                </div>
            </div>
        );
    };

    // Group keys for filtering leftovers
    const allGroupKeys = new Set(Object.values(STRATA_GROUPS).flatMap(g => g.keys));

    return (
        <div className="space-y-4">
            {/* Navigation Tabs */}
            <div className="flex items-center gap-2 text-sm rounded-full glass-ancient border border-ancient-gold/30 p-1 shadow-metal-sm">
                <button
                    className={`w-1/3 py-2 rounded-full border-2 transition-all ${activeSection === 'government'
                        ? 'bg-ancient-gold/20 border-ancient-gold/70 text-ancient-parchment shadow-gold-metal'
                        : 'border-transparent text-ancient-stone hover:text-ancient-parchment'}`}
                    onClick={() => setActiveSection('government')}
                >
                    <span className="flex items-center justify-center gap-1.5 font-bold">
                        <Icon name="Landmark" size={14} />
                        政府
                    </span>
                </button>
                <button
                    className={`w-1/3 py-2 rounded-full border-2 transition-all ${activeSection === 'tax'
                        ? 'bg-amber-900/30 border-ancient-gold/60 text-amber-100 shadow-metal-sm'
                        : 'border-transparent text-ancient-stone hover:text-ancient-parchment'}`}
                    onClick={() => setActiveSection('tax')}
                >
                    <span className="flex items-center justify-center gap-1.5 font-bold">
                        <Icon name="DollarSign" size={14} />
                        税收
                    </span>
                </button>
                <button
                    className={`w-1/3 py-2 rounded-full border-2 transition-all ${activeSection === 'officials'
                        ? 'bg-purple-900/40 border-ancient-gold/60 text-purple-100 shadow-metal-sm'
                        : 'border-transparent text-ancient-stone hover:text-ancient-parchment'} ${epoch < 1 ? 'opacity-50' : ''}`}
                    onClick={() => setActiveSection('officials')}
                >
                    <span className="flex items-center justify-center gap-1.5 font-bold">
                        {epoch < 1 && <Icon name="Lock" size={12} className="text-gray-500" />}
                        <Icon name="Users" size={14} />
                        官员
                    </span>
                </button>
            </div>

            {/* Panels */}
            {activeSection === 'government' && onUpdateCoalition && (
                <CoalitionPanel
                    rulingCoalition={rulingCoalition}
                    onUpdateCoalition={onUpdateCoalition}
                    classInfluence={classInfluence}
                    totalInfluence={totalInfluence}
                    legitimacy={legitimacy}
                    popStructure={popStructure}
                    classApproval={classApproval}
                    silver={silver}
                    onSpendSilver={onSpendSilver}
                />
            )}

            {activeSection === 'tax' && onUpdateTaxPolicies && (
                <div className="glass-ancient p-4 rounded-xl border border-ancient-gold/30">
                    <h3 className="text-sm font-bold mb-3 flex items-center gap-2 text-gray-300 font-decorative">
                        <Icon name="DollarSign" size={16} className="text-yellow-400" />
                        税收政策调节
                    </h3>
                    <div className="flex flex-nowrap gap-2 mb-4 border-b border-gray-700 overflow-x-auto scrollbar-thin">
                        <button onClick={() => setActiveTaxTab('head')} className={`flex-1 min-w-[90px] px-4 py-2 text-sm font-semibold transition-all ${activeTaxTab === 'head' ? 'text-yellow-300 border-b-2 border-yellow-400' : 'text-gray-400 hover:text-gray-300'}`}><div className="flex items-center gap-2"><Icon name="Users" size={14} />人头税</div></button>
                        <button onClick={() => setActiveTaxTab('resource')} className={`flex-1 min-w-[90px] px-4 py-2 text-sm font-semibold transition-all ${activeTaxTab === 'resource' ? 'text-blue-300 border-b-2 border-blue-400' : 'text-gray-400 hover:text-gray-300'}`}><div className="flex items-center gap-2"><Icon name="Package" size={14} />交易税</div></button>
                        <button onClick={() => setActiveTaxTab('business')} className={`flex-1 min-w-[90px] px-4 py-2 text-sm font-semibold transition-all ${activeTaxTab === 'business' ? 'text-green-300 border-b-2 border-green-400' : 'text-gray-400 hover:text-gray-300'}`}><div className="flex items-center gap-2"><Icon name="Building" size={14} />营业税</div></button>
                    </div>

                    {activeTaxTab === 'head' && (
                        <div className="space-y-4">
                            <div className="bg-blue-900/20 border border-blue-500/30 p-3 rounded-lg text-xs text-blue-100">
                                <p className="flex items-center gap-2 mb-1"><Icon name="Info" size={12} className="text-blue-400" /><span className="font-semibold">人头税说明</span></p>
                                <p>对各阶层人口征收的税收。税率系数越高，税收越多，但可能影响阶层满意度。</p>
                            </div>
                            {Object.entries(STRATA_GROUPS).map(([groupKey, groupInfo]) => {
                                const groupStrata = strataToDisplay.filter(key => groupInfo.keys.includes(key));
                                if (groupStrata.length === 0) return null;
                                return (
                                    <div key={groupKey}>
                                        <h4 className="text-xs font-semibold text-gray-400 mb-2">{groupInfo.name}</h4>
                                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
                                            {groupStrata.map(key => renderStratumCard(key))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {activeTaxTab === 'resource' && (
                        <div className="space-y-4">
                            <div className="bg-blue-900/20 border border-blue-500/30 p-3 rounded-lg text-xs text-blue-100">
                                <p className="flex items-center gap-2 mb-1"><Icon name="Info" size={12} className="text-blue-400" /><span className="font-semibold">交易税说明</span></p>
                                <p>对市场交易的资源征收的税收。税率为正时征税，为负时作为补贴。仅对有市场供应的资源生效。</p>
                            </div>
                            {Object.values(RESOURCE_GROUPS).map(group => renderResourceGroup(group, taxableResources))}
                            {taxableResources.filter(([key]) => !ALL_GROUPED_RESOURCES.has(key)).length > 0 && (
                                <div>
                                    <h5 className="text-xs font-semibold text-gray-400 mb-2">其他资源</h5>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-2">
                                        {taxableResources.filter(([key]) => !ALL_GROUPED_RESOURCES.has(key)).map(([key, info]) => (
                                            <ResourceTaxCard
                                                key={key}
                                                resourceKey={key}
                                                info={info}
                                                rate={resourceRates[key]}
                                                hasSupply={(market?.supply?.[key] || 0) > 0}
                                                draftRate={resourceDrafts[key]}
                                                importTariffMultiplier={importTariffs[key] ?? 0}
                                                exportTariffMultiplier={exportTariffs[key] ?? 0}
                                                draftImportTariff={importTariffDrafts[key]}
                                                draftExportTariff={exportTariffDrafts[key]}
                                                onDraftChange={handleResourceDraftChange}
                                                onCommit={commitResourceDraft}
                                                onImportTariffDraftChange={handleImportTariffDraftChange}
                                                onExportTariffDraftChange={handleExportTariffDraftChange}
                                                onImportTariffCommit={commitImportTariffDraft}
                                                onExportTariffCommit={commitExportTariffDraft}
                                                onImportTariffToggleSign={toggleImportTariffSign}
                                                onExportTariffToggleSign={toggleExportTariffSign}
                                            />
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {activeTaxTab === 'business' && (
                        <div className="space-y-4">
                            <div className="bg-blue-900/20 border border-blue-500/30 p-3 rounded-lg text-xs text-blue-100">
                                <p className="flex items-center gap-2 mb-1"><Icon name="Info" size={12} className="text-blue-400" /><span className="font-semibold">营业税说明</span></p>
                                <p>对建筑每次产出征收的税收。实际税额 = 基准税额 × 税率系数 × 生产效率。生产加成越高，税收越多。负数系数代表政府补贴。</p>
                            </div>
                            {Object.entries(buildingsByCategory).map(([catKey, catInfo]) => {
                                if (catInfo.buildings.length === 0) return null;
                                return (
                                    <div key={catKey}>
                                        <h4 className="text-xs font-semibold text-gray-400 mb-2">{catInfo.name}</h4>
                                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
                                            {catInfo.buildings.map(building => (
                                                <BusinessTaxCard
                                                    key={building.id}
                                                    building={building}
                                                    multiplier={businessRates[building.id]}
                                                    buildingCount={buildings[building.id] || 0}
                                                    draftMultiplier={businessDrafts[building.id]}
                                                    onDraftChange={handleBusinessDraftChange}
                                                    onCommit={commitBusinessDraft}
                                                    onToggleSign={toggleBusinessSign}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* Official Panel (Replaces Decrees) */}
            {activeSection === 'officials' && (
                epoch >= 1 ? (
                    <OfficialsPanel
                        officials={officials}
                        candidates={candidates}
                        capacity={capacity}
                        jobCapacity={jobCapacity} // [NEW]
                        maxCapacity={maxCapacity} // [NEW]
                        lastSelectionDay={lastSelectionDay}
                        currentTick={currentTick}
                        resources={resources}
                        onTriggerSelection={onTriggerSelection}
                        onHire={onHire}
                        onFire={onFire}
                        onDispose={onDispose}
                        onUpdateOfficialSalary={onUpdateOfficialSalary}
                        onUpdateOfficialName={onUpdateOfficialName}
                        ministerAssignments={ministerAssignments}
                        ministerAutoExpansion={ministerAutoExpansion}
                        lastMinisterExpansionDay={lastMinisterExpansionDay}
                        onAssignMinister={onAssignMinister}
                        onClearMinister={onClearMinister}
                        onToggleMinisterAutoExpansion={onToggleMinisterAutoExpansion}
                        // Cabinet Synergy Props
                        epoch={epoch}
                        popStructure={popStructure}
                        classWealth={classWealth}
                        buildingCounts={buildings}
                        quotaTargets={quotaTargets}
                        expansionSettings={expansionSettings}
                        activeDecrees={activeDecrees}
                        decreeCooldowns={decreeCooldowns}
                        onUpdateQuotas={onUpdateQuotas}
                        onUpdateExpansionSettings={onUpdateExpansionSettings}
                        onEnactDecree={onEnactDecree}
                        stanceContext={stanceContext} // [NEW]
                        prices={market?.prices || {}}  // [NEW] 市场价格用于自由市场面板
                        market={market} // [NEW] 传递完整市场数据（含 wages）
                        taxPolicies={taxPolicies} // [NEW] 传递税收政策用于盈利计算
                        jobFill={jobFill}
                        buildingFinancialData={buildingFinancialData}
                        // [NEW] 价格管制相关
                        priceControls={priceControls}
                        onUpdatePriceControls={onUpdatePriceControls}
                        // [NEW] 忠诚度系统 UI 相关
                        stability={stability}
                        officialsPaid={officialsPaid}
                        // [NEW] 政令相关
                        decrees={decrees}
                        onToggleDecree={onToggleDecree}
                        onShowDecreeDetails={onShowDecreeDetails}
                    />
                ) : (
                    <div className="glass-ancient p-6 rounded-xl border border-ancient-gold/30 text-center">
                        <Icon name="Lock" size={48} className="text-gray-500 mx-auto mb-4" />
                        <h3 className="text-lg font-bold text-gray-400 mb-2">官员系统未解锁</h3>
                        <p className="text-gray-500 text-sm">
                            进入<span className="text-orange-400 font-semibold">青铜时代</span>后，方可启用官员制度。
                        </p>
                    </div>
                )
            )}
        </div>
    );
};

export const PoliticsTab = memo(PoliticsTabComponent);
