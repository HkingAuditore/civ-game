import React, { memo, useMemo } from 'react';
import { Icon } from '../common/UIComponents';
import { formatNumberShortCN } from '../../utils/numberFormat';
import { getCorpsTotalUnits, getCorpsGeneral } from '../../logic/diplomacy/corpsSystem';
import {
    getPlayerSide,
    CHECKPOINTS,
    summarizeFrontState,
    calculateFrontEconomicImpact,
} from '../../logic/diplomacy/frontSystem';
import { isBattleActive } from '../../logic/diplomacy/battleSystem';

const formatFrontPenaltyText = (impact = {}) => {
    const parts = [];
    if (impact.productionPenalty > 0) {
        parts.push(`产出 -${Math.round(Number(impact.productionPenalty || 0) * 100)}%`);
    }
    if (impact.incomePenalty > 0) {
        parts.push(`财政 -${formatNumberShortCN(impact.incomePenalty || 0, { decimals: 1 })}/日`);
    }
    return parts.length > 0 ? parts.join(' / ') : '当前未形成明显经济损失';
};

const MetricBar = ({ label, value, maxValue, colorClass = 'bg-cyan-400', suffix = '', invert = false }) => {
    const safeValue = Math.max(0, Number(value || 0));
    const safeMax = Math.max(safeValue, Number(maxValue || 0), 1);
    const width = invert
        ? Math.max(6, Math.min(100, (safeValue / safeMax) * 100))
        : Math.max(0, Math.min(100, (safeValue / safeMax) * 100));

    return (
        <div>
            <div className="mb-1 flex items-center justify-between text-[10px] text-gray-400">
                <span>{label}</span>
                <span className="text-white">{suffix ? `${formatNumberShortCN(safeValue, { decimals: 1 })}${suffix}` : formatNumberShortCN(safeValue, { decimals: 1 })}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-gray-900">
                <div className={`h-full rounded-full ${colorClass}`} style={{ width: `${width}%` }} />
            </div>
        </div>
    );
};

const PLAYER_FRONT_ZONES = [
    { id: 'player_core', name: '我方核心区', start: 0, end: 15, category: 'capital', ownerTone: 'player' },
    { id: 'player_economic', name: '我方经济区', start: 15, end: 35, category: 'economic', ownerTone: 'player' },
    { id: 'player_frontier', name: '我方前沿', start: 35, end: 50, category: 'frontier', ownerTone: 'player' },
    { id: 'enemy_frontier', name: '敌方前沿', start: 50, end: 65, category: 'frontier', ownerTone: 'enemy' },
    { id: 'enemy_economic', name: '敌方经济区', start: 65, end: 85, category: 'economic', ownerTone: 'enemy' },
    { id: 'enemy_core', name: '敌方核心区', start: 85, end: 100, category: 'capital', ownerTone: 'enemy' },
];

const getPlayerRelativeLinePosition = (linePosition, playerSide) => (
    playerSide === 'attacker' ? linePosition : 100 - linePosition
);

const getDisplayZoneForPosition = (relativePosition) => (
    PLAYER_FRONT_ZONES.find((zone) => relativePosition >= zone.start && relativePosition < zone.end) || PLAYER_FRONT_ZONES[PLAYER_FRONT_ZONES.length - 1]
);

const getPlayerPhaseText = (relativePosition) => {
    if (relativePosition >= 85) return '压制';
    if (relativePosition >= 60) return '推进';
    if (relativePosition > 40) return '拉锯';
    if (relativePosition > 15) return '受压';
    return '危急';
};

const getWarScoreTotal = (front) => {
    const breakdownTotal = Number(front?.warScoreBreakdown?.battle || 0)
        + Number(front?.warScoreBreakdown?.advance || 0)
        + Number(front?.warScoreBreakdown?.economic || 0)
        + Number(front?.warScoreBreakdown?.homeland || 0);
    if (breakdownTotal !== 0) return Math.round(breakdownTotal);
    return Math.round(Number(front?.warScore || 0));
};

const getWarScoreTone = (warScore) => {
    if (warScore > 8) return 'text-emerald-300';
    if (warScore < -8) return 'text-red-300';
    return 'text-gray-200';
};


const SummaryStat = ({ label, value, tone = 'text-white', align = 'left' }) => (
    <div className="rounded-xl border border-gray-800 bg-gray-950/50 px-3 py-2">
        <p className="text-[10px] text-gray-500">{label}</p>
        <p className={`mt-1 text-sm font-semibold ${tone} ${align === 'right' ? 'text-right' : ''}`}>{value}</p>
    </div>
);

const ForceColumn = ({
    title,
    tone,
    sideState,
    corpsList,
    generals,
    canControlTasks,
    onRemoveCorpsFromFront,
    onAssignCorpsToFront,
    reserveCorps = [],
    front,
    playerSide,
}) => {
    return (
        <section className={`rounded-2xl border p-3 ${tone}`}>
            <div className="mb-3 flex items-center justify-between">
                <div>
                    <p className="text-sm font-semibold text-white">{title}</p>
                    <p className="text-[10px] text-gray-400">
                        兵力 {sideState?.deployedUnits || 0} · 军团 {sideState?.corpsCount || corpsList.length}
                    </p>
                </div>
                <div className="text-right text-[10px] text-gray-400">
                    <p>补给 {sideState?.supplyState || '稳定'}</p>
                    <p>工事 {sideState?.entrenchment || 25}</p>
                </div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="rounded-xl border border-gray-800 bg-black/20 p-2">
                    <p className="text-gray-500">攻势/防御</p>
                    <p className="mt-1 text-white">{Math.round(sideState?.advancePower || 0)} / {Math.round(sideState?.defensePower || 0)}</p>
                </div>
                <div className="rounded-xl border border-gray-800 bg-black/20 p-2">
                    <p className="text-gray-500">补给率</p>
                    <p className="mt-1 text-white">{Math.round((sideState?.supplyRatio || 1) * 100)}%</p>
                </div>
            </div>
            <div className="mt-3 space-y-2">
                {corpsList.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-gray-700 bg-black/20 px-3 py-2 text-xs text-gray-500">暂无军团部署</p>
                ) : corpsList.map((corps) => {
                    const general = getCorpsGeneral(generals, corps.id);
                    return (
                        <div key={corps.id} className="rounded-xl border border-gray-800 bg-black/20 p-2">
                            <div className="flex items-center justify-between gap-2">
                                <div className="text-xs">
                                    <p className="font-semibold text-white">{corps.name} <span className="text-gray-500">({getCorpsTotalUnits(corps)})</span></p>
                                    <p className="text-[10px] text-gray-400">
                                        {general ? `将领 ${general.name} Lv.${general.level || 1}` : '无将领'} · 士气 {Math.round(corps.morale || 100)} · 疲劳 {Math.round(corps.fatigue || 0)}%
                                    </p>
                                </div>
                                {canControlTasks && (
                                    <button
                                        type="button"
                                        className="rounded bg-gray-700 px-1.5 py-0.5 text-[10px] text-gray-300 hover:bg-gray-600"
                                        onClick={() => onRemoveCorpsFromFront?.(front.id, corps.id, playerSide)}
                                    >
                                        撤回
                                    </button>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
            {canControlTasks && (
                <div className="mt-3 rounded-xl border border-dashed border-cyan-800/40 bg-cyan-950/10 p-3">
                    <div className="mb-2 flex items-center justify-between gap-3">
                        <p className="text-xs font-semibold text-cyan-100">可派遣军团</p>
                        <p className="text-[10px] text-gray-400">{reserveCorps.length} 支待命</p>
                    </div>
                    {reserveCorps.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                            {reserveCorps.slice(0, 4).map((corps) => (
                                <button
                                    key={corps.id}
                                    type="button"
                                    onClick={() => onAssignCorpsToFront?.(front.id, corps.id, playerSide)}
                                    className="rounded-lg border border-cyan-500/30 bg-cyan-950/20 px-3 py-1.5 text-xs text-cyan-100 hover:bg-cyan-900/30"
                                >
                                    派遣 {corps.name} ({formatNumberShortCN(getCorpsTotalUnits(corps), { decimals: 0 })})
                                </button>
                            ))}
                        </div>
                    ) : (
                        <p className="text-[11px] text-gray-500">当前没有可直接派遣到这条战线的待命军团。</p>
                    )}
                </div>
            )}
        </section>
    );
};

const FrontViewPanel = ({
    front,
    activeBattles = [],
    militaryCorps = [],
    generals = [],
    nations = [],
    resources = {},
    day = 0,
    epoch = 0,
    onAssignCorpsToFront,
    onRemoveCorpsFromFront,
    onSetBattleTactic,
    onCreateBattle,
    onSetPosture,
}) => {
    if (!front) {
        return (
            <div className="rounded-2xl border border-dashed border-gray-700 bg-gray-950/40 p-6 text-center text-sm text-gray-400">
                请选择一条战线查看详情。
            </div>
        );
    }

    const playerSide = getPlayerSide(front);
    const enemySide = playerSide === 'attacker' ? 'defender' : 'attacker';
    const enemyId = playerSide === 'attacker' ? front.defenderId : front.attackerId;
    const enemyNation = nations.find((nation) => nation.id === enemyId);
    const enemyName = enemyNation?.name || enemyId || '未知国家';
    const linePosition = Number.isFinite(front.linePosition) ? front.linePosition : 50;
    const relativeLinePosition = getPlayerRelativeLinePosition(linePosition, playerSide);
    const playerCorpsIds = front.assignedCorps?.[playerSide] || [];
    const playerCorpsList = militaryCorps.filter((corps) => playerCorpsIds.includes(corps.id));
    const undeployedCorps = militaryCorps.filter((corps) => !corps.isAI && !corps.assignedFrontId && corps.status === 'idle' && getCorpsTotalUnits(corps) > 0);
    const enemyCorpsList = militaryCorps.filter((corps) => corps.isAI && corps.nationId === enemyId && corps.assignedFrontId === front.id);
    const attackerNation = nations.find((n) => n.id === front.attackerId);
    const defenderNation = nations.find((n) => n.id === front.defenderId);
    const summary = useMemo(() => (
        summarizeFrontState(
            {
                ...front,
                playerResources: resources || {},
                sideResources: {
                    attacker: front.attackerId === 'player' ? (resources || {}) : (attackerNation?.military?.stockpile || {}),
                    defender: front.defenderId === 'player' ? (resources || {}) : (defenderNation?.military?.stockpile || {}),
                },
            },
            playerSide === 'attacker' ? playerCorpsList : enemyCorpsList,
            playerSide === 'attacker' ? enemyCorpsList : playerCorpsList
        )
    ), [attackerNation, defenderNation, enemyCorpsList, front, playerCorpsList, playerSide, resources]);
    const currentZone = getDisplayZoneForPosition(relativeLinePosition);
    const playerLineVelocity = playerSide === 'attacker' ? Number(front.lineVelocity || 0) : -Number(front.lineVelocity || 0);
    const playerLineVelocityText = playerLineVelocity > 0.15 ? '我方前推' : playerLineVelocity < -0.15 ? '敌军压进' : '战线僵持';
    const frontBattles = (activeBattles || []).filter((battle) => battle && battle.frontId === front.id);
    const activeFrontBattles = frontBattles.filter((battle) => isBattleActive(battle));
    const primaryBattle = activeFrontBattles[0] || null;
    const nextCheckpoint = CHECKPOINTS.find((cp) => cp > relativeLinePosition);
    const ownState = summary.playerView?.own || summary.sideState?.[playerSide] || {};
    const enemyState = summary.playerView?.enemy || summary.sideState?.[enemySide] || {};
    const ownEconomicImpact = useMemo(() => calculateFrontEconomicImpact(front, 'player'), [front]);
    const enemyEconomicImpact = useMemo(() => calculateFrontEconomicImpact(front, enemyId), [enemyId, front]);
    const phaseText = getPlayerPhaseText(relativeLinePosition);
    const warScoreTotal = getWarScoreTotal(front);

    return (
        <div className="space-y-4 rounded-2xl border border-cyan-700/30 bg-gradient-to-br from-gray-950/95 via-cyan-950/10 to-gray-950/95 p-4 shadow-[0_0_30px_rgba(34,211,238,0.08)]">
            <section className="rounded-2xl border border-gray-800 bg-black/20 p-4">
                <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                        <div className="flex flex-wrap items-center gap-2">
                            <Icon name="MapPin" size={16} className="text-red-400" />
                            <h3 className="text-base font-bold text-white">对 {enemyName} 战区</h3>
                            <span className="rounded-full border border-gray-700 px-2 py-0.5 text-[10px] text-gray-300">{phaseText}</span>
                            <span className="rounded-full border border-cyan-400/40 bg-cyan-950/20 px-2.5 py-0.5 text-[10px] font-semibold text-cyan-100">
                                当前区域 {currentZone?.name || summary.contestedZone}
                            </span>
                        </div>
                        <p className="mt-1 text-xs text-gray-400">战线已持续 {day - (front.startDay || 0)} 天，当前态势 {playerLineVelocityText}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                        <SummaryStat label="战线战争分数" value={`${warScoreTotal > 0 ? '+' : ''}${warScoreTotal}`} tone={getWarScoreTone(warScoreTotal)} />
                        <SummaryStat label="今日进退" value={`${playerLineVelocity > 0 ? '+' : ''}${playerLineVelocity.toFixed(1)}`} tone={playerLineVelocity > 0 ? 'text-emerald-300' : playerLineVelocity < 0 ? 'text-red-300' : 'text-gray-200'} />
                        <SummaryStat label="双方兵力" value={`${formatNumberShortCN(ownState?.deployedUnits || 0, { decimals: 0 })} / ${formatNumberShortCN(enemyState?.deployedUnits || 0, { decimals: 0 })}`} />
                        <SummaryStat label="战线状态" value={primaryBattle ? '交战中' : '暂无会战'} />
                    </div>
                </div>

                <div className="mb-3">
                    <div className="mb-1 flex items-center justify-between text-[10px] text-gray-400">
                        <span>战线位置</span>
                        <span>{relativeLinePosition.toFixed(1)}% · 下一节点 {nextCheckpoint ? `${Math.abs(nextCheckpoint - relativeLinePosition).toFixed(0)}%` : '已到尽头'}</span>
                    </div>
                    <div className="relative h-5 overflow-hidden rounded-full border border-slate-700/40 bg-gray-900/80">
                        <div className="absolute inset-0 flex">
                            {PLAYER_FRONT_ZONES.map((zone) => (
                                <div
                                    key={zone.id}
                                    className={`${currentZone?.id === zone.id ? 'opacity-100 ring-1 ring-yellow-300/50' : 'opacity-55'} ${zone.ownerTone === 'player' ? 'bg-blue-800/70' : 'bg-red-800/70'} h-full`}
                                    style={{ width: `${zone.end - zone.start}%` }}
                                    title={zone.name}
                                />
                            ))}
                        </div>
                        {CHECKPOINTS.map((cp) => (
                            <div key={cp} className="absolute top-0 h-full w-px bg-white/30" style={{ left: `${cp}%` }} />
                        ))}
                        <div className="absolute top-0 h-full" style={{ left: `${relativeLinePosition}%`, transform: 'translateX(-50%)' }}>
                            <div className="h-full w-1 rounded-full bg-yellow-300 shadow-[0_0_8px_rgba(253,224,71,0.8)]" />
                        </div>
                    </div>
                </div>

                <div className="grid gap-2 md:grid-cols-4">
                    <SummaryStat label="会战" value={Math.round(front.warScoreBreakdown?.battle || 0)} />
                    <SummaryStat label="占区推进" value={Math.round(front.warScoreBreakdown?.advance || 0)} />
                    <SummaryStat label="经济破坏" value={Math.round(front.warScoreBreakdown?.economic || 0)} />
                    <SummaryStat label="本土压力" value={Math.round(front.warScoreBreakdown?.homeland || 0)} />
                </div>
            </section>

            <div className="grid gap-4 xl:grid-cols-2">
                <ForceColumn
                    title="我方战力面板"
                    tone="border-blue-900/40 bg-blue-950/10"
                    sideState={ownState}
                    corpsList={playerCorpsList}
                    generals={generals}
                    canControlTasks
                    reserveCorps={undeployedCorps}
                    onAssignCorpsToFront={onAssignCorpsToFront}
                    onRemoveCorpsFromFront={onRemoveCorpsFromFront}
                    front={front}
                    playerSide={playerSide}
                />
                <ForceColumn
                    title="敌方战力面板"
                    tone="border-red-900/40 bg-red-950/10"
                    sideState={enemyState}
                    corpsList={enemyCorpsList}
                    generals={generals}
                    canControlTasks={false}
                    front={front}
                    playerSide={playerSide}
                />
            </div>

            <section className="rounded-2xl border border-gray-800 bg-black/20 p-4">
                    <div className="rounded-xl border border-gray-800 bg-gray-950/40 p-3">
                        <div className="mb-2 flex items-center gap-2">
                            <Icon name="Coins" size={14} className="text-yellow-300" />
                            <p className="text-sm font-semibold text-white">战争经济</p>
                        </div>
                        <div className="grid gap-3 md:grid-cols-2">
                            <div className="rounded-xl border border-blue-900/40 bg-blue-950/10 p-2 text-xs">
                                <p className="mb-1 font-semibold text-white">我方</p>
                                <MetricBar label="补给率" value={Math.round(Number(ownState?.supplyRatio || 0) * 100)} maxValue={100} colorClass={Number(ownState?.supplyRatio || 0) >= 0.85 ? 'bg-emerald-400' : Number(ownState?.supplyRatio || 0) >= 0.65 ? 'bg-yellow-400' : 'bg-red-400'} suffix="%" />
                                <div className="mt-2 space-y-1">
                                    <MetricBar label="产出损失" value={Math.round(Number(ownEconomicImpact?.productionPenalty || 0) * 100)} maxValue={50} colorClass="bg-red-400" suffix="%" />
                                </div>
                                <p className="mt-1 text-[10px] text-gray-500">{formatFrontPenaltyText(ownEconomicImpact)}</p>
                            </div>
                            <div className="rounded-xl border border-red-900/40 bg-red-950/10 p-2 text-xs">
                                <p className="mb-1 font-semibold text-white">敌方</p>
                                <MetricBar label="补给率" value={Math.round(Number(enemyState?.supplyRatio || 0) * 100)} maxValue={100} colorClass={Number(enemyState?.supplyRatio || 0) >= 0.85 ? 'bg-emerald-400' : Number(enemyState?.supplyRatio || 0) >= 0.65 ? 'bg-yellow-400' : 'bg-red-400'} suffix="%" />
                                <div className="mt-2 space-y-1">
                                    <MetricBar label="产出损失" value={Math.round(Number(enemyEconomicImpact?.productionPenalty || 0) * 100)} maxValue={50} colorClass="bg-red-400" suffix="%" />
                                </div>
                                <p className="mt-1 text-[10px] text-gray-500">{formatFrontPenaltyText(enemyEconomicImpact)}</p>
                            </div>
                        </div>
                    </div>
            </section>
        </div>
    );
};

export default memo(FrontViewPanel);
