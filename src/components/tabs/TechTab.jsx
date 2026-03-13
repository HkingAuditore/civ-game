// 科技标签页组件
// 显示科技树和时代升级功能

import React, { useCallback, useEffect, useMemo, useState, useRef, memo } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '../common/UIComponents';
import { TECHS, EPOCHS, BUILDINGS } from '../../config';
import { RESOURCES } from '../../config';
import { calculateSilverCost, formatSilverCost } from '../../utils/economy';
import { getEpochTheme } from '../../config/epicTheme';
import { getTechCostMultiplier } from '../../config/difficulty';
import { IdeologyTab } from './IdeologyTab';
import { TechTreeView } from './TechTreeView';

const EPOCH_BONUS_LABELS = {
    gatherBonus: { label: '采集产出', type: 'percent' },
    industryBonus: { label: '工业产出', type: 'percent' },
    cultureBonus: { label: '文化产出', type: 'percent' },
    scienceBonus: { label: '科研产出', type: 'percent' },
    militaryBonus: { label: '军事力量', type: 'percent' },
    taxIncome: { label: '税收加成', type: 'percent' },
};

const formatBonusValue = (key, value) => {
    const meta = EPOCH_BONUS_LABELS[key];
    if (meta?.type === 'flat') {
        return `${value > 0 ? '+' : ''}${value}`;
    }
    const numeric = typeof value === 'number' ? value : Number(value) || 0;
    return `${numeric > 0 ? '+' : ''}${(numeric * 100).toFixed(0)}%`;
};

const TECH_BUILDING_UNLOCKS = BUILDINGS.reduce((acc, building) => {
    if (!building.requiresTech) return acc;
    const techId = building.requiresTech;
    if (!acc[techId]) acc[techId] = [];
    acc[techId].push(building.name || building.id);
    return acc;
}, {});

const clampAlpha = (value) => Math.min(1, Math.max(0, value));

const hexToRgba = (hex, alpha = 1) => {
    if (typeof hex !== 'string') return `rgba(255, 255, 255, ${clampAlpha(alpha)})`;
    const sanitized = hex.replace('#', '');
    const normalized =
        sanitized.length === 3
            ? sanitized
                .split('')
                .map((char) => char + char)
                .join('')
            : sanitized;
    const numeric = Number.parseInt(normalized, 16);
    if (Number.isNaN(numeric)) return `rgba(255, 255, 255, ${clampAlpha(alpha)})`;
    const r = (numeric >> 16) & 255;
    const g = (numeric >> 8) & 255;
    const b = numeric & 255;
    return `rgba(${r}, ${g}, ${b}, ${clampAlpha(alpha)})`;
};

const parseRgbValues = (value) =>
    value
        .replace(/rgba?\(/, '')
        .replace(')', '')
        .split(',')
        .map((part) => parseFloat(part.trim()))
        .filter((num) => !Number.isNaN(num));

const applyAlpha = (color, alpha = 1) => {
    const clamped = clampAlpha(alpha);
    if (!color) return `rgba(255, 255, 255, ${clamped})`;
    const normalized = color.trim();
    if (normalized.startsWith('#')) {
        return hexToRgba(normalized, clamped);
    }
    if (normalized.startsWith('rgba')) {
        const values = parseRgbValues(normalized);
        if (values.length >= 3) {
            const [r, g, b] = values;
            return `rgba(${r}, ${g}, ${b}, ${clamped})`;
        }
    }
    if (normalized.startsWith('rgb')) {
        const values = parseRgbValues(normalized);
        if (values.length >= 3) {
            const [r, g, b] = values;
            return `rgba(${r}, ${g}, ${b}, ${clamped})`;
        }
    }
    return normalized;
};

/**
 * 知识悬浮提示框 (使用 Portal)
 */
const TechTooltip = ({ tech, status, resources, market, anchorElement, difficulty, techCostMod = 0 }) => {
    if (!tech || !anchorElement) return null;

    const [position, setPosition] = useState({ top: 0, left: 0 });
    const tooltipRef = useRef(null);

    useEffect(() => {
        if (anchorElement && tooltipRef.current) {
            const anchorRect = anchorElement.getBoundingClientRect();
            const tooltipRect = tooltipRef.current.getBoundingClientRect();

            let top = anchorRect.top;
            let left = anchorRect.right + 8; // 默认在右侧

            // 如果右侧空间不足，则显示在左侧
            if (left + tooltipRect.width > window.innerWidth) {
                left = anchorRect.left - tooltipRect.width - 8;
            }

            // 确保不会超出窗口顶部
            if (top < 0) top = 0;
            // 确保不会超出窗口底部
            if (top + tooltipRect.height > window.innerHeight) {
                top = window.innerHeight - tooltipRect.height;
            }

            setPosition({ top, left });
        }
    }, [anchorElement, tech]);

        const multiplier = getTechCostMultiplier(difficulty) * Math.max(0.5, 1 + techCostMod);
    const adjustedCost = {};
    Object.entries(tech.cost).forEach(([res, val]) => {
        adjustedCost[res] = Math.ceil(val * multiplier);
    });

    const silverCost = calculateSilverCost(adjustedCost, market);

    return createPortal(
        <div
            ref={tooltipRef}
            className="fixed w-80 bg-gray-800 border border-gray-600 rounded-lg shadow-2xl p-3 z-[9999] pointer-events-none animate-fade-in-fast"
            style={{ top: `${position.top}px`, left: `${position.left}px` }}
        >
            <h5 className="text-sm font-bold text-white mb-1 flex items-center gap-1">
                {tech.name}
                {status === 'unlocked' && <Icon name="Check" size={14} className="text-green-400" />}
            </h5>
            <p className="text-xs text-gray-400 mb-2">{tech.desc}</p>

            {tech.effect && <div className="bg-blue-900/30 rounded px-2 py-1.5 mb-2"><div className="text-xs text-gray-400 mb-1">特殊效果</div><p className="text-xs text-blue-300">{tech.effect}</p></div>}

            {TECH_BUILDING_UNLOCKS[tech.id]?.length > 0 && <div className="bg-amber-900/30 rounded px-2 py-1.5 mb-2"><div className="text-xs text-gray-400 mb-1">解锁建筑</div><p className="text-xs text-amber-300">{TECH_BUILDING_UNLOCKS[tech.id].join('、')}</p></div>}

            {status !== 'unlocked' && (
                <div className="bg-gray-900/50 rounded px-2 py-1.5">
                    <div className="text-xs text-gray-400 mb-1">研究成本</div>
                    {Object.entries(adjustedCost).map(([resource, cost]) => (
                        <div key={resource} className="flex justify-between text-xs">
                            <span className="text-gray-300">{RESOURCES[resource]?.name || resource}</span>
                            <span className={(resources[resource] || 0) >= cost ? 'text-green-400' : 'text-red-400'}>{Math.round(cost)} ({Math.round(resources[resource] || 0)})</span>
                        </div>
                    ))}
                    <div className="flex justify-between text-xs pt-1 border-t border-gray-700 mt-1">
                        <span className="text-gray-300">总计</span>
                        <span className={(resources.silver || 0) >= silverCost ? 'text-green-400' : 'text-red-400'}>{formatSilverCost(silverCost)}</span>
                    </div>
                </div>
            )}
        </div>,
        document.body
    );
};

/**
 * 科技标签页组件
 * 显示科技树和时代升级
 * @param {Array} techsUnlocked - 已解锁的知识数组
 * @param {number} epoch - 当前时代
 * @param {Object} resources - 资源对象
 * @param {number} population - 总人口
 * @param {Function} onResearch - 研究科技回调
 * @param {Function} onUpgradeEpoch - 升级时代回调
 * @param {Function} canUpgradeEpoch - 检查是否可升级时代
 */
const TechTabComponent = ({
    techsUnlocked,
    epoch,
    resources,
    population,
    onResearch,
    onUpgradeEpoch,
    canUpgradeEpoch,
    market,
    onShowTechDetails, // 新增：显示科技详情回调
    difficulty,
    // 理念系统 props
    ideologyScore = 0,
    ideologyScoreSpent = 0,
    ideologyCollection = [],
    equippedIdeologies = [],
    ideologySlotCount = 3,
    ideologyCooldowns = {},
    setEquippedIdeologies,
    setIdeologyCooldowns,
    setIdeologySlotCount,
    techCostMod = 0, // V2: Ideology tech cost modifier
    activeBuffs = [], // 当前激活的限时buff
}) => {
    const [activeSection, setActiveSection] = useState('knowledge');
    const [hoveredTech, setHoveredTech] = useState({ tech: null, element: null });
    // Check for both hover capability AND fine pointer (mouse/trackpad) to correctly exclude touch devices
    const canHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

    const handleMouseEnter = (e, tech) => {
        if (canHover) setHoveredTech({ tech, element: e.currentTarget });
    };

    /**
     * 检查科技是否可研究
     * @param {Object} tech - 科技对象
     * @returns {boolean}
     */
    const canResearch = useCallback((tech) => {
        // 已研究
        if (techsUnlocked.includes(tech.id)) return false;

        // 时代不足
        if (tech.epoch > epoch) return false;

        // 检查前置知识
        if (tech.prerequisites && tech.prerequisites.length > 0) {
            const allPrereqsMet = tech.prerequisites.every(pid => techsUnlocked.includes(pid));
            if (!allPrereqsMet) return false;
        }

        // 资源不足
        const multiplier = getTechCostMultiplier(difficulty) * Math.max(0.5, 1 + techCostMod);
        for (let resource in tech.cost) {
            const cost = Math.ceil(tech.cost[resource] * multiplier);
            if ((resources[resource] || 0) < cost) return false;
        }

        const adjustedCost = {};
        Object.entries(tech.cost).forEach(([res, val]) => {
            adjustedCost[res] = Math.ceil(val * multiplier);
        });

        const silverCost = calculateSilverCost(adjustedCost, market);
        if ((resources.silver || 0) < silverCost) return false;

        return true;
    }, [techsUnlocked, epoch, resources, market, difficulty, techCostMod]);

    /**
     * 获取科技状态
     * @param {Object} tech - 科技对象
     * @returns {string} 状态：unlocked/available/locked
     */
    const getTechStatus = (tech) => {
        if (techsUnlocked.includes(tech.id)) return 'unlocked';
        if (tech.epoch > epoch) return 'locked';
        return 'available';
    };

    // 按时代分组科技
    const techsByEpoch = useMemo(() => {
        return TECHS.reduce((acc, tech) => {
            if (!acc[tech.epoch]) acc[tech.epoch] = [];
            acc[tech.epoch].push(tech);
            return acc;
        }, {});
    }, []);

    const [showUnresearchedOnly, setShowUnresearchedOnly] = useState(false);

    const visibleEpochIndices = useMemo(() => (
        Object.keys(techsByEpoch)
            .map(Number)
            .filter((idx) => idx <= epoch)
            .sort((a, b) => a - b)
    ), [techsByEpoch, epoch]);

    const safeEpochIndex = typeof epoch === 'number' && epoch >= 0 && epoch < EPOCHS.length ? epoch : 0;
    const currentEpoch = EPOCHS[safeEpochIndex];
    const nextEpochInfo = safeEpochIndex < EPOCHS.length - 1 ? EPOCHS[safeEpochIndex + 1] : null;
    // 应用难度系数到时代升级成本
    const epochCostMultiplier = getTechCostMultiplier(difficulty) * Math.max(0.5, 1 + techCostMod);
    const adjustedEpochCost = useMemo(() => {
        if (!nextEpochInfo) return {};
        const adjusted = {};
        Object.entries(nextEpochInfo.cost).forEach(([res, val]) => {
            adjusted[res] = Math.ceil(val * epochCostMultiplier);
        });
        return adjusted;
    }, [nextEpochInfo, epochCostMultiplier]);
    const nextEpochSilverCost = nextEpochInfo ? calculateSilverCost(adjustedEpochCost, market) : 0;
    const hasNextEpochSilver = nextEpochInfo ? (resources.silver || 0) >= nextEpochSilverCost : true;
    const upgradeThemeIndex = Math.min(safeEpochIndex + 1, EPOCHS.length - 1);
    const upgradeCardTheme = getEpochTheme(upgradeThemeIndex);
    const upgradeAccentColor = upgradeCardTheme?.accentColor || upgradeCardTheme?.primaryColor;

    const upgradeCardStyles = useMemo(() => {
        if (!upgradeCardTheme) return {};
        return {
            backgroundImage: `linear-gradient(135deg, ${applyAlpha(
                upgradeCardTheme.secondaryColor || upgradeCardTheme.primaryColor,
                0.35
            )}, ${applyAlpha(upgradeCardTheme.primaryColor, 0.85)})`,
            borderColor: upgradeCardTheme.borderColor || upgradeCardTheme.primaryColor,
            boxShadow: `0 8px 20px ${upgradeCardTheme.glowColor || applyAlpha(upgradeCardTheme.primaryColor, 0.25)
                }`,
        };
    }, [upgradeCardTheme]);

    const upgradeButtonStyles = useMemo(() => {
        if (!upgradeCardTheme) return {};
        return {
            backgroundImage: `linear-gradient(90deg, ${applyAlpha(
                upgradeCardTheme.secondaryColor || upgradeCardTheme.primaryColor,
                0.95
            )}, ${applyAlpha(upgradeCardTheme.primaryColor, 0.95)})`,
            color: upgradeCardTheme.textColor || '#fff',
            borderColor: upgradeCardTheme.borderColor || upgradeCardTheme.primaryColor,
            boxShadow: `0 4px 12px ${upgradeCardTheme.glowColor || applyAlpha(upgradeCardTheme.primaryColor, 0.2)
                }`,
        };
    }, [upgradeCardTheme]);

    const isNextEpochAvailable = epoch < EPOCHS.length - 1 && !!nextEpochInfo;
    const canTriggerUpgrade = isNextEpochAvailable && canUpgradeEpoch() && hasNextEpochSilver;

    return (
        <div className="space-y-4">
            {/* 子Tab切换：科技树 / 理念 */}
            <div className="flex items-center gap-2 text-sm rounded-full glass-ancient border border-ancient-gold/30 p-1 shadow-metal-sm">
                <button
                    className={`w-1/2 py-2 rounded-full border-2 transition-all ${
                        activeSection === 'knowledge'
                            ? 'bg-ancient-gold/20 border-ancient-gold/70 text-ancient-parchment shadow-gold-metal'
                            : 'border-transparent text-ancient-stone hover:text-ancient-parchment'
                    }`}
                    onClick={() => setActiveSection('knowledge')}
                >
                    <span className="flex items-center justify-center gap-1.5 font-bold">
                        <Icon name="Lightbulb" size={14} />
                        科技树
                    </span>
                </button>
                <button
                    className={`w-1/2 py-2 rounded-full border-2 transition-all ${
                        activeSection === 'ideology'
                            ? 'bg-purple-900/40 border-purple-500/60 text-purple-100 shadow-metal-sm'
                            : 'border-transparent text-ancient-stone hover:text-ancient-parchment'
                    }`}
                    onClick={() => setActiveSection('ideology')}
                >
                    <span className="flex items-center justify-center gap-1.5 font-bold">
                        <Icon name="Sparkles" size={14} />
                        理念
                        {ideologyCollection.length > 0 && (
                            <span className="text-[10px] bg-purple-700/50 px-1.5 py-0.5 rounded-full text-purple-200">
                                {ideologyCollection.length}
                            </span>
                        )}
                    </span>
                </button>
            </div>

            {activeSection === 'ideology' ? (
                <IdeologyTab
                    ideologyScore={ideologyScore}
                    ideologyScoreSpent={ideologyScoreSpent}
                    ideologyCollection={ideologyCollection}
                    equippedIdeologies={equippedIdeologies}
                    ideologySlotCount={ideologySlotCount}
                    ideologyCooldowns={ideologyCooldowns}
                    epoch={epoch}
                    techsUnlocked={techsUnlocked}
                    activeBuffs={activeBuffs}
                    setEquippedIdeologies={setEquippedIdeologies}
                    setIdeologyCooldowns={setIdeologyCooldowns}
                    setIdeologySlotCount={setIdeologySlotCount}
                />
            ) : (
            <>
            {/* 时代升级区域 */}
            <div
                className="relative p-3 rounded-xl border-2 shadow-epic overflow-hidden transition-all"
                style={upgradeCardStyles}
            >
                <div className="flex items-center justify-between mb-2">
                    <div>
                        <h3 className="text-base font-bold text-white flex items-center gap-1.5 font-decorative">
                            <Icon
                                name="Crown"
                                size={18}
                                className="drop-shadow"
                                style={{ color: upgradeAccentColor }}
                            />
                            当前时代：{currentEpoch?.name || '未知时代'}
                        </h3>
                        <p className="text-xs text-gray-300 mt-0.5">
                            {currentEpoch?.description || ''}
                        </p>
                    </div>

                    {isNextEpochAvailable && (
                        <div className="text-right">
                            <p className="text-xs text-gray-400 mb-1">下一时代</p>
                            <p
                                className="text-sm font-bold"
                                style={{ color: upgradeCardTheme?.textColor || '#fff' }}
                            >
                                {nextEpochInfo.name}
                            </p>
                        </div>
                    )}
                </div>

                {/* 时代加成 */}
                {currentEpoch?.bonuses && (
                    <div className="mb-2 p-2 bg-black/20 rounded">
                        <p className="text-xs text-gray-400 mb-1.5">当前时代加成：</p>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-1.5">
                            {Object.entries(currentEpoch.bonuses).map(([key, value]) => (
                                key === 'desc' ? null : (
                                    <div key={key} className="flex items-center gap-1 text-xs">
                                        <Icon name="TrendingUp" size={12} className="text-green-400" />
                                        <span className="text-gray-300">
                                            {EPOCH_BONUS_LABELS[key]?.label || RESOURCES[key]?.name || key}:
                                            <span className="text-green-400 ml-1">{formatBonusValue(key, value)}</span>
                                        </span>
                                    </div>
                                )
                            ))}
                        </div>
                    </div>
                )}

                {/* 升级按钮 */}
                {isNextEpochAvailable && (
                    <div>
                        <div className="mb-2">
                            <p className="text-xs text-gray-400 mb-1">升级要求：</p>
                            <div className="flex flex-wrap gap-2">
                                {nextEpochInfo.req.science && (
                                    <span
                                        className={`text-xs px-2 py-1 rounded ${(resources.science || 0) >= nextEpochInfo.req.science
                                            ? 'bg-green-900/30 text-green-400'
                                            : 'bg-red-900/30 text-red-400'
                                            }`}
                                    >
                                        {RESOURCES.science?.name || '科研'}: {(resources.science || 0).toFixed(0)} / {nextEpochInfo.req.science}
                                    </span>
                                )}
                                {nextEpochInfo.req.population && (
                                    <span
                                        className={`text-xs px-2 py-1 rounded ${population >= nextEpochInfo.req.population
                                            ? 'bg-green-900/30 text-green-400'
                                            : 'bg-red-900/30 text-red-400'
                                            }`}
                                    >
                                        人口: {population} / {nextEpochInfo.req.population}
                                    </span>
                                )}
                                {nextEpochInfo.req.culture && (
                                    <span
                                        className={`text-xs px-2 py-1 rounded ${(resources.culture || 0) >= nextEpochInfo.req.culture
                                            ? 'bg-green-900/30 text-green-400'
                                            : 'bg-red-900/30 text-red-400'
                                            }`}
                                    >
                                        {RESOURCES.culture?.name || '文化'}: {(resources.culture || 0).toFixed(0)} / {nextEpochInfo.req.culture}
                                    </span>
                                )}
                            </div>
                        </div>

                        <div className="mb-2">
                            <p className="text-xs text-gray-400 mb-1">升级成本：</p>
                            <div className="flex flex-wrap gap-2">
                                {Object.entries(adjustedEpochCost).map(([resource, cost]) => (
                                    <span
                                        key={resource}
                                        className={`text-xs px-2 py-1 rounded ${(resources[resource] || 0) >= cost
                                            ? 'bg-green-900/30 text-green-400'
                                            : 'bg-red-900/30 text-red-400'
                                            }`}
                                    >
                                        {RESOURCES[resource]?.name || resource}: {cost}
                                    </span>
                                ))}
                            </div>
                            <div className="flex items-center justify-between text-xs mt-2">
                                <span className="text-gray-400">银币成本</span>
                                <span className={hasNextEpochSilver ? 'text-slate-100 font-semibold' : 'text-red-400 font-semibold'}>
                                    {formatSilverCost(nextEpochSilverCost)}
                                </span>
                            </div>
                        </div>

                            <button
                            onClick={onUpgradeEpoch}
                            disabled={!canTriggerUpgrade}
                            className={`w-full px-4 py-2.5 rounded-lg text-sm font-bold transition-all border-2 ${canTriggerUpgrade
                                ? 'shadow-lg'
                                : 'bg-gray-600 text-gray-400 cursor-not-allowed border-gray-600'
                                }`}
                            style={canTriggerUpgrade ? upgradeButtonStyles : undefined}
                        >
                            {canTriggerUpgrade ? (
                                <span className="flex items-center justify-center gap-2">
                                    <Icon name="ArrowUp" size={16} />
                                    升级到 {nextEpochInfo.name}
                                </span>
                            ) : (
                                '条件不足'
                            )}
                        </button>
                    </div>
                )}

                {epoch === EPOCHS.length - 1 && (
                    <div className="text-center py-2">
                        <p className="text-sm text-yellow-400">
                            🎉 你已达到最高时代！
                        </p>
                    </div>
                )}
            </div>

            {/* 科技树 - 可视化依赖图 */}
            <div className="glass-ancient p-3 rounded-xl border border-ancient-gold/30">
                <h3 className="font-bold mb-2 text-base flex items-center gap-1.5 text-gray-300 font-decorative">
                    <Icon name="Lightbulb" size={14} className="text-yellow-400" />
                    科技树
                </h3>

                <div className="flex flex-col gap-1.5 md:flex-row md:items-center md:justify-between mb-3">
                    <label className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer select-none">
                        <input
                            type="checkbox"
                            className="form-checkbox rounded border-ancient-gold/30 text-purple-400 focus:ring-purple-500"
                            checked={showUnresearchedOnly}
                            onChange={(e) => setShowUnresearchedOnly(e.target.checked)}
                        />
                        仅显示未研究
                    </label>
                </div>

                <TechTreeView
                    techsByEpoch={techsByEpoch}
                    visibleEpochIndices={visibleEpochIndices}
                    techsUnlocked={techsUnlocked}
                    epoch={epoch}
                    resources={resources}
                    market={market}
                    difficulty={difficulty}
                    techCostMod={techCostMod}
                    canResearch={canResearch}
                    onResearch={onResearch}
                    onShowTechDetails={onShowTechDetails}
                    showUnresearchedOnly={showUnresearchedOnly}
                />
            </div>

            {/* 悬浮提示框 Portal */}
            <TechTooltip
                tech={hoveredTech.tech}
                anchorElement={hoveredTech.element}
                status={hoveredTech.tech ? getTechStatus(hoveredTech.tech) : null}
                resources={resources}
                market={market}
                difficulty={difficulty}
                techCostMod={techCostMod}
            />
            </>
            )}
        </div>
    );
};

// Memoized for performance - prevents re-render when props unchanged
export const TechTab = memo(TechTabComponent);
