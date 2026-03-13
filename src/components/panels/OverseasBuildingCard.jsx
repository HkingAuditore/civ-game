/**
 * 海外建筑卡片组件
 * 显示单个海外投资建筑的状态和操作
 */

import React, { memo } from 'react';
import { Icon } from '../common/UIComponents';
import { BUILDINGS, RESOURCES } from '../../config';
import { formatNumberShortCN } from '../../utils/numberFormat';
import { OVERSEAS_INVESTMENT_CONFIGS } from '../../logic/diplomacy/overseasInvestment';

// 运营模式配置
const OPERATING_MODE_CONFIG = {
    local: { name: '当地运营', icon: '🏠', color: 'text-green-400', bgColor: 'bg-green-900/30' },
    dumping: { name: '倾销模式', icon: '📦', color: 'text-orange-400', bgColor: 'bg-orange-900/30' },
    buyback: { name: '回购模式', icon: '🚢', color: 'text-blue-400', bgColor: 'bg-blue-900/30' },
};

// 阶层配置
const STRATUM_CONFIG = {
    capitalist: { name: '资本家', icon: '🏭', color: 'text-purple-400' },
    merchant: { name: '商人', icon: '🛒', color: 'text-amber-400' },
    landowner: { name: '地主', icon: '🌾', color: 'text-green-400' },
};

/**
 * 海外建筑卡片（紧凑版）
 */
export const OverseasBuildingCard = memo(({
    investment,
    nationName,
    onClick,
    onWithdraw,
    onModeChange,
    isExpanded = false,
}) => {
    const building = BUILDINGS.find(b => b.id === investment.buildingId);
    const mode = OPERATING_MODE_CONFIG[investment.operatingMode] || OPERATING_MODE_CONFIG.local;
    const stratum = STRATUM_CONFIG[investment.ownerStratum] || STRATUM_CONFIG.capitalist;
    const operatingData = investment.operatingData || {};
    const dailyProfit = operatingData.profit || 0;
    const monthlyProfit = dailyProfit * 30;

    if (!building) return null;

    return (
        <div
            className={`rounded-lg border transition-all cursor-pointer ${isExpanded
                    ? 'border-amber-400/50 bg-amber-900/30'
                    : 'border-gray-700/50 bg-gray-800/30 hover:bg-gray-700/30 hover:border-gray-600/50'
                }`}
            onClick={onClick}
        >
            {/* 紧凑视图 */}
            <div className="p-3">
                <div className="flex items-start justify-between gap-2">
                    {/* 建筑信息 */}
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                        <div className={`w-8 h-8 rounded flex items-center justify-center ${building.visual?.color || 'bg-gray-700'}`}>
                            <Icon name={building.visual?.icon || 'Building'} size={16} className={building.visual?.text || 'text-gray-200'} />
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="text-sm font-semibold text-white truncate">{building.name}</div>
                            <div className="flex items-center gap-2 text-xs">
                                <span className={stratum.color}>{stratum.icon} {stratum.name}</span>
                                <span className={`${mode.color} ${mode.bgColor} px-1.5 py-0.5 rounded`}>
                                    {mode.icon} {mode.name}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* 利润显示 */}
                    <div className="text-right">
                        <div className={`text-sm font-bold ${dailyProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {dailyProfit >= 0 ? '+' : ''}{dailyProfit.toFixed(1)}/日
                        </div>
                        <div className="text-xs text-gray-400">
                            月利: {formatNumberShortCN(monthlyProfit)}
                        </div>
                    </div>
                </div>
            </div>

            {/* 展开的详情视图 */}
            {isExpanded && (
                <div className="border-t border-gray-700/50 p-3 space-y-3">
                    {/* 运营数据 */}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="bg-gray-900/40 rounded p-2">
                            <div className="text-gray-400">产出价值</div>
                            <div className="text-green-400 font-semibold">{(operatingData.outputValue || 0).toFixed(1)}/日</div>
                        </div>
                        <div className="bg-gray-900/40 rounded p-2">
                            <div className="text-gray-400">投入成本</div>
                            <div className="text-red-400 font-semibold">{(operatingData.inputCost || 0).toFixed(1)}/日</div>
                        </div>
                        <div className="bg-gray-900/40 rounded p-2">
                            <div className="text-gray-400">工资成本</div>
                            <div className="text-orange-400 font-semibold">{(operatingData.wageCost || 0).toFixed(1)}/日</div>
                        </div>
                        <div className="bg-gray-900/40 rounded p-2">
                            <div className="text-gray-400">投资额</div>
                            <div className="text-amber-400 font-semibold">{formatNumberShortCN(investment.investmentAmount || 0)}</div>
                        </div>
                    </div>

                    {/* 建筑投入产出 */}
                    <div className="text-xs bg-gray-900/30 rounded p-2">
                        {building.input && Object.keys(building.input).length > 0 && (
                            <div className="flex items-center gap-1 mb-1">
                                <span className="text-red-400">投入:</span>
                                <span className="text-gray-300">
                                    {Object.entries(building.input).map(([r, v]) =>
                                        `${RESOURCES[r]?.name || r}×${v}`
                                    ).join(', ')}
                                </span>
                            </div>
                        )}
                        <div className="flex items-center gap-1">
                            <span className="text-green-400">产出:</span>
                            <span className="text-gray-300">
                                {Object.entries(building.output || {})
                                    .filter(([k]) => !['maxPop', 'militaryCapacity'].includes(k))
                                    .map(([r, v]) => `${RESOURCES[r]?.name || r}×${v}`)
                                    .join(', ')}
                            </span>
                        </div>
                    </div>

                    {/* 运营模式切换 */}
                    <div>
                        <div className="text-xs text-gray-400 mb-1">切换运营模式:</div>
                        <div className="flex gap-1">
                            {Object.entries(OPERATING_MODE_CONFIG).map(([modeId, config]) => (
                                <button
                                    key={modeId}
                                    className={`flex-1 px-2 py-1.5 rounded text-xs transition-all ${investment.operatingMode === modeId
                                            ? `${config.bgColor} ${config.color} border border-current`
                                            : 'bg-gray-700/50 text-gray-400 hover:bg-gray-600/50'
                                        }`}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (onModeChange && investment.operatingMode !== modeId) {
                                            onModeChange(investment.id, modeId);
                                        }
                                    }}
                                >
                                    {config.icon} {config.name}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* 操作按钮 */}
                    <div className="flex gap-2">
                        <button
                            className="flex-1 px-3 py-1.5 rounded text-xs bg-red-900/50 text-red-300 hover:bg-red-800/50 border border-red-700/50"
                            onClick={(e) => {
                                e.stopPropagation();
                                if (onWithdraw) onWithdraw(investment.id);
                            }}
                        >
                            撤回投资 (-20%违约金)
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
});

OverseasBuildingCard.displayName = 'OverseasBuildingCard';

export default OverseasBuildingCard;
