/**
 * ActiveBattlePanel - Shows ongoing battles with real-time status and tactical controls
 * Displayed as a floating panel when battles are in progress
 */
import React, { useMemo, memo } from 'react';
import { Icon } from '../common/UIComponents';
import { UNIT_TYPES } from '../../config/militaryUnits';
import { TACTICS, getBattleStatusText, isBattleActive } from '../../logic/diplomacy/battleSystem';
import { formatNumberShortCN } from '../../utils/numberFormat';

const ActiveBattlePanel = ({
    activeBattles = [],
    onSetTactic,       // (battleId, side, tacticId) => void
    onOrderRetreat,    // (battleId, side) => void
}) => {
    const ongoingBattles = useMemo(() =>
        activeBattles.filter(b => isBattleActive(b)),
        [activeBattles]
    );

    if (ongoingBattles.length === 0) return null;

    return (
        <div className="space-y-2">
            {ongoingBattles.map(battle => {
                const { attacker, defender, momentum, currentRound, maxRounds, battleType, typeName } = battle;

                // Determine player side (always check both)
                const isPlayerAttacker = true; // Simplified: player is always involved in displayed battles
                const playerSide = attacker;
                const enemySide = defender;

                const playerUnits = Object.values(playerSide.currentUnits).reduce((s, c) => s + c, 0);
                const enemyUnits = Object.values(enemySide.currentUnits).reduce((s, c) => s + c, 0);
                const playerInitial = Object.values(playerSide.initialUnits).reduce((s, c) => s + c, 0);
                const enemyInitial = Object.values(enemySide.initialUnits).reduce((s, c) => s + c, 0);

                const roundProgress = maxRounds > 0 ? (currentRound / maxRounds) * 100 : 0;
                const momentumText = momentum > 55 ? '攻方优势' : momentum < 45 ? '守方优势' : '胶着';
                const momentumColor = momentum > 60 ? 'text-blue-400' : momentum < 40 ? 'text-red-400' : 'text-yellow-400';

                // Last round log
                const lastLog = battle.roundLog?.[battle.roundLog.length - 1];

                return (
                    <div key={battle.id} className="glass-ancient p-3 rounded-lg border border-orange-900/40">
                        {/* Battle header */}
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                                <Icon name="Swords" size={14} className="text-orange-400 animate-pulse" />
                                <span className="text-xs font-bold text-orange-200">{typeName}</span>
                                <span className="text-[10px] text-gray-400">
                                    第{currentRound}/{maxRounds}回合
                                </span>
                            </div>
                            <span className="text-[10px] text-gray-500">{getBattleStatusText(battle)}</span>
                        </div>

                        {/* Progress bar */}
                        <div className="w-full bg-gray-800 rounded-full h-1.5 mb-2">
                            <div
                                className="bg-orange-500 h-1.5 rounded-full transition-all"
                                style={{ width: `${roundProgress}%` }}
                            />
                        </div>

                        {/* Momentum bar */}
                        <div className="mb-2">
                            <div className="flex justify-between text-[10px] mb-0.5">
                                <span className="text-blue-300">攻方</span>
                                <span className={momentumColor}>{momentumText} ({Math.round(momentum)}/100)</span>
                                <span className="text-red-300">守方</span>
                            </div>
                            <div className="w-full bg-red-900/40 rounded-full h-2 relative">
                                <div
                                    className="bg-blue-500/70 h-2 rounded-l-full transition-all"
                                    style={{ width: `${momentum}%` }}
                                />
                            </div>
                        </div>

                        {/* Force comparison */}
                        <div className="grid grid-cols-2 gap-2 mb-2">
                            <div className="bg-blue-900/20 rounded p-1.5">
                                <div className="flex justify-between text-[10px]">
                                    <span className="text-blue-300">{playerSide.corpsName || '我方'}</span>
                                    <span className="text-gray-400">士气: <span className={playerSide.morale > 60 ? 'text-green-400' : playerSide.morale > 30 ? 'text-yellow-400' : 'text-red-400'}>{Math.round(playerSide.morale)}</span></span>
                                </div>
                                <div className="text-sm font-bold text-blue-200">
                                    {playerUnits}<span className="text-[10px] text-gray-500">/{playerInitial}</span>
                                </div>
                                {playerSide.generalName && (
                                    <div className="text-[10px] text-yellow-400">⭐ {playerSide.generalName}</div>
                                )}
                            </div>
                            <div className="bg-red-900/20 rounded p-1.5">
                                <div className="flex justify-between text-[10px]">
                                    <span className="text-red-300">{enemySide.corpsName || '敌方'}</span>
                                    <span className="text-gray-400">士气: <span className={enemySide.morale > 60 ? 'text-green-400' : enemySide.morale > 30 ? 'text-yellow-400' : 'text-red-400'}>{Math.round(enemySide.morale)}</span></span>
                                </div>
                                <div className="text-sm font-bold text-red-200">
                                    {enemyUnits}<span className="text-[10px] text-gray-500">/{enemyInitial}</span>
                                </div>
                                {enemySide.generalName && (
                                    <div className="text-[10px] text-yellow-400">⭐ {enemySide.generalName}</div>
                                )}
                            </div>
                        </div>

                        {/* Last round events */}
                        {lastLog && (
                            <div className="bg-gray-900/30 rounded p-1.5 mb-2 text-[10px] text-gray-400">
                                {lastLog.events?.map((evt, i) => (
                                    <p key={i}>{evt}</p>
                                ))}
                            </div>
                        )}

                        {/* Tactical controls */}
                        <div className="border-t border-gray-700 pt-2">
                            <p className="text-[10px] text-gray-400 mb-1">
                                当前战术: <span className="text-ancient-parchment">{TACTICS[playerSide.tactic]?.name || '正常作战'}</span>
                            </p>
                            <div className="flex gap-1 flex-wrap">
                                {Object.entries(TACTICS).map(([id, tactic]) => (
                                    <button
                                        key={id}
                                        className={`px-2 py-1 text-[10px] rounded border transition-all ${playerSide.tactic === id
                                            ? 'bg-ancient-gold/20 border-ancient-gold/50 text-ancient-parchment'
                                            : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-white hover:border-gray-500'
                                            }`}
                                        onClick={() => onSetTactic?.(battle.id, 'attacker', id)}
                                        title={tactic.desc}
                                    >
                                        {tactic.name}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

export default memo(ActiveBattlePanel);
