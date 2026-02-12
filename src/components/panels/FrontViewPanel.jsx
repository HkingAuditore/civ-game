/**
 * FrontViewPanel - Active war fronts view
 * Shows front status, resource nodes, infrastructure, and corps deployment
 */
import React, { useMemo, memo } from 'react';
import { Icon } from '../common/UIComponents';
import { RESOURCES } from '../../config';
import { getCorpsTotalUnits, getCorpsGeneral } from '../../logic/diplomacy/corpsSystem';
import { getPlayerSide, getEnemySide, calculateFrontEconomicImpact } from '../../logic/diplomacy/frontSystem';
import { formatNumberShortCN } from '../../utils/numberFormat';

const FrontViewPanel = ({
    activeFronts = [],
    activeBattles = [],
    militaryCorps = [],
    generals = [],
    nations = [],
    onAssignCorpsToFront,
    onRemoveCorpsFromFront,
}) => {
    // Only show player-involved fronts
    const playerFronts = useMemo(() =>
        activeFronts.filter(f => f.status === 'active' && (f.attackerId === 'player' || f.defenderId === 'player')),
        [activeFronts]
    );

    const getNationName = (id) => {
        if (id === 'player') return '我国';
        const nation = nations.find(n => n.id === id);
        return nation?.name || id;
    };

    if (playerFronts.length === 0) {
        return (
            <div className="glass-ancient p-4 rounded-lg border border-ancient-gold/20 text-center text-sm text-gray-400">
                <Icon name="MapPin" size={32} className="mx-auto mb-2 text-gray-600" />
                <p>当前没有活跃战线</p>
                <p className="text-xs mt-1">与其他国家开战时会自动生成战线</p>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {playerFronts.map(front => {
                const playerSide = getPlayerSide(front);
                const enemySide = getEnemySide(playerSide);
                const enemyId = playerSide === 'attacker' ? front.defenderId : front.attackerId;
                const enemyName = getNationName(enemyId);

                const playerCorpsIds = front.assignedCorps[playerSide] || [];
                const enemyCorpsIds = front.assignedCorps[enemySide] || [];
                const playerCorpsList = militaryCorps.filter(c => playerCorpsIds.includes(c.id));
                const undeployedCorps = militaryCorps.filter(c =>
                    !c.assignedFrontId && c.status === 'idle' && getCorpsTotalUnits(c) > 0
                );

                // Resource nodes summary
                const playerNodes = front.resourceNodes.filter(n => n.owner !== enemyId);
                const enemyNodes = front.resourceNodes.filter(n => n.owner === enemyId);
                const plunderedCount = enemyNodes.filter(n => n.plundered).length;

                // Infrastructure summary
                const playerInfra = front.infrastructure.filter(i => i.owner !== enemyId);
                const enemyInfra = front.infrastructure.filter(i => i.owner === enemyId);
                const destroyedCount = enemyInfra.filter(i => i.destroyed).length;

                // Economic impact
                const impact = calculateFrontEconomicImpact(front, 'player');

                // Active battles on this front
                const frontBattles = activeBattles.filter(b => b.frontId === front.id && b.status === 'active');

                return (
                    <div key={front.id} className="glass-ancient p-3 rounded-lg border border-red-900/40">
                        {/* Front Header */}
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="text-sm font-bold flex items-center gap-2 text-red-300 font-decorative">
                                <Icon name="MapPin" size={16} className="text-red-400" />
                                对{enemyName}战线
                            </h3>
                            {frontBattles.length > 0 && (
                                <span className="text-xs px-2 py-0.5 bg-orange-900/40 border border-orange-500/30 rounded text-orange-300 animate-pulse">
                                    {frontBattles.length}场战斗进行中
                                </span>
                            )}
                        </div>

                        {/* Force comparison */}
                        <div className="grid grid-cols-2 gap-2 mb-2">
                            <div className="bg-blue-900/20 rounded p-2">
                                <p className="text-[10px] text-blue-300 mb-1">我方兵力</p>
                                <p className="text-sm font-bold text-blue-200">
                                    {playerCorpsList.reduce((s, c) => s + getCorpsTotalUnits(c), 0)} 单位
                                </p>
                                <p className="text-[10px] text-gray-400">{playerCorpsList.length} 军团</p>
                            </div>
                            <div className="bg-red-900/20 rounded p-2">
                                <p className="text-[10px] text-red-300 mb-1">敌方兵力</p>
                                <p className="text-sm font-bold text-red-200">
                                    {enemyCorpsIds.length} 军团
                                </p>
                                <p className="text-[10px] text-gray-400">估计</p>
                            </div>
                        </div>

                        {/* Resource Nodes */}
                        <div className="bg-gray-900/30 rounded p-2 mb-2">
                            <p className="text-[10px] text-gray-400 mb-1">
                                战线资源点 (敌方: {plunderedCount}/{enemyNodes.length} 被掠夺)
                            </p>
                            <div className="flex flex-wrap gap-1">
                                {front.resourceNodes.map(node => (
                                    <span
                                        key={node.id}
                                        className={`text-[10px] px-1.5 py-0.5 rounded ${node.plundered
                                            ? 'bg-gray-800 text-gray-600 line-through'
                                            : node.owner === enemyId
                                                ? 'bg-red-900/30 text-red-300'
                                                : 'bg-blue-900/30 text-blue-300'
                                            }`}
                                        title={`${node.desc}: ${RESOURCES[node.resource]?.name || node.resource} ${node.amount}/${node.maxAmount}`}
                                    >
                                        {node.desc} ({RESOURCES[node.resource]?.name || node.resource})
                                    </span>
                                ))}
                            </div>
                        </div>

                        {/* Infrastructure */}
                        <div className="bg-gray-900/30 rounded p-2 mb-2">
                            <p className="text-[10px] text-gray-400 mb-1">
                                战线设施 (敌方: {destroyedCount}/{enemyInfra.length} 被摧毁)
                            </p>
                            <div className="flex flex-wrap gap-1">
                                {front.infrastructure.map(infra => {
                                    const healthPct = infra.maxDurability > 0 ? Math.round(infra.durability / infra.maxDurability * 100) : 0;
                                    return (
                                        <span
                                            key={infra.id}
                                            className={`text-[10px] px-1.5 py-0.5 rounded ${infra.destroyed
                                                ? 'bg-gray-800 text-gray-600 line-through'
                                                : infra.owner === enemyId
                                                    ? 'bg-red-900/30 text-red-300'
                                                    : 'bg-blue-900/30 text-blue-300'
                                                }`}
                                            title={`${infra.name}: ${infra.desc} (耐久: ${healthPct}%)`}
                                        >
                                            {infra.name} {!infra.destroyed && `${healthPct}%`}
                                        </span>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Economic Impact */}
                        {(impact.productionPenalty > 0 || impact.supplyBonus > 0) && (
                            <div className="bg-gray-900/30 rounded p-2 mb-2 text-[10px]">
                                <p className="text-gray-400 mb-1">经济影响:</p>
                                {impact.productionPenalty > 0 && (
                                    <span className="text-red-400 mr-2">产出 -{(impact.productionPenalty * 100).toFixed(0)}%</span>
                                )}
                                {impact.supplyBonus > 0 && (
                                    <span className="text-green-400 mr-2">补给 +{(impact.supplyBonus * 100).toFixed(0)}%</span>
                                )}
                                {impact.defenseBonus > 0 && (
                                    <span className="text-blue-400">防御 +{(impact.defenseBonus * 100).toFixed(0)}%</span>
                                )}
                            </div>
                        )}

                        {/* Deployed Corps */}
                        <div className="space-y-1 mb-2">
                            <p className="text-[10px] text-gray-400">已部署军团:</p>
                            {playerCorpsList.length === 0 ? (
                                <p className="text-[10px] text-gray-500 italic pl-2">无军团部署到此战线</p>
                            ) : (
                                playerCorpsList.map(corps => {
                                    const gen = getCorpsGeneral(generals, corps.id);
                                    return (
                                        <div key={corps.id} className="flex items-center justify-between bg-gray-900/40 rounded px-2 py-1">
                                            <div className="flex items-center gap-2 text-xs">
                                                <Icon name="Shield" size={10} className="text-ancient-gold" />
                                                <span className="text-ancient-parchment">{corps.name}</span>
                                                <span className="text-gray-500">({getCorpsTotalUnits(corps)}单位)</span>
                                                {gen && <span className="text-yellow-400 text-[10px]">⭐{gen.name}</span>}
                                            </div>
                                            <button
                                                className="text-[10px] px-1.5 py-0.5 bg-gray-700 rounded text-gray-400 hover:text-white"
                                                onClick={() => onRemoveCorpsFromFront?.(front.id, corps.id, playerSide)}
                                            >
                                                撤回
                                            </button>
                                        </div>
                                    );
                                })
                            )}
                        </div>

                        {/* Deploy more corps */}
                        {undeployedCorps.length > 0 && (
                            <div className="border-t border-gray-700 pt-2">
                                <p className="text-[10px] text-gray-400 mb-1">增派军团:</p>
                                <div className="flex flex-wrap gap-1">
                                    {undeployedCorps.map(corps => (
                                        <button
                                            key={corps.id}
                                            className="text-[10px] px-2 py-1 bg-blue-900/30 border border-blue-500/20 rounded text-blue-300 hover:bg-blue-900/50"
                                            onClick={() => onAssignCorpsToFront?.(front.id, corps.id, playerSide)}
                                        >
                                            + {corps.name} ({getCorpsTotalUnits(corps)})
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
};

export default memo(FrontViewPanel);
