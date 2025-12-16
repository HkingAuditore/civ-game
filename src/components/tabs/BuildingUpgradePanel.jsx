import React, { useMemo, useRef, useCallback, useState, useEffect } from 'react';
import { Icon } from '../common/UIComponents';
import { RESOURCES, STRATA } from '../../config';
import { BUILDING_UPGRADES, getUpgradeCost, getMaxUpgradeLevel, getBuildingEffectiveConfig } from '../../config/buildingUpgrades';
import { getBuildingLevelDistribution, canBuildingUpgrade } from '../../utils/buildingUpgradeUtils';

// 长按阈值（毫秒）
const LONG_PRESS_THRESHOLD = 600;

/**
 * 长按按钮组件 - 带进度条动画
 */
const LongPressButton = ({
    onClick,
    onLongPress,
    disabled,
    className,
    title,
    children,
    variant = 'upgrade'
}) => {
    const timerRef = useRef(null);
    const isLongPressRef = useRef(false);
    const [pressing, setPressing] = useState(false);
    const [progress, setProgress] = useState(0);
    const animationRef = useRef(null);
    const startTimeRef = useRef(0);

    const startPress = useCallback(() => {
        if (disabled) return;
        isLongPressRef.current = false;
        setPressing(true);
        startTimeRef.current = Date.now();

        const animate = () => {
            const elapsed = Date.now() - startTimeRef.current;
            const prog = Math.min(100, (elapsed / LONG_PRESS_THRESHOLD) * 100);
            setProgress(prog);

            if (prog < 100) {
                animationRef.current = requestAnimationFrame(animate);
            } else {
                isLongPressRef.current = true;
                onLongPress?.();
                setPressing(false);
                setProgress(0);
            }
        };
        animationRef.current = requestAnimationFrame(animate);
    }, [disabled, onLongPress]);

    const endPress = useCallback(() => {
        if (animationRef.current) {
            cancelAnimationFrame(animationRef.current);
            animationRef.current = null;
        }

        if (pressing && !isLongPressRef.current && !disabled) {
            onClick?.();
        }

        setPressing(false);
        setProgress(0);
    }, [disabled, onClick, pressing]);

    const cancelPress = useCallback(() => {
        if (animationRef.current) {
            cancelAnimationFrame(animationRef.current);
            animationRef.current = null;
        }
        setPressing(false);
        setProgress(0);
    }, []);

    useEffect(() => {
        return () => {
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
            }
        };
    }, []);

    const progressColor = variant === 'upgrade' ? 'bg-white/30' : 'bg-white/30';

    return (
        <button
            onMouseDown={startPress}
            onMouseUp={endPress}
            onMouseLeave={cancelPress}
            onTouchStart={(e) => { e.preventDefault(); startPress(); }}
            onTouchEnd={(e) => { e.preventDefault(); endPress(); }}
            onTouchCancel={cancelPress}
            disabled={disabled}
            className={`relative overflow-hidden select-none transition-all duration-150 ${className} ${pressing ? 'scale-95 brightness-110' : ''
                }`}
            title={title}
        >
            {pressing && (
                <div
                    className={`absolute inset-0 ${progressColor}`}
                    style={{ width: `${progress}%` }}
                />
            )}
            <span className="relative z-10 flex items-center justify-center gap-1">
                {children}
            </span>
        </button>
    );
};

/**
 * 建筑升级面板组件 - 时代主题色版
 */
export const BuildingUpgradePanel = ({
    building,
    count,
    epoch = 0,
    upgradeLevels = {},
    resources,
    market = {},
    onUpgrade,
    onDowngrade,
    onBatchUpgrade,
    onBatchDowngrade,
}) => {
    const buildingId = building?.id;
    const maxLevel = getMaxUpgradeLevel(buildingId);

    if (!canBuildingUpgrade(buildingId) || count <= 0) {
        return null;
    }

    const distributionKey = JSON.stringify(upgradeLevels);
    const levelDistribution = useMemo(() => {
        return getBuildingLevelDistribution(buildingId, count, upgradeLevels);
    }, [buildingId, count, distributionKey]);

    const upgradeConfigs = BUILDING_UPGRADES[buildingId] || [];

    // 计算总产量、总投入、总岗位
    const totals = useMemo(() => {
        let totalInput = {};
        let totalOutput = {};
        let totalJobs = {};

        for (let i = 0; i < count; i++) {
            const level = upgradeLevels[i] || 0;
            const config = getBuildingEffectiveConfig(building, level);

            Object.entries(config.output || {}).forEach(([key, val]) => {
                totalOutput[key] = (totalOutput[key] || 0) + val;
            });
            Object.entries(config.input || {}).forEach(([key, val]) => {
                totalInput[key] = (totalInput[key] || 0) + val;
            });
            Object.entries(config.jobs || {}).forEach(([key, val]) => {
                totalJobs[key] = (totalJobs[key] || 0) + val;
            });
        }

        return { totalInput, totalOutput, totalJobs };
    }, [building, count, distributionKey]);

    // 检查是否可以升级（市场库存+银币都足够）
    const canAffordUpgrade = (fromLevel) => {
        const cost = getUpgradeCost(buildingId, fromLevel);
        if (!cost) return false;

        const hasMaterials = Object.entries(cost).every(([resource, amount]) => {
            if (resource === 'silver') return true;
            return (resources[resource] || 0) >= amount;
        });
        if (!hasMaterials) return false;

        let silverCost = 0;
        for (const [resource, amount] of Object.entries(cost)) {
            if (resource === 'silver') {
                silverCost += amount;
            } else {
                const marketPrice = market?.prices?.[resource] || 1;
                silverCost += amount * marketPrice;
            }
        }

        return (resources.silver || 0) >= silverCost;
    };

    const formatAmount = (value) => {
        if (value >= 1000) return (value / 1000).toFixed(1) + 'k';
        if (value >= 100) return Math.floor(value).toString();
        if (value >= 10) return value.toFixed(1);
        return value.toFixed(2);
    };

    // 渲染等级指示器（星星图标）
    const renderLevelIndicator = (level) => {
        return (
            <div className="flex items-center gap-0.5">
                {Array.from({ length: maxLevel + 1 }).map((_, i) => (
                    <Icon
                        key={i}
                        name={i <= level ? "Star" : "Star"}
                        size={12}
                        className={i <= level
                            ? 'text-amber-400 fill-amber-400'
                            : 'text-gray-600'
                        }
                    />
                ))}
            </div>
        );
    };

    // 渲染资源标签
    const ResourceTag = ({ icon, value, name, color = 'gray', size = 'sm' }) => {
        const sizeClass = size === 'sm' ? 'text-[10px] px-1.5 py-0.5' : 'text-xs px-2 py-1';
        const colorClasses = {
            green: 'bg-emerald-900/40 text-emerald-300 border-emerald-700/50',
            red: 'bg-rose-900/40 text-rose-300 border-rose-700/50',
            blue: 'bg-sky-900/40 text-sky-300 border-sky-700/50',
            yellow: 'bg-amber-900/40 text-amber-300 border-amber-700/50',
            gray: 'bg-gray-800/60 text-gray-300 border-gray-600/50',
        };

        return (
            <span className={`inline-flex items-center gap-1 rounded border ${colorClasses[color]} ${sizeClass}`}>
                <Icon name={icon} size={size === 'sm' ? 10 : 12} />
                {name && <span className="opacity-90">{name}</span>}
                <span className="font-mono ml-0.5">{value}</span>
            </span>
        );
    };

    // 渲染等级配置（升级后的效果）
    const renderLevelConfig = (levelNum) => {
        const config = getBuildingEffectiveConfig(building, levelNum);
        const hasOutput = Object.keys(config.output || {}).length > 0;
        const hasInput = Object.keys(config.input || {}).length > 0;
        const hasJobs = Object.keys(config.jobs || {}).length > 0;

        return (
            <div className="space-y-1">
                {/* 效果区域 */}
                <div className="text-[9px] text-gray-500 uppercase tracking-wider">效果</div>
                <div className="flex flex-wrap gap-1.5">
                    {Object.entries(config.output || {}).map(([key, val]) => (
                        <ResourceTag
                            key={`out-${key}`}
                            icon={RESOURCES[key]?.icon || 'Box'}
                            name={RESOURCES[key]?.name || key}
                            value={`+${val}`}
                            color="green"
                        />
                    ))}
                    {Object.entries(config.input || {}).map(([key, val]) => (
                        <ResourceTag
                            key={`in-${key}`}
                            icon={RESOURCES[key]?.icon || 'Box'}
                            name={RESOURCES[key]?.name || key}
                            value={`-${val}`}
                            color="red"
                        />
                    ))}
                    {Object.entries(config.jobs || {}).map(([key, val]) => (
                        <ResourceTag
                            key={`job-${key}`}
                            icon={STRATA[key]?.icon || 'User'}
                            name={STRATA[key]?.name || key}
                            value={val}
                            color="blue"
                        />
                    ))}
                    {!hasOutput && !hasInput && !hasJobs && (
                        <span className="text-[10px] text-gray-500">基础效果</span>
                    )}
                </div>
            </div>
        );
    };

    // 升级费用
    const renderUpgradeCost = (cost) => {
        if (!cost) return null;

        const hasMaterials = Object.entries(cost).every(([resource, amount]) => {
            if (resource === 'silver') return true;
            return (resources[resource] || 0) >= amount;
        });

        let silverCost = 0;
        const costBreakdown = [];
        for (const [resource, amount] of Object.entries(cost)) {
            if (resource === 'silver') {
                silverCost += amount;
            } else {
                const marketPrice = market?.prices?.[resource] || 1;
                const resAvailable = (resources[resource] || 0) >= amount;
                silverCost += amount * marketPrice;
                costBreakdown.push({
                    resource,
                    amount,
                    price: marketPrice,
                    available: resAvailable
                });
            }
        }

        const hasSilver = (resources.silver || 0) >= silverCost;
        const canAfford = hasMaterials && hasSilver;

        return (
            <div className="space-y-1">
                <div className="text-[9px] text-gray-500 uppercase tracking-wider">成本</div>
                <div className="flex flex-wrap items-center gap-1.5">
                    {costBreakdown.map(({ resource, amount, available }) => (
                        <span
                            key={resource}
                            className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] border ${available
                                ? 'bg-gray-800/60 text-gray-300 border-gray-600/50'
                                : 'bg-red-900/40 text-red-300 border-red-700/50'
                                }`}
                            title={available ? '库存充足' : '库存不足'}
                        >
                            <Icon name={RESOURCES[resource]?.icon || 'Box'} size={10} />
                            <span className="opacity-90">{RESOURCES[resource]?.name || resource}</span>
                            <span className="font-mono ml-0.5">{amount}</span>
                        </span>
                    ))}
                    <span className="text-gray-500 text-xs">→</span>
                    <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border ${canAfford
                            ? 'bg-amber-900/40 text-amber-300 border-amber-600/50'
                            : 'bg-red-900/40 text-red-300 border-red-700/50'
                            }`}
                        title={`总花费 ${formatAmount(silverCost)} 银币`}
                    >
                        <Icon name="Coins" size={10} />
                        <span className="font-mono">{formatAmount(silverCost)}</span>
                    </span>
                </div>
            </div>
        );
    };

    // 处理升级/降级
    const handleUpgradeOne = (levelNum) => {
        for (let i = 0; i < count; i++) {
            if ((upgradeLevels[i] || 0) === levelNum) {
                onUpgrade?.(i);
                break;
            }
        }
    };

    const handleDowngradeOne = (levelNum) => {
        for (let i = 0; i < count; i++) {
            if ((upgradeLevels[i] || 0) === levelNum) {
                onDowngrade?.(i);
                break;
            }
        }
    };

    const handleUpgradeAll = (levelNum, levelCount) => {
        onBatchUpgrade?.(levelNum, levelCount);
    };

    const handleDowngradeAll = (levelNum, levelCount) => {
        onBatchDowngrade?.(levelNum, levelCount);
    };

    return (
        <div className="bg-gray-900/50 p-3 rounded-lg border border-gray-700/80">
            {/* 标题栏 - 使用时代主题色 */}
            <h4 className="text-xs font-semibold text-gray-300 mb-3 flex items-center gap-1.5 font-decorative">
                <Icon name="ArrowUpCircle" size={16} />
                建筑升级
                <span className="ml-auto text-[10px] text-gray-500 font-normal">共 {count} 座 · 长按批量</span>
            </h4>

            {/* 总量统计 */}
            <div className="mb-3 p-2 bg-gray-800/40 rounded border border-gray-700/30">
                <div className="text-[10px] text-gray-500 mb-1.5">当前总效果</div>
                <div className="flex flex-wrap gap-1.5">
                    {Object.entries(totals.totalOutput).map(([key, val]) => (
                        <ResourceTag
                            key={`total-out-${key}`}
                            icon={RESOURCES[key]?.icon || 'Box'}
                            name={RESOURCES[key]?.name || key}
                            value={`+${formatAmount(val)}`}
                            color="green"
                        />
                    ))}
                    {Object.entries(totals.totalInput).map(([key, val]) => (
                        <ResourceTag
                            key={`total-in-${key}`}
                            icon={RESOURCES[key]?.icon || 'Box'}
                            name={RESOURCES[key]?.name || key}
                            value={`-${formatAmount(val)}`}
                            color="red"
                        />
                    ))}
                    {Object.entries(totals.totalJobs).map(([key, val]) => (
                        <ResourceTag
                            key={`total-job-${key}`}
                            icon={STRATA[key]?.icon || 'User'}
                            name={STRATA[key]?.name || key}
                            value={Math.ceil(val)}
                            color="blue"
                        />
                    ))}
                    {Object.keys(totals.totalOutput).length === 0 &&
                        Object.keys(totals.totalInput).length === 0 &&
                        Object.keys(totals.totalJobs).length === 0 && (
                            <span className="text-[10px] text-gray-500">暂无数据</span>
                        )}
                </div>
            </div>

            {/* 等级列表 */}
            <div className="space-y-2">
                {Array.from({ length: maxLevel + 1 }).map((_, levelNum) => {
                    const levelCount = levelDistribution[levelNum] || 0;
                    const levelName = levelNum === 0
                        ? '基础'
                        : upgradeConfigs[levelNum - 1]?.name || `等级 ${levelNum}`;

                    const canUpgradeThis = levelNum < maxLevel && canAffordUpgrade(levelNum) && levelCount > 0;
                    const canDowngradeThis = levelNum > 0 && levelCount > 0;
                    const upgradeCost = levelNum < maxLevel ? getUpgradeCost(buildingId, levelNum) : null;
                    const isActive = levelCount > 0;

                    return (
                        <div
                            key={levelNum}
                            className={`rounded-lg border transition-all ${isActive
                                ? 'bg-gray-800/50 border-gray-600/60'
                                : 'bg-gray-900/30 border-gray-800/40 opacity-40'
                                }`}
                        >
                            {/* 等级头部 */}
                            <div className="flex items-center justify-between p-2">
                                <div className="flex items-center gap-2">
                                    {renderLevelIndicator(levelNum)}
                                    <span className="text-xs font-medium text-gray-200">{levelName}</span>
                                    {levelCount > 0 && (
                                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold text-amber-400 bg-amber-900/40">
                                            ×{levelCount}
                                        </span>
                                    )}
                                </div>

                                {/* 操作按钮 */}
                                <div className="flex gap-1">
                                    {levelCount > 0 && levelNum < maxLevel && (
                                        <LongPressButton
                                            onClick={() => handleUpgradeOne(levelNum)}
                                            onLongPress={() => handleUpgradeAll(levelNum, levelCount)}
                                            disabled={!canUpgradeThis}
                                            variant="upgrade"
                                            className={`w-8 h-7 rounded text-sm font-bold ${canUpgradeThis
                                                ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                                                : 'bg-gray-700/50 text-gray-500 cursor-not-allowed'
                                                }`}
                                            title="单击+1 / 长按全部"
                                        >
                                            <Icon name="ChevronUp" size={14} />
                                        </LongPressButton>
                                    )}
                                    {canDowngradeThis && (
                                        <LongPressButton
                                            onClick={() => handleDowngradeOne(levelNum)}
                                            onLongPress={() => handleDowngradeAll(levelNum, levelCount)}
                                            disabled={false}
                                            variant="downgrade"
                                            className="w-8 h-7 rounded text-sm font-bold bg-rose-600 hover:bg-rose-500 text-white"
                                            title="单击-1 / 长按全部"
                                        >
                                            <Icon name="ChevronDown" size={14} />
                                        </LongPressButton>
                                    )}
                                </div>
                            </div>

                            {/* 等级详情 */}
                            {isActive && (
                                <div className="px-2 pb-2">
                                    <div className="pl-2 border-l-2 border-gray-700/50">
                                        {renderLevelConfig(levelNum)}

                                        {/* 升级费用 */}
                                        {levelNum < maxLevel && upgradeCost && (
                                            <div className="mt-2 pt-2 border-t border-gray-700/30">
                                                {renderUpgradeCost(upgradeCost)}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default BuildingUpgradePanel;
