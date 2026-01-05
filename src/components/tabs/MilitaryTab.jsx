// 军事标签页组件
// 显示可招募的兵种、当前军队和战斗功能

import React, { useState, useMemo, useRef, useLayoutEffect, memo } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '../common/UIComponents';
import { UNIT_TYPES, UNIT_CATEGORIES, BUILDINGS, calculateArmyMaintenance, calculateArmyFoodNeed, calculateBattlePower, calculateArmyPopulation, calculateTotalArmyExpense, calculateUnitExpense, calculateNationBattlePower, RESOURCES, MILITARY_ACTIONS, getEnemyUnitsForEpoch, TECHS, EPOCHS } from '../../config';
import { calculateSilverCost, formatSilverCost } from '../../utils/economy';
import { filterUnlockedResources } from '../../utils/resources';
import { formatNumberShortCN } from '../../utils/numberFormat';

const WAR_SCORE_GUIDE = [
    {
        title: '压倒性胜利',
        range: '战分 ≥ 350',
        color: 'text-emerald-300',
        tips: [
            '可要求吞并整国、超高额赔款或一次性分期巨额赔款',
            '允许提出大规模割地、开放市场等苛刻条款'
        ],
    },
    {
        title: '大胜',
        range: '150 ~ 349',
        color: 'text-green-300',
        tips: [
            '可要求高额赔款或长期分期付款',
            '可索取中等规模割地或强迫开放市场'
        ],
    },
    {
        title: '优势',
        range: '50 ~ 149',
        color: 'text-yellow-300',
        tips: [
            '可要求标准赔款、少量割地或一年期分期付款',
            '敌方仍有讨价还价空间，过高要求可能被拒绝'
        ],
    },
    {
        title: '僵持',
        range: '-49 ~ 49',
        color: 'text-gray-300',
        tips: [
            '只能提出无条件和平或象征性赔款',
            '双方都缺乏足够筹码，建议继续积累优势'
        ],
    },
    {
        title: '劣势',
        range: '-199 ~ -50',
        color: 'text-orange-300',
        tips: [
            '需要支付赔款、割地或分期付款才可能达成和平',
            '继续作战将面临更高代价，可以考虑先稳住局势'
        ],
    },
    {
        title: '崩溃边缘',
        range: '战分 ≤ -200',
        color: 'text-red-300',
        tips: [
            '必须支付高额赔款或割让大量人口才能停战',
            '尽快求和以避免被吞并或进一步索赔'
        ],
    },
];

/**
 * 军事单位悬浮提示框 (使用 Portal)
 */
const UnitTooltip = ({ unit, resources, market, militaryWageRatio, epoch, anchorElement }) => {
    const tooltipRef = useRef(null);
    const [tooltipSize, setTooltipSize] = useState({ width: 288, height: 400 }); // Default w-72 = 288px

    // Update tooltip size after mount using useLayoutEffect
    useLayoutEffect(() => {
        if (tooltipRef.current) {
            const rect = tooltipRef.current.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
                setTooltipSize({ width: rect.width, height: rect.height });
            }
        }
    }, [unit]); // Re-calculate when unit changes

    // Calculate position based on anchor element
    const position = useMemo(() => {
        if (!anchorElement) return { top: 0, left: 0 };

        const anchorRect = anchorElement.getBoundingClientRect();

        let top = anchorRect.top;
        let left = anchorRect.right + 8; // 默认在右侧

        if (left + tooltipSize.width > window.innerWidth) {
            left = anchorRect.left - tooltipSize.width - 8;
        }

        if (top < 0) top = 0;
        if (top + tooltipSize.height > window.innerHeight) {
            top = window.innerHeight - tooltipSize.height;
        }

        return { top, left };
    }, [anchorElement, tooltipSize]);

    // Early return after hooks
    if (!unit || !anchorElement) return null;

    const silverCost = calculateSilverCost(unit.recruitCost, market);

    return createPortal(
        <div
            ref={tooltipRef}
            className="fixed w-72 bg-gray-800 border border-gray-600 rounded-lg shadow-2xl p-3 z-[9999] pointer-events-none animate-fade-in-fast"
            style={{ top: `${position.top}px`, left: `${position.left}px` }}
        >
            <h4 className="text-sm font-bold text-white mb-1 font-decorative">{unit.name}</h4>
            <p className="text-xs text-gray-400 mb-2">{unit.type}</p>

            <div className="bg-gray-900/50 rounded px-2 py-1.5 mb-2">
                <div className="text-[10px] text-gray-400 mb-1">单位属性</div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="flex items-center gap-1"><Icon name="Sword" size={12} className="text-red-400" /><span className="text-gray-300">攻击:</span><span className="text-white">{unit.attack}</span></div>
                    <div className="flex items-center gap-1"><Icon name="Shield" size={12} className="text-blue-400" /><span className="text-gray-300">防御:</span><span className="text-white">{unit.defense}</span></div>
                    <div className="flex items-center gap-1"><Icon name="Clock" size={12} className="text-purple-400" /><span className="text-gray-300">训练:</span><span className="text-white">{unit.trainingTime}天</span></div>
                </div>
                {/* 资源维护费 */}
                <div className="text-xs mt-2 pt-2 border-t border-gray-700">
                    <div className="text-[10px] text-gray-400 mb-1">每日维护:</div>
                    <div className="flex flex-wrap gap-1">
                        {Object.entries(unit.maintenanceCost || {}).map(([res, cost]) => (
                            cost > 0 && (
                                <span key={res} className="text-[10px] px-1.5 py-0.5 bg-gray-800 rounded text-gray-300">
                                    {RESOURCES[res]?.name || res}: -{formatNumberShortCN(cost, { decimals: 1 })}
                                </span>
                            )
                        ))}
                    </div>
                    <div className="flex items-center gap-1 mt-1">
                        <Icon name="Coins" size={12} className="text-yellow-400" />
                        <span className="text-gray-300">预估军费:</span>
                        <span className="text-yellow-300">{formatNumberShortCN(calculateUnitExpense(unit, market?.prices || {}, epoch, militaryWageRatio), { decimals: 2 })} 银币/日</span>
                    </div>
                </div>
            </div>

            {/* Counter relations */}
            {(Object.keys(unit.counters || {}).length > 0 || (unit.weakAgainst || []).length > 0) && (
                <div className="bg-gray-900/50 rounded px-2 py-1.5 mb-2">
                    <div className="text-[10px] text-gray-400 mb-1">克制关系</div>
                    {Object.keys(unit.counters || {}).length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-1">
                            <span className="text-[10px] text-green-400">克制:</span>
                            {Object.entries(unit.counters).map(([cat, mult]) => (
                                <span key={cat} className="text-[10px] px-1.5 py-0.5 bg-green-900/40 rounded text-green-300">
                                    {UNIT_CATEGORIES[cat]?.name || cat} +{Math.round((mult - 1) * 100)}%
                                </span>
                            ))}
                        </div>
                    )}
                    {(unit.weakAgainst || []).length > 0 && (
                        <div className="flex flex-wrap gap-1">
                            <span className="text-[10px] text-red-400">弱于:</span>
                            {unit.weakAgainst.map((cat) => (
                                <span key={cat} className="text-[10px] px-1.5 py-0.5 bg-red-900/40 rounded text-red-300">
                                    {UNIT_CATEGORIES[cat]?.name || cat}
                                </span>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Category and epoch info */}
            <div className="bg-gray-900/50 rounded px-2 py-1.5 mb-2">
                <div className="flex justify-between text-xs">
                    <span className="text-gray-400">兵种类型</span>
                    <span className={UNIT_CATEGORIES[unit.category]?.color || 'text-white'}>
                        {UNIT_CATEGORIES[unit.category]?.name || unit.category}
                    </span>
                </div>
                <div className="flex justify-between text-xs">
                    <span className="text-gray-400">人口占用</span>
                    <span className="text-cyan-400">{unit.populationCost || 1} 人/单位</span>
                </div>
                <div className="flex justify-between text-xs">
                    <span className="text-gray-400">解锁时代</span>
                    <span className="text-white">{EPOCHS[unit.epoch]?.name || `时代${unit.epoch}`}</span>
                </div>
                <div className="flex justify-between text-xs">
                    <span className="text-gray-400">淘汰阈值</span>
                    <span className="text-yellow-400">+{unit.obsoleteAfterEpochs || 2}个时代</span>
                </div>
            </div>

            <div className="bg-gray-900/50 rounded px-2 py-1.5">
                <div className="text-[10px] text-gray-400 mb-1">招募成本</div>
                {Object.entries(unit.recruitCost).map(([resource, cost]) => (
                    <div key={resource} className="flex justify-between text-xs">
                        <span className="text-gray-300">{RESOURCES[resource]?.name || resource}</span>
                        <span className={(resources[resource] || 0) >= cost ? 'text-green-400' : 'text-red-400'}>{formatNumberShortCN(cost, { decimals: 1 })}</span>
                    </div>
                ))}
                <div className="flex justify-between text-xs pt-1 border-t border-gray-700 mt-1">
                    <span className="text-gray-300">总计</span>
                    <span className={(resources.silver || 0) >= silverCost ? 'text-green-400' : 'text-red-400'}>{formatSilverCost(silverCost)}</span>
                </div>
            </div>
        </div>,
        document.body
    );
};

/**
 * 军事标签页组件
 * 显示军事系统的所有功能
 * @param {Object} army - 当前军队对象
 * @param {Array} militaryQueue - 训练队列数组
 * @param {Object} resources - 资源对象
 * @param {number} epoch - 当前时代
 * @param {number} population - 总人口
 * @param {Array} nations - 国家列表
 * @param {string} selectedTarget - 当前选中的战争目标
 * @param {Function} onRecruit - 招募单位回调
 * @param {Function} onDisband - 解散单位回调
 * @param {Function} onCancelTraining - 取消训练回调
 * @param {Function} onSelectTarget - 设置目标
 * @param {Function} onLaunchBattle - 发起战斗回调
 */
const MilitaryTabComponent = ({
    army,
    militaryQueue,
    resources,
    epoch,
    population: _population, // eslint-disable-line no-unused-vars -- Reserved for future use
    buildings = {}, // 新增：建筑列表，用于计算军事容量
    nations = [],
    day = 0, // 当前游戏天数，用于计算军事行动冷却
    selectedTarget,
    onRecruit,
    onDisband,
    onDisbandAll, // 新增：一键解散某种兵种所有单位
    onCancelTraining, // 新增：取消训练回调
    onCancelAllTraining, // 新增：一键取消所有训练
    onSelectTarget,
    onLaunchBattle,
    market,
    militaryWageRatio = 1,
    onUpdateWageRatio,
    techsUnlocked = [],
    onShowUnitDetails, // 新增：显示单位详情回调
    autoRecruitEnabled = false,
    onToggleAutoRecruit,
    targetArmyComposition = {},
    onUpdateTargetComposition,
    militaryBonus = 0,
}) => {
    const [hoveredUnit, setHoveredUnit] = useState({ unit: null, element: null });
    const [showWarScoreInfo, setShowWarScoreInfo] = useState(false);
    const [longPressState, setLongPressState] = useState({ unitId: null, progress: 0 });
    const longPressRef = useRef({ timer: null, raf: null, start: 0, unitId: null, triggered: false });
    const [activeSection, setActiveSection] = useState('soldiers');
    const [recruitCount, setRecruitCount] = useState(1); // 批量招募数量：1, 5, 10
    // More reliable hover detection: requires both hover capability AND fine pointer (mouse/trackpad)
    // This prevents tooltips from showing on touch devices that falsely report hover support
    const canHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    const queueCounts = (militaryQueue || []).reduce((acc, item) => {
        if (!item?.unitId) return acc;
        acc[item.unitId] = (acc[item.unitId] || 0) + 1;
        return acc;
    }, {});

    const targetEntries = Object.entries(targetArmyComposition || {}).filter(([, value]) => (value ?? 0) > 0);
    targetEntries.sort(([a], [b]) => (UNIT_TYPES[a]?.epoch || 0) - (UNIT_TYPES[b]?.epoch || 0));

    const mutateTargetComposition = (mutator) => {
        if (!onUpdateTargetComposition) return;
        onUpdateTargetComposition((prev) => {
            const base = { ...(prev || {}) };
            mutator(base);
            return base;
        });
    };

    const handleTargetChange = (unitId, value) => {
        const numeric = Math.max(0, Math.floor(Number(value) || 0));
        mutateTargetComposition((next) => {
            if (numeric <= 0) {
                delete next[unitId];
            } else {
                next[unitId] = numeric;
            }
        });
    };

    const handleMirrorCurrentArmy = () => {
        if (!onUpdateTargetComposition) return;
        const snapshot = {};
        Object.entries(army || {}).forEach(([unitId, count]) => {
            if (count > 0) snapshot[unitId] = count;
        });
        onUpdateTargetComposition(snapshot);
    };

    const clearLongPress = () => {
        if (longPressRef.current.timer) clearTimeout(longPressRef.current.timer);
        if (longPressRef.current.raf) cancelAnimationFrame(longPressRef.current.raf);
        longPressRef.current.timer = null;
        longPressRef.current.raf = null;
        longPressRef.current.start = 0;
        longPressRef.current.unitId = null;
        longPressRef.current.triggered = false;
        setLongPressState({ unitId: null, progress: 0 });
    };

    const startLongPress = (unitId) => {
        clearLongPress();
        longPressRef.current.unitId = unitId;
        longPressRef.current.start = performance.now();
        longPressRef.current.triggered = false;
        setLongPressState({ unitId, progress: 0 });

        const tick = (now) => {
            if (longPressRef.current.unitId !== unitId) return;
            const elapsed = now - longPressRef.current.start;
            const progress = Math.min(1, elapsed / 500);
            setLongPressState({ unitId, progress });
            if (progress < 1 && !longPressRef.current.triggered) {
                longPressRef.current.raf = requestAnimationFrame(tick);
            }
        };

        longPressRef.current.raf = requestAnimationFrame(tick);
        longPressRef.current.timer = setTimeout(() => {
            longPressRef.current.triggered = true;
            setLongPressState({ unitId, progress: 1 });
            onDisbandAll && onDisbandAll(unitId);
        }, 500);
    };

    const handlePressEnd = (unitId) => {
        const { triggered } = longPressRef.current;
        clearLongPress();
        if (!triggered) {
            onDisband(unitId);
        }
    };

    const handleClearTargets = () => {
        if (!onUpdateTargetComposition) return;
        onUpdateTargetComposition({});
    };

    const handleToggleAutoRecruit = (checked) => {
        if (!onToggleAutoRecruit) return;
        onToggleAutoRecruit(checked);
    };

    const handleMouseEnter = (e, unit) => {
        if (canHover) setHoveredUnit({ unit, element: e.currentTarget });
    };

    // 计算军队统计信息
    const totalUnits = Object.values(army).reduce((sum, count) => sum + count, 0);
    const waitingCount = (militaryQueue || []).filter(item => item.status === 'waiting').length;
    const trainingCount = (militaryQueue || []).filter(item => item.status === 'training').length;
    const totalArmyCount = totalUnits + waitingCount + trainingCount;

    // 计算军队总人口占用
    const totalArmyPopulation = calculateArmyPopulation(army);
    // 计算训练队列中的人口占用
    const queuePopulation = (militaryQueue || []).reduce((sum, item) => {
        const unit = UNIT_TYPES[item.unitId];
        return sum + (unit?.populationCost || 1);
    }, 0);
    const totalPopulationCost = totalArmyPopulation + queuePopulation;

    // 计算军事容量
    let militaryCapacity = 0;
    Object.entries(buildings).forEach(([buildingId, count]) => {
        const building = BUILDINGS.find(b => b.id === buildingId);
        if (building && building.output?.militaryCapacity) {
            militaryCapacity += building.output.militaryCapacity * count;
        }
    });

    const maintenance = calculateArmyMaintenance(army);
    // 新军费计算系统：完整军费包含资源成本、时代加成、规模惩罚
    const totalFoodNeed = calculateArmyFoodNeed(army);
    const armyExpenseData = calculateTotalArmyExpense(
        army,
        market?.prices || {},
        epoch,
        _population || 100,
        militaryWageRatio
    );
    const totalWage = armyExpenseData.dailyExpense;
    const playerPower = calculateBattlePower(army, epoch, militaryBonus);
    // 只显示可见且处于战争状态的国家
    const warringNations = (nations || []).filter((nation) =>
        nation.isAtWar &&
        epoch >= (nation.appearEpoch ?? 0) &&
        (nation.expireEpoch == null || epoch <= nation.expireEpoch)
    );
    const activeNation =
        warringNations.find((nation) => nation.id === selectedTarget) || warringNations[0] || null;

    React.useEffect(() => {
        if (!activeNation && warringNations.length > 0 && onSelectTarget) {
            onSelectTarget(warringNations[0].id);
        }
    }, [activeNation, warringNations, onSelectTarget]);

    const formatLootRange = (range) => {
        if (!Array.isArray(range) || range.length < 2) return '';
        const [min, max] = range;
        return `${min}-${max}`;
    };

    /**
     * 检查单位是否可招募
     * @param {Object} unit - 单位对象
     * @returns {boolean}
     */
    const canRecruit = (unit, count = 1) => {
        // 检查时代
        if (unit.epoch > epoch) return false;

        // 检查是否已淘汰
        const epochDiff = epoch - unit.epoch;
        const obsoleteThreshold = unit.obsoleteAfterEpochs || 2;
        if (epochDiff > obsoleteThreshold) return false;

        // 检查资源 (乘以数量)
        for (let resource in unit.recruitCost) {
            if ((resources[resource] || 0) < unit.recruitCost[resource] * count) return false;
        }

        const silverCost = calculateSilverCost(unit.recruitCost, market) * count;
        if ((resources.silver || 0) < silverCost) return false;

        // 检查军事容量
        if (totalArmyCount + count > militaryCapacity) return false;

        return true;
    };

    /**
     * 获取不能招募的原因
     * @param {Object} unit - 单位对象
     * @returns {string} 不能招募的原因，如果可以招募则返回空字符串
     */
    const getRecruitDisabledReason = (unit, count = 1) => {
        // 检查时代
        if (unit.epoch > epoch) {
            return `需要升级到 ${EPOCHS[unit.epoch].name}`;
        }

        // 检查是否已淘汰
        const epochDiff = epoch - unit.epoch;
        const obsoleteThreshold = unit.obsoleteAfterEpochs || 2;
        if (epochDiff > obsoleteThreshold) {
            return `该兵种已淘汰，无法继续招募`;
        }

        // 检查资源
        for (let resource in unit.recruitCost) {
            if ((resources[resource] || 0) < unit.recruitCost[resource] * count) {
                return `资源不足：缺少 ${RESOURCES[resource]?.name || resource}`;
            }
        }

        const silverCost = calculateSilverCost(unit.recruitCost, market) * count;
        if ((resources.silver || 0) < silverCost) {
            return `银币不足：需要 ${formatNumberShortCN(silverCost, { decimals: 1 })} 银币`;
        }

        // 检查军事容量
        if (totalArmyCount + count > militaryCapacity) {
            return `军事容量不足（${totalArmyCount}+${count}/${militaryCapacity}），需要建造更多兵营`;
        }

        return '';
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm rounded-full glass-ancient border border-ancient-gold/30 p-1 shadow-metal-sm">
                <button
                    className={`w-1/2 py-2 rounded-full border-2 transition-all ${activeSection === 'soldiers'
                        ? 'bg-ancient-gold/20 border-ancient-gold/70 text-ancient-parchment shadow-gold-metal'
                        : 'border-transparent text-ancient-stone hover:text-ancient-parchment'}`}
                    onClick={() => setActiveSection('soldiers')}
                >
                    <span className="flex items-center justify-center gap-1.5 font-bold">
                        <Icon name="Users" size={14} />
                        士兵
                    </span>
                </button>
                <button
                    className={`w-1/2 py-2 rounded-full border-2 transition-all ${activeSection === 'battle'
                        ? 'bg-red-900/40 border-ancient-gold/60 text-red-100 shadow-metal-sm'
                        : 'border-transparent text-ancient-stone hover:text-ancient-parchment'}`}
                    onClick={() => setActiveSection('battle')}
                >
                    <span className="flex items-center justify-center gap-1.5 font-bold">
                        <Icon name="Swords" size={14} />
                        战斗
                    </span>
                </button>
            </div>
            {activeSection === 'soldiers' && (
                <>
                    {/* 军队概览 */}
                    <div className="glass-ancient p-4 rounded-xl border border-ancient-gold/30">
                        <h3 className="text-sm font-bold mb-3 flex items-center gap-2 text-gray-300 font-decorative">
                            <Icon name="Shield" size={16} className="text-red-400" />
                            军队概览
                        </h3>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            {/* 总兵力 */}
                            <div className="bg-gray-700/50 p-3 rounded">
                                <div className="flex items-center gap-2 mb-1">
                                    <Icon name="Users" size={14} className="text-blue-400" />
                                    <span className="text-xs text-gray-400">总兵力</span>
                                </div>
                                <p className="text-lg font-bold text-white">{totalUnits}</p>
                            </div>

                            {/* 人口占用 */}
                            <div className="bg-gray-700/50 p-3 rounded">
                                <div className="flex items-center gap-2 mb-1">
                                    <Icon name="UserCheck" size={14} className="text-cyan-400" />
                                    <span className="text-xs text-gray-400">人口占用</span>
                                </div>
                                <p className="text-lg font-bold text-cyan-400">{totalPopulationCost}</p>
                                <p className="text-[10px] text-gray-500">现役 {totalArmyPopulation} + 训练 {queuePopulation}</p>
                            </div>

                            {/* 军事容量 */}
                            <div className="bg-gray-700/50 p-3 rounded">
                                <div className="flex items-center gap-2 mb-1">
                                    <Icon name="Castle" size={14} className="text-red-400" />
                                    <span className="text-xs text-gray-400">军事容量</span>
                                </div>
                                <p className={`text-lg font-bold ${totalArmyCount > militaryCapacity ? 'text-red-400' : 'text-white'}`}>
                                    {totalArmyCount} / {militaryCapacity}
                                </p>
                            </div>

                            {/* 训练中 */}
                            <div className="bg-gray-700/50 p-3 rounded">
                                <div className="flex items-center gap-2 mb-1">
                                    <Icon name="Clock" size={14} className="text-yellow-400" />
                                    <span className="text-xs text-gray-400">训练中</span>
                                </div>
                                <p className="text-lg font-bold text-white">{militaryQueue.length}</p>
                            </div>
                        </div>

                        {/* 维护成本 */}
                        {(() => {
                            const unlockedMaintenance = filterUnlockedResources(maintenance, epoch, techsUnlocked);
                            const prices = market?.prices || {};
                            // Calculate total daily cost in silver
                            let totalDailyCost = 0;
                            Object.entries(unlockedMaintenance).forEach(([resource, cost]) => {
                                if (resource === 'silver') {
                                    totalDailyCost += cost;
                                } else {
                                    totalDailyCost += cost * (prices[resource] || 1);
                                }
                            });
                            return Object.keys(unlockedMaintenance).length > 0 && (
                                <div className="mt-3 pt-3 border-t border-gray-700">
                                    <p className="text-xs text-gray-400 mb-2">维护成本（每日）：</p>
                                    <div className="space-y-1">
                                        {Object.entries(unlockedMaintenance).map(([resource, cost]) => {
                                            const price = prices[resource] || 1;
                                            const silverValue = resource === 'silver' ? cost : cost * price;
                                            const isAffordable = (resources[resource] || 0) >= cost;
                                            return (
                                                <div key={resource} className="flex items-center justify-between text-xs">
                                                    <span className="flex items-center gap-1 text-gray-300">
                                                        <Icon name={RESOURCES[resource]?.icon || 'Package'} size={12} className="text-gray-400" />
                                                        {RESOURCES[resource]?.name || resource}
                                                    </span>
                                                    <span className="flex items-center gap-2">
                                                        <span className={isAffordable ? 'text-green-400' : 'text-red-400'}>
                                                            -{formatNumberShortCN(cost, { decimals: 1 })}/日
                                                        </span>
                                                        {resource !== 'silver' && (
                                                            <span className="text-yellow-400/70 text-[10px]">
                                                                ≈{formatNumberShortCN(silverValue, { decimals: 1 })}<Icon name="Coins" size={8} className="inline ml-0.5" />
                                                            </span>
                                                        )}
                                                    </span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-700/50 text-xs">
                                        <span className="text-gray-400">资源折算</span>
                                        <span className="text-yellow-300 flex items-center gap-0.5">
                                            ≈{formatNumberShortCN(totalDailyCost, { decimals: 1 })}<Icon name="Coins" size={10} />/日
                                        </span>
                                    </div>
                                </div>
                            );
                        })()}

                        <div className="mt-3 pt-3 border-t border-gray-700">
                            <p className="text-xs text-gray-400 mb-2">每日军费：</p>
                            <div className="flex items-center gap-2 text-sm">
                                <Icon name="Coins" size={14} className="text-yellow-400" />
                                <span className="text-yellow-300 font-mono">-{totalWage.toFixed(2)} 银币</span>
                            </div>
                            {/* 军费分解显示 */}
                            <div className="mt-2 grid grid-cols-3 gap-2 text-[10px]">
                                <div className="bg-gray-800/50 rounded px-2 py-1">
                                    <span className="text-gray-400">时代加成</span>
                                    <span className="text-cyan-300 ml-1">×{armyExpenseData.epochMultiplier.toFixed(1)}</span>
                                </div>
                                <div className="bg-gray-800/50 rounded px-2 py-1">
                                    <span className="text-gray-400">规模惩罚</span>
                                    <span className={`ml-1 ${armyExpenseData.scalePenalty > 1 ? 'text-orange-300' : 'text-green-300'}`}>
                                        ×{armyExpenseData.scalePenalty.toFixed(2)}
                                    </span>
                                </div>
                                <div className="bg-gray-800/50 rounded px-2 py-1">
                                    <span className="text-gray-400">军饷倍率</span>
                                    <span className="text-yellow-300 ml-1">×{militaryWageRatio.toFixed(1)}</span>
                                </div>
                            </div>
                            <div className="mt-2 flex items-center gap-2 text-[11px] text-gray-400">
                                <span>军饷倍率</span>
                                <input
                                    type="number"
                                    step="0.1"
                                    value={militaryWageRatio}
                                    onChange={(e) => onUpdateWageRatio && onUpdateWageRatio(parseFloat(e.target.value) || 0)}
                                    className="w-20 bg-gray-900/60 border border-gray-700 rounded px-2 py-0.5 text-xs text-gray-100"
                                />
                                <span className="text-gray-500">军费 = 资源成本 × 时代 × 规模 × 倍率</span>
                            </div>
                        </div>
                    </div>

                    {/* 自动补兵 */}
                    <div className="glass-ancient p-3 rounded-xl border border-ancient-gold/30">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Icon name="RefreshCcw" size={16} className="text-emerald-400" />
                                <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        className="accent-emerald-400"
                                        checked={autoRecruitEnabled}
                                        onChange={(e) => handleToggleAutoRecruit(e.target.checked)}
                                    />
                                    <span className="font-bold font-decorative">自动补兵</span>
                                </label>
                            </div>
                            {autoRecruitEnabled && (
                                <span className="text-xs text-emerald-400 flex items-center gap-1">
                                    <Icon name="Check" size={12} />
                                    已启用
                                </span>
                            )}
                        </div>
                        <p className="text-xs text-gray-500 mt-2">
                            {autoRecruitEnabled
                                ? '战斗中阵亡的士兵将自动加入训练队列进行补充。'
                                : '启用后，战斗中阵亡的士兵将自动加入训练队列。'}
                        </p>
                    </div>

                    {/* 兵种克制关系 */}
                    <div className="glass-ancient p-3 rounded-xl border border-ancient-gold/30">
                        <h3 className="text-xs font-bold mb-2 flex items-center gap-2 text-gray-300 font-decorative">
                            <Icon name="Info" size={14} className="text-blue-400" />
                            兵种克制关系
                        </h3>
                        <div className="flex flex-wrap gap-3 text-[10px]">
                            <div className="flex items-center gap-1">
                                <span className="text-red-400 font-semibold">步兵</span>
                                <Icon name="ArrowRight" size={10} className="text-green-400" />
                                <span className="text-blue-400 font-semibold">骑兵</span>
                                <span className="text-gray-500 ml-1">(长矛克骑)</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <span className="text-blue-400 font-semibold">骑兵</span>
                                <Icon name="ArrowRight" size={10} className="text-green-400" />
                                <span className="text-green-400 font-semibold">弓箭</span>
                                <span className="text-gray-500 ml-1">(快速突袭)</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <span className="text-green-400 font-semibold">弓箭</span>
                                <Icon name="ArrowRight" size={10} className="text-green-400" />
                                <span className="text-red-400 font-semibold">步兵</span>
                                <span className="text-gray-500 ml-1">(远程压制)</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <span className="text-yellow-400 font-semibold">火器</span>
                                <Icon name="ArrowRight" size={10} className="text-green-400" />
                                <span className="text-red-400 font-semibold">步兵</span>
                                <span className="text-gray-500">/</span>
                                <span className="text-blue-400 font-semibold">骑兵</span>
                                <span className="text-gray-500 ml-1">(火力优势)</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <span className="text-blue-400 font-semibold">骑兵</span>
                                <Icon name="ArrowRight" size={10} className="text-green-400" />
                                <span className="text-yellow-400 font-semibold">火器</span>
                                <span className="text-gray-500 ml-1">(近身突袭)</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <span className="text-orange-400 font-semibold">攻城</span>
                                <span className="text-gray-400">→ 攻城利器但机动性差</span>
                            </div>
                            <div className="flex items-center gap-1 border-l border-gray-700 pl-3">
                                <Icon name="AlertTriangle" size={10} className="text-yellow-400" />
                                <span className="text-yellow-400">落后超过2代的兵种将被淘汰</span>
                            </div>
                        </div>
                    </div>

                    {/* 招募单位 */}
                    <div className="glass-ancient p-4 rounded-xl border border-ancient-gold/30">
                        <h3 className="text-sm font-bold mb-3 flex items-center gap-2 text-gray-300 font-decorative">
                            <Icon name="Plus" size={16} className="text-green-400" />
                            招募单位
                        </h3>

                        {/* Quantity Selector */}
                        <div className="flex bg-gray-800 rounded-lg p-1 gap-1 mb-3 w-fit">
                            {[1, 5, 10].map(n => (
                                <button
                                    key={n}
                                    onClick={() => setRecruitCount(n)}
                                    className={`px-3 py-1 rounded text-xs font-bold transition-all ${recruitCount === n
                                        ? 'bg-blue-600 text-white shadow'
                                        : 'text-gray-400 hover:bg-gray-700 hover:text-gray-200'
                                        }`}
                                >
                                    x{n}
                                </button>
                            ))}
                            {/* Max button logic for recruitment is tricky due to capacity/resources. 
                                    Let's keep it simple for now or implement if needed. 
                                    Given capacity constraints, Max is very useful. */}
                            <button
                                onClick={() => {
                                    const remainingCap = Math.max(0, militaryCapacity - totalArmyCount);
                                    const safeMax = Math.min(50, remainingCap > 0 ? remainingCap : 1);
                                    setRecruitCount(safeMax);
                                }}
                                className={`px-3 py-1 rounded text-xs font-bold transition-all ${recruitCount > 10
                                    ? 'bg-blue-600 text-white shadow'
                                    : 'text-gray-400 hover:bg-gray-700 hover:text-gray-200'
                                    }`}
                                title="设置数量为剩余容量 (Max 50)"
                            >
                                x{Math.min(50, Math.max(0, militaryCapacity - totalArmyCount) > 0 ? Math.max(0, militaryCapacity - totalArmyCount) : 1)}
                            </button>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-2">
                            {Object.entries(UNIT_TYPES)
                                .filter(([id, unit]) => {
                                    // Filter by epoch unlock
                                    if (unit.epoch > epoch) return false;

                                    // Always show if we have this unit (so we can disband it)
                                    if ((army[id] || 0) > 0) return true;

                                    // Filter out obsolete units for recruitment list
                                    const epochDiff = epoch - unit.epoch;
                                    const obsoleteThreshold = unit.obsoleteAfterEpochs || 2;
                                    return epochDiff <= obsoleteThreshold;
                                })
                                .map(([unitId, unit]) => {
                                    const silverCost = calculateSilverCost(unit.recruitCost, market) * recruitCount;
                                    const affordable = canRecruit(unit, recruitCount);

                                    // Get category info for color
                                    const categoryInfo = UNIT_CATEGORIES[unit.category] || {};
                                    const categoryColor = categoryInfo.color || 'text-red-400';

                                    return (
                                        <div
                                            key={unitId}
                                            onMouseEnter={(e) => handleMouseEnter(e, unit)}
                                            onMouseLeave={() => canHover && setHoveredUnit({ unit: null, element: null })}
                                            onClick={() => onShowUnitDetails && onShowUnitDetails(unit)}
                                            className={`group relative p-2 rounded-lg border transition-all cursor-pointer ${affordable
                                                ? 'glass-ancient border border-ancient-gold/30 hover:border-red-500/60 hover:shadow-glow-gold'
                                                : 'bg-gray-700/50 border border-ancient-gold/20'
                                                }`}
                                        >
                                            {/* 单位头部 - 超紧凑版 */}
                                            <div className="flex items-center gap-2 mb-1.5">
                                                <div className="w-10 h-10 icon-metal-container rounded-lg flex items-center justify-center flex-shrink-0">
                                                    <Icon name={unit.icon || 'Swords'} size={20} className={`${categoryColor} icon-metal-red`} />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-1">
                                                        <h4 className="text-xs font-bold text-white font-decorative truncate">{unit.name}</h4>
                                                        <span className="text-[10px] text-gray-400">×{army[unitId] || 0}</span>
                                                    </div>
                                                    <div className="flex items-center gap-1 text-[9px] text-gray-400">
                                                        <span className={`px-1 py-0.5 rounded whitespace-nowrap ${categoryInfo.color?.replace('text-', 'bg-').replace('-400', '-900/50')} ${categoryColor}`}>
                                                            {categoryInfo.name}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* 操作按钮 - 紧凑版 */}
                                            <div className="flex gap-1">
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); onRecruit(unitId, { count: recruitCount }); }}
                                                    disabled={!affordable}
                                                    title={!affordable ? getRecruitDisabledReason(unit, recruitCount) : `点击招募 ${recruitCount} 个`}
                                                    className={`flex-1 px-2 py-1 rounded text-[10px] font-semibold transition-all active:scale-95 ${affordable
                                                        ? 'bg-green-600 hover:bg-green-500 text-white active:brightness-110'
                                                        : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                                                        }`}
                                                >
                                                    <div className="flex items-center justify-center gap-1">
                                                        <Icon name="Plus" size={10} />
                                                        {recruitCount > 1 && <span>x{recruitCount} </span>}
                                                        <span className={(resources.silver || 0) < silverCost ? 'text-red-300' : ''}>
                                                            {formatSilverCost(silverCost)}
                                                        </span>
                                                    </div>
                                                </button>

                                                {(army[unitId] || 0) > 0 && (
                                                    <button
                                                        onMouseDown={(e) => {
                                                            e.stopPropagation();
                                                            startLongPress(unitId);
                                                        }}
                                                        onMouseUp={(e) => {
                                                            e.stopPropagation();
                                                            handlePressEnd(unitId);
                                                        }}
                                                        onMouseLeave={() => clearLongPress()}
                                                        onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); }}
                                                        onTouchStart={(e) => {
                                                            e.preventDefault();
                                                            e.stopPropagation();
                                                            startLongPress(unitId);
                                                        }}
                                                        onTouchMove={() => clearLongPress()}
                                                        onTouchEnd={(e) => {
                                                            e.preventDefault();
                                                            handlePressEnd(unitId);
                                                        }}
                                                        className="relative px-1.5 py-1 bg-red-600/80 hover:bg-red-500 text-white rounded text-[10px] transition-colors select-none overflow-hidden"
                                                        title="点击解散1个，长按解散全部"
                                                    >
                                                        <span className="relative z-10">解散</span>
                                                        {longPressState.unitId === unitId && longPressState.progress > 0 && (
                                                            <div className="absolute inset-0 bg-red-900/40 z-0">
                                                                <div
                                                                    className="h-full bg-red-200/40"
                                                                    style={{ width: `${Math.round(longPressState.progress * 100)}%` }}
                                                                />
                                                            </div>
                                                        )}
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                        </div>
                    </div>

                    {/* 训练队列 */}
                    {militaryQueue.length > 0 && (
                        <div className="glass-ancient p-4 rounded-xl border border-ancient-gold/30">
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="text-sm font-bold flex items-center gap-2 text-gray-300 font-decorative">
                                    <Icon name="Clock" size={16} className="text-yellow-400" />
                                    训练队列
                                </h3>
                                <button
                                    onClick={() => onCancelAllTraining && onCancelAllTraining()}
                                    className="text-[10px] flex items-center gap-1 px-2 py-1 rounded border border-red-500/40 text-red-300 hover:bg-red-500/20 transition-colors"
                                    title="取消所有训练（返还50%资源）"
                                >
                                    <Icon name="Trash2" size={12} />
                                    清空队列
                                </button>
                            </div>

                            <div
                                className="space-y-2 max-h-[360px] overflow-y-auto pr-2 custom-scrollbar"
                                onWheel={(e) => {
                                    // Prevent accidental triggering of button clicks/hover behaviors while scrolling
                                    // (some browsers may synthesize click on wheel or during momentum scrolling)
                                    e.stopPropagation();
                                }}
                            >
                                {militaryQueue.map((item, idx) => {
                                    const unit = UNIT_TYPES[item.unitId];
                                    const isWaiting = item.status === 'waiting';
                                    const progress = isWaiting ? 0 : ((item.totalTime - item.remainingTime) / item.totalTime) * 100;

                                    return (
                                        <div
                                            key={idx}
                                            className={`flex items-center justify-between p-2 rounded ${isWaiting ? 'bg-gray-700/30 border border-dashed border-gray-600' : 'bg-gray-700/50'
                                                }`}
                                        >
                                            <div className="flex items-center gap-2">
                                                <Icon
                                                    name={isWaiting ? "UserPlus" : "User"}
                                                    size={14}
                                                    className={isWaiting ? "text-gray-400" : "text-blue-400"}
                                                />
                                                <span className={`text-sm ${isWaiting ? 'text-gray-400' : 'text-white'}`}>
                                                    {unit.name}
                                                </span>
                                                {isWaiting && (
                                                    <span className="text-xs text-yellow-400">等待人员...</span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {!isWaiting && (
                                                    <>
                                                        <div className="w-32 bg-gray-600 rounded-full h-2">
                                                            <div
                                                                className="bg-yellow-500 h-2 rounded-full transition-all"
                                                                style={{ width: `${progress}%` }}
                                                            />
                                                        </div>
                                                        <span className="text-xs text-gray-400 w-12 text-right">
                                                            {item.remainingTime}天
                                                        </span>
                                                    </>
                                                )}
                                                {isWaiting && (
                                                    <span className="text-xs text-gray-500 w-44 text-right">
                                                        需要人员填补军人岗位
                                                    </span>
                                                )}
                                                {/* 取消按钮 */}
                                                <button
                                                    onClick={() => onCancelTraining && onCancelTraining(idx)}
                                                    className="ml-2 p-1 rounded hover:bg-red-900/30 text-red-400 hover:text-red-300 transition-colors"
                                                    title="取消训练（返还50%资源）"
                                                >
                                                    <Icon name="X" size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </>
            )}

            {/* 军事行动 */}
            {activeSection === 'battle' && (
                <div className="glass-ancient p-4 rounded-xl border border-ancient-gold/30">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-bold flex items-center gap-2 text-gray-300 font-decorative">
                            <Icon name="Swords" size={16} className="text-red-400" />
                            军事行动
                        </h3>
                        <button
                            type="button"
                            onClick={() => setShowWarScoreInfo(true)}
                            className="text-[11px] flex items-center gap-1 px-2 py-1 rounded border border-ancient-gold/40 text-amber-200 hover:bg-ancient-gold/10 transition-colors"
                        >
                            <Icon name="HelpCircle" size={12} />
                            战争分数指南
                        </button>
                    </div>

                    <div className="flex items-center justify-between text-xs text-gray-400 mb-3">
                        <span>
                            当前战力评估：
                            <span className="text-white font-semibold">{playerPower.toFixed(0)}</span>
                            {militaryBonus !== 0 && (
                                <span className={`text-xs ml-2 ${militaryBonus > 0 ? 'text-green-400' : 'text-red-400'}`}>
                                    ({militaryBonus > 0 ? '+' : ''}{(militaryBonus * 100).toFixed(0)}%)
                                </span>
                            )}
                        </span>
                        <span>
                            现役兵力：
                            <span className="text-white font-semibold">{totalUnits}</span>
                        </span>
                    </div>

                    {warringNations.length === 0 ? (
                        <div className="p-3 rounded bg-gray-900/40 border border-gray-700 text-xs text-gray-400">
                            暂无交战国。可在外交界面主动宣战或等待敌国挑衅。
                        </div>
                    ) : (
                        <>
                            <div className="flex flex-wrap items-center gap-3 text-xs text-gray-400 mb-3">
                                <div className="flex items-center gap-2">
                                    <span>目标国家</span>
                                    <select
                                        value={activeNation?.id || ''}
                                        onChange={(e) => onSelectTarget && onSelectTarget(e.target.value)}
                                        className="bg-gray-900/60 border border-gray-700 text-white rounded px-2 py-1"
                                    >
                                        {warringNations.map((nation) => (
                                            <option key={nation.id} value={nation.id}>
                                                {nation.name} · 战争分数 {nation.warScore || 0}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                {activeNation && (
                                    <div className="flex flex-wrap gap-3">
                                        <span>战争分数：{activeNation.warScore || 0}</span>
                                        <span>敌军损失：{activeNation.enemyLosses || 0}</span>
                                        <span>财富：{Math.floor(activeNation.wealth || 0)}</span>
                                        <span>军事实力：{Math.floor((activeNation.militaryStrength ?? 1.0) * 100)}%</span>
                                        <span>人口：{Math.floor(activeNation.population || 1000)}</span>
                                        <span className={(() => {
                                            const initialReserve = (activeNation.wealth || 500) * 1.5;
                                            const currentReserve = activeNation.lootReserve ?? initialReserve;
                                            const ratio = currentReserve / Math.max(1, initialReserve);
                                            if (ratio >= 0.7) return 'text-green-400';
                                            if (ratio >= 0.3) return 'text-yellow-400';
                                            return 'text-red-400';
                                        })()}>
                                            可掠夺：{(() => {
                                                const initialReserve = (activeNation.wealth || 500) * 1.5;
                                                const currentReserve = activeNation.lootReserve ?? initialReserve;
                                                const ratio = Math.max(0, Math.min(1, currentReserve / Math.max(1, initialReserve)));
                                                return Math.floor(ratio * 100);
                                            })()}%
                                        </span>
                                    </div>
                                )}
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {MILITARY_ACTIONS.map((action) => {
                                    // 使用派遣比例计算敌方战力
                                    // [FIXED] 统一算法：使用与战斗逻辑一致的计算方式
                                    const deploymentRatio = action.deploymentRatio || { min: 0.1, max: 0.2 };

                                    // 1. 修正时代计算：必须使用敌方所属时代，而非玩家当前时代
                                    const enemyEpoch = Math.max(activeNation.appearEpoch || 0, Math.min(epoch, activeNation.expireEpoch ?? epoch));

                                    // 2. 修正战力计算：直接调用 calculateNationBattlePower 并传入比例
                                    // 这样可以触发 generateNationArmy 中的保底逻辑 (Math.max(1, ...))，避免简单的乘法导致战力过低
                                    let enemyPowerMin = activeNation ? calculateNationBattlePower(activeNation, enemyEpoch, deploymentRatio.min) : 0;
                                    let enemyPowerMax = activeNation ? calculateNationBattlePower(activeNation, enemyEpoch, deploymentRatio.max) : 0;

                                    // 3. 修正防御加成：战斗模拟中防御方有 1.2 倍加成 (simulateBattle line 948)
                                    enemyPowerMin = Math.floor(enemyPowerMin * 1.2);
                                    enemyPowerMax = Math.floor(enemyPowerMax * 1.2);

                                    // 4. 添加 buff 加成预估 (action.enemyBuff)
                                    if (action.enemyBuff) {
                                        enemyPowerMin = Math.floor(enemyPowerMin * (1 + action.enemyBuff));
                                        enemyPowerMax = Math.floor(enemyPowerMax * (1 + action.enemyBuff));
                                    }

                                    // 格式化战力显示
                                    const formatPower = (p) => formatNumberShortCN(p, { decimals: 1 });
                                    // Check if required tech is unlocked
                                    const hasRequiredTech = !action.requiresTech || techsUnlocked.includes(action.requiresTech);
                                    const requiredTechName = action.requiresTech
                                        ? TECHS.find(t => t.id === action.requiresTech)?.name || action.requiresTech
                                        : null;

                                    // 计算针对当前目标的冷却状态
                                    const lastActionDay = activeNation?.lastMilitaryActionDay?.[action.id] || 0;
                                    const cooldownDays = action.cooldownDays || 5;
                                    const daysSinceLastAction = day - lastActionDay;
                                    const isOnCooldown = lastActionDay > 0 && daysSinceLastAction < cooldownDays;
                                    const cooldownRemaining = isOnCooldown ? cooldownDays - daysSinceLastAction : 0;

                                    // 计算敌方掠夺储备状态
                                    const initialLootReserve = (activeNation?.wealth || 500) * 1.5;
                                    const currentLootReserve = activeNation?.lootReserve ?? initialLootReserve;
                                    const reserveRatio = Math.max(0, currentLootReserve / Math.max(1, initialLootReserve));
                                    const isLowReserve = reserveRatio < 0.3;

                                    return (
                                        <div
                                            key={action.id}
                                            className={`p-3 rounded-lg border flex flex-col gap-3 ${hasRequiredTech && !isOnCooldown
                                                ? 'border-gray-700 bg-gray-900/40'
                                                : 'border-gray-800 bg-gray-900/20 opacity-60'
                                                }`}
                                        >
                                            <div className="flex items-start justify-between gap-2">
                                                <div>
                                                    <h4 className="text-base font-bold text-white flex items-center gap-2 font-decorative">
                                                        {action.name}
                                                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-gray-700 text-gray-200">
                                                            {action.difficulty}
                                                        </span>
                                                        {!hasRequiredTech && (
                                                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-900/50 text-red-300">
                                                                <Icon name="Lock" size={10} className="inline mr-1" />
                                                                需要{requiredTechName}
                                                            </span>
                                                        )}
                                                        {isOnCooldown && (
                                                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-900/50 text-amber-300">
                                                                <Icon name="Clock" size={10} className="inline mr-1" />
                                                                冷却中 {cooldownRemaining}天
                                                            </span>
                                                        )}
                                                    </h4>
                                                    <p className="text-xs text-gray-400 mt-1">{action.desc}</p>
                                                    {action.cooldownDays && !isOnCooldown && (
                                                        <p className="text-[11px] text-amber-300 mt-1">
                                                            冷却：{action.cooldownDays} 天
                                                        </p>
                                                    )}
                                                    {isLowReserve && (
                                                        <p className="text-[11px] text-orange-400 mt-1">
                                                            ⚠️ 敌方资源已被大量掠夺，战利品将大幅减少
                                                        </p>
                                                    )}
                                                </div>
                                                <Icon name="Target" size={18} className={hasRequiredTech && !isOnCooldown ? 'text-red-300' : 'text-gray-500'} />
                                            </div>

                                            <div className="space-y-2 text-xs text-gray-300">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-gray-400">敌方派遣</span>
                                                    <span className="text-yellow-300">
                                                        {Math.floor(deploymentRatio.min * 100)}-{Math.floor(deploymentRatio.max * 100)}%
                                                    </span>
                                                </div>

                                                {/* 新增：显示潜在防御部队/可能的敌军构成 */}
                                                <div>
                                                    <div className="flex items-center gap-1 mb-1">
                                                        <span className="text-gray-400">潜在防御部队</span>
                                                        <span className="text-[10px] text-gray-500 bg-gray-800 px-1.5 rounded border border-gray-700">
                                                            情报预估
                                                        </span>
                                                    </div>
                                                    <div className="flex flex-wrap gap-1">
                                                        {getEnemyUnitsForEpoch(enemyEpoch, action.unitScale || 'medium').map(unitId => {
                                                            const unit = UNIT_TYPES[unitId];
                                                            if (!unit) return null;
                                                            // 简单的类型图标映射
                                                            const typeIconObj = {
                                                                infantry: 'Sword',
                                                                archer: 'Crosshair',
                                                                cavalry: 'Wind',
                                                                siege: 'Hammer',
                                                                naval: 'Anchor'
                                                            };
                                                            const typeIcon = typeIconObj[unit.category] || 'User';

                                                            return (
                                                                <div
                                                                    key={unitId}
                                                                    className="flex items-center gap-1 bg-gray-800/60 px-1.5 py-0.5 rounded border border-gray-700/50 cursor-help"
                                                                    title={`${unit.name} (${unit.category === 'cavalry' ? '骑兵' : unit.category === 'archer' ? '远程' : '步兵'})`}
                                                                >
                                                                    <Icon name={typeIcon} size={10} className="text-gray-400" />
                                                                    <span className="text-[10px] text-gray-300">{unit.name}</span>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>

                                                <div className="flex items-center justify-between">
                                                    <span className="text-gray-400">预估敌方战力</span>
                                                    <span className="text-red-300 font-mono">
                                                        {formatPower(enemyPowerMin)} - {formatPower(enemyPowerMax)}
                                                    </span>
                                                </div>
                                                <div>
                                                    <p className="text-gray-400 mb-1">可能战利品：</p>
                                                    <div className="flex flex-wrap gap-2">
                                                        {Object.entries(action.loot || {}).map(([resource, range]) => (
                                                            <span
                                                                key={resource}
                                                                className="px-2 py-0.5 bg-yellow-900/20 rounded border border-yellow-600/30 text-[11px] text-yellow-200"
                                                            >
                                                                {(RESOURCES[resource]?.name || resource)} {formatLootRange(range)}
                                                            </span>
                                                        ))}
                                                        {Object.keys(action.loot || {}).length === 0 && (
                                                            <span className="text-gray-500">无特殊战利品</span>
                                                        )}
                                                    </div>
                                                </div>
                                                {action.influence && (
                                                    <div className="flex items-center justify-between text-[11px]">
                                                        <span className="text-gray-400">军人影响力</span>
                                                        <span className="text-green-400">胜利 +{action.influence.win}</span>
                                                        <span className="text-red-400">失败 {action.influence.lose}</span>
                                                    </div>
                                                )}
                                            </div>

                                            <button
                                                onClick={() => onLaunchBattle(action.id, activeNation?.id)}
                                                disabled={totalUnits === 0 || !activeNation || !hasRequiredTech || isOnCooldown}
                                                className="px-3 py-2 bg-red-600 hover:bg-red-500 disabled:bg-gray-600 disabled:text-gray-300 disabled:cursor-not-allowed text-white rounded text-sm font-semibold transition-colors flex items-center justify-center gap-2"
                                            >
                                                <Icon name="Sword" size={14} />
                                                {isOnCooldown ? `冷却中(${cooldownRemaining}天)` : hasRequiredTech ? '发起攻击' : `需研发${requiredTechName}`}
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        </>
                    )}

                    {totalUnits === 0 && (
                        <p className="text-xs text-yellow-400 mt-2">⚠️ 你需要先招募军队才能发起军事行动</p>
                    )}
                </div>
            )}

            {showWarScoreInfo && createPortal(
                <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/70 p-4">
                    <div className="bg-gray-900 border border-ancient-gold/40 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[80vh] overflow-hidden animate-fade-in-fast">
                        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-700">
                            <div>
                                <h4 className="text-lg font-bold text-white font-decorative">战争分数指引</h4>
                                <p className="text-xs text-gray-400 mt-0.5">
                                    战争分数越高，可提出的和平条件越苛刻；分数为负时，通常需要支付赔款或割地才能求和。
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowWarScoreInfo(false)}
                                className="text-gray-400 hover:text-white transition-colors"
                                aria-label="关闭战争分数指引"
                            >
                                <Icon name="X" size={18} />
                            </button>
                        </div>
                        <div className="p-5 space-y-4 overflow-y-auto">
                            {WAR_SCORE_GUIDE.map((tier) => (
                                <div
                                    key={tier.range}
                                    className="rounded-lg border border-gray-700 bg-gray-800/50 p-4"
                                >
                                    <div className="flex items-center justify-between mb-2">
                                        <div>
                                            <p className={`text-xs uppercase tracking-wide ${tier.color}`}>
                                                {tier.range}
                                            </p>
                                            <h5 className="text-sm font-semibold text-white">{tier.title}</h5>
                                        </div>
                                    </div>
                                    <ul className="list-disc list-inside text-xs text-gray-300 space-y-1">
                                        {tier.tips.map((tip, index) => (
                                            <li key={index}>{tip}</li>
                                        ))}
                                    </ul>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* 悬浮提示框 Portal */}
            <UnitTooltip
                unit={hoveredUnit.unit}
                anchorElement={hoveredUnit.element}
                resources={resources}
                market={market}
                militaryWageRatio={militaryWageRatio}
                epoch={epoch}
            />
        </div>
    );
};

// Memoized for performance - prevents re-render when props unchanged
export const MilitaryTab = memo(MilitaryTabComponent);
