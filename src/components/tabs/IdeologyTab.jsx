/**
 * 理念子Tab — 卡槽界面与理念库
 * 显示理念分数进度、卡槽区域、理念库
 */

import React, { useState, useMemo, memo, useCallback } from 'react';
import { Icon } from '../common/UIComponents';
import { IDEOLOGY_CATEGORIES, IDEOLOGY_MAP, IDEOLOGIES } from '../../config/ideologies';
import { IDEOLOGY_SYNERGIES, ANTI_SYNERGIES } from '../../config/ideologySynergies';
import { getEmergenceThreshold } from '../../logic/ideology/ideologyScoring';
import { getMaxSlots, equipIdeology, unequipIdeology, resolveEquippedIdeologies } from '../../logic/ideology/ideologySlots';
import { IdeologyCard } from './IdeologyCard';

/**
 * 联动效果展示条
 */
const SynergyBar = ({ synergy, isActive }) => (
    <div className={`flex items-center gap-2 px-2 py-1 rounded-lg border text-xs transition-all ${
        isActive
            ? 'border-yellow-500/50 bg-yellow-900/20 text-yellow-200'
            : 'border-gray-700/30 bg-gray-900/30 text-gray-500'
    }`}>
        <Icon name={isActive ? 'Zap' : 'Link'} size={12} className={isActive ? 'text-yellow-400' : 'text-gray-600'} />
        <span className="font-semibold">{synergy.name}</span>
        {isActive && <span className="text-yellow-400">✓ 已激活</span>}
        {!isActive && (
            <span className="text-gray-500">
                需要: {synergy.required.map(id => IDEOLOGY_MAP[id]?.name || id).join(' + ')}
            </span>
        )}
    </div>
);

/**
 * 反协同警告展示条
 */
const AntiSynergyBar = ({ antiSynergy, isActive }) => (
    <div className={`flex items-center gap-2 px-2 py-1 rounded-lg border text-xs transition-all ${
        isActive
            ? 'border-red-500/50 bg-red-900/20 text-red-200'
            : 'border-gray-700/30 bg-gray-900/30 text-gray-500'
    }`}>
        <Icon name={isActive ? 'AlertTriangle' : 'Link'} size={12} className={isActive ? 'text-red-400' : 'text-gray-600'} />
        <span className="font-semibold">{antiSynergy.name}</span>
        {isActive && <span className="text-red-400">⚠ 矛盾激活</span>}
        {!isActive && (
            <span className="text-gray-500">
                冲突: {antiSynergy.required.map(id => IDEOLOGY_MAP[id]?.name || id).join(' + ')}
            </span>
        )}
    </div>
);

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
    <div className={`flex flex-col items-center justify-center min-h-[80px] rounded-xl border-2 border-dashed transition-all ${
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
    // setter
    setEquippedIdeologies,
    setIdeologyCooldowns,
    setIdeologySlotCount,
}) => {
    const [categoryFilter, setCategoryFilter] = useState('all');
    const [rarityFilter, setRarityFilter] = useState('all');

    // 计算最大卡槽数
    const maxSlots = useMemo(
        () => getMaxSlots(epoch, techsUnlocked),
        [epoch, techsUnlocked]
    );

    // 更新卡槽数（响应时代变化）
    useMemo(() => {
        if (maxSlots > ideologySlotCount && setIdeologySlotCount) {
            setIdeologySlotCount(maxSlots);
        }
    }, [maxSlots, ideologySlotCount, setIdeologySlotCount]);

    // 涌现阈值
    const ownedCount = ideologyCollection.length;
    const availableScore = ideologyScore - ideologyScoreSpent;
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

    // 未装备的理念库（按分类和稀有度筛选）
    const unequippedCollection = useMemo(() => {
        return ideologyCollection
            .filter(entry => !equippedIdeologies.includes(entry.id))
            .map(entry => ({
                ...entry,
                config: IDEOLOGY_MAP[entry.id],
            }))
            .filter(entry => entry.config)
            .filter(entry => categoryFilter === 'all' || entry.config.category === categoryFilter)
            .filter(entry => rarityFilter === 'all' || (entry.config.rarity || 'common') === rarityFilter);
    }, [ideologyCollection, equippedIdeologies, categoryFilter, rarityFilter]);

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
        }
    }, [equippedIdeologies, ideologyCooldowns, setEquippedIdeologies, setIdeologyCooldowns]);

    return (
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
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 mb-3">
                    {/* 已装备的卡牌 */}
                    {resolvedEquipped.map(ideology => (
                        <IdeologyCard
                            key={ideology.id}
                            ideology={ideology}
                            level={collectionMap[ideology.id]?.level || 1}
                            isEquipped={true}
                            equippedIds={equippedIdeologies}
                            cooldownRemaining={ideologyCooldowns[ideology.id] || 0}
                            onUnequip={handleUnequip}
                            compact={false}
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
                </div>

                {/* 分类筛选 */}
                <div className="flex flex-wrap gap-1 mb-3">
                    <button
                        onClick={() => setCategoryFilter('all')}
                        className={`text-[11px] px-2 py-1 rounded-full border transition-all ${
                            categoryFilter === 'all'
                                ? 'bg-gray-600/50 border-gray-400 text-white'
                                : 'border-gray-700 text-gray-500 hover:text-gray-300'
                        }`}
                    >
                        全部
                    </button>
                    {Object.entries(IDEOLOGY_CATEGORIES).map(([key, cat]) => {
                        const count = unequippedCollection.filter(e => categoryFilter === 'all' ? e.config.category === key : true).length;
                        const totalInCategory = ideologyCollection.filter(e => IDEOLOGY_MAP[e.id]?.category === key && !equippedIdeologies.includes(e.id)).length;
                        return (
                            <button
                                key={key}
                                onClick={() => setCategoryFilter(key === categoryFilter ? 'all' : key)}
                                className={`text-[11px] px-2 py-1 rounded-full border transition-all flex items-center gap-1 ${
                                    categoryFilter === key
                                        ? `${cat.bgClass} border-gray-400 text-white`
                                        : 'border-gray-700 text-gray-500 hover:text-gray-300'
                                }`}
                            >
                                <Icon name={cat.icon} size={10} className={cat.color} />
                                {cat.name}
                                {totalInCategory > 0 && (
                                    <span className="text-[9px] text-gray-400">({totalInCategory})</span>
                                )}
                            </button>
                        );
                    })}
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
                            (IDEOLOGY_MAP[e.id]?.rarity || 'common') === key &&
                            (categoryFilter === 'all' || IDEOLOGY_MAP[e.id]?.category === categoryFilter)
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

                {/* 卡牌网格 */}
                {unequippedCollection.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                        {unequippedCollection.map(entry => (
                            <IdeologyCard
                                key={entry.id}
                                ideology={entry.config}
                                level={entry.level || 1}
                                isEquipped={false}
                                equippedIds={equippedIdeologies}
                                cooldownRemaining={ideologyCooldowns[entry.id] || 0}
                                onEquip={handleEquip}
                            />
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-6">
                        <Icon name="Package" size={32} className="text-gray-600 mx-auto mb-2" />
                        <p className="text-xs text-gray-500">
                            {ideologyCollection.length === 0
                                ? '尚未获得任何理念，继续发展文明以获取理念分数'
                                : categoryFilter !== 'all'
                                    ? '该分类下暂无未装备的理念'
                                    : '所有理念均已装备在卡槽中'
                            }
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};

export const IdeologyTab = memo(IdeologyTabComponent);
