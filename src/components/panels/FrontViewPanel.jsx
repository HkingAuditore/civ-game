import React, { memo, useMemo, useState } from 'react';
import { Icon } from '../common/UIComponents';
import { RESOURCES, UNIT_TYPES, UNIT_CATEGORIES } from '../../config';
import { formatNumberShortCN } from '../../utils/numberFormat';
import {
    getCorpsTotalUnits,
    getCorpsGeneral,
    calculateCorpsCombatPower,
    getGeneralBonuses,
    getTraitDetails,
    CORPS_FRONT_TASKS,
    NO_GENERAL_PENALTY,
} from '../../logic/diplomacy/corpsSystem';
import { calculateArmyMaintenance } from '../../config/militaryUnits';

import {
    getPlayerSide,
    CHECKPOINTS,
    summarizeFrontState,
    getFrontlineEconomicModifiers,
} from '../../logic/diplomacy/frontSystem';
import { isBattleActive } from '../../logic/diplomacy/battleSystem';
import ActiveBattlePanel from './ActiveBattlePanel';

const formatFrontPenaltyText = (impact = {}) => {
    const parts = [];
    if (impact.productionPenalty > 0) {
        parts.push(`产出 -${Math.round(Number(impact.productionPenalty || 0) * 100)}%`);
    }
    if (impact.taxEfficiencyPenalty > 0) {
        parts.push(`税效 -${Math.round(Number(impact.taxEfficiencyPenalty || 0) * 100)}%`);
    }
    return parts.length > 0 ? parts.join(' / ') : '当前未形成明显经济损失';
};

const EconomyDataRow = ({ label, value, tone = 'text-gray-200' }) => (
    <div className="flex items-center justify-between rounded-lg border border-gray-800/80 bg-black/20 px-2 py-1.5">
        <span className="text-xs text-gray-500">{label}</span>
        <span className={`text-xs font-semibold ${tone}`}>{value}</span>
    </div>
);

const formatUnitPrice = (value) => {
    const safeValue = Number(value || 0);
    if (safeValue >= 10) return safeValue.toFixed(0);
    if (safeValue >= 1) return safeValue.toFixed(1);
    return safeValue.toFixed(2);
};

const getResourceUnitPrice = (resourceKey, prices = {}) => {
    if (resourceKey === 'silver') return 1;
    return Number(prices[resourceKey] || RESOURCES[resourceKey]?.basePrice || 1);
};

const SupplyNeedDisplay = ({ impact = {}, priceSource = {} }) => {
    const [expanded, setExpanded] = React.useState(false);
    const logistics = impact.logistics || {};
    const prices = priceSource?.prices || priceSource || {};

    const resourceBreakdown = logistics.resourceBreakdown || {};
    const baseResourceBreakdown = logistics.baseResourceBreakdown || {};
    const modifierBreakdown = logistics.modifierBreakdown || {};
    const logisticsMultiplier = Number(logistics.logisticsMultiplier || 1);
    const resourceEntries = Object.entries(resourceBreakdown)
        .filter(([, amount]) => Number(amount || 0) > 0)
        .sort(([leftKey], [rightKey]) => {
            if (leftKey === 'silver') return 1;
            if (rightKey === 'silver') return -1;
            return leftKey.localeCompare(rightKey);
        });
    const totalSilverCost = resourceEntries.reduce((sum, [resourceKey, amount]) => (
        sum + Number(amount || 0) * getResourceUnitPrice(resourceKey, prices)
    ), 0);
    const modifierText = [
        `部署 ${Number(modifierBreakdown.frontDeploymentBase || 1).toFixed(2)} × 姿态 ${Number(modifierBreakdown.postureSupplyMod || 1).toFixed(2)}`,
        Number(modifierBreakdown.advanceSupplyPenalty || 0) > 0.01 ? `推进 +${Number(modifierBreakdown.advanceSupplyPenalty || 0).toFixed(2)}` : null,
        Number(modifierBreakdown.supplyLinePenalty || 0) > 0.01 ? `线损 +${Number(modifierBreakdown.supplyLinePenalty || 0).toFixed(2)}` : null,
        Number(modifierBreakdown.battleSupplyMod || 1) > 1.01 ? `会战 ×${Number(modifierBreakdown.battleSupplyMod || 1).toFixed(2)}` : null,
    ].filter(Boolean).join(' · ');

    return (
        <div>
            <div
                className="flex cursor-pointer items-center justify-between gap-3"
                onClick={() => setExpanded(!expanded)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && setExpanded(!expanded)}
            >
                <div>
                    <div className="text-xs font-semibold text-amber-200">
                        ≈ {formatNumberShortCN(totalSilverCost, { decimals: 0 })} 银/日
                    </div>
                    <div className="text-xs text-gray-500">
                        本战线部署军团维护
                    </div>
                </div>
                <span className="text-xs text-gray-500">{expanded ? '▲ 收起' : '▼ 明细'}</span>
            </div>
            {expanded && (
                <div className="mt-1.5 space-y-1 text-xs text-gray-400">
                    <div className="rounded border border-gray-800/70 bg-black/20 px-2 py-1 text-xs leading-relaxed text-gray-500">
                        后勤倍率 ×{logisticsMultiplier.toFixed(2)}
                        {modifierText ? `（${modifierText}）` : ''}
                    </div>
                    {resourceEntries.length === 0 ? (
                        <div>当前没有前线补给需求。</div>
                    ) : resourceEntries.map(([resourceKey, amount]) => {
                        const resourceName = RESOURCES[resourceKey]?.name || resourceKey;
                        const unitPrice = getResourceUnitPrice(resourceKey, prices);
                        const silverValue = Number(amount || 0) * unitPrice;
                        const baseAmount = Number(baseResourceBreakdown[resourceKey] || 0);
                        return (
                            <div key={resourceKey} className="rounded border border-gray-800/60 bg-black/10 px-2 py-1">
                                <div>
                                    {resourceName} {formatNumberShortCN(Number(amount || 0), { decimals: 0 })}
                                    {` × ${formatUnitPrice(unitPrice)}银 = ${formatNumberShortCN(silverValue, { decimals: 0 })}`}
                                </div>
                                {baseAmount > 0 && (
                                    <div className="mt-0.5 text-xs text-gray-500">
                                        基础维护 {formatNumberShortCN(baseAmount, { decimals: 1 })} × 后勤倍率 {logisticsMultiplier.toFixed(2)} ≈ {formatNumberShortCN(baseAmount * logisticsMultiplier, { decimals: 1 })}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

const getEconomicPressureHint = (impact = {}) => {

    const relativePosition = Number(impact.territory?.relativePosition || 50);
    if (relativePosition <= 8) return '腹地受创';
    if (relativePosition <= 15) return '核心区告急';
    if (relativePosition < 35) return '经济区受压';
    if (relativePosition < 50) return '边疆受压';
    return '前线稳定';
};

const MetricBar = ({ label, value, maxValue, colorClass = 'bg-cyan-400', suffix = '', invert = false }) => {
    const safeValue = Math.max(0, Number(value || 0));
    const safeMax = Math.max(safeValue, Number(maxValue || 0), 1);
    const width = invert
        ? Math.max(6, Math.min(100, (safeValue / safeMax) * 100))
        : Math.max(0, Math.min(100, (safeValue / safeMax) * 100));

    return (
        <div>
            <div className="mb-1 flex items-center justify-between text-xs text-gray-400">
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
        <p className="text-xs text-gray-500">{label}</p>
        <p className={`mt-1 text-sm font-semibold ${tone} ${align === 'right' ? 'text-right' : ''}`}>{value}</p>
    </div>
);

// 军团详情展开面板 — 显示兵种配置、将领、战力、军需
const CorpsDetailExpanded = ({ corps, general, epoch, market }) => {
    const units = corps.units || {};
    const unitEntries = Object.entries(units).filter(([, count]) => count > 0);
    const totalUnits = getCorpsTotalUnits(corps);
    const combatPower = calculateCorpsCombatPower(corps, general, epoch);
    const maintenance = calculateArmyMaintenance(units);
    const prices = market?.prices || market || {};
    const bonuses = general ? getGeneralBonuses(general) : null;
    const traits = general ? getTraitDetails(general.traits) : [];
    const taskInfo = CORPS_FRONT_TASKS[corps.frontTask] || CORPS_FRONT_TASKS.assault;

    // 按兵种类别分组
    const unitsByCategory = {};
    for (const [uid, count] of unitEntries) {
        const unit = UNIT_TYPES[uid];
        if (!unit) continue;
        const cat = unit.category || 'unknown';
        if (!unitsByCategory[cat]) unitsByCategory[cat] = [];
        unitsByCategory[cat].push({ uid, unit, count });
    }

    // 计算攻防分项
    let totalAttack = 0;
    let totalDefense = 0;
    for (const [uid, count] of unitEntries) {
        const unit = UNIT_TYPES[uid];
        if (!unit) continue;
        totalAttack += unit.attack * count;
        totalDefense += unit.defense * count;
    }

    // 军需银币折算
    const maintenanceEntries = Object.entries(maintenance).filter(([, v]) => v > 0);
    const totalMaintenanceSilver = maintenanceEntries.reduce((sum, [res, amt]) => {
        if (res === 'silver') return sum + amt;
        const price = Number(prices[res] || RESOURCES[res]?.basePrice || 1);
        return sum + amt * price;
    }, 0);

    return (
        <div className="mt-2 space-y-2 text-xs">
            {/* 兵种配置 */}
            <div className="rounded-lg border border-gray-700/60 bg-black/30 p-2">
                <p className="mb-1.5 font-semibold text-gray-300 flex items-center gap-1">
                    <Icon name="Users" size={12} className="text-cyan-400" />
                    兵种配置 <span className="text-gray-500 font-normal">({totalUnits} 人)</span>
                </p>
                {Object.keys(unitsByCategory).length === 0 ? (
                    <p className="text-gray-500">无编制单位</p>
                ) : (
                    <div className="space-y-1.5">
                        {Object.entries(unitsByCategory).map(([cat, catUnits]) => {
                            const catInfo = UNIT_CATEGORIES[cat];
                            const catTotal = catUnits.reduce((s, u) => s + u.count, 0);
                            return (
                                <div key={cat}>
                                    <div className="flex items-center gap-1 mb-0.5">
                                        <Icon name={catInfo?.icon || 'Circle'} size={10} className={catInfo?.color || 'text-gray-400'} />
                                        <span className={`font-medium ${catInfo?.color || 'text-gray-300'}`}>{catInfo?.name || cat}</span>
                                        <span className="text-gray-500">({catTotal})</span>
                                    </div>
                                    <div className="ml-3 space-y-0.5">
                                        {catUnits.map(({ uid, unit, count }) => (
                                            <div key={uid} className="flex items-center justify-between">
                                                <span className="text-gray-300">{unit.name}</span>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-gray-400">×{count}</span>
                                                    <span className="text-red-400/70" title="攻击">⚔{unit.attack}</span>
                                                    <span className="text-blue-400/70" title="防御">🛡{unit.defense}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* 将领详情 */}
            <div className="rounded-lg border border-gray-700/60 bg-black/30 p-2">
                <p className="mb-1.5 font-semibold text-gray-300 flex items-center gap-1">
                    <Icon name="Star" size={12} className="text-yellow-400" />
                    将领
                </p>
                {general ? (
                    <div className="space-y-1">
                        <div className="flex items-center justify-between">
                            <span className="text-white font-medium">{general.name}</span>
                            <span className="text-gray-400">Lv.{general.level} · 经验 {general.experience || 0}</span>
                        </div>
                        {traits.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                                {traits.map(t => (
                                    <span key={t.id} className="px-1.5 py-0.5 rounded bg-gray-800/80 border border-gray-700/50 text-gray-300">
                                        {t.name} <span className="text-gray-500">{t.desc}</span>
                                    </span>
                                ))}
                            </div>
                        )}
                        {bonuses && (
                            <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-gray-400">
                                {bonuses.attackBonus !== 0 && <span className={bonuses.attackBonus > 0 ? 'text-red-300' : 'text-red-400/60'}>攻击 {bonuses.attackBonus > 0 ? '+' : ''}{(bonuses.attackBonus * 100).toFixed(0)}%</span>}
                                {bonuses.defenseBonus !== 0 && <span className={bonuses.defenseBonus > 0 ? 'text-blue-300' : 'text-blue-400/60'}>防御 {bonuses.defenseBonus > 0 ? '+' : ''}{(bonuses.defenseBonus * 100).toFixed(0)}%</span>}
                                {bonuses.moraleBonus !== 0 && <span className="text-green-300">士气 +{(bonuses.moraleBonus * 100).toFixed(0)}%</span>}
                                {bonuses.speedBonus !== 0 && <span className="text-cyan-300">速度 +{(bonuses.speedBonus * 100).toFixed(0)}%</span>}
                                {bonuses.supplyBonus !== 0 && <span className="text-amber-300">补给 -{(bonuses.supplyBonus * 100).toFixed(0)}%</span>}
                                {bonuses.siegeBonus !== 0 && <span className="text-orange-300">攻城 +{(bonuses.siegeBonus * 100).toFixed(0)}%</span>}
                            </div>
                        )}
                    </div>
                ) : (
                    <p className="text-gray-500 italic">无将领（战力 -{Math.round((1 - NO_GENERAL_PENALTY) * 100)}%）</p>
                )}
            </div>

            {/* 战斗力详情 */}
            <div className="rounded-lg border border-gray-700/60 bg-black/30 p-2">
                <p className="mb-1.5 font-semibold text-gray-300 flex items-center gap-1">
                    <Icon name="Zap" size={12} className="text-purple-400" />
                    战斗力 <span className="text-purple-300 font-mono ml-1">{formatNumberShortCN(combatPower)}</span>
                </p>
                <div className="grid grid-cols-2 gap-1.5">
                    <div className="rounded border border-gray-800/60 bg-black/20 px-2 py-1">
                        <span className="text-gray-500">基础攻击</span>
                        <p className="text-red-300 font-mono">{formatNumberShortCN(totalAttack)}</p>
                    </div>
                    <div className="rounded border border-gray-800/60 bg-black/20 px-2 py-1">
                        <span className="text-gray-500">基础防御</span>
                        <p className="text-blue-300 font-mono">{formatNumberShortCN(totalDefense)}</p>
                    </div>
                </div>
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-gray-400">
                    <span>士气修正 ×{(0.5 + (corps.morale || 100) / 100 * 0.5).toFixed(2)}</span>
                    <span>将领修正 ×{general ? (1 + (bonuses?.attackBonus || 0) * 0.5 + (bonuses?.defenseBonus || 0) * 0.5).toFixed(2) : NO_GENERAL_PENALTY.toFixed(2)}</span>
                    <span>作战任务: {taskInfo.name}</span>
                </div>
            </div>

            {/* 军需详情 */}
            <div className="rounded-lg border border-gray-700/60 bg-black/30 p-2">
                <p className="mb-1.5 font-semibold text-gray-300 flex items-center gap-1">
                    <Icon name="Package" size={12} className="text-amber-400" />
                    日均军需 <span className="text-amber-200 font-mono ml-1">≈ {formatNumberShortCN(totalMaintenanceSilver, { decimals: 0 })} 银</span>
                </p>
                {maintenanceEntries.length === 0 ? (
                    <p className="text-gray-500">无维护消耗</p>
                ) : (
                    <div className="space-y-0.5">
                        {maintenanceEntries.map(([res, amt]) => {
                            const resName = RESOURCES[res]?.name || res;
                            const unitPrice = res === 'silver' ? 1 : Number(prices[res] || RESOURCES[res]?.basePrice || 1);
                            return (
                                <div key={res} className="flex items-center justify-between">
                                    <span className="text-gray-400">{resName}</span>
                                    <span className="text-gray-300 font-mono">
                                        {formatNumberShortCN(amt, { decimals: 1 })}/日
                                        {res !== 'silver' && <span className="text-gray-500 ml-1">(≈{formatNumberShortCN(amt * unitPrice, { decimals: 0 })}银)</span>}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};

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
    epoch,
    market,
}) => {
    const [expandedCorpsId, setExpandedCorpsId] = useState(null);

    return (
        <section className={`rounded-2xl border p-3 ${tone}`}>
            <div className="mb-3 flex items-center justify-between">
                <div>
                    <p className="text-sm font-semibold text-white">{title}</p>
                    <p className="text-xs text-gray-400">
                        兵力 {sideState?.deployedUnits || 0} · 军团 {sideState?.corpsCount || corpsList.length}
                    </p>
                </div>
                <div className="text-right text-xs text-gray-400">
                    <p>补给 {sideState?.supplyState || '稳定'}</p>
                    <p>工事 {sideState?.entrenchment || 25}</p>
                </div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-xl border border-gray-800 bg-black/20 p-2">
                    <p className="text-gray-500">攻势/防御</p>
                    <p className="mt-1 text-white">{Math.round(sideState?.advancePower || 0)} / {Math.round(sideState?.defensePower || 0)}</p>
                </div>
                <div className="rounded-xl border border-gray-800 bg-black/20 p-2">
                    <p className="text-gray-500">补给率</p>
                    <p className="mt-1 text-white">{Math.round((sideState?.supplyRatio ?? 1) * 100)}%</p>
                </div>
            </div>
            <div className="mt-3 space-y-2">
                {corpsList.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-gray-700 bg-black/20 px-3 py-2 text-xs text-gray-500">暂无军团部署</p>
                ) : corpsList.map((corps) => {
                    const general = getCorpsGeneral(generals, corps.id);
                    const isExpanded = expandedCorpsId === corps.id;
                    const combatPower = calculateCorpsCombatPower(corps, general, epoch);
                    return (
                        <div key={corps.id} className={`rounded-xl border bg-black/20 p-2 transition-colors ${isExpanded ? 'border-cyan-600/40 bg-cyan-950/5' : 'border-gray-800 hover:border-gray-700'}`}>
                            <div
                                className="flex items-center justify-between gap-2 cursor-pointer"
                                onClick={() => setExpandedCorpsId(isExpanded ? null : corps.id)}
                                role="button"
                                tabIndex={0}
                                onKeyDown={(e) => e.key === 'Enter' && setExpandedCorpsId(isExpanded ? null : corps.id)}
                            >
                                <div className="text-xs flex-1 min-w-0">
                                    <p className="font-semibold text-white flex items-center gap-1">
                                        <Icon name={isExpanded ? 'ChevronDown' : 'ChevronRight'} size={12} className="text-gray-500 flex-shrink-0" />
                                        {corps.name}
                                        <span className="text-gray-500">({getCorpsTotalUnits(corps)})</span>
                                        <span className="text-purple-400/70 font-mono ml-1">⚔{formatNumberShortCN(combatPower)}</span>
                                    </p>
                                    <p className="text-xs text-gray-400 ml-4">
                                        {general ? `将领 ${general.name} Lv.${general.level || 1}` : '无将领'} · 士气 {Math.round(corps.morale || 100)}
                                    </p>
                                </div>
                                {canControlTasks && (
                                    <button
                                        type="button"
                                        className="rounded bg-gray-700 px-1.5 py-0.5 text-xs text-gray-300 hover:bg-gray-600 flex-shrink-0"
                                        onClick={(e) => { e.stopPropagation(); onRemoveCorpsFromFront?.(front.id, corps.id, playerSide); }}
                                    >
                                        撤回
                                    </button>
                                )}
                            </div>
                            {isExpanded && (
                                <CorpsDetailExpanded corps={corps} general={general} epoch={epoch} market={market} />
                            )}
                        </div>
                    );
                })}
            </div>
            {canControlTasks && (
                <div className="mt-3 rounded-xl border border-dashed border-cyan-800/40 bg-cyan-950/10 p-3">
                    <div className="mb-2 flex items-center justify-between gap-3">
                        <p className="text-xs font-semibold text-cyan-100">可派遣军团</p>
                        <p className="text-xs text-gray-400">{reserveCorps.length} 支待命</p>
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
                        <p className="text-xs text-gray-500">当前没有可直接派遣到这条战线的待命军团。</p>
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
    market,
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
    const frontContext = useMemo(() => ({
        ...front,
        playerResources: resources || {},
        sideResources: {
            attacker: front.attackerId === 'player' ? (resources || {}) : (attackerNation?.military?.stockpile || {}),
            defender: front.defenderId === 'player' ? (resources || {}) : (defenderNation?.military?.stockpile || {}),
        },
    }), [attackerNation, defenderNation, front, resources]);
    const summary = useMemo(() => (
        summarizeFrontState(
            frontContext,
            playerSide === 'attacker' ? playerCorpsList : enemyCorpsList,
            playerSide === 'attacker' ? enemyCorpsList : playerCorpsList
        )
    ), [enemyCorpsList, frontContext, playerCorpsList, playerSide]);
    const currentZone = getDisplayZoneForPosition(relativeLinePosition);
    const playerLineVelocity = playerSide === 'attacker' ? Number(front.lineVelocity || 0) : -Number(front.lineVelocity || 0);
    const playerLineVelocityText = playerLineVelocity > 0.15 ? '我方前推' : playerLineVelocity < -0.15 ? '敌军压进' : '战线僵持';
    const frontBattles = (activeBattles || []).filter((battle) => battle && battle.frontId === front.id);
    const activeFrontBattles = frontBattles.filter((battle) => isBattleActive(battle));
    const primaryBattle = activeFrontBattles[0] || null;
    const nextCheckpoint = CHECKPOINTS.find((cp) => cp > relativeLinePosition);
    const ownState = summary.playerView?.own || summary.sideState?.[playerSide] || {};
    const enemyState = summary.playerView?.enemy || summary.sideState?.[enemySide] || {};
    const ownEconomicImpact = useMemo(() => getFrontlineEconomicModifiers(frontContext, 'player', day, ownState?.deployedUnits || 0, 100, resources || {}), [day, frontContext, ownState?.deployedUnits, resources]);
    const enemyEconomicImpact = useMemo(() => getFrontlineEconomicModifiers(frontContext, enemyId, day, enemyState?.deployedUnits || 0, 100, enemyNation?.military?.stockpile || {}), [day, enemyId, enemyNation, enemyState?.deployedUnits, frontContext]);
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
                            <span className="rounded-full border border-gray-700 px-2 py-0.5 text-xs text-gray-300">{phaseText}</span>
                            <span className="rounded-full border border-cyan-400/40 bg-cyan-950/20 px-2.5 py-0.5 text-xs font-semibold text-cyan-100">
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
                    <div className="mb-1 flex items-center justify-between text-xs text-gray-400">
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

            {activeFrontBattles.length > 0 && (
                <ActiveBattlePanel
                    activeBattles={activeFrontBattles}
                    playerSide={playerSide}
                />
            )}

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
                    epoch={epoch}
                    market={market}
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
                    epoch={epoch}
                    market={market}
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
                                <MetricBar label="生产效率损失" value={Math.round(Number(ownEconomicImpact?.productionPenalty || 0) * 100)} maxValue={80} colorClass="bg-red-400" suffix="%" />
                                <MetricBar label="税收效率损失" value={Math.round(Number(ownEconomicImpact?.taxEfficiencyPenalty || 0) * 100)} maxValue={85} colorClass="bg-orange-400" suffix="%" />
                            </div>
                            <div className="mt-2 grid gap-2">
                                <div className="rounded-lg border border-gray-800/80 bg-black/20 px-2 py-1.5">
                                    <span className="text-xs text-gray-500">日前线补给</span>

                                    <SupplyNeedDisplay impact={ownEconomicImpact} priceSource={market} />

                                </div>
                                <EconomyDataRow
                                    label="掠夺流"
                                    value={(() => {
                                        const net = Number(ownEconomicImpact?.plunder?.netPlunderFlow || 0);
                                        const gain = Number(ownEconomicImpact?.plunder?.playerDailyPlunderGain || 0);
                                        const loss = Number(ownEconomicImpact?.plunder?.playerDailyPlunderLoss || 0);
                                        if (gain <= 0 && loss <= 0) return '0/天';
                                        if (net > 0) return `+${(net * 100).toFixed(1)}%/天`;
                                        if (net < 0) return `${(net * 100).toFixed(1)}%/天`;
                                        return '0/天';
                                    })()}
                                    tone={(() => {
                                        const net = Number(ownEconomicImpact?.plunder?.netPlunderFlow || 0);
                                        if (net > 0.001) return 'text-emerald-300';
                                        if (net < -0.001) return 'text-red-300';
                                        return 'text-gray-400';
                                    })()}
                                />
                                <EconomyDataRow label="累计掠夺" value={formatNumberShortCN(ownEconomicImpact?.cumulative?.lootGained || 0, { decimals: 1 })} tone="text-emerald-300" />
                                <EconomyDataRow label="累计被掠夺" value={formatNumberShortCN(ownEconomicImpact?.cumulative?.lootLost || 0, { decimals: 1 })} tone="text-red-300" />
                                <EconomyDataRow label="建筑破坏" value={`损失 ${formatNumberShortCN(ownEconomicImpact?.cumulative?.buildingsLost || 0, { decimals: 0 })} / 摧毁 ${formatNumberShortCN(ownEconomicImpact?.cumulative?.buildingsDestroyed || 0, { decimals: 0 })}`} />
                                <EconomyDataRow label="本土压力" value={formatNumberShortCN(ownEconomicImpact?.territory?.homelandPressure || 0, { decimals: 0 })} tone="text-amber-300" />
                            </div>
                            <p className="mt-2 text-xs text-gray-500">{formatFrontPenaltyText(ownEconomicImpact)} ? {getEconomicPressureHint(ownEconomicImpact)}</p>
                        </div>
                        <div className="rounded-xl border border-red-900/40 bg-red-950/10 p-2 text-xs">
                            <p className="mb-1 font-semibold text-white">敌方</p>
                            <MetricBar label="补给率" value={Math.round(Number(enemyState?.supplyRatio || 0) * 100)} maxValue={100} colorClass={Number(enemyState?.supplyRatio || 0) >= 0.85 ? 'bg-emerald-400' : Number(enemyState?.supplyRatio || 0) >= 0.65 ? 'bg-yellow-400' : 'bg-red-400'} suffix="%" />
                            <div className="mt-2 space-y-1">
                                <MetricBar label="生产效率损失" value={Math.round(Number(enemyEconomicImpact?.productionPenalty || 0) * 100)} maxValue={80} colorClass="bg-red-400" suffix="%" />
                                <MetricBar label="税收效率损失" value={Math.round(Number(enemyEconomicImpact?.taxEfficiencyPenalty || 0) * 100)} maxValue={85} colorClass="bg-orange-400" suffix="%" />
                            </div>
                            <div className="mt-2 grid gap-2">
                                <div className="rounded-lg border border-gray-800/80 bg-black/20 px-2 py-1.5">
                                    <span className="text-xs text-gray-500">日前线补给</span>
                                    <SupplyNeedDisplay impact={enemyEconomicImpact} priceSource={enemyNation?.nationPrices || enemyNation?.market || {}} />
                                </div>
                                <EconomyDataRow label="累计掠夺" value={formatNumberShortCN(enemyEconomicImpact?.cumulative?.lootGained || 0, { decimals: 1 })} tone="text-emerald-300" />
                                <EconomyDataRow label="累计被掠夺" value={formatNumberShortCN(enemyEconomicImpact?.cumulative?.lootLost || 0, { decimals: 1 })} tone="text-red-300" />
                                <EconomyDataRow label="建筑破坏" value={`损失 ${formatNumberShortCN(enemyEconomicImpact?.cumulative?.buildingsLost || 0, { decimals: 0 })} / 摧毁 ${formatNumberShortCN(enemyEconomicImpact?.cumulative?.buildingsDestroyed || 0, { decimals: 0 })}`} />
                                <EconomyDataRow label="本土压力" value={formatNumberShortCN(enemyEconomicImpact?.territory?.homelandPressure || 0, { decimals: 0 })} tone="text-amber-300" />

                            </div>
                            <p className="mt-2 text-xs text-gray-500">{formatFrontPenaltyText(enemyEconomicImpact)} · {getEconomicPressureHint(enemyEconomicImpact)}</p>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
};

export default memo(FrontViewPanel);
