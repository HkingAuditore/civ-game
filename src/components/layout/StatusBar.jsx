// 顶部状态栏组件 - 史诗风格重构
// 移动端优先设计，紧凑布局，突出历史感

import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '../common/UIComponents';
import { RollingNumber } from '../common/MotionComponents';
import { RESOURCES, EPOCHS } from '../../config';
import { getCalendarInfo } from '../../utils/calendar';

/**
 * 顶部状态栏组件 - 史诗风格
 * 紧凑设计，减少高度，优化信息密度
 */
export const StatusBar = ({
    gameState,
    taxes,
    netSilverPerDay,
    tradeStats = { tradeTax: 0 },
    armyFoodNeed,
    silverUpkeepPerDay = 0, // 新增：从 App.jsx 传入的实际军费
    officialSalaryPerDay = 0, // 新增：官员薪水
    playerInstallmentPayment = null,
    activeEventEffects = {},
    onResourceDetailClick,
    onPopulationDetailClick,
    onStrataClick,
    onMarketClick,
    onEmpireSceneClick,
    gameControls,
}) => {
    const TAX_POPOVER_Z_INDEX = 95;

    // Debug: Check activeEventEffects
    if (activeEventEffects?.forcedSubsidy?.length > 0) {
        console.log('[STATUS BAR] Forced subsidies:', activeEventEffects.forcedSubsidy);
    }
    const [showTaxDetail, setShowTaxDetail] = useState(false);
    const [isTaxDetailPinned, setIsTaxDetailPinned] = useState(false);
    const taxDetailButtonRef = useRef(null);
    const silverInfoRef = useRef(null);
    const taxHoverTimeoutRef = useRef(null);
    const taxPinStateRef = useRef(isTaxDetailPinned);
    const [taxPopoverPos, setTaxPopoverPos] = useState({ top: 0, left: 0, scale: 1, adjustedLeft: false });
    const computeTaxPopoverPos = () => {
        if (!taxDetailButtonRef.current) return null;
        const rect = taxDetailButtonRef.current.getBoundingClientRect();
        const popoverWidth = 288; // w-72 = 18rem = 288px
        const screenWidth = window.innerWidth;
        const padding = 8; // 边距

        // 计算弹窗居中位置
        let centerX = rect.left + rect.width / 2;
        let adjustedLeft = false;

        // 检查右边界：如果弹窗右边会超出屏幕，调整位置
        const rightEdge = centerX + popoverWidth / 2;
        if (rightEdge > screenWidth - padding) {
            centerX = screenWidth - padding - popoverWidth / 2;
            adjustedLeft = true;
        }

        // 检查左边界：如果弹窗左边会超出屏幕，调整位置
        const leftEdge = centerX - popoverWidth / 2;
        if (leftEdge < padding) {
            centerX = padding + popoverWidth / 2;
            adjustedLeft = true;
        }

        // 计算缩放比例：当屏幕宽度小于弹窗宽度+边距时进行缩放
        let scale = 1;
        const minWidth = popoverWidth + padding * 2;
        if (screenWidth < minWidth) {
            scale = (screenWidth - padding * 2) / popoverWidth;
            centerX = screenWidth / 2; // 缩放时居中
        }

        return {
            top: rect.bottom + 8,
            left: centerX,
            scale,
            adjustedLeft,
        };
    };

    const calendar = getCalendarInfo(gameState.daysElapsed || 0);
    // 军费支出从 App.jsx 传入，包含完整的资源成本、时代加成、规模惩罚
    // 这里只保留用于显示的 armyFoodNeed（传统食粮需求）
    const foodPrice = gameState.market?.prices?.food ?? (RESOURCES.food?.basePrice || 1);
    const wageRatio = gameState.militaryWageRatio || 1;
    // 实际军费由 App.jsx 计算，这里只用于向后兼容的显示

    // Tariff from taxBreakdown (merchant autonomous trade) + tradeStats (AI diplomatic trade)
    const tariffFromBreakdown = taxes.breakdown?.tariff || 0;
    const tariffFromTradeStats = tradeStats?.tradeTax || 0;
    const tradeTax = tariffFromBreakdown + tariffFromTradeStats;
    const policyIncome = taxes.breakdown?.policyIncome || 0;
    const policyExpense = taxes.breakdown?.policyExpense || 0;
    const netSilverClass = netSilverPerDay >= 0 ? 'text-green-300' : 'text-red-300';
    const tradeTaxClass = tradeTax >= 0 ? 'text-emerald-300' : 'text-red-300';

    // 获取当前时代信息
    const currentEpoch = EPOCHS[gameState.epoch] || EPOCHS[0];

    // 格式化大数字
    const formatNumber = (num) => {
        if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
        if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
        return Math.floor(num).toString();
    };

    // 获取季节图标
    const getSeasonIcon = (season) => {
        const seasonIcons = {
            '春': { icon: 'Leaf', color: 'text-green-400' },
            '夏': { icon: 'Sun', color: 'text-yellow-400' },
            '秋': { icon: 'Wind', color: 'text-orange-400' },
            '冬': { icon: 'Snowflake', color: 'text-blue-300' },
        };
        return seasonIcons[season] || { icon: 'Calendar', color: 'text-ancient-gold' };
    };

    const seasonInfo = getSeasonIcon(calendar.season);

    useLayoutEffect(() => {
        if (!showTaxDetail) return undefined;

        const updateTaxPopoverPos = () => {
            const pos = computeTaxPopoverPos();
            if (pos) setTaxPopoverPos(pos);
        };

        updateTaxPopoverPos();
        window.addEventListener('resize', updateTaxPopoverPos);
        window.addEventListener('scroll', updateTaxPopoverPos, true);

        return () => {
            window.removeEventListener('resize', updateTaxPopoverPos);
            window.removeEventListener('scroll', updateTaxPopoverPos, true);
        };
    }, [showTaxDetail]);

    useEffect(() => {
        taxPinStateRef.current = isTaxDetailPinned;
    }, [isTaxDetailPinned]);

    useEffect(() => () => {
        if (taxHoverTimeoutRef.current) {
            clearTimeout(taxHoverTimeoutRef.current);
        }
    }, []);

    const showTaxPopover = () => {
        const pos = computeTaxPopoverPos();
        if (pos) setTaxPopoverPos(pos);
        setShowTaxDetail(true);
    };

    const hideTaxPopover = () => {
        setShowTaxDetail(false);
    };

    const handleTaxButtonClick = () => {
        setIsTaxDetailPinned((prev) => {
            const next = !prev;
            if (next) {
                showTaxPopover();
            } else {
                hideTaxPopover();
            }
            return next;
        });
    };

    const handleTaxHoverChange = (isHovering) => {
        if (taxHoverTimeoutRef.current) {
            clearTimeout(taxHoverTimeoutRef.current);
            taxHoverTimeoutRef.current = null;
        }
        if (isHovering) {
            showTaxPopover();
            return;
        }
        if (!taxPinStateRef.current) {
            taxHoverTimeoutRef.current = window.setTimeout(() => {
                if (!taxPinStateRef.current) {
                    hideTaxPopover();
                }
            }, 150);
        }
    };

    const handleSilverButtonClick = (event) => {
        if (silverInfoRef.current) {
            const silverBounds = silverInfoRef.current.getBoundingClientRect();
            const clickX = event.clientX;
            if (clickX >= silverBounds.left && clickX <= silverBounds.right) {
                if (taxHoverTimeoutRef.current) {
                    clearTimeout(taxHoverTimeoutRef.current);
                    taxHoverTimeoutRef.current = null;
                }
                if (showTaxDetail) hideTaxPopover();
                if (isTaxDetailPinned) setIsTaxDetailPinned(false);
                if (onResourceDetailClick) onResourceDetailClick('silver');
                return;
            }
        }
        handleTaxButtonClick();
    };

    return (
        <header
            className="relative overflow-visible status-bar-safe-area"
        >
            {/* 主背景 - 史诗质感 + 毛玻璃效果 */}
            <div
                className="absolute inset-0 bg-gradient-to-r from-ancient-ink/95 via-ancient-stone/40 to-ancient-ink/95 backdrop-blur-md"
            />
            <div
                className="absolute inset-0 animate-shimmer opacity-20"
                style={{
                    backgroundImage: 'linear-gradient(90deg, transparent 0%, rgba(212, 175, 55, 0.15) 50%, transparent 100%)',
                    backgroundSize: '200% 100%',
                }}
            />

            {/* 底部装饰线 */}
            <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-ancient-gold/50 to-transparent" />

            <div
                className="status-bar-scroll max-w-[1920px] mx-auto px-2 sm:px-4 py-1.5 sm:py-2 relative z-10 overflow-x-auto overflow-y-visible cursor-grab active:cursor-grabbing select-none"
                style={{
                    WebkitOverflowScrolling: 'touch',
                }}
                onMouseDown={(e) => {
                    const container = e.currentTarget;
                    container.dataset.isDragging = 'true';
                    container.dataset.startX = e.pageX - container.offsetLeft;
                    container.dataset.scrollLeft = container.scrollLeft;
                }}
                onMouseUp={(e) => {
                    e.currentTarget.dataset.isDragging = 'false';
                }}
                onMouseLeave={(e) => {
                    e.currentTarget.dataset.isDragging = 'false';
                }}
                onMouseMove={(e) => {
                    const container = e.currentTarget;
                    if (container.dataset.isDragging !== 'true') return;
                    e.preventDefault();
                    const x = e.pageX - container.offsetLeft;
                    const walk = (x - parseFloat(container.dataset.startX)) * 1.5;
                    container.scrollLeft = parseFloat(container.dataset.scrollLeft) - walk;
                }}
            >
                {/* 单行紧凑布局 */}
                <div className="flex items-center justify-between gap-2 min-w-max">

                    {/* 左侧：Logo + 时代 + 日期 */}
                    <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
                        {/* Logo */}
                        <div className="relative group">
                            <div className="absolute inset-0 bg-gradient-to-br from-ancient-gold to-ancient-bronze rounded-lg blur-md opacity-40 group-hover:opacity-60 transition-opacity" />
                            <div className="relative bg-gradient-to-br from-ancient-gold/20 to-ancient-bronze/20 p-1 rounded-lg border border-ancient-gold/30 shadow-glow-gold">
                                <img
                                    src={`${import.meta.env.BASE_URL}logo.png`}
                                    alt="Logo"
                                    className="w-5 h-5 object-contain filter drop-shadow-sm"
                                />
                            </div>
                        </div>

                        {/* 时代标识 */}
                        <div className="hidden sm:flex flex-col">
                            <span className="text-[11px] font-bold text-ancient-stone uppercase tracking-wider font-decorative">哈耶克的文明</span>
                            <span className="text-[10px] font-bold text-ancient flex items-center gap-1 font-decorative">
                                <span>{currentEpoch.icon || '🏛️'}</span>
                                {currentEpoch.name}
                            </span>
                        </div>

                        {/* 移动端时代简化显示 */}
                        <div className="sm:hidden flex items-center gap-1">
                            <span className="text-sm">{currentEpoch.icon || '🏛️'}</span>
                            <span className="text-[10px] font-bold text-ancient-gold">{currentEpoch.name}</span>
                        </div>

                        {/* 日期按钮 - 可点击展开帝国场景 */}
                        <button
                            onClick={() => {
                                if (onEmpireSceneClick) {
                                    onEmpireSceneClick();
                                }
                            }}
                            className="relative group flex items-center gap-1.5 glass-ancient px-2 py-1 rounded-lg border border-ancient-gold/20 hover:border-ancient-gold/40 hover:shadow-glow-gold transition-all touch-feedback"
                        >
                            <Icon name={seasonInfo.icon} size={12} className={seasonInfo.color} />
                            <div className="text-[9px] sm:text-[10px] leading-tight">
                                <span className="font-bold text-ancient-parchment font-decorative">
                                    {calendar.year}年 · {calendar.season}
                                </span>
                            </div>
                        </button>
                    </div>

                    {/* 中间：核心数据胶囊 */}
                    <div className="flex items-center gap-1.5 sm:gap-2 justify-start sm:justify-center flex-shrink-0">
                        <div className="relative flex items-center gap-0.5">
                            {/* 银币胶囊 */}
                            <button
                                ref={taxDetailButtonRef}
                                onClick={handleSilverButtonClick}
                                onMouseEnter={() => handleTaxHoverChange(true)}
                                onMouseLeave={() => handleTaxHoverChange(false)}
                                className="relative group flex items-center gap-1 sm:gap-1.5 glass-ancient px-2 sm:px-2.5 py-1 rounded-lg border border-ancient-gold/30 hover:border-ancient-gold/60 hover:shadow-glow-gold transition-all flex-shrink-0 overflow-hidden touch-feedback"
                            >
                                <div className="absolute inset-0 bg-gradient-to-r from-ancient-gold/10 via-ancient-gold/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                <div ref={silverInfoRef} className="flex items-center gap-1 sm:gap-1.5 relative z-10">
                                    <div className="icon-epic-frame icon-frame-xs resource-icon-gold">
                                        <Icon name="Coins" size={10} className="text-ancient-gold" />
                                    </div>
                                    <span className="font-mono text-[11px] sm:text-xs font-bold text-ancient">
                                        <RollingNumber value={gameState.resources.silver || 0} format={formatNumber} />
                                    </span>
                                </div>
                                {/* 净收入指示 */}
                                <div className={`flex items-center gap-0.5 text-[9px] px-1 py-0.5 rounded ${netSilverPerDay >= 0 ? 'bg-green-900/30' : 'bg-red-900/30'}`}>
                                    <Icon name={netSilverPerDay >= 0 ? 'TrendingUp' : 'TrendingDown'} size={9} className={netSilverClass} />
                                    <span className={`font-mono ${netSilverClass}`}>
                                        {netSilverPerDay >= 0 ? '+' : ''}{netSilverPerDay.toFixed(0)}
                                    </span>
                                </div>
                            </button>

                            {/* 税收详情弹窗 */}
                            {showTaxDetail &&
                                createPortal(
                                    <div
                                        className="pointer-events-none fixed inset-0"
                                        style={{ zIndex: TAX_POPOVER_Z_INDEX }}
                                        aria-live="polite"
                                    >
                                        <div
                                            className="absolute pointer-events-none"
                                            style={{
                                                top: `${taxPopoverPos.top}px`,
                                                left: `${taxPopoverPos.left}px`,
                                                transform: `translateX(-50%) scale(${taxPopoverPos.scale || 1})`,
                                                transformOrigin: 'top center',
                                            }}
                                        >
                                            <div
                                                className="pointer-events-auto w-72 glass-epic border border-ancient-gold/40 rounded-xl p-3 shadow-monument animate-slide-up"
                                                onMouseEnter={() => handleTaxHoverChange(true)}
                                                onMouseLeave={() => handleTaxHoverChange(false)}
                                            >
                                                <div className="flex items-center justify-between text-[11px] text-ancient-parchment mb-2">
                                                    <span className="font-bold flex items-center gap-1.5">
                                                        <Icon name="BarChart" size={12} className="text-ancient-gold" />
                                                        财政收支 (每日)
                                                    </span>
                                                    <button onClick={() => setShowTaxDetail(false)}>
                                                        <Icon name="X" size={14} className="text-ancient-stone hover:text-white" />
                                                    </button>
                                                </div>
                                                <div className="text-[10px] space-y-1.5">
                                                    {/* 收入项 */}
                                                    <div className="stat-item-compact">
                                                        <span className="text-ancient-stone">人头税</span>
                                                        <span className="text-green-300 font-mono">+{taxes.breakdown?.headTax?.toFixed(1) || '0'}</span>
                                                    </div>
                                                    <div className="stat-item-compact">
                                                        <span className="text-ancient-stone">交易税</span>
                                                        <span className="text-green-300 font-mono">+{taxes.breakdown?.industryTax?.toFixed(1) || '0'}</span>
                                                    </div>
                                                    <div className="stat-item-compact">
                                                        <span className="text-ancient-stone">营业税</span>
                                                        <span className="text-green-300 font-mono">+{taxes.breakdown?.businessTax?.toFixed(1) || '0'}</span>
                                                    </div>
                                                    <div className="stat-item-compact">
                                                        <span className="text-ancient-stone">关税</span>
                                                        <span className={`${tradeTaxClass} font-mono`}>{tradeTax >= 0 ? '+' : ''}{tradeTax.toFixed(1)}</span>
                                                    </div>
                                                    {policyIncome > 0 && (
                                                        <div className="stat-item-compact">
                                                            <span className="text-ancient-stone">政令收益</span>
                                                            <span className="text-green-300 font-mono">+{policyIncome.toFixed(1)}</span>
                                                        </div>
                                                    )}
                                                    {(taxes.breakdown?.warIndemnity || 0) > 0 && (
                                                        <div className="stat-item-compact">
                                                            <span className="text-ancient-stone">战争赔款收入</span>
                                                            <span className="text-green-300 font-mono">+{taxes.breakdown.warIndemnity.toFixed(1)}</span>
                                                        </div>
                                                    )}

                                                    <div className="epic-divider" />

                                                    {/* 支出项 */}
                                                    <div className="stat-item-compact">
                                                        <span className="text-ancient-stone">军饷维护</span>
                                                        <span className="text-red-300 font-mono">-{silverUpkeepPerDay.toFixed(1)}</span>
                                                    </div>
                                                    {officialSalaryPerDay > 0 && (
                                                        <div className="stat-item-compact">
                                                            <span className="text-ancient-stone">官员薪俸</span>
                                                            <span className="text-red-300 font-mono">-{officialSalaryPerDay.toFixed(1)}</span>
                                                        </div>
                                                    )}
                                                    {taxes.breakdown?.subsidy > 0 && (
                                                        <div className="stat-item-compact">
                                                            <span className="text-ancient-stone">补助支出</span>
                                                            <span className="text-red-300 font-mono">-{taxes.breakdown.subsidy.toFixed(1)}</span>
                                                        </div>
                                                    )}
                                                    {(taxes.breakdown?.tariffSubsidy || 0) > 0 && (
                                                        <div className="stat-item-compact">
                                                            <span className="text-ancient-stone">关税补贴</span>
                                                            <span className="text-red-300 font-mono">-{taxes.breakdown.tariffSubsidy.toFixed(1)}</span>
                                                        </div>
                                                    )}
                                                    {policyExpense > 0 && (
                                                        <div className="stat-item-compact">
                                                            <span className="text-ancient-stone">政令支出</span>
                                                            <span className="text-red-300 font-mono">-{policyExpense.toFixed(1)}</span>
                                                        </div>
                                                    )}
                                                    {playerInstallmentPayment && playerInstallmentPayment.remainingDays > 0 && (
                                                        <div className="stat-item-compact">
                                                            <span className="text-ancient-stone">战争赔款支出</span>
                                                            <span className="text-red-300 font-mono">-{playerInstallmentPayment.amount.toFixed(1)}</span>
                                                        </div>
                                                    )}
                                                    {/* 强制补贴支出 - DEBUG */}
                                                    {/* <div className="stat-item-compact bg-purple-900/30">
                                                        <span className="text-purple-300">调试:补贴数</span>
                                                        <span className="text-purple-300 font-mono">{activeEventEffects?.forcedSubsidy?.length || 0}</span>
                                                    </div> */}
                                                    {activeEventEffects?.forcedSubsidy?.length > 0 && (
                                                        <div className="text-xs text-amber-400 mb-1">
                                                            强制补贴 ({activeEventEffects.forcedSubsidy.length}项):
                                                        </div>
                                                    )}
                                                    {Array.isArray(activeEventEffects?.forcedSubsidy) && activeEventEffects.forcedSubsidy.map((subsidy, index) => (
                                                        <div key={subsidy.id || index} className="stat-item-compact">
                                                            <span className="text-ancient-stone flex items-center gap-1">
                                                                <span>{subsidy.name || '强制补贴'}</span>
                                                                <span className="text-[8px] text-amber-400">({subsidy.remainingDays}天)</span>
                                                            </span>
                                                            <span className="text-red-300 font-mono">-{(subsidy.dailyAmount || 0).toFixed(1)}</span>
                                                        </div>
                                                    ))}

                                                    <div className="epic-divider" />

                                                    {/* 净收益 */}
                                                    <div className="stat-item-compact bg-ancient-gold/10">
                                                        <span className="font-bold text-ancient-parchment">净收益</span>
                                                        <span className={`font-bold font-mono ${netSilverClass}`}>
                                                            {netSilverPerDay >= 0 ? '+' : ''}{netSilverPerDay.toFixed(1)}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>,
                                    document.body
                                )}
                        </div>

                        {/* 人口胶囊 */}
                        <button
                            onClick={onPopulationDetailClick}
                            className="relative group flex items-center gap-1 glass-ancient px-2 py-1 rounded-lg border border-blue-400/30 hover:border-blue-400/60 hover:shadow-glow transition-all flex-shrink-0 overflow-hidden touch-feedback"
                        >
                            <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 via-blue-400/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                            <div className="icon-epic-frame icon-frame-xs" style={{ borderColor: 'rgba(96, 165, 250, 0.4)', background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1), rgba(37, 99, 235, 0.08))' }}>
                                <Icon name="Users" size={10} className="text-blue-300" />
                            </div>
                            <div className="flex items-baseline gap-0.5 relative z-10">
                                <span className="font-mono text-[13px] font-bold text-blue-200">
                                    <RollingNumber value={gameState.population} format={formatNumber} />
                                </span>
                                <span className="text-[11px] font-bold text-ancient-gold">
                                    /{formatNumber(gameState.maxPop)}
                                </span>
                            </div>
                        </button>

                        {/* 移动端快捷按钮 */}
                        <div className="lg:hidden flex items-center gap-1">
                            {/* 社会阶层按钮 */}
                            <button
                                onClick={onStrataClick}
                                className="relative group flex items-center gap-1 glass-ancient px-2 py-1 rounded-lg border border-purple-400/40 hover:border-purple-300/60 transition-all flex-shrink-0 overflow-hidden touch-feedback"
                                title="社会阶层"
                            >
                                <div className="absolute inset-0 bg-gradient-to-r from-purple-500/20 via-purple-400/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                <Icon name="Crown" size={12} className="text-purple-300 relative z-10" />
                                <span className="text-[9px] text-purple-200 font-semibold relative z-10">阶层</span>
                            </button>

                            {/* 国内市场按钮 */}
                            <button
                                onClick={onMarketClick}
                                className="relative group flex items-center gap-1 glass-ancient px-2 py-1 rounded-lg border border-amber-400/40 hover:border-amber-300/60 transition-all flex-shrink-0 overflow-hidden touch-feedback"
                                title="国内市场"
                            >
                                <div className="absolute inset-0 bg-gradient-to-r from-amber-500/20 via-amber-400/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                <Icon name="Package" size={12} className="text-amber-300 relative z-10" />
                                <span className="text-[9px] text-amber-200 font-semibold relative z-10">市场</span>
                            </button>
                        </div>
                    </div>

                    {/* 右侧：游戏控制（桌面端） */}
                    {gameControls && (
                        <div className="hidden lg:flex items-center flex-shrink-0">
                            {gameControls}
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
};
