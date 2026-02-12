import React, { memo, useMemo, useState } from 'react';
import { Icon } from '../common/UIComponents';
import { RESOURCES } from '../../config';
import { getCorpsTotalUnits, getCorpsGeneral } from '../../logic/diplomacy/corpsSystem';
import { getPlayerSide, calculateFrontEconomicImpact, FRONT_ZONES, CHECKPOINTS, getZoneForPosition } from '../../logic/diplomacy/frontSystem';
import { TACTICS, isBattleActive, getBattleStatusText } from '../../logic/diplomacy/battleSystem';

const PHASE_TEXT = { contact: '接触', pressure: '压制', breakthrough: '突破', collapse: '崩溃' };
const POSTURE_STYLE = {
    aggressive: 'bg-red-900/30 border-red-500/50 text-red-300',
    defensive: 'bg-blue-900/30 border-blue-500/50 text-blue-300',
    passive: 'bg-gray-900/30 border-gray-500/50 text-gray-300',
};

const POSTURE_DESC = {
    aggressive: '敌军伤亡+50%, 我军伤亡+20%, 推进+0.8/天',
    defensive: '标准伤亡率, 推进速度不变',
    passive: '双方伤亡-50%, 推进-0.5/天',
};

// Zone colors for the progress bar segments
const ZONE_COLORS = [
    'bg-red-800',      // 0: defender core
    'bg-orange-700',   // 1: defender economic
    'bg-yellow-700/60',// 2: defender frontier
    'bg-blue-700/60',  // 3: attacker frontier
    'bg-blue-600',     // 4: attacker economic
    'bg-blue-800',     // 5: attacker core
];
const ZONE_BREACH_OVERLAY = 'bg-white/10';

const InlineBattle = ({ battle, onSetTactic }) => {
    if (!battle) return null;
    const { attacker, defender, momentum, currentRound, maxRounds, typeName } = battle;
    const aNow = Object.values(attacker.currentUnits || {}).reduce((s, c) => s + c, 0);
    const dNow = Object.values(defender.currentUnits || {}).reduce((s, c) => s + c, 0);
    const aInit = Object.values(attacker.initialUnits || {}).reduce((s, c) => s + c, 0);
    const dInit = Object.values(defender.initialUnits || {}).reduce((s, c) => s + c, 0);
    const progress = maxRounds > 0 ? (currentRound / maxRounds) * 100 : 0;

    return (
        <div className="bg-gray-900/50 rounded-lg border border-orange-700/50 p-2.5">
            <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                    <Icon name="Swords" size={13} className="text-orange-400" />
                    <span className="text-xs font-bold text-orange-200">{typeName}</span>
                    <span className="text-[10px] text-gray-400">第 {currentRound}/{maxRounds} 回合</span>
                </div>
                <span className="text-[10px] text-gray-500">{getBattleStatusText(battle)}</span>
            </div>
            <div className="w-full bg-gray-800 rounded-full h-1 mb-2">
                <div className="bg-orange-500 h-1 rounded-full transition-all" style={{ width: `${progress}%` }} />
            </div>
            <div className="grid grid-cols-2 gap-2 text-[10px]">
                <div className="bg-blue-900/20 rounded p-1.5 text-blue-200">{attacker.corpsName || '进攻方'} {aNow}/{aInit}</div>
                <div className="bg-red-900/20 rounded p-1.5 text-red-200">{defender.corpsName || '防守方'} {dNow}/{dInit}</div>
            </div>
            <div className="mt-2 text-[10px] text-gray-400">当前战术: {TACTICS[attacker.tactic]?.name || '常规作战'}</div>
            <div className="mt-1 flex gap-1 flex-wrap">
                {Object.entries(TACTICS).map(([id, tactic]) => (
                    <button
                        key={id}
                        className={`px-1.5 py-0.5 text-[10px] rounded border ${attacker.tactic === id ? 'bg-ancient-gold/20 border-ancient-gold/50 text-ancient-parchment' : 'bg-gray-800 border-gray-700 text-gray-400'}`}
                        onClick={() => onSetTactic?.(battle.id, 'attacker', id)}
                    >
                        {tactic.name}
                    </button>
                ))}
            </div>
            <div className="mt-1 text-[10px] text-gray-500">势头 {Math.round(momentum)}</div>
        </div>
    );
};

const WarfrontCard = ({ front, activeBattles = [], militaryCorps = [], generals = [], nations = [], day = 0, epoch = 0, onAssignCorpsToFront, onRemoveCorpsFromFront, onSetBattleTactic, onCreateBattle, onSetPosture }) => {
    const [showDetails, setShowDetails] = useState(false);
    const [showAttackConfirm, setShowAttackConfirm] = useState(false);
    const playerSide = getPlayerSide(front);
    const enemyId = playerSide === 'attacker' ? front.defenderId : front.attackerId;
    const enemyNation = nations.find(n => n.id === enemyId);
    const enemyName = enemyNation?.name || enemyId || '未知国家';

    const linePosition = Number.isFinite(front.linePosition) ? front.linePosition : 50;
    // playerFrontControl computed for internal use
    const _playerFrontControl = playerSide === 'attacker' ? linePosition : (100 - linePosition);
    const phaseText = PHASE_TEXT[front.phase] || PHASE_TEXT.contact;
    const lineVelocity = Number(front.lineVelocity || 0);
    const lineVelocityText = lineVelocity > 0.6 ? (playerSide === 'attacker' ? '我军推进' : '敌军推进') : lineVelocity < -0.6 ? (playerSide === 'attacker' ? '敌军反推' : '我军反推') : '战线僵持';

    const playerCorpsIds = front.assignedCorps?.[playerSide] || [];
    const playerCorpsList = militaryCorps.filter(c => playerCorpsIds.includes(c.id));
    const enemyCorpsList = militaryCorps.filter(c => c.isAI && c.assignedFrontId === front.id && c.nationId === enemyId);
    const undeployedCorps = militaryCorps.filter(c => !c.isAI && !c.assignedFrontId && c.status === 'idle' && getCorpsTotalUnits(c) > 0);

    const playerTotalUnits = playerCorpsList.reduce((s, c) => s + getCorpsTotalUnits(c), 0);
    const enemyTotalUnits = enemyCorpsList.reduce((s, c) => s + getCorpsTotalUnits(c), 0);
    const playerForceRatio = (playerTotalUnits / Math.max(1, playerTotalUnits + enemyTotalUnits)) * 100;
    const impact = calculateFrontEconomicImpact(front, 'player');

    const frontBattles = useMemo(() => (activeBattles || []).filter(b => b && b.frontId === front.id), [activeBattles, front.id]);
    const activeFrontBattles = frontBattles.filter(b => isBattleActive(b));
    const canAttack = activeFrontBattles.length === 0 && playerCorpsList.length > 0 && enemyCorpsList.length > 0;
    const canSweep = activeFrontBattles.length === 0 && playerCorpsList.length > 0 && enemyCorpsList.length === 0;

    const launchBattle = () => {
        if ((!canAttack && !canSweep) || !onCreateBattle) return;
        const playerCorps = playerCorpsList[0];
        const aiCorps = enemyCorpsList[0];
        const playerGen = generals.find(g => g.assignedCorpsId === playerCorps?.id) || null;
        const aiGen = generals.find(g => g.id === aiCorps?.generalId) || null;
        const total = getCorpsTotalUnits(playerCorps) + getCorpsTotalUnits(aiCorps);
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
        <div className={`glass-ancient rounded-lg border ${activeFrontBattles.length > 0 ? 'border-orange-600/60' : 'border-red-900/40'}`}>
            <div className="p-3 pb-2">
                <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-bold flex items-center gap-2 text-red-200">
                        <Icon name="MapPin" size={15} className="text-red-400" />
                        对 {enemyName} 战线
                    </h3>
                    <span className="text-[10px] text-gray-500">持续 {day - (front.startDay || 0)} 天</span>
                </div>
                <div className="mb-2">
                    <div className="flex justify-between text-[10px] mb-0.5">
                        <span className="text-gray-300">战线推进</span>
                        <div className="flex items-center gap-1.5">
                            <span className="text-cyan-300">{phaseText} / {lineVelocityText}</span>
                            {linePosition >= 65 && <span className="text-[9px] px-1 py-0.5 bg-green-900/40 border border-green-500/40 rounded text-green-300">💪 战线优势</span>}
                            {linePosition <= 35 && <span className="text-[9px] px-1 py-0.5 bg-red-900/40 border border-red-500/40 rounded text-red-300">⚠️ 战线告急</span>}
                        </div>
                    </div>
                    {/* 7-zone checkpoint progress bar */}
                    <div className="relative w-full h-3 rounded-full overflow-hidden border border-slate-700/40 flex">
                        {FRONT_ZONES.map((zone, idx) => {
                            const width = zone.end - zone.start;
                            const isBeyondLine = playerSide === 'attacker'
                                ? linePosition > zone.start
                                : (100 - linePosition) > (100 - zone.end);
                            return (
                                <div
                                    key={zone.id}
                                    className={`h-full ${ZONE_COLORS[idx]} relative ${isBeyondLine ? 'opacity-100' : 'opacity-30'}`}
                                    style={{ width: `${width}%` }}
                                    title={zone.name}
                                />
                            );
                        })}
                        {/* Checkpoint markers */}
                        {CHECKPOINTS.map(cp => (
                            <div key={cp} className="absolute top-0 h-full flex flex-col items-center" style={{ left: `${cp}%`, transform: 'translateX(-50%)' }}>
                                <div className="w-px h-full bg-white/40" />
                            </div>
                        ))}
                        {/* Position indicator */}
                        <div className="absolute top-0 h-full" style={{ left: `${linePosition}%`, transform: 'translateX(-50%)' }}>
                            <div className="w-0 h-0 border-l-[4px] border-r-[4px] border-t-[5px] border-l-transparent border-r-transparent border-t-yellow-400" />
                        </div>
                    </div>
                    {/* Next checkpoint hint */}
                    {(() => {
                        const nextCp = playerSide === 'attacker'
                            ? CHECKPOINTS.find(cp => cp > linePosition)
                            : CHECKPOINTS.slice().reverse().find(cp => cp < linePosition);
                        if (!nextCp) return null;
                        const dist = Math.abs(nextCp - linePosition).toFixed(0);
                        const targetZone = FRONT_ZONES.find(z => playerSide === 'attacker' ? z.start === nextCp : z.end === nextCp);
                        return <p className="text-[9px] text-gray-500 mt-0.5">距{targetZone?.name || '下一节点'}还需推进 {dist}%</p>;
                    })()}
                </div>
                <div className="mb-2">
                    <div className="flex justify-between text-[10px] mb-0.5">
                        <span className="text-blue-300">我方 {playerTotalUnits}</span>
                        <span className="text-red-300">敌方 {enemyTotalUnits}</span>
                    </div>
                    <div className="w-full bg-red-900/30 rounded-full h-2 overflow-hidden">
                        <div className="bg-blue-500/60 h-2 transition-all" style={{ width: `${playerForceRatio}%` }} />
                    </div>
                </div>
                <div className="text-[10px] text-gray-400">经济压力: 产出-{(impact.productionPenalty * 100).toFixed(0)}% 财政-{Math.round(impact.incomePenalty || 0)}/天</div>
            </div>

            {activeFrontBattles.length > 0 && (
                <div className="px-3 pb-2 space-y-2">
                    {activeFrontBattles.map(b => <InlineBattle key={b.id} battle={b} onSetTactic={onSetBattleTactic} />)}
                </div>
            )}

            {activeFrontBattles.length === 0 && (
                <div className="px-3 pb-2">
                    {canAttack && !showAttackConfirm && (
                        <button className="w-full py-2 bg-red-700/60 text-white rounded-lg text-sm font-semibold" onClick={() => setShowAttackConfirm(true)}>
                            发起进攻
                        </button>
                    )}
                    {canAttack && showAttackConfirm && (
                        <div className="bg-gray-900/60 border border-red-700/40 rounded-lg p-2.5 space-y-2">
                            <p className="text-xs text-gray-300">确认发起进攻？</p>
                            <div className="flex gap-2">
                                <button className="flex-1 py-1.5 bg-red-700 text-white rounded text-xs font-bold" onClick={launchBattle}>确认</button>
                                <button className="flex-1 py-1.5 bg-gray-700 text-gray-300 rounded text-xs" onClick={() => setShowAttackConfirm(false)}>取消</button>
                            </div>
                        </div>
                    )}
                    {canSweep && (
                        <button className="w-full py-2 bg-green-800/50 text-green-200 rounded-lg text-sm font-semibold" onClick={launchBattle}>
                            扫荡（无抵抗）
                        </button>
                    )}
                </div>
            )}

            <div className="px-3 pb-2">
                {playerCorpsList.length > 0 && enemyCorpsList.length > 0 && activeFrontBattles.length === 0 && (
                    <div className="bg-gray-900/40 rounded-lg border border-gray-700/40 p-2 space-y-2 mb-2">
                        <div>
                            <p className="text-[10px] text-gray-400 mb-1">战线姿态</p>
                            <div className="flex gap-1">
                                {[{ id: 'aggressive', name: '主动袭扰', icon: 'Swords' }, { id: 'defensive', name: '积极防御', icon: 'Shield' }, { id: 'passive', name: '消极防御', icon: 'Eye' }].map(p => (
                                    <button
                                        key={p.id}
                                        className={`px-2 py-1 text-[10px] rounded border transition-all flex items-center gap-1 ${(front.posture || 'defensive') === p.id ? POSTURE_STYLE[p.id] : 'bg-gray-800 border-gray-700 text-gray-400'}`}
                                        onClick={() => onSetPosture?.(front.id, p.id)}
                                    >
                                        <Icon name={p.icon} size={10} />
                                        {p.name}
                                    </button>
                                ))}
                            </div>
                            <p className="text-[9px] text-gray-500 mt-0.5">{POSTURE_DESC[front.posture || 'defensive']}</p>
                        </div>
                        {(front.controlLog || []).slice(-4).reverse().map((evt, i) => (
                            <div key={`${evt.day}_${i}`} className={`text-[10px] px-2 py-0.5 rounded bg-cyan-900/20 text-cyan-100 ${i === 0 ? 'animate-pulse' : 'opacity-80'}`}>
                                <span className="text-cyan-300/70 mr-1">第{evt.day}天</span>{evt.text}
                            </div>
                        ))}
                    </div>
                )}

                <div className="mb-1">
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
                                        {gen && <span className="text-yellow-400 text-[10px]">将领: {gen.name}</span>}
                                    </div>
                                    {!isInCombat && (
                                        <button className="text-[10px] px-1.5 py-0.5 bg-gray-700 rounded text-gray-400" onClick={() => onRemoveCorpsFromFront?.(front.id, corps.id, playerSide)}>
                                            撤回
                                        </button>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <p className="text-[10px] text-gray-500 italic">未部署军团。</p>
                )}

                {undeployedCorps.length > 0 && (
                    <div className="mt-1.5 pt-1.5 border-t border-gray-700/50">
                        <p className="text-[10px] text-gray-400 mb-1">增派军团</p>
                        <div className="flex flex-wrap gap-1">
                            {undeployedCorps.map(corps => (
                                <button key={corps.id} className="text-[10px] px-2 py-0.5 bg-blue-900/30 border border-blue-500/20 rounded text-blue-300" onClick={() => onAssignCorpsToFront?.(front.id, corps.id, playerSide)}>
                                    + {corps.name} ({getCorpsTotalUnits(corps)})
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            <div className="px-3 pb-2">
                <button className="text-[10px] text-gray-500 hover:text-gray-300 flex items-center gap-1" onClick={() => setShowDetails(!showDetails)}>
                    <Icon name={showDetails ? 'ChevronDown' : 'ChevronRight'} size={10} />
                    战线详情
                </button>
                {showDetails && (
                    <div className="mt-1.5 space-y-1.5">
                        {/* Zone-grouped resource display */}
                        {FRONT_ZONES.map((zone) => {
                            const zoneData = front.zones?.[zone.id];
                            const isReached = zoneData?.reached;
                            const currentZone = getZoneForPosition(linePosition);
                            const isCurrent = currentZone?.id === zone.id;
                            const zoneNodes = (zoneData?.resourceNodes || []);
                            const zoneInfra = (zoneData?.infrastructure || []);

                            return (
                                <div key={zone.id} className={`bg-gray-900/30 rounded p-2 ${isCurrent ? 'border border-yellow-600/40' : ''}`}>
                                    <div className="flex items-center justify-between mb-1">
                                        <p className={`text-[10px] font-bold ${isCurrent ? 'text-yellow-300' : isReached ? 'text-gray-300' : 'text-gray-600'}`}>
                                            {zone.name} ({zone.start}-{zone.end}%)
                                            {isCurrent && <span className="ml-1 text-yellow-400">◄ 当前</span>}
                                        </p>
                                        {!isReached && <span className="text-[9px] text-gray-600 italic">未探索</span>}
                                    </div>
                                    {isReached ? (
                                        <div className="flex flex-wrap gap-1">
                                            {zoneNodes.map(node => {
                                                const resDef = RESOURCES[node.resource];
                                                const resName = resDef?.name || node.resource;
                                                return (
                                                    <span key={node.id} className={`text-[10px] px-1.5 py-0.5 rounded ${node.plundered ? 'bg-gray-800 text-gray-600 line-through' : node.owner === enemyId ? 'bg-red-900/30 text-red-300' : 'bg-blue-900/30 text-blue-300'}`}>
                                                        {node.desc} ({resName} {node.amount})
                                                    </span>
                                                );
                                            })}
                                            {zoneInfra.map(inf => (
                                                <span key={inf.id} className={`text-[10px] px-1.5 py-0.5 rounded ${inf.destroyed ? 'bg-gray-800 text-gray-600 line-through' : 'bg-purple-900/30 text-purple-300'}`}>
                                                    🏗 {inf.name} ({inf.destroyed ? '已摧毁' : `耐久 ${inf.durability}/${inf.maxDurability}`})
                                                </span>
                                            ))}
                                            {zoneNodes.length === 0 && zoneInfra.length === 0 && (
                                                <span className="text-[9px] text-gray-600 italic">此区段无资源</span>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="h-4" />
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};

export default memo(WarfrontCard);
