import React, { memo, useMemo } from 'react';
import { Icon } from '../common/UIComponents';
import { getCorpsTotalUnits } from '../../logic/diplomacy/corpsSystem';
import { getPlayerSide, summarizeFrontState } from '../../logic/diplomacy/frontSystem';
import { isBattleActive } from '../../logic/diplomacy/battleSystem';
import { formatNumberShortCN } from '../../utils/numberFormat';

const PLAYER_FRONT_ZONES = [
    { id: 'player_core', name: '我方核心区', start: 0, end: 15 },
    { id: 'player_economic', name: '我方经济区', start: 15, end: 35 },
    { id: 'player_frontier', name: '我方前沿', start: 35, end: 50 },
    { id: 'enemy_frontier', name: '敌方前沿', start: 50, end: 65 },
    { id: 'enemy_economic', name: '敌方经济区', start: 65, end: 85 },
    { id: 'enemy_core', name: '敌方核心区', start: 85, end: 100 },
];

const getPlayerRelativeLinePosition = (linePosition, playerSide) => (
    playerSide === 'attacker' ? linePosition : 100 - linePosition
);

const getCurrentZoneLabel = (relativePosition) => (
    PLAYER_FRONT_ZONES.find((zone) => relativePosition >= zone.start && relativePosition < zone.end)?.name || '边境接触'
);

const getPlayerPhaseText = (relativePosition) => {
    if (relativePosition >= 85) return '压制';
    if (relativePosition >= 60) return '推进';
    if (relativePosition > 40) return '拉锯';
    if (relativePosition > 15) return '受压';
    return '危急';
};

const getDangerLevel = (frontSummary, relativePosition, playerUnits, enemyUnits) => {
    const ownPressure = Math.max(0, 50 - relativePosition);
    const supplyState = frontSummary?.playerView?.own?.supplyState || frontSummary?.supplyState?.player || '稳定';
    if (supplyState === '未接战' && playerUnits <= 0 && enemyUnits <= 0) return '未接战';
    if (relativePosition >= 65 && playerUnits >= enemyUnits * 0.9) return '优势';
    if (ownPressure >= 35 || (relativePosition <= 15 && enemyUnits > playerUnits)) return '危急';
    if (relativePosition < 40 || supplyState === '断裂' || enemyUnits > playerUnits * 1.2) return '受压';
    return '拉锯';
};

const getHeadline = (frontSummary, factors = []) => {
    if (factors.length === 0) {
        const supply = frontSummary?.playerView?.own?.supplyState || frontSummary?.supplyState?.player || '稳定';
        if (supply === '未接战') return '双方当前都没有有效军团部署，战线不会自行推进。';
        return supply === '断裂' ? '当前主因是补给线断裂，前线作战能力正在快速下降。' : '当前暂无新的决定性事件，这条线以日常对峙和慢速拉扯为主。';
    }
    const dominant = [...factors].sort((a, b) => Math.abs(Number(b?.value || 0)) - Math.abs(Number(a?.value || 0)))[0];
    if (!dominant) return '战区维持日常摩擦，暂无显著变化。';
    return `${dominant.label}${Number(dominant.value || 0) >= 0 ? '正在推动战线。' : '正在拖慢战线。'}`;
};

const getDangerTone = (dangerLevel) => {
    if (dangerLevel === '危急') return 'text-red-300 border-red-500/30 bg-red-950/30';
    if (dangerLevel === '受压') return 'text-yellow-300 border-yellow-500/30 bg-yellow-950/20';
    if (dangerLevel === '优势') return 'text-cyan-300 border-cyan-500/30 bg-cyan-950/20';
    if (dangerLevel === '未接战') return 'text-gray-400 border-gray-700 bg-gray-900/40';
    return 'text-emerald-300 border-emerald-500/30 bg-emerald-950/20';
};

const WarfrontCard = ({
    front,
    activeBattles = [],
    militaryCorps = [],
    nations = [],
    resources = {},
    selected = false,
    onSelectFront,
}) => {
    const playerSide = getPlayerSide(front);
    const enemyId = playerSide === 'attacker' ? front.defenderId : front.attackerId;
    const enemyName = nations.find((nation) => nation.id === enemyId)?.name || enemyId || '未知国家';
    const linePosition = Number.isFinite(front?.linePosition) ? front.linePosition : 50;
    const relativeLinePosition = getPlayerRelativeLinePosition(linePosition, playerSide);
    const playerCorpsIds = front.assignedCorps?.[playerSide] || [];
    const enemySide = playerSide === 'attacker' ? 'defender' : 'attacker';
    const enemyCorpsIds = front.assignedCorps?.[enemySide] || [];
    const playerCorpsList = militaryCorps.filter((corps) => playerCorpsIds.includes(corps.id));
    const enemyCorpsList = militaryCorps.filter((corps) => enemyCorpsIds.includes(corps.id));
    const frontSummary = useMemo(() => (
        summarizeFrontState(
            { ...front, playerResources: resources || {}, lastResolvedFactors: front.lastResolvedFactors || [] },
            playerSide === 'attacker' ? playerCorpsList : enemyCorpsList,
            playerSide === 'attacker' ? enemyCorpsList : playerCorpsList
        )
    ), [enemyCorpsList, front, playerCorpsList, playerSide, resources]);

    const playerUnits = playerCorpsList.reduce((sum, corps) => sum + getCorpsTotalUnits(corps), 0);
    const enemyUnits = enemyCorpsList.reduce((sum, corps) => sum + getCorpsTotalUnits(corps), 0);
    const velocity = playerSide === 'attacker' ? Number(front.lineVelocity || 0) : -Number(front.lineVelocity || 0);
    const advanceLabel = velocity > 0.15 ? '我方前推' : velocity < -0.15 ? '敌军压进' : '战线僵持';
    const dangerLevel = getDangerLevel(frontSummary, relativeLinePosition, playerUnits, enemyUnits);
    const currentBattle = (activeBattles || []).find((battle) => battle?.frontId === front.id && isBattleActive(battle));
    const hasBattle = !!currentBattle;
    const ownSupply = frontSummary?.playerView?.own?.supplyState || frontSummary?.supplyState?.player || '稳定';
    const currentZoneLabel = getCurrentZoneLabel(relativeLinePosition);
    const headline = getHeadline(frontSummary, front.lastResolvedFactors || []);
    const phaseText = getPlayerPhaseText(relativeLinePosition);
    const breakdownWarScore = Number(front.warScoreBreakdown?.battle || 0)
        + Number(front.warScoreBreakdown?.advance || 0)
        + Number(front.warScoreBreakdown?.economic || 0)
        + Number(front.warScoreBreakdown?.homeland || 0);
    const warScore = Math.round(breakdownWarScore !== 0 ? breakdownWarScore : Number(front.warScore || 0));

    return (
        <button
            type="button"
            onClick={() => onSelectFront?.(front.id)}
            className={`w-full rounded-2xl border p-4 text-left transition-all ${selected
                ? 'border-cyan-400/60 bg-cyan-950/20 shadow-[0_0_25px_rgba(34,211,238,0.12)]'
                : 'border-gray-800 bg-gray-950/50 hover:border-gray-700 hover:bg-gray-950/70'
            }`}
        >
            <div className="flex items-start justify-between gap-3">
                <div>
                    <div className="flex items-center gap-2">
                        <Icon name="MapPin" size={15} className="text-red-400" />
                        <p className="text-sm font-semibold text-white">{enemyName} 战区</p>
                        <span className="rounded-full border border-gray-700 px-2 py-0.5 text-[10px] text-gray-300">
                            {phaseText}
                        </span>
                    </div>
                    <p className="mt-1 text-[11px] text-gray-500">{currentZoneLabel}</p>
                </div>
                <div className="text-right">
                    <p className={`text-xs font-semibold ${dangerLevel === '危急' ? 'text-red-300' : dangerLevel === '受压' ? 'text-yellow-300' : dangerLevel === '优势' ? 'text-cyan-300' : dangerLevel === '未接战' ? 'text-gray-400' : 'text-emerald-300'}`}>
                        {dangerLevel}
                    </p>
                    <p className="text-[10px] text-gray-500">{hasBattle ? `${currentBattle.engagementName} · ${currentBattle.phase || '进行中'}` : '无会战'}</p>
                </div>
            </div>

            <div className="mt-3 grid gap-2 md:grid-cols-[1.1fr_0.9fr]">
                <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                    <div className="rounded-xl border border-gray-800 bg-black/20 px-3 py-2">
                        <p className="text-[10px] text-gray-500">态势</p>
                        <p className="mt-1 text-sm font-semibold text-white">{advanceLabel}</p>
                    </div>
                    <div className="rounded-xl border border-gray-800 bg-black/20 px-3 py-2">
                        <p className="text-[10px] text-gray-500">战分</p>
                        <p className={`mt-1 text-sm font-semibold ${warScore > 0 ? 'text-emerald-300' : warScore < 0 ? 'text-red-300' : 'text-gray-200'}`}>
                            {warScore > 0 ? '+' : ''}{formatNumberShortCN(warScore, { decimals: 0 })}
                        </p>
                    </div>
                    <div className="rounded-xl border border-gray-800 bg-black/20 px-3 py-2">
                        <p className="text-[10px] text-gray-500">位置</p>
                        <p className="mt-1 text-sm font-semibold text-white">{currentZoneLabel}</p>
                    </div>
                    <div className="rounded-xl border border-gray-800 bg-black/20 px-3 py-2">
                        <p className="text-[10px] text-gray-500">兵力</p>
                        <p className="mt-1 text-sm font-semibold text-white">{formatNumberShortCN(playerUnits, { decimals: 0 })} / {formatNumberShortCN(enemyUnits, { decimals: 0 })}</p>
                    </div>
                </div>

                <div className="flex items-center justify-between gap-3 rounded-xl border border-gray-800 bg-black/20 px-3 py-2">
                    <div className="min-w-0">
                        <p className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${getDangerTone(dangerLevel)}`}>
                            {dangerLevel}
                        </p>
                        <p className="mt-2 line-clamp-2 text-[11px] text-gray-300">{headline}</p>
                    </div>
                    <div className="shrink-0 text-right">
                        <p className={`text-sm font-semibold ${velocity > 0 ? 'text-emerald-300' : velocity < 0 ? 'text-red-300' : 'text-gray-200'}`}>
                            {velocity > 0 ? '+' : ''}{velocity.toFixed(1)}
                        </p>
                        <p className="mt-1 text-[10px] text-gray-500">{hasBattle ? `${currentBattle.phaseDaysRemaining}天后结算` : ownSupply}</p>
                        <p className="mt-2 text-[10px] text-cyan-300">{selected ? '已展开' : '查看详情'}</p>
                    </div>
                </div>
            </div>
        </button>
    );
};

export default memo(WarfrontCard);
