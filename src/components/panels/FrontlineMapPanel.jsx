/**
 * 战线地图面板组件
 * 显示战线地图、兵团位置、建筑状态和战争信息
 */

import React, { useState, useMemo, useCallback } from 'react';
import { Icon } from '../common/UIComponents';
import {
    TERRAIN_TYPES,
    FRONTLINE_BUILDING_TYPES,
    CORPS_STATES,
} from '../../config/frontlineConfig';

// 地形图标映射
const TERRAIN_ICONS = {
    plain: { icon: 'Wheat', color: 'text-green-400', bg: 'bg-green-900/30' },
    forest: { icon: 'Trees', color: 'text-emerald-400', bg: 'bg-emerald-900/40' },
    mountain: { icon: 'Mountain', color: 'text-stone-400', bg: 'bg-stone-800/50' },
    river: { icon: 'Waves', color: 'text-blue-400', bg: 'bg-blue-900/40' },
    road: { icon: 'Route', color: 'text-amber-400', bg: 'bg-amber-900/20' },
    marsh: { icon: 'Droplets', color: 'text-teal-400', bg: 'bg-teal-900/30' },
};

// 建筑图标映射
const BUILDING_ICONS = {
    farm: { icon: 'Wheat', color: 'text-yellow-400' },
    mine: { icon: 'Pickaxe', color: 'text-stone-400' },
    workshop: { icon: 'Hammer', color: 'text-orange-400' },
    market: { icon: 'Store', color: 'text-purple-400' },
    barracks: { icon: 'Shield', color: 'text-red-400' },
    housing: { icon: 'Home', color: 'text-blue-400' },
    fortress: { icon: 'Castle', color: 'text-gray-300' },
    town_center: { icon: 'Landmark', color: 'text-amber-400' },
};

/**
 * 战线地图面板
 */
export const FrontlineMapPanel = ({
    frontlineMap,
    playerId,
    onSelectCell,
    onSelectCorps,
    onIssueCommand,
    selectedCorps,
    selectedCell,
}) => {
    const [viewMode, setViewMode] = useState('terrain'); // terrain, control, threat
    const [showGrid, setShowGrid] = useState(true);

    if (!frontlineMap || !frontlineMap.active) {
        return (
            <div className="glass-ancient p-4 rounded-xl border border-ancient-gold/30">
                <div className="flex items-center gap-2 text-gray-400">
                    <Icon name="AlertCircle" size={16} />
                    <span className="text-sm">当前没有进行中的战争</span>
                </div>
            </div>
        );
    }

    const {
        warId,
        scaleName,
        width,
        height,
        terrain,
        buildings,
        corps,
        warScore,
        warExhaustion,
        daysSinceStart,
        areaControl,
        participants,
    } = frontlineMap;

    const enemyId = participants.find(p => p !== playerId);
    const playerControl = areaControl[playerId] || 0;
    const enemyControl = areaControl[enemyId] || 0;

    // 构建位置索引
    const buildingsByPosition = useMemo(() => {
        const map = {};
        buildings.forEach(b => {
            map[`${b.position.x},${b.position.y}`] = b;
        });
        return map;
    }, [buildings]);

    const corpsByPosition = useMemo(() => {
        const map = {};
        corps.forEach(c => {
            const key = `${c.position.x},${c.position.y}`;
            if (!map[key]) map[key] = [];
            map[key].push(c);
        });
        return map;
    }, [corps]);

    const hexSize = 18;
    const hexWidth = hexSize * 2;
    const hexHeight = Math.sqrt(3) * hexSize;
    const hexXSpacing = hexSize * 1.5;
    const hexYSpacing = hexHeight;

    const mapPixelSize = useMemo(() => {
        const pixelWidth = hexWidth + (width - 1) * hexXSpacing;
        const pixelHeight = hexHeight * (height + (width - 1) / 2);
        return { width: pixelWidth, height: pixelHeight };
    }, [width, height, hexWidth, hexXSpacing, hexHeight]);

    const getHexPosition = useCallback((x, y) => {
        const left = x * hexXSpacing;
        const top = hexHeight * (y + x / 2);
        return { left, top };
    }, [hexXSpacing, hexHeight]);

    const handleCellClick = useCallback((x, y) => {
        const cellKey = `${x},${y}`;
        const cellCorps = corpsByPosition[cellKey] || [];
        const building = buildingsByPosition[cellKey];
        const playerCorpsHere = cellCorps.filter(c => c.owner === playerId);
        const enemyCorpsHere = cellCorps.filter(c => c.owner !== playerId);

        onSelectCell?.({ x, y });

        if (playerCorpsHere.length > 0) {
            if (!selectedCorps || selectedCorps.id !== playerCorpsHere[0].id) {
                onSelectCorps?.(playerCorpsHere[0]);
                return;
            }
        }

        if (!selectedCorps || selectedCorps.owner !== playerId) return;
        if (selectedCorps.position.x === x && selectedCorps.position.y === y) return;

        if (enemyCorpsHere.length > 0) {
            onIssueCommand?.(selectedCorps, 'attack', enemyCorpsHere[0]);
            return;
        }

        if (building && building.owner !== playerId) {
            onIssueCommand?.(selectedCorps, 'siege', building);
            return;
        }

        onIssueCommand?.(selectedCorps, 'move', { position: { x, y } });
    }, [corpsByPosition, buildingsByPosition, selectedCorps, playerId, onSelectCell, onSelectCorps, onIssueCommand]);

    // 渲染单个格子
    const renderCell = useCallback((x, y) => {
        const terrainType = terrain[y]?.[x] || 'plain';
        const terrainConfig = TERRAIN_ICONS[terrainType] || TERRAIN_ICONS.plain;
        const building = buildingsByPosition[`${x},${y}`];
        const cellCorps = corpsByPosition[`${x},${y}`] || [];

        const isSelected = selectedCell?.x === x && selectedCell?.y === y;
        const hasPlayerCorps = cellCorps.some(c => c.owner === playerId);
        const hasEnemyCorps = cellCorps.some(c => c.owner !== playerId);
        const isSelectableCorps = cellCorps.some(c => c.owner === playerId);
        const { left, top } = getHexPosition(x, y);

        return (
            <button
                key={`${x},${y}`}
                onClick={() => handleCellClick(x, y)}
                className={`
                    absolute flex items-center justify-center
                    border border-gray-700/50 transition-all
                    ${terrainConfig.bg}
                    ${isSelected ? 'ring-2 ring-amber-400 z-10' : ''}
                    ${isSelectableCorps ? 'cursor-pointer' : ''}
                    hover:brightness-125 hover:z-10
                `}
                style={{
                    width: `${hexWidth}px`,
                    height: `${hexHeight}px`,
                    left: `${left}px`,
                    top: `${top}px`,
                    clipPath: 'polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)',
                }}
            >
                {/* 地形图标 */}
                {showGrid && !building && cellCorps.length === 0 && (
                    <Icon
                        name={terrainConfig.icon}
                        size={12}
                        className={`${terrainConfig.color} opacity-30`}
                    />
                )}

                {/* 建筑 */}
                {building && (
                    <div className={`
                        absolute inset-0.5 rounded-sm flex items-center justify-center
                        ${building.owner === playerId
                            ? 'bg-blue-900/60 border border-blue-500/50'
                            : 'bg-red-900/60 border border-red-500/50'
                        }
                    `}>
                        <Icon
                            name={BUILDING_ICONS[building.type]?.icon || 'Building'}
                            size={14}
                            className={BUILDING_ICONS[building.type]?.color || 'text-gray-400'}
                        />
                        {/* 血量条 */}
                        <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-900">
                            <div
                                className={`h-full ${building.owner === playerId ? 'bg-green-500' : 'bg-red-500'}`}
                                style={{ width: `${(building.health / building.maxHealth) * 100}%` }}
                            />
                        </div>
                    </div>
                )}

                {/* 兵团 */}
                {cellCorps.length > 0 && (
                    <div className="absolute -top-1 -right-1 flex gap-0.5">
                        {hasPlayerCorps && (
                            <div className="w-3 h-3 rounded-full bg-blue-500 border border-blue-300 flex items-center justify-center">
                                <Icon name="Users" size={8} className="text-white" />
                            </div>
                        )}
                        {hasEnemyCorps && (
                            <div className="w-3 h-3 rounded-full bg-red-500 border border-red-300 flex items-center justify-center">
                                <Icon name="Users" size={8} className="text-white" />
                            </div>
                        )}
                    </div>
                )}
            </button>
        );
    }, [terrain, buildingsByPosition, corpsByPosition, selectedCell, playerId, showGrid, getHexPosition, hexWidth, hexHeight, handleCellClick]);

    // 渲染战争状态栏
    const renderWarStatus = () => {
        const warScoreColor = warScore > 20
            ? 'text-green-400'
            : warScore < -20
                ? 'text-red-400'
                : 'text-gray-300';

        return (
            <div className="flex flex-wrap items-center gap-3 mb-3 p-2 bg-gray-800/50 rounded-lg border border-gray-700/50">
                {/* 战争规模 */}
                <div className="flex items-center gap-1.5">
                    <Icon name="Swords" size={14} className="text-red-400" />
                    <span className="text-xs text-gray-300">{scaleName}</span>
                </div>

                {/* 战争天数 */}
                <div className="flex items-center gap-1.5">
                    <Icon name="Calendar" size={14} className="text-amber-400" />
                    <span className="text-xs text-gray-300">第{daysSinceStart}天</span>
                </div>

                {/* 战争分数 */}
                <div className="flex items-center gap-1.5">
                    <Icon name="Trophy" size={14} className={warScoreColor} />
                    <span className={`text-xs font-bold ${warScoreColor}`}>
                        {warScore > 0 ? '+' : ''}{warScore}
                    </span>
                </div>

                {/* 区域控制 */}
                <div className="flex-1 min-w-[120px]">
                    <div className="flex items-center justify-between text-[10px] text-gray-400 mb-0.5">
                        <span>己方 {(playerControl * 100).toFixed(0)}%</span>
                        <span>敌方 {(enemyControl * 100).toFixed(0)}%</span>
                    </div>
                    <div className="relative h-1.5 bg-gray-700 rounded-full overflow-hidden">
                        <div
                            className="absolute left-0 h-full bg-blue-500"
                            style={{ width: `${playerControl * 100}%` }}
                        />
                        <div
                            className="absolute right-0 h-full bg-red-500"
                            style={{ width: `${enemyControl * 100}%` }}
                        />
                    </div>
                </div>
            </div>
        );
    };

    // 渲染兵团列表
    const renderCorpsList = () => {
        const playerCorps = corps.filter(c => c.owner === playerId);

        return (
            <div className="mt-3 p-2 bg-gray-800/50 rounded-lg border border-gray-700/50">
                <div className="flex items-center justify-between mb-2">
                    <h4 className="text-xs font-semibold text-gray-300 flex items-center gap-1.5">
                        <Icon name="Users" size={12} className="text-blue-400" />
                        我方兵团
                    </h4>
                    <span className="text-[10px] text-gray-500">
                        {playerCorps.length}/{frontlineMap.maxCorps}
                    </span>
                </div>

                {playerCorps.length === 0 ? (
                    <div className="text-xs text-gray-500 text-center py-2">
                        尚未部署兵团
                    </div>
                ) : (
                    <div className="space-y-1.5">
                        {playerCorps.map(c => (
                            <button
                                key={c.id}
                                onClick={() => onSelectCorps?.(c)}
                                className={`
                                    w-full p-2 rounded-lg border transition-all text-left
                                    ${selectedCorps?.id === c.id
                                        ? 'bg-blue-900/40 border-blue-500/50'
                                        : 'bg-gray-900/30 border-gray-700/50 hover:border-gray-600'
                                    }
                                `}
                            >
                                <div className="flex items-center justify-between mb-1">
                                    <span className="text-xs font-semibold text-gray-200">{c.name}</span>
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${CORPS_STATES[c.state]?.id === 'attacking'
                                            ? 'bg-red-900/50 text-red-400'
                                            : CORPS_STATES[c.state]?.id === 'defending'
                                                ? 'bg-green-900/50 text-green-400'
                                                : 'bg-gray-700/50 text-gray-400'
                                        }`}>
                                        {CORPS_STATES[c.state]?.name || c.state}
                                    </span>
                                </div>
                                <div className="flex items-center gap-3 text-[10px] text-gray-500">
                                    <span>兵力: {Object.values(c.units).reduce((a, b) => a + b, 0)}</span>
                                    <span>士气: {c.morale}%</span>
                                    <span>补给: {c.supplies}%</span>
                                </div>
                            </button>
                        ))}
                    </div>
                )}
            </div>
        );
    };

    // 渲染选中格子信息
    const renderCellInfo = () => {
        if (!selectedCell) return null;

        const { x, y } = selectedCell;
        const terrainType = terrain[y]?.[x] || 'plain';
        const terrainInfo = TERRAIN_TYPES[terrainType];
        const building = buildingsByPosition[`${x},${y}`];
        const cellCorps = corpsByPosition[`${x},${y}`] || [];

        return (
            <div className="mt-3 p-2 bg-gray-800/50 rounded-lg border border-gray-700/50">
                <h4 className="text-xs font-semibold text-gray-300 mb-2 flex items-center gap-1.5">
                    <Icon name="MapPin" size={12} className="text-amber-400" />
                    位置 ({x}, {y})
                </h4>

                {/* 地形信息 */}
                <div className="flex items-center gap-2 mb-2 p-1.5 bg-gray-900/30 rounded">
                    <Icon name={TERRAIN_ICONS[terrainType]?.icon || 'Map'} size={14} className={TERRAIN_ICONS[terrainType]?.color} />
                    <div>
                        <div className="text-xs text-gray-300">{terrainInfo?.name || '未知'}</div>
                        <div className="text-[10px] text-gray-500">
                            移动消耗: ×{terrainInfo?.movementCost?.toFixed(1) || 1}
                            {terrainInfo?.defenseBonus !== 0 && (
                                <span className={terrainInfo?.defenseBonus > 0 ? 'text-green-400' : 'text-red-400'}>
                                    {' '}防御: {terrainInfo?.defenseBonus > 0 ? '+' : ''}{(terrainInfo?.defenseBonus * 100).toFixed(0)}%
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {/* 建筑信息 */}
                {building && (
                    <div className={`mb-2 p-1.5 rounded border ${building.owner === playerId
                            ? 'bg-blue-900/20 border-blue-700/30'
                            : 'bg-red-900/20 border-red-700/30'
                        }`}>
                        <div className="flex items-center gap-2">
                            <Icon
                                name={BUILDING_ICONS[building.type]?.icon || 'Building'}
                                size={14}
                                className={BUILDING_ICONS[building.type]?.color}
                            />
                            <div className="flex-1">
                                <div className="text-xs text-gray-300">
                                    {FRONTLINE_BUILDING_TYPES[building.type]?.name || building.type}
                                    {building.sourceName && (
                                        <span className="text-gray-500 ml-1">({building.sourceName})</span>
                                    )}
                                </div>
                                <div className="text-[10px] text-gray-500">
                                    血量: {Math.floor(building.health)}/{building.maxHealth}
                                </div>
                            </div>
                            <span className={`text-[10px] px-1 py-0.5 rounded ${building.owner === playerId
                                    ? 'bg-blue-900/50 text-blue-400'
                                    : 'bg-red-900/50 text-red-400'
                                }`}>
                                {building.owner === playerId ? '己方' : '敌方'}
                            </span>
                        </div>
                    </div>
                )}

                {/* 兵团信息 */}
                {cellCorps.length > 0 && (
                    <div className="space-y-1">
                        {cellCorps.map(c => (
                            <div
                                key={c.id}
                                className={`p-1.5 rounded border ${c.owner === playerId
                                        ? 'bg-blue-900/20 border-blue-700/30'
                                        : 'bg-red-900/20 border-red-700/30'
                                    }`}
                            >
                                <div className="flex items-center justify-between">
                                    <span className="text-xs text-gray-300">{c.name}</span>
                                    <span className={`text-[10px] ${c.owner === playerId ? 'text-blue-400' : 'text-red-400'}`}>
                                        {c.owner === playerId ? '己方' : '敌方'}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="glass-ancient p-4 rounded-xl border border-ancient-gold/30">
            {/* 标题 */}
            <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold flex items-center gap-2 text-gray-300 font-decorative">
                    <Icon name="Map" size={16} className="text-red-400" />
                    战线地图
                </h3>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setShowGrid(!showGrid)}
                        className={`p-1.5 rounded ${showGrid ? 'bg-gray-700' : 'bg-gray-800'} hover:bg-gray-600 transition-all`}
                    >
                        <Icon name="Grid3x3" size={14} className="text-gray-400" />
                    </button>
                </div>
            </div>

            {/* 战争状态 */}
            {renderWarStatus()}
            <div className="text-[10px] text-gray-500 mb-2">
                选中己方兵团后点击六边形：空地移动 / 敌军攻击 / 敌方建筑围攻
            </div>

            {/* 地图网格 */}
            <div className="overflow-x-auto pb-2">
                <div className="inline-block border border-gray-600 rounded">
                    <div
                        className="relative"
                        style={{
                            width: `${mapPixelSize.width}px`,
                            height: `${mapPixelSize.height}px`,
                        }}
                    >
                        {Array.from({ length: height }).map((_, y) =>
                            Array.from({ length: width }).map((_, x) => renderCell(x, y))
                        )}
                    </div>
                </div>
            </div>

            {/* 图例 */}
            <div className="mt-3 flex flex-wrap gap-2 text-[10px] text-gray-500">
                <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded-full bg-blue-500" />
                    <span>己方兵团</span>
                </div>
                <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded-full bg-red-500" />
                    <span>敌方兵团</span>
                </div>
                <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded bg-blue-900/60 border border-blue-500/50" />
                    <span>己方建筑</span>
                </div>
                <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded bg-red-900/60 border border-red-500/50" />
                    <span>敌方建筑</span>
                </div>
            </div>

            {/* 兵团列表 */}
            {renderCorpsList()}

            {/* 选中格子信息 */}
            {renderCellInfo()}
        </div>
    );
};

export default FrontlineMapPanel;
