/**
 * 自由市场面板 - 右派主导时显示
 * 允许玩家设置业主可自主扩张的建筑类型
 */

import React, { useState } from 'react';
import { Icon } from '../../common/UIComponents';
import { STRATA } from '../../../config/strata';
import { BUILDINGS } from '../../../config/buildings';
import { calculateBuildingProfit } from '../../../logic/officials/cabinetSynergy';

/**
 * 计算建筑成本的银币等价值（使用实际市场价格）
 * @param {Object} baseCost - 建筑的 baseCost 对象
 * @param {Object} prices - 当前市场价格 { resource: price }
 * @returns {number} 银币等价成本
 */
const calculateSilverEquivalent = (baseCost, prices = {}) => {
    if (!baseCost) return 100;

    let totalCost = 0;
    for (const [resource, amount] of Object.entries(baseCost)) {
        // 使用市场价格，如果没有则使用默认值 1
        const price = prices[resource] ?? 1;
        totalCost += amount * price;
    }

    return totalCost > 0 ? Math.round(totalCost) : 100;
};

/**
 * 获取可扩张的建筑列表（有明确owner且有baseCost的建筑）
 * @param {Object} prices - 当前市场价格
 */
const getExpandableBuildings = (prices = {}) => {
    // BUILDINGS 是数组格式
    return BUILDINGS
        .filter(b => b.owner && b.baseCost && Object.keys(b.baseCost).length > 0)
        .map(b => ({
            ...b,
            baseCostRaw: b.baseCost, // 保留原始成本用于显示
            baseCostSilver: calculateSilverEquivalent(b.baseCost, prices),
            icon: b.visual?.icon || 'Building',
        }));
};

/**
 * 单个建筑扩张设置
 */
const BuildingExpansionRow = ({
    building,
    currentCount = 0,
    ownerWealth = 0,
    profit = 0,
    setting = { allowed: false },
    onChange,
    disabled,
}) => {
    const ownerDef = STRATA[building.owner];
    // 判断建筑是否盈利
    const isProfitable = profit > 0;

    return (
        <div className="flex items-center justify-between py-2 border-b border-gray-700/30 last:border-0">
            {/* 建筑名称 + 业主 */}
            <div className="flex items-center gap-2 flex-1">
                <Icon name={building.icon} size={16} className="text-amber-400" />
                <div>
                    <div className="text-xs text-gray-200">{building.name}</div>
                    <div className="text-[10px] text-gray-500">
                        {ownerDef?.name || building.owner}
                    </div>
                </div>
            </div>

            {/* 建筑盈利 */}
            <div className={`text-xs w-16 text-center ${isProfitable ? 'text-green-400' : 'text-red-400'}`}>
                {isProfitable ? '盈利' : '亏损'}
            </div>

            {/* 利润 */}
            <div className={`text-xs w-16 text-center ${isProfitable ? 'text-green-300' : 'text-red-300'}`}>
                {profit.toFixed(2)}
            </div>

            {/* 数量 */}
            <div className="text-xs text-gray-300 w-12 text-center">
                {currentCount}座
            </div>

            {/* 允许开关 */}
            <label className="flex items-center gap-1 cursor-pointer w-14">
                <input
                    type="checkbox"
                    checked={setting.allowed}
                    onChange={(e) => onChange(building.id, { ...setting, allowed: e.target.checked })}
                    disabled={disabled}
                    className="accent-amber-500"
                />
                <span className="text-xs text-gray-400">允许</span>
            </label>
        </div>
    );
};

/**
 * 自由市场面板
 */
export const FreeMarketPanel = ({
    buildingCounts = {},
    classWealth = {},
    expansionSettings = {},
    onUpdateSettings,
    recentExpansions = [],
    disabled = false,
    prices = {},  // [NEW] 接收市场价格
    market = {},  // [NEW] 接收完整市场数据（含 wages）
    taxPolicies = {}, // [NEW] 税收政策
}) => {
    const [localSettings, setLocalSettings] = useState(expansionSettings);
    const [hasChanges, setHasChanges] = useState(false);

    // 使用实际市场价格计算建筑成本
    const expandableBuildings = getExpandableBuildings(prices);
    const marketForProfit = {
        prices,
        wages: market?.wages || {}
    };

    // 处理设置变化
    const handleChange = (buildingId, newSetting) => {
        const updated = { ...localSettings, [buildingId]: newSetting };
        setLocalSettings(updated);
        setHasChanges(true);
    };

    // 应用设置
    const handleApply = () => {
        onUpdateSettings(localSettings);
        setHasChanges(false);
    };

    // 允许的建筑数量
    const allowedCount = Object.values(localSettings).filter(s => s.allowed).length;

    return (
        <div className="bg-gray-800/50 rounded-lg p-4 border border-amber-900/30">
            {/* 标题 */}
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <Icon name="TrendingUp" size={18} className="text-amber-400" />
                    <span className="text-sm font-bold text-amber-300">自由市场 - 业主扩张</span>
                </div>
                <span className="text-xs text-gray-500">
                    已允许 {allowedCount} 种建筑
                </span>
                <div className="flex gap-2">
                    <button
                        onClick={() => {
                            const newSettings = { ...localSettings };
                            expandableBuildings.forEach(b => {
                                newSettings[b.id] = { ...newSettings[b.id], allowed: true };
                            });
                            setLocalSettings(newSettings);
                            setHasChanges(true);
                        }}
                        className="px-2 py-0.5 text-[10px] bg-gray-700 hover:bg-gray-600 rounded text-gray-300"
                    >
                        全选
                    </button>
                    <button
                        onClick={() => {
                            const newSettings = { ...localSettings };
                            expandableBuildings.forEach(b => {
                                newSettings[b.id] = { ...newSettings[b.id], allowed: false };
                            });
                            setLocalSettings(newSettings);
                            setHasChanges(true);
                        }}
                        className="px-2 py-0.5 text-[10px] bg-gray-700 hover:bg-gray-600 rounded text-gray-300"
                    >
                        全不选
                    </button>
                </div>
            </div>

            {/* 说明 */}
            <p className="text-xs text-gray-500 mb-3">
                允许业主使用自有财富建造建筑，不消耗国库，不受数量成本惩罚。
            </p>

            {/* 建筑列表 */}
            <div className="space-y-0 max-h-64 overflow-y-auto">
                <div className="flex items-center justify-between py-1 border-b border-gray-700/50 text-[10px] text-gray-500 sticky top-0 bg-gray-800/80 backdrop-blur-sm z-10">
                    <div className="flex items-center gap-2 flex-1">
                        <span className="pl-6">建筑</span>
                    </div>
                    <div className="w-16 text-center">盈亏</div>
                    <div className="w-16 text-center">利润/天</div>
                    <div className="w-12 text-center">数量</div>
                    <div className="w-14 text-center">扩建</div>
                </div>
                {expandableBuildings.map(building => {
                    const profitResult = calculateBuildingProfit(building, marketForProfit, taxPolicies);
                    return (
                        <BuildingExpansionRow
                            key={building.id}
                            building={building}
                            currentCount={buildingCounts[building.id] || 0}
                            ownerWealth={classWealth[building.owner] || 0}
                        profit={profitResult.profit}
                        setting={localSettings[building.id] || { allowed: false }}
                            onChange={handleChange}
                            disabled={disabled}
                        />
                    );
                })}
            </div>

            {/* 最近扩张记录 */}
            {recentExpansions.length > 0 && (
                <div className="mt-3 p-2 bg-green-900/20 rounded border border-green-800/30">
                    <div className="text-xs text-green-400 font-bold mb-1">最近扩张</div>
                    {recentExpansions.slice(0, 3).map((exp, idx) => (
                        <div key={idx} className="text-[10px] text-green-300">
                            {BUILDINGS[exp.buildingId]?.name || exp.buildingId}
                            <span className="text-gray-500"> 由 {STRATA[exp.owner]?.name} 建造</span>
                        </div>
                    ))}
                </div>
            )}

            {/* 应用按钮 */}
            <button
                onClick={handleApply}
                disabled={disabled || !hasChanges}
                className={`
                    w-full mt-3 py-1.5 rounded text-xs font-bold flex items-center justify-center gap-1
                    ${!disabled && hasChanges
                        ? 'bg-amber-600 hover:bg-amber-500 text-white'
                        : 'bg-gray-700 text-gray-500 cursor-not-allowed'}
                `}
            >
                <Icon name="Check" size={12} />
                应用设置
            </button>
        </div>
    );
};

export default FreeMarketPanel;
