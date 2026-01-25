/**
 * 兵团管理面板组件
 * 允许玩家创建、管理和指挥兵团
 */

import React, { useState, useMemo, useCallback } from 'react';
import { Icon } from '../common/UIComponents';
import { formatNumberShortCN } from '../../utils/numberFormat';
import { UNIT_TYPES } from '../../config/militaryUnits';
import { CORPS_STATES } from '../../config/frontlineConfig';
import {
    calculateRecruitWeaponCost,
    canAffordWeaponCost,
    getWeaponSupplyStatus,
} from '../../config/militaryWeapons';

/**
 * 兵团管理面板
 */
export const CorpsManagementPanel = ({
    frontlineMap,
    playerArmy = {},
    playerResources = {},
    playerId,
    onCreateCorps,
    onDisbandCorps,
    onIssueCommand,
    selectedCorps,
    onSelectCorps,
}) => {
    const [isCreating, setIsCreating] = useState(false);
    const [newCorpsName, setNewCorpsName] = useState('');
    const [unitAllocation, setUnitAllocation] = useState({});
    const [selectedCommand, setSelectedCommand] = useState(null);

    if (!frontlineMap || !frontlineMap.active) {
        return null;
    }

    const playerCorps = useMemo(() =>
        frontlineMap.corps.filter(c => c.owner === playerId),
        [frontlineMap.corps, playerId]
    );

    const canCreateMore = playerCorps.length < frontlineMap.maxCorps;

    // 可用于分配的单位
    const availableUnits = useMemo(() => {
        const result = {};
        Object.entries(playerArmy).forEach(([unitType, count]) => {
            // 减去已分配到其他兵团的单位
            let allocated = 0;
            playerCorps.forEach(corps => {
                allocated += corps.units[unitType] || 0;
            });
            // 减去正在创建中分配的单位
            allocated += unitAllocation[unitType] || 0;
            result[unitType] = Math.max(0, count - allocated);
        });
        return result;
    }, [playerArmy, playerCorps, unitAllocation]);

    // 计算武器供应状态
    const weaponSupply = useMemo(() => {
        const totalArmy = {};
        playerCorps.forEach(corps => {
            Object.entries(corps.units).forEach(([unitType, count]) => {
                totalArmy[unitType] = (totalArmy[unitType] || 0) + count;
            });
        });
        return getWeaponSupplyStatus(playerResources, totalArmy, 30);
    }, [playerCorps, playerResources]);

    // 开始创建兵团
    const startCreating = useCallback(() => {
        setIsCreating(true);
        setNewCorpsName(`第${playerCorps.length + 1}军团`);
        setUnitAllocation({});
    }, [playerCorps.length]);

    // 取消创建
    const cancelCreating = useCallback(() => {
        setIsCreating(false);
        setNewCorpsName('');
        setUnitAllocation({});
    }, []);

    // 调整单位分配
    const adjustAllocation = useCallback((unitType, delta) => {
        setUnitAllocation(prev => {
            const current = prev[unitType] || 0;
            const available = availableUnits[unitType] || 0;
            const newValue = Math.max(0, Math.min(available + current, current + delta));

            if (newValue === 0) {
                const { [unitType]: _, ...rest } = prev;
                return rest;
            }
            return { ...prev, [unitType]: newValue };
        });
    }, [availableUnits]);

    // 快速全选单位
    const allocateAll = useCallback((unitType) => {
        const available = availableUnits[unitType] || 0;
        if (available > 0) {
            setUnitAllocation(prev => ({ ...prev, [unitType]: (prev[unitType] || 0) + available }));
        }
    }, [availableUnits]);

    // 确认创建兵团
    const confirmCreate = useCallback(() => {
        if (!newCorpsName.trim() || Object.keys(unitAllocation).length === 0) return;

        onCreateCorps?.(newCorpsName.trim(), unitAllocation);
        cancelCreating();
    }, [newCorpsName, unitAllocation, onCreateCorps, cancelCreating]);

    // 渲染单位选择器
    const renderUnitSelector = () => {
        const unitTypes = Object.keys(playerArmy).filter(k => playerArmy[k] > 0);

        if (unitTypes.length === 0) {
            return (
                <div className="text-xs text-gray-500 text-center py-4">
                    没有可用部队
                </div>
            );
        }

        return (
            <div className="space-y-2">
                {unitTypes.map(unitType => {
                    const unitInfo = UNIT_TYPES[unitType];
                    const available = availableUnits[unitType] || 0;
                    const allocated = unitAllocation[unitType] || 0;

                    return (
                        <div
                            key={unitType}
                            className="flex items-center gap-2 p-2 bg-gray-900/30 rounded-lg"
                        >
                            <Icon
                                name={unitInfo?.icon || 'Users'}
                                size={16}
                                className="text-gray-400"
                            />
                            <div className="flex-1 min-w-0">
                                <div className="text-xs text-gray-300 truncate">
                                    {unitInfo?.name || unitType}
                                </div>
                                <div className="text-[10px] text-gray-500">
                                    可用: {available + allocated}
                                </div>
                            </div>
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={() => adjustAllocation(unitType, -10)}
                                    disabled={allocated <= 0}
                                    className="w-6 h-6 rounded bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                                >
                                    <span className="text-xs text-gray-300">-</span>
                                </button>
                                <span className="w-10 text-center text-xs font-bold text-amber-400">
                                    {allocated}
                                </span>
                                <button
                                    onClick={() => adjustAllocation(unitType, 10)}
                                    disabled={available <= 0}
                                    className="w-6 h-6 rounded bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                                >
                                    <span className="text-xs text-gray-300">+</span>
                                </button>
                                <button
                                    onClick={() => allocateAll(unitType)}
                                    disabled={available <= 0}
                                    className="ml-1 px-1.5 h-6 rounded bg-blue-700 hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-[10px] text-white"
                                    title="全部分配"
                                >
                                    全部
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    };

    // 渲染创建面板
    const renderCreatePanel = () => {
        if (!isCreating) return null;

        const totalAllocated = Object.values(unitAllocation).reduce((a, b) => a + b, 0);

        return (
            <div className="p-3 bg-amber-900/20 rounded-lg border border-amber-700/50 mb-3">
                <h4 className="text-xs font-semibold text-amber-300 mb-3 flex items-center gap-1.5">
                    <Icon name="Plus" size={12} />
                    创建新兵团
                </h4>

                {/* 名称输入 */}
                <div className="mb-3">
                    <label className="text-[10px] text-gray-500 mb-1 block">兵团名称</label>
                    <input
                        type="text"
                        value={newCorpsName}
                        onChange={(e) => setNewCorpsName(e.target.value)}
                        className="w-full px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-xs text-gray-200 focus:outline-none focus:border-amber-500"
                        placeholder="输入兵团名称..."
                    />
                </div>

                {/* 单位选择 */}
                <div className="mb-3">
                    <label className="text-[10px] text-gray-500 mb-1 block">分配部队</label>
                    {renderUnitSelector()}
                </div>

                {/* 统计 */}
                <div className="flex items-center justify-between mb-3 p-2 bg-gray-800/50 rounded">
                    <span className="text-xs text-gray-400">总兵力</span>
                    <span className="text-sm font-bold text-amber-400">{totalAllocated}</span>
                </div>

                {/* 按钮 */}
                <div className="flex gap-2">
                    <button
                        onClick={cancelCreating}
                        className="flex-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-gray-700 hover:bg-gray-600 text-gray-300 transition-all"
                    >
                        取消
                    </button>
                    <button
                        onClick={confirmCreate}
                        disabled={totalAllocated === 0 || !newCorpsName.trim()}
                        className={`
                            flex-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all
                            ${totalAllocated > 0 && newCorpsName.trim()
                                ? 'bg-green-600 hover:bg-green-500 text-white'
                                : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                            }
                        `}
                    >
                        确认创建
                    </button>
                </div>
            </div>
        );
    };

    // 渲染兵团详情
    const renderCorpsDetail = () => {
        if (!selectedCorps) return null;

        const corps = selectedCorps;
        const stateInfo = CORPS_STATES[corps.state] || {};

        return (
            <div className="p-3 bg-gray-800/50 rounded-lg border border-gray-700/50 mb-3">
                <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-bold text-gray-200">{corps.name}</h4>
                    <span className={`text-[10px] px-2 py-0.5 rounded ${stateInfo.id === 'attacking'
                            ? 'bg-red-900/50 text-red-400 border border-red-700/30'
                            : stateInfo.id === 'defending'
                                ? 'bg-green-900/50 text-green-400 border border-green-700/30'
                                : 'bg-gray-700/50 text-gray-400 border border-gray-600/30'
                        }`}>
                        {stateInfo.icon} {stateInfo.name || corps.state}
                    </span>
                </div>

                {/* 状态条 */}
                <div className="grid grid-cols-2 gap-2 mb-3">
                    <div className="p-2 bg-gray-900/30 rounded">
                        <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] text-gray-500">士气</span>
                            <span className={`text-xs font-bold ${corps.morale >= 70 ? 'text-green-400' : corps.morale >= 40 ? 'text-yellow-400' : 'text-red-400'
                                }`}>{corps.morale}%</span>
                        </div>
                        <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                            <div
                                className={`h-full ${corps.morale >= 70 ? 'bg-green-500' : corps.morale >= 40 ? 'bg-yellow-500' : 'bg-red-500'
                                    }`}
                                style={{ width: `${corps.morale}%` }}
                            />
                        </div>
                    </div>
                    <div className="p-2 bg-gray-900/30 rounded">
                        <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] text-gray-500">补给</span>
                            <span className={`text-xs font-bold ${corps.supplies >= 70 ? 'text-green-400' : corps.supplies >= 40 ? 'text-yellow-400' : 'text-red-400'
                                }`}>{corps.supplies}%</span>
                        </div>
                        <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                            <div
                                className={`h-full ${corps.supplies >= 70 ? 'bg-green-500' : corps.supplies >= 40 ? 'bg-yellow-500' : 'bg-red-500'
                                    }`}
                                style={{ width: `${corps.supplies}%` }}
                            />
                        </div>
                    </div>
                </div>

                {/* 单位列表 */}
                <div className="mb-3">
                    <div className="text-[10px] text-gray-500 mb-1">编制</div>
                    <div className="space-y-1">
                        {Object.entries(corps.units).map(([unitType, count]) => {
                            const unitInfo = UNIT_TYPES[unitType];
                            return (
                                <div key={unitType} className="flex items-center gap-2 text-xs">
                                    <Icon name={unitInfo?.icon || 'Users'} size={12} className="text-gray-400" />
                                    <span className="text-gray-300">{unitInfo?.name || unitType}</span>
                                    <span className="text-gray-500">×</span>
                                    <span className="font-bold text-amber-400">{count}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* 命令按钮 */}
                <div className="grid grid-cols-2 gap-2">
                    <button
                        onClick={() => onIssueCommand?.(corps, 'defend')}
                        disabled={corps.state === 'defending'}
                        className={`
                            px-2 py-1.5 rounded text-xs font-semibold flex items-center justify-center gap-1
                            ${corps.state === 'defending'
                                ? 'bg-green-900/30 text-green-400 border border-green-700/30 cursor-default'
                                : 'bg-gray-700 hover:bg-gray-600 text-gray-300 transition-all'
                            }
                        `}
                    >
                        <Icon name="Shield" size={12} />
                        防守
                    </button>
                    <button
                        onClick={() => onIssueCommand?.(corps, 'retreat')}
                        disabled={corps.state === 'retreating'}
                        className={`
                            px-2 py-1.5 rounded text-xs font-semibold flex items-center justify-center gap-1
                            ${corps.state === 'retreating'
                                ? 'bg-gray-900/30 text-gray-400 border border-gray-700/30 cursor-default'
                                : 'bg-gray-700 hover:bg-gray-600 text-gray-300 transition-all'
                            }
                        `}
                    >
                        <Icon name="LogOut" size={12} />
                        撤退
                    </button>
                </div>

                {/* 解散按钮 */}
                <button
                    onClick={() => {
                        if (confirm(`确定要解散"${corps.name}"吗？部队将返回后备军。`)) {
                            onDisbandCorps?.(corps.id);
                        }
                    }}
                    className="w-full mt-2 px-2 py-1.5 rounded text-xs font-semibold bg-red-900/30 hover:bg-red-900/50 text-red-400 border border-red-700/30 transition-all"
                >
                    解散兵团
                </button>
            </div>
        );
    };

    // 渲染武器供应状态
    const renderWeaponSupply = () => {
        const { status, details } = weaponSupply;

        if (Object.keys(details).length === 0) return null;

        return (
            <div className={`p-2 rounded-lg border mb-3 ${status === 'normal'
                    ? 'bg-green-900/20 border-green-700/30'
                    : status === 'low'
                        ? 'bg-yellow-900/20 border-yellow-700/30'
                        : 'bg-red-900/20 border-red-700/30'
                }`}>
                <div className="flex items-center gap-1.5 mb-2">
                    <Icon
                        name={status === 'normal' ? 'CheckCircle' : status === 'low' ? 'AlertTriangle' : 'XCircle'}
                        size={12}
                        className={status === 'normal' ? 'text-green-400' : status === 'low' ? 'text-yellow-400' : 'text-red-400'}
                    />
                    <span className={`text-xs font-semibold ${status === 'normal' ? 'text-green-400' : status === 'low' ? 'text-yellow-400' : 'text-red-400'
                        }`}>
                        武器供应{status === 'normal' ? '充足' : status === 'low' ? '紧张' : '危机'}
                    </span>
                </div>
                <div className="space-y-1">
                    {Object.entries(details).map(([resource, info]) => (
                        <div key={resource} className="flex items-center justify-between text-[10px]">
                            <span className="text-gray-400">{resource}</span>
                            <span className={info.status === 'normal' ? 'text-green-400' : info.status === 'low' ? 'text-yellow-400' : 'text-red-400'}>
                                {info.daysRemaining}天储备
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    return (
        <div className="glass-ancient p-4 rounded-xl border border-ancient-gold/30">
            {/* 标题 */}
            <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold flex items-center gap-2 text-gray-300 font-decorative">
                    <Icon name="Users" size={16} className="text-blue-400" />
                    兵团管理
                </h3>
                <div className="text-[10px] text-gray-500">
                    {playerCorps.length}/{frontlineMap.maxCorps} 兵团
                </div>
            </div>

            {/* 武器供应状态 */}
            {renderWeaponSupply()}

            {/* 创建按钮 */}
            {!isCreating && canCreateMore && (
                <button
                    onClick={startCreating}
                    className="w-full mb-3 px-3 py-2 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white transition-all flex items-center justify-center gap-1.5"
                >
                    <Icon name="Plus" size={14} />
                    创建兵团
                </button>
            )}

            {!isCreating && !canCreateMore && (
                <div className="mb-3 p-2 bg-gray-800/50 rounded-lg border border-gray-700/50 text-xs text-gray-500 text-center">
                    已达到兵团上限
                </div>
            )}

            {/* 创建面板 */}
            {renderCreatePanel()}

            {/* 兵团详情 */}
            {renderCorpsDetail()}

            {/* 兵团列表（无选中时） */}
            {!selectedCorps && !isCreating && playerCorps.length > 0 && (
                <div className="space-y-2">
                    {playerCorps.map(corps => {
                        const stateInfo = CORPS_STATES[corps.state] || {};
                        const totalUnits = Object.values(corps.units).reduce((a, b) => a + b, 0);

                        return (
                            <button
                                key={corps.id}
                                onClick={() => onSelectCorps?.(corps)}
                                className="w-full p-2 rounded-lg bg-gray-800/50 border border-gray-700/50 hover:border-gray-600 transition-all text-left"
                            >
                                <div className="flex items-center justify-between mb-1">
                                    <span className="text-xs font-semibold text-gray-200">{corps.name}</span>
                                    <span className="text-[10px] text-gray-500">{stateInfo.name || corps.state}</span>
                                </div>
                                <div className="flex items-center gap-3 text-[10px] text-gray-500">
                                    <span>兵力: {totalUnits}</span>
                                    <span>士气: {corps.morale}%</span>
                                </div>
                            </button>
                        );
                    })}
                </div>
            )}

            {/* 空状态 */}
            {!isCreating && playerCorps.length === 0 && (
                <div className="text-center py-4">
                    <Icon name="Users" size={24} className="text-gray-600 mx-auto mb-2" />
                    <p className="text-xs text-gray-500 mb-2">尚未部署任何兵团</p>
                    <p className="text-[10px] text-gray-600">点击上方按钮创建兵团</p>
                </div>
            )}

            {/* 使用说明 */}
            <div className="mt-4 p-2 bg-gray-900/30 rounded-lg border border-gray-700/30">
                <h4 className="text-[10px] font-semibold text-gray-400 mb-2 flex items-center gap-1">
                    <Icon name="HelpCircle" size={10} />
                    操作说明
                </h4>
                <ul className="text-[10px] text-gray-500 space-y-1">
                    <li>1. 点击「创建兵团」按钮创建新兵团</li>
                    <li>2. 分配部队后点击「确认创建」</li>
                    <li>3. 切换到「战线地图」视图</li>
                    <li>4. 点击己方兵团（蓝色）选中</li>
                    <li>5. 点击目标格子：移动/攻击/围攻</li>
                </ul>
            </div>
        </div>
    );
};

export default CorpsManagementPanel;
