/**
 * 改良法令面板 - 建制派主导时显示
 * 允许玩家花钱颁布临时法令，获得较大加成，但有较长CD
 */

import React from 'react';
import { Icon } from '../../common/UIComponents';
import { getAllTimedDecrees, getLegacyPolicyDecrees, isDecreeAvailable } from '../../../logic/officials/cabinetSynergy';
import { STRATA } from '../../../config/strata';
import { BUILDINGS } from '../../../config/buildings';
import { RESOURCES } from '../../../config/gameConstants';

const BUILDING_NAME_BY_ID = (() => {
    const map = Object.create(null);
    (BUILDINGS || []).forEach(b => {
        if (b?.id) map[b.id] = b.name || b.id;
    });
    return map;
})();

const RESOURCE_NAME_BY_ID = (() => {
    const map = Object.create(null);
    Object.entries(RESOURCES || {}).forEach(([id, cfg]) => {
        map[id] = cfg?.name || id;
    });
    return map;
})();

const STRATUM_NAME_BY_ID = (() => {
    const map = Object.create(null);
    Object.entries(STRATA || {}).forEach(([id, cfg]) => {
        map[id] = cfg?.name || id;
    });
    return map;
})();

/**
 * 格式化效果显示
 */
const formatDecreeEffect = (key, value) => {
    const effectLabels = {
        taxIncome: '税收',
        production: '全局生产',
        industry: '工业产出',
        stability: '稳定度',
        militaryBonus: '军事力量',
        scienceBonus: '科研产出',
        cultureBonus: '文化产出',
        maxPop: '人口上限',
        gatherBonus: '采集产出',
        populationGrowth: '人口增长', // 新增
        incomePercent: '财政收入加成',
        buildCostReduction: '建筑成本',
        needsReduction: '居民需求',
    };

    const buildingNameById = BUILDING_NAME_BY_ID;
    const resourceNameById = RESOURCE_NAME_BY_ID;
    const stratumNameById = STRATUM_NAME_BY_ID;

    // Small helpers
    const percent = (n) => `${n > 0 ? '+' : ''}${Math.round(n * 100)}%`;
    const signed = (n) => `${n > 0 ? '+' : ''}${n}`;

    // 处理 categories 对象
    if (key === 'categories') {
        const catLabels = { gather: '采集', industry: '工业', civic: '民用', military: '军事' };
        return Object.entries(value).map(([cat, val]) => {
            const catName = catLabels[cat] || cat;
            return `${catName}产出 ${percent(val)}`;
        }).join(', ');
    }

    // 处理 buildings 对象（按建筑类型的产出修正）
    if (key === 'buildings') {
        return Object.entries(value).map(([b, val]) => {
            const buildingName = buildingNameById[b] || b;
            return `${buildingName}产出 ${percent(val)}`;
        }).join(', ');
    }

    // buildings_negative：与 buildings 类似，但明确为“负面修正”（用于描述里单独列出来）
    if (key === 'buildings_negative') {
        return Object.entries(value).map(([b, val]) => {
            const buildingName = buildingNameById[b] || b;
            return `${buildingName}产出 ${percent(val)}`;
        }).join(', ');
    }

    // 处理 passive 对象（直接增加资源/点数）
    if (key === 'passive') {
        return Object.entries(value).map(([res, val]) => {
            const name = resourceNameById[res] || res;
            if (typeof val === 'number') return `${name} ${signed(val)}`;
            return `${name} ${String(val)}`;
        }).join(', ');
    }

    // 处理 passivePercent 对象（资源百分比修正：silver/food 等）
    if (key === 'passivePercent') {
        return Object.entries(value).map(([res, val]) => {
            const name = resourceNameById[res] || res;
            return `${name}产出 ${percent(val)}`;
        }).join(', ');
    }

    // 处理 resourceSupplyMod / resourceDemandMod
    if (key === 'resourceSupplyMod' || key === 'resourceDemandMod') {
        const prefix = key === 'resourceSupplyMod' ? '供应' : '需求';
        return Object.entries(value).map(([res, val]) => {
            const name = resourceNameById[res] || res;
            return `${name}${prefix} ${percent(val)}`;
        }).join(', ');
    }

    // 处理 stratumDemandMod（阶层消费/需求）
    if (key === 'stratumDemandMod') {
        return Object.entries(value).map(([s, val]) => {
            const name = stratumNameById[s] || s;
            return `${name}消费 ${percent(val)}`;
        }).join(', ');
    }

    // 处理 approval（阶层好感）
    if (key === 'approval') {
        return Object.entries(value).map(([s, val]) => {
            const name = stratumNameById[s] || s;
            return `${name}好感 ${signed(val)}`;
        }).join(', ');
    }

    const label = effectLabels[key] || key;
    if (typeof value === 'number') {
        // 人口上限是百分比（例如 0.08 => +8%）
        if (key === 'maxPop') {
            return `${label} ${percent(value)}`;
        }
        // 建筑成本：用 %
        if (key === 'buildCostReduction') {
            return `${label} ${percent(-value)}`; // reduction=0.1 => -10%
        }
        // 居民需求：needsReduction=0.15 => -15%
        if (key === 'needsReduction') {
            return `${label} ${percent(-value)}`;
        }
        // 百分比值
        if (Math.abs(value) < 1) {
            return `${label} ${percent(value)}`;
        }
        return `${label} ${signed(value)}`;
    }

    // Fallback to avoid [object Object]
    if (typeof value === 'object' && value !== null) {
        return `${label}`;
    }

    return `${label}: ${String(value)}`;
};

/**
 * 单个法令卡片
 */
const DecreeCard = ({
    decree,
    isActive,
    remainingDays,
    cooldownRemaining,
    canEnact,
    reason,
    onEnact,
    disabled,
}) => {
    const isOnCooldown = cooldownRemaining > 0;

    return (
        <div className={`
            p-3 rounded-lg border transition-all
            ${isActive
                ? 'bg-blue-900/30 border-blue-700/50'
                : isOnCooldown
                    ? 'bg-gray-800/30 border-gray-700/30 opacity-60'
                    : 'bg-gray-800/50 border-gray-700/40 hover:border-gray-600'}
        `}>
            {/* 标题行 */}
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                    <Icon name={decree.icon} size={16} className={isActive ? 'text-blue-400' : 'text-gray-400'} />
                    <span className={`text-sm font-bold ${isActive ? 'text-blue-300' : 'text-gray-200'}`}>
                        {decree.name}
                    </span>
                </div>
                {isActive && (
                    <span className="text-xs text-blue-400 bg-blue-900/40 px-2 py-0.5 rounded">
                        生效中: {remainingDays}天
                    </span>
                )}
                {isOnCooldown && !isActive && (
                    <span className="text-xs text-gray-500">
                        冷却: {cooldownRemaining}天
                    </span>
                )}
            </div>

            {/* 描述 */}
            <p className="text-xs text-gray-500 mb-2">{decree.description}</p>

            {/* 效果列表 */}
            <div className="flex flex-wrap gap-1 mb-2">
                {Object.entries(decree.effects).map(([key, val]) => {
                    const isNegative = typeof val === 'number' && val < 0;
                    // dailyCost removed from data but kept logic just in case
                    const isBad = (isNegative && key !== 'consumptionReduction' && key !== 'buildingCostMod') || key === 'dailyCost' || key === 'decreeSilverExpense';

                    return (
                        <span
                            key={key}
                            className={`text-[10px] px-1.5 py-0.5 rounded ${isBad
                                ? 'bg-red-900/30 text-red-400'
                                : 'bg-green-900/30 text-green-400'
                                }`}
                        >
                            {formatDecreeEffect(key, val)}
                        </span>
                    );
                })}
            </div>

            {/* 持续时间和成本 */}
            <div className="flex items-center justify-between text-xs text-gray-500">
                <span>持续 {decree.duration} 天 / 冷却 {decree.cooldown} 天</span>
                <span className="flex items-center gap-1">
                    <Icon name="Coins" size={12} className="text-yellow-500" />
                    {decree.cost}
                </span>
            </div>

            {/* 颁布按钮 */}
            {!isActive && (
                <button
                    onClick={() => onEnact(decree.id)}
                    disabled={disabled || !canEnact}
                    className={`
                        w-full mt-2 py-1.5 rounded text-xs font-bold flex items-center justify-center gap-1
                        ${!disabled && canEnact
                            ? 'bg-blue-600 hover:bg-blue-500 text-white'
                            : 'bg-gray-700 text-gray-500 cursor-not-allowed'}
                    `}
                    title={reason || ''}
                >
                    <Icon name="Scroll" size={12} />
                    {canEnact ? '启动政令' : (reason || '不可用')}
                </button>
            )}
        </div>
    );
};

/**
 * 改良法令面板
 */
export const ReformDecreePanel = ({
    // Timed reform decrees
    activeDecrees = {},
    decreeCooldowns = {},
    currentDay = 0,
    silver = 0,
    onEnactDecree,

    // Permanent legacy policy decrees
    decrees = [],
    policySlots = 3,
    onTogglePolicyDecree,

    disabled = false,
}) => {
    const [tab, setTab] = React.useState('all');

    const timedDecrees = Object.values(getAllTimedDecrees());
    const legacyPolicyMap = React.useMemo(() => getLegacyPolicyDecrees(), []);
    const legacyPolicies = React.useMemo(() => Object.values(legacyPolicyMap), [legacyPolicyMap]);

    const TAB_DEFS = [
        { id: 'all', label: '全部' },
        { id: 'military', label: '军事' },
        { id: 'economy', label: '经济' },
        { id: 'social', label: '社会' },
        { id: 'culture', label: '文化' },
        { id: 'other', label: '其他' },
    ];

    const normalizeCategory = (cat) => {
        if (!cat) return null;
        const c = String(cat).toLowerCase();
        if (c === 'military' || c === 'economy' || c === 'social' || c === 'culture') return c;
        return null;
    };

    const getDecreeCategory = (d) => {
        const legacyCat = normalizeCategory(d.category);
        if (legacyCat) return legacyCat;

        // Map reform decrees to sensible tabs
        const id = d.id;
        if (id === 'militaryMobilization') return 'military';
        if (id === 'emergencyGrain' || id === 'tradeCharter' || id === 'industrialSubsidy' || id === 'taxHoliday') return 'economy';
        if (id === 'migrationIncentive') return 'social';

        return 'other';
    };

    const visibleTimedDecrees = React.useMemo(() => {
        if (tab === 'all') return timedDecrees;
        return timedDecrees.filter(d => getDecreeCategory(d) === tab);
    }, [timedDecrees, tab]);

    const visibleLegacyPolicies = React.useMemo(() => {
        if (tab === 'all') return legacyPolicies;
        return legacyPolicies.filter(d => getDecreeCategory(d) === tab);
    }, [legacyPolicies, tab]);

    // Timed decree status
    const getTimedDecreeStatus = (decreeId) => {
        const decree = getAllTimedDecrees()[decreeId];
        const activeData = activeDecrees[decreeId];
        const isActive = !!activeData;
        const remainingDays = isActive ? Math.max(0, activeData.endDay - currentDay) : 0;

        const cooldownEnd = decreeCooldowns[decreeId] || 0;
        const cooldownRemaining = Math.max(0, cooldownEnd - currentDay);

        const { available, reason } = isDecreeAvailable(
            decreeId, activeDecrees, decreeCooldowns, currentDay, silver
        );

        return {
            isActive,
            remainingDays,
            cooldownRemaining,
            canEnact: available,
            reason,
        };
    };

    // Policy slots usage
    const equippedPolicyIds = React.useMemo(() => {
        const set = new Set();
        (decrees || []).forEach(d => {
            if (d?.id && d.active) set.add(d.id);
        });
        return set;
    }, [decrees]);

    const usedSlots = React.useMemo(() => {
        let used = 0;
        equippedPolicyIds.forEach((id) => {
            const def = legacyPolicyMap[id];
            used += def?.slotCost || 1;
        });
        return used;
    }, [equippedPolicyIds, legacyPolicyMap]);

    const freeSlots = Math.max(0, (policySlots || 0) - usedSlots);

    // UI counts
    const activeTimedCount = Object.keys(activeDecrees).length;
    const activePolicyCount = equippedPolicyIds.size;

    return (
        <div className="bg-gray-800/50 rounded-lg p-4 border border-blue-900/30">
            {/* 标题 */}
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <Icon name="Scroll" size={18} className="text-blue-400" />
                    <span className="text-sm font-bold text-blue-300">政令</span>
                </div>
                <div className="flex items-center gap-3 text-xs">
                    <span className="text-blue-400">临时生效: {activeTimedCount}</span>
                    <span className="text-amber-300">政策槽: {usedSlots}/{policySlots}（{activePolicyCount}项）</span>
                </div>
            </div>

            {/* 说明 */}
            <p className="text-xs text-gray-500 mb-3">
                改良法令为临时政令：需要启动成本，过期后进入冷却。传统政令改为长期政策：占用有限的政策槽位。
            </p>

            {/* 分类 Tab */}
            <div className="flex flex-wrap gap-2 mb-4">
                {TAB_DEFS.map(t => (
                    <button
                        key={t.id}
                        onClick={() => setTab(t.id)}
                        className={
                            `px-2.5 py-1 rounded text-xs font-bold border transition-all ` +
                            (tab === t.id
                                ? 'bg-blue-700/40 border-blue-500/60 text-blue-200'
                                : 'bg-gray-900/40 border-gray-700/60 text-gray-300 hover:border-gray-500')
                        }
                    >
                        {t.label}
                    </button>
                ))}
            </div>

            {/* 传统政令（长期政策） */}
            {visibleLegacyPolicies.length > 0 && (
                <div className="mb-5">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-gray-300">传统政令（政策槽位）</span>
                        <span className="text-[10px] text-gray-500">{visibleLegacyPolicies.length} 项 / 空余 {freeSlots}</span>
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                        {visibleLegacyPolicies.map((policy) => {
                            const isEquipped = equippedPolicyIds.has(policy.id);
                            const slotCost = policy.slotCost || 1;
                            const canEquip = isEquipped || slotCost <= freeSlots;
                            const reason = canEquip ? '' : `需要 ${slotCost} 槽位（空余 ${freeSlots}）`;

                            return (
                                <div
                                    key={policy.id}
                                    className={`p-3 rounded-lg border transition-all ${isEquipped
                                        ? 'bg-amber-900/25 border-amber-700/50'
                                        : 'bg-gray-800/50 border-gray-700/40 hover:border-gray-600'
                                        }`}
                                >
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-2">
                                            <Icon name={policy.icon || 'Scale'} size={16} className={isEquipped ? 'text-amber-300' : 'text-gray-400'} />
                                            <span className={`text-sm font-bold ${isEquipped ? 'text-amber-200' : 'text-gray-200'}`}>
                                                {policy.name}
                                            </span>
                                        </div>
                                        <span className={`text-xs px-2 py-0.5 rounded ${isEquipped ? 'text-amber-300 bg-amber-900/40' : 'text-gray-500 bg-gray-900/40'}`}>
                                            槽位 {slotCost}
                                        </span>
                                    </div>

                                    <p className="text-xs text-gray-500 mb-2">{policy.description}</p>

                                    <div className="flex flex-wrap gap-1 mb-2">
                                        {Object.entries(policy.effects || policy.modifiers || {}).map(([key, val]) => {
                                            const isNegative = typeof val === 'number' && val < 0;
                                            return (
                                                <span
                                                    key={key}
                                                    className={`text-[10px] px-1.5 py-0.5 rounded ${isNegative
                                                        ? 'bg-red-900/30 text-red-400'
                                                        : 'bg-green-900/30 text-green-400'
                                                        }`}
                                                >
                                                    {formatDecreeEffect(key, val)}
                                                </span>
                                            );
                                        })}
                                    </div>

                                    <button
                                        onClick={() => onTogglePolicyDecree && onTogglePolicyDecree(policy.id)}
                                        disabled={disabled || !canEquip}
                                        className={`w-full mt-2 py-1.5 rounded text-xs font-bold flex items-center justify-center gap-1 transition-all ${(!disabled && canEquip)
                                            ? (isEquipped
                                                ? 'bg-gray-700 hover:bg-gray-600 text-gray-200 opacity-80'
                                                : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm shadow-emerald-700/30')
                                            : 'bg-gray-800/60 text-gray-500 cursor-not-allowed opacity-70'
                                            }`}
                                        title={reason}
                                    >
                                        <Icon name={isEquipped ? 'X' : 'Plus'} size={12} />
                                        {isEquipped ? '卸下政策' : (canEquip ? '装备政策' : reason)}
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* 改良法令（临时） */}
            {visibleTimedDecrees.length > 0 && (
                <div className="mb-2">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-gray-300">内阁专项（改良法令/临时）</span>
                        <span className="text-[10px] text-gray-500">{visibleTimedDecrees.length} 项</span>
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                        {visibleTimedDecrees.map((decree) => {
                            const status = getTimedDecreeStatus(decree.id);
                            return (
                                <DecreeCard
                                    key={decree.id}
                                    decree={decree}
                                    isActive={status.isActive}
                                    remainingDays={status.remainingDays}
                                    cooldownRemaining={status.cooldownRemaining}
                                    canEnact={status.canEnact}
                                    reason={status.reason}
                                    onEnact={onEnactDecree}
                                    disabled={disabled}
                                />
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};

export default ReformDecreePanel;
