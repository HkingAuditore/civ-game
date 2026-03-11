/**
 * ActiveBattlePanel - 会战详情面板（只读）
 */
import React, { memo, useMemo } from 'react';
import { Icon } from '../common/UIComponents';
import { TACTICS, getBattleStatusText, isBattleActive } from '../../logic/diplomacy/battleSystem';
import { formatNumberShortCN } from '../../utils/numberFormat';

const sumUnits = (units = {}) => (
    Object.values(units || {}).reduce((sum, count) => sum + Number(count || 0), 0)
);

const getMomentumMeta = (momentum = 50, playerSide = 'attacker') => {
    const playerMomentum = playerSide === 'attacker' ? momentum : 100 - momentum;
    if (playerMomentum >= 60) {
        return { text: '\u6211\u65b9\u5360\u4f18', tone: 'text-emerald-300' };
    }
    if (playerMomentum <= 40) {
        return { text: '\u654c\u65b9\u5360\u4f18', tone: 'text-red-300' };
    }
    return { text: '\u52bf\u5747\u529b\u654c', tone: 'text-yellow-300' };
};

const BattleSideCard = ({ title, tone, side, tactic }) => {
    const currentUnits = sumUnits(side?.currentUnits);
    const initialUnits = sumUnits(side?.initialUnits);
    const morale = Math.round(Number(side?.morale || 0));
    const moraleTone = morale >= 70 ? 'text-emerald-300' : morale >= 40 ? 'text-yellow-300' : 'text-red-300';

    return (
        <div className={`rounded-xl border p-3 ${tone}`}>
            <div className="flex items-start justify-between gap-3">
                <div>
                    <p className="text-xs text-gray-400">{title}</p>
                    <p className="mt-1 text-sm font-semibold text-white">{side?.corpsName || '\u672a\u77e5\u519b\u56e2'}</p>
                    <p className="mt-1 text-xs text-gray-400">{`\u5c06\u9886 ${side?.generalName || '\u672a\u4efb\u547d'}`}</p>
                </div>
                <div className="text-right text-xs text-gray-400">
                    <p>{'\u58eb\u6c14 '}<span className={moraleTone}>{morale}</span></p>
                    <p>{'\u6218\u672f '}<span className="text-white">{tactic?.name || '\u7a33\u624e\u7a33\u6253'}</span></p>
                </div>
            </div>
            <div className="mt-3 flex items-end justify-between gap-3">
                <div>
                    <p className="text-xs text-gray-500">{'\u5f53\u524d\u5175\u529b'}</p>
                    <p className="text-lg font-bold text-white">{formatNumberShortCN(currentUnits, { decimals: 0 })}</p>
                </div>
                <div className="text-right">
                    <p className="text-xs text-gray-500">{'\u5f00\u6218\u5175\u529b'}</p>
                    <p className="text-sm text-gray-300">{formatNumberShortCN(initialUnits, { decimals: 0 })}</p>
                </div>
            </div>
        </div>
    );
};

const ActiveBattlePanel = ({
    activeBattles = [],
    playerSide = 'attacker',
}) => {
    const ongoingBattles = useMemo(
        () => activeBattles.filter((battle) => isBattleActive(battle)),
        [activeBattles]
    );

    if (ongoingBattles.length === 0) {
        return null;
    }

    return (
        <section className="rounded-2xl border border-orange-900/40 bg-black/20 p-4">
            <div className="mb-3 flex items-center gap-2">
                <Icon name="Swords" size={15} className="text-orange-300" />
                <h4 className="text-sm font-semibold text-white">{'\u4f1a\u6218\u8be6\u60c5'}</h4>
                <span className="rounded-full border border-orange-400/20 bg-orange-950/20 px-2 py-0.5 text-xs text-orange-200">
                    {`\u6d3b\u8dc3\u4f1a\u6218 ${ongoingBattles.length}`}
                </span>
            </div>
            <div className="space-y-3">
                {ongoingBattles.map((battle) => {
                    const ownSide = playerSide === 'defender' ? battle.defender : battle.attacker;
                    const enemySide = playerSide === 'defender' ? battle.attacker : battle.defender;
                    const ownTacticId = battle.battlePlan?.[playerSide] || ownSide?.plan || 'steady';
                    const enemyBattleSide = playerSide === 'defender' ? 'attacker' : 'defender';
                    const enemyTacticId = battle.battlePlan?.[enemyBattleSide] || enemySide?.plan || 'steady';
                    const ownTactic = TACTICS[ownTacticId];
                    const enemyTactic = TACTICS[enemyTacticId];
                    const lastLog = battle.roundLog?.[battle.roundLog.length - 1] || null;
                    const roundProgress = battle.maxRounds > 0
                        ? Math.max(0, Math.min(100, (Number(battle.currentRound || 0) / Number(battle.maxRounds || 1)) * 100))
                        : 0;
                    const playerMomentum = playerSide === 'attacker'
                        ? Number(battle.momentum || 50)
                        : 100 - Number(battle.momentum || 50);
                    const momentumMeta = getMomentumMeta(battle.momentum, playerSide);

                    return (
                        <div key={battle.id} className="rounded-xl border border-orange-900/30 bg-gray-950/45 p-3">
                            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                <div>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="text-sm font-semibold text-orange-200">{battle.typeName || '\u4f1a\u6218'}</span>
                                        <span className="rounded-full border border-gray-700 px-2 py-0.5 text-xs text-gray-300">
                                            {`\u56de\u5408 ${battle.currentRound || 0}/${battle.maxRounds || 0}`}
                                        </span>
                                        <span className="text-xs text-gray-500">{getBattleStatusText(battle)}</span>
                                    </div>
                                    <p className="mt-2 text-xs text-gray-400">
                                        {`${ownSide?.corpsName || '\u6211\u65b9\u519b\u56e2'} \u5bf9\u9635 ${enemySide?.corpsName || '\u654c\u65b9\u519b\u56e2'}`}
                                    </p>
                                </div>
                                <div className="min-w-[220px] flex-1 lg:max-w-[320px]">
                                    <div className="mb-1 flex items-center justify-between text-xs text-gray-400">
                                        <span>{'\u4f18\u52bf\u6761'}</span>
                                        <span className={momentumMeta.tone}>{`${momentumMeta.text} ${Math.round(playerMomentum)}/100`}</span>
                                    </div>
                                    <div className="h-2 overflow-hidden rounded-full bg-red-900/40">
                                        <div className="h-full rounded-full bg-cyan-400 transition-all" style={{ width: `${Math.max(0, Math.min(100, playerMomentum))}%` }} />
                                    </div>
                                    <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
                                        <span>{'\u5f53\u524d\u56de\u5408\u63a8\u8fdb'}</span>
                                        <span>{roundProgress.toFixed(0)}%</span>
                                    </div>
                                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-gray-800">
                                        <div className="h-full rounded-full bg-orange-400 transition-all" style={{ width: `${roundProgress}%` }} />
                                    </div>
                                </div>
                            </div>

                            <div className="mt-3 grid gap-3 lg:grid-cols-2">
                                <BattleSideCard title={'\u6211\u65b9'} tone="border-blue-900/40 bg-blue-950/15" side={ownSide} tactic={ownTactic} />
                                <BattleSideCard title={'\u654c\u65b9'} tone="border-red-900/40 bg-red-950/15" side={enemySide} tactic={enemyTactic} />
                            </div>

                            <div className="mt-3 rounded-xl border border-gray-800 bg-black/20 p-3">
                                <div className="mb-2 flex items-center justify-between gap-3">
                                    <p className="text-xs font-semibold text-white">{'\u6700\u8fd1\u4e00\u8f6e\u6218\u62a5'}</p>
                                    <p className="text-xs text-gray-500">{'\u5f53\u524d\u6218\u672f / \u5c06\u9886\u60c5\u51b5'}</p>
                                </div>
                                {lastLog?.events?.length ? (
                                    <div className="space-y-1 text-xs text-gray-300">
                                        {lastLog.events.slice(-3).map((event, index) => (
                                            <p key={`${battle.id}-log-${index}`}>{event}</p>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-xs text-gray-500">{'\u4e0a\u4e00\u8f6e\u6682\u65e0\u989d\u5916\u6218\u62a5\u3002'}</p>
                                )}
                                <div className="mt-3 grid gap-2 text-xs md:grid-cols-2">
                                    <div className="rounded-lg border border-gray-800 bg-blue-950/10 px-2 py-2 text-gray-300">
                                        <span className="text-gray-500">{'\u6211\u65b9'}</span>
                                        <p className="mt-1">{`${ownSide?.generalName || '\u672a\u4efb\u547d'} ? ${ownTactic?.name || '\u7a33\u624e\u7a33\u6253'}`}</p>
                                    </div>
                                    <div className="rounded-lg border border-gray-800 bg-red-950/10 px-2 py-2 text-gray-300">
                                        <span className="text-gray-500">{'\u654c\u65b9'}</span>
                                        <p className="mt-1">{`${enemySide?.generalName || '\u672a\u4efb\u547d'} ? ${enemyTactic?.name || '\u7a33\u624e\u7a33\u6253'}`}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </section>
    );
};

export default memo(ActiveBattlePanel);
