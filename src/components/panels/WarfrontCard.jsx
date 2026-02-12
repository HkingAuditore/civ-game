/**
 * WarfrontCard - Unified warfront card combining front info + battle panel
 * One card per active front, showing everything: force comparison, corps deployment,
 * active battles inline, resource nodes, infrastructure, and attack controls.
 */
import React, { useState, useMemo, memo } from 'react';
import { Icon } from '../common/UIComponents';
import { RESOURCES } from '../../config';
import { getCorpsTotalUnits, getCorpsGeneral } from '../../logic/diplomacy/corpsSystem';
import { getPlayerSide, getEnemySide, calculateFrontEconomicImpact } from '../../logic/diplomacy/frontSystem';
import { TACTICS, isBattleActive, getBattleStatusText, createBattle } from '../../logic/diplomacy/battleSystem';
import { formatNumberShortCN } from '../../utils/numberFormat';

// ========== Inline Battle Section ==========
const InlineBattleSection = ({ battle, onSetTactic }) => {
    if (!battle) return null;

    const { attacker, defender, momentum, currentRound, maxRounds, typeName } = battle;
    const playerUnits = Object.values(attacker.currentUnits).reduce((s, c) => s + c, 0);
    const enemyUnits = Object.values(defender.currentUnits).reduce((s, c) => s + c, 0);
    const playerInitial = Object.values(attacker.initialUnits).reduce((s, c) => s + c, 0);
    const enemyInitial = Object.values(defender.initialUnits).reduce((s, c) => s + c, 0);
    const roundProgress = maxRounds > 0 ? (currentRound / maxRounds) * 100 : 0;
    const momentumText = momentum > 55 ? '攻方优势' : momentum < 45 ? '守方优势' : '胶着';
    const momentumColor = momentum > 60 ? 'text-blue-400' : momentum < 40 ? 'text-red-400' : 'text-yellow-400';
    const lastLog = battle.roundLog?.[battle.roundLog.length - 1];

    return (
        <div className="bg-gray-900/50 rounded-lg border border-orange-700/50 p-2.5 animate-pulse-subtle">
            {/* Battle Header */}
            <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                    <Icon name="Swords" size={13} className="text-orange-400 animate-pulse" />
                    <span className="text-xs font-bold text-orange-200">{typeName}</span>
                    <span className="text-[10px] text-gray-400">第{currentRound}/{maxRounds}回合</span>
                </div>
                <span className="text-[10px] text-gray-500">{getBattleStatusText(battle)}</span>
            </div>

            {/* Round progress */}
            <div className="w-full bg-gray-800 rounded-full h-1 mb-1.5">
                <div className="bg-orange-500 h-1 rounded-full transition-all" style={{ width: `${roundProgress}%` }} />
            </div>

            {/* Momentum bar */}
            <div className="mb-2">
                <div className="flex justify-between text-[10px] mb-0.5">
                    <span className="text-blue-300">攻方</span>
                    <span className={momentumColor}>{momentumText} ({Math.round(momentum)})</span>
                    <span className="text-red-300">守方</span>
                </div>
                <div className="w-full bg-red-900/40 rounded-full h-1.5 relative">
                    <div className="bg-blue-500/70 h-1.5 rounded-l-full transition-all" style={{ width: `${momentum}%` }} />
                </div>
            </div>

            {/* Force comparison */}
            <div className="grid grid-cols-2 gap-1.5 mb-2">
                <div className="bg-blue-900/20 rounded p-1.5">
                    <div className="flex justify-between text-[10px]">
                        <span className="text-blue-300">{attacker.corpsName || '攻方'}</span>
                        <span className="text-gray-400">士气 <span className={attacker.morale > 60 ? 'text-green-400' : attacker.morale > 30 ? 'text-yellow-400' : 'text-red-400'}>{Math.round(attacker.morale)}</span></span>
                    </div>
                    <div className="text-sm font-bold text-blue-200">
                        {playerUnits}<span className="text-[10px] text-gray-500">/{playerInitial}</span>
                    </div>
                    {attacker.generalName && <div className="text-[10px] text-yellow-400">⭐ {attacker.generalName}</div>}
                </div>
                <div className="bg-red-900/20 rounded p-1.5">
                    <div className="flex justify-between text-[10px]">
                        <span className="text-red-300">{defender.corpsName || '守方'}</span>
                        <span className="text-gray-400">士气 <span className={defender.morale > 60 ? 'text-green-400' : defender.morale > 30 ? 'text-yellow-400' : 'text-red-400'}>{Math.round(defender.morale)}</span></span>
                    </div>
                    <div className="text-sm font-bold text-red-200">
                        {enemyUnits}<span className="text-[10px] text-gray-500">/{enemyInitial}</span>
                    </div>
                    {defender.generalName && <div className="text-[10px] text-red-400">敌将: {defender.generalName}</div>}
                </div>
            </div>

            {/* Last round events */}
            {lastLog && (
                <div className="bg-gray-900/40 rounded p-1.5 mb-2 text-[10px] text-gray-400">
                    {lastLog.events?.slice(-2).map((evt, i) => <p key={i}>{evt}</p>)}
                </div>
            )}

            {/* Tactical controls */}
            <div className="border-t border-gray-700/50 pt-1.5">
                <p className="text-[10px] text-gray-400 mb-1">
                    当前战术: <span className="text-ancient-parchment">{TACTICS[attacker.tactic]?.name || '正常作战'}</span>
                </p>
                <div className="flex gap-1 flex-wrap">
                    {Object.entries(TACTICS).map(([id, tactic]) => (
                        <button
                            key={id}
                            className={`px-1.5 py-0.5 text-[10px] rounded border transition-all ${attacker.tactic === id
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
};

// ========== Battle Result Summary ==========
const BattleResultSummary = ({ battle }) => {
    if (!battle?.result) return null;
    const { winner, reason, totalRounds, attackerCasualties, defenderCasualties } = battle.result;
    const reasonText = reason === 'annihilation' ? '全歼' : reason === 'morale_collapse' ? '士气崩溃' : reason === 'rout' ? '溃败' : '持久战结束';
    const winnerName = winner === 'attacker' ? battle.attacker.corpsName : battle.defender.corpsName;
    const isPlayerWin = winner === 'attacker'; // Simplified assumption

    return (
        <div className={`rounded-lg border p-2 mb-2 ${isPlayerWin ? 'bg-green-900/20 border-green-700/40' : 'bg-red-900/20 border-red-700/40'}`}>
            <div className="flex items-center gap-2 mb-1">
                <Icon name={isPlayerWin ? "Trophy" : "Frown"} size={14} className={isPlayerWin ? "text-yellow-400" : "text-red-400"} />
                <span className={`text-xs font-bold ${isPlayerWin ? 'text-green-300' : 'text-red-300'}`}>
                    {isPlayerWin ? '战斗胜利！' : '战斗失败'} — {winnerName}获胜（{reasonText}，{totalRounds}回合）
                </span>
            </div>
            <div className="flex gap-3 text-[10px] text-gray-400">
                <span>我方损失: {Object.values(attackerCasualties || {}).reduce((s, c) => s + c, 0)}</span>
                <span>敌方损失: {Object.values(defenderCasualties || {}).reduce((s, c) => s + c, 0)}</span>
            </div>
        </div>
    );
};

// ========== Main WarfrontCard ==========
const WarfrontCard = ({
    front,
    activeBattles = [],
    militaryCorps = [],
    generals = [],
    nations = [],
    day = 0,
    epoch = 0,
    onAssignCorpsToFront,
    onRemoveCorpsFromFront,
    onSetBattleTactic,
    onCreateBattle,
    onSetPosture,
}) => {
    const [showDetails, setShowDetails] = useState(false);
    const [showAttackConfirm, setShowAttackConfirm] = useState(false);

    const playerSide = getPlayerSide(front);
    const enemySide = getEnemySide(playerSide);
    const enemyId = playerSide === 'attacker' ? front.defenderId : front.attackerId;
    const enemyNation = nations.find(n => n.id === enemyId);
    const enemyName = enemyNation?.name || enemyId || '未知国家';

    // War duration
    const warDuration = day - (front.startDay || 0);

    // WarScore indicator
    const warScore = enemyNation?.warScore || 0;
    const warScoreColor = warScore > 50 ? 'text-green-400' : warScore > 0 ? 'text-green-300' : warScore > -50 ? 'text-yellow-400' : 'text-red-400';
    const warScoreBarWidth = Math.min(100, Math.max(0, (warScore + 100) / 2));
    const warScoreBarColor = warScore > 50 ? 'bg-green-500' : warScore > 0 ? 'bg-green-400' : warScore > -50 ? 'bg-yellow-500' : 'bg-red-500';

    // Corps data
    const playerCorpsIds = front.assignedCorps?.[playerSide] || [];
    const playerCorpsList = militaryCorps.filter(c => playerCorpsIds.includes(c.id));
    const enemyCorpsList = militaryCorps.filter(c =>
        c.isAI && c.assignedFrontId === front.id && c.nationId === enemyId
    );
    const undeployedCorps = militaryCorps.filter(c =>
        !c.isAI && !c.assignedFrontId && c.status === 'idle' && getCorpsTotalUnits(c) > 0
    );

    // Player total force
    const playerTotalUnits = playerCorpsList.reduce((s, c) => s + getCorpsTotalUnits(c), 0);
    const enemyTotalUnits = enemyCorpsList.reduce((s, c) => s + getCorpsTotalUnits(c), 0);
    const totalForce = Math.max(1, playerTotalUnits + enemyTotalUnits);
    const playerForceRatio = (playerTotalUnits / totalForce) * 100;

    // Active battles on this front
    const frontBattles = useMemo(() =>
        activeBattles.filter(b => b.frontId === front.id),
        [activeBattles, front.id]
    );
    const activeFrontBattles = frontBattles.filter(b => isBattleActive(b));
    const recentEndedBattles = frontBattles.filter(b => b.result?.finalized && (day - (b.startDay || 0)) < 15);

    // Resource & Infrastructure
    const enemyNodes = (front.resourceNodes || []).filter(n => n.owner === enemyId);
    const plunderedCount = enemyNodes.filter(n => n.plundered).length;
    const enemyInfra = (front.infrastructure || []).filter(i => i.owner === enemyId);
    const destroyedCount = enemyInfra.filter(i => i.destroyed).length;
    const isSuppressed = front._suppressed || (enemyNodes.length > 0 && plunderedCount === enemyNodes.length && destroyedCount === enemyInfra.length);

    // Economic impact
    const impact = calculateFrontEconomicImpact(front, 'player');

    // Can attack?
    const canAttack = activeFrontBattles.length === 0 && playerCorpsList.length > 0 && enemyCorpsList.length > 0;
    const canSweep = activeFrontBattles.length === 0 && playerCorpsList.length > 0 && enemyCorpsList.length === 0 && !isSuppressed;

    // Determine card border color
    const borderColor = activeFrontBattles.length > 0
        ? 'border-orange-600/60 shadow-orange-900/20'
        : isSuppressed
            ? 'border-green-700/40'
            : 'border-red-900/40';

    // Handle attack
    const handleLaunchAttack = () => {
        if (!canAttack || !onCreateBattle) return;
        const playerCorps = playerCorpsList[0];
        const aiCorps = enemyCorpsList[0];
        const playerGen = generals.find(g => g.assignedCorpsId === playerCorps.id) || null;
        const aiGen = generals.find(g => g.id === aiCorps.generalId) || null;

        const pUnits = getCorpsTotalUnits(playerCorps);
        const eUnits = getCorpsTotalUnits(aiCorps);
        const total = pUnits + eUnits;
        let battleType = 'skirmish';
        if (total > 100) battleType = 'pitched_battle';
        if (total > 500) battleType = 'siege';

        const isPlayerAttacker = playerSide === 'attacker';
        onCreateBattle({
            attackerCorps: isPlayerAttacker ? playerCorps : aiCorps,
            defenderCorps: isPlayerAttacker ? aiCorps : playerCorps,
            attackerGeneral: isPlayerAttacker ? playerGen : aiGen,
            defenderGeneral: isPlayerAttacker ? aiGen : playerGen,
            front,
            battleType,
            epoch,
            currentDay: day,
        });
        setShowAttackConfirm(false);
    };

    return (
        <div className={`glass-ancient rounded-lg border ${borderColor} ${activeFrontBattles.length > 0 ? 'ring-1 ring-orange-500/30' : ''}`}>
            {/* ===== Card Header ===== */}
            <div className="p-3 pb-2">
                <div className="flex items-center justify-between mb-1.5">
                    <h3 className="text-sm font-bold flex items-center gap-2 text-red-200 font-decorative">
                        <Icon name="MapPin" size={15} className="text-red-400" />
                        对{enemyName}战线
                        {activeFrontBattles.length > 0 && (
                            <span className="text-[10px] px-1.5 py-0.5 bg-orange-900/50 border border-orange-500/40 rounded text-orange-300 animate-pulse">
                                ⚔️ 交战中
                            </span>
                        )}
                        {isSuppressed && (
                            <span className="text-[10px] px-1.5 py-0.5 bg-green-900/40 border border-green-500/30 rounded text-green-300">
                                🏳️ 已压制
                            </span>
                        )}
                    </h3>
                    <span className="text-[10px] text-gray-500">持续 {warDuration} 天</span>
                </div>

                {/* WarScore bar */}
                <div className="mb-2">
                    <div className="flex justify-between text-[10px] mb-0.5">
                        <span className="text-gray-400">战争局势</span>
                        <span className={warScoreColor}>我方优势 {warScore > 0 ? '+' : ''}{warScore}</span>
                    </div>
                    <div className="w-full bg-red-900/30 rounded-full h-1.5">
                        <div className={`${warScoreBarColor} h-1.5 rounded-full transition-all`} style={{ width: `${warScoreBarWidth}%` }} />
                    </div>
                </div>

                {/* Force comparison bar */}
                <div className="mb-2">
                    <div className="flex justify-between text-[10px] mb-0.5">
                        <span className="text-blue-300">我方 {playerTotalUnits}</span>
                        <span className="text-red-300">敌方 {enemyTotalUnits}</span>
                    </div>
                    <div className="w-full bg-red-900/30 rounded-full h-2 flex overflow-hidden">
                        <div className="bg-blue-500/60 h-2 transition-all" style={{ width: `${playerForceRatio}%` }} />
                    </div>
                </div>

                {/* No defense warning */}
                {playerCorpsList.length === 0 && (
                    <div className="bg-yellow-900/30 border border-yellow-600/40 rounded p-2 mb-2 flex items-center gap-2">
                        <Icon name="AlertTriangle" size={14} className="text-yellow-400" />
                        <span className="text-xs text-yellow-300">⚠️ 无防御！此战线没有部署军团</span>
                        {undeployedCorps.length > 0 && (
                            <button
                                className="ml-auto text-[10px] px-2 py-0.5 bg-blue-900/40 border border-blue-500/30 rounded text-blue-300 hover:bg-blue-900/60"
                                onClick={() => onAssignCorpsToFront?.(front.id, undeployedCorps[0].id, playerSide)}
                            >
                                快速部署
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* ===== Active Battle (Inline) ===== */}
            {activeFrontBattles.length > 0 && (
                <div className="px-3 pb-2 space-y-2">
                    {activeFrontBattles.map(battle => (
                        <InlineBattleSection key={battle.id} battle={battle} onSetTactic={onSetBattleTactic} />
                    ))}
                </div>
            )}

            {/* ===== Recent Battle Results ===== */}
            {recentEndedBattles.length > 0 && activeFrontBattles.length === 0 && (
                <div className="px-3 pb-2">
                    {recentEndedBattles.slice(0, 2).map(battle => (
                        <BattleResultSummary key={battle.id} battle={battle} />
                    ))}
                </div>
            )}

            {/* ===== Attack / Sweep Buttons ===== */}
            {activeFrontBattles.length === 0 && (
                <div className="px-3 pb-2">
                    {canAttack && !showAttackConfirm && (
                        <button
                            className="w-full py-2 bg-red-700/60 hover:bg-red-600/70 text-white rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-2 border border-red-500/30"
                            onClick={() => setShowAttackConfirm(true)}
                        >
                            <Icon name="Swords" size={14} />
                            发起进攻
                        </button>
                    )}
                    {canAttack && showAttackConfirm && (
                        <div className="bg-gray-900/60 border border-red-700/40 rounded-lg p-2.5 space-y-2">
                            <p className="text-xs text-gray-300">确认发起进攻？</p>
                            <div className="grid grid-cols-2 gap-2 text-[10px]">
                                <div className="bg-blue-900/20 rounded p-1.5">
                                    <p className="text-blue-300 mb-0.5">我方: {playerCorpsList[0]?.name}</p>
                                    <p className="text-blue-200 font-bold">{getCorpsTotalUnits(playerCorpsList[0])} 单位</p>
                                </div>
                                <div className="bg-red-900/20 rounded p-1.5">
                                    <p className="text-red-300 mb-0.5">敌方: {enemyCorpsList[0]?.name}</p>
                                    <p className="text-red-200 font-bold">{getCorpsTotalUnits(enemyCorpsList[0])} 单位</p>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    className="flex-1 py-1.5 bg-red-700 hover:bg-red-600 text-white rounded text-xs font-bold"
                                    onClick={handleLaunchAttack}
                                >
                                    ⚔️ 确认进攻
                                </button>
                                <button
                                    className="flex-1 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded text-xs"
                                    onClick={() => setShowAttackConfirm(false)}
                                >
                                    取消
                                </button>
                            </div>
                        </div>
                    )}
                    {canSweep && (
                        <button
                            className="w-full py-2 bg-green-800/50 hover:bg-green-700/60 text-green-200 rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-2 border border-green-600/30"
                            onClick={handleLaunchAttack}
                        >
                            <Icon name="Shield" size={14} />
                            扫荡 (无抵抗)
                        </button>
                    )}
                </div>
            )}

            {/* ===== Front Posture & Friction Log ===== */}
            {playerCorpsList.length > 0 && enemyCorpsList.length > 0 && activeFrontBattles.length === 0 && (
                <div className="px-3 pb-2">
                    <div className="bg-gray-900/40 rounded-lg border border-gray-700/40 p-2 space-y-2">
                        {/* Posture selector */}
                        <div>
                            <p className="text-[10px] text-gray-400 mb-1">战线姿态:</p>
                            <div className="flex gap-1">
                                {[{ id: 'aggressive', name: '主动骚扰', icon: 'Swords', color: 'red' },
                                  { id: 'defensive', name: '积极防御', icon: 'Shield', color: 'blue' },
                                  { id: 'passive', name: '消极防守', icon: 'Eye', color: 'gray' }].map(p => (
                                    <button
                                        key={p.id}
                                        className={`px-2 py-1 text-[10px] rounded border transition-all flex items-center gap-1 ${
                                            (front.posture || 'defensive') === p.id
                                                ? `bg-${p.color}-900/30 border-${p.color}-500/50 text-${p.color}-300`
                                                : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-white hover:border-gray-500'
                                        }`}
                                        onClick={() => onSetPosture?.(front.id, p.id)}
                                    >
                                        <Icon name={p.id === 'aggressive' ? 'Swords' : p.id === 'defensive' ? 'Shield' : 'Eye'} size={10} />
                                        {p.name}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Friction event log */}
                        {(front.frictionLog || []).length > 0 && (
                            <div>
                                <p className="text-[10px] text-gray-400 mb-1">前线动态:</p>
                                <div className="space-y-0.5 max-h-24 overflow-y-auto">
                                    {(front.frictionLog || []).slice(-5).reverse().map((evt, i) => (
                                        <div
                                            key={`${evt.day}_${i}`}
                                            className={`text-[10px] px-2 py-0.5 rounded bg-gray-800/50 text-gray-300 ${i === 0 ? 'animate-pulse' : 'opacity-70'}`}
                                        >
                                            <span className="text-gray-500 mr-1">第{evt.day}天</span>
                                            {evt.text}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* No friction state */}
                        {(front.frictionLog || []).length === 0 && (
                            <p className="text-[10px] text-gray-500 italic">双方对峨中，等待前线动态...</p>
                        )}
                    </div>
                </div>
            )}

            {/* One side empty - no friction */}
            {playerCorpsList.length > 0 && enemyCorpsList.length === 0 && !isSuppressed && activeFrontBattles.length === 0 && (
                <div className="px-3 pb-2">
                    <p className="text-[10px] text-gray-500 italic">敌方无军团对抗，前线平静</p>
                </div>
            )}

            {/* ===== Deployed Corps ===== */}
            <div className="px-3 pb-2">
                {/* Enemy corps intel */}
                {enemyCorpsList.length > 0 && (
                    <div className="mb-1.5">
                        <p className="text-[10px] text-red-400/70 font-bold mb-1">敌方军团情报 ({enemyCorpsList.length})</p>
                        <div className="space-y-0.5">
                            {enemyCorpsList.map(corps => {
                                const gen = getCorpsGeneral(generals, corps.id);
                                return (
                                    <div key={corps.id} className="flex items-center gap-2 rounded px-2 py-0.5 bg-red-900/20 border border-red-800/20 text-[10px]">
                                        <Icon name="Shield" size={10} className="text-red-400" />
                                        <span className="text-red-300">{corps.name}</span>
                                        <span className="text-gray-500">({getCorpsTotalUnits(corps)})</span>
                                        {gen && <span className="text-red-400">敌将: {gen.name} Lv.{gen.level}</span>}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                <div className="flex items-center justify-between mb-1">
                    <p className="text-[10px] text-gray-400 font-bold">已部署军团 ({playerCorpsList.length})</p>
                </div>
                {playerCorpsList.length > 0 ? (
                    <div className="space-y-1">
                        {playerCorpsList.map(corps => {
                            const gen = getCorpsGeneral(generals, corps.id);
                            const isInCombat = corps.status === 'in_combat';
                            return (
                                <div key={corps.id} className={`flex items-center justify-between rounded px-2 py-1 ${isInCombat ? 'bg-orange-900/20 border border-orange-700/30' : 'bg-gray-900/40'}`}>
                                    <div className="flex items-center gap-2 text-xs">
                                        <Icon name="Shield" size={10} className="text-ancient-gold" />
                                        <span className="text-ancient-parchment">{corps.name}</span>
                                        <span className="text-gray-500">({getCorpsTotalUnits(corps)})</span>
                                        {gen && <span className="text-yellow-400 text-[10px]">⭐{gen.name}</span>}
                                        {isInCombat && <span className="text-[10px] text-orange-400">⚔️</span>}
                                        {/* Morale indicator */}
                                        <div className="w-12 bg-gray-800 rounded-full h-1 ml-1">
                                            <div
                                                className={`h-1 rounded-full ${(corps.morale || 80) > 60 ? 'bg-green-500' : (corps.morale || 80) > 30 ? 'bg-yellow-500' : 'bg-red-500'}`}
                                                style={{ width: `${corps.morale || 80}%` }}
                                            />
                                        </div>
                                    </div>
                                    {!isInCombat && (
                                        <button
                                            className="text-[10px] px-1.5 py-0.5 bg-gray-700 rounded text-gray-400 hover:text-white hover:bg-gray-600"
                                            onClick={() => onRemoveCorpsFromFront?.(front.id, corps.id, playerSide)}
                                        >
                                            撤回
                                        </button>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <p className="text-[10px] text-gray-500 italic">无军团部署</p>
                )}

                {/* Deploy more */}
                {undeployedCorps.length > 0 && (
                    <div className="mt-1.5 pt-1.5 border-t border-gray-700/50">
                        <p className="text-[10px] text-gray-400 mb-1">增派军团:</p>
                        <div className="flex flex-wrap gap-1">
                            {undeployedCorps.map(corps => (
                                <button
                                    key={corps.id}
                                    className="text-[10px] px-2 py-0.5 bg-blue-900/30 border border-blue-500/20 rounded text-blue-300 hover:bg-blue-900/50 transition-colors"
                                    onClick={() => onAssignCorpsToFront?.(front.id, corps.id, playerSide)}
                                >
                                    + {corps.name} ({getCorpsTotalUnits(corps)})
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* ===== Expandable Details (Resources, Infrastructure, Economic) ===== */}
            <div className="px-3 pb-2">
                <button
                    className="text-[10px] text-gray-500 hover:text-gray-300 flex items-center gap-1 transition-colors"
                    onClick={() => setShowDetails(!showDetails)}
                >
                    <Icon name={showDetails ? "ChevronDown" : "ChevronRight"} size={10} />
                    战线详情 (资源点 {plunderedCount}/{enemyNodes.length} 被掠 · 设施 {destroyedCount}/{enemyInfra.length} 被毁)
                </button>

                {showDetails && (
                    <div className="mt-1.5 space-y-1.5">
                        {/* Resource Nodes */}
                        <div className="bg-gray-900/30 rounded p-2">
                            <p className="text-[10px] text-gray-400 mb-1">资源点</p>
                            <div className="flex flex-wrap gap-1">
                                {(front.resourceNodes || []).map(node => {
                                    const resDef = RESOURCES[node.resource];
                                    const resColor = resDef?.color || 'text-gray-300';
                                    const resIcon = resDef?.icon;
                                    const resName = resDef?.name || node.resource;
                                    return (
                                        <span
                                            key={node.id}
                                            className={`text-[10px] px-1.5 py-0.5 rounded inline-flex items-center gap-1 ${node.plundered
                                                ? 'bg-gray-800 text-gray-600 line-through'
                                                : node.owner === enemyId
                                                    ? 'bg-red-900/30'
                                                    : 'bg-blue-900/30'
                                            }`}
                                            title={`${node.desc} → ${resName} (${node.amount}/${node.maxAmount})`}
                                        >
                                            {node.plundered ? '💀 ' : resIcon ? <Icon name={resIcon} size={10} className={resColor} /> : null}
                                            <span className={node.plundered ? '' : resColor}>{node.desc}</span>
                                            <span className="text-gray-500">({resName} {node.amount})</span>
                                        </span>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Infrastructure */}
                        <div className="bg-gray-900/30 rounded p-2">
                            <p className="text-[10px] text-gray-400 mb-1">设施</p>
                            <div className="flex flex-wrap gap-1">
                                {(front.infrastructure || []).map(infra => {
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
                                            {infra.destroyed ? '🏚️' : ''} {infra.name} {!infra.destroyed && `${healthPct}%`}
                                        </span>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Economic Impact */}
                        {(impact.productionPenalty > 0 || impact.supplyBonus > 0) && (
                            <div className="bg-gray-900/30 rounded p-2 text-[10px]">
                                <p className="text-gray-400 mb-1">经济影响:</p>
                                <div className="flex gap-2">
                                    {impact.productionPenalty > 0 && <span className="text-red-400">产出 -{(impact.productionPenalty * 100).toFixed(0)}%</span>}
                                    {impact.supplyBonus > 0 && <span className="text-green-400">补给 +{(impact.supplyBonus * 100).toFixed(0)}%</span>}
                                    {impact.defenseBonus > 0 && <span className="text-blue-400">防御 +{(impact.defenseBonus * 100).toFixed(0)}%</span>}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default memo(WarfrontCard);
