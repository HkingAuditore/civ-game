/**
 * 理念子Tab — 卡槽界面与理念库
 * 显示理念分数进度、卡槽区域、理念库
 */

import React, { useState, useMemo, useEffect, memo, useCallback } from 'react';
import { Icon } from '../common/UIComponents';
import { IDEOLOGY_MAP, IDEOLOGIES } from '../../config/ideologies';
import { IDEOLOGY_SYNERGIES, ANTI_SYNERGIES } from '../../config/ideologySynergies';
import { getEmergenceThreshold } from '../../logic/ideology/ideologyScoring';
import { getMaxSlots, equipIdeology, unequipIdeology, resolveEquippedIdeologies } from '../../logic/ideology/ideologySlots';
import { trackIdeologyEquip, trackIdeologyUnequip } from '../../analytics/gaTracker';
import { IdeologyCard } from './IdeologyCard';
import { IdeologyDetailSheet } from './IdeologyDetailSheet';
import { useDevicePerformance } from '../../hooks';

/** 效果键的中文标签（与IdeologyCard保持一致） */
const EFFECT_LABELS = {
    stability: '稳定度',
    cultureBonus: '文化产出',
    scienceBonus: '科研产出',
    militaryBonus: '全军战力',
    taxIncome: '税收加成',
    maxPop: '人口上限',
    production: '采集/市政产出',
    industryBonus: '工业产出',
    categories: null, // 特殊处理
};

const CATEGORY_LABELS = {
    gather: '采集类',
    civic: '市政类',
    industry: '工业类',
    military: '军事类',
};

const ABSOLUTE_KEYS = new Set(['stability', 'flatPop']);

/** 将 effects 对象格式化为简短描述字符串 */
function formatSynergyEffects(effects = {}) {
    if (!effects) return '';
    const parts = [];
    for (const [key, value] of Object.entries(effects)) {
        if (key === 'categories' && typeof value === 'object') {
            for (const [cat, cv] of Object.entries(value)) {
                if (typeof cv === 'number' && cv !== 0) {
                    const catName = CATEGORY_LABELS[cat] || cat;
                    const sign = cv > 0 ? '+' : '';
                    parts.push(`${catName}产出${sign}${(cv * 100).toFixed(0)}%`);
                }
            }
            continue;
        }
        if (key === 'perPopPassive' && typeof value === 'object') continue; // 太复杂，跳过
        const label = EFFECT_LABELS[key];
        if (label && typeof value === 'number' && value !== 0) {
            const sign = value > 0 ? '+' : '';
            const formatted = ABSOLUTE_KEYS.has(key)
                ? `${sign}${value}`
                : `${sign}${(value * 100).toFixed(0)}%`;
            parts.push(`${label}${formatted}`);
        }
    }
    return parts.join(' / ');
}

/**
 * 联动效果展示条
 */
const MECHANIC_LABELS = {
    auto_build: m => `自动建造 ${m.buildingId || ''}（每${m.intervalDays || '?'}天）`,
    resource_echo: m => `${m.sourceResource || '?'} → ${m.echoResource || '?'}（${((m.ratio || 0) * 100).toFixed(1)}%回声）`,
    crisis_immunity: m => `免疫: ${m.immuneTo === 'on_stability_crisis' ? '稳定度危机' : (m.immuneTo || '?')}`,
    epoch_rush: m => `时代升级费用 -${((m.costReduction || 0) * 100).toFixed(0)}%`,
};

const SynergyBar = ({ synergy, isActive }) => {
    const effectText = formatSynergyEffects(synergy.effects);
    const requiredNames = synergy.required.map(id => IDEOLOGY_MAP[id]?.name || id).join(' + ');
    const mechanicLabel = synergy.mechanicEffect
        ? (MECHANIC_LABELS[synergy.mechanicEffect.type]?.(synergy.mechanicEffect) || synergy.mechanicEffect.type)
        : null;
    return (
        <div className={`px-2 py-1.5 rounded-lg border text-xs transition-all ${
            isActive
                ? 'border-yellow-500/50 bg-yellow-900/20 text-yellow-200'
                : 'border-gray-700/30 bg-gray-900/30 text-gray-500'
        }`}>
            <div className="flex items-center gap-2">
                <Icon name={isActive ? 'Zap' : 'Link'} size={12} className={isActive ? 'text-yellow-400' : 'text-gray-600'} />
                <span className="font-semibold">{synergy.name}</span>
                {isActive
                    ? <span className="text-yellow-400 text-[10px]">✓ 已激活</span>
                    : <span className="text-gray-500 text-[10px]">需要: {requiredNames}</span>
                }
            </div>
            {synergy.desc && (
                <div className={`mt-0.5 ml-5 text-[10px] italic ${
                    isActive ? 'text-yellow-200/60' : 'text-gray-600'
                }`}>
                    {synergy.desc}
                </div>
            )}
            {effectText && (
                <div className={`mt-0.5 ml-5 text-[10px] ${
                    isActive ? 'text-yellow-300/80' : 'text-gray-600'
                }`}>
                    {effectText}
                </div>
            )}
            {mechanicLabel && (
                <div className={`mt-0.5 ml-5 text-[10px] ${
                    isActive ? 'text-amber-400/90' : 'text-gray-600'
                }`}>
                    ⚙ {mechanicLabel}
                </div>
            )}
        </div>
    );
};

/**
 * 反协同警告展示条
 */
const AntiSynergyBar = ({ antiSynergy, isActive }) => {
    const effectText = formatSynergyEffects(antiSynergy.effects);
    const requiredNames = antiSynergy.required.map(id => IDEOLOGY_MAP[id]?.name || id).join(' + ');
    return (
        <div className={`px-2 py-1.5 rounded-lg border text-xs transition-all ${
            isActive
                ? 'border-red-500/50 bg-red-900/20 text-red-200'
                : 'border-gray-700/30 bg-gray-900/30 text-gray-500'
        }`}>
            <div className="flex items-center gap-2">
                <Icon name={isActive ? 'AlertTriangle' : 'Link'} size={12} className={isActive ? 'text-red-400' : 'text-gray-600'} />
                <span className="font-semibold">{antiSynergy.name}</span>
                {isActive
                    ? <span className="text-red-400 text-[10px]">⚠ 矛盾激活</span>
                    : <span className="text-gray-500 text-[10px]">冲突: {requiredNames}</span>
                }
            </div>
            {antiSynergy.desc && (
                <div className={`mt-0.5 ml-5 text-[10px] italic ${
                    isActive ? 'text-red-200/60' : 'text-gray-600'
                }`}>
                    {antiSynergy.desc}
                </div>
            )}
            {effectText && (
                <div className={`mt-0.5 ml-5 text-[10px] ${
                    isActive ? 'text-red-300/80' : 'text-gray-600'
                }`}>
                    {effectText}
                </div>
            )}
        </div>
    );
};

/**
 * 激活中的限时Buff展示条
 */
const ActiveBuffBar = ({ buff }) => {
    const remaining = buff.remainingDays ?? buff.duration ?? 0;
    return (
        <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg border border-amber-500/40 bg-amber-900/20 text-xs">
            <Icon name="Sparkles" size={12} className="text-amber-400 flex-shrink-0" />
            <div className="flex-1 min-w-0">
                <span className="font-semibold text-amber-200">{buff.name || buff.buffId}</span>
                {buff.source && (
                    <span className="text-amber-400/60 ml-1 text-[10px]">({buff.source})</span>
                )}
            </div>
            <span className="text-amber-300 text-[10px] flex-shrink-0">剩余{remaining}天</span>
        </div>
    );
};

/**
 * 稀有度筛选配置
 */
const RARITY_FILTER_CONFIG = {
    common:    { label: '普通', color: 'text-gray-400',  bgClass: 'bg-gray-700/40' },
    uncommon:  { label: '稀有', color: 'text-green-400', bgClass: 'bg-green-900/40' },
    rare:      { label: '史诗', color: 'text-blue-400',  bgClass: 'bg-blue-900/40' },
    legendary: { label: '传奇', color: 'text-amber-400', bgClass: 'bg-amber-900/40' },
};

/**
 * 空卡槽占位
 */
const EmptySlot = ({ isLocked = false, unlockHint = '' }) => (
    <div className={`flex flex-col items-center justify-center min-h-[100px] rounded-xl border-2 border-dashed transition-all ${
        isLocked
            ? 'border-gray-700/40 bg-gray-900/30'
            : 'border-gray-600/50 bg-gray-800/20 hover:border-gray-500/60'
    }`}>
        {isLocked ? (
            <>
                <Icon name="Lock" size={16} className="text-gray-600 mb-1" />
                <span className="text-[10px] text-gray-600">{unlockHint || '进入下一时代解锁'}</span>
            </>
        ) : (
            <>
                <Icon name="Plus" size={16} className="text-gray-500 mb-1" />
                <span className="text-[10px] text-gray-500">空卡槽</span>
            </>
        )}
    </div>
);

/** 未装备理念收藏上限 */
const MAX_COLLECTION_SIZE = 9;

/**
 * 理念Tab主组件
 */
const IdeologyTabComponent = ({
    // 状态
    ideologyScore = 0,
    ideologyScoreSpent = 0,
    ideologyCollection = [],
    equippedIdeologies = [],
    ideologySlotCount = 3,
    ideologyCooldowns = {},
    epoch = 0,
    techsUnlocked = [],
    activeBuffs = [],       // 当前激活的限时buff列表
    // setter
    setEquippedIdeologies,
    setIdeologyCooldowns,
    setIdeologySlotCount,
}) => {
    const [rarityFilter, setRarityFilter] = useState('all');

    // 移动端检测
    const { isLowPerformanceMode } = useDevicePerformance();
    const isMobile = isLowPerformanceMode; // 低性能模式通常是移动端

    // 计算最大卡槽数
    const maxSlots = useMemo(
        () => getMaxSlots(epoch, techsUnlocked),
        [epoch, techsUnlocked]
    );

    // 更新卡槽数（响应时代变化）
    useEffect(() => {
        if (maxSlots > ideologySlotCount && setIdeologySlotCount) {
            setIdeologySlotCount(maxSlots);
        }
    }, [maxSlots, ideologySlotCount, setIdeologySlotCount]);

    // 涌现阈值
    const ownedCount = ideologyCollection.length;
    const availableScore = ideologyScore - ideologyScoreSpent;

    // 未装备理念数量（用于收藏上限提示）
    const unequippedCount = ideologyCollection.filter(e => !equippedIdeologies.includes(e.id)).length;
    const collectionFull = unequippedCount >= MAX_COLLECTION_SIZE;

    // 详情BottomSheet状态 { id, config, level, isEquipped }
    const [sheetEntry, setSheetEntry] = useState(null);
    const threshold = getEmergenceThreshold(ownedCount);
    const progressPercent = Math.min((availableScore / threshold) * 100, 100);

    // 已拥有理念映射
    const collectionMap = useMemo(() => {
        const map = {};
        for (const entry of ideologyCollection) {
            map[entry.id] = entry;
        }
        return map;
    }, [ideologyCollection]);

    // 已装备理念解析
    const resolvedEquipped = useMemo(
        () => resolveEquippedIdeologies(equippedIdeologies, ideologyCollection),
        [equippedIdeologies, ideologyCollection]
    );

    // 联动状态
    const activeSynergies = useMemo(() => {
        return IDEOLOGY_SYNERGIES.map(s => ({
            ...s,
            isActive: s.required.every(id => equippedIdeologies.includes(id)),
        }));
    }, [equippedIdeologies]);

    const hasAnySynergy = activeSynergies.some(s => s.isActive);

    // 反协同状态
    const activeAntiSynergies = useMemo(() => {
        if (!ANTI_SYNERGIES || ANTI_SYNERGIES.length === 0) return [];
        return ANTI_SYNERGIES.map(a => ({
            ...a,
            isActive: a.required.every(id => equippedIdeologies.includes(id)),
        }));
    }, [equippedIdeologies]);

    const hasAnyAntiSynergy = activeAntiSynergies.some(a => a.isActive);

    // 未装备的理念库（仅按品质筛选）
    const unequippedCollection = useMemo(() => {
        return ideologyCollection
            .filter(entry => !equippedIdeologies.includes(entry.id))
            .map(entry => ({
                ...entry,
                config: IDEOLOGY_MAP[entry.id],
            }))
            .filter(entry => entry.config)
            .filter(entry => rarityFilter === 'all' || (entry.config.rarity || 'common') === rarityFilter);
    }, [ideologyCollection, equippedIdeologies, rarityFilter]);

    // 装备操作
    const handleEquip = useCallback((ideologyId) => {
        const result = equipIdeology(ideologyId, {
            equippedIdeologies,
            ideologyCollection,
            ideologyCooldowns,
            ideologySlotCount: maxSlots,
        });
        if (result.success && result.updatedState) {
            setEquippedIdeologies?.(result.updatedState.equippedIdeologies);
            trackIdeologyEquip(ideologyId);
        }
    }, [equippedIdeologies, ideologyCollection, ideologyCooldowns, maxSlots, setEquippedIdeologies]);

    // 卸下操作
    const handleUnequip = useCallback((ideologyId) => {
        const result = unequipIdeology(ideologyId, {
            equippedIdeologies,
            ideologyCooldowns,
        });
        if (result.success && result.updatedState) {
            setEquippedIdeologies?.(result.updatedState.equippedIdeologies);
            setIdeologyCooldowns?.(result.updatedState.ideologyCooldowns);
            trackIdeologyUnequip(ideologyId);
        }
    }, [equippedIdeologies, ideologyCooldowns, setEquippedIdeologies, setIdeologyCooldowns]);

    return (
        <>
        <div className="space-y-4">
            {/* 理念分数进度条 */}
            <div className="glass-ancient p-3 rounded-xl border border-ancient-gold/30">
                <div className="flex items-center justify-between mb-1.5">
                    <h3 className="text-sm font-bold text-gray-200 flex items-center gap-1.5">
                        <Icon name="Sparkles" size={14} className="text-purple-400" />
                        理念之力
                    </h3>
                    <span className="text-xs text-gray-400">
                        {Math.floor(availableScore)} / {threshold} 分
                    </span>
                </div>
                <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
                    <div
                        className="h-full rounded-full transition-all duration-500 bg-gradient-to-r from-purple-600 via-indigo-500 to-cyan-400"
                        style={{ width: `${progressPercent}%` }}
                    />
                </div>
                <div className="flex justify-between mt-1 text-[10px] text-gray-500">
                    <span>已拥有 {ownedCount} 个理念</span>
                    <span>总计获得 {Math.floor(ideologyScore)} 分</span>
                </div>
                {/* 获取途径说明 */}
                <div className="mt-2 pt-2 border-t border-gray-700/40">
                    <p className="text-[10px] text-gray-500 mb-1">获取途径：</p>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[10px] text-gray-500">
                        <span>⚗ 研发知识 +6~+42/项</span>
                        <span>🏛 进入新时代 +36~+144</span>
                        <span>🏗 建筑里程碑 +20（50→150→450→…×3）</span>
                        <span>👥 人口里程碑 +26（100→400→1600→…×4）</span>
                        <span>🚢 贸易里程碑 +14（1000→5000→20000→100000）</span>
                        <span>⚔ 战争结果 胜利+26 / 失利+18</span>
                        <span>🏭 完成产业链 +26/条</span>
                        <span>⚡ 部分理念触发事件奖励</span>
                    </div>
                </div>
            </div>

            {/* 卡槽区域 */}
            <div className="glass-ancient p-3 rounded-xl border border-ancient-gold/30">
                <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-bold text-gray-200 flex items-center gap-1.5">
                        <Icon name="LayoutGrid" size={14} className="text-yellow-400" />
                        理念卡槽
                        <span className="text-xs text-gray-400 font-normal">
                            ({equippedIdeologies.length}/{maxSlots})
                        </span>
                    </h3>
                </div>

                {/* 卡槽网格 */}
                <div className="grid [grid-template-columns:repeat(auto-fit,minmax(200px,1fr))] gap-3 mb-3">
                    {/* 已装备的卡牌 */}
                    {resolvedEquipped.map(ideology => (
                        <IdeologyCard
                            key={ideology.id}
                            ideology={ideology}
                            level={collectionMap[ideology.id]?.level || 1}
                            isEquipped={true}
                            equippedIds={equippedIdeologies}
                            cooldownRemaining={ideologyCooldowns[ideology.id] || 0}
                            activeBuffs={activeBuffs}
                            onUnequip={handleUnequip}
                            compact={isMobile}
                            onCardClick={(ideo) => setSheetEntry({
                                id: ideo.id,
                                config: ideo,
                                level: collectionMap[ideo.id]?.level || 1,
                                isEquipped: true,
                            })}
                        />
                    ))}
                    {/* 空卡槽 */}
                    {Array.from({ length: maxSlots - equippedIdeologies.length }, (_, i) => (
                        <EmptySlot key={`empty-${i}`} />
                    ))}
                    {/* 锁定卡槽（展示未来可解锁的） */}
                    {maxSlots < 10 && (
                        <EmptySlot isLocked unlockHint={`时代${epoch + 1}解锁`} />
                    )}
                </div>

                {/* 激活中的限时Buff */}
                {activeBuffs.filter(b => b.source === 'ideology' || b.ideologyId).length > 0 && (
                    <div className="space-y-1 mt-2">
                        <p className="text-[10px] text-amber-400/80 mb-1">⚡ 理念限时效果</p>
                        {activeBuffs
                            .filter(b => b.source === 'ideology' || b.ideologyId)
                            .map((buff, i) => (
                                <ActiveBuffBar key={buff.buffId || i} buff={buff} />
                            ))
                        }
                    </div>
                )}

                {/* 联动效果展示 */}
                {activeSynergies.filter(s => s.isActive || s.required.some(id => equippedIdeologies.includes(id))).length > 0 && (
                    <div className="space-y-1 mt-2">
                        <p className="text-[10px] text-gray-500 mb-1">联动效果</p>
                        {activeSynergies
                            .filter(s => s.isActive || s.required.some(id => equippedIdeologies.includes(id)))
                            .sort((a, b) => (b.isActive ? 1 : 0) - (a.isActive ? 1 : 0))
                            .map(s => (
                                <SynergyBar key={s.id} synergy={s} isActive={s.isActive} />
                            ))
                        }
                    </div>
                )}

                {/* 反协同警告展示 */}
                {activeAntiSynergies.filter(a => a.isActive || a.required.some(id => equippedIdeologies.includes(id))).length > 0 && (
                    <div className="space-y-1 mt-2">
                        <p className="text-[10px] text-red-400/70 mb-1">⚠ 理念矛盾</p>
                        {activeAntiSynergies
                            .filter(a => a.isActive || a.required.some(id => equippedIdeologies.includes(id)))
                            .sort((a, b) => (b.isActive ? 1 : 0) - (a.isActive ? 1 : 0))
                            .map(a => (
                                <AntiSynergyBar key={a.id} antiSynergy={a} isActive={a.isActive} />
                            ))
                        }
                    </div>
                )}
            </div>

            {/* 理念库 */}
            <div className="glass-ancient p-3 rounded-xl border border-ancient-gold/30">
                <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-bold text-gray-200 flex items-center gap-1.5">
                        <Icon name="BookOpen" size={14} className="text-indigo-400" />
                        理念库
                    </h3>
                    {/* 收藏上限计数器 */}
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${
                        collectionFull
                            ? 'text-red-400 border-red-500/50 bg-red-900/20'
                            : 'text-gray-400 border-gray-700/50 bg-gray-800/30'
                    }`}>
                        {collectionFull ? '已满 ' : ''}{unequippedCount}/{MAX_COLLECTION_SIZE}
                    </span>
                </div>

                {/* 稀有度筛选 */}
                <div className="flex flex-wrap gap-1 mb-3">
                    <button
                        onClick={() => setRarityFilter('all')}
                        className={`text-[11px] px-2 py-1 rounded-full border transition-all ${
                            rarityFilter === 'all'
                                ? 'bg-gray-600/50 border-gray-400 text-white'
                                : 'border-gray-700 text-gray-500 hover:text-gray-300'
                        }`}
                    >
                        全部品质
                    </button>
                    {Object.entries(RARITY_FILTER_CONFIG).map(([key, cfg]) => {
                        const count = ideologyCollection.filter(e =>
                            !equippedIdeologies.includes(e.id) &&
                            (IDEOLOGY_MAP[e.id]?.rarity || 'common') === key
                        ).length;
                        return (
                            <button
                                key={key}
                                onClick={() => setRarityFilter(key === rarityFilter ? 'all' : key)}
                                className={`text-[11px] px-2 py-1 rounded-full border transition-all flex items-center gap-1 ${
                                    rarityFilter === key
                                        ? `${cfg.bgClass} border-gray-400 text-white`
                                        : 'border-gray-700 text-gray-500 hover:text-gray-300'
                                }`}
                            >
                                <span className={cfg.color}>◆</span>
                                {cfg.label}
                                {count > 0 && (
                                    <span className="text-[9px] text-gray-400">({count})</span>
                                )}
                            </button>
                        );
                    })}
                </div>

                {/* 卡牌网格 — compact模式，点击打开BottomSheet */}
                {unequippedCollection.length > 0 ? (
                    <div className="grid [grid-template-columns:repeat(auto-fit,minmax(180px,1fr))] gap-2">
                        {unequippedCollection.map(entry => (
                            <div
                                key={entry.id}
                                onClick={() => setSheetEntry({ ...entry, isEquipped: false })}
                                className="cursor-pointer"
                            >
                            <IdeologyCard
                                    ideology={entry.config}
                                    level={entry.level || 1}
                                    isEquipped={false}
                                    equippedIds={equippedIdeologies}
                                    cooldownRemaining={ideologyCooldowns[entry.id] || 0}
                                    onEquip={handleEquip}
                                    compact={true}
                                />
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-6">
                        <Icon name="Package" size={32} className="text-gray-600 mx-auto mb-2" />
                        <p className="text-xs text-gray-500">
                            {ideologyCollection.length === 0
                                ? '尚未获得任何理念，继续发展文明以获取理念分数'
                                : rarityFilter !== 'all'
                                    ? '该品质下暂无未装备理念'
                                    : '所有理念均已装备在卡槽中'
                            }
                        </p>
                    </div>
                )}
            </div>
        </div>

        {/* 理念详情BottomSheet */}
        <IdeologyDetailSheet
            ideology={sheetEntry?.config || null}
            level={sheetEntry?.level || 1}
            isEquipped={sheetEntry?.isEquipped || false}
            equippedIds={equippedIdeologies}
            activeBuffs={activeBuffs}
            cooldownRemaining={sheetEntry ? (ideologyCooldowns[sheetEntry.id] || 0) : 0}
            onEquip={(id) => {
                handleEquip(id);
                setSheetEntry(null);
            }}
            onUnequip={(id) => {
                handleUnequip(id);
                setSheetEntry(null);
            }}
            onClose={() => setSheetEntry(null)}
        />
        </>
    );
};

export const IdeologyTab = memo(IdeologyTabComponent);
