/**
 * 计划经济面板 - 左派主导时显示
 * 允许玩家设置各阶层的目标人口比例和政府价格管制
 */

import React, { useState, useMemo, useEffect } from 'react';
import { Icon } from '../../common/UIComponents';
import { STRATA } from '../../../config/strata';
import { RESOURCES } from '../../../config/gameConstants';

// 可调整的阶层（排除骑士和官员）
const ADJUSTABLE_STRATA = [
    'peasant', 'worker', 'artisan', 'merchant', 'landowner',
    'cleric', 'scribe', 'miner', 'engineer', 'capitalist', 'serf'
];

// 获取可交易资源列表
const getTradableResources = () => {
    return Object.entries(RESOURCES)
        .filter(([key, def]) => {
            if (key === 'silver') return false;
            if (!def || def.type === 'virtual') return false;
            return true;
        })
        .map(([key, def]) => ({ key, ...def }));
};

/**
 * 单个阶层配额滑块
 */
const QuotaSlider = ({ stratum, currentPercent, targetPercent, onChange, disabled }) => {
    const strataDef = STRATA[stratum];
    if (!strataDef) return null;

    const diff = targetPercent - currentPercent;
    const diffText = diff > 0 ? `+${diff.toFixed(1)}%` : diff < 0 ? `${diff.toFixed(1)}%` : '—';
    const diffColor = diff > 0 ? 'text-green-400' : diff < 0 ? 'text-red-400' : 'text-gray-500';

    return (
        <div className="flex items-center gap-2 py-1">
            <div className="w-20 flex items-center gap-1">
                <Icon name={strataDef.icon || 'User'} size={14} className="text-gray-400" />
                <span className="text-xs text-gray-300 truncate">{strataDef.name}</span>
            </div>

            <div className="flex-1 flex items-center gap-2">
                {/* 当前比例 */}
                <span className="text-xs text-gray-500 w-12 text-right">{currentPercent.toFixed(1)}%</span>

                {/* 滑块 */}
                <input
                    type="range"
                    min="0"
                    max="50"
                    step="1"
                    value={targetPercent}
                    onChange={(e) => onChange(stratum, parseFloat(e.target.value))}
                    disabled={disabled}
                    className="flex-1 h-1 accent-red-500 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                />

                {/* 目标比例 */}
                <span className="text-xs text-gray-200 w-12">{targetPercent.toFixed(0)}%</span>

                {/* 差值 */}
                <span className={`text-xs w-12 text-right ${diffColor}`}>{diffText}</span>
            </div>
        </div>
    );
};

/**
 * 单个资源价格控制行
 */
const PriceControlRow = ({ resourceKey, resourceDef, marketPrice, govBuyPrice, govSellPrice, onChange, disabled }) => {
    const name = resourceDef?.name || resourceKey;
    const icon = resourceDef?.icon || 'Package';

    // 标记与市场价的差异
    const buyDiff = govBuyPrice !== null ? govBuyPrice - marketPrice : 0;
    const sellDiff = govSellPrice !== null ? govSellPrice - marketPrice : 0;

    return (
        <div className="flex items-center gap-2 py-1.5 border-b border-gray-700/30 last:border-0">
            <div className="w-20 flex items-center gap-1 flex-shrink-0">
                <Icon name={icon} size={12} className="text-gray-400" />
                <span className="text-xs text-gray-300 truncate">{name}</span>
            </div>

            <div className="flex-1 flex items-center gap-1.5">
                {/* 市场价 */}
                <div className="w-14 text-center">
                    <span className="text-[10px] text-gray-500 block leading-none">市场</span>
                    <span className="text-xs text-gray-400 font-mono">{marketPrice.toFixed(2)}</span>
                </div>

                {/* 收购价输入 */}
                <div className="flex-1">
                    <span className="text-[9px] text-amber-400/70 block leading-none">收购价</span>
                    <input
                        type="number"
                        step="0.1"
                        min="0"
                        value={govBuyPrice !== null && govBuyPrice !== undefined ? govBuyPrice : ''}
                        onChange={(e) => onChange(resourceKey, 'buy', e.target.value === '' ? null : parseFloat(e.target.value))}
                        placeholder="—"
                        disabled={disabled}
                        className="w-full px-1 py-0.5 text-xs bg-gray-900/50 border border-amber-900/30 rounded text-amber-300 font-mono placeholder-gray-600 disabled:opacity-50"
                    />
                    {govBuyPrice !== null && buyDiff !== 0 && (
                        <span className={`text-[9px] ${buyDiff > 0 ? 'text-red-400' : 'text-green-400'}`}>
                            {buyDiff > 0 ? '+' : ''}{buyDiff.toFixed(2)}
                        </span>
                    )}
                </div>

                {/* 出售价输入 */}
                <div className="flex-1">
                    <span className="text-[9px] text-blue-400/70 block leading-none">出售价</span>
                    <input
                        type="number"
                        step="0.1"
                        min="0"
                        value={govSellPrice !== null && govSellPrice !== undefined ? govSellPrice : ''}
                        onChange={(e) => onChange(resourceKey, 'sell', e.target.value === '' ? null : parseFloat(e.target.value))}
                        placeholder="—"
                        disabled={disabled}
                        className="w-full px-1 py-0.5 text-xs bg-gray-900/50 border border-blue-900/30 rounded text-blue-300 font-mono placeholder-gray-600 disabled:opacity-50"
                    />
                    {govSellPrice !== null && sellDiff !== 0 && (
                        <span className={`text-[9px] ${sellDiff > 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {sellDiff > 0 ? '+' : ''}{sellDiff.toFixed(2)}
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
};

/**
 * 计划经济面板
 */
export const PlannedEconomyPanel = ({
    popStructure = {},
    quotaTargets = {},
    onUpdateQuotas,
    adminCost = 0,
    approvalPenalties = {},
    disabled = false,
    // 新增：价格管制相关 props
    priceControls = { enabled: false, governmentBuyPrices: {}, governmentSellPrices: {} },
    onUpdatePriceControls,
    marketPrices = {},
}) => {
    const [localTargets, setLocalTargets] = useState(quotaTargets);
    const [hasQuotaChanges, setHasQuotaChanges] = useState(false);

    // 价格管制本地状态
    const [localPriceControls, setLocalPriceControls] = useState(priceControls);
    const [hasPriceChanges, setHasPriceChanges] = useState(false);

    // 当前展开的面板
    const [expandedSection, setExpandedSection] = useState('quota'); // 'quota' | 'price'

    // 同步外部 priceControls 变化
    useEffect(() => {
        setLocalPriceControls(priceControls);
    }, [priceControls]);

    // 可交易资源列表
    const tradableResources = useMemo(() => getTradableResources(), []);

    // 计算当前人口分布
    const totalPop = useMemo(() =>
        Object.values(popStructure).reduce((a, b) => a + b, 0),
        [popStructure]
    );

    const currentDistribution = useMemo(() => {
        const dist = {};
        ADJUSTABLE_STRATA.forEach(s => {
            dist[s] = totalPop > 0 ? ((popStructure[s] || 0) / totalPop) * 100 : 0;
        });
        return dist;
    }, [popStructure, totalPop]);

    // 配额处理
    const handleQuotaChange = (stratum, value) => {
        const newTargets = { ...localTargets, [stratum]: value };
        setLocalTargets(newTargets);
        setHasQuotaChanges(true);
    };

    const handleApplyQuotas = () => {
        onUpdateQuotas(localTargets);
        setHasQuotaChanges(false);
    };

    const handleResetQuotas = () => {
        setLocalTargets({});
        setHasQuotaChanges(true);
    };

    // 价格管制处理
    const handlePriceToggle = () => {
        setLocalPriceControls(prev => ({
            ...prev,
            enabled: !prev.enabled
        }));
        setHasPriceChanges(true);
    };

    const handlePriceChange = (resourceKey, type, value) => {
        setLocalPriceControls(prev => {
            const key = type === 'buy' ? 'governmentBuyPrices' : 'governmentSellPrices';
            const newPrices = { ...prev[key] };
            if (value === null) {
                delete newPrices[resourceKey];
            } else {
                newPrices[resourceKey] = value;
            }
            return { ...prev, [key]: newPrices };
        });
        setHasPriceChanges(true);
    };

    const handleApplyPrices = () => {
        if (onUpdatePriceControls) {
            onUpdatePriceControls(localPriceControls);
        }
        setHasPriceChanges(false);
    };

    const handleResetPrices = () => {
        setLocalPriceControls({
            enabled: false,
            governmentBuyPrices: {},
            governmentSellPrices: {}
        });
        setHasPriceChanges(true);
    };

    // 计算总目标比例
    const totalTarget = Object.values(localTargets).reduce((a, b) => a + b, 0);
    const isQuotaValid = totalTarget <= 100;

    // 统计已设置的价格数量
    const priceCount = Object.keys(localPriceControls.governmentBuyPrices || {}).length
        + Object.keys(localPriceControls.governmentSellPrices || {}).length;

    return (
        <div className="space-y-3">
            {/* 阶层配额面板 */}
            <div className="bg-gray-800/50 rounded-lg border border-red-900/30 overflow-hidden">
                {/* 标题栏 - 可点击展开/收起 */}
                <button
                    onClick={() => setExpandedSection(expandedSection === 'quota' ? null : 'quota')}
                    className="w-full flex items-center justify-between p-3 hover:bg-gray-700/30 transition-colors"
                >
                    <div className="flex items-center gap-2">
                        <Icon name="BarChart3" size={18} className="text-red-400" />
                        <span className="text-sm font-bold text-red-300">阶层配额</span>
                    </div>
                    <div className="flex items-center gap-2">
                        {adminCost > 0 && (
                            <span className="text-xs text-amber-400">
                                每日成本: {adminCost}银
                            </span>
                        )}
                        <Icon
                            name={expandedSection === 'quota' ? 'ChevronUp' : 'ChevronDown'}
                            size={16}
                            className="text-gray-400"
                        />
                    </div>
                </button>

                {/* 展开内容 */}
                {expandedSection === 'quota' && (
                    <div className="px-3 pb-3 border-t border-gray-700/50">
                        <p className="text-xs text-gray-500 my-2">
                            设置目标人口比例，社会流动将加速向目标调整。
                        </p>

                        {/* 配额列表 */}
                        <div className="space-y-1 mb-3 max-h-48 overflow-y-auto">
                            {ADJUSTABLE_STRATA.filter(s => currentDistribution[s] > 0 || localTargets[s]).map(stratum => (
                                <QuotaSlider
                                    key={stratum}
                                    stratum={stratum}
                                    currentPercent={currentDistribution[stratum]}
                                    targetPercent={localTargets[stratum] ?? currentDistribution[stratum]}
                                    onChange={handleQuotaChange}
                                    disabled={disabled}
                                />
                            ))}
                        </div>

                        {/* 总计 */}
                        <div className="flex items-center justify-between border-t border-gray-700/50 pt-2">
                            <div className="text-xs">
                                <span className="text-gray-500">目标总计: </span>
                                <span className={totalTarget > 100 ? 'text-red-400' : 'text-gray-300'}>
                                    {totalTarget.toFixed(0)}%
                                </span>
                                {!isQuotaValid && <span className="text-red-400 ml-2">超出100%！</span>}
                            </div>
                        </div>

                        {/* 按钮 */}
                        <div className="flex gap-2 mt-2">
                            <button
                                onClick={handleApplyQuotas}
                                disabled={disabled || !hasQuotaChanges || !isQuotaValid}
                                className={`flex-1 py-1.5 rounded text-xs font-bold flex items-center justify-center gap-1
                                    ${!disabled && hasQuotaChanges && isQuotaValid
                                        ? 'bg-red-600 hover:bg-red-500 text-white'
                                        : 'bg-gray-700 text-gray-500 cursor-not-allowed'}`}
                            >
                                <Icon name="Check" size={12} />
                                应用配额
                            </button>
                            <button
                                onClick={handleResetQuotas}
                                disabled={disabled}
                                className="px-3 py-1.5 rounded text-xs bg-gray-700 hover:bg-gray-600 text-gray-300"
                            >
                                重置
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* 价格管制面板 */}
            <div className="bg-gray-800/50 rounded-lg border border-amber-900/30 overflow-hidden">
                {/* 标题栏 */}
                <button
                    onClick={() => setExpandedSection(expandedSection === 'price' ? null : 'price')}
                    className="w-full flex items-center justify-between p-3 hover:bg-gray-700/30 transition-colors"
                >
                    <div className="flex items-center gap-2">
                        <Icon name="Scale" size={18} className="text-amber-400" />
                        <span className="text-sm font-bold text-amber-300">价格管制</span>
                        {localPriceControls.enabled && (
                            <span className="text-[10px] px-1.5 py-0.5 bg-amber-600/30 text-amber-300 rounded">
                                已启用
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        {priceCount > 0 && (
                            <span className="text-xs text-gray-400">{priceCount}项设置</span>
                        )}
                        <Icon
                            name={expandedSection === 'price' ? 'ChevronUp' : 'ChevronDown'}
                            size={16}
                            className="text-gray-400"
                        />
                    </div>
                </button>

                {/* 展开内容 */}
                {expandedSection === 'price' && (
                    <div className="px-3 pb-3 border-t border-gray-700/50">
                        {/* 启用开关 */}
                        <div className="flex items-center justify-between py-2">
                            <span className="text-xs text-gray-400">启用价格管制</span>
                            <button
                                onClick={handlePriceToggle}
                                disabled={disabled}
                                className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${localPriceControls.enabled ? 'bg-amber-600' : 'bg-gray-600'
                                    } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                            >
                                <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all duration-200 ${localPriceControls.enabled ? 'left-6' : 'left-1'
                                    }`} />
                            </button>
                        </div>

                        {/* 说明 */}
                        <p className="text-[10px] text-gray-500 mb-2">
                            设置政府收购价和出售价。收购价影响卖家收入，出售价影响买家支出。
                            差价由国库收支。交易税基于管制价格计算。
                        </p>

                        {/* 价格列表 */}
                        <div className="max-h-64 overflow-y-auto mb-2">
                            {tradableResources.map(res => (
                                <PriceControlRow
                                    key={res.key}
                                    resourceKey={res.key}
                                    resourceDef={res}
                                    marketPrice={marketPrices[res.key] || res.basePrice || 1}
                                    govBuyPrice={localPriceControls.governmentBuyPrices?.[res.key] ?? null}
                                    govSellPrice={localPriceControls.governmentSellPrices?.[res.key] ?? null}
                                    onChange={handlePriceChange}
                                    disabled={disabled || !localPriceControls.enabled}
                                />
                            ))}
                        </div>

                        {/* 按钮 */}
                        <div className="flex gap-2 mt-2">
                            <button
                                onClick={handleApplyPrices}
                                disabled={disabled || !hasPriceChanges}
                                className={`flex-1 py-1.5 rounded text-xs font-bold flex items-center justify-center gap-1
                                    ${!disabled && hasPriceChanges
                                        ? 'bg-amber-600 hover:bg-amber-500 text-white'
                                        : 'bg-gray-700 text-gray-500 cursor-not-allowed'}`}
                            >
                                <Icon name="Check" size={12} />
                                应用价格
                            </button>
                            <button
                                onClick={handleResetPrices}
                                disabled={disabled}
                                className="px-3 py-1.5 rounded text-xs bg-gray-700 hover:bg-gray-600 text-gray-300"
                            >
                                重置
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PlannedEconomyPanel;

