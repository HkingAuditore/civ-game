/**
 * 战线战斗面板
 * 取代旧的战斗系统，使用新的战线地图进行战争
 */

import React, { useState, useMemo, useCallback } from 'react';
import { Icon } from '../common/UIComponents';
import { formatNumberShortCN } from '../../utils/numberFormat';
import { FrontlineMapPanel } from '../panels/FrontlineMapPanel';
import { CorpsManagementPanel } from '../panels/CorpsManagementPanel';
import {
    frontlineManager,
    getWarStatusSummary,
} from '../../logic/diplomacy/frontlineIntegration';
import { calculateBattlePower } from '../../config/militaryUnits';

/**
 * 战线战斗标签内容
 */
export const FrontlineBattleSection = ({
    nations = [],
    army = {},
    resources = {},
    epoch = 0,
    playerId = 'player',
    militaryBonus = 0,
    onCreateCorps,
    onDisbandCorps,
    onIssueCommand,
}) => {
    const [selectedWarId, setSelectedWarId] = useState(null);
    const [selectedCorps, setSelectedCorps] = useState(null);
    const [selectedCell, setSelectedCell] = useState(null);
    const [viewMode, setViewMode] = useState('map'); // map, corps

    // 获取所有战争中的国家
    const warringNations = useMemo(() =>
        nations.filter(n => n.isAtWar && !n.vassalOf),
        [nations]
    );

    // 获取战争状态摘要
    const warStatus = useMemo(() =>
        getWarStatusSummary(playerId),
        [playerId]
    );

    // 获取当前选中的战线
    const currentFrontline = useMemo(() => {
        if (selectedWarId) {
            return frontlineManager.activeFrontlines.get(selectedWarId);
        }
        // 默认选择第一个活跃战线
        const activeFrontlines = frontlineManager.getActiveFrontlines();
        if (activeFrontlines.length > 0) {
            return activeFrontlines[0];
        }
        return null;
    }, [selectedWarId]);

    // 计算总兵力
    const totalUnits = useMemo(() =>
        Object.values(army).reduce((sum, count) => sum + count, 0),
        [army]
    );

    // 计算战力
    const playerPower = useMemo(() =>
        calculateBattlePower(army, epoch, militaryBonus),
        [army, epoch, militaryBonus]
    );

    // 处理兵团创建
    const handleCreateCorps = useCallback((name, units) => {
        if (!currentFrontline || !onCreateCorps) return;

        // 确定起始位置（玩家在左侧）
        const startX = 1;
        const startY = Math.floor(currentFrontline.height / 2);

        onCreateCorps(currentFrontline.warId, name, units, { x: startX, y: startY });
    }, [currentFrontline, onCreateCorps]);

    // 处理命令下达
    const handleIssueCommand = useCallback((corps, command) => {
        if (!currentFrontline || !onIssueCommand) return;
        onIssueCommand(currentFrontline.warId, corps.id, command);
    }, [currentFrontline, onIssueCommand]);

    // 没有战争时的显示
    if (warringNations.length === 0) {
        return (
            <div className="glass-ancient p-4 rounded-xl border border-ancient-gold/30">
                <h3 className="text-sm font-bold mb-3 flex items-center gap-2 text-gray-300 font-decorative">
                    <Icon name="Swords" size={16} className="text-red-400" />
                    战线系统
                </h3>
                <div className="p-6 rounded bg-gray-900/40 border border-gray-700 text-center">
                    <Icon name="Shield" size={32} className="text-gray-500 mx-auto mb-3" />
                    <p className="text-sm text-gray-400 mb-2">当前没有进行中的战争</p>
                    <p className="text-xs text-gray-500">
                        可在外交界面主动宣战，或等待敌国挑衅
                    </p>
                </div>

                {/* 军力概览 */}
                <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="bg-gray-800/50 p-3 rounded-lg">
                        <div className="flex items-center gap-2 mb-1">
                            <Icon name="Users" size={14} className="text-blue-400" />
                            <span className="text-xs text-gray-400">现役兵力</span>
                        </div>
                        <p className="text-lg font-bold text-white">{totalUnits}</p>
                    </div>
                    <div className="bg-gray-800/50 p-3 rounded-lg">
                        <div className="flex items-center gap-2 mb-1">
                            <Icon name="Zap" size={14} className="text-yellow-400" />
                            <span className="text-xs text-gray-400">战斗力</span>
                        </div>
                        <p className="text-lg font-bold text-white">{playerPower.toFixed(0)}</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* 战争概览 */}
            <div className="glass-ancient p-4 rounded-xl border border-ancient-gold/30">
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-bold flex items-center gap-2 text-gray-300 font-decorative">
                        <Icon name="Swords" size={16} className="text-red-400" />
                        战线系统
                    </h3>
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">
                            {warStatus.activeWars} 场战争进行中
                        </span>
                    </div>
                </div>

                {/* 战争选择器 */}
                {warringNations.length > 1 && (
                    <div className="mb-3">
                        <select
                            value={selectedWarId || ''}
                            onChange={(e) => setSelectedWarId(e.target.value || null)}
                            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-gray-200"
                        >
                            {warringNations.map(nation => {
                                const frontline = frontlineManager.getFrontline(playerId, nation.id);
                                return (
                                    <option key={nation.id} value={frontline?.warId || ''}>
                                        与 {nation.name} 的战争
                                        {frontline && ` (第${frontline.daysSinceStart}天)`}
                                    </option>
                                );
                            })}
                        </select>
                    </div>
                )}

                {/* 当前战争状态 */}
                {warringNations.length === 1 && (
                    <div className="bg-gray-800/50 p-3 rounded-lg mb-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Icon name="Flag" size={14} className="text-red-400" />
                                <span className="text-sm text-gray-200">
                                    与 <span className="font-bold">{warringNations[0].name}</span> 交战中
                                </span>
                            </div>
                            <span className={`text-sm font-bold ${(warringNations[0].warScore || 0) > 20
                                    ? 'text-green-400'
                                    : (warringNations[0].warScore || 0) < -20
                                        ? 'text-red-400'
                                        : 'text-gray-300'
                                }`}>
                                战争分数: {warringNations[0].warScore || 0}
                            </span>
                        </div>
                    </div>
                )}

                {/* 军力概览 */}
                <div className="grid grid-cols-3 gap-3">
                    <div className="bg-gray-800/50 p-2 rounded">
                        <div className="text-[10px] text-gray-500">现役兵力</div>
                        <div className="text-sm font-bold text-white">{totalUnits}</div>
                    </div>
                    <div className="bg-gray-800/50 p-2 rounded">
                        <div className="text-[10px] text-gray-500">战斗力</div>
                        <div className="text-sm font-bold text-yellow-400">{playerPower.toFixed(0)}</div>
                    </div>
                    <div className="bg-gray-800/50 p-2 rounded">
                        <div className="text-[10px] text-gray-500">已部署兵团</div>
                        <div className="text-sm font-bold text-blue-400">
                            {currentFrontline?.corps.filter(c => c.owner === playerId).length || 0}
                            /{currentFrontline?.maxCorps || '-'}
                        </div>
                    </div>
                </div>
            </div>

            {/* 视图切换 */}
            <div className="flex items-center gap-2 text-sm">
                <button
                    onClick={() => setViewMode('map')}
                    className={`flex-1 py-2 rounded-lg border transition-all flex items-center justify-center gap-1.5 ${viewMode === 'map'
                            ? 'bg-red-900/40 border-red-700/50 text-red-200'
                            : 'bg-gray-800/50 border-gray-700/50 text-gray-400 hover:text-gray-200'
                        }`}
                >
                    <Icon name="Map" size={14} />
                    战线地图
                </button>
                <button
                    onClick={() => setViewMode('corps')}
                    className={`flex-1 py-2 rounded-lg border transition-all flex items-center justify-center gap-1.5 ${viewMode === 'corps'
                            ? 'bg-blue-900/40 border-blue-700/50 text-blue-200'
                            : 'bg-gray-800/50 border-gray-700/50 text-gray-400 hover:text-gray-200'
                        }`}
                >
                    <Icon name="Users" size={14} />
                    兵团管理
                </button>
            </div>

            {/* 战线地图 */}
            {viewMode === 'map' && currentFrontline && (
                <FrontlineMapPanel
                    frontlineMap={currentFrontline}
                    playerId={playerId}
                    onSelectCell={setSelectedCell}
                    onSelectCorps={setSelectedCorps}
                    selectedCorps={selectedCorps}
                    selectedCell={selectedCell}
                />
            )}

            {/* 兵团管理 */}
            {viewMode === 'corps' && currentFrontline && (
                <CorpsManagementPanel
                    frontlineMap={currentFrontline}
                    playerArmy={army}
                    playerResources={resources}
                    playerId={playerId}
                    onCreateCorps={handleCreateCorps}
                    onDisbandCorps={onDisbandCorps}
                    onIssueCommand={handleIssueCommand}
                    selectedCorps={selectedCorps}
                    onSelectCorps={setSelectedCorps}
                />
            )}

            {/* 没有战线地图时的提示 */}
            {!currentFrontline && warringNations.length > 0 && (
                <div className="glass-ancient p-4 rounded-xl border border-ancient-gold/30">
                    <div className="text-center py-6">
                        <Icon name="Loader" size={32} className="text-amber-400 mx-auto mb-3 animate-spin" />
                        <p className="text-sm text-gray-300 mb-2">正在生成战线地图...</p>
                        <p className="text-xs text-gray-500">
                            战线地图将在下个游戏日生成
                        </p>
                    </div>
                </div>
            )}

            {/* 战争分数说明 */}
            <div className="glass-ancient p-3 rounded-xl border border-ancient-gold/30">
                <h4 className="text-xs font-bold text-gray-400 mb-2 flex items-center gap-1.5">
                    <Icon name="Info" size={12} />
                    战争分数说明
                </h4>
                <div className="grid grid-cols-2 gap-2 text-[10px]">
                    <div className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-green-500" />
                        <span className="text-gray-400">50+ = 优势，可要求赔款</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-emerald-500" />
                        <span className="text-gray-400">100+ = 大胜，可索取割地</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-gray-500" />
                        <span className="text-gray-400">±25 = 僵持状态</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-red-500" />
                        <span className="text-gray-400">-50以下 = 需支付赔款</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default FrontlineBattleSection;
