// 建设标签页组件
// 显示可建造的建筑列表

import React, { useState, useEffect, useRef, useMemo, memo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '../common/UIComponents';
import { BUILDINGS, RESOURCES, STRATA } from '../../config';
import { calculateSilverCost, formatSilverCost } from '../../utils/economy';
import { filterUnlockedResources } from '../../utils/resources';
import { getPublicAssetUrl } from '../../utils/assetPath';
import { getBuildingImageUrl } from '../../utils/imageRegistry';
import { getBuildingEffectiveConfig, BUILDING_UPGRADES, getUpgradeCost } from '../../config/buildingUpgrades';
import { getBuildingCostGrowthFactor, getBuildingCostBaseMultiplier } from '../../config/difficulty';
import { calculateBuildingCost, applyBuildingCostModifier } from '../../utils/buildingUpgradeUtils';
import { formatNumberShortCN } from '../../utils/numberFormat';
import { BUILDING_CHAINS, BUILDING_TO_CHAIN } from '../../config/buildingChains';

/**
 * 建筑悬浮提示框 (使用 Portal)
 * 优化：接收预计算的业主岗位数，避免重复遍历外资和官员数据
 */
const BuildingTooltip = ({ building, count, epoch, techsUnlocked, jobFill, anchorElement, cost, resources, ownerJobsRequired }) => {
    if (!building || !anchorElement) return null;

    const [position, setPosition] = useState({ top: 0, left: 0 });
    const tooltipRef = useRef(null);

    useEffect(() => {
        if (anchorElement && tooltipRef.current) {
            const anchorRect = anchorElement.getBoundingClientRect();
            const tooltipRect = tooltipRef.current.getBoundingClientRect();

            let top = anchorRect.top;
            let left = anchorRect.right + 8; // 默认在右侧

            if (left + tooltipRect.width > window.innerWidth) {
                left = anchorRect.left - tooltipRect.width - 8;
            }

            if (top < 0) top = 0;
            if (top + tooltipRect.height > window.innerHeight) {
                top = window.innerHeight - tooltipRect.height;
            }

            setPosition({ top, left });
        }
    }, [anchorElement, building, count]);

    // 构建背景图片路径
    const backgroundImagePath = getBuildingImageUrl(building.id)
        ?? getPublicAssetUrl(`images/buildings/${building.id}.webp`);

    return createPortal(
        <div
            ref={tooltipRef}
            className="fixed w-72 border border-gray-600 rounded-lg shadow-2xl z-[9999] pointer-events-none animate-fade-in-fast overflow-hidden"
            style={{ top: `${position.top}px`, left: `${position.left}px` }}
        >
            {/* 深色底层 - 确保即使图片加载失败也有背景 */}
            <div className="absolute inset-0 bg-gray-900 z-0" />
            {/* 背景图片层 - 使用 img 标签确保正确加载 */}
            <img
                src={backgroundImagePath}
                alt=""
                className="absolute inset-0 w-full h-full object-cover z-10 opacity-40"
                style={{ filter: 'blur(1px)' }}
                onError={(e) => { e.target.style.display = 'none'; }}
            />
            {/* 渐变蒙版层 - 多层渐变确保文字清晰可读 */}
            <div className="absolute inset-0 z-20 bg-gradient-to-b from-gray-900/70 via-gray-800/50 to-gray-900/70" />
            <div className="absolute inset-0 z-20 bg-gradient-to-r from-gray-900/30 via-transparent to-gray-900/30" />
            {/* 内容层 */}
            <div className="relative p-3 z-30">
                <h4 className="text-sm font-bold text-white mb-1 font-decorative">{building.name}</h4>
                <p className="text-xs text-gray-300 mb-2">{building.desc}</p>

                {building.owner && (
                    <div className="text-[10px] text-yellow-200 bg-yellow-900/40 border border-yellow-600/40 rounded px-2 py-1 mb-2 inline-flex items-center gap-1">
                        <Icon name="User" size={10} className="text-yellow-300" />
                        业主: {STRATA[building.owner]?.name || building.owner}
                    </div>
                )}

                {cost && Object.keys(cost).length > 0 && (
                    <div className="glass-ancient rounded px-2 py-1.5 mb-2 text-xs border border-ancient-gold/20">
                        <div className="text-[10px] text-gray-300 mb-1">下一个建造成本</div>
                        {Object.entries(cost).map(([res, val]) => {
                            const hasEnough = (resources[res] || 0) >= val;
                            return (
                                <div key={`cost-${res}`} className="flex justify-between">
                                    <span className="text-gray-200">{RESOURCES[res]?.name || res}</span>
                                    <span className={`font-mono ${hasEnough ? 'text-green-400' : 'text-red-400'}`}>
                                        {val}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                )}

                {(() => {
                    const unlockedOutput = filterUnlockedResources(building.output, epoch, techsUnlocked);
                    const unlockedInput = filterUnlockedResources(building.input, epoch, techsUnlocked);
                    if (Object.keys(unlockedOutput).length === 0 && Object.keys(unlockedInput).length === 0) return null;
                    return (
                        <div className="glass-ancient rounded px-2 py-1.5 mb-2 text-xs border border-ancient-gold/20">
                            <div className="text-[10px] text-gray-300 mb-1">资源流/个</div>
                            {Object.entries(unlockedOutput).map(([res, val]) => (
                                <div key={`out-${res}`} className="flex justify-between">
                                    <span className="text-gray-200">{RESOURCES[res]?.name || res}</span>
                                    <span className="text-green-400 font-mono">+{val.toFixed(2)}</span>
                                </div>
                            ))}
                            {Object.entries(unlockedInput).map(([res, val]) => (
                                <div key={`in-${res}`} className="flex justify-between">
                                    <span className="text-gray-200">{RESOURCES[res]?.name || res}</span>
                                    <span className="text-red-400 font-mono">-{val.toFixed(2)}</span>
                                </div>
                            ))}
                        </div>
                    );
                })()}

                {building.jobs && (
                    <div className="glass-ancient rounded px-2 py-1.5 mb-2 text-xs border border-ancient-gold/20">
                        <div className="text-[10px] text-gray-300 mb-1">岗位</div>
                        {Object.entries(building.jobs).map(([job, perBuilding]) => {
                            // 优化：业主岗位使用预计算的值，避免重复遍历
                            let required = perBuilding * count;
                            if (building.owner && job === building.owner && ownerJobsRequired !== undefined) {
                                required = ownerJobsRequired;
                            }
                            const assigned = jobFill?.[building.id]?.[job] ?? 0;
                            const fillPercent = required > 0 ? Math.min(1, assigned / required) * 100 : 0;
                            return (
                                <div key={job} className="mb-1.5">
                                    <div className="flex justify-between text-[11px] text-gray-300">
                                        <span className="text-gray-200 font-semibold">{STRATA[job]?.name || job}</span>
                                        <span className="font-mono text-gray-200">{Math.round(assigned)}/{Math.round(required)}</span>
                                    </div>
                                    <div className="flex justify-between text-[10px] text-gray-500 mb-0.5">
                                        <span>每栋 {perBuilding}</span>
                                        <span>总计 {Math.round(required)}</span>
                                    </div>
                                    <div className="w-full bg-gray-700 rounded-full h-1"><div className="h-1 rounded-full bg-blue-500" style={{ width: `${fillPercent}%` }}></div></div>
                                </div>);
                        })}
                    </div>
                )}
                <div className="text-[10px] text-center text-gray-400 pt-1 border-t border-gray-700">点击查看完整数据与交互</div>
            </div>
        </div>,
        document.body
    );
};

/**
 * 紧凑型建筑卡片
 * @param {Object} building - 建筑数据
            * @param {number} count - 拥有数量
            * @param {boolean} affordable - 是否可购买
            * @param {number} silverCost - 银币成本
            * @param {number} ownerIncome - 业主收益
            * @param {Function} onBuy - 购买回调
            * @param {Function} onSell - 出售回调
            * @param {Function} onShowDetails - 显示详情回调
            */
// 更紧凑的价格格式化函数
const formatCompactCost = (value) => {
    return formatNumberShortCN(value, { decimals: 1 });
};

const CompactBuildingCard = ({
    building,
    count,
    affordable,
    silverCost,
    ownerIncome,
    onBuy,
    onSell,
    onShowDetails,
    cost,
    onMouseEnter,
    onMouseLeave,
    epoch,
    techsUnlocked,
    jobFill,
    resources,
    hasUpgrades,
    unlockedOutput = {},
    actualOutputByRes = {},
    // 优化：直接传入已计算好的业主岗位数，而非在每个卡片中重复计算
    ownerJobsRequired = 0,
}) => {
    const VisualIcon = Icon;

    return (
        <div
            className="group relative flex flex-col h-full glass-ancient border border-ancient-gold/20 rounded-lg p-1.5 text-center transition-all hover:border-ancient-gold/40 hover:shadow-glow-gold"
            data-building-id={building.id}
            data-build-card="1"
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
        >
            {/* 升级提示 - 仅在有建筑且可升级时显示 */}
            {count > 0 && hasUpgrades && (
                <div
                    className="absolute -top-1.5 -right-1.5 z-20 bg-gray-900 rounded-full shadow-lg border border-blue-500/50 animate-pulse cursor-pointer"
                    onClick={(e) => {
                        e.stopPropagation();
                        onShowDetails(building.id, { scrollToUpgrade: true }); // 点击直接打开详情页，并滚动到升级面板
                    }}
                    title="可升级"
                >
                    <VisualIcon name="ArrowUpCircle" size={14} className="text-blue-400" />
                </div>
            )}

            {/* 点击区域，用于显示详情 */}
            <div
                className="flex-grow flex flex-col items-center cursor-pointer"
                onClick={() => onShowDetails(building.id)}
            >
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center mb-0.5 icon-metal-container">
                    <VisualIcon name={building.visual.icon} size={14} className={`${building.visual.text} icon-metal`} />
                </div>
                <div className="flex flex-col items-center">
                    <h4 className="text-[12px] font-bold text-ancient-parchment leading-tight truncate max-w-[70px]">{building.name}</h4>
                    {count > 0 && <p className="text-[10px] font-bold text-ancient-gold">×{formatNumberShortCN(count, { decimals: 0 })}</p>}
                </div>
            </div>

            {/* 岗位饱和度与资源总览 - 仅在有建筑时显示，且更紧凑 */}
            {count > 0 && (
                <div className="space-y-0.5 text-[9px] my-1">
                    {/* 岗位饱和度 - 只显示进度条，不显示标签 */}
                    {building.jobs && Object.keys(building.jobs).length > 0 && (
                        <div className="bg-gray-900/40 rounded px-1 py-0.5">
                            {Object.entries(building.jobs).map(([job, perBuilding]) => {
                                // 优化：业主岗位使用预计算的值，避免在每个卡片中重复计算
                                let required = perBuilding * count;
                                if (building.owner && job === building.owner) {
                                    required = ownerJobsRequired;
                                }
                                const assigned = jobFill?.[building.id]?.[job] ?? 0;
                                const fillPercent = required > 0 ? Math.min(1, assigned / required) * 100 : 0;
                                return (
                                    <div key={job} className="flex items-center gap-0.5" title={`${STRATA[job]?.name}: ${Math.round(assigned)}/${Math.round(required)}`}>
                                        <Icon name={STRATA[job]?.icon || 'User'} size={8} className="text-gray-400 flex-shrink-0" />
                                        <div className="flex-1 bg-gray-700 rounded-full h-1">
                                            <div className="h-1 rounded-full bg-green-500" style={{ width: `${fillPercent}%` }}></div>
                                        </div>
                                        <span className="font-mono text-[8px] text-gray-300 whitespace-nowrap">{formatNumberShortCN(assigned, { decimals: 0 })}/{formatNumberShortCN(required, { decimals: 0 })}</span>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                    {/* 资源产出 - 更紧凑的显示 */}
                    {(() => {
                        if (Object.keys(unlockedOutput).length === 0) return null;
                        return (
                            <div className="bg-gray-900/40 rounded px-1 py-0.5">
                                <div className="flex flex-wrap gap-0.5 justify-center">
                                    {Object.entries(unlockedOutput).map(([res, val]) => {
                                        const actualTotalOutput = actualOutputByRes?.[res] ?? val * count;
                                        return (
                                            <div key={res} className="flex items-center gap-0.5 text-green-300" title={`${RESOURCES[res]?.name} - 单个产出: ${val} / 实际总产出: ${actualTotalOutput.toFixed(1)}`}>
                                                <Icon name={RESOURCES[res]?.icon || 'Box'} size={8} />
                                                <span className="font-mono text-[9px]">+{formatNumberShortCN(actualTotalOutput, { decimals: 0 })}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })()}
                </div>
            )}

            {/* 操作按钮 - 上下排布 */}
            <div className="mt-auto pt-0.5 flex flex-col gap-0.5">
                <button
                    onClick={(e) => { e.stopPropagation(); onBuy(building.id); }}
                    disabled={!affordable}
                    className={`w-full px-1 py-0.5 rounded text-[10px] font-semibold transition-all ${affordable
                        ? 'bg-green-600/80 hover:bg-green-500 text-white'
                        : 'bg-gray-700/60 text-gray-400 cursor-not-allowed'
                        } flex items-center justify-center gap-0.5`}
                    title={`建造: ${silverCost.toFixed(0)} 银币`}
                >
                    <Icon name="Plus" size={8} className="flex-shrink-0" />
                    <Icon name="Coins" size={8} className="text-yellow-300 opacity-80 flex-shrink-0" />
                    <span className={`truncate ${!affordable ? 'text-red-300' : ''}`}>{formatCompactCost(silverCost)}</span>
                </button>

                {count > 0 && (
                    <button
                        onClick={(e) => { e.stopPropagation(); onSell(building.id); }}
                        className="w-full px-1 py-0.5 bg-red-600/80 hover:bg-red-500 text-white rounded text-[10px] font-semibold transition-all flex items-center justify-center gap-0.5"
                        title="拆除"
                    >
                        <Icon name="Minus" size={8} />
                        <span>拆除</span>
                    </button>
                )}
            </div>
        </div>
    );
};

// 使用 memo 并添加自定义比较函数，避免不必要的重渲染
const MemoCompactBuildingCard = memo(CompactBuildingCard, (prevProps, nextProps) => {
    // 只比较关键属性，避免深度比较大数组
    return (
        prevProps.building.id === nextProps.building.id &&
        prevProps.count === nextProps.count &&
        prevProps.affordable === nextProps.affordable &&
        prevProps.silverCost === nextProps.silverCost &&
        prevProps.hasUpgrades === nextProps.hasUpgrades &&
        prevProps.ownerJobsRequired === nextProps.ownerJobsRequired &&
        prevProps.epoch === nextProps.epoch
    );
});


/**
 * 建设标签页组件
 * 显示可建造的建筑列表
 * @param {Object} buildings - 已建造的建筑对象
            * @param {Object} resources - 资源对象
            * @param {number} epoch - 当前时代
            * @param {Array} techsUnlocked - 已解锁的科技数组
            * @param {Function} onBuy - 购买建筑回调
            * @param {Function} onSell - 出售建筑回调
            */
const BuildTabComponent = ({
    buildings,
    resources,
    epoch,
    techsUnlocked,
    popStructure: _popStructure = {}, // 保留以备将来使用
    jobFill = {},
    buildingJobsRequired = {}, // [NEW] 从模拟端获取的每个建筑的实际岗位需求
    buildingUpgrades = {},
    onBuy,
    onSell,
    onShowDetails, // 新增：用于打开详情页的回调
    market,
    buildingFinancialData = {},
    difficulty,
    buildingCostMod = 0,
}) => {
    const [hoveredBuilding, setHoveredBuilding] = useState({ building: null, element: null });
    const [viewport, setViewport] = useState(() => {
        if (typeof window === 'undefined') return { scrollY: 0, height: 0, width: 0 };
        return {
            scrollY: window.scrollY || window.pageYOffset || 0,
            height: window.innerHeight,
            width: window.innerWidth,
        };
    });
    // More reliable hover detection: requires both hover capability AND fine pointer (mouse/trackpad)
    // This prevents tooltips from showing on touch devices that falsely report hover support
    const canHover = useMemo(() => {
        if (typeof window === 'undefined' || !window.matchMedia) return false;
        return window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    }, []);
    const gridRefs = useRef({});
    const rowHeightsRef = useRef({});
    const [virtualRangeByCategory, setVirtualRangeByCategory] = useState({});

    // 优化：使用useCallback稳定化handleMouseEnter，减少子组件重渲染
    const handleMouseEnter = useCallback((e, building, cost) => {
        if (canHover) setHoveredBuilding({ building, element: e.currentTarget, cost });
    }, [canHover]);

    const handleMouseLeave = useCallback(() => {
        if (canHover) setHoveredBuilding({ building: null, element: null });
    }, [canHover]);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        let rafId = 0;
        const update = () => {
            rafId = 0;
            setViewport({
                scrollY: window.scrollY || window.pageYOffset || 0,
                height: window.innerHeight,
                width: window.innerWidth,
            });
        };
        const onScroll = () => {
            if (rafId) return;
            rafId = window.requestAnimationFrame(update);
        };
        window.addEventListener('scroll', onScroll, { passive: true });
        window.addEventListener('resize', onScroll);
        update();
        return () => {
            window.removeEventListener('scroll', onScroll);
            window.removeEventListener('resize', onScroll);
            if (rafId) window.cancelAnimationFrame(rafId);
        };
    }, []);

    // [优化] 使用模拟端预计算的 buildingJobsRequired 数据
    // 直接从模拟端获取业主岗位数，避免在UI层重复计算
    const ownerJobsCorrections = useMemo(() => {
        const corrections = {};
        BUILDINGS.forEach(building => {
            if (!building.owner || !building.jobs) return;
            const count = buildings[building.id] || 0;
            if (count <= 0) return;
            const ownerRole = building.owner;
            
            // 优先使用模拟端预计算的值
            if (buildingJobsRequired[building.id] && buildingJobsRequired[building.id][ownerRole] !== undefined) {
                corrections[building.id] = buildingJobsRequired[building.id][ownerRole];
            } else {
                // 降级：没有模拟端数据时使用原始计算（一般不会走到这里）
                const ownerSlotsPerBuilding = building.jobs[ownerRole] || 0;
                corrections[building.id] = ownerSlotsPerBuilding * count;
            }
        });
        return corrections;
    }, [buildings, buildingJobsRequired]);

    const NON_TRADE_KEYS = new Set(['maxPop']);
    const getResourcePrice = (key) => {
        if (!key || key === 'silver') return 1;
        const def = RESOURCES[key];
        if (!def) return 0;
        if (NON_TRADE_KEYS.has(key)) return 0;
        return market?.prices?.[key] ?? def.basePrice ?? 0;
    };

    const getOwnerIncomePerBuilding = (building) => {
        const outputValue = Object.entries(building.output || {}).reduce((sum, [res, val]) => {
            const price = getResourcePrice(res);
            return sum + price * val;
        }, 0);
        const inputValue = Object.entries(building.input || {}).reduce((sum, [res, val]) => {
            const price = getResourcePrice(res);
            return sum + price * val;
        }, 0);
        const wageCost = Object.entries(building.jobs || {}).reduce((sum, [job, perBuilding]) => {
            const wage = market?.wages?.[job] ?? 0;
            return sum + wage * perBuilding;
        }, 0);
        return outputValue - inputValue - wageCost;
    };

    // 新增：计算考虑了工作效率的实际人均收入
    const getActualOwnerPerCapitaIncome = (building, count) => {
        if (count === 0) return 0;

        // Prefer real simulation stats when available
        const finance = buildingFinancialData?.[building.id];
        if (finance) {
            const ownerSlots = building.jobs?.[building.owner] || 1;
            const profitPerBuilding =
                (finance.ownerRevenue || 0)
                - (finance.productionCosts || 0)
                - (finance.businessTaxPaid || 0)
                - Object.values(finance.wagesByRole || {}).reduce((s, v) => s + (v || 0), 0);
            return profitPerBuilding / ownerSlots;
        }

        // Fallback: heuristic estimate using working ratio + market wages
        const totalRequired = Object.values(building.jobs || {}).reduce((sum, per) => sum + per * count, 0);
        const totalAssigned = Object.values(jobFill?.[building.id] || {}).reduce((sum, num) => sum + num, 0);
        const workingRatio = totalRequired > 0 ? Math.min(1, totalAssigned / totalRequired) : 1;

        const actualOutputValue = Object.entries(building.output || {}).reduce((sum, [res, val]) => sum + getResourcePrice(res) * val * workingRatio, 0);
        const actualInputValue = Object.entries(building.input || {}).reduce((sum, [res, val]) => sum + getResourcePrice(res) * val * workingRatio, 0);

        const actualWageCost = Object.entries(jobFill?.[building.id] || {}).reduce((sum, [job, assignedCount]) => {
            const wage = market?.wages?.[job] ?? 0;
            return sum + wage * (assignedCount / count);
        }, 0);

        const actualProfitPerBuilding = actualOutputValue - actualInputValue - actualWageCost;
        const ownerWorkers = building.jobs?.[building.owner] || 1;
        return actualProfitPerBuilding / ownerWorkers;
    };

    const getJobIncomePerBuilding = (building, ownerIncome) => {
        const finance = buildingFinancialData?.[building.id];

        const jobEntries = Object.keys(building.jobs || {}).map(job => {
            const realPerCapita = finance?.paidWagePerWorkerByRole?.[job];
            const wage = Number.isFinite(realPerCapita)
                ? realPerCapita
                : (market?.wages?.[job] ?? 0);
            return {
                job,
                perCapitaIncome: wage,
            };
        });

        // Owner: if we have finance stats, use realized owner income per slot.
        if (building.owner) {
            const ownerRole = jobEntries.find(entry => entry.job === building.owner);
            if (ownerRole) {
                const ownerSlots = building.jobs?.[building.owner] || 1;
                if (finance) {
                    const profitPerBuilding =
                        (finance.ownerRevenue || 0)
                        - (finance.productionCosts || 0)
                        - (finance.businessTaxPaid || 0)
                        - Object.values(finance.wagesByRole || {}).reduce((s, v) => s + (v || 0), 0);
                    ownerRole.perCapitaIncome = profitPerBuilding / ownerSlots;
                } else if (jobEntries.every(entry => entry.perCapitaIncome === 0)) {
                    ownerRole.perCapitaIncome = ownerIncome / ownerSlots;
                }
            }
        }

        return jobEntries;
    };

    /**
     * 检查建筑是否可用
     * @param {Object} building - 建筑对象
     * @returns {boolean}
     */
    const isBuildingAvailable = (building) => {
        // 检查时代要求
        if (building.epoch > epoch) return false;

        if (building.requiresTech && !techsUnlocked.includes(building.requiresTech)) return false;

        return true;
    };

    /**
     * 计算建筑成本
     * @param {Object} building - 建筑对象
     * @returns {Object} 成本对象
     */
    const calculateCost = (building) => {
        const count = buildings[building.id] || 0;
        const growthFactor = getBuildingCostGrowthFactor(difficulty);
        const baseMultiplier = getBuildingCostBaseMultiplier(difficulty);
        const totalCost = calculateBuildingCost(building.baseCost, count, growthFactor, baseMultiplier);
        // 传入基础成本，确保减免只作用于数量惩罚部分
        return applyBuildingCostModifier(totalCost, buildingCostMod, building.baseCost);
    };

    const buildLevelCounts = (count, upgradeLevels) => {
        let upgradedCount = 0;
        Object.entries(upgradeLevels).forEach(([lvlStr, lvlCount]) => {
            const lvl = parseInt(lvlStr);
            if (Number.isFinite(lvl) && lvl > 0 && lvlCount > 0) {
                upgradedCount += lvlCount;
            }
        });

        const levelCounts = { 0: Math.max(0, count - upgradedCount) };
        Object.entries(upgradeLevels).forEach(([lvlStr, lvlCount]) => {
            const lvl = parseInt(lvlStr);
            if (Number.isFinite(lvl) && lvl > 0 && lvlCount > 0) {
                levelCounts[lvl] = lvlCount;
            }
        });

        return levelCounts;
    };

    const buildingStatsById = useMemo(() => {
        const stats = {};
        // 获取当前难度的增长系数
        const growthFactor = getBuildingCostGrowthFactor(difficulty);
        const baseMultiplier = getBuildingCostBaseMultiplier(difficulty);

        BUILDINGS.forEach((building) => {
            const count = buildings[building.id] || 0;
            const upgradeLevels = buildingUpgrades[building.id] || {};
            const cost = calculateCost(building); // Use the unified calculateCost to ensure consistency

            let averageBuilding = building;
            let levelCounts = null;
            let hasAnyUpgrade = false;

            if (count > 0) {
                levelCounts = buildLevelCounts(count, upgradeLevels);
                hasAnyUpgrade = Object.keys(levelCounts).some((lvlStr) => parseInt(lvlStr) > 0);
            }

            if (count > 0 && hasAnyUpgrade && levelCounts) {
                const effectiveOps = { input: {}, output: {}, jobs: {} };
                for (const [lvlStr, lvlCount] of Object.entries(levelCounts)) {
                    if (lvlCount <= 0) continue;
                    const lvl = parseInt(lvlStr);
                    const config = getBuildingEffectiveConfig(building, lvl);
                    if (config.input) {
                        for (const [k, v] of Object.entries(config.input)) {
                            effectiveOps.input[k] = (effectiveOps.input[k] || 0) + v * lvlCount;
                        }
                    }
                    if (config.output) {
                        for (const [k, v] of Object.entries(config.output)) {
                            effectiveOps.output[k] = (effectiveOps.output[k] || 0) + v * lvlCount;
                        }
                    }
                    if (config.jobs) {
                        for (const [k, v] of Object.entries(config.jobs)) {
                            effectiveOps.jobs[k] = (effectiveOps.jobs[k] || 0) + v * lvlCount;
                        }
                    }
                }

                const avg = { ...building, input: {}, output: {}, jobs: {} };
                for (const [k, v] of Object.entries(effectiveOps.input)) avg.input[k] = v / count;
                for (const [k, v] of Object.entries(effectiveOps.output)) avg.output[k] = v / count;
                for (const [k, v] of Object.entries(effectiveOps.jobs)) avg.jobs[k] = v / count;
                averageBuilding = avg;
            }

            const maxLevel = BUILDING_UPGRADES[building.id]?.length || 0;
            const upgradeOptions = [];
            if (count > 0 && maxLevel > 0 && levelCounts) {
                for (const [lvlStr, lvlCount] of Object.entries(levelCounts)) {
                    if (lvlCount <= 0) continue;
                    const currentLevel = parseInt(lvlStr);
                    if (currentLevel >= maxLevel) continue;
                    const targetLevel = currentLevel + 1;

                    let existingCountAtTarget = 0;
                    Object.entries(levelCounts).forEach(([l, c]) => {
                        if (parseInt(l) >= targetLevel && c > 0) {
                            existingCountAtTarget += c;
                        }
                    });

                    // 传递 growthFactor 确保升级成本与难度设置一致
                    const upgradeCost = getUpgradeCost(building.id, targetLevel, existingCountAtTarget, growthFactor);
                    if (upgradeCost) {
                        upgradeOptions.push(upgradeCost);
                    }
                }
            }

            stats[building.id] = {
                count,
                averageBuilding,
                cost,
                upgradeOptions,
            };
        });

        return stats;
    }, [buildings, buildingUpgrades, difficulty]);

    const availableBuildingsByCategory = useMemo(() => {
        const grouped = {};
        BUILDINGS.forEach((building) => {
            if (!isBuildingAvailable(building)) return;
            const key = building.cat || 'misc';
            if (!grouped[key]) grouped[key] = [];
            grouped[key].push(building);
        });
        return grouped;
    }, [epoch, techsUnlocked]);

    const gridColumns = useMemo(() => {
        const width = viewport.width || (typeof window !== 'undefined' ? window.innerWidth : 0);
        if (width >= 1536) return 11;
        if (width >= 1280) return 9;
        if (width >= 1024) return 7;
        if (width >= 768) return 6;
        if (width >= 640) return 5;
        return 4;
    }, [viewport.width]);

    const buildingJobStatsById = useMemo(() => {
        const stats = {};
        BUILDINGS.forEach((building) => {
            const count = buildingStatsById[building.id]?.count ?? 0;
            if (count <= 0) {
                stats[building.id] = { totalRequired: 0, totalAssigned: 0, workingRatio: 0 };
                return;
            }
            const requiredMap = buildingJobsRequired?.[building.id];
            const totalRequired = requiredMap
                ? Object.values(requiredMap).reduce((sum, per) => sum + (per || 0), 0)
                : Object.values(building.jobs || {}).reduce((sum, per) => sum + per * count, 0);
            const filledByRole = buildingFinancialData?.[building.id]?.filledByRole;
            const totalAssigned = filledByRole
                ? Object.values(filledByRole).reduce((sum, num) => sum + (num || 0), 0)
                : Object.values(jobFill?.[building.id] || {}).reduce((sum, num) => sum + (num || 0), 0);
            const workingRatio = totalRequired > 0 ? Math.min(1, totalAssigned / totalRequired) : 1;
            stats[building.id] = { totalRequired, totalAssigned, workingRatio };
        });
        return stats;
    }, [buildingStatsById, buildingJobsRequired, buildingFinancialData, jobFill]);

    const categoryWorkersByKey = useMemo(() => {
        const workers = {};
        Object.entries(availableBuildingsByCategory).forEach(([key, list]) => {
            workers[key] = list.reduce((sum, building) => {
                const assigned = buildingJobStatsById[building.id]?.totalAssigned || 0;
                return sum + assigned;
            }, 0);
        });
        return workers;
    }, [availableBuildingsByCategory, buildingJobStatsById]);

    const cardDataById = useMemo(() => {
        const data = {};
        const silverResource = resources.silver || 0;
        BUILDINGS.forEach((building) => {
            if (!isBuildingAvailable(building)) return;

            const stats = buildingStatsById[building.id] || {};
            const count = stats.count ?? 0;
            const averageBuilding = stats.averageBuilding || building;
            const cost = stats.cost || calculateCost(building);
            const upgradeOptions = stats.upgradeOptions || [];
            const jobStats = buildingJobStatsById[building.id] || {};
            const finance = buildingFinancialData?.[building.id];
            // 优化：减少 Object.entries 调用次数
            let canUpgradeAny = false;
            for (const upgradeCost of upgradeOptions) {
                const silverCost = upgradeCost.silver || 0;
                if (silverResource < silverCost) continue;
                let canAfford = true;
                for (const [res, amount] of Object.entries(upgradeCost)) {
                    if (res !== 'silver' && (resources[res] || 0) < amount) {
                        canAfford = false;
                        break;
                    }
                }
                if (canAfford) {
                    canUpgradeAny = true;
                    break;
                }
            }

            const silverCost = calculateSilverCost(cost, market);
            // 优化：减少 Object.entries 调用
            let hasMaterials = true;
            for (const [res, val] of Object.entries(cost)) {
                if ((resources[res] || 0) < val) {
                    hasMaterials = false;
                    break;
                }
            }
            const hasSilver = silverResource >= silverCost;
            const affordable = hasMaterials && hasSilver;
            const unlockedOutput = filterUnlockedResources(averageBuilding.output, epoch, techsUnlocked);
            const actualOutputByRes = {};
            const productionEfficiency = finance?.productionEfficiency;
            const workingRatio = jobStats.workingRatio ?? 0;
            const outputMultiplier = Number.isFinite(productionEfficiency) ? productionEfficiency : workingRatio;
            Object.entries(unlockedOutput).forEach(([res, val]) => {
                actualOutputByRes[res] = val * count * outputMultiplier;
            });

            data[building.id] = {
                building: averageBuilding,
                count,
                cost,
                canUpgradeAny,
                silverCost,
                affordable,
                unlockedOutput,
                actualOutputByRes,
                // 移除 actualIncome 计算，因为 CompactBuildingCard 不再使用它
            };
        });
        return data;
    }, [buildingStatsById, buildingJobStatsById, buildingFinancialData, epoch, techsUnlocked, market, resources, buildingCostMod]);

    // 建筑链展开状态
    const [expandedChains, setExpandedChains] = useState(new Set());
    const chainPopupRef = useRef(null);

    const toggleChainExpand = useCallback((chainId, event) => {
        event?.stopPropagation();
        setExpandedChains(prev => {
            const next = new Set(prev);
            if (next.has(chainId)) {
                next.delete(chainId);
            } else {
                // 关闭其他展开的链
                next.clear();
                next.add(chainId);
            }
            return next;
        });
    }, []);

    // 点击外部关闭展开的链
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (expandedChains.size > 0 && chainPopupRef.current && !chainPopupRef.current.contains(e.target)) {
                setExpandedChains(new Set());
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [expandedChains.size]);

    // 按链分组建筑
    const groupedBuildingsByCategory = useMemo(() => {
        const result = {};

        Object.entries(availableBuildingsByCategory).forEach(([catKey, categoryBuildings]) => {
            const chainGroups = {};  // chainId -> buildings[]
            const standalone = [];   // 不属于任何链的建筑

            categoryBuildings.forEach(building => {
                const chainId = BUILDING_TO_CHAIN[building.id];
                if (chainId) {
                    if (!chainGroups[chainId]) chainGroups[chainId] = [];
                    chainGroups[chainId].push(building);
                } else {
                    standalone.push(building);
                }
            });

            // 按时代排序每个链内的建筑
            Object.values(chainGroups).forEach(chainBuildings => {
                chainBuildings.sort((a, b) => a.epoch - b.epoch);
            });

            result[catKey] = { chainGroups, standalone };
        });

        return result;
    }, [availableBuildingsByCategory]);

    // 渲染单个建筑卡片的辅助函数
    // 优化：减少依赖项，使用预计算的 ownerJobsCorrections
    const renderBuildingCard = useCallback((building) => {
        const cardData = cardDataById[building.id];
        if (!cardData) return null;

        const {
            building: averageBuilding,
            count,
            cost,
            canUpgradeAny,
            silverCost,
            affordable,
            unlockedOutput,
            actualOutputByRes,
        } = cardData;

        // 获取预计算的业主岗位数
        const ownerJobsRequired = ownerJobsCorrections[building.id] ?? (building.jobs?.[building.owner] || 0) * count;

        return (
            <MemoCompactBuildingCard
                key={building.id}
                building={averageBuilding}
                count={count}
                affordable={affordable}
                silverCost={silverCost}
                cost={cost}
                onBuy={onBuy}
                onSell={onSell}
                onMouseEnter={(e) => handleMouseEnter(e, averageBuilding, cost)}
                onMouseLeave={handleMouseLeave}
                epoch={epoch}
                techsUnlocked={techsUnlocked}
                jobFill={jobFill}
                resources={resources}
                onShowDetails={onShowDetails}
                hasUpgrades={canUpgradeAny}
                ownerJobsRequired={ownerJobsRequired}
                unlockedOutput={unlockedOutput}
                actualOutputByRes={actualOutputByRes}
            />
        );
    }, [cardDataById, ownerJobsCorrections, onBuy, onSell, handleMouseEnter, handleMouseLeave, epoch, techsUnlocked, jobFill, resources, onShowDetails]);

    const renderChainTopCard = useCallback((chainId, topBuilding, otherBuildings) => {
        const topCardData = cardDataById[topBuilding.id];
        if (!topCardData) return null;

        const chain = BUILDING_CHAINS[chainId];
        const isExpanded = expandedChains.has(chainId);
        const hasOthers = otherBuildings.length > 0;

        const {
            building: averageBuilding,
            count,
            cost,
            canUpgradeAny,
            silverCost,
            affordable,
            unlockedOutput,
            actualOutputByRes,
        } = topCardData;

        return (
            <div key={topBuilding.id} className="relative" data-build-card="1">
                <MemoCompactBuildingCard
                    building={averageBuilding}
                    count={count}
                    affordable={affordable}
                    silverCost={silverCost}
                    cost={cost}
                    onBuy={onBuy}
                    onSell={onSell}
                    onMouseEnter={(e) => handleMouseEnter(e, averageBuilding, cost)}
                    onMouseLeave={handleMouseLeave}
                    epoch={epoch}
                    techsUnlocked={techsUnlocked}
                    jobFill={jobFill}
                    resources={resources}
                    onShowDetails={onShowDetails}
                    hasUpgrades={canUpgradeAny}
                    ownerJobsRequired={ownerJobsCorrections[topBuilding.id] ?? (topBuilding.jobs?.[topBuilding.owner] || 0) * count}
                    unlockedOutput={unlockedOutput}
                    actualOutputByRes={actualOutputByRes}
                />

                {/* 链展开角标 - 右侧偏上 */}
                {hasOthers && (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            toggleChainExpand(chainId);
                        }}
                        className={`absolute top-[7%] -right-2 z-30 flex items-center gap-0.5 px-1.5 py-1 rounded-full text-[9px] font-bold transition-all border shadow-md ${isExpanded
                            ? 'bg-ancient-gold text-gray-900 border-ancient-gold'
                            : 'bg-gray-800 text-ancient-gold border-ancient-gold/50 hover:bg-gray-700'
                            }`}
                        title={isExpanded ? `收起 ${chain.name}` : `展开 ${chain.name} (+${otherBuildings.length})`}
                    >
                        <Icon name={isExpanded ? 'ChevronLeft' : 'ChevronRight'} size={12} />
                        <span>{otherBuildings.length}</span>
                    </button>
                )}
            </div>
        );
    }, [cardDataById, expandedChains, ownerJobsCorrections, toggleChainExpand, onBuy, onSell, handleMouseEnter, handleMouseLeave, epoch, techsUnlocked, jobFill, resources, onShowDetails]);

    const flatItemsByCategory = useMemo(() => {
        const result = {};
        Object.entries(availableBuildingsByCategory).forEach(([catKey, categoryBuildings]) => {
            const grouped = groupedBuildingsByCategory[catKey];
            if (!grouped) {
                result[catKey] = [];
                return;
            }

            const { chainGroups } = grouped;
            const renderedChainIds = new Set();
            const items = [];

            categoryBuildings.forEach(building => {
                const chainId = BUILDING_TO_CHAIN[building.id];
                if (chainId && chainGroups[chainId]) {
                    if (!renderedChainIds.has(chainId)) {
                        renderedChainIds.add(chainId);
                        const chainBuildings = chainGroups[chainId];
                        const topBuilding = chainBuildings[chainBuildings.length - 1];
                        const otherBuildings = chainBuildings.slice(0, -1);
                        items.push({
                            type: 'chain-top',
                            chainId,
                            building: topBuilding,
                            otherBuildings,
                        });
                        if (expandedChains.has(chainId)) {
                            otherBuildings.forEach(other => {
                                items.push({ type: 'building', building: other });
                            });
                        }
                    }
                } else {
                    items.push({ type: 'building', building });
                }
            });

            result[catKey] = items;
        });
        return result;
    }, [availableBuildingsByCategory, groupedBuildingsByCategory, expandedChains]);

    // 按类别分组建筑
    const categories = {
        gather: { name: '采集与农业', icon: 'Wheat', color: 'text-yellow-400' },
        industry: { name: '工业生产', icon: 'Factory', color: 'text-blue-400' },
        civic: { name: '市政建筑', icon: 'Home', color: 'text-green-400' },
        military: { name: '军事建筑', icon: 'Swords', color: 'text-red-400' },
    };
    const categoryFilters = [
        { key: 'all', label: '全部' },
        { key: 'gather', label: '采集' },
        { key: 'industry', label: '工业' },
        { key: 'civic', label: '市政' },
        { key: 'military', label: '军事' },
    ];
    const [activeCategory, setActiveCategory] = useState('all');
    const categoriesToRender =
        activeCategory === 'all'
            ? Object.entries(categories)
            : Object.entries(categories).filter(([key]) => key === activeCategory);

    useEffect(() => {
        const DEFAULT_ROW_HEIGHT = 140;
        const OVERSCAN_ROWS = 4;
        const nextRanges = {};

        categoriesToRender.forEach(([catKey]) => {
            const items = flatItemsByCategory[catKey] || [];
            const totalItems = items.length;
            if (totalItems === 0) return;

            const gridEl = gridRefs.current[catKey];
            if (!gridEl) {
                nextRanges[catKey] = {
                    startIndex: 0,
                    endIndex: totalItems,
                    topSpacerHeight: 0,
                    bottomSpacerHeight: 0,
                    enabled: false,
                };
                return;
            }

            const cardEl = gridEl.querySelector('[data-build-card="1"]');
            if (cardEl) {
                const gridStyle = window.getComputedStyle(gridEl);
                const gap = parseFloat(gridStyle.rowGap || gridStyle.gap || 0) || 0;
                rowHeightsRef.current[catKey] = cardEl.getBoundingClientRect().height + gap;
            }

            const rowHeight = rowHeightsRef.current[catKey] || DEFAULT_ROW_HEIGHT;
            const totalRows = Math.ceil(totalItems / gridColumns);
            if (totalRows <= 0) return;

            if (totalItems < gridColumns * 4) {
                nextRanges[catKey] = {
                    startIndex: 0,
                    endIndex: totalItems,
                    topSpacerHeight: 0,
                    bottomSpacerHeight: 0,
                    enabled: false,
                };
                return;
            }

            const gridRect = gridEl.getBoundingClientRect();
            const gridTop = gridRect.top + window.scrollY;
            const viewTop = viewport.scrollY;
            const viewBottom = viewport.scrollY + viewport.height;

            const startRowRaw = Math.floor((viewTop - gridTop) / rowHeight) - OVERSCAN_ROWS;
            const endRowRaw = Math.ceil((viewBottom - gridTop) / rowHeight) + OVERSCAN_ROWS;
            const startRow = Math.max(0, Math.min(totalRows - 1, startRowRaw));
            const endRow = Math.max(startRow, Math.min(totalRows - 1, endRowRaw));

            const startIndex = startRow * gridColumns;
            const endIndex = Math.min(totalItems, (endRow + 1) * gridColumns);
            const topSpacerHeight = startRow * rowHeight;
            const bottomSpacerHeight = (totalRows - endRow - 1) * rowHeight;

            nextRanges[catKey] = {
                startIndex,
                endIndex,
                topSpacerHeight,
                bottomSpacerHeight,
                enabled: true,
            };
        });

        setVirtualRangeByCategory(prev => {
            const prevKeys = Object.keys(prev);
            const nextKeys = Object.keys(nextRanges);
            if (prevKeys.length !== nextKeys.length) return nextRanges;
            for (const key of nextKeys) {
                const next = nextRanges[key];
                const current = prev[key];
                if (!current) return nextRanges;
                if (
                    current.enabled !== next.enabled ||
                    current.startIndex !== next.startIndex ||
                    current.endIndex !== next.endIndex ||
                    current.topSpacerHeight !== next.topSpacerHeight ||
                    current.bottomSpacerHeight !== next.bottomSpacerHeight
                ) {
                    return nextRanges;
                }
            }
            return prev;
        });
    }, [categoriesToRender, flatItemsByCategory, gridColumns, viewport.scrollY, viewport.height]);

    return (
        <div className="space-y-4 build-tab">
            <div className="flex items-center gap-2 text-sm rounded-full glass-ancient border border-ancient-gold/30 p-1 shadow-metal-sm overflow-x-auto">
                {categoryFilters.map((filter) => {
                    const isActive = filter.key === activeCategory;
                    return (
                        <button
                            key={filter.key}
                            onClick={() => setActiveCategory(filter.key)}
                            className={`appearance-none min-w-[64px] px-4 py-2 rounded-full border-2 text-xs font-semibold transition-all ${isActive
                                ? 'bg-ancient-gold/20 border-ancient-gold/70 text-ancient-parchment shadow-gold-metal'
                                : 'bg-transparent border-transparent text-ancient-stone hover:text-ancient-parchment'
                                }`}
                            aria-pressed={isActive}
                        >
                            {filter.label}
                        </button>
                    );
                })}
            </div>

            {categoriesToRender.map(([catKey, catInfo]) => {
                const categoryWorkers = categoryWorkersByKey[catKey] || 0;

                return (
                    <div key={catKey} className="glass-ancient p-4 rounded-xl border border-ancient-gold/30">
                        {/* 类别标题 */}
                        <h3 className="text-sm font-bold mb-3 flex items-center gap-2 text-gray-300 font-decorative">
                            <Icon name={catInfo.icon} size={16} className={catInfo.color} />
                            {catInfo.name}
                            <span className="inline-flex items-center gap-1 text-[11px] font-normal text-gray-400">
                                <Icon name="Users" size={12} className="text-gray-400" />
                                {formatNumberShortCN(Math.round(categoryWorkers), { decimals: 1 })}
                            </span>
                        </h3>

                        {/* 建筑列表 - 使用链分组 */}
                        <div
                            ref={(el) => { gridRefs.current[catKey] = el; }}
                            className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-7 xl:grid-cols-9 2xl:grid-cols-11 gap-1"
                        >
                            {(() => {
                                const items = flatItemsByCategory[catKey] || [];
                                const range = virtualRangeByCategory[catKey];
                                const useVirtual = range?.enabled;
                                const startIndex = useVirtual ? range.startIndex : 0;
                                const endIndex = useVirtual ? range.endIndex : items.length;
                                const visibleItems = items.slice(startIndex, endIndex);

                                const renderedItems = visibleItems.map((item) => {
                                    if (item.type === 'chain-top') {
                                        return renderChainTopCard(item.chainId, item.building, item.otherBuildings);
                                    }
                                    return renderBuildingCard(item.building);
                                });

                                return (
                                    <>
                                        {useVirtual && range.topSpacerHeight > 0 && (
                                            <div
                                                key={`${catKey}-spacer-top`}
                                                className="col-span-full"
                                                style={{ height: `${range.topSpacerHeight}px` }}
                                            />
                                        )}
                                        {renderedItems}
                                        {useVirtual && range.bottomSpacerHeight > 0 && (
                                            <div
                                                key={`${catKey}-spacer-bottom`}
                                                className="col-span-full"
                                                style={{ height: `${range.bottomSpacerHeight}px` }}
                                            />
                                        )}
                                    </>
                                );
                            })()}
                        </div>
                    </div>
                );
            })}

            {/* 悬浮提示框 Portal */}
            <BuildingTooltip
                building={hoveredBuilding.building}
                anchorElement={hoveredBuilding.element}
                count={hoveredBuilding.building ? (buildings[hoveredBuilding.building.id] || 0) : 0}
                epoch={epoch}
                techsUnlocked={techsUnlocked}
                jobFill={jobFill}
                cost={hoveredBuilding.cost}
                resources={resources}
                ownerJobsRequired={hoveredBuilding.building ? ownerJobsCorrections[hoveredBuilding.building.id] : undefined}
            />
        </div>
    );
};

// Memoized for performance - prevents re-render when props unchanged
export const BuildTab = memo(BuildTabComponent);
