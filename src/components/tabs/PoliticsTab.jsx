
// 政令标签页组件 -> 改名为政治标签页 (由于不再只包含政令)
// 显示政府、税收及官员管理

import React, { memo } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '../common/UIComponents';
import { STRATA, RESOURCES, EPOCHS, BUILDINGS, TAX_LIMITS, TAX_BASE_RATES } from '../../config';
import { isResourceUnlocked } from '../../utils/resources';
import { CoalitionPanel } from '../panels/CoalitionPanel';
import { OfficialsPanel } from '../panels/officials/OfficialsPanel';
import { formatNumberShortCN } from '../../utils/numberFormat';
import { trackSubTabSwitch } from '../../analytics/gaTracker';
import { BottomSheet } from './BottomSheet';

// Helper to clamp values
const clamp = (val, min, max) => Math.min(Math.max(val, min), max);

// 定义阶层分组，用于UI显示
const STRATA_GROUPS = {
    upper: {
        name: '上流阶级',
        keys: ['merchant', 'official', 'landowner', 'capitalist', 'engineer', 'scientist'],
    },
    middle: {
        name: '中产阶级',
        keys: ['artisan', 'soldier', 'cleric', 'scribe', 'navigator', 'technician'],
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

// ==================== 税收批量设置面板 ====================
/**
 * 税收批量设置底部面板
 * 允许一键统一设置所有阶层/资源/建筑的税率
 */
const TaxBatchSheet = memo(({
    isOpen,
    onClose,
    strataToDisplay = [],
    taxableResourceKeys = [],
    builtBuildingIds = [],
    onUpdateTaxPolicies,
    headBaseRate,
    headPercentToMultiplier,
    bizDisplayToRate,
}) => {
    const [headPct, setHeadPct] = React.useState('');
    const [resourcePct, setResourcePct] = React.useState('');
    const [bizPct, setBizPct] = React.useState('');
    const [importTariffPct, setImportTariffPct] = React.useState('');
    const [exportTariffPct, setExportTariffPct] = React.useState('');
    const [feedback, setFeedback] = React.useState('');

    const showFeedback = (msg) => {
        setFeedback(msg);
        setTimeout(() => setFeedback(''), 2000);
    };

    const handleClose = () => {
        setHeadPct('');
        setResourcePct('');
        setBizPct('');
        setImportTariffPct('');
        setExportTariffPct('');
        setFeedback('');
        onClose();
    };

    // 批量应用人头税
    // 正值：税率%（通过 headPercentToMultiplier 转换为倍率）
    // 负值：固定补贴（直接存储负数，单位与单项税收一致）
    const applyHeadTax = () => {
        const parsed = parseFloat(headPct);
        if (isNaN(parsed)) { showFeedback('❌ 请输入有效数值'); return; }
        const storeValue = parsed < 0 ? parsed : headPercentToMultiplier(parsed);
        onUpdateTaxPolicies(prev => {
            const updated = { ...(prev?.headTaxRates || {}) };
            strataToDisplay.forEach(key => { updated[key] = storeValue; });
            return { ...prev, headTaxRates: updated };
        });
        const label = parsed < 0 ? `固定补贴 ${Math.abs(parsed).toFixed(1)}` : `${parsed.toFixed(1)}%`;
        showFeedback(`✅ 已将 ${strataToDisplay.length} 个阶层人头税统一设为 ${label}`);
    };

    // 批量应用交易税
    const applyResourceTax = () => {
        const parsed = parseFloat(resourcePct);
        if (isNaN(parsed)) { showFeedback('❌ 请输入有效数值'); return; }
        const limit = TAX_LIMITS?.MAX_RESOURCE_TAX || 5.0;
        const rateValue = Math.max(-limit, Math.min(limit, parsed / 100));
        onUpdateTaxPolicies(prev => {
            const updated = { ...(prev?.resourceTaxRates || {}) };
            taxableResourceKeys.forEach(key => { updated[key] = rateValue; });
            return { ...prev, resourceTaxRates: updated };
        });
        showFeedback(`✅ 已将 ${taxableResourceKeys.length} 种资源交易税统一设为 ${parsed.toFixed(1)}%`);
    };

    // 批量应用营业税
    const applyBizTax = () => {
        const parsed = parseFloat(bizPct);
        if (isNaN(parsed)) { showFeedback('❌ 请输入有效数值'); return; }
        const rate = bizDisplayToRate(parsed);
        const limit = TAX_LIMITS?.MAX_BUSINESS_TAX || 10;
        const clamped = rate < 0 ? rate : Math.min(rate, limit);
        onUpdateTaxPolicies(prev => {
            const updated = { ...(prev?.businessTaxRates || {}) };
            builtBuildingIds.forEach(id => { updated[id] = clamped; });
            return { ...prev, businessTaxRates: updated };
        });
        showFeedback(`✅ 已将 ${builtBuildingIds.length} 类建筑营业税统一设为 ${parsed.toFixed(1)}`);
    };

    // 批量应用进口关税
    const applyImportTariff = () => {
        const parsed = parseFloat(importTariffPct);
        if (isNaN(parsed)) { showFeedback('❌ 请输入有效数值'); return; }
        const rateValue = parsed / 100;
        onUpdateTaxPolicies(prev => {
            const updated = { ...(prev?.importTariffMultipliers || {}) };
            taxableResourceKeys.forEach(key => { updated[key] = rateValue; });
            return { ...prev, importTariffMultipliers: updated };
        });
        showFeedback(`✅ 已将所有资源进口关税统一设为 ${parsed.toFixed(1)}%`);
    };

    // 批量应用出口关税
    const applyExportTariff = () => {
        const parsed = parseFloat(exportTariffPct);
        if (isNaN(parsed)) { showFeedback('❌ 请输入有效数值'); return; }
        const rateValue = parsed / 100;
        onUpdateTaxPolicies(prev => {
            const updated = { ...(prev?.exportTariffMultipliers || {}) };
            taxableResourceKeys.forEach(key => { updated[key] = rateValue; });
            return { ...prev, exportTariffMultipliers: updated };
        });
        showFeedback(`✅ 已将所有资源出口关税统一设为 ${parsed.toFixed(1)}%`);
    };

    // 全部重置为默认
    const resetAll = () => {
        onUpdateTaxPolicies(prev => {
            const headUpdated = { ...(prev?.headTaxRates || {}) };
            const defaultHeadTaxRate = headPercentToMultiplier(5);
            strataToDisplay.forEach(key => { headUpdated[key] = defaultHeadTaxRate; });
            const resUpdated = { ...(prev?.resourceTaxRates || {}) };
            taxableResourceKeys.forEach(key => { resUpdated[key] = 0; });
            const bizUpdated = { ...(prev?.businessTaxRates || {}) };
            builtBuildingIds.forEach(id => { bizUpdated[id] = TAX_BASE_RATES?.BUSINESS_TAX_REVENUE_RATIO || 0.03; });
            const importUpdated = { ...(prev?.importTariffMultipliers || {}) };
            taxableResourceKeys.forEach(key => { importUpdated[key] = 0; });
            const exportUpdated = { ...(prev?.exportTariffMultipliers || {}) };
            taxableResourceKeys.forEach(key => { exportUpdated[key] = 0; });
            return {
                ...prev,
                headTaxRates: headUpdated,
                resourceTaxRates: resUpdated,
                businessTaxRates: bizUpdated,
                importTariffMultipliers: importUpdated,
                exportTariffMultipliers: exportUpdated,
            };
        });
        showFeedback('✅ 已重置所有税收至默认值');
    };

    const inputCls = 'flex-grow min-w-0 bg-gray-900/70 border border-gray-600 text-sm text-gray-200 rounded-lg px-3 py-2 focus:ring-1 focus:ring-yellow-500 focus:border-yellow-500 text-center';
    const applyBtnCls = 'flex-shrink-0 px-4 py-2 bg-yellow-700/60 hover:bg-yellow-600/70 border border-yellow-600/50 text-yellow-100 text-sm rounded-lg font-semibold transition-colors active:scale-95';

    return (
        <BottomSheet isOpen={isOpen} onClose={handleClose} title="⚡ 税收批量设置">
            <div className="space-y-4 p-1">
                {/* 反馈提示 */}
                {feedback && (
                    <div className="text-center text-sm text-green-300 bg-green-900/30 border border-green-700/40 rounded-lg py-2 px-3">
                        {feedback}
                    </div>
                )}

                <p className="text-xs text-gray-400 leading-relaxed">
                    批量统一设置，输入值后点击对应"应用"。<span className="text-yellow-300">负值 = 补贴</span>。不影响未填写的项目。
                </p>

                {/* 人头税 */}
                <div className="bg-yellow-900/20 border border-yellow-700/30 rounded-xl p-3 space-y-2">
                    <div className="flex items-center gap-2 mb-1">
                        <Icon name="Users" size={14} className="text-yellow-400" />
                        <span className="text-sm font-bold text-yellow-300">人头税倍率</span>
                        <span className="text-xs text-gray-500 ml-auto">{strataToDisplay.length} 个阶层</span>
                    </div>
                    <p className="text-xs text-gray-500">输入收入百分比。例如：5 = 征收收入的5%；100 = 全额征收；<span className="text-yellow-300">负值 = 固定补贴</span></p>
                    <div className="flex gap-2">
                        <input type="number" value={headPct} onChange={e => setHeadPct(e.target.value)} className={inputCls} placeholder="税率% (如 100) 或 -补贴" />
                        <button onClick={applyHeadTax} className={applyBtnCls}>应用</button>
                    </div>
                </div>

                {/* 交易税 */}
                <div className="bg-blue-900/20 border border-blue-700/30 rounded-xl p-3 space-y-2">
                    <div className="flex items-center gap-2 mb-1">
                        <Icon name="Package" size={14} className="text-blue-400" />
                        <span className="text-sm font-bold text-blue-300">资源交易税</span>
                        <span className="text-xs text-gray-500 ml-auto">{taxableResourceKeys.length} 种资源</span>
                    </div>
                    <p className="text-xs text-gray-500">输入百分比，正值征税，负值补贴。例如：10 = 10% 交易税</p>
                    <div className="flex gap-2">
                        <input type="number" value={resourcePct} onChange={e => setResourcePct(e.target.value)} className={inputCls} placeholder="税率% (如 10)" />
                        <button onClick={applyResourceTax} className={applyBtnCls.replace('yellow', 'blue')}>应用</button>
                    </div>
                </div>

                {/* 营业税 */}
                <div className="bg-green-900/20 border border-green-700/30 rounded-xl p-3 space-y-2">
                    <div className="flex items-center gap-2 mb-1">
                        <Icon name="Building" size={14} className="text-green-400" />
                        <span className="text-sm font-bold text-green-300">建筑营业税</span>
                        <span className="text-xs text-gray-500 ml-auto">{builtBuildingIds.length} 类建筑</span>
                    </div>
                    <p className="text-xs text-gray-500">正值=税率%（50=收产值50%），负值=每栋固定补贴🪙</p>
                    <div className="flex gap-2">
                        <input type="number" value={bizPct} onChange={e => setBizPct(e.target.value)} className={inputCls} placeholder="税率% 或 -补贴额" />
                        <button onClick={applyBizTax} className={applyBtnCls.replace('yellow', 'green')}>应用</button>
                    </div>
                </div>

                {/* 进口关税 */}
                <div className="bg-purple-900/20 border border-purple-700/30 rounded-xl p-3 space-y-2">
                    <div className="flex items-center gap-2 mb-1">
                        <Icon name="ArrowDownLeft" size={14} className="text-purple-400" />
                        <span className="text-sm font-bold text-purple-300">进口关税</span>
                    </div>
                    <p className="text-xs text-gray-500">正值征税，负值补贴进口商。例如：20 = 20% 进口关税</p>
                    <div className="flex gap-2">
                        <input type="number" value={importTariffPct} onChange={e => setImportTariffPct(e.target.value)} className={inputCls} placeholder="关税% (如 20) 或 -补贴%" />
                        <button onClick={applyImportTariff} className={applyBtnCls.replace('yellow', 'purple')}>应用</button>
                    </div>
                </div>

                {/* 出口关税 */}
                <div className="bg-indigo-900/20 border border-indigo-700/30 rounded-xl p-3 space-y-2">
                    <div className="flex items-center gap-2 mb-1">
                        <Icon name="ArrowUpRight" size={14} className="text-indigo-400" />
                        <span className="text-sm font-bold text-indigo-300">出口关税</span>
                    </div>
                    <p className="text-xs text-gray-500">正值征税，负值补贴出口商。例如：10 = 10% 出口关税</p>
                    <div className="flex gap-2">
                        <input type="number" value={exportTariffPct} onChange={e => setExportTariffPct(e.target.value)} className={inputCls} placeholder="关税% (如 10) 或 -补贴%" />
                        <button onClick={applyExportTariff} className={applyBtnCls.replace('yellow', 'indigo')}>应用</button>
                    </div>
                </div>

                {/* 全部重置 */}
                <button
                    onClick={resetAll}
                    className="w-full py-2.5 bg-red-900/30 hover:bg-red-800/40 border border-red-700/40 text-red-300 text-sm rounded-xl font-semibold transition-colors active:scale-95 flex items-center justify-center gap-2"
                >
                    <Icon name="RotateCcw" size={14} />
                    全部重置为默认值
                </button>
            </div>
        </BottomSheet>
    );
});
TaxBatchSheet.displayName = 'TaxBatchSheet';

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
                    className="btn-compact flex-shrink-0 w-5 h-5 bg-gray-700 hover:bg-gray-600 border border-gray-500 rounded text-xs font-bold text-gray-300 flex items-center justify-center transition-colors"
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
                    className="flex-grow min-w-0 bg-gray-900/70 border border-gray-600 text-xs text-gray-200 rounded px-1.5 py-0.5 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-center"
                    placeholder="税率%"
                />
            </div>
            <div className="mt-1.5 border-t border-gray-800/70 pt-1.5 space-y-1.5">
                {/* 进口关税 */}
                <div>
                    <div className="flex items-center justify-between text-xs text-gray-400 mb-0.5">
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
                            className="btn-compact flex-shrink-0 w-5 h-5 bg-gray-700 hover:bg-gray-600 border border-gray-500 rounded text-xs font-bold text-gray-300 flex items-center justify-center transition-colors"
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
                            className="flex-grow min-w-0 bg-gray-900/70 border border-gray-600 text-xs text-gray-200 rounded px-1.5 py-0.5 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-center"
                            placeholder="进口关税%"
                        />
                    </div>
                </div>
                {/* 出口关税 */}
                <div>
                    <div className="flex items-center justify-between text-xs text-gray-400 mb-0.5">
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
                            className="btn-compact flex-shrink-0 w-5 h-5 bg-gray-700 hover:bg-gray-600 border border-gray-500 rounded text-xs font-bold text-gray-300 flex items-center justify-center transition-colors"
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
                            className="flex-grow min-w-0 bg-gray-900/70 border border-gray-600 text-xs text-gray-200 rounded px-1.5 py-0.5 focus:ring-1 focus:ring-green-500 focus:border-green-500 text-center"
                            placeholder="出口关税%"
                        />
                    </div>
                </div>
                <p className="text-xs text-gray-500 mt-1">最终税率 = 交易税 + 关税（加法叠加）</p>
            </div>
        </div>
    );
};
const BusinessTaxCard = ({ building, displayPercent, buildingCount, draftPercent, onDraftChange, onCommit, onToggleSign }) => {
    const isSubsidy = displayPercent < 0;
    const isTax = displayPercent > 0;

    const valueColor = isSubsidy ? 'text-green-300' : 'text-yellow-300';
    const borderColor = isSubsidy ? 'border-green-700/60' : (isTax ? 'border-yellow-700/60' : 'border-gray-700/60');
    const bgColor = building.visual?.color || 'bg-gray-700';
    const textColor = building.visual?.text || 'text-gray-200';

    const showPercent = Number.isInteger(displayPercent) ? displayPercent : displayPercent.toFixed(1);

    return (
        <div
            className={`bg-gray-900/40 p-1.5 rounded-lg border ${borderColor} flex flex-col gap-1 transition-all ${buildingCount > 0 ? '' : 'opacity-50'
                }`}
        >
            <div>
                <div className="flex items-center gap-1 mb-0.5">
                    <div className={`${bgColor} ${textColor} p-0.5 rounded`}>
                        <Icon name={building.visual?.icon || 'Building'} size={14} />
                    </div>
                    <span className="font-semibold text-gray-300 text-xs flex-grow whitespace-nowrap overflow-hidden text-ellipsis">
                        {building.name}
                    </span>
                    <span className="text-gray-500 text-xs font-mono">{buildingCount}</span>
                </div>

                <div className="text-center my-0.5">
                    {isSubsidy ? (
                        <div className="flex items-center justify-center gap-1">
                            <Icon name="TrendingDown" size={12} className="text-green-400" />
                            <span className={`${valueColor} text-sm font-semibold`}>
                                补贴 {Math.abs(showPercent)}🪙/栋
                            </span>
                        </div>
                    ) : isTax ? (
                        <div className="flex items-center justify-center gap-1">
                            <Icon name="TrendingUp" size={12} className="text-yellow-400" />
                            <span className={`${valueColor} text-sm font-semibold`}>
                                {showPercent}%
                            </span>
                        </div>
                    ) : (
                        <span className="text-gray-500 text-sm">无税收</span>
                    )}
                    <div className="text-xs text-gray-500 mt-0">{isSubsidy ? '每栋补贴金额' : '营收税率'}</div>
                </div>
            </div>

            <div className="flex items-center gap-1">
                <button
                    type="button"
                    onClick={() => onToggleSign && onToggleSign(building.id, draftPercent ?? showPercent)}
                    className="btn-compact flex-shrink-0 w-5 h-5 bg-gray-700 hover:bg-gray-600 border border-gray-500 rounded text-xs font-bold text-gray-300 flex items-center justify-center transition-colors"
                    title="切换正负值（税收/补贴）"
                >
                    ±
                </button>
                <input
                    type="text"
                    inputMode="decimal"
                    step="1"
                    value={draftPercent ?? showPercent}
                    onChange={(e) => onDraftChange(building.id, e.target.value)}
                    onBlur={() => onCommit(building.id)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            onCommit(building.id);
                            e.target.blur();
                        }
                    }}
                    className="flex-grow min-w-0 bg-gray-900/70 border border-gray-600 text-xs text-gray-200 rounded px-1.5 py-0 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-center"
                    placeholder={isSubsidy ? "🪙/栋" : "税率%"}
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
    // [NEW] Generals for OfficialCard display
    generals = [],
    // [NEW] 产业政策切换回调
    changeOfficialPropertyPolicy,
}) => {

    const [activeTaxTab, setActiveTaxTab] = React.useState('head'); // 'head', 'resource', 'business'
    const [activeSection, setActiveSection] = React.useState('government'); // 'government', 'tax', 'officials'
    const [showTaxBatch, setShowTaxBatch] = React.useState(false); // 税收批量设置面板

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

    const draftsRef = React.useRef({ headDrafts, resourceDrafts, importTariffDrafts, exportTariffDrafts, businessDrafts });
    draftsRef.current = { headDrafts, resourceDrafts, importTariffDrafts, exportTariffDrafts, businessDrafts };

    // 获取所有已解锁的阶层
    const unlockedStrataKeys = React.useMemo(() => {
        return Object.keys(STRATA).filter(key => {
            const stratum = STRATA[key];
            if (stratum.unlockEpoch !== undefined && stratum.unlockEpoch > epoch) return false;
            if (stratum.unlockTech && !techsUnlocked.includes(stratum.unlockTech)) return false;
            return true;
        });
    }, [epoch, techsUnlocked]);

    // 筛选出有岗位提供或有人口的阶层（用于人头税面板显示）
    // [FIX] 暂停时 jobsAvailable 可能尚未被 simulation 填充，回退到 popStructure 判断
    const strataToDisplay = React.useMemo(() => {
        return unlockedStrataKeys.filter(key => {
            if (key === 'unemployed') return true;
            const jobSlots = jobsAvailable[key] || 0;
            if (jobSlots > 0) return true;
            const pop = popStructure[key] || 0;
            return pop > 0;
        });
    }, [unlockedStrataKeys, jobsAvailable, popStructure]);

    // Tax Draft Handlers (Keeping existing logic)
    // 人头税：UI 用百分比，存储用系数
    const headBaseRate = TAX_BASE_RATES?.HEAD_TAX_INCOME_RATIO || 1.0;
    const headMultiplierToPercent = (m) => (m ?? 0.05) * headBaseRate * 100;
    const headPercentToMultiplier = (pct) => pct / (headBaseRate * 100);

    const handleHeadDraftChange = (key, raw) => setHeadDrafts(prev => ({ ...prev, [key]: raw }));
    const commitHeadDraft = (key) => {
        if (headDrafts[key] === undefined) return;
        const parsed = parseFloat(headDrafts[key]);
        if (Number.isNaN(parsed)) { setHeadDrafts(prev => { const next = { ...prev }; delete next[key]; return next; }); return; }
        const currentMultiplier = headRates[key] ?? 0.05;
        const isCurrentSubsidy = currentMultiplier < 0 || Object.is(currentMultiplier, -0);
        let storeValue;
        if (parsed < 0) {
            // 直接输入负数 → 自动切换为补贴模式
            storeValue = parsed;
        } else if (isCurrentSubsidy) {
            storeValue = -(Math.max(0, Math.abs(parsed)));
        } else {
            // 人头税不设上限，仅保证非负
            const validPct = Math.max(0, parsed);
            storeValue = headPercentToMultiplier(validPct);
        }
        onUpdateTaxPolicies(prev => ({ ...prev, headTaxRates: { ...(prev?.headTaxRates), [key]: storeValue } }));
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

    // 营业税 WYSIWYG：正值=税率%(输入50→存0.5)，负值=每栋补贴🪙(输入-500→存-500)
    const bizDefaultRate = TAX_BASE_RATES?.BUSINESS_TAX_REVENUE_RATIO || 0.03;
    const bizRateToDisplay = (r) => {
        const v = r ?? bizDefaultRate;
        return v < 0 ? v : v * 100;
    };
    const bizDisplayToRate = (val) => {
        return val < 0 ? val : val / 100;
    };

    const handleBusinessDraftChange = (key, raw) => setBusinessDrafts(prev => ({ ...prev, [key]: raw }));
    const commitBusinessDraft = (key) => {
        if (businessDrafts[key] === undefined) return;
        const parsed = parseFloat(businessDrafts[key]);
        if (Number.isNaN(parsed)) { setBusinessDrafts(prev => { const next = { ...prev }; delete next[key]; return next; }); return; }
        const rate = bizDisplayToRate(parsed);
        const limit = TAX_LIMITS?.MAX_BUSINESS_TAX || 10;
        const clamped = rate < 0 ? rate : Math.min(rate, limit);
        onUpdateTaxPolicies(prev => ({ ...prev, businessTaxRates: { ...(prev?.businessTaxRates), [key]: clamped } }));
        setBusinessDrafts(prev => { const next = { ...prev }; delete next[key]; return next; });
    };

    const toggleBusinessSign = (key, currentDraftOrMultiplier) => {
        const currentVal = parseFloat(currentDraftOrMultiplier);
        const newVal = isNaN(currentVal) ? -1 : -currentVal;
        const rate = bizDisplayToRate(newVal);
        onUpdateTaxPolicies(prev => ({ ...prev, businessTaxRates: { ...(prev?.businessTaxRates), [key]: rate } }));
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

    // 组件卸载时自动提交所有未保存的 draft，防止切换标签页时丢失设置
    const commitFnsRef = React.useRef(null);
    commitFnsRef.current = { headRates, headBaseRate, headPercentToMultiplier, onUpdateTaxPolicies, bizDisplayToRate };
    React.useEffect(() => {
        return () => {
            const d = draftsRef.current;
            const fn = commitFnsRef.current;
            if (!fn?.onUpdateTaxPolicies) return;

            const headUpdates = {};
            for (const [key, raw] of Object.entries(d.headDrafts)) {
                const parsed = parseFloat(raw);
                if (Number.isNaN(parsed)) continue;
                const currentMultiplier = fn.headRates[key] ?? 0.05;
                const isCurrentSubsidy = currentMultiplier < 0 || Object.is(currentMultiplier, -0);
                if (isCurrentSubsidy) {
                    headUpdates[key] = -(Math.max(0, Math.abs(parsed)));
                } else {
                    // 人头税不设上限，仅保证非负
                    const validPct = Math.max(0, parsed);
                    headUpdates[key] = fn.headPercentToMultiplier(validPct);
                }
            }
            const resourceUpdates = {};
            for (const [key, raw] of Object.entries(d.resourceDrafts)) {
                const parsed = parseFloat(raw);
                const rateValue = (Number.isNaN(parsed) ? 0 : parsed) / 100;
                const limit = TAX_LIMITS?.MAX_RESOURCE_TAX || 5.0;
                resourceUpdates[key] = clamp(rateValue, -limit, limit);
            }
            const importTariffUpdates = {};
            for (const [key, raw] of Object.entries(d.importTariffDrafts)) {
                const parsed = parseFloat(raw);
                importTariffUpdates[key] = (Number.isNaN(parsed) ? 0 : parsed) / 100;
            }
            const exportTariffUpdates = {};
            for (const [key, raw] of Object.entries(d.exportTariffDrafts)) {
                const parsed = parseFloat(raw);
                exportTariffUpdates[key] = (Number.isNaN(parsed) ? 0 : parsed) / 100;
            }
            const businessUpdates = {};
            for (const [key, raw] of Object.entries(d.businessDrafts)) {
                const parsed = parseFloat(raw);
                if (Number.isNaN(parsed)) continue;
                const rate = fn.bizDisplayToRate(parsed);
                const limit = TAX_LIMITS?.MAX_BUSINESS_TAX || 10;
                businessUpdates[key] = rate < 0 ? rate : Math.min(rate, limit);
            }

            const hasAny = Object.keys(headUpdates).length + Object.keys(resourceUpdates).length +
                Object.keys(importTariffUpdates).length + Object.keys(exportTariffUpdates).length +
                Object.keys(businessUpdates).length;
            if (hasAny > 0) {
                fn.onUpdateTaxPolicies(prev => {
                    const next = { ...prev };
                    if (Object.keys(headUpdates).length) next.headTaxRates = { ...(prev?.headTaxRates), ...headUpdates };
                    if (Object.keys(resourceUpdates).length) next.resourceTaxRates = { ...(prev?.resourceTaxRates), ...resourceUpdates };
                    if (Object.keys(importTariffUpdates).length) next.importTariffMultipliers = { ...(prev?.importTariffMultipliers), ...importTariffUpdates };
                    if (Object.keys(exportTariffUpdates).length) next.exportTariffMultipliers = { ...(prev?.exportTariffMultipliers), ...exportTariffUpdates };
                    if (Object.keys(businessUpdates).length) next.businessTaxRates = { ...(prev?.businessTaxRates), ...businessUpdates };
                    return next;
                });
            }
        };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

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

    const taxableResources = React.useMemo(() => orderedResourceKeys
        .map(key => [key, RESOURCES[key]])
        .filter(([, info]) => info && (!info.type || (info.type !== 'virtual' && info.type !== 'currency'))), [orderedResourceKeys]);

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
        const multiplier = headRates[key] ?? 0.05;
        const isSubsidy = multiplier < 0 || Object.is(multiplier, -0);
        const isTax = multiplier > 0;
        const displayPct = isTax ? headMultiplierToPercent(multiplier) : 0;
        const displaySubsidy = isSubsidy ? Math.abs(multiplier) : 0;
        const showValue = isSubsidy
            ? displaySubsidy.toFixed(2)
            : (Number.isInteger(displayPct) ? displayPct : displayPct.toFixed(1));
        const population = popStructure[key] || 0;
        const hasPopulation = population > 0;

        return (
            <div key={key} className={`bg-gray-900/40 p-1.5 rounded-md border text-xs flex flex-col gap-1 ${hasPopulation ? (isSubsidy ? 'border-green-700/60' : isTax ? 'border-yellow-700/60' : 'border-gray-700/60') : 'border-gray-800 opacity-60'}`}>
                <div className="flex items-center gap-1">
                    <Icon name={stratumInfo.icon || 'User'} size={14} className="text-gray-400" />
                    <span className="font-semibold text-gray-300 flex-grow">{stratumInfo.name || key}</span>
                    <span className="text-gray-500 text-xs font-mono">{formatNumberShortCN(Math.round(population), { decimals: 0 })} 人</span>
                </div>
                <div className="flex items-center justify-center gap-0.5">
                    {isSubsidy ? (
                        <><Icon name="TrendingDown" size={12} className="text-green-400" /><span className="font-mono text-green-300 whitespace-nowrap text-xs">补贴 {displaySubsidy.toFixed(2)} ₴/人/日</span></>
                    ) : isTax ? (
                        <><Icon name="TrendingUp" size={12} className="text-yellow-400" /><span className="font-mono text-yellow-300 whitespace-nowrap text-xs">收入 {showValue}%</span></>
                    ) : (<span className="font-mono text-gray-500 whitespace-nowrap text-xs">无税收</span>)}
                </div>
                <div className="flex items-center gap-1">
                    <button type="button" onClick={() => {
                        const newValue = isSubsidy ? headPercentToMultiplier(5) : -0.05;
                        onUpdateTaxPolicies(prev => ({ ...prev, headTaxRates: { ...(prev?.headTaxRates || {}), [key]: newValue } }));
                        setHeadDrafts(prev => { const next = { ...prev }; delete next[key]; return next; });
                    }} className={`btn-compact flex-shrink-0 w-5 h-5 border rounded text-xs font-bold flex items-center justify-center transition-colors ${isSubsidy ? 'bg-green-900/50 hover:bg-green-800/50 border-green-600 text-green-300' : 'bg-gray-700 hover:bg-gray-600 border-gray-500 text-gray-300'}`}>{isSubsidy ? '补' : '税'}</button>
                    <input type="text" inputMode="decimal" step={isSubsidy ? '0.01' : '1'} value={headDrafts[key] ?? showValue} onChange={(e) => handleHeadDraftChange(key, e.target.value)} onBlur={() => commitHeadDraft(key)} onKeyDown={(e) => { if (e.key === 'Enter') { commitHeadDraft(key); e.target.blur(); } }} className="flex-grow min-w-0 bg-gray-900/70 border border-gray-600 text-xs text-gray-200 rounded px-1 py-0 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-center" placeholder={isSubsidy ? '银币/人/日' : '税率%'} />
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

    // STRATA_GROUPS 是静态配置，只需计算一次
    const allGroupKeys = React.useMemo(() => new Set(Object.values(STRATA_GROUPS).flatMap(g => g.keys)), []);

    return (
        <div className="space-y-4">
            {/* Navigation Tabs */}
            <div className="flex items-center gap-2 text-sm rounded-full glass-ancient border border-ancient-gold/30 p-1 shadow-metal-sm">
                <button
                    className={`w-1/3 py-2 rounded-full border-2 transition-all ${activeSection === 'government'
                        ? 'bg-ancient-gold/20 border-ancient-gold/70 text-ancient-parchment shadow-gold-metal'
                        : 'border-transparent text-ancient-stone hover:text-ancient-parchment'}`}
                    onClick={() => { trackSubTabSwitch('politics', 'government'); setActiveSection('government'); }}
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
                    onClick={() => { trackSubTabSwitch('politics', 'tax'); setActiveSection('tax'); }}
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
                    onClick={() => { trackSubTabSwitch('politics', 'officials'); setActiveSection('officials'); }}
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
                <div className="glass-ancient p-3 rounded-lg border border-ancient-gold/30">
                    <h3 className="text-xs font-bold mb-2 flex items-center gap-1.5 text-gray-300 font-decorative">
                        <Icon name="DollarSign" size={14} className="text-yellow-400" />
                        税收政策调节
                        <button
                            onClick={() => setShowTaxBatch(true)}
                            className="ml-auto flex items-center gap-1 px-2 py-1 bg-yellow-800/40 hover:bg-yellow-700/50 border border-yellow-600/40 text-yellow-300 text-xs rounded-lg font-semibold transition-colors active:scale-95"
                            title="批量统一设置所有税率"
                        >
                            <Icon name="Zap" size={11} />
                            批量设置
                        </button>
                    </h3>
                    <div className="flex flex-nowrap gap-1.5 mb-3 border-b border-gray-700 overflow-x-auto scrollbar-thin">
                        <button onClick={() => { trackSubTabSwitch('politics', 'tax_head'); setActiveTaxTab('head'); }} className={`flex-1 min-w-[80px] px-3 py-1.5 text-xs font-semibold transition-all ${activeTaxTab === 'head' ? 'text-yellow-300 border-b-2 border-yellow-400' : 'text-gray-400 hover:text-gray-300'}`}><div className="flex items-center gap-1.5"><Icon name="Users" size={12} />人头税</div></button>
                        <button onClick={() => { trackSubTabSwitch('politics', 'tax_resource'); setActiveTaxTab('resource'); }} className={`flex-1 min-w-[80px] px-3 py-1.5 text-xs font-semibold transition-all ${activeTaxTab === 'resource' ? 'text-blue-300 border-b-2 border-blue-400' : 'text-gray-400 hover:text-gray-300'}`}><div className="flex items-center gap-1.5"><Icon name="Package" size={12} />交易税</div></button>
                        <button onClick={() => { trackSubTabSwitch('politics', 'tax_business'); setActiveTaxTab('business'); }} className={`flex-1 min-w-[80px] px-3 py-1.5 text-xs font-semibold transition-all ${activeTaxTab === 'business' ? 'text-green-300 border-b-2 border-green-400' : 'text-gray-400 hover:text-gray-300'}`}><div className="flex items-center gap-1.5"><Icon name="Building" size={12} />营业税</div></button>
                    </div>

                    {activeTaxTab === 'head' && (
                        <div className="space-y-3">
                            <details className="bg-blue-900/20 border border-blue-500/30 p-2 rounded-lg text-xs text-blue-100">
                                <summary className="flex items-center gap-2 cursor-pointer"><Icon name="Info" size={12} className="text-blue-400" /><span className="font-semibold">人头税说明</span></summary>
                                <p className="mt-1">按阶层日均收入的比例征收。税额 = 日均收入 × 税率% × 税收修正。税率越高税收越多，但影响满意度。负值为补贴。</p>
                            </details>
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
                        <div className="space-y-3">
                            <details className="bg-blue-900/20 border border-blue-500/30 p-2 rounded-lg text-xs text-blue-100">
                                <summary className="flex items-center gap-2 cursor-pointer"><Icon name="Info" size={12} className="text-blue-400" /><span className="font-semibold">交易税说明</span></summary>
                                <p className="mt-1">正值征税，负值补贴。仅对有供应的资源生效。</p>
                            </details>
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
                        <div className="space-y-3">
                            <details className="bg-blue-900/20 border border-blue-500/30 p-2 rounded-lg text-xs text-blue-100">
                                <summary className="flex items-center gap-2 cursor-pointer"><Icon name="Info" size={12} className="text-blue-400" /><span className="font-semibold">营业税说明</span></summary>
                                <p className="mt-1"><b>正数 = 税率(%)</b>：按建筑营业收入的比例征收。例如 50 = 收取产值的 50%。<br/><b>负数 = 补贴(🪙/栋)</b>：从国库直接给每栋建筑发放固定补贴。例如 -50 = 每栋每次产出补贴 50🪙。</p>
                            </details>
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
                                                    displayPercent={bizRateToDisplay(businessRates[building.id])}
                                                    buildingCount={buildings[building.id] || 0}
                                                    draftPercent={businessDrafts[building.id]}
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

            {/* 税收批量设置底部面板 */}
            <TaxBatchSheet
                isOpen={showTaxBatch}
                onClose={() => setShowTaxBatch(false)}
                strataToDisplay={strataToDisplay}
                taxableResourceKeys={taxableResources.map(([key]) => key)}
                builtBuildingIds={builtBuildings.map(b => b.id)}
                onUpdateTaxPolicies={onUpdateTaxPolicies}
                headBaseRate={headBaseRate}
                headPercentToMultiplier={headPercentToMultiplier}
                bizDisplayToRate={bizDisplayToRate}
            />

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
                        generals={generals}
                        onChangeOfficialPolicy={changeOfficialPropertyPolicy}
                    />
                ) : (
<div className="glass-ancient p-4 rounded-lg border border-ancient-gold/30 text-center">
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
