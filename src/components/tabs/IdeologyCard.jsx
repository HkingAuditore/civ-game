/**
 * 理念卡牌组件
 * 展示单个理念的卡牌，支持装备/卸下/详情展开
 */

import React, { useState, memo } from 'react';
import { Icon } from '../common/UIComponents';
import { IDEOLOGY_CATEGORIES, IDEOLOGY_MAP } from '../../config/ideologies';
import { IDEOLOGY_SYNERGIES, ANTI_SYNERGIES } from '../../config/ideologySynergies';
import { EVENT_DISPLAY_NAMES } from '../../logic/ideology/ideologyEventBus';
import {
    CATEGORY_LABELS,
    RESOURCE_LABELS,
    UNIT_CATEGORY_LABELS,
    RULE_MOD_LABELS,
    MECHANIC_EFFECT_LABELS,
    RARITY_CONFIG,
    LEVEL_STAGE_LABELS,
    formatEffectValue,
    formatDuration,
    effectsToTags,
    describeConverter,
    describeEventEffect,
    describeTriggerEffect,
    getLevelInheritedItems,
    getAggregatedTriggerEffects,
    getLevelIncrementalEffects,
} from '../../utils/ideologyFormatter';

/**
 * 星级渲染
 */
const LevelStars = ({ level = 1, maxLevel = 3 }) => (
    <div className="flex items-center gap-0.5">
        {Array.from({ length: maxLevel }, (_, i) => (
            <Icon
                key={i}
                name="Star"
                size={10}
                className={i < level ? 'text-yellow-400 fill-yellow-400' : 'text-gray-600'}
            />
        ))}
    </div>
);

const EffectTag = ({ label, value, positive = true, effectKey }) => {
    const formatted = typeof value === 'number' ? formatEffectValue(effectKey, value) : value;
    return (
        <span className={`inline-flex items-center text-[10px] px-1.5 py-0.5 rounded ${
            positive ? 'bg-green-900/40 text-green-300' : 'bg-red-900/40 text-red-300'
        }`}>
            {label}: {formatted}
        </span>
    );
};

/**
 * Render event-driven effects (onEvents)
 */
function renderOnEvents(onEvents) {
    if (!onEvents?.length) return null;
    return onEvents.map((oe, i) => {
        const eventName = EVENT_DISPLAY_NAMES[oe.event] || oe.event;
        const effectDesc = describeEventEffect(oe.effect);
        const cooldownInfo = oe.cooldownDays ? `；冷却${formatDuration(oe.cooldownDays)}` : '';
        const maxInfo = oe.maxTriggers ? `；最多触发${oe.maxTriggers}次` : '';
        return (
            <p key={i} className="text-[10px] text-amber-300 leading-tight">
                ⚡ 每次{eventName}：{effectDesc}{cooldownInfo}{maxInfo}
            </p>
        );
    });
}

/**
 * Render converter effects
 */
function renderConverters(converters) {
    if (!converters?.length) return null;
    return converters.map((c, i) => {
        return (
            <p key={i} className="text-[10px] text-blue-300 leading-tight">
                🔄 {describeConverter(c)}
            </p>
        );
    });
}

/**
 * Render rule modification effects
 */
function renderRuleMods(ruleMods) {
    if (!ruleMods?.length) return null;
    return ruleMods.map((rm, i) => {
        const label = RULE_MOD_LABELS[rm.type] || rm.type;
        const scopeName = rm.scope && rm.scope !== '_global'
            ? (CATEGORY_LABELS[rm.scope] || RESOURCE_LABELS[rm.scope] || UNIT_CATEGORY_LABELS[rm.scope] || rm.scope)
            : '';
        const scopeText = scopeName ? `(${scopeName})` : '';
        const valText = rm.value > 0 ? `+${(rm.value * 100).toFixed(0)}%` : `${(rm.value * 100).toFixed(0)}%`;
        return (
            <p key={i} className="text-[10px] text-cyan-300 leading-tight">
                ⚙️ {label}{scopeText}: {valText}
            </p>
        );
    });
}

/**
 * Render mechanicEffect for synergy cards
 */
function renderMechanicEffect(me) {
    if (!me) return null;
    const label = MECHANIC_EFFECT_LABELS[me.type] || me.type;
    let detail = '';
    if (me.type === 'auto_build') detail = `每${me.intervalDays}天自动建造 ${me.buildingId}`;
    else if (me.type === 'resource_echo') detail = `获得${me.sourceResource}时额外+${(me.ratio * 100).toFixed(1)}% ${me.echoResource}`;
    else if (me.type === 'crisis_immunity') detail = `免疫 ${EVENT_DISPLAY_NAMES[me.immuneTo] || me.immuneTo}`;
    else if (me.type === 'epoch_rush') detail = `时代升级费用 -${(me.costReduction * 100).toFixed(0)}%`;
    return (
        <p className="text-[10px] text-yellow-300 font-semibold leading-tight">
            🌟 {label}: {detail}
        </p>
    );
}


/**
 * 查找与当前理念相关的联动
 */
function findRelevantSynergies(ideologyId, equippedIds = []) {
    return IDEOLOGY_SYNERGIES.filter(s =>
        s.required.includes(ideologyId)
    ).map(s => ({
        ...s,
        isActive: s.required.every(id => equippedIds.includes(id)),
        missingCount: s.required.filter(id => !equippedIds.includes(id)).length,
    }));
}

/**
 * 理念卡牌组件
 */
const IdeologyCardComponent = ({
    ideology,          // 理念配置对象
    level = 1,         // 当前等级
    isEquipped = false, // 是否已装备
    isInCollection = true, // 是否在收藏中
    cooldownRemaining = 0, // 冷却剩余天数
    equippedIds = [],  // 所有已装备理念ID
    activeBuffs = [],  // 当前激活的限时buff列表
    onEquip,           // 装备回调
    onUnequip,         // 卸下回调
    compact = false,   // 紧凑模式（用于卡槽展示）
    isCandidate = false, // 是否是涌现候选（三选一模式）
    isSelected = false,  // 是否被选中（三选一模式）
    onSelect,          // 候选选择回调
    showProgressionPreview = false,
    onCardClick = null,
    showCollectionActions = true,
    customAction = null,
}) => {
    const [expanded, setExpanded] = useState(false);
    const [candidateExpanded, setCandidateExpanded] = useState(false);

    if (!ideology) return null;

    const category = IDEOLOGY_CATEGORIES[ideology.category] || {};
    const rarity = RARITY_CONFIG[ideology.rarity] || RARITY_CONFIG.common;
    // 候选模式下 level 可能为 0（新理念），此时展示 1 级效果
    const displayLevel = level > 0 ? level : 1;
    const currentEffects = ideology.effects?.levels?.[displayLevel - 1] || {};
    const tags = effectsToTags(currentEffects);
    const synergies = findRelevantSynergies(ideology.id, equippedIds);
    const hasCooldown = cooldownRemaining > 0;
    const showDetails = (expanded || showProgressionPreview) && !compact && !isCandidate;
    const showCandidateProgress = showProgressionPreview && isCandidate;

    // 查找该理念当前激活的限时buff
    const myActiveBuffs = activeBuffs.filter(b => b.ideologyId === ideology.id);

    // 候选模式下的点击
    const handleClick = () => {
        if (onCardClick) {
            onCardClick(ideology);
            return;
        }
        if (isCandidate && onSelect) {
            onSelect(ideology.id);
        } else if (!compact) {
            setExpanded(prev => !prev);
        }
    };

    return (
        <div
            onClick={handleClick}
            className={`relative rounded-xl border transition-all cursor-pointer overflow-hidden ${
                isCandidate
                    ? isSelected
                        ? 'border-yellow-400 shadow-[0_0_0_2px_rgba(250,204,21,0.5),0_0_24px_rgba(250,204,21,0.35)] ring-2 ring-yellow-400/40'
                        : `${rarity.borderColor} hover:border-gray-400 hover:shadow-lg ${rarity.glowClass}`
                    : isEquipped
                        ? 'border-green-500/60 shadow-glow-gold'
                        : hasCooldown
                            ? 'border-gray-700 opacity-60'
                            : `${rarity.borderColor} hover:border-gray-400 ${rarity.glowClass}`
            } ${compact ? 'p-1.5' : 'p-2.5'}`}
            style={{
                background: `linear-gradient(135deg, rgba(0,0,0,0.7), ${category.bgClass ? '' : 'rgba(30,30,50,0.8)'})`,
            }}
        >
            {/* 分类色条 */}
            <div className={`absolute top-0 left-0 right-0 h-0.5 ${category.bgClass || 'bg-gray-700'}`}
                 style={{ opacity: 0.8 }} />

            {/* 头部：图标 + 名称 + 星级 */}
            <div className="flex items-start gap-2 mb-1">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${category.bgClass || 'bg-gray-800'}`}>
                    <Icon name={ideology.icon || 'Circle'} size={14} className={category.color || 'text-gray-300'} />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                        <span className="text-sm font-bold text-white leading-tight break-words whitespace-normal line-clamp-2">
                            {ideology.name}
                        </span>
                        <div className="flex flex-col items-end gap-1 flex-shrink-0">
                            <div className="flex items-center gap-1">
                                <LevelStars level={level} />
                                <span className={`text-[9px] px-1 py-0 rounded ${rarity.bgBadge} ${rarity.color} border ${rarity.borderColor}/40 font-semibold`}>
                                    {rarity.label}
                                </span>
                            </div>
                            {isEquipped && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-900/50 text-green-300 border border-green-700/50">
                                    装备中
                                </span>
                            )}
                            {hasCooldown && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-orange-900/50 text-orange-300 border border-orange-700/50">
                                    冷却 {cooldownRemaining}天
                                </span>
                            )}
                        </div>
                    </div>
                    {!compact && (
                        <span className={`text-[10px] ${category.color || 'text-gray-400'}`}>
                            {category.name || ideology.category}
                        </span>
                    )}
                </div>
            </div>

            {/* 描述 */}
            {!compact && (
                <p className="text-xs text-gray-400 mb-1.5 line-clamp-2">{ideology.desc}</p>
            )}

            {/* 效果标签 */}
            {tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-1.5">
                    {tags.slice(0, compact ? 3 : 6).map((tag, i) => (
                        <EffectTag key={i} {...tag} />
                    ))}
                    {tags.length > (compact ? 3 : 6) && (
                        <span className="text-[10px] text-gray-500">+{tags.length - (compact ? 3 : 6)}</span>
                    )}
                </div>
            )}

            {/* 当前激活的限时buff标记 */}
            {!compact && myActiveBuffs.length > 0 && (
                <div className="mb-1.5 space-y-0.5">
                    {myActiveBuffs.map((buff, i) => (
                        <div key={buff.buffId || i} className="flex items-center gap-1.5 px-1.5 py-1 rounded bg-amber-900/30 border border-amber-500/40">
                            <Icon name="Sparkles" size={10} className="text-amber-400 flex-shrink-0" />
                            <span className="text-[10px] text-amber-200 font-semibold flex-1">{buff.name} 生效中</span>
                            <span className="text-[10px] text-amber-400">剩{buff.duration}天</span>
                        </div>
                    ))}
                </div>
            )}

            {/* 特殊效果摘要 — 始终显示（非紧凑模式） */}
            {!compact && (currentEffects.onEvents?.length > 0 || currentEffects.converters?.length > 0 || currentEffects.ruleMods?.length > 0) && (
                <div className="mb-1.5 space-y-0.5">
                    {renderOnEvents(currentEffects.onEvents)}
                    {renderConverters(currentEffects.converters)}
                    {renderRuleMods(currentEffects.ruleMods)}
                </div>
            )}

            {/* 条件触发效果摘要 — 始终显示（聚合所有等级的 triggerEffects） */}
            {(() => {
                const aggregated = getAggregatedTriggerEffects(ideology, displayLevel);
                if (!aggregated.length) return null;
                const limit = compact ? 1 : isCandidate ? 2 : 3;
                return (
                    <div className="mb-1.5">
                        {aggregated.slice(0, limit).map((te, i) => (
                            <p key={i} className="text-[10px] text-purple-300 leading-tight">
                                <Icon name="Zap" size={9} className="inline text-purple-400 mr-0.5" />
                                {describeTriggerEffect(te)}
                            </p>
                        ))}
                        {aggregated.length > limit && (
                            <p className="text-[10px] text-gray-500 leading-tight">
                                +{aggregated.length - limit} 个特殊效果
                            </p>
                        )}
                    </div>
                );
            })()}

            {/* 联动提示 */}
            {!compact && synergies.length > 0 && (
                <div className="mb-1.5">
                    {synergies.map(s => {
                        const partnerNames = (s.required || [])
                            .filter(id => id !== ideology.id)
                            .map(id => IDEOLOGY_MAP[id]?.name || id)
                            .join(' + ');
                        return (
                            <div key={s.id} className={`flex items-start gap-1 text-[10px] ${
                                s.isActive ? 'text-yellow-300' : 'text-gray-500'
                            } ${s.mechanicEffect ? 'border-l-2 border-yellow-500/60 pl-1' : ''}`}>
                                <Icon name={s.isActive ? 'Zap' : 'Link'} size={10} className="mt-0.5 flex-shrink-0" />
                                <div>
                                    <span>{s.name}</span>
                                    {!s.isActive && partnerNames && (
                                        <span className="text-gray-600 ml-1">({partnerNames})</span>
                                    )}
                                    {s.isActive && s.mechanicEffect && renderMechanicEffect(s.mechanicEffect)}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* 操作按钮 */}
            {!isCandidate && (isInCollection || customAction) && (showCollectionActions || customAction) && (
                <div className="flex gap-1.5 mt-1">
                    {showCollectionActions && (
                        isEquipped ? (
                            <button
                                onClick={(e) => { e.stopPropagation(); onUnequip?.(ideology.id); }}
                                disabled={hasCooldown}
                                className={`flex-1 px-2 py-1 rounded text-xs font-semibold transition-all ${
                                    hasCooldown
                                        ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                                        : 'bg-red-800/60 hover:bg-red-700/80 text-red-200 border border-red-600/40'
                                }`}
                            >
                                卸下
                            </button>
                        ) : (
                            <button
                                onClick={(e) => { e.stopPropagation(); onEquip?.(ideology.id); }}
                                disabled={hasCooldown}
                                className={`flex-1 px-2 py-1 rounded text-xs font-semibold transition-all ${
                                    hasCooldown
                                        ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                                        : 'bg-blue-800/60 hover:bg-blue-700/80 text-blue-200 border border-blue-600/40'
                                }`}
                            >
                                装备
                            </button>
                        )
                    )}
                    {customAction && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                if (!customAction.disabled) {
                                    customAction.onClick?.(ideology.id);
                                }
                            }}
                            disabled={customAction.disabled}
                            className={`flex-1 px-2 py-1 rounded text-xs font-semibold transition-all ${
                                customAction.disabled
                                    ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                                    : (customAction.className || 'bg-purple-800/60 hover:bg-purple-700/80 text-purple-100 border border-purple-600/40')
                            }`}
                        >
                            {customAction.label || '确认'}
                        </button>
                    )}
                </div>
            )}

            {/* 展开详情 */}
            {showDetails && (
                <div className="mt-2 pt-2 border-t border-gray-700/50 space-y-2 animate-fade-in">
                    {/* 史实背景 */}
                    {ideology.lore && (
                        <div className="bg-gray-900/60 rounded p-2">
                            {/* <p className="text-[10px] text-gray-400 mb-0.5">史实背景</p> */}
                            <p className="text-xs text-gray-300 italic">{ideology.lore}</p>
                        </div>
                    )}

                    {/* 各等级效果 */}
                    <div className="bg-gray-900/60 rounded p-2">
                        <p className="text-[10px] text-gray-400 mb-1">效果递进（每级在前一级基础上叠加）</p>
                        {ideology.effects?.levels?.map((lvlEffect, i) => {
                            const levelDiff = getLevelIncrementalEffects(ideology.effects.levels, i);
                            const lvlTags = effectsToTags(levelDiff);
                            // 继承项（与上一级相同、非新增）
                            const inheritedConverters = getLevelInheritedItems(ideology.effects.levels, i, 'converters');
                            const inheritedRuleMods = getLevelInheritedItems(ideology.effects.levels, i, 'ruleMods');
                            const inheritedTriggers = getLevelInheritedItems(ideology.effects.levels, i, 'triggerEffects');
                            const hasNewSpecial = levelDiff.onEvents?.length > 0 || levelDiff.converters?.length > 0 || levelDiff.ruleMods?.length > 0 || levelDiff.triggerEffects?.length > 0;
                            const hasInherited = inheritedConverters.length > 0 || inheritedRuleMods.length > 0 || inheritedTriggers.length > 0;
                            const hasAnything = lvlTags.length > 0 || hasNewSpecial || hasInherited;
                            return (
                                <div key={i} className={`mb-1.5 ${i + 1 === level ? 'opacity-100' : 'opacity-50'}`}>
                                    <div className="flex items-start gap-1.5">
                                        <div className="flex items-center gap-1.5 min-w-[74px]">
                                            <LevelStars level={i + 1} />
                                            <span className="text-[10px] text-gray-500">
                                                {LEVEL_STAGE_LABELS[i] || `${i + 1}级`}
                                            </span>
                                        </div>
                                        <div className="flex flex-wrap gap-1">
                                            {lvlTags.map((tag, j) => (
                                                <span key={j} className="inline-flex items-center gap-0.5">
                                                    {i > 0 && <span className="text-[9px] text-green-500 font-bold">▲</span>}
                                                    <EffectTag {...tag} />
                                                </span>
                                            ))}
                                            {!hasAnything && (
                                                <span className="text-[10px] text-gray-500">无新增数值</span>
                                            )}
                                        </div>
                                    </div>
                                    {/* 新增的特殊效果 */}
                                    {hasNewSpecial && (
                                        <div className="ml-6 mt-0.5 space-y-0.5">
                                            {renderOnEvents(levelDiff.onEvents)}
                                            {levelDiff.converters?.map((c, j) => (
                                                <p key={j} className="text-[10px] text-blue-300 leading-tight">
                                                    🔄 <span className="text-blue-400 font-semibold">新增：</span>{describeConverter(c)}
                                                </p>
                                            ))}
                                            {levelDiff.ruleMods?.map((rm, j) => {
                                                const label = RULE_MOD_LABELS[rm.type] || rm.type;
                                                const scopeName = rm.scope && rm.scope !== '_global'
                                                    ? (CATEGORY_LABELS[rm.scope] || RESOURCE_LABELS[rm.scope] || UNIT_CATEGORY_LABELS[rm.scope] || rm.scope)
                                                    : '';
                                                const scopeText = scopeName ? `(${scopeName})` : '';
                                                const valText = rm.value > 0 ? `+${(rm.value * 100).toFixed(0)}%` : `${(rm.value * 100).toFixed(0)}%`;
                                                return (
                                                    <p key={j} className="text-[10px] text-cyan-300 leading-tight">
                                                        ⚙️ <span className="text-cyan-400 font-semibold">新增：</span>{label}{scopeText}: {valText}
                                                    </p>
                                                );
                                            })}
                                            {levelDiff.triggerEffects?.map((te, j) => (
                                                <p key={j} className="text-[10px] text-purple-300 leading-tight">
                                                    <Icon name="Zap" size={9} className="inline text-purple-400 mr-0.5" />
                                                    <span className="text-purple-400 font-semibold">新增：</span>{describeTriggerEffect(te)}
                                                </p>
                                            ))}
                                        </div>
                                    )}
                                    {/* 继承自上一级的特殊效果 */}
                                    {hasInherited && (
                                        <div className="ml-6 mt-0.5 space-y-0.5">
                                            {inheritedConverters.map((c, j) => (
                                                <p key={`ic-${j}`} className="text-[10px] text-blue-300/60 leading-tight">
                                                    🔄 <span className="text-blue-300/60">继承：</span>{describeConverter(c)}
                                                </p>
                                            ))}
                                            {inheritedRuleMods.map((rm, j) => {
                                                const label = RULE_MOD_LABELS[rm.type] || rm.type;
                                                const scopeName = rm.scope && rm.scope !== '_global'
                                                    ? (CATEGORY_LABELS[rm.scope] || RESOURCE_LABELS[rm.scope] || UNIT_CATEGORY_LABELS[rm.scope] || rm.scope)
                                                    : '';
                                                const scopeText = scopeName ? `(${scopeName})` : '';
                                                const valText = rm.value > 0 ? `+${(rm.value * 100).toFixed(0)}%` : `${(rm.value * 100).toFixed(0)}%`;
                                                return (
                                                    <p key={`ir-${j}`} className="text-[10px] text-cyan-300/60 leading-tight">
                                                        ⚙️ <span className="text-cyan-300/60">继承：</span>{label}{scopeText}: {valText}
                                                    </p>
                                                );
                                            })}
                                            {inheritedTriggers.length > 0 && (
                                                <p className="text-[10px] text-purple-300/60 leading-tight">
                                                    <Icon name="Zap" size={9} className="inline text-purple-400/60 mr-0.5" />
                                                    <span className="text-purple-300/60">继承前级特殊效果（{inheritedTriggers.length}项）</span>
                                                </p>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {/* 条件触发效果（聚合所有已解锁等级） */}
                    {(() => {
                        const aggregated = getAggregatedTriggerEffects(ideology, displayLevel);
                        if (!aggregated.length) return null;
                        return (
                            <div className="bg-purple-900/30 rounded p-2">
                                <p className="text-[10px] text-gray-400 mb-0.5">特殊效果</p>
                                {aggregated.map((te, i) => (
                                    <p key={i} className="text-xs text-purple-300">
                                        <Icon name="Zap" size={9} className="inline text-purple-400 mr-0.5" />
                                        {describeTriggerEffect(te)}
                                    </p>
                                ))}
                            </div>
                        );
                    })()}
                </div>
            )}

            {showCandidateProgress && (
                <div className="mt-2 pt-2 border-t border-gray-700/50">
                    <button
                        onClick={(e) => { e.stopPropagation(); setCandidateExpanded(prev => !prev); }}
                        className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-gray-200 transition-colors w-full"
                    >
                        <span>成长路线</span>
                        <Icon name={candidateExpanded ? 'ChevronUp' : 'ChevronDown'} size={12} className="text-gray-500" />
                    </button>
                    {candidateExpanded && (
                        <div className="mt-1.5 space-y-1.5">
                            {ideology.effects?.levels?.map((_, i) => {
                                const levelDiff = getLevelIncrementalEffects(ideology.effects.levels, i);
                                const lvlTags = effectsToTags(levelDiff);
                                const inheritedConverters = getLevelInheritedItems(ideology.effects.levels, i, 'converters');
                                const inheritedRuleMods = getLevelInheritedItems(ideology.effects.levels, i, 'ruleMods');
                                const inheritedTriggers = getLevelInheritedItems(ideology.effects.levels, i, 'triggerEffects');
                                const hasNewSpecial = levelDiff.onEvents?.length > 0 || levelDiff.converters?.length > 0 || levelDiff.ruleMods?.length > 0 || levelDiff.triggerEffects?.length > 0;
                                const hasInherited = inheritedConverters.length > 0 || inheritedRuleMods.length > 0 || inheritedTriggers.length > 0;
                                return (
                                    <div key={i} className="rounded-lg bg-black/25 px-2 py-1.5">
                                        <div className="flex items-center gap-2 mb-1">
                                            <LevelStars level={i + 1} />
                                            <span className="text-[10px] text-gray-400">{LEVEL_STAGE_LABELS[i] || `${i + 1}级`}</span>
                                        </div>
                                        <div className="flex flex-wrap gap-1">
                                            {lvlTags.map((tag, j) => (
                                                <span key={j} className="inline-flex items-center gap-0.5">
                                                    {i > 0 && <span className="text-[9px] text-green-500 font-bold">▲</span>}
                                                    <EffectTag {...tag} />
                                                </span>
                                            ))}
                                        </div>
                                        {hasNewSpecial && (
                                            <div className="mt-1 space-y-0.5">
                                                {renderOnEvents(levelDiff.onEvents)}
                                                {levelDiff.converters?.map((c, j) => (
                                                    <p key={j} className="text-[10px] text-blue-300 leading-tight">
                                                        🔄 <span className="text-blue-400 font-semibold">新增：</span>{describeConverter(c)}
                                                    </p>
                                                ))}
                                                {levelDiff.ruleMods && renderRuleMods(levelDiff.ruleMods)}
                                                {levelDiff.triggerEffects?.map((te, j) => (
                                                    <p key={j} className="text-[10px] text-purple-300 leading-tight">
                                                        <Icon name="Zap" size={9} className="inline text-purple-400 mr-0.5" />
                                                        <span className="text-purple-400 font-semibold">新增：</span>{describeTriggerEffect(te)}
                                                    </p>
                                                ))}
                                            </div>
                                        )}
                                        {hasInherited && (
                                            <div className="mt-0.5 space-y-0.5">
                                                {inheritedConverters.map((c, j) => (
                                                    <p key={`ic-${j}`} className="text-[10px] text-blue-300/60 leading-tight">
                                                        🔄 <span className="text-blue-300/60">继承：</span>{describeConverter(c)}
                                                    </p>
                                                ))}
                                                {inheritedTriggers.length > 0 && (
                                                    <p className="text-[10px] text-purple-300/60 leading-tight">
                                                        <Icon name="Zap" size={9} className="inline text-purple-400/60 mr-0.5" />
                                                        <span className="text-purple-300/60">继承前级特殊效果（{inheritedTriggers.length}项）</span>
                                                    </p>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* 候选升级预览 */}
            {isCandidate && ideology.isUpgrade && (
                <div className="mt-1 pt-1 border-t border-gray-700/30">
                    <span className="text-[10px] text-yellow-400">
                        ⬆ 升级至 {ideology.nextLevel} 级
                    </span>
                </div>
            )}
        </div>
    );
};

export const IdeologyCard = memo(IdeologyCardComponent);
