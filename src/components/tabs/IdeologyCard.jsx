/**
 * 理念卡牌组件
 * 展示单个理念的卡牌，支持装备/卸下/详情展开
 */

import React, { useState, memo } from 'react';
import { Icon } from '../common/UIComponents';
import { IDEOLOGY_CATEGORIES, IDEOLOGY_MAP } from '../../config/ideologies';
import { IDEOLOGY_SYNERGIES } from '../../config/ideologySynergies';

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

/**
 * 效果标签
 */
const EffectTag = ({ label, value, positive = true }) => (
    <span className={`inline-flex items-center text-[10px] px-1.5 py-0.5 rounded ${
        positive ? 'bg-green-900/40 text-green-300' : 'bg-red-900/40 text-red-300'
    }`}>
        {label}: {typeof value === 'number'
            ? `${value > 0 ? '+' : ''}${(value * 100).toFixed(0)}%`
            : value}
    </span>
);

/**
 * 将效果对象转为可读的标签列表
 */
const EFFECT_LABELS = {
    stability: '稳定度',
    cultureBonus: '文化',
    scienceBonus: '科研',
    militaryBonus: '军事',
    incomePercent: '收入',
    taxIncome: '税收',
    maxPop: '人口上限',
    production: '生产力',
};

function effectsToTags(effects) {
    if (!effects) return [];
    const tags = [];
    for (const [key, value] of Object.entries(effects)) {
        if (key === 'categories' || key === 'perPopPassive') continue;
        const label = EFFECT_LABELS[key];
        if (label && typeof value === 'number' && value !== 0) {
            tags.push({ label, value, positive: value > 0 });
        }
    }
    return tags;
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
    onEquip,           // 装备回调
    onUnequip,         // 卸下回调
    compact = false,   // 紧凑模式（用于卡槽展示）
    isCandidate = false, // 是否是涌现候选（三选一模式）
    isSelected = false,  // 是否被选中（三选一模式）
    onSelect,          // 候选选择回调
}) => {
    const [expanded, setExpanded] = useState(false);

    if (!ideology) return null;

    const category = IDEOLOGY_CATEGORIES[ideology.category] || {};
    // 候选模式下 level 可能为 0（新理念），此时展示 1 级效果
    const displayLevel = level > 0 ? level : 1;
    const currentEffects = ideology.effects?.levels?.[displayLevel - 1] || {};
    const tags = effectsToTags(currentEffects);
    const synergies = findRelevantSynergies(ideology.id, equippedIds);
    const hasCooldown = cooldownRemaining > 0;

    // 候选模式下的点击
    const handleClick = () => {
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
                        ? 'border-yellow-400 shadow-glow-gold scale-[1.03] ring-2 ring-yellow-400/50'
                        : 'border-gray-600 hover:border-gray-400 hover:shadow-lg'
                    : isEquipped
                        ? 'border-green-500/60 shadow-glow-gold'
                        : hasCooldown
                            ? 'border-gray-700 opacity-60'
                            : 'border-gray-600 hover:border-gray-400'
            } ${compact ? 'p-1.5' : 'p-2.5'}`}
            style={{
                background: `linear-gradient(135deg, rgba(0,0,0,0.7), ${category.bgClass ? '' : 'rgba(30,30,50,0.8)'})`,
            }}
        >
            {/* 分类色条 */}
            <div className={`absolute top-0 left-0 right-0 h-0.5 ${category.bgClass || 'bg-gray-700'}`}
                 style={{ opacity: 0.8 }} />

            {/* 头部：图标 + 名称 + 星级 */}
            <div className="flex items-center gap-2 mb-1">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${category.bgClass || 'bg-gray-800'}`}>
                    <Icon name={ideology.icon || 'Circle'} size={14} className={category.color || 'text-gray-300'} />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                        <span className="text-sm font-bold text-white truncate">{ideology.name}</span>
                        <LevelStars level={level} />
                    </div>
                    {!compact && (
                        <span className={`text-[10px] ${category.color || 'text-gray-400'}`}>
                            {category.name || ideology.category}
                        </span>
                    )}
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

            {/* 候选模式下显示条件触发效果摘要 */}
            {isCandidate && ideology.effects?.triggerEffects?.length > 0 && (
                <div className="mb-1.5">
                    {ideology.effects.triggerEffects.map((te, i) => (
                        <p key={i} className="text-[10px] text-purple-300 leading-tight">
                            <Icon name="Zap" size={9} className="inline text-purple-400 mr-0.5" />
                            {describeTriggerEffect(te)}
                        </p>
                    ))}
                </div>
            )}

            {/* 联动提示 */}
            {!compact && synergies.length > 0 && (
                <div className="mb-1.5">
                    {synergies.map(s => (
                        <div key={s.id} className={`flex items-center gap-1 text-[10px] ${
                            s.isActive ? 'text-yellow-300' : 'text-gray-500'
                        }`}>
                            <Icon name={s.isActive ? 'Zap' : 'Link'} size={10} />
                            <span>{s.name}</span>
                            {!s.isActive && <span>(差{s.missingCount}个)</span>}
                        </div>
                    ))}
                </div>
            )}

            {/* 操作按钮 */}
            {!isCandidate && isInCollection && (
                <div className="flex gap-1.5 mt-1">
                    {isEquipped ? (
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
                    )}
                </div>
            )}

            {/* 展开详情 */}
            {expanded && !compact && !isCandidate && (
                <div className="mt-2 pt-2 border-t border-gray-700/50 space-y-2 animate-fade-in">
                    {/* 史实背景 */}
                    {ideology.lore && (
                        <div className="bg-gray-900/60 rounded p-2">
                            <p className="text-[10px] text-gray-400 mb-0.5">史实背景</p>
                            <p className="text-xs text-gray-300 italic">{ideology.lore}</p>
                        </div>
                    )}

                    {/* 各等级效果 */}
                    <div className="bg-gray-900/60 rounded p-2">
                        <p className="text-[10px] text-gray-400 mb-1">效果递进</p>
                        {ideology.effects?.levels?.map((lvlEffect, i) => {
                            const lvlTags = effectsToTags(lvlEffect);
                            return (
                                <div key={i} className={`flex items-start gap-1.5 mb-1 ${i + 1 === level ? 'opacity-100' : 'opacity-50'}`}>
                                    <LevelStars level={i + 1} />
                                    <div className="flex flex-wrap gap-1">
                                        {lvlTags.map((tag, j) => <EffectTag key={j} {...tag} />)}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* 条件触发效果 */}
                    {ideology.effects?.triggerEffects?.length > 0 && (
                        <div className="bg-purple-900/30 rounded p-2">
                            <p className="text-[10px] text-gray-400 mb-0.5">特殊效果</p>
                            {ideology.effects.triggerEffects.map((te, i) => (
                                <p key={i} className="text-xs text-purple-300">
                                    {describeTriggerEffect(te)}
                                </p>
                            ))}
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

/**
 * 将触发效果转为可读描述
 */
function describeTriggerEffect(te) {
    switch (te.type) {
        case 'stratum_bonus':
            return `${te.stratum}阶层提供额外加成`;
        case 'pop_ratio_bonus':
            return `${te.stratum}人口的${(te.ratio * 100).toFixed(1)}%转化为${te.target === 'militaryPower' ? '军事力量' : te.target}`;
        case 'chain_count_bonus':
            return `每条完整产业链提供额外加成`;
        case 'tech_count_bonus':
            return `每项已研发知识提供额外加成`;
        case 'resource_threshold':
            return `${te.resource}达到${te.threshold}时触发额外效果`;
        case 'building_count_bonus':
            return `每${te.per}个${te.category}类建筑提供额外加成`;
        case 'epoch_scaling':
            return `随时代推进效果递增`;
        default:
            return `特殊效果: ${te.type}`;
    }
}

export const IdeologyCard = memo(IdeologyCardComponent);
