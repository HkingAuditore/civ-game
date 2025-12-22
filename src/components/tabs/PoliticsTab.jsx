// 政令标签页组件
// 显示可用政令和切换功能

import React from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '../common/UIComponents';
import { STRATA, RESOURCES, EPOCHS, BUILDINGS } from '../../config';
import { isResourceUnlocked } from '../../utils/resources';
import { CoalitionPanel } from '../panels/CoalitionPanel';

// 判断是否为供需修正相关的效果文本
const isSupplyDemandEffect = (text) => {
    const supplyDemandPatterns = [
        /需求\s*[+-]?\d+%/,
        /供应\s*[+-]?\d+%/,
        /消费\s*[+-]?\d+%/,
    ];
    return supplyDemandPatterns.some(pattern => pattern.test(text));
};

// 过滤掉供需修正相关的效果
const filterSupplyDemandEffects = (effects) => {
    if (!effects || !Array.isArray(effects)) return [];
    return effects.filter(effect => !isSupplyDemandEffect(effect));
};

/**
 * 政令悬浮提示框 (使用 Portal)
 */
const DecreeTooltip = ({ decree, anchorRect }) => {
    // 条件判断放在最前面
    if (!decree || !anchorRect) return null;

    // 直接计算位置，提示框固定宽度为 320px (w-80)
    const tooltipWidth = 320;
    const tooltipHeight = 200; // 估计高度

    let top = anchorRect.top;
    let left = anchorRect.right + 8; // 默认在右侧

    // 如果右侧空间不足，显示在左侧
    if (left + tooltipWidth > window.innerWidth) {
        left = anchorRect.left - tooltipWidth - 8;
    }

    // 确保不超出屏幕顶部和底部
    if (top < 0) top = 0;
    if (top + tooltipHeight > window.innerHeight) {
        top = window.innerHeight - tooltipHeight;
    }

    return createPortal(
        <div
            className="fixed w-80 bg-gray-800 border border-gray-600 rounded-lg shadow-2xl p-3 z-[9999] pointer-events-none animate-fade-in-fast"
            style={{ top: `${top}px`, left: `${left}px` }}
        >
            <h4 className="text-sm font-bold text-white mb-1 flex items-center gap-2 font-decorative">
                {decree.name}
                {decree.active && (
                    <span className="px-2 py-0.5 bg-green-600 text-white text-xs rounded">
                        生效中
                    </span>
                )}
            </h4>
            <p className="text-xs text-gray-400 mb-2">{decree.desc}</p>

            {/* 正面效果（过滤供需修正相关内容） */}
            {(() => {
                const hasSupplyDemandMod = decree.modifiers && (
                    decree.modifiers.resourceDemandMod ||
                    decree.modifiers.stratumDemandMod ||
                    decree.modifiers.resourceSupplyMod
                );
                const filteredEffects = hasSupplyDemandMod
                    ? filterSupplyDemandEffects(decree.effects)
                    : decree.effects;
                return filteredEffects && filteredEffects.length > 0 && (
                    <div className="bg-green-900/30 rounded px-2 py-1.5 mb-2">
                        <div className="text-[10px] text-gray-400 mb-1">正面效果</div>
                        <div className="space-y-1">
                            {filteredEffects.map((effect, idx) => (
                                <div key={idx} className="flex items-center gap-1 text-xs">
                                    <Icon name="Plus" size={12} className="text-green-400" />
                                    <span className="text-green-300">{effect}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                );
            })()}

            {/* 负面效果（过滤供需修正相关内容） */}
            {(() => {
                const hasSupplyDemandMod = decree.modifiers && (
                    decree.modifiers.resourceDemandMod ||
                    decree.modifiers.stratumDemandMod ||
                    decree.modifiers.resourceSupplyMod
                );
                const filteredDrawbacks = hasSupplyDemandMod
                    ? filterSupplyDemandEffects(decree.drawbacks)
                    : decree.drawbacks;
                return filteredDrawbacks && filteredDrawbacks.length > 0 && (
                    <div className="bg-red-900/30 rounded px-2 py-1.5">
                        <div className="text-[10px] text-gray-400 mb-1">负面效果</div>
                        <div className="space-y-1">
                            {filteredDrawbacks.map((drawback, idx) => (
                                <div key={idx} className="flex items-center gap-1 text-xs">
                                    <Icon name="Minus" size={12} className="text-red-400" />
                                    <span className="text-red-300">{drawback}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                );
            })()}

            {/* 供需修正效果 */}
            {decree.modifiers && (decree.modifiers.resourceDemandMod || decree.modifiers.stratumDemandMod || decree.modifiers.resourceSupplyMod) && (
                <div className="bg-blue-900/30 rounded px-2 py-1.5 mt-2">
                    <div className="text-[10px] text-gray-400 mb-1">供需修正</div>
                    <div className="space-y-1.5">
                        {/* 资源需求修正 */}
                        {decree.modifiers.resourceDemandMod && Object.keys(decree.modifiers.resourceDemandMod).length > 0 && (
                            <div className="flex flex-wrap gap-1">
                                {Object.entries(decree.modifiers.resourceDemandMod).map(([resKey, value]) => {
                                    const percent = Math.round(value * 100);
                                    const displayPercent = percent > 0 ? `+${percent}%` : `${percent}%`;
                                    return (
                                        <span
                                            key={resKey}
                                            className={`text-[10px] px-1 py-0.5 rounded ${value > 0 ? 'bg-orange-900/40 text-orange-300' : 'bg-cyan-900/40 text-cyan-300'
                                                }`}
                                        >
                                            {RESOURCES[resKey]?.name || resKey}需求 {displayPercent}
                                        </span>
                                    );
                                })}
                            </div>
                        )}

                        {/* 资源供应修正 */}
                        {decree.modifiers.resourceSupplyMod && Object.keys(decree.modifiers.resourceSupplyMod).length > 0 && (
                            <div className="flex flex-wrap gap-1">
                                {Object.entries(decree.modifiers.resourceSupplyMod).map(([resKey, value]) => {
                                    const percent = Math.round(value * 100);
                                    const displayPercent = percent > 0 ? `+${percent}%` : `${percent}%`;
                                    return (
                                        <span
                                            key={resKey}
                                            className={`text-[10px] px-1 py-0.5 rounded ${value > 0 ? 'bg-green-900/40 text-green-300' : 'bg-red-900/40 text-red-300'
                                                }`}
                                        >
                                            {RESOURCES[resKey]?.name || resKey}供应 {displayPercent}
                                        </span>
                                    );
                                })}
                            </div>
                        )}

                        {/* 阶层需求修正 */}
                        {decree.modifiers.stratumDemandMod && Object.keys(decree.modifiers.stratumDemandMod).length > 0 && (
                            <div className="flex flex-wrap gap-1">
                                {Object.entries(decree.modifiers.stratumDemandMod).map(([stratumKey, value]) => {
                                    const percent = Math.round(value * 100);
                                    const displayPercent = percent > 0 ? `+${percent}%` : `${percent}%`;
                                    return (
                                        <span
                                            key={stratumKey}
                                            className={`text-[10px] px-1 py-0.5 rounded ${value > 0 ? 'bg-purple-900/40 text-purple-300' : 'bg-teal-900/40 text-teal-300'
                                                }`}
                                        >
                                            {STRATA[stratumKey]?.name || stratumKey}消费 {displayPercent}
                                        </span>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>,
        document.body
    );
};

// 定义阶层分组，用于UI显示
const STRATA_GROUPS = {
    upper: {
        name: '上流阶级',
        keys: ['merchant', 'official', 'landowner', 'capitalist', 'knight', 'engineer'],
    },
    middle: {
        name: '中产阶级',
        keys: ['worker', 'artisan', 'miner', 'soldier', 'cleric', 'scribe', 'navigator'],
    },
    lower: {
        name: '底层阶级',
        keys: ['unemployed', 'peasant', 'serf', 'lumberjack', 'slave'],
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
}) => {
    // 当税率为负时，作为"交易补贴"运作
    const currentRate = rate ?? 0;
    const isSubsidy = currentRate < 0;
    const displayValue = Math.abs(currentRate * 100).toFixed(0);
    const valueColor = isSubsidy ? 'text-green-300' : 'text-blue-300';
    const sliderColor = isSubsidy ? 'accent-green-500' : 'accent-blue-500';
    const currentImportTariff = Number.isFinite(importTariffMultiplier) ? importTariffMultiplier : 1;
    const currentExportTariff = Number.isFinite(exportTariffMultiplier) ? exportTariffMultiplier : 1;

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
                        // 触发提交
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
                        <span className="text-gray-200 font-mono text-xs">{currentImportTariff.toFixed(2)}×</span>
                    </div>
                    <input
                        type="text"
                        inputMode="decimal"
                        step="0.1"
                        value={draftImportTariff ?? currentImportTariff.toFixed(2)}
                        onChange={(e) => onImportTariffDraftChange(resourceKey, e.target.value)}
                        onBlur={() => onImportTariffCommit(resourceKey)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                onImportTariffCommit(resourceKey);
                                e.target.blur();
                            }
                        }}
                        className="w-full bg-gray-900/70 border border-gray-600 text-[11px] text-gray-200 rounded px-1.5 py-0.5 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-center"
                        placeholder="进口倍率"
                    />
                </div>
                {/* 出口关税 */}
                <div>
                    <div className="flex items-center justify-between text-[10px] text-gray-400 mb-0.5">
                        <span className="flex items-center gap-0.5">
                            <Icon name="ArrowUpRight" size={10} className="text-green-400" />
                            出口关税
                        </span>
                        <span className="text-gray-200 font-mono text-xs">{currentExportTariff.toFixed(2)}×</span>
                    </div>
                    <input
                        type="text"
                        inputMode="decimal"
                        step="0.1"
                        value={draftExportTariff ?? currentExportTariff.toFixed(2)}
                        onChange={(e) => onExportTariffDraftChange(resourceKey, e.target.value)}
                        onBlur={() => onExportTariffCommit(resourceKey)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                onExportTariffCommit(resourceKey);
                                e.target.blur();
                            }
                        }}
                        className="w-full bg-gray-900/70 border border-gray-600 text-[11px] text-gray-200 rounded px-1.5 py-0.5 focus:ring-1 focus:ring-green-500 focus:border-green-500 text-center"
                        placeholder="出口倍率"
                    />
                </div>
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
 * 政令标签页组件
 * 显示所有政令及其效果
 * @param {Array} decrees - 政令数组
 * @param {Function} onToggle - 切换政令回调
 * @param {Object} taxPolicies - 税收策略
 * @param {Function} onUpdateTaxPolicies - 更新税收策略回调
 * @param {Object} popStructure - 当前人口结构
 * @param {Object} buildings - 当前建筑数量
 * @param {number} epoch - 当前时代编号
 */
export const PoliticsTab = ({
    decrees,
    onToggle,
    taxPolicies,
    onUpdateTaxPolicies,
    popStructure = {},
    buildings = {},
    market = {},
    epoch = 0,
    techsUnlocked = [],
    onShowDecreeDetails,
    jobFill = {},
    jobsAvailable = {},
    // 执政联盟 props
    rulingCoalition = [],
    onUpdateCoalition,
    classInfluence = {},
    totalInfluence = 0,
    legitimacy = 0,
    classApproval = {}, // 新增：各阶层满意度
}) => {
    // 按类别分组政令
    const categories = {
        economy: { name: '经济政策', icon: 'Coins', color: 'text-yellow-400' },
        military: { name: '军事政策', icon: 'Shield', color: 'text-red-400' },
        culture: { name: '文化政策', icon: 'Book', color: 'text-purple-400' },
        social: { name: '社会政策', icon: 'Users', color: 'text-blue-400' },
    };

    const unlockedDecrees = (decrees || []).filter(d => (d.unlockEpoch ?? 0) <= epoch);
    const lockedDecrees = (decrees || []).filter(d => (d.unlockEpoch ?? 0) > epoch);
    const nextUnlockEpoch = lockedDecrees.length > 0
        ? lockedDecrees.reduce((min, d) => {
            const value = d.unlockEpoch ?? Infinity;
            return value < min ? value : min;
        }, Infinity)
        : null;
    const nextUnlockEpochName = Number.isFinite(nextUnlockEpoch)
        ? (EPOCHS[nextUnlockEpoch]?.name || `第 ${nextUnlockEpoch + 1} 个时代`)
        : null;
    const unlockedActiveCount = unlockedDecrees.filter(d => d.active).length;
    const unlockedInactiveCount = unlockedDecrees.length - unlockedActiveCount;
    const policyEfficiency = unlockedDecrees.length > 0
        ? ((unlockedActiveCount / unlockedDecrees.length) * 100).toFixed(0)
        : '0';

    const decreesByCategory = unlockedDecrees.reduce((acc, decree) => {
        const category = decree.category || 'social';
        if (!acc[category]) acc[category] = [];
        acc[category].push(decree);
        return acc;
    }, {});

    const headRates = taxPolicies?.headTaxRates || {};
    const resourceRates = taxPolicies?.resourceTaxRates || {};
    // 进口/出口关税倍率（向后兼容旧的resourceTariffMultipliers）
    const importTariffs = taxPolicies?.importTariffMultipliers || taxPolicies?.resourceTariffMultipliers || {};
    const exportTariffs = taxPolicies?.exportTariffMultipliers || taxPolicies?.resourceTariffMultipliers || {};
    const businessRates = taxPolicies?.businessTaxRates || {};
    const [headDrafts, setHeadDrafts] = React.useState({});
    const [resourceDrafts, setResourceDrafts] = React.useState({});
    const [importTariffDrafts, setImportTariffDrafts] = React.useState({});
    const [exportTariffDrafts, setExportTariffDrafts] = React.useState({});
    const [businessDrafts, setBusinessDrafts] = React.useState({});
    const [activeTaxTab, setActiveTaxTab] = React.useState('head'); // 'head', 'resource', 'business'

    // 悬浮提示状态（用于 Portal 方式显示）
    const [hoveredDecree, setHoveredDecree] = React.useState(null);
    const [decreeAnchorRect, setDecreeAnchorRect] = React.useState(null);

    // 获取所有已解锁的阶层
    const unlockedStrataKeys = React.useMemo(() => {
        return Object.keys(STRATA).filter(key => {
            const stratum = STRATA[key];
            // 检查阶层是否在当前时代已解锁（如果没有明确解锁时代，默认为已解锁）
            if (stratum.unlockEpoch !== undefined && stratum.unlockEpoch > epoch) {
                return false;
            }
            // 检查科技要求
            if (stratum.unlockTech && !techsUnlocked.includes(stratum.unlockTech)) {
                return false;
            }
            return true;
        });
    }, [epoch, techsUnlocked]);

    // 筛选出有岗位提供的阶层（用于人头税面板显示）
    const strataToDisplay = React.useMemo(() => {
        return unlockedStrataKeys.filter(key => {
            // 失业者总是显示
            if (key === 'unemployed') {
                return true;
            }
            // 只显示有岗位供应的阶层（即建筑提供了该阶层的岗位）
            const jobSlots = jobsAvailable[key] || 0;
            return jobSlots > 0;
        });
    }, [unlockedStrataKeys, jobsAvailable]);

    // 处理人头税临时输入变化的逻辑
    const handleHeadDraftChange = (key, raw) => {
        setHeadDrafts(prev => ({ ...prev, [key]: raw }));
    };

    // 提交人头税修改的逻辑
    const commitHeadDraft = (key) => {
        if (headDrafts[key] === undefined) return;
        const parsed = parseFloat(headDrafts[key]);
        const numeric = Number.isNaN(parsed) ? 1 : parsed; // 如果输入无效，重置为1
        onUpdateTaxPolicies(prev => ({
            ...prev,
            headTaxRates: {
                ...(prev?.headTaxRates || {}),
                [key]: numeric,
            },
        }));
        setHeadDrafts(prev => {
            const next = { ...prev };
            delete next[key];
            return next;
        });
    };

    const handleResourceDraftChange = (key, raw) => {
        setResourceDrafts(prev => ({ ...prev, [key]: raw }));
    };

    const handleImportTariffDraftChange = (key, raw) => {
        setImportTariffDrafts(prev => ({ ...prev, [key]: raw }));
    };

    const handleExportTariffDraftChange = (key, raw) => {
        setExportTariffDrafts(prev => ({ ...prev, [key]: raw }));
    };

    const commitResourceDraft = (key) => {
        if (resourceDrafts[key] === undefined) return;
        const parsed = parseFloat(resourceDrafts[key]);
        const numeric = Number.isNaN(parsed) ? 0 : parsed;
        // 将百分比转换为小数（例如：50% -> 0.5）
        const rateValue = numeric / 100;
        onUpdateTaxPolicies(prev => ({
            ...prev,
            resourceTaxRates: {
                ...(prev?.resourceTaxRates || {}),
                [key]: rateValue,
            },
        }));
        setResourceDrafts(prev => {
            const next = { ...prev };
            delete next[key];
            return next;
        });
    };

    const commitImportTariffDraft = (key) => {
        if (importTariffDrafts[key] === undefined) return;
        const parsed = parseFloat(importTariffDrafts[key]);
        const multiplier = Number.isNaN(parsed) ? 1 : Math.max(0, parsed);
        onUpdateTaxPolicies?.(prev => ({
            ...prev,
            importTariffMultipliers: {
                ...(prev?.importTariffMultipliers || {}),
                [key]: multiplier,
            },
        }));
        setImportTariffDrafts(prev => {
            const next = { ...prev };
            delete next[key];
            return next;
        });
    };

    const commitExportTariffDraft = (key) => {
        if (exportTariffDrafts[key] === undefined) return;
        const parsed = parseFloat(exportTariffDrafts[key]);
        const multiplier = Number.isNaN(parsed) ? 1 : Math.max(0, parsed);
        onUpdateTaxPolicies?.(prev => ({
            ...prev,
            exportTariffMultipliers: {
                ...(prev?.exportTariffMultipliers || {}),
                [key]: multiplier,
            },
        }));
        setExportTariffDrafts(prev => {
            const next = { ...prev };
            delete next[key];
            return next;
        });
    };

    const handleBusinessDraftChange = (key, raw) => {
        setBusinessDrafts(prev => ({ ...prev, [key]: raw }));
    };

    const commitBusinessDraft = (key) => {
        if (businessDrafts[key] === undefined) return;
        const parsed = parseFloat(businessDrafts[key]);
        const numeric = Number.isNaN(parsed) ? 1 : parsed;
        onUpdateTaxPolicies(prev => ({
            ...prev,
            businessTaxRates: { // This will now store multipliers
                ...(prev?.businessTaxRates || {}),
                [key]: numeric,
            },
        }));
        setBusinessDrafts(prev => {
            const next = { ...prev };
            delete next[key];
            return next;
        });
    };

    // 切换营业税正负值（用于移动端无法输入负号的情况）
    const toggleBusinessSign = (key, currentValue) => {
        const parsed = parseFloat(currentValue);
        const newValue = isNaN(parsed) ? -1 : -parsed;
        onUpdateTaxPolicies(prev => ({
            ...prev,
            businessTaxRates: {
                ...(prev?.businessTaxRates || {}),
                [key]: newValue,
            },
        }));
        setBusinessDrafts(prev => {
            const next = { ...prev };
            delete next[key];
            return next;
        });
    };

    // 获取所有已解锁的资源
    const unlockedResourceKeys = React.useMemo(() => {
        return Object.keys(RESOURCES).filter(key => {
            const resource = RESOURCES[key];
            // 跳过虚拟资源和货币类型
            if (resource.type && (resource.type === 'virtual' || resource.type === 'currency')) {
                return false;
            }
            // 检查资源是否已解锁
            return isResourceUnlocked(key, epoch, techsUnlocked);
        });
    }, [epoch, techsUnlocked]);

    // 使用固定顺序：按资源组和资源定义顺序排列，避免跳变
    const orderedResourceKeys = React.useMemo(() => {
        if (unlockedResourceKeys.length === 0) return [];

        // 按照资源组的顺序和组内资源的定义顺序排列
        const ordered = [];

        // 先添加分组内的资源
        Object.values(RESOURCE_GROUPS).forEach(group => {
            group.keys.forEach(key => {
                if (unlockedResourceKeys.includes(key)) {
                    ordered.push(key);
                }
            });
        });

        // 再添加未分组的资源
        unlockedResourceKeys.forEach(key => {
            if (!ordered.includes(key)) {
                ordered.push(key);
            }
        });

        return ordered;
    }, [unlockedResourceKeys]);

    const taxableResources = orderedResourceKeys
        .map(key => [key, RESOURCES[key]])
        .filter(([, info]) => info && (!info.type || (info.type !== 'virtual' && info.type !== 'currency')));

    // 获取所有已建造的建筑（按类别分组）
    const builtBuildings = React.useMemo(() => {
        return BUILDINGS.filter(b => {
            const count = buildings[b.id] || 0;
            return count > 0;
        }).sort((a, b) => {
            // 按类别和建筑数量排序
            const countA = buildings[a.id] || 0;
            const countB = buildings[b.id] || 0;
            if (a.cat !== b.cat) {
                return a.cat.localeCompare(b.cat);
            }
            return countB - countA;
        });
    }, [buildings]);

    // 按类别分组建筑
    const buildingsByCategory = React.useMemo(() => {
        const categories = {
            gather: { name: '采集建筑', buildings: [] },
            industry: { name: '工业建筑', buildings: [] },
            civic: { name: '市政建筑', buildings: [] },
        };

        builtBuildings.forEach(building => {
            const cat = building.cat || 'civic';
            if (categories[cat]) {
                categories[cat].buildings.push(building);
            }
        });

        return categories;
    }, [builtBuildings]);

    // 渲染单个阶层的人头税卡片
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
            <div
                key={key}
                className={`bg-gray-900/40 p-1.5 rounded-md border text-xs flex flex-col gap-1 ${hasPopulation ? (isSubsidy ? 'border-green-700/60' : isTax ? 'border-yellow-700/60' : 'border-gray-700/60') : 'border-gray-800 opacity-60'
                    }`}
            >
                {/* 第一行：Icon, 名称, 人口 */}
                <div className="flex items-center gap-1">
                    <Icon name={stratumInfo.icon || 'User'} size={14} className="text-gray-400" />
                    <span className="font-semibold text-gray-300 flex-grow">{stratumInfo.name || key}</span>
                    <span className="text-gray-500 text-[10px] font-mono">{population.toLocaleString()} 人</span>
                </div>

                {/* 第二行：税率显示（带补贴/征税标识） */}
                <div className="flex items-center justify-center gap-0.5">
                    {isSubsidy ? (
                        <>
                            <Icon name="TrendingDown" size={12} className="text-green-400" />
                            <span className="font-mono text-green-300 whitespace-nowrap text-[11px]">
                                补贴 {Math.abs(finalRate).toFixed(3)}/人
                            </span>
                        </>
                    ) : isTax ? (
                        <>
                            <Icon name="TrendingUp" size={12} className="text-yellow-400" />
                            <span className="font-mono text-yellow-300 whitespace-nowrap text-[11px]">
                                {finalRate.toFixed(3)}/人
                            </span>
                        </>
                    ) : (
                        <span className="font-mono text-gray-500 whitespace-nowrap text-[11px]">
                            无税收
                        </span>
                    )}
                </div>

                {/* 第三行：输入框 + 正负切换按钮 */}
                <div className="flex items-center gap-1">
                    <button
                        type="button"
                        onClick={() => {
                            const currentValue = parseFloat(headDrafts[key] ?? headRates[key] ?? 1);
                            const newValue = isNaN(currentValue) ? -1 : -currentValue;
                            handleHeadDraftChange(key, String(newValue));
                            // 立即提交变更
                            onUpdateTaxPolicies(prev => ({
                                ...prev,
                                headTaxRates: {
                                    ...(prev?.headTaxRates || {}),
                                    [key]: newValue,
                                },
                            }));
                            setHeadDrafts(prev => {
                                const next = { ...prev };
                                delete next[key];
                                return next;
                            });
                        }}
                        className="btn-compact flex-shrink-0 w-5 h-5 bg-gray-700 hover:bg-gray-600 border border-gray-500 rounded text-[9px] font-bold text-gray-300 flex items-center justify-center transition-colors"
                        title="切换正负值（税收/补贴）"
                    >
                        ±
                    </button>
                    <input
                        type="text"
                        inputMode="decimal"
                        step="0.05"
                        value={headDrafts[key] ?? (headRates[key] ?? 1)}
                        onChange={(e) => handleHeadDraftChange(key, e.target.value)}
                        onBlur={() => commitHeadDraft(key)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                commitHeadDraft(key);
                                e.target.blur();
                            }
                        }}
                        className="flex-grow min-w-0 bg-gray-900/70 border border-gray-600 text-[11px] text-gray-200 rounded px-1 py-0 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-center"
                        placeholder="税率系数"
                    />
                </div>
            </div>
        );
    };

    const allGroupKeys = new Set(Object.values(STRATA_GROUPS).flatMap(g => g.keys));

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
                            importTariffMultiplier={importTariffs[key] ?? 1}
                            exportTariffMultiplier={exportTariffs[key] ?? 1}
                            draftImportTariff={importTariffDrafts[key]}
                            draftExportTariff={exportTariffDrafts[key]}
                            onDraftChange={handleResourceDraftChange}
                            onCommit={commitResourceDraft}
                            onImportTariffDraftChange={handleImportTariffDraftChange}
                            onExportTariffDraftChange={handleExportTariffDraftChange}
                            onImportTariffCommit={commitImportTariffDraft}
                            onExportTariffCommit={commitExportTariffDraft}
                        />
                    ))}
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-4">

            {/* 执政联盟面板 */}
            {onUpdateCoalition && (
                <CoalitionPanel
                    rulingCoalition={rulingCoalition}
                    onUpdateCoalition={onUpdateCoalition}
                    classInfluence={classInfluence}
                    totalInfluence={totalInfluence}
                    legitimacy={legitimacy}
                    popStructure={popStructure}
                    classApproval={classApproval}
                />
            )}

            {/* 税收政策调节 */}
            {onUpdateTaxPolicies && (
                <div className="glass-ancient p-4 rounded-xl border border-ancient-gold/30">
                    <h3 className="text-sm font-bold mb-3 flex items-center gap-2 text-gray-300 font-decorative">
                        <Icon name="DollarSign" size={16} className="text-yellow-400" />
                        税收政策调节
                    </h3>

                    {/* 标签页切换 */}
                    <div className="flex flex-nowrap gap-2 mb-4 border-b border-gray-700 overflow-x-auto scrollbar-thin">
                        <button
                            onClick={() => setActiveTaxTab('head')}
                            className={`flex-1 min-w-[90px] px-4 py-2 text-sm font-semibold transition-all ${activeTaxTab === 'head'
                                ? 'text-yellow-300 border-b-2 border-yellow-400'
                                : 'text-gray-400 hover:text-gray-300'
                                }`}
                        >
                            <div className="flex items-center gap-2">
                                <Icon name="Users" size={14} />
                                人头税
                            </div>
                        </button>
                        <button
                            onClick={() => setActiveTaxTab('resource')}
                            className={`flex-1 min-w-[90px] px-4 py-2 text-sm font-semibold transition-all ${activeTaxTab === 'resource'
                                ? 'text-blue-300 border-b-2 border-blue-400'
                                : 'text-gray-400 hover:text-gray-300'
                                }`}
                        >
                            <div className="flex items-center gap-2">
                                <Icon name="Package" size={14} />
                                交易税
                            </div>
                        </button>
                        <button
                            onClick={() => setActiveTaxTab('business')}
                            className={`flex-1 min-w-[90px] px-4 py-2 text-sm font-semibold transition-all ${activeTaxTab === 'business'
                                ? 'text-green-300 border-b-2 border-green-400'
                                : 'text-gray-400 hover:text-gray-300'
                                }`}
                        >
                            <div className="flex items-center gap-2">
                                <Icon name="Building" size={14} />
                                营业税
                            </div>
                        </button>
                    </div>

                    {/* 人头税面板 */}
                    {activeTaxTab === 'head' && (
                        <div className="space-y-4">
                            <div className="bg-blue-900/20 border border-blue-500/30 p-3 rounded-lg text-xs text-blue-100">
                                <p className="flex items-center gap-2 mb-1">
                                    <Icon name="Info" size={12} className="text-blue-400" />
                                    <span className="font-semibold">人头税说明</span>
                                </p>
                                <p>对各阶层人口征收的税收。税率系数越高，税收越多，但可能影响阶层满意度。</p>
                            </div>

                            {/* 按阶层分组显示 */}
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

                            {/* 未分组的阶层 */}
                            {strataToDisplay.filter(key => !allGroupKeys.has(key)).length > 0 && (
                                <div>
                                    <h4 className="text-xs font-semibold text-gray-400 mb-2">其他阶层</h4>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
                                        {strataToDisplay.filter(key => !allGroupKeys.has(key)).map(key => renderStratumCard(key))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* 交易税面板 */}
                    {activeTaxTab === 'resource' && (
                        <div className="space-y-4">
                            <div className="bg-blue-900/20 border border-blue-500/30 p-3 rounded-lg text-xs text-blue-100">
                                <p className="flex items-center gap-2 mb-1">
                                    <Icon name="Info" size={12} className="text-blue-400" />
                                    <span className="font-semibold">交易税说明</span>
                                </p>
                                <p>对市场交易的资源征收的税收。税率为正时征税，为负时作为补贴。仅对有市场供应的资源生效。</p>
                            </div>

                            {/* 按资源分组显示 */}
                            {Object.values(RESOURCE_GROUPS).map(group => renderResourceGroup(group, taxableResources))}

                            {/* 未分组的资源 */}
                            {taxableResources.filter(([key]) => !ALL_GROUPED_RESOURCES.has(key)).length > 0 && (
                                <div>
                                    <h5 className="text-xs font-semibold text-gray-400 mb-2">其他资源</h5>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-2">
                                        {taxableResources
                                            .filter(([key]) => !ALL_GROUPED_RESOURCES.has(key))
                                            .map(([key, info]) => (
                                                <ResourceTaxCard
                                                    key={key}
                                                    resourceKey={key}
                                                    info={info}
                                                    rate={resourceRates[key]}
                                                    hasSupply={(market?.supply?.[key] || 0) > 0}
                                                    draftRate={resourceDrafts[key]}
                                                    importTariffMultiplier={importTariffs[key] ?? 1}
                                                    exportTariffMultiplier={exportTariffs[key] ?? 1}
                                                    draftImportTariff={importTariffDrafts[key]}
                                                    draftExportTariff={exportTariffDrafts[key]}
                                                    onDraftChange={handleResourceDraftChange}
                                                    onCommit={commitResourceDraft}
                                                    onImportTariffDraftChange={handleImportTariffDraftChange}
                                                    onExportTariffDraftChange={handleExportTariffDraftChange}
                                                    onImportTariffCommit={commitImportTariffDraft}
                                                    onExportTariffCommit={commitExportTariffDraft}
                                                />
                                            ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* 营业税面板 */}
                    {activeTaxTab === 'business' && (
                        <div className="space-y-4">
                            <div className="bg-blue-900/20 border border-blue-500/30 p-3 rounded-lg text-xs text-blue-100">
                                <p className="flex items-center gap-2 mb-1">
                                    <Icon name="Info" size={12} className="text-blue-400" />
                                    <span className="font-semibold">营业税说明</span>
                                </p>
                                <p>对建筑经营征收的税收。税率系数越高，每个建筑每次运营时缴纳的税收越多。</p>
                            </div>

                            {/* 按建筑类别显示 */}
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

                            {builtBuildings.length === 0 && (
                                <div className="text-center text-gray-500 py-8">
                                    <Icon name="Building" size={32} className="mx-auto mb-2 opacity-50" />
                                    <p className="text-sm">暂无已建造的建筑</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {unlockedDecrees.length === 0 && (
                <div className="bg-yellow-900/20 border border-yellow-600/30 p-4 rounded-lg text-xs text-yellow-100">
                    <p className="font-semibold mb-1 flex items-center gap-2">
                        <Icon name="Lock" size={14} className="text-yellow-300" />
                        当前时代暂无可颁布政令
                    </p>
                    <p>
                        升级到 {nextUnlockEpochName || '更高时代'} 后可解锁新的政策。
                    </p>
                </div>
            )}

            {/* 按类别显示政令 */}
            {Object.entries(categories).map(([catKey, catInfo]) => {
                const categoryDecrees = decreesByCategory[catKey] || [];
                if (categoryDecrees.length === 0) return null;

                return (
                    <div key={catKey} className="glass-ancient p-4 rounded-xl border border-ancient-gold/30">
                        {/* 类别标题 */}
                        <h3 className="text-sm font-bold mb-3 flex items-center gap-2 text-gray-300 font-decorative">
                            <Icon name={catInfo.icon} size={16} className={catInfo.color} />
                            {catInfo.name}
                        </h3>

                        {/* 政令列表 - 紧凑布局 */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-2">
                            {categoryDecrees.map((decree) => (
                                <div
                                    key={decree.id}
                                    onClick={() => onShowDecreeDetails && onShowDecreeDetails(decree)}
                                    onMouseEnter={(e) => {
                                        // Only show tooltip on desktop (lg breakpoint and above)
                                        if (window.innerWidth >= 1024) {
                                            setDecreeAnchorRect(e.currentTarget.getBoundingClientRect());
                                            setHoveredDecree(decree);
                                        }
                                    }}
                                    onMouseLeave={() => {
                                        setHoveredDecree(null);
                                        setDecreeAnchorRect(null);
                                    }}
                                    className={`relative p-2 rounded-lg border transition-all cursor-pointer ${decree.active
                                        ? 'bg-green-900/20 border-green-600 shadow-lg'
                                        : 'bg-gray-700/50 border-gray-600 hover:border-purple-500 hover:shadow-lg'
                                        }`}
                                >
                                    {/* 政令头部 - 紧凑版 */}
                                    <div className="flex flex-col items-center mb-2">
                                        <div className="w-12 h-12 icon-metal-container icon-metal-container-lg rounded-lg flex items-center justify-center mb-1">
                                            {decree.active ? (
                                                <Icon name="Check" size={24} className="text-green-400 icon-metal-green" />
                                            ) : (
                                                <Icon name="FileText" size={24} className="text-purple-400 icon-metal-purple" />
                                            )}
                                        </div>
                                        <h4 className="text-xs font-bold text-white text-center leading-tight font-decorative">{decree.name}</h4>
                                        {decree.active && (
                                            <span className="text-[10px] text-green-400 mt-0.5">生效中</span>
                                        )}
                                    </div>

                                    {/* 简化的关键信息 */}
                                    <div className="space-y-1 text-[10px] mb-2">
                                        {decree.effects && decree.effects.length > 0 && (
                                            <div className="bg-green-900/30 rounded px-1.5 py-1 text-center text-green-300">
                                                {decree.effects.length}项正面效果
                                            </div>
                                        )}
                                        {decree.drawbacks && decree.drawbacks.length > 0 && (
                                            <div className="bg-red-900/30 rounded px-1.5 py-1 text-center text-red-300">
                                                {decree.drawbacks.length}项负面效果
                                            </div>
                                        )}
                                    </div>

                                    {/* 切换按钮 - 紧凑版 */}
                                    <button
                                        onClick={(e) => { e.stopPropagation(); onToggle(decree.id); }}
                                        className={`w-full px-2 py-1 rounded text-[10px] font-semibold transition-all ${decree.active
                                            ? 'bg-red-600 hover:bg-red-500 text-white'
                                            : 'bg-green-600 hover:bg-green-500 text-white'
                                            }`}
                                    >
                                        <div className="flex items-center justify-center gap-1">
                                            <Icon name={decree.active ? "X" : "Check"} size={10} />
                                            {decree.active ? '废除' : '颁布'}
                                        </div>
                                    </button>

                                </div>
                            ))}
                        </div>
                    </div>
                );
            })}

            {/* 政令悬浮提示框 - 使用 Portal */}
            <DecreeTooltip
                decree={hoveredDecree}
                anchorRect={decreeAnchorRect}
            />

            {/* 当前生效的政令统计 */}
            <div className="glass-ancient p-4 rounded-xl border border-ancient-gold/30">
                <h3 className="text-sm font-bold mb-2 flex items-center gap-2 text-gray-300 font-decorative">
                    <Icon name="FileText" size={16} className="text-blue-400" />
                    政令统计
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    <div className="bg-gray-700/50 p-3 rounded">
                        <p className="text-xs text-gray-400 mb-1">总政令数</p>
                        <p className="text-lg font-bold text-white">{unlockedDecrees.length}</p>
                    </div>
                    <div className="bg-gray-700/50 p-3 rounded">
                        <p className="text-xs text-gray-400 mb-1">生效中</p>
                        <p className="text-lg font-bold text-green-400">
                            {unlockedActiveCount}
                        </p>
                    </div>
                    <div className="bg-gray-700/50 p-3 rounded">
                        <p className="text-xs text-gray-400 mb-1">未启用</p>
                        <p className="text-lg font-bold text-gray-400">
                            {unlockedInactiveCount}
                        </p>
                    </div>
                    <div className="bg-gray-700/50 p-3 rounded">
                        <p className="text-xs text-gray-400 mb-1">政策效率</p>
                        <p className="text-lg font-bold text-blue-400">
                            {policyEfficiency}%
                        </p>
                    </div>
                    <div className="bg-gray-700/50 p-3 rounded">
                        <p className="text-xs text-gray-400 mb-1">待解锁</p>
                        <p className="text-lg font-bold text-yellow-300">
                            {lockedDecrees.length}
                        </p>
                    </div>
                </div>
                {lockedDecrees.length > 0 && (
                    <p className="text-[11px] text-gray-400 mt-3">
                        还有 {lockedDecrees.length} 条政令将在后续时代解锁{nextUnlockEpochName ? `，最近的是 ${nextUnlockEpochName}` : ''}。
                    </p>
                )}
            </div>
        </div>
    );
};
