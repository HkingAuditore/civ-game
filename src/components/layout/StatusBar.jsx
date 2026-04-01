// 顶部状态栏组件 - 史诗风格重构
// 移动端优先设计，紧凑布局，突出历史感

import React, { useState, useEffect, useRef, useLayoutEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '../common/UIComponents';
import { RollingNumber } from '../common/MotionComponents';
import { RESOURCES, EPOCHS } from '../../config';
import { getCalendarInfo } from '../../utils/calendar';
import { formatNumberShortCN } from '../../utils/numberFormat';

/**
 * 顶部状态栏组件 - 史诗风格
 * 紧凑设计，减少高度，优化信息密度
 */
export const StatusBar = React.memo(({
    gameState,
    taxes,
    netSilverPerDay,
    tradeStats = { tradeTax: 0, tradeRouteTax: 0 },
    armyFoodNeed,
    silverUpkeepPerDay = 0, // 新增：从 App.jsx 传入的实际军费
    officialSalaryPerDay = 0, // 新增：官员薪水（planned/nominal)
    playerInstallmentPayment = null,
    activeEventEffects = {},
    onResourceDetailClick,
    onPopulationDetailClick,
    onStrataClick,
    onMarketClick,
    onEmpireSceneClick,
    onReportHistoryClick,
    gameControls,
}) => {
    const TAX_POPOVER_Z_INDEX = 95;
    const MAX_FISCAL_ITEMS = 10;
    const REASON_LABELS = {
        '税收收入（含战争赔款）': '税收收入',
        tax_head: '人头税',
        tax_industry: '交易税',
        tax_business: '营业税',
        tax_tariff: '关税',
        income_war_indemnity: '战争赔款收入', // legacy - should not appear after fix
        income_war_indemnity_bonus: '战争赔款加成',
        income_policy: '政令收入',
        expense_policy: '政令支出',
        '价格管制收入': '价格管制收入',
        income_price_control: '价格管制收入',
        '贸易路线税收': '贸易路线税收',
        income_trade_route: '关税',
        income_ideology_virtual_tax: '理念税收加成',
        '军队维护支出': '军饷维护',
        '军队维护支出（部分支付）': '军饷维护',
        expense_army_maintenance: '军饷维护',
        expense_army_maintenance_partial: '军饷维护',
        official_salary: '官员薪俸',
        forced_subsidy: '强制补贴',
        treaty_maintenance: '条约维护费',
        organization_membership_fee: '组织会费',
        price_control_buy: '价格管制支出',
        price_control_sell: '价格管制支出',
        consumption_subsidy: '消费补贴',
        head_tax_subsidy: '人头税补贴',
        ai_trade_tariff: '关税',
        installment_payment_income: '战争赔款收入',
        vassal_tribute_income: '附庸朝贡',
        vassal_tribute_cash: '附庸朝贡',
        vassal_control_cost: '藩属控制',
        war_reparation_receive: '战争赔款收入',
        war_reparation_payment: '战争赔款支出',
        war_reparation_pay: '战争赔款支出',
        diplomatic_trade_export: '外交贸易收入',
        diplomatic_trade_import: '外交贸易支出',
        diplomatic_gift: '外交送礼',
        ai_request_payment: '外交索要',
        ally_gift: '盟友送礼',
        politics_spend_silver: '政治支出',
        decree_enact_cost: '政令支出',
        strategic_action_cost: '策略行动支出',
        foreign_investment_tax: '外资税收',
        treaty_signing_cost: '条约签约费',
        treaty_negotiate_signing_cost: '条约签约费',
        treaty_negotiate_signing_gift: '条约赠礼',
        treaty_negotiate_demand_silver: '条约索赔收入',
        border_incident_compensation: '外交赔偿',
        rebel_reform_payment: '叛军妥协支出',
        auto_replenish_cost: '自动补兵支出',
        headTax: '人头税',
        transactionTax: '交易税',
        businessTax: '营业税',
        tariffs: '关税',
        subsidy: '税收补贴',
        tariff_subsidy: '关税补贴',
        tradeRouteTax: '贸易路线税收',
        foreignInvestmentTax: '外资税收',
        headtax: '人头税',
        transactiontax: '交易税',
        businesstax: '营业税',
        tariff: '关税',
        tariffsubsidy: '关税补贴',
        traderoutetax: '贸易路线税收',
        foreigninvestmenttax: '外资税收',
        salary: '官员薪俸',
        NEGATIVE_SALARY: '议罪银',
        militaryPay: '军饷维护',
        maintenance: '维护费',
        untracked_delta: '对账差额',
        // 新增日志映射
        building_production_direct: '建筑直接产出',
        passive_gain: '被动收益',
        passive_cost: '被动支出',
        passive_pop_gain: '人口红利',
        passive_pop_cost: '人口维护',
        passive_percent_gain: '被动加成收益',
        passive_percent_cost: '被动加成支出',
        passive_percent_base_gain: '被动基础收益',
        event_effects_resource_percent: '事件资源加成',
        event_effects_stratum_percent: '事件阶层需求',
        event_effects_building_production: '事件建筑产出',
        trade_import_gain: '贸易进口收入',
        trade_export_deduction: '贸易出口成本',
        autonomous_investment_return: '投资回报',
        trade_route_transaction: '贸易结算',
        overseas_investment_return: '海外投资收益',
        state_enterprise_profit: '国有企业利润',
        tax_efficiency_loss: '战争税收损失',
        build_purchase: '购买建筑',
        corruption: '腐败',
    };

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

    // [DEBUG] 从window对象读取simulation返回的军费数据
    const simulationMilitaryExpense = window.__GAME_MILITARY_EXPENSE__;
    // console.log('[StatusBar] 军费数据检查:', {
    //     'simulation数据': simulationMilitaryExpense?.dailyExpense,
    //     'silverUpkeepPerDay': silverUpkeepPerDay,
    //     '最终使用值': simulationMilitaryExpense?.dailyExpense || silverUpkeepPerDay || 0
    // });

    // 军费支出从 App.jsx 传入，包含完整的资源成本、时代加成、规模惩罚
    // 这里只保留用于显示的 armyFoodNeed（传统食粮需求）
    const foodPrice = gameState.market?.prices?.food ?? (RESOURCES.food?.basePrice || 1);
    const wageRatio = gameState.militaryWageRatio || 1;
    // 实际军费由 App.jsx 计算，这里只用于向后兼容的显示

    const tariffFromBreakdown = taxes.breakdown?.tariff || 0;
    const tradeRouteTax = taxes.breakdown?.tradeRouteTax ?? tradeStats?.tradeRouteTax ?? 0;
    const tariffFromTradeStats = tradeStats?.tradeTax || 0;
    // [FIX] taxes.breakdown already contains values multiplied by incomePercentMultiplier in simulation.js
    // So we should NOT multiply again here to avoid double multiplication
    const adjustedHeadTax = taxes.breakdown?.headTax || 0;
    const adjustedIndustryTax = taxes.breakdown?.industryTax || 0;
    const adjustedBusinessTax = taxes.breakdown?.businessTax || 0;
    const adjustedTariff = tariffFromBreakdown;
    const adjustedWarIndemnity = taxes.breakdown?.warIndemnity || 0;
    const tradeTax = adjustedTariff + tradeRouteTax + tariffFromTradeStats;
    const policyIncome = taxes.breakdown?.policyIncome || 0;
    const policyExpense = taxes.breakdown?.policyExpense || 0;

    const currentDay = gameState.daysElapsed || 0;
    const treasuryEntries = Array.isArray(gameState?.treasuryChangeLog) ? gameState.treasuryChangeLog : [];
    const fiscalDay = useMemo(() => {
        if (!treasuryEntries.length) return null;
        const tickDays = new Set();
        treasuryEntries.forEach((entry) => {
            if (!Number.isFinite(entry?.day)) return;
            const source = entry?.meta?.source;
            if (source && source !== 'action') {
                tickDays.add(entry.day);
            }
            if (!source && entry?.reason === 'tick_update') {
                tickDays.add(entry.day);
            }
        });
        if (tickDays.has(currentDay)) return currentDay;
        if (tickDays.has(currentDay - 1)) return currentDay - 1;
        return null;
    }, [treasuryEntries, currentDay]);
    const fiscalTreasuryEntries = useMemo(
        () => (fiscalDay === null ? [] : treasuryEntries.filter(entry => entry?.day === fiscalDay)),
        [treasuryEntries, fiscalDay]
    );
    const actualFiscalEntries = useMemo(
        () => fiscalTreasuryEntries.filter(entry => entry?.meta?.source !== 'action'),
        [fiscalTreasuryEntries]
    );
    const actualFiscalSummary = useMemo(() => {
        const totals = new Map();
        let net = 0;
        actualFiscalEntries.forEach(entry => {
            const amount = Number(entry?.amount || 0);
            if (!Number.isFinite(amount) || Math.abs(amount) < 0.01) return;
            const rawReason = typeof entry?.reason === 'string' ? entry.reason.trim() : entry?.reason;
            const lowerReason = typeof rawReason === 'string' ? rawReason.toLowerCase() : rawReason;
            const label = REASON_LABELS[rawReason] || REASON_LABELS[lowerReason] || rawReason || '未知';
            totals.set(label, (totals.get(label) || 0) + amount);
            net += amount;
        });
        const buildItems = (isIncome) => {
            const items = Array.from(totals.entries())
                .filter(([, amount]) => (isIncome ? amount > 0 : amount < 0))
                .map(([label, amount]) => ({ label, amount }))
                .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
            if (items.length <= MAX_FISCAL_ITEMS) return items;
            const kept = items.slice(0, MAX_FISCAL_ITEMS - 1);
            const restSum = items.slice(MAX_FISCAL_ITEMS - 1)
                .reduce((sum, item) => sum + item.amount, 0);
            kept.push({ label: isIncome ? '其他收入' : '其他支出', amount: restSum });
            return kept;
        };
        return {
            net,
            incomeItems: buildItems(true),
            expenseItems: buildItems(false),
        };
    }, [actualFiscalEntries]);
    const hasActualFiscal = actualFiscalEntries.length > 0;
    const isCurrentDayFiscal = fiscalDay === currentDay;
    const fiscalTitle = hasActualFiscal
        ? `财政收支 (${isCurrentDayFiscal ? '本日·实际' : '上日·实际'})`
        : '财政收支 (本日·估算)';
    // Net silver shown in the status bar should match the fiscal breakdown the player sees.
    const displayNetSilver = Number(hasActualFiscal ? actualFiscalSummary.net : (netSilverPerDay ?? 0));

    // Keep realized values for showing actual payouts (they are useful when treasury is insufficient).
    const actualOfficialSalaryPaid = Number(gameState?.fiscalActual?.officialSalaryPaid ?? officialSalaryPerDay ?? 0);
    const actualForcedSubsidyPaid = Number(gameState?.fiscalActual?.forcedSubsidyPaid ?? 0);
    const actualForcedSubsidyUnpaid = Number(gameState?.fiscalActual?.forcedSubsidyUnpaid ?? 0);

    const netSilverClass = displayNetSilver >= 0 ? 'text-green-300' : 'text-red-300';
    const tradeTaxClass = tradeTax >= 0 ? 'text-emerald-300' : 'text-red-300';

    // 获取当前时代信息
    const currentEpoch = EPOCHS[gameState.epoch] || EPOCHS[0];

    // 格式化大数字
    const formatNumber = (num) => {
        return formatNumberShortCN(num, { decimals: 1 });
    };

    // Status bar treasury/silver should use fixed decimals to avoid text length changes (flicker)
    const formatSilverStable = (num) => {
        const n = Number(num) || 0;
        const abs = Math.abs(n);
        if (abs < 1000) return n.toFixed(0);
        return formatNumberShortCN(n, { decimals: 1 });
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
                            <span className="text-xs font-bold text-ancient-stone uppercase tracking-wider font-decorative">哈耶克的文明</span>
                            <span className="text-xs font-bold text-ancient flex items-center gap-1 font-decorative">
                                <span>{currentEpoch.icon || '🏛️'}</span>
                                {currentEpoch.name}
                            </span>
                        </div>

                        {/* 移动端时代简化显示 */}
                        <div className="sm:hidden flex items-center gap-1">
                            <span className="text-sm">{currentEpoch.icon || '🏛️'}</span>
                            <span className="text-xs font-bold text-ancient-gold">{currentEpoch.name}</span>
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
                            <div className="text-xs sm:text-xs leading-tight">
                                <span className="font-bold text-ancient-parchment font-decorative">
                                    {calendar.year}年 · {calendar.season}
                                </span>
                            </div>
                        </button>

                        {/* 历年报告按钮 */}
                        <button
                            onClick={() => {
                                if (onReportHistoryClick) {
                                    onReportHistoryClick();
                                }
                            }}
                            className="relative group flex items-center glass-ancient px-1.5 py-1 rounded-lg border border-ancient-gold/15 hover:border-ancient-gold/40 hover:shadow-glow-gold transition-all touch-feedback"
                            title="历年政府工作报告"
                        >
                            <Icon name="ScrollText" size={13} className="text-ancient-gold/70 group-hover:text-ancient-gold transition-colors" />
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
                                    <span className="font-mono text-xs sm:text-xs font-bold text-ancient">
                                        <RollingNumber value={gameState.resources.silver || 0} format={formatSilverStable} fixedWidth />
                                    </span>
                                </div>
                                {/* 净收入指示 */}
                                <div className={`flex items-center gap-0.5 text-xs px-1 py-0.5 rounded ${displayNetSilver >= 0 ? 'bg-green-900/30' : 'bg-red-900/30'}`}>
                                    <Icon name={displayNetSilver >= 0 ? 'TrendingUp' : 'TrendingDown'} size={9} className={netSilverClass} />
                                    <span className={`font-mono ${netSilverClass}`}>
                                        {displayNetSilver >= 0 ? '+' : '-'}{formatNumberShortCN(Math.abs(displayNetSilver || 0), { decimals: 1 })}
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
                                                <div className="flex items-center justify-between text-xs text-ancient-parchment mb-2">
                                                    <span className="font-bold flex items-center gap-1.5">
                                                        <Icon name="BarChart" size={12} className="text-ancient-gold" />
                                                        {fiscalTitle}
                                                    </span>
                                                    <button onClick={() => setShowTaxDetail(false)}>
                                                        <Icon name="X" size={14} className="text-ancient-stone hover:text-white" />
                                                    </button>
                                                </div>
                                                <div className="text-xs space-y-1.5">
                                                    {hasActualFiscal ? (
                                                        <>
                                                            {actualFiscalSummary.incomeItems.map((item) => (
                                                                <div className="stat-item-compact" key={`income-${item.label}`}>
                                                                    <span className="text-ancient-stone">{item.label}</span>
                                                                    <span className="text-green-300 font-mono">
                                                                        +{formatNumberShortCN(Math.abs(item.amount), { decimals: 1 })}
                                                                    </span>
                                                                </div>
                                                            ))}
                                                            {actualFiscalSummary.incomeItems.length === 0 && (
                                                                <div className="stat-item-compact">
                                                                    <span className="text-ancient-stone">暂无收入</span>
                                                                    <span className="text-ancient-stone">+0</span>
                                                                </div>
                                                            )}

                                                            <div className="epic-divider" />

                                                            {actualFiscalSummary.expenseItems.map((item) => (
                                                                <div className="stat-item-compact" key={`expense-${item.label}`}>
                                                                    <span className="text-ancient-stone">{item.label}</span>
                                                                    <span className="text-red-300 font-mono">
                                                                        -{formatNumberShortCN(Math.abs(item.amount), { decimals: 1 })}
                                                                    </span>
                                                                </div>
                                                            ))}
                                                            {actualFiscalSummary.expenseItems.length === 0 && (
                                                                <div className="stat-item-compact">
                                                                    <span className="text-ancient-stone">暂无支出</span>
                                                                    <span className="text-ancient-stone">-0</span>
                                                                </div>
                                                            )}
                                                        </>
                                                    ) : (
                                                        <>
                                                            {/* 收入项 */}
                                                            <div className="stat-item-compact">
                                                                <span className="text-ancient-stone">人头税</span>
                                                                <span className="text-green-300 font-mono">+{formatNumberShortCN(Math.abs(adjustedHeadTax), { decimals: 1 })}</span>
                                                            </div>
                                                            <div className="stat-item-compact">
                                                                <span className="text-ancient-stone">交易税</span>
                                                                <span className="text-green-300 font-mono">+{formatNumberShortCN(Math.abs(adjustedIndustryTax), { decimals: 1 })}</span>
                                                            </div>
                                                            <div className="stat-item-compact">
                                                                <span className="text-ancient-stone">营业税</span>
                                                                <span className="text-green-300 font-mono">+{formatNumberShortCN(Math.abs(adjustedBusinessTax), { decimals: 1 })}</span>
                                                            </div>
                                                            <div className="stat-item-compact">
                                                                <span className="text-ancient-stone">关税</span>
                                                                <span className={`${tradeTaxClass} font-mono`}>{tradeTax >= 0 ? '+' : ''}{formatNumberShortCN(Math.abs(tradeTax || 0), { decimals: 1 })}</span>
                                                            </div>
                                                            {policyIncome > 0 && (
                                                                <div className="stat-item-compact">
                                                                    <span className="text-ancient-stone">政令收益</span>
                                                                    <span className="text-green-300 font-mono">+{formatNumberShortCN(policyIncome, { decimals: 1 })}</span>
                                                                </div>
                                                            )}
                                                            {(taxes.breakdown?.priceControlIncome || 0) > 0 && (
                                                                <div className="stat-item-compact">
                                                                    <span className="text-ancient-stone">价格管制收入</span>
                                                                    <span className="text-green-300 font-mono">+{formatNumberShortCN(taxes.breakdown.priceControlIncome, { decimals: 1 })}</span>
                                                                </div>
                                                            )}
                                                            {(taxes.breakdown?.warIndemnity || 0) > 0 && (
                                                                <div className="stat-item-compact">
                                                                    <span className="text-ancient-stone">战争赔款收入</span>
                                                                    <span className="text-green-300 font-mono">+{formatNumberShortCN(adjustedWarIndemnity, { decimals: 1 })}</span>
                                                                </div>
                                                            )}
                                                            {(taxes.breakdown?.foreignInvestmentTax || 0) > 0 && (
                                                                <div className="stat-item-compact">
                                                                    <span className="text-ancient-stone">外资税收</span>
                                                                    <span className="text-green-300 font-mono">+{formatNumberShortCN(taxes.breakdown.foreignInvestmentTax, { decimals: 1 })}</span>
                                                                </div>
                                                            )}

                                                            <div className="epic-divider" />

                                                            {/* 支出项 */}
                                                            <div className="stat-item-compact">
                                                                <span className="text-ancient-stone">军饷维护</span>
                                                                <span className="text-red-300 font-mono">-{formatNumberShortCN(Math.abs(window.__GAME_MILITARY_EXPENSE__?.dailyExpense || silverUpkeepPerDay || 0), { decimals: 1 })}</span>
                                                            </div>
                                                            {officialSalaryPerDay > 0 && (
                                                                <div className="stat-item-compact">
                                                                    <span className="text-ancient-stone">官员薪俸</span>
                                                                    <span className="text-red-300 font-mono">-{formatNumberShortCN(actualOfficialSalaryPaid, { decimals: 1 })}</span>
                                                                </div>
                                                            )}
                                                            {officialSalaryPerDay > 0 && actualOfficialSalaryPaid !== officialSalaryPerDay && (
                                                                <div className="text-xs text-amber-400/90 leading-tight">
                                                                    应付 {formatNumberShortCN(officialSalaryPerDay, { decimals: 1 })}（国库不足）
                                                                </div>
                                                            )}
                                                            {taxes.breakdown?.subsidy > 0 && (
                                                                <div className="stat-item-compact">
                                                                    <span className="text-ancient-stone">税收补贴</span>
                                                                    <span className="text-red-300 font-mono">-{formatNumberShortCN(taxes.breakdown.subsidy, { decimals: 1 })}</span>
                                                                </div>
                                                            )}
                                                            {(taxes.breakdown?.tariffSubsidy || 0) > 0 && (
                                                                <div className="stat-item-compact">
                                                                    <span className="text-ancient-stone">关税补贴</span>
                                                                    <span className="text-red-300 font-mono">-{formatNumberShortCN(taxes.breakdown.tariffSubsidy, { decimals: 1 })}</span>
                                                                </div>
                                                            )}
                                                            {(taxes.breakdown?.priceControlExpense || 0) > 0 && (
                                                                <div className="stat-item-compact">
                                                                    <span className="text-ancient-stone">价格管制支出</span>
                                                                    <span className="text-red-300 font-mono">-{formatNumberShortCN(taxes.breakdown.priceControlExpense, { decimals: 1 })}</span>
                                                                </div>
                                                            )}
                                                            {policyExpense > 0 && (
                                                                <div className="stat-item-compact">
                                                                    <span className="text-ancient-stone">政令支出</span>
                                                                    <span className="text-red-300 font-mono">-{formatNumberShortCN(policyExpense, { decimals: 1 })}</span>
                                                                </div>
                                                            )}
                                                            {playerInstallmentPayment && playerInstallmentPayment.remainingDays > 0 && (
                                                                <div className="stat-item-compact">
                                                                    <span className="text-ancient-stone">战争赔款支出</span>
                                                                    <span className="text-red-300 font-mono">-{formatNumberShortCN(playerInstallmentPayment.amount || 0, { decimals: 1 })}</span>
                                                                </div>
                                                            )}

                                                            {activeEventEffects?.forcedSubsidy?.length > 0 && (
                                                                <>
                                                                    <div className="stat-item-compact">
                                                                        <span className="text-ancient-stone">强制补贴</span>
                                                                        <span className="text-red-300 font-mono">-{formatNumberShortCN(Math.abs(actualForcedSubsidyPaid || 0), { decimals: 1 })}</span>
                                                                    </div>
                                                                    {actualForcedSubsidyUnpaid > 0 && (
                                                                        <div className="text-xs text-amber-400/90 leading-tight">
                                                                            欠付 {formatNumberShortCN(actualForcedSubsidyUnpaid, { decimals: 1 })}（国库不足）
                                                                        </div>
                                                                    )}
                                                                </>
                                                            )}
                                                        </>
                                                    )}

                                                    <div className="epic-divider" />

                                                    {/* 净收益 */}
                                                    <div className="stat-item-compact bg-ancient-gold/10">
                                                        <span className="font-bold text-ancient-parchment">净收益</span>
                                                        <span className={`font-bold font-mono ${netSilverClass}`}>
                                                            {displayNetSilver >= 0 ? '+' : '-'}{formatNumberShortCN(Math.abs(displayNetSilver || 0), { decimals: 1 })}
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
                                <span className="text-xs font-bold text-ancient-gold">
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
                                <span className="text-xs text-purple-200 font-semibold relative z-10">阶层</span>
                            </button>

                            {/* 国内市场按钮 */}
                            <button
                                onClick={onMarketClick}
                                className="relative group flex items-center gap-1 glass-ancient px-2 py-1 rounded-lg border border-amber-400/40 hover:border-amber-300/60 transition-all flex-shrink-0 overflow-hidden touch-feedback"
                                title="国内市场"
                            >
                                <div className="absolute inset-0 bg-gradient-to-r from-amber-500/20 via-amber-400/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                <Icon name="Package" size={12} className="text-amber-300 relative z-10" />
                                <span className="text-xs text-amber-200 font-semibold relative z-10">市场</span>
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
});
